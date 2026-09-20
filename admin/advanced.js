/* Extra admin screens share the editor router, role checks and language. */
(function () {
  "use strict";
  var D = document, view = D.getElementById("admin-view"), app = window.AH_ADMIN, generation = 0;
  if (!view || !app) return;
  var t = app.t;
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function(c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]; }); }
  async function api(url, body) {
    var r = await fetch(url, { credentials:"same-origin", method:body ? "POST" : "GET", headers:{Accept:"application/json","Content-Type":"application/json"}, body:body ? JSON.stringify(body) : undefined });
    var d = await r.json().catch(function(){return {};});
    if (!r.ok) throw new Error(d.error || t("Заявката не успя.","Request failed."));
    return d;
  }
  function shell(title, body) { view.innerHTML='<div class="view-head"><div class="view-title"><p>AutoHaus</p><h1>'+esc(title)+'</h1></div></div><div class="ah-advanced">'+body+'</div>'; }
  function panel(title,body) { return '<section class="panel"><div class="panel-head"><h2>'+esc(title)+'</h2></div>'+body+'</section>'; }
  function empty(message) { return '<div class="ah-advanced__empty" role="status">'+esc(message || t("Все още няма данни.","No data yet."))+'</div>'; }
  function bars(rows, key) {
    var max=Math.max(1,...rows.map(function(x){return Number(x.views)||0;}));
    return rows.length ? rows.map(function(x){return '<div class="ah-advanced__bar"><div><div class="ah-advanced__barlabel">'+esc(x[key]||x.slug)+'</div><div class="ah-advanced__barline"><i style="width:'+Math.max(3,Math.round(Number(x.views)/max*100))+'%"></i></div></div><strong>'+Number(x.views||0)+'</strong></div>';}).join('') : empty();
  }
  async function analytics() {
    if (!app.canManage) { shell(t("Анализи","Analytics"),empty(t("Нямате достъп.","Access unavailable."))); return; }
    var turn=++generation;
    shell(t("Анализи","Analytics"),'<div class="ah-advanced__toolbar"><p>'+t("Статистика само след съгласие на посетителя.","Statistics from visitors who consented.")+'</p><label>'+t("Период ","Period ")+'<select id="ah-days"><option value="7">7 '+t("дни","days")+'</option><option value="30" selected>30 '+t("дни","days")+'</option><option value="90">90 '+t("дни","days")+'</option><option value="365">365 '+t("дни","days")+'</option></select></label></div><div id="ah-analytics-body"></div>');
    var target=D.getElementById("ah-analytics-body"), select=D.getElementById("ah-days"), sequence=0;
    async function load() {
      var request=++sequence;target.innerHTML=empty(t("Зареждане…","Loading…"));
      try {
        var r=await api('/api/admin/analytics?days='+select.value), s=r.summary||{};
        if(turn!==generation||request!==sequence||!target.isConnected)return;
        target.innerHTML='<div class="ah-advanced__grid">'+[[t("Посещения","Page views"),s.pageviews],[t("Автомобили","Vehicle views"),s.vehicle_views],[t("Сесии","Sessions"),s.sessions],[t("Посетители","Visitors"),s.visitors]].map(function(x){return '<div class="ah-advanced__stat"><span>'+x[0]+'</span><strong>'+Number(x[1]||0).toLocaleString()+'</strong></div>';}).join('')+'</div>'+panel(t("Най-гледани автомобили","Most viewed cars"),bars(s.top_vehicles||[],'full_name'))+panel(t("Страници","Pages"),bars(s.top_paths||[],'path'))+panel(t("По дни","Daily activity"),'<table class="ah-advanced__table"><thead><tr><th>'+t("Дата","Date")+'</th><th>'+t("Посещения","Views")+'</th><th>'+t("Сесии","Sessions")+'</th></tr></thead><tbody>'+(s.daily||[]).slice(-30).map(function(x){return '<tr><td>'+esc(x.day_value)+'</td><td>'+Number(x.pageviews||0)+'</td><td>'+Number(x.sessions||0)+'</td></tr>';}).join('')+'</tbody></table>');
      } catch(e) { if(target.isConnected)target.innerHTML=empty(e.message); }
    }
    select.onchange=load;load();
  }
  async function team(password) {
    var turn=++generation;shell(t("Екип и достъп","Team and access"),'<div id="ah-team-body">'+empty(t("Зареждане…","Loading…"))+'</div>');
    var target=D.getElementById("ah-team-body");
    try {
      var r=await api('/api/admin/team?action=list');if(turn!==generation||!target.isConnected)return;
      var owner=r.actor_role==='owner';
      target.innerHTML=(password?'<div class="ah-advanced__password" role="status">'+t("Временна парола — запишете я сега: ","Temporary password — save it now: ")+esc(password)+'</div>':'')+(owner?panel(t("Добави достъп","Add access"),'<form id="ah-team-form" class="ah-advanced__form"><input name="email" type="email" autocomplete="off" required aria-label="Email" placeholder="Email"><input name="display_name" aria-label="'+t("Име","Name")+'" placeholder="'+t("Име","Name")+'"><select name="role" aria-label="'+t("Роля","Role")+'"><option value="editor">Editor</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select><button class="primary" type="submit">'+t("Създай достъп","Create access")+'</button></form>'):'')+panel(t("Екип","Team"),'<table class="ah-advanced__table ah-team-table"><thead><tr><th>Email</th><th>'+t("Роля","Role")+'</th><th>'+t("Статус","Status")+'</th><th></th></tr></thead><tbody>'+(r.members||[]).map(function(m){return '<tr><td>'+esc(m.display_name||m.email)+'<div class="ah-advanced__muted">'+esc(m.email)+'</div></td><td>'+esc(m.role)+'</td><td>'+ (m.active?t("Активен","Active"):t("Спрян","Disabled"))+'</td><td>'+(owner&&m.role!=='owner'?'<button type="button" class="secondary" data-toggle-user="'+esc(m.user_id)+'" data-active="'+(!m.active)+'">'+(m.active?t("Спри достъпа","Disable access"):t("Активирай","Enable access"))+'</button>':'')+'</td></tr>';}).join('')+'</tbody></table>');
      var form=D.getElementById("ah-team-form");if(form)form.onsubmit=async function(event){event.preventDefault();var b=form.querySelector('button');b.disabled=true;try{var f=new FormData(form),result=await api('/api/admin/team',{action:'create',email:f.get('email'),display_name:f.get('display_name'),role:f.get('role')});await team(result.temporary_password);}catch(e){alert(e.message);b.disabled=false;}};
      target.querySelectorAll('[data-toggle-user]').forEach(function(b){b.onclick=async function(){b.disabled=true;try{await api('/api/admin/team',{action:'update',user_id:b.dataset.toggleUser,active:b.dataset.active==='true'});team();}catch(e){alert(e.message);b.disabled=false;}};});
    } catch(e){if(target.isConnected)target.innerHTML=empty(e.message);}
  }
  function security() {
    ++generation;
    shell(t("Сигурност","Security"),'<div class="ah-advanced__security">'+[[t("Достъп","Access"),t("Само активни членове на екипа с валидна сесия.","Only active team members with a valid session.")],[t("Права","Permissions"),t("Owner управлява екипа. Editor редактира. Viewer само преглежда.","Owner manages access. Editor edits cars. Viewer has read access.")],[t("Лични данни","Private data"),t("Оригиналният AI текст и бележките не се публикуват.","AI source text and review notes are not published.")],[t("Статистика","Analytics"),t("Само след съгласие. Не се записват пароли или съобщения.","Consent required. Passwords and messages are never recorded.")]].map(function(x){return '<article><b>'+x[0]+'</b><span>'+x[1]+'</span></article>';}).join('')+'</div>');
  }
  [['analytics','Анализи','Analytics'],['team','Екип','Team'],['security','Сигурност','Security']].forEach(function(x){var b=D.createElement('button');b.type='button';b.dataset.route=x[0];b.dataset.bg=x[1];b.dataset.en=x[2];b.textContent=t(x[1],x[2]);b.hidden=x[0]==='analytics'&&!app.canManage;b.onclick=function(){app.go(x[0]);};D.querySelector('.side__nav').appendChild(b);});
  var previousRenderExtra = app.renderExtra;
  app.renderExtra=function(route){
    if(route==='analytics'){analytics();return true;}
    if(route==='team'){team();return true;}
    if(route==='security'){security();return true;}
    return previousRenderExtra ? previousRenderExtra(route) : false;
  };
})();
