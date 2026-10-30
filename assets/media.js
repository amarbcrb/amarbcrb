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

function cadrer(cadre, largeur, hauteur, fond, img) {
  const rc = rapportCadre(cadre);
  if (!largeur || !hauteur || !rc) { cadre.dataset.cadrage = 'cover'; return; }
  const rm = largeur / hauteur;
  const entier = Math.max(rm / rc, rc / rm) > ECART;
  cadre.dataset.cadrage = entier ? 'contain' : 'cover';
  if (entier && fond) cadre.prepend(fond());
  if (entier && img) remplirBords(cadre, img, rm > rc ? 'haut-bas' : 'cotes');
}

/* bandes vides d'une image affichée entière : couleur de son bord (logo sur fond uni), si elle est unie et lisible */
const ECART_BORD = 18;
function couleursBord(img, sens) {
  const n = 24;
  const l = sens === 'haut-bas' ? n : 2, h = sens === 'haut-bas' ? 2 : n;
  const toile = document.createElement('canvas');
  const ctx = toile.getContext('2d', { willReadFrequently: true });
  const lire = (sx, sy, sl, sh) => {
    toile.width = l; toile.height = h;
    ctx.drawImage(img, sx, sy, sl, sh, 0, 0, l, h);
    const d = ctx.getImageData(0, 0, l, h).data; /* SecurityError si l'image ne le permet pas */
    const px = [];
    for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2], d[i + 3]]);
    if (px.some((x) => x[3] < 250)) return null;
    const moy = [0, 1, 2].map((k) => Math.round(px.reduce((a, x) => a + x[k], 0) / px.length));
    const uni = px.every((x) => [0, 1, 2].every((k) => Math.abs(x[k] - moy[k]) <= ECART_BORD));
    return uni ? `rgb(${moy.join(', ')})` : null;
  };
  const W = img.naturalWidth, H = img.naturalHeight;
  const bande = Math.max(1, Math.round((sens === 'haut-bas' ? H : W) * 0.01));
  const a = sens === 'haut-bas' ? lire(0, 0, W, bande) : lire(0, 0, bande, H);
  const b = sens === 'haut-bas' ? lire(0, H - bande, W, bande) : lire(W - bande, 0, bande, H);
  return a && b ? [a, b] : null;
}
function appliquerBords(cadre, sens, couleurs) {
  if (!couleurs) return;
  cadre.dataset.bord = sens;
  cadre.style.setProperty('--bord-a', couleurs[0]);
  cadre.style.setProperty('--bord-b', couleurs[1]);
  cadre.querySelectorAll('.flou').forEach((x) => x.remove());
}
/* une lecture par image et par sens : couleurs, null (bord varié, illisible), ou promesse en cours (relecture CORS) */
const lus = new Map();
function remplirBords(cadre, img, sens) {
  const cle = `${sens} ${img.src}`;
  if (lus.has(cle)) { Promise.resolve(lus.get(cle)).then((couleurs) => appliquerBords(cadre, sens, couleurs)); return; }
  try { const couleurs = couleursBord(img, sens); lus.set(cle, couleurs); appliquerBords(cadre, sens, couleurs); return; } catch { /* image d'un autre site : on la relit avec CORS */ }
  if (!/^https?:/.test(img.src)) { lus.set(cle, null); return; }
  const lecture = new Promise((fin) => {
    const copie = new Image();
    copie.crossOrigin = 'anonymous';
    copie.decoding = 'async';
    copie.addEventListener('load', () => { try { fin(couleursBord(copie, sens)); } catch { fin(null); } }, { once: true });
    copie.addEventListener('error', () => fin(null), { once: true });
    copie.src = img.src;
  });
  lus.set(cle, lecture);
  lecture.then((couleurs) => { lus.set(cle, couleurs); appliquerBords(cadre, sens, couleurs); });
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
  img.addEventListener('load', () => cadrer(cadre, img.naturalWidth, img.naturalHeight, () => el('img', { class: 'flou', src, alt: '' }), img), { once: true });
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
