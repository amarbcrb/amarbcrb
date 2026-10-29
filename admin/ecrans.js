/* Écrans de l'admin : formulaires qui lisent et modifient etat.contenu par chemin (« accueil.positionnement »). */
import { SOUS_PARCOURS, nouvelId, periode } from '../assets/model.js';
import { el } from '../assets/dom.js';

const ICONE_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

export function lire(objet, chemin) {
  return chemin.split('.').reduce((o, k) => (o == null ? undefined : o[k]), objet);
}

/* champs génériques ; chacun porte data-chemin et affiche l'erreur de valider() qui lui correspond */
export function champs(etat, modifier) {
  const erreur = (chemin) => el('span', { class: 'erreur', 'data-erreur': chemin });
  return {
    champTexte(chemin, libelle, { multiligne = false, type = 'text', placeholder = '', aide = '' } = {}) {
      const id = 'c-' + chemin.replace(/\W/g, '-');
      const saisie = el(multiligne ? 'textarea' : 'input', { id, 'data-chemin': chemin, type: multiligne ? null : type, placeholder });
      saisie.value = lire(etat.contenu, chemin) ?? '';
      saisie.addEventListener('input', () => modifier(chemin, saisie.value));
      return el('div', { class: 'champ' }, el('label', { for: id }, libelle), saisie, aide ? el('small', { class: 'aide' }, aide) : null, erreur(chemin));
    },
    interrupteur(chemin, libelle) {
      const boite = el('input', { type: 'checkbox', role: 'switch', 'data-chemin': chemin });
      boite.checked = lire(etat.contenu, chemin) !== false;
      boite.addEventListener('change', () => modifier(chemin, boite.checked));
      return el('label', { class: 'inter' }, el('span', {}, libelle), boite);
    },
    listePuces(chemin, libelle) {
      const id = 'c-' + chemin.replace(/\W/g, '-');
      const zone = el('div', { class: 'puces' });
      const saisie = el('input', { id, 'data-chemin': chemin, placeholder: 'Ajouter puis Entrée' });
      const dessiner = () => {
        const liste = lire(etat.contenu, chemin) || [];
        zone.replaceChildren(...liste.map((t, i) => {
          const retirer = el('button', { type: 'button', 'aria-label': 'Retirer ' + t, html: ICONE_X });
          retirer.addEventListener('click', () => { modifier(chemin, liste.filter((_, k) => k !== i)); dessiner(); });
          return el('span', {}, t, retirer);
        }));
      };
      saisie.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const t = saisie.value.trim();
        if (!t) return;
        modifier(chemin, [...(lire(etat.contenu, chemin) || []), t]);
        saisie.value = '';
        dessiner();
      });
      dessiner();
      return el('div', { class: 'champ' }, el('label', { for: id }, libelle), zone, saisie);
    },
  };
}

const ICONES = {
  haut: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>',
  bas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  poignee: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>',
};
const ouverts = new Map(); /* chemin de liste → index de l'élément en cours de modification */

/* éditeur de liste : résumé, Visible, Modifier (panneau), Supprimer, ↑ ↓ et glisser-déposer */
export function editeurListe(etat, modifier, rafraichir, chemin, { libelleElement, champs: defs, resume, nouveau = {}, prefixe = 'x' }) {
  const f = champs(etat, modifier);
  const liste = () => lire(etat.contenu, chemin) || [];
  const deplacer = (de, vers) => {
    const l = [...liste()];
    const [x] = l.splice(de, 1);
    l.splice(vers, 0, x);
    if (ouverts.get(chemin) === de) ouverts.set(chemin, vers);
    modifier(chemin, l);
    rafraichir();
  };
  const panneau = (i) => {
    const base = `${chemin}.${i}`;
    return el('div', { class: 'edition' }, defs.map((d) => {
      if (d.type === 'puces') return f.listePuces(`${base}.${d.cle}`, d.libelle);
      if (d.type === 'fin') {
        const bloc = f.champTexte(`${base}.fin`, d.libelle, { placeholder: 'AAAA-MM' });
        const saisie = bloc.querySelector('input');
        const enCours = f.interrupteur(`${base}.enCours`, 'En cours');
        const boite = enCours.querySelector('input');
        boite.checked = !!lire(etat.contenu, `${base}.enCours`);
        const appliquer = () => { saisie.disabled = boite.checked; if (boite.checked) { saisie.value = ''; modifier(`${base}.fin`, null); } };
        boite.addEventListener('change', appliquer);
        saisie.disabled = boite.checked;
        return el('div', { class: 'deux' }, bloc, enCours);
      }
      return f.champTexte(`${base}.${d.cle}`, d.libelle, { multiligne: d.type === 'multiligne', placeholder: d.type === 'date' ? 'AAAA-MM' : '' });
    }));
  };
  let glisse = null;
  const lignes = liste().map((item, i) => {
    const ouvert = ouverts.get(chemin) === i;
    const texte = el('span', { class: 'resume' }, el('b', {}, resume(item) || 'Sans titre'), item.debut !== undefined && periode(item) ? el('small', {}, periode(item)) : null);
    const bouton = (cls, libelle, html, action, desactive) => {
      const b = el('button', { type: 'button', class: cls, 'aria-label': libelle, title: libelle, html, disabled: desactive });
      b.addEventListener('click', action);
      return b;
    };
    const visible = f.interrupteur(`${chemin}.${i}.visible`, 'Visible');
    const li = el('li', { class: ouvert ? 'ligne ouverte' : 'ligne', draggable: 'true' },
      el('div', { class: 'entete' },
        el('span', { class: 'poignee', html: ICONES.poignee, 'aria-hidden': 'true' }), texte, visible,
        bouton('monter', 'Monter', ICONES.haut, () => deplacer(i, i - 1), i === 0),
        bouton('descendre', 'Descendre', ICONES.bas, () => deplacer(i, i + 1), i === liste().length - 1)),
      el('div', { class: 'actions' },
        bouton('modifier btn', ouvert ? 'Fermer' : 'Modifier', '', () => { ouverts.set(chemin, ouvert ? null : i); rafraichir(); }),
        bouton('supprimer btn', 'Supprimer', '', () => {
          if (!confirm(`Supprimer « ${resume(item) || libelleElement} » ?`)) return;
          ouverts.set(chemin, null);
          modifier(chemin, liste().filter((_, k) => k !== i));
          rafraichir();
        })),
      ouvert ? panneau(i) : null);
    li.querySelector('.modifier').textContent = ouvert ? 'Fermer' : 'Modifier';
    li.querySelector('.supprimer').textContent = 'Supprimer';
    li.addEventListener('input', () => { texte.firstChild.textContent = resume(lire(etat.contenu, `${chemin}.${i}`)) || 'Sans titre'; });
    li.addEventListener('dragstart', (e) => { glisse = i; e.dataTransfer.effectAllowed = 'move'; });
    li.addEventListener('dragover', (e) => { if (glisse !== null) e.preventDefault(); });
    li.addEventListener('drop', (e) => { e.preventDefault(); if (glisse !== null && glisse !== i) deplacer(glisse, i); glisse = null; });
    return li;
  });
  const ajouter = el('button', { type: 'button', class: 'btn ajouter' }, `Ajouter ${libelleElement}`);
  ajouter.addEventListener('click', () => {
    const l = liste();
    modifier(chemin, [...l, { id: nouvelId(prefixe), ...JSON.parse(JSON.stringify(nouveau)), visible: true }]);
    ouverts.set(chemin, l.length);
    rafraichir();
  });
  return el('div', { class: 'liste' }, lignes.length ? el('ul', {}, lignes) : el('p', { class: 'aide' }, 'Aucun élément pour le moment.'), ajouter);
}

const groupe = (titre, aide, ...enfants) => el('section', { class: 'box groupe' }, el('h2', {}, titre), aide ? el('p', { class: 'aide' }, aide) : null, ...enfants);
const bientot = (racine, titre) => racine.replaceChildren(el('h1', {}, titre), el('p', { class: 'bientot' }, 'Bientôt.'));

const TITRES_ONGLETS = { accueil: 'Accueil', parcours: 'Parcours', portfolio: 'Portfolio', liens: 'Liens', contact: 'Contact' };

export const ECRANS = [
  { id: 'accueil', titre: 'Accueil', rendre(racine, etat, modifier) {
    const f = champs(etat, modifier);
    racine.replaceChildren(el('h1', {}, 'Accueil'),
      groupe('En-tête', 'Affiché en haut de chaque page.', f.champTexte('site.nom', 'Nom'), f.champTexte('site.surtitre', 'Sous le nom', { placeholder: 'Microbiologie · Lyon 1' })),
      groupe('Présentation', 'Les blocs Formation actuelle et Dernière expérience se remplissent à partir de Parcours.',
        f.champTexte('accueil.positionnement', 'Phrase de positionnement', { multiligne: true }),
        f.champTexte('accueil.situation', 'Situation', { placeholder: 'Master 1 · Recherche un stage de M2' }),
        f.listePuces('accueil.competencesCles', 'Compétences clés')));
  } },
  { id: 'parcours', titre: 'Parcours', rendre(racine, etat, modifier, rafraichir) {
    const f = champs(etat, modifier);
    const liste = (chemin, options) => editeurListe(etat, modifier, rafraichir, chemin, options);
    const DATES = [{ cle: 'titre', libelle: 'Titre' }, { cle: 'lieu', libelle: 'Lieu' }, { cle: 'debut', libelle: 'Début', type: 'date' },
      { cle: 'fin', libelle: 'Fin', type: 'fin' }, { cle: 'description', libelle: 'Description', type: 'multiligne' }];
    const NOUVEAU_DATE = { titre: '', lieu: '', debut: '', fin: null, enCours: false, description: '' };
    const BLOCS = {
      profil: () => [f.champTexte('parcours.profil.titre', 'Titre'), f.champTexte('parcours.profil.texte', 'Texte', { multiligne: true, aide: 'Laisse une ligne vide entre deux paragraphes.' })],
      formation: () => liste('parcours.formation', { libelleElement: 'une formation', champs: DATES, resume: (x) => x.titre, nouveau: NOUVEAU_DATE, prefixe: 'f' }),
      experience: () => liste('parcours.experience', { libelleElement: 'une expérience', champs: DATES, resume: (x) => x.titre, nouveau: NOUVEAU_DATE, prefixe: 'e' }),
      engagement: () => liste('parcours.engagement', { libelleElement: 'un engagement', champs: DATES, resume: (x) => x.titre, nouveau: NOUVEAU_DATE, prefixe: 'g' }),
      competences: () => liste('parcours.competences', { libelleElement: 'une compétence', prefixe: 'c', nouveau: { domaine: '', resume: '', techniques: [] }, resume: (x) => x.domaine,
        champs: [{ cle: 'domaine', libelle: 'Domaine' }, { cle: 'resume', libelle: 'Résumé', type: 'multiligne' }, { cle: 'techniques', libelle: 'Techniques', type: 'puces' }] }),
      langues: () => liste('parcours.langues', { libelleElement: 'une langue', prefixe: 'l', nouveau: { langue: '', niveau: '' }, resume: (x) => x.langue,
        champs: [{ cle: 'langue', libelle: 'Langue' }, { cle: 'niveau', libelle: 'Niveau' }] }),
      certifications: () => liste('parcours.certifications', { libelleElement: 'une certification', prefixe: 'k', nouveau: { titre: '', organisme: '', annee: '' }, resume: (x) => x.titre,
        champs: [{ cle: 'titre', libelle: 'Titre' }, { cle: 'organisme', libelle: 'Organisme' }, { cle: 'annee', libelle: 'Année' }] }),
      interets: () => liste('parcours.interets', { libelleElement: 'un intérêt', prefixe: 'i', nouveau: { titre: '', texte: '' }, resume: (x) => x.titre,
        champs: [{ cle: 'titre', libelle: 'Titre' }, { cle: 'texte', libelle: 'Texte', type: 'multiligne' }] }),
    };
    racine.replaceChildren(el('h1', {}, 'Parcours'), ...SOUS_PARCOURS.map((id) => {
      const g = groupe(etat.contenu.onglets.parcours.sous[id].titre, '', f.interrupteur(`onglets.parcours.sous.${id}.visible`, 'Afficher sur le site'), BLOCS[id]());
      g.dataset.bloc = id;
      return g;
    }));
  } },
  { id: 'liens', titre: 'Liens', rendre: (r) => bientot(r, 'Liens') },
  { id: 'portfolio', titre: 'Portfolio', rendre: (r) => bientot(r, 'Portfolio') },
  { id: 'medias', titre: 'Médias', rendre: (r) => bientot(r, 'Médias') },
  { id: 'contact', titre: 'Contact', rendre(racine, etat, modifier, rafraichir) {
    const f = champs(etat, modifier);
    racine.replaceChildren(el('h1', {}, 'Contact'),
      groupe('Coordonnées', '', f.champTexte('contact.email', 'E-mail', { type: 'email' }), f.champTexte('contact.linkedin', 'LinkedIn', { type: 'url', placeholder: 'https://www.linkedin.com/in/…' })),
      groupe('Autres liens', '', editeurListe(etat, modifier, rafraichir, 'contact.autres', { libelleElement: 'un lien', prefixe: 'a', nouveau: { label: '', url: '' }, resume: (x) => x.label,
        champs: [{ cle: 'label', libelle: 'Nom' }, { cle: 'url', libelle: 'Adresse (https://…)' }] })),
      groupe('Ouvert à', '', editeurListe(etat, modifier, rafraichir, 'contact.ouvertA', { libelleElement: 'une ligne', prefixe: 'o', nouveau: { titre: '', detail: '' }, resume: (x) => x.titre,
        champs: [{ cle: 'titre', libelle: 'Titre' }, { cle: 'detail', libelle: 'Détail' }] })));
  } },
  { id: 'visibilite', titre: 'Visibilité et maintenance', rendre(racine, etat, modifier) {
    const f = champs(etat, modifier);
    racine.replaceChildren(el('h1', {}, 'Visibilité et maintenance'),
      groupe('Maintenance', 'Les visiteurs ne voient que ce message. Toi, connecté ici, tu vois le site avec un bandeau.',
        f.interrupteur('site.maintenance.active', 'Site en maintenance'), f.champTexte('site.maintenance.message', 'Message', { multiligne: true })),
      groupe('Onglets', 'Un onglet masqué disparaît de la barre du site.', ...Object.keys(TITRES_ONGLETS).map((id) => f.interrupteur(`onglets.${id}.visible`, TITRES_ONGLETS[id]))),
      groupe('Parties de Parcours', '', ...SOUS_PARCOURS.map((id) => f.interrupteur(`onglets.parcours.sous.${id}.visible`, etat.contenu.onglets.parcours.sous[id].titre))));
  } },
];
