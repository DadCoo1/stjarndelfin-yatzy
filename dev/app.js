/* ================= Kompatibilitet med äldre iPad/Safari =================
   roundRect finns först i Safari 16 – lägg till en egen version. */
(function(){
  function rr(x,y,w,h,r){
    let a=r; if(Array.isArray(r)) a=r.length?r[0]:0; if(typeof a==='object'&&a) a=a.x||0; a=+a||0;
    if(w<0){ x+=w; w=-w; } if(h<0){ y+=h; h=-h; }
    a=Math.max(0,Math.min(a,w/2,h/2));
    this.moveTo(x+a,y); this.lineTo(x+w-a,y); this.arcTo(x+w,y,x+w,y+a,a); this.lineTo(x+w,y+h-a);
    this.arcTo(x+w,y+h,x+w-a,y+h,a); this.lineTo(x+a,y+h); this.arcTo(x,y+h,x,y+h-a,a); this.lineTo(x,y+a);
    this.arcTo(x,y,x+a,y,a); this.closePath();
  }
  try{ if(window.CanvasRenderingContext2D&&!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect=rr; }catch(e){}
  try{ if(window.Path2D&&!Path2D.prototype.roundRect) Path2D.prototype.roundRect=rr; }catch(e){}
})();

/* ================= Skydd mot inramning (clickjacking) =================
   Appen får bara visas i en ram av sig själv (testkompisen i dev). */
(function(){
  if(window.top===window.self) return;
  let same=false; try{ same = window.parent.location.origin===location.origin; }catch(e){}
  if(!same || !/[?&]bot=1/.test(location.search)){ document.documentElement.innerHTML=''; throw new Error('Inramning blockerad'); }
})();
/* ================= Version & utvecklingsläge ================= */
const APP_VERSION='2026.11.07.2-dev';
const DEV = /\/dev(\/|$)/.test(location.pathname);      // testversionen ligger i mappen /dev/
const BOT = DEV && /[?&]bot=1/.test(location.search) && window.parent!==window;   // osynlig testkompis i en ram (bara dev)
const LSP = DEV ? (BOT ? 'dev:bot:' : 'dev:') : '';    // egen sparad data i testversionen
if(DEV) document.title='DEV · '+document.title;
/* ================= Grafik ================= */
const DOLPHIN = (id='d', c1='#7df9ff', c2='#4f7cff') => `
<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <g fill="url(#${id})">
    <path d="M40 60 C70 40 110 30 150 38 C165 41 172 46 178 50 L195 54 C196 57 190 59 178 58 C165 65 140 71 110 71 C85 71 60 67 40 64 Z"/>
    <path d="M95 38 C100 22 108 14 120 9 C115 19 114 28 121 35 Z"/>
    <path d="M128 66 C124 78 116 86 104 91 C109 81 111 73 113 68 Z"/>
    <path d="M44 60 C30 52 18 41 5 36 C13 46 19 55 23 61 C17 67 11 77 7 88 C21 79 33 69 46 64 Z"/>
  </g>
  <path d="M120 64 C140 64 160 61 176 57" stroke="rgba(255,255,255,.45)" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="160" cy="47" r="3" fill="#0b2050"/>
  <circle cx="161" cy="46" r="1" fill="#fff"/>
</svg>`;

(function buildSky(){
  const s = document.getElementById('sky');
  let h = '<div class="planet"></div><div class="ring"></div><div class="moon"></div>';
  for (let i=0;i<110;i++){
    const sz = Math.random()<.85 ? 1.5 : 2.6;
    h += `<div class="star" style="left:${Math.random()*100}%;top:${Math.random()*75}%;width:${sz}px;height:${sz}px;animation-delay:${(Math.random()*3).toFixed(2)}s;animation-duration:${(2+Math.random()*3).toFixed(2)}s"></div>`;
  }
  h += `<div class="shoot" style="top:14%;right:-10%"></div><div class="shoot" style="top:34%;right:-20%;animation-delay:4.5s"></div>`;
  for (let i=0;i<16;i++){
    const sz = 6+Math.random()*16;
    h += `<div class="bubble" style="left:${Math.random()*100}%;width:${sz}px;height:${sz}px;animation-duration:${(9+Math.random()*12).toFixed(1)}s;animation-delay:-${(Math.random()*20).toFixed(1)}s"></div>`;
  }
  h += `<div class="swimmer" style="top:58%;animation-duration:26s">${DOLPHIN('s1')}</div>
        <div class="swimmer" style="top:76%;width:80px;animation-duration:34s;animation-delay:-14s">${DOLPHIN('s2','#f9a8d4','#a78bfa')}</div>
        <svg class="waves" viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 40 Q50 20 100 40 T200 40 T300 40 T400 40 V120 H0Z" fill="rgba(62,230,255,.18)"/><path d="M0 70 Q50 50 100 70 T200 70 T300 70 T400 70 V120 H0Z" fill="rgba(99,102,241,.22)"/></svg>`;
  s.innerHTML = h;
})();

/* ================= Regler ================= */
const CATS = [
  ['ones','Ettor',1],['twos','Tvåor',2],['threes','Treor',3],['fours','Fyror',4],['fives','Femmor',5],['sixes','Sexor',6],
  ['pair','Ett par'],['twopair','Två par'],['three','Tretal'],['four','Fyrtal'],
  ['small','Liten stege'],['large','Stor stege'],['house','Kåk'],['chance','Chans'],['yatzy','Yatzy']
];
const UP = CATS.slice(0,6), LOW = CATS.slice(6);
const NAME = Object.fromEntries(CATS.map(c=>[c[0],c[1]]));
const HELP = {
  ones:'Ettor: summan av alla ettor', twos:'Tvåor: summan av alla tvåor', threes:'Treor: summan av alla treor',
  fours:'Fyror: summan av alla fyror', fives:'Femmor: summan av alla femmor', sixes:'Sexor: summan av alla sexor',
  pair:'Ett par: två lika – summan av paret', twopair:'Två par: två olika par – summan av dem',
  three:'Tretal: tre lika – summan av dem', four:'Fyrtal: fyra lika – summan av dem',
  small:'Liten stege: 1-2-3-4-5 = 15 poäng', large:'Stor stege: 2-3-4-5-6 = 20 poäng',
  house:'Kåk: tretal + par (olika) – summan av alla', chance:'Chans: summan av alla tärningar',
  yatzy:'Yatzy: fem lika = 50 poäng! Bara på den här raden, och bara en gång per spel 🐬', bonus:'Bonus'
};
const PIPS = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};

function counts(d){const c=[0,0,0,0,0,0,0];d.forEach(v=>c[v]++);return c}
const houseTwoPair = () => typeof G!=='undefined' && !!G && G.hr4===true;
function score(cat,d){
  const c=counts(d), sum=d.reduce((a,b)=>a+b,0);
  const up={ones:1,twos:2,threes:3,fours:4,fives:5,sixes:6}[cat];
  if(up) return up*c[up];
  switch(cat){
    case 'pair': for(let v=6;v>=1;v--) if(c[v]>=2) return 2*v; return 0;
    case 'twopair': {const p=[];for(let v=6;v>=1;v--) if(c[v]>=2) p.push(v); if(p.length>=2) return 2*p[0]+2*p[1];
      if(houseTwoPair() && p.length===1 && c[p[0]]>=4) return 4*p[0];   // husregel (bara om vald): fyra lika = två par
      return 0}
    case 'three': for(let v=6;v>=1;v--) if(c[v]>=3) return 3*v; return 0;
    case 'four': for(let v=6;v>=1;v--) if(c[v]>=4) return 4*v; return 0;
    case 'small': return [1,2,3,4,5].every(v=>c[v]===1)?15:0;
    case 'large': return [2,3,4,5,6].every(v=>c[v]===1)?20:0;
    case 'house': {let t=0,p=0;for(let v=1;v<=6;v++){if(c[v]===3)t=v;if(c[v]===2)p=v}return t&&p?sum:0}
    case 'chance': return sum;
    case 'yatzy': return c.some(x=>x===5)?50:0;
  }
  return 0;
}
const bonusLimit = order => order==='down' ? 42 : 63;   // strikt uppifrån och ned: 42
function totals(s, order=(typeof G!=='undefined'&&G?G.order:'free')){
  s=s||{};let up=0,low=0;
  UP.forEach(([k])=>up+=(s[k]||0)); LOW.forEach(([k])=>low+=(s[k]||0));
  const bonus=up>=bonusLimit(order)?50:0; return {up,bonus,low,total:up+bonus+low};
}
const filled = s => Object.keys(s||{}).filter(k=>NAME[k]).length;
const isYatzy = d => d.every(v=>v===d[0]);

/* ================= Ljud ================= */
let AC=null, muted=false, musicOn=true, diceSound='klassisk', NB=null, spSfx=true;
try{ spSfx = localStorage.getItem(LSP+'ry_spsfx')!=='0'; muted = localStorage.getItem(LSP+'ry_mute')==='1'; musicOn = localStorage.getItem(LSP+'ry_music')!=='0'; diceSound = localStorage.getItem(LSP+'ry_dsnd')||'klassisk'; }catch(e){}
function unlockAudio(){
  try{ if(!AC) AC=new (window.AudioContext||window.webkitAudioContext)(); if(AC.state==='suspended') AC.resume(); }catch(e){}
  if(musicOn) startMusic();
}
function sfxOff(){ try{ return muted || (!spSfx && spPlaying); }catch(e){ return muted; } }
function tone(f,dur,type='sine',vol=.14,when=0,slide){
  if(sfxOff()||!AC) return;
  try{
    const t=AC.currentTime+when, o=AC.createOscillator(), g=AC.createGain();
    o.type=type; o.frequency.setValueAtTime(f,t);
    if(slide) o.frequency.exponentialRampToValueAtTime(slide,t+dur);
    g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.012); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t+dur+.03);
  }catch(e){}
}
function noiseBuf(sec){ const b=AC.createBuffer(1,Math.floor(AC.sampleRate*sec),AC.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b; }
function hit(when,freq,vol,dur=.04){
  if(sfxOff()||!AC) return;
  try{
    if(!NB) NB=noiseBuf(1);
    const src=AC.createBufferSource(), f=AC.createBiquadFilter(), g=AC.createGain(), t=AC.currentTime+when;
    src.buffer=NB; f.type='bandpass'; f.frequency.value=freq; f.Q.value=2.5;
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    src.connect(f).connect(g).connect(AC.destination); src.start(t, Math.random()*.9, dur+.02);
  }catch(e){}
}
const DICE_SOUNDS = {
  klassisk:{label:'🎲 Klassisk', play(){ for(let i=0;i<11;i++){ const t=i*.055+Math.random()*.03; hit(t,1100+Math.random()*2400,.55*(1-i/13),.035); tone(420+Math.random()*700,.03,'triangle',.025,t); } }},
  bubblor: {label:'🫧 Bubblor',  play(){ for(let i=0;i<7;i++) tone(240+Math.random()*320,.13,'sine',.14,i*.08+Math.random()*.03,700+Math.random()*800); }},
  rymd:    {label:'🚀 Rymdlaser',play(){ for(let i=0;i<4;i++) tone(1900-i*220,.17,'square',.035,i*.12,170); tone(110,.55,'sawtooth',.03,0,55); }},
  delfin:  {label:'🐬 Delfin',   play(){ for(let i=0;i<12;i++) hit(i*.022,3600,.3,.012); tone(1300,.42,'sine',.08,.3,2700); tone(2700,.22,'sine',.06,.62,1700); }},
  magi:    {label:'✨ Magi',     play(){ [1047,1175,1319,1568,1760,2093,2349].forEach((f,i)=>tone(f,.55,'triangle',.05,i*.07)); }},
  tyst:    {label:'🔕 Tyst',     play(){} }
};
const sfx = {
  roll(){ (DICE_SOUNDS[diceSound]||DICE_SOUNDS.klassisk).play(); },
  bubble(){ tone(280,.16,'sine',.16,0,950); },
  pop(){ tone(480,.09,'sine',.13,0,1200); tone(900,.08,'sine',.07,.06,1500); },
  poke(){ tone(170,.26,'triangle',.2,0,540); tone(540,.22,'sine',.12,.2,240); tone(170,.26,'triangle',.16,.42,520); },
  unbubble(){ tone(800,.14,'sine',.12,0,300); },
  pick(){ tone(660,.14,'sine',.12); tone(990,.22,'sine',.1,.09); },
  zero(){ tone(330,.2,'triangle',.08,0,220); },
  turn(){ tone(587,.12,'sine',.14); tone(880,.14,'sine',.14,.13); tone(1175,.3,'sine',.12,.26); },
  yatzy(){ [523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,.35,'triangle',.12,i*.09)); tone(2093,.6,'sine',.08,.6); },
  win(){ [392,523,659,784,659,784,1047].forEach((f,i)=>tone(f,.28,'triangle',.11,i*.14)); }
};
function buzz(p){ try{ navigator.vibrate && navigator.vibrate(p) }catch(e){} }

/* --- Bakgrundsmusik: lugn rymd-hav-ambient, genereras live --- */
let MUS=null;
const mtf = m => 440*Math.pow(2,(m-69)/12);
const CHORDS = [[50,57,62,66,69],[47,54,59,62,66],[43,50,55,59,66],[45,52,57,61,64]];   // D – Hm – G – A
const BELLS  = [74,76,78,81,83,86,88,90];                                              // D-pentaton, högt
function impulse(sec){ const n=Math.floor(AC.sampleRate*sec), b=AC.createBuffer(2,n,AC.sampleRate);
  for(let c=0;c<2;c++){ const d=b.getChannelData(c); for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2.6); } return b; }
function startMusic(){
  if(!AC || MUS || !musicOn) return;
  if(typeof spPlaying!=='undefined' && spPlaying && spDuck) return;
  try{
    const out=AC.createGain(); out.gain.setValueAtTime(0,AC.currentTime); out.gain.linearRampToValueAtTime(.55,AC.currentTime+4); out.connect(AC.destination);
    const rev=AC.createConvolver(); rev.buffer=impulse(4); const wet=AC.createGain(); wet.gain.value=.6; rev.connect(wet).connect(out);
    const dry=AC.createGain(); dry.gain.value=.5; dry.connect(out);
    const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1500; lp.connect(dry); lp.connect(rev);
    const nz=AC.createBufferSource(); nz.buffer=noiseBuf(4); nz.loop=true;               // havsbrus
    const nf=AC.createBiquadFilter(); nf.type='lowpass'; nf.frequency.value=420;
    const ng=AC.createGain(); ng.gain.value=.028; nz.connect(nf).connect(ng).connect(out);
    const lfo=AC.createOscillator(); lfo.frequency.value=.09; const lg=AC.createGain(); lg.gain.value=.022; lfo.connect(lg).connect(ng.gain);
    nz.start(); lfo.start();
    MUS={out,lp,rev,src:[nz,lfo],next:AC.currentTime+.3,step:0,timer:null};
    MUS.timer=setInterval(schedMusic,300); schedMusic();
  }catch(e){ MUS=null; }
}
function padNote(f,t,dur,vol){
  [[f,'sine',0],[f*1.004,'triangle',.6]].forEach(([fr,type,mix])=>{
    const o=AC.createOscillator(), g=AC.createGain(); o.type=type; o.frequency.value=fr;
    const v=vol*(mix?.5:1);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+2.6); g.gain.setValueAtTime(v,t+dur-2.4); g.gain.linearRampToValueAtTime(0,t+dur);
    o.connect(g).connect(MUS.lp); o.start(t); o.stop(t+dur+.1);
  });
}
function bell(f,t){
  const o=AC.createOscillator(), g=AC.createGain(); o.type='sine'; o.frequency.value=f;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.022,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+2.6);
  o.connect(g).connect(MUS.rev); o.start(t); o.stop(t+2.7);
}
function schedMusic(){
  if(!MUS || !AC) return;
  const bar=8;
  while(MUS.next < AC.currentTime+1.2){
    const t=MUS.next, ch=CHORDS[MUS.step%CHORDS.length];
    ch.forEach((m,i)=>padNote(mtf(m),t,bar+2.4,i<2?.045:.03));
    for(let k=0;k<16;k++) if(Math.random()<.26) bell(mtf(BELLS[Math.floor(Math.random()*BELLS.length)]), t+k*bar/16+Math.random()*.08);
    MUS.next+=bar; MUS.step++;
  }
}
function stopMusic(){
  if(!MUS) return; const m=MUS; MUS=null; clearInterval(m.timer);
  try{ m.out.gain.cancelScheduledValues(AC.currentTime); m.out.gain.setValueAtTime(m.out.gain.value,AC.currentTime); m.out.gain.linearRampToValueAtTime(0,AC.currentTime+1.2); }catch(e){}
  setTimeout(()=>{ try{ m.src.forEach(n=>n.stop()); m.out.disconnect(); }catch(e){} },1400);
}

/* ================= Hjälpare ================= */
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Rättvis tärning: kryptografisk slump (crypto.getRandomValues) med förkastningssampling,
// så att varje sida 1–6 har exakt samma sannolikhet (ingen modulo-snedvridning).
const rnd = (()=>{
  const c = window.crypto || window.msCrypto, buf = new Uint32Array(64); let i = 64;
  const LIMIT = 4294967292; // största multipel av 6 som ryms i 2^32
  return () => {
    if(c && c.getRandomValues){
      for(;;){ if(i>=64){ c.getRandomValues(buf); i=0; } const x=buf[i++]; if(x < LIMIT) return 1 + (x % 6); }
    }
    return 1 + Math.floor(Math.random()*6);
  };
})();
const F5 = () => [false,false,false,false,false];
function lsGet(k){ try{ return localStorage.getItem(LSP+k) }catch(e){ return null } }
function lsSet(k,v){ try{ localStorage.setItem(LSP+k,v) }catch(e){} }
function toast(msg,ms=2300){
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg;
  const box=document.getElementById('toasts'); box.appendChild(t);
  while(box.children.length>3) box.firstChild.remove();
  setTimeout(()=>t.remove(),ms);
}
const PRAISE_HI = ['Stjärnklart! ✨','Delfinsnyggt! 🐬','Galaktiskt! 🚀','Wow, vilket kast! 🌟','Kosmiskt bra! 🪐','Plask-perfekt! 💦'];
const PRAISE_OK = ['Snyggt! 💙','Bra val! 🐬','Det blir poäng! ⭐'];
const PRAISE_ZERO = ['Ingen fara – nästa kast! 🌊','Delfiner ger aldrig upp! 🐬','Strategi! 🛸'];
const pickOne = a => a[Math.floor(Math.random()*a.length)];

/* ================= State ================= */
let view='lobby';                   // lobby | game
let mode=null;                      // online | local
let gameId=null, G=null, mySeat=null;
let shown=[1,2,3,4,5], rolling=false, freshCell=null;
let chosenOrder='free', kbCat=null;
const nextCat = s => { const c=CATS.find(([k])=>!(k in (s||{}))); return c?c[0]:null; };
// I ordning tar man nästa rad – men slår man yatzy får yatzy-raden alltid fyllas i (den hoppade raden spelas nästa tur)
const allowed = (k,i) => !G || G.order!=='down' || nextCat(G.scores[i])===k
  || (k==='yatzy' && G.cur===i && G.rolls>0 && Array.isArray(G.dice) && isYatzy(G.dice) && !('yatzy' in (G.scores[i]||{})));

function newState(names, starter=0, order='free', seq=0, ai=null){
  return {id:Math.random().toString(36).slice(2,9)+Date.now().toString(36), names, order, ai, cur:starter, starter, dice:[rnd(),rnd(),rnd(),rnd(),rnd()], held:F5(), rolls:0, rollSeq:0,
          scores:names.map(()=>({})), over:false, record:false, last:null, seq, createdAt:Date.now(), updatedAt:Date.now()};
}
const NP = () => G ? G.names.length : 2;
const isAI = i => !!(G && G.ai && G.ai[i]);
const ready = () => G && G.started!==false && G.names && G.names.length>0 && G.names.every(Boolean);
const isAITurn = () => mode==='local' && G && !G.over && isAI(G.cur);
const myTurn = () => G && !G.over && ready() && !isAITurn() && (mode==='local' || G.cur===mySeat);
const AI_NAME = 'Blixt 🤖';
const pname = i => (G && G.names[i]) || '…';

/* ================= Skriva ================= */
function commit(patch){
  Object.assign(G, JSON.parse(JSON.stringify(patch)));
  G.updatedAt = Date.now(); G.seq = (G.seq||0)+1;
  if(mode==='local'){ lsSet('ry_local', JSON.stringify(G)); render(); return; }
  saveNet(); render();
  send({t:'state', state:G});
}

/* ================= Spelhandlingar ================= */
function rollCore(){
  kbCat=null;
  const held = G.rolls===0 ? F5() : G.held.slice();
  const dice = G.dice.map((v,i)=>held[i]?v:rnd());
  animateRoll(dice, held);
  commit({dice, held, rolls:G.rolls+1, rollSeq:(G.rollSeq||0)+1});
}
function doRoll(){
  if(!myTurn() || G.rolls>=3 || rolling) return;
  unlockAudio(); rollCore();
}
function toggleHold(i){
  if(!myTurn() || G.rolls===0 || G.rolls>=3 || rolling) return;
  unlockAudio();
  const held = G.held.slice(); held[i]=!held[i];
  held[i] ? (sfx.bubble(), buzz(15)) : sfx.unbubble();
  commit({held});
}
function pick(cat){
  if(!myTurn() || G.rolls===0 || rolling) return;
  const p=G.cur;
  if(cat in G.scores[p] || !allowed(cat,p)) return;
  unlockAudio(); pickCore(cat,false);
}
function bestList(order){ try{ return JSON.parse(lsGet('ry_best_'+order))||[] }catch(e){ return [] } }
function saveBest(score_, name, order){
  const list=bestList(order), prev=list.length?list[0].s:-1;
  list.push({s:score_, n:name, d:Date.now()}); list.sort((a,b)=>b.s-a.s);
  lsSet('ry_best_'+order, JSON.stringify(list.slice(0,5)));
  return score_>prev;
}
function pickCore(cat, byAI){
  kbCat=null;
  const p=G.cur, P=NP();
  const val=score(cat,G.dice);
  const scores=G.scores.map(o=>({...o})); scores[p][cat]=val;
  const before=totals(G.scores[p]).bonus, after=totals(scores[p]).bonus;
  const done = scores.every(o=>filled(o)===15);
  freshCell = p+':'+cat;
  if(byAI){ val ? sfx.pick() : sfx.zero(); toast(`${pname(p)} tog ${val} på ${NAME[cat]}`); }
  else if(val===0){ sfx.zero(); toast(pickOne(PRAISE_ZERO)); }
  else { sfx.pick(); buzz(20); toast(val>=25 || (UP.some(u=>u[0]===cat) && val>=UP.find(u=>u[0]===cat)[2]*4) ? pickOne(PRAISE_HI) : pickOne(PRAISE_OK)); }
  if(!before && after) setTimeout(()=>{ toast((byAI?pname(p)+' fick ':'')+'BONUS! +50 🌟',3000); if(!byAI){ sfx.yatzy(); sparkles(18); } },500);
  let record=false;
  if(done && P===1) record = saveBest(totals(scores[0]).total, G.names[0], G.order||'free');
  const next = done ? p : (p+1)%P;
  commit({scores, cur:next, rolls:0, held:F5(), over:done, record, last:{p,cat,val,t:Date.now()}, rollSeq:(G.rollSeq||0)+1});
  if(done){
    finishGame();
    setTimeout(()=>{ sfx.win(); sparkles(record?60:40); if(record) celebrate('REKORD!'); },400);
    try{ window.scrollTo({top:0,behavior:'smooth'}) }catch(e){}
  } else if(mode==='local'){
    if(isAITurn()) maybeAI(1500);
    else if(P>1 && next!==p) setTimeout(()=>notifyTurn(`Din tur, ${pname(next)}!`),450);
  }
}
function rematch(){
  closeModal();
  const P=NP(), starter = ((G.starter||0)+1)%P;
  const st = newState(G.names.slice(), starter, G.order||'free', G.seq||0, G.ai||null); st.started=true; st.hr4=!!G.hr4;
  shown = st.dice.slice(); freshCell=null;
  commit(st);
  if(P>1) toast(`Ny match! ${pname(starter)} börjar 🚀`); else toast('Ny runda – sikta mot rekordet! 🏆');
  maybeAI(1400);
}

/* ================= Datormotståndaren Blixt 🤖 ================= */
// Bedömer varje rad: poäng minus ett "normalvärde" för raden, plus extra hänsyn till bonusen.
const AI_BASE={ones:2,twos:5,threes:8,fours:11,fives:14,sixes:17,pair:8,twopair:14,three:11,four:9,small:6,large:7,house:13,chance:21,yatzy:6};
const FACE={ones:1,twos:2,threes:3,fours:4,fives:5,sixes:6};
function catUtil(cat,dice,up,order){
  const v=score(cat,dice); let u=v-AI_BASE[cat];
  const f=FACE[cat];
  if(f){ const lim=bonusLimit(order);
    if(up<lim){ u += (v-(order==='down'?2:3)*f)*.8; if(up+v>=lim) u+=28; } }
  if(cat==='yatzy' && v===50) u+=20;
  return u;
}
function bestCat(dice,up,order,cats,noise){
  let best=cats[0], bu=-1e9;
  for(const k of cats){ const u=catUtil(k,dice,up,order)+(noise?(Math.random()*2-1)*noise:0); if(u>bu){ bu=u; best=k; } }
  return {cat:best,u:bu};
}
const OUTS=[];
function outcomes(k){ if(OUTS[k]) return OUTS[k]; let r=[[]]; for(let i=0;i<k;i++){ const n=[]; for(const a of r) for(let v=1;v<=6;v++) n.push(a.concat(v)); r=n; } return OUTS[k]=r; }
function aiDecide(dice, rollsLeft, s, order, cats, level){
  const up=totals(s,order).up, noise = level==='easy' ? 9 : 0;
  if(rollsLeft<=0) return {pick:bestCat(dice,up,order,cats,noise).cat};
  const memo=new Map(); let bestMask=null, bestEv=-1e9;
  for(let m=0;m<32;m++){
    const mask=[0,1,2,3,4].map(i=>!!((m>>i)&1));
    const kept=dice.filter((_,i)=>mask[i]).sort(), key=kept.join('');
    let ev=memo.get(key);
    if(ev===undefined){
      const outs=outcomes(5-kept.length); let sum=0;
      for(const o of outs) sum+=bestCat(kept.concat(o),up,order,cats,0).u;
      ev=sum/outs.length; memo.set(key,ev);
    }
    // lite extra vilja att kasta igen när två kast återstår
    const adj = ev + (rollsLeft===2 && m!==31 ? 1.5 : 0) + (noise?(Math.random()*2-1)*noise:0);
    if(adj>bestEv){ bestEv=adj; bestMask=mask; }
  }
  if(bestMask.every(Boolean)) return {pick:bestCat(dice,up,order,cats,noise).cat};
  return {hold:bestMask};
}
let aiTimer=null, aiPlan=null;
function maybeAI(delay=1000){ clearTimeout(aiTimer); if(isAITurn()) aiTimer=setTimeout(aiStep,delay); }
function aiStep(){
  if(!isAITurn()) return;
  if(rolling) return maybeAI(300);
  const p=G.cur;
  if(G.rolls===0){ aiPlan=null; rollCore(); return maybeAI(1400); }
  if(!aiPlan || aiPlan.seq!==G.rollSeq){
    const cats=CATS.map(c=>c[0]).filter(k=>!(k in G.scores[p]) && allowed(k,p));
    aiPlan={seq:G.rollSeq, d:aiDecide(G.dice, 3-G.rolls, G.scores[p], G.order||'free', cats, G.ai[p])};
  }
  const d=aiPlan.d;
  if(d.pick){ aiPlan=null; pickCore(d.pick,true); return; }
  if(d.hold.join()!==G.held.join()){ commit({held:d.hold}); sfx.bubble(); return maybeAI(900); }
  rollCore(); maybeAI(1400);
}

/* ================= Aviseringar ================= */
const BASE_TITLE=document.title; let blinkT=null, wakeLock=null;
let wakeOn = lsGet('ry_wake')!=='0';
function showTurnBanner(msg,icon='🐬'){
  const b=document.createElement('div'); b.className='turnbanner'; b.innerHTML=`<small>${icon}</small>${esc(msg)}`;
  document.getElementById('party').appendChild(b); setTimeout(()=>b.remove(),2100);
}
function startBlink(msg){ if(blinkT) return; let on=false; blinkT=setInterval(()=>{ document.title=(on=!on)?'🔔 '+msg:BASE_TITLE; },900); }
function stopBlink(){ clearInterval(blinkT); blinkT=null; document.title=BASE_TITLE; }
let SWREG=null;
if(!BOT && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js').then(r=>{ SWREG=r; }).catch(()=>{}); });
}
function systemNotify(msg){
  if(BOT) return;
  if(!('Notification' in window) || Notification.permission!=='granted') return;
  if(SWREG && SWREG.showNotification){ SWREG.showNotification('Stjärndelfin Yatzy 🐬',{body:msg, tag:'yatzy-tur', renotify:true, icon:'icon-192.png', badge:'icon-192.png', vibrate:[180,90,180]}).catch(()=>{}); return; }
  try{ const n=new Notification('Stjärndelfin Yatzy 🐬',{body:msg, tag:'yatzy-tur', renotify:true}); n.onclick=()=>{ try{ window.focus(); }catch(e){} n.close(); }; }catch(e){}
}
function notifyTurn(msg){
  if(!G || G.over) return;
  if(view!=='game'){ if(mode==='online') notice({icon:gIcon(), title:`Din tur i ${gName()}!`, text:msg, actions:[{label:'Till spelet', run:backToGame}]}); return; }
  sfx.turn(); buzz([180,90,180,90,300]); showTurnBanner(msg);
  if(document.hidden){ startBlink(msg); systemNotify(msg); }
}
async function askNotify(){
  if(!('Notification' in window)){ toast('Den här webbläsaren tillåter inte systemaviseringar – du får ljud, vibration och blinkande flik i stället 🔔',4500); return; }
  try{ const r=await Notification.requestPermission();
    toast(r==='granted'?'Aviseringar påslagna 🔔':'Aviseringar blev nekade – ljud och vibration fungerar ändå',3500);
  }catch(e){ toast('Kunde inte slå på aviseringar här',3000); }
  if(M().classList.contains('show')) showSettings();
}
async function keepAwake(){
  if(!wakeOn || mode!=='online' || !G) return releaseWake();
  try{ if(!wakeLock && navigator.wakeLock){ wakeLock=await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release',()=>{ wakeLock=null; }); } }catch(e){}
}
function releaseWake(){ try{ wakeLock && wakeLock.release() }catch(e){} wakeLock=null; }
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){ stopBlink(); keepAwake(); } });

/* ================= Animation ================= */
function animateRoll(final, held){
  rolling=true; sfx.roll(); buzz([10,30,10]);
  const iv=setInterval(()=>{ shown=shown.map((v,i)=>held[i]?final[i]:rnd()); renderDice(); },75);
  setTimeout(()=>{
    clearInterval(iv); rolling=false; shown=final.slice(); render();
    if(isYatzy(final) && G && G.scores){
      celebrate();                                                                 // fem lika firas alltid
      const p=G.cur, sc=G.scores[p]||{};
      // i ordning fylls yatzy-raden i direkt (om den är tom) – den rad man stod på spelas nästa tur
      if(G.order==='down' && !('yatzy' in sc) && myTurn()){
        const seq=G.rollSeq, cur=G.cur;
        setTimeout(()=>{ if(G && !G.over && G.rollSeq===seq && G.cur===cur && !('yatzy' in G.scores[cur]) && myTurn()){ toast('Yatzy-raden fylls i! 50 poäng 🐬',2600); pickCore('yatzy',false); } },1800);
      }
    }  },700);
}
function sparkles(n=30){
  const party=document.getElementById('party');
  const icons=['⭐','✨','💙','🌟','💫','🫧','🐬','🪐'];
  for(let i=0;i<n;i++){
    const s=document.createElement('div'); s.className='spark'; s.textContent=pickOne(icons);
    const a=Math.random()*Math.PI*2, r=120+Math.random()*260;
    s.style.left='50%'; s.style.top='40%';
    s.style.setProperty('--dx',Math.cos(a)*r+'px'); s.style.setProperty('--dy',Math.sin(a)*r+'px');
    s.style.setProperty('--r',(Math.random()*720-360)+'deg');
    s.style.animationDelay=(Math.random()*.3)+'s';
    party.appendChild(s); setTimeout(()=>s.remove(),2100);
  }
}
function celebrate(text='YATZY!'){
  const party=document.getElementById('party');
  const t=document.createElement('div'); t.className='ytext'; t.textContent=text;
  const j=document.createElement('div'); j.className='jumper'; j.innerHTML=DOLPHIN('jj','#ffffff','#3ee6ff');
  party.append(t,j); sfx.yatzy(); buzz([40,60,40,60,120]); sparkles(46);
  setTimeout(()=>{t.remove();j.remove()},2700);
}

/* ================= Nätverk – direkt mellan mobilerna (värden är nav för upp till 4 spelare) ================= */
const PREFIX='stjarndelfin-yatzy-v1-'+(DEV?'dev-':'');   // testversionen kan aldrig koppla upp mot riktiga spel
const MAXP=4;
let peer=null, conn=null, net='off', role=null, retryT=null, myName='', lastHeard=0;
const hostConns=new Set();
const NETTXT={off:'',starting:'🟡 Startar…',waiting:'🟡 Väntar på spelare',connecting:'🟡 Ansluter…',connected:'🟢 Ansluten',lost:'🔴 Ingen kontakt – försöker igen…'};
const NETERR=['network','server-error','socket-error','socket-closed','browser-incompatible','webrtc'];
let netWhy='', netTips={};   // varför kontakten saknas: 'server' (kopplingsservern), 'direct' (direktkontakten), 'nogame' (fel kod)
const NETWHY={server:'🔴 Når inte kopplingsservern – försöker igen…', direct:'🔴 Hittar spelet men når inte den andra mobilen – försöker igen…', nogame:'🔴 Hittar inget spel med den koden än – försöker igen…'};
function netTip(k,txt){ if(netTips[k]) return; netTips[k]=1; toast(txt,6000); }
function netFail(why){
  netWhy=why;
  if(why==='server') netTip('server','Når inte kopplingsservern 📡 Kolla att mobilen har internet. Ibland ligger den gratis servern nere en stund – appen försöker igen av sig själv.');
  if(net!=='lost') setNet('lost'); else render();
}
function watchServer(p){ setTimeout(()=>{ if(peer===p && !p.open && !p.destroyed) netFail('server'); },10000); }
function netText(){
  if(net==='lost' && NETWHY[netWhy]) return NETWHY[netWhy];
  if(role==='host' && net==='connected'){ const n=[...hostConns].filter(c=>c.open && c._seat!=null).length; return `🟢 ${n} ${n===1?'ansluten':'anslutna'}`; }
  return NETTXT[net]||'';
}
function setNet(s){
  if(net===s) return;
  if(s==='connected' || s==='waiting'){ netWhy=''; netTips={}; }
  const was=net; net=s;
  if(s==='connected' && was!=='connected' && G && ready() && role==='guest') toast('Ansluten! 🟢');
  render();
}
function peerOpts(){ return Object.assign({debug:0}, window.__PEER_OPTS||{}); }
function saveNet(){
  if(mode!=='online') return;
  lsSet('ry_net', JSON.stringify({code:gameId, role, seat:mySeat, name:myName}));
  if(G) lsSet('ry_net_state', JSON.stringify(G));
}
function sendTo(c,m){
  try{
    if(!c || !c.open) return;
    // värden skickar aldrig motståndarens hemligheter (skepp, kod, ord) till en gäst
    if(role==='host' && m && m.t==='state' && m.state && m.state.kind && m.state.kind!=='yatzy' && typeof gRedact==='function') m={...m, state:gRedact(m.state, c._seat)};
    c.send(JSON.stringify(m));
  }catch(e){}
}
function hostBroadcast(m,except){ for(const c of hostConns) if(c!==except && c._seat!=null) sendTo(c,m); }
function send(m){ if(role==='host') hostBroadcast(m); else sendTo(conn,m); }
function stopPeer(){
  try{ conn && conn.close() }catch(e){}
  for(const c of hostConns){ try{ c.close() }catch(e){} } hostConns.clear();
  try{ peer && peer.destroy() }catch(e){}
  peer=null; conn=null;
}
function stopNet(){ clearTimeout(retryT); stopPeer(); net='off'; }
function retry(fn,ms=4000){ clearTimeout(retryT); retryT=setTimeout(fn,ms); }
function newCode(){ return Array.from({length:4},()=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[rint(31)]).join(''); }   // kryptografisk slump
function noPeerLib(){ toast('Nätverket laddades inte – har mobilen internet? 📡',4000); setNet('lost'); }
function parseMsg(d){ try{ return typeof d==='string' ? JSON.parse(d) : d }catch(e){ return null } }

/* ---------- Värd: den som skapar spelet ---------- */
function hostGame(name, order, kind){
  stopNet(); mode='online'; role='host'; mySeat=0; myName=name; gameId=newCode();
  if(kind && kind!=='yatzy'){ G=gNewState(kind,[name],0,null); G.started=false; resetDrafts(); }
  else { G=newState([name],0,order); G.started=false; G.hr4=chosenHR; shown=G.dice.slice(); }
  freshCell=null; view='game';
  saveNet(); render(); startHost(); keepAwake();
}
function startHost(){
  if(mode!=='online' || role!=='host') return;
  if(typeof Peer==='undefined'){ noPeerLib(); retry(startHost); return; }
  stopPeer(); setNet('starting');
  const p = peer = new Peer(PREFIX+gameId, peerOpts()); watchServer(p);
  p.on('open',()=>{ if(peer===p){ netWhy=''; updateHostNet(); } });
  p.on('connection',c=>{ if(peer===p) attachHost(c); });
  p.on('disconnected',()=>{ if(peer===p && !p.destroyed) setTimeout(()=>{ try{ p.reconnect() }catch(e){} },1500); });
  p.on('error',e=>{
    if(peer!==p) return;
    if(e.type==='unavailable-id'){ setNet('starting'); retry(startHost,4000); }   // gamla sessionen hänger kvar en stund
    else if(NETERR.includes(e.type)){ netFail(e.type==='webrtc'?'direct':'server'); retry(startHost,4000); }
  });
}
function updateHostNet(){
  const any=[...hostConns].some(c=>c.open && c._seat!=null);
  const s = peer && peer.open ? (any?'connected':'waiting') : 'lost';
  if(s!==net) setNet(s); else if(view==='game') render();
}
function attachHost(c){
  c._seat=null; c._heard=Date.now(); hostConns.add(c);
  c.on('data',d=>{ const m=parseMsg(d); c._heard=Date.now(); if(m) onHostMsg(m,c); });
  c.on('close',()=>{ const had=hostConns.delete(c); if(had && c._seat!=null && G && ready()) toast(`${pname(c._seat)} tappade kontakten 📡`); updateHostNet(); });
  c.on('error',()=>{});
}
function onHostMsg(m,c){
  if(m.t==='ping'){ sendTo(c,{t:'pong'}); return; }
  if(!m.t || !G) return;
  if(m.t==='hello'){
    let seat=null;
    const nm=String(m.name||'').replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').slice(0,14).trim();   // inga styr- eller riktningstecken
    const alive = i => [...hostConns].some(o=>o!==c && o.open && o._seat===i && Date.now()-(o._heard||0)<10000);
    if(Number.isInteger(m.seat) && m.seat>0 && G.names[m.seat] && G.names[m.seat]===nm) seat=m.seat;      // återanslutning
    else if(nm && G.names.indexOf(nm,1)>0 && (G.started!==false || !alive(G.names.indexOf(nm,1)))) seat=G.names.indexOf(nm,1);   // samma spelare kommer tillbaka – den gamla anslutningen är död
    else if(G.started===false && G.names.length<maxP() && nm){
      let n=nm, k=2; while(G.names.includes(n)) n=nm.slice(0,12)+' '+(k++);
      G.names.push(n); if(Array.isArray(G.scores)) G.scores.push({}); G.seq=(G.seq||0)+1; G.updatedAt=Date.now();
      seat=G.names.length-1; saveNet();
      if(view!=='game') notice({icon:'🚀', title:`${n} gick med i ditt spel`, text:`Yatzy ${gameId} · ${G.names.length} av ${MAXP} spelare`, actions:[{label:'Till spelet', run:backToGame}]});
      else { sfx.turn(); toast(`${n} är med! 🚀`); }
    } else {
      sendTo(c,{t:'full', reason: G.started===false ? 'full' : 'started'}); setTimeout(()=>{ try{ c.close() }catch(e){} },800); return;
    }
    for(const o of hostConns) if(o!==c && o._seat===seat){ try{ o.close() }catch(e){} hostConns.delete(o); }
    c._seat=seat;
    if(!isKind() && (m.state?.seq||0)>(G.seq||0) && guestMayUpdate(G, m.state, seat)) onGameData(JSON.parse(JSON.stringify(m.state)));
    if(typeof CHAT!=='undefined'){ if(m.card && typeof m.card==='object' && typeof m.card.id==='string' && /^[0-9a-f]{16}$/.test(m.card.id)){ c._card=m.card; CHAT.seenCards([m.card],'ett spel'); } const cards=[CHAT.card(), ...[...hostConns].map(o=>o._card)].filter(Boolean); if(cards.length) hostBroadcast({t:'cards', cards}); }
    sendTo(c,{t:'welcome', seat, name:G.names[seat]});
    if(typeof FR!=='undefined') FR.onConnect(x=>sendTo(c,x));
    sendTo(c,{t:'state', state:G, force:true});          // värdens version gäller alltid efter återanslutning
    hostBroadcast({t:'state', state:G}, c);
    updateHostNet(); render();
    return;
  }
  if(c._seat==null) return;
  if(m.t==='state'){
    if(!isKind() && (m.state?.seq||0)>(G.seq||0) && guestMayUpdate(G, m.state, c._seat)){ onGameData(JSON.parse(JSON.stringify(m.state))); hostBroadcast({t:'state', state:G}, c); }
    else sendTo(c,{t:'state', state:G, force:true});   // ogiltigt eller gammalt: gästen får värdens version
    return;
  }
  if(m.t==='act'){ if(isKind()) applyAndPublish(m.a, c._seat); return; }
  if(m.t==='pg'){ if(typeof PONG!=='undefined') PONG.net(m, c._seat); return; }   // Pong: gästens racket
  if(m.t==='sl'){ if(typeof SLALOM!=='undefined') SLALOM.net(m, c._seat); return; }   // Slalom: gästens åkare
  if(m.t==='bs'){ if(typeof BIATHLON!=='undefined'){ const mm={...m, s:c._seat}; BIATHLON.net(mm); hostBroadcast(mm,c); } return; }   // Skidskytte: gästens åkare, vidare till de andra
  if(typeof m.t==='string' && m.t.startsWith('fr') && typeof FR!=='undefined'){ FR.onMsg(m, x=>sendTo(c,x)); return; }   // önskelistan
  if(m.t==='chat'){                                   // krypterat chattmeddelande via spelet: till mig eller vidare till en annan spelare
    if(typeof m.to!=='string' || !/^[0-9a-f]{16}$/.test(m.to) || !m.env || typeof m.env!=='object') return;
    const now=Date.now(); c._chatN=(now-(c._chatT||0)>10000)?1:(c._chatN||0)+1; if(c._chatN===1) c._chatT=now; if(c._chatN>60) return;   // ingen spam
    if(typeof CHAT!=='undefined' && m.to===CHAT.myId()){ CHAT.bridgeIn(m.env); return; }
    for(const o of hostConns) if(o!==c && o.open && o._card && o._card.id===m.to){ sendTo(o,{t:'chat', to:m.to, env:m.env}); break; }
    return;
  }
  if((m.t==='emoji'||m.t==='poke') && Date.now()-(c._socT||0) < (m.t==='poke'?4000:300)) return;   // ingen spam
  if(m.t==='emoji'||m.t==='poke') c._socT=Date.now();
  if(m.t==='emoji' || m.t==='poke'){
    const out={t:m.t, e:m.e, from:c._seat, to:m.to};
    hostBroadcast(out,c); onSocial(out);
  }
}

/* ---------- Gäst: den som går med med kod ---------- */
function joinGame(code,name){
  stopNet(); mode='online'; role='guest'; mySeat=null; myName=name; gameId=code; G=null; freshCell=null; view='game';
  saveNet(); render(); startGuest(); keepAwake();
}
function startGuest(){
  if(mode!=='online' || role!=='guest') return;
  if(typeof Peer==='undefined'){ noPeerLib(); retry(startGuest); return; }
  stopPeer(); setNet('connecting');
  const p = peer = new Peer(peerOpts()); watchServer(p);
  p.on('open',()=>{ if(peer===p){ netWhy=''; connectGuest(); } });
  p.on('disconnected',()=>{ if(peer===p && !p.destroyed) setTimeout(()=>{ try{ p.reconnect() }catch(e){} },1500); });
  p.on('error',e=>{
    if(peer!==p) return;
    if(e.type==='peer-unavailable'){
      netFail('nogame');
      if(!G) toast(`Hittar inget spel med koden ${gameId} än – kolla koden 🔭`,3500);
      retry(connectGuest,4000);
    } else if(NETERR.includes(e.type)){ netFail(e.type==='webrtc'?'direct':'server'); retry(startGuest,4000); }
  });
}
function connectGuest(){
  clearTimeout(retryT);
  if(mode!=='online' || role!=='guest') return;
  if(!peer || peer.destroyed){ startGuest(); return; }
  if(peer.disconnected){ try{ peer.reconnect() }catch(e){} retry(connectGuest,3000); return; }
  if(conn && conn.open) return;
  setNet('connecting');
  const c = peer.connect(PREFIX+gameId,{reliable:true});
  attachGuest(c);
  setTimeout(()=>{ if(conn===c && !c.open){ try{ c.close() }catch(e){} conn=null;
    directFails++; netFail('direct');
    if(directFails>=2) netTip('direct','Spelet finns men mobilerna når inte varandra 📶 Prova att båda kör på wifi – mobilnät stoppar ibland direktkontakten mellan telefoner.');
    retry(connectGuest,2500); } },12000);
}
let directFails=0;
function attachGuest(c){
  if(conn && conn!==c){ try{ conn.close() }catch(e){} }
  conn=c;
  c.on('open',()=>{ if(conn!==c) return; lastHeard=Date.now(); directFails=0; setNet('connected'); sendTo(c,{t:'hello', seat:mySeat, name:myName, state:G, card:(typeof CHAT!=='undefined'?CHAT.card():null)}); });
  c.on('data',d=>{ if(conn!==c) return; const m=parseMsg(d); if(m) onGuestMsg(m); });
  c.on('close',()=>{ if(conn!==c) return; conn=null; setNet('lost'); retry(connectGuest,2000); });
  c.on('error',()=>{});
}
function onGuestMsg(m){
  lastHeard=Date.now();
  if(m.t==='ping'){ sendTo(conn,{t:'pong'}); return; }
  if(!m.t || m.t==='pong') return;
  if(m.t==='welcome'){ if(!isI(m.seat,1,7) || (m.name!=null && !okPName(m.name))) return; const first=mySeat===null; mySeat=m.seat; if(m.name) myName=String(m.name); saveNet(); render(); if(first) toast(`Du är med i spelet ${gameId}! 🐬`); return; }
  if(m.t==='full'){
    if(m.reason==='started' && G && G.started!==false && Array.isArray(G.names) && G.names.includes(myName)){
      setNet('lost'); retry(connectGuest,5000); return;                 // vi hör hemma i spelet – försök igen i stället för att lämna
    }
    toast(m.reason==='started' ? 'Det spelet har redan startat 😕' : 'Spelet är fullt – max 4 spelare 😕',4500);
    lsSet('ry_net',''); stopNet(); setTimeout(goLobby,1200); return;
  }
  if(m.t==='state'){ if(validState(m.state) && (!G || (m.state.seq||0)>(G.seq||0) || (m.force && JSON.stringify(m.state)!==JSON.stringify(G)))) onGameData(JSON.parse(JSON.stringify(m.state))); return; }
  if(m.t==='cards'){ if(Array.isArray(m.cards)){ gameCardIds=m.cards.slice(0,8).map(c=>c&&c.id).filter(id=>typeof id==='string'&&/^[0-9a-f]{16}$/.test(id)); if(typeof CHAT!=='undefined') CHAT.seenCards(m.cards,'ett spel'); } return; }
  if(m.t==='pg'){ if(typeof PONG!=='undefined') PONG.net(m, 0); return; }   // Pong: bollen från värden
  if(m.t==='sl'){ if(typeof SLALOM!=='undefined') SLALOM.net(m, 0); return; }   // Slalom: värdens åkare
  if(m.t==='bs'){ if(typeof BIATHLON!=='undefined') BIATHLON.net(m); return; }   // Skidskytte: de andras åkare
  if(m.t==='chat'){ if(typeof CHAT!=='undefined' && m.env && typeof m.env==='object') CHAT.bridgeIn(m.env); return; }
  if(typeof m.t==='string' && m.t.startsWith('fr') && typeof FR!=='undefined'){ FR.onMsg(m, x=>sendTo(conn,x)); return; }
  if(m.t==='emoji' || m.t==='poke') onSocial(m);
}
/* ---------- Validering av speldata från andra enheter ----------
   Allt som kommer över nätet kontrolleras strikt innan det används. */
const isI=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b;
const okPName=n=>typeof n==='string' && n.length>0 && n.length<=20;
function validYatzy(s){
  if(!Array.isArray(s.dice)||s.dice.length!==5||!s.dice.every(d=>isI(d,1,6))) return false;
  if(!Array.isArray(s.held)||s.held.length!==5||!s.held.every(h=>typeof h==='boolean')) return false;
  if(!isI(s.rolls,0,3)||!isI(s.cur,0,s.names.length-1)||!isI(s.starter??0,0,s.names.length-1)) return false;
  if(!Array.isArray(s.scores)||s.scores.length!==s.names.length) return false;
  for(const sc of s.scores){ if(!sc||typeof sc!=='object'||Array.isArray(sc)) return false;
    for(const [k,v] of Object.entries(sc)) if(!Object.prototype.hasOwnProperty.call(NAME,k) || !isI(v,0,50)) return false; }
  if(!['free','down'].includes(s.order)) return false;
  if(s.last!=null && (typeof s.last!=='object'||!isI(s.last.p,0,s.names.length-1)||!Object.prototype.hasOwnProperty.call(NAME,s.last.cat)||!isI(s.last.val,0,50))) return false;
  if(s.ai!=null && (!Array.isArray(s.ai)||s.ai.length>MAXP)) return false;
  return typeof s.seq==='number' && isFinite(s.seq);
}
function validState(s){
  if(!s || typeof s!=='object' || Array.isArray(s)) return false;
  const maxN = s.kind && s.kind!=='yatzy' && typeof GINFO!=='undefined' && Object.prototype.hasOwnProperty.call(GINFO,s.kind) ? (GINFO[s.kind].max||2) : MAXP;
  if(!Array.isArray(s.names) || s.names.length<1 || s.names.length>maxN || !s.names.every(okPName)) return false;
  if(typeof s.seq!=='number' || !isFinite(s.seq)) return false;
  if(s.kind!==undefined && s.kind!=='yatzy') return typeof KIND!=='undefined' && Object.prototype.hasOwnProperty.call(KIND,s.kind) && (!KIND[s.kind].valid || KIND[s.kind].valid(s));
  return validYatzy(s);
}
// Får gästen på plats `seat` byta Yatzy-tillståndet från `prev` till `s`? (värden bestämmer)
function guestMayUpdate(prev, s, seat){
  if(!prev || !validState(s) || (s.kind && s.kind!=='yatzy') || (prev.kind && prev.kind!=='yatzy')) return false;
  if(JSON.stringify(s.names)!==JSON.stringify(prev.names) || s.order!==prev.order || !!s.hr4!==!!prev.hr4 || JSON.stringify(s.ai||null)!==JSON.stringify(prev.ai||null)) return false;
  if(prev.started===false && s.started!==false) return false;                       // bara värden startar
  const rematch = prev.over && !s.over && s.scores.every(sc=>Object.keys(sc).length===0);
  if(rematch) return true;
  if(prev.over || prev.cur!==seat) return false;                                    // bara den som har turen
  for(let i=0;i<s.scores.length;i++){
    const a=prev.scores[i]||{}, b=s.scores[i];
    for(const k of Object.keys(a)) if(b[k]!==a[k]) return false;                    // gamla poäng ändras aldrig
    const added=Object.keys(b).filter(k=>!(k in a));
    if(i!==seat ? added.length : added.length>1) return false;                       // bara egna, en rad i taget
  }
  return true;
}

// Hjärtslag: märker när kontakten dör tyst (t.ex. skärmen släcktes)
setInterval(()=>{
  if(mode!=='online') return;
  if(role==='host'){ for(const c of hostConns){ if(!c.open) continue; sendTo(c,{t:'ping'}); if(Date.now()-c._heard>16000){ try{ c.close() }catch(e){} } } return; }
  if(!conn || !conn.open) return;
  sendTo(conn,{t:'ping'});
  if(Date.now()-lastHeard > 16000){ try{ conn.close() }catch(e){} }
},5000);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible') return;
  if(mode!=='online'){ autoResume(); return; }
  netCheck();
});
// Önskelistan sprids också genom spelet
function gameFrBroadcast(m){ if(mode!=='online') return; if(role==='host') hostBroadcast(m); else if(conn && conn.open) sendTo(conn,m); }
// Chattens reservväg genom spelanslutningen
let gameCardIds=[];
function gameBridgeHas(id){
  if(mode!=='online' || !G) return false;
  if(role==='host') return [...hostConns].some(o=>o.open && o._card && o._card.id===id);
  return !!(conn && conn.open && gameCardIds.includes(id));
}
function gameBridge(id, env){
  if(!gameBridgeHas(id)) return false;
  const msg={t:'chat', to:id, env};
  if(role==='host'){ for(const o of hostConns) if(o.open && o._card && o._card.id===id){ sendTo(o,msg); return true; } return false; }
  sendTo(conn,msg); return true;
}
// Kontrollera nätet direkt (efter appbyte, skärmlås eller när mobilen får nät igen)
function netCheck(){
  if(mode!=='online') return;
  const t0=Date.now();
  if(role==='guest'){
    if(!peer || peer.destroyed){ startGuest(); return; }
    if(peer.disconnected){ try{ peer.reconnect() }catch(e){} }
    if(!(conn && conn.open)){ connectGuest(); return; }
    const c=conn; sendTo(c,{t:'ping'});                                   // lever anslutningen? värden svarar direkt
    setTimeout(()=>{ if(conn===c && lastHeard<t0){ try{ c.close() }catch(e){} conn=null; setNet('lost'); connectGuest(); } },4000);
  } else if(role==='host'){
    if(!peer || peer.destroyed){ startHost(); return; }
    if(peer.disconnected){ try{ peer.reconnect() }catch(e){ startHost(); return; } }
    for(const c of hostConns) sendTo(c,{t:'ping'});
    setTimeout(()=>{ for(const c of [...hostConns]) if((c._heard||0)<t0){ try{ c.close() }catch(e){} hostConns.delete(c); } updateHostNet(); },4000);
  }
}
window.addEventListener('online', ()=>{ setTimeout(netCheck,500); });
window.addEventListener('pageshow', e=>{ if(e.persisted) setTimeout(()=>{ mode==='online' ? netCheck() : autoResume(); },300); });
// Starta: om ett onlinespel pågick när appen stängdes går vi direkt tillbaka in i det
function canAutoResume(){
  if(mode==='online' || BOT) return false;
  try{
    const n=JSON.parse(lsGet('ry_net')); if(!n || !n.code) return false;
    const s=JSON.parse(lsGet('ry_net_state'));
    if(!s || s.over) return false;                                    // avslutade spel öppnas inte automatiskt
    return Date.now()-(s.updatedAt||0) < 12*3600e3;                   // gamla spel (över ett halvt dygn) väntar i lobbyn
  }catch(e){ return false; }
}
function autoResume(){ if(!canAutoResume()) return false; resumeNet(); return mode==='online'; }
function startOnlineGame(){
  if(role!=='host' || !G || G.started!==false) return;
  if(G.names.length<2){ toast('Vänta tills minst en till har gått med 🔭'); return; }
  unlockAudio();
  if(isKind()){ gStartOnline(); toast('Nu kör vi! 🚀'); sfx.turn(); return; }
  commit({started:true, cur:0, starter:0, rolls:0, held:F5(), scores:G.names.map(()=>({}))});
  toast(`Nu kör vi! Du börjar 🚀`); sfx.turn();
}

function onGameData(d){
  if(d.kind && d.kind!=='yatzy'){ const prev=G; G=d; if(prev && prev.kind===d.kind) gOnChange(prev,d); saveNet(); render(); return; }
  const prev=G; G=d;
  if(!prev){ shown=d.dice.slice(); }
  else {
    if(d.rollSeq!==prev.rollSeq && d.rolls>0 && d.dice.join()!==shown.join()){
      animateRoll(d.dice, d.held);
    } else if(!rolling){ shown=d.dice.slice(); }
    if(d.held.join()!==prev.held.join() && d.cur!==mySeat && d.held.some((h,i)=>h&&!prev.held[i])) sfx.bubble();
    if(d.names.length>prev.names.length && role!=='host') toast(`${d.names[d.names.length-1]} är med! 🚀`);
    if(prev.started===false && d.started!==false){ if(view!=='game' && d.cur!==mySeat) notice({icon:'🎲', title:'Yatzy-spelet har startat', text:`${pname(d.cur)} börjar`, actions:[{label:'Till spelet', run:backToGame}]}); else toast('Spelet startar! 🚀'); if(d.cur===mySeat) setTimeout(()=>notifyTurn(`Din tur, ${pname(mySeat)}!`),600); }
    const lt=d.last&&d.last.t, pt=prev.last&&prev.last.t;
    if(lt && lt!==pt && d.last.p!==mySeat){
      freshCell=d.last.p+':'+d.last.cat;
      toast(`${pname(d.last.p)} fick ${d.last.val} på ${NAME[d.last.cat]}`);
      if(!d.over && d.cur===mySeat) setTimeout(()=>notifyTurn(`Din tur, ${pname(mySeat)}!`),700);
      if(d.over){ setTimeout(()=>{ sfx.win(); sparkles(40); },500); try{ window.scrollTo({top:0,behavior:'smooth'}) }catch(e){} }
    }
    if(d.over && !prev.over){ finishGame(); if(view!=='game') notice({icon:'🏁', title:'Yatzy-matchen är klar', text:'Se vem som vann', actions:[{label:'Visa resultat', run:()=>{ backToGame(); setTimeout(()=>{ if(G&&G.over) openModal(resultHTML()); },300); }}]}); }
    if(prev.over && !d.over) { freshCell=null; if(M().classList.contains('show')) closeModal(); toast(`Ny match! ${pname(d.cur)} börjar 🚀`); if(d.cur===mySeat) setTimeout(()=>notifyTurn(`Din tur, ${pname(mySeat)}!`),900); }
  }
  saveNet();
  render();
}
function resumeNet(){
  try{
    const n=JSON.parse(lsGet('ry_net')); if(!n || !n.code) return;
    let s=null; try{ s=JSON.parse(lsGet('ry_net_state')) }catch(e){}
    stopNet(); mode='online'; role=n.role; mySeat=(n.seat===undefined?null:n.seat); myName=n.name||''; gameId=n.code;
    G = validState(s) ? s : null; if(G && Array.isArray(G.dice)) shown=G.dice.slice(); freshCell=null; view='game'; render();
    role==='host' ? startHost() : startGuest(); keepAwake();
  }catch(e){ console.error('resumeNet', e); }
}

/* ================= Emojis & puffar ================= */
const EMOJIS=['❤️','😂','😎','😭','😏'];
const EMOJI_OK=[...EMOJIS,'😢'];   // tar emot äldre versioners gråtemoji också
const AI_REPLY={'❤️':'😎','😂':'😂','😎':'😏','😭':'❤️','😏':'😎'};
let trayOpen=false, lastPoke=0;
const isAIgame = () => mode==='local' && G && G.ai && G.ai.some(Boolean);
const botName = () => G && G.ai ? G.names[G.ai.findIndex(Boolean)] : AI_NAME;
const canPoke = () => (mode==='online' && ready() && !G.over) || isAIgame();
function emojiSwarm(e,n=16){
  const party=document.getElementById('party');
  if(party.querySelectorAll('.floatemo').length>100) return;
  for(let i=0;i<n;i++){
    const d=document.createElement('div'); d.className='floatemo'; const sp=document.createElement('span'); sp.textContent=e; d.appendChild(sp);
    const st=d.style; st.left=(6+Math.random()*86)+'%';
    st.setProperty('--s',(26+Math.random()*30)+'px'); st.setProperty('--d',(2.4+Math.random()*1.7)+'s');
    st.setProperty('--dx',(Math.random()*140-70)+'px'); st.setProperty('--r',(Math.random()*50-25)+'deg');
    st.animationDelay=(Math.random()*.9)+'s'; sp.style.animationDelay=(-Math.random()*1.3)+'s';
    party.appendChild(d); setTimeout(()=>d.remove(),5200);
  }
}
function onSocial(m){
  if(!G) return;
  const from = Number.isInteger(m.from) ? m.from : -1;
  if(m.t==='emoji' && EMOJI_OK.includes(m.e)){ emojiSwarm(m.e); sfx.pop(); if(from>=0) toast(`${pname(from)}: ${m.e}`,1600); }
  if(m.t==='poke' && m.to===mySeat && ready()) gotPoke(from);
}
function sendEmoji(e){
  if(!EMOJIS.includes(e)) return;
  emojiSwarm(e); sfx.pop(); buzz(10);
  if(mode==='online'){ send({t:'emoji', e, from:mySeat}); if(net!=='connected') toast('Ingen kontakt just nu – bara du ser den 📡',2500); }
  else if(isAIgame() && Math.random()<.75){ const rep=AI_REPLY[e], bn=botName(); setTimeout(()=>{ if(!G) return; emojiSwarm(rep,10); sfx.pop(); toast(`${bn}: ${rep}`,1600); },1300); }
}
function sendPoke(){
  if(!canPoke()) return;
  if(Date.now()-lastPoke<4000){ toast('Vänta lite innan du puffar igen 😉'); return; }
  if(mode==='online'){
    if(G.cur===mySeat){ toast('Det är din egen tur – kör! 😄'); return; }
    if(net!=='connected'){ toast('Ingen kontakt just nu 📡'); return; }
    lastPoke=Date.now(); sfx.poke(); buzz(30);
    send({t:'poke', from:mySeat, to:G.cur}); toast(`Puff skickad till ${pname(G.cur)}! 👉`);
  } else {
    lastPoke=Date.now(); sfx.poke(); buzz(30);
    const bn = isAI(G.cur) ? pname(G.cur) : botName();
    setTimeout(()=>toast(`${bn}: Jag är en robot, jag blir aldrig trött! ⚡`,3000),900);
  }
}
function gotPoke(from){
  const name = from>=0 ? pname(from) : 'Någon';
  if(view!=='game'){ notice({icon:'👉', title:`${name} puffar dig!`, text:'"Kom igen kompis!" – det är din tur i Yatzy', poke:true, actions:[{label:'Till spelet', run:backToGame}]}); return; }
  sfx.poke(); buzz([60,40,60,40,220]); showTurnBanner('Kom igen kompis!','👉');
  toast(`${name} puffade dig: "Kom igen kompis!" 👉`,3500);
  if(document.hidden){ startBlink('Kom igen kompis! 👉'); systemNotify(`${name}: Kom igen kompis! 👉`); }
}
function trayHTML(){
  const target = mode==='online' && G && G.cur!==mySeat ? ` ${esc(pname(G.cur))}` : '';
  return `<div class="tray ${trayOpen?'open':''}">${EMOJIS.map(e=>`<button class="emo" data-act="emo" data-e="${e}" aria-label="Skicka ${e}">${e}</button>`).join('')}${canPoke()?`<button class="poke" data-act="poke">👉 Kom igen kompis!${target?' <span style="font-weight:400;opacity:.85">→'+target+'</span>':''}</button>`:''}</div>`;
}

async function invite(){
  const url=location.origin+location.pathname+'#'+gameId;
  const text=`Kom och spela ${gName()} med mig! 🐬 Kod: ${gameId}`;
  try{ if(navigator.share){ await navigator.share({title:'Stjärndelfin Yatzy',text,url}); return; } }catch(e){ if(e&&e.name==='AbortError') return; }
  try{ await navigator.clipboard.writeText(text+' '+url); toast('Länken är kopierad – klistra in den i Messenger 📋',3500); }
  catch(e){ toast('Länk: '+url,6000); }
}

/* ================= Statistik ================= */
function loadStats(){ try{ const s=JSON.parse(lsGet('ry_stats')); if(s && Array.isArray(s.games)) return s; }catch(e){} return {games:[]}; }
function saveStats(st){ lsSet('ry_stats', JSON.stringify(st)); }
function gameType(g){
  if(g.mode==='online') return 'online';
  if(g.names.length===1) return 'solo';
  const bots = g.ai ? g.ai.filter(Boolean) : [];
  if(bots.length>1 || (bots.length && g.names.length-bots.length>1)) return 'ai-mix';
  if(bots.length) return 'ai-'+bots[0];
  return 'local';
}
const TYPE_LABEL = {online:'🚀 Varsin mobil', 'ai-mix':'🤖 Mot flera robotar', solo:'🧑‍🚀 Ensam', 'ai-easy':'🤖 Mot Blixt (lätt)', 'ai-hard':'🤖 Mot Blixt (svår)', local:'📱 Flera på samma mobil'};
const typeLabel = (t,o) => (TYPE_LABEL[t]||t) + (o==='down' ? ' · i ordning' : ' · valfritt');
const MAXROW = {ones:5,twos:10,threes:15,fours:20,fives:25,sixes:30,pair:12,twopair:22,three:18,four:24,small:15,large:20,house:28,chance:30,yatzy:50};
function recordGame(){
  if(!G || !G.over) return;
  const id = G.id || ((gameId||'local')+'-'+(G.createdAt||0));
  const st=loadStats(); if(st.games.some(g=>g.id===id)) return;
  const type=gameType({mode, names:G.names, ai:G.ai});
  st.games.push({id, d:Date.now(), type, order:G.order||'free',
    players:G.names.map((n,i)=>{ const t=totals(G.scores[i]); return {n, s:t.total, up:t.up, bonus:t.bonus, rows:{...G.scores[i]}, ai:isAI(i)?G.ai[i]:null, human: mode==='online' ? i===mySeat : !isAI(i)}; })});
  if(st.games.length>600) st.games=st.games.slice(-600);
  saveStats(st);
}
const oppLabel = p => p.ai ? `${p.n.replace(' 🤖','')} 🤖 ${p.ai==='hard'?'svår':'lätt'}` : p.n;
function statsFor(who){
  const st=loadStats(), mine=[];
  st.games.forEach(g=>{ const i=g.players.findIndex(p=>p.human && p.n===who); if(i>=0) mine.push({g,me:g.players[i],opps:g.players.filter((_,j)=>j!==i)}); });
  return mine;
}
function resultOf(me,opps){ if(!opps.length) return null; const best=Math.max(...opps.map(o=>o.s)); return me.s>best?'W':me.s<best?'L':'T'; }
function subjects(){
  const cnt={}; loadStats().games.forEach(g=>g.players.forEach(p=>{ if(p.human) cnt[p.n]=(cnt[p.n]||0)+1; }));
  return Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]);
}
function h2hText(){
  // sammanställning mot motståndaren efter en tvåpersonersmatch
  if(!G || G.names.length!==2) return '';
  const meI = mode==='online' ? mySeat : (isAI(0)?1:0); if(meI===null || meI===undefined) return '';
  const me=G.names[meI], opp=G.names[1-meI];
  let w=0,l=0,t=0;
  statsFor(me).forEach(x=>{ if(x.opps.length===1 && x.opps[0].n===opp){ const r=resultOf(x.me,x.opps); r==='W'?w++:r==='L'?l++:t++; } });
  return `<div class="res-hl">Totalt ${esc(me)} mot ${esc(opp)}: <b>${w}</b> vinster, <b>${l}</b> förluster${t?`, <b>${t}</b> oavgjorda`:''}</div>`;
}
function resultHTML(){
  const P=G.names.length, T=G.scores.map(sc=>totals(sc));
  const order=G.names.map((_,i)=>i).sort((a,b)=>T[b].total-T[a].total);
  const max=T[order[0]].total, winners=order.filter(i=>T[i].total===max);
  const medals=['🥇','🥈','🥉'];
  let title, icon;
  if(P===1){ icon=G.record?'🏆':'🌟'; title=G.record?'NYTT REKORD!':'Bra spelat!'; }
  else if(winners.length>1){ icon='🤝'; title='Oavgjort!'; }
  else { icon='🏆'; title=`${esc(pname(winners[0]))} vinner!`; }
  const rows=order.map((i,k)=>{
    const t=T[i], s=G.scores[i];
    const best=CATS.map(c=>c[0]).filter(c=>s[c]>0).sort((a,b)=>(s[b]/MAXROW[b])-(s[a]/MAXROW[a]))[0];
    const zeros=CATS.filter(c=>s[c[0]]===0).length;
    const rank=T.filter(x=>x.total>t.total).length;
    return `<div class="res-p ${P>1&&winners.includes(i)&&winners.length===1?'win':''}"><div class="pos">${P===1?'🐬':medals[rank]||'⭐'}</div>
      <div><div class="nm">${esc(G.names[i])}</div><div class="sub">Övre ${t.up}${t.bonus?' + bonus 50':` (bonus vid ${bonusLimit(G.order)})`} · Nedre ${t.low}${best?` · Bäst: ${NAME[best]} ${s[best]}`:''}${s.yatzy===50?' · YATZY! 🐬':''}${zeros?` · ${zeros} streck`:''}</div></div>
      <div class="sc">${t.total}</div></div>`;
  }).join('');
  let extra='';
  if(P===1){ const b=bestList(G.order||'free'); extra=`<div class="res-hl">Rekord (${G.order==='down'?'i ordning':'valfritt'}): <b>${b[0]?b[0].s:T[0].total}</b>${b[0]?' – '+esc(b[0].n):''}</div>`; }
  else extra=h2hText();
  return `<div style="text-align:center;font-size:52px;line-height:1">${icon}</div>
    <h3 style="text-align:center;margin:6px 0 2px">${title}</h3>
    <p style="text-align:center;margin:0">${typeLabel(gameType({mode,names:G.names,ai:G.ai}),G.order)}</p>
    <div class="res-rank">${rows}</div>${extra}
    <div class="btns" style="flex-wrap:wrap"><button class="pri" data-act="rematch" style="flex-basis:100%">🐬 Spela igen</button>
      <button data-act="stats">📊 Statistik</button><button data-act="close">📋 Protokoll</button><button data-act="lobby">🏠 Lobby</button></div>`;
}
let resultShownFor=null;
function finishGame(){
  // anropas när sista raden är ifylld – på alla enheter
  recordGame();
  const id=G && (G.id||G.createdAt);
  if(resultShownFor===id) return; resultShownFor=id;
  setTimeout(()=>{ if(G && G.over && view==='game'){ openModal(resultHTML()); } },1600);
}
let statsWho=null, armedReset=false;
function statsHTML(){
  const subs=subjects();
  if(!statsWho || !subs.includes(statsWho)) statsWho = subs.includes(lsGet('ry_name')) ? lsGet('ry_name') : subs[0];
  let h=`<div class="topbar"><button class="iconbtn" data-act="lobby" aria-label="Tillbaka">‹</button><div class="tb-title">📊 <b>Statistik</b></div><button class="iconbtn" data-act="sptoggle" aria-label="Musik">🎵</button><button class="iconbtn" data-act="settings" aria-label="Inställningar">⚙️</button></div><div class="stats">`;
  if(!subs.length){ const o=typeof otherStatsHTML==='function'?otherStatsHTML():''; return h+(o?`<div class="stat-cols">${o}</div>`:`<div class="note" style="margin-top:20px">Ingen statistik än – spela en match så dyker den upp här! 🐬</div>`)+`<button class="bigbtn alt" data-act="resetstats" style="margin-top:22px;font-size:15px">${armedReset?'Tryck igen för att radera all statistik':'🗑️ Rensa statistik'}</button></div>`; }
  if(subs.length>1) h+=`<div class="chips" style="margin:4px 0 6px">${subs.map(n=>`<button data-act="statswho" data-n="${esc(n)}" class="${n===statsWho?'sel':''}">${esc(n)}</button>`).join('')}</div>`;
  const mine=statsFor(statsWho);
  const duels=mine.filter(x=>x.opps.length);
  let W=0,L=0,Tt=0; duels.forEach(x=>{ const r=resultOf(x.me,x.opps); r==='W'?W++:r==='L'?L++:Tt++; });
  h+=`<h2 class="sec">${esc(statsWho)}</h2><div class="kpis">
    <div class="kpi"><b>${mine.length}</b><span>matcher</span></div>
    <div class="kpi"><b style="color:#86efac">${W}</b><span>vinster</span></div>
    <div class="kpi"><b style="color:#fda4af">${L}</b><span>förluster</span></div>
    <div class="kpi"><b>${duels.length?Math.round(100*W/duels.length):0}%</b><span>vinst${Tt?` · ${Tt} oavg.`:''}</span></div></div><div class="stat-cols"><section>`;
  // mot motståndare
  const opp={}; duels.forEach(x=>{ x.opps.forEach(o=>{ const k=oppLabel(o); const e=opp[k]||(opp[k]={n:0,w:0,l:0,t:0,best:0}); e.n++; x.me.s>o.s?e.w++:x.me.s<o.s?e.l++:e.t++; e.best=Math.max(e.best,x.me.s); }); });
  const ok=Object.keys(opp).sort((a,b)=>opp[b].n-opp[a].n);
  if(ok.length){
    h+=`</section><section><h2 class="sec">Mot motståndare</h2><div class="stbl"><div class="tr h"><div>Motståndare</div><div class="r">V – F${Object.values(opp).some(e=>e.t)?' – O':''}</div><div class="r">Bäst</div></div>`;
    ok.forEach(k=>{ const e=opp[k]; h+=`<div class="tr"><div class="l">${esc(k)} <span class="m">· ${e.n} st</span></div><div class="r wl"><span class="w">${e.w}</span> – <span class="f">${e.l}</span>${Object.values(opp).some(x=>x.t)?` – <span class="o">${e.t}</span>`:''}</div><div class="r">${e.best}</div></div>`; });
    h+='</div>';
  }
  // per speltyp
  const tp={}; mine.forEach(x=>{ const k=x.g.type+'|'+x.g.order; const e=tp[k]||(tp[k]={n:0,best:0,sum:0,d:0}); e.n++; e.sum+=x.me.s; if(x.me.s>e.best){ e.best=x.me.s; e.d=x.g.d; } });
  h+=`</section><section><h2 class="sec">Högsta poäng per typ av spel</h2><div class="stbl"><div class="tr h"><div>Speltyp</div><div class="r">Snitt</div><div class="r">Max</div></div>`;
  Object.keys(tp).sort().forEach(k=>{ const [t,o]=k.split('|'), e=tp[k]; h+=`<div class="tr"><div class="l">${typeLabel(t,o)} <span class="m">· ${e.n} st</span></div><div class="r m">${Math.round(e.sum/e.n)}</div><div class="r">${e.best}</div></div>`; });
  h+='</div>';
  // per rad
  let yz=0; const rb={}; mine.forEach(x=>{ CATS.forEach(([c])=>{ const v=x.me.rows[c]; if(typeof v==='number' && v>(rb[c]||0)) rb[c]=v; }); if(x.me.rows.yatzy===50) yz++; });
  const bon=mine.filter(x=>x.me.bonus).length;
  h+=`</section><section><h2 class="sec">Högsta poäng per rad</h2><div class="stbl"><div class="tr h"><div>Rad</div><div class="r">Max möjligt</div><div class="r">Ditt bästa</div></div>`;
  CATS.forEach(([c,n])=>{ const v=rb[c]||0; h+=`<div class="tr"><div class="l">${n}${v===MAXROW[c]?' 🌟':''}</div><div class="r m">${MAXROW[c]}</div><div class="r">${v||'–'}</div></div>`; });
  h+=`<div class="tr"><div class="l">Antal Yatzy 🐬</div><div class="r m"></div><div class="r">${yz}</div></div>
      <div class="tr"><div class="l">Antal bonusar ⭐</div><div class="r m"></div><div class="r">${bon}</div></div></div>`;
  // senaste
  h+=`</section><section><h2 class="sec">Senaste matcherna</h2><div class="stbl">`;
  mine.slice(-12).reverse().forEach(x=>{
    const r=resultOf(x.me,x.opps), em=r==='W'?'🏆':r==='L'?'💧':r==='T'?'🤝':'🐬';
    const dt=new Date(x.g.d), ds=dt.toLocaleDateString('sv-SE',{day:'numeric',month:'short'});
    const place = x.opps.length ? 1+x.opps.filter(o=>o.s>x.me.s).length : 0;
    h+=`<div class="tr"><div class="l">${em} ${x.opps.length?'mot '+esc(x.opps.map(oppLabel).join(', ')):'Ensam'} <span class="m">· ${ds}${x.opps.length>1?' · plats '+place:''}</span></div><div class="r m">${x.opps.length?Math.max(...x.opps.map(o=>o.s)):''}</div><div class="r">${x.me.s}</div></div>`;
  });
  h+=`</div></section>${typeof otherStatsHTML==='function'?otherStatsHTML():''}</div><button class="bigbtn alt" data-act="resetstats" style="margin-top:22px;font-size:15px">${armedReset?'Tryck igen för att radera all statistik':'🗑️ Rensa statistik'}</button></div>`;
  return h;
}
function openStats(){ closeModal(); clearTimeout(aiTimer); if(mode!=='online'){ stopNet(); } view='stats'; render(); try{ window.scrollTo(0,0) }catch(e){} }

/* ================= Poppa bubblor i lobbyn ================= */
let bubT=null, popCount=+(lsGet('ry_pops')||0);
const BL = () => document.getElementById('bubbles');
function startBubbles(){
  if(bubT) return;
  bubT=setInterval(spawnBubble, 850);
  for(let i=0;i<6;i++) setTimeout(spawnBubble, i*250);
}
function stopBubbles(){ clearInterval(bubT); bubT=null; const l=BL(); if(l) l.innerHTML=''; }
function spawnBubble(){
  const L=BL(); if(!L || document.hidden || L.children.length>16) return;
  const r=Math.random(), kind = r<1/30 ? 'heart' : r<.08 ? 'gold' : r<.13 ? 'pink' : '';   // hjärtbubbla: i snitt var 30:e
  const b=document.createElement('div'), sz = kind==='heart' ? 76 : 30+Math.random()*46;
  b.className='pbub '+kind; b.style.width=b.style.height=sz+'px';
  b.style.left=(Math.random()*92)+'%';
  const dur=7+Math.random()*7; b.style.animationDuration=dur+'s';
  b.style.setProperty('--sway',(Math.random()*70-35)+'px');
  if(kind==='gold') b.innerHTML='<i>⭐</i>'; else if(kind==='pink') b.innerHTML='<i>🐬</i>';
  else if(kind==='heart'){ const id='hg'+Math.random().toString(36).slice(2,8);   // rött, genomskinligt hjärta – lika bubbligt som de andra
    b.innerHTML=`<svg viewBox="0 0 100 90" aria-hidden="true"><defs>
      <radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffd1da" stop-opacity=".75"/><stop offset=".3" stop-color="#ff4d6d" stop-opacity=".38"/><stop offset=".85" stop-color="#e11d48" stop-opacity=".26"/><stop offset="1" stop-color="#be123c" stop-opacity=".4"/></radialGradient></defs>
      <path d="M50 86 C47 83 6 56 6 29 C6 14 17 5 30 5 C39 5 46 10 50 17 C54 10 61 5 70 5 C83 5 94 14 94 29 C94 56 53 83 50 86 Z" fill="url(#${id})" stroke="#ff5c7a" stroke-opacity=".9" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M22 18 C27 13 35 13 39 18" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="4" stroke-linecap="round"/>
      <circle cx="73" cy="22" r="3.2" fill="#fff" opacity=".5"/></svg>`; }
  b.addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation(); popBubble(b,kind,sz); });
  L.appendChild(b); setTimeout(()=>b.remove(), dur*1000+200);
}
function popBubble(b,kind,sz){
  unlockAudio();
  const rc=b.getBoundingClientRect(), cx=rc.left+rc.width/2, cy=rc.top+rc.height/2;
  b.remove();
  const party=document.getElementById('party');
  const ring=document.createElement('div'); ring.className='popring'; ring.style.left=cx+'px'; ring.style.top=cy+'px'; ring.style.width=ring.style.height=sz+'px';
  party.appendChild(ring); setTimeout(()=>ring.remove(),450);
  for(let i=0;i<8;i++){
    const d=document.createElement('div'); d.className='drop'; const a=i/8*Math.PI*2+Math.random()*.4, rr=sz*.6+Math.random()*24;
    d.style.left=cx+'px'; d.style.top=cy+'px'; d.style.setProperty('--dx',Math.cos(a)*rr+'px'); d.style.setProperty('--dy',Math.sin(a)*rr+'px');
    party.appendChild(d); setTimeout(()=>d.remove(),550);
  }
  const f=900+(76-sz)*22+Math.random()*120;
  tone(f,.07,'sine',.16,0,f*1.8); tone(f*2.2,.05,'triangle',.05,.02);
  buzz(8);
  if(kind==='heart') heartRain(cx,cy);
  const pts = kind==='heart' ? 100 : kind==='gold' ? 10 : kind==='pink' ? 5 : 1;
  popCount+=pts; lsSet('ry_pops',String(popCount));
  if(kind==='heart'){ toast('Hjärtbubbla! +100 ❤️',2400); [784,988,1175,1568].forEach((f2,i)=>tone(f2,.22,'sine',.09,.05+i*.08)); buzz([15,40,15]); }
  else if(kind==='gold'){ toast('Guldbubbla! +10 ⭐'); sparkles(10); }
  else if(kind==='pink') toast('Delfinbubbla! +5 🐬');
  if(pts===1 && popCount%100===0){ toast(`${popCount} poppade bubblor! 🫧🎉`); sparkles(16); }
  const c=document.getElementById('popc'); if(c){ c.textContent='🫧 '+popCount; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
}

// stänkregn av små hjärtan
function heartRain(cx,cy){
  const party=document.getElementById('party'); if(!party) return;
  for(let i=0;i<34;i++){
    const h=document.createElement('div'); h.className='hrain'; h.textContent=['❤️','💗','💖','❤️','💕'][i%5];
    const a=Math.random()*Math.PI*2, v=60+Math.random()*190;
    h.style.left=cx+'px'; h.style.top=cy+'px'; h.style.fontSize=(10+Math.random()*14)+'px';
    h.style.setProperty('--dx',Math.cos(a)*v+'px'); h.style.setProperty('--dy',Math.sin(a)*v-40+'px'); h.style.setProperty('--fall',(120+Math.random()*160)+'px');
    h.style.setProperty('--rot',(Math.random()*120-60)+'deg'); h.style.animationDuration=(1+Math.random()*.7)+'s';
    party.appendChild(h); setTimeout(()=>h.remove(),1800);
  }
}

/* ================= Spotify i utfällbar sidopanel ================= */
let spOpen=false, spCtrl=null, spApiState='none', spPlaying=false, spLoadedUri=null;
let spDuck = lsGet('ry_spduck')!=='0';
function spGet(){ try{ return JSON.parse(lsGet('ry_sp'))||{uri:null,recent:[]} }catch(e){ return {uri:null,recent:[]} } }
function spSave(o){ lsSet('ry_sp', JSON.stringify(o)); }
function spParse(txt){
  txt=(txt||'').trim();
  let m=txt.match(/^spotify:(playlist|album|track|artist|episode|show):([A-Za-z0-9]{10,40})$/);
  if(m) return {type:m[1], id:m[2]};
  m=txt.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(playlist|album|track|artist|episode|show)\/([A-Za-z0-9]{10,40})/);
  if(m) return {type:m[1], id:m[2]};
  return null;
}
const spUri = p => `spotify:${p.type}:${p.id}`;
const SP_TYPE = {playlist:'Spellista',album:'Album',track:'Låt',artist:'Artist',episode:'Avsnitt',show:'Podd'};
function spPanelHTML(){
  const st=spGet();
  const head=`<div class="sp-head"><b>🎵 Musik från Spotify</b><button class="iconbtn" data-act="spclose" aria-label="Stäng">›</button></div>`;
  if(spAuth()) return head + spLoggedHTML() + `<div class="sp-duck"><span>Pausa spelets egen musik när Spotify spelar</span><div class="seg"><button data-act="spduck" data-v="1" class="${spDuck?'sel':''}">På</button><button data-act="spduck" data-v="0" class="${spDuck?'':'sel'}">Av</button></div></div><div class="sp-duck"><span>Ljudeffekter (tärningar m.m.) när Spotify spelar</span><div class="seg"><button data-act="spsfx" data-v="1" class="${spSfx?'sel':''}">På</button><button data-act="spsfx" data-v="0" class="${spSfx?'':'sel'}">Av</button></div></div>`;
  return head + `<button class="sp-login" data-act="splogin">Logga in med Spotify</button>
    <div class="setnote" style="margin:6px 2px 14px">Med Premium får du hela låtar och dina egna spellistor direkt här. Logga gärna in från lobbyn – du lämnar spelet en kort stund.</div>
    <div class="setnote" style="margin:0 2px 8px"><b>Eller</b> klistra in en länk (ger ofta bara smakprov):</div>
    <div class="sp-row">
<input id="splink" placeholder="Klistra in Spotify-länk…" autocomplete="off" spellcheck="false"><button class="sp-go" data-act="spplay">Spela</button></div>
    <div class="setnote" style="margin:4px 2px 10px">I Spotify: tryck <b>⋯ → Dela → Kopiera länk</b> på en spellista, ett album eller en låt.</div>
    <div id="spWrap" class="sp-wrap">${st.uri?'':'<div class="sp-empty">🐬 Ingen musik vald än</div>'}<div id="spPlayer"></div></div>
    ${st.recent.length?`<div class="setnote" style="margin:12px 2px 6px">Senast spelade</div><div class="sp-recent">${st.recent.map((r,i)=>`<button data-act="sprecent" data-i="${i}" class="${r.uri===st.uri?'sel':''}">${SP_TYPE[r.type]||'Spotify'} · <span>${esc(r.id.slice(0,6))}…</span></button>`).join('')}</div>`:''}
    <div class="sp-duck"><span>Pausa spelets egen musik när Spotify spelar</span><div class="seg"><button data-act="spduck" data-v="1" class="${spDuck?'sel':''}">På</button><button data-act="spduck" data-v="0" class="${spDuck?'':'sel'}">Av</button></div></div>
    <div class="sp-duck"><span>Ljudeffekter (tärningar m.m.) när Spotify spelar</span><div class="seg"><button data-act="spsfx" data-v="1" class="${spSfx?'sel':''}">På</button><button data-act="spsfx" data-v="0" class="${spSfx?'':'sel'}">Av</button></div></div>
    <div class="setnote" style="margin-top:8px">Musiken fortsätter när panelen är infälld. Hela låtar spelas om du är inloggad på Spotify i webbläsaren – annars korta smakprov.</div>`;
}
function spBuild(){
  if(document.getElementById('spPanel')) return;
  const tab=document.createElement('button'); tab.id='spTab'; tab.className='sp-tab'; tab.setAttribute('data-act','sptoggle'); tab.setAttribute('aria-label','Musik'); tab.innerHTML='🎵';
  const p=document.createElement('div'); p.id='spPanel'; p.className='sp-panel'; p.innerHTML=spPanelHTML();
  document.body.append(tab,p);
}
function spRefreshChrome(){
  // uppdatera allt utom själva spelaren (så att musiken inte avbryts)
  const p=document.getElementById('spPanel'); if(!p) return;
  const keep=document.getElementById('spWrap');
  const tmp=document.createElement('div'); tmp.innerHTML=spPanelHTML();
  const newWrap=tmp.querySelector('#spWrap'); if(newWrap && keep) newWrap.replaceWith(keep);
  const val=(document.getElementById('splink')||{}).value||'';
  p.innerHTML=''; while(tmp.firstChild) p.appendChild(tmp.firstChild);
  const e=keep && keep.querySelector('.sp-empty'); if(e && spLoadedUri) e.remove();
  const inp=document.getElementById('splink'); if(inp) inp.value=val;
}
const chatUnread = () => (typeof CHAT!=='undefined' && CHAT.unread) ? CHAT.unread() : 0;
function spToggle(force){
  spBuild(); spOpen = force===undefined ? !spOpen : force;
  if(spOpen && typeof CHAT!=='undefined' && CHAT.isOpen && CHAT.isOpen()) CHAT.close();
  document.getElementById('spPanel').classList.toggle('open',spOpen);
  document.getElementById('spTab').classList.toggle('open',spOpen);
  document.body.classList.toggle('sp-wide',spOpen);
  if(spOpen){ if(spAuth()){ spInit(); } else { spLoadApi(); const st=spGet(); if(st.uri && !spLoadedUri) spLoad(st.uri,false); } }
}
function spLoadApi(){
  if(spApiState!=='none') return;
  spApiState='loading';
  window.onSpotifyIframeApiReady = api => { window.__spApi=api; spApiState='ready'; if(window.__spPending){ const u=window.__spPending; window.__spPending=null; spLoad(u.uri,u.play); } };
  const s=document.createElement('script'); s.src='https://open.spotify.com/embed/iframe-api/v1'; s.async=true;
  s.onerror=()=>{ spApiState='failed'; };
  document.head.appendChild(s);
  setTimeout(()=>{ if(spApiState==='loading'){ spApiState='failed'; if(window.__spPending){ const u=window.__spPending; window.__spPending=null; spLoad(u.uri,u.play); } } },7000);
}
function spLoad(uri, play){
  const wrap=document.getElementById('spWrap'); if(!wrap) return;
  const empty=wrap.querySelector('.sp-empty'); if(empty) empty.remove();
  if(spApiState==='loading' || spApiState==='none'){ window.__spPending={uri,play}; spLoadApi(); return; }
  spLoadedUri=uri;
  if(spApiState==='ready' && window.__spApi){
    if(spCtrl){ spCtrl.loadUri(uri); if(play) setTimeout(()=>{ try{ spCtrl.play() }catch(e){} },600); return; }
    let el=document.getElementById('spPlayer'); if(!el){ el=document.createElement('div'); el.id='spPlayer'; wrap.appendChild(el); }
    window.__spApi.createController(el,{uri, width:'100%', height:352},c=>{
      spCtrl=c;
      c.addListener('playback_update',e=>{ const paused=!e.data || e.data.isPaused; spOnPlayback(!paused); });
      if(play) c.addListener('ready',()=>{ try{ c.play() }catch(e){} });
    });
  } else {
    // reserv: vanlig inbäddad spelare utan styrning
    const [,type,id]=uri.split(':');
    wrap.innerHTML=`<iframe src="https://open.spotify.com/embed/${type}/${id}" width="100%" height="352" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style="border-radius:14px"></iframe>`;
    if(spDuck && MUS){ stopMusic(); }
  }
}
function spOnPlayback(playing){
  if(playing===spPlaying) return; spPlaying=playing;
  document.getElementById('spTab')?.classList.toggle('playing',playing);
  if(!spDuck) return;
  if(playing) stopMusic(); else if(musicOn) setTimeout(()=>{ if(!spPlaying) startMusic(); },1500);
}
function spPlayFromInput(){
  const p=spParse(val('splink'));
  if(!p){ toast('Det ser inte ut som en Spotify-länk. Använd Dela → Kopiera länk i Spotify 🎵',4000); return; }
  unlockAudio();
  const uri=spUri(p), st=spGet();
  st.uri=uri; st.recent=[{uri,type:p.type,id:p.id}, ...st.recent.filter(r=>r.uri!==uri)].slice(0,5); spSave(st);
  document.getElementById('splink').value='';
  spLoad(uri,true); spRefreshChrome();
}

/* ================= Spotify-inloggning (Premium): egna spellistor, hela låtar ================= */
const SP_CLIENT='77ed1b04aa1b451bb2e3c5ec90456bc2';
const SP_REDIRECT=location.origin+location.pathname.replace(/index\.html$/,'');
const SP_SCOPES='streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative';
let spUser=null, spLists=null, spListsErr=null, sdkPlayer=null, sdkDevice=null, sdkState='none', spMode=lsGet('ry_spmode')||'here', spNow=null, spPollT=null, spTokP=null;
const spAuth = () => { try{ const a=JSON.parse(lsGet('ry_spauth')); return a&&a.access?a:null }catch(e){ return null } };
function spRand(n){ const a=new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a,x=>'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[x%62]).join(''); }
function b64url(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
async function spLogin(){
  if(!window.crypto || !crypto.subtle){ toast('Inloggning kräver att spelet öppnas via https-adressen 🔒',4000); return; }
  const verifier=spRand(64), state=spRand(16);
  const challenge=b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  lsSet('ry_sp_pkce', JSON.stringify({verifier,state}));
  const p=new URLSearchParams({client_id:SP_CLIENT, response_type:'code', redirect_uri:SP_REDIRECT, code_challenge_method:'S256', code_challenge:challenge, state, scope:SP_SCOPES});
  location.href='https://accounts.spotify.com/authorize?'+p.toString();
}
async function spTokenReq(params){
  const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok || !j.access_token) throw new Error(j.error_description||j.error||('token '+r.status));
  const old=spAuth()||{};
  const a={access:j.access_token, refresh:j.refresh_token||old.refresh, exp:Date.now()+(j.expires_in||3600)*1000};
  lsSet('ry_spauth', JSON.stringify(a)); return a;
}
async function spHandleRedirect(){
  const q=new URLSearchParams(location.search);
  if(!q.has('code') && !q.has('error')) return;
  const clean=()=>{ try{ history.replaceState(null,'',SP_REDIRECT+location.hash) }catch(e){} };
  if(q.get('error')){ clean(); toast('Spotify-inloggningen avbröts',3000); return; }
  let pk=null; try{ pk=JSON.parse(lsGet('ry_sp_pkce')) }catch(e){}
  if(!pk || pk.state!==q.get('state')){ clean(); toast('Inloggningen kunde inte verifieras – försök igen',3500); return; }
  try{
    await spTokenReq({grant_type:'authorization_code', code:q.get('code'), redirect_uri:SP_REDIRECT, client_id:SP_CLIENT, code_verifier:pk.verifier});
    lsSet('ry_sp_pkce',''); clean(); toast('Inloggad på Spotify! 🎵',3000);
    setTimeout(()=>{ spToggle(true); },400);
  }catch(e){ clean(); toast('Spotify-inloggningen misslyckades: '+e.message,5000); }
}
async function spToken(){
  const a=spAuth(); if(!a) throw new Error('utloggad');
  if(Date.now() < a.exp-60000) return a.access;
  if(!spTokP) spTokP=spTokenReq({grant_type:'refresh_token', refresh_token:a.refresh, client_id:SP_CLIENT}).finally(()=>{ spTokP=null; });
  try{ return (await spTokP).access; }catch(e){ spLogout(true); throw e; }
}
async function spApi(path, opt={}, retry=true){
  const tok=await spToken();
  const r=await fetch('https://api.spotify.com/v1'+path,{...opt, headers:{'Authorization':'Bearer '+tok,'Content-Type':'application/json',...(opt.headers||{})}});
  if(r.status===401 && retry){ const a=spAuth(); if(a){ a.exp=0; lsSet('ry_spauth',JSON.stringify(a)); } return spApi(path,opt,false); }
  if(r.status===204 || r.status===202) return null;
  const txt=await r.text(); let j=null; try{ j=txt?JSON.parse(txt):null }catch(e){}
  if(!r.ok){ const err=new Error((j&&j.error&&(j.error.message||j.error))||('HTTP '+r.status)); err.status=r.status; err.reason=j&&j.error&&j.error.reason; throw err; }
  return j;
}
function spLogout(silent){
  lsSet('ry_spauth',''); spUser=null; spLists=null; spNow=null;
  try{ sdkPlayer && sdkPlayer.disconnect() }catch(e){} sdkPlayer=null; sdkDevice=null; sdkState='none';
  clearInterval(spPollT); spOnPlayback(false);
  if(!silent) toast('Utloggad från Spotify'); spRefreshChrome();
}
async function spInit(){
  if(!spAuth()) return;
  try{
    if(!spUser) spUser=await spApi('/me');
    if(!spLists){ const j=await spApi('/me/playlists?limit=50'); spLists=(j&&j.items||[]).filter(Boolean); }
    spListsErr=null;
  }catch(e){ spListsErr=e.status===403 ? 'Kontot är inte godkänt i Spotify-appens User Management.' : 'Kunde inte hämta dina spellistor ('+e.message+')'; }
  spRefreshChrome(); spLoadSdk(); spPoll();
}
function spLoadSdk(){
  if(sdkState!=='none' || spMode!=='here') return;
  sdkState='loading';
  window.onSpotifyWebPlaybackSDKReady=()=>{
    try{
      sdkPlayer=new Spotify.Player({name:'Stjärndelfin Yatzy 🐬', getOAuthToken:cb=>{ spToken().then(cb).catch(()=>{}); }, volume:+(lsGet('ry_spvol')||0.7)});
      sdkPlayer.addListener('ready',({device_id})=>{ sdkDevice=device_id; sdkState='ready'; spRefreshChrome(); });
      sdkPlayer.addListener('not_ready',()=>{ sdkDevice=null; });
      sdkPlayer.addListener('initialization_error',()=>{ sdkState='failed'; spMode='app'; spRefreshChrome(); });
      sdkPlayer.addListener('authentication_error',()=>{ sdkState='failed'; });
      sdkPlayer.addListener('account_error',()=>{ sdkState='failed'; spMode='app'; toast('Uppspelning i spelet kräver Spotify Premium – vi styr Spotify-appen i stället',4500); spRefreshChrome(); });
      sdkPlayer.addListener('player_state_changed',st=>{
        if(!st){ return; }
        const t=st.track_window && st.track_window.current_track;
        spNow={name:t&&t.name, artist:t&&t.artists.map(a=>a.name).join(', '), img:t&&t.album&&t.album.images&&t.album.images[0]&&t.album.images[0].url, paused:st.paused, here:true, shuffle:st.shuffle};
        spOnPlayback(!st.paused); spRenderNow();
      });
      sdkPlayer.connect().then(ok=>{ if(!ok){ sdkState='failed'; spMode='app'; spRefreshChrome(); } });
    }catch(e){ sdkState='failed'; spMode='app'; spRefreshChrome(); }
  };
  const s=document.createElement('script'); s.src='https://sdk.scdn.co/spotify-player.js'; s.async=true;
  s.onerror=()=>{ sdkState='failed'; spMode='app'; spRefreshChrome(); };
  document.head.appendChild(s);
  setTimeout(()=>{ if(sdkState==='loading'){ sdkState='failed'; spMode='app'; spRefreshChrome(); } },15000);
}
async function spAppDevice(){
  const j=await spApi('/me/player/devices');
  const ds=(j&&j.devices||[]).filter(d=>d.id && d.id!==sdkDevice && !d.is_restricted);
  return ds.find(d=>d.is_active) || ds.find(d=>d.type==='Smartphone') || ds[0] || null;
}
async function spTarget(){
  if(spMode==='here' && sdkDevice) return {id:sdkDevice, here:true};
  const d=await spAppDevice(); return d ? {id:d.id, here:false, name:d.name} : null;
}
async function spPlayCtx(uri){
  unlockAudio();
  if(sdkPlayer){ try{ sdkPlayer.activateElement() }catch(e){} }
  try{
    const t=await spTarget();
    if(!t){ toast(spMode==='here' ? 'Spelaren startar fortfarande – vänta några sekunder och försök igen ⏳' : 'Öppna Spotify-appen en gång så att den syns, och försök igen 📱',4500); return; }
    await spApi(`/me/player/play?device_id=${t.id}`,{method:'PUT', body:JSON.stringify({context_uri:uri})});
    if(!t.here) toast(`Spelar i ${t.name} 🎵`);
    setTimeout(spPoll,1200);
  }catch(e){ spErr(e); }
}
async function spCtl(action){
  unlockAudio();
  if(spMode==='here' && sdkPlayer && sdkDevice && spNow && spNow.here){
    try{ if(action==='toggle') await sdkPlayer.togglePlay(); else if(action==='next') await sdkPlayer.nextTrack(); else if(action==='prev') await sdkPlayer.previousTrack(); }catch(e){}
    return;
  }
  try{
    const st=await spApi('/me/player'); const dev=st&&st.device&&st.device.id;
    if(!dev){ toast('Inget spelar just nu – välj en spellista 🎵'); return; }
    if(action==='toggle') await spApi(`/me/player/${st.is_playing?'pause':'play'}?device_id=${dev}`,{method:'PUT'});
    if(action==='next') await spApi(`/me/player/next?device_id=${dev}`,{method:'POST'});
    if(action==='prev') await spApi(`/me/player/previous?device_id=${dev}`,{method:'POST'});
    if(action==='shuffle') await spApi(`/me/player/shuffle?state=${!(st.shuffle_state)}&device_id=${dev}`,{method:'PUT'});
    setTimeout(spPoll,700);
  }catch(e){ spErr(e); }
}
function spErr(e){
  if(e.status===403) toast('Spotify nekade – kontrollera att kontot har Premium 🎵',4000);
  else if(e.status===404) toast('Hittar ingen aktiv spelare – öppna Spotify-appen eller vänta på spelaren ⏳',4500);
  else toast('Spotify: '+e.message,4000);
}
async function spPoll(){
  clearInterval(spPollT);
  if(!spAuth()) return;
  const tick=async()=>{
    if(document.hidden) return;
    if(spNow && spNow.here && sdkDevice) return;   // SDK skickar egna händelser
    try{
      const st=await spApi('/me/player');
      if(st && st.item){ const t=st.item; spNow={name:t.name, artist:(t.artists||[]).map(a=>a.name).join(', '), img:t.album&&t.album.images&&t.album.images[0]&&t.album.images[0].url, paused:!st.is_playing, here:st.device&&st.device.id===sdkDevice, device:st.device&&st.device.name, shuffle:st.shuffle_state}; spOnPlayback(st.is_playing && !(st.device&&st.device.id===sdkDevice) ? true : st.is_playing); }
      else if(spNow && !spNow.here){ spNow=null; spOnPlayback(false); }
      spRenderNow();
    }catch(e){}
  };
  tick(); spPollT=setInterval(tick, 5000);
}
function spNowHTML(){
  if(!spNow || !spNow.name) return `<div class="sp-empty" style="padding:16px 10px">🐬 Välj en spellista nedan</div>`;
  return `<div class="sp-now">${spNow.img?`<img src="${esc(spNow.img)}" alt="">`:'<div class="sp-noimg">🎵</div>'}
      <div class="sp-meta"><b>${esc(spNow.name)}</b><span>${esc(spNow.artist||'')}</span><small>${spNow.here?'Spelar här i spelet':'Spelar i '+esc(spNow.device||'Spotify-appen')}</small></div></div>
    <div class="sp-ctl"><button data-act="spctl" data-a="shuffle" class="${spNow.shuffle?'on':''}" aria-label="Blanda">🔀</button><button data-act="spctl" data-a="prev" aria-label="Föregående">⏮</button><button data-act="spctl" data-a="toggle" class="big" aria-label="Spela/pausa">${spNow.paused?'▶️':'⏸'}</button><button data-act="spctl" data-a="next" aria-label="Nästa">⏭</button></div>
    ${spNow.here?`<input type="range" class="sp-vol" min="0" max="1" step="0.05" value="${esc(lsGet('ry_spvol')||0.7)}" aria-label="Volym">`:''}`;
}
function spRenderNow(){ const el=document.getElementById('spNow'); if(el) el.innerHTML=spNowHTML(); document.getElementById('spTab')?.classList.toggle('playing',spPlaying); }
function spLoggedHTML(){
  const name=spUser ? (spUser.display_name||spUser.id) : '…';
  const prem=spUser && spUser.product && spUser.product!=='premium';
  const modeTxt = sdkState==='failed' ? '' : `<div class="seg" style="margin:10px 0 4px"><button data-act="spmode" data-m="here" class="${spMode==='here'?'sel':''}">📱 Spela i spelet</button><button data-act="spmode" data-m="app" class="${spMode==='app'?'sel':''}">🟢 I Spotify-appen</button></div>`;
  return `<div class="sp-acct"><span>👤 ${esc(name)}</span><button data-act="splogout">Logga ut</button></div>
    ${prem?'<div class="setnote" style="color:#fda4af">Kontot verkar inte ha Premium – då går bara att styra Spotify-appen.</div>':''}
    ${modeTxt}${spMode==='here' && sdkState==='loading'?'<div class="setnote">Startar spelaren…</div>':''}${sdkState==='failed'?'<div class="setnote">Den här webbläsaren kan inte spela Spotify själv – musiken spelas i Spotify-appen och styrs härifrån.</div>':''}
    <div id="spNow" class="sp-nowbox">${spNowHTML()}</div>
    <div class="setnote" style="margin:14px 2px 6px">Dina spellistor</div>
    ${spListsErr?`<div class="setnote" style="color:#fda4af">${esc(spListsErr)}</div>`:''}
    <div class="sp-lists">${spLists ? (spLists.length ? spLists.map((p,i)=>`<button data-act="splist" data-i="${i}">${p.images&&p.images[0]?`<img src="${esc(p.images[p.images.length>1?1:0].url)}" alt="" loading="lazy">`:'<div class="sp-noimg">🎵</div>'}<span>${esc(p.name)}</span></button>`).join('') : '<div class="setnote">Inga spellistor hittades.</div>') : '<div class="setnote">Hämtar…</div>'}</div>`;
}

/* =====================================================================
   PATIENS – klassisk Klondike, spelas ensam och helt offline
   ===================================================================== */
const SUITS=['♠','♥','♦','♣'], RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const cSuit=id=>Math.floor(id/13), cRank=id=>id%13+1, cRed=id=>cSuit(id)===1||cSuit(id)===2;
const VS='︎';   // tvinga text-varianten av ♥ ♦ ♠ ♣ (inte emoji)
const SOL_MODES={'1':{label:'Ta 1',sub:'ett kort i taget'},'3':{label:'Ta 3',sub:'tre kort, det sista överst'},'3r':{label:'Ta 3 omvänd',sub:'tre kort, det första överst'}};
const SOL_THEMES={
  space:{label:'🚀 Rymd', court:['👨‍🚀','👩‍🚀','🪐'], accent:'#a78bfa'},
  ocean:{label:'🐬 Delfin & hav', court:['🐠','🐬','🐳'], accent:'#2dd4bf'},
  cool:{label:'💎 Blått & coolt', court:['🧊','💎','👑'], accent:'#60a5fa'},
  alpine:{label:'⛷️ Alpint race', court:['⛷️','🏂','🏆'], accent:'#f87171'},
  pink:{label:'💖 Rosa', court:['🦄','👸','💖'], accent:'#f472b6'},
  leopard:{label:'🐆 Leopard', court:['🐾','🐆','👑'], accent:'#e3b064'}
};
let S=null, solHist=[], solTheme=lsGet('ry_soltheme')||'ocean', solMode=lsGet('ry_solmode')||'1', solDrag=null, solHintT=null, solAutoT=null, solSaveN=0;
function rint(n){ const c=window.crypto; if(!c||!c.getRandomValues) return Math.floor(Math.random()*n); const lim=Math.floor(4294967296/n)*n, b=new Uint32Array(1); for(;;){ c.getRandomValues(b); if(b[0]<lim) return b[0]%n; } }
function solShuffle(){ const d=[...Array(52).keys()]; for(let i=51;i>0;i--){ const j=rint(i+1); [d[i],d[j]]=[d[j],d[i]]; } return d; }
function solNew(mode){
  const d=solShuffle(), tab=[];
  for(let c=0;c<7;c++){ tab.push([]); for(let k=0;k<=c;k++) tab[c].push({id:d.pop(), up:k===c}); }
  S={mode, stock:d, waste:[], found:[[],[],[],[]], tab, moves:0, time:0, passes:0, won:false, started:false, counted:false};
  solHist=[]; solSave();
}
function solSave(){ if(S) lsSet('ry_sol', JSON.stringify(S)); }
function solLoad(){ try{ const s=JSON.parse(lsGet('ry_sol')); if(s && s.tab && s.tab.length===7) return s; }catch(e){} return null; }
function solStats(){ try{ return JSON.parse(lsGet('ry_solstats'))||{} }catch(e){ return {} } }
function solStatAdd(fn){ const st=solStats(); const m=st[S.mode]||(st[S.mode]={played:0,won:0,bestTime:null,bestMoves:null}); fn(m); lsSet('ry_solstats',JSON.stringify(st)); return m; }
function solSnap(){ solHist.push(JSON.stringify(S)); if(solHist.length>300) solHist.shift(); }
function solStart(){ if(!S.started){ S.started=true; if(!S.counted){ S.counted=true; solStatAdd(m=>m.played++); } } }

/* ---------- regler ---------- */
const topOf = a => a.length ? a[a.length-1] : null;
function canStack(id, col){ const t=topOf(S.tab[col]); if(!t) return cRank(id)===13; return t.up && cRed(id)!==cRed(t.id) && cRank(id)===cRank(t.id)-1; }
function canFound(id, f){ const t=topOf(S.found[f]); if(t===null) return cRank(id)===1; return cSuit(t)===cSuit(id) && cRank(id)===cRank(t)+1; }
function foundFor(id){ for(let f=0;f<4;f++){ const t=topOf(S.found[f]); if(t!==null && cSuit(t)===cSuit(id) && canFound(id,f)) return f; } if(cRank(id)===1) for(let f=0;f<4;f++) if(!S.found[f].length) return f; return -1; }
// plocka upp kort från en källa (utan att ändra) → lista med id
function cardsAt(src){
  if(src.t==='w') return S.waste.length ? [topOf(S.waste)] : [];
  if(src.t==='f') return S.found[src.f].length ? [topOf(S.found[src.f])] : [];
  if(src.t==='t'){ const col=S.tab[src.c]; if(src.i<0||src.i>=col.length||!col[src.i].up) return []; return col.slice(src.i).map(x=>x.id); }
  return [];
}
function legal(src,dst){
  const ids=cardsAt(src); if(!ids.length) return false;
  if(dst.t==='f'){ if(ids.length!==1 || src.t==='f') return false; return canFound(ids[0],dst.f); }
  if(dst.t==='t'){ if(src.t==='t' && src.c===dst.c) return false; return canStack(ids[0],dst.c); }
  return false;
}
function solMove(src,dst,opt={}){
  if(!legal(src,dst)) return false;
  solSnap(); solStart();
  let ids;
  if(src.t==='w') ids=[S.waste.pop()];
  else if(src.t==='f') ids=[S.found[src.f].pop()];
  else ids=S.tab[src.c].splice(src.i).map(x=>x.id);
  if(dst.t==='f') S.found[dst.f].push(ids[0]); else ids.forEach(id=>S.tab[dst.c].push({id,up:true}));
  let flipped=null;
  if(src.t==='t'){ const t=topOf(S.tab[src.c]); if(t && !t.up){ t.up=true; flipped=t.id; } }
  S.moves++; S.idle=0;
  if(!opt.quiet){ dst.t==='f' ? solSnd('found') : solSnd('place'); if(flipped!==null) setTimeout(()=>solSnd('flip'),120); }
  solAfter(opt);
  return true;
}
function solDraw(){
  if(!S || S.won) return;
  if(!S.stock.length && !S.waste.length) return;
  solSnap(); solStart();
  S.idle=(S.idle||0)+1;
  if(!S.stock.length){ S.stock=S.waste.reverse(); S.waste=[]; S.passes++; S.moves++; solSnd('shuffle'); solAfter(); return; }
  const n=S.mode==='1'?1:3, take=S.stock.splice(-n);
  if(S.mode==='3r') S.waste.push(...take); else S.waste.push(...take.reverse());
  S.moves++; solSnd('draw'); solAfter();
}
function solUndo(){
  if(!solHist.length){ toast('Inget att ångra'); return; }
  const t=S.time; S=JSON.parse(solHist.pop()); S.time=t; S.moves++; solSnd('undo'); solAfter({noWin:true});
}
function solAfter(opt={}){
  solSaveN++; solSave();
  solSync();
  if(!opt.noWin && S.found.every(f=>f.length===13) && !S.won){ S.won=true; solSave(); solWin(); }
  solRefreshChrome();
}
function solAllUp(){ return !S.stock.length && !S.waste.length && S.tab.every(c=>c.every(x=>x.up)); }

/* ---------- smarta drag: tryck för att flytta ---------- */
function solAutoTarget(src){
  const ids=cardsAt(src); if(!ids.length) return null;
  if(ids.length===1 && src.t!=='f'){ const f=foundFor(ids[0]); if(f>=0) return {t:'f',f}; }
  const order=[...Array(7).keys()];
  let empty=null;
  for(const c of order){ if(src.t==='t' && src.c===c) continue; if(!canStack(ids[0],c)) continue;
    if(S.tab[c].length) return {t:'t',c}; if(empty===null) empty=c; }
  // kung till tom kolumn – bara om det gör nytta (inte om kungen redan ligger överst i en kolumn)
  if(empty!==null && !(src.t==='t' && src.i===0)) return {t:'t',c:empty};
  return null;
}
function solTap(src){
  if(S.won) return;
  const dst=solAutoTarget(src);
  if(dst) solMove(src,dst); else { solShake(src); solSnd('nope'); }
}

/* ---------- tips ---------- */
function solFindHint(){
  // 1) till grundhög
  if(S.waste.length){ const f=foundFor(topOf(S.waste)); if(f>=0) return {src:{t:'w'},dst:{t:'f',f}}; }
  for(let c=0;c<7;c++){ const col=S.tab[c]; if(!col.length) continue; const f=foundFor(topOf(col).id); if(f>=0) return {src:{t:'t',c,i:col.length-1},dst:{t:'f',f}}; }
  // 2) flytta en hel uppvänd rad som frilägger ett nedvänt kort
  for(let c=0;c<7;c++){ const col=S.tab[c]; const i=col.findIndex(x=>x.up); if(i<=0) continue;
    for(let d=0;d<7;d++){ if(d!==c && S.tab[d].length && canStack(col[i].id,d)) return {src:{t:'t',c,i},dst:{t:'t',c:d}}; }
    for(let d=0;d<7;d++){ if(d!==c && !S.tab[d].length && cRank(col[i].id)===13) return {src:{t:'t',c,i},dst:{t:'t',c:d}}; } }
  // 3) från högen till spelet
  if(S.waste.length){ const id=topOf(S.waste); for(let d=0;d<7;d++){ if(canStack(id,d) && (S.tab[d].length || cRank(id)===13)) return {src:{t:'w'},dst:{t:'t',c:d}}; } }
  // 4) dra nytt kort
  if(S.stock.length || S.waste.length) return {draw:true};
  return null;
}
function solHint(){
  if(!S || S.won) return;
  const h=solFindHint(); clearTimeout(solHintT);
  document.querySelectorAll('.hint').forEach(e=>e.classList.remove('hint'));
  if(!h){ toast('Inga fler drag hittades – prova 🆕 Nytt spel',3500); return; }
  const cycle = Math.ceil((S.stock.length+S.waste.length)/(S.mode==='1'?1:3))+1;
  if(h.draw && (S.idle||0) > cycle){ toast('Du har vänt hela högen utan att något gick att lägga – det verkar inte finnas fler drag. Prova 🔄 Nytt spel',5000); solSnd('nope'); return; }
  if(h.draw){ document.getElementById('slotStock')?.classList.add('hint'); toast(S.stock.length?'Vänd upp ett kort från högen 🃏':'Vänd högen och kör ett varv till 🔄',2600); }
  else {
    cardsAt(h.src).forEach(id=>document.querySelector(`.scard[data-id="${id}"]`)?.classList.add('hint'));
    const dst = h.dst.t==='f' ? document.getElementById('slotF'+h.dst.f) : (S.tab[h.dst.c].length ? document.querySelector(`.scard[data-id="${topOf(S.tab[h.dst.c]).id}"]`) : document.getElementById('slotT'+h.dst.c));
    dst?.classList.add('hint');
  }
  solSnd('hint');
  solHintT=setTimeout(()=>document.querySelectorAll('.hint').forEach(e=>e.classList.remove('hint')),1800);
}

/* ---------- lägg upp automatiskt ---------- */
function solAutoFinish(){
  if(!S || S.won || !solAllUp()) return;
  clearTimeout(solAutoT);
  const step=()=>{
    if(!S || S.won || view!=='sol') return;
    let best=null;
    for(let c=0;c<7;c++){ const col=S.tab[c]; if(!col.length) continue; const id=topOf(col).id, f=foundFor(id); if(f>=0 && (!best || cRank(id)<best.r)) best={src:{t:'t',c,i:col.length-1},dst:{t:'f',f},r:cRank(id)}; }
    if(!best) return;
    solMove(best.src,best.dst,{}); solAutoT=setTimeout(step,110);
  };
  step();
}

/* ---------- vinst ---------- */
function solWin(){
  const m=solStatAdd(m=>{ m.won++; if(m.bestTime===null||S.time<m.bestTime) m.bestTime=S.time; if(m.bestMoves===null||S.moves<m.bestMoves) m.bestMoves=S.moves; });
  const recT = m.bestTime===S.time, recM = m.bestMoves===S.moves;
  setTimeout(()=>{ celebrate('VINST!'); sfx.win(); sparkles(60); solCascade(); },350);
  setTimeout(()=>{
    if(view!=='sol') return;
    openModal(`<div style="text-align:center;font-size:56px;line-height:1">🏆</div>
      <h3 style="text-align:center;margin:6px 0 2px">Patiensen gick ut!</h3>
      <p style="text-align:center">${SOL_MODES[S.mode].label}</p>
      <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin:12px 0">
        <div class="kpi"><b>${fmtTime(S.time)}</b><span>tid${recT?' · rekord!':''}</span></div>
        <div class="kpi"><b>${S.moves}</b><span>drag${recM?' · rekord!':''}</span></div>
        <div class="kpi"><b>${m.won}/${m.played}</b><span>vunna</span></div></div>
      <div class="btns"><button data-act="lobby">🏠 Lobby</button><button class="pri" data-act="solnewsame">🃏 Ny patiens</button></div>`);
  },2600);
}
function solCascade(){
  const els=[...document.querySelectorAll('.scard')];
  els.forEach((el,i)=>{ setTimeout(()=>{ el.classList.add('cascade'); el.style.setProperty('--cx',(Math.random()*240-120)+'px'); el.style.setProperty('--cr',(Math.random()*90-45)+'deg'); },i*22); });
}
const fmtTime = t => `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;

/* ---------- ljud ---------- */
function solSnd(k){
  if(k==='place'){ hit(0,1800,.35,.03); tone(240,.05,'triangle',.05); }
  else if(k==='found'){ hit(0,2200,.3,.03); tone(880,.12,'sine',.08,.02,1320); }
  else if(k==='flip'){ hit(0,3000,.22,.025); }
  else if(k==='draw'){ hit(0,2600,.25,.03); hit(.05,2200,.2,.03); }
  else if(k==='shuffle'){ for(let i=0;i<8;i++) hit(i*.03,1500+Math.random()*1500,.25,.025); }
  else if(k==='undo'){ tone(500,.1,'sine',.07,0,350); }
  else if(k==='nope'){ tone(180,.12,'triangle',.07); }
  else if(k==='hint'){ tone(1046,.12,'sine',.06); tone(1318,.16,'sine',.05,.1); }
}

/* ---------- utseende: kortbaksidor ---------- */
const BACK_CACHE={};
function backSVG(theme){
  if(BACK_CACHE[theme]) return BACK_CACHE[theme];
  let inner='';
  const frame=c=>`<rect x="5" y="5" width="90" height="130" rx="9" fill="none" stroke="${c}" stroke-width="2" opacity=".85"/><rect x="9" y="9" width="82" height="122" rx="6" fill="none" stroke="${c}" stroke-width=".8" opacity=".5"/>`;
  if(theme==='space'){
    let st=''; for(let i=0;i<34;i++){ const x=(i*37%86)+7, y=(i*53%126)+7, r=(i%5===0)?1.3:.6; st+=`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${.4+(i%3)*.2}"/>`; }
    inner=`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b1d8f"/><stop offset=".55" stop-color="#14205e"/><stop offset="1" stop-color="#050b2b"/></linearGradient><radialGradient id="p" cx="35%" cy="30%"><stop offset="0" stop-color="#d5f8ff"/><stop offset=".45" stop-color="#5cc4ff"/><stop offset="1" stop-color="#3a3fbf"/></radialGradient></defs>
      <rect width="100" height="140" rx="10" fill="url(#g)"/>${st}<circle cx="50" cy="70" r="17" fill="url(#p)"/><ellipse cx="50" cy="71" rx="31" ry="7" fill="none" stroke="#ffd36e" stroke-width="2.2" transform="rotate(-18 50 71)"/>
      <path d="M22 112 l3 -7 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3z" fill="#f9a8d4" opacity=".85"/><path d="M76 26 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2z" fill="#7df9ff" opacity=".9"/>${frame('#a78bfa')}`;
  } else if(theme==='ocean'){
    inner=`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#0e7490"/><stop offset="1" stop-color="#0b2a5c"/></linearGradient><linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0fbff"/><stop offset="1" stop-color="#7dd3fc"/></linearGradient></defs>
      <rect width="100" height="140" rx="10" fill="url(#g)"/>
      <path d="M0 96 Q12 90 25 96 T50 96 T75 96 T100 96 V140 H0Z" fill="#0b3d6e" opacity=".55"/><path d="M0 112 Q12 106 25 112 T50 112 T75 112 T100 112 V140 H0Z" fill="#082a55" opacity=".7"/>
      <g transform="translate(14 46) scale(.38)" fill="url(#d)"><path d="M40 60 C70 40 110 30 150 38 C165 41 172 46 178 50 L195 54 C196 57 190 59 178 58 C165 65 140 71 110 71 C85 71 60 67 40 64 Z"/><path d="M95 38 C100 22 108 14 120 9 C115 19 114 28 121 35 Z"/><path d="M128 66 C124 78 116 86 104 91 C109 81 111 73 113 68 Z"/><path d="M44 60 C30 52 18 41 5 36 C13 46 19 55 23 61 C17 67 11 77 7 88 C21 79 33 69 46 64 Z"/></g>
      <g fill="none" stroke="#e0fbff" opacity=".7"><circle cx="78" cy="30" r="4"/><circle cx="70" cy="20" r="2.4"/><circle cx="84" cy="16" r="1.6"/><circle cx="22" cy="24" r="3"/></g>${frame('#e0fbff')}`;
  } else if(theme==='cool'){
    let lat=''; for(let i=-140;i<240;i+=14){ lat+=`<line x1="${i}" y1="0" x2="${i+140}" y2="140"/><line x1="${i+140}" y1="0" x2="${i}" y2="140"/>`; }
    inner=`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset=".5" stop-color="#1d4ed8"/><stop offset="1" stop-color="#1e1b4b"/></linearGradient><clipPath id="k"><rect width="100" height="140" rx="10"/></clipPath></defs>
      <rect width="100" height="140" rx="10" fill="url(#g)"/><g clip-path="url(#k)" stroke="#fff" stroke-width=".7" opacity=".22">${lat}</g>
      <g transform="translate(50 70)"><rect x="-17" y="-17" width="34" height="34" transform="rotate(45)" fill="#0b1e4a" opacity=".55" stroke="#bfdbfe" stroke-width="1.6"/>
      <g stroke="#e0f2fe" stroke-width="2.2" stroke-linecap="round"><line x1="0" y1="-12" x2="0" y2="12"/><line x1="-10.4" y1="-6" x2="10.4" y2="6"/><line x1="-10.4" y1="6" x2="10.4" y2="-6"/></g><circle r="2.4" fill="#fff"/></g>${frame('#bfdbfe')}`;
  } else if(theme==='pink'){
    let hearts=''; [[20,22,1],[78,30,.8],[30,112,.9],[80,108,1.1],[50,70,2.2],[16,74,.7],[86,72,.7]].forEach(([x,y,k])=>{ hearts+=`<path transform="translate(${x} ${y}) scale(${k})" d="M0 4 C-6 -3 -12 2 -6 8 L0 13 L6 8 C12 2 6 -3 0 4Z" fill="#fff" opacity="${k>2?.95:.55}"/>`; });
    inner=`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbcfe8"/><stop offset=".45" stop-color="#f472b6"/><stop offset="1" stop-color="#be185d"/></linearGradient></defs>
      <rect width="100" height="140" rx="10" fill="url(#g)"/>${hearts}
      <g fill="#fff"><path d="M50 20 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z"/><path d="M22 46 l1.4 3.4 l3.4 1.4 l-3.4 1.4 l-1.4 3.4 l-1.4 -3.4 l-3.4 -1.4 l3.4 -1.4z" opacity=".8"/><path d="M78 92 l1.4 3.4 l3.4 1.4 l-3.4 1.4 l-1.4 3.4 l-1.4 -3.4 l-3.4 -1.4 l3.4 -1.4z" opacity=".8"/></g>${frame('#fff')}`;
  } else if(theme==='leopard'){
    let ros=''; const P=[[18,18],[56,12],[84,34],[34,44],[70,62],[16,78],[50,92],[84,104],[26,120],[64,128],[42,68]];
    P.forEach(([x,y],k)=>{ const rot=(k*47)%360; ros+=`<g transform="translate(${x} ${y}) rotate(${rot})"><ellipse rx="6.5" ry="5.2" fill="#c4873a"/>`+[0,72,144,216,288].map(a=>`<ellipse cx="${(7.2*Math.cos(a*Math.PI/180)).toFixed(1)}" cy="${(5.8*Math.sin(a*Math.PI/180)).toFixed(1)}" rx="2.6" ry="1.5" transform="rotate(${a+90} ${(7.2*Math.cos(a*Math.PI/180)).toFixed(1)} ${(5.8*Math.sin(a*Math.PI/180)).toFixed(1)})" fill="#3a2312"/>`).join('')+`</g>`; });
    [[40,28],[90,80],[8,100],[60,40],[30,94]].forEach(([x,y])=>{ ros+=`<circle cx="${x}" cy="${y}" r="2.2" fill="#3a2312"/>`; });
    inner=`<defs><clipPath id="k"><rect width="100" height="140" rx="10"/></clipPath></defs><rect width="100" height="140" rx="10" fill="#e3b064"/><g clip-path="url(#k)">${ros}</g>
      <rect x="5" y="5" width="90" height="130" rx="9" fill="none" stroke="#f9a8d4" stroke-width="2.4"/><rect x="9" y="9" width="82" height="122" rx="6" fill="none" stroke="#3a2312" stroke-width=".8" opacity=".5"/>`;
  } else {  // alpint race
    let gates=''; [[28,72,'#ef4444'],[60,84,'#2563eb'],[36,100,'#ef4444'],[66,114,'#2563eb']].forEach(([x,y,c])=>{ gates+=`<line x1="${x}" y1="${y}" x2="${x}" y2="${y-11}" stroke="${c}" stroke-width="1.6"/><path d="M${x} ${y-11} l7 2.5 l-7 2.5z" fill="${c}"/>`; });
    let chk=''; for(let i=0;i<10;i++) chk+=`<rect x="${i*10}" y="0" width="5" height="5" fill="#0f172a"/><rect x="${i*10+5}" y="5" width="5" height="5" fill="#0f172a"/>`;
    inner=`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset=".45" stop-color="#60a5fa"/><stop offset="1" stop-color="#e0f2fe"/></linearGradient><clipPath id="k"><rect width="100" height="140" rx="10"/></clipPath></defs>
      <rect width="100" height="140" rx="10" fill="url(#g)"/>
      <g clip-path="url(#k)"><path d="M-5 70 L22 34 L36 52 L55 22 L80 56 L92 44 L110 70 V140 H-5Z" fill="#f8fafc"/><path d="M22 34 L30 44 L26 46 L20 40Z M55 22 L64 34 L58 33 L52 28Z" fill="#cbd5e1"/>
      <path d="M-5 82 Q40 66 105 92 V140 H-5Z" fill="#ffffff"/><path d="M30 60 C40 80 70 90 50 120" stroke="#93c5fd" stroke-width="1.4" fill="none" stroke-dasharray="3 3"/>${gates}
      <g transform="translate(0 130)" opacity=".85"><rect width="100" height="10" fill="#fff"/>${chk}</g></g>
      <circle cx="80" cy="18" r="6" fill="#fde68a" opacity=".9"/>${frame('#f8fafc')}`;
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" preserveAspectRatio="none">${inner}</svg>`;
  return BACK_CACHE[theme]=`url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g,'%27')}')`;
}
function faceHTML(id){
  const r=RANKS[cRank(id)-1], s=SUITS[cSuit(id)]+VS, rk=cRank(id), th=SOL_THEMES[solTheme]||SOL_THEMES.ocean;
  const center = rk>10 ? `<span class="court">${th.court[rk-11]}</span>` : rk===1 ? `<span class="ace">${s}</span>` : `<span class="pip">${s}</span>`;
  return `<div class="f"><span class="tl">${r}<i>${s}</i></span>${center}<span class="br">${r}<i>${s}</i></span></div><div class="b"></div>`;
}

/* ---------- vy ---------- */
function solHTML(){
  const st=solStats()[S.mode]||{played:0,won:0};
  return `<div id="solRoot" class="sol theme-${solTheme}">
    <div class="topbar"><button class="iconbtn" data-act="lobby" aria-label="Till lobbyn">‹</button>
      <div class="tb-title">🃏 <b>Patiens</b><div class="net" id="solYz">${solYatzyPill()}</div></div>
      <button class="iconbtn chatic" data-c="toggle" aria-label="Chatt">💬<i class="cbadge ${chatUnread()?'on':''}" data-cbadge>${chatUnread()||''}</i></button><button class="iconbtn" data-act="soltheme" aria-label="Korttema">🎨</button><button class="iconbtn" data-act="sptoggle" aria-label="Musik">🎵</button></div>
    <div class="sol-info"><span class="chip">${SOL_MODES[S.mode].label}</span><span>⏱ <b id="solTime">${fmtTime(S.time)}</b></span><span>🔁 <b id="solMoves">${S.moves}</b> drag</span><span class="dim">🏆 ${st.won}/${st.played}</span></div>
    <div class="sol-board" id="solBoard">
      <div class="slot stock" id="slotStock" data-pile="s"><span>↻</span></div>
      ${[0,1,2,3].map(f=>`<div class="slot found" id="slotF${f}" data-pile="f${f}"><span>A</span></div>`).join('')}
      ${[0,1,2,3,4,5,6].map(c=>`<div class="slot tab" id="slotT${c}" data-pile="t${c}"><span>K</span></div>`).join('')}
      <div class="stockcount" id="stockCount"></div>
    </div>
    <div class="sol-actions" id="solActions">${solActionsHTML()}</div>
  </div>`;
}
function solActionsHTML(){
  const auto = S && !S.won && solAllUp();
  return `<button data-act="solnew"><i>🔄</i>Nytt spel</button><button data-act="solundo" ${solHist.length?'':'disabled'}><i>↶</i>Ångra</button>
    ${auto?'<button class="glow" data-act="solauto"><i>✨</i>Lägg upp</button>':'<button data-act="solhint"><i>💡</i>Tips</button>'}<button data-act="lobby"><i>🏠</i>Lobby</button>`;
}
function solYatzyPill(){
  if(mode!=='online' || !G) return '';
  const ic=gIcon(), nm=gName();
  if(G.over) return `<button class="yzpill" data-act="backtogame">${ic} ${nm}: matchen är klar</button>`;
  if(G.started===false) return `<button class="yzpill" data-act="backtogame">${ic} ${nm} ${esc(gameId)}: väntar på start</button>`;
  return G.cur===mySeat ? `<button class="yzpill hot" data-act="backtogame">${ic} Din tur i ${nm}! ›</button>` : `<button class="yzpill" data-act="backtogame">${ic} ${nm}: ${esc(pname(G.cur))}s tur</button>`;
}
function solRefreshChrome(){
  const a=document.getElementById('solActions'); if(a) a.innerHTML=solActionsHTML();
  const m=document.getElementById('solMoves'); if(m) m.textContent=S.moves;
  const y=document.getElementById('solYz'); if(y) y.innerHTML=solYatzyPill();
  const r=document.getElementById('solRoot'); if(r) r.className='sol theme-'+solTheme;
}
function solMount(){
  const board=document.getElementById('solBoard');
  board.style.setProperty('--back', backSVG(solTheme));
  for(let id=0;id<52;id++){
    const el=document.createElement('div'); el.className='scard'+(cRed(id)?' red':''); el.dataset.id=id;
    el.innerHTML=`<div class="in">${faceHTML(id)}</div>`;
    board.appendChild(el);
  }
  board.addEventListener('pointerdown',solPointerDown);
  solSync(true);
}
function solRetheme(){
  const board=document.getElementById('solBoard'); if(!board) return;
  board.style.setProperty('--back', backSVG(solTheme));
  board.querySelectorAll('.scard').forEach(el=>{ el.querySelector('.in').innerHTML=faceHTML(+el.dataset.id); });
  solRefreshChrome();
}
// räkna ut positioner och flytta korten (CSS-övergångar ger mjuka rörelser)
let SL=null;
function solLayout(){
  const board=document.getElementById('solBoard'); if(!board) return null;
  const W=board.clientWidth, gap=Math.max(5,Math.min(14,W*.014));
  const top=board.getBoundingClientRect().top+window.scrollY, act=document.getElementById('solActions')?.offsetHeight||70;
  const hCap=Math.max(36,(window.innerHeight-top-act-24)/3.7/1.4);   // så att korten ryms även på låga skärmar
  let cw=Math.min((W-6*gap)/7, isDesk()?118:96, hCap); const ch=cw*1.4;
  const ox=(W-(7*cw+6*gap))/2, X=c=>ox+c*(cw+gap);
  const ty=ch+gap*2.2;
  const avail=Math.max(ch*3, window.innerHeight - board.getBoundingClientRect().top - (document.getElementById('solActions')?.offsetHeight||60) - 26 - ty);
  board.style.setProperty('--cw',cw+'px'); board.style.setProperty('--ch',ch+'px');
  return {W,gap,cw,ch,X,ty,avail};
}
function solSync(instant, dragPos){
  const board=document.getElementById('solBoard'); if(!board || !S) return;
  SL=solLayout(); const {cw,ch,X,ty,avail,gap}=SL;
  const pos={};
  // slots
  const place=(el,x,y)=>{ if(el){ el.style.left=x+'px'; el.style.top=y+'px'; } };
  place(document.getElementById('slotStock'),X(0),0);
  for(let f=0;f<4;f++) place(document.getElementById('slotF'+f),X(3+f),0);
  for(let c=0;c<7;c++) place(document.getElementById('slotT'+c),X(c),ty);
  // hög
  S.stock.forEach((id,i)=>{ pos[id]={x:X(0)-Math.min(i,8)*0, y:0-Math.min(Math.floor(i/6),3)*1.2, z:10+i, up:false}; });
  const sc=document.getElementById('stockCount'); if(sc){ sc.textContent=S.stock.length||''; sc.style.left=(X(0)-8)+'px'; sc.style.top=(-8)+'px'; }
  document.getElementById('slotStock')?.classList.toggle('empty', !S.stock.length);
  // kasthög (solfjäder med upp till 3 synliga)
  const fan = S.mode==='1' ? 1 : 3, wl=S.waste.length;
  S.waste.forEach((id,i)=>{ const k=i-(wl-fan); const off=k>0?k*cw*.3:0; pos[id]={x:X(1)+off, y:0, z:100+i, up:true, top:i===wl-1}; });
  // grundhögar
  S.found.forEach((pile,f)=>pile.forEach((id,i)=>{ pos[id]={x:X(3+f), y:0, z:200+i, up:true}; }));
  // spelkolumner med anpassat avstånd så att allt får plats på höjden
  let maxY=ty+ch;
  S.tab.forEach((col,c)=>{
    const nd=col.filter(x=>!x.up).length, nu=col.length-nd;
    let dOff=ch*.11, uOff=ch*.27;
    const need=nd*dOff+Math.max(0,nu-1)*uOff+ch;
    if(need>avail && nu>1){ uOff=Math.max(ch*.19,(avail-ch-nd*dOff)/(nu-1)); }
    let y=ty;
    col.forEach((x,i)=>{ pos[x.id]={x:X(c), y, z:300+i, up:x.up}; y += x.up ? uOff : dOff; });
    if(col.length) maxY=Math.max(maxY, y-(col[col.length-1].up?uOff:dOff)+ch);
  });
  board.style.height=(maxY+gap)+'px';
  // tillämpa
  board.querySelectorAll('.scard').forEach(el=>{
    const id=+el.dataset.id, p=pos[id]; if(!p) return;
    if(instant) el.style.transition='none';
    if(dragPos && dragPos[id]){ el.style.transition='none'; el.style.left=dragPos[id].x+'px'; el.style.top=dragPos[id].y+'px'; el.style.transform=''; el.style.zIndex=2000+p.z; void el.offsetWidth; el.style.transition=''; }
    el.style.left=p.x+'px'; el.style.top=p.y+'px'; el.style.zIndex=(dragPos&&dragPos[id])?2000+p.z:p.z;
    el.classList.toggle('down',!p.up);
    el.classList.toggle('wtop',!!p.top);
    if(instant){ void el.offsetWidth; el.style.transition=''; }
    if(dragPos && dragPos[id]) setTimeout(()=>{ el.style.zIndex=p.z; },260);
  });
}
// vilken hög och vilket kort sitter ett kort-id i?
function solLocate(id){
  if(S.waste.length && topOf(S.waste)===id) return {t:'w'};
  if(S.waste.includes(id)) return {t:'wx'};
  if(S.stock.includes(id)) return {t:'s'};
  for(let f=0;f<4;f++) if(S.found[f].includes(id)) return topOf(S.found[f])===id ? {t:'f',f} : {t:'fx'};
  for(let c=0;c<7;c++){ const i=S.tab[c].findIndex(x=>x.id===id); if(i>=0) return {t:'t',c,i,up:S.tab[c][i].up}; }
  return null;
}
function solShake(src){ cardsAt(src).forEach(id=>{ const el=document.querySelector(`.scard[data-id="${id}"]`); if(el){ el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); } }); }
// släppmål utifrån var det dragna kortets mitt hamnar
function solDropTarget(cx,cy){
  const {X,cw,ch,ty,gap}=SL;
  let best=null, bd=1e9;
  const consider=(dst,x,y)=>{ const dx=cx-(x+cw/2), dy=cy-(y+ch/2), d=dx*dx+dy*dy; if(d<bd){ bd=d; best=dst; } };
  for(let f=0;f<4;f++) consider({t:'f',f},X(3+f),0);
  for(let c=0;c<7;c++){ const col=S.tab[c]; let y=ty; if(col.length){ const el=document.querySelector(`.scard[data-id="${topOf(col).id}"]`); y=parseFloat(el.style.top)||ty; } consider({t:'t',c},X(c),y); }
  return bd < Math.pow(Math.max(cw,ch)*1.1,2) ? best : null;
}
function solPointerDown(e){
  if(!S || S.won || e.button>0) return;
  const card=e.target.closest('.scard'), slot=e.target.closest('.slot');
  if(!card){ if(slot && slot.id==='slotStock'){ unlockAudio(); solDraw(); } return; }
  const id=+card.dataset.id, loc=solLocate(id); if(!loc) return;
  unlockAudio();
  if(loc.t==='s'){ solDraw(); return; }
  let src=null;
  if(loc.t==='w') src={t:'w'}; else if(loc.t==='f') src={t:'f',f:loc.f}; else if(loc.t==='t' && loc.up) src={t:'t',c:loc.c,i:loc.i};
  if(!src) return;
  e.preventDefault();
  const ids=cardsAt(src), els=ids.map(i=>document.querySelector(`.scard[data-id="${i}"]`));
  solDrag={src, ids, els, sx:e.clientX, sy:e.clientY, moved:false, pid:e.pointerId, base:els.map(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)}))};
  try{ card.setPointerCapture(e.pointerId); }catch(_){}
  window.addEventListener('pointermove',solPointerMove);
  window.addEventListener('pointerup',solPointerUp,{once:true});
  window.addEventListener('pointercancel',solPointerUp,{once:true});
}
function solPointerMove(e){
  const d=solDrag; if(!d || e.pointerId!==d.pid) return;
  const dx=e.clientX-d.sx, dy=e.clientY-d.sy;
  if(!d.moved && Math.hypot(dx,dy)<7) return;
  if(!d.moved){ d.moved=true; d.els.forEach((el,k)=>{ el.classList.add('dragging'); el.style.zIndex=5000+k; }); }
  d.els.forEach(el=>{ el.style.transform=`translate(${dx}px,${dy}px) rotate(${Math.max(-4,Math.min(4,dx/40))}deg)`; });
  d.dx=dx; d.dy=dy;
  // markera giltigt mål
  const cx=d.base[0].x+dx+SL.cw/2, cy=d.base[0].y+dy+SL.ch/2;
  const t=solDropTarget(cx,cy);
  document.querySelectorAll('.droptarget').forEach(x=>x.classList.remove('droptarget'));
  if(t && legal(d.src,t)){
    const el = t.t==='f' ? (S.found[t.f].length?document.querySelector(`.scard[data-id="${topOf(S.found[t.f])}"]`):document.getElementById('slotF'+t.f)) : (S.tab[t.c].length?document.querySelector(`.scard[data-id="${topOf(S.tab[t.c]).id}"]`):document.getElementById('slotT'+t.c));
    el?.classList.add('droptarget');
  }
}
function solPointerUp(e){
  window.removeEventListener('pointermove',solPointerMove);
  const d=solDrag; solDrag=null; if(!d) return;
  document.querySelectorAll('.droptarget').forEach(x=>x.classList.remove('droptarget'));
  d.els.forEach(el=>el.classList.remove('dragging'));
  if(!d.moved){ d.els.forEach(el=>{ el.style.transform=''; }); solTap(d.src); return; }
  const cx=d.base[0].x+d.dx+SL.cw/2, cy=d.base[0].y+d.dy+SL.ch/2;
  const t=solDropTarget(cx,cy);
  if(t && legal(d.src,t)){
    const dragPos={}; d.ids.forEach((id,k)=>{ dragPos[id]={x:d.base[k].x+d.dx, y:d.base[k].y+d.dy}; });
    d.els.forEach(el=>{ el.style.transition='none'; el.style.transform=''; });
    // flytta logiskt, och låt korten glida sista biten från där de släpptes
    solSnap(); solStart();
    let ids; const src=d.src;
    if(src.t==='w') ids=[S.waste.pop()]; else if(src.t==='f') ids=[S.found[src.f].pop()]; else ids=S.tab[src.c].splice(src.i).map(x=>x.id);
    if(t.t==='f') S.found[t.f].push(ids[0]); else ids.forEach(id=>S.tab[t.c].push({id,up:true}));
    let flipped=false; if(src.t==='t'){ const tp=topOf(S.tab[src.c]); if(tp && !tp.up){ tp.up=true; flipped=true; } }
    S.moves++; S.idle=0; t.t==='f'?solSnd('found'):solSnd('place'); if(flipped) setTimeout(()=>solSnd('flip'),120);
    solSaveN++; solSave(); solSync(false,dragPos);
    if(S.found.every(f=>f.length===13) && !S.won){ S.won=true; solSave(); solWin(); }
    solRefreshChrome();
  } else {
    d.els.forEach(el=>{ el.style.transform=''; });
    setTimeout(()=>d.els.forEach((el,k)=>{ const z=parseInt(el.style.zIndex)||0; if(z>=5000) el.style.zIndex=''; }),260);
    solSync(false); solSnd('nope');
  }
}
// tid
setInterval(()=>{
  if(view!=='sol' || !S || !S.started || S.won || document.hidden) return;
  S.time++; const t=document.getElementById('solTime'); if(t) t.textContent=fmtTime(S.time);
  if(S.time%5===0) solSave();
},1000);
window.addEventListener('resize',()=>{ if(view==='sol') requestAnimationFrame(()=>solSync(true)); });

/* ---------- start, nytt spel, teman ---------- */
function openSol(){
  closeModal();
  S = S || solLoad();
  if(!S || S.won){ showSolNew(true); return; }
  view='sol'; render();
}
function showSolNew(fromLobby){
  openModal(`<h3>🃏 Ny patiens</h3><p>Klassisk patiens med sju högar. Spelas helt offline.</p>
    <label>Hur många kort vänder du upp?</label>
    <div class="solmodes">${Object.entries(SOL_MODES).map(([k,m])=>`<button data-act="solmode" data-m="${k}" class="${solMode===k?'sel':''}"><b>${m.label}</b><small>${m.sub}</small></button>`).join('')}</div>
    <label>Korttema</label><div class="themes">${themeBtns()}</div>
    <div class="btns"><button data-act="close">Avbryt</button><button class="pri" data-act="solstart">Dela ut 🃏</button></div>`,'solnew');
}
function themeBtns(){
  return Object.entries(SOL_THEMES).map(([k,t])=>`<button data-act="solpicktheme" data-t="${k}" class="${solTheme===k?'sel':''}"><span class="mini-back" style="background-image:${backSVG(k)}"></span><span>${t.label}</span></button>`).join('');
}
function showSolTheme(){
  openModal(`<h3>🎨 Korttema</h3><p>Byt när du vill – spelet fortsätter.</p><div class="themes">${themeBtns()}</div>
    <div class="btns"><button class="pri" data-act="close">Klar</button></div>`,'soltheme');
}
function solStartNew(){
  closeModal(); clearTimeout(solAutoT);
  if(S && S.started && !S.won){ /* övergivet spel räknas som spelat men inte vunnet */ }
  solNew(solMode); view='sol';
  const old=document.getElementById('solRoot'); if(old) old.remove();
  render(); solSnd('shuffle');
}

/* ================= Aviseringar medan man är någon annanstans ================= */
function notice(o){
  if(BOT) return;
  const box=document.getElementById('notices'); if(!box) return;
  const n=document.createElement('div'); n.className='notice';
  n.innerHTML=`<div class="ic">${o.icon}</div><div><b>${esc(o.title)}</b><span>${esc(o.text||'')}</span></div><div class="acts">${(o.actions||[]).map((a,i)=>`<button data-nact="${i}">${esc(a.label)}</button>`).join('')}<button class="x" data-nact="x">Stäng</button></div>`;
  let done=false; const close=()=>{ if(done) return; done=true; n.classList.add('out'); setTimeout(()=>n.remove(),320); };
  n.addEventListener('click',e=>{ const b=e.target.closest('[data-nact]'); if(!b) return; e.stopPropagation(); close(); if(b.dataset.nact!=='x'){ unlockAudio(); o.actions[+b.dataset.nact].run(); } });
  box.prepend(n); while(box.children.length>3) box.lastChild.remove();
  setTimeout(close, o.ms||12000);
  if(o.sound!==false){ o.poke ? sfx.poke() : sfx.turn(); buzz(o.poke?[60,40,60,40,220]:[160,80,160]); }
  if(document.hidden){ startBlink(o.title); systemNotify(o.title+(o.text?' – '+o.text:'')); }
}
function backToGame(){ closeModal(); if(mode==='online' && G){ view='game'; render(); keepAwake(); try{ window.scrollTo(0,0) }catch(e){} } else resumeNet(); }
function leaveOnline(){ stopNet(); releaseWake(); mode=null; G=null; gameId=null; lsSet('ry_net',''); render(); toast('Du lämnade Yatzy-spelet'); }
window.addEventListener('hashchange',()=>{
  const h=(location.hash||'').replace('#','').toUpperCase(); if(!/^[A-Z0-9]{4}$/.test(h)) return;
  if(mode==='online' && gameId===h) return;
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  if(mode==='online' && G && !G.over) notice({icon:'✉️', title:'Inbjudan till ett spel', text:`Spelkod ${h}`, actions:[{label:'Gå med', run:()=>showJoin(h)}]});
  else showJoin(h);
});

/* ================= Lokalt ================= */
function startLocal(names,order,ai){
  stopNet(); clearTimeout(aiTimer); aiPlan=null;
  mode='local'; gameId=null; mySeat=null; G=newState(names,0,order,0,ai); shown=G.dice.slice(); freshCell=null; view='game';
  G.hr4=chosenHR; lsSet('ry_local',JSON.stringify(G)); render();
  toast(names.length===1 ? 'Lycka till! Sikta mot rekordet 🏆' : `${names[0]} börjar! 🚀`);
}
function resumeLocal(){
  try{ const g=JSON.parse(lsGet('ry_local')); if(!g || !validState(g)) return false;
    if(g.kind && g.kind!=='yatzy'){ stopNet(); mode='local'; mySeat=0; gameId=null; role=null; G=g; view='game'; resetDrafts(); render(); gMaybeAI(); return true; }
    stopNet(); mode='local'; G=g; shown=g.dice.slice(); view='game'; aiPlan=null; render(); maybeAI(1200); return true; }catch(e){ console.error('resumeLocal',e); return false; }
}
// Kom ihåg var man är, så att appen öppnas på samma ställe efter att mobilen stängt den
let lastWhere='';
function rememberWhere(){
  if(BOT) return;
  const w = view==='game' ? (mode==='local' ? 'local' : mode==='online' ? 'online' : 'lobby') : (view==='sol'||view==='inv') ? view : 'lobby';
  if(w!==lastWhere){ lastWhere=w; lsSet('ry_where', JSON.stringify({w, t:Date.now()})); }
}
function restoreWhere(){
  try{
    const r=JSON.parse(lsGet('ry_where')); if(!r || Date.now()-r.t>12*3600e3) return false;
    if(r.w==='local'){ const g=JSON.parse(lsGet('ry_local')); if(g && !g.over) return resumeLocal(); }
    if(r.w==='sol'){ const sv=solLoad(); if(sv && !sv.won && sv.started){ openSol(); return view==='sol'; } }
    if(r.w==='inv' && typeof INV!=='undefined'){ INV.open(); return true; }
  }catch(e){ console.error('restoreWhere',e); }
  return false;
}
function goLobby(){
  if(typeof INV!=='undefined') INV.stop();
  clearTimeout(aiTimer); clearTimeout(solAutoT); stopBlink(); trayOpen=false; closeModal();
  if(mode==='online' && G && !G.over){ view='lobby'; render(); return; }   // Yatzy fortsätter i bakgrunden
  stopNet(); releaseWake(); view='lobby'; mode=null; G=null; gameId=null; render();
}

/* ================= Modaler ================= */
const M = () => document.getElementById('modal');
function closeModal(){ M().classList.remove('show'); M().innerHTML=''; }
// kind: samma ruta som redan är öppen byggs om på plats – utan att hoppa till toppen eller fälla upp tangentbordet
function openModal(html, kind){
  const old=M().querySelector('.sheet');
  if(kind && old && M().classList.contains('show') && old.dataset.kind===kind){ const st=old.scrollTop; old.innerHTML=html; old.scrollTop=st; return; }
  M().innerHTML=`<div class="sheet" ${kind?`data-kind="${kind}"`:''}>${html}</div>`; M().classList.add('show');
  if(!FINE_PTR_M) return;   // på mobil: fäll inte upp tangentbordet automatiskt
  const inp=M().querySelector('input:not([value]), input[value=""]')||M().querySelector('input'); if(inp) setTimeout(()=>inp.focus(),80);
}
const FINE_PTR_M = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)').matches : true;
function showYatzyMenu(){
  let resume='';
  try{ const g=JSON.parse(lsGet('ry_local')); if(g && !g.over && (!g.kind||g.kind==='yatzy')) resume=`<button class="pri" data-act="resumelocal">↩︎ Fortsätt ${g.names.length===1?'ensamspelet ('+esc(g.names[0])+')':esc(g.names.join(' vs '))}</button>`; }catch(e){}
  const bf=bestList('free')[0], bd=bestList('down')[0];
  openModal(`<h3>🎲 Yatzy</h3><p>Svensk Yatzy med 15 rader. Välj hur ni vill spela.</p>
    <div class="btns" style="flex-direction:column">${resume}
      <button class="pri" data-act="newonline">🚀 Skapa onlinespel (2–4, varsin enhet)</button>
      <button data-act="newai">🤖 Spela mot Blixt (datorn)</button>
      <button data-act="newsolo">🧑‍🚀 Spela ensam</button>
      <button data-act="newlocal">📱 Flera på samma ${isDesk()?'skärm':'mobil'} (2–4)</button>
      <button data-act="close">Avbryt</button></div>
    ${bf||bd?`<div class="setnote" style="text-align:center;margin-top:8px">🏆 Rekord ensam: ${bf?`<b>${bf.s}</b> valfritt`:''}${bf&&bd?' · ':''}${bd?`<b>${bd.s}</b> i ordning`:''}</div>`:''}`,'ymenu');
}
function showCreate(){
  openModal(`<h3>🚀 Skapa spel</h3><p>Du får en kod med fyra tecken. Den andra mobilen trycker <b>Gå med</b> och skriver in koden.</p>
    <label>Ditt namn</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="t.ex. Pappa">
    <label>Hur spelar ni?</label><div class="seg" id="seg">${segHTML()}</div>${hrHTML()}
    <div class="btns"><button data-act="close">Avbryt</button><button class="pri" data-act="create">Skapa 🐬</button></div>`);
}
function showJoin(code=''){
  openModal(`<h3>🔗 Gå med i spel</h3><p>Skriv koden som syns på den andra mobilen.</p>
    <label>Kod</label><input id="cd" class="codein" maxlength="4" autocapitalize="characters" autocomplete="off" spellcheck="false" value="${esc(code)}" placeholder="ABCD">
    <label>Ditt namn</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
    <div class="btns"><button data-act="close">Avbryt</button><button class="pri" data-act="join">Kör! 🚀</button></div>`);
}
function showLocal(){
  openModal(`<h3>📱 Spela på samma mobil</h3><p>Ni turas om att trycka på samma skärm.</p>
    <label>Spelare 1</label><input id="n0" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Spelare 1">
    <label>Spelare 2</label><input id="n1" maxlength="14" placeholder="Spelare 2">
    <label>Hur spelar ni?</label><div class="seg" id="seg">${segHTML()}</div>${hrHTML()}
    <div class="btns"><button data-act="close">Avbryt</button><button class="pri" data-act="local">Starta 🚀</button></div>`);
}
let chosenLevel='easy';
function showAI(){
  openModal(`<h3>🤖 Spela mot Blixt</h3><p>Blixt är en robotdelfin som älskar tärningar.</p>
    <label>Ditt namn</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
    <label>Hur bra är Blixt?</label><div class="seg" id="segl">${segLevelHTML()}</div>
    <label>Hur spelar ni?</label><div class="seg" id="seg">${segHTML()}</div>${hrHTML()}
    <div class="btns"><button data-act="close">Avbryt</button><button class="pri" data-act="startai">Kör! 🚀</button></div>`);
}
function segLevelHTML(){
  return `<button data-act="lvl" data-l="easy" class="${chosenLevel==='easy'?'sel':''}">🐣 Lätt<small>gör ibland misstag</small></button>
    <button data-act="lvl" data-l="hard" class="${chosenLevel==='hard'?'sel':''}">🧠 Svår<small>räknar på allt</small></button>`;
}
function showSolo(){
  openModal(`<h3>🧑‍🚀 Spela ensam</h3><p>Hur många poäng kan du få? Slå ditt rekord!</p>
    <label>Ditt namn</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
    <label>Hur spelar du?</label><div class="seg" id="seg">${segHTML()}</div>${hrHTML()}
    <div class="btns"><button data-act="close">Avbryt</button><button class="pri" data-act="startsolo">Kör! 🚀</button></div>`);
}
function showSettings(){
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const permTxt = perm==='granted' ? '🔔 Påslagna' : perm==='denied' ? 'Nekade i webbläsaren' : perm==='unsupported' ? 'Stöds inte här' : 'Inte påslagna än';
  const onoff=(act,on)=>`<div class="seg"><button data-act="${act}" data-v="1" class="${on?'sel':''}">På</button><button data-act="${act}" data-v="0" class="${on?'':'sel'}">Av</button></div>`;
  openModal(`<h3>⚙️ Inställningar</h3>
    <div class="setrow"><div class="lbl">🎵 Bakgrundsmusik</div>${onoff('setmusic',musicOn)}</div>
    <div class="setrow"><div class="lbl">🔊 Ljudeffekter</div>${onoff('setsfx',!muted)}</div>
    <div class="setrow"><div class="lbl">🎧 Ljudeffekter även när Spotify spelar</div>${onoff('spsfx',spSfx)}</div>
    <div class="setrow"><div class="lbl">🎲 Ljud när tärningarna kastas (tryck för att lyssna)</div>
      <div class="chips">${Object.entries(DICE_SOUNDS).map(([k,v])=>`<button data-act="setdice" data-k="${k}" class="${diceSound===k?'sel':''}">${v.label}</button>`).join('')}</div></div>
    <div class="setrow"><div class="lbl">🔔 Aviseringar när det är din tur</div>
      <div class="chips"><button data-act="asknotify">Slå på aviseringar</button></div>
      <div class="setnote">Status: ${permTxt}. Ljud, vibration och en stor "Din tur!"-skylt kommer alltid. Systemaviseringar fungerar bara om webbläsaren tillåter det.</div></div>
    <div class="setrow"><div class="lbl">☀️ Håll skärmen tänd under onlinespel</div>${onoff('setwake',wakeOn)}
      <div class="setnote">Rekommenderas – då tappar mobilerna inte kontakten och du märker direkt när det är din tur.</div></div>
    <div class="btns"><button class="pri" data-act="close">Klar</button></div><div class="appver">Version ${APP_VERSION}${DEV?' · DEV':''}</div>`,'settings');
}
const BOT_NAMES=['Blixt 🤖','Bubbla 🤖','Kosmo 🤖','Nova 🤖'];
let slots=[];
function showMulti(){ if(!slots.length) slots=[{n:lsGet('ry_name')||'',t:'h'},{n:'',t:'h'}]; openModal(multiHTML(),'multi'); }
function captureSlots(){ slots.forEach((s,i)=>{ const el=document.getElementById('sl'+i); if(el && !el.disabled) s.n=el.value.trim(); }); }
function multiHTML(){
  let bot=0;
  return `<h3>📱 Flera på samma mobil</h3><p>2–4 spelare som turas om. Varje plats kan vara en människa eller en robot.</p>
    ${slots.map((s,i)=>{ const bn = s.t!=='h' ? BOT_NAMES[bot++] : '';
      return `<div class="slot"><div class="slotrow"><input id="sl${i}" maxlength="14" value="${s.t==='h'?esc(s.n):esc(bn)}" placeholder="Spelare ${i+1}" ${s.t!=='h'?'disabled':''}>${i>=2?`<button class="x" data-act="slotdel" data-i="${i}" aria-label="Ta bort">✕</button>`:''}</div>
      <div class="chips">${[['h','👤 Människa'],['easy','🤖 Lätt'],['hard','🤖 Svår']].map(([k,l])=>`<button data-act="slott" data-i="${i}" data-t="${k}" class="${s.t===k?'sel':''}">${l}</button>`).join('')}</div></div>`; }).join('')}
    ${slots.length<4?`<button class="addslot" data-act="slotadd">➕ Lägg till spelare</button>`:''}
    <label>Hur spelar ni?</label><div class="seg" id="seg">${segHTML()}</div>${hrHTML()}
    <div class="btns"><button data-act="close">Avbryt</button><button class="pri" data-act="startmulti">Starta 🚀</button></div>`;
}
function startMulti(){
  captureSlots();
  if(!slots.some(s=>s.t==='h')){ toast('Minst en människa behöver vara med 🐬'); return; }
  let bot=0; const names=[], ai=[];
  slots.forEach((s,i)=>{
    if(s.t==='h'){ let n=s.n||('Spelare '+(i+1)), k=2; const base=n; while(names.includes(n)) n=base.slice(0,12)+' '+(k++); names.push(n); ai.push(false); }
    else { names.push(BOT_NAMES[bot++]); ai.push(s.t); }
  });
  const firstHuman=slots.find(s=>s.t==='h'&&s.n); if(firstHuman) lsSet('ry_name',firstHuman.n);
  closeModal(); startLocal(names, chosenOrder, ai.some(Boolean)?ai:null); maybeAI(1400);
}
let chosenHR=false;
// husregeln är alltid AV när man öppnar en meny – man måste aktivt slå på den
function hrHTML(){ chosenHR=false; return `<button class="hrtog" data-act="hr4" id="hrtog">${hrInner()}</button>`; }
const hrInner = () => `<span>🃏 Husregel: fyra lika räknas som <b>två par</b></span><i>${chosenHR?'PÅ':'AV'}</i>`;
function segHTML(){
  return `<button data-act="ord" data-o="free" class="${chosenOrder==='free'?'sel':''}">🌌 Valfritt<small>välj fritt bland raderna</small></button>
    <button data-act="ord" data-o="down" class="${chosenOrder==='down'?'sel':''}">⬇️ I ordning<small>uppifrån och ned</small></button>`;
}
const val = id => (document.getElementById(id)?.value||'').trim();
document.addEventListener('input',e=>{
  if(e.target.classList && e.target.classList.contains('sp-vol')){ const v=+e.target.value; lsSet('ry_spvol',String(v)); try{ sdkPlayer && sdkPlayer.setVolume(v) }catch(_){} return; }
  if(e.target.id==='cd'){ const v=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4); if(v!==e.target.value) e.target.value=v; }
});

/* ================= Rendering ================= */
const DESK_MQ = window.matchMedia ? window.matchMedia('(min-width: 1000px) and (min-height: 560px)') : null;
// skrivbordslayout bara om spelet får minst 1000 px bredd (chatten kan vara dockad till höger)
const isDesk = () => !!(DESK_MQ && DESK_MQ.matches) && (window.innerWidth - (document.body.classList.contains('chatdock')?420:0)) >= 1000;
const FINE_PTR = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)').matches : false;
function kbHintHTML(){
  if(!FINE_PTR || !G || G.over) return '';
  return `<div class="kbhint"><span><kbd>Mellanslag</kbd>kasta</span><span><kbd>1</kbd>–<kbd>5</kbd>spara</span><span><kbd>↑</kbd><kbd>↓</kbd>välj rad</span><span><kbd>Enter</kbd>skriv in</span><span><kbd>E</kbd>emoji</span><span><kbd>M</kbd>musik</span></div>`;
}
function render(){
  rememberWhere();
  const app=document.getElementById('app'), dock=document.getElementById('dockRoot');
  const desk=isDesk(); document.body.classList.toggle('desk', desk);
  view==='lobby' ? startBubbles() : stopBubbles();
  document.body.classList.toggle('ingame', view!=='lobby');
  if(view==='lobby'){ app.innerHTML=lobbyHTML(); dock.innerHTML=''; fitDock(); return; }
  if(view==='stats'){ app.innerHTML=statsHTML(); dock.innerHTML=''; fitDock(); return; }
  if(view==='fr'){ dock.innerHTML=''; app.innerHTML=(typeof FR!=='undefined')?FR.html():''; app.style.paddingBottom='40px'; return; }
  if(view==='chat'){ view='lobby'; if(typeof CHAT!=='undefined') setTimeout(()=>CHAT.open(),0); }   // chatten bor i sidopanelen
  if(view==='inv'){ dock.innerHTML=''; if(!document.getElementById('invRoot')){ app.innerHTML=INV.html(); INV.mount(); } app.style.paddingBottom='0px'; return; }
  if(view==='sol'){ dock.innerHTML=''; if(!document.getElementById('solRoot')){ app.innerHTML=solHTML(); solMount(); } else { solRefreshChrome(); } app.style.paddingBottom='0px'; return; }
  if(!G){ app.innerHTML=topbar()+`<div class="loading">${DOLPHIN('ld')}<p>Simmar till spelet <b>${esc(gameId||'')}</b>…</p><p style="font-size:14px">${netText()}</p><button class="bigbtn alt" data-act="lobby" style="max-width:260px;margin:20px auto">Avbryt</button></div>`; dock.innerHTML=''; return; }
  if(isKind()){
    app.innerHTML = topbar() + (ready() ? KIND[G.kind].html() : waitingHTML());
    dock.innerHTML = ready() && G.kind!=='pong' && G.kind!=='slalom' && G.kind!=='skidskytte' && G.names.length>1 ? reactDockHTML() : '';
    if(ready() && KIND[G.kind].mounted) KIND[G.kind].mounted();
    freshCell=null; fitDock(); return;
  }
  if(desk){
    app.innerHTML = topbar() + `<div class="desk-grid"><div class="desk-left">${sheetHTML()}</div>
      <aside class="desk-right">${playersHTML()}${G.over?overHTML():''}${!ready()?waitingHTML():''}${G.over?reactDockHTML():dockHTML()}${kbHintHTML()}</aside></div>`;
    dock.innerHTML='';
  } else {
    app.innerHTML = topbar() + playersHTML() + (G.over?overHTML():'') + (!ready()?waitingHTML():'') + sheetHTML();
    dock.innerHTML = G.over ? reactDockHTML() : dockHTML();
  }
  freshCell=null;
  fitDock();
}
// Se till att hela protokollet (även Yatzy och Totalt) alltid går att scrolla fram ovanför tärningspanelen
function fitDock(){
  const app=document.getElementById('app'), d=document.querySelector('#dockRoot .dock');
  const h = d ? d.offsetHeight : 0;
  app.style.paddingBottom = (d ? h+28 : 40)+'px';
}
let lastDesk=null;
window.addEventListener('resize', ()=>{ const d=isDesk(); if(d!==lastDesk){ lastDesk=d; render(); } else fitDock(); });
function topbar(){
  return `<div class="topbar"><button class="iconbtn" data-act="lobby" aria-label="Tillbaka">‹</button>
    <div class="tb-title">${isKind()?`${gIcon()} <b>${gName()}</b>`:'🎲 <b>Yatzy</b>'}${mode==='online'&&gameId?` · ${esc(gameId)}`:''}${mode==='online'?`<div class="net ns-${net}">${netText()}</div>`:''}</div>
    <button class="iconbtn chatic" data-c="toggle" aria-label="Chatt">💬<i class="cbadge ${chatUnread()?'on':''}" data-cbadge>${chatUnread()||''}</i></button><button class="iconbtn ${spPlaying?'sp-on':''}" data-act="sptoggle" aria-label="Musik" style="margin-right:-2px">🎵</button><button class="iconbtn" data-act="settings" aria-label="Inställningar">⚙️</button></div>`;
}
/* ---------- lobbyn: spelen i kategorier ---------- */
const LOBBY_CATS=[
  ['🎲','Tärningsspel',['yatzy','fia']],
  ['🃏','Kortspel',['sol','vandtia','fisk','hjarter']],
  ['♟️','Strategi & brädspel',['kina','othello','c4','gomoku','ships','mm']],
  ['🔤','Ordspel',['ordfajt','wordle','hang']],
  ['🧩','Pussel & minne',['sudoku','memory']],
  ['⛷️','Sport & arkad',['slalom','skidskytte','pong','inv']]
];
const TILE_DESC={ships:'Mot datorn eller en kompis', mm:'Knäck den hemliga färgkoden', hang:'Gissa ordet innan gubben hängs', kina:'2–6 spelare · online eller mot datorn',
  ordfajt:'Ordspel · svenska, norska, jamska', pong:'Mot datorn, två på en skärm eller online'};
function lobbyTilesHTML(svSol, invS){
  const tile=k=>{
    if(k==='yatzy') return `<button class="tile" style="--tg:linear-gradient(135deg,#22d3ee,#6366f1 60%,#a855f7)" data-act="yatzymenu"><span class="ti">🎲</span><b>Yatzy</b><small>1–4 spelare · online, datorn eller samma mobil</small></button>`;
    if(k==='sol') return `<button class="tile leo" data-act="opensol"><span class="ti">🃏</span><b>Patiens</b><small>Ensam · offline</small>${svSol && !svSol.won && svSol.started?'<span class="badge">↩︎ fortsätt</span>':''}</button>`;
    if(k==='inv') return `<button class="tile" style="--tg:linear-gradient(135deg,#16a34a,#0f172a 75%)" data-act="openinv"><span class="ti">👾</span><b>Space Invaders</b><small>Ensam · 100+ nivåer</small>${invS.best?`<span class="badge">🏆 ${invS.best}</span>`:''}</button>`;
    const gi=typeof GINFO!=='undefined' && GINFO[k]; if(!gi) return '';
    const badge = gi.badge ? gi.badge() : '';
    return `<button class="tile" style="--tg:${gi.grad}" data-act="gmenu" data-k="${k}"><span class="ti">${gi.icon}</span><b>${gi.name}</b><small>${esc(gi.desc||TILE_DESC[k]||'')}</small>${badge}</button>`;
  };
  return LOBBY_CATS.map(([ic,name,keys])=>{ const t=keys.map(tile).join(''); return t ? `<h3 class="cat"><span>${ic}</span>${name}</h3><div class="tiles">${t}</div>` : ''; }).join('');
}
function lobbyHTML(){
  const devbar = DEV ? `<div class="devbar">🧪 <b>Testversion</b> · egen data och egna spelkoder · <a href="../">Öppna releaseversionen ›</a></div>` : '';
  let h = topbarLobby() + devbar + `<div class="lobby"><div class="lob-hero"><div class="logo brand">${DOLPHIN('lg','#a5f3ff','#7c6cff').replace('<svg','<svg class="big"')}
    <h1>Fröknarna Leins</h1><div class="gb">GAME BOARD</div><div class="leoband"></div></div>
    <div class="tag">Rymden · Havet · Leopard · Spel för stjärnor</div>
    <div class="getwell">Krya på dig! 💙🐬</div></div><div class="lob-menu">`;
  if(mode==='online' && G){
    const st = G.started===false ? `${G.names.length} spelare · väntar på start` : G.cur===mySeat ? '<b style="color:var(--gold)">Din tur!</b>' : `${esc(pname(G.cur))}s tur`;
    h += `<div class="bgcard"><div style="font-size:26px">${gIcon()}</div><div class="t"><b>${gName()} ${esc(gameId)} pågår</b><span>${st}</span></div><button data-act="backtogame">Tillbaka</button><button class="lv" data-act="leavegame">Lämna</button></div>`;
  } else try{
    const n=JSON.parse(lsGet('ry_net')), s=JSON.parse(lsGet('ry_net_state'));
    if(n && n.code && !(s && s.over)){
      const other = s && s.names && s.names.length>1 ? s.names.filter((_,i)=>i!==n.seat).join(', ') : '…';
      h += `<button class="bigbtn" data-act="resumenet">↩︎ Fortsätt spelet ${esc(n.code)} mot ${esc(other)}</button>`;
    }
  }catch(e){}
  const svSol=S||solLoad(), invS=(typeof INV!=='undefined')?INV.stats():{best:0};
  h += `<h2 class="sec"><span class="leopill"><i>🐆</i>Välj spel</span></h2>${lobbyTilesHTML(svSol, invS)}
    `;
  h += `
    <div class="chipsrow"><button class="bigbtn chatbtn" data-act="openchat">💬 Chatt <small>🔒 krypterad</small>${(typeof CHAT!=='undefined'&&CHAT.unread())?`<span class="badge">${CHAT.unread()}</span>`:''}</button></div>
    <div class="chipsrow"><button class="bigbtn" data-act="joinonline" style="background:linear-gradient(135deg,#2dd4bf,#3b82f6 60%,#6366f1)">🔗 Gå med i spel med kod</button></div>
    <div class="chipsrow"><button class="bigbtn alt" data-act="stats">📊 Statistik & rekord</button></div>`;
  const bf=bestList('free')[0], bd=bestList('down')[0];
  if(false) h += `<div class="note" style="margin-top:6px">🏆 Rekord ensam: ${bf?`<b>${bf.s}</b> valfritt (${esc(bf.n)})`:''}${bf&&bd?' · ':''}${bd?`<b>${bd.s}</b> i ordning (${esc(bd.n)})`:''}</div>`;
  const fu=(typeof FR!=='undefined')?FR.unread():0;
  h += `<div class="lob-foot"><button data-act="frnew">💡 Önska något</button><button data-act="frbug">🐞 Rapportera bugg</button><button data-act="frlist">📋 Önskelistan<i class="frb ${fu?'on':''}" data-frbadge>${fu||''}</i></button></div>`;
  return h + '</div></div>';
}
function updateFrBadge(){ const n=(typeof FR!=='undefined')?FR.unread():0; document.querySelectorAll('[data-frbadge]').forEach(el=>{ el.textContent=n||''; el.classList.toggle('on',n>0); }); }
function topbarLobby(){
  return `<div class="topbar"><div class="popc" id="popc" title="Poppade bubblor">🫧 ${popCount}</div><div class="tb-title" style="font-size:12px">Poppa bubblorna! 🫧</div>
    <button class="iconbtn" data-act="settings" aria-label="Inställningar">⚙️</button></div>`;
}
function playersHTML(){
  const cards = G.names.map((nm,i)=>{
    const on = !G.over && ready() && G.cur===i;
    const me = mode==='online' && mySeat===i;
    const t = totals(G.scores[i]).total;
    const msg = G.over ? `${filled(G.scores[i])}/15 rader` : !nm ? 'väntar…' :
      on ? (isAI(i) ? 'tänker… 🤖' : (me||mode==='local') ? 'DIN TUR 🐬' : 'spelar nu…') : `${filled(G.scores[i])}/15 rader`;
    return `<div class="pl ${on?'on':''}">${me?'<span class="me">du</span>':''}
      <div class="pn">${esc(nm||'…')}</div><div class="pt">${t}</div><div class="pm">${msg}</div></div>`;
  });
  if(G.names.length===1 && mode!=='online'){
    const b=bestList(G.order||'free')[0];
    cards.push(`<div class="pl"><div class="pn">🏆 Rekord</div><div class="pt">${b?b.s:'–'}</div><div class="pm">${b?esc(b.n):'inget än'} · ${G.order==='down'?'i ordning':'valfritt'}</div></div>`);
  }
  return `<div class="players ${cards.length>2?'many':''}">${cards.join('')}</div>`;
}
function waitingHTML(){
  if(mode!=='online') return '';
  const isHost=role==='host', n=G.names.length;
  const inviteBtn = /^https?:$/.test(location.protocol) && n<maxP() ? `<button class="bigbtn alt" data-act="invite" style="margin-top:10px">📤 Skicka inbjudningslänk</button>` : '';
  return `<div class="waiting"><div style="font-size:34px">🔭</div>
    <div>Spelkod</div><div class="code">${esc(gameId||'')}</div>${G.hr4?'<div style="font-size:13px;margin:4px 0">🃏 Husregel: fyra lika räknas som två par</div>':''}
    <div class="lobbyp">${G.names.map((nm,i)=>`<span class="${i===mySeat?'me':''}">${i===0?'👑 ':'🐬 '}${esc(nm)}</span>`).join('')}${Array.from({length:Math.max(0,maxP()-n)},()=>'<span class="empty">ledig plats</span>').join('')}</div>
    ${isHost ? `<button class="bigbtn" data-act="startgame" ${n<2?'disabled':''} style="margin-top:12px">▶️ Starta spelet${n>=2?` med ${n} spelare`:''}</button>${inviteBtn}
       <div style="color:var(--dim);font-size:13px;margin-top:8px">${n<2?'Vänta på att någon går med. ':''}${maxP()===2?'Två spelare.':`Upp till ${maxP()} spelare.`} De andra trycker <b>🔗 Gå med i spel</b> och skriver koden.</div>`
     : `<div style="margin-top:10px">${mySeat===null?'Ansluter…':`Väntar på att <b>${esc(pname(0))}</b> startar spelet… 🐬`}</div>`}
    <div style="font-size:13px;margin-top:8px">${netText()}</div></div>`;
}
function overHTML(){
  const T=G.scores.map(sc=>totals(sc).total);
  const btns=`<button class="bigbtn" data-act="rematch">🐬 Spela igen</button><button class="bigbtn alt" data-act="showresult">📋 Visa resultatet</button><button class="bigbtn alt" data-act="lobby">Till lobbyn</button>`;
  if(G.names.length===1){
    return `<div class="over"><div class="tr">${G.record?'🏆':'🌟'}</div>
      <h2>${G.record?'NYTT REKORD!':'Bra spelat!'}</h2><p>${esc(pname(0))} fick <b>${T[0]}</b> poäng</p>${btns}</div>`;
  }
  const max=Math.max(...T), winners=T.map((t,i)=>t===max?i:-1).filter(i=>i>=0);
  const tie=winners.length>1;
  return `<div class="over"><div class="tr">${tie?'🤝':'🏆'}</div>
    <h2>${tie?'Oavgjort!':esc(pname(winners[0]))+' vinner!'}</h2>
    <p>${G.names.map((n,i)=>esc(n)+' '+T[i]).join(' – ')}</p>${btns}</div>`;
}
function miniDie(n){ let p=''; for(let k=0;k<9;k++) p+=`<i class="${PIPS[n].includes(k)?'on':''}"></i>`; return `<span class="mini">${p}</span>`; }
function sheetHTML(){
  const active = myTurn() && G.rolls>0 && !rolling ? G.cur : -1;
  let best=-1;
  if(active>=0){ if(G.order!=='down') CATS.forEach(([k])=>{ if(k!=='chance' && !(k in G.scores[active])) best=Math.max(best,score(k,G.dice)); }); if(G.order!=='down' && best<=0 && !('chance' in G.scores[active])) best=score('chance',G.dice); }
  const colCls = i => (!G.over && ready() && G.cur===i && G.names.length>1) ? 'col-on' : '';
  const IX = G.names.map((_,i)=>i), lim = bonusLimit(G.order);
  const cell = (i,k) => {
    const s=G.scores[i];
    if(k in s){ const isNew=freshCell===i+':'+k; return `<div class="c ${colCls(i)} ${s[k]===0?'z':''} ${isNew?'new':''}">${s[k]===0?'–':s[k]}</div>`; }
    if(i===active && allowed(k,i)){ const v=score(k,G.dice);
      return `<div class="c ${colCls(i)}"><button class="pv ${v===0?'zero':''} ${v>0&&v===best?'best':''} ${kbCat===k?'kb':''}" data-act="pick" data-k="${k}">${v}</button></div>`; }
    return `<div class="c ${colCls(i)}"></div>`;
  };
  const head = `<div class="row head"><div style="text-align:left;padding-left:12px">Protokoll<span class="modetag">${G.order==='down'?'⬇️ I ordning':'🌌 Valfritt'}</span>${G.hr4?'<span class="modetag" title="Husregel: fyra lika räknas som två par">🃏 4 lika = 2 par</span>':''}</div>${IX.map(i=>`<div class="${mode==='online'&&mySeat===i?'mine':''}">${esc(G.names[i]||'…')}</div>`).join('')}</div>`;
  const many=IX.length>2, cw=IX.length<=2?70:IX.length===3?60:52;
  const cwd=IX.length<=2?120:IX.length===3?104:92;
  let h = `<div class="card ${many?'many':''}" style="--n:${IX.length};--cw:${cw}px;--cwd:${cwd}px">` + head;
  const nk = (G.order==='down' && !G.over && ready()) ? nextCat(G.scores[G.cur]) : null;
  UP.forEach(([k,n,d])=>{ h+=`<div class="row"><button class="cn ${k===nk?'next':''}" data-act="help" data-k="${k}">${miniDie(d)}${n}</button>${IX.map(i=>cell(i,k)).join('')}</div>`; });
  const T=IX.map(i=>totals(G.scores[i]));
  h += `<div class="row sum"><div class="cn">Summa</div>${T.map((t,i)=>`<div class="c ${colCls(i)}">${t.up}</div>`).join('')}</div>`;
  h += `<div class="row sum"><button class="cn" data-act="help" data-k="bonus">Bonus ⭐ <span class="bon">(${lim})</span></button>${T.map((t,i)=>`<div class="c ${colCls(i)}">${t.bonus?'<span class="bon ok">50</span>':`<span class="bon">${Math.max(0,lim-t.up)} kvar</span>`}</div>`).join('')}</div>`;
  LOW.forEach(([k,n])=>{ h+=`<div class="row"><button class="cn ${k===nk?'next':''}" data-act="help" data-k="${k}">${n}${k==='yatzy'?' 🐬':''}</button>${IX.map(i=>cell(i,k)).join('')}</div>`; });
  h += `<div class="row total"><div class="cn">Totalt</div>${T.map((t,i)=>`<div class="c ${colCls(i)}">${t.total}</div>`).join('')}</div>`;
  return h + '</div>';
}
function statusText(){
  if(!ready()) return mode==='online' && G.started===false ? (role==='host' ? 'Tryck ▶️ Starta när alla är med 🔭' : 'Väntar på att spelet startar… 🔭') : 'Väntar på motspelare… 🔭';
  if(mode==='online' && net!=='connected') return 'Väntar på kontakt med motspelaren… 📡';
  if(isAITurn()) return rolling ? `<b>${esc(pname(G.cur))}</b> kastar… 🌀` : `<b>${esc(pname(G.cur))}</b> tänker… 🤖`;
  if(!myTurn()) return `Väntar på <b>${esc(pname(G.cur))}</b>… 🐬`;
  const who = mode==='local' && NP()>1 ? `<b>${esc(pname(G.cur))}</b>: ` : '';
  if(rolling) return who+'Tärningarna snurrar… 🌀';
  if(G.rolls===0) return who+'Kasta tärningarna! 🚀';
  if(G.rolls<3) return who+(G.order==='down'?`Mål: <b>${NAME[nextCat(G.scores[G.cur])]}</b> · spara tärningar 🐬`:'Spara tärningar 🐬 eller välj rad');
  if(G.order==='down') return who+`Skriv in på <b>${NAME[nextCat(G.scores[G.cur])]}</b> ⭐`;
  return who+'Välj en rad i protokollet ⭐';
}
function diceHTML(){
  const idle = G.rolls===0 && !rolling;
  return shown.map((v,i)=>{
    const held = G.rolls>0 && G.held[i];
    let p=''; for(let k=0;k<9;k++) p+=`<i class="${PIPS[v].includes(k)?'on':''}"></i>`;
    return `<button class="die ${held?'held':''} ${idle?'idle':''} ${rolling&&!held?'roll':''}" data-act="hold" data-i="${i}" aria-label="Tärning ${v}"><span class="face">${p}</span>${held?'<em>🐬</em>':''}</button>`;
  }).join('');
}
function dockHTML(){
  const can = myTurn() && G.rolls<3 && !rolling;
  const label = G.rolls===0 ? 'Kasta! 🚀' : G.rolls<3 ? `Kasta igen 🌊` : 'Välj rad ⭐';
  return `<div class="dock"><div class="dock-in">
    ${trayHTML()}
    <div class="status" id="status">${statusText()}</div>
    <div class="dice" id="dice">${diceHTML()}</div>
    <div class="rollrow"><button class="reactbtn ${trayOpen?'on':''}" data-act="tray" aria-label="Skicka emoji">${trayOpen?'✖️':'😊'}</button><button class="rollbtn" data-act="roll" ${can?'':'disabled'}>${label}</button>
      <div class="pips" title="Kast kvar">${[0,1,2].map(i=>`<span class="${i<G.rolls?'used':''}"></span>`).join('')}</div></div>
  </div></div>`;
}
function reactDockHTML(){
  return `<div class="dock"><div class="dock-in">${trayHTML()}<div class="rollrow"><button class="reactbtn wide ${trayOpen?'on':''}" data-act="tray">${trayOpen?'✖️ Stäng':'😊 Skicka emoji'}</button></div></div></div>`;
}
function renderDice(){
  const d=document.getElementById('dice'); if(d) d.innerHTML=diceHTML();
  const s=document.getElementById('status'); if(s) s.innerHTML=statusText();
}

/* ================= Klick ================= */
document.addEventListener('click', e=>{
  const b=e.target.closest('[data-act]'); if(!b) return;
  const a=b.dataset.act;
  unlockAudio();
  switch(a){
    case 'roll': doRoll(); break;
    case 'hold': toggleHold(+b.dataset.i); break;
    case 'pick': pick(b.dataset.k); break;
    case 'help': toast(b.dataset.k==='bonus' ? `Bonus: får du ${bonusLimit(G&&G.order)} eller mer i övre delen blir det +50!${G&&G.order==='down'?' (42 när man spelar i ordning)':''}` : HELP[b.dataset.k],3500); break;
    case 'settings': showSettings(); break;
    case 'yatzymenu': showYatzyMenu(); break;
    case 'gmenu': showGameMenu(b.dataset.k); break;
    case 'openinv': openInv(); break;
    case 'frlist': FR.open(); break;
    case 'frnew': FR.open(); setTimeout(()=>document.querySelector('[data-fr="new"]')?.click(),0); break;
    case 'frbug': FR.open(); setTimeout(()=>document.querySelector('[data-fr="bug"]')?.click(),0); break;
    case 'openchat': CHAT.open(); break;
    case 'opensol': openSol(); break;
    case 'solnew': showSolNew(false); break;
    case 'solstart': case 'solnewsame': solStartNew(); break;
    case 'solmode': solMode=b.dataset.m; lsSet('ry_solmode',solMode); showSolNew(); break;
    case 'solpicktheme': solTheme=b.dataset.t; lsSet('ry_soltheme',solTheme); solRetheme(); M().querySelector('.solmodes') ? showSolNew() : showSolTheme(); break;
    case 'soltheme': showSolTheme(); break;
    case 'solundo': solUndo(); break;
    case 'solhint': solHint(); break;
    case 'solauto': solAutoFinish(); break;
    case 'backtogame': backToGame(); break;
    case 'leavegame': leaveOnline(); break;
    case 'sptoggle': spToggle(); break;
    case 'splogin': spLogin(); break;
    case 'spsfx': spSfx=b.dataset.v==='1'; lsSet('ry_spsfx',spSfx?'1':'0'); if(spSfx){ const m=muted; muted=false; sfx.roll(); muted=m; } spRefreshChrome(); if(M().classList.contains('show')) showSettings(); break;
    case 'splogout': spLogout(); break;
    case 'splist': { const pl=spLists&&spLists[+b.dataset.i]; if(pl) spPlayCtx(pl.uri); break; }
    case 'spctl': spCtl(b.dataset.a); break;
    case 'spmode': spMode=b.dataset.m; lsSet('ry_spmode',spMode); if(spMode==='here') spLoadSdk(); spRefreshChrome(); break;
    case 'spclose': spToggle(false); break;
    case 'spplay': spPlayFromInput(); break;
    case 'sprecent': { const st=spGet(), it=st.recent[+b.dataset.i]; if(it){ st.uri=it.uri; spSave(st); spLoad(it.uri,true); spRefreshChrome(); } break; }
    case 'spduck': spDuck=b.dataset.v==='1'; lsSet('ry_spduck',spDuck?'1':'0'); if(!spDuck && musicOn) startMusic(); else if(spDuck && spPlaying) stopMusic(); spRefreshChrome(); break;
    case 'tray': trayOpen=!trayOpen; render(); break;
    case 'invite': invite(); break;
    case 'emo': sendEmoji(b.dataset.e); break;
    case 'poke': sendPoke(); break;
    case 'setmusic': musicOn=b.dataset.v==='1'; lsSet('ry_music',musicOn?'1':'0'); musicOn?startMusic():stopMusic(); showSettings(); break;
    case 'setsfx': muted=b.dataset.v==='0'; lsSet('ry_mute',muted?'1':'0'); if(!muted) sfx.bubble(); showSettings(); break;
    case 'setdice': diceSound=b.dataset.k; lsSet('ry_dsnd',diceSound); { const m=muted; muted=false; sfx.roll(); muted=m; } showSettings(); break;
    case 'asknotify': askNotify(); break;
    case 'setwake': wakeOn=b.dataset.v==='1'; lsSet('ry_wake',wakeOn?'1':'0'); wakeOn?keepAwake():releaseWake(); showSettings(); break;
    case 'newai': chosenOrder='free'; showAI(); break;
    case 'newsolo': chosenOrder='free'; showSolo(); break;
    case 'lvl': chosenLevel=b.dataset.l; document.getElementById('segl').innerHTML=segLevelHTML(); sfx.bubble(); break;
    case 'startai': { const n=val('nm')||'Du'; lsSet('ry_name',n); closeModal(); startLocal([n,AI_NAME],chosenOrder,[false,chosenLevel]); break; }
    case 'startsolo': { const n=val('nm')||'Du'; lsSet('ry_name',n); closeModal(); startLocal([n],chosenOrder,null); break; }
    case 'lobby': goLobby(); break;
    case 'newonline': chosenOrder='free'; showCreate(); break;
    case 'joinonline': showJoin(); break;
    case 'resumenet': resumeNet(); break;
    case 'hr4': { chosenHR=!chosenHR; const t=document.getElementById('hrtog'); if(t){ t.classList.toggle('on',chosenHR); t.innerHTML=hrInner(); } sfx.bubble(); break; }
    case 'ord': chosenOrder=b.dataset.o; document.getElementById('seg').innerHTML=segHTML(); sfx.bubble(); break;
    case 'newlocal': chosenOrder='free'; slots=[]; showMulti(); break;
    case 'slott': captureSlots(); slots[+b.dataset.i].t=b.dataset.t; openModal(multiHTML(),'multi'); break;
    case 'slotadd': captureSlots(); if(slots.length<4) slots.push({n:'',t:'h'}); openModal(multiHTML(),'multi'); break;
    case 'slotdel': captureSlots(); slots.splice(+b.dataset.i,1); openModal(multiHTML(),'multi'); break;
    case 'startmulti': startMulti(); break;
    case 'startgame': startOnlineGame(); break;
    case 'resumelocal': resumeLocal(); break;
    case 'close': closeModal(); break;
    case 'rematch': rematch(); break;
    case 'stats': armedReset=false; if(view==='game' && mode==='online'){ goLobby(); } openStats(); break;
    case 'statswho': statsWho=b.dataset.n; render(); break;
    case 'showresult': if(G && G.over) openModal(resultHTML()); break;
    case 'resetstats': if(!armedReset){ armedReset=true; render(); setTimeout(()=>{ armedReset=false; if(view==='stats') render(); },3500); } else { armedReset=false; saveStats({games:[]}); lsSet('ry_stats2',''); toast('Statistiken är rensad'); render(); } break;
    case 'create': { const n=val('nm'); if(!n){ toast('Skriv ditt namn 🐬'); return; } lsSet('ry_name',n); closeModal(); hostGame(n, chosenOrder); break; }
    case 'join': { const c=val('cd').toUpperCase(), n=val('nm'); if(c.length!==4){ toast('Koden har fyra tecken 🔭'); return; } if(!n){ toast('Skriv ditt namn 🐬'); return; } lsSet('ry_name',n); closeModal(); joinGame(c,n); break; }
    case 'local': { const a0=val('n0')||'Spelare 1', a1=val('n1')||'Spelare 2'; lsSet('ry_name',a0); closeModal(); startLocal([a0,a1],chosenOrder,null); break; }
  }
});
document.addEventListener('keydown', e=>{
  if(e.key==='Enter' && e.target && e.target.id==='splink'){ spPlayFromInput(); return; }
  if(e.key!=='Enter' || !M().classList.contains('show')) return;
  const pri=M().querySelector('button.pri'); if(pri) pri.click();
});

/* ================= Tangentbord ================= */
document.addEventListener('keydown',e=>{
  const tag=(e.target && e.target.tagName)||'';
  if(/INPUT|TEXTAREA|SELECT/.test(tag) || e.ctrlKey || e.metaKey || e.altKey) return;
  if(e.key==='Escape'){
    if(M().classList.contains('show')) closeModal(); else if(spOpen) spToggle(false); else if(trayOpen){ trayOpen=false; render(); }
    return;
  }
  if(M().classList.contains('show')) return;
  if(e.key==='m' || e.key==='M'){ spToggle(); return; }
  if(view==='sol' && S){
    if(e.key===' '){ e.preventDefault(); if(document.activeElement && document.activeElement!==document.body) document.activeElement.blur(); unlockAudio(); solDraw(); }
    else if(e.key==='z' || e.key==='Z' || e.key==='Backspace'){ e.preventDefault(); solUndo(); }
    else if(e.key==='h' || e.key==='H'){ solHint(); }
    else if(e.key==='n' || e.key==='N'){ showSolNew(); }
    return;
  }
  if(view!=='game' || !G) return;
  if(e.key==='e' || e.key==='E'){ trayOpen=!trayOpen; render(); return; }
  if(G.kind && G.kind!=='yatzy') return;
  if(e.key===' ' || e.code==='Space'){
    e.preventDefault(); if(document.activeElement && document.activeElement!==document.body) document.activeElement.blur();
    unlockAudio(); doRoll(); return;
  }
  if(/^[1-5]$/.test(e.key)){ toggleHold(+e.key-1); return; }
  if(e.key==='ArrowDown' || e.key==='ArrowUp'){
    const keys=[...document.querySelectorAll('.pv')].map(b=>b.dataset.k); if(!keys.length) return;
    e.preventDefault();
    const best=document.querySelector('.pv.best'); let i = kbCat && keys.includes(kbCat) ? keys.indexOf(kbCat) : (best ? keys.indexOf(best.dataset.k) : -1);
    i = e.key==='ArrowDown' ? (i<0?0:Math.min(keys.length-1,i+1)) : (i<0?keys.length-1:Math.max(0,i-1));
    kbCat=keys[i]; render(); sfx.unbubble();
    const el=document.querySelector('.pv.kb'); if(el) el.scrollIntoView({block:'nearest',behavior:'smooth'});
    return;
  }
  if(e.key==='Enter'){
    const all=document.querySelectorAll('.pv');
    const t=document.querySelector('.pv.kb') || document.querySelector('.pv.best') || (all.length===1?all[0]:null);
    if(t){ e.preventDefault(); unlockAudio(); pick(t.dataset.k); } else if(all.length) toast('Välj rad med ↑ ↓ först ⭐');
  }
});

/* ================= Start ================= */
if(DEV && !BOT){ const d=document.createElement('div'); d.className='devribbon'; d.textContent='DEV'; document.body.appendChild(d); }
if(!BOT){
spBuild();
const willResume=canAutoResume();
const whereSaved=(()=>{ try{ const r=JSON.parse(lsGet('ry_where')); return r && r.w!=='lobby' && Date.now()-r.t<12*3600e3; }catch(e){ return false; } })();
const pendingOpen = willResume || whereSaved;
if(!pendingOpen) render();
// spelfilerna (games.js m.fl.) laddas efter den här filen – återuppta när allt finns
document.addEventListener('DOMContentLoaded',()=>{
  if(!pendingOpen) return;
  const resumed = willResume && autoResume();                         // pågående onlinespel kopplar upp igen
  let w=''; try{ w=(JSON.parse(lsGet('ry_where'))||{}).w||''; }catch(e){}
  if(w==='sol' || w==='inv'){ if(restoreWhere()) return; }           // patiens/invaders på skärmen, onlinespelet i bakgrunden
  else if(!resumed && restoreWhere()) return;                         // spel mot datorn
  if(!resumed) render();                                              // annars lobbyn
});
spHandleRedirect();
}
// spelen i egna filer (kit.js, strat.js …) laddas efter app.js – rita lobbyn igen när allt finns
document.addEventListener('DOMContentLoaded',()=>{ if(view==='lobby') render(); });
window.addEventListener('storage',e=>{ if(e.key==='ry_spauth'){ spUser=null; spLists=null; if(spOpen) spInit(); spRefreshChrome(); } });
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible' && spAuth() && spOpen && !spUser) spInit(); });
(function(){ const h=(location.hash||'').replace('#','').toUpperCase(); if(/^[A-Z0-9]{4}$/.test(h)) showJoin(h); })();
