import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const jeton = (exp = Date.now() + 864e5) => JSON.stringify({ jeton: 'jeton-' + exp, expire: exp });

let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = () => {
  const c = DEFAUT();
  Object.assign(env.faux.etat, { contenu: c, version: c.version, echecs: 0 });
  env.faux.regler({ panne: false, lent: 0, html: false });
};
const admin = (opts = {}) => env.page({ chemin: '/admin/', ...opts });
const connecte = () => admin({ stockage: { 'ab-jeton': jeton() } });
const champ = (chemin) => `[data-chemin="${chemin}"]`;

test('mauvais mot de passe → message', async () => {
  reinit();
  const p = await admin();
  assert.equal(await p.getAttribute('meta[name="robots"]', 'content'), 'noindex, nofollow');
  await p.fill('#motDePasse', 'non');
  await p.click('#connexion button[type="submit"]');
  await p.waitForSelector('#connexionErreur:not(:empty)');
  assert.equal(await p.innerText('#connexionErreur'), 'Mot de passe incorrect.');
});

test('5 échecs → message de blocage 15 min', async () => {
  reinit();
  env.faux.etat.echecs = 5;
  const p = await admin();
  await p.fill('#motDePasse', 'test');
  await p.click('#connexion button[type="submit"]');
  await p.waitForSelector('#connexionErreur:not(:empty)');
  assert.equal(await p.innerText('#connexionErreur'), 'Trop d\'essais. Réessaie dans 15 minutes.');
});

test('connexion → jeton stocké, écran Accueil', async () => {
  reinit();
  const p = await admin();
  await p.fill('#motDePasse', 'test');
  await p.click('#connexion button[type="submit"]');
  await p.waitForSelector('#app:not([hidden])');
  assert.ok(JSON.parse(await p.evaluate(() => localStorage.getItem('ab-jeton'))).jeton.startsWith('jeton-'));
  assert.equal(await p.inputValue(champ('accueil.salutation')), DEFAUT().accueil.salutation);
  assert.equal(await p.getAttribute('.ecrans [data-ecran="accueil"]', 'aria-current'), 'page');
});

test('modifier la salutation puis Enregistrer → faux script version 2, site public affiche la nouvelle phrase', async () => {
  reinit();
  const p = await connecte();
  await p.fill(champ('accueil.salutation'), 'Microbiologiste, qualité et sécurité des aliments.');
  await p.click('#enregistrer');
  await p.waitForSelector('#etat:has-text("Enregistré")');
  assert.equal(env.faux.etat.version, 2);
  const site = await env.page();
  assert.equal(await site.innerText('#vue h1'), 'Microbiologiste, qualité et sécurité des aliments.');
});

test('point "non enregistré" visible après modification, absent après enregistrement', async () => {
  reinit();
  const p = await connecte();
  assert.equal(await p.isVisible('#nonEnregistre'), false);
  await p.fill(champ('accueil.intro'), 'Master 1 · Lyon');
  assert.equal(await p.isVisible('#nonEnregistre'), true);
  await p.click('#enregistrer');
  await p.waitForSelector('#etat:has-text("Enregistré")');
  assert.equal(await p.isVisible('#nonEnregistre'), false);
  assert.equal(await p.evaluate(() => localStorage.getItem('ab-brouillon')), null);
});

test('conflit (version modifiée dans le faux script) → choix Recharger / Écraser, les deux fonctionnent', async () => {
  reinit();
  let p = await connecte();
  env.faux.etat.version = 7;
  env.faux.etat.contenu.accueil.intro = 'Version distante';
  await p.fill(champ('accueil.intro'), 'Version locale');
  await p.click('#enregistrer');
  await p.waitForSelector('#conflit', { state: 'visible' });
  await p.click('#conflitRecharger');
  await p.waitForSelector('#etat:has-text("Dernière version chargée")');
  assert.equal(await p.inputValue(champ('accueil.intro')), 'Version distante');
  p = await connecte();
  env.faux.etat.version = 9;
  await p.fill(champ('accueil.intro'), 'Version écrasante');
  await p.click('#enregistrer');
  await p.waitForSelector('#conflit', { state: 'visible' });
  await p.click('#conflitEcraser');
  await p.waitForSelector('#etat:has-text("Enregistré")');
  assert.equal(env.faux.etat.version, 10);
  assert.equal(env.faux.etat.contenu.accueil.intro, 'Version écrasante');
});

test('réseau coupé à l\'enregistrement → message, brouillon gardé ; rechargement → brouillon proposé', async () => {
  reinit();
  const p = await connecte();
  await p.fill(champ('accueil.intro'), 'Brouillon hors ligne');
  env.faux.regler({ panne: true });
  await p.click('#enregistrer');
  await p.waitForSelector('#etat:has-text("Pas de réseau")');
  assert.match(await p.evaluate(() => localStorage.getItem('ab-brouillon')), /Brouillon hors ligne/);
  env.faux.regler({ panne: false });
  await p.reload();
  await p.waitForSelector('#brouillon', { state: 'visible' });
  await p.click('#brouillonReprendre');
  assert.equal(await p.inputValue(champ('accueil.intro')), 'Brouillon hors ligne');
  assert.equal(await p.isVisible('#nonEnregistre'), true);
});

test('jeton expiré → retour connexion, brouillon gardé', async () => {
  reinit();
  const p = await admin({ stockage: { 'ab-jeton': JSON.stringify({ jeton: 'jeton-1', expire: Date.now() + 864e5 }) } });
  await p.fill(champ('accueil.intro'), 'Gardé malgré tout');
  await p.click('#enregistrer');
  await p.waitForSelector('#connexion', { state: 'visible' });
  assert.equal(await p.innerText('#connexionErreur'), 'Session expirée : reconnecte-toi, tes modifications sont gardées.');
  assert.match(await p.evaluate(() => localStorage.getItem('ab-brouillon')), /Gardé malgré tout/);
});

test('interrupteur maintenance + message → site public en maintenance', async () => {
  reinit();
  const p = await connecte();
  await p.click('.ecrans [data-ecran="visibilite"]');
  await p.check(champ('site.maintenance.active'));
  await p.fill(champ('site.maintenance.message'), 'De retour demain.');
  await p.click('#enregistrer');
  await p.waitForSelector('#etat:has-text("Enregistré")');
  const site = await env.page();
  assert.equal(await site.isVisible('#maintenance'), true);
  assert.match(await site.innerText('#maintenance'), /De retour demain\./);
});

test('masquer l\'onglet Liens → absent de la barre publique', async () => {
  reinit();
  const p = await connecte();
  await p.click('.ecrans [data-ecran="visibilite"]');
  await p.uncheck(champ('onglets.liens.visible'));
  await p.uncheck(champ('onglets.parcours.sous.interets.visible'));
  await p.click('#enregistrer');
  await p.waitForSelector('#etat:has-text("Enregistré")');
  const site = await env.page();
  const onglets = await site.$$eval('.nav .nb', (bs) => bs.map((b) => b.dataset.v));
  assert.deepEqual(onglets, ['accueil', 'parcours', 'portfolio']);
});

test('champ invalide → Enregistrer désactivé, erreur affichée', async () => {
  reinit();
  const p = await connecte();
  await p.click('.ecrans [data-ecran="contact"]');
  await p.fill(champ('contact.linkedin'), 'pas une url');
  await p.waitForSelector('[data-erreur="contact.linkedin"]:not(:empty)');
  assert.equal(await p.isDisabled('#enregistrer'), true);
  await p.fill(champ('contact.linkedin'), 'https://www.linkedin.com/in/x');
  assert.equal(await p.innerText('[data-erreur="contact.linkedin"]'), '');
  assert.equal(await p.isDisabled('#enregistrer'), false);
  assert.deepEqual(p.erreurs, []);
});

test('modification tapée pendant un enregistrement → reste non enregistrée et dans le brouillon', async () => {
  reinit();
  const p = await connecte();
  await p.fill(champ('accueil.salutation'), 'Première version');
  env.faux.regler({ lent: 1200 });
  await p.click('#enregistrer');
  await p.fill(champ('accueil.intro'), 'Tapé pendant l\'envoi');
  await p.waitForSelector('#etat:has-text("Enregistré")');
  env.faux.regler({ lent: 0 });
  assert.equal(env.faux.etat.contenu.accueil.salutation, 'Première version');
  assert.equal(await p.isVisible('#nonEnregistre'), true);
  assert.match(await p.evaluate(() => localStorage.getItem('ab-brouillon')), /Tapé pendant l'envoi/);
  await p.click('#enregistrer');
  await p.waitForFunction(() => document.getElementById('nonEnregistre').hidden);
  assert.equal(env.faux.etat.contenu.accueil.intro, 'Tapé pendant l\'envoi');
});

test('visibilité : Fiche Contact masquée → plus de photo cliquable', async () => {
  reinit();
  const p = await connecte();
  await p.click('.ecrans [data-ecran="visibilite"]');
  assert.match(await p.innerText('#ecran'), /Fiche Contact/);
  await p.uncheck(champ('onglets.contact.visible'));
  await p.click('#enregistrer');
  await p.waitForSelector('#etat:has-text("Enregistré")');
  const site = await env.page();
  assert.equal(await site.isVisible('#contactBtn'), false);
  assert.equal(await site.locator('#vue a:has-text("Me contacter")').count(), 0);
});
