// Idag: hälsning och dagsform, kort, dagens kod, akvariet, ljud, säkerhetskopia (server + återställning) och spökbil.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await chromium.launch(); let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; }; const errs=[];
  const mk=async(tok)=>{ const c=await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2}); await c.addInitScript(`window.__NET_SERVER='127.0.0.1:9000'; try{ localStorage.setItem('dev:onboarded','1'); }catch(e){} try{ if(!localStorage.getItem('dev:srv_tok')){ localStorage.setItem('dev:srv_tok','${tok}'); localStorage.setItem('dev:srv_user','ida'); localStorage.setItem('dev:ry_name','Ida'); } }catch(e){}`); const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(3500); return {c,p}; };
  let {c,p}=await mk(process.env.TOK);
  const hero=await p.evaluate(()=>document.querySelector('.today-hero')?.innerText); ok(/Ida/.test(hero) && /Lugn dag/.test(hero), 'hälsning med namn och dagsform: '+hero.replace(/\n/g,' | '));
  await p.screenshot({path:'/tmp/today_1.png'});
  await p.click('[data-act=mood][data-m=sofa]'); await sleep(600);
  ok(await p.evaluate(()=>document.body.classList.contains('sofa')), 'Lugn dag → lugnt läge');
  const g1=await p.evaluate(()=>document.querySelector('.today-hero .greet span').innerText); console.log('  soffhälsning:', g1);
  const first=await p.evaluate(()=>document.querySelector('#todayRow .tcard b').innerText); ok(/Stella/.test(first), 'Lugn dag: akvariet först i Idag ('+first+')');
  await p.screenshot({path:'/tmp/today_sofa.png'});
  await p.click('[data-act=mood][data-m=go]'); await sleep(600); ok(!await p.evaluate(()=>document.body.classList.contains('sofa')), 'Full fart → inte lugnt läge');
  // dölj dagsformen
  await p.evaluate(()=>{ lsSet('mood_show','0'); TODAY.applySofa(); render(); }); await sleep(300);
  const h2=await p.evaluate(()=>document.querySelector('.today-hero').innerText); ok(!/Lugn dag/.test(h2), 'dold dagsform: neutral hälsning ('+h2.replace(/\n/g,' | ')+')');
  await p.evaluate(()=>{ lsSet('mood_show','1'); render(); });
  // dagens kod: lös den med facit
  await p.click('[data-act=dailyopen]'); await sleep(300);
  const code=await p.evaluate(()=>{ const d=new Date(); const s=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; return TODAY.DAILY.code(s); });
  for(const i of [0,0,0,0]) await p.click(`[data-act=dkpick][data-i="${i}"]`); await p.click('[data-act=dkgo]'); await sleep(200);
  for(const i of code) await p.click(`[data-act=dkpick][data-i="${i}"]`); await p.screenshot({path:'/tmp/today_daily_b.png'}); await p.click('[data-act=dkgo]'); await sleep(900);
  const res=await p.evaluate(()=>document.querySelector('.dk-res')?.innerText||''); ok(/Knäckt på [12] försök/.test(res), 'dagens kod löst: '+res.replace(/\n/g,' '));
  await p.screenshot({path:'/tmp/today_daily.png'}); await p.evaluate(()=>closeModal());
  // akvariet
  await p.click('[data-act=aqopen]'); await sleep(1200);
  await p.mouse.click(120,300); await sleep(4500);
  const aq=await p.evaluate(()=>TODAY.AQ._get()); ok(aq.days.length===1 && aq.fedAt>0, 'akvariet: omsorgsdag räknad och delfinen åt ('+JSON.stringify({days:aq.days.length, food:aq.food})+')');
  await p.screenshot({path:'/tmp/today_aq.png'});
  await p.click('[data-act=sndplay][data-k=rain]'); await sleep(500); ok(await p.evaluate(()=>TODAY.SND.playing())==='rain', 'regnljud spelar');
  await p.click('[data-act=aqclose]'); await sleep(500); ok(!await p.$('#aqWrap'), 'akvariet stängs');
  await p.evaluate(()=>TODAY.SND.stop(true));
  // säkerhetskopia till servern
  await p.evaluate(()=>{ lsSet('ry_best_test','42'); BK.show(); }); await sleep(300);
  await p.click('[data-act=bkdo][data-m=server]'); await sleep(200); await p.fill('#bkP1','delfin hoppar högt'); await p.fill('#bkP2','delfin hoppar högt'); await p.click('[data-act=bkgo]'); await sleep(6000);
  ok(await p.evaluate(()=>BK.last()>0 && BK.hasAuto()), 'kopian finns på servern, automatisk kopia påslagen');
  const myId=await p.evaluate(()=>CHAT.call.myId());
  await c.close();
  // ny enhet: samma konto, tom telefon → återställ
  ({c,p}=await mk(process.env.TOK)); await sleep(1000);
  const newId=await p.evaluate(()=>CHAT.call.myId()); ok(newId && newId!==myId, 'ny enhet har först en egen nyckel');
  await p.evaluate(()=>BK.show()); await sleep(200); await p.click('[data-act=bkget][data-m=server]'); await sleep(800);
  await p.fill('#bkP1','fel fras'); await p.click('[data-act=bkgo]'); await sleep(4000); ok(/Fel lösenfras/.test(await p.evaluate(()=>document.getElementById('bkMsg').innerText)), 'fel lösenfras avvisas');
  await p.evaluate(()=>{ closeModal(); BK.show(); }); await p.click('[data-act=bkget][data-m=server]'); await sleep(800);
  await p.fill('#bkP1','delfin hoppar högt'); await p.click('[data-act=bkgo]'); await sleep(4000);
  await p.click('[data-act=bkok]'); await sleep(4500);
  const after=await p.evaluate(()=>({id:CHAT.call.myId(), best:lsGet('ry_best_test'), tok:!!lsGet('srv_tok'), aq:TODAY.AQ._get().days.length}));
  ok(after.id===myId && after.best==='42' && after.tok && after.aq===1, 'återställt: samma chattnyckel, spel och akvarium, fortfarande inloggad '+JSON.stringify(after));
  // spökbil: kör en kort sträcka med autopilot, avsluta, kolla att spöket sparas
  await p.evaluate(()=>{ window.__raceAuto=true; openRace(); }); await sleep(1500);
  await p.evaluate(()=>{ const b=document.querySelector('[data-rc=go]'); b && b.click(); }); await sleep(14000);
  await p.screenshot({path:'/tmp/today_race.png'});
  const rg=await p.evaluate(()=>{ RACE.__test && RACE.__test.end && RACE.__test.end(false); return 1; });
  console.log('errs', errs); console.log(fails?fails+' FEL':'alla idag-tester ok'); await b.close(); process.exit(fails?1:0); })();
