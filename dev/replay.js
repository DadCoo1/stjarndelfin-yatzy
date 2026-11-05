/* =====================================================================
   replay.js – gemensamt för repris och höjdpunkter (slalom, skidskytte)
   • kontrollrad: spela/paus, hastighet, spola, stäng
   • TV-grafik ovanpå bilden: REPRIS-märke, filmband, blixt vid klipp,
     titel och textskyltar ("Toppfart 74 km/h", "Fullt!")
   • hjälp för att hitta en ruta i inspelningen och interpolera
   ===================================================================== */
'use strict';
const REPLAY = (()=>{
  const REG={};
  const fmt=t=>{ t=Math.max(0,t); const m=Math.floor(t/60), s=t-m*60; return m?`${m}:${s.toFixed(1).padStart(4,'0')}`:s.toFixed(1); };
  function bar(key,p){
    if(!p) return '';
    return `<div class="rp-bar" data-rk="${key}"><span class="rp-tag">${p.mode==='hl'?'🎬 Höjdpunkter':'⏪ Repris'}</span>
      <button data-rp="play" aria-label="Spela/paus">${p.playing?'⏸':'▶️'}</button>
      ${p.mode==='replay'?`<button data-rp="speed" aria-label="Hastighet">${p.speed===1?'1×':p.speed===.5?'½×':p.speed===.25?'¼×':'2×'}</button><input type="range" data-rp="seek" min="0" max="1000" value="${Math.round(p.t/Math.max(.01,p.T)*1000)}" aria-label="Spola">`:'<span class="rp-sp"></span>'}
      <button data-rp="close" aria-label="Stäng">✕</button></div>`;
  }
  function register(key,on){ REG[key]=on; }
  function refresh(key,p){ const el=document.querySelector(`.rp-bar[data-rk="${key}"]`); if(el) el.outerHTML=bar(key,p); }
  function sync(key,p){ const el=document.querySelector(`.rp-bar[data-rk="${key}"] input[data-rp="seek"]`); if(el && document.activeElement!==el) el.value=Math.round(p.t/Math.max(.01,p.T)*1000); }
  document.addEventListener('pointerdown',e=>{ const b=e.target.closest('[data-rp]'); if(!b||b.dataset.rp==='seek') return; const bar=b.closest('.rp-bar'); if(!bar||!REG[bar.dataset.rk]) return; e.preventDefault(); e.stopPropagation(); REG[bar.dataset.rk](b.dataset.rp); },true);
  document.addEventListener('input',e=>{ const b=e.target.closest('[data-rp="seek"]'); if(!b) return; const bar=b.closest('.rp-bar'); if(bar&&REG[bar.dataset.rk]) REG[bar.dataset.rk]('seek',+b.value/1000); });
  // index i en tidsordnad lista (fr[i].t)
  function find(fr,t){ let lo=0, hi=fr.length-1; if(hi<0) return -1; if(t<=fr[0].t) return 0; if(t>=fr[hi].t) return hi; while(hi-lo>1){ const m=(lo+hi)>>1; if(fr[m].t<=t) lo=m; else hi=m; } return lo; }
  // TV-grafik
  function overlay(ctx,W,H,o){
    if(o.mode==='hl'){ const bar=H*.06; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,bar); ctx.fillRect(0,H-bar,W,bar);
      if(o.flash>0){ ctx.fillStyle=`rgba(255,255,255,${o.flash})`; ctx.fillRect(0,0,W,H); }
      if(o.title>0){ ctx.save(); ctx.globalAlpha=Math.min(1,o.title*2); ctx.fillStyle='rgba(11,46,122,.85)'; ctx.fillRect(0,H*.4,W,64); ctx.fillStyle='#facc15'; ctx.fillRect(0,H*.4,W,4); ctx.fillRect(0,H*.4+60,W,4);
        ctx.fillStyle='#fff'; ctx.font='900 26px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🎬 HÖJDPUNKTER',W/2,H*.4+24); ctx.font='700 13px system-ui'; ctx.fillStyle='#cbd5e1'; ctx.fillText(o.sub||'',W/2,H*.4+46); ctx.restore(); }
      if(o.cap){ const a=Math.min(1,o.capA??1); ctx.save(); ctx.globalAlpha=a; ctx.font='800 15px system-ui'; const w=Math.min(W-28,ctx.measureText(o.cap).width+34);
        ctx.fillStyle='rgba(11,46,122,.9)'; ctx.fillRect(14,H-bar-56,w,34); ctx.fillStyle='#facc15'; ctx.fillRect(14,H-bar-56,6,34);
        ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(o.cap,28,H-bar-39); ctx.restore(); }
      if(o.slow){ ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font='800 12px system-ui'; ctx.textAlign='right'; ctx.textBaseline='top'; ctx.fillText('SLOW MOTION',W-14,bar+10); }
    } else {
      ctx.fillStyle='rgba(239,68,68,.92)'; ctx.beginPath(); ctx.roundRect(W-104,H*.13,92,24,6); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='800 12px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(`⏪ REPRIS ${o.speed!==1?(o.speed<1?'·':'·')+(o.speed===.5?'½×':o.speed===.25?'¼×':o.speed+'×'):''}`,W-58,H*.13+12);
    }
  }
  const css=document.createElement('style'); css.textContent=`
.rp-bar{position:absolute;left:8px;right:8px;bottom:94px;display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:14px;background:rgba(15,23,42,.82);border:1px solid rgba(255,255,255,.2);z-index:5}
.rp-bar button{min-width:34px;height:32px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font-size:14px;font-weight:800;padding:0 8px}
.rp-bar input{flex:1;accent-color:#facc15;min-width:60px}.rp-sp{flex:1}
.rp-tag{font-size:12px;font-weight:800;color:#facc15;white-space:nowrap}
.rp-on .sl-over,.rp-on .bs-over,.rp-on .bs-ctl,.rp-on .dr-bar.hlhide{display:none!important}
.rp-hl .dr-bar{display:none!important}
.rp-btns{display:flex;gap:8px;justify-content:center;margin-top:8px;flex-wrap:wrap}.rp-btns button{font-size:13px}`;
  document.head.appendChild(css);
  return {bar, register, refresh, sync, find, overlay, fmt};
})();
