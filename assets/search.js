/* Recherche plein texte côté navigateur, sur les parties visibles du site. */
import { ongletsVisibles, sousOnglets, periode, nomAffiche } from './model.js';

export function normaliserTexte(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const visibles = (liste) => liste.filter((x) => x.visible !== false);
const joindre = (...parts) => parts.filter(Boolean).join(' · ');

export function construireIndex(c, dossiersPortfolio = []) {
  const index = [];
  const ajouter = (type, titre, extrait, cible, ...autres) => {
    index.push({ type, titre, extrait, cible, texte: normaliserTexte([titre, extrait, ...autres].join(' ')), titreN: normaliserTexte(titre) });
  };
  const onglets = ongletsVisibles(c);

  if (onglets.includes('parcours')) {
    const sous = sousOnglets(c, 'parcours').map((x) => x.id);
    const cible = (id) => ({ onglet: 'parcours', sous: id });
    const TYPES = { formation: 'Formation', experience: 'Expérience', engagement: 'Engagement' };
    Object.entries(TYPES).forEach(([id, type]) => {
      if (!sous.includes(id)) return;
      visibles(c.parcours[id]).forEach((x) => ajouter(type, x.titre, joindre(x.lieu, periode(x)), cible(id), x.description));
    });
    if (sous.includes('competences')) visibles(c.parcours.competences).forEach((x) => ajouter('Compétence', x.domaine, x.resume, cible('competences'), x.techniques.join(' ')));
    if (sous.includes('langues')) visibles(c.parcours.langues).forEach((x) => ajouter('Langue', x.langue, x.niveau, cible('langues')));
    if (sous.includes('certifications')) visibles(c.parcours.certifications).forEach((x) => ajouter('Certification', x.titre, joindre(x.organisme, x.annee), cible('certifications')));
    if (sous.includes('interets')) visibles(c.parcours.interets).forEach((x) => ajouter('Intérêt', x.titre, x.texte, cible('interets')));
  }

  if (onglets.includes('liens')) {
    const cats = sousOnglets(c, 'liens').map((x) => x.id);
    visibles(c.liens.items).filter((x) => cats.includes(x.categorie))
      .forEach((x) => ajouter('Lien', x.titre, x.description, { onglet: 'liens', sous: x.categorie }, x.url));
  }

  if (onglets.includes('portfolio')) {
    const titres = new Map(sousOnglets(c, 'portfolio', dossiersPortfolio).map((x) => [x.id, x.titre]));
    dossiersPortfolio.filter((d) => titres.has(d.id)).forEach((d) => {
      (d.fichiers || []).forEach((f) => ajouter('Portfolio', f.nom, titres.get(d.id) || nomAffiche(d.nom), { onglet: 'portfolio', sous: d.id }));
    });
  }

  if (onglets.includes('contact')) {
    const cible = { onglet: 'contact', sous: null };
    if (c.contact.email) ajouter('Contact', 'E-mail', c.contact.email, cible);
    if (c.contact.linkedin) ajouter('Contact', 'LinkedIn', c.contact.linkedin, cible);
    visibles(c.contact.autres).forEach((x) => ajouter('Contact', x.label, x.url, cible));
    visibles(c.contact.ouvertA).forEach((x) => ajouter('Contact', x.titre, x.detail, cible));
  }
  return index;
}

export function chercher(index, requete, max = 20) {
  const mots = normaliserTexte(requete).split(' ').filter(Boolean);
  if (!mots.length) return [];
  return index
    .filter((e) => mots.every((m) => e.texte.includes(m)))
    .map((e, rang) => ({ e, rang, score: mots.filter((m) => e.titreN.includes(m)).length }))
    .sort((a, b) => b.score - a.score || a.rang - b.rang)
    .slice(0, max)
    .map((x) => x.e);
}
