// Ljudlandskapen: alla sju startar utan fel, låter (inte tyst), klipper inte, och har rimlig klang (mörkt/ljust) för sitt slag.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']}); let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; }; const errs=[];
  const c=await b.newContext({viewport:{width:390,height:844}}); await c.addInitScript("window.__NET_SERVER=''; localStorage.setItem('dev:onboarded','1'); localStorage.setItem('dev:snd_vol','1')");
  const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='warning'&&/ljudlandskap/.test(m.text())) errs.push(m.text()); }); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1500);
  await p.click('[data-act=sndopen]'); await sleep(300); ok(await p.$$eval('#modal [data-act=sndplay]',e=>e.length)===7, 'sju ljudlandskap: regn, åska, vågor, hav, vind, brasa, bubblor');
  // mäter under några sekunder: styrka (RMS), toppvärde, och var tyngdpunkten i klangen ligger (Hz)
  const measure=(kind,ms,ev)=>p.evaluate(async([kind,ms,ev])=>{ const S=TODAY.SND; const t0=performance.now(); S.play(kind,0); const build=performance.now()-t0; await new Promise(r=>setTimeout(r,2800)); if(ev==='strike') S._t.strike(.1); if(ev==='wave') S._t.wave();
    const an=S._t.an(), ac=S._t.ac(), td=new Float32Array(an.fftSize), fd=new Float32Array(an.frequencyBinCount); let peak=0, sum=0, n=0, cs=0, cw=0, rmsList=[];
    const end=performance.now()+ms; while(performance.now()<end){ an.getFloatTimeDomainData(td); let s=0; for(const v of td){ s+=v*v; if(Math.abs(v)>peak) peak=Math.abs(v); } rmsList.push(Math.sqrt(s/td.length)); sum+=s; n+=td.length;
      an.getFloatFrequencyData(fd); for(let i=1;i<fd.length;i++){ const pw=Math.pow(10,fd[i]/10); cs+=pw*i*ac.sampleRate/an.fftSize; cw+=pw; } await new Promise(r=>setTimeout(r,60)); }
    const mn=Math.min(...rmsList), mx=Math.max(...rmsList); return {rms:Math.sqrt(sum/n), peak, centroid:cs/cw, vary:mx/(mn+1e-6), build:Math.round(build), state:ac.state}; },[kind,ms,ev]);
  const want={rain:[1500,9000], thunder:[60,6000], shore:[150,6000], sea:[40,1500], wind:[80,2500], fire:[80,6000], bub:[60,2500]};
  for(const [k,ms,ev] of [['rain',2500],['thunder',5000,'strike'],['shore',9000,'wave'],['sea',4000],['wind',6000],['fire',4000],['bub',4000]]){ const r=await measure(k,ms,ev);
    ok(r.rms>.004 && r.peak<.99 && r.centroid>want[k][0] && r.centroid<want[k][1], `${k}: styrka ${r.rms.toFixed(3)}, topp ${r.peak.toFixed(2)}, klangens tyngdpunkt ${Math.round(r.centroid)} Hz, variation ×${r.vary.toFixed(1)}, byggtid ${r.build} ms`); }
  await p.evaluate(()=>TODAY.SND.stop()); await sleep(6500);
  const q=await p.evaluate(()=>{ const an=TODAY.SND._t.an(), td=new Float32Array(an.fftSize); an.getFloatTimeDomainData(td); return Math.max(...td.map(Math.abs)); }); ok(q<.002, 'tystnar när man stänger av ('+q.toFixed(4)+')');
  ok(!errs.length, 'inga fel '+JSON.stringify(errs.slice(0,3)));
  console.log(fails?fails+' FEL':'alla ljudtester ok'); await b.close(); process.exit(fails?1:0); })();
