// shared look: site paper + site character tints, channel type
const S={bg:'#f8f0dc',ink:'#0d0d0d',muted:'#6b6257',acc:'#de4235',ok:'#4a8c3a',rule:'#d6c4a2',card:'#fffaf0',
 tf:'Newsreader',bf:'"Hanken Grotesk"',
 c:{peri:'#9db8e6',peach:'#f0b89a',mint:'#a9cf9a',coral:'#ec8a7a',lilac:'#cdb8df',butter:'#efc85f',sage:'#bfcf8c'}};
const QS=new URLSearchParams(location.search),TIME=parseFloat(QS.get("t")||"0");
async function ready(w,h){
 document.body.style.background=S.bg;document.body.style.width=w+'px';document.body.style.height=h+'px';
 const fl=[document.fonts.load('400 40px Newsreader'),document.fonts.load('italic 400 40px Newsreader'),document.fonts.load('500 20px "Hanken Grotesk"'),document.fonts.load('600 20px "Hanken Grotesk"')];
 await Promise.race([Promise.all(fl),new Promise(r=>setTimeout(r,3000))]);
 const svg=document.getElementById('s');svg.setAttribute('width',w);svg.setAttribute('height',h);svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 use('s');el('rect',{x:0,y:0,width:w,height:h,fill:S.bg});
}
function txt(x,y,str,o={}){const e=el('text',{x,y,'font-family':o.f||S.bf,'font-size':o.fs||22,fill:o.fill||S.ink,'text-anchor':o.a||'middle','font-weight':o.w||500,'font-style':o.i?'italic':'normal','letter-spacing':o.ls||0,opacity:o.op==null?1:o.op},o.p);e.textContent=str;return e}
function title(x,y,main,sub){txt(x,y,main,{f:S.tf,fs:64,a:'start',ls:-1.5,w:400});if(sub)txt(x+3,y+44,sub,{f:S.tf,fs:28,a:'start',i:true,fill:S.muted,w:400})}
function sheet(x,y,o={}){const q=g({transform:`translate(${x} ${y}) rotate(${o.rot||0})`,opacity:o.op==null?1:o.op},o.p);
 el('rect',{x:-26,y:-34,width:52,height:68,rx:4,fill:'#fff',stroke:S.rule,'stroke-width':2},q);
 for(const yy of[-20,-10,0,10,20])el('rect',{x:-17,y:yy-2,width:yy===20?18:34,height:4,rx:2,fill:'#D9CFBF'},q);
 if(o.ticks)for(const yy of[-20,-10])el('path',{d:`M20 ${yy-3} l3 3 l6 -7`,fill:'none',stroke:S.ok,'stroke-width':2.4,'stroke-linecap':'round'},q);
 if(o.bug)bug(14,10,1,-20,q);
 if(o.fixed)el('path',{d:`M10 6 l4 4 l8 -9`,fill:'none',stroke:S.ok,'stroke-width':3,'stroke-linecap':'round'},q);
 return q}
// one helper with its tools. k: research|plan|draft|review|human|imgplan|imgbuild. o.noleft drops the left-hand prop where space is tight
function helper(k,cx,gy,s,o={}){const p=o.p||ROOT,w=100*s,x=cx-w/2;
 const col={research:S.c.peri,plan:S.c.peach,draft:S.c.mint,review:S.c.coral,human:S.c.lilac,imgplan:S.c.sage,imgbuild:S.c.butter}[k];
 const arms={l:[x-18*s,gy-70*s],r:[x+118*s,gy-74*s]};
 if(k==='research')arms.r=[x+120*s,gy-110*s];if(k==='plan'){arms.l=[x-22*s,gy-78*s];arms.r=[x+112*s,gy-128*s]}if(k==='draft')arms.r=[x+118*s,gy-60*s];
 if(k==='review')arms.r=[x+112*s,gy-128*s];if(k==='human')arms.r=[x+110*s,gy-112*s];if(k==='imgbuild')arms.r=[x+116*s,gy-90*s];
 const b=bot({p,x,gy,s:s*.9/.9*1,w:100,h:118,c:col,look:o.look||[-.3,-.1],mouth:o.mouth,hat:{imgbuild:'beret',review:'paper',research:'deer',imgplan:'cap'}[k],arms,shadow:o.shadow});
 const H=b.hands;
 if(k==='plan')glasses(b,s,p);
 if(k==='draft')scarf(b,s,p);
 if(k==='research')magnifier(H.r[0]+6*s,H.r[1]-6*s,28,1.15*s,p);
 if(k==='plan'){clipboard(H.l[0]-6*s,H.l[1]-10*s,1.05*s,p,-8);stamp(H.r[0]+4*s,H.r[1]+4*s,14,s,p)}
 if(k==='draft')cup(H.l[0]-16*s,H.l[1]-22*s,.85*s,p);
 if(k==='draft'&&!o.nopencil)pencil(H.r[0]+4*s,H.r[1]+2*s,35,1.15*s,p);
 if(k==='review')bugnet(H.r[0]+6*s,H.r[1]+8*s,18,.8*s,p);
 if(k==='human')roller(H.r[0]+2*s,H.r[1]+6*s,-28,1.1*s,p,S.c.lilac);
 if(k==='imgplan'&&!o.noleft)clapper(H.l[0]-22*s,H.l[1]-4*s,-8,.95*s,p);
 if(k==='imgbuild'&&!o.noleft)palette(H.l[0]-18*s,H.l[1]-2*s,-12,s,p);
 if(k==='imgbuild')brush(H.r[0]+4*s,H.r[1]+2*s,22,1.2*s,p,S.c.peri);
 return Object.assign(b,{hands:H});
}
