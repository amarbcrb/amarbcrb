import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const img = (id, nom) => ({ id, nom, type: 'image/jpeg', apercu: `/favicon-512x512.png?${id}`, lien: `https://drive.google.com/file/d/${id}/view` });
const DOSSIERS = () => [
  { id: 'dp', nom: '2 - Posters', fichiers: [img('p1', 'Variole.jpg'), { id: 'p2', nom: 'Rapport.pdf', type: 'application/pdf', apercu: '/favicon-512x512.png?p2', lien: 'https://drive.google.com/file/d/p2/view' }] },
  { id: 'dd', nom: '1 - Design', fichiers: [img('d1', 'A.jpg'), img('d2', 'B.jpg'), img('d3', 'C.jpg')] },
  { id: 'dx', nom: 'Brouillons', fichiers: [img('x1', 'X.jpg')] },
];

let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = ({ modif, dossiers = DOSSIERS(), panne = false } = {}) => {
  const c = DEFAUT(); if (modif) modif(c);
  env.faux.etat.contenu = c; env.faux.etat.version = c.version; env.faux.etat.portfolio.dossiers = dossiers;
  env.faux.regler({ panne: false });
  env.faux.panneProchainPortfolio = panne;
};
async function ouvrir(chemin, opts) {
  const p = await env.page({ chemin: '/', ...opts });
  if (env.faux.panneProchainPortfolio) env.faux.regler({ panne: true });
  await p.evaluate((h) => { location.hash = h; }, chemin);
  return p;
}

test('une rangée par dossier visible, préfixe retiré, ordre par préfixe', async () => {
  reinit({ modif: (c) => { c.portfolio.dossiers = { dx: { visible: false, nom: '' } }; } });
  const p = await ouvrir('#portfolio');
  await p.waitForSelector('#vue .rangee');
  const noms = await p.$$eval('#vue .rangee .rangee-tete h2', (xs) => xs.map((x) => x.textContent));
  assert.deepEqual(noms, ['Design', 'Posters']);
  assert.equal(await p.locator('#vue .rangee >> nth=0 >> .piste .vignette').count(), 3);
  await p.click('#vue .rangee >> nth=0 >> a.voir');
  await p.waitForFunction(() => location.hash === '#portfolio/dd');
  assert.equal(await p.locator('#vue .grille .vignette').count(), 3);
});

test('grille d\'aperçus avec URL thumbnail', async () => {
  reinit();
  const p = await ouvrir('#portfolio/dd');
  await p.waitForSelector('#vue .vignette img');
  const srcs = await p.$$eval('#vue .vignette img', (xs) => xs.map((x) => x.getAttribute('src')));
  assert.deepEqual(srcs, ['/favicon-512x512.png?d1', '/favicon-512x512.png?d2', '/favicon-512x512.png?d3']);
  assert.equal(await p.getAttribute('#vue .vignette >> nth=0 >> .vignette-ouvrir', 'aria-label'), 'Agrandir A.jpg');
});

test('image → visionneuse, flèches, Échap ferme', async () => {
  reinit();
  const p = await ouvrir('#portfolio/dd');
  await p.click('#vue .vignette >> nth=1');
  await p.waitForSelector('#lb.on');
  assert.equal(await p.textContent('#lbCount'), '2 / 3');
  assert.match(await p.getAttribute('#lb img', 'src'), /\?d2$/);
  await p.keyboard.press('ArrowRight');
  assert.equal(await p.textContent('#lbCount'), '3 / 3');
  await p.click('#lbPrev');
  assert.equal(await p.textContent('#lbCount'), '2 / 3');
  await p.keyboard.press('Escape');
  await p.waitForSelector('#lb.on', { state: 'detached' }).catch(() => {});
  assert.equal(await p.locator('#lb.on').count(), 0);
});

test('PDF → lien vers la page Drive, nouvel onglet', async () => {
  reinit();
  const p = await ouvrir('#portfolio/dp');
  await p.waitForSelector('#vue a.vignette-ouvrir');
  const a = p.locator('#vue a.vignette-ouvrir');
  assert.equal(await a.getAttribute('href'), 'https://drive.google.com/file/d/p2/view');
  assert.equal(await a.getAttribute('target'), '_blank');
  assert.match(await p.innerText('#vue .vignette.doc'), /Rapport\.pdf/);
});

test('dossier masqué dans contenu.portfolio.dossiers absent', async () => {
  reinit({ modif: (c) => { c.portfolio.dossiers = { dp: { visible: false, nom: '' } }; } });
  const p = await ouvrir('#portfolio/dp');
  await p.waitForFunction(() => location.hash === '#portfolio');
  await p.waitForSelector('#vue .rangee');
  const noms = await p.$$eval('#vue .rangee .rangee-tete h2', (xs) => xs.map((x) => x.textContent));
  assert.ok(!noms.includes('Posters'));
});

test('lien direct vers un dossier conservé pendant le chargement', async () => {
  reinit();
  env.faux.regler({ lent: 600 });
  const p = await env.page({ chemin: '/#portfolio/dp', attendre: false });
  await p.waitForSelector('#vue a.vignette-ouvrir', { timeout: 8000 });
  assert.equal(await p.evaluate(() => location.hash), '#portfolio/dp');
  env.faux.regler({ lent: 0 });
});

test('script portfolio en panne → "Portfolio momentanément indisponible"', async () => {
  reinit({ panne: true });
  const p = await ouvrir('#portfolio');
  await p.waitForSelector('#vue .vide');
  assert.equal(await p.innerText('#vue .vide'), 'Portfolio momentanément indisponible.');
  env.faux.regler({ panne: false });
});

test('aucun dossier → message "Portfolio bientôt disponible"', async () => {
  reinit({ dossiers: [] });
  const p = await ouvrir('#portfolio');
  await p.waitForSelector('#vue .vide');
  assert.equal(await p.innerText('#vue .vide'), 'Portfolio bientôt disponible.');
  assert.deepEqual(p.erreurs, []);
});

test('fichier non image : miniature Drive en plein cadre, sinon feuille avec son extension', async () => {
  const doc = (id, nom, apercu) => ({ id, nom, type: 'application/octet-stream', apercu, lien: `https://drive.google.com/file/d/${id}/view` });
  reinit({ dossiers: [{ id: 'dt', nom: 'TP', fichiers: [doc('t1', 'TP Levures.pdf', '/favicon-512x512.png?t1'), doc('t2', 'TP Levures Cas9.gbk', '/introuvable.png')] }] });
  const p = await ouvrir('#portfolio/dt');
  await p.waitForSelector('#vue .vignette.fichier >> nth=1');
  assert.equal(await p.locator('#vue .vignette.fichier >> nth=0 >> .doc-apercu img').getAttribute('src'), '/favicon-512x512.png?t1');
  await p.waitForSelector('#vue .vignette.fichier >> nth=1 >> .doc-repli');
  assert.equal(await p.textContent('#vue .vignette.fichier >> nth=1 >> .doc-repli svg text'), 'GBK');
  assert.match(await p.innerText('#vue .vignette.fichier >> nth=1 >> .doc-legende'), /TP Levures Cas9\.gbk/);
});

test('toucher un fichier → aperçu Drive dans une feuille ; fichier de séquence → icône et Télécharger', async () => {
  const doc = (id, nom, type) => ({ id, nom, type, apercu: '/introuvable.png', lien: `https://drive.google.com/file/d/${id}/view` });
  reinit({ dossiers: [{ id: 'dt', nom: 'TP', fichiers: [doc('pdf_123456789', 'TP.pdf', 'application/pdf'), doc('dna_123456789', 'Cas9.dna', 'application/octet-stream')] }] });
  const p = await ouvrir('#portfolio/dt');
  await p.click('#vue .vignette.fichier >> nth=0');
  await p.waitForSelector('#fiche.on .apercu-fichier');
  assert.equal(await p.getAttribute('#fiche .apercu-fichier', 'src'), 'https://drive.google.com/file/d/pdf_123456789/preview');
  assert.equal(await p.textContent('#ficheTitre'), 'TP.pdf');
  assert.equal(await p.evaluate(() => location.hash), '#portfolio/dt');
  await p.click('#ficheFermer');
  await p.waitForSelector('#fiche.on', { state: 'detached' }).catch(() => {});
  await p.click('#vue .vignette.fichier >> nth=1 >> [data-voir].doc-action');
  await p.waitForSelector('#fiche.on .apercu-indispo');
  assert.match(await p.innerText('#fiche .apercu-indispo'), /SnapGene/);
  assert.equal(await p.getAttribute('#fiche a.btn:has-text("Télécharger")', 'href'), 'https://drive.google.com/uc?export=download&id=dna_123456789');
});

test('affichage grande grille / petite grille / liste, gardé après rechargement', async () => {
  reinit();
  const p = await ouvrir('#portfolio/dp');
  await p.waitForSelector('#vue .grille-fichiers[data-vue="grand"]');
  await p.click('.choix-vue [data-vue="liste"]');
  assert.equal(await p.getAttribute('#vue .grille-fichiers', 'data-vue'), 'liste');
  assert.equal(await p.getAttribute('.choix-vue [data-vue="liste"]', 'aria-pressed'), 'true');
  await p.reload();
  await p.waitForSelector('#vue .grille-fichiers[data-vue="liste"]');
  assert.match(await p.innerText('#vue .vignette:not(.doc)'), /Variole\.jpg/);
});

test('chaque fichier : boutons Voir et Télécharger toujours présents', async () => {
  reinit();
  const p = await ouvrir('#portfolio/dp');
  await p.waitForSelector('#vue .vignette.doc .doc-actions');
  assert.equal(await p.getAttribute('#vue .vignette.doc a.doc-action', 'href'), 'https://drive.google.com/uc?export=download&id=p2');
  assert.equal(await p.getAttribute('#vue .vignette:not(.doc) a.doc-action', 'href'), 'https://drive.google.com/uc?export=download&id=p1');
  await p.click('#vue .vignette:not(.doc) button.doc-action');
  await p.waitForSelector('#lb.on');
  assert.match(await p.getAttribute('#lb img', 'src'), /\?p1$/);
});
