import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerGas } from './gas-fakes.mjs';

const DEFAUT = readFileSync(new URL('../content/default.json', import.meta.url), 'utf8');
const URL_DEFAUT = 'https://amarbcrb.pages.dev/content/default.json';

function installe(opts = {}) {
  const g = creerGas({ motDePasse: 'secret', pages: { [URL_DEFAUT]: DEFAUT, ...(opts.pages || {}) } });
  g.ctx.installer();
  return g;
}
const connecte = (g) => g.post({ a: 'connexion', motDePasse: 'secret' }).jeton;

test('installer refuse un mot de passe vide', () => {
  const g = creerGas({ motDePasse: '', pages: { [URL_DEFAUT]: DEFAUT } });
  assert.throws(() => g.ctx.installer(), /MOT_DE_PASSE_INITIAL/);
});

test('installer crée les dossiers, contenu.json et range le mot de passe haché', () => {
  const g = installe();
  const noms = [...g.dossiers.values()].map((d) => d.getName());
  assert.ok(noms.includes('Site amarbcrb') && noms.includes('Médias') && noms.includes('Portfolio'));
  assert.ok(g.props.get('MDP_HASH') && g.props.get('MDP_HASH') !== 'secret');
  assert.ok(g.props.get('CLE') && g.props.get('MDP_SEL'));
  const f = g.fichiers.get(g.props.get('ID_CONTENU'));
  assert.equal(f.getName(), 'contenu.json');
});

test('contenu renvoie version et contenu', () => {
  const r = installe().get({ a: 'contenu' });
  assert.equal(r.ok, true);
  assert.equal(r.version, 1);
  assert.equal(r.contenu.site.nom, 'Amar Bouchareb');
});

test('action inconnue → entree', () => {
  assert.equal(installe().get({ a: 'nimporte' }).erreur, 'entree');
});

test('connexion : bon mot de passe → jeton qui vérifie', () => {
  const g = installe();
  const r = g.post({ a: 'connexion', motDePasse: 'secret' });
  assert.equal(r.ok, true);
  assert.ok(r.expire > Date.now() + 29 * 864e5 && r.expire <= Date.now() + 30 * 864e5);
  assert.equal(g.ctx.verifierJeton(r.jeton), true);
  assert.equal(g.ctx.verifierJeton(r.jeton.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))), false);
});

test('connexion : 5 échecs → bloque, même avec le bon mot de passe', () => {
  const g = installe();
  for (let i = 0; i < 4; i++) assert.equal(g.post({ a: 'connexion', motDePasse: 'faux' }).erreur, 'mot_de_passe');
  assert.equal(g.post({ a: 'connexion', motDePasse: 'faux' }).erreur, 'mot_de_passe');
  assert.equal(g.post({ a: 'connexion', motDePasse: 'secret' }).erreur, 'bloque');
});

test('jeton expiré → jeton', () => {
  const g = installe();
  const vieux = g.ctx.signerJeton(Date.now() - 1000);
  assert.equal(g.ctx.verifierJeton(vieux), false);
  assert.equal(g.post({ a: 'enregistrer', jeton: vieux, versionDeBase: 1, contenu: {} }).erreur, 'jeton');
});

test('enregistrer : jeton faux → erreur jeton', () => {
  const g = installe();
  assert.equal(g.post({ a: 'enregistrer', jeton: 'abc.def', versionDeBase: 1, contenu: {} }).erreur, 'jeton');
});

test('enregistrer : version + 1, contenu réécrit en place (même id de fichier)', () => {
  const g = installe();
  const jeton = connecte(g);
  const idAvant = g.props.get('ID_CONTENU');
  const c = JSON.parse(DEFAUT);
  c.accueil.positionnement = 'Nouvelle phrase';
  const r = g.post({ a: 'enregistrer', jeton, versionDeBase: 1, contenu: c });
  assert.deepEqual([r.ok, r.version], [true, 2]);
  assert.equal(g.props.get('ID_CONTENU'), idAvant);
  const lu = g.get({ a: 'contenu' });
  assert.equal(lu.version, 2);
  assert.equal(lu.contenu.accueil.positionnement, 'Nouvelle phrase');
  assert.ok(lu.contenu.updatedAt);
  assert.equal([...g.fichiers.values()].filter((f) => f.getName() === 'contenu.json').length, 1);
});

test('enregistrer : versionDeBase périmée → conflit, fichier inchangé', () => {
  const g = installe();
  const jeton = connecte(g);
  const r = g.post({ a: 'enregistrer', jeton, versionDeBase: 0, contenu: { x: 1 } });
  assert.deepEqual([r.erreur, r.version], ['conflit', 1]);
  assert.equal(g.get({ a: 'contenu' }).contenu.site.nom, 'Amar Bouchareb');
});

test('enregistrer : contenu absent → entree', () => {
  const g = installe();
  assert.equal(g.post({ a: 'enregistrer', jeton: connecte(g), versionDeBase: 1 }).erreur, 'entree');
});

const PNG = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');

test('envoyerMedia ne supprime rien ; enregistrer met à la corbeille le logo, la photo, le favicon ou le CV remplacé', () => {
  const g = installe();
  const jeton = connecte(g);
  const a = g.post({ a: 'envoyerMedia', jeton, emplacement: 'photo', nom: 'a.png', type: 'image/png', base64: PNG });
  assert.equal(a.ok, true);
  assert.match(a.url, /^https:\/\/drive\.google\.com\/thumbnail\?id=.+&sz=w2000$/);
  const c = JSON.parse(DEFAUT);
  c.medias.photo = { id: a.id, url: a.url };
  assert.equal(g.post({ a: 'enregistrer', jeton, versionDeBase: 1, contenu: c }).version, 2);
  const b = g.post({ a: 'envoyerMedia', jeton, emplacement: 'photo', nom: 'b.png', type: 'image/png', base64: PNG });
  const orphelin = g.post({ a: 'envoyerMedia', jeton, emplacement: 'logo', nom: 'o.png', type: 'image/png', base64: PNG });
  assert.equal(g.fichiers.get(a.id).isTrashed(), false, 'pas de suppression à l\'envoi');
  assert.deepEqual(g.fichiers.get(b.id)._partage, ['ANYONE_WITH_LINK', 'VIEW']);
  c.medias.photo = { id: b.id, url: b.url };
  assert.equal(g.post({ a: 'enregistrer', jeton, versionDeBase: 2, contenu: c }).version, 3);
  assert.equal(g.fichiers.get(a.id).isTrashed(), true, 'ancienne photo remplacée → corbeille');
  assert.equal(g.fichiers.get(orphelin.id).isTrashed(), false, 'un envoi jamais utilisé reste dans la médiathèque');
  assert.equal(g.fichiers.get(b.id).isTrashed(), false);
});

test('enregistrer en conflit ne supprime aucun média', () => {
  const g = installe();
  const jeton = connecte(g);
  const a = g.post({ a: 'envoyerMedia', jeton, emplacement: 'photo', nom: 'a.png', type: 'image/png', base64: PNG });
  g.post({ a: 'enregistrer', jeton, versionDeBase: 0, contenu: JSON.parse(DEFAUT) });
  assert.equal(g.fichiers.get(a.id).isTrashed(), false);
});

test('envoyerMedia : CV de plus de 10 Mo → entree', () => {
  const g = installe();
  const gros = Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64');
  assert.equal(g.post({ a: 'envoyerMedia', jeton: connecte(g), emplacement: 'cv', nom: 'cv.pdf', type: 'application/pdf', base64: gros }).erreur, 'entree');
});

test('envoyerMedia : emplacement ou type invalide → entree', () => {
  const g = installe();
  const jeton = connecte(g);
  assert.equal(g.post({ a: 'envoyerMedia', jeton, emplacement: 'autre', nom: 'a.png', type: 'image/png', base64: PNG }).erreur, 'entree');
  assert.equal(g.post({ a: 'envoyerMedia', jeton, emplacement: 'cv', nom: 'a.png', type: 'image/png', base64: PNG }).erreur, 'entree');
});

test('envoyerMedia : CV → lien de téléchargement', () => {
  const g = installe();
  const r = g.post({ a: 'envoyerMedia', jeton: connecte(g), emplacement: 'cv', nom: 'cv.pdf', type: 'application/pdf', base64: PNG });
  assert.match(r.url, /^https:\/\/drive\.google\.com\/uc\?export=download&id=/);
});

test('apercuLien : lit og:title, og:description, og:image (URL relative résolue), repli sur <title>', () => {
  const html = `<html><head><title>Repli</title>
    <meta content="Mon appli" property="og:title">
    <meta property="og:description" content="Une appli &amp; plus">
    <meta property='og:image' content='/img/a.png'></head></html>`;
  const g = installe({ pages: { 'https://ex.fr/app/page': html, 'https://ex.fr/b': '<title> Titre B </title><meta name="description" content="Desc B">' } });
  const jeton = connecte(g);
  assert.deepEqual(g.post({ a: 'apercuLien', jeton, url: 'https://ex.fr/app/page' }), { ok: true, titre: 'Mon appli', description: 'Une appli & plus', image: 'https://ex.fr/img/a.png' });
  assert.deepEqual(g.post({ a: 'apercuLien', jeton, url: 'https://ex.fr/b' }), { ok: true, titre: 'Titre B', description: 'Desc B', image: '' });
});

test('apercuLien : URL non http(s) → entree', () => {
  const g = installe();
  assert.equal(g.post({ a: 'apercuLien', jeton: connecte(g), url: 'javascript:alert(1)' }).erreur, 'entree');
});

function portfolioDeTest(g) {
  const racine = [...g.dossiers.values()].find((d) => d.getName() === 'Portfolio');
  const posters = racine.createFolder('2 - Posters');
  racine.createFolder('1 - Design').createFile('a.jpg', 'x', 'image/jpeg');
  posters.createFile('p.pdf', 'x', 'application/pdf');
  return racine;
}

test('dossierPortfolio : partage le dossier et renvoie les sous-dossiers', () => {
  const g = installe();
  const racine = portfolioDeTest(g);
  const r = g.post({ a: 'dossierPortfolio', jeton: connecte(g), lienDossier: `https://drive.google.com/drive/folders/${racine.getId()}?usp=sharing` });
  assert.equal(r.id, racine.getId());
  assert.deepEqual(r.sousDossiers.map((d) => d.nom).sort(), ['1 - Design', '2 - Posters']);
  assert.equal(racine.getSharingAccess(), 'PRIVATE', 'racine non publique : seuls les fichiers le sont');
  assert.equal(g.props.get('ID_PORTFOLIO'), racine.getId());
});

test('portfolio : liste fichiers avec apercu = URL thumbnail, servie depuis le cache au second appel', () => {
  const g = installe();
  portfolioDeTest(g);
  const r = g.get({ a: 'portfolio' });
  const design = r.dossiers.find((d) => d.nom === '1 - Design');
  assert.equal(design.fichiers[0].nom, 'a.jpg');
  assert.equal(design.fichiers[0].type, 'image/jpeg');
  assert.match(design.fichiers[0].apercu, /^https:\/\/drive\.google\.com\/thumbnail\?id=.+&sz=w800$/);
  assert.match(design.fichiers[0].lien, /^https:\/\/drive\.google\.com\/file\/d\//);
  const lectures = g.appels.folderReads;
  g.get({ a: 'portfolio' });
  assert.equal(g.appels.folderReads, lectures);
});

test('portfolio frais=1 avec jeton valide → relit Drive ; sans jeton → cache', () => {
  const g = installe();
  portfolioDeTest(g);
  g.get({ a: 'portfolio' });
  const lectures = g.appels.folderReads;
  g.get({ a: 'portfolio', frais: '1' });
  assert.equal(g.appels.folderReads, lectures);
  g.get({ a: 'portfolio', frais: '1', jeton: connecte(g) });
  assert.ok(g.appels.folderReads > lectures);
});

test('installer relancé : change seulement le mot de passe', () => {
  const g = installe();
  const id = g.props.get('ID_CONTENU');
  const hash = g.props.get('MDP_HASH');
  g.ctx.installer();
  assert.equal(g.props.get('ID_CONTENU'), id);
  assert.equal(g.props.get('MDP_HASH'), hash);
  assert.equal([...g.fichiers.values()].filter((f) => f.getName() === 'contenu.json').length, 1);
});

test('installer : le dossier Portfolio n\'est pas public lui-même (ses fichiers le sont un par un à la lecture)', () => {
  const g = installe();
  const racine = [...g.dossiers.values()].find((d) => d.getName() === 'Portfolio');
  assert.notDeepEqual(racine._partage, ['ANYONE_WITH_LINK', 'VIEW']);
  assert.equal(g.props.get('ID_PORTFOLIO'), racine.getId());
});

test('installer relancé : nouvelle clé, les anciens jetons sont refusés', () => {
  const g = installe();
  const ancien = connecte(g);
  const cle = g.props.get('CLE');
  g.ctx.installer();
  assert.notEqual(g.props.get('CLE'), cle);
  assert.equal(g.post({ a: 'enregistrer', jeton: ancien, versionDeBase: 1, contenu: {} }).erreur, 'jeton');
  assert.equal(g.ctx.verifierJeton(connecte(g)), true);
});

test('portfolio : fichiers et dossiers à la corbeille ignorés', () => {
  const g = installe();
  const racine = portfolioDeTest(g);
  const design = [...g.dossiers.values()].find((d) => d.getName() === '1 - Design');
  design.createFile('supprime.jpg', 'x', 'image/jpeg').setTrashed(true);
  racine.createFolder('Ancien').setTrashed(true);
  const r = g.get({ a: 'portfolio' });
  assert.deepEqual(r.dossiers.map((d) => d.nom).sort(), ['1 - Design', '2 - Posters']);
  assert.deepEqual(r.dossiers.find((d) => d.nom === '1 - Design').fichiers.map((f) => f.nom), ['a.jpg']);
});

test('envoyerMedia image → thumbnail w1600', () => {
  const g = installe();
  const r = g.post({ a: 'envoyerMedia', jeton: connecte(g), emplacement: 'image', nom: 'astro.jpg', type: 'image/jpeg', base64: PNG });
  assert.equal(r.ok, true);
  assert.match(r.url, /^https:\/\/drive\.google\.com\/thumbnail\?id=.+&sz=w1600$/);
  assert.equal(g.post({ a: 'envoyerMedia', jeton: connecte(g), emplacement: 'image', nom: 'x.pdf', type: 'application/pdf', base64: PNG }).erreur, 'entree');
});

test('enregistrer garde l\'image d\'un intérêt, même retirée (médiathèque)', () => {
  const g = installe();
  const jeton = connecte(g);
  const a = g.post({ a: 'envoyerMedia', jeton, emplacement: 'image', nom: 'a.jpg', type: 'image/jpeg', base64: PNG });
  const b = g.post({ a: 'envoyerMedia', jeton, emplacement: 'image', nom: 'b.jpg', type: 'image/jpeg', base64: PNG });
  const c = JSON.parse(DEFAUT);
  c.parcours.interets[0].image = { id: a.id, url: a.url };
  c.parcours.interets[1].image = { id: b.id, url: b.url };
  assert.equal(g.post({ a: 'enregistrer', jeton, versionDeBase: 1, contenu: c }).version, 2);
  assert.equal(g.fichiers.get(a.id).isTrashed(), false);
  assert.equal(g.fichiers.get(b.id).isTrashed(), false);
  c.parcours.interets[1].image = null;
  assert.equal(g.post({ a: 'enregistrer', jeton, versionDeBase: 2, contenu: c }).version, 3);
  assert.equal(g.fichiers.get(a.id).isTrashed(), false);
  assert.equal(g.fichiers.get(b.id).isTrashed(), false, 'image retirée d\'une carte : gardée dans la médiathèque');
});

test('enregistrer garde l\'image choisie d\'un lien, même retirée (médiathèque)', () => {
  const g = installe();
  const jeton = connecte(g);
  const a = g.post({ a: 'envoyerMedia', jeton, emplacement: 'image', nom: 'a.jpg', type: 'image/jpeg', base64: PNG });
  const c = JSON.parse(DEFAUT);
  c.liens.items[0].media = { id: a.id, url: a.url };
  assert.equal(g.post({ a: 'enregistrer', jeton, versionDeBase: 1, contenu: c }).version, 2);
  assert.equal(g.fichiers.get(a.id).isTrashed(), false);
  c.liens.items[0].media = null;
  assert.equal(g.post({ a: 'enregistrer', jeton, versionDeBase: 2, contenu: c }).version, 3);
  assert.equal(g.fichiers.get(a.id).isTrashed(), false, 'image retirée d\'une carte : gardée dans la médiathèque');
});

test('enregistrer garde les images des domaines de l\'Accueil', () => {
  const g = installe();
  const jeton = connecte(g);
  const a = g.post({ a: 'envoyerMedia', jeton, emplacement: 'image', nom: 'a.jpg', type: 'image/jpeg', base64: PNG });
  const c = JSON.parse(DEFAUT);
  c.accueil.domaines[0].image = { id: a.id, url: a.url };
  assert.equal(g.post({ a: 'enregistrer', jeton, versionDeBase: 1, contenu: c }).version, 2);
  assert.equal(g.fichiers.get(a.id).isTrashed(), false);
  c.accueil.domaines[0].image = null;
  assert.equal(g.post({ a: 'enregistrer', jeton, versionDeBase: 2, contenu: c }).version, 3);
  assert.equal(g.fichiers.get(a.id).isTrashed(), false, 'image retirée d\'une carte : gardée dans la médiathèque');
});

test('enregistrer garde les images des certifications et des compétences', () => {
  const g = installe();
  const jeton = connecte(g);
  const a = g.post({ a: 'envoyerMedia', jeton, emplacement: 'image', nom: 'a.jpg', type: 'image/jpeg', base64: PNG });
  const b = g.post({ a: 'envoyerMedia', jeton, emplacement: 'image', nom: 'b.jpg', type: 'image/jpeg', base64: PNG });
  const c = JSON.parse(DEFAUT);
  c.parcours.certifications[0].image = { id: a.id, url: a.url };
  c.parcours.competences[0].image = { id: b.id, url: b.url };
  assert.equal(g.post({ a: 'enregistrer', jeton, versionDeBase: 1, contenu: c }).version, 2);
  assert.equal(g.fichiers.get(a.id).isTrashed(), false);
  assert.equal(g.fichiers.get(b.id).isTrashed(), false);
  c.parcours.competences[0].image = null;
  assert.equal(g.post({ a: 'enregistrer', jeton, versionDeBase: 2, contenu: c }).version, 3);
  assert.equal(g.fichiers.get(b.id).isTrashed(), false, 'image retirée d\'une carte : gardée dans la médiathèque');
});

/* ===================== v4 : médiathèque, portfolio en place, galeries Drive, cache du contenu ===================== */
const PNG2 = PNG;
function avecPortfolio(g) {
  const racine = g.dossiers.get(g.props.get('ID_PORTFOLIO'));
  const design = racine.createFolder('1 - Design');
  design.createFile('a.jpg', 'x', 'image/jpeg');
  return { racine, design };
}
function contenuAvec(g, jeton, modif) {
  const c = g.get({ a: 'contenu' }).contenu;
  modif(c);
  return g.post({ a: 'enregistrer', jeton, versionDeBase: c.version, contenu: c });
}

test('contenu : servi depuis le cache Google au second appel, cache mis à jour à l\'enregistrement', () => {
  const g = installe();
  g.get({ a: 'contenu' });
  const lectures = g.appels.lecturesFichier;
  assert.equal(g.get({ a: 'contenu' }).version, 1);
  assert.equal(g.appels.lecturesFichier, lectures, 'pas de lecture Drive');
  const jeton = connecte(g);
  contenuAvec(g, jeton, (c) => { c.accueil.salutation = 'Salut'; });
  const apres = g.appels.lecturesFichier;
  const r = g.get({ a: 'contenu' });
  assert.equal(r.version, 2);
  assert.equal(r.contenu.accueil.salutation, 'Salut');
  assert.equal(g.appels.lecturesFichier, apres, 'le nouveau contenu est déjà en cache');
});

test('contenu de plus de 100 Ko : pas de cache, lecture Drive, aucune erreur', () => {
  const g = installe();
  const jeton = connecte(g);
  assert.equal(contenuAvec(g, jeton, (c) => { c.parcours.profil.texte = 'x'.repeat(120 * 1024); }).version, 2);
  assert.equal(g.get({ a: 'contenu' }).contenu.parcours.profil.texte.length, 120 * 1024);
});

test('listerMedias : jeton requis ; fichiers de Médias, plus récents d\'abord, sans la corbeille', () => {
  const g = installe();
  const jeton = connecte(g);
  assert.equal(g.post({ a: 'listerMedias', jeton: 'faux' }).erreur, 'jeton');
  const a = g.post({ a: 'envoyerMedia', jeton, emplacement: 'image', nom: 'a.jpg', type: 'image/jpeg', base64: PNG2 });
  const b = g.post({ a: 'envoyerMedia', jeton, emplacement: 'cv', nom: 'cv.pdf', type: 'application/pdf', base64: PNG2 });
  const c = g.post({ a: 'envoyerMedia', jeton, emplacement: 'image', nom: 'c.jpg', type: 'image/jpeg', base64: PNG2 });
  g.fichiers.get(c.id).setTrashed(true);
  const r = g.post({ a: 'listerMedias', jeton });
  assert.deepEqual(r.medias.map((m) => m.id), [b.id, a.id]);
  assert.match(r.medias[1].url, /thumbnail\?id=.+&sz=w1600$/);
  assert.match(r.medias[0].url, /uc\?export=download&id=/);
  assert.equal(r.medias[1].nom, 'a.jpg');
  assert.equal(r.medias[1].type, 'image/jpeg');
  assert.ok(r.medias[1].taille > 0);
});

test('supprimerMedia : refusé s\'il est utilisé (dit où), sinon à la corbeille ; hors Médias → entree', () => {
  const g = installe();
  const jeton = connecte(g);
  const a = g.post({ a: 'envoyerMedia', jeton, emplacement: 'image', nom: 'a.jpg', type: 'image/jpeg', base64: PNG2 });
  contenuAvec(g, jeton, (c) => { c.parcours.interets[0].image = { id: a.id, url: a.url }; c.accueil.domaines[1].image = { id: a.id, url: a.url }; });
  const r = g.post({ a: 'supprimerMedia', jeton, id: a.id });
  assert.equal(r.erreur, 'utilise');
  assert.deepEqual([...r.emplacements].sort(), ['accueil.domaines.1.image', 'parcours.interets.0.image']);
  assert.equal(g.fichiers.get(a.id).isTrashed(), false);
  contenuAvec(g, jeton, (c) => { c.parcours.interets[0].image = null; c.accueil.domaines[1].image = null; });
  assert.equal(g.post({ a: 'supprimerMedia', jeton, id: a.id }).ok, true);
  assert.equal(g.fichiers.get(a.id).isTrashed(), true);
  assert.equal(g.post({ a: 'supprimerMedia', jeton, id: g.props.get('ID_CONTENU') }).erreur, 'entree');
});

test('envoyerFichier : dans un dossier du portfolio → créé, partagé, cache portfolio vidé ; ailleurs → entree', () => {
  const g = installe();
  const jeton = connecte(g);
  const { design } = avecPortfolio(g);
  g.get({ a: 'portfolio' });
  const r = g.post({ a: 'envoyerFichier', jeton, dossierId: design.getId(), nom: 'affiche.png', type: 'image/png', base64: PNG2 });
  assert.equal(r.ok, true);
  const f = g.fichiers.get(r.id);
  assert.equal(f._parent, design);
  assert.deepEqual(f._partage, ['ANYONE_WITH_LINK', 'VIEW']);
  assert.ok(g.get({ a: 'portfolio' }).dossiers.find((d) => d.id === design.getId()).fichiers.some((x) => x.nom === 'affiche.png'));
  const site = g.dossiers.get(g.props.get('ID_SITE'));
  assert.equal(g.post({ a: 'envoyerFichier', jeton, dossierId: site.getId(), nom: 'x.png', type: 'image/png', base64: PNG2 }).erreur, 'entree');
  assert.equal(g.post({ a: 'envoyerFichier', jeton, dossierId: design.getId(), nom: 'x.png', type: 'image/png', base64: Buffer.alloc(26 * 1024 * 1024).toString('base64') }).erreur, 'entree');
});

test('creerDossier / renommerDossier / supprimerDossier : seulement sous la racine du portfolio', () => {
  const g = installe();
  const jeton = connecte(g);
  const { racine, design } = avecPortfolio(g);
  const r = g.post({ a: 'creerDossier', jeton, parentId: racine.getId(), nom: '3 - Vidéos' });
  assert.equal(r.nom, '3 - Vidéos');
  assert.equal(g.dossiers.get(r.id)._parent, racine);
  assert.equal(g.post({ a: 'creerDossier', jeton, parentId: racine.getId(), nom: '  ' }).erreur, 'entree');
  assert.equal(g.post({ a: 'creerDossier', jeton, parentId: design.getId(), nom: 'Sous-sous' }).erreur, 'entree');
  assert.equal(g.post({ a: 'renommerDossier', jeton, id: r.id, nom: '3 - Montages' }).ok, true);
  assert.equal(g.dossiers.get(r.id).getName(), '3 - Montages');
  assert.equal(g.post({ a: 'renommerDossier', jeton, id: racine.getId(), nom: 'X' }).erreur, 'entree');
  assert.equal(g.post({ a: 'supprimerDossier', jeton, id: r.id }).ok, true);
  assert.equal(g.dossiers.get(r.id).isTrashed(), true);
  assert.equal(g.post({ a: 'supprimerDossier', jeton, id: g.props.get('ID_MEDIAS') }).erreur, 'entree');
});

test('supprimerFichier : un fichier du portfolio → corbeille ; contenu.json ou un média → entree', () => {
  const g = installe();
  const jeton = connecte(g);
  const { design } = avecPortfolio(g);
  const f = [...g.fichiers.values()].find((x) => x._parent === design);
  assert.equal(g.post({ a: 'supprimerFichier', jeton, id: f.getId() }).ok, true);
  assert.equal(f.isTrashed(), true);
  assert.equal(g.post({ a: 'supprimerFichier', jeton, id: g.props.get('ID_CONTENU') }).erreur, 'entree');
  const m = g.post({ a: 'envoyerMedia', jeton, emplacement: 'image', nom: 'a.jpg', type: 'image/jpeg', base64: PNG2 });
  assert.equal(g.post({ a: 'supprimerFichier', jeton, id: m.id }).erreur, 'entree');
});

test('galeries Drive : dossierGalerie partage le dossier ; galerie lisible seulement si un onglet la déclare ; on peut y envoyer', () => {
  const g = installe();
  const jeton = connecte(g);
  const astro = g.ctx.DriveApp.createFolder('Astronomie');
  const lune = astro.createFolder('Lune');
  lune.createFile('l.jpg', 'x', 'image/jpeg');
  astro.createFile('ciel.jpg', 'x', 'image/jpeg');
  const r = g.post({ a: 'dossierGalerie', jeton, lienDossier: `https://drive.google.com/drive/folders/${astro.getId()}` });
  assert.equal(r.id, astro.getId());
  assert.equal(r.nom, 'Astronomie');
  assert.equal(astro.getSharingAccess(), 'PRIVATE');
  assert.notEqual(g.props.get('ID_PORTFOLIO'), astro.getId());
  assert.equal(g.get({ a: 'galerie', id: astro.getId() }).erreur, 'entree', 'pas encore déclarée dans le contenu');
  assert.equal(g.post({ a: 'envoyerFichier', jeton, dossierId: lune.getId(), nom: 'x.png', type: 'image/png', base64: PNG2 }).erreur, 'entree');
  contenuAvec(g, jeton, (c) => { c.onglets.perso = [{ id: 'astro', nom: 'Astronomie', type: 'drive', dossierId: astro.getId(), visible: true }]; });
  const gal = g.get({ a: 'galerie', id: astro.getId() });
  assert.deepEqual(gal.dossiers.map((d) => [d.nom, d.fichiers.map((x) => x.nom)]), [['Lune', ['l.jpg']]]);
  assert.deepEqual(gal.fichiers.map((x) => x.nom), ['ciel.jpg']);
  assert.equal(g.post({ a: 'envoyerFichier', jeton, dossierId: lune.getId(), nom: 'x.png', type: 'image/png', base64: PNG2 }).ok, true);
  assert.equal(g.post({ a: 'creerDossier', jeton, parentId: astro.getId(), nom: 'Saturne' }).ok, true);
  assert.equal(g.get({ a: 'galerie', id: g.props.get('ID_MEDIAS') }).erreur, 'entree');
});

test('le dossier du site et Médias ne peuvent devenir ni portfolio ni galerie ; contenu.json jamais supprimable', () => {
  const g = installe();
  const jeton = connecte(g);
  for (const cle of ['ID_SITE', 'ID_MEDIAS']) {
    const lien = `https://drive.google.com/drive/folders/${g.props.get(cle)}`;
    assert.equal(g.post({ a: 'dossierPortfolio', jeton, lienDossier: lien }).erreur, 'entree');
    assert.equal(g.post({ a: 'dossierGalerie', jeton, lienDossier: lien }).erreur, 'entree');
  }
  contenuAvec(g, jeton, (c) => { c.onglets.perso = [{ id: 'x', nom: 'X', type: 'drive', dossierId: g.props.get('ID_SITE'), visible: true }]; });
  assert.equal(g.post({ a: 'supprimerFichier', jeton, id: g.props.get('ID_CONTENU') }).erreur, 'entree');
  assert.equal(g.fichiers.get(g.props.get('ID_CONTENU')).isTrashed(), false);
  assert.equal(g.get({ a: 'galerie', id: g.props.get('ID_SITE') }).erreur, 'entree');
});

/* ===================== dossiers protégés par mot de passe ===================== */
function portfolioProtege(g, jeton) {
  const { racine, design } = avecPortfolio(g);
  const prive = racine.createFolder('2 - Clients');
  const img = prive.createFile('maquette.png', 'img', 'image/png');
  const pdf = prive.createFile('devis.pdf', 'pdf', 'application/pdf');
  assert.equal(g.post({ a: 'protegerDossier', jeton, id: prive.getId(), motDePasse: 'clients2026' }).ok, true);
  return { racine, design, prive, img, pdf };
}

test('portfolio public : chaque fichier est partagé un par un à la lecture, la racine est rendue privée', () => {
  const g = installe();
  const { racine, design } = avecPortfolio(g);
  racine.setSharing('ANYONE_WITH_LINK', 'VIEW');
  g.get({ a: 'portfolio' });
  assert.equal(racine.getSharingAccess(), 'PRIVATE');
  [...g.fichiers.values()].filter((f) => f._parent === design).forEach((f) => assert.deepEqual(f._partage, ['ANYONE_WITH_LINK', 'VIEW']));
});

test('protegerDossier : jeton requis, mot de passe de 4 caractères au moins ; fichiers rendus privés ; liste sans fichiers', () => {
  const g = installe();
  const jeton = connecte(g);
  const { racine, prive, img, pdf } = portfolioProtege(g, jeton);
  assert.equal(g.post({ a: 'protegerDossier', jeton: 'faux', id: prive.getId(), motDePasse: 'abcd' }).erreur, 'jeton');
  assert.equal(g.post({ a: 'protegerDossier', jeton, id: prive.getId(), motDePasse: 'abc' }).erreur, 'entree');
  assert.equal(g.post({ a: 'protegerDossier', jeton, id: g.props.get('ID_MEDIAS'), motDePasse: 'abcd' }).erreur, 'entree');
  assert.equal(img.getSharingAccess(), 'PRIVATE');
  assert.equal(pdf.getSharingAccess(), 'PRIVATE');
  assert.ok(!JSON.stringify([...g.props.values()]).includes('clients2026'), 'mot de passe jamais gardé en clair');
  const liste = g.get({ a: 'portfolio' });
  const d = liste.dossiers.find((x) => x.id === prive.getId());
  assert.equal(d.protege, true);
  assert.deepEqual(d.fichiers, []);
  assert.equal(img.getSharingAccess(), 'PRIVATE', 'la lecture publique ne repartage pas un dossier protégé');
  assert.ok(!JSON.stringify(g.get({ a: 'contenu' })).includes(prive.getId() + '"'), 'rien dans le contenu public');
  void racine;
});

test('ouvrirDossier : bon mot de passe → clé 30 jours, fichiers et liens ; mauvais → mot_de_passe, bloqué après 5 échecs', () => {
  const g = installe();
  const jeton = connecte(g);
  const { prive } = portfolioProtege(g, jeton);
  assert.equal(g.post({ a: 'liensDossier', jeton, id: prive.getId(), liens: [{ titre: 'Maquette Figma', url: 'https://figma.com/x' }, { titre: 'Mauvais', url: 'javascript:alert(1)' }] }).erreur, 'entree');
  assert.equal(g.post({ a: 'liensDossier', jeton, id: prive.getId(), liens: [{ titre: 'Maquette Figma', url: 'https://figma.com/x' }] }).ok, true);
  const r = g.post({ a: 'ouvrirDossier', id: prive.getId(), motDePasse: 'clients2026' });
  assert.equal(r.ok, true);
  assert.ok(r.expire > Date.now() + 29 * 864e5);
  assert.deepEqual(r.dossier.fichiers.map((f) => [f.nom, f.type]), [['devis.pdf', 'application/pdf'], ['maquette.png', 'image/png']]);
  assert.ok(r.dossier.fichiers.every((f) => !f.lien && !f.apercu), 'aucune adresse Drive publique');
  assert.deepEqual(r.dossier.liens, [{ titre: 'Maquette Figma', url: 'https://figma.com/x' }]);
  for (let i = 0; i < 5; i++) assert.equal(g.post({ a: 'ouvrirDossier', id: prive.getId(), motDePasse: 'faux' }).erreur, 'mot_de_passe');
  assert.equal(g.post({ a: 'ouvrirDossier', id: prive.getId(), motDePasse: 'clients2026' }).erreur, 'bloque');
});

test('fichierProtege : contenu ou miniature en base64 avec la clé ; clé d\'un autre dossier ou périmée → refusé', () => {
  const g = installe();
  const jeton = connecte(g);
  const { prive, img, pdf, design } = portfolioProtege(g, jeton);
  const { cle } = g.post({ a: 'ouvrirDossier', id: prive.getId(), motDePasse: 'clients2026' });
  const r = g.post({ a: 'fichierProtege', id: img.getId(), cle });
  assert.equal(r.type, 'image/png');
  assert.equal(Buffer.from(r.base64, 'base64').toString(), 'img');
  assert.equal(Buffer.from(g.post({ a: 'fichierProtege', id: img.getId(), cle, taille: 'apercu' }).base64, 'base64').toString(), 'mini:maquette.png');
  assert.equal(g.post({ a: 'fichierProtege', id: pdf.getId(), cle }).type, 'application/pdf');
  const autre = [...g.fichiers.values()].find((f) => f._parent === design);
  assert.equal(g.post({ a: 'fichierProtege', id: autre.getId(), cle }).erreur, 'cle');
  assert.equal(g.post({ a: 'fichierProtege', id: img.getId(), cle: 'x.y' }).erreur, 'cle');
  /* nouveau mot de passe : les anciennes clés ne marchent plus */
  g.post({ a: 'protegerDossier', jeton, id: prive.getId(), motDePasse: 'nouveau-mdp' });
  assert.equal(g.post({ a: 'fichierProtege', id: img.getId(), cle }).erreur, 'cle');
});

test('protegerDossier sans mot de passe : protection retirée, fichiers de nouveau publics à la lecture', () => {
  const g = installe();
  const jeton = connecte(g);
  const { prive, img } = portfolioProtege(g, jeton);
  assert.equal(g.post({ a: 'protegerDossier', jeton, id: prive.getId(), motDePasse: '' }).ok, true);
  const d = g.get({ a: 'portfolio' }).dossiers.find((x) => x.id === prive.getId());
  assert.equal(d.protege, undefined);
  assert.deepEqual(d.fichiers.map((f) => f.nom), ['devis.pdf', 'maquette.png']);
  assert.deepEqual(img._partage, ['ANYONE_WITH_LINK', 'VIEW']);
});

test('liens d\'un dossier public : visibles dans la liste ; galerie protégée entière', () => {
  const g = installe();
  const jeton = connecte(g);
  const { design } = avecPortfolio(g);
  g.post({ a: 'liensDossier', jeton, id: design.getId(), liens: [{ titre: 'Behance', url: 'https://behance.net/amar' }] });
  assert.deepEqual(g.get({ a: 'portfolio' }).dossiers.find((x) => x.id === design.getId()).liens, [{ titre: 'Behance', url: 'https://behance.net/amar' }]);
  const astro = g.ctx.DriveApp.createFolder('Astronomie');
  astro.createFile('ciel.jpg', 'x', 'image/jpeg');
  contenuAvec(g, jeton, (c) => { c.onglets.perso = [{ id: 'astro', nom: 'Astronomie', type: 'drive', dossierId: astro.getId(), visible: true }]; });
  assert.equal(g.post({ a: 'protegerDossier', jeton, id: astro.getId(), motDePasse: 'etoiles' }).ok, true);
  const gal = g.get({ a: 'galerie', id: astro.getId() });
  assert.equal(gal.protege, true);
  assert.deepEqual(gal.fichiers, []);
  assert.deepEqual(g.post({ a: 'ouvrirDossier', id: astro.getId(), motDePasse: 'etoiles' }).dossier.fichiers.map((f) => f.nom), ['ciel.jpg']);
});

test('portfolio : la liste donne l\'id de la racine (pour y créer un dossier depuis le site)', () => {
  const g = installe();
  assert.equal(g.get({ a: 'portfolio' }).racine, g.props.get('ID_PORTFOLIO'));
});

test('ouvrirDossier avec la clé (sans mot de passe) : rouvre le dossier ; clé périmée par un nouveau mot de passe → cle', () => {
  const g = installe();
  const jeton = connecte(g);
  const { prive } = portfolioProtege(g, jeton);
  const { cle } = g.post({ a: 'ouvrirDossier', id: prive.getId(), motDePasse: 'clients2026' });
  assert.deepEqual(g.post({ a: 'ouvrirDossier', id: prive.getId(), cle }).dossier.fichiers.map((f) => f.nom), ['devis.pdf', 'maquette.png']);
  g.post({ a: 'protegerDossier', jeton, id: prive.getId(), motDePasse: 'autre-mdp' });
  assert.equal(g.post({ a: 'ouvrirDossier', id: prive.getId(), cle }).erreur, 'cle');
});

test('un dossier qui contient le site (Mon Drive, dossier parent) ne peut devenir racine ; le site n\'y est jamais listé, renommé ni supprimé', () => {
  const g = installe();
  const jeton = connecte(g);
  const site = g.dossiers.get(g.props.get('ID_SITE'));
  const parent = g.ctx.DriveApp.createFolder('Mes projets');
  site._parent = parent;
  for (const d of [parent, g.ctx.DriveApp.getRootFolder()]) {
    const lien = `https://drive.google.com/drive/folders/${d.getId()}`;
    assert.equal(g.post({ a: 'dossierPortfolio', jeton, lienDossier: lien }).erreur, 'entree');
    assert.equal(g.post({ a: 'dossierGalerie', jeton, lienDossier: lien }).erreur, 'entree');
  }
  /* racine déjà enregistrée avant cette règle : le site reste invisible et intouchable */
  g.props.set('ID_PORTFOLIO', parent.getId());
  parent.createFolder('1 - Design');
  const p = g.get({ a: 'portfolio', frais: '1' });
  assert.deepEqual(p.dossiers.map((d) => d.nom), ['1 - Design']);
  assert.equal(g.post({ a: 'supprimerDossier', jeton, id: site.getId() }).erreur, 'entree');
  assert.equal(g.post({ a: 'renommerDossier', jeton, id: site.getId(), nom: 'X' }).erreur, 'entree');
  assert.equal(site.isTrashed(), false);
  const autre = site.createFile('notes.txt', 'x', 'text/plain');
  assert.equal(g.post({ a: 'supprimerFichier', jeton, id: autre.getId() }).erreur, 'entree');
});
