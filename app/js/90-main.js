/* =========================================================
   RENDER + EVENTS
   ========================================================= */
function render(){
  const app=$("#app");
  /* keep keyboard focus on the equivalent control after a full re-render */
  const fa=document.activeElement, fsel=fa&&app.contains(fa)&&fa.dataset&&fa.dataset.act?`[data-act="${fa.dataset.act}"]`+(fa.dataset.v!=null?`[data-v="${CSS.escape(fa.dataset.v)}"]`:""):(fa&&fa.id&&app.contains(fa)?"#"+CSS.escape(fa.id):null);
  app.innerHTML= S.tab==="train"?renderTrain(): S.tab==="progress"?renderProgress(): S.tab==="plan"?renderPlan(): S.tab==="fuel"&&typeof renderFuel==="function"?renderFuel(): renderToday();
  document.querySelectorAll(".navbtn").forEach(b=>{const on=b.dataset.v===S.tab;b.classList.toggle("on",on);if(on)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");});
  if(S.tab==="today")patch();
  if(S.tab==="train")paintTimer();
  AFTER_RENDER.forEach(fn=>{try{fn(S.tab);}catch(err){console.error(err);}});
  if(fsel){const n=app.querySelector(fsel);if(n&&n.focus)n.focus({preventScroll:true});}
}
function rerenderKeepScroll(){const y=window.scrollY;render();window.scrollTo(0,y);}
function setTab(t,scroll){S.tab=t;render();
  if(scroll){const el=document.getElementById(scroll);if(el)el.scrollIntoView({behavior:"smooth",block:"start"});}else window.scrollTo(0,0);
  try{history.replaceState(null,"","#"+t);}catch(e){}}
function goDate(k){if(!validKey(k))return;S.date=k;S.trainWk=null;render();window.scrollTo(0,0);}

document.addEventListener("click",e=>{
  const b=e.target.closest("[data-act]");if(!b)return;
  const a=b.dataset.act,v=b.dataset.v;
  switch(a){
    case"tab":return setTab(v,b.dataset.scroll);
    case"day":return goDate(addDays(S.date,+v));
    case"go":if(S.tab!=="today")S.tab="today";try{history.replaceState(null,"","#today");}catch(_){}return goDate(v);
    case"check":{const d=ensureDay(S.date);d.checks[v]=!d.checks[v];saveDay(S.date);patch();return;}
    case"wk":S.trainWk=v||null;return rerenderKeepScroll();
    case"liftdone":case"walkdone":{const id=a==="liftdone"?"lift":"walk";const d=ensureDay(S.date);d.checks[id]=!d.checks[id];saveDay(S.date);rerenderKeepScroll();if(d.checks[id])toast(id==="lift"?"Workout checked off":"Walk checked off");return;}
    case"tgo":return toggleTimer();
    case"treset":resetTimer(S.date);return rerenderKeepScroll();
    case"coachadj":return applyAdj(+v,+b.dataset.w);
    case"manadj":return applyAdj(+v,null);
    case"export":return exportCSV();
    default:if(ACTIONS[a])return ACTIONS[a](b,e);
  }
});
document.addEventListener("input",e=>{
  const t=e.target;
  for(const fn of ON_INPUT){if(fn(t,e))return;}
  if(t.dataset.f){
    const d=ensureDay(S.date),f=t.dataset.f;
    if(f==="notes"){d.notes=t.value;saveDay(S.date);return;}
    if(t.value===""){d[f]=null;t.removeAttribute("aria-invalid");const nf=t.closest(".nf");nf&&nf.classList.remove("bad");saveDay(S.date);patch();return;}
    const n=+t.value,[lo,hi]=DAY_LIMITS[f];
    const ok=!isNaN(n)&&n>=lo&&n<=hi;
    t.setAttribute("aria-invalid",!ok);const nf=t.closest(".nf");nf&&nf.classList.toggle("bad",!ok);
    if(!ok)return;
    d[f]=n;saveDay(S.date);patch();return;
  }
  if(t.dataset.lift){
    const [id,i,j]=t.dataset.lift.split("|");const d=ensureDay(S.date);
    const arr=d.lifts[id]=d.lifts[id]||[];while(arr.length<=+i)arr.push({w:null,r:null});arr[+i]=arr[+i]||{w:null,r:null};
    const n=t.value===""?null:+t.value;arr[+i][j]=n!=null&&!isNaN(n)&&n>=0?n:null;saveDay(S.date);return;
  }
});
document.addEventListener("change",e=>{
  const t=e.target;
  for(const fn of ON_CHANGE){if(fn(t,e))return;}
  if(t.id==="jump"){if(validKey(t.value))goDate(t.value);return;}
  if(!t.dataset.set)return;
  const f=t.dataset.set, st=ST();
  if(f==="start"){if(!validKey(t.value)){t.value=st.start;return;}const picked=t.value,m=mondayOf(picked);st.start=m;t.value=m;toast(picked===m?`Program starts ${nice(m)}`:`Programs start on a Monday. Moved to ${nice(m)}.`);saveSet();rerenderKeepScroll();return;}
  if(f==="wake"||f==="train"||f==="bed"){if(toMin(t.value)==null){t.value=st[f];return;}st[f]=t.value;saveSet();return;}
  if(f==="startWeight"&&t.value===""){st.startWeight=null;saveSet();return;}
  const n=+t.value,[lo,hi]=SET_LIMITS[f];
  if(t.value===""||isNaN(n)){t.value=st[f]??"";return;}
  const v=Math.min(hi,Math.max(lo,n));
  if(v!==n)toast(`${t.labels&&t.labels[0]?t.labels[0].childNodes[0].textContent.trim():f} must be ${lo.toLocaleString()}–${hi.toLocaleString()}. Set to ${v.toLocaleString()}.`);
  st[f]=v;t.value=v;
  if((f==="p"||f==="c"||f==="f")){const mk=st.p*4+st.c*4+st.f*9;const nc=Math.min(CEIL,Math.max(FLOOR,Math.round(mk/10)*10));if(nc!==st.cal){st.cal=nc;if(nc!==Math.round(mk/10)*10&&typeof rebalanceForCal==="function")rebalanceForCal(st);toast(`Calories set to ${st.cal.toLocaleString()} to match your macros`);rerenderKeepScroll();}}
  if(f==="cal"&&typeof rebalanceForCal==="function"){rebalanceForCal(st);toast(`Carbs set to ${st.c} g and fat to ${st.f} g to match ${st.cal.toLocaleString()} kcal`);rerenderKeepScroll();}
  saveSet();patchPlan();
});

(function boot(){
  const h=(location.hash||"").slice(1);if(["today","train","progress","plan","fuel"].includes(h))S.tab=h;
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&S.lastSeen&&S.lastSeen!==todayKey()&&S.date===S.lastSeen){S.date=todayKey();render();}S.lastSeen=todayKey();});
  S.lastSeen=todayKey();
  /* midnight rollover while the page stays open */
  let rollPending=false;
  setInterval(()=>{const tk=todayKey();if(S.lastSeen!==tk){const was=S.lastSeen;S.lastSeen=tk;if(S.date===was){
    const a=document.activeElement;
    if(a&&/INPUT|TEXTAREA/.test(a.tagName)){a.blur();} /* commit the field to yesterday, then move on */
    S.date=tk;render();toast(`It's a new day: ${nice(tk)}`);}}},30000);
  initStore();
})();