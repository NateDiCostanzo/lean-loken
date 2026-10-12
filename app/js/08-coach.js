/* =========================================================
   COACH — weekly calorie-adjustment rules (owned by Builder B)
   Input: weekRows() rows {w,ks,avg,n,done,...}. Output: {c,h,t,adj?,wk?}.
   Rates are % of body weight per week, normalized across gaps.
   ========================================================= */
const RATE={stall:.35,low:.5,high:1.0,fastHold:1.25};   // %/week bands
const STEPS_BUMP=12000;
/* Consistency of one finished week: calories within ±150 of that day's target, and steps. */
function weekConsistency(ks){
  let calOk=0,stepSum=0,stepN=0,goal=0;
  ks.forEach(k=>{const d=S.days[k]||{},tg=targetsFor(k);goal=tg.steps;
    if(d.cal>0&&Math.abs(d.cal-tg.cal)<=STEP)calOk++;
    if(d.steps!=null&&d.steps>=0){stepSum+=+d.steps;stepN++;}});
  const stepAvg=stepN>=3?stepSum/stepN:null;
  const ok=calOk>=5&&stepAvg!=null&&stepAvg>=.9*goal;
  return {calOk,stepAvg,stepGoal:goal,ok};
}
/* Weekly loss rate for row r against the previous valid week (Week 7 is never a reference for Week 8+). */
function weekRate(r,valid,sw){
  const prev=valid.filter(x=>x.w<r.w&&!(r.w>DIET_BREAK_WEEK&&x.w===DIET_BREAK_WEEK)).pop();
  let base,gap;
  if(prev){base=prev.avg;gap=r.w-prev.w;}
  else if(sw!=null){base=sw;gap=r.w-.5;}       // start weight is a single morning before Week 1
  else return null;
  const lb=(base-r.avg)/gap;
  return {lb,pct:lb/base*100,from:prev?prev.w:0,gap};
}
function coach(rows){
  const st=ST(), sw=st.startWeight;
  const finished=(rows||[]).filter(r=>r.done);
  const valid=finished.filter(r=>r.avg!=null&&r.n>=3);
  const lastFin=finished[finished.length-1], last=valid[valid.length-1];
  const lbs=v=>`${v>=0?"down":"up"} ${Math.abs(v).toFixed(1)} lb`;
  const P=v=>`${Math.abs(v).toFixed(2).replace(/0$/,"")}%`;
  const R=x=>`${lbs(x.lb)}/week (${P(x.pct)} of body weight${x.pct<0?" gained":""})`;
  if(planFor(todayKey()).post){
    const lw=last?` Final weekly average: ${last.avg.toFixed(1)} lb${sw!=null?`, ${Math.abs(sw-last.avg).toFixed(1)} lb ${sw>=last.avg?"below":"above"} where you started`:""}.`:"";
    return {c:"good",h:"Program complete: reverse diet",t:`The 12 weeks are done.${lw} Add 150–200 kcal a week, mostly carbs, until your weekly average holds steady; that is your new maintenance. Hold it 2 weeks with the same steps and 2 interval sessions before any lean bulk (+200–300 kcal, gaining 0.25–0.5 lb a week).`};
  }
  if(!last)return {c:"",h:"Collecting data",t:"Weigh in every morning. Daily weight swings 1–3 lb on water alone, so the coach only uses weekly averages from weeks with at least 3 weigh-ins. The first read comes the Monday after Week 1 ends; targets can change from Week 3."};
  if(lastFin&&lastFin.w!==last.w)return {c:"warn",h:`Week ${lastFin.w}: not enough weigh-ins`,t:`Week ${lastFin.w} had ${lastFin.n||0} weigh-in${lastFin.n===1?"":"s"}. The coach needs at least 3 a week, so hold your current targets and weigh in every morning this week.`};
  const rate=weekRate(last,valid,sw);
  if(!rate)return {c:"warn",h:"Add your starting weight",t:"Set it in Plan → Settings so Week 1 can be measured, or wait for a second week of weigh-ins."};
  const lo=(last.avg*RATE.low/100).toFixed(1), hi=(last.avg*RATE.high/100).toFixed(1);
  const band=`the ${lo}–${hi} lb (0.5–1%) weekly target`;
  // during the diet break itself (Week 7 in progress): no changes, whatever Week 6 showed
  const now=planFor(todayKey());
  if(now.dietBreak&&last.w<DIET_BREAK_WEEK)return {c:"good",h:"Diet break week: hold",t:`This is the Week 7 diet break: eat ${targetsFor(todayKey()).cal.toLocaleString()} kcal (the extra is carbs) and change nothing. Last finished week: ${R(rate)}. Expect a 1–3 lb bump from glycogen and water. The coach compares Week 8 to Week 6.`};
  // measured from the single start-weight morning: report the total, not a per-week rate
  const fromStart=x=>{const d=sw-last.avg;return `Weekly average is ${Math.abs(d).toFixed(1)} lb ${d>=0?"below":"above"} your starting weight${last.w<=2?" (mostly water this early)":""}`;};
  if(last.w<=2)return {c:"good",h:`Week ${last.w}: hold steady`,t:`${rate.from===0?fromStart(rate):`Weekly average ${R(rate)}`}. Weeks 1–2 drop fast from water and stored carbs, so change nothing yet.`};
  // diet break: Week 7 runs at maintenance-ish; Week 8 is judged against Week 6
  if(last.w===DIET_BREAK_WEEK)return {c:"good",h:"Diet break: hold",t:`Week 7 average is ${lbs(rate.lb*rate.gap)} versus ${rate.from?"Week "+rate.from:"your start weight"}. A 1–3 lb bump is glycogen and water from the extra carbs, not fat. Back to normal targets in Week 8; the coach compares Week 8 to Week 6.`};
  if(last.w===DIET_BREAK_WEEK+1)return {c:"good",h:"After the diet break: hold",t:`Week 8 compared with Week ${rate.from||"start"}: ${R(rate)}. The diet-break water should be gone by now. Hold targets one more week; the next call uses Week 9.`};
  const recent=st.adj.filter(a=>a.wk!=null?a.wk>=last.w-1:validKey(a.date)&&diffDays(a.date,todayKey())<14).pop();
  if(recent)return {c:"good",h:"Hold: adjustment in progress",t:`You changed targets ${recent.wk!=null?`after Week ${recent.wk}`:`on ${short(recent.date)}`} (${recent.delta>0?"+":""}${recent.delta} kcal). Give it 2 full weeks before changing again. Last week: ${R(rate)}.`};
  const prevRow=valid.filter(x=>x.w<last.w&&x.w!==DIET_BREAK_WEEK&&x.w>=2).pop();
  const prevRate=prevRow?weekRate(prevRow,valid,sw):null;
  const cons=weekConsistency(lastFin.ks);
  const consText=`Last week: calories on target ${cons.calOk} of 7 days (need 5) and ${cons.stepAvg==null?"too few step counts logged":`${Math.round(cons.stepAvg).toLocaleString()} average steps`} (need ${Math.round(.9*cons.stepGoal).toLocaleString()}).`;
  const gate=()=>({c:"warn",h:"Fix consistency first",t:`${consText} Weight trend: ${R(rate)}. Most stalls are consistency, not metabolism, so the coach won't change targets until a week hits both. Log calories and steps every day.`});
  const slowTwice=rate.pct<RATE.stall&&prevRate&&prevRate.pct<RATE.stall;
  const fast2=prevRate?(rate.pct+prevRate.pct)/2:null;
  if(slowTwice){
    if(!cons.ok)return gate();
    const plan=adjPlan(st,-STEP);
    if(plan&&plan.real<=-50)return {c:"bad",h:`Two slow weeks: cut ${-plan.real} kcal`,t:`Weekly averages ${R(prevRate)}, then ${R(rate)}: under 0.35% for 2 weeks. Cut ${-plan.real} kcal (${sgnG(plan.c-st.c)} g carbs, ${sgnG(plan.f-st.f)} g fat). Portions update automatically. Hold it 2 weeks.`,adj:plan.real,wk:last.w};
    if(st.steps<STEPS_BUMP)return {c:"bad",h:"At the calorie floor: add steps",t:`Two slow weeks (${R(prevRate)}, then ${R(rate)}) and targets are at the floor (${st.cal.toLocaleString()} kcal, ${st.c} g carbs, ${st.f} g fat). Raise your step goal to ${STEPS_BUMP.toLocaleString()} in Plan → Settings instead of eating less.`};
    const est=Math.round((avgLoggedCal(lastFin.ks)||st.cal)+rate.lb*500);
    return {c:"bad",h:"At the floor: take a maintenance week",t:`Two slow weeks at the calorie floor with ${st.steps.toLocaleString()} daily steps. Take 1 week at maintenance (about ${(Math.round(est/50)*50).toLocaleString()} kcal, extra as carbs), then return to ${st.cal.toLocaleString()}. A rested week often restarts the trend.`};
  }
  if(last.w>=4&&fast2!=null&&fast2>RATE.high){
    if(!cons.ok)return gate();
    const plan=adjPlan(st,STEP);
    if(plan)return {c:"warn",h:`Losing too fast: add ${plan.real} kcal`,t:`Two-week average ${lbs(fast2*last.avg/100)}/week (${P(fast2)} of body weight), over the 1% limit. Past Week 3 that starts costing muscle. Add ${plan.real} kcal (${sgnG(plan.c-st.c)} g carbs, ${sgnG(plan.f-st.f)} g fat).`,adj:plan.real,wk:last.w};
  }
  const note=cons.ok?"":` ${consText}`;
  if(rate.pct<RATE.stall)return {c:"warn",h:"One slow week: hold",t:`Weekly average ${R(rate)}. Don't react to one week. Check sodium, sleep and weigh-in timing. If next week is also under 0.35%, the coach will call a cut.${note}`};
  if(rate.pct<RATE.low)return {c:"warn",h:"Slightly slow: hold",t:`Weekly average ${R(rate)}, just under ${band}. Hold targets and tighten logging.${note}`};
  if(rate.pct<=RATE.high)return {c:"good",h:"On pace: change nothing",t:`Weekly average ${R(rate)}, inside ${band}. Keep the same food, steps and training.${last.w===DIET_BREAK_WEEK-1?" Next week is the diet break: targets rise automatically.":""}${note}`};
  if(rate.pct<=RATE.fastHold)return {c:"good",h:"Slightly fast: hold",t:`Weekly average ${R(rate)}, a little over ${band}. One fast week is fine; the coach adds food only if 2 weeks average over 1%.${note}`};
  return {c:"warn",h:"Fast week: hold",t:`Weekly average ${R(rate)}. ${last.w<4?"Fast early weeks are mostly water. ":""}If the 2-week average stays over 1% from Week 4, the coach will add food.${note}`};
}
const sgnG=n=>`${n>0?"+":n<0?"−":"±"}${Math.abs(n)}`;
function avgLoggedCal(ks){const v=ks.map(k=>S.days[k]&&S.days[k].cal).filter(x=>x>0);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;}

/* Plan a calorie change. One STEP = STEP_C g carbs + STEP_F g fat (pro-rated for partial steps).
   Cuts respect FLOOR, CARB_FLOOR and FAT_FLOOR; adds respect CEIL. Returns {cal,c,f,real} or null. */
function adjPlan(st,delta){
  const target=Math.min(CEIL,Math.max(FLOOR,st.cal+delta)), want=target-st.cal;
  if(!want)return null;
  const n=Math.abs(want)/STEP, wc=Math.round(STEP_C*n), wf=Math.round(STEP_F*n);
  if(want>0)return {cal:target,c:st.c+wc,f:st.f+wf,real:want};
  const fRoom=Math.max(0,st.f-FAT_FLOOR), cRoom=Math.max(0,st.c-CARB_FLOOR);
  let gf=Math.min(wf,fRoom), gc=Math.min(cRoom,wc+Math.round((wf-gf)*9/4));
  const shortK=(wc*4+wf*9)-(gc*4+gf*9);
  if(shortK>0){const more=Math.min(fRoom-gf,Math.round(shortK/9));gf+=more;}
  const got=gc*4+gf*9, wantK=wc*4+wf*9;
  const real=-Math.round(Math.abs(want)*Math.min(1,got/wantK)/5)*5;
  if(real>-10)return null;
  return {cal:st.cal+real,c:st.c-gc,f:st.f-gf,real};
}
/* Calories edited directly: carbs absorb the change (fat moves only at the carb floor or ceiling).
   Mutates and returns st; does not save. */
function rebalanceForCal(st){
  st=st||ST();
  let c=Math.round((st.cal-st.p*4-st.f*9)/4);
  if(c<CARB_FLOOR){const shortK=(CARB_FLOOR-c)*4;c=CARB_FLOOR;st.f=Math.max(FAT_FLOOR,st.f-Math.round(shortK/9));}
  else if(c>SET_LIMITS.c[1]){const extra=(c-SET_LIMITS.c[1])*4;c=SET_LIMITS.c[1];st.f=Math.min(SET_LIMITS.f[1],st.f+Math.round(extra/9));}
  st.c=c;return st;
}
function applyAdj(delta,wk){
  const st=ST(), before={cal:st.cal,c:st.c,f:st.f,n:st.adj.length};
  const plan=adjPlan(st,+delta);
  if(!plan){toast(delta<0?`Already at the floor (${FLOOR.toLocaleString()} kcal, ${CARB_FLOOR} g carbs, ${FAT_FLOOR} g fat)`:`Already at the ${CEIL.toLocaleString()} kcal ceiling`);return null;}
  st.cal=plan.cal;st.c=plan.c;st.f=plan.f;
  st.adj=st.adj.concat([{date:todayKey(),wk:wk==null||isNaN(wk)?null:wk,delta:plan.real,cal:plan.cal}]);
  saveSet();rerenderKeepScroll();
  toast(`Targets now ${plan.cal.toLocaleString()} kcal · ${plan.c} g carbs · ${plan.f} g fat`,()=>{st.cal=before.cal;st.c=before.c;st.f=before.f;st.adj=st.adj.slice(0,before.n);saveSet();rerenderKeepScroll();toast("Change undone");});
  return plan;
}
