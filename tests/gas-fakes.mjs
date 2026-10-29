/* Faux services Google Apps Script, en mémoire, pour exécuter apps-script/Code.gs dans node:vm. */
import { createHmac, createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const octets = (v) => (Array.isArray(v) || v instanceof Uint8Array ? Buffer.from(v) : Buffer.from(String(v), 'utf8'));

export function creerGas({ motDePasse = 'secret', pages = {} } = {}) {
  let n = 0;
  const id = (p) => `${p}${++n}`;
  const props = new Map();
  const cache = new Map();
  const fichiers = new Map();
  const dossiers = new Map();
  const appels = { fetch: [], folderReads: 0 };

  function blob(bytes, type, nom) {
    const buf = octets(bytes);
    return { getBytes: () => [...buf], getDataAsString: () => buf.toString('utf8'), getContentType: () => type, getName: () => nom, setName(x) { nom = x; return this; }, _buf: buf };
  }
  function fichier(nom, contenu, type, parent) {
    const f = {
      _id: id('file'), _nom: nom, _buf: octets(contenu), _type: type, _parent: parent, _corbeille: false, _partage: null,
      getId() { return this._id; }, getName() { return this._nom; }, getMimeType() { return this._type; },
      getUrl() { return `https://drive.google.com/file/d/${this._id}/view`; },
      getSize() { return this._buf.length; },
      getBlob() { return blob(this._buf, this._type, this._nom); },
      setContent(s) { this._buf = octets(s); return this; },
      setTrashed(v) { this._corbeille = v; return this; }, isTrashed() { return this._corbeille; },
      setSharing(a, p) { this._partage = [a, p]; return this; },
    };
    fichiers.set(f._id, f);
    return f;
  }
  const iter = (liste) => { let i = 0; return { hasNext: () => i < liste.length, next: () => liste[i++] }; };
  function dossier(nom, parent) {
    const d = {
      _id: id('folder'), _nom: nom, _parent: parent, _partage: null,
      getId() { return this._id; }, getName() { return this._nom; },
      getUrl() { return `https://drive.google.com/drive/folders/${this._id}`; },
      createFolder(x) { return dossier(x, this); },
      createFile(a, b, c) { return typeof a === 'string' ? fichier(a, b, c || 'text/plain', this) : fichier(a.getName(), a._buf, a.getContentType(), this); },
      getFolders() { appels.folderReads++; return iter([...dossiers.values()].filter((x) => x._parent === this)); },
      getFiles() { return iter([...fichiers.values()].filter((x) => x._parent === this && !x._corbeille)); },
      setSharing(a, p) { this._partage = [a, p]; return this; },
    };
    dossiers.set(d._id, d);
    return d;
  }
  const racine = dossier('Mon Drive', null);

  const ctx = {
    console,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (props.has(k) ? props.get(k) : null),
      setProperty(k, v) { props.set(k, String(v)); return this; },
      setProperties(o) { Object.entries(o).forEach(([k, v]) => props.set(k, String(v))); return this; },
      deleteProperty(k) { props.delete(k); return this; },
    }) },
    CacheService: { getScriptCache: () => ({
      get: (k) => (cache.has(k) ? cache.get(k) : null),
      put: (k, v) => { cache.set(k, String(v)); },
      remove: (k) => { cache.delete(k); },
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeHmacSha256Signature: (v, k) => [...createHmac('sha256', octets(k)).update(octets(v)).digest()],
      computeDigest: (alg, v) => [...createHash('sha256').update(octets(v)).digest()],
      base64EncodeWebSafe: (b) => octets(b).toString('base64url'),
      base64Encode: (b) => octets(b).toString('base64'),
      base64Decode: (s) => [...Buffer.from(s, 'base64')],
      newBlob: (bytes, type, nom) => blob(bytes, type, nom),
      getUuid: () => randomUUID(),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (s) => ({ _s: s, setMimeType() { return this; }, getContent() { return this._s; } }),
    },
    MimeType: { PLAIN_TEXT: 'text/plain' },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
      Permission: { VIEW: 'VIEW' },
      getRootFolder: () => racine,
      createFolder: (x) => racine.createFolder(x),
      getFileById: (x) => { const f = fichiers.get(x); if (!f) throw new Error('No item with the given ID'); return f; },
      getFolderById: (x) => { const d = dossiers.get(x); if (!d) throw new Error('No item with the given ID'); return d; },
    },
    UrlFetchApp: {
      fetch: (url) => {
        appels.fetch.push(url);
        const p = pages[url];
        if (!p) return { getResponseCode: () => 404, getContentText: () => '' };
        return { getResponseCode: () => 200, getContentText: () => p };
      },
    },
  };
  vm.createContext(ctx);
  const source = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8')
    .replace("const MOT_DE_PASSE_INITIAL = '';", `const MOT_DE_PASSE_INITIAL = ${JSON.stringify(motDePasse)};`);
  vm.runInContext(source, ctx, { filename: 'Code.gs' });

  const lire = (sortie) => JSON.parse(sortie.getContent());
  return {
    ctx, props, cache, fichiers, dossiers, appels,
    get: (params) => lire(ctx.doGet({ parameter: params })),
    post: (corps) => lire(ctx.doPost({ postData: { contents: JSON.stringify(corps), type: 'text/plain' } })),
  };
}
