/* =====================================================================
   mahjong.js – Vittangi: mahjong-patiens. Para ihop två lika, fria brickor tills bordet är tomt.
   Egen design: sju symbolteman (klassiska ritade brickor + djur, frukt & godis, hav, fjäll & vinter,
   rymd, sport), sju brickfärger och åtta bord att välja mellan. Allt utom grunden låses upp med stjärnor.
   1–3 stjärnor per nivå, nivåkarta, 15 bordsformer + oändliga nivåer, dagens bricka med svit.
   Varje giv går alltid att lösa (brickorna läggs ut baklänges från en lösning) – även efter blandning.
   ===================================================================== */
'use strict';
(function(){
  const now=()=>Date.now();
  const st=document.createElement('style'); document.head.appendChild(st);
  const dayNo=(t)=>{ const d=new Date(new Date(t||Date.now()).toLocaleString('en-US',{timeZone:'Europe/Stockholm'})); return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5); };
  function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const J=(k,d)=>{ try{ return JSON.parse(lsGet(k)||'')||d; }catch(e){ return d; } };

  /* ---------- borden: positioner i halva brickbredder (x, y) och lager (z) ---------- */
  const M=(rows,dx=0,dy=0,z=0)=>{ const o=[]; rows.forEach((s,j)=>[...s].forEach((ch,i)=>{ if(ch==='#') o.push([dx+i*2,dy+j*2,z]); })); return o; };
  const R=(c,r,dx,dy,z)=>M(Array(r).fill('#'.repeat(c)),dx,dy,z);
  const C=(lens,m,dy,z)=>{ const o=[]; lens.forEach((n,j)=>{ for(let i=0;i<n;i++) o.push([(m-n)+i*2,dy+j*2,z]); }); return o; };
  // jämnt antal brickor: blir det udda läggs en "krona" överst i mitten
  function L(...parts){ const seen=new Set(), o=[]; for(const p of parts.flat()){ const k=p.join(); if(!seen.has(k)){ seen.add(k); o.push(p); } }
    if(o.length%2){ const mz=Math.max(...o.map(p=>p[2])), top=o.filter(p=>p[2]===mz), cx=(Math.min(...o.map(p=>p[0]))+Math.max(...o.map(p=>p[0])))/2, cy=(Math.min(...o.map(p=>p[1]))+Math.max(...o.map(p=>p[1])))/2;
      top.sort((a,b)=>Math.hypot(a[0]-cx,a[1]-cy)-Math.hypot(b[0]-cx,b[1]-cy)); o.push([top[0][0],top[0][1],mz+1]); }
    return o; }
  const LAYS=[
    {id:'torn',   name:'Lilla tornet',   p:()=>L(R(4,5,0,0,0),R(2,2,2,3,1))},
    {id:'diamant',name:'Diamanten',      p:()=>L(C([2,3,4,5,4,3,2],5,0,0),[[5,6,1]])},
    {id:'mane',   name:'Månen',          p:()=>L(M(['..#####','.###...','###....','##.....','###....','.###...','..#####']),M(['.##..','##...','#....','##...','.##..'],1,1,1),M(['#','#','#'],1,3,2))},
    {id:'hjarta', name:'Hjärtat',        p:()=>L(M(['.##.##.','#######','#######','.#####.','..###..','...#...']),M(['######'],1,2,1),M(['####'],3,5,1),M(['###'],4,3,2))},
    {id:'gran',   name:'Granen',         p:()=>L(C([1,2,3,4,5,6,1,1],6,0,0),C([2,3,4],6,6,1),C([1,2],6,8,2))},
    {id:'kors',   name:'Snöflingan',     p:()=>L(M(['#..#..#','.#.#.#.','..###..','#######','..###..','.#.#.#.','#..#..#']),[[6,4,1],[4,6,1],[6,6,1],[8,6,1],[6,8,1],[6,6,2]])},
    {id:'stjarna',name:'Stjärnan',       p:()=>L(M(['...#...','..###..','#######','.#####.','..###..','.##.##.','##...##']),M(['.#.','###','.#.'],4,4,1),[[6,6,2]])},
    {id:'fisk',   name:'Fisken',         p:()=>L(M(['#..####.','##.#####','########','##.#####','#..####.']),R(3,3,7,1,1),M(['##'],8,2,2))},
    {id:'pyramid',name:'Pyramiden',      p:()=>L(R(6,6,0,0,0),R(4,4,2,2,1),R(2,2,4,4,2))},
    {id:'fjaril', name:'Fjärilen',       p:()=>L(M(['##..##','######','######','.####.','######','######','##..##']),R(4,2,2,2,1),R(4,2,2,8,1),R(2,2,4,5,2))},
    {id:'bro',    name:'Bron',           p:()=>L(M(['########','########','##....##','##....##','##....##']),M(['#######'],1,1,1),M(['#','#'],1,5,1),M(['#','#'],13,5,1),M(['######'],2,1,2),M(['#####'],3,1,3))},
    {id:'kyrka',  name:'Kyrkan',         p:()=>L(M(['...#...','..###..','..###..','#######','#######','#######','#######']),M(['#','#'],6,2,1),R(5,3,2,8,1),R(3,2,4,9,2),M(['##'],5,10,3))},
    {id:'borg',   name:'Borgen',         p:()=>L(R(6,8,0,0,0),R(4,6,2,2,1),[[0,0,1],[10,0,1],[0,14,1],[10,14,1],[0,0,2],[10,0,2],[0,14,2],[10,14,2]])},
    {id:'stor',   name:'Stora pyramiden',p:()=>L(R(7,8,0,0,0),R(5,6,2,2,1),R(3,4,4,4,2),R(1,2,6,6,3))},
    {id:'trappan',name:'Trappan',        p:()=>L(R(7,6,0,0,0),R(6,5,1,1,1),R(5,4,2,2,2),R(4,3,3,3,3))}
  ].map(l=>(l.n=l.p().length,l)).sort((a,b)=>a.n-b.n);
  // nivå → bord, antal olika symboler och måltid för tre stjärnor
  const NLV=LAYS.length*2;
  function levelDef(n){ n=Math.max(1,n|0);
    if(n<=NLV){ const li=Math.floor((n-1)/2), P=LAYS[li].n/2; return {lay:li, kinds:Math.max(4,Math.min(36,Math.round(P*((n-1)%2?.62:.42)))), par:LAYS[li].n*3}; }
    const r=rng(n*131), li=Math.min(LAYS.length-1,Math.floor(LAYS.length/2)+Math.floor(r()*Math.ceil(LAYS.length/2))); return {lay:li, kinds:36, par:LAYS[li].n*3}; }
  const dailyDef=d=>{ const big=LAYS.map((l,i)=>i).filter(i=>LAYS[i].n>=44), li=big[d%big.length]; return {lay:li, kinds:Math.round(LAYS[li].n/2*.7), par:LAYS[li].n*3}; };

  /* ---------- regler ---------- */
  // 0–33: 34 olika symboler. 34–37 och 38–41: två grupper där alla fyra passar ihop med varandra.
  const key=k=>k<34?k:k<38?'F':'S';
  function blocked(pos,alive,i){ const [x,y,z]=pos[i]; let Lf=false, Rt=false;
    for(let j=0;j<pos.length;j++){ if(j===i||!alive[j]) continue; const [a,b,c]=pos[j];
      if(c===z+1 && Math.abs(a-x)<2 && Math.abs(b-y)<2) return true;
      if(c===z && Math.abs(b-y)<2){ if(a===x-2) Lf=true; else if(a===x+2) Rt=true; } }
    return Lf&&Rt; }
  const freeList=(pos,alive)=>pos.map((_,i)=>i).filter(i=>alive[i]&&!blocked(pos,alive,i));
  function pairs(g){ const f=freeList(g.pos,g.alive), by={}; for(const i of f){ const k=key(g.tk[i]); (by[k]=by[k]||[]).push(i); } const o=[]; for(const k in by){ const a=by[k]; for(let x=0;x<a.length;x++) for(let y=x+1;y<a.length;y++) o.push([a[x],a[y]]); } return o; }
  // lägg ut baklänges från en lösning: plocka två fria platser i taget och ge dem ett par. Ordningen sparas (= en lösning).
  function deal(pos, pairList, r, alive0){ const n=pos.length;
    for(let tries=0;tries<80;tries++){ const alive=alive0?alive0.slice():pos.map(()=>true), kind=new Array(n).fill(-1), pl=pairList.slice(), ord=[]; for(let i=pl.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [pl[i],pl[j]]=[pl[j],pl[i]]; }
      let ok=true; for(const pr of pl){ const f=freeList(pos,alive); if(f.length<2){ ok=false; break; }
        const ia=Math.floor(r()*f.length)%f.length, a=f[ia], b=f[(ia+1+Math.floor(r()*(f.length-1)))%f.length];
        kind[a]=pr[0]; kind[b]=pr[1]; alive[a]=false; alive[b]=false; ord.push([a,b]); }
      if(ok){ deal.order=ord; return kind; } }
    return null; }
  // välj slumpvis vilka symboler som är med, så att varje giv ser olika ut
  function makePairs(nPairs, nKinds, r){ const all=[...Array(34).keys(),'F','S']; for(let i=all.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [all[i],all[j]]=[all[j],all[i]]; }
    const ks=all.slice(0,Math.max(3,Math.min(36,nKinds))), o=[]; let fl=Math.floor(r()*4), se=Math.floor(r()*4);
    for(let p=0;p<nPairs;p++){ const k=ks[p%ks.length]; if(k==='F'){ o.push([34+fl%4,34+(fl+1)%4]); fl+=2; } else if(k==='S'){ o.push([38+se%4,38+(se+1)%4]); se+=2; } else o.push([k,k]); }
    return o; }

  /* ---------- symbolteman ---------- */
  const CN=['一','二','三','四','五','六','七','八','九'], WIND=[['東','Ö'],['南','S'],['西','V'],['北','N']];
  const DOT=[[[50,60]],[[50,36],[50,84]],[[28,30],[50,60],[72,90]],[[30,36],[70,36],[30,84],[70,84]],[[30,32],[70,32],[50,60],[30,88],[70,88]],[[32,30],[68,30],[32,60],[68,60],[32,90],[68,90]],
    [[26,24],[50,34],[74,44],[34,70],[66,70],[34,96],[66,96]],[[32,24],[68,24],[32,48],[68,48],[32,72],[68,72],[32,96],[68,96]],[[26,28],[50,28],[74,28],[26,60],[50,60],[74,60],[26,92],[50,92],[74,92]]];
  const DC=['#1d4ed8','#15803d','#dc2626'];
  function classic(k){ let s='', idx='';
    if(k<9){ const n=k+1; DOT[k].forEach(([x,y],i)=>{ const c=n===1?'#dc2626':DC[(i+(n>4?1:0))%3], r=n===1?22:n<=4?13:n<=6?11:10;
        s+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".14"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${n===1?5:3.6}"/><circle cx="${x}" cy="${y}" r="${r*.45}" fill="${c}"/>${n===1?`<circle cx="50" cy="60" r="31" fill="none" stroke="#1d4ed8" stroke-width="3" stroke-dasharray="5 4"/>`:''}`; }); idx=n; }
    else if(k<18){ const n=k-8;
      if(n===1) s=`<path d="M64 92c-6 8-22 10-30 2 8-2 12-6 14-10" fill="#dc2626"/><ellipse cx="50" cy="66" rx="20" ry="24" fill="#16a34a"/><path d="M38 60c10-4 20 4 24 16-12 2-22-4-24-16z" fill="#0f766e"/><circle cx="58" cy="38" r="13" fill="#16a34a"/><circle cx="62" cy="35" r="3.5" fill="#fff"/><circle cx="63" cy="35" r="1.8" fill="#111"/><path d="M70 38l12 3-12 4z" fill="#f59e0b"/><path d="M52 26c2-8 8-10 12-8-6 2-8 6-8 10z" fill="#dc2626"/><path d="M44 90l-4 14M54 90l2 14" stroke="#b45309" stroke-width="3" stroke-linecap="round"/>`;
      else { const P=[[],[],[[50,34],[50,84]],[[50,30],[30,86],[70,86]],[[32,34],[68,34],[32,86],[68,86]],[[28,34],[72,34],[50,60],[28,86],[72,86]],[[28,34],[50,34],[72,34],[28,86],[50,86],[72,86]],[[50,24],[28,60],[50,60],[72,60],[28,96],[50,96],[72,96]],[[24,36],[42,30],[58,30],[76,36],[24,84],[42,90],[58,90],[76,84]],[[28,30],[50,30],[72,30],[28,60],[50,60],[72,60],[28,90],[50,90],[72,90]]][n];
        P.forEach(([x,y],i)=>{ const c=(n===5||n===7||n===9)&&i===Math.floor(P.length/2)?'#dc2626':'#15803d', h=n>=7?24:30;
          s+=`<rect x="${x-5}" y="${y-h/2}" width="10" height="${h}" rx="5" fill="${c}"/><rect x="${x-2}" y="${y-h/2+3}" width="3" height="${h-6}" rx="1.5" fill="#fff" opacity=".35"/><rect x="${x-7}" y="${y-2}" width="14" height="4" rx="2" fill="${c}"/>`; }); }
      idx=n; }
    else if(k<27){ const n=k-17; s=`<text x="50" y="54" font-size="42" text-anchor="middle" fill="#1e3a8a" font-weight="700">${CN[n-1]}</text><text x="50" y="104" font-size="42" text-anchor="middle" fill="#b91c1c" font-weight="700">萬</text>`; idx=n; }
    else if(k<31){ const [c,l]=WIND[k-27]; s=`<text x="50" y="84" font-size="64" text-anchor="middle" fill="#111827" font-weight="700">${c}</text>`; idx=l; }
    else if(k===31) s=`<text x="50" y="86" font-size="70" text-anchor="middle" fill="#dc2626" font-weight="700">中</text>`;
    else if(k===32) s=`<text x="50" y="86" font-size="66" text-anchor="middle" fill="#15803d" font-weight="700">發</text>`;
    else if(k===33) s=`<rect x="18" y="20" width="64" height="80" rx="7" fill="none" stroke="#1d4ed8" stroke-width="7"/><rect x="30" y="33" width="40" height="54" rx="3" fill="none" stroke="#1d4ed8" stroke-width="3"/>`;
    else if(k<38){ const n=k-33, col=['#db2777','#9333ea','#ea580c','#0891b2'][n-1]; let pet=''; for(let i=0;i<5;i++){ const a=i/5*6.283-1.57, x=50+Math.cos(a)*17, y=54+Math.sin(a)*17; pet+=`<ellipse cx="${x}" cy="${y}" rx="11" ry="15" transform="rotate(${i*72} ${x} ${y})" fill="${col}"/>`; }
      s=`<path d="M50 72 Q46 94 54 108" stroke="#15803d" stroke-width="4" fill="none"/><ellipse cx="40" cy="94" rx="9" ry="4" fill="#16a34a" transform="rotate(-30 40 94)"/>${pet}<circle cx="50" cy="54" r="8" fill="#facc15"/>`; idx=n; }
    else { const n=k-37; s=[`<circle cx="50" cy="60" r="15" fill="#facc15"/>${[...Array(8)].map((_,i)=>{ const a=i/8*6.283; return `<line x1="${50+Math.cos(a)*21}" y1="${60+Math.sin(a)*21}" x2="${50+Math.cos(a)*31}" y2="${60+Math.sin(a)*31}" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/>`; }).join('')}`,
        `<path d="M50 26c22 12 26 40 0 70-26-30-22-58 0-70z" fill="#ea580c"/><path d="M50 32v66" stroke="#9a3412" stroke-width="3"/>`,
        [...Array(6)].map((_,i)=>`<g transform="rotate(${i*60} 50 60)"><line x1="50" y1="60" x2="50" y2="28" stroke="#0284c7" stroke-width="5" stroke-linecap="round"/><path d="M42 38l8 8 8-8" stroke="#0284c7" stroke-width="4" fill="none" stroke-linecap="round"/></g>`).join(''),
        `${[...Array(5)].map((_,i)=>{ const a=i/5*6.283-1.57; return `<circle cx="${50+Math.cos(a)*16}" cy="${60+Math.sin(a)*16}" r="11" fill="#f472b6"/>`; }).join('')}<circle cx="50" cy="60" r="7" fill="#fde047"/>`][n-1]; idx=n; }
    const ix=idx!==''?`<text x="7" y="23" font-size="21" font-weight="800" fill="#334155">${idx}</text>`:'';
    return `<svg viewBox="0 0 100 120" aria-hidden="true">${s}${ix}</svg>`; }
  const E=s=>[...s.matchAll(/\p{Extended_Pictographic}️?/gu)].map(m=>m[0]);
  const SETS=[
    {id:'djur',    name:'Djur',          cost:0,  sym:E('🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🦘🐧🐴🦄🐝🐢🐍🦖🐙🦀🐬🐳🦒🦓🐘🦔🦥🦦🦩'), F:E('🐦🦜🦉🦆'), S:E('🦋🐞🐌🐛'), fn:'fåglar', sn:'småkryp'},
    {id:'klassisk',name:'Klassiska',     cost:0,  fn:'blommor', sn:'årstider'},
    {id:'frukt',   name:'Frukt & godis', cost:3,  sym:E('🍎🍐🍊🍋🍌🍉🍇🍓🍒🍑🥭🍍🥥🥝🍅🥑🥕🌽🥨🧀🍕🍔🌭🍟🍿🍩🍪🎂🥞🍫🍬🍭🍦🍯'), F:E('☕🧃🥤🍵'), S:E('🥐🥯🥖🧇'), fn:'drycker', sn:'bröd'},
    {id:'hav',     name:'Hav & strand',  cost:8,  sym:E('🐬🐳🦈🐙🦑🦀🦞🦐🐠🐟🐡🐢🐚⚓🌊🏄🤿🦩🐧🦦🐊🌴🧭🎣🏊🦆🧜🏝️🌅🦢🍉🍦👙🕶️'), F:E('🛶🚤⛵🚢'), S:E('☀️⛅🌧️🌈'), fn:'båtar', sn:'väder'},
    {id:'fjall',   name:'Fjäll & vinter',cost:14, sym:E('⛷️🏂🎿⛸️🛷🥌🏔️🌲🎄❄️⛄🦌🐺🦊🦉🐻🐇🦅🐟🎅🔥⛺🏠🕯️🔦🧭☕🍫🥕🍪🎁🔔🌨️🐕'), F:E('🧤🧣🧢🥾'), S:E('🌙⭐🌌🌅'), fn:'kläder', sn:'himlen'},
    {id:'rymd',    name:'Rymden',        cost:20, sym:E('🚀🛸🛰️👽🤖👾🔭☄️🌌🌠🌍🪐☀️🌈⚡🔮💎🧪🧲📡💡🔋🕹️🎆🌋🗿🧊🔥💧🌪️⏰🧭🎈🦄'), F:E('🌑🌓🌕🌗'), S:E('⭐🌟💫✨'), fn:'månen', sn:'stjärnor'},
    {id:'sport',   name:'Sport',         cost:27, sym:E('⚽🏀🏈⚾🎾🏐🏉🥏🎱🏓🏸🏒🥍🏏⛳🏹🥊🥋🎽🛹🎿⛷️🏂🚴🏇🤸🧗🏆🎯🪀🪁🛷⛸️🥌'), F:E('🥇🥈🥉🏅'), S:E('🏊🚣🏄🤽'), fn:'medaljer', sn:'vatten'}
  ];
  const SKINS=[
    {id:'elfenben', name:'Elfenben',    cost:0,  f:['#fffdf7','#f5ecd6','#e9ddbf'], e:['#d2be8f','#9b8253']},
    {id:'jade',     name:'Jade',        cost:5,  f:['#f7fffb','#e3f6ed','#cdeadc'], e:['#43a87f','#1d6a4e']},
    {id:'rosen',    name:'Rosenkvarts', cost:10, f:['#fff9fc','#fce8f0','#f4d3e2'], e:['#e693b3','#b0537a']},
    {id:'is',       name:'Is',          cost:17, f:['#fbfeff','#e5f5fc','#cde8f6'], e:['#7cc6e6','#3986ad']},
    {id:'valnot',   name:'Valnöt',      cost:24, f:['#fffaf1','#f6e9d1','#ebd7b4'], e:['#a6743f','#6a4322']},
    {id:'natt',     name:'Midnatt',     cost:33, f:['#fdfcff','#eeedf8','#dddbf1'], e:['#5155a6','#24265f']},
    {id:'guld',     name:'Guld',        cost:45, f:['#fffdf2','#fbf1c8','#f1dd9c'], e:['#e2b53a','#9c7410']}
  ];
  const TABLES=[
    {id:'norrsken',  name:'Norrsken',     cost:0},
    {id:'filt',      name:'Grön filt',    cost:0},
    {id:'rymd',      name:'Stjärnhimmel', cost:0},
    {id:'solnedgang',name:'Solnedgång',   cost:6},
    {id:'fjallsjo',  name:'Fjällsjö',     cost:12},
    {id:'korall',    name:'Korallrev',    cost:19},
    {id:'lavendel',  name:'Lavendel',     cost:28},
    {id:'tra',       name:'Ekbord',       cost:38}
  ];
  const pick=(list,k,def)=>{ const id=lsGet(k)||def, it=list.find(x=>x.id===id); return it&&it.cost<=totalStars()?it:list.find(x=>x.id===def); };
  const curSet=()=>pick(SETS,'mj_set','djur'), curSkin=()=>pick(SKINS,'mj_skin','elfenben'), curTable=()=>pick(TABLES,'mj_table','norrsken');
  function face(k,set){ set=set||curSet(); if(set.id==='klassisk') return classic(k);
    const ch=k<34?set.sym[k]:k<38?set.F[k-34]:set.S[k-38]; return `<span class="mj-e">${ch}</span>`; }
  const grp=k=>k<34?'':k<38?'F':'S';
  function kname(k,set){ set=set||curSet(); if(set.id==='klassisk') return k<9?`${k+1} cirklar`:k<18?`${k-8} bambu`:k<27?`${k-17} tecken`:k<31?`vind ${WIND[k-27][1]}`:k<34?['röd drake','grön drake','vit drake'][k-31]:k<38?'blomma':'årstid';
    return k<34?set.sym[k]:k<38?`${set.F[k-34]} (${set.fn})`:`${set.S[k-38]} (${set.sn})`; }
  const skinVars=s=>`--f1:${s.f[0]};--f2:${s.f[1]};--f3:${s.f[2]};--e1:${s.e[0]};--e2:${s.e[1]}`;

  /* ---------- stjärnor och belöningar ---------- */
  const lvl=()=>Math.max(1,+lsGet('mj_lvl')||1);
  const starsMap=()=>J('mj_stars',{});
  function totalStars(){ const S=starsMap(); let t=0; for(const k in S) t+=S[k]; return t+Object.keys(J('mj_daily',{})).length; }
  function streak(){ const D=J('mj_daily',{}); let d=dayNo(); if(!D[d]) d--; let n=0; while(D[d]){ n++; d--; } return n; }
  const unlockables=()=>[...SETS.map(x=>({t:'set',x,lab:'brickor'})),...SKINS.map(x=>({t:'skin',x,lab:'brickfärg'})),...TABLES.map(x=>({t:'table',x,lab:'bord'}))].filter(u=>u.x.cost>0);
  const starsFor=(g,par)=>{ const help=(g.hints||0)+(g.shuf||0); return help===0&&g.time<=par?3:help<=2&&g.time<=par*2?2:1; };

  /* ---------- spelet ---------- */
  let mjDaily=false, mjPick=0, mjSel=-1, mjHint=null, mjHintT=0, mjTick=0, mjLockMsg=0, mjIntro='', mjBack=null, mjCombo=0, mjLastT=0, mjEnd=0;
  const showDim=()=>lsGet('mj_free')!=='0';
  GINFO.mahjong={name:'Vittangi', icon:'🀄', ai:'', max:1, desc:'Para ihop lika brickor', grad:'linear-gradient(135deg,#0f766e,#7c3aed)'};
  KIND.mahjong={
    init(){ const o={daily:mjDaily, level:mjPick||lvl()}; mjPick=0; return o; },
    start(g){ const daily=!!g.daily, n=dayNo(); g.day=daily?n:null; const seed=daily?n*7919+13:Math.floor(Math.random()*1e9), r=rng(seed);
      const d=daily?dailyDef(n):levelDef(g.level||1); g.lay=d.lay; g.par=d.par; g.pos=LAYS[d.lay].p();
      g.tk=deal(g.pos, makePairs(g.pos.length/2, d.kinds, r), r)||[]; g.alive=g.pos.map(()=>true); g.hist=[]; g.hints=0; g.shuf=0; g.mix=0; g.t0=now(); g.time=0; g.cur=0; g.left=g.pos.length; },
    valid(g){ return g.names.length===1 && Array.isArray(g.pos) && Array.isArray(g.tk) && g.tk.length===g.pos.length; },
    waitingFor(){ return 0; }, scoreOf(g){ return fmt(g); },
    apply(g,a){
      if(a.type==='resign'){ if(g.over) return false; g.over=true; g.winner=-2; g.time=Math.round((now()-g.t0)/1000); return true; }
      if(g.over) return false;
      if(a.type==='pair'){ const {i,j}=a; if(!Number.isInteger(i)||!Number.isInteger(j)||i===j||!g.alive[i]||!g.alive[j]) return false;
        if(key(g.tk[i])!==key(g.tk[j])||blocked(g.pos,g.alive,i)||blocked(g.pos,g.alive,j)) return false;
        g.alive[i]=g.alive[j]=false; g.hist.push([i,j]); g.left-=2; g.last={t:now(),type:'pair',i,j};
        if(!g.left) win(g);
        return true; }
      if(a.type==='undo'){ const h=g.hist.pop(); if(!h) return false; g.alive[h[0]]=g.alive[h[1]]=true; g.left+=2; g.last={t:now(),type:'undo',i:h[0],j:h[1]}; return true; }
      if(a.type==='hint'){ g.hints++; g.last={t:now(),type:'hint'}; return true; }
      if(a.type==='shuffle'){ // blanda kvarvarande brickor så att det fortfarande går att lösa – gratis när det inte finns några par
        const stuck=!pairs(g).length, left=g.pos.map((_,i)=>i).filter(i=>g.alive[i]); const by={}; for(const i of left){ const k=key(g.tk[i]); (by[k]=by[k]||[]).push(g.tk[i]); }
        const pl=[]; for(const k in by){ const a2=by[k]; for(let x=0;x+1<a2.length;x+=2) pl.push([a2[x],a2[x+1]]); }
        const r=rng(Math.floor(Math.random()*1e9)), sub=deal(g.pos, pl, r, g.alive.slice());
        if(sub){ for(const i of left) g.tk[i]=sub[i]; } else { const ks=left.map(i=>g.tk[i]); for(let x=ks.length-1;x>0;x--){ const y=Math.floor(r()*(x+1)); [ks[x],ks[y]]=[ks[y],ks[x]]; } left.forEach((i,x)=>{ g.tk[i]=ks[x]; }); }
        if(!stuck) g.shuf++; g.mix=(g.mix||0)+1; g.hist=[]; g.last={t:now(),type:'shuffle',free:stuck}; return true; }
      return false; },
    effects(prev,d){ if(!d.last||(prev.last&&prev.last.t===d.last.t)) return;
      if(d.over&&d.winner===0){ sfx.win(); sparkles(70); [0,1,2].forEach(i=>{ if(i<(d.stars||0)) tone(784*Math.pow(1.26,i),.35,'triangle',.11,.55+i*.38); }); return; }
      if(d.last.type==='undo') sfx.unbubble(); },
    html(){ const g=G, Lg=LAYS[g.lay], fr=new Set(freeList(g.pos,g.alive)), pr=g.over?[]:pairs(g), dim=showDim(), set=curSet(), skin=curSkin(), tab=curTable();
      let mx=0,my=0,mz=0; for(const [x,y,z] of g.pos){ mx=Math.max(mx,x+2); my=Math.max(my,y+2); mz=Math.max(mz,z); }
      const introKey=g.t0+':'+(g.mix||0), intro=mjIntro!==introKey; mjIntro=introKey;
      const order=g.pos.map((p,i)=>i).filter(i=>g.alive[i]).sort((a,b)=>g.pos[a][2]-g.pos[b][2]||g.pos[a][1]-g.pos[b][1]||g.pos[a][0]-g.pos[b][0]);
      const back=mjBack; mjBack=null;
      const tiles=order.map((i,n)=>{ const [x,y,z]=g.pos[i], f=fr.has(i), k=g.tk[i], cls=`${f?'fr':'bl'}${dim&&!f?' dim':''}${i===mjSel?' sel':''}${mjHint&&mjHint.includes(i)?' hint':''}${intro?' in':''}${back&&back.includes(i)?' back':''}`;
        return `<button class="mj-t ${cls}" data-mj="t" data-i="${i}" ${grp(k)?`data-g="${grp(k)}"`:''} style="--x:${x};--y:${y};--z:${z};--lb:${(1-(mz-z)*.045).toFixed(3)};z-index:${z*2000+y*40+x}${intro?`;animation-delay:${Math.round(n*Math.min(14,700/order.length))}ms`:''}" aria-label="${kname(k,set)}${f?'':' (låst)'}">${face(k,set)}</button>`; }).join('');
      const pct=Math.round((1-g.left/g.pos.length)*100);
      const head=`<div class="mj-head"><span class="mj-lv">${g.daily?'📅 Dagens':g.duel?'👥 Turas om':`Nivå ${g.level||1}`}</span><span class="mj-nm">${Lg.name}</span><span class="mj-tm">⏱️ <b id="mjTime">${fmt(g)}</b></span></div><div class="mj-prog"><i style="width:${pct}%"></i><span>${g.left} kvar</span></div>`;
      const board=`<div class="mj-wrap" id="mjWrap"><div class="mj-b set-${set.id}" id="mjB" style="--mx:${mx};--my:${my};--mz:${mz};${skinVars(skin)}">${tiles}</div></div>`;
      const scene=c=>`<div class="mj-scene t-${tab.id}">${c}</div>`;
      if(g.over){ const won=g.winner===0, S=g.stars||0, fresh=mjEnd!==g.t0; mjEnd=g.t0;
        return scene(head+board+`<div class="mj-end ${won?'won':''} ${fresh?'fresh':''}"><h3>${won?(g.duel||g.daily?'Bordet är tomt! 🎉':['','Bra jobbat!','Snyggt!','Perfekt! 🌟'][S]):'Avslutat'}</h3>
        ${won&&!g.duel&&!g.daily?`<div class="mj-stars">${[0,1,2].map(i=>`<span class="${i<S?'on':''}" style="animation-delay:${.5+i*.38}s">★</span>`).join('')}</div>`:''}
        ${won?`<p>Tid <b>${fmt(g)}</b>${g.hints?` · 💡 ${g.hints}`:''}${g.shuf?` · 🔀 ${g.shuf}`:''}${!g.duel&&!g.daily&&S<3?`<br><small>3 ★ = utan ledtråd och blandning, under ${Math.floor(g.par/60)}:${String(g.par%60).padStart(2,'0')}</small>`:''}${g.daily?`<br>+1 ⭐ · 🔥 ${streak()} ${streak()===1?'dag':'dagar'} i rad`:''}</p>`:''}
        ${(g.unl||[]).map(u=>`<div class="mj-new">🔓 Nytt: <b>${u.name}</b> (${u.lab}) <button data-mj="use" data-t="${u.t}" data-id="${u.id}">Använd</button></div>`).join('')}
        <div class="cbtns">${g.daily||g.duel?'':`<button class="pri" data-mj="next">▶️ ${won?'Nästa nivå':'Försök igen'}</button>`}${won&&!g.duel&&!g.daily?`<button data-mj="again">🔁 Spela igen</button>`:''}<button data-act="lobby">🏠 Lobby</button></div></div>`); }
      const stuck=!pr.length;
      return scene(head+board+(stuck?`<div class="mj-stuck">Inga par kvar att ta 🙈<br><button class="pri" data-mj="shuffle">🔀 Blanda – gratis</button></div>`:'')+
        `<div class="mj-tools"><button data-mj="undo" ${g.hist.length?'':'disabled'}><span>↶</span><small>Ångra</small></button><button data-mj="hint" ${stuck?'disabled':''}><span>💡</span><small>Ledtråd</small></button><button data-mj="shuffle"><span>🔀</span><small>Blanda</small></button><button data-mj="look"><span>🎨</span><small>Utseende</small></button></div>
        <div class="ghint">${pr.length} par går att ta · tryck på två lika fria brickor ${KIT.resignHTML()}</div>`); },
    mounted(){ fit(); clearInterval(mjTick); if(!G.over) mjTick=setInterval(()=>{ const el=document.getElementById('mjTime'); if(!el||!G||G.kind!=='mahjong'){ clearInterval(mjTick); return; } el.textContent=fmt(G); },1000); }
  };
  function win(g){ g.over=true; g.winner=0; g.time=Math.round((now()-g.t0)/1000);
    const T=J('mj_stats',{}); T.won=(T.won||0)+1; lsSet('mj_stats',JSON.stringify(T));
    if(g.duel) return;
    const before=totalStars();
    if(g.daily){ const D=J('mj_daily',{}); if(!D[g.day]||D[g.day]>g.time) D[g.day]=g.time; lsSet('mj_daily',JSON.stringify(D)); g.stars=0; }
    else { const S=starsMap(), n=g.level||1; g.stars=starsFor(g,g.par); if(!S[n]||S[n]<g.stars) S[n]=g.stars; lsSet('mj_stars',JSON.stringify(S)); if(n>=lvl()) lsSet('mj_lvl',String(n+1)); }
    const after=totalStars(); g.unl=unlockables().filter(u=>u.x.cost>before&&u.x.cost<=after).map(u=>({t:u.t,id:u.x.id,name:u.x.name,lab:u.lab})); }
  const fmt=g=>{ const s=g.over?g.time:Math.round((now()-g.t0)/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
  // brädet skalas så att brickorna blir så stora som möjligt på skärmen
  function fit(){ const w=document.getElementById('mjWrap'), b=document.getElementById('mjB'); if(!w||!b) return;
    const mx=+b.style.getPropertyValue('--mx'), my=+b.style.getPropertyValue('--my'), mz=+b.style.getPropertyValue('--mz'), W=w.clientWidth, top=w.getBoundingClientRect().top+scrollY;
    const below=[...document.querySelectorAll('.mj-tools,.mj-scene>.ghint,.mj-stuck,.mj-end')].reduce((s,e)=>s+e.offsetHeight+8,0);
    const H=Math.max(240, innerHeight-top-below-16), A=1.3, dz=.11;
    const tw=Math.min(104, (W-4)/(mx/2+mz*dz+.12), H/((my/2)*A+mz*dz+.16)), th=tw*A;
    b.style.setProperty('--tw',tw+'px'); b.style.setProperty('--th',th+'px'); b.style.setProperty('--dz',(tw*dz)+'px');
    b.style.width=(mx/2*tw+mz*tw*dz+tw*.12)+'px'; const bh=my/2*th+mz*tw*dz+tw*.16; b.style.height=bh+'px'; w.style.marginTop=Math.max(2,Math.min(80,(H-bh)/2))+'px'; w.style.marginBottom=Math.max(6,Math.min(80,(H-bh)/2))+'px'; }
  addEventListener('resize',()=>{ if(G&&G.kind==='mahjong'&&view==='game') fit(); });

  /* ---------- känsla: ljud, partiklar, brickor som flyger ihop ---------- */
  function clack(){ try{ hit(0,3000,.45,.022); hit(.01,1700,.28,.03); tone(2200,.035,'triangle',.03); }catch(e){} }
  function chime(c){ const N=[523,587,659,784,880,1047,1175,1319,1568,1760], f=N[Math.min(N.length-1,c-1)]; tone(f,.22,'sine',.12); tone(f*1.5,.3,'triangle',.05,.05); if(c>=3) tone(f*2,.35,'sine',.04,.11); }
  function burst(x,y,n,col){ for(let i=0;i<n;i++){ const s=document.createElement('i'), a=Math.random()*6.283, d=30+Math.random()*60; s.className='mj-spark'; s.textContent=Math.random()<.5?'✦':'•';
      s.style.cssText=`left:${x}px;top:${y}px;color:${col[i%col.length]};font-size:${10+Math.random()*12}px`; document.body.appendChild(s);
      if(!s.animate){ setTimeout(()=>s.remove(),500); continue; }
      s.animate([{transform:'translate(-50%,-50%) scale(.4)',opacity:1},{transform:`translate(calc(-50% + ${Math.cos(a)*d}px),calc(-50% + ${Math.sin(a)*d}px)) scale(1)`,opacity:0}],{duration:520+Math.random()*260,easing:'cubic-bezier(.2,.7,.3,1)'}).onfinish=()=>s.remove(); } }
  function floatText(x,y,t){ const s=document.createElement('div'); s.className='mj-float'; s.textContent=t; s.style.left=x+'px'; s.style.top=y+'px'; document.body.appendChild(s); setTimeout(()=>s.remove(),1100); }
  function flyPair(A,B){ const bd=document.getElementById('mjB'); if(!A||!B||!bd||!A.animate) return null; const ra=A.getBoundingClientRect(), rb=B.getBoundingClientRect(), mx=(ra.left+ra.right+rb.left+rb.right)/4, my=(ra.top+ra.bottom+rb.top+rb.bottom)/4;
    const vars=bd.getAttribute('style');
    [[A,ra,-1],[B,rb,1]].forEach(([el,r,s])=>{ const c=el.cloneNode(true), host=document.createElement('div'); host.className='mj-fly '+bd.className; host.setAttribute('style',vars); host.style.width=host.style.height='0';
      c.classList.remove('sel','hint','in','dim','back'); c.style.cssText+=`;left:${r.left}px;top:${r.top}px;z-index:1;animation:none`; host.appendChild(c); document.body.appendChild(host);
      const tx=mx+s*r.width*.52-(r.left+r.width/2), ty=my-(r.top+r.height/2);
      c.animate([{transform:'none'},{transform:'translateY(-8px) scale(1.1)',offset:.25},{transform:`translate(${tx}px,${ty-6}px) scale(1.08)`,offset:.75},{transform:`translate(${tx}px,${ty}px) scale(.3)`,opacity:0}],{duration:430,easing:'ease-in-out'}).onfinish=()=>host.remove(); });
    A.style.visibility=B.style.visibility='hidden';
    setTimeout(()=>burst(mx,my,14,['#fde047','#fff','#f472b6','#67e8f9']),330); return [mx,my]; }

  function flash(el,cls){ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(()=>el.classList.remove(cls),450); }
  const tileEl=i=>document.querySelector(`.mj-t[data-i="${i}"]`);
  function setSel(i){ document.querySelectorAll('.mj-t.sel').forEach(e=>e.classList.remove('sel')); mjSel=i; if(i>=0){ const e=tileEl(i); if(e){ e.classList.remove('in','back'); e.classList.add('sel'); } } }
  function setHint(p){ document.querySelectorAll('.mj-t.hint').forEach(e=>e.classList.remove('hint')); mjHint=p; if(p) p.forEach(i=>{ const e=tileEl(i); if(e){ e.classList.remove('in','back'); e.classList.add('hint'); } }); }
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-mj]'); if(!b) return; const a=b.dataset.mj;
    if(a==='daily'||a==='play'){ mjDaily=a==='daily'; if(a==='play') mjPick=+b.dataset.lv||0; mjSel=-1; mjHint=null; mjCombo=0; unlockAudio(); KIT.startSolo('mahjong',lsGet('ry_name')||'Du'); return; }
    if(a==='free'){ lsSet('mj_free',showDim()?'0':'1'); if(G&&G.kind==='mahjong'&&view==='game') render(); return; }
    if(a==='look'){ showLook(); return; }
    if(a==='menu'){ showMahjongMenu(); return; }
    if(a==='pickl'){ const u=unlockables().find(x=>x.t===b.dataset.t&&x.x.id===b.dataset.id); if(u&&u.x.cost>totalStars()){ toast(`Låses upp vid ${u.x.cost} ⭐ – du har ${totalStars()}`); buzz(20); return; }
      lsSet('mj_'+b.dataset.t,b.dataset.id); sfx.pick(); if(G&&G.kind==='mahjong'&&view==='game') render(); showLook(); return; }
    if(a==='use'){ lsSet('mj_'+b.dataset.t,b.dataset.id); sfx.pick(); b.textContent='✓ Vald'; b.disabled=true; if(G&&G.kind==='mahjong') setTimeout(()=>render(),250); return; }
    if(!G||G.kind!=='mahjong') return;
    if(a==='next'){ mjDaily=false; mjSel=-1; mjHint=null; mjCombo=0; mjPick=G.winner===0?(G.level||1)+1:(G.level||1); KIT.startSolo('mahjong',G.names[0]); return; }
    if(a==='again'){ mjDaily=!!G.daily; mjPick=G.level||1; mjSel=-1; mjHint=null; mjCombo=0; KIT.startSolo('mahjong',G.names[0]); return; }
    if(a==='undo'){ const h=G.hist[G.hist.length-1]; setSel(-1); setHint(null); if(h) mjBack=h; doAct({type:'undo'}); return; }
    if(a==='shuffle'){ setSel(-1); setHint(null); const bd=document.getElementById('mjB'); if(bd) bd.classList.add('shuf'); tone(300,.4,'sine',.08,0,900); hit(0,2400,.3,.2); setTimeout(()=>doAct({type:'shuffle'}),330); return; }
    if(a==='hint'){ const p=pairs(G); if(!p.length) return; setSel(-1); setHint(p[Math.floor(Math.random()*p.length)]); clearTimeout(mjHintT); mjHintT=setTimeout(()=>setHint(null),3000); tone(880,.2,'sine',.08); tone(1320,.3,'sine',.06,.12); doAct({type:'hint'}); return; }
    if(a==='t'){ if(G.over) return; const i=+b.dataset.i;
      if(blocked(G.pos,G.alive,i)){ flash(b,'no'); buzz(20); tone(150,.12,'triangle',.12); if(mjLockMsg++<2) toast('Låst – en bricka är fri när inget ligger ovanpå och vänster eller höger sida är fri'); return; }
      clack();
      if(mjSel===i){ setSel(-1); return; }
      if(mjSel>=0 && key(G.tk[mjSel])===key(G.tk[i])){ const j=mjSel; setSel(-1); setHint(null);
        const t=now(); mjCombo=t-mjLastT<3200?mjCombo+1:1; mjLastT=t; chime(mjCombo); buzz(12);
        const m=flyPair(tileEl(j),b); if(m&&mjCombo>=3) floatText(m[0],m[1]-30,`Kombo ×${mjCombo}!`);
        setTimeout(()=>doAct({type:'pair',i:j,j:i}),140); return; }
      if(mjSel>=0) flash(tileEl(mjSel),'no');
      setSel(i); } });

  /* ---------- menyer ---------- */
  function calendar(){ const D=J('mj_daily',{}), t=new Date(new Date().toLocaleString('en-US',{timeZone:'Europe/Stockholm'})), y=t.getFullYear(), m=t.getMonth(), days=new Date(y,m+1,0).getDate(), off=(new Date(y,m,1).getDay()+6)%7, d0=Math.floor(Date.UTC(y,m,1)/864e5);
    const mon=['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'][m], done=Object.keys(D).filter(k=>+k>=d0&&+k<d0+days).length;
    let h=`<div class="mj-cal"><div class="mj-calh">📅 ${mon} · ${done} av ${days} dagar</div>${['M','T','O','T','F','L','S'].map(x=>`<b>${x}</b>`).join('')}${'<i></i>'.repeat(off)}`;
    for(let d=1;d<=days;d++){ const n=d0+d-1; h+=`<i class="${D[n]?'ok':''} ${n===dayNo()?'td':''}">${D[n]?'★':d}</i>`; } return h+'</div>'; }
  window.showMahjongMenu=function(){ const n=lvl(), S=starsMap(), tot=totalStars(), D=J('mj_daily',{}), today=D[dayNo()], d=levelDef(n), sk=streak();
    const next=unlockables().filter(u=>u.x.cost>tot).sort((a,b)=>a.x.cost-b.x.cost)[0];
    const maxShow=Math.max(n+3,12); let map='';
    for(let l=1;l<=maxShow;l++){ const s=S[l]||0, open=l<=n; map+=`<button class="mj-lvb ${open?'':'lk'} ${l===n?'cur':''}" ${open?`data-mj="play" data-lv="${l}"`:'disabled'}><b>${open?l:'🔒'}</b><small>${open?'★'.repeat(s)+'☆'.repeat(3-s):l}</small></button>`; }
    openModal(`<div class="mj-menu"><h3>🀄 Vittangi</h3>
      <div class="mj-sum"><span>⭐ <b>${tot}</b> stjärnor</span>${sk?`<span>🔥 <b>${sk}</b> ${sk===1?'dag':'dagar'} i rad</span>`:''}</div>
      ${next?`<div class="mj-nextu">Nästa belöning: <b>${next.x.name}</b> (${next.lab}) vid ${next.x.cost} ⭐<i style="width:${Math.round(tot/next.x.cost*100)}%"></i></div>`:''}
      <div class="btns" style="flex-direction:column"><button class="pri" data-mj="play">▶️ Spela nivå ${n} · ${LAYS[d.lay].name}</button>
      <button class="pri mj-dbtn" data-mj="daily">📅 Dagens bricka ${today?'✅':'· ny!'}</button></div>
      <div class="mj-map">${map}</div>
      ${calendar()}
      <div class="btns" style="flex-direction:column"><button data-mj="look">🎨 Utseende – brickor, färger och bord</button>${typeof DUEL!=='undefined'?DUEL.btn('mahjong'):''}<button data-act="close">Stäng</button></div>
      <details class="mj-how"><summary>Hur spelar man?</summary><p>Para ihop två likadana brickor som är <b>fria</b>. En bricka är fri när inget ligger ovanpå den och den är fri på vänster eller höger sida. Töm hela bordet! Brickor med <b style="color:#f59e0b">guldhörn</b> passar ihop med varandra, och brickor med <b style="color:#0ea5e9">blått hörn</b> med varandra.</p><p>⭐⭐⭐ får du utan ledtrådar och blandningar och under måltiden. Är det stopp kostar det inget att blanda. Varje dagens bricka ger en extra stjärna. Stjärnorna låser upp nya brickor, färger och bord.</p>
      <label class="mj-opt"><input type="checkbox" data-mj="free" ${showDim()?'checked':''}> Visa låsta brickor lite mörkare</label></details></div>`,'mjmenu');
    const cur=document.querySelector('.mj-lvb.cur'); if(cur&&cur.scrollIntoView) cur.scrollIntoView({block:'nearest',inline:'center'}); };
  function showLook(){ const tot=totalStars(), set=curSet(), skin=curSkin(), tab=curTable(), inGame=G&&G.kind==='mahjong'&&view==='game';
    const opt=(t,x,sel,prev)=>{ const lk=x.cost>tot; return `<button class="mj-lo ${sel?'on':''} ${lk?'lk':''}" data-mj="pickl" data-t="${t}" data-id="${x.id}">${prev}<span>${x.name}</span><small>${lk?`🔒 ${x.cost} ⭐`:sel?'✓ vald':''}</small></button>`; };
    const sample=(s,sk,ks)=>`<div class="mj-pv set-${s.id}" style="${skinVars(sk)}">${ks.map(k=>`<span class="mj-t fr">${face(k,s)}</span>`).join('')}</div>`;
    openModal(`<div class="mj-menu"><h3>🎨 Utseende</h3><div class="mj-sum"><span>⭐ <b>${tot}</b> stjärnor</span></div>
      <h4>Brickor</h4><div class="mj-looks">${SETS.map(s=>opt('set',s,s.id===set.id,sample(s,skin,s.id==='klassisk'?[0,31]:[0,25]))).join('')}</div>
      <h4>Brickfärg</h4><div class="mj-looks">${SKINS.map(s=>opt('skin',s,s.id===skin.id,sample(set,s,[set.id==='klassisk'?4:2]))).join('')}</div>
      <h4>Bord</h4><div class="mj-looks">${TABLES.map(t=>opt('table',t,t.id===tab.id,`<div class="mj-tb t-${t.id}"></div>`)).join('')}</div>
      <div class="btns" style="flex-direction:column">${inGame?'<button class="pri" data-act="close">▶️ Tillbaka till spelet</button>':'<button class="pri" data-mj="menu">← Tillbaka</button>'}</div></div>`,'mjlook'); }
  GINFO.mahjong.menu=()=>showMahjongMenu();
  GINFO.mahjong.duel=n=>{ mjDaily=false; mjPick=lvl(); mjSel=-1; mjHint=null; KIT.startSolo('mahjong',n); };
  window.MJ={LAYS, SETS, SKINS, TABLES, blocked, pairs, deal, makePairs, levelDef, face, totalStars, starsFor};

  /* ---------- utseende ---------- */
  st.textContent=`
.mj-scene::before{content:'';position:fixed;top:0;right:0;bottom:0;left:0;z-index:-1;pointer-events:none}
.t-norrsken::before,.mj-tb.t-norrsken{background:radial-gradient(60% 35% at 30% 18%,rgba(52,211,153,.55),transparent 70%),radial-gradient(50% 30% at 75% 10%,rgba(167,139,250,.45),transparent 70%),radial-gradient(70% 30% at 60% 30%,rgba(45,212,191,.35),transparent 70%),radial-gradient(1px 1px at 12% 40%,#fff,transparent),radial-gradient(1px 1px at 82% 55%,#fff,transparent),radial-gradient(1.5px 1.5px at 45% 70%,#fff,transparent),radial-gradient(1px 1px at 68% 85%,#fff,transparent),linear-gradient(180deg,#071028,#0b1c3a 55%,#0d2440)}
.t-norrsken::before{background-size:200% 200%,200% 200%,200% 200%,auto,auto,auto,auto,auto;animation:mjaur 26s ease-in-out infinite alternate}
@keyframes mjaur{0%{background-position:0% 0%,100% 0%,50% 0%,0 0,0 0,0 0,0 0,0 0}100%{background-position:60% 20%,30% 30%,0% 20%,0 0,0 0,0 0,0 0,0 0}}
.t-filt::before,.mj-tb.t-filt{background:radial-gradient(ellipse at 50% 40%,#1f7a4d,#0f4d2f 60%,#06291a)}
.mj-tb.t-rymd{background:radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 60%,#fff,transparent),radial-gradient(circle at 80% 20%,#3b2a7a,transparent 50%),#0a1030}
.t-solnedgang::before,.mj-tb.t-solnedgang{background:radial-gradient(circle at 50% 75%,rgba(253,224,71,.55),transparent 35%),linear-gradient(180deg,#2e1065,#7c2d72 35%,#db5f3c 70%,#f59e0b)}
.t-fjallsjo::before,.mj-tb.t-fjallsjo{background:linear-gradient(170deg,transparent 52%,rgba(255,255,255,.08) 52%),linear-gradient(195deg,transparent 58%,rgba(255,255,255,.06) 58%),linear-gradient(180deg,#5b9cc4,#3b7fab 45%,#1f5d85 62%,#123c5a)}
.t-korall::before,.mj-tb.t-korall{background:radial-gradient(40% 25% at 20% 100%,rgba(251,113,133,.5),transparent),radial-gradient(35% 22% at 85% 100%,rgba(251,146,60,.45),transparent),radial-gradient(120% 60% at 50% -10%,rgba(125,211,252,.55),transparent 60%),linear-gradient(180deg,#0e7490,#0c4a6e 70%,#082f49)}
.t-lavendel::before,.mj-tb.t-lavendel{background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.2),transparent 40%),linear-gradient(160deg,#8b6fd6,#6d43c9 50%,#3f1a8a)}
.t-tra::before,.mj-tb.t-tra{background:repeating-linear-gradient(92deg,rgba(0,0,0,.07) 0 3px,transparent 3px 19px),repeating-linear-gradient(88deg,rgba(255,255,255,.05) 0 2px,transparent 2px 33px),linear-gradient(180deg,#7a4e2a,#5e381d 60%,#40240f)}
.mj-head{display:flex;align-items:center;gap:8px;font-size:14px;margin:2px 2px 4px}
.mj-lv{padding:3px 10px;border-radius:999px;background:linear-gradient(135deg,#0f766e,#7c3aed);font-weight:700;color:#fff;white-space:nowrap}
.mj-nm{flex:1;font-weight:600;opacity:.9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mj-tm{white-space:nowrap;font-variant-numeric:tabular-nums}
.mj-prog{position:relative;height:16px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden;margin:0 2px 6px;box-shadow:inset 0 1px 3px rgba(0,0,0,.35)}
.mj-prog i{position:absolute;top:0;bottom:0;left:0;border-radius:999px;background:linear-gradient(90deg,#34d399,#fde047);transition:width .5s cubic-bezier(.2,.8,.3,1);box-shadow:0 0 10px rgba(253,224,71,.5)}
.mj-prog span{position:relative;display:block;text-align:center;font-size:11px;line-height:16px;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.7)}
.mj-wrap{display:flex;justify-content:center;margin:2px 0 6px;transition:margin .3s;touch-action:manipulation;-webkit-user-select:none;user-select:none}
.mj-b{position:relative}
.mj-t{position:absolute;left:calc(var(--x)*var(--tw)/2 + (var(--mz) - var(--z))*var(--dz));top:calc(var(--y)*var(--th)/2 + (var(--mz) - var(--z))*var(--dz));width:var(--tw);height:var(--th);padding:0;border:0;
  border-radius:calc(var(--tw)*.13);color:#111;cursor:pointer;-webkit-tap-highlight-color:transparent;
  background:radial-gradient(120% 80% at 25% 10%,rgba(255,255,255,.95),transparent 55%),linear-gradient(155deg,var(--f1),var(--f2) 60%,var(--f3));
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.10),inset 0 calc(var(--tw)*-.03) 0 rgba(0,0,0,.06),calc(var(--tw)*.04) calc(var(--tw)*.045) 0 var(--e1),calc(var(--tw)*.08) calc(var(--tw)*.09) 0 var(--e2),calc(var(--tw)*(.1 + var(--z)*.04)) calc(var(--tw)*(.15 + var(--z)*.05)) calc(var(--tw)*(.14 + var(--z)*.06)) rgba(0,0,0,calc(.42 + var(--z)*.06));
  transition:filter .18s,transform .14s,box-shadow .18s}
.mj-t:active{transform:scale(.97)}
.mj-t svg{position:absolute;top:3%;left:3%;width:94%;height:94%}
.mj-e{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;font-size:calc(var(--tw)*.66);line-height:1;font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;filter:drop-shadow(0 1px 1px rgba(0,0,0,.18))}
.mj-t[data-g]::after{content:'';position:absolute;top:0;right:0;width:calc(var(--tw)*.3);height:calc(var(--tw)*.3);border-top-right-radius:calc(var(--tw)*.13);background:linear-gradient(225deg,var(--gc) 50%,transparent 50%)}
.mj-t[data-g=F]{--gc:#f59e0b}.mj-t[data-g=S]{--gc:#0ea5e9}
.mj-t{filter:brightness(var(--lb,1))}.mj-t.dim{filter:brightness(calc(var(--lb,1)*.72)) saturate(.7)}
.mj-t.sel{transform:translate(calc(var(--tw)*-.03),calc(var(--tw)*-.07));filter:brightness(1.06);box-shadow:inset 0 0 0 3px #f59e0b,0 0 0 2px #fde047,0 0 18px 4px rgba(253,224,71,.65),calc(var(--tw)*.07) calc(var(--tw)*.1) 0 var(--e2),calc(var(--tw)*.1) calc(var(--tw)*.2) calc(var(--tw)*.2) rgba(0,0,0,.45)}
.mj-t.hint{animation:mjh 1s ease-in-out infinite}@keyframes mjh{50%{box-shadow:inset 0 0 0 3px #22c55e,0 0 0 2px #86efac,0 0 22px 6px rgba(34,197,94,.8)}}
.mj-t.no{animation:mjn .4s}@keyframes mjn{20%{transform:translateX(-5px) rotate(-2deg)}60%{transform:translateX(5px) rotate(2deg)}}
.mj-t.in{animation:mjin .45s cubic-bezier(.2,.9,.3,1.2) both}@keyframes mjin{from{transform:translateY(-40px) scale(.7) rotate(-6deg);opacity:0}}
.mj-t.back{animation:mjbk .4s cubic-bezier(.2,.9,.3,1.3)}@keyframes mjbk{from{transform:scale(.3);opacity:0}}
.mj-b.shuf .mj-t{transition:transform .32s ease-in,opacity .32s;transform:translate(calc((var(--mx)/2 - var(--x))*var(--tw)/2),calc((var(--my)/2 - var(--y))*var(--th)/2)) rotate(25deg) scale(.6);opacity:.2}
.mj-fly{position:fixed;left:0;top:0;z-index:50;pointer-events:none}.mj-fly .mj-t{position:fixed}
.mj-spark{position:fixed;z-index:51;pointer-events:none;font-style:normal;text-shadow:0 0 8px currentColor}
.mj-float{position:fixed;z-index:52;transform:translate(-50%,-50%);pointer-events:none;font:800 22px 'Fredoka',system-ui,sans-serif;color:#fde047;text-shadow:0 2px 0 #b45309,0 0 14px rgba(253,224,71,.8);animation:mjfl 1.1s ease-out forwards;white-space:nowrap}
@keyframes mjfl{0%{transform:translate(-50%,-30%) scale(.6);opacity:0}20%{transform:translate(-50%,-50%) scale(1.15);opacity:1}100%{transform:translate(-50%,-160%) scale(1);opacity:0}}
.mj-tools{display:flex;gap:8px;justify-content:center;margin:6px 0 2px}
.mj-scene>.ghint{text-shadow:0 1px 3px rgba(0,0,0,.9);color:#fff;opacity:.92}.mj-head,.mj-tools{text-shadow:0 1px 3px rgba(0,0,0,.6)}
.mj-tools button{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:68px;padding:7px 8px 6px;border-radius:16px;background:rgba(8,14,34,.38);color:#fff!important;border:1px solid rgba(255,255,255,.22);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:inherit}
.mj-tools button span{font-size:22px;line-height:1.1}.mj-tools button small{font-size:11px;opacity:.9}.mj-tools button:disabled{opacity:.4}
.mj-stuck{margin:6px auto;max-width:420px;text-align:center;padding:10px;border-radius:16px;background:rgba(245,158,11,.22);border:1px solid rgba(245,158,11,.55)}
.mj-stuck .pri{margin-top:8px}
.mj-end{margin:8px auto;max-width:440px;text-align:center;padding:14px;border-radius:22px;background:rgba(10,20,45,.72);border:1px solid rgba(255,255,255,.18);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.mj-end h3{margin:2px 0 6px;font-size:24px}
.mj-stars{font-size:46px;letter-spacing:6px;line-height:1.1}.mj-stars span{display:inline-block;color:rgba(255,255,255,.18)}.fresh .mj-stars span{animation:mjst .5s cubic-bezier(.2,.9,.3,1.5) both}
.mj-stars span.on{color:#fde047;text-shadow:0 0 16px rgba(253,224,71,.8),0 3px 0 #b45309}@keyframes mjst{from{transform:scale(0) rotate(-90deg);opacity:0}}
.mj-new{margin:8px auto;padding:8px 10px;border-radius:14px;background:linear-gradient(135deg,rgba(124,58,237,.5),rgba(15,118,110,.5));border:1px solid rgba(255,255,255,.25)}.fresh .mj-new{animation:mjnw .5s 1.6s both}@keyframes mjnw{from{transform:scale(.6);opacity:0}}
.mj-new button{margin-left:6px;padding:5px 12px;border-radius:12px}
.mj-menu h3{margin:0 0 6px}.mj-menu h4{margin:12px 0 6px;font-size:14px;opacity:.85}
.mj-sum{display:flex;gap:14px;justify-content:center;font-size:15px;margin-bottom:6px}
.mj-nextu{position:relative;font-size:12.5px;text-align:center;padding:6px 8px 9px;border-radius:12px;background:rgba(255,255,255,.08);margin-bottom:8px;overflow:hidden}
.mj-nextu i{position:absolute;left:0;bottom:0;height:3px;background:linear-gradient(90deg,#34d399,#fde047)}
.mj-dbtn{background:linear-gradient(135deg,#f59e0b,#b45309)!important}
.mj-map{display:flex;gap:6px;overflow-x:auto;padding:8px 2px 6px;scroll-snap-type:x mandatory}
.mj-lvb{flex:0 0 52px;scroll-snap-align:center;display:flex;flex-direction:column;align-items:center;padding:6px 0 4px;border-radius:14px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:inherit}
.mj-lvb b{font-size:17px}.mj-lvb small{font-size:10px;color:#fde047;letter-spacing:-1px}.mj-lvb.cur{background:linear-gradient(135deg,#0f766e,#7c3aed);box-shadow:0 0 0 2px #fde047}.mj-lvb.lk{opacity:.45}.mj-lvb.lk small{color:inherit}
.mj-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;font-size:11px;text-align:center;margin:6px 0 4px}
.mj-calh{grid-column:1/-1;font-weight:700;font-size:12.5px;margin-bottom:2px}.mj-cal b{opacity:.6}.mj-cal i{font-style:normal;padding:3px 0;border-radius:7px;background:rgba(255,255,255,.06)}
.mj-cal i.ok{background:rgba(253,224,71,.25);color:#fde047}.mj-cal i.td{box-shadow:inset 0 0 0 1.5px #34d399}.mj-cal i:empty{background:none}
.mj-how{margin-top:8px;font-size:13px}.mj-how summary{cursor:pointer;font-weight:700}
.mj-opt{display:flex;gap:8px;align-items:center;font-size:13px;margin:6px 0}
.mj-looks{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mj-lo{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px 6px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:inherit}
.mj-lo span{font-size:12px;font-weight:600}.mj-lo small{font-size:10.5px;opacity:.85;min-height:13px}.mj-lo.on{box-shadow:0 0 0 2px #fde047;background:rgba(253,224,71,.12)}.mj-lo.lk>div{filter:grayscale(.7) brightness(.7)}
.mj-pv{display:flex;gap:4px;justify-content:center;height:50px;--tw:34px;--th:44px;--dz:2px;--mz:0;--z:0;--x:0;--y:0}
.mj-pv .mj-t{position:relative;left:auto;top:auto;display:inline-block;flex:0 0 auto}
.mj-tb{width:78px;height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.25)}`;
})();
