/* Mes vraies images (posters, logos) affichées par défaut là où un élément n'a pas d'image ; la mienne passe avant. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { demarrer } from './helpers.mjs';
import { imageIntegree } from '../assets/images-integrees.js';
import { normaliser, parties } from '../assets/model.js';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); Object.assign(env.faux.etat, { contenu: c, version: c.version }); };

test('correspondances : poster Lyon 1, poster Clermont, logo UMMTO, librairie, Kenza\'s touch ; fichiers légers', () => {
  assert.match(imageIntegree('parcours.formation', { titre: 'Master 1 Microbiologie', lieu: 'Université Claude Bernard Lyon 1' }), /poster-microbiome-fromage/);
  assert.match(imageIntegree('parcours.formation', { titre: 'Licence 3', lieu: 'Université Clermont Auvergne' }), /poster-variole/);
  assert.match(imageIntegree('parcours.formation', { titre: 'Licence en Parasitologie', lieu: '' }), /logo-ummto/);
  assert.match(imageIntegree('accueil.domaines', { titre: 'Graphisme' }), /librairie/);
  assert.match(imageIntegree('accueil.domaines', { titre: 'Microbiologie' }), /microbiome/);
  assert.match(imageIntegree('parcours.interets', { titre: 'Design' }), /kenzas-touch/);
  assert.equal(imageIntegree('parcours.formation', { titre: 'Baccalauréat', lieu: 'Lycée' }), null);
  ['poster-microbiome-fromage', 'poster-variole', 'design-librairie-monalisait', 'design-logo-ummto', 'design-kenzas-touch']
    .forEach((n) => assert.ok(statSync(new URL(`../assets/images/${n}.jpg`, import.meta.url)).size < 300 * 1024, n));
});

test('parties : image par défaut sur une copie, jamais écrite dans le contenu ; mon image passe avant', () => {
  const c = normaliser(DEFAUT());
  const f = parties(c, 'parcours').find((p) => p.id === 'formation').items;
  assert.match(f.find((x) => x.id === 'f1').image.url, /poster-microbiome-fromage/);
  assert.ok(!c.parcours.formation.find((x) => x.id === 'f1').image);
  c.parcours.formation.find((x) => x.id === 'f1').image = { url: 'https://exemple.fr/moi.jpg' };
  assert.equal(parties(c, 'parcours').find((p) => p.id === 'formation').items.find((x) => x.id === 'f1').image.url, 'https://exemple.fr/moi.jpg');
});

test('site : carrousel et cartes avec mes images ; fiche de formation avec le poster', async () => {
  reinit();
  const p = await env.page();
  await p.waitForSelector('#vue .carrousel img[src*="poster-microbiome-fromage"]', { state: 'attached' });
  await p.waitForSelector('#vue .carte-domaine img[src*="design-librairie-monalisait"]', { state: 'attached' });
  await p.evaluate(() => { location.hash = '#parcours/formation/f2'; });
  await p.waitForSelector('#ficheCorps .fiche-banniere img[src*="poster-variole"]', { state: 'attached' });
  assert.deepEqual(p.erreurs, []);
});

test('mode Modifier : le champ image d\'un élément sans image reste vide (l\'image par défaut n\'est pas la sienne)', async () => {
  reinit();
  const jeton = JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });
  const p = await env.page({ chemin: '/#parcours', stockage: { 'ab-jeton': jeton } });
  await p.click('#modifier');
  await p.waitForSelector('body.edition .barre-edition');
  await p.click('.outils-edition[data-pour="parcours.formation#f1"] button[aria-label^="Modifier"]');
  await p.waitForSelector('#ficheCorps .champ-media');
  assert.equal(await p.locator('#ficheCorps .champ-media img').count(), 0);
});
