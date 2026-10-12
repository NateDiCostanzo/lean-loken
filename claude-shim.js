/* =========================================================
   window.claude shim over supabase-js (PWA build only)
   ---------------------------------------------------------
   The app talks to storage only through claude.use("db"|"user"|
   "downloads"|"sample"). This file provides those capabilities on top
   of Supabase so app/js stays unchanged.

   db: the viewer's own subtree data/users/<uid>/… maps to the table
       public.docs(user_id uuid, id text, data jsonb, updated_at timestamptz,
       primary key(user_id,id)). The row id is the path below
       data/users/<uid>/ ("settings", "d-2026-10-13", or "a/b/c" for
       subcollections). Paths outside the viewer's own subtree read as
       non-existent and reject writes with invalid_argument (there is no
       shared store in the standalone app).
   Delivery: one select of the user's rows, then Realtime postgres_changes
       (filter user_id=eq.<uid>), a 30 s poll while visible, and a refresh on
       visibilitychange / online. Snapshots follow db.d.ts: frozen, the same
       object for an unchanged doc, docChanges() against the listener's
       previous delivery, metadata {fromCache:false,hasPendingWrites:false}.
       Own writes are delivered after the server confirms them (no
       optimistic snapshot: the app's own cache already shows the edit).
   ========================================================= */
(function(){
"use strict";
const CFG=window.LL_CONFIG||{};
const LL=window.LL=window.LL||{};
const AUTH_KEY="leanloken.auth";
const isPlaceholder=v=>!v||/^(SUPABASE_URL|SUPABASE_ANON_KEY)$/.test(v)||/YOUR[-_]/i.test(v);
LL.cfg=CFG;
LL.configured=!isPlaceholder(CFG.SUPABASE_URL)&&!isPlaceholder(CFG.SUPABASE_ANON_KEY);
LL.AUTH_KEY=AUTH_KEY;

/* ---------- client ---------- */
LL.client=null;
try{
  if(LL.configured&&window.supabase&&typeof supabase.createClient==="function")
    LL.client=supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:AUTH_KEY,flowType:"implicit"},
      realtime:{params:{eventsPerSecond:5}}
    });
}catch(e){console.error("supabase init failed",e);LL.client=null;}

/* The stored session, read straight from storage (used when offline and the
   access token can't be refreshed yet: the app still boots on its local cache). */
LL.storedUser=function(){
  try{const o=JSON.parse(localStorage.getItem(AUTH_KEY)||"null");const s=o&&(o.currentSession||o);
    const u=s&&s.user;return u&&typeof u.id==="string"?{id:u.id,email:u.email||null}:null;}catch(e){return null;}
};

/* ---------- auth gate ----------
   auth.js calls LL.setUser(user|null) once the session state is known.
   claude.use() waits for that; db/user resolve null while signed out. */
let gateResolve;LL.user=null;
LL.authGate=new Promise(r=>gateResolve=r);
LL.setUser=function(u){LL.user=u?{id:u.id,email:u.email||null}:null;gateResolve(LL.user);};

/* ---------- helpers ---------- */
const SEG=/^[A-Za-z0-9_\-.~:@+]+$/;
function parsePath(path,kind){
  if(typeof path!=="string")throw new TypeError(`${kind} path must be a string`);
  const segs=path.split("/");
  if(segs.length>16)throw new TypeError(`path has ${segs.length} segments (max 16)`);
  if(new TextEncoder().encode(path).length>1000)throw new TypeError("path is over 1000 bytes");
  segs.forEach(s=>{
    if(!s)throw new TypeError("path has an empty segment");
    if(s==="."||s==="..")throw new TypeError(`segment "${s}" is not allowed`);
    if(!SEG.test(s))throw new TypeError(`segment "${s}" has characters outside letters, digits and _ - . ~ : @ +`);
    if(new TextEncoder().encode(s).length>200)throw new TypeError("a segment is over 200 bytes");
  });
  const even=segs.length%2===0;
  if(kind==="document"&&!even)throw new TypeError(`a document path needs an even number of segments; "${path}" has ${segs.length}`);
  if(kind==="collection"&&even)throw new TypeError(`a collection path needs an odd number of segments; "${path}" has ${segs.length}`);
  return segs;
}
/* path → row id relative to data/users/<uid>/, or null when outside the viewer's subtree */
function relId(segs){
  const u=LL.user;
  if(!u||segs.length<3||segs[0]!=="data"||segs[1]!=="users"||segs[2]!==u.id)return null;
  return segs.slice(3).join("/");
}
const err=(code,message)=>({code,message:message||code});
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
function deepFreeze(o){if(o&&typeof o==="object"&&!Object.isFrozen(o)){Object.freeze(o);Object.keys(o).forEach(k=>deepFreeze(o[k]));}return o;}
function depth(v,d){if(d>32)return d;if(v&&typeof v==="object"){let m=d;for(const k in v){m=Math.max(m,depth(v[k],d+1));if(m>32)break;}return m;}return d;}
function checkBody(b){
  if(!b||typeof b!=="object"||Array.isArray(b)||(Object.getPrototypeOf(b)!==Object.prototype&&Object.getPrototypeOf(b)!==null))
    return err("invalid_argument","document body must be a plain JSON object");
  let s;try{s=JSON.stringify(b);}catch(e){return err("invalid_argument","document body is not JSON-serializable");}
  if(new TextEncoder().encode(s).length>256*1024)return err("invalid_argument","document is over 256 KiB");
  if(depth(b,0)>32)return err("invalid_argument","document is over 32 levels deep");
  return null;
}
/* postgrest {error,status} → DbError */
function mapErr(res){
  const st=res&&res.status, e=res&&res.error||{};
  if(!st||st>=500||st===401||st===408||/fetch|network|abort|timeout/i.test(e.message||""))return err("unavailable",e.message||"network error");
  if(st===429)return err("resource_exhausted",e.message);
  if(st===413)return err("invalid_argument",e.message);
  if(st===403||e.code==="42501")return err("invalid_argument",e.message||"not allowed");
  if(st>=400)return err("invalid_argument",e.message);
  return err("unavailable",e.message);
}
const TIMEOUT=15000;
function withTimeout(builder){
  if(typeof AbortController==="function"&&builder&&typeof builder.abortSignal==="function"){
    const ac=new AbortController();const t=setTimeout(()=>ac.abort(),TIMEOUT);
    return Promise.resolve(builder.abortSignal(ac.signal)).finally(()=>clearTimeout(t));
  }
  return Promise.resolve(builder);
}

/* ---------- the per-user row store ---------- */
const rows=new Map();                 // id -> {data(json string), updated_at}
const snaps=new Map();                // id -> {json, snap}
const META=Object.freeze({fromCache:false,hasPendingWrites:false});
const listeners=new Set();
let loaded=false, loading=null, seq=0, touched=new Map(), channel=null, pollT=null, backoff=0;

function docSnap(id){
  const r=rows.get(id), lastSeg=id.split("/").pop();
  if(!r)return Object.freeze({id:lastSeg,exists:false,data:()=>undefined,metadata:META});
  const c=snaps.get(id);
  if(c&&c.json===r.data)return c.snap;
  const body=deepFreeze(JSON.parse(r.data));
  const snap=Object.freeze({id:lastSeg,exists:true,data:()=>body,metadata:META});
  snaps.set(id,{json:r.data,snap});
  return snap;
}
function applyRow(id,data,updated_at){
  const json=JSON.stringify(data==null?{}:data);
  const cur=rows.get(id);
  if(cur&&cur.data===json)return false;
  rows.set(id,{data:json,updated_at:updated_at||null});return true;
}
function removeRow(id){if(!rows.has(id))return false;rows.delete(id);snaps.delete(id);return true;}
function touch(id){touched.set(id,++seq);}

async function fetchAll(){
  const c=LL.client,u=LL.user;
  if(!c||!u)throw err("unavailable","not signed in");
  const startSeq=seq, out=[];
  for(let from=0;;from+=1000){
    const res=await withTimeout(c.from("docs").select("id,data,updated_at").eq("user_id",u.id).order("id",{ascending:true}).range(from,from+999));
    if(res.error)throw mapErr(res);
    const d=res.data||[];out.push(...d);if(d.length<1000)break;
  }
  let changed=false;const seen=new Set();
  out.forEach(r=>{seen.add(r.id);
    if((touched.get(r.id)||0)>startSeq)return;          // a newer realtime event / own write already applied
    if(applyRow(r.id,r.data,r.updated_at))changed=true;});
  [...rows.keys()].forEach(id=>{if(!seen.has(id)&&(touched.get(id)||0)<=startSeq&&removeRow(id))changed=true;});
  const first=!loaded;loaded=true;backoff=0;
  if(changed||first)deliverAll();
}
function refresh(){
  if(!LL.user||!LL.client)return Promise.resolve();
  if(loading)return loading;
  loading=fetchAll().catch(e=>{
    // subscriptions handle "unavailable" internally: retry sooner while nothing has loaded yet
    if(!loaded){backoff=Math.min((backoff||2500)*2,30000);clearTimeout(retryT);retryT=setTimeout(refresh,backoff);}
  }).finally(()=>{loading=null;});
  return loading;
}
let retryT=null;
function startSync(){
  if(channel||!LL.client||!LL.user)return;
  const uid=LL.user.id;
  try{
    channel=LL.client.channel("docs:"+uid)
      .on("postgres_changes",{event:"*",schema:"public",table:"docs",filter:"user_id=eq."+uid},onChange)
      .subscribe(status=>{if(status==="SUBSCRIBED")refresh();});   // catch up on anything missed while (re)joining
  }catch(e){channel=null;}
  pollT=setInterval(()=>{if(document.visibilityState!=="hidden")refresh();},30000);
  document.addEventListener("visibilitychange",onVis);
  addEventListener("online",refresh);
  refresh();
}
function onVis(){if(document.visibilityState==="visible")refresh();}
function stopSync(){
  if(listeners.size)return;
  clearInterval(pollT);pollT=null;clearTimeout(retryT);
  document.removeEventListener("visibilitychange",onVis);removeEventListener("online",refresh);
  if(channel){try{LL.client.removeChannel(channel);}catch(e){}channel=null;}
}
function onChange(p){
  const u=LL.user;if(!u||!p)return;
  const ev=p.eventType||p.type, n=p.new||{}, o=p.old||{};
  if(ev==="DELETE"){const id=o.id;if(id==null)return refresh();touch(id);if(removeRow(id))deliverAll();return;}
  if(n.user_id&&n.user_id!==u.id)return;
  if(n.id==null)return;
  touch(n.id);
  if(applyRow(n.id,n.data,n.updated_at))deliverAll();
}

/* ---------- queries ---------- */
function getField(obj,f){return obj&&Object.prototype.hasOwnProperty.call(obj,f)?obj[f]:undefined;}
function cmp(a,b){
  if(a===b)return 0;
  const ta=typeof a,tb=typeof b;
  if(ta!==tb){const order=["undefined","boolean","number","string","object"];return order.indexOf(ta)-order.indexOf(tb);}
  if(ta==="object")return JSON.stringify(a)<JSON.stringify(b)?-1:1;
  return a<b?-1:1;
}
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function test(v,op,x){
  switch(op){
    case"==":return eq(v,x);
    case"!=":return v!==undefined&&!eq(v,x);
    case"<":return v!==undefined&&typeof v===typeof x&&cmp(v,x)<0;
    case"<=":return v!==undefined&&typeof v===typeof x&&cmp(v,x)<=0;
    case">":return v!==undefined&&typeof v===typeof x&&cmp(v,x)>0;
    case">=":return v!==undefined&&typeof v===typeof x&&cmp(v,x)>=0;
    case"in":return x.some(y=>eq(v,y));
    case"not-in":return v!==undefined&&!x.some(y=>eq(v,y));
    case"array-contains":return Array.isArray(v)&&v.some(y=>eq(y,x));
  }
  return false;
}
const OPS=["==","!=","<","<=",">",">=","in","not-in","array-contains"];
/* the docs of collection `prefix` ("" = data/users/<uid>) matching q, in query order */
function runQuery(prefix,q){
  const pre=prefix?prefix+"/":"";
  let ids=[...rows.keys()].filter(id=>id.startsWith(pre)&&!id.slice(pre.length).includes("/")).sort();
  let docs=ids.map(docSnap);
  q.where.forEach(([f,op,x])=>{docs=docs.filter(d=>test(getField(d.data(),f),op,x));});
  if(q.order){const [f,dir]=q.order,s=dir==="desc"?-1:1;
    docs=docs.map((d,i)=>[d,i]).sort((A,B)=>{const a=getField(A[0].data(),f),b=getField(B[0].data(),f);
      if(a===undefined&&b!==undefined)return 1;if(b===undefined&&a!==undefined)return -1;
      return (cmp(a,b)*s)||(A[1]-B[1]);}).map(x=>x[0]);}
  if(q.limit)docs=docs.slice(0,q.limit);
  return docs;
}
function querySnap(docs,prev){
  const changes=[];
  const prevIdx=new Map((prev||[]).map((d,i)=>[d.id,i])), nowIdx=new Map(docs.map((d,i)=>[d.id,i]));
  (prev||[]).forEach((d,i)=>{if(!nowIdx.has(d.id))changes.push(Object.freeze({type:"removed",doc:d,oldIndex:i,newIndex:-1}));});
  docs.forEach((d,i)=>{
    if(!prevIdx.has(d.id))changes.push(Object.freeze({type:"added",doc:d,oldIndex:-1,newIndex:i}));
    else{const j=prevIdx.get(d.id);if(prev[j]!==d||j!==i)changes.push(Object.freeze({type:"modified",doc:d,oldIndex:j,newIndex:i}));}
  });
  const frozen=Object.freeze(docs.slice()), ch=Object.freeze(changes);
  return Object.freeze({docs:frozen,size:docs.length,empty:!docs.length,docChanges:()=>ch,metadata:META});
}
function deliver(l){
  if(l.dead||(!loaded&&!l.foreign))return;
  if(l.kind==="doc"){
    const s=l.foreign?Object.freeze({id:l.lastSeg,exists:false,data:()=>undefined,metadata:META}):docSnap(l.id);
    if(l.last!==undefined&&l.last===s)return;
    if(l.last&&!l.last.exists&&!s.exists)return;
    l.last=s;try{l.next(s);}catch(e){reportError(e);}
    return;
  }
  const docs=l.foreign?[]:runQuery(l.prefix,l.q);
  if(l.last&&l.last.length===docs.length&&l.last.every((d,i)=>d===docs[i]))return;
  const snap=querySnap(docs,l.last);l.last=docs;
  try{l.next(snap);}catch(e){reportError(e);}
}
function deliverAll(){listeners.forEach(deliver);}
function listen(l){
  listeners.add(l);
  if(LL.client&&LL.user)startSync();
  if(loaded||l.foreign)setTimeout(()=>deliver(l),0);
  return ()=>{if(l.dead)return;l.dead=true;listeners.delete(l);stopSync();};
}

/* ---------- refs ---------- */
function makeQuery(path,prefix,foreign,q){
  const self={
    where(f,op,v){
      if(typeof f!=="string"||!f)throw new TypeError("where() needs a field name");
      if(!OPS.includes(op))throw new TypeError(`unsupported operator "${op}"`);
      if((op==="in"||op==="not-in")&&(!Array.isArray(v)||v.length>30))throw new TypeError(`"${op}" needs an array of at most 30 values`);
      if(q.where.length>=10)throw new TypeError("at most 10 filters");
      return makeQuery(path,prefix,foreign,{...q,where:[...q.where,[f,op,v]]});
    },
    orderBy(f,dir){if(q.order)throw new TypeError("at most one orderBy");if(dir&&dir!=="asc"&&dir!=="desc")throw new TypeError("dir is asc or desc");return makeQuery(path,prefix,foreign,{...q,order:[f,dir||"asc"]});},
    limit(n){if(!(Number.isInteger(n)&&n>=1&&n<=1000))throw new TypeError("limit is 1-1000");return makeQuery(path,prefix,foreign,{...q,limit:n});},
    async get(){
      if(foreign)return querySnap([],null);
      if(!loaded)await refresh();
      if(!loaded)throw err("unavailable","could not reach the server");
      return querySnap(runQuery(prefix,q),null);
    },
    onSnapshot(next,error){
      if(typeof next!=="function")throw new TypeError("onSnapshot needs a callback");
      return listen({kind:"query",prefix,q,foreign,next,error,last:null});
    }
  };
  return self;
}
function collectionRef(path){
  const segs=parsePath(path,"collection");
  const rel=relId(segs);                   // "" for data/users/<uid>, "x/y" deeper, null outside
  const foreign=rel===null;
  const q=makeQuery(path,rel||"",foreign,{where:[],order:null,limit:0});
  return Object.assign(q,{
    path,
    doc(id){
      if(id===undefined)id=newId();
      return docRef(path+"/"+id);
    },
    async add(data){const r=this.doc();await r.set(data);return r;}
  });
}
function newId(){
  const a="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";let s="";
  const b=new Uint8Array(20);(crypto.getRandomValues?crypto.getRandomValues(b):b.forEach((_,i)=>b[i]=Math.random()*256|0));
  b.forEach(x=>s+=a[x%62]);return s;
}
const writeChains=new Map(), leases=new Map();
function docRef(path){
  const segs=parsePath(path,"document");
  const rel=relId(segs), id=rel===null||rel===""?null:rel, lastSeg=segs[segs.length-1];
  const chain=fn=>{const k=id||path;const p=(writeChains.get(k)||Promise.resolve()).catch(()=>{}).then(fn);writeChains.set(k,p);return p;};
  async function upsert(body){
    const c=LL.client,u=LL.user;
    if(!c||!u)throw err("unavailable","not signed in");
    const res=await withTimeout(c.from("docs").upsert({user_id:u.id,id,data:body,updated_at:new Date().toISOString()},{onConflict:"user_id,id"}).select("id,data,updated_at"));
    if(res.error)throw mapErr(res);
    const r=Array.isArray(res.data)?res.data[0]:res.data;
    touch(id);
    const changed=applyRow(id,r&&r.data!==undefined?r.data:body,r&&r.updated_at);
    if(changed)setTimeout(deliverAll,0);
  }
  async function readOne(){
    const c=LL.client,u=LL.user;
    if(!c||!u)throw err("unavailable","not signed in");
    const res=await withTimeout(c.from("docs").select("id,data,updated_at").eq("user_id",u.id).eq("id",id));
    if(res.error)throw mapErr(res);
    const r=(res.data||[])[0];
    touch(id);
    const changed=r?applyRow(id,r.data,r.updated_at):removeRow(id);
    if(changed&&loaded)setTimeout(deliverAll,0);
    return docSnap(id);
  }
  const ref={
    id:lastSeg,path,
    async get(){if(id===null)return Object.freeze({id:lastSeg,exists:false,data:()=>undefined,metadata:META});return readOne();},
    set(data){
      if(id===null)return Promise.reject(err("invalid_argument","writes are only allowed under data/users/<your id>/"));
      const bad=checkBody(data);if(bad)return Promise.reject(bad);
      const body=clone(data);
      return chain(()=>upsert(body));
    },
    update(data){
      if(id===null)return Promise.reject(err("invalid_argument","writes are only allowed under data/users/<your id>/"));
      const bad=checkBody(data);if(bad)return Promise.reject(bad);
      const patch=clone(data);
      return chain(async()=>{
        const cur=await readOne();
        if(!cur.exists)throw err("invalid_argument","update() needs an existing document");
        const merge=(a,b)=>{const o=clone(a)||{};Object.keys(b).forEach(k=>{const v=b[k];o[k]=v&&typeof v==="object"&&!Array.isArray(v)&&o[k]&&typeof o[k]==="object"&&!Array.isArray(o[k])?merge(o[k],v):v;});return o;};
        const next=merge(cur.data(),patch);const bad2=checkBody(next);if(bad2)throw bad2;
        await upsert(next);
      });
    },
    delete(){
      if(id===null)return Promise.reject(err("invalid_argument","writes are only allowed under data/users/<your id>/"));
      return chain(async()=>{
        const c=LL.client,u=LL.user;if(!c||!u)throw err("unavailable","not signed in");
        const res=await withTimeout(c.from("docs").delete().eq("user_id",u.id).eq("id",id));
        if(res.error)throw mapErr(res);
        touch(id);if(removeRow(id))setTimeout(deliverAll,0);
      });
    },
    /* Leases coordinate within this page only (the standalone app has one writer per device). */
    async acquire(opt){
      if(!opt||typeof opt.holder!=="string")throw err("invalid_argument","acquire() needs a holder");
      const ttl=Math.min(600000,Math.max(1000,+opt.ttlMs||30000)), now=Date.now(), k=id||path, l=leases.get(k);
      if(l&&l.exp>now&&l.holder!==opt.holder)return {acquired:false,expiresAt:new Date(l.exp).toISOString()};
      const exp=now+ttl;leases.set(k,{holder:opt.holder,exp});
      if(opt.data&&id!==null){const cur=await ref.get();await (cur.exists?ref.update(opt.data):ref.set(opt.data));}
      return {acquired:true,version:Date.now(),expiresAt:new Date(exp).toISOString(),holder:opt.holder};
    },
    onSnapshot(next,error){
      if(typeof next!=="function")throw new TypeError("onSnapshot needs a callback");
      return listen({kind:"doc",id,lastSeg,foreign:id===null,next,error,last:undefined});
    },
    collection(sub){parsePath(sub,"collection");return collectionRef(path+"/"+sub);}
  };
  return ref;
}
const db={doc:p=>docRef(p),collection:p=>collectionRef(p)};

/* ---------- user ---------- */
const user={
  id:async()=>LL.user?LL.user.id:null,
  isOwner:async()=>!!LL.user,
  canEdit:async()=>!!LL.user,
  can:async()=>!!LL.user,
  me:async()=>({id:LL.user?LL.user.id:null,name:"",avatarUrl:"",color:"",email:LL.user?LL.user.email:null,isOwner:!!LL.user,canEdit:!!LL.user}),
  name:async()=>"",
  avatarUrl:async()=>null,
  email:async()=>LL.user?LL.user.email:null,
  profiles:async ids=>{const o={};[].concat(ids).forEach(i=>{if(LL.user&&i===LL.user.id)o[i]={id:i,name:"",avatarUrl:"",color:"",email:LL.user.email,isMe:true,guest:false};});return o;},
  search:async()=>[]
};

/* ---------- downloads ---------- */
const downloads={
  async save(req){
    if(!req||typeof req.filename!=="string"||!req.filename.trim())throw err("bad_request","filename is required");
    let d=req.data;
    if(d==null||(typeof d==="string"&&!d.length))throw err("bad_request","data is empty");
    const name=Array.from(req.filename).filter(ch=>{const c=ch.codePointAt(0);return !(c<32||(c>=0x200b&&c<=0x200f)||(c>=0x2028&&c<=0x202e)||(c>=0x2060&&c<=0x206f)||c===0xfeff);}).join("").replace(/\s+/g," ").trim().slice(0,240)||"download";
    const ext=(name.split(".").pop()||"").toLowerCase();
    const type={csv:"text/csv",json:"application/json",txt:"text/plain",md:"text/markdown",html:"text/html",pdf:"application/pdf",png:"image/png"}[ext]||"application/octet-stream";
    const blob=d instanceof Blob?new Blob([d],{type}):new Blob([d],{type});
    // iOS home-screen apps ignore <a download>: hand the file to the share sheet instead
    const standalone=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
    if(standalone&&navigator.canShare&&typeof File==="function"){
      const f=new File([blob],name,{type});
      if(navigator.canShare({files:[f]})){
        try{await navigator.share({files:[f]});return {status:"saved"};}
        catch(e){if(e&&e.name==="AbortError")throw err("declined","cancelled");}
      }
    }
    const url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url;a.download=name;a.rel="noopener";a.style.display="none";
    document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},4000);
    return {status:"saved"};
  }
};

/* ---------- claude.use ---------- */
window.claude={
  async use(name){
    if(name==="downloads")return downloads;
    if(name==="db"||name==="user"){
      await LL.authGate;
      if(!LL.user)return null;           // the latest auth state, not the first one
      if(name==="user")return user;
      return LL.client?db:null;          // no client (config/library missing): the app runs on its local cache
    }
    return null;                          // sample (AI) and everything else: off in the standalone app
  }
};
/* for sign-out / tests */
LL.shim={rows,listeners,refresh,reset(){stopSync();listeners.clear();rows.clear();snaps.clear();loaded=false;}};
})();
