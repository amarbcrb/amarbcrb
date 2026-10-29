/* Rendu des vues du site à partir du contenu. Tout texte venant du contenu passe par textContent,
   et seuls les liens http(s), mailto: et internes (#…) sont rendus cliquables. */
import { sousOnglets, formationActuelle, derniereExperience, periode, trierParDate, lienSur } from './model.js';
import { format } from './router.js';
import { COULEURS } from './nav.js';

const TITRES = { accueil: 'Accueil', parcours: 'Parcours', portfolio: 'Portfolio', liens: 'Liens', contact: 'Contact' };
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

const hrefSur = (v) => lienSur(v) || /^#/.test(v) || /^mailto:[^\s]+$/.test(v);
const srcSur = (v) => lienSur(v) || /^\/(?!\/)/.test(v);

/* crée un élément : attrs (class, href, src… filtrés), enfants = nœuds ou textes */
export function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === undefined || v === null || v === false) return;
    if (k === 'href' && !hrefSur(String(v))) return;
    if (k === 'src' && !srcSur(String(v))) return;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v; /* réservé aux icônes écrites dans ce fichier */
    else e.setAttribute(k, v === true ? '' : String(v));
  });
  enfants.flat().forEach((x) => { if (x !== null && x !== undefined && x !== false) e.append(x instanceof Node ? x : String(x)); });
  return e;
}

const visibles = (l) => l.filter((x) => x.visible !== false);
const paragraphes = (texte, cls) => String(texte || '').split(/\n\s*\n/).filter((p) => p.trim()).map((p) => el('p', { class: cls }, p.trim()));
const domaine = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

function rangeeSousOnglets(onglet, liste, actif) {
  if (!liste.length) return null;
  return el('nav', { class: 'sous-onglets', role: 'tablist', 'aria-label': TITRES[onglet], style: `--tc:var(${COULEURS[onglet]})` },
    liste.map((s) => el('a', { href: format({ onglet, sous: s.id }), role: 'tab', 'aria-selected': String(s.id === actif) }, s.titre)));
}

/* ---------- Accueil ---------- */
function vueAccueil(c) {
  const parcours = sousOnglets(c, 'parcours').map((s) => s.id);
  const bloc = (libelle, sous, titre, detail) => {
    const cible = parcours.includes(sous) ? format({ onglet: 'parcours', sous }) : null;
    return el(cible ? 'a' : 'div', { class: 'box bloc', href: cible },
      el('span', { class: 'lbl' }, libelle), el('b', {}, titre), detail ? el('small', {}, detail) : null,
      cible ? el('i', { html: CHEVRON }) : null);
  };
  const f = formationActuelle(c), e = derniereExperience(c), comp = c.accueil.competencesCles;
  const blocs = [
    f && bloc('Formation actuelle', 'formation', f.titre, [f.lieu, periode(f)].filter(Boolean).join(' · ')),
    e && bloc('Dernière expérience', 'experience', e.titre, [e.lieu, periode(e)].filter(Boolean).join(' · ')),
    comp.length && bloc('Compétences clés', 'competences', comp.join(' · ')),
  ].filter(Boolean);
  const cv = c.medias.cv && c.medias.cv.url;
  const contact = c.onglets.contact.visible !== false;
  return el('section', { class: 'vt accueil' },
    el('p', { class: 'lbl' }, c.site.surtitre),
    el('h1', {}, c.accueil.positionnement || c.site.nom),
    c.accueil.situation ? el('p', { class: 'situation' }, c.accueil.situation) : null,
    blocs.length ? el('div', { class: 'blocs' }, blocs) : null,
    (cv || contact) ? el('div', { class: 'acts' },
      cv ? el('a', { class: 'btn pri', href: cv, download: (c.medias.cv.nom || 'CV.pdf'), target: '_blank', rel: 'noopener' }, 'Télécharger mon CV') : null,
      contact ? el('a', { class: cv ? 'btn' : 'btn pri', href: '#contact' }, 'Me contacter') : null) : null);
}

/* ---------- Parcours ---------- */
function frise(items) {
  return el('div', { class: 'box frise' }, trierParDate(visibles(items)).map((x) => el('div', { class: x.enCours ? 'ti now' : 'ti' },
    periode(x) ? el('small', {}, periode(x)) : null, el('h4', {}, x.titre), x.lieu ? el('p', {}, x.lieu) : null,
    x.description ? el('p', { class: 'desc' }, x.description) : null)));
}

const PARCOURS = {
  profil: (c) => el('div', { class: 'profil' }, c.parcours.profil.titre ? el('h2', {}, c.parcours.profil.titre) : null, paragraphes(c.parcours.profil.texte)),
  formation: (c) => frise(c.parcours.formation),
  experience: (c) => frise(c.parcours.experience),
  engagement: (c) => frise(c.parcours.engagement),
  competences: (c) => el('div', { class: 'grid' }, visibles(c.parcours.competences).map((x) => el('article', { class: 'box card' },
    el('h3', {}, x.domaine), x.resume ? el('p', {}, x.resume) : null,
    x.techniques.length ? el('div', { class: 'tags' }, x.techniques.map((t) => el('span', {}, t))) : null))),
  langues: (c) => el('ul', { class: 'box rows' }, visibles(c.parcours.langues).map((x) => el('li', { class: 'row' }, el('span', { class: 'k' }, x.langue), el('span', { class: 'v' }, x.niveau)))),
  certifications: (c) => el('ul', { class: 'box rows certs' }, visibles(c.parcours.certifications).map((x) => el('li', { class: 'row' },
    el('span', { class: 't' }, el('b', {}, x.titre), el('small', {}, [x.organisme, x.annee].filter(Boolean).join(' · ')))))),
  interets: (c) => el('div', { class: 'grid' }, visibles(c.parcours.interets).map((x) => el('article', { class: 'box card' }, el('h3', {}, x.titre), x.texte ? el('p', {}, x.texte) : null))),
};

/* ---------- Liens ---------- */
function vueLiens(c, sous) {
  const items = visibles(c.liens.items).filter((x) => x.categorie === sous);
  const tries = items.map((x, i) => [x, i]).sort((a, b) => String(b[0].date || '').localeCompare(String(a[0].date || '')) || a[1] - b[1]).map((x) => x[0]);
  return el('div', { class: 'liens' }, tries.map((x) => el(lienSur(x.url) ? 'a' : 'div', { class: 'box carte', href: x.url, target: '_blank', rel: 'noopener noreferrer' },
    lienSur(x.image) ? el('img', { src: x.image, alt: '', loading: 'lazy' }) : null,
    el('div', {}, el('b', {}, x.titre), x.description ? el('p', {}, x.description) : null, domaine(x.url) ? el('small', {}, domaine(x.url)) : null))));
}

/* ---------- Contact ---------- */
function vueContact(c) {
  const k = c.contact;
  const lignes = [
    k.email && el('li', { class: 'row' }, el('span', { class: 't' }, el('b', {}, 'E-mail'), el('small', {}, k.email)),
      el('button', { class: 'cp', type: 'button', 'data-copier': k.email }, 'Copier')),
    lienSur(k.linkedin) && el('li', {}, el('a', { class: 'row', href: k.linkedin, target: '_blank', rel: 'noopener' },
      el('span', { class: 't' }, el('b', {}, 'LinkedIn'), el('small', {}, k.linkedin.replace(/^https?:\/\/(www\.)?/, ''))), el('i', { html: CHEVRON }))),
    ...visibles(k.autres).map((x) => el('li', {}, el(lienSur(x.url) ? 'a' : 'div', { class: 'row', href: x.url, target: '_blank', rel: 'noopener' },
      el('span', { class: 't' }, el('b', {}, x.label), el('small', {}, domaine(x.url))), el('i', { html: CHEVRON })))),
  ].filter(Boolean);
  const ouvert = visibles(k.ouvertA);
  return el('div', { class: 'ct' },
    lignes.length ? el('ul', { class: 'box rows' }, lignes) : null,
    ouvert.length ? el('span', { class: 'gh' }, 'Ouvert à') : null,
    ouvert.length ? el('ul', { class: 'box rows' }, ouvert.map((x) => el('li', { class: 'row' }, el('span', { class: 't' }, el('b', {}, x.titre), x.detail ? el('small', {}, x.detail) : null)))) : null);
}

/* ---------- Point d'entrée ---------- */
export function rendreVue(racine, c, { onglet, sous }, dossiers = []) {
  if (onglet === 'accueil') { racine.replaceChildren(vueAccueil(c)); return; }
  const liste = sousOnglets(c, onglet, dossiers);
  const section = el('section', { class: `vt v-${onglet}` }, el('h1', {}, TITRES[onglet]), rangeeSousOnglets(onglet, liste, sous));
  let panneau = null;
  if (onglet === 'parcours') panneau = sous && PARCOURS[sous] ? PARCOURS[sous](c) : el('p', { class: 'vide' }, 'Parcours bientôt disponible.');
  else if (onglet === 'liens') panneau = sous ? vueLiens(c, sous) : el('p', { class: 'vide' }, 'Aucun lien pour le moment.');
  else if (onglet === 'contact') panneau = vueContact(c);
  else if (onglet === 'portfolio') panneau = el('p', { class: 'vide' }, 'Portfolio bientôt disponible.');
  section.append(el('div', { class: 'panneau', role: liste.length ? 'tabpanel' : null }, panneau));
  racine.replaceChildren(section);
}
