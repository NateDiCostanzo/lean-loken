/* =========================================================
   NUTRITION ENGINE — portions scale to any {cal,p,c,f} target
   ========================================================= */
const F={ // per unit: kcal, P, C, F, fiber (g)
  egg:{u:"egg",k:72,p:6.3,c:.4,f:4.8,fib:0},
  ewhite:{u:"½ cup",k:63,p:13,c:1,f:0,fib:0},
  tbacon:{u:"slice",k:35,p:3,c:.3,f:2.5,fib:0},
  sour:{u:"45 g slice",k:120,p:4,c:23,f:1,fib:1},
  chicken:{u:"oz",k:47,p:8.8,c:0,f:1.0,fib:0},
  rice:{u:"g",k:1.30,p:.027,c:.282,f:.003,fib:.004},
  veg:{u:"cup",k:50,p:3,c:10,f:0,fib:4},
  whey:{u:"scoop",k:120,p:24,c:3,f:1.5,fib:0},
  banana:{u:"medium",k:105,p:1.3,c:27,f:.4,fib:3.1},
  sirloin:{u:"oz",k:58,p:8.6,c:0,f:2.4,fib:0},
  spot:{u:"g",k:.90,p:.02,c:.207,f:.002,fib:.033},
  yog:{u:"cup",k:130,p:23,c:9,f:0,fib:0},
  berry:{u:"cup",k:80,p:1,c:20,f:.4,fib:3.6},
  beans:{u:"½ cup",k:110,p:7,c:20,f:.5,fib:7.5},
  oil:{u:"tsp",k:40,p:0,c:0,f:4.5,fib:0},
  oats:{u:"g",k:3.79,p:.132,c:.677,f:.065,fib:.10}
};
const MEAL_IDS=["breakfast","msnack","lunch","shake","dinner"];
const MEAL_NAMES={breakfast:"Breakfast",msnack:"Greek yogurt snack",lunch:"Lunch",shake:"Shake",dinner:"Dinner"};
/* Fixed foods per day (vegetables 3 cups: 1 at each main meal; berries 1 cup). */
const FIXED={beans:1,egg:3,ewhite:1,tbacon:3,sour:1,veg:4,whey:1.5,banana:1,yog:1,berry:1};
const OATS_OVER=200, OATS_SHARE=.25;      // carbs left > 200 g → 25% of them become oats
const DINNER_CARB_SHARE=.65;              // dinner is the largest carb meal
const OIL_MAX=16;

function line(id,q,label,qty){const x=F[id];return {label,qty,k:x.k*q,p:x.p*q,c:x.c*q,f:x.f*q,fib:x.fib*q};}
const zeroLine=(label,qty)=>({label,qty,k:0,p:0,c:0,f:0,fib:0});
const r5=(v,s)=>Math.round(v/s)*s;
function sum(ls){return ls.reduce((a,l)=>({k:a.k+(+l.k||0),p:a.p+(+l.p||0),c:a.c+(+l.c||0),f:a.f+(+l.f||0),fib:a.fib+(+l.fib||0)}),{k:0,p:0,c:0,f:0,fib:0});}
const fr=q=>({.25:"¼",.5:"½",.75:"¾",1:"1",1.5:"1½"}[q]||String(q));
/* grams → "≈1½ cup" using grams-per-cup */
const cupsOf=(g,per)=>{const c=Math.round(g/per*4)/4;return c<.25?"under ¼ cup":`≈${c>=1?Math.floor(c)+(c%1?fr(c%1):""):fr(c)} cup`;};
const riceCups=g=>cupsOf(g,158);

/* t = {cal,p,c,f}. Returns {meals:{breakfast,msnack,lunch,shake,dinner}, total, ...portions}. */
function buildMeals(t){
  t=t||{};
  const cal=+t.cal||DEFAULTS.cal, P=+t.p||DEFAULTS.p;
  // optional fixed foods are dropped when they don't fit: sourdough when carb room is small (its carbs go to
  // potato, which has more fiber); egg whites, then turkey bacon, when protein or calories would overshoot
  const use=Object.assign({},FIXED);let fx;
  const refx=()=>{fx=sum(Object.entries(use).map(([id,q])=>line(id,q,"","")));};refx();
  const C0=+t.c||DEFAULTS.c;
  if(C0-fx.c<30){delete use.sour;refx();}
  // portions for a given carb target: oats at breakfast when a lot is left, then potato (dinner) + rice (lunch);
  // protein from chicken (lunch) + sirloin (dinner), split evenly, ½ oz steps, min 2 oz
  let lean=false;                          // lean dinner protein when calories are tight
  const portions=C=>{const dm=lean?F.chicken:F.sirloin;
    let cRem=Math.max(0,C-fx.c), oatsG=0;
    if(cRem>OATS_OVER){oatsG=r5(cRem*OATS_SHARE/F.oats.c,5);cRem-=oatsG*F.oats.c;}
    const potG=Math.max(0,r5(cRem*(cRem<30?1:DINNER_CARB_SHARE)/F.spot.c,10));   // little carb room: all of it to potato (more fiber)
    const riceG=Math.max(0,r5((cRem-potG*F.spot.c)/F.rice.c,10));
    const carbP=riceG*F.rice.p+potG*F.spot.p+oatsG*F.oats.p;
    const pRem=Math.max(0,P-fx.p-carbP);
    const chOz=Math.max(2,r5(pRem*.5/F.chicken.p,.5));
    const siOz=Math.max(2,r5((pRem-chOz*F.chicken.p)/dm.p,.5));
    const k=fx.k+riceG*F.rice.k+potG*F.spot.k+oatsG*F.oats.k+chOz*F.chicken.k+siOz*dm.k;
    return {C,oatsG,potG,riceG,chOz,siOz,k};
  };
  // calories come first: olive oil closes the gap (equals the fat target when macros add up);
  // if even zero oil overshoots, carbs shrink; if the oil cap can't fill it, carbs grow
  const protOf=q=>fx.p+q.riceG*F.rice.p+q.potG*F.spot.p+q.oatsG*F.oats.p+q.chOz*F.chicken.p+q.siOz*(lean?F.chicken:F.sirloin).p;
  let C=Math.max(fx.c,C0), pt=portions(C);
  for(const id of ["ewhite","tbacon"])if(protOf(pt)>P+6&&use[id]){delete use[id];refx();C=Math.max(fx.c,C0);pt=portions(C);}
  for(let i=0;i<8;i++){
    const gap=cal-pt.k;
    if(gap<-20&&C>fx.c){C=Math.max(fx.c,C+gap/4);pt=portions(C);}
    else if(gap<-20&&!lean){lean=true;pt=portions(C);}
    else if(gap<-20&&(use.tbacon||use.sour)){delete use[use.tbacon?"tbacon":"sour"];refx();pt=portions(C);}
    else if(gap>OIL_MAX*F.oil.k+20){C+=(gap-OIL_MAX*F.oil.k)/4;pt=portions(C);}
    else break;
  }
  const {oatsG,potG,riceG,chOz,siOz}=pt;
  const oil=Math.min(OIL_MAX,Math.max(0,Math.round((cal-pt.k)/F.oil.k)));
  const oilB=oil>8?oil-8:0, oilL=Math.ceil((oil-oilB)/2), oilD=oil-oilB-oilL;
  const oilLine=n=>n?[line("oil",n,"Olive oil (cooking)",`${n} tsp`)]:[];
  const meals={
    breakfast:{name:MEAL_NAMES.breakfast,items:[
      line("egg",3,"Whole eggs","3")].concat(
      use.ewhite?[line("ewhite",1,"Liquid egg whites","½ cup")]:[],
      [line("veg",1,"Spinach or peppers (cooked with the eggs)","1 cup")],
      use.tbacon?[line("tbacon",3,"Turkey bacon","3 slices")]:[],
      use.sour?[line("sour",1,"Sourdough toast","1 slice (45 g)")]:[])
      .concat(oatsG?[line("oats",oatsG,"Oats (dry weight)",`${oatsG} g · ${cupsOf(oatsG,80)}`)]:[])
      .concat(oilLine(oilB),[zeroLine("Black coffee","any")])},
    msnack:{name:MEAL_NAMES.msnack,items:[line("yog",1,"Greek yogurt, 0%","1 cup"),line("berry",1,"Berries","1 cup")]},
    lunch:{name:MEAL_NAMES.lunch,items:[line("chicken",chOz,"Chicken breast (cooked)",`${chOz} oz`)]
      .concat(riceG?[line("rice",riceG,"White rice (cooked)",`${riceG} g · ${riceCups(riceG)}`)]:[])
      .concat([line("beans",1,"Black beans (rinsed)","½ cup"),line("veg",1,"Vegetables","1 cup")],oilLine(oilL))},
    shake:{name:MEAL_NAMES.shake,items:[line("whey",1.5,"Whey protein","1½ scoops"),line("banana",1,"Banana","1 medium"),zeroLine("Salt","¼ tsp")]},
    dinner:{name:MEAL_NAMES.dinner,items:[lean?line("chicken",siOz,"Chicken breast or white fish (cooked)",`${siOz} oz`):line("sirloin",siOz,"Sirloin, chicken, turkey or salmon (cooked; skip the oil on salmon days)",`${siOz} oz`)]
      .concat(potG?[line("spot",potG,"Sweet potato or potato (cooked)",`${potG} g`)]:[])
      .concat([line("veg",2,"Vegetables","2 cups")],oilLine(oilD))}
  };
  MEAL_IDS.forEach(id=>{meals[id].id=id;meals[id].tot=sum(meals[id].items);});
  const total=sum(MEAL_IDS.map(id=>meals[id].tot));
  return {meals,total,riceG,potG,oatsG,chOz,siOz,oil,lean};
}
const mac=t=>`${Math.round(t.k)} kcal · ${Math.round(t.p)}P ${Math.round(t.c)}C ${Math.round(t.f)}F`;
