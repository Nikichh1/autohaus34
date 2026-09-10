(function(){
  "use strict";
  var KEY="ah-analytics-consent";
  var SESSION_KEY="ah-analytics-session";
  var VISITOR_KEY="ah-analytics-visitor";
  var ENDPOINT="https://ajoiqomflplhadyhxvfe.supabase.co/functions/v1/analytics-ingest";

  function id(){
    if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==="x"?r:(r&3|8);return v.toString(16);});
  }
  function get(k){try{return localStorage.getItem(k)||"";}catch(_){return "";}}
  function set(k,v){try{localStorage.setItem(k,v);}catch(_) {}}
  function consent(){return get(KEY);}
  function style(){
    if(document.getElementById("ah-consent-style"))return;
    var s=document.createElement("style");s.id="ah-consent-style";s.textContent=".ah-consent{position:fixed;left:18px;right:18px;bottom:18px;z-index:99999;background:#111;color:#fff;border:1px solid #333;box-shadow:0 18px 50px rgba(0,0,0,.24);padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:20px;font:13px/1.45 Arial,sans-serif}.ah-consent__text{max-width:760px}.ah-consent__title{font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:10px;margin-bottom:5px}.ah-consent__actions{display:flex;gap:8px;flex:none}.ah-consent button{border:1px solid #555;background:#fff;color:#111;padding:10px 14px;font:700 11px/1 Arial,sans-serif;text-transform:uppercase;cursor:pointer}.ah-consent button:last-child{background:transparent;color:#fff}.ah-consent button:hover{opacity:.85}@media(max-width:640px){.ah-consent{left:10px;right:10px;bottom:10px;display:block}.ah-consent__actions{margin-top:12px}.ah-consent button{flex:1}}";document.head.appendChild(s);
  }
  function banner(){
    if(document.getElementById("ah-consent")||consent())return;
    style();
    var b=document.createElement("div");b.id="ah-consent";b.className="ah-consent";b.innerHTML='<div class="ah-consent__text"><div class="ah-consent__title">Поверителност</div><div>Използваме само анонимна статистика за посещения и интерес към автомобилите, за да подобряваме сайта. Не събираме пароли, съобщения или имейл адреси чрез този анализ.</div></div><div class="ah-consent__actions"><button type="button" data-consent="yes">Приемам</button><button type="button" data-consent="no">Не</button></div>';
    b.addEventListener("click",function(e){var btn=e.target.closest("button[data-consent]");if(!btn)return;set(KEY,btn.dataset.consent);b.remove();if(btn.dataset.consent==="yes")start();});
    document.body.appendChild(b);
  }
  function payload(eventName){
    var session=get(SESSION_KEY)||id(),visitor=get(VISITOR_KEY)||id();set(SESSION_KEY,session);set(VISITOR_KEY,visitor);
    var params=new URLSearchParams(location.search);
    var slug=params.get("id")||"";
    return {event_name:eventName,path:location.pathname+location.search,vehicle_slug:/\/vehicle\.html$/i.test(location.pathname)?slug:"",session_id:session,visitor_id:visitor,referrer:document.referrer||"",device:innerWidth<700?"mobile":innerWidth<1100?"tablet":"desktop",country:"",language:(document.documentElement.lang||navigator.language||"").slice(0,20)};
  }
  function send(eventName){
    if(consent()!=="yes")return;
    var body=JSON.stringify(payload(eventName));
    if(navigator.sendBeacon){try{var blob=new Blob([body],{type:"application/json"});if(navigator.sendBeacon(ENDPOINT,blob))return;}catch(_) {}}
    fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:body,keepalive:true}).catch(function(){});
  }
  function start(){send("page_view");if(/\/vehicle\.html$/i.test(location.pathname)&&new URLSearchParams(location.search).get("id"))send("vehicle_view");}
  window.AH_ANALYTICS={resetConsent:function(){try{localStorage.removeItem(KEY);localStorage.removeItem(SESSION_KEY);localStorage.removeItem(VISITOR_KEY);}catch(_){} location.reload();}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){if(consent()==="yes")start();else banner();});else if(consent()==="yes")start();else banner();
})();
