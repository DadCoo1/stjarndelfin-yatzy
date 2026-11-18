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
  await p.click('[data-mj=hint]'); await sleep(200); ok(await p.evaluate(()=>document.querySelectorAll('.mj-t.hint').length===2 && G.hints===1), 'ledtråd lyser upp två brickor');
  // ta ett par via klick
  const pr=await p.evaluate(()=>MJ.pairs(G)[0]); await p.evaluate(i=>document.querySelector(`.mj-t[data-i="${i}"]`).click(),pr[0]); await sleep(80); await p.evaluate(i=>document.querySelector(`.mj-t[data-i="${i}"]`).click(),pr[1]); await sleep(500);
  ok(await p.evaluate(()=>G.left===G.pos.length-2), 'två lika fria brickor försvinner');
  await p.click('[data-mj=undo]'); await sleep(200); ok(await p.evaluate(()=>G.left===G.pos.length), 'ångra lägger tillbaka paret');
  await p.click('[data-mj=shuffle]'); await sleep(600); ok(await p.evaluate(()=>G.shuf===1 && G.left===G.pos.length), 'blanda fungerar');
  // spela klart med sökning och se slutet
  const won=await p.evaluate(async()=>{ const g={alive:G.alive.slice()}; const path=MJ.deal.order.slice(); const key=k=>k<34?k:k<38?'F':'S';
    for(const [i,j] of path){ if(MJ.blocked(G.pos,g.alive,i)||MJ.blocked(G.pos,g.alive,j)||key(G.tk[i])!==key(G.tk[j])) return {solvable:false}; g.alive[i]=g.alive[j]=false; }
    for(const [i,j] of path) doAct({type:'pair',i,j}); await new Promise(r=>setTimeout(r,500));
    return {solvable:true, over:G.over, winner:G.winner, txt:(document.querySelector('.wd-end h3')||{}).textContent, lvl:lsGet('mj_lvl')}; });
  ok(won.solvable, 'bordet går att lösa även efter blandning');
  ok(won.over && won.winner===0 && /tomt/.test(won.txt) && won.lvl==='2', `bordet tömt → "${won.txt}", nästa nivå ${won.lvl}`);
  await p.screenshot({path:'tests/shots/mahjong-2.png'});
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
