/* Édition sur le site (chargée seulement pour le propriétaire connecté) : textes modifiables sur place,
   brouillon sur l'appareil, « Publier » envoie au script Google. */
import { appeler, lireContenuFrais, effacerJeton } from '../api.js';
import { normaliser, valider } from '../model.js';
import { lireChemin, ecrireChemin } from '../chemins.js';
import { lireBrouillon, ecrireBrouillon, effacerBrouillon } from './brouillon.js';
import { monterBarreEdition } from './barre.js';
import { outilsListes } from './listes.js';
import { outilsDossiers } from './dossiers.js';

const cloner = (o) => JSON.parse(JSON.stringify(o));
const MESSAGES = { reseau: 'Pas de réseau : tes modifications sont gardées sur cet appareil. Réessaie.', interne: 'Le script Google a rencontré une erreur. Réessaie.', entree: 'Données refusées par le script.' };

/* site : { publie() → { contenu, version }, afficher(contenu), apresPublication(contenu), quitter(), reconnexion() } */
export function activer(site) {
  const { contenu, version } = site.publie();
  const lu = lireBrouillon();
  let b = lu && lu.versionDeBase !== undefined ? { ...lu, contenu: normaliser(lu.contenu), chemins: lu.chemins || [] }
    : { versionDeBase: version, contenu: cloner(contenu), chemins: [] };
  const barre = monterBarreEdition({ onPublier: publier, onAnnuler: annuler, onQuitter: quitter });
  document.body.classList.add('edition');

  const garder = () => { ecrireBrouillon(b); barre.compter(b.chemins.length); };
  const noter = (chemin) => { if (!b.chemins.includes(chemin)) b.chemins.push(chemin); garder(); };
  const ctxOutils = { site, contenu: () => b.contenu, noter, rendre: () => montrer(), dire: (t, action) => barre.dire(t, action) };
  const listes = outilsListes(ctxOutils);
  const dossiers = outilsDossiers(ctxOutils);

  /* textes marqués data-edit : modifiables sur place, enregistrés dans le brouillon en quittant le champ */
  function cabler(racine) {
    if (!racine) return;
    listes.cabler(racine);
    dossiers.cabler(racine);
    racine.querySelectorAll('[data-edit]:not([data-cable])').forEach((x) => {
      x.dataset.cable = '1';
      x.setAttribute('contenteditable', 'plaintext-only');
      x.spellcheck = true;
      const multiligne = x.dataset.multiligne !== undefined;
      x.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !multiligne) { e.preventDefault(); x.blur(); } });
      x.addEventListener('blur', () => {
        const chemin = x.dataset.edit;
        const valeur = multiligne ? x.innerText.replace(/\n{3,}/g, '\n\n').trim() : x.textContent.replace(/\s+/g, ' ').trim();
        if (valeur === (lireChemin(b.contenu, chemin) ?? '')) return;
        /* texte affiché par défaut (champ vide) laissé tel quel : rien à enregistrer */
        if (x.dataset.repli !== undefined && valeur === x.dataset.repli && !lireChemin(b.contenu, chemin)) return;
        if (ecrireChemin(b.contenu, chemin, valeur)) noter(chemin);
      });
    });
  }
  const observateur = new MutationObserver(() => { cabler(document.getElementById('vue')); cabler(document.getElementById('ficheCorps')); });
  observateur.observe(document.getElementById('vue'), { childList: true, subtree: true });
  observateur.observe(document.getElementById('ficheCorps'), { childList: true, subtree: true });

  function montrer() { site.afficher(b.contenu); cabler(document.getElementById('vue')); barre.compter(b.chemins.length); }

  async function publier() {
    const erreurs = valider(b.contenu);
    if (erreurs.length) { barre.dire(`${erreurs.length} champ${erreurs.length > 1 ? 's' : ''} à corriger avant de publier.`); return; }
    barre.occupe(true);
    barre.dire('Publication…');
    try {
      const r = await appeler('enregistrer', { versionDeBase: b.versionDeBase, contenu: b.contenu });
      b.contenu.version = r.version;
      site.apresPublication(cloner(b.contenu));
      effacerBrouillon();
      b = { versionDeBase: r.version, contenu: b.contenu, chemins: [] };
      barre.compter(0);
      barre.dire('Publié. Le site est à jour.');
    } catch (err) {
      if (err.code === 'conflit') {
        barre.dire('');
        barre.conflit({
          onRecharger: async () => {
            if (!confirm('Abandonner tes modifications et charger la version en ligne ?')) return;
            let frais;
            try { frais = await lireContenuFrais(); } catch { barre.dire('Connexion impossible : tes modifications sont gardées. Réessaie.'); return; }
            site.apresPublication(cloner(frais.contenu));
            effacerBrouillon();
            b = { versionDeBase: frais.version, contenu: cloner(frais.contenu), chemins: [] };
            montrer();
            barre.dire('Version en ligne chargée.');
          },
          onEcraser: () => { b.versionDeBase = err.version; garder(); publier(); },
        });
      } else if (err.code === 'jeton') {
        effacerJeton();
        barre.dire('Session expirée : reconnecte-toi (appui long sur ton nom). Tes modifications sont gardées.');
        site.reconnexion();
      } else barre.dire(MESSAGES[err.code] || MESSAGES.interne);
    } finally {
      barre.occupe(false);
    }
  }

  function annuler() {
    if (b.chemins.length && !confirm('Annuler toutes tes modifications non publiées ?')) return;
    effacerBrouillon();
    const p = site.publie();
    b = { versionDeBase: p.version, contenu: cloner(p.contenu), chemins: [] };
    montrer();
    barre.dire('Modifications annulées.');
  }

  function quitter() {
    observateur.disconnect();
    barre.detruire();
    document.body.classList.remove('edition');
    document.querySelectorAll('[data-cable]').forEach((x) => { x.removeAttribute('contenteditable'); delete x.dataset.cable; });
    site.quitter();
  }

  montrer();
  return { quitter };
}
