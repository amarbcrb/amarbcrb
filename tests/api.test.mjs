import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { creerFauxScript } from './mock-script.mjs';
import { creerServeurStatique } from './helpers.mjs';
import {
  configurer, chargerContenu, lirePortfolio, lireContenuFrais, appeler, ErreurApi, lireJeton, ecrireJeton, effacerJeton,
} from '../assets/api.js';

function fauxStockage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

let faux, site, stockage;
before(async () => { faux = await creerFauxScript(); site = await creerServeurStatique(faux.url); });
after(async () => { await faux.fermer(); await site.fermer(); });
beforeEach(() => {
  stockage = fauxStockage();
  faux.regler({ lent: 0, panne: false, html: false });
  faux.etat.version = 1;
  configurer({ url: faux.url, stockage, delai: 8000, secours: site.url + '/content/default.json' });
});

test('sans copie : attend le script, source script, copie écrite', async () => {
  faux.etat.version = 3;
  const r = await chargerContenu();
  assert.equal(r.source, 'script');
  assert.equal(r.contenu.version, 3);
  assert.equal(JSON.parse(stockage.getItem('ab-contenu')).version, 3);
});

test('copie présente : renvoie la copie puis onMaj avec la nouvelle version', async () => {
  stockage.setItem('ab-contenu', JSON.stringify({ version: 1, contenu: { version: 1, accueil: { positionnement: 'Ancienne' } } }));
  faux.etat.version = 2;
  let recu;
  const maj = new Promise((r) => { recu = r; });
  const r = await chargerContenu((c) => recu(c));
  assert.equal(r.source, 'cache');
  assert.equal(r.contenu.accueil.positionnement, 'Ancienne');
  const c = await maj;
  assert.equal(c.version, 2);
  assert.equal(JSON.parse(stockage.getItem('ab-contenu')).version, 2);
});

test('copie à jour : pas de onMaj', async () => {
  stockage.setItem('ab-contenu', JSON.stringify({ version: 1, contenu: { version: 1 } }));
  let appele = false;
  await chargerContenu(() => { appele = true; });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(appele, false);
});

test('script en panne : source secours (default.json)', async () => {
  faux.regler({ panne: true });
  const r = await chargerContenu();
  assert.equal(r.source, 'secours');
  assert.equal(r.contenu.site.nom, 'Amar Bouchareb');
  assert.equal(stockage.getItem('ab-contenu'), null);
});

test('réponse HTML = panne', async () => {
  faux.regler({ html: true });
  assert.equal((await chargerContenu()).source, 'secours');
  await assert.rejects(lireContenuFrais(), (e) => e instanceof ErreurApi && e.code === 'reseau');
});

test('script trop lent (> délai) : secours', async () => {
  configurer({ delai: 100 });
  faux.regler({ lent: 400 });
  assert.equal((await chargerContenu()).source, 'secours');
});

test('sans URL de script : secours', async () => {
  configurer({ url: '' });
  assert.equal((await chargerContenu()).source, 'secours');
  assert.equal(await lirePortfolio(), null);
});

test('lirePortfolio : dossiers, null en cas de panne, frais avec jeton', async () => {
  faux.etat.portfolio.dossiers = [{ id: 'd1', nom: 'Design', fichiers: [] }];
  const lu = await lirePortfolio();
  assert.deepEqual(lu.map((d) => [d.id, d.nom, d.fichiers]), [['d1', 'Design', []]]);
  assert.equal(lu.racine, 'racine', 'id du dossier Portfolio, pour y créer des dossiers depuis le site');
  ecrireJeton('jeton-' + (Date.now() + 1e6), Date.now() + 1e6);
  const avant = faux.etat.appels.frais;
  await lirePortfolio({ frais: true });
  assert.equal(faux.etat.appels.frais, avant + 1);
  faux.regler({ panne: true });
  assert.equal(await lirePortfolio(), null);
});

test('lireContenuFrais : version et contenu normalisé', async () => {
  const r = await lireContenuFrais();
  assert.equal(r.version, 1);
  assert.deepEqual(r.contenu.parcours.engagement.length, 2);
});

test('appeler connexion faux mot de passe → ErreurApi code mot_de_passe', async () => {
  await assert.rejects(appeler('connexion', { motDePasse: 'non' }), (e) => e instanceof ErreurApi && e.code === 'mot_de_passe');
  faux.etat.echecs = 0;
});

test('appeler ajoute le jeton enregistré', async () => {
  const r = await appeler('connexion', { motDePasse: 'test' });
  ecrireJeton(r.jeton, r.expire);
  const s = await appeler('enregistrer', { versionDeBase: 1, contenu: { a: 1 } });
  assert.equal(s.version, 2);
});

test('appeler : conflit porte la version', async () => {
  ecrireJeton('jeton-' + (Date.now() + 1e6), Date.now() + 1e6);
  await assert.rejects(appeler('enregistrer', { versionDeBase: 0, contenu: {} }), (e) => e.code === 'conflit' && e.version === 1);
});

test('appeler : réseau coupé → reseau', async () => {
  configurer({ url: 'http://127.0.0.1:1/exec' });
  await assert.rejects(appeler('connexion', { motDePasse: 'x' }), (e) => e.code === 'reseau');
});

test('lireJeton expiré → null', () => {
  ecrireJeton('jeton-1', Date.now() - 1);
  assert.equal(lireJeton(), null);
  ecrireJeton('jeton-2', Date.now() + 1000);
  assert.equal(lireJeton(), 'jeton-2');
  effacerJeton();
  assert.equal(lireJeton(), null);
});
