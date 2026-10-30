/* Écrans de l'admin (allégé) : Médias, Visibilité et maintenance, Onglets. Le reste se modifie sur le site (appui long sur le nom).
   Formulaires qui lisent et modifient etat.contenu par chemin (« site.nom »). */
import { SOUS_PARCOURS, nouvelId, periode, nomAffiche, ICONES_ONGLET, MAX_ONGLETS, ongletsVisibles } from '../assets/model.js';
import { appeler, lirePortfolio } from '../assets/api.js';
import { reduireImage, enBase64 } from './images.js';
import { el } from '../assets/dom.js';
import { champMedia } from '../assets/champ-media.js';

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
    champSelect(chemin, libelle, options) {
      const id = 'c-' + chemin.replace(/\W/g, '-');
      const choix = el('select', { id, 'data-chemin': chemin }, options.map((o) => el('option', { value: o.valeur }, o.libelle)));
      choix.value = lire(etat.contenu, chemin) ?? '';
      choix.addEventListener('change', () => modifier(chemin, choix.value));
      return el('div', { class: 'champ' }, el('label', { for: id }, libelle), choix, erreur(chemin));
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
export function editeurListe(etat, modifier, rafraichir, chemin, { libelleElement, champs: defs, resume, nouveau = {}, prefixe = 'x', refuserSuppression = () => null, refuserAjout = () => null }) {
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
      if (d.type === 'rendu') return d.rendre(base, f);
      if (d.type === 'puces') return f.listePuces(`${base}.${d.cle}`, d.libelle);
      if (d.type === 'select') return f.champSelect(`${base}.${d.cle}`, d.libelle, d.options());
      if (d.type === 'image') return champMedia({ valeur: lire(etat.contenu, `${base}.${d.cle}`), libelle: d.libelle, cle: 'image-' + base, onChange: (v) => modifier(`${base}.${d.cle}`, v) });
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
          const refus = refuserSuppression(item);
          if (refus) { alert(refus); return; }
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
    const refus = refuserAjout();
    if (refus) { alert(refus); return; }
    const l = liste();
    modifier(chemin, [...l, { id: nouvelId(prefixe), ...JSON.parse(JSON.stringify(nouveau)), visible: true }]);
    ouverts.set(chemin, l.length);
    rafraichir();
  });
  return el('div', { class: 'liste' }, lignes.length ? el('ul', {}, lignes) : el('p', { class: 'aide' }, 'Aucun élément pour le moment.'), ajouter);
}

const groupe = (titre, aide, ...enfants) => el('section', { class: 'box groupe' }, el('h2', {}, titre), aide ? el('p', { class: 'aide' }, aide) : null, ...enfants);
const ERREURS = { reseau: 'Pas de réseau. Réessaie.', jeton: 'Session expirée : recharge la page et reconnecte-toi.', entree: 'Fichier ou adresse refusé par le script.', interne: 'Le script Google a rencontré une erreur. Réessaie.' };
const messageErreur = (err) => ERREURS[err && err.code] || ERREURS.interne;
const bouton = (id, texte, cls = 'btn') => el('button', { type: 'button', id, class: cls }, texte);

/* ---------- Portfolio : dossier Drive et sous-dossiers ---------- */
function groupesPortfolio(etat, modifier) {
  const f = champs(etat, modifier);
  const liste = el('div', { id: 'dossiersListe', class: 'dossiers' }, el('p', { class: 'aide' }, 'Lecture de Drive…'));
  const message = el('p', { id: 'portfolioMessage', class: 'aide', role: 'status' });
  const dessiner = (dossiers) => {
    if (!dossiers) { liste.replaceChildren(el('p', { class: 'aide' }, 'Drive indisponible pour le moment.')); return; }
    if (!dossiers.length) { liste.replaceChildren(el('p', { class: 'aide' }, 'Aucun sous-dossier : crée-en un par catégorie dans ton dossier Portfolio.')); return; }
    liste.replaceChildren(...dossiers.map((d) => el('div', { class: 'ligne dossier' },
      f.interrupteur(`portfolio.dossiers.${d.id}.visible`, `${nomAffiche(d.nom)}${d.fichiers ? ` · ${d.fichiers.length} fichier${d.fichiers.length > 1 ? 's' : ''}` : ''}`),
      f.champTexte(`portfolio.dossiers.${d.id}.nom`, 'Nom affiché (facultatif)', { placeholder: nomAffiche(d.nom) }))));
  };
  const lien = el('input', { id: 'dossierLien', type: 'url', placeholder: 'https://drive.google.com/drive/folders/…' });
  const valider = bouton('dossierValider', 'Utiliser ce dossier', 'btn pri');
  const relire = bouton('relireDrive', 'Relire Drive');
  valider.addEventListener('click', async () => {
    message.textContent = 'Connexion au dossier…';
    try {
      const r = await appeler('dossierPortfolio', { lienDossier: lien.value.trim() });
      modifier('portfolio.dossierRacineId', r.id);
      dessiner(r.sousDossiers);
      message.textContent = `Dossier choisi : ${r.sousDossiers.length} sous-dossier${r.sousDossiers.length > 1 ? 's' : ''}. Pense à enregistrer.`;
    } catch (err) { message.textContent = err.code === 'entree' ? 'Lien de dossier Drive non reconnu.' : messageErreur(err); }
  });
  relire.addEventListener('click', async () => {
    message.textContent = 'Lecture de Drive…';
    const d = await lirePortfolio({ frais: true });
    dessiner(d);
    message.textContent = d ? `Drive relu : ${d.length} dossier${d.length > 1 ? 's' : ''}.` : 'Drive indisponible pour le moment.';
  });
  lirePortfolio().then(dessiner);
  return [
    groupe('Dossier Drive du Portfolio', 'Colle le lien du dossier qui contient tes sous-dossiers (Design, Posters…). Ses fichiers sont partagés en lecture un par un.',
      el('div', { class: 'champ' }, el('label', { for: 'dossierLien' }, 'Lien du dossier'), lien), el('div', { class: 'acts' }, valider, relire), message),
    groupe('Dossiers du Portfolio', 'Chaque dossier visible devient une rangée du Portfolio. Fichiers, liens et mots de passe : sur le site, en mode Modifier.', liste)];
}

/* ---------- Médias : le nouveau fichier remplace l'ancien ---------- */
const MEDIAS = [
  { id: 'photo', titre: 'Photo', aide: 'Portrait affiché sur la page Contact. Réduite à 2000 px.', accepte: 'image/*', max: 2000 },
  { id: 'logo', titre: 'Logo', aide: 'Affiché dans l\'en-tête et la page de maintenance. Réduit à 2000 px.', accepte: 'image/*', max: 2000 },
  { id: 'favicon', titre: 'Favicon', aide: 'Icône de l\'onglet du navigateur, en PNG 512 px. Google et l\'icône iPhone gardent celle du dépôt.', accepte: 'image/*', max: 512, type: 'image/png' },
  { id: 'cv', titre: 'CV', aide: 'PDF de moins de 10 Mo, proposé au téléchargement sur l\'accueil.', accepte: 'application/pdf' },
];
const CV_MAX = 10 * 1024 * 1024;

function ecranMedias(racine, etat, modifier) {
  const f = champs(etat, modifier);
  const identite = groupe('Identité', 'Ton nom, en haut de chaque page, et la ligne affichée dessous dans la fiche Contact.',
    f.champTexte('site.nom', 'Nom'), f.champTexte('site.surtitre', 'Sous le nom, dans la fiche Contact', { placeholder: 'Microbiologie · Lyon 1' }));
  racine.replaceChildren(el('h1', {}, 'Médias'), identite, ...MEDIAS.map((m) => {
    const actuel = etat.contenu.medias[m.id];
    const apercu = m.id === 'cv'
      ? el('a', { 'data-apercu': 'cv', href: actuel && actuel.url, target: '_blank', rel: 'noopener', class: 'lnk' }, actuel ? (actuel.nom || 'CV actuel') : 'Aucun CV')
      : el('img', { 'data-apercu': m.id, src: actuel && actuel.url, alt: '', class: 'apercu-media' });
    const fichier = el('input', { type: 'file', accept: m.accepte, 'data-media': m.id, id: 'media-' + m.id });
    const message = el('small', { class: 'aide', 'data-message': m.id, role: 'status' });
    fichier.addEventListener('change', async () => {
      const f = fichier.files[0];
      if (!f) return;
      try {
        let envoi;
        if (m.id === 'cv') {
          if (f.type !== 'application/pdf') { message.textContent = 'Le CV doit être un PDF.'; return; }
          if (f.size > CV_MAX) { message.textContent = 'Le CV doit faire moins de 10 Mo.'; return; }
          envoi = { base64: await enBase64(f), type: 'application/pdf' };
        } else {
          if (!f.type.startsWith('image/')) { message.textContent = 'Choisis une image.'; return; }
          message.textContent = 'Préparation de l\'image…';
          /* un logo PNG reste en PNG pour garder sa transparence */
          envoi = await reduireImage(f, m.max, m.type || (m.id === 'logo' && f.type === 'image/png' ? 'image/png' : 'image/jpeg'));
        }
        message.textContent = 'Envoi…';
        const r = await appeler('envoyerMedia', { emplacement: m.id, nom: f.name, type: envoi.type, base64: envoi.base64 });
        modifier(`medias.${m.id}`, m.id === 'cv' ? { id: r.id, url: r.url, nom: f.name } : { id: r.id, url: r.url });
        if (m.id === 'cv') { apercu.textContent = f.name; apercu.href = r.url; } else apercu.src = r.url;
        message.textContent = m.id === 'cv' ? 'CV envoyé. Pense à enregistrer.' : 'Image envoyée. Pense à enregistrer.';
      } catch (err) {
        message.textContent = messageErreur(err);
      } finally {
        fichier.value = '';
      }
    });
    return groupe(m.titre, m.aide, apercu, el('label', { class: 'btn', for: 'media-' + m.id }, 'Remplacer'), fichier, message);
  }));
}

const TITRES_ONGLETS = { accueil: 'Accueil', parcours: 'Parcours', portfolio: 'Portfolio', liens: 'Liens', contact: 'Fiche Contact' };
const ICONES_LIBELLES = { etoile: 'Étoile', appareil: 'Appareil photo', carte: 'Carte', livre: 'Livre', musique: 'Musique', globe: 'Globe', pinceau: 'Pinceau', flacon: 'Flacon' };
const COULEURS_ONGLET = { '--c-blue': 'Bleu', '--c-indigo': 'Indigo', '--c-purple': 'Violet', '--c-pink': 'Rose', '--c-red': 'Rouge', '--c-orange': 'Orange',
  '--c-yellow': 'Jaune', '--c-green': 'Vert', '--c-teal': 'Turquoise', '--c-cyan': 'Cyan' };
const options = (o) => () => Object.entries(o).map(([valeur, libelle]) => ({ valeur, libelle }));

/* ---------- Onglets : rangées libres (cartes ajoutées sur le site) ou galerie d'un dossier Drive ---------- */
function ecranOnglets(racine, etat, modifier, rafraichir) {
  /* lien du dossier Drive d'une galerie : le script le partage et renvoie son identifiant */
  const galerie = (base) => {
    const lien = el('input', { type: 'url', class: 'lien-galerie', placeholder: 'https://drive.google.com/drive/folders/…', 'aria-label': 'Lien du dossier Drive' });
    const message = el('small', { class: 'aide', role: 'status' }, lire(etat.contenu, `${base}.dossierId`) ? 'Dossier Drive déjà choisi.' : '');
    const valider = el('button', { type: 'button', class: 'btn pri' }, 'Utiliser ce dossier');
    valider.addEventListener('click', async () => {
      message.textContent = 'Connexion au dossier…';
      try {
        const r = await appeler('dossierGalerie', { lienDossier: lien.value.trim() });
        modifier(`${base}.dossierId`, r.id);
        message.textContent = `Dossier choisi : ${r.nom || r.id}. Pense à enregistrer.`;
      } catch (err) { message.textContent = err.code === 'entree' ? 'Lien de dossier Drive non reconnu.' : messageErreur(err); }
    });
    const bloc = el('div', { class: 'champ galerie', hidden: lire(etat.contenu, `${base}.type`) !== 'drive' },
      el('span', { class: 'champ-titre' }, 'Dossier Drive de la galerie'), lien, el('div', { class: 'acts' }, valider), message);
    return bloc;
  };
  const type = (base, f) => {
    const champ = f.champSelect(`${base}.type`, 'Contenu', [{ valeur: 'rangees', libelle: 'Rangées libres (cartes ajoutées sur le site)' }, { valeur: 'drive', libelle: 'Galerie Drive (images et fichiers d\'un dossier)' }]);
    champ.querySelector('select').addEventListener('change', (e) => {
      const g = champ.parentElement && champ.parentElement.querySelector('.galerie');
      if (g) g.hidden = e.target.value !== 'drive';
    });
    return champ;
  };
  const liste = groupe('Mes onglets', `Chaque onglet visible s'ajoute à la barre du site, après les onglets de base (${MAX_ONGLETS} au plus en tout). Son contenu se remplit sur le site, en mode Modifier.`,
    editeurListe(etat, modifier, rafraichir, 'onglets.perso', {
      libelleElement: 'un onglet', prefixe: 'tab', resume: (x) => x.nom, nouveau: { nom: '', icone: 'etoile', couleur: '--c-purple', type: 'rangees', dossierId: '' },
      champs: [{ cle: 'nom', libelle: 'Nom' }, { cle: 'icone', libelle: 'Icône', type: 'select', options: () => ICONES_ONGLET.map((v) => ({ valeur: v, libelle: ICONES_LIBELLES[v] || v })) },
        { cle: 'couleur', libelle: 'Couleur', type: 'select', options: options(COULEURS_ONGLET) },
        { type: 'rendu', rendre: type }, { type: 'rendu', rendre: galerie }],
      refuserAjout: () => (ongletsVisibles(etat.contenu).length >= MAX_ONGLETS
        ? `La barre affiche ${MAX_ONGLETS} onglets au plus : masque ou supprime un onglet avant d'en créer un autre.` : null) }));
  liste.dataset.bloc = 'onglets';
  racine.replaceChildren(el('h1', {}, 'Onglets'), liste);
}

export const ECRANS = [
  { id: 'medias', titre: 'Médias', rendre: ecranMedias },
  { id: 'visibilite', titre: 'Visibilité et maintenance', rendre(racine, etat, modifier) {
    const f = champs(etat, modifier);
    racine.replaceChildren(el('h1', {}, 'Visibilité et maintenance'),
      groupe('Maintenance', 'Les visiteurs ne voient que ce message. Toi, connecté ici, tu vois le site avec un bandeau.',
        f.interrupteur('site.maintenance.active', 'Site en maintenance'), f.champTexte('site.maintenance.message', 'Message', { multiligne: true })),
      groupe('Onglets', 'Un onglet masqué disparaît de la barre du site. Fiche Contact masquée : le bouton Contact disparaît. Tes onglets à toi se masquent dans l\'écran Onglets.', ...Object.keys(TITRES_ONGLETS).map((id) => f.interrupteur(`onglets.${id}.visible`, TITRES_ONGLETS[id]))),
      groupe('Rubriques de Parcours', '', ...SOUS_PARCOURS.map((id) => f.interrupteur(`onglets.parcours.sous.${id}.visible`, etat.contenu.onglets.parcours.sous[id].titre))),
      ...groupesPortfolio(etat, modifier));
  } },
  { id: 'onglets', titre: 'Onglets', rendre: ecranOnglets },
];
