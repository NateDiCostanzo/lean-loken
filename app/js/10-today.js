/* =========================================================
   TODAY — focus card, Core 4, timeline, quick log
   ========================================================= */
const tdFmtA=m=>fmt12(m).replace(/ (A|P)M$/,(_,a)=>a.toLowerCase());          // "5:45a"
const tdNow=()=>{const n=new Date();return n.getHours()*60+n.getMinutes();};
const tdDur=m=>{m=Math.max(0,Math.round(m));const h=Math.floor(m/60),r=m%60;return h?(r?`${h}h ${r}m`:`${h}h`):`${r}m`;};
const tdWhen=(t,now)=>t-now>=1?`in ${tdDur(t-now)}`:now-t<1?"now":`${tdDur(now-t)} ago`;
const tdBarC=(x,p)=>x===todayKey()&&p!=null&&p<100?"var(--accent)":colorFor(p); // today is still in progress: no red
const tdN=v=>Math.round(v).toLocaleString();
function tdMeals(k){try{return buildMeals(tdT(k)).meals||{};}catch(e){return {};}}
const tdMeal=(r,M)=>r.meal||(r.kind==="meal"?M[r.id]:null)||null;
const tdAlt=(d,id)=>d.mealsAlt&&d.mealsAlt[id]&&typeof d.mealsAlt[id]==="object"?d.mealsAlt[id]:null;
const tdOpen=new Set();      // meal ids whose "What to eat" panel is open
let tdLastW=null;            // last water quick-add, for undo: {k,prev,v}
let tdQA=null, tdC4Open=false; const tdHOpen=new Set();
let tdTimer=null, tdFocusHTML="", tdRendered={date:null,today:null};
const TD_SHORT={veg:"Vegetables",sodium:"Steady sodium",alcohol:"No alcohol",photos:"Photos",review:"Weekly review"};
const TD_SKEY="leanloken.schedOpen";   // per-viewer: is the full schedule expanded on Today
function tdSchedOpen(){try{return localStorage.getItem(TD_SKEY)==="1";}catch(e){return false;}}

function briefText(pl){
  const st=ST(), s=pl.sch, tr=fmt12(toMin(s.train||st.train));
  if(pl.pre&&pl.idx>=-7)return `Program starts ${nice(st.start)}. This is a preview of a ${DOWL[pl.dow]}. Use this week to stock food, test your gym time and take baseline photos.`;
  if(pl.pre)return `Program starts ${nice(st.start)}. This is a preview of a ${DOWL[pl.dow]}.`;
  if(pl.post)return "The 12 weeks are done. Follow “After Week 12” in Plan: reverse calories slowly before any bulk.";
  const walk=String(s.walk||s.walkShort||"walk").toLowerCase(), ivl=`${s.intervalMode==="bike"?"Peloton bike":s.intervalMode==="tread"?"tread":""} intervals`.trim();
  const bits=[];
  if(s.intervals&&(s.cardioFirst||!s.lift))bits.push(`${ivl[0].toUpperCase()+ivl.slice(1)} at ${tr}`);
  if(s.lift)bits.push(`${bits.length?"then ":"Lift "}${wkName(s.lift)}${bits.length?"":" at "+tr}`);
  if(s.intervals&&s.lift&&!s.cardioFirst)bits.push(`then ${ivl}`);
  bits.push(`${bits.length?"finish with ":"Today: "}${walk}`);
  let t=bits.join(", ")+".";
  if(!s.lift&&!s.intervals)t=`No lifting. ${s.walk||"Easy walk"} any time, then the weekly check-in: weigh, measure waist, take photos.`;
  if(pl.deload)t+=" Deload week: lighter volume so you recover.";
  return t;
}
/* B's dayBrief(k) when it exists (string or {text|lead|t}), else the local summary */
function tdLead(k,pl){
  if(typeof dayBrief==="function"){try{const b=dayBrief(k);if(typeof b==="string"&&b)return b;if(b&&typeof b==="object"){const t=b.text||b.lead||b.t||b.summary;if(t)return String(t);}}catch(e){console.error(e);}}
  return briefText(pl);
}

/* ---------- "ate as planned": cal/protein follow the ticked meals ---------- */
function tdPlanTotals(k,d){
  const M=tdMeals(k);let n=0,kc=0,p=0;
  timeline(k).forEach(r=>{if(r.info||r.kind!=="meal"||!(d.checks&&d.checks[r.id]))return;
    const a=tdAlt(d,r.id),m=tdMeal(r,M);const t=a?{k:+a.k||0,p:+a.p||0}:m&&m.tot?m.tot:null;if(!t)return;n++;kc+=t.k;p+=t.p;});
  return {n,k:Math.round(kc),p:Math.round(p)};
}
/* idempotent: safe to call from every patch(). Returns true if it changed the day. */
function tdSyncPlan(k){
  const d=S.days[k];if(!d||d.calSrc==="manual")return false;
  const t=tdPlanTotals(k,d);
  if(!d.calSrc&&(!t.n||d.cal!=null||d.protein!=null))return false;   // older days with typed numbers stay as typed
  const nc=t.n?t.k:null,np=t.n?t.p:null;
  if(d.calSrc==="plan"&&d.cal===nc&&d.protein===np)return false;
  d.calSrc="plan";d.cal=nc;d.protein=np;saveDay(k);return true;
}

/* shared with the AI builder: force plan totals now (caller saves). No-op when the numbers are typed by hand. */
function recalcFromMeals(k){const d=ensureDay(k);if(d.calSrc==="manual")return;const t=tdPlanTotals(k,d);d.calSrc="plan";d.cal=t.n?t.k:null;d.protein=t.n?t.p:null;}

/* ---------- Log field status text ---------- */
function tdTgt(f,d,k){
  const T=tdT(k),v=d[f];
  switch(f){
    case"weight":{const pw=lastWeightBefore(k);return v>0&&pw?`${v-pw.v>0?"+":""}${(v-pw.v).toFixed(1)} lb vs ${pw.k===k||pw.start?"start":short(pw.k)}`:"lb, before food";}
    case"cal":{const pf=d.calSrc==="plan"&&v!=null;return v==null?`target ${tdN(T.cal)}`:Math.abs(v-T.cal)<=STEP?(pf?"From plan · on target":`On target (${tdN(T.cal)})`):v<T.cal?(pf?`From plan · ${tdN(T.cal-v)} left`:`${tdN(T.cal-v)} left of ${tdN(T.cal)}`):`${tdN(v-T.cal)} over ${tdN(T.cal)}`;}
    case"protein":{const pf=d.calSrc==="plan"&&v!=null?"From plan · ":"";return v==null?`target ${T.p} g`:v>=T.p-10?`${pf}target hit`:`${pf}${tdN(T.p-v)} g to go`;}
    case"steps":return v==null?`goal ${tdN(T.steps)}`:v>=T.steps?"Goal hit":`${tdN(T.steps-v)} to go`;
    case"water":return v==null?`goal ${T.water} oz`:v>=T.water?"Goal hit":`${tdN(T.water-v)} oz to go`;
    case"sleep":return v==null?"hours, goal 7+":v>=7?"7+ hours":`${(7-v).toFixed(2).replace(/\.?0+$/,"")} h under 7`;
    case"waist":return "in, at the navel";
  }return "";
}
const tdHit={cal:"cal",protein:"protein",steps:"steps",water:"water",sleep:"sleep",waist:"waist",weight:"wake"};

/* ---------- Now / Next ---------- */
/* lights out can't be ticked until bed−15 (today only) */
const tdWaitLO=(r,k,now)=>r.id==="lightsout"&&k===todayKey()&&now<r.t-15;
/* off-plan awareness: projected day = logged meals + the rest as planned */
function tdTrim(k){
  const d=getDay(k),T=tdT(k),M=tdMeals(k),rows=timeline(k).filter(r=>!r.info&&r.kind==="meal");
  let eaten=0,rest=0,worst=null,target=null;
  rows.forEach(r=>{const m=tdMeal(r,M);if(!m||!m.tot)return;
    if(d.checks&&d.checks[r.id]){const a=tdAlt(d,r.id);const k1=a?+a.k||0:m.tot.k;eaten+=k1;
      if(a){const diff=k1-m.tot.k;if(diff>0&&(!worst||diff>worst.diff))worst={diff,name:r.title.split(",")[0]};}}
    else{rest+=m.tot.k;if(!target&&m.items&&m.items.some(i=>/rice|potato|oats|olive oil/i.test(i.label)))target={r,m};}});
  const over=Math.round(eaten+rest-T.cal);
  if(over<=STEP||!target)return null;
  const carb=target.m.items.filter(i=>/rice|potato|oats/i.test(i.label)&&/^\d+ g/.test(i.qty)).sort((a,b)=>b.k-a.k)[0];
  const oil=target.m.items.find(i=>/olive oil/i.test(i.label)&&i.k>0);
  const nm=target.r.title.split(",")[0].replace(/ \(.*\)$/,"").toLowerCase();
  let fix="";
  if(carb){const g=parseInt(carb.qty,10),cut=Math.min(over,carb.k*.5),ng=Math.max(0,Math.round(g*(1-cut/carb.k)/10)*10);
    const fn=/rice/i.test(carb.label)?"rice":/oats/i.test(carb.label)?"oats":"potato";
    fix=`about ${ng} g ${fn} instead of ${g} g${oil?", or skip the oil":""}`;}
  else if(oil)fix="skip the oil";
  const lead=worst?`${worst.name} ran +${tdN(worst.diff)} kcal.`:`Today is on track for +${tdN(over)} kcal.`;
  return {id:target.r.id,over,text:`${lead} Trim ${nm}: ${fix}.`};
}
function tdSoFar(k){const d=getDay(k),T=tdT(k),t=tdPlanTotals(k,d);if(!t.n&&d.calSrc!=="manual")return "";
  const kc=d.calSrc==="manual"&&d.cal!=null?d.cal:t.k,pr=d.calSrc==="manual"&&d.protein!=null?d.protein:t.p;
  return `Today so far: ${tdN(kc)} of ${tdN(T.cal)} kcal · ${tdN(pr)} g protein`;}
/* evening close-out: after dinner's time until bed */
function tdClose(k,now){
  if(k!==todayKey())return "";
  const tl=timeline(k),din=tl.find(r=>r.id==="dinner"),lo=tl.find(r=>r.id==="lightsout");
  if(!din||!lo||now<din.t||now>=lo.t)return "";
  const d=getDay(k),man=habits(k).filter(h=>!h.auto);
  const miss=[["steps","steps"],["water","water"],["sleep","sleep"]].filter(([f])=>d[f]==null);
  if(!miss.length&&man.every(h=>isDone(h,d,k)))return "";
  return `<div class="fx-close"><div class="eyebrow">Close out the day</div>
    ${miss.length?`<p class="fx-miss">Still to log: ${miss.map(([f,l])=>`<button class="tlk" data-act="tdqa" data-v="${f}">${l}</button>`).join(", ")}</p>`:""}
    <div class="qcs">${man.map(h=>{const on=isDone(h,d,k);return `<button class="qc ${on?"on":""}" data-act="check" data-v="${h.id}" aria-pressed="${on}">${esc(h.short||TD_SHORT[h.id]||h.title)}</button>`;}).join("")}</div></div>`;
}
function tdModel(k){
  const d=getDay(k),now=tdNow(),open=timeline(k).filter(r=>!r.info&&!isDone(r,d,k));
  if(!open.length)return {done:true,now};
  const due=open.filter(r=>r.t<=now&&!tdWaitLO(r,k,now));      // most recent passed item wins
  let main=due.length&&now-due[due.length-1].t<=120?due[due.length-1]:null,mode="now";
  const late=due.filter(r=>r!==main);
  if(!main){main=open.find(r=>r.t>now&&!tdWaitLO(r,k,now))||null;mode="next";}
  const next=main?open.slice(open.indexOf(main)+1).find(r=>r.t>=main.t)||null:null;
  return {main,mode,next,late,now,d};
}
function tdMainAct(r,d){
  if(r.id==="wake"&&!(d.weight>0))return `<div class="fx-w"><label class="sr" for="fx-weight">Morning weight in pounds</label>
    <input id="fx-weight" data-fw type="number" inputmode="decimal" step="0.1" min="${DAY_LIMITS.weight[0]}" max="${DAY_LIMITS.weight[1]}" placeholder="Weight" enterkeyhint="done"><span class="u">lb</span>
    <button class="btn fx-go" data-act="tdw">Save</button></div>`;
  if(r.link)return `<button class="btn fx-go" data-act="tdopen" data-v="${r.id}">Open workout</button><button class="btn sec fx-2" data-act="tddone" data-v="${r.id}">Mark done</button>`;
  if(r.auto)return `<button class="btn fx-go" data-act="tdgo" data-v="${r.id==="wake"?"weight":esc(r.id)}">Log it</button>`;
  const alt=r.kind==="meal"&&typeof ACTIONS.mealalt==="function"?`<button class="btn sec fx-2" data-act="mealalt" data-v="${r.id}">Ate something else</button>`:"";
  return `<button class="btn fx-go" data-act="tddone" data-v="${r.id}">Done</button>${alt}`;
}
function tdFocusInner(k){
  const m=tdModel(k);
  const now0=tdNow(),sf=tdSoFar(k),tr=tdTrim(k),cl=tdClose(k,now0);
  const wd=timeline(k).find(r=>r.info&&r.id==="winddown");
  const extras=(tr?`<p class="fx-trim" data-fxtrim>${esc(tr.text)}</p>`:"")+(sf?`<p class="fx-sofar">${esc(sf)}</p>`:"");
  const tail=(wd&&now0>=wd.t&&now0<wd.t+45?`<div class="fx-info"><b>${esc(wd.title)}</b> · ${esc(wd.detail||"")}</div>`:"")+cl;
  if(m.done){const c=core4(k),miss=c?CORE4.filter(([id])=>!c.keys[id]).map(([,l])=>l):[];
    return `<div class="fx-main"><div class="fx-top"><span class="fx-tag good">Day complete</span></div>
      <h2 class="fx-title">Everything on today’s schedule is done.</h2>
      <p class="fx-det">${c?`Core 4: ${c.met} of 4 met${miss.length?`. Still open: ${miss.join(", ")}.`:". Nice work."}`:""}</p>${extras}</div>${tail}`;}
  const {main,mode,next,late,now,d}=m,M=tdMeals(k);
  let h="";
  if(main){
    const meal=tdMeal(main,M),alt=main.kind==="meal"?tdAlt(d,main.id):null;
    let body="";
    if(alt)body=`<p class="fx-det"><b>Logged instead:</b> ${esc(alt.text)} · ${tdN(+alt.k||0)} kcal · ${tdN(+alt.p||0)} g protein</p>`;
    else if(meal&&meal.items){body=`<ul class="fx-foods">${meal.items.filter(i=>i.k||i.qty).map(i=>`<li><span>${esc(i.label)}</span><b>${esc(i.qty)}</b></li>`).join("")}</ul>
      <p class="fx-tot">${tdN(meal.tot.k)} kcal · ${tdN(meal.tot.p)} g protein</p>`;}
    else if(main.detail)body=`<p class="fx-det">${esc(main.detail)}</p>`;
    h+=`<div class="fx-main k-${esc(main.kind)}" data-fx="${main.id}">
      <div class="fx-top"><span class="fx-tag ${mode}">${mode==="now"?"Now":"Next up"}</span><span class="fx-when">${fmt12(main.t)} · ${tdWhen(main.t,now)}</span></div>
      <h2 class="fx-title">${esc(main.title)}</h2>${body}
      <div class="fx-act">${tdMainAct(main,d)}</div>${extras}</div>`;
    if(next)h+=`<div class="fx-next"><span class="eyebrow">${mode==="now"?"Next":"Then"}</span><span class="nt">${esc(next.title)}</span><span class="nw">${tdFmtA(next.t)} · ${tdWhen(next.t,now)}</span>${next.link?`<button class="btn sec sm" data-act="tdopen" data-v="${next.id}" aria-label="Open ${esc(next.title)} in Train">Open</button>`:""}</div>`;
  }else h+=`<div class="fx-main"><div class="fx-top"><span class="fx-tag next">Clear</span></div><h2 class="fx-title">Nothing due right now</h2><p class="fx-det">Catch up on the items below.</p>${extras}</div>`;
  if(late.length)h+=`<div class="fx-late"><div class="eyebrow">Earlier today · ${late.length} open</div><ul>${late.map(r=>`<li><span class="tm">${tdFmtA(r.t)}</span><span class="nm">${esc(r.title)}</span>${
    r.id==="wake"?`<button class="btn sec sm" data-act="tdgo" data-v="weight">Add weight</button>`:r.auto?`<button class="btn sec sm" data-act="tdgo" data-v="${esc(r.id)}">Log</button>`:`<button class="btn sec sm" data-act="tddone" data-v="${r.id}">Done</button>`}</li>`).join("")}</ul></div>`;
  return h+tail;
}
/* refresh focus card, late markers and the now line (every 60 s and after each change) */
function tdFmt(){
  const d=getDay(S.date),act=document.activeElement;
  document.querySelectorAll(".tdv [data-fmt]").forEach(el=>{const f=el.dataset.fmt,v=d[f],inp=el.parentNode.querySelector("input");
    const t=v!=null&&v>=1000?tdN(v):"";if(el.textContent!==t)el.textContent=t;const w=el.closest(".nf,.bf-f");if(w)w.classList.toggle("fmt",!!t&&inp!==act);});
}
/* quick-add row: one tap for the numbers logged most often */
function tdQuickHTML(k){
  const d=getDay(k),m=tdModel(k),fxw=m.main&&m.main.id==="wake"&&!(d.weight>0);
  /* green only when the target is met (same rule as the Log); otherwise neutral with what's left */
  const met=f=>f==="weight"?d.weight>0:d[f]!=null&&autoVal(f,d,k);
  const hint=f=>d[f]==null||met(f)||f==="weight"?"":tdTgt(f,d,k);
  const val={water:d.water!=null?`${tdN(d.water)} oz`:"Add",weight:d.weight>0?fnum(d.weight):"Add",steps:d.steps!=null?tdN(d.steps):"Add",sleep:d.sleep!=null?`${d.sleep} h`:"Add"};
  const b=(f,label)=>`<button class="qk ${met(f)?"on":""} ${d[f]==null?"empty":""} ${tdQA===f?"open":""}" data-act="tdqa" data-v="${f}" aria-expanded="${tdQA===f}"><span class="ql">${label}</span><span class="qv">${val[f]}</span>${hint(f)?`<span class="qh">${esc(hint(f))}</span>`:""}</button>`;
  let h=`<div class="qks ${fxw?"n3":""}">`+b("water","Water")+(fxw?"":b("weight","Weight"))+b("steps","Steps")+b("sleep","Sleep")+`</div>`;
  const f=tdQA,L={weight:["Weight","lb","0.1"],steps:["Steps","steps","100"],sleep:["Sleep last night","hours","0.25"],water:["Water today","oz","8"]}[f];
  if(L){
    const yd=S.days[addDays(k,-1)];
    const chips=f==="water"?`<button class="qc" data-act="tdwater" data-v="16">+16 oz</button><button class="qc" data-act="tdwater" data-v="24">+24 oz</button>${tdLastW&&tdLastW.k===k?`<button class="qc ghost" data-act="tdwundo" data-wundo>Undo +${tdLastW.v}</button>`:""}`
      :f==="sleep"?[6,6.5,7,7.5,8].map(x=>`<button class="qc ${d.sleep===x?"on":""}" data-act="tdsleep" data-v="${x}" data-sl="${x}" aria-pressed="${d.sleep===x}">${x}</button>`).join("")
      :f==="steps"&&yd&&yd.steps!=null&&(k!==todayKey()||tdNow()>=18*60)?`<button class="qc" data-act="tdsteps" data-v="${yd.steps}">Same as yesterday · ${tdN(yd.steps)}</button>`:"";
    h+=`<div class="qa-ed"><div class="qa-in"><label for="qa-in">${L[0]}</label><input id="qa-in" data-qa="${f}" type="number" inputmode="decimal" step="${L[2]}" min="${DAY_LIMITS[f][0]}" max="${DAY_LIMITS[f][1]}" value="${d[f]??""}" placeholder="${L[1]}" enterkeyhint="done"><button class="btn sm" data-act="tdqasave">Save</button></div>${chips?`<div class="qcs">${chips}</div>`:""}</div>`;}
  return h;
}
function tdQuickRefresh(){const q=document.querySelector("[data-quick]");if(!q||q.contains(document.activeElement)&&document.activeElement.tagName==="INPUT")return;const h=tdQuickHTML(S.date);if(q.innerHTML!==h)q.innerHTML=h;}
ACTIONS.tdqa=(el)=>{const f=el.dataset.v,fromQ=!!el.closest("[data-quick]");tdQA=fromQ&&tdQA===f?null:f;tdQuickRefresh();const i=$("#qa-in");if(i){if(!fromQ)i.scrollIntoView({block:"center"});i.focus({preventScroll:!fromQ?true:false});i.select&&i.select();}};
ACTIONS.tdqasave=()=>{const i=$("#qa-in");if(!i)return;const f=i.dataset.qa,n=+i.value,[lo,hi]=DAY_LIMITS[f];
  if(i.value===""||isNaN(n)||n<lo||n>hi){i.setAttribute("aria-invalid","true");toast(`Enter a number from ${lo} to ${hi.toLocaleString()}`);return;}
  tdQA=null;i.blur();tdSetField(S.date,f,n);tdQuickRefresh();};
ACTIONS.tdc4=(el)=>{tdC4Open=!tdC4Open;const x=$("#c4x");if(x)x.hidden=!tdC4Open;el.setAttribute("aria-expanded",tdC4Open);};
ACTIONS.tdhd=(el)=>{const id=el.dataset.v,p=document.getElementById("hd-"+id);if(!p)return;const op=p.hidden;p.hidden=!op;el.setAttribute("aria-expanded",op);el.textContent=op?"Hide":"Show";if(op)tdHOpen.add(id);else tdHOpen.delete(id);};
ACTIONS.tdcopy=()=>{const txt="Week 1 groceries\n"+tdGrocery().map(x=>`${x.label}: ${x.amt}`).join("\n"),ul=document.querySelector(".gro ul");
  const sel=()=>{if(!ul)return;const r=document.createRange();r.selectNodeContents(ul);const s=getSelection();s.removeAllRanges();s.addRange(r);toast("Select-all is on. Copy with your device's copy command.");};
  try{if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(()=>toast("Grocery list copied"),sel);else sel();}catch(e){sel();}};
function tdTick(){
  if(S.tab!=="today")return;
  const k=S.date,tk=todayKey(),now=tdNow(),d=getDay(k);
  if(tdRendered.date!==k||tdRendered.today!==tk){const a=document.activeElement;if(!(a&&/INPUT|TEXTAREA/.test(a.tagName))){rerenderKeepScroll();return;}}
  const fc=document.querySelector("[data-focus]");
  const ae=document.activeElement;
  if(fc&&k===tk&&!(ae&&ae.tagName==="INPUT"&&fc.contains(ae))){const h=tdFocusInner(k);if(h!==tdFocusHTML){fc.innerHTML=h;tdFocusHTML=h;}}
  const rows=document.querySelectorAll(".tl li[data-t]");
  const pre=planFor(k).pre;
  rows.forEach(li=>{const t=+li.dataset.t;li.classList.toggle("late",!pre&&!li.classList.contains("done")&&li.dataset.item!=null&&(k<tk||k===tk&&now-t>15));});
  document.querySelectorAll('.tl li[data-item="lightsout"]').forEach(li=>li.classList.toggle("wait",k===tk&&now<+li.dataset.t-15));
  const co=!!document.querySelector(".fx-close");document.querySelectorAll(".tdv .o-std").forEach(el=>{if(!el.contains(document.activeElement))el.hidden=co;});
  tdFmt();
  const tr=tdTrim(k);document.querySelectorAll("[data-trim]").forEach(el=>{const on=!!tr&&tr.id===el.dataset.trim;el.hidden=!on;if(on&&el.textContent!==tr.text)el.textContent=tr.text;});
  const ln=document.querySelector("[data-nowln]");
  if(ln){const after=[...rows].find(li=>+li.dataset.t>now);const ol=ln.parentNode;
    if(after){if(ln.nextSibling!==after)ol.insertBefore(ln,after);}else if(ol.lastChild!==ln)ol.appendChild(ln);
    const tm=ln.querySelector(".tm");if(tm)tm.textContent=tdFmtA(now);}
}

/* ---------- Core 4 block ---------- */
const TD_C=2*Math.PI*38;
function tdRingSegs(c){const q=TD_C/4,g=7;return CORE4.map(([id],i)=>`<circle data-seg="${id}" cx="46" cy="46" r="38" fill="none" stroke-width="8" stroke-linecap="round" stroke="${c&&c.keys[id]?"var(--good)":"var(--line)"}" stroke-dasharray="${q-g} ${TD_C-q+g}" stroke-dashoffset="${-(i*q)-g/2}"/>`).join("");}
function tdC4Sub(k,sc,c){
  const tk=todayKey();
  if(!c)return k>tk?"Upcoming":"Preview";
  if(k!==tk)return c.met===4?"All 4 met":`${c.met} of 4 met`;
  const s=streak();
  return s.days?`<b>${s.days}-day streak</b>${s.graceUsedThisWeek?" (1 grace day used)":""}`:"No streak yet. Hit all 4 to start one.";
}

/* ---------- pre-start: countdown, setup checklist, grocery list ---------- */
const tdSU=()=>{const s=ST().setup;return s&&typeof s==="object"&&!Array.isArray(s)?s:{};};
const TD_FR={"½":.5,"¼":.25,"¾":.75};
function tdQty(q){const m=/^(\d+(?:\.\d+)?)?\s*([½¼¾])?\s*(.*)$/.exec(String(q||""));if(!m||(!m[1]&&!m[2]))return null;
  return {n:(+m[1]||0)+(TD_FR[m[2]]||0),u:m[3].split(/ ·| \(/)[0].trim()};}
function tdGrocery(){
  const st=ST(),t=tdT(addDays(st.start,1)),M=buildMeals(t).meals,agg=new Map();
  Object.values(M).forEach(m=>(m.items||[]).forEach(i=>{const q=tdQty(i.qty);if(!q||!q.n)return;
    const label=i.label.replace(/ \((cooked|cooking|dry weight|cooked with the eggs)\)/,"");const key=label+"|"+q.u;
    const a=agg.get(key)||{label,u:q.u,n:0};a.n+=q.n*7;agg.set(key,a);}));
  const pl=(n,u)=>u&&n>1&&/^(slice|scoop|cup)$/.test(u)?u+"s":u;
  return [...agg.values()].map(a=>{let n=a.u==="g"?Math.round(a.n/10)*10:Math.round(a.n*4)/4;
    let s=`${n.toLocaleString()}${a.u?" "+pl(n,a.u):""}`;
    if(a.u==="g"&&n>=454)s+=` (${(n/453.6).toFixed(1)} lb)`;else if(a.u==="oz"&&n>=16)s+=` (${(n/16).toFixed(1)} lb)`;
    return {label:a.label,amt:s};});
}
/* best guess for a starting weight: last weigh-in on or before the start date, else the first one after it */
function tdStartGuess(){
  const st=ST(),ks=Object.keys(S.days).filter(x=>S.days[x].weight>0).sort();if(!ks.length)return null;
  const before=ks.filter(x=>x<=st.start),k=before.length?before[before.length-1]:ks[0];
  return {k,v:+S.days[k].weight};
}
function tdSetupHTML(){
  const st=ST(),su=tdSU(),g=tdStartGuess();
  const row=(id,done,title,sub,ctl)=>`<li class="su-i ${done?"done":""}" data-su="${id}">${ctl}<div class="tx"><b>${title}</b>${sub?`<span>${sub}</span>`:""}</div></li>`;
  const tog=(id,label)=>`<button class="chk ${su[id]?"on":""}" data-act="tdsetup" data-v="${id}" aria-pressed="${!!su[id]}" aria-label="${label}">${CHECK}</button>`;
  const stat=done=>`<span class="chk auto ${done?"on":""}" role="img" aria-label="${done?"Done":"Not done"}">${CHECK}</span>`;
  const sw=st.startWeight!=null;
  const wctl=sw?`Set to <b class="num">${fnum(st.startWeight)} lb</b>. <button class="lnk" data-act="tab" data-v="plan" data-scroll="settings">Change</button>`:
    `${g?`<button class="btn sm" data-act="tdsw" data-v="${g.v}">Use ${fnum(g.v)} from ${short(g.k)}</button> or type it: `:""}<span class="su-w"><input data-sw type="number" inputmode="decimal" step="0.1" min="${SET_LIMITS.startWeight[0]}" max="${SET_LIMITS.startWeight[1]}" placeholder="lb" aria-label="Starting weight in pounds" enterkeyhint="done"><button class="btn sec sm" data-act="tdswsave">Save</button></span>`;
  const gro=tdGrocery();
  const items=[
    row("weight",sw,"Starting weight",`<span class="su-c">${wctl}</span>`,stat(sw)),
    row("times",!!su.times,"Daily times confirmed",`Wake ${tdFmtA(toMin(st.wake))} · work ${tdFmtA(toMin(st.workStart))}–${tdFmtA(toMin(st.workEnd))} · train ${tdFmtA(toMin(st.train))} · bed ${tdFmtA(toMin(st.bed))}. <button class="lnk" data-act="tab" data-v="plan" data-scroll="settings">Review in Plan</button>`,tog("times","Times confirmed")),
    row("groceries",!!su.groceries,"Grocery list for Week 1",`<details class="gro"><summary>Show the list (${gro.length} items)</summary><button class="btn sec sm gro-c" data-act="tdcopy">Copy list</button><ul>${gro.map(x=>`<li><span>${esc(x.label)}</span><b>${esc(x.amt)}</b></li>`).join("")}</ul><p class="note">One week of planned meals. Buy vegetables and berries twice.</p></details>`,tog("groceries","Groceries bought")),
    row("photos",!!su.photos,"Baseline photos taken","Front, side and face. Same spot and light you'll use every Sunday.",tog("photos","Baseline photos taken")),
    row("gym",!!su.gym,"Gym time tested",`Go at ${tdFmtA(toMin(st.train))} once to see how busy it is.`,tog("gym","Gym time tested"))];
  const n=[sw,su.times,su.groceries,su.photos,su.gym].filter(Boolean).length;
  return {html:`<ul class="su">${items.join("")}</ul>`,n,total:5};
}

function renderToday(){
  const k=S.date, pl=planFor(k), d=getDay(k), st=ST(), T=tdT(k), sc=score(k), c4=core4(k), tk=todayKey(), now=tdNow(), M=tdMeals(k), isT=k===tk, pre=pl.pre;
  tdRendered={date:k,today:tk};
  const status= pre?"": pl.post?`<span class="badge good">Program complete</span>`:`<span class="badge acc">Week ${pl.week} of 12 · Day ${pl.idx+1}</span>`;
  const extra=pre?"":(pl.deload&&pl.inProg?`<span class="badge warn">Deload week</span>`:"")+(T.dietBreak&&pl.inProg?`<span class="badge good">Diet break · ${tdN(T.cal)} kcal</span>`:"")+(pl.sch.intervals?`<span class="badge run">${pl.sch.intervalMode==="bike"?"Bike intervals":pl.sch.intervalMode==="tread"?"Tread intervals":"Intervals"}</span>`:"")+(pl.sch.checkin?`<span class="badge">Check-in day</span>`:"");
  const strip=weekKeys(k).map(x=>{const c=core4(x);const p=c?c.pct:null;const dd=parseKey(x);
    return `<button data-act="go" data-v="${x}" class="${x===k?"sel":""} ${x===tk?"today":""}" aria-label="${nice(x)}${c?`, ${c.met} of 4 core goals`:""}" ${x===k?'aria-current="date"':""}>${DOWN[dd.getDay()]}<b>${dd.getDate()}</b><span class="bar"><i data-bar="${x}" style="width:${p??0}%;background:${tdBarC(x,p)}"></i></span></button>`;}).join("");

  /* which meal rows get the big pills: the current or next unticked meal (today only) */
  const pills=new Set(isT&&!pre?timeline(k).filter(r=>r.kind==="meal"&&!r.info&&!isDone(r,d,k)&&now-r.t<=120).slice(0,2).map(r=>r.id):[]);
  /* timeline */
  const lateOf=(r,done)=>!pre&&!r.info&&!done&&(k<tk||isT&&now-r.t>15);
  let nowPlaced=!isT||pre;
  const nowLn=()=>`<li class="nowln" data-nowln aria-hidden="true"><span class="tm">${tdFmtA(now)}</span><span class="rail"><span class="dot"></span></span><div class="body"><i></i></div><div class="act"></div></li>`;
  const canAlt=!pre&&typeof ACTIONS.mealalt==="function";
  const tl=timeline(k).map(r=>{
    let pr="";if(!nowPlaced&&r.t>now){pr=nowLn();nowPlaced=true;}
    if(r.info)return pr+`<li class="info k-${esc(r.kind)}" data-info="${esc(r.id)}" data-t="${r.t}"><span class="tm">${tdFmtA(r.t)}</span><span class="rail"><span class="dot"></span></span><div class="body"><p><b>${esc(r.title)}</b>${r.detail?` · ${esc(r.detail)}`:""}</p></div><div class="act"></div></li>`;
    const done=!pre&&isDone(r,d,k), meal=tdMeal(r,M), alt=r.kind==="meal"&&!pre?tdAlt(d,r.id):null;
    const kc=meal&&meal.tot?`<span class="kc ${alt?"was":""}">${tdN(meal.tot.k)} kcal · ${tdN(meal.tot.p)} g protein</span>`:"";
    let ex="";
    if(meal&&meal.items){
      const big=pills.has(r.id);
      const foodsBtn=big?`<button class="tb xd" data-act="tdfoods" data-v="${r.id}" aria-expanded="${tdOpen.has(r.id)}" aria-controls="fd-${r.id}">What to eat</button>`:`<button class="tlk xd" data-act="tdfoods" data-v="${r.id}" aria-expanded="${tdOpen.has(r.id)}" aria-controls="fd-${r.id}">Details</button>`;
      const altBtn=canAlt&&!alt?`<button class="${big?"tb":"tlk"} alt-b" data-act="mealalt" data-v="${r.id}">Ate something else</button>`:"";
      ex=(alt?`<div class="alt"><span class="eyebrow">Ate instead</span><b>${esc(alt.text)}</b><span class="kc">${tdN(+alt.k||0)} kcal · ${tdN(+alt.p||0)} g protein</span>${alt.note?`<p>${esc(alt.note)}</p>`:""}
          <div class="mact">${canAlt?`<button class="tb" data-act="mealalt" data-v="${r.id}">Change</button>`:""}<button class="tb" data-act="tdaltclear" data-v="${r.id}">Back to plan</button></div></div>`:"")+
        `<p class="trim" data-trim="${r.id}" hidden></p><div class="mact ${big?"":"sm"}">${foodsBtn}${altBtn}</div>
        <div class="foods xd ${alt?"was":""}" id="fd-${r.id}" data-foods="${r.id}" ${tdOpen.has(r.id)?"":"hidden"}>${meal.items.map(i=>`<div class="food"><span>${esc(i.label)}</span><span class="q">${esc(i.qty)}</span>${i.k?`<span class="m">${mac(i)}</span>`:""}</div>`).join("")}<div class="food tot"><span>Meal total</span><span class="q">${mac(meal.tot)}</span></div></div>`;
    }else if(r.link&&!pre)ex=`<div class="mact xd sm"><button class="tlk" data-act="tdopen" data-v="${r.id}">Open in Train</button></div>`;
    return pr+`<li class="k-${esc(r.kind)} ${done?"done":""} ${lateOf(r,done)?"late":""} ${!pre&&tdWaitLO(r,k,now)?"wait":""}" data-item="${r.id}" data-t="${r.t}">
      <span class="tm" title="${fmt12(r.t)}">${tdFmtA(r.t)}</span><span class="rail"><span class="dot"></span></span>
      <div class="body"><h3>${esc(r.title)} ${kc}</h3>${r.detail?`<p class="xd">${esc(r.detail)}</p>`:""}${ex}</div>
      <div class="act">${pre?"":chk(r,done,k)+(r.id==="lightsout"?`<span class="wt">from ${tdFmtA(r.t-15)}</span>`:"")}</div></li>`;}).join("")+(nowPlaced?"":nowLn());

  /* daily standards: manual habits only (auto ones show as Log field states) */
  const H=habits(k), autoIds=new Set(H.filter(h=>h.auto).map(h=>h.id)), man=pre?[]:H.filter(h=>!h.auto);
  const hb=man.map(h=>{const done=isDone(h,d,k);
    const op=tdHOpen.has(h.id);
    return `<li class="${done?"done":""}" data-item="${h.id}"><div class="act">${chk(h,done,k)}</div><div class="tx"><b title="${esc(h.title)}">${esc(h.title)}</b>${h.detail?`<span class="hd" id="hd-${h.id}" ${op?"":"hidden"}>${esc(h.detail)}</span>`:""}</div>${h.detail?`<button class="tlk hs" data-act="tdhd" data-v="${h.id}" aria-expanded="${op}" aria-controls="hd-${h.id}">${op?"Hide":"Show"}</button>`:""}</li>`;}).join("");

  /* log */
  const nf=(f,label,step,o={})=>`<div class="nf ${o.cls||""}" data-nf="${f}"${!pre&&autoIds.has(f)?` data-item="${f}"`:""}>
      <div class="nf-h"><label for="f-${f}">${label}</label>${o.side||""}</div>
      <div class="nf-in"><input id="f-${f}" inputmode="${o.im||"decimal"}" type="number" step="${step}" min="${DAY_LIMITS[f][0]}" max="${DAY_LIMITS[f][1]}" data-f="${f}" value="${d[f]??""}" placeholder="${o.ph||"—"}">${o.fmt?`<span class="fmtv" data-fmt="${f}" aria-hidden="true"></span>`:""}</div>
      <span class="tgt" data-tgt="${f}">${esc(tdTgt(f,d,k))}</span>${o.after||""}${o.chips||""}</div>`;
  const y=addDays(k,-1),yd=S.days[y],ySteps=yd&&yd.steps!=null&&(!isT||now>=18*60)?yd.steps:null;
  const chip=(act,v,label,ext="")=>`<button class="qc" data-act="${act}" data-v="${v}" ${ext}>${label}</button>`;
  const nums=pre?[nf("weight","Weight","0.1",{cls:"wide"})]:[
    nf("weight","Weight","0.1",{cls:"wide"}),
    nf("cal","Calories","10",{after:`<span class="src" data-src="cal"></span>`,im:"numeric",fmt:1}),
    nf("protein","Protein","1",{im:"numeric"}),
    nf("steps","Steps","100",{im:"numeric",fmt:1}),
    nf("water","Water","8",{im:"numeric"}),
    nf("sleep","Sleep last night","0.25",{})];
  if(!pre&&(pl.sch.checkin||autoIds.has("waist")))nums.push(nf("waist","Waist","0.25",{}));

  /* backfill yesterday */
  let bf="";
  if(isT&&planFor(y).inProg){const yy=getDay(y),miss=[["weight","Weight","lb","0.1"],["steps","Steps","steps","100"],["sleep","Sleep","hours","0.25"]].filter(([f])=>yy[f]==null);
    if(miss.length)bf=`<section class="card bf" data-bf aria-label="Finish yesterday"><div class="bf-h"><h2>Finish yesterday</h2><span class="sub">${nice(y)} · missing ${miss.length===1?"1 number":miss.length+" numbers"}</span></div>
      <div class="bf-g">${miss.map(([f,l,u,s])=>`<label class="bf-f" data-yfw="${f}"><span>${l}</span><input data-yf="${f}" type="number" inputmode="decimal" step="${s}" min="${DAY_LIMITS[f][0]}" max="${DAY_LIMITS[f][1]}" placeholder="—"><small>${u}</small></label>`).join("")}</div></section>`;}

  const g=!pre&&st.startWeight==null?tdStartGuess():null;
  const setup= !pre&&st.startWeight==null?`<div class="callout td-setup"><span><b>Finish setup:</b> ${g?"set your starting weight.":"add your starting weight."}</span><span class="td-sb">${g?`<button class="btn sec sm" data-act="tdsw" data-v="${g.v}">Use ${fnum(g.v)} (${short(g.k)})</button>`:""}<button class="btn sec sm" data-act="tab" data-v="plan" data-scroll="settings">Settings</button></span></div>`:"";
  if(isT&&!pre)tdFocusHTML=tdFocusInner(k);

  /* day card: pre-start countdown, or the Core 4 summary */
  let brief;
  if(pre){
    const left=Math.max(0,diffDays(tk,st.start)),su=tdSetupHTML();
    brief=`<section class="card brief pre" aria-label="Program countdown">
      <div class="what"><div class="row"><span class="badge acc">Preview · starts ${short(st.start)}</span><span class="sub" data-sucount>${su.n} of ${su.total} ready</span></div>
        <h2>Program starts ${nice(st.start)}</h2><p class="lead">Get these done before then. The schedule below is a preview, nothing is scored yet.</p></div>
      <div class="cdown" role="img" aria-label="${left} ${left===1?"day":"days"} to go"><b>${left}</b><small>${left===1?"day":"days"} to go</small></div>
      <div class="su-wrap">${su.html}</div></section>`;
  }else brief=`<section class="brief slim ${isT?"":"card"}" aria-label="Day summary">
      <div class="bt"><div class="row">${status}${extra}</div><h2>${esc(dayHeadline(pl))}</h2></div>
      <button class="c4b" data-act="tdc4" data-ring aria-expanded="${tdC4Open}" aria-controls="c4x" aria-label="Core 4: ${c4?c4.met:0} of 4 met. Show details">
        <span class="c4d" aria-hidden="true">${CORE4.map(([id])=>`<i data-c4d="${id}" class="${c4&&c4.keys[id]?"on":""}"></i>`).join("")}</span><b data-ringnum>${c4?c4.met:0}/4</b></button>
      <div class="c4x" id="c4x" ${tdC4Open?"":"hidden"}><div class="c4s" aria-label="Core 4">${CORE4.map(([id,l])=>`<span class="c4 ${c4&&c4.keys[id]?"on":""}" data-c4="${id}"><i></i>${l}</span>`).join("")}</div>
        <p class="c4sub" data-c4sub>${tdC4Sub(k,sc,c4)}</p></div>
      ${!isT||pl.post?`<p class="lead">${esc(tdLead(k,pl))}</p>`:""}
    </section>`;

  const collapse=isT&&!pre, open=!collapse||tdSchedOpen();
  const schedHead=pre?`<h2>Schedule</h2><span class="sub">Preview of a ${DOWL[pl.dow]}</span>`:collapse?`<h2>Full schedule</h2><span class="sub" data-sccount>${sc.done} of ${sc.total} done</span>`:`<h2>Schedule</h2><span class="sub" data-sccount>${sc.done} of ${sc.total} done</span>`;
  const sched=collapse?`<details class="card td-sched o-sched" data-sched ${open?"open":""}><summary class="card-h">${schedHead}</summary><ol class="tl">${tl}</ol></details>`
    :`<section class="card td-sched o-sched ${pre?"ro":""}"><div class="card-h">${schedHead}</div><ol class="tl">${tl}</ol></section>`;

  return `<div class="tdv">
  <div class="phead">
    <button class="icon-btn" data-act="day" data-v="-1" aria-label="Previous day">${ICON.l}</button>
    <div class="t"><div class="eyebrow">${isT?"Today":k<tk?"Past day":"Upcoming"}</div><h1>${nice(k)}</h1></div>
    ${isT?"":`<button class="btn sec sm" data-act="go" data-v="${tk}">Go to today</button>`}
    <span class="icon-btn datepick" title="Pick a date">${ICON.cal}<input type="date" id="jump" aria-label="Jump to date" value="${k}"></span>
    <button class="icon-btn" data-act="day" data-v="1" aria-label="Next day">${ICON.r}</button>
  </div>
  ${(()=>{const f=!pre&&typeof currentFocus==="function"?currentFocus(k):null;return f?`<div class="callout weekfocus" data-weekfocus><div><span class="eyebrow">Week ${f.week} focus</span><br><b>${esc(f.focus)}</b></div></div>`:"";})()}
  <div class="strip">${strip}</div>
  <div class="tdgrid ${pre?"is-pre":""} ${isT&&!pre?"is-today":""}">
    <div class="gl">
      ${isT&&!pre?`<section class="card focus o-focus" aria-label="What to do now">${brief}<div data-focus>${tdFocusHTML}</div></section>
      <div class="qa o-quick" data-quick>${tdQuickHTML(k)}</div>`:`<div class="o-brief">${brief}</div>`}
      ${setup?`<div class="o-setup">${setup}</div>`:""}${bf?`<div class="o-bf">${bf}</div>`:""}
      ${sched}
    </div>
    <div class="gr">
      ${pre?"":`<section class="card o-log"><div class="card-h"><h2>Log</h2></div><div class="nums">${nums.join("")}</div></section>`}
      ${man.length?`<section class="card o-std"><div class="card-h"><h2>Daily standards</h2><span class="sub" data-hcount></span></div><ul class="hl">${hb}</ul></section>`:""}
      <section class="card o-notes"><div class="card-h"><h2><label for="f-notes">Notes</label></h2></div><div class="card-b"><textarea id="f-notes" data-f="notes" placeholder="Energy, hunger, how the lifts felt, anything off-plan…">${esc(d.notes)}</textarea></div></section>
    </div>
  </div></div>`;
}
function chk(it,done,k){
  if(it.auto)return `<span class="chk auto ${done?"on":""}" role="img" aria-label="${done?"Done, from your log":"Fills in from your log"}">${CHECK}</span>`;
  return `<button class="chk ${done?"on":""}" data-act="check" data-v="${it.id}" aria-pressed="${done}" aria-label="Mark ${esc(it.title)} ${done?"not done":"done"}">${CHECK}</button>`;
}
/* in-place update of everything derived from the day's data (no DOM replacement of inputs) */
function patch(){
  if(S.tab!=="today")return;
  const k=S.date;
  tdSyncPlan(k);
  const d=getDay(k),sc=score(k),c4=core4(k),act=document.activeElement;
  const pre=planFor(k).pre;
  if(!pre)allItems(k).forEach(it=>{document.querySelectorAll(`.tdv [data-item="${it.id}"]`).forEach(el=>{const done=isDone(it,d,k);
    el.classList.toggle("done",done);const c=el.querySelector(".chk");if(c){c.classList.toggle("on",done);if(c.tagName==="BUTTON"){c.setAttribute("aria-pressed",done);c.setAttribute("aria-label",`Mark ${it.title} ${done?"not done":"done"}`);}else c.setAttribute("aria-label",done?"Done, from your log":"Fills in from your log");}});});
  /* Core 4 */
  CORE4.forEach(([id])=>{const on=!!(c4&&c4.keys[id]);const s=document.querySelector(`[data-seg="${id}"]`);if(s)s.setAttribute("stroke",on?"var(--good)":"var(--line)");const ch=document.querySelector(`[data-c4="${id}"]`);if(ch)ch.classList.toggle("on",on);const dt=document.querySelector(`[data-c4d="${id}"]`);if(dt)dt.classList.toggle("on",on);});
  const rn=$("[data-ringnum]");if(rn)rn.textContent=`${c4?c4.met:0}/4`;
  const ring=$("[data-ring]");if(ring)ring.setAttribute("aria-label",`Core 4: ${c4?c4.met:0} of 4 met. Show details`);
  tdQuickRefresh();
  const scc=$("[data-sccount]");if(scc)scc.textContent=`${sc.done} of ${sc.total} done`;
  const sub=$("[data-c4sub]");if(sub){const h=tdC4Sub(k,sc,c4);if(sub.innerHTML!==h)sub.innerHTML=h;}
  const bar=document.querySelector(`[data-bar="${k}"]`);if(bar){const p=c4?c4.pct:null;bar.style.width=(p??0)+"%";bar.style.background=tdBarC(k,p);}
  /* log fields */
  ["weight","cal","protein","steps","water","sleep","waist"].forEach(f=>{
    const el=document.querySelector(`[data-nf="${f}"]`);if(!el)return;
    el.classList.remove("hit","miss");if(d[f]!=null&&f!=="weight"&&f!=="waist")el.classList.add(autoVal(tdHit[f],d,k)?"hit":"miss");
    if((f==="weight"||f==="waist")&&d[f]>0)el.classList.add("hit");
    const tg=el.querySelector("[data-tgt]");if(tg){const t=tdTgt(f,d,k);if(tg.textContent!==t)tg.textContent=t;}
    const inp=el.querySelector("input[data-f]");
    if(inp&&inp!==act&&!el.classList.contains("bad")){const want=d[f]==null?"":String(d[f]);if(inp.value!==want&&!(inp.value!==""&&+inp.value===d[f]))inp.value=want;}
  });
  /* calorie source */
  const plan=d.calSrc==="plan"&&d.cal!=null, tot=d.calSrc==="manual"?tdPlanTotals(k,d):null;
  const sc1=document.querySelector('[data-src="cal"]');
  if(sc1){const h=tot&&tot.n?`<button class="lnk" data-act="tdplan">Use plan totals</button>`:"";if(sc1.innerHTML!==h)sc1.innerHTML=h;}
  /* quick chips */
  const hc=$("[data-hcount]");if(hc){const man=habits(k).filter(h=>!h.auto);hc.textContent=`${man.filter(h=>isDone(h,d,k)).length} of ${man.length} done`;}
  tdTick();
}
function lastWeightBefore(k){
  const ks=Object.keys(S.days).filter(x=>x<k&&S.days[x].weight>0).sort();
  if(ks.length){const x=ks[ks.length-1];return {v:+S.days[x].weight,k:x};}
  const st=ST();return st.startWeight!=null&&k>=st.start?{v:+st.startWeight,k:st.start,start:true}:null;
}

/* ---------- actions ---------- */
function tdSetField(k,f,v){const d=ensureDay(k);d[f]=v;saveDay(k);patch();}
function tdTitle(k,id){const r=allItems(k).find(x=>x.id===id);return r?r.title:"Item";}
ACTIONS.tddone=(el)=>{const k=S.date,id=el.dataset.v,d=ensureDay(k);if(d.checks[id])return;d.checks[id]=true;saveDay(k);patch();
  toast(`${tdTitle(k,id)}: done`,()=>{const dd=ensureDay(k);dd.checks[id]=false;saveDay(k);if(S.date===k)patch();});};
function tdSetSW(v){const st=ST(),[lo,hi]=SET_LIMITS.startWeight;if(!(v>=lo&&v<=hi)){toast(`Enter a weight between ${lo} and ${hi} lb`);return false;}
  const was=st.startWeight;st.startWeight=Math.round(v*10)/10;saveSet();rerenderKeepScroll();
  toast(`Starting weight set to ${fnum(st.startWeight)} lb`,()=>{st.startWeight=was;saveSet();rerenderKeepScroll();});return true;}
ACTIONS.tdsw=(el)=>tdSetSW(+el.dataset.v);
ACTIONS.tdswsave=()=>{const i=$("[data-sw]");if(i&&i.value!=="")tdSetSW(+i.value);else if(i)i.focus();};
ACTIONS.tdsetup=(el)=>{const st=ST(),id=el.dataset.v,su=Object.assign({},tdSU());su[id]=!su[id];st.setup=su;saveSet();rerenderKeepScroll();};
ACTIONS.tdopen=(el)=>{S.trainFocus=el.dataset.v;setTab("train");};
ACTIONS.tdgo=(el)=>{const i=document.getElementById("f-"+el.dataset.v);if(i){i.scrollIntoView({behavior:"smooth",block:"center"});i.focus({preventScroll:true});}};
ACTIONS.tdedit=()=>{const i=$("#f-cal");if(i){i.focus();i.select&&i.select();}};
ACTIONS.tdplan=()=>{const k=S.date,d=ensureDay(k);d.calSrc="plan";d.cal=null;d.protein=null;tdSyncPlan(k);saveDay(k);patch();toast("Calories and protein now follow your ticked meals");};
ACTIONS.tdwater=(el)=>{const k=S.date,d=ensureDay(k),v=+el.dataset.v,prev=d.water;d.water=Math.min(DAY_LIMITS.water[1],(prev||0)+v);tdLastW={k,prev,v};saveDay(k);patch();};
ACTIONS.tdwundo=()=>{if(!tdLastW||tdLastW.k!==S.date)return;const d=ensureDay(S.date);d.water=tdLastW.prev??null;tdLastW=null;saveDay(S.date);patch();};
ACTIONS.tdsleep=(el)=>{tdQA=null;tdSetField(S.date,"sleep",+el.dataset.v);};
ACTIONS.tdsteps=(el)=>{tdQA=null;tdSetField(S.date,"steps",+el.dataset.v);};
ACTIONS.tdfoods=(el)=>{const id=el.dataset.v,p=document.querySelector(`[data-foods="${id}"]`);if(!p)return;const open=p.hidden;p.hidden=!open;el.setAttribute("aria-expanded",open);if(open)tdOpen.add(id);else tdOpen.delete(id);};
ACTIONS.tdaltclear=(el)=>{const k=S.date,d=ensureDay(k),id=el.dataset.v;if(!d.mealsAlt||!d.mealsAlt[id])return;const was=d.mealsAlt[id];delete d.mealsAlt[id];saveDay(k);rerenderKeepScroll();
  toast("Back to the planned meal",()=>{const dd=ensureDay(k);dd.mealsAlt=dd.mealsAlt||{};dd.mealsAlt[id]=was;saveDay(k);rerenderKeepScroll();});};
function tdSaveW(){
  const i=$("#fx-weight");if(!i)return;const n=+i.value,[lo,hi]=DAY_LIMITS.weight;
  if(i.value===""||isNaN(n)||n<lo||n>hi){i.setAttribute("aria-invalid","true");toast(`Enter a weight between ${lo} and ${hi} lb`);return;}
  i.blur();tdSetField(S.date,"weight",n);toast(`Weight saved: ${n} lb`);
}
ACTIONS.tdw=tdSaveW;
document.addEventListener("keydown",e=>{const t=e.target;if(e.key!=="Enter"||!t||!t.matches)return;
  if(t.matches("[data-fw]")){e.preventDefault();tdSaveW();}else if(t.matches("[data-sw]")){e.preventDefault();ACTIONS.tdswsave();}else if(t.matches("[data-qa]")){e.preventDefault();ACTIONS.tdqasave();}});
/* remember whether the full schedule is open; show raw numbers while editing */
document.addEventListener("toggle",e=>{const t=e.target;if(t&&t.matches&&t.matches("details[data-sched]")){try{localStorage.setItem(TD_SKEY,t.open?"1":"0");}catch(_){}}},true);
document.addEventListener("focusin",e=>{const n=e.target&&e.target.closest&&e.target.closest(".tdv .nf,.tdv .bf-f");if(n)n.classList.remove("fmt");});
document.addEventListener("focusout",e=>{if(e.target&&e.target.closest&&e.target.closest(".tdv .nf,.tdv .bf-f")&&S.tab==="today")setTimeout(()=>{if(S.tab==="today")patch();},0);});
ON_INPUT.push(t=>{
  if(t.matches&&(t.matches("[data-fw]")||t.matches("[data-sw]")||t.matches("[data-qa]"))){t.removeAttribute("aria-invalid");return true;}
  if(t.dataset&&t.dataset.yf){
    const f=t.dataset.yf,y=addDays(todayKey(),-1),w=t.closest(".bf-f");
    if(t.value===""){const d=ensureDay(y);d[f]=null;saveDay(y);w&&w.classList.remove("hit","bad");return true;}
    const n=+t.value,[lo,hi]=DAY_LIMITS[f],ok=!isNaN(n)&&n>=lo&&n<=hi;
    t.setAttribute("aria-invalid",!ok);w&&w.classList.toggle("bad",!ok);w&&w.classList.toggle("hit",ok);
    if(ok){const d=ensureDay(y);d[f]=n;saveDay(y);}
    return true;
  }
  if(t.dataset&&t.dataset.cf){
    const f=t.dataset.cf,w=t.closest(".bf-f"),d=ensureDay(S.date);
    if(t.value===""){d[f]=null;saveDay(S.date);w&&w.classList.remove("hit","bad");patch();return true;}
    const n=+t.value,[lo,hi]=DAY_LIMITS[f],ok=!isNaN(n)&&n>=lo&&n<=hi;
    t.setAttribute("aria-invalid",!ok);w&&w.classList.toggle("bad",!ok);w&&w.classList.toggle("hit",ok);
    if(ok){d[f]=n;saveDay(S.date);patch();}
    return true;
  }
  if(t.dataset&&(t.dataset.f==="cal"||t.dataset.f==="protein")){const d=ensureDay(S.date);if(d.calSrc!=="manual"){d.calSrc="manual";}}
  return false;
});
/* 60-second refresh while Today (for today's date) is on screen */
AFTER_RENDER.push(tab=>{
  clearInterval(tdTimer);tdTimer=null;
  if(tab==="today")tdTimer=setInterval(()=>{if(S.tab!=="today"){clearInterval(tdTimer);tdTimer=null;return;}if(!document.hidden)tdTick();},60000);
});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&S.tab==="today")tdTick();});
