/* =========================================================
   SCORING — owned by the Today builder (core4, streak, adherence)
   ========================================================= */
/* per-date targets: B's targetsFor(k) when present, else the flat settings */
const tdT=k=>(k&&typeof targetsFor==="function")?targetsFor(k):ST();
/* autoVal(id, day, dateKey?) — k picks that date's targets (diet break etc.) */
function autoVal(id,d,k){const T=tdT(k);switch(id){
  case"wake":return d.weight>0;
  case"protein":return d.protein!=null&&d.protein>=T.p-10;
  case"cal":return d.cal>0&&Math.abs(d.cal-T.cal)<=STEP;
  case"water":return d.water!=null&&d.water>=T.water;
  case"steps":return d.steps!=null&&d.steps>=T.steps;
  case"sleep":return d.sleep!=null&&d.sleep>=7;
  case"waist":return d.waist>0;}return false;}
const isDone=(it,d,k)=>it.auto?autoVal(it.id,d,k):!!(d.checks&&d.checks[it.id]);
/* checkable items only: info rows (work block, caffeine cutoff) are display-only */
function allItems(k){return timeline(k).filter(r=>!r.info).concat(habits(k));}
function score(k){const d=getDay(k),its=allItems(k);const done=its.filter(it=>isDone(it,d,k)).length;return {done,total:its.length,pct:its.length?Math.round(done/its.length*100):0};}
/* finished days only (today is still in progress, so it never counts as a miss) */
function adherence(k){const pl=planFor(k);if(!pl.inProg||k>=todayKey())return null;return score(k).pct;}
/* live value for the week strip: includes today */
function liveAdh(k){return k>todayKey()?null:score(k).pct;}

/* ---------- Core 4: weigh-in, protein, calories, training ---------- */
const CORE4=[["weigh","Weigh-in"],["protein","Protein"],["cal","Calories"],["train","Training"]];
const TRAIN_IDS=["lift","intervals","walk"];
function core4(k){
  const pl=planFor(k);
  if(pl.pre||k>todayKey())return null;
  const d=getDay(k), tr=timeline(k).filter(r=>!r.info&&TRAIN_IDS.includes(r.id)&&!(r.id==="walk"&&pl.sch.optionalWalk)); // an optional rest-day walk never costs the Training goal
  const keys={weigh:d.weight>0,protein:autoVal("protein",d,k),cal:autoVal("cal",d,k),train:tr.every(r=>!!(d.checks&&d.checks[r.id]))};
  const met=Object.values(keys).filter(Boolean).length;
  return {met,total:4,pct:met*25,keys};
}
/* consecutive days with all 4 met, ending yesterday (today joins once it's met).
   One missed day per Mon–Sun week is forgiven (it keeps the streak but doesn't add to it). */
function streak(){
  const tk=todayKey(), c0=core4(tk), grace=new Set(), thisWk=mondayOf(tk);
  let days=c0&&c0.met===4?1:0;
  let pend=null; // a forgiven day only counts as "used" if a met day lies beyond it
  for(let k=addDays(tk,-1),i=0;i<400;i++,k=addDays(k,-1)){
    const c=core4(k);
    if(c&&c.met===4){days++;pend=null;continue;}
    const wk=mondayOf(k);
    if(!c||pend||grace.has(wk)){if(pend)grace.delete(pend);break;}   // never forgive two misses in a row
    grace.add(wk);pend=wk;
  }
  return {days,graceUsedThisWeek:days>0&&grace.has(thisWk)};
}
