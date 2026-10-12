/* =========================================================
   AUTH GATE — email + password sign-in, then boot the app
   ---------------------------------------------------------
   The app script (app.js) is loaded only once a session exists, so
   app/js never runs signed out. Offline with a stored session (the
   access token can't be refreshed yet) still boots: the app runs on
   its local cache and syncs when the network returns.
   ========================================================= */
(function(){
"use strict";
const LL=window.LL;
const $=s=>document.querySelector(s);
const html=String.raw;
const APP_SRC=document.documentElement.getAttribute("data-app-src")||"app.js";
let started=false;

function mark(){return '<span class="mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v14h14"/><path d="M9 13l3-3 3 3 4-5"/></svg></span>';}

/* ---------- boot ---------- */
function startApp(user){
  if(started)return;started=true;
  LL.setUser(user);
  document.documentElement.classList.remove("ll-signedout","ll-booting");
  const box=$("#ll-auth");if(box)box.remove();
  const s=document.createElement("script");
  s.src=APP_SRC;
  s.onload=()=>{try{LL.afterApp&&LL.afterApp();}catch(e){console.error(e);}};
  s.onerror=()=>showFatal("Lean Loken couldn't load. Check your connection and try again.");
  document.body.appendChild(s);
}
function showFatal(msg){
  const m=document.createElement("div");m.className="ll-fatal callout warn";m.setAttribute("role","alert");
  m.innerHTML=`<div><b>${msg}</b></div><button class="btn sec sm" type="button">Reload</button>`;
  m.querySelector("button").onclick=()=>location.reload();
  document.body.appendChild(m);
}

async function init(){
  const c=LL.client;
  if(!c){
    // config not filled in, or the supabase library didn't load (offline, nothing cached yet)
    const u=LL.storedUser();
    if(u&&LL.configured)return startApp(u);
    return showSignIn(LL.configured?"offline":"config");
  }
  let session=null,error=null;
  try{
    // a stale token on a bad connection can stall the refresh: don't hold the app hostage to it
    const r=await Promise.race([c.auth.getSession(),new Promise(res=>setTimeout(()=>res({timeout:true}),5000))]);
    if(r&&r.timeout)error=new Error("timeout");
    else{session=r&&r.data&&r.data.session;error=r&&r.error;}
  }catch(e){error=e;}
  if(session&&session.user)startApp(session.user);
  else{
    const u=LL.storedUser();
    if(u&&(error||navigator.onLine===false))startApp(u);   // can't refresh right now: run on the local cache
    else showSignIn();
  }
  c.auth.onAuthStateChange((ev,s)=>{
    if(s&&s.user&&started&&LL.user&&s.user.id===LL.user.id)LL.user.email=s.user.email||LL.user.email;
    if(ev==="SIGNED_OUT"&&started&&!LL.signingOut)location.reload();   // refresh token revoked elsewhere
  });
}

/* ---------- sign-in screen (email + password) ---------- */
let email="", mode="signin";           // signin | signup
const EYE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.6A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9M6.4 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
function showSignIn(problem){
  document.documentElement.classList.add("ll-signedout");
  document.documentElement.classList.remove("ll-booting");
  LL.setUser(null);
  let box=$("#ll-auth");
  if(!box){box=document.createElement("div");box.id="ll-auth";box.className="ll-auth";document.body.appendChild(box);}
  box.innerHTML=html`
  <main class="ll-auth-in" aria-labelledby="ll-auth-h">
    <div class="ll-brand"><div class="logo">${mark()}Lean Loken</div></div>
    <section class="card ll-auth-card">
      <div class="card-b" id="ll-auth-body"></div>
    </section>
    <p class="note ll-auth-foot" id="ll-auth-foot">Your log syncs across your devices and works offline.</p>
  </main>`;
  if(problem==="config")return renderProblem("Not set up yet","This copy of Lean Loken has no Supabase project configured. Fill in config.js (SUPABASE_URL and SUPABASE_ANON_KEY) and deploy again.");
  if(problem==="offline")return renderProblem("You're offline","Connect to the internet to sign in. After that, Lean Loken works offline.",true);
  renderForm();
}
function renderProblem(h,p,retry){
  $("#ll-auth-body").innerHTML=html`<div class="ll-auth-head"><h1 id="ll-auth-h">${h}</h1><p class="ll-lead">${p}</p></div>
    ${retry?'<button class="btn" type="button" id="ll-retry">Try again</button>':""}`;
  const r=$("#ll-retry");if(r)r.onclick=()=>location.reload();
}
const escH=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function renderForm(msg,kind){
  const body=$("#ll-auth-body");if(!body)return;
  const up=mode==="signup";
  body.innerHTML=html`
    <div class="seg ll-modes" role="tablist" aria-label="Account">
      <button type="button" role="tab" id="ll-tab-signin" aria-selected="${!up}" class="${up?"":"on"}" data-mode="signin">Sign in</button>
      <button type="button" role="tab" id="ll-tab-signup" aria-selected="${up}" class="${up?"on":""}" data-mode="signup">Create account</button>
    </div>
    <div class="ll-auth-head"><h1 id="ll-auth-h">${up?"Create your account":"Welcome back"}</h1>
      <p class="ll-lead">${up?"Use any email. Your password needs at least 8 characters.":"Sign in with your email and password."}</p></div>
    <form id="ll-form" novalidate>
      <label class="ll-field" for="ll-email"><span>Email</span>
        <input id="ll-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" required placeholder="you@example.com" value="${escH(email)}"></label>
      <div class="ll-field"><label for="ll-pass">Password</label>
        <div class="ll-pw"><input id="ll-pass" name="password" type="password" autocomplete="${up?"new-password":"current-password"}" ${up?'minlength="8" passwordrules="minlength: 8;"':""} required autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${up?"At least 8 characters":"Your password"}">
        <button type="button" class="ll-eye" id="ll-eye" aria-label="Show password" aria-pressed="false">${EYE}</button></div></div>
      <p class="ll-msg ${msg?(kind||"bad"):""}" id="ll-msg" role="${kind==="ok"?"status":"alert"}" ${msg?"":"hidden"}>${msg?escH(msg):""}</p>
      <button class="btn ll-wide" type="submit" id="ll-submit">${up?"Create account":"Sign in"}</button>
    </form>`;
  body.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{const e=$("#ll-email");if(e)email=e.value.trim();if(mode!==b.dataset.mode){mode=b.dataset.mode;renderForm();$("#ll-tab-"+mode).focus();}});
  $("#ll-form").onsubmit=onSubmit;
  const eye=$("#ll-eye"),pw=$("#ll-pass");
  eye.onclick=()=>{const show=pw.type==="password";pw.type=show?"text":"password";eye.setAttribute("aria-pressed",String(show));eye.setAttribute("aria-label",show?"Hide password":"Show password");eye.innerHTML=show?EYE_OFF:EYE;pw.focus();};
  [$("#ll-email"),pw].forEach(i=>i.addEventListener("input",()=>i.removeAttribute("aria-invalid")));
}
function busy(btn,on,label){if(!btn)return;btn.disabled=on;if(label)btn.textContent=label;}
function friendly(e,up){
  const m=String((e&&(e.message||e.msg))||""), code=e&&(e.code||e.error_code)||"";
  if(/fetch|network|Failed to/i.test(m)||e&&e.status===0||navigator.onLine===false)return "You're offline. Connect and try again.";
  if(code==="user_already_exists"||/already (been )?registered|already exists/i.test(m))return "That email already has an account; sign in instead.";
  if(code==="invalid_credentials"||/invalid login credentials/i.test(m))return "Wrong email or password.";
  if(code==="email_not_confirmed"||/not confirmed/i.test(m))return "Confirm your email first (check your inbox), then sign in.";
  if(code==="weak_password"||/password should|weak password/i.test(m))return "Choose a stronger password (at least 8 characters).";
  if(code==="signup_disabled"||/signups? not allowed/i.test(m))return "New accounts are turned off for Lean Loken.";
  if(/rate|too many|security purposes/i.test(m))return "Too many tries. Wait a minute and try again.";
  return m||"Something went wrong. Try again.";
}
async function onSubmit(e){
  e.preventDefault();
  const up=mode==="signup", ei=$("#ll-email"), pi=$("#ll-pass"), v=ei.value.trim().toLowerCase(), pw=pi.value;
  email=ei.value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){ei.setAttribute("aria-invalid","true");ei.focus();return renderInline("Enter a valid email address.");}
  if(up&&pw.length<8){pi.setAttribute("aria-invalid","true");pi.focus();return renderInline("Use at least 8 characters for your password.");}
  if(!pw){pi.setAttribute("aria-invalid","true");pi.focus();return renderInline("Enter your password.");}
  const b=$("#ll-submit");busy(b,true,up?"Creating account…":"Signing in…");
  try{
    const r=up?await LL.client.auth.signUp({email:v,password:pw}):await LL.client.auth.signInWithPassword({email:v,password:pw});
    if(r&&r.error)throw r.error;
    const s=r&&r.data&&r.data.session;
    if(s&&s.user)return startApp(s.user);
    if(up){
      // with email confirmation on, signUp returns no session (and an existing address returns a user with no identities)
      const u=r&&r.data&&r.data.user;
      if(u&&Array.isArray(u.identities)&&u.identities.length===0)throw {code:"user_already_exists"};
      mode="signin";renderForm("Check your email to confirm, then sign in.","ok");return;
    }
    throw new Error("Wrong email or password.");
  }catch(err){
    busy(b,false,up?"Create account":"Sign in");
    const msg=friendly(err,up);
    if(/Wrong email/.test(msg)){pi.setAttribute("aria-invalid","true");pi.select&&pi.select();}
    renderInline(msg);
  }
}
function renderInline(msg,kind){const m=$("#ll-msg");if(!m)return;m.hidden=false;m.className="ll-msg "+(kind||"bad");m.setAttribute("role",kind==="ok"?"status":"alert");m.textContent=msg;}

/* ---------- sign out (called from the Plan account card) ---------- */
LL.signOut=async function(){
  LL.signingOut=true;
  try{if(LL.beforeSignOut)await LL.beforeSignOut();}catch(e){}
  const c=LL.client;
  if(c){
    try{const r=await c.auth.signOut();if(r&&r.error)throw r.error;}
    catch(e){try{await c.auth.signOut({scope:"local"});}catch(_){}}
  }
  try{localStorage.removeItem(LL.AUTH_KEY);}catch(e){}
  // the local cache belongs to this account: don't leave it on the device
  wipeCache();
  // the app writes its cache again on pagehide: wipe once more on the next load, before it runs
  try{sessionStorage.setItem("leanloken.wipe","1");}catch(e){}
  location.replace(location.pathname+location.search+"#today");
  location.reload();
};

function wipeCache(){try{["leanloken.v2","leanloken.pending","leanloken.base","leanout12.v1"].forEach(k=>localStorage.removeItem(k));}catch(e){}}
try{if(sessionStorage.getItem("leanloken.wipe")){sessionStorage.removeItem("leanloken.wipe");wipeCache();}}catch(e){}
document.documentElement.classList.add("ll-booting");
init().catch(e=>{console.error(e);showSignIn();});
})();
