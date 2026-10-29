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
  assert.match(await p.innerText('#ficheCorps'), /Préparation d'échantillons[\s\S]*Détails[\s\S]*CHU Nedir Mohamed[\s\S]*juin 2023 – août 2023/);
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
    Object.assign(c.liens.items[0], { image: `${env.site.url}/favicon-512x512.png?a`, bouton: 'Visiter BioStudy', date: '2026-12-01' });
  });
  const p = await env.page({ chemin: '/#liens' });
  const premiere = p.locator('#vue .liens-une a.carte-lien >> nth=0');
  assert.equal(await premiere.getAttribute('href'), 'https://www.biostudy.xyz/');
  assert.equal(await premiere.getAttribute('target'), '_blank');
  assert.match(await premiere.getAttribute('rel'), /noopener/);
  assert.equal(await premiere.locator('img').getAttribute('src'), `${env.site.url}/favicon-512x512.png?a`);
  assert.equal(await premiere.locator('b').innerText(), 'BioStudy');
  assert.match(await premiere.locator('p').innerText(), /Plateforme fondée en 2022/);
  assert.equal(await premiere.locator('.btn').innerText(), 'Visiter BioStudy');
  assert.equal(await p.locator('#vue a.carte-lien >> nth=1 >> .btn').innerText(), 'Ouvrir');
});

test('replis des cartes', async () => {
  reinit((c) => { c.liens.items[1].description = ''; });
  const p = await env.page({ chemin: '/#parcours' });
  const interet = p.locator('#vue .carte-interet >> nth=0');
  assert.equal(await interet.locator('img').count(), 0);
  assert.equal(await interet.locator('.affiche-repli').count(), 1);
  assert.equal(await interet.locator('b').innerText(), 'Astronomie');
  await p.goto(env.site.url + '/#liens/projets');
  await p.waitForSelector('#vue .grille a.carte-lien');
  const sansImage = p.locator('#vue .grille a.carte-lien[href="https://www.biostudy.xyz/BioCampus/"]');
  assert.equal(await sansImage.locator('img').count(), 0);
  assert.equal(await sansImage.locator('.degrade').innerText(), 'biostudy.xyz');
  assert.equal(await sansImage.locator('p').count(), 0);
});

test('intérêt : image, titre et texte visibles sur la carte, sans fiche à ouvrir', async () => {
  reinit((c) => { c.parcours.interets[0].image = { id: 'x', url: '/favicon-512x512.png?astro' }; });
  const p = await env.page({ chemin: '/#parcours' });
  const carte = p.locator('#vue .carte-interet >> nth=0');
  assert.match(await carte.locator('img').getAttribute('src'), /\?astro$/);
  assert.equal(await carte.locator('b').innerText(), 'Astronomie');
  assert.match(await carte.locator('p').innerText(), /club d'astronomie[\s\S]*occultations/);
  assert.ok(await carte.locator('p').isVisible());
  /* texte entier, jamais coupé par des points de suspension */
  assert.ok(await carte.locator('p').evaluate((x) => x.scrollHeight <= x.clientHeight + 1 && getComputedStyle(x).webkitLineClamp === 'none'));
  assert.equal(await p.locator('#vue a.carte-interet').count(), 0);
  await p.goto(env.site.url + '/#parcours/interets/i1');
  await p.waitForFunction(() => location.hash === '#parcours/interets');
  assert.equal(await p.locator('#fiche:not([hidden])').count(), 0);
});

test('cartes sobres : pas de trait de couleur en haut ; compétences en texte simple, sans capsules', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours' });
  assert.equal(await p.$eval('#vue .rangee .carte-cert', (x) => getComputedStyle(x, '::before').content), 'none');
  assert.equal(await p.locator('#vue .tags').count(), 0);
  assert.equal(await p.innerText('#vue .carte-comp >> nth=0 >> p'), 'Colorations, Isolement, Milieux de culture et 2 autres');
  assert.equal(await p.innerText('#vue .carte-comp >> nth=4 >> p'), 'Bonnes pratiques de laboratoire, Biosécurité, Cultures microbiennes et 1 autre');
  await p.click('#vue .carte-comp >> nth=0');
  await ouverte(p);
  assert.equal(await p.locator('#ficheCorps .tags').count(), 0);
  assert.deepEqual(await titres(p, '#ficheCorps ul.techniques li'), ['Colorations', 'Isolement', 'Milieux de culture', "Tests d'identification", DEFAUT().parcours.competences[0].techniques[4]]);
});

test('langues : drapeau devant chaque langue, deviné ou choisi', async () => {
  reinit((c) => { c.parcours.langues[3].drapeau = 'us'; c.parcours.langues.push({ id: 'lx', langue: 'Japonais', niveau: 'Notions', drapeau: '', visible: true }); });
  const p = await env.page({ chemin: '/#parcours/langues' });
  const drapeaux = await p.$$eval('#vue .carte-langue', (xs) => xs.map((x) => [x.querySelector('b').textContent, x.querySelector('.drapeau') ? x.querySelector('.drapeau').dataset.drapeau : '']));
  assert.deepEqual(drapeaux, [['Français', 'fr'], ['Arabe', 'arabe'], ['Kabyle', 'amazigh'], ['Anglais', 'us'], ['Espagnol', 'es'], ['Japonais', '']]);
  assert.equal(await p.locator('#vue .carte-langue .drapeau svg').count(), 5);
  assert.equal(await p.getAttribute('#vue .carte-langue .drapeau >> nth=0', 'aria-hidden'), 'true');
  assert.notEqual(await p.$eval('#vue .carte-langue', (x) => getComputedStyle(x).borderRadius), '999px');
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

test('accueil : carrousel (domaines puis projet phare), salutation, compteurs, rangées d\'images', async () => {
  reinit();
  const p = await env.page();
  assert.deepEqual(await titres(p, '#vue .carrousel .diapo h2'), ['Microbiologie', 'Graphisme', 'Montage vidéo', 'BioStudy']);
  assert.equal(await p.getAttribute('#vue .carrousel .diapo >> nth=0 >> a.btn', 'href'), '#parcours/competences');
  assert.equal(await p.getAttribute('#vue .carrousel .diapo >> nth=3 >> a.btn', 'href'), 'https://www.biostudy.xyz/');
  assert.equal(await p.getAttribute('#vue .carrousel .diapo >> nth=3 >> a.btn', 'target'), '_blank');
  assert.equal(await p.locator('#vue .carrousel .points button').count(), 4);
  assert.equal(await p.getAttribute('#vue .carrousel .points button >> nth=0', 'aria-current'), 'true');
  await p.click('#vue .carrousel .points button >> nth=2');
  await p.waitForFunction(() => document.querySelector('#vue .carrousel .points button:nth-child(3)').getAttribute('aria-current') === 'true');
  assert.equal(await p.innerText('#vue h1'), 'Bonjour, je suis Amar');
  assert.match(await p.innerText('#vue .intro'), /Master 1 de microbiologie[\s\S]*BioStudy/);
  assert.equal(await p.locator('#vue .reperes li').count(), 3);
  assert.match(await p.innerText('#vue .reperes li >> nth=2'), /6 ans\s+de design freelance/);
  assert.deepEqual(await titres(p, '#vue .accueil .rangee-tete h2'), ['Ce que je fais', 'Projets', 'Certifications', 'Passions']);
  assert.equal(await p.getAttribute('#vue .rangee:has(h2:text-is("Certifications")) a.voir', 'href'), '#parcours/certifications');
  assert.equal(await p.locator('#vue .rangee:has(h2:text-is("Ce que je fais")) a.voir').count(), 0);
  assert.match(await p.innerText('#vue .carte-domaine >> nth=2'), /Montage vidéo[\s\S]*Vidéos courtes/);
  assert.equal(await p.getAttribute('#vue .accueil .acts a:has-text("Me contacter")', 'href'), '#contact');
});

test('accueil : carrousel qui défile seul (sauf mouvement réduit), compteurs qui comptent', async () => {
  reinit();
  let p = await env.page({ mouvementReduit: false });
  await p.waitForFunction(() => document.querySelector('#vue .carrousel .points button:nth-child(2)').getAttribute('aria-current') === 'true', null, { timeout: 8000 });
  await p.evaluate(() => document.querySelector('#vue .reperes').scrollIntoView());
  await p.waitForFunction(() => document.querySelector('#vue .reperes li:nth-child(3) b').textContent === '6 ans');
  p = await env.page();
  await p.waitForTimeout(6000);
  assert.equal(await p.getAttribute('#vue .carrousel .points button >> nth=0', 'aria-current'), 'true');
  assert.equal(await p.innerText('#vue .reperes li >> nth=2 >> b'), '6 ans');
});

test('accueil : domaine avec image, repère masqué, projet absent, listes vides → blocs absents', async () => {
  reinit((c) => { c.accueil.domaines[1].image = { id: 'g', url: '/favicon-512x512.png?g' }; c.accueil.reperes[2].visible = false; c.accueil.projetPhare = 'zzz'; });
  let p = await env.page();
  assert.equal(await p.getAttribute('#vue .carte-domaine >> nth=1 >> img', 'src'), '/favicon-512x512.png?g');
  assert.equal(await p.getAttribute('#vue .carrousel .diapo >> nth=1 >> img', 'src'), '/favicon-512x512.png?g');
  assert.equal(await p.locator('#vue .reperes li').count(), 2);
  assert.equal(await p.locator('#vue .carrousel .diapo').count(), 3);
  reinit((c) => { c.accueil.domaines = []; c.accueil.reperes = []; c.accueil.projetPhare = ''; });
  p = await env.page();
  assert.equal(await p.locator('#vue .carrousel').count(), 0);
  assert.equal(await p.locator('#vue .reperes').count(), 0);
  assert.deepEqual(await titres(p, '#vue .accueil .rangee-tete h2'), ['Projets', 'Certifications', 'Passions']);
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
  await p.evaluate(() => { location.hash = '#liens/projets'; });
  await p.waitForSelector('#vue .vt-voir');
  const [p1, b1] = await couleur('#vue .vt-voir');
  assert.equal(p1, b1);
  await p.evaluate(() => { location.hash = '#parcours/certifications'; });
  await p.waitForSelector('#vue .vt-voir');
  [pc, bleu, vert] = await couleur('#vue .vt-voir');
  assert.equal(pc, vert);
});

test('fiche : poignée et période à la couleur de la rubrique, Contact sans couleur de rubrique', async () => {
  reinit();
  const p = await env.page({ chemin: '/#parcours/certifications/k1' });
  await ouverte(p);
  const lire = () => p.evaluate(() => [getComputedStyle(document.getElementById('feuille')).getPropertyValue('--pc').trim(),
    getComputedStyle(document.documentElement).getPropertyValue('--c-green').trim(), getComputedStyle(document.documentElement).getPropertyValue('--c-blue').trim(),
    getComputedStyle(document.querySelector('#feuille .poignee')).backgroundColor]);
  let [pc, vert] = await lire();
  assert.equal(pc, vert);
  await p.keyboard.press('Escape');
  await p.evaluate(() => { location.hash = '#parcours/formation/f1'; });
  await ouverte(p);
  let bleu; [pc, , bleu] = await lire();
  assert.equal(pc, bleu);
  await p.keyboard.press('Escape');
  await p.click('#contactBtn');
  await ouverte(p);
  [pc] = await lire();
  assert.equal(pc, '');
});

test('lien sans image : pictogramme du type sur le dégradé de la catégorie, avec le domaine', async () => {
  reinit((c) => { Object.assign(c.liens.items[1], { url: 'https://www.youtube.com/watch?v=abc', image: '' }); });
  const p = await env.page({ chemin: '/#liens/projets' });
  const carte = p.locator('#vue a.carte-lien[href="https://www.youtube.com/watch?v=abc"]');
  assert.equal(await carte.getAttribute('data-type'), 'video');
  assert.equal(await carte.locator('.degrade svg.type-icone').count(), 1);
  assert.equal(await carte.locator('.degrade').innerText(), 'youtube.com');
  assert.equal(await carte.locator('.badge-type').count(), 0);
  assert.equal(await p.getAttribute('#vue a.carte-lien[href="https://www.biostudy.xyz/"]', 'data-type'), 'web');
});

test('lien avec image : badge du type ; type forcé dans l\'admin respecté', async () => {
  reinit((c) => { Object.assign(c.liens.items[0], { image: `${env.site.url}/favicon-512x512.png?a`, type: 'article' }); });
  const p = await env.page({ chemin: '/#liens' });
  const carte = p.locator('#vue a.carte-lien >> nth=0');
  assert.equal(await carte.getAttribute('data-type'), 'article');
  assert.equal(await carte.locator('.badge-type').innerText(), 'Article');
  assert.equal(await carte.locator('.badge-type svg.type-icone').count(), 1);
});

test('lien : image choisie (envoyée) prioritaire sur l\'aperçu automatique', async () => {
  reinit((c) => { Object.assign(c.liens.items[0], { image: 'https://exemple.fr/a.png', media: { id: 'm1', url: '/favicon-512x512.png?perso' } }); });
  const p = await env.page({ chemin: '/#liens' });
  assert.equal(await p.getAttribute('#vue a.carte-lien >> nth=0 >> img', 'src'), '/favicon-512x512.png?perso');
});

test('affiches : chaque certification, compétence et passion a un visuel (image, sinon affiche dessinée)', async () => {
  reinit((c) => { c.parcours.certifications[1].image = { id: 'k', url: '/favicon-512x512.png?cert' }; c.parcours.competences[0].image = { id: 'c', url: '/favicon-512x512.png?comp' }; });
  const p = await env.page({ chemin: '/#parcours' });
  const cert = (n) => `#vue .rangee:has(h2:text-is("Certifications")) .carte-cert >> nth=${n}`;
  assert.equal(await p.innerText(`${cert(0)} >> .visuel .affiche-repli`), 'Google');
  assert.match(await p.getAttribute(`${cert(1)} >> .visuel img`, 'src'), /\?cert$/);
  assert.match(await p.innerText(cert(0)), /Gestion de projet[\s\S]*2024-2025/);
  assert.match(await p.getAttribute('#vue .carte-comp >> nth=0 >> .visuel img', 'src'), /\?comp$/);
  assert.equal(await p.innerText('#vue .carte-comp >> nth=1 >> .visuel .affiche-repli'), 'Biologie moléculaire');
  assert.equal(await p.innerText('#vue .carte-interet >> nth=0 >> .visuel .affiche-repli'), 'Astronomie');
  assert.equal(await p.getAttribute('#vue .carte-interet >> nth=0 >> .visuel', 'aria-hidden'), 'true');
});

test('fiche façon Nuvio : bannière, description, « Détails » en lignes libellé / valeur, fond flouté', async () => {
  reinit((c) => { c.parcours.certifications[0].url = 'https://coursera.org/verify/ABC'; c.parcours.certifications[0].image = { id: 'k', url: '/favicon-512x512.png?cert' }; });
  const p = await env.page({ chemin: '/#parcours/experience/e1' });
  await ouverte(p);
  const details = () => p.$$eval('#ficheCorps dl.details > div', (xs) => xs.map((x) => [x.querySelector('dt').textContent, x.querySelector('dd').textContent]));
  assert.equal(await p.locator('#ficheCorps .fiche-banniere .visuel').count(), 1);
  assert.equal(await p.innerText('#ficheCorps h3'), 'Détails');
  assert.deepEqual(await details(), [['Lieu', "CHU Nedir Mohamed, Tizi-Ouzou"], ['Période', 'juin 2023 – août 2023'], ['Durée', '3 mois'], ['Statut', 'Terminé']]);
  assert.equal(await p.evaluate(() => document.getElementById('feuille').style.getPropertyValue('--fond')), '');
  await p.keyboard.press('Escape');
  await p.evaluate(() => { location.hash = '#parcours/certifications/k1'; });
  await ouverte(p);
  assert.deepEqual(await details(), [['Organisme', "Google · Coursera"], ['Année', "2024-2025"], ['Statut', 'Obtenu']]);
  assert.match(await p.getAttribute('#ficheCorps .fiche-banniere img', 'src'), /\?cert$/);
  assert.match(await p.evaluate(() => document.getElementById('feuille').style.getPropertyValue('--fond')), /^url\(".*\?cert"\)$/);
  assert.equal(await p.getAttribute('#ficheCorps a.btn:has-text("Voir le certificat")', 'href'), 'https://coursera.org/verify/ABC');
  await p.keyboard.press('Escape');
  await p.evaluate(() => { location.hash = '#parcours/formation/f1'; });
  await ouverte(p);
  assert.equal((await details()).find((d) => d[0] === 'Statut')[1], 'En cours');
});

test('liens façon Bibliothèque : carte résumé + liens à la une, une ligne par catégorie, récents en tuiles', async () => {
  reinit((c) => { c.liens.items[1].categorie = 'android'; c.liens.items[1].date = '2026-12-01'; });
  const p = await env.page({ chemin: '/#liens' });
  assert.match(await p.innerText('#vue .liens-une .carte-resume'), /Mes liens[\s\S]*9\s+liens partagés[\s\S]*8 projets · 1 applis android/i);
  assert.equal(await p.locator('#vue .liens-une a.carte-lien').count(), 3);
  assert.equal(await p.getAttribute('#vue .liens-une a.carte-lien >> nth=0', 'href'), 'https://www.biostudy.xyz/BioCampus/');
  const lignes = await p.$$eval('#vue .liste-categories a', (xs) => xs.map((x) => [x.querySelector('b').textContent, x.querySelector('small').textContent, x.getAttribute('href')]));
  assert.deepEqual(lignes, [['Projets', '8', '#liens/projets'], ['Applis Android', '1', '#liens/android']]);
  assert.equal(await p.locator('#vue .liste-categories a >> nth=0 >> svg').count() >= 1, true);
  assert.equal(await p.innerText('#vue .recents h2'), 'Récents');
  assert.equal(await p.getAttribute('#vue .recents a.tout', 'href'), '#liens/tous');
  assert.equal(await p.locator('#vue .recents a.tuile').count(), 9);
  assert.equal(await p.getAttribute('#vue .recents a.tuile >> nth=0', 'target'), '_blank');
  assert.equal(await p.innerText('#vue .recents a.tuile >> nth=0 >> b'), 'BioCampus');
  assert.equal(await p.locator('#vue .recents a.tuile >> nth=0 >> .tuile-visuel').count(), 1);
  await p.click('#vue .recents a.tout');
  await p.waitForFunction(() => location.hash === '#liens/tous');
  assert.equal(await p.innerText('#vue .vt-tete h1'), 'Tous les liens');
  assert.equal(await p.locator('#vue .grille > .carte-lien').count(), 9);
});
