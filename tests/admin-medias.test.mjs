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

test('coller le lien du dossier Drive → sous-dossiers listés ; masquer l\'un → absent du site', async () => {
  reinit();
  const p = await ecran('visibilite');
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
  const p = await ecran('visibilite');
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

