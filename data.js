// Contenu du portfolio : c'est le seul fichier à modifier pour mettre à jour les textes.
// Une section de projet absente de `sections` affiche un Lorem Ipsum.

const LOREM = [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
];

const PROFILE = {
    name: "Nathan Billaud",
    status: "BUT Informatique · 3ᵉ année",
    school: "IUT de Limoges",
    intro: "Actuellement à la recherche d'un stage entre Février et Juin 2027, je peux m'intégrer à votre entreprise afin de développer des services facilitant votre quotidien (sites web, applications, etc.)",
    github: "https://github.com/nbillaud1",
    email: "natbildev@gmail.com", // affiche un bouton « M'écrire » si rempli
    linkedin: "https://www.linkedin.com/in/nathan-billaud1/",
    // Phrases tapées automatiquement sous le nom : « Je suis … »
    roles: [
        "développeur web.",
        "développeur mobile.",
        "étudiant en BUT Informatique.",
        "musicien à mes heures.",
        "sportif le reste du temps."
    ]
};

const PASSIONS = {
    music: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    sport: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    sportImage: null // { src: "assets/passions/sport.jpg", alt: "…" }
};

const EXPERIENCES = [
    {
        period: "À compléter",
        role: "Stage développeur",
        org: "SNCF",
        text: LOREM[0]
    }
];

// video : "assets/projets/latice/demo.mp4" (courte boucle muette, ~10 s, idéalement < 3 Mo)
// images : [{ src: "assets/projets/latice/1.png", alt: "Plateau de jeu en cours de partie" }]
// acs : codes du référentiel ci-dessous. Ceux marqués « à valider » sont provisoires.
const PROJECTS = [
    {
        slug: "brick-breaker",
        title: "Brick Breaker",
        tagline: "Lorem ipsum dolor sit amet, casse-briques.",
        kind: "À compléter",
        year: "À compléter",
        team: "À compléter",
        stack: ["À compléter"],
        acs: ["AC11.01", "AC12.01"], // à valider
        links: [],
        images: []
    },
    {
        slug: "latice",
        title: "Latice",
        tagline: "Jeu de plateau entre Scrabble et Dominos.",
        kind: "Projet universitaire",
        year: "À compléter",
        team: "Équipe",
        stack: ["Java", "JavaFX", "Scene Builder"],
        acs: ["AC25.04", "AC21.04", "AC11.04"],
        links: [{ label: "Code sur GitHub", url: "https://github.com/nbillaud1/latice" }],
        images: []
    },
    {
        slug: "nathanapp",
        title: "NathanApp",
        tagline: "Application mobile multiplateforme.",
        kind: "À compléter",
        year: "À compléter",
        team: "À compléter",
        stack: [".NET MAUI", "C#"],
        acs: ["AC31.01", "AC21.02"], // à valider
        links: [],
        images: []
    },
    {
        slug: "tasklist-app",
        title: "TaskListApp",
        tagline: "Lorem ipsum dolor sit amet, gestion de tâches.",
        kind: "À compléter",
        year: "À compléter",
        team: "À compléter",
        stack: ["À compléter"],
        acs: ["AC21.03", "AC11.04"], // à valider
        links: [],
        images: []
    },
    {
        slug: "ssbutips",
        title: "SSBUTips",
        tagline: "Site d'astuces Smash Bros. Ultimate, fusionné avec « citelestous ».",
        kind: "Projet personnel",
        year: "À compléter",
        team: "À compléter",
        stack: ["Web"],
        acs: ["AC31.02", "AC31.03"], // à valider
        links: [],
        images: []
    },
    {
        slug: "landing-pages",
        title: "Landing pages",
        tagline: "Lorem ipsum dolor sit amet, pages d'atterrissage.",
        kind: "À compléter",
        year: "À compléter",
        team: "À compléter",
        stack: ["HTML", "CSS"],
        acs: ["AC21.02", "AC11.04"], // à valider
        links: [],
        images: []
    },
    {
        slug: "sae-erp",
        title: "ERP IUT",
        tagline: "Gestion des fiches ressources pour les IUT.",
        kind: "SAE",
        year: "À compléter",
        team: "Équipe",
        stack: ["Vue.js", "Spring Boot", "Figma"],
        acs: ["AC21.02", "AC24.03", "AC25.02"],
        links: [{ label: "Code sur GitHub", url: "https://github.com/nbillaud1/sae_erp" }],
        images: []
    }
];

const COMPETENCES = [
    {
        id: "realiser",
        name: "Réaliser",
        level: "Maîtrise avancée",
        desc: "Développer une solution informatique pour un client.",
        levels: [
            { title: "Développer des applications simples", acs: [
                ["AC11.01", "Implémenter des conceptions simples"],
                ["AC11.02", "Élaborer des conceptions simples"],
                ["AC11.03", "Faire des essais et évaluer leurs résultats en regard des spécifications"],
                ["AC11.04", "Développer des interfaces utilisateurs"]
            ]},
            { title: "Partir des exigences jusqu'à une application complète", acs: [
                ["AC21.01", "Élaborer et implémenter les spécifications fonctionnelles et non fonctionnelles"],
                ["AC21.02", "Appliquer des principes d'accessibilité et d'ergonomie"],
                ["AC21.03", "Adopter de bonnes pratiques de conception et de programmation"],
                ["AC21.04", "Vérifier et valider la qualité de l'application par les tests"]
            ]},
            { title: "Adapter des applications sur un ensemble de supports", acs: [
                ["AC31.01", "Choisir et implémenter les architectures adaptées"],
                ["AC31.02", "Faire évoluer une application existante"],
                ["AC31.03", "Intégrer des solutions dans un environnement de production"]
            ]}
        ]
    },
    {
        id: "optimiser",
        name: "Optimiser",
        level: "Confirmé",
        desc: "Proposer des applications informatiques optimisées.",
        levels: [
            { title: "Appréhender et construire des algorithmes", acs: [
                ["AC12.01", "Analyser un problème avec méthode"],
                ["AC12.02", "Comparer des algorithmes pour des problèmes classiques"],
                ["AC12.03", "Formaliser et mettre en œuvre des outils mathématiques pour l'informatique"]
            ]},
            { title: "Sélectionner les algorithmes adéquats", acs: [
                ["AC22.01", "Choisir des structures de données complexes adaptées au problème"],
                ["AC22.02", "Utiliser des techniques algorithmiques adaptées pour des problèmes complexes"],
                ["AC22.03", "Comprendre les enjeux et moyens de sécurisation des données et du code"],
                ["AC22.04", "Évaluer l'impact environnemental et sociétal des solutions proposées"]
            ]},
            { title: "Analyser et optimiser des applications", acs: [
                ["AC32.01", "Anticiper les résultats de diverses métriques (temps d'exécution, mémoire…)"],
                ["AC32.02", "Profiler, analyser et justifier le comportement d'un code existant"],
                ["AC32.03", "Choisir et utiliser des bibliothèques et méthodes dédiées au domaine d'application"]
            ]}
        ]
    },
    {
        id: "administrer",
        name: "Administrer",
        level: "Initié",
        desc: "Installer, configurer et maintenir des infrastructures.",
        levels: [
            { title: "Installer et configurer un poste de travail", acs: [
                ["AC13.01", "Identifier les différents composants (matériels et logiciels) d'un système numérique"],
                ["AC13.02", "Utiliser les fonctionnalités de base d'un système multitâches / multiutilisateurs"],
                ["AC13.03", "Installer et configurer un système d'exploitation et des outils de développement"],
                ["AC13.04", "Configurer un poste de travail dans un réseau d'entreprise"]
            ]},
            { title: "Déployer des services dans une architecture réseau", acs: [
                ["AC23.01", "Concevoir et développer des applications communicantes"],
                ["AC23.02", "Utiliser des serveurs et des services réseaux virtualisés"],
                ["AC23.03", "Sécuriser les services et données d'un système"]
            ]},
            { title: "Faire évoluer et maintenir un système informatique", acs: [
                ["AC33.01", "Créer des processus de traitement automatisé"],
                ["AC33.02", "Configurer un serveur et des services réseaux de manière avancée"],
                ["AC33.03", "Appliquer une politique de sécurité au niveau de l'infrastructure"],
                ["AC33.04", "Déployer et maintenir un réseau d'organisation en fonction de ses besoins"]
            ]}
        ]
    },
    {
        id: "gerer",
        name: "Gérer",
        level: "Confirmé",
        desc: "Concevoir, gérer, administrer et exploiter les données.",
        levels: [
            { title: "Concevoir et mettre en place une base de données", acs: [
                ["AC14.01", "Mettre à jour et interroger une base de données relationnelle"],
                ["AC14.02", "Visualiser des données"],
                ["AC14.03", "Concevoir une base de données relationnelle à partir d'un cahier des charges"]
            ]},
            { title: "Optimiser et interagir avec une application", acs: [
                ["AC24.01", "Optimiser les modèles de données de l'entreprise"],
                ["AC24.02", "Assurer la sécurité des données (intégrité et confidentialité)"],
                ["AC24.03", "Organiser la restitution de données à travers la programmation et la visualisation"],
                ["AC24.04", "Manipuler des données hétérogènes"]
            ]},
            { title: "Administrer et concevoir des systèmes décisionnels", acs: [
                ["AC34.01", "Capturer et stocker des ensembles volumineux et complexes de données hétérogènes"],
                ["AC34.02", "Préparer et extraire les données pour l'exploitation"],
                ["AC34.03", "Appliquer des méthodes d'exploration et d'exploitation des données"],
                ["AC34.04", "Mettre en production et optimiser le système de gestion de données"]
            ]}
        ]
    },
    {
        id: "conduire",
        name: "Conduire",
        level: "Intermédiaire",
        desc: "Organiser et piloter un projet informatique.",
        levels: [
            { title: "Identifier les besoins métiers", acs: [
                ["AC15.01", "Appréhender les besoins du client et de l'utilisateur"],
                ["AC15.02", "Mettre en place les outils de gestion de projet"],
                ["AC15.03", "Identifier les acteurs et les différentes phases d'un cycle de développement"]
            ]},
            { title: "Appliquer une démarche de suivi de projet", acs: [
                ["AC25.01", "Identifier les processus présents dans une organisation"],
                ["AC25.02", "Formaliser les besoins du client et de l'utilisateur"],
                ["AC25.03", "Identifier les critères de faisabilité d'un projet informatique"],
                ["AC25.04", "Définir et mettre en œuvre une démarche de suivi de projet"]
            ]},
            { title: "Participer à la conception d'un SI", acs: [
                ["AC35.01", "Mesurer les impacts économiques, sociétaux et technologiques d'un projet"],
                ["AC35.02", "Savoir intégrer un projet informatique dans le système d'information"],
                ["AC35.03", "Savoir adapter un système d'information"]
            ]}
        ]
    },
    {
        id: "collaborer",
        name: "Collaborer",
        level: "Maîtrise avancée",
        desc: "Travailler efficacement dans une équipe informatique.",
        levels: [
            { title: "Identifier ses aptitudes pour l'équipe", acs: [
                ["AC16.01", "Appréhender l'écosystème numérique"],
                ["AC16.02", "Découvrir les aptitudes requises selon les différents secteurs"],
                ["AC16.03", "Identifier les statuts, les fonctions et les rôles de chaque membre"],
                ["AC16.04", "Acquérir les compétences interpersonnelles pour travailler en équipe"]
            ]},
            { title: "Situer son rôle et ses missions", acs: [
                ["AC26.01", "Comprendre la diversité, la structure et la dimension de l'informatique"],
                ["AC26.02", "Appliquer une démarche pour intégrer une équipe informatique"],
                ["AC26.03", "Mobiliser les compétences interpersonnelles pour travailler en équipe"],
                ["AC26.04", "Rendre compte de son activité professionnelle"]
            ]},
            { title: "Manager une équipe informatique", acs: [
                ["AC36.01", "Organiser et partager une veille technologique et informationnelle"],
                ["AC36.02", "Identifier les enjeux de l'économie de l'innovation numérique"],
                ["AC36.03", "Guider la conduite du changement informatique au sein d'une organisation"],
                ["AC36.04", "Accompagner le management de projet informatique"]
            ]}
        ]
    }
];
