# Refonte v4 : police, cadrage, chargement, médias, édition sur place

Date : 2026-10-30. Statut : design validé en conversation, spec à relire.

## Ce que veut Amar

Mêmes objectifs que les versions précédentes : un site vivant, informatif, qui donne une bonne image de lui. En plus :

1. Retirer le serif, jugé pas pro.
2. Ne plus couper les images (logo Coursera coupé dans une affiche).
3. Un premier chargement plus rapide.
4. Réutiliser une image déjà envoyée sans la renvoyer (pas de copies).
5. Pouvoir mettre un lien d'image, un GIF ou une vidéo partout où il y a une image.
6. Modifier le site directement sur le site, pas dans un espace séparé :
   - textes ;
   - ajouts et suppressions ;
   - certificats ;
   - liens ;
   - fichiers et dossiers du portfolio.
7. Garder l'admin séparé seulement pour :
   - le favicon et les médias du site ;
   - la maintenance ;
   - masquer les onglets et les rubriques ;
   - créer des onglets.
8. Protéger un dossier publié par un mot de passe (images, PDF, liens dedans).

## Décisions prises avec Amar

| Sujet | Choix |
|---|---|
| Police des titres et du nom | Inter Tight, hébergée sur le site |
| Images de forme différente du cadre | Cadrage auto : image entière sur un fond flouté d'elle-même ; affiches en 3:4 |
| Vidéo | Muette en boucle (fichier .mp4/.webm ou GIF) ; YouTube : miniature ▶, lecture avec le son dans la fiche |
| Accès à l'édition | Appui long (1 s) sur le nom en haut |
| Publication | Brouillon sur l'appareil, puis bouton « Publier » |
| Onglets créés | Au choix : « Rangées libres » ou « Galerie Drive » ; 6 onglets au plus dans la barre |
| Dossier protégé | Vraie protection, un mot de passe par dossier, clé visiteur de 30 jours |
| Lenteur ressentie | Le premier chargement |

## Partie 1 : corrections rapides

### Police

- Inter Tight (licence OFL) remplace Instrument Serif pour :
  - le nom dans l'en-tête ;
  - la salutation de l'Accueil ;
  - les titres de page ;
  - les titres du carrousel ;
  - les chiffres des repères ;
  - le texte des affiches dessinées.
- Graisses 600 à 800.
- Fichier woff2 latin hébergé dans `assets/fonts/`.
- Les textes courants gardent la police système.
- Instrument Serif est retiré du site.

### Cadrage auto

- Les affiches passent de 2:3 à 3:4.
- Une fonction unique affiche tout visuel (image, GIF, vidéo).
- Au chargement, elle compare la forme du média (`naturalWidth / naturalHeight`, ou `videoWidth / videoHeight`) à celle du cadre :
  - **écart de plus de 25 %** : le média est affiché entier (`contain`), centré, sur une copie floutée de lui-même qui remplit le cadre ;
  - **sinon** : il remplit le cadre (`cover`).
- Elle sert partout : affiches, bannières du carrousel, cartes de domaine, de compétence et d'intérêt, tuiles des liens, bannière de la fiche, vignettes du portfolio.

### Chargement

1. **Squelette.** La page s'affiche tout de suite avec des emplacements gris en forme de cartes au lieu de « Chargement… ».
2. **Requête anticipée.**
   - `index.html` déclare `preconnect` vers `script.google.com` et `script.googleusercontent.com`.
   - Un petit script en tête de page lance la lecture du contenu avant le chargement des modules. Il lit l'adresse dans une balise `<meta name="script-url">`.
   - `api.js` réutilise cette requête si elle existe.
   - Un test vérifie que l'adresse de la balise et `SCRIPT_URL` sont identiques.
3. **Cache du script** : déjà fait (voir « Script Google »).
4. **Images** :
   - `loading="lazy"` et `decoding="async"` partout, sauf la première bannière du carrousel (`fetchpriority="high"`) ;
   - le logo de l'en-tête est préchargé.

## Partie 2 : médias

### Forme d'un média dans le contenu

Les clés `image` (cartes) et `media` (liens) acceptent :

```
{ id?: string, url: string, type?: 'image' | 'video' | 'youtube' }
```

- `id` est présent seulement pour un fichier de la médiathèque (Drive).
- Sans `type`, il est déduit de l'adresse :
  - `.mp4` ou `.webm` → `video` ;
  - youtube.com ou youtu.be → `youtube` ;
  - sinon → `image` (les GIF sont des images).
- Les anciennes valeurs `{ id, url }` restent valides.
- Les adresses passent par le même filtre qu'aujourd'hui : `http(s)` ou `/…` seulement.

### Affichage

| Type | Rendu |
|---|---|
| image, GIF | `<img>` (GIF animé) |
| vidéo | `<video muted loop playsinline autoplay>`, sans contrôles. Pas de lecture automatique en mouvement réduit (première image seulement). En pause hors de l'écran (`IntersectionObserver`). |
| YouTube | Miniature `https://i.ytimg.com/vi/<id>/hqdefault.jpg` avec un bouton ▶. Toucher ouvre la fiche, qui contient le lecteur `https://www.youtube-nocookie.com/embed/<id>` avec le son. |

### Champ média (édition sur place et admin)

Le même composant propose trois choix :

1. **Envoyer** : réduction à 1600 px en JPEG, puis `envoyerMedia`, comme aujourd'hui.
2. **Ma médiathèque** : une feuille avec la grille des fichiers de `listerMedias`. Toucher un fichier le choisit, sans nouvel envoi. Un bouton « Supprimer » par fichier appelle `supprimerMedia` ; s'il est refusé, on affiche les emplacements qui l'utilisent.
3. **Coller un lien** : image, GIF, vidéo ou YouTube, avec aperçu immédiat.

## Partie 3 : édition sur place

### Connexion

- Un appui de 1 s sur `.brand` ouvre une feuille « Mot de passe ».
  - La connexion se fait par `connexion`, comme l'admin aujourd'hui.
  - Le jeton reste 30 jours (`ab-jeton`).
  - Un toucher normal sur le nom ramène toujours à l'Accueil.
- Avec un jeton valide, une pastille « Modifier » flotte au-dessus de la barre du bas.
- Le code d'édition (`assets/edition/*.js`) n'est chargé (`import()`) que pour un propriétaire connecté. Un visiteur ne le télécharge jamais.

### Mode édition

- Le rendu marque ce qui est modifiable :
  - `data-edit="<chemin>"` sur les textes (salutation, présentation, titres de rangée, profil…) ;
  - `data-element="<liste>/<id>"` sur les cartes ;
  - `data-ajout="<liste>"` en fin de rangée.
- Le module d'édition s'appuie sur ces marques. Le rendu public ne change pas.
- **Texte** :
  - `contenteditable="plaintext-only"` ;
  - validé quand on quitte le champ ;
  - Entrée valide un titre ;
  - dans un texte long, Entrée va à la ligne.
- **Carte** :
  - ✎ ouvre une feuille avec tous ses champs. Les champs viennent d'un schéma partagé avec l'admin (`assets/schemas.js`) : titre, lieu, dates, lien, média…
  - 🗑 supprime la carte après confirmation, avec un toast « Annuler » de 5 s ;
  - ↑ et ↓ la déplacent.
- **« + Ajouter »** en fin de rangée :
  - Parcours (formation, expérience, compétence, certification, langue, engagement, intérêt) ;
  - Accueil (repère, domaine) ;
  - rangées des onglets libres.
- **Liens** :
  - « + Ajouter un lien » : on colle l'adresse ; `apercuLien` remplit titre, description et image ; on choisit la catégorie ;
  - on peut créer, renommer et supprimer une catégorie (refusé si elle contient des liens, comme aujourd'hui).
- **Contact** : la fiche est modifiable de la même façon.
- **Brouillon** :
  - le contenu modifié est gardé dans `ab-brouillon` (`{ versionDeBase, contenu }`) ;
  - en mode édition, le site affiche le brouillon ;
  - une barre en bas montre « N modifications · Annuler · Publier » ;
  - « Publier » appelle `enregistrer`. En cas de conflit, on propose « Recharger » ou « Écraser », comme dans l'admin ;
  - la validation (`valider`) s'affiche sur le champ concerné et bloque « Publier » tant qu'il reste une erreur.
- **Portfolio et galeries** : les opérations Drive sont **immédiates**, pas en brouillon, et une confirmation le dit.
  - « + Ajouter un fichier » appelle `envoyerFichier` (25 Mo au plus, les images restent en taille d'origine) ;
  - « + Nouveau dossier » appelle `creerDossier` ;
  - on peut renommer (`renommerDossier`) et supprimer (`supprimerDossier`, `supprimerFichier`) ;
  - on peut ajouter des liens à un dossier (`liensDossier`) ;
  - « 🔒 Protéger » (`protegerDossier`) : saisie du mot de passe du dossier ; un mot de passe vide retire la protection.
  - Masquer ou renommer à l'affichage reste dans le contenu (`portfolio.dossiers[id]`), donc en brouillon.

### Dossier protégé, côté visiteur

- La liste publique marque le dossier `protege: true`, sans fichiers. Il s'affiche avec un cadenas.
- Toucher le dossier ouvre une feuille « Mot de passe » qui appelle `ouvrirDossier`.
  - La clé reçue est gardée 30 jours (`ab-cle:<idDossier>`).
  - Le dossier s'ouvre avec ses fichiers, ses sous-dossiers et ses liens.
- Images et PDF sont lus avec `fichierProtege` (`taille: 'apercu'` pour les vignettes), puis affichés depuis une adresse locale (`URL.createObjectURL`).
- Le PDF s'ouvre dans un nouvel onglet à partir de cette adresse.
- Une clé refusée (mot de passe changé, clé périmée) est effacée, et le mot de passe est redemandé.

### Admin séparé (`/admin/`)

- **Écrans gardés** :
  - **Médias** : logo, favicon, photo, CV ;
  - **Visibilité et maintenance**.
- **Nouvel écran Onglets** :
  - créer un onglet : nom, icône parmi une liste fixe, couleur parmi la palette, type ;
  - **Galerie Drive** : on colle un lien, l'admin appelle `dossierGalerie`, et l'onglet garde `dossierId` ;
  - réordonner, masquer, supprimer ;
  - 6 onglets au plus dans la barre, en comptant les onglets intégrés visibles ;
  - Recherche reste à part.
- **Écrans retirés** : Accueil, Parcours, Liens, Portfolio, Contact. Tout se fait sur le site.

### Modèle de contenu ajouté

```
onglets.perso : [{ id, nom, icone, couleur, type: 'rangees' | 'drive', dossierId, visible }]
pages[idOnglet] : { rangees: [{ id, titre, visible, cartes: [{ id, titre, texte, media, lien, bouton, visible }] }] }
```

- Un onglet « Galerie Drive » s'affiche comme le Portfolio, à partir de `?a=galerie&id=<dossierId>`.
- Les dossiers protégés et les liens des dossiers ne sont **jamais** dans le contenu public. Le script les garde dans ses propriétés.

## Script Google (déjà livré, commit 57bf8f4)

**Lecture publique (GET)** :
- `contenu`, lu dans le cache Google et rafraîchi à chaque enregistrement ;
- `portfolio` ;
- `galerie&id`, seulement pour un dossier déclaré par un onglet « drive » du contenu.

**Écriture (POST, jeton du propriétaire)** :
- `enregistrer`, `envoyerMedia`, `apercuLien`, `dossierPortfolio` (inchangés) ;
- `listerMedias`, `supprimerMedia` ;
- `dossierGalerie`, `envoyerFichier`, `creerDossier`, `renommerDossier`, `supprimerDossier`, `supprimerFichier` ;
- `protegerDossier`, `liensDossier`.

**Sans jeton du propriétaire** :
- `connexion` ;
- `ouvrirDossier` (mot de passe du dossier, 5 échecs puis 15 min de blocage) ;
- `fichierProtege` (clé du dossier).

**Règles** :
- le script n'agit que sur la racine Portfolio, les racines des galeries déclarées et leurs sous-dossiers directs ; jamais sur le dossier du site ni sur Médias, et jamais sur `contenu.json` ;
- les racines ne sont pas publiques ; chaque fichier d'un dossier non protégé est partagé un par un quand le dossier est lu ;
- les fichiers d'un dossier protégé sont privés ;
- l'enregistrement ne met à la corbeille que le logo, la photo, le favicon ou le CV remplacés. Les autres fichiers de Médias restent dans la médiathèque.

## Tests

- **Partie 1** :
  - la police chargée est Inter Tight et aucun serif ne reste ;
  - cadrage : une image 3:1 dans une affiche 3:4 est en `contain` avec un fond flouté ; une image 3:4 est en `cover` ;
  - un squelette est visible avant la réponse du script (faux script lent) ;
  - la requête anticipée est réutilisée : un seul appel `contenu`.
- **Partie 2** : rendu image, GIF, vidéo (attributs, pas d'autoplay en mouvement réduit), YouTube (miniature puis lecteur dans la fiche) ; médiathèque (choisir sans nouvel envoi, suppression refusée si utilisé) ; lien collé.
- **Partie 3** :
  - appui long puis connexion puis pastille ;
  - texte modifié, brouillon gardé après rechargement, « Publier » envoie une version ;
  - conflit ;
  - ajout, suppression avec annulation, déplacement ;
  - ajout de lien avec aperçu ;
  - fichier et dossier du portfolio, protection, puis visiteur : cadenas, mauvais mot de passe, bon mot de passe, image et PDF lus par le script ;
  - onglet libre et galerie Drive créés dans l'admin ;
  - aucune requête vers `assets/edition/` pour un visiteur.
- **Accessibilité** : la revue `tests/ux.test.mjs` étendue aux nouveaux écrans (mode édition, feuilles, médiathèque, dossier protégé).
- **Script** : `tests/apps-script.test.mjs`, 45 tests déjà verts.

## Ordre de livraison

1. Partie 1, puis fusion dans `main`.
2. Partie 2, puis fusion.
3. Partie 3 et dossiers protégés côté site, puis fusion.

Chaque partie se termine sur une suite complète verte et une passe visuelle à 320, 390 et 1366 px, en clair et en sombre.

## Hors champ

- Vraies photos libres de droits : bloquées par le réseau de l'environnement, à ajouter quand l'accès est ouvert ou quand Amar envoie ses photos.
- Édition à plusieurs : un seul propriétaire, un seul mot de passe admin.
