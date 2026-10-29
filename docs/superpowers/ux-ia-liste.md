# Défauts UI/UX typiques des sites faits par IA : liste de contrôle

Recherche du 2026-10-29. La plupart des sources sont des billets de designers, pas des études. Ce sont des tendances observées, pas des règles absolues. Le problème vient surtout de l'accumulation de tous ces réglages par défaut à la fois.

| # | Défaut | À vérifier sur le site | Sources |
|---|---|---|---|
| 1 | Palette violet / indigo et dégradés « par défaut » (héritage de la couleur par défaut de Tailwind UI) | Aucun dégradé décoratif ; les couleurs servent à repérer (une couleur par onglet) | [noqta.tn](https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026), [prg.sh](https://scour.ing/@emschwartz/p/https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website), [925studios](https://www.925studios.co/blog/ai-slop-design-tells), [aismells](https://aismells.pages.dev/gradient-fog.html) |
| 2 | Police par défaut partout (Inter, Roboto…) sans hiérarchie | Hiérarchie nette : taille et graisse distinctes entre titre de page, titre de rangée et texte | [tessl / no-ai-design-slop](https://tessl.io/registry/skills/github/MengTo/Skills/no-ai-design-slop), [inspoai](https://www.inspoai.io/blog/why-ai-websites-look-generic) |
| 3 | Grands rayons identiques sur tout (cartes, boutons, champs, badges) qui écrasent la hiérarchie | Rayons distincts selon le rôle : pastilles rondes, cartes 22 px, vignettes 18 px | [noqta.tn](https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026) |
| 4 | Grille de trois cartes à icône (« trois boîtes avec une icône ») | Pas d'icônes décoratives dans des ronds ; une carte a un contenu réel | [noqta.tn](https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026), [925studios](https://www.925studios.co/blog/ai-slop-design-tells) |
| 5 | Tout enfermé dans des cartes, même ce qui n'en a pas besoin | Le texte du profil et les titres ne sont pas dans des cartes | [mintlify / impeccable](https://www.mintlify.com/pbakaus/impeccable/concepts/anti-patterns), [notion : vibe coded](https://app.notion.com/p/How-to-Stop-Your-Vibe-Coded-Website-From-Looking-AI-Generated-3a264170dad0804eb2f2ef31591e60ab) |
| 6 | Étiquettes et ornements qui n'apportent rien (badges, sur-titres partout, italiques sans raison) | Chaque libellé dit quelque chose ; pas de badge décoratif | [searchenginejournal](https://searchenginejournal.com/7-common-ai-website-mistakes-that-are-easy-to-avoid/574196/), [mintlify / impeccable](https://www.mintlify.com/pbakaus/impeccable/concepts/anti-patterns) |
| 7 | Textes génériques qui iraient à n'importe quel produit | Les textes parlent de faits précis : lieux, dates, techniques, noms | [21st.dev](https://21st.dev/blog/website-not-look-ai-generated) |
| 8 | Ni chiffres, ni noms, ni dates, ni vraies images | Dates et lieux réels partout ; vraies images (portfolio, intérêts) | [21st.dev](https://21st.dev/blog/website-not-look-ai-generated) |
| 9 | Liens et boutons qui ne mènent nulle part | Aucun bouton sans destination ; liens vides masqués | [yomotherboard / reddit](https://yomotherboard.com/?p=190431) |
| 10 | Le site se casse sur téléphone | Pas de débordement horizontal ; zones tactiles ≥ 44 px ; mise en page testée à 320, 390 et 1366 px | [yomotherboard / reddit](https://yomotherboard.com/?p=190431) |
| 11 | Effets « lueur » et brouillard qui gênent la lecture | Contraste du texte ≥ 4,5:1 sur fond réel | [aismells](https://aismells.pages.dev/gradient-fog.html) |

Contrôles d'accessibilité ajoutés (WCAG 2.2 AA), mesurés par `tests/ux.test.mjs` :

- cibles tactiles d'au moins 44 × 44 px ;
- nom accessible sur chaque bouton et chaque lien ;
- focus clavier visible ;
- contraste du texte d'au moins 4,5:1.
