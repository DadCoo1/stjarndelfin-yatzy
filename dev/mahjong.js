/* =====================================================================
   mahjong.js – Vittangi – mahjong-patiens: para ihop två lika, fria brickor tills bordet är tomt.
   Egen design: egna ritade brickor (stora och tydliga, med siffra i hörnet), egna bord.
   Varje giv går alltid att lösa (brickorna läggs ut baklänges från en lösning).
   Ledtråd, ångra, blanda, dagens bricka och nivåer som blir svårare. Ensamspel, offline.
   ===================================================================== */
'use strict';
(function(){
  const now=()=>Date.now();
  const st=document.createElement('style'); document.head.appendChild(st);
  const dayNo=()=>{ const d=new Date(new Date().toLocaleString('en-US',{timeZone:'Europe/Stockholm'})); return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5); };
  function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

  /* ---------- borden: brickor i halva brickbredder (x, y) och lager (z) ---------- */
  const rect=(c,r,dx,dy,z)=>{ const o=[]; for(let j=0;j<r;j++) for(let i=0;i<c;i++) o.push([dx+i*2,dy+j*2,z]); return o; };
  const mask=(rows,dx,dy,z)=>{ const o=[]; rows.forEach((s,j)=>[...s].forEach((ch,i)=>{ if(ch==='#') o.push([dx+i*2,dy+j*2,z]); })); return o; };
  const centered=(lens,z,dy)=>{ const m=Math.max(...lens), o=[]; lens.forEach((n,j)=>{ for(let i=0;i<n;i++) o.push([(m-n)+i*2,(dy||0)+j*2,z]); }); return o; };
  const LAYS=[
    {id:'torn',   name:'Lilla tornet',    p:()=>[...rect(4,5,0,0,0),...rect(2,2,2,3,1)]},
    {id:'diamant',name:'Diamanten',       p:()=>[...centered([2,3,4,5,4,3,2],0),[4,6,1]]},
    {id:'pyramid',name:'Pyramiden',       p:()=>[...rect(6,6,0,0,0),...rect(4,4,2,2,1),...rect(2,2,4,4,2)]},
    {id:'fjaril', name:'Fjärilen',        p:()=>[...mask(['##..##','######','######','.####.','######','######','##..##'],0,0,0),...rect(4,2,2,2,1),...rect(4,2,2,8,1),...rect(2,2,4,5,2)]},
    {id:'borg',   name:'Borgen',          p:()=>[...rect(6,8,0,0,0),...rect(4,6,2,2,1),[0,0,1],[10,0,1],[0,14,1],[10,14,1],[0,0,2],[10,0,2],[0,14,2],[10,14,2]]},
    {id:'bro',    name:'Trappan',         p:()=>[...rect(7,6,0,0,0),...rect(6,5,1,1,1),...rect(5,4,2,2,2),...rect(4,3,3,3,3)]},
    {id:'stor',   name:'Stora pyramiden', p:()=>[...rect(7,8,0,0,0),...rect(5,6,2,2,1),...rect(3,4,4,4,2),...rect(1,2,6,6,3)]}
  ];
  // nivå → bord och hur många olika sorters brickor (fler sorter = svårare att hitta par)
  const levelDef=n=>{ const i=Math.min(LAYS.length-1, Math.floor((n-1)/2)); const L=LAYS[i], cnt=L.p().length; return {lay:i, kinds:Math.min(42, Math.max(6, Math.round(cnt/4)+Math.floor((n-1)%2*cnt/16)+(n>14?6:0)))}; };

  /* ---------- brickorna: 0–8 cirklar, 9–17 bambu, 18–26 tecken, 27–30 vindar, 31–33 drakar, 34–37 blommor, 38–41 årstider ---------- */
  const key=k=>k<34?k:k<38?'F':'S';            // blommor passar ihop med varandra, årstider med varandra
  const KINDS_ORDER=[0,9,18,27,31,1,10,19,28,32,2,11,20,29,33,3,12,21,30,4,13,22,5,14,23,6,15,24,7,16,25,8,17,26,34,38];
  function blocked(pos,alive,i){ const [x,y,z]=pos[i]; let L=false, R=false;
    for(let j=0;j<pos.length;j++){ if(j===i||!alive[j]) continue; const [a,b,c]=pos[j];
      if(c===z+1 && Math.abs(a-x)<2 && Math.abs(b-y)<2) return true;
      if(c===z && Math.abs(b-y)<2){ if(a===x-2) L=true; else if(a===x+2) R=true; } }
    return L&&R; }
  const freeList=(pos,alive)=>pos.map((_,i)=>i).filter(i=>alive[i]&&!blocked(pos,alive,i));
  function pairs(g){ const f=freeList(g.pos,g.alive), by={}; for(const i of f){ const k=key(g.tk[i]); (by[k]=by[k]||[]).push(i); } const o=[]; for(const k in by){ const a=by[k]; for(let x=0;x<a.length;x++) for(let y=x+1;y<a.length;y++) o.push([a[x],a[y]]); } return o; }
  // lägg ut brickorna baklänges från en lösning: plocka två fria platser i taget och ge dem ett par
  function deal(pos, pairList, r, alive0){ const n=pos.length;
    for(let tries=0;tries<80;tries++){ const alive=alive0?alive0.slice():pos.map(()=>true), kind=new Array(n).fill(-1), pl=pairList.slice(), ord=[]; for(let i=pl.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [pl[i],pl[j]]=[pl[j],pl[i]]; }
      let ok=true; for(const pr of pl){ const f=freeList(pos,alive); if(f.length<2){ ok=false; break; }
        const ia=Math.floor(r()*f.length)%f.length, a=f[ia], b=f[(ia+1+Math.floor(r()*(f.length-1)))%f.length];
        kind[a]=pr[0]; kind[b]=pr[1]; alive[a]=false; alive[b]=false; ord.push([a,b]); }
      if(ok){ deal.order=ord; return kind; } }
    return null; }
  function makePairs(nPairs, nKinds, r){ const ks=KINDS_ORDER.slice(0,Math.max(3,Math.min(KINDS_ORDER.length,nKinds))), o=[]; let fl=0, se=0;
    for(let p=0;p<nPairs;p++){ const k=ks[p%ks.length]; if(k===34){ o.push([34+fl%4,34+(fl+1)%4]); fl+=2; } else if(k===38){ o.push([38+se%4,38+(se+1)%4]); se+=2; } else o.push([k,k]); }
    return o; }

  /* ---------- brickornas bilder (egna, ritade som SVG) ---------- */
  const CN=['一','二','三','四','五','六','七','八','九'], WIND=[['東','Ö'],['南','S'],['西','V'],['北','N']];
  const DOT=[[[50,60]],[[50,36],[50,84]],[[28,30],[50,60],[72,90]],[[30,36],[70,36],[30,84],[70,84]],[[30,32],[70,32],[50,60],[30,88],[70,88]],[[32,30],[68,30],[32,60],[68,60],[32,90],[68,90]],
    [[26,24],[50,34],[74,44],[34,70],[66,70],[34,96],[66,96]],[[32,24],[68,24],[32,48],[68,48],[32,72],[68,72],[32,96],[68,96]],[[26,28],[50,28],[74,28],[26,60],[50,60],[74,60],[26,92],[50,92],[74,92]]];
  const DC=['#1d4ed8','#15803d','#dc2626'];
  const FACE={};
  function face(k){ if(FACE[k]) return FACE[k]; let s='', idx='';
    if(k<9){ const n=k+1; DOT[k].forEach(([x,y],i)=>{ const c=n===1?'#dc2626':DC[(i+(n>4?1:0))%3], r=n===1?20:n<=4?13:n<=6?11:10; s+=`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${n===1?5:4}"/><circle cx="${x}" cy="${y}" r="${r*.42}" fill="${c}"/>`; }); idx=n; }
    else if(k<18){ const n=k-8; if(n===1){ s=`<path d="M50 18c-14 0-22 12-20 24 2 10 10 16 20 18-10 4-16 12-14 22 1 8 8 14 14 14s13-6 14-14c2-10-4-18-14-22 10-2 18-8 20-18 2-12-6-24-20-24z" fill="#16a34a"/><circle cx="44" cy="36" r="4" fill="#fff"/><path d="M58 30l14-4-10 10z" fill="#dc2626"/><path d="M36 92l14 10 14-10" stroke="#dc2626" stroke-width="5" fill="none"/>`; }
      else { const L=[[],[],[[50,34],[50,84]],[[50,30],[30,86],[70,86]],[[32,34],[68,34],[32,86],[68,86]],[[28,34],[72,34],[50,60],[28,86],[72,86]],[[28,34],[50,34],[72,34],[28,86],[50,86],[72,86]],[[50,24],[28,60],[50,60],[72,60],[28,96],[50,96],[72,96]],[[24,36],[42,30],[58,30],[76,36],[24,84],[42,90],[58,90],[76,84]],[[28,30],[50,30],[72,30],[28,60],[50,60],[72,60],[28,90],[50,90],[72,90]]][n];
        L.forEach(([x,y],i)=>{ const c=(n===5||n===7||n===9)&&i===Math.floor(L.length/2)?'#dc2626':'#15803d'; const h=n>=7?24:30; s+=`<rect x="${x-5}" y="${y-h/2}" width="10" height="${h}" rx="5" fill="${c}"/><rect x="${x-7}" y="${y-2}" width="14" height="4" rx="2" fill="${c}" opacity=".7"/>`; }); }
      idx=n; }
    else if(k<27){ const n=k-17; s=`<text x="50" y="52" font-size="40" text-anchor="middle" fill="#1e3a8a" font-weight="700">${CN[n-1]}</text><text x="50" y="100" font-size="40" text-anchor="middle" fill="#b91c1c" font-weight="700">萬</text>`; idx=n; }
    else if(k<31){ const [c,l]=WIND[k-27]; s=`<text x="50" y="80" font-size="60" text-anchor="middle" fill="#111827" font-weight="700">${c}</text>`; idx=l; }
    else if(k===31) s=`<text x="50" y="82" font-size="64" text-anchor="middle" fill="#dc2626" font-weight="700">中</text>`;
    else if(k===32) s=`<text x="50" y="82" font-size="60" text-anchor="middle" fill="#15803d" font-weight="700">發</text>`;
    else if(k===33) s=`<rect x="20" y="22" width="60" height="76" rx="6" fill="none" stroke="#1d4ed8" stroke-width="7"/><rect x="31" y="34" width="38" height="52" rx="3" fill="none" stroke="#1d4ed8" stroke-width="3"/>`;
    else if(k<38){ const n=k-33, col=['#db2777','#9333ea','#ea580c','#0891b2'][n-1]; let pet=''; for(let i=0;i<5;i++){ const a=i/5*6.283-1.57, x=50+Math.cos(a)*17, y=52+Math.sin(a)*17; pet+=`<ellipse cx="${x}" cy="${y}" rx="11" ry="15" transform="rotate(${i*72} ${x} ${y})" fill="${col}"/>`; }
      s=`<path d="M50 70 Q46 92 54 106" stroke="#15803d" stroke-width="4" fill="none"/><ellipse cx="40" cy="92" rx="9" ry="4" fill="#16a34a" transform="rotate(-30 40 92)"/>${pet}<circle cx="50" cy="52" r="8" fill="#facc15"/>`; idx=n; }
    else { const n=k-37; s=[`<circle cx="50" cy="56" r="14" fill="#facc15"/>${[...Array(8)].map((_,i)=>{ const a=i/8*6.283; return `<line x1="${50+Math.cos(a)*20}" y1="${56+Math.sin(a)*20}" x2="${50+Math.cos(a)*30}" y2="${56+Math.sin(a)*30}" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/>`; }).join('')}`,
        `<path d="M50 24c22 12 26 40 0 70-26-30-22-58 0-70z" fill="#ea580c"/><path d="M50 30v66" stroke="#9a3412" stroke-width="3"/>`,
        [...Array(6)].map((_,i)=>`<g transform="rotate(${i*60} 50 58)"><line x1="50" y1="58" x2="50" y2="26" stroke="#0284c7" stroke-width="5" stroke-linecap="round"/><path d="M42 36l8 8 8-8" stroke="#0284c7" stroke-width="4" fill="none" stroke-linecap="round"/></g>`).join(''),
        `<circle cx="50" cy="58" r="10" fill="#f9a8d4"/>${[...Array(5)].map((_,i)=>{ const a=i/5*6.283-1.57; return `<circle cx="${50+Math.cos(a)*16}" cy="${58+Math.sin(a)*16}" r="10" fill="#f472b6"/>`; }).join('')}<circle cx="50" cy="58" r="5" fill="#fde047"/>`][n-1]; idx=['☀','🍂','❄','🌸'][n-1]&&n; }
    const ix=idx!==''?`<text x="8" y="22" font-size="19" font-weight="800" fill="#334155">${idx}</text>`:'';
    return FACE[k]=`<svg viewBox="0 0 100 120" aria-hidden="true">${s}${ix}</svg>`; }
  const KNAME=k=>k<9?`${k+1} cirklar`:k<18?`${k-8} bambu`:k<27?`${k-17} tecken`:k<31?`vind ${WIND[k-27][1]}`:k<34?['röd drake','grön drake','vit drake'][k-31]:k<38?'blomma':'årstid';

  /* ---------- spelet ---------- */
  let mjDaily=false, mjSel=-1, mjHint=null, mjHintT=0, mjTick=0, mjBusy=false, mjLockMsg=0;
  const lvl=()=>Math.max(1,+lsGet('mj_lvl')||1);
  const showFree=()=>lsGet('mj_free')!=='0';
  GINFO.mahjong={name:'Vittangi', icon:'🀄', ai:'', max:1, desc:'Para ihop lika brickor', grad:'linear-gradient(135deg,#0f766e,#b45309)'};
  KIND.mahjong={
    init(){ return {daily:mjDaily, level:lvl()}; },
    start(g){ const daily=!!g.daily, n=dayNo(); g.day=daily?n:null; const seed=daily?n*7919+13:Math.floor(Math.random()*1e9), r=rng(seed);
      const d=daily?{lay:2+n%(LAYS.length-2), kinds:20}:levelDef(g.level||1); g.lay=d.lay; g.pos=LAYS[d.lay].p();
      g.tk=deal(g.pos, makePairs(g.pos.length/2, d.kinds, r), r)||[]; g.alive=g.pos.map(()=>true); g.hist=[]; g.hints=0; g.shuf=0; g.t0=now(); g.time=0; g.cur=0; g.left=g.pos.length; },
    valid(g){ return g.names.length===1 && Array.isArray(g.pos) && Array.isArray(g.tk) && g.tk.length===g.pos.length; },
    waitingFor(){ return 0; }, scoreOf(g){ return fmt(g); },
    apply(g,a){
      if(a.type==='resign'){ if(g.over) return false; g.over=true; g.winner=-2; g.time=Math.round((now()-g.t0)/1000); return true; }
      if(g.over) return false;
      if(a.type==='pair'){ const {i,j}=a; if(!Number.isInteger(i)||!Number.isInteger(j)||i===j||!g.alive[i]||!g.alive[j]) return false;
        if(key(g.tk[i])!==key(g.tk[j])||blocked(g.pos,g.alive,i)||blocked(g.pos,g.alive,j)) return false;
        g.alive[i]=g.alive[j]=false; g.hist.push([i,j]); g.left-=2; g.last={t:now(),type:'pair',i,j};
        if(!g.left){ g.over=true; g.winner=0; g.time=Math.round((now()-g.t0)/1000);
          if(g.daily){ const S=JSON.parse(lsGet('mj_daily')||'{}'); if(!S[g.day]||S[g.day]>g.time) S[g.day]=g.time; lsSet('mj_daily',JSON.stringify(S)); }
          else if(!g.duel){ const B=JSON.parse(lsGet('mj_best')||'{}'); const k=LAYS[g.lay].id; if(!B[k]||B[k]>g.time) B[k]=g.time; lsSet('mj_best',JSON.stringify(B)); if((g.level||1)>=lvl()) lsSet('mj_lvl',String((g.level||1)+1)); }
          const T=JSON.parse(lsGet('mj_stats')||'{}'); T.won=(T.won||0)+1; lsSet('mj_stats',JSON.stringify(T)); }
        return true; }
      if(a.type==='undo'){ const h=g.hist.pop(); if(!h) return false; g.alive[h[0]]=g.alive[h[1]]=true; g.left+=2; g.last={t:now(),type:'undo'}; return true; }
      if(a.type==='hint'){ g.hints++; g.last={t:now(),type:'hint'}; return true; }
      if(a.type==='shuffle'){ // blanda kvarvarande brickor så att det fortfarande går att lösa
        const left=g.pos.map((_,i)=>i).filter(i=>g.alive[i]); const by={}; for(const i of left){ const k=key(g.tk[i]); (by[k]=by[k]||[]).push(g.tk[i]); }
        const pl=[]; for(const k in by){ const a2=by[k]; for(let x=0;x+1<a2.length;x+=2) pl.push([a2[x],a2[x+1]]); }
        const r=rng(Math.floor(Math.random()*1e9)), dead=g.pos.map((_,i)=>!g.alive[i]), sub=deal(g.pos, pl, r, g.alive.slice());
        if(sub){ for(const i of left) g.tk[i]=sub[i]; } else { const ks=left.map(i=>g.tk[i]); for(let x=ks.length-1;x>0;x--){ const y=Math.floor(r()*(x+1)); [ks[x],ks[y]]=[ks[y],ks[x]]; } left.forEach((i,x)=>{ g.tk[i]=ks[x]; }); }
        g.shuf++; g.hist=[]; g.last={t:now(),type:'shuffle'}; return true; }
      return false; },
    effects(prev,d){ if(!d.last||(prev.last&&prev.last.t===d.last.t)) return; if(d.over&&d.winner===0){ sfx.win(); sparkles(60); return; }
      if(d.last.type==='pair'){ sfx.pick(); buzz(12); } else if(d.last.type==='shuffle') sfx.bubble(); else if(d.last.type==='undo') sfx.unbubble(); },
    html(){ const g=G, L=LAYS[g.lay], fr=new Set(freeList(g.pos,g.alive)), pr=g.over?[]:pairs(g), hf=showFree();
      let mx=0,my=0,mz=0; for(const [x,y,z] of g.pos){ mx=Math.max(mx,x+2); my=Math.max(my,y+2); mz=Math.max(mz,z); }
      const order=g.pos.map((p,i)=>i).filter(i=>g.alive[i]).sort((a,b)=>g.pos[a][2]-g.pos[b][2]||g.pos[a][1]-g.pos[b][1]||g.pos[b][0]-g.pos[a][0]);
      const tiles=order.map(i=>{ const [x,y,z]=g.pos[i], f=fr.has(i), h=mjHint&&(mjHint[0]===i||mjHint[1]===i);
        return `<button class="mj-t ${f?'fr':'bl'} ${hf&&!f?'dim':''} ${i===mjSel?'sel':''} ${h?'hint':''}" data-mj="t" data-i="${i}" style="--x:${x};--y:${y};--z:${z};z-index:${z*1000+y*20+(40-x)}" aria-label="${KNAME(g.tk[i])}${f?'':' (låst)'}">${face(g.tk[i])}</button>`; }).join('');
      const head=`<div class="gsub">${g.daily?'📅 Dagens bricka':`Nivå ${g.level||1}`} · ${L.name} · ⏱️ <span id="mjTime">${fmt(g)}</span> · ${g.left} kvar</div>`;
      const board=`<div class="mj-wrap" id="mjWrap"><div class="mj-b" id="mjB" style="--mx:${mx};--my:${my};--mz:${mz}">${tiles}</div></div>`;
      if(g.over) return head+board+`<div class="wd-end"><h3>${g.winner===0?'Bordet är tomt! 🎉':'Avslutat'}</h3>${g.winner===0?`<p>Tid <b>${fmt(g)}</b>${g.hints?` · ${g.hints} ledtrådar`:''}${g.shuf?` · blandat ${g.shuf} gånger`:''}</p>`:''}
        <div class="cbtns">${g.daily?'':`<button class="pri" data-mj="next">▶️ ${g.winner===0?'Nästa nivå':'Försök igen'}</button>`}<button data-act="lobby">🏠 Lobby</button></div></div>`;
      const stuck=!pr.length;
      return head+board+(stuck?`<div class="mj-stuck">Inga fler par går att ta 🙈 <button class="pri" data-mj="shuffle">🔀 Blanda brickorna</button></div>`:'')+
        `<div class="mj-tools"><button data-mj="undo" ${g.hist.length?'':'disabled'}>↶ Ångra</button><button data-mj="hint" ${stuck?'disabled':''}>💡 Ledtråd</button><button data-mj="shuffle">🔀 Blanda</button><span class="mj-pairs">${pr.length} ${pr.length===1?'par':'par'} möjliga</span></div>
        <div class="ghint">Tryck på två lika brickor som är fria – inget ovanpå och fri på vänster eller höger sida. ${KIT.resignHTML()}</div>`; },
    mounted(){ fit(); clearInterval(mjTick); if(!G.over) mjTick=setInterval(()=>{ const el=document.getElementById('mjTime'); if(!el||!G||G.kind!=='mahjong'){ clearInterval(mjTick); return; } el.textContent=fmt(G); },1000); }
  };
  const fmt=g=>{ const s=g.over?g.time:Math.round((now()-g.t0)/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
  // brädet skalas så att brickorna blir så stora som möjligt på skärmen
  function fit(){ const w=document.getElementById('mjWrap'), b=document.getElementById('mjB'); if(!w||!b) return;
    const mx=+b.style.getPropertyValue('--mx'), my=+b.style.getPropertyValue('--my'), mz=+b.style.getPropertyValue('--mz'), W=w.clientWidth, top=w.getBoundingClientRect().top;
    const H=Math.max(220, innerHeight-top-150), A=1.24, depth=.1;
    const tw=Math.min(96, W/(mx/2+mz*depth+.15), H/((my/2)*A+mz*depth+.25)), th=tw*A;
    b.style.setProperty('--tw',tw+'px'); b.style.setProperty('--th',th+'px'); b.style.width=(mx/2*tw+mz*tw*depth+tw*.12)+'px'; b.style.height=(my/2*th+mz*tw*depth+tw*.16)+'px'; }
  addEventListener('resize',()=>{ if(G&&G.kind==='mahjong'&&view==='game') fit(); });
  function flash(el,cls){ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(()=>el.classList.remove(cls),450); }
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-mj]'); if(!b) return; const a=b.dataset.mj;
    if(a==='daily'||a==='play'){ mjDaily=a==='daily'; mjSel=-1; mjHint=null; unlockAudio(); KIT.startSolo('mahjong',lsGet('ry_name')||'Du'); return; }
    if(a==='free'){ lsSet('mj_free',showFree()?'0':'1'); showMahjongMenu(); return; }
    if(a==='lvl'){ const v=Math.max(1,Math.min(lvl(),+b.dataset.v)); lsSet('mj_pick',String(v)); showMahjongMenu(); return; }
    if(!G||G.kind!=='mahjong') return;
    if(a==='next'){ mjDaily=false; mjSel=-1; mjHint=null; KIT.startSolo('mahjong',G.names[0]); return; }
    if(a==='undo'){ mjSel=-1; mjHint=null; doAct({type:'undo'}); return; }
    if(a==='shuffle'){ mjSel=-1; mjHint=null; const bd=document.getElementById('mjB'); if(bd) bd.classList.add('shuf'); setTimeout(()=>doAct({type:'shuffle'}),260); return; }
    if(a==='hint'){ const p=pairs(G); if(!p.length) return; mjHint=p[Math.floor(Math.random()*p.length)]; mjSel=-1; clearTimeout(mjHintT); mjHintT=setTimeout(()=>{ mjHint=null; if(G&&G.kind==='mahjong') render(); },2600); doAct({type:'hint'}); return; }
    if(a==='t'){ if(mjBusy||G.over) return; const i=+b.dataset.i;
      if(blocked(G.pos,G.alive,i)){ flash(b,'no'); buzz(20); if(mjLockMsg++<2) toast('Den brickan är låst – en bricka är fri när inget ligger ovanpå och ena sidan är fri'); return; }
      if(mjSel===i){ mjSel=-1; render(); return; }
      if(mjSel>=0 && key(G.tk[mjSel])===key(G.tk[i])){ const j=mjSel; mjSel=-1; mjHint=null; mjBusy=true;
        const A=document.querySelector(`.mj-t[data-i="${j}"]`); [A,b].forEach(x=>x&&x.classList.add('gone')); setTimeout(()=>{ mjBusy=false; doAct({type:'pair',i:j,j:i}); },230); return; }
      if(mjSel>=0){ flash(document.querySelector(`.mj-t[data-i="${mjSel}"]`),'no'); }
      mjSel=i; sfx.bubble(); render(); } });
  window.showMahjongMenu=function(){ const D=JSON.parse(lsGet('mj_daily')||'{}'), today=D[dayNo()], n=lvl(), T=JSON.parse(lsGet('mj_stats')||'{}');
    const f=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`, d=levelDef(n);
    openModal(`<h3>🀄 Vittangi</h3><p>Para ihop två lika brickor som är fria. En bricka är fri när inget ligger ovanpå den och den är fri på vänster eller höger sida. Töm hela bordet! Blommor passar ihop med blommor och årstider med årstider.</p>
      <div class="mj-mpre">${[0,9,18,27,31,34].map(k=>`<span class="mj-t fr" style="position:relative;--tw:44px;--th:55px">${face(k)}</span>`).join('')}</div>
      <div class="setnote">Nivå ${n}: ${LAYS[d.lay].name} · ${LAYS[d.lay].p().length} brickor${T.won?` · ${T.won} bord tömda`:''}${today?` · dagens: ${f(today)} ✅`:''}</div>
      <label class="mj-opt"><input type="checkbox" data-mj="free" ${showFree()?'checked':''}> Visa låsta brickor lite mörkare</label>
      <div class="btns" style="flex-direction:column"><button class="pri" data-mj="play">▶️ Spela nivå ${n}</button><button class="pri" data-mj="daily" style="background:linear-gradient(135deg,#f59e0b,#b45309)">📅 Dagens bricka</button>${typeof DUEL!=='undefined'?DUEL.btn('mahjong'):''}<button data-act="close">Avbryt</button></div>`,'mjmenu'); };
  GINFO.mahjong.menu=()=>showMahjongMenu();
  GINFO.mahjong.duel=n=>{ mjDaily=false; mjSel=-1; mjHint=null; KIT.startSolo('mahjong',n); };
  window.MJ={LAYS, blocked, pairs, deal, makePairs, levelDef, face};

  st.textContent=`
.mj-wrap{display:flex;justify-content:center;margin:4px 0 8px;touch-action:manipulation}
.mj-b{position:relative;--dz:calc(var(--tw)*.1)}
.mj-b.shuf .mj-t{transition:transform .25s ease-in,opacity .25s;transform:scale(.6) rotate(8deg);opacity:.4}
.mj-t{position:absolute;left:calc(var(--x)*var(--tw)/2 + (var(--mz) - var(--z))*0px + var(--z)*0px);top:0;width:var(--tw);height:var(--th);padding:0;border:0;border-radius:calc(var(--tw)*.14);
  transform:translate(calc(var(--z)*var(--dz)*-1 + var(--mz)*var(--dz)), calc(var(--y)*var(--th)/2 - var(--z)*var(--dz) + var(--mz)*var(--dz)*0));
  background:linear-gradient(160deg,#fffdf6,#f3ead2 70%,#e8dcbc);color:#111;cursor:pointer;
  box-shadow:inset 0 0 0 1px rgba(120,100,60,.35),calc(var(--tw)*.05) calc(var(--tw)*.06) 0 #cdb98a,calc(var(--tw)*.08) calc(var(--tw)*.1) 0 #9c8456,calc(var(--tw)*.1) calc(var(--tw)*.16) calc(var(--tw)*.14) rgba(0,0,0,.35);
  transition:filter .15s, box-shadow .15s, transform .12s}
.mj-mpre .mj-t{display:inline-block;margin:3px;transform:none}
.mj-t svg{position:absolute;inset:4%;width:92%;height:92%}
.mj-t.dim{filter:brightness(.72) saturate(.75)}
.mj-t.sel{box-shadow:inset 0 0 0 3px #f59e0b,0 0 0 3px rgba(245,158,11,.5),calc(var(--tw)*.05) calc(var(--tw)*.06) 0 #cdb98a,calc(var(--tw)*.1) calc(var(--tw)*.16) calc(var(--tw)*.14) rgba(0,0,0,.35);filter:brightness(1.06)}
.mj-t.hint{animation:mjh 1s ease-in-out infinite}@keyframes mjh{50%{box-shadow:inset 0 0 0 3px #22c55e,0 0 14px 4px rgba(34,197,94,.75)}}
.mj-t.no{animation:mjn .4s}@keyframes mjn{25%{margin-left:-4px}75%{margin-left:4px}}
.mj-t.gone{transition:opacity .22s,filter .22s;opacity:0;filter:brightness(1.6)}
.mj-tools{display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap;margin:6px 0}
.mj-tools button{padding:10px 14px;border-radius:14px;font-size:15px}.mj-pairs{font-size:13px;color:var(--dim)}
.mj-stuck{margin:6px auto;max-width:420px;text-align:center;padding:10px;border-radius:16px;background:rgba(245,158,11,.18);border:1px solid rgba(245,158,11,.5)}
.mj-stuck .pri{margin-top:8px}.mj-opt{display:flex;gap:8px;align-items:center;font-size:14px;margin:8px 0}`;
})();
