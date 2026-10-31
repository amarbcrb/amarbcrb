/* Carrousel « À la une » de l'Accueil : grandes bannières glissables, points, défilement automatique toutes les 5 s.
   Le défilement s'arrête quand le doigt, la souris ou le focus est dedans, quand l'onglet est caché,
   et n'existe pas si l'utilisateur a demandé moins d'animations. */
import { RM } from './mouvement.js';
import { el } from './dom.js';
import { visuel, urlMedia } from './media.js';

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
  urlMedia(d.image) ? visuel(d.image, { classe: 'visuel diapo-visuel', prioritaire: i === 0, repli: () => '', remplir: true }) : null,
  el('div', { class: 'diapo-texte' }, el('h2', {}, d.titre), d.texte ? el('p', {}, d.texte) : null,
    d.lien ? el('a', { class: 'btn pri', href: d.lien, target: d.externe ? '_blank' : null, rel: d.externe ? 'noopener' : null }, d.bouton || 'Découvrir') : null))));
  const points = el('div', { class: 'points' }, diapos.map((d, i) => el('button', { type: 'button', 'aria-label': `Diapositive ${i + 1} : ${d.titre}` })));
  /* flèches (PC à la souris) */
  const fleche = (sens) => {
    const b = el('button', { type: 'button', class: `piste-fleche ${sens}`, 'aria-label': sens === 'avant' ? 'Diapositive suivante' : 'Diapositive précédente',
      html: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${sens === 'avant' ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'}"/></svg>` });
    b.addEventListener('click', () => { aller(Math.min(n - 1, Math.max(0, actuel + (sens === 'avant' ? 1 : -1)))); pause(8000); });
    return b;
  };
  /* sous les diapos : flèche gauche, points, flèche droite */
  const racine = el('section', { class: 'carrousel', 'aria-roledescription': 'carrousel', 'aria-label': 'À la une' },
    piste, n > 1 ? el('div', { class: 'carrousel-bas' }, fleche('arriere'), points, fleche('avant')) : null);

  let actuel = -1;
  const marquer = (i) => {
    if (i === actuel) return;
    actuel = i;
    [...points.children].forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
  };
  /* les diapos sont moins larges que la piste (la suivante dépasse) : on se repère sur leur position */
  const diapo = (i) => piste.children[i];
  const aller = (i) => piste.scrollTo({ left: diapo(i).offsetLeft - diapo(0).offsetLeft, behavior: RM ? 'auto' : 'smooth' });
  const proche = () => {
    const x = piste.scrollLeft + diapo(0).offsetLeft;
    let k = 0;
    [...piste.children].forEach((d, j) => { if (Math.abs(d.offsetLeft - x) < Math.abs(diapo(k).offsetLeft - x)) k = j; });
    return k;
  };
  let image = 0;
  piste.addEventListener('scroll', () => {
    cancelAnimationFrame(image);
    image = requestAnimationFrame(() => marquer(proche()));
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

