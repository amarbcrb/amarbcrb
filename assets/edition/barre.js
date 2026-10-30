/* Barre de l'édition : « N modifications · Annuler · Publier », message d'état et choix en cas de conflit. */
import { el } from '../dom.js';

const FERMER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

export function monterBarreEdition({ onPublier, onAnnuler, onQuitter }) {
  const compte = el('span', { class: 'compte' }, '0 modification');
  const statut = el('p', { class: 'statut', role: 'status' });
  const publier = el('button', { type: 'button', class: 'btn pri' }, 'Publier');
  const annuler = el('button', { type: 'button', class: 'btn' }, 'Annuler');
  const quitter = el('button', { type: 'button', class: 'tb', 'aria-label': 'Quitter l\'édition', html: FERMER });
  const conflit = el('div', { class: 'conflit-edition', hidden: true });
  publier.addEventListener('click', onPublier);
  annuler.addEventListener('click', onAnnuler);
  quitter.addEventListener('click', onQuitter);
  const barre = el('div', { class: 'barre-edition glass', role: 'region', 'aria-label': 'Édition du site' },
    el('div', { class: 'ligne' }, quitter, compte, annuler, publier), statut, conflit);
  document.body.append(barre);
  return {
    compter(n) { compte.textContent = `${n} modification${n > 1 ? 's' : ''}`; },
    /* message, avec un bouton d'action facultatif (ex. « Rétablir ») qui disparaît au bout de 8 s */
    dire(t, action = null) {
      statut.replaceChildren(t);
      if (!action) return;
      const b = el('button', { type: 'button', class: 'btn' }, action.libelle);
      b.addEventListener('click', () => { b.remove(); action.action(); });
      statut.append(' ', b);
      setTimeout(() => b.remove(), 8000);
    },
    occupe(o) { publier.disabled = o; },
    /* conflit : la version en ligne a changé depuis l'ouverture du brouillon */
    conflit({ onRecharger, onEcraser }) {
      const recharger = el('button', { type: 'button', class: 'btn' }, 'Recharger');
      const ecraser = el('button', { type: 'button', class: 'btn pri' }, 'Écraser');
      recharger.addEventListener('click', () => { conflit.hidden = true; onRecharger(); });
      ecraser.addEventListener('click', () => { conflit.hidden = true; onEcraser(); });
      conflit.replaceChildren(el('p', {}, 'Le site a été modifié ailleurs depuis. Recharger la version en ligne, ou écraser avec tes modifications ?'), el('div', { class: 'acts' }, recharger, ecraser));
      conflit.hidden = false;
    },
    detruire() { barre.remove(); },
  };
}
