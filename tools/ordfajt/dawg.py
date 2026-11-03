import re, struct, sys, time
# användning: dawg.py <ord.txt> <alfabet (max 31 tecken)> <vokaler> <ut.bin>
INP,ALPHA,VOW,OUT=sys.argv[1:5]
t=time.time()
words=[w for w in open(INP,encoding='utf-8').read().split('\n') if w and re.search('['+VOW+']',w)]
words.sort()
assert len(ALPHA)<=31; L={c:i+1 for i,c in enumerate(ALPHA)}
class N:
    __slots__=('e','f','id','k')
    def __init__(s): s.e={}; s.f=False; s.id=None; s.k=None
    def key(s):
        if s.k is None: s.k=(s.f,tuple(sorted((c,n.id) for c,n in s.e.items())))
        return s.k
reg={}; root=N(); prev=''; unchecked=[]; nid=[0]
def minimize(down):
    while len(unchecked)>down:
        parent,c,child=unchecked.pop()
        k=child.key()
        if k in reg: parent.e[c]=reg[k]
        else:
            child.id=nid[0]; nid[0]+=1; reg[k]=child
for w in words:
    cp=0
    while cp<min(len(w),len(prev)) and w[cp]==prev[cp]: cp+=1
    minimize(cp)
    node=unchecked[-1][2] if unchecked else root
    for c in w[cp:]:
        n=N(); node.e[c]=n; unchecked.append((node,c,n)); node=n
    node.f=True; prev=w
minimize(0)
print('ord',len(words),'noder',len(reg),'tid',round(time.time()-t,1),file=sys.stderr)
# koda: varje nod = kantlista; kant: bokstav(5) | terminal(1)<<5 | sista(1)<<6 | barn(25)<<7
order=[]; pos={}
def place(n):
    st=[n]
    while st:
        x=st.pop()
        if id(x) in pos or not x.e: continue
        pos[id(x)]=None; order.append(x)
        for c,ch in x.e.items(): st.append(ch)
place(root)
idx=1   # 0 = inga barn
for x in order: pos[id(x)]=idx; idx+=len(x.e)
out=[0]*idx
for x in order:
    base=pos[id(x)]; items=sorted(x.e.items())
    for j,(c,ch) in enumerate(items):
        child=pos.get(id(ch)) or 0 if ch.e else 0
        v=L[c] | (1<<5 if ch.f else 0) | (1<<6 if j==len(items)-1 else 0) | (child<<7)
        out[base+j]=v
assert idx < (1<<25)
open(OUT,'wb').write(struct.pack('<%dI'%len(out),*out))
print('kanter',idx,'byte',idx*4,file=sys.stderr)
