/* Écrans de l'admin : formulaires qui lisent et modifient etat.contenu par chemin (« accueil.positionnement »). */
import { SOUS_PARCOURS } from '../assets/model.js';
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
  { id: 'parcours', titre: 'Parcours', rendre: (r) => bientot(r, 'Parcours') },
  { id: 'liens', titre: 'Liens', rendre: (r) => bientot(r, 'Liens') },
  { id: 'portfolio', titre: 'Portfolio', rendre: (r) => bientot(r, 'Portfolio') },
  { id: 'medias', titre: 'Médias', rendre: (r) => bientot(r, 'Médias') },
  { id: 'contact', titre: 'Contact', rendre(racine, etat, modifier) {
    const f = champs(etat, modifier);
    racine.replaceChildren(el('h1', {}, 'Contact'),
      groupe('Coordonnées', '', f.champTexte('contact.email', 'E-mail', { type: 'email' }), f.champTexte('contact.linkedin', 'LinkedIn', { type: 'url', placeholder: 'https://www.linkedin.com/in/…' })));
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
