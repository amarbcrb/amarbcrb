# Refonte v5 : fluidité, fond, partages, compréhension

Approuvé par Amar le 2026-10-30 (choix : bulle de message, halo de l'onglet, Liens + Accueil, couleur du bord).

## Exigences
1. **Changement d'onglet** : la page sortante glisse vers le côté opposé et se floute, la nouvelle arrive du côté de l'onglet touché, floue puis nette, ~500 ms. View Transitions API si disponible, sinon l'animation d'entrée actuelle. Mouvement réduit : fondu court. Le flou n'existe que pendant la transition.
2. **Fond sombre « halo »** : plus de taches animées ni de `filter: blur` plein écran. Noir profond + lueur radiale fixe en haut, couleur de l'onglet ouvert, transition en fondu (propriété CSS enregistrée). Thème clair : même principe, très léger.
3. **Contact** : bouton rond avec une bulle de message, `aria-label="Contact"`, petite animation au toucher.
4. **Affiches** : une image affichée entière (cadrage « contain ») remplit les bandes avec la couleur de son bord (moyenne de la rangée/colonne de bord, échantillonnée sur un petit canvas). Si l'image ne laisse pas lire ses couleurs (CORS), flou très étalé à la place. Rien n'est recadré.
5. **Partages** :
   - type de lien `linkedin` (« Post LinkedIn »), détecté par l'adresse (linkedin.com/posts/…, /feed/update/…) ;
   - champ `avis` (« Mon avis ») sur chaque lien, affiché sur la carte et dans la fiche ;
   - catégorie « À lire » (`alire`) ajoutée une fois au contenu existant ;
   - fiche d'un post LinkedIn : intégration `linkedin.com/embed/feed/update/urn:li:<type>:<id>` + bouton « Voir sur LinkedIn » ;
   - Accueil : rangée « À lire » avec les 3 derniers partages ; la rangée « Projets » ne les reprend pas.
6. **Icônes animées** : rebond de l'icône de l'onglet choisi, rotation soleil/lune, loupe au toucher, icône de type de lien au survol, flèches « Voir tout » au survol. Coupé si mouvement réduit.
7. **Compréhension** :
   - phrase sous le titre de chaque onglet (`onglets.<id>.sousTitre`, `onglets.perso[].sousTitre`), modifiable sur place ;
   - Accueil : nom + phrase + boutons « Voir mon parcours » et « Me contacter » en premier, puis le carrousel ;
   - cartes : signe qu'on peut les ouvrir ;
   - audit UX (probes) et corrections.

## Contraintes
- Pas de nouvelle dépendance, pas de build. Ne jamais toucher `magie`, `kh`, `katia`, `L3`.
- Tous les tests existants restent verts ; nouveaux tests pour chaque exigence.
