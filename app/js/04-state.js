/* =========================================================
   STATE, PER-DATE PLAN, TARGETS, TIMELINE, HABITS (Builder B)
   ========================================================= */
const S={set:clone(DEFAULTS),days:{},tab:"today",date:todayKey(),trainWk:null};
function clone(o){return JSON.parse(JSON.stringify(o));}
const ST=()=>S.set;

function planFor(k){
  const st=ST(), idx=diffDays(st.start,k), dow=parseKey(k).getDay(), week=Math.floor(idx/7)+1;
  const inProg=idx>=0&&idx<84;
  const sch=Object.assign({},SCHED[dow]);
  if(sch.lift||sch.intervals)sch.train=dow===6?st.satTrain:st.train;   // per-day training time
  const w=wk12(week), cw=COND[w].walk;
  if(sch.walkCond){sch.walk=`Incline walk ${cw.min} min · ${cw.mph.toFixed(1)} mph · ${cw.incline}%`;sch.walkMin=cw.min;sch.walkMph=cw.mph;sch.walkIncline=cw.incline;sch.walkText=cw.text;sch.walkNote=WALK_NOTE;}
  return {k,idx,dow,week,inProg,pre:idx<0,post:idx>=84,sch,proto:proto(week),block:blockFor(week),cond:COND[w],
    deload:week===DIET_BREAK_WEEK,dietBreak:inProg&&week===DIET_BREAK_WEEK,trainDay:!!(sch.lift||sch.intervals)};
}
/* Intervals for a date, or null. Wednesday = Peloton bike (timer uses the no-class fallback); Saturday = tread run/walk. */
function intervalPlan(k){
  const pl=planFor(k), s=pl.sch;if(!s.intervals)return null;
  const c=pl.cond;
  if(s.intervalMode==="bike"){const w=c.wed;
    return {mode:"bike",text:w.class,cls:w.class,short:w.short,mins:w.min,segments:w.fallback,fallback:w.fallback,fallbackMins:segMins(w.fallback),ftpTest:!!w.ftpTest,
      rpe:w.ftpTest?"All-out but even: hold the highest steady output you can for 20 min.":"Ride by the zone bar. Hard efforts in the listed zone, recoveries in Z1.",
      peloton:{filters:w.peloton.filters,note:w.peloton.note}};}
  return {mode:"tread",text:c.sat.text,mins:segMins(c.sat.segments),segments:c.sat.segments,rpe:"RPE 6 or less: conversational.",
    peloton:{filters:RUN_FILTER,note:RUN_NOTE}};
}
function dayHeadline(pl){return pl.sch.lift?wkName(pl.sch.lift):pl.sch.label;}

/* Targets for one date. Week 7 is a diet break: +450 kcal, all carbs. */
function targetsFor(k){
  const st=ST(), pl=planFor(k);
  const t={cal:st.cal,p:st.p,c:st.c,f:st.f,steps:st.steps,water:st.water+(pl.trainDay?TRAIN_DAY_WATER:0),dietBreak:pl.dietBreak};
  if(pl.dietBreak){t.cal+=DIET_BREAK_KCAL;t.c+=DIET_BREAK_C;}
  return t;
}

/* ---------- day records ---------- */
function blankDay(){return {checks:{},weight:null,cal:null,protein:null,steps:null,water:null,sleep:null,waist:null,notes:"",lifts:{}};}
const isObj=o=>!!o&&typeof o==="object"&&!Array.isArray(o);
const numOrNull=n=>(n===""||n==null||typeof n==="boolean"||!isFinite(+n))?null:+n;
const numOr0=n=>{const v=numOrNull(n);return v==null?0:v;};
function normDay(v){
  const src=isObj(v)?v:{};
  const d=Object.assign(blankDay(),src);
  d.checks={};if(isObj(src.checks))Object.keys(src.checks).forEach(id=>{d.checks[id]=!!src.checks[id];});
  d.lifts={};
  if(isObj(src.lifts))Object.keys(src.lifts).forEach(id=>{const a=src.lifts[id];
    if(/__alt$/.test(id)){if(typeof a==="string"&&a.trim())d.lifts[id]=a.slice(0,120);return;} /* chosen swap for that day */
    d.lifts[id]=Array.isArray(a)?a.map(s=>Array.isArray(s)?{w:numOrNull(s[0]),r:numOrNull(s[1])}:(isObj(s)?{w:numOrNull(s.w),r:numOrNull(s.r)}:{w:null,r:null})):[];});
  ["weight","cal","protein","steps","water","sleep","waist"].forEach(f=>{d[f]=numOrNull(d[f]);});
  if(typeof d.notes!=="string")d.notes="";
  if(d.calSrc!=="plan"&&d.calSrc!=="manual")delete d.calSrc;
  delete d.mealsAlt;delete d.skips;
  if(src.mealsAlt!=null){
    const ma={};
    if(isObj(src.mealsAlt))Object.keys(src.mealsAlt).forEach(id=>{const m=src.mealsAlt[id];if(!isObj(m)||!/^[a-z0-9_]{1,24}$/i.test(id))return;
      ma[id]={text:typeof m.text==="string"?m.text:"",k:numOr0(m.k),p:numOr0(m.p),c:numOr0(m.c),f:numOr0(m.f),note:typeof m.note==="string"?m.note:""};});
    d.mealsAlt=ma;
  }
  if(src.skips!=null)d.skips=isObj(src.skips)?src.skips:{};
  return d;
}
const clampN=(v,[lo,hi])=>Math.min(hi,Math.max(lo,v));
function normSet(v){
  const src=isObj(v)?v:{};
  const s=Object.assign(clone(DEFAULTS),src);
  // migration: pre-schema-3 settings that still hold the old default times
  if(!(+src.schema>=3))Object.keys(OLD_TIME_DEFAULTS).forEach(f=>{if(src[f]===OLD_TIME_DEFAULTS[f])s[f]=DEFAULTS[f];});
  s.schema=4;
  if(!validKey(s.start))s.start=DEFAULTS.start;
  s.start=mondayOf(s.start);
  ["goal","cal","p","c","f","steps","water"].forEach(f=>{const n=numOrNull(src[f]);s[f]=n==null?DEFAULTS[f]:n;if(SET_LIMITS[f])s[f]=clampN(s[f],SET_LIMITS[f]);});
  // schema 4: water base 120 → 100 oz (+24 on training days) when still the old default
  if(!(+src.schema>=4)&&+src.water===120)s.water=100;
  s.startWeight=numOrNull(s.startWeight);
  {const n=numOrNull(src.ftp);s.ftp=n!=null&&n>=SET_LIMITS.ftp[0]&&n<=SET_LIMITS.ftp[1]?Math.round(n):null;}
  TIME_KEYS.forEach(f=>{s[f]=normHM(s[f])||DEFAULTS[f];});
  // times are kept as entered; timeline() clamps for display and the Settings form warns
  s.adj=Array.isArray(s.adj)?s.adj.filter(a=>isObj(a)&&isFinite(+a.delta)).map(a=>({date:validKey(a.date)?a.date:todayKey(),wk:a.wk==null||!isFinite(+a.wk)?null:+a.wk,delta:+a.delta,cal:isFinite(+a.cal)?+a.cal:s.cal})):[];
  return s;
}
const getDay=k=>S.days[k]||blankDay();
const ensureDay=k=>(S.days[k]=S.days[k]||blankDay());

/* ---------- the day's schedule (time-stamped) ----------
   Row: {id,t,kind,title,detail?,meal?,auto?,link?,info?,end?}. t = minutes after midnight.
   info rows (work, caffeine, winddown) are display-only: no checkbox, not scored. */
function timeline(k){
  const pl=planFor(k), s=pl.sch, st=ST(), tg=targetsFor(k), M=buildMeals(tg).meals;
  const wkend=pl.dow===0||pl.dow===6, sunday=pl.dow===0;
  const W=toMin(wkend?st.weekendWake:st.wake);
  let B=toMin(st.bed);if(B<=W)B+=1440;if(B-W<12*60)B=W+12*60;
  const lastMeal=B-45;                       // no food in the last 45 min before lights out
  const ws=toMin(st.workStart), we=toMin(st.workEnd);
  const rows=[], add=r=>{rows.push(r);return r;};
  add({id:"wake",t:W,kind:"routine",auto:true,title:"Wake, weigh in, 16 oz water",detail:"Weigh after the bathroom, before food."});
  if(!wkend&&ws!=null&&we>ws)add({id:"work",t:ws,end:we,kind:"work",info:true,title:`Work · ${fmt12(ws)}–${fmt12(we)}`,detail:"Desk day. Stand and walk 2–3 minutes every hour."});
  const caf=Math.min(toMin(CAFFEINE_CUTOFF),B-480);
  if(caf>W+60)add({id:"caffeine",t:caf,kind:"info",info:true,title:"Caffeine cutoff",detail:"Last caffeine. Pre-workout: stim-free or ≤100 mg."});

  let bf,ms,lunch,shake,dinner,shakeMode="pre",T=null,end=null;
  if(sunday){
    bf=W+30;ms=W+240;lunch=W+390;shake=W+570;dinner=W+720;shakeMode="day";
    add({id:"walk",t:W+150,end:W+150+s.walkMin,kind:"train",title:s.walk,detail:s.walkNote});
    add({id:"prep",t:q15(lunch+90),kind:"routine",title:"Prep food for the week",detail:"Cook chicken, rice and potatoes. Portion 5 lunches and dinners."});
  }else{
    // training block: lift → intervals → walk (Wednesday: bike first, then VT, then walk)
    const ip=intervalPlan(k);
    const liftM=s.lift?liftDur(s.lift,pl.week):0, intM=ip?ip.mins:0;
    const dur=liftM+intM+s.walkMin;
    T=toMin(s.train||st.train);
    T=Math.min(T,lastMeal-20-dur);           // finish in time to eat before lights out
    T=Math.max(T,W+15);                      // never earlier than 15 min after waking
    let t=T;
    const addLift=()=>{if(!s.lift)return;const b=pl.block;
      add({id:"lift",t,end:t+liftM,kind:"train",link:"train",title:`Lift · ${wkName(s.lift)}`,
        detail:`${WORKOUTS[s.lift].ex.filter(e=>!e.optional).length} exercises, about ${liftM} min. ${b.name} block: ${b.rir} reps in reserve.${b.key==="deload"?" One fewer set per exercise.":""} Log sets in Train.`});t+=liftM;};
    const addInt=()=>{if(!ip)return;const bike=ip.mode==="bike";
      add({id:"intervals",t,end:t+intM,kind:"run",link:"train",title:bike?`Peloton bike · ${ip.short}`:`Tread run/walk · ${ip.text}`,
        detail:bike?`Take: ${ip.cls}. No class? The Train timer has a ${ip.fallbackMins}-min fallback.`:`${intM} min with a 5-min warm-up and cool-down walk. ${ip.rpe} 1% incline.`});t+=intM;};
    if(s.cardioFirst){addInt();addLift();}else{addLift();addInt();}
    add({id:"walk",t,end:t+s.walkMin,kind:"train",title:s.walk,detail:s.walkNote});
    end=t+s.walkMin;
    if(T-W<150){                              // morning session: shake before, breakfast after
      shake=Math.max(W+10,T-45);bf=q15(end+20);
      lunch=q15(Math.max(bf+195,wkend?0:720));ms=q15(lunch+150);dinner=q15(Math.max(ms+180,1050));
    }else{
      bf=W+(wkend?30:15);
      ms=q15(Math.max(wkend?W+180:570,bf+120));
      lunch=q15(Math.max(wkend?W+330:720,ms+120));
      shake=T-75;
      if(shake<lunch+60){                     // training near midday
        const early=q15(T-150);
        if(early>=ms+60&&early>=bf+150)lunch=early;
        else{lunch=q15(end+20);shake=Math.max(ms+45,T-75);}
      }
      shake=Math.min(Math.max(shake,bf+45),T-30);
      if(shake<=W){shake=end;shakeMode="post";}
      dinner=q15(Math.max(end+20,lunch+180,shake+120,1050));
    }
  }
  const cap=x=>Math.max(W+15,Math.min(x,lastMeal));
  [bf,ms,lunch,shake,dinner]=[bf,ms,lunch,shake,dinner].map(cap);
  if(shakeMode==="pre"&&T!=null&&shake>T-15){shake=end!=null?Math.min(end,lastMeal):shake;shakeMode="post";}
  const morning=T!=null&&bf>T;
  const atWork=!wkend&&shake>=ws&&shake<we&&T!=null&&T>=we;
  const shakeDetail=shakeMode==="pre"?`${Math.max(0,Math.round(T-shake))} minutes before you ${s.cardioFirst?"ride":s.lift?"lift":"train"}.${atWork?" Have it at work before you leave.":""} Whey, banana, ¼ tsp salt.`
    :shakeMode==="post"?"Right after training. Whey, banana, ¼ tsp salt.":"Whey, banana, ¼ tsp salt.";
  add({id:"breakfast",t:bf,kind:"meal",meal:M.breakfast,title:sunday?"Check-in, then breakfast":morning?"Breakfast (post-workout)":"Breakfast",
    detail:sunday?"Before eating: weigh, measure your waist at the navel, take photos. Then eggs and egg whites with 1 cup spinach or peppers.":"Eggs and ½ cup egg whites with 1 cup spinach or peppers."});
  add({id:"msnack",t:ms,kind:"meal",meal:M.msnack,title:ms<720?"Mid-morning snack":"Afternoon snack",detail:`Greek yogurt and 1 cup berries${!wkend&&ms>=ws&&ms<we?" at your desk":""}.`});
  add({id:"lunch",t:lunch,kind:"meal",meal:M.lunch,title:wkend?"Lunch":"Lunch, then a 10-minute walk",detail:wkend?undefined:"A short walk after eating helps steps and blood sugar."});
  add({id:"shake",t:shake,kind:"meal",meal:M.shake,title:shakeMode==="pre"?"Pre-workout shake":shakeMode==="post"?"Post-workout shake":"Afternoon shake",detail:shakeDetail});
  add({id:"dinner",t:dinner,kind:"meal",meal:M.dinner,title:"Dinner",detail:!morning&&T!=null&&dinner>=end?"After training. Largest carb meal of the day.":"Largest carb meal of the day."});
  add({id:"winddown",t:B-30,kind:"routine",info:true,title:"Wind down",detail:`Screens off, stretch; lights out ${fmt12(B)}.`});
  add({id:"lightsout",t:B,kind:"routine",title:"Lights out",detail:"7–8 hours keeps hunger and water retention down."});
  if(tg.dietBreak)rows.filter(r=>r.kind==="meal").forEach(r=>{if(r.id==="lunch"||r.id==="dinner")r.detail=(r.detail?r.detail+" ":"")+"Diet break: bigger carb portion.";});
  return rows.map((r,i)=>[r,i]).sort((a,b)=>a[0].t-b[0].t||a[1]-b[1]).map(x=>x[0]);
}

/* One-line "what to do and when" for a date. */
function dayBrief(k){
  const pl=planFor(k), st=ST(), s=pl.sch, tg=targetsFor(k);
  if(pl.post)return "The 12 weeks are done. Follow “After Week 12” in Plan: raise calories slowly before any bulk.";
  const R={};timeline(k).forEach(r=>R[r.id]=r);
  const at=id=>R[id]?fmt12(R[id].t):"";
  const ip=intervalPlan(k);
  const walk=s.walkCond?`a ${s.walkMin}-min incline walk (${s.walkMph.toFixed(1)} mph, ${s.walkIncline}%)`:`a ${s.walkMin}-min ${s.walkShort}`;
  let t;
  if(pl.dow===0)t=`Rest day: check in at ${at("breakfast")} (weigh, waist, photos), an optional easy walk at ${at("walk")}, and prep food for the week at ${at("prep")}.`;
  else{
    const sh=R.shake, first0=[R.lift,R.intervals].filter(Boolean).sort((a,b)=>a.t-b.t)[0];
    const pre=sh&&sh.title.startsWith("Pre"), first=pre&&sh.t<first0.t&&R.breakfast.t>sh.t;
    let main;
    if(ip&&ip.mode==="bike")main=`Peloton bike at ${at("intervals")} (${ip.cls.replace(/ \(.*\)$/,"")}), then the V-taper session (about ${R.lift.end-R.lift.t} min) and ${walk}.`;
    else if(ip)main=`Tread run/walk at ${at("intervals")} (${ip.text}), then ${walk}.`;
    else main=`Lift ${wkName(s.lift)} at ${at("lift")}, then ${walk}.`;
    if(first){t=`Shake at ${at("shake")}, ${main[0].toLowerCase()+main.slice(1)}`;if(R.breakfast.title.includes("post"))t+=` Breakfast at ${at("breakfast")}.`;}
    else{
      t=main;
      if(pre){const atWork=sh.detail.includes("at work");
        t+=` Shake at ${at("shake")}${atWork?" before you leave work":`, ${Math.round(first0.t-sh.t)} min before you start`}.`;}
      else if(sh)t+=" Shake right after training.";
    }
  }
  if(pl.pre)return `Program starts ${nice(st.start)}. ${pl.idx>=-7?"Use this week to stock food and test your gym time. ":""}Preview of a ${DOWL[pl.dow]}: ${t[0].toLowerCase()+t.slice(1)}`;
  if(tg.dietBreak)t+=` Diet break week: eat ${tg.cal.toLocaleString()} kcal (the extra is carbs)${pl.sch.lift?" and do one fewer set per exercise":""}.`;
  else if(pl.inProg&&ip&&ip.ftpTest)t+=" After the test, enter your new FTP in Train.";
  return t;
}

function habits(k){
  const tg=targetsFor(k), pl=planFor(k);
  const h=[
    {id:"protein",short:"Protein",auto:true,title:`Protein at least ${tg.p-10} g`,detail:`Target ${tg.p} g. Hit this even on an off day.`},
    {id:"cal",short:"Calories",auto:true,title:`Calories ${(tg.cal-STEP).toLocaleString()}–${(tg.cal+STEP).toLocaleString()}`,detail:`Within 150 of ${tg.cal.toLocaleString()}${tg.dietBreak?" (diet break)":""}. Eating far under counts as a miss too.`},
    {id:"water",short:"Water",auto:true,title:`Water at least ${tg.water} oz`,detail:pl.trainDay?`${tg.water-TRAIN_DAY_WATER} oz plus ${TRAIN_DAY_WATER} oz for training.`:""},
    {id:"steps",short:"Steps",auto:true,title:`Steps at least ${tg.steps.toLocaleString()}`},
    {id:"sleep",short:"Sleep 7+ h",auto:true,title:"Slept 7+ hours last night"},
    {id:"veg",short:"Vegetables",title:"4 cups of vegetables",detail:"1 at breakfast, 1 at lunch, 2 at dinner."},
    {id:"sodium",short:"Steady sodium",title:"Sodium steady day to day",detail:"About 2,300–3,000 mg on training days if your blood pressure is normal (follow your doctor if it's high). Consistency matters more than the number: one salty meal can add 2–4 lb of water."},
    {id:"creatine",short:"Creatine",title:"Creatine 5 g",detail:"Any time of day. The 1–3 lb it adds is water inside the muscle, not fat."},
    {id:"mobility",short:"Mobility",title:"5-min mobility",detail:MOBILITY.join(" · ")+"."},
    {id:"alcohol",short:"No alcohol",title:"No alcohol",detail:"The biggest cause of a puffy face the next morning."}];
  if(pl.sch.checkin)h.push(
    {id:"waist",short:"Waist",auto:true,title:"Waist measured at the navel",detail:"Relaxed, after a normal exhale. Enter it under Log."},
    {id:"photos",short:"Photos",title:"Progress photos: front, side, face",detail:"Same spot, light and time as last week."},
    {id:"review",short:"Weekly review",title:"Review the week in Progress",detail:"Follow the coach call for next week."});
  return h;
}
