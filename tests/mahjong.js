// Vittangi (mahjong-patiens): alla bord går att lösa, låsta brickor, par/ångra/blanda/ledtråd, vinst, meny, kompisduell
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fail++; };
(async()=>{ const b=await chromium.launch(); const c=await b.newContext({viewport:{width:390,height:800},hasTouch:true});
  await c.addInitScript("window.__NET_SERVER=''; localStorage.setItem('dev:onboarded','1'); localStorage.setItem('dev:sfx','0')");
  const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1200);
  ok(await p.evaluate(()=>!!document.querySelector('.tile[data-k=mahjong]')), 'Vittangi finns i lobbyn');
  // varje bord: jämnt antal, inga dubbletter, och givarna går att lösa med en enkel girig lösare
  const lay=await p.evaluate(()=>{ const out=[]; MJ.LAYS.forEach((L,li)=>{ const pos=L.p(), keys=new Set(pos.map(q=>q.join())); let solved=0;
      for(let t=0;t<20;t++){ let s=t*977+li+1; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; }; const kind=MJ.deal(pos, MJ.makePairs(pos.length/2, 12+t, r), r); if(!kind) continue;
        // utläggningens ordning är en lösning: spela upp den och kontrollera att varje par är fritt och lika
        const g={pos,tk:kind,alive:pos.map(()=>true)}; const key=k=>k<34?k:k<38?'F':'S'; let good=true;
        for(const [i,j] of MJ.deal.order){ if(MJ.blocked(pos,g.alive,i)||MJ.blocked(pos,g.alive,j)||key(kind[i])!==key(kind[j])) { good=false; break; } g.alive[i]=g.alive[j]=false; }
        if(good && g.alive.every(x=>!x)) solved++; }
      out.push({name:L.name, n:pos.length, even:pos.length%2===0, uniq:keys.size===pos.length, solved}); }); return out; });
  for(const L of lay) ok(L.even && L.uniq && L.solved>=18, `${L.name}: ${L.n} brickor, jämnt, inga dubbletter, ${L.solved}/20 givar lösta`);
  // utdelningen för listen: alla bord, svåraste inställningen – lösningen fungerar och listen svämmar aldrig över
  const tl=await p.evaluate(()=>{ const key=k=>k<34?k:k<38?'F':'S'; return MJ.LAYS.map((L,li)=>{ let ok=0; for(let t=0;t<10;t++){ let s=t*7919+li+1; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; }; const pos=L.p(), tk=MJ.dealTray(pos,MJ.makePairs(pos.length/2,36,r),r,3,.15), alive=pos.map(()=>true); let tray=[], good=true;
      for(const [i] of MJ.deal.order){ if(MJ.blocked(pos,alive,i)){ good=false; break; } alive[i]=false; const m=tray.findIndex(k=>key(k)===key(tk[i])); if(m>=0) tray.splice(m,1); else { if(tray.length>=4){ good=false; break; } tray.push(tk[i]); } }
      if(good&&!tray.length&&alive.every(a=>!a)) ok++; } return ok; }); });
  ok(tl.every(x=>x===10), `listen-utdelning: alla ${tl.length} bord lösbara utan att listen svämmar över (${tl.join(',')})`);
  // regler för låsta brickor
  const bl=await p.evaluate(()=>{ const pos=[[0,0,0],[2,0,0],[4,0,0],[2,0,1]], al=[true,true,true,true];
    return [MJ.blocked(pos,al,0), MJ.blocked(pos,al,1), MJ.blocked(pos,al,3), (al[3]=false, MJ.blocked(pos,al,1)), (al[0]=false, MJ.blocked(pos,al,1))]; });
  ok(bl.join()==='false,true,false,true,false', `låsningsregler: ytterkant fri, under lager låst, mitten låst tills ena sidan är fri (${bl})`);
  // meny och start
  await p.evaluate(()=>showGameMenu('mahjong')); await sleep(300);
  ok(await p.evaluate(()=>/Vittangi/.test(document.querySelector('#modal h3').textContent)&&!!document.querySelector('#modal [data-mj=daily]')&&!!document.querySelector('#modal [data-duel]')), 'menyn: Vittangi, dagens bricka, mot en kompis');
  await p.click('#modal [data-mj=play]'); await sleep(600);
  let s=await p.evaluate(()=>({kind:G.kind, n:document.querySelectorAll('.mj-t').length, left:G.left, tw:parseFloat(getComputedStyle(document.getElementById('mjB')).getPropertyValue('--tw')), bw:document.getElementById('mjB').getBoundingClientRect().width}));
  ok(s.kind==='mahjong' && s.n===s.left && s.n>0, `spelet startar med ${s.n} brickor`);
  ok(s.tw>=50 && s.bw<=390, `brickorna är stora och får plats (bredd ${Math.round(s.tw)} px, bord ${Math.round(s.bw)} px)`);
  await p.screenshot({path:'tests/shots/mahjong-1.png'});
  // klicka på en låst bricka → skakar, inget händer
  const lockedI=await p.evaluate(()=>{ const f=new Set(MJ.pairs(G).flat()); for(let i=0;i<G.pos.length;i++) if(G.alive[i]&&MJ.blocked(G.pos,G.alive,i)) return i; return -1; });
  if(lockedI>=0){ await p.evaluate(i=>document.querySelector(`.mj-t[data-i="${i}"]`).click(),lockedI); await sleep(100); ok(await p.evaluate(()=>G.left===G.pos.length), 'låst bricka går inte att ta'); }
  // ledtråd
  await p.click('[data-mj=hint]'); await sleep(200); ok(await p.evaluate(()=>document.querySelectorAll('#mjB .mj-t.hint').length>=1 && G.hints===1), 'ledtråd lyser upp en bricka eller ett par');
  // ta ett par via klick
  const pr=await p.evaluate(()=>MJ.pairs(G)[0]); await p.evaluate(i=>document.querySelector(`.mj-t[data-i="${i}"]`).click(),pr[0]); await sleep(80); await p.evaluate(i=>document.querySelector(`.mj-t[data-i="${i}"]`).click(),pr[1]); await sleep(500);
  ok(await p.evaluate(()=>G.left===G.pos.length-2), 'två lika fria brickor försvinner');
  await p.click('[data-mj=undo]'); await sleep(200); ok(await p.evaluate(()=>G.left===G.pos.length), 'ångra lägger tillbaka paret');
  await p.click('[data-mj=shuffle]'); await sleep(600); ok(await p.evaluate(()=>G.shuf===1 && G.left===G.pos.length), 'blanda fungerar');
  // spela klart med sökning och se slutet
  const won=await p.evaluate(async()=>{ const key=k=>k<34?k:k<38?'F':'S'; const path=MJ.deal.order.slice(); const alive=G.alive.slice(); let tray=G.tray.map(j=>G.tk[j]);
    // kontrollera lösningen med listens regler: varje tryck på en fri bricka, listen svämmar aldrig över
    for(const it of path){ for(const i of it){ if(MJ.blocked(G.pos,alive,i)) return {solvable:false,why:'låst'}; alive[i]=false; const m=tray.findIndex(k=>key(k)===key(G.tk[i])); if(m>=0) tray.splice(m,1); else { if(tray.length>=4) return {solvable:false,why:'full'}; tray.push(G.tk[i]); } } }
    for(const it of path){ if(it.length===1) doAct({type:'tap',i:it[0]}); else doAct({type:'pair',i:it[0],j:it[1]}); } await new Promise(r=>setTimeout(r,500));
    return {solvable:true, over:G.over, winner:G.winner, txt:(document.querySelector('.mj-end h3')||{}).textContent, lvl:lsGet('mj_lvl')}; });
  ok(won.solvable, 'bordet går att lösa även efter blandning');
  const rw=await p.evaluate(()=>({stars:G.stars, saved:JSON.parse(lsGet('mj_stars')||'{}')[1], tot:MJ.totalStars(), shown:document.querySelectorAll('.mj-stars span.on').length}));
  ok(rw.stars>=1 && rw.saved===rw.stars && rw.shown===rw.stars && rw.tot===rw.stars, `stjärnor: ${rw.stars} ★ sparade och visade (totalt ${rw.tot})`);
  ok(won.over && won.winner===0 && /Bra jobbat|Snyggt|Perfekt/.test(won.txt) && won.lvl==='2', `bordet tömt → "${won.txt}", nästa nivå ${won.lvl}`);
  await p.screenshot({path:'tests/shots/mahjong-2.png'});
  // listen: en bricka hamnar på listen, två lika försvinner, full lista + bricka som inte passar = förlust, ångra räddar
  const tr=await p.evaluate(async()=>{ const sl=ms=>new Promise(r=>setTimeout(r,ms)); closeModal&&closeModal(); showGameMenu('mahjong'); document.querySelector('#modal .mj-lvb[data-lv="1"]').click(); await sl(900);
    const key=k=>k<34?k:k<38?'F':'S', free=()=>G.pos.map((_,i)=>i).filter(i=>G.alive[i]&&!MJ.blocked(G.pos,G.alive,i));
    const f=free(), a=f[0]; document.querySelector(`.mj-t[data-i="${a}"]`).click(); await sl(450); const one=G.tray.length===1&&!G.alive[a]&&!!document.querySelector('#mjTray [data-ti]');
    const b=free().find(i=>key(G.tk[i])===key(G.tk[a])); let paired=null; if(b!==undefined){ document.querySelector(`.mj-t[data-i="${b}"]`).click(); await sl(600); paired=G.tray.length===0&&G.left===G.pos.length-2; }
    // fyll listen med fyra olika
    let guard=0; while(G.tray.length<4&&guard++<40){ const tk=new Set(G.tray.map(j=>key(G.tk[j]))); const c=free().find(i=>!tk.has(key(G.tk[i]))); if(c===undefined) break; doAct({type:'tap',i:c}); }
    const full=G.tray.length===4; await sl(200); const warn=document.getElementById('mjTray').classList.contains('full');
    const tk=new Set(G.tray.map(j=>key(G.tk[j]))), bad=free().find(i=>!tk.has(key(G.tk[i])));
    if(bad===undefined) return {one,paired,full,warn,dbg:'ingen fri bricka utan match: '+free().length+' fria, lista '+G.tray.length};
    document.querySelector(`.mj-t[data-i="${bad}"]`).click(); await sl(500);
    const h=document.querySelector('.mj-end h3'), lost=G.over&&G.lost!==undefined&&!!h&&/full/.test(h.textContent);
    const u=document.querySelector('.mj-end [data-mj=undo]'); if(u) u.click(); await sl(300); const saved=!G.over&&G.saves===1&&G.tray.length===4;
    return {one,paired,full,warn,lost,saved,dbg:JSON.stringify({over:G.over,lost:G.lost,h:h&&h.textContent})}; });
  if(!tr.lost||!tr.saved) console.log(tr.dbg);
  ok(tr.one, 'tryck på en fri bricka: den flyttas till listen');
  ok(tr.paired!==false, 'två lika på listen försvinner'+(tr.paired===null?' (ingen fri partner i just den här given)':''));
  ok(tr.full&&tr.warn, 'listen tar fyra brickor och lyser rött när den är full');
  ok(tr.lost, 'femte brickan som inte passar ger förlust');
  ok(tr.saved, 'ångra efter förlust räddar spelet (räknas som hjälp)');
  // utseende: låst tema går inte att välja, öppet går
  const lk=await p.evaluate(async()=>{ const sl=ms=>new Promise(x=>setTimeout(x,ms)); document.querySelector('[data-mj=look]')?.click()||document.querySelector('[data-act=lobby]'); showGameMenu('mahjong'); document.querySelector('#modal [data-mj=look]').click(); await sl(200);
    const n=document.querySelectorAll('#modal .mj-lo').length; document.querySelector('#modal [data-mj=pickl][data-id=sport]').click(); await sl(100); const sportLocked=lsGet('mj_set')!=='sport';
    document.querySelector('#modal [data-mj=pickl][data-id=klassisk]').click(); await sl(100); const ok=lsGet('mj_set')==='klassisk'; lsSet('mj_set','djur'); return {n,sportLocked,ok,want:MJ.SETS.length+MJ.SKINS.length+MJ.TABLES.length}; });
  ok(lk.n===lk.want && lk.sportLocked && lk.ok, `utseende: ${lk.n} val, låsta går inte att välja, öppna går`);
  // nivåkarta: tidigare nivå går att spela om
  const mp=await p.evaluate(async()=>{ closeModal&&closeModal(); showGameMenu('mahjong'); const b=document.querySelector('#modal .mj-lvb[data-lv="1"]'); const lockedN=document.querySelectorAll('#modal .mj-lvb.lk').length; b.click(); await new Promise(x=>setTimeout(x,300)); return {lvl:G.level, lockedN}; });
  ok(mp.lvl===1 && mp.lockedN>0, `nivåkartan: nivå 1 kan spelas om, kommande nivåer är låsta (${mp.lockedN})`);
  // dagens bricka: samma bord två gånger
  const d=await p.evaluate(async()=>{ const r=[]; for(let k=0;k<2;k++){ closeModal&&closeModal(); showGameMenu('mahjong'); document.querySelector('#modal [data-mj=daily]').click(); await new Promise(x=>setTimeout(x,300)); r.push(G.tk.join()); } return {same:r[0]===r[1], daily:G.daily}; });
  ok(d.same && d.daily, 'dagens bricka är samma för alla');
  await p.screenshot({path:'tests/shots/mahjong-3.png'});
  // kompisduell: samma brickor för båda
  const du=await p.evaluate(async()=>{ const sl=ms=>new Promise(x=>setTimeout(x,ms)); closeModal&&closeModal(); showGameMenu('mahjong'); document.querySelector('#modal [data-duel]').click(); await sl(250);
    const ins=document.querySelectorAll('#modal input'); if(ins[0]) ins[0].value='Sara'; if(ins[1]) ins[1].value='Pappa'; ins.forEach(i=>i.dispatchEvent(new Event('input',{bubbles:true}))); document.querySelector('#modal [data-duel=start]')?.click(); await sl(400);
    document.querySelector('#modal [data-duel=go]')?.click(); await sl(400); const a=G.tk.join(), duel=G.duel; return {a, duel, names:G.names, modal:(document.querySelector('#modal')||{}).textContent||''}; });
  ok(du.duel===1, `kompisduellen startar (${du.names})`);
  ok(!errs.length, 'inga fel: '+errs.slice(0,3).join(' | ')); await b.close(); process.exit(fail?1:0); })();
