/* מתאם בין האפליקציה (app.js) לבין Supabase, וכניסה עם משתמש וסיסמה.
   האפליקציה מדברת עם window.claude.use("db"), כאן מוגדר אותו ממשק מעל טבלת docs. */
(function(){
  var CFG=window.MERON_CONFIG||{};
  var configured=CFG.url&&CFG.url.indexOf("REPLACE")<0&&CFG.anonKey&&CFG.anonKey!=="REPLACE";
  var sb=configured?window.supabase.createClient(CFG.url,CFG.anonKey):null;

  function newId(){var a=new Uint8Array(10);crypto.getRandomValues(a);return Array.prototype.map.call(a,function(x){return (x%36).toString(36)}).join("")}
  function snapDoc(id,d){return {id:id,exists:d!=null,data:function(){return d}}}

  function docRef(col,id){
    return {
      id:id,
      set:function(d){return sb.from("docs").upsert({col:col,id:id,data:d}).then(check)},
      delete:function(){return sb.from("docs").delete().eq("col",col).eq("id",id).then(check)},
      onSnapshot:function(next,err){return watch(col,id,function(rows){var r=rows[0];next(snapDoc(id,r?r.data:null))},err)}
    };
  }
  function check(r){if(r.error){var e=new Error(r.error.message);e.code=/row-level|permission|denied/i.test(r.error.message)?"invalid_argument":"unavailable";throw e}return r}

  // מאזין לשורות של אוסף (או למסמך אחד אם id נתון), עם עדכון חי
  function watch(col,id,cb,err){
    var rows=new Map(),dead=false,ch=null;
    function emit(){if(!dead)cb(Array.from(rows.values()))}
    var q=sb.from("docs").select("id,data").eq("col",col);if(id)q=q.eq("id",id);
    q.then(function(r){
      if(dead)return;
      if(r.error){if(err)err({code:"unavailable",message:r.error.message});return}
      r.data.forEach(function(x){rows.set(x.id,x)});emit();
    });
    ch=sb.channel("w-"+col+"-"+(id||"all")+"-"+newId()).on("postgres_changes",{event:"*",schema:"public",table:"docs",filter:"col=eq."+col},function(p){
      var row=p.new&&p.new.id?p.new:null,oid=(p.old&&p.old.id)||(row&&row.id);
      if(id&&oid!==id)return;
      if(p.eventType==="DELETE")rows.delete(oid);else if(row)rows.set(row.id,{id:row.id,data:row.data});
      emit();
    }).subscribe();
    return function(){dead=true;if(ch)sb.removeChannel(ch)};
  }

  var db={
    collection:function(col){
      return {
        doc:function(id){return docRef(col,id||newId())},
        onSnapshot:function(next,err){return watch(col,null,function(rows){next({docs:rows.map(function(r){return snapDoc(r.id,r.data)})})},err)}
      };
    },
    doc:function(path){var p=path.split("/");return docRef(p[0],p.slice(1).join("_"))}
  };
  var downloads={save:function(o){
    return new Promise(function(res,rej){try{
      var blob=o.data instanceof Blob?o.data:new Blob([o.data],{type:"text/csv;charset=utf-8"});
      var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=o.filename;document.body.appendChild(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);res({status:"saved"});
    }catch(e){rej({code:"unavailable",message:String(e)})}});
  }};
  window.claude={use:function(name){return Promise.resolve(name==="db"?db:name==="downloads"?downloads:null)}};

  /* ---- כניסה ---- */
  function el(h){var d=document.createElement("div");d.innerHTML=h;return d.firstChild}
  function loadScript(src,cb){var s=document.createElement("script");s.src=src;s.onload=cb;document.body.appendChild(s)}
  function startApp(){
    sb.rpc("my_role").then(function(r){
      var role=r.error?"admin":r.data;
      if(!role){sb.auth.signOut().then(function(){document.body.innerHTML="";location.reload()});return}
      window.MERON_ROLE=role==="guest"?"viewer":role;window.MERON_SB=sb;
      document.getElementById("appwrap").hidden=false;
      loadScript("extras.js?v=1",function(){loadScript("app.js",function(){loadScript("quick.js?v=1",function(){loadScript("ical.js?v=1",function(){loadScript("contract.js?v=1",function(){loadScript("customers.js?v=1")})})})})});
      var hd=document.getElementById("sidebtns");
      if(hd){var b=document.createElement("button");b.className="btn sm";b.style.width="100%";b.textContent="יציאה";b.onclick=function(){sb.auth.signOut().then(function(){location.reload()})};hd.appendChild(b)}
    });
  }
  var LOGO='<img class="logo-tile" src="logo-mark.png" alt="">';
  function loginView(msg){
    var o=el('<div class="login"><div class="login-art"><div class="login-brand"><div class="logo-wrap"><div class="logo-card"><img class="logo-full" src="logo-full.png" alt="כשר מירון"></div><div class="logo-tag">דירות אירוח · שבתות וחגים · מירון</div></div></div><h2>ניהול בתי אירוח במירון,<br>במקום אחד.</h2><p>הזמנות, יומן תפוסה, חשבונות עם בעלי נכסים, משכורות ורווחיות. הכול מסודר ובשליטה.</p></div>'
      +'<div class="login-form"><div class="login-card"><h3>כניסה למערכת</h3><div class="meta">כניסה לצוות בלבד. המשתמשים מוגדרים על ידי המנהל.</div>'
      +'<label>אימייל<input id="lg_e" type="email" autocomplete="username" dir="ltr" style="text-align:right"></label>'
      +'<label id="lg_pw" hidden>סיסמה<input id="lg_p" type="password" autocomplete="current-password" dir="ltr" style="text-align:right"></label>'
      +'<div class="note" id="lg_err" '+(msg?'':'hidden')+'>'+(msg||'')+'</div>'
      +'<button class="btn primary" id="lg_b" style="padding:12px">שלח לי קישור כניסה למייל</button>'
      +'<button class="btn sm" id="lg_t" type="button" style="background:none;border:0;color:var(--muted);text-decoration:underline">כניסה עם סיסמה</button></div></div></div>');
        document.body.appendChild(o);
    var usePw=false;
    function show(t,ok){var er=document.getElementById("lg_err");er.hidden=false;er.textContent=t;er.style.background=ok?"var(--ok-soft)":"";er.style.color=ok?"var(--ok)":""}
    function go(){
      var e=document.getElementById("lg_e").value.trim();
      if(!e){show("הקלד כתובת אימייל");return}
      var btn=document.getElementById("lg_b");btn.disabled=true;
      if(usePw){
        sb.auth.signInWithPassword({email:e,password:document.getElementById("lg_p").value}).then(function(r){
          btn.disabled=false;
          if(r.error){show("האימייל או הסיסמה שגויים");return}
          o.remove();startApp();
        });
      }else{
        sb.auth.signInWithOtp({email:e,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}}).then(function(r){
          btn.disabled=false;
          if(r.error){show(/rate|seconds/i.test(r.error.message)?"נשלח קישור לפני רגע. המתן דקה ונסה שוב.":"לא ניתן לשלוח קישור לכתובת הזו. בדוק שהיא מורשית.");return}
          show("שלחנו קישור כניסה ל־"+e+". פתח את המייל ולחץ על הקישור (בדוק גם בספאם).",true);
        });
      }
    }
    document.getElementById("lg_b").onclick=go;
    document.getElementById("lg_t").onclick=function(){
      usePw=!usePw;document.getElementById("lg_pw").hidden=!usePw;
      document.getElementById("lg_t").textContent=usePw?"כניסה עם קישור במייל":"כניסה עם סיסמה";
      document.getElementById("lg_b").textContent=usePw?"כניסה":"שלח לי קישור כניסה למייל";
    };
    document.getElementById("lg_e").addEventListener("keydown",function(ev){if(ev.key==="Enter")go()});
    document.getElementById("lg_p").addEventListener("keydown",function(ev){if(ev.key==="Enter")go()});
  }
  if(!configured){
    document.body.appendChild(el('<div style="max-width:420px;margin:12vh auto;padding:0 16px"><div class="panel note">האתר עדיין לא מחובר למסד הנתונים. יש למלא את הערכים בקובץ config.js.</div></div>'));
    return;
  }
  /* קישור כניסה ישירה בזמן הבנייה: https://…/#k=<סיסמה>. הסיסמה לא נשמרת בקוד, רק בקישור שמחזיק המנהל. מבטלים בעת ההשקה: מוחקים את המשתמש builder@meron-booking.app. */
  var km=(location.hash||"").match(/[#&]k=([^&]+)/),vm=(location.hash||"").match(/[#&]v=([^&]+)/);
  if(km||vm){
    history.replaceState(null,"",location.pathname+location.search);
    sb.auth.signInWithPassword({email:km?"builder@meron-booking.app":"guest@meron-booking.app",password:decodeURIComponent((km||vm)[1])}).then(function(r){
      if(r.error)loginView("קישור הכניסה אינו תקף. היכנס עם אימייל.");else startApp();
    });
    return;
  }
  sb.auth.getSession().then(function(r){if(r.data&&r.data.session)startApp();else loginView()});
})();
