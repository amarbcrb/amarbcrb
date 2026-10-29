/* Cartes des rangées et contenu des fiches (feuille qui monte du bas). */
import { lienSur } from './model.js';
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
