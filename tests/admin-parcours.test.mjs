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
  const premier = await site.locator('#vue .ti').first().innerText();
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
  assert.match(await site.locator('#vue .ti.now').first().innerText(), /juin 2023 – aujourd'hui/);
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
  const noms = await site.$$eval('.sous-onglets [role="tab"]', (xs) => xs.map((x) => x.textContent));
  assert.ok(!noms.includes('Intérêts'));
  assert.deepEqual(p.erreurs, []);
});
