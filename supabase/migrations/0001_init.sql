-- =====================================================================
-- Lean Loken — 0001_init.sql
-- Paste the whole file into Supabase → SQL Editor → Run.
-- Idempotent: safe to run again (tables/indexes "if not exists", functions "or replace",
-- policies/triggers dropped and recreated, the cron job upserted by name).
-- =====================================================================

-- ---------- extensions ----------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists pgcrypto with schema extensions;

-- ---------- docs: one row per app document (settings, d-YYYY-MM-DD) ----------
create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 64),
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create or replace function public.ll_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists docs_touch_updated_at on public.docs;
create trigger docs_touch_updated_at before update on public.docs
  for each row execute function public.ll_touch_updated_at();

alter table public.docs enable row level security;
drop policy if exists "docs: owner select" on public.docs;
drop policy if exists "docs: owner insert" on public.docs;
drop policy if exists "docs: owner update" on public.docs;
drop policy if exists "docs: owner delete" on public.docs;
create policy "docs: owner select" on public.docs for select to authenticated using (user_id = (select auth.uid()));
create policy "docs: owner insert" on public.docs for insert to authenticated with check (user_id = (select auth.uid()));
create policy "docs: owner update" on public.docs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "docs: owner delete" on public.docs for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.docs from anon;
grant select, insert, update, delete on public.docs to authenticated;
grant all on public.docs to service_role;

-- Realtime: postgres_changes for docs (RLS still applies to what each client receives)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs'
  ) then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;

-- ---------- push_subs: one row per device push subscription ----------
create table if not exists public.push_subs (
  endpoint   text        primary key,
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text        not null,
  auth       text        not null,
  tz         text        not null default 'America/Los_Angeles',
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_id_idx on public.push_subs (user_id);

alter table public.push_subs enable row level security;
drop policy if exists "push_subs: owner select" on public.push_subs;
drop policy if exists "push_subs: owner insert" on public.push_subs;
drop policy if exists "push_subs: owner update" on public.push_subs;
drop policy if exists "push_subs: owner delete" on public.push_subs;
create policy "push_subs: owner select" on public.push_subs for select to authenticated using (user_id = (select auth.uid()));
create policy "push_subs: owner insert" on public.push_subs for insert to authenticated with check (user_id = (select auth.uid()));
create policy "push_subs: owner update" on public.push_subs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "push_subs: owner delete" on public.push_subs for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subs from anon;
grant select, insert, update, delete on public.push_subs to authenticated;
grant all on public.push_subs to service_role;

-- ---------- push_log: dedup keys "YYYY-MM-DD:itemId"; service role only ----------
create table if not exists public.push_log (
  user_id uuid        not null references auth.users (id) on delete cascade,
  key     text        not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index if not exists push_log_sent_at_idx on public.push_log (sent_at);
alter table public.push_log enable row level security;   -- no policies: clients get nothing
revoke all on public.push_log from anon, authenticated;
grant all on public.push_log to service_role;

-- ---------- ll_config: server-side config (VAPID key pair, generated by the notify function) ----------
create table if not exists public.ll_config (
  key   text primary key,
  value text not null
);
alter table public.ll_config enable row level security;   -- no policies: clients get nothing
revoke all on public.ll_config from anon, authenticated;
grant all on public.ll_config to service_role;

-- ---------- Vault: notify URL + CRON secret (generated here; nobody copies it anywhere) ----------
do $$
declare
  v_url constant text := 'https://ramjgwvkuiylwgxspvyl.supabase.co/functions/v1/notify';
  v_id  uuid;
begin
  select id into v_id from vault.secrets where name = 'lean_loken_notify_url';
  if v_id is null then
    perform vault.create_secret(v_url, 'lean_loken_notify_url', 'Lean Loken: URL of the notify Edge Function');
  elsif (select decrypted_secret from vault.decrypted_secrets where id = v_id) is distinct from v_url then
    perform vault.update_secret(v_id, v_url);
  end if;

  select id into v_id from vault.secrets where name = 'lean_loken_cron_secret';
  if v_id is null then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'lean_loken_cron_secret',
      'Lean Loken: cron -> notify shared secret (read by the function via ll_cron_secret())');
  elsif (select decrypted_secret from vault.decrypted_secrets where id = v_id) like 'REPLACE_%' then
    perform vault.update_secret(v_id, encode(extensions.gen_random_bytes(32), 'hex'));   -- old placeholder
  end if;
end $$;

-- The notify function reads the CRON secret through this (service_role only).
create or replace function public.ll_cron_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'lean_loken_cron_secret';
$$;
revoke all on function public.ll_cron_secret() from public, anon, authenticated;
grant execute on function public.ll_cron_secret() to service_role;

-- Calls the notify function with the CRON secret header.
create or replace function public.ll_invoke_notify()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'lean_loken_notify_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'lean_loken_cron_secret';
  if v_url is null or v_secret is null then
    raise notice 'll_invoke_notify: Vault secrets missing; skipping';
    return null;
  end if;
  return net.http_post(
    url                  := v_url,
    headers              := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body                 := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;
revoke all on function public.ll_invoke_notify() from public, anon, authenticated;

-- Every 5 minutes. cron.schedule with an existing job name updates that job (no duplicates).
select cron.schedule('lean-loken-notify', '*/5 * * * *', $cron$ select public.ll_invoke_notify(); $cron$);


-- =====================================================================
-- Checks (optional; run separately after deploying the notify function)
-- =====================================================================
-- -- fire once now, then read the response a few seconds later (expect status_code 200):
-- select public.ll_invoke_notify();
-- select status_code, content::text, error_msg, created
--   from net._http_response order by created desc limit 3;
--
-- -- the schedule and its recent runs:
-- select jobid, jobname, schedule, active from cron.job where jobname = 'lean-loken-notify';
-- select status, return_message, start_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'lean-loken-notify')
--   order by start_time desc limit 10;
--
-- -- VAPID pair exists once the function has run (or after GET .../notify?vapid=1):
-- select key, left(value, 40) from public.ll_config;
--
-- -- pause / resume / remove:
-- -- select cron.alter_job((select jobid from cron.job where jobname = 'lean-loken-notify'), active := false);
-- -- select cron.unschedule('lean-loken-notify');
