/* Rendu des vues du site à partir du contenu. */

const TITRES = { accueil: 'Accueil', parcours: 'Parcours', portfolio: 'Portfolio', liens: 'Liens', contact: 'Contact' };

export function rendreVue(racine, c, { onglet }) {
  const section = document.createElement('section');
  section.className = 'vt';
  const titre = document.createElement('h1');
  titre.textContent = TITRES[onglet];
  section.append(titre);
  racine.replaceChildren(section);
}
