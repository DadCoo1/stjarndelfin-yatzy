const {chromium}=require('playwright');
const OPTS= process.env.OWN ? "window.__NET_SERVER='127.0.0.1:9000'; try{ localStorage.setItem('dev:onboarded','1'); }catch(e){} window.__FORCE_RELAY=true;" : "window.__NET_SERVER=''; try{ localStorage.setItem('dev:onboarded','1'); }catch(e){} window.__PEER_OPTS={host:'127.0.0.1',port:9001,path:'/',secure:false,config:{iceServers:[]}};";
const URL='http://127.0.0.1:8811/dev/'; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const [kind,NP,MAXSTEPS]=[process.argv[2],+process.argv[3],+(process.argv[4]||400)];
(async()=>{ const b=await chromium.launch(); const errs=[]; const pages=[], ctxs=[];
  async function mk(i){ const c=await b.newContext({viewport:{width:390,height:844}}); await c.addInitScript(OPTS); const p=await c.newPage(); p.on('pageerror',e=>errs.push('P'+i+' '+e.message)); await p.goto(URL); await sleep(600); ctxs[i]=c; return p; }
  for(let i=0;i<NP;i++) pages.push(await mk(i));
  await pages[0].evaluate(k=>hostGame('Värd','free',k),kind); await sleep(1500); const code=await pages[0].evaluate(()=>gameId);
  for(let i=1;i<NP;i++){ await pages[i].evaluate(([c,i])=>joinGame(c,'Gäst'+i),[code,i]); await sleep(1800); }
  await sleep(800); await pages[0].click('[data-act=startgame]'); await sleep(1500);
  const names=await pages[0].evaluate(()=>G.names.join(',')); let steps=0, killed=false, hiddenOk=true, notes=[];
  const act=p=>p.evaluate(k=>{ if(!G||G.over) return 'over'; const ws=KIND[k].waitingFor?KIND[k].waitingFor(G):G.cur; if(ws!==mySeat) return null;
      const g=JSON.parse(JSON.stringify(G)); g.ai=g.names.map(()=>'medium'); let a; try{ a=KIND[k].ai(g,mySeat); }catch(e){ return 'aifel '+e.message; } if(a) doAct(a); return a?a.type:'inget'; },kind);
  while(steps<MAXSTEPS){
    let any=false, over=false;
    for(let i=0;i<pages.length;i++){ const r=await act(pages[i]); if(r==='over') over=true; else if(r&&r.startsWith&&r.startsWith('aifel')) notes.push(r); else if(r) any=true; }
    if(over) break; steps++; await sleep(any?250:450);
    if(steps===Math.floor(MAXSTEPS/6) && NP>2 && !killed){ killed=true; await pages[2].close(); await sleep(1500); pages[2]=await ctxs[2].newPage(); pages[2].on('pageerror',e=>errs.push('P2b '+e.message)); await pages[2].goto(URL); await sleep(4000);
      notes.push('gäst 2 tillbaka: '+JSON.stringify(await pages[2].evaluate(()=>[view,G&&G.kind,mySeat,net]))); }
    if(steps%15===0){ // dolda kort?
      for(let i=1;i<pages.length;i++){ const h=await pages[i].evaluate(()=>{ if(!G||G.over) return true; const me=mySeat; const H=G.hands||null; if(!H) return G.kind!=='memory' || G.cards.every((c,j)=>c===-1||G.open.includes(j)||G.owner[j]>=0); return H.every((h,s)=>s===me||h.every(c=>c===-1)); }); if(!h){ hiddenOk=false; notes.push('dolda kort syns hos gäst '+i); } } }
  }
  await sleep(1500);
  const views=[]; for(const p of pages) views.push(await p.evaluate(()=>G?JSON.stringify([G.over,G.winner,G.scores||G.books&&G.books.map(b=>b.length)||null,G.seq]):'null'));
  const pub=views.map(v=>{ const a=JSON.parse(v); return a?JSON.stringify(a.slice(0,3)):'null'; });
  console.log(`${kind} ${NP} spelare (${names}): ${steps} rundor, slut=${JSON.parse(views[0])[0]}, alla ser samma=${new Set(pub).size===1}, dolda kort ok=${hiddenOk}`);
  if(new Set(pub).size!==1) console.log('   vyer:',views.join(' | '));
  notes.forEach(n=>console.log('   '+n));
  // returmatch
  if(JSON.parse(views[0])[0]){ await pages[1].evaluate(()=>{ const b=document.querySelector('[data-g="rematch"]'); b&&b.click(); }); await sleep(1500);
    console.log('   returmatch:', await pages[0].evaluate(()=>[G.over,G.names.length]), await pages[NP-1].evaluate(()=>[G.over,G.names.length])); }
  console.log('   errs',errs.slice(0,4)); await b.close(); })();
