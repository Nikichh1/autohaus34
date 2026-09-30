"use strict";
const { test, after } = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const media = require("../server/homepage-media"), handler = require("../api/admin/site-media");
const originalFetch=global.fetch;
after(()=>{global.fetch=originalFetch;});
const id="12345678-1234-4123-8123-123456789012", other="12345678-1234-4123-8123-123456789013";
const user="00000000-0000-4000-8000-000000000001";
const row={id,slot:"hero-0",width:1920,height:1080,created_by:user,state:"pending",is_active:false,byte_count:0};
const token="head."+Buffer.from(JSON.stringify({sub:user,session_id:other})).toString("base64url")+".provider";
function req(action,body={}){return {method:action?"POST":"GET",query:{action},body:{slot:"hero-0",expected_id:null,...body},headers:{host:"example.com",origin:"https://example.com","content-type":"application/json",cookie:"ah_admin_access="+token}};}
function res(){return {headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},getHeader(k){return this.headers[k.toLowerCase()];},end(value){this.body=JSON.parse(value);}};}
function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});}
function provider(fn,role="owner"){global.fetch=async(url,options={})=>String(url).endsWith("/rpc/current_admin_role")?response(role):fn(String(url),options);}
async function call(request){const output=res();await handler(request,output);return output;}
test("homepage image plans deduplicate small images and never escape their family",()=>{
 assert.equal(media.assetPlan(row).length,7);
 assert.equal(media.assetPlan({...row,width:480,height:640}).length,3);
 assert.equal(media.assetPlan({...row,width:1080,height:1920}).length,5);
 assert.equal(media.assetPlan({...row,slot:"wall-servis"}).length,6);
 for(const change of [{id:"../../vehicles/1"},{slot:"unknown"},{width:1921},{height:0}])assert.throws(()=>media.assetPlan({...row,...change}));
 for(const a of media.assetPlan(row))assert.match(a.path,new RegExp("^site-media/"+id+"/"));
});
test("public media has deterministic owned URLs, no archive details or metadata",()=>{
 const result=media.publicMedia([{...row,file_name:"private-name.jpg",created_by:user,src:"https://evil.example/photo"}]);
 assert.deepEqual(Object.keys(result),["hero-0"]);assert.equal(result["hero-0"].width,1920);
 const output=JSON.stringify(result);assert.doesNotMatch(output,/private-name|created_by|evil\.example/);
 assert.deepEqual(media.publicMedia([{...row,id:"malformed"}]),{});
});
test("server-rendered photos preserve lazy hero loading, preload and surrounding content",()=>{
 const template=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
 const result=media.renderHTML(template,media.publicMedia([row,{...row,id:other,slot:"hero-1"}]));
 assert.match(result,new RegExp('data-home-preload="background"[^>]*'+id+'/bg.jpg'));
 assert.match(result,new RegExp('data-home-slot="hero-0" data-home-id="'+id+'"'));
 const lazy=result.match(/<picture[^>]*data-home-slot="hero-1"[\s\S]*?<\/picture>/)[0];
 assert.match(lazy,/data-srcset=/);assert.match(lazy,/data-src=/);assert.doesNotMatch(lazy,/(?<!data-)\bsrc=/);
 assert.equal((result.match(/data-home-slot=/g)||[]).length,10);
 assert.match(result,/object-position:50% 50%/);assert.match(result,/Запитване/);
 assert.equal(media.renderHTML(template,{}),template);
});
test("photo API is same-origin and denies unauthenticated or read-only writes",async()=>{
 provider(()=>{throw Error("Unexpected database call");});const unauth=req();unauth.headers.cookie="";assert.equal((await call(unauth)).statusCode,401);
 const cross=req("sign");cross.headers.origin="https://evil.example";assert.equal((await call(cross)).statusCode,403);
 provider(()=>{throw Error("Unexpected database call");},"viewer");assert.equal((await call(req("sign"))).statusCode,403);
 provider(()=>{throw Error("Unexpected database call");},"editor");assert.equal((await call(req("delete",{id,confirm_delete:true}))).statusCode,403);
});
test("sign reserves metadata before issuing immutable bounded uploads",async()=>{
 let inserted;
 provider((url,options)=>{
  if(url.endsWith("/homepage_images")){inserted=JSON.parse(options.body);return response([]);}
  assert.ok(inserted);assert.match(url,/\/upload\/sign\/vehicle-images\/site-media\//);
  return response({url:"/object/upload/sign/vehicle-images/site-media/"+inserted.id+"/640.jpg?token=fixture"});
 });
 const result=await call(req("sign",{width:480,height:640,file_name:"photo.jpg"}));assert.equal(result.statusCode,200);assert.equal(result.body.uploads.length,3);assert.equal(inserted.created_by,user);
 assert.equal((await call(req("sign",{width:5000,height:640}))).statusCode,400);
 assert.equal((await call(req("sign",{width:640,height:640,expected_id:"bad"}))).statusCode,400);
});
test("incomplete, oversized and wrong-type uploads never activate",async()=>{
 for(const failure of ["missing","oversized","mime"]){
  let swapped=false;
  provider((url,options)=>{
   if(url.includes("/homepage_images?"))return response([row]);
   if(url.includes("/rpc/")){swapped=true;return response(null);}
   return new Response(null,{status:failure==="missing"?404:200,headers:{"content-length":failure==="oversized"?String(5*1048576):"5000","content-type":failure==="mime"?"image/svg+xml":"image/jpeg"}});
  });
  assert.equal((await call(req("complete",{id}))).statusCode,502);assert.equal(swapped,false);
 }
});
test("all verified formats activate together with expected-id conflict protection",async()=>{
 let swap;
 provider((url,options)=>{
  if(url.includes("/homepage_images?"))return response([row]);
  if(url.includes("/rpc/activate_homepage_image")){swap=JSON.parse(options.body);return response(null);}
  return new Response(null,{status:200,headers:{"content-length":"1000","content-type":url.endsWith("webp")?"image/webp":"image/jpeg"}});
 });
 const result=await call(req("complete",{id,expected_id:other}));assert.equal(result.statusCode,200);assert.equal(swap.p_bytes,7000);assert.equal(swap.p_expected,other);
 provider(url=>url.includes("/homepage_images?")?response([{...row,state:"ready"}]):response({message:"STALE_IMAGE"},400));
 assert.equal((await call(req("restore",{id}))).statusCode,409);
});
test("archive deletion needs confirmation, atomically blocks active photos and derives exact file paths",async()=>{
 let paths, finished=false;
 provider((url,options)=>{
  if(url.includes("/homepage_images?"))return response([{...row,state:"ready"}]);
  if(url.includes("/rpc/delete_homepage_image")){if(JSON.parse(options.body).p_finish)finished=true;return response(null);}
  assert.equal(options.method,"DELETE");paths=JSON.parse(options.body).prefixes;return response([]);
 });
 assert.equal((await call(req("delete",{id}))).statusCode,400);
 assert.equal((await call(req("delete",{id,confirm_delete:true,public_id:"vehicles/another-car"}))).statusCode,200);
 assert.equal(paths.length,7);assert.ok(paths.every(p=>p.startsWith("site-media/"+id+"/")));assert.equal(finished,true);
 finished=false;paths=null;
 provider(url=>url.includes("/homepage_images?")?response([{...row,state:"ready",is_active:true}]):response({message:"IMAGE_ACTIVE"},400));
 assert.equal((await call(req("delete",{id,confirm_delete:true}))).statusCode,409);assert.equal(paths,null);
});
test("failed storage deletion retains its database record for retry",async()=>{
 let finished=false;
 provider((url,options)=>{
  if(url.includes("/homepage_images?"))return response([{...row,state:"deleting"}]);
  if(url.includes("/rpc/")){if(JSON.parse(options.body).p_finish)finished=true;return response(null);}
  return response({error:"Unavailable"},503);
 });
 assert.equal((await call(req("delete",{id,confirm_delete:true}))).statusCode,502);assert.equal(finished,false);
});
test("migration isolates archives, enforces roles, atomic swaps and safe interrupted-upload cleanup",()=>{
 const sql=fs.readFileSync(path.join(__dirname,"../admin/migrations/20260930_homepage_images.sql"),"utf8");
 assert.match(sql,/enable row level security/);assert.match(sql,/for select to anon using \(is_active and state = 'ready'\)/);
 assert.match(sql,/security_invoker=true/);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/STALE_IMAGE/);assert.match(sql,/125 minutes/);assert.match(sql,/if target.is_active then raise exception 'IMAGE_ACTIVE'/);
 assert.doesNotMatch(sql,/alter table public\.vehicles|delete from public\.vehicles|service_role/);
 const js=fs.readFileSync(path.join(__dirname,"../admin/site-media.js"),"utf8");assert.doesNotMatch(js,/\bconfirm\(|\balert\(/);assert.match(js,/showModal/);assert.match(js,/capture','environment/);assert.match(js,/1920\/Math.max/);
});
