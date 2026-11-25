// Les quatre ambiances (rock retiré le 2026-11-23 ; jazz retiré le 2026-11-24, la Présentation prend l'ambient) : paramètres visuels (docs/design/DA.md §2.4) et repères musicaux (docs/design/AUDIO.md §2).
// Les valeurs sont des valeurs de départ, à régler à l'œil et à l'oreille.

// Noms des sections (platine, lecteur) : TEXTES_V2.sections dans data.js
const S = TEXTES_V2.sections; // eslint-disable-line no-undef
const deg = (d) => (d * Math.PI) / 180;

export const GENRES = [
  {
    key: 'ambient', num: '01', section: S.presentation, id: 'presentation', label: 'Ambient', bpm: 64, swing: 0.5,
    palette: { bg: '#030507', line: '#7FA8C9', accent: '#E6F2FA', glow: '#1D4466' },
    vis: {
      active: 160, A: 0.55, lambda: 14, v: 0.05, angles: [0, 20, -15], travel: 0.35, turb: 0.08, S: 0.15,
      width: 1.1, horizon: 0.45, base: 0.35, fade: [6, 40], rock: 0, step: 0, spring: 0, pump: 0,
      bloom: [1.5, 0.8, 0.55], grain: 0.06, vignette: 0.7,
      kB: 0.6, kL: 0.08, kM: 0.3, scint: 0.1, scintRate: 8.3,
      ring: { c: 3, lr: 4, dec: 0.4, force: 0.4 },
    },
    cam: { pos: [0, 2.2, 7.5], look: [0, 0.4, -14], fov: 38, roll: 0 },
  },
  {
    key: 'house', num: '02', section: S.projets, id: 'projets', label: 'House', bpm: 124, swing: 0.54,
    palette: { bg: '#020602', line: '#B4FF1F', accent: '#F3FFD1', glow: '#2A6B00' },
    vis: {
      active: 160, A: 0.45, lambda: 3.2, v: 0.26, angles: [0, 90, 0], travel: 2.2, turb: 0.05, S: 0.25,
      width: 1.8, horizon: 0.5, base: 0.3, fade: [10, 44], rock: 0, step: 0, spring: 0, pump: 1,
      bloom: [2.0, 0.6, 0.45], grain: 0.05, vignette: 0.62,
      kB: 1.4, kL: 0.05, kM: 0.5, scint: 0.45, scintRate: 16,
      ring: { c: 14, lr: 1.6, dec: 2.2, force: 0.8 },
    },
    cam: { pos: [0, 3.6, 5.5], look: [0, 0, -10], fov: 46, roll: 0 },
  },
  {
    key: 'soul', num: '03', section: S.experiences, id: 'experiences', label: 'Soul / funk', bpm: 104, swing: 0.54,
    palette: { bg: '#0A0502', line: '#FF8A26', accent: '#FFE2B3', glow: '#8E3208' },
    vis: {
      active: 128, A: 0.75, lambda: 4.2, v: 0.21, angles: [15, -25, 60], travel: 1.2, turb: 0.15, S: 0.4,
      width: 1.7, horizon: 0.45, base: 0.42, fade: [7, 38], rock: 0, step: 0, spring: 1, pump: 0,
      bloom: [2.0, 0.9, 0.5], grain: 0.09, vignette: 0.62,
      kB: 1.0, kL: 0.08, kM: 0.8, scint: 0.2, scintRate: 9,
      ring: { c: 8, lr: 2, dec: 1.2, force: 0.8 },
    },
    cam: { pos: [-1.5, 2.6, 6.8], look: [0, 0.2, -9], fov: 40, roll: 0 },
  },
  {
    key: 'boombap', num: '04', section: S.competences, id: 'competences', label: 'Boom bap', bpm: 88, swing: 0.58,
    palette: { bg: '#06030B', line: '#9F72FF', accent: '#F2E6CF', glow: '#3E2385' },
    vis: {
      active: 80, A: 0.8, lambda: 5.0, v: 0.18, angles: [0, 0, 45], travel: 0.9, turb: 0.22, S: 0.6,
      width: 1.5, horizon: 0.45, base: 0.38, fade: [6, 34], rock: 0, step: 1, spring: 0, pump: 0,
      bloom: [1.5, 0.55, 0.6], grain: 0.16, vignette: 0.62,
      kB: 1.1, kL: 0.1, kM: 0.6, scint: 0.3, scintRate: 9,
      ring: { c: 4, lr: 6, dec: 0.7, force: 1 },
    },
    cam: { pos: [2.6, 2.0, 6.0], look: [-0.8, 0.3, -11], fov: 36, roll: 0 },
  },
];

export const GENRE_INDEX = Object.fromEntries(GENRES.map((g, i) => [g.key, i]));

// Direction unitaire d'une houle : angle 0 = la houle avance vers la caméra (axe z).
export function swellDir(angleDeg) {
  const a = deg(angleDeg);
  return [Math.sin(a), Math.cos(a)];
}

// ----- Couleurs : hex sRGB → OKLCH (DA §3.2, interpolation perceptive) -----
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function hexToOklch(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = srgbToLinear(((n >> 16) & 255) / 255);
  const g = srgbToLinear(((n >> 8) & 255) / 255);
  const b = srgbToLinear((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [L, C, h];
}

export function oklchToHex([L, C, h]) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return '#' + lin.map((c) => {
    c = Math.min(1, Math.max(0, c));
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(v * 255).toString(16).padStart(2, '0');
  }).join('');
}

// Mélange OKLCH : L et C linéaires, teinte par le plus court arc.
export function mixOklch(a, b, t, out = [0, 0, 0]) {
  let dh = ((b[2] - a[2] + 540) % 360) - 180;
  if (a[1] < 0.002) dh = 0; // gris : on garde la teinte de l'autre côté
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = (a[2] + dh * t + 360) % 360;
  if (a[1] < 0.002) out[2] = b[2];
  return out;
}

// Palettes pré-calculées en OKLCH.
for (const g of GENRES) {
  g.oklch = {
    bg: hexToOklch(g.palette.bg),
    line: hexToOklch(g.palette.line),
    accent: hexToOklch(g.palette.accent),
    glow: hexToOklch(g.palette.glow),
  };
}
