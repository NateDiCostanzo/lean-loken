/* =========================================================
   PROGRAM DEFINITION (owned by Builder B)
   ========================================================= */
const DEFAULTS={schema:4,start:"2026-10-12",startWeight:null,goal:188,
  wake:"05:30",workStart:"07:30",workEnd:"16:30",train:"17:00",weekendWake:"06:30",satTrain:"08:30",bed:"22:00",
  cal:2250,p:200,c:215,f:65,steps:10000,water:100,ftp:null,adj:[]};
/* Settings saved before schema 3 that still hold the old defaults get the new ones. */
const OLD_TIME_DEFAULTS={wake:"06:30",train:"17:30",bed:"22:30"};
const TIME_KEYS=["wake","workStart","workEnd","train","weekendWake","satTrain","bed"];
const FLOOR=1900, CEIL=3200, STEP=150;
/* One coach step (STEP kcal) = this many grams of carbs and fat. */
const STEP_C=25, STEP_F=5;
const CARB_FLOOR=150, FAT_FLOOR=55;
const DIET_BREAK_WEEK=7, DIET_BREAK_KCAL=450, DIET_BREAK_C=112;
const TRAIN_DAY_WATER=24;            // extra oz on lifting / interval days
const CAFFEINE_CUTOFF="14:00";
const SET_LIMITS={startWeight:[100,450],goal:[100,450],cal:[FLOOR,CEIL],p:[150,260],c:[CARB_FLOOR,450],f:[FAT_FLOOR,130],steps:[2000,30000],water:[40,220],ftp:[50,600]};
const DAY_LIMITS={weight:[80,500],cal:[0,8000],protein:[0,500],steps:[0,80000],water:[0,400],sleep:[0,16],waist:[20,70]};
const PROGRESSION="Double progression: when every set hits the top of the rep range at the target RIR, add load (+5 lb barbell upper body, +10 lb lower body, +1 stack plate, +5 lb DB).";
const TIME_SAVER="Running past 60 min? Take the low end of each rest range and 30 s transitions. Never cut a compound's rest below its minimum.";
/* Exercise record: {id,n,s,r,rest,restNote,restSec,eq,setup,cues[2],alts[],priority,pair,tip?,optional?}.
   rest = short display string; restNote = full instruction; restSec = timer seconds. */
const X=(id,n,eq,s,r,rest,restNote,restSec,pair,priority,setup,cues,alts,more)=>Object.assign({id,n,eq,s,r,rest,restNote,restSec:Math.round(restSec),pair:pair||null,priority:!!priority,setup,cues,alts},more||{});
const WORKOUTS={
  UA:{name:"Upper A",focus:"Chest + Lats",day:1,warmup:"upper",ramp:"incline_bb_press",durationEst:{base:"~52 min",build:"~60–63 min"},durMin:{base:52,build:62},ex:[
    X("incline_bb_press","Incline barbell press (30°)",["Rack","Bench"],3,"6–8","90 s","90 s transition to the pull-up (pair A); about 3:00 before repeating this exercise.",90,"A1",1,
      "Rack: bench at 30° inside the rack, J-hooks at arm's length, safeties 1\" above chest touch.",["Touch the upper chest with a 1 s soft pause.","Wrists over elbows; drive back into the bench."],["Incline DB press (30°)","FT2 Smith incline press"],{tip:"Main lift. Ramp up before your first working set."}),
    X("pull_up","Pull-up",["Rack","Bodyweight"],3,"6–10","90 s","90 s transition back to the incline press (pair A).",90,"A2",1,
      "Rack pull-up bar (or the FT2 bar); hands 1.5× shoulder width. Hold a DB between the feet to add load once you pass 10 reps.",["Full dead hang between reps (lats stretched).","Pull the elbows to the back pockets; chest toward the bar."],["FT2 kneeling dual-handle pulldown","FT2 pull-up strap assisted"],{tip:"Do 1 easy set of 3–5 after the scap pull-ups in the warm-up."}),
    X("cable_fly_low_high","Low-to-high cable fly",["FT2"],3,"10–15","60 s","60 s transition to the single-arm pulldown (pair B).",60,"B1",1,
      "FT2: both LOW pulleys, D-handles, staggered stance one step in front of the uprights.",["Let the arms drift back and down until the chest stretches.","Sweep up and in to chin height; pinkies up."],["Incline DB fly (30°)","Deficit push-up on DB handles"]),
    X("sa_cable_pulldown","Single-arm half-kneeling cable pulldown",["FT2"],3,"10–12 / side","60 s","60 s transition back to the fly (pair B).",60,"B2",1,
      "FT2: HIGH pulley, single D-handle; half-kneel slightly to the side, away from the column.",["Reach up and across until the lat stretches; ribs stay down.","Drive the elbow to the hip; lean slightly toward the working arm."],["DB pullover on a flat bench","Pull-up with a 3 s lowering"]),
    X("btb_cable_lateral","Behind-the-back cable lateral raise",["FT2"],3,"12–15 / side","30–60 s","Alternate arms; 30–60 s between sides.",45,null,1,
      "FT2: LOW pulley, single D-handle; the cable runs behind your back to the far hand.",["Start with the hand behind the hip (delt stretched).","Lead with the elbow; stop at shoulder height."],["DB lean-away lateral (holding the rack)","FT2 cross-body lateral in front of the body"]),
    X("oh_rope_ext","Overhead cable triceps extension",["FT2"],3,"10–15","30–60 s","Superset with the incline curl (D); 30–60 s transition.",45,"D1",0,
      "FT2: HIGH pulley, rope; face away in a split stance, torso leaned 30°.",["Elbows beside the ears; get a deep stretch behind the head.","Lock out fully and spread the rope."],["Seated DB two-hand overhead extension","EZ bar on the low pulley, overhead"]),
    X("incline_db_curl","Incline DB curl",["DB","Bench"],3,"10–12","30–60 s","Superset with the overhead extension (D); 30–60 s transition.",45,"D2",0,
      "Bench at 45–60°, arms hanging straight down behind the torso.",["Keep the elbows behind the body; fully extend at the bottom.","Supinate hard at the top; 2 s lowering."],["FT2 Bayesian curl","FT2 EZ-bar cable curl"])]},
  LA:{name:"Lower A",focus:"Quads + Nordic",day:2,warmup:"lower",ramp:"hb_back_squat",durationEst:{base:"~57 min",build:"~57 min"},durMin:{base:57,build:57},ex:[
    X("hb_back_squat","High-bar back squat",["Rack"],3,"5–8","2:30–3:00","Rest 2:30–3:00.",165,null,0,
      "Rack: J-hooks at mid-chest; safeties 1–2\" below bottom depth; optional 10 lb plates under the heels.",["Brace (breathe 360°) before each rep; knees track over the toes.","Sit between the heels to full depth; drive up chest first."],["FT2 Smith heels-elevated squat","Barbell front squat"],{tip:"Main lift. Ramp up before your first working set."}),
    X("bulgarian_split_squat","Bulgarian split squat",["Hyper Pro","DB"],3,"8–12 / leg","60 s","Alternate legs; 60 s between legs.",60,null,0,
      "Hyper Pro: rear foot on the leg roller (split-squat mode), DBs at your sides.",["Drop the back knee straight down; front knee forward for quads.","Slight forward lean for glutes; 1 s stretch at the bottom."],["DB reverse lunge from a 45 lb plate (deficit)","FT2 Smith split squat"]),
    X("nordic_curl","Nordic hamstring curl (incline-regressed)",["Hyper Pro"],3,"4–8","2:00","Rest 2:00.",120,null,0,
      "Hyper Pro: Nordic mode, ankles under the roller. Start at an incline where 6 reps leave 2 in reserve; lower one setting every 1–2 weeks.",["Hips stay extended: straight line from knee to shoulder.","Fight a 3–5 s lowering; push off with the hands and curl back up."],["FT2 prone cable leg curl","Hyper Pro glute-ham raise (with the GHD)"]),
    X("reverse_nordic","Reverse Nordic",["Hyper Pro","Bodyweight"],2,"8–12","90 s","Rest 90 s.",90,null,0,
      "Hyper Pro: kneel on the pad, ankles under the roller. Hold a DB at the chest once 12 reps are easy.",["Hips locked (no hinge) as you lean back.","Go as deep as you control; lead the return with the quads."],["FT2 seated cable leg extension (ankle strap, LOW pulley)","Rack-assisted sissy squat"],{tip:"Stands in for a leg extension."}),
    X("sl_db_calf_raise","Single-leg standing DB calf raise",["DB","Rack"],4,"10–15 / leg","30–60 s","Alternate legs; pair with the tibialis raise on rounds 1–2 (E). 30–60 s transitions.",45,"E1",0,
      "Forefoot on a 45 lb plate stack or step; hold the rack with one hand, DB in the other.",["2 s pause in the deepest stretch; no bouncing.","Rise all the way onto the big toe."],["FT2 Smith calf raise on a plate","Barbell calf raise in the rack"]),
    X("tib_raise","Tibialis raise",["Bodyweight"],2,"15–25","30–60 s","Pair with the calf raise (E); 30–60 s transition.",45,"E2",0,
      "Back against a wall, heels 12–24\" out (farther is harder).",["Pull the toes toward the shins fully.","3 s lowering, all the way down."],["FT2 seated cable dorsiflexion (ankle strap, LOW pulley)","Seated DB tib raise (DB between the feet)"]),
    X("hanging_knee_raise","Hanging knee raise to pelvic tilt",["Rack","Bodyweight"],2,"10–15","75–90 s","Rest 75–90 s.",82.5,null,0,
      "Rack pull-up bar, shoulder-width grip.",["Curl the pelvis up (posterior tilt), not just the knees.","No swinging; 2 s lowering."],["FT2 kneeling rope cable crunch","Hyper Pro GHD sit-up (partial range)"])]},
  VT:{name:"V-taper",focus:"Delts + Arms",day:3,warmup:"vt",ramp:null,durationEst:{base:"~20 min",build:"~22 min"},durMin:{base:20,build:22},ex:[
    X("seated_db_lateral","Seated DB lateral raise + lengthened partials",["DB","Bench"],4,"12–20","75–90 s","Rest 75–90 s. Last set: add 5 bottom-half partials.",82.5,null,1,
      "Bench upright, seated at the end; light DBs (15–25 lb).",["Slight forward lean; raise in the scapular plane, pinky slightly up.","Lower under control; last-set partials from the bottom to halfway."],["FT2 cable lateral (LOW pulley)","DB lean-away lateral"]),
    X("db_hammer_curl","DB hammer curl",["DB"],2,"10–15","30–60 s","Superset with the skull crusher (C); 30–60 s transition.",45,"C1",0,
      "Standing, neutral grip.",["Elbows pinned; no swing.","Squeeze at the top; 2 s lowering."],["FT2 rope hammer curl (LOW pulley)"]),
    X("db_skull_crusher","DB skull crusher to behind the head",["DB","Bench"],2,"10–15","30–60 s","Superset with the hammer curl (C); 30–60 s transition.",45,"C2",0,
      "Flat bench, neutral-grip DBs.",["Lower beside and behind the head for a long-head stretch.","Elbows angled slightly back; lock out fully."],["FT2 EZ-bar overhead extension","FT2 rope pushdown"]),
    X("pallof_press","Tall-kneeling Pallof press",["FT2"],2,"10–12 / side, 2 s hold","30–60 s","Alternate sides; 30–60 s between sides.",45,null,0,
      "FT2: LOW pulley, single D-handle; tall-kneel sideways to the column, handle at the sternum.",["Press out and resist the rotation; hips square.","Exhale on the press; ribs stacked."],["FT2 half-kneeling cable chop","Side plank 2×30 s / side"]),
    X("cable_reverse_fly","Cross-cable reverse fly (optional)",["FT2"],2,"15–20","75–90 s","Optional finisher: only if the session is still under 25 min. Rest 75–90 s.",82.5,null,0,
      "FT2: both HIGH pulleys, cables crossed; hold the stoppers or D-handles.",["Arms at shoulder height; sweep out wide.","Don't shrug; pause 1 s at the end."],["Chest-supported DB reverse fly (bench 30°)","FT2 rope face pull"],{optional:true})]},
  UB:{name:"Upper B",focus:"Back + Delts",day:4,warmup:"upper",ramp:"low_incline_db_press",durationEst:{base:"~55 min",build:"~60–63 min"},durMin:{base:55,build:62},ex:[
    X("low_incline_db_press","Low-incline DB press (15–20°)",["DB","Bench"],4,"8–12","90 s","90 s transition to the row (pair A); about 3:00 before repeating this exercise.",90,"A1",1,
      "Bench on the lowest incline notch; kick the DBs up from the knees.",["Lower deep so the DBs sit just outside the chest.","Press up and slightly in; shoulder blades pinned."],["Incline barbell press (30°)","FT2 Smith low-incline press"],{tip:"Main lift. Ramp up before your first working set."}),
    X("cs_db_row","Chest-supported DB row",["DB","Bench"],3,"8–12","90 s","90 s transition back to the press (pair A).",90,"A2",0,
      "Bench at 30°, chest on the pad, DBs hanging straight down.",["Let the shoulder blades spread at the bottom (stretch).","Pull the elbows toward the hips; 1 s squeeze."],["FT2 seated dual low-pulley row (D-handles)","Barbell Pendlay row"]),
    X("dual_handle_pulldown","Kneeling dual-handle cable pulldown",["FT2"],3,"10–12","90 s","Rest 90 s.",90,null,1,
      "FT2: both HIGH pulleys, a D-handle in each hand; kneel centered (both stacks, about 170 lb max).",["Arms wide and slightly forward at the top; let the lats stretch.","Drive the elbows down and in to the ribs; chest up."],["Pull-up (neutral grip on the FT2 bar)","Single-arm half-kneeling cable pulldown"]),
    X("cross_body_lateral","Lean-away cross-body cable lateral",["FT2"],3,"12–20 / side","30–60 s","Alternate arms; 30–60 s between sides.",45,null,1,
      "FT2: LOW pulley, D-handle, cable in front of the body; hold the upright and lean 15° away.",["Start with the hand across the opposite hip.","Raise to shoulder height; 2 s lowering."],["Behind-the-back cable lateral raise","Seated DB lateral raise"]),
    X("rope_face_pull","Rope face pull",["FT2"],3,"12–15","75–90 s","Rest 75–90 s.",82.5,null,0,
      "FT2: HIGH pulley, rope; step back and lean slightly so the rope tracks to the forehead.",["Pull apart and back; finish in a double-biceps position.","Rotate out at the end; no shrugging."],["Cross-cable reverse fly","Hyper Pro trap-3 raise"]),
    X("bayesian_curl","Bayesian cable curl",["FT2"],3,"10–15 / arm","30–60 s","Superset with the rope pushdown (F); 30–60 s transition.",45,"F1",0,
      "FT2: LOW pulley, D-handle; face away and step forward so the arm trails behind the body.",["Upper arm stays behind the torso the whole time.","Curl without letting the elbow drift forward."],["Incline DB curl","FT2 EZ-bar curl"]),
    X("rope_pushdown","Rope pushdown",["FT2"],3,"10–15","30–60 s","Superset with the Bayesian curl (F); 30–60 s transition.",45,"F2",0,
      "FT2: HIGH pulley, rope (or the straight bar).",["Elbows fixed at the sides.","Spread the rope at the bottom; 2 s back up."],["Overhead cable triceps extension","DB kickback"])]},
  LB:{name:"Lower B",focus:"Hinge + Posterior",day:5,warmup:"lower",ramp:"bb_rdl",durationEst:{base:"~59 min",build:"~59 min"},durMin:{base:59,build:59},ex:[
    X("bb_rdl","Barbell Romanian deadlift",["Rack"],3,"6–10","2:30","Rest 2:30.",150,null,0,
      "Rack: unrack from J-hooks at mid-thigh; straps optional.",["Hips back with soft knees; bar drags down the thighs.","Stop at a full hamstring stretch (about mid-shin); squeeze the glutes to stand."],["DB RDL","Hyper Pro 45° back extension (loaded)"],{tip:"Main lift. Ramp up before your first working set."}),
    X("smith_heel_elev_squat","FT2 Smith heels-elevated squat (3-1-1 tempo)",["FT2"],3,"8–12","2:00","Rest 2:00.",120,null,0,
      "FT2 Smith bar; heels on 10 lb plates, feet slightly forward. Load tops out, so add tempo or a pause.",["3 s down, knees well forward, 1 s pause at depth.","Torso upright, brace locked."],["Barbell front squat","DB goblet squat, heels elevated, 1.5 reps"]),
    X("prone_cable_leg_curl","Prone single-leg cable leg curl",["FT2","Bench"],3,"10–15 / leg","30–60 s","Alternate legs; 30–60 s between legs.",45,null,0,
      "FT2: LOW pulley + ankle strap; flat bench in line, face down, feet toward the column.",["Hips pressed into the bench.","Curl to 90°+; 3 s lowering to full extension."],["Nordic hamstring curl","FT2 standing single-leg cable curl"]),
    X("reverse_hyper","Reverse hyper",["Hyper Pro"],3,"12–15","75–90 s","Rest 75–90 s.",82.5,null,0,
      "Hyper Pro: reverse-hyper mode, band-loaded; hips on the pad edge, grip the handles.",["Swing up with the glutes to hip level, not above.","Let the legs fall and lightly stretch the low back; don't rush."],["Hyper Pro 90° back extension","FT2 cable pull-through (rope, LOW pulley)"]),
    X("sissy_squat","Rack-assisted sissy squat",["Rack","Bodyweight"],2,"8–15","90 s","Rest 90 s.",90,null,0,
      "Hold a rack upright with one hand; heels up. Hold a DB at the chest when 15 reps are easy.",["Knees travel forward while the hips stay extended.","Go as deep as the knees tolerate; build depth over weeks."],["Reverse Nordic","FT2 seated cable leg extension"]),
    X("seated_db_calf","Seated bent-knee calf raise",["DB","Bench"],4,"12–20","75–90 s","Rest 75–90 s.",82.5,null,0,
      "Sit at the end of the bench, forefeet on a 45 lb plate, heavy DBs on the knees.",["2 s stretch at the bottom.","Full rise; no rocking."],["Single-leg standing DB calf raise","FT2 Smith seated calf raise"]),
    X("barbell_rollout","Barbell rollout",["Rack","Bodyweight"],2,"6–12","75–90 s","Rest 75–90 s.",82.5,null,0,
      "Barbell with 10 or 25 lb round plates as the wheel; kneel on a pad.",["Ribs down, glutes squeezed; stop before the low back sags.","Pull back with the lats, not the hips."],["Long-lever plank 3×20 s","FT2 kneeling cable body-saw"])]}
};
Object.values(WORKOUTS).forEach(w=>w.prog=PROGRESSION);
const wkName=id=>`${WORKOUTS[id].name} · ${WORKOUTS[id].focus}`;
const exById=id=>{for(const w of Object.values(WORKOUTS)){const e=w.ex.find(x=>x.id===id);if(e)return e;}return null;};
const WARMUPS={
  upper:["2:00 Tread 3.0 mph @ 3%","FT2 light face pull ×15","Scap pull-ups ×8","Push-ups ×10","FT2 cable external rotation ×12 / side"],
  lower:["2:00 Tread 3.2 mph @ 6%","90/90 hip switches ×6 / side","Hyper Pro reverse hyper, light band ×10","Leg swings ×10 each way","Bodyweight squat, 2 s pause at the bottom ×8"],
  vt:["Done right after the Wednesday bike ride","Band or cable pull-aparts ×15","One light lateral-raise set ×15, far from failure"],
  conditioning:["3:00 walk, ramping 2.5 → 3.3 mph @ 1–3%","2:00 at the first interval's walk speed, then start"]
};
/* Ramp for the first compound, as % of the first working weight. */
const RAMP=["empty bar ×10","40% ×6","60% ×4","75% ×2","85–90% ×1"];
const RAMP_PCT=[null,.40,.60,.75,.875];
const MOBILITY=["90/90 hip switches, 1:00","Couch stretch, 0:45 / side","Thoracic open-book, 6 / side","Passive dead hang, 0:30–0:45","Wall ankle rocks, 10 / side"];
const ADDONS={grip:"Fri: 2× max dead hang on the rack bar, or DB farmer carry 3×40 yd heavy.",neck:"Tue/Fri: 2×15–20 each way, lying on the bench with a towel-wrapped 5–10 lb plate, far from failure.",satCore:["Side plank 2×30–45 s / side","Dead bug 2×8 / side","FT2 Pallof press 1×12 / side"],mobility:MOBILITY};
const WEEKLY_SETS={"Side delts":"10 → 13 (3× a week)","Lats":"≈10.5 → 13.5","Upper chest":"10 → 13","Quads":"13","Hamstrings":"9 (+ RDL and back-extension carryover)","Glutes":"≈12 (indirect)","Biceps":"8 (+ pulling)","Triceps":"8 (+ pressing)","Rear delts":"3 direct (face pull) + rows; +2 with the optional VT reverse fly","Calves":"8","Core":"6–8 (+ Saturday optional)"};

/* ---------- 12-week blocks ---------- */
const wk12=w=>Math.min(Math.max(Math.floor(+w)||1,1),12);
function blockFor(week){
  const w=wk12(week);
  if(w<=3)return {key:"learn",name:"Learn",weeks:"1–3",rir:"2–3",note:"Learn the setups and record your loads."};
  if(w<=6)return {key:"build",name:"Build",weeks:"4–6",rir:"1–2",note:"+1 set on priority lifts."};
  if(w===7)return {key:"deload",name:"Deload",weeks:"7",rir:"3",note:"−1 set per exercise; same weight or −10%. Diet break at maintenance (Thanksgiving week)."};
  if(w<=11)return {key:"push",name:"Push",weeks:"8–11",rir:"1–2 compounds, 0–2 isolation",note:"+1 set on priority lifts. The last set of cable or DB isolation work may reach failure."};
  return {key:"peak",name:"Peak",weeks:"12",rir:"2",note:"Sets cut by 30%; keep Week 11 weights. Photo week: no PR attempts."};
}
const BLOCKS=[1,4,7,8,12].map(blockFor);
/* week may be a number or a planFor() object */
function setsFor(ex,week){
  const w=wk12(week&&typeof week==="object"?week.week:week), b=+ex.s||1, pri=ex.priority?1:0;
  if(w<=3)return b;
  if(w<=6)return b+pri;
  if(w===7)return Math.max(1,b-1);
  if(w<=11)return b+pri;
  return Math.max(1,Math.round((b+pri)*.7));
}
/* Display string for a session length. liftDur() is the canonical number; this just formats it. */
const durationFor=(id,week)=>`~${liftDur(id,week)} min`;
function liftDur(id,week){
  const k=blockFor(week).key,W=WORKOUTS[id],ex=W.ex.filter(e=>!e.optional);
  const build=k==="build"||k==="push", m=build?W.durMin.build:W.durMin.base;
  const ref=ex.reduce((a,e)=>a+(build?e.s+(e.priority?1:0):e.s),0), now=ex.reduce((a,e)=>a+setsFor(e,week),0);
  return Math.round((5+(m-5)*now/ref)/5)*5;      // ~5 min warm-up plus working sets scaled to this week's volume
}

/* ---------- conditioning by week ---------- */
const PZ_FILTER="Cycling › Class Type › Power Zone (PZ, PZ Endurance, PZ Max), FTP Warm Up, FTP Test";
const PZ_NOTE="Ride your zone bar, not the instructor's resistance cue. Peloton sets FTP at about 95% of your 20-min test average and updates zones automatically.";
const RUN_FILTER="Running › Class Type › Walk + Run or Beginner (20–30 min), or Just Run with the intervals below";
const RUN_NOTE="Run 5.0–5.5 mph, walk 3.3–3.5 mph, everything at 1% incline. RPE 6 or less: you can talk. Joint flare-up: take a 30–45 min Hike class instead.";
const seg=(t,s,c,more)=>Object.assign({t,s,c},more||{});
const BIKE_EASY=(s,z)=>seg("Warm-up",s,"easy",{z:z||"Z1–2"});
function bikeIntervals(n,hard,easy,z){const a=[BIKE_EASY(300)];for(let r=1;r<=n;r++){a.push(seg("Hard",hard,"hard",{r,z}));a.push(seg("Easy",easy,"easy",{r,z:"Z1"}));}a.push(seg("Cool-down",300,"easy",{z:"Z1"}));return a;}
function bikeSteady(min,z){return [BIKE_EASY(300),seg("Easy",min*60,"easy",{z}),seg("Cool-down",300,"easy",{z:"Z1"})];}
const bikeFTP=()=>[seg("Warm-up",600,"easy",{z:"FTP warm-up"}),seg("Hard",1200,"hard",{z:"20-min test: best steady effort"}),seg("Cool-down",300,"easy",{z:"Z1"})];
function treadPlan(sets){ // sets: [[rounds,runS,runMph,walkS]...]
  const a=[seg("Warm-up walk",300,"walk",{mph:3.0,incline:1})];
  sets.forEach(([n,rs,mph,ws])=>{for(let r=1;r<=n;r++){a.push(seg("Run",rs,"run",{r,mph,incline:1}));a.push(seg("Walk",ws,"walk",{r,mph:3.3,incline:1}));}});
  a.push(seg("Cool-down",300,"walk",{mph:3.0,incline:1}));return a;
}
const W_=(min,mph,incline,text)=>({min,mph,incline,text:text||`${min} min · ${mph.toFixed(1)} mph · ${incline}%`});
const COND=[null,
  {walk:W_(20,3.0,6),wed:{class:"10-min FTP Warm Up + 20-min Low Impact or Beginner Power Zone (ride by feel; learn the zone bar)",min:30,fallback:bikeSteady(20,"Z2, by feel")},sat:{text:"6 × (1:00 run @ 5.0 / 2:00 walk)",segments:treadPlan([[6,60,5.0,120]])}},
  {walk:W_(20,3.0,7),wed:{class:"FTP Warm Up + 20-min FTP Test",min:30,ftpTest:true,fallback:bikeFTP()},sat:{text:"8 × (1:00 run @ 5.0 / 1:30 walk)",segments:treadPlan([[8,60,5.0,90]])}},
  {walk:W_(20,3.1,8),wed:{class:"20-min Power Zone (Z3–5 intervals, Z1 recoveries)",min:20,fallback:bikeIntervals(6,60,120,"Z5")},sat:{text:"5 × (2:00 run @ 5.0–5.2 / 2:00 walk)",segments:treadPlan([[5,120,5.0,120]])}},
  {walk:W_(25,3.2,8),wed:{class:"30-min Power Zone",min:30,fallback:bikeIntervals(6,60,120,"Z5")},sat:{text:"4 × (3:00 run @ 5.2 / 2:00 walk)",segments:treadPlan([[4,180,5.2,120]])}},
  {walk:W_(25,3.2,9),wed:{class:"20-min Power Zone Max (Z4–7)",min:20,fallback:bikeIntervals(6,60,120,"Z5")},sat:{text:"5 × (3:00 run @ 5.2 / 1:30 walk)",segments:treadPlan([[5,180,5.2,90]])}},
  {walk:W_(25,3.2,10),wed:{class:"30-min Power Zone",min:30,fallback:bikeIntervals(6,60,120,"Z5")},sat:{text:"4 × (4:00 run @ 5.2–5.3 / 2:00 walk)",segments:treadPlan([[4,240,5.2,120]])}},
  {walk:W_(15,3.0,5,"15–20 min · 3.0 mph · 5% (deload)"),wed:{class:"20–30 min Low Impact or Power Zone Endurance (Z2–3)",min:25,fallback:bikeSteady(20,"Z2–3")},sat:{text:"4 × (2:00 run / 2:00 walk), or a 30-min Hike class",segments:treadPlan([[4,120,5.0,120]])}},
  {walk:W_(25,3.3,10),wed:{class:"FTP Warm Up + 20-min FTP Test (retest, fresh after the deload)",min:30,ftpTest:true,fallback:bikeFTP()},sat:{text:"4 × (4:00 run @ 5.3 / 1:30 walk)",segments:treadPlan([[4,240,5.3,90]])}},
  {walk:W_(30,3.3,10),wed:{class:"30-min Power Zone",min:30,fallback:bikeIntervals(8,60,90,"Z5–6")},sat:{text:"3 × (6:00 run @ 5.3 / 2:00 walk)",segments:treadPlan([[3,360,5.3,120]])}},
  {walk:W_(30,3.4,11),wed:{class:"30-min Power Zone Max",min:30,fallback:bikeIntervals(8,60,90,"Z5–6")},sat:{text:"2 × (10:00 run @ 5.3–5.5 / 3:00 walk)",segments:treadPlan([[2,600,5.3,180]])}},
  {walk:W_(30,3.4,12),wed:{class:"30-min Power Zone (Christmas week: a 20-min class is fine)",min:30,fallback:bikeIntervals(8,60,90,"Z5–6")},sat:{text:"2 × (8:00 run @ 5.3 / 2:00 walk) + 4 × (0:30 @ 6.0–6.5 / 1:30 walk)",segments:treadPlan([[2,480,5.3,120],[4,30,6.2,90]])}},
  {walk:W_(20,3.2,8),wed:{class:"20-min Power Zone Endurance or Low Impact",min:20,fallback:bikeSteady(10,"Z2–3")},sat:{text:"5 × (2:00 run @ 5.2 / 2:00 walk), or a 30-min Hike class",segments:treadPlan([[5,120,5.2,120]])}}
];
COND.forEach(c=>{if(!c)return;const w=c.wed;w.peloton={filters:PZ_FILTER,note:PZ_NOTE};
  w.short=w.ftpTest?"FTP test":/^20–30 min Low|Endurance or Low/.test(w.class)?"Easy ride (Z2–3)":/Max/.test(w.class)?"Power Zone Max":/FTP Warm Up \+ 20-min Low/.test(w.class)?"Easy Power Zone":"Power Zone";});
const segMins=a=>Math.round(a.reduce((x,s)=>x+s.s,0)/60);
/* Peloton Power Zones as % of FTP. Returns watt ranges, or null without an FTP. */
const ZONE_BANDS=[[1,0,.55,"Active recovery"],[2,.56,.75,"Endurance"],[3,.76,.90,"Tempo"],[4,.91,1.05,"Threshold"],[5,1.06,1.20,"VO2 max"],[6,1.21,1.50,"Anaerobic"],[7,1.51,null,"Neuromuscular"]];
function ZONES(ftp){
  ftp=+ftp;if(!(ftp>0))return null;
  return ZONE_BANDS.map(([z,a,b,label])=>({z,lo:Math.round(a*ftp),hi:b==null?null:Math.round(b*ftp),pctLo:Math.round(a*100),pctHi:b==null?null:Math.round(b*100),label}));
}
const zoneText=(ftp,z)=>{const Z=ZONES(ftp);if(!Z)return "";const x=Z[z-1];return `Z${z} ${x.lo}${x.hi!=null?"–"+x.hi:"+"} W`;};
/* keyed by JS getDay(): 0 Sun … 6 Sat. Walk details on Mon/Tue/Thu/Fri come from COND[week].walk (see planFor). */
const WALK_NOTE="Hands off the rails. You should be able to talk in full sentences.";
const SCHED={
  1:{lift:"UA",walkCond:true,walkShort:"incline walk",label:"Upper A day"},
  2:{lift:"LA",walkCond:true,walkShort:"incline walk",label:"Lower A day"},
  3:{lift:"VT",intervals:true,intervalMode:"bike",cardioFirst:true,walk:"Easy walk 15 min",walkShort:"easy walk",walkMin:15,walkNote:"Easy pace to cool down after the V-taper work.",label:"Bike + V-taper day"},
  4:{lift:"UB",walkCond:true,walkShort:"incline walk",label:"Upper B day"},
  5:{lift:"LB",walkCond:true,walkShort:"incline walk",label:"Lower B day"},
  6:{intervals:true,intervalMode:"tread",walk:"Outdoor walk 50 min",walkShort:"outdoor walk",walkMin:50,walkNote:"Outdoors at a steady pace you could talk through.",label:"Tread run/walk + long walk"},
  0:{walk:"Optional easy walk 30–45 min",walkShort:"optional easy walk",walkMin:30,walkNote:"Easy outdoor walk. Recovery, not training.",optionalWalk:true,label:"Rest + weekly check-in",checkin:true}
};
const DOWN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DOWL=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* Legacy shape for old callers, approximated from the Saturday tread plan. New code uses intervalPlan(k). */
function proto(week){
  const w=wk12(week), sg=COND[w].sat.segments, runs=sg.filter(s=>s.c==="run"), walks=sg.filter(s=>s.t==="Walk");
  const p={week:w,run:runs[0].s,walk:walks[0].s,rounds:runs.length,warm:300,cool:300,rpe:"RPE 6 or less: conversational."};
  p.mins=segMins(sg);return p;
}
const fmtS=s=>{const m=Math.floor(s/60),r=s%60;return `${m}:${String(r).padStart(2,"0")}`;};
const protoText=(p,mode)=>mode==="bike"?`${fmtS(p.run)} hard / ${fmtS(p.walk)} easy × ${p.rounds}`:`${fmtS(p.run)} run / ${fmtS(p.walk)} walk × ${p.rounds}`;
