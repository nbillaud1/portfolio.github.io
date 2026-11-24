// Adaptateur : la version musicale lit le même contenu que le site classique (../data.js, chargé avant ce module).
// Ne rien écrire ici : les textes se modifient dans data.js.
/* global PROFILE, EXPERIENCES, PROJECTS, COMPETENCES */

const TODO = 'À compléter';
const sansPoint = (s) => s.replace(/\.$/, '');
const finPhrase = (s) => (/[.!?]$/.test(s) ? s : s + '.');

// Format attendu par js/ui.js : « Métier, rôle, rôle. Phrases de la citation… »
const roles = PROFILE.roles.slice(0, 2).map(sansPoint).join(', ');

const technos = {};
PROJECTS.forEach((p) => p.stack.filter((t) => t !== TODO).forEach((t) => { technos[t] = (technos[t] || 0) + 1; }));

export const content = {
  presentation: {
    nom: PROFILE.name,
    accroche: `Étudiant en BUT Informatique, ${roles}. ${finPhrase(PROFILE.intro)} En dehors du code : la musique et le sport.`,
    lieu: 'Limoges',
    faits: [],
  },

  // Chaque piste ouvre la page détaillée du projet sur le site classique.
  projets: PROJECTS.map((p) => ({
    id: p.slug,
    titre: p.title,
    line: p.tagline,
    faits: [],
    kinds: [p.kind],
    liens: [{ type: 'détails', url: `../index.html#/projets/${p.slug}` }],
  })),

  experiences: EXPERIENCES.map((e) => ({
    titre: e.org,
    meta: `${e.role} · ${e.period}`,
    line: e.text,
  })),

  competences: {
    liste: COMPETENCES.map((c, i) => ({
      id: `C${i + 1}`,
      court: c.name,
      intitule: c.desc,
      definition: `Niveau : ${c.level}.`,
    })),
    technos: Object.entries(technos).sort((a, b) => b[1] - a[1]).map(([nom, n]) => ({ nom, n })),
  },

  // Champs facultatifs : un champ absent (ou un data.js resté en cache) ne doit pas bloquer toute la page.
  contact: {
    email: { texte: PROFILE.email || '', url: PROFILE.email ? `mailto:${PROFILE.email}` : '#' },
    github: { texte: (PROFILE.github || '').replace('https://', ''), url: PROFILE.github || '#' },
    linkedin: { texte: (PROFILE.linkedin || '').replace('https://www.', ''), url: PROFILE.linkedin || '#' },
  },
};
