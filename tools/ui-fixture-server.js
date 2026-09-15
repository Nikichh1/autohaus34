/* Explicitly isolated UI test fixture. No real provider calls or credentials.
   This tools-only server is never copied to dist or invoked by production. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const {createServer}=require('./dev-server');
const lib=require('../server/admin-lib');
const photoSource=fs.readFileSync(path.join(__dirname,'../data/photos.js'),'utf8');
const localPhotos=new Set(JSON.parse(photoSource.slice(photoSource.indexOf('['),photoSource.lastIndexOf(']')+1)));
let rows=require('../api/admin/vehicles').initialInventory().map((r,i)=>({...r,id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),created_at:'2026-09-09T10:00:00Z',updated_at:'2026-09-09T10:00:00Z'}));
const edgeSource=JSON.parse(JSON.stringify(rows.find(row=>row.images.length>=2)));
const pageModule={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../api/admin/page.js'),'utf8'),{module:pageModule,require:()=>({...lib,requireAdmin:async()=>({id:'ui-fixture',email:'preview@example.com',adminRole:'owner'})})});
const server=createServer(),base=server.listeners('request')[0]; server.removeAllListeners('request');
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function publicVehicle(row,compact){
 const vehicle=lib.legacyVehicle(compact?{...row,images:(row.images||[]).slice(0,1)}:row);
 vehicle.local_shots=vehicle.managed_images.filter(image=>localPhotos.has(image.original)).map(image=>image.original);
 if(compact)for(const key of ['description_bg','description_en','equipment_bg','equipment_en','notes'])delete vehicle[key];
 return vehicle;
}
// Explicit detail-only cases, never extra catalog records or saved admin data.
function edgeVehicle(id){
 const count={'fixture-no-photos':0,'fixture-one-photo':1,'fixture-two-photos':2}[id];
 if(count===undefined)return null;
 const row=JSON.parse(JSON.stringify(edgeSource));
 Object.assign(row,{id:'ui-'+id,slug:id,ref:'UI-'+count,images:row.images.slice(0,count),notes:[],description_bg:'',description_en:'',equipment_bg:[],equipment_en:[]});
 if(count===1)Object.assign(row,{description_bg:'Кратко описание на автомобила.',description_en:'A short vehicle description.',equipment_bg:['Камера за паркиране','Отопляеми седалки'],equipment_en:['Parking camera','Heated seats']});
 if(count===2)Object.assign(row,{description_bg:'Първи ред на описанието.\nВтори ред в същия абзац.\n\nВтори абзац: текстът <остава> непроменен.',description_en:'First description line.\nSecond line in the same paragraph.\n\nSecond paragraph: the text <stays> unchanged.',equipment_bg:['- Самостоятелна функция\n• Допълнителна функция','72B – Пакет USB\n- Предни USB-C портове\n- Задни USB-C портове','840 – Тонирани стъкла'],equipment_en:['- Independent feature\n• Additional feature','72B – USB package\n- Front USB-C ports\n- Rear USB-C ports','840 – Tinted windows']});
 return row;
}
async function readBody(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2*1024*1024)throw new Error('Request too large');}return raw?JSON.parse(raw):{};}
server.on('request',async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/fixture-upload/')){for await(const chunk of req){}return send(res,200,{ok:true});}
 if(url.pathname==='/admin'||url.pathname==='/api/admin/page')return pageModule.exports(req,res);
 if(url.pathname==='/api/public/vehicles'){
  if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
  const id=url.searchParams.get('id');
  if(id&&!/^[a-z0-9-]+$/.test(id))return send(res,400,{ok:false,error:'Invalid vehicle ID'});
  const published=rows.filter(r=>r.published);
  const fresh_until=Date.now()+30000;
  if(id){const row=edgeVehicle(id)||published.find(r=>r.slug===id);return row?send(res,200,{ok:true,authoritative:true,fresh_until,vehicle:publicVehicle(row,false)}):send(res,404,{ok:false,authoritative:true,fresh_until,vehicle:null,vehicles:[],error:'Vehicle not found'});}
  return send(res,200,{ok:true,authoritative:true,fresh_until,count:published.length,vehicles:published.map(row=>publicVehicle(row,true))});
 }
 // Never let this test origin deliver a real enquiry. Include "fixture-failure"
 // in its message to exercise the recoverable error state instead of success.
 if(url.pathname==='/api/inquiry'){
  if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'});
  const body=await readBody(req),contact=body.contact||{};
  if(body.website)return send(res,200,{ok:true});
  if(body.kind==='vehicle'&&(!String(contact.name||'').trim()||!String(body.message||'').trim()||!(String(contact.phone||'').trim()||String(contact.email||'').trim())))return send(res,400,{ok:false,error:'Name, message and a phone number or email are required.'});
  if(body.kind!=='vehicle'&&!String(body.text||'').trim())return send(res,400,{ok:false,error:'Empty enquiry.'});
  if(contact.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))return send(res,400,{ok:false,error:'Invalid email address.'});
  if(/fixture-failure/i.test(body.message||body.text||''))return send(res,503,{ok:false,error:'Isolated fixture delivery failure'});
  return send(res,200,{ok:true});
 }
 if(url.pathname==='/api/admin/auth')return send(res,200,{ok:true,authenticated:true,user:{email:'preview@example.com'}});
 if(url.pathname.startsWith('/api/admin/')){
  const body=await readBody(req);
  if(url.pathname==='/api/admin/team')return send(res,200,{ok:true,actor_role:'owner',members:[{user_id:'fixture',email:'long.staff.address@example.com',display_name:'Example staff member',role:'editor',active:true}]});
  if(url.pathname==='/api/admin/analytics')return send(res,200,{ok:true,summary:{pageviews:123,vehicle_views:45,sessions:67,visitors:56,top_vehicles:[],top_paths:[],daily:[]}});
  if(url.pathname==='/api/admin/description'){
   if(/quota/i.test(body.source))return send(res,429,{ok:false,code:'AI_FREE_QUOTA',error:'Free quota unavailable'});
   return send(res,200,{ok:true,result:{description_bg:'Пълна сервизна история.',description_en:'Full service history.',equipment_bg:['Камера 360°','Отопление на седалките'],equipment_en:['360° camera','Heated seats'],review_notes:[]}});
  }
  if(url.pathname==='/api/admin/images'){
   if(url.searchParams.get('action')==='sign'){const id=crypto.randomUUID();return send(res,200,{ok:true,provider:'supabase',public_id:'vehicles/'+id,upload_url:'/fixture-upload/'+id,headers:{}});}
   if(url.searchParams.get('action')==='complete')return send(res,200,{ok:true,image:{id:crypto.randomUUID(),public_id:body.public_id,original:'/img/v/2026-09_1-5-400.jpg',variants:{},width:body.width,height:body.height,legacy:false}});
   return send(res,200,{ok:true});
  }
  if(url.pathname==='/api/admin/vehicles'){
   const id=url.searchParams.get('id');
   if(req.method==='GET')return send(res,200,id?{ok:true,vehicle:rows.find(r=>r.id===id)}:{ok:true,vehicles:rows.map(({id,slug,ref,make,model,full_name,price,mileage,fuel,transmission,published,updated_at,images})=>({id,slug,ref,make,model,full_name,price,mileage,fuel,transmission,published,updated_at,images:images.slice(0,1)})),can_import:false});
   if(req.method==='DELETE'){rows=rows.filter(r=>r.id!==id);return send(res,200,{ok:true,deleted:1});}
   const old=rows.find(r=>r.id===id),normalized=lib.normalizeVehicle({...old,...body});
   if(normalized.error)return send(res,400,{ok:false,error:normalized.error});
   const vehicle={...old,...normalized.row,id:id||crypto.randomUUID(),updated_at:new Date().toISOString()};
   rows=rows.filter(r=>r.id!==vehicle.id);rows.unshift(vehicle);return send(res,200,{ok:true,vehicle});
  }
  return send(res,404,{ok:false});
 }
 base(req,res);
 }catch(error){if(!res.headersSent)return send(res,400,{ok:false,error:error.message});res.end();}
});
const port=Number(process.env.PORT || 3011);
server.listen(port,'127.0.0.1',()=>console.log('Isolated UI test fixture: http://127.0.0.1:'+port+'/admin'));
