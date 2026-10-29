# Installer le script Google du site

Compte environ 10 minutes. Tu as besoin de ton compte Google et du fichier `Code.gs` de ce dossier.

Avant de commencer, le site doit déjà être publié avec `content/default.json`. Le script lit ce fichier une seule fois, pour créer ton premier `contenu.json`.

## 1. Créer le projet

1. Ouvre https://script.google.com et clique sur **Nouveau projet**.
2. Renomme-le « Site amarbcrb » : clique sur « Projet sans titre », en haut à gauche.
3. Efface tout le texte de `Code.gs` dans l'éditeur, puis colle à la place tout le contenu du fichier `apps-script/Code.gs` du dépôt.
4. Clique sur l'icône disquette pour enregistrer.

## 2. Choisir ton mot de passe et installer

1. Tout en haut du code, remplace `const MOT_DE_PASSE_INITIAL = '';` par ton mot de passe entre les apostrophes, par exemple `const MOT_DE_PASSE_INITIAL = 'un-mot-de-passe-long';`. Prends au moins 12 caractères.
2. Enregistre.
3. Dans la liste déroulante à côté de **Exécuter**, choisis `installer`, puis clique sur **Exécuter**.
4. Google demande des autorisations. Clique sur **Examiner les autorisations**, choisis ton compte, puis **Paramètres avancés** › **Accéder à Site amarbcrb (non sécurisé)** › **Autoriser**. C'est normal pour un script que tu as créé toi-même.
5. Le journal d'exécution affiche « Installation terminée ». Dans ton Drive, tu as maintenant un dossier **Site amarbcrb** avec `contenu.json`, **Médias** et **Portfolio**.
6. Remets `const MOT_DE_PASSE_INITIAL = '';`, puis enregistre. Ton mot de passe est gardé haché dans les propriétés du script, il n'a plus besoin d'être dans le code.

Pour changer de mot de passe plus tard, refais l'étape 2 : ton contenu reste, et tous les appareils déjà connectés à l'admin sont déconnectés (utile si tu perds ton téléphone).

## 3. Déployer

1. En haut à droite, clique sur **Déployer** › **Nouveau déploiement**.
2. Clique sur la roue à côté de « Sélectionner le type », puis choisis **Application Web**.
3. Description : « Site ». Exécuter en tant que : **Moi**. Qui a accès : **Tout le monde**.
4. Clique sur **Déployer**, puis copie l'**URL de l'application Web**. Elle se termine par `/exec`.
5. Envoie-moi cette URL : je la mets dans `assets/config.js` et je publie le site.

Si tu modifies `Code.gs` plus tard, fais **Déployer** › **Gérer les déploiements** › crayon › Version : **Nouvelle version** › **Déployer**. L'URL ne change pas.

## 4. Portfolio

1. Dans **Site amarbcrb › Portfolio**, crée un sous-dossier par catégorie (par exemple « Design », « Posters », « Diaporamas ») et dépose-y tes fichiers.
2. Pour choisir l'ordre, commence le nom par un numéro : « 1 - Posters », « 2 - Design ». Le numéro n'est pas affiché sur le site.
3. Tu peux aussi utiliser un autre dossier Drive : colle son lien dans l'admin, écran **Portfolio**.

Le site relit Drive au plus tard 5 minutes après un ajout. Le bouton **Relire Drive** de l'admin force la mise à jour tout de suite.

## 5. Liste de contrôle (à faire ensemble)

- [ ] Ouvrir `<URL>/exec?a=contenu` dans le navigateur affiche du texte qui commence par `{"ok":true,"version":1`.
- [ ] Connexion à `/admin/` avec ton mot de passe.
- [ ] Modifier la phrase de l'accueil, enregistrer, recharger le site : la nouvelle phrase s'affiche.
- [ ] Envoyer une photo dans **Médias** : elle s'affiche dans l'en-tête du site.
- [ ] Coller un lien dans **Liens** : le titre et la description se remplissent seuls.
- [ ] Un fichier déposé dans un sous-dossier du Portfolio apparaît sur le site après **Relire Drive**, y compris dans une fenêtre de navigation privée (sans être connecté à Google).
- [ ] L'image du portfolio s'affiche avec l'adresse `https://drive.google.com/thumbnail?id=…`. Si elle reste vide, prévenir : on passera à `https://lh3.googleusercontent.com/d/…`.
- [ ] Activer la maintenance : le site affiche la page de maintenance dans une fenêtre de navigation privée, et le site normal avec un bandeau dans ton navigateur connecté.
