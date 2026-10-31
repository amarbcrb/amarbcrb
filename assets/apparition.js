/* Apparition au défilement pour les navigateurs sans animation liée au défilement (le CSS s'en charge sinon) :
   les blocs glissent du côté en se défloutant quand ils entrent à l'écran. */
import { RM } from './mouvement.js';
const CSS_SUFFIT = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timeline: view()');
const SELECTEUR = '.rangee, .profil, .reperes, .carrousel, .grille > *';

const temoin = !RM && !CSS_SUFFIT && 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('vu'); temoin.unobserve(e.target); }
}), { rootMargin: '0px 0px -6% 0px' }) : null;

export function apparitions(racine) {
  if (!temoin || !racine) return;
  racine.querySelectorAll(SELECTEUR).forEach((x) => {
    if (x.classList.contains('apparition')) return;
    x.classList.add('apparition');
    temoin.observe(x);
  });
}
