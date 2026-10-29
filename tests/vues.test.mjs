import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));

let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); env.faux.etat.contenu = c; env.faux.etat.version = c.version; };
const texte = (p, s) => p.locator(s).innerText();

test('accueil : positionnement, 3 blocs, liens vers formation/experience/competences', async () => {
  reinit();
  const p = await env.page();
  assert.equal(await texte(p, '#vue h1'), DEFAUT().accueil.positionnement);
  assert.equal(await texte(p, '#vue .situation'), 'Master 1 · UCBL Lyon 1');
  const blocs = await p.$$eval('#vue .bloc', (bs) => bs.map((b) => [b.getAttribute('href'), b.innerText]));
  assert.deepEqual(blocs.map((b) => b[0]), ['#parcours/formation', '#parcours/experience', '#parcours/competences']);
  assert.match(blocs[0][1], /Master 1 Microbiologie/);
  assert.match(blocs[0][1], /2025 – aujourd'hui/);
  assert.match(blocs[1][1], /Serveur, restauration à forte affluence|Stage parasitologie-mycologie/);
  assert.match(blocs[2][1], /Culture · PCR · ELISA/);
  await p.click('#vue .bloc >> nth=2');
  await p.waitForFunction(() => location.hash === '#parcours/competences');
  assert.match(await texte(p, '#vue'), /Immunologie/);
});

test('accueil : bouton CV absent si medias.cv null, présent sinon', async () => {
  reinit();
  let p = await env.page();
  assert.equal(await p.locator('#vue a', { hasText: 'Télécharger mon CV' }).count(), 0);
  assert.equal(await p.getAttribute('#vue a:has-text("Me contacter")', 'href'), '#contact');
  reinit((c) => { c.medias.cv = { id: 'x', url: 'https://drive.google.com/uc?export=download&id=x', nom: 'CV.pdf' }; });
  p = await env.page();
  assert.equal(await p.getAttribute('#vue a:has-text("Télécharger mon CV")', 'href'), 'https://drive.google.com/uc?export=download&id=x');
});

test('parcours/formation : frise triée, période "2025 – aujourd\'hui"', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours/formation' });
  const items = await p.$$eval('#vue .ti', (xs) => xs.map((x) => x.innerText));
  assert.equal(items.length, 5);
  assert.match(items[0], /2025 – aujourd'hui[\s\S]*Master 1 Microbiologie[\s\S]*Université Claude Bernard Lyon 1/);
  assert.match(items[4], /Baccalauréat Sciences/);
  assert.equal(await p.locator('#vue .ti.now').count(), 1);
});

test('parcours : un seul sous-onglet affiché à la fois', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours' });
  const onglets = await p.$$eval('.sous-onglets [role="tab"]', (xs) => xs.map((x) => [x.textContent, x.getAttribute('aria-selected')]));
  assert.deepEqual(onglets.map((x) => x[0]), ['Profil', 'Formation', 'Expérience', 'Engagement', 'Compétences', 'Langues', 'Certifications', 'Intérêts']);
  assert.equal(onglets.filter((x) => x[1] === 'true').length, 1);
  assert.match(await texte(p, '#vue'), /Une formation de microbiologiste/);
  await p.click('.sous-onglets [role="tab"]:has-text("Langues")');
  await p.waitForFunction(() => location.hash === '#parcours/langues');
  const vue = await texte(p, '#vue');
  assert.match(vue, /Kabyle/);
  assert.doesNotMatch(vue, /Une formation de microbiologiste/);
  assert.equal(await p.getAttribute('.sous-onglets [role="tab"]:has-text("Langues")', 'aria-selected'), 'true');
});

test('liens : une carte par lien visible, plus récents d\'abord, target=_blank rel=noopener', async () => {
  reinit((c) => {
    c.liens.items[0].date = '2026-01-01';
    c.liens.items[3].date = '2026-12-01';
    c.liens.items[4].visible = false;
  });
  const p = await env.page({ chemin: '/#liens' });
  const cartes = await p.$$eval('#vue a.carte', (xs) => xs.map((x) => [x.querySelector('b').textContent, x.target, x.rel, x.getAttribute('href')]));
  assert.equal(cartes.length, 8);
  assert.equal(cartes[0][0], 'BioDilu');
  assert.equal(cartes.at(-1)[0], 'BioStudy');
  assert.ok(cartes.every((x) => x[1] === '_blank' && x[2].includes('noopener')));
  assert.ok(!cartes.some((x) => x[0] === 'BioChem'));
});

test('contact : bouton Copier copie l\'e-mail', async () => {
  reinit();
  const p = await env.page({ chemin: '/#contact', permissions: ['clipboard-read', 'clipboard-write'] });
  assert.match(await texte(p, '#vue'), /Stages en laboratoire/);
  assert.equal(await p.getAttribute('#vue a:has-text("LinkedIn")', 'href'), 'https://www.linkedin.com/in/amarbouchareb');
  await p.click('#vue button:has-text("Copier")');
  assert.equal(await p.evaluate(() => navigator.clipboard.readText()), 'amarxbcrb@gmail.com');
  await p.waitForSelector('#toast.show');
});

test('echappe le HTML', async () => {
  reinit((c) => {
    c.parcours.interets[0].titre = '<img src=x onerror="window.pwn=1">';
    c.liens.items[0].url = 'javascript:window.pwn=2';
  });
  const p = await env.page({ chemin: '/#parcours/interets' });
  assert.match(await texte(p, '#vue'), /<img src=x onerror="window\.pwn=1">/);
  assert.equal(await p.locator('#vue img').count(), 0);
  await p.goto(env.site.url + '/#liens');
  await p.waitForSelector('#vue .carte');
  assert.equal(await p.locator('#vue [href^="javascript"]').count(), 0);
  assert.equal(await p.evaluate(() => window.pwn), undefined);
});

test('parties vides', async () => {
  reinit((c) => { c.parcours.engagement = []; c.liens.items.forEach((x) => { x.visible = false; }); });
  let p = await env.page({ chemin: '/#parcours' });
  const noms = await p.$$eval('.sous-onglets [role="tab"]', (xs) => xs.map((x) => x.textContent));
  assert.ok(!noms.includes('Engagement'));
  await p.goto(env.site.url + '/#liens');
  await p.waitForSelector('#vue .vide');
  assert.equal(await texte(p, '#vue .vide'), 'Aucun lien pour le moment.');
  assert.equal(await p.locator('.sous-onglets').count(), 0);
  reinit((c) => { c.liens.items[1].categorie = 'android'; });
  p = await env.page({ chemin: '/#liens' });
  const cats = await p.$$eval('.sous-onglets [role="tab"]', (xs) => xs.map((x) => x.textContent));
  assert.deepEqual(cats, ['Projets', 'Applis Android']);
});

test('aucune erreur console', async () => {
  reinit();
  const p = await env.page();
  for (const h of ['#parcours/profil', '#parcours/experience', '#parcours/competences', '#parcours/certifications', '#liens', '#contact', '#portfolio']) {
    await p.goto(env.site.url + '/' + h);
    await p.waitForSelector('#vue .vt');
  }
  assert.deepEqual(p.erreurs, []);
});
