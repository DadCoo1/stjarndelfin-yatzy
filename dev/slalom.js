/* =====================================================================
   slalom.js – Slalom och storslalom i Björnrike och Åre
   • backarna kommer från 3D-modellerna i mountain.js: Storslalombacken i
     Björnrike (Blästerfjället), Störtloppet och Gästrappet i Åre (Åreskutan).
     Backprofil, bredd, skog, omgivande fjäll, sjö och by är samma modell
     i åkarvyn, i drönarvyn och i menyns förhandsvisning.
   • bansättning enligt Svenska Skidförbundets tävlingsregler (ungdom, U14),
     sammanfattade i "Nu sätter vi bana!":
     SL (613): portbredd 4–6 m, 6–13 m mellan vändkäpparna, antal riktnings-
         ändringar 32–38 % av fallhöjden (±3), högst 4 hårnålar (2 portar)
         och 2 vertikaler (3–4 portar), öppna portar först och sist,
         fartkontroll före kombinationer, inga kombinationer i början/slutet
     GS (614): portbredd 4–8 m, minst 10 och högst 27 m till nästa port,
         riktningsändringar 13–17 % av fallhöjden, rytmisk bana med svängar
         av olika radie, inga tvära svängar, sista portarna leder mot målets mitt
     Varje bana sätts av en egen bansättare med egen stil (rytm, teknik,
     fart eller lek) – regler först, sedan personlig kreativitet.
   • åkaren är en ledad 3D-figur (skidor, ben, höft, rygg, armar, stavar,
     hjälm) som ritas från vilken kameravinkel som helst
   • ensam, parallellslalom mot datorn eller online mot en kompis
   ===================================================================== */
'use strict';
const SLALOM = (()=>{
  const DISC={
    gs:{name:'Storslalom', drag:.0046, turn:1.75, maxHead:1.0, fric:.10, panel:true,  vcap:27,   grip:30, ski:1.82},
    sl:{name:'Slalom',     drag:.0085, turn:3.2,  maxHead:1.1, fric:.07, panel:false, vcap:17.5, grip:34, ski:1.55}
  };
  function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const lerp=(a,b,t)=>a+(b-a)*t, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), smooth=t=>t*t*(3-2*t);
  const venueOf=g=>MOUNTAIN.VENUES[g&&g.venue]?g.venue:'bj';

  /* ---------- terrängen: tabeller per meter, tagna ur fjällmodellen ---------- */
  let T=null;   // {N, pitch[], y[], mid[], half[], kind[], trees[], crowd[], net[], M, z0, H0, Lr, drop}
  function terrain(g){
    const M=MOUNTAIN.get(venueOf(g)), par=!!g.par, drop=M.p.race[g.disc+(par?'p':'')], z0=M.zOfDrop(drop), Lr=M.zFin-z0, N=Math.ceil(Lr)+260, H0=M.elev(z0);
    const pitch=new Float32Array(N), half=new Float32Array(N), y=new Float32Array(N), mid=new Float32Array(N), trees=new Float32Array(N), tilt=new Float32Array(N), kind=new Array(N), crowd=new Uint8Array(N), net=new Uint8Array(N);
    for(let k=0;k<N;k++){ const zw=z0+k; mid[k]=M.mid(zw); y[k]=M.elev(zw)-H0; half[k]=M.half(zw)+(par?7:0); tilt[k]=M.tilt(zw)*Math.min(1,Math.max(0,(Lr-20-k)/60)); }
    for(let k=0;k<N;k++){ pitch[k]=Math.max(0, k<N-1 ? y[k]-y[k+1] : pitch[k-1]);
      trees[k]=Math.max(M.forest(mid[k]+half[k]+14,z0+k), M.forest(mid[k]-half[k]-14,z0+k));
      crowd[k]= k<24 || (k>Lr-140 && k<Lr+70) ? 1 : 0; }
    for(let k=0;k<N;k++){ kind[k]= pitch[k]>.37 ? 'steep' : trees[k]>.6 ? 'forest' : 'open'; net[k]= crowd[k] || pitch[k]>.36 ? 1 : 0; }
    // höjderna runt pisten räknas ut en gång per åk (rutnät 8 × 4 m, ±320 m från mittlinjen) – att fråga fjällmodellen varje bildruta är för dyrt
    const HX=81, HZ=Math.ceil(N/4)+1, hg=new Float32Array(HX*HZ); for(let j=0;j<HZ;j++){ const zz=j*4, m=M.mid(z0+zz); for(let i=0;i<HX;i++) hg[j*HX+i]=M.H(m+(i-40)*8,z0+zz)-H0; }
    return {N,pitch,y,mid,half,tilt,kind,trees,crowd,net,M,z0,H0,Lr,drop,hg,HX,HZ,rows:new Map()};
  }
  const at=(arr,z)=>{ const n=T.N-1; if(z<=0) return arr[0]; if(z>=n) return arr[n]; const i=Math.floor(z), f=z-i; return arr[i]+(arr[i+1]-arr[i])*f; };
  const mid=z=>at(T.mid,z), elev=z=>at(T.y,z), pitchAt=z=>at(T.pitch,z), halfAt=z=>at(T.half,z);
  // markens höjd var som helst: pisten är pistad och jämn, utanför den tar fjället över
  // pisten är pistad men inte platt: den lutar lite i sidled och har mjuka rullar, precis som en riktig backe
  function gy(x,z){ const m=mid(z), hw=halfAt(z), dx=x-m, d=Math.abs(dx)-hw, zw=z+T.z0, fin=Math.min(1,Math.max(0,(T.Lr-20-z)/60)), cx=d>0?Math.sign(dx)*hw:dx,
      e=elev(z)+at(T.tilt,z)*cx+(T.M.roll(m+cx,zw)-T.M.roll(m,zw))*fin;
    if(d<=0) return e; const h=hAt(dx,z); return d>=14 ? h : e+(h-e)*(d/14); }
  function hAt(dx,z){ const fi=dx/8+40, fj=z/4; if(fi<0||fi>=T.HX-1||fj<0||fj>=T.HZ-1) return T.M.H(mid(z)+dx,z+T.z0)-T.H0;
    const i=fi|0, j=fj|0, u=fi-i, v=fj-j, g=T.hg, k=j*T.HX+i; return (g[k]*(1-u)+g[k+1]*u)*(1-v)+(g[k+T.HX]*(1-u)+g[k+T.HX+1]*u)*v; }

  /* ---------- bansättning ---------- */
  // bansättarna och deras stilar: pct = var i regelns spann antalet riktningsändringar hamnar, sw = sidled, vary = hur mycket rytmen varierar
  const SETTERS=['Maja','Olle','Stina','Jonte','Ebba','Viggo','Tuva','Sixten','Alva','Nils','Signe','Melker'];
  const STYLES=[{k:'rytm',name:'jämn rytm',pct:.5,sw:1,vary:.3,combo:.45,chg:.06},{k:'teknisk',name:'teknisk och svängig',pct:.9,sw:1.13,vary:.65,combo:1,chg:.2},
    {k:'fart',name:'fartfylld och flytande',pct:.1,sw:.87,vary:.45,combo:.25,chg:.1},{k:'lekfull',name:'lekfull med rytmbyten',pct:.55,sw:1,vary:1,combo:.8,chg:.32}];
  const RULES={ gs:{lo:.13,hi:.17,dmin:10,dmax:27,wmin:4,wmax:8}, sl:{lo:.32,hi:.38,tol:3,dmin:6,dmax:13,wmin:4,wmax:6,hair:4,vert:2} };
  // en port: a,b = stängernas fötter {x,z}; aim = idealt passage-ställe
  function mkGate(a,b,col,type,aim){ return {a,b,col,type,aim, zmin:Math.min(a.z,b.z), zmax:Math.max(a.z,b.z), pass:null, hit:0}; }
  function setCourse(g){
    T=terrain(g);
    const seed=runSeed(g), d=DISC[g.disc], par=!!g.par, Lr=T.Lr, drop=T.drop, RU=RULES[g.disc], GS=g.disc==='gs';
    const r0=rng(seed^0x51ed), st=STYLES[Math.floor(r0()*STYLES.length)], setter=SETTERS[Math.floor(r0()*SETTERS.length)];
    const lanes = par ? [-8.5, 8.5] : [0], fx=(z,L)=>mid(z)+L;
    const lead = GS?30:26, tail = GS?34:22, avail=Lr-lead-tail;
    // antal riktningsändringar ur fallhöjden, inom regelns spann; stilen avgör var i spannet
    let n=Math.round(drop*lerp(RU.lo,RU.hi,par?.15:clamp(st.pct+(r0()-.5)*.25,0,1)));
    n=clamp(n,Math.ceil(drop*RU.lo),Math.floor(drop*RU.hi));
    if(GS) while(avail/n>24.5 && n<Math.floor(drop*RU.hi)) n++;
    else while(avail/n>10.3 && n<Math.floor(drop*RU.hi)+RU.tol) n++;
    const zOf=i=>lead+i*avail/n, pit=i=>pitchAt(zOf(i)), crest=i=>pitchAt(zOf(i)+10)-pitchAt(zOf(i)-10);
    /* Banan sätts i "fraser" på några portar, som en riktig bansättare tänker: jämn rytm, öppna upp (längre och rakare),
       dra ihop (tätare och tvärare, för att ta ned farten före ett brant parti eller ett krön), runda svängar tvärs backen i branten,
       rakt och fort på flacken, och ojämn rytm där varannan sväng är tvär och varannan rak. Terrängen och stilen väger valet. */
    const FIG={rytm:'jämn rytm',accel:'öppnar upp',tight:'drar ihop',cross:'runda svängar',straight:'rakt och fort',asym:'ojämn rytm'}, spec=[], used={};
    for(let i=0;i<n;){ const steep=clamp((pit(i)-.18)/.3,0,1), ahead=Math.max(crest(i+2),crest(i+3),pit(i+4)-pit(i));
      const w={rytm:1.6*(1.25-st.vary), accel:.5+(1-steep)*1.1+(ahead<-.06?1:0), tight:.3+steep*1.2+(ahead>.06?2:0), cross:steep*1.5*st.sw, straight:(1-steep)*(st.k==='fart'?2:1), asym:st.vary*1.3+(st.k==='teknisk'?.6:0)};
      if(par){ w.asym=0; w.cross*=.4; }
      let tot=0; for(const k in w) tot+=w[k]; let u=r0()*tot, fig='rytm'; for(const k in w){ u-=w[k]; if(u<=0){ fig=k; break; } }
      const len=fig==='asym'?4+2*Math.floor(r0()*2):3+Math.floor(r0()*4); used[fig]=1; const tempo=.84+r0()*.34;      // varje rytmparti har sitt eget tempo
      for(let j=0;j<len&&i<n;j++,i++){ const t=len>1?j/(len-1):0; let dd=1, oo=1;
        if(fig==='accel'){ dd=lerp(.74,1.36,t); oo=lerp(1.2,.66,t); } else if(fig==='tight'){ dd=lerp(1.26,.68,t); oo=lerp(.8,1.36,t); }
        else if(fig==='cross'){ dd=.9; oo=1.5; } else if(fig==='straight'){ dd=1.22; oo=.55; } else if(fig==='asym'){ oo=j%2?1.36:.62; dd=j%2?1.06:.94; } else { dd=tempo; oo=1.1-(tempo-1)*.8; }
        if(i<2||i>=n-3){ dd=lerp(dd,1,.7); oo=Math.min(oo,.85); }
        spec.push({d:dd,o:oo,fig}); } }
    let plan=null, hair=0, vert=0, longs=0, dels=0;
    if(!GS){
      // kombinationer: aldrig bland de första/sista fem portarna, helst inte i det brantaste eller på ett krön
      plan=new Array(n).fill('o');
      if(!par){
        const bad=i=>pit(i)>.38 || Math.abs(crest(i))>.09 || Math.abs(mid(zOf(i)+12)-mid(zOf(i)-12))>1.7;     // inte i brant, på krön eller där backen svänger
        const put=(type,len)=>{ let best=-1, bs=9; for(let t=0;t<24;t++){ const i=5+Math.floor(r0()*(n-10-len)); if(!plan.slice(i-2,i+len+2).every(x=>x==='o')) continue; const sc=(bad(i)?1:0)+(bad(i+len)?1:0)+r0()*.5; if(sc<bs){ bs=sc; best=i; } } if(best<0) return 0; for(let k=0;k<len;k++) plan[best+k]=type; return 1; };
        const nv=clamp(Math.round(.6+st.combo*1.2+(r0()-.5)),1,RU.vert), nh=clamp(Math.round(1.2+st.combo*2.4+(r0()-.5)),1,RU.hair), nl=1+Math.floor(r0()*2.6);
        for(let k=0;k<nv;k++) vert+=put('v',3+Math.floor(r0()*2));      // vertikal: 3–4 stängda portar
        for(let k=0;k<nl;k++) longs+=put('L',1);                        // "banan": lång sväng (dubbelkäpp)
        for(let k=0;k<nh;k++) hair+=put('h',2);                         // hårnål: 2 stängda portar
      }
    } else if(!par){
      // "banan" i storslalom: en lång sväng runt två portar på samma sida – den andra längre ned och längre ut
      const nd=Math.round(st.chg*5+r0()*1.4); for(let k=0;k<nd;k++){ const i=4+Math.floor(r0()*(n-9)); if(!spec[i].delay&&!spec[i-1].delay&&!spec[i+1].delay&&pit(i)<.4){ spec[i].delay=true; dels++; } }
    }
    const info={min:99,max:0};
    const note=(a,b)=>{ if(a&&b){ const q=Math.hypot(a.x-b.x,a.z-b.z); info.min=Math.min(info.min,q); info.max=Math.max(info.max,q); } };
    // k skalar avstånden så att banan fyller backen från start till mål; slumpen är densamma varje varv
    function build(k,measure){
      const r=rng(seed), out=lanes.map(()=>[]); let z=lead, side=r()<.5?1:-1, col=r()<.5?'r':'b', prevTurn=null, i=0;
      const gsGate=(zz,off,w)=>{ lanes.forEach((L,q)=>{ const s=q===1?-side:side, turn=fx(zz,L)+s*off, a={x:turn,z:zz}, b={x:turn+s*w,z:zz};
          const gt=mkGate(s>0?a:b, s>0?b:a, par?(q===0?'r':'b'):col, 'gs', {x:turn+s*1.1,z:zz}); gt.turn={x:turn,z:zz}; gt.side=s; out[q].push(gt); });
        const t={x:fx(zz,0)+side*off,z:zz}; if(measure) note(prevTurn,t); prevTurn=t; col=col==='r'?'b':'r'; };
      if(GS){
        for(;i<n;i++){
          const p=pitchAt(z+12), steep=clamp((p-.18)/.3,0,1), sp=spec[i];
          // i brant terräng: mer i sidled och kortare mellan portarna (så hålls farten nere); på flacken rakare och längre
          let dist=22*lerp(1.07,.92,steep)*sp.d*(1+(r()-.5)*.1), off=(lerp(2.7,4.5,steep)+(r()-.5)*.8)*sp.o*st.sw*(par?.85:1);
          dist=clamp(dist*k,12,26);
          if(i===0) off=Math.min(off,3);
          off=clamp(off,1.2,Math.min(dist*.27+.4, halfAt(z+dist)-6));          // inga tvära svängar, och aldrig ut mot pistkanten
          let zn=z+dist; if(pitchAt(zn+3)-pitchAt(zn-9)>.09) zn-=Math.min(5,dist-12);        // porten sätts på krönet, inte gömd bakom det
          const lat=prevTurn?Math.abs(fx(zn,0)+side*off-prevTurn.x):0; if(prevTurn&&Math.hypot(zn-prevTurn.z,lat)>26.6) zn=prevTurn.z+Math.sqrt(26.6*26.6-lat*lat);
          z=zn; gsGate(z,off,4.2+r()*3.6);
          if(sp.delay){ const dz2=clamp(12.5*k,11.5,14), off2=Math.min(off+2.4+r()*.8, halfAt(z+dz2)-5); z+=dz2; gsGate(z,off2,4.2+r()*3); }
          side=-side;
        }
      } else {
        while(i<n){
          const p=pitchAt(z+6), steep=clamp((p-.18)/.3,0,1), sp=spec[i];
          if(plan[i]==='o'||plan[i]==='L'){
            const long=plan[i]==='L';
            let off=(lerp(1.35,2.35,steep)+(r()-.5)*.5)*sp.o*st.sw;
            if(plan[i+1]&&plan[i+1]!=='o'&&plan[i+1]!=='L') off=lerp(2.7,3.3,steep);     // fartkontroll före kombination
            if(i>=n-2) off=1.5; if(par) off*=.85;
            let dz=lerp(10,8.7,steep)*sp.d*(1+(r()-.5)*.12)*k;
            if(long){ dz=Math.max(dz,11.6)+r()*.6; off+=1.1; }
            off=clamp(off,.9,3.4); dz=clamp(dz,6.6,12.2);
            const lat = prevTurn ? Math.abs((fx(z+dz,0)+side*off)-prevTurn.x) : off*2, pz=prevTurn?prevTurn.z:z;
            if(Math.hypot(z+dz-pz,lat)>12.8) dz=pz+Math.sqrt(Math.max(1,12.8*12.8-lat*lat))-z;   // vändkäpp–vändkäpp högst 13 m
            if(Math.hypot(z+dz-pz,lat)<6.3) dz=pz+Math.sqrt(Math.max(0,6.3*6.3-Math.min(39,lat*lat)))-z+.01;   // och minst 6 m
            z+=dz;
            // enkelkäpp i vanliga portar; dubbelkäpp i första/sista porten och i långsvängar (regel 613.4)
            const dbl = long || i===0 || i>=n-1, w = dbl ? 4.2+r()*1.6 : 14;
            lanes.forEach((L,q)=>{ const s=q===1?-side:side, turn=fx(z,L)+s*off, a={x:turn,z}, b={x:turn+s*w,z};
              const gt=mkGate(s>0?a:b, s>0?b:a, par?(q===0?'r':'b'):col, dbl?'open':'single', {x:turn+s*.75,z}); gt.turn={x:turn,z}; gt.side=s; out[q].push(gt); });
            const t={x:fx(z,0)+side*off,z}; if(measure) note(prevTurn,t); prevTurn=t;
            side=-side; col=col==='r'?'b':'r'; i++;
          } else {
            // stängda portar längs fallinjen: åkaren korsar linjen fram och tillbaka
            const type=plan[i]; let m=0; while(plan[i+m]===type) m++;
            const Lg=5.25+r()*.6, gap=.85+r()*.15, in0=clamp(8.6*k,7.2,9.2);
            let in1=in0; if(prevTurn){ const lat=Math.abs(fx(z+in0,0)-prevTurn.x), mx=Math.sqrt(Math.max(9,12.7*12.7-lat*lat))-Lg/2-(z-prevTurn.z); in1=clamp(Math.min(in0,mx),3.6,9.2); }
            z+=in1; const cx=fx(z,0); let from=prevTurn ? -(Math.sign(prevTurn.x-cx)||1) : side;
            for(let q=0;q<m;q++){ const za=z+q*(Lg+gap), zb=za+Lg;
              const gt=mkGate({x:cx,z:za},{x:cx,z:zb},col,'closed',{x:cx,z:(za+zb)/2}); gt.turn={x:cx,z:(za+zb)/2}; gt.from=from; gt.combo=type; from=-from; out[0].push(gt);
              if(measure) note(prevTurn,gt.turn); prevTurn=gt.turn; col=col==='r'?'b':'r'; }
            z+=m*(Lg+gap)-gap;
            side = (m%2===0) ? -side : side;     // man går ut ur kombinationen på den sida man gick in
            i+=m;
          }
        }
      }
      return {out,end:z};
    }
    let k=1, res=null; for(let it=0;it<8;it++){ res=build(k,false); const e=res.end-lead; if(Math.abs(e-avail)<3) break; k=clamp(k*avail/e,.55,1.6); }
    res=build(k,true);
    const L=Math.max(Lr, res.end+12);
    const figs=Object.keys(used).map(f=>FIG[f]); if(dels||longs) figs.push('banan'); if(hair) figs.push('hårnål'); if(vert) figs.push('vertikal');
    return {d, gates:res.out, lanes, L, info:{n, gates:res.out[0].length, drop:Math.round(drop), pct:Math.round(n/drop*1000)/10, setter, style:st.name, figs, hair, vert, longs, dels, min:info.min, max:info.max, len:Math.round(L), venue:venueOf(g)}};
  }
  // regelkontroll (används av testerna): returnerar en lista med avvikelser
  function checkCourse(C,g){ const RU=RULES[g.disc], I=C.info, bad=[], gs=C.gates[0];
    if(!g.par){ const lo=I.drop*RU.lo-(RU.tol||0)-.5, hi=I.drop*RU.hi+(RU.tol||0)+.5; if(I.n<lo||I.n>hi) bad.push(`antal ${I.n} utanför ${lo.toFixed(0)}–${hi.toFixed(0)}`); }
    if(I.min<RU.dmin-.01) bad.push('för tätt '+I.min.toFixed(2)); if(I.max>RU.dmax+.01) bad.push('för glest '+I.max.toFixed(2));
    gs.forEach((q,i)=>{ if(q.type==='closed'){ const w=q.zmax-q.zmin; if(w<4||w>6) bad.push('stängd port '+w.toFixed(2)); if(i<5||i>gs.length-6) bad.push('kombination i början/slutet'); }
      else if(q.type!=='single'){ const w=Math.abs(q.a.x-q.b.x); if(w<RU.wmin-.01||w>RU.wmax+.01) bad.push('portbredd '+w.toFixed(2)); } });
    if(g.disc==='sl'){ if(I.hair>RU.hair) bad.push('för många hårnålar'); if(I.vert>RU.vert) bad.push('för många vertikaler'); if(gs[0].type==='closed'||gs[gs.length-1].type==='closed') bad.push('stängd port först/sist'); }
    const last=gs[gs.length-1]; if(Math.abs(last.aim.x-mid(last.aim.z))>halfAt(last.aim.z)*.45) bad.push('sista porten leder inte mot målets mitt');
    if(C.gates.some(l=>l.some(q=>Math.abs(q.turn.x-mid(q.turn.z))>halfAt(q.turn.z)-2.5))) bad.push('port för nära pistkanten');
    const dz=[]; for(let i=1;i<gs.length;i++) if(gs[i].type!=='closed'&&gs[i-1].type!=='closed') dz.push(gs[i].turn.z-gs[i-1].turn.z); const mean=dz.reduce((a,b)=>a+b,0)/dz.length; I.spread=Math.sqrt(dz.reduce((a,b)=>a+(b-mean)*(b-mean),0)/dz.length)/mean; I.dzMin=Math.min(...dz); I.dzMax=Math.max(...dz);
    return bad; }

  // fröet för aktuellt åk: standardbanan är alltid densamma, annars nya frön per parti
  const runSeed=g=> g.std ? (g.disc==='gs'?[51101,51202]:[52101,52202])[(g.run||1)-1] + (g.par?7:0) + ({bj:0,st:3100,ga:6200})[venueOf(g)] : g.seeds[(g.run||1)-1];

  /* ---------- åket ---------- */
  let R=null, cv=null, ctx=null, raf=0, lastT=0, W=360, H=640, sendT=0, pend={disc:'gs',par:false,pen:true,venue:'bj'}, fresh=false;
  const keys={}; let steer=0, drag=null;
  function newRun(){
    const C=setCourse(G), me=meSeat();
    const lane=k=> G.par ? ((G.run||1)===2 ? 1-k : k) : 0;     // i parallell byter man bana till åk 2
    const mkSk=(k,isAIsk)=>({k, lane:lane(k), x: mid(2)+(C.lanes[lane(k)]||0), z:2, v:0, th:0, om:0, t:0, done:false, dsq:false, missed:0, pen:0, gi:0, ai:isAIsk, lean:0, tuck:0, straight:0, plant:0, lastSign:0, trail:[], vd:null, air:0, vyr:0, flex:0, slip:0, block:0});
    const sk = G.par ? [mkSk(0,isAI(0)&&mode==='local'), mkSk(1,isAI(1)&&mode==='local')] : [mkSk(0,false)];
    R={gid:G.id+':'+(G.go||0), wx:WEATHER.pick(runSeed(G)), wxs:WEATHER.mkState(), C, sk, me: G.par?me:0, cd:3.2, started:false, parts:[], shake:0, finishT:0, sent:false, cheer:1.5, beeped:-1, remote:null, split:null}; BDsize='';
  }
  const meSk = () => R.sk[R.me];
  // efter målgång: jubel eller deppighet beroende på hur det gick
  function moodOf(s){ if(s.dsq) return null;                              // diskad: varken jubel eller depp
    const n=R.C.gates[s.lane].length; return s.missed>=n*.5 ? 'sad' : 'cheer'; }   // grunden är jubel – depp bara om minst hälften av portarna missats

  /* ---------- inspelning, repris och höjdpunkter ---------- */
  function recEv(s,g,pass,hit){ if(R&&R.rec&&!R.play) R.rec.ev.push({t:R.rec.t, lane:s.lane, i:R.C.gates[s.lane].indexOf(g), pass, hit}); }
  function recStep(dt){
    if(!R.rec) R.rec={fr:[],ev:[],acc:0,t:0,end:null};
    const r=R.rec; r.t+=dt; if(r.end!=null && r.t>r.end) return;
    if(r.end==null && R.sk.every(k=>k.done)) r.end=r.t+3.6;
    r.acc+=dt; if(r.acc<1/20) return; r.acc=0;
    r.fr.push({t:r.t, s:R.sk.map(k=>[k.x,k.z,k.th,k.lean,k.tuck||0,k.v,k.plant||0,k.om||0,k.done?1:0,k.mood==='cheer'?1:k.mood==='sad'?2:0,k.done?(k.finish??k.t):k.t+k.pen,k.gi,k.missed,k.finish??-1,k.dsq?1:0,k.air||0,k.slip||0,k.flex||0,k.block||0])});
  }
  function applyFrame(t){
    const fr=R.rec.fr, i=REPLAY.find(fr,t), a=fr[i], b=fr[Math.min(fr.length-1,i+1)], u=b.t>a.t?clamp((t-a.t)/(b.t-a.t),0,1):0;
    R.sk.forEach((k,j)=>{ const A=a.s[j], B=b.s[j]; if(!A) return; const L=n=>A[n]+(B[n]-A[n])*u;
      k.x=L(0); k.z=L(1); k.th=L(2); k.lean=L(3); k.tuck=L(4); k.v=L(5); k.plant=A[6]; k.om=L(7); k.done=!!A[8]; k.mood=A[9]===1?'cheer':A[9]===2?'sad':null; k.t=L(10); k.pen=0; k.gi=A[11]; k.missed=A[12]; k.finish=A[13]>=0?A[13]:null; k.dsq=!!A[14]; k.air=A[15]!=null?L(15):0; k.slip=A[16]!=null?L(16):0; k.flex=A[17]!=null?L(17):0; k.block=A[18]||0; });
    for(const gs of R.C.gates) for(const g of gs){ g.pass=undefined; g.hit=0; }
    for(const e of R.rec.ev){ if(e.t>t) break; const g=R.C.gates[e.lane][e.i]; if(!g) continue; g.pass=e.pass; if(e.hit){ g.hit=1; g.hitT=performance.now()-(t-e.t)*1000; } }
  }
  function buildClips(){
    const fr=R.rec.fr, me=R.me, sk=R.sk[me], T=fr[fr.length-1].t, st=(fr.find(f=>f.s[me][5]>.6)||fr[0]).t, fin=(fr.find(f=>f.s[me][8])||fr[fr.length-1]).t;
    let vm=0, tv=st+2; for(const f of fr) if(f.t<fin && f.s[me][5]>vm){ vm=f.s[me][5]; tv=f.t; }
    const ev=R.rec.ev.filter(e=>e.lane===sk.lane), gate=e=>R.C.gates[e.lane][e.i]||{};
    const comb=ev.find(e=>e.pass&&gate(e).type==='closed'), hitE=ev.find(e=>e.hit&&e.t>st+3), missE=ev.find(e=>!e.pass);
    const out=[]; const add=c=>{ c.t0=clamp(c.t0,0,T); c.t1=clamp(c.t1,c.t0+.3,T); out.push(c); };
    add({t0:st-.4, t1:st+2.6, view:'fly', z0:.2, z1:.16, rate:1, cap:`${G.disc==='gs'?'Storslalom':'Slalom'} · ${bare(pname(sk.k))} · ${R.wx.icon} ${R.wx.name}`});
    if(comb) add({t0:comb.t-1.7, t1:comb.t+1.1, view:'close', z0:.13, z1:.03, a0:.3, a1:1.3, rate:.45, cap:'Rakt genom vertikalen!', slow:1});
    else if(hitE) add({t0:hitE.t-1.3, t1:hitE.t+.7, view:'close', z0:.11, z1:.02, a0:-.6, a1:.5, rate:.35, cap:'Käppen viker sig!', slow:1});
    add({t0:tv-1.6, t1:tv+1.3, view:'low', z0:.06, z1:.06, a0:-.4, a1:.4, rate:.55, cap:`Toppfart ${Math.round(vm*3.6)} km/h`, slow:1});
    const tm=(st+fin)/2; add({t0:tm-1.4, t1:tm+1.6, view:'orbit', z0:.24, z1:.12, a0:-2.7, a1:-1.0, rate:.75});
    if(missE) add({t0:missE.t-1.3, t1:missE.t+.9, view:'top', z0:.28, z1:.2, rate:.6, cap:'Oj – missad port…'});
    add({t0:fin-1.9, t1:fin+.35, view:'front', z0:.22, z1:.05, rate:.5, slow:1, cap:sk.dsq?'Ur…':`I mål: ${fmt(sk.finish??0)}`});
    add({t0:fin+.35, t1:Math.min(T,fin+3.3), view:'close', z0:.05, z1:.03, a0:-.7, a1:1.7, rate:.85, cap:sk.mood==='cheer'?'🎉 Jubel!':'Nästa gång! 💪'});
    out.sort((a,b)=>a.t0-b.t0); const res=[]; for(const c of out){ const p=res[res.length-1]; if(p && c.t0<p.t1){ if(c.t1-p.t1<.8) continue; c.t0=p.t1; } res.push(c); }
    return res;
  }
  function startPlay(mode){
    if(!R||!R.rec||R.rec.fr.length<10){ toast('Ingen inspelning ännu'); return; }
    const T0=R.rec.fr[R.rec.fr.length-1].t, clips=mode==='hl'?buildClips():null;
    R.play={mode, t:clips?clips[0].t0:0, T:T0, speed:1, playing:true, clips, ci:mode==='hl'?0:-1, rt:0, flash:0}; R.camO=mode==='hl'; if(clips) DSO.cut=true;
    sndOff(); render();
  }
  function stopPlay(){ if(!R||!R.play) return; R.play=null; R.camO=false; applyFrame(R.rec.fr[R.rec.fr.length-1].t); render(); }
  function playStep(dt){
    const p=R.play; let rate=1; p.rt+=dt; p.flash=Math.max(0,p.flash-dt*3);
    const INTRO=PHOTO?2.6:0; if(p.mode==='hl' && p.rt<INTRO){ applyFrame(p.t); return; }
    if(p.mode==='hl' && p.done){ p.outro=(p.outro||0)+dt; }
    if(p.mode==='hl' && p.playing){ let c=p.clips[p.ci];
      if(!c || p.t>=c.t1-1e-3){ p.ci++; c=p.clips[p.ci]; if(!c){ p.playing=false; p.done=true; p.ci=p.clips.length-1; c=p.clips[p.ci]; REPLAY.refresh('sl',p); } else { p.t=c.t0; p.flash=.9; DSO.cut=true; tone(880,.06,'sine',.05); } }
      if(c){ const u=clamp((p.t-c.t0)/Math.max(.01,c.t1-c.t0),0,1); rate=c.rate; DSO.view=c.view; DSO.zoom=lerp(c.z0,c.z1,smooth(u)); DSO.ang=lerp(c.a0||0,c.a1||0,u); DSO.k=u; DSO.fast=6; p.cap=c.cap; p.capA=Math.min(u*5,(1-u)*5,1); p.slow=!!c.slow; } }
    if(p.playing){ p.t=Math.min(p.T,p.t+dt*p.speed*rate); if(p.mode==='replay'&&p.t>=p.T){ p.playing=false; REPLAY.refresh('sl',p); } }
    applyFrame(p.t);
    const s=meSk(); if(p.playing && !s.done && Math.abs(s.om)>.45 && s.v>5){ R.parts.push({x:s.x-Math.sign(s.om)*.5, z:s.z+.3, y:.05, vx:-Math.sign(s.om)*(2+Math.random()*4)*Math.min(1,s.v/14), vz:s.v*.25, vy:1+Math.random()*2.6, t:.55, r:.7+Math.random()*.8}); }
    if(R.parts.length>180) R.parts.splice(0,R.parts.length-180);
    if((p.syncT=(p.syncT||0)+dt)>.25){ p.syncT=0; REPLAY.sync('sl',p); }
  }
  REPLAY.register('sl',(a,v)=>{ if(!R||!R.play) return; const p=R.play;
    if(a==='close'){ stopPlay(); return; }
    if(a==='play'){ if(p.done){ p.done=false; p.ci=0; p.t=p.clips[0].t0; p.rt=0; p.outro=0; DSO.cut=true; } else if(p.mode==='replay'&&p.t>=p.T-.01) p.t=0; p.playing=!p.playing||p.ci===0&&p.rt===0; }
    if(a==='speed') p.speed={1:.5,.5:.25,.25:2,2:1}[p.speed]||1;
    if(a==='seek'){ p.t=v*p.T; }
    REPLAY.refresh('sl',p); });

  /* ---------- fysik ---------- */
  function crossed(g,px,pz,x,z){
    if(g.type==='closed'){ if((px-g.a.x)*(x-g.a.x)>0) return null; const f=(g.a.x-px)/((x-px)||1e-6), zc=pz+(z-pz)*f; return (zc>=g.zmin-.35&&zc<=g.zmax+.35) ? Math.min(Math.abs(zc-g.zmin),Math.abs(zc-g.zmax)) : -1; }
    if(pz>g.zmin||z<g.zmin) return null; const f=(g.zmin-pz)/((z-pz)||1e-6), xc=px+(x-px)*f, lo=Math.min(g.a.x,g.b.x), hi=Math.max(g.a.x,g.b.x);
    return (xc>=lo-.35&&xc<=hi+.35) ? Math.min(Math.abs(xc-lo),Math.abs(xc-hi)) : -1;
  }
  function physics(s,dt,input){
    const d=R.C.d, G0=9.81;
    if(s.done){ s.v=Math.max(0,s.v-12*dt); s.th*=Math.pow(.15,dt); s.vd=s.th; s.z+=s.v*Math.cos(s.th)*dt; s.x+=s.v*Math.sin(s.th)*dt; s.lean*=Math.pow(.1,dt); s.tuck=Math.max(0,s.tuck-dt*2);
      s.air=Math.max(0,(s.air||0)-dt*3); s.slip=0; s.flex=(s.flex||0)*Math.pow(.05,dt); return; }
    if(s.vd==null){ s.vd=s.th; s.air=0; s.vyr=0; s.flex=0; s.slip=0; s.block=0; }
    const air=s.air>.015;
    const target = input*d.maxHead;
    // skidorna vrids dit man styr; i luften går det trögt
    const om = clamp((target-s.th)*7, -d.turn, d.turn)*(air?.3:1);
    s.th += om*dt; s.om=om;
    const p=pitchAt(s.z), sinP=p/Math.sqrt(1+p*p), cosP=1/Math.sqrt(1+p*p);
    // backens krökning: över ett krön blir åkaren lätt (mindre grepp) eller lättar helt från snön
    const dth=(Math.atan(pitchAt(s.z+Math.max(1.5,s.v*.1)))-Math.atan(p))/Math.max(1.5,s.v*.1)*s.v;      // rad/s, + = brantare
    const nrm=G0*cosP - s.v*dth;                                                                       // normalkraft per kg
    if(!air && nrm<-.4 && s.v>9){ s.air=.02; s.vyr=Math.min(2.2,-nrm*.1); }
    if(s.air>0){ s.vyr+=(s.v*dth-G0*cosP)*dt; s.air+=s.vyr*dt;
      if(s.air<=0){ const imp=Math.abs(s.vyr); s.air=0; s.vyr=0; s.flex=Math.min(1,(s.flex||0)+imp*.3); s.v*=1-Math.min(.05,imp*.012); s.land=imp;
        if(s===meSk()&&imp>1){ burst(.14,'lowpass',500,Math.min(.2,imp*.05),.8); buzz(12); } } }
    const load=air?0:clamp(nrm/G0,0,2.2);
    // fartriktningen följer skidorna så fort kanterna greppar: skär man för hårt för farten sladdar skidorna
    const grip=d.grip*Math.min(1,.35+load*.7), slip0=s.th-s.vd, rate=grip/Math.max(s.v,4);
    const dvd=clamp(om+slip0*14,-rate,rate); s.vd+=dvd*dt; s.slip=s.th-s.vd;
    if(!air){ const cs=(gy(s.x+.6,s.z)-gy(s.x-.6,s.z))/1.2; s.vd+=-G0*cs*Math.cos(s.vd)/Math.max(s.v,5)*dt*.8; s.cross=cs; }
    // fartställning: i storslalom på raka partier, i båda grenarna mot mål
    s.straight = Math.abs(om)<.25 ? s.straight+dt : 0;
    const wantTuck = (s.straight>.35 && s.v>8 && (d.panel || s.z>R.C.L-45)) ? 1 : 0;
    s.tuck += (wantTuck-s.tuck)*Math.min(1,dt*4);
    const upright=(1-s.tuck)*Math.min(1,Math.abs(om)/d.turn), sk=Math.min(1,Math.abs(s.slip)*2.4);
    const a = G0*sinP*Math.cos(s.vd) - d.drag*(1-.4*s.tuck+.15*upright)*s.v*s.v - (air?0:d.fric*Math.abs(dvd)*s.v + sk*sk*s.v*.55) - (s.dragExtra||0);
    s.v = Math.max(0, s.v + a*dt);
    if(s.v<1.5) s.v=Math.min(1.5,s.v+dt*2);
    const pz=s.z, px=s.x;
    s.z += s.v*Math.cos(s.vd)*dt; s.x += s.v*Math.sin(s.vd)*dt; s.t += dt;
    // kantning/inklination följer centripetalkraften (v·ω), med lite tröghet; benen fjädrar med belastningen
    const want=air?0:clamp(s.v*dvd/(G0*.9), -1.25, 1.25);
    s.lean += (want - s.lean)*Math.min(1,dt*9);
    const gl=Math.hypot(load,s.v*dvd/G0);
    s.flex += (clamp((gl-1)*.55,0,1)-s.flex)*Math.min(1,dt*(gl>1.3?10:5));
    const sg=Math.sign(om); if(sg && sg!==s.lastSign && Math.abs(om)>.5){ s.lastSign=sg; s.plant=1; if(s===meSk()) edgeSfx(s.v); }
    s.plant=Math.max(0,s.plant-dt*3); s.block=Math.max(0,(s.block||0)-dt*3.2);
    // utanför pisten: djupsnö bromsar, skogen stoppar
    const off=Math.abs(s.x-mid(s.z))-halfAt(s.z);
    if(off>0) s.v*=Math.pow(.45,dt);
    if(off>4){ s.x=mid(s.z)+Math.sign(s.x-mid(s.z))*(halfAt(s.z)+4); s.th*=.4; s.vd=s.th; }
    // portar i tur och ordning
    const gs=R.C.gates[s.lane];
    let g=gs[s.gi];
    // slalom: handen går fram för att blocka käppen strax innan åkaren är framme
    if(g && !d.panel && g.zmin-s.z<s.v*.16 && g.zmin>s.z && Math.abs(s.x-g.turn.x)<1.5) s.block=Math.max(s.block||0,.85);
    while(g){
      const c=crossed(g,px,pz,s.x,s.z);
      if(c!==null && c>=0){ g.pass=true; recEv(s,g,true,c<.5); if(c<.5){ g.hit=1; g.hitT=performance.now(); s.v*=.975; s.block=1; if(s===meSk()) poleSfx(); } else if(c<1.05 && !d.panel && g.type!=='closed'){ g.hit=1; g.hitT=performance.now(); s.block=1; if(s===meSk()) poleSfx(); } s.gi++; }
      else if(c===-1 && g.type!=='closed' || s.z>g.zmax+(g.type==='closed'?1.5:3)){ miss(s,g); s.gi++; }
      else break;
      if(s===meSk() && s.gi===Math.floor(gs.length/2) && !R.split) R.split=s.t;
      g=gs[s.gi];
    }
    if(!s.done && s.z>=R.C.L){ s.done=true; s.finish=s.t+s.pen; s.mood=moodOf(s); if(s===meSk()) finishSfx(); }
    s.trail.push(s.x, s.z); if(s.trail.length>400) s.trail.splice(0,2);
  }
  function miss(s,g){ g.pass=false; s.missed++; recEv(s,g,false,false);
    if(G.pen){ s.pen+=3; if(s===meSk()){ toast('Missad port +3 s',1300); sfx.unbubble(); } }
    else if(!s.dsq){ s.dsq=true; s.done=true; s.mood=null; if(s===meSk()){ toast('Ur! Missad port 😬',2200); sfx.unbubble(); } } }

  // datorn: siktar på nästa ports idealpassage och glider mot nästa i tid
  const AILV={easy:{gain:1.5,late:.5,slow:.45,cap:.78}, medium:{gain:1.55,late:.46,slow:.2,cap:.88}, hard:{gain:1.6,late:.43,slow:0,cap:1}};
  function aiInput(s,lv,dt){
    const P=AILV[lv]||AILV.medium, gs=R.C.gates[s.lane], d=R.C.d;
    const g=gs[s.gi]; if(!g) return clamp((mid(s.z+20)-s.x)*.08,-.5,.5);
    let tx=g.aim.x, tz=g.aim.z;
    const nx=gs[s.gi+1], lead=s.v*(P.late+(d.panel?0:.07));
    if(g.type==='closed'){ const dir=Math.sign(g.a.x-s.x)||1; tx=g.a.x+dir*1.15; tz=clamp(s.z+3, g.zmin+.8, g.zmax-.8); }
    else if(nx && g.zmin-s.z < lead){ const f=1-(g.zmin-s.z)/lead; tx=tx+(nx.aim.x-tx)*f*.5; const lo=Math.min(g.a.x,g.b.x), hi=Math.max(g.a.x,g.b.x); tx=clamp(tx,lo+.6,hi-.6); }
    const want=Math.atan2(tx-s.x, Math.max(1.2,tz-s.z));
    // farten anpassas efter hur tvär nästa sväng är: v² / radie får inte överstiga kantgreppet (annars sladdar skidorna)
    let vlim=d.vcap*P.cap; if(nx){ const lat=Math.max(.6,Math.abs(nx.aim.x-g.aim.x)), dzz=Math.max(3,nx.aim.z-g.aim.z), Rr=2*dzz*dzz/(9.87*lat); vlim=Math.min(vlim,Math.sqrt(d.grip*1.2*Rr)*(.9+.1*P.cap)); }
    s.dragExtra=(s.v>vlim?3.2:0)+P.slow;
    return clamp(want*P.gain/d.maxHead,-1,1);
  }

  /* ---------- ljud ---------- */
  let snd=null;
  function sndInit(){ if(snd||sfxOff()||!AC) return; try{
      const mk=(sec,type,freq,q)=>{ const s=AC.createBufferSource(); s.buffer=noiseBuf(sec); s.loop=true; const f=AC.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q; const g=AC.createGain(); g.gain.value=0; s.connect(f).connect(g).connect(AC.destination); s.start(); return {f,g}; };
      snd={ wind:mk(2,'lowpass',600,.7), carve:mk(1.5,'bandpass',1400,1.4), skid:mk(1.3,'highpass',3200,.5), glide:mk(1.7,'bandpass',420,.8) };
    }catch(e){ snd=null; } }
  function sndUpdate(s){ if(!snd) return; const t=AC.currentTime, v=s.done?0:s.v, om=Math.abs(s.om||0), d=R.C.d;
    const carve=clamp(om*v/22,0,1), skid=clamp((om/d.turn-.55)*2.2,0,1)*clamp(v/10,0,1);
    snd.wind.g.gain.setTargetAtTime(Math.min(.08,v*v*.00011*(1+s.tuck*.6)),t,.15);
    snd.carve.g.gain.setTargetAtTime(carve*.16,t,.05); snd.carve.f.frequency.setTargetAtTime(900+v*45+carve*500,t,.05);
    snd.skid.g.gain.setTargetAtTime(skid*.11,t,.04);
    snd.glide.g.gain.setTargetAtTime(clamp(v/25,0,1)*.035,t,.2); }
  function sndOff(){ if(!snd) return; const t=AC.currentTime; for(const k in snd) snd[k].g.gain.setTargetAtTime(0,t,.1); }
  function burst(sec,type,freq,vol,q=1){ if(sfxOff()||!AC) return; try{ const t=AC.currentTime, s=AC.createBufferSource(), f=AC.createBiquadFilter(), g=AC.createGain();
    s.buffer=noiseBuf(sec); f.type=type; f.frequency.value=freq; f.Q.value=q; g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+sec);
    s.connect(f).connect(g).connect(AC.destination); s.start(t); s.stop(t+sec+.05); }catch(e){} }
  function edgeSfx(v){ burst(.16,'bandpass',1800+v*30,Math.min(.14,.04+v*.004),1.2); }        // "schh" i kantbytet
  function poleSfx(){ tone(1300,.05,'square',.05); hit(0,2400,.22,.03); buzz(10); }
  function cheer(vol){ burst(1.3,'bandpass',950,vol,.5); burst(1.1,'bandpass',1900,vol*.5,.7); if(Math.random()<.6) [0,.18,.42].forEach(w=>tone(1180+Math.random()*80,.35,'triangle',vol*.35,w)); }
  function finishSfx(){ [523,659,784,1047].forEach((f,i)=>tone(f,.25,'triangle',.09,i*.1)); cheer(.3); }

  /* ---------- förritade bilder (fjäll, dal, träd, publik) ---------- */
  const SPR={};
  function off(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return [c,c.getContext('2d')]; }
  function makeTree(kind){
    const [c,x]=off(80,150); const cx=40;
    if(kind==='birch'){ x.strokeStyle='#e8e2d6'; x.lineWidth=5; x.beginPath(); x.moveTo(cx,150); x.lineTo(cx-3,40); x.stroke(); x.strokeStyle='#3b3a37'; x.lineWidth=1.5; for(let y=60;y<145;y+=13){ x.beginPath(); x.moveTo(cx-4,y); x.lineTo(cx+1,y+2); x.stroke(); }
      x.strokeStyle='#6b5b52'; x.lineWidth=1.3; for(let k=0;k<14;k++){ const y=40+k*6, s=k%2?1:-1; x.beginPath(); x.moveTo(cx-2,y); x.quadraticCurveTo(cx+s*12,y-4,cx+s*(16+k%3*4),y+10); x.stroke(); }
      x.fillStyle='rgba(255,255,255,.85)'; for(let k=0;k<10;k++){ x.beginPath(); x.ellipse(cx+(k%2?10:-10)+(k*3%7-3),48+k*8,6,2.4,0,0,7); x.fill(); }
      return c; }
    // gran med snö – mörka lager, ljusa snökanter
    x.fillStyle='#3d2b1f'; x.fillRect(cx-3,128,6,22);
    const layers=7;
    for(let i=0;i<layers;i++){ const t=i/(layers-1), y=10+t*112, w=8+t*30;
      x.fillStyle=i%2?'#1f4d3a':'#245a43'; x.beginPath(); x.moveTo(cx,y-14); x.lineTo(cx-w,y+12); x.quadraticCurveTo(cx,y+4,cx+w,y+12); x.closePath(); x.fill();
      x.fillStyle='#163a2c'; x.beginPath(); x.moveTo(cx,y-14); x.lineTo(cx+w,y+12); x.quadraticCurveTo(cx+w*.5,y+8,cx+2,y+6); x.closePath(); x.fill();
      x.fillStyle='rgba(248,252,255,.95)'; x.beginPath(); x.moveTo(cx-w*.9,y+9); x.quadraticCurveTo(cx-w*.3,y+1,cx+w*.15,y+5); x.quadraticCurveTo(cx-w*.3,y+7,cx-w*.9,y+11); x.fill();
      x.fillStyle='rgba(205,225,245,.9)'; x.beginPath(); x.moveTo(cx+w*.2,y+5); x.quadraticCurveTo(cx+w*.6,y+3,cx+w*.85,y+10); x.quadraticCurveTo(cx+w*.5,y+8,cx+w*.2,y+7); x.fill(); }
    x.fillStyle='#fff'; x.beginPath(); x.ellipse(cx,4,3.5,6,0,0,7); x.fill();
    return c;
  }
  const JACKETS=['#e11d48','#2563eb','#f59e0b','#16a34a','#7c3aed','#0891b2','#f97316','#db2777','#facc15','#334155'];
  function makeFan(i){
    const [c,x]=off(26,56); const col=JACKETS[i%JACKETS.length], hat=JACKETS[(i*3+2)%JACKETS.length];
    x.fillStyle='#1e293b'; x.fillRect(8,40,4,14); x.fillRect(14,40,4,14);
    x.fillStyle=col; x.beginPath(); x.roundRect(5,20,16,23,5); x.fill();
    x.fillStyle='rgba(0,0,0,.18)'; x.fillRect(13,20,8,23);
    const up=i%3===0; x.strokeStyle=col; x.lineWidth=4; x.lineCap='round'; x.beginPath();
    if(up){ x.moveTo(6,23); x.lineTo(1,8); x.moveTo(20,23); x.lineTo(25,8); } else { x.moveTo(6,24); x.lineTo(3,36); x.moveTo(20,24); x.lineTo(23,36); } x.stroke();
    x.fillStyle='#f5d0b5'; x.beginPath(); x.arc(13,14,6,0,7); x.fill();
    x.fillStyle=hat; x.beginPath(); x.arc(13,12,6.3,Math.PI,0); x.fill(); x.beginPath(); x.arc(13,4.5,2.6,0,7); x.fill();
    if(i%5===1){ x.fillStyle='#fff'; x.fillRect(1,0,1.5,9); }   // liten flagga
    return c;
  }
  // bakgrunden: himmel, rundade fjäll, dalen med byn och kyrkan
  function makeBackdrop(w,h){
    const hz=Math.round(h*HZ), vb=Math.round(h*VB);
    const [c,x]=off(w*2, hz+vb+4);
    const g=x.createLinearGradient(0,0,0,hz); g.addColorStop(0,'#5b8fd6'); g.addColorStop(.55,'#a9c7ee'); g.addColorStop(.85,'#f6d5d9'); g.addColorStop(1,'#ffe3c4');
    x.fillStyle=g; x.fillRect(0,0,c.width,hz+vb+4);
    // låg vintersol
    const sx=c.width*.62, sy=hz*.82; const sg=x.createRadialGradient(sx,sy,2,sx,sy,hz*.6); sg.addColorStop(0,'rgba(255,240,200,.95)'); sg.addColorStop(.12,'rgba(255,214,170,.6)'); sg.addColorStop(1,'rgba(255,214,170,0)'); x.fillStyle=sg; x.fillRect(0,0,c.width,hz+vb);
    // moln i animestil
    const cl=(cx,cy,s)=>{ x.fillStyle='rgba(255,255,255,.85)'; [[0,0,1],[.9,-.25,.8],[1.7,.05,.7],[-.8,.1,.7]].forEach(([dx,dy,r])=>{ x.beginPath(); x.arc(cx+dx*s,cy+dy*s,r*s*.7,0,7); x.fill(); }); x.fillStyle='rgba(214,224,245,.55)'; x.fillRect(cx-s*1.2,cy+s*.25,s*3.1,s*.2); };
    cl(c.width*.18,hz*.22,26); cl(c.width*.47,hz*.12,18); cl(c.width*.8,hz*.3,22); cl(c.width*1.15,hz*.18,24); cl(c.width*1.6,hz*.26,20);
    // fjäll: tre lager mjuka rundade toppar (Vemdalsfjällen – kalfjäll ovan trädgränsen)
    const fell=(base,amp,seed,colTop,colShade,tree)=>{ const r=rng(seed); const pts=[]; let p=0; const N=9;
      for(let i=0;i<=N;i++){ const xx=i/N*c.width; const top=base-amp*(.45+.55*Math.abs(Math.sin(i*1.1+seed)))*(.8+r()*.4); pts.push([xx,top]); }
      x.beginPath(); x.moveTo(0,hz+2); x.lineTo(pts[0][0],pts[0][1]);
      for(let i=1;i<pts.length;i++){ const [a,b]=pts[i-1], [cxx,cy]=pts[i]; x.bezierCurveTo(a+(cxx-a)*.45,b,a+(cxx-a)*.55,cy,cxx,cy); }
      x.lineTo(c.width,hz+2); x.closePath();
      const gg=x.createLinearGradient(0,base-amp,0,hz); gg.addColorStop(0,colTop); gg.addColorStop(1,colShade); x.fillStyle=gg; x.fill();
      // skuggsida med cel-skuggning
      x.save(); x.clip();
      for(let i=0;i<pts.length;i++){ const [px,py]=pts[i]; const sg=x.createRadialGradient(px+c.width/N*.35,py+(hz-py)*.55,4,px+c.width/N*.35,py+(hz-py)*.55,c.width/N*.55);
        sg.addColorStop(0,'rgba(120,128,205,.30)'); sg.addColorStop(1,'rgba(120,128,205,0)'); x.fillStyle=sg; x.fillRect(px-c.width/N,py,c.width/N*2,hz-py); }
      if(tree){ // skog nedanför trädgränsen
        x.fillStyle=tree; const tl=base-amp*.15; for(let xx=0;xx<c.width;xx+=3){ const y=tl+Math.sin(xx*.05+seed)*4+r()*3; x.fillRect(xx,y,3,hz-y+2); }
        x.fillStyle='rgba(255,255,255,.35)'; for(let xx=0;xx<c.width;xx+=7){ const y=tl+Math.sin(xx*.05+seed)*4+r()*14; x.fillRect(xx,y,2,1.5); } }
      x.restore();
      x.strokeStyle='rgba(90,110,160,.25)'; x.lineWidth=1.2; x.stroke();
    };
    fell(hz*.8,hz*.16,3,'#eef1fb','#c3c9e6',null); fell(hz*.94,hz*.1,11,'#dfe7f5','#b3c1de',null);
    // det nära landskapet (dal, sjö, by, fjället man åker på) ritas i 3D ur fjällmodellen – här bara himlen och de fjärran fjällen
    const vg=x.createLinearGradient(0,hz,0,hz+vb); vg.addColorStop(0,'#c4d2e6'); vg.addColorStop(1,'#d5e0f0'); x.fillStyle=vg; x.fillRect(0,hz,c.width,vb+4);
    // ljusare dis närmast
    const hz2=x.createLinearGradient(0,hz-6,0,hz+vb); hz2.addColorStop(0,'rgba(255,236,226,.45)'); hz2.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=hz2; x.fillRect(0,hz-6,c.width,vb+10);
    return c;
  }
  function sprites(){ if(SPR.ok) return; SPR.tree=[makeTree('spruce'),makeTree('spruce2'),makeTree('birch')]; SPR.fan=Array.from({length:12},(_,i)=>makeFan(i)); SPR.ok=1; }


  /* ---------- projektion med höjd ---------- */
  const HZ=.30, VB=.09, CAMH=2.9, BACK=5.2, ZMAX=200;
  let cam={x:0,z:0,y:0,yaw:0,roll:0,pitch:.3}, F=500, YA=400, back=5.2, camD=0, camMode=lsGet('sl_cam')||'rider';
  const DS=DRONE.make('sl_dr'), DSO=DRONE.make('sl_dro',true); DS.rail=k=>{ const z=k*150+95, sd=k%2?1:-1, x=mid(z)+sd*(halfAt(z)+9); return [x,gy(x,z)+5.5,z]; }; let DCUR=DS; let DM=false, DZA=0, DZB=0, VIEWK='back', FLIP=false;
  function P3(x,y,z){ if(DM) return DRONE.proj(DCUR.C,x,y,z); const dz=z-cam.z; if(dz<.3) return null; const xs=x-cam.x-dz*Math.tan(cam.yaw);
    return [W/2 + xs*F/dz, YA + F*((cam.y-y)/dz - Math.tan(cam.pitch)), F/dz, dz]; }
  function P(x,z,h=0){ return P3(x,gy(x,z)+h,z); }
  // fjället i 3D bakom och runt backen
  const weakDev=()=>{ try{ return document.body.classList.contains('weak') || (navigator.hardwareConcurrency||8)<=2; }catch(e){ return false; } };
  try{ MOUNTAIN.setLow((navigator.hardwareConcurrency||8)<=2 || (navigator.deviceMemory||8)<=2); }catch(e){}
  // projektion utan att skapa minne (fjällets alla hörn räknas om varje bildruta)
  function drawMountain(){ const z0=T.z0;
    if(DM){ const C=DCUR.C, cy=Math.cos(C.yaw), sy=Math.sin(C.yaw), cp=Math.cos(C.pitch), sp=Math.sin(C.pitch), f=C.f, w2=C.W/2, h2=C.H/2, cx=C.x, cyy=C.y, cz=C.z+z0;
      MOUNTAIN.draw(ctx,T.M.F,(x,y,z,o)=>{ const dx=x-cx, dy=y-cyy, dz=z-cz, X=dx*cy-dz*sy, Z0=dx*sy+dz*cy, Z=-dy*sp+Z0*cp; if(Z<1) return -1; o[0]=w2+X*f/Z; o[1]=h2-(dy*cp+Z0*sp)*f/Z; return Z; },W,H,T.H0,false,cx,cz,Math.min(140,60*f/(Math.min(W,H)*1.08))); }
    else { const cx=cam.x, cz=cam.z+z0, ty=Math.tan(cam.yaw), tp=Math.tan(cam.pitch), cyy=cam.y;
      MOUNTAIN.draw(ctx,T.M.F,(x,y,z,o)=>{ const dz=z-cz; if(dz<1) return -1; o[0]=W/2+(x-cx-dz*ty)*F/dz; o[1]=YA+F*((cyy-y)/dz-tp); return dz; },W,H,T.H0,false,cx,cz,130); } }
  const OUT=[0,14,45,130,260];

  /* ---------- ritning ---------- */
  let BD=null, BDsize='', lastYH=0;
  const now=()=>performance.now()/1000;
  function drawScene(dt){
    const DD = R.camO ? DSO : DS.on ? DS : null; if(DD){ drawDrone(dt,DD); return; }
    const s=meSk(), C=R.C;
    // drönarvyn: kameran glider upp och bakåt, tittar ned över åkaren och svävar mjukt i sidled
    camD = 0; const D=smooth(clamp(camD,0,1)), tt=now();
    back=lerp(BACK,13,D); const camh=lerp(CAMH,11.5+Math.sin(tt*.31)*1.5*D,D);
    const tx=s.x-Math.sin(s.th)*1.8*(1-D)+D*Math.sin(tt*.21)*5.5, tz=s.z-back;
    cam.x += (tx-cam.x)*Math.min(1,dt*(6-3.5*D)); cam.z=tz;
    cam.yaw += (s.th*.4*(1-D*.7)+D*Math.sin(tt*.21)*-.12-cam.yaw)*Math.min(1,dt*(4-2*D)); cam.roll += (-s.lean*.06*(1-D)-cam.roll)*Math.min(1,dt*5);
    const ahead=Math.atan(pitchAt(s.z+6))+D*.36; cam.pitch += (ahead-cam.pitch)*Math.min(1,dt*2.2);
    cam.y = elev(cam.z)+camh;
    F=Math.min(W,H)*1.05*(1+D*.15);
    // åkaren på 80 % av höjden (lite högre upp i drönarvyn)
    YA = H*lerp(.80,.62,D) - F*((cam.y-elev(s.z))/back - Math.tan(cam.pitch));
    const sh=R.shake>0?(Math.random()-.5)*R.shake*8:0;
    ctx.translate(W/2+sh,H*.6); ctx.rotate(cam.roll); ctx.translate(-W/2,-H*.6);
    // himmel, fjäll och dal: den sanna horisonten flyttar sig med kamerans lutning
    const key=W+'x'+H+':'+R.wx.kind+R.wx.seed; if(BDsize!==key){ BD=makeBackdrop(W,H); WEATHER.tintBackdrop(BD,Math.round(H*HZ),R.wx); BDsize=key; }
    const yH = YA - F*Math.tan(cam.pitch), hz=Math.round(H*HZ); lastYH=yH;
    ctx.fillStyle=WEATHER.sky(R.wx)||'#5b8fd6'; ctx.fillRect(-W,-H,W*3,H*3);
    // varannan kopia spegelvänd: kanterna möts alltid, ingen skarv i fjällen
    const bw=BD.width, per=bw*2, top=yH-hz; let x0=-(((cam.x*1.2 + cam.yaw*W*.9)%per+per)%per)-bw*.25;
    for(let k=0;k<4&&x0<W;k++,x0+=bw){ if(x0+bw<0) continue; if(k%2===0) ctx.drawImage(BD,x0,top); else { ctx.save(); ctx.translate(x0+bw,top); ctx.scale(-1,1); ctx.drawImage(BD,0,0); ctx.restore(); } }
    ctx.fillStyle='#d5e0f0'; ctx.fillRect(-W,top+BD.height-1,W*3,H*2);
    drawMountain();
    // föremål, sorterade bakifrån
    const objs=collect(C,s); let oi=0;
    // marken: remsor bakifrån och fram, föremålen ritas in mellan remsorna (krön skymmer det bakom)
    const zs=[]; for(let dz=ZMAX; dz>.6; dz-=Math.max(.7,dz*.065)) zs.push(cam.z+dz);
    let prev=null;
    for(const z of zs){
      const m=mid(z), hw=halfAt(z), pL=P(m-hw,z), pR=P(m+hw,z);
      if(!pL) continue;
      const seg=z-cam.z<74?[pL,P(m-hw*.5,z),P(m,z),P(m+hw*.5,z),pR]:null; if(seg&&seg.some(v=>!v)) continue;
      const nb=z-cam.z>90?3:5, oL=[], oR=[]; for(let b=1;b<nb;b++){ oL.push(P(m-hw-OUT[b],z)); oR.push(P(m+hw+OUT[b],z)); }
      if(prev){ const far=Math.min(1,(z-cam.z)/ZMAX), sl=pitchAt(z);
        // terrängen utanför pisten följer fjället
        const fo=T.trees[Math.round(z)|0]||0;
        for(let b=0;b<Math.min(oL.length,prev.oL.length);b++){ const sh=b*3+fo*(8+b*5);
          ctx.fillStyle=`rgb(${228-far*14-sh},${236-far*10-sh*.7},${247-far*5-sh*.3})`;
          quad(b?prev.oL[b-1]:prev.pL,prev.oL[b],oL[b],b?oL[b-1]:pL); quad(b?prev.oR[b-1]:prev.pR,prev.oR[b],oR[b],b?oR[b-1]:pR); }
        // pisten: branter lite skuggigare, flacken ljusare
        const sh2=clamp((sl-.25)*40,-6,10), band=(Math.floor(z/5)%2)*3;
        if(z-cam.z<70 && prev.seg && seg){ for(let q=0;q<4;q++){ const cs2=(gy(m+(q-1.5)*hw*.5+2,z)-gy(m+(q-1.5)*hw*.5-2,z))*2.2;
            ctx.fillStyle=`rgb(${246-far*16-sh2-band+cs2*22|0},${250-far*12-sh2*.7-band+cs2*18|0},${255-far*6})`; quad(prev.seg[q],prev.seg[q+1],seg[q+1],seg[q]); } }
        else { ctx.fillStyle=`rgb(${246-far*16-sh2-band},${250-far*12-sh2*.7-band},${255-far*6})`; quad(prev.pL,prev.pR,pR,pL); }
        if(z>C.L && z<C.L+4){ ctx.fillStyle='rgba(239,68,68,.8)'; quad(prev.pL,prev.pR,pR,pL); }
        // preparerade ränder närmast
        if(z-cam.z<55){ ctx.strokeStyle='rgba(160,180,212,.3)'; ctx.lineWidth=1; ctx.beginPath(); const pm=mid(prev.z), ph=halfAt(prev.z);
          for(let lx=-1+.5;lx<1;lx+=.075){ const a=P(pm+lx*ph,prev.z), b=P(m+lx*hw,z); if(a&&b){ ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); } } ctx.stroke(); }
      }
      while(oi<objs.length && objs[oi].z>=z){ drawObj(objs[oi]); oi++; }
      prev={pL,pR,oL,oR,z,seg};
    }
    while(oi<objs.length){ drawObj(objs[oi]); oi++; }
    // snöstänk
    R.parts=R.parts.filter(p=>(p.t-=dt)>0);
    for(const p of R.parts){ p.x+=p.vx*dt; p.z+=p.vz*dt; p.y+=p.vy*dt; p.vy-=9*dt; const q=P(p.x,p.z,Math.max(0,p.y)); if(!q) continue; ctx.globalAlpha=Math.min(1,p.t*2.2); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(q[0],q[1],Math.max(1,q[2]*.05*p.r),0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    drawSkier(s);
  }
  // drönaren: äkta 3D-kamera; marken först (utanför pisten, pisten, färg och spår), sedan allt upprätt sorterat på djup
  function drawDrone(dt,D){ DCUR=D;
    const s=meSk(), C=R.C, fx=(mid(s.z+6)-mid(s.z-6))/12, Cc=DRONE.solve(D,{x:s.x,y:elev(s.z)+1,z:s.z},fx,1,dt,W,H,z=>elev(z));
    DM=true; VIEWK=DRONE.facing(Cc,fx,1); FLIP = Math.cos(Cc.yaw-Math.atan2(fx,1))<0 && Cc.pitch<1.2;
    const key=W+'x'+H+':'+R.wx.kind+R.wx.seed; if(BDsize!==key){ BD=makeBackdrop(W,H); WEATHER.tintBackdrop(BD,Math.round(H*HZ),R.wx); BDsize=key; }
    const yH=H/2-Cc.f*Math.tan(Cc.pitch), hz=Math.round(H*HZ); lastYH=yH;
    ctx.fillStyle=WEATHER.sky(R.wx)||'#5b8fd6'; ctx.fillRect(0,0,W,H);
    if(yH>0){ const bw=BD.width, per=bw*2, top=yH-hz; let x0=-(((Cc.yaw*Cc.f*.9)%per+per)%per)-bw*.25;
      for(let k=0;k<4&&x0<W;k++,x0+=bw){ if(x0+bw<0) continue; if(k%2===0) ctx.drawImage(BD,x0,top); else { ctx.save(); ctx.translate(x0+bw,top); ctx.scale(-1,1); ctx.drawImage(BD,0,0); ctx.restore(); } }
      ctx.fillStyle='#d5e0f0'; ctx.fillRect(0,top+BD.height-1,W,H); }
    else { ctx.fillStyle='#d5e0f0'; ctx.fillRect(0,0,W,H); }
    drawMountain();
    DZA=Math.max(-20,s.z-130); DZB=s.z+240;
    // allt (mark i remsor och band, färg på snön, käppar, träd, åkare) sorteras på djup tillsammans,
    // så att ett krön skymmer det som ligger bakom – annars ser käpparna ut att sväva
    const L=[], BANDS=[[0,14],[14,45],[45,130],[130,260]];
    let prev=null;
    for(let z=DZA; z<=DZB; z+=Math.max(.8,Math.abs(z-D.C.z)*.03)){
      const m=mid(z), hw=halfAt(z), e={z, m, hw};
      if(prev){ const zc=(z+prev.z)/2, fo=T.trees[Math.round(zc)|0]||.3, band=(Math.floor(z/5)%2)*3, sl=pitchAt(z), sh2=clamp((sl-.25)*40,-6,10), fin=z>C.L&&z<C.L+4;
        const pc=P(mid(zc),zc), q=[P(prev.m-prev.hw,prev.z),P(prev.m+prev.hw,prev.z),P(m+hw,z),P(m-hw,z)];
        if(pc&&q.every(v=>v&&v[3]>1.5)){ const col=fin?'rgba(239,68,68,.85)':`rgb(${246-sh2-band},${250-sh2*.7-band},255)`; L.push({Z:pc[3]+.8, d:()=>{ ctx.fillStyle=col; quad(...q); }}); }
        for(const sd of [-1,1]) for(const [b0,b1] of BANDS){ const shb=b0*.06+fo*(8+b0*.2), oc=`rgb(${228-shb},${236-shb*.7},${247-shb*.3})`; const cc=P(mid(zc)+sd*(halfAt(zc)+(b0+b1)/2),zc), qq=[P(prev.m+sd*(prev.hw+b0),prev.z),P(prev.m+sd*(prev.hw+b1),prev.z),P(m+sd*(hw+b1),z),P(m+sd*(hw+b0),z)];
          if(cc&&qq.every(v=>v&&v[3]>1.5)) L.push({Z:cc[3]+.8, d:()=>{ ctx.fillStyle=oc; quad(...qq); }}); } }
      prev=e; }
    for(const o of collect(C,s)){ const x=o.x!=null?o.x : o.sk? o.sk.x : o.g? (o.g.a.x+o.g.b.x)/2 : mid(o.z), p=P(x,o.z); if(!p) continue;
      const flat=o.t==='rut'||o.t==='dye'||o.t==='arrow'; if(!flat&&p[3]<4) continue; L.push({Z:p[3]+(flat?.4:0), d:()=>drawObj(o)}); }
    const pm=P(s.x,s.z); if(pm) L.push({Z:pm[3]-.05, d:()=>drawSkier(s)});
    // skidspåren i snön efter åkaren
    for(const o of R.sk){ const tr=o.trail; for(let i=Math.max(0,tr.length-240);i+8<tr.length;i+=8){ const a=P(tr[i],tr[i+1],.02), b=P(tr[i+8],tr[i+9],.02); if(a&&b&&a[3]>1&&b[3]>1) L.push({Z:Math.max(a[3],b[3])+.5, d:()=>{ ctx.strokeStyle='rgba(120,145,185,.3)'; ctx.lineWidth=Math.max(.8,a[2]*.12); ctx.lineCap='butt'; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); }}); } }
    L.sort((a,b)=>b.Z-a.Z); for(const it of L) it.d();
    R.parts=R.parts.filter(p=>(p.t-=dt)>0);
    for(const p of R.parts){ p.x+=p.vx*dt; p.z+=p.vz*dt; p.y+=p.vy*dt; p.vy-=9*dt; const q=P(p.x,p.z,Math.max(0,p.y)); if(!q) continue; ctx.globalAlpha=Math.min(1,p.t*2.2); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(q[0],q[1],Math.max(1,q[2]*.05*p.r),0,7); ctx.fill(); }
    ctx.globalAlpha=1; DM=false;
  }
  function collect(C,s){
    const objs=[], zA=DM?DZA:cam.z+.8, zB=DM?DZB:cam.z+ZMAX;
    for(let z=Math.ceil(zA/5)*5; z<zB; z+=5){ let row=T.rows.get(z); if(row){ for(const o of row) objs.push(o); continue; } const n0=objs.length; const zi=Math.round(z), m=mid(z), hw=halfAt(z), r=rng(zi*7+1), dens=T.trees[zi]||.3, cr=T.crowd[zi], nt=T.net[zi];
      for(const sd of [-1,1]){
        if(nt||cr) objs.push({z, t:'fence', x:m+sd*(hw+1.2), sd});
        // skogen: i skogsdalar tätt inpå pisten, på öppna ytor glest och längre bort
        const n=Math.round(dens*5+r()*1.2);
        for(let k=0;k<n;k++){ const dist = 3+r()*7+k*(dens>.8?6:11), tx=m+sd*(hw+dist), tz=z+r()*5, fo=T.M.forest(tx,tz+T.z0), v=r(), sz=.8+r()*.7; if(fo<.25+v*.4) continue; objs.push({z:tz, t:'tree', x:tx, v: v<(fo>.8?.08:.3)?2:(v<.6?0:1), s:sz*(.7+.3*fo)}); }
        if(cr){ for(let k=0;k<3;k++) objs.push({z:z+k*1.6, t:'fan', x:m+sd*(hw+2.4+r()*2.6), v:Math.floor(r()*12), ph:r()*6}); }
        if(nt && zi%45===0) objs.push({z, t:'banner', x:m+sd*(hw+1.25), sd});
      }
      // stollift längs öppna ytor
      if(zi%40===0) objs.push({z, t:'lift', x:m+(T.M.p.lift||1)*(hw+(T.M.vid==='bj'?34:60))});
      T.rows.set(z,objs.slice(n0));
    }
    C.gates.forEach((gs,k)=>gs.forEach((g,i)=>{ if(!(g.zmax>zA-1&&g.zmin<zB)) return;
      if(g.type==='closed'){ objs.push({z:g.zmin, t:'gate', g, i, k, pole:'a'}, {z:g.zmax, t:'gate', g, i, k, pole:'b'});
        const me=meSk(); if(k===me.lane && i===me.gi) objs.push({z:(g.zmin+g.zmax)/2-.02, t:'arrow', g}); }
      else objs.push({z:g.zmax, t:'gate', g, i, k}); }));
    // spår från tidigare åkare genom portarnas idealpassager
    C.gates.forEach(gs=>{ for(let i=1;i<gs.length;i++){ const a=gs[i-1].aim, b=gs[i].aim; if(b.z>zA&&a.z<zB) objs.push({z:b.z, t:'rut', a, b}); } });
    // blå färg sprayad i snön: in- och utgång vid varje sväng
    C.gates.forEach(gs=>gs.forEach(g=>{ if(g.type!=='closed'||g.zmax<zA||g.zmin>zB) return; const zm=(g.zmin+g.zmax)/2, f=g.from||1;
      objs.push({z:zm+.01, t:'dye', p:{x:g.a.x+f*2.4,z:zm-2.2}, a:{x:g.a.x,z:zm}, n:{x:g.a.x-f*2.4,z:zm+2.2}}); }));
    C.gates.forEach(gs=>gs.forEach((g,i)=>{ if(g.type==='closed'||g.aim.z<zA||g.aim.z>zB) return; const pv=gs[i-1], nx=gs[i+1];
      const dirTo=(q,len)=>{ if(!q) return null; const dx=q.aim.x-g.aim.x, dz=q.aim.z-g.aim.z, L=Math.hypot(dx,dz)||1; return {x:g.aim.x+dx/L*len, z:g.aim.z+dz/L*len}; };
      objs.push({z:g.aim.z+.01, t:'dye', p:dirTo(pv,3.6), a:{x:g.aim.x+(g.side||0)*.35,z:g.aim.z}, n:dirTo(nx,3)}); }));
    objs.push({z:C.L, t:'finish'});
    if(T.M.p.idet){ const L0=T.Lr, m0=mid(L0+100);     // Björnidet: värmestugan med speakertornet vid sjön, liftens dalstation, stugor
      [{z:L0+112,x:m0+62,w:17,dp:9,h:4.6,tower:1,sign:'BJÖRNIDET'},{z:L0+86,x:m0-74,w:8,dp:6,h:3.6,col:'#475569',sign:'BJÖRNLIFTEN'},{z:L0+128,x:m0-18,w:7,dp:5,h:3,col:'#8b5a2b'},{z:L0+70,x:m0+96,w:9,dp:7,h:3.4},{z:L0+98,x:m0-120,w:9,dp:7,h:3.4},{z:L0+40,x:m0+118,w:8,dp:6,h:3.2}]
        .forEach(h=>{ if(h.z>zA&&h.z<zB) objs.push({t:'house',...h}); }); }
    R.sk.forEach(o=>{ if(o!==s && o.z>zA && o.z<zB) objs.push({z:o.z, t:'skier', sk:o}); });
    objs.sort((a,b)=>b.z-a.z);
    return objs;
  }
  function quad(a,b,c,d){ if(!a||!b||!c||!d) return; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(c[0],c[1]); ctx.lineTo(d[0],d[1]); ctx.closePath(); ctx.fill(); }
  function drawObj(o){
    const C=R.C, t=now();
    if(o.t==='rut'){ const a=P(o.a.x,o.a.z), b=P(o.b.x,o.b.z); if(!a||!b) return; ctx.strokeStyle='rgba(140,162,196,.32)'; ctx.lineWidth=Math.max(.6,b[2]*.06);
      const mx=(o.a.x+o.b.x)/2+(o.b.x-o.a.x)*.0, mz=(o.a.z+o.b.z)/2, c=P(mx-(o.b.x-o.a.x)*.18,mz); ctx.beginPath(); ctx.moveTo(a[0],a[1]); if(c) ctx.quadraticCurveTo(c[0],c[1],b[0],b[1]); else ctx.lineTo(b[0],b[1]); ctx.stroke(); return; }
    if(o.t==='dye'){ const a=P(o.a.x,o.a.z); if(!a) return; ctx.strokeStyle='rgba(29,78,216,.5)'; ctx.lineCap='round'; const dl=Math.min(a[2],40); ctx.setLineDash([dl*.6,dl*.35]);
      ctx.lineWidth=clamp(a[2]*.16,1,7); ctx.beginPath(); const p=o.p&&P(o.p.x,o.p.z), n=o.n&&P(o.n.x,o.n.z);
      if(p){ ctx.moveTo(p[0],p[1]); ctx.lineTo(a[0],a[1]); } else ctx.moveTo(a[0],a[1]); if(n) ctx.lineTo(n[0],n[1]); ctx.stroke(); ctx.setLineDash([]); return; }
    if(o.t==='tree'&&DM&&VIEWK==='top'){ const p=P(o.x,o.z); if(!p) return; const r=p[2]*(o.v===2?1.6:2.3)*o.s; if(r<.8) return; ctx.fillStyle=o.v===2?'rgba(120,110,100,.7)':'#1f4d3a'; ctx.beginPath(); ctx.arc(p[0],p[1],r,0,7); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(p[0]-r*.25,p[1]-r*.25,r*.5,0,7); ctx.fill(); return; }
    if(o.t==='fan'&&DM&&VIEWK==='top'){ const p=P(o.x,o.z); if(!p) return; ctx.fillStyle=['#e11d48','#2563eb','#f59e0b','#16a34a'][o.v%4]; ctx.beginPath(); ctx.arc(p[0],p[1],Math.max(1,p[2]*.28),0,7); ctx.fill(); return; }
    if(o.t==='tree'){ const p=P(o.x,o.z); if(!p||p[3]<3) return; const img=SPR.tree[o.v]; const h=p[2]*8*o.s, w=h*img.width/img.height; if(p[0]+w<0||p[0]-w>W||h<1) return; ctx.drawImage(img,p[0]-w/2,p[1]-h,w,h); return; }
    if(o.t==='fan'){ const p=P(o.x,o.z); if(!p||p[3]<1.5) return; const img=SPR.fan[o.v]; const h=p[2]*1.75, w=h*img.width/img.height; if(h<1.5) return; const near=Math.abs(o.z-meSk().z)<35, jump=Math.max(0,Math.sin(t*6+o.ph))*h*.12*(near?1:.25);
      ctx.drawImage(img,p[0]-w/2,p[1]-h-jump,w,h);
      if(o.v%4===2 && h>8){ ctx.fillStyle=o.v%8===2?'#006aa7':'#e11d48'; const fx=p[0]+w*.45, fy=p[1]-h*1.15-jump; ctx.fillRect(fx,fy,1,h*.5); ctx.beginPath(); ctx.moveTo(fx,fy); ctx.quadraticCurveTo(fx+h*.25,fy+h*.08+Math.sin(t*8+o.ph)*h*.05,fx+h*.42,fy+h*.05); ctx.lineTo(fx+h*.42,fy+h*.25); ctx.quadraticCurveTo(fx+h*.2,fy+h*.3,fx,fy+h*.22); ctx.fill();
        if(o.v%8===2){ ctx.fillStyle='#fecc00'; ctx.fillRect(fx+h*.1,fy+h*.04,h*.06,h*.22); ctx.fillRect(fx,fy+h*.11,h*.42,h*.05); } }
      return; }
    if(o.t==='fence'){ const z2=o.z+5, x2=mid(z2)+o.sd*(halfAt(z2)+1.2), a=P(o.x,o.z), b=P(x2,z2); if(!a||!b) return;
      const at=DM?P(o.x,o.z,1.1):[a[0],a[1]-a[2]*1.1], bt=DM?P(x2,z2,1.1):[b[0],b[1]-b[2]*1.1]; if(!at||!bt) return;
      ctx.fillStyle='rgba(37,99,235,.55)'; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(bt[0],bt[1]); ctx.lineTo(at[0],at[1]); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(30,64,175,.8)'; ctx.lineWidth=Math.max(.5,a[2]*.05); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(at[0],at[1]); ctx.stroke(); return; }
    if(o.t==='banner'){ const z2=o.z+4, x2=mid(z2)+o.sd*(halfAt(z2)+1.25), a1=P(o.x,o.z,.15), b1=P(x2,z2,.15), b2=P(x2,z2,.95), a2=P(o.x,o.z,.95); if(!a1||!b1||!b2||!a2) return;
      ctx.fillStyle='#fff'; quad(a1,b1,b2,a2); const ha=Math.hypot(a2[0]-a1[0],a2[1]-a1[1]);
      if(ha>6){ ctx.save(); ctx.fillStyle='#e11d48'; ctx.font=`800 ${Math.max(6,ha*.6)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; const txt=T.M.p.banner[Math.floor(o.z/45)%4];
        ctx.translate((a1[0]+b1[0]+a2[0]+b2[0])/4,(a1[1]+b1[1]+a2[1]+b2[1])/4); ctx.rotate(Math.atan2(b1[1]-a1[1],b1[0]-a1[0])); ctx.fillText(txt,0,0); ctx.restore(); } return; }
    if(o.t==='lift'){ const p=P(o.x,o.z), q=P(o.x,o.z,10.5); if(!p||!q) return; const w=Math.max(1,p[2]*.35);
      ctx.fillStyle='#64748b'; ctx.fillRect(p[0]-w/2,q[1],w,p[1]-q[1]); ctx.fillRect(p[0]-p[2]*1.4,q[1],p[2]*2.8,Math.max(1,p[2]*.25));
      const n=P(o.x,o.z+40,10.5); if(n){ ctx.strokeStyle='rgba(51,65,85,.8)'; ctx.lineWidth=Math.max(.5,p[2]*.04); [-1.2,1.2].forEach(dx=>{ ctx.beginPath(); ctx.moveTo(q[0]+dx*p[2],q[1]); ctx.quadraticCurveTo((q[0]+n[0])/2+dx*(p[2]+n[2])/2,(q[1]+n[1])/2+p[2]*.6,n[0]+dx*n[2],n[1]); ctx.stroke(); });
        if(T.M.p.liftKind==='tbar'){ for(let q=0;q<3;q++){ const f=1-((t*.09+q/3)%1), c=P(o.x-1.2,o.z+f*40,10.2), b=P(o.x-1.2,o.z+f*40,6.4); if(c&&b){ ctx.strokeStyle='#334155'; ctx.lineWidth=Math.max(.6,b[2]*.05); ctx.beginPath(); ctx.moveTo(c[0],c[1]); ctx.lineTo(b[0],b[1]); ctx.moveTo(b[0]-b[2]*.55,b[1]); ctx.lineTo(b[0]+b[2]*.55,b[1]); ctx.stroke(); } } }
        else { const f=((t*.25)%1); const cz=o.z+f*40, c=P(o.x+1.2,cz,9.2); if(c){ ctx.fillStyle='#ef4444'; ctx.fillRect(c[0]-c[2]*.5,c[1],c[2],c[2]*.6); ctx.fillStyle='#334155'; ctx.fillRect(c[0]-.5,c[1]-c[2]*1.1,1,c[2]*1.1); } } }
      return; }
    if(o.t==='finish'){ // målportalen räknas i 3D: stolpar från snön och upp, banderollen mellan topparna
      const m=mid(o.z), hw=halfAt(o.z), x1=m-hw-1, x2=m+hw+1, a=P(x1,o.z), b=P(x2,o.z), at=P(x1,o.z,4.4), bt=P(x2,o.z,4.4), al=P(x1,o.z,3.2), bl=P(x2,o.z,3.2); if(!a||!b||!at||!bt||!al||!bl) return;
      ctx.strokeStyle='#1e3a8a'; ctx.lineCap='butt'; ctx.lineWidth=Math.max(1.5,a[2]*.5); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(at[0],at[1]); ctx.stroke(); ctx.lineWidth=Math.max(1.5,b[2]*.5); ctx.beginPath(); ctx.moveTo(b[0],b[1]); ctx.lineTo(bt[0],bt[1]); ctx.stroke();
      const g=ctx.createLinearGradient(0,Math.min(at[1],bt[1]),0,Math.max(al[1],bl[1])); g.addColorStop(0,'#ef4444'); g.addColorStop(1,'#b91c1c'); ctx.fillStyle=g; quad(at,bt,bl,al);
      const hh=Math.hypot(at[0]-al[0],at[1]-al[1]); if(hh>8){ ctx.save(); ctx.translate((at[0]+bt[0]+al[0]+bl[0])/4,(at[1]+bt[1]+al[1]+bl[1])/4); ctx.rotate(Math.atan2(bt[1]-at[1],bt[0]-at[0])); ctx.fillStyle='#fff'; ctx.font=`900 ${hh*.62}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(T.M.p.fin,0,0); ctx.restore(); } return; }
    if(o.t==='house'){ drawHouse(o); return; }
    if(o.t==='gate'){ drawGate(o.g,o.i,o.pole); return; }
    if(o.t==='arrow'){ const g=o.g, zm=(g.zmin+g.zmax)/2, f=g.from||1, p0=P(g.a.x+f*1.6,zm), p1=P(g.a.x-f*1.6,zm); if(!p0||!p1) return;   // pil på snön: åt vilket håll man korsar nästa stängda port
      const sz=clamp(p0[2]*.5,3,18), d=Math.sign(p1[0]-p0[0])||-f; ctx.fillStyle=`rgba(250,204,21,${.8+.2*Math.sin(t*6)})`; ctx.strokeStyle='rgba(30,58,138,.85)'; ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(p0[0],p0[1]-sz*.38); ctx.lineTo(p1[0]-d*sz,p1[1]-sz*.38); ctx.lineTo(p1[0]-d*sz,p1[1]-sz*.95); ctx.lineTo(p1[0],p1[1]); ctx.lineTo(p1[0]-d*sz,p1[1]+sz*.95); ctx.lineTo(p1[0]-d*sz,p1[1]+sz*.38); ctx.lineTo(p0[0],p0[1]+sz*.38); ctx.closePath(); ctx.fill(); ctx.stroke(); return; }
    if(o.t==='skier'){ drawSkier(o.sk); return; }
  }
  // hus i 3D: väggar, sadeltak med snö, vita knutar; Björnidet har dessutom sitt torn med speakerbås
  function drawHouse(o){ const pc=P3(o.x,gy(o.x,o.z)+2,o.z); if(!pc||pc[3]<o.w*.8+4) return; const cx=DM?DCUR.C.x:cam.x, cz=DM?DCUR.C.z:cam.z, {x,z,w,dp,h,col}=o, x0=x-w/2, x1=x+w/2, z0=z-dp/2, z1=z+dp/2, y0=Math.min(gy(x0,z0),gy(x1,z0),gy(x0,z1),gy(x1,z1));
    const Q=(a,b,c,d,f)=>{ const p=[a,b,c,d].map(v=>P3(v[0],v[1],v[2])); if(p.some(v=>!v||v[3]<3)) return;   /* aldrig ytor alldeles intill kameran – de blir jättelika och flimrar */ ctx.fillStyle=f; quad(p[0],p[1],p[2],p[3]); };
    const box=(X0,X1,Z0,Z1,Y0,Y1,c1,c2,roof)=>{ const zf=cz<(Z0+Z1)/2?Z0:Z1, xf=cx<(X0+X1)/2?X0:X1;
      Q([xf,Y0,Z0],[xf,Y0,Z1],[xf,Y1,Z1],[xf,Y1,Z0],c2); Q([X0,Y0,zf],[X1,Y0,zf],[X1,Y1,zf],[X0,Y1,zf],c1);
      if(roof){ const zm=(Z0+Z1)/2, yr=Y1+roof, e=.6, za=zf===Z0?Z1:Z0; Q([X0-e,Y1,za+(za>zm?e:-e)],[X1+e,Y1,za+(za>zm?e:-e)],[X1+e,yr,zm],[X0-e,yr,zm],'#dfe7f2'); const g1=P3(xf,Y1,Z0), g2=P3(xf,Y1,Z1), g3=P3(xf,yr,zm); if(g1&&g2&&g3){ ctx.fillStyle=c2; ctx.beginPath(); ctx.moveTo(g1[0],g1[1]); ctx.lineTo(g2[0],g2[1]); ctx.lineTo(g3[0],g3[1]); ctx.fill(); }
        Q([X0-e,Y1,zf+(zf>zm?e:-e)],[X1+e,Y1,zf+(zf>zm?e:-e)],[X1+e,yr,zm],[X0-e,yr,zm],'#f8fafc'); }
      // vita knutar och fönster med varmt ljus
      for(const xx of [X0,X1]){ const a=P3(xx,Y0,zf), b=P3(xx,Y1,zf); if(a&&b){ ctx.strokeStyle='#f8fafc'; ctx.lineWidth=Math.max(.6,a[2]*.18); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); } }
      const nwin=Math.max(1,Math.round((X1-X0)/4)); for(let q=0;q<nwin;q++){ const wx=X0+(q+.5)*(X1-X0)/nwin; Q([wx-.6,Y0+1.3,zf],[wx+.6,Y0+1.3,zf],[wx+.6,Y0+2.5,zf],[wx-.6,Y0+2.5,zf],'#ffe08a'); } };
    box(x0,x1,z0,z1,y0,y0+h,col||'#9b2c20','#7a2219',h*.55);
    if(o.tower){ const tx=x0-2.2; box(tx-2,tx+2,z-2,z+2,y0,y0+h+5.5,'#9b2c20','#7a2219',2.2); const zf=cz<z?z-2:z+2; Q([tx-1.7,y0+h+3,zf],[tx+1.7,y0+h+3,zf],[tx+1.7,y0+h+4.8,zf],[tx-1.7,y0+h+4.8,zf],'#bfe3ff'); }
    if(o.sign){ const zf=cz<z?z0:z1, a=P3(x,y0+h*.78,zf); if(a&&a[2]>3){ ctx.fillStyle='#fff'; ctx.font=`800 ${a[2]*1.1}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(o.sign,a[0],a[1]); } } }
  function drawGate(g,i){
    const C=R.C, a=P(g.a.x,g.a.z), b=P(g.b.x,g.b.z), only=arguments[2];
    if(g.type==='closed'){ if(only==='a'&&!a || only==='b'&&!b) return; } else if(!a||!b) return;
    const col = g.col==='r' ? '#ef4444' : '#2563eb', dark = g.col==='r' ? '#991b1b' : '#1e3a8a', t=now();
    const bend = g.hit ? Math.max(0,1-(performance.now()-(g.hitT||0))/600)*.55 : 0;
    // käppen står lodrätt i världen: i drönarvyn räknas toppen ut i 3D, annars rakt upp i bild
    const up=(p,wx,wz)=>{ const q=DM&&wx!=null?P(wx,wz,1.8):null; return q?[q[0]-p[0],q[1]-p[1]]:[0,-p[2]*1.8]; };
    const pole=(p,bnd,wx,wz)=>{ const v=up(p,wx,wz), h=Math.hypot(v[0],v[1]), pw=Math.max(1,p[2]*.045); ctx.strokeStyle=col; ctx.lineWidth=pw*2; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.quadraticCurveTo(p[0]+v[0]*.5+bnd*h*.3,p[1]+v[1]*.5,p[0]+v[0]*.95+bnd*h*.6,p[1]+v[1]*.95); ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.6)'; ctx.lineWidth=pw*.6; ctx.beginPath(); ctx.moveTo(p[0]-pw*.4+v[0]*.1,p[1]+v[1]*.1); ctx.lineTo(p[0]-pw*.4+v[0]*.85+bnd*h*.5,p[1]+v[1]*.85); ctx.stroke();
      ctx.fillStyle='rgba(80,110,160,.18)'; ctx.beginPath(); ctx.ellipse(p[0]+p[2]*.4,p[1]+1,p[2]*.35,p[2]*.08,0,0,7); ctx.fill(); };
    if(g.type==='gs'){ // ett stångpar med flagga på var sida om porten
      const wv=Math.sin(t*3+i)*a[2]*.05;
      [[g.a.x-.75,g.a.x],[g.b.x,g.b.x+.75]].forEach(([xa,xb])=>{ const pa0=P(xa,g.a.z), pb0=P(xb,g.a.z); if(!pa0||!pb0) return;
        pole(pa0,0,xa,g.a.z); pole(pb0,0,xb,g.a.z);
        // flaggan mellan käpparna: i drönarvyn följer den käpparnas riktning, annars som förut
        const va=up(pa0,xa,g.a.z), vb=up(pb0,xb,g.a.z), h=Math.hypot(va[0],va[1]), k=-va[1]/(h||1);
        const pa=[pa0[0]+va[0]-0,pa0[1]+va[1]+h,pa0[2]], pb=[pb0[0]+vb[0],pb0[1]+vb[1]+Math.hypot(vb[0],vb[1]),pb0[2]];
        if(DM && h<pa0[2]*.6) return;      // rakt ovanifrån syns flaggan inte
        ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(pa[0],pa[1]-h*.95); ctx.quadraticCurveTo((pa[0]+pb[0])/2,pa[1]-h*.95+wv,pb[0],pb[1]-h*.95); ctx.lineTo(pb[0],pb[1]-h*.5); ctx.quadraticCurveTo((pa[0]+pb[0])/2,pa[1]-h*.5+wv,pa[0],pa[1]-h*.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc((pa[0]+pb[0])/2,pa[1]-h*.72+wv*.5,Math.max(.8,(pb[0]-pa[0])*.22),0,7); ctx.fill();
        ctx.fillStyle=dark; ctx.fillRect(pa[0],pa[1]-h*.52,pb[0]-pa[0],Math.max(.5,h*.02)); });
    } else {
      // slalom: ledade käppar utan flagga; vändstången viker sig vid träff
      const tp=P(g.turn.x,g.turn.z); const away = g.type==='closed' ? (g.aim.x>g.a.x?-1:1) : (g.side||1)*-1;
      if(g.type==='single'){ if(tp) pole(tp, bend*away, g.turn.x, g.turn.z); }
      else if(g.type==='closed'){ if(only==='b') pole(b,0,g.b.x,g.b.z); else pole(a,bend*(g.aim.x>g.a.x?-1:1),g.a.x,g.a.z); }
      else { const tA = Math.abs(g.a.x-g.turn.x)<.01; pole(a,tA?bend*away:0,g.a.x,g.a.z); pole(b,!tA?bend*away:0,g.b.x,g.b.z); }
    }
    if(g.pass===false && only!=='b'){ const q=P(g.aim.x,g.aim.z)||a||b; if(!q) return; ctx.fillStyle='rgba(239,68,68,.9)'; ctx.font=`900 ${Math.max(10,q[2]*.9)}px system-ui`; ctx.textAlign='center'; ctx.fillText('✕',q[0],q[1]-q[2]*.6); }
  }

  // åkaren bakifrån – en sammanhängande figur: skidor → bindning → pjäxor → ben → höft → rygg → armar → stavar → hjälm
  const SUITS={ swe:{base:'#0b2e7a', mid:'#1d4ed8', acc:'#facc15', boot:'#f8fafc', bootAcc:'#1d4ed8', helm:'#facc15', helmAcc:'#1d4ed8', ski:'#f8fafc', skiAcc:'#1d4ed8', glove:'#0f172a', bib:'#ffffff', bibTxt:'#0b2e7a'},
                own:{base:'#0b0f17', mid:'#1f2937', acc:'#93c5fd', boot:'#f8fafc', bootAcc:'#111827', helm:'#2dd4bf', helmAcc:'#0f766e', ski:'#111827', skiAcc:'#a3e635', glove:'#0b0f17', bib:'#7cb8f7', bibTxt:'#0b0f17', vest:true},
                red:{base:'#991b1b', mid:'#dc2626', acc:'#f8fafc', boot:'#111827', bootAcc:'#dc2626', helm:'#f8fafc', helmAcc:'#dc2626', ski:'#111827', skiAcc:'#dc2626', glove:'#111827', bib:'#facc15', bibTxt:'#111827'} };
  // min åkare får den dräkt jag valt; motståndaren får en som skiljer sig
  function suitOf(s){ const mine=lsGet('sl_suit')||'swe', meK=R?R.sk[R.me].k:0; if(s.k===meK) return SUITS[mine]||SUITS.swe; return mine==='red'?SUITS.swe:SUITS.red; }
  /* ---------- åkaren: en ledad 3D-figur ----------
     Lederna räknas ut i meter i åkarens eget system (höger, upp, framåt) och projiceras genom den kamera som gäller,
     så figuren stämmer bakifrån, framifrån, från sidan och uppifrån. Hållningen följer åkningen: kroppen lutar in i
     svängen (inklination), överkroppen hålls upprätt och vänd utför (vinkling), innerbenet böjs mer och innerskidan
     ligger lite före, benen fjädrar med belastningen, stavisättning i kantbytet, blockning av käppen i slalom,
     ihopkrupen fartställning – och i luften över ett krön dras benen upp. */
  const V3={ add:(a,b,k=1)=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k], sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], len:a=>Math.hypot(a[0],a[1],a[2]),
    nrm:a=>{ const l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; }, dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], mix:(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t] };
  // tvåledad lem: mellanleden (knä/armbåge) hamnar åt hållet "pref"
  function ik(a,b,l1,l2,pref){ const d=V3.sub(b,a), L=Math.min(V3.len(d),l1+l2-.001)||.001, dn=V3.nrm(d), x=(l1*l1-l2*l2+L*L)/(2*L), h=Math.sqrt(Math.max(0,l1*l1-x*x));
    const pp=V3.nrm(V3.add(pref,dn,-V3.dot(pref,dn))); return V3.add(V3.add(a,dn,x),pp,h); }
  function drawSkier(s){
    const S=suitOf(s), d=R.C.d, t=now(), md = s.done && s.mood ? s.mood : null;
    const E=md?0:clamp(s.lean||0,-1.25,1.25), tk=md?0:(s.tuck||0), air=s.air||0, fl=md?0:clamp((s.flex||0)+Math.min(.5,air*1.2),0,1), slip=clamp(s.slip||0,-.6,.6);
    const dir=Math.sign(E)||1, aE=Math.abs(E), inc=E*(d.panel?.62:.52), pa=Math.atan(pitchAt(s.z)*Math.cos(s.th));
    // åkarens system i världen: framåt längs skidorna och backens lutning, höger vågrätt, upp vinkelrätt mot snön
    const sT=Math.sin(s.th), cT=Math.cos(s.th), fw=[sT*Math.cos(pa),-Math.sin(pa),cT*Math.cos(pa)], rt=[cT,0,-sT], up=[fw[1]*rt[2]-fw[2]*rt[1], fw[2]*rt[0]-fw[0]*rt[2], fw[0]*rt[1]-fw[1]*rt[0]];
    const hop = md==='cheer' ? Math.abs(Math.sin(t*6.5))*.14 : 0, org=[s.x, gy(s.x,s.z)+air+hop, s.z];
    const Wd=(r,u,f)=>[org[0]+rt[0]*r+up[0]*u+fw[0]*f, org[1]+rt[1]*r+up[1]*u+fw[1]*f, org[2]+rt[2]*r+up[2]*u+fw[2]*f];
    // överkroppen är lugn och vänd utför medan benen och skidorna svänger under den (separation)
    const sep=md?0:clamp(-s.th*.72,-.7,.7)*(1-tk*.6), cS=Math.cos(sep), sS=Math.sin(sep), fwT=[fw[0]*cS+rt[0]*sS,fw[1]*cS+rt[1]*sS,fw[2]*cS+rt[2]*sS], rtT=[rt[0]*cS-fw[0]*sS,rt[1]*cS-fw[1]*sS,rt[2]*cS-fw[2]*sS];
    // i kantbytet är kroppen ihopdragen och låg (benen pendlar under kroppen); mitt i svängen är ytterbenet långt och starkt
    const trans=md?0:(1-Math.min(1,aE/.55))*Math.min(1,s.v/9)*(1-tk);
    const prims=[], PJ=w=>CAP?CAPP:P3(w[0],w[1],w[2]);
    const limb=(a,b,w1,w2,col,stripe)=>{ if(CAP){ CAP.push(['c',a,b,w1/2,w2/2,col]); return; } const pa2=PJ(a), pb=PJ(b); if(!pa2||!pb) return; prims.push({z:(pa2[3]+pb[3])/2, f:()=>{ capsule(pa2[0],pa2[1],pb[0],pb[1],w1*pa2[2],w2*pb[2],col);
      if(stripe){ ctx.strokeStyle=stripe; ctx.lineWidth=Math.max(.6,pa2[2]*.022); ctx.beginPath(); ctx.moveTo(pa2[0],pa2[1]); ctx.lineTo(pb[0],pb[1]); ctx.stroke(); } }}); };
    const line=(a,b,w,col)=>{ if(CAP){ CAP.push(['c',a,b,w/2,w/2,col]); return; } const pa2=PJ(a), pb=PJ(b); if(!pa2||!pb) return; prims.push({z:(pa2[3]+pb[3])/2, f:()=>{ ctx.strokeStyle=col; ctx.lineCap='round'; ctx.lineWidth=Math.max(.7,w*(pa2[2]+pb[2])/2); ctx.beginPath(); ctx.moveTo(pa2[0],pa2[1]); ctx.lineTo(pb[0],pb[1]); ctx.stroke(); }}); };
    const ball=(c,rad,col,after)=>{ if(CAP){ CAP.push(['s',c,rad,col]); return CAPP; } const p=PJ(c); if(!p) return; prims.push({z:p[3]-(after||0), f:()=>{ ctx.fillStyle=col; ctx.beginPath(); ctx.arc(p[0],p[1],Math.max(.6,rad*p[2]),0,7); ctx.fill(); }}); return p; };
    // skugga på snön (lossnar från åkaren i luften)
    if(!CAP){ const g0=PJ([s.x,gy(s.x,s.z)+.02,s.z]); if(g0){ const pts=[]; for(let i=0;i<16;i++){ const a=i/16*Math.PI*2, r=Math.cos(a)*.3+(R.wx.kind==='sun'?.16:0)+Math.sin(inc)*.3, f=Math.sin(a)*.72-.05, x=s.x+rt[0]*r+fw[0]*f, z=s.z+rt[2]*r+fw[2]*f, q=PJ([x,gy(x,z)+.02,z]); if(q) pts.push(q); }
        if(pts.length>8){ ctx.fillStyle=WEATHER.shadow(R.wx,.2/(1+air*1.5)); ctx.beginPath(); pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.closePath(); ctx.fill(); } } }
    // fötter: bredare ställning i lutning, innerskidan lite före; i luften dras fötterna upp
    const stance=.3+Math.abs(E)*.1+tk*.06, lead=.13*Math.abs(E), tuckA=air>0?Math.min(.18,air*.5):0;
    const feet=[-1,1].map(sd=>{ const inner=sd===dir&&Math.abs(E)>.05; return {sd, inner, r:sd*stance/2-Math.sin(inc)*.06, u:tuckA+(inner?Math.abs(E)*.03:0), f:(inner?lead:-lead)*.5}; });
    // höft, överkropp, axlar och huvud
    const leg=1.06*(1-.34*tk-.13*fl-.1*trans-(d.panel?0:.03))-(md==='sad'?.05:0), hipR=Math.sin(inc)*leg*.98, hipU=Math.cos(inc)*leg+tuckA*.6, hipF=-.1-tk*.12-fl*.05;
    const hip=Wd(hipR,hipU,hipF);
    const tf=md==='cheer'?.05:md==='sad'?.55:.4+tk*.78+fl*.12+trans*.14+(d.panel?0:.06), ang=inc*(d.panel?.22:.16), tl=.52;
    const sh=Wd(hipR+Math.sin(ang)*tl*.9, hipU+Math.cos(ang)*Math.cos(tf)*tl, hipF+Math.sin(tf)*tl);
    const hd=V3.add(sh, V3.nrm(V3.sub(Wd(hipR+Math.sin(ang)*(tl+.3), hipU+Math.cos(ang)*Math.cos(tf*.55)*(tl+.3), hipF+Math.sin(tf*.75)*(tl+.3)),sh)), .2+(md==='sad'?-.03:0));
    // skidor och pjäxor
    const skiL=d.ski, edge=inc*1.12;
    feet.forEach(f=>{ const base=Wd(f.r,f.u,f.f), lat=V3.add(V3.add([0,0,0],rt,Math.cos(edge)),up,-Math.sin(edge)), fwS=fw;   // skidans tväraxel kantad
      const c0=V3.add(base,up,Math.abs(Math.sin(edge))*.045+.012), tail=V3.add(c0,fwS,-skiL*.46), nose=V3.add(c0,fwS,skiL*.5), tip=V3.add(V3.add(c0,fwS,skiL*.56),up,.05);
      f.an=V3.add(V3.add(c0,up,.27),rt,Math.sin(inc)*.2);
      if(CAP) CAP.push(['ski',[V3.add(tail,lat,-.048),V3.add(tail,lat,.048),V3.add(nose,lat,.048),tip,V3.add(nose,lat,-.048)],S.ski,S.skiAcc]);
      const q=[V3.add(tail,lat,-.048),V3.add(tail,lat,.048),V3.add(nose,lat,.048),tip,V3.add(nose,lat,-.048)].map(PJ); if(q.some(v=>!v)) return;
      const pz=q.reduce((m,v)=>m+v[3],0)/5;
      prims.push({z:pz+.06, f:()=>{ ctx.fillStyle='#0f172a'; ctx.beginPath(); q.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]+Math.max(.8,v[2]*.018)):ctx.moveTo(v[0],v[1]+Math.max(.8,v[2]*.018))); ctx.closePath(); ctx.fill();
        ctx.fillStyle=S.ski; ctx.beginPath(); q.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1])); ctx.closePath(); ctx.fill();
        const m0=[(q[0][0]+q[1][0])/2,(q[0][1]+q[1][1])/2], m1=[(q[2][0]+q[4][0])/2,(q[2][1]+q[4][1])/2]; ctx.strokeStyle=S.skiAcc; ctx.lineWidth=Math.max(.6,q[0][2]*.03); ctx.beginPath(); ctx.moveTo(m0[0],m0[1]); ctx.lineTo(m1[0],m1[1]); ctx.stroke(); }});
      const an=f.an, toe=V3.add(c0,fwS,.13), heel=V3.add(c0,fwS,-.1);
      limb(V3.add(heel,up,.05),V3.add(toe,up,.05),.11,.1,'#1f2937'); limb(V3.add(c0,up,.06),an,.115,.105,S.boot); line(V3.mix(c0,an,.55),V3.mix(V3.add(toe,up,.05),an,.5),.03,S.bootAcc); });
    // ben: innerbenet böjs mer, knäna pekar framåt och in i svängen
    const rtH=V3.nrm(V3.add(rt,rtT)); feet.forEach(f=>{ const hj=V3.add(hip,rtH,f.sd*.1), kn=ik(hj,f.an,.45,.44,V3.add(V3.add(fw,rt,dir*aE*.95-f.sd*.12*(1-tk)+f.sd*tk*.25),up,.1));
      limb(f.an,kn,.105,.125,S.base,S.acc); limb(kn,hj,.13,.165,S.base,S.acc); if(!d.panel) limb(V3.mix(f.an,kn,.12),V3.mix(f.an,kn,.82),.125,.135,'#e2e8f0'); });
    // bål
    limb(hip,V3.mix(hip,sh,.55),.33,.36,S.base); limb(V3.mix(hip,sh,.45),sh,.36,.38,S.vest?S.bib:S.mid);
    ball(hip,.17,S.base); if(CAP&&!S.vest) CAP.push(['c',V3.mix(hip,sh,.4),V3.mix(hip,sh,.82),.19,.2,S.bib]);
    { const pm=PJ(V3.mix(hip,sh,.6)), ph=PJ(hip), ps=PJ(sh); if(pm&&ph&&ps){ const hgt=Math.hypot(ps[0]-ph[0],ps[1]-ph[1]); if(hgt>16) prims.push({z:pm[3]-.3, f:()=>{ const w=pm[2]*.2, h=hgt*.42;
        ctx.save(); ctx.translate(pm[0],pm[1]); ctx.rotate(Math.atan2(ps[0]-ph[0],-(ps[1]-ph[1]))); ctx.fillStyle=S.vest?'#e0f2fe':S.bib; ctx.beginPath(); ctx.roundRect(-w,-h/2,w*2,h,w*.25); ctx.fill();
        ctx.fillStyle=S.bibTxt; ctx.font=`900 ${Math.max(7,h*.7)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(s.k+1),0,h*.04); ctx.restore(); }}); } }
    // armar och stavar
    [-1,1].forEach(sd=>{ const sj=V3.add(V3.add(sh,rtT,sd*.2),up,-.04); let hr,hu,hf,tip, inner=sd===dir, blk=0;
      const loc=(r,u,f)=>V3.add(V3.add(V3.add(sh,rtT,r),up,u),fwT,f);
      if(md==='cheer'){ const w=Math.sin(t*9+sd)*.05; hr=sd*.34+w; hu=.5; hf=.05; tip=loc(hr+sd*.35,hu+1.05,-.1); }
      else if(md==='sad'){ hr=sd*.26; hu=-.52; hf=.02; tip=loc(hr+sd*.08,hu-.5,-.6); }
      else if(tk>.5){ hr=sd*.1; hu=-.02-tk*.08; hf=.4; tip=loc(sd*.26,.12,-.75); }
      else { const plant=inner?s.plant:0, sw=Math.sin(t*2.2+sd)*.015; blk=!inner&&!d.panel&&aE>.12?(s.block||0):0;
        if(d.panel){ // storslalom: innerhanden sträcks ned mot snön, ytterarmen hålls fram och i höjd med höften
          hr=sd*(.38+aE*.1)+sw; hu=inner?-.3-aE*.22:-.24+aE*.05; hf=inner?.2:.34+aE*.08; }
        else { // slalom: båda händerna högt och framför kroppen
          hr=sd*.3+sw; hu=-.2+(inner?-.06*aE:.03); hf=.36+plant*.08; }
        // blockning: ytterhanden slås fram tvärs över kroppen och fäller käppen med stavskyddet
        if(blk>0){ const b2=Math.min(1,blk*1.3); hr=lerp(hr,-sd*.04,b2); hu=lerp(hu,.02,b2); hf=lerp(hf,.5,b2); }
        tip=null; }
      const hand=loc(hr,hu,hf); if(!tip){ const pl=inner?s.plant:0, base=blk>.2?V3.add(V3.add(hand,up,.75),fwT,.5):Wd(hipR+hr*.9+sd*.12, .03, pl>0?.6:-.55); const dl=V3.len(V3.sub(base,hand)); tip=dl>1.2?V3.add(hand,V3.nrm(V3.sub(base,hand)),1.2):base; }
      const el=ik(sj,hand,.3,.27,[rt[0]*sd*.7-fw[0]*.5-up[0]*.6, rt[1]*sd*.7-fw[1]*.5-up[1]*.6, rt[2]*sd*.7-fw[2]*.5-up[2]*.6]);
      line(hand,tip,.022,'#cbd5e1'); ball(V3.mix(tip,hand,.08),.04,'#334155');
      limb(sj,el,.115,.1,S.base,S.acc); limb(el,hand,.1,.085,S.mid); ball(hand,.055,S.glove,.02); if(!d.panel) ball(V3.add(hand,fwT,.045),.048,'#e2e8f0',.03); });
    ball(sh,.17,S.vest?S.bib:S.mid);
    // nacke, hjälm, glasögon
    limb(sh,hd,.11,.1,S.base);
    if(CAP) CAP.push(['helm',hd,V3.nrm(V3.add(V3.add([0,0,0],fwT,Math.cos(tf*.5)),up,-Math.sin(tf*.5)*.6)),S.helm,S.helmAcc]);
    { const p=PJ(hd), pf=PJ(V3.add(hd,V3.nrm(V3.add(V3.add([0,0,0],fwT,Math.cos(tf*.5)),up,-Math.sin(tf*.5)*.6)),.13)); if(p&&pf) prims.push({z:p[3]-.12, f:()=>{ const r=Math.max(1.5,.128*p[2]);
        ctx.fillStyle=S.helm; ctx.beginPath(); ctx.arc(p[0],p[1],r,0,7); ctx.fill();
        const fx=pf[0]-p[0], fy=pf[1]-p[1], fl2=Math.hypot(fx,fy)/(.13*p[2]+1e-6), toward=pf[3]<p[3], a=Math.atan2(fy,fx);
        ctx.save(); ctx.translate(p[0],p[1]); ctx.rotate(a); ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.clip();
        ctx.fillStyle=S.helmAcc; ctx.fillRect(-r,-r*.16,r*2,r*.32);                                        // rand över hjässan
        if(toward){ const gg=ctx.createLinearGradient(0,-r*.7,0,r*.7); gg.addColorStop(0,'#f97316'); gg.addColorStop(.5,'#facc15'); gg.addColorStop(1,'#a855f7'); const o=fl2*r*.55;
          ctx.fillStyle='#111827'; ctx.beginPath(); ctx.ellipse(o,0,r*.5*(1.05-fl2*.5)+r*.12,r*.78,0,0,7); ctx.fill(); ctx.fillStyle=gg; ctx.beginPath(); ctx.ellipse(o,0,r*.42*(1.05-fl2*.5)+r*.06,r*.66,0,0,7); ctx.fill(); }
        else { ctx.fillStyle='#111827'; ctx.fillRect(-r*.2+fl2*r*.3,-r,r*.3,r*2); }                         // glasögonbandet bakifrån
        ctx.restore(); ctx.fillStyle='rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(p[0]-r*.35,p[1]-r*.45,r*.3,r*.2,-.5,0,7); ctx.fill(); }}); }
    if(CAP) return;
    prims.sort((a,b)=>b.z-a.z); for(const q of prims) q.f();
  }
  /* ---------- 3D-provet: samma åk, ritat med grafikkortet (dev/slalomgl.js) ---------- */
  let GLON=lsGet('sl_gl')==='1', glcv=null, GLW=null, CAP=null; const CAPP=[0,0,1,1], GC={x:0,y:0,ly:0,init:0};
  const glActive=()=>GLON && typeof SLGL!=='undefined' && !!glcv && SLGL.ok();
  const glLabel=()=>GLON?'🖼️ Vanlig grafik':'🧪 3D-prov';
  function glSync(){ if(!glcv) return; if(GLON && (typeof SLGL==='undefined' || !SLGL.init(glcv))){ GLON=false; lsSet('sl_gl','0'); try{ toast('3D-provet går inte att starta på den här enheten'); }catch(e){} }
    glcv.style.display=GLON?'block':'none'; const b=document.querySelector('.sl-glb'); if(b) b.textContent=glLabel(); }
  const JK3=[[.88,.11,.28],[.15,.39,.92],[.96,.62,.04],[.09,.64,.29],[.49,.23,.93],[.03,.57,.7],[.98,.45,.09],[.86,.15,.47]];
  function glBuild(){ const tb=performance.now();
    SLGL.clear(); GLW=R.C; GC.init=0; const M=T.M, z0=T.z0, H0=T.H0;
    // pisten och terrängen närmast: tätt rutnät som följer backens mittlinje
    const OUT=[1,3,6,10,14,20,28,38,50,66,86,112,145,185,235,300], IN=[-1,-.75,-.5,-.25,0,.25,.5,.75,1], NO=OUT.length, NX=NO*2+IN.length, ZA=-90, DZ=3, NZ=Math.floor((T.N-1-ZA)/DZ)+1;
    const offs=(i,hw)=> i<NO ? -hw-OUT[NO-1-i] : i<NO+IN.length ? IN[i-NO]*hw : hw+OUT[i-NO-IN.length];
    const tint=(o,x,zw,k)=>{ if(M.isLake(x,zw)){ o.r=.80; o.g=.87; o.b=.95; } else { const f=M.forest(x,zw); o.r=.93-k*.52*f; o.g=.95-k*.42*f; o.b=.985-k*.50*f; } o.m=2; };
    SLGL.addGrid(NX,NZ,(i,j,o)=>{ const z=ZA+j*DZ, m=mid(z), hw=halfAt(z), dx=offs(i,hw), x=m+dx; o.x=x; o.z=z; o.y=gy(x,z);
      if(Math.abs(dx)<=hw+.01){ o.r=.955; o.g=.965; o.b=.985; o.m=1; } else tint(o,x,z+z0,.55); });
    // fjället runt omkring: glest rutnät över hela berget
    const FS=90, X0=mid(T.Lr/2)-4200, ZW=-2600, FNX=Math.ceil(8400/FS)+1, FNZ=Math.ceil((T.N+7800)/FS)+1;
    const inNear=(x,z)=> z>ZA+FS && z<T.N-1-FS && Math.abs(x-mid(z))<halfAt(z)+300-FS*1.2;
    SLGL.addGrid(FNX,FNZ,(i,j,o)=>{ const x=X0+i*FS, z=ZW+j*FS; o.x=x; o.z=z; o.y=M.H(x,z+z0)-H0-(inNear(x,z)?7:0); tint(o,x,z+z0,1); },
      (i,j)=>{ const x=X0+i*FS, z=ZW+j*FS; return inNear(x,z)&&inNear(x+FS,z)&&inNear(x,z+FS)&&inNear(x+FS,z+FS); });
    // allt som står i och kring backen
    const B=new SLGL.Builder(90000), B2=new SLGL.Builder(6000), rr=rng(991);
    const sDM=DM, sA=DZA, sB=DZB; let objs=[]; DM=true; DZA=-6; DZB=T.N-2; try{ objs=collect(R.C,meSk()); } finally { DM=sDM; DZA=sA; DZB=sB; }
    const dash=(a,b)=>{ if(!a||!b) return; const dx=b.x-a.x, dz=b.z-a.z, L=Math.hypot(dx,dz)||1, ux=dx/L, uz=dz/L, nx=-uz*.055, nz=ux*.055; for(let d=0;d<L;d+=.95){ const e=Math.min(L,d+.6), x1=a.x+ux*d, z1=a.z+uz*d, x2=a.x+ux*e, z2=a.z+uz*e;
      B2.quad([x1-nx,gy(x1-nx,z1-nz)+.04,z1-nz],[x1+nx,gy(x1+nx,z1+nz)+.04,z1+nz],[x2+nx,gy(x2+nx,z2+nz)+.04,z2+nz],[x2-nx,gy(x2-nx,z2-nz)+.04,z2-nz],[.3,.5,1],3); } };
    for(const o of objs){
      if(o.t==='tree'){ const y=gy(o.x,o.z), h=8*o.s, a0=rr()*6.28;
        if(o.v===2){ B.cone([o.x,y-.2,o.z],[o.x+.15,y+h*.82,o.z],.13*o.s,.035,[.9,.89,.86],0,5);
          for(let k=0;k<6;k++){ const a=a0+k*1.05, hh=h*(.34+k*.08), l=h*(.34-k*.03); B.cone([o.x+.08,y+hh,o.z],[o.x+Math.cos(a)*l*.6,y+hh+l*.75,o.z+Math.sin(a)*l*.6],.05*o.s,.008,[.5,.44,.42],0,3,[.88,.89,.93]); } }
        else { const r=(o.v?1.5:1.9)*o.s, g=o.v?[.10,.27,.20]:[.08,.23,.165];
          B.cone([o.x,y-.3,o.z],[o.x,y+h*.2,o.z],.2*o.s,.15*o.s,[.28,.2,.14],0,4);
          for(let k=0;k<4;k++) B.cone([o.x,y+h*(.1+.2*k),o.z],[o.x,y+Math.min(h,h*(.47+.2*k)),o.z],r*(1-.23*k),0,g,0,6,[.80,.86,.90]); } }
      else if(o.t==='fan'){ const y=gy(o.x,o.z); B.box(o.x-.2,o.x+.2,y,y+.8,o.z-.13,o.z+.13,[.12,.16,.24],0); B.box(o.x-.25,o.x+.25,y+.8,y+1.45,o.z-.16,o.z+.16,JK3[o.v%8],0); B.sphere([o.x,y+1.6,o.z],.13,[.95,.8,.68],0,5,3); B.sphere([o.x,y+1.69,o.z],.125,JK3[(o.v*5+3)%8],0,5,3); }
      else if(o.t==='fence'){ const z2=o.z+5, x2=mid(z2)+o.sd*(halfAt(z2)+1.2), y1=gy(o.x,o.z), y2=gy(x2,z2); B.quad([o.x,y1+.1,o.z],[x2,y2+.1,z2],[x2,y2+1.15,z2],[o.x,y1+1.15,o.z],[.16,.4,.95],4); B.cone([o.x,y1,o.z],[o.x,y1+1.3,o.z],.035,.035,[.1,.2,.5],0,4); }
      else if(o.t==='banner'){ const z2=o.z+4, x1=o.x-o.sd*.06, x2=mid(z2)+o.sd*(halfAt(z2)+1.19), y1=gy(x1,o.z), y2=gy(x2,z2); B.quad([x1,y1+.15,o.z],[x2,y2+.15,z2],[x2,y2+.95,z2],[x1,y1+.95,o.z],[1,1,1],4);
        B.quad([x1-o.sd*.02,y1+.42,o.z+.6],[x2-o.sd*.02,y2+.42,z2-.6],[x2-o.sd*.02,y2+.68,z2-.6],[x1-o.sd*.02,y1+.68,o.z+.6],[.88,.11,.28],4); }
      else if(o.t==='lift'){ const y=gy(o.x,o.z), zn=o.z+40, yn=gy(o.x,zn); B.cone([o.x,y-.5,o.z],[o.x,y+10.5,o.z],.24,.17,[.39,.45,.55],0,6); B.box(o.x-1.4,o.x+1.4,y+10.35,y+10.6,o.z-.12,o.z+.12,[.39,.45,.55],0);
        for(const dx of [-1.2,1.2]) B.cone([o.x+dx,y+10.4,o.z],[o.x+dx,yn+10.4,zn],.035,.035,[.2,.25,.33],0,3); }
      else if(o.t==='finish'){ const m=mid(o.z), hw=halfAt(o.z), x1=m-hw-1, x2=m+hw+1, y1=gy(x1,o.z), y2=gy(x2,o.z); B.cone([x1,y1-.3,o.z],[x1,y1+4.4,o.z],.15,.15,[.12,.23,.54],0,6); B.cone([x2,y2-.3,o.z],[x2,y2+4.4,o.z],.15,.15,[.12,.23,.54],0,6);
        B.quad([x1,y1+3.2,o.z],[x2,y2+3.2,o.z],[x2,y2+4.4,o.z],[x1,y1+4.4,o.z],[.9,.2,.2],4); B.quad([x1+2,y1+3.6,o.z-.03],[x2-2,y2+3.6,o.z-.03],[x2-2,y2+4,o.z-.03],[x1+2,y1+4,o.z-.03],[1,1,1],4); }
      else if(o.t==='house'){ const {x,z,w,dp,h}=o, c=SLGL.hex(o.col||'#9b2c20'), hx0=x-w/2, hx1=x+w/2, hz0=z-dp/2, hz1=z+dp/2, y0=Math.min(gy(hx0,hz0),gy(hx1,hz0),gy(hx0,hz1),gy(hx1,hz1))-.3;
        const house=(X0,X1,Z0,Z1,Y0,Y1,roof)=>{ B.box(X0,X1,Y0,Y1,Z0,Z1,c,0); const zm=(Z0+Z1)/2, yr=Y1+roof, e=.6, sn=[.95,.97,1];
          B.quad([X0-e,Y1-.15,Z0-e],[X1+e,Y1-.15,Z0-e],[X1+e,yr,zm],[X0-e,yr,zm],sn,2); B.quad([X0-e,Y1-.15,Z1+e],[X1+e,Y1-.15,Z1+e],[X1+e,yr,zm],[X0-e,yr,zm],sn,2);
          for(const xx of [X0,X1]) B.tri([xx,Y1,Z0],[xx,Y1,Z1],[xx,yr,zm],c,4);
          const nw=Math.max(1,Math.round((X1-X0)/4)); for(let q=0;q<nw;q++){ const wx=X0+(q+.5)*(X1-X0)/nw; for(const zf of [Z0-.03,Z1+.03]) B.quad([wx-.6,Y0+1.6,zf],[wx+.6,Y0+1.6,zf],[wx+.6,Y0+2.8,zf],[wx-.6,Y0+2.8,zf],[1.6,1.25,.6],3); } };
        house(hx0,hx1,hz0,hz1,y0,y0+h+.3,h*.55); if(o.tower){ const tx=hx0-2.2; house(tx-2,tx+2,z-2,z+2,y0,y0+h+5.8,2.2); } }
      else if(o.t==='dye'){ dash(o.p,o.a); dash(o.a,o.n); }
    }
    SLGL.addMesh(B,true); SLGL.addMesh(B2,false); GLT.build=Math.round(performance.now()-tb); GLT.n=(GLT.n||0)+1;
  }
  const GLT={};
  function glGate(B,g){ const c=g.col==='r'?[.95,.2,.2]:[.13,.36,.96], bend=g.hit?Math.max(0,1-(performance.now()-(g.hitT||0))/600)*.55:0;
    const pole=(x,z,bn)=>{ const y=gy(x,z), mx=x+bn*.55, tx=x+bn*1.15, ty=y+1.8-Math.abs(bn)*.5; B.cone([x,y-.05,z],[mx,y+.9,z],.03,.03,c,0,5); B.cone([mx,y+.9,z],[tx,ty,z],.03,.028,c,0,5); B.sphere([tx,ty,z],.03,c,0,4,3); };
    if(g.type==='gs'){ for(const [xa,xb] of [[g.a.x-.75,g.a.x],[g.b.x,g.b.x+.75]]){ pole(xa,g.a.z,0); pole(xb,g.a.z,0); const ya=gy(xa,g.a.z), yb=gy(xb,g.a.z);
        B.quad([xa,ya+.9,g.a.z],[xb,yb+.9,g.a.z],[xb,yb+1.72,g.a.z],[xa,ya+1.72,g.a.z],c,4); } }
    else { const away=g.type==='closed'?(g.aim.x>g.a.x?-1:1):(g.side||1)*-1;
      if(g.type==='single') pole(g.turn.x,g.turn.z,bend*away);
      else if(g.type==='closed'){ pole(g.a.x,g.a.z,bend*away); pole(g.b.x,g.b.z,0); }
      else { const tA=Math.abs(g.a.x-g.turn.x)<.01; pole(g.a.x,g.a.z,tA?bend*away:0); pole(g.b.x,g.b.z,!tA?bend*away:0); } } }
  function glFrame(dt){
    if(GLW!==R.C) glBuild();
    const s=meSk(), DD=R.camO?DSO:DS.on?DS:null; let C;
    if(DD){ DCUR=DD; const fx=(mid(s.z+6)-mid(s.z-6))/12; C=DRONE.solve(DD,{x:s.x,y:elev(s.z)+1,z:s.z},fx,1,dt,W,H,z=>elev(z)); GC.init=0; }
    else { // åkarvyn: kameran följer snett bakom och ovanför, tittar utför förbi åkaren
      const k=GC.init?1:0, tx=s.x-Math.sin(s.th)*1.5, ez=s.z-6.2; GC.x=k?GC.x+(tx-GC.x)*Math.min(1,dt*5):tx;
      const ey=Math.max(gy(GC.x,ez)+2.3, gy(s.x,s.z)+2.9), ly=gy(s.x,s.z+7)-.6; GC.y=k?GC.y+(ey-GC.y)*Math.min(1,dt*7):ey; GC.ly=k?GC.ly+(ly-GC.ly)*Math.min(1,dt*4):ly; GC.init=1;
      const lx=GC.x+(s.x-GC.x)*.85+Math.sin(s.th)*1.2, dx=lx-GC.x, dy=GC.ly-GC.y, dz=13.2;
      C={x:GC.x,y:GC.y,z:ez,yaw:Math.atan2(dx,dz),pitch:Math.atan2(-dy,Math.hypot(dx,dz)),f:Math.min(W,H)*1.3,W,H}; }
    lastYH=H/2-C.f*Math.tan(C.pitch);
    const B=SLGL.dyn().reset(), zA=s.z-200, zB=s.z+420;
    for(const gs of R.C.gates) for(const g of gs) if(g.zmax>zA&&g.zmin<zB) glGate(B,g);
    for(const o of R.sk){ if(o.z<zA||o.z>zB) continue; let L; CAP=[]; try{ drawSkier(o); } finally { L=CAP; CAP=null; }
      for(const q of L){ if(q[0]==='c') B.capsule(q[1],q[2],q[3],q[4],q[5],0,7); else if(q[0]==='s') B.sphere(q[1],q[2],q[3],0,8,5);
        else if(q[0]==='ski'){ const p=q[1]; B.tri(p[0],p[1],p[2],q[2],4); B.tri(p[0],p[2],p[4],q[2],4); B.tri(p[4],p[2],p[3],q[2],4); const a=V3.mix(p[0],p[1],.5), b=V3.mix(p[2],p[4],.5); B.cone([a[0],a[1]+.006,a[2]],[b[0],b[1]+.006,b[2]],.014,.014,q[3],0,3); }
        else if(q[0]==='helm'){ B.sphere(q[1],.128,q[3],0,10,6); B.sphere(V3.add(q[1],q[2],.07),.078,'#111827',0,8,5); B.sphere(V3.add(q[1],q[2],.092),.062,[1,.55,.1],0,8,5); B.sphere(V3.add(q[1],[0,1,0],.05),.1,q[4],0,6,3); } } }
    R.parts=R.parts.filter(p=>(p.t-=dt)>0); for(const p of R.parts){ p.x+=p.vx*dt; p.z+=p.vz*dt; p.y+=p.vy*dt; p.vy-=9*dt; B.sphere([p.x,gy(p.x,p.z)+Math.max(.02,p.y),p.z],.04*(p.r||1),[1,1,1],2,4,3); }
    const sn=T.M.D.sun, sl=Math.hypot(sn[0],sn[1],sn[2])||1;
    SLGL.render({C,W,H,sun:[sn[0]/sl,sn[1]/sl,sn[2]/sl],wx:R.wx,focus:[s.x,gy(s.x,s.z),s.z+(DD?0:22)],shadowR:DD?95:70,time:now()});
  }
  function capsule(x1,y1,x2,y2,w1,w2,col){ const dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L; w1=Math.max(1,w1); w2=Math.max(1,w2);
    ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(x1+nx*w1/2,y1+ny*w1/2); ctx.lineTo(x2+nx*w2/2,y2+ny*w2/2); ctx.lineTo(x2-nx*w2/2,y2-ny*w2/2); ctx.lineTo(x1-nx*w1/2,y1-ny*w1/2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x1,y1,w1/2,0,7); ctx.fill(); ctx.beginPath(); ctx.arc(x2,y2,w2/2,0,7); ctx.fill(); }
  // liten karta (banan uppifrån) och höjdprofil, ritas en gång per åk och storlek
  const rpBtns=()=> R&&R.rec&&R.rec.fr.length>10 ? `<div class="rp-btns"><button data-sl="rp">⏪ Repris</button><button data-sl="hl">🎬 Höjdpunkter</button></div>` : '';
  function maps(){
    const C=R.C, key=W+'x'+H+':'+R.gid; if(R.mapKey===key) return; R.mapKey=key;
    const L=C.L+10, mw=46, mh=Math.round(Math.min(170,H*.24)), pw=Math.round(W-24), ph=30;
    let xmin=1e9,xmax=-1e9; for(let z=0;z<L;z+=4){ const m=mid(z), h=halfAt(z); xmin=Math.min(xmin,m-h); xmax=Math.max(xmax,m+h); }
    const zs=(mh-8)/L, xs=Math.min((mw-8)/(xmax-xmin), zs*2.2), xc=(xmin+xmax)/2;
    const mx=x=>mw/2+(x-xc)*xs, my=z=>4+z*zs;
    const [mc,m]=off(mw*2,mh*2); m.scale(2,2);
    m.fillStyle='rgba(15,23,42,.55)'; m.beginPath(); m.roundRect(0,0,mw,mh,8); m.fill();
    m.fillStyle='rgba(240,248,255,.9)'; m.beginPath(); for(let z=0;z<=L;z+=3) m.lineTo(mx(mid(z)-halfAt(z)),my(z)); for(let z=L;z>=0;z-=3) m.lineTo(mx(mid(z)+halfAt(z)),my(z)); m.closePath(); m.fill();
    m.fillStyle='rgba(22,101,52,.55)'; for(let z=0;z<L;z+=6){ if((T.trees[z]||0)>.8){ m.fillRect(mx(mid(z)-halfAt(z))-3,my(z),2.5,6*zs+.5); m.fillRect(mx(mid(z)+halfAt(z))+.5,my(z),2.5,6*zs+.5); } }
    C.gates.forEach(gs=>gs.forEach(g=>{ m.fillStyle=g.col==='r'?'#ef4444':'#2563eb'; m.fillRect(mx(g.turn.x)-1,my(g.turn.z)-.8,2,1.6); }));
    m.fillStyle='#ef4444'; m.fillRect(mx(mid(C.L)-halfAt(C.L)),my(C.L)-1,(halfAt(C.L)*2)*xs,2);
    const [pc,q]=off(pw*2,ph*2); q.scale(2,2);
    q.fillStyle='rgba(15,23,42,.55)'; q.beginPath(); q.roundRect(0,0,pw,ph,8); q.fill();
    const y0=T.y[0], y1=at(T.y,L), px=z=>6+z/L*(pw-12), py=y=>5+(y0-y)/(y0-y1)*(ph-10);
    q.beginPath(); q.moveTo(px(0),ph-3); for(let z=0;z<=L;z+=2) q.lineTo(px(z),py(at(T.y,z))); q.lineTo(px(L),ph-3); q.closePath();
    const gg=q.createLinearGradient(0,0,0,ph); gg.addColorStop(0,'rgba(240,248,255,.95)'); gg.addColorStop(1,'rgba(148,180,220,.6)'); q.fillStyle=gg; q.fill();
    // branta partier markeras
    q.strokeStyle='#f97316'; q.lineWidth=2; q.beginPath(); let on=false; for(let z=0;z<=L;z+=2){ const st=at(T.pitch,z)>.42; if(st){ on?q.lineTo(px(z),py(at(T.y,z))):q.moveTo(px(z),py(at(T.y,z))); on=true; } else on=false; } q.stroke();
    q.fillStyle='#ef4444'; q.fillRect(px(C.L)-1,3,2,ph-6);
    R.map={mc,mw,mh,mx,my,pc,pw,ph,px,py};
  }
  function minimap(){
    maps(); const M=R.map, x0=W-M.mw-10, y0=R.sk.length>1?58:12, s=meSk();
    ctx.drawImage(M.mc,x0,y0,M.mw,M.mh);
    R.sk.forEach(o=>{ if(o!==s){ ctx.fillStyle=o.k===0?'#facc15':'#f87171'; ctx.beginPath(); ctx.arc(x0+M.mx(o.x),y0+M.my(Math.min(o.z,R.C.L)),2.6,0,7); ctx.fill(); } });
    ctx.fillStyle='#fff'; ctx.strokeStyle='#0b2e7a'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x0+M.mx(s.x),y0+M.my(Math.min(s.z,R.C.L)),3.3,0,7); ctx.fill(); ctx.stroke();
    const px0=12, py0=H-M.ph-8; ctx.drawImage(M.pc,px0,py0,M.pw,M.ph);
    R.sk.forEach(o=>{ const z=Math.min(o.z,R.C.L); ctx.fillStyle=o===s?'#fff':(o.k===0?'#facc15':'#f87171'); ctx.beginPath(); ctx.arc(px0+M.px(z),py0+M.py(elev(z)),o===s?3.6:2.8,0,7); ctx.fill(); if(o===s){ ctx.strokeStyle='#0b2e7a'; ctx.lineWidth=1.5; ctx.stroke(); } });
    ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font='700 10px system-ui'; ctx.textAlign='right'; ctx.textBaseline='top'; ctx.fillText(`${Math.round(at(T.pitch,s.z)*100)} %`,px0+M.pw-6,py0+3);
  }
  function hud(){
    minimap();
    const s=meSk(), C=R.C, t=R.started? (s.done? (s.finish??s.t) : s.t+s.pen) : 0, n=C.gates[s.lane].length;
    ctx.fillStyle='rgba(15,23,42,.55)'; ctx.beginPath(); ctx.roundRect(10,10,160,58,14); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='800 26px ui-monospace,monospace'; ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(fmt(t),20,16);
    ctx.font='600 12px system-ui'; ctx.fillStyle='#cbd5e1'; ctx.fillText(`Port ${Math.min(s.gi,n)}/${n} · ${Math.round(s.v*3.6)} km/h`,20,48);
    const best=bestOf(), half=Math.floor(n/2); if(R.split && s.gi>=half && s.gi<half+5 && best.split){ const d=R.split-best.split; ctx.fillStyle=d<=0?'#22c55e':'#ef4444'; ctx.font='800 20px system-ui'; ctx.fillText((d<=0?'−':'+')+Math.abs(d).toFixed(2),180,22); }
    if(R.sk.length>1){ const o=R.sk[1-R.me], dz=o.z-s.z; ctx.fillStyle='rgba(15,23,42,.55)'; ctx.beginPath(); ctx.roundRect(W-150,10,140,40,12); ctx.fill();
      ctx.fillStyle=o.k===0?'#fda4af':'#93c5fd'; ctx.font='700 13px system-ui'; ctx.textAlign='right'; ctx.fillText(`${bare(pname(o.k))}: ${o.done?(o.dsq?'ur':fmt(o.finish)):(dz>=0?'+':'')+dz.toFixed(0)+' m'}`,W-20,24); }
    const kind=T.kind[Math.round(s.z)|0];
    if(R.started && !s.done && kind==='steep' && (R.steepShown||0)<s.z-200){ R.steepShown=s.z; R.banner={txt:'⚠️ Brant!',t:1.6}; }
    if(R.banner&&R.banner.t>0){ ctx.globalAlpha=Math.min(1,R.banner.t*2); ctx.textAlign='center'; ctx.font='900 30px system-ui'; ctx.fillStyle='#fde047'; ctx.fillText(R.banner.txt,W/2,82); ctx.globalAlpha=1; }
    if(!R.started && R.cd>0){ const n2=Math.ceil(R.cd); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='900 90px system-ui'; ctx.fillStyle='#fff'; ctx.save(); ctx.shadowColor='#ef4444'; ctx.shadowBlur=25; ctx.fillText(n2>3?'':String(n2),W/2,H*.42); ctx.restore(); ctx.font='800 16px system-ui'; ctx.fillStyle='#fff'; ctx.fillText(`${R.wx.icon} ${R.wx.name}`,W/2,H*.42+66); const I=C.info, V=T.M.V; ctx.font='800 15px system-ui'; ctx.fillText(`${V.icon} ${V.name} · ${V.title}`,W/2,H*.42+92); ctx.font='600 13px system-ui'; ctx.fillStyle='#e2e8f0'; ctx.fillText(`${I.gates} portar · fallhöjd ${I.drop} m · ${I.len} m`,W/2,H*.42+112); ctx.fillText(`Bansättare ${I.setter}: ${I.style}`,W/2,H*.42+130); ctx.font='500 12px system-ui'; ctx.fillText(I.figs.slice(0,5).join(' · '),W/2,H*.42+147); }
    else if(R.started && s.t<.8){ ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='900 72px system-ui'; ctx.fillStyle='#22c55e'; ctx.fillText('KÖR!',W/2,H*.42); }
  }
  const fmt=t=>{ const m=Math.floor(t/60), s=t-m*60; return (m?m+':':'')+(m?String(s.toFixed(2)).padStart(5,'0'):s.toFixed(2)); };
  const bestKey=k=>`sl_best4_${venueOf(G)}_${G.disc}${G.par?'p':''}_r${k}`;
  function bestOf(k){ if(!G.std) return {}; try{ return JSON.parse(lsGet(bestKey(k==null?(G.run||1):k)))||{}; }catch(e){ return {}; } }

  /* ---------- slingan ---------- */
  function loop(nowMs){
    raf=0; if(!G||G.kind!=='slalom'||view!=='game'||!cv||!cv.isConnected){ sndOff(); return; }
    raf=requestAnimationFrame(loop);
    const dt=Math.min(.05,(nowMs-(lastT||nowMs))/1000); lastT=nowMs;
    const runId=G.id+':'+(G.go||0); if(!R||R.gid!==runId) newRun();
    if(R.play){ playStep(dt); draw(dt); return; }
    const s=meSk();
    let inp=0; if(drag) inp=clamp((drag.x-drag.x0)/(W*.22),-1,1);
    const kx=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0); if(kx) steer+=(kx-steer)*Math.min(1,dt*6); else steer*=Math.pow(.02,dt); if(!drag) inp=steer;
    if(DS.on && FLIP) inp=-inp;   // kameran tittar mot åkaren: styr efter skärmen, inte efter åkarens höger/vänster
    if(!R.started){ R.cd-=dt; const n=Math.ceil(R.cd); if(n!==R.beeped && n>=1 && n<=3){ R.beeped=n; tone(660,.12,'sine',.12); } if(R.cd<=0){ R.started=true; tone(1320,.35,'sine',.13); sndInit(); cheer(.12); } }
    else {
      const lv=G.ai||[];
      for(const sk of R.sk){
        if(sk===s) physics(sk,dt, DEV&&window.__slAuto ? aiInput(sk,'hard',dt) : inp);   // autopilot bara för tester i dev
        else if(sk.ai) physics(sk,dt,aiInput(sk,lv[sk.k],dt));
        else if(R.remote){ const r=R.remote; sk.x+=(r.x-sk.x)*Math.min(1,dt*10); sk.z+=(r.z+(r.v||0)*Math.min(.15,(nowMs-r.at)/1000)-sk.z)*Math.min(1,dt*10); sk.th=r.th; sk.lean=r.l||0; sk.tuck=r.k||0; sk.v=r.v; sk.done=!!r.d; sk.dsq=!!r.q; sk.finish=r.f; sk.gi=r.gi||sk.gi; }
      }
      // snöstänk från ytterskidans kant i svängarna
      if(!s.done && Math.abs(s.om)>.45 && s.v>5){ const n=Math.abs(s.om)>R.C.d.turn*.7?3:1; for(let i=0;i<n;i++) R.parts.push({x:s.x-Math.sign(s.om)*.5+(Math.random()-.5)*.4, z:s.z+.3, y:.05, vx:-Math.sign(s.om)*(2+Math.random()*4)*Math.min(1,s.v/14), vz:s.v*.25, vy:1+Math.random()*2.6, t:.55, r:.7+Math.random()*.8}); }
      if(R.parts.length>180) R.parts.splice(0,R.parts.length-180);
      recStep(dt);
      if(s.done && !s.dsq){ if(!R.camO){ R.camO=true; DSO.cut=true; DSO.view='close'; DSO.zoom=.04; DSO.fast=2.5; R.celebT=0; } R.celebT+=dt; DSO.ang=-.8+R.celebT*.35; }
      R.shake=Math.max(0,R.shake-dt*3); if(R.banner) R.banner.t-=dt;
      sndUpdate(s);
      // publiken jublar ibland när man åker förbi
      R.cheer-=dt; const zi=Math.round(s.z)|0; if(R.cheer<=0){ R.cheer=2+Math.random()*4; if(T.crowd[zi] && Math.random()<.65 && !s.done) cheer(.05+Math.random()*.06); }
      if(mode==='online' && nowMs-sendT>66){ sendT=nowMs; send({t:'sl', g:G.id, n:G.go||0, x:+s.x.toFixed(2), z:+s.z.toFixed(2), th:+s.th.toFixed(3), l:+s.lean.toFixed(2), k:+(s.tuck||0).toFixed(2), v:+s.v.toFixed(2), gi:s.gi, d:s.done?1:0, q:s.dsq?1:0, f:s.finish!=null?+s.finish.toFixed(3):null}); }
      if(s.done && !R.sent && performance.now()-(R.finishT||(R.finishT=performance.now()))>(s.dsq?1500:3600)){ R.sent=true; sndOff(); finishRun(s); }
      for(const sk of R.sk) if(sk.ai && sk.done && !sk.sentAI){ sk.sentAI=true; applyAndPublish({type:'finish', run:G.run, ms:sk.dsq?null:Math.round(sk.finish*1000)}, sk.k); }
    }
    draw(dt);
  }
  function finishRun(s){
    const ms = s.dsq ? null : Math.round((s.finish)*1000);
    if(ms && G.std){ const B=bestOf(); if(!B.t||ms<B.t){ lsSet(bestKey(G.run),JSON.stringify({...B,t:ms,split:R.split,d:Date.now()})); if(B.t) setTimeout(()=>{ toast(`🏆 Rekord i åk ${G.run}!`,2500); sparkles(24); },400); }
      if(G.run===2){ const r1=G.res[G.par?meSeat():0][0]; if(r1>0){ const tot=r1+ms, B0=bestOf(0); if(!B0.total||tot<B0.total){ lsSet(bestKey(0),JSON.stringify({total:tot,d:Date.now()})); if(B0.total) setTimeout(()=>{ toast('🏆 Nytt rekord totalt!',2600); sparkles(40); },1400); } } } }
    doAct({type:'finish', run:G.run, ms});
  }
  let scaleDpr=1;
  function draw(dt){ ctx.setTransform(scaleDpr,0,0,scaleDpr,0,0); ctx.save(); let g3=false; if(glActive()){ try{ ctx.clearRect(0,0,W,H); glFrame(dt); g3=true; }catch(e){ GLON=false; glSync(); try{ console.warn('3D-provet stängdes av:',e); }catch(_){} } } if(!g3) drawScene(dt); ctx.restore(); WEATHER.post(ctx,W,H,lastYH,g3?{...R.wx,fog:0,flat:0,kind:R.wx.kind==='sun'?'gl':R.wx.kind}:R.wx,R.wxs,dt,meSk().v); const p=R.play; if(!p||p.mode!=='hl') hud();
    if(p&&p.mode==='hl'&&PHOTO){ const sk=meSk(), who=bare(pname(sk.k));
      if(p.rt<2.6){ drawPhoto(p.rt/2.6,'🎬 Höjdpunkter',`${who} · ${G.disc==='gs'?'storslalom':'slalom'} · ${R.wx.icon} ${R.wx.name}`,Math.min(1,(2.6-p.rt)*3)); return; }
      if(p.done&&p.outro>.6){ drawPhoto(Math.min(1,(p.outro-.6)/4),sk.dsq?'Nästa gång! 💪':`${sk.mood==='cheer'?'🏆 ':''}${fmt(sk.finish??0)}`,`${who} · åk ${G.run||1} · ${sk.missed?sk.missed+' missad'+(sk.missed>1?'e':'')+' port':'alla portar'}`,Math.min(1,(p.outro-.6)*2)); return; } }
    if(p) REPLAY.overlay(ctx,W,H,{mode:p.mode, speed:p.speed, flash:p.flash, title:p.mode==='hl'&&!PHOTO?Math.max(0,1.8-p.rt):0, sub:`${G.disc==='gs'?'Storslalom':'Slalom'} · åk ${G.run||1}`, cap:p.cap, capA:p.capA, slow:p.slow&&p.playing}); }
  function fit(){ if(!cv) return; const host=cv.parentElement; const r=host.getBoundingClientRect(); const w=Math.round(Math.min(host.clientWidth, 700)), h=Math.round(Math.max(320, Math.min(window.innerHeight - r.top - 10, w*1.9)));
    const dpr=Math.min(weakDev()?1.5:3, window.devicePixelRatio||1, Math.sqrt(2.8e6/(w*h))); cv.style.width=w+'px'; cv.style.height=h+'px'; cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); W=w; H=h; BDsize=''; scaleDpr=dpr;
    if(glcv){ const d2=Math.min(dpr,weakDev()?1.25:2.5,Math.sqrt(2.3e6/(w*h))); glcv.width=Math.round(w*d2); glcv.height=Math.round(h*d2); glcv.style.width=w+'px'; glcv.style.height=h+'px'; glcv.style.left=cv.offsetLeft+'px'; glcv.style.top=cv.offsetTop+'px'; } }
  window.addEventListener('resize',()=>{ if(G&&G.kind==='slalom'&&view==='game') fit(); });
  function mount(){
    const host=document.getElementById('slHost'); if(!host) return; sprites();
    if(!cv){ cv=document.createElement('canvas'); cv.className='sl-cv'; ctx=cv.getContext('2d');
      cv.addEventListener('pointerdown',e=>{ e.preventDefault(); unlockAudio(); sndInit(); drag={x0:e.clientX, x:e.clientX, id:e.pointerId}; try{ cv.setPointerCapture(e.pointerId); }catch(er){} });
      window.addEventListener('pointermove',e=>{ if(drag&&e.pointerId===drag.id) drag.x=e.clientX; },{passive:true});
      const up=e=>{ if(drag&&e.pointerId===drag.id) drag=null; }; window.addEventListener('pointerup',up); window.addEventListener('pointercancel',up);
      cv.addEventListener('contextmenu',e=>e.preventDefault()); }
    if(!glcv){ glcv=document.createElement('canvas'); glcv.className='sl-glc'; }
    host.appendChild(glcv); host.appendChild(cv); glSync(); fit();
    if(!raf){ lastT=0; raf=requestAnimationFrame(loop); }
  }
  document.addEventListener('keydown',e=>{ if(G&&G.kind==='slalom'&&view==='game'&&['ArrowLeft','ArrowRight'].includes(e.code)){ keys[e.code]=true; e.preventDefault(); } });
  document.addEventListener('keyup',e=>{ keys[e.code]=false; });
  document.addEventListener('keydown',e=>{ if(G&&G.kind==='slalom'&&view==='game'&&e.code==='KeyC') DRONE.setOn(DS,!DS.on); });
  function toggleCam(){ camMode=camMode==='drone'?'rider':'drone'; lsSet('sl_cam',camMode); const b=document.querySelector('.sl-cam'); if(b) b.textContent=camMode==='drone'?'⛷️ Åkarvy':'🚁 Drönarvy'; sfx.bubble(); }
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) sndOff(); });

  /* ---------- nätet ---------- */
  function onNet(m){
    if(!G||G.kind!=='slalom'||m.g!==G.id||!R||(m.n||0)!==(G.go||0)) return;
    if(!['x','z','th','v'].every(k=>Number.isFinite(m[k]))) return;
    R.remote={x:m.x,z:m.z,th:m.th,l:+m.l||0,k:+m.k||0,v:m.v,gi:+m.gi||0,d:m.d,q:m.q,f:Number.isFinite(m.f)?m.f:null,at:performance.now()};
  }

  /* ---------- spelmotorn ---------- */
  GINFO.slalom={name:'Slalom', icon:'⛷️', ai:'Blixt 🤖', max:2, desc:'Storslalom och slalom i Björnrike och Åre', grad:'linear-gradient(135deg,#60a5fa,#e0f2fe 55%,#ef4444)'};
  // tider: res[spelare] = [åk 1, åk 2] i ms, null = ur; undefined = ej åkt
  const okMs=x=>x===null||(Number.isInteger(x)&&x>3000&&x<900000);
  const total=r=>!r||r.length<2||r.some(x=>x===undefined)?undefined: r.some(x=>x===null)?null: r[0]+r[1];
  const runDone=(g,k)=>g.res.every(r=>r[k]!==undefined && r[k]!==-1);
  KIND.slalom={
    init(){ const base=!fresh&&G&&G.kind==='slalom'?G:null; fresh=false; const o=base?{disc:base.disc,par:base.par,pen:base.pen,std:base.std,venue:base.venue}:pend;
      return {disc:o.disc, par:o.par, pen:o.pen, std:!!o.std, venue:MOUNTAIN.VENUES[o.venue]?o.venue:'bj', seeds:[0,0], run:1, res:[], go:0, cur:0}; },
    start(g){ g.seeds=[Math.floor(Math.random()*1e9),Math.floor(Math.random()*1e9)]; g.run=1; g.res=g.names.map(()=>[-1,-1]); g.go=(g.go||0)+1; g.cur=0; if(g.names.length>1) g.par=true; },
    valid(g){ return g.names.length>=1&&g.names.length<=2 && (g.disc==='gs'||g.disc==='sl') && (g.venue===undefined||!!MOUNTAIN.VENUES[g.venue]) && typeof g.par==='boolean' && typeof g.pen==='boolean'
      && Array.isArray(g.seeds)&&g.seeds.length===2&&g.seeds.every(Number.isInteger) && (g.run===1||g.run===2)
      && Array.isArray(g.res) && g.res.every(r=>Array.isArray(r)&&r.length===2&&r.every(x=>x===-1||okMs(x))); },
    waitingFor(){ return -1; },
    scoreOf(g,i){ const r=g.res&&g.res[i]; if(!r) return ''; const f=x=>x===-1?'–':x===null?'ur':fmt(x/1000); return g.run===1? f(r[0]) : `${f(r[0])} + ${f(r[1])}`; },
    apply(g,a,seat){
      const k=(g.run||1)-1;
      if(a.type==='resign'){ if(g.over) return false; g.res[seat]=[g.res[seat][0]===-1?null:g.res[seat][0], null]; }
      else if(a.type==='finish'){ if(g.over||g.res[seat][k]!==-1||(a.run&&a.run!==g.run)||!okMs(a.ms)) return false; g.res[seat][k]=a.ms; g.last={t:Date.now(),seat,ms:a.ms,run:g.run}; }
      else if(a.type==='next'){ if(g.over||g.run!==1||!runDone(g,0)) return false; g.run=2; g.go=(g.go||0)+1; g.last={t:Date.now(),type:'next'}; return true; }
      else return false;
      if(g.res.every(r=>r[0]!==-1&&r[1]!==-1)){
        g.over=true; const t=g.res.map(r=>{ const v=total(r); return v==null?Infinity:v; }); const mn=Math.min(...t);
        g.winner = g.names.length===1 ? (mn<Infinity?0:-2) : mn===Infinity ? -1 : t.filter(x=>x===mn).length>1 ? -1 : t.indexOf(mn); }
      return true; },
    aiSeat(){ return null; },
    effects(prev,d){ if(d.last&&(!prev.last||prev.last.t!==d.last.t)&&d.last.seat!=null&&d.last.seat!==meSeat()&&d.names.length>1) toast(`${bare(pname(d.last.seat))} i mål: ${d.last.ms===null?'ur 😬':fmt(d.last.ms/1000)}`,2000); },
    html(){
      const g=G, me=meSeat(), f=x=>x===-1||x===undefined?'–':x===null?'ur':fmt(x/1000);
      let over='';
      const table=()=>g.names.map((n,i)=>{ const r=g.res[i]; return `<div class="sl-res ${g.over&&g.winner===i?'win':''}"><b>${esc(bare(n))}</b><span>${f(r[0])}${g.run===2||g.over?` · ${f(r[1])}`:''}${g.over?` = <b>${f(total(r))}</b>`:''}</span></div>`; }).join('');
      if(g.over){ const solo=g.names.length===1, tt=total(g.res[0]);
        const B=bestOf(0);
        over=`<div class="sl-over"><div class="gover ${solo?(tt!=null?'won':'lost'):g.winner===me?'won':g.winner===-1?'tie':'lost'}"><div class="gi">${solo?(tt!=null?'⛷️':'😬'):g.winner===me?'🏆':g.winner===-1?'🤝':'🎿'}</div>
          <h3>${solo?(tt!=null?'Båda åken klara!':'Ur!'):g.winner===me?'Du vann!':g.winner===-1?'Oavgjort':esc(bare(pname(g.winner)))+' vann'}</h3><p class="sl-pb">Åk 1 · åk 2 = totalt</p>${table()}
          ${g.std&&B.total?`<p class="sl-pb">Ditt rekord på standardsättningen här: <b>${fmt(B.total/1000)}</b></p>`:''}
          ${rpBtns()}<div class="gbtns"><button class="pri" data-g="rematch">🔄 Ny tävling</button><button data-act="lobby">🏠 Lobby</button></div></div></div>`; }
      else if(g.run===1 && runDone(g,0)){ const can = mode!=='online' || role==='host';
        over=`<div class="sl-over"><div class="gover tie"><div class="gi">⏱️</div><h3>Åk 1 klart</h3>${table()}
          <p class="sl-pb">Åk 2 har en ny bansättning${g.par?' och ni byter bana':''}.</p>
          ${rpBtns()}<div class="gbtns">${can?`<button class="pri" data-sl="next">▶️ Starta åk 2</button>`:'<p>Väntar på att värden startar åk 2…</p>'}</div></div></div>`; }
      return `<div class="sl-wrap ${R&&R.play?'rp-on'+(R.play.mode==='hl'?' rp-hl':''):''}"><div id="slHost" class="sl-host"></div>${DRONE.panel(DS)}<button class="sl-glb" data-sl="gl">${glLabel()}</button>${R&&R.play?REPLAY.bar('sl',R.play):''}${over}</div>
        <div class="ghint">${MOUNTAIN.VENUES[venueOf(g)].name}, ${MOUNTAIN.VENUES[venueOf(g)].title} · ${DISC[g.disc].name}${g.par?' · parallell':''} · ${g.std?'standardsättning':'ny bansättning'} · åk ${g.run} av 2 · Dra fingret åt sidan (eller ← →) för att svänga, släpp för att åka rakt – då går du ned i fartställning. ${g.pen?'Missad port +3 s.':'Missad port = ur.'} ${g.over?'':KIT.resignHTML()}</div>`; },
    mounted(){ mount(); }
  };

  /* ---------- meny ---------- */
  let mDisc=lsGet('sl_disc')||'gs', mPen=lsGet('sl_pen')!=='0';
  const segD=()=>Object.entries(DISC).map(([k,d])=>`<button data-sl="disc" data-v="${k}" class="${mDisc===k?'sel':''}">${k==='gs'?'🚩':'🎌'} ${d.name}</button>`).join('');
  const segP=()=>`<button data-sl="pen" data-v="1" class="${mPen?'sel':''}">+3 s straff</button><button data-sl="pen" data-v="0" class="${!mPen?'sel':''}">Riktiga regler: ur</button>`;
  let mStd=lsGet('sl_std')!=='0', mVen=MOUNTAIN.VENUES[lsGet('sl_ven')]?lsGet('sl_ven'):'bj', mtRaf=0;
  const segV=()=>Object.entries(MOUNTAIN.VENUES).map(([k,v])=>`<button data-sl="ven" data-v="${k}" class="${mVen===k?'sel':''}">${v.icon} ${v.name}<small>${v.title}</small></button>`).join('');
  function venInfo(){ const m=MOUNTAIN.get(mVen), dr=m.p.race[mDisc], z0=m.zOfDrop(dr); return `${m.D.fjall} · start ${Math.round(m.elev(z0))} m ö.h. · mål ${Math.round(m.elev(m.zFin))} m ö.h. · fallhöjd ${dr} m · ${m.zFin-z0} m lång`; }
  function mtLoop(){ cancelAnimationFrame(mtRaf); const tick=t=>{ const c=document.getElementById('slMt'); if(!c) return; try{ MOUNTAIN.preview(c,mVen,t/1000); }catch(e){} mtRaf=requestAnimationFrame(tick); }; mtRaf=requestAnimationFrame(tick); }
  const segS=()=>`<button data-sl="std" data-v="1" class="${mStd?'sel':''}">📌 Standardsättning</button><button data-sl="std" data-v="0" class="${!mStd?'sel':''}">🎲 Helt ny bana</button>`;
  /* ---------- egen bild till höjdpunkterna – sparas bara i den här enheten ---------- */
  let PHOTO=null; const loadPhoto=()=>{ const d=lsGet('sl_photo'); if(!d){ PHOTO=null; return; } const im=new Image(); im.onload=()=>{ PHOTO=im; }; im.src=d; }; loadPhoto();
  function pickPhoto(){ const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
    inp.onchange=()=>{ const f=inp.files&&inp.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ const im=new Image(); im.onload=()=>{
        const k=Math.min(1,1280/Math.max(im.width,im.height)), c=document.createElement('canvas'); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k); c.getContext('2d').drawImage(im,0,0,c.width,c.height);
        let q=.85, d=c.toDataURL('image/jpeg',q); while(d.length>900000&&q>.4){ q-=.1; d=c.toDataURL('image/jpeg',q); }
        try{ lsSet('sl_photo',d); loadPhoto(); toast('📷 Bilden sparad i den här enheten'); }catch(e){ toast('Bilden var för stor att spara'); }
        const t=document.getElementById('slPh'); if(t) t.innerHTML=photoHTML(); }; im.src=rd.result; }; rd.readAsDataURL(f); };
    inp.click(); }
  const photoHTML=()=>{ const d=lsGet('sl_photo'); return d?`<img src="${d}" alt="" class="sl-ph"><button data-sl="phx">🗑 Ta bort</button><button data-sl="ph">📷 Byt</button>`:`<button data-sl="ph">📷 Välj en bild</button>`; };
  // bilden med långsam inzoomning (Ken Burns), som inledning och avslutning på höjdpunkterna
  function drawPhoto(k,title,sub,a){
    if(!PHOTO) return; const iw=PHOTO.width, ih=PHOTO.height, sc=Math.max(W/iw,H/ih)*(1+k*.08), fx=.45, fy=.5;
    const dw=iw*sc, dh=ih*sc, x=clamp(W/2-fx*dw,W-dw,0), y=clamp(H/2-fy*dh,H-dh,0);
    ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); ctx.drawImage(PHOTO,x,y,dw,dh);
    const bar=H*.06, g=ctx.createLinearGradient(0,bar,0,bar+150); g.addColorStop(0,'rgba(2,6,23,.85)'); g.addColorStop(1,'rgba(2,6,23,0)'); ctx.fillStyle=g; ctx.fillRect(0,bar,W,150);
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,bar); ctx.fillRect(0,H-bar,W,bar);
    ctx.fillStyle='#facc15'; ctx.fillRect(22,bar+18,52,5); ctx.fillStyle='#fff'; ctx.font='900 26px system-ui'; ctx.textAlign='left'; ctx.textBaseline='alphabetic'; ctx.fillText(title,22,bar+54);
    ctx.font='700 14px system-ui'; ctx.fillStyle='#e2e8f0'; ctx.fillText(sub,22,bar+78); ctx.restore(); }
  const lvlName={easy:'🐣 Lätt',medium:'🙂 Medel',hard:'🧠 Svår'};
  let mLvl=lsGet('sl_lvl')||'medium';
  const segL=()=>Object.entries(lvlName).map(([k,l])=>`<button data-sl="lvl" data-v="${k}" class="${mLvl===k?'sel':''}">${l}</button>`).join('');
  const segU=()=>[['swe','🇸🇪 Team Sweden'],['own','🖤 Svart · turkos hjälm'],['red','❤️ Röd']].map(([k,l])=>`<button data-sl="suit" data-v="${k}" class="${(lsGet('sl_suit')||'swe')===k?'sel':''}">${l}</button>`).join('');
  function bestLine(){ const f=k=>{ try{ const b=JSON.parse(lsGet(k)); return b&&b.total?fmt(b.total/1000):'–'; }catch(e){ return '–'; } }; return `Rekord här med standardsättning (två åk): storslalom ${f(`sl_best4_${mVen}_gs_r0`)} · slalom ${f(`sl_best4_${mVen}_sl_r0`)}`; }
  GINFO.slalom.menu=function(){
    openModal(`<h3>⛷️ Slalom – Björnrike och Åre</h3><p>Två åk med olika bansättning – lägst sammanlagd tid vinner. Dra fingret åt sidan för att svänga; släpp och åk rakt så går du ned i fartställning.</p>
      <label>Backe</label><div class="seg sl-ven" id="slV">${segV()}</div><canvas id="slMt" class="sl-mt" width="720" height="400"></canvas><div class="setnote" id="slVi">${venInfo()}</div>
      <label>Ditt namn</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
      <label>Gren</label><div class="seg" id="slD">${segD()}</div>
      <label>Bana</label><div class="seg" id="slS">${segS()}</div>
      <label>Missad port</label><div class="seg" id="slP">${segP()}</div>
      <label>Datorns nivå (parallellslalom)</label><div class="seg" id="slL">${segL()}</div>
      <label>Din dräkt</label><div class="seg" id="slU">${segU()}</div>
      <label>Egen bild till höjdpunkterna</label><div class="sl-phrow" id="slPh">${photoHTML()}</div><div class="setnote">Bilden sparas bara i den här enheten – den laddas aldrig upp eller skickas till någon.</div>
      <div class="setnote" id="slBl">${bestLine()}</div><div class="setnote">Banorna sätts enligt Svenska Skidförbundets regler för ungdom (U14), av olika bansättare med egen stil.</div>
      <div class="btns" style="flex-direction:column"><button class="pri" data-sl="solo">⏱️ Åk ensam mot klockan</button>
        <button class="pri" data-sl="ai" style="background:linear-gradient(135deg,#ef4444,#2563eb)">🤖 Parallellslalom mot datorn</button>
        <button class="pri" data-sl="host" style="background:linear-gradient(135deg,#f472b6,#a855f7)">🚀 Parallellslalom mot en kompis</button>
        <button data-act="close">Avbryt</button></div>`,'slmenu'); mtLoop(); };
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-sl]'); if(!b) return; const a=b.dataset.sl, nm=(document.getElementById('nm')?.value||'').trim();
    if(a==='gl'){ GLON=!GLON; lsSet('sl_gl',GLON?'1':'0'); glSync(); fit(); sfx.bubble(); return; }
    if(a==='suit'){ lsSet('sl_suit',b.dataset.v); document.getElementById('slU').innerHTML=segU(); sfx.bubble(); return; }
    if(a==='ph'){ pickPhoto(); return; }
    if(a==='phx'){ try{ localStorage.removeItem((typeof DEV!=='undefined'&&DEV?'dev:':'')+'sl_photo'); }catch(e){} lsSet('sl_photo',''); loadPhoto(); document.getElementById('slPh').innerHTML=photoHTML(); return; }
    if(a==='ven'){ mVen=b.dataset.v; lsSet('sl_ven',mVen); document.getElementById('slV').innerHTML=segV(); document.getElementById('slVi').textContent=venInfo(); document.getElementById('slBl').textContent=bestLine(); sfx.bubble(); return; }
    if(a==='disc'){ mDisc=b.dataset.v; lsSet('sl_disc',mDisc); document.getElementById('slD').innerHTML=segD(); const vi=document.getElementById('slVi'); if(vi) vi.textContent=venInfo(); sfx.bubble(); return; }
    if(a==='pen'){ mPen=b.dataset.v==='1'; lsSet('sl_pen',mPen?'1':'0'); document.getElementById('slP').innerHTML=segP(); sfx.bubble(); return; }
    if(a==='std'){ mStd=b.dataset.v==='1'; lsSet('sl_std',mStd?'1':'0'); document.getElementById('slS').innerHTML=segS(); sfx.bubble(); return; }
    if(a==='next'){ unlockAudio(); if(R) { R.play=null; R.camO=false; } doAct({type:'next'}); return; }
    if(a==='rp'||a==='hl'){ unlockAudio(); startPlay(a==='rp'?'replay':'hl'); return; }
    if(a==='cam'){ toggleCam(); return; }
    if(a==='lvl'){ mLvl=b.dataset.v; lsSet('sl_lvl',mLvl); document.getElementById('slL').innerHTML=segL(); sfx.bubble(); return; }
    const n=nm||'Du'; lsSet('ry_name',n); unlockAudio();
    if(a==='solo'){ pend={disc:mDisc,par:false,pen:mPen,std:mStd,venue:mVen}; fresh=true; KIT.startSolo('slalom',n); return; }
    if(a==='ai'){ pend={disc:mDisc,par:true,pen:mPen,std:mStd,venue:mVen}; fresh=true; startGameLocal('slalom',n,mLvl,1); return; }
    if(a==='host'){ if(!nm){ toast('Skriv ditt namn 🐬'); return; } pend={disc:mDisc,par:true,pen:mPen,std:mStd,venue:mVen}; fresh=true; closeModal(); hostGame(n,'free','slalom'); return; } });

  const st=document.createElement('style'); st.textContent=`
.sl-wrap{position:relative;margin:0 auto}
.sl-host{display:flex;justify-content:center;position:relative}
.sl-glc{position:absolute;left:0;top:0;border-radius:16px;display:none}
.sl-cv{position:relative;z-index:1}
.sl-glb{position:absolute;left:8px;bottom:88px;padding:7px 11px;border-radius:12px;border:1px solid rgba(255,255,255,.35);background:rgba(15,23,42,.6);color:#fff;font-size:12.5px;font-weight:700;z-index:3;touch-action:manipulation}
.rp-hl .sl-glb{display:none}
.sl-cv{display:block;border-radius:16px;touch-action:none;-webkit-user-select:none;user-select:none;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.sl-over{position:absolute;top:0;right:0;bottom:0;left:0;display:grid;place-items:center;padding:14px;background:rgba(15,23,42,.25)}
.sl-over .gover{max-width:330px;width:100%;background:rgba(11,16,40,.9);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.sl-res{display:flex;justify-content:space-between;padding:6px 12px;border-radius:10px;background:rgba(255,255,255,.06);margin:4px 0;font-variant-numeric:tabular-nums}
.sl-res.win{background:rgba(250,204,21,.2);border:1px solid var(--gold)}
.sl-pb{font-size:13px;opacity:.85}
.sl-phrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.sl-ph{width:64px;height:48px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.3)}
.sl-ven button{display:flex;flex-direction:column;align-items:center;line-height:1.15}.sl-ven small{font-size:11px;opacity:.8;font-weight:600}
.sl-mt{display:block;width:100%;height:auto;border-radius:14px;margin:8px 0 2px;background:#4f86d4}
.sl-cam{position:absolute;right:12px;bottom:48px;padding:7px 11px;border-radius:12px;border:1px solid rgba(255,255,255,.35);background:rgba(15,23,42,.6);color:#fff;font-size:12.5px;font-weight:700;z-index:2}`; document.head.appendChild(st);

  return { net:onNet, __test:(typeof DEV!=='undefined'&&DEV)?{glt:()=>GLT,setCourse,checkCourse,physics,aiInput,DISC,RULES,run:()=>R,newRun,mid,AILV,terrain:()=>T,gy}:undefined };
})();
