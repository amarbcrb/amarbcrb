/* Écrans de l'admin : formulaires qui lisent et modifient etat.contenu par chemin (« accueil.positionnement »). */
import { SOUS_PARCOURS, nouvelId, periode, lienSur, nomAffiche, TYPES_LIEN, DRAPEAUX } from '../assets/model.js';
import { appeler, lirePortfolio } from '../assets/api.js';
import { reduireImage, enBase64 } from './images.js';
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
export function editeurListe(etat, modifier, rafraichir, chemin, { libelleElement, champs: defs, resume, nouveau = {}, prefixe = 'x', refuserSuppression = () => null }) {
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
      if (d.type === 'select') return f.champSelect(`${base}.${d.cle}`, d.libelle, d.options());
      if (d.type === 'image') return champImage(etat, modifier, `${base}.${d.cle}`, d.libelle);
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

/* ---------- Liens : ajout par URL, liste, catégories ---------- */
const optionsType = () => [{ valeur: '', libelle: 'Automatique' }, ...Object.entries(TYPES_LIEN).map(([valeur, libelle]) => ({ valeur, libelle }))];
function ecranLiens(racine, etat, modifier, rafraichir) {
  const c = etat.contenu;
  const options = () => c.liens.categories.map((x) => ({ valeur: x.id, libelle: x.nom }));
  const saisie = (id, libelle, attrs = {}) => el('div', { class: 'champ' }, el('label', { for: id }, libelle), el(attrs.multiligne ? 'textarea' : 'input', { id, type: attrs.multiligne ? null : 'text', placeholder: attrs.placeholder || '' }));
  const ajout = el('section', { class: 'box groupe' }, el('h2', {}, 'Ajouter un lien'),
    el('p', { class: 'aide' }, 'Colle l\'adresse : le titre, la description et l\'image se remplissent seuls. Tu peux les corriger avant d\'ajouter.'),
    saisie('ajoutUrl', 'Adresse', { placeholder: 'https://…' }),
    el('div', { class: 'champ' }, el('label', { for: 'ajoutCat' }, 'Catégorie'), el('select', { id: 'ajoutCat' }, options().map((o) => el('option', { value: o.valeur }, o.libelle)))),
    bouton('ajoutApercu', 'Récupérer l\'aperçu'),
    saisie('ajoutTitre', 'Titre'), saisie('ajoutDesc', 'Description', { multiligne: true }), saisie('ajoutImage', 'Image de l\'aperçu (adresse)', { placeholder: 'https://…' }),
    el('div', { class: 'champ' }, el('label', { for: 'ajoutType' }, 'Type'), el('select', { id: 'ajoutType' }, optionsType().map((o) => el('option', { value: o.valeur }, o.libelle)))),
    el('div', { class: 'champ' }, el('span', { class: 'champ-titre' }, 'Mon image (remplace l\'aperçu, facultatif)'), el('img', { id: 'ajoutApercuImage', class: 'apercu-media', alt: '' }),
      el('div', { class: 'acts' }, el('label', { class: 'btn', for: 'ajoutFichier' }, 'Choisir mon image')),
      el('input', { type: 'file', accept: 'image/*', id: 'ajoutFichier' }), el('small', { id: 'ajoutFichierMessage', class: 'aide', role: 'status' })),
    bouton('ajoutValider', 'Ajouter le lien', 'btn pri'), el('p', { id: 'ajoutMessage', class: 'aide', role: 'status' }));
  const q = (id) => ajout.querySelector('#' + id);
  const message = (t) => { q('ajoutMessage').textContent = t; };
  let media = null;
  q('ajoutFichier').addEventListener('change', async () => {
    const f = q('ajoutFichier').files[0];
    if (!f) return;
    const dire = (t) => { q('ajoutFichierMessage').textContent = t; };
    if (!f.type.startsWith('image/')) { dire('Choisis une image.'); return; }
    try {
      dire('Envoi de l\'image…');
      const envoi = await reduireImage(f, 1600, 'image/jpeg');
      const r = await appeler('envoyerMedia', { emplacement: 'image', nom: f.name, type: envoi.type, base64: envoi.base64 });
      media = { id: r.id, url: r.url };
      q('ajoutApercuImage').src = r.url;
      dire('Image prête.');
    } catch (err) {
      dire(messageErreur(err));
    } finally {
      q('ajoutFichier').value = '';
    }
  });
  async function apercu() {
    const url = q('ajoutUrl').value.trim();
    if (!lienSur(url)) { message('Adresse web invalide (https://…).'); return; }
    message('Lecture de la page…');
    /* un champ modifié pendant la lecture garde ce qui a été saisi */
    const avant = ['ajoutTitre', 'ajoutDesc', 'ajoutImage'].map((id) => q(id).value);
    const remplir = (id, i, v) => { if (q(id).value === avant[i]) q(id).value = v || ''; };
    try {
      const r = await appeler('apercuLien', { url });
      remplir('ajoutTitre', 0, r.titre);
      remplir('ajoutDesc', 1, r.description);
      remplir('ajoutImage', 2, r.image);
      message(r.titre ? 'Aperçu récupéré.' : 'Aperçu indisponible : remplis les champs.');
    } catch (err) {
      message(err.code === 'jeton' ? messageErreur(err) : 'Aperçu indisponible : remplis les champs.');
    }
  }
  q('ajoutApercu').addEventListener('click', apercu);
  q('ajoutUrl').addEventListener('change', () => { if (lienSur(q('ajoutUrl').value.trim()) && !q('ajoutTitre').value) apercu(); });
  q('ajoutValider').addEventListener('click', () => {
    const url = q('ajoutUrl').value.trim(), titre = q('ajoutTitre').value.trim();
    if (!lienSur(url)) { message('Adresse web invalide (https://…).'); return; }
    if (!titre) { message('Titre obligatoire.'); return; }
    if (!q('ajoutCat').value) { message('Crée d\'abord une catégorie.'); return; }
    const image = q('ajoutImage').value.trim();
    modifier('liens.items', [...c.liens.items, { id: nouvelId('u'), url, titre, description: q('ajoutDesc').value.trim(), image: lienSur(image) ? image : '',
      categorie: q('ajoutCat').value, date: new Date().toISOString().slice(0, 10), bouton: '', type: q('ajoutType').value, media, visible: true }]);
    rafraichir();
    racine.querySelector('#ajoutMessage').textContent = 'Lien ajouté. Pense à enregistrer.';
  });
  const liens = groupe('Liens', 'Les plus récents s\'affichent en premier sur le site.', editeurListe(etat, modifier, rafraichir, 'liens.items', {
    libelleElement: 'un lien', prefixe: 'u', resume: (x) => x.titre, nouveau: { url: '', titre: '', description: '', image: '', categorie: (c.liens.categories[0] || {}).id || '', date: new Date().toISOString().slice(0, 10), bouton: '', type: '', media: null },
    champs: [{ cle: 'url', libelle: 'Adresse' }, { cle: 'titre', libelle: 'Titre' }, { cle: 'description', libelle: 'Description', type: 'multiligne' },
      { cle: 'type', libelle: 'Type', type: 'select', options: optionsType },
      { cle: 'media', libelle: 'Mon image (remplace l\'aperçu)', type: 'image' },
      { cle: 'image', libelle: 'Image de l\'aperçu (adresse)' }, { cle: 'bouton', libelle: 'Texte du bouton (facultatif, « Ouvrir » par défaut)' },
      { cle: 'categorie', libelle: 'Catégorie', type: 'select', options }, { cle: 'date', libelle: 'Date (AAAA-MM-JJ)' }] }));
  liens.dataset.bloc = 'liens';
  const cats = groupe('Catégories', 'Chaque catégorie avec au moins un lien visible devient un sous-onglet.', editeurListe(etat, modifier, rafraichir, 'liens.categories', {
    libelleElement: 'une catégorie', prefixe: 'cat', resume: (x) => x.nom, nouveau: { nom: '' }, champs: [{ cle: 'nom', libelle: 'Nom' }],
    refuserSuppression: (cat) => (c.liens.items.some((x) => x.categorie === cat.id) ? `La catégorie « ${cat.nom} » contient encore des liens : déplace-les ou supprime-les d'abord.` : null) }));
  cats.dataset.bloc = 'categories';
  racine.replaceChildren(el('h1', {}, 'Liens'), ajout, liens, cats);
}

/* ---------- Portfolio : dossier Drive et sous-dossiers ---------- */
function ecranPortfolio(racine, etat, modifier) {
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
  racine.replaceChildren(el('h1', {}, 'Portfolio'),
    groupe('Dossier Drive', 'Colle le lien du dossier qui contient tes sous-dossiers (Design, Posters…). Il sera partagé en lecture publique.',
      el('div', { class: 'champ' }, el('label', { for: 'dossierLien' }, 'Lien du dossier'), lien), el('div', { class: 'acts' }, valider, relire), message),
    groupe('Sous-dossiers', 'Chaque sous-dossier visible devient un sous-onglet du Portfolio.', liste));
  lirePortfolio().then(dessiner);
}

/* ---------- Image d'un élément de liste (intérêts) : envoi dans Drive, aperçu, retrait ---------- */
function champImage(etat, modifier, chemin, libelle) {
  const actuel = lire(etat.contenu, chemin);
  const id = 'img-' + chemin.replace(/\W/g, '-');
  const apercu = el('img', { class: 'apercu-media', 'data-apercu': 'image-' + chemin.replace(/\.image$/, ''), src: actuel && actuel.url, alt: '' });
  const fichier = el('input', { type: 'file', accept: 'image/*', id, 'data-media': 'image-' + chemin.replace(/\.image$/, '') });
  const message = el('small', { class: 'aide', role: 'status' });
  const retirer = el('button', { type: 'button', class: 'btn', hidden: !actuel }, 'Retirer l\'image');
  fichier.addEventListener('change', async () => {
    const f = fichier.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { message.textContent = 'Choisis une image.'; return; }
    try {
      message.textContent = 'Préparation de l\'image…';
      const envoi = await reduireImage(f, 1600, 'image/jpeg');
      message.textContent = 'Envoi…';
      const r = await appeler('envoyerMedia', { emplacement: 'image', nom: f.name, type: envoi.type, base64: envoi.base64 });
      modifier(chemin, { id: r.id, url: r.url });
      apercu.src = r.url;
      retirer.hidden = false;
      message.textContent = 'Image envoyée. Pense à enregistrer.';
    } catch (err) {
      message.textContent = messageErreur(err);
    } finally {
      fichier.value = '';
    }
  });
  retirer.addEventListener('click', () => { modifier(chemin, null); apercu.removeAttribute('src'); retirer.hidden = true; message.textContent = 'Image retirée. Pense à enregistrer.'; });
  return el('div', { class: 'champ' }, el('span', { class: 'champ-titre' }, libelle), apercu,
    el('div', { class: 'acts' }, el('label', { class: 'btn', for: id }, 'Choisir une image'), retirer), fichier, message);
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
  racine.replaceChildren(el('h1', {}, 'Médias'), ...MEDIAS.map((m) => {
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

export const ECRANS = [
  { id: 'accueil', titre: 'Accueil', rendre(racine, etat, modifier, rafraichir) {
    const f = champs(etat, modifier);
    const c = etat.contenu;
    const bloc = (nom, g) => { g.dataset.bloc = nom; return g; };
    const projets = [{ valeur: '', libelle: 'Aucun' }, ...c.liens.items.map((x) => ({ valeur: x.id, libelle: x.titre }))];
    racine.replaceChildren(el('h1', {}, 'Accueil'),
      groupe('En-tête', 'Ton nom, en haut de chaque page.', f.champTexte('site.nom', 'Nom'),
        f.champTexte('site.surtitre', 'Sous le nom, dans la fiche Contact', { placeholder: 'Microbiologie · Lyon 1' })),
      groupe('Présentation', 'Ce que le visiteur lit en premier.',
        f.champTexte('accueil.salutation', 'Salutation', { placeholder: 'Bonjour, je suis Amar' }),
        f.champTexte('accueil.intro', 'Présentation', { multiligne: true })),
      bloc('reperes', groupe('Repères', 'Trois chiffres ou faits marquants, affichés sous la présentation.', editeurListe(etat, modifier, rafraichir, 'accueil.reperes', {
        libelleElement: 'un repère', prefixe: 'r', resume: (x) => `${x.valeur} ${x.libelle}`.trim(), nouveau: { valeur: '', libelle: '' },
        champs: [{ cle: 'valeur', libelle: 'Valeur (ex. 2022, 6 ans)' }, { cle: 'libelle', libelle: 'Libellé' }] }))),
      bloc('domaines', groupe('Ce que je fais', 'Une grande carte par domaine : image, titre et texte toujours visibles.', editeurListe(etat, modifier, rafraichir, 'accueil.domaines', {
        libelleElement: 'un domaine', prefixe: 'd', resume: (x) => x.titre, nouveau: { titre: '', texte: '', image: null },
        champs: [{ cle: 'titre', libelle: 'Titre' }, { cle: 'texte', libelle: 'Texte', type: 'multiligne' }, { cle: 'image', libelle: 'Image', type: 'image' }] }))),
      groupe('Projet phare', 'Un de tes liens, mis en avant en grand sur l\'Accueil.', f.champSelect('accueil.projetPhare', 'Lien mis en avant', projets)));
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
      langues: () => liste('parcours.langues', { libelleElement: 'une langue', prefixe: 'l', nouveau: { langue: '', niveau: '', drapeau: '' }, resume: (x) => x.langue,
        champs: [{ cle: 'langue', libelle: 'Langue' }, { cle: 'niveau', libelle: 'Niveau' },
          { cle: 'drapeau', libelle: 'Drapeau', type: 'select', options: () => [{ valeur: '', libelle: 'Automatique (selon la langue)' }, ...Object.entries(DRAPEAUX).map(([valeur, libelle]) => ({ valeur, libelle }))] }] }),
      certifications: () => liste('parcours.certifications', { libelleElement: 'une certification', prefixe: 'k', nouveau: { titre: '', organisme: '', annee: '', url: '' }, resume: (x) => x.titre,
        champs: [{ cle: 'titre', libelle: 'Titre' }, { cle: 'organisme', libelle: 'Organisme' }, { cle: 'annee', libelle: 'Année' },
          { cle: 'url', libelle: 'Lien du certificat (https://…)' }] }),
      interets: () => liste('parcours.interets', { libelleElement: 'un intérêt', prefixe: 'i', nouveau: { titre: '', texte: '', image: null }, resume: (x) => x.titre,
        champs: [{ cle: 'titre', libelle: 'Titre' }, { cle: 'texte', libelle: 'Texte', type: 'multiligne' }, { cle: 'image', libelle: 'Image', type: 'image' }] }),
    };
    racine.replaceChildren(el('h1', {}, 'Parcours'), ...SOUS_PARCOURS.map((id) => {
      const g = groupe(etat.contenu.onglets.parcours.sous[id].titre, '', f.interrupteur(`onglets.parcours.sous.${id}.visible`, 'Afficher sur le site'), BLOCS[id]());
      g.dataset.bloc = id;
      return g;
    }));
  } },
  { id: 'liens', titre: 'Liens', rendre: ecranLiens },
  { id: 'portfolio', titre: 'Portfolio', rendre: ecranPortfolio },
  { id: 'medias', titre: 'Médias', rendre: ecranMedias },
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
      groupe('Onglets', 'Un onglet masqué disparaît de la barre du site. Fiche Contact masquée : la photo de l\'en-tête n\'ouvre plus rien.', ...Object.keys(TITRES_ONGLETS).map((id) => f.interrupteur(`onglets.${id}.visible`, TITRES_ONGLETS[id]))),
      groupe('Parties de Parcours', '', ...SOUS_PARCOURS.map((id) => f.interrupteur(`onglets.parcours.sous.${id}.visible`, etat.contenu.onglets.parcours.sous[id].titre))));
  } },
];
