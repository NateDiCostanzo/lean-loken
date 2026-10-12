/* =========================================================
   DATES & TIMES
   ========================================================= */
const pad=n=>String(n).padStart(2,"0");
const keyOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseKey=k=>{const [y,m,d]=String(k).split("-").map(Number);return new Date(y,m-1,d,12);};
const validKey=k=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&!isNaN(parseKey(k));
const addDays=(k,n)=>{const d=parseKey(k);d.setDate(d.getDate()+n);return keyOf(d);};
const diffDays=(a,b)=>Math.round((parseKey(b)-parseKey(a))/864e5);
const todayKey=()=>keyOf(new Date());
const nice=k=>{const d=parseKey(k);return `${DOWN[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;};
const short=k=>{const d=parseKey(k);return `${MON[d.getMonth()]} ${d.getDate()}`;};
const mondayOf=k=>{const d=parseKey(k);return addDays(k,-((d.getDay()+6)%7));};
const toMin=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t||"");return m?(+m[1])*60+(+m[2]):null;};
const fmt12=m=>{m=((Math.round(m)%1440)+1440)%1440;let h=Math.floor(m/60),mm=m%60;const ap=h>=12?"PM":"AM";h=h%12||12;return `${h}:${pad(mm)} ${ap}`;};
const q15=m=>Math.round(m/15)*15;
/* minutes → "HH:MM" (24 h), for settings values */
const hm=m=>{m=((Math.round(m)%1440)+1440)%1440;return `${pad(Math.floor(m/60))}:${pad(m%60)}`;};
/* "HH:MM" or "H:MM" → normalized "HH:MM", or null when invalid */
const normHM=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(String(t||"").trim());if(!m)return null;const h=+m[1],mm=+m[2];return h<24&&mm<60?`${pad(h)}:${pad(mm)}`:null;};
