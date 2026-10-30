import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demarrer } from './helpers.mjs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const jeton = JSON.stringify({ jeton: 'jeton-' + (Date.now() + 864e5), expire: Date.now() + 864e5 });

let env;
before(async () => { env = await demarrer(); });
after(async () => { await env.fermer(); });
const reinit = () => { const c = DEFAUT(); Object.assign(env.faux.etat, { contenu: c, version: c.version }); };
const champ = (chemin) => `[data-chemin="${chemin}"]`;
async function parcours() {
  const p = await env.page({ chemin: '/admin/', stockage: { 'ab-jeton': jeton } });
  await p.click('.ecrans [data-ecran="parcours"]');
  await p.waitForSelector('[data-bloc="experience"]');
  return p;
}
async function enregistrer(p) {
  await p.click('#enregistrer');
  await p.waitForSelector('#etat:has-text("Enregistré")');
}

test('ajouter une expérience avec dates → visible sur le site dans Parcours › Expérience', async () => {
  reinit();
  const p = await parcours();
  await p.click('[data-bloc="experience"] .ajouter');
  await p.fill(champ('parcours.experience.5.titre'), 'Stage contrôle qualité');
  await p.fill(champ('parcours.experience.5.lieu'), 'Laboratoire X, Lyon');
  await p.fill(champ('parcours.experience.5.debut'), '2026-04');
  await p.fill(champ('parcours.experience.5.fin'), '2026-07');
  await enregistrer(p);
  const site = await env.page({ chemin: '/#parcours/experience' });
  const premier = await site.locator('#vue .frise > .etape').first().innerText();
  assert.match(premier, /avril 2026 – juillet 2026[\s\S]*Stage contrôle qualité[\s\S]*Laboratoire X, Lyon/);
});

test('en cours coché → fin vide, période "… – aujourd\'hui"', async () => {
  reinit();
  const p = await parcours();
  await p.click('[data-bloc="experience"] li >> nth=0 >> .modifier');
  await p.check(champ('parcours.experience.0.enCours'));
  assert.equal(await p.isDisabled(champ('parcours.experience.0.fin')), true);
  assert.equal(await p.inputValue(champ('parcours.experience.0.fin')), '');
  await enregistrer(p);
  assert.equal(env.faux.etat.contenu.parcours.experience[0].fin, null);
  const site = await env.page({ chemin: '/#parcours/experience' });
  assert.match(await site.locator('#vue .etape:has(.en-cours)').first().innerText(), /juin 2023 – aujourd'hui/);
});

test('fin avant début → erreur, Enregistrer désactivé', async () => {
  reinit();
  const p = await parcours();
  await p.click('[data-bloc="formation"] li >> nth=1 >> .modifier');
  await p.fill(champ('parcours.formation.1.fin'), '2020');
  await p.waitForSelector('[data-erreur="parcours.formation.1.fin"]:not(:empty)');
  assert.equal(await p.innerText('[data-erreur="parcours.formation.1.fin"]'), 'La fin doit être après le début');
  assert.equal(await p.isDisabled('#enregistrer'), true);
});

test('réordonner avec ↑ → ordre enregistré', async () => {
  reinit();
  const p = await parcours();
  await p.click('[data-bloc="langues"] li >> nth=3 >> .monter');
  const ordre = await p.$$eval('[data-bloc="langues"] li .resume b', (xs) => xs.map((x) => x.textContent));
  assert.deepEqual(ordre, ['Français', 'Arabe', 'Anglais', 'Kabyle', 'Espagnol']);
  assert.equal(await p.isDisabled('[data-bloc="langues"] li >> nth=0 >> .monter'), true);
  await enregistrer(p);
  assert.deepEqual(env.faux.etat.contenu.parcours.langues.map((l) => l.langue), ['Français', 'Arabe', 'Anglais', 'Kabyle', 'Espagnol']);
});

test('supprimer demande confirmation', async () => {
  reinit();
  const p = await parcours();
  p.once('dialog', (d) => d.dismiss());
  await p.click('[data-bloc="interets"] li >> nth=0 >> .supprimer');
  assert.equal(await p.locator('[data-bloc="interets"] li').count(), 3);
  p.once('dialog', (d) => { assert.match(d.message(), /Astronomie/); d.accept(); });
  await p.click('[data-bloc="interets"] li >> nth=0 >> .supprimer');
  assert.equal(await p.locator('[data-bloc="interets"] li').count(), 2);
  await enregistrer(p);
  assert.deepEqual(env.faux.etat.contenu.parcours.interets.map((x) => x.titre), ['Cartomagie', 'Design']);
});

test('masquer un élément → absent du site et de la recherche', async () => {
  reinit();
  const p = await parcours();
  await p.uncheck(champ('parcours.langues.2.visible'));
  await enregistrer(p);
  const site = await env.page({ chemin: '/#parcours/langues' });
  assert.doesNotMatch(await site.innerText('#vue'), /Kabyle/);
  await site.click('.nav-search');
  await site.fill('#rechInput', 'kabyle');
  await site.waitForSelector('#rechVide', { state: 'visible' });
});

test('langue : drapeau choisi dans l\'admin → affiché sur le site', async () => {
  reinit();
  const p = await parcours();
  await p.click('[data-bloc="langues"] li >> nth=3 >> .modifier');
  assert.deepEqual(await p.$$eval(`${champ('parcours.langues.3.drapeau')} option`, (xs) => xs.map((x) => x.value)), ['', 'fr', 'arabe', 'amazigh', 'gb', 'us', 'es', 'dz', 'de', 'it']);
  await p.selectOption(champ('parcours.langues.3.drapeau'), 'us');
  await enregistrer(p);
  assert.equal(env.faux.etat.contenu.parcours.langues[3].drapeau, 'us');
  const site = await env.page({ chemin: '/#parcours/langues' });
  assert.equal(await site.getAttribute('#vue .carte-langue >> nth=3 >> .drapeau', 'data-drapeau'), 'us');
});

test('profil : titre et texte modifiables', async () => {
  reinit();
  const p = await parcours();
  await p.fill(champ('parcours.profil.titre'), 'Mon profil');
  await p.fill(champ('parcours.profil.texte'), 'Premier paragraphe.\n\nSecond paragraphe.');
  await enregistrer(p);
  const site = await env.page({ chemin: '/#parcours/profil' });
  assert.equal(await site.innerText('#vue .profil h2'), 'Mon profil');
  assert.equal(await site.locator('#vue .profil p').count(), 2);
});

test('interrupteur de sous-onglet (ex. Intérêts) → absent du site', async () => {
  reinit();
  const p = await parcours();
  await p.uncheck(`[data-bloc="interets"] ${champ('onglets.parcours.sous.interets.visible')}`);
  await enregistrer(p);
  const site = await env.page({ chemin: '/#parcours' });
  const noms = await site.$$eval('#vue .rangee .rangee-tete h2', (xs) => xs.map((x) => x.textContent));
  assert.ok(!noms.includes('Intérêts'));
  assert.deepEqual(p.erreurs, []);
});

test('certificat : lien saisi → bouton Voir le certificat sur le site', async () => {
  reinit();
  const p = await parcours();
  await p.click('[data-bloc="certifications"] li >> nth=0 >> .modifier');
  await p.fill(champ('parcours.certifications.0.url'), 'https://coursera.org/verify/ABC');
  await enregistrer(p);
  const site = await env.page({ chemin: '/#parcours/certifications' });
  assert.equal(await site.getAttribute('#vue .grille > .carte >> nth=0 >> a.btn', 'href'), 'https://coursera.org/verify/ABC');
});

test('url de certificat invalide → erreur, Enregistrer désactivé', async () => {
  reinit();
  const p = await parcours();
  await p.click('[data-bloc="certifications"] li >> nth=0 >> .modifier');
  await p.fill(champ('parcours.certifications.0.url'), 'pas une url');
  await p.waitForSelector('[data-erreur="parcours.certifications.0.url"]:not(:empty)');
  assert.equal(await p.isDisabled('#enregistrer'), true);
});

async function png(p, l, h) {
  const b64 = await p.evaluate(([l, h]) => { const c = document.createElement('canvas'); c.width = l; c.height = h; c.getContext('2d').fillRect(0, 0, l, h); return c.toDataURL('image/png').split(',')[1]; }, [l, h]);
  return Buffer.from(b64, 'base64');
}

test('intérêt : envoyer une image → aperçu, enregistrer → carte image sur le site', async () => {
  reinit();
  const p = await parcours();
  await p.click('[data-bloc="interets"] li >> nth=0 >> .modifier');
  await p.setInputFiles('[data-media="image-parcours.interets.0"]', { name: 'astro.png', mimeType: 'image/png', buffer: await png(p, 2400, 1600) });
  await p.waitForSelector('[data-apercu="image-parcours.interets.0"][src*="/media/"]');
  assert.equal(env.faux.etat.medias.image.type, 'image/jpeg');
  const url = await p.getAttribute('[data-apercu="image-parcours.interets.0"]', 'src');
  await enregistrer(p);
  assert.equal(env.faux.etat.contenu.parcours.interets[0].image.url, url);
  const site = await env.page({ chemin: '/#parcours' });
  assert.equal(await site.getAttribute('#vue .carte-interet >> nth=0 >> img', 'src'), url);
  const taille = await site.evaluate((u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth); i.src = u; }), url);
  assert.equal(taille, 1600);
});

test('intérêt : retirer l\'image → repli dégradé', async () => {
  reinit();
  env.faux.etat.contenu.parcours.interets[0].image = { id: 'x', url: '/favicon-512x512.png?astro' };
  const p = await parcours();
  await p.click('[data-bloc="interets"] li >> nth=0 >> .modifier');
  await p.click('[data-bloc="interets"] .champ-media button:has-text("Retirer")');
  await enregistrer(p);
  assert.equal(env.faux.etat.contenu.parcours.interets[0].image, null);
  const site = await env.page({ chemin: '/#parcours' });
  assert.equal(await site.locator('#vue .carte-interet >> nth=0 >> img').count(), 0);
  assert.deepEqual(p.erreurs, []);
});

test('certification et compétence : image envoyée → visuel sur le site', async () => {
  reinit();
  const p = await parcours();
  await p.click('[data-bloc="certifications"] li >> nth=0 >> .modifier');
  await p.setInputFiles('[data-media="image-parcours.certifications.0"]', { name: 'c.png', mimeType: 'image/png', buffer: await png(p, 800, 1200) });
  await p.waitForSelector('[data-apercu="image-parcours.certifications.0"][src*="/media/"]');
  await p.click('[data-bloc="competences"] li >> nth=0 >> .modifier');
  await p.setInputFiles('[data-media="image-parcours.competences.0"]', { name: 'm.png', mimeType: 'image/png', buffer: await png(p, 1200, 800) });
  await p.waitForSelector('[data-apercu="image-parcours.competences.0"][src*="/media/"]');
  await enregistrer(p);
  const c = env.faux.etat.contenu.parcours;
  const site = await env.page({ chemin: '/#parcours' });
  assert.equal(await site.getAttribute('#vue .carte-cert >> nth=0 >> .visuel img', 'src'), c.certifications[0].image.url);
  assert.equal(await site.getAttribute('#vue .carte-comp >> nth=0 >> .visuel img', 'src'), c.competences[0].image.url);
  assert.deepEqual(p.erreurs, []);
});
