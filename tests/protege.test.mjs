/* Dossiers protégés par mot de passe, côté visiteur. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const img = (id, nom) => ({ id, nom, type: 'image/jpeg', apercu: `/favicon-512x512.png?${id}`, lien: `https://drive.google.com/file/d/${id}/view` });
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = () => {
  const c = DEFAUT();
  Object.assign(env.faux.etat, { contenu: c, version: c.version, proteges: { dp: 'clients2026' }, echecsDossiers: {}, liensDossiers: { dp: [{ titre: 'Maquette Figma', url: 'https://figma.com/x' }] } });
  env.faux.etat.portfolio.dossiers = [{ id: 'dd', nom: '1 - Design', fichiers: [img('d1', 'A.jpg')] },
    { id: 'dp', nom: '2 - Clients', fichiers: [img('p1', 'maquette.jpg'), { id: 'p2', nom: 'devis.pdf', type: 'application/pdf', apercu: '', lien: 'https://drive.google.com/file/d/p2/view' }] }];
};
async function ouvrirVerrou(p) {
  await p.waitForSelector('#vue .vignette.verrou');
  await p.click('#vue .vignette.verrou');
  await p.waitForSelector('#fiche', { state: 'visible' });
}
async function mdp(p, m) {
  await p.fill('#ficheCorps input[type="password"]', m);
  await p.click('#ficheCorps button[type="submit"]');
}

test('dossier protégé : cadenas, aucune adresse Drive ni aperçu de ses fichiers dans la page', async () => {
  reinit();
  const p = await env.page({ chemin: '/#portfolio' });
  await p.waitForSelector('#vue .rangee[data-dossier="dp"].protege .vignette.verrou');
  const html = await p.content();
  assert.ok(!html.includes('/p1/') && !html.includes('?p1') && !html.includes('figma.com'));
});

test('mauvais mot de passe → message ; bon → fichiers (aperçus en blob:), liens', async () => {
  reinit();
  const p = await env.page({ chemin: '/#portfolio' });
  await ouvrirVerrou(p);
  await mdp(p, 'faux');
  await p.waitForSelector('#ficheCorps [role="status"]:has-text("Mot de passe incorrect")');
  await mdp(p, 'clients2026');
  await p.waitForSelector('#ficheCorps .protege-contenu img[src^="blob:"]');
  assert.deepEqual(await p.$$eval('#ficheCorps .protege-contenu .vignette', (xs) => xs.map((x) => x.getAttribute('aria-label'))), ['Ouvrir maquette.jpg', 'Ouvrir devis.pdf']);
  assert.equal(await p.getAttribute('#ficheCorps a[href="https://figma.com/x"]', 'target'), '_blank');
});

test('PDF → ouvert depuis une adresse blob:', async () => {
  reinit();
  const p = await env.page({ chemin: '/#portfolio' });
  await p.evaluate(() => { window.__ouvert = []; window.open = (u) => { window.__ouvert.push(u); return null; }; });
  await ouvrirVerrou(p);
  await mdp(p, 'clients2026');
  await p.click('#ficheCorps button:has-text("devis.pdf")');
  await p.waitForFunction(() => window.__ouvert.length > 0);
  assert.match(await p.evaluate(() => window.__ouvert[0]), /^blob:/);
});

test('clé gardée : au rechargement, le dossier s\'ouvre sans redemander le mot de passe', async () => {
  reinit();
  const p = await env.page({ chemin: '/#portfolio' });
  await ouvrirVerrou(p);
  await mdp(p, 'clients2026');
  await p.waitForSelector('#ficheCorps .protege-contenu');
  await p.reload({ waitUntil: 'networkidle' });
  await ouvrirVerrou(p);
  await p.waitForSelector('#ficheCorps .protege-contenu img[src^="blob:"]');
  assert.equal(await p.locator('#ficheCorps input[type="password"]').count(), 0);
});

test('dossier protégé : clé refusée (mot de passe changé) → mot de passe redemandé', async () => {
  reinit();
  const p = await env.page({ chemin: '/#portfolio' });
  await ouvrirVerrou(p);
  await mdp(p, 'clients2026');
  await p.waitForSelector('#ficheCorps .protege-contenu');
  env.faux.etat.proteges.dp = 'nouveau-mdp';
  await p.reload({ waitUntil: 'networkidle' });
  await ouvrirVerrou(p);
  await p.waitForSelector('#ficheCorps input[type="password"]');
  assert.equal(await p.evaluate(() => localStorage.getItem('ab-cle:dp')), null);
});

test('5 échecs → message « Trop d\'essais »', async () => {
  reinit();
  const p = await env.page({ chemin: '/#portfolio' });
  await ouvrirVerrou(p);
  for (let i = 0; i < 5; i++) { await mdp(p, 'faux' + i); await p.waitForSelector('#ficheCorps [role="status"]:has-text("incorrect")'); }
  await mdp(p, 'clients2026');
  await p.waitForSelector('#ficheCorps [role="status"]:has-text("Trop d\'essais")');
});
