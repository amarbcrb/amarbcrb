import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliser } from '../assets/model.js';
import { normaliserTexte, construireIndex, chercher } from '../assets/search.js';

const brut = JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const c = normaliser(brut);
const dossiers = [{ id: 'd1', nom: '1 - Posters', fichiers: [{ id: 'f1', nom: 'Variole-poster.pdf', type: 'application/pdf' }] }];
const idx = construireIndex(c, dossiers);

test('normaliserTexte', () => assert.equal(normaliserTexte('Électrophorèse ÉTÉ'), 'electrophorese ete'));

test('chercher ignore accents et casse', () => {
  const r = chercher(idx, 'BIOLOGIE moleculaire');
  assert.equal(r[0].titre, 'Biologie moléculaire');
  assert.equal(r[0].type, 'Compétence');
  assert.equal(r[0].hash, '#parcours/competences/c2');
});

test('chercher : plusieurs mots tous requis', () => {
  const r = chercher(idx, 'stage chu');
  assert.equal(r.length, 1);
  assert.equal(r[0].titre, 'Stage parasitologie-mycologie');
  assert.equal(r[0].type, 'Expérience');
});

test('chercher : technique dans une compétence', () => {
  assert.equal(chercher(idx, 'elisa')[0].titre, 'Immunologie');
  assert.equal(chercher(idx, 'elisa')[0].hash, '#parcours/competences/c3');
});

test('chercher : langue → page Voir tout (pas de fiche)', () => assert.equal(chercher(idx, 'kabyle')[0].hash, '#parcours/langues'));

test('chercher : certificat → fiche', () => assert.equal(chercher(idx, 'manchester')[0].hash, '#parcours/certifications/k3'));

test('chercher : contact', () => assert.equal(chercher(idx, 'linkedin')[0].hash, '#contact'));

test('chercher : titre avant contenu', () => {
  const r = chercher(idx, 'biostudy');
  assert.equal(r[0].titre, 'BioStudy');
  assert.equal(r[0].type, 'Lien');
  assert.equal(r[0].hash, '#liens/projets');
});

test('chercher : éléments masqués absents', () => {
  const m = normaliser({ ...brut, parcours: { ...brut.parcours, langues: brut.parcours.langues.map((l) => ({ ...l, visible: l.langue !== 'Kabyle' })) } });
  assert.equal(chercher(construireIndex(m, []), 'kabyle').length, 0);
});

test('chercher : sous-onglet ou onglet masqué absent', () => {
  const m = normaliser({ ...brut, onglets: { ...brut.onglets, liens: { visible: false } } });
  assert.equal(chercher(construireIndex(m, []), 'bioband').length, 0);
});

test('chercher : fichier du portfolio → portfolio/<idDossier>', () => {
  const r = chercher(idx, 'variole');
  assert.equal(r[0].type, 'Portfolio');
  assert.equal(r[0].hash, '#portfolio/d1');
  assert.equal(r[0].extrait, 'Posters');
});

test('chercher : requête vide → []', () => {
  assert.deepEqual(chercher(idx, ''), []);
  assert.deepEqual(chercher(idx, '   '), []);
});

test('chercher : max', () => assert.ok(chercher(idx, 'a', 3).length <= 3));

test('chercher : intérêt → page Voir tout (pas de fiche)', () => assert.equal(chercher(idx, 'cartomagie')[0].hash, '#parcours/interets'));

test('chercher : un lien n\'apparaît qu\'une fois (pas de doublon par « Toutes les ressources »)', () => assert.equal(chercher(idx, 'biocampus').filter((r) => r.titre === 'BioCampus').length, 1));
