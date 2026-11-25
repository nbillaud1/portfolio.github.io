// Point d'entrée : relie le contenu, la nappe (scene.js), le son (audio.js) et l'interface (ui.js).
import { content } from '../content.js';
import { GENRES } from './genres.js';
import { createScene } from './scene.js';
import { createAudio, audioEvents } from './audio.js';
import { createUI, renderContent } from './ui.js';

const mq = (q) => window.matchMedia(q).matches;
const mobile = mq('(max-width: 767px)') || mq('(pointer: coarse)');
const reduced = mq('(prefers-reduced-motion: reduce)');
const { gsap } = window;

const btnEntrer = document.getElementById('btn-entrer');
const btnMuet = document.getElementById('btn-entrer-muet');
const jauge = document.querySelector('.entree-jauge span');

if (!gsap || !window.ScrollTrigger || !window.SplitText || !window.CustomEase) {
  throw new Error('GSAP introuvable : vérifier le dossier vendor/gsap/.');
}

renderContent(content);

// ---------- Nappe ----------
const canvas = document.getElementById('nappe');
let scene = null;
try {
  scene = createScene(canvas, { mobile, reduced });
} catch (err) {
  console.warn('Nappe indisponible, repli sans 3D :', err && err.message);
  scene = null;
}
if (!scene) document.documentElement.classList.add('no-webgl');

// ---------- Son et interface ----------
let ui = null;
const audio = createAudio({ mobile, reduced, onStateChange: (st) => ui && ui.syncPlayer(st) });
let current = 0;
let transEnd = 0;

function goGenre(i, via = 'scroll') {
  if (i === current || i < 0 || i >= GENRES.length) return;
  const dir = i > current ? 1 : -1;
  const dur = via === 'platine' ? 2.4 : 2.0;
  const now = performance.now();
  const interrupt = now < transEnd;
  transEnd = now + dur * 1000;
  current = i;
  if (scene && !scene.lost) scene.transition(i, { dir, duration: dur, interrupt });
  try { audio.goTo(i, via); } catch (err) { console.warn('Changement de genre audio impossible :', err && err.message); }
  ui.setGenre(i, dur);
  document.documentElement.style.setProperty('--g-fond', GENRES[i].palette.bg);
}

ui = createUI({
  mobile, reduced, audio,
  onGenre: goGenre,
  onRing: (x) => scene && scene.interfaceRing(x),
});

audioEvents.on('*', (e) => { if (scene) scene.onEvent(e); });

// ---------- Jauge de préparation (polices + shaders) ----------
let progress = 0;
const steps = 3;
const advance = () => {
  progress++;
  jauge.style.setProperty('--p', Math.min(1, progress / steps));
  if (progress >= steps) { btnEntrer.disabled = false; btnMuet.disabled = false; }
};
const fontsReady = Promise.all([
  document.fonts.load('300 44px "Fraunces Variable"'),
  document.fonts.load('italic 300 44px "Fraunces Variable"'),
  document.fonts.load('400 18px "Bricolage Grotesque Variable"'),
]).catch(() => {});
const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
Promise.race([fontsReady, timeout(4000)]).then(advance);
setTimeout(() => {
  if (scene) scene.warmUp();
  advance();
  setTimeout(advance, 200);
}, 0);

// ---------- Mode lecture ----------
// Nappe pleine en début de section et à l'approche de la suivante ; en retrait pendant la lecture.
const voile = document.querySelector('.voile');
const sections = [...document.querySelectorAll('.section')];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function readingCalm() {
  const y = window.scrollY, h = window.innerHeight;
  let i = 0;
  for (let k = 0; k < sections.length; k++) if (sections[k].offsetTop <= y + h * 0.5) i = k;
  if (i === 0) return 0; // la Présentation tient sur le premier écran : nappe pleine
  const into = (y - sections[i].offsetTop) / h;          // pages lues dans la section
  const next = sections[i + 1];
  const toNext = next ? (next.offsetTop - y) / h : 99;  // pages avant la section suivante
  return smooth(-0.3, 0.25, into) * smooth(0.1, 0.45, toNext);
}

// ---------- Boucle unique (gsap.ticker) ----------
function loop(time, deltaMs) {
  const dt = Math.min(deltaMs / 1000, 0.1);
  const st = audio.ready ? audio.frame(dt) : null;
  const calm = readingCalm();
  voile.style.opacity = calm.toFixed(3);
  if (scene && !scene.lost) {
    scene.setCalm(calm);
    scene.setScrollVelocity(ui.scrollVelocity());
    scene.update(dt, st);
  }
  ui.update(dt, st);
}

// ---------- Entrée ----------
let started = false;
function enter(silent) {
  if (started || btnEntrer.disabled) return;
  started = true;
  // Le contexte audio est créé ici, dans le geste, avant tout await (AUDIO §1.2).
  audio.start({ silent });
  ui.syncPlayer(audio.state);
  if (scene) scene.enter();
  gsap.ticker.add(loop);
  ui.playEntry({});
}
btnEntrer.addEventListener('click', () => enter(false));
btnMuet.addEventListener('click', () => enter(true));

document.addEventListener('visibilitychange', () => audio.onVisibility(document.hidden));
window.addEventListener('pagehide', (e) => {
  if (e.persisted) { audio.pause(); return; }
  gsap.ticker.remove(loop);
  ui.dispose();
  audio.dispose();
  if (scene) scene.dispose();
});

// Accès de débogage (console) : état du son et de la nappe.
window.__ondes = { audio, get scene() { return scene; }, goGenre };
