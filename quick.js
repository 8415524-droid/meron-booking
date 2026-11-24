/* הזמנה חדשה מהירה: כפתור צף בכל המסכים. חיפוש חי לפי הצורך של הלקוח,
   עם תוצאות מתאימות ותוצאות "כמעט" שבהן מפורטים הפערים. נטען אחרי app.js. */
(function(){
var A=window.MERON_APP,F=window.MERON_FEAT;if(!A||!F)return;
var $=A.$,esc=A.esc,money=A.money;
var Q={in:A.nextFriday(),out:"",g:4,rooms:0,budget:0,area:"",baths:0,toilets:0,flags:[],open:false};
Q.out=A.addDays(Q.in,2);
var st=document.createElement("style");
st.textContent='.qfab{position:fixed;left:20px;bottom:20px;z-index:40;border:0;border-radius:99px;padding:13px 20px;font:700 15px var(--font-ui,sans-serif);cursor:pointer;color:#fff;background:linear-gradient(135deg,#0e8a7c,#14b8a6);box-shadow:0 10px 28px rgba(14,138,124,.45)}.qfab:hover{filter:brightness(1.06)}'
+'.qwrap{position:fixed;inset:0;z-index:60;background:rgba(5,15,18,.55);display:none}.qwrap.on{display:block}'
+'.qpanel{position:absolute;top:0;bottom:0;left:0;width:min(560px,100%);background:var(--surface,#fff);color:var(--ink,#111);display:flex;flex-direction:column;box-shadow:12px 0 50px rgba(0,0,0,.35)}'
+'.qhead{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--line,#ddd)}.qhead h2{margin:0;flex:1;font-size:19px}'
+'.qform{padding:12px 18px;border-bottom:1px solid var(--line,#ddd);overflow:auto;max-height:44vh}.qform .grid2{gap:8px}.qform label{font-size:12.5px}'
+'.qchips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.qchip{border:1px solid var(--line,#ccc);background:var(--bg,#f4f6f6);border-radius:99px;padding:5px 11px;font:500 12.5px var(--font-ui,sans-serif);cursor:pointer;color:var(--ink,#111)}.qchip.on{background:#0e8a7c;color:#fff;border-color:#0e8a7c}'
+'.qres{flex:1;overflow:auto;padding:12px 18px 80px;display:flex;flex-direction:column;gap:10px}'
+'.qsum{font-weight:700;margin:2px 0}.qsec{font-size:12.5px;font-weight:700;color:var(--muted,#667);margin-top:6px}'
+'.qcard{border:1px solid var(--line,#ddd);border-radius:14px;padding:12px 14px;background:var(--bg,#fff);display:flex;flex-direction:column;gap:6px}.qcard.near{border-style:dashed}'
+'.qtop{display:flex;align-items:center;gap:10px}.qtop b{flex:1;font-size:15.5px}.qprice{font-weight:800;font-size:16px}'
+'.qtags{display:flex;flex-wrap:wrap;gap:5px}.qtag{font-size:12px;border-radius:99px;padding:2px 9px}.qtag.ok{background:#dff5ef;color:#0b6a5f}.qtag.gap{background:#fff0d1;color:#8a5a00}.qtag.bad{background:#fde1e1;color:#9b2020}'
+'@media (max-width:700px){.qfab{left:12px;bottom:12px;padding:12px 16px}.qform{max-height:48vh}}@media print{.qfab,.qwrap{display:none!important}}';
document.head.appendChild(st);
var btn=document.createElement("button");btn.className="qfab";btn.type="button";btn.textContent="＋ הזמנה חדשה";btn.setAttribute("aria-label","הזמנה חדשה, כניסה מהירה");
if(A.role!=="viewer")document.body.appendChild(btn);
var wrap=document.createElement("div");wrap.className="qwrap";wrap.innerHTML='<div class="qpanel" role="dialog" aria-label="הזמנה חדשה"><div class="qhead"><h2>הזמנה חדשה · חיפוש לפי הצורך</h2><button type="button" class="btn sm" id="q_close">סגור</button></div><div class="qform" id="q_form"></div><div class="qres" id="q_res"></div></div>';
document.body.appendChild(wrap);
function nin(id,lab,v,ph){return '<label>'+lab+'<input id="'+id+'" type="number" min="0" inputmode="numeric" value="'+(v||"")+'" placeholder="'+(ph||"")+'"></label>'}
function build(){
  $("q_form").innerHTML='<div class="grid2"><label>כניסה<input id="q_in" type="date" value="'+Q.in+'"></label><label>יציאה<input id="q_out" type="date" value="'+Q.out+'"></label>'
   +nin("q_g","מספר אורחים",Q.g)+nin("q_rooms","מינימום חדרים",Q.rooms)+nin("q_budget","תקציב מקסימלי ללילה (₪)",Q.budget,"ללא הגבלה")
   +'</div><details'+(Q.area||Q.baths||Q.toilets||Q.flags.length?' open':'')+' style="margin-top:8px"><summary style="cursor:pointer;font-weight:600;color:var(--accent)">דרישות נוספות: אזור, מקלחות, שירותים, גינה, חצר ועוד</summary><div class="grid2" style="margin-top:8px"><label>אזור או שם<input id="q_area" value="'+esc(Q.area)+'" placeholder="לדוגמה: מירון"></label>'
   +nin("q_baths","מינימום מקלחות",Q.baths)+nin("q_toil","מינימום שירותים",Q.toilets)+'</div>'
   +'<div class="qchips" id="q_chips">'+F.flags.map(function(f){return '<button type="button" class="qchip'+(Q.flags.indexOf(f[0])>-1?' on':'')+'" data-f="'+f[0]+'">'+f[1]+'</button>'}).join("")+'</div></details>';
  ["q_in","q_out","q_g","q_rooms","q_budget","q_area","q_baths","q_toil"].forEach(function(id){$(id).addEventListener("input",read)});
  [].forEach.call($("q_chips").querySelectorAll(".qchip"),function(c){c.addEventListener("click",function(){var k=c.dataset.f,i=Q.flags.indexOf(k);if(i>-1)Q.flags.splice(i,1);else Q.flags.push(k);c.classList.toggle("on");run()})});
}
function read(){
  Q.in=$("q_in").value||Q.in;Q.out=$("q_out").value||Q.out;
  if(Q.out<=Q.in){Q.out=A.addDays(Q.in,2);$("q_out").value=Q.out}
  Q.g=+$("q_g").value||0;Q.rooms=+$("q_rooms").value||0;Q.budget=+$("q_budget").value||0;Q.area=$("q_area").value.trim();Q.baths=+$("q_baths").value||0;Q.toilets=+$("q_toil").value||0;run();
}
function featOf(u){var h=A.propById(u.houseId);return u.feat||(h&&h.feat)||null}
function evalUnit(u){
  var n=A.nights(Q.in,Q.out),gaps=[],oks=[],score=0,hard=false,f=featOf(u);
  // זמינות
  var conf=A.S.bookings.filter(function(b){return (b.unitId||b.propId)===u.id&&b.status!=="cancelled"&&A.overlap(Q.in,Q.out,b.in,b.out)});
  var busyN=0;if(conf.length){for(var i=0;i<n;i++){var d=A.addDays(Q.in,i);if(conf.some(function(b){return d>=b.in&&d<b.out}))busyN++}}
  if(busyN>=n)hard=true;else if(busyN>0){gaps.push({t:"תפוס "+busyN+" מתוך "+n+" לילות",bad:true});score+=3;}
  else oks.push("פנויה בתאריכים");
  // אורחים ומיטות
  if(Q.g){if((u.beds||0)>=Q.g)oks.push((u.beds||0)+" מיטות");else{var m=Q.g-(u.beds||0);gaps.push({t:"חסרות "+m+" מיטות ("+(u.beds||0)+" מתוך "+Q.g+")"});score+=m>2?9:m}}
  if(Q.rooms){if((u.rooms||0)>=Q.rooms)oks.push((u.rooms||0)+" חדרים");else{var mr=Q.rooms-(u.rooms||0);gaps.push({t:"חסר "+(mr>1?mr+" חדרים":"חדר")+" ("+(u.rooms||0)+" מתוך "+Q.rooms+")"});score+=mr>2?9:mr}}
  // מחיר
  var tot=A.estimate(u,Q.in,Q.out),per=n?Math.round(tot/n):0;
  if(Q.budget){if(per<=Q.budget)oks.push("בתקציב");else{var over=per-Q.budget;gaps.push({t:"יקרה ב־"+money(over)+" ללילה מהתקציב"});score+=over/Q.budget>0.3?9:(over/Q.budget>0.12?2:1)}}
  // אזור
  if(Q.area){var hay=((u.name||"")+" "+(u.area||"")+" "+(u.notes||"")).toLowerCase();if(hay.indexOf(Q.area.toLowerCase())>-1)oks.push("אזור מתאים");else{gaps.push({t:"לא באזור שביקש ("+esc(u.area||"לא הוגדר")+")"});score+=1}}
  // מאפיינים
  function need(k,lab,min){if(!min)return;var v=f&&f[k];if(v===undefined||v===null){gaps.push({t:lab+": לא הוזן במערכת"});score+=.5}else if(v>=min)oks.push(v+" "+lab);else{gaps.push({t:"יש "+v+" "+lab+", צריך "+min});score+=(min-v)}}
  need("baths","מקלחות",Q.baths);need("toilets","שירותים",Q.toilets);
  Q.flags.forEach(function(k){var lab=(F.flags.filter(function(x){return x[0]===k})[0]||[0,k])[1],has=f&&(f.flags||[]).indexOf(k)>-1;
    if(has)oks.push(lab);else if(!f||!f.flags||!f.flags.length&&f.baths===undefined){gaps.push({t:lab+": לא הוזן במערכת"});score+=.5}else{gaps.push({t:"אין "+lab});score+=1}});
  return {u:u,gaps:gaps,oks:oks,score:score,hard:hard,tot:tot,per:per,busy:busyN>0};
}
function card(r){
  var u=r.u,exact=!r.gaps.length;
  var tags=r.oks.map(function(t){return '<span class="qtag ok">✓ '+esc(t)+'</span>'}).join("")+r.gaps.map(function(g){return '<span class="qtag '+(g.bad?'bad':'gap')+'">'+(g.bad?'✕ ':'⚠ ')+esc(g.t)+'</span>'}).join("");
  var ft=F.text(featOf(u));
  return '<div class="qcard'+(exact?'':' near')+'"><div class="qtop"><b>'+esc(u.name)+'</b><span class="qprice">'+money(r.tot)+'</span></div>'
   +'<div class="meta">'+esc(u.area||"")+' · '+(u.beds||0)+' מיטות · '+(u.rooms||0)+' חדרים · '+money(r.per)+' ללילה'+(ft?' · '+esc(ft):'')+'</div>'
   +'<div class="qtags">'+tags+'</div>'
   +'<div class="row" style="margin-top:4px">'+(r.busy?'<span class="meta">תפוסה חלקית, לא ניתן להזמין בתאריכים אלה</span>':'<button type="button" class="btn primary sm" data-qbook="'+u.id+'">'+(exact?'הזמן':'הזמן למרות הפערים')+'</button>')+'</div></div>';
}
function run(){
  var res=$("q_res");if(!res)return;
  if(!A.S.ready){res.innerHTML='<div class="empty">טוען…</div>';return}
  var all=A.bookables().map(evalUnit).filter(function(r){return !r.hard});
  var exact=all.filter(function(r){return !r.gaps.length}).sort(function(a,b){return a.per-b.per});
  var near=all.filter(function(r){return r.gaps.length&&r.score<=5}).sort(function(a,b){return a.score-b.score||a.per-b.per});
  var h='<div class="qsum">'+exact.length+' מתאימות לגמרי'+(near.length?' · '+near.length+' כמעט מתאימות':'')+'</div>';
  if(exact.length)h+=exact.map(card).join("");else h+='<div class="empty">אין יחידה שעונה על כל הדרישות. הנה הכי קרובות:</div>';
  if(near.length){h+='<div class="qsec">כמעט מתאימות, עם הפערים ביחס לבקשה</div>'+near.map(card).join("")}
  if(!exact.length&&!near.length)h+='<div class="empty">לא נמצאה יחידה קרובה. אפשר להרחיב תאריכים או לבטל חלק מהדרישות.</div>';
  res.innerHTML=h;
}
function open(){Q.open=true;wrap.classList.add("on");build();run()}
function close(){Q.open=false;wrap.classList.remove("on")}
btn.addEventListener("click",open);
wrap.addEventListener("click",function(e){
  if(e.target===wrap||e.target.id==="q_close"){close();return}
  var b=e.target.closest("[data-qbook]");if(!b)return;
  var id=b.dataset.qbook;A.S.draft={in:Q.in,out:Q.out,g:Q.g||1};close();A.go("intake");
  setTimeout(function(){try{A.openBook(id)}catch(e){A.toast("לא ניתן לפתוח את טופס ההזמנה")}},0);
});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&Q.open)close()});
setInterval(function(){if(Q.open&&document.activeElement&&document.activeElement.closest&&!document.activeElement.closest("#q_form"))run()},4000);
})();

/* ---- חיפוש הזמנה: כפתור צף בכל המסכים (ליד "הזמנה חדשה"), פותח את מסך ההזמנות עם חיפוש לפי שם, טלפון או נכס ---- */
(function(){
if(A.role==="vendor")return;
var st2=document.createElement("style");
st2.textContent='.qsearch{position:fixed;left:170px;bottom:20px;z-index:40;border:1px solid var(--line,#cfd8dc);border-radius:99px;padding:13px 18px;font:700 15px var(--font-ui,sans-serif);cursor:pointer;color:var(--ink,#123);background:var(--panel,#fff);box-shadow:0 4px 14px rgba(0,0,0,.18)}@media (max-width:700px){.qsearch{left:150px;bottom:12px;padding:12px 14px}}@media print{.qsearch{display:none!important}}';
document.head.appendChild(st2);
var b2=document.createElement("button");b2.className="qsearch";b2.type="button";b2.textContent="🔍 חיפוש הזמנה";b2.setAttribute("aria-label","חיפוש הזמנה לפי שם, טלפון או נכס");
b2.addEventListener("click",function(){
  A.go("bookings");
  setTimeout(function(){
    var all=document.querySelector('#bk_f [data-id="all"]');if(all&&all.getAttribute("aria-pressed")!=="true")all.click();
    var q=document.getElementById("bk_q");if(q){q.focus();q.select()}
  },60);
});
document.body.appendChild(b2);
})();
