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
  function startApp(){
    document.getElementById("appwrap").hidden=false;
    var s=document.createElement("script");s.src="app.js";document.body.appendChild(s);
    var hd=document.getElementById("sidebtns");
    if(hd&&sb){var b=document.createElement("button");b.className="btn sm";b.style.width="100%";b.textContent="יציאה";b.onclick=function(){sb.auth.signOut().then(function(){location.reload()})};hd.appendChild(b)}
  }
  var LOGO='<svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8bd6a"/><stop offset="1" stop-color="#b9822a"/></linearGradient></defs><rect width="48" height="48" rx="13" fill="#123b45"/><path d="M5 37 L17 17 L24 27 L31 14 L43 37 Z" fill="#d9a84e"/><path d="M17 37 V30 L24 24 L31 30 V37 Z" fill="#0d2b33"/><rect x="22" y="31" width="4" height="6" rx="1" fill="#e8bd6a"/></svg>';
  function loginView(msg){
    var o=el('<div class="login"><div class="login-art"><div class="login-brand">'+LOGO+'<div><b>מירון סטיי</b><small>MERON STAY</small></div></div><h2>ניהול בתי אירוח במירון,<br>במקום אחד.</h2><p>הזמנות, יומן תפוסה, חשבונות עם בעלי נכסים, משכורות ורווחיות. הכול מסודר ובשליטה.</p></div>'
      +'<div class="login-form"><div class="login-card"><h3>כניסה למערכת</h3><div class="meta">כניסה לצוות בלבד. המשתמשים מוגדרים על ידי המנהל.</div>'
      +'<label>אימייל<input id="lg_e" type="email" autocomplete="username" dir="ltr" style="text-align:right"></label>'
      +'<label>סיסמה<input id="lg_p" type="password" autocomplete="current-password" dir="ltr" style="text-align:right"></label>'
      +'<div class="note" id="lg_err" '+(msg?'':'hidden')+'>'+(msg||'')+'</div>'
      +'<button class="btn primary" id="lg_b" style="padding:12px">כניסה</button></div></div></div>');
    document.body.appendChild(o);
    function go(){
      var e=document.getElementById("lg_e").value.trim(),p=document.getElementById("lg_p").value;
      sb.auth.signInWithPassword({email:e,password:p}).then(function(r){
        if(r.error){var er=document.getElementById("lg_err");er.hidden=false;er.textContent="האימייל או הסיסמה שגויים";return}
        o.remove();startApp();
      });
    }
    document.getElementById("lg_b").onclick=go;
    document.getElementById("lg_p").addEventListener("keydown",function(ev){if(ev.key==="Enter")go()});
  }
  if(!configured){
    document.body.appendChild(el('<div style="max-width:420px;margin:12vh auto;padding:0 16px"><div class="panel note">האתר עדיין לא מחובר למסד הנתונים. יש למלא את הערכים בקובץ config.js.</div></div>'));
    return;
  }
  sb.auth.getSession().then(function(r){if(r.data&&r.data.session)startApp();else loginView()});
})();
