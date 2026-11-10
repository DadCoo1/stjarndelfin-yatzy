// Gör appikonerna (180/192/512) för både vanliga appen och dev från tools/icon.html.  node tools/make-icons.js
const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path');
(async()=>{ const b=await chromium.launch(); const p=await b.newPage(); await p.goto('http://127.0.0.1:8811/tools/icon.html');
  for(const dev of [false,true]){ const url=await p.evaluate(d=>drawIcon(d),dev); const buf=Buffer.from(url.split(',')[1],'base64'); const big=path.join('/tmp','icon-'+(dev?'dev':'main')+'-1024.png'); fs.writeFileSync(big,buf); }
  await b.close(); })();
