import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireChemin, ecrireChemin } from '../assets/chemins.js';

const C = () => ({ accueil: { salutation: 'Salut', reperes: [{ id: 'r1', valeur: '2022' }, { id: 'r2', valeur: '6 ans' }] }, pages: { t1: { rangees: [{ id: 'rg', cartes: [{ id: 'c1', titre: 'A' }] }] } } });

test('lireChemin : champs, éléments par id (liste#id), index numérique ; absent → undefined', () => {
  const c = C();
  assert.equal(lireChemin(c, 'accueil.salutation'), 'Salut');
  assert.equal(lireChemin(c, 'accueil.reperes#r2.valeur'), '6 ans');
  assert.equal(lireChemin(c, 'accueil.reperes.0.valeur'), '2022');
  assert.equal(lireChemin(c, 'pages.t1.rangees#rg.cartes#c1.titre'), 'A');
  assert.equal(lireChemin(c, 'accueil.reperes#zz.valeur'), undefined);
  assert.equal(lireChemin(c, 'rien.du.tout'), undefined);
});

test('ecrireChemin : modifie en place, crée les objets manquants, refuse un id absent et __proto__', () => {
  const c = C();
  assert.equal(ecrireChemin(c, 'accueil.reperes#r1.valeur', '2023'), true);
  assert.equal(c.accueil.reperes[0].valeur, '2023');
  assert.equal(ecrireChemin(c, 'contact.email', 'a@b.fr'), true);
  assert.equal(c.contact.email, 'a@b.fr');
  assert.equal(ecrireChemin(c, 'accueil.reperes#zz.valeur', 'x'), false);
  assert.equal(ecrireChemin(c, '__proto__.pollue', true), false);
  assert.equal(({}).pollue, undefined);
});
