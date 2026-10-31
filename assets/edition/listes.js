/* Outils de l'édition sur les cartes et les listes : ✎ modifier, 🗑 supprimer (avec « Rétablir »), ↑ ↓ déplacer, « + Ajouter ». */
import { el } from '../dom.js';
import { nouvelId, valider } from '../model.js';
import { lireChemin, cheminIndex } from '../chemins.js';
import { schemaDe } from '../schemas.js';
import { ouvrirFiche, fermerFiche } from '../fiche.js';
import { formulaire } from './fiche-edition.js';

const ICONES = {
  modifier: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>',
  supprimer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
  avancer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  reculer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
};
const nomDe = (x) => (x && (x.titre || x.domaine || x.langue || x.nom || x.label || x.valeur)) || 'élément';
const decouper = (cle) => { const i = cle.lastIndexOf('#'); return i < 0 ? { liste: null, id: null } : { liste: cle.slice(0, i), id: cle.slice(i + 1) }; };
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/* ctx : { contenu() → brouillon, noter(chemin), rendre(), dire(texte, action?) } */
export function outilsListes(ctx) {
  const tableau = (liste) => lireChemin(ctx.contenu(), liste);

  function erreursDe(prefixe) {
    const p = prefixe + '.';
    const m = {};
    valider(ctx.contenu()).filter((e) => e.chemin.startsWith(p)).forEach((e) => { m[e.chemin.slice(p.length).split('.')[0]] = e.message; });
    return m;
  }

  /* feuille de modification d'un élément (ou des coordonnées : cle « contact ») */
  function modifier(cle, { nouveau = false, liste = null, element = null } = {}) {
    const objet = cle === 'contact';
    const { liste: l, id } = objet ? { liste: 'contact' } : cle ? decouper(cle) : { liste, id: null };
    const schema = schemaDe(liste || l);
    if (!schema) return;
    const cible = element || (objet ? ctx.contenu().contact : (tableau(l) || []).find((x) => x.id === id));
    if (!cible) return;
    /* élément existant : ses valeurs d'avant, rétablies si la feuille est fermée sans validation réussie */
    const avant = nouveau ? null : JSON.parse(JSON.stringify(cible));
    const chemin = objet ? 'contact' : `${liste || l}#${cible.id}`;
    let valide = false;
    const retablir = () => {
      if (!avant || valide) return;
      Object.keys(cible).forEach((k) => { delete cible[k]; });
      Object.assign(cible, JSON.parse(JSON.stringify(avant)));
      ctx.noter(chemin);
    };
    const form = formulaire({
      schema, valeurs: cible, c: ctx.contenu(), nouveau,
      onValider: (v) => {
        if (nouveau && !(tableau(liste) || []).includes(cible)) {
          const t = tableau(liste);
          if (liste === 'liens.items') t.unshift(cible); else t.push(cible);
        }
        schema.champs.forEach((d) => { if (d.type === 'fin') { cible.fin = v.fin ?? null; cible.enCours = !!v.enCours; } else if (d.cle in v) cible[d.cle] = v[d.cle]; });
        ctx.noter(chemin);
        const m = erreursDe(objet ? 'contact' : cheminIndex(ctx.contenu(), chemin));
        if (Object.keys(m).length) return m;
        valide = true;
        fermerFiche({ silencieux: true });
        ctx.rendre();
        return {};
      },
      onAnnuler: () => {
        /* un nouvel élément refusé puis abandonné ne reste pas dans le brouillon */
        const t = nouveau ? tableau(liste) : null;
        if (t && t.includes(cible)) { t.splice(t.indexOf(cible), 1); ctx.noter(`${liste}#${cible.id}`); }
        retablir();
        fermerFiche({ silencieux: true });
        ctx.rendre();
      },
    });
    /* fermée par Échap ou le fond : la page est redessinée (un nouvel élément refusé y apparaît, à corriger) */
    ouvrirFiche({ titre: nouveau ? `Ajouter ${schema.libelle}` : `Modifier ${objet ? schema.libelle : nomDe(cible)}`, corps: form, onFerme: () => { retablir(); ctx.rendre(); } });
  }

  /* categorie : rangée d'une catégorie de ressources où l'on a cliqué « + Ajouter » */
  function ajouter(liste, categorie = '') {
    const schema = schemaDe(liste);
    if (!schema) return;
    const element = { id: nouvelId(schema.prefixe), ...JSON.parse(JSON.stringify(schema.nouveau)), visible: true };
    if (liste === 'liens.items') { element.categorie = categorie || (ctx.contenu().liens.categories[0] || {}).id || ''; element.date = aujourdhui(); }
    modifier(null, { nouveau: true, liste, element });
  }

  function supprimer(cle) {
    const { liste, id } = decouper(cle);
    const t = tableau(liste);
    const i = (t || []).findIndex((x) => x.id === id);
    if (i < 0) return;
    if (liste === 'liens.categories' && ctx.contenu().liens.items.some((x) => x.categorie === id)) {
      ctx.dire(`La catégorie « ${t[i].nom} » contient encore des liens : déplace-les ou supprime-les d'abord.`);
      return;
    }
    if (!confirm(`Supprimer « ${nomDe(t[i])} » ?`)) return;
    const [retire] = t.splice(i, 1);
    ctx.noter(cle);
    ctx.rendre();
    ctx.dire(`« ${nomDe(retire)} » supprimé.`, { libelle: 'Rétablir', action: () => { t.splice(i, 0, retire); ctx.noter(cle); ctx.rendre(); ctx.dire('Rétabli.'); } });
  }

  function deplacer(cle, pas) {
    const { liste, id } = decouper(cle);
    const t = tableau(liste);
    const i = (t || []).findIndex((x) => x.id === id);
    const j = i + pas;
    if (i < 0 || j < 0 || j >= t.length) return;
    [t[i], t[j]] = [t[j], t[i]];
    ctx.noter(cle);
    ctx.rendre();
  }

  const bouton = (action, libelle, onClic) => {
    const b = el('button', { type: 'button', class: `outil ${action}`, 'aria-label': libelle, html: ICONES[action] });
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClic(); });
    return b;
  };

  /* ajoute les outils aux éléments marqués (data-element) et « + Ajouter » aux listes (data-liste) */
  function cabler(racine) {
    if (!racine) return;
    racine.querySelectorAll('[data-element]:not([data-outils])').forEach((x) => {
      x.dataset.outils = '1';
      const cle = x.dataset.element;
      const objet = cle === 'contact';
      const { liste, id } = objet ? { liste: 'contact' } : decouper(cle);
      const schema = schemaDe(liste);
      if (!schema) return;
      const item = objet ? null : (tableau(liste) || []).find((y) => y.id === id);
      const nom = objet ? 'coordonnées' : nomDe(item);
      /* coordonnées : un bouton écrit en tête de liste (une icône posée sur la ligne E-mail ne disait pas qu'elle change aussi LinkedIn) */
      if (objet) {
        const b = bouton('modifier', `Modifier : ${nom}`, () => modifier(cle));
        b.append(' Modifier l\'e-mail et le lien LinkedIn');
        x.prepend(el('li', { class: 'ajout-li' }, el('span', { class: 'outils-edition outils-texte', 'data-pour': cle }, b)));
        return;
      }
      const barre = el('span', { class: 'outils-edition', 'data-pour': cle }, bouton('modifier', `Modifier : ${nom}`, () => modifier(cle)));
      if (!objet) {
        if (!schema.trie) barre.append(bouton('avancer', `Avancer : ${nom}`, () => deplacer(cle, -1)), bouton('reculer', `Reculer : ${nom}`, () => deplacer(cle, 1)));
        barre.append(bouton('supprimer', `Supprimer : ${nom}`, () => supprimer(cle)));
      }
      /* un lien ou un bouton ne peut pas contenir d'autres boutons : on l'enveloppe */
      if (x.matches('a, button')) {
        const enveloppe = el('div', { class: 'carte-edition' });
        x.replaceWith(enveloppe);
        enveloppe.append(x, barre);
      } else if (/^(UL|OL)$/.test(x.tagName)) x.append(el('li', { class: 'ajout-li' }, barre));
      else x.append(barre);
    });
    racine.querySelectorAll('[data-liste]:not([data-ajout])').forEach((x) => {
      x.dataset.ajout = '1';
      const schema = schemaDe(x.dataset.liste);
      if (!schema) return;
      /* data-ajout : le bouton porte data-liste (pour les tests et l'accessibilité) sans être lui-même une liste */
      const b = el('button', { type: 'button', class: 'ajout', 'data-liste': x.dataset.liste, 'data-ajout': '1' }, `+ Ajouter ${schema.libelle}`);
      b.addEventListener('click', (e) => { e.preventDefault(); ajouter(x.dataset.liste, x.dataset.categorie); });
      const piste = x.querySelector(':scope > .piste-cadre > .piste, :scope > .piste, :scope > .frise') || x;
      if (/^(UL|OL)$/.test(piste.tagName)) piste.append(el('li', { class: 'ajout-li' }, b)); else piste.append(b);
    });
  }

  return { cabler, modifier, ajouter };
}
