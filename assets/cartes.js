/* Cartes des rangées et contenu des fiches (feuille qui monte du bas). */
import { lienSur, periode, duree, typeLien, TYPES_LIEN, drapeauLangue, typeMedia, idYoutube, ongletPerso } from './model.js';
import { visuel as visuelMedia, urlMedia, lecteurYoutube } from './media.js';
import { drapeauSvg } from './drapeaux.js';
import { format } from './router.js';
import { el } from './dom.js';

const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const visibles = (l) => l.filter((x) => x.visible !== false);
const domaine = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

/* fiche Contact : coordonnées, CV, « Ouvert à » */
export function corpsContact(c) {
  const k = c.contact;
  const lignes = [
    k.email && el('li', { class: 'row' }, el('span', { class: 't' }, el('b', {}, 'E-mail'), el('small', {}, k.email)),
      el('button', { class: 'cp', type: 'button', 'data-copier': k.email }, 'Copier')),
    lienSur(k.linkedin) && el('li', {}, el('a', { class: 'row', href: k.linkedin, target: '_blank', rel: 'noopener' },
      el('span', { class: 't' }, el('b', {}, 'LinkedIn'), el('small', {}, k.linkedin.replace(/^https?:\/\/(www\.)?/, ''))), el('i', { html: CHEVRON }))),
    ...visibles(k.autres).filter((x) => lienSur(x.url)).map((x) => el('li', { 'data-element': `contact.autres#${x.id}` }, el('a', { class: 'row', href: x.url, target: '_blank', rel: 'noopener' },
      el('span', { class: 't' }, el('b', {}, x.label), el('small', {}, domaine(x.url))), el('i', { html: CHEVRON })))),
  ].filter(Boolean);
  const ouvert = visibles(k.ouvertA);
  const photo = (c.medias.photo && c.medias.photo.url) || (c.medias.logo && c.medias.logo.url);
  const cv = c.medias.cv && c.medias.cv.url;
  return el('div', { class: 'ct' },
    el('div', { class: 'ct-tete' }, photo ? el('img', { class: 'portrait', src: photo, alt: 'Portrait de ' + c.site.nom, width: 72, height: 72 }) : null,
      el('span', {}, el('b', {}, c.site.nom), el('small', {}, c.site.surtitre))),
    el('ul', { class: 'box rows', 'data-element': 'contact', 'data-liste': 'contact.autres' }, lignes),
    cv ? el('a', { class: 'btn pri ct-cv', href: cv, download: c.medias.cv.nom || 'CV.pdf', target: '_blank', rel: 'noopener' }, 'Télécharger mon CV') : null,
    ouvert.length ? el('h3', { class: 'ct-titre' }, 'Ouvert à') : null,
    el('ul', { class: 'box rows', 'data-liste': 'contact.ouvertA' }, ouvert.map((x) => el('li', { class: 'row', 'data-element': `contact.ouvertA#${x.id}` }, el('span', { class: 't' }, el('b', {}, x.titre), x.detail ? el('small', {}, x.detail) : null)))));
}

/* pictogramme de la nature d'un lien */
const TRACES = {
  web: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  video: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  appli: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  document: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8M8 17h5"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  article: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
};
const icone = (type) => `<svg class="type-icone" viewBox="0 0 24 24" aria-hidden="true">${TRACES[type]}</svg>`;
export const iconeType = icone;

const FICHIER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';
const DATEES = ['formation', 'experience', 'engagement'];
const sansExtension = (nom) => String(nom).replace(/\.[^.]+$/, '');
/* média d'un lien : envoyé ou choisi, sinon aperçu automatique, sinon miniature YouTube de l'adresse */
export const mediaLien = (x) => (urlMedia(x.media) ? x.media : lienSur(x.image) ? { url: x.image } : idYoutube(x.url) ? { url: x.url, type: 'youtube' } : null);
/* visuel d'une carte : le média (image, GIF, vidéo, YouTube), sinon une affiche dessinée (dégradé tiré du texte) */
const TEINTES = [['--c-indigo', '--c-blue'], ['--c-purple', '--c-pink'], ['--c-teal', '--c-green'], ['--c-orange', '--c-red'], ['--c-blue', '--c-cyan'], ['--c-pink', '--c-orange']];
const teinte = (texte) => { let h = 0; for (const ch of String(texte)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return TEINTES[h % TEINTES.length]; };
function visuel(media, texte) {
  const [a, b] = teinte(texte);
  return visuelMedia(media, { repli: () => el('span', { class: 'affiche-repli', style: `--a:var(${a});--b:var(${b})` }, el('span', {}, texte)) });
}
const boutonCertificat = (x) => (lienSur(x.url) ? el('a', { class: 'btn', href: x.url, target: '_blank', rel: 'noopener' }, 'Voir le certificat') : null);

/* carte « Ce que je fais » de l'Accueil : image (ou dégradé), titre, texte toujours visible */
export function carteDomaine(x, indice = 0) {
  return el('article', { class: 'carte carte-domaine', style: `--k:${indice}`, 'data-element': `accueil.domaines#${x.id}` },
    visuel(x.image, x.titre), el('span', { class: 'carte-corps' }, el('b', {}, x.titre), x.texte ? el('p', {}, x.texte) : null));
}

/* « Culture, PCR, ELISA et 2 autres » */
const apercuTechniques = (t) => t.slice(0, 3).join(', ') + (t.length > 3 ? ` et ${t.length - 3} autre${t.length > 4 ? 's' : ''}` : '');

/* tuile carrée des liens récents (façon playlists) : image, sinon pictogramme du type sur un dégradé */
export function tuileLien(x, c, indice = 0) {
  const type = typeLien(x, c);
  const [a, b] = teinte(x.titre);
  const repli = () => el('span', { class: 'tuile-repli', style: `--a:var(${a});--b:var(${b})`, html: icone(type) });
  return el(lienSur(x.url) ? 'a' : 'div', { class: 'tuile', href: x.url, target: '_blank', rel: 'noopener noreferrer', style: `--k:${indice}`, 'data-type': type, 'data-element': `liens.items#${x.id}` },
    visuelMedia(mediaLien(x), { classe: 'tuile-visuel', repli }),
    el('b', {}, x.titre), el('small', {}, domaine(x.url)));
}

/* type le plus fréquent d'une liste de liens (icône de la catégorie) */
export function typeDominant(items, c) {
  const n = {};
  items.forEach((x) => { const t = typeLien(x, c); n[t] = (n[t] || 0) + 1; });
  return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || 'web';
}

/* titre de la fiche d'un élément */
export const titreFiche = (x) => x.titre || x.domaine || '';

/* édition : chemin de l'élément affiché par une carte (« parcours.certifications#k1 ») */
function cleCarte(x, { onglet, partie, c }) {
  if (onglet === 'parcours') return `parcours.${partie}#${x.id}`;
  if (onglet === 'liens') return `liens.items#${x.id}`;
  const perso = c ? ongletPerso(c, onglet) : null;
  return perso && perso.type === 'rangees' ? `pages.${onglet}.rangees#${partie}.cartes#${x.id}` : null;
}

/* carte d'une rangée ou d'une grille, selon la partie */
export function carte(x, options) {
  const e = carteBrute(x, options);
  const cle = cleCarte(x, options);
  if (cle) e.setAttribute('data-element', cle);
  return e;
}

function carteBrute(x, { onglet, partie, c, indice = 0 }) {
  const style = `--k:${Math.min(indice, 12)}`;
  const fiche = format({ onglet, sous: partie, element: x.id });
  if (onglet === 'liens') {
    const site = domaine(x.url), type = typeLien(x, c);
    const degrade = () => el('span', { class: 'degrade', 'aria-hidden': 'true' }, el('i', { html: icone(type) }), site);
    /* image envoyée dans l'admin, sinon aperçu automatique, sinon pictogramme */
    const media = mediaLien(x);
    const badge = media ? el('span', { class: 'badge-type', html: icone(type) }, TYPES_LIEN[type]) : null;
    /* média introuvable : le dégradé porte déjà le pictogramme, le badge devient inutile */
    return el(lienSur(x.url) ? 'a' : 'div', { class: 'carte carte-lien', href: x.url, target: '_blank', rel: 'noopener noreferrer', style, 'data-type': type },
      visuelMedia(media, { classe: 'visuel lien-visuel', repli: () => { if (badge) badge.remove(); return degrade(); } }), badge,
      el('span', { class: 'carte-corps' }, el('b', {}, x.titre), x.description ? el('p', {}, x.description) : null, site ? el('small', {}, site) : null,
        el('span', { class: 'btn' }, x.bouton || 'Ouvrir')));
  }
  const perso = c ? ongletPerso(c, onglet) : null;
  if (perso && perso.type === 'rangees') {
    /* carte d'un onglet libre : média, titre et texte visibles ; toucher ouvre sa fiche */
    return el('a', { class: 'carte carte-libre', href: fiche, style }, visuel(x.media, x.titre),
      el('span', { class: 'carte-corps' }, el('b', {}, x.titre), x.texte ? el('p', {}, x.texte) : null));
  }
  if (onglet === 'portfolio' || (perso && perso.type === 'drive')) {
    if (String(x.type).startsWith('image/')) {
      return el('button', { class: 'vignette', type: 'button', 'data-dossier': partie, 'data-fichier': x.id, 'aria-label': 'Agrandir ' + x.nom, style },
        el('img', { src: x.apercu, alt: sansExtension(x.nom), loading: 'lazy' }));
    }
    return el(lienSur(x.lien) ? 'a' : 'div', { class: 'vignette doc', href: x.lien, target: '_blank', rel: 'noopener', style },
      el('i', { html: FICHIER }), el('b', {}, x.nom), el('small', {}, 'Ouvrir dans Drive'));
  }
  if (DATEES.includes(partie)) {
    return el('a', { class: 'carte carte-texte', href: fiche, style },
      el('small', { class: 'periode' }, periode(x) || ' '), el('b', {}, x.titre), x.lieu ? el('span', {}, x.lieu) : null,
      x.enCours ? el('span', { class: 'en-cours' }, 'En cours') : null);
  }
  if (partie === 'competences') {
    return el('a', { class: 'carte carte-comp', href: fiche, style }, visuel(x.image, x.domaine),
      el('b', {}, x.domaine), x.techniques.length ? el('p', {}, apercuTechniques(x.techniques)) : null);
  }
  if (partie === 'certifications') {
    return el('article', { class: 'carte carte-cert', style }, visuel(x.image, String(x.organisme || x.titre).split(' · ')[0]),
      el('a', { class: 'carte-lien-fiche', href: fiche }, el('b', {}, x.titre)),
      el('small', {}, [x.organisme, x.annee].filter(Boolean).join(' · ')), boutonCertificat(x));
  }
  if (partie === 'langues') {
    const code = drapeauLangue(x);
    return el('div', { class: 'carte carte-langue', style },
      code ? el('span', { class: 'drapeau', 'data-drapeau': code, 'aria-hidden': 'true', html: drapeauSvg(code) }) : null,
      el('span', {}, el('b', {}, x.langue), el('small', {}, x.niveau)));
  }
  if (partie === 'interets') {
    /* tout est lisible sur la carte : pas de fiche à deviner */
    return el('article', { class: 'carte carte-interet', style }, visuel(x.image, x.titre),
      el('span', { class: 'carte-corps' }, el('b', {}, x.titre), x.texte ? el('p', {}, x.texte) : null));
  }
  return el('div', { class: 'carte', style }, el('b', {}, titreFiche(x)));
}

/* image de fond (floutée) de la fiche d'un élément : seulement une vraie image (pas une vidéo) */
export const fondFiche = (x) => { const m = x.image || x.media; return typeMedia(m) === 'image' ? urlMedia(m) : null; };

/* contenu complet de la fiche d'un élément de Parcours, façon page détail de Nuvio :
   bannière, description, puis « Détails » en lignes libellé / valeur */
export function corpsFiche(x, partie, perso = null) {
  const paragraphes = (t) => String(t || '').split(/\n\s*\n/).filter((p) => p.trim()).map((p) => el('p', {}, p.trim()));
  /* une vidéo YouTube se lit dans la fiche, avec le son */
  const banniere = (media, texte) => el('div', { class: 'fiche-banniere' }, (typeMedia(media) === 'youtube' && lecteurYoutube(media)) || visuel(media, texte));
  const details = (lignes) => {
    const l = lignes.filter(([, v]) => v);
    return l.length ? [el('h3', { class: 'fiche-sous-titre' }, 'Détails'), el('dl', { class: 'details' }, l.map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v))))] : [];
  };
  if (perso && perso.type === 'rangees') {
    const externe = lienSur(x.lien);
    return el('div', { class: 'fiche-contenu' }, banniere(x.media, x.titre), paragraphes(x.texte),
      x.lien ? el('a', { class: 'btn pri', href: x.lien, target: externe ? '_blank' : null, rel: externe ? 'noopener' : null }, x.bouton || 'Ouvrir') : null);
  }
  if (DATEES.includes(partie)) {
    return el('div', { class: 'fiche-contenu' }, banniere(x.image, x.lieu || x.titre), paragraphes(x.description),
      details([['Lieu', x.lieu], ['Période', periode(x)], ['Durée', duree(x)], ['Statut', x.enCours ? 'En cours' : (x.debut || x.fin ? 'Terminé' : '')]]));
  }
  if (partie === 'competences') {
    return el('div', { class: 'fiche-contenu' }, banniere(x.image, x.domaine), paragraphes(x.resume),
      x.techniques.length ? [el('h3', { class: 'fiche-sous-titre' }, 'Techniques'), el('ul', { class: 'techniques' }, x.techniques.map((t) => el('li', {}, t)))] : null);
  }
  if (partie === 'certifications') {
    return el('div', { class: 'fiche-contenu' }, banniere(x.image, String(x.organisme || x.titre).split(' · ')[0]),
      details([['Organisme', x.organisme], ['Année', x.annee], ['Statut', 'Obtenu']]), boutonCertificat(x));
  }
  return el('div', { class: 'fiche-contenu' });
}
