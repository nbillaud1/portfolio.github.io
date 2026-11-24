// Contenu de démonstration GÉNÉRIQUE : remplace tout par le tien.
//
// Règles de forme (lues par js/ui.js) :
// - presentation.accroche : 1re phrase = « Métier, rôle, rôle. » (découpée aux virgules :
//   l'Accueil affiche les rôles + « à <lieu> », la Présentation affiche le métier) ;
//   les phrases suivantes deviennent la citation de la Présentation.
// - presentation.faits : pointe vers des faits de projets (id du projet + index du fait).
// - projets[].liens[0] : le lien ouvert au clic sur la piste.

export const content = {
  source: { nom: 'contenu générique', lu: 'à remplacer' },

  // Présentation (jazz, or)
  presentation: {
    nom: 'Prénom Nom',
    accroche: "Étudiant en BUT Informatique, développeur web et passionné de musique. Ici, une phrase sur ce qui te fait vibrer aujourd'hui : le domaine que tu creuses, le genre de projets que tu veux faire.",
    lieu: '[Ville]',
    faits: [{ projet: 'alpha', fait: 0 }, { projet: 'beta', fait: 0 }],
  },

  // Projets (house, vert acide) : 6 pistes, la première est la plus importante.
  projets: [
    {
      id: 'alpha',
      titre: 'Projet Alpha',
      line: "Une application web : en une phrase, ce qu'elle fait, pour qui, et ce qu'elle a de particulier.",
      faits: [
        { texte: 'Un fait concret et vérifiable sur ce projet : un chiffre, une contrainte, un choix technique.' },
        { texte: 'Un second fait : ce que tu as appris ou ce dont tu es le plus fier.' },
      ],
      stack: 'Technos principales',
      role: 'Ton rôle : seul, en équipe, ce que tu as fait toi-même.',
      kinds: ['Web'],
      liens: [{ type: 'démo', url: '#' }],
    },
    {
      id: 'beta',
      titre: 'Projet Bêta',
      line: "Un projet autour de la musique : un lecteur, un visualiseur, un outil pour musiciens… Décris-le en une phrase.",
      faits: [
        { texte: 'Un fait concret : ce qui rend ce projet unique.' },
        { texte: 'Un second fait concret.' },
      ],
      stack: 'Technos principales',
      role: 'Ton rôle sur le projet.',
      kinds: ['Audio', 'Web'],
      liens: [{ type: 'dépôt', url: '#' }],
    },
    {
      id: 'gamma',
      titre: 'Projet Gamma',
      line: 'Un jeu dans le navigateur : le principe en une phrase, ce que fait le joueur et pourquoi on y revient.',
      faits: [{ texte: 'Un fait concret.' }, { texte: 'Un second fait concret.' }],
      stack: 'Technos principales',
      role: 'Ton rôle sur le projet.',
      kinds: ['Jeux', 'Web'],
      liens: [{ type: 'démo', url: '#' }],
    },
    {
      id: 'delta',
      titre: 'Projet Delta',
      line: 'Un outil du quotidien : le problème qu’il règle, pour qui, et comment.',
      faits: [{ texte: 'Un fait concret.' }, { texte: 'Un second fait concret.' }],
      stack: 'Technos principales',
      role: 'Ton rôle sur le projet.',
      kinds: ['Outils'],
      liens: [{ type: 'dépôt', url: '#' }],
    },
    {
      id: 'epsilon',
      titre: 'Projet Epsilon',
      line: 'Une API ou un back-end : ce qu’il expose, à qui il sert, et le point technique dont tu es fier.',
      faits: [{ texte: 'Un fait concret.' }, { texte: 'Un second fait concret.' }],
      stack: 'Technos principales',
      role: 'Ton rôle sur le projet.',
      kinds: ['Back-end'],
      liens: [{ type: 'dépôt', url: '#' }],
    },
    {
      id: 'zeta',
      titre: 'Projet Zêta',
      line: 'Une application mobile ou un projet data : une phrase qui donne envie de cliquer.',
      faits: [{ texte: 'Un fait concret.' }, { texte: 'Un second fait concret.' }],
      stack: 'Technos principales',
      role: 'Ton rôle sur le projet.',
      kinds: ['Mobile'],
      liens: [{ type: 'démo', url: '#' }],
    },
  ],

  // Expériences (rock, rouge) : stage, projets perso ou asso, puis les SAÉ.
  experiences: [
    {
      id: 'stage',
      titre: 'Stage en entreprise',
      meta: 'Stage de 10 semaines · Technos',
      line: 'Le contexte de ton stage, ta mission et ce que tu as livré, en une ou deux phrases.',
    },
    {
      id: 'perso',
      titre: 'Projet perso ou association',
      meta: 'Rôle · Technos',
      line: 'Un engagement en dehors des cours : ce que tu y fais et ce que ça t’apporte.',
    },
    {
      id: 'sae3',
      titre: 'SAÉ de BUT3',
      meta: 'BUT3 · Technos',
      line: 'Le sujet, la taille de l’équipe et ta part du travail.',
    },
    {
      id: 'sae2',
      titre: 'SAÉ de BUT2',
      meta: 'BUT2 · Technos',
      line: 'Le sujet, la taille de l’équipe et ta part du travail.',
    },
    {
      id: 'sae1',
      titre: 'SAÉ de BUT1',
      meta: 'BUT1 · Technos',
      line: 'Le sujet, la taille de l’équipe et ta part du travail.',
    },
  ],

  // Compétences (hip-hop boom bap, violet) : référentiel du BUT Informatique, parcours A.
  // `niveau` sur `max` niveaux officiels : valeurs d'exemple, à mettre aux tiennes.
  competences: {
    liste: [
      { id: 'C1', court: 'Réaliser', intitule: "Réaliser un développement d'application", definition: 'Concevoir, coder, tester et intégrer une solution pour un client.', niveau: 3, max: 3 },
      { id: 'C2', court: 'Optimiser', intitule: 'Optimiser des applications', definition: "Rendre une application plus efficace selon des critères : temps d'exécution, précision, ressources.", niveau: 2, max: 3 },
      { id: 'C3', court: 'Administrer', intitule: 'Administrer des systèmes informatiques communicants complexes', definition: 'Installer, configurer, mettre à disposition et maintenir des infrastructures, des services et des réseaux.', niveau: 2, max: 2 },
      { id: 'C4', court: 'Gérer', intitule: "Gérer des données de l'information", definition: "Concevoir, gérer, administrer et exploiter les données d'une organisation.", niveau: 2, max: 2 },
      { id: 'C5', court: 'Conduire', intitule: 'Conduire un projet', definition: 'Répondre aux besoins des utilisateurs, organiser et piloter un projet, avec des méthodes classiques ou agiles.', niveau: 2, max: 2 },
      { id: 'C6', court: 'Collaborer', intitule: "Collaborer au sein d'une équipe informatique", definition: 'Acquérir et exploiter les aptitudes pour travailler en équipe informatique.', niveau: 2, max: 3 },
    ],
    // Technos les plus présentes : nombre de projets qui les citent (exemple).
    technos: [
      { nom: 'JavaScript', n: 5 },
      { nom: 'TypeScript', n: 3 },
      { nom: 'Python', n: 3 },
      { nom: 'Vue', n: 2 },
      { nom: 'Java', n: 2 },
      { nom: 'SQL', n: 2 },
      { nom: 'Three.js', n: 1 },
      { nom: 'Web Audio', n: 1 },
      { nom: 'Docker', n: 1 },
    ],
  },

  // Contact (soul/funk, orange chaud)
  contact: {
    email: { texte: 'prenom.nom@exemple.fr', url: 'mailto:prenom.nom@exemple.fr' },
    github: { texte: 'github.com/ton-pseudo', url: 'https://github.com/' },
    linkedin: { texte: 'linkedin.com/in/prenom-nom', url: 'https://www.linkedin.com/' },
  },
};
