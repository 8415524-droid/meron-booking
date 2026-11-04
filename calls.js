/* תיעוד שיחות: כותרת לכל שיחה, סטטוס (כולל "בכיוון סגירה") ותאריך מעקב. */
(function(){
var X=window.MERON_X, CL={rows:[],loaded:false,f:"open",q:"",form:null,err:null};
var ST=[["new","שיחה חדשה"],["interested","מתעניין"],["closing","בכיוון סגירה"],["waiting","ממתין לתשובה"],["booked","הוזמן"],["lost","לא רלוונטי"]];
var STL={};ST.forEach(function(s){STL[s[0]]=s[1]});
function A(){return window.MERON_APP}
function sb(){return window.MERON_SB}
function esc(s){return A().esc(s)}
function val(id){var e=document.getElementById(id);return e?e.value:""}
function load(){
  if(!sb()||!A())return;
  sb().from("docs").select("id,data").eq("col","calls").then(function(r){
    CL.err=r.error?r.error.message:null;
    CL.rows=(r.data||[]).map(function(d){return Object.assign({id:d.id},d.data)}).sort(function(a,b){return (b.at||"").localeCompare(a.at||"")});
    CL.loaded=true;if(A().S.tab==="calls")draw();
  });
}
function pillStyle(s){return s==="closing"?'background:#dff5e1;color:#1b6b2a':s==="booked"?'background:#d8ecff':s==="lost"?'background:#eee;color:#777':''}
function formHtml(f){
  var cust=window.MERON_CUST&&f.phone?window.MERON_CUST.get(f.phone):null;
  return '<div class="panel stack"><h3>'+(f.id?'עריכת שיחה':'שיחה חדשה')+'</h3><div class="grid2">'
   +'<label>טלפון<input id="cl_p" type="tel" dir="ltr" style="text-align:right" value="'+esc(f.phone||"")+'"></label>'
   +'<label>שם הלקוח<input id="cl_n" value="'+esc(f.name||(cust&&cust.name)||"")+'"></label>'
   +'<label>כותרת השיחה<input id="cl_t" placeholder="לדוגמה: מחפש דירה לשבת נחמו, 8 נפשות" value="'+esc(f.title||"")+'"></label>'
   +'<label>סטטוס<select id="cl_s">'+ST.map(function(s){return '<option value="'+s[0]+'"'+((f.status||"new")===s[0]?' selected':'')+'>'+s[1]+'</option>'}).join("")+'</select></label>'
   +'<label>מעקב בתאריך<input type="date" data-no-today id="cl_f" value="'+esc(f.follow||"")+'"></label>'
   +'<label>כיוון<select id="cl_d"><option value="in"'+(f.dir!=="out"?' selected':'')+'>שיחה נכנסת</option><option value="out"'+(f.dir==="out"?' selected':'')+'>שיחה יוצאת</option></select></label></div>'
   +'<label>מה קרה בשיחה<textarea id="cl_x" rows="3">'+esc(f.notes||"")+'</textarea></label>'
   +'<div class="row"><button class="btn primary" data-act="clSave" data-id="'+esc(f.id||"")+'">שמור</button><button class="btn" data-act="clClose">סגור</button></div></div>';
}
function draw(){
  var el=document.getElementById("cl_box");if(!el)return;
  var a=A(),t=a.today();
  if(!CL.loaded){el.innerHTML='<div class="empty">טוען…</div>';return}
  if(CL.err){el.innerHTML='<div class="note">לא ניתן לטעון שיחות. ייתכן שחסרה הרשאה: להריץ את supabase/customers.sql. '+esc(CL.err)+'</div>';return}
  var q=CL.q.trim().toLowerCase();
  var rows=CL.rows.filter(function(c){
    if(CL.f==="open"&&(c.status==="booked"||c.status==="lost"))return false;
    if(CL.f==="answered"&&!c.answered)return false;
    if(CL.f!=="open"&&CL.f!=="all"&&CL.f!=="answered"&&c.status!==CL.f)return false;
    return !q||(c.name||"").toLowerCase().indexOf(q)>=0||(c.phone||"").indexOf(q)>=0||(c.title||"").toLowerCase().indexOf(q)>=0;
  });
  var due=CL.rows.filter(function(c){return c.follow&&c.follow<=t&&c.status!=="booked"&&c.status!=="lost"});
  var cnt={};CL.rows.forEach(function(c){cnt[c.status]=(cnt[c.status]||0)+1});
  el.innerHTML='<h2>תיעוד שיחות</h2>'
   +'<div class="meta">כל שיחה מקבלת כותרת וסטטוס. לקוחות שבכיוון סגירה מסומנים בירוק, ושיחה עם תאריך מעקב שהגיע מופיעה למעלה.</div>'
   +(due.length?'<div class="note"><b>מעקב להיום:</b> '+due.map(function(c){return esc(c.name||c.phone)+' ('+esc(c.title||"")+')'}).join(" · ")+'</div>':'')
   +'<div class="row" style="flex-wrap:wrap"><button class="btn primary" data-act="clNew">תעד שיחה חדשה</button>'
   +[["open","פתוחות"],["answered","נכנסות שנענו"],["closing","בכיוון סגירה ("+(cnt.closing||0)+")"],["waiting","ממתינות ("+(cnt.waiting||0)+")"],["booked","הוזמנו"],["lost","לא רלוונטי"],["all","הכול"]].map(function(f){return '<button class="btn sm'+(CL.f===f[0]?' primary':'')+'" data-act="clF" data-id="'+f[0]+'">'+f[1]+'</button>'}).join("")+'</div>'
   +'<label>חיפוש<input id="cl_q" value="'+esc(CL.q)+'"></label>'
   +(CL.form?formHtml(CL.form):'')
   +(rows.length?rows.map(function(c){
     var cu=window.MERON_CUST&&window.MERON_CUST.get(c.phone),nm=c.name||(cu&&cu.name)||"",tm=c.at?new Date(c.at).toLocaleString("he-IL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"";
     var badge=c.auto?(c.answered?'<span class="pill ok">נענתה</span>':c.route!=null?'<span class="pill warn">לא נענתה</span>':'<span class="pill">נקלטה במרכזיה</span>'):'';
     var ext=c.ext==="1"?"הזמנות ושירות":c.ext==="2"?"שיחה למארח":"";
     return '<div class="opt stack"><div class="row between"><div class="info"><div style="font-size:19px;font-weight:700" dir="ltr">'+esc(c.phone||"מספר חסוי")+'</div>'
      +'<div class="meta">'+esc(tm)+(nm?' · '+esc(nm):'')+(ext?' · '+ext:'')+(c.dir==="out"?' · יוצאת':'')+(c.by?' · '+esc(c.by):'')+(c.follow?' · מעקב '+esc(c.follow):'')+'</div></div>'
      +'<div class="row">'+badge+'<span class="pill" style="'+pillStyle(c.status)+'">'+esc(STL[c.status]||c.status)+'</span></div></div>'
      +(c.title?'<b>'+esc(c.title)+'</b>':'')+(c.notes?'<div class="meta">'+esc(c.notes)+'</div>':'')
      +(c.title?'':'<div class="row"><input id="cq_'+esc(c.id)+'" placeholder="תאר בקצרה את השיחה" style="flex:1"><button class="btn sm primary" data-act="clQuick" data-id="'+esc(c.id)+'">שמור תיאור</button></div>')
      +'<div class="row"><a class="btn sm" href="tel:'+esc(c.phone||"")+'">התקשר</a><button class="btn sm" data-act="clEdit" data-id="'+esc(c.id)+'">פתח ופרט</button></div></div>';
   }).join(""):'<div class="empty">אין שיחות להצגה.</div>');
  var qi=document.getElementById("cl_q");if(qi)qi.addEventListener("input",function(){CL.q=qi.value;var p=qi.selectionStart;draw();var n=document.getElementById("cl_q");if(n){n.focus();n.setSelectionRange(p,p)}});
  var ph=document.getElementById("cl_p");if(ph)ph.addEventListener("blur",function(){var c=window.MERON_CUST&&window.MERON_CUST.get(ph.value),n=document.getElementById("cl_n");if(c&&n&&!n.value)n.value=c.name||""});
}
X.tabs.calls={mount:function(v){v.innerHTML='<div class="stack"><div class="panel stack" id="cl_box"></div></div>';draw();load()},upd:function(){draw()}};
var prev=X.act;
X.act=function(act,id,el){
  var a=A();
  if(act==="clNew"){CL.form={};draw();return true}
  if(act==="clClose"){CL.form=null;draw();return true}
  if(act==="clF"){CL.f=id;draw();return true}
  if(act==="clQuick"){var inp=document.getElementById("cq_"+id),tx=inp?inp.value.trim():"";if(!tx){a.toast("כתוב תיאור קצר");return true}
    var o=CL.rows.filter(function(c){return c.id===id})[0]||{},dd=Object.assign({},o,{title:tx});delete dd.id;
    a.save("calls",id,dd,"התיאור נשמר").then(load);return true}
  if(act==="clEdit"){CL.form=CL.rows.filter(function(c){return c.id===id})[0]||{};draw();window.scrollTo({top:0,behavior:"smooth"});return true}
  if(act==="clSave"){
    var title=val("cl_t").trim(),phone=val("cl_p").trim();
    if(!title||!phone){a.toast("חסרים טלפון וכותרת לשיחה");return true}
    var old=CL.rows.filter(function(c){return c.id===id})[0]||{};
    var d=Object.assign({},old,{phone:phone,name:val("cl_n").trim(),title:title,status:val("cl_s"),follow:val("cl_f"),dir:val("cl_d"),notes:val("cl_x").trim(),at:old.at||new Date().toISOString()});
    delete d.id;
    a.save("calls",id||a.newId("calls"),d,"השיחה נשמרה").then(function(){CL.form=null;load()});return true}
  return prev?prev(act,id,el):false;
};
/* מהכרטיס לקוח: תיעוד שיחה מהירה */
window.MERON_CALL_NEW=function(phone,name){CL.form={phone:phone,name:name};A().go("calls")};
})();
