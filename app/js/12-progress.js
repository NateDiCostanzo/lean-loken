/* =========================================================
   PROGRESS — trend weight, coach, weekly review, Core 4 grid
   (owned by the Progress/Plan builder)
   ========================================================= */

/* ---------- contract adapters (work before and after B/C land) ---------- */
function peTargets(k){
  if(typeof targetsFor==="function"){try{const t=targetsFor(k);if(t&&t.cal)return t;}catch(e){}}
  const st=ST(), pl=planFor(k), db=pl.week===7&&pl.inProg;
  return {cal:st.cal+(db?450:0),p:st.p,c:st.c+(db?112:0),f:st.f,steps:st.steps,water:st.water,dietBreak:db};
}
/* Core 4 for a date: C's core4() when present, else a local equivalent */
function peCore4(k){
  if(typeof core4==="function"){try{return core4(k);}catch(e){}}
  const pl=planFor(k); if(!pl.inProg||k>todayKey())return null;
  const d=getDay(k), t=peTargets(k), s=pl.sch||{};
  const tr=["lift","intervals","walk"].filter(id=>id==="walk"?!!s.walk:!!s[id]);
  const keys={weigh:d.weight>0,protein:d.protein!=null&&d.protein>=t.p-10,cal:d.cal>0&&Math.abs(d.cal-t.cal)<=150,train:tr.length?tr.every(id=>!!(d.checks||{})[id]):true};
  const met=Object.values(keys).filter(Boolean).length;
  return {met,total:4,pct:Math.round(met/4*100),keys};
}
const C4_LABEL={weigh:"Weigh in",protein:"Protein",cal:"Calories in range",train:"Training done"};
/* grid/table class: today is neutral until all 4 are met */
function peCell(k){
  const tk=todayKey();
  const c=k>tk?null:peCore4(k);
  if(!c)return {cls:"f",c:null,p:null};
  if(k===tk&&c.met<c.total)return {cls:"f",c,p:c.pct};
  return {cls:c.pct>=85?"g":c.pct>=60?"w":"b",c,p:c.pct};
}

/* ---------- weekly rows (fed to coach) ---------- */
function weekRows(){
  const st=ST(),rows=[],tk=todayKey(), tr=trendSeries();
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  for(let w=1;w<=12;w++){
    const ks=Array.from({length:7},(_,i)=>addDays(st.start,(w-1)*7+i));
    const pick=f=>ks.map(x=>S.days[x]&&S.days[x][f]).filter(v=>v>0).map(Number);
    const wa=pick("waist"), ad=ks.map(adherence).filter(v=>v!=null);
    const fin=ks.filter(k=>k<tk);
    const cells=ks.map(k=>k<=tk?peCore4(k):null);
    const calHit=ks.filter(k=>{const d=S.days[k];return d&&d.cal>0&&Math.abs(d.cal-peTargets(k).cal)<=150;}).length;
    const trEnd=tr.byKey[ks.filter(k=>k<=tk).pop()];
    rows.push({w,ks,avg:avg(pick("weight")),n:pick("weight").length,cal:avg(pick("cal")),pro:avg(pick("protein")),steps:avg(pick("steps")),calHit,
      waist:wa.length?wa[wa.length-1]:null,adh:ad.length?Math.round(avg(ad)):null,
      core:ks.filter((k,i)=>k<=tk&&cells[i]&&cells[i].met===cells[i].total).length,coreOf:fin.length+(ks.includes(tk)?1:0),
      trend:trEnd!=null?trEnd:null,done:ks[6]<tk,cur:ks[0]<=tk&&tk<=ks[6]});
  }
  let prev=st.startWeight;
  rows.forEach(r=>{r.delta=r.avg!=null&&prev!=null?r.avg-prev:null;if(r.avg!=null)prev=r.avg;});
  return rows;
}

/* ---------- trend weight: t += 0.1·(w − t), carried over missing days ---------- */
function trendSeries(){
  const st=ST(), tk=todayKey();
  const ws=Object.keys(S.days).filter(k=>k>=st.start&&k<=tk&&S.days[k].weight>0).sort();
  const out={pts:[],byKey:{},seed:null,last:null,lastKey:null};
  const seed=st.startWeight!=null?+st.startWeight:(ws[0]?+S.days[ws[0]].weight:null);
  if(seed==null)return out;
  out.seed=seed;
  if(!ws.length){out.last=seed;return out;}
  let t=seed; const end=ws[ws.length-1];
  for(let k=st.start;k<=end;k=addDays(k,1)){
    const d=S.days[k], w=d&&d.weight>0?+d.weight:null;
    if(w!=null)t+=0.1*(w-t);
    out.byKey[k]=t; out.pts.push({i:diffDays(st.start,k),k,t,w});
  }
  out.last=t; out.lastKey=end;
  for(let k=addDays(end,1);k<=tk;k=addDays(k,1))out.byKey[k]=t; // carried, no new point
  return out;
}
/* lb/week from the last 14 days of trend (needs 7+ days) */
function trendSlope(tr){
  if(!tr.pts.length)return null;
  const n=tr.pts.length, a=tr.pts[Math.max(0,n-15)], b=tr.pts[n-1], span=b.i-a.i;
  if(span<6)return null; // 7 days of trend (day 0..6)
  return (b.t-a.t)/span*7;
}
/* Projection from weekly averages (not the lagging trend level).
   Least-squares over the last 2–3 finished weeks (Week 7 diet break excluded);
   fallback: regression over the last 14 days of raw weigh-ins. None before Week 2 ends. */
function lsq(pts){const n=pts.length;if(n<2)return null;const mx=pts.reduce((a,p)=>a+p.x,0)/n,my=pts.reduce((a,p)=>a+p.y,0)/n;
  let sxy=0,sxx=0;pts.forEach(p=>{sxy+=(p.x-mx)*(p.y-my);sxx+=(p.x-mx)**2;});if(!sxx)return null;const b=sxy/sxx;return {b,a:my-b*mx};}
function pace(tr,rows){
  const st=ST(), goal=+st.goal, end=addDays(st.start,83), tk=todayKey(), ti=diffDays(st.start,tk);
  rows=rows||weekRows();
  const fin=rows.filter(r=>r.done&&r.avg!=null&&r.n>=3);
  const latest=rows.filter(r=>r.avg!=null&&r.n>=3&&r.ks[0]<=tk).pop();
  if(latest&&latest.avg<=goal)return {k:"Goal",v:"Goal reached",s:`Week ${latest.w} weekly avg ${fnum(latest.avg)} lb, at or under ${goal}`};
  if(!rows[1]||!rows[1].done)return {k:"Projected goal date",v:"After Week 2",s:"Weeks 1–2 are mostly water and stored carbs, so the projection starts once Week 2 is finished."};
  let fit=lsq(fin.filter(r=>r.w!==7).slice(-3).map(r=>({x:(r.w-1)*7+3,y:r.avg}))), basis="weekly averages";
  if(!fit){
    const pts=Object.keys(S.days).filter(k=>k<=tk&&diffDays(k,tk)<14&&S.days[k].weight>0).map(k=>({x:diffDays(st.start,k),y:+S.days[k].weight}));
    if(pts.length>=5){fit=lsq(pts);basis="last 14 days of weigh-ins";}
  }
  if(!fit)return {k:"Projected goal date",v:"—",s:"Not enough weigh-ins to project. Weigh in every morning."};
  const perWk=fit.b*7, sgn=v=>`${v>0?"+":v<0?"−":""}${Math.abs(v).toFixed(1)}`;
  if(fit.b>=0)return {k:"Projected goal date",v:"Not yet",s:`Weekly averages are flat or rising (${sgn(perWk)} lb/wk). The coach call below says what to do.`};
  const now=fit.a+fit.b*ti, days=Math.max(0,Math.ceil((now-goal)/(-fit.b))), date=addDays(tk,days);
  const past=diffDays(end,date), wks=Math.ceil(past/7);
  const tail=past>0?`~${wks} week${wks===1?"":"s"} past plan end`:`plan ends ${short(end)}`;
  return {k:"Projected goal date",v:`${goal} by ~${short(date)}`,s:`${tail} · ${sgn(perWk)} lb/wk from ${basis}`};
}
/* ---------- chart ---------- */
function chartSVG(tr){
  const iw=typeof innerWidth==="number"?innerWidth:1024, sm=iw<600, st=ST(), W=sm?360:iw<980?640:920,H=sm?250:iw<980?260:280,L=sm?34:42,R=sm?10:16,T0=16,B=30;
  PGV.sm=W; tr=tr||trendSeries();
  const sw=tr.seed;
  if(sw==null)return "";
  const pts=tr.pts.filter(p=>p.i<84);
  const vals=pts.filter(p=>p.w!=null).map(p=>p.w).concat(pts.map(p=>p.t),[sw,+st.goal]);
  let lo=Math.min(...vals)-1,hi=Math.max(...vals)+1;
  const step=hi-lo>24?5:hi-lo>12?4:2; lo=Math.floor(lo/step)*step; hi=Math.ceil(hi/step)*step;
  const x=i=>L+(W-L-R)*i/83, y=v=>T0+(H-T0-B)*(hi-v)/(hi-lo);
  const mono='style="font-family:var(--f-body);font-variant-numeric:tabular-nums"';
  let g="";
  // Week 7 diet-break band
  g+=`<rect x="${x(42)}" y="${T0}" width="${x(49)-x(42)}" height="${H-T0-B}" fill="var(--warn-soft)" opacity=".7"/><text x="${(x(42)+x(49))/2}" y="${H-B-6}" text-anchor="middle" font-size="10" fill="var(--warn)" font-weight="600">diet break</text>`;
  for(let v=lo;v<=hi;v+=step)g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)" ${mono}>${v}</text>`;
  for(let w=0;w<12;w+=sm?3:2)g+=`<text x="${x(w*7+3)}" y="${H-9}" text-anchor="middle" font-size="11" fill="var(--muted)" ${mono}>W${w+1}</text>`;
  const ti=diffDays(st.start,todayKey());
  if(ti>=0&&ti<84)g+=`<line x1="${x(ti)}" x2="${x(ti)}" y1="${T0}" y2="${H-B}" stroke="var(--accent)" stroke-dasharray="2 3"/><text x="${x(ti)+(ti>70?-4:4)}" y="${T0+10}" ${ti>70?'text-anchor="end"':""} font-size="10.5" fill="var(--accent)">today</text>`;
  g+=`<line x1="${x(0)}" y1="${y(sw)}" x2="${x(83)}" y2="${y(+st.goal)}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 5"/>`;
  g+=`<text x="${x(83)}" y="${y(+st.goal)+16}" text-anchor="end" font-size="11" fill="var(--muted)">goal ${esc(st.goal)}</text>`;
  pts.filter(p=>p.w!=null).forEach(p=>g+=`<circle cx="${x(p.i)}" cy="${y(p.w)}" r="3" fill="var(--muted)" opacity=".7"><title>${nice(p.k)}: ${p.w.toFixed(1)} lb (trend ${p.t.toFixed(1)})</title></circle>`);
  if(pts.length>1){const d=`M${x(0).toFixed(1)},${y(sw).toFixed(1)}L`+pts.map(a=>`${x(a.i).toFixed(1)},${y(a.t).toFixed(1)}`).join("L");
    g+=`<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;}
  if(pts.length){const a=pts[pts.length-1];g+=`<circle cx="${x(a.i)}" cy="${y(a.t)}" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"><title>Trend ${a.t.toFixed(1)} lb</title></circle>`;}
  return `<div class="chartbox"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight over the 12 weeks: weigh-ins, trend line and target path">${g}</svg></div>`;
}

/* ---------- weekly review (inline stepper) ---------- */
const PGV={rv:null}; // rv: {wk,step,pick,custom}
addEventListener("resize",()=>{if(S.tab==="progress"&&PGV.sm!=null&&(PGV.sm!==(innerWidth<600?360:innerWidth<980?640:920)||PGV.ph!==(innerWidth<600)))rerenderKeepScroll();});
const FOCUS_PRESETS={
  weigh:"Weigh in every morning before food",
  protein:"Hit protein every day, even on off days",
  cal:"Log every day and stay within 150 kcal",
  train:"Finish every scheduled session and walk"
};
function peReviews(){const s=ST();return s.reviews&&typeof s.reviews==="object"?s.reviews:{};}
/* the week a review covers: Sunday → this week; any other day → last full week */
function reviewWeek(){
  const st=ST(), tk=todayKey(), pl=planFor(tk);
  if(pl.pre)return null;
  let w=pl.dow===0?pl.week:pl.week-1;
  if(pl.post)w=12;
  return w>=1&&w<=12?w:null;
}
/* the focus that applies to a date's week (set in the previous week's review) */
function currentFocus(k){
  k=k||todayKey();
  const pl=planFor(k), rv=peReviews(), r=rv[pl.week-1]||rv[String(pl.week-1)];
  if(!pl.inProg||!r||!r.focus)return null;
  return {focus:String(r.focus),week:pl.week,setAfter:pl.week-1,at:r.at||null};
}
function reviewAuto(){
  const tk=todayKey(), dow=planFor(tk).dow, w=reviewWeek();
  return w!=null&&(dow===0||dow===1)&&!peReviews()[w];
}
function weekCore(w){
  const st=ST(), tk=todayKey(), ks=Array.from({length:7},(_,i)=>addDays(st.start,(w-1)*7+i));
  const by={weigh:0,protein:0,cal:0,train:0}, den={weigh:0,protein:0,cal:0,train:0}; let days=0,full=0;
  ks.forEach(k=>{if(k>tk)return;const c=peCore4(k);if(!c||!c.keys)return;
    const open=k===tk&&c.met<c.total; // today isn't finished: a miss today doesn't count yet
    if(!open){days++;if(c.met===c.total)full++;}
    Object.keys(by).forEach(h=>{if(c.keys[h]){by[h]++;den[h]++;}else if(!open)den[h]++;});});
  const miss=h=>den[h]-by[h], top=Math.max(...Object.keys(by).map(miss));
  const worstAll=top>0?Object.keys(by).filter(h=>miss(h)===top):[];
  return {by,den,days,full,worst:worstAll[0]||null,worstAll,ks,today:ks.includes(tk)};
}
function reviewCard(rows,co){
  const R=PGV.rv; if(!R)return "";
  const w=R.wk, row=rows[w-1], tr=trendSeries(), st=ST();
  const sun=addDays(st.start,(w-1)*7+6), sd=getDay(sun);
  const steps=["Numbers","Core 4","Coach","Focus"];
  const nav=`<ol class="rv-steps">${steps.map((s,i)=>`<li class="${i===R.step?"on":i<R.step?"done":""}"><span>${i+1}</span>${s}</li>`).join("")}</ol>`;
  let body="";
  if(R.step===0){
    const prevT=w>1?rows[w-2].trend:tr.seed, ch=row.trend!=null&&prevT!=null?row.trend-prevT:null;
    body=`<div class="rv-nums">
      <div><span class="k">Trend weight</span><b class="num">${fnum(row.trend)}</b><span class="s">${ch==null?"No weigh-ins this week":"Trend "+(ch<=0?"down ":"up ")+Math.abs(ch).toFixed(1)+" lb this week"}</span></div>
      <div><span class="k">Weekly avg</span><b class="num">${fnum(row.avg)}</b><span class="s">${row.n} weigh-in${row.n===1?"":"s"}</span></div>
      <label class="rv-waist"><span class="k">Waist, in (${short(sun)})</span><input type="number" step="0.25" inputmode="decimal" data-pgwaist="${sun}" value="${sd.waist??""}" placeholder="e.g. 36.5"><span class="s">At the navel, relaxed</span></label>
    </div>
    <button class="rv-toggle ${sd.checks&&sd.checks.photos?"on":""}" data-act="pgphotos" data-v="${sun}" aria-pressed="${!!(sd.checks&&sd.checks.photos)}"><span class="chk ${sd.checks&&sd.checks.photos?"on":""}">${CHECK}</span><span><b>Progress photos taken</b><small>Front, side and face. Same spot, light and time.</small></span></button>`;
  }else if(R.step===1){
    const wc=weekCore(w);
    const L=a=>a.map(h=>`<b>${C4_LABEL[h]}</b>`), joinA=a=>a.length<3?a.join(" and "):a.slice(0,-1).join(", ")+" and "+a[a.length-1];
    const slip=wc.worstAll.length===4?"All four slipped equally.":wc.worstAll.length?`${joinA(L(wc.worstAll))} slipped most.`:"Nothing slipped.";
    body=wc.days||wc.today?`<p class="rv-lead"><b>${wc.full} of ${wc.days}</b> finished day${wc.days===1?"":"s"} hit all four. ${slip}${wc.today?" Today counts once it's done.":""}</p>
      <ul class="rv-bars">${Object.keys(wc.by).map(h=>{const n=wc.by[h],d=wc.den[h],p=Math.round(n/7*100);return `<li class="${wc.worstAll.includes(h)?"worst":""}"><span>${C4_LABEL[h]}</span><span class="bar"><i style="width:${p}%;background:${colorFor(d?Math.round(n/d*100):null)}"></i></span><b class="num">${n}/${d}</b></li>`;}).join("")}</ul>`
      :`<p class="note">No days logged for Week ${w} yet.</p>`;
  }else if(R.step===2){
    const applied=co.adj&&ST().adj.some(a=>a.wk===co.wk);
    const cb=coachBasis(rows);
    body=`<div class="rv-coach ${co.c||""}"><span class="eyebrow">${cb.label}</span><b>${esc(co.h)}</b><p>${esc(co.t)}</p>${co.adj&&!applied?`<div><button class="btn sm" data-act="coachadj" data-v="${co.adj}" data-w="${co.wk}">Apply ${co.adj>0?"+":""}${co.adj} kcal → ${(st.cal+co.adj).toLocaleString()}</button></div>`:""}${applied?`<p class="note">Applied after Week ${co.wk}.</p>`:""}${cb.note}</div>`;
  }else{
    const wc=weekCore(w), sug=wc.worst||"weigh";
    body=`<p class="rv-lead">Pick one thing to protect in Week ${Math.min(12,w+1)}. It shows at the top of Today and Progress.</p>
      <div class="rv-focus" role="radiogroup" aria-label="Focus for next week">${Object.keys(FOCUS_PRESETS).map(h=>`<button role="radio" aria-checked="${R.pick===h}" class="${R.pick===h?"on":""}" data-act="pgfocus" data-v="${h}">${esc(FOCUS_PRESETS[h])}${h===sug?`<span class="badge acc">Suggested</span>`:""}</button>`).join("")}
      <label class="rv-custom ${R.pick==="custom"?"on":""}"><span>Or write your own</span><input type="text" maxlength="90" data-pgcustom placeholder="e.g. Prep lunches on Sunday" value="${esc(R.custom||"")}"></label></div>`;
  }
  const last=R.step===3;
  return `<section class="card review" id="review" aria-labelledby="rv-h"><div class="card-h"><div><div class="eyebrow">Weekly review · ${short(row.ks[0])} – ${short(row.ks[6])}</div><h2 id="rv-h">Review Week ${w}</h2></div><button class="btn sec sm" data-act="pgrv" data-v="close">Close</button></div>
    <div class="card-b">${nav}<div class="rv-body">${body}</div>
    <div class="rv-foot">${R.step?`<button class="btn sec" data-act="pgrv" data-v="back">Back</button>`:"<span></span>"}${last?`<button class="btn" data-act="pgrv" data-v="save" ${R.pick&&(R.pick!=="custom"||(R.custom||"").trim())?"":"disabled"}>Save focus</button>`:`<button class="btn" data-act="pgrv" data-v="next">Next</button>`}</div></div></section>`;
}
ACTIONS.pgrv=(el)=>{
  const v=el.dataset.v;
  if(v==="open"){const w=reviewWeek();if(w==null){toast("The first review is at the end of Week 1.");return;}const r=peReviews()[w];PGV.rv={wk:w,step:0,pick:r?(Object.keys(FOCUS_PRESETS).find(h=>FOCUS_PRESETS[h]===r.focus)||"custom"):null,custom:r&&!Object.values(FOCUS_PRESETS).includes(r.focus)?r.focus:""};render();const c=document.getElementById("review");if(c)c.scrollIntoView({block:"start"});return;}
  if(!PGV.rv)return;
  if(v==="close"){PGV.rv=null;PGV.dismissed=reviewWeek();return rerenderKeepScroll();}
  if(v==="next"){PGV.rv.step=Math.min(3,PGV.rv.step+1);return rerenderKeepScroll();}
  if(v==="back"){PGV.rv.step=Math.max(0,PGV.rv.step-1);return rerenderKeepScroll();}
  if(v==="save"){
    const R=PGV.rv, focus=R.pick==="custom"?(R.custom||"").trim().slice(0,90):FOCUS_PRESETS[R.pick];
    if(!focus)return;
    const st=ST(); if(!st.reviews||typeof st.reviews!=="object"||Array.isArray(st.reviews))st.reviews={};
    st.reviews[R.wk]={focus,at:new Date().toISOString()};
    saveSet(); PGV.rv=null; PGV.dismissed=R.wk; rerenderKeepScroll();
    toast(`Focus saved for Week ${Math.min(12,R.wk+1)}`);
  }
};
ACTIONS.pgusesw=(el)=>{const k=el.dataset.v, d=S.days[k];if(!d||!(d.weight>0))return;const st=ST(),before=st.startWeight;st.startWeight=+d.weight;saveSet();rerenderKeepScroll();
  toast(`Starting weight set to ${fnum(+d.weight)} lb`,()=>{st.startWeight=before;saveSet();rerenderKeepScroll();});};
ACTIONS.pgfocus=(el)=>{if(!PGV.rv)return;PGV.rv.pick=el.dataset.v;rerenderKeepScroll();};
ACTIONS.pgphotos=(el)=>{const k=el.dataset.v;if(!validKey(k))return;const d=ensureDay(k);d.checks.photos=!d.checks.photos;saveDay(k);rerenderKeepScroll();};
ON_INPUT.push(t=>{
  if(t.dataset&&t.dataset.pgcustom!=null&&PGV.rv){
    PGV.rv.custom=t.value;
    if(t.value.trim()&&PGV.rv.pick!=="custom"){PGV.rv.pick="custom";document.querySelectorAll(".rv-focus button").forEach(b=>{b.classList.remove("on");b.setAttribute("aria-checked","false");});t.closest(".rv-custom").classList.add("on");}
    const s=document.querySelector('[data-act=pgrv][data-v=save]');if(s)s.disabled=!(PGV.rv.pick&&(PGV.rv.pick!=="custom"||t.value.trim()));
    return true;}
  if(t.dataset&&t.dataset.pgwaist){
    const k=t.dataset.pgwaist;if(!validKey(k))return true;
    const d=ensureDay(k);
    if(t.value===""){d.waist=null;t.removeAttribute("aria-invalid");saveDay(k);return true;}
    const n=+t.value, ok=!isNaN(n)&&n>=20&&n<=70;
    t.setAttribute("aria-invalid",!ok); if(ok){d.waist=n;saveDay(k);}
    return true;}
  return false;
});

/* which week the coach call is based on, and the Sunday "week in progress" note */
function coachBasis(rows){
  const tk=todayKey(), fin=rows.filter(r=>r.done), last=fin[fin.length-1], cur=rows.find(r=>r.cur);
  const label=last?`Coach call · based on Week ${last.w} (finished)`:"Coach call";
  const note=cur&&planFor(tk).dow===0?`<p class="note">Week ${cur.w} is still in progress and ends tonight. Its weekly average joins the coach call on Monday, ${short(addDays(tk,1))}.</p>`:"";
  return {label,note,last,cur};
}
/* ---------- render ---------- */
function renderProgress(){
  const st=ST(), rows=weekRows(), co=typeof coach==="function"?coach(rows):{c:"",h:"Coach unavailable",t:""}, tk=todayKey();
  const tr=trendSeries(), hasData=tr.seed!=null;
  if(PGV.rv&&PGV.rv.auto&&PGV.rv.step===0&&peReviews()[PGV.rv.wk])PGV.rv=null; // saved on another device
  if(PGV.rv==null&&reviewAuto()&&PGV.dismissed!==reviewWeek())PGV.rv={wk:reviewWeek(),step:0,pick:null,custom:"",auto:true};
  const rw=reviewWeek(), rvDone=rw!=null&&peReviews()[rw];
  const cf=currentFocus(tk), nextF=planFor(tk).dow===0&&rw&&peReviews()[rw];
  const focusBanner=nextF?`<div class="callout focus"><span class="eyebrow">Week ${rw+1} focus</span><b>${esc(nextF.focus)}</b></div>`
    :cf?`<div class="callout focus"><span class="eyebrow">This week's focus</span><b>${esc(cf.focus)}</b></div>`:"";

  // tiles
  let tiles;
  const pre=!hasData?Object.keys(S.days).filter(k=>k<st.start&&S.days[k].weight>0).sort().pop():null;
  if(!hasData&&pre){
    const pw=+S.days[pre].weight;
    tiles=`<section class="card onboard"><div class="card-b"><div class="eyebrow">Get started</div><h2>Use your latest weigh-in as the start?</h2>
      <p>You weighed in at ${fnum(pw)} lb on ${nice(pre)}, before the program starts. Set it as your starting weight so the trend line, pace and coach calls have a baseline. You can change it later in Plan.</p>
      <div class="row"><button class="btn" data-act="pgusesw" data-v="${pre}">Use ${fnum(pw)} (${short(pre)}) as starting weight</button><button class="btn sec" data-act="tab" data-v="plan" data-scroll="settings">Enter a different weight</button></div></div></section>`;
  }else if(!hasData){
    tiles=`<section class="card onboard"><div class="card-b"><div class="eyebrow">Get started</div><h2>Your progress starts with one number</h2>
      <p>Set your starting weight, then weigh in each morning after the bathroom and before food. The trend line, pace projection and coach calls build from there.</p>
      <div class="row"><button class="btn" data-act="tab" data-v="plan" data-scroll="settings">Set starting weight</button><button class="btn sec" data-act="go" data-v="${tk}">Log today's weigh-in</button></div></div></section>`;
  }else{
    const lost=tr.seed-tr.last, pc=pace(tr,rows);
    const wk=weekKeys(tk), cells=wk.filter(k=>k<=tk).map(peCore4).filter(Boolean), full=cells.filter(c=>c.met===c.total).length;
    const sk=typeof streak==="function"?(()=>{try{return streak();}catch(e){return null;}})():null;
    const lastW=tr.lastKey?+S.days[tr.lastKey].weight:null;
    const avgRow=rows.filter(r=>r.avg!=null&&r.n>=3&&r.ks[0]<=tk).pop();
    tiles=`<div class="tiles">
      <div class="card tile"><div class="k">Trend weight</div><div class="v num">${fnum(tr.last)}</div><div class="s">${lastW!=null?`lb · last weigh-in ${fnum(lastW)}`:"lb · no weigh-ins yet"}</div></div>
      <div class="card tile"><div class="k">Lost (trend)</div><div class="v num ${lost>0?"dn":""}">${lost>=0?fnum(lost):"+"+fnum(-lost)}</div><div class="s">from ${fnum(tr.seed)} lb${avgRow?` · Week ${avgRow.w} weekly avg ${fnum(avgRow.avg)}`:""}</div></div>
      <div class="card tile pace ${co.c==="warn"||co.c==="bad"?"behind":""}"><div class="k">${pc?esc(pc.k):"Projected goal date"}</div><div class="v num">${pc?esc(pc.v):"—"}</div><div class="s">${pc?esc(pc.s):""}</div></div>
      <div class="card tile"><div class="k">Core 4 days</div>${planFor(tk).pre?`<div class="v num">Starts ${DOWN[parseKey(st.start).getDay()]}</div><div class="s">${nice(st.start)}</div></div>`:(()=>{const fin=wk.filter(x=>x<tk&&peCore4(x)).length;return fin<2?`<div class="v num">—</div><div class="s">${fin?"Second day in progress":"First day in progress"} · counts once 2 days finish${sk&&sk.days?` · ${sk.days}-day streak`:""}</div></div>`:`<div class="v num">${full}<small>/${cells.length||7}</small></div><div class="s">${`of ${cells.length||7} days this week hit all 4`}${sk&&sk.days?` · ${sk.days}-day streak`:""}</div></div>`;})()}
    </div>`;
  }

  const applied=co.adj&&st.adj.some(a=>a.wk===co.wk);
  const adjBtn=co.adj&&!applied?`<div><button class="btn sm" data-act="coachadj" data-v="${co.adj}" data-w="${co.wk}">Apply ${co.adj>0?"+":""}${co.adj} kcal → ${(st.cal+co.adj).toLocaleString()}</button></div>`:"";

  // grid
  let grid=`<span></span>${["M","T","W","T","F","S","S"].map(x=>`<span class="gh">${x}</span>`).join("")}`;
  const phone=typeof innerWidth==="number"&&innerWidth<600; PGV.ph=phone;
  const curW=Math.max(1,Math.min(12,planFor(tk).week||1)), lastW=phone?Math.min(12,curW+1):12;
  const vis=rows.filter(r=>r.w<=lastW||(!phone));
  const upcoming=lastW<12?(lastW+1===12?`Week 12 upcoming`:`Weeks ${lastW+1}–12 upcoming`):"";
  vis.forEach(r=>{grid+=`<span class="gw">W${r.w}</span>`+r.ks.map(k=>{const c=peCell(k);const lab=c.c?`${c.c.met} of 4`:c.p!=null?c.p+"%":"";return `<button class="c ${c.cls} ${k===tk?"t":""}" data-act="go" data-v="${k}" title="${nice(k)}${lab?" · "+lab:""}" aria-label="${nice(k)}${lab?", "+lab:""}">${c.c&&c.cls!=="f"?`<span aria-hidden="true">${c.c.met}</span>`:""}</button>`;}).join("");});
  if(upcoming)grid+=`<p class="g-up">${upcoming}</p>`;

  const reviewBtn=rw!=null&&!PGV.rv?`<button class="btn sec sm" data-act="pgrv" data-v="open">${rvDone?"Edit review":"Review week"}</button><button class="btn sec sm" data-act="airecap" data-w="${rw}">AI recap</button>`:"";
  return `<div class="phead"><div class="t"><div class="eyebrow">${nice(st.start)} – ${nice(addDays(st.start,83))}</div><h1>Progress</h1></div><div class="row">${reviewBtn}<button class="btn sec sm" data-act="export">Export CSV</button></div></div>
    ${focusBanner}
    ${tiles}
    ${PGV.rv?reviewCard(rows,co):""}
    <section class="card coach ${co.c}"><div class="card-b"><div class="eyebrow">${coachBasis(rows).label}</div><h2>${esc(co.h)}</h2><p>${esc(co.t)}</p>${adjBtn}${coachBasis(rows).note}${applied?`<p class="note">Applied after Week ${co.wk}.</p>`:""}</div></section>
    ${hasData?`<section class="card"><div class="card-h"><h2>Weight</h2><div class="legend"><span><i class="lg-line"></i>Trend</span><span><i class="lg-dot"></i>Weigh-in</span><span><i class="lg-dash"></i>Target path</span><span><i class="lg-band"></i>Diet break</span></div></div>${chartSVG(tr)}<div class="card-b chart-note"><p class="note">The trend smooths out day-to-day water swings: each weigh-in moves it 10% of the way. Judge progress by the line, not single dots.</p></div></section>`:""}
    <div class="cols pg-cols">
      <section class="card"><div class="card-h"><h2>Core 4 by day</h2><div class="legend"><span><i style="background:var(--good)"></i>4 of 4</span><span><i style="background:var(--warn)"></i>3 of 4</span><span><i style="background:var(--bad)"></i>2 or fewer</span><span><i class="lg-future"></i>Not finished</span></div></div><div class="grid12">${grid}</div><div class="card-b" style="padding-top:0"><p class="note">Weigh in, protein, calories in range, training done. Tap a day to open it.</p></div></section>
      <section class="card"><div class="card-h"><h2>Week by week</h2></div><div class="tablebox"><table class="pg-t"><thead><tr><th>Week</th><th>Trend</th><th><span class="lg">Avg change</span><span class="sh">Chg</span></th><th><span class="lg">Core days</span><span class="sh">Core</span></th><th><span class="lg">Weekly avg</span><span class="sh">Avg</span></th><th class="opt">Kcal</th><th class="opt">Protein</th><th class="opt">Waist</th></tr></thead><tbody>
      ${vis.map(r=>`<tr class="${r.cur?"cur":""}"><td>W${r.w} <span class="muted dt">${short(r.ks[0])}</span>${r.w===7?` <span class="badge warn">Break</span>`:""}</td><td>${fnum(r.trend)}</td><td class="${r.delta==null?"":r.delta<=0?"dn":"up"}">${r.delta==null?"—":(r.delta>0?"+":"")+r.delta.toFixed(1)}</td><td>${r.coreOf?r.core+"/"+r.coreOf:"—"}</td><td>${fnum(r.avg)}</td><td class="opt">${r.cal?Math.round(r.cal).toLocaleString():"—"}</td><td class="opt">${r.pro?Math.round(r.pro):"—"}</td><td class="opt">${fnum(r.waist,2)}</td></tr>`).join("")}
      ${upcoming?`<tr class="up"><td colspan="8">${upcoming}</td></tr>`:""}
      </tbody></table></div><div class="card-b"><p class="note">Trend: smoothed weight at the end of each week. Weekly avg: the mean of that week's weigh-ins. Avg change: weekly avg versus the previous week (Week 1 versus your start weight). The coach uses weekly averages of finished weeks.<span class="ph-only"> Calories, protein and waist are in the CSV export and on wider screens.</span></p></div></section>
    </div>`;
}

async function exportCSV(){
  const q=v=>{let s=String(v??"");if(typeof v==="string"&&/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
  const ks=Object.keys(S.days).sort();
  let csv="date,week,weight,calories,protein,steps,water_oz,sleep_h,waist_in,checklist_pct,core4_met,cal_source,meal_swaps,notes\n";
  ks.forEach(k=>{const d=S.days[k],pl=planFor(k);let sc="";try{sc=score(k).pct;}catch(e){}
    const c=k<=todayKey()?peCore4(k):null;
    const alt=d.mealsAlt&&typeof d.mealsAlt==="object"?Object.keys(d.mealsAlt).map(id=>{const m=d.mealsAlt[id]||{};return `${id}: ${m.text||""}${m.k!=null?` (${Math.round(m.k)} kcal)`:""}`;}).join("; "):"";
    csv+=[k,pl.inProg?pl.week:"",d.weight,d.cal,d.protein,d.steps,d.water,d.sleep,d.waist,sc,c?c.met:"",d.calSrc||"",alt,d.notes].map(q).join(",")+"\n";});
  csv+="\ndate,exercise_id,exercise,swapped_to,set,weight_lb,reps\n";
  const exN=id=>{if(typeof exById==="function"){const e=exById(id);if(e)return e.n;}for(const w of Object.values(typeof WORKOUTS==="object"?WORKOUTS:{})){const e=(w.ex||[]).find(x=>x.id===id);if(e)return e.n;}return id;};
  ks.forEach(k=>{const L=S.days[k].lifts||{};Object.keys(L).forEach(id=>{if(/__alt$/.test(id)||!Array.isArray(L[id]))return;const alt=typeof L[id+"__alt"]==="string"?L[id+"__alt"]:"";
    L[id].forEach((s,i)=>{if(s&&(s.w!=null||s.r!=null))csv+=[k,id,exN(id),alt,i+1,s.w,s.r].map(q).join(",")+"\n";});});});
  const rv=peReviews(), rk=Object.keys(rv).sort((a,b)=>a-b);
  if(rk.length){csv+="\nweek,focus_for_next_week,saved_at\n";rk.forEach(w=>{csv+=[w,rv[w].focus,rv[w].at].map(q).join(",")+"\n";});}
  try{const dl=await claude.use("downloads");if(!dl)throw 0;await dl.save({filename:"lean-loken-log.csv",data:csv});toast("Export saved");}
  catch(e){if(e&&e.code==="declined")return;try{await navigator.clipboard.writeText(csv);toast("Download unavailable here. CSV copied to clipboard.");}catch(_){toast("Export isn't available in this view.");}}
}
