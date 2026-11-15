const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await chromium.launch(); 
 for(const [base,pre,mob] of [['/','',true],['/','',false],['/dev/','dev:',true]]){
 const c=await b.newContext({viewport:{width:390,height:800},hasTouch:mob,isMobile:mob}); await c.addInitScript(`window.__NET_SERVER=''; localStorage.setItem('${pre}onboarded','1'); localStorage.setItem('${pre}sfx','0')`);
 const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811'+base); await sleep(1500);
 // starta patiens som från lobbyn
 const tile=await p.evaluate(()=>{ const t=[...document.querySelectorAll('[data-act]')].find(e=>/patiens/i.test(e.textContent)); return t?t.dataset.act+'|'+(t.dataset.k||''):''; }); 
 await p.evaluate(()=>{ window.__mut=[]; const o=new MutationObserver(ms=>{ for(const m of ms){ if(m.type==='childList'&&(m.addedNodes.length||m.removedNodes.length)) window.__mut.push([performance.now()|0, m.target.id||m.target.className||m.target.tagName, m.addedNodes.length, m.removedNodes.length]); if(m.type==='attributes') window.__mut.push([performance.now()|0,'attr:'+m.attributeName+':'+(m.target.id||m.target.className||m.target.tagName)]); } }); o.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']}); });
 const t=[...await p.$$('[data-act]')]; await p.evaluate(()=>{ const t=[...document.querySelectorAll('[data-act]')].find(e=>/patiens/i.test(e.textContent)); t&&t.click(); }); await sleep(1500);
 await p.evaluate(()=>{ const s=document.querySelector('#modal [data-act=solstart]'); s&&s.click(); }); await sleep(4000);
 const r=await p.evaluate(()=>{ const m=window.__mut; window.__tl=m.slice(0,60).map(x=>x.join(':')).join(' , '); by={}; for(const x of m){ const k=x[1]; by[k]=(by[k]||0)+1; } return {tl:window.__tl, n:m.length, top:Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,8), view, solRoot:!!document.getElementById('solRoot'), modal:document.getElementById('modal')?.className}; });
 console.log(base, mob?'mobil':'dator', 'ruta:',tile, JSON.stringify(r), errs.slice(0,2));
 await c.close(); }
 await b.close(); process.exit(0); })();
