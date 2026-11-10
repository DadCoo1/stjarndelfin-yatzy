// Pins: räknas fram ur befintlig statistik, firas en gång, syns under Idag, delas bara med öppen profil.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await chromium.launch(); let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; }; const errs=[];
  const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  await c.addInitScript(`window.__NET_SERVER=''; if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1');
    localStorage.setItem('dev:onboarded','1'); localStorage.setItem('dev:ry_name','Ida');
    const t=new Date('2025-12-24T12:00:00').getTime();
    localStorage.setItem('dev:ry_stats', JSON.stringify({games:[{id:'a',d:t,type:'ai-easy',order:'free',players:[{n:'Ida',s:262,up:70,bonus:50,rows:{yatzy:50},human:true},{n:'Blixt 🤖',s:180,human:false,ai:'easy'}]}]}));
    localStorage.setItem('dev:race_stats', JSON.stringify({games:3,fin:1,best:900,hs:[]}));
    localStorage.setItem('dev:daily_2026-07-01', JSON.stringify({g:[[0,1,2,3],[1,1,1,1]],done:true,ok:true,t0:1,ms:5000}));
  }`);
  const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(2600);
  const g=await p.evaluate(()=>JSON.parse(lsGet('pins')||'{}'));
  for(const k of ['first:1','yatzy:1','bonus:1','high:2','race:1','code:1','mind:1','winter:1','summer:1','xmas:1','explore:0'].filter(k=>!k.endsWith(':0'))) ok(!!g[k], 'har '+k);
  ok(!g['high:3'] && !g['explore:1'], 'inget för mycket ('+Object.keys(g).length+' pins)');
  ok(!await p.$('.pin-pop'), 'gammal historik firas inte med en massa popups');
  ok(!!await p.$('.tcard.pins'), 'kortet Mina pins syns under Idag');
  // ett nytt spel → ny pin firas
  await p.evaluate(()=>{ const s=JSON.parse(lsGet('race_stats')); s.games=12; s.fin=10; lsSet('race_stats',JSON.stringify(s)); PINS.check(false); }); await sleep(400);
  ok(!!await p.$('.pin-pop'), 'ny pin firas'); await p.screenshot({path:'/tmp/pin-pop.png'});
  const seen=[]; for(let i=0;i<5 && await p.$('.pin-pop');i++){ seen.push((await p.$eval('.pin-pop',e=>e.innerText)).replace(/\n/g,' ')); await p.click('.pin-pop'); await sleep(700); }
  ok(seen.some(t=>/Sommarvägen/.test(t) && /Silver/.test(t)) && seen.length===2, 'en popup per pin, högsta nivån: '+seen.join(' | '));
  ok(!await p.$('.pin-pop'), 'tryck stänger');
  const again=await p.evaluate(()=>PINS.check(false)); ok(!again.some(([id])=>id==='race'||id==='played'), 'samma pin firas inte två gånger (ny idag: '+JSON.stringify(again));
  // samlingen
  await p.click('.tcard.pins'); await sleep(400); ok(!!await p.$('.sheet[data-kind=pins] .pin-grid'), 'samlingen öppnas'); await p.screenshot({path:'/tmp/pin-grid.png', fullPage:false});
  const n=await p.$$eval('.pin-cell',e=>e.length); ok(n===await p.evaluate(()=>PINS.DEFS.length), 'alla '+n+' pins visas');
  await p.click('[data-act=pinone][data-id=race]'); await sleep(300); ok(/Guld/.test(await p.$eval('.pin-one',e=>e.innerText)), 'detaljvy med nivåer'); await p.screenshot({path:'/tmp/pin-one.png'}); await p.click('.pin-one [data-act=pintab]'); await sleep(300);
  await p.click('[data-act=pintab][data-k=stat]'); await sleep(300); ok(!!await p.$('.pin-kpis'), 'siffror');
  await p.click('[data-act=pintab][data-k=top]'); await sleep(300); ok(/Ida|Du/.test(await p.$eval('.pin-lb.me',e=>e.innerText)), 'topplistan visar mig'); await p.screenshot({path:'/tmp/pin-top.png'});
  await p.click('[data-act=pinvis][data-k=hidden]'); await sleep(200); ok(await p.evaluate(()=>lsGet('pins_vis'))==='hidden', 'kan dölja min samling');
  // vilodagar tar inte bort något
  const before=await p.evaluate(()=>Object.keys(JSON.parse(lsGet('pins'))).length); await p.evaluate(()=>{ lsSet('race_stats',''); PINS.check(true); });
  ok(await p.evaluate(()=>Object.keys(JSON.parse(lsGet('pins'))).length)===before, 'förtjänade pins försvinner aldrig');
  // ljust tema
  await p.evaluate(()=>{ STYLE.set && STYLE.set({world:'ljus'}); PINS.open(); }); await sleep(300); await p.screenshot({path:'/tmp/pin-light.png'});
  ok(!errs.length, 'inga fel '+JSON.stringify(errs));
  console.log(fails?fails+' FEL':'alla pintester ok'); await b.close(); process.exit(fails?1:0); })();
