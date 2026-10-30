import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliser } from '../assets/model.js';
import { parse, format, ALIAS } from '../assets/router.js';

const brut = JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const c = normaliser(brut);
const dossiers = [{ id: 'd1', nom: '1 - Design', fichiers: [{ id: 'f1' }] }, { id: 'd2', nom: '2 - Posters', fichiers: [] }];
const page = (onglet, sous = null, element = null, contact = false) => ({ onglet, sous, element, contact });

test('parse : page d\'onglet', () => {
  assert.deepEqual(parse('#parcours', c), page('parcours'));
  assert.deepEqual(parse('parcours', c), page('parcours'));
  assert.deepEqual(parse('', c), page('accueil'));
  assert.deepEqual(parse('#nimporte', c), page('accueil'));
});

test('parse : voir tout', () => {
  assert.deepEqual(parse('#parcours/certifications', c), page('parcours', 'certifications'));
  assert.deepEqual(parse('#liens/projets', c), page('liens', 'projets'));
  assert.deepEqual(parse('#portfolio/d2', c, dossiers), page('portfolio', 'd2'));
  assert.deepEqual(parse('#portfolio/d2', c, []), page('portfolio'));
});

test('parse : fiche', () => {
  assert.deepEqual(parse('#parcours/experience/e1', c), page('parcours', 'experience', 'e1'));
  assert.deepEqual(parse('#parcours/certifications/k3', c), page('parcours', 'certifications', 'k3'));
});

test('parse : élément inconnu', () => {
  assert.deepEqual(parse('#parcours/experience/zzz', c), page('parcours', 'experience'));
  const masque = normaliser({ ...brut, parcours: { ...brut.parcours, experience: brut.parcours.experience.map((x) => ({ ...x, visible: x.id !== 'e1' })) } });
  assert.deepEqual(parse('#parcours/experience/e1', masque), page('parcours', 'experience'));
});

test('parse : pas de fiche pour les langues ni le portfolio ; un lien a sa fiche (partages), sauf depuis « tous »', () => {
  assert.deepEqual(parse('#parcours/langues/l1', c), page('parcours', 'langues'));
  assert.deepEqual(parse('#liens/projets/u1', c), page('liens', 'projets', 'u1'));
  assert.deepEqual(parse('#liens/tous/u1', c), page('liens', 'tous'));
  assert.deepEqual(parse('#portfolio/d1/f1', c, dossiers), page('portfolio', 'd1'));
});

test('parse : partie inconnue ou masquée', () => {
  assert.deepEqual(parse('#parcours/profil', c), page('parcours'));
  const m = normaliser({ ...brut, onglets: { ...brut.onglets, parcours: { ...brut.onglets.parcours, sous: { ...brut.onglets.parcours.sous, interets: { visible: false, titre: 'Intérêts' } } } } });
  assert.deepEqual(parse('#parcours/interets', m), page('parcours'));
});

test('parse : onglet masqué → accueil', () => {
  const m = normaliser({ ...brut, onglets: { ...brut.onglets, liens: { visible: false } } });
  assert.deepEqual(parse('#liens/projets', m), page('accueil'));
});

test('parse : contact', () => {
  assert.deepEqual(parse('#contact', c), page('accueil', null, null, true));
  const m = normaliser({ ...brut, onglets: { ...brut.onglets, contact: { visible: false } } });
  assert.deepEqual(parse('#contact', m), page('accueil'));
});

test('parse : alias', () => {
  assert.deepEqual(parse('#science', c), page('parcours', 'competences'));
  assert.deepEqual(parse('#profil', c), page('accueil'));
  assert.deepEqual(parse('#beyond', c), page('parcours', 'interets'));
  assert.deepEqual(parse('#biostudy', c), page('liens', 'projets'));
  assert.equal(ALIAS.apropos, 'parcours');
});

test('format avec et sans élément', () => {
  assert.equal(format({ onglet: 'parcours' }), '#parcours');
  assert.equal(format({ onglet: 'parcours', sous: 'experience' }), '#parcours/experience');
  assert.equal(format({ onglet: 'parcours', sous: 'experience', element: 'e1' }), '#parcours/experience/e1');
  assert.equal(format({ onglet: 'portfolio', sous: 'd 2' }), '#portfolio/d%202');
  assert.deepEqual(parse(format({ onglet: 'portfolio', sous: 'd 2' }), c, [{ id: 'd 2', nom: 'X' }]), page('portfolio', 'd 2'));
});
