/* Partages : posts LinkedIn et articles (« À lire »), avec mon avis ; post LinkedIn intégré dans sa fiche. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';
import { typeLien, urlIntegrationLinkedin, normaliser } from '../assets/model.js';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const POST = 'https://www.linkedin.com/posts/amar-bouchareb_microbiologie-activity-7123456789012345678-AbCd';
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); Object.assign(env.faux.etat, { contenu: c, version: c.version, apercus: {} }); };
const partage = (id, date, extra = {}) => ({ id, url: `${POST}?${id}`, titre: `Partage ${id}`, description: 'Un post sur la PCR.', image: '', categorie: 'alire',
  date, bouton: '', type: '', media: null, avis: `Mon avis ${id}`, visible: true, ...extra });

test('type « Post LinkedIn » reconnu par l\'adresse ; profil = site web ; /pulse/ = article', () => {
  assert.equal(typeLien({ url: POST }), 'linkedin');
  assert.equal(typeLien({ url: 'https://www.linkedin.com/feed/update/urn:li:share:7000000000000000001/' }), 'linkedin');
  assert.equal(typeLien({ url: 'https://www.linkedin.com/in/amar-bouchareb/' }), 'web');
  assert.equal(typeLien({ url: 'https://www.linkedin.com/pulse/la-pcr-expliquee-amar/' }), 'article');
});

test('adresse d\'intégration d\'un post LinkedIn ; rien pour un profil ou une adresse inattendue', () => {
  assert.equal(urlIntegrationLinkedin(POST), 'https://www.linkedin.com/embed/feed/update/urn:li:activity:7123456789012345678');
  assert.equal(urlIntegrationLinkedin('https://www.linkedin.com/posts/x_y-ugcPost-7111111111111111111-zz'), 'https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7111111111111111111');
  assert.equal(urlIntegrationLinkedin('https://www.linkedin.com/feed/update/urn:li:share:7000000000000000001/'), 'https://www.linkedin.com/embed/feed/update/urn:li:share:7000000000000000001');
  assert.equal(urlIntegrationLinkedin('https://www.linkedin.com/in/amar/'), null);
  assert.equal(urlIntegrationLinkedin('https://evil.example/posts/x-activity-7123456789012345678-a'), null);
});

test('catégorie « À lire » ajoutée une seule fois au contenu existant (supprimée volontairement : ne revient pas)', () => {
  const brut = DEFAUT();
  brut.liens.categories = brut.liens.categories.filter((x) => x.id !== 'alire');
  delete brut.liens.alireAjoute;
  const c = normaliser(brut);
  assert.ok(c.liens.categories.some((x) => x.id === 'alire' && x.nom === 'À lire'));
  assert.equal(c.liens.alireAjoute, true);
  const sansAlire = normaliser({ ...c, liens: { ...c.liens, categories: c.liens.categories.filter((x) => x.id !== 'alire') } });
  assert.equal(sansAlire.liens.categories.some((x) => x.id === 'alire'), false);
  assert.equal(normaliser(brut).liens.items[0].avis, '');
});

test('carte d\'un partage : mon avis visible ; post LinkedIn → fiche avec le post intégré et « Voir sur LinkedIn »', async () => {
  reinit((c) => { c.liens.items.push(partage('p1', '2026-10-20')); });
  const p = await env.page({ chemin: '/#liens/alire' });
  const carte = p.locator('#vue a.carte-lien:has-text("Partage p1")');
  assert.match(await carte.innerText(), /Mon avis p1/);
  assert.equal(await carte.getAttribute('href'), '#liens/alire/p1');
  assert.equal(await carte.getAttribute('target'), null);
  await carte.click();
  await p.waitForSelector('#fiche', { state: 'visible' });
  assert.equal(await p.getAttribute('#ficheCorps iframe.lecteur-linkedin', 'src'), 'https://www.linkedin.com/embed/feed/update/urn:li:activity:7123456789012345678');
  assert.match(await p.innerText('#ficheCorps .avis'), /Mon avis p1/);
  const voir = p.locator('#ficheCorps a.btn:has-text("Voir sur LinkedIn")');
  assert.equal(await voir.getAttribute('href'), `${POST}?p1`);
  assert.equal(await voir.getAttribute('target'), '_blank');
});

test('Accueil : rangée « À lire » avec les 3 derniers partages ; « Projets » ne les reprend pas', async () => {
  reinit((c) => { c.liens.items.push(partage('p1', '2026-09-01'), partage('p2', '2026-10-01'), partage('p3', '2026-10-15'), partage('p4', '2026-10-28')); });
  const p = await env.page();
  const rangee = p.locator('#vue .rangee:has(h2:text-is("À lire"))');
  assert.deepEqual(await rangee.locator('.carte-lien b').allInnerTexts(), ['Partage p4', 'Partage p3', 'Partage p2']);
  assert.equal(await rangee.locator('.rangee-tete .voir').getAttribute('href'), '#liens/alire');
  const projets = p.locator('#vue .rangee:has(h2:text-is("Projets"))');
  assert.equal(await projets.locator('.carte-lien:has-text("Partage")').count(), 0);
});

test('mode Modifier : ajouter un partage avec mon avis → publié', async () => {
  reinit();
  const jeton = JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });
  const p = await env.page({ chemin: '/#liens', stockage: { 'ab-jeton': jeton } });
  await p.click('#modifier');
  await p.waitForSelector('body.edition .barre-edition');
  await p.click('button.ajout[data-liste="liens.items"]');
  await p.fill('#ficheCorps [name="url"]', POST);
  await p.fill('#ficheCorps [name="titre"]', 'La PCR en temps réel');
  await p.fill('#ficheCorps [name="avis"]', 'Très clair sur les contrôles qualité.');
  await p.selectOption('#ficheCorps [name="categorie"]', 'alire');
  await p.click('#ficheCorps form.edition-form button[type="submit"]');
  await p.waitForSelector('#fiche', { state: 'hidden' });
  await p.click('.barre-edition button:has-text("Publier")');
  await p.waitForSelector('.barre-edition [role="status"]:has-text("Publié")');
  const x = env.faux.etat.contenu.liens.items.find((y) => y.titre === 'La PCR en temps réel');
  assert.deepEqual([x.avis, x.categorie], ['Très clair sur les contrôles qualité.', 'alire']);
});
