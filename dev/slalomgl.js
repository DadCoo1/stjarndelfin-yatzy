/* SLGL – 3D-prov för slalom: backen och åkaren ritas med grafikkortet (WebGL).
   Riktig perspektivkamera, ljus från solen, kastade skuggor, dis och himmel. Spelet (fysik, bana, HUD) är detsamma;
   slalom.js lämnar över terräng, träd, portar och åkarens leder hit. Finns WebGL inte faller spelet tillbaka på vanlig grafik. */
const SLGL=(()=>{ function mkGL(){
  const FL=10;                                   // flyttal per hörn: läge 3, normal 3, färg 3, material 1
  // material: 0 föremål · 1 pistad snö · 2 orörd snö · 3 olyst (färg i snön) · 4 tunn yta, lyst från båda håll
  //           5 billack (blank, speglar himlen) · 6 glas · 7 krom · 8 självlysande (lyktor)
  let gl=null, cv=null, PM=null, PSH=null, PSKY=null, quadB=null, meshes=[], sets={'':[]}, dynB=null, dynBuf=null, sh=null, bad=false;
  const HEX={}; const hex=h=>HEX[h]||(HEX[h]=[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255]);
  const col=c=>typeof c==='string'?(c[0]==='#'&&c.length===7?hex(c):c[0]==='#'&&c.length===4?hex('#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]):[.5,.5,.5]):c;

  /* ---------- geometribyggare ---------- */
  function Builder(cap){ this.f=new Float32Array((cap||4096)*FL); this.n=0; }
  Builder.prototype={
    reset(){ this.n=0; return this; },
    need(k){ if((this.n+k)*FL>this.f.length){ const g=new Float32Array(Math.max(this.f.length*2,(this.n+k)*FL)); g.set(this.f.subarray(0,this.n*FL)); this.f=g; } },
    v(x,y,z,nx,ny,nz,c,m){ const f=this.f, o=this.n*FL; f[o]=x; f[o+1]=y; f[o+2]=z; f[o+3]=nx; f[o+4]=ny; f[o+5]=nz; f[o+6]=c[0]; f[o+7]=c[1]; f[o+8]=c[2]; f[o+9]=m; this.n++; },
    tri(a,b,c,cl,m){ cl=col(cl); this.need(3); let nx=(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]), ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]), nz=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]); const l=Math.hypot(nx,ny,nz)||1; nx/=l; ny/=l; nz/=l;
      if(ny<0&&m!==4){ nx=-nx; ny=-ny; nz=-nz; }
      this.v(a[0],a[1],a[2],nx,ny,nz,cl,m||0); this.v(b[0],b[1],b[2],nx,ny,nz,cl,m||0); this.v(c[0],c[1],c[2],nx,ny,nz,cl,m||0); },
    quad(a,b,c,d,cl,m){ this.tri(a,b,c,cl,m); this.tri(a,c,d,cl,m); },
    // väggyta med given normal (för lådor: normalen pekar ut även när den är vågrät)
    wall(a,b,c,d,n,cl,m){ cl=col(cl); this.need(6); for(const p of [a,b,c,a,c,d]) this.v(p[0],p[1],p[2],n[0],n[1],n[2],cl,m||0); },
    box(x0,x1,y0,y1,z0,z1,cl,m){ this.wall([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[0,0,-1],cl,m); this.wall([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],cl,m);
      this.wall([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],cl,m); this.wall([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],[1,0,0],cl,m); this.wall([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],[0,1,0],cl,m); },
    // stympad kon mellan a och b med mjuka normaler; c2 ger annan färg i b-änden (t.ex. snö i grantoppen)
    cone(a,b,r1,r2,cl,m,sides,c2,slant){ cl=col(cl); c2=c2?col(c2):cl; sides=sides||6; this.need(sides*6);
      let ax=b[0]-a[0], ay=b[1]-a[1], az=b[2]-a[2]; const L=Math.hypot(ax,ay,az)||1; ax/=L; ay/=L; az/=L;
      let ux=Math.abs(ay)>.9?1:0, uy=Math.abs(ay)>.9?0:1, uz=0; let px=uy*az-uz*ay, py=uz*ax-ux*az, pz=ux*ay-uy*ax; const pl=Math.hypot(px,py,pz)||1; px/=pl; py/=pl; pz/=pl;
      const qx=ay*pz-az*py, qy=az*px-ax*pz, qz=ax*py-ay*px, sl=slant==null?(r1-r2)/L:slant;
      let c0=1, s0=0; for(let i=1;i<=sides;i++){ const t=i/sides*6.2831853, c1=Math.cos(t), s1=Math.sin(t);
        const n0x=px*c0+qx*s0+ax*sl, n0y=py*c0+qy*s0+ay*sl, n0z=pz*c0+qz*s0+az*sl, n1x=px*c1+qx*s1+ax*sl, n1y=py*c1+qy*s1+ay*sl, n1z=pz*c1+qz*s1+az*sl;
        const A0=[a[0]+(px*c0+qx*s0)*r1,a[1]+(py*c0+qy*s0)*r1,a[2]+(pz*c0+qz*s0)*r1], A1=[a[0]+(px*c1+qx*s1)*r1,a[1]+(py*c1+qy*s1)*r1,a[2]+(pz*c1+qz*s1)*r1];
        const B0=[b[0]+(px*c0+qx*s0)*r2,b[1]+(py*c0+qy*s0)*r2,b[2]+(pz*c0+qz*s0)*r2], B1=[b[0]+(px*c1+qx*s1)*r2,b[1]+(py*c1+qy*s1)*r2,b[2]+(pz*c1+qz*s1)*r2];
        this.v(A0[0],A0[1],A0[2],n0x,n0y,n0z,cl,m||0); this.v(A1[0],A1[1],A1[2],n1x,n1y,n1z,cl,m||0); this.v(B1[0],B1[1],B1[2],n1x,n1y,n1z,c2,m||0);
        if(r2>1e-4){ this.v(A0[0],A0[1],A0[2],n0x,n0y,n0z,cl,m||0); this.v(B1[0],B1[1],B1[2],n1x,n1y,n1z,c2,m||0); this.v(B0[0],B0[1],B0[2],n0x,n0y,n0z,c2,m||0); }
        c0=c1; s0=s1; } },
    sphere(c,r,cl,m,lon,lat){ cl=col(cl); lon=lon||6; lat=lat||4; this.need(lon*lat*6);
      for(let j=0;j<lat;j++){ const t0=j/lat*Math.PI, t1=(j+1)/lat*Math.PI, y0=Math.cos(t0), y1=Math.cos(t1), r0=Math.sin(t0), r1=Math.sin(t1);
        for(let i=0;i<lon;i++){ const p0=i/lon*6.2831853, p1=(i+1)/lon*6.2831853, c0=Math.cos(p0), s0=Math.sin(p0), c1=Math.cos(p1), s1=Math.sin(p1);
          const P=(rr,y,cc,ss)=>this.v(c[0]+rr*cc*r,c[1]+y*r,c[2]+rr*ss*r,rr*cc,y,rr*ss,cl,m||0);
          if(j>0){ P(r0,y0,c0,s0); P(r0,y0,c1,s1); P(r1,y1,c1,s1); }
          if(j<lat-1){ P(r0,y0,c0,s0); P(r1,y1,c1,s1); P(r1,y1,c0,s0); } } } },
    // yta över ett rutnät av punkter P[j][i]=[x,y,z] med mjuka normaler; col(j,i) och mat(j,i) per ruta (j längs, i tvärs); flip vänder normalen
    loft(P,colf,matf,flip){ const nj=P.length, ni=P[0].length, Nn=[]; for(let j=0;j<nj;j++){ Nn.push([]); for(let i=0;i<ni;i++){ const a=P[j][Math.max(0,i-1)], b=P[j][Math.min(ni-1,i+1)], c=P[Math.max(0,j-1)][i], d=P[Math.min(nj-1,j+1)][i];
          const ax=b[0]-a[0], ay=b[1]-a[1], az=b[2]-a[2], bx=d[0]-c[0], by=d[1]-c[1], bz=d[2]-c[2]; let x=ay*bz-az*by, y=az*bx-ax*bz, z=ax*by-ay*bx; const l=(Math.hypot(x,y,z)||1)*(flip?-1:1); Nn[j].push([x/l,y/l,z/l]); } }
      this.need((nj-1)*(ni-1)*6); for(let j=0;j<nj-1;j++) for(let i=0;i<ni-1;i++){ const cl=col(colf(j,i)), m=matf?matf(j,i):0; for(const [a,b] of [[j,i],[j+1,i],[j+1,i+1],[j,i],[j+1,i+1],[j,i+1]]){ const p=P[a][b], n=Nn[a][b]; this.v(p[0],p[1],p[2],n[0],n[1],n[2],cl,m); } } },
    capsule(a,b,r1,r2,cl,m,sides){ this.cone(a,b,r1,r2,cl,m,sides||7); if(r1>.028) this.sphere(a,r1,cl,m,sides||7,4); if(r2>.028) this.sphere(b,r2,cl,m,sides||7,4); }
  };

  /* ---------- shaders ---------- */
  const PREC='#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  const VS=`attribute vec3 aP; attribute vec3 aN; attribute vec3 aC; attribute float aM;
uniform mat4 uVP, uLVP; varying vec3 vW, vN, vC; varying float vM, vD; varying vec4 vS;
void main(){ vW=aP; vN=aN; vC=aC; vM=aM; vS=uLVP*vec4(aP,1.); vec4 p=uVP*vec4(aP,1.); vD=p.w; gl_Position=p; }`;
  const FS=PREC+`varying vec3 vW, vN, vC; varying float vM, vD; varying vec4 vS;
uniform vec3 uL, uSun, uAmb, uFog, uCam, uEnvZ, uEnvH, uGnd; uniform float uFogD, uShK, uShOn, uTex, uOpq; uniform sampler2D uSh;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float shadow(float bias){ if(uShOn<.5) return 1.; vec3 s=vS.xyz*.5+.5; if(s.x<0.||s.x>1.||s.y<0.||s.y>1.||s.z>1.) return 1.;
  float r=0.; r+=step(s.z-bias,texture2D(uSh,s.xy+vec2(-.6,-.6)*uTex).r); r+=step(s.z-bias,texture2D(uSh,s.xy+vec2(.6,-.6)*uTex).r);
  r+=step(s.z-bias,texture2D(uSh,s.xy+vec2(-.6,.6)*uTex).r); r+=step(s.z-bias,texture2D(uSh,s.xy+vec2(.6,.6)*uTex).r); r+=step(s.z-bias,texture2D(uSh,s.xy).r);
  vec2 e=abs(s.xy-.5)*2.; return mix(r*.2,1.,smoothstep(.82,1.,max(e.x,e.y))); }
void main(){
  vec3 N=normalize(vN), c=vC; float m=vM, al=1.;
  if(m>2.5&&m<3.5){ c=vC*(uAmb+uSun*.55*mix(1.-uShK,1.,shadow(.0004))); }
  else if(m>7.5){ c=vC; }
  else if(m>4.5){ // blanka ytor: lack, glas och krom speglar himmel och mark
    vec3 V=normalize(uCam-vW); if(dot(N,V)<0.) N=-N; vec3 Rr=reflect(-V,N); float nv=max(dot(N,V),0.), fr=pow(1.-nv,3.);
    vec3 sky=mix(uEnvH,uEnvZ,pow(clamp(Rr.y,0.,1.),.6)), env=mix(mix(uGnd,uEnvH,.25),sky,smoothstep(-.1,.06,Rr.y));
    env+=uEnvH*.9*smoothstep(.05,0.,abs(Rr.y-.03));                                               // ljus rand vid horisonten ger lacken liv
    float d=max(dot(N,uL),0.), s=shadow(mix(.004,.0015,d)), lit=mix(1.-uShK,1.,s);
    float sp=pow(max(dot(Rr,uL),0.),m>5.5?260.:110.)*lit;
    if(m<5.5){ float rf=.1+.7*fr, hemi=.62+.38*N.y; c=vC*(uAmb*hemi+uSun*d*lit)*(1.-rf*.55)+env*rf*(.5+.5*hemi)+uSun*(sp*2.2+pow(max(dot(Rr,uL),0.),18.)*.16*lit); }
    else if(m<6.5){ float rf=.2+.75*fr; c=vC*uAmb*.5*(1.-rf)+env*rf+uSun*sp*2.5; al=mix(clamp(.3+.6*fr+sp,0.,1.),1.,uOpq); }
    else { c=env*vC*(.55+.45*lit)+uSun*sp*2.; }
  }
  else {
    float snow=step(.5,m)*step(m,2.5);
    if(m>.5&&m<1.5){ float k=clamp(1.-vD/16.,0.,1.); k*=k; float st=sin(vW.x*110.); N=normalize(N+vec3(st*.1*k,0.,0.)); c*=1.-.02*k*(.5+.5*st); }   // manchester i pisten
    float d=dot(N,uL); if(m>3.5) d=abs(d)*.8+.2;
    float w=snow*.28, lam=max((d+w)/(1.+w),0.);
    float s=shadow(snow>.5?.0004:mix(.003,.0012,clamp(d,0.,1.)));
    c=c*(uAmb+uSun*lam*mix(1.-uShK,1.,s));
    if(snow>.5){ vec3 V=normalize(uCam-vW), Hh=normalize(V+uL); float sp=pow(max(dot(N,Hh),0.),48.);
      float g=step(.988,hash(floor(vW.xz*70.)+floor(V.xz*9.)));                                                                         // glitter som tänds och släcks när man rör sig
      c+=uSun*s*(sp*.3+g*(.25+sp*3.)*clamp(1.-vD/55.,0.,1.)*uShK); }
  }
  c=1.-exp(-2.15*c);
  c=mix(c,uFog,clamp(1.-exp(-vD*uFogD),0.,1.));
  gl_FragColor=vec4(c*al,al);
}`;
  const VSH=`attribute vec3 aP; uniform mat4 uLVP; void main(){ gl_Position=uLVP*vec4(aP,1.); }`;
  const FSH=PREC+`void main(){ gl_FragColor=vec4(1.); }`;
  const VSKY=`attribute vec2 aQ; varying vec2 vQ; void main(){ vQ=aQ; gl_Position=vec4(aQ,1.,1.); }`;
  const FSKY=PREC+`varying vec2 vQ; uniform vec4 uR; uniform vec2 uK; uniform float uOy; uniform vec3 uL, uZen, uHor, uSunC; uniform float uCloud, uT;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y); }
float fbm(vec2 p){ return noise(p)*.5+noise(p*2.03+7.)*.25+noise(p*4.1+3.)*.125+noise(p*8.3)*.0625; }
void main(){ float X=vQ.x*uK.x, Y=(vQ.y-uOy)*uK.y, Z0=Y*uR.z+uR.w, dy=Y*uR.w-uR.z, dx=X*uR.y+Z0*uR.x, dz=-X*uR.x+Z0*uR.y; vec3 r=normalize(vec3(dx,dy,dz));
  float t=clamp(r.y,0.,1.); vec3 c=mix(uHor,uZen,pow(t,.55));
  float s=max(dot(r,uL),0.); c+=uSunC*(pow(s,900.)*3.+pow(s,60.)*.35+pow(s,6.)*.14);
  if(r.y>.015){ vec2 uv=r.xz/(r.y+.12)*1.1+vec2(uT*.006,uT*.002); float n=fbm(uv), th=mix(.62,.28,uCloud), cl=smoothstep(th,th+.22,n)*smoothstep(.015,.14,r.y);
    vec3 cc=mix(vec3(1.),mix(uHor,vec3(.62,.66,.74),.6),smoothstep(th+.05,th+.5,n)*.8+uCloud*.25)+uSunC*pow(s,8.)*.25; c=mix(c,cc,cl*.9); }
  gl_FragColor=vec4(c,1.); }`;

  function prog(vs,fs){ const mk=(t,s)=>{ const o=gl.createShader(t); gl.shaderSource(o,s); gl.compileShader(o); if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)) throw new Error('shader: '+gl.getShaderInfoLog(o)); return o; };
    const p=gl.createProgram(); gl.attachShader(p,mk(gl.VERTEX_SHADER,vs)); gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs)); gl.bindAttribLocation(p,0,'aP'); gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error('länk: '+gl.getProgramInfoLog(p));
    const u={}, n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS); for(let i=0;i<n;i++){ const nm=gl.getActiveUniform(p,i).name; u[nm]=gl.getUniformLocation(p,nm); }
    return {p,u,a:{N:gl.getAttribLocation(p,'aN'),C:gl.getAttribLocation(p,'aC'),M:gl.getAttribLocation(p,'aM')}}; }

  function init(canvas,opts){
    if(gl&&cv===canvas&&!bad) return true; cv=canvas; bad=false;
    try{ gl=canvas.getContext('webgl',{antialias:true,alpha:!!(opts&&opts.alpha),premultipliedAlpha:true,depth:true,powerPreference:'high-performance'}); if(!gl) return false;
      PM=prog(VS,FS); PSH=prog(VSH,FSH); PSKY=prog(VSKY,FSKY);
      quadB=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,quadB); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      dynBuf=gl.createBuffer(); dynB=new Builder(16384); sets={'':[]}; meshes=sets['']; sh=null;
      const dt=gl.getExtension('WEBGL_depth_texture')||gl.getExtension('WEBKIT_WEBGL_depth_texture');
      if(dt){ const S=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE)), d=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,d);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT,S,S,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null); for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D,k,v);
        const c=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,c); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,S,S,0,gl.RGBA,gl.UNSIGNED_BYTE,null); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        const fb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,c,0); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,d,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE) sh={fb,d,S}; gl.bindFramebuffer(gl.FRAMEBUFFER,null); }
      canvas.addEventListener('webglcontextlost',e=>{ e.preventDefault(); bad=true; },false);
      return true;
    }catch(e){ bad=true; gl=null; try{ console.warn('SLGL',e); }catch(_){} return false; }
  }
  const ok=()=>!!gl&&!bad;

  /* ---------- fasta nät ---------- */
  function clear(){ if(!gl) return; for(const m of meshes){ gl.deleteBuffer(m.vb); if(m.ib) gl.deleteBuffer(m.ib); } meshes.length=0; }
  function addMesh(B,cast){ if(!B.n) return; const vb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vb); gl.bufferData(gl.ARRAY_BUFFER,B.f.subarray(0,B.n*FL),gl.STATIC_DRAW); meshes.push({vb,n:B.n,cast:!!cast}); }
  // rutnät med delade hörn: fn(i,j,o) fyller o.x,o.y,o.z,o.r,o.g,o.b,o.m; skip(i,j) hoppar över en ruta
  function addGrid(nx,nz,fn,skip){ if(nx*nz>65535) throw new Error('för stort rutnät'); const f=new Float32Array(nx*nz*FL), o={};
    for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){ fn(i,j,o); const k=(j*nx+i)*FL; f[k]=o.x; f[k+1]=o.y; f[k+2]=o.z; f[k+6]=o.r; f[k+7]=o.g; f[k+8]=o.b; f[k+9]=o.m; }
    for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){ const k=(j*nx+i)*FL, a=(j*nx+Math.max(0,i-1))*FL, b=(j*nx+Math.min(nx-1,i+1))*FL, c=(Math.max(0,j-1)*nx+i)*FL, d=(Math.min(nz-1,j+1)*nx+i)*FL;
      const ax=f[b]-f[a], ay=f[b+1]-f[a+1], az=f[b+2]-f[a+2], bx=f[d]-f[c], by=f[d+1]-f[c+1], bz=f[d+2]-f[c+2]; let x=ay*bz-az*by, y=az*bx-ax*bz, z=ax*by-ay*bx; if(y<0){ x=-x; y=-y; z=-z; } const l=Math.hypot(x,y,z)||1; f[k+3]=x/l; f[k+4]=y/l; f[k+5]=z/l; }
    const ix=[]; for(let j=0;j<nz-1;j++) for(let i=0;i<nx-1;i++){ if(skip&&skip(i,j)) continue; const a=j*nx+i, b=a+1, c=a+nx, d=c+1; ix.push(a,c,b,b,c,d); }
    const vb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vb); gl.bufferData(gl.ARRAY_BUFFER,f,gl.STATIC_DRAW); const ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(ix),gl.STATIC_DRAW);
    meshes.push({vb,ib,n:ix.length,cast:false}); }

  /* ---------- matriser ---------- */
  // samma kamera som DRONE.proj: gir, lutning, brännvidd i bildpunkter
  function camMat(C,W,H,out){ const cy=Math.cos(C.yaw), sy=Math.sin(C.yaw), cp=Math.cos(C.pitch), sp=Math.sin(C.pitch), near=.4, far=14000, A=(far+near)/(far-near), Bz=-2*far*near/(far-near), kx=2*C.f/W, ky=2*C.f/H;
    const rx=[cy,0,-sy], ry=[sy*sp,cp,cy*sp], rz=[sy*cp,-sp,cy*cp], t=r=>-(r[0]*C.x+r[1]*C.y+r[2]*C.z), tz=t(rz);
    out[0]=rx[0]*kx; out[4]=rx[1]*kx; out[8]=rx[2]*kx; out[12]=t(rx)*kx;
    out[1]=ry[0]*ky; out[5]=ry[1]*ky; out[9]=ry[2]*ky; out[13]=t(ry)*ky;
    out[2]=rz[0]*A;  out[6]=rz[1]*A;  out[10]=rz[2]*A; out[14]=tz*A+Bz;
    out[3]=rz[0];    out[7]=rz[1];    out[11]=rz[2];   out[15]=tz;
    const oy=C.cy==null?0:1-2*C.cy/H; if(oy){ out[1]+=oy*out[3]; out[5]+=oy*out[7]; out[9]+=oy*out[11]; out[13]+=oy*out[15]; } return out; }
  function lightMat(L,c,S,D,tex,out){ const f=[-L[0],-L[1],-L[2]]; let r=[f[2],0,-f[0]]; const rl=Math.hypot(r[0],r[2])||1; r=[r[0]/rl,0,r[2]/rl]; const u=[f[1]*r[2]-f[2]*r[1], f[2]*r[0]-f[0]*r[2], f[0]*r[1]-f[1]*r[0]];
    const step=2*S/tex, snap=v=>Math.round(v/step)*step, tx=-snap(r[0]*c[0]+r[1]*c[1]+r[2]*c[2]), ty=-snap(u[0]*c[0]+u[1]*c[1]+u[2]*c[2]), tz=-(f[0]*c[0]+f[1]*c[1]+f[2]*c[2]);
    out[0]=r[0]/S; out[4]=r[1]/S; out[8]=r[2]/S; out[12]=tx/S; out[1]=u[0]/S; out[5]=u[1]/S; out[9]=u[2]/S; out[13]=ty/S; out[2]=f[0]/D; out[6]=f[1]/D; out[10]=f[2]/D; out[14]=tz/D; out[3]=0; out[7]=0; out[11]=0; out[15]=1; return out; }
  const VP=new Float32Array(16), LVP=new Float32Array(16);

  function bindAttr(P,full){ const st=FL*4; gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,st,0);
    if(full){ for(const [k,n,o] of [['N',3,12],['C',3,24],['M',1,36]]) if(P.a[k]>=0){ gl.enableVertexAttribArray(P.a[k]); gl.vertexAttribPointer(P.a[k],n,gl.FLOAT,false,st,o); } } }
  function drawAll(P,full,castOnly){ for(const m of meshes){ if(castOnly&&!m.cast) continue; gl.bindBuffer(gl.ARRAY_BUFFER,m.vb); bindAttr(P,full); if(m.ib){ gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib); gl.drawElements(gl.TRIANGLES,m.n,gl.UNSIGNED_SHORT,0); } else gl.drawArrays(gl.TRIANGLES,0,m.n); }
    if(dynB.n){ gl.bindBuffer(gl.ARRAY_BUFFER,dynBuf); bindAttr(P,full); gl.drawArrays(gl.TRIANGLES,0,dynB.n); } }

  const LOOK={ sun:{zen:[.17,.40,.80],hor:[.76,.86,.96],sunC:[1,.93,.8],sun:[1.02,.86,.6],amb:[.40,.49,.68],shK:.8,cloud:.12},
               cloud:{zen:[.56,.61,.69],hor:[.80,.83,.87],sunC:[.3,.3,.3],sun:[.5,.48,.44],amb:[.6,.64,.72],shK:.4,cloud:.92},
               snow:{zen:[.72,.75,.8],hor:[.86,.88,.91],sunC:[.12,.12,.12],sun:[.33,.32,.31],amb:[.72,.75,.8],shK:.22,cloud:1} };
  let stats={tris:0};
  // o: {C:{x,y,z,yaw,pitch,f}, W,H, sun:[x,y,z], wx:{kind,fog}, focus:[x,y,z], time}
  function render(o){
    if(!ok()) return false; const lk=o.look||LOOK[o.wx&&o.wx.kind]||LOOK.sun, C=o.C, L=o.sun;
    gl.bindBuffer(gl.ARRAY_BUFFER,dynBuf); gl.bufferData(gl.ARRAY_BUFFER,dynB.f.subarray(0,dynB.n*FL),gl.DYNAMIC_DRAW);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    for(let i=1;i<6;i++) gl.disableVertexAttribArray(i);
    if(sh){ lightMat(L,o.focus,o.shadowR||75,o.shadowD||170,sh.S,LVP); gl.bindFramebuffer(gl.FRAMEBUFFER,sh.fb); gl.viewport(0,0,sh.S,sh.S); gl.colorMask(false,false,false,false); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(PSH.p); gl.uniformMatrix4fv(PSH.u.uLVP,false,LVP); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.,2.); drawAll(PSH,false,true); gl.disable(gl.POLYGON_OFFSET_FILL); gl.colorMask(true,true,true,true); gl.bindFramebuffer(gl.FRAMEBUFFER,null); }
    gl.viewport(0,0,cv.width,cv.height); if(o.clear) gl.clearColor(0,0,0,0); else gl.clearColor(lk.hor[0],lk.hor[1],lk.hor[2],1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    // himlen
    if(!o.clear){
    gl.depthMask(false); gl.disable(gl.DEPTH_TEST); gl.useProgram(PSKY.p); gl.bindBuffer(gl.ARRAY_BUFFER,quadB); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.uniform4f(PSKY.u.uR,Math.sin(C.yaw),Math.cos(C.yaw),Math.sin(C.pitch),Math.cos(C.pitch)); gl.uniform2f(PSKY.u.uK,o.W/(2*C.f),o.H/(2*C.f)); gl.uniform1f(PSKY.u.uOy,C.cy==null?0:1-2*C.cy/o.H); gl.uniform3fv(PSKY.u.uL,L); gl.uniform3fv(PSKY.u.uZen,lk.zen); gl.uniform3fv(PSKY.u.uHor,lk.hor); gl.uniform3fv(PSKY.u.uSunC,lk.sunC); gl.uniform1f(PSKY.u.uCloud,lk.cloud); gl.uniform1f(PSKY.u.uT,o.time||0);
    gl.drawArrays(gl.TRIANGLES,0,3); gl.depthMask(true); gl.enable(gl.DEPTH_TEST); }
    // världen
    camMat(C,o.W,o.H,VP); gl.useProgram(PM.p); gl.uniformMatrix4fv(PM.u.uVP,false,VP); gl.uniformMatrix4fv(PM.u.uLVP,false,LVP);
    gl.uniform3fv(PM.u.uL,L); gl.uniform3fv(PM.u.uSun,lk.sun); gl.uniform3fv(PM.u.uAmb,lk.amb); gl.uniform3fv(PM.u.uFog,lk.hor); gl.uniform3f(PM.u.uCam,C.x,C.y,C.z);
    const fg=o.wx?o.wx.fog||0:.1; gl.uniform1f(PM.u.uFogD,.00012+fg*fg*.0042); gl.uniform1f(PM.u.uShK,lk.shK); gl.uniform1f(PM.u.uShOn,sh?1:0); gl.uniform1f(PM.u.uTex,sh?1/sh.S:0);
    if(sh){ gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,sh.d); gl.uniform1i(PM.u.uSh,0); }
    gl.uniform3fv(PM.u.uEnvZ,lk.zen); gl.uniform3fv(PM.u.uEnvH,lk.hor); gl.uniform3fv(PM.u.uGnd,o.ground||[.45,.45,.47]); gl.uniform1f(PM.u.uOpq,1);
    if(o.fogD!=null) gl.uniform1f(PM.u.uFogD,o.fogD);
    drawAll(PM,true,false);
    if(o.glass&&o.glass.n){ // genomskinligt glas sist, utan att skriva djup
      gl.bindBuffer(gl.ARRAY_BUFFER,dynBuf); gl.bufferData(gl.ARRAY_BUFFER,o.glass.f.subarray(0,o.glass.n*FL),gl.DYNAMIC_DRAW); bindAttr(PM,true);
      gl.uniform1f(PM.u.uOpq,0); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.drawArrays(gl.TRIANGLES,0,o.glass.n); gl.depthMask(true); gl.disable(gl.BLEND); }
    let t=dynB.n/3; for(const m of meshes) t+=m.n/3; stats.tris=Math.round(t); stats.shadows=!!sh;
    return true;
  }
  // flera uppsättningar fasta nät (t.ex. varvet och straffrundan i skidskyttet)
  function use(k){ meshes=sets[k]||(sets[k]=[]); return meshes.length>0; }
  return {init, ok, clear, use, addMesh, addGrid, render, Builder, dyn:()=>dynB, stats:()=>stats, hex, LOOK};
  }
  const def=mkGL(); def.create=mkGL; return def;
})();
