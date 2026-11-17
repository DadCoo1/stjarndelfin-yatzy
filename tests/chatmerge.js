// En person = en chatt: gamla chattar med samma användare (gamla nycklar efter ny installation/utloggning) slås ihop,
// meddelandena följer med, den aktuella och verifierade enheten blir kvar, och två olika personer med samma visningsnamn slås inte ihop.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fail++; };
const H=n=>n.repeat(64).slice(0,64);
(async()=>{ const b=await chromium.launch(); const c=await b.newContext({viewport:{width:390,height:800}});
  const A=H('a'), B=H('b'), C=H('c'), D=H('d'), E=H('e'), F=H('f'), card=(id,name)=>({v:1,id,name,emoji:'🐻',curve:'P-256',ik:'x'.repeat(120)});
  const contacts={ [A]:{...card(A,'Pappa'),added:1,vl:1}, [B]:{...card(B,'Pappa'),added:2,vl:1}, [C]:{...card(C,'Pappa'),added:3,vl:3,vAt:5},
    [D]:{...card(D,'Kim'),added:4,vl:1}, [E]:{...card(E,'Kim'),added:5,vl:1} };
  const msg=(mid,ts,t,out)=>({mid,ts,text:t,out:!!out,st:out?'read':undefined});
  const convs={ ['d:'+A]:{id:'d:'+A,type:'dm',msgs:[msg('m1',1000,'hej gamla 1'),msg('m2',2000,'svar 1',1)],unread:0,timer:0,theme:null,lastTs:2000},
    ['d:'+B]:{id:'d:'+B,type:'dm',msgs:[msg('m3',3000,'hej gamla 2')],unread:1,timer:0,theme:'wa-rosa',lastTs:3000},
    ['d:'+C]:{id:'d:'+C,type:'dm',msgs:[msg('m4',4000,'hej nya'),msg('m2',2000,'svar 1',1)],unread:2,timer:0,theme:null,lastTs:4000},
    ['d:'+D]:{id:'d:'+D,type:'dm',msgs:[msg('k1',1500,'Kim ett')],unread:0,timer:0,theme:null,lastTs:1500},
    ['d:'+E]:{id:'d:'+E,type:'dm',msgs:[msg('k2',2500,'Kim två')],unread:0,timer:0,theme:null,lastTs:2500} };
  // i serverns lista: Pappas nuvarande enhet C (användare pappa), och två olika användare som båda heter Kim (kim1 = D, kim2 = E)
  const dir=[{user:'pappa',n:1,card:card(C,'Pappa')},{user:'kim1',n:1,card:card(D,'Kim')},{user:'kim2',n:1,card:card(E,'Kim')}];
  const me={id:F,name:'Sara',emoji:'🐬',curve:'P-256',ik:{pub:'x'.repeat(120),priv:{}},created:1};
  await c.addInitScript(`window.__NET_SERVER=''; localStorage.setItem('dev:onboarded','1'); localStorage.setItem('dev:sfx','0');
    if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1'); const s=(k,v)=>localStorage.setItem('dev:chat:'+k,JSON.stringify(v));
      s('me',${JSON.stringify(me)}); s('contacts',${JSON.stringify(contacts)}); s('convs',${JSON.stringify(convs)}); s('dir',${JSON.stringify(dir)}); s('known',${JSON.stringify(Object.fromEntries(Object.entries(contacts).map(([k,v])=>[k,card(k,v.name)])))}); }`);
  const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(3000);
  const r=await p.evaluate(()=>{ const T=CHAT.__test, cv=T.convs(), ct=T.contacts(); const dms=Object.values(cv).filter(c=>c.type==='dm');
    return {dms:dms.map(c=>c.id.slice(2,4)+':'+c.msgs.map(m=>m.mid).join(',')), prim:T.prim(), alias:Object.keys(ct).filter(id=>ct[id].alias).map(id=>id.slice(0,2)), vl:Object.fromEntries(Object.entries(ct).map(([k,v])=>[k.slice(0,2),v.vl])),
      unread:(cv['d:'+'c'.repeat(64)]||{}).unread, theme:(cv['d:'+'c'.repeat(64)]||{}).theme}; });
  const pap=r.dms.filter(x=>/^(aa|bb|cc):/.test(x));
  ok(pap.length===1 && pap[0].startsWith('cc:'), 'Pappa: en enda chatt, på den nuvarande och verifierade enheten');
  ok(pap.length===1 && pap[0]==='cc:m1,m2,m3,m4', 'alla meddelanden följer med, i tidsordning och utan dubbletter');
  ok(r.alias.includes('aa')&&r.alias.includes('bb')&&!r.alias.includes('cc'), 'de gamla nycklarna blir dolda enheter');
  ok(r.vl.cc===3 && r.vl.aa===1 && r.vl.bb===1, 'verifieringen hör bara till nyckeln den gjordes för');
  ok(r.unread===3 && r.theme==='wa-rosa', 'olästa och vald bakgrund följer med');
  ok(r.dms.filter(x=>/^(dd|ee):/.test(x)).length===2, 'två olika personer som båda heter Kim slås inte ihop');
  await p.evaluate(()=>CHAT.open()); await sleep(600);
  const rows=await p.evaluate(()=>{ return [...document.querySelectorAll('[data-c=open][data-id^="d:"]')].filter(x=>/Pappa/.test(x.innerText)).length; });
  ok(rows===1, `chattlistan visar Pappa en gång (${rows})`);
  await p.reload(); await sleep(2500); const again=await p.evaluate(()=>Object.values(CHAT.__test.convs()).filter(c=>c.type==='dm').length);
  ok(again===3, `efter omstart: fortfarande tre chattar (Pappa, Kim, Kim) – ${again}`);
  ok(!errs.length, 'inga fel '+errs.slice(0,2).join(' | ')); await b.close(); process.exit(fail?1:0); })();
