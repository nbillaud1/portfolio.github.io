# Portfolio — Nathan Billaud

Site statique en HTML/CSS/JS, sans framework ni build, hébergé sur GitHub Pages (`nbillaud1/nbillaud1.github.io`, branche `main`). Pousser sur `main` met le site en ligne.

## Structure
- `data.js` : **tous les textes**, y compris titres, boutons et menus (`TEXTES` pour le site classique, `TEXTES_V2` pour `v2/`), plus profil, expériences, projets, référentiel. Aucun texte visible en dur dans `index.html`, `script.js` ou `v2/` (seuls les `aria-label`, la balise `<title>`/meta description d'origine et les noms de genres musicaux restent dans le code). Ne rien recomposer à partir des textes : les afficher tels quels.
- `script.js` : routeur par hash (`#/`, `#/projets`, `#/projets/<slug>`, `#/competences`, `#/competences/<AC>`) et rendu des pages par templates.
- `style.css` : tokens de couleurs sur `:root`, thème sombre via `prefers-color-scheme` et `[data-theme]`.
- `assets/projets/<slug>/` : captures d'écran, référencées dans `images` de chaque projet.

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

## Version musicale (`v2/`, 2026-11-22)
- Copie adaptée de `ondes-portfolio/` (démo d'un camarade, laissée intacte) : écran noir, nappe d'ondes 3D, musique générée (Tone.js + smplr), 5 genres : Accueil ambient, Présentation jazz (+ contact), Projets house, Expériences soul/funk, Compétences boom bap. Sa propre DA (`ondes-portfolio/docs/design/DA.md`), pas « Tempo ».
- Contenu lu depuis `../data.js` via `v2/content.js` (adaptateur, ne rien y écrire). Les pistes Projets ouvrent `index.html#/projets/<slug>`.
- Décidé par Nathan le 2026-11-22 : genres de la démo ; passions dans la Présentation ; contact = e-mail, GitHub, LinkedIn (`PROFILE.email`, `PROFILE.linkedin`) ; dossier `v2/` sans lien depuis le site classique ; HTML statique, pas d'Astro.
- Délégué : lieu affiché « Limoges », accroche composée depuis `PROFILE.roles` et `PROFILE.intro`.
- Décidé par Nathan le 2026-11-23 : rock retiré ; section Contact supprimée, e-mail et liens déplacés dans la Présentation ; le soul/funk passe sur Expériences ; crédits de bas de page retirés (licences dans `v2/LICENCES.md`). Le code du rock reste dans `v2/js/audio.js`, inutilisé.
- Décidé par Nathan le 2026-11-24 : section Accueil retirée ; la Présentation devient la première section, avec la couleur et la musique ambient (le nom et l'accroche en haut, puis le texte et le contact). Le jazz est retiré des genres (4 genres : ambient, house, soul/funk, boom bap) ; son code reste dans `v2/js/audio.js`, inutilisé. Les indices `data-genre`, `.section[data-genre]` et `reveal(i)` suivent l'ordre de `GENRES`.
- Son (2026-11-23) : le contexte audio est forcé à 48 kHz (`v2/js/audio.js`, `start`). À 96 kHz (carte son de Nathan), le moteur calculait à 0,45× le temps réel et la sortie restait muette. Ne pas utiliser de nœud Tone à AudioWorklet (PluckSynth, Freeverb, JCReverb, BitCrusher) : la guitare soul est un `T.Synth`. Un volume enregistré à 0 est ignoré au démarrage. `navigator.audioSession` seulement sur mobile.
