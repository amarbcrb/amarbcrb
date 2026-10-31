/* Démarrage du site : thème, contenu, maintenance, en-tête, barre d'onglets et vues. */
import { RM } from './mouvement.js';
import { chargerContenu, lireJeton, lirePortfolio, lireGalerie, appeler, ecrireJeton, memoriserContenu } from './api.js';
import { el } from './dom.js';
import { ongletsVisibles, contactVisible, parties, couleurPartie, ongletPerso } from './model.js';
import { parse, format } from './router.js';
import { monterBarre } from './nav.js';
import { rendreVue, couleurOnglet, reglerFleches } from './render.js';
import { construireIndex, chercher } from './search.js';
import { ouvrirFiche, fermerFiche, ficheOuverte } from './fiche.js';
import { corpsContact, corpsFiche, titreFiche, fondFiche } from './cartes.js';
import { apparitions } from './apparition.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
/* drive[onglet] : données Drive du Portfolio ou d'une galerie ; undefined tant qu'elles ne sont pas lues, null si le script est en panne */
/* base : page affichée sous une éventuelle fiche ; empilee : la fiche a sa propre entrée d'historique */
/* publie : contenu en ligne ; edition : mode édition ouvert (module chargé à la demande) */
const etat = { publie: null, edition: null, positions: {}, contenu: null, drive: {}, chargements: {}, barre: null, cleBarre: null, vue: null, base: null, cleBase: null, empilee: false, index: null };
const estDrive = (onglet) => onglet === 'portfolio' || (ongletPerso(etat.contenu, onglet) || {}).type === 'drive';
/* données Drive lues (ou vides) d'un onglet, pour le routeur et les rangées */
const donneesDrive = (onglet) => etat.drive[onglet] || (onglet === 'portfolio' ? [] : { dossiers: [], fichiers: [] });
const listeDossiers = () => (Array.isArray(etat.drive.portfolio) ? etat.drive.portfolio : []);
const enAttenteDrive = (onglet) => estDrive(onglet) && etat.drive[onglet] === undefined;

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
$('themeBtn').addEventListener('animationend', () => $('themeBtn').classList.remove('tourne'));
$('themeBtn').addEventListener('click', () => {
  if (!RM) $('themeBtn').classList.add('tourne');
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
  $('nomSite').textContent = String(c.site.nom).trim();
  $('logo').src = logo;
  $('contactBtn').hidden = !contactVisible(c);
  if (c.medias.favicon && c.medias.favicon.url) $('favicon').href = c.medias.favicon.url;
  const onglets = ongletsVisibles(c);
  /* onglets créés par Amar : nom, icône et couleur choisis dans l'admin */
  const infos = Object.fromEntries((c.onglets.perso || []).map((o) => [o.id, { libelle: o.nom, icone: o.icone, couleur: o.couleur }]));
  const cleBarre = JSON.stringify([onglets, onglets.map((id) => infos[id] || null)]);
  if (cleBarre !== etat.cleBarre) {
    if (etat.barre) etat.barre.detruire();
    etat.cleBarre = cleBarre;
    etat.barre = monterBarre({ conteneur: $('navHote'), onglets, infos, onSelect: aller, onRecherche: ouvrirRecherche });
  }
  reflet();
  return true;
}

/* ---------- Navigation ---------- */
function aller(onglet) {
  const cible = format(parse('#' + onglet, etat.contenu, donneesDrive));
  if (location.hash !== cible) history.pushState(null, '', cible);
  afficher();
}

/* ---------- Recherche ---------- */
const rech = { ouvert: false };
const indexer = () => { etat.index = construireIndex(etat.contenu, listeDossiers()); };
function afficherResultats() {
  const q = $('rechInput').value.trim();
  const res = q ? chercher(etat.index || [], q) : [];
  $('rechRes').replaceChildren(...res.map((r) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.cible = r.hash;
    const type = document.createElement('small');
    type.className = 'rech-type';
    type.textContent = r.type;
    const titre = document.createElement('b');
    titre.textContent = r.titre;
    b.append(type, titre);
    if (r.extrait) { const x = document.createElement('small'); x.textContent = r.extrait; b.append(x); }
    const li = document.createElement('li');
    li.append(b);
    return li;
  }));
  $('rechVide').hidden = !(q && !res.length);
  $('rechVide').textContent = `Aucun résultat pour « ${q} ».`;
}
function ouvrirRecherche() {
  if (!etat.index) indexer();
  rech.ouvert = true;
  $('recherche').hidden = false;
  $('rechInput').focus();
  $('rechInput').select();
  afficherResultats();
  chargerPortfolio().then(() => { indexer(); if (rech.ouvert) afficherResultats(); });
}
function fermerRecherche(rendreFocus = true) {
  rech.ouvert = false;
  $('recherche').hidden = true;
  if (rendreFocus && etat.barre) etat.barre.recherche.focus();
}
$('rechInput').addEventListener('input', afficherResultats);
$('rechFermer').addEventListener('click', () => fermerRecherche());
$('recherche').addEventListener('click', (e) => {
  if (e.target === $('recherche')) { fermerRecherche(); return; }
  const b = e.target.closest('[data-cible]');
  if (!b) return;
  fermerRecherche(false);
  if (location.hash !== b.dataset.cible) history.pushState(null, '', b.dataset.cible);
  afficher();
  $('vue').focus({ preventScroll: true });
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && rech.ouvert) fermerRecherche(); });

/* Portfolio et galeries : lus dans Drive à la première ouverture de leur onglet (ou de la recherche pour le portfolio) */
function chargerDrive(onglet, frais = false) {
  if (!etat.chargements[onglet]) {
    const perso = ongletPerso(etat.contenu, onglet);
    etat.chargements[onglet] = (onglet === 'portfolio' ? lirePortfolio({ frais }) : lireGalerie(perso.dossierId)).then((d) => {
      etat.drive[onglet] = d;
      if (etat.vue && etat.vue.onglet === onglet) { etat.cleBase = null; afficher(false); }
      return d;
    });
  }
  return etat.chargements[onglet];
}
const chargerPortfolio = () => chargerDrive('portfolio');

const cle = (cible) => (cible.contact ? '#contact' : format(cible));

/* page de l'onglet (ou Voir tout) ; elle n'est redessinée que si elle change, pour garder le focus sous une fiche */
function dessinerPage(base, anim) {
  etat.barre.select(base.onglet, anim);
  document.documentElement.style.setProperty('--halo', `var(${couleurOnglet(etat.contenu, base.onglet)})`);
  const k = format(base);
  if (k === etat.cleBase) return;
  const avant = etat.base;
  if (etat.cleBase) etat.positions[etat.cleBase] = scrollY;
  etat.base = base;
  etat.cleBase = k;
  const vue = $('vue');
  /* nouvelle page : en haut ; retour d'un Voir tout vers ses rangées : position d'avant ; même page redessinée : on ne bouge pas */
  const defiler = () => {
    if (avant && format(avant) === k) return;
    const versRangees = avant && avant.onglet === base.onglet && avant.sous !== null && base.sous === null;
    scrollTo({ top: versRangees ? etat.positions[k] || 0 : 0, behavior: 'instant' });
  };
  const dessiner = () => { rendreVue(vue, etat.contenu, base, etat.drive[base.onglet]); reflet(vue); apparitions(vue); reglerFleches(vue); defiler(); };
  if (!anim || RM || !avant || !vue.animate) { dessiner(); return; }
  const ordre = ongletsVisibles(etat.contenu);
  const sens = ordre.indexOf(base.onglet) >= ordre.indexOf(avant.onglet) ? 1 : -1;
  /* l'ancienne page glisse et se floute vers un côté, la nouvelle arrive de l'autre (View Transitions) ; sinon, entrée seule */
  if (document.startViewTransition) {
    const racine = document.documentElement;
    racine.dataset.sens = sens > 0 ? 'avant' : 'arriere';
    const n = (etat.transitions = (etat.transitions || 0) + 1);
    const t = document.startViewTransition(dessiner);
    t.finished.finally(() => { if (etat.transitions === n) delete racine.dataset.sens; });
    return;
  }
  dessiner();
  vue.animate([{ opacity: 0, transform: `translateX(${sens * 34}px)`, filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
    { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
}

/* fermeture par l'interface : retour arrière si la fiche a sa propre entrée, sinon on remplace l'adresse */
function ficheFermee() {
  if (etat.empilee) { etat.empilee = false; history.back(); return; }
  history.replaceState(null, '', format(etat.base));
  etat.vue = { ...etat.base, element: null, contact: false };
}

/* meme : la même fiche est déjà ouverte (contenu rafraîchi), son entrée d'historique ne change pas */
function surcouche(titre, corps, direct, meme, couleur = null, fond = null) {
  if (!meme) etat.empilee = !direct;
  ouvrirFiche({ titre, corps, onFerme: ficheFermee, couleur, fond });
}

function afficher(anim = true) {
  const c = etat.contenu;
  const cible = parse(location.hash, c, donneesDrive);
  const enAttente = enAttenteDrive(cible.onglet);
  if (enAttente) chargerDrive(cible.onglet);
  /* tant que les dossiers ne sont pas lus, on garde #portfolio/<dossier> tel quel */
  if (location.hash !== cle(cible) && !enAttente) history.replaceState(null, '', cle(cible));
  const direct = !etat.vue;
  const meme = ficheOuverte() && etat.vue && (etat.vue.element || etat.vue.contact) && cle(etat.vue) === cle(cible);
  etat.vue = cible;
  /* sous une fiche, on garde la page déjà affichée ; en arrivée directe, c'est le Voir tout de l'élément */
  const base = cible.contact ? (etat.base || { onglet: 'accueil', sous: null })
    : cible.element ? (etat.base || { onglet: cible.onglet, sous: cible.sous })
      : { onglet: cible.onglet, sous: cible.sous };
  dessinerPage(base, anim);
  const liste = cible.element ? parties(c, cible.onglet, donneesDrive(cible.onglet)) : [];
  const n = liste.findIndex((p) => p.id === cible.sous);
  const item = cible.element && liste[n].items.find((x) => x.id === cible.element);
  if (cible.contact) surcouche('Contact', corpsContact(c), direct, meme);
  else if (item) surcouche(titreFiche(item), corpsFiche(item, cible.sous, ongletPerso(c, cible.onglet), cible.onglet), direct, meme, couleurPartie(cible.onglet, cible.sous, n), fondFiche(item));
  else fermerFiche({ silencieux: true });
}

/* retour arrière, lien #… dans la page : ne redessine que si l'adresse affichée change */
function synchroniser() {
  if (!etat.contenu || $('shell').hidden) return;
  const cible = parse(location.hash, etat.contenu, donneesDrive);
  const k = cle(cible);
  if (!etat.vue || k !== cle(etat.vue)) afficher();
  /* adresse masquée ou inconnue qui mène à la page déjà affichée ; on attend Drive avant de corriger #portfolio/… */
  else if (location.hash !== k && !enAttenteDrive(cible.onglet)) history.replaceState(null, '', k);
}
addEventListener('popstate', synchroniser);
addEventListener('hashchange', synchroniser);

$('contactBtn').addEventListener('click', () => {
  if (location.hash !== '#contact') history.pushState(null, '', '#contact');
  afficher();
});

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
  const onglet = etat.base && etat.base.onglet;
  const d = parties(etat.contenu, onglet, donneesDrive(onglet)).find((x) => x.id === v.dataset.dossier);
  if (!d) return;
  const images = d.items.filter((f) => String(f.type).startsWith('image/'));
  ouvrirVisionneuse(images, Math.max(0, images.findIndex((f) => f.id === v.dataset.fichier)), v);
});

/* dossier protégé : le code de déverrouillage n'est chargé qu'au toucher du cadenas */
document.addEventListener('click', async (e) => {
  const v = e.target.closest('[data-protege]');
  if (!v || document.body.classList.contains('edition')) return;
  const titre = v.dataset.titre || '';
  (await import('./protege.js')).ouvrirProtege(v.dataset.protege, titre);
});

/* appui sur une carte : petite vibration là où elle existe */
document.addEventListener('pointerdown', (e) => { if (e.target.closest('.carte, .vignette')) { try { navigator.vibrate && navigator.vibrate(8); } catch { /* sans vibreur */ } } });

/* lien « Aller au contenu » : donne le focus à la vue sans changer d'adresse */
document.querySelector('.skip').addEventListener('click', (e) => { e.preventDefault(); $('vue').focus(); });

/* bouton Copier (Contact) */
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copier]');
  if (!b) return;
  const lien = /^https?:/.test(b.dataset.copier);
  try { await navigator.clipboard.writeText(b.dataset.copier); toast(lien ? 'Lien copié' : 'E-mail copié'); } catch { if (!lien) location.href = 'mailto:' + b.dataset.copier; }
});

/* ---------- Édition sur le site (propriétaire) ----------
   Appui long (1 s) sur le nom : connexion. Connecté : pastille « Modifier ». Le code d'édition n'est chargé qu'à ce moment. */
const majPastille = () => { $('modifier').hidden = !lireJeton() || !!etat.edition; };
const siteEdition = {
  publie: () => ({ contenu: etat.publie, version: etat.publie.version }),
  afficher(c) { etat.contenu = c; etat.index = null; etat.cleBase = null; if (appliquer(c)) afficher(false); },
  apresPublication(c) { etat.publie = c; memoriserContenu(c.version, c); },
  quitter() { etat.edition = null; siteEdition.afficher(etat.publie); majPastille(); },
  reconnexion() { majPastille(); },
  /* après une opération Drive (envoi, dossier, protection) : relit le dossier et redessine */
  async rechargerDrive(onglet) {
    delete etat.chargements[onglet];
    delete etat.drive[onglet];
    await chargerDrive(onglet, true);
    etat.cleBase = null;
    afficher(false);
  },
};
async function ouvrirEdition() {
  if (etat.edition || !etat.publie) return;
  const m = await import('./edition/index.js');
  etat.edition = m.activer(siteEdition);
  majPastille();
}
$('modifier').addEventListener('click', ouvrirEdition);

const ERREURS_CONNEXION = { mot_de_passe: 'Mot de passe incorrect.', bloque: 'Trop d\'essais. Réessaie dans 15 minutes.', reseau: 'Connexion impossible. Vérifie ta connexion internet.' };
function ouvrirConnexion() {
  if (lireJeton()) { ouvrirEdition(); return; }
  const champ = el('input', { type: 'password', id: 'mdpSite', autocomplete: 'current-password', required: true });
  const statut = el('p', { class: 'aide', role: 'status' });
  const bouton = el('button', { type: 'submit', class: 'btn pri' }, 'Se connecter');
  const form = el('form', { class: 'connexion-site' }, el('label', { for: 'mdpSite' }, 'Mot de passe'), champ, bouton, statut);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    bouton.disabled = true;
    statut.textContent = '';
    try {
      const r = await appeler('connexion', { motDePasse: champ.value });
      ecrireJeton(r.jeton, r.expire);
      fermerFiche({ silencieux: true });
      majPastille();
      toast('Connecté. Touche « Modifier » pour éditer le site.');
    } catch (err) {
      statut.textContent = ERREURS_CONNEXION[err.code] || 'Erreur, réessaie.';
    } finally {
      bouton.disabled = false;
    }
  });
  ouvrirFiche({ titre: 'Connexion', corps: form });
  champ.focus();
}

/* appui long sur le nom (souris, doigt, ou Entrée maintenue) ; un toucher court garde le lien vers l'Accueil */
(() => {
  const nom = document.querySelector('.brand');
  let minuteur = 0, long = false;
  const debut = () => { long = false; clearTimeout(minuteur); minuteur = setTimeout(() => { long = true; ouvrirConnexion(); }, 1000); };
  const fin = () => clearTimeout(minuteur);
  nom.addEventListener('pointerdown', debut);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => nom.addEventListener(t, fin));
  nom.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.repeat) debut(); });
  nom.addEventListener('keyup', (e) => { if (e.key === 'Enter') fin(); });
  nom.addEventListener('click', (e) => { if (long) { e.preventDefault(); long = false; } });
  nom.addEventListener('contextmenu', (e) => e.preventDefault());
})();

/* ---------- Démarrage ---------- */
async function demarrer() {
  const { contenu } = await chargerContenu((frais) => {
    etat.publie = frais;
    if (etat.edition) return; /* en édition, le brouillon reste affiché */
    etat.contenu = frais;
    etat.index = null;
    etat.cleBase = null;
    if (appliquer(frais)) afficher(false);
  });
  $('chargement').hidden = true;
  etat.publie = contenu;
  etat.contenu = contenu;
  if (appliquer(contenu)) afficher(false);
  majPastille();
}
demarrer();

addEventListener('resize', () => reglerFleches($('vue')), { passive: true });
