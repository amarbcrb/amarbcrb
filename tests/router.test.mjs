import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliser } from '../assets/model.js';
import { parse, format, ALIAS } from '../assets/router.js';

const c = normaliser(JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8')));
const dossiers = [{ id: 'd1', nom: '1 - Design' }, { id: 'd2', nom: '2 - Posters' }];

test('parse : onglet et sous-onglet valides', () => assert.deepEqual(parse('#parcours/langues', c), { onglet: 'parcours', sous: 'langues' }));
test('parse : sans # aussi', () => assert.deepEqual(parse('parcours/langues', c), { onglet: 'parcours', sous: 'langues' }));
test('parse : alias anciens liens', () => {
  assert.deepEqual(parse('#science', c), { onglet: 'parcours', sous: 'competences' });
  assert.deepEqual(parse('#profil', c), { onglet: 'accueil', sous: null });
  assert.deepEqual(parse('#biostudy', c), { onglet: 'liens', sous: 'projets' });
  assert.deepEqual(parse('#beyond', c), { onglet: 'parcours', sous: 'interets' });
  assert.equal(ALIAS.methode, 'accueil');
});
test('parse : onglet sans sous-onglet → premier visible', () => assert.deepEqual(parse('#parcours', c), { onglet: 'parcours', sous: 'profil' }));
test('parse : sous-onglet inconnu → premier visible', () => assert.deepEqual(parse('#parcours/xyz', c), { onglet: 'parcours', sous: 'profil' }));
test('parse : onglet masqué → premier onglet visible', () => {
  const m = normaliser({ ...c, onglets: { ...c.onglets, liens: { visible: false } } });
  assert.deepEqual(parse('#liens', m), { onglet: 'accueil', sous: null });
  assert.deepEqual(parse('#biostudy', m), { onglet: 'accueil', sous: null });
});
test('parse : accueil masqué → premier onglet visible', () => {
  const m = normaliser({ ...c, onglets: { ...c.onglets, accueil: { visible: false } } });
  assert.deepEqual(parse('', m), { onglet: 'parcours', sous: 'profil' });
});
test('parse : vide ou inconnu → accueil', () => {
  assert.deepEqual(parse('', c), { onglet: 'accueil', sous: null });
  assert.deepEqual(parse('#nimporte', c), { onglet: 'accueil', sous: null });
});
test('parse : accueil et contact ignorent un sous-onglet', () => assert.deepEqual(parse('#contact/x', c), { onglet: 'contact', sous: null }));
test('parse : portfolio avec dossiers', () => {
  assert.deepEqual(parse('#portfolio/d2', c, dossiers), { onglet: 'portfolio', sous: 'd2' });
  assert.deepEqual(parse('#portfolio', c, dossiers), { onglet: 'portfolio', sous: 'd1' });
  assert.deepEqual(parse('#portfolio/d2', c, []), { onglet: 'portfolio', sous: null });
});
test('parse : sous-onglet encodé', () => assert.deepEqual(parse('#portfolio/d%202', c, [{ id: 'd 2', nom: 'X' }]), { onglet: 'portfolio', sous: 'd 2' }));
test('format', () => {
  assert.equal(format({ onglet: 'parcours', sous: 'langues' }), '#parcours/langues');
  assert.equal(format({ onglet: 'accueil', sous: null }), '#accueil');
  assert.equal(format({ onglet: 'portfolio', sous: 'd 2' }), '#portfolio/d%202');
});
