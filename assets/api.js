/* Client du script Google : lecture du contenu et du portfolio, écritures de l'admin, jeton.
   Le site s'affiche d'abord depuis la copie du navigateur, puis se met à jour en silence. */
import { SCRIPT_URL } from './config.js';
import { normaliser } from './model.js';

const CLE_CONTENU = 'ab-contenu';
const CLE_JETON = 'ab-jeton';

function stockageNavigateur() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

const cfg = { url: SCRIPT_URL, stockage: undefined, delai: 8000, delaiEcriture: 60000, secours: '/content/default.json' };

/* réglages : utilisés par les tests (URL du faux script, stockage en mémoire, délai court) */
export function configurer(options) { Object.assign(cfg, options); }

const stockage = () => (cfg.stockage === undefined ? stockageNavigateur() : cfg.stockage);
function lire(cle) {
  try { const s = stockage(); const v = s && s.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; }
}
function ecrire(cle, valeur) {
  try { const s = stockage(); if (s) s.setItem(cle, JSON.stringify(valeur)); } catch { /* stockage plein ou bloqué */ }
}
function effacer(cle) {
  try { const s = stockage(); if (s) s.removeItem(cle); } catch { /* idem */ }
}

export class ErreurApi extends Error {
  constructor(code, extra = {}) {
    super(code);
    this.code = code;
    Object.assign(this, extra);
  }
}

async function requete(url, options, delai) {
  if (!cfg.url) throw new ErreurApi('reseau');
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), delai);
  let corps;
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal, redirect: 'follow' });
    corps = await r.json();
  } catch {
    throw new ErreurApi('reseau');
  } finally {
    clearTimeout(minuteur);
  }
  if (!corps || typeof corps !== 'object') throw new ErreurApi('reseau');
  if (!corps.ok) {
    const { erreur, ok, ...extra } = corps;
    throw new ErreurApi(erreur || 'interne', extra);
  }
  return corps;
}

function lireScript(action, params = {}) {
  const q = new URLSearchParams({ a: action, ...params });
  return requete(`${cfg.url}?${q}`, { method: 'GET' }, cfg.delai);
}

/* lecture du contenu : la page l'a peut-être déjà demandée (script en tête de index.html) ; on la réutilise une fois */
function lireContenuScript() {
  const tot = globalThis.__contenu;
  if (!tot) return lireScript('contenu');
  globalThis.__contenu = null;
  return tot.then((corps) => {
    if (!corps || typeof corps !== 'object' || !corps.ok) throw new ErreurApi('reseau');
    return corps;
  }).catch(() => lireScript('contenu'));
}

export async function lireContenuFrais() {
  const r = await lireScript('contenu');
  return { version: r.version, contenu: normaliser(r.contenu) };
}

export async function chargerContenu(onMaj) {
  const copie = lire(CLE_CONTENU);
  if (copie && copie.contenu) {
    lireContenuScript().then((r) => {
      if (r.version === copie.version) return;
      ecrire(CLE_CONTENU, { version: r.version, contenu: r.contenu });
      if (onMaj) onMaj(normaliser(r.contenu));
    }).catch(() => { /* on garde la copie */ });
    return { contenu: normaliser(copie.contenu), source: 'cache' };
  }
  try {
    const r = await lireContenuScript();
    ecrire(CLE_CONTENU, { version: r.version, contenu: r.contenu });
    return { contenu: normaliser(r.contenu), source: 'script' };
  } catch {
    let brut = null;
    try { brut = await (await fetch(cfg.secours)).json(); } catch { /* secours absent */ }
    return { contenu: normaliser(brut), source: 'secours' };
  }
}

/* galerie Drive d'un onglet : { dossiers, fichiers }, null si le script est en panne */
export async function lireGalerie(id) {
  try {
    const r = await lireScript('galerie', { id });
    return { dossiers: Array.isArray(r.dossiers) ? r.dossiers : [], fichiers: Array.isArray(r.fichiers) ? r.fichiers : [], protege: !!r.protege };
  } catch {
    return null;
  }
}

export async function lirePortfolio({ frais = false } = {}) {
  const jeton = lireJeton();
  try {
    const r = await lireScript('portfolio', frais && jeton ? { frais: '1', jeton } : {});
    const dossiers = Array.isArray(r.dossiers) ? r.dossiers : [];
    dossiers.racine = r.racine || ''; /* id Drive du dossier Portfolio : l'édition y crée des dossiers */
    return dossiers;
  } catch {
    return null;
  }
}

export function appeler(action, donnees = {}) {
  const corps = { a: action, ...donnees };
  if (action !== 'connexion' && corps.jeton === undefined) corps.jeton = lireJeton();
  return requete(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corps) }, cfg.delaiEcriture);
}

/* médiathèque : fichiers déjà envoyés (plus récents d'abord) ; suppression refusée s'ils sont utilisés */
export async function listerMedias() { return (await appeler('listerMedias')).medias || []; }
export function supprimerMedia(id) { return appeler('supprimerMedia', { id }); }

/* copie du navigateur après une publication depuis le site : la prochaine visite part de la version publiée */
export function memoriserContenu(version, contenu) { ecrire(CLE_CONTENU, { version, contenu }); }

export function lireJeton() {
  const j = lire(CLE_JETON);
  if (!j || typeof j.jeton !== 'string' || !(j.expire > Date.now())) return null;
  return j.jeton;
}
export function ecrireJeton(jeton, expire) { ecrire(CLE_JETON, { jeton, expire }); }
export function effacerJeton() { effacer(CLE_JETON); }
