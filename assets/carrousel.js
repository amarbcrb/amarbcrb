/* Carrousel « À la une » de l'Accueil : grandes bannières glissables, points, défilement automatique toutes les 5 s.
   Le défilement s'arrête quand le doigt, la souris ou le focus est dedans, quand l'onglet est caché,
   et n'existe pas si l'utilisateur a demandé moins d'animations. */
import { el } from './dom.js';
import { visuel, urlMedia } from './media.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DELAI = 5000;
/* fond de repli de chaque diapo tant qu'elle n'a pas d'image */
const TEINTES = [['--c-teal', '--c-blue'], ['--c-purple', '--c-pink'], ['--c-orange', '--c-red'], ['--c-blue', '--c-indigo'], ['--c-green', '--c-teal']];

/* diapos : [{ titre, texte, image, lien, externe, bouton }] */
export function carrousel(diapos) {
  const n = diapos.length;
  const piste = el('div', { class: 'carrousel-piste' }, diapos.map((d, i) => el('article', {
    class: 'diapo', 'aria-roledescription': 'diapositive', 'aria-label': `${i + 1} sur ${n}`,
    style: `--dc:var(${TEINTES[i % TEINTES.length][0]});--dc2:var(${TEINTES[i % TEINTES.length][1]})`,
  },
  urlMedia(d.image) ? visuel(d.image, { classe: 'visuel diapo-visuel', prioritaire: i === 0, repli: () => '' }) : null,
  el('div', { class: 'diapo-texte' }, el('h2', {}, d.titre), d.texte ? el('p', {}, d.texte) : null,
    d.lien ? el('a', { class: 'btn pri', href: d.lien, target: d.externe ? '_blank' : null, rel: d.externe ? 'noopener' : null }, d.bouton || 'Découvrir') : null))));
  const points = el('div', { class: 'points' }, diapos.map((d, i) => el('button', { type: 'button', 'aria-label': `Diapositive ${i + 1} : ${d.titre}` })));
  const racine = el('section', { class: 'carrousel', 'aria-roledescription': 'carrousel', 'aria-label': 'À la une' }, piste, n > 1 ? points : null);

  let actuel = -1;
  const marquer = (i) => {
    if (i === actuel) return;
    actuel = i;
    [...points.children].forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
  };
  const aller = (i) => piste.scrollTo({ left: i * piste.clientWidth, behavior: RM ? 'auto' : 'smooth' });
  let image = 0;
  piste.addEventListener('scroll', () => {
    cancelAnimationFrame(image);
    image = requestAnimationFrame(() => marquer(Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth))));
  }, { passive: true });
  points.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { aller([...points.children].indexOf(b)); pause(8000); }
  });
  marquer(0);

  /* défilement automatique */
  let repos = 0;
  const pause = (ms) => { repos = Date.now() + ms; };
  let dedans = false;
  racine.addEventListener('pointerenter', () => { dedans = true; });
  racine.addEventListener('pointerleave', () => { dedans = false; });
  racine.addEventListener('pointerdown', () => pause(8000));
  racine.addEventListener('focusin', () => { dedans = true; });
  racine.addEventListener('focusout', () => { dedans = false; });
  if (!RM && n > 1) {
    const minuteur = setInterval(() => {
      if (!racine.isConnected) { clearInterval(minuteur); return; }
      if (dedans || document.hidden || Date.now() < repos) return;
      aller((actuel + 1) % n);
    }, DELAI);
  }
  return racine;
}

