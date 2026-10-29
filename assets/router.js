/* Adresses du site : #onglet, #onglet/partie (Voir tout), #onglet/partie/element (fiche), #contact.
   Une adresse inconnue ou masquée retombe sur la partie visible la plus proche. */
import { ongletsVisibles, parties, aFiche, contactVisible } from './model.js';

/* anciens liens de la page unique */
export const ALIAS = {
  profil: 'accueil', top: 'accueil', methode: 'accueil', apropos: 'parcours', science: 'parcours/competences',
  biostudy: 'liens/projets', beyond: 'parcours/interets',
};

function decoder(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}
const page = (onglet, sous = null, element = null, contact = false) => ({ onglet, sous, element, contact });

export function parse(hash, c, dossiersPortfolio = []) {
  let s = String(hash || '').replace(/^#/, '');
  if (s === 'contact') return page('accueil', null, null, contactVisible(c));
  if (ALIAS[s]) s = ALIAS[s];
  const [brutOnglet, brutSous, brutElement] = s.split('/').map(decoder);
  const visibles = ongletsVisibles(c);
  if (!visibles.includes(brutOnglet)) return page(visibles.includes('accueil') ? 'accueil' : visibles[0]);
  const partie = brutSous ? parties(c, brutOnglet, dossiersPortfolio).find((p) => p.id === brutSous) : null;
  if (!partie) return page(brutOnglet);
  const element = brutElement && aFiche(brutOnglet, partie.id) && partie.items.some((x) => x.id === brutElement) ? brutElement : null;
  return page(brutOnglet, partie.id, element);
}

export function format({ onglet, sous = null, element = null }) {
  return '#' + [onglet, sous, element].filter((x) => x !== null && x !== undefined && x !== '').map(encodeURIComponent).join('/');
}
