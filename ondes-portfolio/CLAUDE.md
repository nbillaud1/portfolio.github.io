# Portfolio ondes

Portfolio « musical » d'une page : écran noir, nappe d'ondes 3D lumineuse qui réagit au son, une section = un genre musical, fondus audio et visuels entre les genres. Taille : moyenne. Flux : logiciel avec interface.
Fiche : `docs/FICHE.md` (proposition reçue, **à valider par toi**). Maquette : la démo jouable à la racine (`index.html`), pas encore validée par toi.
Langue : français, tutoiement, court et simple.

## Origine
Démo de concept reçue toute faite d'un camarade de promo, construite avec Claude Code et la méthode Diapason. Le contenu est **générique** (`content.js`) : à remplacer par le tien. Rien n'est en ligne.

## Contraintes
- Budget zéro. Pas de publication, de compte ni de `git push` sans accord.
- Son : partition générée en direct, instruments = samples libres (domaine public / CC0, via smplr, chargés depuis son CDN) + synthé Tone.js ; aucun morceau protégé ; licence de chaque banque notée (`LICENCES.md`).
- Rien d'inventé sur toi : ton vrai contenu vient de toi.

## Décisions (reçues avec la démo, à reconfirmer)
- Genres : Accueil ambient · Présentation jazz (or) · Projets house (vert acide) · Expériences rock (rouge) · Compétences hip-hop boom bap (violet) · Contact soul/funk (orange chaud).
- Navigation : scroll + platine (menu disque en bas à droite, touches 1 à 6). Ordi d'abord, mobile allégé.
- « Mode lecture » : la nappe est pleine en début de section et à l'arrivée de la suivante ; pendant la lecture, voile noir + nappe atténuée en horizon bas, pour que le texte se lise (`js/main.js` readingCalm, `js/scene.js` setCalm, `.voile` dans `styles.css`).
- Cible finale envisagée : portage Astro (jalon J1), même librairies (`package.json`).

## Lancer la démo
Depuis ce dossier : `python3 -m http.server 4410 --bind 127.0.0.1`, puis http://127.0.0.1:4410/ (les modules ES ne marchent pas en `file://`). Les librairies sont déjà copiées dans `vendor/` : pas de `npm install` pour la démo. Les samples audio se chargent depuis le CDN de smplr (connexion nécessaire pour le son).
