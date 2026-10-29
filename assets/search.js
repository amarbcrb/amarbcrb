/* Recherche plein texte côté navigateur, sur les parties visibles du site. */
import { ongletsVisibles, parties, aFiche, contactVisible, periode } from './model.js';
import { format } from './router.js';

export function normaliserTexte(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const visibles = (liste) => liste.filter((x) => x.visible !== false);
const joindre = (...parts) => parts.filter(Boolean).join(' · ');

const TYPES = {
  formation: 'Formation', experience: 'Expérience', engagement: 'Engagement', competences: 'Compétence',
  langues: 'Langue', certifications: 'Certification', interets: 'Intérêt',
};

/* chaque entrée porte l'adresse à ouvrir : fiche pour Parcours, Voir tout pour Langues, Liens et Portfolio */
export function construireIndex(c, dossiersPortfolio = []) {
  const index = [];
  const ajouter = (type, titre, extrait, hash, ...autres) => {
    index.push({ type, titre, extrait, hash, texte: normaliserTexte([titre, extrait, ...autres].join(' ')), titreN: normaliserTexte(titre) });
  };
  const onglets = ongletsVisibles(c);

  if (onglets.includes('parcours')) {
    parties(c, 'parcours').forEach((p) => p.items.forEach((x) => {
      const hash = format({ onglet: 'parcours', sous: p.id, element: aFiche('parcours', p.id) ? x.id : null });
      if (p.id === 'competences') ajouter(TYPES[p.id], x.domaine, x.resume, hash, x.techniques.join(' '));
      else if (p.id === 'langues') ajouter(TYPES[p.id], x.langue, x.niveau, hash);
      else if (p.id === 'certifications') ajouter(TYPES[p.id], x.titre, joindre(x.organisme, x.annee), hash);
      else if (p.id === 'interets') ajouter(TYPES[p.id], x.titre, x.texte, hash);
      else ajouter(TYPES[p.id], x.titre, joindre(x.lieu, periode(x)), hash, x.description);
    }));
  }

  if (onglets.includes('liens')) {
    parties(c, 'liens').filter((p) => p.id !== 'tous').forEach((p) => p.items.forEach((x) => ajouter('Lien', x.titre, x.description, format({ onglet: 'liens', sous: p.id }), x.url)));
  }

  if (onglets.includes('portfolio')) {
    parties(c, 'portfolio', dossiersPortfolio).forEach((p) => p.items.forEach((f) => ajouter('Portfolio', f.nom, p.titre, format({ onglet: 'portfolio', sous: p.id }))));
  }

  if (contactVisible(c)) {
    const k = c.contact;
    if (k.email) ajouter('Contact', 'E-mail', k.email, '#contact');
    if (k.linkedin) ajouter('Contact', 'LinkedIn', k.linkedin, '#contact');
    visibles(k.autres).forEach((x) => ajouter('Contact', x.label, x.url, '#contact'));
    visibles(k.ouvertA).forEach((x) => ajouter('Contact', x.titre, x.detail, '#contact'));
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
