(function(){
  "use strict";
  var D=document,view=D.getElementById("admin-view");if(!view)return;
  var s=D.createElement("style");s.textContent=".ah-editor-flow{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 16px}.ah-editor-flow span{padding:7px 9px;border:1px solid #e3e3e3;background:#fafafa;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.ah-quick-import{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:14px;border:1px solid #ddd;background:#f7f7f7;margin-bottom:18px}.ah-quick-import input{min-width:0;border:1px solid #d4d4d4;background:#fff;padding:11px 12px}.ah-quick-import button{white-space:nowrap}.ah-source-note{font-size:11px;color:#777;margin:-5px 0 10px}.ah-source-label{font-size:10px!important;text-transform:uppercase;letter-spacing:.1em}.ah-generated{border-left:2px solid #111;padding-left:10px}.ah-generated-label{font-size:10px!important;text-transform:uppercase;letter-spacing:.1em}@media(max-width:600px){.ah-quick-import{grid-template-columns:1fr}.ah-quick-import button{width:100%}}";D.head.appendChild(s);
  function enhance(){
    var form=D.getElementById("car-form");if(!form||form.dataset.enhanced)return;form.dataset.enhanced="1";
    var heading=D.querySelector(".editor-heading");
    var flow=D.createElement("div");flow.className="ah-editor-flow";flow.innerHTML="<span>1 · Данни</span><span>2 · Снимки</span><span>3 · BG + EN</span><span>4 · Проверка</span><span>5 · Публикуване</span>";
    if(heading)heading.insertAdjacentElement("afterend",flow);
    var quick=D.createElement("div");quick.className="ah-quick-import";quick.innerHTML='<input id="ah-quick-source" type="text" autocomplete="off" placeholder="Постави AutoHaus URL или slug…"><button type="button" class="primary" id="ah-quick-import-btn">Импортирай от AutoHaus</button>';
    if(flow)flow.insertAdjacentElement("afterend",quick);
    var source=D.getElementById("source-text");
    if(source){var lab=source.closest("label");if(lab){var span=lab.querySelector("span");if(span){span.className="ah-source-label";span.textContent="Оригинален текст · само за AI обработка";}var note=D.createElement("div");note.className="ah-source-note";note.textContent="Постави оригиналното описание/оборудване тук. Не го копирай ръчно в BG и EN — AI ще попълни двете версии.";lab.insertAdjacentElement("afterend",note);}}
    ["desc-bg","desc-en","equipment-bg","equipment-en"].forEach(function(id){var el=D.getElementById(id);if(!el)return;var lab=el.closest("label");if(lab){var span=lab.querySelector("span");if(span)span.className="ah-generated-label";lab.classList.add("ah-generated");}});
    var btn=D.getElementById("ah-quick-import-btn"),input=D.getElementById("ah-quick-source");
    function slug(v){v=String(v||"").trim();var m=v.match(/\/car\/([a-z0-9-]+)\/?(?:[?#].*)?$/i);if(m)return m[1].toLowerCase();return v.replace(/^\//,"").replace(/\/$/,"").toLowerCase();}
    if(btn)btn.onclick=async function(){var value=slug(input.value);if(!/^[a-z0-9-]{1,180}$/.test(value)){alert("Постави валиден AutoHaus URL или slug.");input.focus();return;}btn.disabled=true;btn.textContent="Импортиране…";try{var r=await fetch("/api/admin/sync?action=vehicle",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({slug:value,sort_order:0})});var d=await r.json().catch(function(){return{};});if(!r.ok)throw new Error(d.error||"Импортът не успя.");history.replaceState(null,"","#edit="+encodeURIComponent(d.id));location.reload();}catch(e){alert(e.message);btn.disabled=false;btn.textContent="Импортирай от AutoHaus";}};
  }
  new MutationObserver(enhance).observe(view,{childList:true,subtree:true});enhance();
})();
