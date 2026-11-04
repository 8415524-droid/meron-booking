/* כרטיס לקוח: נפתח בקליטת הזמנה, מזהה לפי טלפון, וההזמנה מתקבלת רק עבור טלפון כשר. */
(function(){
var X=window.MERON_X, CU={rows:{},loaded:false,q:"",edit:null};
function A(){return window.MERON_APP}
function sb(){return window.MERON_SB}
function esc(s){return A().esc(s)}
function val(id){var e=document.getElementById(id);return e?e.value:""}
function dg(p){var d=String(p||"").replace(/\D/g,"");if(d.indexOf("972")===0)d="0"+d.slice(3);return d}
function cid(p){var d=dg(p);return d.length>=7?"c_"+d:""}
function load(){
  if(!sb()||!A())return Promise.resolve();
  return sb().from("docs").select("id,data").eq("col","customers").then(function(r){
    CU.rows={};(r.data||[]).forEach(function(d){CU.rows[d.id]=Object.assign({id:d.id},d.data)});CU.loaded=true;
    if(A().S.tab==="cust")draw();
  });
}
window.MERON_CUST={
  get:function(phone){return CU.rows[cid(phone)]||null},
  /* שומר או מעדכן כרטיס לפי הטלפון. מחזיר הבטחה עם מזהה הכרטיס */
  upsert:function(c){
    var id=cid(c.phone);if(!id)return Promise.resolve("");
    var old=CU.rows[id]||{},d=Object.assign({},old,c,{phone:dg(c.phone),kosher:true,updatedAt:new Date().toISOString()});
    if(!old.createdAt)d.createdAt=d.updatedAt;delete d.id;
    CU.rows[id]=Object.assign({id:id},d);
    return A().save("customers",id,d).then(function(){return id});
  }
};
/* ---- שדות כרטיס לקוח בטופס ההזמנה ---- */
function inject(){
  var ph=document.getElementById("b_phone");if(!ph||document.getElementById("c_extra"))return;
  var grid=ph.closest(".grid2");if(!grid)return;
  var h=document.createElement("div");h.id="c_extra";h.className="stack";
  h.innerHTML='<h3>כרטיס לקוח</h3><div class="grid2">'
   +'<label>מספר זהות<input id="c_idno" inputmode="numeric" dir="ltr" style="text-align:right"></label>'
   +'<label>עיר מגורים<input id="c_city"></label>'
   +'<label>טלפון נוסף (אופציונלי)<input id="c_ph2" type="tel" dir="ltr" style="text-align:right"></label>'
   +'<label>בקשות קבועות או הערות על הלקוח<input id="c_note" placeholder="לדוגמה: משפחה גדולה, קומת קרקע"></label></div>'
   +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="c_kosher" style="width:auto"> הלקוח מדבר מטלפון כשר (חובה: ההזמנה מתקבלת רק עבור טלפון כשר)</label>'
   +'<div class="meta" id="c_seen"></div>';
  grid.parentNode.insertBefore(h,grid.nextSibling);
  ph.addEventListener("blur",fillFromCard);ph.addEventListener("input",function(){if(dg(ph.value).length>=9)fillFromCard()});
}
function fillFromCard(){
  var c=window.MERON_CUST.get(val("b_phone")),s=document.getElementById("c_seen");
  if(!c){if(s)s.textContent="";return}
  var n=A().S.bookings.filter(function(b){return dg(b.phone)===dg(c.phone)&&b.status!=="cancelled"}).length;
  if(s)s.textContent="לקוח קיים: "+(c.name||"")+" · "+n+" הזמנות קודמות";
  var set=function(id,v){var e=document.getElementById(id);if(e&&!e.value&&v)e.value=v};
  set("b_name",c.name);set("c_idno",c.idno);set("c_city",c.city);set("c_ph2",c.phone2);set("c_note",c.note);
  var k=document.getElementById("c_kosher");if(k)k.checked=true;
}
new MutationObserver(inject).observe(document.documentElement,{childList:true,subtree:true});

/* שמירת כרטיס עם ההזמנה: נקרא מ-app.js לפני שמירת ההזמנה. מחזיר false כשחסרים פרטים. */
window.MERON_CUST_CHECK=function(){
  if(!document.getElementById("c_kosher"))return true;
  if(!document.getElementById("c_kosher").checked){A().toast("ההזמנה מתקבלת רק עבור לקוח עם טלפון כשר. סמן את האישור");return false}
  var idno=val("c_idno").replace(/\D/g,"");
  if(idno&&idno.length<5){A().toast("מספר הזהות קצר מדי");return false}
  return true;
};
window.MERON_CUST_SNAP=function(){if(!document.getElementById("c_kosher"))return null;return {city:val("c_city").trim(),note:val("c_note").trim(),phone2:val("c_ph2").trim()}};
window.MERON_CUST_SAVE=function(){
  if(!document.getElementById("c_kosher"))return Promise.resolve("");
  return window.MERON_CUST.upsert({name:val("b_name").trim(),phone:val("b_phone").trim(),idno:val("c_idno").replace(/\D/g,""),city:val("c_city").trim(),phone2:val("c_ph2").trim(),note:val("c_note").trim()});
};

/* ---- מסך לקוחות ---- */
function draw(){
  var el=document.getElementById("cu_box");if(!el)return;
  if(!CU.loaded){el.innerHTML='<div class="empty">טוען…</div>';return}
  var a=A(),q=CU.q.trim().toLowerCase(),all=Object.keys(CU.rows).map(function(k){return CU.rows[k]});
  var rows=all.filter(function(c){return !q||(c.name||"").toLowerCase().indexOf(q)>=0||(c.phone||"").indexOf(q)>=0||(c.city||"").toLowerCase().indexOf(q)>=0||(c.idno||"").indexOf(q)>=0})
   .sort(function(x,y){return (y.updatedAt||"").localeCompare(x.updatedAt||"")}).slice(0,200);
  var e=CU.edit&&CU.rows[CU.edit];
  el.innerHTML='<h2>לקוחות</h2><div class="meta">כרטיס נפתח אוטומטית בכל הזמנה חדשה, לפי מספר הטלפון. '+all.length+' לקוחות.</div>'
   +'<label>חיפוש (שם, טלפון, עיר, זהות)<input id="cu_q" value="'+esc(CU.q)+'"></label>'
   +(e?'<div class="panel stack"><h3>עריכת כרטיס: '+esc(e.name||e.phone)+'</h3><div class="grid2">'
     +'<label>שם<input id="cu_n" value="'+esc(e.name||"")+'"></label><label>טלפון<input id="cu_p" dir="ltr" style="text-align:right" value="'+esc(e.phone||"")+'" readonly></label>'
     +'<label>מספר זהות<input id="cu_i" value="'+esc(e.idno||"")+'"></label><label>עיר<input id="cu_c" value="'+esc(e.city||"")+'"></label>'
     +'<label>טלפון נוסף<input id="cu_p2" value="'+esc(e.phone2||"")+'"></label><label>הערות<input id="cu_t" value="'+esc(e.note||"")+'"></label></div>'
     +'<div class="row"><button class="btn primary" data-act="cuSave" data-id="'+esc(e.id)+'">שמור</button><button class="btn" data-act="cuClose">סגור</button></div></div>':'')
   +(rows.length?rows.map(function(c){
     var bs=a.S.bookings.filter(function(b){return dg(b.phone)===dg(c.phone)});
     return '<div class="opt"><div class="info"><b>'+esc(c.name||"ללא שם")+'</b> <span dir="ltr">'+esc(c.phone)+'</span><div class="meta">'+esc(c.city||"")+(c.idno?' · ת.ז. '+esc(c.idno):'')+' · '+bs.length+' הזמנות'+(c.note?' · '+esc(c.note):'')+'</div></div><div class="row"><a class="btn sm" href="tel:'+esc(c.phone)+'">התקשר</a><button class="btn sm" data-act="cuCall" data-id="'+esc(c.id)+'">תעד שיחה</button><button class="btn sm" data-act="cuEdit" data-id="'+esc(c.id)+'">פתח כרטיס</button></div></div>';
   }).join(""):'<div class="empty">אין לקוחות להצגה.</div>');
  var qi=document.getElementById("cu_q");if(qi)qi.addEventListener("input",function(){CU.q=qi.value;var p=qi.selectionStart;draw();var n=document.getElementById("cu_q");if(n){n.focus();n.setSelectionRange(p,p)}});
}
X.tabs.cust={mount:function(v){v.innerHTML='<div class="stack"><div class="panel stack" id="cu_box"></div></div>';draw();load()},upd:function(){draw()}};
var prev=X.act;
X.act=function(act,id,el){
  if(act==="cuEdit"){CU.edit=id;draw();window.scrollTo({top:0,behavior:"smooth"});return true}
  if(act==="cuCall"){var cc=CU.rows[id];if(cc&&window.MERON_CALL_NEW)window.MERON_CALL_NEW(cc.phone,cc.name);return true}
  if(act==="cuClose"){CU.edit=null;draw();return true}
  if(act==="cuSave"){var c=CU.rows[id];if(!c)return true;
    window.MERON_CUST.upsert({name:val("cu_n").trim(),phone:c.phone,idno:val("cu_i").replace(/\D/g,""),city:val("cu_c").trim(),phone2:val("cu_p2").trim(),note:val("cu_t").trim()}).then(function(){A().toast("הכרטיס נשמר");CU.edit=null;draw()});return true}
  return prev?prev(act,id,el):false;
};
setTimeout(load,3500);
})();
