(function(){
  "use strict";
  function apply(role){
    var viewer=role==="viewer", limited=viewer||role==="editor";
    document.querySelectorAll('[data-route="new"]').forEach(function(el){el.hidden=viewer;});
    var sync=document.getElementById("sync-autohaus");if(sync)sync.hidden=limited;
    var analytics=document.querySelector('[data-route="analytics"]');if(analytics)analytics.hidden=limited;
  }
  fetch("/api/admin/team?action=list",{credentials:"same-origin",headers:{Accept:"application/json"}}).then(function(r){return r.json();}).then(function(d){if(d.actor_role)apply(d.actor_role);}).catch(function(){});
})();
