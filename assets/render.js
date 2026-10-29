/* Pages du site : Accueil, page de rangées d'un onglet, page « Voir tout » d'une partie.
   Tout texte venant du contenu passe par el() (assets/dom.js). */
import { parties, contactVisible, couleurPartie, periode, ongletsVisibles, lienSur } from './model.js';
import { format } from './router.js';
import { COULEURS } from './nav.js';
import { el } from './dom.js';
import { carte, carteDomaine } from './cartes.js';
import { carrousel } from './carrousel.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

const TITRES = { accueil: 'Accueil', parcours: 'Parcours', portfolio: 'Portfolio', liens: 'Liens' };
const VIDES = { parcours: 'Parcours bientôt disponible.', liens: 'Aucun lien pour le moment.', portfolio: 'Portfolio bientôt disponible.' };
const MAX_RANGEE = 10;
const MAX_FRISE = 4;
/* rubriques datées affichées en frise chronologique plutôt qu'en rangée de cartes */
const FRISES = ['formation', 'experience'];
const ICONES = {
  suite: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  retour: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
};
const nElements = (n) => `${n} élément${n > 1 ? 's' : ''}`;

/* rangée horizontale : titre, nombre, bouton › vers Voir tout (si href), au plus 10 cartes puis « Voir tout (N) » */
export function rangee({ titre, nombre, href = null, cartes, indice = 0, couleur = '--c-blue' }) {
  const piste = el('div', { class: 'piste' }, cartes.slice(0, MAX_RANGEE),
    cartes.length > MAX_RANGEE && href ? el('a', { class: 'carte carte-plus', href }, `Voir tout (${cartes.length})`) : null);
  const fleche = (sens, libelle) => {
    const b = el('button', { type: 'button', class: `piste-fleche ${sens}`, 'aria-label': libelle, html: sens === 'avant' ? ICONES.suite : ICONES.retour });
    b.addEventListener('click', () => piste.scrollBy({ left: (sens === 'avant' ? 1 : -1) * piste.clientWidth * 0.9, behavior: 'smooth' }));
    return b;
  };
  return el('section', { class: 'rangee', style: `--i:${indice};--pc:var(${couleur})` }, teteRangee(titre, nombre, href),
    el('div', { class: 'piste-cadre' }, fleche('arriere', `Précédent : ${titre}`), piste, fleche('avant', `Suivant : ${titre}`)));
}

const teteRangee = (titre, nombre, href) => el('div', { class: 'rangee-tete' }, el('h2', {}, titre), nombre === null ? null : el('small', {}, String(nombre)),
  href ? el('a', { class: 'voir', href, 'aria-label': `Voir tout : ${titre}`, html: ICONES.suite }) : null);

/* frise chronologique : un point par étape (qui pulse si en cours), période, titre, lieu ; chaque étape ouvre sa fiche */
export function frise(items, partie) {
  return el('ol', { class: 'frise' }, items.map((x, k) => el('li', { class: 'etape', style: `--k:${Math.min(k, 12)}` },
    el('a', { class: 'etape', href: format({ onglet: 'parcours', sous: partie, element: x.id }) },
      el('span', { class: x.enCours ? 'point actif' : 'point', 'aria-hidden': 'true' }),
      periode(x) ? el('small', { class: 'periode' }, periode(x)) : null, el('b', {}, x.titre),
      x.lieu ? el('span', { class: 'lieu' }, x.lieu) : null, x.enCours ? el('span', { class: 'en-cours' }, 'En cours') : null))));
}

function rangeeFrise({ titre, href, items, partie, indice, couleur }) {
  return el('section', { class: 'rangee rangee-frise', style: `--i:${indice};--pc:var(${couleur})` }, teteRangee(titre, items.length, href),
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
  const image = (x) => (x && (lienSur(x.url) || /^\/(?!\/)/.test(String(x.url))) ? x.url : null);
  const diapos = [
    ...domaines.map((x) => ({ titre: x.titre, texte: x.texte, image: image(x.image), lien: x.lien, externe: lienSur(x.lien) })),
    projet && { titre: projet.titre, texte: projet.description, image: image(projet.media) || (lienSur(projet.image) ? projet.image : null),
      lien: projet.url, externe: true, bouton: projet.bouton || 'Ouvrir' },
  ].filter(Boolean);
  /* rangées d'images : ce que je fais, projets, certifications, passions */
  const parcours = onglets.includes('parcours') ? parties(c, 'parcours') : [];
  const partie = (id) => parcours.find((p) => p.id === id);
  const liens = onglets.includes('liens') ? parties(c, 'liens').flatMap((p) => p.items.map((x) => [x, p.id])) : [];
  const rangees = [
    domaines.length && rangee({ titre: 'Ce que je fais', nombre: null, cartes: domaines.map((x, i) => carteDomaine(x, i)), couleur: '--c-teal' }),
    liens.length && rangee({ titre: 'Projets', nombre: liens.length, href: '#liens', couleur: '--c-pink',
      cartes: liens.map(([x, cat], k) => carte(x, { onglet: 'liens', partie: cat, c, indice: k })) }),
    ...[['certifications', 'Certifications'], ['interets', 'Passions']].map(([id, titre]) => partie(id) && rangee({
      titre, nombre: partie(id).items.length, href: format({ onglet: 'parcours', sous: id }), couleur: couleurPartie('parcours', id, 0),
      cartes: partie(id).items.map((x, k) => carte(x, { onglet: 'parcours', partie: id, c, indice: k })) })),
  ].filter(Boolean);
  const cv = c.medias.cv && c.medias.cv.url;
  const contact = contactVisible(c);
  return el('section', { class: 'vt accueil' },
    diapos.length ? carrousel(diapos) : null,
    el('h1', { class: 'salut' }, a.salutation || c.site.nom),
    a.intro ? el('p', { class: 'intro' }, a.intro) : null,
    reperes.length ? el('ul', { class: 'reperes' }, reperes.map((x) => el('li', {}, compteur(x.valeur), el('span', {}, x.libelle)))) : null,
    (cv || contact) ? el('div', { class: 'acts' },
      contact ? el('a', { class: 'btn pri', href: '#contact' }, 'Me contacter') : null,
      cv ? el('a', { class: contact ? 'btn' : 'btn pri', href: cv, download: c.medias.cv.nom || 'CV.pdf', target: '_blank', rel: 'noopener' }, 'Télécharger mon CV') : null) : null,
    rangees);
}

/* chiffre d'un repère : compte de 0 à sa valeur quand il apparaît (« 6 ans », « 18 ») ; texte final dès le départ */
function compteur(valeur) {
  const b = el('b', {}, valeur);
  const m = /^(\d{1,3})(\D.*)?$/.exec(String(valeur).trim());
  if (!m || RM || !('IntersectionObserver' in window)) return b;
  const fin = Number(m[1]), suite = m[2] || '';
  const vu = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    vu.disconnect();
    const debut = performance.now();
    const pas = (t) => {
      const k = Math.min(1, (t - debut) / 900);
      b.textContent = `${Math.round(fin * (1 - (1 - k) ** 3))}${suite}`;
      if (k < 1) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  }, { threshold: 0.6 });
  vu.observe(b);
  return b;
}

/* ---------- Profil (en tête de Parcours) ---------- */
function profil(c) {
  const { titre, texte } = c.parcours.profil;
  const reglage = c.onglets.parcours.sous.profil;
  if ((reglage && reglage.visible === false) || !String(texte || '').trim()) return null;
  const paragraphes = texte.split(/\n\s*\n/).filter((x) => x.trim()).map((x) => el('p', {}, x.trim()));
  const corps = el('div', { class: 'profil-texte', id: 'profilTexte' }, paragraphes);
  const long = paragraphes.length > 1 || texte.length > 220;
  const bouton = long ? el('button', { type: 'button', class: 'lire', 'aria-expanded': 'false', 'aria-controls': 'profilTexte' }, 'Lire la suite') : null;
  if (bouton) {
    corps.classList.add('replie');
    bouton.addEventListener('click', () => {
      const ouvert = corps.classList.toggle('replie') === false;
      bouton.setAttribute('aria-expanded', String(ouvert));
      bouton.textContent = ouvert ? 'Réduire' : 'Lire la suite';
    });
  }
  return el('div', { class: 'profil' }, titre ? el('h2', {}, titre) : null, corps, bouton);
}

/* ---------- Voir tout ---------- */
function voirTout(onglet, p, c, couleur) {
  const contenu = onglet === 'parcours' && FRISES.includes(p.id) ? frise(p.items, p.id)
    : el('div', { class: `grille grille-${onglet === 'parcours' ? p.id : onglet}` }, p.items.map((x, i) => carte(x, { onglet, partie: p.id, c, indice: i })));
  return el('section', { class: `vt vt-voir v-${onglet}`, style: `--tc:var(${COULEURS[onglet]});--pc:var(${couleur})` },
    el('header', { class: 'vt-tete' },
      el('a', { class: 'retour', href: format({ onglet }), 'aria-label': 'Retour', html: ICONES.retour }),
      el('h1', {}, p.titre), el('small', {}, nElements(p.items.length))), contenu);
}

/* dossiers : liste Drive, null si le script est en panne, undefined tant qu'elle n'est pas chargée */
export function rendreVue(racine, c, { onglet, sous }, dossiers) {
  if (onglet === 'accueil') { racine.replaceChildren(vueAccueil(c)); return; }
  if (onglet === 'portfolio' && !Array.isArray(dossiers)) {
    racine.replaceChildren(el('section', { class: 'vt' }, el('h1', {}, TITRES.portfolio),
      el('p', { class: 'vide' }, dossiers === null ? 'Portfolio momentanément indisponible.' : 'Chargement du portfolio…')));
    return;
  }
  const liste = parties(c, onglet, dossiers || []);
  const n = sous ? liste.findIndex((x) => x.id === sous) : -1;
  if (n >= 0) { racine.replaceChildren(voirTout(onglet, liste[n], c, couleurPartie(onglet, sous, n))); return; }
  const rangees = liste.map((x, i) => {
    const commun = { titre: x.titre, href: format({ onglet, sous: x.id }), indice: i + 1, couleur: couleurPartie(onglet, x.id, i) };
    if (onglet === 'parcours' && FRISES.includes(x.id)) return rangeeFrise({ ...commun, items: x.items, partie: x.id });
    return rangee({ ...commun, nombre: x.items.length, cartes: x.items.map((item, k) => carte(item, { onglet, partie: x.id, c, indice: k })) });
  });
  racine.replaceChildren(el('section', { class: `vt v-${onglet}`, style: `--tc:var(${COULEURS[onglet]})` }, el('h1', {}, TITRES[onglet]),
    onglet === 'parcours' ? profil(c) : null,
    rangees.length ? rangees : el('p', { class: 'vide' }, VIDES[onglet])));
}
