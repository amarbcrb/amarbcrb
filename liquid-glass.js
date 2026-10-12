/* =========================================================================
   LIQUID GLASS BIOSTUDY — moteur partagé (BioChem, BioConvert, menu flottant)
   Réfraction par carte de déplacement SVG + reflet spéculaire sur le bord.
   backdrop-filter:url(#svg) n'existe que dans Chromium (Chrome, Edge, Android) :
   ailleurs (Safari, iPhone, Firefox) <html> reçoit .lg-off et le CSS garde un flou classique.

   LiquidGlass.apply(el, cfg)        → verre réfractant sur el (cfg : objet ou fonction)
   LiquidGlass.remove(el)            → retire le verre
   LiquidGlass.rebuildAll()          → recalcule tout (changement de thème, de taille)
   LiquidGlass.tabs({...})           → barre d'onglets : lentille qui grossit, glisser, halo
   ========================================================================= */
(function () {
  'use strict';
  if (window.LiquidGlass) return;

  const NAV = { glassThickness: 80, bezelWidth: 40, ior: 1.4, scaleRatio: 1, blur: 3, specularOpacity: .6, specularSat: 0, tintColor: '255,255,255', tintOpacity: 0, balancedSpecular: false };
  const LENS = { glassThickness: 30, bezelWidth: 40, ior: 1.4, scaleRatio: 1, blur: 0, specularOpacity: .5, specularSat: 0, tintColor: '255,255,255', tintOpacity: 0, balancedSpecular: true };
  const supported = !!navigator.userAgentData && !/iPhone|iPad|iPod/.test(navigator.userAgent) &&
    !matchMedia('(prefers-reduced-transparency: reduce)').matches;
  document.documentElement.classList.add(supported ? 'lg-on' : 'lg-off');

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const targets = new Map();
  let defs = null;

  /* ---- profil de réfraction (loi de Snell sur un bord arrondi) ---- */
  const surface = x => Math.pow(1 - Math.pow(1 - x, 4), .25);
  function profileOf(th, bz, ior, S = 128) {
    const eta = 1 / ior, p = new Float64Array(S);
    for (let i = 0; i < S; i++) {
      const x = i / S, y = surface(x), dx = x < 1 ? 1e-4 : -1e-4, der = (surface(x + dx) - y) / dx, m = Math.sqrt(der * der + 1);
      const nx = -der / m, ny = -1 / m, k = 1 - eta * eta * (1 - ny * ny);
      if (k < 0) continue;
      const sq = Math.sqrt(k), rx = -(eta * ny + sq) * nx, ry = eta - (eta * ny + sq) * ny;
      p[i] = rx * ((y * bz + th) / ry);
    }
    return p;
  }
  /* parcourt les pixels du biseau d'un rectangle arrondi */
  function mapOf(w, h, r, bz, init, px) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
    init(d);
    const rSq = r * r, r1 = r + 1, r1Sq = r1 * r1, rBSq = Math.max(r - bz, 0) ** 2, wB = w - r * 2, hB = h - r * 2;
    for (let y1 = 0; y1 < h; y1++) for (let x1 = 0; x1 < w; x1++) {
      const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0, y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0, dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;
      const dist = Math.sqrt(dSq); if (!dist) continue;
      const op = dSq < rSq ? 1 : 1 - (dist - r) / (r1 - r); if (op <= 0) continue;
      px(d, (y1 * w + x1) * 4, x / dist, y / dist, r - dist, op);
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }
  function dispMap(w, h, r, bz, prof, max) {
    const S = prof.length;
    return mapOf(w, h, r, bz,
      d => { for (let j = 0; j < d.length; j += 4) { d[j] = 128; d[j + 1] = 128; d[j + 2] = 0; d[j + 3] = 255; } },
      (d, i, cos, sin, side, op) => {
        const disp = prof[Math.min((side / bz * S) | 0, S - 1)] || 0;
        d[i] = (128 + (-cos * disp / max) * 127 * op + .5) | 0;
        d[i + 1] = (128 + (-sin * disp / max) * 127 * op + .5) | 0;
      });
  }
  function specMap(w, h, r, bz, balanced) {
    const a = Math.PI / 3, sx = Math.cos(a), sy = Math.sin(a);
    return mapOf(w, h, r, bz, () => {}, (d, i, cos, sin, side, op) => {
      const dot = balanced ? 1 : Math.abs(cos * sx - sin * sy), edge = Math.sqrt(Math.max(0, 1 - (1 - side) ** 2)), k = dot * edge, col = (255 * k) | 0;
      d[i] = d[i + 1] = d[i + 2] = col; d[i + 3] = (col * k * op) | 0;
    });
  }
  const svg = (t, a) => { const e = document.createElementNS('http://www.w3.org/2000/svg', t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  function ensureDefs() {
    if (defs && defs.isConnected) return;
    const s = svg('svg', { width: 0, height: 0, 'aria-hidden': 'true' });
    s.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none';
    defs = svg('defs', {}); s.appendChild(defs); document.documentElement.appendChild(s);
  }
  const mapCache = new Map();
  function cached(key, make) { let v = mapCache.get(key); if (!v) { v = make(); mapCache.set(key, v); } return v; }
  function buildFilter(id, w, h, r, c) {
    const K = [w, h, r, c.glassThickness, c.bezelWidth, c.ior, c.balancedSpecular].join(':');
    const bz = Math.max(1, Math.min(c.bezelWidth, r - 1, Math.min(w, h) / 2 - 1));
    const { prof, max } = cached('p' + K, () => { const prof = profileOf(c.glassThickness, bz, c.ior); let max = 0; for (const v of prof) max = Math.max(max, Math.abs(v)); return { prof, max: max || 1 }; });
    const pad = c.balancedSpecular ? .36 : 0;
    const f = svg('filter', { id, x: Math.round(-w * pad), y: Math.round(-h * pad), width: Math.round(w * (1 + pad * 2)), height: Math.round(h * (1 + pad * 2)),
      filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
    const tr = svg('feComponentTransfer', { in: 'spec', result: 'specF' });
    tr.appendChild(svg('feFuncA', { type: 'linear', slope: c.specularOpacity }));
    f.append(
      svg('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: c.blur, result: 'bl' }),
      svg('feImage', { href: cached('d' + K, () => dispMap(w, h, r, bz, prof, max)), x: 0, y: 0, width: w, height: h, result: 'dm' }),
      svg('feDisplacementMap', { in: 'bl', in2: 'dm', scale: max * c.scaleRatio, xChannelSelector: 'R', yChannelSelector: 'G', result: 'dp' }),
      svg('feColorMatrix', { in: 'dp', type: 'saturate', values: c.specularSat, result: 'ds' }),
      svg('feImage', { href: cached('s' + K, () => specMap(w, h, r, bz * 2.5, c.balancedSpecular)), x: 0, y: 0, width: w, height: h, result: 'spec' }),
      svg('feComposite', { in: 'ds', in2: 'spec', operator: 'in', result: 'sm' }), tr,
      svg('feBlend', { in: 'sm', in2: 'dp', mode: 'normal', result: 'ws' }),
      svg('feBlend', { in: 'specF', in2: 'ws', mode: 'normal' }));
    return f;
  }

  /* ---- verre sur un élément : deux calques au fond, le contenu passe au-dessus ---- */
  function apply(el, cfg) {
    if (!supported || !el || targets.has(el)) return;
    const get = typeof cfg === 'function' ? cfg : () => cfg || NAV;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const refr = document.createElement('div'), tint = document.createElement('div');
    refr.className = tint.className = 'lg-layer';
    refr.style.cssText = tint.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit';
    el.prepend(tint); el.prepend(refr);
    el.classList.add('lg');
    let f = null, tm = 0, last = '';
    function rebuild(force) {
      ensureDefs();
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (w < 4 || h < 4) return;
      const r = Math.max(2, Math.min(parseFloat(el.dataset.radius || getComputedStyle(el).borderTopLeftRadius) || 24, w / 2, h / 2));
      const c = get(), key = w + 'x' + h + ':' + r + ':' + JSON.stringify(c);
      if (key === last && !force) return;
      last = key;
      if (f) f.remove();
      const id = 'lg-' + Math.random().toString(36).slice(2, 9);
      f = buildFilter(id, w, h, r, c); defs.appendChild(f);
      refr.style.borderRadius = tint.style.borderRadius = r + 'px';
      refr.style.backdropFilter = refr.style.webkitBackdropFilter = `url(#${id})`;
      tint.style.backgroundColor = `rgba(${c.tintColor},${c.tintOpacity})`;
      [...el.children].forEach(ch => {
        if (ch === refr || ch === tint) return;
        if (getComputedStyle(ch).position === 'static') ch.style.position = 'relative';
        if (!ch.style.zIndex && getComputedStyle(ch).zIndex === 'auto') ch.style.zIndex = '1';
      });
    }
    const ro = new ResizeObserver(() => { clearTimeout(tm); tm = setTimeout(rebuild, 16); });
    ro.observe(el);
    targets.set(el, { rebuild, destroy() { clearTimeout(tm); ro.disconnect(); if (f) f.remove(); refr.remove(); tint.remove(); el.classList.remove('lg'); } });
    rebuild();
  }
  function remove(el) { const g = targets.get(el); if (g) { g.destroy(); targets.delete(el); } }
  function rebuild(el) { const g = targets.get(el); if (g) g.rebuild(true); }
  const rebuildAll = () => targets.forEach(g => g.rebuild(true));
  addEventListener('resize', () => { clearTimeout(rebuildAll.t); rebuildAll.t = setTimeout(rebuildAll, 120); });

  /* ---- barre d'onglets : appui → lentille ×1,5 en verre, glisser, se cale en relâchant ----
     opts : wrap (élément qui porte le verre), inner (conteneur des onglets), indicator, glow,
            items (boutons), active (index), onSelect(i), glass (false = glisser sans réfraction) */
  function tabs(o) {
    const { wrap, inner, indicator: ind, glow, items } = o;
    let active = o.active || 0, target = active, pid = null, px = 0, py = 0, drag = false, pw = 0, fin = 0;
    const met = i => ({ left: items[i].offsetLeft, width: items[i].offsetWidth, center: items[i].offsetLeft + items[i].offsetWidth / 2 });
    const lx = cx => { const r = inner.getBoundingClientRect(); return (cx - r.left) * (r.width ? inner.offsetWidth / r.width : 1); };
    const nearest = x => items.reduce((b, _, i) => Math.abs(x - met(i).center) < Math.abs(x - met(b).center) ? i : b, 0);
    function place(l, w, anim) {
      if (!anim) { const t = ind.style.transition; ind.style.transition = 'none'; ind.style.translate = l + 'px 0'; ind.style.width = w + 'px'; void ind.offsetWidth; ind.style.transition = t; return; }
      ind.style.translate = l + 'px 0'; ind.style.width = w + 'px';
    }
    const snap = (i, a) => { const m = met(i); place(m.left, m.width, a); };
    function setGlow(cx, cy, a) {
      if (!glow) return;
      inner.style.setProperty('--gx', lx(cx) + 'px');
      inner.style.setProperty('--gy', (cy - inner.getBoundingClientRect().top) + 'px');
      inner.style.setProperty('--ga', a);
    }
    function begin(cx, cy) {
      clearTimeout(fin); ind.classList.add('interacting'); wrap.classList.add('engaged'); setGlow(cx, cy, .24);
      if (o.glass !== false) apply(ind, LENS);
    }
    function end() {
      clearTimeout(fin);
      fin = setTimeout(() => { ind.classList.remove('interacting'); inner.classList.remove('dragging'); wrap.classList.remove('engaged'); inner.style.setProperty('--ga', 0); remove(ind); }, 420);
    }
    function mark(i) { active = i; items.forEach((b, k) => b.classList.toggle('active', k === i)); }
    let mv = null, mvRaf = 0;
    function frame() {
      mvRaf = 0; const e = mv; if (!e) return;
      if (!drag && (Math.abs(e.clientX - px) > 6 || Math.abs(e.clientY - py) > 6)) { drag = true; inner.classList.add('dragging'); }
      if (drag) {
        setGlow(e.clientX, e.clientY, .18);
        const x = lx(e.clientX), w = pw || met(active).width;
        ind.style.translate = clamp(x - w / 2, -10, inner.offsetWidth - w + 10) + 'px 0';
        const n = nearest(x); if (n !== target) { target = n; try { navigator.vibrate && navigator.vibrate(4); } catch (_) {} }
      } else setGlow(e.clientX, e.clientY, .22);
    }
    function move(e) { if (e.pointerId !== pid) return; mv = e; if (!mvRaf) mvRaf = requestAnimationFrame(frame); }
    function off() { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel); }
    function up(e) {
      if (e.pointerId !== pid) return;
      off(); cancelAnimationFrame(mvRaf); mvRaf = 0; mv = null; inner.classList.remove('dragging'); mark(target); snap(target, true); end();
      pid = null; drag = false;
      if (o.onSelect) o.onSelect(target);
    }
    function cancel(e) { if (e.pointerId !== pid) return; off(); cancelAnimationFrame(mvRaf); mvRaf = 0; mv = null; inner.classList.remove('dragging'); snap(active, true); end(); pid = null; drag = false; }
    items.forEach((b, i) => {
      b.style.touchAction = 'none';
      b.addEventListener('pointerdown', e => {
        if (!e.isPrimary || e.button !== 0 || pid !== null) return;
        e.preventDefault();
        pid = e.pointerId; drag = false; target = i; px = e.clientX; py = e.clientY; pw = met(i).width;
        begin(e.clientX, e.clientY);
        addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
      });
      /* clavier : Entrée / Espace déclenchent click sans pointer */
      b.addEventListener('click', e => { if (e.detail === 0 && o.onSelect) { mark(i); snap(i, true); o.onSelect(i); } });
    });
    new ResizeObserver(() => snap(active, false)).observe(inner);
    mark(active); snap(active, false);
    if (o.glass !== false) apply(wrap, NAV);
    return { select(i, anim) { mark(i); snap(i, anim !== false); }, get active() { return active; } };
  }

  window.LiquidGlass = { supported, NAV, LENS, apply, remove, rebuild, rebuildAll, tabs };
})();
