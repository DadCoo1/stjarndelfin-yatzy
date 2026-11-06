/* =====================================================================
   weather.js – väder för slalom och skidskytte
   • slumpas per åk/lopp ur spelets frö, så att alla online ser samma väder
   • sol: blå himmel, låg vintersol, skarpa skuggor, varmt ljus, solreflex
   • mulet: grå himmel, "flatljus" – låg kontrast i snön, mjuka skuggor,
     dis som gör fjällen bleka
   • snöfall: lätt eller tät snö i 3D runt kameran, dimma som äter upp
     det som ligger långt bort, nästan inga skuggor
   ===================================================================== */
'use strict';
const WEATHER = (()=>{
  function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function pick(seed){
    const r=rng((seed|0)*2654435761+97), u=r();
    let w;
    if(u<.4) w={kind:'sun', name:'Sol', icon:'☀️', snow:0, fog:.12, flat:0, shadow:1.5, haze:'rgba(255,236,214,'};
    else if(u<.72) w={kind:'cloud', name:'Mulet', icon:'☁️', snow:r()<.35?.18:0, fog:.32, flat:.16, shadow:.55, haze:'rgba(214,221,232,'};
    else { const heavy=r()<.45; w={kind:'snow', name:heavy?'Tätt snöfall':'Snöfall', icon:'🌨️', snow:heavy?1:.55, fog:heavy?.62:.45, flat:heavy?.26:.2, shadow:.3, haze:'rgba(228,233,240,'}; }
    w.wind=(r()*2-1)*(w.kind==='snow'?2.2:1.2); w.seed=seed;
    if(w.kind==='cloud'&&w.snow) w.name='Mulet, lätt snö';
    return w;
  }
  // tona panoramat (himmel, fjäll, sjö) efter vädret – görs en gång när bakgrunden ritas
  function tintBackdrop(c,hz,w){
    if(!w||w.kind==='sun') return;
    const x=c.getContext('2d'), H=c.height, W=c.width;
    x.save(); x.globalCompositeOperation='source-atop';
    const g=x.createLinearGradient(0,0,0,H);
    if(w.kind==='cloud'){ g.addColorStop(0,'rgba(132,146,166,.82)'); g.addColorStop(hz/H*.85,'rgba(196,204,216,.72)'); g.addColorStop(hz/H,'rgba(214,220,230,.62)'); g.addColorStop(1,'rgba(226,231,238,.35)'); }
    else { g.addColorStop(0,'rgba(170,180,194,.92)'); g.addColorStop(hz/H*.8,'rgba(214,220,229,.9)'); g.addColorStop(hz/H,'rgba(228,232,238,.86)'); g.addColorStop(1,'rgba(234,238,243,.6)'); }
    x.fillStyle=g; x.fillRect(0,0,W,H);
    // molntäcke: mjuka, breda molnbankar
    const r=rng(w.seed*31+5); x.globalCompositeOperation='source-atop';
    for(let i=0;i<14;i++){ const cx=r()*W, cy=r()*hz*.7, rw=W*(.12+r()*.2), rh=hz*(.08+r()*.1); const gg=x.createRadialGradient(cx,cy,1,cx,cy,rw);
      gg.addColorStop(0,w.kind==='snow'?'rgba(236,239,244,.5)':'rgba(170,180,196,.45)'); gg.addColorStop(1,'rgba(170,180,196,0)'); x.fillStyle=gg; x.beginPath(); x.ellipse(cx,cy,rw,rh,0,0,7); x.fill(); }
    x.restore();
  }
  function mkState(){ return {fl:[], t:0}; }
  // efter scenen, före HUD: dis vid horisonten, flatljus, solljus och snöflingor
  function post(ctx,W,H,yH,w,st,dt,speed,opt){
    if(!w) return; opt=opt||{}; st.t+=dt;
    // dis/dimma: tätast vid horisonten, tunnar ut mot förgrunden
    if(w.fog>0 && yH!=null && isFinite(yH)){ const top=Math.max(-H,yH-H*.18), bot=Math.min(H*2,yH+H*(.18+w.fog*.55));
      const g=ctx.createLinearGradient(0,top,0,bot); g.addColorStop(0,w.haze+'0)'); g.addColorStop(.35,w.haze+(w.fog*.95).toFixed(3)+')'); g.addColorStop(1,w.haze+'0)');
      ctx.fillStyle=g; ctx.fillRect(0,top,W,bot-top); }
    if(w.flat>0 && !opt.scope){ ctx.fillStyle=w.haze+w.flat.toFixed(3)+')'; ctx.fillRect(0,0,W,H); }
    if(w.kind==='sun' && !opt.scope){ // varmt låg vintersol och en svag reflex i objektivet
      const sx=W*.16, sy=Math.max(H*.05,(yH??H*.3)-H*.12), g=ctx.createRadialGradient(sx,sy,2,sx,sy,W*.75); g.addColorStop(0,'rgba(255,236,200,.28)'); g.addColorStop(.4,'rgba(255,224,190,.08)'); g.addColorStop(1,'rgba(255,224,190,0)');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      const fl=[[.35,10,'rgba(255,220,170,.10)'],[.55,18,'rgba(180,220,255,.08)'],[.8,8,'rgba(255,240,200,.12)']];
      for(const [k,r,c] of fl){ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(sx+(W/2-sx)*k*2,sy+(H*.55-sy)*k*2,r*(W/390),0,7); ctx.fill(); } }
    if(w.snow>0) flakes(ctx,W,H,w,st,dt,speed,opt);
  }
  // snöflingor i 3D runt kameran: de faller, driver i vinden och strömmar mot kameran när man åker
  function flakes(ctx,W,H,w,st,dt,speed,opt){
    const N=Math.round((opt.scope?80:380)*w.snow), F=Math.min(W,H)*1.05, cy=opt.cy??H*.42;
    const spawn=(far)=>({x:(Math.random()*2-1)*26, y:Math.random()*14-5, z:far?14+Math.random()*30:1+Math.random()*44, ph:Math.random()*6, s:.6+Math.random()*.8});
    while(st.fl.length<N) st.fl.push(spawn(false)); if(st.fl.length>N) st.fl.length=N;
    const v=opt.scope?0:clamp(speed||0,0,25), wind=w.wind;
    ctx.fillStyle='#fff';
    for(let i=0;i<st.fl.length;i++){ const f=st.fl[i];
      f.z-=v*dt; f.y-=(.9+f.s*.6)*dt; f.x+=(wind+Math.sin(st.t*1.3+f.ph)*.5)*dt;
      if(f.z<.6||f.y<-6||Math.abs(f.x)>30){ st.fl[i]=spawn(f.z<.6); continue; }
      const sx=W/2+f.x/f.z*F, sy=cy-f.y/f.z*F; if(sx<-10||sx>W+10||sy<-10||sy>H+10) continue;
      const r=Math.max(.6,Math.min(6,.075*F/f.z*f.s*(opt.scope?.6:1))), a=Math.min(.9,.25+6/f.z);
      ctx.globalAlpha=a;
      if(v>6 && f.z<10){ const sx2=W/2+f.x/(f.z+v*.03)*F, sy2=cy-f.y/(f.z+v*.03)*F; ctx.strokeStyle='#fff'; ctx.lineWidth=r; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx2,sy2); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(sx,sy,r,0,7); ctx.fill(); } }
    ctx.globalAlpha=1;
  }
  // himmelsfärgen överst (ovanför panoramat)
  const sky=w=>!w||w.kind==='sun'?null:w.kind==='cloud'?'#8794a8':'#b3bcc9';
  const shadow=(w,base)=>`rgba(60,90,140,${(base*(w?w.shadow:1)).toFixed(3)})`;
  return {pick, tintBackdrop, mkState, post, shadow, sky};
})();
