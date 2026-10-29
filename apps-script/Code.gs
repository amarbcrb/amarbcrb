/* =========================================================================
   Script Google du site amarbcrb.pages.dev
   Stocke le contenu (contenu.json), les médias et le portfolio dans ton Google Drive.
   Installation : voir INSTALLATION.md.

   Lecture  (GET)  : ?a=contenu | ?a=portfolio[&frais=1&jeton=…]
   Écriture (POST) : corps JSON { a, jeton, … } envoyé en text/plain
   Réponse : { ok: true, … } ou { ok: false, erreur }
   ========================================================================= */

/* 1. Écris ici ton mot de passe admin, exécute installer(), puis efface-le (remets '') et enregistre. */
const MOT_DE_PASSE_INITIAL = '';
const URL_CONTENU_DEFAUT = 'https://amarbcrb.pages.dev/content/default.json';

const DUREE_JETON_MS = 30 * 24 * 3600 * 1000;
const ECHECS_MAX = 5;
const BLOCAGE_S = 15 * 60;
const CACHE_PORTFOLIO_S = 5 * 60;
const CV_MAX_OCTETS = 10 * 1024 * 1024;
const IMAGE_MAX_OCTETS = 10 * 1024 * 1024;
const EMPLACEMENTS = ['photo', 'logo', 'favicon', 'cv'];

class ErreurEntree extends Error {
  constructor(code) { super(code); this.code = code; }
}

/* ---------- Installation ---------- */
function installer() {
  if (!MOT_DE_PASSE_INITIAL) throw new Error('Écris ton mot de passe dans MOT_DE_PASSE_INITIAL avant de lancer installer().');
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('ID_CONTENU')) {
    const site = DriveApp.createFolder('Site amarbcrb');
    const medias = site.createFolder('Médias');
    const portfolio = site.createFolder('Portfolio');
    /* les visiteurs doivent pouvoir voir les aperçus et ouvrir les fichiers */
    portfolio.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const defaut = UrlFetchApp.fetch(URL_CONTENU_DEFAUT, { muteHttpExceptions: true });
    if (defaut.getResponseCode() !== 200) throw new Error('Impossible de lire ' + URL_CONTENU_DEFAUT);
    const contenu = site.createFile('contenu.json', defaut.getContentText(), MimeType.PLAIN_TEXT);
    p.setProperties({
      ID_SITE: site.getId(), ID_CONTENU: contenu.getId(), ID_MEDIAS: medias.getId(), ID_PORTFOLIO: portfolio.getId(),
      MDP_SEL: Utilities.getUuid(),
    });
  }
  p.setProperty('MDP_HASH', hacher(MOT_DE_PASSE_INITIAL, p.getProperty('MDP_SEL')));
  /* nouvelle clé de signature : tous les appareils déjà connectés sont déconnectés */
  p.setProperty('CLE', Utilities.getUuid() + Utilities.getUuid());
  console.log('Installation terminée. Efface maintenant le mot de passe de MOT_DE_PASSE_INITIAL, enregistre, puis déploie en Application Web.');
}

/* ---------- Points d'entrée ---------- */
function doGet(e) {
  return traiter(() => {
    const q = (e && e.parameter) || {};
    if (q.a === 'contenu') return lireContenu();
    if (q.a === 'portfolio') return listerPortfolio(q.frais === '1' && verifierJeton(q.jeton));
    throw new ErreurEntree('entree');
  });
}

function doPost(e) {
  return traiter(() => {
    let d;
    try { d = JSON.parse(e.postData.contents); } catch (_) { throw new ErreurEntree('entree'); }
    if (!d || typeof d !== 'object') throw new ErreurEntree('entree');
    if (d.a === 'connexion') return connexion(d.motDePasse);
    if (!verifierJeton(d.jeton)) throw new ErreurEntree('jeton');
    if (d.a === 'enregistrer') return enregistrer(d.versionDeBase, d.contenu);
    if (d.a === 'envoyerMedia') return envoyerMedia(d);
    if (d.a === 'apercuLien') return apercuLien(d.url);
    if (d.a === 'dossierPortfolio') return dossierPortfolio(d.lienDossier);
    throw new ErreurEntree('entree');
  });
}

function traiter(fn) {
  let r;
  try {
    r = Object.assign({ ok: true }, fn());
  } catch (err) {
    r = { ok: false, erreur: err instanceof ErreurEntree ? err.code : 'interne' };
    if (err && err.version !== undefined) r.version = err.version;
    if (!(err instanceof ErreurEntree)) console.error(err);
  }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

const proprietes = () => PropertiesService.getScriptProperties();

/* ---------- Sécurité : mot de passe haché, jeton signé ---------- */
function hacher(mdp, sel) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sel + ':' + mdp, Utilities.Charset.UTF_8));
}

function signerJeton(expireMs) {
  const exp = String(Math.floor(expireMs));
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(exp, proprietes().getProperty('CLE')));
  return exp + '.' + sig;
}

function verifierJeton(jeton) {
  if (typeof jeton !== 'string' || jeton.indexOf('.') < 0) return false;
  const exp = jeton.split('.')[0];
  if (!/^\d+$/.test(exp) || Number(exp) <= Date.now()) return false;
  return signerJeton(Number(exp)) === jeton;
}

function connexion(mdp) {
  const cache = CacheService.getScriptCache();
  const echecs = Number(cache.get('echecs') || 0);
  if (echecs >= ECHECS_MAX) throw new ErreurEntree('bloque');
  const p = proprietes();
  if (typeof mdp !== 'string' || hacher(mdp, p.getProperty('MDP_SEL')) !== p.getProperty('MDP_HASH')) {
    cache.put('echecs', String(echecs + 1), BLOCAGE_S);
    throw new ErreurEntree('mot_de_passe');
  }
  cache.remove('echecs');
  const expire = Date.now() + DUREE_JETON_MS;
  return { jeton: signerJeton(expire), expire: expire };
}

/* ---------- Contenu ---------- */
function fichierContenu() { return DriveApp.getFileById(proprietes().getProperty('ID_CONTENU')); }

function lireContenu() {
  const contenu = JSON.parse(fichierContenu().getBlob().getDataAsString());
  return { version: Number(contenu.version) || 0, contenu: contenu };
}

function enregistrer(versionDeBase, contenu) {
  if (!contenu || typeof contenu !== 'object' || Array.isArray(contenu)) throw new ErreurEntree('entree');
  const verrou = LockService.getScriptLock();
  verrou.waitLock(10000);
  try {
    const actuel = lireContenu();
    if (Number(versionDeBase) !== actuel.version) {
      const e = new ErreurEntree('conflit');
      e.version = actuel.version;
      throw e;
    }
    contenu.version = actuel.version + 1;
    contenu.updatedAt = new Date().toISOString();
    fichierContenu().setContent(JSON.stringify(contenu));
    nettoyerMedias(contenu);
    return { version: contenu.version };
  } finally {
    verrou.releaseLock();
  }
}

/* ---------- Médias : un envoi ajoute un fichier ; l'enregistrement met à la corbeille ceux que le contenu n'utilise plus ---------- */
function nettoyerMedias(contenu) {
  try {
    const utilises = {};
    const medias = contenu.medias || {};
    EMPLACEMENTS.forEach((k) => { if (medias[k] && medias[k].id) utilises[medias[k].id] = true; });
    const it = DriveApp.getFolderById(proprietes().getProperty('ID_MEDIAS')).getFiles();
    while (it.hasNext()) {
      const f = it.next();
      if (!f.isTrashed() && !utilises[f.getId()]) f.setTrashed(true);
    }
  } catch (err) {
    console.error(err); /* le contenu est enregistré ; un fichier en trop reste dans Médias */
  }
}

const urlImage = (id, largeur) => 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + largeur;

function envoyerMedia(d) {
  const emplacement = d.emplacement;
  if (EMPLACEMENTS.indexOf(emplacement) < 0 || typeof d.base64 !== 'string' || typeof d.type !== 'string') throw new ErreurEntree('entree');
  const estCv = emplacement === 'cv';
  if (estCv ? d.type !== 'application/pdf' : d.type.indexOf('image/') !== 0) throw new ErreurEntree('entree');
  const octets = Utilities.base64Decode(d.base64);
  if (octets.length > (estCv ? CV_MAX_OCTETS : IMAGE_MAX_OCTETS)) throw new ErreurEntree('entree');
  const p = proprietes();
  const nom = String(d.nom || emplacement).slice(0, 120);
  const fichier = DriveApp.getFolderById(p.getProperty('ID_MEDIAS')).createFile(Utilities.newBlob(octets, d.type, nom));
  fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const id = fichier.getId();
  return { id: id, url: estCv ? 'https://drive.google.com/uc?export=download&id=' + id : urlImage(id, emplacement === 'favicon' ? 512 : 2000) };
}

/* ---------- Aperçu d'un lien : titre, description, image ---------- */
function decoderEntites(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

function resoudreUrl(rel, base) {
  if (!rel) return '';
  if (/^https?:\/\//i.test(rel)) return rel;
  const m = /^(https?:)\/\/([^/]+)(\/[^?#]*)?/i.exec(base);
  if (!m) return '';
  if (rel.indexOf('//') === 0) return m[1] + rel;
  if (rel.charAt(0) === '/') return m[1] + '//' + m[2] + rel;
  const dossier = (m[3] || '/').replace(/[^/]*$/, '');
  return m[1] + '//' + m[2] + dossier + rel;
}

function lireMeta(html, urlBase) {
  const metas = {};
  (html.match(/<meta\b[^>]*>/gi) || []).forEach((balise) => {
    const attr = (nom) => {
      const m = new RegExp('\\b' + nom + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i').exec(balise);
      return m ? (m[2] !== undefined ? m[2] : m[3]) : null;
    };
    const cle = (attr('property') || attr('name') || '').toLowerCase();
    const val = attr('content');
    if (cle && val !== null && !(cle in metas)) metas[cle] = decoderEntites(val);
  });
  const titre = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return {
    titre: metas['og:title'] || metas['twitter:title'] || (titre ? decoderEntites(titre[1]) : ''),
    description: metas['og:description'] || metas.description || metas['twitter:description'] || '',
    image: resoudreUrl(metas['og:image'] || metas['twitter:image'] || '', urlBase),
  };
}

function apercuLien(url) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new ErreurEntree('entree');
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (r.getResponseCode() >= 400) return { titre: '', description: '', image: '' };
  return lireMeta(r.getContentText().slice(0, 300000), url);
}

/* ---------- Portfolio ---------- */
function idDepuisLien(lien) {
  const s = String(lien || '');
  const m = /folders\/([\w-]+)/.exec(s) || /[?&]id=([\w-]+)/.exec(s);
  if (m) return m[1];
  return /^[\w-]{10,}$/.test(s) ? s : null;
}

function sousDossiers(racine) {
  const liste = [];
  const it = racine.getFolders();
  while (it.hasNext()) {
    const d = it.next();
    if (!d.isTrashed()) liste.push(d);
  }
  return liste;
}

function dossierPortfolio(lien) {
  const id = idDepuisLien(lien);
  if (!id) throw new ErreurEntree('entree');
  let racine;
  try { racine = DriveApp.getFolderById(id); } catch (_) { throw new ErreurEntree('entree'); }
  racine.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  proprietes().setProperty('ID_PORTFOLIO', id);
  CacheService.getScriptCache().remove('portfolio');
  return { id: id, sousDossiers: sousDossiers(racine).map((d) => ({ id: d.getId(), nom: d.getName() })) };
}

function listerPortfolio(frais) {
  const cache = CacheService.getScriptCache();
  if (!frais) {
    const enCache = cache.get('portfolio');
    if (enCache) return JSON.parse(enCache);
  }
  const id = proprietes().getProperty('ID_PORTFOLIO');
  if (!id) return { dossiers: [] };
  const dossiers = sousDossiers(DriveApp.getFolderById(id)).map((d) => {
    const fichiers = [];
    const it = d.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      if (f.isTrashed()) continue;
      fichiers.push({ id: f.getId(), nom: f.getName(), type: f.getMimeType(), apercu: urlImage(f.getId(), 800), lien: f.getUrl() });
    }
    fichiers.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
    return { id: d.getId(), nom: d.getName(), fichiers: fichiers };
  });
  const r = { dossiers: dossiers };
  const texte = JSON.stringify(r);
  if (texte.length < 90000) cache.put('portfolio', texte, CACHE_PORTFOLIO_S);
  return r;
}
