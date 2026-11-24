/* סנכרון יומנים (iCal): ייצוא היומן שלנו לכל יחידה, וייבוא יומנים חיצוניים של בעלי הנכסים כתאריכים תפוסים. */
(function(){
var X=window.MERON_X, EX={own:{},ownp:{},rows:{},secret:null,loaded:false,err:null,busy:{}};
function A(){return window.MERON_APP}
function sb(){return window.MERON_SB}
function esc(s){return A().esc(s)}
window.MERON_EXT=function(id,ci,co){var r=EX.rows[id];if(r&&r.ranges&&r.ranges.some(function(x){return ci<x.out&&x.in<co}))return true;var o=EX.own[id];return !!(o&&o.some(function(x){return ci<x.out&&x.in<co}))};
window.MERON_PRICE=function(id,day){var l=EX.ownp[id];if(!l)return null;var m=null;l.forEach(function(x){if(day>=x.from&&day<=x.to)m=x.price});return m};
function token(){return sb().auth.getSession().then(function(s){return s&&s.data&&s.data.session&&s.data.session.access_token})}
function load(){
  if(!sb()||!A())return Promise.resolve();
  return Promise.all([sb().from("docs").select("id,data").eq("col","extical"),sb().rpc("ical_get_secret"),sb().from("docs").select("data").eq("col","ownblocks"),sb().from("docs").select("data").eq("col","ownprices")]).then(function(r){
    EX.ownp={};(r[3].data||[]).forEach(function(d){var b=d.data;(EX.ownp[b.unitId]=EX.ownp[b.unitId]||[]).push(b)});
    EX.own={};(r[2].data||[]).forEach(function(d){var b=d.data;(EX.own[b.unitId]=EX.own[b.unitId]||[]).push({in:b.from,out:b.to})});
    EX.rows={};(r[0].data||[]).forEach(function(d){EX.rows[d.id]=d.data});
    EX.secret=r[1].error?null:r[1].data;EX.err=r[1].error?r[1].error.message:null;EX.loaded=true;
    if(A().S.tab==="ical")draw();
  });
}
function feedUrl(id){return location.origin+(window.MERON_BASE||"")+"/api/ical-feed?s="+encodeURIComponent(EX.secret||"")+"&id="+encodeURIComponent(id)}
function sync(id){
  var row=EX.rows[id];if(!row||!row.url||EX.busy[id])return Promise.resolve();
  EX.busy[id]=1;if(A().S.tab==="ical")draw();
  return token().then(function(t){
    return fetch((window.MERON_BASE||"")+"/api/ical-fetch",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({url:row.url})}).then(function(r){return r.json()});
  }).catch(function(e){return {ok:false,error:e.message}}).then(function(j){
    var d=Object.assign({},row,{at:new Date().toISOString(),err:j.ok?"":j.error});
    if(j.ok)d.ranges=j.ranges;
    EX.rows[id]=d;delete EX.busy[id];
    return A().save("extical",id,d).then(function(){if(A().S.tab==="ical")draw()});
  });
}
function conflicts(id){
  var r=EX.rows[id];if(!r||!r.ranges)return [];
  return A().S.bookings.filter(function(b){return b.status!=="cancelled"&&(b.unitId||b.propId)===id&&r.ranges.some(function(x){return b.in<x.out&&x.in<b.out})});
}
function draw(){
  var el=document.getElementById("ic_box");if(!el)return;
  if(!EX.loaded){el.innerHTML='<div class="empty">טוען…</div>';return}
  if(EX.err){el.innerHTML='<div class="note">לא ניתן לטעון. ייתכן שהסקריפט supabase/ical.sql עדיין לא הורץ ב-Supabase. '+esc(EX.err)+'</div>';return}
  var a=A(),us=a.bookables();
  el.innerHTML='<h2>סנכרון יומנים</h2><div class="meta">ייצוא: כל יחידה מקבלת כתובת iCal שאפשר להדביק בגוגל קלנדר, Airbnb, Booking ועוד, כדי שההזמנות שלנו יחסמו שם. ייבוא: מדביקים את כתובת ה-iCal של יומן בעל הנכס, והתאריכים התפוסים שלו ייחסמו אצלנו. הסנכרון מתרענן אוטומטית כל חצי שעה כשהמערכת פתוחה.</div>'
   +us.map(function(u){
     var r=EX.rows[u.id]||{},cf=conflicts(u.id),st=r.at?('סונכרן '+new Date(r.at).toLocaleString("he-IL")+' · '+(r.ranges||[]).length+' טווחים תפוסים'):'עדיין לא סונכרן';
     return '<div class="opt stack"><div class="info"><b>'+esc(u.name)+'</b></div>'
      +'<label>כתובת הייצוא שלנו<input readonly dir="ltr" style="text-align:left" value="'+esc(feedUrl(u.id))+'" id="ic_f_'+esc(u.id)+'"></label>'
      +'<div class="row"><button class="btn sm" data-act="icCopy" data-id="'+esc(u.id)+'">העתק כתובת ייצוא</button></div>'
      +'<label>כתובת iCal של היומן של בעל הנכס<input dir="ltr" style="text-align:left" id="ic_u_'+esc(u.id)+'" value="'+esc(r.url||"")+'" placeholder="https://..."></label>'
      +'<div class="row"><button class="btn sm primary" data-act="icSave" data-id="'+esc(u.id)+'"'+(EX.busy[u.id]?' disabled':'')+'>שמור וסנכרן</button>'+(r.url?'<button class="btn sm danger" data-act="icDel" data-id="'+esc(u.id)+'">הסר ייבוא</button>':'')+'</div>'
      +'<details><summary class="meta">או: הדבקת תאריכים ידנית, או קישור לגיליון גוגל (פרסום כ-CSV)</summary><label>תאריכים תפוסים, שורה לכל טווח (כניסה ויציאה, לדוגמה 2026-12-05 2026-12-07)<textarea id="ic_p_'+esc(u.id)+'" rows="3" dir="ltr" style="text-align:left"></textarea></label><div class="row"><button class="btn sm" data-act="icPaste" data-id="'+esc(u.id)+'">שמור תאריכים</button></div></details>'
      +'<div class="meta">'+(EX.busy[u.id]?'מסנכרן…':esc(st))+'</div>'
      +(r.err?'<div class="note">'+esc(r.err)+'</div>':'')
      +(cf.length?'<div class="note">שים לב: יש הזמנות אצלנו שחופפות לתאריכים תפוסים ביומן החיצוני: '+cf.map(function(b){return esc(b.name)+' ('+a.fmt(b.in)+')'}).join(", ")+'</div>':'')
      +'</div>';
   }).join("");
}
X.tabs.ical={mount:function(v){v.innerHTML='<div class="stack"><div class="panel stack" id="ic_box"></div></div>';draw();load()},upd:function(){draw()}};
var prev=X.act;
X.act=function(act,id,el){
  if(act==="icCopy"){var i=document.getElementById("ic_f_"+id);if(i){i.select();try{document.execCommand("copy");A().toast("הכתובת הועתקה")}catch(e){}}return true}
  if(act==="icSave"){var u=document.getElementById("ic_u_"+id).value.trim();
    if(!/^(https?|webcal):\/\//i.test(u)){A().toast("הדבק כתובת iCal שמתחילה ב-https");return true}
    var old=EX.rows[id]||{};EX.rows[id]=Object.assign({},old,{unitId:id,url:u,ranges:old.url===u?old.ranges:[]});
    A().save("extical",id,EX.rows[id]).then(function(){sync(id)});return true}
  if(act==="icPaste"){var tx=document.getElementById("ic_p_"+id).value,rg=[];
    tx.split(/\n/).forEach(function(l){var ds=[],re=/(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/g,m;while((m=re.exec(l))){var y=m[1]||m[6],mo=m[2]||m[5],d=m[3]||m[4];ds.push(y+"-"+("0"+mo).slice(-2)+"-"+("0"+d).slice(-2))}
      if(ds.length)rg.push({in:ds[0],out:ds.length>1&&ds[1]>ds[0]?ds[1]:A().addDays(ds[0],1)})});
    if(!rg.length){A().toast("לא נמצאו תאריכים");return true}
    var o=EX.rows[id]||{};EX.rows[id]=Object.assign({},o,{unitId:id,ranges:(o.ranges||[]).concat(rg),manual:true});A().save("extical",id,EX.rows[id],"התאריכים נשמרו").then(draw);return true}
  if(act==="icDel"){if(!confirm("להסיר את הייבוא? התאריכים החסומים יתפנו."))return true;delete EX.rows[id];A().del("extical",id);draw();return true}
  return prev?prev(act,id,el):false;
};
/* רענון אוטומטי */
function auto(){
  if(!sb()||!A()||(A().role!=="admin"&&A().role!=="agent"))return;
  if(document.visibilityState==="hidden")return; /* לשונית ברקע — לא מסנכרנים; הסבב הבא כשהיא גלויה */
  load().then(function(){Object.keys(EX.rows).forEach(function(id){var r=EX.rows[id];if(r.url&&(!r.at||Date.now()-new Date(r.at).getTime()>30*60000))sync(id)})});
}
setTimeout(auto,3000);setInterval(auto,30*60000);
})();
