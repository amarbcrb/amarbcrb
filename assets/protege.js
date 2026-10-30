/* Dossier protégé, côté visiteur (chargé seulement au toucher du cadenas) : mot de passe, clé gardée 30 jours,
   fichiers lus à travers le script Google et affichés depuis des adresses locales (blob:), jamais depuis Drive. */
import { el } from './dom.js';
import { appeler } from './api.js';
import { lienSur } from './model.js';
import { ouvrirFiche } from './fiche.js';

const FICHIER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';
const MESSAGES = { mot_de_passe: 'Mot de passe incorrect.', bloque: 'Trop d\'essais. Réessaie dans 15 minutes.', reseau: 'Connexion impossible. Vérifie ta connexion internet.' };

const cleStockee = (id) => {
  try { const v = JSON.parse(localStorage.getItem('ab-cle:' + id)); return v && v.expire > Date.now() ? v.cle : null; } catch { return null; }
};
const garderCle = (id, cle, expire) => { try { localStorage.setItem('ab-cle:' + id, JSON.stringify({ cle, expire })); } catch { /* stockage bloqué */ } };
const oublierCle = (id) => { try { localStorage.removeItem('ab-cle:' + id); } catch { /* idem */ } };

/* fichier du dossier → adresse blob: (apercu : miniature) */
async function blob(idFichier, cle, taille) {
  const r = await appeler('fichierProtege', { id: idFichier, cle, taille });
  if (!r.base64) return null;
  const octets = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([octets], { type: r.type }));
}

export async function ouvrirProtege(id, titre) {
  const cle = cleStockee(id);
  if (cle) {
    try { montrer(id, titre, await appeler('ouvrirDossier', { id, cle })); return; } catch (err) { if (err.code === 'cle') oublierCle(id); }
  }
  demander(id, titre);
}

function demander(id, titre, message = '') {
  const champ = el('input', { type: 'password', id: 'mdpDossier', autocomplete: 'off', required: true });
  const statut = el('p', { class: 'aide', role: 'status' }, message);
  const bouton = el('button', { type: 'submit', class: 'btn pri' }, 'Ouvrir');
  const form = el('form', { class: 'connexion-site' }, el('p', {}, 'Ce dossier est protégé. Entre le mot de passe qu\'on t\'a donné.'),
    el('label', { for: 'mdpDossier' }, 'Mot de passe'), champ, bouton, statut);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    bouton.disabled = true;
    try {
      const r = await appeler('ouvrirDossier', { id, motDePasse: champ.value });
      garderCle(id, r.cle, r.expire);
      montrer(id, titre, r);
    } catch (err) {
      statut.textContent = MESSAGES[err.code] || 'Erreur, réessaie.';
    } finally {
      bouton.disabled = false;
    }
  });
  ouvrirFiche({ titre: titre || 'Dossier protégé', corps: form });
  champ.focus();
}

function montrer(id, titre, { cle, dossier }) {
  const echec = (err) => { if (err && err.code === 'cle') { oublierCle(id); demander(id, titre, 'Le mot de passe a changé : entre le nouveau.'); } };
  const vignette = (f) => {
    const image = String(f.type).startsWith('image/');
    const b = el('button', { type: 'button', class: image ? 'vignette' : 'vignette doc', 'aria-label': `Ouvrir ${f.nom}` },
      image ? null : el('i', { html: FICHIER }), image ? null : el('b', {}, f.nom), image ? null : el('small', {}, 'Ouvrir'));
    if (image) blob(f.id, cle, 'apercu').then((u) => { if (u) b.prepend(el('img', { src: u, alt: f.nom.replace(/\.[^.]+$/, '') })); }).catch(echec);
    b.addEventListener('click', async () => {
      try { const u = await blob(f.id, cle); if (u) window.open(u, '_blank'); } catch (err) { echec(err); }
    });
    return b;
  };
  const bloc = (d, sousTitre) => [
    sousTitre ? el('h3', { class: 'fiche-sous-titre' }, sousTitre) : null,
    d.fichiers.length ? el('div', { class: 'grille grille-protegee' }, d.fichiers.map(vignette)) : null,
    (d.liens || []).length ? el('ul', { class: 'box rows' }, d.liens.filter((l) => lienSur(l.url)).map((l) => el('li', {}, el('a', { class: 'row', href: l.url, target: '_blank', rel: 'noopener noreferrer' }, el('span', { class: 't' }, el('b', {}, l.titre)))))) : null,
  ];
  const corps = el('div', { class: 'protege-contenu' }, bloc(dossier), (dossier.dossiers || []).map((s) => bloc(s, s.nom.replace(/^\d+\s*-\s*/, ''))),
    !dossier.fichiers.length && !(dossier.liens || []).length && !(dossier.dossiers || []).length ? el('p', { class: 'vide' }, 'Ce dossier est vide.') : null);
  ouvrirFiche({ titre: titre || dossier.nom, corps });
}
