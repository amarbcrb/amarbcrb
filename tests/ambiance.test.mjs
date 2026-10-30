/* Fond sombre « halo de l'onglet » (léger : ni animation continue ni flou plein écran), icônes animées. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer } from './helpers.mjs';

let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });

test('fond : aucune animation continue ni filtre de flou, un halo en dégradé', async () => {
  const p = await env.page({ mouvementReduit: false, stockage: { 'ab-theme': 'dark' } });
  const r = await p.$eval('.amb', (a) => {
    const tous = [a, ...a.querySelectorAll('*')].map((x) => getComputedStyle(x));
    return { animes: tous.filter((s) => s.animationName !== 'none').length, flous: tous.filter((s) => s.filter !== 'none').length, fond: getComputedStyle(a).backgroundImage };
  });
  assert.equal(r.animes, 0);
  assert.equal(r.flous, 0);
  assert.match(r.fond, /radial-gradient/);
});

test('halo : prend la couleur de l\'onglet ouvert', async () => {
  const p = await env.page({ stockage: { 'ab-theme': 'dark' } });
  const halo = () => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--halo').trim());
  const couleur = (v) => p.evaluate((n) => { const d = document.createElement('i'); d.style.color = `var(${n})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }, v);
  await p.waitForFunction(async () => true);
  assert.equal(await halo(), await couleur('--c-blue'));
  await p.evaluate(() => { location.hash = '#parcours'; });
  await p.waitForFunction((c) => getComputedStyle(document.documentElement).getPropertyValue('--halo').trim() === c, await couleur('--c-teal'), { timeout: 3000 });
});

test('icônes animées : thème et Contact s\'animent au toucher (sauf mouvement réduit)', async () => {
  const p = await env.page({ mouvementReduit: false });
  await p.click('#themeBtn');
  assert.notEqual(await p.$eval('#themeBtn svg', (s) => getComputedStyle(s).animationName), 'none');
  await p.hover('#contactBtn');
  await p.waitForFunction(() => getComputedStyle(document.querySelector('#contactBtn svg')).animationName !== 'none');
  const q = await env.page({ mouvementReduit: true });
  await q.click('#themeBtn');
  assert.equal(await q.$eval('#themeBtn svg', (s) => getComputedStyle(s).animationName), 'none');
});
