/* ================= WGL – världarnas bakgrund i 3D (WebGL) =================
   En filmisk bakgrund bakom hela appen. Kameran står still, så allt kan läggas på ljus och stämning:
   • himmel: färgskiftning med atmosfär, tusentals stjärnor som tindrar, vintergatan, en måne med yta och halo,
     norrsken som böljer i lager (strålar som går rakt upp, grönt nedtill och lila högst upp), moln, nebulosor, planeter
   • landskap: terräng med snö som glittrar i månskenet, granskog, hus med varma fönster som lyser upp snön runt omkring,
     dimma som ligger i dalarna och gör att fjällen bleknar bort i fjärran
   • vatten som speglar himlen, ljusen och fyrverkerierna
   • rörliga 3D-figurer med mjuka former (släde och renar, skidåkare, renar, pariserhjul …) och partiklar (snö, rök, gnistor)
   • efterbehandling: ljus som glöder (bloom), färgsättning, vinjett och lite filmkorn
   Bilden ritas med lägre upplösning om enheten inte hinner med, pausar när appen inte syns eller när ett spel pågår,
   och står stilla när rörelser är avstängda. Finns inte WebGL används de vanliga ritade scenerna (scenes.js). */
const WGL = (() => {
  /* ================= matte ================= */
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  };
  const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const C = c => typeof c === 'string' ? hex(c) : c;
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // värdebrus i JS (terräng)
  function mkNoise(seed) {
    const r = rng(seed), P = new Uint8Array(512), G = new Float32Array(256); for (let i = 0; i < 256; i++) { P[i] = i; G[i] = r(); }
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; } for (let i = 0; i < 256; i++) P[i + 256] = P[i];
    const s = t => t * t * t * (t * (t * 6 - 15) + 10), h = (x, y) => G[P[(P[x & 255] + y) & 511]];
    const n = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = s(xf), v = s(yf);
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
    n.fbm = (x, y, o) => { let f = 0, a = .5, k = 1; for (let i = 0; i < (o || 5); i++) { f += a * n(x * k, y * k); k *= 2.03; a *= .5; const t = x; x = x * .8 - y * .6; y = t * .6 + y * .8; } return f; };
    n.ridge = (x, y, o) => { let f = 0, a = .5, k = 1, w = 1; for (let i = 0; i < (o || 6); i++) { let v = 1 - Math.abs(n(x * k, y * k) * 2 - 1); v *= v; f += a * v * w; w = Math.min(1, v * 1.8); k *= 2.1; a *= .5; const t = x; x = x * .8 - y * .6; y = t * .6 + y * .8; } return f; };
    return n;
  }

  /* ================= GLSL ================= */
  const HDR = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
  const NOISE = `
float hash(vec2 p){ p=fract(p*vec2(.1031,.1103)); p+=dot(p,p.yx+33.33); return fract((p.x+p.y)*p.x*1.7+p.y*.37); }
float hash3(vec3 p){ p=fract(p*.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }
float fbm(vec2 p){ float f=0., a=.5; mat2 m=mat2(.8,.6,-.6,.8); for(int i=0;i<5;i++){ f+=a*noise(p); p=m*p*2.03; a*=.5; } return f; }
float fbm3(vec2 p){ float f=0., a=.5; mat2 m=mat2(.8,.6,-.6,.8); for(int i=0;i<3;i++){ f+=a*noise(p); p=m*p*2.03; a*=.5; } return f; }
`;
  // himlen (låg upplösning): färg, glöd runt ljuset, vintergatan, norrsken, moln, nebulosor, planet
  const SKY_FS = (D) => HDR + D + NOISE + `
varying vec2 vUv; uniform vec3 uR,uU,uF; uniform vec2 uTan; uniform float uT;
uniform vec3 uL, uTop, uHor, uGnd, uGlowC, uMw; uniform vec4 uAur, uCl, uNeb; uniform vec3 uAurC1, uAurC2, uClC;
uniform vec3 uPl; uniform vec4 uPlP; uniform vec3 uPlC1, uPlC2;
vec3 skyBase(vec3 rd){
  float h=rd.y; vec3 c=mix(uHor,uTop,pow(clamp(h,0.,1.),.45));
  c=mix(c,uGnd,smoothstep(0.,-.08,h));
  float sl=max(dot(rd,uL),0.); c+=uGlowC*(pow(sl,6.)*.35+pow(sl,64.)*.6)*smoothstep(-.1,.2,h+.1);
  c+=uGlowC*.18*exp(-abs(h)*14.);
  return c; }
void main(){
  vec3 rd=normalize(uF+(vUv.x*2.-1.)*uTan.x*uR+(vUv.y*2.-1.)*uTan.y*uU);
  vec3 col=skyBase(rd); float glow=0.;
#ifdef MILKY
  { float d=dot(rd,normalize(uMw)); float band=exp(-d*d*9.);
    vec2 q=vec2(atan(rd.z,rd.x)*3.,rd.y*6.+d*4.);
    float dust=fbm(q*1.5+3.); float cl=fbm(q*.9);
    vec3 mw=mix(vec3(.55,.6,.85),vec3(.95,.85,.75),cl)*band*(.25+cl*.9)*(1.-smoothstep(.45,.8,dust)*.75);
    col+=mw*.22*smoothstep(-.02,.25,rd.y); }
#endif
#ifdef NEBULA
  { vec2 q=vec2(atan(rd.z,rd.x),asin(clamp(rd.y,-1.,1.)))*vec2(2.2,2.6);
    float n1=fbm(q*1.3+vec2(uT*.004,0.)), n2=fbm(q*2.6-4.1+n1*1.6);
    vec3 nc=mix(uNeb.rgb,vec3(.15,.55,.9),smoothstep(.35,.75,n2));
    float m=smoothstep(.42,.9,n1)*(.6+.4*n2);
    col+=nc*m*uNeb.a; glow+=m*uNeb.a*.25; }
#endif
#ifdef AURORA
  if(rd.y>0.){
    vec3 acc=vec3(0.); float jit=hash(vUv*vec2(731.,517.)+fract(uT*.37));
    for(int i=0;i<34;i++){
      float fi=float(i)+jit, h=1.+fi*.055, t=h/max(rd.y,.04); vec2 p=rd.xz*t*uAur.y;
      p+=vec2(uT*.012,-uT*.006);
      float w=noise(p*.3+vec2(0.,uT*.02))*4.+noise(p*.9-uT*.03)*1.2;
      float band=abs(sin(p.x*.55+w+p.y*.25));
      float c=pow(1.-band,9.)*smoothstep(.2,.75,noise(p*.18+uT*.008));
      c*=.35+.65*noise(vec2(p.x*9.+p.y*2.,fi*.25+uT*.5));
      vec3 cc=mix(uAurC1,uAurC2,smoothstep(8.,30.,fi));
      acc+=cc*c*exp(-fi*.085)*.09;
    }
    acc*=smoothstep(.0,.15,rd.y)*uAur.x;
    col+=acc; glow+=dot(acc,vec3(.33))*1.4;
  }
#endif
#ifdef CLOUDS
  if(rd.y>0.){ float t=(1.)/(rd.y+.05); vec2 p=rd.xz*t*uCl.y+vec2(uT*uCl.z,0.);
    float d=fbm(p*.6); d=smoothstep(uCl.w,uCl.w+.35,d)*uCl.x*smoothstep(0.,.25,rd.y);
    float lit=pow(max(dot(rd,uL),0.),4.)*.6+.4;
    col=mix(col,uClC*lit+uGlowC*.2*lit,d); }
#endif
#ifdef PLANET
  { vec3 pc=normalize(uPl); float r=uPlP.x; float d=acos(clamp(dot(rd,pc),-1.,1.));
    vec3 t1=normalize(cross(pc,vec3(0.,1.,0.))), t2=cross(t1,pc);
    vec2 l=vec2(dot(rd,t1),dot(rd,t2))/r;
    // ring (lutad ellips)
    float ca=cos(uPlP.y), sa=sin(uPlP.y); vec2 rl=vec2(ca*l.x-sa*l.y, sa*l.x+ca*l.y); rl.y/=uPlP.z;
    float rr=length(rl); float ring=smoothstep(1.35,1.42,rr)*smoothstep(2.35,2.22,rr)*(.6+.4*sin(rr*21.))*(.6+.4*sin(rr*7.));
    float behind=step(0.,rl.y);
    if(d<r){ vec3 n=vec3(l,sqrt(max(0.,1.-dot(l,l))));
      float lam=clamp(dot(n,normalize(vec3(.6,.4,.7))),0.,1.);
      float bands=sin((l.y*1.0+.15*l.x)*16.+fbm(l*3.)*3.)*.5+.5;
      vec3 pcol=mix(uPlC1,uPlC2,bands)*(lam*.95+.05);
      pcol+=uPlC2*pow(1.-n.z,3.)*.6;
      if(behind<.5) pcol=mix(pcol,uPlC2*1.2,ring*.8);
      col=pcol; glow=max(glow,.05);
    } else {
      float rim=exp(-(d-r)/r*9.); col+=uPlC2*rim*.5; glow+=rim*.3;
      col+=mix(uPlC1,vec3(1.),.4)*ring*.38; }
  }
#endif
  gl_FragColor=vec4(col,glow);
}`;
  // himlen i full upplösning: den mjuka himlen skalas upp, stjärnor och månen läggs på skarpt
  const SKYC_FS = (D) => HDR + D + NOISE + `
varying vec2 vUv; uniform sampler2D uSky; uniform vec3 uR,uU,uF; uniform vec2 uTan,uRes; uniform float uT, uStar;
uniform vec3 uMoon, uMoonC, uMw; uniform float uMoonR; uniform vec3 uL;
float starLayer(vec3 rd, float N, float dens, float seed){
  vec2 s=vec2(atan(rd.z,rd.x),asin(clamp(rd.y,-1.,1.)))*N;
  vec2 c=floor(s), f=fract(s);
  float h=hash(c+seed); if(h>dens) return 0.;
  vec2 pos=vec2(hash(c+seed+7.1),hash(c+seed+3.3))*.8+.1;
  float px=(uRes.y/(2.*uTan.y))/N;       // cellens storlek i pixlar
  float d=length(f-pos)*px;
  float sz=.55+pow(hash(c+seed+1.7),8.)*1.6;
  float tw=.65+.35*sin(uT*(1.5+hash(c+9.)*4.)+h*40.);
  return exp(-d*d/(sz*sz))*(.3+pow(hash(c+seed+5.),3.)*1.4)*tw;
}
void main(){
  vec4 sky=texture2D(uSky,vUv);
  vec3 rd=normalize(uF+(vUv.x*2.-1.)*uTan.x*uR+(vUv.y*2.-1.)*uTan.y*uU);
  vec3 col=sky.rgb; float glow=sky.a;
  float hz=smoothstep(-.01,.12,rd.y);
  if(uStar>0.){
    float mwb=0.;
#ifdef MILKY
    { float d=dot(rd,normalize(uMw)); mwb=exp(-d*d*9.); }
#endif
    float s=starLayer(rd,260.,.11+mwb*.25,0.)+starLayer(rd,520.,.05+mwb*.3,17.)*.7+starLayer(rd,90.,.05,41.)*1.3;
    float tint=hash(floor(vec2(atan(rd.z,rd.x),rd.y)*260.));
    vec3 sc=mix(vec3(.75,.85,1.),vec3(1.,.85,.7),tint);
    col+=sc*s*uStar*hz*(1.-glow*.6); glow+=s*uStar*.6*hz;
  }
#ifdef MOON
  { vec3 m=normalize(uMoon); float d=acos(clamp(dot(rd,m),-1.,1.));
    vec3 t1=normalize(cross(m,vec3(0.,1.,0.))), t2=cross(t1,m); vec2 l=vec2(dot(rd,t1),dot(rd,t2))/uMoonR;
    float halo=exp(-d/uMoonR*1.1)*.35+exp(-d/uMoonR*.25)*.12;
    col+=uMoonC*halo*.55; glow+=halo*.9;
    if(d<uMoonR*1.02){ float rr=dot(l,l); vec3 n=vec3(l,sqrt(max(0.,1.-rr)));
      float mar=fbm(l*2.3+1.7), cr=fbm(l*9.+4.);
      vec3 mc=uMoonC*(.82-smoothstep(.45,.7,mar)*.3+cr*.15);
      float limb=.55+.45*n.z;
      float a=smoothstep(1.02,.98,sqrt(rr));
      col=mix(col,mc*limb*1.15,a); glow=mix(glow,1.,a); }
  }
#endif
  gl_FragColor=vec4(col,glow);
}`;
  const QUAD_VS = `attribute vec2 aP; varying vec2 vUv; void main(){ vUv=aP*.5+.5; gl_Position=vec4(aP,0.,1.); }`;
  // ytor: terräng, hus, träd, figurer – ljus från månen/solen, himmelsljus, lampor i närheten, dimma
  const MESH_VS = `attribute vec3 aP,aN,aC; attribute vec2 aM; uniform mat4 uVP,uLVP; uniform float uClipY,uFlip;
varying vec3 vP,vN,vC; varying vec2 vM; varying vec4 vLP;
void main(){ vec3 p=aP; vP=p; vN=aN; vC=aC; vM=aM; vLP=uLVP*vec4(p,1.); vec4 q=uVP*vec4(p.x,p.y*uFlip,p.z,1.); gl_Position=q; }`;
  const DEPTH_VS = `attribute vec3 aP; uniform mat4 uLVP; varying float vD; void main(){ vec4 q=uLVP*vec4(aP,1.); vD=q.z*.5+.5; gl_Position=q; }`;
  const DEPTH_FS = HDR + `varying float vD; void main(){ vec4 e=fract(vD*vec4(1.,255.,65025.,16581375.)); e-=e.yzww*vec4(1./255.,1./255.,1./255.,0.); gl_FragColor=e; }`;
  const MESH_FS = (D) => HDR + D + NOISE + `
varying vec3 vP,vN,vC; varying vec2 vM; varying vec4 vLP;
uniform vec3 uCam,uL,uLc,uSkyA,uGndA,uFogC,uHaze; uniform vec4 uFog; uniform float uT,uClipY,uEm;
uniform vec4 uPL[NL]; uniform vec4 uPC[NL]; uniform sampler2D uShadow; uniform vec2 uShPx;
float unpack(vec4 c){ return dot(c,vec4(1.,1./255.,1./65025.,1./16581375.)); }
float shadow(float ndl){
#ifdef SHADOW
  vec3 s=vLP.xyz/vLP.w*.5+.5; if(s.x<0.||s.x>1.||s.y<0.||s.y>1.) return 1.;
  float b=.0012+.003*(1.-ndl), z=s.z-b, r=0.;
  r+=step(z,unpack(texture2D(uShadow,s.xy)));
  r+=step(z,unpack(texture2D(uShadow,s.xy+vec2(uShPx.x,0.))));
  r+=step(z,unpack(texture2D(uShadow,s.xy-vec2(uShPx.x,0.))));
  r+=step(z,unpack(texture2D(uShadow,s.xy+vec2(0.,uShPx.y))));
  r+=step(z,unpack(texture2D(uShadow,s.xy-vec2(0.,uShPx.y))));
  return r/5.;
#else
  return 1.;
#endif
}
void main(){
  if(vP.y<uClipY) discard;
  float m=vM.x, seed=vM.y; vec3 N=normalize(vN); vec3 Vd=uCam-vP; float dist=length(Vd); vec3 Vn=Vd/dist;
  vec3 a=vC, col; float glow=0.;
  if(m>1.5&&m<2.5){ col=a*uEm; glow=.9; }                                            // självlysande
  else if(m>5.5&&m<6.5){ float on=step(.35,fract(uT*(.35+seed*.5)+seed*7.)); col=a*uEm*(.25+.75*on); glow=.95*(.3+.7*on); }   // blinkande ljus
  else {
    if(m>8.5&&m<9.5){ a*=1.-.07*smoothstep(.35,.5,abs(fract(vP.x*1.3)-.5))*smoothstep(45.,8.,dist); m=1.; }      // pistad snö (manchester)
    if(m>.5&&m<1.5){                                                                   // sten i branterna, långt bort
      float rk=smoothstep(.5,.8,1.-N.y+(fbm3(vP.xz*.03+vP.y*.02)-.5)*.7)*smoothstep(25.,60.,vP.y);
      a=mix(a,vec3(.16,.17,.21)*(.7+.6*noise(vP.xz*.08)),rk); if(rk>.5) m=0.;
    }
    if(m>.5&&m<1.5){                                                                   // snöns små drivor och vågor
      vec2 q=vP.xz*.35; float e=.08; float h0=fbm3(q), hx=fbm3(q+vec2(e,0.)), hz=fbm3(q+vec2(0.,e));
      float k=smoothstep(140.,8.,dist)*1.6; N=normalize(N+vec3(-(hx-h0)/e,0.,-(hz-h0)/e)*k*.35); }
    if(m>7.5&&m<8.5){ float pl2=fract(dot(vP,normalize(vec3(-N.z,0.,N.x)))*2.2); a*=.86+.14*smoothstep(.0,.08,pl2)*smoothstep(1.,.92,pl2)+(noise(vP.xy*vec2(3.,.4)+vP.z)-.5)*.12; }   // träpanel
    float wrap=(m>3.5&&m<4.5)?.35:(m>.5&&m<1.5?.18:0.);
    float ndl=dot(N,uL), nl=max((ndl+wrap)/(1.+wrap),0.)*shadow(ndl);
    vec3 lit=uLc*nl+mix(uGndA,uSkyA,N.y*.5+.5);
    vec3 pl=vec3(0.);
    for(int i=0;i<NL;i++){ vec3 d=uPL[i].xyz-vP; float r2=dot(d,d); float att=uPC[i].w/(1.+r2*uPL[i].w); pl+=uPC[i].rgb*att*(max(dot(N,normalize(d)),0.)*.8+.2); }
    lit+=pl;
    if(m>2.5&&m<3.5){                                                                  // fasad med fönster
      vec3 tg=normalize(vec3(-N.z,0.,N.x)); float u=dot(vP,tg)/2.6, v=(vP.y-.4)/3.1;
      vec2 cell=floor(vec2(u,v)), f=fract(vec2(u,v));
      float win=step(.25,f.x)*step(f.x,.75)*step(.3,f.y)*step(f.y,.8)*step(.6,v)*step(abs(N.y),.5);
      float on=step(.6,hash(cell+seed*13.));
      vec3 wc=mix(vec3(1.,.78,.45),vec3(.75,.85,1.),step(.8,hash(cell+seed*5.)));
      col=a*lit+win*(on*wc*uEm*(.45+.3*hash(cell))+ (1.-on)*vec3(.04,.05,.08));
      glow=win*on*.22;
    } else col=a*lit;
    if(m>.5&&m<1.5){                                                                   // snö: blått i skuggan, glitter
      col+=vec3(.015,.03,.07)*(1.-nl);
      vec2 gp=vP.xz*38.; vec2 g=floor(gp); float h=hash(g);
      vec2 o=vec2(hash(g+3.1),hash(g+7.7)); float dd=length(fract(gp)-o);
      float dot1=smoothstep(.22,.0,dd)*step(.93,h);
      float sp=pow(max(dot(reflect(-uL,N),Vn),0.),2.)*(.4+.6*sin(uT*2.5+h*60.))*shadow(ndl);
      float spp=0.; for(int i=0;i<NL;i++){ vec3 d=uPL[i].xyz-vP; spp+=uPC[i].w/(1.+dot(d,d)*uPL[i].w); }
      float spk=dot1*(sp*1.3+spp*1.2)*smoothstep(70.,6.,dist);
      col+=vec3(1.)*spk; glow+=spk*.7;
    }
    if(m>4.5&&m<5.5){ vec3 hv=normalize(uL+Vn); col+=uLc*pow(max(dot(N,hv),0.),40.)*.8; }   // blank yta
    if(m>6.5&&m<7.5){ col=a*lit+a*uEm*.6; glow=.4; }                                 // glödande (lava, glöd)
  }
  float fd=1.-exp(-dist*uFog.x);
  fd*=mix(1.,exp(-max(vP.y-uFog.z,0.)*uFog.y),.85);
  fd=clamp(fd*uFog.w,0.,1.);
  vec3 fc=uFogC+uHaze*pow(max(dot(-Vn,uL),0.),6.);
  col=mix(col,fc,fd); glow*=1.-fd*.8;
  gl_FragColor=vec4(col,glow);
}`;
  // vatten: vågor, spegling (ritad uppochned i en egen bild), månglitter, dimma
  const WATER_FS = (D) => HDR + D + NOISE + `
varying vec3 vP,vN,vC; varying vec2 vM;
uniform vec3 uCam,uL,uLc,uFogC,uDeep; uniform vec4 uFog,uWv; uniform float uT; uniform sampler2D uRefl; uniform vec2 uRes;
void main(){
  vec3 Vd=uCam-vP; float dist=length(Vd); vec3 Vn=Vd/dist;
  vec2 p=vP.xz; float k=uWv.y; float fade=1./(1.+dist*.03);
  vec2 g=vec2(0.);
  g+=vec2(.8,.6)*cos(dot(p,vec2(.8,.6))*k*1.0+uT*1.2)*.6;
  g+=vec2(-.5,.86)*cos(dot(p,vec2(-.5,.86))*k*1.7+uT*1.6)*.35;
  g+=vec2(.2,-.98)*cos(dot(p,vec2(.2,-.98))*k*3.1+uT*2.3)*.2;
  float nx=noise(p*k*2.+uT*.6)-.5, nz=noise(p.yx*k*2.3-uT*.5)-.5; g+=vec2(nx,nz)*.6;
  vec3 n=normalize(vec3(-g.x*uWv.x*fade,1.,-g.y*uWv.x*fade));
  vec2 sc=gl_FragCoord.xy/uRes;
  vec4 refl=texture2D(uRefl,clamp(sc+n.xz*uWv.z*fade,.001,.999));
  float fr=.03+.97*pow(1.-max(dot(n,Vn),0.),5.);
  fr=max(fr,uWv.w);
  vec3 col=mix(uDeep,refl.rgb,fr);
  float sp=pow(max(dot(reflect(-uL,n),Vn),0.),420.); col+=uLc*sp*.9; float glow=refl.a*fr*.7+sp*.5;
  float fd=1.-exp(-dist*uFog.x); fd=clamp(fd*uFog.w,0.,1.); col=mix(col,uFogC,fd*.6);
  gl_FragColor=vec4(col,glow*(1.-fd*.5));
}`;
  // partiklar: mjuka punkter (snö, rök, gnistor, fyrverkerier)
  const PART_VS = `attribute vec3 aP; attribute vec4 aC; attribute float aS; uniform mat4 uVP; uniform float uPx,uFlip,uClipY; varying vec4 vC; varying float vY;
void main(){ vec4 q=uVP*vec4(aP.x,aP.y*uFlip,aP.z,1.); gl_Position=q; gl_PointSize=clamp(aS*uPx/max(q.w,.1),1.,64.); vC=aC; vY=aP.y; }`;
  const PART_FS = HDR + `varying vec4 vC; varying float vY; uniform float uAdd,uClipY;
void main(){ if(vY<uClipY) discard; vec2 d=gl_PointCoord-.5; float r=dot(d,d)*4.; float a=exp(-r*3.)*step(r,1.);
  if(uAdd>.5) gl_FragColor=vec4(vC.rgb*vC.a*a, vC.a*a*.9); else gl_FragColor=vec4(vC.rgb, vC.a*a); }`;
  // efterbehandling
  const BRIGHT_FS = HDR + `varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uPx; uniform float uK;
vec3 s(vec2 o){ vec4 c=texture2D(uTex,vUv+o*uPx); return c.rgb*c.a*uK+max(c.rgb-.82,0.)*.6; }
void main(){ gl_FragColor=vec4((s(vec2(-1.,-1.))+s(vec2(1.,-1.))+s(vec2(-1.,1.))+s(vec2(1.,1.)))*.25,1.); }`;
  const BLUR_FS = HDR + `varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir;
void main(){ vec3 c=texture2D(uTex,vUv).rgb*.227;
  c+=(texture2D(uTex,vUv+uDir*1.38).rgb+texture2D(uTex,vUv-uDir*1.38).rgb)*.316;
  c+=(texture2D(uTex,vUv+uDir*3.23).rgb+texture2D(uTex,vUv-uDir*3.23).rgb)*.07; gl_FragColor=vec4(c,1.); }`;
  const FINAL_FS = HDR + NOISE + `varying vec2 vUv; uniform sampler2D uTex,uB1,uB2; uniform vec2 uPx; uniform float uT; uniform vec4 uGr; uniform vec3 uTint; uniform float uBk;
vec3 fxaa(){ vec3 c=texture2D(uTex,vUv).rgb; vec3 n=texture2D(uTex,vUv+vec2(0.,uPx.y)).rgb, s=texture2D(uTex,vUv-vec2(0.,uPx.y)).rgb, e=texture2D(uTex,vUv+vec2(uPx.x,0.)).rgb, w=texture2D(uTex,vUv-vec2(uPx.x,0.)).rgb;
  vec3 L=vec3(.299,.587,.114); float lc=dot(c,L), ln=dot(n,L), ls=dot(s,L), le=dot(e,L), lw=dot(w,L);
  float mn=min(lc,min(min(ln,ls),min(le,lw))), mx=max(lc,max(max(ln,ls),max(le,lw)));
  if(mx-mn<max(.04,mx*.12)) return c;
  vec2 dir=normalize(vec2(-(ln-ls),(le-lw))+1e-5)*uPx;
  return (texture2D(uTex,vUv+dir*.5).rgb+texture2D(uTex,vUv-dir*.5).rgb+c)/3.; }
void main(){
  vec3 c=fxaa();
  vec3 b=texture2D(uB1,vUv).rgb*.9+texture2D(uB2,vUv).rgb*1.25;
  c+=b*uBk;
  c*=uGr.x;
  c=c/(1.+c*.18)*1.18;                        // mjuk "filmisk" toppkompression
  c=pow(max(c,0.),vec3(uGr.y));
  float l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l),c,uGr.z);
  c*=uTint;
  vec2 q=vUv-.5; c*=1.-dot(q,q)*uGr.w;        // vinjett
  c+=(hash(vUv*913.+fract(uT*7.))-.5)*.018;    // filmkorn
  gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`;

  /* ================= geometri ================= */
  // hörn: läge 3, normal 3, färg 3, material 2 (typ, frö) = 11 flyttal
  const FL = 11;
  function Mesh(cap) { this.f = new Float32Array((cap || 8192) * FL); this.n = 0; }
  Mesh.prototype = {
    reset() { this.n = 0; return this; },
    need(k) { if ((this.n + k) * FL > this.f.length) { const g = new Float32Array(Math.max(this.f.length * 2, (this.n + k) * FL)); g.set(this.f.subarray(0, this.n * FL)); this.f = g; } },
    v(p, n, c, m, s) { const f = this.f, o = this.n * FL; f[o] = p[0]; f[o + 1] = p[1]; f[o + 2] = p[2]; f[o + 3] = n[0]; f[o + 4] = n[1]; f[o + 5] = n[2]; f[o + 6] = c[0]; f[o + 7] = c[1]; f[o + 8] = c[2]; f[o + 9] = m || 0; f[o + 10] = s || 0; this.n++; },
    tri(a, b, c, col, m, s, na, nb, nc) { col = C(col); this.need(3); let n = V.norm(V.cross(V.sub(b, a), V.sub(c, a))); if (!na) { na = nb = nc = n; } this.v(a, na, col, m, s); this.v(b, nb, col, m, s); this.v(c, nc, col, m, s); },
    quad(a, b, c, d, col, m, s) { this.tri(a, b, c, col, m, s); this.tri(a, c, d, col, m, s); },
    // låda med valfri rotation runt y
    box(cx, cy, cz, w, h, d, col, m, s, ry) {
      const cr = Math.cos(ry || 0), sr = Math.sin(ry || 0), P = (x, y, z) => [cx + x * cr - z * sr, cy + y, cz + x * sr + z * cr];
      const x0 = -w / 2, x1 = w / 2, y0 = 0, y1 = h, z0 = -d / 2, z1 = d / 2;
      this.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), col, m, s); this.quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), col, m, s);
      this.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), col, m, s); this.quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), col, m, s);
      this.quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), col, m, s);
    },
    // mjuk ellipsoid (rundade kroppar)
    ellip(c, r, col, m, s, seg, rot) {
      col = C(col); seg = seg || 12; const rs = seg, cs = seg * 2, R = rot || null;
      const pt = (i, j) => { const th = i / rs * Math.PI, ph = j / cs * Math.PI * 2; let n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
        let p = [n[0] * r[0], n[1] * r[1], n[2] * r[2]]; let nn = V.norm([n[0] / r[0], n[1] / r[1], n[2] / r[2]]);
        if (R) { p = R(p); nn = R(nn); } return [V.add(c, p), nn]; };
      for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) { const a = pt(i, j), b = pt(i + 1, j), d = pt(i + 1, j + 1), e = pt(i, j + 1);
        this.need(6); this.tri(a[0], b[0], d[0], col, m, s, a[1], b[1], d[1]); this.tri(a[0], d[0], e[0], col, m, s, a[1], d[1], e[1]); }
    },
    // rör längs en linje med radie r1→r2 (lemmar, stammar, horn)
    tube(a, b, r1, r2, col, m, s, seg, cap) {
      col = C(col); seg = seg || 8; const ax = V.norm(V.sub(b, a)); let up = Math.abs(ax[1]) > .9 ? [1, 0, 0] : [0, 1, 0];
      const u = V.norm(V.cross(ax, up)), w = V.cross(u, ax), L = Math.hypot(...V.sub(b, a)), sl = (r1 - r2) / L;
      for (let i = 0; i < seg; i++) { const t0 = i / seg * Math.PI * 2, t1 = (i + 1) / seg * Math.PI * 2;
        const d0 = V.add(V.mul(u, Math.cos(t0)), V.mul(w, Math.sin(t0))), d1 = V.add(V.mul(u, Math.cos(t1)), V.mul(w, Math.sin(t1)));
        const n0 = V.norm(V.add(d0, V.mul(ax, sl))), n1 = V.norm(V.add(d1, V.mul(ax, sl)));
        const p00 = V.add(a, V.mul(d0, r1)), p01 = V.add(a, V.mul(d1, r1)), p10 = V.add(b, V.mul(d0, r2)), p11 = V.add(b, V.mul(d1, r2));
        this.need(6); this.tri(p00, p10, p11, col, m, s, n0, n0, n1); this.tri(p00, p11, p01, col, m, s, n0, n1, n1);
        if (cap) { this.tri(b, p11, p10, col, m, s, ax, ax, ax); } }
    },
    cone(a, h, r, col, m, s, seg) { this.tube(a, V.add(a, [0, h, 0]), r, .001, col, m, s, seg || 10); },
    sphere(c, r, col, m, s, seg) { this.ellip(c, [r, r, r], col, m, s, seg || 6); }
  };

  /* ================= byggstenar för scener ================= */
  // terräng: höjdfunktion → rutnät med mjuka normaler; färg och material väljs av en funktion (snö, sten, gräs)
  function terrain(M, x0, x1, z0, z1, nx, nz, H, paint) {
    const dx = (x1 - x0) / nx, dz = (z1 - z0) / nz, P = [], N = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * dx, z = z0 + j * dz; P.push([x, H(x, z), z]); }
    const at = (i, j) => P[Math.max(0, Math.min(nz, j)) * (nx + 1) + Math.max(0, Math.min(nx, i))];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const l = at(i - 1, j), r = at(i + 1, j), d = at(i, j - 1), u = at(i, j + 1);
      N.push(V.norm(V.cross(V.sub(u, d), V.sub(r, l)))); }
    const idx = (i, j) => j * (nx + 1) + i;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
      const tri = (p, q, r) => { const ctr = V.mul(V.add(V.add(P[p], P[q]), P[r]), 1 / 3), nn = V.norm(V.add(V.add(N[p], N[q]), N[r])), pp = paint(ctr, nn);
        M.need(3); M.v(P[p], N[p], pp[0], pp[1], pp[2]); M.v(P[q], N[q], pp[0], pp[1], pp[2]); M.v(P[r], N[r], pp[0], pp[1], pp[2]); };
      tri(a, d, c); tri(a, c, b);
    }
  }
  // gran: grenvåningar som kjolar med hängande grenspetsar och snö ovanpå varje våning
  function fir(M, x, y, z, h, snow, seed, col, lod) {
    const r = rng(seed * 997 + 13), tc = C(col || '#173d2c'), sc = [.88, .92, .99], K = lod > 1 ? 7 : lod ? 9 : 13;
    M.tube([x, y - .3, z], [x, y + h * .3, z], h * .04, h * .025, '#3a2618', 0, 0, 5);
    const tiers = lod > 1 ? 4 : lod ? 5 : 6 + Math.floor(r() * 2);
    const skirt = (by, R, hh, colr, mat, droop, jag) => { const top = [x, by + hh, z], ring = [];
      for (let k = 0; k <= K; k++) { const a = (k % K) / K * Math.PI * 2 + (k % K ? 0 : 0), tip = (k % 2 === 0), rr = R * (tip ? 1 : jag) * (.88 + r() * .24);
        ring.push([x + Math.cos(a) * rr, by - (tip ? droop * R : 0), z + Math.sin(a) * rr]); }
      ring[K] = ring[0];
      for (let k = 0; k < K; k++) { const p = ring[k], q = ring[k + 1], np = V.norm([(p[0] - x) * hh, R * .9, (p[2] - z) * hh]), nq = V.norm([(q[0] - x) * hh, R * .9, (q[2] - z) * hh]);
        M.tri(top, p, q, colr, mat, seed, [0, 1, 0], np, nq); } };
    for (let i = 0; i < tiers; i++) { const t = i / tiers, base = y + h * (.14 + t * .74), R = h * (.4 - t * .32) * (.9 + r() * .2), hh = h * (.26 - t * .06);
      const shade = .72 + r() * .4 - t * .05, c = [tc[0] * shade, tc[1] * shade, tc[2] * shade];
      skirt(base, R, hh, c, 4, .16, .62);
      if (snow) skirt(base + hh * .32, R * .78, hh * .62, sc, 1, .05, .8); }
    M.tube([x, y + h * .86, z], [x, y + h * 1.02, z], h * .04, .002, snow ? sc : tc, snow ? 1 : 4, seed, 6);
  }
  // lövträd / blomträd: stam och klot av blad
  function blobTree(M, x, y, z, h, cols, seed, mat) {
    const r = rng(seed * 31 + 7); M.tube([x, y - .2, z], [x + (r() - .5) * h * .1, y + h * .55, z], h * .05, h * .03, '#3b2a22', 0, 0, 6);
    for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, d = r() * h * .28; M.ellip([x + Math.cos(a) * d, y + h * (.6 + r() * .25), z + Math.sin(a) * d], [h * (.2 + r() * .12), h * (.16 + r() * .08), h * (.2 + r() * .12)], cols[Math.floor(r() * cols.length)], mat == null ? 4 : mat, seed, 7); }
  }
  // hus med sadeltak, träpanel, vita knutar och fönsterfoder, snö på taket och drivor runt om; fönstren lyser och lyser upp snön
  function house(M, L, x, y, z, w, d, h, ry, wall, roof, snow, lights) {
    const cr = Math.cos(ry), sr = Math.sin(ry), P = (a, b, c) => [x + a * cr - c * sr, y + b, z + a * sr + c * cr], white = '#f3f1ea';
    M.box(x, y - .8, z, w + .3, .9, d + .3, '#5a5a62', 0, 0, ry);                               // grund
    M.box(x, y, z, w, h, d, wall, 8, 0, ry);
    [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].forEach(([a, c]) => { const p = P(a, 0, c); M.box(p[0], y, p[2], .2, h, .2, white, 0, 0, ry); });
    const rh = w * .42, ov = .45, top = h + rh;
    const A = P(-w / 2 - ov, h - .15, -d / 2 - ov), B = P(w / 2 + ov, h - .15, -d / 2 - ov), Cc = P(w / 2 + ov, h - .15, d / 2 + ov), D = P(-w / 2 - ov, h - .15, d / 2 + ov), T1 = P(0, top, -d / 2 - ov), T2 = P(0, top, d / 2 + ov);
    M.quad(A, T1, T2, D, roof); M.quad(T1, B, Cc, T2, roof);
    // vindskivor
    M.tube(P(-w / 2 - ov, h - .15, d / 2 + ov + .02), P(0, top, d / 2 + ov + .02), .09, .09, white, 0, 0, 4); M.tube(P(0, top, d / 2 + ov + .02), P(w / 2 + ov, h - .15, d / 2 + ov + .02), .09, .09, white, 0, 0, 4);
    if (snow) { const up = [0, .16, 0], sn = '#eef3fc';
      M.quad(V.add(A, up), V.add(T1, up), V.add(T2, up), V.add(D, up), sn, 1, 0); M.quad(V.add(T1, up), V.add(B, up), V.add(Cc, up), V.add(T2, up), sn, 1, 0);
      M.tube(V.add(A, [0, .05, 0]), V.add(D, [0, .05, 0]), .2, .2, sn, 1, 0, 6); M.tube(V.add(B, [0, .05, 0]), V.add(Cc, [0, .05, 0]), .2, .2, sn, 1, 0, 6);
      for (const c of [d / 2 + .6, -d / 2 - .6]) M.ellip(P(0, -.05, c), [w * .62, .38, .9], sn, 1, 0, 8, v => [v[0] * cr - v[2] * sr, v[1], v[0] * sr + v[2] * cr]); }
    M.tri(P(-w / 2, h, d / 2), P(w / 2, h, d / 2), P(0, top - .1, d / 2), wall, 8); M.tri(P(w / 2, h, -d / 2), P(-w / 2, h, -d / 2), P(0, top - .1, -d / 2), wall, 8);
    const ch = P(w * .22, 0, 0); M.box(ch[0], y + h, ch[2], .7, rh + .9, .7, '#6b5552', 0, 0, ry); if (snow) M.box(ch[0], y + h + rh + .9, ch[2], .82, .16, .82, '#eef3fc', 1, 0, ry);
    // fönster med foder och spröjs: glaset lyser varmt
    const win = (a, b, c, side, ww, hh) => { const q = (u, v, o) => P(a + u * side, b + v, c + side * o);
      M.quad(q(-ww, -hh, .02), q(ww, -hh, .02), q(ww, hh, .02), q(-ww, hh, .02), '#ffcf86', 2);
      const fr = .09, f = (u0, v0, u1, v1) => M.quad(q(u0, v0, .07), q(u1, v0, .07), q(u1, v1, .07), q(u0, v1, .07), white);
      f(-ww - fr, -hh - fr, ww + fr, -hh); f(-ww - fr, hh, ww + fr, hh + fr); f(-ww - fr, -hh, -ww, hh); f(ww, -hh, ww + fr, hh); f(-fr / 2, -hh, fr / 2, hh); f(-ww, -fr / 2, ww, fr / 2);
      f(-ww - fr * 2, -hh - fr * 2.2, ww + fr * 2, -hh - fr);
      const nn = side > 0 ? [-sr, 0, cr] : [sr, 0, -cr]; if (lights && L) L.push([V.add(P(a, b, c), V.mul(nn, 1.4)), [1, .68, .36], 1.35, .4]); };
    win(-w * .27, h * .5, d / 2, 1, .48, .58); win(w * .27, h * .5, d / 2, 1, .48, .58); win(0, h * .5, -d / 2, -1, .48, .58);
    // dörr med foder och en liten lampa
    const dq = (u, v, o) => P(-w * .02 + u, v, d / 2 + o); M.quad(dq(-.48, 0, .03), dq(.48, 0, .03), dq(.48, 2.0, .03), dq(-.48, 2.0, .03), '#3e2620');
    M.quad(dq(-.6, 2.0, .06), dq(.6, 2.0, .06), dq(.6, 2.14, .06), dq(-.6, 2.14, .06), white); M.sphere(dq(.75, 2.2, .2), .1, '#ffe2a6', 2, 0, 5);
    return P(w * .22, h + rh + 1.1, 0);
  }

  /* ================= GL-uppsättning ================= */
  let gl = null, cv = null, isGL2 = false, state = null, raf = 0, lastT = 0, scale = 1, slow = 0, frameN = 0;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const e = gl.getShaderInfoLog(s); console.warn('WGL shader', e, src.split('\n').slice(0, 5).join('\n')); throw new Error(e); } return s; }
  function prog(vs, fs, attrs) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); (attrs || []).forEach((a, i) => gl.bindAttribLocation(p, i, a)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const U = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i), nm = u.name.replace(/\[0\]$/, ''); U[nm] = gl.getUniformLocation(p, u.name); } return { p, U }; }
  function rt(w, h, depth) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    let d = null; if (depth) { d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); if (isGL2) { gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d); } else { gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, d); } }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); return { t, f, d, w, h }; }
  function freeRT(r) { if (!r) return; gl.deleteTexture(r.t); gl.deleteFramebuffer(r.f); if (r.d) gl.deleteRenderbuffer(r.d); }
  function vbo(arr, dyn) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, dyn ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); return b; }
  function meshAttribs() { const s = FL * 4; gl.vertexAttribPointer(0, 3, gl.FLOAT, false, s, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, s, 12); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, s, 24); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, s, 36); for (let i = 0; i < 4; i++) gl.enableVertexAttribArray(i); }
  function quad() { gl.bindBuffer(gl.ARRAY_BUFFER, state.quad); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0); for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i); gl.drawArrays(gl.TRIANGLES, 0, 6); }

  /* ================= kamera ================= */
  function camera(cfg, w, h) {
    const asp = w / h, fy = (cfg.fov || 50) * Math.PI / 180, ty = Math.tan(fy / 2), tx = ty * asp, pitch = (cfg.pitch || 0) * Math.PI / 180, yaw = (cfg.yaw || 0) * Math.PI / 180;
    const F = V.norm([Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]), Rr = V.norm(V.cross(F, [0, 1, 0])), U = V.cross(Rr, F), E = cfg.eye || [0, 5, 0];
    const n = 1, f = 6000, view = [Rr[0], U[0], -F[0], 0, Rr[1], U[1], -F[1], 0, Rr[2], U[2], -F[2], 0, -V.dot(Rr, E), -V.dot(U, E), V.dot(F, E), 1];
    const proj = [1 / tx, 0, 0, 0, 0, 1 / ty, 0, 0, 0, 0, -(f + n) / (f - n), -1, 0, 0, -2 * f * n / (f - n), 0];
    const vp = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += proj[k * 4 + j] * view[i * 4 + k]; vp[i * 4 + j] = s; }
    return { F, R: Rr, U, E, tx, ty, vp };
  }

  /* ================= scener ================= */
  const SC = {};
  const has = k => !!SC[k];

  /* ================= montering och ritslinga ================= */
  function supported() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
  function mount(el, world, opt) {
    unmount(); if (!SC[world]) return false; opt = opt || {};
    cv = document.createElement('canvas'); cv.className = 'wgl'; el.appendChild(cv);
    const ca = { antialias: false, alpha: false, depth: true, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    gl = cv.getContext('webgl2', ca); isGL2 = !!gl; if (!gl) gl = cv.getContext('webgl', ca) || cv.getContext('experimental-webgl', ca);
    if (!gl) { cv.remove(); cv = null; return false; }
    try { build(world, opt); } catch (e) { console.warn('WGL', e); unmount(); return false; }
    const myCv = cv; myCv.addEventListener('webglcontextlost', e => { e.preventDefault(); if (myCv._bye || cv !== myCv) return;   // avsiktligt stängd (ombyggnad) räknas inte som fel
      const cb = opt.onLost; unmount(); if (cb) cb(); });
    try { resize(); draw(performance.now()); const e = gl.getError(); if (e && e !== gl.CONTEXT_LOST_WEBGL) console.warn('WGL gl-fel', e); } catch (e) { console.warn('WGL', e); unmount(); return false; }
    if (opt.still) { state.still = true; } else loop();
    return true;
  }
  function build(world, opt) {
    const S = SC[world](opt), cfg = S.cfg, NL = 12;
    const D = (S.defs || []).map(d => '#define ' + d + '\n').join('') + `#define NL ${NL}\n`;
    state = { world, S, cfg, NL, still: !!opt.still, t0: performance.now(), few: !!opt.few, paused: opt.paused, onLost: opt.onLost };
    state.pSky = prog(QUAD_VS, SKY_FS(D), ['aP']);
    state.pSkyC = prog(QUAD_VS, SKYC_FS(D), ['aP']);
    state.pMesh = prog(MESH_VS, MESH_FS(D), ['aP', 'aN', 'aC', 'aM']);
    if (S.water) state.pWater = prog(MESH_VS, WATER_FS(D), ['aP', 'aN', 'aC', 'aM']);
    state.pPart = prog(PART_VS, PART_FS, ['aP', 'aC', 'aS']);
    state.pBright = prog(QUAD_VS, BRIGHT_FS, ['aP']); state.pBlur = prog(QUAD_VS, BLUR_FS, ['aP']); state.pFinal = prog(QUAD_VS, FINAL_FS, ['aP']);
    state.quad = vbo(new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]));
    // fast geometri
    const M = new Mesh(1 << 16); const lights = []; S.statics(M, lights); state.lights = lights;
    state.sVbo = vbo(M.f.subarray(0, M.n * FL)); state.sN = M.n;
    if (S.water) { const W = new Mesh(64); const y = S.water.y || 0, e = S.water.ext || [-1500, 1500, -1500, 40]; W.quad([e[0], y, e[3]], [e[1], y, e[3]], [e[1], y, e[2]], [e[0], y, e[2]], [0, 0, 0], 0); state.wVbo = vbo(W.f.subarray(0, W.n * FL)); state.wN = W.n; }
    if (cfg.shadow) shadowMap(cfg.shadow);
    state.dyn = new Mesh(8192); state.dVbo = gl.createBuffer(); state.dCap = 0;
    state.parts = new Float32Array(8 * 6000); state.pVbo = gl.createBuffer(); state.addParts = new Float32Array(8 * 6000); state.aVbo = gl.createBuffer();
  }
  // skuggkarta från månen/solen: ortografisk kamera över området cfg.shadow = { c: [x,y,z], r: halv bredd, res }
  function shadowMap(sh) {
    const res = sh.res || 2048, L = V.norm(state.cfg.light), F = V.mul(L, -1), up = Math.abs(F[1]) > .95 ? [0, 0, 1] : [0, 1, 0], R = V.norm(V.cross(F, up)), U = V.cross(R, F), E = V.add(sh.c, V.mul(L, 600)), r = sh.r, n = 1, f = 1400;
    const view = [R[0], U[0], -F[0], 0, R[1], U[1], -F[1], 0, R[2], U[2], -F[2], 0, -V.dot(R, E), -V.dot(U, E), V.dot(F, E), 1];
    const proj = [1 / r, 0, 0, 0, 0, 1 / r, 0, 0, 0, 0, -2 / (f - n), 0, 0, 0, -(f + n) / (f - n), 1];
    const m = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += proj[k * 4 + j] * view[i * 4 + k]; m[i * 4 + j] = s; }
    state.lvp = m; state.rtShadow = rt(res, res, true);
    const P = prog(DEPTH_VS, DEPTH_FS, ['aP']); gl.bindFramebuffer(gl.FRAMEBUFFER, state.rtShadow.f); gl.viewport(0, 0, res, res); gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.clearColor(0, 0, 0, 1);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.useProgram(P.p); gl.uniformMatrix4fv(P.U.uLVP, false, m);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.sVbo); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, FL * 4, 0); gl.enableVertexAttribArray(0); for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i); gl.drawArrays(gl.TRIANGLES, 0, state.sN);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function resize() {
    if (!cv) return; const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale, w = Math.max(64, Math.round(cv.clientWidth * dpr)), h = Math.max(64, Math.round(cv.clientHeight * dpr));
    if (state.W === w && state.H === h) return; state.W = w; state.H = h; cv.width = w; cv.height = h;
    ['rtScene', 'rtSky', 'rtRefl', 'rtReflSky', 'rtB0', 'rtB1', 'rtB2', 'rtB3', 'rtB4'].forEach(k => { freeRT(state[k]); state[k] = null; });
    state.rtScene = rt(w, h, true); const sk = state.S.cfg.skyRes || .35; state.rtSky = rt(Math.max(32, Math.round(w * sk)), Math.max(32, Math.round(h * sk)));
    if (state.S.water) { state.rtRefl = rt(Math.round(w / 2), Math.round(h / 2), true); state.rtReflSky = rt(Math.max(32, Math.round(w * sk * .6)), Math.max(32, Math.round(h * sk * .6))); }
    const b = (k, d) => state[k] = rt(Math.max(8, Math.round(w / d)), Math.max(8, Math.round(h / d)));
    b('rtB0', 4); b('rtB1', 4); b('rtB2', 8); b('rtB3', 8);
    state.skyFrame = -99;
  }
  function loop() {
    cancelAnimationFrame(raf);
    const tick = now => {
      raf = requestAnimationFrame(tick); if (!state || !cv) return;
      if (document.hidden) return;
      if (state.paused && state.paused()) return;
      if (now - lastT < 31) return;          // högst ca 30 bilder per sekund
      const dt = now - lastT; lastT = now;
      if (dt < 300) { slow = slow * .95 + (dt > 46 ? 1 : 0) * .05; if (slow > .6 && scale > .55) { scale *= .82; slow = 0; resize(); } }
      try { draw(now); } catch (e) { console.warn('WGL', e); const cb = state.onLost; unmount(); if (cb) cb(); }
    };
    raf = requestAnimationFrame(tick);
  }
  function uniformsMesh(P, cam, t, flip) {
    const c = state.cfg, U = P.U;
    gl.uniformMatrix4fv(U.uVP, false, cam.vp); gl.uniform3fv(U.uCam, cam.E); gl.uniform3fv(U.uL, V.norm(c.light)); gl.uniform3fv(U.uLc, c.lightC);
    if (U.uSkyA) { gl.uniform3fv(U.uSkyA, c.ambSky); gl.uniform3fv(U.uGndA, c.ambGnd); }
    gl.uniform3fv(U.uFogC, c.fogC); gl.uniform4fv(U.uFog, c.fog); if (U.uHaze) gl.uniform3fv(U.uHaze, c.haze || [0, 0, 0]);
    if (U.uLVP && state.lvp) { gl.uniformMatrix4fv(U.uLVP, false, state.lvp); } else if (U.uLVP) gl.uniformMatrix4fv(U.uLVP, false, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
    if (U.uShadow && state.rtShadow) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, state.rtShadow.t); gl.uniform1i(U.uShadow, 3); gl.uniform2f(U.uShPx, 1 / state.rtShadow.w, 1 / state.rtShadow.h); } gl.uniform1f(U.uT, t); if (U.uEm) gl.uniform1f(U.uEm, c.em || 1.6);
    if (U.uPL) { const L = state.lightsNow, pl = new Float32Array(state.NL * 4), pc = new Float32Array(state.NL * 4);
      for (let i = 0; i < state.NL; i++) { const l = L[i]; if (!l) { pl[i * 4 + 3] = 1; continue; } pl.set([l[0][0], l[0][1], l[0][2], l[3] || .6], i * 4); pc.set([l[1][0], l[1][1], l[1][2], l[2]], i * 4); }
      gl.uniform4fv(U.uPL, pl); gl.uniform4fv(U.uPC, pc); }
    if (U.uClipY) gl.uniform1f(U.uClipY, -1e5); if (U.uFlip) gl.uniform1f(U.uFlip, 1);
  }
  function drawSky(target, skyRT, cam, t, render) {
    const c = state.cfg;
    if (render) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, skyRT.f); gl.viewport(0, 0, skyRT.w, skyRT.h); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      const P = state.pSky, U = P.U; gl.useProgram(P.p);
      gl.uniform3fv(U.uR, cam.R); gl.uniform3fv(U.uU, cam.U); gl.uniform3fv(U.uF, cam.F); gl.uniform2f(U.uTan, cam.tx, cam.ty); gl.uniform1f(U.uT, t);
      gl.uniform3fv(U.uL, V.norm(c.skyLight || c.light)); gl.uniform3fv(U.uTop, c.top); gl.uniform3fv(U.uHor, c.hor); gl.uniform3fv(U.uGnd, c.gnd); gl.uniform3fv(U.uGlowC, c.glowC);
      const set = (n, v, f) => { if (U[n] && v) gl['uniform' + f](U[n], v); };
      set('uMw', c.mw, '3fv'); set('uAur', c.aur, '4fv'); set('uAurC1', c.aurC1, '3fv'); set('uAurC2', c.aurC2, '3fv'); set('uCl', c.cl, '4fv'); set('uClC', c.clC, '3fv'); set('uNeb', c.neb, '4fv');
      set('uPl', c.pl, '3fv'); set('uPlP', c.plP, '4fv'); set('uPlC1', c.plC1, '3fv'); set('uPlC2', c.plC2, '3fv');
      quad();
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    const P = state.pSkyC, U = P.U; gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, skyRT.t); gl.uniform1i(U.uSky, 0);
    gl.uniform3fv(U.uR, cam.R); gl.uniform3fv(U.uU, cam.U); gl.uniform3fv(U.uF, cam.F); gl.uniform2f(U.uTan, cam.tx, cam.ty); gl.uniform2f(U.uRes, target.w, target.h); gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uStar, c.stars || 0); if (U.uMoon && c.moon) { gl.uniform3fv(U.uMoon, c.moon); gl.uniform3fv(U.uMoonC, c.moonC); gl.uniform1f(U.uMoonR, c.moonR || .03); } if (U.uMw && c.mw) gl.uniform3fv(U.uMw, c.mw);
    quad();
  }
  function drawScene(target, cam, t, flip) {
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE); gl.cullFace(flip ? gl.FRONT : gl.BACK); gl.disable(gl.CULL_FACE);
    const P = state.pMesh; gl.useProgram(P.p); uniformsMesh(P, cam, t, flip);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.sVbo); meshAttribs(); gl.drawArrays(gl.TRIANGLES, 0, state.sN);
    if (state.dN) { gl.bindBuffer(gl.ARRAY_BUFFER, state.dVbo); meshAttribs(); gl.drawArrays(gl.TRIANGLES, 0, state.dN); }
    if (state.S.water && !flip) { const W = state.pWater, U = W.U; gl.useProgram(W.p); uniformsMesh(W, cam, t, false);
      const w = state.S.water; gl.uniform3fv(U.uDeep, w.deep); gl.uniform4fv(U.uWv, w.wv); gl.uniform2f(U.uRes, target.w, target.h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, state.rtRefl.t); gl.uniform1i(U.uRefl, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, state.wVbo); meshAttribs(); gl.drawArrays(gl.TRIANGLES, 0, state.wN); }
    // partiklar
    gl.depthMask(false); gl.enable(gl.BLEND);
    const PP = state.pPart, U = PP.U; gl.useProgram(PP.p); gl.uniformMatrix4fv(U.uVP, false, cam.vp); gl.uniform1f(U.uPx, target.h / (2 * cam.ty)); gl.uniform1f(U.uFlip, 1); gl.uniform1f(U.uClipY, -1e5);
    const dp = (buf, n, add) => { if (!n) return; gl.uniform1f(U.uAdd, add ? 1 : 0);
      if (add) gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE); else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); const s = 32; gl.vertexAttribPointer(0, 3, gl.FLOAT, false, s, 0); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, s, 12); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, s, 28);
      gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2); gl.disableVertexAttribArray(3); gl.drawArrays(gl.POINTS, 0, n); };
    dp(state.pVbo, state.pN, false); dp(state.aVbo, state.aN, true);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  function draw(now) {
    if (!state || !gl) return; const S = state.S, t = state.still ? (S.cfg.stillT || 20) : Math.max(0, (now - state.t0) / 1000);   // rAF:s tidsstämpel kan ligga före starten frameN++;
    const cam = camera(S.cfg, state.W, state.H);
    // rörliga delar
    const L = state.lights.slice(); state.dyn.reset(); let pn = 0, an = 0;
    const PB = { n: 0, a: 0, add(p, c, s, glow) { const arr = glow ? state.addParts : state.parts, i = (glow ? this.a : this.n); if (i >= 6000) return; arr.set([p[0], p[1], p[2], c[0], c[1], c[2], c[3] == null ? 1 : c[3], s], i * 8); if (glow) this.a++; else this.n++; } };
    if (S.update) S.update(t, state.dyn, PB, L, cam, state);
    state.lightsNow = L.sort((a, b) => (b[2] / (1 + V.dot(V.sub(a[0], cam.E), V.sub(a[0], cam.E)) * .002)) - (a[2] / (1 + V.dot(V.sub(b[0], cam.E), V.sub(b[0], cam.E)) * .002))).slice(0, state.NL);
    state.dN = state.dyn.n; if (state.dN) { gl.bindBuffer(gl.ARRAY_BUFFER, state.dVbo); gl.bufferData(gl.ARRAY_BUFFER, state.dyn.f.subarray(0, state.dN * FL), gl.DYNAMIC_DRAW); }
    state.pN = PB.n; state.aN = PB.a;
    if (PB.n) { gl.bindBuffer(gl.ARRAY_BUFFER, state.pVbo); gl.bufferData(gl.ARRAY_BUFFER, state.parts.subarray(0, PB.n * 8), gl.DYNAMIC_DRAW); }
    if (PB.a) { gl.bindBuffer(gl.ARRAY_BUFFER, state.aVbo); gl.bufferData(gl.ARRAY_BUFFER, state.addParts.subarray(0, PB.a * 8), gl.DYNAMIC_DRAW); }
    // himlen i låg upplösning uppdateras var tredje bild (den rör sig långsamt)
    const skyNow = state.still || frameN - state.skyFrame >= (S.cfg.skyEvery || 2);
    // spegling: himlen med speglade strålar och världen speglad i vattenytan (y = 0), sedd från samma kamera
    if (S.water) { const sc = { R: cam.R, U: [cam.U[0], -cam.U[1], cam.U[2]], F: [cam.F[0], -cam.F[1], cam.F[2]], tx: cam.tx, ty: cam.ty, E: [cam.E[0], -cam.E[1], cam.E[2]], vp: cam.vp };
      drawSky(state.rtRefl, state.rtReflSky, sc, t, skyNow); drawSceneRefl(sc, t, 0); }
    drawSky(state.rtScene, state.rtSky, cam, t, skyNow); if (skyNow) state.skyFrame = frameN;
    drawScene(state.rtScene, cam, t, false);
    // bloom
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    const pass = (P, src, dst, set) => { gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null); gl.viewport(0, 0, dst ? dst.w : state.W, dst ? dst.h : state.H); gl.useProgram(P.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(P.U.uTex, 0); if (set) set(P.U); quad(); };
    pass(state.pBright, state.rtScene, state.rtB0, U => { gl.uniform2f(U.uPx, 1 / state.W, 1 / state.H); gl.uniform1f(U.uK, S.cfg.glowK || 1.2); });
    const blur = (a, b) => { pass(state.pBlur, a, b, U => gl.uniform2f(U.uDir, 1 / a.w, 0)); pass(state.pBlur, b, a, U => gl.uniform2f(U.uDir, 0, 1 / b.h)); };
    blur(state.rtB0, state.rtB1); blur(state.rtB0, state.rtB1);
    pass(state.pBlur, state.rtB0, state.rtB2, U => gl.uniform2f(U.uDir, 1 / state.rtB0.w, 0)); pass(state.pBlur, state.rtB2, state.rtB3, U => gl.uniform2f(U.uDir, 0, 1 / state.rtB2.h)); blur(state.rtB3, state.rtB2);
    const F = state.pFinal; pass(F, state.rtScene, null, U => { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, state.rtB0.t); gl.uniform1i(U.uB1, 1); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, state.rtB3.t); gl.uniform1i(U.uB2, 2);
      gl.uniform2f(U.uPx, 1 / state.W, 1 / state.H); gl.uniform1f(U.uT, t); gl.uniform4fv(U.uGr, S.cfg.grade || [1, 1, 1.05, .5]); gl.uniform3fv(U.uTint, S.cfg.tint || [1, 1, 1]); gl.uniform1f(U.uBk, S.cfg.bloom || .9); });
  }
  // speglingen: himlen och världen ritas uppochned, under vattenytan klipps bort
  function drawSceneRefl(cam, t, y) {
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT); gl.disable(gl.BLEND);
    const P = state.pMesh; gl.useProgram(P.p); uniformsMesh(P, cam, t, false); gl.uniform1f(P.U.uFlip, -1); gl.uniform1f(P.U.uClipY, y + .02);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.sVbo); meshAttribs(); gl.drawArrays(gl.TRIANGLES, 0, state.sN);
    if (state.dN) { gl.bindBuffer(gl.ARRAY_BUFFER, state.dVbo); meshAttribs(); gl.drawArrays(gl.TRIANGLES, 0, state.dN); }
    gl.depthMask(false); gl.enable(gl.BLEND);
    const PP = state.pPart, U = PP.U; gl.useProgram(PP.p); gl.uniformMatrix4fv(U.uVP, false, cam.vp); gl.uniform1f(U.uPx, state.rtRefl.h / (2 * cam.ty)); gl.uniform1f(U.uFlip, -1); gl.uniform1f(U.uClipY, y);
    const dp = (buf, n, add) => { if (!n) return; gl.uniform1f(U.uAdd, add ? 1 : 0); if (add) gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE); else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); const s = 32; gl.vertexAttribPointer(0, 3, gl.FLOAT, false, s, 0); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, s, 12); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, s, 28); gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2); gl.disableVertexAttribArray(3); gl.drawArrays(gl.POINTS, 0, n); };
    dp(state.aVbo, state.aN, true); gl.depthMask(true); gl.disable(gl.BLEND);
  }
  function unmount() {
    cancelAnimationFrame(raf); raf = 0; if (cv) cv._bye = true;
    if (gl && state) { try { ['rtScene', 'rtSky', 'rtRefl', 'rtReflSky', 'rtB0', 'rtB1', 'rtB2', 'rtB3'].forEach(k => freeRT(state[k])); const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) {} }
    if (cv) { cv._bye = true; cv.remove(); } cv = null; gl = null; state = null; scale = 1;
  }
  window.addEventListener('resize', () => { if (state) { resize(); if (state.still) draw(performance.now()); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state && state.still) draw(performance.now()); });

  return { frames: () => frameN, tris: () => state ? Math.round(state.sN / 3) : 0, mount, unmount, supported, has, SC, Mesh, terrain, fir, blobTree, house, mkNoise, rng, V, C, active: () => state && state.world, _draw: () => state && draw(performance.now()), _scale: () => scale };
})();
