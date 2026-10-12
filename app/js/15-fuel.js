/* =========================================================
   FUEL — nutrition & health overview (Builder E)
   Content: app/research/nutrition.md (JSON block, verified citations).
   Live numbers: targetsFor(), getDay(), timeline(), buildMeals().
   ========================================================= */
const FUEL_DATA={"sections": [{"id": "hydration", "title": "Hydration", "takeaway": "Aim for about 100 oz of drinks on a rest day and about 125 oz on a training day. Drink most of it before dinner, sip through workouts, and slow down after 8 PM.", "numbers": ["Total water adequate intake for men: ~3.7 L/day (~125 oz), ~3.0 L (~100 oz) from beverages", "Training: +16–24 oz during the 5 PM session", "Keep sweat loss under 2% body weight (< ~4 lb)", "Each 1 lb lost in a session ≈ 16 oz to replace (drink 1.25–1.5× over the next hours)"], "tips": ["16 oz right after waking at 5:30", "Two desk bottles: 32 oz by noon, 24 oz by 4:30", "Sip every 10–15 min while training", "Small sips only after 8 PM to protect sleep", "Target pale-straw urine color"], "cites": [{"text": "National Academies (IOM) — DRIs for Water, Potassium, Sodium, Chloride and Sulfate", "url": "https://www.nationalacademies.org/news/report-sets-dietary-intake-levels-for-water-salt-and-potassium-to-maintain-health-and-reduce-chronic-disease-risk"}, {"text": "Sawka MN et al. ACSM Position Stand: Exercise and fluid replacement. Med Sci Sports Exerc 2007", "url": "https://pubmed.ncbi.nlm.nih.gov/17277604/"}, {"text": "Armstrong LE et al. Urinary indices of hydration status. Int J Sport Nutr 1994", "url": "https://pubmed.ncbi.nlm.nih.gov/7987361/"}]}, {"id": "electrolytes", "title": "Electrolytes", "takeaway": "Don't fear salt when you sweat daily. Keep sodium steady day to day so the scale isn't skewed, and get potassium and magnesium mostly from food.", "numbers": ["Sodium: general guideline <2,300 mg/day; ~2,300–3,000 mg on training days is reasonable if your blood pressure is normal", "Potassium: 3,400 mg/day (adequate intake, men)", "Magnesium: 400 mg (ages 19–30) / 420 mg (31+) per day; supplement upper limit 350 mg"], "tips": ["Keep sodium consistent; a salty meal can add 2–4 lb of water overnight", "Potassium: sweet potato ~450 mg, banana ~420 mg, Greek yogurt ~350 mg/cup, greens, beans", "Magnesium: pumpkin seeds (~150 mg/oz), almonds, spinach, black beans, oats", "If you have high blood pressure, follow your doctor's sodium target"], "cites": [{"text": "Dietary Guidelines for Americans 2020–2025", "url": "https://www.dietaryguidelines.gov/2020-2025-dietary-guidelines"}, {"text": "American Heart Association — How much sodium should I eat per day?", "url": "https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/sodium/how-to-track-your-sodium"}, {"text": "NASEM 2019 — DRIs for Sodium and Potassium", "url": "https://www.nationalacademies.org/read/25353/chapter/5"}, {"text": "NIH ODS — Magnesium fact sheet", "url": "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/"}, {"text": "NIH ODS — Potassium fact sheet", "url": "https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/"}]}, {"id": "micronutrients", "title": "Micronutrients a cut can miss", "takeaway": "Your diet covers B12, zinc and iron. The real gaps are omega-3s (no fish) and possibly vitamin D. A basic multivitamin is optional insurance.", "numbers": ["Vitamin D: RDA 600 IU; upper limit 4,000 IU; practical 600–1,000 IU (≤2,000 IU)", "Omega-3: fish 2x/week (3.5 oz servings) or ~250–500 mg EPA+DHA/day", "Calcium: 1,000 mg/day", "Iron: 8 mg/day (no supplement unless a blood test shows you need it)", "B12: 2.4 mcg/day (covered by food)", "Zinc: 11 mg/day; upper limit 40 mg"], "tips": ["Swap one sirloin or turkey dinner for salmon twice a week", "Keep Greek yogurt daily for calcium", "The 2024 Endocrine Society guideline doesn't recommend routine vitamin D testing in healthy adults under 75", "If you take a multivitamin, choose a basic one near 100% of the daily value, without extra iron, beta-carotene or vitamin E"], "cites": [{"text": "Demay MB et al. Vitamin D for the Prevention of Disease: Endocrine Society Guideline 2024", "url": "https://www.endocrine.org/clinical-practice-guidelines/vitamin-d-for-prevention-of-disease"}, {"text": "Rimm EB et al. Seafood n-3 PUFAs and CVD: AHA Science Advisory 2018", "url": "https://professional.heart.org/en/science-news/seafood-long-chain-n3-polyunsaturated-fatty-acids-and-cardiovascular-disease"}, {"text": "USPSTF. Vitamin, mineral, and multivitamin supplementation to prevent CVD and cancer. JAMA 2022", "url": "https://pubmed.ncbi.nlm.nih.gov/35727271/"}]}, {"id": "supplements", "title": "Evidence-based supplements", "takeaway": "Creatine, whey and (carefully timed) caffeine are the only performance supplements worth buying. Vitamin D and omega-3 fill gaps. Skip fat burners, BCAAs and T-boosters.", "numbers": ["Creatine: 3–5 g/day", "Whey: 25–40 g/serving as needed to reach 200 g protein", "Caffeine: ≤400 mg/day; ≤100 mg before 5 PM training, or none; cutoff ~2 PM", "Protein: 200 g ≈ 2.2 g/kg"], "tips": ["Buy NSF Certified for Sport or Informed Sport products", "Expect ~1–2 lb of water weight when starting creatine", "Tell your doctor you take creatine (it raises creatinine on labs)", "Ask your doctor or pharmacist first if you take medications"], "cites": [{"text": "Kreider RB et al. ISSN position stand: creatine. JISSN 2017", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC5469049/"}, {"text": "Guest NS et al. ISSN position stand: caffeine and exercise performance. JISSN 2021", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7777221/"}, {"text": "Morton RW et al. Protein supplementation and resistance training: meta-analysis. Br J Sports Med 2018", "url": "https://pubmed.ncbi.nlm.nih.gov/28698222/"}]}, {"id": "fiber-gut", "title": "Fiber and gut health", "takeaway": "Your 30+ g target fits 2,250 kcal. Push toward 35–38 g with ~30 different plants a week and a daily fermented food.", "numbers": ["Fiber AI: 14 g per 1,000 kcal (~32 g at 2,250 kcal); 38 g/day for men 19–50", "Target: 32–38 g/day", "~30 different plant types per week", "1–2+ servings of fermented food per day"], "tips": ["Raspberries (~8 g/cup), black beans (~7–8 g per ½ cup), chia (~4 g/Tbsp), oats, broccoli", "Herbs, spices, nuts and seeds count toward plant variety", "Add kefir, kimchi, sauerkraut or miso alongside Greek yogurt", "Increase fiber gradually and drink more water with it"], "cites": [{"text": "National Academies — DRIs for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein and Amino Acids", "url": "https://www.nationalacademies.org/read/10490/chapter/1"}, {"text": "McDonald D et al. American Gut. mSystems 2018", "url": "https://pubmed.ncbi.nlm.nih.gov/29795809/"}, {"text": "Wastyk HC et al. Gut-microbiota-targeted diets modulate human immune status. Cell 2021 (UC eScholarship record)", "url": "https://escholarship.org/uc/item/1kh496nv"}]}, {"id": "meal-timing", "title": "Meal timing and protein distribution", "takeaway": "Split 200 g of protein into 4–5 feedings of ~40–50 g every 3–4 hours. A casein-rich snack before bed is optional.", "numbers": ["0.4–0.55 g/kg per meal ≈ 37–51 g", "4–5 feedings, 3–4 h apart", "Pre-sleep: ~25–40 g casein or Greek yogurt around 9 PM (optional)"], "tips": ["6 AM eggs and whites · 10 AM yogurt + whey · 1 PM chicken and rice · 6:15 PM sirloin and sweet potato · 9 PM yogurt (optional)", "Keep the pre-bed snack light"], "cites": [{"text": "Schoenfeld BJ, Aragon AA. Protein per meal for muscle-building. JISSN 2018", "url": "https://pubmed.ncbi.nlm.nih.gov/29497353/"}, {"text": "Areta JL et al. Timing and distribution of protein ingestion. J Physiol 2013", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3650697/"}, {"text": "Snijders T et al. Protein ingestion before sleep. J Nutr 2015", "url": "https://pubmed.ncbi.nlm.nih.gov/25926415/"}]}, {"id": "alcohol-sleep", "title": "Alcohol and sleep nutrition", "takeaway": "Alcohol costs you calories, recovery and sleep, so keep it occasional. For sleep: no caffeine after ~2 PM, dinner by ~8 PM, and a light evening snack.", "numbers": ["Each drink ≈ 100–150+ kcal", "Guideline: men ≤2 drinks/day; on a cut ≤2–4/week", "Heavy drinking after training cut muscle protein synthesis ~24% even with protein", "Caffeine cutoff ~2 PM (8 h before a 10 PM bedtime)", "Last drink ≥3 h before bed"], "tips": ["No alcohol on training nights", "Choose spirits with soda water or a light beer, and track it", "Finish the big meal by 7:30–8 PM", "Watch for hidden caffeine in pre-workout drinks, soda and chocolate"], "cites": [{"text": "Parr EB et al. Alcohol ingestion impairs post-exercise myofibrillar protein synthesis. PLoS One 2014", "url": "https://pubmed.ncbi.nlm.nih.gov/24533082/"}, {"text": "Colrain IM, Nicholas CL, Baker FC. Alcohol and the sleeping brain. Handb Clin Neurol 2014", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC4427543/"}, {"text": "Drake C et al. Caffeine effects on sleep taken 0, 3, or 6 hours before bed. J Clin Sleep Med 2013", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3805807/"}]}, {"id": "health-markers", "title": "Health markers — discuss with your doctor", "takeaway": "One fasting panel a year (ideally before and near the end of the cut) confirms the plan is helping your health. Discuss with your doctor.", "numbers": ["Lipids: at least every 4–6 years for adults ≥20 (AHA); yearly is reasonable while changing your diet", "HbA1c/glucose: USPSTF screening for ages 35–70 with overweight"], "tips": ["No hard training for 48 h before blood draws", "Fast for 8–12 h unless told otherwise", "Tell the lab you take creatine", "Test testosterone only if symptomatic, in the morning"], "cites": [{"text": "American Heart Association — How to get your cholesterol tested", "url": "https://www.heart.org/en/health-topics/cholesterol/how-to-get-your-cholesterol-tested"}, {"text": "USPSTF 2021 — Screening for prediabetes and type 2 diabetes", "url": "https://www.uspreventiveservicestaskforce.org/uspstf/sites/default/files/file/supporting_documents/prediabetes-t2dm-bulletin.pdf"}, {"text": "Bhasin S et al. Testosterone therapy in men with hypogonadism: Endocrine Society guideline. JCEM 2018", "url": "https://pubmed.ncbi.nlm.nih.gov/29562364/"}]}, {"id": "eating-out", "title": "Eating out and on the go", "takeaway": "Every chain on the list fits: protein first, sauces on the side, one starch, about 600–800 kcal and 40–60 g protein per meal.", "numbers": ["600–800 kcal per restaurant meal", "40–60 g protein per restaurant meal"], "tips": ["Chipotle: bowl, double chicken, half rice, fajita veg or beans, salsa, lettuce; cheese OR guac, no sour cream or queso", "Cava: half greens/half grains, double protein, one dip, dressing on the side, skip the pita chips", "Mendocino Farms: chicken-forward salad with dressing on the side, or half sandwich + salad", "In-N-Out: Double-Double Protein Style, mustard/ketchup instead of spread; two burgers for ~50 g protein; skip fries and shake", "Sweetgreen: double protein, one grain or none, half the dressing on the side, skip crispy toppings", "Zero-calorie drinks; bank calories earlier in the day"], "cites": [{"text": "FDA — Menu labeling requirements", "url": "https://www.fda.gov/food/food-labeling-nutrition/menu-labeling-requirements"}]}, {"id": "cut-safeguards", "title": "Cut-specific health safeguards", "takeaway": "Your plan is moderate and well built: 26% of calories from fat protects hormones and protein is high. Watch for signs the deficit is too big and adjust early.", "numbers": ["Fat floor: ≥20–25% of kcal and ≥0.5 g/kg (≈46 g); you're at 65 g ≈ 26% / 0.71 g/kg", "Rate of loss: ~0.5–1.0% body weight/week (≈1–2 lb)", "Optional diet break: 1 week at ~2,700–2,900 kcal around weeks 6–8", "If 2+ warning signs persist ~2 weeks: add 150–250 kcal (carbs first)"], "tips": ["Warning signs: persistent fatigue, falling strength, poor sleep, low libido, irritability, frequent illness, nagging injuries, always cold, dizziness", "Discuss persistent symptoms with your doctor"], "cites": [{"text": "Helms ER, Aragon AA, Fitschen PJ. Natural bodybuilding contest prep: nutrition. JISSN 2014", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/"}, {"text": "Peos JJ et al. A 1-week diet break improves muscle endurance (ICECAP). PLoS One 2021", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7906362/"}, {"text": "Mountjoy M et al. 2023 IOC consensus statement on REDs. Br J Sports Med 2023", "url": "https://pubmed.ncbi.nlm.nih.gov/37752011/"}]}], "supplements": [{"name": "Creatine monohydrate", "dose": "3–5 g/day", "timing": "Any time daily (e.g., in the post-workout shake); no loading needed", "evidence": "strong", "why": "Increases strength and lean mass alongside resistance training; helps keep performance up during a cut", "caution": "~1–2 lb of water weight at first; raises serum creatinine on labs; check with a doctor if you have kidney disease", "cites": [{"text": "Kreider RB et al. ISSN position stand: creatine. JISSN 2017", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC5469049/"}]}, {"name": "Whey protein", "dose": "25–40 g per serving, as needed to reach 200 g/day", "timing": "Post-workout (~6 PM) or as a snack between meals", "evidence": "strong", "why": "A convenient, complete, leucine-rich protein for hitting 2.2 g/kg; protein supports lean-mass gains and retention", "caution": "It's a food, not magic; total daily protein matters most; choose third-party-tested products", "cites": [{"text": "Morton RW et al. Br J Sports Med 2018", "url": "https://pubmed.ncbi.nlm.nih.gov/28698222/"}, {"text": "Schoenfeld BJ, Aragon AA. JISSN 2018", "url": "https://pubmed.ncbi.nlm.nih.gov/29497353/"}]}, {"name": "Caffeine", "dose": "Performance dose 3–6 mg/kg (~275 mg at 3 mg/kg); for you ≤100 mg pre-workout or none; ≤400 mg/day total", "timing": "Morning; cutoff ~2 PM because training is at 5 PM and bed at 10 PM", "evidence": "strong", "why": "Reliably improves strength, power and endurance performance", "caution": "400 mg taken 6 h before bed cut sleep by more than 1 h; poor sleep undermines a cut. Avoid with heart rhythm problems or anxiety, or if your doctor advises against it", "cites": [{"text": "Guest NS et al. ISSN position stand: caffeine. JISSN 2021", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7777221/"}, {"text": "Drake C et al. J Clin Sleep Med 2013", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3805807/"}, {"text": "FDA — How much caffeine is too much?", "url": "https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much"}]}, {"name": "Vitamin D3", "dose": "600–1,000 IU/day (up to 2,000 IU); never exceed 4,000 IU without a doctor", "timing": "With a meal containing fat", "evidence": "moderate", "why": "Fills a likely gap for an indoor desk worker; supports bone and muscle health", "caution": "The 2024 Endocrine Society guideline advises against routine testing and above-RDA dosing in healthy adults under 75; high doses can cause toxicity", "cites": [{"text": "Endocrine Society 2024 vitamin D guideline", "url": "https://www.endocrine.org/clinical-practice-guidelines/vitamin-d-for-prevention-of-disease"}, {"text": "NIH ODS — Vitamin D fact sheet", "url": "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/"}]}, {"name": "Omega-3 (EPA+DHA, fish or algae oil)", "dose": "~250–500 mg EPA+DHA/day", "timing": "With a meal", "evidence": "moderate", "why": "Your diet has no fish; the AHA recommends 1–2 seafood meals/week for heart health. Eating salmon twice a week is the first choice", "caution": "Talk to your doctor if you take blood thinners; higher doses can cause GI upset", "cites": [{"text": "AHA Science Advisory 2018 (Rimm et al.)", "url": "https://professional.heart.org/en/science-news/seafood-long-chain-n3-polyunsaturated-fatty-acids-and-cardiovascular-disease"}, {"text": "NIH ODS — Omega-3 fact sheet", "url": "https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/"}]}, {"name": "Basic multivitamin (optional)", "dose": "1 daily, ~100% of the daily value", "timing": "With breakfast", "evidence": "weak", "why": "Cheap insurance while eating less; doesn't prevent heart disease or cancer", "caution": "Avoid high-dose iron, beta-carotene and vitamin E; count it toward vitamin D and zinc totals", "cites": [{"text": "USPSTF 2022, JAMA", "url": "https://pubmed.ncbi.nlm.nih.gov/35727271/"}, {"text": "NIH ODS — Multivitamin/mineral fact sheet", "url": "https://ods.od.nih.gov/factsheets/MVMS-HealthProfessional/"}]}], "avoid": [{"name": "Fat burners / thermogenics", "why": "Little or no meaningful fat loss beyond caffeine's effect, and weight-loss 'supplements' are frequently found spiked with undeclared drugs", "cite": {"text": "Jeukendrup AE, Randell R. Fat burners. Obes Rev 2011", "url": "https://pubmed.ncbi.nlm.nih.gov/21951331/"}}, {"name": "BCAAs (when protein is adequate)", "why": "200 g/day of complete protein already supplies plenty of BCAAs; BCAAs alone can't sustain muscle protein synthesis", "cite": {"text": "Wolfe RR. BCAAs and muscle protein synthesis: myth or reality? JISSN 2017", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC5568273/"}}, {"name": "Testosterone boosters", "why": "Most ingredients lack evidence for raising testosterone; if you have symptoms, get morning bloodwork instead", "cite": {"text": "'Testosterone Boosting' supplements composition and claims are not supported by the academic literature. World J Mens Health 2020", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6920068/"}}, {"name": "Uncertified supplements in general", "why": "Supplements aren't FDA-approved before sale; the FDA keeps a database of tainted products. Buy NSF Certified for Sport or Informed Sport", "cite": {"text": "FDA Health Fraud Product Database", "url": "https://www.fda.gov/consumers/health-fraud-scams/health-fraud-product-database"}}, {"name": "Iron supplements (without a blood test showing you need them)", "why": "Men's needs (8 mg) are easily met by food; excess iron accumulates", "cite": {"text": "NIH ODS — Iron", "url": "https://ods.od.nih.gov/factsheets/Iron-Consumer/"}}], "bloodwork": [{"test": "Lipid panel (total cholesterol, LDL, HDL, triglycerides; ± ApoB)", "why": "Cardiovascular risk; fat loss and more fiber usually improve it"}, {"test": "HbA1c and fasting glucose", "why": "Diabetes and prediabetes screening; tracks the metabolic benefit of the cut"}, {"test": "CMP (comprehensive metabolic panel)", "why": "Kidney (creatinine/eGFR, which creatine raises slightly), liver enzymes, electrolytes"}, {"test": "CBC (complete blood count)", "why": "Anemia and general health screen"}, {"test": "Ferritin (± iron panel)", "why": "Confirms iron stores before anyone recommends iron; flags overload"}, {"test": "25(OH)D vitamin D (optional)", "why": "Not routine for healthy adults per the 2024 Endocrine Society guideline; ask if you have risk factors"}, {"test": "TSH", "why": "Thyroid screen if energy, weight or temperature tolerance seem off"}, {"test": "Total testosterone (morning, fasting) — only if symptomatic", "why": "Low libido, fatigue or low mood during an aggressive cut; confirm low results with a repeat test"}], "hydration": {"dailyOz": 100, "trainingExtraOz": 24, "schedule": [{"time": "5:30 AM", "oz": 16, "note": "Right after waking"}, {"time": "7:30 AM–12 PM", "oz": 32, "note": "One 32-oz desk bottle"}, {"time": "12–4:30 PM", "oz": 24, "note": "Second bottle"}, {"time": "4:30 PM", "oz": 8, "note": "Pre-workout; add a pinch of salt if it's hot"}, {"time": "5–6 PM (training)", "oz": 20, "note": "Sip every 10–15 min"}, {"time": "6–8 PM", "oz": 16, "note": "With dinner; finish rehydrating"}, {"time": "After 8 PM", "oz": 8, "note": "Small sips only, to protect sleep"}]}};
const FUEL_SEC=id=>FUEL_DATA.sections.find(s=>s.id===id)||{numbers:[],tips:[],cites:[]};
const fuLink=c=>c&&/^https:\/\//.test(c.url)?`<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.text)}</a>`:esc(c&&c.text||"");
function fuTargets(k){
  if(typeof targetsFor==="function"){try{const t=targetsFor(k);if(t&&t.cal)return t;}catch(e){}}
  const s=ST();return {cal:s.cal,p:s.p,c:s.c,f:s.f,water:s.water,steps:s.steps};
}
const fuFiber=cal=>Math.max(32,Math.round(cal*14/1000));
/* training block for a date: {start,end} in minutes, or null */
function fuTrain(k){
  let rows=[];try{rows=timeline(k)||[];}catch(e){}
  const tr=rows.filter(r=>["lift","intervals"].includes(r.id)&&r.t!=null);
  if(!tr.length)return null;
  const start=Math.min(...tr.map(r=>r.t)), endRow=rows.filter(r=>["lift","intervals"].includes(r.id)).map(r=>r.end||r.t+(r.dur||45));
  return {start,end:Math.max(start+45,...endRow)};
}
function fuWake(k){const pl=planFor(k),st=ST(),wk=pl.dow===0||pl.dow===6;return toMin(wk?(st.weekendWake||"06:30"):(st.wake||"05:30"));}
function fuBed(k){const st=ST();let b=toMin(st.bed||"22:00");if(b<=fuWake(k))b+=1440;return b;}
function fuCaffeine(k){
  let rows=[];try{rows=timeline(k)||[];}catch(e){}
  const r=rows.find(x=>x.id==="caffeine");if(r)return r.t;
  const cut=typeof CAFFEINE_CUTOFF==="string"?toMin(CAFFEINE_CUTOFF):14*60;return Math.min(cut,fuBed(k)-480);
}
/* hydration plan from the research schedule, moved to this day's wake / training / bed times and scaled to the target */
function fuHydration(k){
  const tg=fuTargets(k), W=fuWake(k), B=fuBed(k), T=fuTrain(k), noon=12*60, eve=20*60;
  const rows=[{a:W,b:W+15,oz:16,t:"Right after waking",note:"You've gone about 7½ hours without fluid."}];
  if(T){rows.push({a:T.start-30,b:T.start,oz:8,t:"Before training",note:"Add a pinch of salt if it's hot."});
        rows.push({a:T.start,b:T.end,oz:20,t:"During training",note:"Sip every 10–15 minutes."});}
  const wd=planFor(k).dow%6!==0, ws=toMin(ST().workStart||"07:30");
  const amA=T&&T.start<noon?T.end:wd&&ws!=null?Math.max(W+60,ws):W+60;
  rows.push({a:amA,b:noon,oz:32,t:planFor(k).dow%6===0?"Late morning":"Desk bottle #1",note:"One 32-oz bottle by noon."});
  const pmB=T&&T.start>=noon?T.start-30:17*60;
  rows.push({a:noon,b:pmB,oz:24,t:planFor(k).dow%6===0?"Afternoon":"Desk bottle #2",note:`Finish it by ${fmt12(pmB)}.`});
  const dA=T&&T.start>=noon?T.end:18*60;
  rows.push({a:dA,b:eve,oz:16,t:"With dinner",note:"Finish rehydrating before 8 PM."});
  rows.push({a:eve,b:B,oz:8,t:"After 8 PM",note:"Small sips only, to protect sleep.",cap:true});
  rows.sort((x,y)=>x.a-y.a);
  const base=rows.reduce((s,r)=>s+r.oz,0), f=tg.water/base;
  rows.forEach(r=>{if(!r.cap)r.oz=Math.max(4,Math.round(r.oz*f/4)*4);});
  const diff=tg.water-rows.reduce((s,r)=>s+r.oz,0), big=rows.filter(r=>!r.cap).sort((x,y)=>y.oz-x.oz)[0];if(big)big.oz+=diff;
  let cum=0;rows.forEach(r=>{cum+=r.oz;r.cum=cum;});
  return rows;
}
const fuNow=()=>{const d=new Date();return d.getHours()*60+d.getMinutes();};
function fuMeter(label,val,tgt,unit,opts){
  opts=opts||{};const v=val==null?0:+val, p=tgt?Math.min(100,Math.round(v/tgt*100)):0;
  const left=Math.max(0,tgt-v), over=v-tgt;
  const st=opts.range?(val==null?"":Math.abs(over)<=opts.range?"hit":over<-opts.range?"":"over"):(v>=tgt?"hit":"");
  return `<div class="fu-m ${st}"><div class="fu-mh"><span class="k">${label}</span><span class="v num">${val==null?"—":Math.round(v).toLocaleString()}<small> / ${Math.round(tgt).toLocaleString()}${unit}</small></span></div>
    <div class="fu-bar" role="img" aria-label="${label}: ${val==null?"nothing logged":Math.round(v)+" of "+Math.round(tgt)+unit}"><i style="width:${p}%"></i></div>
    <div class="fu-ms">${val==null?"Not logged yet":st==="hit"?(opts.range?"In range":"Target reached"):st==="over"?`${Math.round(over).toLocaleString()}${unit} over`:`${Math.round(left).toLocaleString()}${unit} to go`}</div></div>`;
}
function fuTodayCard(k){
  const tg=fuTargets(k), d=getDay(k), pl=planFor(k), now=fuNow(), hy=fuHydration(k);
  let fib=null;try{fib=Math.round(buildMeals(tg).total.fib);}catch(e){}
  const w=d.water==null?0:+d.water, left=Math.max(0,tg.water-w), pct=Math.min(100,Math.round(w/tg.water*100));
  const due=k===todayKey()?(hy.filter(r=>r.b<=now).pop()||{cum:0}).cum:null;
  const pace=due==null?"":w>=tg.water?"Done for today.":due&&w<due-8?`Behind: aim for ${due} oz by now.`:due?`On track (aim ${due} oz by now).`:"";
  return `<section class="card fu-today" id="fu-today"><div class="card-h"><h2>Today's fuel</h2><span class="sub">${esc(nice(k))}${pl.trainDay?" · training day":" · rest day"}${tg.dietBreak?" · diet break":""}</span></div>
    <div class="card-b">
    <div class="fu-water">
      <div class="fu-wl"><span class="eyebrow">Water left today</span><b class="num" data-fu-left>${left}<small> oz</small></b>
        <span class="muted">${w} of ${tg.water} oz${pl.trainDay&&typeof TRAIN_DAY_WATER==="number"?` (${tg.water-TRAIN_DAY_WATER} + ${TRAIN_DAY_WATER} for training)`:""}. ${esc(pace)}</span></div>
      <div class="fu-wbar" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <div class="fu-wbtn"><button class="btn" data-act="fuelwater" data-v="16">+16 oz</button><button class="btn" data-act="fuelwater" data-v="24">+24 oz</button></div>
    </div>
    <div class="fu-meters">
      ${fuMeter("Calories",d.cal,tg.cal," kcal",{range:150})}
      ${fuMeter("Protein",d.protein,tg.p," g")}
    </div>
    <div class="fu-macros">
      <div><span>Carbs</span><b>${tg.c} g</b></div><div><span>Fat</span><b>${tg.f} g</b></div>
      <div><span>Fiber</span><b>≥${fuFiber(tg.cal)} g</b>${fib!=null?`<small>${fib>=fuFiber(tg.cal)?`plan ≈${fib} g`:`plan ≈${fib} g · add ½ cup beans`}</small>`:""}</div>
      <div><span>Protein / meal</span><b>40–50 g</b><small>4–5 meals</small></div>
    </div>
    <details class="fu-hy"><summary><span><b>Hydration plan</b><span class="muted"> · ${hy.length} checkpoints, ${tg.water} oz</span></span></summary>
      <ol class="fu-hyl">${hy.map(r=>{const st=k===todayKey()?(now>=r.b?"past":now>=r.a?"now":""):"";
        return `<li class="${st}"><span class="tm">${fmt12(r.a)}</span><div><b>${r.cap?"≤":""}${r.oz} oz · ${esc(r.t)}</b><span>${esc(r.note)}</span></div><span class="cum num">${r.cum} oz</span></li>`;}).join("")}</ol>
      <p class="note">Pale-straw urine through the day is the target. Weigh before and after a sweaty session: each 1 lb lost ≈ 16 oz to replace.</p></details>
    </div></section>`;
}
function fuMealRows(k){let rows=[];try{rows=(timeline(k)||[]).filter(r=>r.kind==="meal"&&r.meal);}catch(e){}return rows;}
const fuMealName=r=>String(r.title).replace(/,.*$/,"").replace(/ \(.*\)$/,"");
const fuBrief=it=>it.items.filter(i=>i.k).map(i=>`${i.qty} ${String(i.label).split(" (")[0].split(",")[0].toLowerCase()}`).join(", ");
function fuMealsCard(k){
  const rows=fuMealRows(k); if(!rows.length)return "";
  const tg=fuTargets(k), now=fuNow();
  const tot=rows.reduce((a,r)=>{const t=r.meal.tot||{};return {k:a.k+(t.k||0),p:a.p+(t.p||0),c:a.c+(t.c||0),f:a.f+(t.f||0),fib:a.fib+(t.fib||0)};},{k:0,p:0,c:0,f:0,fib:0});
  const next=rows.find(r=>r.t>=now-15);
  return `<section class="card" id="fu-meals"><div class="card-h"><h2>Meals</h2><span class="sub">${esc(DOWL[planFor(k).dow])}</span></div><div class="card-b">
    ${next?`<div class="fu-next"><span class="eyebrow">Next meal · ${fmt12(next.t)}</span><b>${esc(fuMealName(next))}</b><p>${esc(fuBrief(next.meal))}</p><span class="num muted">${Math.round(next.meal.tot.k)} kcal · ${Math.round(next.meal.tot.p)} g protein</span></div>`
      :`<div class="fu-next"><span class="eyebrow">Today</span><b>All meals done</b><p>Tomorrow starts with breakfast at ${fmt12((fuMealRows(addDays(k,1))[0]||{t:fuWake(addDays(k,1))+15}).t)}.</p></div>`}
    <ul class="fu-mini">${rows.map(r=>`<li class="${next&&r===next?"on":r.t<now-15?"past":""}"><span class="tm">${fmt12(r.t)}</span><span>${esc(fuMealName(r))}</span><span class="num">${Math.round(r.meal.tot.k)}</span></li>`).join("")}</ul>
    <div class="fu-mt"><span>Day total</span><b class="num">${Math.round(tot.k).toLocaleString()} kcal</b><span class="num">${Math.round(tot.p)} P · ${Math.round(tot.c)} C · ${Math.round(tot.f)} F · ${Math.round(tot.fib)} g fiber</span></div>
    <div><button class="btn sec" data-act="tab" data-v="plan" data-scroll="meals">Full meal table in Plan</button></div>
    <p class="note">Portions scale to today's ${tg.cal.toLocaleString()} kcal target. Weigh cooked food for the first 2 weeks.</p></div></section>`;
}
function fuShake(){const k=todayKey();const pick=d=>fuMealRows(d).find(r=>r.id==="shake");let r=pick(k);if(!r||!/pre/i.test(r.title)){for(let i=1;i<7&&!(r&&/pre/i.test(r.title));i++)r=pick(addDays(k,i));}return r;}
function fuSuppTiming(s){
  const sh=fuShake(), when=sh?`the ${fmt12(sh.t)} ${/pre/i.test(sh.title)?"pre-workout ":""}shake`:"the shake";
  if(/^Creatine/i.test(s.name))return `Every day, in ${when} (or any meal); no loading needed`;
  if(/^Whey/i.test(s.name))return `In ${when}, or as a snack between meals`;
  return s.timing;
}
function fuSuppCard(){
  const ev={strong:["good","Strong evidence"],moderate:["acc","Moderate evidence"],weak:["","Weak evidence"]};
  return `<section class="card" id="fu-supps"><div class="card-h"><h2>Supplements</h2><span class="sub">Only what earns its place</span></div><div class="card-b">
    <div class="fu-sg">${FUEL_DATA.supplements.map(s=>{const e=ev[s.evidence]||["",s.evidence];return `<article class="fu-s"><div class="fu-sh"><h3>${esc(s.name)}</h3><span class="badge ${e[0]}">${e[1]}</span></div>
      <dl><dt>Dose</dt><dd>${esc(s.dose)}</dd><dt>When</dt><dd>${esc(fuSuppTiming(s))}</dd></dl>
      <p>${esc(s.why)}.</p>${s.caution?`<p class="fu-c"><b>Caution:</b> ${esc(s.caution)}.</p>`:""}</article>`;}).join("")}</div>
    <h3 class="fu-sub">Skip these</h3>
    <ul class="fu-skip">${FUEL_DATA.avoid.map(a=>`<li><b>${esc(a.name)}</b><span>${esc(a.why)}.</span></li>`).join("")}</ul>
    <div class="callout"><div><b>Buy third-party tested:</b> NSF Certified for Sport or Informed Sport. Supplements aren't approved by the FDA before sale. <b>On medication</b> or with kidney, liver, heart or blood-pressure issues? Check with your doctor or pharmacist first.</div></div>
  </div></section>`;
}
function fuMicroCard(k){
  const rows=[
    ["Sodium","Steady day to day; ~2,300–3,000 mg on training days if blood pressure is normal","¼ tsp salt in the shake, turkey bacon, sourdough, beans. Season the same way every day; one salty restaurant meal can add 2–4 lb of water."],
    ["Potassium","3,400 mg","Sweet potato (~450 mg), banana (~420 mg), Greek yogurt (~350 mg), black beans, sirloin or chicken, spinach."],
    ["Magnesium","400–420 mg","Spinach, black beans, oats. Add pumpkin seeds (~150 mg/oz) or almonds. Supplement cap 350 mg."],
    ["Vitamin D","600–1,000 IU (up to 2,000)","Eggs. A D3 supplement with a meal that has fat covers the desk-job gap. Never over 4,000 IU without a doctor."],
    ["Omega-3","Salmon 2× a week, or 250–500 mg EPA+DHA","Swap one sirloin dinner for 3.5–6 oz salmon twice a week (skip the oil that day)."],
    ["Calcium","1,000 mg","Greek yogurt daily (~200–250 mg), whey, leafy greens."],
    ["Fiber & gut",`${fuFiber(fuTargets(k).cal)}–38 g, ~30 plants a week, a fermented food daily`,"4 cups of vegetables (1 at breakfast, 2 at dinner), black beans at lunch, berries, oats, sweet potato. Add kefir, kimchi or sauerkraut next to the yogurt."],
    ["Iron, B12, zinc","Covered by food","Eggs, beef and chicken. Don't take iron without a blood test showing you need it."]];
  return `<section class="card" id="fu-micro"><div class="card-h"><h2>Micronutrients &amp; electrolytes</h2></div>
    <ul class="fu-nl">${rows.map(([n,t,s])=>`<li><div class="fu-nn"><b>${n}</b><span>${esc(t)}</span></div><p>${esc(s)}</p></li>`).join("")}</ul></section>`;
}
function fuCaffeineCard(k){
  const caf=fuCaffeine(k), B=fuBed(k), mon=mondayOf(k);
  const days=Array.from({length:7},(_,i)=>addDays(mon,i)).map(d=>({d,T:fuTrain(d)})).filter(x=>x.T);
  const after=days.filter(x=>x.T.start>caf), before=days.filter(x=>x.T.start<=caf);
  const lbl=a=>[...new Set(a.map(x=>DOWN[planFor(x.d).dow]))].join(", ");
  const tT=fuTrain(k);
  const items=[
    ["Caffeine cutoff",`Last caffeine ${fmt12(caf)}`,`At least 8 hours before your ${fmt12(B)} bedtime. 400 mg taken 6 hours before bed cut sleep by over an hour.`]];
  if(after.length)items.push(["Pre-workout after the cutoff",`Stim-free only`,`${lbl(after)} sessions start at ${fmt12(after[0].T.start)}, after the cutoff. The research dose is ~60 min before training, but sleep wins; lifting and intervals go fine without it.`]);
  if(before.length)items.push(["Morning sessions",`Normal coffee is fine`,`${lbl(before)} at ${fmt12(before[0].T.start)} is before the cutoff: 3 mg/kg (~275 mg) about 60 min before helps performance.`]);
  if(tT)items[0][2]+=` Today you train at ${fmt12(tT.start)}${tT.start>caf?", after the cutoff.":", before the cutoff."}`;
  items.push(["Daily cap","≤400 mg","Count coffee, soda, pre-workout and dark chocolate."],
    ["Dinner","Big meal by ~8 PM","A large, high-fat meal near bed means reflux and lighter sleep. A small yogurt or casein snack is fine."],
    ["Alcohol","≤2–4 drinks a week on a cut","100–150+ kcal each. None on training nights; last drink at least 3 hours before bed. Heavy drinking after training cut muscle building ~24%."]);
  return `<section class="card" id="fu-sleep"><div class="card-h"><h2>Caffeine &amp; sleep</h2><span class="sub">Sleep 7.5–8.5 h in bed</span></div>
    <ul class="fu-kv">${items.map(([a,b,c])=>`<li><span class="k">${a}</span><b>${esc(b)}</b><p>${esc(c)}</p></li>`).join("")}</ul></section>`;
}
function fuEatOutCard(){
  const s=FUEL_SEC("eating-out");
  const chains=s.tips.filter(t=>/^[A-Z][\w-]*( [A-Z][\w-]*)*:/.test(t)).map(t=>{const i=t.indexOf(":");const r=t.slice(i+1).trim();return [t.slice(0,i),r.charAt(0).toUpperCase()+r.slice(1)];});
  const rules=["Protein first: double meat beats extra rice or chips","One starch: rice OR tortilla OR pita OR chips","Sauces and dressings on the side","Load free volume: lettuce, fajita veg, salsa","Zero-calorie drinks","Eating out tonight? Keep breakfast and lunch lean"];
  return `<section class="card" id="fu-out"><div class="card-h"><h2>Eating out in Irvine</h2><span class="sub">600–800 kcal · 40–60 g protein</span></div><div class="card-b">
    <ol class="fu-rules">${rules.map(r=>`<li>${esc(r)}</li>`).join("")}</ol>
    <div class="fu-chains">${chains.map(([n,t])=>`<div class="fu-ch"><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join("")}</div>
    <p class="note">On the go: a 30 g+ protein shake and fruit, a Greek yogurt cup, jerky and string cheese, or a grocery rotisserie chicken. Chains with 20+ locations post calories; check before you order.</p></div></section>`;
}
function fuSafeCard(k){
  const tg=fuTargets(k), st=ST();
  const lastW=Object.keys(S.days).filter(x=>x<=todayKey()&&S.days[x].weight>0).sort().pop();
  const lb=lastW?+S.days[lastW].weight:(st.startWeight||200), kg=lb/2.2046;
  const fatPct=Math.round(tg.f*9/tg.cal*100), gkg=(tg.f/kg).toFixed(2), floor=Math.round(.5*kg);
  const ok=fatPct>=20&&tg.f>=floor;
  const db=addDays(st.start,42);
  const signs=["Persistent fatigue","Strength falling 2+ weeks","Poor sleep","Low libido","Irritable or low mood","Getting sick often","Nagging injuries","Always cold","Dizziness"];
  return `<section class="card" id="fu-safe"><div class="card-h"><h2>Cut safeguards</h2></div><div class="card-b">
    <div class="fu-stats">
      <div class="${ok?"ok":"warn"}"><span class="k">Fat</span><b class="num">${tg.f} g</b><span>${fatPct}% of kcal · ${gkg} g/kg. Floor: ≥20–25% and ≥${floor} g.</span></div>
      <div><span class="k">Rate of loss</span><b class="num">0.5–1%</b><span>of body weight a week (~${(lb*.005).toFixed(1)}–${(lb*.01).toFixed(1)} lb at ${Math.round(lb)} lb).</span></div>
      <div><span class="k">Diet break</span><b class="num">Week 7</b><span>${short(db)} – ${short(addDays(db,6))} at maintenance, extra carbs.</span></div>
    </div>
    <h3 class="fu-sub">Signs you're under-eating</h3>
    <ul class="fu-chips">${signs.map(s=>`<li>${s}</li>`).join("")}</ul>
    <p>If <b>2 or more persist for about 2 weeks</b>, add 150–250 kcal (carbs first) or take the diet break early. Talk to your doctor about symptoms that persist.</p></div></section>`;
}
function fuBloodCard(){
  return `<section class="card" id="fu-blood"><div class="card-h"><h2>Bloodwork to discuss with your doctor</h2></div><div class="card-b">
    <p class="muted">One fasting panel a year, ideally before the cut and again near the end. Your doctor decides what's right for you.</p>
    <ul class="fu-bl">${FUEL_DATA.bloodwork.map(b=>`<li><b>${esc(b.test)}</b><span>${esc(b.why)}.</span></li>`).join("")}</ul>
    <div class="callout warn"><div><b>Before the draw:</b> no hard training for 48 hours (heavy lifting raises CK and liver enzymes for a while), and tell the lab and your doctor you take creatine; it raises creatinine slightly.</div></div></div></section>`;
}
function fuSources(){
  const seen=new Set(), groups=[];
  const add=(title,cites)=>{const c=(cites||[]).filter(x=>x&&x.url&&!seen.has(x.url)&&seen.add(x.url));if(c.length)groups.push([title,c]);};
  FUEL_DATA.sections.forEach(s=>add(s.title,s.cites));
  add("Supplements",FUEL_DATA.supplements.flatMap(s=>s.cites||[]));
  add("Skip these",FUEL_DATA.avoid.map(a=>a.cite));
  return `<section class="card" id="fu-sources"><div class="card-h"><h2>Sources</h2><span class="sub">${seen.size} references</span></div><div class="card-b fu-src">
    ${groups.map(([t,c])=>`<h3 class="fu-sub">${esc(t)}</h3><ol class="cites fu-cites">${c.map(x=>`<li>${fuLink(x)}</li>`).join("")}</ol>`).join("")}
    <p class="note">General education for a healthy adult, not individual medical advice.</p></div></section>`;
}
function fuRulesCard(k){
  const tg=fuTargets(k), caf=fuCaffeine(k), sh=fuShake();
  const rest=typeof TRAIN_DAY_WATER==="number"&&planFor(k).trainDay?tg.water-TRAIN_DAY_WATER:null;
  const rules=[
    ["Water",`${tg.water} oz today${rest!=null?` (${rest} + ${TRAIN_DAY_WATER} for training)`:""}; most of it before dinner, sips only after 8 PM.`],
    ["Protein",`${tg.p} g over 4–5 meals of 40–50 g.`],
    ["Caffeine",`Last caffeine ${fmt12(caf)}. Pre-workout after that: stim-free only.`],
    ["Creatine",`5 g every day${sh?`, in the ${fmt12(sh.t)} shake`:""}.`],
    ["Sodium","Steady day to day, ~2,300–3,000 mg on training days."],
    ["Fiber",`At least ${fuFiber(tg.cal)} g: 4 cups of vegetables, beans, berries.`],
    ["Alcohol","Rare: ≤2–4 drinks a week, never on training nights."]];
  return `<section class="card" id="fu-rules"><div class="card-h"><h2>Key rules</h2></div><ul class="fu-kr">${rules.map(([a,b])=>`<li><b>${a}</b><span>${esc(b)}</span></li>`).join("")}</ul></section>`;
}
const FU_TABS=[["overview","Overview"],["meals","Meals"],["supps","Supplements"],["micro","Micros"],["sleep","Caffeine & sleep"],["out","Eating out"],["safe","Safeguards"],["blood","Bloodwork"],["sources","Sources"]];
const FU_LS="leanloken.fuelTab";
function fuTab(){let v=null;try{v=localStorage.getItem(FU_LS);}catch(e){}return FU_TABS.some(x=>x[0]===v)?v:"overview";}
function renderFuel(){
  const k=todayKey(), pl=planFor(k), tab=fuTab();
  const body={overview:()=>fuTodayCard(k)+fuRulesCard(k),meals:()=>fuMealsCard(k),supps:fuSuppCard,micro:()=>fuMicroCard(k),sleep:()=>fuCaffeineCard(k),out:fuEatOutCard,safe:()=>fuSafeCard(k),blood:fuBloodCard,sources:fuSources}[tab];
  return `<div class="phead"><div class="t"><div class="eyebrow">Nutrition &amp; health${pl.pre?` · program starts ${esc(short(ST().start))}`:""}</div><h1>Fuel</h1></div></div>
    <nav class="fu-nav" aria-label="Fuel sections">${FU_TABS.map(([id,t])=>`<button data-act="fuelsec" data-v="${id}" aria-pressed="${id===tab}" class="${id===tab?"on":""}">${esc(t)}</button>`).join("")}</nav>
    <div class="fu-body" data-fu-tab="${tab}">${body()}</div>`;
}
ACTIONS.fuelwater=el=>{
  const k=todayKey(), n=+el.dataset.v; if(!(n>0))return;
  const d=ensureDay(k), before=d.water;
  d.water=Math.min(400,(+d.water||0)+n); saveDay(k); rerenderKeepScroll();
  toast(`+${n} oz water · ${d.water} oz today`,()=>{d.water=before;saveDay(k);rerenderKeepScroll();});
};
ACTIONS.fuelsec=el=>{const v=el.dataset.v;if(!FU_TABS.some(x=>x[0]===v))return;try{localStorage.setItem(FU_LS,v);}catch(e){}render();
  const n=document.querySelector(".fu-nav");if(n){const b=n.querySelector(`[data-v="${v}"]`);if(b&&b.scrollIntoView)b.scrollIntoView({block:"nearest",inline:"center"});const top=n.getBoundingClientRect().top+scrollY-70;if(scrollY>top)scrollTo(0,Math.max(0,top));}};
