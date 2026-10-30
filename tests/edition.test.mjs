/* Édition sur le site : connexion par appui long, mode édition, brouillon, publication. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const jeton = () => JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); env.faux.etat.contenu = c; env.faux.etat.version = c.version; env.faux.regler({ lent: 0 }); };

async function appuiLong(p, selecteur, ms) {
  const b = await p.locator(selecteur).boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(ms);
  await p.mouse.up();
}
/* propriétaire connecté, mode édition ouvert */
async function editer(opts = {}) {
  const p = await env.page({ stockage: { 'ab-jeton': jeton(), ...(opts.stockage || {}) }, ...opts });
  await p.click('#modifier');
  await p.waitForSelector('body.edition .barre-edition');
  return p;
}
async function taper(p, selecteur, texte) {
  await p.click(selecteur);
  await p.keyboard.press('Control+A');
  await p.keyboard.type(texte);
  await p.locator(selecteur).evaluate((x) => x.blur());
}

test('visiteur : aucun module d\'édition chargé, pas de pastille Modifier', async () => {
  reinit();
  const p = await env.page({ chemin: null });
  const urls = [];
  p.on('request', (r) => urls.push(r.url()));
  await p.goto(env.site.url + '/', { waitUntil: 'networkidle' });
  assert.deepEqual(urls.filter((u) => u.includes('/assets/edition/')), []);
  assert.equal(await p.isVisible('#modifier'), false);
});

test('appui long (1 s) sur le nom → feuille mot de passe ; toucher court → Accueil ; connexion → pastille Modifier', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours' });
  await appuiLong(p, '.brand', 150);
  await p.waitForFunction(() => location.hash === '#accueil');
  assert.equal(await p.locator('#fiche:not([hidden])').count(), 0);
  await appuiLong(p, '.brand', 1200);
  await p.waitForSelector('#fiche', { state: 'visible' });
  assert.equal(await p.innerText('#ficheTitre'), 'Connexion');
  await p.fill('#ficheCorps input[type="password"]', 'faux');
  await p.click('#ficheCorps button[type="submit"]');
  await p.waitForSelector('#ficheCorps [role="status"]:has-text("Mot de passe incorrect")');
  await p.fill('#ficheCorps input[type="password"]', 'test');
  await p.click('#ficheCorps button[type="submit"]');
  await p.waitForSelector('#modifier', { state: 'visible' });
  assert.equal(await p.locator('#fiche:not([hidden])').count(), 0);
});

test('mode édition : salutation modifiée sur place → « 1 modification »', async () => {
  reinit();
  const p = await editer();
  assert.equal(await p.getAttribute('#vue h1.salut', 'contenteditable'), 'plaintext-only');
  await taper(p, '#vue h1.salut', 'Salut, moi c\'est Amar');
  assert.equal(await p.innerText('.barre-edition .compte'), '1 modification');
  assert.equal(await p.innerText('#vue h1.salut'), 'Salut, moi c\'est Amar');
});

test('brouillon : gardé au rechargement, invisible hors édition', async () => {
  reinit();
  let p = await editer();
  await taper(p, '#vue h1.salut', 'Brouillon gardé');
  await p.reload({ waitUntil: 'networkidle' });
  assert.equal(await p.innerText('#vue h1.salut'), 'Bonjour, je suis Amar', 'hors édition : contenu publié');
  await p.click('#modifier');
  await p.waitForSelector('body.edition');
  assert.equal(await p.innerText('#vue h1.salut'), 'Brouillon gardé');
  assert.equal(await p.innerText('.barre-edition .compte'), '1 modification');
  p = await env.page();
  assert.equal(await p.innerText('#vue h1.salut'), 'Bonjour, je suis Amar', 'visiteur : contenu publié');
});

test('publier → version + 1, brouillon effacé, site public à jour', async () => {
  reinit();
  const p = await editer();
  const avant = env.faux.etat.version;
  await taper(p, '#vue h1.salut', 'Publié depuis le site');
  await p.click('.barre-edition button:has-text("Publier")');
  await p.waitForSelector('.barre-edition [role="status"]:has-text("Publié")');
  assert.equal(env.faux.etat.version, avant + 1);
  assert.equal(env.faux.etat.contenu.accueil.salutation, 'Publié depuis le site');
  assert.equal(await p.evaluate(() => localStorage.getItem('ab-brouillon')), null);
  const visiteur = await env.page();
  assert.equal(await visiteur.innerText('#vue h1.salut'), 'Publié depuis le site');
});

test('publier : conflit → Recharger (brouillon abandonné après confirmation) ou Écraser', async () => {
  reinit();
  let p = await editer();
  await taper(p, '#vue h1.salut', 'Version locale');
  env.faux.etat.version += 1;
  env.faux.etat.contenu.accueil.intro = 'Modifié ailleurs';
  await p.click('.barre-edition button:has-text("Publier")');
  await p.waitForSelector('.conflit-edition button:has-text("Écraser")');
  await p.click('.conflit-edition button:has-text("Écraser")');
  await p.waitForSelector('.barre-edition [role="status"]:has-text("Publié")');
  assert.equal(env.faux.etat.contenu.accueil.salutation, 'Version locale');
  p = await editer();
  await taper(p, '#vue h1.salut', 'Encore local');
  env.faux.etat.version += 1;
  env.faux.etat.contenu.accueil.salutation = 'Distante';
  await p.click('.barre-edition button:has-text("Publier")');
  await p.waitForSelector('.conflit-edition button:has-text("Recharger")');
  p.once('dialog', (d) => d.accept());
  await p.click('.conflit-edition button:has-text("Recharger")');
  await p.waitForFunction(() => document.querySelector('#vue h1.salut').textContent === 'Distante');
  assert.equal(await p.innerText('.barre-edition .compte'), '0 modification');
});

test('annuler → contenu publié, brouillon effacé ; quitter garde le brouillon', async () => {
  reinit();
  const p = await editer();
  await taper(p, '#vue h1.salut', 'À annuler');
  p.once('dialog', (d) => d.accept());
  await p.click('.barre-edition button:has-text("Annuler")');
  await p.waitForFunction(() => document.querySelector('#vue h1.salut').textContent === 'Bonjour, je suis Amar');
  assert.equal(await p.evaluate(() => localStorage.getItem('ab-brouillon')), null);
  await taper(p, '#vue h1.salut', 'Gardé');
  await p.click('.barre-edition button[aria-label="Quitter l\'édition"]');
  await p.waitForFunction(() => !document.body.classList.contains('edition'));
  assert.equal(await p.innerText('#vue h1.salut'), 'Bonjour, je suis Amar');
  assert.ok(JSON.parse(await p.evaluate(() => localStorage.getItem('ab-brouillon'))).contenu.accueil.salutation === 'Gardé');
});
