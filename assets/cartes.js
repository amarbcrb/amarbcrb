/* Cartes des rangées et contenu des fiches (feuille qui monte du bas). */
import { lienSur, periode, duree, typeLien, TYPES_LIEN, drapeauLangue, typeMedia, idYoutube, ongletPerso, urlIntegrationLinkedin } from './model.js';
import { visuel as visuelMedia, urlMedia, lecteurYoutube } from './media.js';
import { drapeauSvg } from './drapeaux.js';
import { format } from './router.js';
import { el } from './dom.js';

const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const visibles = (l) => l.filter((x) => x.visible !== false);
const domaine = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

/* e-mail : sur téléphone mailto (l'appli de messagerie, Gmail sur Android) ; sur PC, Gmail dans le navigateur.
   LinkedIn : l'adresse du profil, que le téléphone propose d'ouvrir dans l'appli si elle est installée
   (le lien « intent » d'Android ne marchait pas dans Brave) */
const MOBILE = matchMedia('(pointer: coarse)').matches;
const lienEmail = (e) => (MOBILE ? `mailto:${e}` : `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(e)}`);
const ICONES_CT = {
  copier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
  ecrire: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
  ouvrir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
};

/* fiche Contact : coordonnées, CV, « Ouvert à » */
export function corpsContact(c) {
  const k = c.contact;
  const lignes = [
    /* e-mail et LinkedIn : texte en haut, boutons en dessous (copier, ou ouvrir directement l'application) */
    k.email && el('li', { class: 'row ligne-contact' }, el('span', { class: 't' }, el('b', {}, 'E-mail'), el('small', {}, k.email)),
      el('span', { class: 'cps' }, el('button', { class: 'cp', type: 'button', 'data-copier': k.email, html: ICONES_CT.copier + 'Copier' }),
        el('a', { class: 'cp', href: lienEmail(k.email), target: MOBILE ? null : '_blank', rel: 'noopener', html: ICONES_CT.ecrire + 'Écrire' }))),
    lienSur(k.linkedin) && el('li', { class: 'row ligne-contact' }, el('span', { class: 't' }, el('b', {}, 'LinkedIn'), el('small', {}, k.linkedin.replace(/^https?:\/\/(www\.)?/, ''))),
      el('span', { class: 'cps' }, el('button', { class: 'cp', type: 'button', 'data-copier': k.linkedin, 'aria-label': 'Copier le lien LinkedIn', html: ICONES_CT.copier + 'Copier le lien' }),
        el('a', { class: 'cp', href: k.linkedin, target: '_blank', rel: 'noopener', html: ICONES_CT.ouvrir + 'Ouvrir' }))),
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
  linkedin: '<rect x="2" y="2" width="20" height="20" rx="4"/><path d="M7 10v7"/><path d="M7 7v.01"/><path d="M11 17v-7"/><path d="M11 13a3 3 0 0 1 6 0v4"/>',
  article: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
};
const icone = (type) => `<svg class="type-icone" viewBox="0 0 24 24" aria-hidden="true">${TRACES[type]}</svg>`;
export const iconeType = icone;

const DATEES = ['formation', 'experience', 'engagement'];
/* fichiers : famille (couleur, pictogramme, libellé) tirée de l'extension, sinon du type MIME.
   Pictogrammes dessinés sur une grille de 24 (zone x 7-17, y 9-20), posés en blanc sur l'icône plate. */
const extension = (nom) => ((/\.([a-z0-9]{1,8})$/i.exec(String(nom)) || [])[1] || '').toLowerCase();
const FAMILLES = [
  { id: 'pdf', libelle: 'PDF', ext: /^pdf$/, mime: /pdf/, couleur: '#e5322d', apercu: true,
    dessin: '<path d="M8.4 19.2c1.4-.9 2.7-2.9 3.6-5.2.9-2.4 1.1-4.4.6-4.6-.6-.2-.9 1.8-.2 4.2.6 2.1 2.2 3.8 4.4 4.3 1 .2 1.4-.5.3-.8-2.3-.6-5.4-.1-7.6 1.3-1.4.9-1.9 1.9-1.1.8Z"/>' },
  { id: 'tableur', libelle: 'Tableur', ext: /^(xlsx?|xlsm|ods|csv|tsv|numbers)$/, mime: /spreadsheet|excel|csv/, couleur: '#1f9d55', apercu: true,
    dessin: '<rect x="7" y="9.5" width="10" height="10" rx="1.2"/><path d="M7 12.8h10M7 16.2h10M10.8 9.5v10"/>' },
  { id: 'texte', libelle: 'Document', ext: /^(docx?|odt|rtf|txt|md|pages)$/, mime: /document|msword|text\/plain|rtf/, couleur: '#2f6fe0', apercu: true,
    dessin: '<path d="M7.5 10.5h9M7.5 13.5h9M7.5 16.5h9M7.5 19.5h5.5"/>' },
  { id: 'presentation', libelle: 'Présentation', ext: /^(pptx?|odp|key)$/, mime: /presentation|powerpoint/, couleur: '#e8572a', apercu: true,
    dessin: '<rect x="7" y="9.5" width="10" height="7" rx="1"/><path d="M12 16.5v3M10 19.5h4M9.5 14l2-2 1.5 1.5 2-2"/>' },
  { id: 'sequence', libelle: 'Séquence ADN', ext: /^(dna|gbk|gb|gbff|genbank|fasta|fa|fna|faa|ffn|ab1|abi|ape|sbd|seq|embl|xdna|clc)$/, mime: /genbank|fasta|x-dna/, couleur: '#7c4ddb', apercu: false,
    dessin: '<path d="M9 9c0 2.8 6 3.2 6 5.6S9 17.6 9 20.4"/><path d="M15 9c0 2.8-6 3.2-6 5.6s6 3 6 5.8"/><path d="M10 10.6h4M10.4 18.8h3.2"/>' },
  { id: 'archive', libelle: 'Archive', ext: /^(zip|rar|7z|gz|tgz|tar|bz2)$/, mime: /zip|compressed|archive|tar/, couleur: '#f2a516', apercu: false,
    dessin: '<path d="M11 8.5h2M11 10.5h2M11 12.5h2"/><rect x="10" y="14.5" width="4" height="5" rx="1"/>' },
  { id: 'video', libelle: 'Vidéo', ext: /^(mp4|mov|webm|avi|mkv|m4v)$/, mime: /^video\//, couleur: '#8e44ad', apercu: true,
    dessin: '<circle cx="12" cy="14.5" r="5"/><path d="m11 12.5 3 2-3 2z"/>' },
  { id: 'audio', libelle: 'Audio', ext: /^(mp3|wav|m4a|aac|ogg|flac)$/, mime: /^audio\//, couleur: '#d6336c', apercu: true,
    dessin: '<path d="M10.6 18V11l5-1.3V16.6"/><circle cx="9.2" cy="18" r="1.5"/><circle cx="14.2" cy="16.6" r="1.5"/>' },
  { id: 'image', libelle: 'Image', ext: /^(png|jpe?g|gif|webp|svg|tiff?|bmp|heic|raw)$/, mime: /^image\//, couleur: '#12a4a4', apercu: true,
    dessin: '<rect x="7" y="9.5" width="10" height="10" rx="1.5"/><circle cx="10" cy="12.5" r="1"/><path d="m17 17-3-3-6 5.5"/>' },
  { id: 'code', libelle: 'Code', ext: /^(py|r|rmd|js|ts|html|css|json|xml|ipynb|sh|c|cpp|java|m|php)$/, mime: /json|javascript|x-python|html|xml/, couleur: '#f26b21', apercu: true,
    dessin: '<path d="m10 11.5-2.5 3 2.5 3M14 11.5l2.5 3-2.5 3"/>' },
];
const AUTRE = { id: 'fichier', libelle: 'Fichier', couleur: '#64748b', apercu: true, dessin: '<path d="M8 11h8M8 14.5h8M8 18h5"/>' };
export function familleFichier(f) {
  const ext = extension(f.nom), mime = String(f.type || '');
  return (ext && FAMILLES.find((x) => x.ext.test(ext))) || FAMILLES.find((x) => x.mime.test(mime)) || AUTRE;
}
/* icône plate : feuille colorée au coin plié, pictogramme blanc, extension en bas (sans extension : pas d'étiquette) */
function iconePlate(fam, ext = '') {
  const t = ext.toUpperCase().slice(0, 5);
  const taille = t.length <= 3 ? 11 : t.length === 4 ? 9.4 : 8;
  return `<svg class="icone-plate" viewBox="0 0 48 56" aria-hidden="true">`
    + `<path d="M9 2h21l14 14v34a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z" fill="${fam.couleur}"/>`
    + `<path d="M30 2v10a4 4 0 0 0 4 4h10Z" fill="#000" fill-opacity=".2"/>`
    + `<g transform="translate(5.3 ${t ? 0.4 : 4.6}) scale(1.6)" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${fam.dessin}</g>`
    + (t ? `<text x="24.5" y="47.5" text-anchor="middle" font-size="${taille}" font-weight="800" fill="#fff" letter-spacing=".2" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${t}</text>` : '')
    + '</svg>';
}
/* « Tableur · XLSX », « PDF », « Séquence ADN · GBK » */
export const descriptionFichier = (f) => {
  const fam = familleFichier(f), ext = extension(f.nom).toUpperCase();
  return fam.id === 'pdf' || !ext ? fam.libelle : `${fam.libelle} · ${ext}`;
};
/* aperçu d'un fichier non image : miniature Drive (première page d'un PDF, d'un tableur...),
   sinon son icône plate sur un fond teinté de sa couleur */
export function apercuFichier(f, url) {
  const fam = familleFichier(f);
  const repli = () => el('span', { class: 'doc-repli', 'data-famille': fam.id, style: `--a:${fam.couleur}`, html: iconePlate(fam, extension(f.nom)) });
  return visuelMedia(url, { classe: 'doc-apercu', repli, remplir: true });
}
/* petite icône de la famille, posée sur la miniature Drive (masquée quand l'icône plate est déjà affichée) */
export const pastilleFichier = (f) => el('span', { class: 'doc-pastille', 'aria-hidden': 'true', html: iconePlate(familleFichier(f)) });

/* identifiant Drive sûr (lettres, chiffres, - et _) */
const idDrive = (id) => (/^[\w-]+$/.test(String(id || '')) ? String(id) : null);
/* contenu de la feuille « aperçu » d'un fichier Drive : lecteur Drive intégré quand Drive sait l'afficher,
   sinon la grande icône ; boutons Ouvrir dans Drive et Télécharger */
export const urlTelechargement = (f) => { const id = idDrive(f.id); return id ? `https://drive.google.com/uc?export=download&id=${id}` : null; };
export function corpsApercuFichier(f) {
  const fam = familleFichier(f), id = idDrive(f.id);
  const lecteur = id && fam.apercu
    ? el('iframe', { class: 'apercu-fichier', src: `https://drive.google.com/file/d/${id}/preview`, title: 'Aperçu de ' + f.nom, allow: 'autoplay; fullscreen', allowfullscreen: true, loading: 'lazy' })
    : el('div', { class: 'apercu-indispo', style: `--a:${fam.couleur}` }, el('i', { html: iconePlate(fam, extension(f.nom)) }),
      el('p', {}, fam.id === 'sequence' ? 'Pas d’aperçu pour ce fichier de séquence : télécharge-le et ouvre-le avec SnapGene, Benchling ou ApE.'
        : 'Pas d’aperçu pour ce type de fichier : télécharge-le pour l’ouvrir.'));
  return el('div', { class: 'fiche-contenu apercu-corps' }, el('small', { class: 'apercu-type' }, descriptionFichier(f)), lecteur,
    el('div', { class: 'acts' },
      urlTelechargement(f) ? el('a', { class: 'btn pri', href: urlTelechargement(f), target: '_blank', rel: 'noopener' }, 'Télécharger') : null,
      lienSur(f.lien) ? el('a', { class: 'btn', href: f.lien, target: '_blank', rel: 'noopener' }, 'Ouvrir dans Drive') : null));
}
/* boutons toujours visibles d'une carte de fichier : Voir (visionneuse ou aperçu) et Télécharger */
const OEIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const TELECHARGER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
function actionsFichier(f) {
  const url = urlTelechargement(f);
  return el('span', { class: 'doc-actions' },
    el('button', { type: 'button', class: 'doc-action pri', 'data-voir': '', 'aria-label': `Voir ${f.nom}`, title: 'Voir', html: OEIL + '<span>Voir</span>' }),
    url ? el('a', { class: 'doc-action', href: url, target: '_blank', rel: 'noopener', 'aria-label': `Télécharger ${f.nom}`, title: 'Télécharger', html: TELECHARGER + '<span>Télécharger</span>' }) : null);
}
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
    /* post LinkedIn : sa fiche (post intégré, mon avis) ; autres liens : le site directement */
    const integre = type === 'linkedin';
    const attrs = integre ? { href: format({ onglet: 'liens', sous: x.categorie, element: x.id }) } : { href: x.url, target: '_blank', rel: 'noopener noreferrer' };
    return el(integre || lienSur(x.url) ? 'a' : 'div', { class: 'carte carte-lien', ...attrs, style, 'data-type': type },
      visuelMedia(media, { classe: 'visuel lien-visuel', repli: () => { if (badge) badge.remove(); return degrade(); } }), badge,
      el('span', { class: 'carte-corps' }, el('b', {}, x.titre),
        x.avis ? el('p', { class: 'avis' }, x.avis) : x.description ? el('p', {}, x.description) : null, site ? el('small', {}, site) : null,
        el('span', { class: 'btn' }, x.bouton || (integre ? 'Lire' : 'Ouvrir'))));
  }
  const perso = c ? ongletPerso(c, onglet) : null;
  if (perso && perso.type === 'rangees') {
    /* carte d'un onglet libre : média, titre et texte visibles ; toucher ouvre sa fiche */
    return el('a', { class: 'carte carte-libre', href: fiche, style }, visuel(x.media, x.titre),
      el('span', { class: 'carte-corps' }, el('b', {}, x.titre), x.texte ? el('p', {}, x.texte) : null));
  }
  if (onglet === 'portfolio' || (perso && perso.type === 'drive')) {
    /* carte : un bouton (image : visionneuse) ou un lien Drive (fichier : aperçu dans le site ; Ctrl-clic : Drive)
       couvre la carte ; Voir et Télécharger, toujours visibles, en bas de la carte */
    if (String(x.type).startsWith('image/')) {
      return el('div', { class: 'vignette carte-fichier', 'data-dossier': partie, 'data-fichier': x.id, style },
        el('img', { src: x.apercu, alt: sansExtension(x.nom), loading: 'lazy' }), el('span', { class: 'doc-legende nom-image' }, el('b', {}, x.nom), el('small', {}, 'Image')),
        el('button', { class: 'vignette-ouvrir', type: 'button', 'data-voir': '', 'aria-label': 'Agrandir ' + x.nom }), actionsFichier(x));
    }
    return el('div', { class: 'vignette doc fichier carte-fichier', style, 'data-fichier': x.id, 'data-apercu-dossier': partie },
      apercuFichier(x, x.apercu), pastilleFichier(x), el('span', { class: 'doc-legende' }, el('b', {}, x.nom), el('small', {}, descriptionFichier(x))),
      lienSur(x.lien) ? el('a', { class: 'vignette-ouvrir', href: x.lien, target: '_blank', rel: 'noopener', 'data-voir': '', 'aria-label': `Aperçu de ${x.nom}` })
        : el('button', { class: 'vignette-ouvrir', type: 'button', 'data-voir': '', 'aria-label': `Aperçu de ${x.nom}` }),
      actionsFichier(x));
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
export function corpsFiche(x, partie, perso = null, onglet = null) {
  const paragraphes = (t) => String(t || '').split(/\n\s*\n/).filter((p) => p.trim()).map((p) => el('p', {}, p.trim()));
  /* une vidéo YouTube se lit dans la fiche, avec le son */
  const banniere = (media, texte) => el('div', { class: 'fiche-banniere' }, (typeMedia(media) === 'youtube' && lecteurYoutube(media)) || visuel(media, texte));
  const details = (lignes) => {
    const l = lignes.filter(([, v]) => v);
    return l.length ? [el('h3', { class: 'fiche-sous-titre' }, 'Détails'), el('dl', { class: 'details' }, l.map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v))))] : [];
  };
  if (onglet === 'liens') {
    /* partage : post LinkedIn intégré (sinon l'image du lien), mon avis, la description, le lien d'origine */
    const linkedin = typeLien(x) === 'linkedin';
    const integration = linkedin ? urlIntegrationLinkedin(x.url) : null;
    return el('div', { class: 'fiche-contenu' },
      x.avis ? el('blockquote', { class: 'avis' }, el('small', {}, 'Mon avis'), el('p', {}, x.avis)) : null,
      integration ? el('iframe', { class: 'lecteur-linkedin', src: integration, title: `Post LinkedIn : ${x.titre}`, loading: 'lazy', allowfullscreen: true })
        : el('div', { class: 'fiche-banniere' }, visuel(mediaLien(x), x.titre)),
      paragraphes(x.description),
      lienSur(x.url) ? el('a', { class: 'btn pri', href: x.url, target: '_blank', rel: 'noopener noreferrer' }, linkedin ? 'Voir sur LinkedIn' : x.bouton || 'Ouvrir') : null);
  }
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
