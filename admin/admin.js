/* Admin : connexion, écrans, brouillon local, enregistrement et conflit de version. */
import { appeler, lireJeton, ecrireJeton, effacerJeton, lireContenuFrais } from '../assets/api.js';
import { normaliser, valider } from '../assets/model.js';
import { ECRANS } from './ecrans.js';

const $ = (id) => document.getElementById(id);
const CLE_BROUILLON = 'ab-brouillon';
const etat = { contenu: null, versionDeBase: 0, sale: false, ecran: 'accueil' };

const MESSAGES = {
  mot_de_passe: 'Mot de passe incorrect.',
  bloque: 'Trop d\'essais. Réessaie dans 15 minutes.',
  reseau: 'Connexion impossible. Vérifie ta connexion internet.',
  interne: 'Le script Google a rencontré une erreur. Réessaie.',
  entree: 'Données refusées par le script.',
};

function lireBrouillon() { try { return JSON.parse(localStorage.getItem(CLE_BROUILLON)); } catch { return null; } }
function ecrireBrouillon() {
  try { localStorage.setItem(CLE_BROUILLON, JSON.stringify({ versionDeBase: etat.versionDeBase, contenu: etat.contenu })); } catch { /* stockage plein */ }
}
function effacerBrouillon() { try { localStorage.removeItem(CLE_BROUILLON); } catch { /* idem */ } }

function dire(message) { $('etat').textContent = message; }

/* ---------- Modification par chemin ---------- */
export function modifier(chemin, valeur) {
  const cles = chemin.split('.');
  let o = etat.contenu;
  cles.slice(0, -1).forEach((k) => { if (o[k] === undefined || o[k] === null) o[k] = {}; o = o[k]; });
  o[cles.at(-1)] = valeur;
  etat.sale = true;
  ecrireBrouillon();
  majBarre();
}

function majBarre() {
  const erreurs = valider(etat.contenu);
  const parChemin = new Map(erreurs.map((e) => [e.chemin, e.message]));
  document.querySelectorAll('[data-erreur]').forEach((s) => { s.textContent = parChemin.get(s.dataset.erreur) || ''; });
  $('nonEnregistre').hidden = !etat.sale;
  $('enregistrer').disabled = erreurs.length > 0;
  if (erreurs.length) dire(`${erreurs.length} champ${erreurs.length > 1 ? 's' : ''} à corriger.`);
  else if ($('etat').textContent.endsWith('à corriger.')) dire('');
}

/* ---------- Écrans ---------- */
function rendreEcran() {
  const nav = document.querySelector('.ecrans');
  if (!nav.childElementCount) {
    ECRANS.forEach((e) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.ecran = e.id;
      b.textContent = e.titre;
      b.addEventListener('click', () => { etat.ecran = e.id; rendreEcran(); $('ecran').focus({ preventScroll: true }); scrollTo(0, 0); });
      nav.append(b);
    });
  }
  nav.querySelectorAll('button').forEach((b) => (b.dataset.ecran === etat.ecran ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  ECRANS.find((e) => e.id === etat.ecran).rendre($('ecran'), etat, modifier, rendreEcran);
  majBarre();
}

/* ---------- Connexion ---------- */
function montrerConnexion(message = '') {
  $('app').hidden = true;
  $('connexion').hidden = false;
  $('connexionErreur').textContent = message;
  $('motDePasse').focus();
}

$('connexion').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('connexionErreur').textContent = '';
  const bouton = $('connexion').querySelector('button');
  bouton.disabled = true;
  try {
    const r = await appeler('connexion', { motDePasse: $('motDePasse').value });
    ecrireJeton(r.jeton, r.expire);
    $('motDePasse').value = '';
    await charger();
  } catch (err) {
    $('connexionErreur').textContent = MESSAGES[err.code] || MESSAGES.interne;
  } finally {
    bouton.disabled = false;
  }
});

$('deconnexion').addEventListener('click', () => { effacerJeton(); montrerConnexion(); });

/* ---------- Chargement et brouillon ---------- */
async function charger() {
  let lu;
  try {
    lu = await lireContenuFrais();
  } catch (err) {
    montrerConnexion(MESSAGES[err.code] || MESSAGES.interne);
    return;
  }
  etat.contenu = lu.contenu;
  etat.versionDeBase = lu.version;
  etat.sale = false;
  $('connexion').hidden = true;
  $('app').hidden = false;
  rendreEcran();
  const b = lireBrouillon();
  if (b && b.contenu && JSON.stringify(normaliser(b.contenu)) !== JSON.stringify(etat.contenu)) $('brouillon').hidden = false;
}

$('brouillonReprendre').addEventListener('click', () => {
  const b = lireBrouillon();
  etat.contenu = normaliser(b.contenu);
  etat.versionDeBase = b.versionDeBase;
  etat.sale = true;
  $('brouillon').hidden = true;
  rendreEcran();
});
$('brouillonIgnorer').addEventListener('click', () => { effacerBrouillon(); $('brouillon').hidden = true; });

/* ---------- Enregistrement ---------- */
async function enregistrer() {
  if (valider(etat.contenu).length) return;
  $('enregistrer').disabled = true;
  dire('Enregistrement…');
  try {
    const r = await appeler('enregistrer', { versionDeBase: etat.versionDeBase, contenu: etat.contenu });
    etat.versionDeBase = r.version;
    etat.contenu.version = r.version;
    etat.sale = false;
    effacerBrouillon();
    dire('Enregistré. Le site est à jour.');
  } catch (err) {
    if (err.code === 'conflit') { etat.versionDistante = err.version; $('conflit').hidden = false; dire(''); }
    else if (err.code === 'jeton') { effacerJeton(); montrerConnexion('Session expirée : reconnecte-toi, tes modifications sont gardées.'); }
    else if (err.code === 'reseau') dire('Pas de réseau : tes modifications sont gardées sur cet appareil. Réessaie.');
    else dire(MESSAGES[err.code] || MESSAGES.interne);
  } finally {
    majBarre();
  }
}
$('enregistrer').addEventListener('click', enregistrer);

$('conflitRecharger').addEventListener('click', async () => {
  $('conflit').hidden = true;
  effacerBrouillon();
  await charger();
  dire('Dernière version chargée.');
});
$('conflitEcraser').addEventListener('click', () => {
  $('conflit').hidden = true;
  etat.versionDeBase = etat.versionDistante;
  enregistrer();
});

addEventListener('beforeunload', (e) => { if (etat.sale) e.preventDefault(); });

if (lireJeton()) charger(); else montrerConnexion();
