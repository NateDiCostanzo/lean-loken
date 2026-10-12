/* Lean Loken — deploy-time configuration (public values; the anon key is protected by RLS).
   Fill in SUPABASE_ANON_KEY here, or put a filled copy in pwa/config.local.js (gitignored),
   or set LL_SUPABASE_URL / LL_SUPABASE_ANON_KEY when running pwa/build.py.
   The VAPID public key is not configured here: the app fetches it from
   GET <SUPABASE_URL>/functions/v1/notify?vapid=1 and caches it. */
window.LL_CONFIG = {
  SUPABASE_URL: "https://ramjgwvkuiylwgxspvyl.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhbWpnd3ZrdWl5bHdneHNwdnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NjYxMjcsImV4cCI6MjEwNzM0MjEyN30.Hx4muQPUUvig5T-0dkFPSguuNbHsXwkJXz0mbH3lOis"   // Project Settings → API → anon public key
};
