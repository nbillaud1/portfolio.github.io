// Moteur audio : un AudioContext partagé par Tone et smplr, un bus par genre, fondus à puissance constante,
// partitions générées en direct, analyse du son réel et bus d'événements de notes.
// Réf. : docs/design/AUDIO.md (§1 architecture, §2 genres, §3 signaux, §4 contrôles).
import { SplendidGrandPiano, Sampler, Versilian, SampleLoader } from 'smplr';
import { GENRES } from './genres.js';

const TONE_URL = 'vendor/tone/Tone.js';

// ---------- Bus d'événements (AUDIO §3.2) ----------
const listeners = new Map();
export const audioEvents = {
  on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
  },
  off(type, fn) { listeners.get(type)?.delete(fn); },
  emit(e) {
    listeners.get(e.type)?.forEach((fn) => fn(e));
    listeners.get('*')?.forEach((fn) => fn(e));
  },
};

// ---------- Outils ----------
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const warned = new Set();
function warnOnce(key, msg) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg);
}

function loadTone() {
  if (window.Tone) return Promise.resolve(window.Tone);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TONE_URL;
    s.onload = () => (window.Tone ? resolve(window.Tone) : reject(new Error('Tone.js chargé sans global')));
    s.onerror = () => reject(new Error('Tone.js introuvable'));
    document.head.appendChild(s);
  });
}

// Grille : swing (AUDIO §1.5) — r = part de la première note de la paire.
function swingDelay(g, step) {
  if (g.swingMode === 8) return step % 4 === 2 ? (2 * g.r - 1) * 2 * g.d16 : 0;
  if (g.swingMode === 16) return step % 2 === 1 ? (2 * g.r - 1) * g.d16 : 0;
  return 0;
}

// ---------- Création du moteur ----------
export function createAudio({ mobile = false, reduced = false, onStateChange = () => {} } = {}) {
  let T = null;
  let ctx = null;
  let ready = false;
  let failed = false;
  let disposed = false;
  let entryTime = 0;
  let paused = false;
  let muted = false;
  let volume = 0.8;
  try {
    const v = parseFloat(localStorage.getItem('ondes-volume'));
    // Un volume enregistré à 0 ferait redémarrer le site muet après « Entrer » : on repart du défaut.
    if (Number.isFinite(v) && v > 0) volume = clamp(v, 0, 1);
  } catch { /* stockage indisponible */ }

  const genres = new Array(GENRES.length).fill(null);
  let active = 0;
  let transitionEnd = 0;
  const queue = []; // file des événements à émettre à l'heure entendue
  const loadQueue = [];
  let loading = false;
  const priority = new Set([0, 1]);
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  let loader = null;
  let masterIn, comp, limiter, clipper, gainPause, userGain, analyser, fx = null;
  // Entrée du master à −4 dB : vise environ −6 dBFS de crête avant le limiteur (AUDIO §1.3).
  const MASTER_IN = 0.63;
  let buildTimer = 0;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms); timers.add(id); return id; };

  // État par image (AUDIO §3.3), toujours le même objet.
  const state = {
    bands: { basses: 0, basMediums: 0, mediums: 0, aigus: 0 },
    attaques: { basses: 0, basMediums: 0, mediums: 0, aigus: 0 },
    rms: 0, genre: 0, genreSuivant: null, fondu: 0, bpm: GENRES[0].bpm, phaseTemps: 0, phaseMesure: 0,
    enLecture: false, muet: false, volume, pret: false, echec: false, fillSpectrum: null,
  };

  // ---------- Analyse (DA §2.3, AUDIO §3.1) ----------
  const BANDS = [[30, 160], [160, 600], [600, 2500], [2500, 11000]];
  const BAND_KEYS = ['basses', 'basMediums', 'mediums', 'aigus'];
  const TAU_UP = [0.015, 0.015, 0.012, 0.01];
  const TAU_DOWN = [0.24, 0.18, 0.12, 0.07];
  let fft = null, prevNorm = null, timeData = null, binRanges = null, specBins = null;
  const peak = [0.3, 0.3, 0.3, 0.3];
  const low = [0, 0, 0, 0];
  const env = [0, 0, 0, 0];
  const fluxHist = BANDS.map(() => new Float32Array(43));
  let fluxIdx = 0;
  const sortBuf = new Float32Array(43);
  const lastAttack = [0, 0, 0, 0];
  const pending = []; // impulsions retardées de la latence de sortie
  for (let i = 0; i < 8; i++) pending.push({ band: 0, force: 0, at: 0, live: false });

  function setupAnalysis() {
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    fft = new Float32Array(analyser.frequencyBinCount);
    prevNorm = new Float32Array(analyser.frequencyBinCount);
    timeData = new Float32Array(analyser.fftSize);
    const binOf = (f) => Math.round((f * analyser.fftSize) / ctx.sampleRate);
    binRanges = BANDS.map(([a, b]) => [Math.max(1, binOf(a)), Math.min(analyser.frequencyBinCount - 1, binOf(b))]);
    specBins = new Float32Array(256);
    for (let c = 0; c < 256; c++) {
      const f = 40 * Math.pow(12000 / 40, c / 255);
      specBins[c] = (f * analyser.fftSize) / ctx.sampleRate;
    }
    state.fillSpectrum = fillSpectrum;
  }

  function fillSpectrum(row) {
    if (!fft) { row.fill(0); return; }
    for (let c = 0; c < 256; c++) {
      const b = specBins[c];
      const i0 = Math.floor(b), fr = b - i0;
      const db = fft[i0] * (1 - fr) + fft[Math.min(fft.length - 1, i0 + 1)] * fr;
      let v = clamp((db + 88) / 58, 0, 1);
      v = Math.pow(v, 1.6);
      row[c] = (v * 255) | 0;
    }
  }

  function median(arr) {
    sortBuf.set(arr);
    sortBuf.sort();
    return sortBuf[21];
  }

  function analyse(dt) {
    const at = state.attaques;
    at.basses = at.basMediums = at.mediums = at.aigus = 0;
    if (!analyser || paused || ctx.state !== 'running') {
      for (let i = 0; i < 4; i++) { env[i] *= Math.exp(-dt / 0.2); state.bands[BAND_KEYS[i]] = env[i]; }
      state.rms *= Math.exp(-dt / 0.2);
      if (fft) fft.fill(-120);
      return;
    }
    analyser.getFloatFrequencyData(fft);
    analyser.getFloatTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i += 2) sum += timeData[i] * timeData[i];
    state.rms = clamp(Math.sqrt(sum / (timeData.length / 2)) * 3, 0, 1);
    const k = dt * 60;
    const now = performance.now();
    const delay = Math.min(ctx.outputLatency || 0.02, 0.06) * 1000;
    for (let bi = 0; bi < 4; bi++) {
      const [lo, hi] = binRanges[bi];
      let pow = 0, flux = 0;
      for (let i = lo; i <= hi; i++) {
        const db = fft[i];
        pow += Math.pow(10, db / 10);
        const n = clamp((db + 90) / 70, 0, 1);
        const d = n - prevNorm[i];
        if (d > 0) flux += d;
        prevNorm[i] = n;
      }
      const n = hi - lo + 1;
      flux /= n;
      const db = 10 * Math.log10(pow / n + 1e-12);
      const norm = clamp((db + 90) / 70, 0, 1);
      peak[bi] = Math.max(norm, peak[bi] * Math.pow(0.995, k), 0.15);
      low[bi] = Math.min(norm, low[bi] + 0.003 * k);
      const x = clamp((norm - low[bi]) / Math.max(peak[bi] - low[bi], 0.12), 0, 1);
      const tau = x > env[bi] ? TAU_UP[bi] : TAU_DOWN[bi];
      env[bi] += (x - env[bi]) * (1 - Math.exp(-dt / tau));
      state.bands[BAND_KEYS[bi]] = env[bi];
      // Attaques : flux spectral positif > 1,5 × médiane (43 images) + 0,02, 90 ms minimum
      const h = fluxHist[bi];
      const med = median(h);
      h[fluxIdx] = flux;
      const thr = 1.5 * med + 0.02;
      if (flux > thr && now - lastAttack[bi] > 90) {
        lastAttack[bi] = now;
        const slot = pending.find((p) => !p.live);
        if (slot) { slot.band = bi; slot.force = clamp((flux - thr) / (thr + 0.04) + 0.3, 0, 1); slot.at = now + delay; slot.live = true; }
      }
    }
    fluxIdx = (fluxIdx + 1) % 43;
    for (const p of pending) {
      if (p.live && now >= p.at) { at[BAND_KEYS[p.band]] = Math.max(at[BAND_KEYS[p.band]], p.force); p.live = false; }
    }
  }

  // ---------- Heure entendue et file d'événements ----------
  function heardTime() {
    if (ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts.contextTime > 0 && ts.performanceTime > 0) {
        return Math.min(ctx.currentTime, ts.contextTime + (performance.now() - ts.performanceTime) / 1000);
      }
    }
    return ctx.currentTime - (ctx.outputLatency || 0) - (ctx.baseLatency || 0);
  }

  const QUEUE_MAX = 256;
  function push(type, g, time, vel = 1, extra) {
    // Onglet caché : l'horloge Tone continue (Worker) mais personne ne vide la file ; on n'empile rien.
    if (document.hidden) return;
    if (queue.length >= QUEUE_MAX) queue.splice(0, queue.length - QUEUE_MAX + 1);
    const e = { type, genre: g.key, time, vel, notes: extra?.notes, root: extra?.root };
    let i = queue.length;
    while (i > 0 && queue[i - 1].time > time) i--;
    queue.splice(i, 0, e);
  }

  const perType = new Map();
  function drainEvents() {
    if (!queue.length) return;
    const heard = heardTime();
    perType.clear();
    let k = 0;
    while (k < queue.length && queue[k].time <= heard + 0.008) {
      const e = queue[k++];
      if (heard - e.time > 0.25) continue;
      const n = (perType.get(e.type) || 0) + 1;
      perType.set(e.type, n);
      if (n <= 8) audioEvents.emit(e);
    }
    if (k) queue.splice(0, k);
  }

  // ---------- Bus et rôles ----------
  function makeBus(g, trimDb, reverb) {
    const N = g.N;
    const input = N(new T.Gain(T.dbToGain(trimDb)));
    const hp = N(new T.Filter({ type: 'highpass', frequency: 20, rolloff: -24 }));
    const lp = N(new T.Filter({ type: 'lowpass', frequency: 20000, rolloff: -24 }));
    const fade = ctx.createGain();
    fade.gain.value = 0;
    input.chain(hp, lp);
    lp.connect(fade);
    let rev = null;
    if (reverb) {
      rev = N(new T.Reverb({ decay: mobile ? Math.min(3, reverb.decay) : reverb.decay, preDelay: reverb.preDelay ?? 0.01 }));
      const ret = N(new T.Gain(T.dbToGain(reverb.ret ?? 0)));
      rev.connect(ret);
      ret.connect(input);
    }
    const bus = {
      input, hp, lp, fade, rev, connected: false, st: { th0: 0, th1: 0, t: 0, d: 0 },
      channel(db, pan = 0, sendDb = null) {
        const c = N(new T.Channel({ volume: db, pan }));
        c.connect(input);
        if (sendDb != null && rev) {
          const s = N(new T.Gain(T.dbToGain(sendDb)));
          c.connect(s);
          s.connect(rev);
        }
        return c;
      },
      connect() { if (!this.connected) { fade.connect(masterIn); this.connected = true; } },
      disconnect() { if (this.connected) { try { fade.disconnect(); } catch { /* déjà débranché */ } this.connected = false; } },
    };
    return bus;
  }

  function busValue(bus, t) {
    const s = bus.st;
    let th;
    if (s.d <= 0 || t >= s.t + s.d) th = t >= s.t ? s.th1 : s.th0;
    else if (t <= s.t) th = s.th0;
    else th = s.th0 + ((s.th1 - s.th0) * (t - s.t)) / s.d;
    return Math.sin(th);
  }

  // Fondu à puissance constante (AUDIO §1.6), repris depuis la valeur courante.
  function fadeBus(bus, target, dur, t) {
    const v0 = clamp(busValue(bus, t), 0, 1);
    const th0 = Math.asin(v0), th1 = target ? Math.PI / 2 : 0;
    const d = (dur * Math.abs(th1 - th0)) / (Math.PI / 2);
    const p = bus.fade.gain;
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
    else { p.cancelScheduledValues(t); p.setValueAtTime(v0, t); }
    if (d > 0.01) {
      const n = 16;
      for (let i = 1; i <= n; i++) p.linearRampToValueAtTime(Math.sin(th0 + ((th1 - th0) * i) / n), t + (d * i) / n);
    } else p.linearRampToValueAtTime(target, t + 0.01);
    bus.st = { th0, th1, t, d: Math.max(d, 0.01) };
  }

  function role(g, dest, spec, fallback) {
    const entry = ctx.createGain();
    T.connect(entry, dest);
    let [vlo, vhi] = spec.vel;
    if (mobile && spec.kind === 'vcsl') { vlo = 84; vhi = 106; }
    const r = { g: g.idx, entry, spec: { ...spec, vel: [vlo, vhi] }, inst: null, ready: false, failed: false, use: false, vlo, vhi, fallback };
    r.play = (note, time, dur, vel127) => {
      if (r.use && r.inst) {
        try { r.inst.start({ note, velocity: clamp(Math.round(vel127), r.vlo, r.vhi), time, duration: dur }); } catch (err) { warnOnce('play', 'Échantillon non joué : ' + err.message); }
      } else if (r.fallback) r.fallback(note, time, dur, vel127 / 127);
    };
    g.roles.push(r);
    loadQueue.push(r);
    return r;
  }

  async function loadRole(r) {
    const s = r.spec;
    const opts = { destination: r.entry, loader, notesToLoad: { notes: s.notes, velocityRange: s.vel } };
    try {
      if (s.kind === 'piano') r.inst = SplendidGrandPiano(ctx, { ...opts, notesToLoad: { ...opts.notesToLoad, fallback: 'nearest' }, decayTime: s.decay ?? 0.6 });
      else if (s.kind === 'smolken') r.inst = Sampler(ctx, { destination: r.entry, loader, preset: bassPreset() });
      else r.inst = Versilian(ctx, { ...opts, instrument: s.instrument });
    } catch (err) {
      r.failed = true;
      warnOnce('smplr-create', 'Échantillons indisponibles, repli sur les synthés : ' + err.message);
      return;
    }
    const ok = r.inst.ready.then(() => { r.ready = true; }).catch((err) => {
      r.failed = true;
      warnOnce('smplr-load', 'Chargement des échantillons impossible, repli sur les synthés : ' + (err && err.message));
    });
    let tid;
    const timeout = new Promise((res) => { tid = setTimeout(res, 8000); });
    await Promise.race([ok, timeout]);
    clearTimeout(tid);
    if (!r.ready && !r.failed) warnOnce('smplr-slow', 'Échantillons lents (plus de 8 s) : les synthés jouent en attendant.');
  }

  async function pumpLoads() {
    if (loading || disposed) return;
    loading = true;
    while (loadQueue.length && !disposed) {
      let best = 0;
      for (let i = 0; i < loadQueue.length; i++) {
        if (priority.has(loadQueue[i].g)) { best = i; break; }
      }
      const r = loadQueue[best];
      if (saveData && r.g !== active) break;
      loadQueue.splice(best, 1);
      await loadRole(r);
    }
    loading = false;
  }

  function setPriority(idx) {
    priority.clear();
    priority.add(idx);
    if (idx > 0) priority.add(idx - 1);
    if (idx < GENRES.length - 1) priority.add(idx + 1);
  }

  // ---------- Garde des voix monophoniques ----------
  // Sous charge, l'horloge appelle en retard et deux attaques d'une même voix peuvent tomber à la même heure :
  // Tone lève alors une exception et le reste du pas était perdu. Chaque voix garde ses heures croissantes
  // (+2 ms au besoin) et une erreur ne coupe que cette voix.
  function guardVoice(n, key) {
    if (!n || typeof n.triggerAttack !== 'function' || n instanceof T.PolySynth) return n;
    const ti = n instanceof T.NoiseSynth ? 0 : 1; // NoiseSynth.triggerAttack(time, vel) ; les autres (note, time, …)
    const attack = n.triggerAttack;
    const release = n.triggerRelease;
    let last = -1;
    n.triggerAttack = function (...a) {
      let t = typeof a[ti] === 'number' ? a[ti] : ctx.currentTime;
      if (t <= last) t = last + 0.002;
      last = t;
      a[ti] = t;
      try { return attack.apply(this, a); } catch (err) { warnOnce('voix-' + key, 'Partition ' + key + ' : note ignorée (' + err.message + ')'); return this; }
    };
    n.triggerRelease = function (...a) {
      try { return release.apply(this, a); } catch (err) { warnOnce('voix-' + key, 'Partition ' + key + ' : relâche ignorée (' + err.message + ')'); return this; }
    };
    return n;
  }

  // ---------- Genres ----------
  function makeGenre(idx) {
    const G = GENRES[idx];
    const nodes = [];
    const g = {
      idx, key: G.key, bpm: G.bpm, d16: 15 / G.bpm, r: G.swing, swingMode: 0,
      roles: [], nodes, N: (n) => { nodes.push(n); return guardVoice(n, G.key); }, running: false, barBase: 0, lastBar: -1, t0: 0, rng: Math.random,
      tick: () => {}, onStart: () => {}, onStop: () => {}, plan: null, failedTick: false,
    };
    g.hum = (ms) => ((g.rng() * 2 - 1) * ms) / 1000;
    g.at = (time, step, humMs = 0) => time + swingDelay(g, step) + (humMs ? g.hum(humMs) : 0);
    g.emit = (type, time, vel, extra) => push(type, g, time, vel, extra);
    BUILDERS[G.key](g);
    g.clock = new T.Clock((time, ticks) => {
      const step = ticks % 16;
      const bar = g.barBase + Math.floor(ticks / 16);
      if (step === 0) {
        g.lastBar = bar;
        g.rng = mulberry32(hashStr(g.key) ^ (Math.floor(bar / 8) * 7919) ^ ((bar % 8) * 104729));
        for (const r of g.roles) r.use = r.ready;
      }
      try { g.tick(time, step, bar % 8, bar); } catch (err) {
        if (!g.failedTick) { g.failedTick = true; console.warn('Partition ' + g.key + ' : ' + err.message); }
      }
    }, G.bpm / 15);
    return g;
  }

  function ensureGenre(idx) {
    if (!genres[idx]) genres[idx] = makeGenre(idx);
    return genres[idx];
  }

  function startGenre(g, t, barBase = 0) {
    g.bus.connect();
    g.barBase = barBase;
    g.t0 = t;
    if (g.clock.state === 'started') g.clock.stop(t - 0.001);
    g.clock.start(t);
    g.running = true;
    g.onStart(t);
  }

  function stopGenre(g, t) {
    if (!g.running) return;
    g.running = false;
    try { g.clock.stop(t); } catch { /* horloge déjà arrêtée */ }
    try { g.onStop(t); } catch { /* voix déjà relâchées */ }
    for (const r of g.roles) { try { r.inst?.stop(); } catch { /* rien à couper */ } }
    g.bus.lp.frequency.cancelScheduledValues(t);
    g.bus.lp.frequency.setValueAtTime(20000, t);
    g.bus.hp.frequency.cancelScheduledValues(t);
    g.bus.hp.frequency.setValueAtTime(20, t);
    later(() => { if (!g.running && busValue(g.bus, ctx.currentTime) < 0.001) g.bus.disconnect(); }, 400);
  }

  // ---------- Transitions (AUDIO §1.7) ----------
  let lastScratch = -1, lastRiser = -1;
  function scratch(t, kind) {
    if (!fx || reduced) return;
    // Un synthé ne se reprogramme pas avant sa dernière attaque : on décale au besoin.
    t = Math.max(t, lastScratch + 0.02);
    lastScratch = t;
    const len = kind === 'short' ? 0.07 : kind === 'long' ? 0.45 : 0.25;
    const f = fx.bp.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(2000, t);
    if (kind === 'long') {
      f.exponentialRampToValueAtTime(300, t + len * 0.25);
      f.exponentialRampToValueAtTime(1600, t + len * 0.5);
      f.exponentialRampToValueAtTime(300, t + len * 0.75);
      f.exponentialRampToValueAtTime(1200, t + len);
    } else {
      f.exponentialRampToValueAtTime(300, t + len * 0.5);
      f.exponentialRampToValueAtTime(1200, t + len);
    }
    fx.scratch.triggerAttackRelease(len, t);
  }

  function riser(t) {
    if (!fx || reduced || mobile) return;
    if (t < lastRiser + 1.05) return; // une montée à la fois
    lastRiser = t;
    const f = fx.rbp.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(300, t);
    f.exponentialRampToValueAtTime(5000, t + 1);
    const v = fx.rgain.gain;
    v.cancelScheduledValues(t);
    v.setValueAtTime(T.dbToGain(-40), t);
    v.exponentialRampToValueAtTime(T.dbToGain(-24), t + 0.99);
    v.setValueAtTime(0, t + 1);
    fx.riser.triggerAttackRelease(1, t);
  }

  function goTo(idx, via = 'scroll') {
    if (!ready || idx === active) {
      if (!ready) { active = idx; state.genre = idx; }
      return;
    }
    const from = active;
    const now = ctx.currentTime;
    const t0 = now + 0.03;
    const dur = via === 'platine' ? 2.4 : 2.0;
    setPriority(idx);
    pumpLoads();
    audioEvents.emit({ type: 'genre', de: from, vers: idx, t0, duree: dur, via, time: t0 });
    active = idx;
    state.genre = idx;
    state.bpm = GENRES[idx].bpm;
    if (paused) return; // la reprise démarrera le nouveau genre, sans fondu
    const interrupt = transitionEnd > now;
    const out = genres[from];
    const inn = ensureGenre(idx);
    // Au plus deux bus audibles : les autres partent en 0,4 s
    for (const g of genres) {
      if (!g || g === out || g === inn) continue;
      if (busValue(g.bus, t0) > 0.001) { fadeBus(g.bus, 0, 0.4, t0); later(() => { if (g !== genres[active]) stopGenre(g, ctx.currentTime + 0.02); }, 500); }
    }
    if (out) {
      fadeBus(out.bus, 0, dur, t0);
      const f = out.bus.lp.frequency;
      f.cancelScheduledValues(t0);
      f.setValueAtTime(18000, t0);
      f.exponentialRampToValueAtTime(400, t0 + 1.2);
      later(() => { if (out !== genres[active]) stopGenre(out, ctx.currentTime + 0.02); }, (t0 + dur - ctx.currentTime) * 1000 + 60);
    }
    inn.bus.connect();
    const hp = inn.bus.hp.frequency;
    const lp = inn.bus.lp.frequency;
    if (busValue(inn.bus, t0) > 0.05) {
      // Retour vers un genre encore audible (A → B → A) : ses filtres repartent de leur valeur en cours, sans saut.
      hp.cancelAndHoldAtTime(t0);
      hp.exponentialRampToValueAtTime(20, t0 + 0.4);
      lp.cancelAndHoldAtTime(t0);
      lp.exponentialRampToValueAtTime(20000, t0 + 0.4);
    } else {
      hp.cancelScheduledValues(t0);
      hp.setValueAtTime(400, t0);
      hp.exponentialRampToValueAtTime(20, t0 + 1.5);
      lp.cancelScheduledValues(t0);
      lp.setValueAtTime(20000, t0);
    }
    fadeBus(inn.bus, 1, dur, t0);
    if (!inn.running) startGenre(inn, t0 + 1.0, 0);
    try {
      scratch(t0, interrupt ? 'short' : via === 'platine' ? 'long' : 'mid');
      riser(t0);
    } catch (err) { warnOnce('fx', 'Effet de transition ignoré : ' + err.message); }
    push('drop', inn, t0 + 1.0, 1);
    transitionEnd = t0 + dur;
  }

  // ---------- Contrôles (AUDIO §4) ----------
  function applyUserGain() {
    if (!userGain) return;
    const t = ctx.currentTime;
    userGain.gain.cancelScheduledValues(t);
    userGain.gain.setTargetAtTime(muted ? 0 : volume * volume, t, muted ? 0.025 : 0.015);
  }

  function setVolume(v) {
    volume = clamp(v, 0, 1);
    state.volume = volume;
    try { localStorage.setItem('ondes-volume', String(volume)); } catch { /* stockage indisponible */ }
    if (volume > 0 && muted) { muted = false; state.muet = false; }
    applyUserGain();
    onStateChange(state);
  }

  function setMuted(m) {
    muted = m;
    state.muet = m;
    applyUserGain();
    onStateChange(state);
  }

  function pause() {
    if (!ready || paused) return;
    paused = true;
    state.enLecture = false;
    const t = ctx.currentTime;
    gainPause.gain.cancelScheduledValues(t);
    gainPause.gain.setTargetAtTime(0, t, 0.08);
    later(() => {
      if (!paused) return;
      const tt = ctx.currentTime;
      for (const g of genres) if (g && g.running) { g.lastBar = Math.max(g.lastBar, 0); stopGenre(g, tt); }
    }, 300);
    later(() => { if (paused && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 650);
    onStateChange(state);
  }

  function resume() {
    if (!ready || !paused) return;
    paused = false;
    state.enLecture = true;
    const p = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
    p.then(() => {
      if (paused || disposed) return;
      const t = ctx.currentTime + 0.1;
      for (const g of genres) {
        if (!g || g.idx === active) continue;
        if (g.running) stopGenre(g, t);
        const gp = g.bus.fade.gain;
        gp.cancelScheduledValues(t); gp.setValueAtTime(0, t);
        g.bus.st = { th0: 0, th1: 0, t, d: 0 };
      }
      const g = ensureGenre(active);
      const gp = g.bus.fade.gain;
      gp.cancelScheduledValues(t); gp.setValueAtTime(1, t);
      g.bus.st = { th0: Math.PI / 2, th1: Math.PI / 2, t, d: 0 };
      if (!g.running) startGenre(g, t, g.lastBar + 1);
      transitionEnd = 0;
      gainPause.gain.cancelScheduledValues(t);
      gainPause.gain.setTargetAtTime(1, t, 0.08);
    }).catch((err) => warnOnce('resume', 'Reprise du son impossible : ' + err.message));
    onStateChange(state);
  }

  // ---------- Démarrage (dans le geste « Entrer ») ----------
  function start({ silent = false } = {}) {
    if (ctx) return Promise.resolve();
    muted = silent;
    state.muet = silent;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      failed = true; state.echec = true;
      console.warn('Web Audio indisponible : la nappe reste muette.');
      return Promise.resolve();
    }
    // 48 kHz imposés : à 96 kHz (réglage de certaines cartes son), le moteur calculait plus lentement que le temps réel
    // et la sortie restait muette. 48 kHz divise le calcul par deux, sans perte audible.
    ctx = new Ctx({ latencyHint: mobile ? 'playback' : 'interactive', sampleRate: 48000 });
    ctx.resume().catch(() => {});
    // Utile seulement sur iPhone (son malgré le mode silencieux). Sur ordinateur, Opera coupait la sortie avec ce réglage.
    try { if (mobile && navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* non pris en charge */ }
    entryTime = performance.now();
    return loadTone()
      .then((Tone) => { T = Tone; init(); })
      .catch((err) => {
        failed = true; state.echec = true;
        console.warn('Son indisponible : ' + err.message);
        onStateChange(state);
      });
  }

  function init() {
    // Ne pas fermer le contexte par défaut de Tone (2e argument false) : sous Opera, cette fermeture coupait toute la sortie audio de la page.
    T.setContext(new T.Context({ context: ctx, lookAhead: mobile ? 0.15 : 0.1 }), false);
    loader = SampleLoader(ctx);
    masterIn = ctx.createGain();
    masterIn.gain.value = MASTER_IN;
    comp = new T.Compressor({ threshold: -16, ratio: 2, attack: 0.02, release: 0.2 });
    // Tone.Limiter garde le genou de 30 dB par défaut : il laisse passer des crêtes au-dessus de 0 dBFS.
    // Ici un vrai limiteur (genou 0), puis un écrêteur doux de sécurité, transparent sous 0,8.
    limiter = new T.Compressor({ threshold: -3, ratio: 20, knee: 0, attack: 0.001, release: 0.06 });
    clipper = new T.WaveShaper((x) => {
      const a = Math.abs(x);
      return a < 0.8 ? x : Math.sign(x) * (0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2));
    }, 4096);
    gainPause = ctx.createGain();
    userGain = ctx.createGain();
    userGain.gain.value = muted ? 0 : volume * volume;
    T.connect(masterIn, comp);
    comp.connect(limiter);
    limiter.connect(clipper);
    clipper.connect(gainPause);
    gainPause.connect(userGain);
    userGain.connect(ctx.destination);
    setupAnalysis();
    gainPause.connect(analyser);

    // Bus des transitions : scratch et montée
    const scratchSynth = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: 0.05, sustain: 1, release: 0.05 } });
    const bp = new T.Filter({ type: 'bandpass', frequency: 2000, Q: 4 });
    const sg = new T.Gain(T.dbToGain(-20));
    scratchSynth.chain(bp, sg);
    sg.connect(masterIn);
    const riserSynth = new T.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.02, decay: 0, sustain: 1, release: 0.01 } });
    const rbp = new T.Filter({ type: 'bandpass', frequency: 300, Q: 1.2 });
    const rgain = new T.Gain(0);
    riserSynth.chain(rbp, rgain);
    rgain.connect(masterIn);
    fx = { scratch: scratchSynth, bp, sg, riser: riserSynth, rbp, rgain };

    ctx.onstatechange = () => {
      if ((ctx.state === 'suspended' || ctx.state === 'interrupted') && !paused && ready) {
        paused = true; state.enLecture = false;
        for (const g of genres) if (g && g.running) stopGenre(g, ctx.currentTime);
        onStateChange(state);
      }
    };

    ready = true;
    state.pret = true;
    state.enLecture = true;
    const g = ensureGenre(active);
    const t = ctx.currentTime + 0.05;
    g.bus.fade.gain.setValueAtTime(1, t);
    g.bus.st = { th0: Math.PI / 2, th1: Math.PI / 2, t, d: 0 };
    startGenre(g, t, 0);
    if (active === 0 && g.intro) g.intro(t);
    setPriority(active);
    // Les autres genres se construisent un par un, puis leurs banques se chargent dans l'ordre de la page.
    let next = 0;
    const buildNext = () => {
      while (next < GENRES.length && genres[next]) next++;
      if (next >= GENRES.length || disposed) { pumpLoads(); return; }
      ensureGenre(next);
      pumpLoads();
      buildTimer = later(buildNext, 350);
    };
    buildTimer = later(buildNext, 600);
    pumpLoads();
    onStateChange(state);
  }

  // ---------- Image ----------
  function frame(dt) {
    if (!ready) return state;
    analyse(dt);
    drainEvents();
    const g = genres[active];
    if (g && g.running) {
      const heard = heardTime();
      const beat = 60 / g.bpm;
      const x = (heard - g.t0) / beat;
      state.phaseTemps = x > 0 ? x % 1 : 0;
      state.phaseMesure = x > 0 ? (x / 4) % 1 : 0;
    }
    const now = ctx.currentTime;
    state.fondu = transitionEnd > now ? 1 - (transitionEnd - now) / 2 : 0;
    state.genreSuivant = transitionEnd > now ? active : null;
    state.enLecture = !paused;
    return state;
  }

  function onVisibility(hidden) {
    if (!ready) return;
    try { T.getContext().lookAhead = hidden ? 0.3 : mobile ? 0.15 : 0.1; } catch { /* sans effet */ }
    if (!hidden) {
      const heard = heardTime();
      let k = 0;
      while (k < queue.length && heard - queue[k].time > 0.25) k++;
      if (k) queue.splice(0, k);
      for (let i = 0; i < 4; i++) env[i] = 0;
    }
  }

  function dispose() {
    disposed = true;
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
    clearTimeout(buildTimer);
    for (const g of genres) {
      if (!g) continue;
      try { g.clock.dispose(); } catch { /* déjà libéré */ }
      for (const r of g.roles) { try { r.inst?.dispose(); } catch { /* déjà libéré */ } }
      for (const n of g.nodes) { try { n.dispose(); } catch { /* déjà libéré */ } }
    }
    if (fx) Object.values(fx).forEach((n) => { try { n.dispose(); } catch { /* déjà libéré */ } });
    try { comp?.dispose(); limiter?.dispose(); clipper?.dispose(); } catch { /* déjà libéré */ }
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
  }

  // ======================================================================
  // Partitions (AUDIO §2). Chaque constructeur crée ses instruments et sa fonction tick.
  // ======================================================================
  const VCSL = {
    ride: 'Idiophones/Struck Idiophones/Suspended Cymbal 1',
    hat: 'Idiophones/Struck Idiophones/Hi-Hat Cymbal',
    claps: 'Idiophones/Struck Idiophones/Claps',
    shaker: 'Idiophones/Struck Idiophones/Shaker, Small',
    snare: 'Membranophones/Struck Membranophones/Snare Drum, Modern 1',
    tamb: 'Idiophones/Struck Idiophones/Tambourine 1',
  };
  const poly = (n) => (mobile ? Math.min(6, n) : n);
  const BASS_NOTES = [28, 31, 34, 37, 40, 43, 46, 49];
  // Contrebasse pizzicato de D. Smolken (CC0), couche « m » seulement, deux prises en alternance (12 fichiers).
  // smplr 1.2 lit mal ce SFZ (seq_length posé sur les régions, groupes à une seule borne de vélocité) : chaque note
  // y déclenchait 12 prises à la fois. Les zones sont donc décrites ici, d'après le SFZ (notes de référence de la couche m).
  const SMOLKEN_URL = 'https://smpldsnds.github.io/sfzinstruments-dsmolken-double-bass';
  const BASS_ZONES = [['eb1', 27], ['g1', 31], ['d2', 38], ['f2', 41], ['a2', 45], ['c3', 48]];
  function bassPreset() {
    const regions = [];
    BASS_ZONES.forEach(([name, pitch], i) => {
      const lo = i === 0 ? 0 : Math.floor((BASS_ZONES[i - 1][1] + pitch) / 2) + 1;
      const hi = i === BASS_ZONES.length - 1 ? 127 : Math.floor((pitch + BASS_ZONES[i + 1][1]) / 2);
      ['a', 'b'].forEach((take, k) => regions.push({ sample: `pizz/pizz_${name}_m${take}`, keyRange: [lo, hi], pitch, seqPosition: k + 1 }));
    });
    return { samples: { baseUrl: SMOLKEN_URL, formats: ['ogg', 'm4a'] }, groups: [{ seqLength: 2, regions }], defaults: { ampRelease: 0.3 } };
  }

  function drumSynths(g) {
    const N = g.N;
    return {
      kick(ch, opts) { return N(new T.MembraneSynth({ pitchDecay: opts.pitchDecay, octaves: opts.octaves, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: opts.decay, sustain: 0, release: 0.05 } })).connect(ch); },
      click(ch, hpFreq) {
        const f = N(new T.Filter({ type: 'highpass', frequency: hpFreq }));
        const s = N(new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.003, sustain: 0, release: 0.002 } }));
        s.chain(f, ch);
        return s;
      },
      noiseHit(ch, type, freq, decay, Q = 1, noise = 'white') {
        const f = N(new T.Filter({ type, frequency: freq, Q }));
        const s = N(new T.NoiseSynth({ noise: { type: noise }, envelope: { attack: 0.002, decay, sustain: 0, release: 0.02 } }));
        s.chain(f, ch);
        return s;
      },
      metal(ch, decay, hp = 7000, vol = -8) {
        const f = N(new T.Filter({ type: 'highpass', frequency: hp }));
        const s = N(new T.MetalSynth({ envelope: { attack: 0.001, decay, release: 0.05 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5, volume: vol }));
        s.chain(f, ch);
        return s;
      },
    };
  }

  const BUILDERS = {
    // ---------------- Accueil · ambient ----------------
    ambient(g) {
      const N = g.N;
      g.bus = makeBus(g, 0, { decay: 9, preDelay: 0.06, ret: -4 });
      const bus = g.bus;
      const pad = N(new T.PolySynth(T.Synth, {
        maxPolyphony: poly(12),
        oscillator: mobile ? { type: 'triangle' } : { type: 'fattriangle', count: 3, spread: 24 },
        envelope: { attack: 3, decay: 1, sustain: 0.8, release: 5 },
      }));
      const padLp = N(new T.Filter({ type: 'lowpass', frequency: 1100, rolloff: -24 }));
      const af = N(new T.AutoFilter({ frequency: 0.04, baseFrequency: 300, octaves: 2.5 })).start();
      const cho = N(new T.Chorus({ frequency: 0.3, delayTime: 4, depth: 0.6 })).start();
      pad.chain(padLp, af, cho, bus.channel(-15, 0, -6));

      // Bourdons : fondamentales (do 1, sol 1) discrètes, l'octave porte le poids, et do 3 pour les haut-parleurs
      // de portable. Passe-haut à 25 Hz : sous ce seuil, rien d'audible, seulement de la marge mangée au master.
      const droneHp = N(new T.Filter({ type: 'highpass', frequency: 25, rolloff: -24 }));
      droneHp.connect(bus.input);
      const droneLevels = [];
      const droneBus = (db) => { const c = N(new T.Channel({ volume: -60 })); c.connect(droneHp); droneLevels.push([c, db]); return c; };
      const droneCh = droneBus(-26);
      const droneOct = droneBus(-17);
      const droneHi = droneBus(-28);
      const mkDrone = (m, ch) => { const s = N(new T.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.3, decay: 0, sustain: 1, release: 3 } })).connect(ch); s.f = mtof(m); return s; };
      const drones = [mkDrone(24, droneCh), mkDrone(31, droneCh), mkDrone(36, droneOct), mkDrone(43, droneOct), mkDrone(48, droneHi)];

      const bell = N(new T.FMSynth({ harmonicity: 3.5, modulationIndex: 10, envelope: { attack: 0.002, decay: 4, sustain: 0, release: 1 }, modulationEnvelope: { attack: 0.002, decay: 2.5, sustain: 0, release: 1 } }));
      bell.connect(bus.channel(-14, 0, -4));

      const delay = N(new T.FeedbackDelay({ delayTime: (1.5 * 60) / 64, maxDelay: 2, feedback: 0.42, wet: 0.3 }));
      delay.connect(bus.channel(-12, 0, -3));
      const pianoFb = N(new T.PolySynth(T.FMSynth, { maxPolyphony: 4, harmonicity: 3.01, modulationIndex: 1.2, envelope: { attack: 0.004, decay: 2.4, sustain: 0, release: 1.5 }, modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.5 }, volume: -8 }));
      pianoFb.connect(delay);
      const piano = role(g, delay, { kind: 'piano', notes: [74, 76, 79, 81, 83, 86, 88, 90, 91], vel: [1, 40] },
        (n, t, d, v) => pianoFb.triggerAttackRelease(mtof(n), d, t, 0.25 + v));

      const breathCh = bus.channel(0, 0, -12);
      const noise = N(new T.Noise('pink'));
      const nbp = N(new T.Filter({ type: 'bandpass', frequency: 5000, Q: 0.6 }));
      const ng = N(new T.Gain(0));
      const lfo = N(new T.LFO({ frequency: 0.07, min: T.dbToGain(-42), max: T.dbToGain(-32) }));
      lfo.connect(ng.gain);
      noise.chain(nbp, ng, breathCh);

      const CH = [[52, 55, 59, 62], [50, 54, 57, 64], [52, 55, 59, 66], [57, 59, 60, 64, 67]];
      const SCALE = [74, 76, 79, 81, 83, 86, 88, 90, 91];
      let pianoFrom = 0;
      let sourcesOn = false;

      g.intro = (t) => {
        bell.triggerAttackRelease(mtof(81), 4, t + 0.33, 0.55);
        pianoFrom = t + 2.55;
      };
      g.onStart = (t) => {
        drones.forEach((d) => d.triggerAttack(d.f, t));
        for (const [c, db] of droneLevels) {
          c.volume.cancelScheduledValues(t);
          c.volume.setValueAtTime(-60, t);
          c.volume.linearRampToValueAtTime(db, t + 2.5);
        }
        if (!sourcesOn) { noise.start(t); lfo.start(t); sourcesOn = true; }
        if (!pianoFrom) pianoFrom = t;
      };
      g.onStop = (t) => {
        drones.forEach((d) => d.triggerRelease(t));
        pad.releaseAll(t);
        if (sourcesOn) { noise.stop(t + 0.05); lfo.stop(t + 0.05); sourcesOn = false; }
      };
      g.tick = (time, step, bar) => {
        if (step % 4 === 0) g.emit('beat', time, 0.5);
        if (step === 0) {
          if (bar % 2 === 0) {
            const ch = CH[(bar / 2) % 4];
            pad.triggerAttackRelease(ch.map(mtof), g.d16 * 32 - 0.4, time, 0.45);
            g.emit('chord', time, 0.6, { notes: ch });
          }
          const r = g.rng();
          const n = r < 0.2 ? 0 : r < 0.6 ? 1 : r < 0.9 ? 2 : 3;
          const plan = [];
          for (let i = 0; i < n; i++) {
            plan.push({ step: Math.floor(g.rng() * 16), note: SCALE[Math.floor(g.rng() * SCALE.length)], vel: 18 + g.rng() * 20, dur: 1.5 + g.rng() * 1.5 });
          }
          g.plan = plan;
        }
        if (g.plan) {
          for (const p of g.plan) {
            if (p.step !== step || time < pianoFrom) continue;
            const t = g.at(time, step, 20);
            piano.play(p.note, t, p.dur, p.vel);
            g.emit('note', t, p.vel / 40, { notes: [p.note] });
          }
        }
      };
    },

    // ---------------- Présentation · jazz ----------------
    jazz(g) {
      const N = g.N;
      g.swingMode = 8;
      g.bus = makeBus(g, 9, { decay: 1.6, preDelay: 0.012, ret: 0 });
      const bus = g.bus;
      const D = drumSynths(g);
      const CHORDS = {
        Fmaj9: { pc: 5, v: [52, 55, 57, 60], t: [0, 4, 7, 11] },
        D7b9: { pc: 2, v: [54, 57, 60, 63], t: [0, 4, 7, 10] },
        Gm9: { pc: 7, v: [53, 57, 58, 62], t: [0, 3, 7, 10] },
        C13: { pc: 0, v: [52, 57, 58, 62], t: [0, 4, 7, 10] },
        Am7: { pc: 9, v: [55, 59, 60, 64], t: [0, 3, 7, 10] },
        C7b9: { pc: 0, v: [52, 55, 58, 61], t: [0, 4, 7, 10] },
        Gm7: { pc: 7, v: [53, 58, 62], t: [0, 3, 7, 10] },
      };
      const GRID = [['Fmaj9'], ['D7b9'], ['Gm9'], ['C13'], ['Am7', 'D7b9'], ['Gm9', 'C7b9'], ['Fmaj9'], ['Gm7', 'C7b9']];
      const BEBOP = [72, 74, 75, 76, 77, 79, 81];

      const pianoCh = bus.channel(-4, 0.15, -14);
      const eq = N(new T.EQ3({ high: -2 }));
      eq.connect(pianoCh);
      const pianoLp = N(new T.Filter({ type: 'lowpass', frequency: 3000 }));
      pianoLp.connect(eq);
      const pianoFb = N(new T.PolySynth(T.FMSynth, { maxPolyphony: poly(10), harmonicity: 2, modulationIndex: 1.2, envelope: { attack: 0.002, decay: 1.8, sustain: 0, release: 1 }, volume: -6 }));
      pianoFb.connect(pianoLp);
      const pianoNotes = []; for (let n = 52; n <= 64; n++) pianoNotes.push(n); for (let n = 72; n <= 81; n++) pianoNotes.push(n);
      const piano = role(g, eq, { kind: 'piano', notes: mobile ? [52, 55, 58, 61, 64, 72, 76, 79] : pianoNotes, vel: [68, 84] },
        (n, t, d, v) => pianoFb.triggerAttackRelease(mtof(n), d, t, v));
      const playChord = (notes, t, dur, vel) => { for (const n of notes) piano.play(n, t + g.hum(6), dur, vel - 4 + g.rng() * 8); };

      // Une seule prise par note depuis le préréglage maison (avant : 12 prises empilées, ≈ +10 dB) : tranche relevée.
      const bassCh = bus.channel(2, 0, -24);
      const bassFb = N(new T.MonoSynth({ oscillator: { type: 'triangle' }, filter: { type: 'lowpass', frequency: 500, rolloff: -24 }, filterEnvelope: { baseFrequency: 300, octaves: 1, attack: 0.003, decay: 0.3, sustain: 0.2 }, envelope: { attack: 0.003, decay: 0.4, sustain: 0.2, release: 0.15 } })).connect(bassCh);
      const bass = role(g, bassCh, { kind: 'smolken', notes: BASS_NOTES, vel: [75, 120] }, (n, t, d, v) => bassFb.triggerAttackRelease(mtof(n), d, t, v));

      const rideCh = bus.channel(-15, 0.35, -18);
      const rideFb = D.metal(rideCh, 1.2, 3000, -10);
      const ride = role(g, rideCh, { kind: 'vcsl', instrument: VCSL.ride, notes: [69, 70], vel: [55, 106] }, (n, t, d, v) => rideFb.triggerAttackRelease(300, d, t, v * 0.7));
      const hatCh = bus.channel(-21, -0.25);
      const hatFb = D.metal(hatCh, 0.05, 7000, -12);
      const hat = role(g, hatCh, { kind: 'vcsl', instrument: VCSL.hat, notes: [44], vel: [55, 106] }, (n, t, d, v) => hatFb.triggerAttackRelease(400, 0.05, t, v));

      // Balais (synthèse : aucun balai libre vérifié)
      const swishCh = bus.channel(-28, 0, -16);
      const swish = N(new T.Noise('pink'));
      const swBp = N(new T.Filter({ type: 'bandpass', frequency: 2800, Q: 0.8 }));
      const swG = N(new T.Gain(0.02));
      swish.chain(swBp, swG, swishCh);
      const brush = D.noiseHit(bus.channel(-18, 0, -16), 'bandpass', 3500, 0.11, 1);
      const kick = D.kick(bus.channel(-24), { pitchDecay: 0.02, octaves: 2, decay: 0.18 });
      let swishOn = false;

      // Ligne de contrebasse
      let prev = 41;
      const near = (pc, ref) => { let best = null; for (let n = 28; n <= 48; n++) if (n % 12 === pc && (best === null || Math.abs(n - ref) < Math.abs(best - ref))) best = n; return best; };
      const approach = (target) => {
        const r = g.rng();
        if (r < 0.45) return target - 1;
        if (r < 0.7) return target + 1;
        if (r < 0.9) return target + 7 <= 48 ? target + 7 : target - 5;
        return target + (g.rng() < 0.5 ? -2 : 2);
      };
      const F_MAJOR = [5, 7, 9, 10, 0, 2, 4];
      const scaleStep = (n, dir) => { let m = n + dir; while (!F_MAJOR.includes(((m % 12) + 12) % 12)) m += dir; return m; };
      const walk = (barIdx) => {
        const names = GRID[barIdx];
        const nextName = GRID[(barIdx + 1) % 8][0];
        const c1 = CHORDS[names[0]];
        const b1 = near(c1.pc, prev);
        let line;
        if (names.length === 2) {
          const c2 = CHORDS[names[1]];
          const r2 = near(c2.pc, b1);
          const tgt = near(CHORDS[nextName].pc, r2);
          line = [b1, approach(r2), r2, approach(tgt)];
        } else {
          // Un motif par mesure, tiré avec la graine : arpège, marche dans la gamme vers la cible, ou octave et quinte.
          const tgt = near(CHORDS[nextName].pc, b1);
          const dir = tgt >= b1 ? 1 : -1;
          const r = g.rng();
          if (r < 0.4) {
            const b2 = near((c1.pc + c1.t[1]) % 12, b1 + dir * 3);
            const b3 = near((c1.pc + c1.t[2]) % 12, b2 + dir * 3);
            line = [b1, b2, b3, approach(tgt)];
          } else if (r < 0.75) {
            const b2 = scaleStep(b1, dir);
            const b3 = scaleStep(b2, dir);
            line = [b1, b2, b3, approach(tgt)];
          } else {
            const b2 = b1 + 12 <= 50 ? b1 + 12 : b1 - 12 >= 28 ? b1 - 12 : b1;
            const b3 = near((c1.pc + 7) % 12, (b2 + tgt) / 2);
            line = [b1, b2, b3, approach(tgt)];
          }
        }
        line = line.map((n) => clamp(n, 28, 50));
        prev = line[3];
        return line;
      };

      let skipNextDownbeat = false;
      g.onStart = (t) => { if (!swishOn) { swish.start(t); swishOn = true; } };
      g.onStop = (t) => { pianoFb.releaseAll(t); if (swishOn) { swish.stop(t + 0.05); swishOn = false; } };
      g.tick = (time, step, bar) => {
        const names = GRID[bar];
        const beat = g.d16 * 4;
        if (step === 0) {
          g.emit('bar', time, 1);
          g.line = walk(bar);
          // Comping : une cellule par mesure
          const r = g.rng();
          g.cell = names.length === 2 ? 'two' : r < 0.35 ? 'A' : r < 0.6 ? 'B' : r < 0.8 ? 'C' : 'D';
          g.phrase = null;
          if ((bar === 3 || bar === 7) && g.rng() < 0.4) {
            const n = 3 + Math.floor(g.rng() * 4);
            let i = Math.floor(g.rng() * BEBOP.length);
            const notes = [];
            for (let k = 0; k < n; k++) { notes.push(BEBOP[i]); i = clamp(i + (g.rng() < 0.5 ? -1 : 1), 0, BEBOP.length - 1); }
            const last = CHORDS[names[names.length - 1]];
            notes[n - 1] = 72 + ((last.pc + last.t[1] - 72) % 12 + 12) % 12;
            g.phrase = { start: 16 - 2 * n, notes };
          }
        }
        const chordAt = (s) => CHORDS[names.length === 2 && s >= 8 ? names[1] : names[0]];
        // Piano
        const hit = (s, len, ch) => {
          const t = g.at(time, s, 10);
          playChord(ch.v, t, len * g.d16, 72 + g.rng() * 10);
          g.emit('chord', t, 0.8, { notes: ch.v, root: ch.pc });
        };
        if (g.cell === 'two') { if (step === 0 && !skipNextDownbeat) hit(0, 3, chordAt(0)); if (step === 8) hit(8, 3, chordAt(8)); }
        else if (g.cell === 'A') { if (step === 0 && !skipNextDownbeat) hit(0, 3, chordAt(0)); if (step === 6) hit(6, 2, chordAt(6)); }
        else if (g.cell === 'B') {
          if (step === 0 && !skipNextDownbeat) hit(0, 2, chordAt(0));
          if (step === 14) { const nx = CHORDS[GRID[(bar + 1) % 8][0]]; hit(14, 4, nx); }
        } else if (g.cell === 'C') { if (step === 4 || step === 12) hit(step, 1.5, chordAt(step)); }
        else if (g.cell === 'D') { if (step === 6 || step === 10) hit(step, 2, chordAt(step)); }
        if (step === 0) skipNextDownbeat = false;
        if (step === 14 && g.cell === 'B') skipNextDownbeat = true;
        if (g.phrase && step >= g.phrase.start && step % 2 === 0) {
          const k = (step - g.phrase.start) / 2;
          if (k < g.phrase.notes.length) piano.play(g.phrase.notes[k], g.at(time, step, 8), g.d16 * 1.8, 70 + g.rng() * 12);
        }
        // Contrebasse : noires
        if (step % 4 === 0 && g.line) {
          const n = g.line[step / 4];
          const v = 78 + g.rng() * 22;
          const t = g.at(time, step, 10);
          bass.play(n, t, beat * 0.85, v);
          g.emit('bass', t, v / 100, { root: n });
        }
        if (step === 14 && g.rng() < 0.1) bass.play(g.line ? g.line[3] : 41, g.at(time, 14), 0.06, 75);
        // Ride : 0, 4, 6s, 8, 12, 14s
        const RV = { 0: 80, 4: 95, 6: 65, 8: 80, 12: 95, 14: 65 };
        if (RV[step] !== undefined && !((step === 6 || step === 14) && g.rng() < 0.15)) {
          const t = g.at(time, step, 4) - 0.005;
          ride.play(bar === 0 && step === 0 ? 69 : 70, t, 1.2, RV[step]);
          g.emit('hat', t, RV[step] / 100);
        }
        if (step === 4 || step === 12) {
          // smplr ignore l'opcode offset : la prise commence par ≈ 10 ms de silence, on l'avance d'autant.
          hat.play(44, g.at(time, step, 6) - 0.01, 0.2, 70);
          const t = g.at(time, step, 6);
          brush.triggerAttackRelease(0.11, t, 0.7);
          g.emit('snare', t, 0.6);
        }
        const fillStep = bar === 7 && (step === 8 || step === 10 || step === 14);
        if (fillStep) brush.triggerAttackRelease(0.1, g.at(time, step, 6), 0.45);
        else if ((step === 6 || step === 14) && g.rng() < 0.2) brush.triggerAttackRelease(0.11, g.at(time, step, 6), 0.35);
        if (step % 4 === 0) {
          const t = g.at(time, step);
          // Grosse caisse effleurée accordée sur fa 1 (43,7 Hz) : la 0 (27,5 Hz) ne s'entend sur aucun portable.
          kick.triggerAttackRelease(mtof(29), 0.18, t, 0.5);
          swG.gain.cancelScheduledValues(t);
          swG.gain.setValueAtTime(0.02, t);
          swG.gain.linearRampToValueAtTime(0.08, t + beat * 0.3);
          swG.gain.linearRampToValueAtTime(0.03, t + beat * 0.95);
        }
      };
    },

    // ---------------- Projets · house ----------------
    house(g) {
      const N = g.N;
      g.swingMode = 16;
      g.bus = makeBus(g, -2, { decay: 2.4, preDelay: 0.01, ret: 0 });
      const bus = g.bus;
      const D = drumSynths(g);
      const kickCh = bus.channel(-3);
      const kickDist = N(new T.Distortion(0.1));
      kickDist.connect(kickCh);
      const kick = N(new T.MembraneSynth({ pitchDecay: 0.045, octaves: 5, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.05 } })).connect(kickDist);
      const click = D.click(bus.channel(-18), 4000);
      const clapCh = bus.channel(-10, 0, -12);
      const clapFb = D.noiseHit(clapCh, 'bandpass', 1200, 0.12, 1.2);
      const clap = role(g, clapCh, { kind: 'vcsl', instrument: VCSL.claps, notes: [60], vel: [55, 106] }, (n, t, d, v) => clapFb.triggerAttackRelease(0.12, t, v));
      const ohCh = bus.channel(-15, 0.2);
      const ohFb = D.metal(ohCh, 0.35, 7000, -10);
      const chCh = bus.channel(-21, -0.2);
      const chFb = D.metal(chCh, 0.05, 8000, -12);
      const hatO = role(g, ohCh, { kind: 'vcsl', instrument: VCSL.hat, notes: [46], vel: [55, 106] }, (n, t, d, v) => ohFb.triggerAttackRelease(400, 0.3, t, v));
      const hatC = role(g, chCh, { kind: 'vcsl', instrument: VCSL.hat, notes: [42], vel: [55, 106] }, (n, t, d, v) => chFb.triggerAttackRelease(400, 0.05, t, v));
      const shCh = bus.channel(-24, 0.3);
      const shFb = D.noiseHit(shCh, 'highpass', 6000, 0.04, 0.7);
      const shaker = mobile ? null : role(g, shCh, { kind: 'vcsl', instrument: VCSL.shaker, notes: [61], vel: [55, 106] }, (n, t, d, v) => shFb.triggerAttackRelease(0.04, t, v));
      const bassSynth = N(new T.MonoSynth({
        oscillator: { type: 'square' }, filter: { type: 'lowpass', rolloff: -24, Q: 3 },
        filterEnvelope: { attack: 0.003, decay: 0.12, sustain: 0.2, release: 0.08, baseFrequency: 120, octaves: 3 },
        envelope: { attack: 0.003, decay: 0.2, sustain: 0.6, release: 0.08 },
      })).connect(bus.channel(-7));
      // Piano stabs
      const pianoCh = bus.channel(-9, 0, -14);
      const php = N(new T.Filter({ type: 'highpass', frequency: 180 }));
      php.connect(pianoCh);
      // Croche pointée à 124 BPM (0,363 s) ; pas « 8n. » en texte : Tone le compterait à 120 BPM.
      const ppd = N(new T.PingPongDelay({ delayTime: 1.5 * (30 / 124), feedback: 0.28, wet: 0.18 }));
      ppd.connect(php);
      const stabFb = N(new T.PolySynth(T.FMSynth, { maxPolyphony: poly(8), harmonicity: 2, modulationIndex: 2, envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.2 }, volume: -6 }));
      stabFb.connect(ppd);
      const stabNotes = []; for (let n = 56; n <= 71; n++) stabNotes.push(n);
      const piano = role(g, ppd, { kind: 'piano', notes: mobile ? [56, 59, 62, 65, 68, 71] : stabNotes, vel: [101, 127] }, (n, t, d, v) => stabFb.triggerAttackRelease(mtof(n), d, t, v));
      // Nappe + pompe
      const pump = N(new T.Gain(1));
      pump.connect(bus.channel(-20, 0, -10));
      const padAf = N(new T.AutoFilter({ frequency: 1 / (8 * 0.484), baseFrequency: 400, octaves: 3, wet: 0.6 })).start();
      padAf.connect(pump);
      const pad = N(new T.PolySynth(T.Synth, { maxPolyphony: poly(8), oscillator: mobile ? { type: 'sawtooth' } : { type: 'fatsawtooth', count: 3, spread: 18 }, envelope: { attack: 0.4, decay: 0.3, sustain: 0.7, release: 1.5 } }));
      pad.connect(padAf);
      const riserCh = bus.channel(-14);
      const cymbal = mobile ? null : role(g, riserCh, { kind: 'vcsl', instrument: VCSL.ride, notes: [66], vel: [55, 106] }, null);

      const CH = [[60, 64, 67, 71], [60, 64, 67, 69], [60, 64, 65, 69], [59, 62, 64, 69], [56, 59, 62, 65]];
      const ROOTS = [33, 29, 38, 28, 28];
      const CELLS = [[0, 3, 6, 10, 13], [2, 5, 8, 11, 14], [0, 6, 12], [3, 7, 10, 14]];
      g.onStop = (t) => { pad.releaseAll(t); stabFb.releaseAll(t); bassSynth.triggerRelease(t); };
      g.tick = (time, step, bar, absBar) => {
        const ci = bar === 7 ? 4 : bar === 6 ? 3 : Math.floor(bar / 2);
        if (step === 0) {
          if (bar % 2 === 0 || bar === 7) {
            g.cellIdx = Math.floor(g.rng() * 4);
            pad.releaseAll(time);
            pad.triggerAttackRelease(CH[ci].map((n) => mtof(n - 12)), g.d16 * 16 * (bar === 6 || bar === 7 ? 1 : 2) - 0.2, time, 0.5);
            g.emit('chord', time, 0.7, { notes: CH[ci], root: ROOTS[ci] });
          } else if (g.rng() >= 0.6) g.cellIdx = Math.floor(g.rng() * 4);
          g.emit('bar', time, 1);
        }
        const cutKick = absBar % 16 === 15 && step >= 8;
        if (step % 4 === 0 && !cutKick) {
          kick.triggerAttackRelease(55, 0.4, time, 1);
          click.triggerAttackRelease(0.003, time, 0.6);
          pump.gain.cancelScheduledValues(time);
          pump.gain.setValueAtTime(1, time);
          pump.gain.linearRampToValueAtTime(0.35, time + 0.01);
          pump.gain.linearRampToValueAtTime(1, time + 0.2);
          g.emit('kick', time, 1);
        }
        if (step === 4 || step === 12) { const t = g.at(time, step, 4); clap.play(60, t, 0.3, 90); g.emit('snare', t, 0.8); }
        if (step % 4 === 2) { const t = g.at(time, step, 4); hatO.play(46, t, 0.3, 90); g.emit('hat', t, 0.7); }
        if (step % 2 === 1 && g.rng() < 0.8) hatC.play(42, g.at(time, step, 4), 0.05, 55 + g.rng() * 15);
        if (shaker) shaker.play(61, g.at(time, step, 4), 0.05, step % 2 === 0 ? 70 : 55);
        // Basse
        const root = ROOTS[ci];
        if (step % 4 === 2) { const t = g.at(time, step, 4); bassSynth.triggerAttackRelease(mtof(root), g.d16 * 1.5, t, 0.9); g.emit('bass', t, 0.8, { root }); }
        if (step === 7 && g.rng() < 0.4) bassSynth.triggerAttackRelease(mtof(root + 12), g.d16, g.at(time, step, 4), 0.7);
        // Approche chromatique de la fondamentale SUIVANTE, seulement avant un changement d'accord.
        if (step === 15) {
          const nb = (bar + 1) % 8;
          const nci = nb === 7 ? 4 : nb === 6 ? 3 : Math.floor(nb / 2);
          if (nci !== ci && g.rng() < 0.45) bassSynth.triggerAttackRelease(mtof(ROOTS[nci] - 1), g.d16 * 0.8, g.at(time, step, 4), 0.6);
        }
        // Stabs
        if (CELLS[g.cellIdx ?? 0].includes(step)) {
          const t = g.at(time, step, 4);
          const v = 104 + g.rng() * 18;
          for (const n of CH[ci]) piano.play(n, t, 0.11, v);
          g.emit('stab', t, v / 127, { notes: CH[ci] });
        }
        // Montée de fin de boucle (toutes les 2 boucles), 4 s avant le premier temps
        if (cymbal && cymbal.use && absBar % 16 === 13 && step === 15) {
          // smplr ignore l'opcode offset du SFZ (7169 échantillons de pré-roll) : on avance de 0,16 s.
          const t = time + g.d16 + 2 * 16 * g.d16 - 4.0 - 0.16;
          if (t > ctx.currentTime) { cymbal.play(66, t, 4.2, 90); g.emit('riser', t, 1); }
        }
      };
    },

    // ---------------- Compétences · boom bap ----------------
    boombap(g) {
      const N = g.N;
      g.swingMode = 16;
      g.bus = makeBus(g, 2, { decay: 0.7, preDelay: 0.005, ret: 0 });
      const bus = g.bus;
      const D = drumSynths(g);
      const drumBus = N(new T.Compressor({ threshold: -18, ratio: 4, attack: 0.01, release: 0.12 }));
      drumBus.connect(bus.input);
      const dch = (db, pan = 0) => { const c = N(new T.Channel({ volume: db, pan })); c.connect(drumBus); return c; };
      const CH = { Fm9: [56, 60, 63, 67], Db: [53, 56, 60, 63], C7s9: [52, 55, 58, 63], C7b9: [52, 55, 58, 61] };
      const ROOT = { Fm9: 29, Db: 37, C7s9: 36, C7b9: 36 };
      const SEV = { Fm9: 10, Db: 11, C7s9: 10, C7b9: 10 };
      const GRID = ['Fm9', 'Fm9', 'Db', 'C7s9', 'Fm9', 'Fm9', 'Db', 'C7b9'];
      // Rhodes simulé + chaîne « sample »
      const keysCh = bus.channel(-11, 0, -16);
      const tape = [
        N(new T.Vibrato({ frequency: 0.55, depth: 0.06 })),
        N(new T.Filter({ type: 'lowpass', frequency: 3400, rolloff: -12 })),
        N(new T.Filter({ type: 'highpass', frequency: 90 })),
        N(new T.Distortion(0.08)),
      ];
      const trem = N(new T.Tremolo({ frequency: 4.2, depth: 0.35, spread: 120 })).start();
      const cho = N(new T.Chorus({ frequency: 1.2, delayTime: 3, depth: 0.25, wet: 0.3 })).start();
      trem.chain(cho, ...tape, keysCh);
      const rhodes = N(new T.PolySynth(T.FMSynth, {
        maxPolyphony: poly(8), harmonicity: 3, modulationIndex: 2.5,
        oscillator: { type: 'sine' }, modulation: { type: 'sine' },
        envelope: { attack: 0.002, decay: 1.6, sustain: 0.25, release: 0.9 },
        modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0.08, release: 0.5 },
      }));
      rhodes.connect(trem);
      // Vinyle
      const hiss = N(new T.Noise('pink'));
      const hissHp = N(new T.Filter({ type: 'highpass', frequency: 3000 }));
      hiss.chain(hissHp, bus.channel(-48));
      const crackle = N(new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0, decay: 0.004, sustain: 0, release: 0.002 } })).connect(bus.channel(-34));
      let hissOn = false;
      // Batterie
      const kickCh = dch(-3);
      const kLp = N(new T.Filter({ type: 'lowpass', frequency: 5000 }));
      const kDist = N(new T.Distortion(0.35));
      kDist.chain(kLp, kickCh);
      const kick = N(new T.MembraneSynth({ pitchDecay: 0.05, octaves: 4.5, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.55, sustain: 0, release: 0.05 } })).connect(kDist);
      const kclick = D.click(dch(-18), 3500);
      const snCh = dch(-6);
      const snNoise = D.noiseHit(dch(-14), 'bandpass', 1800, 0.16, 0.9);
      const snFb = D.kick(snCh, { pitchDecay: 0.01, octaves: 1, decay: 0.12 });
      const snare = role(g, snCh, { kind: 'vcsl', instrument: VCSL.snare, notes: [61], vel: [84, 127] }, (n, t, d, v) => snFb.triggerAttackRelease(190, 0.1, t, v));
      const clapCh = dch(-14);
      const clap = role(g, clapCh, { kind: 'vcsl', instrument: VCSL.claps, notes: [61], vel: [55, 106] }, null);
      const ghost = D.noiseHit(dch(-22), 'bandpass', 2200, 0.06, 1);
      const hatCh = dch(-17, 0.2);
      const hatFb = D.metal(hatCh, 0.05, 8000, -12);
      const hat = role(g, hatCh, { kind: 'vcsl', instrument: VCSL.hat, notes: [42, 46], vel: [55, 106] }, (n, t, d, v) => hatFb.triggerAttackRelease(400, n === 46 ? 0.3 : 0.05, t, v));
      // Contrebasse + sub
      const bassLp = N(new T.Filter({ type: 'lowpass', frequency: 700 }));
      bassLp.connect(bus.channel(1));
      const bassFb = N(new T.MonoSynth({ oscillator: { type: 'triangle' }, filter: { type: 'lowpass', frequency: 600, rolloff: -24 }, filterEnvelope: { baseFrequency: 250, octaves: 1, attack: 0.003, decay: 0.3, sustain: 0.3 }, envelope: { attack: 0.004, decay: 0.5, sustain: 0.3, release: 0.2 } })).connect(bassLp);
      const bass = role(g, bassLp, { kind: 'smolken', notes: BASS_NOTES, vel: [75, 120] }, (n, t, d, v) => bassFb.triggerAttackRelease(mtof(n), d, t, v));
      const sub = N(new T.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.2, sustain: 0.8, release: 0.15 } })).connect(bus.channel(-14));

      const CELLS = [[[0, 6], [7, 1], [10, 5]], [[0, 14]], [[3, 4], [10, 6]]];
      g.onStart = (t) => { if (!hissOn) { hiss.start(t); hissOn = true; } };
      g.onStop = (t) => { rhodes.releaseAll(t); bassFb.triggerRelease(t); sub.triggerRelease(t); if (hissOn) { hiss.stop(t + 0.05); hissOn = false; } };
      g.tick = (time, step, bar, absBar) => {
        const name = GRID[bar] === 'C7b9' && Math.floor(absBar / 8) % 2 === 0 ? 'C7s9' : GRID[bar];
        const d = g.d16;
        if (step === 0) {
          g.cell = CELLS[Math.floor(g.rng() * 3)];
          g.emit('bar', time, 1);
          g.emit('chord', time, 0.7, { notes: CH[name], root: ROOT[name] });
        }
        for (const [s, len] of g.cell || []) {
          if (s === step) rhodes.triggerAttackRelease(CH[name].map(mtof), len * d, g.at(time, step, 8), 0.55 + g.rng() * 0.15);
        }
        // Grosse caisse : mesure A (paire) / B (impaire)
        const A = bar % 2 === 0;
        let kv = 0;
        if (A) kv = step === 0 || step === 10 ? 1 : step === 7 ? 0.6 : 0;
        else if (step === 0 || step === 10) kv = 1;
        else if (step === 3 && g.rng() < 0.5) kv = 0.5;
        else if (step === 14 && g.rng() < 0.4) kv = 0.8;
        if (kv) {
          const t = g.at(time, step, 8);
          kick.triggerAttackRelease(mtof(29), 0.5, t, kv);
          kclick.triggerAttackRelease(0.003, t, 0.4 * kv);
          g.emit('kick', t, kv);
        }
        // Caisse claire en retard (+12 ms)
        if (step === 4 || step === 12) {
          const t = g.at(time, step, 8) + 0.012;
          snare.play(61, t, 0.5, 112 + g.rng() * 8);
          clap.play(61, t, 0.3, 90);
          snNoise.triggerAttackRelease(0.16, t, 0.8);
          g.emit('snare', t, 1);
        }
        if ((step === 7 || step === 15) && g.rng() < 0.35) ghost.triggerAttackRelease(0.05, g.at(time, step, 8), 0.35);
        // Charleston
        if (step % 2 === 0) {
          const open = bar === 3 && step === 14;
          const t = g.at(time, step, 8);
          hat.play(open ? 46 : 42, t, 0.2, step % 4 === 0 ? 100 : 60);
          g.emit('hat', t, 0.5);
        } else if (g.rng() < 0.45) {
          // Doubles fantômes sur les pas impairs : ce sont eux qui portent le swing (0,58), la tête qui hoche.
          hat.play(42, g.at(time, step, 8), 0.05, 55 + g.rng() * 7);
        }
        // Contrebasse
        const root = ROOT[name];
        const bNote = step === 0 ? [root, 6] : step === 7 ? [root + SEV[name], 2] : step === 10 ? [root, 4] : null;
        if (bNote) {
          const t = g.at(time, step, 8);
          bass.play(bNote[0], t, bNote[1] * d, 95);
          // Sinus à l'unisson de la contrebasse (octave 1, déjà grave) ; une octave plus bas seulement au-dessus de mi 2.
          sub.triggerAttackRelease(mtof(bNote[0] >= 40 ? bNote[0] - 12 : bNote[0]), bNote[1] * d * 0.9, t, 0.8);
          g.emit('bass', t, 0.9, { root: bNote[0] });
        }
        // Craquements (≈ 12 par seconde)
        const nCr = g.rng() < 0.5 ? 1 : g.rng() < 0.6 ? 2 : 3;
        // Heures croissantes : un même synthé ne se programme pas en arrière.
        for (let i = 0; i < nCr; i++) {
          const t = time + ((i + g.rng() * 0.75) / nCr) * d; // écart minimal ≈ 14 ms > enveloppe (6 ms)
          const v = 0.05 + g.rng() * 0.25;
          crackle.triggerAttackRelease(0.004, t, v);
          if (v > 0.22) g.emit('crackle', t, v);
        }
      };
    },

    // ---------------- Expériences · soul / funk ----------------
    soul(g) {
      const N = g.N;
      g.swingMode = 16;
      g.bus = makeBus(g, -2, { decay: 1.8, preDelay: 0.02, ret: 0 });
      const bus = g.bus;
      const D = drumSynths(g);
      const busComp = N(new T.Compressor({ threshold: -18, ratio: 2, attack: 0.01, release: 0.15 }));
      busComp.connect(bus.input);
      const ch = (db, pan = 0, send = null) => {
        const c = N(new T.Channel({ volume: db, pan }));
        c.connect(busComp);
        if (send != null && bus.rev) { const s = N(new T.Gain(T.dbToGain(send))); c.connect(s); s.connect(bus.rev); }
        return c;
      };
      const KEYS = { Em9: [62, 66, 67, 71], A13: [61, 66, 67, 71], Cmaj9: [59, 62, 64, 67], B7s9: [63, 69, 74] };
      const HORNS = { Em9: [67, 71, 76], A13: [64, 69, 73], Cmaj9: [64, 67, 71], B7s9: [63, 66, 69] };
      const TR = { Em9: 0, A13: 5, Cmaj9: 8, B7s9: 7 };
      const GRID = ['Em9', 'Em9', 'A13', 'A13', 'Em9', 'A13', 'Cmaj9', 'B7s9'];
      // Guitare funk
      const gtCh = ch(-12, 0.45);
      const comp = N(new T.Compressor({ threshold: -20, ratio: 3 }));
      const gcho = N(new T.Chorus({ frequency: 1.5, delayTime: 2.5, depth: 0.2, wet: 0.25 })).start();
      const wah = N(new T.AutoWah({ baseFrequency: 350, octaves: 4, sensitivity: -30, Q: 3 }));
      wah.chain(gcho, comp, gtCh);
      // Pas de PluckSynth : il passe par un AudioWorklet, et Opera coupait alors toute la sortie audio de la page.
      const plucks = [0, 1, 2].map(() => N(new T.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.002, decay: 0.16, sustain: 0, release: 0.08 }, volume: -10 })).connect(wah));
      const chicka = D.noiseHit(ch(-20, 0.45), 'bandpass', 2400, 0.03, 1.5);
      // Basse slap
      const bComp = N(new T.Compressor({ threshold: -20, ratio: 4 }));
      bComp.connect(ch(-6));
      const bassSynth = N(new T.MonoSynth({
        oscillator: { type: 'square' }, filter: { type: 'lowpass', rolloff: -24, Q: 4 },
        filterEnvelope: { attack: 0.001, decay: 0.09, sustain: 0.15, release: 0.05, baseFrequency: 160, octaves: 4.2 },
        envelope: { attack: 0.001, decay: 0.25, sustain: 0.45, release: 0.05 },
      })).connect(bComp);
      // « Pop » : dent de scie filtrée qui claque (un triangle passé au passe-haut ne laissait presque rien).
      const popHp = N(new T.Filter({ type: 'highpass', frequency: 400 }));
      popHp.connect(ch(-9));
      const pop = N(new T.MonoSynth({
        oscillator: { type: 'sawtooth' }, filter: { type: 'lowpass', rolloff: -24, Q: 2 },
        filterEnvelope: { baseFrequency: 900, octaves: 3, attack: 0.001, decay: 0.06, sustain: 0, release: 0.05 },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
      })).connect(popHp);
      // Cuivres : trois voix séparées pour les chutes
      const hornCh = ch(-11, 0, -10);
      const hVib = N(new T.Vibrato({ frequency: 5, depth: 0.08 }));
      hVib.connect(hornCh);
      const horns = [0, 1, 2].map((i) => N(new T.MonoSynth({
        oscillator: mobile ? { type: 'sawtooth' } : { type: 'fatsawtooth', count: 3, spread: 16 },
        filter: { type: 'lowpass', rolloff: -24 },
        filterEnvelope: { attack: 0.04, decay: 0.25, sustain: 0.6, release: 0.15, baseFrequency: 500, octaves: 2.8 },
        envelope: { attack: 0.03, decay: 0.2, sustain: 0.75, release: 0.15 }, volume: i === 0 ? 0 : -3,
      })).connect(hVib));
      // Clavier
      const keys = N(new T.PolySynth(T.FMSynth, { maxPolyphony: poly(8), harmonicity: 3, modulationIndex: 3.2, envelope: { attack: 0.002, decay: 1.2, sustain: 0.3, release: 0.6 }, modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0.1, release: 0.4 } }));
      keys.connect(ch(-15, -0.2, -16));
      // Batterie
      const kick = D.kick(ch(-5), { pitchDecay: 0.03, octaves: 3.5, decay: 0.28 });
      const snCh = ch(-7, 0, -14);
      const snFb = D.kick(snCh, { pitchDecay: 0.01, octaves: 1, decay: 0.12 });
      const snNoise = D.noiseHit(ch(-16, 0, -14), 'bandpass', 2000, 0.15, 0.9);
      const snare = role(g, snCh, { kind: 'vcsl', instrument: VCSL.snare, notes: [61], vel: [84, 127] }, (n, t, d, v) => snFb.triggerAttackRelease(190, 0.1, t, v));
      const ghost = D.noiseHit(ch(-20), 'bandpass', 2200, 0.05, 1);
      const hatCh = ch(-19, 0.25);
      const hatFb = D.metal(hatCh, 0.05, 8000, -12);
      const hat = role(g, hatCh, { kind: 'vcsl', instrument: VCSL.hat, notes: [42, 46], vel: [55, 106] }, (n, t, d, v) => hatFb.triggerAttackRelease(400, n === 46 ? 0.3 : 0.05, t, v));
      const tambCh = ch(-18, -0.35);
      const tambFb = D.noiseHit(tambCh, 'highpass', 7000, 0.08, 0.7);
      const tamb = role(g, tambCh, { kind: 'vcsl', instrument: VCSL.tamb, notes: [60, 62], vel: [55, 106] }, (n, t, d, v) => tambFb.triggerAttackRelease(0.08, t, v));

      const SLAP = { 0: [28, 2, 'thumb'], 3: [28, 0.3, 'dead'], 4: [40, 1, 'pop'], 6: [28, 1, 'thumb'], 7: [31, 1, 'thumb'], 8: [33, 2, 'thumb'], 10: [40, 1, 'pop'], 11: [28, 0.3, 'dead'], 12: [38, 1, 'thumb'], 13: [35, 1, 'thumb'], 14: [40, 1, 'pop'], 15: [28, 0.3, 'dead'] };
      const fall = (h, t, dur) => {
        h.detune.cancelScheduledValues(t);
        h.detune.setValueAtTime(0, t);
        h.detune.setValueAtTime(0, t + dur - 0.18);
        h.detune.linearRampToValueAtTime(-300, t + dur);
        h.detune.setValueAtTime(0, t + dur + 0.2);
      };
      g.onStop = (t) => { keys.releaseAll(t); horns.forEach((h) => h.triggerRelease(t)); bassSynth.triggerRelease(t); };
      g.tick = (time, step, bar) => {
        const name = GRID[bar];
        const d = g.d16;
        if (step === 0) {
          g.emit('bar', time, 1);
          g.emit('chord', time, 0.7, { notes: KEYS[name] });
          g.drop = new Set();
          [0, 4, 8, 12, 1, 5, 9, 13].forEach((s) => { if (g.rng() < 0.3 && g.drop.size < 2 && s !== 0) g.drop.add(s); });
          g.kickVar = g.rng() < 0.3;
        }
        const t = g.at(time, step, 4);
        // Guitare : accords secs 2, 7s, 10, 15s ; grattés 0, 1s, 4, 5s, 8, 9s, 12, 13s
        if (step === 2 || step === 7 || step === 10 || step === 15) {
          KEYS[name].slice(-3).forEach((n, i) => { plucks[i].triggerAttack(mtof(n), t + i * 0.004); });
        } else if ([0, 1, 4, 5, 8, 9, 12, 13].includes(step) && !g.drop.has(step)) {
          chicka.triggerAttackRelease(0.03, t, 0.6);
        }
        // Basse
        const sl = SLAP[step];
        if (sl) {
          const n = sl[0] + TR[name];
          const accent = step === 0 ? 1 : 0.8;
          if (sl[2] === 'dead') bassSynth.triggerAttackRelease(mtof(n), 0.03, t, 0.35);
          else {
            bassSynth.triggerAttackRelease(mtof(n), sl[1] * d, t, sl[2] === 'pop' ? 1 : accent);
            if (sl[2] === 'pop') pop.triggerAttackRelease(mtof(n + 12), 0.1, t, 0.8);
            g.emit('bass', t, accent, { root: n });
          }
        }
        // Clavier
        if (step === 4 || step === 12) keys.triggerAttackRelease(KEYS[name].map(mtof), 3 * d, t, 0.5);
        // Cuivres, mesures 2, 4 et 8
        if (bar === 1 || bar === 3 || bar === 7) {
          if (step === 10 || step === 12) {
            HORNS[name].forEach((n, i) => horns[i].triggerAttackRelease(mtof(n), d * 0.9, t, 0.85));
            g.emit('stab', t, 0.9, { notes: HORNS[name] });
          }
          if (step === 14) {
            const nx = HORNS[GRID[(bar + 1) % 8]];
            const dur = 4 * d;
            nx.forEach((n, i) => { horns[i].triggerAttackRelease(mtof(n), dur, t, 0.8); fall(horns[i], t, dur); });
            g.emit('stab', t, 0.8, { notes: nx });
          }
        }
        // Batterie
        if (step === 0 || step === 10 || step === (g.kickVar ? 3 : 7)) { kick.triggerAttackRelease(mtof(38), 0.3, t, step === 0 ? 1 : 0.85); g.emit('kick', t, step === 0 ? 1 : 0.8); }
        if (step === 4 || step === 12) { snare.play(61, t, 0.4, 110); snNoise.triggerAttackRelease(0.15, t, 0.6); g.emit('snare', t, 1); }
        if ((step === 6 && g.rng() < 0.6) || (step === 9 && g.rng() < 0.4) || (step === 15 && g.rng() < 0.5)) ghost.triggerAttackRelease(0.05, t, 0.3);
        const open = step === 14 && g.rng() < 0.5;
        hat.play(open ? 46 : 42, t, 0.1, step % 2 === 0 ? 85 : 55);
        if (step % 2 === 0) g.emit('hat', t, 0.5);
        if (step === 4 || step === 12) tamb.play(60, t, 0.2, 80);
        else if (bar >= 4 && g.rng() < 0.25) tamb.play(62, t, 0.1, 60);
      };
    },
  };

  return {
    start, goTo, pause, resume, setVolume, setMuted, frame, onVisibility, dispose,
    togglePause() { if (paused) resume(); else pause(); },
    toggleMute() { setMuted(!muted); },
    hint(idx) { if (ready) { priority.clear(); priority.add(idx); pumpLoads(); } },
    get state() { return state; },
    get ready() { return ready; },
    get failed() { return failed; },
    get paused() { return paused; },
    get muted() { return muted; },
    get volume() { return volume; },
    get active() { return active; },
    get entryTime() { return entryTime; },
    // Débogage (console) : nœuds du master pour mesurer les niveaux.
    debug: { get ctx() { return ctx; }, get masterIn() { return masterIn; }, get gainPause() { return gainPause; }, get genres() { return genres; } },
  };
}
