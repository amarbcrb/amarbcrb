/* v6 : médias calmes (pas de zoom), carrousel moins large avec la diapo suivante visible, apparition flou + glissement,
   squelettes du portfolio, geste de démonstration de la barre, boutons du contact, chargement en un seul aller. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const CSS = readFileSync(new URL('../assets/site.css', import.meta.url), 'utf8');
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); Object.assign(env.faux.etat, { contenu: c, version: c.version }); env.faux.etat.reglages.lent = 0; };

test('médias : ni zoom au survol, ni zoom lent sur les images et GIF', () => {
  assert.doesNotMatch(CSS, /:hover \.visuel>img[^{]*\{[^}]*scale/);
  assert.doesNotMatch(CSS, /animation:lent/);
});

test('carrousel : diapo moins large que la piste (la suivante dépasse), image toujours en plein cadre', async () => {
  reinit((c) => { c.accueil.domaines[0].image = { id: 'x', url: '/favicon-512x512.png?carre' }; });
  for (const [viewport, max] of [[{ width: 390, height: 844 }, 360], [{ width: 1366, height: 900 }, 720]]) {
    const p = await env.page({ viewport });
    const [d, piste] = await Promise.all([p.locator('#vue .diapo >> nth=0').boundingBox(), p.locator('#vue .carrousel-piste').boundingBox()]);
    assert.ok(d.width <= max && d.width < piste.width * 0.92, `${viewport.width} : diapo ${d.width}, piste ${piste.width}`);
    await p.waitForSelector('#vue .diapo-visuel[data-cadrage]');
    assert.equal(await p.getAttribute('#vue .diapo-visuel >> nth=0', 'data-cadrage'), 'cover');
  }
});

test('carrousel : les points mènent à la bonne diapo malgré la largeur réduite', async () => {
  reinit();
  const p = await env.page();
  await p.click('#vue .carrousel .points button >> nth=2');
  await p.waitForFunction(() => document.querySelector('#vue .carrousel .points button:nth-child(3)').getAttribute('aria-current') === 'true');
});

test('défilement : les blocs apparaissent en glissant avec un flou (rien en mouvement réduit)', async () => {
  reinit();
  let p = await env.page({ chemin: '/#parcours', mouvementReduit: false });
  assert.match(await p.$eval('#vue .rangee', (x) => getComputedStyle(x).animationName), /apparait/);
  assert.match(CSS, /@keyframes apparait\{from\{[^}]*blur/);
  p = await env.page({ chemin: '/#parcours' });
  assert.doesNotMatch(await p.$eval('#vue .rangee', (x) => getComputedStyle(x).animationName), /apparait/);
});

test('portfolio : des formes grises animées pendant le chargement, pas « Chargement… »', async () => {
  reinit();
  const p = await env.page();
  env.faux.etat.reglages.lent = 4000;
  await p.evaluate(() => { location.hash = '#portfolio'; });
  await p.waitForSelector('#vue .squelette[aria-busy="true"] .sq');
  assert.doesNotMatch(await p.innerText('#vue'), /Chargement…/);
  assert.ok(await p.locator('#vue .squelette .sq').count() >= 6);
  env.faux.etat.reglages.lent = 0;
});

test('barre : au repos, la pastille fait seule un petit glissement pour montrer le verre liquide (une fois)', async () => {
  reinit();
  const p = await env.page({ mouvementReduit: false });
  await p.waitForSelector('.nav-in[data-demo]', { timeout: 5000 });
  assert.equal(await p.getAttribute('.nb[aria-current="page"]', 'data-v'), 'accueil');
  await p.waitForSelector('.nav-in:not([data-demo])', { timeout: 5000 });
  const r = await env.page();
  await r.waitForTimeout(2500);
  assert.equal(await r.locator('.nav-in[data-demo]').count(), 0);
});

test('contact : e-mail (Copier, Écrire avec Gmail sur PC) et LinkedIn (Copier le lien, Ouvrir), boutons sous le texte', async () => {
  reinit();
  const p = await env.page({ chemin: '/#contact' });
  await p.waitForSelector('#fiche', { state: 'visible' });
  const mail = await p.getAttribute('#ficheCorps a.cp:has-text("Écrire")', 'href');
  assert.equal(mail, 'https://mail.google.com/mail/?view=cm&fs=1&to=amarxbcrb%40gmail.com');
  assert.equal(await p.getAttribute('#ficheCorps li.row:has-text("LinkedIn") button.cp', 'data-copier'), 'https://www.linkedin.com/in/amarbouchareb');
  assert.equal(await p.getAttribute('#ficheCorps li.row:has-text("LinkedIn") a.cp:has-text("Ouvrir")', 'href'), 'https://www.linkedin.com/in/amarbouchareb');
  assert.equal(await p.locator('#ficheCorps li.row:has-text("E-mail") button.cp[data-copier="amarxbcrb@gmail.com"]').count(), 1);
  const [texte, bouton] = await Promise.all([p.locator('#ficheCorps li.row:has-text("LinkedIn") .t').boundingBox(), p.locator('#ficheCorps li.row:has-text("LinkedIn") .cps').boundingBox()]);
  assert.ok(bouton.y >= texte.y + texte.height - 1, 'boutons sous le lien');
});

test('chargement : tout le code de départ est annoncé d\'un coup (modulepreload)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const m of ['site', 'api', 'model', 'dom', 'router', 'nav', 'render', 'cartes', 'media', 'drapeaux', 'carrousel', 'search', 'fiche'])
    assert.match(html, new RegExp(`'${m}'[^\\]]*\\].forEach[\\s\\S]*modulepreload`), m);
});
