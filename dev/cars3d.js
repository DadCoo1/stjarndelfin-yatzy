/* CARS3D – bilar och människor i 3D för Sommarvägen. Ritas av grafikkortet (slalomgl.js) till en genomskinlig bild
   som spelet lägger in i sin vanliga bild. Alla modeller och namn är egna – inga bilmärken, emblem eller kopierade former.
   Bilens kaross är en yta som spänns över tvärsnitt längs bilen; hjul, lyktor och människor byggs om varje bild så att de kan röra sig. */
const CARS3D=(()=>{
  const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,p)=>a+(b-a)*p;
  let G=null, cv=null, dead=false, GLASS=null, keys=[];
  const DARK=[.035,.037,.045], CHROME=[.92,.93,.95], ALLOY=[.78,.8,.84], SKIN=[.93,.72,.58], GLS=[.07,.09,.13];

  /* ---------- bilarna ----------
     K: tvärsnitt bakifrån (t=0) och framåt (t=1): [t, halv bredd, underkant, axelhöjd (skärmkant), höjd i mitten]
     cab: [t bak, t fram, halv bredd] för sittbrunnen · wh: hjulens t bak/fram · r: hjulradie */
  const CARS=[
    { id:'sol', name:'Solglimt', sub:'Sommarcab', L:4.0, r:.31, tw:.2, wh:[.2,.8], cab:[.37,.6,.6], int:[.47,.21,.05], seat:[.57,.25,.06], tail:'round2', head:'round', grille:'smile', rim:5, chromeBumper:true,
      K:[[0,.66,.36,.6,.64],[.06,.8,.25,.69,.75],[.2,.86,.2,.74,.8],[.4,.86,.2,.74,.78],[.62,.85,.2,.73,.8],[.8,.85,.2,.68,.74],[.95,.76,.25,.56,.6],[1,.6,.33,.46,.5]] },
    { id:'pil', name:'Pilen', sub:'Klassisk sportcab', L:4.3, r:.33, tw:.25, wh:[.19,.8], cab:[.42,.63,.58], int:[.08,.08,.09], seat:[.12,.12,.14], tail:'bar', head:'round', grille:'none', rim:5, exh:[[-.3,.3],[.3,.3]], hoops:false, duck:true,
      K:[[0,.7,.36,.58,.6],[.07,.9,.24,.72,.75],[.19,.97,.2,.81,.87],[.34,.95,.2,.82,.9],[.5,.9,.2,.8,.84],[.63,.87,.2,.76,.77],[.8,.88,.2,.74,.66],[.93,.8,.24,.64,.55],[1,.6,.3,.46,.44]] },
    { id:'her', name:'Hertigen', sub:'Lyxig grand tourer', L:4.9, r:.36, tw:.26, wh:[.17,.8], cab:[.33,.6,.64], int:[.86,.8,.68], seat:[.9,.85,.74], tail:'oval', head:'oval', grille:'big', rim:10, exh:[[-.55,.27],[.55,.27]], chromeTrim:true, wood:true,
      K:[[0,.76,.36,.72,.76],[.05,.9,.25,.82,.87],[.17,.96,.21,.88,.92],[.36,.96,.21,.88,.9],[.6,.95,.21,.87,.92],[.8,.95,.21,.84,.9],[.94,.88,.25,.76,.82],[1,.72,.32,.64,.7]] },
    { id:'fia', name:'Fiamma', sub:'Italiensk mittmotorspider', L:4.5, r:.35, tw:.3, wh:[.19,.8], cab:[.46,.66,.6], int:[.1,.09,.09], seat:[.5,.28,.12], tail:'round1', head:'slim', grille:'slot', rim:5, exh:[[-.42,.3],[-.3,.3],[.3,.3],[.42,.3]], intake:true, hoops:true, deckVents:true,
      K:[[0,.8,.34,.62,.64],[.05,.94,.24,.72,.75],[.19,1,.19,.79,.76],[.36,.98,.19,.78,.74],[.5,.94,.19,.72,.72],[.66,.92,.19,.66,.64],[.8,.97,.19,.66,.56],[.93,.86,.22,.52,.44],[1,.62,.27,.38,.36]] },
    { id:'ask', name:'Åskan', sub:'Kilformad superbil', L:4.6, r:.35, tw:.32, wh:[.18,.8], cab:[.48,.66,.6], int:[.07,.07,.08], seat:[.1,.1,.11], tail:'slash', head:'slash', grille:'hex', rim:6, exh:[[-.12,.44],[.12,.44],[-.34,.44],[.34,.44]], intake:true, hoops:true, angular:true, lip:true, deckVents:true,
      K:[[0,.9,.36,.7,.7],[.04,1.0,.24,.74,.74],[.18,1.02,.18,.76,.74],[.4,1.0,.18,.72,.72],[.5,.96,.18,.68,.7],[.66,.94,.18,.6,.6],[.8,.99,.18,.56,.5],[.94,.9,.2,.42,.38],[1,.7,.24,.32,.3]] },
    { id:'nor', name:'Nordanvind', sub:'Svensk hyperbil', L:4.5, r:.36, tw:.33, wh:[.18,.8], cab:[.47,.66,.56], int:[.08,.1,.14], seat:[.16,.3,.5], tail:'blade', head:'blade', grille:'slot', rim:7, exh:[[0,.5]], bigExh:true, intake:true, hoops:true, wing:true, stripe:[.98,.8,.1], deckVents:true,
      K:[[0,.84,.38,.66,.7],[.05,.98,.25,.74,.76],[.18,1.02,.18,.79,.75],[.36,.98,.18,.77,.76],[.5,.9,.18,.72,.74],[.66,.88,.18,.66,.66],[.8,1.0,.18,.66,.54],[.93,.88,.21,.5,.42],[1,.64,.26,.36,.34]] }
  ];
  // trafiken: enklare modeller med tak
  const TRAFFIC={
    car:{ L:4.4, r:.31, tw:.2, wh:[.19,.8], cab:[2,2,.6], tail:'wide', head:'slim', grille:'slot', rim:5, roof:[[.14,.74,.6,0],[.27,.72,.56,1.4],[.56,.72,.56,1.42],[.72,.74,.56,0]],
      K:[[0,.76,.34,.78,.82],[.06,.86,.25,.84,.9],[.2,.88,.2,.86,.92],[.5,.88,.2,.86,.9],[.74,.87,.2,.82,.86],[.92,.82,.24,.7,.76],[1,.68,.32,.56,.6]] },
    van:{ L:5.0, r:.34, tw:.22, wh:[.17,.8], cab:[2,2,.6], tail:'tall', head:'slim', grille:'slot', rim:5, rearWin:true,
      K:[[0,.94,.36,1.86,1.96],[.03,.99,.3,1.9,2.0],[.5,.99,.3,1.9,2.0],[.74,.98,.3,1.86,1.94],[.82,.97,.3,1.2,1.5],[.93,.94,.3,.96,1.04],[1,.84,.36,.8,.86]] }
  };

  /* ---------- tvärsnitt ---------- */
  function sec(S,t){ const K=S.K; let i=0; while(i<K.length-2&&t>K[i+1][0]) i++; const a=K[i], b=K[i+1], p=clamp((t-a[0])/(b[0]-a[0]),0,1), o=[t];
    if(S.angular){ for(let k=1;k<5;k++) o.push(lerp(a[k],b[k],p)); return o; }
    const z=K[Math.max(0,i-1)], c=K[Math.min(K.length-1,i+2)], p2=p*p, p3=p2*p;
    for(let k=1;k<5;k++){ const m0=(b[k]-z[k])/Math.max(1e-3,b[0]-z[0])*(b[0]-a[0])*.9, m1=(c[k]-a[k])/Math.max(1e-3,c[0]-a[0])*(b[0]-a[0])*.9; o.push((2*p3-3*p2+1)*a[k]+(p3-2*p2+p)*m0+(-2*p3+3*p2)*b[k]+(p3-p2)*m1); }
    return o; }
  const topY=(k,x)=>k[3]+(k[4]-k[3])*(1-Math.pow(Math.min(1,Math.abs(x)/(k[1]*.97)),2.2));
  const zOf=(S,t)=>(t-.5)*S.L;
  function prep(S){ if(S._p) return S; S._p=1; const c=S.cab, km=sec(S,(c[0]+c[1])/2);
    S.ci=Math.min(c[2],km[1]*.8); S.hb=topY(km,S.ci); S.fl=S.hb-.36; S.zs=zOf(S,c[0])+.3; S.zf=zOf(S,c[1]); S.sx=S.ci*.56; S.open=c[0]<1;
    S.wr=sec(S,S.wh[0])[1]; S.wf=sec(S,S.wh[1])[1]; S.w0=sec(S,0); return S; }

  /* ---------- karossen (fast nät) ---------- */
  function body(B,S,paint,GLb){
    prep(S); const c=S.cab, ts=[]; for(let i=0;i<=30;i++) ts.push(i/30); if(S.open) ts.push(c[0]-.004,c[0]+.004,c[1]-.004,c[1]+.004); ts.sort((a,b)=>a-b);
    const inC=t=>t>c[0]&&t<c[1], P=[], ci=S.ci;
    for(const t of ts){ const k=sec(S,t), w=k[1], y0=k[2], yb=k[3], cab=inC(t), z=zOf(S,t), cc=Math.min(ci,w*.8);
      const h=[[0,cab?S.fl:topY(k,0)],[cc*.5,cab?S.fl:topY(k,cc*.5)],[cc-.03,cab?S.fl:topY(k,cc-.03)],[cc,topY(k,cc)],[w*.88,topY(k,w*.88)],[w*.975,yb],[w,y0+(yb-y0)*.55],[w*.985,y0+(yb-y0)*.16],[w*.9,y0]];
      const row=[]; for(let i=8;i>0;i--) row.push([-h[i][0],h[i][1],z]); for(let i=0;i<9;i++) row.push([h[i][0],h[i][1],z]); P.push(row); }
    const trim=S.chromeTrim, low=[paint[0]*.55,paint[1]*.55,paint[2]*.55];
    B.loft(P,(j,i)=>{ const hq=Math.min(Math.abs(i-8),Math.abs(i-7)), cab=inC(ts[j])||inC(ts[j+1]); if(cab&&hq<=2) return S.int; if(S.stripe&&hq===0) return S.stripe; if(hq===7) return trim?CHROME:low; return paint; },
           (j,i)=>{ const hq=Math.min(Math.abs(i-8),Math.abs(i-7)), cab=inC(ts[j])||inC(ts[j+1]); return cab&&hq<=2?0:(hq===7&&trim?7:5); }, true);
    // gavlar bak och fram
    for(const e of [0,P.length-1]){ const row=P[e], k=sec(S,ts[e]), cen=[0,(k[2]+k[4])/2,row[0][2]]; for(let i=0;i<row.length-1;i++) B.tri(cen,row[i],row[i+1],paint,5); B.tri(cen,row[row.length-1],[row[row.length-1][0],k[2],cen[2]],paint,5); B.tri(cen,[row[0][0],k[2],cen[2]],row[0],paint,5); B.tri(cen,[row[0][0],k[2],cen[2]],[row[row.length-1][0],k[2],cen[2]],paint,5); }
    const zr=zOf(S,0), zn=zOf(S,1), k0=S.w0, k1=sec(S,1), yl=k0[2]+(k0[3]-k0[2])*.6;
    // hjulhus: mörk skiva bakom varje hjul
    for(const [t,w] of [[S.wh[0],S.wr],[S.wh[1],S.wf]]) for(const sd of [-1,1]){ const z=zOf(S,t), x=sd*(w+.004); B.cone([x,S.r,z],[x+sd*.004,S.r,z],S.r*1.13,0,DARK,0,18); }
    // registreringsskylt, stötfångare, avgasrör
    B.box(-.26,.26,yl-.2,yl-.08,zr-.012,zr+.02,[.96,.95,.9],0); B.box(-.26,-.21,yl-.2,yl-.08,zr-.014,zr+.02,[.12,.25,.7],0);
    if(S.chromeBumper){ B.capsule([-k0[1]*.95,k0[2]+.07,zr-.02],[k0[1]*.95,k0[2]+.07,zr-.02],.035,.035,CHROME,7,6); B.capsule([-k1[1]*.95,k1[2]+.05,zn+.02],[k1[1]*.95,k1[2]+.05,zn+.02],.035,.035,CHROME,7,6); }
    for(const e of S.exh||[]){ const r=S.bigExh?.085:.045; B.cone([e[0],e[1],zr+.08],[e[0],e[1],zr-.07],r,r,CHROME,7,10); B.cone([e[0],e[1],zr-.06],[e[0],e[1],zr-.061],r*.82,0,[.01,.01,.01],0,10); }
    if(!S.exh&&!S.roof&&!S.rearWin) for(const x of [-.34,.3]){ B.cone([x,k0[2]+.02,zr+.08],[x,k0[2]+.02,zr-.05],.035,.035,CHROME,7,8); }
    // sidointag framför bakhjulen
    if(S.intake) for(const sd of [-1,1]){ const t=S.wh[0]+(S.r+.16)/S.L, k=sec(S,t+.04), x=sd*(k[1]+.006), z=zOf(S,t); B.wall([x,k[2]+.2,z],[x,k[2]+.18,z+.5],[x,k[3]-.12,z+.42],[x,k[3]-.08,z],[sd,0,0],[.02,.02,.025],0); }
    // galler i motorluckan
    if(S.deckVents) for(let q=0;q<4;q++){ const t=S.wh[0]+.02+q*.035, k=sec(S,t), z=zOf(S,t), y=topY(k,.2)+.006; for(const sd of [-1,1]) B.quad([sd*.12,topY(k,.12)+.006,z],[sd*.4,topY(k,.4)+.006,z],[sd*.4,topY(sec(S,t+.016),.4)+.006,z+.07],[sd*.12,topY(sec(S,t+.016),.12)+.006,z+.07],[.03,.03,.035],0); }
    // läpp och vinge
    if(S.lip){ const k=sec(S,.02), y=k[4]; B.box(-k[1]*.92,k[1]*.92,y,y+.035,zr+.02,zr+.2,DARK,0); }
    if(S.duck){ const k=sec(S,.07), y=topY(k,0); B.quad([-k[1]*.8,topY(k,k[1]*.8),zr+.3],[k[1]*.8,topY(k,k[1]*.8),zr+.3],[k[1]*.78,y+.06,zr+.12],[-k[1]*.78,y+.06,zr+.12],paint,5); B.quad([-k[1]*.78,y+.06,zr+.12],[k[1]*.78,y+.06,zr+.12],[k[1]*.78,y-.02,zr+.1],[-k[1]*.78,y-.02,zr+.1],paint,5); }
    if(S.wing){ const k=sec(S,.06), y=topY(k,.5), wy=y+.34, w=k[1]*.98; for(const sd of [-1,1]){ B.box(sd*.5-.02,sd*.5+.02,y-.02,wy,zr+.2,zr+.34,DARK,0); B.box(sd*w-.015,sd*w+.015,wy-.06,wy+.1,zr+.02,zr+.4,paint,5); }
      B.quad([-w,wy+.03,zr+.38],[w,wy+.03,zr+.38],[w,wy+.07,zr+.04],[-w,wy+.07,zr+.04],DARK,0); B.quad([-w,wy,zr+.38],[w,wy,zr+.38],[w,wy+.03,zr+.04],[-w,wy+.03,zr+.04],DARK,4); }
    // fram: strålkastare och grill (syns i garaget)
    const hl=(x,y,z,r)=>{ B.sphere([x,y,z],r,[1.5,1.5,1.4],8,10,6); B.cone([x,y,z-.02],[x,y,z+.01],r*1.12,r*1.06,CHROME,7,12); };
    { const kf=sec(S,.95), x=kf[1]*.66, y=topY(kf,x)-.01, z=zOf(S,.95);
      if(S.head==='round'){ for(const sd of [-1,1]) hl(sd*x,y+.01,z+.02,.095); }
      else if(S.head==='oval'){ for(const sd of [-1,1]){ hl(sd*x,y-.02,z+.06,.1); hl(sd*x*.55,y-.05,z+.12,.07); } }
      else if(S.head==='slim'){ for(const sd of [-1,1]) B.capsule([sd*x*.62,y+.012,z+.05],[sd*x*1.12,y+.012,z-.12],.028,.022,[1.5,1.5,1.4],8,6); }
      else if(S.head==='slash'){ for(const sd of [-1,1]){ B.capsule([sd*x*.5,y+.01,z+.08],[sd*x*1.15,y+.02,z-.14],.02,.02,[1.5,1.5,1.4],8,5); B.capsule([sd*x*.8,y+.008,z+.1],[sd*x*1.2,y+.014,z-.02],.014,.014,[1.4,1.2,.5],8,5); } }
      else if(S.head==='blade'){ for(const sd of [-1,1]){ B.capsule([sd*x*.7,y+.012,z+.1],[sd*x*1.1,y+.012,z-.25],.024,.016,[1.5,1.5,1.4],8,6); } }
      const gy0=k1[2]+.03, gy1=k1[2]+(k1[3]-k1[2])*.62, gw=k1[1];
      if(S.grille==='big'){ B.box(-gw*.42,gw*.42,gy0+.04,gy1+.16,zn-.02,zn+.03,CHROME,7); B.box(-gw*.37,gw*.37,gy0+.08,gy1+.12,zn+.03,zn+.036,[.03,.03,.035],0); for(let q=-3;q<=3;q++) B.box(q*gw*.1-.008,q*gw*.1+.008,gy0+.08,gy1+.12,zn+.03,zn+.042,CHROME,7); }
      else if(S.grille==='smile'){ B.capsule([-gw*.4,gy0+.07,zn+.012],[gw*.4,gy0+.07,zn+.012],.04,.04,[.03,.03,.035],0,6); }
      else if(S.grille==='hex'){ for(const sd of [-1,1]) B.wall([sd*gw*.25,gy0,zn+.01],[sd*gw*.9,gy0,zn-.1],[sd*gw*.84,gy1,zn-.1],[sd*gw*.32,gy1-.03,zn+.01],[0,0,1],[.02,.02,.025],0); }
      else if(S.grille==='slot'){ B.wall([-gw*.6,gy0,zn+.008],[gw*.6,gy0,zn+.008],[gw*.55,gy1-.04,zn+.008],[-gw*.55,gy1-.04,zn+.008],[0,0,1],[.02,.02,.025],0); } }
    if(S.roof){ // tak med rutor (trafiken)
      const R=S.roof, ks=[]; for(let i=0;i<R.length-1;i++){ const n=i===0||i===R.length-2?1:4; for(let q=0;q<n;q++) ks.push(R[i].map((v,k)=>lerp(v,R[i+1][k],q/n))); } ks.push(R[R.length-1]);
      const Q=ks.map(r=>{ const k=sec(S,r[0]), z=zOf(S,r[0]), yb=topY(k,r[1])-.02, yr=r[3]||yb, row=[[r[1],yb],[r[2],yr-.03],[r[2]*.6,yr-.005],[0,yr]], o=[]; for(let i=0;i<4;i++) o.push([-row[i][0],row[i][1],z]); for(let i=2;i>=0;i--) o.push([row[i][0],row[i][1],z]); return o; });
      B.loft(Q,(j,i)=>(j===0||j===Q.length-2||i===0||i===5)?GLS:paint,(j,i)=>(j===0||j===Q.length-2||i===0||i===5)?6:5,true); }
    if(S.rearWin){ const y0=k0[2]+(k0[3]-k0[2])*.52, y1=k0[3]-.12; for(const sd of [-1,1]) B.wall([sd*.06,y0,zr-.006],[sd*k0[1]*.84,y0,zr-.006],[sd*k0[1]*.82,y1,zr-.006],[sd*.06,y1,zr-.006],[0,0,-1],GLS,6); B.box(-.012,.012,k0[2]+.1,k0[3]-.06,zr-.01,zr,[.3,.3,.33],0); }
    if(!S.open) return;
    // sittbrunn: instrumentbräda, säten, störtbågar, vindruta, speglar
    const hb=S.hb, zf=S.zf, zs=S.zs;
    B.box(-ci+.01,ci-.01,hb-.2,hb-.015,zf-.14,zf+.01,S.wood?[.36,.2,.09]:[.06,.06,.07],0); B.box(-ci+.02,ci-.02,hb-.2,hb-.06,zf-.17,zf-.14,[.04,.04,.05],0);
    B.box(-.07,.07,S.fl,S.fl+.2,zs-.05,zf-.14,S.int.map(v=>v*.7),0);
    for(const sd of [-1,1]){ const x=sd*S.sx; B.box(x-.2,x+.2,S.fl,S.fl+.12,zs-.1,zs+.4,S.seat,0); B.box(x-.19,x+.19,S.fl,hb+.04,zs-.2,zs-.07,S.seat,0); B.capsule([x-.125,hb+.04,zs-.135],[x+.125,hb+.04,zs-.135],.066,.066,S.seat,0,6); B.capsule([x-.05,hb+.2,zs-.15],[x+.05,hb+.2,zs-.15],.055,.055,S.seat.map(v=>v*.85),0,6); B.box(x-.015,x+.015,hb+.08,hb+.2,zs-.17,zs-.14,DARK,0);
      if(S.hoops){ let p=null; for(let q=0;q<=6;q++){ const a=q/6*Math.PI, n=[x-Math.cos(a)*.17,hb+Math.sin(a)*.3,zs-.3-Math.sin(a)*.03]; if(p) B.capsule(p,n,.022,.022,CHROME,7,5); p=n; } } }
    const wy=.38, wb=[ci+.05,hb+.005,zf+.12], wt=[ci-.03,hb+wy,zf-.2];
    GLb.quad([-wb[0],wb[1],wb[2]],[wb[0],wb[1],wb[2]],[wt[0],wt[1],wt[2]],[-wt[0],wt[1],wt[2]],[.6,.75,.85],6);
    for(const sd of [-1,1]) B.capsule([sd*wb[0],wb[1],wb[2]],[sd*wt[0],wt[1],wt[2]],.02,.018,S.chromeTrim||S.chromeBumper?CHROME:DARK,S.chromeTrim||S.chromeBumper?7:0,5);
    B.capsule([-wt[0],wt[1],wt[2]],[wt[0],wt[1],wt[2]],.018,.018,S.chromeTrim||S.chromeBumper?CHROME:DARK,S.chromeTrim||S.chromeBumper?7:0,5);
    B.box(-.06,.06,wt[1]-.07,wt[1]-.025,wt[2]-.03,wt[2]-.015,DARK,0);
    for(const sd of [-1,1]){ const kx=sec(S,c[1]+.01)[1]; B.capsule([sd*kx*.95,hb+.03,zf+.07],[sd*(kx+.06),hb+.06,zf+.05],.045,.05,paint,5,6); }
  }

  /* ---------- rörliga delar ---------- */
  function wheel(B,S,x,z,steer,spin){ const r=S.r, sd=Math.sign(x), ax=[Math.cos(steer),0,-Math.sin(steer)], xi=x-sd*S.tw, c=[(x+xi)/2,r,z], hw=S.tw/2;
    const A=k=>[c[0]+ax[0]*sd*k,r,c[2]+ax[2]*sd*k];
    B.cone(A(-hw),A(hw),r,r,[.045,.045,.05],0,16); B.cone(A(hw),A(hw+.012),r,r*.72,[.06,.06,.065],0,16); B.cone(A(hw+.012),A(hw+.004),r*.72,r*.66,ALLOY,7,16);
    B.cone(A(hw+.003),A(hw+.0031),r*.68,0,[.03,.03,.035],0,16); B.cone(A(hw+.006),A(hw+.02),r*.16,r*.1,ALLOY,7,8);
    const v=[ax[2],0,-ax[0]], n=S.rim; for(let k=0;k<n;k++){ const a=spin+k/n*6.2831853, cs=Math.cos(a), sn=Math.sin(a), h=A(hw+.012); B.capsule(h,[h[0]+v[0]*cs*r*.66,r+sn*r*.66,h[2]+v[2]*cs*r*.66],.03,.022,ALLOY,7,4); } }
  function tails(B,S,brake,night){ const k=S.w0, w=k[1], z=zOf(S,0)-.012, y=k[2]+(k[3]-k[2])*.6, c=brake?[3.2,.3,.22]:night?[1.5,.12,.1]:[.62,.04,.04], L=[];
    const dot=(x,yy,r)=>{ B.sphere([x,yy,z+r*.5],r,c,8,9,5); B.cone([x,yy,z+.012],[x,yy,z-.004],r*1.15,r*1.08,S.chromeBumper||S.chromeTrim?CHROME:DARK,S.chromeBumper||S.chromeTrim?7:0,10); L.push([x,yy,z]); };
    for(const sd of [-1,1]){
      if(S.tail==='round2'){ dot(sd*w*.42,y,.07); dot(sd*w*.72,y,.07); }
      else if(S.tail==='round1'){ dot(sd*w*.62,y+.02,.095); }
      else if(S.tail==='oval'){ B.capsule([sd*w*.5,y+.02,z],[sd*w*.74,y+.02,z],.06,.06,c,8,7); B.capsule([sd*w*.5,y+.02,z+.012],[sd*w*.74,y+.02,z+.012],.07,.07,CHROME,7,7); L.push([sd*w*.62,y+.02,z]); }
      else if(S.tail==='slash'){ for(let q=0;q<3;q++) B.capsule([sd*w*(.38+q*.16),y-.04,z],[sd*w*(.5+q*.16),y+.06,z],.02,.02,c,8,5); L.push([sd*w*.6,y,z]); }
      else if(S.tail==='blade'){ B.capsule([sd*w*.3,y+.06,z],[sd*w*.86,y+.06,z],.02,.02,c,8,5); B.capsule([sd*w*.86,y+.06,z],[sd*w*.8,y-.1,z],.02,.016,c,8,5); L.push([sd*w*.7,y+.04,z]); }
      else if(S.tail==='wide'){ B.box(sd*w*.5-.16,sd*w*.5+.16,y-.05,y+.05,z-.004,z+.02,c,8); L.push([sd*w*.5,y,z]); }
      else if(S.tail==='tall'){ B.box(sd*w*.9-.05,sd*w*.9+.05,k[2]+.25,k[2]+.6,z-.004,z+.02,c,8); L.push([sd*w*.9,k[2]+.4,z]); } }
    if(S.tail==='bar'){ B.capsule([-w*.8,y+.03,z],[w*.8,y+.03,z],.026,.026,c,8,6); L.push([-w*.55,y+.03,z],[w*.55,y+.03,z]); }
    return L; }
  function person(B,S,x,o){
    const hb=S.hb, zs=S.zs, t=o.t||0, sp=o.sp||0, shY=hb+.13, lean=(o.lean||0)*.04;
    if(o.kind==='dog'){ const bob=Math.sin(t*2.2)*.008, hd=[x+.07+lean,hb+.22+bob,zs+.14], fur=[.78,.42,.12], ear=[.45,.2,.07];
      B.sphere([x,hb-.03,zs+.16],.19,fur,0,9,6); B.capsule([x,hb+.02,zs+.15],[hd[0],hd[1]-.06,hd[2]],.1,.085,fur,0,7); B.sphere(hd,.115,fur,0,11,7);
      const sn=[hd[0]+.11,hd[1]-.035,hd[2]+.06]; B.capsule([hd[0]+.03,hd[1]-.03,hd[2]+.02],sn,.062,.046,[.93,.72,.45],0,7); B.sphere([sn[0]+.03,sn[1]+.012,sn[2]+.014],.024,[.05,.04,.04],0,6,4);
      B.capsule([sn[0]-.01,sn[1]-.04,sn[2]],[sn[0]+.01,sn[1]-.1-Math.sin(t*5)*.008,sn[2]-.01-sp*.02],.02,.016,[.95,.45,.5],0,5);
      for(const k of [-1,1]){ B.sphere([hd[0]+.075,hd[1]+.035,hd[2]+.04*k+.03],.017,[.05,.04,.04],0,5,3); const fl=Math.sin(t*1.9+k)*.5*(.3+sp), e0=[hd[0]-.01,hd[1]+.07,hd[2]+k*.085]; B.capsule(e0,[e0[0]-.03-sp*.03,e0[1]-.13*(1-sp*.75)+fl*.03,e0[2]+k*.03-sp*.13-fl*.04*k],.05,.032,ear,0,6); }
      return; }
    const hair=o.hair, shirt=o.shirt, hc=[x+lean,shY+.27,zs+.085], r=.132;
    B.capsule([x,S.fl+.2,zs+.2],[x,shY-.05,zs+.07],.15,.15,shirt,0,8); B.capsule([x-.15,shY,zs+.06],[x+.15,shY,zs+.06],.072,.072,shirt,0,7);
    B.capsule([x,shY+.03,zs+.07],[hc[0],hc[1]-.08,hc[2]-.005],.046,.046,SKIN,0,6);
    B.sphere(hc,r,SKIN,0,14,9); B.sphere([hc[0],hc[1]+.024,hc[2]-.03],r*1.045,hair,0,14,9);
    for(const k of [-1,1]) B.sphere([hc[0]+k*r*.97,hc[1]-.01,hc[2]+.012],.026,SKIN,0,5,4);
    B.sphere([hc[0],hc[1]-.015,hc[2]+r*.98],.02,SKIN,0,5,3);
    B.capsule([hc[0]-.07,hc[1]+.022,hc[2]+r*.84],[hc[0]+.07,hc[1]+.022,hc[2]+r*.84],.027,.027,[.05,.05,.07],6,6);   // solglasögon
    for(const k of [-1,1]) B.capsule([hc[0]+k*.085,hc[1]+.024,hc[2]+r*.78],[hc[0]+k*r*.98,hc[1]+.02,hc[2]+.01],.007,.007,[.05,.05,.07],0,3);
    if(o.kind==='long'){ for(let i=0;i<9;i++){ const a=(i-4)/4; let p=[hc[0]+a*.095,hc[1]+.035-Math.abs(a)*.05,hc[2]-.09];
        for(let q=0;q<4;q++){ const wv=Math.sin(t*3.1+i*.9-q*.8)*(.05+.2*sp)*(q+1)*.5, n=[p[0]+a*.02+wv*.11,p[1]-.1*(1-sp*.8)+Math.cos(t*2.3+i+q)*.02*sp,p[2]-.035-sp*.085]; B.capsule(p,n,.036-q*.006,.03-q*.006,hair,0,5); p=n; } }
      B.capsule([hc[0]-.1,hc[1]+.075,hc[2]+.02],[hc[0]+.1,hc[1]+.075,hc[2]+.02],.022,.022,[.96,.3,.55],0,5); }   // hårband
    else { B.sphere([hc[0],hc[1]+.05,hc[2]+.012],r*.93,hair,0,12,7); for(let i=0;i<4;i++){ const a=(i-1.5)*.55, w=Math.sin(t*4+i)*.012*(.4+sp); B.capsule([hc[0]+a*.06,hc[1]+r*.95,hc[2]+.03],[hc[0]+a*.09+w,hc[1]+r*1.02+w*.5,hc[2]-.07-sp*.03],.04,.025,hair,0,5); } }
    // armar
    const arm=(s0,hand,bend,up)=>{ const el=[(s0[0]+hand[0])/2+bend[0],(s0[1]+hand[1])/2+bend[1],(s0[2]+hand[2])/2+bend[2]]; B.capsule(s0,el,.052,.046,up?SKIN:shirt,0,6); B.capsule(el,hand,.042,.036,SKIN,0,6); B.sphere(hand,.042,SKIN,0,6,4); };
    if(o.drv){ const wc=[x,hb+.01,S.zf-.3], st=(o.steer||0)*1.1; for(const k of [-1,1]){ if(k<0&&o.wave){ const wv=Math.sin(o.wt*10)*.08; arm([x-.17,shY,zs+.07],[x-.33+wv,shY+.5,zs+.1],[-.1,-.1,0],true); continue; }
        const a=(k<0?Math.PI:0)-st*k*0+st; arm([x+k*.17,shY-.01,zs+.07],[wc[0]+Math.cos(a)*.16*k*(k<0?-1:1),wc[1]+Math.sin(a)*.15,wc[2]+Math.sin(a)*.06],[k*.06,-.1,0],false); } }
    else if(o.wave){ const wv=Math.sin(o.wt*12)*.09; arm([x+.17,shY,zs+.07],[x+.34+wv,shY+.52,zs+.1],[.1,-.1,0],true); }
  }
  function steering(B,S,steer){ if(!S.open) return; const x=-S.sx, wc=[x,S.hb+.01,S.zf-.3], st=steer*1.1; let p=null; for(let q=0;q<=14;q++){ const a=q/14*6.2831853, n=[wc[0]+Math.cos(a)*.16,wc[1]+Math.sin(a)*.15,wc[2]+Math.sin(a)*.06]; if(p) B.capsule(p,n,.014,.014,[.05,.05,.06],0,4); p=n; }
    B.capsule(wc,[x,S.hb-.08,S.zf-.12],.03,.03,[.05,.05,.06],0,5); B.capsule([wc[0]-Math.cos(st)*.15,wc[1]-Math.sin(st)*.14,wc[2]-Math.sin(st)*.055],[wc[0]+Math.cos(st)*.15,wc[1]+Math.sin(st)*.14,wc[2]+Math.sin(st)*.055],.012,.012,[.3,.3,.33],0,4); }

  /* ---------- grafikkortet ---------- */
  function init(){ if(dead) return false; if(G&&G.ok()) return true; if(typeof SLGL==='undefined') return false;
    try{ if(!cv) cv=document.createElement('canvas'); if(!G) G=SLGL.create(); if(!G.init(cv,{alpha:true})){ dead=true; return false; } GLASS=new SLGL.Builder(64); keys=[]; return true; }catch(e){ dead=true; return false; } }
  const ok=()=>!dead&&!!G&&G.ok();
  function size(w,h){ w=Math.round(w); h=Math.round(h); if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; } }
  // samma kamera som slalomgl: punkt → bildpunkt
  function proj(C,W,H,p){ const cy=Math.cos(C.yaw), sy=Math.sin(C.yaw), cp=Math.cos(C.pitch), sp=Math.sin(C.pitch), dx=p[0]-C.x, dy=p[1]-C.y, dz=p[2]-C.z;
    const X=cy*dx-sy*dz, Y=sy*sp*dx+cp*dy+cy*sp*dz, Z=sy*cp*dx-sp*dy+cy*cp*dz; return [W/2+C.f*X/Z,(C.cy==null?H/2:C.cy)-C.f*Y/Z,Z]; }
  const hexc=h=>SLGL.hex(h);
  const LOOKS=[ {zen:[.12,.4,.86],hor:[.86,.94,1],sunC:[1,1,1],sun:[1.05,.95,.78],amb:[.42,.5,.66],shK:.75},
    {zen:[.14,.38,.9],hor:[1,.97,.84],sunC:[1,1,1],sun:[1.08,.96,.74],amb:[.42,.5,.62],shK:.75},
    {zen:[.32,.14,.62],hor:[1,.72,.5],sunC:[1,1,1],sun:[1.1,.7,.42],amb:[.44,.34,.46],shK:.7},
    {zen:[.1,.24,.56],hor:[.9,.96,1],sunC:[1,1,1],sun:[1,.97,.9],amb:[.52,.58,.72],shK:.65},
    {zen:[.03,.02,.12],hor:[.75,.12,.4],sunC:[1,1,1],sun:[.42,.38,.62],amb:[.2,.17,.3],shK:.5} ];
  const GND=[[.46,.48,.51],[.45,.46,.49],[.38,.36,.38],[.75,.8,.86],[.21,.21,.26]];
  function sunFor(side,yaw){ const w=[side*.5,.74,-.46], l=Math.hypot(...w), x=w[0]/l, z=w[2]/l, c=Math.cos(yaw), s=Math.sin(yaw); return [x*c-z*s,w[1]/l,x*s+z*c]; }

  // spelarens bil, ritad varje bild. o: {car,color,yaw,pitch,steer,spin,brake,stage,pas,hairD,hairP,t,sp,lean,cheer,fin,wt,px}
  // ger {c: bild, w,h, ax,ay: markpunkten under bakänden, lamps:[[x,y]], m: bildpunkter per meter}
  const OUT={c:null,w:0,h:0,ax:0,ay:0,lamps:[],m:0};
  function player(o){
    if(!ok()) return null; const S=prep(CARS[o.car]||CARS[0]), key=S.id+'|'+o.color, wmax=Math.max(S.wr,S.wf);
    if(!G.use(key)){ if(keys.length>2){ const old=keys.shift(); G.use(old); G.clear(); G.use(key); } keys.push(key); const B=new SLGL.Builder(9000), Gb=new SLGL.Builder(64); body(B,S,hexc(o.color),Gb); G.addMesh(B,true); S._glass=Gb; }
    const px=Math.min(o.px,900), CW=Math.round(px*1.9), CH=Math.round(px*1.5); size(CW,CH);
    const d=7.6, yaw=o.yaw, f=px*d/(2*wmax), C={x:d*Math.sin(yaw),y:2.0+(o.pitch||0)*2,z:-d*Math.cos(yaw)-.4,yaw:-yaw,pitch:.18,f};
    const g0=proj(C,CW,CH,[0,0,zOf(S,0)]); C.cy=CH/2+(CH*.92-g0[1]);
    const B=G.dyn().reset(), night=o.stage===4;
    for(const [t,w,fr] of [[S.wh[0],S.wr,0],[S.wh[1],S.wf,1]]) for(const sd of [-1,1]) wheel(B,S,sd*(w+.035),zOf(S,t),fr?o.steer*.45:0,o.spin*sd);
    const L=tails(B,S,o.brake,night); steering(B,S,o.steer);
    person(B,S,-S.sx,{kind:'short',hair:hexc(o.hairD),shirt:[.95,.96,.98],t:o.t,sp:o.sp,lean:o.lean,drv:true,steer:o.steer,wave:o.fin&&o.cheer>0,wt:o.wt});
    if(o.pas!=='none') person(B,S,S.sx,{kind:o.pas==='dog'?'dog':'long',hair:hexc(o.hairP),shirt:[.96,.45,.7],t:o.t,sp:o.sp,lean:o.lean,wave:o.pas==='kid'&&o.cheer>0,wt:o.wt});
    const side=o.stage===1||o.stage===3?-1:1;
    G.render({C,W:CW,H:CH,sun:sunFor(side,yaw),look:LOOKS[o.stage]||LOOKS[0],ground:GND[o.stage]||GND[0],clear:true,fogD:0,focus:[0,.5,0],shadowR:3.4,shadowD:9,glass:S._glass});
    OUT.c=cv; OUT.w=CW; OUT.h=CH; OUT.ax=g0[0]; OUT.ay=CH*.92; OUT.m=f/d; OUT.lamps.length=0; for(const p of L){ const q=proj(C,CW,CH,p); OUT.lamps.push([q[0],q[1]]); }
    return OUT; }

  // stillbild till en egen 2D-bild (trafik, spöke, garage). v: {w,h,yaw,dist,height,wm (bildens bredd i meter),front,people}
  let lastGb=null;
  function still(S,color,v,reuse){
    if(!ok()) return null; prep(S); G.use('tmp'); G.clear(); size(v.w,v.h);
    const B=G.dyn(), Gb=reuse&&lastGb?lastGb:new SLGL.Builder(64); lastGb=Gb;
    if(!reuse){ B.reset(); body(B,S,hexc(color),Gb);
    for(const [t,w,fr] of [[S.wh[0],S.wr,0],[S.wh[1],S.wf,1]]) for(const sd of [-1,1]) wheel(B,S,sd*(w+.035),zOf(S,t),fr&&v.front?-.3:0,.5);
    tails(B,S,false,v.stage===4); steering(B,S,0);
    if(S.box) S.box(B,hexc(color)); }
    const d=v.dist, a=v.yaw, f=v.w*d/v.wm, s=v.front?-1:1, C={x:d*Math.sin(a)*s,y:v.height,z:-d*Math.cos(a)*s,yaw:v.front?Math.PI-a:-a,pitch:Math.atan2(v.height-(v.ty||.55),d),f};
    const g0=proj(C,v.w,v.h,[0,0,v.front?zOf(S,1)*.2:zOf(S,0)]); C.cy=v.h/2+(v.h*(v.base||.95)-g0[1]);
    G.render({C,W:v.w,H:v.h,sun:v.front?[-.45,.75,.48]:sunFor(1,a),look:LOOKS[v.stage||0],ground:GND[v.stage||0],clear:true,fogD:0,focus:[0,.6,0],shadowR:Math.max(3.4,S.L*.62),shadowD:14,glass:Gb});
    const c=document.createElement('canvas'); c.width=v.w; c.height=v.h; c.getContext('2d').drawImage(cv,0,0); return c; }

  // lastbil: hytt och skåp av lådor
  const TRUCK={ L:8.2, r:.46, tw:.3, wh:[.12,.86], cab:[2,2,.6], tail:'none', head:'none', grille:'none', rim:6, K:[[0,1.1,.5,.9,.9],[.5,1.1,.5,.9,.9],[1,1.1,.5,.9,.9]],
    box(B,paint){ const z0=-4.1; B.box(-1.2,1.2,1.0,3.5,z0,z0+5.9,[.93,.94,.96],0); B.box(-1.2,1.2,.92,1.02,z0-.01,z0+5.9,[.3,.32,.36],0); B.box(-1.21,1.21,1.4,1.75,z0+.2,z0+5.7,paint,5);
      B.box(-.02,.02,1.05,3.45,z0-.02,z0,[.6,.62,.66],0); for(const sd of [-1,1]){ B.box(sd*.6-.03,sd*.6+.03,1.2,3.3,z0-.03,z0,[.6,.62,.66],7); B.box(sd*1.0-.16,sd*1.0+.16,.62,.8,z0-.02,z0+.04,[.7,.05,.05],8); }
      B.box(-1.15,1.15,.5,.62,z0-.03,z0+.1,[.2,.2,.23],0); B.box(-1.15,1.15,.95,2.9,z0+6.1,z0+8.0,paint,5); B.wall([-1.0,1.9,z0+8.01],[1.0,1.9,z0+8.01],[1.0,2.7,z0+8.01],[-1.0,2.7,z0+8.01],[0,0,1],GLS,6);
      for(const z of [z0+1.9]) for(const sd of [-1,1]) wheel(B,TRUCK,sd*1.12,z,0,.3); } };
  // trafikens bilder: fem vinklar (-30…30°) av varje fordon
  function traffic(kind,color,pxPerM){ const S=kind==='truck'?TRUCK:TRAFFIC[kind]; if(!ok()) return null; const wm=kind==='truck'?7.4:kind==='van'?5.2:4.7, hm=kind==='truck'?4.9:kind==='van'?3.3:2.5, out=[];
    for(const deg of [-30,-15,0,15,30]){ const c=still(S,color,{w:Math.round(wm*pxPerM),h:Math.round(hm*pxPerM),yaw:deg*Math.PI/180,dist:16,height:3.2,wm,ty:kind==='truck'?1.4:.6,base:.96},out.length>0); if(!c) return null; out.push(c); }
    return {f:out,wm}; }
  // garagebild snett framifrån; låst bil visas som siluett
  function thumb(i,color,locked,w,h){ const S=CARS[i], c=still(S,color,{w,h,yaw:.66,dist:9.5,height:1.6,wm:S.L+1.1,front:true,ty:.5,base:.9}); if(!c) return null;
    if(locked){ const g=c.getContext('2d'); g.globalCompositeOperation='source-in'; g.fillStyle='rgba(20,18,50,.82)'; g.fillRect(0,0,w,h); g.globalCompositeOperation='source-over'; } return c; }
  return {CARS, init, ok, player, still, traffic, thumb};
})();
