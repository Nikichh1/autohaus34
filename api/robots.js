"use strict";
module.exports = function handler(req,res){
  if(req.method!=="GET"){res.statusCode=405;return res.end("Method not allowed");}
  const host=String(req.headers["x-forwarded-host"]||req.headers.host||"autohaus24.vercel.app").split(",")[0].trim();
  const origin="https://"+host.replace(/^https?:\/\//i,"");
  res.statusCode=200;
  res.setHeader("Content-Type","text/plain; charset=utf-8");
  res.setHeader("Cache-Control","public, max-age=3600, s-maxage=3600");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.end(
    "User-agent: *\n"+
    "Allow: /\n"+
    "Disallow: /admin\n"+
    "Disallow: /api/\n"+
    "Disallow: /img/v/\n"+
    "Disallow: /data/vehicles.base.js\n\n"+
    "Sitemap: "+origin+"/sitemap.xml\n"
  );
};
