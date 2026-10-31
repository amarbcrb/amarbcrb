/* Barre d'onglets du site : construction des boutons et bouton Recherche, puis moteur « jelly » WebGL (jellyNav). */

import { RM } from './mouvement.js';
function buzz(p = 10) { try { navigator.vibrate && navigator.vibrate(p); } catch (_) { /* pas de vibreur */ } }

const ICONES = {
  accueil: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  parcours: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  portfolio: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  liens: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
};
/* icônes au choix des onglets créés dans l'admin (noms : ICONES_ONGLET dans model.js) */
export const ICONES_PERSO = {
  etoile: '<path d="M11.5 2.6a.6.6 0 0 1 1 0l2.6 5.3 5.9.9a.6.6 0 0 1 .3 1l-4.3 4.2 1 5.8a.6.6 0 0 1-.8.6L12 17.6l-5.3 2.8a.6.6 0 0 1-.8-.6l1-5.8L2.6 9.8a.6.6 0 0 1 .3-1l5.9-.9z"/>',
  appareil: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  carte: '<rect x="4" y="3" width="13" height="18" rx="2"/><path d="M20 6.5 17 5.7M20 6.5l-2.3 13"/><path d="m10.5 9.5 1.5 2.5-1.5 2.5L9 12z"/>',
  livre: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  musique: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  pinceau: '<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
  flacon: '<path d="M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9.5V3"/><path d="M7.5 15h9"/>',
};
const LIBELLES = { accueil: 'Accueil', parcours: 'Parcours', portfolio: 'Portfolio', liens: 'Liens' };
export const COULEURS = { accueil: '--c-blue', parcours: '--c-teal', portfolio: '--c-orange', liens: '--c-pink' };
const LOUPE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

/* construit la barre (un bouton par onglet visible) et le bouton Recherche dans conteneur */
export function monterBarre({ conteneur, onglets, infos = {}, onSelect, onRecherche }) {
  const barre = document.createElement('div');
  barre.className = 'barre';
  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.setAttribute('aria-label', 'Navigation principale');
  const piste = document.createElement('div');
  piste.className = 'nav-in glass';
  const canvas = document.createElement('canvas');
  canvas.className = 'nav-cv';
  canvas.setAttribute('aria-hidden', 'true');
  piste.append(canvas);
  const boutons = onglets.map((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nb';
    b.dataset.v = id;
    const perso = infos[id];
    b.style.setProperty('--nc', `var(${COULEURS[id] || (perso && /^--c-[a-z]+$/.test(perso.couleur) ? perso.couleur : '--c-purple')})`);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[id] || ICONES_PERSO[perso && perso.icone] || ICONES_PERSO.etoile}</svg>`;
    const libelle = document.createElement('span');
    libelle.textContent = LIBELLES[id] || (perso && perso.nom) || (perso && perso.libelle) || id;
    b.append(libelle);
    piste.append(b);
    return b;
  });
  nav.append(piste);
  const recherche = document.createElement('button');
  recherche.type = 'button';
  recherche.className = 'nav-search glass';
  recherche.setAttribute('aria-label', 'Rechercher');
  recherche.innerHTML = LOUPE;
  recherche.addEventListener('click', () => { buzz(); onRecherche(); });
  barre.append(nav, recherche);
  conteneur.replaceChildren(barre);
  let courant = 0;
  const marquer = (i) => {
    courant = i;
    boutons.forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  };
  const jelly = jellyNav({ wrap: nav, track: piste, canvas, items: boutons, active: () => courant,
    onSelect: (i) => { buzz(); marquer(i); onSelect(onglets[i]); } });
  marquer(0);
  /* une fois par visite, après un court repos */
  let vu = true;
  try { vu = sessionStorage.getItem('ab-demo-barre') === '1'; sessionStorage.setItem('ab-demo-barre', '1'); } catch { vu = false; }
  const demoTm = vu || RM ? 0 : setTimeout(() => jelly.demo(), 1500);
  return {
    select(id, anim = true) { const i = onglets.indexOf(id); if (i < 0) return; marquer(i); jelly.select(i, anim); },
    detruire() { clearTimeout(demoTm); jelly.detruire(); barre.remove(); },
    recherche,
  };
}

/* ---------- Barre d'onglets façon Nuvio : ressorts « jelly » (JellyMotion de Nuvio Enhanced) ----------
   appui → la pastille gonfle en lentille, glisser → elle suit le doigt, s'étire avec la vitesse et déforme
   les icônes comme une goutte d'eau ; relâcher → elle se cale sur l'onglet le plus proche.
   La teinte de la pastille passe d'une couleur d'onglet à l'autre. */
export function jellyNav({wrap,track,canvas,items,onSelect,active}){
  const N=items.length,cl=(n,a,b)=>Math.min(b,Math.max(a,n));
  const MX=40,MY=30,LENS=[12,20],DEPTH=1,BAR={refraction:20,amount:20};
  /* ressort amorti (solution exacte, comme JellySpring) */
  const spring=(v,k,z)=>({v,k,z,vel:0,
    rest(t){return Math.abs(this.v-t)<1e-4&&Math.abs(this.vel)<1e-4},
    snap(t){this.v=t;this.vel=0},
    step(t,s){if(this.rest(t))return this.snap(t);const d=this.v-t,f=Math.sqrt(this.k);
      if(this.z===1){const e=Math.exp(-f*s),c=this.vel+f*d;this.v=t+(d+c*s)*e;this.vel=(this.vel-f*c*s)*e;return}
      const dm=this.z*f,w=f*Math.sqrt(1-this.z*this.z),e=Math.exp(-dm*s),co=Math.cos(w*s),si=Math.sin(w*s),pc=(this.vel+dm*d)/w,vc=(dm*this.vel+this.k*d)/w;
      this.v=t+e*(d*co+pc*si);this.vel=e*(this.vel*co-vc*si)}});
  const dz=18/(2*Math.sqrt(216)),
    pos=spring(0,1000,1),vel=spring(0,300,.5),press=spring(0,1000,1),sx=spring(1,250,.6),sy=spring(1,250,.7),
    panel=spring(0,300,1),ty=spring(0,240/.9,dz),tx=spring(1,240/.9,dz),tp=spring(1,240/.9,dz);
  let glide=null,W=0,H=0,dpr=1,target=0,pressT=0,shapeT=1,release=false,dragging=false,refract=false,downX=0,downY=0,startT=0,startP=0,startY=0,moved=0,originX=0,pid=null,cx0=0,cy0=0,near=0,raf=0,last=0;
  const tabW=()=>Math.max(0,(W-8)/N),maxI=N-1,at=x=>cl(Math.floor((x-4)/tabW()),0,maxI);
  const rubber=(d,dim)=>{if(!d||dim<=0)return 0;const r=(1-1/(Math.abs(d)*.14/dim+1))*dim;return d<0?-r:r};
  function panelOff(raw){if(W<=0||!raw)return 0;const fr=cl(raw/W,-1,1),x=Math.abs(fr);let lo=0,hi=1,p=x;
    for(let i=0;i<10;i++){const bx=p*p*(3*(1-p)*.58+p);bx<x?lo=p:hi=p;p=(lo+hi)/2}
    return(fr<0?-4:4)*p*p*(3*(1-p)+p)}

  /* ---- icônes : tracés repris des SVG des boutons ---- */
  const icons=items.map(b=>{const p=new Path2D(),n=+(b.querySelector('svg').getAttribute('viewBox')||'0 0 24 24').split(' ')[3]||24;
    b.querySelectorAll('svg>*').forEach(e=>{const a=k=>+e.getAttribute(k)||0;
      if(e.tagName==='path')p.addPath(new Path2D(e.getAttribute('d')));
      else if(e.tagName==='circle'){p.moveTo(a('cx')+a('r'),a('cy'));p.arc(a('cx'),a('cy'),a('r'),0,Math.PI*2)}
      else if(e.tagName==='rect'){const q=new Path2D();q.roundRect?q.roundRect(a('x'),a('y'),a('width'),a('height'),a('rx')):q.rect(a('x'),a('y'),a('width'),a('height'));p.addPath(q)}});
    return{p,n}});
  /* ---- couleurs lues dans le CSS (thème clair ou sombre) ---- */
  const probe=document.createElement('canvas').getContext('2d');
  const rgb=c=>{probe.fillStyle='#000';probe.fillStyle=c.trim()||'#000';const v=probe.fillStyle;
    if(v[0]==='#')return[1,3,5].map(i=>parseInt(v.slice(i,i+2),16));return(v.match(/[\d.]+/g)||[0,0,0]).slice(0,3).map(Number)};
  let C={};
  function colors(){const cs=getComputedStyle(document.documentElement);
    C={tabs:items.map(b=>rgb(getComputedStyle(b).getPropertyValue('--nc'))),mut:cs.getPropertyValue('--mut').trim(),
      sf:rgb(cs.getPropertyValue('--pill-sf')),bg:rgb(cs.getPropertyValue('--bg')),font:cs.getPropertyValue('--font')}}
  const css=(c,a)=>`rgba(${c.join(',')},${a})`;
  function accentAt(p){const i=cl(Math.floor(p),0,maxI),j=Math.min(i+1,maxI),t=cl(p-i,0,1);return C.tabs[i].map((v,k)=>v+(C.tabs[j][k]-v)*t)}

  /* ---- géométrie de la pastille ---- */
  function frame(){const sp=vel.v/10;return{pos:pos.v,sx:sx.v/(1-cl(sp*.75,-.2,.2)),sy:sy.v*(1-cl(sp*.25,-.2,.2)),scale:1+.2*press.v,press:press.v}}
  function pillGeo(f){const tw=tabW(),ih=H-8;return{cx:4+(f.pos+.5)*tw,cy:H/2,hw:tw/2,hh:ih/2,r:Math.min(tw,ih)/2,sx:f.sx,sy:f.sy}}
  function pillPath(g){const hw=g.hw*g.sx,hh=g.hh*g.sy,rx=Math.min(g.r*g.sx,hw),ry=Math.min(g.r*g.sy,hh),l=g.cx-hw,r=g.cx+hw,t=g.cy-hh,b=g.cy+hh,p=new Path2D();
    p.moveTo(l+rx,t);p.lineTo(r-rx,t);p.ellipse(r-rx,t+ry,rx,ry,0,-Math.PI/2,0);p.lineTo(r,b-ry);p.ellipse(r-rx,b-ry,rx,ry,0,0,Math.PI/2);
    p.lineTo(l+rx,b);p.ellipse(l+rx,b-ry,rx,ry,0,Math.PI/2,Math.PI);p.lineTo(l,t+ry);p.ellipse(l+rx,t+ry,rx,ry,0,Math.PI,Math.PI*1.5);p.closePath();return p}
  /* ---- rangée d'onglets : icône colorée + libellé ; version active agrandie pendant l'appui ---- */
  function drawRow(ctx,f,on){const tw=tabW(),is=24,colH=is+4+14,top=H/2-colH/2;
    items.forEach((b,i)=>{const cx=4+(i+.5)*tw,col=C.tabs[i];ctx.save();
      if(on){ctx.translate(cx,H/2);ctx.scale(f.scale,f.scale);ctx.translate(-cx,-H/2)}
      ctx.save();ctx.translate(cx-is/2,top);ctx.scale(is/icons[i].n,is/icons[i].n);
      ctx.lineWidth=2;ctx.lineCap=ctx.lineJoin='round';ctx.strokeStyle=css(col,on?1:.8);ctx.stroke(icons[i].p);ctx.restore();
      ctx.fillStyle=on?css(col,1):C.mut;ctx.font=`${on?700:500} ${W/N<70?11:12}px ${C.font}`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(b.querySelector('span').textContent,cx,top+is+4+7,tw-6);ctx.restore()})}
  const iconCv=document.createElement('canvas'),ictx=iconCv.getContext('2d');
  function drawIcons(ctx,f,g){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,iconCv.width,iconCv.height);
    ctx.setTransform(dpr,0,0,dpr,MX*dpr,MY*dpr);const pill=pillPath(g),out=new Path2D();out.rect(-MX,-MY,W+MX*2,H+MY*2);out.addPath(pill);
    ctx.save();ctx.clip(out,'evenodd');drawRow(ctx,f,false);ctx.restore();ctx.save();ctx.clip(pill);drawRow(ctx,f,true);ctx.restore()}

  /* ---- WebGL : lentille de Kyant + surlignage de sélection de Nuvio ---- */
  const FRAG=`precision highp float;
uniform vec2 uRes;uniform float uDpr;uniform vec2 uMargin;uniform vec2 uTrack;uniform vec2 uPillC;uniform vec2 uPillHalf;uniform vec2 uPillScale;uniform float uPillR;
uniform float uPress;uniform float uRefract;uniform vec3 uAccent;uniform vec3 uSurface;uniform vec3 uBarFill;uniform vec2 uLens;uniform float uDepth;uniform sampler2D uIcons;
float sdRR(vec2 p,vec2 h,float r){vec2 q=abs(p)-(h-vec2(r));return length(max(q,0.0))-r+min(max(q.x,q.y),0.0);}
vec2 sgn(vec2 p){return vec2(p.x>=0.0?1.0:-1.0,p.y>=0.0?1.0:-1.0);}
vec2 gradRR(vec2 p,vec2 h,float r){vec2 q=abs(p)-(h-vec2(r));if(q.x>=0.0||q.y>=0.0)return sgn(p)*normalize(max(q,0.0)+1e-6);float gx=step(q.y,q.x);return sgn(p)*vec2(gx,1.0-gx);}
float circleMap(float x){return 1.0-sqrt(1.0-x*x);}
vec4 over(vec4 d,vec4 s){return s+d*(1.0-s.a);}
vec4 icons(vec2 p){vec2 uv=(p+uMargin)*uDpr/uRes;if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0)return vec4(0.0);return texture2D(uIcons,uv);}
vec4 barEdges(vec2 p){vec2 h=uTrack*0.5;vec2 c=p-h;float r=h.y;float sd=sdRR(c,h,r);vec4 col=vec4(0.0);
  float rim=clamp(0.5-sd,0.0,1.0)*clamp(sd+1.25,0.0,1.0)*0.75;float ra=mix(0.27,0.02,clamp(p.y/uTrack.y,0.0,1.0))*rim;col=over(col,vec4(vec3(ra),ra));
  float hl=clamp(0.5-sd,0.0,1.0)*clamp(sd+1.0,0.0,1.0)*0.5;float inten=abs(dot(gradRR(c,h,min(r*1.5,min(h.x,h.y))),vec2(0.70710678)));float ha=0.5*inten*hl;
  return over(col,vec4(vec3(ha),ha));}
float barInside(vec2 p){vec2 h=uTrack*0.5;return clamp(0.5-sdRR(p-h,h,h.y),0.0,1.0);}
void main(){
  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uDpr-uMargin;float s=min(uPillScale.x,uPillScale.y);
  vec2 lc=(p-uPillC)/uPillScale;float lsd=sdRR(lc,uPillHalf,uPillR);float pillCov=clamp(0.5-lsd*s,0.0,1.0);float inBar=barInside(p);
  vec4 outCol=over(vec4(0.0),barEdges(p));outCol=over(outCol,icons(p));
  if(uPress>0.0){float sds=sdRR((p-vec2(0.0,4.0)-uPillC)/uPillScale,uPillHalf,uPillR)*s;float sh=0.1*uPress*pow(clamp(1.0-max(sds,0.0)/24.0,0.0,1.0),2.0);outCol=over(outCol,vec4(0.0,0.0,0.0,sh));}
  vec2 rl=lc;
  if(-lsd<uLens.x){float d=circleMap(1.0-(-min(lsd,0.0))/uLens.x)*-uLens.y;float gr=min(uPillR*1.5,min(uPillHalf.x,uPillHalf.y));
    vec2 g=normalize(gradRR(lc,uPillHalf,gr)+uDepth*normalize(lc+1e-6));rl=lc+d*g;}
  vec2 src=uPillC+rl*uPillScale;
  float fillA=barInside(src)*(1.0-inBar)*0.92;vec4 inCol=over(vec4(0.0),vec4(uBarFill*fillA,fillA));inCol=over(inCol,barEdges(src));
  if(uPress>0.0){float rr=8.0*uPress;float sdi=sdRR((p-vec2(0.0,rr)-uPillC)/uPillScale,uPillHalf,uPillR)*s;
    inCol=over(inCol,vec4(0.0,0.0,0.0,0.15*uPress*smoothstep(-rr,rr,sdi)));inCol=over(inCol,vec4(0.0,0.0,0.0,0.03*uPress));
    float hl=clamp(lsd*s+1.0,0.0,1.0);float inten=abs(dot(gradRR(lc,uPillHalf,min(uPillR*1.5,min(uPillHalf.x,uPillHalf.y))),vec2(0.70710678)));
    float ha=0.5*uPress*inten*hl;inCol=over(inCol,vec4(vec3(ha),ha));}
  float e=1.0-0.5*uPress;inCol=over(inCol,vec4(uSurface*0.52*e,0.52*e));inCol=over(inCol,vec4(uAccent*0.2*e,0.2*e));
  float rimA=mix(0.6,0.15,clamp(p.y/uTrack.y,0.0,1.0))*clamp(lsd*s+1.5,0.0,1.0)*e;inCol=over(inCol,vec4(uAccent*rimA,rimA));
  inCol=over(inCol,icons(uRefract>0.5?src:p));
  gl_FragColor=mix(outCol,inCol,pillCov);}`;
  function initGL(){let gl=null;try{gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false})}catch(_){}if(!gl)return null;
    const sh=(t,src)=>{const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
    try{const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}'));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FRAG));
      gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const loc=gl.getAttribLocation(pr,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
      gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]].forEach(([k,v])=>gl.texParameteri(gl.TEXTURE_2D,k,v));
      const u={};['uRes','uDpr','uMargin','uTrack','uPillC','uPillHalf','uPillScale','uPillR','uPress','uRefract','uAccent','uSurface','uBarFill','uLens','uDepth','uIcons'].forEach(n=>u[n]=gl.getUniformLocation(pr,n));
      return{gl,u}}catch(err){console.warn('Barre : WebGL indisponible, pastille simple',err);return null}}
  const GL=initGL(),c2=GL?null:canvas.getContext('2d');
  track.classList.toggle('flat',!GL);
  function draw(){if(!W)return;const f=frame(),g=pillGeo(f),acc=accentAt(f.pos);
    if(GL){drawIcons(ictx,f,g);const{gl,u}=GL,n=c=>c.map(v=>v/255);
      gl.viewport(0,0,canvas.width,canvas.height);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,iconCv);
      gl.uniform2f(u.uRes,canvas.width,canvas.height);gl.uniform1f(u.uDpr,canvas.width/(W+MX*2));gl.uniform2f(u.uMargin,MX,MY);gl.uniform2f(u.uTrack,W,H);
      gl.uniform2f(u.uPillC,g.cx,g.cy);gl.uniform2f(u.uPillHalf,g.hw,g.hh);gl.uniform2f(u.uPillScale,g.sx,g.sy);gl.uniform1f(u.uPillR,g.r);
      gl.uniform1f(u.uPress,f.press);gl.uniform1f(u.uRefract,refract?1:0);gl.uniform3fv(u.uAccent,n(acc));gl.uniform3fv(u.uSurface,n(C.sf));
      gl.uniform3fv(u.uBarFill,n(C.sf.map((v,k)=>v*.4+C.bg[k]*.6)));gl.uniform2f(u.uLens,LENS[0],LENS[1]);gl.uniform1f(u.uDepth,DEPTH);gl.uniform1i(u.uIcons,0);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return}
    /* sans WebGL : pastille pleine teintée de la couleur de l'onglet */
    c2.setTransform(1,0,0,1,0,0);c2.clearRect(0,0,canvas.width,canvas.height);c2.setTransform(dpr,0,0,dpr,MX*dpr,MY*dpr);
    const pill=pillPath(g),out=new Path2D();c2.fillStyle=css(C.sf,.6);c2.fill(pill);c2.fillStyle=css(acc,.2);c2.fill(pill);
    c2.strokeStyle=css(acc,.5);c2.lineWidth=1;c2.stroke(pill);out.rect(-MX,-MY,W+MX*2,H+MY*2);out.addPath(pill);
    c2.save();c2.clip(out,'evenodd');drawRow(c2,f,false);c2.restore();c2.save();c2.clip(pill);drawRow(c2,f,true);c2.restore()}
  function render(){wrap.style.transform=`scale(${tp.v})`;track.style.transformOrigin=`${originX}px 50%`;
    track.style.transform=`translate(${panelOff(panel.v)}px,${ty.v}px) scaleX(${tx.v})`;draw()}

  /* ---- réfraction des bords de la barre (backdrop-filter SVG, Chromium seulement) ---- */
  const chromium=!!(navigator.userAgentData&&navigator.userAgentData.brands&&navigator.userAgentData.brands.some(b=>/Chromium/.test(b.brand)))&&!matchMedia('(prefers-reduced-transparency: reduce)').matches,
    barMap=document.getElementById('navMap');let mapKey='',mapTm=0;
  function sdRR(px,py,hx,hy,r){const qx=Math.abs(px)-(hx-r),qy=Math.abs(py)-(hy-r);return Math.hypot(Math.max(qx,0),Math.max(qy,0))-r+Math.min(Math.max(qx,qy),0)}
  function gradRR(px,py,hx,hy,r){const qx=Math.abs(px)-(hx-r),qy=Math.abs(py)-(hy-r),sx=px>=0?1:-1,sy=py>=0?1:-1;
    if(qx>=0||qy>=0){const mx=Math.max(qx,0),my=Math.max(qy,0),l=Math.hypot(mx,my)||1;return[sx*mx/l,sy*my/l]}return qx>=qy?[sx,0]:[0,sy]}
  function buildMap(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x2=c.getContext('2d'),img=x2.createImageData(w,h),
      hx=w/2,hy=h/2,r=hy,gr=Math.min(r*1.5,hx,hy),scale=48;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const px=x+.5-hx,py=y+.5-hy,sd=sdRR(px,py,hx,hy,r);let dx=0,dy=0;
      if(-sd<BAR.refraction){const t=1-(-Math.min(sd,0))/BAR.refraction,d=(1-Math.sqrt(Math.max(0,1-t*t)))*-BAR.amount,[gx,gy]=gradRR(px,py,hx,hy,gr);dx=d*gx;dy=d*gy}
      const o=(y*w+x)*4;img.data[o]=Math.round(cl(.5+dx/scale,0,1)*255);img.data[o+1]=Math.round(cl(.5+dy/scale,0,1)*255);img.data[o+2]=128;img.data[o+3]=255}
    x2.putImageData(img,0,0);barMap.setAttribute('href',c.toDataURL())}
  function updateMap(){if(!chromium||!barMap)return;const w=Math.round(W),h=Math.round(H),k=w+'x'+h;barMap.setAttribute('width',w);barMap.setAttribute('height',h);
    if(k===mapKey)return;clearTimeout(mapTm);mapTm=setTimeout(()=>{mapKey=k;buildMap(w,h)},mapKey?150:0)}
  if(chromium&&barMap)track.classList.add('refract');

  function measure(){W=track.offsetWidth;H=track.offsetHeight;dpr=Math.min(devicePixelRatio||1,3);if(!dragging)originX=W/2;
    const cw=W+MX*2,ch=H+MY*2,pw=Math.round(cw*dpr),ph=Math.round(ch*dpr);
    Object.assign(canvas.style,{left:-MX+'px',top:-MY+'px',width:cw+'px',height:ch+'px'});
    if(canvas.width!==pw||canvas.height!==ph){canvas.width=iconCv.width=pw;canvas.height=iconCv.height=ph}
    updateMap()}
  function tick(now){
    raf=0;const s=RM?1:cl(last?(now-last)/1000:0,0,.064);last=now;
    target=cl(target,0,maxI);
    /* clic : glissement à durée fixe (340 ms, accéléré puis freiné), en temps réel même si des images sautent */
    if(glide){const k=Math.min(1,(now-glide.t0)/glide.d),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;pos.v=glide.de+(glide.vers-glide.de)*e;pos.vel=0;if(k>=1){pos.snap(glide.vers);glide=null}}
    else pos.step(target,s);
    vel.step(dragging&&maxI>0?pos.vel/maxI:0,s);
    if(!dragging)panel.step(0,s);
    if(release&&(glide||Math.abs(pos.v-target)<Math.max(1,maxI)*.025)){release=false;pressT=0;shapeT=1}
    press.step(pressT,s);sx.step(shapeT,s);sy.step(shapeT,s);tp.step(dragging?1.025:1,s);
    if(!dragging){ty.step(0,s);tx.step(1,s);if(tx.rest(1))originX=W/2}
    render();
    const busy=dragging||release||!pos.rest(target)||!vel.rest(0)||!press.rest(0)||!sx.rest(1)||!sy.rest(1)||!panel.rest(0)||!ty.rest(0)||!tx.rest(1)||!tp.rest(1)||!!glide;
    if(busy)raf=requestAnimationFrame(tick);else last=0}
  const kick=()=>{if(!raf)raf=requestAnimationFrame(tick)};
  const glisser=i=>{if(RM||Math.abs(pos.v-i)<1e-3){glide=null;return}if(glide&&glide.vers===i)return;glide={de:pos.v,vers:i,t0:performance.now(),d:340}};
  function select(i,anim){dragging=false;refract=false;target=i;
    if(anim===false){glide=null;pos.snap(i);vel.snap(0);render();return}
    glisser(i);release=true;pressT=0;shapeT=1;kick()}
  /* coordonnées dans la barre, corrigées de son échelle */
  const local=e=>{const r=track.getBoundingClientRect();return[(e.clientX-r.left)*W/(r.width||1),(e.clientY-r.top)*H/(r.height||1)]};
  /* appui : rien ne bouge tant que le doigt ne glisse pas. Glisser (4 px) : la pastille gonfle en lentille et suit le doigt.
     Simple appui : elle glisse en douceur jusqu'à l'onglet touché, sans gonfler. */
  track.addEventListener('pointerdown',e=>{
    if(pid!==null||!e.isPrimary||e.button!==0)return;
    pid=e.pointerId;cx0=e.clientX;cy0=e.clientY;[downX,downY]=local(e);downY=cl(downY,0,H);
    startY=ty.v;moved=0;startP=panel.v;panel.vel=0;
    try{track.setPointerCapture(pid)}catch(_){}});
  track.addEventListener('pointermove',e=>{
    if(e.pointerId!==pid)return;
    const dx=e.clientX-cx0,dy=e.clientY-cy0,tw=tabW();if(tw<=0)return;
    moved=Math.max(moved,Math.abs(dx),Math.abs(dy));
    if(!dragging){if(moved<4)return;
      glide=null;dragging=true;refract=true;release=false;pressT=1;shapeT=1.3;startT=pos.v;near=Math.round(pos.v);originX=cl(downX,0,W)}
    target=cl(startT+dx/tw,0,maxI);panel.snap(startP+dx);
    ty.snap(startY+rubber(dy,H)*.25);tx.snap(1-Math.min(Math.abs(dy)/700,1)*.08);
    originX=cl(downX+dx,0,W);
    const n=Math.round(target);if(n!==near){near=n;buzz(4)}
    kick()});
  track.addEventListener('pointerup',e=>{
    if(e.pointerId!==pid)return;pid=null;
    const glisse=dragging,i=glisse?cl(Math.round(target),0,maxI):at(downX);
    dragging=false;refract=false;panel.vel=0;target=i;release=true;
    if(!glisse){pressT=0;shapeT=1;glisser(i)}kick();
    /* la page change à l'image suivante : la pastille a déjà commencé à glisser */
    requestAnimationFrame(()=>onSelect(i))});
  const cancel=e=>{if(e.pointerId!==pid)return;pid=null;panel.vel=0;select(active())};
  track.addEventListener('pointercancel',cancel);track.addEventListener('lostpointercapture',cancel);
  /* démonstration : au repos, la pastille glisse seule vers l'onglet voisin puis revient, en lentille, pour montrer
     qu'on peut la faire glisser (une fois par visite, annulée dès que l'utilisateur touche la barre) */
  let touche=false,demoTm=0;
  track.addEventListener('pointerdown',()=>{touche=true;clearTimeout(demoTm)},{capture:true});
  function demo(){if(RM||touche||dragging||!W)return;const a=active(),dir=a<maxI?1:-1;
    track.dataset.demo='1';refract=true;release=false;pressT=1;shapeT=1.3;target=a+dir*.62;kick();
    demoTm=setTimeout(()=>{if(touche)return;target=a;release=true;kick();
      demoTm=setTimeout(()=>{refract=false;delete track.dataset.demo;draw()},700)},650)}
  /* clavier : Entrée / Espace déclenchent click sans pointeur */
  items.forEach((b,i)=>b.addEventListener('click',e=>{if(e.detail===0){select(i);onSelect(i)}}));
  /* redessine quand le thème ou la langue change */
  const mo=new MutationObserver(()=>{colors();draw()});mo.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','lang']});
  const ro=new ResizeObserver(()=>{measure();render()});ro.observe(track);
  colors();measure();render();
  if(document.fonts)document.fonts.ready.then(draw);
  return{select,demo,detruire(){mo.disconnect();ro.disconnect();cancelAnimationFrame(raf);clearTimeout(demoTm)}}}
