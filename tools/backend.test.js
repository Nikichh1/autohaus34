const inventoryCount = require("../data/inventory-manifest.json").count;
"use strict";
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const lib = require("../server/admin-lib");
const originalFetch = global.fetch;
const keys = { SUPABASE_URL:"https://test.supabase.co", SUPABASE_ANON_KEY:"test-anon", SUPABASE_SERVICE_ROLE_KEY:"test-service", ADMIN_EMAILS:"staff@example.com", CLOUDINARY_CLOUD_NAME:"test-cloud", CLOUDINARY_API_KEY:"test-key", CLOUDINARY_API_SECRET:"test-secret", GEMINI_API_KEY:"test-gemini" };
const originalEnv = Object.fromEntries(Object.keys(keys).map(k=>[k,process.env[k]]));
Object.assign(process.env, keys);
after(()=>{ global.fetch=originalFetch; for(const [k,v] of Object.entries(originalEnv)) { if(v===undefined) delete process.env[k]; else process.env[k]=v; } });
const user = {id:"00000000-0000-4000-8000-000000000001",email:"staff@example.com",app_metadata:{role:"admin",managed_role:"owner"}};
function tokenFor(id=user.id){return "header."+Buffer.from(JSON.stringify({sub:id,email:user.email,app_metadata:user.app_metadata,session_id:"00000000-0000-4000-8000-000000000002"})).toString("base64url")+".verified-by-provider";}
const token = tokenFor();
function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});}
function res(){return {headers:{},statusCode:200,getHeader(k){return this.headers[k.toLowerCase()];},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(v){this.text=v;try{this.body=JSON.parse(v);}catch(_){};}};}
function req(method="GET",body={},query={}){return {method,body,query,headers:{host:"example.com",origin:"https://example.com","content-type":"application/json","sec-fetch-site":"same-origin",cookie:"ah_admin_access="+token}};}
function mockFetch(provider,active=true){global.fetch=async(url,options={})=>{url=String(url);if(url.endsWith("/auth/v1/user"))return response(user);if(url.endsWith("/rpc/current_admin_role"))return response(active ? "owner" : null);return provider(url,options);};}
async function call(name,request){const output=res();const modulePath=require.resolve("../api/"+name);if(name==="public/vehicles")delete require.cache[modulePath];await require(modulePath)(request,output);return output;}

test("mutations require same-origin JSON, including login",()=>{
 for(const edit of [{origin:"https://evil.example"},{origin:"",referer:""},{"sec-fetch-site":"same-site"},{"content-type":"text/plain"}]){
  const request=req("POST");Object.assign(request.headers,edit);const output=res();assert.equal(lib.requireSameOrigin(request,output),false);assert.ok([403,415].includes(output.statusCode));
 }
 assert.equal(lib.requireSameOrigin(req("POST"),res()),true);
});
test("auth cookies are HttpOnly, Secure and SameSite Strict",()=>{
 const output=res();lib.setSessionCookies(req(),output,{access_token:"access",refresh_token:"refresh",expires_in:3600});
 for(const cookie of output.headers["set-cookie"]){assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Secure/);}
});
test("login rejects accounts without a trusted admin role",async()=>{
 global.fetch=async url=>String(url).includes("token?") ? response({access_token:"denied",user:{email:"stranger@example.com"}}) : response({});
 assert.equal((await lib.login("stranger@example.com","password")).ok,false);
});

test("a valid user also needs a live server session",async()=>{
 mockFetch(()=>{throw new Error("Unexpected provider request");},false);assert.equal(await lib.requireAdmin(req(),res()),null);
 mockFetch(()=>{throw new Error("Unexpected provider request");});assert.equal((await lib.requireAdmin(req(),res())).id,user.id);
});
test("all admin data APIs and page deny unauthenticated access",async()=>{
 global.fetch=()=>{throw new Error("No token should be sent");};
 for(const name of ["vehicles","images","description","team","analytics","page"]){const request=req();request.headers.cookie="";const result=await call("admin/"+name,request);assert.equal(result.statusCode,name==="page"?302:401);}
});
test("vehicle validation preserves unknown values and rejects invalid facts/photos",()=>{
 const base={make:"BMW",model:"Test",equipment_bg:[],equipment_en:[]};
 assert.equal(lib.normalizeVehicle(base).row.mileage,null);
 for(const invalid of [{mileage:"oops"},{mileage:-1},{horsepower:1.5},{fuel:"invented"},{first_registration_month:2},{equipment_bg:["A"]},{published:true},{images:[{original:"https://evil.example/car.jpg"}]}]) assert.ok(lib.normalizeVehicle({...base,...invalid}).error,JSON.stringify(invalid));
 const row=lib.normalizeVehicle({...base,unregistered:true,first_registration_year:2024,first_registration_month:2}).row;
 assert.equal(row.first_registration_year,null);assert.equal(row.first_registration_month,null);
});
test("canonical import preserves all current cars, paired equipment and local photos",()=>{
 const rows=require("../api/admin/vehicles").initialInventory();assert.equal(rows.length,inventoryCount);assert.equal(new Set(rows.map(r=>r.slug)).size,inventoryCount);
 for(const row of rows){assert.equal(row.equipment_bg.length,row.equipment_en.length);assert.equal(row.published,true);for(const image of row.images){assert.equal(Object.keys(image.variants).length,6);for(const url of Object.values(image.variants)) assert.ok(fs.existsSync(path.join(__dirname,"..",url)));}}
});
test("retired bootstrap cannot replace live inventory",async()=>{
 mockFetch(()=>{throw Error("Bootstrap must not write");});
 assert.equal((await call("admin/vehicles",req("POST",{vehicles:[]},{action:"bootstrap"}))).statusCode,410);
});

test("empty managed inventory stays empty; outage requests static fallback",async()=>{
 mockFetch(url=>response(url.includes("inventory_state")?[{initialized:true}]:[]));
 let output=await call("public/vehicles",req());assert.equal(output.body.authoritative,true);assert.deepEqual(output.body.vehicles,[]);
 mockFetch(()=>response({error:"unavailable"},503));output=await call("public/vehicles",req());assert.equal(output.body.authoritative,false);
});
test("public inventory only requests published cars and excludes private source/review text",async()=>{
 mockFetch(url=>{if(url.includes("inventory_state"))return response([{initialized:true}]);assert.match(url,/published=eq.true/);return response([{slug:"test",description_source:"PRIVATE",description_review_notes:["PRIVATE"],description_bg:"Public",images:[]}]);});
 const output=await call("public/vehicles",req());assert.equal(output.body.authoritative,true);assert.ok(!output.text.includes("PRIVATE"));assert.equal(output.body.vehicles[0].description_bg,undefined);
 const detail=await call("public/vehicles",req("GET",{},{id:"test"}));assert.equal(detail.body.vehicle.description_bg,"Public");
});
test("stale saves return a conflict instead of overwriting a newer edit",async()=>{
 mockFetch((url,options)=>{if(options.method==="GET")return response([{make:"BMW",model:"Test",images:[]}]);assert.match(url,/updated_at=eq\./);return response([]);});
 const output=await call("admin/vehicles",req("PATCH",{model:"Change",if_unmodified_since:"2026-09-09T10:00:00Z"},{id:user.id}));assert.equal(output.statusCode,409);assert.equal(output.body.code,"EDIT_CONFLICT");
});
test("Supabase uploads use unique signed paths and verify completion",async()=>{
 mockFetch((url,options)=>{if(options.method==="HEAD")return response({});assert.match(url,/object\/upload\/sign\/vehicle-images\/vehicles\//);return response({url:"/object/upload/sign/vehicle-images/vehicles/test?token=test"});});
 const a=await call("admin/images",req("POST",{},{action:"sign"})),b=await call("admin/images",req("POST",{},{action:"sign"}));
 assert.notEqual(a.body.public_id,b.body.public_id);assert.equal(a.body.provider,"supabase");
 assert.equal((await call("admin/images",req("POST",{public_id:"../invalid"},{action:"complete"}))).statusCode,400);
 const out=await call("admin/images",req("POST",{public_id:a.body.public_id},{action:"complete"}));assert.equal(out.statusCode,200);assert.match(out.body.image.original,/storage\/v1\/object\/public/);
});
test("responsive uploads sign and verify one original plus six real derivative paths",async()=>{
 const signed=[],verified=[];
 mockFetch((url,options)=>{
  if(options.method==="HEAD"){verified.push(url);return response({});}
  signed.push(url);const path=new URL(url).pathname.split("/vehicle-images/")[1];
  return response({url:"/object/upload/sign/vehicle-images/"+path+"?token=test"});
 });
 const prepared=await call("admin/images",req("POST",{responsive:true},{action:"sign"}));
 assert.equal(prepared.statusCode,200);assert.equal(prepared.body.responsive,true);
 assert.deepEqual(Object.keys(prepared.body.uploads),["original","jpg400","jpg800","jpg1280","webp400","webp800","webp1280"]);
 assert.equal(new Set(Object.values(prepared.body.uploads).map(item=>item.path)).size,7);
 assert.equal(signed.length,7);assert.equal(prepared.body.uploads.original.path,prepared.body.public_id);
 assert.match(prepared.body.uploads.jpg400.path,/-400\.jpg$/);assert.match(prepared.body.uploads.webp1280.path,/-1280\.webp$/);
 const completed=await call("admin/images",req("POST",{public_id:prepared.body.public_id,responsive:true,width:1600,height:1067},{action:"complete"}));
 assert.equal(completed.statusCode,200);assert.equal(verified.length,7);
 assert.equal(completed.body.image.width,1600);assert.equal(completed.body.image.height,1067);
 assert.equal(new Set(Object.values(completed.body.image.variants)).size,6);
 assert.notEqual(completed.body.image.variants.webp400,completed.body.image.variants.jpg1280);
});
test("responsive completion fails closed when any derivative is missing",async()=>{
 let heads=0;
 mockFetch((url,options)=>options.method==="HEAD"?response({},++heads===4?404:200):response({}));
 const output=await call("admin/images",req("POST",{public_id:"vehicles/"+user.id,responsive:true,width:1600,height:1000},{action:"complete"}));
 assert.equal(output.statusCode,400);assert.equal(heads,7);
});
test("a photo still referenced by a vehicle cannot be destroyed",async()=>{
 mockFetch(()=>response([{id:user.id}]));
 const output=await call("admin/images",req("POST",{public_id:"vehicles/"+user.id},{action:"delete"}));assert.equal(output.statusCode,409);assert.equal(output.body.code,"IMAGE_IN_USE");
});
test("responsive deletion removes only the fixed object family and tolerates retry 404s",async()=>{
 const deleted=[];
 mockFetch((url,options)=>{
  if(options.method==="GET")return response([]);
  if(options.method==="DELETE"){deleted.push(new URL(url).pathname.split("/vehicle-images/")[1]);return response({},deleted.length===2?404:200);}
  throw new Error("Unexpected provider request");
 });
 const root="vehicles/"+user.id;
 const output=await call("admin/images",req("POST",{public_id:root,responsive:true},{action:"delete"}));
 assert.equal(output.statusCode,200);assert.equal(deleted.length,7);
 assert.deepEqual(new Set(deleted),new Set([root,root+"-400.jpg",root+"-800.jpg",root+"-1280.jpg",root+"-400.webp",root+"-800.webp",root+"-1280.webp"]));
});

test("translation endpoint returns aligned lines and caches successful provider results",async()=>{
 let calls=0;
 mockFetch(url=>{
   calls++;
   assert.match(url,/translate.googleapis.com/);
   return response([[["Parking camera\nHeated seats"]]]);
 });
 const request=req("POST",{target:"en",lines:["Камера за паркиране","Отопляеми седалки"]},{action:"translate"});
 const output=await call("admin/description",request);
 assert.equal(output.statusCode,200);
 assert.deepEqual(output.body.lines,["Parking camera","Heated seats"]);
 assert.equal(output.body.pending,false);
 await call("admin/description",request);
 assert.equal(calls,1);
});

test("translation failures report pending, while invalid and oversized requests are rejected",async()=>{
 mockFetch(()=>response({},503));
 const failed=await call("admin/description",req("POST",{target:"en",lines:["Уникална непозната фраза"]},{action:"translate"}));
 assert.equal(failed.body.pending,true);
 assert.deepEqual(failed.body.lines,["Уникална непозната фраза"]);
 assert.equal((await call("admin/description",req("POST",{lines:["x".repeat(2001)]},{action:"translate"}))).statusCode,400);
 assert.equal((await call("admin/description",req("POST",{source:"x".repeat(30001)}))).body.code,"SOURCE_TOO_LONG");
});

test("browser inventory loader preserves fallback on failure and respects authoritative emptiness",async()=>{
 const source=fs.readFileSync(path.join(__dirname,"../data/vehicles.js"),"utf8");
 for(const [data,expected] of [[{ok:true,authoritative:true,vehicles:[]},0],[{ok:true,authoritative:false,vehicles:[]},1],[null,1]]){
  const window={AH_VEHICLES:[{id:"fallback"}]};const context={window,location:{pathname:"/",search:""},fetch:async()=>{if(data===null)throw new Error("offline");return response(data);},AbortController,URLSearchParams,setTimeout,clearTimeout,Map,Promise};
  vm.runInNewContext(source,context);await window.AH_INVENTORY_READY;assert.equal(window.AH_VEHICLES.length,expected);
 }
});

test("admin database credentials survive await and never leak into public requests",async()=>{
 const seen=[];mockFetch(async(url,options)=>{seen.push(options.headers.Authorization||null);return response([]);});
 const a=req(),b=req();b.headers.cookie='ah_admin_access='+tokenFor("00000000-0000-4000-8000-000000000009");
 await Promise.all([lib.requireAdmin(a,res()),lib.requireAdmin(b,res())]);
 await Promise.resolve();await lib.databaseFor(a)('vehicles');await lib.databaseFor(b)('vehicles');await lib.db('vehicles');
 assert.deepEqual(seen,['Bearer '+token,'Bearer '+tokenFor("00000000-0000-4000-8000-000000000009"),null]);
});
test("viewers cannot mutate vehicles, images, AI or sync",async()=>{
 global.fetch=async url=>String(url).endsWith('/user')?response(user):response('viewer');
 for(const name of ['vehicles','images','description'])assert.equal((await call('admin/'+name,req('POST',{},name==='sync'?{action:'vehicle'}:{}))).statusCode,403);
});
