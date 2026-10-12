// Lean Loken — notify Edge Function (Supabase / Deno).
//
// Deploy with "Verify JWT" OFF; this function checks auth itself. No secrets are set by hand:
//   - CRON secret: generated in Postgres (Vault), read here via rpc('ll_cron_secret') with the service role.
//   - VAPID key pair: generated here on first need and stored in public.ll_config (service_role only).
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by the platform. VAPID_SUBJECT is optional.
//
// Endpoints:
//   GET  ?vapid=1                         → {publicKey} (public; the app subscribes with it)
//   POST, header x-cron-secret (pg_cron)  → body {} sends what's due; {dry:true, now?:ISO} computes only
//   POST, Authorization: Bearer <user JWT>, body {test:true} → "Lean Loken notifications are on" to that user
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";
import { dueNotifications, todayKeyInTz, addDays, leadOf } from "./schedule.js";

type Sub = { endpoint: string; user_id: string; p256dh: string; auth: string; tz: string | null; created_at: string };
type Due = { key: string; date: string; id: string; category: string; title: string; body: string; tag: string; url: string; at: string; due: string };
type SendResult = { ok: number; gone: number; failed: number; errors: string[] };
type Vapid = { publicKey: string; privateKey: string };

// "*" covers https://natedicostanzo.github.io and localhost. Auth uses a bearer header, never cookies,
// so no credentialed CORS is needed (and a static header can't race between concurrent requests).
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });

const env = (k: string) => Deno.env.get(k) ?? "";
const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_SUBJECT = env("VAPID_SUBJECT") || "mailto:nathanzd@me.com";
const DEFAULT_TZ = "America/Los_Angeles";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

/** CRON secret from Vault via rpc (service_role only), cached per instance. */
let cronSecret: string | null = null;
async function getCronSecret(): Promise<string> {
  if (cronSecret) return cronSecret;
  const { data, error } = await admin.rpc("ll_cron_secret");
  if (error) throw new Error(`ll_cron_secret: ${error.message}`);
  if (typeof data !== "string" || data.length < 32) throw new Error("ll_cron_secret returned no secret");
  return (cronSecret = data);
}

/** VAPID pair from ll_config; generated and stored (as one row, so the pair can't mix) on first need. */
let vapid: Vapid | null = null;
let vapidLoading: Promise<Vapid> | null = null;
async function readVapid(): Promise<Vapid | null> {
  const { data, error } = await admin.from("ll_config").select("value").eq("key", "vapid").maybeSingle();
  if (error) throw new Error(`ll_config: ${error.message}`);
  if (!data?.value) return null;
  const v = JSON.parse(data.value);
  return v?.publicKey && v?.privateKey ? { publicKey: v.publicKey, privateKey: v.privateKey } : null;
}
async function loadVapid(): Promise<Vapid> {
  let v = await readVapid();
  if (!v) {
    const k = webpush.generateVAPIDKeys();
    // ignoreDuplicates: if another instance won the race, keep its pair and re-read it
    const { error } = await admin.from("ll_config")
      .upsert({ key: "vapid", value: JSON.stringify({ publicKey: k.publicKey, privateKey: k.privateKey }) },
        { onConflict: "key", ignoreDuplicates: true });
    if (error) throw new Error(`ll_config insert: ${error.message}`);
    v = await readVapid();
    if (!v) throw new Error("VAPID keys could not be stored");
  }
  webpush.setVapidDetails(VAPID_SUBJECT, v.publicKey, v.privateKey);
  return v;
}
function getVapid(): Promise<Vapid> {
  if (vapid) return Promise.resolve(vapid);
  vapidLoading ??= loadVapid().then((v) => (vapid = v)).finally(() => { vapidLoading = null; });
  return vapidLoading;
}

/** Constant-time string compare (avoids leaking the secret through timing). */
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/** Push one payload to every subscription; subscriptions the push service reports gone (404/410) are deleted. */
async function sendToSubs(subs: Sub[], payload: Record<string, unknown>): Promise<SendResult> {
  await getVapid();
  const res: SendResult = { ok: 0, gone: 0, failed: 0, errors: [] };
  const body = JSON.stringify(payload);
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 1800, urgency: "high" }, // a reminder older than 30 min is useless
      );
      res.ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        res.gone++;
        await admin.from("push_subs").delete().eq("endpoint", s.endpoint);
      } else {
        res.failed++;
        res.errors.push(`${code ?? "error"}: ${String((e as { body?: string }).body ?? (e as Error).message ?? e).slice(0, 200)}`);
      }
    }
  }));
  return res;
}

const payloadOf = (n: { title: string; body: string; tag: string; url: string }) => ({
  title: n.title, body: n.body, tag: n.tag, url: n.url, data: { url: n.url },
});

/** Test push for the signed-in user. */
async function handleTest(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return json({ error: "unauthorized" }, 401);
  const uid = data.user.id;
  const { data: subs, error: e2 } = await admin.from("push_subs").select("*").eq("user_id", uid);
  if (e2) return json({ error: e2.message }, 500);
  if (!subs?.length) return json({ mode: "test", user: uid, subs: 0, sent: 0, note: "No push subscription for this user. Enable notifications first." }, 404);
  const { data: set } = await admin.from("docs").select("data").eq("user_id", uid).eq("id", "settings").maybeSingle();
  const lead = leadOf(set?.data ?? {});
  const r = await sendToSubs(subs as Sub[], payloadOf({
    title: "Lean Loken notifications are on",
    body: lead > 0 ? `You'll get a reminder ${lead} min before each item on your schedule.` : "You'll get a reminder at each item on your schedule.",
    tag: "ll-test", url: "./#today",
  }));
  return json({ mode: "test", user: uid, subs: subs.length, sent: r.ok, removed: r.gone, failed: r.failed, errors: r.errors });
}

/** Cron sweep over every user with a push subscription. */
async function handleCron(nowISO: string, dry: boolean) {
  const summary = { mode: dry ? "dry-run" : "cron", now: nowISO, users: 0, due: 0, sent: 0, deduped: 0, removed: 0, failed: 0, errors: [] as string[], items: [] as unknown[] };

  if (!dry) { // keep push_log small: dedup keys only matter for a day or two
    const cutoff = new Date(Date.parse(nowISO) - 14 * 864e5).toISOString();
    await admin.from("push_log").delete().lt("sent_at", cutoff);
  }

  const { data: subs, error } = await admin.from("push_subs").select("*").order("created_at", { ascending: false });
  if (error) return json({ ...summary, error: error.message }, 500);
  const byUser = new Map<string, Sub[]>();
  for (const s of (subs ?? []) as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  summary.users = byUser.size;

  for (const [uid, list] of byUser) {
    try {
      const tz = list.find((s) => s.tz)?.tz || DEFAULT_TZ; // newest subscription's zone
      const today = todayKeyInTz(tz, nowISO), yday = addDays(today, -1);
      const { data: docs, error: e1 } = await admin.from("docs").select("id,data").eq("user_id", uid)
        .in("id", ["settings", `d-${today}`, `d-${yday}`]);
      if (e1) throw new Error(e1.message);
      const get = (id: string) => docs?.find((d: { id: string }) => d.id === id)?.data ?? null;
      const due: Due[] = dueNotifications({
        settings: get("settings") ?? {}, day: get(`d-${today}`) ?? {}, prevDay: get(`d-${yday}`) ?? {},
        nowISO, tz, windowMin: 6,
      });
      summary.due += due.length;

      for (const n of due) {
        if (dry) { summary.items.push({ user: uid, tz, key: n.key, title: n.title, body: n.body, at: n.at }); continue; }
        // dedup: only the run that inserts the key sends it
        const { data: ins, error: e2 } = await admin.from("push_log")
          .upsert({ user_id: uid, key: n.key }, { onConflict: "user_id,key", ignoreDuplicates: true })
          .select("key");
        if (e2) throw new Error(e2.message);
        if (!ins?.length) { summary.deduped++; continue; }
        const r = await sendToSubs(list, payloadOf(n));
        summary.sent += r.ok; summary.removed += r.gone; summary.failed += r.failed;
        summary.errors.push(...r.errors);
        summary.items.push({ user: uid, key: n.key, title: n.title, delivered: r.ok, removed: r.gone, failed: r.failed });
      }
    } catch (e) {
      summary.errors.push(`${uid}: ${(e as Error).message ?? e}`);
    }
  }
  return json(summary);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "server misconfigured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing" }, 500);

  try {
    if (req.method === "GET") {
      if (new URL(req.url).searchParams.has("vapid")) {
        const v = await getVapid();
        return json({ publicKey: v.publicKey }, 200, { "Cache-Control": "public, max-age=300" });
      }
      return json({ error: "not found" }, 404);
    }
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

    let body: Record<string, unknown> = {};
    try { body = (await req.json()) ?? {}; } catch { body = {}; }

    const cronHeader = req.headers.get("x-cron-secret");
    if (cronHeader != null) {
      if (!safeEqual(cronHeader, await getCronSecret())) return json({ error: "unauthorized" }, 401);
      // optional `now` override: dry runs (check the schedule at any instant), or any run when the
      // ALLOW_NOW_OVERRIDE=1 env is set (local tests only; never set it in production)
      const canOverride = body.dry === true || env("ALLOW_NOW_OVERRIDE") === "1";
      const now = canOverride && typeof body.now === "string" && !isNaN(Date.parse(body.now))
        ? new Date(body.now).toISOString() : new Date().toISOString();
      return await handleCron(now, body.dry === true);
    }
    if (body.test === true) return await handleTest(req);
    return json({ error: "unauthorized" }, 401);
  } catch (e) {
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});
