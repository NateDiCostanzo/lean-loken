/* =========================================================
   PWA layer — service worker, install guide, notifications,
   account (sign out). Hooks into the app only through its public
   globals (AFTER_RENDER, S, saveSet, setTab, toast), after app.js loads.
   ========================================================= */
(function(){
"use strict";
const LL=window.LL;
const CFG=LL.cfg||{};
/* Backend contract (supabase/functions/notify): settings.notifyLead (minutes, default 15) and
   settings.notify={enabled,meals,training,weigh,evening,caffeine}. */
const LEAD_DEF=15;
const NOTIFY_DEF={enabled:true,meals:true,training:true,weigh:true,evening:true,caffeine:false};
const CATS=["meals","training","weigh","evening","caffeine"];
const LEADS=[5,10,15,20,30,45,60];
const K_VAPID="leanloken.vapid", K_DISMISS="leanloken.installDismissed", K_NUDGE="leanloken.notifyNudgeDismissed", K_PUSH="leanloken.pushOn";
const ls={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}},del(k){try{localStorage.removeItem(k);}catch(e){}}};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const say=m=>{if(typeof toast==="function")toast(m);};

/* ---------- environment ---------- */
const mqStandalone=matchMedia("(display-mode: standalone)");
const isStandalone=()=>mqStandalone.matches||navigator.standalone===true;
const ua=navigator.userAgent||"";
const isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const iosOtherBrowser=isIOS&&/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
let installEvt=null;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;paint();});
addEventListener("appinstalled",()=>{installEvt=null;paint();});
try{mqStandalone.addEventListener("change",()=>paint());}catch(e){}

/* ---------- service worker ---------- */
const swOK="serviceWorker" in navigator&&(location.protocol==="https:"||/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname));
LL.swReg=null;
if(swOK){
  const reg=()=>navigator.serviceWorker.register("sw.js",{scope:"./"}).then(r=>{LL.swReg=r;}).catch(e=>console.warn("SW registration failed",e));
  if(document.readyState==="complete")reg();else addEventListener("load",reg);
  navigator.serviceWorker.addEventListener("message",e=>{
    const d=e.data||{};
    if(d.type==="nav"&&typeof d.url==="string")goHash(new URL(d.url,location.href).hash);
  });
}
function goHash(h){
  const t=(h||"").replace(/^#/,"");
  if(["today","train","progress","plan","fuel"].includes(t)&&typeof setTab==="function"&&typeof S!=="undefined"){if(S.tab!==t)setTab(t);}
}
addEventListener("hashchange",()=>goHash(location.hash));

/* ---------- notification settings (S.set.notify, synced with settings) ---------- */
function getNotify(){
  const st=typeof S!=="undefined"&&S.set?S.set:{};
  const n=st.notify&&typeof st.notify==="object"?st.notify:{};
  const o={};
  Object.keys(NOTIFY_DEF).forEach(k=>o[k]=typeof n[k]==="boolean"?n[k]:NOTIFY_DEF[k]);
  o.lead=LEADS.includes(+st.notifyLead)?+st.notifyLead:LEAD_DEF;
  return o;
}
function setNotify(patch){
  const cur=getNotify();
  if("lead" in patch){S.set.notifyLead=+patch.lead;}
  const o={};Object.keys(NOTIFY_DEF).forEach(k=>o[k]=k in patch?!!patch[k]:cur[k]);
  S.set.notify=o;
  saveSet();
}

/* ---------- push ---------- */
let pushSt="checking";        // checking | on | off | denied | needs-install | unsupported | unconfigured | busy
function b64u(s){const p="=".repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(b,c=>c.charCodeAt(0));}
const pushSupported=()=>swOK&&"PushManager" in window&&"Notification" in window;
function swReady(ms){return Promise.race([navigator.serviceWorker.ready,sleep(ms||8000).then(()=>null)]);}
async function computePush(){
  if(!pushSupported())return isIOS&&!isStandalone()?"needs-install":"unsupported";
  if(!LL.configured)return "unconfigured";
  if(Notification.permission==="denied")return "denied";
  const reg=await swReady(4000);if(!reg)return "off";
  const sub=await reg.pushManager.getSubscription().catch(()=>null);
  return sub&&Notification.permission==="granted"?"on":"off";
}
async function refreshPush(){
  const s=await computePush().catch(()=>"unsupported");
  if(s!==pushSt){pushSt=s;paint();}
}
/* The VAPID public key comes from the notify function (no auth), cached for offline launches. */
const FN=()=>String(CFG.SUPABASE_URL||"").replace(/\/+$/,"")+"/functions/v1/notify";
async function vapidKey(){
  try{
    const r=await fetch(FN()+"?vapid=1",{cache:"no-store"});
    if(r.ok){const j=await r.json();if(j&&typeof j.publicKey==="string"&&j.publicKey.length>40){ls.set(K_VAPID,j.publicKey);return j.publicKey;}}
  }catch(e){}
  const c=ls.get(K_VAPID);if(c)return c;
  throw new Error("Couldn't get the push key");
}
async function subscribe(reg){
  const key=await vapidKey();
  try{return await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(key)});}
  catch(e){
    // the server key changed: drop the old subscription and retry once
    const old=await reg.pushManager.getSubscription();if(old){await old.unsubscribe().catch(()=>{});}
    ls.del(K_VAPID);
    return reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(await vapidKey())});
  }
}
async function saveSub(sub){
  const c=LL.client,u=LL.user;if(!c||!u)throw new Error("Not signed in");
  const j=sub.toJSON?sub.toJSON():sub, keys=j.keys||{};
  let tz="UTC";try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";}catch(e){}
  const r=await c.from("push_subs").upsert({user_id:u.id,endpoint:j.endpoint,p256dh:keys.p256dh,auth:keys.auth,tz},{onConflict:"endpoint"});
  if(r&&r.error)throw r.error;
}
async function enablePush(){
  if(pushSt==="busy")return;
  // requestPermission must run inside the tap (iOS)
  let perm;
  try{perm=await Notification.requestPermission();}catch(e){perm=Notification.permission;}
  if(perm!=="granted"){pushSt=perm==="denied"?"denied":"off";paint();if(perm!=="denied")say("Notifications weren't allowed");return;}
  pushSt="busy";paint();
  try{
    const reg=await swReady();if(!reg)throw new Error("The app's service worker isn't ready. Reload and try again.");
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await subscribe(reg);
    await saveSub(sub);
    ls.set(K_PUSH,"1");pushSt="on";paint();
    say("Notifications on");
  }catch(e){
    console.error(e);pushSt=await computePush().catch(()=>"off");paint();
    say(/fetch|network/i.test(e&&e.message||"")||navigator.onLine===false?"You're offline. Try again when connected.":"Couldn't turn on notifications. Try again.");
  }
}
async function disablePush(silent){
  try{
    const reg=await swReady(3000), sub=reg&&await reg.pushManager.getSubscription();
    if(sub){
      const ep=sub.endpoint;
      await sub.unsubscribe().catch(()=>{});
      if(LL.client&&LL.user)await LL.client.from("push_subs").delete().eq("endpoint",ep).eq("user_id",LL.user.id);
    }
  }catch(e){}
  ls.del(K_PUSH);
  if(!silent){pushSt=await computePush().catch(()=>"off");paint();say("Notifications off on this device");}
}
async function sendTest(btn){
  if(btn){btn.disabled=true;btn.textContent="Sending…";}
  try{
    const c=LL.client;if(!c||!c.functions)throw new Error("not signed in");
    const r=await c.functions.invoke("notify",{body:{test:true}});
    if(r&&r.error)throw r.error;
    say("Test sent. It should arrive in a few seconds.");
  }catch(e){say(navigator.onLine===false?"You're offline. Try again when connected.":"Test didn't send ("+(e&&e.message||"error")+")");}
  if(btn){btn.disabled=false;btn.textContent="Send test notification";}
}
/* on each launch: keep the server row fresh (time zone, rotated endpoint) */
async function syncPushOnBoot(){
  await refreshPush();
  if(!pushSupported()||!LL.configured||Notification.permission!=="granted")return;
  try{
    const reg=await swReady();if(!reg)return;
    let sub=await reg.pushManager.getSubscription();
    if(!sub&&ls.get(K_PUSH)==="1")sub=await subscribe(reg);
    if(sub){await saveSub(sub);if(pushSt!=="on"){pushSt="on";paint();}}
  }catch(e){}
}
LL.beforeSignOut=()=>disablePush(true);

/* ---------- markup ---------- */
const ICON_SHARE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v9h14v-9h-1"/></svg>';
const ICON_ADD='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>';
const ICON_BELL='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>';
const ICON_PHONE='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>';

function installSteps(){
  if(!isIOS&&installEvt)return `<p class="ll-p">Install Lean Loken as an app: it opens full screen from your home screen or dock and works offline.</p>
    <div class="row"><button class="btn" type="button" data-ll="install">Install app</button></div>`;
  if(!isIOS)return `<p class="ll-p">On your iPhone, open this page in Safari and add it to your Home Screen. On a computer, use <b>Install app</b> in Chrome or Edge's address bar.</p>`;
  return `<ol class="ll-steps">
      <li><span class="n">1</span><span>${iosOtherBrowser?"Tap <b>Share</b> in the address bar.":"Tap <b>Share</b> in Safari's toolbar."}<i class="ll-ic">${ICON_SHARE}</i></span></li>
      <li><span class="n">2</span><span>Scroll down and tap <b>Add to Home Screen</b>.<i class="ll-ic">${ICON_ADD}</i></span></li>
      <li><span class="n">3</span><span>Tap <b>Add</b>, then open Lean Loken from your Home Screen.</span></li>
    </ol>`;
}
function installCard(where){
  const dismiss=where==="today"?`<button class="ll-x" type="button" data-ll="dismiss-install" aria-label="Hide install guide"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`:"";
  return `<section class="card ll-card" id="ll-install" data-ll-card="install">
    <div class="card-h"><h2><span class="ll-hic">${ICON_PHONE}</span>Add to Home Screen</h2>${dismiss}</div>
    <div class="card-b">${installSteps()}
      <p class="note">${isIOS?"Reminders only work in the installed app (iOS 16.4 or later).":"Reminders work in the installed app or in this browser."} Your log syncs either way.</p></div>
  </section>`;
}
function switchRow(key,label,sub,on,dis){
  const id="ll-n-"+key;
  return `<li class="ll-sw-row"><label for="${id}"><b>${label}</b><span>${sub}</span></label>
    <input class="ll-sw" type="checkbox" role="switch" id="${id}" data-ll-notify="${key}" ${on?"checked":""} ${dis?"disabled":""}></li>`;
}
function notifyCard(){
  const n=getNotify(), st=pushSt;
  let status="",action="";
  switch(st){
    case"on":status=`<span class="badge good">On for this device</span>`;
      action=`<div class="row"><button class="btn sec" type="button" data-ll="test">Send test notification</button><button class="btn sec" type="button" data-ll="push-off">Turn off</button></div>`;break;
    case"off":status=`<span class="badge">Off</span>`;
      action=`<p class="ll-p">Get a reminder before each meal, workout and check-in on this device.</p><div class="row"><button class="btn" type="button" data-ll="push-on">Enable notifications</button></div>`;break;
    case"busy":status=`<span class="badge acc">Turning on…</span>`;action=`<div class="row"><button class="btn" type="button" disabled>Enable notifications</button></div>`;break;
    case"denied":status=`<span class="badge warn">Blocked</span>`;
      action=`<p class="ll-p">Notifications are blocked for Lean Loken. ${isIOS?"Turn them on in iPhone <b>Settings → Notifications → Lean Loken</b>, then come back.":"Allow them in your browser's site settings, then reload."}</p>`;break;
    case"needs-install":status=`<span class="badge">Needs the app</span>`;
      action=`<p class="ll-p">On iPhone, notifications work only in the installed app. Add Lean Loken to your Home Screen first${isStandalone()?"":" (see the steps below)"}, then turn them on from there.</p>`;break;
    case"unconfigured":status=`<span class="badge">Not set up</span>`;
      action=`<p class="ll-p">Push isn't configured for this copy (no Supabase project in config.js).</p>`;break;
    case"unsupported":status=`<span class="badge">Not available</span>`;
      action=`<p class="ll-p">This browser can't receive push notifications.</p>`;break;
    default:status=`<span class="badge">Checking…</span>`;
  }
  return `<section class="card ll-card" id="ll-notify" data-ll-card="notify">
    <div class="card-h"><h2><span class="ll-hic">${ICON_BELL}</span>Notifications</h2>${status}</div>
    <div class="card-b">${action}
      <fieldset class="fs"><legend>Remind me</legend>
        <ul class="ll-sw-list ll-master">${switchRow("enabled","Reminders","All notifications, on every device you've turned them on for",n.enabled)}</ul>
        <div class="ll-sub-settings" ${n.enabled?"":"data-off"}>
        <label class="ll-lead-row" for="ll-lead"><span>Before each item</span>
          <select id="ll-lead" data-ll-notify="lead" ${n.enabled?"":"disabled"}>${LEADS.map(m=>`<option value="${m}" ${m===n.lead?"selected":""}>${m} min</option>`).join("")}</select></label>
        <ul class="ll-sw-list">
          ${switchRow("meals","Meals","Each meal and shake",n.meals,!n.enabled)}
          ${switchRow("training","Training","Lifts, intervals and walks",n.training,!n.enabled)}
          ${switchRow("weigh","Weigh-in and water","Morning weigh-in; water at 11 AM and 3 PM when behind",n.weigh,!n.enabled)}
          ${switchRow("evening","Evening","8:30 PM check-in and wind-down",n.evening,!n.enabled)}
          ${switchRow("caffeine","Caffeine cutoff","Last call for caffeine",n.caffeine,!n.enabled)}
        </ul></div>
      </fieldset>
      <p class="note">Settings sync to all your devices. Each device you turn notifications on for gets them.</p>
    </div></section>`;
}
function accountCard(){
  const em=LL.user&&LL.user.email;
  return `<section class="card ll-card" id="ll-account" data-ll-card="account">
    <div class="card-h"><h2>Account</h2></div>
    <div class="card-b"><div class="ll-acct"><div class="ll-acct-tx"><span class="eyebrow">Signed in as</span><b>${esc(em||"this device")}</b></div>
      <button class="btn sec" type="button" data-ll="signout">Sign out</button></div></div></section>`;
}
function nudgeCard(){
  return `<div class="callout ll-nudge" data-ll-card="nudge"><span class="ll-hic">${ICON_BELL}</span><div><b>Turn on reminders</b><br><span class="ll-sub">A heads-up ${getNotify().lead} min before each meal and workout.</span></div>
    <div class="ll-nudge-act"><button class="btn sm" type="button" data-ll="push-on">Turn on</button><button class="ll-x" type="button" data-ll="dismiss-nudge" aria-label="Hide"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>`;
}

/* ---------- placement ---------- */
let top=null;
function ensureTop(){
  if(top&&document.body.contains(top))return top;
  const app=document.getElementById("app");if(!app)return null;
  top=document.createElement("div");top.id="ll-top";top.className="ll-top";
  app.parentNode.insertBefore(top,app);
  return top;
}
function paintToday(){
  const t=ensureTop();if(!t)return;
  const onToday=typeof S!=="undefined"&&S.tab==="today";
  let h="";
  if(onToday){
    if(!isStandalone()&&ls.get(K_DISMISS)!=="1")h=installCard("today");
    else if(isStandalone()&&pushSt==="off"&&ls.get(K_NUDGE)!=="1")h=nudgeCard();
  }
  if(t.dataset.h!==h){t.innerHTML=h;t.dataset.h=h;}
  t.hidden=!h;
}
function paintPlan(){
  if(typeof S==="undefined"||S.tab!=="plan")return;
  const col=document.querySelector("#app .plan-cols .col");if(!col)return;
  const want=[["notify",notifyCard()],["install",isStandalone()?"":installCard("plan")],["account",accountCard()]];
  want.forEach(([k,h])=>{
    let el=col.querySelector(`[data-ll-card="${k}"]`);
    if(!h){if(el)el.remove();return;}
    if(el&&el.dataset.h===h)return;
    const a=document.activeElement, focusKey=a&&el&&el.contains(a)?(a.getAttribute("data-ll-notify")||a.getAttribute("data-ll")):null;
    const tmp=document.createElement("div");tmp.innerHTML=h;const n=tmp.firstElementChild;n.dataset.h=h;
    if(el)el.replaceWith(n);else col.appendChild(n);
    if(focusKey){const f=n.querySelector(`[data-ll-notify="${focusKey}"],[data-ll="${focusKey}"]`);f&&f.focus({preventScroll:true});}
  });
  // keep order: notify, install, account
  ["notify","install","account"].forEach(k=>{const el=col.querySelector(`[data-ll-card="${k}"]`);if(el)col.appendChild(el);});
}
function paint(){try{paintToday();paintPlan();}catch(e){console.error(e);}}
LL.paint=paint;

/* ---------- events ---------- */
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-ll]");if(!b)return;
  switch(b.dataset.ll){
    case"push-on":return enablePush();
    case"push-off":return disablePush(false);
    case"test":return sendTest(b);
    case"install":if(installEvt){installEvt.prompt();installEvt.userChoice.finally(()=>{installEvt=null;paint();});}return;
    case"dismiss-install":ls.set(K_DISMISS,"1");return paint();
    case"dismiss-nudge":ls.set(K_NUDGE,"1");return paint();
    case"signout":return onSignOut(b);
  }
});
document.addEventListener("change",e=>{
  const t=e.target, k=t&&t.getAttribute&&t.getAttribute("data-ll-notify");if(!k)return;
  if(k==="lead")setNotify({lead:+t.value});else setNotify({[k]:!!t.checked});
  paint();
});
async function onSignOut(btn){
  btn.disabled=true;btn.textContent="Signing out…";
  try{
    if(typeof pending!=="undefined"&&pending.size){
      if(typeof flushAll==="function")flushAll();
      const t0=Date.now();while(pending.size&&Date.now()-t0<4000)await sleep(200);
      if(pending.size&&!confirm("Some changes haven't synced yet and will be lost on this device. Sign out anyway?")){btn.disabled=false;btn.textContent="Sign out";return;}
    }
  }catch(e){}
  await LL.signOut();
}

/* ---------- start (called by auth.js once app.js has run) ---------- */
LL.afterApp=function(){
  if(typeof AFTER_RENDER!=="undefined")AFTER_RENDER.push(()=>paint());
  paint();
  syncPushOnBoot();
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refreshPush();});
};
})();
