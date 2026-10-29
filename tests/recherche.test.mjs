import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));

let env;
before(async () => {
  env = await demarrer();
  env.faux.etat.portfolio.dossiers = [{ id: 'dp', nom: '1 - Posters', fichiers: [{ id: 'p1', nom: 'Variole-poster.jpg', type: 'image/jpeg', apercu: '/favicon-512x512.png?p1', lien: 'https://drive.google.com/file/d/p1/view' }] }];
});
after(async () => { await env.fermer(); });
const reinit = () => { const c = DEFAUT(); env.faux.etat.contenu = c; env.faux.etat.version = c.version; };

test('bouton recherche ouvre le panneau, focus dans le champ', async () => {
  reinit();
  const p = await env.page();
  assert.equal(await p.isVisible('#recherche'), false);
  await p.click('.nav-search');
  await p.waitForSelector('#recherche', { state: 'visible' });
  assert.equal(await p.evaluate(() => document.activeElement.id), 'rechInput');
  assert.equal(await p.getAttribute('#recherche', 'role'), 'dialog');
});

test('taper "elisa" → résultat Compétence, clic → #parcours/competences, panneau fermé', async () => {
  reinit();
  const p = await env.page();
  await p.click('.nav-search');
  await p.fill('#rechInput', 'elisa');
  await p.waitForSelector('#rechRes li button');
  const premier = p.locator('#rechRes li button').first();
  assert.match(await premier.innerText(), /Compétence[\s\S]*Immunologie/i);
  await premier.click();
  await p.waitForFunction(() => location.hash === '#parcours/competences');
  assert.equal(await p.isVisible('#recherche'), false);
  assert.match(await p.innerText('#vue'), /Immunologie/);
});

test('taper un nom de fichier du portfolio → ouvre portfolio/<dossier>', async () => {
  reinit();
  const p = await env.page();
  await p.click('.nav-search');
  await p.fill('#rechInput', 'variole');
  await p.waitForSelector('#rechRes li button');
  assert.match(await p.locator('#rechRes li button').first().innerText(), /Portfolio[\s\S]*Variole-poster\.jpg[\s\S]*Posters/i);
  await p.locator('#rechRes li button').first().click();
  await p.waitForFunction(() => location.hash === '#portfolio/dp');
  await p.waitForSelector('#vue .vignette');
});

test('Échap ferme, focus rendu au bouton', async () => {
  reinit();
  const p = await env.page();
  await p.click('.nav-search');
  await p.waitForSelector('#recherche', { state: 'visible' });
  await p.keyboard.press('Escape');
  assert.equal(await p.isVisible('#recherche'), false);
  assert.equal(await p.evaluate(() => document.activeElement.classList.contains('nav-search')), true);
});

test('aucun résultat → "Aucun résultat pour « … »"', async () => {
  reinit();
  const p = await env.page();
  await p.click('.nav-search');
  await p.fill('#rechInput', 'zzzqqq');
  await p.waitForSelector('#rechVide', { state: 'visible' });
  assert.equal(await p.innerText('#rechVide'), 'Aucun résultat pour « zzzqqq ».');
  assert.equal(await p.locator('#rechRes li').count(), 0);
  await p.fill('#rechInput', '');
  assert.equal(await p.isVisible('#rechVide'), false);
  assert.deepEqual(p.erreurs, []);
});
