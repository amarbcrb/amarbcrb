'use strict';
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const A = (el, kf, opt) => el.animate(kf, Object.assign({ fill: 'forwards' }, opt)).finished;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ================= Stockage et réglages ================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem('arcane.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('arcane.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const settings = Object.assign({
  card: { rank: 11, suit: 'H' }, back: 'rouge', effect: 'classique',
  live: false, revealText: true, vibrate: true, fullscreen: true, dot: true, grid: false, stamp: '180'
}, store.get('settings', {}));
const saveSettings = () => store.set('settings', settings);
let customBack = store.get('customBack', null);

const buzz = p => { if (settings.vibrate && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* ignoré */ } };

/* ================= Cartes ================= */
const SUITS = ['S', 'H', 'C', 'D']; // ordre aussi utilisé par la grille secrète 2x2
const SUIT_NAME = { S: 'pique', H: 'cœur', C: 'trèfle', D: 'carreau' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_NAME = ['As', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix', 'Valet', 'Dame', 'Roi'];
const BACKS = ['rouge', 'bleu', 'violet', 'noir', 'or'];
const isRed = s => s === 'H' || s === 'D';
const cardName = c => `${RANK_NAME[c.rank]} de ${SUIT_NAME[c.suit]}`;
const cardSrc = c => `cards/${RANKS[c.rank]}${c.suit}.webp`;
const backSrc = () => settings.back === 'perso' && customBack ? customBack : `cards/back-${BACKS.includes(settings.back) ? settings.back : 'rouge'}.webp`;
const fullDeck = () => SUITS.flatMap(suit => RANKS.map((_, rank) => ({ rank, suit })));
const sameCard = (a, b) => a.rank === b.rank && a.suit === b.suit;
const suitIcon = (s, size = 22) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="${isRed(s) ? '#e0364f' : '#ece7dc'}"><use href="#su-${s}"/></svg>`;
function decode(img) {
  if (img.complete && img.naturalWidth) return Promise.resolve();
  return (img.decode ? img.decode() : new Promise(r => { img.onload = r; })).catch(() => {});
}

// Taille d'écriture adaptée à la longueur du texte (en % de la largeur du papier)
function paperHTML(text, cls = '') {
  const n = Math.max(1, [...text].length);
  const fs = n <= 5 ? Math.min(32, 150 / n) : Math.max(8, 46 / Math.sqrt(n));
  return `<div class="paper ${cls}"><span style="font-size:${fs.toFixed(1)}cqw">${esc(text)}</span></div>`;
}

/* ================= Saisie secrète ================= */
// Carte : 1re touche = valeur (grille 4x4), 2e touche = couleur (quarts d'écran).
// Nombre : grille 3x4 de clavier téléphone, ⌫ en bas à gauche, ✓ en bas à droite.
const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];

function makePad(type, onStep, onDone) {
  let step = 0, rank = 0, digits = '';
  return {
    get digits() { return digits; },
    feed(fx, fy) { // position relative 0..1
      const col = n => Math.min(n - 1, Math.floor(fx * n)), row = n => Math.min(n - 1, Math.floor(fy * n));
      if (type === 'card') {
        if (step === 0) {
          const i = row(4) * 4 + col(4);
          if (i > 12) return;
          rank = i; step = 1; onStep(step);
        } else if (step === 1) {
          step = 2; onDone({ rank, suit: SUITS[row(2) * 2 + col(2)] });
        }
        return;
      }
      if (step === 2) return;
      const k = NUM_KEYS[row(4) * 3 + col(3)];
      if (k === '✓') { if (digits) { step = 2; onDone({ type: 'note', text: digits }); } return; }
      digits = k === '⌫' ? digits.slice(0, -1) : (digits + k).slice(0, 16);
      onStep(step);
    },
    reset() { step = 0; rank = 0; digits = ''; }
  };
}
function makeGrid(parent, type) {
  const g = document.createElement('div');
  g.className = 'padgrid';
  parent.appendChild(g);
  let phase = 0;
  const draw = () => {
    if (phase === 2) { g.innerHTML = ''; return; }
    if (type === 'card' && phase === 0) {
      g.style.gridTemplate = 'repeat(4,1fr) / repeat(4,1fr)';
      g.innerHTML = Array.from({ length: 16 }, (_, i) => `<i>${RANKS[i] || ''}</i>`).join('');
    } else if (type === 'card') {
      g.style.gridTemplate = 'repeat(2,1fr) / repeat(2,1fr)';
      g.innerHTML = SUITS.map(s => `<i>${suitIcon(s, 34)}</i>`).join('');
    } else {
      g.style.gridTemplate = 'repeat(4,1fr) / repeat(3,1fr)';
      g.innerHTML = NUM_KEYS.map(k => `<i>${k}</i>`).join('');
    }
  };
  draw();
  return { step() { if (type === 'card') { phase = 1; draw(); } }, done() { phase = 2; draw(); }, reset() { phase = 0; draw(); } };
}
function padDiagrams(type) {
  if (type === 'card') {
    return `<div class="diagrams"><div class="diag" style="grid-template:repeat(4,1fr)/repeat(4,1fr)">${Array.from({ length: 16 }, (_, i) => `<i>${RANKS[i] || ''}</i>`).join('')}</div>`
      + `<div class="diag" style="grid-template:repeat(2,1fr)/repeat(2,1fr)">${SUITS.map(s => `<i>${suitIcon(s, 18)}</i>`).join('')}</div></div>`;
  }
  return `<div class="diagrams"><div class="diag" style="grid-template:repeat(4,1fr)/repeat(3,1fr)">${NUM_KEYS.map(k => `<i>${k}</i>`).join('')}</div></div>`;
}

/* ================= Gestes ================= */
// Un seul doigt suivi à la fois : tap (court, immobile), appui long, glissé.
function gestures(el, h) {
  let id = null, sx = 0, sy = 0, t0 = 0, moved = false, lt = 0;
  el.addEventListener('pointerdown', e => {
    if (id !== null) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY; t0 = performance.now(); moved = false;
    try { el.setPointerCapture(id); } catch (err) { /* ignoré */ }
    if (h.down) h.down(e);
    if (h.long) lt = setTimeout(() => { if (!moved && id !== null) { id = null; h.long(e); } }, 750);
  });
  el.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 14) { moved = true; clearTimeout(lt); }
    if (h.move) h.move(e);
  });
  const end = (e, cancelled) => {
    if (e.pointerId !== id) return;
    clearTimeout(lt); id = null;
    if (h.up) h.up(e);
    if (!cancelled && !moved && performance.now() - t0 < 600 && h.tap) h.tap(e);
  };
  el.addEventListener('pointerup', e => end(e, false));
  el.addEventListener('pointercancel', e => end(e, true));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
const relTo = (el, e) => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };

/* ================= Scène plein écran ================= */
let stage = $('#stage');
let stageCleanup = null, wake = null;
async function keepAwake() { try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch (e) { wake = null; } }
document.addEventListener('visibilitychange', () => { if (!stage.hidden && document.visibilityState === 'visible') keepAwake(); });

// Sortie discrète : 3 touches rapides dans le coin haut gauche
let cornerTaps = [];
function cornerExit(e) {
  if (e.clientX > 72 || e.clientY > 72) { cornerTaps = []; return; }
  const t = performance.now();
  cornerTaps = cornerTaps.filter(x => t - x < 1000);
  cornerTaps.push(t);
  if (cornerTaps.length >= 3) { cornerTaps = []; exitStage(); }
}
function openStage(build) {
  // Nouvel élément à chaque tour : les écouteurs du tour précédent disparaissent avec l'ancien
  const fresh = stage.cloneNode(false);
  stage.replaceWith(fresh);
  stage = fresh;
  stage.className = 'stage';
  stage.hidden = false;
  stage.addEventListener('pointerup', cornerExit);
  stage.addEventListener('contextmenu', e => e.preventDefault());
  document.body.classList.add('staging');
  history.pushState({ view: current, stage: true }, '');
  if (settings.fullscreen) {
    const de = document.documentElement;
    try {
      const req = de.requestFullscreen || de.webkitRequestFullscreen;
      if (req && !document.fullscreenElement) { const p = req.call(de, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { /* plein écran refusé : on continue */ }
  }
  keepAwake();
  stageCleanup = build(stage) || null;
}
function closeStage() {
  if (stage.hidden) return;
  if (typeof stageCleanup === 'function') stageCleanup();
  stageCleanup = null;
  stage.hidden = true;
  stage.innerHTML = '';
  document.body.classList.remove('staging');
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) { /* ignoré */ }
  if (wake) { wake.release().catch(() => {}); wake = null; }
  if (current === 'show') buildShow($('[data-view="show"]'), false);
}
const exitStage = () => history.back();
function blip(parent = stage) {
  if (!settings.dot) return;
  const d = document.createElement('div');
  d.className = 'blip';
  parent.appendChild(d);
  setTimeout(() => d.remove(), 450);
}

/* ================= Particules ================= */
function makeFX(canvas) {
  const ctx = canvas.getContext('2d');
  let parts = [], raf = 0, W = 0, H = 0;
  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  const draw = (p, t) => {
    if (p.kind === 'smoke') {
      ctx.globalCompositeOperation = 'source-over';
      const a = Math.sin(Math.PI * t) * p.a, r = p.r * (1 + t * 1.8);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(${p.c},${a})`); g.addColorStop(1, `rgba(${p.c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    } else if (p.kind === 'ring') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${p.c},${(1 - t) * .8})`; ctx.lineWidth = 2 + 10 * (1 - t);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * Math.pow(t, .6), 0, 7); ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      const a = 1 - t, r = p.r * (1 - t * .5);
      ctx.fillStyle = `rgba(${p.c},${a * .22})`; ctx.beginPath(); ctx.arc(p.x, p.y, r * 3.2, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(${p.c},${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    }
  };
  const loop = () => {
    ctx.clearRect(0, 0, W, H);
    const now = performance.now();
    parts = parts.filter(p => {
      const t = (now - p.t0) / p.life;
      if (t >= 1) return false;
      if (t < 0) return true;
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy;
      draw(p, t);
      return true;
    });
    raf = parts.length ? requestAnimationFrame(loop) : 0;
  };
  const add = p => {
    parts.push(Object.assign({ vx: 0, vy: 0, g: 0, drag: 1, r: 2.5, c: '255,214,140', a: .5, life: 1000, kind: 'spark' }, p, { t0: performance.now() + (p.delay || 0) }));
    if (!raf) raf = requestAnimationFrame(loop);
  };
  return {
    size, add,
    sparks(x, y, n, o = {}) {
      const cols = o.colors || ['255,226,160', '255,244,214', '240,180,90'];
      for (let i = 0; i < n; i++) {
        const a = rnd(0, Math.PI * 2), sp = rnd(o.min || 1, o.speed || 7);
        add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (o.up || 0), g: o.g ?? .06, drag: o.drag || .975, r: rnd(1.2, o.size || 3), c: cols[i % cols.length], life: rnd(600, o.life || 1400), delay: rnd(0, o.spread || 0) });
      }
    },
    smoke(rect, n, dur) {
      for (let i = 0; i < n; i++) {
        add({ kind: 'smoke', x: rnd(rect.left - 20, rect.right + 20), y: rnd(rect.top + (rect.bottom - rect.top) * .3, rect.bottom + 20), vx: rnd(-.5, .5), vy: rnd(-1.4, -.4), r: rnd(40, 90), c: i % 3 ? '220,220,225' : '190,190,200', a: rnd(.25, .5), life: rnd(1400, 2400), delay: rnd(0, dur) });
      }
    },
    ring(x, y, r, c = '255,220,160') { add({ kind: 'ring', x, y, r, c, life: 700 }); },
    stop() { cancelAnimationFrame(raf); raf = 0; parts = []; }
  };
}

/* ================= Effets de révélation ================= */
const EFFECTS = [
  ['classique', 'Effet classique'], ['slider', 'Slider latéral'], ['dispersion', 'Dispersion'], ['rotation', 'Rotation 3D'],
  ['zoom', 'Zoom magique'], ['lumiere', 'Apparition lumineuse'], ['fumee', 'Fumée'], ['explosion', 'Explosion'],
  ['flip', 'Flip élégant'], ['miroir', 'Miroir']
];
const STACKED = ['slider', 'dispersion', 'zoom', 'lumiere', 'fumee', 'explosion', 'miroir'];
const HIDE_FACE = ['zoom', 'lumiere', 'fumee', 'explosion'];

const FX = {
  async classique({ card }) {
    await A(card, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], { duration: 950, easing: 'cubic-bezier(.2,.7,.2,1)' });
  },
  async flip({ card, zone }) {
    await A(card, [
      { transform: 'translateY(0px) rotateZ(0deg) rotateY(0deg) scale(1)' },
      { transform: 'translateY(-26px) rotateZ(-5deg) rotateY(0deg) scale(1.06)', offset: .22 },
      { transform: 'translateY(-26px) rotateZ(3deg) rotateY(196deg) scale(1.06)', offset: .78 },
      { transform: 'translateY(0px) rotateZ(0deg) rotateY(180deg) scale(1)' }
    ], { duration: 1800, easing: 'ease-in-out' });
    const sh = document.createElement('div');
    sh.className = 'rv-shine';
    zone.appendChild(sh);
    await A(sh, [{ opacity: 0, backgroundPosition: '120% 0' }, { opacity: 1, offset: .2 }, { opacity: 0, backgroundPosition: '-60% 0' }], { duration: 900, easing: 'ease-in-out' });
  },
  async rotation({ card, fx, c }) {
    const run = A(card, [
      { transform: 'rotateX(0deg) rotateY(0deg) scale(1)' },
      { transform: 'rotateX(14deg) rotateY(720deg) scale(1.1)', offset: .55 },
      { transform: 'rotateX(0deg) rotateY(1260deg) scale(1)' }
    ], { duration: 2400, easing: 'cubic-bezier(.3,.1,.2,1)' });
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2;
      fx.add({ x: c.x + Math.cos(a) * c.w * .8, y: c.y + Math.sin(a) * c.w * .35, vx: -Math.sin(a) * 3, vy: Math.cos(a) * 1.2, r: 2.2, life: 1300, delay: i * 40, drag: .99 });
    }
    await run;
  },
  async slider({ zone, back, face }) {
    face.style.transform = 'translateX(150vw)';
    const ghosts = [0, 1, 2].map(() => { const g = back.cloneNode(); g.className = ''; g.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border-radius:4.2%/3%;z-index:3'; zone.appendChild(g); return g; });
    ghosts.forEach((g, i) => A(g, [{ transform: 'translateX(150vw)', filter: 'blur(2px)' }, { transform: 'translateX(-150vw)', filter: 'blur(2px)' }], { duration: 420, delay: i * 120, easing: 'linear' }).then(() => g.remove()));
    A(back, [{ transform: 'translateX(0) rotate(0deg)' }, { transform: 'translateX(-150vw) rotate(-8deg)' }], { duration: 460, delay: 260, easing: 'ease-in' });
    await A(face, [{ transform: 'translateX(150vw) rotate(8deg)' }, { transform: 'translateX(-16px) rotate(-1deg)', offset: .75 }, { transform: 'translateX(0) rotate(0deg)' }], { duration: 820, delay: 470, easing: 'cubic-bezier(.2,.8,.3,1)' });
  },
  async dispersion({ zone, back, face, fx, c }) {
    const R = zone.getBoundingClientRect(), cols = 6, rows = 8, tw = R.width / cols, th = R.height / rows;
    const runs = [];
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const t = document.createElement('div');
      t.className = 'tile';
      t.style.cssText = `left:${k * tw}px;top:${r * th}px;width:${tw + .6}px;height:${th + .6}px;background-image:url("${back.src}");background-size:${R.width}px ${R.height}px;background-position:${-k * tw}px ${-r * th}px`;
      zone.appendChild(t);
      const dx = (k + .5 - cols / 2) * tw * rnd(2, 5) + rnd(-40, 40), dy = (r + .5 - rows / 2) * th * rnd(1.5, 3.5) - rnd(40, 160);
      runs.push(A(t, [{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${rnd(-540, 540)}deg) scale(.3)`, opacity: 0 }], { duration: rnd(900, 1500), delay: rnd(0, 260), easing: 'cubic-bezier(.2,.6,.3,1)' }).then(() => t.remove()));
    }
    back.style.visibility = 'hidden';
    fx.sparks(c.x, c.y, 50, { speed: 6, g: .03, spread: 300 });
    A(face, [{ transform: 'scale(.94)', filter: 'brightness(1.6)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 1200, easing: 'ease-out' });
    await Promise.all(runs);
  },
  async zoom({ back, face, fx, c }) {
    await A(back, [{ transform: 'scale(1) rotate(0deg)', opacity: 1 }, { transform: 'scale(0) rotate(220deg)', opacity: 0 }], { duration: 600, easing: 'cubic-bezier(.6,0,.8,.4)' });
    fx.sparks(c.x, c.y, 70, { speed: 8, g: .02 });
    fx.ring(c.x, c.y, c.w * 1.4);
    await A(face, [
      { transform: 'scale(.1)', opacity: 0, filter: 'brightness(3)' },
      { transform: 'scale(1.08)', opacity: 1, filter: 'brightness(1.5)', offset: .7 },
      { transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' }
    ], { duration: 850, easing: 'cubic-bezier(.2,.8,.2,1)' });
  },
  async lumiere({ rv, back, face, flash, fx, c }) {
    const rays = $('.rv-rays', rv);
    A(rays, [{ opacity: 0, transform: 'rotate(0deg)' }, { opacity: .9, transform: 'rotate(40deg)' }], { duration: 2400, easing: 'ease-out' })
      .then(() => rays.animate([{ transform: 'rotate(40deg)', opacity: .45 }, { transform: 'rotate(400deg)', opacity: .45 }], { duration: 60000, iterations: Infinity }))
      .catch(() => {});
    await A(flash, [{ opacity: 0 }, { opacity: 1 }], { duration: 800, easing: 'ease-in' });
    back.style.opacity = '0'; face.style.opacity = '1';
    for (let i = 0; i < 40; i++) fx.add({ x: c.x + rnd(-c.w, c.w), y: c.y + rnd(0, c.h * .7), vy: rnd(-1.6, -.6), vx: rnd(-.3, .3), r: rnd(1, 2.6), life: rnd(1200, 2400), delay: rnd(0, 900), drag: .995 });
    await A(flash, [{ opacity: 1 }, { opacity: 0 }], { duration: 1200, easing: 'ease-out' });
  },
  async fumee({ zone, back, face, fx }) {
    fx.smoke(zone.getBoundingClientRect(), 46, 1500);
    await wait(500);
    A(back, [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(6px)' }], { duration: 900, easing: 'ease-in' });
    await wait(500);
    await A(face, [{ opacity: 0, filter: 'blur(12px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 1500, easing: 'ease-out' });
  },
  async explosion({ rv, zone, back, face, flash, fx, c }) {
    await A(zone, [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ transform: i === 8 ? 'translate(0px,0px)' : `translate(${rnd(-6, 6)}px,${rnd(-6, 6)}px)` })), { duration: 480, fill: 'none' });
    A(flash, [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 0 }], { duration: 700 });
    back.style.opacity = '0';
    fx.ring(c.x, c.y, c.w * 2.4, '255,190,110');
    fx.sparks(c.x, c.y, 150, { speed: 14, min: 3, g: .12, drag: .965, size: 3.4, colors: ['255,236,170', '255,170,60', '235,80,40', '255,255,255'] });
    A(rv, [0, 1, 2, 3, 4, 5].map(i => ({ transform: i === 5 ? 'translate(0px,0px)' : `translate(${rnd(-8, 8)}px,${rnd(-8, 8)}px)` })), { duration: 380, fill: 'none' });
    await A(face, [
      { transform: 'scale(.5)', opacity: 0, filter: 'brightness(2.6)' },
      { transform: 'scale(1.12)', opacity: 1, filter: 'brightness(1.4)', offset: .6 },
      { transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' }
    ], { duration: 750, easing: 'cubic-bezier(.2,.8,.2,1)' });
  },
  async miroir({ rv, zone, back }) {
    rv.classList.add('mirror');
    const reflBack = back.cloneNode();
    reflBack.className = '';
    $('.rv-refl', rv).appendChild(reflBack);
    const bar = document.createElement('div');
    bar.className = 'rv-bar';
    zone.appendChild(bar);
    await wait(500);
    const o = { duration: 1500, easing: 'cubic-bezier(.45,0,.55,1)' };
    A(bar, [{ left: '0%', opacity: 0 }, { opacity: 1, offset: .1 }, { opacity: 1, offset: .9 }, { left: '100%', opacity: 0 }], o);
    A(reflBack, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 100%)' }], o);
    await A(back, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 100%)' }], o);
  }
};

// Miniatures pour le choix de l'effet
function thumbInner(k) {
  const b = `<img src="${backSrc()}" alt="">`, f = '<img src="cards/QH.webp" alt="">';
  if (k === 'slider') return b + b;
  if (k === 'dispersion') return b + [[14, 18, 20], [80, 22, -30], [18, 60, 40], [86, 64, 15], [26, 40, -12], [74, 44, 50]].map(([x, y, r]) => `<i style="left:${x}%;top:${y}%;transform:rotate(${r}deg)"></i>`).join('');
  return ['zoom', 'lumiere', 'explosion', 'flip'].includes(k) ? f : b;
}

// Scène finale : rideaux, carte, reflet, texte. o = { effect, title, sub, onAgain, again }
async function revealScene(root, card, o = {}) {
  const effect = FX[o.effect] ? o.effect : (FX[settings.effect] ? settings.effect : 'classique');
  const text = settings.revealText && o.text !== false;
  root.className = root === stage ? 'stage curtains' : 'curtains';
  root.innerHTML = `<div class="rv"><div class="rv-floor"></div><div class="rv-rays"></div>
    ${text ? `<p class="rv-title">${esc(o.title || 'Votre carte était…')}</p>` : ''}
    <div class="rv-zone"><div class="rv-card${STACKED.includes(effect) ? ' stack' : ''}"><img class="rv-face" src="${cardSrc(card)}" alt="${cardName(card)}"><img class="rv-back" src="${backSrc()}" alt=""></div>
    <div class="rv-refl"><img src="${cardSrc(card)}" alt=""></div></div>
    ${text ? `<svg class="rv-orn" aria-hidden="true"><use href="#orn"/></svg><p class="rv-sub">${esc(o.sub || 'Incroyable !')}</p>` : ''}
    ${o.again === false ? '' : '<button class="pill rv-again" type="button"><svg><use href="#i-redo"/></svg>Recommencer</button>'}
    </div><div class="rv-flash"></div><canvas class="rv-fx"></canvas>`;
  const rv = $('.rv', root), zone = $('.rv-zone', root), cardEl = $('.rv-card', root);
  const back = $('.rv-back', root), face = $('.rv-face', root), flash = $('.rv-flash', root);
  const fx = makeFX($('.rv-fx', root));
  const again = $('.rv-again', root);
  if (again) again.addEventListener('click', () => { fx.stop(); (o.onAgain || exitStage)(); });
  if (HIDE_FACE.includes(effect)) face.style.opacity = '0';
  await Promise.all([decode(face), decode(back)]);
  await wait(o.delay ?? 450);
  const r = zone.getBoundingClientRect();
  const c = { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  buzz(15);
  try { await FX[effect]({ rv, zone, card: cardEl, back, face, flash, fx, c }); } catch (e) { /* animation interrompue */ }
  if (STACKED.includes(effect)) { back.style.opacity = '0'; face.style.opacity = '1'; }
  fx.sparks(c.x, c.y - c.h * .1, 36, { speed: 3.2, g: .015, life: 1800, spread: 400 });
  rv.classList.add('done');
  buzz([20, 50, 20]);
}

/* ================= Spectacle ================= */
function buildShow(root, inStage) {
  root.innerHTML = `<div class="show velvet">
    <div class="show-head"><button class="icon-btn" type="button" data-menu aria-label="Menu"><svg><use href="#i-menu"/></svg></button><h1>Mode spectacle</h1><span></span></div>
    <p class="show-text">Le spectateur choisit une carte.<br>Touchez l'écran pour révéler.</p>
    <div class="deck">${[6, 5, 4, 3, 2, 1].map(k => `<i style="transform:translate(${k * .6}px,${k * 2}px)"></i>`).join('')}<img src="${backSrc()}" alt="Jeu de cartes"></div>
    <div class="tap-hint"><span class="hand"><svg><use href="#i-hand"/></svg></span><span class="pill">Toucher pour révéler</span></div></div>`;
  const el = root.firstElementChild;
  let card = settings.live ? null : settings.card, grid = null, busy = false;
  const pad = settings.live ? makePad('card', () => { buzz(15); blip(el); if (grid) grid.step(); }, c => { card = c; buzz([20, 60, 20]); blip(el); if (grid) grid.done(); }) : null;
  if (pad && settings.grid) grid = makeGrid(el, 'card');
  const go = () => {
    if (busy) return;
    busy = true;
    const c = card;
    if (inStage) revealScene(stage, c, { onAgain: () => { stage.className = 'stage'; buildShow(stage, true); } });
    else openStage(st => { revealScene(st, c, { onAgain: exitStage }); });
  };
  gestures(el, {
    tap: e => {
      if (e.target.closest('[data-menu]')) { if (inStage) exitStage(); else navigate('secret'); return; }
      if (!card) { const [x, y] = relTo(el, e); pad.feed(x, y); return; }
      go();
    },
    long: () => { if (pad && !busy) { pad.reset(); card = null; buzz([10, 40, 10, 40, 10]); if (grid) grid.reset(); } }
  });
  new Image().src = cardSrc(settings.card);
}
function startShow() {
  if (settings.fullscreen) openStage(st => { buildShow(st, true); });
  else navigate('show');
}

/* ================= Réglages secrets ================= */
const trow = (k, label, sub) => `<label class="trow"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="sw"><input type="checkbox" data-set="${k}"${settings[k] ? ' checked' : ''}><i></i></span></label>`;
function bindToggles(root, after) {
  $$('[data-set]', root).forEach(i => i.addEventListener('change', () => { settings[i.dataset.set] = i.checked; saveSettings(); if (after) after(); }));
}
function buildSecret() {
  // Élément neuf : reconstruire ne cumule pas les écouteurs
  const old = $('#secret-body'), root = old.cloneNode(false);
  old.replaceWith(root);
  const backBtns = () => BACKS.map(b => `<button type="button" data-bk="${b}" aria-label="Dos ${b}"><img src="cards/back-${b}.webp" alt=""></button>`).join('')
    + (customBack ? `<button type="button" data-bk="perso" aria-label="Mon dos"><img src="${customBack}" alt=""></button>` : '');
  root.innerHTML = `
    <p class="lead">Choisis la carte à révéler :</p>
    <div class="carousel" id="car">${RANKS.map((_, r) => `<div class="cc" data-r="${r}"><img alt=""></div>`).join('')}
      <button class="car-arrow l" type="button" data-step="-1" aria-label="Carte précédente">‹</button><button class="car-arrow r" type="button" data-step="1" aria-label="Carte suivante">›</button></div>
    <p class="card-name" id="card-name"></p>
    <div class="suits" role="group" aria-label="Couleur">${SUITS.map(s => `<button type="button" data-suit="${s}" aria-label="${SUIT_NAME[s]}">${suitIcon(s)}</button>`).join('')}</div>
    <div class="rank-track" id="rank" role="slider" tabindex="0" aria-label="Valeur" aria-valuemin="1" aria-valuemax="13">${RANKS.map(l => `<span>${l}</span>`).join('')}<i class="rank-knob"></i></div>
    <p class="section-lbl">Choisis le dos des cartes</p>
    <div class="backs" id="backs">${backBtns()}</div>
    <div class="import-back"><label class="btn small ghost">Importer le dos de mon jeu<input type="file" accept="image/*" id="back-file"></label><span class="lbl" id="back-msg"></span></div>
    <p class="section-lbl">Effet de révélation</p>
    <div class="fx-strip" id="fx">${EFFECTS.map(([k, l]) => `<button class="fx" type="button" data-fx="${k}"><span class="thumb t-${k}">${thumbInner(k)}</span><span class="lab">${l}</span></button>`).join('')}</div>
    <button class="btn small ghost" type="button" id="fx-preview">Voir l'aperçu de l'effet</button>
    <div class="rows" style="margin-top:16px">
      ${trow('live', 'Saisie secrète en direct', 'La carte se choisit pendant le tour, par 2 touches invisibles.')}
      ${trow('revealText', 'Texte de révélation', '« Votre carte était… » et « Incroyable ! »')}
      ${trow('vibrate', 'Vibration', '')}
      ${trow('fullscreen', 'Mode plein écran', 'Cache les menus pendant le spectacle.')}
    </div>
    <div class="hint" id="live-hint" style="margin-top:14px"><b>Saisie secrète :</b> sur l'écran du spectacle, touchez 1) la valeur, 2) la couleur. Appui long = recommencer.${padDiagrams('card')}</div>
    <div style="margin-top:20px"><button class="btn gold" type="button" id="go-show"><svg><use href="#i-play"/></svg>Passer en mode spectacle</button></div>`;

  const car = $('#car', root), track = $('#rank', root);
  const refresh = () => {
    const { rank, suit } = settings.card;
    $$('.cc', car).forEach(el => {
      const r = +el.dataset.r, o = r - rank, a = Math.abs(o);
      const img = el.firstElementChild, src = cardSrc({ rank: r, suit });
      if (img.getAttribute('src') !== src) img.src = src;
      el.style.transform = `translateX(${o * 88}px) scale(${o ? .74 : 1})`;
      el.style.opacity = a > 2 ? '0' : o ? '.5' : '1';
      el.style.filter = o ? 'brightness(.6)' : 'none';
      el.style.zIndex = String(20 - a);
      el.classList.toggle('on', !o);
    });
    $('#card-name', root).textContent = cardName(settings.card);
    $$('[data-suit]', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.suit === suit)));
    $$('span', track).forEach((s, i) => s.classList.toggle('on', i === rank));
    $('.rank-knob', track).style.left = `calc(6px + (100% - 12px) * ${(rank + .5) / 13})`;
    track.setAttribute('aria-valuenow', String(rank + 1));
    track.setAttribute('aria-valuetext', RANK_NAME[rank]);
    $$('[data-bk]', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.bk === settings.back)));
    $$('[data-fx]', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fx === settings.effect)));
    $('#live-hint', root).hidden = !settings.live;
  };
  const setRank = r => { r = Math.max(0, Math.min(12, r)); if (r !== settings.card.rank) { settings.card = { rank: r, suit: settings.card.suit }; saveSettings(); refresh(); } };
  const refreshBackImages = () => $$('.thumb img', root).forEach(img => { if (!img.src.includes('/QH.')) img.src = backSrc(); });

  // Carrousel : flèches, glissé, toucher une carte voisine
  let sx = null;
  car.addEventListener('pointerdown', e => { sx = e.clientX; });
  car.addEventListener('pointerup', e => {
    if (sx === null) return;
    const dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) > 36) { setRank(settings.card.rank + (dx < 0 ? 1 : -1)); return; }
    const step = e.target.closest('[data-step]');
    if (step) { setRank(settings.card.rank + +step.dataset.step); return; }
    const cc = e.target.closest('.cc');
    if (cc) setRank(+cc.dataset.r);
  });
  // Curseur de valeur
  let drag = false;
  const pick = e => { const r = track.getBoundingClientRect(); setRank(Math.floor((e.clientX - r.left - 6) / (r.width - 12) * 13)); };
  track.addEventListener('pointerdown', e => { drag = true; try { track.setPointerCapture(e.pointerId); } catch (err) { /* ignoré */ } pick(e); });
  track.addEventListener('pointermove', e => { if (drag) pick(e); });
  track.addEventListener('pointerup', () => { drag = false; });
  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setRank(settings.card.rank - 1); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setRank(settings.card.rank + 1); }
  });
  root.addEventListener('click', e => {
    const s = e.target.closest('[data-suit]'), b = e.target.closest('[data-bk]'), f = e.target.closest('[data-fx]');
    if (s) { settings.card = { rank: settings.card.rank, suit: s.dataset.suit }; saveSettings(); refresh(); }
    if (b) { settings.back = b.dataset.bk; saveSettings(); refreshBackImages(); refresh(); buildTours(); }
    if (f) { settings.effect = f.dataset.fx; saveSettings(); refresh(); }
    if (e.target.closest('#fx-preview')) openStage(st => { revealScene(st, settings.card, { onAgain: exitStage }); });
    if (e.target.closest('#go-show')) startShow();
  });
  bindToggles(root, refresh);

  // Import d'une photo du dos du vrai jeu : recadrée en 5:7 et réduite
  $('#back-file', root).addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    const msg = $('#back-msg', root);
    if (!file) return;
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const W = 500, H = 700, cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const k = Math.max(W / img.width, H / img.height), w = img.width * k, h = img.height * k;
      cv.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      URL.revokeObjectURL(url);
      let data = cv.toDataURL('image/webp', .82);
      if (!data.startsWith('data:image/webp')) data = cv.toDataURL('image/jpeg', .85);
      customBack = data;
      const saved = store.set('customBack', data);
      settings.back = 'perso'; saveSettings();
      $('#backs', root).innerHTML = backBtns();
      refreshBackImages(); refresh(); buildTours();
      msg.textContent = saved ? 'Dos importé.' : 'Dos importé pour cette session (mémoire pleine).';
    };
    img.onerror = () => { msg.textContent = 'Image illisible.'; URL.revokeObjectURL(url); };
    img.src = url;
    e.target.value = '';
  });
  refresh();
  refreshBackImages();
}

/* ================= Navigation ================= */
const views = $$('.view');
let current = 'secret', subCleanup = null;
const SUBS = {};
function navigate(name, push = true) {
  if (subCleanup) { subCleanup(); subCleanup = null; }
  let sub = SUBS[name];
  if (!sub && name.startsWith('r:')) sub = routineSub(name.slice(2));
  if (!sub && !$(`.view[data-view="${name}"]`)) name = 'secret';
  views.forEach(v => { v.hidden = v.dataset.view !== (sub ? 'sub' : name); });
  if (sub) { $('#sub-title').textContent = sub.title; subCleanup = sub.build($('#sub-body')) || null; }
  const tab = sub ? sub.tab : name;
  $$('.tabbar [data-tabgo]').forEach(b => { if (b.dataset.tabgo === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (name === 'show') buildShow($('[data-view="show"]'), false);
  current = name;
  if (!sub) store.set('tab', name);
  if (push) history.pushState({ view: name }, '');
  window.scrollTo(0, 0);
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tabgo]');
  if (t) { if (t.dataset.tabgo !== current) navigate(t.dataset.tabgo); return; }
  const go = e.target.closest('[data-go]');
  if (go) { navigate(go.dataset.go); return; }
  if (e.target.closest('[data-back]')) history.back();
});
window.addEventListener('popstate', e => {
  if (!stage.hidden) { closeStage(); return; }
  navigate((e.state && e.state.view) || 'secret', false);
});

/* ================= Petits composants ================= */
const seg = (name, opts, val) => `<div class="seg" role="group" data-seg="${name}">`
  + opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(val)}">${l}</button>`).join('') + '</div>';
function bindSeg(root, onChange) {
  $$('[data-seg]', root).forEach(s => s.addEventListener('click', e => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    $$('button', s).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    onChange(s.dataset.seg, b.dataset.v);
  }));
}
const secretCardHTML = () => `<div class="secret-card"><img src="${cardSrc(settings.card)}" alt=""><span><b>${cardName(settings.card)}</b><small>Carte secrète (onglet Réglages)</small></span><button class="btn small ghost" type="button" data-go="secret">Changer</button></div>`;
const trickHead = (title, text) => `<h2>${title}</h2>${text ? `<p>${text}</p>` : ''}`;
const launchBtn = label => `<button class="btn gold" type="button" data-launch><svg><use href="#i-play"/></svg>${label}</button>`;

/* ================= Horodatage et prédiction enveloppe ================= */
const STAMPS = [['none', 'Aucun'], ['15', 'Il y a 15 minutes'], ['60', 'Il y a 1 heure'], ['180', 'Il y a 3 heures'], ['morning', 'Ce matin (8 h 12)'], ['yesterday', 'Hier soir (22 h 47)']];
function stampText(k) {
  if (!k || k === 'none') return '';
  const d = new Date();
  if (k === 'morning') { d.setHours(8, 12, 0, 0); if (d > new Date()) d.setDate(d.getDate() - 1); }
  else if (k === 'yesterday') { d.setDate(d.getDate() - 1); d.setHours(22, 47, 0, 0); }
  else d.setMinutes(d.getMinutes() - Number(k) - 3);
  const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const hm = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d);
  return `Scellée le ${day} à ${hm}`;
}
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

// cfg = { content: {type:'note', text} | null, secret: 'number' | null, stamp }
function launchEnvelope(cfg) {
  openStage(st => {
    st.className = 'stage velvet';
    const stampTxt = stampText(cfg.stamp);
    st.innerHTML = `<div class="pred-wrap"><p class="pred-label">Ma prédiction</p><div class="pred-obj">`
      + `<div class="env"><div class="env-back"></div>${paperHTML('')}<div class="env-front"></div><div class="env-flap"></div><div class="seal"></div></div>`
      + `</div><p class="pred-stamp">${stampTxt ? LOCK + esc(stampTxt) : ''}</p></div>`;
    const wrap = $('.pred-wrap', st), env = $('.env', st);
    let content = cfg.secret ? null : cfg.content, revealed = false, grid = null;
    const pad = cfg.secret ? makePad('number', () => { buzz(15); blip(); }, c => { content = c; buzz([20, 60, 20]); blip(); if (grid) grid.done(); }) : null;
    if (pad && settings.grid) grid = makeGrid(wrap, 'number');
    const reveal = () => {
      revealed = true;
      buzz(10);
      env.querySelector('.paper').outerHTML = paperHTML(content.text);
      env.classList.add('open');
      setTimeout(() => env.classList.add('out'), 650);
      setTimeout(() => {
        env.classList.add('gone');
        const holder = $('.pred-obj', st);
        holder.insertAdjacentHTML('beforeend', paperHTML(content.text, 'big'));
        const big = holder.lastElementChild;
        requestAnimationFrame(() => requestAnimationFrame(() => big.classList.add('in')));
      }, 1600);
    };
    gestures(wrap, {
      tap: e => {
        if (revealed) return;
        if (!content) { const [x, y] = relTo(wrap, e); pad.feed(x, y); return; }
        const r = env.getBoundingClientRect();
        if (e.clientX >= r.left - 20 && e.clientX <= r.right + 20 && e.clientY >= r.top - 20 && e.clientY <= r.bottom + 20) reveal();
      },
      long: () => { if (!pad || revealed) return; pad.reset(); content = null; buzz([10, 40, 10, 40, 10]); if (grid) grid.reset(); }
    });
  });
}
SUBS.env = {
  title: 'Enveloppe scellée', tab: 'tours',
  build(root) {
    const st = Object.assign({ source: 'now', text: '', stamp: settings.stamp }, store.get('setup.env', {}));
    root.innerHTML = `<div class="setup">
      <p class="hint">Une enveloppe cachetée s'affiche avec une heure passée. Le spectateur la touche : elle s'ouvre et le papier révèle votre prédiction.</p>
      <div class="field"><span class="lbl">Quand choisir le nombre ou le mot</span>${seg('source', [['now', 'Maintenant'], ['live', 'En secret, pendant le tour']], st.source)}</div>
      <div class="field" data-w="now"><input class="input" id="env-text" maxlength="40" placeholder="ex. 1089, un prénom, un mot…" value="${esc(st.text)}" autocomplete="off"></div>
      <div class="hint" data-w="live"><b>Clavier invisible façon téléphone</b> sur tout l'écran : chiffres, puis la case en bas à droite pour valider (en bas à gauche = effacer). Appui long = recommencer.${padDiagrams('number')}</div>
      <div class="field"><span class="lbl">Horodatage affiché (preuve que c'était prévu)</span>
        <select class="input" id="env-stamp">${STAMPS.map(([v, l]) => `<option value="${v}"${v === st.stamp ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <p class="err" hidden></p>
      ${launchBtn('Lancer le tour')}</div>`;
    const save = () => store.set('setup.env', st);
    const refresh = () => $$('[data-w]', root).forEach(el => { el.hidden = el.dataset.w !== st.source; });
    bindSeg(root, (k, v) => { st[k] = v; save(); refresh(); });
    $('#env-text', root).addEventListener('input', e => { st.text = e.target.value; save(); });
    $('#env-stamp', root).addEventListener('change', e => { st.stamp = e.target.value; save(); });
    $('[data-launch]', root).addEventListener('click', () => {
      const err = $('.err', root);
      if (st.source === 'now' && !st.text.trim()) { err.textContent = 'Écrivez le nombre ou le mot à faire apparaître.'; err.hidden = false; return; }
      err.hidden = true;
      launchEnvelope({ content: { type: 'note', text: st.text.trim() }, secret: st.source === 'live' ? 'number' : null, stamp: st.stamp });
    });
    refresh();
  }
};

/* ================= Écran noir ================= */
// cfg = { content: card | {type:'note', text} | null, secret: 'card' | 'number' | null, mode: 'scratch' | 'ghost' }
function launchBlack(cfg) {
  openStage(st => {
    const holder = document.createElement('div');
    holder.className = 'bk-content';
    st.appendChild(holder);
    let ready = false, done = false, grid = null;
    const setContent = c => {
      holder.innerHTML = c.type === 'note' ? paperHTML(c.text, 'bk-paper') : `<div class="bk-card"><img src="${cardSrc(c)}" alt="${cardName(c)}"></div>`;
    };
    const ghost = cfg.mode === 'ghost';
    if (ghost) holder.style.opacity = '0';
    let canvas = null, ctx = null, brush = null, W = 0, H = 0, R = 0, dpr = 1, last = null, lastCheck = 0, dist = 0;
    const paint = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight; R = Math.max(26, Math.min(W, H) * 0.085);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      brush = document.createElement('canvas');
      brush.width = brush.height = Math.ceil(R * 2 * dpr);
      const b = brush.getContext('2d'), c = brush.width / 2;
      const g = b.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(.55, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = g; b.fillRect(0, 0, brush.width, brush.height);
    };
    if (!ghost) {
      canvas = document.createElement('canvas');
      canvas.className = 'bk-canvas';
      st.appendChild(canvas);
      paint();
    }
    const surface = document.createElement('div');
    surface.style.cssText = 'position:absolute;inset:0;z-index:5';
    st.appendChild(surface);
    const onResize = () => { if (!ghost && !done) paint(); };
    window.addEventListener('resize', onResize);
    const finish = () => {
      done = true;
      buzz(30);
      if (canvas) canvas.style.opacity = '0';
      holder.style.transition = 'opacity .8s ease, filter .8s ease';
      holder.style.opacity = '1'; holder.style.filter = 'none';
      holder.classList.add('glow');
    };
    const clearedRatio = () => {
      const target = holder.firstElementChild;
      if (!target) return 0;
      const r = target.getBoundingClientRect();
      const x = Math.max(0, Math.floor(r.left * dpr)), y = Math.max(0, Math.floor(r.top * dpr));
      const w = Math.min(canvas.width - x, Math.ceil(r.width * dpr)), h = Math.min(canvas.height - y, Math.ceil(r.height * dpr));
      if (w <= 0 || h <= 0) return 0;
      const data = ctx.getImageData(x, y, w, h).data;
      let clear = 0, total = 0;
      for (let i = 3; i < data.length; i += 4 * 9) { total++; if (data[i] < 90) clear++; }
      return clear / total;
    };
    const rub = e => {
      const x = e.clientX, y = e.clientY;
      if (ghost) {
        if (last) dist += Math.hypot(x - last.x, y - last.y);
        last = { x, y };
        const p = Math.min(1, dist / (3.2 * (window.innerWidth + window.innerHeight)));
        holder.style.opacity = String(Math.pow(p, 1.5));
        holder.style.filter = `blur(${((1 - p) * 10).toFixed(1)}px)`;
        if (p >= 1) finish();
        return;
      }
      ctx.globalCompositeOperation = 'destination-out';
      const from = last || { x, y };
      const n = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / (R * 0.3)));
      for (let i = 1; i <= n; i++) {
        const px = from.x + (x - from.x) * i / n, py = from.y + (y - from.y) * i / n;
        ctx.drawImage(brush, px - R, py - R, R * 2, R * 2);
      }
      last = { x, y };
      const t = performance.now();
      if (t - lastCheck > 350) { lastCheck = t; if (clearedRatio() > 0.6) finish(); }
    };
    let pad = null;
    if (cfg.secret) {
      pad = makePad(cfg.secret, () => { buzz(15); blip(); if (grid) grid.step(); }, c => { setContent(c); ready = true; buzz([20, 60, 20]); blip(); if (grid) grid.done(); });
      if (settings.grid) grid = makeGrid(surface, cfg.secret);
    } else { setContent(cfg.content); ready = true; }
    gestures(surface, {
      tap: e => { if (!ready) { const [x, y] = relTo(surface, e); pad.feed(x, y); } },
      long: () => { if (!ready && pad) { pad.reset(); buzz([10, 40, 10, 40, 10]); if (grid) grid.reset(); } },
      down: e => { last = null; if (ready && !done) rub(e); },
      move: e => { if (ready && !done) rub(e); },
      up: () => { last = null; }
    });
    return () => window.removeEventListener('resize', onResize);
  });
}
SUBS.black = {
  title: 'Écran noir', tab: 'tours',
  build(root) {
    const st = Object.assign({ type: 'card', source: 'now', text: '', mode: 'scratch' }, store.get('setup.black', {}));
    root.innerHTML = `<div class="setup">
      <p class="hint">L'écran devient noir, comme éteint. Le spectateur le frotte : la carte apparaît sous ses doigts.</p>
      <div class="field"><span class="lbl">Ce qui apparaît</span>${seg('type', [['card', 'Une carte'], ['note', 'Un nombre ou un mot']], st.type)}</div>
      <div class="field"><span class="lbl">Quand le choisir</span>${seg('source', [['now', 'Maintenant'], ['live', 'En secret, pendant le tour']], st.source)}</div>
      <div data-w="card now">${secretCardHTML()}</div>
      <div class="field" data-w="note now"><input class="input" id="bk-text" maxlength="40" placeholder="ex. 1089" value="${esc(st.text)}" autocomplete="off"></div>
      <div class="hint" data-w="card live"><b>Deux touches à l'aveugle</b> sur l'écran noir : 1) la valeur, 2) la couleur. Une vibration confirme. Appui long = recommencer.${padDiagrams('card')}</div>
      <div class="hint" data-w="note live"><b>Clavier invisible</b> : chiffres puis la case en bas à droite pour valider.${padDiagrams('number')}</div>
      <div class="field"><span class="lbl">Effet</span>${seg('mode', [['scratch', 'Gratter : sous le doigt'], ['ghost', 'Fantôme : se matérialise']], st.mode)}</div>
      <p class="err" hidden></p>
      ${launchBtn('Lancer le tour')}
      <details class="howto"><summary>Comment le présenter</summary><ol>
        <li>Lancez le tour : l'écran devient entièrement noir.</li>
        <li>Saisie secrète : faites vos deux touches, une vibration confirme.</li>
        <li>Tendez le téléphone : « frottez l'écran pour réveiller la carte ».</li>
        <li>La carte apparaît sous ses doigts puis s'illumine.</li></ol>
        <ul><li>Baissez la luminosité et passez en mode avion pour éviter les notifications.</li></ul></details></div>`;
    const save = () => store.set('setup.black', st);
    const refresh = () => $$('[data-w]', root).forEach(el => { const [t, s] = el.dataset.w.split(' '); el.hidden = t !== st.type || s !== st.source; });
    bindSeg(root, (k, v) => { st[k] = v; save(); refresh(); });
    $('#bk-text', root).addEventListener('input', e => { st.text = e.target.value; save(); });
    $('[data-launch]', root).addEventListener('click', () => {
      const err = $('.err', root);
      const secret = st.source === 'live' ? (st.type === 'card' ? 'card' : 'number') : null;
      let content = null;
      if (!secret) {
        if (st.type === 'card') content = settings.card;
        else if (st.text.trim()) content = { type: 'note', text: st.text.trim() };
        else { err.textContent = 'Écrivez le nombre ou le mot à faire apparaître.'; err.hidden = false; return; }
      }
      err.hidden = true;
      launchBlack({ content, secret, mode: st.mode });
    });
    refresh();
  }
};

/* ================= Force numérique ================= */
SUBS.force = {
  title: 'Force numérique', tab: 'tours',
  build(root) {
    const st = Object.assign({ style: 'spread' }, store.get('setup.force', {}));
    root.innerHTML = `<div class="setup">
      <p class="hint">Le spectateur choisit « librement » une carte sur l'écran… c'est toujours <b>votre carte secrète</b>. Enchaînez ensuite avec une révélation.</p>
      ${secretCardHTML()}
      <div class="field"><span class="lbl">Style de choix</span>${seg('style', [['spread', 'Étalement du jeu'], ['stop', 'Stop ! (défilement)']], st.style)}</div>
      ${launchBtn('Lancer le tour')}
      <details class="howto"><summary>Comment le présenter</summary><ol>
        <li><b>Étalement</b> : le spectateur fait glisser son doigt sur le jeu étalé et lâche où il veut.</li>
        <li><b>Stop</b> : les cartes défilent très vite, il dit « stop » quand il veut (ou touche le bouton).</li>
        <li>Il mémorise sa carte, elle retourne dans le jeu.</li>
        <li>Révélez-la : avec l'effet choisi dans Réglages, l'écran noir, ou une vraie carte cachée dans votre poche.</li></ol>
        <ul><li>Astuce : glissez dans votre portefeuille la même carte physique avant le tour. Après la révélation à l'écran, sortez-la.</li></ul></details></div>`;
    bindSeg(root, (k, v) => { st[k] = v; store.set('setup.force', st); });
    $('[data-launch]', root).addEventListener('click', () => launchForce(st.style));
  }
};
function launchForce(style) {
  const forced = settings.card;
  openStage(st => {
    let timer = 0;
    const others = shuffle(fullDeck().filter(c => !sameCard(c, forced)));
    const deckHTML = `<div class="deck" style="transform:none">${[5, 4, 3, 2, 1].map(k => `<i style="transform:translate(${k * .6}px,${k * 2}px)"></i>`).join('')}<img src="${backSrc()}" alt=""></div>`;
    const lost = () => {
      st.className = 'stage velvet';
      st.innerHTML = `<div class="trick">${trickHead('Votre carte est perdue dans le jeu', 'Pourtant, je vais la retrouver.')}
        <div class="grow">${deckHTML}</div>
        <div class="foot"><button class="pill" type="button" data-rv><svg><use href="#i-show"/></svg>Révéler</button><button class="btn ghost" type="button" data-again>Recommencer</button></div></div>`;
      $('[data-rv]', st).addEventListener('click', () => revealScene(stage, forced, { onAgain: build }), { once: true });
      $('[data-again]', st).addEventListener('click', build, { once: true });
    };
    const afterPick = async () => {
      clearInterval(timer);
      st.className = 'stage velvet';
      st.innerHTML = `<div class="trick">${trickHead('Votre carte', 'Mémorisez-la bien, puis touchez l\'écran.')}
        <div class="grow"><div class="rv-zone"><div class="rv-card"><img class="rv-face" src="${cardSrc(forced)}" alt="${cardName(forced)}"><img class="rv-back" src="${backSrc()}" alt=""></div></div></div></div>`;
      const cardEl = $('.rv-card', st), trick = $('.trick', st);
      await decode($('.rv-face', st));
      buzz(15);
      await A(cardEl, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], { duration: 800, easing: 'cubic-bezier(.2,.7,.2,1)' });
      trick.addEventListener('click', async () => {
        $('h2', trick).textContent = 'Elle retourne dans le jeu…';
        $('p', trick).textContent = 'Personne ne sait où elle est.';
        await A(cardEl, [{ transform: 'rotateY(180deg) translateY(0px) scale(1)', opacity: 1 }, { transform: 'rotateY(360deg) translateY(60vh) scale(.6)', opacity: 0 }], { duration: 900, easing: 'ease-in' });
        lost();
      }, { once: true });
    };
    const build = () => {
      clearInterval(timer);
      st.className = 'stage velvet';
      if (style === 'stop') {
        st.innerHTML = `<div class="trick">${trickHead('Dites stop !', 'Les cartes défilent. Arrêtez-les quand vous voulez.')}
          <div class="grow"><div class="flash-card"><img src="${backSrc()}" alt=""></div></div>
          <div class="foot"><button class="pill" type="button" data-stop style="min-width:200px">Stop</button></div></div>`;
        const img = $('.flash-card img', st);
        let i = 0;
        timer = setInterval(() => { img.src = cardSrc(others[i++ % others.length]); }, 85);
        $('[data-stop]', st).addEventListener('click', () => { clearInterval(timer); img.src = cardSrc(forced); buzz(20); setTimeout(afterPick, 900); }, { once: true });
        return;
      }
      const N = 40;
      st.innerHTML = `<div class="trick">${trickHead('Choisissez une carte', 'Glissez le doigt sur le jeu et lâchez sur la carte de votre choix.')}
        <div class="grow"><div class="spread"></div></div></div>`;
      const sp = $('.spread', st);
      const cw = Math.min(window.innerWidth * .18, 80);
      sp.style.setProperty('--cw', cw + 'px');
      const imgs = [];
      for (let k = 0; k < N; k++) {
        const im = document.createElement('img');
        im.src = backSrc(); im.alt = '';
        im.style.left = `calc(50% - ${cw / 2}px)`;
        im.dataset.a = String(-30 + 60 * k / (N - 1));
        im.style.transform = `rotate(${im.dataset.a}deg)`;
        sp.appendChild(im); imgs.push(im);
      }
      let lifted = -1, picked = false;
      const lift = e => {
        if (picked) return;
        const r = sp.getBoundingClientRect();
        const k = Math.max(0, Math.min(N - 1, Math.round((e.clientX - r.left - r.width * .08) / (r.width * .84) * (N - 1))));
        if (k === lifted) return;
        if (lifted >= 0) { imgs[lifted].classList.remove('lift'); imgs[lifted].style.transform = `rotate(${imgs[lifted].dataset.a}deg)`; }
        lifted = k;
        imgs[k].classList.add('lift');
        imgs[k].style.transform = `rotate(${imgs[k].dataset.a}deg) translateY(-26px)`;
        buzz(4);
      };
      gestures(sp, {
        down: lift, move: lift,
        up: async () => {
          if (picked || lifted < 0) return;
          picked = true;
          const im = imgs[lifted];
          await A(im, [{ transform: `rotate(${im.dataset.a}deg) translateY(-26px)`, opacity: 1 }, { transform: 'rotate(0deg) translateY(-60vh) scale(1.4)', opacity: 0 }], { duration: 500, easing: 'ease-in' });
          afterPick();
        }
      });
    };
    build();
    return () => clearInterval(timer);
  });
}

/* ================= Les colonnes magiques (21 / 27 cartes) ================= */
SUBS.columns = {
  title: 'Les colonnes magiques', tab: 'tours',
  build(root) {
    const st = Object.assign({ mode: '21' }, store.get('setup.columns', {}));
    root.innerHTML = `<div class="setup">
      <p class="hint">Le spectateur pense à une carte parmi celles distribuées en 3 colonnes et dit seulement dans quelle colonne elle est, trois fois. L'appli la retrouve.</p>
      <div class="field"><span class="lbl">Version</span>${seg('mode', [['21', '21 cartes (classique)'], ['27', '27 cartes + nombre choisi']], st.mode)}</div>
      ${launchBtn('Lancer le tour')}
      <details class="howto"><summary>Le secret</summary><ul>
        <li><b>21 cartes</b> (analysé par Gergonne en 1813) : on distribue en 3 colonnes de 7, on ramasse en mettant la colonne choisie au milieu, trois fois. La carte finit toujours 11e.</li>
        <li><b>27 cartes</b> : le spectateur choisit aussi un nombre de 1 à 27. On écrit ce nombre moins 1 en base 3 ; chaque chiffre dit où ranger la colonne choisie (0 = dessus, 1 = milieu, 2 = dessous), en commençant par le chiffre des unités. Sa carte arrive exactement à la position de son nombre.</li>
        <li>L'appli fait les calculs pour vous, et vous pouvez le refaire avec un vrai jeu.</li></ul></details></div>`;
    bindSeg(root, (k, v) => { st[k] = v; store.set('setup.columns', st); });
    $('[data-launch]', root).addEventListener('click', () => launchColumns(+st.mode));
  }
};
function launchColumns(size) {
  openStage(st => {
    const start = () => {
      st.className = 'stage velvet';
      if (size === 27) {
        st.innerHTML = `<div class="trick">${trickHead('Choisissez un nombre', 'Entre 1 et 27. Il comptera pour la fin.')}
          <div class="grow"><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;width:100%;max-width:380px">
          ${Array.from({ length: 27 }, (_, i) => `<button class="btn small" type="button" data-n="${i + 1}" style="padding:0">${i + 1}</button>`).join('')}</div></div></div>`;
        $$('[data-n]', st).forEach(b => b.addEventListener('click', () => deal(+b.dataset.n)));
      } else deal(0);
    };
    const deal = N => {
      let deck = shuffle(fullDeck()).slice(0, size), round = 0, cands = null;
      const digits = N ? [(N - 1) % 3, Math.floor((N - 1) / 3) % 3, Math.floor((N - 1) / 9) % 3] : [1, 1, 1];
      const rows = size / 3;
      const render = () => {
        const cols = [0, 1, 2].map(c => deck.filter((_, i) => i % 3 === c));
        st.innerHTML = `<div class="trick">${trickHead(round === 0 ? 'Pensez à une carte' : 'Et maintenant ?', round === 0 ? 'Ne dites rien. Touchez seulement la colonne où elle se trouve.' : 'Dans quelle colonne est votre carte ?')}
          <div class="grow"><div class="cols">${cols.map((_, c) => `<button class="col" type="button" data-c="${c}"><div class="stack"></div></button>`).join('')}</div></div>
          <p class="kr-meta">Tour ${round + 1} / 3</p></div>`;
        const grow = $('.grow', st), colEls = $$('.col', st);
        const cw = colEls[0].clientWidth - 12, ch = cw * 1.4;
        const off = Math.max(14, Math.min(ch * .3, (grow.clientHeight - ch - 16) / (rows - 1)));
        colEls.forEach((el, c) => {
          const stack = $('.stack', el);
          stack.style.height = `${ch + off * (rows - 1)}px`;
          cols[c].forEach((card, k) => {
            const im = document.createElement('img');
            im.src = cardSrc(card); im.alt = cardName(card);
            im.style.top = `${k * off}px`;
            im.style.animationDelay = `${(k * 3 + c) * 28}ms`;
            stack.appendChild(im);
          });
          el.addEventListener('click', () => pick(c, cols), { once: true });
        });
      };
      const pick = async (c, cols) => {
        $$('.col', st).forEach((el, k) => { el.classList.toggle('hl', k === c); el.disabled = true; });
        buzz(10);
        cands = cands ? cands.filter(x => cols[c].some(y => sameCard(x, y))) : cols[c];
        if (!cands.length) cands = cols[c]; // le spectateur a changé de carte : on repart de cette colonne
        await wait(380);
        const order = [0, 1, 2].filter(k => k !== c);
        order.splice(digits[round], 0, c);
        deck = order.flatMap(k => cols[k]);
        round++;
        if (round < 3) { render(); return; }
        const target = size === 21 ? deck[10] : deck[N - 1];
        if (size === 21) finalReveal(target);
        else countTo(N, target);
      };
      const countTo = async (n, target) => {
        st.innerHTML = `<div class="trick">${trickHead(`Votre nombre : ${n}`, 'Comptons les cartes jusqu\'à votre nombre…')}<div class="grow"><div class="count-row"></div></div></div>`;
        const row = $('.count-row', st);
        for (let i = 1; i <= n; i++) {
          const d = document.createElement('div');
          d.className = 'c';
          d.innerHTML = `<img src="${backSrc()}" alt=""><b>${i}</b>`;
          row.appendChild(d);
          buzz(3);
          await wait(i === n ? 600 : 160);
        }
        const lastC = row.lastElementChild;
        lastC.classList.add('hit');
        lastC.firstElementChild.src = cardSrc(target);
        $('h2', st).textContent = `${n}e carte…`;
        await wait(1300);
        finalReveal(target);
      };
      const finalReveal = target => revealScene(stage, target, { title: 'Votre carte est…', sub: size === 21 ? 'Retrouvée !' : 'Exactement à votre nombre !', onAgain: start });
      render();
    };
    start();
  });
}

/* ================= La carte disparue ================= */
SUBS.vanish = {
  title: 'La carte disparue', tab: 'tours',
  build(root) {
    root.innerHTML = `<div class="setup">
      <p class="hint">Six figures. Le spectateur en choisit une en pensée. Vous la faites disparaître : il n'en reste que cinq… et la sienne n'y est plus.</p>
      ${launchBtn('Lancer le tour')}
      <details class="howto"><summary>Le secret</summary><ul>
        <li>Les cinq cartes finales sont <b>toutes différentes</b> des six premières : même valeur et même couleur (rouge/noire), mais l'autre enseigne. Le Roi de cœur devient Roi de carreau, etc.</li>
        <li>Le spectateur ne retient que <b>sa</b> carte, donc il ne remarque pas que les autres ont changé. C'est un classique, souvent appelé « Princess card trick ».</li>
        <li>Une seule fois par personne, et parlez pendant le changement.</li></ul></details></div>`;
    $('[data-launch]', root).addEventListener('click', launchVanish);
  }
};
function launchVanish() {
  openStage(st => {
    let fx = null;
    const run = async () => {
      if (fx) fx.stop();
      const six = shuffle([10, 11, 12].flatMap(rank => [{ rank, suit: Math.random() < .5 ? 'S' : 'C' }, { rank, suit: Math.random() < .5 ? 'H' : 'D' }]));
      const twin = { S: 'C', C: 'S', H: 'D', D: 'H' };
      const five = shuffle(six.map(c => ({ rank: c.rank, suit: twin[c.suit] }))).slice(0, 5);
      five.forEach(c => { new Image().src = cardSrc(c); });
      st.className = 'stage velvet';
      st.innerHTML = `<div class="trick">${trickHead('Pensez à une de ces cartes', 'Ne dites rien, gravez-la dans votre mémoire.')}
        <div class="grow"><div class="fan"></div></div><div class="foot"><button class="pill" type="button" data-ok>C'est fait</button></div></div><canvas class="rv-fx"></canvas>`;
      const fan = $('.fan', st);
      fx = makeFX($('.rv-fx', st));
      const lay = (cards, spreadDeg) => {
        fan.innerHTML = '';
        return cards.map((c, i) => {
          const im = document.createElement('img');
          im.src = cardSrc(c); im.alt = cardName(c);
          const a = cards.length > 1 ? -spreadDeg / 2 + spreadDeg * i / (cards.length - 1) : 0;
          im.style.transform = 'rotate(0deg)';
          fan.appendChild(im);
          requestAnimationFrame(() => requestAnimationFrame(() => { im.style.transform = `rotate(${a}deg)`; }));
          return im;
        });
      };
      const imgs = lay(six, 46);
      await new Promise(r => $('[data-ok]', st).addEventListener('click', r, { once: true }));
      $('.foot', st).innerHTML = '';
      $('h2', st).textContent = 'Je vais la faire disparaître…';
      $('.trick p', st).textContent = 'Regardez bien les cartes.';
      imgs.forEach(im => { im.style.transform = 'rotate(0deg)'; });
      await wait(800);
      imgs.forEach(im => { im.src = backSrc(); });
      const r = fan.getBoundingClientRect();
      fx.smoke({ left: r.left + r.width * .3, right: r.right - r.width * .3, top: r.top, bottom: r.bottom }, 30, 900);
      fx.sparks(r.left + r.width / 2, r.top + r.height * .55, 50, { speed: 5, g: .02, spread: 600 });
      buzz([10, 60, 10]);
      await wait(1700);
      lay(five, 40);
      await wait(900);
      $('h2', st).textContent = 'Votre carte a disparu !';
      $('.trick p', st).textContent = 'Il n\'en reste que cinq… et la vôtre n\'y est plus.';
      buzz([20, 50, 20]);
      $('.foot', st).innerHTML = '<button class="pill" type="button" data-again><svg><use href="#i-redo"/></svg>Recommencer</button>';
      $('[data-again]', st).addEventListener('click', run, { once: true });
    };
    run();
    return () => { if (fx) fx.stop(); };
  });
}

/* ================= Rouge ou noire (intuition) ================= */
SUBS.intuition = {
  title: 'Rouge ou noire', tab: 'tours',
  build(root) {
    const st = Object.assign({ n: '16' }, store.get('setup.intuition', {}));
    root.innerHTML = `<div class="setup">
      <p class="hint">Le spectateur trie des cartes face cachée, au hasard, en « rouges » et « noires ». On retourne tout : il ne s'est jamais trompé.</p>
      <div class="field"><span class="lbl">Nombre de cartes à trier</span>${seg('n', [['10', '10'], ['16', '16'], ['20', '20']], st.n)}</div>
      ${launchBtn('Lancer le tour')}
      <details class="howto"><summary>Présentation</summary><ul>
        <li>Inspiré du grand classique « Out of This World » de Paul Curry (1942).</li>
        <li>Insistez : « ne réfléchissez pas, suivez votre première impression ». Plus il hésite, plus l'effet est fort.</li>
        <li>Sur l'appli, le tri est toujours parfait. Avec un vrai jeu, la méthode est différente (jeu préparé).</li></ul></details></div>`;
    bindSeg(root, (k, v) => { st[k] = v; store.set('setup.intuition', st); });
    $('[data-launch]', root).addEventListener('click', () => launchIntuition(+st.n));
  }
};
function launchIntuition(total) {
  openStage(st => {
    let fx = null;
    const run = () => {
      if (fx) fx.stop();
      const deck = fullDeck();
      const reds = shuffle(deck.filter(c => isRed(c.suit))), blacks = shuffle(deck.filter(c => !isRed(c.suit)));
      const markR = reds.pop(), markB = blacks.pop();
      const placed = { r: [], b: [] };
      st.className = 'stage velvet';
      st.innerHTML = `<div class="trick">${trickHead('Rouge ou noire ?', 'Sans regarder, posez chaque carte du côté qui vous semble juste.')}
        <div class="grow"><div class="deal-src"><img src="${backSrc()}" alt=""></div>
        <div class="piles">
          <button class="pile" type="button" data-p="r"><span class="lbl2" style="color:#ff6b74">Rouges</span><span class="mark"><img src="${cardSrc(markR)}" alt="${cardName(markR)}"></span><span class="stack"></span><span class="n">0 carte</span></button>
          <button class="pile" type="button" data-p="b"><span class="lbl2">Noires</span><span class="mark"><img src="${cardSrc(markB)}" alt="${cardName(markB)}"></span><span class="stack"></span><span class="n">0 carte</span></button>
        </div></div><p class="kr-meta" id="left">${total} cartes à trier</p><div class="foot"></div></div>`;
      const left = $('#left', st);
      $$('.pile', st).forEach(p => p.addEventListener('click', () => {
        if (placed.r.length + placed.b.length >= total) return;
        const k = p.dataset.p;
        placed[k].push(k === 'r' ? reds.pop() : blacks.pop());
        const im = document.createElement('img');
        im.src = backSrc(); im.alt = '';
        im.style.cssText = `transform:translate(${rnd(-4, 4)}px,${-placed[k].length * 1.2}px) rotate(${rnd(-5, 5)}deg);animation:deal .3s ease both`;
        $('.stack', p).appendChild(im);
        $('.n', p).textContent = `${placed[k].length} carte${placed[k].length > 1 ? 's' : ''}`;
        buzz(6);
        const rest = total - placed.r.length - placed.b.length;
        left.textContent = rest ? `${rest} carte${rest > 1 ? 's' : ''} à trier` : 'Toutes les cartes sont triées.';
        if (!rest) {
          $('.deal-src', st).style.visibility = 'hidden';
          $('.foot', st).innerHTML = '<button class="pill" type="button" data-turn>Retourner les cartes</button>';
          $('[data-turn]', st).addEventListener('click', results, { once: true });
        }
      }));
      const results = async () => {
        st.innerHTML = `<div class="trick">${trickHead('Le verdict…', '')}
          <div class="grow"><p style="color:#ff6b74;font:600 14px var(--caps);letter-spacing:.1em">Côté rouges</p><div class="result-row" id="rr"></div>
          <p style="font:600 14px var(--caps);letter-spacing:.1em;margin-top:10px">Côté noires</p><div class="result-row" id="rb"></div></div><p id="verdict"></p><div class="foot"></div></div><canvas class="rv-fx"></canvas>`;
        fx = makeFX($('.rv-fx', st));
        for (const [id, list] of [['#rr', placed.r], ['#rb', placed.b]]) {
          for (const c of list) {
            const im = document.createElement('img');
            im.src = cardSrc(c); im.alt = cardName(c);
            $(id, st).appendChild(im);
            buzz(3);
            await wait(140);
          }
        }
        $('h2', st).textContent = `${total} sur ${total} !`;
        $('#verdict', st).textContent = 'Aucune erreur. Vous avez un don.';
        fx.sparks(window.innerWidth / 2, window.innerHeight * .4, 90, { speed: 8, g: .05 });
        buzz([20, 50, 20]);
        $('.foot', st).innerHTML = '<button class="pill" type="button" data-again><svg><use href="#i-redo"/></svg>Recommencer</button>';
        $('[data-again]', st).addEventListener('click', run, { once: true });
      };
    };
    run();
    return () => { if (fx) fx.stop(); };
  });
}

/* ================= Le compte de Kruskal ================= */
const krValue = c => c.rank <= 9 ? c.rank + 1 : 5;
function kruskalDeck() {
  // On cherche un mélange où les 10 nombres de départ mènent tous à la même carte : 100 % de réussite.
  let fallback = null;
  for (let t = 0; t < 400; t++) {
    const d = shuffle(fullDeck());
    const ends = new Set();
    for (let s = 1; s <= 10; s++) { let p = s - 1; while (p + krValue(d[p]) < 52) p += krValue(d[p]); ends.add(p); }
    if (ends.size === 1) return { deck: d, end: [...ends][0] };
    if (!fallback) fallback = d;
  }
  let p = 0;
  while (p + krValue(fallback[p]) < 52) p += krValue(fallback[p]);
  return { deck: fallback, end: p };
}
SUBS.kruskal = {
  title: 'Le compte de Kruskal', tab: 'tours',
  build(root) {
    root.innerHTML = `<div class="setup">
      <p class="hint">Vous posez une prédiction face cachée. Le spectateur pense à un nombre et compte en silence pendant que les cartes défilent. Sa dernière carte est votre prédiction.</p>
      ${launchBtn('Lancer le tour')}
      <details class="howto"><summary>Le secret</summary><ul>
        <li>Découvert par le physicien Martin Kruskal : quel que soit le nombre de départ, les chemins de comptage finissent presque toujours par se rejoindre, puis restent ensemble.</li>
        <li>L'appli choisit un ordre de cartes où <b>les 10 nombres possibles</b> mènent à la même carte : ça marche à tous les coups.</li>
        <li>Règle de comptage : As = 1, 2 à 10 = leur valeur, Valet, Dame, Roi = 5.</li>
        <li>Le spectateur doit compter juste : choisissez quelqu'un d'attentif et laissez-le aller à son rythme.</li></ul></details></div>`;
    $('[data-launch]', root).addEventListener('click', launchKruskal);
  }
};
function launchKruskal() {
  openStage(st => {
    const run = () => {
      const { deck, end } = kruskalDeck();
      const pred = deck[end];
      new Image().src = cardSrc(pred);
      st.className = 'stage velvet';
      st.innerHTML = `<div class="trick">${trickHead('Ma prédiction', 'Je la pose à l\'écart, face cachée. Personne n\'y touche.')}
        <div class="grow"><div class="kr-card"><img src="${backSrc()}" alt=""></div></div><div class="foot"><button class="pill" type="button" data-next>Continuer</button></div></div>`;
      $('[data-next]', st).addEventListener('click', rules, { once: true });
      function rules() {
        st.innerHTML = `<div class="trick">${trickHead('Pensez à un nombre de 1 à 10', '')}
          <div class="grow" style="max-width:420px;text-align:left"><p>Les cartes vont passer une par une. Comptez-les en silence jusqu'à votre nombre.</p>
          <p>La carte où vous tombez donne votre <b>nouveau nombre</b> : As = 1, 2 à 10 = leur valeur, figures = 5. Recomptez à partir de la suivante.</p>
          <p>Continuez jusqu'à la fin du jeu et retenez la <b>dernière carte</b> où vous tombez.</p></div>
          <div class="foot"><button class="pill" type="button" data-go2>Commencer</button></div></div>`;
        $('[data-go2]', st).addEventListener('click', dealing, { once: true });
      }
      function dealing() {
        let i = 0;
        st.innerHTML = `<div class="trick">${trickHead('Comptez en silence', 'Touchez l\'écran pour la carte suivante.')}
          <div class="grow"><div class="kr-card"><img src="${cardSrc(deck[0])}" alt="${cardName(deck[0])}"></div><p class="kr-meta" id="kr-n">Carte 1 / 52</p></div><div class="foot"></div></div>`;
        const tr = $('.trick', st), meta = $('#kr-n', st);
        let cur = $('.kr-card img', st);
        tr.addEventListener('click', e => {
          if (e.target.closest('button') || i >= 51) return;
          i++;
          const fresh = cur.cloneNode();
          fresh.src = cardSrc(deck[i]); fresh.alt = cardName(deck[i]);
          cur.replaceWith(fresh);
          cur = fresh;
          meta.textContent = `Carte ${i + 1} / 52`;
          buzz(3);
          if (i === 51) {
            $('h2', st).textContent = 'Retenez votre dernière carte';
            $('.trick p', st).textContent = 'C\'est la carte que le hasard vous a donnée.';
            $('.foot', st).innerHTML = '<button class="pill" type="button" data-rv><svg><use href="#i-show"/></svg>Révéler ma prédiction</button>';
            $('[data-rv]', st).addEventListener('click', () => revealScene(stage, pred, { title: 'Ma prédiction était…', sub: 'Votre dernière carte !', onAgain: run }), { once: true });
          }
        });
      }
    };
    run();
  });
}

/* ================= Calculatrice forcée ================= */
const NBSP = ' ';
function groupDigits(s) {
  if (/e/i.test(s)) return s.replace('.', ',');
  const neg = s[0] === '-';
  if (neg) s = s.slice(1);
  const [i, d] = s.split('.');
  return (neg ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) + (d !== undefined ? ',' + d : '');
}
function fmtNum(n) { return isFinite(n) ? groupDigits(Math.abs(n) >= 1e15 ? n.toExponential(5) : String(parseFloat(n.toPrecision(12)))) : 'Erreur'; }
function dateTarget(offsetMin) {
  const d = new Date(Date.now() + offsetMin * 60000), p = n => String(n).padStart(2, '0');
  return Number(p(d.getDate()) + p(d.getMonth() + 1) + p(d.getHours()) + p(d.getMinutes()));
}
// cfg = { target: 'fixed' | 'date' | null, value, offset, auto }
function launchCalc(cfg) {
  openStage(st => {
    st.classList.add('calc');
    const KEYS = [['AC', 'fn', 'ac'], ['±', 'fn', 'neg'], ['%', 'fn', 'pct'], ['÷', 'op', '/'],
      ['7', '', '7'], ['8', '', '8'], ['9', '', '9'], ['×', 'op', '*'],
      ['4', '', '4'], ['5', '', '5'], ['6', '', '6'], ['−', 'op', '-'],
      ['1', '', '1'], ['2', '', '2'], ['3', '', '3'], ['+', 'op', '+'],
      ['0', 'wide', '0'], [',', '', '.'], ['=', 'op', '=']];
    st.innerHTML = `<div class="calc-wrap"><div class="calc-disp"><span class="calc-dot"></span><span class="calc-num">0</span></div>`
      + `<div class="calc-keys">${KEYS.map(([l, c, k]) => `<button type="button" class="${c}" data-k="${k}">${l}</button>`).join('')}</div></div>`;
    const num = $('.calc-num', st), dot = $('.calc-dot', st), disp = $('.calc-disp', st);
    let acc = null, op = null, cur = '', justEq = false, count = 0;
    let armed = false, target = null, forced = null, fi = 0;
    const render = () => {
      const txt = cur !== '' ? groupDigits(cur) : fmtNum(acc == null ? 0 : acc);
      num.textContent = txt;
      const len = txt.replace(/\s/g, '').length;
      num.style.fontSize = len <= 6 ? '88px' : `${Math.max(34, Math.floor(88 * 6 / len))}px`;
      $$('.op', st).forEach(b => b.classList.toggle('act', !!op && cur === '' && b.dataset.k === op));
      dot.classList.toggle('on', armed && settings.dot);
    };
    const calc = (a, o, b) => o === '+' ? a + b : o === '-' ? a - b : o === '*' ? a * b : a / b;
    const arm = () => {
      if (!cfg.target) return;
      target = cfg.target === 'date' ? dateTarget(cfg.offset || 0) : Number(cfg.value);
      if (!isFinite(target)) return;
      armed = true; buzz(25); render();
    };
    const digit = d => {
      if (justEq) { acc = null; op = null; justEq = false; }
      if (cur === '') {
        count++;
        if (cfg.auto && count === cfg.auto && !armed) arm();
        forced = null; fi = 0;
        if (armed && op === '+' && acc != null && Number.isInteger(acc)) {
          const diff = target - acc;
          if (diff > 0 && Number.isInteger(diff)) forced = String(diff);
        }
      }
      if (forced) { if (fi < forced.length) cur += forced[fi++]; render(); return; }
      if (d === '.') { if (cur.includes('.')) return; cur = (cur || '0') + '.'; }
      else { if (cur.replace(/\D/g, '').length >= 9) return; cur = cur === '0' ? d : cur + d; }
      render();
    };
    const oper = o => {
      justEq = false;
      if (cur !== '') { const v = parseFloat(cur); acc = (op && acc != null) ? calc(acc, op, v) : v; cur = ''; }
      else if (acc == null) acc = 0;
      op = o; forced = null; render();
    };
    const equals = () => {
      let res;
      if (op && cur !== '' && acc != null) res = calc(acc, op, parseFloat(cur));
      else if (cur !== '') res = parseFloat(cur);
      else res = acc == null ? 0 : acc;
      if (armed) res = target; // filet de sécurité : le total affiché est toujours le nombre forcé
      acc = res; op = null; cur = ''; justEq = true; armed = false; forced = null; count = 0;
      render();
    };
    $('.calc-keys', st).addEventListener('click', e => {
      const b = e.target.closest('button[data-k]');
      if (!b) return;
      const k = b.dataset.k;
      if (/^[0-9.]$/.test(k)) digit(k);
      else if (k === '=') equals();
      else if ('+-*/'.includes(k)) oper(k);
      else if (k === 'ac') { acc = null; op = null; cur = ''; justEq = false; forced = null; count = 0; render(); }
      else if (k === 'neg') { if (cur !== '') cur = cur[0] === '-' ? cur.slice(1) : '-' + cur; else if (acc != null) acc = -acc; render(); }
      else if (k === 'pct') { if (cur !== '') cur = String(parseFloat(cur) / 100); else if (acc != null) acc /= 100; render(); }
    });
    let lt = 0;
    disp.addEventListener('pointerdown', () => { lt = setTimeout(() => { if (armed) { armed = false; buzz([10, 40, 10]); render(); } else arm(); }, 650); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => disp.addEventListener(t, () => clearTimeout(lt)));
    render();
  });
}
SUBS.calc = {
  title: 'Calculatrice forcée', tab: 'tours',
  build(root) {
    const st = Object.assign({ target: 'fixed', value: '', offset: 1, auto: 0 }, store.get('setup.calc', {}));
    root.innerHTML = `<div class="setup">
      <p class="hint">Une vraie calculatrice, au look de celle d'un téléphone. Les spectateurs additionnent des nombres au hasard… et le total est <b>votre prédiction</b>.</p>
      <div class="field"><span class="lbl">Nombre à faire apparaître</span>${seg('target', [['fixed', 'Un nombre choisi'], ['date', 'Date et heure du moment']], st.target)}</div>
      <div class="field" data-t="fixed"><input class="input" id="calc-value" inputmode="numeric" maxlength="12" placeholder="ex. 1089, une année, un numéro…" value="${esc(st.value)}"></div>
      <div class="field" data-t="date"><span class="lbl">Format JJMMHHmm. Décalage pour l'heure de la révélation</span>
        <select class="input" id="calc-offset">${[0, 1, 2, 3, 5].map(m => `<option value="${m}"${m === st.offset ? ' selected' : ''}>+${m} min</option>`).join('')}</select></div>
      <div class="field"><span class="lbl">Armement du forçage</span>
        <select class="input" id="calc-auto">${[[0, 'Manuel : appui long sur l\'affichage'], [2, 'Automatique au 2e nombre'], [3, 'Automatique au 3e nombre'], [4, 'Automatique au 4e nombre'], [5, 'Automatique au 5e nombre']]
          .map(([v, l]) => `<option value="${v}"${v === st.auto ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <p class="err" hidden></p>
      ${launchBtn('Lancer la calculatrice')}
      <details class="howto"><summary>Comment ça marche</summary><ol>
        <li>Faites taper un nombre à 3 chiffres par un spectateur, puis <b>+</b>. Un deuxième, puis <b>+</b>…</li>
        <li>Juste avant le dernier nombre, <b>appui long sur l'affichage</b> (ou armement automatique). Un point minuscule apparaît en haut à gauche.</li>
        <li>Quelles que soient les touches tapées ensuite, la calculatrice tape le nombre qui manque. Faites-le taper vite, « sans réfléchir ».</li>
        <li>Il appuie sur <b>=</b> : le total est votre prédiction. Le calcul est réellement juste.</li></ol></details></div>`;
    const refresh = () => $$('[data-t]', root).forEach(el => { el.hidden = el.dataset.t !== st.target; });
    const save = () => store.set('setup.calc', st);
    bindSeg(root, (k, v) => { st[k] = v; save(); refresh(); });
    $('#calc-value', root).addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); st.value = e.target.value; save(); });
    $('#calc-offset', root).addEventListener('change', e => { st.offset = +e.target.value; save(); });
    $('#calc-auto', root).addEventListener('change', e => { st.auto = +e.target.value; save(); });
    $('[data-launch]', root).addEventListener('click', () => {
      const err = $('.err', root);
      if (st.target === 'fixed' && !/^\d{1,12}$/.test(st.value)) { err.textContent = 'Indiquez le nombre à forcer.'; err.hidden = false; return; }
      err.hidden = true;
      launchCalc({ target: st.target, value: st.value, offset: st.offset, auto: st.auto });
    });
    refresh();
  }
};

/* ================= Lecture de pensée ================= */
SUBS.binary = {
  title: 'Lecture de pensée', tab: 'tours',
  build(root) {
    let order = [], idx = 0, total = 0, timer = 0;
    const intro = () => {
      root.innerHTML = `<div class="bin"><h3>Pensez à un nombre entre 1 et 63</h3>
        <p>Ne le dites à personne. Je vais vous montrer 6 cartes : dites-moi seulement s'il y figure.</p>
        <button class="btn gold" type="button" data-start>Commencer</button>
        <details class="howto" style="text-align:left"><summary>Le secret</summary><ul>
        <li>Chaque carte correspond à une puissance de 2 : 1, 2, 4, 8, 16, 32. Un nombre figure sur une carte si cette puissance fait partie de sa décomposition.</li>
        <li>L'appli additionne pour vous. Avec des cartes papier rangées dans l'ordre, on additionne le premier nombre de chaque carte « oui ».</li>
        <li>Ici, les cartes et les nombres sont mélangés à chaque fois : impossible de deviner le principe.</li></ul></details></div>`;
      $('[data-start]', root).addEventListener('click', () => { order = shuffle([0, 1, 2, 3, 4, 5]); idx = 0; total = 0; step(); });
    };
    const step = () => {
      if (idx >= 6) { finale(); return; }
      const bit = order[idx];
      const nums = shuffle(Array.from({ length: 63 }, (_, i) => i + 1).filter(n => n & (1 << bit)));
      root.innerHTML = `<div class="bin"><p class="bin-step">Carte ${idx + 1} / 6</p>
        <div class="bin-card">${nums.map(n => `<span>${n}</span>`).join('')}</div>
        <div class="btn-row"><button class="btn" type="button" data-a="0">Il n'y est pas</button><button class="btn gold" type="button" data-a="1">Il y est</button></div></div>`;
      $$('[data-a]', root).forEach(b => b.addEventListener('click', () => { if (b.dataset.a === '1') total += 1 << bit; idx++; step(); }));
    };
    const finale = () => {
      root.innerHTML = `<div class="bin"><h3 class="pulse">Concentrez-vous sur votre nombre…</h3></div>`;
      timer = setTimeout(() => {
        root.innerHTML = `<div class="bin"><p>Vous pensez au…</p><div class="bin-reveal">${total || '?'}</div>
          ${total ? '' : '<p>Aucune carte ? Vous avez triché… ou pensé à 0.</p>'}
          <button class="btn" type="button" data-again>Recommencer</button></div>`;
        buzz(30);
        $('[data-again]', root).addEventListener('click', intro);
      }, 2200);
    };
    intro();
    return () => clearTimeout(timer);
  }
};

/* ================= Carré magique ================= */
const SQ_GROUPS = [
  ['Ligne 1', [0, 1, 2, 3]], ['Ligne 2', [4, 5, 6, 7]], ['Ligne 3', [8, 9, 10, 11]], ['Ligne 4', [12, 13, 14, 15]],
  ['Colonne 1', [0, 4, 8, 12]], ['Colonne 2', [1, 5, 9, 13]], ['Colonne 3', [2, 6, 10, 14]], ['Colonne 4', [3, 7, 11, 15]],
  ['Diagonale', [0, 5, 10, 15]], ['Autre diagonale', [3, 6, 9, 12]], ['Les 4 coins', [0, 3, 12, 15]], ['Le carré central', [5, 6, 9, 10]],
  ['Coin haut gauche', [0, 1, 4, 5]], ['Coin haut droit', [2, 3, 6, 7]], ['Coin bas gauche', [8, 9, 12, 13]], ['Coin bas droit', [10, 11, 14, 15]],
  ['Milieux haut et bas', [1, 2, 13, 14]], ['Milieux gauche et droite', [4, 7, 8, 11]]
];
const magicSquare = n => [n - 20, 1, 12, 7, 11, 8, n - 21, 2, 5, 10, 3, n - 18, 4, n - 19, 6, 9];
SUBS.square = {
  title: 'Carré magique', tab: 'tours',
  build(root) {
    root.innerHTML = `<div class="setup">
      <p class="hint">Le spectateur donne un nombre (son âge, l'année…). En quelques secondes, vous écrivez un carré où <b>18 combinaisons</b> donnent ce total.</p>
      <div class="row"><input class="input" id="sq-n" inputmode="numeric" maxlength="4" placeholder="Nombre (34 ou plus)"><button class="btn gold" type="button" id="sq-go" style="width:auto">Créer</button></div>
      <p class="err" hidden></p>
      <div class="sq" id="sq-grid"></div><div class="sq-lbl" id="sq-lbl"></div>
      <div class="btn-row" id="sq-actions" hidden><button class="btn" type="button" id="sq-check">Vérifier toutes les sommes</button></div>
      <details class="howto"><summary>Le faire à la main</summary>
        <ul><li>Apprenez ce carré de base. Les 4 cases dorées dépendent du nombre N :</li></ul>
        <div class="tpl">${['N−20', 1, 12, 7, 11, 8, 'N−21', 2, 5, 10, 3, 'N−18', 4, 'N−19', 6, 9].map(v => `<span class="${typeof v === 'string' ? 'v' : ''}">${v}</span>`).join('')}</div>
        <ul><li>C'est un carré magique classique de 1 à 16 où l'on remplace 13, 14, 15, 16 par N−21, N−20, N−19, N−18.</li>
        <li>Écrivez d'abord les nombres fixes, dans le désordre, en bavardant. Les 4 cases calculées en dernier.</li>
        <li>En dessous de 34, des nombres se répètent : demandez un nombre « entre 40 et 99 ».</li></ul></details></div>`;
    let timer = 0, timers = [];
    const grid = $('#sq-grid', root), lbl = $('#sq-lbl', root), err = $('.err', root);
    const stop = () => { clearInterval(timer); timer = 0; timers.forEach(clearTimeout); timers = []; $$('span', grid).forEach(s => s.classList.remove('hl')); };
    $('#sq-go', root).addEventListener('click', () => {
      stop();
      const n = parseInt($('#sq-n', root).value, 10);
      if (!(n >= 34 && n <= 9999)) { err.textContent = 'Choisissez un nombre entre 34 et 9999.'; err.hidden = false; return; }
      err.hidden = true;
      const vals = magicSquare(n), order = shuffle([...Array(16).keys()]);
      grid.innerHTML = vals.map(() => '<span></span>').join('');
      lbl.textContent = '';
      order.forEach((i, k) => timers.push(setTimeout(() => { const s = grid.children[i]; s.textContent = vals[i]; s.classList.add('in'); }, 120 * k)));
      timers.push(setTimeout(() => { lbl.textContent = `Total magique : ${n}`; $('#sq-actions', root).hidden = false; }, 120 * 16 + 200));
      grid.dataset.n = n;
    });
    $('#sq-check', root).addEventListener('click', () => {
      stop();
      const vals = magicSquare(+grid.dataset.n);
      let g = 0;
      const tick = () => {
        $$('span', grid).forEach(s => s.classList.remove('hl'));
        if (g >= SQ_GROUPS.length) { stop(); lbl.textContent = `18 façons d'obtenir ${grid.dataset.n} !`; return; }
        const [name, cells] = SQ_GROUPS[g++];
        cells.forEach(i => grid.children[i].classList.add('hl'));
        lbl.textContent = `${name} : ${cells.map(i => vals[i]).join(' + ')} = ${grid.dataset.n}`;
      };
      tick();
      timer = setInterval(tick, 1500);
    });
    return stop;
  }
};

/* ================= Routines de chiffres ================= */
const ROUTINES = [
  {
    id: '1089', num: '1089', title: 'Le nombre 1089', short: 'Trois calculs au hasard… et le résultat était scellé.',
    effect: 'Le spectateur invente un nombre, fait quelques calculs sur la calculatrice, et tombe sur le nombre scellé dans votre téléphone depuis des heures.',
    steps: [
      ['Montrez l\'enveloppe scellée (prédiction 1089, horodatée). Posez le téléphone à l\'écart.', 'J\'ai écrit quelque chose ce matin. Personne n\'y touche.'],
      ['Demandez un nombre à 3 chiffres dont le premier et le dernier chiffre sont différents. Exemple : 742.', 'Pensez à un nombre à trois chiffres, pas un nombre « miroir » comme 343. Un vrai nombre au hasard.'],
      ['Inversez-le (247) et soustrayez le plus petit du plus grand : 742 − 247 = 495.', null],
      ['Inversez ce résultat (594) et additionnez : 495 + 594 = 1089.', null],
      ['Faites ouvrir l\'enveloppe : 1089.', 'Ouvrez. Lisez à voix haute.']
    ],
    tip: 'Si la soustraction donne un nombre à 2 chiffres (ex. 99), faites-le écrire 099 : son inverse est 990, total 1089.',
    why: 'La soustraction donne toujours 99 × (écart entre le premier et le dernier chiffre) : 198, 297, 396, 495, 594, 693, 792 ou 891. Chacun, additionné à son inverse, fait 1089.',
    launch: [['env', 'Enveloppe scellée : 1089', '1089'], ['black', 'Écran noir : 1089', '1089'], ['calc0', 'Calculatrice normale']]
  },
  {
    id: 'elephant', num: 'D', title: 'L\'éléphant gris du Danemark', short: 'Un calcul, une lettre, un pays, un animal.',
    effect: 'Chacun pense librement à un nombre, un pays, un animal, une couleur. Votre prédiction les avait déjà tous.',
    steps: [
      ['Pensez à un nombre de 1 à 10. Multipliez-le par 9.', null],
      ['S\'il a deux chiffres, additionnez-les. Retirez 5.', 'Vous avez forcément un petit nombre, gardez-le en tête.'],
      ['Transformez-le en lettre : 1 = A, 2 = B, 3 = C…', null],
      ['Pensez à un pays qui commence par cette lettre.', null],
      ['Prenez la lettre suivante dans l\'alphabet et pensez à un animal qui commence par celle-ci.', null],
      ['Pensez à la couleur de cet animal. Faites ouvrir la prédiction.', 'Bizarre… il n\'y a pas d\'éléphants gris au Danemark !']
    ],
    tip: 'Si quelqu\'un dit Djibouti ou écureuil, restez souriant : « vous êtes le premier ce soir ». Faites-le en groupe : la majorité tombe juste.',
    why: 'Tout nombre de 1 à 10 multiplié par 9 a des chiffres dont la somme est 9. 9 − 5 = 4, donc D. Ensuite, la langue fait le reste : Danemark puis E comme éléphant sont de loin les réponses les plus fréquentes.',
    launch: [['env', 'Enveloppe : la prédiction', 'Un éléphant gris au Danemark'], ['black', 'Écran noir : la prédiction', 'Éléphant gris · Danemark']]
  },
  {
    id: '37', num: '37', title: 'Le mystère du 37', short: 'Un chiffre au choix, une division, toujours 37.',
    effect: 'Le spectateur choisit n\'importe quel chiffre et fait une division au hasard. Le résultat est le nombre scellé.',
    steps: [
      ['Choisissez un chiffre de 1 à 9, par exemple 5.', 'Votre chiffre préféré, celui qui vous ressemble.'],
      ['Écrivez-le trois fois pour faire un nombre : 555.', null],
      ['Additionnez les trois chiffres : 5 + 5 + 5 = 15.', null],
      ['Sur la calculatrice, divisez le grand nombre par cette somme : 555 ÷ 15 = 37.', null],
      ['Révélez la prédiction : 37.', null]
    ],
    tip: 'Enchaînez avec un deuxième spectateur qui prend un autre chiffre : même résultat, l\'effet double.',
    why: 'Un nombre comme 555 vaut 5 × 111, et 111 = 3 × 37. La somme des chiffres vaut 3 × 5. On divise donc (5 × 3 × 37) par (3 × 5) : il reste 37, quel que soit le chiffre.',
    launch: [['env', 'Enveloppe scellée : 37', '37'], ['calc0', 'Calculatrice normale']]
  },
  {
    id: 'birthday', num: 'J/M', title: 'L\'anniversaire deviné', short: 'Un calcul et vous annoncez sa date de naissance.',
    effect: 'Le spectateur fait un calcul secret avec sa date de naissance et vous dit un seul nombre. Vous annoncez son jour et son mois.',
    steps: [
      ['Prenez le jour de votre naissance. Multipliez-le par 20.', 'Pour le 14 juillet : 14 × 20 = 280.'],
      ['Ajoutez 3, puis multipliez par 5.', '283 × 5 = 1415.'],
      ['Ajoutez le numéro de votre mois de naissance. Donnez-moi le résultat.', '1415 + 7 = 1422.'],
      ['De tête, retirez 15 : 1422 − 15 = 1407. Les deux derniers chiffres sont le mois, le reste est le jour : 14/07.', null]
    ],
    tip: 'Ne dites jamais « retirez 15 » à voix haute : faites semblant de lire dans ses yeux pendant le calcul.',
    why: 'Le calcul vaut (jour × 20 + 3) × 5 + mois = jour × 100 + 15 + mois. En retirant 15, le jour se retrouve devant et le mois derrière.',
    tool: 'birthday'
  },
  {
    id: 'circled', num: '9', title: 'Le chiffre entouré', short: 'Il cache un chiffre, vous le retrouvez.',
    effect: 'Le spectateur fait un calcul, entoure un chiffre du résultat et vous dit les autres. Vous trouvez le chiffre entouré.',
    steps: [
      ['Écrivez un nombre à 4 chiffres, par exemple 3851. Mélangez ses chiffres pour en faire un autre : 1583.', null],
      ['Soustrayez le petit du grand : 3851 − 1583 = 2268.', null],
      ['Entourez un chiffre du résultat, mais pas un 0. Dites-moi les autres, dans n\'importe quel ordre.', 'Il entoure 6 et annonce 2, 2, 8.'],
      ['Additionnez les chiffres annoncés : 12. Le chiffre entouré est ce qui manque pour atteindre le multiple de 9 suivant : 18 − 12 = 6.', null]
    ],
    tip: 'Si les chiffres annoncés font déjà un multiple de 9, le chiffre entouré est 9 (c\'est pour cela qu\'on interdit le 0).',
    why: 'Un nombre et le même nombre aux chiffres mélangés ont le même reste quand on divise par 9. Leur différence est donc un multiple de 9, et la somme de ses chiffres aussi.',
    tool: 'circled'
  }
];
function routineSub(id) {
  const r = ROUTINES.find(x => x.id === id);
  if (!r) return null;
  return {
    title: r.title, tab: 'tours',
    build(body) {
      const launches = (r.launch || []).map(([, l], i) => `<button class="btn ${i === 0 ? 'gold' : 'ghost'}" type="button" data-l="${i}">${esc(l)}</button>`).join('');
      let tool = '';
      if (r.tool === 'birthday') tool = `<div class="tool-box"><span class="lbl">Décodeur (pour vous entraîner)</span><input class="input" id="tool-in" inputmode="numeric" maxlength="5" placeholder="Nombre annoncé, ex. 1422"><div class="out" id="tool-out"></div></div>`;
      if (r.tool === 'circled') tool = `<div class="tool-box"><span class="lbl">Décodeur (pour vous entraîner)</span><input class="input" id="tool-in" inputmode="numeric" maxlength="12" placeholder="Chiffres annoncés, ex. 228"><div class="out" id="tool-out"></div></div>`;
      body.innerHTML = `<article class="routine"><p class="effect">${esc(r.effect)}</p>
        ${launches ? `<div class="btn-row">${launches}</div>` : ''}
        <h3>Déroulé</h3><ol>${r.steps.map(([s, say]) => `<li>${esc(s)}${say ? `<span class="say">${esc(say)}</span>` : ''}</li>`).join('')}</ol>
        ${tool}
        <h3>Astuce de pro</h3><p>${esc(r.tip)}</p>
        <h3>Pourquoi ça marche</h3><p>${esc(r.why)}</p></article>`;
      $$('[data-l]', body).forEach(b => b.addEventListener('click', () => {
        const [k, , text] = r.launch[+b.dataset.l];
        if (k === 'env') launchEnvelope({ content: { type: 'note', text }, secret: null, stamp: settings.stamp });
        else if (k === 'black') launchBlack({ content: { type: 'note', text }, secret: null, mode: 'scratch' });
        else launchCalc({ target: null });
      }));
      const tin = $('#tool-in', body), tout = $('#tool-out', body);
      if (tin) tin.addEventListener('input', () => {
        const v = tin.value.replace(/\D/g, '');
        tin.value = v;
        if (!v) { tout.textContent = ''; return; }
        if (r.tool === 'birthday') {
          const x = +v - 15, d = Math.floor(x / 100), m = x % 100;
          const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
          tout.textContent = (d >= 1 && d <= 31 && m >= 1 && m <= 12) ? `${d === 1 ? '1er' : d} ${months[m - 1]}` : 'Calcul impossible : faites-le refaire.';
        } else {
          const sum = [...v].reduce((a, c) => a + +c, 0);
          tout.textContent = `Chiffre entouré : ${9 - (sum % 9)}`;
        }
      });
    }
  };
}

/* ================= Onglet Tours ================= */
const CARD_TRICKS = [
  { go: 'black', ic: 'back', title: 'Écran noir', short: 'Le spectateur frotte l\'écran éteint : la carte apparaît sous son doigt.' },
  { go: 'force', ic: 'back', title: 'Force numérique', short: 'Il choisit « librement » une carte à l\'écran : c\'est la vôtre.', isNew: true },
  { go: 'columns', ic: 'JS', title: 'Les colonnes magiques', short: '21 ou 27 cartes en 3 colonnes : la carte pensée est retrouvée.', isNew: true },
  { go: 'vanish', ic: 'KH', title: 'La carte disparue', short: 'Six figures, une pensée… et sa carte s\'évapore.', isNew: true },
  { go: 'intuition', ic: 'AD', title: 'Rouge ou noire', short: 'Il trie face cachée au hasard : zéro erreur.', isNew: true },
  { go: 'kruskal', ic: 'QS', title: 'Le compte de Kruskal', short: 'Un nombre pensé, un comptage… et votre prédiction.', isNew: true }
];
const NUM_TOOLS = [
  { go: 'env', num: '✉', title: 'Enveloppe scellée', short: 'Un nombre ou un mot prédit, horodaté, dans une enveloppe.' },
  { go: 'calc', num: '+', title: 'Calculatrice forcée', short: 'Des nombres au hasard, le total est votre prédiction.' },
  { go: 'binary', num: '63', title: 'Lecture de pensée', short: '6 cartes de nombres, l\'appli trouve le nombre pensé.' },
  { go: 'square', num: '4×4', title: 'Carré magique', short: 'Un nombre donné, 18 façons de l\'obtenir.' }
];
const itemHTML = (go, ic, title, short, isNew) => `<button class="item" type="button" data-go="${go}"><span class="ic">${ic}</span><span><b>${esc(title)}</b><small>${esc(short)}</small></span>${isNew ? '<span class="new">Nouveau</span>' : ''}</button>`;
function buildTours() {
  const icCard = code => `<img src="${code === 'back' ? backSrc() : `cards/${code}.webp`}" alt="">`;
  $('#tours-body').innerHTML = `
    <p class="section-lbl">Tours de cartes</p>
    <div class="list">${CARD_TRICKS.map(t => itemHTML(t.go, icCard(t.ic), t.title, t.short, t.isNew)).join('')}</div>
    <p class="section-lbl">Prédictions et chiffres</p>
    <div class="list">${NUM_TOOLS.map(t => itemHTML(t.go, esc(t.num), t.title, t.short)).join('')}</div>
    <p class="section-lbl">Routines (méthode + boniment)</p>
    <div class="list">${ROUTINES.map(r => itemHTML('r:' + r.id, esc(r.num), r.title, r.short)).join('')}</div>`;
}

/* ================= Onglet Plus ================= */
SUBS.train = {
  title: 'Entraînement', tab: 'plus',
  build(root) {
    let type = 'card', showGrid = true;
    root.innerHTML = `<div class="setup">
      ${seg('ttype', [['card', 'Carte'], ['number', 'Chiffres']], type)}
      <label class="trow"><span>Afficher la grille<small>Coupez-la quand vous la connaissez par cœur.</small></span><span class="sw"><input type="checkbox" id="tr-grid" checked><i></i></span></label>
      <div class="trainpad" id="tr-pad"></div>
      <div class="train-out" id="tr-out"><span class="lbl">Touchez la zone noire comme sur scène.</span></div></div>`;
    const padEl = $('#tr-pad', root), out = $('#tr-out', root);
    let pad, grid;
    const setup = () => {
      padEl.innerHTML = '';
      grid = showGrid ? makeGrid(padEl, type) : null;
      pad = makePad(type,
        () => { buzz(15); if (grid) grid.step(); if (type === 'number') out.innerHTML = `<span class="out">${esc(pad.digits) || '…'}</span>`; },
        c => {
          buzz([20, 60, 20]);
          out.innerHTML = c.type === 'note' ? `<span class="out">✓ ${esc(c.text)}</span>` : `<img src="${cardSrc(c)}" alt=""><span class="out">${cardName(c)}</span>`;
          setTimeout(() => { pad.reset(); if (grid) grid.reset(); }, 400);
        });
    };
    gestures(padEl, {
      tap: e => { const [x, y] = relTo(padEl, e); pad.feed(x, y); },
      long: () => { pad.reset(); if (grid) grid.reset(); buzz([10, 40, 10]); out.innerHTML = '<span class="lbl">Saisie effacée.</span>'; }
    });
    bindSeg(root, (k, v) => { type = v; setup(); out.innerHTML = '<span class="lbl">Touchez la zone noire comme sur scène.</span>'; });
    $('#tr-grid', root).addEventListener('change', e => { showGrid = e.target.checked; setup(); });
    setup();
  }
};
SUBS.prefs = {
  title: 'Réglages généraux', tab: 'plus',
  build(root) {
    root.innerHTML = `<div class="setup"><div class="rows">
      ${trow('vibrate', 'Vibrations', 'Confirme chaque touche secrète (Android ; l\'iPhone ne vibre pas depuis le web).')}
      ${trow('dot', 'Point de confirmation discret', 'Un point gris minuscule clignote en bas de l\'écran à chaque touche secrète.')}
      ${trow('grid', 'Grille visible pendant les tours', 'Pour répéter seulement. À couper avant un vrai public.')}
      ${trow('fullscreen', 'Mode plein écran', 'Cache les menus et la barre d\'onglets pendant les tours.')}
      ${trow('revealText', 'Texte de révélation', '« Votre carte était… » et « Incroyable ! »')}</div>
      <div class="field"><span class="lbl">Horodatage par défaut des enveloppes</span>
        <select class="input" id="set-stamp">${STAMPS.map(([v, l]) => `<option value="${v}"${v === settings.stamp ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <details class="howto" open><summary>Installer l'appli</summary><ul>
        <li><b>iPhone</b> : ouvrez cette page dans Safari, bouton Partager, puis « Sur l'écran d'accueil ».</li>
        <li><b>Android</b> : menu ⋮ de Chrome, puis « Installer l'application ».</li>
        <li>Installée, elle s'ouvre en plein écran et marche sans réseau.</li>
        <li>Avant un spectacle : mode avion ou « Ne pas déranger », batterie chargée.</li></ul></details>
      <details class="howto"><summary>Quitter un tour</summary><ul>
        <li>Touchez <b>3 fois rapidement</b> le coin en haut à gauche de l'écran, ou faites le geste « retour ».</li></ul></details></div>`;
    bindToggles(root, buildSecret);
    $('#set-stamp', root).addEventListener('change', e => { settings.stamp = e.target.value; saveSettings(); });
  }
};
SUBS.credits = {
  title: 'Crédits', tab: 'plus',
  build(root) {
    root.innerHTML = `<div class="setup"><p class="hint">
      <b>Faces des cartes</b> (2 à Roi) : « Vector Playing Cards » de Byron Knoll, placées dans le domaine public.<br><br>
      <b>As, dos de cartes, icônes</b> : créations originales pour Arcane.<br><br>
      <b>Polices</b> : Cinzel et Cormorant Garamond, sous licence SIL Open Font License 1.1 (fichiers de licence dans le dossier fonts).<br><br>
      <b>Méthodes</b> : 21 cartes (Gergonne, 1813), compte de Kruskal, « Out of This World » (Paul Curry, 1942), carte disparue (« Princess card trick »), carré magique et tours de chiffres classiques.</p></div>`;
  }
};
function buildPlus() {
  $('#plus-body').innerHTML = [
    itemHTML('train', '◎', 'Entraînement', 'Apprenez la saisie secrète à l\'aveugle.'),
    itemHTML('prefs', '⚙', 'Réglages généraux', 'Vibrations, point discret, horodatage, installation.'),
    itemHTML('credits', '✦', 'Crédits', 'Origine des cartes, des polices et des tours.')
  ].join('');
}

/* ================= Démarrage ================= */
buildSecret();
buildTours();
buildPlus();
const startTab = store.get('tab', 'secret');
const first = ['secret', 'show', 'tours', 'plus'].includes(startTab) ? startTab : 'secret';
history.replaceState({ view: first }, '');
navigate(first, false);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
