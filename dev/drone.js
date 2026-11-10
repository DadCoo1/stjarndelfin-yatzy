/* =====================================================================
   drone.js – gemensam drönarkamera för slalom och skidskytte
   • fem fasta lägen: bakom, snett bakifrån, rakt ovanifrån,
     snett framifrån och framför – plus ett zoomreglage (höjd/avstånd)
   • kameran glider mjukt mellan lägena och följer åkaren hela tiden
   • äkta 3D-projektion (position, girvinkel, lutning) så att kameran
     kan titta bakåt uppför backen eller rakt ned
   ===================================================================== */
'use strict';
const DRONE = (()=>{
  const VIEWS=[['back','⬆️','Bakom'],['obk','↗️','Snett bakifrån'],['top','⏺️','Ovanifrån'],['ofr','↙️','Snett framifrån'],['front','⬇️','Framför'],['tv','🎥','TV-kamera']];
  const REG={};
  const lerp=(a,b,t)=>a+(b-a)*t, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function make(key,temp){
    const st={key, on:lsGet(key+'_on')==='1', view:lsGet(key+'_v')||'obk', zoom:clamp(+(lsGet(key+'_z')||.15),0,1), cp:null, lp:null, C:{x:0,y:0,z:0,yaw:0,pitch:0,f:500}, onChange:null};
    if(!VIEWS.some(v=>v[0]===st.view)) st.view='obk';
    if(temp){ st.on=false; return st; }   // tillfällig kamera (firande, höjdpunkter) – sparas inte
    REG[key]=st; return st;
  }
  // målposition och siktpunkt för läget, utifrån åkaren S och banans riktning (fx,fz)
  function goal(st,S,fx,fz){
    const L=Math.hypot(fx,fz)||1; fx/=L; fz/=L; const rx=fz, rz=-fx;           // höger om färdriktningen
    const d=5+Math.pow(st.zoom,1.35)*85;
    const P=(f,r,u)=>[S.x+fx*f+rx*r, S.y+u, S.z+fz*f+rz*r];
    switch(st.view){
      case 'back':  return {p:P(-d*.95,0,d*.34), l:P(d*.25,0,0)};
      case 'obk':   return {p:P(-d*.7,d*.55,d*.48), l:P(d*.08,0,0)};
      case 'top':   return {p:P(-d*.02,0,d*1.2), l:P(0,0,0)};
      case 'ofr':   return {p:P(d*.75,d*.5,d*.45), l:P(0,0,0)};
      case 'front': return {p:P(d*.95,0,d*.3), l:P(-d*.1,0,0)};
      // TV-kamera: fasta torn längs backen som följer åkaren med zoom och klipper till nästa torn
      case 'tv': { if(!st.rail) return {p:P(-d*.7,d*.55,d*.48), l:P(d*.08,0,0)}; const k=Math.floor((S.z+25)/150); if(k!==st.tvk){ st.tvk=k; st.cut=true; } return {p:st.rail(k), l:P(1.2,0,.4), fixed:true}; }
      // för höjdpunkterna: kretsa runt åkaren, flyga över, zooma in nära
      case 'orbit': { const a=st.ang||0; return {p:P(Math.cos(a)*d,Math.sin(a)*d,d*.38), l:P(0,0,.6)}; }
      case 'fly':   { const k=st.k||0; return {p:P(lerp(d*1.3,-d*1.1,k),d*.15,d*.42+Math.sin(k*Math.PI)*d*.25), l:P(lerp(d*.2,-d*.05,k),0,0)}; }
      case 'close': { const a=st.ang||.6; return {p:P(Math.cos(a)*d*.9,Math.sin(a)*d*.9,d*.22), l:P(0,0,.9)}; }
      case 'low':   { const a=st.ang||0; return {p:P(-d*.9,Math.sin(a)*d*.3,.9), l:P(d*.5,0,.6)}; }
    }
    return {p:P(-d,0,d*.4), l:P(0,0,0)};
  }
  function solve(st,S,fx,fz,dt,W,H,ground,snap){
    const g=goal(st,S,fx,fz); if(st.cut){ snap=true; st.cut=false; }
    const lift=p=>{ if(ground&&!g.fixed) p[1]=Math.max(p[1],ground(p[2])+3); };   // aldrig ned i backen
    lift(g.p);
    // fri sikt: ligger backen (ett krön) mellan kameran och åkaren lyfts kameran tills åkaren syns
    if(ground) for(let it=0;it<3;it++){ let need=0; for(let k=.12;k<.95;k+=.08){ const y0=S.y-.9, x=y0+(g.p[1]-y0)*k, z=S.z+(g.p[2]-S.z)*k, gy=ground(z)+.35; if(x<gy) need=Math.max(need,(gy-x)/k); } if(need<=0) break; g.p[1]+=need; }
    if(!st.cp||snap){ st.cp=g.p.slice(); st.lp=g.l.slice(); }
    const k=Math.min(1,dt*(st.fast||3.2)), kl=Math.min(1,dt*(st.fast?st.fast*2:7));
    for(let i=0;i<3;i++){ st.cp[i]+= (g.p[i]-st.cp[i])*k; st.lp[i]+= (g.l[i]-st.lp[i])*kl; }
    lift(st.cp);
    const C=st.C, dx=st.lp[0]-st.cp[0], dy=st.lp[1]-st.cp[1], dz=st.lp[2]-st.cp[2];
    C.x=st.cp[0]; C.y=st.cp[1]; C.z=st.cp[2]; C.yaw=Math.atan2(dx,dz); C.pitch=Math.atan2(-dy,Math.hypot(dx,dz)); C.f=Math.min(W,H)*1.08; C.W=W; C.H=H;
    if(g.fixed){ C.f*=clamp(Math.hypot(dx,dy,dz)/(8+st.zoom*50),1,14); }      // teleobjektiv: åkaren hålls lagom stor
    return C;
  }
  // [skärm-x, skärm-y, pixlar per meter, djup]
  function proj(C,x,y,z){
    const dx=x-C.x, dy=y-C.y, dz=z-C.z, cy=Math.cos(C.yaw), sy=Math.sin(C.yaw);
    const X=dx*cy-dz*sy, Z0=dx*sy+dz*cy, cp=Math.cos(C.pitch), sp=Math.sin(C.pitch);
    const Y=dy*cp+Z0*sp, Z=-dy*sp+Z0*cp;
    if(Z<.35) return null; return [C.W/2+X*C.f/Z, C.H/2-Y*C.f/Z, C.f/Z, Z];
  }
  // hur åkaren ses: bakifrån, framifrån eller ovanifrån
  function facing(C,fx,fz){ if(C.pitch>1.05) return 'top'; const vx=Math.sin(C.yaw), vz=Math.cos(C.yaw); return (vx*fx+vz*fz)<-.15 ? 'front' : 'back'; }
  function panel(st){
    return `<div class="dr-bar" data-dk="${st.key}"><button class="dr-tg" data-dr="tg">${st.on?'⛷️ Åkarvy':'🚁 Drönare'}</button>${st.on?`<div class="dr-ctl">${VIEWS.filter(v=>v[0]!=='tv'||st.rail).map(([k,i,n])=>`<button data-dr="v" data-v="${k}" class="${st.view===k?'sel':''}" title="${n}" aria-label="${n}">${i}</button>`).join('')}<input type="range" min="0" max="100" value="${Math.round(st.zoom*100)}" data-dr="z" aria-label="Höjd och avstånd"></div>`:''}</div>`;
  }
  function refresh(st){ const el=document.querySelector(`.dr-bar[data-dk="${st.key}"]`); if(el) el.outerHTML=panel(st); }
  function setOn(st,on){ st.on=on; st.cp=null; lsSet(st.key+'_on',on?'1':'0'); refresh(st); if(st.onChange) st.onChange(); }
  function hit(e){ const b=e.target.closest('[data-dr]'); if(!b) return null; const bar=b.closest('.dr-bar'); return bar&&REG[bar.dataset.dk] ? {b, st:REG[bar.dataset.dk]} : null; }
  document.addEventListener('pointerdown',e=>{ const h=hit(e); if(!h) return; e.stopPropagation(); const {b,st}=h;
    if(b.dataset.dr==='tg'){ e.preventDefault(); setOn(st,!st.on); try{ sfx.bubble(); }catch(er){} return; }
    if(b.dataset.dr==='v'){ e.preventDefault(); st.view=b.dataset.v; lsSet(st.key+'_v',st.view); refresh(st); try{ sfx.bubble(); }catch(er){} } },true);
  document.addEventListener('input',e=>{ const h=hit(e); if(!h||h.b.dataset.dr!=='z') return; h.st.zoom=clamp(+h.b.value/100,0,1); lsSet(h.st.key+'_z',String(h.st.zoom)); });
  const css=document.createElement('style'); css.textContent=`
.dr-bar{position:absolute;left:8px;right:8px;bottom:46px;display:flex;justify-content:flex-end;align-items:center;gap:6px;flex-wrap:wrap;pointer-events:none;z-index:3}
.dr-bar button,.dr-bar input{pointer-events:auto;touch-action:manipulation}
.dr-tg{padding:7px 11px;border-radius:12px;border:1px solid rgba(255,255,255,.35);background:rgba(15,23,42,.62);color:#fff;font-size:12.5px;font-weight:700}
.dr-ctl{display:flex;align-items:center;gap:4px;background:rgba(15,23,42,.62);border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:4px 6px}
.dr-ctl button{width:32px;height:30px;border-radius:9px;border:1px solid transparent;background:transparent;font-size:16px;padding:0}
.dr-ctl button.sel{background:rgba(250,204,21,.25);border-color:#facc15}
.dr-ctl input{width:78px;accent-color:#facc15}`;
  document.head.appendChild(css);
  return {VIEWS, make, solve, proj, facing, panel, setOn, refresh};
})();
