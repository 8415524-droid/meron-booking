/* התאמות להסכם עם בעלי הנכסים: כרטיס הסכם, ביטולים וחלוקת מקדמה, קבלת זיכוי, יומן מחירים, אזור אישי לבעל נכס. */
(function(){
var X=window.MERON_X, AG={rows:{},loaded:false}, OW={blocks:[],prices:[]};
function A(){return window.MERON_APP}
function sb(){return window.MERON_SB}
function esc(s){return A().esc(s)}
function val(id){var e=document.getElementById(id);return e?e.value:""}
function key(o){return "a_"+encodeURIComponent(o).replace(/%/g,"")}
function owners(){var m={};A().S.props.forEach(function(p){if(p.owner)(m[p.owner]=m[p.owner]||[]).push(p)});return m}

/* ---- ימי מנוחה (שבת וחגי ישראל) לפי הלוח העברי ---- */
var HOL={"Tishri":[1,2,10,15,22],"Nisan":[15,21],"Sivan":[6]};
function isRest(d){
  if(d.getDay()===6)return true;
  try{var p=d.toLocaleDateString("en-u-ca-hebrew",{month:"long",day:"numeric"}).split(" ");var day=+p[0],mon=p[1];
    return !!(HOL[mon]&&HOL[mon].indexOf(day)>=0)}catch(e){return false}
}
function workDaysBefore(inIso){
  var a=A(),d=a.parse(a.today()),end=a.parse(inIso),n=0;
  while(d<end){if(!isRest(d))n++;d=a.parse(a.iso(a.addDays(d,1)))}
  return n;
}
window.MERON_WORKDAYS=workDaysBefore;

/* ---- בדיקת גובה מקדמה: 10% בחוזה, מעל זה שייך לבעל הנכס ---- */
window.MERON_DEPCHK=function(total,dep){
  if(!(total>0)||!(dep>0))return true;
  if(dep<=total*0.1+0.5)return true;
  return confirm("המקדמה גבוהה מ-10% מסכום ההזמנה ("+A().money(Math.round(total*0.1))+"). לפי ההסכם הסכום העודף שייך לבעל הנכס ולא לקופה. להמשיך?");
};

/* ---- ביטול הזמנה ---- */
window.MERON_CANCEL=function(b){
  var a=A(),byCust=confirm("מי מבטל את ההזמנה?\nאישור = הלקוח\nביטול = בעל הנכס");
  var wd=workDaysBefore(b.in),dep=+b.dep||0,rec={by:byCust?"customer":"owner",at:new Date().toISOString(),workDaysBefore:wd,dep:dep};
  if(dep>0){
    if(byCust){
      var def=wd>=7?0:dep;
      var s=prompt("ביטול הלקוח "+wd+" ימים שאינם ימי מנוחה לפני הכניסה ("+(wd>=7?"לפחות 7: לפי ההסכם המקדמה מוחזרת במלואה":"פחות מ-7: לפי ההסכם ניתן להשאיר את המקדמה כדמי ביטול")+").\nכמה להשאיר כדמי ביטול (₪)? ההסכם מחלק אותם חצי לבעל הנכס וחצי לנו.\nשים לב: החוק עשוי להגביל דמי ביטול. אם יש ספק, הזן 0.",String(def));
      if(s===null)return Promise.resolve();
      var keep=Math.max(0,Math.min(dep,+s||0));
      rec.retained=keep;rec.ownerShare=Math.round(keep/2);rec.coShare=keep-rec.ownerShare;rec.refund=dep-keep;
    }else{rec.retained=0;rec.ownerShare=0;rec.coShare=0;rec.refund=dep}
  }
  return a.save("bookings",b.id,Object.assign({},b.raw,{status:"cancelled",cancel:rec}),"ההזמנה בוטלה").then(function(){
    if(!(dep>0)||!window.MERON_RCPT)return;
    var credit=dep-(rec.coShare||0);
    if(credit<=0)return;
    if(!confirm("להפיק קבלת זיכוי על "+a.money(credit)+" (מה שמוחזר ללקוח או עובר לבעל הנכס)?"))return;
    sb().from("docs").select("id,data").eq("col","receipts").filter("data->>booking","eq",b.id).then(function(r){
      var rs=(r.data||[]).filter(function(x){return x.data.kind!=="credit"}).sort(function(p,q){return q.data.no-p.data.no});
      if(!rs.length){a.toast("אין קבלה להזמנה הזו לזיכוי");return}
      sb().rpc("issue_credit",{p_receipt:rs[0].id,p_amount:credit,p_reason:byCust?"ביטול על ידי הלקוח":"ביטול על ידי בעל הנכס"}).then(function(x){
        if(x.error)a.toast("קבלת הזיכוי נכשלה: "+x.error.message);else window.MERON_RCPT.show(b.id,"הופקה קבלת זיכוי מספר "+x.data.no)});
    });
  });
};

/* ---- יומן שינויי מחיר ---- */
window.MERON_PRICELOG=function(col,id,data){
  if(col!=="properties"&&col!=="units")return;
  var a=A(),old=(col==="properties"?a.S.props:a.S.units).filter(function(x){return x.id===id})[0];
  if(!old||(old.price===data.price&&old.shabbatPrice===data.shabbatPrice))return;
  var by="";try{by=(window.MERON_USER_EMAIL)||""}catch(e){}
  a.save("pricelog",a.newId("pricelog"),{col:col,refId:id,name:data.name||old.name||"",oldPrice:old.price||0,newPrice:data.price||0,oldShabbat:old.shabbatPrice||0,newShabbat:data.shabbatPrice||0,at:new Date().toISOString(),by:by});
};

/* ---- הסכמי בעלי נכסים ---- */
function agrLoad(){
  sb().from("docs").select("id,data").eq("col","agreements").then(function(r){
    AG.rows={};(r.data||[]).forEach(function(d){AG.rows[d.id]=d.data});AG.loaded=true;
    if(A().S.tab==="agr")agrDraw()});
}
function status(g){
  if(!g||!g.end)return '<span class="pill">אין תאריך סיום</span>';
  var days=Math.round((new Date(g.end+"T12:00:00")-new Date())/864e5);
  if(days<0)return '<span class="pill" style="background:#fde8e8;color:#b00020">פג תוקף לפני '+(-days)+' ימים. הזמנות חדשות אינן מזכות בעמלה (סעיף 13.5)</span>';
  if(days<=60)return '<span class="pill" style="background:#fff3d6">פג בעוד '+days+' ימים</span>';
  return '<span class="pill">בתוקף עד '+esc(g.end)+'</span>';
}
function agrDraw(){
  var el=document.getElementById("ag_box");if(!el)return;
  if(!AG.loaded){el.innerHTML='<div class="empty">טוען…</div>';return}
  var os=owners(),names=Object.keys(os);
  el.innerHTML='<h2>הסכמי בעלי נכסים</h2><div class="meta">לכל בעל נכס: תקופת ההסכם, אחוז העמלה והפרטים שמופיעים בחוזה. הסכם שפג תוקפו מסומן באדום, כי לפי סעיף 13.5 הזמנות חדשות אחריו לא מזכות בעמלה.</div>'
   +(names.length?names.map(function(n){
     var g=AG.rows[key(n)]||{};
     return '<div class="opt stack"><div class="info"><b>'+esc(n)+'</b> '+status(AG.rows[key(n)])+'<div class="meta">'+os[n].map(function(h){return esc(h.name)+' ('+h.pct+'%)'}).join(" · ")+'</div></div>'
      +'<div class="grid2"><label>ת.ז. או ח.פ<input id="ag_id_'+esc(key(n))+'" value="'+esc(g.idno||"")+'"></label><label>כתובת<input id="ag_ad_'+esc(key(n))+'" value="'+esc(g.addr||"")+'"></label>'
      +'<label>אימייל<input id="ag_em_'+esc(key(n))+'" dir="ltr" value="'+esc(g.email||"")+'"></label>'
      +'<label>תחילת הסכם<input type="date" data-no-today id="ag_st_'+esc(key(n))+'" value="'+esc(g.start||"")+'"></label><label>סיום הסכם<input type="date" data-no-today id="ag_en_'+esc(key(n))+'" value="'+esc(g.end||"")+'"></label>'
      +'<label>עמלה (%)<input type="number" min="0" max="100" id="ag_pc_'+esc(key(n))+'" value="'+(g.pct!=null?g.pct:10)+'"></label>'
      +'<label>הודעה מוקדמת (ימים)<input type="number" min="0" id="ag_nt_'+esc(key(n))+'" value="'+(g.notice!=null?g.notice:30)+'"></label></div>'
      +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" style="width:auto" id="ag_vt_'+esc(key(n))+'"'+(g.incVat!==false?' checked':'')+'> העמלה כוללת מע"מ</label>'
      +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" style="width:auto" id="ag_px_'+esc(key(n))+'"'+(g.pbx?' checked':'')+'> אישר חיבור הטלפון למרכזייה</label>'
      +'<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" style="width:auto" id="ag_sg_'+esc(key(n))+'"'+(g.signed?' checked':'')+'> החוזה נחתם</label>'
      +'<label>הערות<input id="ag_nz_'+esc(key(n))+'" value="'+esc(g.notes||"")+'"></label>'
      +'<div class="row"><button class="btn primary sm" data-act="agSave" data-id="'+esc(n)+'">שמור</button><button class="btn sm" data-act="agApply" data-id="'+esc(n)+'">החל את אחוז העמלה על כל הבתים שלו</button></div></div>';
   }).join(""):'<div class="empty">עדיין אין בעלי נכסים בבתים.</div>');
}
X.tabs.agr={mount:function(v){v.innerHTML='<div class="stack"><div class="panel stack" id="ag_box"></div></div>';agrDraw();agrLoad()},upd:function(){agrDraw()}};

/* ---- אזור אישי לבעל נכס: חסימת תאריכים ועדכון מחיר ---- */
function owLoad(){
  (function(){
    sb().from("docs").select("id,col,data").in("col",["ownblocks","ownprices"]).then(function(r2){
      OW.blocks=[];OW.prices=[];(r2.data||[]).forEach(function(d){var o=Object.assign({id:d.id},d.data);(d.col==="ownblocks"?OW.blocks:OW.prices).push(o)});
      if(A().S.tab==="mine")owDraw()});
  });
}
function owDraw(){
  var el=document.getElementById("ow2_box");if(!el)return;
  var a=A(),us=a.bookables();
  var opts=us.map(function(u){return '<option value="'+esc(u.id)+'" data-h="'+esc(u.houseId)+'">'+esc(u.name)+'</option>'}).join("");
  el.innerHTML='<h2>היומן שלי</h2><div class="meta">כאן מעדכנים תאריכים שלא פנויים (הזמנה שקיבלת בעצמך, או חסימה) ומחירים לתאריכים מסוימים. עדכון מיידי חוסם את הזמנת התאריכים אצלנו.</div>'
   +'<div class="grid2"><label>יחידה<select id="ow2_u">'+opts+'</select></label><label>הערה<input id="ow2_n" placeholder="לדוגמה: אורחים שלי"></label>'
   +'<label>מתאריך<input type="date" data-no-today id="ow2_f"></label><label>עד (יציאה)<input type="date" data-no-today id="ow2_t"></label></div>'
   +'<div class="row"><button class="btn primary" data-act="owBlock">סמן כתפוס</button></div>'
   +'<h3>מחיר לתאריכים</h3><div class="grid2"><label>מתאריך<input type="date" data-no-today id="ow2_pf"></label><label>עד<input type="date" data-no-today id="ow2_pt"></label><label>מחיר ללילה (₪)<input type="number" min="0" id="ow2_pp"></label><label>הערה<input id="ow2_pn" placeholder="חג, עונה"></label></div>'
   +'<div class="row"><button class="btn primary" data-act="owPrice">שמור מחיר</button></div>'
   +'<h3>מה עודכן</h3>'+(OW.blocks.concat(OW.prices).length?OW.blocks.map(function(b){return '<div class="opt"><div class="info"><b>תפוס</b> '+esc(b.from)+' עד '+esc(b.to)+'<div class="meta">'+esc(b.unitName||"")+' · '+esc(b.note||"")+'</div></div><button class="btn sm danger" data-act="owDel2" data-id="'+esc(b.id)+'">הסר</button></div>'}).join("")
     +OW.prices.map(function(b){return '<div class="opt"><div class="info"><b>מחיר '+a.money(b.price)+'</b> '+esc(b.from)+' עד '+esc(b.to)+'<div class="meta">'+esc(b.unitName||"")+' · '+esc(b.note||"")+'</div></div><button class="btn sm danger" data-act="owDel2" data-id="'+esc(b.id)+'">הסר</button></div>'}).join(""):'<div class="meta">עדיין לא עודכן כלום.</div>');
}
X.tabs.mine={mount:function(v){v.innerHTML='<div class="stack"><div class="panel stack" id="ow2_box"></div></div>';owDraw();owLoad()},upd:function(){owDraw()}};

var prev=X.act;
X.act=function(act,id,el){
  var a=A();
  if(act==="agSave"){var k=key(id),g=function(p){return val("ag_"+p+"_"+k)};
    var d={owner:id,idno:g("id").trim(),addr:g("ad").trim(),email:g("em").trim(),start:g("st"),end:g("en"),pct:+g("pc")||0,notice:+g("nt")||0,incVat:document.getElementById("ag_vt_"+k).checked,pbx:document.getElementById("ag_px_"+k).checked,signed:document.getElementById("ag_sg_"+k).checked,notes:g("nz").trim()};
    a.save("agreements",k,d,"ההסכם נשמר").then(function(){AG.rows[k]=d;agrDraw()});return true}
  if(act==="agApply"){var g2=AG.rows[key(id)];if(!g2){a.toast("שמור קודם את ההסכם");return true}
    var hs=owners()[id]||[];if(!confirm("לעדכן את העמלה ל-"+g2.pct+"% ב-"+hs.length+" בתים של "+id+"?"))return true;
    Promise.all(hs.map(function(h){var o=Object.assign({},h);delete o.id;o.pct=g2.pct;return a.save("properties",h.id,o)})).then(function(){a.toast("העמלה עודכנה")});return true}
  if(act==="owBlock"){var u=document.getElementById("ow2_u"),f=val("ow2_f"),t=val("ow2_t");
    if(!u||!f||!t||t<=f){a.toast("בחר יחידה ותאריכים (היציאה אחרי הכניסה)");return true}
    var opt=u.options[u.selectedIndex];
    a.save("ownblocks",a.newId("ownblocks"),{unitId:u.value,houseId:opt.dataset.h,unitName:opt.text,from:f,to:t,note:val("ow2_n").trim(),at:new Date().toISOString()},"התאריכים סומנו כתפוסים").then(owLoad);return true}
  if(act==="owPrice"){var u2=document.getElementById("ow2_u"),f2=val("ow2_pf"),t2=val("ow2_pt"),pp=+val("ow2_pp");
    if(!u2||!f2||!t2||t2<f2||!(pp>0)){a.toast("בחר יחידה, תאריכים ומחיר");return true}
    var o2=u2.options[u2.selectedIndex];
    a.save("ownprices",a.newId("ownprices"),{unitId:u2.value,houseId:o2.dataset.h,unitName:o2.text,from:f2,to:t2,price:pp,note:val("ow2_pn").trim(),at:new Date().toISOString()},"המחיר נשמר").then(owLoad);return true}
  if(act==="owDel2"){a.del(OW.blocks.some(function(b){return b.id===id})?"ownblocks":"ownprices",id).then(owLoad);return true}
  return prev?prev(act,id,el):false;
};
})();
