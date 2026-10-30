/* Mes images (posters, logos et enseignes réalisés par Amar), livrées avec le site :
   affichées par défaut sur un élément sans image ; une image choisie dans le contenu passe toujours avant.
   Correspondance par le texte de l'élément (titre, lieu) : elle tient même si les identifiants changent. */
const IMAGES = {
  fromage: '/assets/images/poster-microbiome-fromage.jpg',
  variole: '/assets/images/poster-variole.jpg',
  librairie: '/assets/images/design-librairie-monalisait.jpg',
  ummto: '/assets/images/design-logo-ummto.jpg',
  kenza: '/assets/images/design-kenzas-touch.jpg',
};
const REGLES = {
  'accueil.domaines': [[/microbio/i, 'fromage'], [/graphis|design/i, 'librairie']],
  'parcours.formation': [[/lyon 1|claude bernard/i, 'fromage'], [/clermont/i, 'variole'], [/mouloud mammeri|tizi|ummto|parasitologie/i, 'ummto']],
  'parcours.interets': [[/design|graphis/i, 'kenza']],
};

/* adresse de l'image par défaut d'un élément d'une liste, sinon null */
export function imageIntegree(liste, x) {
  const texte = [x && x.titre, x && x.lieu].filter(Boolean).join(' ');
  const regle = (REGLES[liste] || []).find(([re]) => re.test(texte));
  return regle ? IMAGES[regle[1]] : null;
}

/* copie de l'élément avec son image par défaut s'il n'en a pas (le contenu n'est jamais modifié) */
export function avecImage(liste, x) {
  const aUne = x.image && (typeof x.image === 'string' ? x.image : x.image.url);
  const url = aUne ? null : imageIntegree(liste, x);
  return url ? { ...x, image: { url, type: 'image' } } : x;
}
