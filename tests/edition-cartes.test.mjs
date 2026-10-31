/* Édition sur le site : cartes (✎ 🗑 ↑ ↓), « + Ajouter », liens et catégories, contact, titres de rangée. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const jeton = () => JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); Object.assign(env.faux.etat, { contenu: c, version: c.version, apercus: {} }); };
const brouillon = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('ab-brouillon')).contenu);
const outil = (pour, action) => `.outils-edition[data-pour="${pour}"] button[aria-label^="${action}"]`;

async function editer(chemin = '/') {
  const p = await env.page({ chemin, stockage: { 'ab-jeton': jeton() } });
  await p.click('#modifier');
  await p.waitForSelector('body.edition .barre-edition');
  return p;
}
async function valider(p) {
  await p.click('#ficheCorps form.edition-form button[type="submit"]');
}

test('✎ certification : feuille avec ses champs → brouillon et carte mis à jour', async () => {
  reinit();
  const p = await editer('/#parcours');
  await p.click(outil('parcours.certifications#k1', 'Modifier'));
  await p.waitForSelector('#ficheCorps form.edition-form');
  assert.equal(await p.inputValue('#ficheCorps [name="titre"]'), 'Gestion de projet');
  await p.fill('#ficheCorps [name="organisme"]', 'Google');
  await p.fill('#ficheCorps [name="url"]', 'https://coursera.org/verify/ABC');
  await valider(p);
  await p.waitForSelector('#fiche', { state: 'hidden' });
  const c = await brouillon(p);
  assert.deepEqual([c.parcours.certifications[0].organisme, c.parcours.certifications[0].url], ['Google', 'https://coursera.org/verify/ABC']);
  assert.match(await p.innerText('[data-element="parcours.certifications#k1"]'), /Google/);
  assert.equal(await p.innerText('.barre-edition .compte'), '1 modification');
});

test('+ Ajouter une formation : fin avant début → erreur sur le champ, Publier bloqué ; corrigée → ajoutée', async () => {
  reinit();
  const p = await editer('/#parcours');
  await p.click('button.ajout[data-liste="parcours.formation"]');
  await p.waitForSelector('#ficheCorps form.edition-form');
  await p.fill('#ficheCorps [name="titre"]', 'Master 2 Qualité');
  await p.fill('#ficheCorps [name="debut"]', '2026-09');
  await p.fill('#ficheCorps [name="fin"]', '2025');
  await valider(p);
  await p.waitForSelector('#ficheCorps [data-erreur="fin"]:has-text("La fin doit être après le début")');
  await p.keyboard.press('Escape');
  await p.waitForSelector('#fiche', { state: 'hidden' });
  await p.click('.barre-edition button:has-text("Publier")');
  await p.waitForSelector('.barre-edition [role="status"]:has-text("à corriger")');
  await p.click('button[aria-label="Modifier : Master 2 Qualité"]');
  await p.fill('#ficheCorps [name="fin"]', '2027-06');
  await valider(p);
  await p.waitForSelector('#fiche', { state: 'hidden' });
  const c = await brouillon(p);
  assert.ok(c.parcours.formation.some((x) => x.titre === 'Master 2 Qualité' && x.fin === '2027-06'));
});

test('🗑 supprime avec « Rétablir » ; ↑ ↓ déplacent', async () => {
  reinit();
  const p = await editer('/#parcours');
  p.on('dialog', (d) => d.accept());
  await p.click(outil('parcours.langues#l5', 'Supprimer'));
  await p.waitForFunction(() => !document.querySelector('[data-element="parcours.langues#l5"]'));
  assert.ok(!(await brouillon(p)).parcours.langues.some((x) => x.id === 'l5'));
  await p.click('.barre-edition button:has-text("Rétablir")');
  await p.waitForSelector('[data-element="parcours.langues#l5"]');
  assert.deepEqual((await brouillon(p)).parcours.langues.map((x) => x.id), DEFAUT().parcours.langues.map((x) => x.id));
  await p.click(outil('parcours.interets#i2', 'Avancer'));
  assert.deepEqual((await brouillon(p)).parcours.interets.map((x) => x.titre), ['Cartomagie', 'Astronomie', 'Design']);
  await p.click(outil('parcours.interets#i2', 'Reculer'));
  assert.deepEqual((await brouillon(p)).parcours.interets.map((x) => x.titre), ['Astronomie', 'Cartomagie', 'Design']);
  assert.equal(await p.locator(outil('parcours.formation#f1', 'Avancer')).count(), 0, 'listes triées par date : pas de déplacement');
});

test('lien : coller l\'adresse → aperçu automatique, catégorie choisie, ajouté', async () => {
  reinit();
  env.faux.etat.apercus['https://play.google.com/store/apps/details?id=x'] = { titre: 'Mon appli', description: 'Une appli Android.', image: '' };
  const p = await editer('/#liens');
  await p.click('button.ajout[data-liste="liens.items"]');
  await p.fill('#ficheCorps [name="url"]', 'https://play.google.com/store/apps/details?id=x');
  await p.locator('#ficheCorps [name="url"]').evaluate((x) => x.dispatchEvent(new Event('change', { bubbles: true })));
  await p.waitForFunction(() => document.querySelector('#ficheCorps [name="titre"]').value === 'Mon appli');
  assert.equal(await p.inputValue('#ficheCorps [name="description"]'), 'Une appli Android.');
  await p.selectOption('#ficheCorps [name="categorie"]', 'android');
  await valider(p);
  await p.waitForSelector('#fiche', { state: 'hidden' });
  const lien = (await brouillon(p)).liens.items.find((x) => x.titre === 'Mon appli');
  assert.equal(lien.categorie, 'android');
  assert.match(lien.date, /^\d{4}-\d{2}-\d{2}$/);
  await p.waitForSelector('#vue .liste-categories a:has-text("Applis Android")');
});

test('catégories : créer, renommer ; supprimer une catégorie non vide est refusé', async () => {
  reinit();
  const p = await editer('/#liens');
  await p.click('button.ajout[data-liste="liens.categories"]');
  await p.fill('#ficheCorps [name="nom"]', 'Vidéos');
  await valider(p);
  await p.waitForSelector('#fiche', { state: 'hidden' });
  const cats = (await brouillon(p)).liens.categories;
  assert.equal(cats.at(-1).nom, 'Vidéos');
  /* la catégorie encore vide s'affiche en mode Modifier */
  await p.waitForSelector('#vue .liste-categories a:has-text("Vidéos")');
  await p.click(outil('liens.categories#projets', 'Modifier'));
  await p.fill('#ficheCorps [name="nom"]', 'Mes projets');
  await valider(p);
  await p.waitForSelector('#vue .liste-categories a:has-text("Mes projets")');
  p.on('dialog', (d) => d.accept());
  await p.click(outil('liens.categories#projets', 'Supprimer'));
  await p.waitForSelector('.barre-edition [role="status"]:has-text("contient encore des liens")');
  assert.ok((await brouillon(p)).liens.categories.some((x) => x.id === 'projets'));
});

test('contact : coordonnées et « Ouvert à » modifiables dans la fiche', async () => {
  reinit();
  const p = await editer('/');
  await p.evaluate(() => { location.hash = '#contact'; });
  await p.waitForSelector('#fiche', { state: 'visible' });
  await p.click(outil('contact', 'Modifier'));
  await p.waitForSelector('#ficheCorps form.edition-form');
  await p.fill('#ficheCorps [name="email"]', 'amar@exemple.fr');
  await valider(p);
  await p.waitForSelector('#ficheCorps .ct:has-text("amar@exemple.fr")');
  await p.click('#ficheCorps button.ajout[data-liste="contact.ouvertA"]');
  await p.fill('#ficheCorps [name="titre"]', 'Photographie');
  await valider(p);
  await p.waitForSelector('#ficheCorps .ct:has-text("Photographie")');
  const c = await brouillon(p);
  assert.equal(c.contact.email, 'amar@exemple.fr');
  assert.equal(c.contact.ouvertA.at(-1).titre, 'Photographie');
});

test('contact : un bouton écrit « Modifier l\'e-mail et le lien LinkedIn », au-dessus des lignes, change LinkedIn', async () => {
  reinit();
  const p = await editer('/');
  await p.click('#contactBtn');
  const b = p.locator('#ficheCorps button:has-text("Modifier l\'e-mail et le lien LinkedIn")');
  await b.waitFor();
  const [hb, he] = await Promise.all([b.boundingBox(), p.locator('#ficheCorps li.row:has-text("E-mail")').boundingBox()]);
  assert.ok(hb.y + hb.height <= he.y + 1, 'le bouton ne couvre pas la ligne E-mail');
  await b.click();
  await p.fill('#ficheCorps [name="linkedin"]', 'https://www.linkedin.com/in/amar-nouveau');
  await valider(p);
  await p.waitForSelector('#ficheCorps a[href="https://www.linkedin.com/in/amar-nouveau"]');
  assert.equal((await brouillon(p)).contact.linkedin, 'https://www.linkedin.com/in/amar-nouveau');
});

test('coller : texte brut seulement ; lien dangereux refusé sur le champ', async () => {
  reinit();
  const p = await editer('/');
  await p.click('#vue h1.salut');
  await p.keyboard.press('Control+A');
  await p.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/html', '<b onclick="alert(1)">Gras</b> <img src=x onerror="window.pwn=1">');
    dt.setData('text/plain', 'Gras');
    document.querySelector('#vue h1.salut').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await p.locator('#vue h1.salut').evaluate((x) => x.blur());
  assert.equal(await p.locator('#vue h1.salut b, #vue h1.salut img').count(), 0);
  assert.equal(await p.evaluate(() => window.pwn), undefined);
  await p.evaluate(() => { location.hash = '#parcours'; });
  await p.click(outil('parcours.certifications#k1', 'Modifier'));
  await p.fill('#ficheCorps [name="url"]', 'javascript:alert(1)');
  await valider(p);
  await p.waitForSelector('#ficheCorps [data-erreur="url"]:has-text("Adresse web invalide")');
});

test('titres : rubrique de Parcours renommée sur place', async () => {
  reinit();
  const p = await editer('/#parcours');
  const h2 = '#vue .rangee-frise:has(h2:text-is("Formation")) h2';
  assert.equal(await p.getAttribute(h2, 'contenteditable'), 'plaintext-only');
  await p.click(h2);
  await p.keyboard.press('Control+A');
  await p.keyboard.type('Études');
  await p.keyboard.press('Enter');
  assert.equal((await brouillon(p)).onglets.parcours.sous.formation.titre, 'Études');
});

test('mode visiteur : « Mode visiteur » oublie la connexion, plus de bouton Modifier', async () => {
  reinit();
  const p = await env.page({ stockage: { 'ab-jeton': jeton() } });
  await p.click('#visiteur');
  assert.equal(await p.isVisible('#modifier'), false);
  assert.equal(await p.isVisible('#visiteur'), false);
  assert.equal(await p.evaluate(() => localStorage.getItem('ab-jeton')), null);
});
