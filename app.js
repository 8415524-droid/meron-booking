(function(){
var TABS=[["dash","דשבורד"],["intake","הזמנה חדשה"],["bookings","הזמנות"],["cal","יומן שבתות"],["month","תפוסה חודשית"],["props","בתים ויחידות"],["price","מחירון"],["ads","פרסום"],["ops","תחזוקה וניקיון"],["bills","חשבונות נכס"],["inv","חשבוניות"],["exp","הוצאות"],["pay","משכורות"],["ledger","הנהלת חשבונות"],["pl","רווח והפסד"],["fin","התחשבנות"],["requests","בקשות מהאתר"],["search","חיפוש לקוח"],["report","דוח לבעל בית"],["alerts","התראות"],["forecast","תחזית שבתות"],["backup","גיבוי"],["owners","בעלי נכסים"]];
var CATS=["שיווק ופרסום","תוכנה ומערכות","טלפוניה","משרד ושכירות","נסיעות","ייעוץ מקצועי","עמלות סליקה","ביטוח","שונות"];
var STATUS={pending:["ממתין לאישור","warn"],confirmed:["מאושר","ok"],in:["נכנסו","ok"],done:["הסתיים",""],cancelled:["בוטל","bad"]};
var NEXT={pending:"confirmed",confirmed:"in","in":"done"};
var NEXT_LABEL={pending:"אשר הזמנה",confirmed:"סמן כניסה","in":"סמן סיום"};
var S={db:null,props:[],bookings:[],emps:[],units:[],ads:[],leads:[],tasks:[],bills:[],cleans:[],payroll:[],expenses:[],invoices:[],seasons:[],cfg:{vat:18,oncost:22,commIncVat:false,nextInv:1,company:""},
  month:"all",ready:false,tab:"dash",mOff:0,opFilter:"open",bMonth:"all",bUnpaid:false,calOff:0,selId:null,filter:"open",q:"",editId:null,finMonth:"all",confirmDel:null,draft:null};

function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function money(n){return "₪"+Math.round(n||0).toLocaleString("he-IL")}
function iso(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function parse(s){var p=s.split("-");return new Date(+p[0],+p[1]-1,+p[2])}
function addDays(s,n){var d=parse(s);d.setDate(d.getDate()+n);return iso(d)}
function nights(a,b){return Math.round((parse(b)-parse(a))/864e5)}
function nextFriday(from){var d=from?parse(from):new Date();d.setHours(0,0,0,0);var add=(5-d.getDay()+7)%7;d.setDate(d.getDate()+add);return iso(d)}
function fmt(s){return parse(s).toLocaleDateString("he-IL",{weekday:"short",day:"numeric",month:"short"})}
function heb(s){try{return parse(s).toLocaleDateString("he-IL-u-ca-hebrew",{day:"numeric",month:"long"})}catch(e){return ""}}
function overlap(a1,a2,b1,b2){return a1<b2&&b1<a2}
function propById(id){return S.props.filter(function(p){return p.id===id})[0]}
function toast(t){var el=$("toast");el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){el.hidden=true},2600)}
function commission(b){var p=propById(b.propId);var pct=b.pct!=null?b.pct:(p?p.pct:15);return Math.round((b.total||0)*pct/100)}
function seasonOf(d){return S.seasons.filter(function(s){return s.from<=d&&d<=s.to})[0]}
function mult(d){var s=seasonOf(d);return 1+((s&&s.pct)||0)/100}
function estimate(p,ci,co){
  var n=nights(ci,co);if(n<=0)return 0;
  if(p.shabbatPrice&&n===2&&parse(ci).getDay()===5)return Math.round(p.shabbatPrice*mult(ci));
  var t=0;for(var i=0;i<n;i++)t+=(p.price||0)*mult(addDays(ci,i));
  return Math.round(t);
}

/* ---------- db ---------- */
function save(col,id,data,msg){
  if(ROLE==="viewer"){toast("צפייה בלבד, אין הרשאה לשנות");return Promise.resolve()}
  if(!S.db){toast("אין חיבור למסד הנתונים");return Promise.resolve()}
  var ref=S.db.collection(col).doc(id);
  return ref.set(data).then(function(){if(msg)toast(msg)}).catch(function(e){
    toast(e&&e.code==="invalid_argument"?"אין הרשאת כתיבה למשתמש זה":"השמירה נכשלה, נסה שוב");
  });
}
function del(col,id){if(ROLE==="viewer"){toast("צפייה בלבד, אין הרשאה לשנות");return Promise.resolve()}return S.db.collection(col).doc(id).delete().then(function(){toast("נמחק")}).catch(function(){toast("המחיקה נכשלה")})}
function newId(col){return S.db.collection(col).doc().id}

/* ---------- shell ---------- */
var ROLE=window.MERON_ROLE||"admin";
var ROLE_TABS={agent:["requests","intake","bookings","search","cal","month","props","alerts"],owner:["bookings","cal","report"],vendor:["ops"],partner:["dash","bookings","forecast","pl","fin","ledger"]};
var ROLE_HOME={viewer:"dash",admin:"dash",agent:"intake",owner:"bookings",vendor:"ops",partner:"dash"};
function tabAllowed(k){return ROLE==="admin"||ROLE==="viewer"||(ROLE_TABS[ROLE]||[]).indexOf(k)>=0}
var GROUPS=[["הזמנות","book",["dash","requests","intake","bookings","search","cal","month","forecast"]],["נכסים ושיווק","home",["owners","props","price","ads"]],["תפעול","tool",["ops","bills","alerts"]],["כספים","coin",["inv","exp","pay","ledger","pl","fin","report"]],["מערכת","tool",["backup"]]];
var GICON={'book': '<path d="M4 5h16v14H4zM4 10h16M9 5v14"/>', 'home': '<path d="M3 11l9-7 9 7v9H3zM9 20v-6h6v6"/>', 'tool': '<path d="M14 6a4 4 0 005 5l-9 9-3-3 9-9a4 4 0 00-2-2z"/>', 'coin': '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10c0-2 6-2 6 0s-6 2-6 4 6 2 6 0"/>'};
function renderTabs(){
  var names={};TABS.forEach(function(t){names[t[0]]=t[1]});
  $("tabs").innerHTML=GROUPS.map(function(g){
    var ks=g[2].filter(tabAllowed);if(!ks.length)return "";
    return '<div class="grp"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+GICON[g[1]]+'</svg>'+g[0]+'</div>'+
      ks.map(function(k){return '<button role="tab" data-tab="'+k+'" aria-selected="'+(S.tab===k)+'">'+names[k]+'</button>'}).join("");
  }).join("");
  var pt=$("pagetitle");if(pt)pt.textContent=names[S.tab]||"";
  document.body.classList.remove("menu-open");
}
function go(t){S.tab=t;renderTabs();mount()}
document.addEventListener("click",function(e){
  if(e.target.closest("#menubtn")){document.body.classList.toggle("menu-open");return}
  if(e.target.id==="scrim"){document.body.classList.remove("menu-open");return}
  var t=e.target.closest("[data-tab]");if(t){go(t.dataset.tab);return}
  var a=e.target.closest("[data-act]");if(a){if(window.MERON_X&&MERON_X.act&&MERON_X.act(a.dataset.act,a.dataset.id,a))return;act(a.dataset.act,a.dataset.id,a)}
});
function mount(){
  var v=$("view");
  if(window.MERON_X&&MERON_X.tabs&&MERON_X.tabs[S.tab]){MERON_X.tabs[S.tab].mount(v);return}
  if(S.tab==="dash")mountDash(v);
  else if(S.tab==="month")mountMonth(v);
  else if(S.tab==="ads")mountAds(v);
  else if(S.tab==="ops")mountOps(v);
  else if(S.tab==="bills")mountBills(v);
  else if(S.tab==="ledger")mountLedger(v);
  else if(S.tab==="intake")mountIntake(v);
  else if(S.tab==="bookings")mountBookings(v);
  else if(S.tab==="cal")mountCal(v);
  else if(S.tab==="props")mountProps(v);
  else if(S.tab==="price")mountPrice(v);
  else if(S.tab==="inv")mountInv(v);
  else if(S.tab==="exp")mountExp(v);
  else if(S.tab==="pay")mountPay(v);
  else if(S.tab==="pl")mountPL(v);
  else mountFin(v);
}
function refresh(){
  $("status").textContent=S.ready?(S.props.length+" נכסים · "+S.bookings.filter(function(b){return b.status!=="cancelled"}).length+" הזמנות פעילות"):"טוען נתונים…";
  if(window.MERON_X&&MERON_X.tabs&&MERON_X.tabs[S.tab]){if(MERON_X.tabs[S.tab].upd)MERON_X.tabs[S.tab].upd();if(MERON_X.badge)MERON_X.badge();return}
  if(S.tab==="dash")updDash();
  else if(S.tab==="month")updMonth();
  else if(S.tab==="ads")updAds();
  else if(S.tab==="ops")updOps();
  else if(S.tab==="bills")updBills();
  else if(S.tab==="ledger")updLedger();
  else if(S.tab==="intake")updIntake();
  else if(S.tab==="bookings")updBookings();
  else if(S.tab==="cal")updCal();
  else if(S.tab==="props")updProps();
  else if(S.tab==="price")updPrice();
  else if(S.tab==="inv")updInv();
  else if(S.tab==="exp")updExp();
  else if(S.tab==="pay"){var pt=$("pay_t");if(!(pt&&pt.contains(document.activeElement)&&document.activeElement.tagName==="INPUT"))updPay()}
  else if(S.tab==="pl")updPL();
  else updFin();
}

/* ---------- intake (phone agent) ---------- */
function mountIntake(v){
  var ci=S.draft&&S.draft.in||nextFriday(), co=S.draft&&S.draft.out||addDays(ci,2);
  v.innerHTML='<div class="stack">'
   +'<div class="panel stack"><div><h2>הזמנה טלפונית</h2><div class="meta">בחר תאריכים ומספר אורחים, ואז נכס פנוי. הטופס נשמר רק בלחיצה על “שמור הזמנה”.</div></div>'
   +'<div class="grid2">'
   +'<label>כניסה<input type="date" id="i_in" value="'+ci+'"></label>'
   +'<label>יציאה<input type="date" id="i_out" value="'+co+'"></label>'
   +'<label>מספר אורחים<input type="number" id="i_g" min="1" value="'+((S.draft&&S.draft.g)||4)+'" inputmode="numeric"></label>'
   +'</div><div class="meta" id="i_dates"></div></div>'
   +'<div class="panel stack"><h2>נכסים פנויים</h2><div class="list" id="i_res"></div></div>'
   +'<div class="panel stack" id="i_wait" hidden></div>'
   +'<div class="panel stack" id="i_book" hidden></div></div>';
  ["i_in","i_out","i_g"].forEach(function(id){$(id).addEventListener("input",function(){
    if(id==="i_in"&&$("i_out").value<=$("i_in").value)$("i_out").value=addDays($("i_in").value,2);
    S.draft={in:$("i_in").value,out:$("i_out").value,g:+$("i_g").value||1};S.selId=null;updIntake();
  })});
  S.draft={in:ci,out:co,g:+$("i_g").value||1};
  updIntake();
}
/* ---------- bookings ---------- */
function mountBookings(v){
  v.innerHTML='<div class="stack"><div class="panel stack"><div class="row between"><h2>הזמנות</h2><button class="btn primary" data-tab="intake">הזמנה חדשה</button></div>'
   +'<div class="chips" id="bk_f"></div><label>חיפוש לפי שם, טלפון או נכס<input id="bk_q" value="'+esc(S.q)+'"></label></div><div class="list" id="bk_l"></div></div>';
  $("bk_q").addEventListener("input",function(){S.q=$("bk_q").value;updBookings()});
  updBookings();
}
function updBookings(){
  if(!$("bk_l"))return;
  var F=[["open","פעילות"],["pending","ממתינות"],["confirmed","מאושרות"],["done","הסתיימו"],["cancelled","בוטלו"],["all","הכל"]];
  $("bk_f").innerHTML=F.map(function(f){return '<button class="chip" data-act="filter" data-id="'+f[0]+'" aria-pressed="'+(S.filter===f[0])+'">'+f[1]+'</button>'}).join("");
  var q=S.q.trim();
  var list=S.bookings.filter(function(b){
    if(S.filter==="open"&&!(b.status==="pending"||b.status==="confirmed"||b.status==="in"))return false;
    if(S.filter!=="open"&&S.filter!=="all"&&b.status!==S.filter)return false;
    if(q){var p=propById(b.propId);var hay=(b.name+" "+b.phone+" "+(p?p.name:"")).toLowerCase();if(hay.indexOf(q.toLowerCase())<0)return false}
    return true;
  }).sort(function(a,b){return a.in<b.in?-1:1});
  if(!list.length){$("bk_l").innerHTML='<div class="panel empty">'+(S.bookings.length?'אין הזמנות שמתאימות לסינון.':'עדיין אין הזמנות. הזמנה שנקלטת בשיחה טלפונית תופיע כאן.')+'</div>';return}
  $("bk_l").innerHTML=list.map(function(b){
    var p={name:unitLabel(b)}, st=STATUS[b.status]||["",""], comm=commission(b), due=(b.total||0)-(b.dep||0);
    var nxt=NEXT[b.status];
    return '<div class="panel stack"><div class="row between"><div class="info"><h3>'+esc(b.name)+' · '+esc(p?p.name:"נכס שנמחק")+'</h3>'
     +'<div class="meta">'+fmt(b.in)+' עד '+fmt(b.out)+' · '+(b.guests||"?")+' אורחים · <span dir="ltr">'+esc(b.phone||"")+'</span></div></div>'
     +'<span class="pill '+st[1]+'">'+st[0]+'</span></div>'
     +'<div class="meta">סכום '+money(b.total)+' · מקדמה '+money(b.dep)+' · יתרה לגבייה '+money(due)+' · עמלה '+money(comm)+(b.ownerPaid?' · שולם לבעל הדירה':'')+'</div>'
     +(b.notes?'<div class="meta">הערה: '+esc(b.notes)+'</div>':'')
     +'<div class="row">'
     +'<button class="btn sm" data-act="copyMsg" data-id="'+b.id+'">העתק הודעת אישור</button>'
     +(nxt?'<button class="btn primary sm" data-act="advance" data-id="'+b.id+'">'+NEXT_LABEL[b.status]+'</button>':'')
     +(b.status!=="cancelled"&&b.status!=="done"?'<button class="btn sm" data-act="addDep" data-id="'+b.id+'">רשום תשלום</button>':'')
     +(b.status==="done"&&!b.ownerPaid?'<button class="btn sm" data-act="ownerPaid" data-id="'+b.id+'">סמן ששולם לבעל הדירה</button>':'')
     +(b.status!=="cancelled"&&b.status!=="done"?'<button class="btn danger sm" data-act="cancelB" data-id="'+b.id+'">בטל</button>':'')
     +(S.confirmDel===b.id?'<button class="btn danger sm" data-act="delB" data-id="'+b.id+'">מחק סופית</button><button class="btn sm" data-act="noDel">השאר</button>':'<button class="btn sm" data-act="askDel" data-id="'+b.id+'">מחק</button>')
     +'</div></div>';
  }).join("");
}

/* ---------- calendar ---------- */
function calFridays(){
  var f=addDays(nextFriday(),7*S.calOff),a=[];for(var i=0;i<6;i++)a.push(addDays(f,7*i));return a;
}
function mountCal(v){
  v.innerHTML='<div class="panel stack"><div class="row between"><div><h2>יומן זמינות לסופי שבוע</h2><div class="meta">כל עמודה היא שישי עד ראשון. ירוק פנוי, אדום תפוס, כתום תפוס חלקית.</div></div>'
   +'<div class="row"><button class="btn sm" data-act="calPrev">קודם</button><button class="btn sm" data-act="calNext">הבא</button></div></div>'
   +'<div class="scroll" id="cal_t"></div></div>';
  updCal();
}
/* ---------- properties ---------- */
function mountProps(v){
  v.innerHTML='<div class="stack"><div class="panel stack" id="p_form"></div><div class="list" id="p_list"></div><div class="panel stack" id="p_units"></div></div>';
  drawPropForm();updProps();
}
function drawPropForm(){
  var p=S.editId?propById(S.editId):null;
  p=p||{name:"",area:"",beds:6,rooms:3,price:900,shabbatPrice:2500,owner:"",ownerPhone:"",mode:"regular",pct:15,cleanCost:150,notes:"",active:true};
  $("p_form").innerHTML='<h2>'+(S.editId?'עריכת בית אירוח':'בית אירוח חדש')+'</h2><div class="meta">מיטות, חדרים ומחיר כאן משמשים כיחידה ראשית. לבית עם כמה יחידות אפשר להוסיף יחידות בפאנל מתחת, והן יחליפו אותה.</div><div class="grid2">'
   +'<label>שם הנכס<input id="f_name" value="'+esc(p.name)+'"></label>'
   +'<label>אזור או כתובת<input id="f_area" value="'+esc(p.area)+'"></label>'
   +'<label>מיטות<input id="f_beds" type="number" min="1" value="'+p.beds+'"></label>'
   +'<label>חדרים<input id="f_rooms" type="number" min="1" value="'+p.rooms+'"></label>'
   +'<label>מחיר ללילה (₪)<input id="f_price" type="number" min="0" value="'+p.price+'"></label>'
   +'<label>מחיר חבילת שבת, שישי עד ראשון (₪)<input id="f_sp" type="number" min="0" value="'+(p.shabbatPrice||0)+'"></label>'
   +'<label>בעל הדירה<input id="f_owner" value="'+esc(p.owner)+'"></label>'
   +'<label>טלפון בעל הדירה<input id="f_op" type="tel" dir="ltr" style="text-align:right" value="'+esc(p.ownerPhone)+'"></label>'
   +'<label>מסלול<select id="f_mode"><option value="regular"'+(p.mode==="regular"?' selected':'')+'>רגיל</option><option value="exclusive"'+(p.mode==="exclusive"?' selected':'')+'>בלעדי</option></select></label>'
   +'<label>עמלה באחוזים<input id="f_pct" type="number" min="0" max="100" step="0.5" value="'+p.pct+'"></label>'
   +'<label>עלות ניקיון ליציאה (₪)<input id="f_cc" type="number" min="0" value="'+(p.cleanCost||0)+'"></label>'
   +'</div><label>הערות (קרבה לציון, מזגן, מגבות)<textarea id="f_notes">'+esc(p.notes)+'</textarea></label>'
   +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="f_act" style="width:auto"'+(p.active!==false?' checked':'')+'> פעיל להזמנות</label>'
   +'<div class="row"><button class="btn primary" data-act="saveProp">'+(S.editId?'שמור שינויים':'הוסף נכס')+'</button>'+(S.editId?'<button class="btn" data-act="cancelEdit">בטל עריכה</button>':'')+'</div>';
}
function updProps(){updUnits();
  if(!$("p_list"))return;
  if(!S.props.length){$("p_list").innerHTML='<div class="panel empty">הנכסים שתוסיף יופיעו כאן.</div>';return}
  $("p_list").innerHTML=S.props.map(function(p){
    var cnt=S.bookings.filter(function(b){return b.propId===p.id&&b.status!=="cancelled"}).length;
    return '<div class="opt"><div class="info"><h3>'+esc(p.name)+(p.active===false?' <span class="pill bad">לא פעיל</span>':'')+'</h3>'
     +'<div class="meta">'+esc(p.area||"")+' · '+p.beds+' מיטות · '+money(p.price)+' ללילה · חבילת שבת '+money(p.shabbatPrice)+'</div>'
     +'<div class="meta">בעלים: '+esc(p.owner||"לא הוזן")+' <span dir="ltr">'+esc(p.ownerPhone||"")+'</span> · '+(p.mode==="exclusive"?'בלעדי':'רגיל')+' · עמלה '+p.pct+'% · '+cnt+' הזמנות</div></div>'
     +'<div class="row"><button class="btn sm" data-act="editProp" data-id="'+p.id+'">ערוך</button>'
     +(S.confirmDel===p.id?'<button class="btn danger sm" data-act="delP" data-id="'+p.id+'">מחק סופית</button><button class="btn sm" data-act="noDel">השאר</button>':'<button class="btn sm" data-act="askDel" data-id="'+p.id+'">מחק</button>')
     +'</div></div>';
  }).join("");
}

/* ---------- finance ---------- */
function mountFin(v){
  v.innerHTML='<div class="stack"><div class="panel stack"><div class="row between"><h2>כספים ועמלות</h2><label style="min-width:180px">תקופה (לפי תאריך כניסה)<select id="fin_m"></select></label></div>'
   +'<div class="stats" id="fin_s"></div></div><div class="panel stack"><h2>התחשבנות עם בעלי דירות</h2><div class="scroll" id="fin_t"></div></div></div>';
  $("fin_m").addEventListener("change",function(){S.finMonth=$("fin_m").value;updFin()});
  updFin();
}
/* ---------- actions ---------- */
function val(id){return $(id).value}
function act(a,id,el){
  if(actX(a,id,el))return;
  if(a==="pick")return openBookForm(id);
  if(a==="cancelPick"){S.selId=null;$("i_book").hidden=true;updIntake();return}
  if(a==="saveBooking"){
    var p=unitById(S.selId);if(!p)return;
    var name=val("b_name").trim(),phone=val("b_phone").trim();
    if(!name||!phone){toast("חסר שם או טלפון של האורח");return}
    var ci=val("i_in"),co=val("i_out");
    if(!isFree(p,ci,co)){toast("הנכס כבר נתפס בתאריכים האלה");updIntake();return}
    var bid=newId("bookings");
    var total=+val("b_total")||0;
    save("bookings",bid,{propId:p.houseId,unitId:p.id,source:val("b_src"),name:name,phone:phone,guests:+val("i_g")||1,in:ci,out:co,total:total,dep:+val("b_dep")||0,
      pct:p.pct,status:"pending",notes:val("b_notes").trim(),ownerPaid:false,createdAt:Date.now()},"ההזמנה נשמרה").then(function(){
      S.selId=null;S.draft=null;mountIntake($("view"));
    });
    return;
  }
  if(a==="filter"){S.filter=id;updBookings();return}
  var b=S.bookings.filter(function(x){return x.id===id})[0];
  if(a==="advance"&&b)return save("bookings",b.id,Object.assign({},b.raw,{status:NEXT[b.status]}),"הסטטוס עודכן");
  if(a==="cancelB"&&b)return save("bookings",b.id,Object.assign({},b.raw,{status:"cancelled"}),"ההזמנה בוטלה");
  if(a==="ownerPaid"&&b)return save("bookings",b.id,Object.assign({},b.raw,{ownerPaid:true}),"סומן ששולם");
  if(a==="addDep"&&b){
    var cur=el.parentNode;
    if(cur.querySelector(".dep-in"))return;
    var w=document.createElement("span");w.className="row";
    w.innerHTML='<input class="dep-in" type="number" min="0" inputmode="numeric" placeholder="סכום ששולם" style="width:130px;padding:5px 8px"><button class="btn primary sm" data-act="depOk" data-id="'+b.id+'">הוסף</button>';
    cur.appendChild(w);w.querySelector("input").focus();return;
  }
  if(a==="depOk"&&b){
    var amt=+el.parentNode.querySelector("input").value;
    if(!(amt>0)){toast("הזן סכום");return}
    return save("bookings",b.id,Object.assign({},b.raw,{dep:(b.dep||0)+amt}),"התשלום נרשם");
  }
  if(a==="askDel"){S.confirmDel=id;refresh();return}
  if(a==="noDel"){S.confirmDel=null;refresh();return}
  if(a==="delB"){S.confirmDel=null;del("bookings",id);return}
  if(a==="delP"){
    S.confirmDel=null;
    if(S.bookings.some(function(x){return x.propId===id&&x.status!=="cancelled"&&x.status!=="done"})){toast("יש הזמנות פעילות בנכס. בטל אותן קודם");refresh();return}
    del("properties",id);return;
  }
  if(a==="calPrev"){S.calOff=Math.max(S.calOff-6,-6);updCal();return}
  if(a==="calNext"){S.calOff+=6;updCal();return}
  if(a==="calBook"){
    var x=id.split("|");S.draft={in:x[1],out:addDays(x[1],2),g:S.draft&&S.draft.g||4};
    go("intake");setTimeout(function(){openBookForm(x[0])},0);return;
  }
  if(a==="editProp"){S.editId=id;drawPropForm();$("p_form").scrollIntoView({behavior:"smooth",block:"start"});return}
  if(a==="cancelEdit"){S.editId=null;drawPropForm();return}
  if(a==="saveProp"){
    var name2=val("f_name").trim();if(!name2){toast("חסר שם לנכס");return}
    var pct=+val("f_pct");if(!(pct>=0&&pct<=100)){toast("אחוז עמלה לא תקין");return}
    var pid=S.editId||newId("properties");
    var data={name:name2,area:val("f_area").trim(),beds:+val("f_beds")||1,rooms:+val("f_rooms")||1,price:+val("f_price")||0,shabbatPrice:+val("f_sp")||0,
      owner:val("f_owner").trim(),ownerPhone:val("f_op").trim(),mode:val("f_mode"),pct:pct,cleanCost:+val("f_cc")||0,notes:val("f_notes").trim(),active:$("f_act").checked};
    save("properties",pid,data,S.editId?"הנכס עודכן":"הנכס נוסף").then(function(){S.editId=null;drawPropForm()});
    return;
  }
}

/* ---------- shared helpers for management tabs ---------- */
function vatR(){return (+S.cfg.vat||0)/100}
function mLabel(m){return parse(m+"-01").toLocaleDateString("he-IL",{month:"long",year:"numeric"})}
function allMonths(){var m={};S.bookings.forEach(function(b){m[b.in.slice(0,7)]=1});S.expenses.forEach(function(e){m[e.date.slice(0,7)]=1});m[iso(new Date()).slice(0,7)]=1;return Object.keys(m).sort().reverse()}
function monthOpts(sel,withAll){return (withAll?'<option value="all">כל התקופות</option>':'')+allMonths().map(function(m){return '<option value="'+m+'"'+(sel===m?' selected':'')+'>'+mLabel(m)+'</option>'}).join("")}
function commNet(b){var c=commission(b);return S.cfg.commIncVat?c/(1+vatR()):c}
function ownersList(){var o={};S.props.forEach(function(p){if(p.owner)o[p.owner]=1});return Object.keys(o)}
function today(){return iso(new Date())}
function delBtn(act,id,label){
  return S.confirmDel===id?'<button class="btn danger sm" data-act="'+act+'" data-id="'+id+'">מחק סופית</button><button class="btn sm" data-act="noDel">השאר</button>':'<button class="btn sm" data-act="askDel" data-id="'+id+'">'+(label||'מחק')+'</button>';
}
function copyText(t){
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){toast("הועתק")},function(){toast("ההעתקה נחסמה בדפדפן")});
  else toast("ההעתקה אינה זמינה בדפדפן הזה");
}

/* ---------- pricelist ---------- */
function mountPrice(v){
  var ci=nextFriday();
  v.innerHTML='<div class="stack">'
   +'<div class="panel stack"><div><h2>עונות ומקדמי מחיר</h2><div class="meta">כל עונה מעלה או מורידה את מחיר הנכסים באחוזים בטווח תאריכים. המחיר בהזמנה החדשה מחושב לפי העונות האלה. אותם תאריכים שבהם יש ביקוש חריג (לדוגמה ל״ג בעומר) מוסיפים כאן.</div></div>'
   +'<div class="grid2"><label>שם העונה<input id="s_name" placeholder="לדוגמה: ל״ג בעומר"></label>'
   +'<label>מתאריך<input id="s_from" type="date" value="'+ci+'"></label>'
   +'<label>עד תאריך<input id="s_to" type="date" value="'+addDays(ci,2)+'"></label>'
   +'<label>שינוי במחיר באחוזים (מינוס להנחה)<input id="s_pct" type="number" value="30" inputmode="numeric"></label></div>'
   +'<div class="row"><button class="btn primary" data-act="addSeason">הוסף עונה</button></div><div class="list" id="pr_seasons"></div></div>'
   +'<div class="panel stack"><h2>מחשבון מחיר להזמנה</h2><div class="grid2">'
   +'<label>נכס<select id="c_prop"></select></label><label>כניסה<input id="c_in" type="date" value="'+ci+'"></label><label>יציאה<input id="c_out" type="date" value="'+addDays(ci,2)+'"></label></div>'
   +'<div id="pr_calc"></div></div>'
   +'<div class="panel stack"><h2>מחירון נכסים לפי עונה</h2><div class="scroll" id="pr_table"></div></div>'
   +'<div class="panel stack"><h2>תחשיב הפוך: כמה לגבות כדי שבעל הדירה יקבל סכום מסוים</h2><div class="grid2">'
   +'<label>הסכום שבעל הדירה רוצה לקבל ללילה (₪)<input id="r_net" type="number" value="800" inputmode="numeric"></label>'
   +'<label>אחוז עמלה<input id="r_pct" type="number" value="15" step="0.5" inputmode="numeric"></label></div><div id="pr_rev"></div></div></div>';
  ["c_prop","c_in","c_out"].forEach(function(id){$(id).addEventListener("input",updPrice)});
  ["r_net","r_pct"].forEach(function(id){$(id).addEventListener("input",updPrice)});
  updPrice();
}
/* ---------- invoices + accounting settings ---------- */
function mountInv(v){
  v.innerHTML='<div class="stack"><div class="panel stack"><div><h2>חשבוניות עמלה לבעלי נכסים</h2><div class="meta">מפיקים טיוטה מההזמנות שהסתיימו או שהאורחים כבר נכנסו אליהן, ולא נכללו עדיין בחשבונית אחרת. חשבונית מס רשמית מוציאים בתוכנת הנהלת החשבונות של רואה החשבון. כאן נשמר המעקב והסכומים.</div></div>'
   +'<div class="grid2"><label>בעל נכס<select id="v_owner"></select></label><label>חודש (לפי תאריך כניסה)<select id="v_month"></select></label></div>'
   +'<div class="row"><button class="btn primary" data-act="genInv">הפק טיוטת חשבונית</button></div></div>'
   +'<div class="list" id="v_list"></div>'
   +'<div class="panel stack"><h2>הגדרות חשבונאות</h2><div class="grid2">'
   +'<label>שם החברה<input id="g_co" value="'+esc(S.cfg.company)+'"></label>'
   +'<label>מע״מ באחוזים<input id="g_vat" type="number" step="0.5" value="'+S.cfg.vat+'"></label>'
   +'<label>עלויות מעביד מעל השכר הברוטו, באחוזים (הערכה)<input id="g_on" type="number" step="0.5" value="'+S.cfg.oncost+'"></label></div>'
   +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="g_inc" style="width:auto"'+(S.cfg.commIncVat?' checked':'')+'> אחוז העמלה כבר כולל מע״מ</label>'
   +'<div class="row"><button class="btn primary" data-act="saveCfg">שמור הגדרות</button></div>'
   +'<div class="note">שיעור המע״מ ואחוז עלויות המעביד הם ערכי התחלה שניתנים לשינוי. יש לאמת אותם מול רואה החשבון.</div></div></div>';
  updInv();
}
function updInv(){
  if(!$("v_list"))return;
  var os=$("v_owner"),ov=os.value,ms=$("v_month"),mv=ms.value||iso(new Date()).slice(0,7);
  os.innerHTML=ownersList().map(function(o){return '<option'+(o===ov?' selected':'')+'>'+esc(o)+'</option>'}).join("")||'<option value="">אין בעלי נכסים</option>';
  ms.innerHTML=monthOpts(mv,false);
  var inv=S.invoices.slice().sort(function(a,b){return b.num-a.num});
  if(!inv.length){$("v_list").innerHTML='<div class="panel empty">חשבוניות שתפיק יופיעו כאן.</div>';return}
  var ST={draft:["טיוטה","warn"],sent:["נשלחה",""],paid:["שולמה","ok"]};
  $("v_list").innerHTML=inv.map(function(i){
    var st=ST[i.status]||ST.draft,nx=i.status==="draft"?"sent":i.status==="sent"?"paid":null;
    return '<div class="panel stack"><div class="row between"><div class="info"><h3>חשבונית מספר '+i.num+' · '+esc(i.owner)+'</h3><div class="meta">'+esc(mLabel(i.month))+' · '+i.lines.length+' הזמנות · הופקה '+fmt(i.date)+'</div></div><span class="pill '+st[1]+'">'+st[0]+'</span></div>'
     +'<div class="stats"><div class="stat"><b>'+money(i.net)+'</b><span>לפני מע״מ</span></div><div class="stat"><b>'+money(i.vat)+'</b><span>מע״מ</span></div><div class="stat"><b>'+money(i.total)+'</b><span>סך הכל לתשלום</span></div></div>'
     +'<div class="row">'+(nx?'<button class="btn primary sm" data-act="invNext" data-id="'+i.id+'">'+(nx==="sent"?'סמן כנשלחה':'סמן כשולמה')+'</button>':'')
     +'<button class="btn sm" data-act="copyInv" data-id="'+i.id+'">העתק כטקסט</button>'
     +(i.status!=="paid"?delBtn("cancelInv",i.id,"בטל חשבונית"):'')+'</div></div>';
  }).join("");
}
function invText(i){
  return (S.cfg.company||"חברת הזמנות מירון")+"\nחשבונית עמלה מספר "+i.num+" · "+i.date+"\nלכבוד: "+i.owner+"\nתקופה: "+mLabel(i.month)+"\n\n"
   +i.lines.map(function(l){return l.desc+": עמלה "+Math.round(l.comm)+" ₪"}).join("\n")
   +"\n\nסכום לפני מע״מ: "+Math.round(i.net)+" ₪\nמע״מ: "+Math.round(i.vat)+" ₪\nסך הכל: "+Math.round(i.total)+" ₪";
}

/* ---------- expenses ---------- */
function mountExp(v){
  v.innerHTML='<div class="stack"><div class="panel stack"><h2>הוצאות החברה</h2><div class="grid2">'
   +'<label>תאריך<input id="e_date" type="date" value="'+today()+'"></label>'
   +'<label>קטגוריה<select id="e_cat">'+CATS.map(function(c){return '<option>'+c+'</option>'}).join("")+'</select></label>'
   +'<label>תיאור<input id="e_desc"></label>'
   +'<label>סכום ששולם (₪)<input id="e_amt" type="number" min="0" inputmode="numeric"></label></div>'
   +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="e_vat" style="width:auto" checked> הסכום כולל מע״מ שניתן לקזז (יש חשבונית מס)</label>'
   +'<div class="row"><button class="btn primary" data-act="addExp">הוסף הוצאה</button></div></div>'
   +'<div class="panel stack"><div class="row between"><h2>רשימת הוצאות</h2><label style="min-width:180px">חודש<select id="e_m"></select></label></div><div class="stats" id="e_sum"></div><div class="scroll" id="e_list"></div></div></div>';
  $("e_m").addEventListener("change",function(){S.month=$("e_m").value;updExp()});
  updExp();
}
function updExp(){
  if(!$("e_list"))return;
  $("e_m").innerHTML=monthOpts(S.month,true);
  var l=S.expenses.filter(function(e){return S.month==="all"||e.date.slice(0,7)===S.month}).sort(function(a,b){return a.date<b.date?1:-1});
  var tot=0,vin=0,by={};
  l.forEach(function(e){tot+=e.amount;var net=e.vat?e.amount/(1+vatR()):e.amount;vin+=e.amount-net;by[e.cat]=(by[e.cat]||0)+net});
  $("e_sum").innerHTML='<div class="stat"><b>'+money(tot)+'</b><span>סך ההוצאות ששולמו</span></div><div class="stat"><b>'+money(tot-vin)+'</b><span>לפני מע״מ</span></div><div class="stat"><b>'+money(vin)+'</b><span>מע״מ לקיזוז</span></div>';
  $("e_list").innerHTML=l.length?'<table><thead><tr><th>תאריך</th><th>קטגוריה</th><th>תיאור</th><th class="num">סכום</th><th></th></tr></thead><tbody>'
   +l.map(function(e){return '<tr><td>'+fmt(e.date)+'</td><td>'+esc(e.cat)+'</td><td>'+esc(e.desc)+(e.vat?'':' <span class="pill">ללא מע״מ</span>')+'</td><td class="num">'+money(e.amount)+'</td><td>'+delBtn("delExp",e.id)+'</td></tr>'}).join("")+'</tbody></table>':'<div class="empty">אין הוצאות בתקופה הזו.</div>';
}

/* ---------- payroll ---------- */
function mountPay(v){
  if(!S.payMonth)S.payMonth=iso(new Date()).slice(0,7);
  v.innerHTML='<div class="stack"><div class="panel stack"><div><h2>עובדים</h2><div class="meta">נציגים טלפוניים, תפעול, סדרנים. שכר חודשי קבוע או שכר לשעה.</div></div><div class="grid2">'
   +'<label>שם<input id="m_name"></label><label>תפקיד<input id="m_role" placeholder="נציג טלפוני"></label>'
   +'<label>סוג שכר<select id="m_kind"><option value="monthly">חודשי</option><option value="hourly">לשעה</option></select></label>'
   +'<label>שכר חודשי או תעריף לשעה (₪)<input id="m_rate" type="number" min="0" inputmode="numeric"></label></div>'
   +'<div class="row"><button class="btn primary" data-act="addEmp">הוסף עובד</button></div><div class="list" id="emp_l"></div></div>'
   +'<div class="panel stack"><div class="row between"><h2>משכורות לחודש</h2><label style="min-width:180px">חודש<select id="pay_m"></select></label></div><div class="scroll" id="pay_t"></div>'
   +'<div class="note">זו הערכת עלות לחברה לפי אחוז עלויות המעביד שבהגדרות, ולא תלוש שכר. חישוב מס, ביטוח לאומי ופנסיה נעשה אצל רואה החשבון או מנהל השכר.</div></div></div>';
  $("pay_m").addEventListener("change",function(){S.payMonth=$("pay_m").value;updPay()});
  $("pay_t").addEventListener("input",function(e){var tr=e.target.closest("tr");if(tr&&tr.dataset.emp)calcRow(tr)});
  updPay();
}
function rowVals(tr){
  var e=S.emps.filter(function(x){return x.id===tr.dataset.emp})[0];if(!e)return null;
  var h=tr.querySelector(".p-h"),b=tr.querySelector(".p-b");
  var base=e.kind==="hourly"?(+(h&&h.value)||0)*e.rate:e.rate, bonus=+(b&&b.value)||0, gross=base+bonus;
  return {base:base,bonus:bonus,gross:gross,cost:gross*(1+(+S.cfg.oncost||0)/100),hours:+(h&&h.value)||0};
}
function calcRow(tr){var r=rowVals(tr);if(!r)return;tr.querySelector(".p-g").textContent=money(r.gross);tr.querySelector(".p-c").textContent=money(r.cost)}
function updPay(){
  if(!$("pay_t"))return;
  $("pay_m").innerHTML=monthOpts(S.payMonth,false);
  $("emp_l").innerHTML=S.emps.length?S.emps.map(function(e){return '<div class="opt"><div class="info"><h3>'+esc(e.name)+'</h3><div class="meta">'+esc(e.role||"")+' · '+(e.kind==="hourly"?money(e.rate)+' לשעה':money(e.rate)+' לחודש')+'</div></div><div class="row">'+delBtn("delEmp",e.id)+'</div></div>'}).join(""):'<div class="meta">עדיין לא הוזנו עובדים.</div>';
  if(!S.emps.length){$("pay_t").innerHTML='<div class="empty">הוסף עובד כדי לחשב משכורת.</div>';return}
  var tot=0,cost=0;
  var rows=S.emps.map(function(e){
    var d=S.payroll.filter(function(x){return x.id===S.payMonth+"_"+e.id})[0]||{};
    var hours=d.hours||0,bonus=d.bonus||0,base=e.kind==="hourly"?hours*e.rate:e.rate,gross=base+bonus,c=gross*(1+(+S.cfg.oncost||0)/100);
    tot+=gross;cost+=c;
    return '<tr data-emp="'+e.id+'"><td>'+esc(e.name)+'<div class="meta">'+(e.kind==="hourly"?'לשעה':'חודשי')+'</div></td>'
     +'<td>'+(e.kind==="hourly"?'<input class="p-h" type="number" min="0" step="0.5" value="'+hours+'" style="width:90px">':'—')+'</td>'
     +'<td><input class="p-b" type="number" min="0" value="'+bonus+'" style="width:100px"></td>'
     +'<td class="num p-g">'+money(gross)+'</td><td class="num p-c">'+money(c)+'</td>'
     +'<td><label style="flex-direction:row;align-items:center;gap:6px"><input class="p-p" type="checkbox" style="width:auto"'+(d.paid?' checked':'')+'> שולם</label></td>'
     +'<td><button class="btn primary sm" data-act="savePay" data-id="'+e.id+'">שמור</button>'+(d.id?' <span class="pill ok">נשמר</span>':'')+'</td></tr>';
  }).join("");
  $("pay_t").innerHTML='<table><thead><tr><th>עובד</th><th>שעות</th><th>בונוס (₪)</th><th class="num">ברוטו</th><th class="num">עלות לחברה</th><th>תשלום</th><th></th></tr></thead><tbody>'+rows
   +'</tbody><tfoot><tr><td><b>סה״כ</b></td><td></td><td></td><td class="num"><b>'+money(tot)+'</b></td><td class="num"><b>'+money(cost)+'</b></td><td></td><td></td></tr></tfoot></table>';
}

/* ---------- profit & loss ---------- */
function mountPL(v){
  v.innerHTML='<div class="stack"><div class="panel stack"><div class="row between"><div><h2>רווח והפסד</h2><div class="meta">הכנסה היא עמלת החברה מהזמנות שלא בוטלו, לפי חודש הכניסה. כל הסכומים לפני מע״מ.</div></div><label style="min-width:180px">תקופה<select id="l_m"></select></label></div><div class="stats" id="l_s"></div></div>'
   +'<div class="panel stack"><h2>מע״מ</h2><div class="stats" id="l_v"></div></div>'
   +'<div class="panel stack"><h2>נקודת איזון</h2><div id="l_b"></div></div>'
   +'<div class="panel stack"><h2>רווחיות לפי נכס</h2><div class="scroll" id="l_p"></div></div>'
   +'<div class="panel stack"><h2>הוצאות לפי קטגוריה</h2><div class="scroll" id="l_c"></div></div></div>';
  $("l_m").addEventListener("change",function(){S.month=$("l_m").value;updPL()});
  updPL();
}
/* ---------- actions for management tabs ---------- */
function actX(a,id,el){
  if(actY(a,id,el))return true;
  if(a==="addSeason"){
    var nm=val("s_name").trim(),f=val("s_from"),t=val("s_to");
    if(!nm||!f||!t||t<f){toast("מלא שם ותאריכים תקינים");return true}
    save("seasons",newId("seasons"),{name:nm,from:f,to:t,pct:+val("s_pct")||0},"העונה נוספה");$("s_name").value="";return true;
  }
  if(a==="delSeason"){S.confirmDel=null;del("seasons",id);return true}
  if(a==="saveCfg"){
    var c={company:val("g_co").trim(),vat:+val("g_vat")||0,oncost:+val("g_on")||0,commIncVat:$("g_inc").checked,nextInv:S.cfg.nextInv||1};
    save("settings","main",c,"ההגדרות נשמרו");return true;
  }
  if(a==="genInv"){
    var owner=val("v_owner"),month=val("v_month");
    if(!owner){toast("אין בעל נכס לבחירה");return true}
    var ids={};S.props.forEach(function(p){if(p.owner===owner)ids[p.id]=1});
    var bs=S.bookings.filter(function(b){return ids[b.propId]&&!b.invId&&(b.status==="done"||b.status==="in")&&b.in.slice(0,7)===month});
    if(!bs.length){toast("אין הזמנות שהסתיימו וטרם נכללו בחשבונית לבעל הנכס בחודש הזה");return true}
    var net=0,total=0,lines=bs.map(function(b){var p=propById(b.propId),c=commission(b);return {bid:b.id,comm:c,desc:(p?p.name:"נכס")+" · "+b.name+" · "+fmt(b.in)}});
    bs.forEach(function(b){var c=commission(b);if(S.cfg.commIncVat){total+=c;net+=c/(1+vatR())}else{net+=c;total+=c*(1+vatR())}});
    var iid=newId("invoices"),num=S.cfg.nextInv||1;
    save("invoices",iid,{num:num,owner:owner,month:month,date:today(),lines:lines,net:Math.round(net),vat:Math.round(total-net),total:Math.round(total),status:"draft"}).then(function(){
      return Promise.all(bs.map(function(b){return save("bookings",b.id,Object.assign({},b.raw,{invId:iid}))}));
    }).then(function(){return save("settings","main",Object.assign({},S.cfg,{nextInv:num+1}),"החשבונית "+num+" נוצרה")});
    return true;
  }
  if(a==="invNext"){var i=S.invoices.filter(function(x){return x.id===id})[0];if(i)save("invoices",id,Object.assign({},i.raw,{status:i.status==="draft"?"sent":"paid"}),"הסטטוס עודכן");return true}
  if(a==="copyInv"){var i2=S.invoices.filter(function(x){return x.id===id})[0];if(i2)copyText(invText(i2));return true}
  if(a==="cancelInv"){
    S.confirmDel=null;var i3=S.invoices.filter(function(x){return x.id===id})[0];if(!i3)return true;
    Promise.all(i3.lines.map(function(l){var b=S.bookings.filter(function(x){return x.id===l.bid})[0];if(!b)return null;var r=Object.assign({},b.raw);delete r.invId;return save("bookings",b.id,r)}))
      .then(function(){return del("invoices",id)});
    return true;
  }
  if(a==="addExp"){
    var amt=+val("e_amt"),d=val("e_desc").trim();
    if(!(amt>0)||!d||!val("e_date")){toast("מלא תאריך, תיאור וסכום");return true}
    save("expenses",newId("expenses"),{date:val("e_date"),cat:val("e_cat"),desc:d,amount:amt,vat:$("e_vat").checked},"ההוצאה נרשמה");
    $("e_desc").value="";$("e_amt").value="";return true;
  }
  if(a==="delExp"){S.confirmDel=null;del("expenses",id);return true}
  if(a==="addEmp"){
    var n=val("m_name").trim(),rate=+val("m_rate");
    if(!n||!(rate>0)){toast("מלא שם ושכר");return true}
    save("employees",newId("employees"),{name:n,role:val("m_role").trim(),kind:val("m_kind"),rate:rate},"העובד נוסף");$("m_name").value="";$("m_rate").value="";return true;
  }
  if(a==="delEmp"){S.confirmDel=null;del("employees",id);return true}
  if(a==="savePay"){
    var tr=el.closest("tr"),r=rowVals(tr);if(!r)return true;
    save("payroll",S.payMonth+"_"+id,{month:S.payMonth,empId:id,hours:r.hours,bonus:r.bonus,base:r.base,gross:r.gross,cost:r.cost,paid:tr.querySelector(".p-p").checked},"המשכורת נשמרה");return true;
  }
  return false;
}

/* ---------- houses, units, costs ---------- */
var SOURCES=["טלפון (קו ישיר)","וואטסאפ","מודעה בעיתון","שלט או פלאייר","המלצה","לקוח חוזר","אחר"];
var BILLTYPES=["חשמל","מים","ארנונה","גז","אינטרנט","ועד בית","אחר"];
function unitsOf(h){
  var us=S.units.filter(function(u){return u.houseId===h.id&&u.active!==false});
  if(us.length)return us;
  return [{id:h.id,houseId:h.id,name:"",beds:h.beds,rooms:h.rooms,price:h.price,shabbatPrice:h.shabbatPrice,virtual:true}];
}
function bookables(){
  var out=[];
  S.props.forEach(function(h){
    if(h.active===false)return;
    unitsOf(h).forEach(function(u){
      out.push(Object.assign({},u,{id:u.id,houseId:h.id,houseName:h.name,area:h.area,notes:u.notes||h.notes,pct:h.pct,mode:h.mode,owner:h.owner,name:u.name?h.name+" · "+u.name:h.name}));
    });
  });
  return out;
}
function unitById(id){return bookables().filter(function(u){return u.id===id})[0]}
function unitLabel(b){var u=unitById(b.unitId||b.propId);if(u)return u.name;var h=propById(b.propId);return h?h.name:"נכס שנמחק"}
function bUnit(b){return b.unitId||b.propId}
function isFree(p,ci,co,ignoreId){
  if(p.active===false)return false;
  return !S.bookings.some(function(b){return bUnit(b)===p.id&&b.status!=="cancelled"&&b.id!==ignoreId&&overlap(ci,co,b.in,b.out)});
}
function houseOpts(sel,all){return (all?'<option value="">כל הבתים</option>':'')+S.props.map(function(h){return '<option value="'+h.id+'"'+(h.id===sel?' selected':'')+'>'+esc(h.name)+'</option>'}).join("")}
function fillHouses(id,all){var el=$(id);if(el)el.innerHTML=houseOpts(el.value,all)}
function prevMonth(m){var d=parse(m+"-01");d.setMonth(d.getMonth()-1);return iso(d).slice(0,7)}
function extraCosts(month){
  var out=[];function ok(m){return month==="all"||m===month}
  S.bills.forEach(function(b){if(b.paidBy==="company"&&b.paid&&ok(b.period))out.push({cat:"חשבונות נכס",amount:b.amount||0,chg:!!b.chargeOwner,houseId:b.houseId,date:b.period+"-01",desc:b.type+" "+b.period})});
  S.tasks.forEach(function(t){if(t.status==="done"&&t.cost>0&&ok((t.date||"").slice(0,7)))out.push({cat:"תחזוקה",amount:t.cost,chg:!!t.chargeOwner,houseId:t.houseId,date:t.date,desc:t.title})});
  S.cleans.forEach(function(c){if(c.done&&c.cost>0&&ok((c.date||"").slice(0,7)))out.push({cat:"ניקיון",amount:c.cost,chg:false,houseId:c.houseId,date:c.date,desc:"ניקיון אחרי יציאה"})});
  S.ads.forEach(function(a){if(a.cost>0&&ok((a.start||"").slice(0,7)))out.push({cat:"שיווק ופרסום",amount:a.cost,chg:false,houseId:a.houseId||"",date:a.start,desc:a.channel+(a.name?" · "+a.name:"")})});
  return out;
}

/* ---------- intake (units) ---------- */
function updIntake(){
  if(!$("i_res"))return;
  var ci=$("i_in").value, co=$("i_out").value, g=+$("i_g").value||1, n=nights(ci,co);
  $("i_dates").textContent=n>0?(n+" לילות · "+heb(ci)+" עד "+heb(co)):"תאריך היציאה צריך להיות אחרי הכניסה";
  if(!S.ready){$("i_res").innerHTML='<div class="empty">טוען…</div>';return}
  if(!S.props.length){$("i_res").innerHTML='<div class="empty">עדיין אין בתי אירוח במערכת. <button class="btn primary sm" data-tab="props">הוסף בית ראשון</button></div>';return}
  if(n<=0){$("i_res").innerHTML="";return}
  var all=bookables().filter(function(p){return isFree(p,ci,co)});
  var fit=all.filter(function(p){return (p.beds||0)>=g});
  var small=all.filter(function(p){return (p.beds||0)<g});
  function card(p){
    return '<div class="opt'+(S.selId===p.id?' sel':'')+'"><div class="info"><h3>'+esc(p.name)+'</h3>'
     +'<div class="meta">'+esc(p.area||"")+' · '+(p.beds||0)+' מיטות · '+(p.rooms||0)+' חדרים'+(p.notes?' · '+esc(p.notes):'')+'</div></div>'
     +'<div class="row"><b>'+money(estimate(p,ci,co))+'</b><button class="btn primary sm" data-act="pick" data-id="'+p.id+'">בחר</button></div></div>';
  }
  var h=fit.length?fit.map(card).join(""):'<div class="empty">אין יחידה פנויה שמתאימה ל־'+g+' אורחים בתאריכים האלה.</div>';
  if(small.length)h+='<div class="meta">פנויות אבל קטנות מדי ('+small.length+'): '+small.map(function(p){return esc(p.name)+' ('+p.beds+')'}).join(", ")+'</div>';
  $("i_res").innerHTML=h;
  var w=$("i_wait");
  if(!fit.length){
    if(!w.dataset.on){w.dataset.on="1";w.hidden=false;
      w.innerHTML='<h2>רשימת המתנה</h2><div class="meta">הלקוח ביקש תאריכים שאין בהם מקום. רושמים את הפנייה כדי לדעת כמה ביקוש לא נענה ולהתקשר אליו אם יתפנה.</div><div class="grid2"><label>שם<input id="l_name"></label><label>טלפון<input id="l_phone" type="tel" dir="ltr" style="text-align:right"></label></div><div class="row"><button class="btn" data-act="lead">רשום ברשימת המתנה</button></div>'}
  }else if(w.dataset.on){w.dataset.on="";w.hidden=true;w.innerHTML=""}
  if(S.selId&&!all.some(function(p){return p.id===S.selId})){S.selId=null;$("i_book").hidden=true}
}
function openBookForm(unitId){
  var p=unitById(unitId);if(!p)return;
  S.selId=unitId;updIntake();
  var ci=$("i_in").value, co=$("i_out").value, est=estimate(p,ci,co);
  var box=$("i_book");box.hidden=false;
  box.innerHTML='<h2>פרטי ההזמנה: '+esc(p.name)+'</h2>'
   +'<div class="meta">'+fmt(ci)+' עד '+fmt(co)+' · עמלה '+p.pct+'%'+(p.mode==="exclusive"?' (בלעדי)':'')+'</div>'
   +'<div class="grid2">'
   +'<label>שם האורח<input id="b_name" autocomplete="off"></label>'
   +'<label>טלפון<input id="b_phone" type="tel" inputmode="tel" dir="ltr" style="text-align:right"></label>'
   +'<label>סכום כולל (₪)<input id="b_total" type="number" min="0" inputmode="numeric" value="'+est+'"></label>'
   +'<label>מקדמה ששולמה (₪)<input id="b_dep" type="number" min="0" inputmode="numeric" value="0"></label>'
   +'<label>איך הגיע אלינו<select id="b_src">'+SOURCES.map(function(s){return '<option>'+s+'</option>'}).join("")+'</select></label>'
   +'</div><label>הערות (בקשות מיוחדות, שעת הגעה)<textarea id="b_notes"></textarea></label>'
   +'<div class="row"><button class="btn primary" data-act="saveBooking">שמור הזמנה</button><button class="btn" data-act="cancelPick">ביטול</button></div>';
  box.scrollIntoView({behavior:"smooth",block:"nearest"});
  $("b_name").focus();
}

/* ---------- weekend calendar (units) ---------- */
function updCal(){
  if(!$("cal_t"))return;
  var bk=bookables();
  if(!bk.length){$("cal_t").innerHTML='<div class="empty">אין יחידות להצגה. הוסף בתים בלשונית “בתים ויחידות”.</div>';return}
  var fr=calFridays();
  var h='<table><thead><tr><th>יחידה</th>'+fr.map(function(f){return '<th>'+fmt(f)+'<br><span class="meta">'+heb(f)+'</span></th>'}).join("")+'</tr></thead><tbody>';
  bk.forEach(function(p){
    h+='<tr><td><b>'+esc(p.name)+'</b><div class="meta">'+(p.beds||0)+' מיטות</div></td>';
    fr.forEach(function(f){
      var sun=addDays(f,2);
      var bs=S.bookings.filter(function(b){return bUnit(b)===p.id&&b.status!=="cancelled"&&overlap(f,sun,b.in,b.out)});
      if(!bs.length)h+='<td><button class="cell free" data-act="calBook" data-id="'+p.id+'|'+f+'">פנוי</button></td>';
      else{var full=bs.some(function(b){return b.in<=f&&b.out>=sun});h+='<td><div class="cell '+(full?'busy':'part')+'">'+esc(bs[0].name)+'</div></td>'}
    });
    h+='</tr>';
  });
  $("cal_t").innerHTML=h+'</tbody></table>';
}

/* ---------- monthly occupancy ---------- */
function monthBase(){var d=new Date();d.setDate(1);d.setMonth(d.getMonth()+S.mOff);return d}
function mountMonth(v){
  v.innerHTML='<div class="panel stack"><div class="row between"><div><h2 id="mo_h">תפוסה חודשית</h2><div class="meta">כל עמודה היא לילה. אדום תפוס, כתום ממתין לאישור, ירוק פנוי ולחיץ להזמנה.</div></div><div class="row"><button class="btn sm" data-act="mPrev">חודש קודם</button><button class="btn sm" data-act="mNext">חודש הבא</button></div></div><div class="scroll" id="mo_t"></div></div>';
  updMonth();
}
function updMonth(){
  if(!$("mo_t"))return;
  var b0=monthBase(),y=b0.getFullYear(),m=b0.getMonth(),days=new Date(y,m+1,0).getDate(),bk=bookables();
  $("mo_h").textContent="תפוסה חודשית · "+b0.toLocaleDateString("he-IL",{month:"long",year:"numeric"});
  if(!bk.length){$("mo_t").innerHTML='<div class="empty">אין יחידות להצגה.</div>';return}
  var ds=[];for(var i=1;i<=days;i++)ds.push(y+"-"+String(m+1).padStart(2,"0")+"-"+String(i).padStart(2,"0"));
  var h='<table style="min-width:0"><thead><tr><th>יחידה</th>'+ds.map(function(d){var w=parse(d).getDay();return '<th class="dh'+(w===5||w===6?' we':'')+'">'+parse(d).getDate()+'</th>'}).join("")+'</tr></thead><tbody>';
  var busyCount=ds.map(function(){return 0});
  bk.forEach(function(u){
    h+='<tr><td style="white-space:nowrap">'+esc(u.name)+'</td>';
    ds.forEach(function(d,ix){
      var b=S.bookings.filter(function(x){return bUnit(x)===u.id&&x.status!=="cancelled"&&x.in<=d&&d<x.out})[0];
      if(b){busyCount[ix]++;h+='<td style="padding:2px"><div class="dcell '+(b.status==="pending"?'part':'busy')+'" title="'+esc(b.name)+'"></div></td>'}
      else h+='<td style="padding:2px"><button class="dcell free" data-act="mBook" data-id="'+u.id+'|'+d+'" title="פנוי"></button></td>';
    });
    h+='</tr>';
  });
  h+='<tr><td><b>תפוסה</b></td>'+busyCount.map(function(c){return '<td class="dh">'+Math.round(c/bk.length*100)+'%</td>'}).join("")+'</tr>';
  $("mo_t").innerHTML=h+'</tbody></table>';
}

/* ---------- houses & units panel ---------- */
function updUnits(){
  var box=$("p_units");if(!box)return;
  if(!box.dataset.built){
    box.dataset.built="1";
    box.innerHTML='<div><h2>יחידות השכרה בבית</h2><div class="meta">בית אירוח יכול לכלול כמה יחידות (דירה, סטודיו, חדר), ולכל אחת מחיר, מיטות ויומן זמינות משלה. בית בלי יחידות מוגדרות נחשב יחידה אחת.</div></div>'
     +'<div class="grid2"><label>בית<select id="u_house"></select></label><label>שם היחידה<input id="u_name" placeholder="לדוגמה: יחידה קומה א"></label>'
     +'<label>מיטות<input id="u_beds" type="number" min="1" value="4"></label><label>חדרים<input id="u_rooms" type="number" min="1" value="2"></label>'
     +'<label>מחיר ללילה (₪)<input id="u_price" type="number" min="0" value="700"></label><label>חבילת שבת (₪)<input id="u_sp" type="number" min="0" value="1800"></label></div>'
     +'<div class="row"><button class="btn primary" data-act="addUnit">הוסף יחידה</button></div><div class="list" id="u_list"></div>';
  }
  fillHouses("u_house");
  var rows=S.props.map(function(h){
    var us=S.units.filter(function(u){return u.houseId===h.id});
    if(!us.length)return '';
    return '<div class="stack"><h3>'+esc(h.name)+'</h3>'+us.map(function(u){return '<div class="opt"><div class="info"><b>'+esc(u.name)+'</b><div class="meta">'+u.beds+' מיטות · '+u.rooms+' חדרים · '+money(u.price)+' ללילה · חבילת שבת '+money(u.shabbatPrice)+'</div></div><div class="row">'+delBtn("delUnit",u.id)+'</div></div>'}).join("")+'</div>';
  }).join("");
  $("u_list").innerHTML=rows||'<div class="meta">עדיין אין יחידות נפרדות. כל בית מוצג כיחידה אחת.</div>';
}

/* ---------- pricelist calculator (units) ---------- */
function updPrice(){
  if(!$("pr_seasons"))return;
  var cp=$("c_prop"),keep=cp.value,bk=bookables();
  cp.innerHTML=bk.map(function(p){return '<option value="'+p.id+'"'+(p.id===keep?' selected':'')+'>'+esc(p.name)+'</option>'}).join("")||'<option value="">אין יחידות</option>';
  var ss=S.seasons.slice().sort(function(a,b){return a.from<b.from?-1:1});
  $("pr_seasons").innerHTML=ss.length?ss.map(function(s){
    return '<div class="opt"><div class="info"><h3>'+esc(s.name)+' <span class="pill '+(s.pct>=0?'warn':'ok')+'">'+(s.pct>0?'+':'')+s.pct+'%</span></h3><div class="meta">'+fmt(s.from)+' עד '+fmt(s.to)+'</div></div><div class="row">'+delBtn("delSeason",s.id)+'</div></div>'}).join(""):'<div class="meta">עדיין לא הוגדרו עונות. המחיר קבוע כל השנה.</div>';
  var p=unitById(cp.value),ci=$("c_in").value,co=$("c_out").value,n=nights(ci,co),h="";
  if(!p)h='<div class="empty">הוסף בית אירוח כדי לחשב מחיר.</div>';
  else if(n<=0)h='<div class="meta">תאריך היציאה צריך להיות אחרי הכניסה.</div>';
  else{
    var rows="",sum=0;
    for(var i=0;i<n;i++){var d=addDays(ci,i),m=mult(d),pr=Math.round((p.price||0)*m),se=seasonOf(d);sum+=pr;
      rows+='<tr><td>'+fmt(d)+'</td><td>'+(se?esc(se.name):'רגיל')+'</td><td class="num">'+money(pr)+'</td></tr>'}
    var total=estimate(p,ci,co),pkg=(p.shabbatPrice&&n===2&&parse(ci).getDay()===5),comm=Math.round(total*p.pct/100);
    h='<div class="scroll"><table><thead><tr><th>לילה</th><th>עונה</th><th class="num">מחיר</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
     +'<div class="stats"><div class="stat"><b>'+money(total)+'</b><span>'+(pkg?'מחיר חבילת שבת (מוחל)':'סך הכל להזמנה')+'</span></div>'
     +'<div class="stat"><b>'+money(comm)+'</b><span>עמלת החברה ('+p.pct+'%)</span></div>'
     +'<div class="stat"><b>'+money(total-comm)+'</b><span>מגיע לבעל הבית</span></div>'
     +(pkg?'<div class="stat"><b>'+money(sum)+'</b><span>אילו חושב לפי לילות</span></div>':'')+'</div>';
  }
  $("pr_calc").innerHTML=h;
  $("pr_table").innerHTML=bk.length?'<table><thead><tr><th>יחידה</th><th class="num">בסיס ללילה</th><th class="num">חבילת שבת</th>'
    +ss.map(function(s){return '<th class="num">'+esc(s.name)+'<br>'+(s.pct>0?'+':'')+s.pct+'%</th>'}).join("")+'</tr></thead><tbody>'
    +bk.map(function(p){return '<tr><td>'+esc(p.name)+'</td><td class="num">'+money(p.price)+'</td><td class="num">'+money(p.shabbatPrice)+'</td>'
      +ss.map(function(s){return '<td class="num">'+money((p.shabbatPrice||p.price)*(1+s.pct/100))+'</td>'}).join("")+'</tr>'}).join("")+'</tbody></table>'
    +'<div class="meta">בעמודות העונות מוצג מחיר חבילת שבת (או מחיר לילה כשאין חבילה) אחרי המקדם.</div>':'<div class="empty">אין יחידות.</div>';
  var net=+$("r_net").value||0,pc=+$("r_pct").value||0;
  $("pr_rev").innerHTML=pc>=100?'':'<div class="stats"><div class="stat"><b>'+money(net/(1-pc/100))+'</b><span>מחיר ללקוח ללילה</span></div><div class="stat"><b>'+money(net/(1-pc/100)-net)+'</b><span>עמלת החברה ללילה</span></div></div>'
    +'<div class="meta">העמלה מחושבת כאחוז מהמחיר שהלקוח משלם, כמו בהזמנות במערכת.</div>';
}

/* ---------- dashboard ---------- */
function occFrac(f,days){
  var bk=bookables();if(!bk.length)return 0;var c=0;
  for(var i=0;i<days;i++){var d=addDays(f,i);bk.forEach(function(u){if(S.bookings.some(function(b){return bUnit(b)===u.id&&b.status!=="cancelled"&&b.in<=d&&d<b.out}))c++})}
  return c/(bk.length*days);
}
function mountDash(v){
  v.innerHTML='<div class="stack"><div class="stats" id="d_s"></div><div class="panel stack"><h2>דורש טיפול</h2><div id="d_a"></div></div>'
   +'<div class="panel stack"><h2>תפוסה בסופי השבוע הקרובים</h2><div id="d_b"></div></div>'
   +'<div class="panel stack"><h2>כניסות ויציאות ב־7 הימים הקרובים</h2><div id="d_t"></div></div>'
   +'<div class="panel stack"><h2>עמלות החברה ב־6 החודשים האחרונים</h2><div id="d_r"></div></div></div>';
  updDash();
}
function updDash(){
  if(!$("d_s"))return;
  var t=today(),bk=bookables(),b0=new Date();b0.setDate(1);var f0=iso(b0),dm=new Date(b0.getFullYear(),b0.getMonth()+1,0).getDate();
  var fri=nextFriday(),cm=t.slice(0,7),pl=plCalc(cm);
  var pend=S.bookings.filter(function(b){return b.status==="pending"});
  var due=0;S.bookings.forEach(function(b){if((b.status==="pending"||b.status==="confirmed"||b.status==="in")&&b.out>=t)due+=Math.max(0,(b.total||0)-(b.dep||0))});
  var openTk=S.tasks.filter(function(x){return x.status!=="done"}).length;
  var leads30=S.leads.filter(function(l){return l.date>=addDays(t,-30)}).length;
  $("d_s").innerHTML=[["תפוסה החודש",Math.round(occFrac(f0,dm)*100)+"%"],["תפוסה בשבת הקרובה",Math.round(occFrac(fri,2)*100)+"%"],["ממתינות לאישור",pend.length],["יתרות לגבייה מאורחים",money(due)],["תקלות פתוחות",openTk],["ביקוש שלא נענה (30 יום)",leads30],["רווח החודש",money(pl.profit)],["יחידות להשכרה",bk.length]]
    .map(function(s){return '<div class="stat"><b>'+s[1]+'</b><span>'+s[0]+'</span></div>'}).join("");
  var al=[];
  if(pend.length)al.push(pend.length+" הזמנות ממתינות לאישור");
  S.bookings.forEach(function(b){if((b.status==="pending"||b.status==="confirmed")&&b.in>=t&&b.in<=addDays(t,3)&&(b.total||0)>(b.dep||0))al.push("בעוד ימים ספורים נכנסים "+b.name+" ויש יתרה לגבייה "+money(b.total-(b.dep||0)))});
  S.bills.forEach(function(b){if(!b.paid&&b.due&&b.due<=addDays(t,7)){var h=propById(b.houseId);al.push((b.due<t?"חשבון באיחור: ":"חשבון לתשלום: ")+b.type+" "+(h?h.name:"")+" "+money(b.amount))}});
  S.tasks.forEach(function(x){if(x.status!=="done"&&x.pri==="high"){var h=propById(x.houseId);al.push("תקלה דחופה: "+x.title+" "+(h?"· "+h.name:""))}});
  S.bookings.forEach(function(b){if(b.status!=="cancelled"&&b.out<=t&&b.out>=addDays(t,-7)){var c=S.cleans.filter(function(x){return x.id==="clean_"+b.id&&x.done})[0];if(!c)al.push("לא סומן ניקיון אחרי יציאה: "+unitLabel(b)+" "+fmt(b.out))}});
  if(S.invoices.some(function(i){return i.status==="draft"}))al.push("יש חשבוניות עמלה בטיוטה");
  $("d_a").innerHTML=al.length?al.slice(0,12).map(function(x){return '<div class="alert">'+esc(x)+'</div>'}).join(""):'<div class="meta">אין התראות כרגע.</div>';
  var wk="",i;for(i=0;i<8;i++){var f=addDays(fri,7*i),pc=Math.round(occFrac(f,2)*100);
    wk+='<div class="barrow"><span>'+fmt(f)+'</span><div class="barwrap"><div class="bar" style="width:'+pc+'%"></div></div><span>'+pc+'% תפוסה</span></div>'}
  $("d_b").innerHTML=bk.length?wk:'<div class="empty">הוסף בתים כדי לראות תפוסה.</div>';
  var ev=[];S.bookings.forEach(function(b){if(b.status==="cancelled")return;
    if(b.in>=t&&b.in<=addDays(t,7))ev.push({d:b.in,k:"כניסה",b:b});if(b.out>=t&&b.out<=addDays(t,7))ev.push({d:b.out,k:"יציאה",b:b})});
  ev.sort(function(a,b){return a.d<b.d?-1:1});
  $("d_t").innerHTML=ev.length?'<table><thead><tr><th>תאריך</th><th></th><th>יחידה</th><th>אורח</th><th>טלפון</th></tr></thead><tbody>'+ev.map(function(e){return '<tr><td>'+fmt(e.d)+'</td><td><span class="pill '+(e.k==="כניסה"?'ok':'warn')+'">'+e.k+'</span></td><td>'+esc(unitLabel(e.b))+'</td><td>'+esc(e.b.name)+'</td><td dir="ltr">'+esc(e.b.phone||"")+'</td></tr>'}).join("")+'</tbody></table>':'<div class="meta">אין כניסות או יציאות בשבוע הקרוב.</div>';
  var ms=[],mx=1;for(i=0;i<6;i++){var dd=new Date();dd.setDate(1);dd.setMonth(dd.getMonth()-i);var m=iso(dd).slice(0,7),r=plCalc(m).rev;ms.push([m,r]);if(r>mx)mx=r}
  $("d_r").innerHTML=ms.reverse().map(function(x){return '<div class="barrow"><span>'+mLabel(x[0])+'</span><div class="barwrap"><div class="bar" style="width:'+Math.round(x[1]/mx*100)+'%"></div></div><span>'+money(x[1])+'</span></div>'}).join("");
  if(window.MERON_X&&MERON_X.dashAlerts&&$("d_a"))MERON_X.dashAlerts($("d_a"));
}

/* ---------- advertising ---------- */
function mountAds(v){
  v.innerHTML='<div class="stack"><div class="panel stack"><div><h2>פרסום וקמפיינים</h2><div class="meta">רושמים כל הוצאת פרסום עם הערוץ שלה. בהזמנה נשאל מאיפה הלקוח הגיע, וכך רואים כמה עולה כל הזמנה ואיזה ערוץ משתלם. עלות הפרסום נכנסת לרווח והפסד, ואין צורך לרשום אותה שוב בהוצאות.</div></div>'
   +'<div class="grid2"><label>ערוץ<select id="a_ch">'+SOURCES.map(function(s){return '<option>'+s+'</option>'}).join("")+'</select></label><label>תיאור (שם מודעה או עיתון)<input id="a_name"></label>'
   +'<label>בית שמפרסמים (לא חובה)<select id="a_house"></select></label><label>עלות (₪)<input id="a_cost" type="number" min="0" inputmode="numeric"></label>'
   +'<label>התחלה<input id="a_start" type="date" value="'+today()+'"></label><label>סיום<input id="a_end" type="date"></label></div>'
   +'<div class="row"><button class="btn primary" data-act="addAd">הוסף פרסום</button></div></div>'
   +'<div class="panel stack"><h2>החזר השקעה לפי ערוץ</h2><div class="scroll" id="a_roi"></div></div><div class="list" id="a_list"></div></div>';
  updAds();
}
function updAds(){
  if(!$("a_list"))return;fillHouses("a_house",true);
  var rows=SOURCES.map(function(s){
    var sp=0;S.ads.forEach(function(a){if(a.channel===s)sp+=a.cost||0});
    var bs=S.bookings.filter(function(b){return b.status!=="cancelled"&&b.source===s}),rev=0;bs.forEach(function(b){rev+=commNet(b)});
    return {s:s,sp:sp,n:bs.length,rev:rev};
  }).filter(function(r){return r.sp>0||r.n>0});
  $("a_roi").innerHTML=rows.length?'<table><thead><tr><th>ערוץ</th><th class="num">הוצאה</th><th class="num">הזמנות</th><th class="num">עמלה שהתקבלה</th><th class="num">עלות להזמנה</th><th class="num">רווח מהערוץ</th></tr></thead><tbody>'
    +rows.map(function(r){return '<tr><td>'+esc(r.s)+'</td><td class="num">'+money(r.sp)+'</td><td class="num">'+r.n+'</td><td class="num">'+money(r.rev)+'</td><td class="num">'+(r.n?money(r.sp/r.n):'—')+'</td><td class="num"><b>'+money(r.rev-r.sp)+'</b></td></tr>'}).join("")+'</tbody></table>':'<div class="empty">אחרי שיירשמו פרסומים והזמנות עם מקור, יוצג כאן החזר ההשקעה.</div>';
  var l=S.ads.slice().sort(function(a,b){return a.start<b.start?1:-1});
  $("a_list").innerHTML=l.map(function(a){var h=propById(a.houseId);return '<div class="opt"><div class="info"><h3>'+esc(a.channel)+(a.name?' · '+esc(a.name):'')+'</h3><div class="meta">'+fmt(a.start)+(a.end?' עד '+fmt(a.end):'')+' · '+(h?esc(h.name):'כל הבתים')+' · '+money(a.cost)+'</div></div><div class="row">'+delBtn("delAd",a.id)+'</div></div>'}).join("");
}

/* ---------- maintenance & cleaning ---------- */
function mountOps(v){
  v.innerHTML='<div class="stack"><div class="panel stack"><h2>קריאת תחזוקה</h2><div class="grid2">'
   +'<label>בית<select id="o_house"></select></label><label>מה הבעיה<input id="o_title"></label>'
   +'<label>דחיפות<select id="o_pri"><option value="normal">רגילה</option><option value="high">דחופה</option><option value="low">נמוכה</option></select></label>'
   +'<label>לביצוע עד<input id="o_due" type="date"></label><label>עלות משוערת (₪)<input id="o_cost" type="number" min="0" value="0"></label><label>בעל מקצוע<input id="o_vendor"></label></div>'
   +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="o_chg" style="width:auto"> לחייב את בעל הבית בעלות</label>'
   +'<div class="row"><button class="btn primary" data-act="addTk">פתח קריאה</button></div></div>'
   +'<div class="panel stack"><div class="row between"><h2>קריאות</h2><div class="chips" id="o_f"></div></div><div class="list" id="o_list"></div></div>'
   +'<div class="panel stack"><div><h2>ניקיון אחרי יציאה</h2><div class="meta">מופיע לכל יציאה מ־7 הימים האחרונים ועד שבועיים קדימה. אם יש כניסה באותו יום או למחרת, הניקיון מסומן כדחוף.</div></div><div id="o_clean"></div></div></div>';
  updOps();
}
function updOps(){
  if(!$("o_list"))return;fillHouses("o_house");
  var F=[["open","פתוחות"],["all","הכל"]];
  $("o_f").innerHTML=F.map(function(f){return '<button class="chip" data-act="opf" data-id="'+f[0]+'" aria-pressed="'+(S.opFilter===f[0])+'">'+f[1]+'</button>'}).join("");
  var PRI={high:["דחופה","bad"],normal:["רגילה",""],low:["נמוכה",""]},ST={open:"פתוחה",doing:"בטיפול",done:"בוצעה"};
  var l=S.tasks.filter(function(x){return S.opFilter==="all"||x.status!=="done"}).sort(function(a,b){return (a.pri==="high"?0:1)-(b.pri==="high"?0:1)||((a.due||"9")<(b.due||"9")?-1:1)});
  $("o_list").innerHTML=l.length?l.map(function(x){var h=propById(x.houseId),pr=PRI[x.pri]||PRI.normal;
    return '<div class="panel stack"><div class="row between"><div class="info"><h3>'+esc(x.title)+' · '+esc(h?h.name:"")+'</h3><div class="meta">'+ST[x.status]+(x.due?' · עד '+fmt(x.due):'')+' · '+esc(x.vendor||"בלי בעל מקצוע")+' · '+money(x.cost)+(x.chargeOwner?' · מחויב לבעל הבית':'')+'</div></div><span class="pill '+pr[1]+'">'+pr[0]+'</span></div>'
     +'<div class="row">'+(x.status==="open"?'<button class="btn sm" data-act="tkStart" data-id="'+x.id+'">התחל טיפול</button>':'')
     +(x.status!=="done"?'<button class="btn primary sm" data-act="tkDone" data-id="'+x.id+'">סמן בוצע</button>':'')+delBtn("delTk",x.id)+'</div></div>'}).join(""):'<div class="meta">אין קריאות פתוחות.</div>';
  var t=today(),bs=S.bookings.filter(function(b){return b.status!=="cancelled"&&b.out>=addDays(t,-7)&&b.out<=addDays(t,14)}).sort(function(a,b){return a.out<b.out?-1:1});
  $("o_clean").innerHTML=bs.length?'<table><thead><tr><th>יחידה</th><th>יציאה</th><th>כניסה הבאה</th><th>סטטוס</th></tr></thead><tbody>'+bs.map(function(b){
    var nx=S.bookings.filter(function(x){return x.id!==b.id&&bUnit(x)===bUnit(b)&&x.status!=="cancelled"&&x.in>=b.out}).sort(function(p,q){return p.in<q.in?-1:1})[0];
    var tight=nx&&nx.in<=addDays(b.out,1),h=propById(b.propId),c=S.cleans.filter(function(x){return x.id==="clean_"+b.id&&x.done})[0];
    return '<tr data-bid="'+b.id+'"><td>'+esc(unitLabel(b))+'</td><td>'+fmt(b.out)+'</td><td>'+(nx?fmt(nx.in)+(tight?' <span class="pill bad">דחוף</span>':''):'—')+'</td><td>'
     +(c?'<span class="pill ok">נוקה · '+money(c.cost)+'</span> <button class="btn sm" data-act="cleanUndo" data-id="'+b.id+'">בטל</button>'
        :'<input class="cl-c" type="number" min="0" value="'+((h&&h.cleanCost)||0)+'" style="width:90px;padding:5px 8px"> <button class="btn primary sm" data-act="cleanOk" data-id="'+b.id+'">סמן נוקה</button>')+'</td></tr>'}).join("")+'</tbody></table>':'<div class="meta">אין יציאות בטווח.</div>';
}

/* ---------- property bills ---------- */
function mountBills(v){
  var cm=today().slice(0,7);
  v.innerHTML='<div class="stack"><div class="panel stack"><div><h2>חשבונות נכס</h2><div class="meta">חשמל, מים, ארנונה ועוד לכל בית. חשבון שהחברה שילמה ומסומן לחיוב בעל הבית יורד מהתשלום אליו בהתחשבנות. חשבון שהחברה שילמה בלי חיוב נכנס להוצאות.</div></div>'
   +'<div class="grid2"><label>בית<select id="bl_house"></select></label><label>סוג<select id="bl_type">'+BILLTYPES.map(function(s){return '<option>'+s+'</option>'}).join("")+'</select></label>'
   +'<label>לתקופה<input id="bl_period" type="month" value="'+cm+'"></label><label>סכום (₪)<input id="bl_amt" type="number" min="0" inputmode="numeric"></label>'
   +'<label>לתשלום עד<input id="bl_due" type="date"></label><label>מי משלם<select id="bl_by"><option value="company">החברה</option><option value="owner">בעל הבית ישירות</option></select></label></div>'
   +'<div class="row"><label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="bl_chg" style="width:auto"> לחייב את בעל הבית</label>'
   +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="bl_paid" style="width:auto"> כבר שולם</label></div>'
   +'<div class="row"><button class="btn primary" data-act="addBill">הוסף חשבון</button></div></div>'
   +'<div class="panel stack"><div class="row between"><h2>חשבונות</h2><label style="min-width:180px">חודש<select id="bl_m"></select></label></div><div class="chips"><button class="chip" id="bl_u" data-act="billU" aria-pressed="false">רק שלא שולמו</button></div><div class="stats" id="bl_s"></div><div class="scroll" id="bl_t"></div></div></div>';
  $("bl_m").addEventListener("change",function(){S.bMonth=$("bl_m").value;updBills()});
  updBills();
}
function updBills(){
  if(!$("bl_t"))return;fillHouses("bl_house");
  $("bl_m").innerHTML=monthOpts(S.bMonth,true);$("bl_u").setAttribute("aria-pressed",S.bUnpaid);
  var l=S.bills.filter(function(b){return (S.bMonth==="all"||b.period===S.bMonth)&&(!S.bUnpaid||!b.paid)}).sort(function(a,b){return a.period<b.period?1:-1});
  var unpaid=0,chg=0;S.bills.forEach(function(b){if(!b.paid)unpaid+=b.amount||0;if(b.paidBy==="company"&&b.paid&&b.chargeOwner)chg+=b.amount||0});
  $("bl_s").innerHTML='<div class="stat"><b>'+money(unpaid)+'</b><span>חשבונות שלא שולמו</span></div><div class="stat"><b>'+money(chg)+'</b><span>שולם ומחויב לבעלי בתים</span></div>';
  $("bl_t").innerHTML=l.length?'<table><thead><tr><th>בית</th><th>סוג</th><th>תקופה</th><th class="num">סכום</th><th>שילם</th><th>סטטוס</th><th></th></tr></thead><tbody>'+l.map(function(b){
    var h=propById(b.houseId),pv=S.bills.filter(function(x){return x.houseId===b.houseId&&x.type===b.type&&x.period===prevMonth(b.period)})[0],d="";
    if(pv&&pv.amount>0){var pc=Math.round((b.amount-pv.amount)/pv.amount*100);d=' <span class="meta">'+(pc>0?'+':'')+pc+'% מהחודש הקודם</span>'}
    return '<tr><td>'+esc(h?h.name:"")+'</td><td>'+esc(b.type)+'</td><td>'+esc(b.period)+'</td><td class="num">'+money(b.amount)+d+'</td><td>'+(b.paidBy==="company"?'החברה'+(b.chargeOwner?' (מחויב)':''):'בעל הבית')+'</td><td>'+(b.paid?'<span class="pill ok">שולם</span>':'<span class="pill warn">'+(b.due?'עד '+fmt(b.due):'פתוח')+'</span>')+'</td><td>'+(b.paid?'':'<button class="btn sm" data-act="billPaid" data-id="'+b.id+'">סמן שולם</button> ')+delBtn("delBill",b.id)+'</td></tr>'}).join("")+'</tbody></table>':'<div class="empty">אין חשבונות בתקופה.</div>';
}

/* ---------- accounting ledger ---------- */
function ledgerRows(month){
  var vr=vatR(),rows=[];
  S.bookings.forEach(function(b){if(b.status==="cancelled"||!(month==="all"||b.in.slice(0,7)===month))return;
    var c=commission(b),net=S.cfg.commIncVat?c/(1+vr):c,vat=S.cfg.commIncVat?c-net:net*vr;
    rows.push({date:b.in,type:"הכנסה - עמלה",desc:unitLabel(b)+" · "+b.name,net:net,vat:vat,total:net+vat,sign:1})});
  S.expenses.forEach(function(e){if(!(month==="all"||e.date.slice(0,7)===month))return;var net=e.vat?e.amount/(1+vr):e.amount;rows.push({date:e.date,type:"הוצאה - "+e.cat,desc:e.desc,net:net,vat:e.amount-net,total:e.amount,sign:-1})});
  extraCosts(month).forEach(function(c){rows.push({date:c.date||"",type:"הוצאה - "+c.cat+(c.chg?" (מחויב לבעל הבית)":""),desc:c.desc,net:c.amount,vat:0,total:c.amount,sign:c.chg?0:-1})});
  S.payroll.forEach(function(p){if(!(month==="all"||p.month===month))return;var e=S.emps.filter(function(x){return x.id===p.empId})[0];rows.push({date:p.month+"-01",type:"הוצאה - שכר",desc:(e?e.name:"עובד")+" (עלות מעביד)",net:p.cost||0,vat:0,total:p.cost||0,sign:-1})});
  return rows.sort(function(a,b){return a.date<b.date?-1:1});
}
function mountLedger(v){
  v.innerHTML='<div class="panel stack"><div class="row between"><div><h2>הנהלת חשבונות</h2><div class="meta">כל התנועות של החברה ביומן אחד, לפי חודש. אפשר לייצא לקובץ שרואה החשבון פותח באקסל.</div></div><label style="min-width:180px">חודש<select id="lg_m"></select></label></div><div class="stats" id="lg_s"></div><div class="row"><button class="btn primary" data-act="exportCsv">ייצוא לאקסל (CSV)</button></div><div class="scroll" id="lg_t"></div></div>';
  $("lg_m").addEventListener("change",function(){S.month=$("lg_m").value;updLedger()});
  updLedger();
}
function updLedger(){
  if(!$("lg_t"))return;$("lg_m").innerHTML=monthOpts(S.month,true);
  var r=ledgerRows(S.month),inc=0,exp=0,vi=0,ve=0;
  r.forEach(function(x){if(x.sign>0){inc+=x.net;vi+=x.vat}else if(x.sign<0){exp+=x.net;ve+=x.vat}});
  $("lg_s").innerHTML=[["הכנסות לפני מע״מ",money(inc)],["הוצאות לפני מע״מ",money(exp)],["מע״מ עסקאות",money(vi)],["מע״מ תשומות",money(ve)],["מע״מ לתשלום",money(vi-ve)]].map(function(s){return '<div class="stat"><b>'+s[1]+'</b><span>'+s[0]+'</span></div>'}).join("");
  $("lg_t").innerHTML=r.length?'<table><thead><tr><th>תאריך</th><th>סוג</th><th>תיאור</th><th class="num">לפני מע״מ</th><th class="num">מע״מ</th><th class="num">סה״כ</th></tr></thead><tbody>'+r.map(function(x){return '<tr><td>'+(x.date?fmt(x.date):'')+'</td><td>'+esc(x.type)+'</td><td>'+esc(x.desc)+'</td><td class="num">'+money(x.net)+'</td><td class="num">'+money(x.vat)+'</td><td class="num">'+money(x.total)+'</td></tr>'}).join("")+'</tbody></table>':'<div class="empty">אין תנועות בתקופה.</div>';
}
function csvOf(rows){
  function q(s){return '"'+String(s==null?"":s).replace(/"/g,'""')+'"'}
  return "﻿"+["תאריך","סוג","תיאור","לפני מעמ","מעמ","סהכ"].map(q).join(",")+"\n"+rows.map(function(x){return [x.date,x.type,x.desc,Math.round(x.net),Math.round(x.vat),Math.round(x.total)].map(q).join(",")}).join("\n");
}

/* ---------- profit & loss (houses, extra costs) ---------- */
function plCalc(month){
  var vr=vatR(),bs=S.bookings.filter(function(b){return b.status!=="cancelled"&&(month==="all"||b.in.slice(0,7)===month)});
  var gross=0,rev=0,perHouse={};
  bs.forEach(function(b){gross+=b.total||0;var n=commNet(b);rev+=n;var h=propById(b.propId),k=b.propId;var r=perHouse[k]||(perHouse[k]={name:h?h.name:"נכס שנמחק",n:0,gross:0,rev:0,cost:0});r.n++;r.gross+=b.total||0;r.rev+=n});
  var ex=S.expenses.filter(function(e){return month==="all"||e.date.slice(0,7)===month}),expNet=0,vatIn=0,byCat={};
  ex.forEach(function(e){var net=e.vat?e.amount/(1+vr):e.amount;expNet+=net;vatIn+=e.amount-net;byCat[e.cat]=(byCat[e.cat]||0)+net});
  var extra=0,general=0;
  extraCosts(month).forEach(function(c){if(c.chg)return;extra+=c.amount;byCat[c.cat]=(byCat[c.cat]||0)+c.amount;
    if(c.houseId&&perHouse[c.houseId])perHouse[c.houseId].cost+=c.amount;else if(c.houseId){var h=propById(c.houseId);perHouse[c.houseId]={name:h?h.name:"נכס שנמחק",n:0,gross:0,rev:0,cost:c.amount}}else general+=c.amount});
  var pays=S.payroll.filter(function(p){return month==="all"||p.month===month}),payCost=0;pays.forEach(function(p){payCost+=p.cost||0});
  var vatOut=rev*vr,profit=rev-expNet-extra-payCost;
  var mset={};bs.forEach(function(b){mset[b.in.slice(0,7)]=1});ex.forEach(function(e){mset[e.date.slice(0,7)]=1});pays.forEach(function(p){mset[p.month]=1});
  var nm=Math.max(1,Object.keys(mset).length),fixed=(expNet+extra+payCost)/nm,avg=bs.length?rev/bs.length:0;
  return {bs:bs,gross:gross,rev:rev,expNet:expNet+extra,payCost:payCost,profit:profit,vatOut:vatOut,vatIn:vatIn,byCat:byCat,perHouse:perHouse,general:general,fixed:fixed,avg:avg,need:avg>0?Math.ceil(fixed/avg):null,nm:nm};
}
function updPL(){
  if(!$("l_s"))return;
  $("l_m").innerHTML=monthOpts(S.month,true);
  var r=plCalc(S.month),mg=r.rev>0?Math.round(r.profit/r.rev*100):null;
  $("l_s").innerHTML=[["מחזור הזמנות (כסף שעבר דרכנו)",money(r.gross)],["הכנסות החברה (עמלות)",money(r.rev)],["הוצאות (כולל פרסום, ניקיון, תחזוקה, חשבונות)",money(r.expNet)],["שכר (עלות מעביד)",money(r.payCost)],["רווח",money(r.profit)],["שולי רווח",mg==null?"—":mg+"%"]]
    .map(function(s,i){return '<div class="stat"'+(i===4?' style="background:'+(r.profit>=0?'var(--ok-soft)':'var(--bad-soft)')+'"':'')+'><b>'+s[1]+'</b><span>'+s[0]+'</span></div>'}).join("");
  $("l_v").innerHTML='<div class="stat"><b>'+money(r.vatOut)+'</b><span>מע״מ עסקאות (על העמלות)</span></div><div class="stat"><b>'+money(r.vatIn)+'</b><span>מע״מ תשומות (על הוצאות)</span></div><div class="stat"><b>'+money(r.vatOut-r.vatIn)+'</b><span>'+(r.vatOut>=r.vatIn?'לתשלום לרשות המסים':'להחזר')+'</span></div>';
  $("l_b").innerHTML=r.need==null?'<div class="meta">אין עדיין הזמנות בתקופה, אי אפשר לחשב.</div>'
    :'<div class="stats"><div class="stat"><b>'+money(r.fixed)+'</b><span>עלויות בחודש (הוצאות ושכר)</span></div><div class="stat"><b>'+money(r.avg)+'</b><span>עמלה ממוצעת להזמנה</span></div><div class="stat"><b>'+r.need+'</b><span>הזמנות בחודש כדי לכסות עלויות</span></div></div>';
  var pk=Object.keys(r.perHouse);
  $("l_p").innerHTML=pk.length?'<table><thead><tr><th>בית</th><th class="num">הזמנות</th><th class="num">מחזור</th><th class="num">עמלה</th><th class="num">עלויות ישירות</th><th class="num">תרומה</th></tr></thead><tbody>'+pk.sort(function(a,b){return (r.perHouse[b].rev-r.perHouse[b].cost)-(r.perHouse[a].rev-r.perHouse[a].cost)}).map(function(k){var x=r.perHouse[k];return '<tr><td>'+esc(x.name)+'</td><td class="num">'+x.n+'</td><td class="num">'+money(x.gross)+'</td><td class="num">'+money(x.rev)+'</td><td class="num">'+money(x.cost)+'</td><td class="num"><b>'+money(x.rev-x.cost)+'</b></td></tr>'}).join("")+'</tbody></table>'+(r.general?'<div class="meta">עלויות כלליות שלא משויכות לבית (למשל פרסום כללי): '+money(r.general)+'</div>':''):'<div class="empty">אין נתונים.</div>';
  var ck=Object.keys(r.byCat);
  $("l_c").innerHTML=ck.length?'<table><thead><tr><th>קטגוריה</th><th class="num">סכום</th></tr></thead><tbody>'+ck.map(function(k){return '<tr><td>'+esc(k)+'</td><td class="num">'+money(r.byCat[k])+'</td></tr>'}).join("")+'</tbody></table>':'<div class="empty">אין הוצאות בתקופה.</div>';
}

/* ---------- settlement with owners (deductions) ---------- */
function updFin(){
  if(!$("fin_s"))return;
  var ms=allMonths();
  $("fin_m").innerHTML='<option value="all">כל התקופות</option>'+ms.map(function(m){return '<option value="'+m+'"'+(S.finMonth===m?' selected':'')+'>'+mLabel(m)+'</option>'}).join("");
  if(S.finMonth!=="all"&&ms.indexOf(S.finMonth)<0)S.finMonth="all";
  var bs=S.bookings.filter(function(b){return b.status!=="cancelled"&&(S.finMonth==="all"||b.in.slice(0,7)===S.finMonth)});
  var gross=0,comm=0,dep=0,toOwners=0,owedNow=0,ded=0,owners={};
  function own(o){return owners[o]||(owners[o]={n:0,gross:0,comm:0,pay:0,unpaid:0,ded:0})}
  bs.forEach(function(b){
    var c=commission(b);gross+=b.total||0;comm+=c;dep+=b.dep||0;
    var pay=(b.total||0)-c;toOwners+=pay;
    var p=propById(b.propId),o=p&&p.owner?p.owner:"ללא בעלים",r=own(o);
    r.n++;r.gross+=b.total||0;r.comm+=c;r.pay+=pay;
    if(b.status==="done"&&!b.ownerPaid){r.unpaid+=pay;owedNow+=pay}
  });
  extraCosts(S.finMonth).forEach(function(c){if(!c.chg)return;var h=propById(c.houseId),o=h&&h.owner?h.owner:"ללא בעלים",r=own(o);r.ded+=c.amount;ded+=c.amount});
  $("fin_s").innerHTML=[["מחזור הזמנות",money(gross)],["עמלת החברה",money(comm)],["נגבה עד כה (מקדמות)",money(dep)],["מגיע לבעלי בתים",money(toOwners)],["ניכויים (חשבונות ותחזוקה)",money(ded)],["לתשלום עכשיו (אחרי ניכויים)",money(Math.max(0,owedNow-ded))]]
    .map(function(s){return '<div class="stat"><b>'+s[1]+'</b><span>'+s[0]+'</span></div>'}).join("");
  var keys=Object.keys(owners);
  if(!keys.length){$("fin_t").innerHTML='<div class="empty">אין הזמנות בתקופה הזו.</div>';return}
  $("fin_t").innerHTML='<table><thead><tr><th>בעל בית</th><th class="num">הזמנות</th><th class="num">מחזור</th><th class="num">עמלה</th><th class="num">מגיע לו</th><th class="num">ניכויים</th><th class="num">לתשלום עכשיו</th></tr></thead><tbody>'
   +keys.map(function(k){var r=owners[k];return '<tr><td>'+esc(k)+'</td><td class="num">'+r.n+'</td><td class="num">'+money(r.gross)+'</td><td class="num">'+money(r.comm)+'</td><td class="num">'+money(r.pay)+'</td><td class="num">'+money(r.ded)+'</td><td class="num"><b>'+money(r.unpaid-r.ded)+'</b></td></tr>'}).join("")+'</tbody></table>';
}

/* ---------- actions (units, ads, ops, bills, ledger) ---------- */
function msgOf(b){
  var due=Math.max(0,(b.total||0)-(b.dep||0));
  return "שלום "+b.name+",\nהזמנתך אושרה"+(S.cfg.company?" ב"+S.cfg.company:"")+".\nיחידה: "+unitLabel(b)+"\nכניסה: "+fmt(b.in)+"\nיציאה: "+fmt(b.out)+"\nסכום כולל: "+Math.round(b.total||0)+" ₪\nשולם: "+Math.round(b.dep||0)+" ₪\nיתרה לתשלום: "+Math.round(due)+" ₪\nנשמח לארח.";
}
function actY(a,id,el){
  var b;
  if(a==="lead"){var nm=val("l_name").trim(),ph=val("l_phone").trim();if(!nm||!ph){toast("חסר שם או טלפון");return true}
    save("leads",newId("leads"),{name:nm,phone:ph,from:val("i_in"),to:val("i_out"),guests:+val("i_g")||1,date:today()},"נרשם ברשימת המתנה");$("l_name").value="";$("l_phone").value="";return true}
  if(a==="addUnit"){var hn=val("u_house"),un=val("u_name").trim();if(!hn||!un){toast("בחר בית והזן שם ליחידה");return true}
    save("units",newId("units"),{houseId:hn,name:un,beds:+val("u_beds")||1,rooms:+val("u_rooms")||1,price:+val("u_price")||0,shabbatPrice:+val("u_sp")||0,active:true},"היחידה נוספה");$("u_name").value="";return true}
  if(a==="delUnit"){S.confirmDel=null;
    if(S.bookings.some(function(x){return bUnit(x)===id&&x.status!=="cancelled"&&x.status!=="done"})){toast("יש הזמנות פעילות ביחידה");refresh();return true}
    del("units",id);return true}
  if(a==="delP"){if(S.units.some(function(u){return u.houseId===id})){S.confirmDel=null;toast("מחק קודם את היחידות של הבית");refresh();return true}return false}
  if(a==="mPrev"){S.mOff--;updMonth();return true}
  if(a==="mNext"){S.mOff++;updMonth();return true}
  if(a==="mBook"){var x=id.split("|");S.draft={in:x[1],out:addDays(x[1],parse(x[1]).getDay()===5?2:1),g:S.draft&&S.draft.g||4};go("intake");setTimeout(function(){openBookForm(x[0])},0);return true}
  if(a==="copyMsg"){b=S.bookings.filter(function(y){return y.id===id})[0];if(b)copyText(msgOf(b));return true}
  if(a==="addAd"){var cost=+val("a_cost");if(!(cost>0)||!val("a_start")){toast("מלא עלות ותאריך התחלה");return true}
    save("ads",newId("ads"),{channel:val("a_ch"),name:val("a_name").trim(),houseId:val("a_house"),cost:cost,start:val("a_start"),end:val("a_end")},"הפרסום נרשם");$("a_cost").value="";$("a_name").value="";return true}
  if(a==="delAd"){S.confirmDel=null;del("ads",id);return true}
  if(a==="opf"){S.opFilter=id;updOps();return true}
  if(a==="addTk"){var ti=val("o_title").trim();if(!ti||!val("o_house")){toast("בחר בית ותאר את הבעיה");return true}
    save("tasks",newId("tasks"),{houseId:val("o_house"),title:ti,pri:val("o_pri"),due:val("o_due"),cost:+val("o_cost")||0,vendor:val("o_vendor").trim(),chargeOwner:$("o_chg").checked,status:"open",date:today(),created:Date.now()},"הקריאה נפתחה");$("o_title").value="";return true}
  if(a==="tkStart"||a==="tkDoneOk"){var t=S.tasks.filter(function(y){return y.id===id})[0];if(!t)return true;
    var patch=a==="tkStart"?{status:"doing"}:{status:"done",date:today(),cost:+el.parentNode.querySelector("input").value||0};
    save("tasks",id,Object.assign({},t.raw,patch),"הקריאה עודכנה");return true}
  if(a==="tkDone"){var par=el.parentNode;if(par.querySelector(".tk-c"))return true;var t2=S.tasks.filter(function(y){return y.id===id})[0];
    var w=document.createElement("span");w.className="row";w.innerHTML='<input class="tk-c" type="number" min="0" value="'+((t2&&t2.cost)||0)+'" style="width:110px;padding:5px 8px" aria-label="עלות סופית"><button class="btn primary sm" data-act="tkDoneOk" data-id="'+id+'">אשר עלות וסיים</button>';par.appendChild(w);return true}
  if(a==="delTk"){S.confirmDel=null;del("tasks",id);return true}
  if(a==="cleanOk"){b=S.bookings.filter(function(y){return y.id===id})[0];if(!b)return true;
    save("cleans","clean_"+id,{bid:id,houseId:b.propId,date:b.out,cost:+el.closest("tr").querySelector(".cl-c").value||0,done:true},"סומן כנוקה");return true}
  if(a==="cleanUndo"){del("cleans","clean_"+id);return true}
  if(a==="addBill"){var am=+val("bl_amt");if(!val("bl_house")||!(am>0)||!val("bl_period")){toast("בחר בית, תקופה וסכום");return true}
    save("bills",newId("bills"),{houseId:val("bl_house"),type:val("bl_type"),period:val("bl_period"),amount:am,due:val("bl_due"),paidBy:val("bl_by"),chargeOwner:$("bl_chg").checked,paid:$("bl_paid").checked,paidDate:$("bl_paid").checked?today():""},"החשבון נרשם");$("bl_amt").value="";return true}
  if(a==="billPaid"){var bl=S.bills.filter(function(y){return y.id===id})[0];if(bl)save("bills",id,Object.assign({},bl.raw,{paid:true,paidDate:today()}),"סומן ששולם");return true}
  if(a==="delBill"){S.confirmDel=null;del("bills",id);return true}
  if(a==="billU"){S.bUnpaid=!S.bUnpaid;updBills();return true}
  if(a==="exportCsv"){
    window.claude.use("downloads").then(function(dl){
      if(!dl){toast("הייצוא אינו זמין בתצוגה הזו");return}
      return dl.save({filename:"הנהלת-חשבונות-"+(S.month==="all"?"הכל":S.month)+".csv",data:csvOf(ledgerRows(S.month))}).then(function(){toast("הקובץ נשמר")},function(e){if(!e||e.code!=="declined")toast("השמירה נכשלה")});
    });return true}
  return false;
}

/* ---------- boot ---------- */
function load(){
  window.claude.use("db").then(function(db){
    if(!db){$("status").textContent="אין גישה למסד הנתונים. נדרשת כניסה לחשבון.";S.ready=true;refresh();return}
    S.db=db;
    var t=setTimeout(function(){if(!S.ready)$("status").textContent="לא ניתן להגיע לנתונים כרגע, ממשיך לנסות…"},10000);
    var got={p:false,b:false};
    function done(k){got[k]=true;if(got.p&&got.b){S.ready=true;clearTimeout(t)}refresh()}
    db.collection("properties").onSnapshot(function(s){
      S.props=s.docs.map(function(d){return Object.assign({id:d.id},d.data())}).sort(function(a,b){return (a.name||"").localeCompare(b.name||"","he")});
      done("p");
    },function(e){$("status").textContent="שגיאה בטעינת נכסים";});
    db.collection("bookings").onSnapshot(function(s){
      S.bookings=s.docs.map(function(d){var r=d.data();return Object.assign({id:d.id,raw:r},r)});
      done("b");
    },function(e){$("status").textContent="שגיאה בטעינת הזמנות";});
    function sub(col,key,map){
      db.collection(col).onSnapshot(function(s){S[key]=s.docs.map(function(d){var r=d.data();return map?map(d,r):Object.assign({id:d.id,raw:r},r)});refresh()},
        function(){if(ROLE==="admin")$("status").textContent="שגיאה בטעינת "+col});
    }
    sub("employees","emps");sub("payroll","payroll");sub("expenses","expenses");sub("invoices","invoices");sub("seasons","seasons");sub("units","units");sub("ads","ads");sub("leads","leads");sub("tasks","tasks");sub("bills","bills");sub("cleans","cleans");
    db.doc("settings/main").onSnapshot(function(s){
      if(s.exists)S.cfg=Object.assign({vat:18,oncost:22,commIncVat:false,nextInv:1,company:""},s.data());
      if(S.tab==="inv"&&$("g_vat")&&!$("v_list").contains(document.activeElement)){
        var ae=document.activeElement;
        [["g_co",S.cfg.company],["g_vat",S.cfg.vat],["g_on",S.cfg.oncost]].forEach(function(x){if(ae!==$(x[0]))$(x[0]).value=x[1]});
        $("g_inc").checked=!!S.cfg.commIncVat;
      }
      refresh();
    },function(){});
  }).catch(function(){$("status").textContent="אין גישה למסד הנתונים";S.ready=true;refresh()});
}
S.tab=ROLE_HOME[ROLE]||"dash";
window.MERON_APP={S:S,$:$,esc:esc,money:money,iso:iso,parse:parse,addDays:addDays,nights:nights,nextFriday:nextFriday,fmt:fmt,heb:heb,propById:propById,unitById:unitById,bookables:bookables,commission:commission,commNet:commNet,save:save,del:del,toast:toast,newId:newId,estimate:estimate,extraCosts:extraCosts,STATUS:STATUS,today:today,role:ROLE,go:go,refresh:refresh,overlap:overlap,unitLabel:unitLabel};
if(ROLE==="viewer")document.body.classList.add("ro");
renderTabs();mount();
if(window.claude&&window.claude.use)load();else{$("status").textContent="המערכת פועלת רק בתוך claude.ai";}
})();
