// Spelen med 3D-grafik (Slalom, Skidskytte, Sommarvägen): i varje läge ska varje synlig knapp ligga överst
// (inte täckas av spelbilden eller något annat) och inga knappar får överlappa varandra. Med och utan 3D, dev och release.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fail++; };
const CHECK=root=>{ const R=document.querySelector(root)||document.body; const els=[...R.querySelectorAll('button,[data-dr],[data-sl],[data-bs],[data-bsx],[data-rc],[data-act],[data-rp],input,select')].filter(e=>{ const r=e.getBoundingClientRect(), s=getComputedStyle(e); return r.width>4&&r.height>4&&s.visibility!=='hidden'&&+s.opacity>.05&&e.offsetParent!==null&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth; });
  const lab=e=>(e.textContent||e.getAttribute('aria-label')||e.className).trim().replace(/\s+/g,' ').slice(0,22);
  const hidden=[], over=[];
  for(const e of els){ e.scrollIntoView({block:'nearest',inline:'nearest'}); const r=e.getBoundingClientRect(); const pts=[[.5,.5],[.25,.5],[.75,.5]]; let vis=0; for(const [fx,fy] of pts){ const t=document.elementFromPoint(r.x+r.width*fx,r.y+r.height*fy); if(t&&(t===e||e.contains(t)||t.contains(e))) vis++; } if(!vis){ const t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); hidden.push(lab(e)+' ← '+(t?(t.className||t.tagName):'?')); } }
  for(let i=0;i<els.length;i++) for(let j=i+1;j<els.length;j++){ const a=els[i], b=els[j]; if(a.contains(b)||b.contains(a)) continue; const p=a.getBoundingClientRect(), q=b.getBoundingClientRect(); const ix=Math.min(p.right,q.right)-Math.max(p.left,q.left), iy=Math.min(p.bottom,q.bottom)-Math.max(p.top,q.top); if(ix>3&&iy>3) over.push(lab(a)+' ⟷ '+lab(b)); }
  return {n:els.length, hidden, over, names:els.map(lab)}; };
(async()=>{ const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const onlyV=process.argv[2], onlyG=process.argv[3];   // t.ex. node tests/overlays.js dev 1
  for(const [base,pre] of [['/dev/','dev:'],['/','']]) for(const gl of ['1','0']){ if(onlyV&&(onlyV==='dev')!==(base==='/dev/')) continue; if(onlyG&&onlyG!==gl) continue;
    const c=await b.newContext({viewport:{width:390,height:780},hasTouch:true,isMobile:true,deviceScaleFactor:2});
    await c.addInitScript(`window.__NET_SERVER=''; localStorage.setItem('${pre}onboarded','1'); localStorage.setItem('${pre}sfx','0'); localStorage.setItem('${pre}sl_gl','${gl}'); localStorage.setItem('${pre}bs_gl','${gl}'); Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8})`);
    const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811'+base); await sleep(1200);
    const tag=`${base==='/'?'release':'dev'}${gl==='1'?' 3D':' enkel'}`;
    const chk=async(name,root,shot)=>{ const r=await p.evaluate(CHECK,root); ok(r.n>0&&!r.hidden.length&&!r.over.length, `${tag} · ${name}: ${r.n} knappar${r.hidden.length?' · TÄCKTA: '+r.hidden.join(', '):''}${r.over.length?' · ÖVERLAPP: '+r.over.join(', '):''}`); if(shot) await p.screenshot({path:`/tmp/dp/ov_${shot}_${base==='/'?'r':'d'}${gl}.png`,timeout:60000}).catch(()=>console.log('  (ingen skärmbild – mjukvarugrafiken i testmiljön hann inte)')); };
    const pd=sel=>p.evaluate(sel=>{ const e=document.querySelector(sel); if(e){ e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); e.click&&0; } return !!e; },sel);
    // ---------- Slalom ----------
    await p.evaluate(()=>GINFO.slalom.menu()); await sleep(400); await chk('slalom meny','#modal');
    await p.fill('#nm','Test'); await p.click('[data-sl=solo]'); await sleep(2500); await chk('slalom åk','#app','sl_run');
    await pd('[data-dr=tg]'); await sleep(1500); await chk('slalom drönare','#app','sl_dr'); await pd('[data-dr=tg]'); await sleep(500);
    await p.evaluate(()=>{ G.over=true; G.run=2; G.res=[[51234,52345]]; render(); }); await sleep(1200); await chk('slalom resultat','#app','sl_over');
    if(await p.$('[data-sl=rp]')){ await p.evaluate(()=>document.querySelector('[data-sl=rp]').click()); await sleep(1500); await chk('slalom repris','#app','sl_rp'); }
    // ---------- Skidskytte ----------
    await p.evaluate(()=>{ view='lobby'; G=null; mode=null; render(); KIT.startSolo('skidskytte','Test'); }); await sleep(2500); await chk('skidskytte åk','#app','bs_run');
    await pd('[data-dr=tg]'); await sleep(1500); await chk('skidskytte drönare','#app','bs_dr'); await pd('[data-dr=tg]'); await sleep(500);
    await p.evaluate(()=>{ const c=document.getElementById('bsCtl'); c.classList.add('on'); const d=document.querySelector('.dr-bar[data-dk="bs_dr"]'); if(d) d.style.display='none'; }); await sleep(400); await chk('skidskytte skjutvall','#app','bs_range');
    await p.evaluate(()=>{ G.over=true; G.res=[{ms:300000,sh:[1,0]}]; render(); }); await sleep(1200); await chk('skidskytte resultat','#app','bs_over');
    { const rb=await p.evaluate(()=>{ const b=[...document.querySelectorAll('#app button')].find(x=>/repris|🎬/i.test(x.textContent)); if(b){ b.click(); return b.textContent.trim(); } return ''; }); if(rb){ await sleep(1500); await chk('skidskytte repris','#app','bs_rp'); } }
    // ---------- Sommarvägen ----------
    await p.evaluate(()=>{ view='lobby'; G=null; mode=null; render(); RACE.open(); }); await sleep(1500); await chk('Sommarvägen meny','#raceRoot','rc_menu');
    await p.evaluate(()=>document.querySelector('[data-rc=go]').click()); await sleep(3000); await chk('Sommarvägen kör','#raceRoot','rc_play');
    await p.evaluate(()=>document.querySelector('.rc-top [data-rc=pause]').click()); await sleep(600); await chk('Sommarvägen paus','#raceRoot');
    ok(!errs.length, `${tag} · inga fel ${errs.slice(0,2).join(' | ')}`); await c.close(); }
  await b.close(); process.exit(fail?1:0); })();
