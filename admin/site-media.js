/* Independent, auto-saving landing media editor. No vehicle drafts or native confirms. */
(function () {
  "use strict";
  var app=window.AH_ADMIN, slots=window.AH_HOME_SLOTS, D=document, view=D.getElementById("admin-view");
  if(!app || !slots || !view) return;
  var t=app.t, rows=[], generation=0, busy=false, activeDialog=null;
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function bytes(n){return n>=1048576?(n/1048576).toFixed(1)+" MB":Math.round(n/1024)+" KB";}
  async function api(action,body){
    var response=await fetch("/api/admin/site-media"+(action?"?action="+action:""),{method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json","Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
    var data=await response.json().catch(function(){return {};});
    if(!response.ok) throw new Error(data.code==="STALE_IMAGE"?t("Снимката вече е променена от друг администратор. Презаредете страницата.","Another administrator changed this photo. Reload the page."):data.code==="IMAGE_ACTIVE"?t("Снимката още се използва. Първо я сменете.","This photo is in use. Replace it first."):data.code==="IMAGE_BUSY"?t("За безопасно изтриване изчакайте 2 часа и 5 минути от качването; временният адрес за качване още може да е активен.","Wait 2 hours and 5 minutes after upload before deleting; its temporary upload URL may still be active."):t("Операцията не успя. Сегашната снимка е запазена. Опитайте отново.","The operation failed. The current photo is safe. Please try again."));
    return data;
  }
  function current(slot){return rows.find(function(r){return r.slot===slot&&r.is_active;});}
  function expected(slot){var row=current(slot);return row?row.id:null;}
  function title(slot){return t(slot.bg,slot.en);}
  function card(slot,index){
    var row=current(slot.slot), image=row?row.image:slot;
    return '<article class="media-card" data-slot="'+slot.slot+'"><div class="media-card__photo"><img src="'+esc(image.preview)+'" alt="'+esc(title(slot))+'" loading="lazy" decoding="async"><span class="media-card__number">'+(index%5+1)+'</span></div><div class="media-card__body"><h3>'+esc(title(slot))+'</h3><p class="media-meta">'+(row?bytes(row.byte_count)+" · "+row.width+" × "+row.height:t("Оригинална снимка","Original photo"))+'</p><div class="media-actions">'+(app.canWrite?'<button type="button" class="primary" data-upload="'+slot.slot+'">'+t("Смени снимката","Change photo")+'</button><button type="button" class="secondary" data-camera="'+slot.slot+'" aria-label="'+t("Снимай: ","Take photo: ")+esc(title(slot))+'">'+t("Камера","Camera")+'</button>':'')+'</div></div></article>';
  }
  function archived(row,slot,isFactory){
    var image=isFactory?slot:row.image;
    var pending=!isFactory && row.state!=="ready";
    return '<article class="media-archived"><img src="'+esc(pending?slot.preview:image.preview)+'" alt="'+esc(title(slot))+'" loading="lazy" decoding="async"><div><h3>'+esc(title(slot))+(isFactory?' · '+t("оригинал","original"):'')+'</h3><p class="media-meta">'+(isFactory?t("Вграден в сайта; не заема място в базата.","Built into the site; no database storage."):pending?t("Незавършено качване / изтриване","Unfinished upload / deletion"):esc(row.file_name)+" · "+bytes(row.byte_count))+'</p><div class="media-actions">'+(app.canWrite&&!pending?'<button type="button" class="secondary" '+(isFactory?'data-default="'+slot.slot+'"':'data-restore="'+row.id+'"')+'>'+t("Възстанови","Restore")+'</button>':'')+(app.canManage&&!isFactory?'<button type="button" class="media-danger" data-delete="'+row.id+'">'+t("Изтрий","Delete")+'</button>':'')+'</div></div></article>';
  }
  function draw(){
    var archivedRows=rows.filter(function(r){return !r.is_active;});
    var originals=slots.filter(function(s){return current(s.slot);});
    view.innerHTML='<div class="view-head"><div class="view-title"><p>AutoHaus</p><h1>'+t("Снимки на сайта","Website photos")+'</h1></div></div><div class="site-media"><p class="media-intro">'+t("Изберете снимка от телефона или компютъра. Тя се оптимизира автоматично. Новата снимка се появява след успешно качване; предишната остава в архива.","Choose a photo from your phone or computer. It is optimized automatically and published only after a successful upload. The previous photo stays in the archive.")+'</p><div class="media-heading"><h2>'+t("Горен слайдър","Hero slider")+'</h2><span>5 '+t("снимки","photos")+'</span></div><div class="media-grid">'+slots.slice(0,5).map(card).join('')+'</div><div class="media-heading"><h2>'+t("Карти с услуги","Service cards")+'</h2><span>5 '+t("снимки","photos")+'</span></div><div class="media-grid">'+slots.slice(5).map(function(s,i){return card(s,i+5);}).join('')+'</div><details class="media-archive"><summary>'+t("Архив на снимките","Photo archive")+' ('+(archivedRows.length+originals.length)+')</summary><p>'+t("Възстановяването връща снимката на същата позиция. „Изтрий“ премахва окончателно архивната снимка и всички нейни файлове. Снимки, които се използват, не могат да се изтрият.","Restore returns the photo to the same position. Delete permanently removes an archived photo and all of its files. Photos currently in use cannot be deleted.")+'</p><div class="media-archive__list">'+originals.map(function(s){return archived(null,s,true);}).join('')+archivedRows.map(function(r){return archived(r,slots.find(function(s){return s.slot===r.slot;}),false);}).join('')+'</div>'+(!originals.length&&!archivedRows.length?'<p>'+t("Архивът е празен. Предишните снимки ще се появяват тук при смяна.","The archive is empty. Previous photos appear here when replaced.")+'</p>':'')+'</details></div>';
    view.querySelectorAll('[data-upload],[data-camera]').forEach(function(button){button.onclick=function(){choose(button.dataset.upload||button.dataset.camera,!!button.dataset.camera);};});
    view.querySelectorAll('[data-restore]').forEach(function(button){button.onclick=function(){var row=rows.find(function(r){return r.id===button.dataset.restore;});confirmAction("restore",row);};});
    view.querySelectorAll('[data-default]').forEach(function(button){button.onclick=function(){confirmAction("default",{slot:button.dataset.default,id:null});};});
    view.querySelectorAll('[data-delete]').forEach(function(button){button.onclick=function(){confirmAction("delete",rows.find(function(r){return r.id===button.dataset.delete;}));};});
  }
  async function render(){
    var turn=++generation;
    view.innerHTML='<div class="view-head"><div class="view-title"><h1>'+t("Снимки на сайта","Website photos")+'</h1></div></div><div class="media-load-error" role="status">'+t("Зареждане на снимките…","Loading photos…")+'</div>';
    try{var result=await api();if(turn!==generation||location.hash!=="#media")return;rows=result.images||[];draw();}
    catch(error){if(turn!==generation||location.hash!=="#media")return;view.innerHTML='<div class="media-load-error" role="alert">'+esc(error.message)+'<br><button type="button" class="secondary" id="media-retry">'+t("Опитай отново","Try again")+'</button></div>';D.getElementById("media-retry").onclick=render;}
  }
  function dialog(heading,content){
    var previousFocus=D.activeElement, element=D.createElement("dialog");element.className="media-dialog";
    element.innerHTML='<div class="media-dialog__head"><h2 id="media-dialog-title">'+esc(heading)+'</h2><button type="button" class="media-dialog__close" aria-label="'+t("Затвори","Close")+'">×</button></div><div class="media-dialog__content">'+content+'</div>';element.setAttribute("aria-labelledby","media-dialog-title");
    D.body.appendChild(element);activeDialog=element;
    function close(){if(busy)return;element.close();element.remove();activeDialog=null;if(previousFocus&&previousFocus.isConnected)previousFocus.focus();}
    element.querySelector('.media-dialog__close').onclick=close;
    element.addEventListener('cancel',function(event){event.preventDefault();close();});
    element.addEventListener('click',function(event){if(event.target===element){var rect=element.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}});
    element.showModal();return {element:element,close:close};
  }
  function status(element,text,error){var target=element.querySelector('.media-status');target.textContent=text;target.setAttribute('role',error?'alert':'status');}
  function lock(element,on){busy=on;window.AH_SITE_MEDIA_BUSY=on;element.querySelectorAll('button').forEach(function(b){b.disabled=on;});}
  function confirmAction(action,row){
    if(!row||busy)return;
    var slot=slots.find(function(s){return s.slot===row.slot;}), deletion=action==='delete', before=expected(row.slot);
    var box=dialog(deletion?t("Изтриване на снимка","Delete photo"):t("Възстановяване на снимка","Restore photo"),'<p>'+esc(title(slot))+'</p><img class="media-dialog__preview" src="'+esc(row.image&&row.state==='ready'?row.image.preview:slot.preview)+'" alt="'+esc(title(slot))+'"><p>'+ (deletion?t("Тази архивна снимка и всички нейни версии ще бъдат изтрити окончателно от базата и хранилището. Това не може да се отмени.","This archived photo and all of its versions will be permanently removed from the database and storage. This cannot be undone."):t("Избраната снимка ще се върне на сайта. Сегашната ще бъде запазена в архива.","The selected photo will return to the site. The current one will remain in the archive."))+'</p><div class="media-status" role="status" aria-live="polite"></div><div class="media-dialog__buttons"><button type="button" class="secondary" data-cancel>'+t("Отказ","Cancel")+'</button><button type="button" class="'+(deletion?'media-danger':'primary')+'" data-confirm>'+ (deletion?t("Изтрий окончателно","Permanently delete"):t("Възстанови","Restore"))+'</button></div>');
    box.element.querySelector('[data-cancel]').onclick=box.close;
    box.element.querySelector('[data-confirm]').onclick=async function(){lock(box.element,true);status(box.element,t("Записване…","Saving…"));try{await api(action,{id:row.id,slot:row.slot,expected_id:before,confirm_delete:deletion});lock(box.element,false);box.close();await render();}catch(error){lock(box.element,false);status(box.element,error.message,true);}};
  }
  function choose(slotId,camera){
    if(busy||!app.canWrite)return;
    var input=D.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif';input.style.display='none';if(camera)input.setAttribute('capture','environment');D.body.appendChild(input);
    input.onchange=function(){var file=input.files&&input.files[0];input.remove();if(file)preview(file,slotId);};input.addEventListener('cancel',function(){input.remove();},{once:true});input.click();
  }
  async function encode(canvas,type,quality){return new Promise(function(resolve,reject){canvas.toBlob(function(blob){if(!blob||blob.type!==type)return reject(new Error(t("Браузърът не поддържа обработката на снимката. Използвайте актуален браузър.","Your browser cannot optimize this photo. Use a current browser.")));resolve(blob);},type,quality);});}
  async function optimized(file){
    if(!file.size||file.size>35*1048576)throw new Error(t("Изберете снимка до 35 MB.","Choose a photo up to 35 MB."));
    var url=URL.createObjectURL(file), image=new Image();image.src=url;
    try{await image.decode();}catch(error){URL.revokeObjectURL(url);throw new Error(t("Снимката не може да се отвори. За HEIC изберете JPEG от телефона.","This photo cannot be opened. For HEIC, export JPEG from your phone."));}
    var scale=Math.min(1,1920/Math.max(image.naturalWidth,image.naturalHeight)),width=Math.round(image.naturalWidth*scale),height=Math.round(image.naturalHeight*scale);
    if(width<64||height<64||image.naturalWidth*image.naturalHeight>80000000){URL.revokeObjectURL(url);throw new Error(t("Изберете нормална снимка с достатъчна резолюция.","Choose a normal-resolution photo at least 64 pixels per side."));}
    var master=D.createElement('canvas');master.width=width;master.height=height;var ctx=master.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);URL.revokeObjectURL(url);image.src='';
    var blob=await encode(master,'image/webp',.82);return {canvas:master,blob:blob,width:width,height:height};
  }
  async function variant(master,asset){
    var canvas=D.createElement('canvas');canvas.width=asset.width;canvas.height=Math.max(1,Math.round(master.height*asset.width/master.width));var ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingQuality='high';ctx.drawImage(master,0,0,canvas.width,canvas.height);
    var quality=asset.key==='background'?.64:asset.type==='image/webp'?.82:asset.width>=1280?.87:.84;
    var blob=await encode(canvas,asset.type,quality);canvas.width=canvas.height=1;
    if(blob.size>4*1048576)throw new Error(t("Оптимизираната снимка е прекалено голяма. Изберете друга.","The optimized photo is too large. Choose another photo."));return blob;
  }
  async function preview(file,slotId){
    var slot=slots.find(function(s){return s.slot===slotId;}), before=expected(slotId), prepared=null, previewURL=null, pending=null, blobs=null;
    var box=dialog(t("Смяна: ","Replace: ")+title(slot),'<img class="media-dialog__preview" alt="'+esc(title(slot))+'" hidden><p>'+t("Снимката ще се оптимизира, без да се деформира. На сайта се вписва в съществуващия прозорец. Предишната снимка се запазва.","The photo is optimized without distortion and fills the existing website frame. The previous photo is preserved.")+'</p><div class="media-status" role="status" aria-live="polite">'+t("Подготовка на снимката…","Preparing photo…")+'</div><progress class="media-progress" max="100" value="0" aria-label="'+t("Качване","Upload")+'"></progress><div class="media-dialog__buttons"><button type="button" class="secondary" data-cancel>'+t("Отказ","Cancel")+'</button><button type="button" class="primary" data-publish disabled>'+t("Качи и публикувай","Upload and publish")+'</button></div>');
    var oldClose=box.close;box.close=function(){if(busy)return;if(previewURL)URL.revokeObjectURL(previewURL);if(prepared)prepared.canvas.width=prepared.canvas.height=1;oldClose();};box.element.querySelector('[data-cancel]').onclick=box.close;
    box.element.querySelector('.media-dialog__close').onclick=box.close;
    box.element.addEventListener('close',function(){if(previewURL)URL.revokeObjectURL(previewURL);if(prepared)prepared.canvas.width=prepared.canvas.height=1;},{once:true});
    try{prepared=await optimized(file);if(!box.element.isConnected){prepared.canvas.width=prepared.canvas.height=1;return;}previewURL=URL.createObjectURL(prepared.blob);var img=box.element.querySelector('img');img.src=previewURL;img.hidden=false;status(box.element,prepared.width+' × '+prepared.height+' · '+bytes(file.size)+' → '+bytes(prepared.blob.size));box.element.querySelector('[data-publish]').disabled=false;}
    catch(error){if(box.element.isConnected)status(box.element,error.message,true);return;}
    box.element.querySelector('[data-publish]').onclick=async function(){
      lock(box.element,true);
      try{
        if(!pending)pending=await api('sign',{slot:slotId,width:prepared.width,height:prepared.height,file_name:file.name,expected_id:before});
        if(!blobs){blobs=[];for(var a=0;a<pending.uploads.length;a++)blobs.push(await variant(prepared.canvas,pending.uploads[a]));}
        var total=blobs.reduce(function(n,b){return n+b.size;},0),uploaded=0;
        // Sequential uploads bound phone memory/network contention; retry uses the same immutable paths.
        for(var i=0;i<pending.uploads.length;i++){
          status(box.element,t("Качване… ","Uploading… ")+(i+1)+' / '+pending.uploads.length);
          var response=await fetch(pending.uploads[i].upload_url,{method:'PUT',credentials:'omit',headers:Object.assign({},pending.headers,{'Content-Type':blobs[i].type,'cache-control':'31536000'}),body:blobs[i]});
          if(!response.ok){var detail=await response.json().catch(function(){return {};});if(!/duplicate|already exists/i.test(detail.message||detail.error||''))throw new Error(t("Качването прекъсна. Натиснете отново, за да опитате пак. Сегашната снимка остава.","Upload interrupted. Press again to retry. The current photo remains."));}
          uploaded+=blobs[i].size;box.element.querySelector('progress').value=Math.round(uploaded/total*95);
        }
        status(box.element,t("Проверка и публикуване…","Verifying and publishing…"));
        await api('complete',{id:pending.id,slot:slotId,expected_id:before});
        box.element.querySelector('progress').value=100;lock(box.element,false);box.close();await render();
      }catch(error){lock(box.element,false);status(box.element,error.message,true);}
    };
  }
  var nav=D.querySelector('.side__nav');if(nav&&!nav.querySelector('[data-route="media"]')){var button=D.createElement('button');button.type='button';button.dataset.route='media';button.dataset.bg='Снимки на сайта';button.dataset.en='Website photos';button.textContent=t('Снимки на сайта','Website photos');nav.insertBefore(button,nav.querySelector('[data-route="settings"]'));}
  var previous=app.renderExtra;app.renderExtra=function(route){if(route==='media'){render();return true;}++generation;if(activeDialog&&!busy)activeDialog.close();return previous?previous(route):false;};
  window.addEventListener('beforeunload',function(event){if(busy){event.preventDefault();event.returnValue='';}});
})();
