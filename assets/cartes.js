/* Cartes des rangées et contenu des fiches (feuille qui monte du bas). */
import { lienSur, periode } from './model.js';
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
    ...visibles(k.autres).filter((x) => lienSur(x.url)).map((x) => el('li', {}, el('a', { class: 'row', href: x.url, target: '_blank', rel: 'noopener' },
      el('span', { class: 't' }, el('b', {}, x.label), el('small', {}, domaine(x.url))), el('i', { html: CHEVRON })))),
  ].filter(Boolean);
  const ouvert = visibles(k.ouvertA);
  const photo = (c.medias.photo && c.medias.photo.url) || (c.medias.logo && c.medias.logo.url);
  const cv = c.medias.cv && c.medias.cv.url;
  return el('div', { class: 'ct' },
    el('div', { class: 'ct-tete' }, photo ? el('img', { class: 'portrait', src: photo, alt: 'Portrait de ' + c.site.nom, width: 72, height: 72 }) : null,
      el('span', {}, el('b', {}, c.site.nom), el('small', {}, c.site.surtitre))),
    lignes.length ? el('ul', { class: 'box rows' }, lignes) : null,
    cv ? el('a', { class: 'btn pri ct-cv', href: cv, download: c.medias.cv.nom || 'CV.pdf', target: '_blank', rel: 'noopener' }, 'Télécharger mon CV') : null,
    ouvert.length ? el('span', { class: 'gh' }, 'Ouvert à') : null,
    ouvert.length ? el('ul', { class: 'box rows' }, ouvert.map((x) => el('li', { class: 'row' }, el('span', { class: 't' }, el('b', {}, x.titre), x.detail ? el('small', {}, x.detail) : null)))) : null);
}

const FICHIER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';
const DATEES = ['formation', 'experience', 'engagement'];
const sansExtension = (nom) => String(nom).replace(/\.[^.]+$/, '');
const imageSure = (x) => (x && lienSur(x.url) ? x.url : (x && /^\/(?!\/)/.test(String(x.url)) ? x.url : null));
/* image qui se remplace par son repli si elle ne se charge pas (lien d'aperçu expiré, fichier Drive supprimé) */
const imageOuRepli = (src, repli) => {
  const i = el('img', { src, alt: '', loading: 'lazy' });
  i.addEventListener('error', () => i.replaceWith(repli()), { once: true });
  return i;
};
const boutonCertificat = (x) => (lienSur(x.url) ? el('a', { class: 'btn', href: x.url, target: '_blank', rel: 'noopener' }, 'Voir le certificat') : null);

/* titre de la fiche d'un élément */
export const titreFiche = (x) => x.titre || x.domaine || '';

/* carte d'une rangée ou d'une grille, selon la partie */
export function carte(x, { onglet, partie, c, indice = 0 }) {
  const style = `--k:${Math.min(indice, 12)}`;
  const fiche = format({ onglet, sous: partie, element: x.id });
  if (onglet === 'liens') {
    const site = domaine(x.url);
    const degrade = () => el('span', { class: 'degrade', 'aria-hidden': 'true' }, site);
    return el(lienSur(x.url) ? 'a' : 'div', { class: 'carte carte-lien', href: x.url, target: '_blank', rel: 'noopener noreferrer', style },
      lienSur(x.image) ? imageOuRepli(x.image, degrade) : degrade(),
      el('span', { class: 'carte-corps' }, el('b', {}, x.titre), x.description ? el('p', {}, x.description) : null, site ? el('small', {}, site) : null,
        el('span', { class: 'btn' }, x.bouton || 'Ouvrir')));
  }
  if (onglet === 'portfolio') {
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
    const reste = x.techniques.length - 3;
    return el('a', { class: 'carte carte-comp', href: fiche, style }, el('b', {}, x.domaine),
      el('span', { class: 'tags' }, x.techniques.slice(0, 3).map((t) => el('span', {}, t)), reste > 0 ? el('span', {}, `+${reste}`) : null));
  }
  if (partie === 'certifications') {
    return el('article', { class: 'carte carte-cert', style },
      el('a', { class: 'carte-lien-fiche', href: fiche }, el('b', {}, x.titre)),
      el('small', {}, [x.organisme, x.annee].filter(Boolean).join(' · ')), boutonCertificat(x));
  }
  if (partie === 'langues') return el('div', { class: 'carte carte-langue', style }, el('b', {}, x.langue), el('small', {}, x.niveau));
  if (partie === 'interets') {
    const image = imageSure(x.image);
    return el('a', { class: 'carte carte-image', href: fiche, style },
      image ? imageOuRepli(image, () => el('span', { class: 'degrade', 'aria-hidden': 'true' })) : el('span', { class: 'degrade', 'aria-hidden': 'true' }),
      el('span', { class: 'titre' }, x.titre));
  }
  return el('div', { class: 'carte', style }, el('b', {}, titreFiche(x)));
}

/* contenu complet de la fiche d'un élément de Parcours */
export function corpsFiche(x, partie) {
  const paragraphes = (t) => String(t || '').split(/\n\s*\n/).filter((p) => p.trim()).map((p) => el('p', {}, p.trim()));
  if (DATEES.includes(partie)) {
    return el('div', { class: 'fiche-contenu' }, periode(x) ? el('p', { class: 'periode' }, periode(x)) : null,
      x.lieu ? el('p', { class: 'lieu' }, x.lieu) : null, paragraphes(x.description));
  }
  if (partie === 'competences') {
    return el('div', { class: 'fiche-contenu' }, paragraphes(x.resume), x.techniques.length ? el('div', { class: 'tags' }, x.techniques.map((t) => el('span', {}, t))) : null);
  }
  if (partie === 'certifications') {
    return el('div', { class: 'fiche-contenu' }, el('p', { class: 'lieu' }, [x.organisme, x.annee].filter(Boolean).join(' · ')), boutonCertificat(x));
  }
  if (partie === 'interets') {
    const image = imageSure(x.image);
    const grande = image ? el('img', { class: 'fiche-image', src: image, alt: '' }) : null;
    if (grande) grande.addEventListener('error', () => grande.remove(), { once: true });
    return el('div', { class: 'fiche-contenu' }, grande, paragraphes(x.texte));
  }
  return el('div', { class: 'fiche-contenu' });
}
