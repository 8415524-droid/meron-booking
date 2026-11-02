/* תוספות: בקשות מהאתר, חיפוש לקוח, דוח לבעל בית, התראות, תחזית, גיבוי, מצב כהה.
   נטען לפני app.js. משתמש ב-window.MERON_APP (מוגדר ב-app.js) ובלקוח Supabase שב-window.MERON_SB. */
(function(){
var X=window.MERON_X={tabs:{}};
function A(){return window.MERON_APP}
function sb(){return window.MERON_SB}
function esc(s){return A().esc(s)}
function wa(phone,text){
  var d=String(phone||"").replace(/\D/g,"");if(!d)return "";
  if(d.charAt(0)==="0")d="972"+d.slice(1);
  return "https://wa.me/"+d+"?text="+encodeURIComponent(text);
}
function waBtn(phone,text,label){var u=wa(phone,text);return u?'<a class="btn sm" target="_blank" rel="noopener" href="'+u+'">'+(label||"WhatsApp")+'</a>':""}
function bUnit(b){return b.unitId||b.propId}
function live(b){return b.status!=="cancelled"}
function dmy(s){return s?s.split("-").reverse().join("/"):""}

/* ---- הודעות ---- */
var MSG={
  confirm:function(b){var A_=A();return "שלום "+b.name+", ההזמנה שלך ב"+A_.unitLabel(b)+" אושרה.\nכניסה: "+dmy(b.in)+"\nיציאה: "+dmy(b.out)+"\nסכום: ₪"+Math.round(b.total||0)+(b.dep?" · מקדמה ששולמה: ₪"+Math.round(b.dep):"")+"\nתודה, כשר מירון."},
  deposit:function(b){var A_=A();return "שלום "+b.name+", תזכורת לתשלום מקדמה של ₪"+Math.round(Math.max(0,(b.total||0)*0.3-(b.dep||0)))+" עבור ההזמנה ב"+A_.unitLabel(b)+" לתאריך "+dmy(b.in)+". תודה, כשר מירון."}
};

/* ---- בקשות מהאתר הציבורי ---- */
var RQ={rows:[],loaded:false,ch:null};
function rqLoad(){
  if(!sb())return;
  sb().from("requests").select("*").order("created_at",{ascending:false}).limit(200).then(function(r){
    if(r.error){RQ.err=true;RQ.rows=[]}else{RQ.rows=r.data||[];RQ.err=false}
    RQ.loaded=true;var t=X.tabs.requests;if(A().S.tab==="requests")t.upd();
  });
}
function rqWatch(){
  if(RQ.ch||!sb()||A().role==="owner"||A().role==="vendor"||A().role==="partner")return;
  rqLoad();
  RQ.ch=sb().channel("rq-"+Date.now()).on("postgres_changes",{event:"*",schema:"public",table:"requests"},rqLoad).subscribe();
}
X.tabs.requests={
  mount:function(v){
    v.innerHTML='<div class="stack"><div class="panel"><h2>בקשות הזמנה מהאתר</h2><div class="meta">לקוחות שהשאירו פרטים באתר ההזמנה. אשר כדי ליצור הזמנה, או דחה.</div><div class="row" style="margin-top:8px"><span class="meta">כתובת האתר לשיתוף:</span><a dir="ltr" href="book.html" target="_blank" id="rq_link"></a></div></div><div class="list" id="rq_list"></div></div>';
    $("rq_link").textContent=location.origin+"/book.html";rqWatch();X.tabs.requests.upd();
    function $(i){return document.getElementById(i)}
  },
  upd:function(){
    var el=document.getElementById("rq_list");if(!el)return;
    if(!RQ.loaded){el.innerHTML='<div class="panel empty">טוען…</div>';return}
    if(RQ.err){el.innerHTML='<div class="panel note">לא ניתן לטעון בקשות (ייתכן שחסרה הרשאה).</div>';return}
    if(!RQ.rows.length){el.innerHTML='<div class="panel empty">עדיין לא התקבלו בקשות מהאתר.</div>';return}
    var ST={new:["חדשה","warn"],converted:["נוצרה הזמנה","ok"],rejected:["נדחתה","bad"]};
    el.innerHTML=RQ.rows.map(function(r){
      var st=ST[r.status]||["",""];
      var msg="שלום "+r.name+", קיבלנו את בקשתך ל"+(r.unit_label||"")+" בתאריכים "+dmy(r.check_in)+" עד "+dmy(r.check_out)+". אנחנו בודקים וחוזרים אליך. כשר מירון.";
      return '<div class="opt"><div class="info"><h3>'+esc(r.name)+' <span class="pill '+st[1]+'">'+st[0]+'</span></h3><div class="meta">'+esc(r.unit_label||"")+' · '+dmy(r.check_in)+' עד '+dmy(r.check_out)+' · '+r.guests+' אורחים · <span dir="ltr">'+esc(r.phone)+'</span></div>'+(r.notes?'<div class="meta">'+esc(r.notes)+'</div>':'')+'</div><div class="row">'
       +(r.status==="new"?'<button class="btn sm primary" data-act="rqOk" data-id="'+r.id+'">אשר וצור הזמנה</button><button class="btn sm danger" data-act="rqNo" data-id="'+r.id+'">דחה</button>':'')
       +waBtn(r.phone,msg,"WhatsApp")+'</div></div>';
    }).join("");
  }
};
function rqSet(id,status){if(A().role==="viewer"){A().toast("צפייה בלבד");return Promise.resolve()}return sb().from("requests").update({status:status}).eq("id",id).then(rqLoad)}
function rqConvert(r){
  if(A().role==="viewer"){A().toast("צפייה בלבד");return}
  var a=A(),u=a.unitById(r.unit_id);
  if(!u){a.toast("היחידה כבר לא קיימת במערכת");return}
  var busy=a.S.bookings.some(function(b){return live(b)&&b.status!=="done"&&bUnit(b)===u.id&&a.overlap(r.check_in,r.check_out,b.in,b.out)});
  if(busy){a.toast("היחידה כבר תפוסה בתאריכים האלה");return}
  var total=a.estimate(u,r.check_in,r.check_out);
  a.save("bookings",a.newId("bookings"),{propId:u.houseId,unitId:u.id,source:"אתר",name:r.name,phone:r.phone,guests:r.guests,in:r.check_in,out:r.check_out,total:total,dep:0,pct:u.pct,status:"pending",notes:r.notes||"",ownerPaid:false,createdAt:Date.now()},"נוצרה הזמנה ממתינה").then(function(){rqSet(r.id,"converted")});
}

/* ---- חיפוש לקוח ---- */
X.q="";
X.tabs.search={
  mount:function(v){
    v.innerHTML='<div class="stack"><div class="panel"><h2>חיפוש לקוח</h2><label>שם או טלפון<input id="sq" type="search" autocomplete="off" placeholder="לדוגמה: כהן או 050"></label></div><div id="sr" class="list"></div></div>';
    var i=document.getElementById("sq");i.value=X.q||"";i.addEventListener("input",function(){X.q=i.value;X.tabs.search.upd()});
    X.tabs.search.upd();if(!X.q)i.focus();
  },
  upd:function(){
    var a=A(),el=document.getElementById("sr");if(!el)return;
    var q=(X.q||"").trim().toLowerCase(),qd=q.replace(/\D/g,"");
    if(q.length<2){el.innerHTML='<div class="panel empty">הקלד לפחות שתי אותיות או ספרות.</div>';return}
    var hits=a.S.bookings.filter(function(b){return (b.name||"").toLowerCase().indexOf(q)>=0||(qd.length>=3&&String(b.phone||"").replace(/\D/g,"").indexOf(qd)>=0)});
    if(!hits.length){el.innerHTML='<div class="panel empty">לא נמצאו לקוחות.</div>';return}
    var groups={};hits.forEach(function(b){var k=String(b.phone||"").replace(/\D/g,"")||b.name;(groups[k]=groups[k]||[]).push(b)});
    el.innerHTML=Object.keys(groups).map(function(k){
      var bs=groups[k].sort(function(x,y){return (y.in||"").localeCompare(x.in||"")}),first=bs[0];
      var sum=bs.filter(live).reduce(function(s,b){return s+(b.total||0)},0);
      return '<div class="panel stack"><div class="row between"><div><h3>'+esc(first.name)+'</h3><div class="meta"><span dir="ltr">'+esc(first.phone||"")+'</span> · '+bs.filter(live).length+' הזמנות · סך '+a.money(sum)+'</div></div><div class="row">'+(first.phone?'<a class="btn sm" href="tel:'+esc(first.phone)+'">חייג</a>':'')+waBtn(first.phone,"שלום "+first.name+", ","WhatsApp")+'</div></div>'
       +bs.map(function(b){var st=a.STATUS[b.status]||["",""];
         return '<div class="opt"><div class="info"><b>'+esc(a.unitLabel(b))+'</b> <span class="pill '+st[1]+'">'+st[0]+'</span><div class="meta">'+dmy(b.in)+' עד '+dmy(b.out)+' · '+a.money(b.total)+' · שולם '+a.money(b.dep)+'</div></div><div class="row">'
          +waBtn(b.phone,MSG.confirm(b),"הודעת אישור")+'<button class="btn sm" data-act="voucher" data-id="'+b.id+'">שובר להדפסה</button>'+((b.dep||0)<(b.total||0)?waBtn(b.phone,MSG.deposit(b),"תזכורת מקדמה"):"")+'</div></div>'}).join("")+'</div>';
    }).join("");
  }
};

/* ---- דוח לבעל בית ---- */
X.rep={owner:"",month:""};
function owners(){var a=A(),m={};a.S.props.forEach(function(p){if(p.owner)m[p.owner]=p.ownerPhone||m[p.owner]||""});return m}
X.tabs.report={
  mount:function(v){
    var a=A(),os=Object.keys(owners()),months={};
    a.S.bookings.forEach(function(b){if(b.in)months[b.in.slice(0,7)]=1});
    var ms=Object.keys(months).sort().reverse();if(!X.rep.month)X.rep.month=ms[0]||a.today().slice(0,7);
    if(!X.rep.owner)X.rep.owner=os[0]||"";
    v.innerHTML='<div class="stack"><div class="panel noprint"><h2>דוח חודשי לבעל בית</h2><div class="grid2"><label>בעל בית<select id="rp_o">'+os.map(function(o){return '<option '+(o===X.rep.owner?'selected':'')+'>'+esc(o)+'</option>'}).join("")+'</select></label><label>חודש<select id="rp_m">'+(ms.length?ms:[X.rep.month]).map(function(m){return '<option '+(m===X.rep.month?'selected':'')+'>'+m+'</option>'}).join("")+'</select></label></div><div class="row" style="margin-top:10px"><button class="btn primary" data-act="rpPrint">הדפס / שמור כ־PDF</button><span id="rp_wa"></span></div></div><div class="panel" id="rp_out"></div></div>';
    document.getElementById("rp_o").onchange=function(e){X.rep.owner=e.target.value;X.tabs.report.upd()};
    document.getElementById("rp_m").onchange=function(e){X.rep.month=e.target.value;X.tabs.report.upd()};
    X.tabs.report.upd();
  },
  upd:function(){
    var a=A(),out=document.getElementById("rp_out");if(!out)return;
    var o=X.rep.owner,m=X.rep.month,hs={};
    a.S.props.forEach(function(p){if(p.owner===o)hs[p.id]=p});
    var bs=a.S.bookings.filter(function(b){return hs[b.propId]&&b.in&&b.in.slice(0,7)===m&&(b.status==="confirmed"||b.status==="in"||b.status==="done")});
    var gross=0,comm=0;
    var rows=bs.sort(function(x,y){return x.in.localeCompare(y.in)}).map(function(b){var c=a.commission(b);gross+=b.total||0;comm+=c;
      return '<tr><td>'+esc(a.unitLabel(b))+'</td><td>'+esc(b.name)+'</td><td>'+dmy(b.in)+' עד '+dmy(b.out)+'</td><td class="num">'+a.money(b.total)+'</td><td class="num">'+a.money(c)+'</td><td class="num">'+a.money((b.total||0)-c)+'</td></tr>'}).join("");
    var costs=a.extraCosts(m).filter(function(c){return c.chg&&hs[c.houseId]});
    var ded=costs.reduce(function(s,c){return s+c.amount},0);
    var net=gross-comm-ded;
    out.innerHTML='<h2>דוח חודשי · '+esc(o||"")+'</h2><div class="meta">חודש '+m+' · מופק '+dmy(a.today())+' · כשר מירון</div>'
     +'<div class="stats" style="margin:14px 0"><div class="stat"><b>'+a.money(gross)+'</b><span>הכנסות מהזמנות</span></div><div class="stat"><b>'+a.money(comm)+'</b><span>עמלה</span></div><div class="stat"><b>'+a.money(ded)+'</b><span>ניכויים (תחזוקה וחשבונות)</span></div><div class="stat"><b>'+a.money(net)+'</b><span>לתשלום לבעל הבית</span></div></div>'
     +(rows?'<div class="scroll"><table><thead><tr><th>יחידה</th><th>אורח</th><th>תאריכים</th><th>סכום</th><th>עמלה</th><th>נטו</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">אין הזמנות בחודש הזה.</div>')
     +(costs.length?'<h3 style="margin-top:14px">ניכויים</h3><div class="scroll"><table><thead><tr><th>סעיף</th><th>סכום</th></tr></thead><tbody>'+costs.map(function(c){return '<tr><td>'+esc(c.cat||"")+' '+esc(c.desc||"")+'</td><td class="num">'+a.money(c.amount)+'</td></tr>'}).join("")+'</tbody></table></div>':'');
    var ph=owners()[o],w=document.getElementById("rp_wa");
    if(w)w.innerHTML=waBtn(ph,"שלום "+o+", סיכום חודש "+m+": הכנסות ₪"+Math.round(gross)+", עמלה ₪"+Math.round(comm)+", ניכויים ₪"+Math.round(ded)+". לתשלום אליך: ₪"+Math.round(net)+". כשר מירון.","שלח סיכום ב־WhatsApp");
  }
};

/* ---- התראות ---- */
function alertsList(){
  var a=A(),S=a.S,t=a.today(),soon=a.addDays(t,14),L=[];
  if(RQ.rows.filter(function(r){return r.status==="new"}).length)L.push({sev:"warn",text:RQ.rows.filter(function(r){return r.status==="new"}).length+" בקשות חדשות מהאתר ממתינות לטיפול",tab:"requests"});
  S.bookings.filter(function(b){return b.status==="pending"&&b.in>=t&&b.in<=a.addDays(t,7)}).forEach(function(b){L.push({sev:"bad",text:"הזמנה לא מאושרת לשבוע הקרוב: "+b.name+" · "+a.unitLabel(b)+" · "+dmy(b.in),tab:"bookings"})});
  S.bookings.filter(function(b){return live(b)&&b.status!=="done"&&b.in>=t&&b.in<=soon&&(b.dep||0)<=0}).forEach(function(b){L.push({sev:"warn",text:"לא התקבלה מקדמה: "+b.name+" · "+dmy(b.in),wa:waBtn(b.phone,MSG.deposit(b),"תזכורת")})});
  S.bookings.filter(function(b){return live(b)&&b.out>=t&&b.out<=a.addDays(t,3)}).forEach(function(b){
    var c=S.cleans.filter(function(x){return x.id==="clean_"+b.id&&x.done})[0];
    if(!c)L.push({sev:"warn",text:"ניקיון לא שובץ/בוצע ליציאה "+dmy(b.out)+" · "+a.unitLabel(b),tab:"ops"})});
  S.bills.filter(function(b){return !b.paid}).forEach(function(b){var h=a.propById(b.houseId);L.push({sev:b.due&&b.due<t?"bad":"warn",text:"חשבון לא שולם: "+(b.type||"")+" · "+(h?h.name:"")+" · "+a.money(b.amount)+(b.due?" · עד "+dmy(b.due):""),tab:"bills"})});
  S.tasks.filter(function(x){return x.status!=="done"&&x.pri==="high"}).forEach(function(x){var h=a.propById(x.houseId);L.push({sev:"bad",text:"תקלה דחופה: "+x.title+(h?" · "+h.name:""),tab:"ops"})});
  return L;
}
X.tabs.alerts={
  mount:function(v){v.innerHTML='<div class="stack"><div class="panel"><h2>התראות</h2><div class="meta">דברים שדורשים טיפול עכשיו. מתעדכן לבד.</div></div><div id="al_l" class="list"></div></div>';X.tabs.alerts.upd()},
  upd:function(){
    var el=document.getElementById("al_l");if(!el)return;var L=alertsList();
    el.innerHTML=L.length?L.map(function(x){return '<div class="opt"><div class="info"><span class="pill '+x.sev+'">'+(x.sev==="bad"?"דחוף":"לתשומת לב")+'</span> '+esc(x.text)+'</div><div class="row">'+(x.wa||"")+(x.tab?'<button class="btn sm" data-tab="'+x.tab+'">פתח</button>':'')+'</div></div>'}).join(""):'<div class="panel empty">אין התראות. הכול מסודר.</div>';
  }
};
X.dashAlerts=function(el){
  var L=alertsList();if(!L.length)return;
  el.insertAdjacentHTML("afterbegin",L.slice(0,6).map(function(x){return '<div class="alert">'+esc(x.text)+(x.tab?' <button class="btn sm" data-tab="'+x.tab+'">פתח</button>':'')+'</div>'}).join("")+(L.length>6?'<div class="meta"><button class="btn sm" data-tab="alerts">עוד '+(L.length-6)+' התראות</button></div>':''));
};
X.badge=function(){
  if(!A().S.ready)return;
  var n=alertsList().length,b=document.querySelector('#tabs [data-tab="alerts"]');if(!b)return;
  var s=b.querySelector(".bdg");if(!n){if(s)s.remove();return}
  if(!s){s=document.createElement("span");s.className="bdg";b.appendChild(s)}s.textContent=n;
};
setInterval(function(){try{X.badge()}catch(e){}},3000);

/* ---- תחזית שבתות ---- */
X.tabs.forecast={
  mount:function(v){v.innerHTML='<div class="stack"><div class="panel"><h2>תחזית שבתות</h2><div class="meta">תפוסה ועמלה צפויה ל־8 השבתות הקרובות, והמלצות לפעולה.</div></div><div class="panel" id="fc_t"></div><div class="panel" id="fc_r"></div></div>';X.tabs.forecast.upd()},
  upd:function(){
    var a=A(),el=document.getElementById("fc_t");if(!el)return;
    var us=a.bookables(),fr=a.nextFriday(),rows=[],recs=[];
    for(var i=0;i<8;i++){
      var f=a.addDays(fr,7*i),e=a.addDays(f,2),occ=0,comm=0,free=[];
      us.forEach(function(u){
        var bs=a.S.bookings.filter(function(b){return live(b)&&b.status!=="done"&&(b.unitId||b.propId)===u.id&&a.overlap(f,e,b.in,b.out)});
        if(bs.length){occ++;bs.forEach(function(b){var n=Math.max(1,a.nights(b.in,b.out));comm+=a.commission(b)*Math.min(2,n)/n})}else free.push(u.name);
      });
      var pct=us.length?Math.round(occ*100/us.length):0;
      rows.push({f:f,pct:pct,occ:occ,n:us.length,comm:comm,free:free});
      if(i<3&&us.length&&pct<50)recs.push("שבת "+a.heb(f)+" ("+dmy(f)+"): תפוסה "+pct+"%. כדאי לפרסם או להציע הנחה ל־"+free.length+" יחידות פנויות.");
    }
    el.innerHTML=us.length?rows.map(function(r){return '<div class="barrow"><span>'+dmy(r.f).slice(0,5)+' · '+a.heb(r.f)+'</span><div class="barwrap"><div class="bar" style="width:'+r.pct+'%;background:'+(r.pct<50?'var(--warn)':'var(--accent)')+'"></div></div><span>'+r.pct+'% · '+r.occ+'/'+r.n+' · '+a.money(r.comm)+'</span></div>'}).join(""):'<div class="empty">הוסף בתים ויחידות כדי לראות תחזית.</div>';
    document.getElementById("fc_r").innerHTML='<h3>המלצות</h3>'+(recs.length?recs.map(function(x){return '<div class="alert">'+esc(x)+'</div>'}).join(""):'<div class="meta" style="margin-top:6px">השבתות הקרובות מלאות מספיק. אין המלצות.</div>');
  }
};

/* ---- גיבוי ---- */
function dl(name,text){var d=window.claude&&window.claude.use?window.claude.use("downloads"):null;if(!d)return;d.then(function(x){x.save({filename:name,data:new Blob([text],{type:"application/json"})})})}
async function fetchAll(){
  var all=[],from=0,step=1000;
  for(;;){var r=await sb().from("docs").select("col,id,data").order("col").order("id").range(from,from+step-1);if(r.error)throw r.error;all=all.concat(r.data);if(r.data.length<step)break;from+=step}
  return all;
}
X.tabs.backup={
  mount:function(v){
    v.innerHTML='<div class="stack"><div class="panel stack"><h2>גיבוי נתונים</h2><div class="meta">המערכת שומרת גיבוי אוטומטי כל לילה בשרת (30 הימים האחרונים). אפשר גם להוריד עותק לקובץ.</div><div class="row"><button class="btn primary" data-act="bkDl">הורד גיבוי מלא עכשיו</button></div></div><div class="panel"><h3>גיבויים אוטומטיים</h3><div id="bk_l" class="list" style="margin-top:8px">טוען…</div></div></div>';
    sb().from("backups").select("id,taken_at,rows").order("taken_at",{ascending:false}).limit(30).then(function(r){
      var el=document.getElementById("bk_l");if(!el)return;
      if(r.error){el.innerHTML='<div class="meta">הגיבוי האוטומטי עדיין לא הופעל בשרת.</div>';return}
      el.innerHTML=r.data.length?r.data.map(function(b){return '<div class="opt"><div class="info">'+new Date(b.taken_at).toLocaleString("he-IL")+' · '+b.rows+' רשומות</div><button class="btn sm" data-act="bkGet" data-id="'+b.id+'">הורד</button></div>'}).join(""):'<div class="meta">הגיבוי הראשון ייווצר הלילה.</div>';
    });
  }
};

/* ---- פעולות ---- */
X.act=function(act,id,el){
  var a=A();
  if(act==="rqOk"){var r=RQ.rows.filter(function(x){return x.id===id})[0];if(r)rqConvert(r);return true}
  if(act==="rqNo"){rqSet(id,"rejected");return true}
  if(act==="voucher"){
    var b=a.S.bookings.filter(function(x){return x.id===id})[0];if(!b)return true;
    var w=window.open("","_blank");if(!w){a.toast("הדפדפן חסם חלון חדש");return true}
    w.document.write('<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>שובר הזמנה</title><style>body{font:16px Arial,sans-serif;max-width:560px;margin:30px auto;padding:0 20px;color:#15222b}h1{margin:0 0 4px;color:#0d2b33}.s{color:#8a6a2a;font-size:12px;letter-spacing:.14em}table{width:100%;border-collapse:collapse;margin-top:18px}td{padding:10px 6px;border-bottom:1px solid #ddd}td:first-child{color:#667;width:38%}.f{margin-top:26px;font-size:13px;color:#667}</style><h1>כשר מירון</h1><div class="s">KASHER MERON</div><h2>שובר הזמנה</h2><table><tr><td>שם האורח</td><td>'+esc(b.name)+'</td></tr><tr><td>יחידה</td><td>'+esc(a.unitLabel(b))+'</td></tr><tr><td>כניסה</td><td>'+dmy(b.in)+'</td></tr><tr><td>יציאה</td><td>'+dmy(b.out)+'</td></tr><tr><td>אורחים</td><td>'+(b.guests||"")+'</td></tr><tr><td>סכום</td><td>₪'+Math.round(b.total||0)+'</td></tr><tr><td>שולם</td><td>₪'+Math.round(b.dep||0)+'</td></tr><tr><td>יתרה</td><td>₪'+Math.round((b.total||0)-(b.dep||0))+'</td></tr></table><div class="f">תודה שבחרתם בנו. נשמח לארח אתכם.</div><script>setTimeout(function(){print()},300)<\/script>');
    w.document.close();return true}
  if(act==="rpPrint"){window.print();return true}
  if(act==="bkDl"){a.toast("מכין גיבוי…");fetchAll().then(function(rows){dl("meron-backup-"+a.today()+".json",JSON.stringify({taken:new Date().toISOString(),docs:rows}))}).catch(function(){a.toast("הגיבוי נכשל")});return true}
  if(act==="bkGet"){sb().from("backups").select("taken_at,data").eq("id",id).single().then(function(r){if(r.error){a.toast("ההורדה נכשלה");return}dl("meron-backup-"+r.data.taken_at.slice(0,10)+".json",JSON.stringify({taken:r.data.taken_at,docs:r.data.data}))});return true}
  return false;
};

/* ---- מצב כהה, חיפוש מהיר בסרגל העליון ---- */
function theme(t){
  document.documentElement.setAttribute("data-theme",t);
  try{localStorage.setItem("kmTheme",t)}catch(e){}
  var b=document.getElementById("themebtn");if(b)b.textContent=t==="dark"?"מצב בהיר":"מצב כהה";
}
function initUI(){
  if(!window.MERON_APP){setTimeout(initUI,200);return}
  var t="light";try{t=localStorage.getItem("kmTheme")||(window.matchMedia&&matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light")}catch(e){}
  var sbtn=document.getElementById("sidebtns");
  if(sbtn&&!document.getElementById("themebtn")){var b=document.createElement("button");b.id="themebtn";b.className="btn sm";b.style.cssText="width:100%;margin-bottom:8px";b.onclick=function(){theme(document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark")};sbtn.insertBefore(b,sbtn.firstChild)}
  theme(t);
  var tb=document.querySelector(".topbar");
  if(tb&&!document.getElementById("qs")&&A().role!=="vendor"&&A().role!=="owner"){
    var f=document.createElement("input");f.id="qs";f.type="search";f.placeholder="חיפוש לקוח…";f.className="qs";
    f.addEventListener("keydown",function(e){if(e.key==="Enter"&&f.value.trim()){X.q=f.value.trim();f.value="";A().go("search")}});
    tb.appendChild(f);
  }
  if(A().role!=="vendor")rqWatch();
}
setTimeout(initUI,50);
})();
