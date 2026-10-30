/* Accueil vivant (photo + statut, rôles qui défilent, bande de techniques, repères colorés), barre au-dessus
   du glissement d'onglet, aucun fichier stocké dans le dépôt (Google Drive et liens en ligne seulement). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); Object.assign(env.faux.etat, { contenu: c, version: c.version }); };

test('Accueil : photo, statut, rôles, bande de techniques et repères colorés', async () => {
  reinit((c) => { c.medias.photo = { url: '/favicon-512x512.png' }; });
  const p = await env.page();
  assert.equal(await p.locator('#vue .accueil > .hero-tete img.avatar').count(), 1);
  assert.equal(await p.innerText('#vue .hero-tete .statut'), 'Microbiologie · Lyon 1');
  /* mouvement réduit : les rôles sont écrits à la suite */
  assert.match(await p.innerText('#vue .accueil > .roles'), /Microbiologie.*Graphisme/s);
  const puces = await p.$$eval('#vue .defile li:not([aria-hidden])', (xs) => xs.map((x) => x.textContent));
  assert.ok(puces.includes('PCR') && puces.includes('ELISA'), puces.join(','));
  const fonds = await p.$$eval('#vue .reperes li', (xs) => xs.map((x) => x.style.getPropertyValue('--pc')));
  assert.equal(new Set(fonds).size, 3);
  const ordre = await p.$$eval('#vue .accueil > *', (xs) => xs.map((x) => x.className.split(' ')[0]));
  assert.ok(ordre.indexOf('hero-tete') < ordre.indexOf('salut') && ordre.indexOf('defile') < ordre.indexOf('carrousel'), ordre.join(','));
  assert.deepEqual(p.erreurs, []);
});

test('Accueil animé : les rôles tournent un par un, la bande défile', async () => {
  reinit();
  const p = await env.page({ mouvementReduit: false });
  const actif = () => p.$eval('#vue .roles .on', (x) => x.textContent);
  const premier = await actif();
  await p.waitForFunction((m) => document.querySelector('#vue .roles .on').textContent !== m, premier, { timeout: 4000 });
  assert.notEqual(await actif(), premier);
  assert.match(await p.$eval('#vue .defile ul', (x) => getComputedStyle(x).animationName), /defile/);
});

test('changement d\'onglet : la barre et l\'en-tête ont leur propre calque, au-dessus de la page qui glisse', async () => {
  reinit();
  const p = await env.page({ mouvementReduit: false });
  const noms = await p.evaluate(() => ['.nav-in', '.nav-search', '.top', '#vue'].map((s) => getComputedStyle(document.querySelector(s)).viewTransitionName));
  assert.deepEqual(noms, ['nav', 'loupe', 'entete', 'vue']);
});

test('aucun fichier stocké dans le dépôt : ni images intégrées, ni dossiers Poster, Design, Diaporama', () => {
  for (const f of ['../assets/images', '../assets/images-integrees.js', '../Poster', '../Design', '../Diaporama', '../portfolio.json'])
    assert.equal(existsSync(new URL(f, import.meta.url)), false, f);
});
