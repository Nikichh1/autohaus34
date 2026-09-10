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
const user = {id:"00000000-0000-4000-8000-000000000001",email:"staff@example.com"};
const token = "header."+Buffer.from(JSON.stringify({session_id:"00000000-0000-4000-8000-000000000002"})).toString("base64url")+".verified-by-provider";
function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});}
function res(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(v){this.text=v;try{this.body=JSON.parse(v);}catch(_){};}};}
function req(method="GET",body={},query={}){return {method,body,query,headers:{host:"example.com",origin:"https://example.com","content-type":"application/json","sec-fetch-site":"same-origin",cookie:"ah_admin_access="+token}};}
function mockFetch(provider,active=true){global.fetch=async(url,options={})=>{url=String(url);if(url.endsWith("/auth/v1/user"))return response(user);if(url.endsWith("/rpc/admin_session_active"))return response(active);return provider(url,options);};}
async function call(name,request){const output=res();await require("../api/"+name)(request,output);return output;}

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
test("allowlist fails closed and rejects strangers without calling a provider",async()=>{
 global.fetch=()=>{throw new Error("Must not call provider");};
 assert.equal((await lib.login("stranger@example.com","password")).ok,false);
 process.env.ADMIN_EMAILS="";assert.equal(await lib.requireAdmin(req(),res()),null);process.env.ADMIN_EMAILS=keys.ADMIN_EMAILS;
});
test("a valid user also needs a live server session",async()=>{
 mockFetch(()=>{throw new Error("Unexpected provider request");},false);assert.equal(await lib.requireAdmin(req(),res()),null);
 mockFetch(()=>{throw new Error("Unexpected provider request");});assert.equal((await lib.requireAdmin(req(),res())).id,user.id);
});
test("all admin data APIs and page deny unauthenticated access",async()=>{
 global.fetch=()=>{throw new Error("No token should be sent");};
 for(const name of ["vehicles","images","description","page"]){const request=req();request.headers.cookie="";const result=await call("admin/"+name,request);assert.equal(result.statusCode,name==="page"?302:401);}
});
test("vehicle validation preserves unknown values and rejects invalid facts/photos",()=>{
 const base={make:"BMW",model:"Test",equipment_bg:[],equipment_en:[]};
 assert.equal(lib.normalizeVehicle(base).row.mileage,null);
 for(const invalid of [{mileage:"oops"},{mileage:-1},{horsepower:1.5},{fuel:"invented"},{first_registration_month:2},{equipment_bg:["A"]},{published:true},{images:[{original:"https://evil.example/car.jpg"}]}]) assert.ok(lib.normalizeVehicle({...base,...invalid}).error,JSON.stringify(invalid));
 const row=lib.normalizeVehicle({...base,unregistered:true,first_registration_year:2024,first_registration_month:2}).row;
 assert.equal(row.first_registration_year,null);assert.equal(row.first_registration_month,null);
});
test("canonical import preserves all 87 cars, paired equipment and local photos",()=>{
 const rows=require("../api/admin/vehicles").initialInventory();assert.equal(rows.length,87);assert.equal(new Set(rows.map(r=>r.slug)).size,87);
 for(const row of rows){assert.equal(row.equipment_bg.length,row.equipment_en.length);assert.equal(row.published,true);for(const image of row.images){assert.equal(Object.keys(image.variants).length,6);for(const url of Object.values(image.variants)) assert.ok(fs.existsSync(path.join(__dirname,"..",url)));}}
});
test("bootstrap ignores submitted inventory and uses canonical server data",async()=>{
 mockFetch((url,options)=>{assert.ok(url.endsWith("/rpc/import_initial_inventory"));const data=JSON.parse(options.body).initial_vehicles;assert.equal(data.length,87);assert.notEqual(data[0].make,"Injected");return response(87);});
 const output=await call("admin/vehicles",req("POST",{vehicles:[{make:"Injected"}]},{action:"bootstrap"}));assert.equal(output.body.imported,87);
});
test("empty managed inventory stays empty; outage requests static fallback",async()=>{
 mockFetch(url=>response(url.includes("inventory_state")?[{initialized:true}]:[]));
 let output=await call("public/vehicles",req());assert.equal(output.body.authoritative,true);assert.deepEqual(output.body.vehicles,[]);
 mockFetch(()=>response({error:"unavailable"},503));output=await call("public/vehicles",req());assert.equal(output.body.authoritative,false);
});
test("public inventory only requests published cars and excludes private source/review text",async()=>{
 mockFetch(url=>{if(url.includes("inventory_state"))return response([{initialized:true}]);assert.match(url,/published=eq.true/);return response([{slug:"test",description_source:"PRIVATE",description_review_notes:["PRIVATE"],description_bg:"Public",images:[]}]);});
 const output=await call("public/vehicles",req());assert.equal(output.body.authoritative,true);assert.ok(!output.text.includes("PRIVATE"));assert.equal(output.body.vehicles[0].description_bg,"Public");
});
test("stale saves return a conflict instead of overwriting a newer edit",async()=>{
 mockFetch((url,options)=>{if(options.method==="GET")return response([{make:"BMW",model:"Test",images:[]}]);assert.match(url,/updated_at=eq\./);return response([]);});
 const output=await call("admin/vehicles",req("PATCH",{model:"Change",if_unmodified_since:"2026-09-09T10:00:00Z"},{id:user.id}));assert.equal(output.statusCode,409);assert.equal(output.body.code,"EDIT_CONFLICT");
});
test("Cloudinary upload confirmation rejects forged signatures and accepts signed responses",async()=>{
 mockFetch(()=>{throw new Error("Unexpected external call");});const body={public_id:"autohaus/vehicles/photo",version:123,signature:"0".repeat(40)};
 assert.equal((await call("admin/images",req("POST",body,{action:"complete"}))).statusCode,400);
 body.signature=crypto.createHash("sha1").update("public_id="+body.public_id+"&version=123"+keys.CLOUDINARY_API_SECRET).digest("hex");
 const output=await call("admin/images",req("POST",body,{action:"complete"}));assert.equal(output.statusCode,200);assert.equal(Object.keys(output.body.image.variants).length,6);assert.match(output.body.image.variants.webp400,/a_auto\/c_lpad/);assert.ok(!output.text.includes(keys.CLOUDINARY_API_SECRET));
});
test("a photo still referenced by a vehicle cannot be destroyed",async()=>{
 mockFetch(url=>{assert.ok(url.includes("/rest/v1/vehicles?"));return response([{id:user.id}]);});
 const output=await call("admin/images",req("POST",{public_id:"autohaus/vehicles/photo"},{action:"delete"}));assert.equal(output.statusCode,409);assert.equal(output.body.code,"IMAGE_IN_USE");
});
test("Gemini handles free quota, incomplete and unpaired output without a paid fallback",async()=>{
 for(const [payload,status,expected] of [[{},429,"AI_FREE_QUOTA"],[{candidates:[{finishReason:"MAX_TOKENS"}]},200,"AI_INCOMPLETE"],[{candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify({description_bg:"",description_en:"",equipment_bg:["one"],equipment_en:[],review_notes:[]})}]}}]},200,"AI_BAD_OUTPUT"]]){
  mockFetch((url,options)=>{assert.match(url,/generativelanguage.googleapis.com/);assert.ok(!url.includes(keys.GEMINI_API_KEY));assert.equal(options.headers["x-goog-api-key"],keys.GEMINI_API_KEY);return response(payload,status);});
  const output=await call("admin/description",req("POST",{source:"Full service history."}));assert.equal(output.body.code,expected);
 }
});
test("Gemini returns complete paired BG/EN output and uses the current Flash-Lite model",async()=>{
 const result={description_bg:"Сервизна история.",description_en:"Service history.",equipment_bg:["Камера 360°"],equipment_en:["360° camera"],review_notes:[]};
 mockFetch((url,options)=>{assert.match(url,/gemini-3.1-flash-lite/);const request=JSON.parse(options.body);assert.match(request.systemInstruction.parts[0].text,/preserve EVERY/);return response({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify(result)}]}}]});});
 const output=await call("admin/description",req("POST",{source:"Service history. 360° camera."}));assert.deepEqual(output.body.result,result);assert.ok(!output.text.includes(keys.GEMINI_API_KEY));
});
test("browser inventory loader preserves fallback on failure and respects authoritative emptiness",async()=>{
 const source=fs.readFileSync(path.join(__dirname,"../data/vehicles.js"),"utf8");
 for(const [data,expected] of [[{ok:true,authoritative:true,vehicles:[]},0],[{ok:true,authoritative:false,vehicles:[]},1],[null,1]]){
  const window={AH_VEHICLES:[{id:"fallback"}]};const context={window,fetch:async()=>{if(data===null)throw new Error("offline");return response(data);},AbortController,setTimeout,clearTimeout,Map,Promise};
  vm.runInNewContext(source,context);await window.AH_INVENTORY_READY;assert.equal(window.AH_VEHICLES.length,expected);
 }
});
