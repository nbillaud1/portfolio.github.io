// La nappe : un seul maillage de rubans (ShaderMaterial maison), déplacement dans le vertex shader,
// spectre gravé (DataTexture d'historique), anneaux, onde de choc de transition, caméra et post-traitement.
// Réf. : docs/design/DA.md §2, §3, §4.2, §6.
import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  ChromaticAberrationEffect, VignetteEffect, NoiseEffect, BlendFunction,
} from 'postprocessing';
import { GENRES, swellDir, mixOklch, oklchToHex } from './genres.js';

const RINGS = 16;
const HIST_W = 256;
const HIST_H = 64;

// ---------- Shaders ----------
const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
`;

const VERT = /* glsl */ `
precision highp float;
attribute float aRank;
uniform float uTime, uLines, uPoints;
uniform vec3 uExt;            // demi-étendue x, z proche, z lointain
uniform float uA, uLambda, uTurb, uS, uRock, uStep, uActive;
uniform vec3 uPhase;
uniform vec2 uDir0, uDir1, uDir2;
uniform vec3 uNoise;          // fréquence, décalage z (défilement), temps
uniform sampler2D uHist;
uniform float uHistHead, uHistFrac;
uniform vec4 uRingA[${RINGS}];
uniform vec4 uRingB[${RINGS}];
uniform vec4 uShock;          // x, z, rayon, hauteur
uniform float uShockAccent;
uniform vec4 uReveal;         // x, z, rayon, actif
uniform float uJump, uOne, uDust, uScint, uScintRate, uScintSeed, uBase, uMid;
uniform vec3 uPalA0, uPalA1, uPalA2, uPalB0, uPalB1, uPalB2; // lueur, ligne, accent (OKLCH)
uniform vec2 uFade;
uniform float uWidth, uHorizon, uDpr, uOpacity, uGain, uSat;
uniform vec2 uRes;
varying vec3 vColor;
varying float vEdge;
varying float vHalf;
${NOISE_GLSL}

vec3 lchToLin(vec3 c){
  float h = radians(c.z);
  float A = c.y * cos(h), B = c.y * sin(h);
  float l_ = c.x + 0.3963377774*A + 0.2158037573*B;
  float m_ = c.x - 0.1055613458*A - 0.0638541728*B;
  float s_ = c.x - 0.0894841775*A - 1.2914855480*B;
  float l = l_*l_*l_, m = m_*m_*m_, s = s_*s_*s_;
  return max(vec3(
     4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
    -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
    -0.0041960863*l - 0.7034186147*m + 1.7076147010*s), 0.0);
}

float swells(vec2 p){
  const float TAU = 6.2831853;
  // Somme normalisée (1 + 0,45 + 0,2 = 1,65) : A reste l'amplitude de crête.
  return (sin(TAU*dot(uDir0, p)/uLambda - uPhase.x)
       + 0.45*sin(TAU*dot(uDir1, p)/(0.53*uLambda) - uPhase.y)
       + 0.2*sin(TAU*dot(uDir2, p)/(0.29*uLambda) - uPhase.z)) * 0.6061;
}

float spectrum(vec2 p){
  float col = clamp(abs(p.x) / uExt.x, 0.0, 1.0);
  float ageZ = (-6.0 - p.y) / (-6.0 - uExt.z) * float(${HIST_H - 1});
  float age = clamp(ageZ - uHistFrac, 0.0, float(${HIST_H - 1}));
  float v = texture2D(uHist, vec2((col*float(${HIST_W - 1}) + 0.5)/float(${HIST_W}), (mod(uHistHead - age, float(${HIST_H})) + 0.5)/float(${HIST_H}))).r;
  float front = p.y > -6.0 ? 1.0 - smoothstep(-6.0, 4.0, p.y) : 1.0;
  return v * front;
}

float rings(vec2 p){
  float y = 0.0;
  for (int i = 0; i < ${RINGS}; i++) {
    vec4 r = uRingA[i];
    if (r.w <= 0.0) continue;
    float age = uTime - r.z;
    if (age < 0.0) continue;
    vec4 q = uRingB[i];
    float x = distance(p, r.xy) - q.x * age;
    y += r.w * exp(-q.z * age) * sin(6.2831853 * x / q.y) * exp(-(x*x) / 1.44);
  }
  return y;
}

float heightAt(float u, float z){
  float x = mix(-uExt.x, uExt.x, u);
  float idx = u * (uPoints - 1.0);
  float xq = mix(-uExt.x, uExt.x, floor(idx / 6.0) * 6.0 / (uPoints - 1.0));
  float xe = mix(x, xq, uStep);
  vec2 p = vec2(xe, z);
  float edge = 1.0 - smoothstep(uExt.x - 5.0, uExt.x, abs(xe));
  float n = snoise(vec3(xe*uNoise.x, z*uNoise.x + uNoise.y, uNoise.z));
  n += 0.5 * snoise(vec3(xe*uNoise.x*2.02, (z*uNoise.x + uNoise.y)*2.02, uNoise.z*1.7 + 3.1));
  n += 0.25 * snoise(vec3(xe*uNoise.x*4.1, (z*uNoise.x + uNoise.y)*4.1, uNoise.z*2.3 + 7.7));
  float y = edge * uA * (swells(p) + uTurb * n);
  y += uS * spectrum(p) * (1.0 - smoothstep(uExt.x - 1.5, uExt.x, abs(xe)));
  y += rings(p);
  float ds = distance(p, uShock.xy) - uShock.z;
  y += uShock.w * exp(-ds*ds / 1.44);
  y += uJump * smoothstep(-11.0, -9.0, z);
  float yr = sign(y) * pow(abs(y), 0.7) * 1.15;
  y = mix(y, yr, uRock);
  y = mix(y, floor(y * 10.0) / 10.0, 0.6 * uStep);
  return y;
}

void main(){
  float u = position.x;
  float line = position.y;
  float side = position.z;
  float z = mix(uExt.y, uExt.z, line / (uLines - 1.0));
  float du = 1.0 / (uPoints - 1.0);
  float y0 = heightAt(u, z);
  float y1 = heightAt(u + du, z);
  vec3 p0 = vec3(mix(-uExt.x, uExt.x, u), y0, z);
  vec3 p1 = vec3(mix(-uExt.x, uExt.x, u + du), y1, z);
  mat4 vp = projectionMatrix * viewMatrix;
  vec4 c0 = vp * vec4(p0, 1.0);
  vec4 c1 = vp * vec4(p1, 1.0);
  vec2 s0 = c0.xy / c0.w * uRes * 0.5;
  vec2 s1 = c1.xy / c1.w * uRes * 0.5;
  vec2 dir = s1 - s0;
  float L = length(dir);
  dir = L > 1e-5 ? dir / L : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float dist = distance(cameraPosition, p0);
  float depthT = smoothstep(uFade.x, uFade.y, dist);
  float w = uWidth * uDpr * mix(1.0, uHorizon, smoothstep(3.0, uFade.y, dist));
  float hw = w * 0.5 + 1.0;
  c0.xy += nrm * side * hw / (uRes * 0.5) * c0.w;
  gl_Position = c0;
  vEdge = side * hw;
  vHalf = w * 0.5;

  // Palette portée par l'onde de choc (DA §3.2)
  float dsh = distance(p0.xz, uShock.xy);
  float m = 1.0 - smoothstep(uShock.z - 3.0, uShock.z, dsh);
  vec3 glow = lchToLin(mix(uPalA0, uPalB0, m));
  vec3 lineC = lchToLin(mix(uPalA1, uPalB1, m));
  vec3 accent = lchToLin(mix(uPalA2, uPalB2, m));

  float crest = smoothstep(0.0, max(uA, 0.05), y0);
  float pid = floor(u * (uPoints - 1.0) + 0.5);
  float h1 = hash13(vec3(line + 0.5, pid + 0.5, floor(uTime * uScintRate) + uScintSeed));
  float I = uBase + 1.1 * crest + uMid + uScint * 3.0 * step(0.965, h1);
  float h2 = hash13(vec3(pid + 3.3, line + 1.7, floor(uTime * 25.0)));
  I += uDust * 5.0 * step(0.997, h2);
  // L'accent (presque blanc) reste réservé aux plus hautes crêtes : sinon la teinte du genre se délave.
  vec3 col = I < 0.6 ? mix(glow, lineC, I / 0.6) : mix(lineC, accent, smoothstep(1.0, 2.2, I));
  float shockLine = uShock.w > 0.0 ? exp(-pow(dsh - uShock.z, 2.0)) : 0.0;
  float accentMix = (mod(line, 2.0) < 0.5 ? uOne * 0.7 : 0.0) + shockLine * uShockAccent;
  col = mix(col, accent, clamp(accentMix, 0.0, 1.0));
  float weight = 1.0 - smoothstep(uActive - 0.03, uActive + 0.03, aRank);
  // Densité à l'écran : quand les lignes se recouvrent (horizon rasant), chacune éclaire moins.
  float spacing = (uExt.y - uExt.z) / (uLines - 1.0) / max(uActive, 0.2);
  vec4 cn = vp * vec4(p0.x, y0, z - spacing, 1.0);
  float gap = length(cn.xy / cn.w * uRes * 0.5 - s0);
  weight *= clamp(gap / (w + 1.5), 0.04, 1.0);
  float nearF = smoothstep(0.8, 2.5, dist);
  vec3 outc = col * I * uGain;
  // Saturation relevée avant l'addition des lignes et le tone mapping, qui la font baisser.
  outc = max(mix(vec3(dot(outc, vec3(0.2126, 0.7152, 0.0722))), outc, uSat), 0.0);
  // Fondu en profondeur obligatoire : vers la lueur × 0,25, puis vers le fond (sinon l'additif sature l'horizon)
  outc = mix(outc, glow * 0.25, depthT) * (1.0 - depthT) * (1.0 - depthT);
  float rev = uReveal.w > 0.5 ? 1.0 - smoothstep(uReveal.z - 4.0, uReveal.z, distance(p0.xz, uReveal.xy)) : 1.0;
  vColor = outc * weight * nearF * rev * uOpacity;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vEdge;
varying float vHalf;
void main(){
  float a = clamp(vHalf + 0.5 - abs(vEdge), 0.0, 1.0) * min(vHalf * 2.0, 1.0);
  gl_FragColor = vec4(vColor * a, 1.0);
}
`;

// ---------- Paramètres interpolés ----------
const KEYS = [
  'active', 'A', 'lambda', 'v', 'travel', 'turb', 'S', 'width', 'horizon', 'base', 'fade0', 'fade1',
  'rock', 'step', 'spring', 'pump', 'bloomI', 'bloomR', 'bloomT', 'grain', 'vignette',
  'kB', 'kL', 'kM', 'scint', 'scintRate', 'ringC', 'ringLr', 'ringDec', 'ringForce',
  'd0x', 'd0z', 'd1x', 'd1z', 'd2x', 'd2z', 'drift', 'dolly', 'bassRing', 'kickRing', 'gain',
];
// Gain de lumière par section : les sections à beaucoup de texte baissent la nappe pour rester lisibles.
const READ_GAIN = { ambient: 1.2, jazz: 0.85, house: 0.42, boombap: 0.7, soul: 0.85 };
const K = Object.fromEntries(KEYS.map((k, i) => [k, i]));

function genreVector(g, mobile) {
  const v = g.vis;
  const out = new Float32Array(KEYS.length);
  const d = v.angles.map(swellDir);
  const vals = {
    active: (v.active / 160) * (mobile ? 0.6 : 1), A: v.A, lambda: v.lambda, v: v.v, travel: v.travel,
    turb: v.turb, S: v.S, width: v.width * (mobile ? 1.2 : 1), horizon: v.horizon, base: v.base,
    fade0: v.fade[0], fade1: v.fade[1], rock: v.rock, step: mobile ? 0 : v.step, spring: v.spring, pump: v.pump,
    bloomI: v.bloom[0] * (mobile ? 0.8 : 1), bloomR: v.bloom[1], bloomT: v.bloom[2], grain: v.grain, vignette: v.vignette,
    kB: v.kB, kL: v.kL, kM: v.kM, scint: v.scint, scintRate: v.scintRate,
    ringC: v.ring.c, ringLr: v.ring.lr, ringDec: v.ring.dec, ringForce: v.ring.force,
    d0x: d[0][0], d0z: d[0][1], d1x: d[1][0], d1z: d[1][1], d2x: d[2][0], d2z: d[2][1],
    drift: g.key === 'ambient' ? 1 : 0, dolly: g.key === 'jazz' ? 1 : 0,
    bassRing: g.key === 'jazz' ? 1 : 0, kickRing: g.key === 'house' ? 1 : 0, gain: READ_GAIN[g.key],
  };
  for (const k of KEYS) out[K[k]] = vals[k];
  return out;
}

function radicalInverse(i) {
  let b = i, r = 0, f = 0.5;
  while (b > 0) { r += f * (b & 1); b >>= 1; f *= 0.5; }
  return r;
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const p2io = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const p3io = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sineIO = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

// ---------- Création ----------
export function createScene(canvas, { mobile = false, reduced = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: false });
  } catch (err) {
    console.warn('WebGL indisponible : repli sans 3D.', err && err.message);
    return null;
  }
  if (!renderer.capabilities.isWebGL2 || renderer.capabilities.maxVertexTextures < 1) {
    renderer.dispose();
    console.warn('WebGL 2 avec textures de sommets requis : repli sans 3D.');
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const dprCap = mobile ? 1.5 : 2;
  let dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);

  // Géométrie (DA §2.1)
  const N = mobile ? 64 : 160;
  const P = mobile ? 256 : 512;
  const ext = mobile ? [10, 4, -34] : [14, 4, -44];
  const vcount = N * P * 2;
  const pos = new Float32Array(vcount * 3);
  const rank = new Float32Array(vcount);
  let o = 0;
  for (let i = 0; i < N; i++) {
    const r = radicalInverse(i);
    for (let j = 0; j < P; j++) {
      for (let s = -1; s <= 1; s += 2) {
        pos[o * 3] = j / (P - 1); pos[o * 3 + 1] = i; pos[o * 3 + 2] = s;
        rank[o] = r; o++;
      }
    }
  }
  const idx = new Uint32Array(N * (P - 1) * 6);
  o = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < P - 1; j++) {
      const a = (i * P + j) * 2;
      idx[o++] = a; idx[o++] = a + 2; idx[o++] = a + 1;
      idx[o++] = a + 1; idx[o++] = a + 2; idx[o++] = a + 3;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('aRank', new THREE.BufferAttribute(rank, 1));
  geometry.setIndex(new THREE.BufferAttribute(idx, 1));

  const histData = new Uint8Array(HIST_W * HIST_H);
  const hist = new THREE.DataTexture(histData, HIST_W, HIST_H, THREE.RedFormat, THREE.UnsignedByteType);
  hist.minFilter = THREE.LinearFilter; hist.magFilter = THREE.LinearFilter;
  hist.wrapS = THREE.ClampToEdgeWrapping; hist.wrapT = THREE.RepeatWrapping;
  hist.needsUpdate = true;

  const ringA = Array.from({ length: RINGS }, () => new THREE.Vector4(0, 0, 0, 0));
  const ringB = Array.from({ length: RINGS }, () => new THREE.Vector4(1, 1, 1, 0));
  const g0 = GENRES[0];
  const U = {
    uTime: { value: 0 }, uLines: { value: N }, uPoints: { value: P },
    uExt: { value: new THREE.Vector3(...ext) },
    uA: { value: 0.5 }, uLambda: { value: 10 }, uTurb: { value: 0.1 }, uS: { value: 0 }, uRock: { value: 0 }, uStep: { value: 0 }, uActive: { value: 1.1 },
    uPhase: { value: new THREE.Vector3() },
    uDir0: { value: new THREE.Vector2(0, 1) }, uDir1: { value: new THREE.Vector2(0, 1) }, uDir2: { value: new THREE.Vector2(0, 1) },
    uNoise: { value: new THREE.Vector3(0.03, 0, 0) },
    uHist: { value: hist }, uHistHead: { value: 0 }, uHistFrac: { value: 0 },
    uRingA: { value: ringA }, uRingB: { value: ringB },
    uShock: { value: new THREE.Vector4(0, -9, 999, 0) }, uShockAccent: { value: 0 },
    uReveal: { value: new THREE.Vector4(0, -9, 0, 1) },
    uJump: { value: 0 }, uOne: { value: 0 }, uDust: { value: 0 }, uScint: { value: 0 }, uScintRate: { value: 8 }, uScintSeed: { value: 0 },
    uBase: { value: 0.35 }, uMid: { value: 0 },
    uPalA0: { value: new THREE.Vector3(...g0.oklch.glow) }, uPalA1: { value: new THREE.Vector3(...g0.oklch.line) }, uPalA2: { value: new THREE.Vector3(...g0.oklch.accent) },
    uPalB0: { value: new THREE.Vector3(...g0.oklch.glow) }, uPalB1: { value: new THREE.Vector3(...g0.oklch.line) }, uPalB2: { value: new THREE.Vector3(...g0.oklch.accent) },
    uFade: { value: new THREE.Vector2(6, 40) },
    uGain: { value: 1.6 }, uSat: { value: 1.15 }, uWidth: { value: 1.1 }, uHorizon: { value: 0.45 }, uDpr: { value: dpr }, uOpacity: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // Post-traitement (DA §6.1)
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new BloomEffect({ mipmapBlur: true, levels: mobile ? 5 : 8, intensity: 1.5, radius: 0.8, luminanceThreshold: 0.55, luminanceSmoothing: 0.12 });
  // Neutral (Khronos) plutôt qu'AgX : AgX désaturait les hautes lumières (or et orange viraient au beige, le vert au kaki).
  const toneMap = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
  composer.addPass(new EffectPass(camera, bloom, toneMap));
  const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.7 });
  let chroma = null, noise = null;
  const chromaBase = new THREE.Vector2(0.0006, 0.0003);
  if (!mobile) {
    chroma = new ChromaticAberrationEffect({ offset: chromaBase.clone(), radialModulation: true, modulationOffset: 0.25 });
    noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
    noise.blendMode.opacity.value = 0.06;
    composer.addPass(new EffectPass(camera, chroma));
    composer.addPass(new EffectPass(camera, vignette, noise));
  } else {
    composer.addPass(new EffectPass(camera, vignette));
  }

  // Nom du genre posé dans la scène (DA §5.1), ordinateur seulement. troika-three-text 0.53 ne lit pas
  // le woff2 (seul format des polices installées) : on dessine la Fraunces chargée dans une texture canvas.
  let label = null;
  let labelTarget = GENRES[0].label.toUpperCase();
  let labelText = '';
  if (!mobile) {
    const lc = document.createElement('canvas');
    lc.width = 2048; lc.height = 256;
    const lctx = lc.getContext('2d');
    const ltex = new THREE.CanvasTexture(lc);
    ltex.colorSpace = THREE.SRGBColorSpace;
    const lmat = new THREE.MeshBasicMaterial({ map: ltex, color: new THREE.Color(GENRES[0].palette.line), transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    // Petit, loin, calé à l'écran à droite de la bande des titres (x ≈ 68–94 %, y ≈ 40–45 %) pour chaque pose de
    // caméra : il ne se mêle plus aux lettres des titres HTML (voir labelPose).
    const lgeo = new THREE.PlaneGeometry(1.2 * 8, 1.2);
    const lmesh = new THREE.Mesh(lgeo, lmat);
    lmesh.renderOrder = -1;
    scene.add(lmesh);
    label = {
      mesh: lmesh, mat: lmat, tex: ltex, geo: lgeo,
      set text(t) {
        if (t === labelText) return;
        labelText = t;
        lctx.clearRect(0, 0, lc.width, lc.height);
        lctx.fillStyle = '#ffffff';
        lctx.textBaseline = 'middle';
        lctx.font = '250 200px "Fraunces Variable", Georgia, serif';
        const sp = 0.2 * 200;
        const widths = [...t].map((c) => lctx.measureText(c).width);
        const total = widths.reduce((a, b) => a + b, 0) + sp * (t.length - 1);
        let x = (lc.width - total) / 2;
        [...t].forEach((c, i) => { lctx.fillText(c, x, lc.height / 2 + 8); x += widths[i] + sp; });
        ltex.needsUpdate = true;
      },
      get text() { return labelText; },
      set color(hex) { lmat.color.set(hex); },
      dispose() { lgeo.dispose(); lmat.dispose(); ltex.dispose(); },
    };
    label.text = labelTarget;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!disposed) { labelText = ''; label.text = labelTarget; } });
  }

  // ---------- État ----------
  const vectors = GENRES.map((g) => genreVector(g, mobile));
  const Pcur = Float32Array.from(vectors[0]);
  const Pfrom = Float32Array.from(vectors[0]);
  let Pto = vectors[0];
  const palCur = { glow: [...g0.oklch.glow], line: [...g0.oklch.line], accent: [...g0.oklch.accent], bg: [...g0.oklch.bg] };
  const palFrom = { glow: [...palCur.glow], line: [...palCur.line], accent: [...palCur.accent], bg: [...palCur.bg] };
  let palTo = GENRES[0].oklch;
  const bgColor = new THREE.Color(g0.palette.bg);
  const clearColor = new THREE.Color().copy(bgColor);
  renderer.setClearColor(clearColor, 1);

  const camState = {
    pos: new THREE.Vector3(...g0.cam.pos), look: new THREE.Vector3(...g0.cam.look), fov: g0.cam.fov + (mobile ? 8 : 0), roll: 0,
  };
  const camFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 38, roll: 0 };
  const camTo = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 38, roll: 0 };
  const camMid = new THREE.Vector3();
  let camCurve = null;
  const tmpV = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  // Pose du nom 3D pour la caméra d'un genre : un point fixe de l'écran (NDC 0,62 ; 0,16), à 34 u de la caméra.
  const labelCam = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  const labelFrom = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const labelTo = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  function labelPose(i, outP, outQ) {
    const c = GENRES[i].cam;
    labelCam.position.set(...c.pos);
    labelCam.fov = c.fov + (mobile ? 8 : 0);
    labelCam.aspect = camera.aspect;
    labelCam.updateProjectionMatrix();
    labelCam.lookAt(tmpLook.set(...c.look));
    labelCam.updateMatrixWorld();
    outP.set(0.62, 0.16, 0.5).unproject(labelCam).sub(labelCam.position).normalize().multiplyScalar(34).add(labelCam.position);
    outQ.copy(labelCam.quaternion);
  }

  const tr = { active: false, t: 0, dur: 2, dir: 1, to: 0, from: 0, scratch: 0.1, bgFrom: new THREE.Color(), bgTo: new THREE.Color() };
  let current = 0;
  let time = 0;
  let travel = 0;
  let travelSpeed = 0;
  const phase = [0, 0, 0];
  let noiseOff = 0;
  let ringNext = 0;
  const env = { pump: 0, kickCam: 0, trauma: 0, nod: 0, jump: 0, jumpAt: -1, one: 0, lift: 0, dust: 0, flash: 0, chroma: 0, springX: 0, springV: 0, scratchB: 0 };
  let lastFlash = -10;
  let lastEventRing = -10;
  const lastAttackRing = [-10, -10, -10, -10];
  let scrollVel = 0;
  let calm = 0, calmCur = 0; // 0 = nappe pleine (transition), 1 = mode lecture (nappe en retrait)
  let pausedF = 0;
  let pausedTarget = 0;
  let histHead = 0;
  let histAcc = 0;
  let entered = false;
  let entry = null;
  let disposed = false;
  let contextLost = false;
  let opEntry = 1;
  let opTr = 1;
  let labelScramble = 0;
  const SCRAMBLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  function pushRing(x, z, force, c, lr, dec) {
    const i = ringNext; ringNext = (ringNext + 1) % RINGS;
    ringA[i].set(x, z, time, force);
    ringB[i].set(c, lr, dec, 0);
  }

  function flashAllowed() {
    if (time - lastFlash < 0.34) return false;
    lastFlash = time;
    return true;
  }

  // ---------- DPR adaptatif (DA §6.2) ----------
  // L'intervalle entre images est comparé à la cadence réelle de l'écran (estimée), pas à 60 i/s fixes : sur un écran
  // ou un navigateur bridé à 60 (ou 30) i/s, une image à 16,7 ms (ou 33 ms) est normale.
  const dprMax = Math.min(window.devicePixelRatio || 1, dprCap);
  const INTERVALS = [1000 / 240, 1000 / 165, 1000 / 144, 1000 / 120, 1000 / 90, 1000 / 75, 1000 / 60, 1000 / 50, 1000 / 30];
  const perf = {
    buf: new Float32Array(120), tmp: new Float32Array(120), n: 0, i: 0, count: 0,
    refresh: 0, med: 0, slow: 0, good: 0, skip: 0, probe: null, noRaiseUntil: 0, noDropUntil: 0,
  };
  const snapInterval = (ms) => { for (const v of INTERVALS) if (Math.abs(ms - v) <= 0.06 * v) return v; return ms; };
  function quantile(q) {
    const a = perf.tmp.subarray(0, perf.n);
    a.set(perf.buf.subarray(0, perf.n));
    a.sort();
    return a[Math.min(perf.n - 1, Math.floor(q * perf.n))];
  }
  function perfReset(skip) {
    perf.n = 0; perf.i = 0; perf.count = 0; perf.slow = 0; perf.good = 0; perf.med = 0;
    perf.skip = Math.max(perf.skip, skip);
  }
  function setDpr(v) { dpr = v; resize(true); }
  function adaptDpr(dt) {
    if (document.hidden) { perf.skip = 1; return; }
    if (perf.skip > 0) { perf.skip -= dt; return; }
    // Pas de mesure pendant l'entrée (constructions des genres, décodage) ni pendant une transition.
    if (entry || tr.active || dt >= 0.099) return;
    const ms = dt * 1000;
    // Un à-coup isolé pèse au plus deux intervalles : il ne déplace pas la médiane.
    perf.buf[perf.i] = perf.refresh ? Math.min(ms, perf.refresh * 2) : ms;
    perf.i = (perf.i + 1) % perf.buf.length;
    perf.n = Math.min(perf.n + 1, perf.buf.length);
    if (++perf.count % 30 === 0 && perf.n >= 90) {
      const est = snapInterval(quantile(0.1));
      perf.refresh = perf.refresh ? Math.min(perf.refresh, est) : est;
      perf.med = quantile(0.5);
      const pr = perf.probe;
      if (pr) {
        perf.probe = null;
        if (perf.med > pr.med * 0.9) {
          // La baisse n'a rien changé : ce n'est pas le rendu qui limite (écran ou navigateur bridé).
          // On revient à la netteté d'avant et on adopte cette cadence.
          perf.refresh = snapInterval(perf.med);
          perf.noDropUntil = time + 60;
          setDpr(pr.dpr);
          perfReset(0.5);
          return;
        }
        perf.noRaiseUntil = time + 60;
      }
    }
    if (!perf.med) return;
    perf.slow = perf.med > perf.refresh * 1.25 ? perf.slow + dt : 0;
    perf.good = perf.med < perf.refresh * 1.05 ? perf.good + dt : 0;
    if (perf.slow > 2 && dpr > 1 && time > perf.noDropUntil) {
      perf.probe = { dpr, med: perf.med };
      perf.noRaiseUntil = time + 20;
      setDpr(Math.max(1, dpr - 0.25));
      perfReset(0.5);
    } else if (perf.good > 5 && dpr < dprMax && time > perf.noRaiseUntil) {
      setDpr(Math.min(dprMax, dpr + 0.25));
      perfReset(0.5);
    }
  }

  let warmPending = false;
  let lastW = 0, lastH = 0, lastDpr = 0;
  let resizeRaf = 0;
  function resize(force = false) {
    // Le canvas mesure 100lvh : sa taille ne suit pas la barre d'adresse mobile qui se replie au défilement.
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (w < 2 || h < 2) return; // fenêtre pas encore dimensionnée
    if (warmPending) { warmPending = false; requestAnimationFrame(() => warmUp()); }
    if (force !== true) {
      if (w === lastW && h === lastH && dpr === lastDpr) return;
      // Mobile : moins de 15 % de hauteur à largeur égale, c'est la barre d'adresse ; on ne réalloue rien.
      if (mobile && w === lastW && lastH && Math.abs(h - lastH) / lastH < 0.15) return;
    }
    lastW = w; lastH = h; lastDpr = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    U.uRes.value.set(w * dpr, h * dpr);
    U.uDpr.value = dpr;
    if (label) {
      label.mesh.scale.setScalar(Math.min(1, camera.aspect / 1.5));
      if (!tr.active) labelPose(current, label.mesh.position, label.mesh.quaternion);
    }
    perf.skip = Math.max(perf.skip, 0.5);
  }
  // Regroupés sur l'image suivante : une rafale d'événements resize ne réalloue les cibles qu'une fois.
  const onResize = () => {
    if (!resizeRaf) resizeRaf = requestAnimationFrame(() => { resizeRaf = 0; if (!disposed) resize(); });
  };
  resize(true);
  window.addEventListener('resize', onResize);

  const onLost = (e) => {
    e.preventDefault();
    contextLost = true;
    document.documentElement.classList.add('no-webgl');
    console.warn('Contexte WebGL perdu : repli sans 3D.');
  };
  canvas.addEventListener('webglcontextlost', onLost);

  // ---------- Transition (DA §3) ----------
  function snapshot() {
    Pfrom.set(Pcur);
    const p = tr.active ? clamp01((tr.t - 0.2 * tr.dur / 2) / (1.4 * tr.dur / 2)) : 1;
    for (const k of ['glow', 'line', 'accent', 'bg']) {
      const src = tr.active ? mixOklch(palFrom[k], palTo[k], p, [0, 0, 0]) : palCur[k];
      palFrom[k][0] = src[0]; palFrom[k][1] = src[1]; palFrom[k][2] = src[2];
    }
    camFrom.pos.copy(camState.pos); camFrom.look.copy(camState.look); camFrom.fov = camState.fov; camFrom.roll = camState.roll;
  }

  function setPalUniforms(a, b) {
    // B en teinte « dépliée » par rapport à A, pour que le shader mélange par le plus court arc.
    const unwrap = (ha, hb) => ha + (((hb - ha + 540) % 360) - 180);
    U.uPalA0.value.set(...a.glow); U.uPalA1.value.set(...a.line); U.uPalA2.value.set(...a.accent);
    U.uPalB0.value.set(b.glow[0], b.glow[1], a.glow[1] < 0.002 ? b.glow[2] : unwrap(a.glow[2], b.glow[2]));
    U.uPalB1.value.set(b.line[0], b.line[1], unwrap(a.line[2], b.line[2]));
    U.uPalB2.value.set(b.accent[0], b.accent[1], unwrap(a.accent[2], b.accent[2]));
  }

  function transition(to, { dir = 1, duration = 2, interrupt = false } = {}) {
    if (to === current && !tr.active) return;
    snapshot();
    tr.active = true; tr.t = 0; tr.dur = duration; tr.dir = dir; tr.from = current; tr.to = to;
    tr.scratch = interrupt ? 0.07 : 0.1 * (duration / 2);
    tr.cut = false;
    tr.op0 = opTr;
    // Une entrée en cours garde son dévoilement, mais la caméra appartient désormais à la transition.
    if (entry && !entry.reduced) entry.camDone = true;
    current = to;
    Pto = vectors[to];
    palTo = GENRES[to].oklch;
    setPalUniforms(palFrom, palTo);
    tr.bgFrom.set(oklchToHex(palFrom.bg));
    tr.bgTo.set(GENRES[to].palette.bg);
    const cam = GENRES[to].cam;
    camTo.pos.set(...cam.pos); camTo.look.set(...cam.look); camTo.fov = cam.fov + (mobile ? 8 : 0); camTo.roll = cam.roll;
    camMid.copy(camFrom.pos).add(camTo.pos).multiplyScalar(0.5);
    camMid.y += dir > 0 ? 2.5 : 1.0;
    camMid.z += 3;
    camCurve = new THREE.CatmullRomCurve3([camFrom.pos.clone(), camMid.clone(), camTo.pos.clone()], false, 'centripetal');
    U.uShock.value.set(0, dir > 0 ? -9 : -40, 0, 0);
    labelTarget = GENRES[to].label.toUpperCase();
    if (label) {
      labelFrom.p.copy(label.mesh.position); labelFrom.q.copy(label.mesh.quaternion);
      labelPose(to, labelTo.p, labelTo.q);
    }
    labelScramble = 0;
  }

  function stepTransition(dt) {
    if (!tr.active) return;
    tr.t += dt;
    const s = tr.dur / 2;
    const t = tr.t;
    // Couleurs du fond
    const pc = clamp01((t - 0.2 * s) / (1.4 * s));
    bgColor.copy(tr.bgFrom).lerp(tr.bgTo, sineIO(pc));
    // Paramètres numériques (power2.inOut, f12–f108)
    const pp = p2io(clamp01((t - 0.2 * s) / (1.6 * s)));
    for (let i = 0; i < KEYS.length; i++) Pcur[i] = Pfrom[i] + (Pto[i] - Pfrom[i]) * pp;
    Pcur[K.lambda] = Math.exp(Math.log(Pfrom[K.lambda]) + (Math.log(Pto[K.lambda]) - Math.log(Pfrom[K.lambda])) * pp);
    // Onde de choc (f6–) : porte la couleur
    if (!reduced) {
      const ts = t - 0.1 * s;
      const R = ts > 0 ? ts * 28 / s : 0;
      U.uShock.value.z = R;
      U.uShock.value.w = ts > 0 && R < 50 ? 1.4 * (1 - R / 50) : 0;
      U.uShockAccent.value = ts > 0 && R < 50 ? 0.9 : 0;
    } else {
      // Sans onde : fondu global des couleurs
      U.uShock.value.set(0, -9, pc * 80 - 10, 0);
      U.uShockAccent.value = 0;
    }
    // Caméra
    if (reduced) {
      // Coupe en fondu (DA §5.6) : la nappe s'éteint en 300 ms, la caméra saute, la nappe revient. Aucun travelling.
      opTr = t < 0.3 ? tr.op0 * (1 - t / 0.3) : clamp01((t - 0.3) / 0.3);
      if (t >= 0.3 && !tr.cut) {
        tr.cut = true;
        camState.pos.copy(camTo.pos); camState.look.copy(camTo.look); camState.fov = camTo.fov; camState.roll = camTo.roll;
        if (label) { label.mesh.position.copy(labelTo.p); label.mesh.quaternion.copy(labelTo.q); }
      }
    } else {
      const pk = p3io(clamp01((t - 0.075 * tr.dur) / (0.9 * tr.dur)));
      if (camCurve) camCurve.getPoint(pk, camState.pos);
      else camState.pos.copy(camFrom.pos).lerp(camTo.pos, pk);
      camState.look.copy(camFrom.look).lerp(camTo.look, pk);
      camState.fov = camFrom.fov + (camTo.fov - camFrom.fov) * pk + Math.sin(Math.PI * pk) * 4;
      camState.roll = camFrom.roll + (camTo.roll - camFrom.roll) * pk + Math.sin(Math.PI * pk) * 3 * (pk < 0.85 ? 1 : 0.5);
      if (label) {
        label.mesh.position.lerpVectors(labelFrom.p, labelTo.p, pk);
        label.mesh.quaternion.slerpQuaternions(labelFrom.q, labelTo.q, pk);
      }
    }
    // Aberration chromatique
    if (t < 0.1) env.chroma = Math.max(env.chroma, t / 0.1);
    else if (t < 1.2 * s) env.chroma = Math.max(env.chroma, 1);
    else env.chroma = Math.max(env.chroma, 1 - (t - 1.2 * s) / (0.8 * s));
    if (reduced) env.chroma = 0;
    // « Drop » à mi-chemin
    if (t - dt < s && t >= s && flashAllowed()) env.flash = Math.max(env.flash, 1);
    // Nom du genre brouillé
    if (label && reduced) {
      // Sans brouillage : le nouveau nom s'affiche à la coupe.
      if (t >= 0.3 && label.text !== labelTarget) { label.text = labelTarget; label.color = GENRES[current].palette.line; }
    } else if (label) {
      if (t > 0.5 * s && t < 1.5 * s) {
        // La couleur change dès le début du brouillage, pas à la fin.
        label.color = GENRES[current].palette.line;
        labelScramble += dt;
        if (labelScramble > 0.06) {
          labelScramble = 0;
          let txt = '';
          for (let i = 0; i < labelTarget.length; i++) txt += labelTarget[i] === ' ' ? ' ' : SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
          label.text = txt;
        }
      } else if (t >= 1.5 * s && label.text !== labelTarget) {
        label.text = labelTarget;
        label.color = GENRES[current].palette.line;
      }
    }
    if (t >= tr.dur) {
      tr.active = false;
      Pcur.set(Pto);
      for (const k of ['glow', 'line', 'accent', 'bg']) palCur[k] = [...palTo[k]];
      setPalUniforms(palCur, palCur);
      U.uShock.value.set(0, -9, 999, 0);
      U.uShockAccent.value = 0;
      bgColor.set(GENRES[current].palette.bg);
      camState.pos.copy(camTo.pos); camState.look.copy(camTo.look); camState.fov = camTo.fov; camState.roll = camTo.roll;
      opTr = 1;
      if (label && label.text !== labelTarget) { label.text = labelTarget; label.color = GENRES[current].palette.line; }
    }
  }

  // ---------- Événements du séquenceur (AUDIO §3.2) ----------
  function onEvent(e) {
    if (!entered) return;
    switch (e.type) {
      case 'kick':
        env.pump = Math.max(env.pump, Pcur[K.pump] * (e.vel ?? 1));
        env.kickCam = 1;
        env.nod = -1.4 * (e.vel ?? 1);
        if (Pcur[K.kickRing] > 0.1) pushRing(0, -10, 0.35 * Pcur[K.kickRing], 14, 1.6, 2.2);
        if (Pcur[K.step] > 0.1) pushRing(0, 3, 0.45 * Pcur[K.step], 4, 6, 0.7);
        break;
      case 'snare':
        if (!mobile && !reduced) env.trauma = Math.min(1, env.trauma + 0.35 * Pcur[K.rock]);
        if (Pcur[K.rock] > 0.1) {
          pushRing((Math.random() - 0.5) * 8, -8, 0.6 * Pcur[K.rock], 18, 1.2, 2.8);
          if (!reduced) env.chroma = Math.max(env.chroma, 0.6 * Pcur[K.rock]);
        }
        if (Pcur[K.step] > 0.1) { env.nod = 0.8; env.jumpAt = time + 0.04; }
        break;
      case 'crash':
        if (Pcur[K.rock] > 0.3 && flashAllowed()) env.flash = Math.max(env.flash, 1);
        break;
      case 'bass':
        env.springV += 3 * Pcur[K.spring] * (e.vel ?? 1);
        if (Pcur[K.bassRing] > 0.1) { pushRing(0, -14, 0.4 * Pcur[K.bassRing] * (e.vel ?? 1), 6, 2.5, 0.9); lastEventRing = time; }
        break;
      case 'hat':
        U.uScintSeed.value = (U.uScintSeed.value + 1) % 97;
        break;
      case 'bar':
        if (Pcur[K.spring] > 0.1) { env.one = Pcur[K.spring]; env.lift = 1; }
        break;
      case 'crackle':
        if (Pcur[K.step] > 0.1 || mobile) env.dust = Math.max(env.dust, (e.vel ?? 0.5) * 2);
        break;
      case 'drop':
        if (flashAllowed()) env.flash = Math.max(env.flash, 1);
        break;
      default:
        break;
    }
  }

  // ---------- Entrée (DA §4.2) ----------
  function enter() {
    entered = true;
    canvas.classList.add('on');
    const g = GENRES[0];
    if (reduced) {
      U.uReveal.value.w = 0;
      opEntry = 0;
      entry = { t: 0, reduced: true };
      camState.pos.set(...g.cam.pos); camState.look.set(...g.cam.look); camState.fov = g.cam.fov + (mobile ? 8 : 0);
      return;
    }
    entry = { t: 0, reduced: false, camDone: false };
    opEntry = 1;
    U.uReveal.value.set(0, -9, 0, 1);
    camState.pos.set(0, 9, -8.99); camState.look.set(0, 0, -9); camState.fov = 50;
    pushRing(0, -9, 0.6, 12, 3, 0.8);
  }

  function stepEntry(dt) {
    if (!entry) return;
    entry.t += dt;
    const t = entry.t;
    const g = GENRES[0];
    if (entry.reduced) {
      opEntry = clamp01(t / 0.8);
      if (t > 0.8) { entry = null; perf.skip = 1; }
      return;
    }
    const tr0 = clamp01((t - 0.38) / 2.2);
    U.uReveal.value.z = (1 - Math.pow(1 - tr0, 2)) * 34;
    if (!entry.camDone) {
      const pc = p3io(clamp01((t - 0.3) / 2.8));
      tmpV.set(0, 9, -8.99);
      camState.pos.copy(tmpV).lerp(tmpLook.set(...g.cam.pos), pc);
      camState.pos.y += Math.sin(Math.PI * pc) * 1.2;
      camState.look.set(0, 0, -9).lerp(tmpLook.set(...g.cam.look), pc);
      camState.fov = 50 + (g.cam.fov + (mobile ? 8 : 0) - 50) * pc;
    }
    if (t > 3.2) { U.uReveal.value.w = 0; entry = null; perf.skip = 1; }
  }

  // ---------- Image ----------
  const bandsZero = { basses: 0, basMediums: 0, mediums: 0, aigus: 0 };
  function update(dt, st) {
    if (disposed || contextLost) return;
    dt = Math.min(dt, 0.1);
    time += dt;
    U.uTime.value = time;
    stepEntry(dt);
    stepTransition(dt);
    U.uOpacity.value = opEntry * opTr;

    const playing = st ? st.enLecture : false;
    pausedTarget = st && !st.enLecture ? 1 : 0;
    pausedF += (pausedTarget - pausedF) * (1 - Math.exp(-dt / 0.15));
    const b = st ? st.bands : bandsZero;
    const red = reduced ? 0.5 : 1;

    // Ressort (soul) : la basse rebondit (raideur 180, amortissement 9)
    const springTarget = b.basses;
    const acc = 180 * (springTarget - env.springX) - 9 * env.springV;
    env.springV += acc * dt; env.springX += env.springV * dt;
    const bassUsed = b.basses + (Math.max(0, env.springX) - b.basses) * Pcur[K.spring];

    // Enveloppes d'événements
    env.pump *= Math.exp(-dt / 0.07);
    env.kickCam *= Math.exp(-dt / 0.06);
    env.trauma = Math.max(0, env.trauma - 1.6 * dt);
    env.nod *= Math.exp(-dt / 0.07);
    if (env.jumpAt > 0 && time >= env.jumpAt) { env.jump = 1; env.jumpAt = -1; }
    env.jump *= Math.exp(-dt / 0.09);
    env.one *= Math.exp(-dt / 0.1);
    env.lift *= Math.exp(-dt / 0.12);
    env.dust *= Math.exp(-dt / 0.03);
    env.flash *= Math.exp(-dt / 0.1);
    env.chroma *= Math.exp(-dt / 0.06);

    // Attaques mesurées → anneaux
    if (st && playing) {
      const at = st.attaques;
      const f = Pcur[K.ringForce] * (Pcur[K.drift] > 0.5 ? 0.4 : 1);
      if (at.basses > 0 && time - lastAttackRing[0] > 0.25 && time - lastEventRing > 0.15) {
        lastAttackRing[0] = time;
        pushRing(0, -14, 0.45 * at.basses * f, Pcur[K.ringC], Pcur[K.ringLr] * 1.4, Pcur[K.ringDec]);
      }
      const am = Math.max(at.basMediums, at.mediums);
      if (am > 0 && time - lastAttackRing[1] > 0.3) {
        lastAttackRing[1] = time;
        pushRing((Math.random() - 0.5) * 12, -12 + Math.random() * 8, 0.3 * am * f, Pcur[K.ringC], Pcur[K.ringLr], Pcur[K.ringDec]);
      }
    }

    // Uniformes de forme
    const breath = 1 - 0.65 * pausedF;
    const A = Pcur[K.A] * (1 + 0.6 * Pcur[K.kB] * bassUsed) * (1 + 1.2 * env.pump) * breath * red;
    const lambda = Pcur[K.lambda] * (1 - Pcur[K.kL] * b.basMediums);
    U.uA.value = A;
    U.uLambda.value = lambda;
    U.uTurb.value = Pcur[K.turb];
    U.uS.value = Pcur[K.S] * (1 - pausedF);
    U.uRock.value = Pcur[K.rock];
    U.uStep.value = Pcur[K.step];
    U.uActive.value = Pcur[K.active] >= 0.995 ? 1.1 : Pcur[K.active];
    U.uDir0.value.set(Pcur[K.d0x], Pcur[K.d0z]).normalize();
    U.uDir1.value.set(Pcur[K.d1x], Pcur[K.d1z]).normalize();
    U.uDir2.value.set(Pcur[K.d2x], Pcur[K.d2z]).normalize();

    // Défilement : le motif avance (vitesse intégrée pour éviter les sauts de phase)
    let speed = Pcur[K.travel] * (reduced ? 0.4 : 1) * (1 - 0.7 * pausedF);
    const sv = Math.max(-4, Math.min(4, scrollVel * 0.04));
    speed += reduced ? 0 : sv;
    if (tr.active && !reduced && tr.t < tr.scratch) speed = tr.dir > 0 ? -3 : 3;
    travelSpeed += (speed - travelSpeed) * (1 - Math.exp(-dt / 0.12));
    travel += travelSpeed * dt;
    const TAU = Math.PI * 2;
    const v = Pcur[K.v];
    const dirs = [U.uDir0.value, U.uDir1.value, U.uDir2.value];
    const lams = [lambda, 0.53 * lambda, 0.29 * lambda];
    const vm = [1, 1.3, 1.7];
    for (let k = 0; k < 3; k++) {
      phase[k] = (phase[k] + TAU * (v * vm[k] + dirs[k].y * travelSpeed / lams[k]) * dt) % (TAU * 1000);
    }
    U.uPhase.value.set(phase[0], phase[1], phase[2]);
    const nf = 0.35 / lambda;
    noiseOff -= travelSpeed * nf * dt;
    U.uNoise.value.set(nf, noiseOff, time * 0.08);

    // Lumière
    const scrollGlow = Math.min(0.1, Math.abs(scrollVel) * 0.004);
    const scratchGlow = tr.active && tr.t < tr.scratch + 0.2 ? 0.4 * Pcur[K.base] : 0;
    U.uBase.value = Pcur[K.base] + scrollGlow + scratchGlow;
    U.uMid.value = Pcur[K.kM] * b.mediums * 0.8 * (1 - pausedF);
    U.uScint.value = reduced ? 0 : Pcur[K.scint] * b.aigus;
    U.uScintRate.value = Pcur[K.scintRate];
    U.uJump.value = 0.25 * env.jump * Pcur[K.step];
    U.uOne.value = env.one;
    U.uDust.value = reduced ? 0 : env.dust;
    U.uFade.value.set(Pcur[K.fade0], Pcur[K.fade1]);
    U.uWidth.value = Pcur[K.width] * (1 + 0.3 * b.basMediums * Pcur[K.rock]);
    U.uHorizon.value = Pcur[K.horizon];
    calmCur += (calm - calmCur) * Math.min(1, dt * 3);
    U.uGain.value = 1.6 * Pcur[K.gain] * (1 - 0.75 * calmCur);

    // Spectre gravé : une ligne de temps à 30 Hz
    histAcc += dt;
    if (st && histAcc >= 1 / 30) {
      histAcc %= 1 / 30;
      histHead = (histHead + 1) % HIST_H;
      const row = histData.subarray(histHead * HIST_W, (histHead + 1) * HIST_W);
      if (playing && st.fillSpectrum) st.fillSpectrum(row); else row.fill(0);
      hist.needsUpdate = true;
      U.uHistHead.value = histHead;
    }
    U.uHistFrac.value = Math.min(1, histAcc * 30);

    // Post-traitement
    bloom.intensity = (Pcur[K.bloomI] * (1 - 0.2 * pausedF) + 0.8 * env.flash) * (1 - 0.8 * calmCur);
    // Rayon de la DA × 0,72 : au-delà, le flou mipmap voile tout le ciel (mesuré : 0,8 → ciel gris 31/255).
    bloom.mipmapBlurPass.radius = Pcur[K.bloomR] * 0.72;
    bloom.luminanceMaterial.threshold = Pcur[K.bloomT] + 0.1;
    vignette.darkness = Pcur[K.vignette];
    if (noise) noise.blendMode.opacity.value = Pcur[K.grain];
    if (chroma && !reduced) {
      const c = Math.max(1, 1 + env.chroma * 4);
      chroma.offset.set(chromaBase.x * c, chromaBase.y * c);
    }
    // Neutral laisse les noirs presque intacts : le fond garde la teinte de la DA.
    renderer.setClearColor(clearColor.copy(bgColor), 1);
    if (label) label.mat.opacity = entered ? 0.1 : 0;

    // Caméra : pose + mouvements propres au genre
    tmpV.copy(camState.pos);
    tmpLook.copy(camState.look);
    let fov = camState.fov;
    let roll = camState.roll;
    let pitch = 0;
    if (!reduced && !entry) {
      const dm = mobile ? 0.5 : 1;
      const wd = Pcur[K.drift] * dm;
      tmpV.x += wd * 0.6 * Math.sin((TAU * time) / 31);
      tmpV.y += wd * 0.15 * Math.sin((TAU * time) / 23);
      roll += wd * 0.6 * Math.sin((TAU * time) / 27);
      tmpV.x += Pcur[K.dolly] * dm * 1.2 * Math.sin((TAU * time) / 20);
      tmpV.y -= 0.08 * env.kickCam * Pcur[K.pump];
      fov += 1.2 * env.kickCam * Pcur[K.pump];
      if (!mobile && env.trauma > 0) {
        const sh = env.trauma * env.trauma * 0.06 * Pcur[K.rock];
        tmpV.x += sh * Math.sin(time * 113.1) * Math.cos(time * 41.7);
        tmpV.y += sh * Math.sin(time * 97.3 + 1.3);
        roll += sh * 20 * Math.sin(time * 71.9);
      }
      pitch = env.nod * Pcur[K.step];
      // Orbite lente (soul) autour du point regardé
      const az = Pcur[K.spring] * dm * ((9 * Math.PI) / 180) * Math.sin((TAU * time) / 36.9);
      if (az !== 0) {
        const dx = tmpV.x - tmpLook.x, dz = tmpV.z - tmpLook.z;
        const ca = Math.cos(az), sa = Math.sin(az);
        tmpV.x = tmpLook.x + dx * ca - dz * sa;
        tmpV.z = tmpLook.z + dx * sa + dz * ca;
      }
      tmpV.y += 0.1 * env.lift * Pcur[K.spring];
    }
    camera.position.copy(tmpV);
    camera.up.copy(up);
    camera.lookAt(tmpLook);
    camera.rotateX((pitch * Math.PI) / 180);
    camera.rotateZ((roll * Math.PI) / 180);
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }

    if (U.uRes.value.x < 2) return;
    composer.render(dt);

    adaptDpr(dt);
  }

  function warmUp() {
    if (window.innerWidth < 2 || window.innerHeight < 2) { warmPending = true; return; }
    try {
      U.uOpacity.value = 0;
      renderer.compile(scene, camera);
      composer.render(0.016);
      U.uOpacity.value = 1;
    } catch (err) {
      console.warn('Préparation du rendu impossible :', err && err.message);
    }
  }

  function dispose() {
    disposed = true;
    window.removeEventListener('resize', onResize);
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    canvas.removeEventListener('webglcontextlost', onLost);
    geometry.dispose();
    material.dispose();
    hist.dispose();
    if (label) { scene.remove(label.mesh); label.dispose(); }
    composer.dispose();
    renderer.dispose();
  }

  return {
    update, transition, onEvent, enter, warmUp, dispose, resize: () => resize(true),
    setScrollVelocity(v) { scrollVel = v; },
    setCalm(v) { calm = v; },
    interfaceRing(x01) { if (entered) pushRing(-6 + 12 * x01, -8, 0.25, 8, 2, 1.5); },
    get current() { return current; },
    get lost() { return contextLost; },
    get bg() { return bgColor; },
    get dpr() { return dpr; },
    debug: { composer, bloom, toneMap, vignette, get chroma() { return chroma; }, get noise() { return noise; }, U, renderer },
  };
}
