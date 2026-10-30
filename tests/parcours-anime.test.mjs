/* Parcours animé : la ligne de la frise se trace au défilement et allume chaque point, les cartes des rangées
   grossissent en entrant à l'écran, le texte du profil s'ouvre en douceur ; rien de tout ça en mouvement réduit. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer } from './helpers.mjs';

let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });

const animations = (p) => p.evaluate(() => {
  const nom = (s, pseudo) => { const x = document.querySelector(s); return x ? getComputedStyle(x, pseudo).animationName : null; };
  return { trait: nom('#vue li.etape', '::before'), point: nom('#vue .point'), carte: nom('#vue .rangee .piste > .carte') };
});

test('Parcours : frise qui se trace, points qui s\'allument, cartes qui entrent', async () => {
  const p = await env.page({ chemin: '/#parcours', mouvementReduit: false });
  const a = await animations(p);
  assert.match(a.trait, /trait/);
  assert.match(a.point, /allume/);
  assert.match(a.carte, /carte-entre/);
  await p.click('#vue .profil .lire');
  assert.match(await p.$eval('#vue .profil-texte p:nth-child(2)', (x) => getComputedStyle(x).animationName), /deplie/);
  assert.deepEqual(p.erreurs, []);
});

test('Parcours en mouvement réduit : aucune de ces animations', async () => {
  const p = await env.page({ chemin: '/#parcours' });
  const a = await animations(p);
  assert.equal(a.trait, 'none');
  assert.equal(a.point, 'none');
  assert.doesNotMatch(a.carte, /carte-entre/);
});
