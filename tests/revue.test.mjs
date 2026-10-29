/* Défauts relevés par la revue finale de la v2 : chaque test reproduit un défaut constaté. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); env.faux.etat.contenu = c; env.faux.etat.version = c.version; };
const actif = (p) => p.evaluate(() => document.activeElement.getAttribute('href') || document.activeElement.tagName);

/* contenu en cache plus ancien que celui du script : la mise à jour arrive pendant que la fiche est ouverte */
async function pageAvecMiseAJour(chemin) {
  reinit();
  env.faux.etat.version = DEFAUT().version + 1;
  env.faux.regler({ lent: 600 });
  const p = await env.page({ chemin: '/404-avant', stockage: { 'ab-contenu': JSON.stringify({ version: DEFAUT().version, contenu: DEFAUT() }) } });
  const appels = env.faux.etat.appels.contenu;
  await p.goto(env.site.url + chemin, { waitUntil: 'commit' });
  return { p, recu: async () => { while (env.faux.etat.appels.contenu === appels) await p.waitForTimeout(50); await p.waitForTimeout(900); env.faux.regler({ lent: 0 }); } };
}

test('fiche ouverte en lien direct, mise à jour reçue, ✕ → on reste sur le site', async () => {
  const { p, recu } = await pageAvecMiseAJour('/#parcours/formation/f1');
  await p.waitForSelector('#fiche', { state: 'visible' });
  await recu();
  await p.click('#ficheFermer');
  await p.waitForFunction(() => location.hash === '#parcours/formation');
  assert.ok(p.url().startsWith(env.site.url + '/#parcours/formation'), p.url());
});

test('fiche ouverte depuis une carte, mise à jour reçue, Échap → focus sur la carte', async () => {
  const { p, recu } = await pageAvecMiseAJour('/#parcours');
  await p.waitForSelector('#vue .rangee .carte-comp');
  await p.focus('#vue .rangee .carte-comp');
  const href = await actif(p);
  await p.keyboard.press('Enter');
  await p.waitForSelector('#fiche', { state: 'visible' });
  await recu();
  await p.keyboard.press('Escape');
  await p.waitForSelector('#fiche', { state: 'hidden' });
  assert.equal(await actif(p), href);
});

test('carte de l\'Accueil → fiche : la page reste l\'Accueil, Échap rend le focus à la carte', async () => {
  reinit();
  const p = await env.page();
  await p.focus('#vue .carte-accueil');
  await p.keyboard.press('Enter');
  await p.waitForSelector('#fiche', { state: 'visible' });
  assert.equal(await p.locator('#vue .accueil').count(), 1);
  await p.keyboard.press('Escape');
  await p.waitForSelector('#fiche', { state: 'hidden' });
  assert.equal(await p.evaluate(() => location.hash), '#accueil');
  assert.equal(await actif(p), '#parcours/formation/f1');
});

test('profil masqué dans l\'admin → absent de Parcours', async () => {
  reinit((c) => { c.onglets.parcours.sous.profil.visible = false; });
  const p = await env.page({ chemin: '/#parcours' });
  await p.waitForSelector('#vue .rangee');
  assert.equal(await p.locator('#vue .profil').count(), 0);
});

test('Voir tout s\'ouvre en haut de page ; retour arrière rend la position dans les rangées', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours' });
  await p.evaluate(() => scrollTo(0, document.querySelector('#vue .rangee:nth-of-type(4)').offsetTop - 80));
  const y0 = await p.evaluate(() => scrollY);
  assert.ok(y0 > 300);
  /* clic dans la page : le clic de Playwright peut faire défiler la page pour atteindre le bouton, ce qui fausserait y0 */
  await p.evaluate(() => document.querySelector('#vue .rangee:nth-of-type(4) a.voir').click());
  await p.waitForSelector('#vue .vt-voir');
  assert.equal(await p.evaluate(() => scrollY), 0);
  await p.goBack();
  await p.waitForSelector('#vue .rangee');
  await p.waitForFunction((y) => Math.abs(scrollY - y) < 2, y0, { timeout: 3000 }).catch(async () => { assert.fail(`scrollY ${await p.evaluate(() => [scrollY, location.hash, document.documentElement.scrollHeight, innerHeight])} au lieu de ${y0}`); });
});

test('image de lien ou d\'intérêt introuvable → repli dégradé, jamais de cadre vide', async () => {
  reinit((c) => { c.liens.items[0].image = 'https://127.0.0.1:1/introuvable.png'; c.parcours.interets[0].image = { id: 'x', url: 'https://127.0.0.1:1/introuvable.jpg' }; });
  const p = await env.page({ chemin: '/#liens' });
  await p.waitForSelector('#vue .carte-lien >> nth=0 >> .degrade');
  assert.equal(await p.locator('#vue .carte-lien >> nth=0 >> img').count(), 0);
  await p.evaluate(() => { location.hash = '#parcours'; });
  await p.waitForSelector('#vue a.carte-image >> nth=0 >> .degrade');
  assert.equal(await p.locator('#vue a.carte-image >> nth=0 >> img').count(), 0);
});
