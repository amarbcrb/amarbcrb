import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const jetonValide = () => JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });

let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); env.faux.etat.contenu = c; env.faux.etat.version = c.version; env.faux.regler({ lent: 0, panne: false, html: false }); };

test('affiche 5 onglets et le bouton recherche', async () => {
  reinit();
  const p = await env.page();
  const libelles = await p.$$eval('.nav .nb', (bs) => bs.map((b) => b.textContent.trim()));
  assert.deepEqual(libelles, ['Accueil', 'Parcours', 'Portfolio', 'Liens']);
  assert.equal(await p.locator('.nav-search').count(), 1);
  assert.equal(await p.getAttribute('.nav-search', 'aria-label'), 'Rechercher');
  const [nav, rech] = await Promise.all([p.locator('.nav').boundingBox(), p.locator('.nav-search').boundingBox()]);
  assert.ok(Math.abs(nav.height - rech.height) < 1, 'même hauteur');
  assert.ok(rech.x > nav.x + nav.width, 'recherche à droite de la barre');
  assert.deepEqual(p.erreurs, []);
});

test('onglet masqué → 3 boutons, barre redimensionnée', async () => {
  reinit((c) => { c.onglets.liens.visible = false; });
  const p = await env.page();
  const boutons = await p.$$eval('.nav .nb', (bs) => bs.map((b) => [b.textContent.trim(), b.getBoundingClientRect().width]));
  assert.deepEqual(boutons.map((b) => b[0]), ['Accueil', 'Parcours', 'Portfolio']);
  const piste = await p.locator('.nav-in').evaluate((e) => e.clientWidth - 8);
  boutons.forEach(([, w]) => assert.ok(Math.abs(w - piste / 3) < 1.5, `bouton ${w} px, piste ${piste} px`));
});

test('mouvement réduit : aucune animation retardée, la barre est à sa taille dès le chargement', async () => {
  reinit();
  const p = await env.page();
  /* le délai déclaré, pas l'animation en cours : au moment de la mesure, elle peut être déjà finie */
  const retardees = await p.evaluate(() => [...document.querySelectorAll('*')]
    .map((x) => [x, getComputedStyle(x)])
    .filter(([, s]) => s.animationName !== 'none' && s.animationDelay.split(',').some((d) => parseFloat(d) > 0))
    .map(([x, s]) => `${s.animationName} sur ${x.tagName.toLowerCase()}.${x.className} (${s.animationDelay})`));
  assert.deepEqual(retardees, []);
  /* une animation en attente de sa première image applique sa première clé (scale .94) : pas d'entrée animée pour la barre */
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.barre')).animationName), 'none');
});

test('cliquer Parcours → adresse #parcours', async () => {
  reinit();
  const p = await env.page();
  await p.click('.nav .nb[data-v="parcours"]');
  await p.waitForFunction(() => location.hash === '#parcours');
  assert.equal(await p.getAttribute('.nav .nb[data-v="parcours"]', 'aria-current'), 'page');
  assert.match(await p.textContent('#vue'), /Parcours/);
});

test('retour arrière navigateur revient à l\'onglet précédent', async () => {
  reinit();
  const p = await env.page();
  await p.click('.nav .nb[data-v="liens"]');
  await p.waitForFunction(() => location.hash.startsWith('#liens'));
  await p.click('.nav .nb[data-v="portfolio"]');
  await p.waitForFunction(() => location.hash.startsWith('#portfolio'));
  await p.goBack();
  await p.waitForFunction(() => location.hash.startsWith('#liens'));
  assert.equal(await p.getAttribute('.nav .nb[data-v="liens"]', 'aria-current'), 'page');
});

test('adresse directe et ancien lien', async () => {
  reinit();
  const p = await env.page({ chemin: '/#science' });
  await p.waitForFunction(() => location.hash === '#parcours/competences');
});

test('maintenance sans jeton → seul #maintenance visible avec le message', async () => {
  reinit((c) => { c.site.maintenance = { active: true, message: 'Retour lundi.' }; });
  const p = await env.page();
  assert.equal(await p.isVisible('#maintenance'), true);
  assert.match(await p.textContent('#maintenance'), /Retour lundi\./);
  assert.match(await p.textContent('#maintenance'), /amarxbcrb@gmail\.com/);
  for (const s of ['.top', '#vue', '.barre']) assert.equal(await p.isVisible(s), false, s);
});

test('maintenance avec jeton valide → site visible + bandeau', async () => {
  reinit((c) => { c.site.maintenance = { active: true, message: 'Retour lundi.' }; });
  const p = await env.page({ stockage: { 'ab-jeton': jetonValide() } });
  assert.equal(await p.isVisible('#maintenance'), false);
  assert.equal(await p.isVisible('#bandeauAdmin'), true);
  assert.match(await p.textContent('#bandeauAdmin'), /Maintenance active/);
  assert.equal(await p.getAttribute('#bandeauAdmin a', 'href'), '/admin/');
  assert.equal(await p.isVisible('.barre'), true);
});

test('première visite, script lent → #chargement visible puis contenu', async () => {
  reinit();
  env.faux.regler({ lent: 1500 });
  const p = await env.page({ attendre: false });
  await p.waitForSelector('#chargement', { state: 'visible' });
  await p.waitForSelector('.nav .nb', { timeout: 5000 });
  assert.equal(await p.isVisible('#chargement'), false);
});

test('pas de bouton EN, en-tête sans grand titre', async () => {
  reinit();
  const p = await env.page();
  assert.equal(await p.locator('#langBtn').count(), 0);
  assert.equal(await p.locator('[data-en]').count(), 0);
  /* la salutation de l'Accueil (serif fin) peut aller jusqu'à 52 px ; les autres titres restent à 40 px au plus */
  const tailles = await p.$$eval('h1:not(.salut), h2', (hs) => hs.map((h) => parseFloat(getComputedStyle(h).fontSize)));
  tailles.forEach((t) => assert.ok(t <= 40, `titre de ${t}px`));
  assert.ok(await p.$eval('h1.salut', (h) => parseFloat(getComputedStyle(h).fontSize)) <= 52);
  assert.equal(await p.textContent('.brand .nom'), 'Amar Bouchareb');
  assert.equal(await p.textContent('.brand .nom i'), 'Amar');
  assert.match(await p.$eval('.brand .nom', (x) => getComputedStyle(x).fontFamily), /^"Instrument Serif"/);
  assert.ok(await p.evaluate(() => document.fonts.check('24px "Instrument Serif"')));
  assert.equal(await p.locator('.brand small').count(), 0);
});

test('favicon et logo pris dans medias', async () => {
  reinit((c) => { c.medias.logo = { url: '/favicon-512x512.png?logo' }; c.medias.favicon = { url: '/favicon-512x512.png?fav' }; });
  const p = await env.page();
  assert.match(await p.getAttribute('.brand img', 'src'), /\?logo$/);
  assert.match(await p.getAttribute('link[rel="icon"]', 'href'), /\?fav$/);
});

test('mise à jour en silence depuis la copie du navigateur', async () => {
  reinit((c) => { c.version = 5; c.site.nom = 'Amar B.'; });
  const ancien = DEFAUT();
  const p = await env.page({ stockage: { 'ab-contenu': JSON.stringify({ version: 1, contenu: ancien }) } });
  await p.waitForFunction(() => document.querySelector('.brand .nom').textContent === 'Amar B.');
});

test('aucune erreur console sur chaque onglet', async () => {
  reinit();
  const p = await env.page();
  for (const v of ['parcours', 'portfolio', 'liens', 'accueil']) {
    await p.click(`.nav .nb[data-v="${v}"]`);
    await p.waitForFunction((x) => location.hash.startsWith('#' + x), v);
  }
  assert.deepEqual(p.erreurs, []);
});

test('tous les onglets masqués → Accueil seul, sans erreur', async () => {
  reinit((c) => { Object.values(c.onglets).forEach((o) => { o.visible = false; }); });
  const p = await env.page();
  assert.deepEqual(await p.$$eval('.nav .nb', (bs) => bs.map((b) => b.dataset.v)), ['accueil']);
  assert.equal(await p.innerText('#vue h1'), 'Bonjour, je suis Amar');
  assert.deepEqual(p.erreurs, []);
});

test('lien « Aller au contenu » garde la vue courante', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours/langues' });
  await p.focus('.skip');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => location.hash), '#parcours/langues');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'vue');
  assert.match(await p.innerText('#vue'), /Kabyle/);
});
