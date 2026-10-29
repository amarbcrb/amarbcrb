import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ONGLETS, SOUS_PARCOURS, normaliser, formaterDate, periode, trierParDate, formationActuelle,
  derniereExperience, ongletsVisibles, sousOnglets, nomAffiche, lienSur, valider, nouvelId, echapper,
} from '../assets/model.js';

test('constantes', () => {
  assert.deepEqual(ONGLETS, ['accueil', 'parcours', 'portfolio', 'liens', 'contact']);
  assert.deepEqual(SOUS_PARCOURS, ['profil', 'formation', 'experience', 'engagement', 'competences', 'langues', 'certifications', 'interets']);
});

test('formaterDate', () => {
  assert.equal(formaterDate('2023-06'), 'juin 2023');
  assert.equal(formaterDate('2023-08'), 'août 2023');
  assert.equal(formaterDate('2023'), '2023');
  assert.equal(formaterDate(null), '');
  assert.equal(formaterDate(''), '');
});

test('periode', () => {
  assert.equal(periode({ debut: '2025', enCours: true }), "2025 – aujourd'hui");
  assert.equal(periode({ debut: '2023-06', fin: '2023-08' }), 'juin 2023 – août 2023');
  assert.equal(periode({ debut: '2022-08', fin: '2022-08' }), 'août 2022');
  assert.equal(periode({ debut: '', fin: null }), '');
});

test('normaliser tolère null et les clés manquantes', () => {
  const c = normaliser(null);
  assert.deepEqual(c.parcours.formation, []);
  assert.equal(c.onglets.parcours.sous.interets.visible, true);
  assert.equal(c.site.maintenance.active, false);
  const d = normaliser({ parcours: { langues: [{ langue: 'Kabyle' }] } });
  assert.equal(d.parcours.langues[0].visible, true);
  assert.ok(d.parcours.langues[0].id);
});

test('normaliser garde les valeurs fournies et tolère les types faux', () => {
  const c = normaliser({ onglets: { liens: { visible: false } }, parcours: { formation: 'oops' }, accueil: { competencesCles: null } });
  assert.equal(c.onglets.liens.visible, false);
  assert.deepEqual(c.parcours.formation, []);
  assert.deepEqual(c.accueil.competencesCles, []);
});

test('trierParDate : en cours d\'abord puis début décroissant, copie', () => {
  const items = [{ id: 'a', debut: '2021' }, { id: 'b', debut: '2023-06' }, { id: 'c', debut: '2019', enCours: true }];
  assert.deepEqual(trierParDate(items).map((x) => x.id), ['c', 'b', 'a']);
  assert.equal(items[0].id, 'a');
});

test('formationActuelle ignore les éléments masqués', () => {
  const c = normaliser({ parcours: { formation: [
    { id: 'm', titre: 'M1', debut: '2025', enCours: true, visible: false },
    { id: 'l', titre: 'L3', debut: '2023', fin: '2025' },
    { id: 'b', titre: 'Bac', debut: '2016', fin: '2017' },
  ] } });
  assert.equal(formationActuelle(c).id, 'l');
  assert.equal(formationActuelle(normaliser({})), null);
});

test('derniereExperience : la plus récente visible', () => {
  const c = normaliser({ parcours: { experience: [{ id: 'x', debut: '2022-08' }, { id: 'y', debut: '2023-06' }] } });
  assert.equal(derniereExperience(c).id, 'y');
});

test('ongletsVisibles', () => {
  const c = normaliser({ onglets: { liens: { visible: false } } });
  assert.deepEqual(ongletsVisibles(c), ['accueil', 'parcours', 'portfolio', 'contact']);
});

test('sousOnglets parcours : visibles et non vides', () => {
  const c = normaliser({
    onglets: { parcours: { sous: { langues: { visible: false } } } },
    parcours: { profil: { titre: 'P', texte: 'Texte' }, formation: [{ titre: 'M1' }], langues: [{ langue: 'FR' }], interets: [{ titre: 'Astro', visible: false }] },
  });
  assert.deepEqual(sousOnglets(c, 'parcours'), [{ id: 'profil', titre: 'Profil' }, { id: 'formation', titre: 'Formation' }]);
});

test('sousOnglets liens masque les catégories vides', () => {
  const c = normaliser({ liens: {
    categories: [{ id: 'projets', nom: 'Projets' }, { id: 'android', nom: 'Applis Android' }, { id: 'cache', nom: 'Caché', visible: false }],
    items: [{ url: 'https://a.fr', titre: 'A', categorie: 'projets' }, { url: 'https://b.fr', titre: 'B', categorie: 'android', visible: false },
      { url: 'https://c.fr', titre: 'C', categorie: 'cache' }],
  } });
  assert.deepEqual(sousOnglets(c, 'liens'), [{ id: 'projets', titre: 'Projets' }]);
});

test('sousOnglets portfolio trie et retire le préfixe', () => {
  const r = sousOnglets(normaliser({}), 'portfolio', [{ id: 'b', nom: '2 - Posters' }, { id: 'a', nom: '1 - Design' }]);
  assert.deepEqual(r, [{ id: 'a', titre: 'Design' }, { id: 'b', titre: 'Posters' }]);
  const masque = normaliser({ portfolio: { dossiers: { b: { visible: false } } } });
  assert.deepEqual(sousOnglets(masque, 'portfolio', [{ id: 'b', nom: 'Posters' }, { id: 'a', nom: 'Design' }]), [{ id: 'a', titre: 'Design' }]);
  const renomme = normaliser({ portfolio: { dossiers: { a: { visible: true, nom: 'Illustrations' } } } });
  assert.deepEqual(sousOnglets(renomme, 'portfolio', [{ id: 'a', nom: 'Design' }]), [{ id: 'a', titre: 'Illustrations' }]);
});

test('sousOnglets accueil et contact : aucun', () => {
  assert.deepEqual(sousOnglets(normaliser({}), 'accueil'), []);
  assert.deepEqual(sousOnglets(normaliser({}), 'contact'), []);
});

test('nomAffiche', () => {
  assert.equal(nomAffiche('1 - Posters'), 'Posters');
  assert.equal(nomAffiche('12-Design'), 'Design');
  assert.equal(nomAffiche('Diaporamas'), 'Diaporamas');
});

test('lienSur', () => {
  assert.equal(lienSur('https://x.fr'), true);
  assert.equal(lienSur('http://x.fr/a?b'), true);
  assert.equal(lienSur('javascript:alert(1)'), false);
  assert.equal(lienSur('x'), false);
  assert.equal(lienSur(null), false);
});

test('echapper', () => {
  assert.equal(echapper('<img src=x onerror="a">&\''), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
});

test('valider', () => {
  const c = normaliser({
    parcours: { formation: [{ titre: '' , debut: '2020' }], experience: [{ titre: 'Stage', debut: '2023-08', fin: '2023-06' }] },
    liens: { categories: [{ id: 'p', nom: 'P' }], items: [{ url: 'pas une url', titre: 'X', categorie: 'p' }] },
  });
  const e = valider(c);
  const chemins = e.map((x) => x.chemin);
  assert.ok(chemins.includes('parcours.formation.0.titre'));
  assert.ok(chemins.includes('parcours.experience.0.fin'));
  assert.ok(chemins.includes('liens.items.0.url'));
  assert.ok(e.every((x) => typeof x.message === 'string' && x.message));
});

test('nouvelId : unique avec préfixe', () => {
  const a = nouvelId('f'), b = nouvelId('f');
  assert.match(a, /^f/);
  assert.notEqual(a, b);
});

test('default.json est déjà normalisé et valide', () => {
  const brut = JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
  assert.deepEqual(normaliser(brut), brut);
  assert.deepEqual(valider(brut), []);
  assert.equal(brut.version, 1);
  assert.equal(brut.medias.cv, null);
  assert.ok(brut.liens.items.some((x) => x.titre === 'BioStudy' && x.categorie === 'projets'));
  assert.equal(brut.liens.items.filter((x) => x.categorie === 'projets').length, 9);
  assert.equal(brut.parcours.langues.length, 5);
  assert.ok(brut.parcours.formation.some((x) => x.titre === 'Master 1 Microbiologie' && x.enCours));
});
