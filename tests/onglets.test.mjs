/* Onglets créés par Amar : « rangées libres » et « galerie Drive ». */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const PERSO = (id, extra = {}) => ({ id, nom: 'Astronomie', icone: 'etoile', couleur: '--c-purple', type: 'rangees', dossierId: '', visible: true, ...extra });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); env.faux.etat.contenu = c; env.faux.etat.version = c.version; };
const ASTRO = (c) => {
  c.onglets.perso = [PERSO('tabastro')];
  c.pages = { tabastro: { rangees: [{ id: 'rg1', titre: 'Occultations', visible: true, cartes: [
    { id: 'ct1', titre: 'Occultation de Régulus', texte: 'Observée depuis le club en 2024.', media: { url: '/favicon-512x512.png', type: 'image' }, lien: 'https://exemple.fr/regulus', bouton: 'Voir le compte rendu', visible: true },
    { id: 'ct2', titre: 'Éclipse', texte: '', media: { url: 'https://youtu.be/dQw4w9WgXcQ' }, lien: '', bouton: '', visible: true }] }] } };
};

test('onglet libre : bouton dans la barre, rangée de cartes, fiche avec texte, lecteur et bouton du lien', async () => {
  reinit(ASTRO);
  const p = await env.page();
  assert.deepEqual(await p.$$eval('.nav .nb', (bs) => bs.map((b) => [b.dataset.v, b.textContent.trim()])),
    [['accueil', 'Accueil'], ['parcours', 'Parcours'], ['portfolio', 'Portfolio'], ['liens', 'Liens'], ['tabastro', 'Astronomie']]);
  assert.equal(await p.locator('.nav .nb[data-v="tabastro"] svg path').count() > 0, true);
  await p.click('.nav .nb[data-v="tabastro"]');
  await p.waitForFunction(() => location.hash === '#tabastro');
  assert.equal(await p.innerText('#vue h1'), 'Astronomie');
  assert.equal(await p.innerText('#vue .rangee-tete h2'), 'Occultations');
  assert.match(await p.innerText('#vue .carte-libre >> nth=0'), /Occultation de Régulus[\s\S]*Observée depuis le club/);
  assert.equal(await p.getAttribute('#vue .carte-libre >> nth=0 >> .visuel img', 'src'), '/favicon-512x512.png');
  await p.click('#vue .carte-libre >> nth=0');
  await p.waitForSelector('#fiche', { state: 'visible' });
  assert.equal(await p.evaluate(() => location.hash), '#tabastro/rg1/ct1');
  assert.equal(await p.innerText('#ficheTitre'), 'Occultation de Régulus');
  assert.equal(await p.getAttribute('#ficheCorps a.btn:has-text("Voir le compte rendu")', 'href'), 'https://exemple.fr/regulus');
  await p.keyboard.press('Escape');
  await p.evaluate(() => { location.hash = '#tabastro/rg1/ct2'; });
  await p.waitForSelector('#ficheCorps iframe');
  assert.equal(await p.getAttribute('#ficheCorps iframe', 'src'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
});

test('galerie Drive : rangées des dossiers (préfixe retiré), fichiers de la racine en premier, visionneuse', async () => {
  reinit((c) => { c.onglets.perso = [PERSO('tabgal', { type: 'drive', dossierId: 'g1', nom: 'Ciel' })]; });
  const img = (id, nom) => ({ id, nom, type: 'image/jpeg', apercu: `/favicon-512x512.png?${id}`, lien: `https://drive.google.com/file/d/${id}/view` });
  env.faux.etat.galeries = { g1: { dossiers: [{ id: 'd1', nom: '1 - Lune', fichiers: [img('l1', 'lune.jpg')] }], fichiers: [img('c1', 'ciel.jpg')] } };
  const p = await env.page({ chemin: '/#tabgal' });
  await p.waitForSelector('#vue .rangee');
  assert.deepEqual(await p.$$eval('#vue .rangee-tete h2', (xs) => xs.map((x) => x.textContent)), ['Ciel', 'Lune']);
  await p.click('#vue .vignette >> nth=0');
  await p.waitForSelector('#lb.on');
  assert.match(await p.getAttribute('#lb img', 'src'), /\?c1$/);
});

test('6 onglets au plus dans la barre ; un onglet masqué n\'y est pas et son adresse mène à l\'Accueil', async () => {
  reinit((c) => { c.onglets.perso = [PERSO('t1', { nom: 'Un' }), PERSO('t2', { nom: 'Deux', visible: false }), PERSO('t3', { nom: 'Trois' }), PERSO('t4', { nom: 'Quatre' })]; });
  const p = await env.page();
  assert.deepEqual(await p.$$eval('.nav .nb', (bs) => bs.map((b) => b.dataset.v)), ['accueil', 'parcours', 'portfolio', 'liens', 't1', 't3']);
  await p.evaluate(() => { location.hash = '#t2'; });
  await p.waitForFunction(() => location.hash === '#accueil');
});

test('recherche : trouve une carte d\'onglet libre et ouvre sa fiche', async () => {
  reinit(ASTRO);
  const p = await env.page();
  await p.click('.nav-search');
  await p.fill('#rechInput', 'régulus');
  await p.click('#rechRes [data-cible="#tabastro/rg1/ct1"]');
  await p.waitForSelector('#fiche', { state: 'visible' });
  assert.equal(await p.innerText('#ficheTitre'), 'Occultation de Régulus');
});
