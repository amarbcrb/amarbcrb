/* Édition sur le site : dossiers et fichiers du portfolio (opérations Drive immédiates), liens, protection, masquage. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const jeton = () => JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });
const img = (id, nom) => ({ id, nom, type: 'image/jpeg', apercu: `/favicon-512x512.png?${id}`, lien: `https://drive.google.com/file/d/${id}/view` });
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = () => {
  const c = DEFAUT();
  Object.assign(env.faux.etat, { contenu: c, version: c.version, proteges: {}, liensDossiers: {}, fichiersDrive: {} });
  env.faux.etat.portfolio.dossiers = [{ id: 'dd', nom: '1 - Design', fichiers: [img('d1', 'A.jpg')] }, { id: 'dp', nom: '2 - Posters', fichiers: [img('p1', 'B.jpg')] }];
};
async function editer() {
  const p = await env.page({ chemin: '/#portfolio', stockage: { 'ab-jeton': jeton() } });
  await p.waitForSelector('#vue .rangee');
  await p.click('#modifier');
  await p.waitForSelector('body.edition .barre-edition');
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? p.__reponse : undefined));
  return p;
}
const rangee = (id) => `#vue .rangee[data-dossier="${id}"]`;
const outil = (id, action) => `${rangee(id)} .outils-dossier button[aria-label^="${action}"]`;

test('+ Ajouter un fichier → envoyé dans le dossier Drive, visible tout de suite', async () => {
  reinit();
  const p = await editer();
  const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 20; c.height = 20; return c.toDataURL('image/png').split(',')[1]; });
  await p.setInputFiles(`${rangee('dd')} input[type="file"]`, { name: 'affiche.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await p.waitForSelector(`${rangee('dd')} .vignette img[alt="affiche"]`);
  assert.ok(env.faux.etat.portfolio.dossiers[0].fichiers.some((f) => f.nom === 'affiche.png'));
});

test('+ Nouveau dossier, renommer, supprimer un fichier puis un dossier', async () => {
  reinit();
  const p = await editer();
  p.__reponse = '3 - Vidéos';
  await p.click('#vue button.nouveau-dossier');
  await p.waitForSelector('#vue .rangee-tete h2:text-is("Vidéos")');
  p.__reponse = 'Affiches';
  await p.click(outil('dp', 'Renommer'));
  await p.waitForSelector('#vue .rangee-tete h2:text-is("Affiches")');
  assert.equal(env.faux.etat.portfolio.dossiers.find((d) => d.id === 'dp').nom, 'Affiches');
  await p.click(`${rangee('dd')} .outils-fichier[data-pour="d1"] button[aria-label^="Supprimer"]`);
  await p.waitForFunction(() => !document.querySelector('#vue [data-fichier="d1"]'));
  await p.click(outil('dp', 'Supprimer'));
  await p.waitForFunction(() => !document.querySelector('#vue .rangee[data-dossier="dp"]'));
  assert.deepEqual(env.faux.etat.portfolio.dossiers.map((d) => d.nom), ['1 - Design', '3 - Vidéos']);
});

test('liens d\'un dossier : ajoutés depuis l\'édition, affichés aux visiteurs', async () => {
  reinit();
  const p = await editer();
  await p.click(outil('dd', 'Liens'));
  await p.fill('#ficheCorps textarea[name="liens"]', 'Behance | https://behance.net/amar\nmauvais | javascript:x');
  await p.click('#ficheCorps button[type="submit"]');
  await p.waitForSelector('#ficheCorps [role="status"]:has-text("ligne 2")');
  await p.fill('#ficheCorps textarea[name="liens"]', 'Behance | https://behance.net/amar');
  await p.click('#ficheCorps button[type="submit"]');
  await p.waitForSelector('#fiche', { state: 'hidden' });
  assert.deepEqual(env.faux.etat.liensDossiers.dd, [{ titre: 'Behance', url: 'https://behance.net/amar' }]);
  const visiteur = await env.page({ chemin: '/#portfolio' });
  await visiteur.waitForSelector(`${rangee('dd')} a.lien-dossier[href="https://behance.net/amar"]`);
});

test('🔒 Protéger → dossier marqué protégé (sans fichiers) ; mot de passe vide → protection retirée', async () => {
  reinit();
  const p = await editer();
  p.__reponse = 'clients2026';
  await p.click(outil('dp', 'Protéger'));
  await p.waitForSelector(`${rangee('dp')}.protege .verrou`);
  assert.equal(env.faux.etat.proteges.dp, 'clients2026');
  assert.equal(await p.locator(`${rangee('dp')} [data-fichier]`).count(), 0);
  p.__reponse = '';
  await p.click(outil('dp', 'Protéger'));
  await p.waitForSelector(`${rangee('dp')} [data-fichier="p1"]`);
  assert.equal(env.faux.etat.proteges.dp, undefined);
});

test('masquer un dossier → brouillon (contenu), pas Drive', async () => {
  reinit();
  const p = await editer();
  await p.click(outil('dp', 'Masquer'));
  const c = await p.evaluate(() => JSON.parse(localStorage.getItem('ab-brouillon')).contenu);
  assert.equal(c.portfolio.dossiers.dp.visible, false);
  assert.equal(env.faux.etat.portfolio.dossiers.length, 2);
  assert.equal(await p.innerText('.barre-edition .compte'), '1 modification');
});
