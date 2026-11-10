// Akvariet: delfinen simmar i mjuka bågar, fastnar inte på botten, hämtar mat (även på botten) och stiger igen.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const devicePixelRatioOr1=t=>t[3];
(async()=>{ const b=await chromium.launch(); let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; }; const errs=[];
  const c=await b.newContext({viewport:{width:390,height:844}}); await c.addInitScript("window.__NET_SERVER=''; localStorage.setItem('dev:onboarded','1')");
  const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1500);
  await p.click('[data-act=aqopen]'); await sleep(500);
  const sample=async(ms)=>{ const pts=[]; const t0=Date.now(); while(Date.now()-t0<ms){ pts.push(await p.evaluate(()=>{ const c=document.getElementById('aqC').getBoundingClientRect(); return null; })); await sleep(100); } return pts; };
  // läs delfinens läge via en liten krok: positionen ritas – vi hämtar den från canvasens state genom TODAY.AQ._d
  const pos=()=>p.evaluate(()=>TODAY.AQ._d ? {...TODAY.AQ._d()} : null);
  const track=[]; for(let i=0;i<120;i++){ track.push(await pos()); await sleep(100); }
  const H=844, sand=H*.76, ys=track.map(d=>d.y), xs=track.map(d=>d.x);
  const nearBottom=ys.filter(y=>y>sand-0.36*track[0].sz-5).length/ys.length;
  ok(nearBottom<0.15, 'simmar fritt, inte vid botten ('+Math.round(nearBottom*100)+' % av tiden nära botten)');
  ok(Math.max(...xs)-Math.min(...xs)>120, 'simmar runt i akvariet (rör sig '+Math.round(Math.max(...xs)-Math.min(...xs))+' px i sidled)');
  const dA=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
  const jp=track.slice(1).map((d,i)=>dA(d.psi,track[i].psi)), jt=track.slice(1).map((d,i)=>dA(d.th,track[i].th));
  ok(Math.max(...jp)<0.45, 'vänder mjukt i djupled (största vridning per 0,1 s: '+Math.max(...jp).toFixed(2)+' rad)');
  ok(Math.max(...jt)<0.12, 'lutar i mjuka bågar (största lutningsändring per 0,1 s: '+Math.max(...jt).toFixed(2)+' rad)');
  const flips=track.slice(1).filter((d,i)=>Math.sign(Math.cos(d.psi))!==Math.sign(Math.cos(track[i].psi))).length; ok(flips<=6, 'vänder inte fram och tillbaka hela tiden ('+flips+' vändningar på 12 s)');
  // mat på botten: släpp mat längst ner i hörnet
  const before=await p.evaluate(()=>TODAY.AQ._get().food||0);
  await p.mouse.click(60, 600); await sleep(9000);
  const after=await p.evaluate(()=>TODAY.AQ._get().food||0), d1=await pos();
  ok(after>before, 'hämtar maten som sjunkit till botten');
  const t2=[]; for(let i=0;i<40;i++){ t2.push((await pos()).y); await sleep(100); }
  ok(Math.min(...t2)<sand-0.36*d1.sz-40, 'stiger upp igen efter maten');
  const tf=await p.evaluate(()=>{ const t=document.getElementById('aqC').getContext('2d').getTransform(); return [t.a,t.b,t.c,t.d,t.e,t.f]; });
  ok(tf[0]===devicePixelRatioOr1(tf) && tf[1]===0 && tf[2]===0 && tf[4]===0 && tf[5]===0, 'ritningen läcker inte (canvas-transform '+tf.map(x=>+x.toFixed(2))+')');
  await p.screenshot({path:'/tmp/aq_swim.png'});
  await p.evaluate(()=>TODAY.AQ._trick()); await sleep(500); ok(!!(await pos()).trick, 'volt när man trycker'); await sleep(2000); ok(!(await pos()).trick, 'volten tar slut');
  console.log('errs',errs); console.log(fails?fails+' FEL':'alla akvarietester ok'); await b.close(); process.exit(fails?1:0); })();
