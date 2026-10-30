/* Accueil sans clichés de site IA, barre au-dessus
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

/* rien de ce qui trahit un site fait par une IA : pas de 2e photo, pas de capsule à point vert, pas de mots qui
   tournent, pas de bande de puces qui défile, pas d'anneau arc-en-ciel, pas de lueur, pas de compteur qui compte */
test('Accueil sans clichés de site IA', async () => {
  reinit((c) => { c.medias.photo = { url: '/favicon-512x512.png?p' }; });
  const p = await env.page({ mouvementReduit: false });
  for (const s of ['.hero-tete', '.avatar', '.statut', '.roles', '.defile', '.revele'])
    assert.equal(await p.locator(`#vue ${s}`).count(), 0, s);
  assert.equal(await p.locator('img[src="/favicon-512x512.png?p"]').count(), 0);
  /* aucune animation sans fin hors carrousel ; les repères s'affichent tels quels */
  const sansFin = await p.$$eval('#vue *', (xs) => xs.filter((x) => getComputedStyle(x).animationIterationCount === 'infinite').map((x) => x.className));
  assert.deepEqual(sansFin, []);
  assert.equal(await p.innerText('#vue .reperes li >> nth=1 >> b'), '2022');
  assert.deepEqual(await p.$$eval('#vue .reperes li', (xs) => xs.map((x) => x.getAttribute('style'))), [null, null, null]);
  const boutons = await p.$$eval('#vue .accueil > .acts a', (xs) => xs.map((x) => Math.round(x.getBoundingClientRect().top)));
  assert.equal(new Set(boutons.slice(0, 2)).size, 1, 'boutons côte à côte');
  assert.deepEqual(p.erreurs, []);
});

test('frise : l\'étape en cours est marquée sans pulsation', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours', mouvementReduit: false });
  assert.notEqual(await p.$eval('#vue .point.actif', (x) => getComputedStyle(x).animationIterationCount), 'infinite');
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
