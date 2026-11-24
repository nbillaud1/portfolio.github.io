# Fiche projet : Portfolio ondes

Statut : brouillon (proposition reçue avec la démo, à valider par toi) · Dernière modification : 2026-11-22
Une page, en mots simples. Rien n'est construit de nouveau avant ta validation.

## 1. Pourquoi
- Objectif : un portfolio spectaculaire qui te ressemble : écran noir, ondes 3D lumineuses qui réagissent au son, chaque section = un genre musical, fondus audio et transitions visuelles entre genres.
- Pour qui : recruteurs, maîtres de stage, la promo.
- Critères de réussite :
  1. On arrive sur un écran noir ; un clic « Entrer » lance le son et la nappe d'ondes s'allume en moins de 3 s.
  2. Le scroll (ou la platine) fait passer par les 6 ambiances ; à chaque passage, fondu audio d'environ 2 s et changement de couleur et de mouvement de la nappe, sans coupure ni silence.
  3. La nappe réagit visiblement au son (basses = amplitude, aigus = scintillement), mesuré par l'analyse du son, pas simulé.
  4. Le texte se lit sans effort : la nappe passe en retrait pendant la lecture.
  5. Fluide sur un ordinateur récent (~60 images/s) ; sur mobile, version allégée lisible ; le son se coupe à tout moment.

## 2. Quoi
- Forme et plateforme : site web d'une page, ordinateur d'abord ; mobile en version allégée qui fonctionne.
- Fonctions du MVP : accueil noir puis 5 sections (Présentation, Projets, Expériences, Compétences, Contact), chacune un genre ; ondes 3D qui réagissent au son ; fondus audio et transitions visuelles ; contrôle du son (couper, volume, pause, genre en cours) ; musique jouée en direct par une partition générée : vrais instruments enregistrés libres (piano domaine public, contrebasse et percussions CC0, via smplr) + synthé (Tone.js).
- À faire en premier : remplacer le contenu générique (`content.js`, nom dans `index.html`) par le tien.
- Plus tard : ondes qui réagissent à ta propre musique (fichier ou micro).
- Hors périmètre : vrais morceaux protégés, samples sous licence non libre (ex. BY-NC).

## 3. Comment
- Démo actuelle : page HTML statique + librairies copiées dans `vendor/` (aucune installation).
- Cible envisagée : Astro + Three.js 0.186.1 + postprocessing 6.39.6 (bloom) + Tone.js 15.1.22 + smplr 1.2.0 + GSAP 3.15.1 + Lenis 1.3.27 (+ troika-three-text 0.53.1, non utilisé par la démo) ; polices Fraunces et Bricolage Grotesque (OFL). Liste exacte : `package.json`.
- Style visuel : fond noir ; nappe d'ondes faite de lignes lumineuses, survolée par la caméra ; couleur et mouvement = genre en cours. Détails : `docs/design/DA.md`. Système audio : `docs/design/AUDIO.md`. Choix des librairies : `docs/research/01-librairies-premium.md`.
- Contraintes : budget zéro ; le son ne démarre qu'après un clic (règle des navigateurs) ; navigation au scroll + menu « platine ».

## 4. Décisions (à reconfirmer par toi)
| Sujet | Choix proposé | Décidé par toi le… |
|---|---|---|
| Concept | Écran noir + ondes 3D sonores, une section = un genre | à valider |
| Son | Samples libres + synthé, généré en direct | à valider |
| Genres | Ambient / jazz / house / rock / hip-hop boom bap / soul-funk | à valider |
| Sections | Présentation, Projets, Expériences, Compétences, Contact | à valider |
| Technos | Astro + Three.js + Web Audio (démo : HTML statique) | à valider |
| Navigation | Scroll + platine | à valider |
| Écrans | Ordi d'abord, mobile allégé | à valider |

## 5. Suite
- Prochaine étape : valider cette fiche, remplacer le contenu, valider la maquette, puis portage Astro (J1) et test visuel.
- Maquette validée : pas encore.
