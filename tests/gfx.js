const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const VPS={liten:{width:360,height:640},mobil:{width:390,height:844},platta:{width:820,height:1180},dator:{width:1440,height:900},liggande:{width:844,height:390}};
const only=process.argv[2]?process.argv[2].split(','):null;
// uppställning per spel: [kind, antal, förbered(G), viktiga element]
const SETUP=[
 ['c4',2,null,['.c4b']], ['gomoku',2,'g=>{ for(let k=0;k<30;k++) G.board[60+k*3%150]=k%2; }',['.gmb']], ['othello',2,null,['.ob']],
 ['fia',4,'g=>{ G.pos[0]=[3,12,41,44]; G.pos[1]=[0,20,-1,44]; G.pos[2]=[33,-1,-1,-1]; }',['.fb','.fdie']],
 ['memory',4,null,['.mg']], ['memory36',2,null,['.mg']],
 ['vandtia',4,'g=>{ G.hands[0]=G.deck.splice(0,16); G.pile=G.deck.splice(0,5); }',['.hand','.vt-mine','.cbtns']],
 ['fisk',4,'g=>{ G.hands[0]=G.hands[0].concat(G.deck.splice(0,8)); G.books[1]=[5,9]; }',['.hand','.cbtns']],
 ['hjarter',4,'g=>{ for(let s=0;s<4;s++) KIND.hjarter.apply(G,{type:"pass",cards:G.hands[s].slice(0,3)},s); }',['.ht-table','.hand']],
 ['wordle',1,'g=>{ for(const w of ["lampa","bröst","skola"]) KIND.wordle.apply(G,{type:"guess",w},0); G.over=false; }',['.wd-b','.wd-kb']],
 ['sudoku',1,null,['.sd-b','.sd-pad']],
 ['ordfajt',2,null,['#ofBoard','#ofRack']], ['pong',2,null,['.pg-cv']], ['kina',6,null,[]],
 ['ships',2,null,[]], ['mm',2,null,[]], ['hang',2,null,[]]
];
(async()=>{ const b=await chromium.launch(); const report=[];
  for(const [vn,vp] of Object.entries(VPS)){
    const c=await b.newContext({viewport:vp,deviceScaleFactor:1,hasTouch:vn!=='dator'}); await c.addInitScript("window.__NET_SERVER=''"); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://127.0.0.1:8811/dev/'); await sleep(900);
    // lobbyn
    await p.screenshot({path:`shots/${vn}-lobby.png`});
    report.push(...(await p.evaluate(()=>{ const o=[]; if(document.documentElement.scrollWidth>innerWidth+1) o.push('lobby: sidled-scroll '+document.documentElement.scrollWidth); return o; })).map(x=>vn+' '+x));
    for(const [k0,np,prep,els] of SETUP){ const k=k0==='memory36'?'memory':k0; if(only&&!only.includes(k0)) continue;
      await p.evaluate(async([k,k0,np])=>{ if(k==='ordfajt') await __ofTest.loadDict('sv'); if(k==='wordle'||k==='sudoku'){ KIT.startSolo(k,'Tindra'); return; }
        if(k0==='memory36') lsSet('kit_memory_size','36');
        startGameLocal(k,'Tindra','medium',np-1); clearTimeout(aiTimer); if(k0==='memory36'){ /* storlek från menyn: gör om */ G.size=36; KIND.memory.start(G); lsSet('kit_memory_size','16'); }
        G.names=G.names.map((n,i)=>i===0?n:['Blixt 🤖','Stjärna 🤖','Komet 🤖','Nova 🤖','Luna 🤖'][i-1]||n); render(); },[k,k0,np]);
      if(prep) await p.evaluate(`(${prep})(G); render();`);
      await sleep(k==='pong'?2800:400); await p.evaluate(()=>clearTimeout(aiTimer));
      await p.screenshot({path:`shots/${vn}-${k0}.png`});
      const issues=await p.evaluate(sel=>{ const o=[]; const W=innerWidth, H=innerHeight;
        if(document.documentElement.scrollWidth>W+1) o.push('sidled-scroll '+document.documentElement.scrollWidth+'>'+W);
        for(const s of sel){ const el=document.querySelector(s); if(!el){ o.push(s+' saknas'); continue; } const r=el.getBoundingClientRect();
          if(r.width<2||r.height<2) o.push(s+' osynlig'); if(r.left<-1||r.right>W+1) o.push(`${s} utanför i sidled (${Math.round(r.left)}–${Math.round(r.right)})`);
          if(r.bottom>H+1) o.push(`${s} under skärmkanten (${Math.round(r.bottom)}>${H})`);
          if(el.scrollWidth>el.clientWidth+2) o.push(`${s} innehåll bredare än rutan (${el.scrollWidth}>${el.clientWidth})`); }
        // små tryckytor i spelet
        const small=[...document.querySelectorAll('#app button, #app [data-c4],#app [data-gm],#app [data-oth],#app [data-mem],#app .sd-c,#app .of-c')].filter(e=>{ const r=e.getBoundingClientRect(); return r.width>0 && (r.width<20||r.height<20); });
        if(small.length) o.push(`${small.length} tryckytor < 20 px (t.ex. ${small[0].className||small[0].tagName} ${Math.round(small[0].getBoundingClientRect().width)}px)`);
        // överlappande knappar
        const bs=[...document.querySelectorAll('#app button')].map(e=>[e,e.getBoundingClientRect()]).filter(([e,r])=>r.width>0);
        let ov=0; for(let i=0;i<bs.length;i++) for(let j=i+1;j<bs.length;j++){ const a=bs[i][1], b2=bs[j][1]; if(bs[i][0].contains(bs[j][0])||bs[j][0].contains(bs[i][0])) continue; const x=Math.min(a.right,b2.right)-Math.max(a.left,b2.left), y=Math.min(a.bottom,b2.bottom)-Math.max(a.top,b2.top); if(x>4&&y>4) ov++; }
        if(ov) o.push(ov+' knappar överlappar');
        return o; },els);
      issues.forEach(x=>report.push(`${vn} ${k0}: ${x}`));
      await p.evaluate(()=>{ clearTimeout(aiTimer); goLobby(); });
    }
    if(errs.length) report.push(vn+' JS-fel: '+errs.slice(0,3).join(' | '));
    await c.close();
  }
  console.log(report.length?report.join('\n'):'inga fynd'); await b.close(); })();
