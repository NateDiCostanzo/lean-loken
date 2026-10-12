# Lean Loken — standalone PWA

The same app as the claude.ai artifact (app/js + app/src, unchanged), packaged as an
installable web app that stores data in Supabase. A `window.claude` shim
(`src/claude-shim.js`) maps the app's `db` / `user` / `downloads` capabilities onto
supabase-js; `sample` (AI) resolves null, so the AI UI stays hidden.

## Build

```
python3 pwa/build.py            # → pwa/dist/
python3 pwa/build.py --out DIR  # anywhere else
```

`config.js` comes from `pwa/config.local.js` if it exists (gitignored), otherwise from
`src/config.example.js`, with `LL_SUPABASE_URL` / `LL_SUPABASE_ANON_KEY` env vars
substituted when set:

```
LL_SUPABASE_ANON_KEY=eyJ... python3 pwa/build.py
```

Both values are public (the anon key is protected by RLS). With a placeholder key the
app shows "Not set up yet" instead of the sign-in form. The VAPID public key is NOT
configured here: the app fetches it from `GET <SUPABASE_URL>/functions/v1/notify?vapid=1`
(`{publicKey}`) when you turn notifications on, and caches it.

## Deploy (GitHub Pages)

Publish the contents of `pwa/dist/` (including `.nojekyll`) at the root of the Pages
site, e.g. `https://natedicostanzo.github.io/lean-loken/`. Every URL is relative and the
service worker's scope is `./`, so the subpath needs no configuration. Each build
stamps a new version into `sw.js` and the script URLs; the new service worker
activates right away, and the app picks it up on the next launch.

## Supabase expectations (owned by the backend; see supabase/)

- `public.docs(user_id uuid, id text, data jsonb, updated_at timestamptz, pk(user_id,id))`
  with owner-only RLS, in the `supabase_realtime` publication. Row ids: `settings`,
  `d-YYYY-MM-DD`.
- `public.push_subs(user_id, endpoint pk, p256dh, auth, tz, created_at)`, owner-only
  RLS. The app upserts `onConflict: endpoint` and deletes its own row on "Turn off"
  and on sign-out.
- Edge function `notify`: `GET ?vapid=1` → `{publicKey}` (no auth, CORS);
  `functions.invoke('notify', {body:{test:true}})` sends a test push to the caller.
- Settings the function reads (written by the Notifications card via `saveSet`):
  `settings.notifyLead` (minutes, default 15) and
  `settings.notify = {enabled, meals, training, weigh, evening, caffeine}`
  (defaults: all true except caffeine).
- Auth: email + password (`signUp` / `signInWithPassword`). With email confirmation
  off, sign-up returns a session at once. There is no "forgot password" flow yet:
  reset a password from the Supabase dashboard (Authentication → Users). After your
  account exists, consider turning off new sign-ups in Authentication → Providers.

## Files

```
src/claude-shim.js   window.claude over supabase-js (db per db.d.ts, user, downloads)
src/auth.js          sign-in / create-account screen; loads app.js once signed in
src/pwa.js           SW registration, install guide, notifications + account cards
src/pwa.css          styles for the above (app tokens)
src/sw.js            offline shell, push display, notificationclick deep links
src/head.html        manifest / iOS meta tags
src/config.example.js
build.py             → dist/ (index.html, app.js, config.js, claude-shim.js, auth.js,
                       pwa.js, sw.js, manifest.webmanifest, icons/, .nojekyll)
```

Tests: `NODE_PATH=$(npm root -g) node pwa-test/test-pwa.js` (from the scratchpad root;
mocked Supabase, real service worker over http://localhost).
