/* Finitions : défauts relevés aux revues v4 et v5. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';
import { construireIndex } from '../assets/search.js';
import { normaliser } from '../assets/model.js';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const jeton = () => JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });
const img = (id, nom) => ({ id, nom, type: 'image/jpeg', apercu: `/favicon-512x512.png?${id}`, lien: `https://drive.google.com/file/d/${id}/view` });
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => {
  const c = DEFAUT(); if (modif) modif(c);
  Object.assign(env.faux.etat, { contenu: c, version: c.version, proteges: {}, echecsDossiers: {}, liensDossiers: {}, fichiersDrive: {} });
  env.faux.regler({ panne: false, lent: 0 });
  env.faux.etat.portfolio.dossiers = [{ id: 'dd', nom: '1 - Design', fichiers: [img('d1', 'A.jpg')] }, { id: 'dp', nom: '2 - Clients', fichiers: [img('p1', 'B.jpg')] }];
};
async function editer(chemin = '/') {
  const p = await env.page({ chemin, stockage: { 'ab-jeton': jeton() } });
  await p.click('#modifier');
  await p.waitForSelector('body.edition .barre-edition');
  return p;
}

test('recherche : « Mon avis » d\'un partage est trouvé', () => {
  const c = normaliser(DEFAUT());
  c.liens.items.push({ id: 'p1', url: 'https://exemple.fr/a', titre: 'Un article', description: '', image: '', categorie: 'alire', date: '2026-10-01', bouton: '', type: '', media: null, avis: 'Indispensable pour la cytométrie', visible: true });
  assert.ok(construireIndex(c).some((x) => x.titre === 'Un article' && x.texte.includes('cytometrie')));
});

test('mode Modifier : toucher puis quitter un titre vide (nom affiché par défaut) ne crée aucune modification', async () => {
  reinit((c) => { c.accueil.salutation = ''; });
  const p = await editer();
  await p.click('#vue h1.salut');
  await p.locator('#vue h1.salut').evaluate((x) => x.blur());
  assert.equal(await p.innerText('.barre-edition .compte'), '0 modification');
});

test('renommer un dossier : le nom proposé garde son numéro d\'ordre', async () => {
  reinit();
  const p = await editer('/#portfolio');
  let propose = null;
  p.once('dialog', (d) => { propose = d.defaultValue(); d.dismiss(); });
  await p.click('#vue .rangee[data-dossier="dp"] .outils-dossier button[aria-label^="Renommer"]');
  await p.waitForFunction(() => true);
  assert.equal(propose, '2 - Clients');
});

test('galerie Drive vide : en mode Modifier, une rangée pour envoyer le premier fichier ; invisible pour un visiteur', async () => {
  reinit((c) => { c.onglets.perso = [{ id: 'tabg', nom: 'Ciel', icone: 'globe', couleur: '--c-indigo', type: 'drive', dossierId: 'gal', visible: true, sousTitre: '' }]; });
  env.faux.etat.galeries.gal = { dossiers: [], fichiers: [] };
  const v = await env.page({ chemin: '/#tabg' });
  await v.waitForSelector('#vue .v-tabg');
  assert.equal(await v.locator('#vue .rangee[data-dossier="gal"]').isVisible(), false);
  const p = await editer('/#tabg');
  await p.waitForSelector('#vue .rangee[data-dossier="gal"] input[type="file"]', { state: 'attached' });
  assert.equal(await p.locator('#vue .rangee[data-dossier="gal"]').isVisible(), true);
});

test('conflit puis « Recharger » sans réseau → message, brouillon gardé', async () => {
  reinit();
  const p = await editer();
  await p.click('#vue h1.salut');
  await p.keyboard.press('Control+A');
  await p.keyboard.type('Local');
  await p.locator('#vue h1.salut').evaluate((x) => x.blur());
  env.faux.etat.version += 1;
  await p.click('.barre-edition button:has-text("Publier")');
  await p.waitForSelector('.conflit-edition button:has-text("Recharger")');
  env.faux.regler({ panne: true });
  p.once('dialog', (d) => d.accept());
  await p.click('.conflit-edition button:has-text("Recharger")');
  await p.waitForSelector('.barre-edition [role="status"]:has-text("Connexion impossible")');
  env.faux.regler({ panne: false });
  assert.match(await p.evaluate(() => localStorage.getItem('ab-brouillon')), /Local/);
});

test('dossier protégé, clé gardée, réseau coupé → « Connexion impossible », la clé n\'est pas oubliée', async () => {
  reinit();
  env.faux.etat.proteges.dp = 'clients2026';
  const cle = JSON.stringify({ cle: 'cle-dp-clients2026', expire: Date.now() + 864e5 });
  const p = await env.page({ chemin: '/#portfolio', stockage: { 'ab-cle:dp': cle } });
  await p.waitForSelector('#vue .vignette.verrou');
  env.faux.regler({ panne: true });
  await p.click('#vue .vignette.verrou');
  await p.waitForSelector('#ficheCorps [role="status"]:has-text("Connexion impossible")');
  env.faux.regler({ panne: false });
  assert.ok(await p.evaluate(() => localStorage.getItem('ab-cle:dp')));
});
