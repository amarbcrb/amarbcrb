/* Rendu des médias (assets/media.js) : cadrage auto, vidéo, YouTube, repli. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); env.faux.etat.contenu = c; env.faux.etat.version = c.version; };

/* monte un visuel dans un cadre 300 × 400 (3:4) et renvoie son état */
const monter = (p, media, attendre = true) => p.evaluate(async ([media, attendre]) => {
  const { visuel } = await import('/assets/media.js');
  const cadre = document.createElement('div');
  cadre.style.cssText = 'width:300px;height:400px;position:relative';
  const v = visuel(media, { repli: () => Object.assign(document.createElement('span'), { className: 'repli-test' }) });
  v.style.cssText = 'position:absolute;inset:0;display:block';
  cadre.append(v);
  document.body.append(cadre);
  if (attendre) await new Promise((ok) => { const t = setInterval(() => { if (v.dataset.cadrage || v.querySelector('.repli-test')) { clearInterval(t); ok(); } }, 20); });
  const m = v.querySelector('img:not(.flou), video');
  return { cadrage: v.dataset.cadrage || null, flou: !!v.querySelector('.flou'), repli: !!v.querySelector('.repli-test'), balise: m && m.tagName,
    src: m && m.getAttribute('src'), attrs: m ? [...m.attributes].map((a) => a.name).sort() : [], lecture: !!v.querySelector('.lecture') };
}, [media, attendre]);
const png = (p, l, h) => p.evaluate(([l, h]) => { const c = document.createElement('canvas'); c.width = l; c.height = h; c.getContext('2d').fillRect(0, 0, l, h); return c.toDataURL('image/png'); }, [l, h]);

/* image dessinée : fond uni (ou bandes de couleurs différentes sur le bord haut) */
const dessin = (p, l, h, couleurs) => p.evaluate(([l, h, couleurs]) => {
  const c = document.createElement('canvas'); c.width = l; c.height = h;
  const x = c.getContext('2d');
  couleurs.forEach((col, i) => { x.fillStyle = col; x.fillRect(i * l / couleurs.length, 0, l / couleurs.length, h); });
  return c.toDataURL('image/png');
}, [l, h, couleurs]);
test('cadrage : photo 3:1 dans un cadre 3:4 → entière (contain) sur un fond flouté ; image 3:4 → remplit (cover)', async () => {
  reinit();
  const p = await env.page();
  const large = await monter(p, { url: await dessin(p, 300, 100, ['rgb(200, 30, 30)', 'rgb(20, 20, 200)']) });
  assert.deepEqual([large.cadrage, large.flou], ['contain', true]);
  const juste = await monter(p, { url: await png(p, 300, 400) });
  assert.deepEqual([juste.cadrage, juste.flou], ['cover', false]);
});

test('vidéo : muette, en boucle, inline ; lecture auto sauf mouvement réduit', async () => {
  reinit();
  let p = await env.page();
  let v = await monter(p, { url: '/demo.mp4' }, false);
  assert.equal(v.balise, 'VIDEO');
  assert.ok(['loop', 'muted', 'playsinline'].every((a) => v.attrs.includes(a)), v.attrs.join());
  assert.ok(!v.attrs.includes('autoplay'));
  p = await env.page({ mouvementReduit: false });
  v = await monter(p, { url: '/demo.mp4' }, false);
  assert.ok(v.attrs.includes('autoplay'));
});

test('YouTube : miniature i.ytimg.com et pastille ▶', async () => {
  reinit();
  const p = await env.page();
  const v = await monter(p, { url: 'https://youtu.be/dQw4w9WgXcQ' }, false);
  assert.equal(v.src, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(v.lecture, true);
});

test('erreur de chargement ou lien dangereux → repli', async () => {
  reinit();
  const p = await env.page();
  assert.equal((await monter(p, { url: '/introuvable.png' })).repli, true);
  assert.equal((await monter(p, { url: 'javascript:alert(1)' })).repli, true);
  assert.equal((await monter(p, null)).repli, true);
});

test('affiches de certification en 3:4 ; fiche d\'un élément avec vidéo YouTube → lecteur youtube-nocookie', async () => {
  reinit((c) => { c.parcours.certifications[0].image = { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }; });
  const p = await env.page({ chemin: '/#parcours/certifications' });
  const r = await p.$eval('#vue .carte-cert .visuel', (x) => { const b = x.getBoundingClientRect(); return b.width / b.height; });
  assert.ok(Math.abs(r - 0.75) < 0.02, `rapport ${r}`);
  await p.click('#vue a.carte-lien-fiche[href="#parcours/certifications/k1"]');
  await p.waitForSelector('#fiche', { state: 'visible' });
  assert.equal(await p.getAttribute('#ficheCorps iframe', 'src'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(await p.getAttribute('#ficheCorps iframe', 'title'), 'Vidéo YouTube');
});

test('lien YouTube sans image → sa miniature sur la carte', async () => {
  reinit((c) => { Object.assign(c.liens.items[1], { url: 'https://youtu.be/dQw4w9WgXcQ', image: '' }); });
  /* miniature servie localement : le test ne dépend pas d'internet */
  const p = await env.page({ chemin: null });
  await p.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: readFileSync(new URL('../favicon-512x512.png', import.meta.url)) }));
  await p.goto(env.site.url + '/#liens/projets');
  assert.equal(await p.getAttribute('#vue a.carte-lien[href="https://youtu.be/dQw4w9WgXcQ"] .visuel img:not(.flou)', 'src'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
});

const bords = (p) => p.evaluate(() => {
  const v = [...document.querySelectorAll('.visuel')].at(-1);
  return { bord: v.dataset.bord || null, a: v.style.getPropertyValue('--bord-a'), b: v.style.getPropertyValue('--bord-b'), flou: !!v.querySelector('.flou'), fond: getComputedStyle(v).backgroundImage };
});

test('affiche : logo carré uni dans un cadre 3:4 → bandes haut et bas de la couleur du bord, sans flou', async () => {
  reinit();
  const p = await env.page();
  const r = await monter(p, { url: await dessin(p, 300, 300, ['rgb(36, 84, 204)']) });
  assert.equal(r.cadrage, 'contain');
  await p.waitForFunction(() => [...document.querySelectorAll('.visuel')].at(-1).dataset.bord);
  const b = await bords(p);
  assert.deepEqual([b.bord, b.a, b.b, b.flou], ['haut-bas', 'rgb(36, 84, 204)', 'rgb(36, 84, 204)', false]);
  assert.match(b.fond, /linear-gradient/);
});

test('affiche : photo au bord varié → fond flouté gardé ; image d\'un autre site sans CORS → s\'affiche, fond flouté', async () => {
  reinit();
  const p = await env.page();
  await monter(p, { url: await dessin(p, 300, 300, ['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(0, 0, 255)', 'rgb(255, 255, 255)']) });
  await p.waitForTimeout(300);
  assert.deepEqual([(await bords(p)).bord, (await bords(p)).flou], [null, true]);
  /* autre origine, sans en-tête CORS (un petit serveur à part : Playwright ajouterait l'en-tête à une réponse simulée) */
  const corps = Buffer.from((await dessin(p, 300, 300, ['rgb(10, 120, 60)'])).split(',')[1], 'base64');
  const serveur = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(corps); });
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  after(() => serveur.close());
  const r = await monter(p, { url: `http://127.0.0.1:${serveur.address().port}/logo.png` });
  assert.equal(r.cadrage, 'contain');
  await p.waitForTimeout(400);
  const b = await bords(p);
  assert.deepEqual([b.bord, b.flou], [null, true]);
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('.visuel')].at(-1).querySelector('img:not(.flou)').naturalWidth), 300);
});
