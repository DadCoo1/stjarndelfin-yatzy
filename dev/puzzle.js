/* =====================================================================
   puzzle.js – Wordle (svenska/norska, dagens ord eller övning) och Sudoku
   Ensamspel. Gissningar kontrolleras mot Ordfajts ordlistor.
   ===================================================================== */
'use strict';
(function(){
  const now=()=>Date.now();
  const st=document.createElement('style'); document.head.appendChild(st); const css=s=>{ st.textContent+=s; };
  // dagsnummer i svensk tid, och en slumpgenerator som går att upprepa (samma ord/pussel för alla samma dag)
  const dayNo=()=>{ const d=new Date(new Date().toLocaleString('en-US',{timeZone:'Europe/Stockholm'})); return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5); };
  const dayStr=n=>new Date(n*864e5).toISOString().slice(0,10);
  function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

  /* =================================================================
     1) WORDLE
     ================================================================= */
  const WD_WORDS={"sv": ["agera", "aktie", "album", "alpin", "andas", "arena", "armar", "arton", "avund", "bacon", "bakom", "banan", "bandy", "baron", "basar", "bebis", "bilar", "bilen", "binda", "björk", "black", "blank", "blixt", "block", "blond", "blyga", "bläck", "blöta", "bolag", "bonde", "borde", "borst", "bredd", "brist", "brosk", "bruna", "brygg", "bräda", "bröst", "buske", "butik", "bygga", "cello", "chans", "cider", "citat", "dagar", "dalar", "dansa", "datum", "djupa", "dolda", "drake", "druva", "dräkt", "duett", "elden", "enkel", "ensam", "fabel", "falla", "falsk", "fasan", "ferie", "fiber", "figur", "filma", "final", "fiska", "fjäll", "flagg", "flera", "flott", "flyga", "flykt", "fläkt", "flöde", "fokus", "forma", "frisk", "frost", "frukt", "fräck", "fylla", "fynda", "fälla", "färja", "färre", "fågel", "fånga", "galax", "galen", "gamla", "glans", "glass", "glida", "glimt", "glöda", "godis", "grann", "grepp", "grill", "groda", "grund", "grupp", "gräva", "grönt", "gurka", "hacka", "hagel", "hamna", "havet", "helig", "hemma", "hetta", "hissa", "hitta", "hjort", "hjälp", "humor", "hydda", "hylla", "hälsa", "hämta", "hänga", "höger", "höjda", "höken", "igloo", "isbit", "jacka", "jobba", "julen", "kalas", "kalla", "kamel", "kanin", "kanon", "kappa", "karta", "kasta", "klapp", "klass", "klipp", "klokt", "klubb", "knopp", "knuff", "koala", "kobra", "kolla", "komma", "konst", "kopia", "korta", "kraft", "krage", "krona", "krypa", "kudde", "kurva", "kusin", "kvarn", "kvist", "kärra", "lampa", "landa", "ledig", "lejon", "leken", "lemur", "lilja", "linje", "lista", "liten", "ljuga", "locka", "lucka", "lugna", "lukta", "lunch", "lycka", "läger", "lärka", "lådan", "lövet", "magen", "mamma", "mango", "manus", "match", "melon", "metod", "midja", "minne", "modig", "moped", "morot", "motor", "musik", "mynta", "mössa", "nacke", "nalle", "natur", "njuta", "noter", "nyhet", "nöjda", "ocean", "offer", "orgel", "orkan", "packa", "padda", "pappa", "parti", "pasta", "penna", "pilot", "pirat", "pizza", "plats", "plugg", "pojke", "polis", "ponny", "prata", "prick", "prova", "puder", "pumpa", "pussa", "pärla", "päron", "radio", "raket", "regel", "regna", "rikta", "rinna", "robot", "rolig", "rosen", "rubin", "rulla", "runda", "rädda", "räkna", "saker", "salta", "samla", "sanna", "saxen", "segel", "semla", "senap", "serie", "silke", "simma", "sinne", "sitta", "sjuka", "sjung", "skala", "skapa", "skatt", "skepp", "skida", "skina", "skola", "skrik", "skärp", "slott", "slump", "smaka", "smula", "smält", "snabb", "snack", "snitt", "snäll", "socka", "soffa", "solen", "spade", "spela", "spika", "spion", "spola", "sport", "spray", "språk", "spöke", "stack", "stark", "start", "stege", "stock", "stolt", "storm", "stryk", "stuga", "styra", "städa", "ställ", "sudda", "summa", "svamp", "svans", "svara", "svett", "sväng", "säker", "sälen", "sätta", "tacka", "tanka", "tavla", "tiger", "timme", "tomat", "torka", "trygg", "tröja", "tunga", "tvätt", "tyget", "tänka", "tårta", "ugnen", "ungar", "unika", "vagga", "vakna", "valen", "varmt", "vecka", "vegan", "vilja", "vinge", "vinka", "virka", "vägen", "vänta", "värld", "väska", "zebra", "ägget", "ärlig", "ärter", "önska", "öppna"], "nb": ["abbor", "alder", "anker", "arena", "armer", "avtal", "bakke", "balle", "banan", "bilde", "bitte", "blikk", "boble", "bonde", "borte", "brann", "bratt", "bredt", "brett", "bruke", "bunad", "bygge", "båten", "bølge", "dager", "danse", "denne", "dokke", "drage", "dukke", "dyret", "eller", "elven", "engel", "etter", "fakta", "falle", "farge", "fatte", "feber", "felle", "ferie", "fiken", "filme", "finne", "fiske", "fjell", "flagg", "flere", "flink", "flott", "flyet", "flyte", "fokus", "folke", "forme", "frisk", "frost", "frukt", "fyret", "følge", "gaven", "gitar", "glass", "glede", "grave", "greie", "grill", "grønn", "hagen", "harde", "havet", "hente", "hilse", "hjelp", "hjort", "hoppe", "hunde", "huset", "hytte", "høyre", "jakke", "jente", "julen", "kaffe", "kakao", "kalle", "kamel", "kanin", "kanon", "karte", "kaste", "katte", "koala", "komme", "konge", "korte", "kraft", "krone", "kunne", "lampe", "lande", "lange", "lekte", "lille", "linje", "lista", "liten", "lukte", "lunsj", "lykke", "lyset", "løper", "løven", "mamma", "mange", "marka", "melon", "minne", "modig", "motor", "mynte", "måler", "månen", "natur", "nisse", "noter", "nyhet", "orden", "pappa", "parti", "pasta", "penne", "piano", "pirat", "pizza", "plass", "prate", "pumpe", "pølse", "radio", "raket", "regel", "regne", "rolig", "rosin", "runde", "rydde", "sakte", "salat", "samle", "sanne", "seile", "sitte", "skape", "skatt", "skole", "skrik", "skudd", "skyer", "slott", "smake", "smile", "snakk", "snill", "sokke", "solen", "spade", "spion", "sport", "språk", "stein", "storm", "stort", "svare", "sykle", "takke", "tante", "tavle", "tiger", "tomat", "torsk", "trapp", "trene", "tunge", "ulven", "ungen", "vente", "våren", "ørret"], "nn": ["alder", "anker", "arena", "armer", "avtal", "bakke", "balle", "banan", "bilde", "bitte", "blikk", "boble", "bonde", "borte", "brann", "bratt", "bredt", "brett", "bruke", "bunad", "bygge", "båten", "danse", "denne", "disco", "dokke", "drage", "dukke", "dyret", "eller", "elven", "engel", "etter", "fakta", "falle", "farge", "fatte", "feber", "felle", "ferie", "fiken", "filme", "finne", "fiske", "fjell", "flagg", "flink", "flott", "flyet", "flyte", "fokus", "folke", "forme", "frisk", "frost", "frukt", "fugle", "fyret", "gitar", "glede", "grave", "greie", "grill", "grønn", "hagen", "harde", "havet", "hente", "hjelp", "hjort", "hoppe", "hunde", "huset", "hytte", "høyre", "jakke", "jente", "kaffe", "kakao", "kalle", "kamel", "kanin", "kanon", "karte", "kaste", "katte", "komme", "konge", "korte", "kraft", "krone", "kunne", "lampe", "lande", "lange", "lekte", "lille", "linje", "lista", "liten", "lukte", "lunsj", "lykke", "lyset", "mamma", "mange", "marka", "melon", "minne", "modig", "motor", "mynte", "måler", "månen", "natur", "nisse", "noter", "orden", "pappa", "parti", "pasta", "penne", "piano", "pirat", "pizza", "plass", "prate", "pumpe", "pølse", "radio", "raket", "regel", "regne", "rolig", "rosin", "runde", "rydde", "sakte", "salat", "samle", "sanne", "seile", "sitte", "skape", "skatt", "skole", "skrik", "skyer", "slott", "smake", "smile", "snakk", "snill", "sokke", "solen", "spade", "spion", "sport", "språk", "stein", "storm", "stort", "svare", "sykle", "takke", "tante", "tavle", "tiger", "tomat", "torsk", "trapp", "trene", "tunge", "ulven", "ungen", "vente", "våren"]};
  const WL={sv:{name:'Svenska',flag:'🇸🇪',keys:['qwertyuiopå','asdfghjklöä','⏎zxcvbnm⌫']},nb:{name:'Bokmål',flag:'🇳🇴',keys:['qwertyuiopå','asdfghjkløæ','⏎zxcvbnm⌫']},nn:{name:'Nynorsk',flag:'🇳🇴',keys:['qwertyuiopå','asdfghjkløæ','⏎zxcvbnm⌫']}};
  const dailyWord=(lang,n)=>{ const list=WD_WORDS[lang]; const order=[...list.keys()]; const r=rng(4711+lang.length*99991); for(let i=order.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [order[i],order[j]]=[order[j],order[i]]; } return list[order[((n%list.length)+list.length)%list.length]]; };
  function score(guess,ans){ const res=Array(5).fill('b'), left={}; const g=[...guess], a=[...ans];
    for(let i=0;i<5;i++){ if(g[i]===a[i]) res[i]='g'; else left[a[i]]=(left[a[i]]||0)+1; }
    for(let i=0;i<5;i++){ if(res[i]==='g') continue; if(left[g[i]]){ res[i]='y'; left[g[i]]--; } } return res.join(''); }
  let wdLang=lsGet('wd_lang')||'sv', wdMode='daily', wdInput='', wdShake=0;
  const wdStats=()=>{ try{ return JSON.parse(lsGet('wd_stats'))||{}; }catch(e){ return {}; } };
  GINFO.wordle={name:'Wordle', icon:'🟩', ai:'', max:1, desc:'Dagens ord · sex försök', grad:'linear-gradient(135deg,#16a34a,#ca8a04)'};
  KIND.wordle={
    init(){ return {lang:wdLang, daily:wdMode==='daily', guesses:[], marks:[]}; },
    start(g){ const n=dayNo(); g.day = g.daily ? n : null; g.ans = g.daily ? dailyWord(g.lang,n) : WD_WORDS[g.lang][rint(WD_WORDS[g.lang].length)]; g.guesses=[]; g.marks=[]; g.cur=0; },
    valid(g){ return g.names.length===1 && WL[g.lang] && typeof g.ans==='string' && g.ans.length===5 && Array.isArray(g.guesses) && g.guesses.length<=6; },
    waitingFor(){ return 0; }, scoreOf(g){ return `${g.guesses.length}/6`; },
    apply(g,a,seat){
      if(a.type==='resign'){ if(g.over) return false; g.over=true; g.winner=-2; return true; }
      if(g.over||a.type!=='guess'||typeof a.w!=='string'||a.w.length!==5) return false;
      const w=a.w.toLowerCase(); if(!(WD_WORDS[g.lang].includes(w)||(window.ORDLISTA&&ORDLISTA.has(g.lang,w)))) return false;
      g.guesses.push(w); g.marks.push(score(w,g.ans)); g.last={t:now(),w};
      if(w===g.ans){ g.over=true; g.winner=0; } else if(g.guesses.length>=6){ g.over=true; g.winner=-2; }
      if(g.over && g.daily){ const S=wdStats(), k=g.lang; const s=S[k]||(S[k]={played:0,won:0,streak:0,best:0,dist:[0,0,0,0,0,0],lastDay:null,last:null});
        if(s.last!==g.day){ s.played++; if(g.winner===0){ s.won++; s.dist[g.guesses.length-1]++; s.streak = s.lastDay===g.day-1 ? s.streak+1 : 1; s.best=Math.max(s.best,s.streak); s.lastDay=g.day; } else s.streak=0; s.last=g.day; lsSet('wd_stats',JSON.stringify(S)); } }
      return true; },
    effects(prev,d){ if(d.last&&(!prev.last||prev.last.t!==d.last.t)){ if(d.winner===0){ sfx.win(); sparkles(40); } else sfx.pick(); } },
    html(){
      const g=G, rows=[]; const L=WL[g.lang];
      for(let r=0;r<6;r++){ const w=g.guesses[r], m=g.marks[r]; let cells='';
        for(let i=0;i<5;i++){ const ch = w ? w[i] : (r===g.guesses.length&&!g.over ? (wdInput[i]||'') : '');
          const anim = m && r===g.guesses.length-1 && g.last && now()-g.last.t<1500;   // bara den nyss gissade raden vänds
          cells+=`<div class="wd-c ${m?m[i]:''} ${anim?'anim':''} ${ch&&!m?'typed':''} ${ch&&!m&&i===wdInput.length-1?'new':''}" style="--d:${i*.12}s">${ch.toUpperCase()}</div>`; }
        rows.push(`<div class="wd-r ${r===g.guesses.length&&wdShake?'shake':''}">${cells}</div>`); }
      const best={}; g.guesses.forEach((w,r)=>[...w].forEach((ch,i)=>{ const m=g.marks[r][i], o=best[ch]; if(m==='g'||(m==='y'&&o!=='g')||(!o)) best[ch]= m==='g'?'g': m==='y'&&o!=='g'?'y': o||m; }));
      const kb=L.keys.map(row=>`<div class="wd-kr">${[...row].map(k=>`<button class="wd-k ${best[k]||''} ${k==='⏎'||k==='⌫'?'wide':''}" data-wd="${k}">${k==='⏎'?'ENTER':k.toUpperCase()}</button>`).join('')}</div>`).join('');
      let end='';
      if(g.over){ const S=wdStats()[g.lang];
        const grid=g.marks.map(m=>[...m].map(x=>x==='g'?'🟩':x==='y'?'🟨':'⬛').join('')).join('\n');
        end=`<div class="wd-end"><h3>${g.winner===0?['Geni! 🤩','Fantastiskt! 🌟','Snyggt! 🐬','Bra! 👏','Puh! 😅','Precis! 😮‍💨'][g.guesses.length-1]:'Nästan! 💙'}</h3><p>Ordet var <b>${g.ans.toUpperCase()}</b></p>
          ${g.daily&&S?`<div class="wd-st"><div><b>${S.played}</b>spelade</div><div><b>${S.played?Math.round(S.won/S.played*100):0}%</b>vunna</div><div><b>${S.streak}</b>i rad</div><div><b>${S.best}</b>rekord</div></div>`:''}
          <pre class="wd-grid">${grid}</pre>
          <div class="cbtns"><button class="pri" data-wd="share">📋 Kopiera resultat</button><button data-wd="practice">🔁 Öva med nytt ord</button><button data-act="lobby">🏠 Lobby</button></div></div>`; }
      return `<div class="gsub">${L.flag} ${g.daily?`Dagens ord ${dayStr(g.day)}`:'Övning'} · ${g.guesses.length}/6</div><div class="wd-b">${rows.join('')}</div>` + (g.over?end:`<div class="wd-kb">${kb}</div><div class="ghint">🟩 rätt plats · 🟨 finns i ordet · ⬛ finns inte. ${KIT.resignHTML()}</div>`); }
  };
  function wdKey(k){
    if(!G||G.kind!=='wordle'||G.over||view!=='game') return;
    if(k==='⌫'||k==='Backspace'){ wdInput=wdInput.slice(0,-1); render(); return; }
    if(k==='⏎'||k==='Enter'){ if(wdInput.length<5){ shake('För kort ord'); return; }
      const w=wdInput; if(!(WD_WORDS[G.lang].includes(w)||(window.ORDLISTA&&ORDLISTA.has(G.lang,w)))){ shake('Finns inte i ordlistan'); return; }
      wdInput=''; doAct({type:'guess',w}); return; }
    const c=String(k).toLowerCase(); if(c.length===1 && WL[G.lang].keys.join('').includes(c) && c!=='⏎' && c!=='⌫' && wdInput.length<5){ wdInput+=c; sfx.bubble(); render(); } }
  function shake(msg){ toast(msg,1200); wdShake=1; render(); setTimeout(()=>{ wdShake=0; render(); },450); }
  document.addEventListener('click',async e=>{ const b=e.target.closest('[data-wd]'); if(!b) return; const k=b.dataset.wd;
    if(k==='lang'){ wdLang=b.dataset.l; lsSet('wd_lang',wdLang); if(window.ORDLISTA) ORDLISTA.load(wdLang).catch(()=>{}); showWordleMenu(); return; }
    if(k==='daily'||k==='free'){ wdMode=k; const n=(document.getElementById('nm')?.value||'').trim()||lsGet('ry_name')||'Du'; lsSet('ry_name',n); unlockAudio();
      try{ await ORDLISTA.load(wdLang); }catch(err){ toast('Ordlistan kunde inte laddas – har du internet? 📡',3000); }
      wdInput=''; KIT.startSolo('wordle',n); return; }
    if(k==='share'){ const g=G; const txt=`Wordle ${WL[g.lang].flag} ${g.daily?dayStr(g.day):'övning'} ${g.winner===0?g.guesses.length:'X'}/6\n`+g.marks.map(m=>[...m].map(x=>x==='g'?'🟩':x==='y'?'🟨':'⬛').join('')).join('\n');
      try{ await navigator.clipboard.writeText(txt); toast('Kopierat – klistra in i chatten 💬'); }catch(err){ toast('Kunde inte kopiera'); } return; }
    if(k==='practice'){ wdMode='free'; wdLang=G.lang; wdInput=''; KIT.startSolo('wordle',G.names[0]); return; }
    wdKey(k); });
  document.addEventListener('keydown',e=>{ if(!G||G.kind!=='wordle'||view!=='game'||G.over||e.ctrlKey||e.metaKey||e.altKey) return; if(document.activeElement&&/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if(e.key==='Enter'||e.key==='Backspace'||e.key.length===1){ e.preventDefault(); wdKey(e.key); } });
  window.showWordleMenu=function(){
    const S=wdStats()[wdLang], doneToday = S && S.last===dayNo();
    openModal(`<h3>🟩 Wordle</h3><p>Gissa det hemliga ordet på fem bokstäver. Efter varje gissning visar färgerna vilka bokstäver som är rätt. Samma dagens ord för alla – jämför i chatten!</p>
      <label>Språk</label><div class="seg">${Object.entries(WL).map(([k,l])=>`<button data-wd="lang" data-l="${k}" class="${wdLang===k?'sel':''}">${l.flag} ${l.name}</button>`).join('')}</div>
      ${S?`<div class="setnote">Spelade ${S.played} · ${S.streak} i rad · rekord ${S.best}${doneToday?' · dagens ord är klart ✅':''}</div>`:''}
      <div class="btns" style="flex-direction:column"><button class="pri" data-wd="daily">📅 Dagens ord</button><button class="pri" data-wd="free" style="background:linear-gradient(135deg,#22d3ee,#6366f1)">🔁 Öva med ett slumpat ord</button><button data-act="close">Avbryt</button></div>`,'wdmenu');
    if(window.ORDLISTA) ORDLISTA.load(wdLang).catch(()=>{}); };
  GINFO.wordle.menu=()=>showWordleMenu();
  css(`.wd-b{display:grid;gap:6px;max-width:min(330px,100%,max(230px,calc((100dvh - 420px)*5/6)));margin:8px auto}
.wd-r{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.wd-r.shake{animation:wdsh .4s}@keyframes wdsh{20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
.wd-c{aspect-ratio:1;border:2px solid rgba(148,163,184,.4);border-radius:8px;display:grid;place-items:center;font-size:clamp(20px,7vw,32px);font-weight:800;text-transform:uppercase}
.wd-c.typed{border-color:#cbd5e1}.wd-c.new{animation:wdp .12s}@keyframes wdp{50%{transform:scale(1.08)}}
.wd-c.g,.wd-c.y,.wd-c.b{border:0}.wd-c.anim{animation:wdf .5s var(--d) both}@keyframes wdf{0%{transform:rotateX(0)}50%{transform:rotateX(90deg)}100%{transform:rotateX(0)}}
.wd-c.g{background:#16a34a}.wd-c.y{background:#ca8a04}.wd-c.b{background:#334155}
.wd-kb{max-width:520px;margin:10px auto 0;display:flex;flex-direction:column;gap:6px;padding:0 2px}.wd-kr{display:flex;gap:4px;justify-content:center}
.wd-k{flex:1;min-width:0;max-width:44px;height:52px;border-radius:7px;background:#64748b;font-weight:700;font-size:16px;padding:0;text-transform:uppercase}
.wd-k.wide{max-width:68px;flex:1.5;font-size:12px}.wd-k.g{background:#16a34a}.wd-k.y{background:#ca8a04}.wd-k.b{background:#1e293b;color:#64748b}
.wd-end{text-align:center;margin-top:10px}.wd-end .cbtns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:8px 0}.wd-end .cbtns button{padding:11px 14px;border-radius:14px;background:var(--glass2);border:1px solid var(--line);font-weight:700}.wd-end .cbtns button.pri{background:linear-gradient(135deg,#22c55e,#0ea5e9);border:0}.wd-end h3{margin:4px 0;font-size:24px}.wd-grid{font-size:20px;line-height:1.15;margin:8px 0}
.wd-st{display:flex;justify-content:center;gap:16px;margin:8px 0}.wd-st div{display:flex;flex-direction:column;font-size:12px;opacity:.85}.wd-st b{font-size:22px}`);

  /* =================================================================
     2) SUDOKU – generator med unik lösning, tre nivåer + dagens sudoku
     ================================================================= */
  const BOX=i=>Math.floor(Math.floor(i/9)/3)*3+Math.floor((i%9)/3);
  const PEERS=[...Array(81).keys()].map(i=>{ const r=Math.floor(i/9), c=i%9, b=BOX(i), s=new Set(); for(let j=0;j<81;j++) if(j!==i&&(Math.floor(j/9)===r||j%9===c||BOX(j)===b)) s.add(j); return [...s]; });
  function solve(g,count,limit,rand){ // backtracking med "minst antal kandidater först"
    let best=-1, bestC=null;
    for(let i=0;i<81;i++){ if(g[i]) continue; const used=new Set(PEERS[i].map(j=>g[j])); const c=[1,2,3,4,5,6,7,8,9].filter(v=>!used.has(v)); if(!c.length) return count; if(!bestC||c.length<bestC.length){ best=i; bestC=c; if(c.length===1) break; } }
    if(best<0) return count+1;
    if(rand) for(let k=bestC.length-1;k>0;k--){ const j=Math.floor(rand()*(k+1)); [bestC[k],bestC[j]]=[bestC[j],bestC[k]]; }
    for(const v of bestC){ g[best]=v; count=solve(g,count,limit,rand); if(count>=limit){ if(rand) return count; g[best]=0; return count; } } g[best]=0; return count;
  }
  function generate(level,seed){
    const r=rng(seed); const full=new Array(81).fill(0); solve(full,0,1,r);
    const sol=full.slice(), puz=full.slice(); const target={easy:40,medium:32,hard:26}[level]||32;
    const order=[...Array(81).keys()]; for(let k=80;k>0;k--){ const j=Math.floor(r()*(k+1)); [order[k],order[j]]=[order[j],order[k]]; }
    let clues=81;
    for(const i of order){ if(clues<=target) break; const v=puz[i]; puz[i]=0; const t=puz.slice(); if(solve(t,0,2,null)!==1) puz[i]=v; else clues--; }
    return {puz,sol};
  }
  let sdLevel=lsGet('sd_lvl')||'medium', sdDaily=false, sdSel=-1, sdNotes=false, sdTick=0;
  GINFO.sudoku={name:'Sudoku', icon:'🔢', ai:'', max:1, desc:'Tre nivåer + dagens sudoku', grad:'linear-gradient(135deg,#0891b2,#7c3aed)'};
  KIND.sudoku={
    init(){ return {level:sdLevel, daily:sdDaily}; },
    start(g){ const n=dayNo(); g.day=g.daily?n:null; const seed = g.daily ? n*31+({easy:1,medium:2,hard:3}[g.level]) : Math.floor(Math.random()*1e9);
      const {puz,sol}=generate(g.level,seed); g.puz=puz; g.sol=sol; g.val=puz.slice(); g.notes=new Array(81).fill(0); g.mist=0; g.hints=0; g.t0=now(); g.time=0; g.cur=0; },
    valid(g){ return g.names.length===1 && Array.isArray(g.puz)&&g.puz.length===81 && Array.isArray(g.val)&&g.val.length===81; },
    waitingFor(){ return 0; }, scoreOf(g){ return fmt(g); },
    apply(g,a){
      if(a.type==='resign'){ if(g.over) return false; g.over=true; g.winner=-2; return true; }
      if(g.over||!Number.isInteger(a.i)||a.i<0||a.i>80||g.puz[a.i]) return false;
      if(a.type==='set'){ if(!Number.isInteger(a.v)||a.v<0||a.v>9) return false; g.val[a.i]=a.v; g.notes[a.i]=0;
        if(a.v && a.v!==g.sol[a.i]) g.mist++;
        if(a.v) PEERS[a.i].forEach(j=>{ g.notes[j]&=~(1<<a.v); }); }
      else if(a.type==='note'){ if(!Number.isInteger(a.v)||a.v<1||a.v>9||g.val[a.i]) return false; g.notes[a.i]^=(1<<a.v); }
      else if(a.type==='hint'){ if(g.val[a.i]===g.sol[a.i]) return false; g.val[a.i]=g.sol[a.i]; g.notes[a.i]=0; g.hints++; PEERS[a.i].forEach(j=>{ g.notes[j]&=~(1<<g.sol[a.i]); }); }
      else return false;
      g.last={t:now(),i:a.i,type:a.type};
      if(g.val.every((v,i)=>v===g.sol[i])){ g.over=true; g.winner=0; g.time=Math.round((now()-g.t0)/1000);
        if(g.daily){ const S=JSON.parse(lsGet('sd_daily')||'{}'); const k=g.day+':'+g.level; if(!S[k]||S[k]>g.time) S[k]=g.time; lsSet('sd_daily',JSON.stringify(S)); }
        const B=JSON.parse(lsGet('sd_best')||'{}'); if(!B[g.level]||B[g.level]>g.time) B[g.level]=g.time; lsSet('sd_best',JSON.stringify(B)); }
      return true; },
    effects(prev,d){ if(!d.last||(prev.last&&prev.last.t===d.last.t)) return; if(d.over&&d.winner===0){ sfx.win(); sparkles(50); return; }
      const i=d.last.i, v=d.val[i]; if(d.last.type==='set'&&v&&v!==d.sol[i]){ sfx.unbubble(); buzz(30); } else sfx.bubble();
      // fylld rad/kolumn/ruta: liten glädje
      if(v===d.sol[i]){ const r=Math.floor(i/9), c=i%9, b=BOX(i); const done=f=>[...Array(81).keys()].filter(f).every(j=>d.val[j]===d.sol[j]);
        if(done(j=>Math.floor(j/9)===r)||done(j=>j%9===c)||done(j=>BOX(j)===b)){ sfx.pick(); } } },
    html(){
      const g=G; if(sdSel>=0&&g.puz[sdSel]) {}
      const selV = sdSel>=0 ? g.val[sdSel] : 0, sr=Math.floor(sdSel/9), sc=sdSel%9, sb=sdSel>=0?BOX(sdSel):-1;
      let cells=''; for(let i=0;i<81;i++){ const v=g.val[i], given=!!g.puz[i], wrong=v&&v!==g.sol[i];
        const hl = sdSel>=0 && (Math.floor(i/9)===sr||i%9===sc||BOX(i)===sb), same = selV && v===selV;
        cells+=`<button class="sd-c ${given?'giv':''} ${wrong?'bad':''} ${i===sdSel?'sel':''} ${hl?'hl':''} ${same?'same':''} ${i%9%3===2&&i%9!==8?'br':''} ${Math.floor(i/9)%3===2&&i<72?'bb':''}" data-sd="c" data-i="${i}">${v?v:g.notes[i]?`<span class="sd-n">${[1,2,3,4,5,6,7,8,9].map(n=>`<i>${g.notes[i]&(1<<n)?n:''}</i>`).join('')}</span>`:''}</button>`; }
      const left=n=>9-g.val.filter((v,i)=>v===n&&v===g.sol[i]).length;
      const pad=[1,2,3,4,5,6,7,8,9].map(n=>`<button class="sd-k ${left(n)?'':'done'}" data-sd="n" data-v="${n}">${n}<small>${left(n)||'✓'}</small></button>`).join('');
      const lv={easy:'Lätt',medium:'Medel',hard:'Svår'}[g.level];
      if(g.over) return `<div class="gsub">${g.daily?`Dagens sudoku ${dayStr(g.day)} · `:''}${lv}</div><div class="sd-b">${cells}</div><div class="wd-end"><h3>${g.winner===0?'Klart! 🎉':'Avslutat'}</h3>
        ${g.winner===0?`<p>Tid <b>${fmt(g)}</b> · ${g.mist} fel · ${g.hints} tips</p>`:''}<div class="cbtns"><button class="pri" data-sd="again">🔁 Nytt pussel</button><button data-act="lobby">🏠 Lobby</button></div></div>`;
      return `<div class="gsub">${g.daily?`📅 ${dayStr(g.day)} · `:''}${lv} · ⏱️ <span id="sdTime">${fmt(g)}</span> · ${g.mist} fel</div><div class="sd-b">${cells}</div>
        <div class="sd-tools"><button data-sd="erase">⌫ Sudda</button><button data-sd="notes" class="${sdNotes?'on':''}">✏️ Anteckna ${sdNotes?'PÅ':'AV'}</button><button data-sd="hint">💡 Tips</button></div>
        <div class="sd-pad">${pad}</div><div class="ghint">Varje rad, kolumn och 3×3-ruta ska ha 1–9 en gång. ${KIT.resignHTML()}</div>`; },
    mounted(){ clearInterval(sdTick); if(!G.over) sdTick=setInterval(()=>{ const el=document.getElementById('sdTime'); if(!el||!G||G.kind!=='sudoku'){ clearInterval(sdTick); return; } el.textContent=fmt(G); },1000); }
  };
  const fmt=g=>{ const s=g.over?g.time:Math.round((now()-g.t0)/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
  function sdInput(v){ if(!G||G.kind!=='sudoku'||G.over||sdSel<0||G.puz[sdSel]) return;
    if(sdNotes && v) doAct({type:'note',i:sdSel,v}); else doAct({type:'set',i:sdSel,v}); }
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-sd]'); if(!b) return; const a=b.dataset.sd;
    if(a==='lvl'){ sdLevel=b.dataset.l; lsSet('sd_lvl',sdLevel); showSudokuMenu(); return; }
    if(a==='start'||a==='daily'){ sdDaily=a==='daily'; sdSel=-1; const n=lsGet('ry_name')||'Du'; unlockAudio(); KIT.startSolo('sudoku',n); return; }
    if(!G||G.kind!=='sudoku') return;
    if(a==='again'){ sdDaily=false; sdLevel=G.level; sdSel=-1; KIT.startSolo('sudoku',G.names[0]); return; }
    if(a==='c'){ sdSel=+b.dataset.i; render(); return; }
    if(a==='n'){ sdInput(+b.dataset.v); return; }
    if(a==='erase'){ sdInput(0); return; }
    if(a==='notes'){ sdNotes=!sdNotes; render(); return; }
    if(a==='hint'){ let i=sdSel; if(i<0||G.puz[i]||G.val[i]===G.sol[i]){ i=G.val.findIndex((v,k)=>!G.puz[k]&&v!==G.sol[k]); } if(i>=0){ sdSel=i; doAct({type:'hint',i}); } return; } });
  document.addEventListener('keydown',e=>{ if(!G||G.kind!=='sudoku'||view!=='game'||G.over) return; if(document.activeElement&&/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if(/^[1-9]$/.test(e.key)){ sdInput(+e.key); e.preventDefault(); } else if(e.key==='Backspace'||e.key==='Delete'||e.key==='0'){ sdInput(0); e.preventDefault(); }
    else if(e.key.startsWith('Arrow')){ if(sdSel<0) sdSel=0; else { const d={ArrowUp:-9,ArrowDown:9,ArrowLeft:-1,ArrowRight:1}[e.key]; sdSel=(sdSel+d+81)%81; } render(); e.preventDefault(); }
    else if(e.key==='n'){ sdNotes=!sdNotes; render(); } });
  window.showSudokuMenu=function(){
    const B=JSON.parse(lsGet('sd_best')||'{}'), D=JSON.parse(lsGet('sd_daily')||'{}'), today=D[dayNo()+':'+sdLevel];
    const f=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
    openModal(`<h3>🔢 Sudoku</h3><p>Fyll rutnätet så att varje rad, kolumn och 3×3-ruta innehåller siffrorna 1–9 exakt en gång.</p>
      <label>Nivå</label><div class="seg">${[['easy','🐣 Lätt'],['medium','🙂 Medel'],['hard','🧠 Svår']].map(([k,l])=>`<button data-sd="lvl" data-l="${k}" class="${sdLevel===k?'sel':''}">${l}</button>`).join('')}</div>
      ${B[sdLevel]?`<div class="setnote">Bästa tid: ${f(B[sdLevel])}${today?` · dagens: ${f(today)} ✅`:''}</div>`:''}
      <div class="btns" style="flex-direction:column"><button class="pri" data-sd="daily">📅 Dagens sudoku</button><button class="pri" data-sd="start" style="background:linear-gradient(135deg,#22d3ee,#6366f1)">🎲 Nytt slumpat pussel</button><button data-act="close">Avbryt</button></div>`,'sdmenu'); };
  GINFO.sudoku.menu=()=>showSudokuMenu();
  css(`.sd-b{display:grid;grid-template-columns:repeat(9,1fr);max-width:min(460px,100%,max(300px,calc(100dvh - 330px)));margin:8px auto;border:3px solid #cbd5e1;border-radius:10px;overflow:hidden;background:#0f172a;container-type:inline-size}
.sd-c{aspect-ratio:1;border:0;border-right:1px solid #475569;border-bottom:1px solid #475569;background:#f8fafc;color:#1d4ed8;font-size:calc(100cqw/9*.58);font-weight:700;padding:0;display:grid;place-items:center;position:relative}
.sd-c.br{border-right:3px solid #0f172a}.sd-c.bb{border-bottom:3px solid #0f172a}
.sd-c.giv{color:#0f172a;font-weight:800}.sd-c.hl{background:#e0f2fe}.sd-c.same{background:#bae6fd}.sd-c.sel{background:#7dd3fc}.sd-c.bad{color:#dc2626;background:#fee2e2}
.sd-n{position:absolute;inset:2px;display:grid;grid-template-columns:repeat(3,1fr);font-size:calc(100cqw/9*.24);color:#475569;font-weight:600}.sd-n i{font-style:normal;display:grid;place-items:center}
.sd-tools{display:flex;gap:8px;justify-content:center;margin:6px 0}.sd-tools button{padding:9px 12px;border-radius:12px;background:var(--glass2);border:1px solid var(--line);font-size:14px}.sd-tools button.on{border-color:#facc15;background:rgba(250,204,21,.2)}
.sd-pad{display:grid;grid-template-columns:repeat(9,1fr);gap:4px;max-width:460px;margin:4px auto}.sd-k{aspect-ratio:.8;border-radius:10px;background:linear-gradient(160deg,#334155,#1e293b);font-size:22px;font-weight:800;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0}
.sd-k small{font-size:10px;opacity:.6;font-weight:600}.sd-k.done{opacity:.35}`);

  window.__puzTest=(typeof DEV!=='undefined'&&DEV)?{score,dailyWord,generate,solve,dayNo}:undefined;
})();
