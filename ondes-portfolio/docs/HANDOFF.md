# HANDOFF — portfolio ondes

Mis à jour : 2026-11-22
Flux proposé : Cadrage (fiche reçue, à valider) → Maquette (démo jouable reçue, à valider) → J1 portage Astro → Test visuel → Livraison.

## État
- 2026-11-22 : dossier reçu d'un camarade de promo. Démo jouable complète à la racine : `index.html`, `styles.css`, `content.js` (contenu GÉNÉRIQUE), `js/` (main, scene, audio, genres, ui), librairies dans `vendor/`.
- Vérifié chez lui le 2026-11-22 dans un navigateur : entrée, défilement des 6 genres jusqu'au Contact, aucune erreur console ; son non vérifié par écoute.
- Dernier changement : « mode lecture » (nappe en retrait pendant la lecture) après un retour « ondes trop chargées, projets illisibles ».
- Dans `docs/design/*.md`, « maquette/ » désigne la racine de ce dossier, et les chemins `/node_modules/...` correspondent à `vendor/...`.

## Points ouverts (non vérifiés)
- Fluidité (60 images/s) non mesurée ; Safari iOS non testé.
- Licences : la démo n'utilise pas DrumMachine de smplr (licence non prouvée) ; GSAP est sous licence « Standard no-charge » (gratuite, pas open source) ; le reste est MIT, Zlib ou OFL (`LICENCES.md`).
- Genre de Compétences (hip-hop boom bap) : hypothèse.

## Agents lancés
| # | Agent | Modèle | Tâche | État |
|---|---|---|---|---|
| — | aucun dans ce dossier | — | — | — |

## Reprendre
`/diapason <chemin de ce dossier>` ; lire `docs/FICHE.md` (statut brouillon : à valider), puis ce fichier, puis `README.md`.
