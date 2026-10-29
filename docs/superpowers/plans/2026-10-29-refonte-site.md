# Refonte du site : plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remplacer le site d'une page par un site à 5 onglets et sous-onglets, alimenté par Google Drive via un script Apps Script, avec un espace admin `/admin/`.

**Architecture :**
- Le site reste statique sur Cloudflare Pages, en modules ES sans étape de build.
- Un unique script Apps Script (`apps-script/Code.gs`) lit et écrit `contenu.json`, les médias et le portfolio dans le Drive d'Amar.
- Le site lit ce script en `GET`, avec une copie dans `localStorage` et `content/default.json` en secours.
- L'admin écrit en `POST` `text/plain` avec un jeton signé.

**Tech Stack :**
- HTML, CSS, JavaScript en modules ES natifs, sans dépendance ni build.
- Google Apps Script (V8).
- Tests : Node 22 `node --test`, et Playwright, préinstallé et chargé par `createRequire(import.meta.url)('playwright')`.

**Spec :** `docs/superpowers/specs/2026-10-29-refonte-site-design.md`

## Global Constraints

- **Langue :** français uniquement dans le site et l'admin. Pas de bouton EN, ni d'attribut `data-en`.
- **Dates :** chaînes `AAAA-MM` ou `AAAA`, affichées « juin 2023 ». « En cours » s'affiche « 2025 – aujourd'hui ».
- **Jeton admin :** valable 30 jours. Après 5 échecs de connexion, blocage de 15 min.
- **Délais et caches :**
  - cache du portfolio dans le script : 5 min ;
  - délai maximum d'une lecture du script par le site : 8 s.
- **Médias :** photo et logo réduits à 2000 px de côté au plus ; favicon à 512 px ; CV PDF de moins de 10 Mo. Un nouveau média met l'ancien à la corbeille.
- **Écritures :** en `POST` avec un corps JSON envoyé en `Content-Type: text/plain;charset=utf-8`. Les lectures sont en `GET ?a=<action>`.
- **Sauvegarde :** elle remplace `contenu.json` en place. `version` augmente de 1 à chaque sauvegarde, et un `versionDeBase` périmé renvoie `{ erreur: "conflit", version }`.
- **Images Drive publiques :** `https://drive.google.com/thumbnail?id=<id>&sz=w<largeur>`.
- **Clés `localStorage` :** `ab-contenu`, `ab-jeton`, `ab-brouillon`, `ab-theme`.
- **Couleurs des onglets :** accueil `--c-blue`, parcours `--c-teal`, portfolio `--c-orange`, liens `--c-pink`, contact `--c-purple`.
- **Style :** aucune décoration superflue (pas de puce clignotante, de ronds colorés derrière les icônes, de compteurs animés ni de citation décorative). On garde les jetons Nuvio, le verre et la barre WebGL actuelle.
- **Hors périmètre :** ne pas modifier `magie/`, `kh/`, `katia/`, `L3/`, `google4fddc2260c80bbb0.html`.
- **Sécurité :** seuls les liens `http:` et `https:` sont rendus cliquables, et tout texte venant du contenu est inséré comme texte (jamais par `innerHTML` brut).

## Review Focus

1. **Contenu Drive incomplet ou d'une ancienne forme** (clé absente, nouveau sous-onglet ajouté plus tard, `null`) : le site s'affiche avec les valeurs par défaut au lieu de planter. Test : Task 1, `normaliser`.
2. **Champ contenant du HTML ou URL `javascript:`** : le texte est affiché tel quel et le lien n'est pas cliquable. Test : Task 1 `lienSur`, et Task 6 `echappe le HTML`.
3. **Ancien lien ou lien vers une partie masquée** (`#profil`, `#science`, `#biostudy`, `#parcours/xyz`, onglet masqué) : on arrive sur la partie équivalente ou la première visible, jamais sur une page vide. Test : Task 3 `parse`.
4. **Réponse du script qui n'est pas du JSON** (page HTML d'erreur Google, quota, redirection vers la connexion) : traitée comme une panne, avec la copie du navigateur ou `default.json`. Test : Task 4 `réponse HTML = panne`.
5. **Parties vides** (catégorie de liens sans lien visible, liste Parcours vide, pas de CV, dossier portfolio non choisi) : la partie est masquée ou affiche un message clair, jamais un cadre vide. Test : Task 6 `parties vides`.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `content/default.json` | Contenu initial, repris du site actuel (spec §4), et contenu de secours |
| `assets/config.js` | `export const SCRIPT_URL = ""`, la seule ligne à changer après l'installation |
| `assets/model.js` | Fonctions pures sur le contenu : normalisation, dates, visibilité, validation, échappement |
| `assets/router.js` | Lecture et écriture de l'adresse `#onglet/sous` |
| `assets/search.js` | Index et recherche |
| `assets/api.js` | Client du script, copie navigateur, jeton |
| `assets/nav.js` | Barre WebGL, reprise de `index.html` ; construction des boutons ; bouton Recherche |
| `assets/render.js` | Rendu des vues et de la rangée de sous-onglets |
| `assets/site.js` | Démarrage du site |
| `assets/site.css` | Styles du site (repris d'`index.html`, puis complétés) |
| `index.html` | Coquille |
| `admin/index.html`, `admin/admin.css` | Coquille et styles de l'admin |
| `admin/admin.js` | Connexion, navigation, brouillon, enregistrement, conflit |
| `admin/ecrans.js` | Formulaires de chaque écran |
| `admin/images.js` | Réduction des images avant envoi |
| `apps-script/Code.gs`, `apps-script/INSTALLATION.md` | Script Google et pas-à-pas |
| `tests/helpers.mjs` | Serveur statique de test, faux script, lancement de Chromium |
| `tests/mock-script.mjs` | Faux script (même API que `Code.gs`, état en mémoire) |
| `tests/*.test.mjs` | Tests |
| `package.json` | `{ "private": true, "type": "module", "scripts": { "test": "node --test tests/" } }`, sans dépendance |

---

### Task 1 : Modèle de contenu et contenu par défaut

**Files :**
- Create : `content/default.json`, `assets/model.js`, `package.json`
- Test : `tests/model.test.mjs`

**Interfaces :**
- Produces (`assets/model.js`, tout exporté) :
  - `ONGLETS = ['accueil','parcours','portfolio','liens','contact']`
  - `SOUS_PARCOURS = ['profil','formation','experience','engagement','competences','langues','certifications','interets']`
  - `normaliser(brut: any) -> Contenu` : fusion profonde avec un squelette complet (spec §4). Ne lève jamais d'erreur. Les listes absentes deviennent `[]`. Chaque élément de liste sans `visible` reçoit `visible: true`, et sans `id` un id généré.
  - `formaterDate(d: string|null) -> string`
  - `periode(item) -> string`
  - `trierParDate(items) -> items` : les éléments `enCours` d'abord, puis par `debut` décroissant ; renvoie une copie.
  - `formationActuelle(c) -> item|null`, `derniereExperience(c) -> item|null` : uniquement parmi les éléments visibles.
  - `ongletsVisibles(c) -> string[]`
  - `sousOnglets(c, onglet, dossiersPortfolio = []) -> [{ id, titre }]` :
    - parcours : sous-onglets visibles et non vides (le profil compte comme non vide s'il a un texte) ;
    - liens : catégories visibles ayant au moins un lien visible ;
    - portfolio : dossiers listés, sauf ceux masqués dans `c.portfolio.dossiers`, triés par nom brut, `titre` = nom affiché ;
    - accueil et contact : `[]`.
  - `nomAffiche(nom) -> string` : retire le préfixe `/^\d+\s*-\s*/`.
  - `lienSur(url) -> boolean`
  - `valider(c) -> [{ chemin, message }]`
  - `nouvelId(prefixe) -> string`

- [ ] **Step 1 : Écrire les tests**

```js
test('formaterDate', () => {
  assert.equal(formaterDate('2023-06'), 'juin 2023');
  assert.equal(formaterDate('2023'), '2023');
  assert.equal(formaterDate(null), '');
});
test('periode', () => {
  assert.equal(periode({ debut: '2025', enCours: true }), "2025 – aujourd'hui");
  assert.equal(periode({ debut: '2023-06', fin: '2023-08' }), 'juin 2023 – août 2023');
});
test('normaliser tolère null et les clés manquantes', () => {
  const c = normaliser(null);
  assert.deepEqual(c.parcours.formation, []);
  assert.equal(c.onglets.parcours.sous.interets.visible, true);
  const d = normaliser({ parcours: { langues: [{ langue: 'Kabyle' }] } });
  assert.equal(d.parcours.langues[0].visible, true);
  assert.ok(d.parcours.langues[0].id);
});
test('formationActuelle ignore les éléments masqués', () => { /* enCours masqué → renvoie le plus récent visible */ });
test('sousOnglets liens masque les catégories vides', () => { /* catégorie sans lien visible absente */ });
test('sousOnglets portfolio trie et retire le préfixe', () => {
  const r = sousOnglets(normaliser({}), 'portfolio', [{ id: 'b', nom: '2 - Posters' }, { id: 'a', nom: '1 - Design' }]);
  assert.deepEqual(r, [{ id: 'a', titre: 'Design' }, { id: 'b', titre: 'Posters' }]);
});
test('lienSur', () => {
  assert.equal(lienSur('https://x.fr'), true);
  assert.equal(lienSur('javascript:alert(1)'), false);
  assert.equal(lienSur('x'), false);
});
test('valider', () => {
  /* titre vide → { chemin: 'parcours.formation.0.titre' } ; fin avant début → message ; URL de lien invalide → message */
});
test('default.json est déjà normalisé', () => {
  const brut = JSON.parse(readFileSync('content/default.json', 'utf8'));
  assert.deepEqual(normaliser(brut), brut);
  assert.equal(valider(brut).length, 0);
});
```

- [ ] **Step 2 :** lancer `node --test tests/model.test.mjs`. Attendu : FAIL (module introuvable).

- [ ] **Step 3 : écrire `assets/model.js`.** Noms des mois : janvier … décembre, en minuscules.

- [ ] **Step 4 : écrire `content/default.json`** à partir d'`index.html` (version actuelle sur `main`), selon la table « Où va le contenu actuel » de la spec §4 :
  - `version: 1` ;
  - accueil : `positionnement` = phrase « La microbiologie au service… », `situation` = « Master 1 · UCBL Lyon 1 », `competencesCles` = `["Culture", "PCR", "ELISA"]` ;
  - les 8 outils de BioStudy et BioStudy lui-même vont dans `liens.items`, catégorie `projets` ;
  - `medias` : `photo`, `logo` et `favicon` pointent vers `/favicon-512x512.png` (sans `id`), et `cv` est `null`.

- [ ] **Step 5 :** relancer les tests. Attendu : PASS.

- [ ] **Step 6 : commit** `feat: content model and default content`.

---

### Task 2 : Script Google (`Code.gs`) et installation

**Files :**
- Create : `apps-script/Code.gs`, `apps-script/INSTALLATION.md`
- Test : `tests/apps-script.test.mjs`, qui charge `Code.gs` dans `node:vm` avec de faux `Utilities`, `PropertiesService`, `CacheService`, `LockService`, `DriveApp`, `ContentService`, `UrlFetchApp` (en mémoire, HMAC et SHA-256 via `node:crypto`).

**Interfaces :**
- Produces : l'API HTTP de la spec §5.
  - Réponse JSON `{ ok: true, ...donnees }` ou `{ ok: false, erreur }`.
  - Codes `erreur` : `mot_de_passe`, `bloque`, `jeton`, `conflit`, `entree`, `interne`.
  - Fonctions globales testées : `doGet(e)`, `doPost(e)`, `installer()`, `signerJeton(expireMs)`, `verifierJeton(jeton)`, `hacher(mdp, sel)`, `lireMeta(html, urlBase)`.
  - Propriétés du script : `MDP_HASH`, `MDP_SEL`, `CLE`, `ID_CONTENU`, `ID_MEDIAS`, `ID_PORTFOLIO`, `MEDIA_<emplacement>`.
  - Cache : `echecs` (compteur, 15 min), `portfolio` (5 min). `GET ?a=portfolio&frais=1&jeton=<jeton>` ignore le cache si le jeton est valide (sinon le paramètre est ignoré).

- [ ] **Step 1 : écrire les tests**
  - `contenu renvoie version et contenu` ;
  - `connexion : bon mot de passe → jeton qui vérifie` ;
  - `connexion : 5 échecs → bloque, même avec le bon mot de passe` ;
  - `enregistrer : jeton faux → erreur jeton` ;
  - `enregistrer : versionDeBase périmée → conflit, fichier inchangé` ;
  - `enregistrer : version + 1, contenu réécrit en place (même id de fichier)` ;
  - `envoyerMedia : l'ancien fichier part à la corbeille, nouveau partagé en lecture publique` ;
  - `envoyerMedia : CV de plus de 10 Mo → entree` ;
  - `apercuLien : lit og:title, og:description, og:image (URL relative résolue), repli sur <title>` ;
  - `dossierPortfolio : partage le dossier et renvoie les sous-dossiers` ;
  - `portfolio : liste fichiers avec apercu = URL thumbnail, servie depuis le cache au second appel` ;
  - `portfolio frais=1 avec jeton valide → relit Drive ; sans jeton → cache` ;
  - `jeton expiré → jeton`.

- [ ] **Step 2 :** lancer `node --test tests/apps-script.test.mjs`. Attendu : FAIL.

- [ ] **Step 3 : écrire `Code.gs`.**
  - En haut : `const MOT_DE_PASSE_INITIAL = '';` et `const URL_CONTENU_DEFAUT = 'https://amarbcrb.pages.dev/content/default.json';`.
  - `installer()` refuse de tourner si `MOT_DE_PASSE_INITIAL` est vide. Sinon, il crée le dossier « Site amarbcrb » contenant « Médias », « Portfolio » et `contenu.json` (récupéré depuis `URL_CONTENU_DEFAUT`), tire `CLE` et `MDP_SEL` au hasard (`Utilities.getUuid()`), puis enregistre `MDP_HASH`.
  - Chaque écriture est entourée de `LockService.getScriptLock().waitLock(10000)`.

- [ ] **Step 4 :** relancer les tests. Attendu : PASS.

- [ ] **Step 5 : écrire `INSTALLATION.md`.** Suivre les étapes de la spec §10, avec des captures décrites en texte, puis la liste de contrôle : lecture, connexion, sauvegarde, média, aperçu de lien, portfolio, image visible avec l'URL thumbnail (et le repli `lh3.googleusercontent.com/d/<id>` si elle ne s'affiche pas).

- [ ] **Step 6 : commit** `feat: Apps Script backend`.

---

### Task 3 : Routeur et recherche (modules purs)

**Files :**
- Create : `assets/router.js`, `assets/search.js`
- Test : `tests/router.test.mjs`, `tests/search.test.mjs`

**Interfaces :**
- Consumes : `ongletsVisibles`, `sousOnglets` (Task 1).
- Produces :
  - `parse(hash: string, c, dossiersPortfolio = []) -> { onglet, sous|null }`
  - `format({ onglet, sous }) -> string` : `'#parcours/langues'`, `'#accueil'`.
  - `ALIAS = { profil: 'accueil', top: 'accueil', apropos: 'parcours/profil', science: 'parcours/competences', methode: 'accueil', biostudy: 'liens/projets', beyond: 'parcours/interets' }`
  - `normaliserTexte(s) -> string` : minuscules, sans accents (`NFD` puis suppression des diacritiques).
  - `construireIndex(c, dossiersPortfolio) -> [{ type, titre, extrait, cible: { onglet, sous }, texte }]`, avec `type` parmi : Formation, Expérience, Engagement, Compétence, Langue, Certification, Intérêt, Lien, Portfolio, Contact.
  - `chercher(index, requete, max = 20) -> Entree[]` : chaque mot doit apparaître ; les correspondances dans le titre passent en premier ; une requête vide renvoie `[]`.

- [ ] **Step 1 : écrire les tests**

```js
test('parse : onglet et sous-onglet valides', () => assert.deepEqual(parse('#parcours/langues', c), { onglet: 'parcours', sous: 'langues' }));
test('parse : alias anciens liens', () => assert.deepEqual(parse('#science', c), { onglet: 'parcours', sous: 'competences' }));
test('parse : sous-onglet inconnu → premier visible', () => assert.deepEqual(parse('#parcours/xyz', c), { onglet: 'parcours', sous: 'profil' }));
test('parse : onglet masqué → premier onglet visible', () => { /* onglets.liens.visible=false ; '#liens' → { onglet:'accueil', sous:null } */ });
test('parse : vide → accueil', () => assert.deepEqual(parse('', c), { onglet: 'accueil', sous: null }));
test('chercher ignore accents et casse', () => assert.equal(chercher(idx, 'BIOLOGIE moleculaire')[0].titre, 'Biologie moléculaire'));
test('chercher : plusieurs mots tous requis', () => assert.equal(chercher(idx, 'stage chu').length, 1));
test('chercher : éléments masqués absents', () => { /* visible:false → absent de l'index */ });
test('chercher : fichier du portfolio → cible portfolio/<idDossier>', () => {});
```

- [ ] **Step 2 :** lancer `node --test tests/router.test.mjs tests/search.test.mjs`. Attendu : FAIL.
- [ ] **Step 3 :** écrire les deux modules.
- [ ] **Step 4 :** relancer les tests. Attendu : PASS.
- [ ] **Step 5 : commit** `feat: router and search`.

---

### Task 4 : Client du script, faux script et serveurs de test

**Files :**
- Create : `assets/config.js`, `assets/api.js`, `tests/mock-script.mjs`, `tests/helpers.mjs`
- Test : `tests/api.test.mjs`

**Interfaces :**
- Consumes : `normaliser` (Task 1).
- Produces :
  - `api.js` :
    - `chargerContenu(onMaj?: (c) => void) -> Promise<{ contenu, source: 'cache'|'script'|'secours' }>` :
      - s'il y a une copie `ab-contenu`, il la renvoie tout de suite et interroge le script en arrière-plan ; il appelle `onMaj` si la version a changé ;
      - sinon il attend le script (8 s), puis se replie sur `/content/default.json` ;
      - le contenu renvoyé est toujours passé par `normaliser`.
    - `lirePortfolio({ frais = false } = {}) -> Promise<Dossier[]|null>` (`null` en cas de panne ; `frais` envoie `frais=1` et le jeton).
    - `lireContenuFrais() -> Promise<{ version, contenu }>` : lit le script sans copie navigateur ni secours, et lève `ErreurApi` en cas d'échec. C'est ce qu'utilise l'admin.
    - `appeler(action, donnees) -> Promise<object>` : POST `text/plain`. En cas d'échec, lève `ErreurApi` (`{ code, message }`), avec `code` parmi les codes du script ou `reseau`.
    - `lireJeton() -> string|null` (renvoie `null` si le jeton a expiré), `ecrireJeton(jeton, expire)`, `effacerJeton()`.
  - `tests/mock-script.mjs` : `creerFauxScript({ contenu, motDePasse = 'test' }) -> { url, etat, regler({ lent?, panne?, html? }), fermer() }`. Serveur HTTP local ; mêmes actions et codes que `Code.gs` ; en-tête `Access-Control-Allow-Origin: *`.
  - `tests/helpers.mjs` :
    - `demarrer({ contenu? }) -> { site, faux, navigateur, page(opts?), fermer() }` ;
    - le serveur statique sert la racine du dépôt, mais répond à `/assets/config.js` avec `export const SCRIPT_URL = "<url du faux>"`.

- [ ] **Step 1 : écrire les tests** (dans Node : `fetch` natif et un faux `localStorage` en mémoire)
  - `sans copie : attend le script, source script` ;
  - `copie présente : renvoie la copie puis onMaj avec la nouvelle version` ;
  - `script en panne : source secours (default.json)` ;
  - `réponse HTML = panne` ;
  - `script trop lent (> 8 s, simulé) : secours` ;
  - `appeler connexion faux mot de passe → ErreurApi code mot_de_passe` ;
  - `lireJeton expiré → null`.
- [ ] **Step 2 :** lancer `node --test tests/api.test.mjs`. Attendu : FAIL.
- [ ] **Step 3 :** écrire les quatre fichiers. Le délai de 8 s est passé en option interne (`{ delai }`) pour que les tests le réduisent.
- [ ] **Step 4 :** relancer les tests. Attendu : PASS.
- [ ] **Step 5 : commit** `feat: script client and test harness`.

---

### Task 5 : Coquille du site, barre et démarrage

**Files :**
- Create : `assets/site.css`, `assets/nav.js`, `assets/site.js`, `assets/render.js` (dans cette tâche, seule la vue de secours `rendreVue` affiche le titre de l'onglet)
- Modify : `index.html` (réécrit en coquille)
- Delete : `liquid-glass.js`
- Test : `tests/site.test.mjs`

**Interfaces :**
- Consumes : `chargerContenu`, `lireJeton` (Task 4) ; `parse`, `format` (Task 3) ; `ongletsVisibles` (Task 1).
- Produces :
  - `nav.js` :
    - `monterBarre({ conteneur, onglets: string[], onSelect: (id) => void, onRecherche: () => void }) -> { select(id, anim = true), detruire() }`. Il construit les boutons à partir d'une table `ICONES` / `LIBELLES` / `COULEURS` interne (Accueil, Parcours, Portfolio, Liens, Contact, avec les couleurs des Global Constraints), et le bouton rond `.nav-search` à droite.
    - `jellyNav(...)`, repris tel quel d'`index.html`. `buzz` et `RM` sont fournis par `nav.js`.
  - `render.js` : `rendreVue(racine: HTMLElement, c, { onglet, sous }, dossiersPortfolio) -> void`.
  - `index.html` contient `#vue`, `#navHote`, `#maintenance`, `#chargement`, `#bandeauAdmin`, l'en-tête (logo, nom, surtitre, bouton thème) et le filtre SVG `#navLens`.

- [ ] **Step 1 : écrire les tests** (Playwright avec `demarrer()`)
  - `affiche 5 onglets et le bouton recherche` ;
  - `onglet masqué → 4 boutons, barre redimensionnée` (largeur des cibles = largeur de la barre / 4) ;
  - `cliquer Parcours → adresse #parcours/profil` ;
  - `retour arrière navigateur revient à l'onglet précédent` ;
  - `maintenance sans jeton → seul #maintenance visible avec le message` ;
  - `maintenance avec jeton valide → site visible + bandeau` ;
  - `première visite, script lent → #chargement visible puis contenu` ;
  - `pas de bouton EN, en-tête sans grand titre` (aucun `h1` de plus de 40 px de police calculée) ;
  - `favicon et logo pris dans medias` ;
  - `aucune erreur console`.
- [ ] **Step 2 :** lancer `node --test tests/site.test.mjs`. Attendu : FAIL.
- [ ] **Step 3 :** déplacer les styles d'`index.html` dans `site.css`, en supprimant les règles des éléments disparus (hero, `.wm`, `.tl8`, `.who4`, styles EN). Déplacer `jellyNav` dans `nav.js`.
- [ ] **Step 4 :** écrire `site.js` dans cet ordre :
  1. thème ;
  2. `chargerContenu` ;
  3. maintenance (jeton) ;
  4. médias dans l'en-tête et le favicon ;
  5. `monterBarre` avec `ongletsVisibles` ;
  6. `hashchange` → `parse` → `rendreVue` avec l'animation de glissement actuelle ;
  7. `onMaj` → nouveau rendu de la vue courante et nouveau montage de la barre si les onglets visibles ont changé.
- [ ] **Step 5 :** relancer les tests. Attendu : PASS.
- [ ] **Step 6 : commit** `feat: site shell, tab bar module and boot`.

---

### Task 6 : Vues et sous-onglets

**Files :**
- Modify : `assets/render.js`, `assets/site.css`
- Test : `tests/vues.test.mjs`

**Interfaces :**
- Consumes : toutes les fonctions de Task 1 ; `format` (Task 3) pour les liens internes.
- Produces : la rangée `.sous-onglets` (boutons `role="tab"`, `aria-selected`). La pastille active est teintée de la couleur de l'onglet, et la rangée défile à l'horizontale.

- [ ] **Step 1 : écrire les tests**
  - `accueil : positionnement, 3 blocs, liens vers formation/experience/competences` ;
  - `accueil : bouton CV absent si medias.cv null` ;
  - `parcours/formation : frise triée, période "2025 – aujourd'hui"` ;
  - `parcours : un seul sous-onglet affiché à la fois` ;
  - `liens : une carte par lien visible, plus récents d'abord, target=_blank rel=noopener` ;
  - `contact : bouton Copier copie l'e-mail` ;
  - `echappe le HTML` (un titre `<img src=x onerror=alert(1)>` est affiché comme texte, aucun `img` créé) ;
  - `parties vides` :
    - catégorie de liens vide absente ;
    - Parcours avec Engagement vide sans sous-onglet Engagement ;
    - Liens sans aucun lien affiche « Aucun lien pour le moment ».
- [ ] **Step 2 :** lancer `node --test tests/vues.test.mjs`. Attendu : FAIL.
- [ ] **Step 3 :** écrire les vues, avec un petit utilitaire `el(tag, attrs, ...enfants)` qui n'utilise que `textContent` et `setAttribute`, et `href` seulement si `lienSur(url)`.
- [ ] **Step 4 :** relancer les tests. Attendu : PASS.
- [ ] **Step 5 : commit** `feat: views and sub-tabs`.

---

### Task 7 : Portfolio depuis Drive et visionneuse

**Files :**
- Modify : `assets/render.js`, `assets/site.js`, `assets/site.css`
- Test : `tests/portfolio.test.mjs`

**Interfaces :**
- Consumes : `lirePortfolio` (Task 4), `sousOnglets(c, 'portfolio', dossiers)` (Task 1).
- Produces :
  - `site.js` appelle `lirePortfolio()` une fois, quand l'onglet Portfolio ou la recherche s'ouvre pour la première fois, puis garde le résultat.
  - `rendreVue` reçoit ces dossiers.

- [ ] **Step 1 : écrire les tests**
  - `un sous-onglet par dossier visible, préfixe retiré, ordre par préfixe` ;
  - `grille d'aperçus avec URL thumbnail` ;
  - `image → visionneuse, flèches, Échap ferme` ;
  - `PDF → lien vers la page Drive, nouvel onglet` ;
  - `dossier masqué dans contenu.portfolio.dossiers absent` ;
  - `script portfolio en panne → "Portfolio momentanément indisponible"` ;
  - `aucun dossier racine → message "Portfolio bientôt disponible"`.
- [ ] **Step 2 :** lancer les tests. Attendu : FAIL.
- [ ] **Step 3 :** implémenter en reprenant la visionneuse `#lb` d'`index.html`.
- [ ] **Step 4 :** relancer les tests. Attendu : PASS.
- [ ] **Step 5 : commit** `feat: Drive portfolio`.

---

### Task 8 : Panneau de recherche

**Files :**
- Modify : `assets/site.js`, `assets/site.css`, `index.html` (ajout de `#recherche`)
- Test : `tests/recherche.test.mjs`

**Interfaces :**
- Consumes : `construireIndex`, `chercher` (Task 3) ; le bouton `.nav-search` et `onRecherche` (Task 5) ; les dossiers du portfolio (Task 7).

- [ ] **Step 1 : écrire les tests**
  - `bouton recherche ouvre le panneau, focus dans le champ` ;
  - `taper "elisa" → résultat Compétence, clic → #parcours/competences, panneau fermé` ;
  - `taper un nom de fichier du portfolio → ouvre portfolio/<dossier>` ;
  - `Échap ferme, focus rendu au bouton` ;
  - `aucun résultat → "Aucun résultat pour « … »"`.
- [ ] **Step 2 :** lancer les tests. Attendu : FAIL.
- [ ] **Step 3 :** implémenter le panneau en verre (`role="dialog"`, `aria-modal`), avec les résultats en `<ul>`. L'index est reconstruit à chaque `onMaj` et à l'arrivée du portfolio.
- [ ] **Step 4 :** relancer les tests. Attendu : PASS.
- [ ] **Step 5 : commit** `feat: search panel`.

---

### Task 9 : Admin, socle (connexion, navigation, brouillon, enregistrement, visibilité, accueil, contact)

**Files :**
- Create : `admin/index.html` (`<meta name="robots" content="noindex, nofollow">`), `admin/admin.css`, `admin/admin.js`, `admin/ecrans.js`
- Test : `tests/admin.test.mjs`

**Interfaces :**
- Consumes : `appeler`, `lireJeton`, `ecrireJeton`, `effacerJeton`, `lireContenuFrais` (Task 4) ; `normaliser`, `valider`, `SOUS_PARCOURS`, `ONGLETS` (Task 1).
- Produces :
  - `admin.js` : un état `{ contenu, versionDeBase, sale: boolean }` et la fonction `modifier(chemin: string, valeur)`, qui met à jour l'état, marque `sale` et écrit `ab-brouillon`.
  - `ecrans.js` :
    - `ECRANS = [{ id, titre, rendre(racine, etat, modifier) }]`, avec les ids `accueil`, `parcours`, `liens`, `portfolio`, `medias`, `contact`, `visibilite` ;
    - dans cette tâche, seuls `accueil`, `contact` et `visibilite` sont complets ; les autres affichent « Bientôt ».
  - Champs génériques : `champTexte(chemin, libelle, { multiligne })`, `interrupteur(chemin, libelle)`, `listePuces(chemin, libelle)`. Chaque champ montre l'erreur de `valider` qui correspond à son chemin.

- [ ] **Step 1 : écrire les tests**
  - `mauvais mot de passe → message` ;
  - `5 échecs → message de blocage 15 min` ;
  - `connexion → jeton stocké, écran Accueil` ;
  - `modifier positionnement puis Enregistrer → faux script version 2, site public affiche la nouvelle phrase` ;
  - `point "non enregistré" visible après modification, absent après enregistrement` ;
  - `conflit (version modifiée dans le faux script) → choix Recharger / Écraser, les deux fonctionnent` ;
  - `réseau coupé à l'enregistrement → message, brouillon gardé ; rechargement → brouillon proposé` ;
  - `jeton expiré → retour connexion, brouillon gardé` ;
  - `interrupteur maintenance + message → site public en maintenance` ;
  - `masquer l'onglet Liens → absent de la barre publique` ;
  - `champ invalide → Enregistrer désactivé, erreur affichée`.
- [ ] **Step 2 :** lancer `node --test tests/admin.test.mjs`. Attendu : FAIL.
- [ ] **Step 3 :** implémenter. La mise en page de l'admin utilise les jetons de `site.css` (importé), avec une liste d'écrans à gauche à partir de 900 px et des onglets en haut en dessous.
- [ ] **Step 4 :** relancer les tests. Attendu : PASS.
- [ ] **Step 5 : commit** `feat: admin core`.

---

### Task 10 : Admin, écran Parcours (éditeur de listes)

**Files :**
- Modify : `admin/ecrans.js`, `admin/admin.css`
- Test : `tests/admin-parcours.test.mjs`

**Interfaces :**
- Consumes : `modifier`, les champs génériques (Task 9) ; `nouvelId`, `periode` (Task 1).
- Produces : `editeurListe(chemin, { libelleElement, champs: [{ cle, libelle, type: 'texte'|'multiligne'|'date'|'puces' }], resume: (item) => string })`.
  - Chaque ligne affiche le résumé, un interrupteur Visible, un bouton Modifier (panneau), un bouton Supprimer (avec confirmation), et les flèches ↑ ↓ ainsi qu'une poignée de glisser-déposer.
  - Le type `date` est un champ `AAAA-MM` avec une case « en cours » qui vide et désactive la date de fin.

- [ ] **Step 1 : écrire les tests**
  - `ajouter une expérience avec dates → visible sur le site dans Parcours › Expérience` ;
  - `en cours coché → fin vide, période "… – aujourd'hui"` ;
  - `fin avant début → erreur, Enregistrer désactivé` ;
  - `réordonner avec ↑ → ordre enregistré` ;
  - `supprimer demande confirmation` ;
  - `masquer un élément → absent du site et de la recherche` ;
  - `profil : titre et texte modifiables` ;
  - `interrupteur de sous-onglet (ex. Intérêts) → absent du site`.
- [ ] **Step 2 :** lancer les tests. Attendu : FAIL.
- [ ] **Step 3 :** implémenter les 8 blocs de Parcours avec `editeurListe` :
  - Formation, Expérience, Engagement : `titre`, `lieu`, `debut`, `fin`, `enCours`, `description` ;
  - Compétences : `domaine`, `resume`, `techniques` (puces) ;
  - Langues : `langue`, `niveau` ;
  - Certifications : `titre`, `organisme`, `annee` ;
  - Intérêts : `titre`, `texte`.
- [ ] **Step 4 :** relancer les tests. Attendu : PASS.
- [ ] **Step 5 : commit** `feat: admin Parcours editor`.

---

### Task 11 : Admin, écrans Liens, Portfolio et Médias

**Files :**
- Create : `admin/images.js`
- Modify : `admin/ecrans.js`, `admin/admin.css`
- Test : `tests/admin-medias.test.mjs`

**Interfaces :**
- Consumes : `appeler('apercuLien' | 'dossierPortfolio' | 'envoyerMedia')` (Task 4) ; `editeurListe` (Task 10).
- Produces : `reduireImage(fichier: File, maxCote: number, type = 'image/jpeg') -> Promise<{ base64, type, largeur, hauteur }>`. Le favicon est réduit en PNG.

- [ ] **Step 1 : écrire les tests**
  - `coller une URL → titre/description/image préremplis, modifiables, Ajouter → carte sur le site` ;
  - `apercuLien en échec → champs vides à remplir, ajout possible` ;
  - `catégorie : ajouter, renommer ; supprimer refusé si non vide` ;
  - `coller le lien du dossier Drive → sous-dossiers listés ; masquer l'un → absent du site` ;
  - `Relire Drive → lirePortfolio({ frais: true })`, le faux script reçoit `frais=1` ;
  - `photo 4000×3000 → envoyée en 2000×1500, aperçu mis à jour, logo du site public mis à jour` ;
  - `favicon → PNG 512 px` ;
  - `CV de 11 Mo → refusé avant envoi` ;
  - `CV accepté → bouton Télécharger mon CV sur l'accueil`.
- [ ] **Step 2 :** lancer les tests. Attendu : FAIL.
- [ ] **Step 3 :** implémenter. Un média envoyé met à jour `contenu.medias.<emplacement>` par `modifier` (l'admin enregistre ensuite comme pour le reste). `dossierPortfolio` remplit `contenu.portfolio.dossierRacineId` et initialise `contenu.portfolio.dossiers`.
- [ ] **Step 4 :** relancer les tests. Attendu : PASS.
- [ ] **Step 5 : commit** `feat: admin links, portfolio and media`.

---

### Task 12 : Finitions, vérification d'ensemble et publication

**Files :**
- Modify : `sitemap.xml` (seulement `/`), `robots.txt` (ajouter `Disallow: /admin/`)
- Test : la suite complète

- [ ] **Step 1 :** lancer `npm test`. Attendu : tous les tests PASS.
- [ ] **Step 2 :** captures Playwright à 320, 390 et 1366 px, en thème sombre et clair, pour chaque onglet, la recherche, la maintenance et l'admin. Vérifier :
  - aucun débordement horizontal (`document.documentElement.scrollWidth <= innerWidth`) ;
  - la barre et le bouton Recherche alignés et de même hauteur.
- [ ] **Step 3 :** vérifier que `magie/`, `kh/`, `katia/` et `L3/` n'ont pas changé (`git diff --stat origin/main -- magie kh katia L3` vide).
- [ ] **Step 4 : commit** `chore: robots and sitemap for the new site`.
- [ ] **Step 5 : installation avec Amar (manuel).**
  1. Publier sur `main` d'abord le contenu par défaut, pour que `installer()` puisse lire `URL_CONTENU_DEFAUT`. Le site publié fonctionne en secours tant que `SCRIPT_URL` est vide.
  2. Amar suit `INSTALLATION.md` et donne l'URL du script.
  3. Écrire l'URL dans `assets/config.js`, publier, et dérouler la liste de contrôle d'`INSTALLATION.md` avec Amar.
