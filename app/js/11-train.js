/* =========================================================
   TRAIN — gym logger, rest timer, interval timer
   ========================================================= */
const T={phases:[],i:0,left:0,running:false,last:0,iv:null,ctx:null,lock:null,finished:false,date:null,key:"",total:0,mode:"run"};
const TR={show:{},rest:null,justDone:false,focus:null,pick:{},open:{}};

/* ---------- small parsers ---------- */
const fw=n=>String(Math.round(n*10)/10);
const e1rm=(w,r)=>w>0&&r>0?w*(1+r/30):0;
const logged=s=>!!s&&s.w!=null&&s.r!=null;
function parseReps(s){
  s=String(s||"");const m=/(\d+)\s*(?:[–—-]\s*(\d+))?/.exec(s);if(!m)return null;
  const lo=+m[1],hi=m[2]?+m[2]:lo;return {lo,hi};
}
function parseRest(s){
  s=String(s||"");const m=/(\d+(?:\.\d+)?)\s*(?:[–—-]\s*(\d+(?:\.\d+)?))?\s*(min|m\b|s|sec)/i.exec(s);
  if(!m)return 90;
  const a=+m[1],b=m[2]?+m[2]:a,mid=(a+b)/2;
  return Math.round(/^m/i.test(m[3])?mid*60:mid);
}
const trSets=(e,pl)=>typeof setsFor==="function"?setsFor(e,pl.week):(pl.deload?Math.max(1,e.s-1):e.s);
const restOf=e=>e.restSec>0?Math.round(e.restSec):parseRest(e.rest);
const counted=e=>!e.optional;
const swapOf=(d,id)=>{const v=d&&d.lifts&&d.lifts[id+"__alt"];return typeof v==="string"&&v?v:null;};
const trR5=n=>Math.round(n/5)*5;
/* +10 lb on barbell lower-body lifts, +5 lb everywhere else */
const incFor=(e,wkId)=>/^L/.test(wkId||"")&&isBarbell(e)?10:5;
const isBW=e=>(e.eq||[]).includes("Bodyweight");
function partnerOf(W,e){const m=/^([A-Z])(\d)$/.exec(e.pair||"");if(!m)return null;return W.ex.find(x=>x!==e&&x.pair&&x.pair[0]===m[1]&&x.pair!==e.pair)||null;}
const curWkId=k=>S.trainWk||(planFor(k).sch||{}).lift||null;

/* ---------- history ---------- */
/* history only counts days done with the same variant: planned vs planned, or the same swap */
const altAt=(k,id)=>swapOf(S.days[k],id)||"";
function lastLift(id,k){
  const alt=altAt(k,id);
  const ks=Object.keys(S.days).filter(x=>x<k&&S.days[x].lifts&&S.days[x].lifts[id]&&S.days[x].lifts[id].some(s=>s&&s.w!=null)&&altAt(x,id)===alt).sort();
  if(!ks.length)return null;const x=ks[ks.length-1];return {k:x,sets:S.days[x].lifts[id]};
}
function prevBest(id,k){
  let best=0;const alt=altAt(k,id);
  Object.keys(S.days).forEach(x=>{if(x>=k||altAt(x,id)!==alt)return;const a=S.days[x].lifts&&S.days[x].lifts[id];if(a)a.forEach(s=>{if(logged(s))best=Math.max(best,e1rm(+s.w,+s.r));});});
  return best;
}
/* progression: every logged set at the top of the range → +5 lb, else same weight and +1 rep */
function suggest(e,k,pl,wkId){
  const last=lastLift(e.id,k);if(!last)return null;
  const lg=last.sets.filter(logged),sets=lg.length?lg:last.sets.filter(s=>s&&s.w!=null);if(!sets.length)return null;
  const top=Math.max(...sets.map(s=>+s.w)), rr=parseReps(e.r);
  const work=sets.filter(s=>+s.w===top&&s.r!=null);
  if(pl.deload)return {w:top,kind:"deload"};
  if(isBW(e)&&top<=0)return {w:0,kind:"reps"};
  const allTop=rr&&sets.every(s=>s.r!=null&&s.r>=rr.hi);
  if(allTop){const inc=incFor(e,wkId);return {w:top+inc,kind:"up",inc};}
  const beat=work.length?Math.min(...work.map(s=>+s.r)):null;
  return {w:top,kind:"same",beat};
}
function exStats(e,k,pl){
  const n=trSets(e,pl), rows=(getDay(k).lifts[e.id])||[];
  let done=0,vol=0,best=0,bestI=-1;
  for(let i=0;i<n;i++){const s=rows[i];if(logged(s)){done++;vol+=(+s.w)*(+s.r);const v=e1rm(+s.w,+s.r);if(v>best){best=v;bestI=i;}}}
  // sets logged beyond the planned count still count toward volume
  for(let i=n;i<rows.length;i++){const s=rows[i];if(logged(s))vol+=(+s.w)*(+s.r);}
  const pb=prevBest(e.id,k);
  return {n,done,vol,best,bestI,pr:pb>0&&best>pb,prev:pb};
}
function sessionVol(ids,k){let v=0,sets=0;const d=S.days[k];if(!d)return {v,sets};ids.forEach(id=>((d.lifts&&d.lifts[id])||[]).forEach(s=>{if(logged(s)){v+=(+s.w)*(+s.r);sets++;}}));return {v,sets};}
function prevSession(ids,k){
  const ks=Object.keys(S.days).filter(x=>x<k&&ids.some(id=>(S.days[x].lifts&&S.days[x].lifts[id]||[]).some(logged))).sort();
  return ks.length?ks[ks.length-1]:null;
}

/* ---------- interval timer ---------- */
/* plan for a date: intervalPlan(k), or (on an off day) that week's Saturday tread plan */
function ivPlan(k){
  const ip=typeof intervalPlan==="function"?intervalPlan(k):null;if(ip)return Object.assign({sched:true},ip);
  const pl=planFor(k),c=typeof COND!=="undefined"&&COND[Math.min(Math.max(pl.week,1),12)];
  if(c&&c.sat)return {sched:false,mode:"tread",text:c.sat.text,segments:c.sat.segments,mins:Math.round(c.sat.segments.reduce((a,x)=>a+x.s,0)/60),rpe:"RPE 6 or less: conversational."};
  const p=pl.proto||{run:60,walk:120,rounds:6,warm:300,cool:300},sg=[{t:"Warm-up walk",s:p.warm||300,c:"walk"}];
  for(let r=1;r<=p.rounds;r++){sg.push({t:"Run",s:p.run,c:"run",r});sg.push({t:"Walk",s:p.walk,c:"walk",r});}
  sg.push({t:"Cool-down",s:p.cool||300,c:"walk"});return {sched:false,mode:"tread",text:"",segments:sg,mins:Math.round(sg.reduce((a,x)=>a+x.s,0)/60),rpe:""};
}
const segTone=c=>c==="hard"||c==="run"?"run":"walk";
function segInfo(ph){if(!ph)return "";const a=[];if(ph.mph!=null)a.push(`${(+ph.mph).toFixed(1)} mph`);if(ph.incline!=null)a.push(`${ph.incline}% incline`);if(ph.z)a.push(ph.z);return a.join(" · ");}
function buildPhases(ip){return (ip.segments||[]).filter(x=>x&&x.s>0).map(x=>Object.assign({},x,{c:segTone(x.c),kind:x.c}));}
const timerStarted=()=>T.running||T.i>0||(T.phases.length&&T.left<T.phases[0].s*1000);
function resetTimer(k){clearInterval(T.iv);const ip=ivPlan(k);T.mode=ip.mode==="bike"?"bike":"tread";T.phases=buildPhases(ip);if(!T.phases.length)T.phases=[{t:"Warm-up",s:300,c:"walk"}];T.i=0;T.left=T.phases[0].s*1000;T.running=false;T.finished=false;T.date=k;T.key=k+"|"+T.mode;T.total=T.phases.reduce((a,b)=>a+b.s,0);releaseLock();}
function announce(msg){const el=$("#tlive");if(el)el.textContent=msg;}
function phaseSay(){const ph=T.phases[T.i];if(!ph)return "Session complete";const rounds=Math.max(...T.phases.map(x=>x.r||0));const inf=segInfo(ph);return `${ph.t}${ph.r?`, round ${ph.r} of ${rounds}`:""}, ${fmtS(ph.s)}${inf?", "+inf:""}`;}
function treadSpeeds(sg){const run=[...new Set(sg.filter(x=>x.c==="run"&&x.mph!=null).map(x=>(+x.mph).toFixed(1)))],walk=[...new Set(sg.filter(x=>x.t==="Walk"&&x.mph!=null).map(x=>(+x.mph).toFixed(1)))],inc=(sg.find(x=>x.incline!=null)||{}).incline;
  if(!run.length)return "";return `Run ${run.join(" / ")} mph · Walk ${walk.join(" / ")||"3.3"} mph${inc!=null?` @ ${inc}%`:""}`;}

/* ---------- render ---------- */
/* ---------- focus mode: work order, next target, open exercise ---------- */
/* supersets interleave: A1 set 1, A2 set 1, A1 set 2, … */
function workOrder(W,pl){
  const out=[],seen=new Set();
  W.ex.forEach(e=>{if(seen.has(e.id)||!counted(e))return;
    const m=partnerOf(W,e);
    if(m&&counted(m)&&!seen.has(m.id)){const a=e.pair<m.pair?e:m,b=a===e?m:e,na=trSets(a,pl),nb=trSets(b,pl);
      for(let i=0;i<Math.max(na,nb);i++){if(i<na)out.push({e:a,i});if(i<nb)out.push({e:b,i});}
      seen.add(a.id);seen.add(b.id);}
    else{for(let i=0;i<trSets(e,pl);i++)out.push({e,i});seen.add(e.id);}});
  return out;
}
function nextTarget(W,k,pl){const d=getDay(k);return workOrder(W,pl).find(x=>!logged(((d.lifts[x.e.id])||[])[x.i]))||null;}
function openId(W,wkId,k,pl){
  if(getDay(k).checks.lift)return null;
  const o=TR.open[k];if(o&&o.wk===wkId&&W.ex.some(e=>e.id===o.id))return o.id;
  const t=nextTarget(W,k,pl);return t?t.e.id:null;
}
const isBarbell=e=>{const q=e.eq||[];return q.includes("Rack")&&!q.includes("DB")&&!q.includes("Bodyweight")&&/barbell|squat|deadlift|rdl|press/i.test(e.n);};
function plates(w){
  w=+w;if(!(w>0))return "";if(w<45)return "Less than the 45 lb bar";if(w===45)return "Empty bar";
  let side=(w-45)/2;const used=[];for(const p of [45,35,25,10,5,2.5]){while(side>=p-1e-9){used.push(p);side-=p;}}
  const txt=used.length?used.join(" + "):"none";
  return `${fw(w)} → ${txt} per side${side>0.01?` (+${fw(side*2)} lb short)`:""}`;
}

function exHtmlFor(W,wkId,e,ei,st,k,pl,d,openI,tgtId){
  const sets=st.n, rows=(d.lifts[e.id])||[], last=lastLift(e.id,k), sg=suggest(e,k,pl,wkId), alt=swapOf(d,e.id), bar=isBarbell(e)&&!(alt&&/\bDB\b|smith|cable/i.test(alt));
  const name=alt||e.n, open=W.ex[openI]===e;
  let g=`<div class="srow hd" aria-hidden="true"><span>Set</span><span>${isBW(e)?"Added lb":"Weight, lb"}</span><span>Reps</span><span></span></div>`;
  for(let i=0;i<sets;i++){const r=rows[i]||{};const lw=last&&last.sets[i]?last.sets[i]:{};
    g+=`<div class="srow" data-row="${i}"><span class="sn">${i+1}</span><input inputmode="decimal" type="number" step="2.5" min="0" data-lift="${esc(e.id)}|${i}|w" value="${esc(r.w??"")}" placeholder="${esc(lw.w??"")}" aria-label="${esc(name)} set ${i+1} weight"><input inputmode="numeric" type="number" min="0" data-lift="${esc(e.id)}|${i}|r" value="${esc(r.r??"")}" placeholder="${esc(lw.r??"")}" aria-label="${esc(name)} set ${i+1} reps"><span class="st" aria-hidden="true"></span>${bar?`<span class="pm" data-pm="${i}"></span>`:""}</div>`;}
  const shown=last?(last.sets.some(logged)?last.sets.filter(logged):last.sets.filter(s=>s&&s.w!=null)):[];
  const lastTxt=shown.map(s=>`${esc(s.w)}×${esc(s.r??"?")}`).join(", ");
  let sug="";
  if(sg){const chip=sg.kind==="reps"?`<span class="chip up">+1–2 reps</span>`:sg.kind==="up"?`<span class="chip up">↑ +${sg.inc||5} lb</span>`:sg.kind==="deload"?`<span class="chip">Deload: same weight</span>`:`<span class="chip">= same${sg.beat!=null?`, beat ${sg.beat} reps`:""}</span>`;
    sug=`<div class="sug"><span class="lbl">Today</span><b class="num">${isBW(e)&&!(sg.w>0)?"Bodyweight":fw(sg.w)} × ${esc(e.r)}</b>${chip}</div>`;}
  const fill=last?`<button class="linkbtn fillb" data-act="fill" data-v="${esc(e.id)}">Fill from last</button>`:"";
  const mate=partnerOf(W,e);
  const tags=[`<span>Rest ${esc(e.rest)}</span>`];
  if(e.pair&&mate)tags.push(`<span class="pair">${esc(e.pair)}</span><span>with ${esc(swapOf(d,mate.id)||mate.n)}</span>`);
  const cues=Array.isArray(e.cues)?e.cues:[];
  const how=`<details class="how"><summary>How to</summary><div class="hb">${(e.eq||[]).length?`<div class="tags">${e.eq.map(x=>`<span class="eq">${esc(x)}</span>`).join("")}</div>`:""}${e.setup?`<p><b>Setup:</b> ${esc(e.setup)}</p>`:""}${cues.length?`<ul>${cues.map(c=>`<li>${esc(c)}</li>`).join("")}</ul>`:""}${e.tip?`<p>${esc(e.tip)}</p>`:""}${e.restNote?`<p class="note">Rest: ${esc(e.restNote)}</p>`:""}</div></details>`;
  const alts=Array.isArray(e.alts)?e.alts:[];
  const swap=alts.length?`<details class="swapd"><summary>${alt?"Change swap":"Swap"}</summary><div class="sl" role="group" aria-label="Alternatives for ${esc(e.n)}">${alts.map(a=>`<button class="sopt${alt===a?" on":""}" data-act="swap" data-v="${esc(e.id)}" data-alt="${esc(a)}" aria-pressed="${alt===a}">${esc(a)}</button>`).join("")}${alt?`<button class="sopt" data-act="swap" data-v="${esc(e.id)}" data-alt="">Back to ${esc(e.n)}</button>`:""}</div></details>`:"";
  const tgt=e.id===tgtId;
  return `<div class="ex${open?" open":""}${tgt?" cur":""}${st.done>=st.n?" full":""}${e.optional?" opt":""}" data-ex="${esc(e.id)}">
    <button class="exrow" data-act="exopen" data-v="${esc(e.id)}" aria-expanded="${open}"><span class="ix" aria-hidden="true"><i>${ei+1}</i>${CHECK}</span><span class="nm"><span class="now">Up next</span><span class="exn">${esc(name)}</span><span class="rl"><span class="rx">${sets} × ${esc(e.r)}</span><span class="ro">Rest ${esc(e.rest)}</span>${e.pair&&mate?`<span class="pt">${esc(e.pair)}</span><span class="ro">with ${esc(swapOf(d,mate.id)||mate.n)}</span>`:""}${e.optional?'<span class="pt">Optional</span>':""}<span class="badge good prb"${st.pr?"":" hidden"}>PR</span></span></span><span class="cnt" data-cnt>${st.done}/${st.n}</span></button>
    <div class="exb">
      ${alt?`<p class="was">Swapped in for ${esc(e.n)} today.</p>`:""}
      ${sug||fill?`<div class="tgt">${sug||'<span class="muted">No suggestion yet</span>'}${fill}</div>`:""}
      <div class="sets2">${g}</div>
      <div class="last">${last?`Last time (${short(last.k)}): <b>${lastTxt}</b>`:"First time logging this"}</div>
      <div class="ex-more">${how}${swap}</div>
    </div></div>`;
}

function warmupHtml(W,wkId,k,pl){
  const list=(typeof WARMUPS!=="undefined"&&W.warmup&&WARMUPS[W.warmup])||[];
  const re=W.ramp&&W.ex.find(x=>x.id===W.ramp);let ramp="";
  if(re){const sg=suggest(re,k,pl,wkId),bar=(re.eq||[]).includes("Rack"),labels=typeof RAMP!=="undefined"?RAMP:["empty bar ×10","40% ×6","60% ×4","75% ×2","85–90% ×1"],pct=typeof RAMP_PCT!=="undefined"?RAMP_PCT:[null,.4,.6,.75,.875];
    const rows=labels.map((lab,i)=>{const reps=(/×\s*\d+/.exec(lab)||[""])[0];const p=pct[i];
      if(p==null)return `<li><b>${bar?"Empty bar (45)":"Light DBs"}</b> ${esc(reps)}</li>`;
      if(!sg)return `<li><b>${esc(lab.replace(/\s*×.*/,""))}</b> ${esc(reps)}</li>`;
      return `<li><b>${Math.max(bar?45:5,trR5(sg.w*p))} lb</b> ${esc(reps)} <span class="muted">(${esc(lab.replace(/\s*×.*/,""))})</span></li>`;}).join("");
    ramp=`<div class="ramp"><div class="eyebrow">Ramp sets · ${esc(re.n)}</div>${sg?`<p class="note">Built from today's working weight of ${fw(sg.w)} lb.</p>`:`<p class="note">Percent of your first working weight. Weights fill in after you log this lift once.</p>`}<ol>${rows}<li><b>Working sets</b></li></ol></div>`;}
  if(!list.length&&!ramp)return "";
  return `<details class="tr-warm" id="warm"><summary><span><b>Warm-up (5 min)</b></span></summary><div class="wb">${list.length?`<ul class="wl">${list.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}${ramp}</div></details>`;
}
/* zones with no rounding gaps: each zone starts 1 W above the previous one's top */
function zonesHtml(ftp){
  const Z=typeof ZONES==="function"?ZONES(ftp):null;
  if(!Z)return `<p class="callout"><span>Set your FTP after Week 2's test to see your zones in watts.</span></p>`;
  const zz=Z.map((z,i)=>({z:z.z,lo:i?Z[i-1].hi+1:z.lo,hi:z.hi}));
  return `<div class="zones"><div class="eyebrow">Your zones · FTP ${esc(ftp)} W</div><div class="zg">${zz.map(z=>`<span class="z z${z.z}"><b>Z${z.z}</b> ${z.lo}${z.hi!=null?"–"+z.hi:"+"} W</span>`).join("")}</div></div>`;
}
const anyLogged=d=>Object.keys(d.lifts||{}).some(id=>Array.isArray(d.lifts[id])&&d.lifts[id].some(logged));
TR.blk={};TR.blkFirst={};
function blkOpen(k,logged1){
  const u=TR.blk[k];if(u&&u.logged===logged1)return u.open;if(logged1)return false;   // a toggle from before the first set doesn't keep it openif(TR.blkFirst[k])return true;
  let seen=false;try{seen=localStorage.getItem("ll.blk."+k)==="1";localStorage.setItem("ll.blk."+k,"1");}catch(_){}
  if(!seen){TR.blkFirst[k]=true;return true;}return false;
}
function blockHtml(k,b,wk,dur,prog,guide,logged1){
  return `<details class="blk" data-blk="${k}"${blkOpen(k,logged1)?" open":""}><summary><b>Week ${wk} · ${esc(b.name)}</b><span>RIR ${esc(b.rir)}${dur?` · ${esc(dur)}`:""}</span></summary><div class="bb"><p>${esc(b.note||"")}${guide}</p><p class="note">${esc(prog)}</p></div></details>`;
}
document.addEventListener("toggle",e=>{const t=e.target;if(t&&t.dataset&&t.dataset.blk)TR.blk[t.dataset.blk]={open:t.open,logged:anyLogged(getDay(t.dataset.blk))};},true);
function renderTrain(){
  const k=S.date, pl=planFor(k), d=getDay(k), sch=pl.sch||{};
  const wkId=curWkId(k);
  const moved=S.trainWk&&S.trainWk!==sch.lift;
  const seg=`<div class="seg" role="group" aria-label="Workout">${Object.keys(WORKOUTS).map(id=>`<button class="${id===wkId?"on":""}" data-act="wk" data-v="${id}" aria-pressed="${id===wkId}">${esc(WORKOUTS[id].name)}</button>`).join("")}</div>`;
  let lift="",banner="";
  if(wkId&&WORKOUTS[wkId]){
    const W=WORKOUTS[wkId], done=!!d.checks.lift;
    const stats=W.ex.map(e=>exStats(e,k,pl));
    const tot=stats.reduce((a,s,i)=>a+(counted(W.ex[i])?s.n:0),0), got=stats.reduce((a,s,i)=>a+(counted(W.ex[i])?Math.min(s.done,s.n):0),0);
    const oid=openId(W,wkId,k,pl), openI=W.ex.findIndex(e=>e.id===oid), nt=nextTarget(W,k,pl), tgtId=nt&&!done?nt.e.id:null;
    const prog=W.prog||"Add 1 rep each session. Once every set hits the top of the range, add 5 lb. Stop each set with 1–2 reps left.";
    const b=pl.block||(typeof blockFor==="function"?blockFor(pl.week):null);
    const dur=typeof liftDur==="function"?`about ${liftDur(wkId,pl.week)} min`:typeof durationFor==="function"?durationFor(wkId,pl.week):"";
    const wk=Math.min(Math.max(pl.week,1),12);
    const fresh=W.ex.filter(e=>counted(e)&&!lastLift(e.id,k)), hist=W.ex.some(e=>lastLift(e.id,k));
    const rir=(b&&b.rir)||"2–3";
    const guide=done||!fresh.length?"":` <b>${fresh.length===W.ex.filter(counted).length?"First time:":`New lift${fresh.length===1?"":"s"} (${fresh.length}):`}</b> pick weights you can lift for the top of each range at RIR ${esc(rir)}. Next time the app suggests them.`;
    banner=b?blockHtml(k,b,wk,dur,prog,guide,anyLogged(d)):`<p class="note">${esc(prog)}${guide}</p>`;
    const fillAll=!done&&hist?`<button class="linkbtn chg" data-act="fillall">Fill all from last</button>`:"";
    const exHtml=W.ex.map((e,ei)=>exHtmlFor(W,wkId,e,ei,stats[ei],k,pl,d,openI,tgtId)).join("");
    lift=`<section class="card tr-lift" id="lcard" data-wk="${esc(wkId)}"><div class="card-h"><div>${moved?`<div class="eyebrow">Logging to ${nice(k)}</div>`:""}<h2>${esc(wkName(wkId))}</h2><div class="hl">${!S.trainWk&&!TR.pick[k]&&sch.lift?`<button class="linkbtn chg" data-act="wkopen" aria-expanded="false">Change workout</button>`:""}${fillAll}</div></div>${done?'<span class="badge good">Done</span>':`<span class="badge" data-tot>${got}/${tot} sets</span>`}</div>
      ${done?summaryHtml(W,k,pl):""}
      <div class="card-b intro">
      ${moved?`<div class="callout warn"><div>${sch.lift?`Today is scheduled for <b>${esc(wkName(sch.lift))}</b>.`:"No lift is scheduled today."} You're logging <b>${esc(wkName(wkId))}</b> as a moved session.</div></div>`:""}
      ${pl.deload?`<div class="callout warn"><div><b>Deload week.</b> One fewer set per exercise at the same weights or 10% lighter, about 3 reps in reserve.</div></div>`:""}
      ${warmupHtml(W,wkId,k,pl)}
      </div>
      <div class="exs">${exHtml}</div>
      <div class="tr-fin${done?" done":""}" id="lfin"><div class="fc"><div><b data-fin>${got}/${tot}</b> sets logged</div><div class="tbar"><i data-finbar style="width:${tot?got/tot*100:0}%"></i></div></div>
        <button class="btn ${done||got*2<tot?"sec":""}" data-act="liftdone" aria-pressed="${done}">${done?"Undo finish":"Finish workout"}</button></div>
    </section>`;
  } else lift=`<section class="card"><div class="card-b"><h2>No lifting today</h2><p class="muted">${esc(dayHeadline(pl))}. If you moved a session, tap “Log a moved lift” above and it will log to ${nice(k)}.</p></div></section>`;

  if(!timerStarted()||T.finished&&T.date!==k)resetTimer(k);
  const other=T.date&&T.date!==k, ip=ivPlan(T.date||k), bike=ip.mode==="bike";
  if(S.trainFocus==="intervals")TR.show[k]=true;
  const showFull=sch.intervals||timerStarted()||TR.show[k]||other;
  const wkT=Math.min(Math.max(planFor(T.date).week,1),12);
  const ivTitle=bike?`Peloton bike · ${ip.short||"Power Zone"}`:"Tread run/walk intervals";
  let lead="";
  if(bike){
    const ftp=ST().ftp, Z=typeof ZONES==="function"?ZONES(ftp):null;
    const zones=`<div class="zwrap">${zonesHtml(ftp)}</div>`;
    const askFtp=ip.ftpTest||(!Z&&wkT>=2);
    lead=`<div class="ivlead"><div class="eyebrow">Take this class</div><p class="cls">${esc(ip.cls||ip.text||"")}</p>${ip.peloton?`<p class="note">${esc(ip.peloton.filters)}. ${esc(ip.peloton.note)}</p>`:""}</div>${zones}
      ${askFtp?`<label class="ftp"><span>${ip.ftpTest?"Enter your new FTP":"Set your FTP"}</span><input id="t-ftp" type="number" inputmode="numeric" min="50" max="600" value="${esc(ftp??"")}" placeholder="watts"><span class="muted">W</span></label>`:""}
      <div class="eyebrow fbk">No class? Use this timer${ip.fallbackMins?` (${ip.fallbackMins} min)`:""}</div>`;
  }else{
    const sp=treadSpeeds(ip.segments||[]);
    lead=`<div class="ivlead"><p class="cls">${esc(ip.text||"")}</p>${sp?`<p class="spd"><b>${esc(sp)}</b></p>`:""}${ip.peloton?`<p class="note">${esc(ip.peloton.filters)}. ${esc(ip.peloton.note)}</p>`:""}</div>`;
  }
  const guide=esc(ip.rpe||"");
  const timer=showFull?`<section class="card tr-iv" id="tcard"><div class="card-h"><div><div class="eyebrow">${sch.intervals?"Scheduled today":"Not scheduled today"} · about ${esc(ip.mins||"")} min</div><h2>${esc(ivTitle)}</h2></div>${d.checks.intervals?'<span class="badge good">Done</span>':(!sch.intervals&&!timerStarted()?`<button class="btn sec sm" data-act="thide">Hide</button>`:"")}</div>
     <div class="card-b">${other?`<div class="callout warn"><div>This timer is running for <b>${nice(T.date)}</b>. Finishing it checks off that day.</div></div>`:""}
     ${lead}
     <div class="timer" id="timer" role="timer" aria-label="Interval timer"></div>
     <p class="tr-vh" id="tlive" aria-live="polite" aria-atomic="true"></p>
     <div class="row tctl"><button class="btn" id="tgo" data-act="tgo">Start</button><button class="btn sec" data-act="treset">Reset</button></div>
     <p class="note">${guide?`<b>${guide}</b> `:""}Beeps mark every change and the screen stays on.</p></div></section>`
   :`<section class="card tr-iv-c" id="tcard"><div class="card-b"><div class="ivt">No intervals today<span class="muted"> · ${esc(bike?"bike":"tread run/walk")}</span></div><button class="linkbtn" data-act="tshow">Run intervals anyway</button></div></section>`;
  const walkDone=!!d.checks.walk;
  const wchips=sch.walkMin&&!/mph/.test(sch.walk||"")?`<div class="wch"><span class="eq">${esc(sch.walkMin)} min</span>${sch.walkMph?`<span class="eq">${(+sch.walkMph).toFixed(1)} mph</span>`:""}${sch.walkIncline!=null?`<span class="eq">${esc(sch.walkIncline)}% incline</span>`:""}</div>`:"";
  const walk=`<section class="card tr-walk" id="wcard"><div class="card-h"><div><div class="eyebrow">${sch.optionalWalk?"Optional cardio":"Cardio"}</div><h2>${esc(sch.walk||"Walk")}</h2></div>${walkDone?'<span class="badge good">Done</span>':""}</div><div class="card-b">${wchips}<p class="note">${esc(sch.walkNote||"Steady pace you could talk through.")}</p>
    <div><button class="btn ${walkDone?"ok":""}" data-act="walkdone" aria-pressed="${walkDone}">${walkDone?"Walk done ✓ (tap to undo)":"Mark walk done"}</button></div></div></section>`;
  const liftDone=!!d.checks.lift&&!!wkId;
  const order= sch.intervals&&!sch.lift ? timer+walk+(S.trainWk?lift:"") : sch.intervals&&(sch.cardioFirst||liftDone) ? (liftDone&&!sch.cardioFirst?timer+walk+lift:timer+lift+walk) : lift+(sch.intervals?timer:"")+walk+(sch.intervals?"":timer);
  const pickOpen=!!S.trainWk||!!TR.pick[k];
  return `<div class="trn"><div class="phead"><button class="icon-btn" data-act="day" data-v="-1" aria-label="Previous day">${ICON.l}</button><div class="t"><div class="eyebrow">${pl.inProg?`Week ${pl.week} · Day ${pl.idx+1}`:pl.pre?"Preview":"After program"}</div><h1>${nice(k)}</h1></div><button class="icon-btn" data-act="day" data-v="1" aria-label="Next day">${ICON.r}</button></div>
    ${pickOpen||!sch.lift||S.trainWk?`<div class="row pick">`:"<div hidden>"}${pickOpen?seg:sch.lift?"":`<button class="btn sec" data-act="wkopen" aria-expanded="false">Log a moved lift</button>`}${S.trainWk?`<button class="btn sec sm" data-act="wk" data-v="">Back to scheduled</button>`:""}</div>${banner}${order}</div>`;
}

function summaryHtml(W,k,pl){
  const ids=W.ex.map(e=>e.id), cur=sessionVol(ids,k);
  const prs=[];W.ex.forEach(e=>{const st=exStats(e,k,pl);if(st.pr){const s=getDay(k).lifts[e.id][st.bestI];prs.push(`${esc(e.n)} ${esc(s.w)}×${esc(s.r)}`);}});
  const pk=prevSession(ids,k);let vs="Baseline set: next time you beat this.",cmp=null,cls="";
  if(pk){const pv=sessionVol(ids,pk),dv=cur.v-pv.v,pct=pv.v?Math.round(dv/pv.v*100):null;
    cmp=pct==null?null:`${pct>0?"+":""}${pct}%`;cls=dv>0?"good":dv<0?"warn":"";
    vs=`vs ${short(pk)}: ${dv>=0?"+":"−"}${Math.abs(Math.round(dv)).toLocaleString()} lb volume, ${cur.sets-pv.sets>=0?"+":"−"}${Math.abs(cur.sets-pv.sets)} sets.`;}
  return `<div class="tr-sum" id="tsum" tabindex="-1"><div class="eyebrow">Session summary</div>
    <div class="sg"><div><b>${cur.sets}</b><span>set${cur.sets===1?"":"s"}</span></div><div><b>${Math.round(cur.v).toLocaleString()}</b><span>lb volume</span></div>${prs.length?`<div><b>${prs.length}</b><span>PR${prs.length===1?"":"s"}</span></div>`:""}${cmp?`<div><b class="${cls}">${cmp}</b><span>vs ${short(pk)}</span></div>`:""}</div>
    ${prs.length?`<p><b>PRs:</b> ${prs.join(", ")}</p>`:""}<p class="${pk?"muted":"base"}">${vs}</p></div>`;
}

/* in-place refresh of set state (no re-render, keeps focus) */
function paintLift(){
  const card=$(".tr-lift");if(!card)return;
  const k=S.date,pl=planFor(k),wkId=card.dataset.wk,W=WORKOUTS[wkId];if(!W)return;
  const d=getDay(k),done=!!d.checks.lift;let tot=0,got=0;
  const oid=openId(W,wkId,k,pl), nt=done?null:nextTarget(W,k,pl);
  W.ex.forEach(e=>{
    const el=card.querySelector(`.ex[data-ex="${CSS.escape(e.id)}"]`);if(!el)return;
    const st=exStats(e,k,pl),rows=(d.lifts[e.id])||[];if(counted(e)){tot+=st.n;got+=Math.min(st.done,st.n);}
    el.querySelector("[data-cnt]").textContent=`${st.done}/${st.n}`;
    el.querySelector(".prb").hidden=!st.pr;
    el.classList.toggle("full",st.done>=st.n);
    const open=e.id===oid;el.classList.toggle("open",open);
    const rb=el.querySelector(".exrow");if(rb)rb.setAttribute("aria-expanded",String(open));
    el.classList.toggle("cur",!!nt&&nt.e.id===e.id);
    el.querySelectorAll(".srow[data-row]").forEach(r=>{const i=+r.dataset.row,s=rows[i],ok=logged(s);
      const isPr=ok&&st.pr&&i===st.bestI;
      r.classList.toggle("ok",ok);r.classList.toggle("pr",isPr);
      r.classList.toggle("next",!!nt&&nt.e.id===e.id&&nt.i===i);
      const stc=r.querySelector(".st");const h=isPr?'<span class="prt">PR</span>':ok?CHECK:"";if(stc.innerHTML!==h)stc.innerHTML=h;
      const pm=r.querySelector("[data-pm]");if(pm){const inp=r.querySelector('[data-lift$="|w"]');pm.textContent=inp&&inp.value!==""?plates(inp.value):"";}});
  });
  const f=card.querySelector("[data-fin]");if(f)f.textContent=`${got}/${tot}`;
  const fb=card.querySelector("[data-finbar]");if(fb)fb.style.width=(tot?got/tot*100:0)+"%";
  const fbtn=card.querySelector("[data-act=liftdone]");if(fbtn&&!done)fbtn.classList.toggle("sec",got*2<tot);
  const tb=card.querySelector("[data-tot]");if(tb)tb.textContent=`${got}/${tot} sets`;
  const blk=document.querySelector(".trn details.blk");if(blk&&blk.open&&got>0){const u=TR.blk[k];if(!(u&&u.logged&&u.open))blk.open=false;}
}
function setOpen(id,scroll){
  const k=S.date,wkId=curWkId(k);if(!wkId)return;TR.open[k]={wk:wkId,id};paintLift();
  if(scroll){const el=document.querySelector(`.tr-lift .ex[data-ex="${CSS.escape(id)}"]`);el&&el.scrollIntoView({block:"start"});}
}
/* open the exercise of a target set and focus its first empty input */
function goTarget(t,focus){
  if(!t)return;setOpen(t.id,false);
  const row=document.querySelector(`.tr-lift [data-lift="${CSS.escape(t.id)}|${t.i}|w"]`);if(!row)return;
  const w=row,r=document.querySelector(`.tr-lift [data-lift="${CSS.escape(t.id)}|${t.i}|r"]`);
  const inp=w.value===""?w:(r&&r.value===""?r:w);
  if(focus)inp.focus({preventScroll:true});
  inp.scrollIntoView({block:"center"});
}

/* ---------- interval timer paint/tick ---------- */
function paintTimer(){
  const el=$("#timer");if(!el)return;
  const ph=T.phases[T.i]||{t:"Done",s:0,c:"done"};
  const secs=Math.max(0,Math.ceil(T.left/1000));
  const rounds=Math.max(...T.phases.map(x=>x.r||0));
  const elapsed=T.finished?T.total:T.phases.slice(0,T.i).reduce((a,b)=>a+b.s,0)+(ph.s-T.left/1000);
  const remain=Math.max(0,Math.round(T.total-elapsed));
  el.className="timer "+(T.finished?"done":ph.c);
  const nx=T.phases[T.i+1];
  const html=`<div class="ph">${T.finished?"Session complete":esc(ph.t)+(ph.r?` · round ${ph.r} of ${rounds}`:"")}</div>
    <div class="clock">${T.finished?"0:00":Math.floor(secs/60)+":"+pad(secs%60)}</div>
    <div class="spd">${T.finished?"":esc(segInfo(ph))}</div>
    <div class="tbar"><i style="width:${Math.min(100,elapsed/T.total*100)}%"></i></div>
    <div class="meta"><span>${T.finished?"Checked off on "+short(T.date):nx?"Next: "+esc(nx.t)+" "+fmtS(nx.s)+(segInfo(nx)?" · "+esc(segInfo(nx)):""):"Last block"}</span><span class="num">${Math.floor(remain/60)}:${pad(remain%60)} left</span></div>`;
  if(!el.firstChild){el.innerHTML=html;}
  else{ // update text nodes in place to keep DOM churn low
    const tmp=document.createElement("div");tmp.innerHTML=html;
    [".ph",".clock",".spd",".meta"].forEach(s=>{const a=el.querySelector(s),b=tmp.querySelector(s);if(a&&b&&a.innerHTML!==b.innerHTML)a.innerHTML=b.innerHTML;});
    const a=el.querySelector(".tbar i"),b=tmp.querySelector(".tbar i");if(a&&b)a.style.width=b.style.width;}
  const g=$("#tgo");if(g)g.textContent=T.finished?"Start again":T.running?"Pause":timerStarted()?"Resume":"Start";
}
function beep(n,f){try{if(!T.ctx)return;if(T.ctx.state==="suspended")T.ctx.resume();for(let i=0;i<n;i++){const o=T.ctx.createOscillator(),g=T.ctx.createGain();o.frequency.value=f;o.connect(g);g.connect(T.ctx.destination);const t=T.ctx.currentTime+i*.22;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.35,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.18);o.start(t);o.stop(t+.2);}}catch(e){}}
function ensureAudio(){try{if(!T.ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;T.ctx=new C();
    const b=T.ctx.createBuffer(1,1,22050),s=T.ctx.createBufferSource();s.buffer=b;s.connect(T.ctx.destination);s.start(0);} // iOS unlock
  if(T.ctx.state==="suspended")T.ctx.resume();}catch(e){}}
function buzz(p){try{navigator.vibrate&&navigator.vibrate(p);}catch(e){}}
async function getLock(){try{if(navigator.wakeLock)T.lock=await navigator.wakeLock.request("screen");}catch(e){}}
function releaseLock(){try{T.lock&&T.lock.release();}catch(e){}T.lock=null;}
function tick(){
  const now=Date.now();T.left-=now-T.last;T.last=now;
  let changed=false;
  while(T.left<=0&&!T.finished){T.i++;changed=true;
    if(T.i>=T.phases.length){T.finished=true;T.running=false;T.left=0;clearInterval(T.iv);beep(3,1046);buzz([300,120,300]);releaseLock();
      const d=ensureDay(T.date);d.checks.intervals=true;saveDay(T.date);toast(`Intervals done and checked off for ${short(T.date)}`);announce("Session complete");
      if(S.date===T.date){
        if(S.tab==="today")patch();
        else if(S.tab==="train"){const a=document.activeElement;
          if(a&&a.tagName==="INPUT"){const h=$("#tcard .card-h");if(h&&!h.querySelector(".badge.good")){const x=h.querySelector("[data-act=thide]");x&&x.remove();h.insertAdjacentHTML("beforeend",'<span class="badge good">Done</span>');}}
          else{rerenderKeepScroll();return;}}
      }}
    else T.left+=T.phases[T.i].s*1000;}
  if(changed&&!T.finished){const c=segTone(T.phases[T.i].c);beep(c==="run"?2:1,c==="run"?988:660);buzz(c==="run"?[200,80,200]:200);announce(phaseSay());}
  paintTimer();
}
function toggleTimer(){
  ensureAudio();
  if(T.finished)resetTimer(S.date);
  if(T.running){T.running=false;clearInterval(T.iv);releaseLock();announce("Paused");}
  else{if(!timerStarted()&&T.date!==S.date)resetTimer(S.date);T.running=true;T.last=Date.now();clearInterval(T.iv);T.iv=setInterval(tick,250);getLock();beep(1,660);announce(phaseSay());}
  paintTimer();
}

/* ---------- rest timer (dock above the tab bar) ---------- */
function restDock(){
  let el=document.getElementById("restdock");
  if(!el){el=document.createElement("div");el.id="restdock";el.className="tr-rest";el.setAttribute("role","region");el.setAttribute("aria-label","Rest timer");el.hidden=true;
    el.innerHTML=`<div class="rt"><div class="rk">Rest</div><div class="rn"></div></div>
      <div class="rc mono" aria-hidden="true">0:00</div>
      <div class="rb"><button class="btn sec sm" data-act="rest30">+30 s</button><button class="btn sec sm" data-act="restskip">Skip</button></div>
      <div class="rbar"><i></i></div><p class="tr-vh" aria-live="assertive" data-rlive></p>`;
    document.body.appendChild(el);}
  return el;
}
function restVisible(){const el=document.getElementById("restdock");const on=!!TR.rest&&S.tab==="train";if(el)el.hidden=!on;document.body.classList.toggle("tr-rest-on",on);syncDockVars();}
function startRest(exId,i){
  const k=S.date,pl=planFor(k),W=WORKOUTS[curWkId(k)];if(!W)return;
  const e=W.ex.find(x=>x.id===exId);if(!e)return;
  const t=nextTarget(W,k,pl);if(!t){stopRest();return;}
  const d=getDay(k),mate=partnerOf(W,e),trans=!!mate&&t.e.id===mate.id&&String(e.pair)<String(mate.pair);
  const n=trSets(t.e,pl),tn=(swapOf(d,t.e.id)||t.e.n).replace(/\s*\([^)]*\)/g,"");
  const next=t.e.id===e.id?`Next: set ${t.i+1} of ${n}`:`Next: ${tn} · set ${t.i+1} of ${n}`;
  const secs=restOf(e);   // the data encodes the transition (A1) and the full rest after the pair (A2)
  clearInterval(TR.rest&&TR.rest.iv);clearTimeout(TR.rest&&TR.rest.hideT);
  TR.rest={name:e.n,next,total:secs*1000,end:Date.now()+secs*1000,over:false,iv:null,hideT:null,trans,target:{id:t.e.id,i:t.i}};
  const el=restDock();el.classList.remove("over");
  el.querySelector(".rk").textContent=trans?"Switch":"Rest";el.querySelector(".rn").textContent=next;el.setAttribute("aria-label","Rest timer, "+e.n);el.querySelector("[data-act=rest30]").hidden=false;
  const sk=el.querySelector("[data-act=restskip]");sk.textContent="Skip";sk.classList.add("sec");
  TR.rest.iv=setInterval(restTick,250);restVisible();restTick();
}
function restTick(){
  const R=TR.rest;if(!R)return;const el=restDock();
  const left=Math.max(0,R.end-Date.now()),s=Math.ceil(left/1000);
  el.querySelector(".rc").textContent=`${Math.floor(s/60)}:${pad(s%60)}`;
  el.querySelector(".rbar i").style.width=(R.total?Math.min(100,(1-left/R.total)*100):100)+"%";
  if(left<=0&&!R.over){R.over=true;clearInterval(R.iv);beep(3,880);try{navigator.vibrate?.(200);}catch(e){}el.querySelector("[data-act=rest30]").hidden=true;syncDockVars();
    el.classList.add("over");el.querySelector(".rk").textContent=R.trans?"Switch now":"Rest over";const sk=el.querySelector("[data-act=restskip]");sk.textContent="Go";sk.classList.remove("sec");
    const a=document.activeElement;if(R.target&&!(a&&a.dataset&&a.dataset.lift)&&S.tab==="train")setOpen(R.target.id,false);
    el.querySelector("[data-rlive]").textContent=`Rest over. ${R.next}.`;
    R.hideT=setTimeout(()=>{if(TR.rest===R)stopRest();},120000);}
}
function stopRest(){if(TR.rest){clearInterval(TR.rest.iv);clearTimeout(TR.rest.hideT);}TR.rest=null;restVisible();}
function syncDockVars(){
  const r=document.documentElement.style, tabs=document.querySelector(".tabs"), dock=document.getElementById("restdock");
  const th=tabs&&getComputedStyle(tabs).display!=="none"?tabs.offsetHeight:0;
  r.setProperty("--tr-tabs",th+"px");
  const fin=document.getElementById("lfin");r.setProperty("--tr-fin",(fin&&th&&!fin.classList.contains("done")&&fin.offsetParent!==null?fin.offsetHeight:0)+"px");
  r.setProperty("--tr-rest",(dock&&!dock.hidden&&th?dock.offsetHeight:0)+"px");
}

/* ---------- hooks ---------- */
function fillFromLast(e,k,pl){
  const id=e.id,last=lastLift(id,k);if(!last)return {c:0,last:null};
  const n=trSets(e,pl),d=ensureDay(k),arr=d.lifts[id]=d.lifts[id]||[];
  const lw=last.sets.filter(s=>s&&s.w!=null);let c=0;
  for(let i=0;i<n;i++){
    const src=last.sets[i]&&last.sets[i].w!=null?last.sets[i]:lw[lw.length-1];if(!src)continue;
    while(arr.length<=i)arr.push({w:null,r:null});arr[i]=arr[i]||{w:null,r:null};
    if(arr[i].w==null){arr[i].w=+src.w;c++;const inp=document.querySelector(`[data-lift="${CSS.escape(id)}|${i}|w"]`);if(inp)inp.value=src.w;}
  }
  return {c,last};
}
ACTIONS.fill=el=>{
  const id=el.dataset.v,k=S.date,pl=planFor(k),W=WORKOUTS[curWkId(k)];if(!W)return;
  const e=W.ex.find(x=>x.id===id);if(!e)return;const {c,last}=fillFromLast(e,k,pl);if(!last)return;
  if(c){saveDay(k);paintLift();toast(`Filled ${c} weight${c===1?"":"s"} from ${short(last.k)}`);
    const first=document.querySelector(`.ex[data-ex="${CSS.escape(id)}"] .srow:not(.ok) [data-lift$="|r"]`);first&&first.focus({preventScroll:true});}
  else toast("Weights are already filled in");
};
function liftCounts(){const k=S.date,pl=planFor(k),W=WORKOUTS[curWkId(k)];if(!W)return {got:0,tot:0};let got=0,tot=0;W.ex.filter(counted).forEach(e=>{const st=exStats(e,k,pl);got+=Math.min(st.done,st.n);tot+=st.n;});return {got,tot};}
function askFinish(fin){const {got,tot}=liftCounts(),miss=tot-got;
  if(!fin.dataset.orig)fin.dataset.orig=fin.innerHTML;fin.classList.add("ask");
  fin.innerHTML=`<div class="fq" role="alert"><b>${miss} set${miss===1?"":"s"} not logged.</b> Finish anyway?</div><div class="fa"><button class="btn" data-act="liftkeep">Keep logging</button><button class="btn sec" data-act="liftdone2">Finish anyway</button></div>`;
  const b=fin.querySelector("[data-act=liftkeep]");b&&b.focus({preventScroll:true});}
ACTIONS.liftkeep=el=>{const fin=el.closest(".tr-fin");if(fin&&fin.dataset.orig){fin.innerHTML=fin.dataset.orig;delete fin.dataset.orig;fin.classList.remove("ask");paintLift();const b=fin.querySelector("[data-act=liftdone]");b&&b.focus({preventScroll:true});}};
ACTIONS.liftdone2=()=>{const d=ensureDay(S.date);d.checks.lift=true;saveDay(S.date);TR.justDone=true;rerenderKeepScroll();toast("Workout checked off");};
// intercept "Finish workout" before main's handler when sets are still missing
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-act=liftdone]");if(!b||S.tab!=="train"||getDay(S.date).checks.lift)return;
  const fin=b.closest(".tr-fin");if(!fin)return;const {got,tot}=liftCounts();if(got<tot){e.stopImmediatePropagation();e.preventDefault();askFinish(fin);}},true);
ACTIONS.wkopen=()=>{TR.pick[S.date]=true;rerenderKeepScroll();const b=$(".seg button");b&&b.focus({preventScroll:true});};
ACTIONS.tshow=()=>{TR.show[S.date]=true;rerenderKeepScroll();const g=$("#tgo");g&&g.focus({preventScroll:true});};
ACTIONS.thide=()=>{TR.show[S.date]=false;rerenderKeepScroll();};
ACTIONS.rest30=()=>{const R=TR.rest;if(!R)return;
  if(R.over){R.over=false;R.total=30000;R.end=Date.now()+30000;clearTimeout(R.hideT);const el=restDock();el.classList.remove("over");el.querySelector(".rk").textContent="Rest";const sk=el.querySelector("[data-act=restskip]");sk.textContent="Skip";sk.classList.add("sec");R.iv=setInterval(restTick,250);el.querySelector("[data-act=rest30]").hidden=false;syncDockVars();}
  else{R.end+=30000;R.total+=30000;}restTick();};
ACTIONS.restskip=()=>{const t=TR.rest&&TR.rest.target;stopRest();if(t&&S.tab==="train"&&!getDay(S.date).checks.lift)goTarget(t,true);};
ACTIONS.exopen=el=>{const id=el.dataset.v,ex=el.closest(".ex");if(ex&&ex.classList.contains("open"))return;setOpen(id,true);};
ACTIONS.swap=el=>{const id=el.dataset.v,alt=el.dataset.alt||"",d=ensureDay(S.date);
  if(alt)d.lifts[id+"__alt"]=alt;else delete d.lifts[id+"__alt"];saveDay(S.date);TR.open[S.date]={wk:curWkId(S.date),id};rerenderKeepScroll();
  toast(alt?`Swapped to ${alt} for today`:"Back to the planned exercise");};
ACTIONS.fillall=()=>{const k=S.date,pl=planFor(k),W=WORKOUTS[curWkId(k)];if(!W)return;let c=0;
  W.ex.forEach(e=>{c+=fillFromLast(e,k,pl).c;});
  if(c){saveDay(k);paintLift();toast(`Filled ${c} weight${c===1?"":"s"} from your last sessions`);}else toast("Weights are already filled in");};

ON_INPUT.push(t=>{if(t.dataset&&t.dataset.lift)queueMicrotask(paintLift);return false;});
ON_CHANGE.push(t=>{
  if(t.id==="t-ftp"){const n=Math.round(+t.value);
    if(t.value===""){ST().ftp=null;saveSet();const zw=$("#tcard .zwrap");if(zw)zw.innerHTML=zonesHtml(null);return true;}
    if(!(n>=50&&n<=600)){t.setAttribute("aria-invalid","true");toast("FTP must be 50–600 W");return true;}
    ST().ftp=n;saveSet();t.removeAttribute("aria-invalid");const zw=$("#tcard .zwrap");if(zw)zw.innerHTML=zonesHtml(n);toast(`FTP set to ${n} W. Zones updated.`);return true;}
  return false;
});
ON_CHANGE.push(t=>{
  if(t.dataset&&t.dataset.lift&&S.tab==="train"){const [id,i,j]=t.dataset.lift.split("|");
    if(j==="r"&&t.value!==""){const d=ensureDay(S.date),arr=d.lifts[id]||[],s=arr[+i];
      if(s&&s.r!=null){
        // carry this set's weight into the next set if that one is still empty
        const nx=document.querySelector(`.tr-lift [data-lift="${CSS.escape(id)}|${+i+1}|w"]`);
        if(nx&&s.w!=null&&nx.value===""){while(arr.length<=+i+1)arr.push({w:null,r:null});arr[+i+1]=arr[+i+1]||{w:null,r:null};
          if(arr[+i+1].w==null){arr[+i+1].w=s.w;nx.value=s.w;saveDay(S.date);paintLift();}}
        afterTap(()=>{if(TR.tapAct==="restskip")return;   // the tap that ended typing was "Skip rest": don't start a new one
          if(S.tab==="train"&&!getDay(S.date).checks.lift){startRest(id,+i);scrollNext(t);}});}}}
  return false;
});
/* after a set: bring the next set's first empty input (or its collapsed row) to the top of the screen */
function scrollNext(t){requestAnimationFrame(()=>{if(S.tab!=="train"||getDay(S.date).checks.lift||!document.contains(t))return;syncDockVars();
  const tg=TR.rest&&TR.rest.target;if(!tg)return;
  const a=document.activeElement;if(a&&a.dataset&&a.dataset.lift&&a!==t&&!a.dataset.lift.startsWith(`${tg.id}|${tg.i}|`))return;   // the user already moved elsewhere
  const ex=document.querySelector(`.tr-lift .ex[data-ex="${CSS.escape(tg.id)}"]`);if(!ex)return;
  if(ex.classList.contains("open")){const w=ex.querySelector(`[data-lift="${CSS.escape(tg.id)}|${tg.i}|w"]`),r=ex.querySelector(`[data-lift="${CSS.escape(tg.id)}|${tg.i}|r"]`);
    const n=w&&w.value===""?w:(r&&r.value===""?r:w);n&&n.scrollIntoView({block:"start"});}
  else ex.scrollIntoView({block:"start"});});}
TR.ptr=false;TR.afterTap=[];
function afterTap(fn){if(TR.ptr)TR.afterTap.push(fn);else fn();}
document.addEventListener("pointerdown",()=>{TR.ptr=true;TR.tapAct=null;},true);
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-act]");TR.tapAct=b?b.dataset.act:null;},true);
["pointerup","pointercancel"].forEach(ev=>document.addEventListener(ev,()=>{TR.ptr=false;setTimeout(()=>{const q=TR.afterTap.splice(0);q.forEach(f=>{try{f();}catch(e){}});TR.tapAct=null;},0);},true));
// Enter: weight → reps; reps of a logged set → the next set in work order (supersets alternate)
document.addEventListener("keydown",e=>{
  const t=e.target;if(e.key!=="Enter"||!t.dataset||!t.dataset.lift)return;
  const [id,i,j]=t.dataset.lift.split("|");e.preventDefault();
  if(j==="w"){const r=document.querySelector(`.tr-lift [data-lift="${CSS.escape(id)}|${i}|r"]`);if(r){r.focus({preventScroll:true});r.scrollIntoView({block:"center"});}return;}
  const k=S.date,pl=planFor(k),W=WORKOUTS[curWkId(k)];if(!W)return;
  const s=((getDay(k).lifts[id])||[])[+i];
  if(logged(s)){const tg=nextTarget(W,k,pl);if(tg){goTarget({id:tg.e.id,i:tg.i},true);return;}t.blur();return;}
  const all=[...document.querySelectorAll(".tr-lift [data-lift]")],x=all.indexOf(t),n=all.slice(x+1).find(q=>q.value==="");if(n){n.focus({preventScroll:true});n.scrollIntoView({block:"center"});}
});
// audio must be created/resumed inside a user gesture (iOS)
["pointerdown","touchend","keydown"].forEach(ev=>document.addEventListener(ev,ensureAudio,{capture:true,passive:true}));
// remember the train control that was activated so focus survives a re-render
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-act]");if(!b||S.tab!=="train")return;
  TR.focus=b.id?"#"+b.id:`[data-act="${b.dataset.act}"]${b.dataset.v!=null?`[data-v="${b.dataset.v}"]`:""}`;
  if(b.dataset.act==="liftdone"&&!getDay(S.date).checks.lift)TR.justDone=true;},true);
window.addEventListener("resize",syncDockVars);
document.addEventListener("focusin",e=>{const t=e.target;
  const ex=t.closest&&t.closest(".tr-lift .ex");if(ex&&!ex.classList.contains("open")&&!t.classList.contains("exrow"))setOpen(ex.dataset.ex,false);   // focusing anything inside a collapsed exercise opens it
  if(t.dataset&&t.dataset.lift){document.body.classList.add("tr-typing");syncDockVars();if(t.value!==""){try{t.select();}catch(_){}}}});
document.addEventListener("focusout",e=>{if(e.target.dataset&&e.target.dataset.lift)afterTap(()=>{const a=document.activeElement;if(!(a&&a.dataset&&a.dataset.lift)){document.body.classList.remove("tr-typing");syncDockVars();}});});
AFTER_RENDER.push(tab=>{
  restVisible();
  if(tab!=="train"){TR.justDone=false;TR.focus=null;return;}
  syncDockVars();
  paintLift();
  if(TR.justDone){TR.justDone=false;stopRest();const s=$("#tsum");if(s){s.focus({preventScroll:true});setTimeout(()=>{const x=$("#tsum");x&&x.scrollIntoView({block:"center"});},0);}}
  else if(S.trainFocus){const id={intervals:"tcard",lift:"lcard",walk:"wcard"}[S.trainFocus];S.trainFocus=null;const el=id&&document.getElementById(id);if(el)setTimeout(()=>{const x=document.getElementById(id);x&&x.scrollIntoView({block:"start"});},0);}
  else if(TR.focus&&(document.activeElement===document.body||!document.activeElement)){try{const f=document.querySelector(TR.focus);f&&f.focus({preventScroll:true});}catch(e){}}
  TR.focus=null;
});
