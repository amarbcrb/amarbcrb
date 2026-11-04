/* Pages du site : Accueil, page de rangées d'un onglet, page « Voir tout » d'une partie.
   Tout texte venant du contenu passe par el() (assets/dom.js). */
import { parties, contactVisible, couleurPartie, periode, ongletsVisibles, lienSur, ongletPerso } from './model.js';
import { format } from './router.js';
import { COULEURS } from './nav.js';
import { el } from './dom.js';
import { carte, carteDomaine, typeDominant, iconeType, mediaLien } from './cartes.js';
import { carrousel } from './carrousel.js';
import { visuel, urlMedia } from './media.js';


const TITRES = { accueil: 'Accueil', parcours: 'Parcours', portfolio: 'Portfolio', liens: 'Plus' };
const VIDES = { parcours: 'Parcours bientôt disponible.', liens: 'Aucune ressource pour le moment.', portfolio: 'Portfolio bientôt disponible.' };
const MAX_RANGEE = 10;
const MAX_FRISE = 4;
/* rubriques datées affichées en frise chronologique plutôt qu'en rangée de cartes */
const FRISES = ['formation', 'experience'];
const ICONES = {
  suite: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  retour: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  lien: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
};
const nElements = (n) => `${n} élément${n > 1 ? 's' : ''}`;

/* rangée horizontale : titre, nombre, bouton › vers Voir tout (si href), au plus 10 cartes puis « Voir tout (N) » */
/* liste : chemin de la liste affichée (édition : « + Ajouter ») ; editTitre : chemin du titre modifiable */
export function rangee({ titre, nombre, href = null, cartes, indice = 0, couleur = '--c-blue', liste = null, editTitre = null, attrs = {} }) {
  const piste = el('div', { class: 'piste' }, cartes.slice(0, MAX_RANGEE),
    cartes.length > MAX_RANGEE && href ? el('a', { class: 'carte carte-plus', href }, `Voir tout (${cartes.length})`) : null);
  const fleche = (sens, libelle) => {
    const b = el('button', { type: 'button', class: `piste-fleche ${sens}`, 'aria-label': libelle, html: sens === 'avant' ? ICONES.suite : ICONES.retour });
    b.addEventListener('click', () => piste.scrollBy({ left: (sens === 'avant' ? 1 : -1) * piste.clientWidth * 0.9, behavior: 'smooth' }));
    return b;
  };
  /* flèches (PC) sous les cartes : elles n'en cachent jamais une */
  return el('section', { ...attrs, class: ['rangee', attrs.class].filter(Boolean).join(' '), style: `--i:${indice};--pc:var(${couleur})`, 'data-liste': liste, 'data-vide': cartes.length || !(String(liste).startsWith('pages.') || attrs['data-vide'] === '') ? null : '' }, teteRangee(titre, nombre, href, editTitre),
    el('div', { class: 'piste-cadre' }, piste), el('div', { class: 'fleches' }, fleche('arriere', `Précédent : ${titre}`), fleche('avant', `Suivant : ${titre}`)));
}

/* flèches seulement quand il y a des cartes à faire défiler */
export function reglerFleches(racine) {
  racine.querySelectorAll('.rangee').forEach((r) => {
    const piste = r.querySelector('.piste'), f = r.querySelector(':scope > .fleches');
    if (piste && f) f.hidden = piste.scrollWidth <= piste.clientWidth + 2;
  });
}

const teteRangee = (titre, nombre, href, editTitre = null) => el('div', { class: 'rangee-tete' }, el('h2', { 'data-edit': editTitre }, titre), nombre === null ? null : el('small', {}, String(nombre)),
  href ? el('a', { class: 'voir', href, 'aria-label': `Voir tout : ${titre}`, html: `Tout voir${ICONES.suite}` }) : null);

/* frise chronologique : un point par étape (plein si en cours), période, titre, lieu ; chaque étape ouvre sa fiche */
export function frise(items, partie) {
  return el('ol', { class: 'frise' }, items.map((x, k) => el('li', { class: 'etape', style: `--k:${Math.min(k, 12)}`, 'data-element': `parcours.${partie}#${x.id}` },
    el('a', { class: 'etape', href: format({ onglet: 'parcours', sous: partie, element: x.id }) },
      el('span', { class: x.enCours ? 'point actif' : 'point', 'aria-hidden': 'true' }),
      periode(x) ? el('small', { class: 'periode' }, periode(x)) : null, el('b', {}, x.titre),
      x.lieu ? el('span', { class: 'lieu' }, x.lieu) : null, x.enCours ? el('span', { class: 'en-cours' }, 'En cours') : null))));
}

function rangeeFrise({ titre, href, items, partie, indice, couleur, editTitre = null }) {
  return el('section', { class: 'rangee rangee-frise', style: `--i:${indice};--pc:var(${couleur})`, 'data-liste': `parcours.${partie}` }, teteRangee(titre, items.length, href, editTitre),
    frise(items.slice(0, MAX_FRISE), partie),
    items.length > MAX_FRISE ? el('a', { class: 'frise-plus', href }, `Voir tout (${items.length})`) : null);
}

/* ---------- Accueil ---------- */
function vueAccueil(c) {
  const a = c.accueil;
  const visibles = (l) => l.filter((x) => x.visible !== false);
  const reperes = visibles(a.reperes), domaines = visibles(a.domaines);
  const projet = a.projetPhare && c.liens.items.find((x) => x.id === a.projetPhare && x.visible !== false);
  const onglets = ongletsVisibles(c);
  const diapos = [
    ...domaines.map((x) => ({ titre: x.titre, texte: x.texte, image: x.image, lien: x.lien, externe: lienSur(x.lien) })),
    projet && { titre: projet.titre, texte: projet.description, image: mediaLien(projet),
      lien: projet.url, externe: true, bouton: projet.bouton || 'Ouvrir' },
  ].filter(Boolean);
  /* rangées d'images : ce que je fais, projets, à lire */
  const parLiens = onglets.includes('liens') ? parties(c, 'liens') : [];
  /* partages « À lire » : à part, les 3 plus récents */
  const liens = parLiens.filter((p) => p.id !== 'tous' && p.id !== 'alire').flatMap((p) => p.items.map((x) => [x, p.id]));
  /* parties() les range déjà du plus récent au plus ancien */
  const alire = (parLiens.find((p) => p.id === 'alire') || {}).items || [];
  const rangees = [
    domaines.length && rangee({ titre: 'Ce que je fais', nombre: null, cartes: domaines.map((x, i) => carteDomaine(x, i)), couleur: '--c-teal', liste: 'accueil.domaines' }),
    liens.length && rangee({ titre: 'Projets', nombre: liens.length, href: '#liens', couleur: '--c-pink',
      cartes: liens.map(([x, cat], k) => carte(x, { onglet: 'liens', partie: cat, c, indice: k })) }),
    alire.length && rangee({ titre: 'À lire', nombre: alire.length, href: format({ onglet: 'liens', sous: 'alire' }), couleur: '--c-blue',
      cartes: alire.slice(0, 3).map((x, k) => carte(x, { onglet: 'liens', partie: 'alire', c, indice: k })) }),
    /* certifications et passions : seulement dans Parcours (pas de répétition sur l'Accueil) */
  ].filter(Boolean);
  const cv = c.medias.cv && c.medias.cv.url;
  const contact = contactVisible(c);
  /* d'abord qui je suis et où aller, puis le carrousel, les repères et les rangées */
  const parcoursVisible = onglets.includes('parcours');
  const actions = [
    parcoursVisible && el('a', { class: 'btn pri', href: '#parcours' }, 'Voir mon parcours'),
    contact && el('a', { class: parcoursVisible ? 'btn' : 'btn pri', href: '#contact' }, 'Me contacter'),
    cv && el('a', { class: parcoursVisible || contact ? 'btn' : 'btn pri', href: cv, download: c.medias.cv.nom || 'CV.pdf', target: '_blank', rel: 'noopener' }, 'Télécharger mon CV'),
  ].filter(Boolean);
  return el('section', { class: 'vt accueil' },
    el('h1', { class: 'salut', 'data-edit': 'accueil.salutation', 'data-repli': a.salutation ? null : c.site.nom }, a.salutation || c.site.nom),
    a.intro ? el('p', { class: 'intro', 'data-edit': 'accueil.intro', 'data-multiligne': '' }, a.intro) : null,
    actions.length ? el('div', { class: 'acts' }, actions) : null,
    diapos.length ? carrousel(diapos) : null,
    reperes.length ? el('ul', { class: 'reperes', 'data-liste': 'accueil.reperes' }, reperes.map((x) => el('li', { 'data-element': `accueil.reperes#${x.id}`, class: urlMedia(x.image) ? 'avec-image' : null },
      urlMedia(x.image) ? visuel(x.image, { classe: 'visuel repere-visuel' }) : null,
      el('div', { class: 'repere-texte' }, el('b', {}, x.valeur), el('span', {}, x.libelle)),
      lienSur(x.lien) || /^#/.test(x.lien || '') ? el('a', { class: 'btn repere-btn', href: x.lien, target: lienSur(x.lien) ? '_blank' : null, rel: lienSur(x.lien) ? 'noopener' : null }, x.bouton || 'Voir') : null))) : null,
    rangees);
}


/* ---------- Profil (en tête de Parcours) ---------- */
/* profil en accordéon façon Apple : une partie par paragraphe, une seule ouverte à la fois.
   Titre de chaque partie : une ligne « ## Mon titre » en tête du paragraphe, sinon sa première phrase. */
export function partiesProfil(texte) {
  return String(texte || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = /^##\s*(.+)\n([\s\S]*)$/.exec(x) || /^##\s*(.+)$/.exec(x);
    if (m) return { titre: m[1].trim(), corps: (m[2] || '').trim() };
    const phrase = /^(.{12,110}?[.!?:])(\s+|$)([\s\S]*)$/.exec(x);
    if (phrase && phrase[3].trim()) return { titre: phrase[1].replace(/[.:]$/, ''), corps: phrase[3].trim() };
    return { titre: x.split(/\s+/).slice(0, 7).join(' ') + '…', corps: x };
  });
}
function profil(c) {
  const { titre, texte } = c.parcours.profil;
  const reglage = c.onglets.parcours.sous.profil;
  if ((reglage && reglage.visible === false) || !String(texte || '').trim()) return null;
  const paragraphes = texte.split(/\n\s*\n/).filter((x) => x.trim()).map((x) => el('p', {}, x.trim()));
  /* texte brut : modifié sur place en mode Modifier (caché aux visiteurs) */
  const corps = el('div', { class: 'profil-texte', id: 'profilTexte', 'data-edit': 'parcours.profil.texte', 'data-multiligne': '' }, paragraphes);
  const accordeon = el('div', { class: 'accordeon' }, partiesProfil(texte).map((p, i) => el('details', { name: 'profil', open: i === 0 ? '' : null },
    el('summary', {}, el('span', {}, p.titre), el('i', { 'aria-hidden': 'true', html: ICONES.suite })),
    el('div', { class: 'accordeon-corps' }, p.corps.split(/\n/).filter((l) => l.trim()).map((l) => el('p', {}, l.trim()))))));
  return el('div', { class: 'profil' }, titre ? el('h2', { 'data-edit': 'parcours.profil.titre' }, titre) : null, accordeon, corps);
}

/* ---------- Voir tout ---------- */
/* dossier Drive : grandes vignettes, petites vignettes ou liste ; le choix est gardé sur l'appareil */
const VUES = [
  { id: 'grand', libelle: 'Grandes vignettes', icone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>' },
  { id: 'petit', libelle: 'Petites vignettes', icone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="4.5" height="4.5" rx="1"/><rect x="9.75" y="3" width="4.5" height="4.5" rx="1"/><rect x="16.5" y="3" width="4.5" height="4.5" rx="1"/><rect x="3" y="9.75" width="4.5" height="4.5" rx="1"/><rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1"/><rect x="16.5" y="9.75" width="4.5" height="4.5" rx="1"/><rect x="3" y="16.5" width="4.5" height="4.5" rx="1"/><rect x="9.75" y="16.5" width="4.5" height="4.5" rx="1"/><rect x="16.5" y="16.5" width="4.5" height="4.5" rx="1"/></svg>' },
  { id: 'liste', libelle: 'Liste', icone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="5" height="5" rx="1"/><rect x="3" y="15" width="5" height="5" rx="1"/><path d="M11 6.5h10M11 17.5h10"/></svg>' },
];
const vueFichiers = () => { let v = null; try { v = localStorage.getItem('ab-vue-fichiers'); } catch { /* stockage bloqué */ } return VUES.some((x) => x.id === v) ? v : 'grand'; };
const choixVue = (actuelle) => el('div', { class: 'choix-vue', role: 'group', 'aria-label': 'Affichage des fichiers' },
  VUES.map((v) => el('button', { type: 'button', 'data-vue': v.id, 'aria-pressed': String(v.id === actuelle), 'aria-label': v.libelle, title: v.libelle, html: v.icone })));

function voirTout(onglet, p, c, couleur) {
  const perso = ongletPerso(c, onglet);
  const fichiers = onglet === 'portfolio' || (perso && perso.type === 'drive');
  const vue = fichiers ? vueFichiers() : null;
  const contenu = onglet === 'parcours' && FRISES.includes(p.id) ? frise(p.items, p.id)
    : el('div', { class: `grille grille-${onglet === 'parcours' ? p.id : onglet}${fichiers ? ' grille-fichiers' : ''}`, 'data-vue': vue, 'data-liste': listeDe(c, onglet, p.id) }, p.items.map((x, i) => carte(x, { onglet, partie: p.id, c, indice: i })));
  return el('section', { class: `vt vt-voir v-${onglet}`, style: `--tc:var(${couleurOnglet(c, onglet)});--pc:var(${couleur})` },
    el('header', { class: 'vt-tete' },
      el('a', { class: 'retour', href: format({ onglet }), 'aria-label': 'Retour', html: ICONES.retour }),
      el('h1', {}, p.titre), el('small', {}, nElements(p.items.length)), fichiers ? choixVue(vue) : null), contenu);
}

/* ---------- Liens, façon Bibliothèque ---------- */
function vueLiens(c, liste) {
  const cats = liste.filter((p) => p.id !== 'tous');
  const section = (...enfants) => el('section', { class: 'vt v-liens', style: `--tc:var(${COULEURS.liens})` }, enTete(c, 'liens'), enfants);
  /* catégories encore vides : visibles seulement en mode Modifier (on peut y ajouter une ressource) */
  const vides = c.liens.categories.filter((x) => x.visible !== false && !cats.some((p) => p.id === x.id)).map((x) => ({ id: x.id, titre: x.nom, items: [], vide: true }));
  const toutes = [...cats, ...vides];
  const couleur = (cat) => couleurPartie('liens', cat, Math.max(0, toutes.findIndex((p) => p.id === cat)));
  /* gestion des catégories (ajouter, renommer, supprimer, ordre) : mode Modifier seulement */
  const listeCats = el('ul', { class: 'liste-categories', 'data-liste': 'liens.categories' }, toutes.map((p) => el('li', { 'data-vide': p.vide ? '' : null }, el('a', { class: 'ligne-cat', href: format({ onglet: 'liens', sous: p.id }), style: `--pc:var(${couleur(p.id)})`, 'data-element': `liens.categories#${p.id}` },
    el('span', { class: 'ico', html: iconeType(typeDominant(p.items, c)) }), el('b', {}, p.titre), el('small', {}, String(p.items.length)), el('i', { html: ICONES.suite })))));
  /* une rangée par catégorie, avec « + Ajouter » qui range la nouvelle ressource dans cette catégorie */
  const rangees = toutes.map((p, i) => rangee({ titre: p.titre, nombre: p.items.length, href: p.items.length ? format({ onglet: 'liens', sous: p.id }) : null, indice: i, couleur: couleur(p.id),
    liste: 'liens.items', editTitre: `liens.categories#${p.id}.nom`, attrs: { 'data-categorie': p.id, 'data-vide': p.items.length ? null : '' },
    cartes: p.items.map((x, k) => carte(x, { onglet: 'liens', partie: p.id, c, indice: k })) }));
  return section(!cats.length ? el('p', { class: 'vide' }, VIDES.liens) : null, ...rangees, el('h2', { class: 'titre-categories' }, 'Catégories'), listeCats);
}

/* édition : chemin de la liste d'une partie, et chemin de son titre modifiable */
function listeDe(c, onglet, partie) {
  if (onglet === 'parcours') return `parcours.${partie}`;
  if (onglet === 'liens') return 'liens.items';
  const perso = ongletPerso(c, onglet);
  return perso && perso.type === 'rangees' ? `pages.${onglet}.rangees#${partie}.cartes` : null;
}
function titreModifiable(c, onglet, partie) {
  if (onglet === 'parcours') return `onglets.parcours.sous.${partie}.titre`;
  const perso = ongletPerso(c, onglet);
  return perso && perso.type === 'rangees' ? `pages.${onglet}.rangees#${partie}.titre` : null;
}

/* dossier protégé par mot de passe : carte cadenas (les visiteurs l'ouvrent avec le mot de passe) */
const VERROU = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const carteVerrou = (p) => el('button', { type: 'button', class: 'vignette doc verrou', 'data-protege': p.id, 'data-titre': p.titre, 'aria-label': `Ouvrir le dossier protégé ${p.titre}` },
  el('i', { html: VERROU }), el('b', {}, 'Dossier protégé'), el('small', {}, 'Mot de passe requis'));
/* lien ajouté à un dossier Drive */
const carteLienDossier = (l) => el('a', { class: 'vignette doc lien-dossier', href: l.url, target: '_blank', rel: 'noopener noreferrer' },
  el('i', { html: ICONES.lien }), el('b', {}, l.titre), el('small', {}, (() => { try { return new URL(l.url).hostname.replace(/^www\./, ''); } catch { return ''; } })()));

/* titre et couleur d'un onglet, intégré ou créé dans l'admin */
const titreOnglet = (c, onglet) => TITRES[onglet] || (ongletPerso(c, onglet) || {}).nom || '';
/* titre de l'onglet et phrase qui dit ce qu'on y trouve (modifiable sur place ; vide : masquée hors mode Modifier) */
function enTete(c, onglet) {
  const perso = ongletPerso(c, onglet);
  const chemin = perso ? `onglets.perso#${perso.id}.sousTitre` : `onglets.${onglet}.sousTitre`;
  const texte = (perso ? perso.sousTitre : (c.onglets[onglet] || {}).sousTitre) || '';
  return [el('h1', {}, titreOnglet(c, onglet)), el('p', { class: 'sous-titre', 'data-edit': chemin, 'data-vide': 'Une phrase qui dit ce qu\'on trouve ici' }, texte)];
}
/* formes grises qui annoncent les rangées pendant que les dossiers Drive arrivent */
const squelette = () => el('div', { class: 'squelette', 'aria-busy': 'true', 'aria-label': 'Chargement' },
  [0, 1].map(() => el('div', { class: 'sq-rangee' }, el('span', { class: 'sq sq-barre' }),
    el('div', { class: 'sq-piste' }, [0, 1, 2, 3].map(() => el('span', { class: 'sq sq-carte' }))))));
export const couleurOnglet = (c, onglet) => COULEURS[onglet] || ((ongletPerso(c, onglet) || {}).couleur || '').replace(/[^\w-]/g, '') || '--c-purple';

/* dossiers : données Drive (portfolio, galerie), null si le script est en panne, undefined tant qu'elles ne sont pas lues */
export function rendreVue(racine, c, { onglet, sous }, dossiers) {
  if (onglet === 'accueil') { racine.replaceChildren(vueAccueil(c)); return; }
  const perso = ongletPerso(c, onglet);
  const drive = onglet === 'portfolio' || (perso && perso.type === 'drive');
  if (drive && (dossiers === undefined || dossiers === null)) {
    racine.replaceChildren(el('section', { class: 'vt' }, enTete(c, onglet),
      dossiers === null ? el('p', { class: 'vide' }, `${titreOnglet(c, onglet)} momentanément indisponible.`) : squelette()));
    return;
  }
  if (drive && dossiers && dossiers.protege) {
    /* galerie Drive entièrement protégée : un seul cadenas (rangée marquée pour les outils du mode Modifier : liens, protection) */
    const verrou = rangee({ titre: 'Dossier protégé', href: format({ onglet }), indice: 1, couleur: couleurPartie(onglet, 'racine', 0), nombre: '🔒',
      cartes: [carteVerrou({ id: perso.dossierId, titre: perso.nom })], attrs: { 'data-dossier': perso.dossierId, class: 'protege' } });
    racine.replaceChildren(el('section', { class: `vt v-${onglet}`, style: `--tc:var(${couleurOnglet(c, onglet)})`, 'data-drive-racine': perso.dossierId, 'data-drive-onglet': onglet },
      enTete(c, onglet), verrou));
    return;
  }
  const liste = parties(c, onglet, dossiers || (perso ? { dossiers: [], fichiers: [] } : []));
  const racineDrive = drive ? (onglet === 'portfolio' ? (dossiers && dossiers.racine) || '' : perso.dossierId) : null;
  const n = sous ? liste.findIndex((x) => x.id === sous) : -1;
  if (n >= 0) { racine.replaceChildren(voirTout(onglet, liste[n], c, couleurPartie(onglet, sous, n))); return; }
  if (onglet === 'liens') { racine.replaceChildren(vueLiens(c, liste)); return; }
  const rangees = liste.map((x, i) => {
    const commun = { titre: x.titre, href: format({ onglet, sous: x.id }), indice: i + 1, couleur: couleurPartie(onglet, x.id, i) };
    const marques = { liste: listeDe(c, onglet, x.id), editTitre: titreModifiable(c, onglet, x.id) };
    if (drive) {
      /* dossier Drive : id (édition), cadenas s'il est protégé, liens du dossier après ses fichiers */
      const cartes = x.protege ? [carteVerrou(x)] : [...x.items.map((item, k) => carte(item, { onglet, partie: x.id, c, indice: k })), ...(x.liens || []).map(carteLienDossier)];
      return rangee({ ...commun, nombre: x.protege ? '🔒' : x.items.length, cartes,
        /* racine d'une galerie vide : rangée gardée pour y envoyer le premier fichier, masquée aux visiteurs */
        attrs: { 'data-dossier': x.id === 'racine' ? racineDrive : x.id, 'data-nom': x.nom || null, class: x.protege ? 'protege' : null,
          'data-vide': x.id === 'racine' && !x.items.length && !(x.liens || []).length ? '' : null } });
    }
    if (onglet === 'parcours' && FRISES.includes(x.id)) return rangeeFrise({ ...commun, ...marques, items: x.items, partie: x.id });
    return rangee({ ...commun, ...marques, nombre: x.items.length, cartes: x.items.map((item, k) => carte(item, { onglet, partie: x.id, c, indice: k })) });
  });
  const rangeesLibres = perso && perso.type === 'rangees' ? `pages.${onglet}.rangees` : null;
  racine.replaceChildren(el('section', { class: `vt v-${onglet}`, style: `--tc:var(${couleurOnglet(c, onglet)})`, 'data-liste': rangeesLibres, 'data-drive-racine': drive ? racineDrive : null, 'data-drive-onglet': drive ? onglet : null }, enTete(c, onglet),
    onglet === 'parcours' ? profil(c) : null,
    rangees.length ? rangees : el('p', { class: 'vide' }, VIDES[onglet] || 'Bientôt disponible.')));
}
