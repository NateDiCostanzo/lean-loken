/* Lean Loken service worker: offline app shell, push display, notification deep links.
   pwa/build.py fills in the build version and the shell file list. All URLs resolve against the
   registration scope, so the app works from a GitHub Pages subpath. */
const VERSION="f689beba22";
const SHELL=["./", "index.html", "app.js?v=f689beba22", "config.js?v=f689beba22", "claude-shim.js?v=f689beba22", "pwa.js?v=f689beba22", "auth.js?v=f689beba22", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/badge-96.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];
const CDN=["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"];
const CACHE="ll-shell-"+VERSION, RUNTIME="ll-runtime";
const scoped=p=>new URL(p,self.registration.scope).href;

self.addEventListener("install",e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    await c.addAll(SHELL.map(p=>new Request(scoped(p),{cache:"reload"})));
    // the supabase library is cross-origin: cache it when we can, but never fail the install over it
    await Promise.all(CDN.map(async u=>{try{const r=await fetch(u,{mode:"cors",cache:"reload"});if(r.ok)await c.put(u,r);}catch(err){}}));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith("ll-shell-")&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

const INDEX=()=>scoped("./index.html");
function timeout(ms){return new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),ms));}

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  // navigations: network first (fresh deploys), cached shell when offline or slow
  if(req.mode==="navigate"&&url.origin===self.location.origin){
    e.respondWith((async()=>{
      try{const r=await Promise.race([fetch(req),timeout(4000)]);if(r&&r.ok)return r;throw new Error("bad response");}
      catch(err){const c=await caches.open(CACHE);return (await c.match(INDEX()))||(await c.match(scoped("./")))||Response.error();}
    })());
    return;
  }
  // app shell + supabase library: cache first
  if(url.origin===self.location.origin||CDN.includes(req.url)){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      const hit=await c.match(req);if(hit)return hit;
      const r=await fetch(req);
      if(r.ok&&CDN.includes(req.url))c.put(req,r.clone());
      return r;
    })());
    return;
  }
  // Google Fonts: stale-while-revalidate
  if(url.hostname==="fonts.googleapis.com"||url.hostname==="fonts.gstatic.com"){
    e.respondWith((async()=>{
      const c=await caches.open(RUNTIME);
      const hit=await c.match(req);
      const net=fetch(req).then(r=>{if(r.ok||r.type==="opaque")c.put(req,r.clone());return r;}).catch(()=>null);
      if(hit){e.waitUntil(net);return hit;}
      return (await net)||Response.error();
    })());
  }
  // everything else (Supabase API, realtime) goes straight to the network
});

/* ---------- push ---------- */
self.addEventListener("push",e=>{
  let d={};
  try{d=e.data?e.data.json():{};}catch(err){d={body:e.data?e.data.text():""};}
  const title=d.title||"Lean Loken";
  const opts={
    body:d.body||"",
    tag:d.tag||undefined,
    renotify:!!d.tag,
    icon:scoped("icons/icon-192.png"),
    badge:scoped("icons/badge-96.png"),
    data:{url:d.url||(d.data&&d.data.url)||"/#today"},
    timestamp:d.ts||Date.now()
  };
  // iOS revokes push for a subscription that receives a push without showing a notification
  e.waitUntil(self.registration.showNotification(title,opts));
});

/* "/#today" (root-relative, as the server sends it) resolves inside the scope,
   so a GitHub Pages subpath keeps working. */
function target(u){
  const s=String(u||"#today");
  if(/^https?:/i.test(s)){const x=new URL(s);if(x.origin===self.location.origin&&x.href.startsWith(self.registration.scope))return x.href;return scoped("./"+(x.hash||"#today"));}
  const m=s.match(/#.*$/);
  return scoped("./"+(m?m[0]:"#today"));
}
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  const url=target(e.notification.data&&e.notification.data.url);
  e.waitUntil((async()=>{
    const all=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    const c=all.find(w=>w.url.startsWith(self.registration.scope));
    if(c){
      c.postMessage({type:"nav",url});
      try{return await c.focus();}catch(err){}
    }
    return self.clients.openWindow(url);
  })());
});
