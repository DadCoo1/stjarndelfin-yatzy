// körs i sidan: regeltester. Returnerar lista med fel.
(async()=>{
const F=[]; let n=0;
const T=(name,fn)=>{ try{ const r=fn(); n++; if(r!==true) F.push(name+': '+(r===false?'falskt':JSON.stringify(r))); }catch(e){ n++; F.push(name+': UNDANTAG '+e.message); } };
const mk=(kind,names=['A','B'],ai=null)=>{ const g=gNewState(kind,names,0,ai||names.map(()=>false)); KIND[kind].start(g); return g; };
const ap=(g,a,s)=>KIND[g.kind].apply(g,a,s);
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b)||{fick:a,ville:b};
// ---------- Fyra i rad
T('c4 lodrätt vinst',()=>{ const g=mk('c4'); for(let k=0;k<3;k++){ ap(g,{type:'drop',c:0},0); ap(g,{type:'drop',c:1},1); } ap(g,{type:'drop',c:0},0); return g.over&&g.winner===0&&g.win.length>=4; });
T('c4 diagonal vinst',()=>{ const g=mk('c4'); const seq=[[0,0],[1,1],[1,0],[2,1],[2,0],[3,1],[2,0],[3,1],[3,0],[6,1],[3,0]]; for(const [c,s] of seq){ if(g.cur!==s) return 'tur fel vid '+c; ap(g,{type:'drop',c},s); } return g.over&&g.winner===0; });
T('c4 full kolumn avvisas',()=>{ const g=mk('c4'); for(let k=0;k<6;k++) ap(g,{type:'drop',c:2},g.cur); return ap(g,{type:'drop',c:2},g.cur)===false; });
T('c4 fel spelare avvisas',()=>{ const g=mk('c4'); return ap(g,{type:'drop',c:2},1)===false; });
T('c4 oavgjort',()=>{ const g=mk('c4'); const cols=[0,1,2,3,4,5,6]; const order=[0,1,2,3,4,5,6, 1,0,3,2,5,4, 6,0,1,2,3,4, 5,6,1,0,3,2, 5,4,6,0,1,2, 3,4,5,6,0,1, 2,3,4,5,6]; 
  // fyll med mönster som inte ger fyra i rad: kolumnpar byter färg varannan rad
  const g2=mk('c4'); const pat=[[0,0,1,1,0,0,1],[1,1,0,0,1,1,0],[0,0,1,1,0,0,1],[1,1,0,0,1,1,0],[0,0,1,1,0,0,1],[1,1,0,0,1,1,0]];
  g2.board=pat.flat(); g2.board[0]=-1; const p=pat[0][0]; g2.cur=p; ap(g2,{type:'drop',c:0},p); return (g2.over&&g2.winner===-1)||{over:g2.over,w:g2.winner}; });
T('c4 AI vinner direkt',()=>{ const g=mk('c4',['A','B'],[false,'hard']); g.board=new Array(42).fill(-1); [35,36,37].forEach(i=>g.board[i]=1); g.cur=1; const a=KIND.c4.ai(g,1); return a.c===3||a; });
T('c4 AI blockerar',()=>{ const g=mk('c4',['A','B'],[false,'medium']); g.board=new Array(42).fill(-1); [35,36,37].forEach(i=>g.board[i]=0); g.board[41]=1; g.cur=1; const a=KIND.c4.ai(g,1); return a.c===3||a; });
// ---------- Luffarschack
T('gomoku fem i rad snett',()=>{ const g=mk('gomoku'); for(let k=0;k<4;k++){ ap(g,{type:'put',i:k*16},0); ap(g,{type:'put',i:200+k},1); } ap(g,{type:'put',i:64},0); return g.over&&g.winner===0; });
T('gomoku fyra är inte vinst',()=>{ const g=mk('gomoku'); for(let k=0;k<4;k++){ ap(g,{type:'put',i:k},0); if(k<3) ap(g,{type:'put',i:100+k},1); } return !g.over; });
T('gomoku upptagen ruta',()=>{ const g=mk('gomoku'); ap(g,{type:'put',i:5},0); return ap(g,{type:'put',i:5},1)===false; });
T('gomoku AI blockerar öppen fyra',()=>{ const g=mk('gomoku',['A','B'],[false,'hard']); for(const i of [100,101,102,103]) g.board[i]=0; g.board[0]=1; g.cur=1; const a=KIND.gomoku.ai(g,1); return a.i===99||a.i===104||a; });
// ---------- Othello
T('othello start: 4 drag för svart',()=>{ const g=mk('othello'); return __stratTest.moves(g.board,0).length===4; });
T('othello vänder rätt',()=>{ const g=mk('othello'); const m=__stratTest.moves(g.board,0)[0]; ap(g,{type:'put',i:m},0); return g.board.filter(x=>x===0).length===4&&g.board.filter(x=>x===1).length===1; });
T('othello ogiltigt drag',()=>{ const g=mk('othello'); return ap(g,{type:'put',i:0},0)===false; });
T('othello pass',()=>{ const g=mk('othello'); g.board=new Array(64).fill(-1); g.board[0]=0; g.board[1]=1; g.board[63]=1; g.cur=0; // svart kan ta b1 genom att lägga på 2
  const ok=ap(g,{type:'put',i:2},0); return ok&&(g.over||g.cur===0||g.cur===1)||{ok}; });
T('othello slut när ingen kan',()=>{ const g=mk('othello'); g.board=new Array(64).fill(-1); g.board[0]=0; g.board[1]=1; g.cur=0; ap(g,{type:'put',i:2},0); return g.over&&g.winner===0||{over:g.over,w:g.winner,b:g.board.slice(0,4)}; });
// ---------- Fia
T('fia ut bara på 1 eller 6',()=>{ const g=mk('fia'); let tries=0; for(let k=0;k<200;k++){ const gg=JSON.parse(JSON.stringify(g)); ap(gg,{type:'roll'},0); if(gg.die!==1&&gg.die!==6){ if(gg.phase==='move') return 'fick flytta på '+gg.die; } else if(gg.phase!=='move') return 'fick inte flytta på '+gg.die; } return true; });
T('fia tre försök',()=>{ const g=mk('fia'); const R=window.rint; window.rint=()=>1; /* tärning 2 */ try{ ap(g,{type:'roll'},0); const a=g.cur===0&&g.tries===1; ap(g,{type:'roll'},0); const b=g.cur===0&&g.tries===2; ap(g,{type:'roll'},0); return (a&&b&&g.cur===1)||{a,b,cur:g.cur,die:g.die}; } finally{ window.rint=R; } });
T('fia sexa ger nytt slag',()=>{ const g=mk('fia'); g.pos[0]=[0,-1,-1,-1]; g.die=6; g.phase='move'; ap(g,{type:'move',p:0},0); return g.cur===0&&g.phase==='roll'&&g.pos[0][0]===6; });
T('fia knuffa hem',()=>{ const g=mk('fia'); // A (slot0) på rel 5 = abs 5; B (slot2) på abs 7 = rel 27
  g.pos[0]=[5,-1,-1,-1]; g.pos[1]=[27,-1,-1,-1]; g.die=2; g.phase='move'; g.cur=0; ap(g,{type:'move',p:0},0); return g.pos[1][0]===-1&&g.last.knocked===1||{b:g.pos[1],last:g.last}; });
T('fia exakt i mål',()=>{ const g=mk('fia'); g.pos[0]=[42,-1,-1,-1]; g.die=3; g.phase='move'; g.cur=0; return ap(g,{type:'move',p:0},0)===false; });
T('fia vinst',()=>{ const g=mk('fia'); g.pos[0]=[44,44,44,41]; g.die=3; g.phase='move'; g.cur=0; ap(g,{type:'move',p:3},0); return g.over&&g.winner===0; });
T('fia två egna på samma ruta förbjudet',()=>{ const g=mk('fia'); g.pos[0]=[3,5,-1,-1]; g.die=2; g.phase='move'; g.cur=0; return ap(g,{type:'move',p:0},0)===false; });
T('fia inte ut om egen på start',()=>{ const g=mk('fia'); g.pos[0]=[0,-1,-1,-1]; g.die=6; g.phase='move'; g.cur=0; return ap(g,{type:'move',p:1},0)===false; });
T('fia 4 spelare banan',()=>{ const g=mk('fia',['A','B','C','D']); return g.pos.length===4 && KIND.fia.valid(g); });
// ---------- Memory
T('memory par ger fortsättning',()=>{ const g=mk('memory'); const i=0, j=g.cards.indexOf(g.cards[0],1); ap(g,{type:'flip',i},0); ap(g,{type:'flip',i:j},0); return g.cur===0&&g.scores[0]===1&&g.owner[i]===0; });
T('memory miss byter tur och visar korten',()=>{ const g=mk('memory'); const i=0, j=g.cards.findIndex(c=>c!==g.cards[0]); ap(g,{type:'flip',i},0); ap(g,{type:'flip',i:j},0); return g.cur===1&&g.open.length===2&&g.hideNext; });
T('memory samma kort två gånger',()=>{ const g=mk('memory'); ap(g,{type:'flip',i:3},0); return ap(g,{type:'flip',i:3},0)===false; });
T('memory gömmer på nästa vändning',()=>{ const g=mk('memory'); const j=g.cards.findIndex(c=>c!==g.cards[0]); ap(g,{type:'flip',i:0},0); ap(g,{type:'flip',i:j},0); ap(g,{type:'flip',i:0},1); return g.open.length===1&&g.open[0]===0; });
T('memory slut och vinnare',()=>{ const g=mk('memory'); const by={}; g.cards.forEach((c,i)=>(by[c]=by[c]||[]).push(i)); for(const k in by){ ap(g,{type:'flip',i:by[k][0]},g.cur); ap(g,{type:'flip',i:by[k][1]},g.cur); } return g.over&&g.winner===0&&g.scores[0]===8; });
T('memory gäst ser inte korten',()=>{ const g=mk('memory'); const r=gRedact(g,1); return r.cards.every(c=>c===-1); });
// ---------- Vändtia (Svenska Bridgeförbundets regler)
const VT=__cardsTest.VT, rk=__cardsTest.rk;
const C=(r,s=0)=>s*13+(r-2);
const vp=(n=3)=>{ const g=mk('vandtia',Array.from({length:n},(_,i)=>'P'+i)); g.phase='play'; g.ready=g.ready.map(()=>true); g.first=null; g.cur=0; return g; };
T('vändtia börjar i förberedelse',()=>{ const g=mk('vandtia',['A','B','C']); return g.phase==='setup'&&g.up.every(u=>u.length===3&&u.every(st=>st.length===1))&&g.hands.every(h=>h.length===3)&&g.deck.length===52-27; });
T('vändtia byta handkort mot uppvänt',()=>{ const g=mk('vandtia'); const h=g.hands[0][0], u=g.up[0][1][0]; ap(g,{type:'swap',c:h,u:1},0); return g.up[0][1][0]===h&&g.hands[0].includes(u); });
T('vändtia lägga på annans uppvända (samma valör)',()=>{ const g=mk('vandtia'); g.hands[0]=[C(5),C(9),C(12)]; g.up[1][2]=[C(5,2)]; const d=g.deck.length; ap(g,{type:'stack',c:C(5),to:1,u:2},0); return g.up[1][2].length===2&&g.hands[0].length===3&&g.deck.length===d-1; });
T('vändtia lägga på annan valör avvisas',()=>{ const g=mk('vandtia'); g.hands[0]=[C(5),C(9),C(12)]; g.up[1][2]=[C(6,2)]; return ap(g,{type:'stack',c:C(5),to:1,u:2},0)===false; });
T('vändtia lägst kort börjar (trea, inte 2)',()=>{ const g=mk('vandtia',['A','B','C']); g.hands=[[C(2),C(9),C(14)],[C(4),C(8),C(13)],[C(3,1),C(10),C(11)]]; for(let s=0;s<3;s++) ap(g,{type:'ready'},s); return g.phase==='play'&&g.cur===2&&g.first===3; });
T('vändtia första draget måste vara lägsta valören',()=>{ const g=mk('vandtia',['A','B']); g.hands=[[C(3),C(9),C(14)],[C(4),C(8),C(13)]]; ap(g,{type:'ready'},0); ap(g,{type:'ready'},1); return ap(g,{type:'play',cards:[C(9)]},0)===false && ap(g,{type:'play',cards:[C(3)]},0)===true; });
T('vändtia lägre avvisas',()=>{ const g=vp(); g.pile=[C(9)]; g.hands[0]=[C(5,1),C(3),C(4)]; return ap(g,{type:'play',cards:[C(5,1)]},0)===false; });
T('vändtia 2 går på allt',()=>{ const g=vp(); g.pile=[C(13)]; g.hands[0]=[C(2,1),C(3),C(4)]; return ap(g,{type:'play',cards:[C(2,1)]},0)===true&&g.cur===1; });
T('vändtia efter 2 går trean',()=>{ const g=vp(); g.pile=[C(13),C(2)]; g.hands[0]=[C(3),C(4),C(5)]; return ap(g,{type:'play',cards:[C(3)]},0)===true; });
T('vändtia 10 bränner och samma spelare igen',()=>{ const g=vp(); g.pile=[C(13),C(14)]; g.hands[0]=[C(10,2),C(3),C(4)]; ap(g,{type:'play',cards:[C(10,2)]},0); return g.pile.length===0&&g.cur===0&&g.burnt===3; });
T('vändtia fyra lika över flera drag bränner',()=>{ const g=vp(); g.pile=[C(7),C(7,1)]; g.hands[0]=[C(7,2),C(7,3),C(4)]; ap(g,{type:'play',cards:[C(7,2),C(7,3)]},0); return g.pile.length===0&&g.cur===0; });
T('vändtia fyra lika på en gång bränner',()=>{ const g=vp(); g.pile=[C(5)]; g.hands[0]=[C(8),C(8,1),C(8,2),C(8,3)]; ap(g,{type:'play',cards:[C(8),C(8,1),C(8,2),C(8,3)]},0); return g.pile.length===0&&g.cur===0; });
T('vändtia fyll på till tre',()=>{ const g=vp(); g.pile=[]; const c=g.hands[0][0], d=g.deck.length; ap(g,{type:'play',cards:[c]},0); return g.hands[0].length===3&&g.deck.length===d-1; });
T('vändtia chansa som passar',()=>{ const g=vp(); g.pile=[C(9)]; g.hands[0]=[C(3),C(4),C(5)]; g.deck=[C(6,3),C(12,1)]; ap(g,{type:'chance'},0); return g.pile.length===2&&g.cur===1&&g.last.ok; });
T('vändtia chansa som inte passar',()=>{ const g=vp(); g.pile=[C(9)]; g.hands[0]=[C(3),C(4),C(5)]; g.deck=[C(6,3),C(4,1)]; ap(g,{type:'chance'},0); return g.pile.length===0&&g.hands[0].length===5&&g.cur===1; });
T('vändtia chansa förbjudet om man kan lägga',()=>{ const g=vp(); g.pile=[C(4)]; g.hands[0]=[C(9),C(4,1),C(5)]; return ap(g,{type:'chance'},0)===false; });
T('vändtia ta upp högen frivilligt',()=>{ const g=vp(); g.pile=[C(4)]; g.hands[0]=[C(9),C(4,1),C(5)]; return ap(g,{type:'take'},0)===true&&g.hands[0].length===4; });
T('vändtia uppvända när hand och talong är slut',()=>{ const g=vp(); g.deck=[]; g.hands[0]=[]; g.pile=[]; g.up[0]=[[C(6)],[C(6,1),C(6,2)],[C(9)]]; ap(g,{type:'play',cards:[C(6),C(6,1),C(6,2)]},0); return g.up[0][0].length===0&&g.up[0][1].length===0&&g.pile.length===3; });
T('vändtia dolt kort som inte passar',()=>{ const g=vp(); g.deck=[]; g.hands[0]=[]; g.up[0]=[[],[],[]]; g.down[0]=[C(3),C(4),C(5)]; g.pile=[C(13)]; ap(g,{type:'blind',i:0},0); return g.hands[0].length===2&&g.pile.length===0&&g.cur===1&&g.down[0][0]===null; });
T('vändtia vinst när allt är slut',()=>{ const g=vp(); g.deck=[]; g.hands[0]=[]; g.up[0]=[[],[],[]]; g.down[0]=[null,null,C(14)]; g.pile=[C(3)]; ap(g,{type:'blind',i:2},0); return g.over&&g.winner===0; });
T('vändtia 6 spelare: två kortlekar',()=>{ const g=mk('vandtia',['A','B','C','D','E','F']); const all=[...g.hands.flat(),...g.up.flat(2),...g.down.flat(),...g.deck]; return all.length===104&&new Set(all).size===104&&KIND.vandtia.valid(g); });
T('vändtia gäst ser inte dolda/andras',()=>{ const g=mk('vandtia'); const r=gRedact(g,1); return r.hands[0].every(c=>c===-1)&&r.down.flat().every(c=>c===-1)&&r.hands[1].every(c=>c>=0)&&r.deck.length===0&&r.up[0].flat().every(c=>c>=0); });
// ---------- Finns i sjön
T('fisk fråga och få',()=>{ const g=mk('fisk'); g.hands[0]=[C(5),C(9)]; g.hands[1]=[C(5,1),C(5,2),C(8)]; g.cur=0; ap(g,{type:'ask',to:1,rank:5},0); return g.hands[0].filter(c=>rk(c)===5).length===3&&g.cur===0; });
T('fisk fyrtal läggs ut',()=>{ const g=mk('fisk'); g.hands[0]=[C(5),C(5,3),C(9)]; g.hands[1]=[C(5,1),C(5,2),C(8)]; g.cur=0; ap(g,{type:'ask',to:1,rank:5},0); return g.books[0].includes(5)&&!g.hands[0].some(c=>rk(c)===5); });
T('fisk fråga om valör man inte har',()=>{ const g=mk('fisk'); g.hands[0]=[C(5)]; g.cur=0; return ap(g,{type:'ask',to:1,rank:9},0)===false; });
const fk=(deck)=>{ const g=mk('fisk'); g.hands[0]=[C(5)]; g.hands[1]=[C(8)]; g.deck=deck; g.lake=deck.map((_,i)=>[100*i,500,0]); g.cur=0; return g; };
T('fisk finns i sjön: man väljer kort i sjön',()=>{ const g=fk([C(9,2),C(3,3)]); ap(g,{type:'ask',to:1,rank:5},0); return g.cur===0&&g.fish&&g.fish.rank===5&&g.hands[0].length===1&&ap(g,{type:'ask',to:1,rank:5},0)===false; });
T('fisk valt kort i sjön byter tur',()=>{ const g=fk([C(9,2),C(3,3)]); ap(g,{type:'ask',to:1,rank:5},0); ap(g,{type:'fish',i:0},0); return g.cur===1&&g.hands[0].includes(C(9,2))&&g.deck.length===1&&g.lake.length===1&&!g.fish; });
T('fisk fiskar upp rätt = fortsätter',()=>{ const g=fk([C(9,2),C(5,3)]); ap(g,{type:'ask',to:1,rank:5},0); ap(g,{type:'fish',i:1},0); return g.cur===0&&g.last.lucky; });
T('fisk bara den som fiskar får välja',()=>{ const g=fk([C(9,2),C(5,3)]); ap(g,{type:'ask',to:1,rank:5},0); return ap(g,{type:'fish',i:0},1)===false&&ap(g,{type:'fish',i:7},0)===false; });
T('fisk sjön är utspridd: en plats per kort',()=>{ const g=mk('fisk'); return g.lake.length===g.deck.length&&KIND.fisk.valid(g); });
T('fisk gäst ser inte korten i sjön eller det fiskade kortet',()=>{ const g=fk([C(9,2),C(3,3)]); ap(g,{type:'ask',to:1,rank:5},0); ap(g,{type:'fish',i:0},0); const r=gRedact(g,1); return r.last.drew===undefined&&r.hands[0].every(c=>c===-1)&&r.deck.every(c=>c===-1)&&r.lake.length===1; });
T('fisk datorn fiskar i sjön',()=>{ const g=fk([C(9,2),C(3,3)]); ap(g,{type:'ask',to:1,rank:5},0); const a=KIND.fisk.ai(Object.assign(g,{ai:[1,1]}),0); return a&&a.type==='fish'&&ap(g,a,0); });
// ---------- Hjärter
const hL=__cardsTest.hLegal;
const hg=()=>{ const g=mk('hjarter',['A','B','C','D'],[false,false,false,false]); return g; };
T('hjärter 4 spelare och pass-fas',()=>{ const g=hg(); return g.names.length===4&&g.phase==='pass'&&g.hands.every(h=>h.length===13); });
T('hjärter byte vänster',()=>{ const g=hg(); const give=g.hands.map(h=>h.slice(0,3)); for(let s=0;s<4;s++) ap(g,{type:'pass',cards:give[s]},s); return g.phase==='play'&&give[0].every(c=>g.hands[1].includes(c))&&g.hands.every(h=>h.length===13); });
T('hjärter klöver 2 först',()=>{ const g=hg(); for(let s=0;s<4;s++) ap(g,{type:'pass',cards:g.hands[s].slice(0,3)},s); const L=hL(g,g.cur); return L.length===1&&L[0]===39&&g.hands[g.cur].includes(39); });
T('hjärter måste följa färg',()=>{ const g=hg(); g.phase='play'; g.tricksDone=1; g.hands[0]=[C(5,0),C(9,1)]; g.trick=[{s:3,c:C(7,0)}]; g.cur=0; return eq(hL(g,0),[C(5,0)]); });
T('hjärter inte spela ut hjärter innan brutet',()=>{ const g=hg(); g.phase='play'; g.tricksDone=2; g.trick=[]; g.broken=false; g.hands[0]=[C(5,1),C(9,0)]; g.cur=0; return eq(hL(g,0),[C(9,0)]); });
T('hjärter första sticket inga poäng',()=>{ const g=hg(); g.phase='play'; g.tricksDone=0; g.hands[0]=[C(12,0),C(9,1),C(4,2)]; g.trick=[{s:3,c:39}]; g.cur=0; return eq(hL(g,0),[C(4,2)]); });
T('hjärter sticket och poäng',()=>{ const g=hg(); g.phase='play'; g.tricksDone=3; g.broken=true; g.cur=0; g.hands=[[C(10,1)],[C(14,1)],[C(12,0)],[C(3,1)]].map(h=>h.concat([C(2,2)])); 
  ap(g,{type:'card',c:C(10,1)},0); ap(g,{type:'card',c:C(14,1)},1); ap(g,{type:'card',c:C(12,0)},2); ap(g,{type:'card',c:C(3,1)},3); return g.taken[1]===16&&g.cur===1||{taken:g.taken,cur:g.cur}; });
T('hjärter skjuta månen',()=>{ const g=hg(); g.phase='play'; g.tricksDone=12; g.taken=[25,0,0,0]; g.broken=true; g.hands=[[C(14,1)],[C(2,2)],[C(3,2)],[C(4,2)]]; g.cur=0; g.trick=[];
  ap(g,{type:'card',c:C(14,1)},0); ap(g,{type:'card',c:C(2,2)},1); ap(g,{type:'card',c:C(3,2)},2); ap(g,{type:'card',c:C(4,2)},3); return eq(g.scores,[0,26,26,26]); });
T('hjärter spel slut vid 50',()=>{ const g=hg(); g.scores=[10,48,20,30]; g.phase='play'; g.tricksDone=12; g.taken=[0,0,0,0]; g.broken=true; g.hands=[[C(2,1)],[C(14,1)],[C(3,1)],[C(4,1)]]; g.cur=0; g.trick=[];
  for(let s=0;s<4;s++) ap(g,{type:'card',c:g.hands[s][0]},s); return g.over&&g.winner===0||{over:g.over,scores:g.scores}; });
T('hjärter gäst ser inte andras',()=>{ const g=hg(); const r=gRedact(g,2); return r.hands.every((h,s)=>s===2?h.every(c=>c>=0):h.every(c=>c===-1)); });
// ---------- Wordle
const sc=__puzTest.score;
T('wordle dubbletter',()=>eq([sc('ekkor','kakor'),sc('kakao','kakor'),sc('ttttt','katts')],['byggg','gggby','bbggb']) );
T('wordle dagens ord stabilt',()=>{ const d=__puzTest.dayNo(); return __puzTest.dailyWord('sv',d)===__puzTest.dailyWord('sv',d) && __puzTest.dailyWord('sv',d)!==__puzTest.dailyWord('sv',d+1); });
// ---------- Sudoku
T('sudoku unik lösning alla nivåer',()=>{ for(const lv of ['easy','medium','hard']) for(let s=1;s<=4;s++){ const {puz,sol}=__puzTest.generate(lv,s*77); if(__puzTest.solve(puz.slice(),0,2,null)!==1) return lv+s; for(let i=0;i<81;i++) if(puz[i]&&puz[i]!==sol[i]) return 'ledtråd fel'; } return true; });
T('sudoku lösningen är giltig',()=>{ const {sol}=__puzTest.generate('hard',5); for(let k=0;k<9;k++){ const row=new Set(sol.slice(k*9,k*9+9)), col=new Set([...Array(9)].map((_,r)=>sol[r*9+k])); if(row.size!==9||col.size!==9) return k; } return true; });
T('sudoku given ruta kan inte ändras',()=>{ const g=mk('sudoku',['A']); const i=g.puz.findIndex(v=>v); return ap(g,{type:'set',i,v:1},0)===false; });
T('sudoku anteckningar rensas',()=>{ const g=mk('sudoku',['A']); const i=g.puz.findIndex(v=>!v); const v=g.sol[i]; const j=[...Array(81).keys()].find(k=>k!==i&&!g.puz[k]&&Math.floor(k/9)===Math.floor(i/9)); if(j==null) return true; ap(g,{type:'note',i:j,v},0); ap(g,{type:'set',i,v},0); return !(g.notes[j]&(1<<v)); });
// ---------- Ordfajt
const O=__ofTest; await O.loadDict('sv'); O.useLang('sv');
T('ordfajt korsord ger båda orden',()=>{ const B=new Array(225).fill(''); [111,112,113].forEach((i,k)=>B[i]='hus'[k]); const ev=O.evaluate(B,[{i:113+15,l:'e'},{i:113+30,l:'n'}]); return ev.ok && ev.words.map(w=>w.w).join()==='sen' || ev; });
T('ordfajt bingo +40',()=>{ const B=new Array(225).fill(''); const w='trädens'; const ev=O.evaluate(B,[...w].map((l,k)=>({i:108+k,l}))); return ev.ok&&ev.bingo&&ev.total>=40||ev; });
T('ordfajt blank 0 poäng',()=>{ const B=new Array(225).fill(''); const ev=O.evaluate(B,[{i:112,l:'h',b:true},{i:113,l:'u'},{i:114,l:'s'}]); const ev2=O.evaluate(B,[{i:112,l:'h'},{i:113,l:'u'},{i:114,l:'s'}]); return ev.total===ev2.total-3||[ev.total,ev2.total]; });
T('ordfajt måste hänga ihop',()=>{ const B=new Array(225).fill(''); B[112]='h'; B[113]='u'; B[114]='s'; const ev=O.evaluate(B,[{i:0,l:'a'},{i:1,l:'v'}]); return !ev.ok; });
T('ordfajt slut: tom hand och påse',()=>{ const g=mk('ordfajt'); g.bag=[]; g.racks[0]=['h','u','s']; g.racks[1]=['a','b']; g.board=new Array(225).fill(''); g.cur=0; ap(g,{type:'play',tiles:[{i:112,l:'h'},{i:113,l:'u'},{i:114,l:'s'}]},0); return g.over&&g.winner===0; });
T('ordfajt sex nollrundor',()=>{ const g=mk('ordfajt'); for(let k=0;k<6;k++) ap(g,{type:'pass'},g.cur); return g.over; });
// ---------- Yatzy-regler
T('yatzy fyrtal räknas inte som två par (utan husregel)',()=>{ G=newState(['A'],0,'free'); G.hr4=false; return score('twopair',[6,6,6,6,2])===0; });
T('yatzy husregel fyrtal = två par',()=>{ G=newState(['A'],0,'free'); G.hr4=true; return score('twopair',[6,6,6,6,2])===24; });
T('yatzy kåk',()=>score('house',[3,3,3,5,5])===19 && score('house',[3,3,3,3,3])===0);
T('yatzy stege',()=>score('small',[1,2,3,4,5])===15&&score('large',[2,3,4,5,6])===20&&score('small',[2,3,4,5,6])===0);
return {n, F};
})()
