/* Démarrage du site : thème, contenu, maintenance, en-tête, barre d'onglets et vues. */
import { chargerContenu, lireJeton, lirePortfolio } from './api.js';
import { ongletsVisibles, ONGLETS } from './model.js';
import { parse, format } from './router.js';
import { monterBarre } from './nav.js';
import { rendreVue } from './render.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* dossiers : undefined tant que le portfolio n'est pas lu, null si le script est en panne */
const etat = { contenu: null, dossiers: undefined, chargementPortfolio: null, barre: null, cleBarre: '', vue: null };
const listeDossiers = () => (Array.isArray(etat.dossiers) ? etat.dossiers : []);

/* ---------- Thème ---------- */
const sv = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const SOLEIL = sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>');
const LUNE = sv('<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>');
function appliquerTheme(t) {
  root.dataset.theme = t;
  $('themeBtn').innerHTML = t === 'dark' ? SOLEIL : LUNE;
  $('metaTheme').content = t === 'dark' ? '#0d0d0d' : '#f5f5f7';
}
function themeMemorise() { try { return localStorage.getItem('ab-theme'); } catch { return null; } }
appliquerTheme(root.dataset.theme || 'dark');
$('themeBtn').addEventListener('click', () => {
  const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('ab-theme', t); } catch { /* navigation privée */ }
  appliquerTheme(t);
});
matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => { if (!themeMemorise()) appliquerTheme(e.matches ? 'light' : 'dark'); });

/* ---------- Reflet sous la souris ou le doigt ---------- */
export function reflet(racine = document) {
  racine.querySelectorAll('.box,.glass').forEach((el) => {
    if (el.dataset.fx) return;
    el.dataset.fx = '1';
    const viser = (e) => { const b = el.getBoundingClientRect(); el.style.setProperty('--mx', e.clientX - b.left + 'px'); el.style.setProperty('--my', e.clientY - b.top + 'px'); };
    el.addEventListener('pointerenter', (e) => { viser(e); el.classList.add('lit'); });
    el.addEventListener('pointermove', viser);
    el.addEventListener('pointerleave', () => el.classList.remove('lit'));
  });
}

/* ---------- Message éphémère ---------- */
let minuteurToast = 0;
export function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- En-tête, médias, maintenance, barre ---------- */
function appliquer(c) {
  const enMaintenance = c.site.maintenance.active && !lireJeton();
  const logo = (c.medias.logo && c.medias.logo.url) || '/favicon-512x512.png';
  $('maintenance').hidden = !enMaintenance;
  ['shell', 'navHote'].forEach((id) => { $(id).hidden = enMaintenance; });
  document.querySelector('.top').hidden = enMaintenance;
  $('bandeauAdmin').hidden = !(c.site.maintenance.active && !enMaintenance);
  if (enMaintenance) {
    $('maintenanceLogo').src = logo;
    $('maintenanceMsg').textContent = c.site.maintenance.message;
    $('maintenanceMail').textContent = c.contact.email;
    $('maintenanceMail').href = 'mailto:' + c.contact.email;
    return false;
  }
  $('nomSite').textContent = c.site.nom;
  $('surtitre').textContent = c.site.surtitre;
  $('logo').src = logo;
  if (c.medias.favicon && c.medias.favicon.url) $('favicon').href = c.medias.favicon.url;
  const onglets = ongletsVisibles(c);
  if (onglets.join() !== etat.cleBarre) {
    if (etat.barre) etat.barre.detruire();
    etat.cleBarre = onglets.join();
    etat.barre = monterBarre({ conteneur: $('navHote'), onglets, onSelect: aller, onRecherche: ouvrirRecherche });
  }
  reflet();
  return true;
}

/* ---------- Navigation ---------- */
function aller(onglet) {
  const cible = format(parse('#' + onglet, etat.contenu, listeDossiers()));
  if (location.hash !== cible) history.pushState(null, '', cible);
  afficher();
}

function ouvrirRecherche() {}

/* le portfolio n'est lu dans Drive qu'à la première ouverture de l'onglet (ou de la recherche) */
function chargerPortfolio() {
  if (!etat.chargementPortfolio) {
    etat.chargementPortfolio = lirePortfolio().then((d) => {
      etat.dossiers = d;
      if (etat.vue && etat.vue.onglet === 'portfolio') afficher(false);
      return d;
    });
  }
  return etat.chargementPortfolio;
}

function afficher(anim = true) {
  const c = etat.contenu;
  const cible = parse(location.hash, c, listeDossiers());
  const enAttente = cible.onglet === 'portfolio' && etat.dossiers === undefined;
  if (enAttente) chargerPortfolio();
  const canonique = format(cible);
  /* tant que les dossiers ne sont pas lus, on garde #portfolio/<dossier> tel quel */
  if (location.hash !== canonique && !enAttente) history.replaceState(null, '', canonique);
  const avant = etat.vue;
  etat.vue = cible;
  etat.barre.select(cible.onglet, anim);
  const vue = $('vue');
  const dessiner = () => { rendreVue(vue, c, cible, etat.dossiers); reflet(vue); };
  const changeOnglet = avant && avant.onglet !== cible.onglet;
  if (!anim || RM || !avant || !vue.animate) { dessiner(); return; }
  const sens = ONGLETS.indexOf(cible.onglet) >= ONGLETS.indexOf(avant.onglet) ? 1 : -1;
  dessiner();
  if (changeOnglet) scrollTo(0, 0);
  vue.animate([{ opacity: 0, transform: `translateX(${sens * 34}px)`, filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
    { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
}

/* retour arrière, lien #… dans la page : ne redessine que si la partie affichée change */
function synchroniser() {
  if (!etat.contenu || $('shell').hidden) return;
  if (!etat.vue || format(parse(location.hash, etat.contenu, listeDossiers())) !== format(etat.vue)) afficher();
}
addEventListener('popstate', synchroniser);
addEventListener('hashchange', synchroniser);

/* ---------- Visionneuse des images du portfolio ---------- */
const lb = { liste: [], i: 0, retour: null };
const grandeImage = (url) => String(url).replace(/([?&]sz=)w\d+/, '$1w2000');
function montrerImage() {
  const f = lb.liste[lb.i];
  const image = $('lb').querySelector('img');
  image.src = grandeImage(f.apercu);
  image.alt = f.nom.replace(/\.[^.]+$/, '');
  $('lbCount').textContent = `${lb.i + 1} / ${lb.liste.length}`;
  $('lbPrev').disabled = lb.liste.length < 2;
  $('lbNext').disabled = lb.liste.length < 2;
}
function ouvrirVisionneuse(liste, i, retour) {
  Object.assign(lb, { liste, i, retour });
  montrerImage();
  $('lb').classList.add('on');
  $('lbClose').focus();
}
function fermerVisionneuse() {
  $('lb').classList.remove('on');
  if (lb.retour) lb.retour.focus();
}
const deplacer = (pas) => { lb.i = (lb.i + pas + lb.liste.length) % lb.liste.length; montrerImage(); };
$('lbClose').addEventListener('click', fermerVisionneuse);
$('lbPrev').addEventListener('click', () => deplacer(-1));
$('lbNext').addEventListener('click', () => deplacer(1));
$('lb').addEventListener('click', (e) => { if (e.target === $('lb')) fermerVisionneuse(); });
addEventListener('keydown', (e) => {
  if (!$('lb').classList.contains('on')) return;
  if (e.key === 'Escape') fermerVisionneuse();
  else if (e.key === 'ArrowRight') deplacer(1);
  else if (e.key === 'ArrowLeft') deplacer(-1);
});
document.addEventListener('click', (e) => {
  const v = e.target.closest('.vignette[data-dossier]');
  if (!v) return;
  const d = listeDossiers().find((x) => x.id === v.dataset.dossier);
  if (d) ouvrirVisionneuse(d.fichiers.filter((f) => String(f.type).startsWith('image/')), Number(v.dataset.i), v);
});

/* bouton Copier (Contact) */
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copier]');
  if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copier); toast('E-mail copié'); } catch { location.href = 'mailto:' + b.dataset.copier; }
});

/* ---------- Démarrage ---------- */
async function demarrer() {
  const { contenu } = await chargerContenu((frais) => {
    etat.contenu = frais;
    if (appliquer(frais)) afficher(false);
  });
  $('chargement').hidden = true;
  etat.contenu = contenu;
  if (appliquer(contenu)) afficher(false);
}
demarrer();
