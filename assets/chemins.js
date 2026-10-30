/* Chemins dans le contenu : « accueil.salutation », « accueil.reperes#r1.valeur » (élément d'une liste par son id),
   ou un index numérique. Les marques data-edit du rendu utilisent les ids, pour rester justes après un déplacement. */
const INTERDITS = new Set(['__proto__', 'prototype', 'constructor']);

function morceaux(chemin) {
  const liste = [];
  String(chemin).split('.').forEach((p) => {
    const [cle, id] = p.split('#');
    liste.push({ cle, id });
  });
  return liste;
}

function descendre(o, { cle, id }) {
  if (o === null || typeof o !== 'object' || INTERDITS.has(cle)) return undefined;
  const v = o[cle];
  if (id === undefined) return v;
  return Array.isArray(v) ? v.find((x) => x && x.id === id) : undefined;
}

export function lireChemin(contenu, chemin) {
  return morceaux(chemin).reduce((o, m) => (o === undefined ? undefined : descendre(o, m)), contenu);
}

/* écrit valeur au bout du chemin ; false si un élément #id manque ou si le chemin est interdit */
export function ecrireChemin(contenu, chemin, valeur) {
  const m = morceaux(chemin);
  if (m.some((x) => INTERDITS.has(x.cle))) return false;
  let o = contenu;
  for (const x of m.slice(0, -1)) {
    if (x.id === undefined && (o[x.cle] === undefined || o[x.cle] === null)) o[x.cle] = {};
    o = descendre(o, x);
    if (!o || typeof o !== 'object') return false;
  }
  const fin = m.at(-1);
  if (fin.id !== undefined) return false;
  o[fin.cle] = valeur;
  return true;
}

/* « parcours.formation#f2.fin » → « parcours.formation.1.fin » (chemins des erreurs de valider) ; null si un id manque */
export function cheminIndex(contenu, chemin) {
  let o = contenu;
  const sortie = [];
  for (const { cle, id } of morceaux(chemin)) {
    o = o && o[cle];
    sortie.push(cle);
    if (id !== undefined) {
      const i = Array.isArray(o) ? o.findIndex((x) => x && x.id === id) : -1;
      if (i < 0) return null;
      o = o[i];
      sortie.push(String(i));
    }
  }
  return sortie.join('.');
}
