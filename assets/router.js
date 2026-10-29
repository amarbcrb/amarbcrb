/* Adresses du site : #onglet/sous-onglet. Une adresse inconnue ou masquée retombe sur la partie visible la plus proche. */
import { ongletsVisibles, sousOnglets } from './model.js';

/* anciens liens de la page unique */
export const ALIAS = {
  profil: 'accueil', top: 'accueil', methode: 'accueil', apropos: 'parcours/profil', science: 'parcours/competences',
  biostudy: 'liens/projets', beyond: 'parcours/interets',
};

const SANS_SOUS = ['accueil', 'contact'];

function decoder(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

export function parse(hash, c, dossiersPortfolio = []) {
  let s = String(hash || '').replace(/^#/, '');
  if (ALIAS[s]) s = ALIAS[s];
  const [brutOnglet, ...reste] = s.split('/');
  const visibles = ongletsVisibles(c);
  let onglet = decoder(brutOnglet);
  let sous = reste.length ? decoder(reste.join('/')) : null;
  if (!visibles.includes(onglet)) {
    onglet = visibles.includes('accueil') ? 'accueil' : (visibles[0] || 'accueil');
    sous = null;
  }
  if (SANS_SOUS.includes(onglet)) return { onglet, sous: null };
  const liste = sousOnglets(c, onglet, dossiersPortfolio);
  if (!liste.some((x) => x.id === sous)) sous = liste.length ? liste[0].id : null;
  return { onglet, sous };
}

export function format({ onglet, sous }) {
  return '#' + encodeURIComponent(onglet) + (sous ? '/' + encodeURIComponent(sous) : '');
}
