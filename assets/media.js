/* Rendu d'un média (image, GIF, vidéo, YouTube) dans un cadre, avec cadrage automatique :
   si la forme du média s'écarte de plus de 25 % de celle du cadre (logo, image large), il est affiché entier,
   centré sur une copie floutée de lui-même ; sinon il remplit le cadre. */
import { el } from './dom.js';
import { lienSur, typeMedia, idYoutube } from './model.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ECART = 1.25;
const LECTURE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';

/* adresse sûre : http(s), chemin du site ou image en data: */
export function urlMedia(m) {
  const url = typeof m === 'string' ? m : m && m.url;
  return url && (lienSur(url) || /^\/(?!\/)/.test(url) || /^data:image\//.test(url)) ? url : null;
}

/* rapport largeur / hauteur du cadre : mesuré, sinon lu dans aspect-ratio */
function rapportCadre(cadre) {
  const r = cadre.getBoundingClientRect();
  if (r.width && r.height) return r.width / r.height;
  const m = /([\d.]+)\s*\/\s*([\d.]+)/.exec(getComputedStyle(cadre).aspectRatio || '');
  return m ? Number(m[1]) / Number(m[2]) : null;
}

function cadrer(cadre, largeur, hauteur, fond) {
  const rc = rapportCadre(cadre);
  if (!largeur || !hauteur || !rc) { cadre.dataset.cadrage = 'cover'; return; }
  const rm = largeur / hauteur;
  const entier = Math.max(rm / rc, rc / rm) > ECART;
  cadre.dataset.cadrage = entier ? 'contain' : 'cover';
  if (entier && fond) cadre.prepend(fond());
}

/* lecture des vidéos seulement quand elles sont à l'écran (batterie, données) */
const ecran = 'IntersectionObserver' in window ? new IntersectionObserver((entrees) => entrees.forEach((e) => {
  if (e.isIntersecting) e.target.play().catch(() => {});
  else e.target.pause();
}), { threshold: 0.2 }) : null;

/* media : { url, type? } ou adresse ; repli : () => Node affiché à la place (absent, cassé ou interdit) */
export function visuel(media, { repli, classe = 'visuel', prioritaire = false } = {}) {
  const cadre = el('span', { class: classe, 'aria-hidden': 'true' });
  const url = urlMedia(media);
  const type = url ? typeMedia(typeof media === 'object' ? { ...media, url } : url) : null;
  const echec = () => { delete cadre.dataset.cadrage; cadre.replaceChildren(repli ? repli() : ''); };
  if (!type) { cadre.append(repli ? repli() : ''); return cadre; }
  if (type === 'video') {
    const v = el('video', { src: url, muted: true, loop: true, playsinline: true, preload: RM ? 'metadata' : 'auto', autoplay: !RM });
    v.muted = true;
    v.addEventListener('loadedmetadata', () => cadrer(cadre, v.videoWidth, v.videoHeight, null), { once: true });
    v.addEventListener('error', echec, { once: true });
    if (!RM && ecran) ecran.observe(v);
    cadre.append(v);
    return cadre;
  }
  const src = type === 'youtube' ? `https://i.ytimg.com/vi/${idYoutube(url)}/hqdefault.jpg` : url;
  const img = el('img', { src, alt: '', loading: prioritaire ? 'eager' : 'lazy', decoding: 'async', fetchpriority: prioritaire ? 'high' : null });
  img.addEventListener('load', () => cadrer(cadre, img.naturalWidth, img.naturalHeight, () => el('img', { class: 'flou', src, alt: '' })), { once: true });
  img.addEventListener('error', echec, { once: true });
  cadre.append(img);
  if (type === 'youtube') cadre.append(el('span', { class: 'lecture', html: LECTURE }));
  return cadre;
}

/* lecteur YouTube (dans une fiche) : domaine sans cookies */
export function lecteurYoutube(media) {
  const id = idYoutube(urlMedia(media) || '');
  return id ? el('iframe', { class: 'lecteur', src: `https://www.youtube-nocookie.com/embed/${id}`, title: 'Vidéo YouTube',
    allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen', allowfullscreen: true, loading: 'lazy' }) : null;
}
