# Portfolio — Nathan Billaud

Site statique en HTML/CSS/JS, sans framework ni build, hébergé sur GitHub Pages (`nbillaud1/portfolio.github.io`, branche `main`, en ligne sur `https://nbillaud1.github.io/portfolio.github.io/`). Pousser sur `main` met le site en ligne.

## Structure
Deux versions du même contenu (2026-11-24) : la **version musicale à la racine** (adresse principale) et la **version simple dans `simple/`** (site « Tempo », plus léger).
- `data.js` (racine, partagé) : **tous les textes**, y compris titres, boutons et menus (`TEXTES` pour la version simple, `TEXTES_V2` pour la version musicale), plus profil, expériences, projets, référentiel. Aucun texte visible en dur ailleurs (seuls les `aria-label`, la balise `<title>`/meta description d'origine et les noms de genres musicaux restent dans le code). Ne rien recomposer à partir des textes : les afficher tels quels.
- Version musicale : `index.html`, `content.js`, `js/`, `styles.css`, `vendor/`, `LICENCES.md` à la racine.
- `simple/index.html`, `simple/script.js` (routeur par hash `#/`, `#/projets`, `#/projets/<slug>`, `#/competences`, `#/competences/<AC>`), `simple/style.css` (tokens sur `:root`, thème sombre via `prefers-color-scheme` et `[data-theme]`).
- `simple/assets/projets/<slug>/` : captures d'écran, référencées dans `images` de chaque projet (chemins `assets/…`, relatifs à `simple/`).
- `v2/index.html` redirige vers la racine (ancienne adresse). Les anciens liens `/#/…` sont renvoyés vers `simple/#/…` par `index.html`.

## Contenu d'un projet
Sections fixes (clés de `sections`) : `contexte`, `objectif`, `role`, `choix`, `difficultes`, `resultats`. Une clé absente affiche le Lorem Ipsum. `preuves` est généré depuis `images` + `links`, et `competences` depuis `acs`. La page Compétences relie automatiquement chaque AC aux projets qui la citent.

Champs en plus : `video` par projet (boucle muette lue seulement quand elle est visible), `PROFILE.roles` (phrases tapées dans le hero), `PROFILE.email` (bouton « M'écrire » si rempli), `PASSIONS`.

## Direction artistique « Tempo » (à respecter)
- Concept : la musique et le sport, deux histoires de rythme. Hero bleu cobalt avec « Nathan Billaud » en Antonio 600 (majuscules) qui se dessine trait par trait (texte SVG, contour animé puis remplissage ; une ligne sur ordinateur, deux sous 600px), phrase tapée rapidement, onde audio réactive au curseur. Boîte à rythmes jouable (Web Audio) dans « Hors du code ».
- Couleurs : fond froid `#f6f7fb`, encre `#0f1330`, **un seul accent : cobalt `#2337d8`** (+ teinte douce `#dfe3ff`). En-tête légèrement bleuté `#eceff9` en clair (fond inchangé). Thème sombre anthracite (`#1c1c21`, cartes `#27272e`), hero bleu ardoise `#2b2f5c` avec texte blanc `#f4f5ff`.
- Polices (équivalents libres de bepatrickdavid.com) : Antonio (600 pour le nom et les titres de page, 700 pour les titres de projets, 500 pour les titres moyens) pour les grands titres en majuscules (≈ Tusker Grotesk), General Sans pour le texte et l'interface (≈ Neue Montreal), Boska italique pour la phrase tapée, les intros et les chapeaux (≈ Migra).
- Une seule animation au chargement (lettres du nom + onde). Le reste du mouvement répond à une action (survol, clic).
- Interdits : fond crème + serif + accent orange, labels en majuscules espacées, police monospace pour les labels, séparateurs « · », flèches « → » ajoutées aux liens, numérotation décorative, texte en dégradé, lueurs néon, glassmorphism, emojis.
- Accessibilité : focus visible, `prefers-reduced-motion` (pas d'animation, vidéos avec contrôles), contraste AA, responsive jusqu'à 360px.

## Version musicale (racine, ex-`v2/`, 2026-11-22)
- Copie adaptée de `ondes-portfolio/` (démo d'un camarade, laissée intacte) : écran noir, nappe d'ondes 3D, musique générée (Tone.js + smplr), 5 genres : Accueil ambient, Présentation jazz (+ contact), Projets house, Expériences soul/funk, Compétences boom bap. Sa propre DA (`ondes-portfolio/docs/design/DA.md`), pas « Tempo ».
- Contenu lu depuis `data.js` via `content.js` (adaptateur, ne rien y écrire). Les pistes Projets ouvrent `simple/#/projets/<slug>`.
- Décidé par Nathan le 2026-11-22 : genres de la démo ; passions dans la Présentation ; contact = e-mail, GitHub, LinkedIn (`PROFILE.email`, `PROFILE.linkedin`) ; dossier `v2/` sans lien depuis le site classique ; HTML statique, pas d'Astro.
- Délégué : lieu affiché « Limoges », accroche composée depuis `PROFILE.roles` et `PROFILE.intro`.
- Décidé par Nathan le 2026-11-23 : rock retiré ; section Contact supprimée, e-mail et liens déplacés dans la Présentation ; le soul/funk passe sur Expériences ; crédits de bas de page retirés (licences dans `LICENCES.md`). Le code du rock reste dans `js/audio.js`, inutilisé.
- Décidé par Nathan le 2026-11-24 : section Accueil retirée ; la Présentation devient la première section, avec la couleur et la musique ambient (le nom et l'accroche en haut, puis le texte et le contact). Le jazz est retiré des genres (4 genres : ambient, house, soul/funk, boom bap) ; son code reste dans `js/audio.js`, inutilisé. Les indices `data-genre`, `.section[data-genre]` et `reveal(i)` suivent l'ordre de `GENRES`.
- Décidé par Nathan le 2026-11-24 (suite) : la Présentation tient sur le premier écran. Nom, accroche, puis le lieu « Limoges » ; dessous, petit titre « Présentation » et citation (même police et taille que l'accroche, lignes jusqu'à 68ch). Liens LinkedIn, GitHub et e-mail sur la ligne du nom, à droite, derrière un trait vertical de la hauteur du nom (sous le texte, trait horizontal, sous 1024px) (même format, icône + adresse courte ; icônes dans `js/ui.js`, crédits dans `LICENCES.md`). Phrase « Étudiant en BUT Informatique » retirée. Réglage `max-height: 760px` pour les portables peu hauts.
- Son (2026-11-23) : le contexte audio est forcé à 48 kHz (`js/audio.js`, `start`). À 96 kHz (carte son de Nathan), le moteur calculait à 0,45× le temps réel et la sortie restait muette. Ne pas utiliser de nœud Tone à AudioWorklet (PluckSynth, Freeverb, JCReverb, BitCrusher) : la guitare soul est un `T.Synth`. Un volume enregistré à 0 est ignoré au démarrage. `navigator.audioSession` seulement sur mobile.
- Décidé par Nathan le 2026-11-24 (accueil) : la version musicale est l'adresse principale (racine) et la version simple est à `/simple/`, accessible par le lien « Voir la version simple » de l'écran d'entrée (`TEXTES_V2.entree.simple`).
- Décidé par Nathan le 2026-11-24 (Expériences) : nom de l'entreprise à la taille d'un titre de projet (40 px, 28 px sur mobile, `word-spacing` pour aérer la police épaisse) ; tous les titres alignés (plus d'escalier) ; texte ramené sous le titre (colonnes 4 à 11). Frise à gauche : un point par expérience à la hauteur du titre, la date en couleur à côté, le rôle dessous, un trait vertical d'un point au suivant. `text` d'une expérience peut être une liste (affichée en puces, sur les deux versions). Seul le grand titre « Expériences » s'anime, le reste apparaît directement.
- Décidé par Nathan le 2026-11-25 (écran d'entrée) : nom en grand au centre, étiquette dessous (`TEXTES_V2.entree.etiquette`), puis trois vinyles centrés dont le centre tourne en continu : rouge « Entrer », bleu (haut-parleur barré) pour entrer sans le son, jaune « Simple » vers `simple/`. Au survol (ou au focus clavier), le disque s'entoure d'une ligne blanche et sa phrase glisse à droite (`note`, `sansSon`, `simple`). Sur mobile ou écran tactile, disques en colonne et phrases toujours visibles. Le contour du disque rouge sert de jauge de chargement (`--p`, `js/main.js`).

## Reprendre le projet
- Lancer en local : `python -m http.server 5500` à la racine (configuration `portfolio` dans `.claude/launch.json`), puis ouvrir `http://localhost:5500/` (version musicale) et `http://localhost:5500/simple/`.
- Après une modification, recharger sans cache (Ctrl+F5) : le navigateur garde volontiers l'ancien `styles.css` ou `data.js`.
- Commiter et pousser sur `main` uniquement quand Nathan le demande ; c'est ce qui met le site en ligne (GitHub Pages, une à deux minutes).
