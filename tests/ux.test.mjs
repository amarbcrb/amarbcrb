/* Revue UI/UX mesurable (WCAG 2.2 AA) : cibles tactiles, noms accessibles, focus visible, contraste du texte. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer } from './helpers.mjs';

const PAGES = ['#accueil', '#parcours', '#parcours/certifications', '#parcours/formation/f1', '#liens', '#portfolio/dd', '#contact', 'recherche'];
const TAILLES = [390, 1366];
const THEMES = ['dark', 'light'];

let env;
before(async () => {
  env = await demarrer();
  env.faux.etat.portfolio.dossiers = [{ id: 'dd', nom: '1 - Design', fichiers: [
    { id: 'd1', nom: 'A.jpg', type: 'image/jpeg', apercu: '/favicon-512x512.png?a', lien: 'https://drive.google.com/file/d/d1/view' },
    { id: 'd2', nom: 'Rapport.pdf', type: 'application/pdf', apercu: '/favicon-512x512.png?b', lien: 'https://drive.google.com/file/d/d2/view' }] }];
});
after(async () => { await env.fermer(); });

/* exécuté dans la page : renvoie la liste des défauts mesurés */
function mesurer() {
  const defauts = [];
  const nom = (el) => (el.getAttribute('aria-label') || el.innerText || el.textContent || '').trim()
    || [...el.querySelectorAll('img[alt]')].map((i) => i.alt).join(' ').trim() || (el.getAttribute('title') || '').trim();
  const decrire = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} « ${nom(el).slice(0, 40)} »`;
  const visible = (el) => {
    if (!el.getClientRects().length) return false;
    for (let x = el; x; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  const interactifs = [...document.querySelectorAll('a[href], button, [role="tab"], input:not([type="file"]), select, textarea')]
    .filter(visible).filter((el) => !el.closest('#lb:not(.on)') && !(el.tagName === 'A' && el.closest('p')));
  interactifs.forEach((el) => {
    /* lien étiré (::after en position absolue) : la zone cliquable est celle de son conteneur positionné */
    const apres = getComputedStyle(el, '::after');
    const zone = apres.content !== 'none' && apres.position === 'absolute' && el.offsetParent ? el.offsetParent : el;
    const r = zone.getBoundingClientRect();
    if (r.width < 44 - 0.5 || r.height < 44 - 0.5) defauts.push(`cible ${Math.round(r.width)}×${Math.round(r.height)} : ${decrire(el)}`);
    if (!nom(el)) defauts.push(`sans nom : ${decrire(el)}`);
  });

  /* contraste : texte direct de chaque élément visible, contre le fond composé de ses ancêtres */
  const couleur = (s) => {
    if (!s) return null;
    let m = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\)/.exec(s);
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4])];
    m = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(s);
    if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] === undefined ? 1 : +m[4]];
    return null;
  };
  const sur = (haut, bas) => { const a = haut[3]; return [0, 1, 2].map((i) => haut[i] * a + bas[i] * (1 - a)).concat(1); };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const fond = (el) => {
    const chaine = [];
    for (let x = el; x; x = x.parentElement) chaine.unshift(x);
    let c = couleur(getComputedStyle(document.documentElement).backgroundColor) || [0, 0, 0, 1];
    chaine.forEach((x) => {
      const s = getComputedStyle(x);
      const bg = couleur(s.backgroundColor);
      if (bg && bg[3] > 0) c = sur(bg, c);
      if (s.backgroundImage.includes('gradient')) { const g = couleur(s.backgroundImage); if (g) c = sur(g, c); }
    });
    return c;
  };
  document.querySelectorAll('body *').forEach((el) => {
    if (!visible(el) || el.closest('svg, canvas, #lb:not(.on), .carte-image, .degrade')) return;
    const texte = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!texte) return;
    const s = getComputedStyle(el);
    const t = couleur(s.color);
    if (!t) return;
    const b = fond(el);
    const r = ratio(sur(t, b), b);
    const taille = parseFloat(s.fontSize), gras = Number(s.fontWeight) >= 700;
    const seuil = taille >= 24 || (gras && taille >= 18.66) ? 3 : 4.5;
    if (r < seuil) defauts.push(`contraste ${r.toFixed(2)} < ${seuil} : ${decrire(el)}`);
  });
  return defauts;
}

/* focus visible : chaque élément interactif, atteint au clavier, doit montrer un contour */
function focusVisible() {
  const defauts = [];
  const elements = [...document.querySelectorAll('a[href], button, input:not([type="file"])')].filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  elements.slice(0, 60).forEach((el) => {
    el.focus({ preventScroll: true });
    if (document.activeElement !== el || !el.matches(':focus-visible')) return;
    const s = getComputedStyle(el);
    if (s.outlineStyle === 'none' || parseFloat(s.outlineWidth) < 1) defauts.push(`focus invisible : ${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).join('.')}`);
  });
  return defauts;
}

async function ouvrirPage(p, page) {
  if (page === 'recherche') {
    await p.click('.nav-search');
    await p.fill('#rechInput', 'pcr');
    await p.waitForSelector('#rechRes li');
    /* le panneau s'ouvre en fondu : tant qu'un ancêtre est transparent, ses boutons seraient ignorés par la mesure */
    await p.waitForFunction(() => { for (let x = document.getElementById('rechFermer'); x; x = x.parentElement) if (Number(getComputedStyle(x).opacity) < 1) return false; return true; });
    return;
  }
  await p.evaluate((h) => { location.hash = h; }, page);
  if (page === '#contact' || page.split('/').length === 3) await p.waitForSelector('#fiche', { state: 'visible' });
  else await p.waitForSelector('#vue .vt');
  await p.waitForTimeout(450);
}

for (const largeur of TAILLES) for (const theme of THEMES) {
  test(`revue ${largeur} px, thème ${theme}`, async () => {
    const tous = [];
    for (const page of PAGES) {
      const p = await env.page({ viewport: { width: largeur, height: largeur > 900 ? 850 : 844 }, stockage: { 'ab-theme': theme } });
      await ouvrirPage(p, page);
      (await p.evaluate(mesurer)).forEach((d) => tous.push(`${page} : ${d}`));
      await p.keyboard.press('Shift+Tab');
      (await p.evaluate(focusVisible)).forEach((d) => tous.push(`${page} : ${d}`));
      await p.close();
    }
    const uniques = [...new Set(tous)];
    assert.deepEqual(uniques, [], `\n${uniques.join('\n')}`);
  });
}

/* défauts vus sur les captures : repère dégradé illisible en clair, cartes mal alignées dans une rangée */
for (const theme of THEMES) {
  test(`captures, thème ${theme} : dégradés lisibles, cartes alignées`, async () => {
    const p = await env.page({ viewport: { width: 1366, height: 850 }, stockage: { 'ab-theme': theme } });
    await ouvrirPage(p, '#liens');
    const degrades = await p.$$eval('#vue .carte-lien .degrade', (xs) => xs.map((x) => {
      const s = getComputedStyle(x);
      const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const premier = /(rgba?|color)\([^)]*\)/.exec(s.backgroundImage);
      if (!premier) return 0;
      const conv = (c) => (c.startsWith('color(') ? 'rgb(' + c.match(/[\d.]+/g).slice(0, 3).map((v) => v * 255).join(',') + ')' : c);
      const [a, b] = [lum(s.color), lum(conv(premier[0]))].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    }));
    assert.ok(degrades.length > 0);
    degrades.forEach((r) => assert.ok(r >= 4.5, `contraste du dégradé ${r.toFixed(2)}`));
    const hauts = await p.$$eval('#vue .rangee:first-of-type .carte-lien .btn', (xs) => xs.slice(0, 4).map((x) => Math.round(x.getBoundingClientRect().top)));
    assert.equal(new Set(hauts).size, 1, `boutons Ouvrir à des hauteurs différentes : ${hauts}`);
    await ouvrirPage(p, '#accueil');
    const lbl = await p.$$eval('#vue .carte-domaine b', (xs) => xs.map((x) => Math.round(x.getBoundingClientRect().top)));
    assert.equal(new Set(lbl).size, 1, `titres des cartes « Ce que je fais » à des hauteurs différentes : ${lbl}`);
    await p.close();
  });
}

/* passe visuelle à 320 px : en-tête sur deux lignes au plus, aucun texte qui sort de sa carte, en-tête admin sur une ligne */
test('320 px : en-tête lisible, textes contenus dans leurs cartes', async () => {
  const defauts = [];
  for (const page of ['#accueil', '#parcours', '#parcours/formation', '#parcours/certifications', '#liens/projets']) {
    const p = await env.page({ viewport: { width: 320, height: 760 } });
    await ouvrirPage(p, page);
    (await p.evaluate(() => {
      const d = [];
      const brand = document.querySelector('.brand');
      if (brand.getBoundingClientRect().height > 44.5) d.push(`marque haute de ${Math.round(brand.getBoundingClientRect().height)} px`);
      brand.querySelectorAll('b, small').forEach((x) => { if (x.scrollWidth > x.clientWidth + 1) d.push(`marque tronquée : ${x.textContent}`); });
      document.querySelectorAll('#vue .carte').forEach((carte) => {
        const r = carte.getBoundingClientRect();
        const w = document.createTreeWalker(carte, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (!n.textContent.trim()) continue;
          const g = document.createRange(); g.selectNodeContents(n);
          const t = g.getBoundingClientRect();
          if (t.width && t.right > r.right + 1) d.push(`texte hors de sa carte : « ${n.textContent.trim().slice(0, 30)} »`);
        }
      });
      return d;
    })).forEach((x) => defauts.push(`${page} : ${x}`));
    await p.close();
  }
  const jeton = JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });
  const a = await env.page({ chemin: '/admin/', viewport: { width: 320, height: 760 }, stockage: { 'ab-jeton': jeton } });
  await a.waitForSelector('.adm-top .btn');
  (await a.$$eval('.adm-top .btn', (xs) => xs.map((x) => { const g = document.createRange(); g.selectNodeContents(x); const lignes = new Set([...g.getClientRects()].map((q) => Math.round(q.top))).size; return { t: x.textContent, h: x.getBoundingClientRect().height, r: x.getBoundingClientRect().right, lignes }; })))
    .forEach((b) => {
      if (b.h > 48 || b.h < 44) defauts.push(`admin : bouton « ${b.t} » haut de ${Math.round(b.h)} px`);
      if (b.lignes > 1) defauts.push(`admin : bouton « ${b.t} » sur ${b.lignes} lignes`);
      if (b.r > 320) defauts.push(`admin : bouton « ${b.t} » hors de l'écran`);
    });
  await a.close();
  assert.deepEqual([...new Set(defauts)], []);
});
