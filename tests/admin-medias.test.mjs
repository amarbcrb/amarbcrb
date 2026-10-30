import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const jeton = JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });

let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = () => {
  const c = DEFAUT();
  Object.assign(env.faux.etat, { contenu: c, version: c.version, medias: {}, apercus: {}, envoyes: [], corbeille: [] });
  env.faux.etat.portfolio.dossiers = [{ id: 'dd', nom: '1 - Design', fichiers: [] }, { id: 'dp', nom: '2 - Posters', fichiers: [] }];
  env.faux.etat.appels.frais = 0;
};
const champ = (chemin) => `[data-chemin="${chemin}"]`;
async function ecran(id) {
  const p = await env.page({ chemin: '/admin/', stockage: { 'ab-jeton': jeton } });
  await p.click(`.ecrans [data-ecran="${id}"]`);
  return p;
}
async function enregistrer(p) {
  await p.click('#enregistrer');
  await p.waitForSelector('#etat:has-text("Enregistré")');
}
/* image PNG générée dans la page, renvoyée en Buffer */
async function image(p, l, h) {
  const b64 = await p.evaluate(([l, h]) => { const c = document.createElement('canvas'); c.width = l; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#3a7'; x.fillRect(0, 0, l, h); return c.toDataURL('image/png').split(',')[1]; }, [l, h]);
  return Buffer.from(b64, 'base64');
}
const tailleDistante = (p, url) => p.evaluate((u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = () => ok(null); i.src = u; }), url);

test('coller une URL → titre/description/image préremplis, modifiables, Ajouter → carte sur le site', async () => {
  reinit();
  env.faux.etat.apercus['https://play.google.com/store/apps/details?id=x'] = { titre: 'Mon appli', description: 'Une appli Android.', image: 'https://exemple.fr/a.png' };
  const p = await ecran('liens');
  await p.fill('#ajoutUrl', 'https://play.google.com/store/apps/details?id=x');
  await p.selectOption('#ajoutCat', 'android');
  await p.click('#ajoutApercu');
  await p.waitForFunction(() => document.getElementById('ajoutTitre').value === 'Mon appli');
  assert.equal(await p.inputValue('#ajoutDesc'), 'Une appli Android.');
  assert.equal(await p.inputValue('#ajoutImage'), 'https://exemple.fr/a.png');
  await p.fill('#ajoutTitre', 'Mon appli (bêta)');
  await p.click('#ajoutValider');
  await enregistrer(p);
  const site = await env.page({ chemin: '/#liens/android' });
  await site.waitForSelector('#vue a.carte');
  assert.match(await site.innerText('#vue a.carte'), /Mon appli \(bêta\)[\s\S]*Une appli Android\./);
});

test('apercuLien en échec → champs vides à remplir, ajout possible', async () => {
  reinit();
  env.faux.etat.apercus['https://panne.fr/'] = 'panne';
  const p = await ecran('liens');
  await p.fill('#ajoutUrl', 'https://panne.fr/');
  await p.click('#ajoutApercu');
  await p.waitForSelector('#ajoutMessage:has-text("Aperçu indisponible")');
  assert.equal(await p.inputValue('#ajoutTitre'), '');
  await p.fill('#ajoutTitre', 'Article manuel');
  await p.click('#ajoutValider');
  await enregistrer(p);
  assert.ok(env.faux.etat.contenu.liens.items.some((x) => x.titre === 'Article manuel' && x.url === 'https://panne.fr/' && x.categorie === 'projets'));
});

test('ajouter sans titre ou URL invalide → refusé', async () => {
  reinit();
  const p = await ecran('liens');
  await p.fill('#ajoutUrl', 'pas une url');
  await p.click('#ajoutValider');
  await p.waitForSelector('#ajoutMessage:has-text("Adresse web invalide")');
  assert.equal(env.faux.etat.contenu.liens.items.length, 9);
});

test('catégorie : ajouter, renommer ; supprimer refusé si non vide', async () => {
  reinit();
  const p = await ecran('liens');
  const bloc = '[data-bloc="categories"]';
  await p.click(`${bloc} .ajouter`);
  await p.fill(champ('liens.categories.3.nom'), 'Vidéos');
  await p.click(`${bloc} li >> nth=0 >> .modifier`);
  await p.fill(champ('liens.categories.0.nom'), 'Mes projets');
  p.once('dialog', (d) => { assert.match(d.message(), /contient encore/); d.accept(); });
  await p.click(`${bloc} li >> nth=0 >> .supprimer`);
  assert.equal(await p.locator(`${bloc} li`).count(), 4);
  p.once('dialog', (d) => d.accept());
  await p.click(`${bloc} li >> nth=2 >> .supprimer`);
  assert.equal(await p.locator(`${bloc} li`).count(), 3);
  await enregistrer(p);
  assert.deepEqual(env.faux.etat.contenu.liens.categories.map((x) => x.nom), ['Mes projets', 'Applis Android', 'Vidéos']);
});

test('coller le lien du dossier Drive → sous-dossiers listés ; masquer l\'un → absent du site', async () => {
  reinit();
  const p = await ecran('portfolio');
  await p.fill('#dossierLien', 'https://drive.google.com/drive/folders/racine');
  await p.click('#dossierValider');
  await p.waitForSelector(champ('portfolio.dossiers.dp.visible'));
  assert.match(await p.innerText('#ecran'), /Design[\s\S]*Posters/);
  await p.uncheck(champ('portfolio.dossiers.dp.visible'));
  await p.fill(champ('portfolio.dossiers.dd.nom'), 'Illustrations');
  await enregistrer(p);
  assert.equal(env.faux.etat.contenu.portfolio.dossierRacineId, 'racine');
  const site = await env.page({ chemin: '/#portfolio' });
  await site.waitForSelector('#vue .rangee');
  assert.deepEqual(await site.$$eval('#vue .rangee .rangee-tete h2', (xs) => xs.map((x) => x.textContent)), ['Illustrations']);
});

test('Relire Drive → lirePortfolio({ frais: true }), le faux script reçoit frais=1', async () => {
  reinit();
  const p = await ecran('portfolio');
  await p.waitForSelector(champ('portfolio.dossiers.dd.visible'));
  await p.click('#relireDrive');
  await p.waitForSelector('#portfolioMessage:has-text("Drive relu")');
  assert.equal(env.faux.etat.appels.frais, 1);
});

test('logo PNG 4000×3000 → envoyé en PNG 2000×1500 (transparence gardée), logo du site public mis à jour', async () => {
  reinit();
  const p = await ecran('medias');
  await p.setInputFiles('[data-media="logo"]', { name: 'logo.png', mimeType: 'image/png', buffer: await image(p, 4000, 3000) });
  await p.waitForSelector('[data-apercu="logo"][src*="/media/"]');
  const m = env.faux.etat.medias.logo;
  assert.equal(m.type, 'image/png');
  const url = await p.getAttribute('[data-apercu="logo"]', 'src');
  assert.deepEqual(await tailleDistante(p, url), [2000, 1500]);
  await enregistrer(p);
  const site = await env.page();
  assert.equal(await site.getAttribute('.brand img', 'src'), url);
});

test('remplacer une photo publiée : l\'ancienne part à la corbeille seulement à l\'enregistrement suivant', async () => {
  reinit();
  const p = await ecran('medias');
  await p.setInputFiles('[data-media="photo"]', { name: 'a.png', mimeType: 'image/png', buffer: await image(p, 800, 800) });
  await p.waitForSelector('[data-apercu="photo"][src*="/media/"]');
  const premier = env.faux.etat.medias.photo.id;
  await enregistrer(p);
  assert.deepEqual(env.faux.etat.corbeille, []);
  await p.setInputFiles('[data-media="photo"]', { name: 'b.png', mimeType: 'image/png', buffer: await image(p, 800, 800) });
  await p.waitForFunction((id) => !document.querySelector('[data-apercu="photo"]').src.endsWith(id), premier);
  assert.deepEqual(env.faux.etat.corbeille, []);
  await enregistrer(p);
  assert.deepEqual(env.faux.etat.corbeille, [premier]);
});

test('favicon → PNG 512 px', async () => {
  reinit();
  const p = await ecran('medias');
  await p.setInputFiles('[data-media="favicon"]', { name: 'f.png', mimeType: 'image/png', buffer: await image(p, 1000, 1000) });
  await p.waitForSelector('[data-apercu="favicon"][src*="/media/"]');
  assert.equal(env.faux.etat.medias.favicon.type, 'image/png');
  assert.deepEqual(await tailleDistante(p, await p.getAttribute('[data-apercu="favicon"]', 'src')), [512, 512]);
});

test('CV de 11 Mo → refusé avant envoi', async () => {
  reinit();
  const p = await ecran('medias');
  await p.setInputFiles('[data-media="cv"]', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(11 * 1024 * 1024) });
  await p.waitForSelector('[data-message="cv"]:has-text("moins de 10 Mo")');
  assert.equal(env.faux.etat.medias.cv, undefined);
});

test('CV accepté → bouton Télécharger mon CV sur l\'accueil', async () => {
  reinit();
  const p = await ecran('medias');
  await p.setInputFiles('[data-media="cv"]', { name: 'CV-Amar.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  await p.waitForSelector('[data-message="cv"]:has-text("envoyé")');
  await enregistrer(p);
  const site = await env.page();
  assert.match(await site.getAttribute('#vue a:has-text("Télécharger mon CV")', 'href'), /uc\?export=download&id=media/);
  assert.deepEqual(p.erreurs, []);
});

test('photo PNG → envoyée en JPEG', async () => {
  reinit();
  const p = await ecran('medias');
  await p.setInputFiles('[data-media="photo"]', { name: 'p.png', mimeType: 'image/png', buffer: await image(p, 600, 600) });
  await p.waitForSelector('[data-apercu="photo"][src*="/media/"]');
  assert.equal(env.faux.etat.medias.photo.type, 'image/jpeg');
});

test('lien : texte du bouton → affiché sur la carte', async () => {
  reinit();
  const p = await ecran('liens');
  await p.click('[data-bloc="liens"] li >> nth=0 >> .modifier');
  await p.fill(champ('liens.items.0.bouton'), 'Visiter');
  await enregistrer(p);
  const site = await env.page({ chemin: '/#liens' });
  assert.equal(await site.innerText('#vue a.carte-lien >> nth=0 >> .btn'), 'Visiter');
});

test('ajout d\'un lien : type choisi et image envoyée → carte avec mon image et le badge du type', async () => {
  reinit();
  const p = await ecran('liens');
  await p.fill('#ajoutUrl', 'https://exemple.fr/ma-video');
  await p.selectOption('#ajoutCat', 'projets');
  await p.fill('#ajoutTitre', 'Ma vidéo');
  /* l'aperçu lancé en quittant l'adresse ne doit pas effacer le titre saisi entre-temps */
  await p.waitForSelector('#ajoutMessage:has-text("Aperçu")');
  assert.equal(await p.inputValue('#ajoutTitre'), 'Ma vidéo');
  assert.deepEqual(await p.$$eval('#ajoutType option', (xs) => xs.map((x) => x.value)), ['', 'web', 'video', 'image', 'appli', 'document', 'code', 'article']);
  await p.selectOption('#ajoutType', 'video');
  await p.setInputFiles('#ajoutFichier', { name: 'vignette.png', mimeType: 'image/png', buffer: await image(p, 2000, 1200) });
  await p.waitForSelector('#ajoutApercuImage[src*="/media/"]');
  await p.click('#ajoutValider');
  await enregistrer(p);
  const lien = env.faux.etat.contenu.liens.items.find((x) => x.titre === 'Ma vidéo');
  assert.equal(lien.type, 'video');
  assert.match(lien.media.url, /\/media\//);
  assert.equal(env.faux.etat.medias.image.type, 'image/jpeg');
  const site = await env.page({ chemin: '/#liens/projets' });
  const carte = site.locator('#vue a.carte-lien[href="https://exemple.fr/ma-video"]');
  assert.equal(await carte.getAttribute('data-type'), 'video');
  assert.equal(await carte.locator('img').getAttribute('src'), lien.media.url);
  assert.deepEqual(await tailleDistante(site, lien.media.url), [1600, 960]);
});

test('lien existant : changer le type, choisir puis retirer mon image (gardée dans la médiathèque)', async () => {
  reinit();
  const p = await ecran('liens');
  await p.click('[data-bloc="liens"] li >> nth=0 >> .modifier');
  await p.selectOption(champ('liens.items.0.type'), 'code');
  await p.setInputFiles('[data-media="image-liens.items.0.media"]', { name: 'a.png', mimeType: 'image/png', buffer: await image(p, 800, 600) });
  await p.waitForSelector('[data-apercu="image-liens.items.0.media"][src*="/media/"]');
  await enregistrer(p);
  const media = env.faux.etat.contenu.liens.items[0].media;
  assert.equal(env.faux.etat.contenu.liens.items[0].type, 'code');
  assert.ok(media && media.id);
  assert.ok(!env.faux.etat.corbeille.includes(media.id));
  await p.click('[data-bloc="liens"] button:has-text("Retirer l\'image")');
  await enregistrer(p);
  assert.equal(env.faux.etat.contenu.liens.items[0].media, null);
  assert.ok(!env.faux.etat.corbeille.includes(media.id));
  assert.deepEqual(p.erreurs, []);
});

test('écran Accueil : repère ajouté, domaine avec image envoyée, projet phare choisi → visibles sur le site', async () => {
  reinit();
  const p = await ecran('accueil');
  await p.click('[data-bloc="reperes"] .ajouter');
  await p.fill(champ('accueil.reperes.3.valeur'), '18');
  await p.fill(champ('accueil.reperes.3.libelle'), 'certificats Coursera');
  await p.click('[data-bloc="domaines"] li >> nth=1 >> .modifier');
  await p.fill(champ('accueil.domaines.1.texte'), 'Affiches et identités visuelles.');
  await p.fill(champ('accueil.domaines.1.lien'), '#portfolio');
  await p.setInputFiles('[data-media="image-accueil.domaines.1"]', { name: 'design.png', mimeType: 'image/png', buffer: await image(p, 1200, 900) });
  await p.waitForSelector('[data-apercu="image-accueil.domaines.1"][src*="/media/"]');
  assert.deepEqual(await p.$$eval(`${champ('accueil.projetPhare')} option`, (xs) => xs.slice(0, 3).map((x) => [x.value, x.textContent])), [['', 'Aucun'], ['u1', 'BioStudy'], ['u2', 'BioCampus']]);
  await p.selectOption(champ('accueil.projetPhare'), 'u2');
  await enregistrer(p);
  const a = env.faux.etat.contenu.accueil;
  assert.equal(a.reperes[3].valeur, '18');
  assert.match(a.domaines[1].image.url, /\/media\//);
  assert.equal(a.projetPhare, 'u2');
  assert.ok(!env.faux.etat.corbeille.includes(a.domaines[1].image.id));
  const site = await env.page();
  assert.match(await site.innerText('#vue .reperes li >> nth=3'), /18\s+certificats Coursera/);
  assert.equal(await site.getAttribute('#vue .carte-domaine >> nth=1 >> img', 'src'), a.domaines[1].image.url);
  assert.match(await site.innerText('#vue .carte-domaine >> nth=1'), /Affiches et identités visuelles\./);
  assert.equal(await site.getAttribute('#vue .carrousel .diapo >> nth=1 >> a.btn', 'href'), '#portfolio');
  assert.equal(await site.getAttribute('#vue .carrousel .diapo >> nth=-1 >> a.btn', 'href'), 'https://www.biostudy.xyz/BioCampus/');
  assert.deepEqual(p.erreurs, []);
});
