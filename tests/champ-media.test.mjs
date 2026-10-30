/* Champ média (assets/champ-media.js) : envoyer, choisir dans la médiathèque, coller un lien. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const jeton = JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => {
  const c = DEFAUT(); if (modif) modif(c);
  Object.assign(env.faux.etat, { contenu: c, version: c.version, medias: {}, envoyes: [], corbeille: [], fichiersMedias: [] });
};

/* page du site avec un champ média monté ; la valeur choisie est gardée dans window.__valeur */
async function champ(valeur = null) {
  const p = await env.page({ stockage: { 'ab-jeton': jeton } });
  await p.evaluate(async (v) => {
    const { champMedia } = await import('/assets/champ-media.js');
    window.__valeur = v;
    /* calque plein écran : le champ n'est pas masqué par la barre du bas ou l'en-tête fixes du site */
    const calque = Object.assign(document.createElement('div'), { style: 'position:fixed;inset:0;z-index:1000;overflow:auto;padding:20px;background:var(--bg)' });
    calque.append(champMedia({ valeur: v, libelle: 'Image', cle: 'image-test', onChange: (x) => { window.__valeur = x; } }));
    document.body.append(calque);
  }, valeur);
  return p;
}
async function envoyer(p, nom) {
  const b64 = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; c.getContext('2d').fillRect(0, 0, 400, 300); return c.toDataURL('image/png').split(',')[1]; });
  await p.evaluate(() => { window.__valeur = null; });
  await p.setInputFiles('[data-media="image-test"]', { name: nom, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await p.waitForFunction(() => window.__valeur && window.__valeur.id);
  return p.evaluate(() => window.__valeur);
}

test('envoyer une image → valeur { id, url, type: image }, aperçu', async () => {
  reinit();
  const p = await champ();
  const v = await envoyer(p, 'a.png');
  assert.match(v.url, /\/media\//);
  assert.equal(v.type, 'image');
  await p.waitForSelector('[data-apercu="image-test"][src*="/media/"]');
});

test('médiathèque : choisir un média déjà envoyé → aucun nouvel envoi, valeur = son id et son url', async () => {
  reinit();
  let p = await champ();
  const premier = await envoyer(p, 'astro.png');
  const envois = env.faux.etat.envoyes.length;
  p = await champ();
  await p.click('button:has-text("Ma médiathèque")');
  await p.waitForSelector('dialog.mediatheque[open] .media-choix');
  assert.match(await p.innerText('dialog.mediatheque'), /astro\.png/);
  await p.click('dialog.mediatheque .media-choix >> nth=0');
  await p.waitForFunction(() => window.__valeur && window.__valeur.id);
  const v = await p.evaluate(() => window.__valeur);
  assert.deepEqual([v.id, v.url], [premier.id, premier.url]);
  assert.equal(env.faux.etat.envoyes.length, envois);
  assert.equal(await p.locator('dialog.mediatheque[open]').count(), 0);
});

test('médiathèque : supprimer un média utilisé → refusé, dit où ; inutilisé → supprimé', async () => {
  reinit();
  let p = await champ();
  const a = await envoyer(p, 'utilise.png');
  const b = await envoyer(p, 'libre.png');
  env.faux.etat.contenu.parcours.interets[0].image = { id: a.id, url: a.url };
  p = await champ();
  await p.click('button:has-text("Ma médiathèque")');
  await p.waitForSelector('dialog.mediatheque[open] .media-choix');
  p.on('dialog', (d) => d.accept());
  await p.click('dialog.mediatheque button[aria-label="Supprimer utilise.png"]');
  await p.waitForSelector('dialog.mediatheque [role="status"]:has-text("Intérêts n°1")');
  assert.ok(!env.faux.etat.corbeille.includes(a.id));
  await p.click('dialog.mediatheque button[aria-label="Supprimer libre.png"]');
  await p.waitForSelector('dialog.mediatheque [role="status"]:has-text("« libre.png » supprimé")');
  assert.equal(await p.locator('dialog.mediatheque button[aria-label="Choisir libre.png"]').count(), 0);
  assert.ok(env.faux.etat.corbeille.includes(b.id));
});

test('coller un lien : .mp4 → vidéo, YouTube → youtube ; javascript: refusé', async () => {
  reinit();
  const p = await champ();
  const coller = async (url) => {
    await p.click('button:has-text("Coller un lien")');
    await p.fill('.lien-media input', url);
    await p.click('.lien-media button:has-text("Utiliser")');
  };
  await coller('https://exemple.fr/demo.mp4');
  assert.deepEqual(await p.evaluate(() => window.__valeur), { url: 'https://exemple.fr/demo.mp4', type: 'video' });
  await coller('https://youtu.be/dQw4w9WgXcQ');
  assert.equal(await p.evaluate(() => window.__valeur.type), 'youtube');
  await coller('javascript:alert(1)');
  assert.equal(await p.evaluate(() => window.__valeur.type), 'youtube');
  assert.match(await p.innerText('.champ-media [role="status"]'), /Adresse invalide/);
});

test('retirer → valeur null', async () => {
  reinit();
  const p = await champ({ url: '/favicon-512x512.png', type: 'image' });
  await p.click('.champ-media button:has-text("Retirer")');
  assert.equal(await p.evaluate(() => window.__valeur), null);
});
