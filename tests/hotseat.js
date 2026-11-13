// Spela mot en kompis på samma enhet: menyknapp, namn, turordning, ridå i spel med dolda kort, rätt vinnare
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fail++; };
(async()=>{ const b=await chromium.launch(); const c=await b.newContext({viewport:{width:390,height:800}});
  await c.addInitScript("window.__NET_SERVER=''; localStorage.setItem('dev:onboarded','1'); localStorage.setItem('dev:sfx','0')");
  const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1200);
  const kinds=['ships','mm','hang','kina','ordfajt','c4','gomoku','othello','fia','memory','vandtia','fisk','hjarter'];
  for(const k of kinds){ await p.evaluate(k=>{ closeModal&&closeModal(); showGameMenu(k); },k); await sleep(250);
    const has=await p.evaluate(()=>!!document.querySelector('#modal [data-g2=hot],#modal [data-km=hot],#modal [data-kmenu=hot],#modal [data-of=hot]'));
    ok(has, `${k}: knappen "Mot en kompis på samma enhet" finns`);
    await p.evaluate(()=>document.querySelector('#modal [data-g2=hot],#modal [data-km=hot],#modal [data-kmenu=hot],#modal [data-of=hot]')?.click()); await sleep(250);
    await p.fill('#modal [data-hotn="0"]','Tindra'); await p.fill('#modal [data-hotn="1"]','Pappa'); await p.click('#modal [data-hot=start]'); await sleep(k==='ordfajt'?2500:700);
    const st=await p.evaluate(()=>({kind:G&&G.kind, hot:G&&G.hot, ai:G&&G.ai, names:G&&G.names, curtain:!!document.querySelector('.hotc'), want:hotWant}));
    ok(st.kind===k && st.hot && !st.ai[0] && !st.ai[1] && st.names.slice(0,2).join()==='Tindra,Pappa', `${k}: startar med två människor (${st.names})`);
    const secret=await p.evaluate(()=>!!KIND[G.kind].redact);
    if(secret && k!=='memory') ok(st.curtain, `${k}: ridå visas innan första spelaren ser sina hemligheter`); if(k==='memory') ok(!st.curtain, 'memory: ingen ridå – alla ser samma bräde');
    // spela tills slutet: datorns drag-funktion får spela för den som står på tur
    const r=await p.evaluate(async()=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms)); let curt=0, seats=new Set(), n=0;
      for(n=0;n<6000&&!G.over;n++){ if(document.querySelector('.hotc')){ curt++; document.querySelector('[data-hot=go]').click(); await sleep(0); continue; }
        const K=KIND[G.kind], s=hotView; if(isAI(G.cur)&&K.aiSeat&&K.aiSeat(G)!=null){ await sleep(30); continue; } seats.add(s); let a=null; if(G.phase==='reveal') a={type:'next'}; else if(G.kind==='ships'&&G.phase==='place') a={type:'ready',ships:randomFleet()}; else try{ a=K.ai(G,s,'easy'); }catch(e){} if(!a){ if(K.aiSeat){ const z=K.aiSeat(G); } break; }
        if(!applyAndPublish(a,s)) break; if(n%40===0) await sleep(0); }
      return {over:G.over, winner:G.winner, curt, seats:[...seats], n, txt:(document.querySelector('.gover h3')||{}).textContent||''}; });
    ok(r.seats.length>=2, `${k}: båda spelarna får spela (${r.seats})${secret?`, ridå ${r.curt} gånger`:''}`);
    if(r.over) ok(!/Du vann/.test(r.txt) && (r.winner===-1 || /Tindra|Pappa/.test(r.txt) || r.txt===''), `${k}: slutet visar vinnarens namn ("${r.txt}")`);
    else console.log(`  (${k}: spelet blev inte klart på ${r.n} drag i testet)`);
  }
  // knappen i Yatzy och Pong finns redan
  ok(!errs.length, 'inga fel: '+errs.slice(0,3).join(' | ')); await b.close(); process.exit(fail?1:0); })();
