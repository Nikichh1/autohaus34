/* Explicitly isolated UI test fixture. No real provider calls or credentials.
   This tools-only server is never copied to dist or invoked by production. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const {createServer}=require('./dev-server');
const lib=require('../server/admin-lib');
let rows=require('../api/admin/vehicles').initialInventory().map((r,i)=>({...r,id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),created_at:'2026-09-09T10:00:00Z',updated_at:'2026-09-09T10:00:00Z'}));
const pageModule={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../api/admin/page.js'),'utf8'),{module:pageModule,require:()=>({...lib,requireAdmin:async()=>({id:'ui-fixture',email:'preview@example.com',adminRole:'owner'})})});
const server=createServer(),base=server.listeners('request')[0]; server.removeAllListeners('request');
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
server.on('request',async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/fixture-upload/')){for await(const chunk of req){}return send(res,200,{ok:true});}
 if(url.pathname==='/admin'||url.pathname==='/api/admin/page')return pageModule.exports(req,res);
 if(url.pathname==='/api/public/vehicles')return send(res,200,{ok:true,authoritative:true,vehicles:rows.filter(r=>r.published).map(lib.legacyVehicle)});
 if(url.pathname==='/api/admin/auth')return send(res,200,{ok:true,authenticated:true,user:{email:'preview@example.com'}});
 if(url.pathname.startsWith('/api/admin/')){
  let raw='';for await(const c of req)raw+=c;const body=raw?JSON.parse(raw):{};
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
});
server.listen(3011,'127.0.0.1',()=>console.log('Isolated UI test fixture: http://127.0.0.1:3011/admin'));
