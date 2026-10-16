'use strict';
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ================= Stockage et réglages ================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem('arcane.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('arcane.' + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }
};
const settings = Object.assign({ court: 'fr', back: 'rouge', vibrate: true, dot: true, grid: false, stamp: '180' }, store.get('settings', {}));
const saveSettings = () => store.set('settings', settings);

const buzz = p => { if (settings.vibrate && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* ignoré */ } };

/* ================= Cartes ================= */
const SUITS = ['S', 'H', 'C', 'D']; // ordre aussi utilisé par la grille 2x2 : haut-gauche, haut-droite, bas-gauche, bas-droite
const SUIT_NAME = { S: 'pique', H: 'cœur', C: 'trèfle', D: 'carreau' };
const RANK_NAME = ['As', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix', 'Valet', 'Dame', 'Roi'];
const BACKS = { rouge: '#a3151f', bleu: '#1d3f8f', noir: '#1b1b1f' };
const SERIF = 'Georgia, "Times New Roman", serif';
const isRed = s => s === 'H' || s === 'D';
const rankLabel = r => r === 0 ? 'A' : r < 10 ? String(r + 1) : (settings.court === 'fr' ? 'VDR' : 'JQK')[r - 10];
const cardName = c => `${RANK_NAME[c.rank]} de ${SUIT_NAME[c.suit]}`;
const suitIcon = (s, size = 22) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="${isRed(s) ? '#e0364f' : '#e9e6ee'}"><use href="#su-${s}"/></svg>`;

// Position des symboles sur les cartes 2 à 10 (repère 250 x 350)
const PL = 80, PM = 125, PR = 170;
const PIPS = {
  2: [[PM, 70], [PM, 280]],
  3: [[PM, 70], [PM, 175], [PM, 280]],
  4: [[PL, 70], [PR, 70], [PL, 280], [PR, 280]],
  5: [[PL, 70], [PR, 70], [PM, 175], [PL, 280], [PR, 280]],
  6: [[PL, 70], [PR, 70], [PL, 175], [PR, 175], [PL, 280], [PR, 280]],
  7: [[PL, 70], [PR, 70], [PM, 122], [PL, 175], [PR, 175], [PL, 280], [PR, 280]],
  8: [[PL, 70], [PR, 70], [PM, 122], [PL, 175], [PR, 175], [PM, 228], [PL, 280], [PR, 280]],
  9: [[PL, 70], [PR, 70], [PL, 140], [PR, 140], [PM, 175], [PL, 210], [PR, 210], [PL, 280], [PR, 280]],
  10: [[PL, 70], [PR, 70], [PM, 105], [PL, 140], [PR, 140], [PL, 210], [PR, 210], [PM, 245], [PL, 280], [PR, 280]]
};
const pip = (s, x, y, size) => {
  const rot = y > 176 ? ` transform="rotate(180 ${x} ${y})"` : '';
  return `<use href="#su-${s}" x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}"${rot}/>`;
};

function cardSVG(c) {
  const col = isRed(c.suit) ? '#c8102e' : '#141414';
  const lab = rankLabel(c.rank);
  const two = lab.length > 1;
  const corner = `<text x="24" y="48" font-size="${two ? 30 : 36}"${two ? ' letter-spacing="-2"' : ''} font-family='${SERIF}' font-weight="700" text-anchor="middle">${lab}</text>`
    + `<use href="#su-${c.suit}" x="11" y="56" width="26" height="26"/>`;
  let body;
  if (c.rank === 0) {
    body = (c.suit === 'S' ? `<circle cx="125" cy="175" r="76" fill="none" stroke="${col}" stroke-width="1.5" opacity=".3"/>` : '')
      + pip(c.suit, 125, 175, c.suit === 'S' ? 112 : 96);
  } else if (c.rank < 10) {
    body = PIPS[c.rank + 1].map(([x, y]) => pip(c.suit, x, y, 46)).join('');
  } else {
    const tint = isRed(c.suit) ? '#fbeeea' : '#eef0f5';
    const half = `<use href="#su-${c.suit}" x="104" y="58" width="42" height="42"/>`
      + `<text x="125" y="166" font-size="78" font-family='${SERIF}' font-weight="700" text-anchor="middle">${lab}</text>`;
    body = `<rect x="46" y="40" width="158" height="270" rx="8" fill="${tint}" stroke="${col}" stroke-width="2.5"/>`
      + `<rect x="53" y="47" width="144" height="256" rx="5" fill="none" stroke="#c49a45" stroke-width="1.5"/>`
      + `<path d="M53 175H197" stroke="${col}" stroke-opacity=".3" stroke-width="1.5"/>`
      + half + `<g transform="rotate(180 125 175)">${half}</g>`;
  }
  return `<svg class="card-svg" viewBox="0 0 250 350" role="img" aria-label="${cardName(c)}">`
    + `<rect x="1.5" y="1.5" width="247" height="347" rx="16" fill="#fff" stroke="#cfcfcf" stroke-width="1.5"/>`
    + `<g fill="${col}">${corner}<g transform="rotate(180 125 175)">${corner}</g>${body}</g></svg>`;
}

function backSVG() {
  const c = BACKS[settings.back] || BACKS.rouge;
  return `<svg class="card-svg" viewBox="0 0 250 350" role="img" aria-label="Carte face cachée">`
    + `<rect x="1.5" y="1.5" width="247" height="347" rx="16" fill="#fff" stroke="#cfcfcf" stroke-width="1.5"/>`
    + `<rect x="14" y="14" width="222" height="322" rx="9" fill="${c}"/>`
    + `<rect x="14" y="14" width="222" height="322" rx="9" fill="url(#bk-pat)"/>`
    + `<rect x="22" y="22" width="206" height="306" rx="6" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>`
    + `<g transform="translate(125 175)"><circle r="36" fill="${c}" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>`
    + `<rect x="-17" y="-17" width="34" height="34" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" transform="rotate(45)"/>`
    + `<rect x="-17" y="-17" width="34" height="34" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>`
    + `<circle r="5" fill="#fff" fill-opacity=".8"/></g></svg>`;
}

// Taille d'écriture adaptée à la longueur du texte (en % de la largeur du papier)
function paperHTML(text, cls = '') {
  const n = Math.max(1, [...text].length);
  const fs = n <= 5 ? Math.min(32, 150 / n) : Math.max(8, 46 / Math.sqrt(n));
  return `<div class="paper ${cls}"><span style="font-size:${fs.toFixed(1)}cqw">${esc(text)}</span></div>`;
}

const contentLabel = c => c.type === 'card' ? cardName(c) : `« ${c.text} »`;

/* ================= Saisie secrète ================= */
// Carte : 1re touche = valeur (grille 4x4), 2e touche = couleur (quarts d'écran).
// Nombre : grille 3x4 de clavier téléphone, ⌫ en bas à gauche, ✓ en bas à droite.
const RANK_GRID = 16, NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];

function makePad(type, onStep, onDone) {
  let step = 0, rank = 0, digits = '';
  return {
    get digits() { return digits; },
    feed(fx, fy) { // fx, fy : position relative 0..1
      const col = n => Math.min(n - 1, Math.floor(fx * n)), row = n => Math.min(n - 1, Math.floor(fy * n));
      if (type === 'card') {
        if (step === 0) {
          const i = row(4) * 4 + col(4);
          if (i > 12) return; // cases vides de la grille
          rank = i; step = 1; onStep(step);
        } else if (step === 1) {
          step = 2; onDone({ type: 'card', rank, suit: SUITS[row(2) * 2 + col(2)] });
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

// Grille visible (entraînement ou option « grille visible »)
function makeGrid(parent, type) {
  const g = document.createElement('div');
  g.className = 'padgrid';
  parent.appendChild(g);
  let phase = 0;
  const draw = () => {
    if (phase === 2) { g.innerHTML = ''; return; }
    if (type === 'card' && phase === 0) {
      g.style.gridTemplate = 'repeat(4,1fr) / repeat(4,1fr)';
      g.innerHTML = Array.from({ length: RANK_GRID }, (_, i) => `<i>${i < 13 ? rankLabel(i) : ''}</i>`).join('');
    } else if (type === 'card') {
      g.style.gridTemplate = 'repeat(2,1fr) / repeat(2,1fr)';
      g.innerHTML = SUITS.map(s => `<i>${suitIcon(s, 34)}</i>`).join('');
    } else {
      g.style.gridTemplate = 'repeat(4,1fr) / repeat(3,1fr)';
      g.innerHTML = NUM_KEYS.map(k => `<i>${k}</i>`).join('');
    }
  };
  draw();
  return {
    step() { if (type === 'card') { phase = 1; draw(); } },
    done() { phase = 2; draw(); },
    reset() { phase = 0; draw(); },
    remove() { g.remove(); }
  };
}

// Petit schéma mémo affiché dans les écrans de préparation
function padDiagrams(type) {
  if (type === 'card') {
    const ranks = Array.from({ length: 16 }, (_, i) => `<i>${i < 13 ? rankLabel(i) : ''}</i>`).join('');
    const suits = SUITS.map(s => `<i>${suitIcon(s, 18)}</i>`).join('');
    return `<div class="diagrams"><div class="diag" style="grid-template:repeat(4,1fr)/repeat(4,1fr)">${ranks}</div>`
      + `<div class="diag" style="grid-template:repeat(2,1fr)/repeat(2,1fr)">${suits}</div></div>`;
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
    h.down && h.down(e);
    if (h.long) lt = setTimeout(() => { if (!moved && id !== null) { id = null; h.long(e); } }, 750);
  });
  el.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 14) { moved = true; clearTimeout(lt); }
    h.move && h.move(e);
  });
  const end = (e, cancelled) => {
    if (e.pointerId !== id) return;
    clearTimeout(lt); id = null;
    h.up && h.up(e);
    if (!cancelled && !moved && performance.now() - t0 < 600) h.tap && h.tap(e);
  };
  el.addEventListener('pointerup', e => end(e, false));
  el.addEventListener('pointercancel', e => end(e, true));
  el.addEventListener('contextmenu', e => e.preventDefault());
}

/* ================= Navigation ================= */
const views = $$('.view');
let current = 'home';
function show(name, push = true) {
  if (!$(`.view[data-view="${name}"]`)) name = 'home';
  views.forEach(v => { v.hidden = v.dataset.view !== name; });
  current = name;
  if (push) history.pushState({ view: name }, '');
  window.scrollTo(0, 0);
  if (onShow[name]) onShow[name]();
}
const onShow = {};
document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  if (go) { show(go.dataset.go); return; }
  if (e.target.closest('[data-back]')) history.back();
});

/* ================= Scène plein écran ================= */
let stage = $('#stage');
let stageCleanup = null, wake = null;

async function keepAwake() {
  try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch (e) { wake = null; }
}
document.addEventListener('visibilitychange', () => { if (!stage.hidden && document.visibilityState === 'visible') keepAwake(); });

function openStage(build) {
  // Nouvel élément à chaque tour : les écouteurs du tour précédent disparaissent avec l'ancien
  const fresh = stage.cloneNode(false);
  stage.replaceWith(fresh);
  stage = fresh;
  stage.className = 'stage';
  stage.hidden = false;
  document.body.classList.add('staging');
  history.pushState({ view: current, stage: true }, '');
  const de = document.documentElement;
  try {
    const req = de.requestFullscreen || de.webkitRequestFullscreen;
    if (req && !document.fullscreenElement) { const p = req.call(de, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); }
  } catch (e) { /* plein écran refusé : on continue */ }
  keepAwake();
  stageCleanup = build(stage) || null;
}
function closeStage() {
  if (stage.hidden) return;
  if (stageCleanup) stageCleanup();
  stageCleanup = null;
  stage.hidden = true;
  stage.innerHTML = '';
  document.body.classList.remove('staging');
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) { /* ignoré */ }
  if (wake) { wake.release().catch(() => {}); wake = null; }
}
const exitStage = () => history.back();

window.addEventListener('popstate', e => {
  if (!stage.hidden) { closeStage(); return; }
  show((e.state && e.state.view) || 'home', false);
});

// Sortie discrète : 3 touches rapides dans le coin haut gauche
let cornerTaps = [];
function cornerExit(e) {
  if (e.clientX > 72 || e.clientY > 72) { cornerTaps = []; return false; }
  const t = performance.now();
  cornerTaps = cornerTaps.filter(x => t - x < 1000);
  cornerTaps.push(t);
  if (cornerTaps.length >= 3) { cornerTaps = []; exitStage(); return true; }
  return false;
}
function blip() {
  if (!settings.dot) return;
  const d = document.createElement('div');
  d.className = 'blip';
  stage.appendChild(d);
  setTimeout(() => d.remove(), 450);
}
const rel = e => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };

/* ================= Horodatage de la prédiction ================= */
const STAMPS = [
  ['none', 'Aucun'], ['15', 'Il y a 15 minutes'], ['60', 'Il y a 1 heure'], ['180', 'Il y a 3 heures'],
  ['morning', 'Ce matin (8 h 12)'], ['yesterday', 'Hier soir (22 h 47)']
];
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

/* ================= Tour : prédiction scellée ================= */
// cfg = { content, secret: 'card' | 'number' | null, stamp }
function launchPrediction(cfg) {
  openStage(st => {
    st.classList.add('pred');
    const asCard = cfg.secret ? cfg.secret === 'card' : cfg.content.type === 'card';
    const stampTxt = stampText(cfg.stamp);
    st.innerHTML = `<div class="pred-wrap"><p class="pred-label">Ma prédiction</p><div class="pred-obj">`
      + (asCard
        ? `<div class="flip"><div class="flip-inner"><div class="face face-back">${backSVG()}</div><div class="face face-front"></div></div></div>`
        : `<div class="env"><div class="env-back"></div>${paperHTML('')}<div class="env-front"></div><div class="env-flap"></div><div class="seal"></div></div>`)
      + `</div><p class="pred-stamp">${stampTxt ? LOCK + esc(stampTxt) : ''}</p></div>`;
    const obj = $('.flip, .env', st);
    let content = cfg.secret ? null : cfg.content, revealed = false, grid = null;
    const pad = cfg.secret ? makePad(cfg.secret,
      () => { buzz(15); blip(); if (grid) grid.step(); },
      c => { content = c; buzz([20, 60, 20]); blip(); if (grid) grid.done(); }) : null;
    if (pad && settings.grid) grid = makeGrid(st, cfg.secret);

    const reveal = () => {
      revealed = true;
      buzz(10);
      if (asCard) {
        $('.face-front', st).innerHTML = cardSVG(content);
        requestAnimationFrame(() => requestAnimationFrame(() => obj.classList.add('on')));
        setTimeout(() => $('.pred-wrap', st).classList.add('revealed'), 900);
      } else {
        obj.querySelector('.paper').outerHTML = paperHTML(content.text);
        obj.classList.add('open');
        setTimeout(() => obj.classList.add('out'), 650);
        setTimeout(() => {
          obj.classList.add('gone');
          const holder = $('.pred-obj', st);
          holder.insertAdjacentHTML('beforeend', paperHTML(content.text, 'big'));
          const big = holder.lastElementChild;
          requestAnimationFrame(() => requestAnimationFrame(() => big.classList.add('in')));
        }, 1600);
      }
    };

    gestures(st, {
      tap: e => {
        if (cornerExit(e) || revealed) return;
        if (!content) { const [x, y] = rel(e); pad.feed(x, y); return; }
        const r = obj.getBoundingClientRect();
        if (e.clientX >= r.left - 20 && e.clientX <= r.right + 20 && e.clientY >= r.top - 20 && e.clientY <= r.bottom + 20) reveal();
      },
      long: () => { // recommencer la saisie secrète
        if (!pad || revealed) return;
        pad.reset(); content = null; buzz([10, 40, 10, 40, 10]);
        if (grid) grid.reset();
      }
    });
  });
}

/* ================= Tour : écran noir ================= */
// cfg = { content, secret, mode: 'scratch' | 'ghost' }
function launchBlack(cfg) {
  openStage(st => {
    const holder = document.createElement('div');
    holder.className = 'bk-content';
    st.appendChild(holder);
    let content = null, ready = false, done = false, grid = null;
    const setContent = c => {
      content = c;
      holder.innerHTML = c.type === 'card' ? `<div class="bk-card">${cardSVG(c)}</div>` : paperHTML(c.text, 'bk-paper');
    };
    const ghost = cfg.mode === 'ghost';
    if (ghost) holder.style.opacity = '0';

    // Calque noir à gratter
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
        const p = Math.min(1, dist / (3.2 * (W || window.innerWidth) + 3.2 * (H || window.innerHeight)));
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

    if (cfg.secret) {
      const pad = makePad(cfg.secret,
        () => { buzz(15); blip(); if (grid) grid.step(); },
        c => { setContent(c); ready = true; buzz([20, 60, 20]); blip(); if (grid) grid.done(); });
      if (settings.grid) grid = makeGrid(st, cfg.secret);
      gestures(st, {
        tap: e => { if (cornerExit(e)) return; if (!ready) { const [x, y] = rel(e); pad.feed(x, y); } },
        long: () => { if (!ready) { pad.reset(); buzz([10, 40, 10, 40, 10]); if (grid) grid.reset(); } },
        down: e => { last = null; if (ready && !done) rub(e); },
        move: e => { if (ready && !done) rub(e); },
        up: () => { last = null; }
      });
    } else {
      setContent(cfg.content);
      ready = true;
      gestures(st, {
        tap: e => { cornerExit(e); },
        down: e => { last = null; if (!done) rub(e); },
        move: e => { if (!done) rub(e); },
        up: () => { last = null; }
      });
    }
    return () => window.removeEventListener('resize', onResize);
  });
}

/* ================= Préparation : prédiction et écran noir ================= */
const seg = (name, opts, val) => `<div class="seg" role="group" data-seg="${name}">`
  + opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === val}">${l}</button>`).join('') + '</div>';
function bindSeg(root, onChange) {
  $$('[data-seg]', root).forEach(s => s.addEventListener('click', e => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    $$('button', s).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    onChange(s.dataset.seg, b.dataset.v);
  }));
}

function buildSetup(kind) {
  const root = $(kind === 'pred' ? '#pred-setup' : '#black-setup');
  const st = Object.assign({ type: 'card', source: 'now', rank: 12, suit: 'H', text: '', stamp: settings.stamp, mode: 'scratch' }, store.get('setup.' + kind, {}));
  const ranks = Array.from({ length: 13 }, (_, i) => `<button type="button" data-rank="${i}">${rankLabel(i)}</button>`).join('');
  const suits = SUITS.map(s => `<button type="button" data-suit="${s}" aria-label="${SUIT_NAME[s]}">${suitIcon(s)}</button>`).join('');
  root.innerHTML = `
    <div class="field"><span class="lbl">Ce qui apparaît</span>${seg('type', [['card', 'Une carte'], ['note', 'Un nombre ou un mot']], st.type)}</div>
    <div class="field"><span class="lbl">Quand le choisir</span>${seg('source', [['now', 'Maintenant'], ['live', 'En secret, pendant le tour']], st.source)}</div>
    <div class="field" data-when="card now"><span class="lbl">La carte</span>
      <div class="picker"><div class="ranks">${ranks}</div><div class="suits">${suits}</div>
      <div class="preview"><div class="mini"></div><span class="pv-name"></span></div></div></div>
    <div class="field" data-when="note now"><span class="lbl">Le nombre ou le texte</span>
      <input class="input" id="${kind}-text" maxlength="40" placeholder="ex. 1089" value="${esc(st.text)}" autocomplete="off"></div>
    <div class="hint" data-when="card live"><b>Deux touches à l'aveugle sur l'écran du tour.</b> 1) la valeur, 2) la couleur.
      Une vibration confirme chaque touche. Appui long = recommencer.${padDiagrams('card')}</div>
    <div class="hint" data-when="note live"><b>Clavier invisible façon téléphone</b> sur tout l'écran. Tapez les chiffres puis
      la case en bas à droite pour valider (en bas à gauche = effacer). Appui long = tout recommencer.${padDiagrams('number')}</div>
    ${kind === 'pred'
      ? `<div class="field"><span class="lbl">Horodatage affiché (preuve que c'était prévu)</span>
         <select class="input" id="pred-stamp">${STAMPS.map(([v, l]) => `<option value="${v}"${v === st.stamp ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`
      : `<div class="field"><span class="lbl">Effet</span>${seg('mode', [['scratch', 'Gratter : apparaît sous le doigt'], ['ghost', 'Fantôme : se matérialise']], st.mode)}</div>`}
    <p class="err" hidden></p>
    <button class="btn primary" type="button" data-launch>Lancer le tour</button>
    <details class="howto"><summary>Comment le présenter</summary>${kind === 'pred' ? `
      <ol><li>Forcez une carte (ou laissez-la choisir si vous utilisez la saisie secrète).</li>
      <li>Lancez le tour <b>avant</b> de montrer le téléphone : l'écran affiche une carte face cachée « scellée » avec une heure passée.</li>
      <li>Posez le téléphone devant le spectateur. Faites-lui annoncer sa carte.</li>
      <li>Il touche la carte du téléphone : elle se retourne. C'est la sienne.</li></ol>
      <ul><li>Avec un nombre ou un mot, une enveloppe cachetée s'ouvre et le papier sort.</li>
      <li>Saisie secrète : tapez pendant que vous parlez, téléphone tourné vers vous, puis posez-le.</li></ul>` : `
      <ol><li>Lancez le tour : l'écran devient entièrement noir, comme éteint.</li>
      <li>Saisie secrète : faites vos deux touches, une vibration confirme.</li>
      <li>Tendez le téléphone. Demandez au spectateur de « frotter l'écran pour réveiller la carte ».</li>
      <li>La carte apparaît sous ses doigts, puis s'illumine quand elle est presque entière.</li></ol>
      <ul><li>Astuce : baissez la luminosité et mettez le téléphone en mode avion pour éviter les notifications.</li></ul>`}
      <ul><li>Sortir du tour : 3 touches rapides dans le coin haut gauche, ou geste retour.</li></ul></details>`;

  const refresh = () => {
    $$('[data-when]', root).forEach(el => { const [t, s] = el.dataset.when.split(' '); el.hidden = t !== st.type || s !== st.source; });
    $$('[data-rank]', root).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.rank === st.rank)));
    $$('[data-suit]', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.suit === st.suit)));
    const c = { type: 'card', rank: st.rank, suit: st.suit };
    $('.mini', root).innerHTML = cardSVG(c);
    $('.pv-name', root).textContent = cardName(c);
  };
  const save = () => store.set('setup.' + kind, st);
  bindSeg(root, (k, v) => { st[k] = v; save(); refresh(); });
  root.addEventListener('click', e => {
    const r = e.target.closest('[data-rank]'), s = e.target.closest('[data-suit]');
    if (r) { st.rank = +r.dataset.rank; save(); refresh(); }
    if (s) { st.suit = s.dataset.suit; save(); refresh(); }
    if (e.target.closest('[data-launch]')) launch();
  });
  $(`#${kind}-text`, root).addEventListener('input', e => { st.text = e.target.value; save(); });
  const stampSel = $('#pred-stamp', root);
  if (stampSel) stampSel.addEventListener('change', e => { st.stamp = e.target.value; save(); });

  function launch() {
    const err = $('.err', root);
    err.hidden = true;
    const secret = st.source === 'live' ? (st.type === 'card' ? 'card' : 'number') : null;
    let content = null;
    if (!secret) {
      if (st.type === 'card') content = { type: 'card', rank: st.rank, suit: st.suit };
      else {
        const t = st.text.trim();
        if (!t) { err.textContent = 'Écrivez le nombre ou le mot à faire apparaître.'; err.hidden = false; return; }
        content = { type: 'note', text: t };
      }
    }
    if (kind === 'pred') launchPrediction({ content, secret, stamp: st.stamp });
    else launchBlack({ content, secret, mode: st.mode });
  }
  refresh();
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
function fmtNum(n) {
  if (!isFinite(n)) return 'Erreur';
  return groupDigits(Math.abs(n) >= 1e15 ? n.toExponential(5) : String(parseFloat(n.toPrecision(12))));
}
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
      if (!cfg.target) return false;
      target = cfg.target === 'date' ? dateTarget(cfg.offset || 0) : Number(cfg.value);
      if (!isFinite(target)) return false;
      armed = true; buzz(25); render();
      return true;
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
    st.querySelector('.calc-keys').addEventListener('click', e => {
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
    // Appui long sur l'affichage : armer / désarmer
    let lt = 0;
    disp.addEventListener('pointerdown', () => { lt = setTimeout(() => { if (armed) { armed = false; buzz([10, 40, 10]); render(); } else arm(); }, 650); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => disp.addEventListener(t, () => clearTimeout(lt)));
    st.addEventListener('pointerup', cornerExit);
    st.addEventListener('contextmenu', e => e.preventDefault());
    render();
  });
}

function buildCalcSetup() {
  const root = $('#calc-setup');
  const st = Object.assign({ target: 'fixed', value: '', offset: 1, auto: 0 }, store.get('setup.calc', {}));
  root.innerHTML = `
    <p class="hint">Une vraie calculatrice, au look de celle d'un téléphone. Les spectateurs additionnent des nombres au hasard…
      et le total est <b>votre prédiction</b>.</p>
    <div class="field"><span class="lbl">Nombre à faire apparaître</span>${seg('target', [['fixed', 'Un nombre choisi'], ['date', 'Date et heure du moment']], st.target)}</div>
    <div class="field" data-t="fixed"><input class="input" id="calc-value" inputmode="numeric" maxlength="12" placeholder="ex. 1089, une année, un numéro…" value="${esc(st.value)}"></div>
    <div class="field" data-t="date"><span class="lbl">Format JJMMHHmm. Décalage pour l'heure de la révélation</span>
      <select class="input" id="calc-offset">${[0, 1, 2, 3, 5].map(m => `<option value="${m}"${m === st.offset ? ' selected' : ''}>+${m} min</option>`).join('')}</select></div>
    <div class="field"><span class="lbl">Armement du forçage</span>
      <select class="input" id="calc-auto">${[[0, 'Manuel : appui long sur l\'affichage'], [2, 'Automatique au 2e nombre'], [3, 'Automatique au 3e nombre'], [4, 'Automatique au 4e nombre'], [5, 'Automatique au 5e nombre']]
        .map(([v, l]) => `<option value="${v}"${v === st.auto ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    <p class="err" hidden></p>
    <div class="btn-row"><button class="btn primary" type="button" data-launch>Lancer la calculatrice</button></div>
    <details class="howto"><summary>Comment ça marche</summary><ol>
      <li>Faites taper un nombre à 3 chiffres par un spectateur, puis <b>+</b>. Un deuxième, puis <b>+</b>…</li>
      <li>Juste avant le dernier nombre, <b>appui long sur l'affichage</b> (ou armement automatique). Un point minuscule apparaît en haut à gauche.</li>
      <li>Quelles que soient les touches tapées ensuite, la calculatrice tape le nombre qui manque. Faites-le taper vite, « sans réfléchir ».</li>
      <li>Il appuie sur <b>=</b> : le total est votre prédiction. Le calcul est réellement juste, vérifiable.</li></ol>
      <ul><li>Mode « date et heure » : le total est la date et l'heure de la révélation (ex. 16102145 = 16/10 à 21 h 45). Montrez l'horloge.</li>
      <li>Appui long à nouveau pour désarmer. Le forçage s'arrête après <b>=</b>.</li></ul></details>`;
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

/* ================= Lecture de pensée (cartes binaires) ================= */
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildBinary() {
  const root = $('#binary-body');
  let order = [], idx = 0, total = 0;
  const intro = () => {
    root.innerHTML = `<div class="bin"><h3>Pensez à un nombre entre 1 et 63</h3>
      <p>Ne le dites à personne. Je vais vous montrer 6 cartes : dites-moi seulement s'il y figure.</p>
      <button class="btn primary" type="button" data-start>Commencer</button>
      <details class="howto" style="text-align:left"><summary>Le secret</summary><ul>
      <li>Chaque carte correspond à une puissance de 2 : 1, 2, 4, 8, 16, 32. Un nombre figure sur une carte si cette puissance fait partie de sa décomposition.</li>
      <li>L'application additionne pour vous. Pour le faire de tête avec des cartes papier, rangez les nombres dans l'ordre : le premier de chaque carte « oui » s'additionne.</li>
      <li>Ici les cartes et les nombres sont mélangés à chaque fois, donc impossible de deviner le principe.</li></ul></details></div>`;
    $('[data-start]', root).addEventListener('click', () => { order = shuffle([0, 1, 2, 3, 4, 5]); idx = 0; total = 0; step(); });
  };
  const step = () => {
    if (idx >= 6) return finale();
    const bit = order[idx];
    const nums = shuffle(Array.from({ length: 63 }, (_, i) => i + 1).filter(n => n & (1 << bit)));
    root.innerHTML = `<div class="bin"><p class="bin-step">Carte ${idx + 1} / 6</p>
      <div class="bin-card">${nums.map(n => `<span>${n}</span>`).join('')}</div>
      <div class="btn-row"><button class="btn" type="button" data-a="0">Il n'y est pas</button><button class="btn primary" type="button" data-a="1">Il y est</button></div></div>`;
    $$('[data-a]', root).forEach(b => b.addEventListener('click', () => { if (b.dataset.a === '1') total += 1 << bit; idx++; step(); }));
  };
  const finale = () => {
    root.innerHTML = `<div class="bin"><h3 class="pulse">Concentrez-vous sur votre nombre…</h3></div>`;
    setTimeout(() => {
      root.innerHTML = `<div class="bin"><p>Vous pensez au…</p><div class="bin-reveal">${total || '?'}</div>
        ${total ? '' : '<p>Aucune carte ? Vous avez triché… ou pensé à 0.</p>'}
        <button class="btn" type="button" data-again>Recommencer</button></div>`;
      buzz(30);
      $('[data-again]', root).addEventListener('click', intro);
    }, 2200);
  };
  intro();
}

/* ================= Carré magique ================= */
const SQ_GROUPS = [
  ['Ligne 1', [0, 1, 2, 3]], ['Ligne 2', [4, 5, 6, 7]], ['Ligne 3', [8, 9, 10, 11]], ['Ligne 4', [12, 13, 14, 15]],
  ['Colonne 1', [0, 4, 8, 12]], ['Colonne 2', [1, 5, 9, 13]], ['Colonne 3', [2, 6, 10, 14]], ['Colonne 4', [3, 7, 11, 15]],
  ['Diagonale', [0, 5, 10, 15]], ['Autre diagonale', [3, 6, 9, 12]], ['Les 4 coins', [0, 3, 12, 15]], ['Le carré central', [5, 6, 9, 10]],
  ['Coin haut gauche', [0, 1, 4, 5]], ['Coin haut droit', [2, 3, 6, 7]], ['Coin bas gauche', [8, 9, 12, 13]], ['Coin bas droit', [10, 11, 14, 15]],
  ['Milieux haut et bas', [1, 2, 13, 14]], ['Milieux gauche et droite', [4, 7, 8, 11]]
];
const magicSquare = n => [n - 20, 1, 12, 7, 11, 8, n - 21, 2, 5, 10, 3, n - 18, 4, n - 19, 6, 9];
function buildSquare() {
  const root = $('#square-body');
  root.innerHTML = `<div class="setup">
    <p class="hint">Le spectateur donne un nombre (son âge, l'année…). En quelques secondes, vous écrivez un carré où <b>18 combinaisons</b> donnent ce total.</p>
    <div class="row"><input class="input" id="sq-n" inputmode="numeric" maxlength="4" placeholder="Nombre (34 ou plus)"><button class="btn primary" type="button" id="sq-go">Créer</button></div>
    <p class="err" hidden></p>
    <div class="sq" id="sq-grid"></div><div class="sq-lbl" id="sq-lbl"></div>
    <div class="btn-row" id="sq-actions" hidden><button class="btn" type="button" id="sq-check">Vérifier toutes les sommes</button></div>
    <details class="howto"><summary>Le faire à la main, sur papier</summary>
      <ul><li>Apprenez ce carré de base (total 34). Les 4 cases dorées dépendent du nombre N :</li></ul>
      <div class="tpl">${['N−20', 1, 12, 7, 11, 8, 'N−21', 2, 5, 10, 3, 'N−18', 4, 'N−19', 6, 9].map(v => `<span class="${typeof v === 'string' ? 'v' : ''}">${v}</span>`).join('')}</div>
      <ul><li>Astuce de mémoire : c'est un carré magique classique de 1 à 16 où l'on remplace 13, 14, 15, 16 par N−21, N−20, N−19, N−18.</li>
      <li>Écrivez d'abord les nombres fixes, dans le désordre, en bavardant. Les 4 cases calculées en dernier.</li>
      <li>En dessous de 34, des nombres se répètent : demandez un nombre « entre 40 et 99 ».</li></ul></details></div>`;
  let timer = 0;
  const grid = $('#sq-grid', root), lbl = $('#sq-lbl', root), err = $('.err', root);
  const stop = () => { clearInterval(timer); timer = 0; $$('span', grid).forEach(s => s.classList.remove('hl')); };
  $('#sq-go', root).addEventListener('click', () => {
    stop();
    const n = parseInt($('#sq-n', root).value, 10);
    if (!(n >= 34 && n <= 9999)) { err.textContent = 'Choisissez un nombre entre 34 et 9999.'; err.hidden = false; return; }
    err.hidden = true;
    const vals = magicSquare(n), order = shuffle([...Array(16).keys()]);
    grid.innerHTML = vals.map(() => '<span></span>').join('');
    lbl.textContent = '';
    order.forEach((i, k) => setTimeout(() => { const s = grid.children[i]; s.textContent = vals[i]; s.classList.add('in'); }, 120 * k));
    setTimeout(() => { lbl.textContent = `Total magique : ${n}`; $('#sq-actions', root).hidden = false; }, 120 * 16 + 200);
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
  onShow.square = stop;
}

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
    launch: [['pred', 'Enveloppe scellée : 1089', '1089'], ['black', 'Écran noir : 1089', '1089'], ['calc0', 'Calculatrice normale']]
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
    launch: [['pred', 'Enveloppe : la prédiction', 'Un éléphant gris au Danemark'], ['black', 'Écran noir : la prédiction', 'Éléphant gris · Danemark']]
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
    launch: [['pred', 'Enveloppe scellée : 37', '37'], ['calc0', 'Calculatrice normale']]
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
const TOOLS = [
  { go: 'calc', num: '+', title: 'Calculatrice forcée', short: 'Des nombres au hasard, le total est votre prédiction.' },
  { go: 'binary', num: '63', title: 'Lecture de pensée', short: '6 cartes de nombres, l\'appli trouve le nombre pensé.' },
  { go: 'square', num: '4×4', title: 'Carré magique', short: 'Un nombre donné, 18 façons de l\'obtenir.' }
];
const itemHTML = (attr, x) => `<button class="item" type="button" ${attr}><span class="num">${esc(x.num)}</span><span><b>${esc(x.title)}</b><small>${esc(x.short)}</small></span></button>`;
function buildNums() {
  $('#nums-tools').innerHTML = TOOLS.map(t => itemHTML(`data-go="${t.go}"`, t)).join('');
  $('#nums-routines').innerHTML = ROUTINES.map(r => itemHTML(`data-routine="${r.id}"`, r)).join('');
  $('#nums-routines').addEventListener('click', e => {
    const b = e.target.closest('[data-routine]');
    if (b) { openRoutine(b.dataset.routine); show('routine'); }
  });
}
function openRoutine(id) {
  const r = ROUTINES.find(x => x.id === id);
  if (!r) return;
  $('#routine-title').textContent = r.title;
  const body = $('#routine-body');
  const launches = (r.launch || []).map(([k, l], i) => `<button class="btn ${i === 0 ? 'primary' : ''}" type="button" data-l="${i}">${esc(l)}</button>`).join('');
  let tool = '';
  if (r.tool === 'birthday') tool = `<div class="tool-box"><span class="lbl">Décodeur (pour vous entraîner)</span><input class="input" id="tool-in" inputmode="numeric" maxlength="5" placeholder="Nombre annoncé, ex. 1422"><div class="out" id="tool-out"></div></div>`;
  if (r.tool === 'circled') tool = `<div class="tool-box"><span class="lbl">Décodeur (pour vous entraîner)</span><input class="input" id="tool-in" inputmode="numeric" maxlength="12" placeholder="Chiffres annoncés, ex. 228"><div class="out" id="tool-out"></div></div>`;
  body.innerHTML = `<p class="effect">${esc(r.effect)}</p>
    ${launches ? `<div class="btn-row">${launches}</div>` : ''}
    <h3>Déroulé</h3><ol>${r.steps.map(([s, say]) => `<li>${esc(s)}${say ? `<span class="say">${esc(say)}</span>` : ''}</li>`).join('')}</ol>
    ${tool}
    <h3>Astuce de pro</h3><p>${esc(r.tip)}</p>
    <h3>Pourquoi ça marche</h3><p>${esc(r.why)}</p>`;
  $$('[data-l]', body).forEach(b => b.addEventListener('click', () => {
    const [k, , text] = r.launch[+b.dataset.l];
    const content = text ? { type: 'note', text } : null;
    if (k === 'pred') launchPrediction({ content, secret: null, stamp: settings.stamp });
    else if (k === 'black') launchBlack({ content, secret: null, mode: 'scratch' });
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
      const sum = [...v].reduce((a, c) => a + +c, 0), miss = 9 - (sum % 9);
      tout.textContent = `Chiffre entouré : ${miss}`;
    }
  });
}

/* ================= Entraînement ================= */
function buildTrain() {
  const root = $('#train-body');
  let type = 'card', showGrid = true;
  root.innerHTML = `<div class="setup">
    ${seg('ttype', [['card', 'Carte'], ['number', 'Chiffres']], type)}
    <label class="switch"><span>Afficher la grille<small>Coupez-la quand vous la connaissez par cœur.</small></span><input type="checkbox" id="tr-grid" checked></label>
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
        out.innerHTML = c.type === 'card' ? `<div class="mini">${cardSVG(c)}</div><span class="out">${cardName(c)}</span>` : `<span class="out">✓ ${esc(c.text)}</span>`;
        setTimeout(() => { pad.reset(); if (grid) grid.reset(); }, 400);
      });
  };
  gestures(padEl, {
    tap: e => { const r = padEl.getBoundingClientRect(); pad.feed((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); },
    long: () => { pad.reset(); if (grid) grid.reset(); buzz([10, 40, 10]); out.innerHTML = '<span class="lbl">Saisie effacée.</span>'; }
  });
  bindSeg(root, (k, v) => { type = v; setup(); out.innerHTML = '<span class="lbl">Touchez la zone noire comme sur scène.</span>'; });
  $('#tr-grid', root).addEventListener('change', e => { showGrid = e.target.checked; setup(); });
  setup();
  onShow.train = setup; // rafraîchit les lettres des figures si le réglage a changé
}

/* ================= Réglages ================= */
function buildSettings() {
  const root = $('#settings-body');
  const sw = (k, l, s) => `<label class="switch"><span>${l}<small>${s}</small></span><input type="checkbox" data-set="${k}"${settings[k] ? ' checked' : ''}></label>`;
  root.innerHTML = `
    <div class="field"><span class="lbl">Lettres des figures</span>${seg('court', [['fr', 'V · D · R (français)'], ['en', 'J · Q · K (anglais)']], settings.court)}</div>
    <div class="field"><span class="lbl">Dos des cartes</span>${seg('back', [['rouge', 'Rouge'], ['bleu', 'Bleu'], ['noir', 'Noir']], settings.back)}</div>
    <div class="field"><span class="lbl">Horodatage par défaut des prédictions</span>
      <select class="input" id="set-stamp">${STAMPS.map(([v, l]) => `<option value="${v}"${v === settings.stamp ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    ${sw('vibrate', 'Vibrations', 'Confirme chaque touche secrète (Android ; l\'iPhone ne vibre pas depuis le web).')}
    ${sw('dot', 'Point de confirmation discret', 'Un point gris minuscule clignote en bas de l\'écran à chaque touche secrète.')}
    ${sw('grid', 'Grille visible pendant les tours', 'Pour répéter seulement. À couper avant de jouer devant un public.')}
    <details class="howto" open><summary>Installer l'appli (plein écran, hors ligne)</summary><ul>
      <li><b>iPhone</b> : ouvrez cette page dans Safari, bouton Partager, puis « Sur l'écran d'accueil ».</li>
      <li><b>Android</b> : menu ⋮ de Chrome, puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».</li>
      <li>Une fois installée, elle s'ouvre sans barre d'adresse et marche sans réseau.</li>
      <li>Avant un spectacle : mode avion ou « Ne pas déranger », luminosité moyenne, batterie chargée.</li></ul></details>`;
  bindSeg(root, (k, v) => { settings[k] = v; saveSettings(); rebuildCardUIs(); });
  $$('[data-set]', root).forEach(i => i.addEventListener('change', () => { settings[i.dataset.set] = i.checked; saveSettings(); }));
  $('#set-stamp', root).addEventListener('change', e => { settings.stamp = e.target.value; saveSettings(); });
}
// Les lettres V/D/R ou J/Q/K apparaissent dans les écrans de préparation : on les régénère
function rebuildCardUIs() { buildSetup('pred'); buildSetup('black'); }

/* ================= Démarrage ================= */
buildSetup('pred');
buildSetup('black');
buildCalcSetup();
buildBinary();
buildSquare();
buildNums();
buildTrain();
buildSettings();
history.replaceState({ view: 'home' }, '');
show('home', false);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
