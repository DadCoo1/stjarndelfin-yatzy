import re, sys, collections
# användning: expand.py <index.aff> <index.dic> <alfabet> <hoppa-över-flaggor> <behöver-affix-flagga> <ut.txt>
# t.ex. svenska: expand.py sv.aff sv.dic abcdefghijklmnopqrstuvwxyzåäö '%!Z' '¤' ord-sv.txt
AFF,DIC,ALPHA,SKIP,NEED,OUT=sys.argv[1:7]
rules={}  # flag -> (type, cross, [ (strip, add, addflags, condre) ])
lines=open(AFF,encoding='utf-8').read().split('\n')
i=0
while i<len(lines):
    p=lines[i].split()
    if len(p)>=4 and p[0] in('SFX','PFX') and p[2] in('Y','N') and p[3].isdigit():
        typ,flag,cross,n=p[0],p[1],p[2]=='Y',int(p[3]); lst=[]
        for k in range(n):
            q=lines[i+1+k].split()
            strip='' if q[2]=='0' else q[2]
            add=q[3]; af=''
            if '/' in add: add,af=add.split('/',1)
            if add=='0': add=''
            cond=q[4] if len(q)>4 else '.'
            rx = re.compile(('^'+cond) if typ=='PFX' else (cond+'$')) if cond!='.' else None
            lst.append((strip,add,af,rx))
        rules[flag]=(typ,cross,lst); i+=n+1; continue
    i+=1
def apply(word, flag):
    typ,cross,lst=rules[flag]; out=[]
    for strip,add,af,rx in lst:
        if rx and not rx.search(word): continue
        if typ=='SFX':
            if strip and not word.endswith(strip): continue
            w=(word[:-len(strip)] if strip else word)+add
        else:
            if strip and not word.startswith(strip): continue
            w=add+(word[len(strip):] if strip else word)
        out.append((w,af,cross))
    return out
ok=re.compile('^['+re.escape(ALPHA)+']{2,15}$')
words=set(); stats=collections.Counter()
for ln in open(DIC,encoding='utf-8').read().split('\n')[1:]:
    if not ln.strip(): continue
    if '/' in ln: w,fl=ln.split('/',1)
    else: w,fl=ln,''
    fl=fl.strip()
    if SKIP and set(fl)&set(SKIP): stats['skip-flag']+=1; continue
    if not w or w[0].isupper(): stats['proper']+=1; continue
    forms=set()
    if not NEED or NEED not in fl: forms.add(w)
    sfx=[f for f in fl if f in rules and rules[f][0]=='SFX']; pfx=[f for f in fl if f in rules and rules[f][0]=='PFX']
    for f in sfx:
        for (x,af,cross) in apply(w,f):
            forms.add(x)
            for f2 in af:      # fortsättningssuffix
                if f2 in rules and rules[f2][0]=='SFX':
                    for (y,_,_) in apply(x,f2): forms.add(y)
            if cross:
                for pf in pfx:
                    if rules[pf][1]:
                        for (y,_,_) in apply(x,pf): forms.add(y)
    for pf in pfx:
        for (x,_,_) in apply(w,pf): forms.add(x)
    for x in forms:
        if ok.match(x): words.add(x)
        else: stats['badchars']+=1
print('ord:',len(words), dict(stats), file=sys.stderr)
open(OUT,'w',encoding='utf-8').write('\n'.join(sorted(words))+'\n')
