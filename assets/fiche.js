/* Fiche : feuille en verre qui monte du bas, par-dessus la page.
   Se ferme par le bouton, Échap, un clic sur le fond ou un glisser vers le bas ; le focus revient à l'élément d'origine. */

import { RM } from './mouvement.js';
const $ = (id) => document.getElementById(id);
const etat = { ouverte: false, onFerme: null, retour: null, minuteur: 0 };

export const ficheOuverte = () => etat.ouverte;

export function ouvrirFiche({ titre, corps, retour = null, onFerme = null, couleur = null, fond = null }) {
  clearTimeout(etat.minuteur);
  /* image floutée derrière la feuille, comme les pages détail de Nuvio ; adresse déjà filtrée (http(s) ou /…) */
  if (fond) $('feuille').style.setProperty('--fond', `url("${String(fond).replace(/["\\\n\r]/g, encodeURIComponent)}")`);
  else $('feuille').style.removeProperty('--fond');
  /* couleur de la rubrique (poignée, période) ; aucune pour Contact */
  if (couleur) $('feuille').style.setProperty('--pc', `var(${couleur})`); else $('feuille').style.removeProperty('--pc');
  $('ficheTitre').textContent = titre;
  $('ficheCorps').replaceChildren(corps);
  $('ficheCorps').scrollTop = 0;
  etat.onFerme = onFerme;
  /* déjà ouverte (contenu rafraîchi) : on garde l'élément d'origine */
  if (!etat.ouverte) etat.retour = retour || (document.activeElement !== document.body ? document.activeElement : null);
  if (!etat.ouverte) {
    $('fiche').hidden = false;
    void $('fiche').offsetWidth; /* applique l'état de départ avant l'animation */
    $('fiche').classList.add('on');
  }
  etat.ouverte = true;
  $('ficheFermer').focus({ preventScroll: true });
}

/* silencieux : fermeture causée par la navigation (onFerme n'est pas appelé) */
export function fermerFiche({ silencieux = false } = {}) {
  if (!etat.ouverte) return;
  etat.ouverte = false;
  $('fiche').classList.remove('on');
  $('feuille').style.transform = '';
  etat.minuteur = setTimeout(() => { $('fiche').hidden = true; }, RM ? 0 : 320);
  const { retour, onFerme } = etat;
  /* la page a pu être redessinée sous la fiche : on retrouve l'élément d'origine par son lien */
  const href = retour && !retour.isConnected && retour.getAttribute && retour.getAttribute('href');
  const cible = retour && retour.isConnected ? retour : href ? document.querySelector(`#vue [href="${CSS.escape(href)}"]`) : null;
  if (cible) cible.focus({ preventScroll: true });
  if (!silencieux && onFerme) onFerme();
}

$('ficheFermer').addEventListener('click', () => fermerFiche());
$('fiche').addEventListener('click', (e) => { if (e.target === $('fiche')) fermerFiche(); });
addEventListener('keydown', (e) => {
  if (!etat.ouverte) return;
  if (e.key === 'Escape') { e.preventDefault(); fermerFiche(); return; }
  if (e.key !== 'Tab') return;
  /* le focus reste dans la feuille */
  const focusables = [...$('feuille').querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
  if (!focusables.length) return;
  const premier = focusables[0], dernier = focusables.at(-1);
  if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
  else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
});

/* glisser vers le bas depuis la poignée ou le titre */
let depart = null;
$('ficheTete').addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  depart = e.clientY;
  $('ficheTete').setPointerCapture(e.pointerId);
  $('feuille').style.transition = 'none';
});
$('ficheTete').addEventListener('pointermove', (e) => {
  if (depart === null) return;
  $('feuille').style.transform = `translateY(${Math.max(0, e.clientY - depart)}px)`;
});
const relacher = (e) => {
  if (depart === null) return;
  const dy = e.clientY - depart;
  depart = null;
  $('feuille').style.transition = '';
  if (dy > 80) fermerFiche(); else $('feuille').style.transform = '';
};
$('ficheTete').addEventListener('pointerup', relacher);
$('ficheTete').addEventListener('pointercancel', relacher);
