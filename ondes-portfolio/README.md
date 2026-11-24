# Ondes : démo de portfolio musical

Un portfolio d'une page où chaque section est un genre musical. Écran noir, clic sur « Entrer », et une nappe d'ondes 3D lumineuse s'allume et réagit à une musique générée en direct. En défilant, on passe d'un genre à l'autre avec un fondu audio et un changement de couleur.

| Section | Genre | Couleur |
|---|---|---|
| Accueil | ambient | bleu glacé |
| Présentation | jazz | or |
| Projets | house | vert acide |
| Expériences | rock | rouge |
| Compétences | hip-hop boom bap | violet |
| Contact | soul / funk | orange chaud |

Le contenu est **générique** (« Prénom Nom », « Projet Alpha »…). C'est à toi de mettre le tien.

## La lancer (2 minutes)
1. Ouvre un terminal dans ce dossier.
2. Lance `python3 -m http.server 4410 --bind 127.0.0.1`
3. Ouvre http://127.0.0.1:4410/ dans Chrome ou Safari, casque conseillé, puis clique sur « Entrer ».

Pas de `npm install` à faire : les librairies sont déjà dans `vendor/`. Il faut juste une connexion internet pour charger les sons (piano, contrebasse, batterie).

**Commandes** : molette pour défiler · platine en bas à droite (ou touches 1 à 6) pour sauter à un genre · Espace = pause · M = couper le son.

## Mettre ton contenu
- `content.js` : ton nom, ton accroche, tes projets, tes expériences, tes compétences et tes contacts. Les règles de forme sont en haut du fichier.
- `index.html` : remplace « Prénom Nom » (titre de l'onglet) et la ligne de crédits en bas.

## Continuer avec Claude Code + Diapason
Le dossier est prêt pour une reprise : lance `/diapason <chemin de ce dossier>`. Ton Claude lira :
- `CLAUDE.md` : règles et décisions du projet ;
- `docs/FICHE.md` : la fiche, en **brouillon**, que tu dois valider (genres, sections, technos…) ;
- `docs/HANDOFF.md` : où on en est et ce qui reste à faire.

Docs de conception :
- `docs/design/DA.md` : direction artistique et chorégraphie ;
- `docs/design/AUDIO.md` : système audio ;
- `docs/research/01-librairies-premium.md` : choix des librairies, avec les sources.

## Structure
```
index.html, styles.css   la page
content.js               le contenu (à remplacer)
js/main.js               relie tout, plus le « mode lecture » (nappe en retrait pendant la lecture)
js/scene.js              la nappe d'ondes (Three.js + bloom)
js/audio.js              la musique générée (Tone.js + smplr)
js/genres.js             les 6 genres : couleurs, tempo, mouvements
js/ui.js                 défilement, platine, lecteur, apparitions
vendor/                  librairies et polices (voir LICENCES.md)
package.json             versions exactes, pour un futur portage Astro
```
