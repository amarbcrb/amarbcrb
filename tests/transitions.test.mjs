/* Changement d'onglet : glissement avec flou (View Transitions), repli sans l'API, mouvement réduit respecté. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer } from './helpers.mjs';

let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });

async function espion(p, sansApi = false) {
  await p.evaluate((sans) => {
    window.__vt = [];
    if (sans) { delete Document.prototype.startViewTransition; document.startViewTransition = undefined; return; }
    const orig = document.startViewTransition.bind(document);
    document.startViewTransition = (f) => { window.__vt.push(document.documentElement.dataset.sens); return orig(f); };
  }, sansApi);
}

test('onglet suivant : transition de vue, sens « avant » ; onglet précédent : « arriere » ; le flou disparaît ensuite', async () => {
  const p = await env.page({ mouvementReduit: false });
  await espion(p);
  await p.click('.nav .nb[data-v="parcours"]');
  await p.waitForSelector('#vue .v-parcours');
  await p.click('.nav .nb[data-v="accueil"]');
  await p.waitForSelector('#vue .accueil');
  assert.deepEqual(await p.evaluate(() => window.__vt), ['avant', 'arriere']);
  await p.waitForFunction(() => !document.documentElement.dataset.sens);
  assert.equal(await p.$eval('#vue', (v) => getComputedStyle(v).filter), 'none');
  assert.equal(await p.$eval('#vue', (v) => getComputedStyle(v).viewTransitionName), 'vue');
});

test('navigateur sans View Transitions : l\'onglet change quand même, sans erreur', async () => {
  const p = await env.page({ mouvementReduit: false });
  await espion(p, true);
  await p.click('.nav .nb[data-v="liens"]');
  await p.waitForSelector('#vue .v-liens');
  assert.deepEqual(p.erreurs, []);
});

test('mouvement réduit : pas de transition glissée', async () => {
  const p = await env.page({ mouvementReduit: true });
  await espion(p);
  await p.click('.nav .nb[data-v="parcours"]');
  await p.waitForSelector('#vue .v-parcours');
  assert.deepEqual(await p.evaluate(() => window.__vt), []);
});
