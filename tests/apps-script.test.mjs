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

test('envoyerMedia ne supprime rien ; enregistrer met à la corbeille les médias non référencés', () => {
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
  assert.equal(g.fichiers.get(a.id).isTrashed(), true);
  assert.equal(g.fichiers.get(orphelin.id).isTrashed(), true);
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
  assert.deepEqual(racine._partage, ['ANYONE_WITH_LINK', 'VIEW']);
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

test('installer : le dossier Portfolio par défaut est partagé en lecture publique', () => {
  const g = installe();
  const racine = [...g.dossiers.values()].find((d) => d.getName() === 'Portfolio');
  assert.deepEqual(racine._partage, ['ANYONE_WITH_LINK', 'VIEW']);
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

test('enregistrer garde l\'image d\'un intérêt et met à la corbeille l\'image retirée', () => {
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
  assert.equal(g.fichiers.get(b.id).isTrashed(), true);
});

test('enregistrer garde l\'image choisie d\'un lien et met à la corbeille celle qu\'on retire', () => {
  const g = installe();
  const jeton = connecte(g);
  const a = g.post({ a: 'envoyerMedia', jeton, emplacement: 'image', nom: 'a.jpg', type: 'image/jpeg', base64: PNG });
  const c = JSON.parse(DEFAUT);
  c.liens.items[0].media = { id: a.id, url: a.url };
  assert.equal(g.post({ a: 'enregistrer', jeton, versionDeBase: 1, contenu: c }).version, 2);
  assert.equal(g.fichiers.get(a.id).isTrashed(), false);
  c.liens.items[0].media = null;
  assert.equal(g.post({ a: 'enregistrer', jeton, versionDeBase: 2, contenu: c }).version, 3);
  assert.equal(g.fichiers.get(a.id).isTrashed(), true);
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
  assert.equal(g.fichiers.get(a.id).isTrashed(), true);
});
