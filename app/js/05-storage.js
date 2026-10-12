/* =========================================================
   STORAGE — db (synced, private per user) with local cache
   ---------------------------------------------------------
   Every edit is written to localStorage at once and its doc id is
   added to a persisted "pending" set. A doc leaves the pending set only
   when the server confirms the newest version of it. Pending docs are
   never overwritten by snapshots, survive reloads, and are pushed after
   the first server-definitive snapshot. Failed writes retry with
   backoff (5 s, 15 s, 60 s) and right away once any write succeeds.
   Each doc keeps a base: its last synced or loaded state. When the server
   copy of a pending doc changes (another device), the two are merged
   field by field: fields this device changed since the base win, the rest
   take the server value; checks, lifts and mealsAlt merge per key.
   ========================================================= */
const store={coll:null,uid:null,ready:false,reconciled:false};
const LS="leanloken.v2", LS_OLD="leanout12.v1", LS_PEND="leanloken.pending", LS_BASE="leanloken.base";
const RETRY=[5000,15000,60000], DEBOUNCE=500;
const rev={}, synced={}, timers={}, chains={}, tries={}, errs={}, baseGen={};
let bases={};                      // doc id -> last synced/loaded state (what this device diffs against)
let cacheUid=null;                 // uid recorded in the local cache (null = legacy / unknown)
let pending=new Set();             // doc ids with local changes the server hasn't confirmed

function lsLoad(){
  try{
    const r=localStorage.getItem(LS)||localStorage.getItem(LS_OLD);
    if(r){const o=JSON.parse(r)||{};
      cacheUid=typeof o.uid==="string"?o.uid:null;
      if(o.set){S.set=normSet(o.set);bases.settings=clone(S.set);}
      if(o.days&&typeof o.days==="object")Object.keys(o.days).forEach(k=>{if(validKey(k)){S.days[k]=normDay(o.days[k]);bases["d-"+k]=clone(S.days[k]);}});}
  }catch(e){}
  try{const p=JSON.parse(localStorage.getItem(LS_PEND)||"[]");pending=new Set(Array.isArray(p)?p.filter(isDocId):[]);}catch(e){pending=new Set();}
  // a pending doc's cached copy holds the unsynced edit, so its base comes from the saved bases;
  // with none saved, it diffs against a blank doc (every filled field counts as this device's)
  let saved={};try{saved=JSON.parse(localStorage.getItem(LS_BASE)||"{}")||{};}catch(e){}
  pending.forEach(id=>{const b=saved[id];bases[id]=b&&typeof b==="object"?normDoc(id,b):blankDoc(id);});
}
const normDoc=(id,v)=>id==="settings"?normSet(v):normDay(v);
const blankDoc=id=>id==="settings"?normSet(clone(DEFAULTS)):normDay({});
function baseSave(){try{const o={};pending.forEach(id=>{if(bases[id])o[id]=bases[id];});localStorage.setItem(LS_BASE,JSON.stringify(o));}catch(e){}}
function setBase(id,v){bases[id]=clone(v);baseGen[id]=(baseGen[id]||0)+1;}
function lsSave(){try{localStorage.setItem(LS,JSON.stringify({uid:store.uid||cacheUid,set:S.set,days:S.days}));}catch(e){}}
function pendSave(){try{localStorage.setItem(LS_PEND,JSON.stringify([...pending]));}catch(e){}baseSave();}
const isDocId=id=>typeof id==="string"&&(id==="settings"||(id.startsWith("d-")&&validKey(id.slice(2))));
const docBody=id=>id==="settings"?S.set:S.days[id.slice(2)];

function setSync(m,txt){document.querySelectorAll("[data-sync]").forEach(el=>{el.className="sync "+m;const t=txt||({ok:"All changes synced",local:"Saved on this device",err:"Not synced, saved on device",saving:"Saving…"}[m]||"Connecting…");el.querySelector("span").textContent=t;el.title=m==="err"?t+". Retrying automatically.":t;});}
const dirty=id=>pending.has(id)||(rev[id]||0)>(synced[id]||0);
function refreshSync(){
  if(!store.coll)return setSync("local");
  const e=Object.keys(errs);
  if(e.length)return setSync("err",errs[e[0]]);
  if(!store.reconciled)return setSync("saving","Connecting…");
  setSync(pending.size||Object.keys(rev).some(dirty)?"saving":"ok");
}

function schedule(id,ms){clearTimeout(timers[id]);timers[id]=setTimeout(()=>flush(id),ms);}
function flush(id){
  clearTimeout(timers[id]);delete timers[id];
  if(!store.coll||!pending.has(id))return;
  const b=docBody(id);if(!b){pending.delete(id);pendSave();return refreshSync();}
  const r=rev[id]=rev[id]||1, body=clone(b), coll=store.coll, g=baseGen[id]||0;
  chains[id]=(chains[id]||Promise.resolve()).then(()=>coll.doc(id).set(body)).then(()=>{
    synced[id]=Math.max(synced[id]||0,r); delete tries[id]; delete errs[id];
    if((baseGen[id]||0)===g)setBase(id,body);   // the server now holds what we wrote (unless a newer snapshot already said otherwise)
    if(rev[id]===r){pending.delete(id);pendSave();}
    // the connection works again: retry everything that failed, now
    Object.keys(errs).forEach(x=>schedule(x,0));
    refreshSync();
  },e=>{
    const code=e&&e.code;
    errs[id]=code==="quota_exceeded"?"Storage full, not synced":"Not synced, saved on device";
    if(rev[id]===r){const n=tries[id]=(tries[id]||0)+1;schedule(id,RETRY[Math.min(n,RETRY.length)-1]);}
    refreshSync();
  });
}
function flushAll(){lsSave();pendSave();if(store.coll&&store.reconciled)pending.forEach(id=>{if(timers[id]||!tries[id])flush(id);});}

function queue(id,getter){
  rev[id]=(rev[id]||0)+1;
  pending.add(id); lsSave(); pendSave();
  if(!store.coll||!store.reconciled){refreshSync();return;}   // pushed once the server view is definitive
  setSync("saving");
  schedule(id,DEBOUNCE);
}
const saveDay=k=>queue("d-"+k,()=>S.days[k]);
const saveSet=()=>queue("settings",()=>S.set);

function adoptUid(uid){
  store.uid=uid;
  if(cacheUid&&cacheUid!==uid){       // cache belongs to another account: never show or upload it
    S.set=normSet(clone(DEFAULTS)); S.days={};
    pending=new Set(); bases={}; Object.keys(rev).forEach(k=>{delete rev[k];delete synced[k];});
    pendSave(); render();
  }
  cacheUid=uid; lsSave();
}

/* Three-way merge of one doc: base = last synced state, local = this device, server = latest. */
const NESTED={day:["checks","lifts","mealsAlt"],settings:["reviews","setup"]};
/* adj (coach adjustments) merges as a set keyed by date+wk+delta+cal: entries either device
   added are kept, entries either device removed (e.g. Undo) stay removed; sorted by date. */
const adjKey=a=>[a&&a.date,a&&a.wk,a&&a.delta,a&&a.cal].join("|");
function mergeAdj(B,L,R){
  const arr=v=>Array.isArray(v)?v:[], bk=new Set(arr(B).map(adjKey)), lk=new Set(arr(L).map(adjKey));
  const out=[],seen=new Set(),add=a=>{const k=adjKey(a);if(!seen.has(k)){seen.add(k);out.push(clone(a));}};
  arr(R).forEach(a=>{const k=adjKey(a);if(!(bk.has(k)&&!lk.has(k)))add(a);});   // server, minus local removals
  arr(L).forEach(a=>{if(!bk.has(adjKey(a)))add(a);});                          // plus local additions
  return out.map((a,i)=>[a,i]).sort((x,y)=>String(x[0].date).localeCompare(String(y[0].date))||x[1]-y[1]).map(x=>x[0]);
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const isO=v=>v&&typeof v==="object"&&!Array.isArray(v);
function merge3(id,base,local,server){
  base=base||blankDoc(id);local=local||{};
  const out={}, keys=new Set([...Object.keys(base),...Object.keys(local),...Object.keys(server)]);
  keys.forEach(k=>{
    if(id==="settings"&&k==="adj"){out.adj=mergeAdj(base.adj,local.adj,server.adj);return;}
    if(NESTED[id==="settings"?"settings":"day"].includes(k)&&(isO(local[k])||isO(server[k])||isO(base[k]))){
      const B=isO(base[k])?base[k]:{},L=isO(local[k])?local[k]:{},R=isO(server[k])?server[k]:{},o={};
      new Set([...Object.keys(B),...Object.keys(L),...Object.keys(R)]).forEach(x=>{
        const v=same(L[x],B[x])?R[x]:L[x];if(v!==undefined)o[x]=clone(v);});
      out[k]=o;
    }else{const v=same(local[k],base[k])?server[k]:local[k];if(v!==undefined)out[k]=clone(v);}
  });
  return normDoc(id,out);
}

function onSnap(snap){
  let changed=false; const seen=new Set();
  snap.docs.forEach(doc=>{
    seen.add(doc.id);
    if(!isDocId(doc.id))return;
    const v=doc.data(); if(!v)return;
    const id=doc.id, sv=normDoc(id,v), put=x=>{if(id==="settings")S.set=x;else S.days[id.slice(2)]=x;};
    if(dirty(id)){
      // local edit pending: fold in what other devices changed, keep what this device changed
      if(same(sv,bases[id]))return;
      const loc=docBody(id), m=merge3(id,bases[id],loc,sv);
      setBase(id,sv); baseSave();
      if(!same(m,loc)){put(m);changed=true;}
      return;
    }
    setBase(id,sv);
    if(!same(sv,docBody(id))){put(sv);changed=true;}
  });
  if(!store.reconciled&&!(snap.metadata&&snap.metadata.fromCache)){
    store.reconciled=true;
    // push anything only this device has, plus every edit the server hasn't confirmed
    if(!seen.has("settings")&&JSON.stringify(S.set)!==JSON.stringify(normSet(DEFAULTS)))pending.add("settings");
    Object.keys(S.days).forEach(k=>{if(!seen.has("d-"+k))pending.add("d-"+k);});
    pendSave();
    pending.forEach(id=>flush(id));
  }
  if(changed)lsSave();
  refreshSync();
  if(changed){const a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))patch();else render();}
}
function subscribe(){
  store.coll.onSnapshot(onSnap,e=>{
    const c=e&&e.code;
    if(c==="unavailable"||c==="resource_exhausted"){setSync("err","Not synced, saved on device");setTimeout(()=>{if(store.coll)subscribe();},RETRY[1]);}
    else{store.coll=null;setSync("local");}
  });
}

async function initStore(){
  lsLoad(); render();
  addEventListener("pagehide",flushAll);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushAll();});
  try{
    if(!window.claude||typeof claude.use!=="function"){setSync("local");return;}
    const [db,user]=await Promise.all([claude.use("db"),claude.use("user")]);
    const uid=user?await user.id():null;
    if(!db||!uid){setSync("local");return;}
    adoptUid(uid);
    store.coll=db.collection("data/users/"+uid);store.ready=true;
    refreshSync();
    subscribe();
  }catch(e){store.coll=null;setSync("local");}
}
