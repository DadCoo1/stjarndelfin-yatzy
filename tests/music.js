// Bakgrundsmusiken: startar utan fel, spelar (pad, bas, flöjt), klipper inte, och tystnar när man stänger av.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']}); let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; }; const errs=[];
  const c=await b.newContext(); await c.addInitScript("window.__NET_SERVER=''; localStorage.setItem('dev:onboarded','1')");
  const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1200);
  const r=await p.evaluate(async()=>{ unlockAudio(); musicOn=true; stopMusic(); await new Promise(r=>setTimeout(r,200)); startMusic(); if(!MUS) return null; const an=AC.createAnalyser(); an.fftSize=2048; MUS.out.connect(an); const td=new Float32Array(2048), fd=new Float32Array(1024);
    let peak=0, sum=0, n=0, cs=0, cw=0; const steps0=MUS.step; const end=performance.now()+16000; while(performance.now()<end){ an.getFloatTimeDomainData(td); for(const v of td){ sum+=v*v; n++; if(Math.abs(v)>peak) peak=Math.abs(v); } an.getFloatFrequencyData(fd); for(let i=1;i<1024;i++){ const pw=Math.pow(10,fd[i]/10); cs+=pw*i*AC.sampleRate/2048; cw+=pw; } await new Promise(r=>setTimeout(r,80)); }
    const steps=MUS.step-steps0; stopMusic(); await new Promise(r=>setTimeout(r,1800)); an.getFloatTimeDomainData(td); return {rms:Math.sqrt(sum/n), peak, centroid:cs/cw, steps, after:Math.max(...td.map(Math.abs)), mus:MUS}; });
  ok(!!r, 'musiken startar'); if(r){ ok(r.rms>.003 && r.peak<.9, `spelar utan att klippa (styrka ${r.rms.toFixed(3)}, topp ${r.peak.toFixed(2)})`); ok(r.centroid>120 && r.centroid<1800, `mjuk klang (tyngdpunkt ${Math.round(r.centroid)} Hz)`); ok(r.steps>=18, `håller takten (${r.steps} slag på 16 s)`); ok(r.after<.003 && r.mus===null, 'tystnar när den stängs av'); }
  ok(!errs.length, 'inga fel '+JSON.stringify(errs.slice(0,3)));
  console.log(fails?fails+' FEL':'alla musiktester ok'); await b.close(); process.exit(fails?1:0); })();
