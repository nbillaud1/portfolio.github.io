// Adaptateur : la version musicale lit le même contenu que le site classique (../data.js, chargé avant ce module).
// Ne rien écrire ici : les textes se modifient dans data.js.
/* global PROFILE, EXPERIENCES, PROJECTS, COMPETENCES, TEXTES_V2 */

const TODO = 'À compléter';
const T = TEXTES_V2;

const technos = {};
PROJECTS.forEach((p) => p.stack.filter((t) => t !== TODO).forEach((t) => { technos[t] = (technos[t] || 0) + 1; }));

export const content = {
  textes: T,
  // Textes repris tels quels de TEXTES_V2 (data.js) : rien n'est recomposé ici.
  presentation: {
    nom: PROFILE.name,
    accroche: T.presentation.accroche,
    citation: T.presentation.citation,
    lieu: T.presentation.lieu,
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
      definition: `${T.competences.niveau} : ${c.level}.`,
    })),
    technos: Object.entries(technos).sort((a, b) => b[1] - a[1]).map(([nom, n]) => ({ nom, n })),
  },

  // Champs facultatifs : un champ absent (ou un data.js resté en cache) ne doit pas bloquer toute la page.
  contact: {
    email: { texte: PROFILE.email || '', url: PROFILE.email ? `mailto:${PROFILE.email}` : '#' },
    github: { texte: (PROFILE.github || '').replace('https://', ''), url: PROFILE.github || '#' },
    linkedin: { texte: (PROFILE.linkedin || '').replace('https://www.', '').replace(/\/$/, ''), url: PROFILE.linkedin || '#' },
  },
};
