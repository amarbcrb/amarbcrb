/* Champ média, partagé par l'admin et l'édition sur le site : envoyer une image, la choisir dans la médiathèque
   (fichiers déjà envoyés, sans nouvel envoi) ou coller un lien (image, GIF, vidéo, YouTube). */
import { el } from './dom.js';
import { lienSur, typeMedia } from './model.js';
import { appeler, listerMedias, supprimerMedia } from './api.js';
import { reduireImage } from './images.js';
import { visuel, urlMedia } from './media.js';

const FERMER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
const MOTS = { accueil: 'Accueil', domaines: 'Ce que je fais', reperes: 'Repères', parcours: 'Parcours', interets: 'Intérêts', certifications: 'Certifications',
  competences: 'Compétences', formation: 'Formation', experience: 'Expérience', engagement: 'Engagement', liens: 'Liens', items: '', pages: 'Onglets',
  medias: 'Médias du site', photo: 'Photo', logo: 'Logo', favicon: 'Favicon', cv: 'CV' };

/* « parcours.interets.0.image » → « Intérêts n°1 » */
export function lieuLisible(chemin) {
  const mots = [];
  String(chemin).split('.').forEach((p) => {
    if (/^\d+$/.test(p)) mots.push(`n°${Number(p) + 1}`);
    else if (p !== 'image' && p !== 'media' && MOTS[p] !== '') mots.push(MOTS[p] || p);
  });
  /* on garde le dernier libellé et son numéro : « Intérêts n°1 » plutôt que « Parcours Intérêts n°1 » */
  const i = mots.findIndex((m) => m.startsWith('n°'));
  return (i > 0 ? mots.slice(i - 1, i + 1) : mots.slice(-1)).join(' ');
}

const messageErreur = (err) => (err && err.code === 'jeton' ? 'Session expirée : reconnecte-toi.' : 'Échec, réessaie.');

/* valeur : { id?, url, type } ou null ; onChange(nouvelleValeur) ; cle : nom des attributs data-media / data-apercu */
export function champMedia({ valeur = null, onChange, libelle = 'Image', cle = 'image' }) {
  let actuel = valeur;
  const message = el('small', { class: 'aide', role: 'status' });
  const apercu = el('span', { class: 'apercu-media-cadre' });
  const fichier = el('input', { type: 'file', accept: 'image/*', id: 'f-' + cle, 'data-media': cle, class: 'invisible' });
  const retirer = el('button', { type: 'button', class: 'btn' }, 'Retirer');
  const saisie = el('input', { type: 'url', placeholder: 'https://… (image, GIF, .mp4, YouTube)', 'aria-label': 'Adresse du média' });
  const zoneLien = el('div', { class: 'lien-media', hidden: true }, saisie, el('button', { type: 'button', class: 'btn pri' }, 'Utiliser'));

  function montrer() {
    const url = urlMedia(actuel);
    const type = url ? typeMedia(actuel) : null;
    retirer.hidden = !url;
    /* aperçu : image (ou miniature YouTube) avec data-apercu, sinon le rendu vidéo */
    if (!url) { apercu.replaceChildren(); return; }
    if (type === 'video') { apercu.replaceChildren(visuel(actuel, { classe: 'apercu-media' })); return; }
    const v = visuel(actuel, { classe: 'apercu-media' });
    const img = v.querySelector('img');
    if (img) img.setAttribute('data-apercu', cle);
    apercu.replaceChildren(v);
  }
  function choisir(v, texte) { actuel = v; montrer(); onChange(v); message.textContent = texte; }

  fichier.addEventListener('change', async () => {
    const f = fichier.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { message.textContent = 'Choisis une image.'; return; }
    try {
      message.textContent = 'Envoi…';
      const envoi = await reduireImage(f, 1600, 'image/jpeg');
      const r = await appeler('envoyerMedia', { emplacement: 'image', nom: f.name, type: envoi.type, base64: envoi.base64 });
      choisir({ id: r.id, url: r.url, type: 'image' }, 'Image envoyée.');
    } catch (err) {
      message.textContent = messageErreur(err);
    } finally {
      fichier.value = '';
    }
  });
  retirer.addEventListener('click', () => choisir(null, 'Média retiré.'));

  const ouvrirLien = el('button', { type: 'button', class: 'btn' }, 'Coller un lien');
  ouvrirLien.addEventListener('click', () => { zoneLien.hidden = false; saisie.value = ''; saisie.focus(); });
  zoneLien.querySelector('button').addEventListener('click', () => {
    const url = saisie.value.trim();
    if (!lienSur(url)) { message.textContent = 'Adresse invalide (https://…).'; return; }
    zoneLien.hidden = true;
    choisir({ url, type: typeMedia(url) }, 'Lien ajouté.');
  });

  const ouvrirMediatheque = el('button', { type: 'button', class: 'btn' }, 'Ma médiathèque');
  ouvrirMediatheque.addEventListener('click', () => mediatheque((m) => choisir({ id: m.id, url: m.url, type: typeMedia(m.url) === 'video' || String(m.type).startsWith('video/') ? 'video' : 'image' }, 'Média choisi.')));

  montrer();
  return el('div', { class: 'champ champ-media' }, el('span', { class: 'champ-titre' }, libelle), apercu,
    el('div', { class: 'acts' }, el('label', { class: 'btn', for: 'f-' + cle }, 'Envoyer une image'), ouvrirMediatheque, ouvrirLien, retirer),
    zoneLien, fichier, message);
}

/* fenêtre « Ma médiathèque » : grille des fichiers déjà envoyés ; toucher choisit, « Supprimer » retire de Drive */
function mediatheque(onChoix) {
  const etat = el('p', { class: 'aide', role: 'status' }, 'Chargement…');
  const grille = el('div', { class: 'media-grille' });
  const fermer = el('button', { type: 'button', class: 'fermer', 'aria-label': 'Fermer', html: FERMER });
  const fenetre = el('dialog', { class: 'mediatheque', 'aria-labelledby': 'titreMediatheque' },
    el('div', { class: 'mediatheque-tete' }, el('h2', { id: 'titreMediatheque' }, 'Ma médiathèque'), fermer), etat, grille);
  const finir = () => { fenetre.close(); fenetre.remove(); };
  fermer.addEventListener('click', finir);
  fenetre.addEventListener('cancel', (e) => { e.preventDefault(); finir(); });
  document.body.append(fenetre);
  fenetre.showModal();

  let medias = [];
  function dessiner(liste) {
    medias = liste;
    const choisissables = medias.filter((m) => /^(image|video)\//.test(m.type));
    etat.textContent = choisissables.length ? '' : 'Aucun média envoyé pour l\'instant.';
    grille.replaceChildren(...choisissables.map((m) => {
      const choix = el('button', { type: 'button', class: 'media-choix', 'aria-label': 'Choisir ' + m.nom },
        visuel({ url: m.url, type: String(m.type).startsWith('video/') ? 'video' : 'image' }, { classe: 'media-vignette' }), el('small', {}, m.nom));
      choix.addEventListener('click', () => { finir(); onChoix(m); });
      const suppr = el('button', { type: 'button', class: 'media-suppr', 'aria-label': 'Supprimer ' + m.nom }, 'Supprimer');
      suppr.addEventListener('click', async () => {
        if (!confirm(`Supprimer « ${m.nom} » de ta médiathèque ?`)) return;
        try {
          await supprimerMedia(m.id);
        } catch (err) {
          etat.textContent = err.code === 'utilise'
            ? `« ${m.nom} » est utilisé : ${(err.emplacements || []).map(lieuLisible).join(', ')}. Retire-le d'abord.`
            : messageErreur(err);
          return;
        }
        medias = medias.filter((x) => x.id !== m.id);
        dessiner(medias);
        etat.textContent = `« ${m.nom} » supprimé.`;
      });
      return el('div', { class: 'media-case' }, choix, suppr);
    }));
  }
  listerMedias().then(dessiner).catch((err) => { etat.textContent = messageErreur(err); });
}
