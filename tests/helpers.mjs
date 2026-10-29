/* Serveur statique de test (racine du dépôt), faux script et Chromium. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { creerFauxScript } from './mock-script.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

export async function creerServeurStatique(urlScript) {
  const serveur = createServer(async (req, res) => {
    const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (chemin === '/assets/config.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
      res.end(`export const SCRIPT_URL = ${JSON.stringify(urlScript)};\n`);
      return;
    }
    let fichier = normalize(join(RACINE, chemin));
    if (!fichier.startsWith(RACINE)) { res.writeHead(403); res.end(); return; }
    try {
      if ((await stat(fichier)).isDirectory()) fichier = join(fichier, 'index.html');
      const data = await readFile(fichier);
      res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('404');
    }
  });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${serveur.address().port}`, fermer: () => new Promise((r) => serveur.close(r)) };
}

/* Démarre faux script + site + Chromium. page({ stockage }) ouvre un onglet neuf avec un localStorage prérempli. */
export async function demarrer({ contenu, motDePasse } = {}) {
  const faux = await creerFauxScript({ ...(contenu ? { contenu } : {}), ...(motDePasse ? { motDePasse } : {}) });
  const site = await creerServeurStatique(faux.url);
  const { chromium } = createRequire(import.meta.url)('playwright');
  const navigateur = await chromium.launch();
  const contextes = [];
  async function page({ stockage = {}, viewport = { width: 390, height: 844 }, chemin = '/', attendre = true } = {}) {
    const ctx = await navigateur.newContext({ viewport, reducedMotion: 'reduce' });
    contextes.push(ctx);
    await ctx.addInitScript((s) => { if (!sessionStorage.getItem('__init')) { Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); sessionStorage.setItem('__init', '1'); } }, stockage);
    const p = await ctx.newPage();
    p.erreurs = [];
    p.on('pageerror', (e) => p.erreurs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') p.erreurs.push(m.text()); });
    if (chemin !== null) await p.goto(site.url + chemin, { waitUntil: attendre ? 'networkidle' : 'commit' });
    return p;
  }
  return {
    site, faux, navigateur, page,
    fermer: async () => { await Promise.all(contextes.map((c) => c.close().catch(() => {}))); await navigateur.close(); await site.fermer(); await faux.fermer(); },
  };
}
