import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ONGLETS, SOUS_PARCOURS, normaliser, formaterDate, periode, trierParDate, formationActuelle,
  derniereExperience, ongletsVisibles, parties, aFiche, contactVisible, PARTIES_PARCOURS, nomAffiche, lienSur, valider, nouvelId, echapper,
  TYPES_LIEN, typeLien, couleurPartie, DRAPEAUX, drapeauLangue, duree,
} from '../assets/model.js';

test('constantes', () => {
  assert.deepEqual(ONGLETS, ['accueil', 'parcours', 'portfolio', 'liens']);
  assert.deepEqual(PARTIES_PARCOURS, ['formation', 'experience', 'competences', 'certifications', 'langues', 'engagement', 'interets']);
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
  const c = normaliser({ onglets: { liens: { visible: false } }, parcours: { formation: 'oops' }, accueil: { reperes: null } });
  assert.equal(c.onglets.liens.visible, false);
  assert.deepEqual(c.parcours.formation, []);
  assert.deepEqual(c.accueil.reperes, []);
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

test('ongletsVisibles sans contact', () => {
  const c = normaliser({ onglets: { liens: { visible: false } } });
  assert.deepEqual(ongletsVisibles(c), ['accueil', 'parcours', 'portfolio']);
  assert.deepEqual(ongletsVisibles(normaliser({})), ['accueil', 'parcours', 'portfolio', 'liens']);
});

test('contactVisible', () => {
  assert.equal(contactVisible(normaliser({})), true);
  assert.equal(contactVisible(normaliser({ onglets: { contact: { visible: false } } })), false);
});

test('aFiche', () => {
  assert.equal(aFiche('parcours', 'formation'), true);
  assert.equal(aFiche('parcours', 'certifications'), true);
  assert.equal(aFiche('parcours', 'langues'), false);
  assert.equal(aFiche('parcours', 'interets'), false);
  assert.equal(aFiche('liens', 'projets'), false);
  assert.equal(aFiche('portfolio', 'd1'), false);
});

test('parties parcours : ordre, visibles, non vides, sans profil', () => {
  const c = normaliser({
    onglets: { parcours: { sous: { langues: { visible: false } } } },
    parcours: {
      profil: { titre: 'P', texte: 'Texte' },
      formation: [{ id: 'a', titre: 'L3', debut: '2023' }, { id: 'b', titre: 'M1', debut: '2025', enCours: true }, { id: 'h', titre: 'Caché', visible: false }],
      certifications: [{ id: 'k2', titre: 'B' }, { id: 'k1', titre: 'A' }],
      competences: [{ id: 'c1', domaine: 'Micro' }],
      langues: [{ langue: 'FR' }],
      interets: [{ titre: 'Astro', visible: false }],
    },
  });
  const r = parties(c, 'parcours');
  assert.deepEqual(r.map((x) => x.id), ['formation', 'competences', 'certifications']);
  assert.deepEqual(r.map((x) => x.titre), ['Formation', 'Compétences', 'Certifications']);
  assert.deepEqual(r[0].items.map((x) => x.id), ['b', 'a']);
  assert.deepEqual(r[2].items.map((x) => x.id), ['k2', 'k1']);
});

test('parties liens : catégories non vides, plus récents d\'abord', () => {
  const c = normaliser({ liens: {
    categories: [{ id: 'projets', nom: 'Projets' }, { id: 'android', nom: 'Applis Android' }, { id: 'cache', nom: 'Caché', visible: false }],
    items: [{ id: 'u1', url: 'https://a.fr', titre: 'A', categorie: 'projets', date: '2026-01-01' },
      { id: 'u2', url: 'https://d.fr', titre: 'D', categorie: 'projets', date: '2026-05-01' },
      { url: 'https://b.fr', titre: 'B', categorie: 'android', visible: false }, { url: 'https://c.fr', titre: 'C', categorie: 'cache' }],
  } });
  const r = parties(c, 'liens');
  assert.deepEqual(r.map((x) => [x.id, x.titre]), [['projets', 'Projets']]);
  assert.deepEqual(r[0].items.map((x) => x.id), ['u2', 'u1']);
});

test('parties portfolio : tri par préfixe, nom réglé, dossiers masqués exclus', () => {
  const dossiers = [{ id: 'b', nom: '2 - Posters', fichiers: [{ id: 'f' }] }, { id: 'a', nom: '1 - Design', fichiers: [] }, { id: 'x', nom: '3 - Brouillons', fichiers: [] }];
  const c = normaliser({ portfolio: { dossiers: { x: { visible: false }, a: { nom: 'Illustrations' } } } });
  const r = parties(c, 'portfolio', dossiers);
  assert.deepEqual(r.map((x) => [x.id, x.titre]), [['a', 'Illustrations'], ['b', 'Posters']]);
  assert.deepEqual(r[1].items, [{ id: 'f' }]);
  assert.deepEqual(parties(c, 'accueil'), []);
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

test('valider url de certificat', () => {
  const c = normaliser({ parcours: { certifications: [{ titre: 'A', url: 'pas une url' }, { titre: 'B', url: '' }, { titre: 'C', url: 'https://coursera.org/verify/x' }] } });
  assert.deepEqual(valider(c).map((e) => e.chemin), ['parcours.certifications.0.url']);
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
  assert.equal(brut.parcours.interets.find((x) => x.titre === 'Astronomie').texte, "Membre d'un club d'astronomie, j'ai participé à plusieurs observations d'occultations stellaires.");
  assert.equal(brut.parcours.interets.find((x) => x.titre === 'Cartomagie').texte, 'Je maîtrise des tours de cartes qui demandent précision, sens de l\'observation et beaucoup de pratique.');
  assert.ok(brut.parcours.interets.every((x) => x.image === null));
  assert.ok(brut.parcours.certifications.every((x) => x.url === ''));
  assert.ok(brut.liens.items.every((x) => x.bouton === ''));
});

test('ongletsVisibles : jamais vide, Accueil en dernier recours', () => {
  const c = normaliser({ onglets: Object.fromEntries(ONGLETS.map((id) => [id, { visible: false }])) });
  assert.deepEqual(ongletsVisibles(c), ['accueil']);
});

test('typeLien : détecté depuis l\'adresse', () => {
  const t = (url, extra = {}) => typeLien({ url, type: '', categorie: '', ...extra });
  assert.equal(t('https://www.youtube.com/watch?v=abc'), 'video');
  assert.equal(t('https://youtu.be/abc'), 'video');
  assert.equal(t('https://vimeo.com/123'), 'video');
  assert.equal(t('https://www.tiktok.com/@amar/video/1'), 'video');
  assert.equal(t('https://exemple.fr/film.mp4'), 'video');
  assert.equal(t('https://exemple.fr/affiche.JPG'), 'image');
  assert.equal(t('https://exemple.fr/a/poster.webp?x=1'), 'image');
  assert.equal(t('https://play.google.com/store/apps/details?id=xyz'), 'appli');
  assert.equal(t('https://apps.apple.com/fr/app/x/id1'), 'appli');
  assert.equal(t('https://exemple.fr/appli.apk'), 'appli');
  assert.equal(t('https://exemple.fr/rapport.pdf'), 'document');
  assert.equal(t('https://docs.google.com/document/d/1/edit'), 'document');
  assert.equal(t('https://drive.google.com/file/d/1/view'), 'document');
  assert.equal(t('https://github.com/amar/biostudy'), 'code');
  assert.equal(t('https://gitlab.com/amar/x'), 'code');
  assert.equal(t('https://medium.com/@amar/post'), 'article');
  assert.equal(t('https://amar.substack.com/p/x'), 'article');
  assert.equal(t('https://exemple.fr/blog/mon-billet'), 'article');
  assert.equal(t('https://www.biostudy.xyz/'), 'web');
  assert.equal(t('pas une url'), 'web');
});

test('typeLien : catégorie « Articles » et type forcé', () => {
  const c = { liens: { categories: [{ id: 'art', nom: 'Articles' }, { id: 'p', nom: 'Projets' }] } };
  assert.equal(typeLien({ url: 'https://exemple.fr/x', type: '', categorie: 'art' }, c), 'article');
  assert.equal(typeLien({ url: 'https://exemple.fr/x', type: '', categorie: 'p' }, c), 'web');
  assert.equal(typeLien({ url: 'https://youtu.be/x', type: 'image', categorie: 'p' }, c), 'image');
  assert.equal(typeLien({ url: 'https://youtu.be/x', type: 'inconnu', categorie: 'p' }, c), 'video');
  assert.deepEqual(Object.keys(TYPES_LIEN), ['web', 'video', 'image', 'appli', 'document', 'code', 'article']);
  assert.equal(TYPES_LIEN.video, 'Vidéo');
});

test('couleurPartie : une couleur par rubrique, palette pour liens et portfolio', () => {
  assert.equal(couleurPartie('parcours', 'formation', 0), '--c-blue');
  assert.equal(couleurPartie('parcours', 'experience', 1), '--c-orange');
  assert.equal(couleurPartie('parcours', 'competences', 2), '--c-purple');
  assert.equal(couleurPartie('parcours', 'certifications', 3), '--c-green');
  assert.equal(couleurPartie('parcours', 'langues', 4), '--c-cyan');
  assert.equal(couleurPartie('parcours', 'engagement', 5), '--c-pink');
  assert.equal(couleurPartie('parcours', 'interets', 6), '--c-yellow');
  assert.equal(couleurPartie('liens', 'projets', 0), '--c-blue');
  assert.equal(couleurPartie('liens', 'android', 1), '--c-orange');
  assert.equal(couleurPartie('portfolio', 'dd', 10), couleurPartie('portfolio', 'x', 0));
});

test('liens.items : champs type et media', () => {
  const c = normaliser({ liens: { categories: [], items: [{ id: 'u1', url: 'https://a.fr', titre: 'A' }, { id: 'u2', url: 'https://b.fr', titre: 'B', type: 'video', media: { id: 'm', url: 'https://x/y.jpg' } }] } });
  assert.equal(c.liens.items[0].type, '');
  assert.equal(c.liens.items[0].media, null);
  assert.equal(c.liens.items[1].type, 'video');
  assert.deepEqual(c.liens.items[1].media, { id: 'm', url: 'https://x/y.jpg' });
});

test('valider : type de lien inconnu refusé', () => {
  const c = normaliser({ liens: { categories: [{ id: 'p', nom: 'P' }], items: [{ id: 'u1', url: 'https://a.fr', titre: 'A', categorie: 'p', type: 'bizarre' }] } });
  assert.deepEqual(valider(c).map((e) => e.chemin), ['liens.items.0.type']);
  c.liens.items[0].type = 'code';
  assert.deepEqual(valider(c), []);
});

test('accueil : salutation, intro, repères, domaines (avec image), projet phare', () => {
  const c = normaliser({ accueil: { domaines: [{ titre: 'Design' }], reperes: [{ valeur: '2022', libelle: 'BioStudy' }] } });
  assert.equal(c.accueil.salutation, '');
  assert.equal(c.accueil.intro, '');
  assert.equal(c.accueil.projetPhare, '');
  assert.deepEqual({ ...c.accueil.domaines[0], id: 'x' }, { id: 'x', titre: 'Design', texte: '', image: null, lien: '', visible: true });
  assert.ok(c.accueil.domaines[0].id);
  assert.equal(c.accueil.reperes[0].libelle, 'BioStudy');
  c.accueil.domaines[0].titre = ' ';
  c.accueil.domaines[0].lien = 'javascript:alert(1)';
  assert.deepEqual(valider(c).map((e) => e.chemin), ['accueil.domaines.0.titre', 'accueil.domaines.0.lien']);
  c.accueil.domaines[0].titre = 'Design';
  for (const ok of ['', '#portfolio', 'https://exemple.fr']) { c.accueil.domaines[0].lien = ok; assert.deepEqual(valider(c), []); }
});

test('drapeauLangue : drapeau choisi, sinon deviné depuis le nom de la langue', () => {
  assert.deepEqual(Object.keys(DRAPEAUX), ['fr', 'arabe', 'amazigh', 'gb', 'us', 'es', 'dz', 'de', 'it']);
  assert.equal(DRAPEAUX.arabe, 'Ligue arabe');
  const d = (langue, drapeau = '') => drapeauLangue({ langue, drapeau });
  assert.equal(d('Français'), 'fr');
  assert.equal(d('Arabe'), 'arabe');
  assert.equal(d('Kabyle'), 'amazigh');
  assert.equal(d('Tamazight'), 'amazigh');
  assert.equal(d('Anglais'), 'gb');
  assert.equal(d('Espagnol'), 'es');
  assert.equal(d('Allemand'), 'de');
  assert.equal(d('Italien'), 'it');
  assert.equal(d('Japonais'), '');
  assert.equal(d('Anglais', 'us'), 'us');
  assert.equal(d('Anglais', 'zz'), 'gb');
  assert.equal(normaliser({ parcours: { langues: [{ langue: 'Kabyle' }] } }).parcours.langues[0].drapeau, '');
});

test('duree : mois inclus, années, en cours jusqu\'à aujourd\'hui', () => {
  const ref = new Date(2026, 9, 29);
  assert.equal(duree({ debut: '2023-06', fin: '2023-08' }, ref), '3 mois');
  assert.equal(duree({ debut: '2023-06', fin: '2023-06' }, ref), '1 mois');
  assert.equal(duree({ debut: '2022-09', fin: '2024-06' }, ref), '1 an et 10 mois');
  assert.equal(duree({ debut: '2021-09', fin: '2023-08' }, ref), '2 ans');
  assert.equal(duree({ debut: '2023', fin: '2025' }, ref), '2 ans');
  assert.equal(duree({ debut: '2016', fin: '2017' }, ref), '1 an');
  assert.equal(duree({ debut: '2025', fin: '2025' }, ref), '');
  assert.equal(duree({ debut: '2025-09', enCours: true }, ref), '1 an et 2 mois');
  assert.equal(duree({ debut: '', fin: '2020' }, ref), '');
});
