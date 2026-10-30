/* Admin allégé : Médias, Visibilité et maintenance, Onglets (création d'onglets libres ou galeries Drive). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const jeton = JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); Object.assign(env.faux.etat, { contenu: c, version: c.version }); };
const champ = (chemin) => `[data-chemin="${chemin}"]`;
async function ecran(id) {
  const p = await env.page({ chemin: '/admin/', stockage: { 'ab-jeton': jeton } });
  await p.click(`.ecrans [data-ecran="${id}"]`);
  return p;
}
async function enregistrer(p) {
  await p.click('#enregistrer');
  await p.waitForSelector('#etat:has-text("Enregistré")');
}
const PERSO = (id, nom) => ({ id, nom, icone: 'etoile', couleur: '--c-purple', type: 'rangees', dossierId: '', visible: true });

test('admin : trois écrans seulement (Médias, Visibilité et maintenance, Onglets), Médias par défaut', async () => {
  reinit();
  const p = await env.page({ chemin: '/admin/', stockage: { 'ab-jeton': jeton } });
  await p.waitForSelector('.ecrans button');
  assert.deepEqual(await p.$$eval('.ecrans button', (xs) => xs.map((x) => x.textContent)), ['Médias', 'Visibilité et maintenance', 'Onglets']);
  assert.equal(await p.getAttribute('.ecrans [data-ecran="medias"]', 'aria-current'), 'page');
  assert.equal(await p.inputValue(champ('site.nom')), 'Amar Bouchareb');
});

test('onglets : créer un onglet libre (nom, icône, couleur) → dans la barre du site', async () => {
  reinit();
  const p = await ecran('onglets');
  await p.click('[data-bloc="onglets"] .ajouter');
  await p.fill(champ('onglets.perso.0.nom'), 'Astronomie');
  await p.selectOption(champ('onglets.perso.0.icone'), 'globe');
  await p.selectOption(champ('onglets.perso.0.couleur'), '--c-indigo');
  await enregistrer(p);
  const o = env.faux.etat.contenu.onglets.perso[0];
  assert.deepEqual([o.nom, o.icone, o.couleur, o.type], ['Astronomie', 'globe', '--c-indigo', 'rangees']);
  const site = await env.page();
  assert.equal(await site.innerText(`.nav .nb[data-v="${o.id}"]`), 'Astronomie');
});

test('onglets : galerie Drive par lien → dossierGalerie appelé, dossierId gardé', async () => {
  reinit();
  const p = await ecran('onglets');
  await p.click('[data-bloc="onglets"] .ajouter');
  await p.fill(champ('onglets.perso.0.nom'), 'Ciel');
  await p.selectOption(champ('onglets.perso.0.type'), 'drive');
  await p.fill('[data-bloc="onglets"] input.lien-galerie', 'https://drive.google.com/drive/folders/g1abc');
  await p.click('[data-bloc="onglets"] button:has-text("Utiliser ce dossier")');
  await p.waitForSelector('[data-bloc="onglets"] [role="status"]:has-text("Dossier choisi")');
  await enregistrer(p);
  assert.equal(env.faux.etat.contenu.onglets.perso[0].dossierId, 'g1abc');
});

test('onglets : un 3e onglet créé quand 6 sont déjà visibles → refusé', async () => {
  reinit((c) => { c.onglets.perso = [PERSO('t1', 'Un'), PERSO('t2', 'Deux')]; });
  const p = await ecran('onglets');
  p.once('dialog', (d) => { assert.match(d.message(), /6 onglets au plus/); d.accept(); });
  await p.click('[data-bloc="onglets"] .ajouter');
  assert.equal(await p.locator('[data-bloc="onglets"] li').count(), 2);
});

test('onglets : réordonner, masquer, supprimer', async () => {
  reinit((c) => { c.onglets.perso = [PERSO('t1', 'Un'), PERSO('t2', 'Deux')]; });
  const p = await ecran('onglets');
  await p.click('[data-bloc="onglets"] li >> nth=1 >> .monter');
  await p.uncheck(champ('onglets.perso.1.visible'));
  p.once('dialog', (d) => d.accept());
  await p.click('[data-bloc="onglets"] li >> nth=0 >> .supprimer');
  await enregistrer(p);
  assert.deepEqual(env.faux.etat.contenu.onglets.perso.map((o) => [o.id, o.visible]), [['t1', false]]);
});

test('visibilité : rubriques de Parcours et dossiers du Portfolio', async () => {
  reinit();
  env.faux.etat.portfolio.dossiers = [{ id: 'dd', nom: '1 - Design', fichiers: [] }];
  const p = await ecran('visibilite');
  await p.uncheck(champ('onglets.parcours.sous.interets.visible'));
  await p.waitForSelector(champ('portfolio.dossiers.dd.visible'));
  await p.uncheck(champ('portfolio.dossiers.dd.visible'));
  await enregistrer(p);
  assert.equal(env.faux.etat.contenu.onglets.parcours.sous.interets.visible, false);
  assert.equal(env.faux.etat.contenu.portfolio.dossiers.dd.visible, false);
});
