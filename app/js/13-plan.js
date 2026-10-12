/* =========================================================
   PLAN & SETTINGS (owned by the Progress/Plan builder)
   ========================================================= */
const PL_TIME_KEYS=["wake","workStart","workEnd","train","satTrain","weekendWake","bed"];
const PL_TIME_DEF={wake:"05:30",workStart:"07:30",workEnd:"16:30",train:"17:00",satTrain:"08:30",weekendWake:"06:30",bed:"22:00"};
const plTime=f=>{const v=ST()[f];return toMin(v)!=null?v:PL_TIME_DEF[f];};
/* a typical weekday (Tuesday of Week 2: base targets, no diet break) */
const plTypicalDay=()=>addDays(ST().start,8);
const PL_MEAL_ORDER=["breakfast","msnack","lunch","shake","dinner","snack"];

function plMealTimes(k){
  const out={};
  try{(timeline(k)||[]).forEach(r=>{if(r&&r.kind==="meal"&&r.id)out[r.id]={t:r.t,title:r.title};});}catch(e){}
  return out;
}
function mealPreview(){
  const k=plTypicalDay(), tg=peTargets(k), m=buildMeals(tg), t=m.total, diff=Math.round(t.k-tg.cal), tm=plMealTimes(k);
  const ids=Object.keys(m.meals).sort((a,b)=>{
    const ta=tm[a]?tm[a].t:1e4+PL_MEAL_ORDER.indexOf(a), tb=tm[b]?tm[b].t:1e4+PL_MEAL_ORDER.indexOf(b);return ta-tb;});
  const pct=f=>tg[f]?(t[f]-tg[f])/tg[f]*100:0, NM={p:"protein",c:"carbs",f:"fat"};
  const off=["p","c","f"].filter(f=>Math.abs(pct(f))>10);
  const offTxt=off.map(f=>`${NM[f]} ${Math.round(t[f])} g vs ${tg[f]} g (${pct(f)>0?"+":"−"}${Math.abs(Math.round(pct(f)))}%)`);
  const food=x=>x.items.filter(i=>i.k).map(i=>i.qty+" "+String(i.label).split(" (")[0].split(",")[0].toLowerCase()).join(", ");
  return `<div class="tablebox"><table class="meal-t"><thead><tr><th>Meal</th><th>Main portions</th><th>Kcal</th><th>P</th><th>C</th><th>F</th></tr></thead><tbody>
    ${ids.map(id=>{const x=m.meals[id];return `<tr data-meal="${esc(id)}"><td><b>${esc(tm[id]&&tm[id].title?String(tm[id].title).replace(/,.*$/,"").replace(/ \(.*\)$/,""):x.name)}</b>${tm[id]?`<span class="mt">${fmt12(tm[id].t)}</span>`:""}</td><td class="pf">${esc(food(x))}</td><td>${Math.round(x.tot.k)}</td><td>${Math.round(x.tot.p)}</td><td>${Math.round(x.tot.c)}</td><td>${Math.round(x.tot.f)}</td></tr>`;}).join("")}
    <tr class="tot"><td><b>Total</b></td><td class="pf ${off.length?"off":"muted"}">${off.length?"Off target: "+offTxt.map(x=>x.split(" (")[0].split(" ")[0]+" "+x.split("(")[1].replace(")","")).join(", "):Math.abs(diff)<=60?"Matches your targets":(diff>0?"+":"")+diff+" kcal vs target (rounding)"}</td><td><b>${Math.round(t.k)}</b></td><td><b>${Math.round(t.p)}</b></td><td><b>${Math.round(t.c)}</b></td><td><b>${Math.round(t.f)}</b></td></tr></tbody></table></div>${off.length?`<div class="callout warn meal-off" role="status"><div><b>The meal plan can't match these targets.</b> ${offTxt.join("; ")}. Portions are built from fixed foods with floors, so targets this far apart don't fit. Check the macros in Settings, or use Cut/Add 150 to move calories and carbs together.</div></div>`:""}`;
}
/* extra water on training days: B's constant, else derived from targetsFor (Mon vs Sun) */
function plTrainWater(){
  if(typeof TRAIN_DAY_WATER==="number")return TRAIN_DAY_WATER;
  try{const m=addDays(ST().start,7);return Math.max(0,peTargets(m).water-peTargets(addDays(m,6)).water);}catch(e){return 0;}
}
function targetsCard(){
  const st=ST(), mk=st.p*4+st.c*4+st.f*9;
  const bk=addDays(st.start,42), be=addDays(st.start,48), db=peTargets(bk);
  const sel=S.date, sp=planFor(sel), stg=peTargets(sel);
  const selNote=sp.inProg&&stg.dietBreak?`<div class="callout warn"><div><b>${nice(sel)} is in the diet break.</b> That day's target is ${stg.cal.toLocaleString()} kcal with ${stg.c} g carbs. Today and the meal plan use it automatically.</div></div>`:"";
  return `<div class="target-big"><b class="num" data-tv="cal">${st.cal.toLocaleString()}</b><span class="muted">kcal / day · base target</span></div>
    <div class="macros"><div><span>Protein</span><b data-tv="p">${st.p} g</b></div><div><span>Carbs</span><b data-tv="c">${st.c} g</b></div><div><span>Fat</span><b data-tv="f">${st.f} g</b></div></div>
    <p class="note" data-tv="mk">Macros add up to ${mk.toLocaleString()} kcal${Math.abs(mk-st.cal)>75?` · ${Math.abs(mk-st.cal)} ${mk>st.cal?"over":"under"} target`:""}. Floor ${FLOOR.toLocaleString()}, ceiling ${CEIL.toLocaleString()}. Steps ${(+st.steps).toLocaleString()} · water ${st.water} oz (+${plTrainWater()} on training days).</p>
    <div class="dbreak"><span class="badge warn">Week 7</span><p><b>Diet break, ${short(bk)} – ${short(be)}:</b> ${db.cal.toLocaleString()} kcal, ${db.c} g carbs. Protein and fat stay the same. Expect the scale to rise 1–3 lb from stored carbs and water; it comes off in Week 8.</p></div>
    ${selNote}`;
}
/* ---------- settings validation ---------- */
function plIssues(){
  const m=f=>toMin(plTime(f)), o={};
  const wake=m("wake"), tr=m("train"), bed0=m("bed"), bed=bed0+(bed0<=wake?1440:0);
  if(tr<=wake)o.train="Training must be after you wake up.";
  else if(tr<wake+60)o.train="Leave at least an hour after waking to eat before training.";
  else if(tr>m("workStart")&&tr<m("workEnd"))o.train="This falls inside work hours. Check the work times.";
  if(!o.train&&bed<=tr+60)o.bed="Bedtime must be after training finishes (at least 1 hour later).";
  if(m("workEnd")<=m("workStart"))o.workEnd="Work end must be after work start.";
  if(m("workStart")<wake)o.workStart="Work can't start before you wake up.";
  if(PLV.startWarn)o.start=PLV.startWarn;
  if(m("satTrain")<=m("weekendWake"))o.satTrain="Saturday training must be after the weekend wake time.";
  return o;
}
function plPaintIssues(){
  const o=plIssues();
  document.querySelectorAll("[data-vmsg]").forEach(el=>{const f=el.dataset.vmsg, msg=o[f]||"";el.textContent=msg;el.hidden=!msg;
    el.classList.toggle("warnmsg",f==="start");
    const inp=document.getElementById("s-"+f);if(inp&&f!=="start"){if(msg)inp.setAttribute("aria-invalid","true");else inp.removeAttribute("aria-invalid");}});
}
/* FTP: optional watts; empty clears it (B's normSet owns the key) */
ON_CHANGE.push(t=>{
  if(!(t.dataset&&t.dataset.set==="ftp"))return false;
  const st=ST();
  if(t.value===""){st.ftp=null;saveSet();patchPlan();return true;}
  const n=Math.round(+t.value);
  if(isNaN(n)){t.value=st.ftp??"";return true;}
  const v=Math.min(600,Math.max(50,n));
  if(v!==n)toast(`FTP must be 50–600 W. Set to ${v}.`);
  st.ftp=v;t.value=v;saveSet();patchPlan();toast(`FTP ${v} W saved. Zones updated.`);return true;
});
/* start date: moving it re-numbers every logged day, so warn inline and offer Undo */
const PLV={startWarn:""};
function plLogged(){return Object.keys(S.days).filter(k=>{const d=S.days[k];return d&&(d.weight>0||d.cal>0||d.protein>0||d.steps>0||Object.values(d.checks||{}).some(Boolean)||Object.keys(d.lifts||{}).length);}).sort();}
const plWkLabel=k=>{const p=planFor(k);return p.pre?"before the start":p.post?"after Week 12":`Week ${p.week}`;};
ON_CHANGE.push(t=>{
  if(!(t.dataset&&t.dataset.set==="start"))return false;
  const st=ST(), old=st.start;
  if(!validKey(t.value)){t.value=old;return true;}
  const picked=t.value, m=mondayOf(picked);
  t.value=m;
  if(m===old){PLV.startWarn="";if(picked!==m)toast(`Programs start on a Monday. Kept ${nice(m)}.`);return true;}
  const logs=plLogged(), first=logs[0], last=logs[logs.length-1];
  const was=first?plWkLabel(first):"";
  st.start=m; saveSet();
  if(logs.length){
    const now=plWkLabel(first), out=logs.filter(k=>planFor(k).pre||planFor(k).post).length;
    PLV.startWarn=`You have ${logs.length} logged day${logs.length===1?"":"s"} (${short(first)}${last!==first?" – "+short(last):""}). Week numbers shifted: ${short(first)} was ${was}, now ${now}.${out?` ${out} logged day${out===1?" is":"s are"} now outside the 12 weeks.`:""}`;
  }else PLV.startWarn="";
  rerenderKeepScroll();
  const msg=(picked!==m?`Programs start on a Monday. Moved to ${nice(m)}.`:`Program starts ${nice(m)}`)+(logs.length?" Week numbers shifted.":"");
  toast(msg,logs.length?()=>{st.start=old;PLV.startWarn="";saveSet();rerenderKeepScroll();toast(`Start date back to ${nice(old)}`);}:undefined);
  return true;
});
ON_CHANGE.push(t=>{
  const f=t.dataset&&t.dataset.set;
  if(!f||!PL_TIME_KEYS.includes(f))return false;
  const st=ST();
  if(toMin(t.value)==null){t.value=plTime(f);return true;}
  st[f]=t.value; saveSet(); patchPlan();
  return true;
});

function plField(id,f,label,type,attrs,hint){
  const st=ST(), v=type==="time"?plTime(f):(st[f]??"");
  return `<label for="s-${id}">${label}<input id="s-${id}" type="${type}" data-set="${f}" value="${esc(v)}" ${attrs||""}>${hint?`<small class="hint">${hint}</small>`:""}<small class="vmsg" data-vmsg="${f}" role="alert" hidden></small></label>`;
}
function settingsCard(first){
  const st=ST();
  return `<section class="card" id="settings"><div class="card-h"><h2>Settings</h2><span class="sub">Saved when you leave a field</span></div><div class="card-b">
    ${first?`<div class="callout"><div><b>Start here.</b> Enter your starting weight (first morning weigh-in) and check your times. Everything else is set up for you.</div></div>`:""}
    <fieldset class="fs"><legend>Program</legend><div class="form">
      ${plField("start","start","Start date (moves to Monday)","date")}
      ${plField("sw","startWeight","Starting weight, lb","number",'step="0.1" inputmode="decimal" placeholder="e.g. 202"')}
      ${plField("goal","goal","Goal weight, lb","number",'step="0.5" inputmode="decimal"')}
    </div></fieldset>
    <fieldset class="fs"><legend>Weekdays</legend><div class="form">
      ${plField("wake","wake","Wake time","time")}
      ${plField("workStart","workStart","Work starts","time")}
      ${plField("workEnd","workEnd","Work ends","time")}
      ${plField("train","train","Training time","time","","Mon–Fri, after work")}
      ${plField("bed","bed","Bedtime","time")}
    </div></fieldset>
    <fieldset class="fs"><legend>Weekends</legend><div class="form">
      ${plField("weekendWake","weekendWake","Weekend wake time","time")}
      ${plField("satTrain","satTrain","Saturday training","time","","Intervals, then the long walk")}
    </div></fieldset>
    <fieldset class="fs"><legend>Daily targets</legend><div class="form">
      ${plField("cal","cal","Calories","number",'step="10" inputmode="numeric"')}
      ${plField("p","p","Protein, g","number",'inputmode="numeric"')}
      ${plField("c","c","Carbs, g","number",'inputmode="numeric"')}
      ${plField("f","f","Fat, g","number",'inputmode="numeric"')}
      ${plField("steps","steps","Daily steps","number",'step="500" inputmode="numeric"')}
      ${plField("water","water","Water, oz","number",'step="8" inputmode="numeric"',`Training days add ${plTrainWater()} oz`)}
    </div></fieldset>
    <fieldset class="fs"><legend>Peloton</legend><div class="form">
      ${plField("ftp","ftp","FTP, watts","number",'step="1" inputmode="numeric" placeholder="After Week 2 test"',"From the Week 2 FTP test; sets your zones")}
    </div></fieldset>
  </div></section>`;
}
/* ---------- reference ---------- */
function weekRef(){
  const st=ST(), mon=addDays(st.start,7);
  let h="";
  for(let i=0;i<7;i++){
    const k=addDays(mon,i), pl=planFor(k); let rows=[];
    try{rows=timeline(k)||[];}catch(e){}
    const wake=rows.find(r=>r.id==="wake");
    const tr=rows.filter(r=>r.kind==="train"||r.kind==="run");
    const meals=rows.filter(r=>r.kind==="meal");
    h+=`<div class="wr-d"><b>${DOWN[pl.dow]}</b><span>${esc((pl.sch&&pl.sch.label)||"")}</span></div><div class="wr-b">
      <p>${wake?`<span class="mt">${fmt12(wake.t)}</span> Wake. `:""}${tr.map(r=>`<span class="mt">${fmt12(r.t)}</span> ${esc(r.title)}`).join(" · ")||"No training"}</p>
      <p class="muted">Meals: ${meals.map(r=>`${esc(String(r.title).replace(/ \(.*\)$/,"").replace(/,.*$/,""))} ${fmt12(r.t).replace(":00","")}`).join(", ")}</p></div>`;
  }
  return `<div class="wkref">${h}</div>`;
}
/* ---------- round 4: program, conditioning, science, add-ons (generated from B's data) ---------- */
const PL_EQUIP=[
  ["FT2","Inspire FT2 functional trainer","2:1 cables, about 85 lb max per handle (≈170 lb using both); Smith bar, pull-up bar, rope, D-handles, straight and EZ bars, ankle strap."],
  ["Rack","Rogue power rack + barbell","J-hooks, safeties and pull-up bar; squats, RDLs, incline press."],
  ["DB","Dumbbells","Assumed 5–80+ lb or adjustables."],
  ["Bench","Adjustable bench","Flat to about 85°, with a low 15° setting."],
  ["Hyper Pro","Freak Athlete Hyper Pro","Nordic, reverse Nordic, 45°/90° back extension, band reverse hyper, split-squat roller."],
  ["Tread","Peloton Tread","0–12.5% incline; incline walks and Saturday run/walk intervals."],
  ["Bike","Peloton Bike","Power Zone classes and the FTP test on Wednesdays."]
];
const plWk=()=>{const w=planFor(todayKey()).week;return w>=1&&w<=12?w:1;};
function plWarmLabel(w){return {upper:"Upper warm-up",lower:"Lower warm-up",vt:"V-taper warm-up"}[w]||"Warm-up";}
/* workout length for a week: B's canonical durationFor (same number Today and Train show) */
function plDur(id,week){if(typeof durationFor==="function"){try{return durationFor(id,week);}catch(e){}}const W=WORKOUTS[id];return W&&W.durationEst?String(W.durationEst.base||""):"";}
function programHTML(){
  if(typeof WORKOUTS!=="object"||typeof blockFor!=="function")return `<p class="note">Program details load with the program data.</p>`;
  const cw=plWk(), st=ST();
  // blocks
  const seen=[];for(let w=1;w<=12;w++){const b=blockFor(w);if(!seen.length||seen[seen.length-1].name!==b.name)seen.push(Object.assign({from:w,to:w},b));else seen[seen.length-1].to=w;}
  const blocks=`<div class="tablebox"><table class="ref-t blk-t stack-t"><thead><tr><th>Weeks</th><th>Block</th><th>Reps in reserve</th><th>What changes</th></tr></thead><tbody>
    ${seen.map(b=>`<tr class="${b.from<=cw&&cw<=b.to?"cur":""}${b.name==="Deload"?" db":""}"><td class="sk-h">${b.from===b.to?`Week ${b.from}`:`Weeks ${b.from}–${b.to}`}<span class="mt">${short(addDays(st.start,(b.from-1)*7))}</span></td><td data-l="Block"><b>${esc(b.name)}</b></td><td data-l="RIR">${esc(b.rir)}</td><td class="tx" data-l="Changes">${esc(b.note)}</td></tr>`).join("")}</tbody></table></div>`;
  // split
  const dur=id=>plDur(id,cw)+" this week";
  const split=[1,2,3,4,5,6,0].map(d=>{const s=SCHED[d]||{};const parts=[];
    const iv=s.intervals?(s.intervalMode==="bike"?"Peloton Bike Power Zone class (~30 min)":"Tread run/walk intervals (8:30 AM)"):"";
    if(s.intervals&&s.cardioFirst)parts.push(iv);
    if(s.lift&&WORKOUTS[s.lift])parts.push(`<b>${esc(WORKOUTS[s.lift].name)}</b> · ${esc(WORKOUTS[s.lift].focus)} <span class="muted">${esc(dur(s.lift))}</span>`);
    if(s.intervals&&!s.cardioFirst)parts.push(iv);
    if(s.walkCond)parts.push(`incline walk (${typeof COND!=="undefined"&&COND[cw]?esc(COND[cw].walk.text)+" this week":"by week"})`);else if(s.walk)parts.push(esc(parts.length?s.walk.charAt(0).toLowerCase()+s.walk.slice(1):s.walk));
    return `<div class="wr-d"><b>${DOWN[d]}</b><span>${esc(s.label||"")}</span></div><div class="wr-b"><p>${parts.join(" → ")||"Rest"}</p></div>`;}).join("");
  const sets=typeof WEEKLY_SETS==="object"?`<div class="tablebox"><table class="ref-t"><thead><tr><th>Muscle</th><th>Hard sets a week (Weeks 1–3 → Build/Push)</th></tr></thead><tbody>${Object.keys(WEEKLY_SETS).map(m=>`<tr><td>${esc(m)}</td><td class="tx">${esc(WEEKLY_SETS[m])}</td></tr>`).join("")}</tbody></table></div>`:"";
  const eq=`<ul class="eq">${PL_EQUIP.map(([k,n,d])=>`<li><span class="badge">${esc(k)}</span><div><b>${esc(n)}</b><p class="muted">${esc(d)}</p></div></li>`).join("")}</ul>`;
  return `<p>Five lifting sessions built around a V-taper: side delts, lats and upper chest get the most work, loaded at long muscle lengths. You're in <b>Week ${cw} · ${esc(blockFor(cw).name)}</b>.</p>
    <h4>12-week blocks</h4>${blocks}
    ${typeof PROGRESSION==="string"?`<p><b>Progression (double progression):</b> ${esc((s=>s.charAt(0).toUpperCase()+s.slice(1))(PROGRESSION.replace(/^Double progression:\s*/,"")))}</p>`:""}
    ${typeof TIME_SAVER==="string"?`<p class="note">${esc(TIME_SAVER)}</p>`:""}
    <h4>Weekly split</h4><div class="wkref">${split}</div>
    ${sets?`<h4>Weekly sets per muscle</h4>${sets}`:""}
    <h4>Built for your equipment</h4>${eq}`;
}
function libraryHTML(){
  if(typeof WORKOUTS!=="object")return "";
  const cw=plWk(), sf=(e)=>typeof setsFor==="function"?setsFor(e,cw):e.s;
  const warm=w=>typeof WARMUPS==="object"&&WARMUPS[w.warmup]?`<div class="lib-warm"><b>${plWarmLabel(w.warmup)} (5 min):</b> ${WARMUPS[w.warmup].map(esc).join(" · ")}${w.ramp&&typeof RAMP!=="undefined"?`<br><b>Ramp sets</b> before the first ${esc((WORKOUTS&&exByIdPl(w.ramp)||{}).n||"compound").toLowerCase()} set: ${RAMP.map(esc).join(" → ")} → working sets.`:""}</div>`:"";
  return `<p>Every exercise, grouped by workout, with its setup, two cues and swaps. Sets shown are for Week ${cw}; the Train tab logs them.</p>`+
    Object.keys(WORKOUTS).map(id=>{const W=WORKOUTS[id];const dayN=SCHED&&Object.keys(SCHED).find(d=>SCHED[d].lift===id);
      return `<details class="lib"><summary><span><b>${esc(W.name)}</b> · ${esc(W.focus)}</span><span class="muted">${dayN!=null?DOWL[dayN]:""}${plDur(id,cw)?" · "+esc(plDur(id,cw)):""}</span></summary>${warm(W)}
      <ol class="lib-ex">${W.ex.map(e=>`<li><div class="lib-h"><b>${esc(e.n)}</b>${e.pair?`<span class="badge acc">${esc(e.pair)}</span>`:""}${e.priority?`<span class="badge good">Priority</span>`:""}${e.optional?`<span class="badge">Optional</span>`:""}</div>
        <p class="rx">${sf(e)} × ${esc(e.r)} · rest ${esc(e.rest)}${e.eq&&e.eq.length?` · ${e.eq.map(esc).join(", ")}`:""}</p>
        ${e.setup?`<p><b>Setup:</b> ${esc(e.setup)}</p>`:""}
        ${e.cues&&e.cues.length?`<ul class="cues">${e.cues.map(c=>`<li>${esc(c)}</li>`).join("")}</ul>`:""}
        ${e.alts&&e.alts.length?`<p class="muted"><b>Swaps:</b> ${e.alts.map(esc).join(" · ")}</p>`:""}</li>`).join("")}</ol></details>`;}).join("");
}
function exByIdPl(id){if(typeof exById==="function")return exById(id);for(const w of Object.values(WORKOUTS||{})){const e=w.ex.find(x=>x.id===id);if(e)return e;}return null;}
function zonesHTML(){
  const ftp=+ST().ftp>0?+ST().ftp:null;
  const bands=typeof ZONE_BANDS!=="undefined"?ZONE_BANDS:[[1,0,.55,"Active recovery"],[2,.56,.75,"Endurance"],[3,.76,.90,"Tempo"],[4,.91,1.05,"Threshold"],[5,1.06,1.20,"VO2 max"],[6,1.21,1.50,"Anaerobic"],[7,1.51,null,"Neuromuscular"]];
  const Z=ftp&&typeof ZONES==="function"?ZONES(ftp):null;
  return `<div class="tablebox"><table class="ref-t z-t"><thead><tr><th>Zone</th><th>Purpose</th><th>% of FTP</th><th>${ftp?`Watts at FTP ${ftp}`:"Watts"}</th></tr></thead><tbody>
    ${bands.map(([z,a,b,l],i)=>{const x=Z&&Z[i];const pct=b==null?`over ${Math.round(a*100)-1}%`:a===0?`under ${Math.round(b*100)}%`:`${Math.round(a*100)}–${Math.round(b*100)}%`;
      return `<tr><td><b>Z${z}</b></td><td>${esc(l)}</td><td>${pct}</td><td>${x?(x.hi==null?`${x.lo}+ W`:x.lo===0?`under ${x.hi} W`:`${x.lo}–${x.hi} W`):"—"}</td></tr>`;}).join("")}</tbody></table></div>
    ${ftp?"":`<p class="note">Set your FTP in Settings after the Week 2 test to see your zones in watts.</p>`}`;
}
function condHTML(){
  if(typeof COND==="undefined"||!Array.isArray(COND))return `<p class="note">Conditioning details load with the program data.</p>`;
  const cw=plWk(), st=ST();
  const rows=COND.map((c,w)=>c?`<tr class="${w===cw?"cur":""}${w===7?" db":""}"><td class="sk-h"><b><span class="ph-only">Week </span>${w}</b><span class="mt">${short(addDays(st.start,(w-1)*7))}</span></td><td class="tx" data-l="Walk">${esc(c.walk.text)}</td><td class="tx" data-l="Wed bike">${esc(c.wed.class)}</td><td class="tx" data-l="Sat tread">${esc(c.sat.text)}</td></tr>`:"").join("");
  return `<p>Mostly easy, low-impact work so it doesn't eat into your lifting: incline walks after Mon/Tue/Thu/Fri lifts, one Peloton Bike session on Wednesday before the V-taper work, and a conservative run/walk on Saturday morning.</p>
    <div class="tablebox"><table class="ref-t cond-t stack-t"><thead><tr><th>Wk</th><th>Incline walk (Mon/Tue/Thu/Fri)</th><th>Wed · Peloton Bike</th><th>Sat · Tread run/walk</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h4>Finding the classes</h4><ul>
      <li><b>Wednesday bike:</b> ${esc(typeof PZ_FILTER==="string"?PZ_FILTER:"Cycling › Class Type › Power Zone")}. In Week 7 use Low Impact.</li>
      <li><b>Saturday tread:</b> ${esc(typeof RUN_FILTER==="string"?RUN_FILTER:"Running › Class Type › Walk + Run")}.</li>
      <li><b>Incline walks:</b> Tread "Just Walk", or Walking › Power Walk / Hike. ${esc(typeof WALK_NOTE==="string"?WALK_NOTE:"")}</li>
      <li><b>Saturday pace:</b> ${esc(typeof RUN_NOTE==="string"?RUN_NOTE:"Run 5.0–5.5 mph, walk 3.3–3.5 mph at 1% incline.")}</li>
      <li><b>No class?</b> The Train timer has a no-class version of each Wednesday ride: 5 min easy, short hard efforts with easy recoveries, 5 min cool-down.</li></ul>
    <h4>Power Zones and FTP</h4>
    <p>FTP (functional threshold power) is roughly the highest output in watts you could hold for an hour. Peloton sets it at about 95% of your average output in a 20-minute all-out test, then colors the zone bar from it. Output is cadence × resistance, so ride by the zone bar, not the instructor's resistance cue. ${esc(typeof PZ_NOTE==="string"?PZ_NOTE.replace(/^Ride your zone bar, not the instructor's resistance cue\.\s*/,""):"")}</p>
    <p><b>Test:</b> Week 2 Wednesday (${short(addDays(st.start,9))}). <b>Retest:</b> Week 8 Wednesday (${short(addDays(st.start,51))}), fresh after the deload.</p>
    <div data-zones>${zonesHTML()}</div>`;
}
const PL_SCIENCE=[{"id": "rate-of-loss", "title": "How fast to lose weight", "takeaway": "Losing weight slowly lets you keep, or even gain, muscle while you get leaner.", "rule": "Lose 0.5–1% of bodyweight per week. For you that's about 1.0–1.4 lb per week (200 → 188 lb over 12 weeks). Aim for the lower end as you get leaner.", "cites": [{"text": "Helms ER, Aragon AA, Fitschen PJ (2014). Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr 11:20.", "url": "https://doi.org/10.1186/1550-2783-11-20"}, {"text": "Garthe I et al. (2011). Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes. Int J Sport Nutr Exerc Metab 21(2):97–104. Athletes losing 0.7% a week gained 2.1% lean mass; those losing 1.4% a week gained none.", "url": "https://doi.org/10.1123/ijsnem.21.2.97"}]}, {"id": "protein", "title": "Protein: how much and how often", "takeaway": "High protein is the most important dietary protection for muscle during a cut, and spreading it over the day helps.", "rule": "Eat 1.6–2.2 g/kg bodyweight. In a deficit, aim toward 2.3–3.1 g/kg of lean mass. Have 4 or more meals of about 0.4–0.55 g/kg each, which is about 40–50 g per meal for you.", "cites": [{"text": "Helms ER et al. (2014). A systematic review of dietary protein during caloric restriction in resistance trained lean athletes: a case for higher intakes. Int J Sport Nutr Exerc Metab 24(2):127–138.", "url": "https://doi.org/10.1123/ijsnem.2013-0054"}, {"text": "Jäger R et al. (2017). ISSN Position Stand: protein and exercise. J Int Soc Sports Nutr 14:20.", "url": "https://doi.org/10.1186/s12970-017-0177-8"}, {"text": "Morton RW et al. (2018). A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength. Br J Sports Med 52:376–384. Benefits levelled off around 1.62 g/kg/day.", "url": "https://doi.org/10.1136/bjsports-2017-097608"}, {"text": "Schoenfeld BJ, Aragon AA (2018). How much protein can the body use in a single meal for muscle-building? J Int Soc Sports Nutr 15:10.", "url": "https://doi.org/10.1186/s12970-018-0215-1"}]}, {"id": "volume-frequency", "title": "Training volume and frequency", "takeaway": "More hard sets build more muscle, but each extra set adds less. Training each muscle twice a week is the reliable baseline.", "rule": "Do 10–20 hard sets per muscle per week, with the top end for your priority muscles (side delts, lats, upper chest, arms). Train each muscle at least twice a week.", "cites": [{"text": "Schoenfeld BJ, Ogborn D, Krieger JW (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci 35(11):1073–1082.", "url": "https://doi.org/10.1080/02640414.2016.1210197"}, {"text": "Pelland JC et al. (2026). The resistance training dose response: meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gains. Sports Med 56(2):481–505. Covers 67 studies: more volume meant more growth with diminishing returns, and once volume was equal, frequency added little.", "url": "https://sponet.de/sponet/Record/4097139?lng=en"}, {"text": "Schoenfeld BJ, Ogborn D, Krieger JW (2016). Effects of resistance training frequency on measures of muscle hypertrophy. Sports Med 46(11):1689–1697.", "url": "https://doi.org/10.1007/s40279-016-0543-8"}]}, {"id": "proximity-to-failure", "title": "How close to failure", "takeaway": "Muscle growth improves as sets get closer to failure. You don't need to hit failure on every set.", "rule": "Stop most sets 0–3 reps short of failure (RIR 0–3). Take isolation lifts to 0–1 RIR. Keep heavy compound lifts at 1–3 RIR.", "cites": [{"text": "Refalo MC et al. (2023). Influence of resistance training proximity-to-failure on skeletal muscle hypertrophy. Sports Med 53(3):649–665.", "url": "https://doi.org/10.1007/s40279-022-01784-y"}, {"text": "Robinson ZP et al. (2024). Exploring the dose-response relationship between estimated resistance training proximity to failure, strength gain, and muscle hypertrophy. Sports Med 54(9):2209–2231.", "url": "https://doi.org/10.1007/s40279-024-02069-2"}]}, {"id": "long-lengths", "title": "Train muscles at long lengths (the stretch)", "takeaway": "Exercises that load a muscle while it's stretched tend to grow it more.", "rule": "Prefer overhead triceps extensions, deep-stretch flyes, incline curls and long-length lat work. Use full range of motion, emphasising the stretched position. Adding stretched-position partials at the end of a set is optional.", "cites": [{"text": "Maeo S et al. (2023; online 2022). Triceps brachii hypertrophy is substantially greater after elbow extension training performed in the overhead versus neutral arm position. Eur J Sport Sci 23(7). Overhead extensions produced about 40% more triceps growth than pushdowns.", "url": "https://doi.org/10.1080/17461391.2022.2100279"}, {"text": "Pedrosa GF et al. (2022). Partial range of motion training elicits favorable improvements in muscular adaptations when carried out at long muscle lengths. Eur J Sport Sci.", "url": "https://www.researchgate.net/publication/351538891"}, {"text": "Wolf M et al. (2023). Partial vs full range of motion resistance training: a systematic review and meta-analysis. Int J Strength Cond 3(1). Partials at long lengths showed a possible but uncertain advantage; full ROM is a sound default.", "url": "https://doi.org/10.47206/ijsc.v3i1.182"}, {"text": "Kassiano W et al. (2023). Greater gastrocnemius muscle hypertrophy after partial range of motion training performed at long muscle lengths. J Strength Cond Res.", "url": "https://pubmed.ncbi.nlm.nih.gov/37015016/"}]}, {"id": "rest-intervals", "title": "Rest between sets", "takeaway": "Very short rests reduce how much work you can do.", "rule": "Rest 2–3 minutes on compound lifts and at least 90 seconds on isolation lifts.", "cites": [{"text": "Schoenfeld BJ et al. (2016). Longer interset rest periods enhance muscle strength and hypertrophy in resistance-trained men. J Strength Cond Res 30(7):1805–1812. 3-minute rests beat 1-minute rests.", "url": "https://doi.org/10.1519/JSC.0000000000001272"}, {"text": "Singer A et al. (2024). Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy. Front Sports Act Living 6:1429789. Rests over 60 seconds gave a small benefit; past about 90 seconds no clear further benefit.", "url": "https://doi.org/10.3389/fspor.2024.1429789"}]}, {"id": "cardio", "title": "Cardio without losing gains", "takeaway": "Cycling interferes with muscle growth less than running does, so your Peloton is a good choice.", "rule": "Keep HIIT to 2 short sessions a week (about 20–30 minutes). Don't do HIIT right before leg days. If you do cardio on a lifting day, lift first. (Wednesday is the planned exception: the bike comes first because the V-taper session after it is short upper-body work, which the bike barely affects.)", "cites": [{"text": "Wilson JM et al. (2012). Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises. J Strength Cond Res 26(8):2293–2307. Running, but not cycling, significantly reduced muscle growth.", "url": "https://doi.org/10.1519/JSC.0b013e31823a3e2d"}, {"text": "Murlasits Z, Kneffel Z, Thalib L (2018). The physiological effects of concurrent strength and endurance training sequence. J Sports Sci 36(11):1212–1219. Lifting before cardio gave better lower-body strength.", "url": "https://doi.org/10.1080/02640414.2017.1364405"}]}, {"id": "diet-breaks", "title": "Diet breaks", "takeaway": "A week at maintenance calories doesn't improve fat loss in lifters, but it can ease hunger and mood.", "rule": "Optional. If adherence slips, eat at maintenance for 1 week around week 6–7 and push the end date back a week.", "cites": [{"text": "Byrne NM et al. (2018). Intermittent energy restriction improves weight loss efficiency in obese men: the MATADOR study. Int J Obes 42:129–138.", "url": "https://doi.org/10.1038/ijo.2017.206"}, {"text": "Peos JJ et al. (2021). Continuous versus intermittent dieting for fat loss and fat-free mass retention in resistance-trained adults: the ICECAP trial. Med Sci Sports Exerc 53(8). No difference in fat or lean-mass outcomes.", "url": "https://doi.org/10.1249/MSS.0000000000002636"}]}, {"id": "steps-neat", "title": "Steps and daily movement (NEAT)", "takeaway": "Everyday movement is a large, adjustable part of calorie burn and tends to drop quietly during a diet.", "rule": "Hold a step floor of about 8,000–10,000 a day, which your incline walking covers. Track it so it doesn't slide.", "cites": [{"text": "Levine JA, Eberhardt NL, Jensen MD (1999). Role of nonexercise activity thermogenesis in resistance to fat gain in humans. Science 283:212–214.", "url": "https://doi.org/10.1126/science.283.5399.212"}, {"text": "Paluch AE et al. (2022). Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts. Lancet Public Health 7:e219–e228.", "url": "https://doi.org/10.1016/S2468-2667(21)00302-9"}]}, {"id": "sleep", "title": "Sleep", "takeaway": "Short sleep during a diet shifts weight loss away from fat and toward muscle.", "rule": "Spend 7.5–8.5 hours in bed.", "cites": [{"text": "Nedeltcheva AV et al. (2010). Insufficient sleep undermines dietary efforts to reduce adiposity. Ann Intern Med 153(7):435–441. With 5.5 vs 8.5 hours in bed, fat loss was 55% lower and lean-mass loss 60% higher.", "url": "https://doi.org/10.7326/0003-4819-153-7-201010050-00006"}]}, {"id": "creatine-caffeine", "title": "Creatine and caffeine", "takeaway": "Creatine is safe and effective. The 1–3 lb it adds is mostly water inside the muscle, not fat or bloat. Caffeine helps performance but can quietly hurt sleep.", "rule": "Take 3–5 g of creatine every day. Take 3–6 mg/kg of caffeine about 60 minutes before training; the low end (about 270 mg) is enough. Have no caffeine within about 6 hours of bedtime, and earlier is better.", "cites": [{"text": "Kreider RB et al. (2017). ISSN position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine. J Int Soc Sports Nutr 14:18.", "url": "https://doi.org/10.1186/s12970-017-0173-z"}, {"text": "Guest NS et al. (2021). ISSN position stand: caffeine and exercise performance. J Int Soc Sports Nutr 18:1.", "url": "https://doi.org/10.1186/s12970-020-00383-4"}, {"text": "Drake C et al. (2013). Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed. J Clin Sleep Med 9(11):1195–1200. Caffeine taken 6 hours before bed still disrupted sleep.", "url": "https://doi.org/10.5664/jcsm.3170"}]}, {"id": "sodium-water-alcohol", "title": "Sodium, water and alcohol", "takeaway": "Steady salt and water intake keeps your look and your scale weight stable. Heavy drinking after training blunts muscle building, even when you also have protein.", "rule": "Keep sodium and water roughly the same every day, about 3–4 L of water. Don't cut water. Drink alcohol rarely and moderately, and never as a big session after a workout.", "cites": [{"text": "Escalante G et al. (2021). Peak week recommendations for bodybuilders: an evidence based approach. BMC Sports Sci Med Rehabil 13:68.", "url": "https://doi.org/10.1186/s13102-021-00296-y"}, {"text": "Parr EB et al. (2014). Alcohol ingestion impairs maximal post-exercise rates of myofibrillar protein synthesis following a single bout of concurrent training. PLoS One 9(2):e88384. Muscle protein synthesis fell 24% even with protein, at about 12 drinks.", "url": "https://doi.org/10.1371/journal.pone.0088384"}]}, {"id": "fiber-nordics", "title": "Fiber, and Nordic curls for your hamstrings", "takeaway": "Fiber helps you stay full and stick to the diet. Nordic curls cut hamstring injuries roughly in half (the studies were in soccer players).", "rule": "Eat 30–40 g of fiber a day, from vegetables, berries, oats and legumes. Do Nordic curls on one lower day: 2–3 sets of 3–6 reps, building up slowly.", "cites": [{"text": "Miketinas DC et al. (2019). Fiber intake predicts weight loss and dietary adherence in adults consuming calorie-restricted diets: the POUNDS Lost study. J Nutr 149(10):1742–1748.", "url": "https://doi.org/10.1093/jn/nxz117"}, {"text": "van der Horst N et al. (2015). The preventive effect of the Nordic hamstring exercise on hamstring injuries in amateur soccer players: a randomized controlled trial. Am J Sports Med 43(6):1316–1323.", "url": "https://doi.org/10.1177/0363546515574057"}, {"text": "Al Attar WSA et al. (2017). Effect of injury prevention programs that include the Nordic hamstring exercise on hamstring injury rates in soccer players. Sports Med 47(5):907–916. A 51% reduction in injuries.", "url": "https://doi.org/10.1007/s40279-016-0638-2"}]}, {"id": "v-taper", "title": "The V-taper look", "takeaway": "The research backs it. People judge a man's body mainly on how strong and how lean it looks, and visibly strong upper-body proportions are the biggest factor.", "rule": "Prioritise side delts, lats, upper chest and arms, and get your waist lean.", "cites": [{"text": "Sell A, Lukaszewski AW, Townsley M (2017). Cues of upper body strength account for most of the variance in men's bodily attractiveness. Proc R Soc B 284:20171819. Perceived strength explained about 70% of attractiveness ratings.", "url": "https://doi.org/10.1098/rspb.2017.1819"}, {"text": "Fan J et al. (2005). Visual perception of male body attractiveness. Proc R Soc B 272:219–226. Overall body size relative to height was the main cue; fitness-related proportions added smaller, significant effects.", "url": "https://doi.org/10.1098/rspb.2004.2922"}]}];
function plSciRule(x){
  if(x.id!=="rate-of-loss")return x.rule;
  const st=ST(), lw=Object.keys(S.days).filter(k=>k<=todayKey()&&S.days[k].weight>0).sort().pop();
  const w=lw?+S.days[lw].weight:(st.startWeight||200);
  return x.rule.replace(/about [\d.]+–[\d.]+ lb per week \([^)]*\)/,`about ${(w*.005).toFixed(1)}–${(w*.01).toFixed(1)} lb per week at ${Math.round(w)} lb (goal ${st.goal} lb by Week 12)`);
}
function scienceHTML(){
  return `<p>The rules in this plan, the research behind each one, and links to the papers.</p>`+PL_SCIENCE.map(x=>`<details class="sci" id="sci-${esc(x.id)}"><summary><b>${esc(x.title)}</b><span class="muted">${esc(x.takeaway)}</span></summary>
    <div class="sci-b"><p class="sci-rule"><span class="eyebrow">Your rule</span>${esc(plSciRule(x))}</p>${x.id==="creatine-caffeine"?`<p class="note"><b>For your 5 PM sessions:</b> the ~2 PM caffeine cutoff wins over the 60-minute pre-workout timing. Train stim-free or keep it to ≤100 mg.</p>`:""}
    <ol class="cites">${x.cites.map(c=>`<li>${/^https:\/\//.test(c.url)?`<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.text)}</a>`:esc(c.text)}</li>`).join("")}</ol></div></details>`).join("");
}
function addonsHTML(){
  const A=typeof ADDONS==="object"?ADDONS:{};
  const mob=typeof MOBILITY!=="undefined"?MOBILITY:(A.mobility||[]);
  return `<p>None of these are required. Add them when you have time and energy; skip them in Week 7 and Week 12.</p><ul>
    ${A.grip?`<li><b>Grip:</b> ${esc(A.grip)}</li>`:""}
    ${A.neck?`<li><b>Neck:</b> ${esc(A.neck)}</li>`:""}
    ${A.satCore?`<li><b>Saturday core:</b> ${A.satCore.map(esc).join(" · ")}</li>`:""}</ul>
    <h4>5-minute mobility routine</h4><p class="note">After any session or on Sunday. Tick "5-min mobility" on Today when it's done.</p>
    <ol class="mob">${mob.map(m=>`<li>${esc(m)}</li>`).join("")}</ol>
    <p class="note">Creatine 5 g a day is on the Today checklist too; see The science behind your plan.</p>`;
}
function plSec(title,body,id){return `<details class="sec"${id?` id="${id}"`:""}><summary><h2>${title}</h2></summary><div class="dbody">${body}</div></details>`;}
function referenceHTML(){
  const st=ST();
  return `<h2 class="ref-h">Reference</h2>
  ${plSec("Your program",programHTML(),"program")}
  ${plSec("Exercise library",libraryHTML(),"library")}
  ${plSec("Conditioning",condHTML(),"conditioning")}
  ${plSec("How your week works",`<p>Times come from your settings. Weekdays you lift after work; Saturday you train in the morning; Sunday is rest and the weekly check-in.</p><div data-weekref>${weekRef()}</div>
    <p class="note">Missed a lift? Do it the next day with the workout picker in Train. Don't double up, and don't put a missed leg day the day before Saturday's run.</p>`)}
  ${plSec("Nutrition rules",`<ul>
    <li><b>Protein first.</b> About 1 g per lb of goal weight, spread over 4–5 meals of 40–50 g. If you miss calories, don't miss protein.</li>
    <li><b>Fiber 32–38 g</b> from 4 cups of vegetables (1 at breakfast, 2 at dinner), black beans at lunch, berries, potatoes and oats.</li>
    <li><b>Sodium steady day to day</b>, about 2,300–3,000 mg on training days if your blood pressure is normal.</li>
    <li><b>Caffeine:</b> none after about 2 PM. The research dose is ~60 min before training, but for 5 PM sessions the cutoff wins: stim-free or ≤100 mg.</li>
    <li><b>Creatine 5 g a day</b> (on the Today checklist). <b>Vitamin D</b> 600–1,000 IU (up to 2,000). <b>Salmon</b> twice a week.</li></ul>
    <p>Water plan, supplements, micronutrients, eating out and bloodwork are on the Fuel tab.</p>
    <div><button class="btn sec" data-act="tab" data-v="fuel">Open Fuel</button></div>`)}
  ${plSec("The science behind your plan",scienceHTML(),"science")}
  ${plSec("Optional add-ons",addonsHTML(),"addons")}
  ${plSec("How the coach adjusts",`<p>The coach compares weekly averages, not single weigh-ins, and scales the change per week when weeks are missing.</p><ul>
    <li><b>Target loss:</b> 0.5–1.0% of bodyweight per week${st.startWeight?` (about ${(st.startWeight*.005).toFixed(1)}–${(st.startWeight*.01).toFixed(1)} lb at ${fnum(st.startWeight)})`:""}.</li>
    <li><b>Weeks 1–2:</b> hold. The early drop is mostly water and stored carbs.</li>
    <li><b>Consistency first:</b> calories within 150 on at least 5 of 7 days and average steps at least 90% of goal. Otherwise the call is "fix consistency", not a cut.</li>
    <li><b>Stall:</b> under 0.35% a week for 2 weeks in a row → cut 150 kcal (25 g carbs, 5 g fat). At the ${FLOOR.toLocaleString()} kcal floor: steps to 12,000, then a maintenance week.</li>
    <li><b>Slightly slow</b> (0.35–0.5%): hold. <b>Slightly fast</b> (1.0–1.25% for one week): hold.</li>
    <li><b>Too fast:</b> over 1.0% a week averaged over 2 weeks, from Week 4 → add 150 kcal.</li>
    <li><b>Weeks 7–8:</b> hold. Week 8 is compared to Week 6 because of the diet-break water bump.</li>
    <li><b>After any change:</b> hold 2 weeks. Floor ${FLOOR.toLocaleString()} kcal, ceiling ${CEIL.toLocaleString()} kcal.</li>
    <li><b>Waist shrinking, scale flat:</b> you're still losing fat. Hold.</li></ul>`)}
  ${plSec("Facial leanness",`<ul>
    <li><b>Sodium steady</b> day to day (about 2,300–3,000 mg on training days). Spikes show in your face for 1–2 days.</li>
    <li><b>Water</b> spread across the day, tapering after 8 PM.</li>
    <li><b>Sleep 7–8 hours.</b> Short sleep raises water retention and hunger.</li>
    <li><b>No alcohol</b> if you can manage 12 weeks. It causes rebound puffiness.</li>
    <li><b>No binge days.</b> One controlled meal out beats a cheat day.</li>
    <li><b>Photos</b> Sunday morning, same light, neutral face. Compare Weeks 1, 6 and 12, not week to week.</li>
    <li>Face fat comes off with overall body fat. It can't be spot-reduced.</li></ul>`)}
  ${plSec("Red flags — stop and get checked",`<div class="callout warn"><div><b>Before you start intervals:</b> get medical clearance if you've been inactive or have heart risk factors (family history, high blood pressure, smoking, diabetes).</div></div><ul>
    <li><b>Chest pain or pressure, fainting, unusual breathlessness or a racing, irregular heartbeat:</b> stop now and see a doctor.</li>
    <li><b>Pinpoint bone pain in the shin or foot:</b> stop running and get it checked (possible stress fracture). Swap Saturday's run/walk for a Hike class or the bike.</li>
    <li><b>Joint pain lasting more than 48 hours:</b> swap the movement and get it looked at.</li>
    <li><b>Resting heart rate up 7+ bpm for 3 days, strength down 10%, or a crash in mood or libido:</b> take a maintenance week.</li></ul>`,"redflags")}
  ${plSec("After Week 12",`<ul>
    <li><b>Reverse:</b> add 150–200 kcal a week, mostly carbs, until weight holds. That's your new maintenance.</li>
    <li>Hold maintenance 2 weeks; keep the steps, the Wednesday ride and the Saturday run/walk.</li>
    <li><b>Lean bulk</b> at +200–300 kcal, gaining 0.25–0.5 lb a week.</li></ul>`)}`;
}
function renderPlan(){
  const st=ST(), first=st.startWeight==null;
  const adjLog=st.adj.length?`<ul class="log">${st.adj.slice().reverse().map(a=>`<li><span>${short(a.date)}${a.wk?` · after Week ${a.wk}`:" · manual"}</span><span class="mono ${a.delta<0?"dn":"up"}">${a.delta>0?"+":""}${a.delta} → ${(+a.cal).toLocaleString()}</span></li>`).join("")}</ul>`:`<p class="note">No changes yet. Starting targets are in use.</p>`;
  const tday=plTypicalDay();
  const targets=`<section class="card" id="targets"><div class="card-h"><h2>Daily targets</h2><span class="sub">Meal portions rescale automatically</span></div>
    <div class="card-b"><div data-targets>${targetsCard()}</div>
      <div class="row"><button class="btn sec" data-act="manadj" data-v="-${STEP}">Cut ${STEP} kcal</button><button class="btn sec" data-act="manadj" data-v="${STEP}">Add ${STEP} kcal</button></div>
      <p class="note">Each step moves 25 g of carbs and 5 g of fat (rice and potatoes shrink or grow). Carbs never go below 150 g or fat below 55 g. Let the Progress coach decide when, and don't change more than once every 2 weeks.</p>
      <h3 class="eyebrow">Change history</h3><div data-adjlog>${adjLog}</div></div></section>`;
  const meals=`<section class="card" id="meals"><div class="card-h"><h2>Meal plan</h2><span class="sub">A typical weekday (${DOWL[parseKey(tday).getDay()]})</span></div><div data-meals>${mealPreview()}</div>
    <div class="card-b"><p class="note">Weights are cooked. Weigh food for the first 2 weeks; eyeballed portions run 20–30% high. Swap proteins freely (chicken, 93% turkey, sirloin, white fish). Weekend times differ; see How your week works.</p></div></section>`;
  const left=first?settingsCard(true)+targets+meals:targets+meals+settingsCard(false);
  return `<div class="phead"><div class="t"><div class="eyebrow">12 weeks · ${nice(st.start)} – ${nice(addDays(st.start,83))}</div><h1>Plan &amp; settings</h1></div></div>
  <div class="cols plan-cols"><div class="col">${left}</div><div class="col">${referenceHTML()}</div></div>`;
}
function patchPlan(){
  const t=$("[data-targets]");if(t)t.innerHTML=targetsCard();
  const m=$("[data-meals]");if(m)m.innerHTML=mealPreview();
  const w=$("[data-weekref]");if(w)w.innerHTML=weekRef();
  const z=$("[data-zones]");if(z)z.innerHTML=zonesHTML();
  plPaintIssues();
}
AFTER_RENDER.push(tab=>{if(tab==="plan")plPaintIssues();});
