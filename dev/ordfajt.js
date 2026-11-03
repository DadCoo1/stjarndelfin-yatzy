/* =====================================================================
   ordfajt.js – Ordfajt (ordspel i stil med Wordfeud)
   • Ordlista: DSSO (svensk rättstavning, LGPL-3.0), alla böjningsformer,
     packad som DAWG i ordfajt-ord.bin. Se ORDLISTA-LICENS.txt.
   • Egna tilläggsordlistor kan kopplas till ett spel när det startar.
   • 2 spelare online eller 1 spelare mot datorn (offline).
   • Långtryck på ett lagt ord: betydelse och synonymer (Wiktionary) + SAOL-länk.
   ===================================================================== */
'use strict';
(function(){
  const N=15, C=7*N+7;
  /* ---------- språk ---------- */
  const SV_VAL={a:1,b:4,c:8,d:1,e:1,f:4,g:2,h:3,i:1,j:7,k:2,l:1,m:2,n:1,o:2,p:4,q:10,r:1,s:1,t:1,u:4,v:3,w:10,x:8,y:7,z:8,'å':4,'ä':3,'ö':4};
  const SV_DIST={a:10,b:2,c:1,d:5,e:9,f:2,g:3,h:2,i:5,j:1,k:3,l:5,m:3,n:6,o:5,p:2,r:8,s:8,t:8,u:3,v:2,x:1,y:1,z:1,'å':2,'ä':2,'ö':2,'?':2};
  const NO_VAL={a:1,b:4,c:10,d:1,e:1,f:2,g:2,h:3,i:1,j:4,k:2,l:1,m:2,n:1,o:2,p:4,q:10,r:1,s:1,t:1,u:2,v:4,w:8,x:10,y:6,z:10,'æ':6,'ø':5,'å':4};
  const NO_DIST={a:7,b:3,c:1,d:5,e:9,f:4,g:4,h:3,i:5,j:2,k:4,l:5,m:3,n:6,o:4,p:2,r:6,s:6,t:6,u:3,v:3,w:1,y:1,'æ':1,'ø':2,'å':2,'?':2};
  const SV_A='abcdefghijklmnopqrstuvwxyzåäö', NO_A='abcdefghijklmnopqrstuvwxyzæøå';
  const LANGS={
    sv:{name:'Svenska', flag:'🇸🇪', alpha:SV_A, val:SV_VAL, dist:SV_DIST, dict:'sv', wiki:'sv', sec:/^(Svenska)$/i,
        look:w=>[['📖 Slå upp i SAOL',`https://svenska.se/tre/?sok=${encodeURIComponent(w)}&pz=1`]],
        ends:['arnas','ernas','ornas','arna','erna','orna','ens','ets','na','en','et','ar','er','or','s','t','e','a','are','ast','aste','ade','at','de','te']},
    nb:{name:'Norsk bokmål', flag:'🇳🇴', alpha:NO_A, val:NO_VAL, dist:NO_DIST, dict:'nb', wiki:'no', sec:/^(Norsk|Norsk bokmål|Bokmål)$/i,
        look:w=>[['📖 Slå opp i Bokmålsordboka',`https://ordbokene.no/bm/${encodeURIComponent(w)}`]],
        ends:['ene','ane','en','et','a','er','ar','e','te','de','et','s','t','est','ere']},
    nn:{name:'Norsk nynorsk', flag:'🇳🇴', alpha:NO_A, val:NO_VAL, dist:NO_DIST, dict:'nn', wiki:'nn', sec:/^(Nynorsk|Norsk nynorsk|Norsk)$/i,
        look:w=>[['📖 Slå opp i Nynorskordboka',`https://ordbokene.no/nn/${encodeURIComponent(w)}`]],
        ends:['ane','ene','ar','er','en','et','a','i','e','te','de','s','t','ast','are']},
    jam:{name:'Jamska', flag:'🫎', alpha:SV_A, val:SV_VAL, dist:SV_DIST, dict:'sv', wiki:'sv', sec:/^(Jamska|Jämtska|Svenska)$/i, jam:true,
        look:w=>[['📖 Slå upp i SAOL',`https://svenska.se/tre/?sok=${encodeURIComponent(w)}&pz=1`]],
        ends:['a','en','n','et','e','om','er','ar','s','t']}
  };
  let LANG=LANGS.sv, ALPHA=SV_A, LI={}, VAL=SV_VAL, DIST=SV_DIST, D=null;
  const DICTS={}, dictPs={};
  function useLang(code){ const L=LANGS[code]||LANGS.sv; if(L!==LANG || !Object.keys(LI).length){ LANG=L; ALPHA=L.alpha; VAL=L.val; DIST=L.dist; LI={}; [...ALPHA].forEach((c,i)=>LI[c]=i+1); } D=DICTS[L.dict]||null; return L; }
  useLang('sv');
  // bonusrutor (egen symmetrisk layout): W=3×ord, w=2×ord, L=3×bokstav, l=2×bokstav, *=start
  const Q=["L...W..l",".l...L..","..w...l.","...L...w","W...w.l.",".L...L..","..l.l...","l..w...*"];
  const PREM=(()=>{ const rows=Q.map(r=>r+[...r.slice(0,7)].reverse().join('')); const all=[...rows, ...rows.slice(0,7).reverse()]; return all.join('').split(''); })();
  const PLABEL={W:'TO',w:'DO',L:'TB',l:'DB','*':'★'};
  const isL = c => typeof c==='string' && c.length===1 && !!LI[c.toLowerCase()];
  const low = c => c.toLowerCase();
  const tileVal = t => t && t===t.toUpperCase() && t!==t.toLowerCase() ? 0 : (VAL[t]||0);   // versal = blankbricka

  /* ---------- ordlistan (DAWG) ---------- */
  function loadDict(code){
    const dc=(LANGS[code]||LANG).dict;
    if(DICTS[dc]) return Promise.resolve(DICTS[dc]);
    if(!dictPs[dc]) dictPs[dc]=fetch(`ordfajt-${dc}.bin`).then(r=>{ if(!r.ok) throw new Error('ordlistan'); return r.arrayBuffer(); })
      .then(b=>{ DICTS[dc]=new Uint32Array(b); if(LANG.dict===dc) D=DICTS[dc]; return DICTS[dc]; }).catch(e=>{ delete dictPs[dc]; throw e; });
    return dictPs[dc];
  }
  const edge = (node,L) => { if(!node) return -1; let e=node; while(true){ const v=D[e]; if((v&31)===L) return e; if(v&64) return -1; e++; } };
  function inDawg(w){ if(!D) return false; let node=1, term=false; for(const ch of w){ const L=LI[ch]; if(!L) return false; const e=edge(node,L); if(e<0) return false; term=!!(D[e]&32); node=D[e]>>>7; } return term; }
  let EXTRA=new Set();
  const isWord = w => w.length>=2 && (inDawg(w) || EXTRA.has(w));

  /* ---------- regler ---------- */
  const rc = i => [Math.floor(i/N), i%N];
  function bagNew(){ const b=[]; for(const [l,n] of Object.entries(DIST)) for(let k=0;k<n;k++) b.push(l); for(let i=b.length-1;i>0;i--){ const j=rint(i+1); [b[i],b[j]]=[b[j],b[i]]; } return b; }
  function boardEmpty(board){ return board.every(x=>!x); }
  // räkna ut och kontrollera ett drag; placed=[{i,l,b}] (l liten bokstav, b=blank)
  function evaluate(board, placed){
    if(!placed.length) return {ok:false, err:'Lägg ut några brickor'};
    const B=board.slice(); const P=new Set();
    for(const t of placed){ if(B[t.i]) return {ok:false, err:'Rutan är upptagen'}; B[t.i]= t.b ? t.l.toUpperCase() : t.l; P.add(t.i); }
    const rows=new Set(placed.map(t=>rc(t.i)[0])), cols=new Set(placed.map(t=>rc(t.i)[1]));
    if(rows.size>1 && cols.size>1) return {ok:false, err:'Brickorna måste ligga i en rad'};
    const first=boardEmpty(board);
    if(first && !P.has(C)) return {ok:false, err:'Första ordet måste täcka stjärnan ★'};
    if(first && placed.length<2) return {ok:false, err:'Första ordet behöver minst två bokstäver'};
    // riktning
    let horiz = rows.size===1 && (placed.length>1 || (()=>{ const [r,c]=rc(placed[0].i); return (c>0&&B[placed[0].i-1]) || (c<N-1&&B[placed[0].i+1]); })());
    if(placed.length===1 && !horiz){ const [r,c]=rc(placed[0].i); if(!((r>0&&B[placed[0].i-N])||(r<N-1&&B[placed[0].i+N]))) return {ok:false, err:'Ordet måste sitta ihop med andra brickor'}; }
    const step = horiz?1:N;
    const lineOf = i => horiz ? rc(i)[0] : rc(i)[1];
    const posOf = i => horiz ? rc(i)[1] : rc(i)[0];
    const idxs=placed.map(t=>t.i).sort((a,b)=>a-b);
    for(let i=idxs[0]; i<=idxs[idxs.length-1]; i+=step) if(!B[i]) return {ok:false, err:'Det får inte vara luckor i ordet'};
    if(!first){ const touch=placed.some(t=>{ const [r,c]=rc(t.i); return (r>0&&board[t.i-N])||(r<N-1&&board[t.i+N])||(c>0&&board[t.i-1])||(c<N-1&&board[t.i+1]); });
      if(!touch) return {ok:false, err:'Ordet måste sitta ihop med brickor som redan ligger'}; }
    const wordAt=(i,st)=>{ const isH=st===1; let s=i; while(true){ const [r,c]=rc(s); if(isH ? c===0 : r===0) break; if(!B[s-st]) break; s-=st; }
      const cells=[]; let k=s; while(k<N*N && B[k]){ cells.push(k); const [r,c]=rc(k); if(isH ? c===N-1 : r===N-1) break; k+=st; } return cells; };
    const scoreCells=cells=>{ let sum=0, mul=1; for(const k of cells){ let v=tileVal(B[k]); if(P.has(k)){ const p=PREM[k]; if(p==='l') v*=2; if(p==='L') v*=3; if(p==='w') mul*=2; if(p==='W') mul*=3; } sum+=v; } return sum*mul; };
    const words=[]; const main=wordAt(idxs[0],step);
    if(main.length>=2) words.push(main);
    for(const t of placed){ const cw=wordAt(t.i, horiz?N:1); if(cw.length>=2) words.push(cw); }
    if(!words.length) return {ok:false, err:'Ordet måste vara minst två bokstäver'};
    const out=[]; const bad=[];
    for(const cells of words){ const w=cells.map(k=>low(B[k])).join(''); if(!isWord(w)) bad.push(w); out.push({w, pts:scoreCells(cells), cells}); }
    if(bad.length) return {ok:false, err:`${bad.map(w=>'”'+w.toUpperCase()+'”').join(', ')} finns inte i ordlistan`, words:out, bad};
    let total=out.reduce((a,x)=>a+x.pts,0); const bingo=placed.length===7; if(bingo) total+=40;
    return {ok:true, words:out, total, bingo};
  }
  const rackSum = r => r.reduce((a,l)=>a+(l==='?'?0:(VAL[l]||0)),0);
  function draw(g,s){ while(g.racks[s].length<7 && g.bag.length) g.racks[s].push(g.bag.pop()); g.bagN=g.bag.length; }
  function endGame(g, finisher){
    const n=g.names.length; const rs=g.racks.map(r=>rackSum(r));
    if(finisher!=null){ for(let s=0;s<n;s++) if(s!==finisher){ g.scores[s]-=rs[s]; g.scores[finisher]+=rs[s]; } }
    else for(let s=0;s<n;s++) g.scores[s]-=rs[s];
    g.over=true; const mx=Math.max(...g.scores); g.winner = g.scores.filter(x=>x===mx).length>1 ? -1 : g.scores.indexOf(mx);
  }

  // Ord som datorspelaren aldrig lägger (grova ord, könsord, svordomar, skällsord)
  const CRUDE_SV=[
    /knull|våldt|porno|orgasm|fuck|jävl|jävel|helvet|dildo|bordell|prostitu|blatte|efterbliv|pervers|svartskall|rövhål/,
    /^onan/,
    /^(porr|sperm)/, /arsle(n|t|na|ns|ts|nas|s)?$/,
    /^neger(n|ns|s)?$|^negr(er|erna|ernas|ers|inna|innan|innor)$/,
    /hor(a|an|ans|as|or|orna|ornas|ors)$/, /^kåt(a|are|ast|aste|e|t|het|heten)?$/,
    /^runk(a|ar|ade|at|ande|are|aren|arna|ning)?$/, /^pitt(en|ar|arna|ens|ars)?$/, /^snopp(en|ar|arna|ens|ars|s)?$/,
    /^sly(na|nan|nor|norna|nas)$/, /^slamp(a|an|ans|or|orna|ig|iga|igt)$/, /^lud(er|ret|ren|rens|ers|rets|ren)$/,
    /^röv(en|ens|s)?$/, /^kuk(en|ens|ar|arna|s)?$/, /fitt(a|an|ans|or|orna|ors)$/, /^bög(ar|en|arna|ens|ig|iga|igt|s)?$/
  ];
  const CRUDE_NO=[
    /knull|voldt|porno|orgasm|fuck|(?<!g)jævl|helvet|dildo|bordell|prostitu|pervers|homse|rasshøl|rævhol/,
    /^(porr|onan|dritt|ludder|tispe)/, /^sperm(a|ie|ier|iene|en)?$/,
    /^pikk(en|er|ene|ar|ane|s)?$/, /^kuk(en|er|ene|ar|ane|s)?$/, /^fitte(n|r|ne|ar|ane|s)?$/,
    /^hore|^hor(a|ar|ane|er|ene)$|(luksus|gate)hor/, /^faen$/, /^ræv(en|a|er|ane|ene|s)?$/,
    /^kåt(e|t|ere|est|are|ast|heit|het|heten|heita)?$/, /^neger(en|e|ne|s)?$|^negr(ar|ane|er|ene)$/
  ];
  const crude = w => ((LANG.wiki==='sv') ? CRUDE_SV : CRUDE_NO).some(r=>r.test(w));

  /* ---------- datorspelaren (Appel–Jacobson med DAWG) ---------- */
  function genMoves(g, seat){
    const board=g.board, rack=g.racks[seat]; const cnt={}; for(const l of rack) cnt[l]=(cnt[l]||0)+1;
    const moves=[]; const first=boardEmpty(board);
    for(const horiz of [true,false]){
      const at=(line,pos)=> horiz ? line*N+pos : pos*N+line;
      // korskontroller: vilka bokstäver får ligga i en tom ruta (vinkelrätt ord)
      const cross=new Array(N*N).fill(null);
      for(let i=0;i<N*N;i++){ if(board[i]) continue; const [r,c]=rc(i); const st=horiz?N:1;
        const before=[], after=[]; let k=i; while(true){ const [rr,cc]=rc(k); if(horiz ? rr===0 : cc===0) break; if(!board[k-st]) break; k-=st; before.unshift(low(board[k])); }
        k=i; while(true){ const [rr,cc]=rc(k); if(horiz ? rr===N-1 : cc===N-1) break; if(!board[k+st]) break; k+=st; after.push(low(board[k])); }
        if(!before.length && !after.length){ cross[i]=null; continue; }   // inga grannar: allt går
        let mask=0; let node=1; let okPre=true; for(const ch of before){ const e=edge(node,LI[ch]); if(e<0){ okPre=false; break; } node=D[e]>>>7; }
        if(okPre){ let e=node; if(e) while(true){ const v=D[e], L=v&31; let n2=v>>>7, term=!!(v&32), good=true;
            for(const ch of after){ const e2=edge(n2,LI[ch]); if(e2<0){ good=false; break; } term=!!(D[e2]&32); n2=D[e2]>>>7; }
            if(good && term) mask|=(1<<L); if(v&64) break; e++; } }
        cross[i]=mask; }
      const ok=(i,L)=> cross[i]===null || (cross[i] & (1<<L));
      for(let line=0;line<N;line++){
        // ankarrutor
        const isAnchor=pos=>{ const i=at(line,pos); if(board[i]) return false; if(first) return i===C;
          const [r,c]=rc(i); return (r>0&&board[i-N])||(r<N-1&&board[i+N])||(c>0&&board[i-1])||(c<N-1&&board[i+1]); };
        const placed=[];
        const record=()=>{ moves.push(placed.map(t=>({...t}))); };
        const extend=(node,pos,term,anchorPos)=>{
          if(pos>=N || !board[at(line,pos)]){ if(term && pos>anchorPos && placed.length) record(); }
          if(pos>=N || !node) return;
          const i=at(line,pos);
          if(board[i]){ const e=edge(node,LI[low(board[i])]); if(e>=0) extend(D[e]>>>7,pos+1,!!(D[e]&32),anchorPos); return; }
          let e=node; while(true){ const v=D[e], L=v&31, ch=ALPHA[L-1];
            if(ok(i,L)){
              if(cnt[ch]>0){ cnt[ch]--; placed.push({i,l:ch,b:false}); extend(v>>>7,pos+1,!!(v&32),anchorPos); placed.pop(); cnt[ch]++; }
              if(cnt['?']>0){ cnt['?']--; placed.push({i,l:ch,b:true}); extend(v>>>7,pos+1,!!(v&32),anchorPos); placed.pop(); cnt['?']++; }
            }
            if(v&64) break; e++; }
        };
        const left=(node,limit,anchorPos,startPos)=>{
          extend(node,anchorPos,false,anchorPos);
          if(limit<=0 || !node) return;
          // bygg vänsterdel bakifrån är krångligt – vi bygger framifrån från startPos
        };
        for(let pos=0;pos<N;pos++){
          if(!isAnchor(pos)) continue;
          if(pos>0 && board[at(line,pos-1)]){
            // fast vänsterdel: brickorna som redan ligger till vänster
            let s=pos-1; while(s>0 && board[at(line,s-1)]) s--;
            let node=1, okp=true; for(let k=s;k<pos;k++){ const e=edge(node,LI[low(board[at(line,k)])]); if(e<0){ okp=false; break; } node=D[e]>>>7; }
            if(okp) extend(node,pos,false,pos);
          } else {
            // fri vänsterdel: tomma rutor (som inte är ankare) till vänster
            let limit=0; while(limit<pos && !board[at(line,pos-limit-1)] && !isAnchor(pos-limit-1)) limit++;
            for(let len=0; len<=Math.min(limit,6); len++){
              const start=pos-len;
              const build=(node,p)=>{
                if(p===pos){ extend(node,pos,false,pos); return; }
                if(!node) return;
                const i=at(line,p); let e=node; while(true){ const v=D[e], L=v&31, ch=ALPHA[L-1];
                  if(cnt[ch]>0){ cnt[ch]--; placed.push({i,l:ch,b:false}); build(v>>>7,p+1); placed.pop(); cnt[ch]++; }
                  if(cnt['?']>0){ cnt['?']--; placed.push({i,l:ch,b:true}); build(v>>>7,p+1); placed.pop(); cnt['?']++; }
                  if(v&64) break; e++; }
              };
              build(1,start);
            }
          }
        }
      }
    }
    // poängsätt och ta bort dubbletter
    const seen=new Set(), out=[];
    for(const m of moves){ const key=m.map(t=>t.i+t.l+(t.b?'*':'')).sort().join(','); if(seen.has(key)) continue; seen.add(key);
      const ev=evaluate(board,m); if(ev.ok) out.push({tiles:m, score:ev.total, words:ev.words}); }
    return out;
  }
  function aiMove(g,seat){
    if(!D) return null;
    const lvl=g.ai[seat]; let ms=genMoves(g,seat);
    ms=ms.filter(m=>!m.words.some(x=>crude(x.w)));   // datorn lägger inga grova ord
    if(!ms.length){ if(g.bag.length>=7){ const r=g.racks[seat]; const keep=new Set(['?','e','a','r','s','t','n']); const sw=r.filter(l=>!keep.has(l)); return {type:'swap', letters:(sw.length?sw:r).slice(0,7)}; } return {type:'pass'}; }
    // spara blankbrickor till något bra
    ms.forEach(m=>{ m.v=m.score - (m.tiles.some(t=>t.b) ? (m.score<30?12:4) : 0); });
    ms.sort((a,b)=>b.v-a.v);
    let pick;
    if(lvl==='hard') pick=ms[0];
    else if(lvl==='medium'){ const top=ms.slice(0,Math.max(1,Math.ceil(ms.length*0.12))); pick=top[rint(top.length)]; }
    else { const mid=ms.filter(m=>m.score<=Math.max(8,ms[0].score*0.55)); const pool=(mid.length?mid:ms).slice(0,40); pick=pool[rint(pool.length)]; }
    return {type:'play', tiles:pick.tiles};
  }

  /* ---------- spelet i motorn ---------- */
  GINFO.ordfajt={name:'Ordfajt', icon:'🔤', ai:'Blixt 🤖', max:2, grad:'linear-gradient(135deg,#0ea5e9,#22c55e 55%,#facc15)'};
  KIND.ordfajt={
    init(){ // nytt spel från menyn: menyns val; annars (start online, returmatch) samma språk och listor som förut
      const base = !ofFresh && G && G.kind==='ordfajt' && LANGS[G.lang] ? G : null; ofFresh=false;
      const lang = base ? base.lang : ofLang; useLang(lang);
      return {lang, board:new Array(N*N).fill(''), racks:[[],[]], bag:[], bagN:0, scores:[0,0], zeros:0, log:[], extra: base && base.extra ? clone(base.extra) : pendingExtra()}; },
    start(g){ if(!LANGS[g.lang]) g.lang='sv'; useLang(g.lang); const n=g.names.length; g.board=new Array(N*N).fill(''); g.bag=bagNew(); g.racks=g.names.map(()=>[]); g.scores=g.names.map(()=>0); g.zeros=0; g.log=[]; g.last=null;
      if(!g.extra || !g.extra.words) g.extra=pendingExtra();
      for(let s=0;s<n;s++) draw(g,s); g.cur=g.starter%n; setExtra(g); },
    redact(g,seat){ g.racks=g.racks.map((r,s)=> s===seat ? r : r.map(()=>'')); g.bagN=g.bag.length; g.bag=[]; },
    valid(g){ const n=g.names.length; const waiting=g.started===false;
      if(!LANGS[g.lang]) return false; useLang(g.lang);
      return n>=1 && n<=2 && (waiting||n===2) && Array.isArray(g.board) && g.board.length===N*N && g.board.every(x=>x==='' || isL(x))
        && Array.isArray(g.racks) && g.racks.every(r=>Array.isArray(r) && r.length<=7 && r.every(l=>l===''||l==='?'||(isL(l)&&l===l.toLowerCase())))
        && Array.isArray(g.bag) && g.bag.length<=110 && g.bag.every(l=>l==='?'||isL(l)) && Array.isArray(g.scores) && g.scores.every(x=>Number.isInteger(x)&&Math.abs(x)<10000)
        && Array.isArray(g.log) && g.log.length<=400 && (!g.extra || (Array.isArray(g.extra.words) && g.extra.words.length<=10000 && g.extra.words.every(w=>typeof w==='string' && w.length>=2 && w.length<=15 && [...w].every(c=>LI[c])) && Array.isArray(g.extra.names) && g.extra.names.length<=20 && g.extra.names.every(x=>typeof x==='string'&&x.length<=40))); },
    waitingFor(g){ return g.cur; },
    scoreOf(g,i){ return `${g.scores[i]} p`; },
    apply(g,a,seat){
      if(g.over || seat!==g.cur) return false;
      const n=g.names.length, rack=g.racks[seat];
      if(a.type==='resign'){ g.over=true; g.winner=(seat+1)%n; g.log.push({s:seat,t:'resign',at:Date.now()}); g.last={seat,t:Date.now(),type:'resign'}; return true; }
      if(a.type==='pass'){ g.zeros++; g.log.push({s:seat,t:'pass',at:Date.now()}); g.last={seat,t:Date.now(),type:'pass'}; if(g.zeros>=6) endGame(g,null); else g.cur=(seat+1)%n; return true; }
      if(a.type==='swap'){
        if(!Array.isArray(a.letters) || !a.letters.length || a.letters.length>7 || g.bag.length<7) return false;
        const r=rack.slice(); for(const l of a.letters){ const k=r.indexOf(l); if(k<0) return false; r.splice(k,1); }
        g.racks[seat]=r; draw(g,seat); g.bag.push(...a.letters); for(let i=g.bag.length-1;i>0;i--){ const j=rint(i+1); [g.bag[i],g.bag[j]]=[g.bag[j],g.bag[i]]; } g.bagN=g.bag.length;
        g.zeros++; g.log.push({s:seat,t:'swap',k:a.letters.length,at:Date.now()}); g.last={seat,t:Date.now(),type:'swap'};
        if(g.zeros>=6) endGame(g,null); else g.cur=(seat+1)%n; return true; }
      if(a.type!=='play' || !Array.isArray(a.tiles) || !a.tiles.length || a.tiles.length>7) return false;
      if(!D){ loadDict(g.lang); return false; }
      const tiles=a.tiles.map(t=>({i:t.i|0, l:String(t.l||'').toLowerCase(), b:!!t.b}));
      if(new Set(tiles.map(t=>t.i)).size!==tiles.length || tiles.some(t=>t.i<0||t.i>=N*N||!LI[t.l])) return false;
      const r=rack.slice(); for(const t of tiles){ const need=t.b?'?':t.l; const k=r.indexOf(need); if(k<0) return false; r.splice(k,1); }
      setExtra(g);
      const ev=evaluate(g.board,tiles); if(!ev.ok) return false;
      for(const t of tiles) g.board[t.i]= t.b ? t.l.toUpperCase() : t.l;
      g.racks[seat]=r; g.scores[seat]+=ev.total; g.zeros=0; draw(g,seat);
      const entry={s:seat,t:'play',w:ev.words.map(x=>x.w),p:ev.total,bingo:ev.bingo,tiles:tiles.map(t=>t.i),at:Date.now()};
      g.log.push(entry); if(g.log.length>400) g.log=g.log.slice(-400);
      g.last={seat,t:entry.at,type:'play',tiles:entry.tiles,p:ev.total,w:entry.w,bingo:ev.bingo};
      if(!g.racks[seat].length && !g.bag.length) endGame(g,seat); else g.cur=(seat+1)%n;
      return true;
    },
    aiSeat(g){ return !g.over && isAI(g.cur) ? g.cur : null; },
    aiDelay(){ return 900; },
    ai(g,seat){ setExtra(g); if(!D){ loadDict(g.lang).then(()=>{ if(typeof gMaybeAI==='function') gMaybeAI(); }); return null; } setExtra(g); return aiMove(g,seat) || {type:'pass'}; },
    effects(prev,d){ if(d.last && (!prev.last || prev.last.t!==d.last.t)){ if(d.last.type==='play'){ d.last.bingo ? (sfx.yatzy(), sparkles(30)) : sfx.pick(); if(d.last.seat!==meSeat()) toast(`${pname(d.last.seat)}: ${d.last.w.map(w=>w.toUpperCase()).join(', ')} – ${d.last.p} p${d.last.bingo?' (+40 alla brickor!)':''}`,3000); }
      else if(d.last.seat!==meSeat()) toast(`${pname(d.last.seat)} ${d.last.type==='swap'?'bytte brickor':d.last.type==='pass'?'stod över':'gav upp'}`,2200); }
      if(!prev.over && d.over) ofDraft=null; },
    html(){ return ofHTML(); },
    mounted(){ ofMounted(); }
  };
  function setExtra(g){ useLang(g.lang); EXTRA=new Set((g.extra&&g.extra.words)||[]); }

  /* ---------- tilläggsordlistor ---------- */
  const listsLoad = () => { try{ const v=JSON.parse(lsGet('of_lists')); return Array.isArray(v)?v:[]; }catch(e){ return []; } };
  const listsSave = v => lsSet('of_lists', JSON.stringify(v));
  let chosenLists=new Set();
  function pendingExtra(){ const L=listsLoad().filter(l=>chosenLists.has(l.id)); const words=[...new Set(L.flatMap(l=>l.words))].filter(w=>[...w].every(c=>LI[c])).slice(0,10000); return {names:L.map(l=>l.name).slice(0,20), words}; }
  const parseWords = t => [...new Set(String(t||'').toLowerCase().split(/[\s,;.]+/).map(w=>w.trim()).filter(w=>/^[a-zåäöæø]{2,15}$/.test(w)))].slice(0,5000);
  function listsHTML(){
    const L=listsLoad();
    return `<h3>📚 Mina ordlistor</h3><p>Egna ord som inte finns i den vanliga ordlistan – namn, påhittade familjeord, slang. Välj sedan vilka listor som ska gälla när ett spel startar.</p>
      ${L.length?L.map(l=>`<div class="of-li"><div><b>${esc(l.name)}</b><small>${l.words.length} ord: ${esc(l.words.slice(0,8).join(', '))}${l.words.length>8?'…':''}</small></div><button data-of="editlist" data-id="${l.id}">✏️</button><button data-of="dellist" data-id="${l.id}">🗑</button></div>`).join(''):'<p class="setnote">Inga egna ordlistor än.</p>'}
      <div class="btns"><button data-of="menu">Tillbaka</button><button class="pri" data-of="newlist">＋ Ny ordlista</button></div>`;
  }
  function listEditHTML(l){
    return `<h3>${l?'✏️ Ändra':'＋ Ny'} ordlista</h3><label>Namn</label><input id="ofLN" maxlength="40" value="${esc(l?l.name:'')}" placeholder="t.ex. Familjens ord">
      <label>Ord (ett per rad, eller med mellanslag)</label><textarea id="ofLW" rows="8" style="width:100%" placeholder="mormorsbulle&#10;tindra&#10;delfinsimma">${esc(l?l.words.join('\n'):'')}</textarea>
      <div class="setnote">Bokstäverna a–ö (och æ, ø för norska), 2–15 bokstäver per ord. Böjningar räknas inte automatiskt – skriv med t.ex. både ”glassbåt” och ”glassbåten”.</div>
      <div class="btns"><button data-of="lists">Avbryt</button><button class="pri" data-of="savelist" data-id="${l?l.id:''}">Spara</button></div>`;
  }

  /* ---------- meny ---------- */
  let ofFresh=false;
  let ofLevel='medium', ofLang=LANGS[lsGet('of_lang')]?lsGet('of_lang'):'sv';
  window.showOrdfajtMenu=function(){
    useLang(ofLang); loadDict(ofLang).catch(()=>{});
    const L=listsLoad(); chosenLists=new Set([...chosenLists].filter(id=>L.some(l=>l.id===id)));
    openModal(`<h3>🔤 Ordfajt</h3><p>Lägg ord på brädet som i ett korsord. Bonusrutorna ger dubbla och tredubbla poäng – använd alla sju brickor för +40!</p>
      <label>Ditt namn</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
      <label>Språk</label><div class="seg of-lang" id="ofLang">${langHTML()}</div>
      ${LANGS[ofLang].jam?`<div class="setnote">🫎 Jamska spelas med den svenska ordlistan plus dina jamska ordlistor – välj dem nedan. (Orlboka får inte läggas in utan tillstånd från Bo Oscarsson.)</div>`:''}
      <label>Tilläggsordlistor i spelet</label>
      ${L.length?`<div class="of-chips">${L.map(l=>`<button data-of="pick" data-id="${l.id}" class="${chosenLists.has(l.id)?'sel':''}">${chosenLists.has(l.id)?'✅':'⬜'} ${esc(l.name)} <small>${l.words.length}</small></button>`).join('')}</div>`:'<div class="setnote">Inga egna listor – bara den vanliga ordlistan används.</div>'}
      <button class="of-link" data-of="lists">📚 Mina ordlistor</button>
      <label>Datorns nivå</label><div class="seg" id="ofLvl">${lvlHTML()}</div>
      <div class="btns" style="flex-direction:column"><button class="pri" data-of="ai">🤖 Spela mot datorn</button>
        <button class="pri" data-of="host" style="background:linear-gradient(135deg,#f472b6,#a855f7)">🚀 Bjud in en kompis (online)</button>
        <button data-act="close">Avbryt</button></div>
      <div class="setnote" style="margin-top:10px">Ordlistor med alla böjningsformer: svenska från Den Stora Svenska Ordlistan (DSSO, följer svensk rättstavning), norska från spell-norwegian. Långtryck på ett ord för betydelse och synonymer.</div>`,'ofmenu');
  };
  const langHTML = () => Object.entries(LANGS).map(([k,L])=>`<button data-of="lang" data-l="${k}" class="${ofLang===k?'sel':''}">${L.flag} ${L.name}</button>`).join('');
  const lvlHTML = () => [['easy','🐣 Lätt'],['medium','🙂 Medel'],['hard','🧠 Svår']].map(([k,l])=>`<button data-of="lvl" data-l="${k}" class="${ofLevel===k?'sel':''}">${l}</button>`).join('');

  /* ---------- utseende ---------- */
  let ofDraft=null;   // {gid, placed:[{i,l,b,ri}], sel:ri|null, order:[ri...]}
  function draft(){
    const me=meSeat(), rack=(G.racks[me]||[]);
    if(!ofDraft || ofDraft.gid!==G.id+':'+G.seq || ofDraft.len!==rack.length){
      const keepOrder = ofDraft && ofDraft.gid.startsWith(G.id+':') && ofDraft.order.length===rack.length ? ofDraft.order : rack.map((_,i)=>i);
      ofDraft={gid:G.id+':'+G.seq, len:rack.length, placed:[], sel:null, order:keepOrder};
    }
    return ofDraft;
  }
  function ofHTML(){
    setExtra(G); if(!D) loadDict(G.lang).then(()=>{ if(G && G.kind==='ordfajt' && view==='game') render(); }).catch(()=>{});
    const g=G, me=meSeat(), myTurn=canActG(me) && g.cur===me && !g.over;
    const d=draft(), rack=g.racks[me]||[];
    if(!myTurn && d.placed.length){ d.placed=[]; d.sel=null; }
    const P=new Map(d.placed.map(t=>[t.i,t]));
    const lastSet=new Set(g.last&&g.last.type==='play'?g.last.tiles:[]);
    let cells='';
    for(let i=0;i<N*N;i++){
      const t=g.board[i], p=P.get(i), pr=PREM[i];
      if(t){ cells+=`<div class="of-c of-t ${lastSet.has(i)?'last':''}" data-cell="${i}" data-on="1"><b>${low(t).toUpperCase()}</b><i>${tileVal(t)||''}</i></div>`; }
      else if(p){ cells+=`<div class="of-c of-t pend" data-cell="${i}" data-pend="1"><b>${p.l.toUpperCase()}</b><i>${p.b?'':VAL[p.l]}</i></div>`; }
      else cells+=`<div class="of-c ${pr!=='.'?'p'+(pr==='*'?'s':pr):''}" data-cell="${i}">${pr!=='.'?`<span>${PLABEL[pr]}</span>`:''}</div>`;
    }
    const used=new Set(d.placed.map(t=>t.ri));
    const rackHTML=d.order.map(ri=>{ const l=rack[ri]; if(used.has(ri)||l===undefined) return `<div class="of-r empty"></div>`;
      return `<div class="of-r of-t ${d.sel===ri?'sel':''}" data-ri="${ri}"><b>${l==='?'?'':l.toUpperCase()}</b><i>${l==='?'?'':VAL[l]}</i></div>`; }).join('');
    let preview='', canPlay=false;
    if(d.placed.length){ setExtra(g); if(D){ const ev=evaluate(g.board,d.placed); if(ev.ok){ preview=`${ev.words.map(w=>w.w.toUpperCase()).join(', ')} · ${ev.total} p${ev.bingo?' 🎉':''}`; canPlay=true; } else preview=`<span class="bad">${esc(ev.err)}</span>`; } else { preview='Laddar ordlistan…'; } }
    const other=(me+1)%2;
    const head=`<div class="of-head">${g.names.map((n,s)=>`<div class="gp ${!g.over&&g.cur===s?'on':''} ${g.over&&g.winner===s?'win':''}"><span>${g.over&&g.winner===s?'👑 ':''}${esc(bare(n))}${isAI(s)?' 🤖':''}${mode==='online'&&s===mySeat?' <em>du</em>':''}</span><b>${g.scores[s]} p</b></div>`).join('')}
      <div class="of-bag" title="Brickor kvar i påsen">👜 ${g.bag.length||g.bagN||0}</div></div>`;
    let sub;
    if(g.over) sub='';
    else if(myTurn) sub = preview || 'Din tur – tryck på en bricka och sedan på en ruta (eller dra)';
    else sub=`${isAI(g.cur)?'🤖 ':''}<b>${esc(pname(g.cur))}</b> funderar…`;
    const extra = `<div class="of-extra">${LANG.flag} ${LANG.name}${g.extra && g.extra.names && g.extra.names.length ? ` · 📚 ${esc(g.extra.names.join(', '))}`:''}</div>`;
    const lastLog=(g.log||[]).slice(-6).reverse().map(e=>`<div class="of-lg"><b>${esc(bare(g.names[e.s]))}</b> ${e.t==='play'?`${e.w.map(w=>`<button data-of="look" data-w="${esc(w)}">${esc(w.toUpperCase())}</button>`).join(' ')} <span>${e.p} p</span>`:e.t==='swap'?'bytte brickor':e.t==='pass'?'stod över':'gav upp'}</div>`).join('');
    return head + `<div class="gsub of-sub">${sub}</div>
      <div class="of-wrap"><div class="of-board" id="ofBoard">${cells}</div></div>
      ${g.over ? gOverHTML(g.winner===-1?'Oavgjort!':`${g.scores.join(' – ')} poäng`) : `
      <div class="of-rack ${myTurn?'':'off'}" id="ofRack">${rackHTML}</div>
      <div class="of-btns">${myTurn?`<button data-of="shuffle" title="Blanda">🔀</button><button data-of="recall" title="Ta tillbaka" ${d.placed.length?'':'disabled'}>↩️</button><button data-of="swap" title="Byt brickor" ${g.bag.length>=7||g.bagN>=7?'':'disabled'}>⇄</button><button data-of="pass" title="Stå över">⏭️</button><button class="pri" data-of="play" ${canPlay?'':'disabled'}>Spela</button>`:`<button data-of="shuffle">🔀 Blanda</button>`}</div>`}
      ${extra}<div class="of-log">${lastLog||'<div class="of-lg m">Inga drag än</div>'}</div>
      <div class="ghint">Håll fingret på ett ord på brädet för betydelse och synonymer. ${g.over?'':'<button class="of-link" data-of="resign">Ge upp</button>'}</div>`;
  }
  function ofMounted(){ fitBoard(); }
  function fitBoard(){ const b=document.getElementById('ofBoard'); if(!b) return; const w=b.clientWidth; b.style.setProperty('--cs', (w/N)+'px'); }
  window.addEventListener('resize',()=>{ if(G && G.kind==='ordfajt' && view==='game') fitBoard(); });

  /* ---------- placering: tryck eller dra ---------- */
  function placeAt(i, ri){
    const g=G, me=meSeat(), d=draft(), l=g.racks[me][ri];
    if(g.board[i] || d.placed.some(t=>t.i===i) || d.placed.some(t=>t.ri===ri)) return;
    if(l==='?'){ askBlank(ch=>{ d.placed.push({i,l:ch,b:true,ri}); d.sel=null; sfx.bubble(); render(); }); return; }
    d.placed.push({i,l,b:false,ri}); d.sel=null; sfx.bubble(); render();
  }
  function askBlank(cb){
    openModal(`<h3>⬜ Vilken bokstav ska den tomma brickan vara?</h3><div class="of-blank">${[...ALPHA].map(c=>`<button data-of="blank" data-l="${c}">${c.toUpperCase()}</button>`).join('')}</div><div class="btns"><button data-act="close">Avbryt</button></div>`,'ofblank');
    blankCb=cb;
  }
  let blankCb=null, drag=null, pressT=null;
  document.addEventListener('pointerdown',e=>{
    if(!G || G.kind!=='ordfajt' || view!=='game') return;
    const r=e.target.closest('#ofRack .of-r.of-t');
    if(r && canActG(meSeat()) && G.cur===meSeat()){ drag={ri:+r.dataset.ri, x:e.clientX, y:e.clientY, moved:false, el:r, ghost:null}; return; }
    // långtryck på en lagd bricka: slå upp ordet
    const c=e.target.closest('.of-c[data-on]');
    if(c){ const i=+c.dataset.cell; clearTimeout(pressT); pressT=setTimeout(()=>{ pressT=null; buzz(20); lookupAt(i); },480); }
  });
  document.addEventListener('pointermove',e=>{
    if(pressT && (Math.abs(e.movementX)>3||Math.abs(e.movementY)>3)){ clearTimeout(pressT); pressT=null; }
    if(!drag) return;
    if(!drag.moved && Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7){ drag.moved=true; const gh=drag.el.cloneNode(true); gh.className='of-r of-t ghost'; document.body.appendChild(gh); drag.ghost=gh; drag.el.style.opacity='.3'; }
    if(drag.ghost){ drag.ghost.style.left=e.clientX+'px'; drag.ghost.style.top=e.clientY+'px';
      document.querySelectorAll('.of-c.hov').forEach(x=>x.classList.remove('hov')); const t=document.elementFromPoint(e.clientX,e.clientY)?.closest('.of-c'); if(t && !t.dataset.on && !t.dataset.pend) t.classList.add('hov'); }
  });
  document.addEventListener('pointerup',e=>{
    clearTimeout(pressT); pressT=null;
    if(!drag) return; const dd=drag; drag=null;
    if(dd.ghost){ dd.ghost.remove(); dd.el.style.opacity=''; document.querySelectorAll('.of-c.hov').forEach(x=>x.classList.remove('hov'));
      const t=document.elementFromPoint(e.clientX,e.clientY)?.closest('.of-c'); if(t && !t.dataset.on && !t.dataset.pend) placeAt(+t.dataset.cell, dd.ri); else render(); dd.suppress=true; window.__ofSuppress=Date.now(); }
  });
  document.addEventListener('pointercancel',()=>{ if(drag&&drag.ghost){ drag.ghost.remove(); drag.el.style.opacity=''; } drag=null; clearTimeout(pressT); pressT=null; });

  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-of],.of-r.of-t,.of-c'); if(!b) return;
    if(Date.now()-(window.__ofSuppress||0)<250) return;   // nyss släppt efter dragning
    // menyknappar fungerar även utanför spelet
    const a=b.dataset.of;
    if(a){
      switch(a){
        case 'lang': ofLang=b.dataset.l; lsSet('of_lang',ofLang); sfx.bubble(); showOrdfajtMenu(); return;
        case 'lvl': ofLevel=b.dataset.l; document.getElementById('ofLvl').innerHTML=lvlHTML(); sfx.bubble(); return;
        case 'pick': { const id=b.dataset.id; chosenLists.has(id)?chosenLists.delete(id):chosenLists.add(id); showOrdfajtMenu(); return; }
        case 'lists': openModal(listsHTML(),'oflists'); return;
        case 'menu': showOrdfajtMenu(); return;
        case 'newlist': openModal(listEditHTML(null),'ofedit'); return;
        case 'editlist': { const l=listsLoad().find(x=>x.id===b.dataset.id); openModal(listEditHTML(l),'ofedit'); return; }
        case 'dellist': { if(!b.dataset.sure){ b.dataset.sure=1; b.textContent='Säker?'; return; } listsSave(listsLoad().filter(x=>x.id!==b.dataset.id)); chosenLists.delete(b.dataset.id); openModal(listsHTML(),'oflists'); return; }
        case 'savelist': { const name=(document.getElementById('ofLN')?.value||'').trim().slice(0,40); const words=parseWords(document.getElementById('ofLW')?.value);
          if(!name){ toast('Ge listan ett namn ✏️'); return; } if(!words.length){ toast('Skriv minst ett ord (2–15 bokstäver a–ö)'); return; }
          const L=listsLoad(); const id=b.dataset.id||Math.random().toString(36).slice(2,10); const i=L.findIndex(x=>x.id===id);
          if(i>=0) L[i]={id,name,words}; else L.push({id,name,words}); listsSave(L); chosenLists.add(id); toast(`${name}: ${words.length} ord sparade 📚`); openModal(listsHTML(),'oflists'); return; }
        case 'ai': { const n=(document.getElementById('nm')?.value||'').trim()||'Du'; lsSet('ry_name',n); unlockAudio();
          try{ useLang(ofLang); await loadDict(ofLang); }catch(err){ toast('Ordlistan kunde inte laddas – har du internet? 📡',4000); return; }
          ofFresh=true; startGameLocal('ordfajt', n, ofLevel, 1); return; }
        case 'host': { const n=(document.getElementById('nm')?.value||'').trim(); if(!n){ toast('Skriv ditt namn 🐬'); return; } lsSet('ry_name',n); unlockAudio(); closeModal();
          useLang(ofLang); loadDict(ofLang).catch(()=>{}); ofFresh=true; hostGame(n,'free','ordfajt'); return; }
        case 'blank': { closeModal(); const cb=blankCb; blankCb=null; cb && cb(b.dataset.l); return; }
        case 'look': lookup([b.dataset.w]); return;
      }
      if(!G || G.kind!=='ordfajt') return;
      const me=meSeat(), d=draft();
      switch(a){
        case 'shuffle': for(let i=d.order.length-1;i>0;i--){ const j=rint(i+1); [d.order[i],d.order[j]]=[d.order[j],d.order[i]]; } sfx.roll(); render(); return;
        case 'recall': d.placed=[]; d.sel=null; render(); return;
        case 'play': { const ev=evaluate(G.board,d.placed); if(!ev.ok){ toast(ev.err,3000); return; } const tiles=d.placed.map(t=>({i:t.i,l:t.l,b:t.b})); d.placed=[]; doAct({type:'play', tiles}); return; }
        case 'pass': if(!b.dataset.sure){ b.dataset.sure=1; b.textContent='Säker?'; return; } d.placed=[]; doAct({type:'pass'}); return;
        case 'resign': if(!b.dataset.sure){ b.dataset.sure=1; b.textContent='Säker? Tryck igen'; return; } doAct({type:'resign'}); return;
        case 'swap': { const r=G.racks[me]; openModal(`<h3>⇄ Byt brickor</h3><p>Välj vilka brickor du vill lämna tillbaka. Det kostar din tur.</p><div class="of-rack in">${r.map((l,i)=>`<div class="of-r of-t" data-sw="${i}"><b>${l==='?'?'':l.toUpperCase()}</b><i>${l==='?'?'':VAL[l]}</i></div>`).join('')}</div>
            <div class="btns"><button data-act="close">Avbryt</button><button class="pri" data-of="doswap">Byt</button></div>`,'ofswap'); return; }
        case 'doswap': { const sel=[...document.querySelectorAll('[data-sw].sel')].map(x=>G.racks[me][+x.dataset.sw]); if(!sel.length){ toast('Välj minst en bricka'); return; } closeModal(); d.placed=[]; doAct({type:'swap', letters:sel}); return; }
      }
      return;
    }
    if(!G || G.kind!=='ordfajt' || view!=='game') return;
    if(b.dataset.sw!==undefined){ b.classList.toggle('sel'); return; }
    const me=meSeat(); if(!(canActG(me) && G.cur===me)) return;
    const d=draft();
    if(b.classList.contains('of-r') && b.dataset.ri!==undefined){ const ri=+b.dataset.ri; d.sel = d.sel===ri ? null : ri; sfx.bubble(); render(); return; }
    if(b.classList.contains('of-c')){
      const i=+b.dataset.cell;
      if(b.dataset.pend){ d.placed=d.placed.filter(t=>t.i!==i); sfx.unbubble(); render(); return; }
      if(!b.dataset.on && d.sel!==null) placeAt(i,d.sel);
    }
  });

  /* ---------- betydelse och synonymer ---------- */
  function wordsAt(i){
    const g=G, out=[];
    for(const st of [1,N]){ let s=i; while(true){ const [r,c]=rc(s); if(st===1?c===0:r===0) break; if(!g.board[s-st]) break; s-=st; }
      const cells=[]; let k=s; while(k<N*N && g.board[k]){ cells.push(k); const [r,c]=rc(k); if(st===1?c===N-1:r===N-1) break; k+=st; }
      if(cells.length>=2) out.push(cells.map(x=>low(g.board[x])).join('')); }
    return out;
  }
  function lookupAt(i){ const ws=wordsAt(i); if(ws.length) lookup(ws); }
  const LCACHE=new Map();
  function lookup(words){
    words=[...new Set(words)];
    const card=w=>`<div class="of-look" data-w="${esc(w)}"><h3>${esc(w.toUpperCase())}</h3>
      <div class="of-src">${EXTRA.has(w)&&!inDawg(w)?'📚 Från en tilläggsordlista':'✔️ Finns i ordlistan ('+esc(LANG.name)+')'}</div>
      <div class="of-def" id="ofDef_${esc(w)}">⏳ Hämtar betydelse…</div>
      <div class="of-links">${LANG.look(w).map(([t,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener">${t} ↗</a>`).join(' ')}</div></div>`;
    openModal(words.map(card).join('<hr class="of-hr">')+`<div class="btns"><button class="pri" data-act="close">Klar</button></div>`,'oflook');
    words.forEach(async w=>{ const el=()=>document.getElementById('ofDef_'+w); try{ const r=await wiki(w); const x=el(); if(x) x.innerHTML=r; }catch(e){ const x=el(); if(x) x.innerHTML='<span class="m">Kunde inte hämta betydelsen just nu (kräver internet).</span>'; } });
  }
  // Svenska Wiktionary (CC BY-SA). Böjda former följer vi till grundformen.
  async function wiki(word){
    const L=LANG, key=L.wiki+':'+word;
    if(LCACHE.has(key)) return LCACHE.get(key);
    const fetchPages=async titles=>{ const u='https://'+L.wiki+'.wiktionary.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&origin=*&titles='+encodeURIComponent(titles.join('|'));
      const r=await fetch(u); if(!r.ok) throw new Error('wiki'); const j=await r.json(); const m={}; (j.query&&j.query.pages||[]).forEach(p=>{ if(p.revisions) m[p.title]=p.revisions[0].slots.main.content; }); return m; };
    // språkavsnittet (== Svenska == osv.); hittas inget rubrikmönster används hela sidan
    const sweSection=t=>{ const hs=[...t.matchAll(/^==([^=\n][^\n]*?)==\s*$/gm)];
      if(!hs.length) return t;
      for(let k=0;k<hs.length;k++){ const name=hs[k][1].replace(/\{\{|\}\}/g,'').trim(); if(L.sec.test(name)) return t.slice(hs[k].index+hs[k][0].length, k+1<hs.length?hs[k+1].index:t.length); }
      return ''; };
    const clean=s=>s.replace(/\{\{[^{}]*\}\}/g,m=>{ const p=m.slice(2,-2).split('|'); const n=p[0].trim(); if(/^(tagg|kontext|uttal|kat|ö-|böjning|sv-|ipa)/i.test(n)) return ''; return ''; })
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g,'$1').replace(/'''?/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
    const parse=t=>{ const sec=sweSection(t); if(!sec) return null;
      const defs=[], syns=new Set(); let lemma=null;
      const bm=/\{\{(?:böjning|böjningsform)[^}]*?\|(?:sv|nb|nn|no)\|[^|}]*\|([^|}]+)/i.exec(sec) || /(?:böjningsform|bøyningsform|bøyingsform) av \[\[([^\]|]+)/i.exec(sec) || /\{\{(?:sv|nb|nn|no)-[^}]*?\|grundform=([^|}]+)/i.exec(sec);
      if(bm) lemma=bm[1].trim();
      for(const line of sec.split('\n')){
        if(/^#[^:*]/.test(line)){ const d=clean(line.replace(/^#+/,'')); if(d && !/^(böjningsform|bøyningsform|bøyingsform)/i.test(d)) defs.push(d); }
        const sm=line.match(/\{\{(?:synonymer|syn)\|([^}]*)\}\}/i); if(sm) sm[1].split('|').forEach(x=>{ x=x.trim(); if(x && !x.includes('=') && x!=='sv') syns.add(clean('[['+x+']]')); });
        if(/^#:\s*synonym/i.test(line)) clean(line.replace(/^#:\s*synonymer?:?/i,'')).split(/[,;]/).forEach(x=>{ x=x.trim(); if(x) syns.add(x); });
      }
      return {defs:defs.slice(0,6), syns:[...syns].slice(0,14), lemma}; };
    // prova ordet, och ordet utan vanliga ändelser (huset → hus, katterna → katt)
    const ends=L.ends;
    const cands=[word]; for(const e of ends) if(word.endsWith(e) && word.length-e.length>=2) cands.push(word.slice(0,-e.length));
    let pages=await fetchPages([...new Set(cands)].slice(0,12)), hit=null, title=null;
    for(const c of cands){ if(!pages[c]) continue; const r=parse(pages[c]); if(r && r.defs.length){ hit=r; title=c; break; }
      if(r && r.lemma){ const p2=await fetchPages([r.lemma]); const r2=p2[r.lemma] && parse(p2[r.lemma]); if(r2 && r2.defs.length){ hit=r2; title=r.lemma; break; } } }
    let html;
    if(!hit) html=`<span class="m">Wiktionary har ingen förklaring av ”${esc(word)}” än. Prova länken nedan.</span>`;
    else html=`${title!==word?`<div class="m">Grundform: <b>${esc(title)}</b></div>`:''}<ol>${hit.defs.map(d=>`<li>${esc(d)}</li>`).join('')}</ol>
      ${hit.syns.length?`<div class="of-syn"><b>Synonymer:</b> ${hit.syns.map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:''}
      <div class="of-cc">Källa: <a href="https://${L.wiki}.wiktionary.org/wiki/${encodeURIComponent(title)}" target="_blank" rel="noopener">Wiktionary</a> (CC BY-SA 4.0)</div>`;
    LCACHE.set(key,html); return html;
  }

  /* ---------- stil ---------- */
  const st=document.createElement('style'); st.textContent=`
.of-head{display:flex;gap:6px;align-items:stretch;margin:2px 0 4px}.of-head .gp{flex:1}
.of-bag{flex:none;display:grid;place-items:center;padding:0 10px;border-radius:16px;background:var(--glass);border:1px solid var(--line);font-weight:700;font-size:14px}
.of-sub{min-height:22px;font-size:14.5px}.of-sub .bad{color:#fca5a5}
.of-wrap{width:100%;max-width:min(620px,100%,calc(100dvh - 300px));margin:0 auto}
.of-board{--cs:24px;display:grid;grid-template-columns:repeat(15,minmax(0,1fr));grid-template-rows:repeat(15,minmax(0,1fr));gap:1.5px;padding:3px;border-radius:12px;background:#0b1530;aspect-ratio:1;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.of-c{position:relative;min-width:0;min-height:0;border-radius:3px;background:#1e2a4a;display:grid;place-items:center;font-size:calc(var(--cs)*.32);font-weight:700;color:rgba(255,255,255,.8);overflow:hidden}
.of-c span{pointer-events:none;letter-spacing:-.5px}
.of-c.pW{background:#c2410c}.of-c.pw{background:#be185d}.of-c.pL{background:#1d4ed8}.of-c.pl{background:#0e7490}.of-c.ps{background:#7c3aed;font-size:calc(var(--cs)*.55)}
.of-c.hov{outline:2px solid #facc15;outline-offset:-2px}
.of-t{background:linear-gradient(160deg,#fff7d6,#f5d98b)!important;color:#3b2a06!important;box-shadow:inset 0 -2px 0 rgba(0,0,0,.18)}
.of-t b{font-size:calc(var(--cs)*.62);line-height:1;font-weight:800}
.of-t i{position:absolute;right:2px;bottom:1px;font-style:normal;font-size:calc(var(--cs)*.28);font-weight:700;opacity:.8}
.of-c.of-t.last{box-shadow:inset 0 0 0 2px #22c55e,inset 0 -2px 0 rgba(0,0,0,.18)}
.of-c.of-t.pend{background:linear-gradient(160deg,#fef9c3,#fde047)!important;box-shadow:0 0 0 2px #facc15}
.of-rack{display:flex;gap:6px;justify-content:center;margin:12px auto 8px;max-width:440px}
.of-rack.off{opacity:.75}
.of-r{width:min(13vw,52px);aspect-ratio:1;border-radius:9px;position:relative;display:grid;place-items:center;--cs:min(13vw,52px);touch-action:none}
.of-r.empty{border:2px dashed rgba(148,163,184,.25)}
.of-r.of-t.sel{transform:translateY(-6px);box-shadow:0 0 0 3px #22d3ee,0 6px 14px rgba(0,0,0,.4)}
.of-r.of-t.ghost{position:fixed;z-index:4000;pointer-events:none;transform:translate(-50%,-80%) scale(1.1);box-shadow:0 10px 24px rgba(0,0,0,.5)}
.of-rack.in{flex-wrap:wrap}.of-rack.in .of-r.sel{box-shadow:0 0 0 3px #ef4444;transform:translateY(-4px)}
.of-btns{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
.of-btns button{min-width:48px;padding:11px 12px;border-radius:14px;background:var(--glass2);border:1px solid var(--line);font-size:18px}
.of-btns button.pri{flex:1;max-width:180px;font-size:16px;font-weight:700;background:linear-gradient(135deg,#22c55e,#0ea5e9);border:0}
.of-btns button:disabled{opacity:.35}
.of-extra{text-align:center;font-size:13px;margin:8px 0;opacity:.85}
.of-log{max-width:520px;margin:10px auto;display:flex;flex-direction:column;gap:4px}
.of-lg{font-size:13.5px;padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.05)}.of-lg.m{opacity:.6;text-align:center}
.of-lg button{font-weight:700;color:var(--aqua);text-decoration:underline;text-underline-offset:2px;font-size:13.5px}.of-lg span{opacity:.75;margin-left:4px}
.of-link{color:var(--aqua);text-decoration:underline;font-size:13px;background:none;border:0;padding:4px}
.of-chips{display:flex;flex-wrap:wrap;gap:6px}.of-chips button{padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:rgba(0,0,0,.2);font-size:14px}.of-chips button.sel{border-color:#22c55e;background:rgba(34,197,94,.15)}
.of-chips small{opacity:.6;margin-left:4px}
.of-li{display:flex;gap:8px;align-items:center;padding:10px 12px;border-radius:14px;background:rgba(0,0,0,.22);margin:6px 0}.of-li div{flex:1;min-width:0;display:flex;flex-direction:column}
.of-li small{font-size:12px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.of-li button{padding:8px 10px;border-radius:10px;border:1px solid var(--line)}
.of-blank{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.of-blank button{padding:10px 0;border-radius:10px;background:linear-gradient(160deg,#fff7d6,#f5d98b);color:#3b2a06;font-weight:800;font-size:18px}
.of-look h3{margin:4px 0;letter-spacing:2px;font-size:24px}.of-src{font-size:13px;opacity:.8}
.of-def{margin:10px 0;line-height:1.5;font-size:15px}.of-def ol{padding-left:20px;margin:6px 0}.of-def .m{opacity:.75}
.of-syn{margin-top:8px;display:flex;flex-wrap:wrap;gap:5px;align-items:center}.of-syn span{padding:3px 9px;border-radius:999px;background:rgba(62,230,255,.14);font-size:13px}
.of-cc{font-size:11.5px;opacity:.65;margin-top:8px}.of-cc a,.of-links a{color:var(--aqua)}
.of-links{margin:6px 0}.of-links a{font-weight:600;text-decoration:none}
.of-log+.ghint{margin-bottom:28px}
.of-hr{border:0;border-top:1px solid var(--line);margin:14px 0}
body.desk .of-wrap{max-width:min(640px,100%,calc(100vh - 360px))}
`; document.head.appendChild(st);

  window.__ofTest = (typeof DEV!=='undefined' && DEV) ? {crude, useLang, loadDict, inDawg, isWord, evaluate, genMoves, aiMove, PREM, C} : undefined;
})();
