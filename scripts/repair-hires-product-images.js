"use strict";
const fs=require("fs"),path=require("path"),sharp=require("sharp");
const SUPABASE="https://ajoiqomflplhadyhxvfe.supabase.co";
const ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqb2lxb21mbHBsaGFkeWh4dmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDIxNjcsImV4cCI6MjEwNDYxODE2N30.B0izdPcH05zWrAvvYXuOGieTkIL7r_UhTrbTVXDAShQ";
const LOGO=path.resolve(__dirname,"..","autohaus.svg");
const JOBS=[
  {slug:"911-turbo-s-coupe-4",n:4,master:"owned-v1/911-turbo-s-coupe-4/04.jpg"},
  {slug:"granturismo-mc",n:4,master:"owned-v1/granturismo-mc/04.jpg"}
];
function h(extra){return Object.assign({apikey:ANON,authorization:"Bearer "+ANON},extra||{});}
function enc(s){return String(s).split("/").map(encodeURIComponent).join("/");}
const svg=fs.readFileSync(LOGO,"utf8").replace(/<svg\b/i,'<svg opacity="0.25"');
async function getMaster(p){
  const r=await fetch(SUPABASE+"/storage/v1/object/vehicle-originals/"+enc(p),{headers:h({accept:"image/*"})});
  if(!r.ok) throw new Error("master "+r.status+" "+p);
  return Buffer.from(await r.arrayBuffer());
}
async function put(name,buf,type){
  const r=await fetch(SUPABASE+"/storage/v1/object/vehicle-images/"+enc(name),{
    method:"POST",headers:h({"content-type":type,"x-upsert":"true","cache-control":"31536000, immutable"}),body:buf
  });
  if(!r.ok) throw new Error("upload "+r.status+" "+name+" "+(await r.text()).slice(0,180));
}
async function build(j){
  const input=await getMaster(j.master);
  const meta=await sharp(input,{failOn:"none"}).rotate().metadata();
  const w=Math.min(1920,meta.width||1920);
  const mark=await sharp(Buffer.from(svg)).resize({width:Math.max(1,Math.round(w*.13))}).png().toBuffer();
  const jpg=await sharp(input,{failOn:"none"}).rotate().resize({width:1920,withoutEnlargement:true,kernel:sharp.kernel.lanczos3})
    .composite([{input:mark,gravity:"centre"}]).jpeg({quality:95,progressive:true,mozjpeg:true,chromaSubsampling:"4:4:4"}).toBuffer();
  const webp=await sharp(input,{failOn:"none"}).rotate().resize({width:1920,withoutEnlargement:true,kernel:sharp.kernel.lanczos3})
    .composite([{input:mark,gravity:"centre"}]).webp({quality:94,effort:5,smartSubsample:true}).toBuffer();
  const base="owned-hires-v1/"+j.slug+"/"+String(j.n).padStart(2,"0")+"-1920";
  await Promise.all([put(base+".jpg",jpg,"image/jpeg"),put(base+".webp",webp,"image/webp")]);
  console.log("repaired "+base);
}
(async()=>{for(const j of JOBS) await build(j);})().catch(e=>{console.error(e&&e.stack||e);process.exitCode=1;});
