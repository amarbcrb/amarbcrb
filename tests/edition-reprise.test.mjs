/* Couverture reprise des anciens écrans de contenu de l'admin, désormais édités sur le site. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const jeton = () => JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = () => { const c = DEFAUT(); Object.assign(env.faux.etat, { contenu: c, version: c.version, apercus: {}, medias: {}, envoyes: [], fichiersMedias: [] }); };
const outil = (pour, action) => `.outils-edition[data-pour="${pour}"] button[aria-label^="${action}"]`;
async function editer(chemin = '/') {
  const p = await env.page({ chemin, stockage: { 'ab-jeton': jeton() } });
  await p.click('#modifier');
  await p.waitForSelector('body.edition .barre-edition');
  return p;
}
const valider = (p) => p.click('#ficheCorps form.edition-form button[type="submit"]');
const fermee = (p) => p.waitForSelector('#fiche', { state: 'hidden' });
async function publier(p) {
  await p.click('.barre-edition button:has-text("Publier")');
  await p.waitForSelector('.barre-edition [role="status"]:has-text("Publié")');
}

test('expérience « En cours » : fin vidée et désactivée, période « … – aujourd\'hui » une fois publiée', async () => {
  reinit();
  const p = await editer('/#parcours/experience');
  await p.click(outil('parcours.experience#e1', 'Modifier'));
  await p.check('#ficheCorps [name="enCours"]');
  assert.equal(await p.isDisabled('#ficheCorps [name="fin"]'), true);
  assert.equal(await p.inputValue('#ficheCorps [name="fin"]'), '');
  await valider(p);
  await fermee(p);
  await publier(p);
  assert.equal(env.faux.etat.contenu.parcours.experience.find((x) => x.id === 'e1').fin, null);
  const v = await env.page({ chemin: '/#parcours/experience' });
  assert.match(await v.innerText('#vue .etape:has(.en-cours) >> nth=0'), /aujourd'hui/);
});

test('langue : drapeau choisi dans la feuille → affiché', async () => {
  reinit();
  const p = await editer('/#parcours/langues');
  await p.click(outil('parcours.langues#l4', 'Modifier'));
  await p.selectOption('#ficheCorps [name="drapeau"]', 'us');
  await valider(p);
  await fermee(p);
  assert.equal(await p.getAttribute('#vue .carte-langue[data-element="parcours.langues#l4"] .drapeau', 'data-drapeau'), 'us');
});

test('profil : titre et texte (deux paragraphes) modifiés sur place', async () => {
  reinit();
  const p = await editer('/#parcours');
  await p.click('#vue .profil h2');
  await p.keyboard.press('Control+A');
  await p.keyboard.type('Mon profil');
  await p.keyboard.press('Enter');
  await p.click('#vue .profil-texte');
  await p.keyboard.press('Control+A');
  await p.keyboard.type('Premier paragraphe.');
  await p.keyboard.press('Enter');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Second paragraphe.');
  await p.locator('#vue .profil-texte').evaluate((x) => x.blur());
  await publier(p);
  assert.equal(env.faux.etat.contenu.parcours.profil.titre, 'Mon profil');
  assert.equal(env.faux.etat.contenu.parcours.profil.texte, 'Premier paragraphe.\n\nSecond paragraphe.');
  const v = await env.page({ chemin: '/#parcours' });
  assert.equal(await v.locator('#vue .profil p').count(), 2);
});

test('intérêt : image envoyée depuis la feuille → carte avec l\'image ; puis lien d\'une vidéo collé', async () => {
  reinit();
  const p = await editer('/#parcours');
  await p.click(outil('parcours.interets#i1', 'Modifier'));
  const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; c.getContext('2d').fillRect(0, 0, 400, 300); return c.toDataURL('image/png').split(',')[1]; });
  await p.setInputFiles('#ficheCorps .champ-media input[type="file"]', { name: 'astro.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await p.waitForSelector('#ficheCorps .champ-media img[src*="/media/"]');
  await valider(p);
  await fermee(p);
  assert.match(await p.getAttribute('#vue [data-element="parcours.interets#i1"] .visuel img', 'src'), /\/media\//);
  await p.click(outil('parcours.interets#i2', 'Modifier'));
  await p.click('#ficheCorps .champ-media button:has-text("Coller un lien")');
  await p.fill('#ficheCorps .lien-media input', 'https://exemple.fr/tour.mp4');
  await p.click('#ficheCorps .lien-media button:has-text("Utiliser")');
  await valider(p);
  await fermee(p);
  const c = await p.evaluate(() => JSON.parse(localStorage.getItem('ab-brouillon')).contenu);
  assert.deepEqual(c.parcours.interets[1].image, { url: 'https://exemple.fr/tour.mp4', type: 'video' });
});

test('lien : aperçu en échec → champs à remplir ; adresse invalide refusée ; type et texte du bouton gardés', async () => {
  reinit();
  env.faux.etat.apercus['https://panne.fr/'] = 'panne';
  const p = await editer('/#liens');
  await p.click('button.ajout[data-liste="liens.items"]');
  await p.fill('#ficheCorps [name="url"]', 'https://panne.fr/');
  await p.locator('#ficheCorps [name="url"]').evaluate((x) => x.dispatchEvent(new Event('change', { bubbles: true })));
  await p.waitForSelector('#ficheCorps [role="status"]:has-text("Aperçu indisponible")');
  await p.fill('#ficheCorps [name="url"]', 'pas une adresse');
  await p.fill('#ficheCorps [name="titre"]', 'Panne');
  await valider(p);
  await p.waitForSelector('#ficheCorps [data-erreur="url"]:has-text("Adresse web invalide")');
  await p.fill('#ficheCorps [name="url"]', 'https://panne.fr/');
  await p.selectOption('#ficheCorps [name="type"]', 'article');
  await p.fill('#ficheCorps [name="bouton"]', 'Lire');
  await valider(p);
  await fermee(p);
  const lien = (await p.evaluate(() => JSON.parse(localStorage.getItem('ab-brouillon')).contenu)).liens.items.find((x) => x.titre === 'Panne');
  assert.deepEqual([lien.type, lien.bouton], ['article', 'Lire']);
});

test('Accueil : repère ajouté et domaine modifié (lien « Découvrir ») → visibles après publication', async () => {
  reinit();
  const p = await editer('/');
  await p.click('button.ajout[data-liste="accueil.reperes"]');
  await p.fill('#ficheCorps [name="valeur"]', '18');
  await p.fill('#ficheCorps [name="libelle"]', 'certificats Coursera');
  await valider(p);
  await fermee(p);
  await p.click(outil('accueil.domaines#d2', 'Modifier'));
  await p.fill('#ficheCorps [name="lien"]', '#portfolio');
  await valider(p);
  await fermee(p);
  await publier(p);
  const v = await env.page();
  assert.match(await v.innerText('#vue .reperes li >> nth=3'), /18\s+certificats Coursera/);
  assert.equal(await v.getAttribute('#vue .carrousel .diapo >> nth=1 >> a.btn', 'href'), '#portfolio');
});

test('feuille d\'un élément existant : refusée puis Annuler (ou Échap) → anciennes valeurs rétablies, rien à publier', async () => {
  for (const sortie of ['Annuler', 'Escape']) {
    reinit();
    const f1 = DEFAUT().parcours.formation[0];
    const p = await editer('/#parcours');
    await p.click(outil(`parcours.formation#${f1.id}`, 'Modifier'));
    await p.fill('#ficheCorps [name="titre"]', 'CHANGÉ');
    await p.fill('#ficheCorps [name="debut"]', 'pas une date');
    await valider(p);
    await p.waitForSelector('#ficheCorps [data-erreur="debut"]:not(:empty)');
    if (sortie === 'Annuler') await p.click('#ficheCorps .annuler'); else await p.keyboard.press('Escape');
    await fermee(p);
    const brouillon = JSON.parse(await p.evaluate(() => localStorage.getItem('ab-brouillon')) || 'null');
    const x = brouillon ? brouillon.contenu.parcours.formation.find((y) => y.id === f1.id) : f1;
    assert.deepEqual([x.titre, x.debut], [f1.titre, f1.debut], sortie);
    assert.ok(!(await p.innerText('#vue')).includes('CHANGÉ'), sortie);
    await p.close();
  }
});
