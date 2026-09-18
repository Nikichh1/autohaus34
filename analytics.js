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
  function t(bg,en){return document.documentElement.lang==="en"?en:bg;}
  function banner(){
    if(document.getElementById("ah-consent")||consent())return;
    style();
    var b=document.createElement("div");b.id="ah-consent";b.className="ah-consent";b.innerHTML='<div class="ah-consent__text"><div class="ah-consent__title">Поверителност</div><div>Използваме само анонимна статистика за посещения и интерес към автомобилите, за да подобряваме сайта. Не събираме пароли, съобщения или имейл адреси чрез този анализ.</div></div><div class="ah-consent__actions"><button type="button" data-consent="yes">Приемам</button><button type="button" data-consent="no">Не</button></div>';
    b.addEventListener("click",function(e){var btn=e.target.closest("button[data-consent]");if(!btn)return;set(KEY,btn.dataset.consent);b.remove();});
    function translate(){b.querySelector('.ah-consent__title').textContent=t('Поверителност','Privacy');b.querySelector('.ah-consent__text>div:last-child').textContent=t('С Ваше съгласие използваме постоянни анонимни идентификатори за сесии и посетители. Основните посещения се броят без такъв идентификатор.','With your consent, we use persistent anonymous identifiers for sessions and visitors. Basic page views are counted without such an identifier.');b.querySelector('[data-consent="yes"]').textContent=t('Приемам','Accept');b.querySelector('[data-consent="no"]').textContent=t('Отказ','Decline');}
    translate();window.addEventListener('ah:languagechange',translate);document.body.appendChild(b);
  }
  function payload(eventName,identified){
    var session="",visitor="";
    if(identified){session=get(SESSION_KEY)||id();visitor=get(VISITOR_KEY)||id();set(SESSION_KEY,session);set(VISITOR_KEY,visitor);}
    var params=new URLSearchParams(location.search);
    var slug=params.get("id")||"";
    return {event_name:eventName,path:location.pathname+(/\/vehicle\.html$/i.test(location.pathname)&&/^[a-z0-9-]+$/.test(slug)?"?id="+slug:""),vehicle_slug:/\/vehicle\.html$/i.test(location.pathname)?slug:"",session_id:session||null,visitor_id:visitor||null,referrer:identified?(function(){try{return new URL(document.referrer).origin;}catch(_){return "";}})():"",device:innerWidth<700?"mobile":innerWidth<1100?"tablet":"desktop",country:"",language:(document.documentElement.lang||navigator.language||"").slice(0,20)};
  }
  function send(eventName,identified){
    var body=JSON.stringify(payload(eventName,identified));
    if(navigator.sendBeacon){try{var blob=new Blob([body],{type:"application/json"});if(navigator.sendBeacon(ENDPOINT,blob))return;}catch(_) {}}
    fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:body,keepalive:true}).catch(function(){});
  }
  function start(){var identified=consent()==="yes";send("page_view",identified);if(/\/vehicle\.html$/i.test(location.pathname)&&new URLSearchParams(location.search).get("id"))send("vehicle_view",identified);}
  window.AH_ANALYTICS={resetConsent:function(){try{localStorage.removeItem(KEY);localStorage.removeItem(SESSION_KEY);localStorage.removeItem(VISITOR_KEY);}catch(_){} location.reload();}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){start();if(!consent())banner();});else{start();if(!consent())banner();}
})();

/* Public-site interaction guard and shared UI repairs.
   Watermark rendering intentionally lives only in watermark.js. */
(function(){
  "use strict";

  function installStyle(){
    if(document.getElementById("ah-public-guard-style"))return;
    var s=document.createElement("style");
    s.id="ah-public-guard-style";
    s.textContent=[
      ".ah-site-guard img,.ah-site-guard picture{-webkit-user-select:none;user-select:none;-webkit-user-drag:none}",
      ".ah-site-guard .wall,.ah-site-guard .wall *,.ah-site-guard .wcard,.ah-site-guard .wcard *{-webkit-user-select:none!important;user-select:none!important;-webkit-user-drag:none!important}",
      ".ah-site-guard.ah-text-open main,.ah-site-guard.ah-text-open main *,.ah-site-guard.ah-text-open form,.ah-site-guard.ah-text-open form *{-webkit-user-select:text;user-select:text}",
      ".mob-close{color:#fff!important;border-color:rgba(255,255,255,.18)!important}",
      ".mob-close svg{color:#fff!important;stroke:#fff!important;fill:none!important}",
      ".mob nav a[data-contact],.mob nav a[data-contact]:visited{color:#f4f3ee!important}",
      ".mob nav a[data-contact]:hover,.mob nav a[data-contact]:focus-visible{color:var(--primary)!important}",
      ".ctc__sheet,.ctc__h{color:#fff!important}"
    ].join("");
    document.head.appendChild(s);
  }

  function normalizeMedia(root){
    (root||document).querySelectorAll("img,a,picture").forEach(function(el){el.setAttribute("draggable","false");});
    (root||document).querySelectorAll(".mob-close use,.ctc-close use").forEach(function(use){
      use.setAttribute("href","#ic-x");
      try{use.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href","#ic-x");}catch(_){}
    });
  }

  function landingCleanup(){
    if(!/(^|\/)index\.html$/.test(location.pathname)&&location.pathname!=="/"&&location.pathname!=="")return;
    var firstStage=document.querySelector(".stage-box .stage-content .stage-text");
    if(firstStage){
      var heading=firstStage.querySelector("h1");
      if(heading&&heading.textContent.trim().toLowerCase()==="autohaus")firstStage.remove();
    }
    document.querySelectorAll(".wcard-panel .wcard-cta").forEach(function(el){el.remove();});
  }

  function init(){
    if(!document.body)return;
    installStyle();
    document.body.classList.add("ah-site-guard");
    if(/\/(?:concierge|legal)\.html$/i.test(location.pathname))document.body.classList.add("ah-text-open");
    normalizeMedia(document);
    landingCleanup();
    document.documentElement.classList.remove("ah-watermark-on");

    document.addEventListener("dragstart",function(event){
      var target=event.target&&event.target.closest?event.target.closest("img,picture"):null;
      if(target)event.preventDefault();
    },true);
    document.addEventListener("contextmenu",function(event){
      var target=event.target&&event.target.closest?event.target.closest("img,picture"):null;
      if(target)event.preventDefault();
    },true);

    var observer=new MutationObserver(function(records){
      records.forEach(function(record){record.addedNodes.forEach(function(node){if(node.nodeType===1)normalizeMedia(node);});});
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
