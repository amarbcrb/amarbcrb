/* Modèle de contenu du site : forme attendue de contenu.json et fonctions pures pour le lire.
   Aucune dépendance au DOM : le module est importé par le site, l'admin et les tests Node. */

export const ONGLETS = ['accueil', 'parcours', 'portfolio', 'liens', 'contact'];
export const SOUS_PARCOURS = ['profil', 'formation', 'experience', 'engagement', 'competences', 'langues', 'certifications', 'interets'];

const TITRES_PARCOURS = {
  profil: 'Profil', formation: 'Formation', experience: 'Expérience', engagement: 'Engagement',
  competences: 'Compétences', langues: 'Langues', certifications: 'Certifications', interets: 'Intérêts',
};
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const IMAGE_DEFAUT = '/favicon-512x512.png';

/* modèles des éléments de chaque liste */
const DATE_ITEM = { titre: '', lieu: '', debut: '', fin: null, enCours: false, description: '' };
const ITEMS = {
  'parcours.formation': DATE_ITEM,
  'parcours.experience': DATE_ITEM,
  'parcours.engagement': DATE_ITEM,
  'parcours.competences': { domaine: '', resume: '', techniques: [] },
  'parcours.langues': { langue: '', niveau: '' },
  'parcours.certifications': { titre: '', organisme: '', annee: '' },
  'parcours.interets': { titre: '', texte: '' },
  'liens.categories': { nom: '' },
  'liens.items': { url: '', titre: '', description: '', image: '', categorie: '', date: '' },
  'contact.autres': { label: '', url: '' },
  'contact.ouvertA': { titre: '', detail: '' },
};
const PREFIXES = {
  'parcours.formation': 'f', 'parcours.experience': 'e', 'parcours.engagement': 'g', 'parcours.competences': 'c',
  'parcours.langues': 'l', 'parcours.certifications': 'k', 'parcours.interets': 'i', 'liens.categories': 'cat',
  'liens.items': 'u', 'contact.autres': 'a', 'contact.ouvertA': 'o',
};

function squelette() {
  const sous = {};
  SOUS_PARCOURS.forEach((id) => { sous[id] = { visible: true, titre: TITRES_PARCOURS[id] }; });
  return {
    version: 0,
    updatedAt: '',
    site: { nom: 'Amar Bouchareb', surtitre: 'Microbiologie · Lyon 1', maintenance: { active: false, message: 'Le site revient très vite.' } },
    medias: { photo: { url: IMAGE_DEFAUT }, logo: { url: IMAGE_DEFAUT }, favicon: { url: IMAGE_DEFAUT }, cv: null },
    onglets: {
      accueil: { visible: true }, parcours: { visible: true, sous }, portfolio: { visible: true },
      liens: { visible: true }, contact: { visible: true },
    },
    accueil: { positionnement: '', situation: '', competencesCles: [] },
    parcours: {
      profil: { titre: '', texte: '' },
      formation: [], experience: [], engagement: [], competences: [], langues: [], certifications: [], interets: [],
    },
    liens: { categories: [], items: [] },
    portfolio: { dossierRacineId: '', dossiers: {} },
    contact: { email: '', linkedin: '', autres: [], ouvertA: [] },
  };
}

let compteur = 0;
export function nouvelId(prefixe = 'x') {
  compteur += 1;
  return prefixe + Date.now().toString(36) + compteur.toString(36) + Math.random().toString(36).slice(2, 6);
}

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/* fusionne brut dans le modèle : types du modèle respectés, clés inconnues conservées */
function fusionner(modele, brut, chemin) {
  if (Array.isArray(modele)) {
    if (!Array.isArray(brut)) return [];
    const gabarit = ITEMS[chemin];
    if (!gabarit) return brut.filter((x) => typeof x === 'string');
    return brut.filter(estObjet).map((item) => {
      const out = { id: typeof item.id === 'string' && item.id ? item.id : nouvelId(PREFIXES[chemin]) };
      Object.assign(out, fusionner(gabarit, item, ''));
      out.visible = item.visible !== false;
      return out;
    });
  }
  if (estObjet(modele)) {
    const source = estObjet(brut) ? brut : {};
    const out = { ...source };
    Object.keys(modele).forEach((k) => {
      const sous = chemin ? chemin + '.' + k : k;
      out[k] = fusionner(modele[k], source[k], sous);
    });
    return out;
  }
  if (modele === null) return brut === undefined ? null : brut;
  return typeof brut === typeof modele ? brut : modele;
}

export function normaliser(brut) {
  const c = fusionner(squelette(), brut, '');
  const src = estObjet(brut) && estObjet(brut.medias) ? brut.medias : {};
  ['photo', 'logo', 'favicon', 'cv'].forEach((k) => {
    if (k in src) c.medias[k] = estObjet(src[k]) ? src[k] : null;
  });
  const dossiers = {};
  Object.entries(estObjet(c.portfolio.dossiers) ? c.portfolio.dossiers : {}).forEach(([id, d]) => {
    const o = estObjet(d) ? d : {};
    dossiers[id] = { ...o, visible: o.visible !== false, nom: typeof o.nom === 'string' ? o.nom : '' };
  });
  c.portfolio.dossiers = dossiers;
  return c;
}

export function formaterDate(d) {
  if (!d) return '';
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(String(d));
  if (!m) return String(d);
  return m[2] ? `${MOIS[Number(m[2]) - 1]} ${m[1]}` : m[1];
}

export function periode(item) {
  const debut = formaterDate(item.debut);
  if (item.enCours) return debut ? `${debut} – aujourd'hui` : "aujourd'hui";
  const fin = formaterDate(item.fin);
  if (!debut) return fin;
  if (!fin || fin === debut) return debut;
  return `${debut} – ${fin}`;
}

export function trierParDate(items) {
  return [...items].sort((a, b) => (Number(!!b.enCours) - Number(!!a.enCours)) || String(b.debut || '').localeCompare(String(a.debut || '')));
}

const visibles = (liste) => liste.filter((x) => x.visible !== false);

export function formationActuelle(c) {
  const liste = trierParDate(visibles(c.parcours.formation));
  return liste[0] || null;
}

export function derniereExperience(c) {
  return trierParDate(visibles(c.parcours.experience))[0] || null;
}

/* jamais vide : si tout est masqué, l'Accueil reste affiché */
export function ongletsVisibles(c) {
  const liste = ONGLETS.filter((id) => c.onglets[id] && c.onglets[id].visible !== false);
  return liste.length ? liste : ['accueil'];
}

export function nomAffiche(nom) {
  return String(nom || '').replace(/^\d+\s*-\s*/, '');
}

export function sousOnglets(c, onglet, dossiersPortfolio = []) {
  if (onglet === 'parcours') {
    const sous = c.onglets.parcours.sous;
    return SOUS_PARCOURS.filter((id) => {
      if (!sous[id] || sous[id].visible === false) return false;
      if (id === 'profil') return !!String(c.parcours.profil.texte || '').trim();
      return visibles(c.parcours[id]).length > 0;
    }).map((id) => ({ id, titre: sous[id].titre || TITRES_PARCOURS[id] }));
  }
  if (onglet === 'liens') {
    const items = visibles(c.liens.items);
    return visibles(c.liens.categories)
      .filter((cat) => items.some((x) => x.categorie === cat.id))
      .map((cat) => ({ id: cat.id, titre: cat.nom }));
  }
  if (onglet === 'portfolio') {
    const reglages = c.portfolio.dossiers;
    return [...dossiersPortfolio]
      .filter((d) => !reglages[d.id] || reglages[d.id].visible !== false)
      .sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr', { numeric: true }))
      .map((d) => ({ id: d.id, titre: (reglages[d.id] && reglages[d.id].nom) || nomAffiche(d.nom) }));
  }
  return [];
}

export function lienSur(url) {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function echapper(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const DATE_OK = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

export function valider(c) {
  const erreurs = [];
  const err = (chemin, message) => erreurs.push({ chemin, message });
  const requis = (liste, chemin, cle, libelle) => liste.forEach((x, i) => {
    if (!String(x[cle] || '').trim()) err(`${chemin}.${i}.${cle}`, `${libelle} obligatoire`);
  });
  ['formation', 'experience', 'engagement'].forEach((s) => {
    const chemin = `parcours.${s}`;
    requis(c.parcours[s], chemin, 'titre', 'Titre');
    c.parcours[s].forEach((x, i) => {
      if (x.debut && !DATE_OK.test(x.debut)) err(`${chemin}.${i}.debut`, 'Date au format AAAA ou AAAA-MM');
      if (!x.enCours && x.fin && !DATE_OK.test(x.fin)) err(`${chemin}.${i}.fin`, 'Date au format AAAA ou AAAA-MM');
      else if (!x.enCours && x.debut && x.fin && DATE_OK.test(x.debut) && String(x.fin) < String(x.debut).slice(0, String(x.fin).length)) {
        err(`${chemin}.${i}.fin`, 'La fin doit être après le début');
      }
    });
  });
  requis(c.parcours.competences, 'parcours.competences', 'domaine', 'Domaine');
  requis(c.parcours.langues, 'parcours.langues', 'langue', 'Langue');
  requis(c.parcours.certifications, 'parcours.certifications', 'titre', 'Titre');
  requis(c.parcours.interets, 'parcours.interets', 'titre', 'Titre');
  requis(c.liens.categories, 'liens.categories', 'nom', 'Nom');
  requis(c.liens.items, 'liens.items', 'titre', 'Titre');
  c.liens.items.forEach((x, i) => { if (!lienSur(x.url)) err(`liens.items.${i}.url`, 'Adresse web invalide (https://…)'); });
  c.contact.autres.forEach((x, i) => { if (!lienSur(x.url)) err(`contact.autres.${i}.url`, 'Adresse web invalide (https://…)'); });
  requis(c.contact.autres, 'contact.autres', 'label', 'Nom');
  if (c.contact.linkedin && !lienSur(c.contact.linkedin)) err('contact.linkedin', 'Adresse web invalide (https://…)');
  if (c.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contact.email)) err('contact.email', 'Adresse e-mail invalide');
  return erreurs;
}
