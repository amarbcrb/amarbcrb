/* Pages du site : Accueil, page de rangées d'un onglet, page « Voir tout » d'une partie.
   Tout texte venant du contenu passe par el() (assets/dom.js). */
import { parties, contactVisible, formationActuelle, derniereExperience, periode } from './model.js';
import { format } from './router.js';
import { COULEURS } from './nav.js';
import { el } from './dom.js';
import { carte } from './cartes.js';

const TITRES = { accueil: 'Accueil', parcours: 'Parcours', portfolio: 'Portfolio', liens: 'Liens' };
const VIDES = { parcours: 'Parcours bientôt disponible.', liens: 'Aucun lien pour le moment.', portfolio: 'Portfolio bientôt disponible.' };
const MAX_RANGEE = 10;
const ICONES = {
  suite: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  retour: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
};
const nElements = (n) => `${n} élément${n > 1 ? 's' : ''}`;

/* rangée horizontale : titre, nombre, bouton › vers Voir tout, au plus 10 cartes puis « Voir tout (N) » */
export function rangee({ titre, nombre, href, cartes, indice = 0 }) {
  const piste = el('div', { class: 'piste' }, cartes.slice(0, MAX_RANGEE),
    cartes.length > MAX_RANGEE ? el('a', { class: 'carte carte-plus', href }, `Voir tout (${cartes.length})`) : null);
  const fleche = (sens, libelle) => {
    const b = el('button', { type: 'button', class: `piste-fleche ${sens}`, 'aria-label': libelle, html: sens === 'avant' ? ICONES.suite : ICONES.retour });
    b.addEventListener('click', () => piste.scrollBy({ left: (sens === 'avant' ? 1 : -1) * piste.clientWidth * 0.9, behavior: 'smooth' }));
    return b;
  };
  return el('section', { class: 'rangee', style: `--i:${indice}` },
    el('div', { class: 'rangee-tete' }, el('h2', {}, titre), el('small', {}, String(nombre)),
      el('a', { class: 'voir', href, 'aria-label': `Voir tout : ${titre}`, html: ICONES.suite })),
    el('div', { class: 'piste-cadre' }, fleche('arriere', `Précédent : ${titre}`), piste, fleche('avant', `Suivant : ${titre}`)));
}

/* ---------- Accueil ---------- */
function vueAccueil(c) {
  const visibles = parties(c, 'parcours').map((p) => p.id);
  const f = formationActuelle(c), e = derniereExperience(c), comp = c.accueil.competencesCles;
  const grande = (libelle, titre, detail, href) => el(href ? 'a' : 'div', { class: 'carte carte-accueil', href },
    el('span', { class: 'lbl' }, libelle), el('b', {}, titre), detail ? el('small', {}, detail) : null);
  const fiche = (partie, x) => (visibles.includes(partie) ? format({ onglet: 'parcours', sous: partie, element: x.id }) : null);
  const cartes = [
    f && grande('Formation actuelle', f.titre, [f.lieu, periode(f)].filter(Boolean).join(' · '), fiche('formation', f)),
    e && grande('Dernière expérience', e.titre, [e.lieu, periode(e)].filter(Boolean).join(' · '), fiche('experience', e)),
    comp.length && grande('Compétences clés', comp.join(' · '), '', visibles.includes('competences') ? '#parcours/competences' : null),
  ].filter(Boolean);
  const cv = c.medias.cv && c.medias.cv.url;
  const contact = contactVisible(c);
  return el('section', { class: 'vt accueil' },
    el('p', { class: 'lbl' }, c.site.surtitre),
    el('h1', {}, c.accueil.positionnement || c.site.nom),
    c.accueil.situation ? el('p', { class: 'situation' }, c.accueil.situation) : null,
    cartes.length ? el('div', { class: 'piste rangee-accueil' }, cartes) : null,
    (cv || contact) ? el('div', { class: 'acts' },
      cv ? el('a', { class: 'btn pri', href: cv, download: c.medias.cv.nom || 'CV.pdf', target: '_blank', rel: 'noopener' }, 'Télécharger mon CV') : null,
      contact ? el('a', { class: cv ? 'btn' : 'btn pri', href: '#contact' }, 'Me contacter') : null) : null);
}

/* ---------- Profil (en tête de Parcours) ---------- */
function profil(c) {
  const { titre, texte } = c.parcours.profil;
  if (!String(texte || '').trim()) return null;
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
function voirTout(onglet, p, c) {
  return el('section', { class: `vt vt-voir v-${onglet}`, style: `--tc:var(${COULEURS[onglet]})` },
    el('header', { class: 'vt-tete' },
      el('a', { class: 'retour', href: format({ onglet }), 'aria-label': 'Retour', html: ICONES.retour }),
      el('h1', {}, p.titre), el('small', {}, nElements(p.items.length))),
    el('div', { class: `grille grille-${onglet === 'parcours' ? p.id : onglet}` }, p.items.map((x, i) => carte(x, { onglet, partie: p.id, c, indice: i }))));
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
  const p = sous ? liste.find((x) => x.id === sous) : null;
  if (p) { racine.replaceChildren(voirTout(onglet, p, c)); return; }
  const rangees = liste.map((x, i) => rangee({ titre: x.titre, nombre: x.items.length, href: format({ onglet, sous: x.id }), indice: i + 1,
    cartes: x.items.map((item, k) => carte(item, { onglet, partie: x.id, c, indice: k })) }));
  racine.replaceChildren(el('section', { class: `vt v-${onglet}`, style: `--tc:var(${COULEURS[onglet]})` }, el('h1', {}, TITRES[onglet]),
    onglet === 'parcours' ? profil(c) : null,
    rangees.length ? rangees : el('p', { class: 'vide' }, VIDES[onglet])));
}
