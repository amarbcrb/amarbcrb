import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));

let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); env.faux.etat.contenu = c; env.faux.etat.version = c.version; };
const ouverte = (p) => p.waitForSelector('#fiche', { state: 'visible' });
const fermee = (p) => p.waitForSelector('#fiche', { state: 'hidden' });

test('icône Contact de l\'en-tête (pas la photo, déjà dans le logo) ouvre la fiche Contact (#contact), e-mail copiable', async () => {
  reinit((c) => { c.medias.photo = { url: '/favicon-512x512.png?photo' }; });
  const p = await env.page({ permissions: ['clipboard-read', 'clipboard-write'] });
  assert.equal(await p.getAttribute('#contactBtn', 'aria-label'), 'Contact');
  assert.equal(await p.locator('#contactBtn img').count(), 0);
  assert.equal(await p.locator('#contactBtn svg').count(), 1);
  await p.click('#contactBtn');
  await ouverte(p);
  assert.equal(await p.evaluate(() => document.activeElement.id), 'ficheFermer');
  assert.equal(await p.evaluate(() => location.hash), '#contact');
  assert.equal(await p.innerText('#ficheTitre'), 'Contact');
  assert.match(await p.innerText('#ficheCorps'), /amarxbcrb@gmail\.com[\s\S]*LinkedIn[\s\S]*\nOuvert à\nStages\nLaboratoire de microbiologie/);
  /* « Ouvert à » : un vrai titre de section, en casse normale, de la taille des titres de rangée */
  assert.equal(await p.$eval('#ficheCorps h3.ct-titre', (h) => [h.textContent, getComputedStyle(h).textTransform, getComputedStyle(h).fontSize].join('|')), 'Ouvert à|none|20px');
  await p.click('#ficheCorps button:has-text("Copier")');
  assert.equal(await p.evaluate(() => navigator.clipboard.readText()), 'amarxbcrb@gmail.com');
  assert.equal(await p.getAttribute('#fiche', 'role'), 'dialog');
});

test('Me contacter ouvre la même fiche', async () => {
  reinit();
  const p = await env.page();
  await p.click('#vue a:has-text("Me contacter")');
  await ouverte(p);
  assert.equal(await p.evaluate(() => location.hash), '#contact');
  assert.equal(await p.innerText('#ficheTitre'), 'Contact');
});

test('Échap ferme, focus rendu à #contactBtn, adresse revenue à #accueil', async () => {
  reinit();
  const p = await env.page();
  await p.click('#contactBtn');
  await ouverte(p);
  await p.keyboard.press('Escape');
  await fermee(p);
  await p.waitForFunction(() => location.hash === '#accueil');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'contactBtn');
});

test('retour arrière ferme la fiche', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours' });
  await p.click('#contactBtn');
  await ouverte(p);
  await p.goBack();
  await fermee(p);
  assert.equal(await p.evaluate(() => location.hash), '#parcours');
  assert.equal(await p.getAttribute('.nav .nb[data-v="parcours"]', 'aria-current'), 'page');
});

test('arrivée directe sur #contact : Accueil derrière, fermer → #accueil', async () => {
  reinit();
  const p = await env.page({ chemin: '/#contact' });
  await ouverte(p);
  assert.equal(await p.getAttribute('.nav .nb[data-v="accueil"]', 'aria-current'), 'page');
  await p.click('#ficheFermer');
  await fermee(p);
  assert.equal(await p.evaluate(() => location.hash), '#accueil');
});

test('clic sur le fond ferme', async () => {
  reinit();
  const p = await env.page();
  await p.click('#contactBtn');
  await ouverte(p);
  await p.mouse.click(10, 10);
  await fermee(p);
});

test('contact masqué', async () => {
  reinit((c) => { c.onglets.contact.visible = false; });
  const p = await env.page();
  assert.equal(await p.isVisible('#contactBtn'), false);
  assert.equal(await p.locator('#contactPhoto').count(), 0);
  assert.equal(await p.locator('#vue a:has-text("Me contacter")').count(), 0);
  await p.goto(env.site.url + '/#contact');
  await p.waitForFunction(() => location.hash === '#accueil');
  assert.equal(await p.isVisible('#fiche'), false);
  assert.deepEqual(p.erreurs, []);
});
