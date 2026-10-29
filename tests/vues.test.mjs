import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));

let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = (modif) => { const c = DEFAUT(); if (modif) modif(c); env.faux.etat.contenu = c; env.faux.etat.version = c.version; };
const titres = (p, s) => p.$$eval(s, (xs) => xs.map((x) => x.textContent.trim()));
const ouverte = (p) => p.waitForSelector('#fiche', { state: 'visible' });
const hash = (p) => p.evaluate(() => location.hash);
const certifs = (n) => Array.from({ length: n }, (_, i) => ({ id: 'k' + (i + 1), titre: 'Certif ' + (i + 1), organisme: 'Coursera', annee: '2025', url: '', visible: true }));

test('parcours : profil puis rangées dans l\'ordre', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours' });
  assert.match(await p.innerText('#vue .profil h2'), /Une formation de microbiologiste/);
  assert.deepEqual(await titres(p, '#vue .rangee .rangee-tete h2'), ['Formation', 'Expérience', 'Compétences', 'Certifications', 'Langues', 'Engagement', 'Intérêts']);
  assert.equal(await p.getAttribute('#vue .rangee >> nth=3 >> a.voir', 'aria-label'), 'Voir tout : Certifications');
  assert.equal(await p.locator('.sous-onglets').count(), 0);
});

test('rangée : 10 vs 11', async () => {
  reinit((c) => { c.parcours.certifications = certifs(10); });
  let p = await env.page({ chemin: '/#parcours' });
  const rangee = '#vue .rangee:has(h2:text-is("Certifications"))';
  assert.equal(await p.locator(`${rangee} .piste > .carte:not(.carte-plus)`).count(), 10);
  assert.equal(await p.locator(`${rangee} .carte-plus`).count(), 0);
  reinit((c) => { c.parcours.certifications = certifs(11); });
  p = await env.page({ chemin: '/#parcours' });
  assert.equal(await p.locator(`${rangee} .piste > .carte:not(.carte-plus)`).count(), 10);
  assert.equal(await p.innerText(`${rangee} .carte-plus`), 'Voir tout (11)');
  assert.equal(await p.getAttribute(`${rangee} .carte-plus`, 'href'), '#parcours/certifications');
});

test('› ouvre Voir tout, grille complète, Retour revient', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours' });
  await p.click('#vue .rangee:has(h2:text-is("Certifications")) a.voir');
  await p.waitForFunction(() => location.hash === '#parcours/certifications');
  assert.equal(await p.innerText('#vue .vt-tete h1'), 'Certifications');
  assert.equal(await p.innerText('#vue .vt-tete small'), '18 éléments');
  assert.equal(await p.locator('#vue .grille > .carte').count(), 18);
  await p.click('#vue a.retour');
  await p.waitForFunction(() => location.hash === '#parcours');
  assert.equal(await p.locator('#vue .rangee').count(), 7);
});

test('étape → fiche (#parcours/experience/e1), contenu complet, Échap revient à Voir tout', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours/experience' });
  await p.click('#vue a.etape[href="#parcours/experience/e1"]');
  await ouverte(p);
  assert.equal(await hash(p), '#parcours/experience/e1');
  assert.equal(await p.innerText('#ficheTitre'), 'Stage parasitologie-mycologie');
  assert.match(await p.innerText('#ficheCorps'), /juin 2023 – août 2023[\s\S]*CHU Nedir Mohamed[\s\S]*Préparation d'échantillons/);
  await p.keyboard.press('Escape');
  await p.waitForSelector('#fiche', { state: 'hidden' });
  await p.waitForFunction(() => location.hash === '#parcours/experience');
  assert.equal(await p.evaluate(() => document.activeElement.getAttribute('href')), '#parcours/experience/e1');
});

test('retour arrière : fiche puis voir tout', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours' });
  await p.click('#vue .rangee:has(h2:text-is("Certifications")) a.voir');
  await p.waitForFunction(() => location.hash === '#parcours/certifications');
  await p.click('#vue .grille a[href="#parcours/certifications/k1"]');
  await ouverte(p);
  await p.goBack();
  await p.waitForSelector('#fiche', { state: 'hidden' });
  assert.equal(await hash(p), '#parcours/certifications');
  assert.equal(await p.locator('#vue .grille > .carte').count(), 18);
  await p.goBack();
  await p.waitForFunction(() => location.hash === '#parcours');
});

test('fiche inconnue', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours/experience/zzz' });
  assert.equal(await hash(p), '#parcours/experience');
  assert.equal(await p.innerText('#vue .vt-tete h1'), 'Expérience');
  assert.equal(await p.isVisible('#fiche'), false);
});

test('certificat : bouton Voir le certificat si url, absent sinon', async () => {
  reinit((c) => { c.parcours.certifications[0].url = 'https://coursera.org/verify/ABC'; });
  const p = await env.page({ chemin: '/#parcours/certifications' });
  const avec = p.locator('#vue .grille > .carte >> nth=0');
  assert.equal(await avec.locator('a.btn:has-text("Voir le certificat")').getAttribute('href'), 'https://coursera.org/verify/ABC');
  assert.equal(await avec.locator('a.btn').getAttribute('target'), '_blank');
  assert.equal(await p.locator('#vue .grille > .carte >> nth=1 >> a.btn').count(), 0);
  await p.click('#vue .grille a.carte-lien-fiche[href="#parcours/certifications/k1"]');
  await ouverte(p);
  assert.equal(await p.getAttribute('#ficheCorps a.btn:has-text("Voir le certificat")', 'href'), 'https://coursera.org/verify/ABC');
});

test('lien : image, titre, description, bouton (texte réglé ou « Ouvrir »), nouvel onglet', async () => {
  reinit((c) => {
    Object.assign(c.liens.items[0], { image: 'https://exemple.fr/a.png', bouton: 'Visiter BioStudy', date: '2026-12-01' });
  });
  const p = await env.page({ chemin: '/#liens' });
  assert.deepEqual(await titres(p, '#vue .rangee .rangee-tete h2'), ['Projets']);
  const premiere = p.locator('#vue a.carte-lien >> nth=0');
  assert.equal(await premiere.getAttribute('href'), 'https://www.biostudy.xyz/');
  assert.equal(await premiere.getAttribute('target'), '_blank');
  assert.match(await premiere.getAttribute('rel'), /noopener/);
  assert.equal(await premiere.locator('img').getAttribute('src'), 'https://exemple.fr/a.png');
  assert.equal(await premiere.locator('b').innerText(), 'BioStudy');
  assert.match(await premiere.locator('p').innerText(), /Plateforme fondée en 2022/);
  assert.equal(await premiere.locator('.btn').innerText(), 'Visiter BioStudy');
  assert.equal(await p.locator('#vue a.carte-lien >> nth=1 >> .btn').innerText(), 'Ouvrir');
});

test('replis des cartes', async () => {
  reinit((c) => { c.liens.items[1].description = ''; });
  const p = await env.page({ chemin: '/#parcours' });
  const interet = p.locator('#vue a.carte-image >> nth=0');
  assert.equal(await interet.locator('img').count(), 0);
  assert.equal(await interet.locator('.degrade').count(), 1);
  assert.equal(await interet.locator('.titre').innerText(), 'Astronomie');
  await p.goto(env.site.url + '/#liens/projets');
  await p.waitForSelector('#vue .grille a.carte-lien');
  const sansImage = p.locator('#vue .grille a.carte-lien[href="https://www.biostudy.xyz/BioCampus/"]');
  assert.equal(await sansImage.locator('img').count(), 0);
  assert.equal(await sansImage.locator('.degrade').innerText(), 'biostudy.xyz');
  assert.equal(await sansImage.locator('p').count(), 0);
});

test('intérêt avec image : affiche en carte, image en grand dans la fiche', async () => {
  reinit((c) => { c.parcours.interets[0].image = { id: 'x', url: '/favicon-512x512.png?astro' }; });
  const p = await env.page({ chemin: '/#parcours' });
  assert.match(await p.getAttribute('#vue a.carte-image >> nth=0 >> img', 'src'), /\?astro$/);
  await p.click('#vue a.carte-image >> nth=0');
  await ouverte(p);
  assert.match(await p.getAttribute('#ficheCorps img.fiche-image', 'src'), /\?astro$/);
  assert.match(await p.innerText('#ficheCorps'), /club d'astronomie/);
});

test('Lire la suite déplie le profil', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours' });
  const bouton = p.locator('#vue .profil button.lire');
  assert.equal(await bouton.getAttribute('aria-expanded'), 'false');
  await bouton.click();
  assert.equal(await bouton.getAttribute('aria-expanded'), 'true');
  assert.equal(await bouton.innerText(), 'Réduire');
  assert.equal(await hash(p), '#parcours');
});

test('accueil : 3 grandes cartes ouvrent fiche ou page', async () => {
  reinit();
  const p = await env.page();
  assert.equal(await p.innerText('#vue h1'), DEFAUT().accueil.positionnement);
  const liens = await p.$$eval('#vue .rangee-accueil a.carte', (xs) => xs.map((x) => x.getAttribute('href')));
  assert.deepEqual(liens, ['#parcours/formation/f1', '#parcours/experience/e5', '#parcours/competences']);
  await p.click('#vue .rangee-accueil a.carte >> nth=0');
  await ouverte(p);
  assert.equal(await p.innerText('#ficheTitre'), 'Master 1 Microbiologie');
});

test('echappe le HTML', async () => {
  reinit((c) => {
    c.parcours.interets[0].titre = '<img src=x onerror="window.pwn=1">';
    c.liens.items[0].url = 'javascript:window.pwn=2';
  });
  const p = await env.page({ chemin: '/#parcours/interets' });
  assert.match(await p.innerText('#vue'), /<img src=x onerror="window\.pwn=1">/);
  assert.equal(await p.locator('#vue img').count(), 0);
  await p.goto(env.site.url + '/#liens');
  await p.waitForSelector('#vue .carte-lien');
  assert.equal(await p.locator('#vue [href^="javascript"]').count(), 0);
  assert.equal(await p.evaluate(() => window.pwn), undefined);
});

test('parties vides', async () => {
  reinit((c) => { c.parcours.engagement = []; c.liens.items.forEach((x) => { x.visible = false; }); });
  const p = await env.page({ chemin: '/#parcours' });
  assert.ok(!(await titres(p, '#vue .rangee h2')).includes('Engagement'));
  await p.goto(env.site.url + '/#liens');
  await p.waitForSelector('#vue .vide');
  assert.equal(await p.innerText('#vue .vide'), 'Aucun lien pour le moment.');
});

test('aucune erreur console', async () => {
  reinit();
  const p = await env.page();
  for (const h of ['#parcours', '#parcours/experience', '#parcours/competences/c1', '#parcours/langues', '#liens', '#liens/projets', '#portfolio', '#contact']) {
    await p.goto(env.site.url + '/' + h);
    await p.waitForSelector('#vue .vt');
  }
  assert.deepEqual(p.erreurs, []);
});

test('frise : Formation et Expérience en frise, 4 étapes au plus puis « Voir tout (N) »', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours' });
  assert.deepEqual(await titres(p, '#vue .rangee-frise .rangee-tete h2'), ['Formation', 'Expérience']);
  const formation = '#vue .rangee-frise:has(h2:text-is("Formation"))';
  assert.equal(await p.locator(`${formation} ol.frise > li.etape`).count(), 4);
  assert.equal(await p.innerText(`${formation} a.frise-plus`), 'Voir tout (5)');
  assert.equal(await p.getAttribute(`${formation} a.frise-plus`, 'href'), '#parcours/formation');
  const premiere = `${formation} li.etape >> nth=0`;
  assert.equal(await p.getAttribute(`${premiere} >> a.etape`, 'href'), '#parcours/formation/f1');
  assert.match(await p.innerText(premiere), /2025 – aujourd'hui[\s\S]*Master 1 Microbiologie[\s\S]*Université Claude Bernard Lyon 1[\s\S]*En cours/);
  assert.equal(await p.locator(`${premiere} >> .point.actif`).count(), 1);
  assert.equal(await p.locator('#vue .rangee:has(h2:text-is("Certifications")) .piste').count(), 1);
  await p.click(`${formation} a.etape[href="#parcours/formation/f1"]`);
  await ouverte(p);
  assert.equal(await p.innerText('#ficheTitre'), 'Master 1 Microbiologie');
});

test('frise : 4 étapes exactement → pas de « Voir tout (N) » ; Voir tout montre la frise complète', async () => {
  reinit((c) => { c.parcours.experience = c.parcours.experience.slice(0, 4); });
  let p = await env.page({ chemin: '/#parcours' });
  const experience = '#vue .rangee-frise:has(h2:text-is("Expérience"))';
  assert.equal(await p.locator(`${experience} li.etape`).count(), 4);
  assert.equal(await p.locator(`${experience} a.frise-plus`).count(), 0);
  reinit();
  p = await env.page({ chemin: '/#parcours/formation' });
  assert.equal(await p.locator('#vue ol.frise > li.etape').count(), 5);
  assert.equal(await p.locator('#vue .grille').count(), 0);
  assert.equal(await p.locator('#vue .frise-plus').count(), 0);
});

test('couleur par rubrique : Formation bleu, Certifications vert, catégories de liens dans l\'ordre de la palette', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours' });
  const couleur = (sel) => p.locator(sel).first().evaluate((x) => {
    const r = getComputedStyle(document.documentElement);
    return [getComputedStyle(x).getPropertyValue('--pc').trim(), r.getPropertyValue('--c-blue').trim(), r.getPropertyValue('--c-green').trim()];
  });
  let [pc, bleu, vert] = await couleur('#vue .rangee:has(h2:text-is("Formation"))');
  assert.equal(pc, bleu);
  [pc, bleu, vert] = await couleur('#vue .rangee:has(h2:text-is("Certifications"))');
  assert.equal(pc, vert);
  await p.evaluate(() => { location.hash = '#liens'; });
  await p.waitForSelector('#vue .rangee');
  const [p1, b1] = await couleur('#vue .rangee');
  assert.equal(p1, b1);
  await p.evaluate(() => { location.hash = '#parcours/certifications'; });
  await p.waitForSelector('#vue .vt-voir');
  [pc, bleu, vert] = await couleur('#vue .vt-voir');
  assert.equal(pc, vert);
});
