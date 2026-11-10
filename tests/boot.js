// Start utan blink: det gamla utseendet ska aldrig synas – färgerna sätts direkt och lobbyn ritas först när allt finns.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await chromium.launch(); let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; }; const errs=[];
  const c=await b.newContext({viewport:{width:390,height:844}});
  await c.addInitScript(`window.__NET_SERVER=''; try{ localStorage.setItem('dev:onboarded','1'); }catch(e){}
    window.__seen={getwell:0, plainTile:0, firstBg:null, tilesAt:0};
    new MutationObserver(()=>{ if(!window.__seen.firstBg && document.body) window.__seen.firstBg=getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim();
      if(document.querySelector('.getwell')) window.__seen.getwell++;
      if(document.querySelector('.tile:not([data-g])')) window.__seen.plainTile++;
      if(!window.__seen.tilesAt && document.querySelector('.tile')) window.__seen.tilesAt=performance.now(); }).observe(document,{childList:true,subtree:true});`);
  const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1500);
  await p.evaluate(()=>{ STYLE.set('world','sol'); }); await sleep(200);
  await p.reload(); await sleep(2000);
  const s=await p.evaluate(()=>window.__seen);
  ok(s.firstBg==='#4a1e4f', 'spelarens färger finns innan något ritas ('+s.firstBg+')');
  ok(s.getwell===0, 'den gamla hälsningen syns aldrig');
  ok(s.plainTile===0, 'spelrutor utan ritade ikoner syns aldrig');
  ok(await p.evaluate(()=>!!document.querySelector('.today-hero') && document.querySelectorAll('#sky .sundisc').length===1 && !document.querySelector('#sky .planet')), 'rätt värld i himlen direkt (solnedgång, ingen planet)');
  console.log('errs',errs); console.log(fails?fails+' FEL':'alla starttester ok'); await b.close(); process.exit(fails?1:0); })();
