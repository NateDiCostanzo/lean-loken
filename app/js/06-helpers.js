/* =========================================================
   HELPERS
   ========================================================= */
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fnum=(v,d=1)=>v==null||isNaN(v)?"—":(+v).toFixed(d);
const colorFor=p=>p==null?"var(--sunken)":p>=85?"var(--good)":p>=60?"var(--warn)":"var(--bad)";
const CHECK='<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ICON={l:'<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',r:'<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',cal:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>'};
let toastT;
function toast(msg,undo){document.querySelectorAll(".toast").forEach(t=>t.remove());clearTimeout(toastT);
  const el=document.createElement("div");el.className="toast";el.setAttribute("role","status");
  const sp=document.createElement("span");sp.textContent=msg;el.appendChild(sp);
  if(undo){const b=document.createElement("button");b.textContent="Undo";b.onclick=()=>{undo();el.remove();};el.appendChild(b);}
  document.body.appendChild(el);toastT=setTimeout(()=>el.remove(),undo?6000:2800);}
function weekKeys(k){const m=mondayOf(k);return Array.from({length:7},(_,i)=>addDays(m,i));}

/* ---------- extension hooks: each module registers its own handlers ----------
   ACTIONS[name](el,event)  — click on [data-act=name] not handled by main
   ON_INPUT / ON_CHANGE      — arrays of fn(target,event); return true to stop    */
const ACTIONS={}, ON_INPUT=[], ON_CHANGE=[], AFTER_RENDER=[];
