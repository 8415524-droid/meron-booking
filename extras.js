/* תוספות: בקשות מהאתר, חיפוש לקוח, דוח לבעל בית, התראות, תחזית, גיבוי, מצב כהה.
   נטען לפני app.js. משתמש ב-window.MERON_APP (מוגדר ב-app.js) ובלקוח Supabase שב-window.MERON_SB. */
(function(){
var X=window.MERON_X={tabs:{}};
function A(){return window.MERON_APP}
function sb(){return window.MERON_SB}
function esc(s){return A().esc(s)}

/* ---- מאפייני דירה: מקלחות, שירותים, גינה, חצר ועוד (משותף לטפסים) ---- */
var FEAT=window.MERON_FEAT={
  counts:[["baths","מקלחות"],["toilets","שירותים"],["floor","קומה"],["sofas","ספות נפתחות"],["cribs","מיטות תינוק"],["parking","חניות"]],
  flags:[["garden","גינה"],["yard","חצר"],["balcony","מרפסת"],["sukka","מרפסת סוכה"],["ac","מזגן"],["heating","חימום"],["kitchen","מטבח מאובזר"],["plata","פלטה לשבת"],["fridge","מקרר גדול"],["washer","מכונת כביסה"],["linens","מצעים ומגבות"],["wifi","אינטרנט"],["elevator","מעלית"],["accessible","נגיש, בלי מדרגות"],["shelter","ממ״ד או מקלט"],["bbq","פינת מנגל"],["crib","מיטת תינוק זמינה"],["entrance","כניסה פרטית"]],
  html:function(f){f=f||{};var fl=f.flags||[];
    return '<details class="feat" style="grid-column:1/-1"><summary style="cursor:pointer;font-weight:600;color:var(--accent)">פרטים נוספים: מקלחות, שירותים, גינה, חצר ועוד</summary>'
     +'<div class="grid2" style="margin-top:8px">'+FEAT.counts.map(function(c){return '<label>'+c[1]+'<input class="f-n" data-k="'+c[0]+'" type="number" min="0" inputmode="numeric" value="'+(f[c[0]]===undefined||f[c[0]]===null?"":f[c[0]])+'"></label>'}).join("")+'</div>'
     +'<div class="featflags" style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px">'+FEAT.flags.map(function(c){return '<label style="flex-direction:row;align-items:center;gap:6px;font-size:13.5px;color:var(--ink)"><input class="f-f" type="checkbox" data-k="'+c[0]+'"'+(fl.indexOf(c[0])>-1?' checked':'')+' style="width:auto"> '+c[1]+'</label>'}).join("")+'</div></details>'},
  read:function(root){var o={flags:[]};
    [].slice.call(root.querySelectorAll(".f-n")).forEach(function(i){if(i.value!=="")o[i.dataset.k]=+i.value||0});
    [].slice.call(root.querySelectorAll(".f-f")).forEach(function(i){if(i.checked)o.flags.push(i.dataset.k)});return o},
  text:function(f){if(!f)return "";var p=[];
    FEAT.counts.forEach(function(c){if(f[c[0]]){p.push(f[c[0]]+" "+c[1])}});
    (f.flags||[]).forEach(function(k){FEAT.flags.forEach(function(c){if(c[0]===k)p.push(c[1])})});return p.join(" · ")}
};
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
  var co=(A().S.cfg&&A().S.cfg.company||"").trim(),ds=document.querySelector(".side .brand .desc");if(ds&&co&&ds.textContent!==co)ds.textContent=co;
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


/* ---- בעלי נכסים: רשימה והוספה מהירה ---- */
X.own={owner:"",phone:""};
function urow(v){v=v||{};return '<div class="urow grid2" style="align-items:end;border-top:1px solid var(--line);padding-top:8px"><label>שם יחידה<input class="u-name" value="'+esc(v.name||"")+'" placeholder="לדוגמה: דירה 1"></label><label>מיטות<input class="u-beds" type="number" min="1" value="'+(v.beds||"")+'" inputmode="numeric"></label><label>חדרים<input class="u-rooms" type="number" min="1" value="'+(v.rooms||"")+'" inputmode="numeric"></label><label>מחיר ללילה<input class="u-price" type="number" min="0" value="'+(v.price||"")+'" inputmode="numeric"></label><label>חבילת שבת<input class="u-sp" type="number" min="0" value="'+(v.sp||"")+'" inputmode="numeric"></label>'+FEAT.html(v.feat)+'<button type="button" class="btn sm danger" data-act="owDelRow">הסר</button></div>'}
function ownersData(){
  var a=A(),m={};
  a.S.props.forEach(function(p){var k=p.owner||"ללא בעלים";var o=m[k]||(m[k]={name:k,phone:p.ownerPhone||"",houses:[]});if(!o.phone&&p.ownerPhone)o.phone=p.ownerPhone;o.houses.push(p)});
  return Object.keys(m).sort(function(x,y){return x.localeCompare(y,"he")}).map(function(k){return m[k]});
}
X.tabs.owners={
  mount:function(v){
    v.innerHTML='<div class="stack"><div class="panel stack" id="ow_form"></div><div class="panel"><div class="row between"><h2>בעלי הנכסים</h2><input id="ow_q" type="search" placeholder="חיפוש בעל נכס או בית…" style="max-width:260px"></div></div><div id="ow_l" class="list"></div></div>';
    X.tabs.owners.form();
    document.getElementById("ow_q").addEventListener("input",X.tabs.owners.upd);
    X.tabs.owners.upd();
  },
  form:function(keepOwner){
    var el=document.getElementById("ow_form");if(!el)return;
    el.innerHTML='<div><h2>הוספת בעל נכס ובית</h2><div class="meta">ממלאים פעם אחת: בעל הנכס, הבית, והיחידות שבו. אפשר להוסיף אחר כך בית נוסף לאותו בעל.</div></div>'
     +'<div class="grid2"><label>שם בעל הנכס<input id="ow_n" value="'+esc(keepOwner?X.own.owner:"")+'" list="ow_names" autocomplete="off"></label><label>טלפון<input id="ow_p" type="tel" dir="ltr" style="text-align:right" value="'+esc(keepOwner?X.own.phone:"")+'"></label></div>'
     +'<datalist id="ow_names">'+ownersData().map(function(o){return '<option value="'+esc(o.name)+'">'}).join("")+'</datalist>'
     +'<div class="grid2"><label>שם הבית<input id="ow_h"></label><label>אזור או כתובת<input id="ow_a"></label><label>מסלול<select id="ow_m"><option value="regular">רגיל</option><option value="exclusive">בלעדי</option></select></label><label>עמלה באחוזים<input id="ow_c" type="number" min="0" max="100" value="15"></label><label>עלות ניקיון ליציאה<input id="ow_cl" type="number" min="0" value="150"></label></div>'
     +'<h3>יחידות השכרה בבית</h3><div class="meta">אם יש יחידה אחת בלבד אפשר להשאיר את השם ריק.</div><div id="ow_units" class="stack" style="gap:8px">'+urow()+'</div>'
     +'<div class="row"><button type="button" class="btn sm" data-act="owAddRow">הוסף יחידה</button></div><div class="note" id="ow_err" hidden></div>'
     +'<div class="row"><button type="button" class="btn primary" data-act="owSave">שמור</button><button type="button" class="btn" data-act="owSaveMore">שמור והוסף בית נוסף לאותו בעל</button></div>';
  },
  upd:function(){
    var a=A(),el=document.getElementById("ow_l");if(!el)return;
    var q=((document.getElementById("ow_q")||{}).value||"").trim().toLowerCase();
    var os=ownersData().filter(function(o){return !q||o.name.toLowerCase().indexOf(q)>=0||o.houses.some(function(h){return (h.name||"").toLowerCase().indexOf(q)>=0})});
    if(!os.length){el.innerHTML='<div class="panel empty">'+(q?'לא נמצאו תוצאות.':'עדיין אין בעלי נכסים. הוסף את הראשון בטופס למעלה.')+'</div>';return}
    el.innerHTML=os.map(function(o){
      var us=0,beds=0;
      var hh=o.houses.map(function(h){var u=a.S.units.filter(function(x){return x.houseId===h.id});us+=u.length||1;beds+=u.length?u.reduce(function(s,x){return s+(+x.beds||0)},0):(+h.beds||0);
        return '<div class="meta"><b>'+esc(h.name)+'</b>'+(h.area?' · '+esc(h.area):'')+' · '+(u.length?u.map(function(x){return esc(x.name)}).join("، "):'יחידה אחת')+' · עמלה '+(h.pct!=null?h.pct:15)+'%'+(h.active===false?' · <span class="pill bad">לא פעיל</span>':'')+'</div>'}).join("");
      return '<div class="panel stack"><div class="row between"><div><h3>'+esc(o.name)+'</h3><div class="meta">'+(o.phone?'<span dir="ltr">'+esc(o.phone)+'</span> · ':'')+o.houses.length+' בתים · '+us+' יחידות · '+beds+' מיטות</div></div><div class="row">'
       +(o.phone?'<a class="btn sm" href="tel:'+esc(o.phone)+'">חייג</a>'+waBtn(o.phone,"שלום "+o.name+", ","WhatsApp"):'')
       +'<button class="btn sm" data-act="owMore" data-id="'+esc(o.name)+'">הוסף בית</button><button class="btn sm" data-act="owEdit" data-id="'+esc(o.name)+'">ערוך פרטים</button></div></div>'+hh+'</div>';
    }).join("");
  }
};
function owSave(more){
  var a=A();if(a.role==="viewer"){a.toast("צפייה בלבד");return}
  var $=function(i){return document.getElementById(i)},err=$("ow_err");
  function bad(t){err.textContent=t;err.hidden=false}
  var owner=$("ow_n").value.trim(),phone=$("ow_p").value.trim(),hn=$("ow_h").value.trim();
  if(!owner)return bad("חסר שם בעל הנכס");if(!hn)return bad("חסר שם הבית");
  var rows=[].slice.call(document.querySelectorAll("#ow_units .urow")).map(function(r){var g=function(c){return r.querySelector(c).value.trim()};return {name:g(".u-name"),beds:+g(".u-beds")||0,rooms:+g(".u-rooms")||0,price:+g(".u-price")||0,sp:+g(".u-sp")||0,feat:FEAT.read(r)}});
  var named=rows.filter(function(r){return r.name});
  if(rows.length>1&&named.length!==rows.length)return bad("בכל יחידה צריך שם, כשיש יותר מיחידה אחת");
  var base=rows[0]||{};
  var beds=rows.reduce(function(s,r){return s+r.beds},0)||1,rooms=rows.reduce(function(s,r){return s+r.rooms},0)||1;
  var hid=a.newId("properties");
  var house={name:hn,area:$("ow_a").value.trim(),beds:beds,rooms:rooms,price:base.price||0,shabbatPrice:base.sp||0,feat:base.feat||{flags:[]},owner:owner,ownerPhone:phone,mode:$("ow_m").value,pct:+$("ow_c").value||0,cleanCost:+$("ow_cl").value||0,notes:"",active:true};
  err.hidden=true;
  var jobs=[a.save("properties",hid,house)];
  if(named.length)named.forEach(function(r){jobs.push(a.save("units",a.newId("units"),{houseId:hid,name:r.name,beds:r.beds||1,rooms:r.rooms||1,price:r.price,shabbatPrice:r.sp,feat:r.feat,active:true}))});
  Promise.all(jobs).then(function(){
    X.own={owner:owner,phone:phone};
    a.toast("נשמר: "+hn+(named.length?" ("+named.length+" יחידות)":""));
    X.tabs.owners.form(more);X.tabs.owners.upd();
    window.scrollTo({top:0,behavior:"smooth"});
  });
}


/* ---- משתמשים והרשאות ---- */
var RL={admin:"מנהל",agent:"נציג טלפוני",owner:"בעל בית",vendor:"איש מקצוע",partner:"שותף",viewer:"צפייה בלבד",guest:"אורח (קישור)"};
var US={rows:[],loaded:false,err:null,edit:null};
function usLoad(){
  sb().rpc("staff_list").then(function(r){
    US.loaded=true;if(r.error){US.err=r.error.message;US.rows=[]}else{US.err=null;US.rows=r.data||[]}
    if(A().S.tab==="users")X.tabs.users.upd();
  });
}
X.tabs.users={
  mount:function(v){
    v.innerHTML='<div class="stack"><div class="panel stack" id="us_form"></div><div class="panel"><h2>משתמשים מורשים</h2><div class="meta">מי יכול להיכנס ומה הוא רואה. משתמש חדש צריך להיווצר גם ב־Supabase (Authentication ואז Users ואז Add user), ואז כאן מגדירים לו תפקיד.</div></div><div id="us_l" class="list"></div></div>';
    X.tabs.users.form();usLoad();
  },
  form:function(){
    var a=A(),el=document.getElementById("us_form");if(!el)return;var e=US.edit||{role:"agent",houses:[]};
    el.innerHTML='<h3>'+(US.edit?'עריכת משתמש':'הוספת משתמש מורשה')+'</h3><div class="grid2"><label>אימייל<input id="us_e" type="email" dir="ltr" style="text-align:right" value="'+esc(e.email||"")+'" '+(US.edit?'readonly':'')+'></label><label>תפקיד<select id="us_r">'+Object.keys(RL).map(function(k){return '<option value="'+k+'" '+(k===e.role?'selected':'')+'>'+RL[k]+'</option>'}).join("")+'</select></label><label>שם או הערה<input id="us_n" value="'+esc(e.note||"")+'"></label><label id="us_vw">שם איש המקצוע (כפי שמופיע בקריאות)<input id="us_v" value="'+esc(e.vendor||"")+'"></label></div>'
     +'<div id="us_hw"><div class="meta">בתים שבעל הבית רואה:</div><div class="chips" style="margin-top:6px">'+a.S.props.map(function(h){return '<label class="chip" style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" class="us-h" value="'+esc(h.id)+'" style="width:auto" '+((e.houses||[]).indexOf(h.id)>=0?'checked':'')+'>'+esc(h.name)+'</label>'}).join("")+'</div></div>'
     +'<div class="note" id="us_err" hidden></div><div class="row"><button class="btn primary" data-act="usSave">שמור</button>'+(US.edit?'<button class="btn" data-act="usCancel">ביטול</button>':'')+'</div>';
    function sync(){var r=document.getElementById("us_r").value;document.getElementById("us_hw").hidden=r!=="owner";document.getElementById("us_vw").hidden=r!=="vendor"}
    document.getElementById("us_r").onchange=sync;sync();
  },
  upd:function(){
    var el=document.getElementById("us_l");if(!el)return;
    if(!US.loaded){el.innerHTML='<div class="panel empty">טוען…</div>';return}
    if(US.err){el.innerHTML='<div class="panel note">לא ניתן לטעון (ייתכן שהסקריפט staff-admin.sql עדיין לא הורץ): '+esc(US.err)+'</div>';return}
    el.innerHTML=US.rows.map(function(u){
      var hs=(u.houses||[]).map(function(id){var h=A().propById(id);return h?h.name:id}).join("، ");
      return '<div class="opt"><div class="info"><h3 dir="ltr" style="text-align:right">'+esc(u.email)+' <span class="pill">'+esc(RL[u.role]||u.role)+'</span></h3><div class="meta">'+esc(u.note||"")+(hs?' · בתים: '+esc(hs):'')+(u.vendor?' · איש מקצוע: '+esc(u.vendor):'')+'</div></div><div class="row"><button class="btn sm" data-act="usEdit" data-id="'+esc(u.email)+'">ערוך</button><button class="btn sm danger" data-act="usDel" data-id="'+esc(u.email)+'">הסר</button></div></div>';
    }).join("")||'<div class="panel empty">אין משתמשים.</div>';
  }
};


/* ---- מרכזיה (טכנוליין) ---- */
var PB={cfg:null,err:null,loaded:false};
function pbLoad(){sb().rpc("pbx_get_config").then(function(r){PB.loaded=true;if(r.error){PB.err=r.error.message;PB.cfg=null}else{PB.err=null;PB.cfg=r.data}if(A().S.tab==="pbx")X.tabs.pbx.upd()})}
X.tabs.pbx={
  mount:function(v){v.innerHTML='<div class="stack"><div class="panel stack" id="pb_box"></div></div>';pbLoad();X.tabs.pbx.upd()},
  upd:function(){
    var el=document.getElementById("pb_box");if(!el)return;
    if(!PB.loaded){el.innerHTML='<div class="empty">טוען…</div>';return}
    if(PB.err||!PB.cfg){el.innerHTML='<div class="note">לא ניתן לטעון. ייתכן שהסקריפט supabase/pbx.sql עדיין לא הורץ ב-Supabase. '+esc(PB.err||"")+'</div>';return}
    var c=PB.cfg,url=location.origin+"/api/pbx/"+c.secret;
    el.innerHTML='<h2>מרכזיה (טכנוליין)</h2>'
     +'<div class="meta">שתי שלוחות: <b>1</b> מעבירה להזמנות ולשירות לקוחות, <b>2</b> מזהה לקוח קיים לפי מספר הטלפון שממנו התקשר, ומחברת אותו ישירות למארח של ההזמנה שלו. אם יש כמה הזמנות פעילות, הלקוח בוחר. בלי הזמנה פעילה, מחברים לפי ההזמנה האחרונה.</div>'
     +'<label>כתובת להזנה בטכנוליין (שלוחה מסוג API)<input id="pb_url" readonly dir="ltr" style="text-align:left" value="'+esc(url)+'"></label>'
     +'<div class="row"><button class="btn sm" data-act="pbCopy">העתק כתובת</button><button class="btn sm danger" data-act="pbRot">החלף סוד (מבטל את הכתובת הקודמת)</button></div>'
     +'<div class="grid2"><label>טלפון הזמנות ושירות לקוחות<input id="pb_svc" type="tel" dir="ltr" style="text-align:right" value="'+esc(c.service_phone)+'"></label>'
     +'<label>מפתח API של טכנוליין (אופציונלי)<input id="pb_key" type="password" dir="ltr" style="text-align:right" placeholder="'+(c.has_key?"נשמר, השאר ריק כדי לא לשנות":"לא הוגדר")+'"></label></div>'
     +'<label style="flex-direction:row;align-items:center;gap:8px"><input id="pb_cb" type="checkbox" style="width:auto"'+(c.callback_on?' checked':'')+'> צינתוק ללקוח אחרי הזמנה ואישור מקדמה (לפי טלפון המארח בנכס)</label>'
     +'<div class="note">הצינתוק יפעל רק אחרי שטכנוליין יאשרו כתובת IP קבועה ליציאה אליהם. עד אז הניסיון ייכשל והסיבה תירשם בהזמנה.</div>'
     +'<div class="row"><button class="btn primary" data-act="pbSave">שמור</button></div><div class="meta" id="pb_msg"></div>'}
};


/* צינתוק ללקוח אחרי מקדמה: נקרא מ-app.js */
window.MERON_PBX_CB=function(bookingId){
  if(!sb()||!sb().auth)return;
  sb().auth.getSession().then(function(s){
    var t=s&&s.data&&s.data.session&&s.data.session.access_token;if(!t)return;
    fetch("/api/pbx-callback",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({booking:bookingId})})
     .then(function(r){return r.json()}).then(function(j){if(j&&j.skipped)return;A().toast(j&&j.ok?j.note:(j&&(j.error||j.note))||"הצינתוק נכשל")}).catch(function(){});
  });
};


/* ---- קבלות ---- */
var RC={};
function rcModal(html){var m=document.getElementById("rc_modal");if(!m){m=document.createElement("div");m.id="rc_modal";m.style.cssText="position:fixed;inset:0;z-index:70;background:rgba(5,15,18,.55);display:flex;align-items:center;justify-content:center;padding:16px";m.addEventListener("click",function(ev){if(ev.target===m)m.remove()});document.body.appendChild(m)}
  m.innerHTML='<div class="panel stack" style="max-width:480px;width:100%;max-height:90vh;overflow:auto">'+html+'<div class="row"><button class="btn" data-act="rcClose">סגור</button></div></div>'}
function rcUrl(r){return location.origin+"/receipt.html?t="+r.token}
function rcRow(r){var u=rcUrl(r);var A_=A();
  return '<div class="opt"><div class="info"><b>קבלה '+esc(r.no)+'</b><div class="meta">'+esc(r.date)+' · '+A_.money(r.amount)+(r.method?' · '+esc(r.method):'')+'</div></div><div class="row">'
   +'<a class="btn sm" href="'+esc(u)+'" target="_blank" rel="noopener">פתח</a>'
   +(window.MERON_CUST&&window.MERON_CUST.get(r.phone)&&window.MERON_CUST.get(r.phone).kosher?'':'<a class="btn sm" target="_blank" rel="noopener" href="'+esc(wa(r.phone,"שלום "+(r.customer||"")+", מצורפת קבלה מספר "+r.no+" על סך "+A_.money(r.amount)+": "+u)||"#")+'">שלח בוואטסאפ</a>')
   +'<button class="btn sm" data-act="rcCopy" data-id="'+esc(u)+'">העתק קישור</button></div></div>'}
function rcShow(bookingId,msg){
  var a=A();
  sb().from("docs").select("data").eq("col","receipts").filter("data->>booking","eq",bookingId).then(function(r){
    var rows=(r.data||[]).map(function(x){return x.data}).sort(function(p,q){return q.no-p.no});
    var b=a.S.bookings.filter(function(x){return x.id===bookingId})[0];
    rcModal('<h3>קבלות להזמנה'+(b?' של '+esc(b.name):'')+'</h3>'+(msg?'<div class="note">'+esc(msg)+'</div>':'')
     +(rows.length?rows.map(rcRow).join(""):'<div class="meta">עדיין לא הונפקו קבלות להזמנה הזו.</div>')
     +(a.role==="viewer"?'':'<h3 style="margin-top:8px">הפקת קבלה חדשה</h3><div class="grid2"><label>סכום שהתקבל (₪)<input id="rc_amt" type="number" min="1" inputmode="numeric"></label><label>אמצעי תשלום<select id="rc_m"><option>מזומן</option><option>אשראי</option><option>העברה בנקאית</option><option>צ׳ק</option><option>ביט או פייבוקס</option></select></label></div><div class="row"><button class="btn primary" data-act="rcNew" data-id="'+esc(bookingId)+'">הפק קבלה</button></div>'));
  });
}
window.MERON_RCPT={
  show:rcShow,
  issue:function(bookingId,amount,method,quiet){
    return sb().rpc("issue_receipt",{p_booking:bookingId,p_amount:amount,p_method:method||""}).then(function(r){
      if(r.error){A().toast("הפקת הקבלה נכשלה: "+r.error.message);return null}
      rcShow(bookingId,"קבלה מספר "+r.data.no+" הופקה. אפשר לשלוח אותה ללקוח בוואטסאפ או להעתיק את הקישור.");return r.data});
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
  if(act==="owAddRow"){var c=document.getElementById("ow_units"),last=c.querySelector(".urow:last-child");var v={};if(last){v={beds:last.querySelector(".u-beds").value,rooms:last.querySelector(".u-rooms").value,price:last.querySelector(".u-price").value,sp:last.querySelector(".u-sp").value,feat:FEAT.read(last)}}c.insertAdjacentHTML("beforeend",urow(v));var n=c.querySelectorAll(".u-name");n[n.length-1].focus();return true}
  if(act==="owDelRow"){var r=el.closest(".urow");if(document.querySelectorAll("#ow_units .urow").length>1)r.remove();return true}
  if(act==="owSave"){owSave(false);return true}
  if(act==="owSaveMore"){owSave(true);return true}
  if(act==="owMore"){var o=ownersData().filter(function(x){return x.name===id})[0];X.own={owner:id,phone:o?o.phone:""};X.tabs.owners.form(true);window.scrollTo({top:0,behavior:"smooth"});document.getElementById("ow_h").focus();return true}
  if(act==="owEdit"){
    if(a.role==="viewer"){a.toast("צפייה בלבד");return true}
    var o2=ownersData().filter(function(x){return x.name===id})[0];if(!o2)return true;
    var nn=prompt("שם בעל הנכס:",o2.name);if(nn==null)return true;nn=nn.trim()||o2.name;
    var np=prompt("טלפון:",o2.phone||"");if(np==null)return true;
    Promise.all(o2.houses.map(function(h){return a.save("properties",h.id,(function(d){delete d.id;d.owner=nn;d.ownerPhone=np.trim();return d})(Object.assign({},h)))})).then(function(){a.toast("הפרטים עודכנו")});return true}
  if(act==="pbCopy"){var u=document.getElementById("pb_url");u.select();try{document.execCommand("copy");a.toast("הכתובת הועתקה")}catch(x){}return true}
  if(act==="pbRot"){if(!confirm("להחליף את הסוד? צריך לעדכן את הכתובת החדשה בטכנוליין."))return true;sb().rpc("pbx_rotate_secret").then(function(r){a.toast(r.error?"נכשל":"הסוד הוחלף, עדכן בטכנוליין");pbLoad()});return true}
  if(act==="pbSave"){var m=document.getElementById("pb_msg");sb().rpc("pbx_set_config",{p_service:document.getElementById("pb_svc").value,p_key:document.getElementById("pb_key").value,p_callback:document.getElementById("pb_cb").checked}).then(function(r){m.textContent=r.error?"השמירה נכשלה: "+r.error.message:"נשמר";if(!r.error)pbLoad()});return true}
  if(act==="rcClose"){var mm=document.getElementById("rc_modal");if(mm)mm.remove();return true}
  if(act==="rcCopy"){try{navigator.clipboard.writeText(id);a.toast("הקישור הועתק")}catch(x){a.toast(id)}return true}
  if(act==="rcShow"){rcShow(id);return true}
  if(act==="rcNew"){var amt=+document.getElementById("rc_amt").value;if(!(amt>0)){a.toast("הזן סכום");return true}window.MERON_RCPT.issue(id,amt,document.getElementById("rc_m").value);return true}
  if(act==="usEdit"){US.edit=US.rows.filter(function(u){return u.email===id})[0]||null;X.tabs.users.form();window.scrollTo({top:0,behavior:"smooth"});return true}
  if(act==="usCancel"){US.edit=null;X.tabs.users.form();return true}
  if(act==="usDel"){if(!confirm("להסיר את "+id+" מהמורשים? הוא לא יוכל להיכנס."))return true;sb().rpc("staff_delete",{p_email:id}).then(function(r){a.toast(r.error?"המחיקה נכשלה":"הוסר");usLoad()});return true}
  if(act==="usSave"){
    var em=document.getElementById("us_e").value.trim(),ro=document.getElementById("us_r").value,er=document.getElementById("us_err");
    if(em.indexOf("@")<1){er.textContent="כתובת אימייל לא תקינה";er.hidden=false;return true}
    var hs=[].slice.call(document.querySelectorAll(".us-h:checked")).map(function(c){return c.value});
    if(ro==="owner"&&!hs.length){er.textContent="בחר לפחות בית אחד לבעל הבית";er.hidden=false;return true}
    sb().rpc("staff_save",{p_email:em,p_role:ro,p_houses:ro==="owner"?hs:[],p_vendor:ro==="vendor"?document.getElementById("us_v").value:null,p_note:document.getElementById("us_n").value.trim()}).then(function(r){
      if(r.error){er.textContent="השמירה נכשלה: "+r.error.message;er.hidden=false;return}
      a.toast("נשמר");US.edit=null;X.tabs.users.form();usLoad();
    });return true}
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
