/* Modèle de contenu du site : forme attendue de contenu.json et fonctions pures pour le lire.
   Aucune dépendance au DOM : le module est importé par le site, l'admin et les tests Node. */

/* onglets de la barre ; Contact n'en fait plus partie (fiche ouverte depuis l'en-tête) */
export const ONGLETS = ['accueil', 'parcours', 'portfolio', 'liens'];
/* onglets créés dans l'admin : icônes au choix, 6 onglets au plus dans la barre (intégrés compris) */
export const ICONES_ONGLET = ['etoile', 'appareil', 'carte', 'livre', 'musique', 'globe', 'pinceau', 'flacon'];
export const MAX_ONGLETS = 6;
/* rangées de l'onglet Parcours, dans l'ordre d'affichage (le profil est en tête de page) */
export const PARTIES_PARCOURS = ['formation', 'experience', 'competences', 'certifications', 'langues', 'engagement', 'interets'];
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
  'parcours.competences': { domaine: '', resume: '', techniques: [], image: null },
  'parcours.langues': { langue: '', niveau: '', drapeau: '' },
  'parcours.certifications': { titre: '', organisme: '', annee: '', url: '', image: null },
  'parcours.interets': { titre: '', texte: '', image: null },
  'liens.categories': { nom: '' },
  'accueil.reperes': { valeur: '', libelle: '' },
  'accueil.domaines': { titre: '', texte: '', image: null, lien: '' },
  'onglets.perso': { nom: '', icone: 'etoile', couleur: '--c-purple', type: 'rangees', dossierId: '' },
  'pages.rangees': { titre: '', cartes: [] },
  cartes: { titre: '', texte: '', media: null, lien: '', bouton: '' },
  'liens.items': { url: '', titre: '', description: '', image: '', categorie: '', date: '', bouton: '', type: '', media: null, avis: '' },
  'contact.autres': { label: '', url: '' },
  'contact.ouvertA': { titre: '', detail: '' },
};
const PREFIXES = {
  'parcours.formation': 'f', 'parcours.experience': 'e', 'parcours.engagement': 'g', 'parcours.competences': 'c',
  'parcours.langues': 'l', 'parcours.certifications': 'k', 'parcours.interets': 'i', 'liens.categories': 'cat',
  'liens.items': 'u', 'contact.autres': 'a', 'contact.ouvertA': 'o', 'accueil.reperes': 'r', 'accueil.domaines': 'd', 'onglets.perso': 'tab', 'pages.rangees': 'rg', cartes: 'ct',
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
      liens: { visible: true }, contact: { visible: true }, perso: [],
    },
    accueil: { salutation: '', intro: '', reperes: [], domaines: [], projetPhare: '' },
    parcours: {
      profil: { titre: '', texte: '' },
      formation: [], experience: [], engagement: [], competences: [], langues: [], certifications: [], interets: [],
    },
    liens: { categories: [], items: [], alireAjoute: false },
    portfolio: { dossierRacineId: '', dossiers: {} },
    pages: {},
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
  /* pages des onglets libres : { idOnglet: { rangees: [{ titre, cartes: [...] }] } } */
  const pages = {};
  Object.entries(estObjet(brut) && estObjet(brut.pages) ? brut.pages : {}).forEach(([id, pg]) => {
    pages[id] = { rangees: fusionner([], estObjet(pg) ? pg.rangees : [], 'pages.rangees') };
  });
  c.pages = pages;
  /* catégorie « À lire » (partages) ajoutée une seule fois : supprimée ensuite, elle ne revient pas */
  if (!c.liens.alireAjoute) {
    if (!c.liens.categories.some((x) => x.id === 'alire')) c.liens.categories.push({ id: 'alire', nom: 'À lire', visible: true });
    c.liens.alireAjoute = true;
  }
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

/* durée d'une étape (« 3 mois », « 1 an et 10 mois ») ; mois comptés inclus ; en cours : jusqu'à aujourd'hui */
export function duree(item, aujourdhui = new Date()) {
  const lire = (d) => { const m = /^(\d{4})(?:-(\d{2}))?$/.exec(String(d || '')); return m ? { a: Number(m[1]), m: m[2] ? Number(m[2]) : null } : null; };
  const debut = lire(item.debut);
  const fin = item.enCours ? { a: aujourdhui.getFullYear(), m: aujourdhui.getMonth() + 1 } : lire(item.fin);
  if (!debut || !fin) return '';
  const mois = debut.m && fin.m ? (fin.a - debut.a) * 12 + (fin.m - debut.m) + 1 : (fin.a - debut.a) * 12;
  if (mois <= 0) return '';
  const ans = Math.floor(mois / 12), reste = mois % 12;
  return [ans ? `${ans} an${ans > 1 ? 's' : ''}` : '', reste ? `${reste} mois` : ''].filter(Boolean).join(' et ');
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
  const perso = (c.onglets.perso || []).filter((o) => o.visible !== false).map((o) => o.id);
  const liste = [...ONGLETS.filter((id) => c.onglets[id] && c.onglets[id].visible !== false), ...perso].slice(0, MAX_ONGLETS);
  return liste.length ? liste : ['accueil'];
}

export const ongletPerso = (c, id) => (c.onglets.perso || []).find((o) => o.id === id) || null;

export function nomAffiche(nom) {
  return String(nom || '').replace(/^\d+\s*-\s*/, '');
}

export const contactVisible = (c) => !(c.onglets.contact && c.onglets.contact.visible === false);

/* seules les parties de Parcours ouvrent une fiche détaillée ; langues et intérêts montrent tout sur leur carte */
export const aFiche = (onglet, partie, c = null) => {
  /* liens : fiche ouverte depuis un partage (post LinkedIn intégré, mon avis) */
  if (onglet === 'liens') return partie !== 'tous';
  if (onglet === 'parcours') return PARTIES_PARCOURS.includes(partie) && partie !== 'langues' && partie !== 'interets';
  /* cartes des onglets libres : fiche avec texte, lecteur vidéo et bouton du lien */
  const o = c && ongletPerso(c, onglet);
  return !!o && o.type === 'rangees';
};

const DATEES = ['formation', 'experience', 'engagement'];

/* parties d'un onglet, chacune avec ses éléments visibles : une rangée par partie */
export function parties(c, onglet, dossiersPortfolio = []) {
  if (onglet === 'parcours') {
    const sous = c.onglets.parcours.sous;
    return PARTIES_PARCOURS.filter((id) => !sous[id] || sous[id].visible !== false)
      .map((id) => {
        const items = visibles(c.parcours[id]);
        return { id, titre: (sous[id] && sous[id].titre) || TITRES_PARCOURS[id], items: DATEES.includes(id) ? trierParDate(items) : items };
      })
      .filter((p) => p.items.length);
  }
  if (onglet === 'liens') {
    const items = visibles(c.liens.items).map((x, i) => [x, i])
      .sort((a, b) => String(b[0].date || '').localeCompare(String(a[0].date || '')) || a[1] - b[1]).map((x) => x[0]);
    const cats = visibles(c.liens.categories)
      .map((cat) => ({ id: cat.id, titre: cat.nom, items: items.filter((x) => x.categorie === cat.id) }))
      .filter((p) => p.items.length);
    /* « Tous les liens » : page Voir tout de l'onglet entier (lien « Tout afficher ») */
    return cats.length ? [...cats, { id: 'tous', titre: 'Tous les liens', items: cats.flatMap((p) => p.items).sort((a, b) => items.indexOf(a) - items.indexOf(b)) }] : [];
  }
  const perso = ongletPerso(c, onglet);
  if (perso && perso.type === 'rangees') {
    /* rangées vides gardées : on y ajoute des cartes en édition ; le site les masque aux visiteurs */
    return visibles(((c.pages[onglet] || {}).rangees) || [])
      .map((r) => ({ id: r.id, titre: r.titre, items: visibles(r.cartes) }));
  }
  if (perso && perso.type === 'drive') {
    /* dossiersPortfolio : réponse ?a=galerie { dossiers, fichiers } ; les fichiers de la racine forment la première rangée */
    const liste = dossiersPortfolio && !Array.isArray(dossiersPortfolio) ? dossiersPortfolio : { dossiers: dossiersPortfolio || [], fichiers: [] };
    const racine = (liste.fichiers || []).length ? [{ id: 'racine', titre: perso.nom, items: liste.fichiers }] : [];
    return racine.concat([...(liste.dossiers || [])].sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr', { numeric: true }))
      .map((d) => ({ id: d.id, titre: nomAffiche(d.nom), items: d.fichiers || [], protege: !!d.protege, liens: d.liens || [] })));
  }
  if (onglet === 'portfolio') {
    const reglages = c.portfolio.dossiers;
    return [...dossiersPortfolio]
      .filter((d) => !reglages[d.id] || reglages[d.id].visible !== false)
      .sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr', { numeric: true }))
      .map((d) => ({ id: d.id, titre: (reglages[d.id] && reglages[d.id].nom) || nomAffiche(d.nom), items: d.fichiers || [], protege: !!d.protege, liens: d.liens || [] }));
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

/* nature d'un lien : choisie dans l'admin, sinon déduite de l'adresse (extension d'abord, puis site) */
export const TYPES_LIEN = { web: 'Site web', video: 'Vidéo', image: 'Image', appli: 'Appli', document: 'Document', code: 'Code', article: 'Article', linkedin: 'Post LinkedIn' };
const EXTENSIONS = [
  [/\.(jpe?g|png|webp|gif|avif|svg)$/, 'image'], [/\.(mp4|webm|mov)$/, 'video'],
  [/\.apk$/, 'appli'], [/\.(pdf|docx?|pptx?|xlsx?)$/, 'document'],
];
const SITES = [
  [/(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|dailymotion\.com)$/, 'video'],
  [/^(play\.google\.com|apps\.apple\.com)$/, 'appli'],
  [/^(docs|drive)\.google\.com$/, 'document'],
  [/(^|\.)(github\.com|gitlab\.com|codeberg\.org|bitbucket\.org)$/, 'code'],
  [/(^|\.)(medium\.com|substack\.com)$/, 'article'],
];
export function typeLien(item, c = null) {
  if (Object.hasOwn(TYPES_LIEN, item.type)) return item.type;
  let u;
  try { u = new URL(item.url); } catch { return 'web'; }
  const chemin = u.pathname.toLowerCase(), hote = u.hostname.toLowerCase().replace(/^www\./, '');
  if (/(^|\.)linkedin\.com$/.test(hote)) {
    if (/^\/(posts|feed\/update)\//.test(chemin)) return 'linkedin';
    if (/^\/pulse\//.test(chemin)) return 'article';
  }
  const trouve = EXTENSIONS.find(([re]) => re.test(chemin)) || SITES.find(([re]) => re.test(hote));
  if (trouve) return trouve[1];
  if (/\/(blog|articles?)\//.test(chemin)) return 'article';
  const cat = c && c.liens.categories.find((x) => x.id === item.categorie);
  return cat && /article/i.test(cat.nom) ? 'article' : 'web';
}

/* post LinkedIn public → adresse de son intégration (linkedin.com/embed/…), sinon null */
export function urlIntegrationLinkedin(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:' || !/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
  const m = /\/feed\/update\/urn:li:(activity|share|ugcPost):(\d+)/.exec(u.pathname) || /^\/posts\/.*-(activity|share|ugcPost)-(\d+)/.exec(u.pathname);
  return m ? `https://www.linkedin.com/embed/feed/update/urn:li:${m[1]}:${m[2]}` : null;
}

/* nature d'un média (image, GIF, vidéo, YouTube) : type donné, sinon déduit de l'adresse */
export function idYoutube(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const hote = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const id = hote === 'youtu.be' ? u.pathname.slice(1).split('/')[0]
    : hote === 'youtube.com' ? (u.searchParams.get('v') || (/^\/(shorts|embed)\/([\w-]+)/.exec(u.pathname) || [])[2]) : null;
  return id && /^[\w-]{6,20}$/.test(id) ? id : null;
}

export function typeMedia(m) {
  const url = typeof m === 'string' ? m : m && m.url;
  if (!url) return null;
  if (m && typeof m === 'object' && ['image', 'video', 'youtube'].includes(m.type)) return m.type;
  if (idYoutube(url)) return 'youtube';
  return /\.(mp4|webm)(\?|#|$)/i.test(url) ? 'video' : 'image';
}

/* drapeau d'une langue : choisi dans l'admin, sinon deviné depuis le nom */
export const DRAPEAUX = { fr: 'France', arabe: 'Ligue arabe', amazigh: 'Amazigh', gb: 'Royaume-Uni', us: 'États-Unis', es: 'Espagne', dz: 'Algérie', de: 'Allemagne', it: 'Italie' };
const LANGUES = [[/^fran/, 'fr'], [/^arabe/, 'arabe'], [/^(kabyle|tamazight|berb|amazigh)/, 'amazigh'], [/^anglais/, 'gb'], [/^espagnol/, 'es'], [/^allemand/, 'de'], [/^italien/, 'it']];
export function drapeauLangue(x) {
  if (Object.hasOwn(DRAPEAUX, x.drapeau)) return x.drapeau;
  const nom = String(x.langue || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const trouve = LANGUES.find(([re]) => re.test(nom));
  return trouve ? trouve[1] : '';
}

/* une couleur par rubrique de Parcours ; catégories de liens et dossiers prennent la palette dans l'ordre */
const COULEURS_PARCOURS = {
  formation: '--c-blue', experience: '--c-orange', competences: '--c-purple', certifications: '--c-green',
  langues: '--c-cyan', engagement: '--c-pink', interets: '--c-yellow',
};
const PALETTE = ['--c-blue', '--c-orange', '--c-purple', '--c-green', '--c-pink', '--c-cyan', '--c-yellow', '--c-teal', '--c-indigo', '--c-red'];
export function couleurPartie(onglet, id, indice) {
  return (onglet === 'parcours' && COULEURS_PARCOURS[id]) || PALETTE[indice % PALETTE.length];
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
  c.parcours.certifications.forEach((x, i) => { if (x.url && !lienSur(x.url)) err(`parcours.certifications.${i}.url`, 'Adresse web invalide (https://…)'); });
  requis(c.parcours.interets, 'parcours.interets', 'titre', 'Titre');
  requis(c.accueil.domaines, 'accueil.domaines', 'titre', 'Titre');
  requis(c.onglets.perso, 'onglets.perso', 'nom', 'Nom');
  c.onglets.perso.forEach((o, i) => {
    if (!['rangees', 'drive'].includes(o.type)) err(`onglets.perso.${i}.type`, 'Type inconnu');
    else if (o.type === 'drive' && !o.dossierId) err(`onglets.perso.${i}.dossierId`, 'Choisis le dossier Drive');
  });
  Object.entries(c.pages).forEach(([id, pg]) => pg.rangees.forEach((r, i) => r.cartes.forEach((x, k) => {
    const ch = `pages.${id}.rangees.${i}.cartes.${k}`;
    if (!String(x.titre || '').trim()) err(`${ch}.titre`, 'Titre obligatoire');
    if (x.lien && !lienSur(x.lien) && !/^#[\w/-]*$/.test(x.lien)) err(`${ch}.lien`, 'Lien invalide (#onglet ou https://…)');
  })));
  c.accueil.domaines.forEach((x, i) => { if (x.lien && !/^#[\w/-]*$/.test(x.lien) && !lienSur(x.lien)) err(`accueil.domaines.${i}.lien`, 'Lien invalide (#onglet ou https://…)'); });
  requis(c.liens.categories, 'liens.categories', 'nom', 'Nom');
  requis(c.liens.items, 'liens.items', 'titre', 'Titre');
  c.liens.items.forEach((x, i) => { if (!lienSur(x.url)) err(`liens.items.${i}.url`, 'Adresse web invalide (https://…)'); });
  c.liens.items.forEach((x, i) => { if (x.type && !Object.hasOwn(TYPES_LIEN, x.type)) err(`liens.items.${i}.type`, 'Type inconnu'); });
  c.contact.autres.forEach((x, i) => { if (!lienSur(x.url)) err(`contact.autres.${i}.url`, 'Adresse web invalide (https://…)'); });
  requis(c.contact.autres, 'contact.autres', 'label', 'Nom');
  if (c.contact.linkedin && !lienSur(c.contact.linkedin)) err('contact.linkedin', 'Adresse web invalide (https://…)');
  if (c.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contact.email)) err('contact.email', 'Adresse e-mail invalide');
  return erreurs;
}
