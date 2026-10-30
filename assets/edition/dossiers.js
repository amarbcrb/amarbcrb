/* Édition du portfolio et des galeries Drive : opérations immédiates dans Drive (envoyer un fichier, créer, renommer,
   supprimer, liens, protection par mot de passe) ; masquer un dossier reste dans le brouillon. */
import { el } from '../dom.js';
import { appeler } from '../api.js';
import { enBase64 } from '../images.js';
import { ouvrirFiche, fermerFiche } from '../fiche.js';

const ICONES = {
  renommer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>',
  liens: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  proteger: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  masquer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 4"/><path d="M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/></svg>',
  supprimer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
};
const MAX_OCTETS = 25 * 1024 * 1024;

/* ctx : { site (rechargerDrive), contenu(), noter(chemin), rendre(), dire(texte) } */
export function outilsDossiers(ctx) {
  const dire = (t) => ctx.dire(t);
  async function operation(onglet, texte, appel) {
    dire(texte);
    try {
      await appel();
      await ctx.site.rechargerDrive(onglet);
      dire('Fait. Drive est à jour.');
    } catch (err) {
      dire(err.code === 'jeton' ? 'Session expirée : reconnecte-toi.' : err.code === 'entree' ? 'Drive a refusé l\'opération.' : 'Échec, réessaie.');
    }
  }
  const bouton = (action, libelle, onClic) => {
    const b = el('button', { type: 'button', class: `outil ${action}`, 'aria-label': libelle, html: ICONES[action] });
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClic(); });
    return b;
  };

  function envoyer(onglet, dossierId, fichiers) {
    const liste = [...fichiers];
    if (liste.some((f) => f.size > MAX_OCTETS)) { dire('Un fichier dépasse 25 Mo.'); return; }
    operation(onglet, `Envoi de ${liste.length} fichier${liste.length > 1 ? 's' : ''}…`, async () => {
      for (const f of liste) await appeler('envoyerFichier', { dossierId, nom: f.name, type: f.type || 'application/octet-stream', base64: await enBase64(f) });
    });
  }

  /* liens d'un dossier : « Titre | https://… », un par ligne */
  function editerLiens(onglet, dossierId, actuels) {
    const zone = el('textarea', { name: 'liens', rows: 6, placeholder: 'Behance | https://behance.net/…' }, actuels.map((l) => `${l.titre} | ${l.url}`).join('\n'));
    const statut = el('p', { class: 'aide', role: 'status' });
    const form = el('form', { class: 'edition-form', novalidate: true }, el('label', {}, 'Un lien par ligne : Titre | https://…'), zone,
      el('div', { class: 'acts' }, el('button', { type: 'submit', class: 'btn pri' }, 'Enregistrer'), el('button', { type: 'button', class: 'btn annuler' }, 'Annuler')), statut);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const liens = [];
      const lignes = zone.value.split('\n').map((l) => l.trim()).filter(Boolean);
      for (let i = 0; i < lignes.length; i++) {
        const [titre, url] = lignes[i].includes('|') ? lignes[i].split('|').map((x) => x.trim()) : [lignes[i], lignes[i]];
        if (!/^https?:\/\//i.test(url || '')) { statut.textContent = `Adresse invalide à la ligne ${i + 1} (https://…).`; return; }
        liens.push({ titre: titre || url, url });
      }
      fermerFiche({ silencieux: true });
      operation(onglet, 'Enregistrement des liens…', () => appeler('liensDossier', { id: dossierId, liens }));
    });
    form.querySelector('.annuler').addEventListener('click', () => fermerFiche({ silencieux: true }));
    ouvrirFiche({ titre: 'Liens du dossier', corps: form });
  }

  function cabler(racine) {
    const page = racine && racine.querySelector('[data-drive-racine]');
    if (!page) return;
    const onglet = page.dataset.driveOnglet;
    const racineId = page.dataset.driveRacine;
    if (racineId && !page.querySelector('.nouveau-dossier')) {
      const b = el('button', { type: 'button', class: 'ajout nouveau-dossier', 'data-ajout': '1' }, '+ Nouveau dossier');
      b.addEventListener('click', () => {
        const nom = prompt('Nom du nouveau dossier (un numéro au début règle l\'ordre : « 3 - Vidéos ») :');
        if (nom && nom.trim()) operation(onglet, 'Création du dossier…', () => appeler('creerDossier', { parentId: racineId, nom: nom.trim() }));
      });
      page.querySelector('h1').after(b);
    }
    page.querySelectorAll('.rangee[data-dossier]:not([data-outils])').forEach((r) => {
      r.dataset.outils = '1';
      const id = r.dataset.dossier;
      const estRacine = id === racineId;
      const titre = r.querySelector('h2').textContent;
      const outils = el('span', { class: 'outils-edition outils-dossier', 'data-pour': id });
      if (!estRacine) outils.append(bouton('renommer', `Renommer : ${titre}`, () => {
        const nom = prompt('Nouveau nom du dossier :', titre);
        if (nom && nom.trim() && nom.trim() !== titre) operation(onglet, 'Renommage…', () => appeler('renommerDossier', { id, nom: nom.trim() }));
      }));
      outils.append(bouton('liens', `Liens : ${titre}`, () => editerLiens(onglet, id, [...r.querySelectorAll('a.lien-dossier')].map((a) => ({ titre: a.querySelector('b').textContent, url: a.href })))));
      outils.append(bouton('proteger', `Protéger : ${titre}`, () => {
        const mdp = prompt(r.classList.contains('protege') ? 'Nouveau mot de passe du dossier (vide pour retirer la protection) :' : 'Mot de passe du dossier (4 caractères au moins ; vide pour ne pas protéger) :');
        if (mdp === null) return;
        if (mdp && mdp.length < 4) { dire('Mot de passe trop court (4 caractères au moins).'); return; }
        operation(onglet, mdp ? 'Protection du dossier…' : 'Protection retirée…', () => appeler('protegerDossier', { id, motDePasse: mdp }));
      }));
      if (onglet === 'portfolio' && !estRacine) outils.append(bouton('masquer', `Masquer : ${titre}`, () => {
        const c = ctx.contenu();
        c.portfolio.dossiers[id] = { ...(c.portfolio.dossiers[id] || { nom: '' }), visible: false };
        ctx.noter(`portfolio.dossiers.${id}.visible`);
        ctx.rendre();
        dire(`« ${titre} » masqué (à publier). Pour le réafficher : admin, Visibilité.`);
      }));
      if (!estRacine) outils.append(bouton('supprimer', `Supprimer : ${titre}`, () => {
        if (confirm(`Mettre le dossier « ${titre} » et son contenu à la corbeille de Drive ?`)) operation(onglet, 'Suppression…', () => appeler('supprimerDossier', { id }));
      }));
      r.querySelector('.rangee-tete').append(outils);
      /* envoi de fichiers dans ce dossier */
      const champ = el('input', { type: 'file', multiple: true, class: 'invisible', id: `envoi-${id}`, 'aria-label': `Fichiers à ajouter dans ${titre}` });
      champ.addEventListener('change', () => { if (champ.files.length) envoyer(onglet, id, champ.files); champ.value = ''; });
      const ajout = el('label', { class: 'ajout', for: `envoi-${id}` }, '+ Ajouter un fichier');
      (r.querySelector('.piste') || r).append(ajout, champ);
      r.querySelectorAll('[data-fichier]').forEach((v) => {
        const fid = v.dataset.fichier;
        const nom = (v.querySelector('b') || v.querySelector('img') || {}).textContent || (v.querySelector('img') || {}).alt || 'fichier';
        const o = el('span', { class: 'outils-edition outils-fichier', 'data-pour': fid },
          bouton('supprimer', `Supprimer le fichier : ${nom}`, () => { if (confirm(`Mettre « ${nom} » à la corbeille de Drive ?`)) operation(onglet, 'Suppression…', () => appeler('supprimerFichier', { id: fid })); }));
        const enveloppe = el('div', { class: 'carte-edition' });
        v.replaceWith(enveloppe);
        enveloppe.append(v, o);
      });
    });
  }
  return { cabler };
}
