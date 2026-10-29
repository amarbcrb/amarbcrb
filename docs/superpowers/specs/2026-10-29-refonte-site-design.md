# Refonte du site amarbcrb.pages.dev : conception

Date : 2026-10-29
Statut : validé à l'oral (3 parties), en relecture écrite

## 1. Objectif

Refaire le site personnel d'Amar Bouchareb pour qu'il soit :

- plus professionnel : plus de nom en très gros à l'accueil ;
- découpé en écrans séparés : un onglet ou un sous-onglet affiche une seule partie, sans défilement infini ;
- modifiable sans toucher au code, depuis un espace admin protégé par mot de passe ;
- alimenté par Google Drive pour le portfolio, les médias et le contenu.

Critères de réussite :

1. Amar modifie un texte, une expérience, une date ou un lien dans l'admin, enregistre, et le voit sur le site public au rechargement.
2. Amar dépose des fichiers dans un sous-dossier Drive « Portfolio » et ils apparaissent dans l'onglet Portfolio sans autre action.
3. Amar active la maintenance : les visiteurs voient la page de maintenance, lui voit le site avec un bandeau.
4. Chaque partie a sa propre adresse (`/#parcours/langues`) et s'affiche seule.

## 2. Décisions prises

| Sujet | Décision |
|---|---|
| Stockage | Google Drive uniquement, via un script Google Apps Script installé sur le compte d'Amar |
| Lecture par le site | Directement auprès du script, avec copie dans le navigateur (pas de relais Cloudflare) |
| Sauvegarde | Le nouveau contenu remplace l'ancien ; un nouveau média supprime l'ancien |
| Onglets | 5 onglets + sous-onglets en haut de l'onglet |
| Accueil | Phrase de positionnement + 3 blocs (Formation actuelle, Dernière expérience, Compétences clés) + CV et Contact |
| Langue | Français seulement ; le bouton EN disparaît |
| Liens | On colle une URL, le script récupère titre, description et image |
| Hébergement | Inchangé : site statique sur Cloudflare Pages, déployé depuis GitHub |

Hors périmètre : les pages `/magie/`, `/kh/`, `/katia/`, `/L3/` ne changent pas. Pas de comptes multiples : un seul administrateur.

## 3. Architecture

```
Navigateur (site public)  ──GET──▶  Apps Script (web app)  ──▶  Google Drive
Navigateur (/admin/)      ──POST─▶        │                     ├─ contenu.json
                                          │                     ├─ Médias/ (photo, logo, favicon, CV)
                                          └─ Propriétés secrètes└─ Portfolio/<sous-dossiers>
                                             (mot de passe, clé de signature, ID des dossiers)
```

- **Apps Script** : un seul fichier `Code.gs`, déployé en « Application Web », exécuté en tant qu'Amar, accessible à « Tout le monde ». C'est la seule partie serveur.
- **Site public** : fichiers statiques sur Cloudflare Pages.
- **Contenu par défaut** : `content/default.json` dans le dépôt, rempli avec le contenu actuel du site. Il sert de premier contenu à l'installation et de secours si le script ne répond pas.

### 3.1 Fichiers du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | Coquille de la page : en-tête, zone des vues, barre, panneau de recherche, maintenance |
| `assets/site.css` | Styles : jetons Nuvio, verre, vues, sous-onglets, cartes, recherche, maintenance |
| `assets/nav.js` | Barre d'onglets WebGL actuelle (ressorts, lentille goutte d'eau, couleurs par onglet), sortie de `index.html` sans changement de comportement, plus le bouton Recherche |
| `assets/api.js` | Client du script : lecture du contenu et du portfolio, copie navigateur, délai d'attente, secours |
| `assets/render.js` | Construit chaque vue et sous-vue à partir du contenu |
| `assets/router.js` | Adresses `#onglet/sous-onglet`, historique, onglets masqués |
| `assets/search.js` | Index et recherche plein texte côté navigateur |
| `assets/site.js` | Démarrage : thème, chargement, maintenance, branchement des modules |
| `admin/index.html`, `admin/admin.css`, `admin/admin.js` | Espace admin |
| `apps-script/Code.gs` | Le script Google à coller dans Apps Script |
| `apps-script/INSTALLATION.md` | Pas-à-pas d'installation en français |
| `content/default.json` | Contenu initial et de secours |
| `tests/` | Tests Playwright avec un faux script |

`liquid-glass.js` (plus utilisé) est supprimé. Les dossiers `Design/`, `Poster/`, `Diaporama/` et `portfolio.json` restent tant que les fichiers ne sont pas dans Drive ; leur suppression sera proposée ensuite.

## 4. Modèle de contenu (`contenu.json`)

Dates au format `AAAA-MM` (ou `AAAA`), affichées « juin 2023 ». Chaque élément de liste a un `id` stable et un champ `visible`.

```json
{
  "version": 12,
  "updatedAt": "2026-10-29T10:00:00Z",
  "site": {
    "nom": "Amar Bouchareb",
    "surtitre": "Microbiologie · Lyon 1",
    "maintenance": { "active": false, "message": "Le site revient très vite." }
  },
  "medias": {
    "photo":   { "id": "…", "url": "…" },
    "logo":    { "id": "…", "url": "…" },
    "favicon": { "id": "…", "url": "…" },
    "cv":      { "id": "…", "url": "…", "nom": "CV-Amar-Bouchareb.pdf" }
  },
  "onglets": {
    "accueil":   { "visible": true },
    "parcours":  { "visible": true, "sous": {
      "profil": { "visible": true, "titre": "Profil" },
      "formation": { "visible": true, "titre": "Formation" },
      "experience": { "visible": true, "titre": "Expérience" },
      "engagement": { "visible": true, "titre": "Engagement" },
      "competences": { "visible": true, "titre": "Compétences" },
      "langues": { "visible": true, "titre": "Langues" },
      "certifications": { "visible": true, "titre": "Certifications" },
      "interets": { "visible": true, "titre": "Intérêts" } } },
    "portfolio": { "visible": true },
    "liens":     { "visible": true },
    "contact":   { "visible": true }
  },
  "accueil": {
    "positionnement": "Microbiologiste en formation, sécurité des aliments et contrôle qualité.",
    "situation": "Master 1 · Recherche un stage de M2",
    "competencesCles": ["Culture", "PCR", "ELISA"]
  },
  "parcours": {
    "profil": { "titre": "…", "texte": "…" },
    "formation":  [{ "id": "f1", "titre": "Master 1 Microbiologie", "lieu": "Université Claude Bernard Lyon 1",
                     "debut": "2025", "fin": null, "enCours": true, "description": "", "visible": true }],
    "experience": [{ "id": "e1", "titre": "Stage parasitologie-mycologie", "lieu": "CHU Nedir Mohamed, Tizi-Ouzou",
                     "debut": "2023-06", "fin": "2023-08", "enCours": false, "description": "…", "visible": true }],
    "engagement": [],
    "competences": [{ "id": "c1", "domaine": "Microbiologie", "resume": "…", "techniques": ["Colorations", "…"], "visible": true }],
    "langues": [{ "id": "l1", "langue": "Français", "niveau": "Natif", "visible": true }],
    "certifications": [{ "id": "k1", "titre": "Gestion de projet", "organisme": "Google · Coursera", "annee": "2025", "visible": true }],
    "interets": [{ "id": "i1", "titre": "Astronomie", "texte": "…", "visible": true }]
  },
  "liens": {
    "categories": [{ "id": "projets", "nom": "Projets", "visible": true },
                   { "id": "android", "nom": "Applis Android", "visible": true }],
    "items": [{ "id": "u1", "url": "https://www.biostudy.xyz/", "titre": "BioStudy", "description": "…",
                "image": "…", "categorie": "projets", "date": "2026-10-29", "visible": true }]
  },
  "portfolio": {
    "dossierRacineId": "…",
    "dossiers": { "<idDossierDrive>": { "visible": true, "nom": "Posters" } }
  },
  "contact": {
    "email": "amarxbcrb@gmail.com",
    "linkedin": "https://www.linkedin.com/in/amarbouchareb",
    "autres": [{ "id": "a1", "label": "BioStudy", "url": "https://www.biostudy.xyz/" }],
    "ouvertA": [{ "id": "o1", "titre": "Stages en laboratoire", "detail": "…" }]
  }
}
```

Où va le contenu actuel :

| Aujourd'hui | Nouvelle place |
|---|---|
| Phrase « La microbiologie au service de… » et intro | Accueil : positionnement |
| Texte « Une formation de microbiologiste… » et paragraphes | Parcours › Profil |
| Section Science (4 domaines et techniques) | Parcours › Compétences |
| Frise Formation, Expérience, Engagement, Compétences transversales | Parcours › Formation, Expérience, Engagement (les compétences transversales vont dans Expérience) |
| Langues, Certifications, Formations en design | Parcours › Langues, Certifications (les formations en design rejoignent Certifications) |
| Au-delà du labo | Parcours › Intérêts |
| Section BioStudy et ses 8 outils | Liens › Projets |
| Contact et « Ouvert à » | Contact |

## 5. Script Google (API)

Une seule URL d'application web. Les lectures sont en `GET`. Les écritures sont en `POST` avec un corps JSON envoyé en `text/plain`, pour éviter la requête préalable CORS que les applications web Apps Script ne gèrent pas.

| Action | Méthode | Entrée | Sortie |
|---|---|---|---|
| `contenu` | GET | — | `{ version, contenu }` |
| `portfolio` | GET | — | `{ dossiers: [{ id, nom, fichiers: [{ id, nom, type, apercu, lien }] }] }`, mis en cache 5 min dans le script |
| `connexion` | POST | `{ motDePasse }` | `{ jeton, expire }` ou erreur |
| `enregistrer` | POST | `{ jeton, versionDeBase, contenu }` | `{ version }` ou `{ erreur: "conflit", version }` |
| `envoyerMedia` | POST | `{ jeton, emplacement: photo\|logo\|favicon\|cv, nom, type, base64 }` | `{ id, url }`, l'ancien fichier part à la corbeille |
| `apercuLien` | POST | `{ jeton, url }` | `{ titre, description, image }` lus dans les balises `<title>`, `og:*` et `description` |
| `dossierPortfolio` | POST | `{ jeton, lienDossier }` | `{ id, sousDossiers }`, le dossier passe en « tous les utilisateurs disposant du lien : lecteur » |

Règles :

- **Jeton** : `expiration.signature`, où la signature est un HMAC-SHA256 de l'expiration avec une clé secrète tirée au hasard à l'installation. Durée : 30 jours. Pas de stockage de session côté script.
- **Mot de passe** : stocké haché (SHA-256 + sel) dans les propriétés du script, jamais dans le dépôt.
- **Anti-force brute** : après 5 échecs, toute connexion est refusée pendant 15 min (compteur dans `CacheService`).
- **Remplacement** : `contenu.json` est réécrit en place (`setContent`) ; `version` augmente de 1 à chaque sauvegarde. Un `versionDeBase` différent de la version actuelle renvoie `conflit` sans rien écrire.
- **Verrou** : `LockService` autour de l'écriture pour éviter deux sauvegardes simultanées.
- **Médias** : les images sont réduites dans le navigateur avant envoi (2000 px de côté au plus pour la photo et le logo, 512 px pour le favicon) ; le CV doit faire moins de 10 Mo.
- **URL des images publiques** : `https://drive.google.com/thumbnail?id=<id>&sz=w<largeur>`. À vérifier pendant l'installation ; en repli, `https://lh3.googleusercontent.com/d/<id>`.

## 6. Site public

### 6.1 Structure

- **En-tête** : logo, « Amar Bouchareb » en taille normale avec le surtitre en dessous, bouton thème. Plus de bouton EN.
- **Barre du bas** : Accueil, Parcours, Portfolio, Liens, Contact, avec le verre, la goutte d'eau et une couleur par onglet. Un onglet masqué disparaît de la barre, qui se redimensionne.
- **Bouton Recherche** : cercle de verre de la hauteur de la barre, à sa droite, avec le même liseré et le même reflet sous le doigt.
- **Sous-onglets** : rangée de pastilles en verre sous le titre de l'onglet, qui défile à l'horizontale si elle est trop longue. La pastille active est teintée de la couleur de l'onglet. Seuls les sous-onglets visibles et non vides sont affichés.
- **Une vue à la fois** : changer d'onglet ou de sous-onglet remplace le contenu, avec l'animation de glissement actuelle. Le contenu d'un sous-onglet peut défiler s'il est long (une longue liste de certifications, par exemple), mais il n'y a jamais d'autre partie en dessous.

### 6.2 Vues

- **Accueil** : surtitre, phrase de positionnement (titre de taille normale, environ 32 à 40 px), ligne de situation, puis 3 blocs cliquables :
  - Formation actuelle : l'élément `enCours` de Formation, sinon le plus récent ; mène à `#parcours/formation` ;
  - Dernière expérience : l'élément le plus récent d'Expérience ; mène à `#parcours/experience` ;
  - Compétences clés : `accueil.competencesCles` ; mène à `#parcours/competences`.
  En bas, « Télécharger mon CV » (masqué s'il n'y a pas de CV) et « Me contacter ».
- **Parcours** : 8 sous-onglets (Profil, Formation, Expérience, Engagement, Compétences, Langues, Certifications, Intérêts). Formation, Expérience et Engagement s'affichent en frise datée.
- **Portfolio** : un sous-onglet par sous-dossier Drive visible, dans l'ordre alphabétique (préfixer un nom par « 1 - » permet de forcer l'ordre ; le préfixe n'est pas affiché). Grille d'aperçus. Une image ouvre la visionneuse actuelle ; un PDF ou un autre fichier ouvre sa page Drive dans un nouvel onglet.
- **Liens** : un sous-onglet par catégorie visible et non vide. Chaque lien est une carte avec image, titre, description et domaine ; elle s'ouvre dans un nouvel onglet. Les plus récents passent en premier.
- **Contact** : e-mail avec bouton Copier, LinkedIn, autres liens, « Ouvert à ».

### 6.3 Recherche

- Le bouton ouvre un panneau en verre : champ de saisie en haut, résultats en dessous ; Échap ou le bouton Fermer le referme.
- L'index couvre les éléments visibles de Parcours, Liens, Contact et les noms de fichiers du portfolio.
- La recherche ignore les accents et la casse ; on peut taper plusieurs mots ; les résultats arrivent à chaque frappe.
- Chaque résultat montre son type (Formation, Lien, Portfolio…), son titre et un extrait. Le toucher ferme le panneau et ouvre l'onglet et le sous-onglet concernés.

### 6.4 Chargement et secours

1. Au démarrage, la page affiche tout de suite la copie navigateur (`localStorage`) si elle existe.
2. Elle demande ensuite `contenu` au script (délai max 8 s) et met la page à jour si la version a changé.
3. Première visite sans copie : un écran de chargement discret jusqu'à la réponse. Si le script ne répond pas, la page utilise `content/default.json` et le portfolio affiche « Portfolio momentanément indisponible ».

### 6.5 Maintenance

- Si `site.maintenance.active` vaut vrai, la page n'affiche que l'écran de maintenance : logo, message, adresse e-mail.
- Si le navigateur a un jeton admin valide, le site s'affiche normalement, avec un bandeau « Maintenance active » et un lien vers l'admin.
- Limite connue : c'est appliqué dans le navigateur ; une personne technique pourrait lire le contenu dans les échanges réseau.

### 6.6 Favicon, logo et photo

- Au chargement, le site remplace le favicon par celui de `medias.favicon`, et le logo et la photo par ceux de Drive.
- Limite connue : Google et l'icône d'écran d'accueil iPhone utilisent le fichier `favicon-512x512.png` du dépôt ; pour les changer, il faut remplacer ce fichier dans le dépôt.

## 7. Admin (`/admin/`)

- **Page séparée**, non liée depuis le site et marquée `noindex`.
- **Connexion** : un champ mot de passe ; le jeton est gardé 30 jours dans `localStorage` ; bouton Se déconnecter.
- **Navigation** : une liste d'écrans à gauche sur PC, des onglets en haut sur téléphone.
- **Écrans** :
  1. **Accueil** : positionnement, situation, compétences clés (liste de puces modifiable).
  2. **Parcours** : un bloc par sous-onglet. Profil : titre et texte. Listes : ajouter, modifier dans un panneau, supprimer avec confirmation, réordonner par glisser ou avec des flèches, interrupteur Visible. Champs date avec « en cours ».
  3. **Liens** : champ « Coller une URL » et choix de catégorie → `apercuLien` → titre, description et image modifiables → Ajouter. Liste des liens par catégorie, avec modifier, supprimer, masquer. Gestion des catégories : ajouter, renommer, masquer, supprimer (seulement si elle est vide).
  4. **Portfolio** : coller le lien du dossier Drive racine → `dossierPortfolio`. Liste des sous-dossiers trouvés avec nom affiché et interrupteur Visible. Bouton « Relire Drive » qui vide le cache de 5 min.
  5. **Médias** : photo, logo, favicon, CV, chacun avec un aperçu, un bouton Remplacer et la taille maximale acceptée.
  6. **Contact** : e-mail, LinkedIn, autres liens, « Ouvert à ».
  7. **Visibilité et maintenance** : interrupteur par onglet et par sous-onglet ; interrupteur Maintenance et message.
- **Enregistrement** :
  - Un seul bouton « Enregistrer », toujours visible, avec un point qui signale les changements non enregistrés.
  - Les médias sont envoyés tout de suite au choix du fichier, sans attendre Enregistrer.
  - Un brouillon est gardé dans `localStorage` à chaque modification ; il est proposé au retour s'il n'a pas été enregistré.
  - En cas de `conflit`, l'admin propose « Recharger la dernière version » ou « Écraser avec la mienne ».
  - Messages d'erreur clairs pour : mot de passe faux, connexions bloquées 15 min, jeton expiré (retour à la connexion, brouillon gardé), pas de réseau.
- **Validation** : URL bien formées, dates cohérentes (fin après début), titres non vides. Les erreurs sont signalées à côté du champ, et l'enregistrement est bloqué tant qu'il en reste.

## 8. Style

- On garde le système actuel : jetons Nuvio, verre givré, thème sombre et clair, barre WebGL avec goutte d'eau et couleurs par onglet.
- Pas de décoration superflue, comme demandé : pas de puce qui clignote, pas de ronds colorés derrière les icônes, pas de compteurs animés, pas de citation décorative.
- L'admin utilise les mêmes jetons, dans une mise en page plus dense, façon formulaire.

## 9. Tests

- **Faux script** (`tests/mock-script.js`) servi en local : il imite toutes les actions, avec conflit, erreurs, lenteur et absence de réponse.
- **Tests Playwright du site** :
  - rendu de chaque vue depuis `default.json` ;
  - onglets et sous-onglets masqués ;
  - adresses directes `#onglet/sous-onglet` ;
  - recherche avec accents et clic sur un résultat ;
  - maintenance avec et sans jeton ;
  - secours quand le script ne répond pas ;
  - mise à jour depuis la copie navigateur.
- **Tests Playwright de l'admin** :
  - connexion, puis blocage après 5 essais ;
  - modification et enregistrement d'une expérience ;
  - ajout d'un lien par URL ;
  - conflit de version ;
  - brouillon après une coupure ;
  - remplacement d'un média.
- **Script réel** : vérifié avec Amar pendant l'installation, avec une liste de contrôle dans `INSTALLATION.md` (lecture, connexion, sauvegarde, média, aperçu de lien, portfolio, URL des images).

## 10. Installation (côté Amar)

1. Créer un projet Apps Script, coller `Code.gs`.
2. Écrire le mot de passe admin choisi dans la constante `MOT_DE_PASSE_INITIAL` en haut du script, puis exécuter une fois `installer()`. Le script demande les autorisations Drive, crée le dossier « Site amarbcrb » avec `contenu.json` (copie de `default.json`), « Médias » et « Portfolio », range le mot de passe haché dans les propriétés secrètes, puis indique d'effacer la constante.
3. Déployer en « Application Web » (exécuter en tant que moi, accès : tout le monde) et copier l'URL.
4. Me donner l'URL : je la mets dans `assets/api.js` et je publie.
5. Déposer les fichiers du portfolio dans les sous-dossiers de « Portfolio ».

## 11. Ordre de réalisation

1. Contenu par défaut, script Google et faux script.
2. Site public : découpage des fichiers, vues, sous-onglets, recherche, maintenance, secours.
3. Admin.
4. Installation du script avec Amar, puis publication.
