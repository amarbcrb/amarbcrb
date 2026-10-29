# Refonte v2 : rangées façon Nuvio, fiches, Contact dans l'en-tête : conception

Date : 2026-10-29
Statut : validé à l'oral (3 parties), en relecture écrite
S'appuie sur : `docs/superpowers/specs/2026-10-29-refonte-site-design.md` (architecture Drive + Apps Script inchangée)

## 1. Objectif

Rendre le site plus vivant et plus professionnel, dans l'esprit des applis Nuvio et Bitchord (captures d'Amar) :

- rangées horizontales de cartes avec « › Voir tout », fiches détaillées qui montent du bas ;
- barre du bas allégée : Contact sort de la barre ;
- liens partagés présentés en vraies cartes (titre, image, description, bouton) ;
- intérêts illustrés ; certificats avec un bouton « Voir le certificat » ;
- aucun des défauts UI/UX typiques des sites faits par IA, vérifié par une revue mesurée.

Critères de réussite :

1. Sur téléphone, l'onglet Parcours tient en une page de rangées : aucune partie n'empile plus d'une hauteur de carte ; tout le détail est accessible par « Voir tout » ou par la fiche.
2. La barre du bas a 4 onglets + Recherche ; Contact s'ouvre depuis la photo de l'en-tête et depuis « Me contacter ».
3. Chaque lien affiche titre, image (ou repli), description et bouton ; chaque certificat avec lien affiche « Voir le certificat ».
4. La revue UI/UX (contraste, zones tactiles, focus, noms accessibles, cohérence) ne remonte plus d'erreur bloquante sur les vues du site.

Hors périmètre : stockage Drive, script Google (sauf §6), maintenance, recherche (sauf ajout des nouveaux champs à l'index).

## 2. Navigation

- **Barre du bas** : `accueil`, `parcours`, `portfolio`, `liens` + bouton Recherche. Verre, goutte d'eau et couleurs par onglet inchangés.
- **En-tête** :
  - à gauche, logo + nom (taille normale) ;
  - à droite, pastille en verre contenant le bouton thème et la photo ronde (`medias.photo`, repli `medias.logo`), `aria-label="Contact"`.
- **Fiche Contact** :
  - feuille en verre qui monte du bas : e-mail (Copier), LinkedIn, autres liens, bouton « Télécharger mon CV » si présent, « Ouvert à » ;
  - adresse `#contact` (les anciens liens restent valides) ;
  - ouverte par la photo de l'en-tête et par « Me contacter ».
- **Adresses** :
  - `#accueil`, `#parcours`, `#portfolio`, `#liens` : pages de rangées ;
  - `#<onglet>/<partie>` : page « Voir tout » d'une partie (ex. `#parcours/certifications`, `#liens/android`, `#portfolio/<idDossier>`) ;
  - `#<onglet>/<partie>/<idElement>` : fiche détaillée ouverte par-dessus la page de l'onglet ;
  - `#contact` : fiche Contact par-dessus la dernière page affichée (Accueil si arrivée directe) ;
  - les alias existants (`#profil`, `#science`, `#biostudy`, `#beyond`…) restent ; une partie ou un élément inconnu ou masqué retombe sur la page de l'onglet ;
  - le retour arrière ferme d'abord la fiche, puis quitte « Voir tout ».
- **Visibilité** : Contact devient une « partie » (plus un onglet) ; masquée, la photo de l'en-tête n'ouvre plus rien et « Me contacter » disparaît.

## 3. Pages

- **Accueil** :
  - surtitre, phrase de positionnement, situation ;
  - rangée de 3 grandes cartes (Formation actuelle, Dernière expérience, Compétences clés), chacune ouvrant la fiche correspondante ;
  - boutons « Télécharger mon CV » (si CV) et « Me contacter ».
- **Parcours** :
  - Profil en haut : titre + 3 lignes, puis « Lire la suite » qui déplie le texte en place ;
  - puis une rangée par partie visible et non vide, dans l'ordre : Formation, Expérience, Compétences, Certifications, Langues, Engagement, Intérêts.
- **Portfolio** : une rangée par sous-dossier Drive visible ; vignettes d'affiches ; toucher une image ouvre la visionneuse existante ; un fichier non image ouvre Drive.
- **Liens** : une rangée par catégorie visible et non vide, liens les plus récents d'abord.
- **Rangée** :
  - en-tête : titre de la partie, nombre d'éléments, bouton rond « › » (`aria-label="Voir tout : <partie>"`) ;
  - piste horizontale en `scroll-snap`, défilement au doigt, flèches au survol sur ordinateur ;
  - au plus 10 cartes ; s'il y en a plus, une dernière carte « Voir tout (N) ».
- **Voir tout** : bouton retour rond, grand titre, sous-titre (nombre d'éléments), grille de cartes (2 colonnes sur téléphone, plus sur ordinateur).
- **Fiche détaillée** : feuille qui monte du bas, poignée, bouton fermer ; contenu complet de l'élément ; ferme par glisser vers le bas, Échap, clic sur le fond ou retour arrière ; le focus revient à la carte.

## 4. Cartes

| Partie | Carte | Fiche |
|---|---|---|
| Formation, Expérience, Engagement | période (petit), titre (gras), lieu ; « En cours » si `enCours` | période, titre, lieu, description |
| Compétences | domaine, 3 premières techniques en puces + « +N » | domaine, résumé, toutes les techniques |
| Certifications | titre, organisme · année, bouton « Voir le certificat » si `url` | idem + bouton |
| Langues | petite carte : langue, niveau | pas de fiche |
| Intérêts | carte image en hauteur (affiche), titre sur l'image ; repli dégradé de la couleur de l'onglet + titre | image en grand, titre, texte |
| Liens | image (16:9), titre, 2 lignes de description, nom du site, bouton (`bouton`, défaut « Ouvrir ») ; repli : nom du site sur dégradé | pas de fiche : la carte et le bouton ouvrent le lien (nouvel onglet) |
| Portfolio | vignette (4:5) | visionneuse existante |

Règle commune : aucun bouton sans destination ; un lien non `http(s)` n'est jamais cliquable.

## 5. Modèle de contenu (ajouts)

- `parcours.certifications[].url` : `''` par défaut, validé par `lienSur` s'il est rempli.
- `parcours.interets[].image` : `null` ou `{ id, url }`.
- `liens.items[].bouton` : `''` par défaut (affiché « Ouvrir »).
- `onglets.contact` : reste dans le modèle (visibilité de la partie Contact) mais n'est plus un onglet de la barre ; `ONGLETS` devient `['accueil','parcours','portfolio','liens']`.
- `content/default.json` :
  - Astronomie : « Membre d'un club d'astronomie, j'ai participé à plusieurs observations d'occultations stellaires. »
  - Cartomagie : « Je maîtrise des tours de cartes qui demandent précision, sens de l'observation et beaucoup de pratique. »
  - Certifications Coursera : `url: ''` (Amar mettra les vrais liens).
- La recherche indexe aussi les certificats, avec la cible `#parcours/certifications/<id>`, et chaque résultat ouvre la fiche de l'élément.

## 6. Script Google

- `envoyerMedia` accepte l'emplacement `image` (images d'intérêts), réduit côté admin à 1600 px, JPEG.
- `nettoyerMedias` garde tous les fichiers référencés : `medias.*.id` et `parcours.interets[].image.id`.

## 7. Animations

- Rangées qui apparaissent en fondu décalé (60 ms par rangée) au premier affichage d'une page.
- Pression sur une carte : échelle 0,97 avec ressort, et vibration de 8 ms là où elle existe.
- Fiche : montée avec ressort (360 ms) et fond flouté.
- « Voir tout » : glissement depuis la droite.
- Survol sur ordinateur : légère élévation de la carte et flèches de rangée.
- `prefers-reduced-motion` : tout est instantané.

## 8. Revue UI/UX

1. Recherche web des défauts récurrents des sites générés par IA ; liste de contrôle écrite dans `docs/superpowers/ux-ia-liste.md` avec la source de chaque point.
2. Revue mesurée avec le skill `ux-ui-audit` sur le serveur de test : 390 et 1366 px, sombre et clair, pages Accueil, Parcours, Voir tout, fiche, Liens, Portfolio, Contact, Recherche.
3. Chaque défaut trouvé est corrigé, et un test est ajouté quand il est mesurable (contraste, taille de cible ≥ 44 px, nom accessible, focus visible).
4. Le résultat est livré dans `docs/superpowers/ux-revue-2026-10-29.md` : ce qui a été trouvé, ce qui a été corrigé, ce qui reste avec la raison.

## 9. Admin

- Certifications : champ « Lien du certificat ».
- Intérêts : champ « Image » (bouton d'envoi, aperçu, retirer).
- Liens : champ « Texte du bouton ».
- Visibilité : « Contact » passe de la liste des onglets à une ligne « Fiche Contact ».

## 10. Tests

- Mise à jour :
  - barre à 4 onglets ;
  - Contact devenu une fiche ;
  - les sous-onglets de Parcours, Liens et Portfolio remplacés par des rangées et des pages « Voir tout ».
- Nouveaux :
  - rangées (au plus 10 cartes et « Voir tout (N) ») ;
  - page « Voir tout » et son retour ;
  - fiche (ouverture, adresse, Échap, retour arrière, focus rendu) ;
  - fiche Contact depuis la photo et depuis « Me contacter » ;
  - bouton certificat présent et absent ;
  - carte lien complète et ses replis ;
  - image d'intérêt (admin → site) ;
  - nettoyage Drive qui garde les images d'intérêts ;
  - tailles de cibles et contrastes mesurés.
- Fin de parcours : passe visuelle 320 / 390 / 1366 px, sombre et clair, puis relecture indépendante de la branche.
