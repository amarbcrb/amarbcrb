/* Faux script Google : même API que apps-script/Code.gs, état en mémoire, réglable par les tests. */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const DEFAUT = () => JSON.parse(readFileSync(new URL('../content/default.json', import.meta.url), 'utf8'));
const MAX = { cv: 10 * 1024 * 1024, image: 10 * 1024 * 1024 };

export async function creerFauxScript({ contenu = DEFAUT(), motDePasse = 'test' } = {}) {
  const etat = {
    version: contenu.version || 1, contenu, motDePasse, echecs: 0, medias: {}, fichiersMedias: [], corbeille: [], racineId: '',
    portfolio: { dossiers: [] }, galeries: {}, proteges: {}, liensDossiers: {}, fichiersDrive: {}, apercus: {}, envoyes: [], appels: { contenu: 0, portfolio: 0, frais: 0, enregistrer: 0 },
    reglages: { lent: 0, panne: false, html: false },
  };
  let n = 0;
  const jetonValide = (j) => typeof j === 'string' && /^jeton-\d+$/.test(j) && Number(j.slice(6)) > Date.now();

  /* comme Code.gs : un dossier protégé n'expose ni fichiers ni liens dans la liste publique */
  const publier = (d) => (etat.proteges[d.id] ? { id: d.id, nom: d.nom, protege: true, fichiers: [] } : { ...d, liens: etat.liensDossiers[d.id] || [] });
  /* dossiers modifiables : racine du portfolio (« racine »), ses sous-dossiers, racines et sous-dossiers des galeries */
  function dossierDe(id) {
    if (id === 'racine') return { racine: true, enfants: etat.portfolio.dossiers };
    const sous = etat.portfolio.dossiers.find((d) => d.id === id);
    if (sous) return { dossier: sous, parent: etat.portfolio.dossiers };
    for (const [gid, g] of Object.entries(etat.galeries)) {
      if (gid === id) return { racine: true, enfants: g.dossiers, galerie: g };
      const d = g.dossiers.find((x) => x.id === id);
      if (d) return { dossier: d, parent: g.dossiers };
    }
    return null;
  }
  function fichierDe(id) {
    const dossiers = [...etat.portfolio.dossiers, ...Object.values(etat.galeries).flatMap((g) => [...g.dossiers, { fichiers: g.fichiers || [] }])];
    for (const d of dossiers) { const i = (d.fichiers || []).findIndex((f) => f.id === id); if (i >= 0) return { liste: d.fichiers, i }; }
    return null;
  }

  function actionGet(q) {
    if (q.get('a') === 'contenu') { etat.appels.contenu++; return { version: etat.version, contenu: { ...etat.contenu, version: etat.version } }; }
    if (q.get('a') === 'portfolio') {
      etat.appels.portfolio++;
      if (q.get('frais') === '1' && jetonValide(q.get('jeton'))) etat.appels.frais++;
      return { racine: 'racine', dossiers: etat.portfolio.dossiers.map(publier) };
    }
    if (q.get('a') === 'galerie') {
      /* comme Code.gs : seulement un dossier déclaré par un onglet « drive » du contenu */
      const declare = ((etat.contenu.onglets || {}).perso || []).some((o) => o.type === 'drive' && o.dossierId === q.get('id'));
      const g = etat.galeries[q.get('id')];
      if (!declare || !g) return { erreur: 'entree' };
      if (etat.proteges[q.get('id')]) return { protege: true, dossiers: [], fichiers: [] };
      return { dossiers: g.dossiers.map(publier), fichiers: g.fichiers || [], liens: etat.liensDossiers[q.get('id')] || [] };
    }
    return { erreur: 'entree' };
  }

  function actionPost(d) {
    if (d.a === 'connexion') {
      if (etat.echecs >= 5) return { erreur: 'bloque' };
      if (d.motDePasse !== etat.motDePasse) { etat.echecs++; return { erreur: 'mot_de_passe' }; }
      etat.echecs = 0;
      const expire = Date.now() + 30 * 864e5;
      return { jeton: 'jeton-' + expire, expire };
    }
    if (!jetonValide(d.jeton)) return { erreur: 'jeton' };
    if (d.a === 'enregistrer') {
      etat.appels.enregistrer++;
      if (!d.contenu || typeof d.contenu !== 'object') return { erreur: 'entree' };
      if (Number(d.versionDeBase) !== etat.version) return { erreur: 'conflit', version: etat.version };
      etat.version += 1;
      const ancien = etat.contenu;
      etat.contenu = { ...d.contenu, version: etat.version, updatedAt: new Date().toISOString() };
      /* comme Code.gs : seuls le logo, la photo, le favicon ou le CV remplacés partent à la corbeille ;
         les images des cartes restent dans la médiathèque */
      const trouves = [];
      const parcourir = (v) => {
        if (Array.isArray(v)) { v.forEach(parcourir); return; }
        if (!v || typeof v !== 'object') return;
        Object.entries(v).forEach(([k, x]) => { if ((k === 'image' || k === 'media') && x && typeof x === 'object') trouves.push(x); else parcourir(x); });
      };
      [etat.contenu.parcours, etat.contenu.accueil, etat.contenu.liens].forEach(parcourir);
      const utilises = new Set([...Object.values(etat.contenu.medias || {}), ...trouves].filter((m) => m && m.id).map((m) => m.id));
      ['photo', 'logo', 'favicon', 'cv'].map((k) => ((ancien && ancien.medias) || {})[k]).filter((m) => m && m.id && !utilises.has(m.id) && !etat.corbeille.includes(m.id))
        .forEach((m) => etat.corbeille.push(m.id));
      return { version: etat.version };
    }
    if (d.a === 'envoyerMedia') {
      const cv = d.emplacement === 'cv';
      if (!['photo', 'logo', 'favicon', 'cv', 'image'].includes(d.emplacement)) return { erreur: 'entree' };
      if (cv ? d.type !== 'application/pdf' : !String(d.type).startsWith('image/')) return { erreur: 'entree' };
      const octets = Buffer.from(String(d.base64 || ''), 'base64');
      if (octets.length > (cv ? MAX.cv : MAX.image)) return { erreur: 'entree' };
      const id = 'media' + (++n);
      etat.medias[d.emplacement] = { id, nom: d.nom, type: d.type, octets };
      etat.fichiersMedias.push({ id, nom: d.nom, type: d.type, octets, date: Date.now() + n });
      etat.envoyes.push(id);
      return { id, url: cv ? `https://drive.google.com/uc?export=download&id=${id}` : `${base}/media/${id}` };
    }
    if (d.a === 'listerMedias') {
      return { medias: etat.fichiersMedias.filter((f) => !etat.corbeille.includes(f.id)).sort((a, b) => b.date - a.date)
        .map((f) => ({ id: f.id, nom: f.nom, type: f.type, taille: f.octets.length, date: f.date,
          url: f.type === 'application/pdf' ? `https://drive.google.com/uc?export=download&id=${f.id}` : `${base}/media/${f.id}` })) };
    }
    if (d.a === 'supprimerMedia') {
      if (!etat.fichiersMedias.some((f) => f.id === d.id)) return { erreur: 'entree' };
      /* comme Code.gs : chemins de toutes les clés « image » / « media » et des médias du site qui l'utilisent */
      const chemins = [];
      const parcourir = (v, ch) => {
        if (Array.isArray(v)) { v.forEach((x, i) => parcourir(x, `${ch}.${i}`)); return; }
        if (!v || typeof v !== 'object') return;
        Object.entries(v).forEach(([k, x]) => { if ((k === 'image' || k === 'media') && x && x.id === d.id) chemins.push(`${ch}.${k}`); else parcourir(x, `${ch}.${k}`); });
      };
      ['accueil', 'parcours', 'liens', 'pages'].forEach((k) => parcourir(etat.contenu[k], k));
      Object.entries(etat.contenu.medias || {}).forEach(([k, m]) => { if (m && m.id === d.id) chemins.push(`medias.${k}`); });
      if (chemins.length) return { erreur: 'utilise', emplacements: chemins };
      etat.corbeille.push(d.id);
      return {};
    }
    if (d.a === 'envoyerFichier') {
      const cible = dossierDe(d.dossierId);
      if (!cible || !d.type || typeof d.base64 !== 'string') return { erreur: 'entree' };
      const id = 'fichier' + (++n);
      etat.fichiersDrive[id] = { id, type: d.type, octets: Buffer.from(d.base64, 'base64') };
      const f = { id, nom: d.nom, type: d.type, apercu: `${base}/media/${id}`, lien: `https://drive.google.com/file/d/${id}/view` };
      if (cible.dossier) cible.dossier.fichiers.push(f); else if (cible.galerie) (cible.galerie.fichiers = cible.galerie.fichiers || []).push(f); else return { erreur: 'entree' };
      return f;
    }
    if (d.a === 'creerDossier') {
      const cible = dossierDe(d.parentId);
      if (!cible || !cible.racine || !String(d.nom || '').trim()) return { erreur: 'entree' };
      const dossier = { id: 'dossier' + (++n), nom: String(d.nom).trim(), fichiers: [] };
      cible.enfants.push(dossier);
      return { id: dossier.id, nom: dossier.nom };
    }
    if (d.a === 'renommerDossier' || d.a === 'supprimerDossier') {
      const cible = dossierDe(d.id);
      if (!cible || !cible.dossier) return { erreur: 'entree' };
      if (d.a === 'supprimerDossier') { cible.parent.splice(cible.parent.indexOf(cible.dossier), 1); return {}; }
      if (!String(d.nom || '').trim()) return { erreur: 'entree' };
      cible.dossier.nom = String(d.nom).trim();
      return { id: cible.dossier.id, nom: cible.dossier.nom };
    }
    if (d.a === 'supprimerFichier') {
      const f = fichierDe(d.id);
      if (!f) return { erreur: 'entree' };
      f.liste.splice(f.i, 1);
      return {};
    }
    if (d.a === 'protegerDossier') {
      if (!dossierDe(d.id)) return { erreur: 'entree' };
      if (!d.motDePasse) { delete etat.proteges[d.id]; return { protege: false }; }
      if (String(d.motDePasse).length < 4) return { erreur: 'entree' };
      etat.proteges[d.id] = d.motDePasse;
      return { protege: true };
    }
    if (d.a === 'liensDossier') {
      if (!dossierDe(d.id) || !Array.isArray(d.liens) || d.liens.some((l) => !/^https?:\/\//i.test(String(l && l.url)))) return { erreur: 'entree' };
      etat.liensDossiers[d.id] = d.liens.map((l) => ({ titre: String(l.titre || l.url), url: l.url }));
      return { liens: etat.liensDossiers[d.id] };
    }
    if (d.a === 'apercuLien') {
      if (!/^https?:\/\//.test(String(d.url))) return { erreur: 'entree' };
      if (etat.apercus[d.url] === 'panne') return { erreur: 'interne' };
      return etat.apercus[d.url] || { titre: '', description: '', image: '' };
    }
    if (d.a === 'dossierPortfolio') {
      if (!d.lienDossier) return { erreur: 'entree' };
      etat.racineId = 'racine';
      return { id: 'racine', sousDossiers: etat.portfolio.dossiers.map((x) => ({ id: x.id, nom: x.nom })) };
    }
    return { erreur: 'entree' };
  }

  const serveur = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const repondre = (obj) => {
      const fin = () => {
        if (etat.reglages.panne) { res.writeHead(500, { 'Access-Control-Allow-Origin': '*' }); res.end(); return; }
        if (etat.reglages.html) {
          res.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
          res.end('<!doctype html><html><body>Erreur Google</body></html>');
          return;
        }
        const r = obj.erreur ? { ok: false, ...obj } : { ok: true, ...obj };
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(r));
      };
      if (etat.reglages.lent) setTimeout(fin, etat.reglages.lent); else fin();
    };
    if (url.pathname.startsWith('/media/')) {
      const m = [...Object.values(etat.medias), ...etat.fichiersMedias, ...Object.values(etat.fichiersDrive)].find((x) => x.id === url.pathname.slice(7));
      res.writeHead(m ? 200 : 404, { 'Content-Type': m ? m.type : 'text/plain', 'Access-Control-Allow-Origin': '*' });
      res.end(m ? m.octets : '');
      return;
    }
    if (req.method === 'GET') { repondre(actionGet(url.searchParams)); return; }
    let corps = '';
    req.on('data', (x) => { corps += x; });
    req.on('end', () => {
      let d;
      try { d = JSON.parse(corps); } catch { repondre({ erreur: 'entree' }); return; }
      repondre(actionPost(d));
    });
  });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${serveur.address().port}`;
  return {
    url: base + '/exec',
    etat,
    regler(o) { Object.assign(etat.reglages, o); },
    fermer: () => new Promise((r) => serveur.close(r)),
  };
}
