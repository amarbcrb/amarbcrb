/* Un visiteur comprend vite : phrase sous chaque titre d'onglet, Accueil qui dit qui je suis et où aller. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';
import { normaliser } from '../assets/model.js';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); Object.assign(env.faux.etat, { contenu: c, version: c.version }); };

test('une phrase sous le titre de chaque onglet (Parcours, Portfolio, Liens, onglet à moi)', async () => {
  reinit((c) => {
    c.onglets.perso = [{ id: 'tabciel', nom: 'Ciel', icone: 'globe', couleur: '--c-indigo', type: 'rangees', dossierId: '', visible: true, sousTitre: 'Mes photos du ciel.' }];
    c.pages = { tabciel: { rangees: [] } };
  });
  const p = await env.page();
  for (const [onglet, attendu] of [['parcours', /formation/i], ['portfolio', /design/i], ['liens', /projets/i], ['tabciel', /Mes photos du ciel/]]) {
    await p.evaluate((h) => { location.hash = h; }, '#' + onglet);
    await p.waitForSelector(`#vue .v-${onglet} > h1 + p.sous-titre`);
    assert.match(await p.innerText(`#vue .v-${onglet} > p.sous-titre`), attendu, onglet);
  }
});

test('contenu publié sans phrases d\'onglet : normaliser met les phrases par défaut, sans écraser les miennes', () => {
  const brut = DEFAUT();
  delete brut.onglets.portfolio.sousTitre;
  brut.onglets.liens.sousTitre = 'Ma phrase.';
  const c = normaliser(brut);
  assert.match(c.onglets.portfolio.sousTitre, /design/i);
  assert.equal(c.onglets.liens.sousTitre, 'Ma phrase.');
});

test('Accueil : qui je suis, puis « Voir mon parcours » et « Me contacter », avant le carrousel', async () => {
  reinit();
  const p = await env.page();
  const ordre = await p.$$eval('#vue .accueil > *', (xs) => xs.map((x) => x.className.split(' ')[0] || x.tagName.toLowerCase()));
  assert.ok(ordre.indexOf('salut') < ordre.indexOf('carrousel'), ordre.join(','));
  assert.ok(ordre.indexOf('acts') < ordre.indexOf('carrousel'), ordre.join(','));
  const boutons = await p.$$eval('#vue .accueil > .acts a', (xs) => xs.map((x) => [x.textContent, x.getAttribute('href'), x.classList.contains('pri')]));
  assert.deepEqual(boutons.slice(0, 2), [['Voir mon parcours', '#parcours', true], ['Me contacter', '#contact', false]]);
});

test('mode Modifier : la phrase d\'un onglet se modifie sur place et se publie', async () => {
  reinit();
  const jeton = JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });
  const p = await env.page({ chemin: '/#portfolio', stockage: { 'ab-jeton': jeton } });
  await p.click('#modifier');
  await p.waitForSelector('body.edition .barre-edition');
  await p.click('#vue p.sous-titre');
  await p.keyboard.press('Control+A');
  await p.keyboard.type('Affiches, logos et vidéos.');
  await p.locator('#vue p.sous-titre').evaluate((x) => x.blur());
  await p.click('.barre-edition button:has-text("Publier")');
  await p.waitForSelector('.barre-edition [role="status"]:has-text("Publié")');
  assert.equal(env.faux.etat.contenu.onglets.portfolio.sousTitre, 'Affiches, logos et vidéos.');
});
