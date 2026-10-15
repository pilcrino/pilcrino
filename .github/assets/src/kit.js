// Shared drawing kit: little agent characters + tools, all plain SVG.
const NS='http://www.w3.org/2000/svg';
let ROOT;
function use(id){ROOT=document.getElementById(id);return ROOT}
function el(n,a,p){const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);(p||ROOT).appendChild(e);return e}
function g(a,p){return el('g',a||{},p)}
function shade(hex,f){const n=parseInt(hex.slice(1),16);let r=n>>16,gg=n>>8&255,b=n&255;
 const m=v=>Math.max(0,Math.min(255,Math.round(v*f)));return '#'+((1<<24)+(m(r)<<16)+(m(gg)<<8)+m(b)).toString(16).slice(1)}
const INK='#2A2826';
const C={peach:'#F2B9A1',mint:'#A8D0C5',butter:'#F3D58A',peri:'#BAC6EA',lilac:'#D8C8EA',coral:'#EFA48A',sage:'#C3D5AA'};
// bot: x=left, gy=ground y, w,h body size at s=1, c colour, look=[-1..1,-1..1], arms={l:[x,y],r:[x,y]} absolute hands
function bot(o){
 const p=o.p||ROOT,s=o.s||1,w=(o.w||100)*s,h=(o.h||130)*s,x=o.x,gy=o.gy;
 const legH=(o.sit?0:20)*s,legW=11*s,top=gy-legH-h,dark=shade(o.c,.84);
 if(o.shadow!==false) el('ellipse',{cx:x+w/2,cy:gy+2*s,rx:w*.62,ry:6*s,fill:'rgba(110,80,50,.13)'},p);
 if(!o.sit){for(const lx of [x+w*.24,x+w*.76-legW]) el('rect',{x:lx,y:gy-legH-6*s,width:legW,height:legH+6*s,rx:legW/2,fill:dark},p)}
 el('rect',{x,y:top,width:w,height:h,rx:Math.min(24*s,w/3.2),fill:o.c},p);
 const ey=top+Math.min(h*.3,46*s),r=Math.min(15*s,w/6.2),[lx,ly]=o.look||[-.5,-.2];
 for(const ex of [x+w*.33,x+w*.67]){
  el('circle',{cx:ex,cy:ey,r,fill:'#fff'},p);
  if(o.closed) el('path',{d:`M${ex-r*.6} ${ey+2*s} q${r*.6} ${5*s} ${r*1.2} 0`,fill:'none',stroke:INK,'stroke-width':3.5*s,'stroke-linecap':'round'},p);
  else el('circle',{cx:ex+lx*r*.42,cy:ey+ly*r*.42,r:r*.52,fill:INK},p);
 }
 const my=ey+r+11*s,mx=x+w/2;
 if(o.mouth==='o') el('ellipse',{cx:mx,cy:my+3*s,rx:4.5*s,ry:5.5*s,fill:INK},p);
 else if(o.mouth==='flat') el('path',{d:`M${mx-8*s} ${my+3*s} h${16*s}`,stroke:INK,'stroke-width':3.5*s,'stroke-linecap':'round'},p);
 else if(o.mouth!=='none') el('path',{d:`M${mx-10*s} ${my} q${10*s} ${9*s} ${20*s} 0`,fill:'none',stroke:INK,'stroke-width':3.5*s,'stroke-linecap':'round'},p);
 const sh=top+h*.6,hands={};
 for(const side of ['l','r']){const t=o.arms&&o.arms[side];if(!t)continue;
  const sx=side==='l'?x+5*s:x+w-5*s,[hx,hy]=t,bend=side==='l'?-16*s:16*s;
  el('path',{d:`M${sx} ${sh} Q${(sx+hx)/2+bend} ${(sh+hy)/2+6*s} ${hx} ${hy}`,fill:'none',stroke:dark,'stroke-width':8.5*s,'stroke-linecap':'round'},p);
  el('circle',{cx:hx,cy:hy,r:6.5*s,fill:dark},p);hands[side]=[hx,hy]}
 if(o.hat==='hard'){const hw=w*.78,hx=x+w*.11,hb=top+5*s;el('path',{d:`M${hx} ${hb} A${hw/2} ${hw*.46} 0 0 1 ${hx+hw} ${hb} Z`,fill:'#F3C766'},p);el('rect',{x:hx+hw*.44,y:hb-hw*.46,width:hw*.12,height:hw*.46,rx:2*s,fill:'#E9B44E'},p);el('rect',{x:x+w*.02,y:hb-2*s,width:w*.96,height:7*s,rx:3.5*s,fill:'#E2AE45'},p)}
 if(o.hat==='paper'){const q=g({transform:`rotate(-7 ${x+w/2} ${top})`},p),bl=x+w*.08,br=x+w*.92,by=top+8*s,px=x+w*.5,py=top-50*s;
  el('path',{d:`M${bl} ${by} L${px} ${py} L${br} ${by}Z`,fill:'#F1ECE2',stroke:'#BDB2A4','stroke-width':2*s,'stroke-linejoin':'round'},q);
  el('rect',{x:px-16*s,y:top-26*s,width:32*s,height:5*s,rx:2*s,fill:'#5E5752'},q);
  for(const [yy,ww] of [[-16,44],[-9,54],[-2,62]])el('rect',{x:px-ww/2*s,y:top+yy*s,width:ww*s,height:2.6*s,rx:1.3*s,fill:'#C9BFB2'},q);
  el('rect',{x:x+w*.04,y:top+2*s,width:w*.92,height:12*s,rx:3*s,fill:'#E4DCCD',stroke:'#BDB2A4','stroke-width':2*s},q)}
 if(o.hat==='beret'){const q=g({transform:`rotate(-10 ${x+w/2} ${top})`},p),bx=x+w*.46;
  el('rect',{x:bx-2.5*s,y:top-22*s,width:5*s,height:10*s,rx:2.5*s,fill:'#A8402F'},q);
  el('ellipse',{cx:bx,cy:top-2*s,rx:w*.52,ry:17*s,fill:'#C4523A'},q);
  el('path',{d:`M${bx-w*.4} ${top+2*s} Q${bx} ${top+12*s} ${bx+w*.4} ${top+2*s}`,fill:'none',stroke:'#A8402F','stroke-width':6*s,'stroke-linecap':'round'},q)}
 const cx=x+w/2;
 if(o.hat==='deer'){const bb=top+8*s,D='#8E7149';
  el('path',{d:`M${x+w*.14} ${bb-2*s} Q${x-8*s} ${bb+2*s} ${x-2*s} ${bb+11*s} Q${x+w*.16} ${bb+9*s} ${x+w*.3} ${bb}Z`,fill:D},p);
  el('path',{d:`M${x+w*.86} ${bb-2*s} Q${x+w+8*s} ${bb+2*s} ${x+w+2*s} ${bb+11*s} Q${x+w*.84} ${bb+9*s} ${x+w*.7} ${bb}Z`,fill:D},p);
  el('path',{d:`M${x+w*.12} ${bb} A${w*.38} ${36*s} 0 0 1 ${x+w*.88} ${bb}Z`,fill:'#A98B5F'},p);
  for(const dx of[-12,12])el('line',{x1:cx+dx*s,y1:bb,x2:cx+dx*s,y2:bb-33*s,stroke:D,'stroke-width':2*s},p);
  el('line',{x1:cx-35*s,y1:bb-14*s,x2:cx+35*s,y2:bb-14*s,stroke:D,'stroke-width':2*s},p);
  for(const dx of[-6,6])el('ellipse',{cx:cx+dx*s,cy:bb-37*s,rx:6*s,ry:4*s,fill:D},p)}
 if(o.hat==='cap'){el('ellipse',{cx:x+w*.86,cy:top+8*s,rx:28*s,ry:6.5*s,fill:'#2F2B29'},p);
  el('path',{d:`M${x+w*.1} ${top+10*s} A${w*.4} ${28*s} 0 0 1 ${x+w*.9} ${top+10*s}Z`,fill:'#4A4440'},p);
  el('circle',{cx,cy:top-17*s,r:4*s,fill:'#2F2B29'},p)}
 return {top,x,w,h,ey,hands,cx:x+w/2};
}
function T(x,y,ang,s,p){return g({transform:`translate(${x} ${y}) rotate(${ang||0}) scale(${s||1})`},p||ROOT)}
function hammer(x,y,a,s,p){const q=T(x,y,a,s,p);el('rect',{x:-3.5,y:-44,width:7,height:54,rx:3,fill:'#B88E6F'},q);el('rect',{x:-17,y:-54,width:34,height:14,rx:3,fill:'#5E5752'},q)}
function pencil(x,y,a,s,p){const q=T(x,y,a,s,p);el('rect',{x:-5.5,y:-44,width:11,height:40,rx:2,fill:'#F3C567'},q);el('path',{d:'M-5.5 -4 L0 12 L5.5 -4Z',fill:'#EBCDA8'},q);el('path',{d:'M-2 6 L0 12 L2 6Z',fill:INK},q);el('rect',{x:-5.5,y:-50,width:11,height:7,rx:2,fill:'#EFA48A'},q)}
function magnifier(x,y,a,s,p){const q=T(x,y,a,s,p);el('rect',{x:-3.5,y:-6,width:7,height:30,rx:3,fill:'#5E5752'},q);el('circle',{cx:0,cy:-22,r:17,fill:'rgba(205,226,236,.7)',stroke:INK,'stroke-width':5},q)}
function wrench(x,y,a,s,p){const q=T(x,y,a,s,p);el('rect',{x:-4.5,y:-30,width:9,height:44,rx:4,fill:'#8D8781'},q);el('path',{d:'M-13 -32 a13 13 0 1 1 26 0 l-6 0 l0 -9 l-14 0 l0 9 Z',fill:'#8D8781'},q)}
function clipboard(x,y,s,p,a){const q=T(x,y,a||0,s,p);el('rect',{x:-19,y:-26,width:38,height:50,rx:4,fill:'#C9A386'},q);el('rect',{x:-14,y:-19,width:28,height:38,rx:2,fill:'#FFF8EE'},q);el('rect',{x:-8,y:-30,width:16,height:8,rx:2,fill:'#8D8781'},q);for(const yy of [-11,-3,5])el('rect',{x:-9,y:yy,width:18,height:3,rx:1.5,fill:'#D9CBB8'},q);el('path',{d:'M-9 12 l4 4 l8 -9',fill:'none',stroke:'#7DAE8F','stroke-width':3,'stroke-linecap':'round'},q)}
function block(x,y,sz,c,p,label){el('rect',{x,y,width:sz,height:sz,rx:sz*.12,fill:c},p);el('rect',{x:x+sz*.12,y:y+sz*.1,width:sz*.76,height:sz*.12,rx:sz*.06,fill:'#fff',opacity:.35},p)}
function note(x,y,sz,c,a,p){const q=T(x,y,a,1,p);el('path',{d:`M0 0 H${sz} V${sz*.78} L${sz*.78} ${sz} H0Z`,fill:c},q);el('path',{d:`M${sz} ${sz*.78} L${sz*.78} ${sz*.78} L${sz*.78} ${sz}Z`,fill:shade(c,.88)},q);for(const yy of [.28,.46,.64])el('rect',{x:sz*.16,y:sz*yy,width:sz*(yy>.6?.4:.62),height:sz*.06,rx:sz*.03,fill:shade(c,.8),opacity:.7},q);return q}
function roller(x,y,a,s,p,c){const q=T(x,y,a,s,p);el('rect',{x:-3,y:-10,width:6,height:30,rx:3,fill:'#5E5752'},q);el('path',{d:'M0 -10 V-20 H20 V-28',fill:'none',stroke:'#5E5752','stroke-width':4},q);el('rect',{x:4,y:-44,width:34,height:17,rx:7,fill:c||'#EFA48A'},q)}
function plane(x,y,s,a,p){const q=T(x,y,a||0,s,p);el('path',{d:'M0 0 L60 -22 L22 10Z',fill:'#FFFDF8',stroke:INK,'stroke-width':3,'stroke-linejoin':'round'},q);el('path',{d:'M60 -22 L22 10 L18 22Z',fill:'#EDE6DA',stroke:INK,'stroke-width':3,'stroke-linejoin':'round'},q)}
function mug(x,y,s,p){const q=T(x,y,0,s,p);el('path',{d:'M26 6 q14 0 14 12 t-14 12',fill:'none',stroke:'#F3EEE6','stroke-width':6},q);el('rect',{x:0,y:0,width:30,height:36,rx:5,fill:'#F3EEE6'},q);el('path',{d:'M8 -6 q-5 -8 0 -15 t0 -15 M20 -6 q-5 -8 0 -15 t0 -15',fill:'none',stroke:'#E3D5C5','stroke-width':3.5,'stroke-linecap':'round'},q)}
function laptop(x,y,w,p,screenFn){const h=w*.62,q=g({},p);el('rect',{x,y:y-h,width:w,height:h,rx:w*.035,fill:'#4A403B'},q);el('rect',{x:x+w*.04,y:y-h+w*.04,width:w*.92,height:h-w*.08,rx:w*.015,fill:'#FFF7EC'},q);el('path',{d:`M${x-w*.1} ${y} H${x+w*1.1} L${x+w*1.04} ${y+w*.05} H${x-w*.04}Z`,fill:'#7C716B'},q);if(screenFn)screenFn(x+w*.04,y-h+w*.04,w*.92,h-w*.08,q);return q}
function chartIn(x,y,w,h,q){el('path',{d:`M${x+w*.08} ${y+h*.8} L${x+w*.3} ${y+h*.68} L${x+w*.46} ${y+h*.76} L${x+w*.66} ${y+h*.42} L${x+w*.9} ${y+h*.2}`,fill:'none',stroke:'#E2683F','stroke-width':Math.max(3,w*.03),'stroke-linecap':'round','stroke-linejoin':'round'},q)}
function appIn(x,y,w,h,q){el('rect',{x,y,width:w,height:h*.16,fill:'#F2E4D3'},q);for(const [i,c] of [['0','#EFA48A'],['1','#F3D58A'],['2','#A8D0C5']])el('circle',{cx:x+w*.06+i*w*.06,cy:y+h*.08,r:h*.035,fill:c},q);el('rect',{x:x+w*.08,y:y+h*.28,width:w*.5,height:h*.08,rx:h*.04,fill:'#2A2826',opacity:.75},q);el('rect',{x:x+w*.08,y:y+h*.44,width:w*.36,height:h*.06,rx:h*.03,fill:'#CBBBA8'},q);el('rect',{x:x+w*.08,y:y+h*.62,width:w*.24,height:h*.16,rx:h*.06,fill:'#E2683F'},q);el('rect',{x:x+w*.62,y:y+h*.28,width:w*.3,height:h*.5,rx:h*.04,fill:'#D7E6DA'},q)}
function can(x,y,s,a,p){const q=T(x,y,a||0,s,p);el('path',{d:'M-4 -8 L-40 -30',stroke:'#7FA3B8','stroke-width':7,'stroke-linecap':'round'},q);el('rect',{x:-6,y:-26,width:42,height:34,rx:6,fill:'#9FC0D2'},q);el('path',{d:'M6 -26 q12 -18 24 0',fill:'none',stroke:'#7FA3B8','stroke-width':5},q);for(const [dx,dy] of [[-46,-22],[-50,-12],[-44,-4]])el('circle',{cx:dx,cy:dy,r:2.6,fill:'#9FC0D2'},q)}
function lantern(x,y,s,p){const q=T(x,y,0,s,p);el('circle',{cx:0,cy:8,r:46,fill:'#FBE7B0',opacity:.35},q);el('path',{d:'M-8 -10 q8 -12 16 0',fill:'none',stroke:'#5E5752','stroke-width':3},q);el('rect',{x:-11,y:-8,width:22,height:30,rx:5,fill:'#F7C96A',stroke:'#5E5752','stroke-width':3},q)}
async function fontsReady(){if(document.fonts)await document.fonts.ready}
// more tools
function walkie(x,y,a,s,p){const q=T(x,y,a,s,p);el('line',{x1:5,y1:-30,x2:5,y2:-48,stroke:'#4A4440','stroke-width':4,'stroke-linecap':'round'},q);el('rect',{x:-9,y:-34,width:22,height:38,rx:5,fill:'#4A4440'},q);for(const yy of [-26,-20,-14])el('rect',{x:-4,y:yy,width:12,height:2.6,rx:1,fill:'#9A938C'},q);el('circle',{cx:2,cy:-4,r:3,fill:'#CC785C'},q)}
function paddle(x,y,a,s,c,p){const q=T(x,y,a,s,p);el('rect',{x:-3,y:-30,width:6,height:34,rx:3,fill:'#8D8781'},q);el('circle',{cx:0,cy:-42,r:15,fill:c||'#CC785C'},q);el('circle',{cx:0,cy:-42,r:6,fill:'#fff',opacity:.55},q)}
let NETN=0;function bugnet(x,y,a,s,p){const q=T(x,y,a,s,p),id='net'+(NETN++),M='#B5AB9D';
 el('rect',{x:-3.5,y:-62,width:7,height:72,rx:3.5,fill:'#B88E6F'},q);
 const bag='M0 -113 C34 -114 56 -78 46 -40 C42 -26 28 -24 22 -36 C16 -48 10 -60 0 -63 Z';
 el('path',{d:bag,fill:'rgba(255,255,255,.8)'},q);
 const c=el('clipPath',{id},q);el('path',{d:bag},c);const m=g({'clip-path':`url(#${id})`},q);
 for(let k=-140;k<=80;k+=10){el('line',{x1:k,y1:-120,x2:k+90,y2:-20,stroke:M,'stroke-width':1.3},m);el('line',{x1:k+90,y1:-120,x2:k,y2:-20,stroke:M,'stroke-width':1.3},m)}
 el('path',{d:bag.replace(/ Z$/,''),fill:'none',stroke:'#8D8781','stroke-width':2.2,'stroke-linejoin':'round'},q);
 const c2=el('clipPath',{id:id+'h'},q);el('circle',{cx:0,cy:-88,r:25},c2);const h=g({'clip-path':`url(#${id}h)`},q);
 el('circle',{cx:0,cy:-88,r:25,fill:'#FEFCF8'},h);
 for(let k=-30;k<=30;k+=10){el('line',{x1:k-30,y1:-118,x2:k+30,y2:-58,stroke:M,'stroke-width':1.3},h);el('line',{x1:k+30,y1:-118,x2:k-30,y2:-58,stroke:M,'stroke-width':1.3},h)}
 el('circle',{cx:0,cy:-88,r:25,fill:'none',stroke:'#6F6862','stroke-width':5},q)}
function brush(x,y,a,s,p,c){const q=T(x,y,a,s,p);el('rect',{x:-4,y:-14,width:8,height:46,rx:4,fill:'#B88E6F'},q);el('rect',{x:-5.5,y:-28,width:11,height:16,rx:2,fill:'#BDB2A4'},q);el('path',{d:'M-6 -28 Q-7 -44 0 -58 Q7 -44 6 -28Z',fill:'#6F5A4A'},q);el('path',{d:'M-4.6 -44 Q-3 -52 0 -58 Q3 -52 4.6 -44Z',fill:c||'#9db8e6'},q)}
function bug(x,y,s,a,p){const q=T(x,y,a||0,s,p);el('path',{d:'M-6 -5 l-5 -7 M0 -6 l0 -8 M6 -5 l5 -7 M-6 5 l-5 7 M0 6 l0 8 M6 5 l5 7',stroke:'#2A2826','stroke-width':2.2,'stroke-linecap':'round'},q);el('ellipse',{cx:0,cy:0,rx:12,ry:8,fill:'#C4523A'},q);el('line',{x1:-12,y1:0,x2:10,y2:0,stroke:'#2A2826','stroke-width':1.8},q);el('circle',{cx:-5,cy:-3.5,r:1.8,fill:'#2A2826'},q);el('circle',{cx:4,cy:3.5,r:1.8,fill:'#2A2826'},q);el('circle',{cx:13,cy:0,r:5,fill:'#2A2826'},q);el('path',{d:'M16 -3 l6 -6 M16 3 l6 6',stroke:'#2A2826','stroke-width':1.8,'stroke-linecap':'round'},q)}
function chartBoard(x,y,s,p,a){const q=T(x,y,a||0,s,p);el('rect',{x:-28,y:-24,width:56,height:44,rx:5,fill:'#FFFDF8',stroke:'#C9BFB2','stroke-width':2.5},q);el('path',{d:'M-19 11 L-7 2 L2 7 L19 -13',fill:'none',stroke:'#CC785C','stroke-width':4,'stroke-linecap':'round','stroke-linejoin':'round'},q);el('path',{d:'M11 -14 h8 v8',fill:'none',stroke:'#CC785C','stroke-width':3.5,'stroke-linecap':'round','stroke-linejoin':'round'},q)}
function miniLaptop(x,y,s,p){const q=T(x,y,0,s,p);el('rect',{x:-26,y:-36,width:52,height:34,rx:4,fill:'#4A4440'},q);el('rect',{x:-22,y:-32,width:44,height:26,rx:2,fill:'#FFF7EC'},q);for(const [yy,ww] of [[-26,26],[-20,18],[-14,22]])el('rect',{x:-17,y:yy,width:ww,height:3,rx:1.5,fill:'#C9BFB2'},q);el('path',{d:'M-32 -2 H32 L27 5 H-27Z',fill:'#7C716B'},q)}
function glasses(b,s,p){for(const f of[.33,.67])el('circle',{cx:b.x+b.w*f,cy:b.ey,r:18*s,fill:'none',stroke:'#3F3A36','stroke-width':3.4*s},p);
 el('path',{d:`M${b.x+2*s} ${b.ey-4*s} L${b.x+b.w*.33-18*s} ${b.ey-2*s} M${b.x+b.w-2*s} ${b.ey-4*s} L${b.x+b.w*.67+18*s} ${b.ey-2*s}`,stroke:'#3F3A36','stroke-width':3*s},p)}
function scarf(b,s,p){const{x,w,top}=b,y=top+80*s,C='#D96B5A';
 el('rect',{x:x+w*.18,y:y+8*s,width:15*s,height:36*s,rx:3*s,fill:C,transform:`rotate(6 ${x+w*.18} ${y})`},p);
 el('rect',{x:x-3*s,y,width:w+6*s,height:15*s,rx:6*s,fill:C},p);
 for(let k=1;k<6;k++)el('rect',{x:x+k*w/6-2*s,y,width:4*s,height:15*s,fill:shade(C,.82)},p)}
function stamp(x,y,a,s,p){const q=T(x,y,a,s,p);el('circle',{cx:0,cy:-42,r:10,fill:'#C4523A'},q);el('rect',{x:-4,y:-34,width:8,height:18,fill:'#B88E6F'},q);
 el('rect',{x:-18,y:-18,width:36,height:14,rx:3,fill:'#8D6E57'},q);el('rect',{x:-16,y:-4,width:32,height:5,rx:1.5,fill:'#C4523A'},q)}
function cup(x,y,s,p){const q=T(x,y,0,s,p);el('path',{d:'M-2 8 q-12 0 -12 10 t12 10',fill:'none',stroke:'#C4523A','stroke-width':5},q);el('rect',{x:0,y:0,width:30,height:34,rx:5,fill:'#E07A5F'},q);el('rect',{x:6,y:12,width:18,height:8,rx:3,fill:'#fff',opacity:.6},q);el('path',{d:'M9 -5 q-5 -8 0 -15 t0 -15 M21 -5 q-5 -8 0 -15 t0 -15',fill:'none',stroke:'#C9BFB2','stroke-width':3.5,'stroke-linecap':'round'},q)}
function clapper(x,y,a,s,p){const q=T(x,y,a,s,p);el('rect',{x:-28,y:-30,width:56,height:38,rx:3,fill:'#3B3735'},q);
 for(const yy of[-14,-4])el('rect',{x:-20,y:yy,width:yy<-10?34:24,height:3.5,rx:1.5,fill:'#CFC6B9'},q);
 const arm=g({transform:'rotate(-16 -28 -30)'},q);el('rect',{x:-28,y:-41,width:56,height:11,fill:'#F5F0E8'},arm);
 for(const k of[-24,-10,4,18])el('path',{d:`M${k} -41 h7 l-6 11 h-7Z`,fill:'#3B3735'},arm)}
function palette(x,y,a,s,p){const q=T(x,y,a,s,p);el('path',{d:'M-30 0 C-30 -24 0 -30 22 -22 C36 -16 34 0 22 4 C14 6 18 16 6 18 C-16 22 -30 14 -30 0Z',fill:'#D9B98E'},q);
 el('circle',{cx:14,cy:8,r:5,fill:'#f8f0dc'},q);for(const[cx,cy,c]of[[-18,-4,'#ec8a7a'],[-8,-16,'#efc85f'],[6,-19,'#9db8e6'],[19,-12,'#a9cf9a']])el('circle',{cx,cy,r:5.5,fill:c},q)}
