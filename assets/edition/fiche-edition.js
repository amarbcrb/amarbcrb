/* Formulaire d'un élément (feuille de l'édition) : champs tirés de assets/schemas.js, erreurs affichées sur le champ. */
import { el } from '../dom.js';
import { appeler } from '../api.js';
import { lienSur } from '../model.js';
import { champMedia } from '../champ-media.js';

const unique = (() => { let n = 0; return (cle) => `ed-${cle}-${++n}`; })();

/* valeurs : objet de départ (copie) ; onValider(valeurs) → messages d'erreur { cle: message } ({} si tout va bien) */
export function formulaire({ schema, valeurs, c, onValider, onAnnuler, nouveau = false }) {
  const v = JSON.parse(JSON.stringify(valeurs));
  const erreurs = {};
  const lignes = schema.champs.map((d) => {
    const id = unique(d.cle);
    const erreur = el('small', { class: 'erreur', 'data-erreur': d.cle, role: 'alert' });
    erreurs[d.cle] = erreur;
    const etiquette = el('label', { for: id }, d.libelle);
    let champ;
    if (d.type === 'media') {
      return el('div', { class: 'champ' }, champMedia({ valeur: v[d.cle], libelle: d.libelle, cle: `${d.cle}-${id}`, onChange: (x) => { v[d.cle] = x; } }), erreur);
    }
    if (d.type === 'multiligne') {
      champ = el('textarea', { id, name: d.cle, rows: 4 }, v[d.cle] || '');
      champ.addEventListener('input', () => { v[d.cle] = champ.value; });
    } else if (d.type === 'select') {
      champ = el('select', { id, name: d.cle }, d.options(c).map((o) => el('option', { value: o.valeur, selected: o.valeur === v[d.cle] }, o.libelle)));
      champ.addEventListener('change', () => { v[d.cle] = champ.value; });
    } else if (d.type === 'puces') {
      champ = el('input', { id, name: d.cle, type: 'text', value: (v[d.cle] || []).join(', ') });
      champ.addEventListener('input', () => { v[d.cle] = champ.value.split(',').map((t) => t.trim()).filter(Boolean); });
    } else if (d.type === 'fin') {
      champ = el('input', { id, name: 'fin', type: 'text', placeholder: 'AAAA-MM', value: v.fin || '', disabled: !!v.enCours });
      const enCours = el('input', { type: 'checkbox', name: 'enCours', id: id + '-ec', checked: !!v.enCours });
      champ.addEventListener('input', () => { v.fin = champ.value.trim() || null; });
      enCours.addEventListener('change', () => { v.enCours = enCours.checked; champ.disabled = enCours.checked; if (enCours.checked) { champ.value = ''; v.fin = null; } });
      return el('div', { class: 'champ' }, etiquette, champ, el('label', { class: 'case', for: id + '-ec' }, enCours, 'En cours'), erreur);
    } else {
      champ = el('input', { id, name: d.cle, type: d.type === 'url' ? 'url' : 'text', value: v[d.cle] || '', placeholder: d.type === 'date' ? 'AAAA-MM' : null });
      champ.addEventListener('input', () => { v[d.cle] = champ.value.trim(); });
    }
    return el('div', { class: 'champ' }, etiquette, champ, erreur);
  });

  const statut = el('p', { class: 'aide', role: 'status' });
  const form = el('form', { class: 'edition-form', novalidate: true }, lignes,
    el('div', { class: 'acts' }, el('button', { type: 'submit', class: 'btn pri' }, nouveau ? 'Ajouter' : 'Valider'), el('button', { type: 'button', class: 'btn annuler' }, 'Annuler')), statut);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    Object.values(erreurs).forEach((x) => { x.textContent = ''; });
    const messages = onValider(v) || {};
    Object.entries(messages).forEach(([cle, m]) => { if (erreurs[cle]) erreurs[cle].textContent = m; });
    if (Object.keys(messages).length) statut.textContent = 'À corriger avant de fermer.';
  });
  form.querySelector('.annuler').addEventListener('click', onAnnuler);

  /* adresse d'un lien collée : titre, description et image proposés par le script (champs déjà modifiés gardés) */
  const adresse = form.querySelector('[name="url"]');
  if (adresse && schema.champs.some((d) => d.cle === 'description')) {
    adresse.addEventListener('change', async () => {
      if (!lienSur(adresse.value.trim())) return;
      const avant = ['titre', 'description', 'image'].map((k) => (form.querySelector(`[name="${k}"]`) || {}).value);
      statut.textContent = 'Lecture de la page…';
      try {
        const r = await appeler('apercuLien', { url: adresse.value.trim() });
        ['titre', 'description', 'image'].forEach((k, i) => {
          const f = form.querySelector(`[name="${k}"]`);
          if (f && f.value === avant[i] && !f.value && r[k]) { f.value = r[k]; v[k] = r[k]; }
        });
        statut.textContent = r.titre ? 'Aperçu récupéré.' : 'Aperçu indisponible : remplis les champs.';
      } catch {
        statut.textContent = 'Aperçu indisponible : remplis les champs.';
      }
    });
  }
  return form;
}
