/* =========================================================
   INTEGRATION — cross-module glue owned by the integrator
   ========================================================= */
/* Weekly focus (set in the Progress weekly review) shown on Today */
function weekFocusBanner(tab){
  if(tab!=="today"||typeof currentFocus!=="function")return;
  const f=currentFocus(S.date); if(!f)return;
  const host=document.querySelector(".tdv .phead"); if(!host||document.querySelector("[data-weekfocus]"))return;
  const el=document.createElement("div");
  el.className="callout weekfocus";el.setAttribute("data-weekfocus","");
  el.innerHTML=`<div><span class="eyebrow">Week ${f.week} focus</span><br><b>${esc(f.focus)}</b></div>`;
  host.insertAdjacentElement("afterend",el);
}
AFTER_RENDER.push(weekFocusBanner);
/* boot (90-main) already rendered once before this file ran: apply to that render too */
weekFocusBanner(S.tab);
/* Today also redraws parts of itself outside render() (its minute ticker, sync patches),
   so re-apply the banner whenever #app's content changes. */
(function(){
  let q=false;
  const mo=new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;if(S.tab==="today")weekFocusBanner("today");});});
  const app=document.getElementById("app"); if(app)mo.observe(app,{childList:true,subtree:true});
})();
