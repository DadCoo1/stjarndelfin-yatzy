(async(kinds)=>{
const out={};
const rndVal=()=>{ const r=Math.random(); if(r<.15) return -1; if(r<.3) return 999; if(r<.4) return 'x'; if(r<.5) return null; if(r<.6) return [1,2,3]; if(r<.7) return 2.5; return Math.floor(Math.random()*90); };
const TYPES=['drop','put','roll','move','flip','play','take','blind','ask','pass','card','guess','set','note','hint','goal','resign','swap','zzz'];
for(const k of kinds){
  const res={games:0,moves:0,rejected:0,throws:[],invalid:[],redactInvalid:[],stuck:[],badEnd:[]};
  const np = GINFO[k].max>2 ? (k==='hjarter'?4: 2+Math.floor(Math.random()*3)) : (GINFO[k].max===1?1:2);
  if(k==='ordfajt') await __ofTest.loadDict('sv');
  for(let gme=0; gme<(k==='ordfajt'?4:12); gme++){
    const names=Array.from({length:np},(_,i)=>'P'+i); const ai=names.map(()=>['easy','medium','hard'][Math.floor(Math.random()*3)]);
    let g=gNewState(k,names,0,ai); if(k==='ordfajt'){ g.lang='sv'; g.extra={names:[],words:[]}; } KIND[k].start(g); G=g; mode='local';
    let steps=0;
    while(!g.over && steps<(k==='vandtia'?3000:1500)){
      steps++;
      // 1) skräpdrag från slumpad plats
      if(Math.random()<.35){ const a={type:TYPES[Math.floor(Math.random()*TYPES.length)]}; for(const f of ['c','i','p','v','to','rank','w','s','cards','tiles','letters']) if(Math.random()<.4) a[f]=rndVal();
        if(a.type==='resign') continue;
        const s=Math.floor(Math.random()*np); const before=JSON.stringify(g); let ok;
        try{ ok=KIND[k].apply(JSON.parse(before),a,s); }catch(e){ res.throws.push(k+' '+JSON.stringify(a)+' '+e.message); continue; }
        if(ok){ /* accepterat skräp: kontrollera att det ger giltigt läge */ const gg=JSON.parse(before); KIND[k].apply(gg,a,s); if(!KIND[k].valid(gg)) res.invalid.push('skräp accepterat '+JSON.stringify(a)); }
        else res.rejected++;
        continue; }
      // 2) riktigt drag
      const s = KIND[k].aiSeat ? KIND[k].aiSeat(g) : g.cur;
      if(s==null){ res.stuck.push(k+' aiSeat=null steg '+steps+' fas '+(g.phase||'')); break; }
      let a; try{ a=KIND[k].ai(g,s); }catch(e){ res.throws.push(k+' ai: '+e.message); break; }
      if(!a){ res.stuck.push(k+' ai gav null steg '+steps); break; }
      let ok; try{ ok=KIND[k].apply(g,a,s); }catch(e){ res.throws.push(k+' apply: '+e.message+' '+JSON.stringify(a)); break; }
      if(!ok){ res.stuck.push(k+' AI-drag avvisat '+JSON.stringify(a)); break; }
      res.moves++;
      if(!KIND[k].valid(g)){ res.invalid.push(k+' efter '+JSON.stringify(a)); break; }
      const js=JSON.parse(JSON.stringify(g)); if(!KIND[k].valid(js)) res.invalid.push('JSON-rundtur');
      if(KIND[k].redact && !g.over) for(let seat=0;seat<np;seat++){ const r=gRedact(g,seat); if(!validState(Object.assign({seq:1},r))) { res.redactInvalid.push(k+' plats '+seat+' steg '+steps); break; } }
    }
    res.games++;
    if(g.over){ const w=g.winner; if(!(w===-1||w===-2||(Number.isInteger(w)&&w>=0&&w<np))) res.badEnd.push(k+' winner='+w); }
    else if(!res.stuck.length) res.stuck.push(k+' ej klart efter '+steps);
  }
  for(const key of ['throws','invalid','redactInvalid','stuck','badEnd']) res[key]=[...new Set(res[key])].slice(0,6);
  out[k]=res;
}
G=null; return out;
})
