// Slalom: bansättningen följer Skidförbundets regler på alla backar, banorna går att åka, och bilden ritas utan fel i alla kameralägen.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await chromium.launch(); let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; }; const errs=[];
  const c=await b.newContext({viewport:{width:430,height:860},deviceScaleFactor:2}); await c.addInitScript("window.__NET_SERVER=''; localStorage.setItem('dev:onboarded','1'); localStorage.setItem('dev:sl_gl','0'); /* testar den enkla grafiken; 3D-grafiken provas i look.js */ localStorage.setItem('dev:sfx','0')");
  const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1500);
  await p.evaluate(()=>GINFO.slalom.menu()); await sleep(600);
  ok(await p.$$eval('[data-sl=ven]',e=>e.length)===3, 'tre backar att välja: Björnrike, Störtloppet, Gästrappet');
  await p.screenshot({path:'/tmp/sl-menu.png'});
  await p.click('[data-sl=ven][data-v=st]'); await sleep(300); ok(/Åreskutan/.test(await p.$eval('#slVi',e=>e.textContent)), 'backens fakta visas: '+await p.$eval('#slVi',e=>e.textContent));
  await p.fill('#nm','Test'); await p.click('[data-sl=solo]'); await sleep(1200);
  // regler och åkbarhet: alla backar, båda grenarna, många bansättningar
  const res=await p.evaluate(()=>{ const T=SLALOM.__test, out=[]; 
    for(const venue of ['bj','st','ga']) for(const disc of ['gs','sl']) for(const par of [false,true]){ let spr=[], dmin=99, dmax=0, figs=new Set(), bad=[], miss=0, runs=0, tmin=1e9, tmax=0, ns=[], setters=new Set(), styles=new Set(), air=0, vmax=0;
      for(let k=0;k<(par?6:16);k++){ G.venue=venue; G.disc=disc; G.par=par; G.std=k===0; G.seeds=[1000+k*7919,5]; G.run=1; G.pen=true; G.go=(G.go||0)+1; if(par&&G.names.length<2){ } 
        const C=T.setCourse(G); const v=T.checkCourse(C,G); if(v.length) bad.push(k+': '+v.join(', ')); ns.push(C.info.n); setters.add(C.info.setter); styles.add(C.info.style); spr.push(C.info.spread); dmin=Math.min(dmin,C.info.dzMin); dmax=Math.max(dmax,C.info.dzMax); C.info.figs.forEach(f=>figs.add(f));
        if(par||k>=8) continue;
        T.newRun(); const R=T.run(), s=R.sk[0]; R.started=true; let t=0; while(!s.done&&t<200){ T.physics(s,1/60,T.aiInput(s,'hard',1/60)); t+=1/60; if(s.air>air) air=s.air; if(s.v>vmax) vmax=s.v; }
        runs++; miss+=s.missed; tmin=Math.min(tmin,s.t); tmax=Math.max(tmax,s.t); }
      out.push({venue,disc,par,bad,miss,runs,tmin:+tmin.toFixed(1),tmax:+tmax.toFixed(1),n:[Math.min(...ns),Math.max(...ns)],setters:setters.size,styles:styles.size,spread:spr.reduce((a,b)=>a+b,0)/spr.length,dmin,dmax,figs:[...figs],air:+air.toFixed(2),kmh:Math.round(vmax*3.6)}); }
    return out; });
  for(const r of res){ ok(!r.bad.length, `${r.venue} ${r.disc}${r.par?' parallell':''}: regler ok, ${r.n[0]}–${r.n[1]} portar${r.bad.length?' ✗ '+r.bad.slice(0,3).join(' | '):''}`);
    if(!r.par){ ok(r.miss<=1, `   går att åka: ${r.miss} missade portar på ${r.runs} åk, ${r.tmin}–${r.tmax} s, toppfart ${r.kmh} km/h, luft ${r.air} m`); ok(r.styles>=3 && r.spread>.06 && r.figs.length>=6, `   varierad bansättning: avstånd ${r.dmin.toFixed(1)}–${r.dmax.toFixed(1)} m (spridning ${Math.round(r.spread*100)} %), ${r.figs.length} sorters figurer, ${r.setters} bansättare`); } }
  // rita i alla lägen
  await p.evaluate(()=>{ G.venue='st'; G.disc='gs'; G.par=false; G.std=true; G.go++; window.__slAuto=true; render(); }); await sleep(5500);
  await p.screenshot({path:'/tmp/sl-rider.png'});
  await p.click('[data-dr=tg]'); await sleep(600);
  // inga stora mörka fält får blixtra in i bilden (ytor alldeles intill kameran): mät andelen mörka bildpunkter i många bildrutor
  const dark=()=>p.evaluate(async()=>{ const cv=document.querySelector('.sl-cv'), g=cv.getContext('2d'); let worst=0; for(let i=0;i<14;i++){ await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); const d=g.getImageData(0,0,cv.width,cv.height).data; let n=0, t=0; for(let k=0;k<d.length;k+=64){ t++; if(d[k]+d[k+1]+d[k+2]<150) n++; } worst=Math.max(worst,n/t); } return worst; });
  let worst=await dark();
  for(const v of ['back','obk','top','ofr','front','tv']){ await p.click(`[data-dr=v][data-v=${v}]`); await sleep(1300); worst=Math.max(worst,await dark()); await p.screenshot({path:`/tmp/sl-dr-${v}.png`}); }
  ok(worst<.2, 'inga stora mörka fält i bilden i något kameraläge (mörkast: '+Math.round(worst*100)+' % av bilden)');
  ok(!errs.length, 'inga fel '+JSON.stringify(errs.slice(0,3)));
  console.log(fails?fails+' FEL':'alla slalomtester ok'); await b.close(); process.exit(fails?1:0); })();
