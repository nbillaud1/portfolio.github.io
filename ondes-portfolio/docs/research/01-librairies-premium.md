# Librairies premium : son, lignes, post-traitement, motion, outils

Date de recherche : 2026-11-22 · Confiance globale : **haute** pour les versions et les licences (npm et GitHub relus par un vérificateur), **moyenne** pour les performances (aucun benchmark) et les prix payants (plusieurs non vérifiés).

## Résumé

Le rendu « Awwwards » s'obtient ici **pour 0 €**. Aucune option payante n'apporte un gain réel par rapport aux outils gratuits.

- **Son** : Tone.js 15.1.22 (épinglé) + smplr 1.2.0. Les samples sont sous CC0, dans le domaine public ou en CC-BY, réduits puis auto-hébergés.
- **Lignes** : un ruban maison (un seul Mesh avec ShaderMaterial) dont le déplacement se calcule sur la carte graphique, à partir d'une texture d'historique du spectre.
- **Post-traitement** : pmndrs `postprocessing` 6.39.6 (Bloom mipmap, AgX, grain, vignette, aberration) sur WebGLRenderer, avec MSAA.
- **Motion** : GSAP 3.15.1 (plugins gratuits depuis le 30/04/2025) + Lenis 1.3.27, sur une seule page Astro.
- **Analyse** : aucune librairie. Les pulsations viennent des événements Tone (`getDraw().schedule`), l'énergie continue d'un AnalyserNode par bus.
- **Typo** : Fraunces variable (OFL) + troika-three-text pour le texte en WebGL.

Une décision reste à prendre : **three r186.1 ou r187** (0.187.0, sortie le 30/10/2026). Les deux sont compatibles avec postprocessing 6.39.6.

## Points clés (sourcés)

1. **three** : la dernière version est 0.187.0 (2026-10-30). La 0.186.1 date du 2026-09-24. Licence MIT. [1]
2. **postprocessing 6.39.6** (2026-11-01, Zlib) déclare `three >= 0.168.0 < 0.188.0` en peerDependency. La v7 reste en bêta (7.0.0-beta.16, 19/02/2026, figée depuis 9 mois). [2][3]
3. **ToneMappingMode.AGX = 7** dans postprocessing v6.39.6. ChromaticAberrationEffect est un effet de **convolution** : on n'en met qu'un par EffectPass, donc SMAA ira dans une passe séparée. [3][4]
4. En r186.1, **`Texture.addUpdateRange`** existe et WebGLTextures le lit : on peut n'envoyer qu'une ligne du spectre par image. [5]
5. **LineBasicMaterial.linewidth** est ignoré en WebGL (toujours 1 px). Il faut donc des rubans ou Line2. [6][7]
6. **Tone.js** : `latest` = 15.1.22 (2025-04-27), `next` = 15.5.73 (2026-11-20). Licence MIT. Dépôt actif (push le 2026-11-20, environ 14,9k étoiles). [8][9]
7. **Tone `Draw` ignore `outputLatency`** et déclenche 8 ms avant `currentTime` : l'image arrive donc **en avance** sur le son entendu. Il faut planifier à `time + outputLatency + baseLatency`. Un événement en retard de plus de 0,25 s est abandonné. [10]
8. **smplr 1.2.0** (2026-11-06, MIT sur npm) : SplendidGrandPiano, Smolken, ElectricPiano, DrumMachine, Mallet, Versilian, Soundfont et un Sequencer intégré. Les samples sont servis par GitHub Pages, dont le débit est limité. [11][12]
9. **ElectricPiano de smplr n'est pas un Rhodes** : il contient CP80, Pianet, Wurlitzer et TX81Z, sous CC-BY 3.0 (Greg Sullivan, attribution obligatoire). Le seul vrai Rhodes libre (jRhodes3d) est en **CC BY-NC**. [11][13][14]
10. **Licences des samples** : SplendidGrandPiano est dans le domaine public (Akai). Contrebasse Smolken, VCSL et VSCO 2 CE sont en CC0. FluidR3 est en CC-BY 3.0, MusyngKite en CC-BY-SA 3.0, Hydrogen en GPL-2.0. [15][16][17][18][19]
11. **GSAP 3.15.1** (2026-11-04) est sous la « Standard No Charge License » depuis le 30/04/2025 (modifiée le 30/05/2025). SplitText et les autres ex-plugins Club sont gratuits, y compris en usage commercial. Seule exclusion : les outils no-code concurrents de Webflow. [20][21]
12. **Lenis 1.3.27** (2026-10-15, MIT) : `respectReducedMotion` est à true par défaut, `anchors` à false par défaut, `syncTouch` à false (« instable » sur iOS < 16). [22][23]
13. **Theatre.js** : 0.7.2 publiée le 2024-05-19, aucune version depuis. Le studio est sous **AGPL**. À écarter. [24]
14. **Strudel** (AGPL-3.0), **essentia.js** (AGPL-3.0, 2021) et **WebAudioFont** (GPL-3.0) sont contaminants et donc écartés. [25][26][27]
15. **Licences des samples payants** : Splice (CGU du 2026-11-02, §2.3.1.4) interdit de redistribuer des sons « in isolation ». Spitfire n'autorise des sons d'interface que s'ils « can't be recorded or exported ». Un fichier servi par un site est extractible, donc ces samples sont exclus. [28][29]
16. **Fraunces** et **Bricolage Grotesque** : polices variables sous OFL-1.1. Les paquets `@fontsource-variable/*` 5.3.0 datent du 2026-07-19. Fraunces a les axes wght, opsz, SOFT, WONK et ital. [30]
17. **troika-three-text 0.53.1** (2026-11-02, MIT) : texte SDF dans Three.js à partir de n'importe quel TTF ou WOFF. [31]

## Détails par axe

### 1. Son génératif

- **Socle : Tone.js.** Il gère le Transport, le swing (indispensable pour le jazz et le boom bap), les synthés, les effets, CrossFade et les outils de mesure (Meter, FFT, Follower ; leur présence en 15.1.22 est non vérifiée). L'API `getDraw()` / `getTransport()` existe bien en 15.1.22. `Tone.Draw` et `Tone.Transport` y sont dépréciés. [10]
- **Réalisme : smplr.** Les instruments se chargent à la demande, note par note (`notesToLoad`). Les dépôts sources sont lourds et ne doivent jamais être embarqués :
  - SplendidGrandPiano : 72 Mo, ou 42 Mo en version smpldsnds ;
  - Smolken : 253 Mo, ou 27 Mo en version smpldsnds ;
  - VCSL : environ 4 Go ;
  - VSCO 2 CE : environ 2,3 Go.
  [12][15][16]
- **DrumMachine (808/909)** : le README se déclare « public domain », mais il n'y a pas de fichier LICENSE. Risque faible, origine non prouvée. **DrumAbuse** : aucune licence, non vérifié. [32]
- **Guitare rock saturée** : aucune banque libre et crédible n'a été vérifiée. À synthétiser (Karplus-Strong, Distortion, Convolver avec une IR d'ampli). Faust 0.23.0 (LGPL-2.1, 2026-11-21) peut servir pour un seul module précompilé. [33]
- **Cuivres soul** : VSCO 2 CE est orchestral, sans stabs ni falls funk. Un rendu crédible est **non vérifié**. [17]
- **Écartés** : Elementary Audio (lent mais pas figé : next 4.0.8 en 10/2025, push 01/2026) [34] et WAM (alpha).

### 2. Lignes lumineuses

Le **ruban maison** donne le plus de contrôle en un seul draw call. La géométrie est statique ; ses attributs sont `aU`, `aLine` et `aSide`.

- **Vertex shader.** Il lit le spectre en `u` et en `u+du`, projette les deux points, puis décale le sommet dans l'espace écran. **Correction du vérificateur** : la formule `n × aSide × w / uResolution × clip.w × 2` donne une largeur de **2w**. Utiliser `× 1`, ou bien `w/2`.
- **Fragment shader.** Bord anticrénelé avec `fwidth`, cœur `exp(−d²·8)`, valeurs HDR supérieures à 1 pour déclencher le bloom, fondu en profondeur, AdditiveBlending, `depthWrite=false`.
- **Historique du spectre.** Il est stocké dans une DataTexture R8 512×64. Avec `RepeatWrapping` + `LinearFilter`, l'interpolation fait apparaître une ligne parasite au raccord : utiliser NearestFilter sur l'axe du temps, ou décaler d'un demi-texel.
- **Plan B : LineSegments2 + LineMaterial + onBeforeCompile.** On remplace `vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );` (ligne 101) ainsi que la ligne de `end`, en traitant aussi le bloc `WORLD_UNITS`. Ce remplacement est fragile d'une version de three à l'autre. [7]
- **Écartés** : THREE.Line (1 px), three.meshline 2.0.0 (calcul sur le CPU ; son README conseille lui-même Line2) [35], meshline pmndrs (2024), three-fatline (aucune licence), Points/InstancedMesh (donnent des pointillés), GPGPU (inutile ici).
- **Line2NodeMaterial (TSL)** lit `instanceStart` en dur et n'a pas de point d'insertion pour un déplacement. [36]

### 3. Post-traitement

- **Chaîne** : EffectComposer (`frameBufferType: HalfFloatType`, `multisampling: 4` ; l'option est non revérifiée dans le code 6.39.6) puis un seul EffectPass : Bloom (`mipmapBlur`, seuil ≈ 0,9) → ChromaticAberration discrète → Noise (OVERLAY, 0,05–0,1) → Vignette → ToneMapping AGX. Ajouter `renderer.toneMapping = NoToneMapping` pour éviter un double tone mapping.
- **SelectiveBloom** coûte un rendu de plus. BloomEffect avec des couleurs supérieures à 1 suffit en général.
- **Ajouts premium** disponibles dans la 6.39.6 : `LUT3DEffect` (un `.cube` par genre, avec fondu entre deux) et `DepthOfFieldEffect`. [4]
- **WebGPU + TSL.** Le bloom passe par `RenderPipeline` (qui remplace PostProcessing en r186, les deux étant encore exportés). La voie est moderne mais l'API bouge. postprocessing (pmndrs) n'est pas compatible avec WebGPURenderer : il faut choisir dès le départ. WebGPU est indisponible dans Safari 26 hors macOS Tahoe (bug WebKit 299237, non revérifié). [37][38]
- **EffectComposer + UnrealBloomPass** : toujours présent en r187, mais le rendu est moins fin. Écarté. [39]

### 4. Motion et architecture Astro

- **Une seule page `index.astro`.** Six sections, un canvas fixe créé une seule fois, une seule boucle `gsap.ticker` (avec `lenis.raf(t*1000)`, `lagSmoothing(0)`, `autoRaf: false`) et une synchronisation `lenis.on('scroll', ScrollTrigger.update)`.
- **Ne pas utiliser ClientRouter.** On ne recrée jamais le contexte WebGL ni l'AudioContext. La doc Astro ne dit rien de WebGL ni de l'audio avec `transition:persist` (non vérifié). [40][41]
- **Menu.** `anchors: true` sur Lenis, ou `lenis.scrollTo`. Pour se caler sur chaque section : lenis/snap ou le snap de ScrollTrigger.
- **Reduced motion.** Garder Lenis actif (`respectReducedMotion`) et lire `lenis.prefersReducedMotion` pour adapter le scrub. Ne pas désactiver Lenis.
- **Fondus audio.** Les caler sur `AudioContext.currentTime` avec `setTargetAtTime` et `cancelScheduledValues`, pour gérer un retour en arrière rapide (onEnterBack).
- **Écartés** : Motion 14.14.0 (MIT, actif, mais doublon de GSAP) et Theatre.js.

### 5. Analyse audio

Architecture en trois couches.

- **(A) Événements Tone.** Le kick, la caisse claire, l'accord ou le temps 1 déclenchent une impulsion via `Draw.schedule(cb, time + latence)`.
- **(B) Énergie continue.** Un AnalyserNode par bus (batterie, basse, harmonie, master), branché en dérivation et lu dans des Float32Array réutilisés.
  - Bandes en puissance linéaire, regroupées en low / mid / high.
  - **Correction** : à 48 kHz, un bin de fftSize 2048 couvre 23,4 Hz, donc la bande sub tient sur 1 ou 2 bins. Passer en fftSize 8192 sur le bus basse, ou fusionner en une bande low de 20 à 250 Hz.
  - **Correction** : la normalisation doit se faire en `peak × exp(−dt/τ)` avec τ entre 2 et 4 s, et non en `× 0,995 par image` (le Mac tourne à 120 Hz).
- **(C) Uniforms.** Quatre à six floats, plus les données de partition (hauteur des notes, accords, vélocités).

Librairies : **Meyda** 5.6.3 (MIT, 2024) en option seulement. **essentia.js**, **web-audio-beat-detector** 8.2.39 et **realtime-bpm-analyzer** 6.3.0 sont écartés, car le tempo est déjà connu. [42][26][43]

### 6. Payant, typo, références

- **Samples payants** : écartés (voir point 15). Prix relevés le 2026-11-22 : Splice Sounds 12,99 $/mois (facturé à l'année), Creator 19,99 $/mois. Les prix Splice n'ont pas été relus par le vérificateur.
- **Outils** :
  - Spline : Hobby 15 $/mois (12 $ à l'année), Pro 30 $ (25 $). L'export de code commence à Pro.
  - Unicorn Studio Legend : 20 $/mois ou 168 $/an.
  - Écartés tous les deux, car ce sont des doublons d'un Three.js codé à la main. [44][45]
  - cables.gl : gratuit (MIT ; les limites de l'offre sont non vérifiées).
  - KodeLife : achat unique, prix non affiché, version d'évaluation sans restriction.
  - Les deux servent seulement au prototypage. [46][47]
- **Polices** :
  - Pangram Pangram : licence Web par domaine (§2.4) et licence App pour une web app (§2.5). Tout usage non prévu, comme WebGL ou SDF, demande un accord écrit (§3.8). Prix « à partir de 30 $ web / 60 $ app » **non vérifiés** (la boutique répondait 429). [48]
  - Fontshare (ITF) : gratuit, mais texte de licence non lu. La redistribution des WOFF2 dans un dépôt public est **non vérifiée**.
- **Références** :
  - Trionn : Web Audio au runtime, GSAP et Lenis sur `gsap.ticker`. L'absence de tout fichier audio est non vérifiée. [49]
  - Aether 1 : GPGPU audio-réactif. [50]
  - Run Rob Run : WebGPU et réaction musicale sélective. [51]
  - Igloo Inc : Site of the Year Awwwards 2024, texte SDF. [52]
  - Codrops : tutoriel de visualiseur 3D, 06/2025. [53]

### 7. Outils Claude Code

- **chrome-devtools-mcp 1.13.0** (2026-11-11, Apache-2.0, Google). Il n'apporte vraiment que les **traces de performance**, puisque le Browser pane intégré couvre déjà la console, les captures et l'émulation mobile. [54]
- **threejs-devtools-mcp 0.5.0** (2026-10-14, MIT, un seul mainteneur). 69 outils, compatible WebGL et WebGPU, Node ≥ 22.18, pont sur le port 9222. Il ne déclare aucune peerDependency three, donc aucune compatibilité r186/r187 garantie. [55]
- **Skill frontend-design** (Anthropic, Apache-2.0) : du texte seulement, pour la direction artistique. [56]
- **Options** :
  - Spector.js : la version extension suffit. Son MCP demande de télécharger Chromium via Playwright, ce qui exige l'accord de l'utilisateur. [57]
  - cloudai-x/threejs-skills (MIT) : à relire avant usage, contenu peut-être antérieur à r186.
- **Écartés** :
  - Playwright MCP 0.0.86 : doublon.
  - ElevenLabs MCP : dépôt **archivé**, remplacé par le MCP hébergé, et hors concept.
  - Plugins du catalogue (parallax-threejs, audit-suite, animation-studio) : non vérifiés. [58]

## Application au projet

### Tableau de décision

| Verdict | Élément | Version exacte | Licence | Coût |
|---|---|---|---|---|
| **On prend** | three | 0.186.1 (ou 0.187.0, à trancher) | MIT | 0 € |
| **On prend** | postprocessing (pmndrs) | 6.39.6 | Zlib | 0 € |
| **On prend** | Ruban ShaderMaterial maison | — | code projet | 0 € |
| **On prend** | tone | 15.1.22 (sans `^`) | MIT | 0 € |
| **On prend** | smplr | 1.2.0 | MIT | 0 € |
| **On prend** | SplendidGrandPiano / Smolken / VCSL (extraits) | dépôts sfzinstruments / smpldsnds | Domaine public / CC0 / CC0 | 0 € |
| **On prend** | gsap (ScrollTrigger, SplitText, CustomEase) | 3.15.1 | Standard No Charge (propriétaire gratuite) | 0 € |
| **On prend** | lenis | 1.3.27 | MIT | 0 € |
| **On prend** | @fontsource-variable/fraunces (+ bricolage-grotesque) | 5.3.0 | OFL-1.1 | 0 € |
| **On prend** | troika-three-text | 0.53.1 | MIT | 0 € |
| Option | ElectricPiano smplr (CP80, Wurlitzer…) | via smplr 1.2.0 | CC-BY 3.0 (créditer) | 0 € |
| Option | FluidR3_GM (guitare muted, orgue) | gleitz, push 2022 (> 12 mois) | CC-BY 3.0 | 0 € |
| Option | VSCO 2 CE (pads de cordes) | dépôt, push 2021 (> 12 mois) | CC0 | 0 € |
| Option | DrumMachine smplr | smpldsnds/drum-machines | « public domain » (README, sans LICENSE) | 0 € |
| Option | Line2 / LineSegments2 + onBeforeCompile | three 0.186.1 | MIT | 0 € |
| Option | @grame/faustwasm (ampli guitare) | 0.23.0 | LGPL-2.1 | 0 € |
| Option | Meyda | 5.6.3 (> 12 mois) | MIT | 0 € |
| Option | WebGPURenderer + TSL (phase 2) | three r186+ | MIT | 0 € |
| Option payante | Pangram Pangram | — | propriétaire | ≥ 30 $ web / ≥ 60 $ app (non vérifié) |
| Option payante | RNBO (Max) pour un ampli modélisé ; runtime @rnbo/js 1.4.6 MIT | — | propriétaire | prix non vérifié |
| Option payante | KodeLife | 1.3.0.216 | propriétaire perpétuelle | prix non affiché |
| On écarte | Strudel, essentia.js, WebAudioFont, Hydrogen samples | 1.3.0 / 0.1.3 / — / — | AGPL / AGPL / GPL-3.0 / GPL-2.0 | — |
| On écarte | Theatre.js | 0.7.2 (2024) | Apache-2.0 / studio AGPL | — |
| On écarte | Motion, Elementary, WAM, EffectComposer+UnrealBloom, three.meshline, three-fatline | — | — | — |
| On écarte | Splice, Loopmasters, NI, Spline, Unicorn Studio | — | propriétaires | 12,99 $ à 30 $/mois |
| On écarte | jRhodes3d (vrai Rhodes) | — | CC BY-NC | non commercial seulement |

### Valeurs de départ

- **Rendu** : DPR plafonné à 2 sur Mac, 1 à 1,5 sur mobile. 160 lignes × 512 points sur ordinateur ; 64 × 256 sur mobile.
- **Post-traitement mobile** : pas d'aberration ni de grain, bloom à résolution/2.
- **Bloom** : intensité 1,5 à 2,5.
- **Audio** : swing jazz ≈ 0,6 ; crossfade de 2 à 4 s.
- **Enveloppes** : τ montée 10–25 ms ; τ descente 150–300 ms pour les basses et 60–100 ms pour les aigus.
- **Poids** : moins de 2 à 4 Mo de samples par genre, en Opus ou AAC (environ 1 note sur 3, 1 à 2 vélocités).

### Ordre d'intégration

1. **Maquette HTML (dossier `maquette/`)** : copies locales des modules ES (three, addons `examples/jsm`, postprocessing, tone, smplr, gsap, lenis) placées dans un dossier vendor et chargées par importmap. On n'utilise ni CDN en direct ni build. La copie reste à faire, avec l'accord de l'utilisateur, puisque rien n'est téléchargé ici.
   - a. Ruban + texture du spectre + bloom/AgX sur un oscillateur de test.
   - b. Écran « Entrer avec le son », Tone, puis un premier genre (ambient, sans samples).
   - c. Bus d'analyse et impulsions `Draw` avec compensation de latence.
   - d. GSAP/Lenis, 6 sections, fondus audio et visuels.
   - e. Samples réduits pour jazz, house et soul.
2. **J1 Astro via npm** : `npm install` avec les versions exactes du tableau (lockfile), un composant îlot `client:only` qui monte le canvas avec `dispose()`, et les samples dans `public/` (auto-hébergés).
3. **Ensuite** : rock (Karplus-Strong + IR, ou Faust), LUT par genre, profondeur de champ, page de crédits, profilage (chrome-devtools-mcp).

## Risques et points ouverts

- **three r186.1 ou r187 : non tranché.** Les deux passent avec postprocessing 6.39.6. Une r188 casserait l'installation (plafond `< 0.188`).
- **Tone : `latest` ou `next`.** `latest` (15.1.22) n'a rien publié depuis avril 2025, alors que `next` sort très souvent. Un vérificateur parle de « maintenance lente », un autre de dépôt actif : les deux sont vrais selon le canal. Épingler 15.1.22.
- **Tone Transport ou Sequencer smplr** : deux horloges possibles. Choisir une seule source de temps (Tone recommandé).
- **Rhodes** : aucun vrai Rhodes libre pour un usage commercial. Si le portfolio sert à vendre une prestation, la licence BY-NC est exclue.
- **Licences incertaines** : DrumMachine (sans fichier LICENSE), DrumAbuse (aucune licence), Fontshare (redistribution des fichiers), smplr (LICENSE absent selon l'API GitHub, MIT selon npm).
- **Crédits obligatoires** : Greg Sullivan (ElectricPiano), FluidR3, Salamander s'il est utilisé.
- **Débit limité** des samples servis par GitHub Pages : les héberger soi-même.
- **iOS Safari** : geste requis pour démarrer l'AudioContext, mode silencieux (non sourcé sur webkit.org, non vérifié), Lenis et le scroll tactile.
- **Performances (60–120 fps sur M5)** : non mesurées. Ajouter un DPR adaptatif.
- **Saturation** due au mélange additif et au bloom quand de nombreuses lignes se superposent : fondu en profondeur obligatoire.
- **Guitare rock « jouet »** si la synthèse est mal réglée.
- **chrome-devtools-mcp ou Browser pane** : chrome-devtools-mcp ne se justifie que pour les traces de performance.

## Sources

1. three, registre npm — https://registry.npmjs.org/three — consulté le 2026-11-22 — registre
2. postprocessing, registre npm — https://registry.npmjs.org/postprocessing — 2026-11-22 — registre
3. pmndrs/postprocessing, tag v6.39.6 — https://github.com/pmndrs/postprocessing/tree/v6.39.6/src/effects — 2026-11-22 — code source
4. ChromaticAberrationEffect.js v6.39.6 — https://github.com/pmndrs/postprocessing/blob/v6.39.6/src/effects/ChromaticAberrationEffect.js — 2026-11-22 — code source
5. Texture.js / WebGLTextures.js r186.1 — https://cdn.jsdelivr.net/npm/three@0.186.1/src/textures/Texture.js — 2026-11-22 — code source
6. LineBasicMaterial.linewidth, threejs.org — https://threejs.org/docs/#api/en/materials/LineBasicMaterial.linewidth — non revérifié ce jour — doc officielle
7. LineMaterial.js r186.1 — https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/lines/LineMaterial.js — 2026-11-22 — code source
8. tone, registre npm — https://registry.npmjs.org/tone — 2026-11-22 — registre
9. Tonejs/Tone.js, API GitHub — https://api.github.com/repos/Tonejs/Tone.js — 2026-11-22 — dépôt
10. Draw.js et index.d.ts de tone 15.1.22 — https://unpkg.com/tone@15.1.22/build/esm/core/util/Draw.js — 2026-11-22 — code source
11. danigb/smplr, README — https://github.com/danigb/smplr — 2026-11-22 — dépôt
12. smplr, registre npm — https://registry.npmjs.org/smplr — 2026-11-22 — registre
13. GregSullivan.E-Pianos, README (License) — https://github.com/sfzinstruments/GregSullivan.E-Pianos — 2026-11-22 — dépôt
14. jlearman.jRhodes3d, LICENSE — https://github.com/sfzinstruments/jlearman.jRhodes3d/blob/master/LICENSE — 2026-11-22 — dépôt
15. SplendidGrandPiano — https://github.com/sfzinstruments/SplendidGrandPiano — 2026-11-22 (push 2024-07, plus de 12 mois) — dépôt
16. dsmolken.double-bass — https://github.com/sfzinstruments/dsmolken.double-bass — 2026-11-22 — dépôt
17. VSCO-2-CE — https://github.com/sgossner/VSCO-2-CE — 2026-11-22 (push 2021, plus de 12 mois) — dépôt
18. VCSL — https://github.com/sgossner/VCSL — 2026-11-22 — dépôt
19. gleitz/midi-js-soundfonts — https://github.com/gleitz/midi-js-soundfonts — 2026-11-22 (push 2022, plus de 12 mois) — dépôt
20. GSAP Standard License — https://gsap.com/standard-license — 2026-11-22 (effet 2025-04-30, modifiée 2025-05-30) — licence officielle
21. gsap, registre npm — https://registry.npmjs.org/gsap — 2026-11-22 — registre
22. Lenis, README — https://raw.githubusercontent.com/darkroomengineering/lenis/main/README.md — 2026-11-22 — doc officielle
23. Lenis, releases — https://github.com/darkroomengineering/lenis/releases — 2026-10-15 — dépôt
24. theatre-js/theatre — https://github.com/theatre-js/theatre — 2026-11-22 (dernière version 2024-05, plus de 12 mois) — dépôt
25. @strudel/web, registre npm — https://registry.npmjs.org/@strudel/web — 2026-11-22 — registre
26. essentia.js, registre npm — https://registry.npmjs.org/essentia.js — 2026-11-22 — registre
27. surikov/webaudiofont, API GitHub — https://api.github.com/repos/surikov/webaudiofont — 2026-11-22 — dépôt
28. Splice Terms — https://splice.com/terms — 2026-11-02 — CGU
29. Spitfire Audio, article d'aide 11815239 — https://support.spitfireaudio.com/en/articles/11815239 — 2025-07-21 — doc éditeur
30. Fontsource, Fraunces (variable) — https://api.fontsource.org/v1/variable/fraunces — 2026-11-22 — API officielle
31. troika-three-text, registre npm — https://registry.npmjs.org/troika-three-text — 2026-11-22 — registre
32. smpldsnds/drum-machines, README — https://github.com/smpldsnds/drum-machines — 2026-11-22 — dépôt
33. @grame/faustwasm, registre npm — https://registry.npmjs.org/@grame/faustwasm — 2026-11-22 — registre
34. @elemaudio/web-renderer, registre npm — https://registry.npmjs.org/@elemaudio/web-renderer — 2026-11-22 — registre
35. spite/THREE.MeshLine — https://github.com/spite/THREE.MeshLine — 2026-11-22 — dépôt
36. Line2NodeMaterial.js r186.1 — https://cdn.jsdelivr.net/npm/three@0.186.1/src/materials/nodes/Line2NodeMaterial.js — 2026-11-22 — code source
37. BloomNode.js r186 — https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/BloomNode.js — 2026-11-22 — code source
38. Bug WebKit 299237 (WebGPU / macOS Tahoe) — https://bugs.webkit.org/show_bug.cgi?id=299237 — 2025-09 (plus de 12 mois, non revérifié) — suivi de bugs
39. UnrealBloomPass.js r187 — https://github.com/mrdoob/three.js/blob/r187/examples/jsm/postprocessing/UnrealBloomPass.js — 2026-11-22 — code source
40. Astro View Transitions — https://docs.astro.build/en/guides/view-transitions/ — 2026-11-22 — doc officielle
41. astro, registre npm — https://registry.npmjs.org/astro — 2026-11-18 — registre
42. meyda/meyda — https://github.com/meyda/meyda — 2026-11-22 (release 2024-04, plus de 12 mois) — dépôt
43. AnalyserNode, spec W3C Web Audio — https://webaudio.github.io/web-audio-api/#AnalyserNode — 2026-11-22 — spécification
44. Spline Pricing — https://spline.design/pricing — 2026-11-22 — page de prix
45. Unicorn Studio Pricing — https://www.unicorn.studio/docs/pricing/ — 2026-11-22 — page de prix
46. cables.gl, licence — https://cables.gl/docs/faq/licence_payment/licence/licence — 2026-11-22 — doc officielle
47. KodeLife, hexler — https://hexler.net/kodelife — 2026-11-22 — page produit
48. Pangram Pangram EULA — https://pangrampangram.com/pages/eula — 2026-11-22 — licence
49. Codrops, « The Architecture Behind Trionn » — https://tympanus.net/codrops/2026/07/15/the-architecture-behind-trionn-coordinating-gsap-three-js-lenis-and-web-audio/ — 2026-07-15 (403, extrait de recherche) — article technique
50. Codrops, « Building Aether 1 » — https://tympanus.net/codrops/2025/08/06/building-aether-1-sound-without-boundaries/ — 2025-08-06 — article technique
51. Codrops, « Run Rob Run » — https://tympanus.net/codrops/2026/08/20/run-rob-run-building-a-music-reactive-goo-with-three-js-and-webgpu/ — 2026-08-20 — article technique
52. Awwwards, Site of the Year 2024 — https://www.awwwards.com/annual-awards-2024/site-of-the-year — 2024 (plus de 12 mois ; 404 en lecture directe) — palmarès
53. Codrops, « Coding a 3D Audio Visualizer » — https://tympanus.net/codrops/2025/06/18/coding-a-3d-audio-visualizer-with-three-js-gsap-web-audio-api/ — 2025-06-18 (plus de 12 mois) — tutoriel
54. chrome-devtools-mcp, registre npm — https://registry.npmjs.org/chrome-devtools-mcp — 2026-11-22 — registre
55. DmitriyGolub/threejs-devtools-mcp — https://github.com/DmitriyGolub/threejs-devtools-mcp — 2026-11-22 — dépôt
56. anthropics/skills, frontend-design — https://github.com/anthropics/skills/tree/main/skills/frontend-design — 2026-11-22 — dépôt
57. Spector.js, README du MCP — https://raw.githubusercontent.com/BabylonJS/Spector.js/master/mcp/README.md — 2026-11-22 — dépôt
58. elevenlabs/elevenlabs-mcp, API GitHub — https://api.github.com/repos/elevenlabs/elevenlabs-mcp — 2026-11-22 (archivé) — dépôt
