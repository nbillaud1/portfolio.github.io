# Audio : moteur, partitions et signaux pour la nappe

Statut : proposition du 2026-11-22, à valider à l'écoute dans la maquette. Public : la personne qui code `maquette/` puis le portage Astro.
Ce document s'aligne sur `docs/design/DA.md` (tempos de référence, bandes d'analyse, séquence de transition, entrée, lecteur). Les écarts sont signalés en **Écart avec la DA**.

Toutes les valeurs (dB, Hz, probabilités) sont des valeurs de départ. On les règle à l'oreille, mais on part de celles-ci.

---

## 0. Ce qui a été vérifié dans `node_modules` (2026-11-22)

### smplr 1.2.0 (`node_modules/smplr/README.md`, `dist/index.d.ts`, `dist/index.mjs`)

- Chaque instrument est une **fabrique** (pas de `new`) : `Instrument(context, options)`. Fabriques exportées : `Sampler`, `Soundfont`, `SplendidGrandPiano`, `ElectricPiano`, `DrumMachine`, `DrumAbuse`, `Mallet`, `Mellotron`, `Smolken`, `Versilian`, `Soundfont2`, plus `Reverb`, `Sequencer`, `SampleLoader`, `Scheduler`, `CacheStorage`, `HttpStorage`.
- Options communes : `volume` (0–127, 100 par défaut), `velocity`, `pan`, `destination` (un `AudioNode`, sinon `context.destination`), `loader` (un `SampleLoader` partagé : les buffers déjà chargés ne sont pas refetchés), `scheduler`, `notesToLoad`, `maxVoices`, `onLoadProgress({ loaded, total })`, `onStart`, `onEnded`.
- Chargement : `await inst.ready` ; `inst.loadProgress` donne `{ loaded, total }` (total connu dès le départ, utile pour le trait de chargement de la DA).
- `notesToLoad: { notes, velocityRange: [bas, haut], fallback }`. `notes` accepte numéros MIDI, noms de notes ou noms de samples. `fallback` vaut `"none"` par défaut (une note non chargée ne joue **rien**), sauf `SplendidGrandPiano` où il vaut `"nearest"`. Le filtrage se fait par région : on charge les samples dont la plage de touches couvre une note demandée.
- **Piège** : une vélocité hors de `velocityRange` chargée ne trouve pas de région. Toujours **borner les vélocités jouées** à la plage chargée.
- Jeu : `inst.start({ note, velocity, time, duration })` renvoie une fonction `stop({ time })` ; `inst.stop()` coupe tout ; `inst.stop(note)` coupe une note. `time` et `duration` en secondes, sur l'horloge `context.currentTime`.
- Sortie : `inst.output.volume = 0…127`, `inst.output.addInsert(node)`, `inst.output.addEffect(nom, node, mix)`. `inst.dispose()`.
- Scheduler interne : les notes à moins de 200 ms (`lookaheadMs`) sont envoyées tout de suite au moteur audio. Nos notes arrivent environ 100 ms à l'avance (horloge Tone), donc elles partent immédiatement et ne dépendent pas des minuteurs de la page.
- Noms exacts relevés :
  - `getDrumMachineNames()` → `"TR-808"`, `"Casio-RZ1"`, `"LM-2"`, `"MFB-512"`, `"Roland CR-8000"`. Les sons d'une machine se lisent à l'exécution avec `getGroupNames()` (ex. `kick`, `snare`).
  - `getSmolkenNames()` → `"Pizzicato"`, `"Arco"`, `"Switched"` (`"Arco"` par défaut).
  - `getElectricPianoNames()` → `"CP80"`, `"PianetT"`, `"WurlitzerEP200"`, `"TX81Z"`.
  - `getMalletNames()` → 14 noms dont `"Vibraphone - Soft Mallets"`, `"Vibraphone - Hard Mallets"`, `"Vibraphone - Bowed"`, `"Tubular Bells 1"`, `"Xylophone - Soft Mallets"`.
  - `Versilian({ instrument })` prend un **chemin VCSL** sans extension, par ex. `"Membranophones/Struck Membranophones/Snare Drum, Modern 1"`. Catalogue complet : `await getVersilianInstruments()` (fetch de `https://smpldsnds.github.io/sgossner-vcsl/sfz_files.json`, lu le 2026-11-22).
- Couches du piano `SplendidGrandPiano` (tableau `LAYERS` du code, le README dit « 4 ») : 5 groupes, **PPP 1–40** (mêmes fichiers « PP » avec un passe-bas à 1 kHz), **PP 41–67**, **MP 68–84**, **MF 85–100**, **FF 101–127**. Environ 65 samples par couche.
- CDN par défaut : `https://smpldsnds.github.io/…` (GitHub Pages, débit limité selon le README : charger **un instrument à la fois**).
- Poids mesurés (en-tête `content-length`, fichiers `.ogg`) : piano 62–68 Ko par note ; caisse claire VCSL 17 Ko ; charleston VCSL 13 Ko ; cymbale suspendue (frappe baguette) 92 Ko ; crescendo de cymbale 4 s 160 Ko ; contrebasse pizz 88 Ko par fichier.

### Tone 15.1.22 (`node_modules/tone/build/esm/*.d.ts` et `.js`)

- `Tone.setContext(contexte, disposeOld)` : si on lui passe un `AudioContext` **natif**, Tone l'enveloppe dans un `Tone.Context` et crée ensuite tous ses nœuds avec ce contexte natif. Les nœuds Tone et smplr peuvent alors se brancher entre eux sans adaptateur.
- Le simple chargement de `Tone.js` crée un contexte par défaut (`export const context = getContext()`), et les constantes dépréciées `Tone.Transport`, `Tone.Destination`, `Tone.Draw` pointent vers **ce** contexte. Après `setContext`, n'utiliser que `Tone.getContext()`, `Tone.getDestination()`, `Tone.getDraw()`.
- `new Tone.Clock(callback, frequenceHz)` : `callback(time, ticks)`, `time` exact en secondes de contexte ; `.start(t)`, `.stop(t)`, `.pause(t)`, `.frequency` (signal).
- `Tone.getTransport()` : `bpm`, `swing` (0–1), `swingSubdivision`, `scheduleRepeat`, `position`. **Un seul tempo et un seul swing pour tout le site** (voir 1.4).
- Synthés : `Synth`, `MonoSynth`, `FMSynth`, `AMSynth`, `DuoSynth`, `MembraneSynth`, `MetalSynth`, `NoiseSynth`, `PluckSynth`, `PolySynth` (`maxPolyphony`, `releaseAll(t)`, `set()`, pas de signal `detune` commun), `Sampler`. `Monophonic.detune` est un signal en cents (utile pour les chutes de cuivres).
- `PluckSynth` (Karplus-Strong) : `attackNoise`, `dampening` (setter immédiat, non programmable), `resonance` (lue **au moment de l'attaque** : `setValueAtTime(this.resonance, time)`), `release`.
- Effets : `Distortion` (`distortion`, `oversample`), `Chebyshev`, `EQ3`, `Filter` (`type`, `frequency`, `Q`, `rolloff` −12/−24/−48/−96), `Reverb` (`decay`, `preDelay`, promesse `ready`), `FeedbackDelay`, `PingPongDelay`, `Chorus`, `Tremolo`, `AutoFilter` (ces trois-là demandent `.start()`), `AutoWah`, `Vibrato`, `Phaser`, `StereoWidener`, `Compressor`, `Limiter(seuil)`, `Gain(valeur, unités)`, `Volume`, `Channel(volume, pan)`, `Panner`, `CrossFade` (2 entrées seulement, `fade` 0–1 à puissance constante).
- Analyse : `Analyser`, `FFT`, `Meter`, `Follower`, `Waveform`.
- **AudioWorklet** : `PluckSynth`, `Freeverb`, `JCReverb` (via `LowpassCombFilter` / `FeedbackCombFilter`) et `BitCrusher` utilisent un AudioWorklet. Il faut un contexte sécurisé : `http://127.0.0.1` l'est. Le module se charge de façon asynchrone : créer ces nœuds dès l'entrée, bien avant qu'ils jouent.
- `Draw` déclenche ses rappels un peu **avant** l'heure audio et ignore `outputLatency` (recherche 01, point 7). On ne l'utilise pas ; on a notre propre file d'événements (section 3).

---

## 1. Architecture

### 1.1 Chargement dans la maquette (sans bundler)

```html
<script src="/node_modules/tone/build/Tone.js"></script>   <!-- UMD : global window.Tone -->
<script type="importmap">
{ "imports": { "smplr": "/node_modules/smplr/dist/index.mjs" } }
</script>
```

Les deux chemins existent (vérifié). `smplr/dist/index.mjs` n'a aucun import nu.

Découpage conseillé (fichiers de la maquette, au choix de la session principale) : `audio/engine.js` (contexte, bus, fondus, contrôles), `audio/genres/{ambient,jazz,house,rock,boombap,soul}.js` (partitions), `audio/instruments.js` (rôles avec repli synthé), `audio/events.js` (bus d'événements), `audio/analysis.js` (bandes et attaques), `audio/rng.js`.

### 1.2 Un seul AudioContext partagé

Au clic sur « Entrer » (ou « Entrer sans le son »), dans le gestionnaire du clic, **avant tout `await`** :

```js
const ctx = new AudioContext({ latencyHint: isMobile ? 'playback' : 'interactive' });
ctx.resume();                                   // iOS : doit partir dans le geste
Tone.setContext(new Tone.Context({ context: ctx, lookAhead: 0.1 }), true);
// ensuite seulement : création des nœuds Tone et des instruments smplr
```

- Tone et smplr reçoivent **le même `ctx` natif**. smplr veut un `AudioNode` natif comme `destination`, or `Tone.Channel.input` est un nœud Tone (`Solo`, vérifié dans `Channel.js`). On intercale donc un gain natif :
  ```js
  const entree = ctx.createGain();
  Tone.connect(entree, tranche);            // tranche = new Tone.Channel(dB, pan)
  const piano = SplendidGrandPiano(ctx, { destination: entree, loader, notesToLoad });
  ```
- Un seul `SampleLoader(ctx)` partagé par tous les instruments smplr : la contrebasse de la tranche jazz et celle de la tranche boom bap utilisent les mêmes buffers.
- Le DA prévoit que rien n'est chargé avant le clic (DA 4.1). On respecte : pas d'`AudioContext` ni de fetch de samples avant « Entrer ».

### 1.3 Graphe

```
instrument ─► Channel (dB, pan) ─┬─────────────────────────────► busGenre.entrée
                                 └─► envoi (Gain) ─► Reverb du genre ─┘
busGenre.entrée ─► EQ du bus ─► passe-haut DJ ─► passe-bas DJ ─► fondu (GainNode natif) ─┐
   (× 6 genres)                                                                         │
bus transitions (scratch, montée) ──────────────────────────────────────────────────────┤
                                                                                        ▼
            master : Compressor (−16 dB, ratio 2, attaque 20 ms, relâche 200 ms)
                   ► Limiter(−1 dB) ► gainPause ►─┬─► gainUtilisateur ► destination
                                                 └─► AnalyserNode (dérivation)
```

- **Un bus par genre**, et chaque genre a sa propre réverbe à l'intérieur de son bus : la queue de réverbe part avec le genre dans le fondu.
- Le **gain de fondu** de chaque bus est un `GainNode` natif (`ctx.createGain()`) automatisé directement : pas de mélange entre automations Tone et natives sur le même paramètre.
- `AnalyserNode` branché **après la pause et avant le volume utilisateur** : la nappe réagit encore quand on baisse ou coupe le son (DA 2.3, « Entrer sans le son »), mais elle retombe quand on met en pause (DA 5.4 : « respiration sans réaction audio »).
- Passe-haut et passe-bas DJ : `Tone.Filter` `rolloff: -24`, au repos 20 Hz et 20 kHz. Ils servent seulement pendant les transitions.
- Niveau visé : crêtes du bus master vers −6 dBFS avant limiteur, le limiteur ne doit agir que sur les accidents. À contrôler avec un `Tone.Meter` en développement.
- Correction de volume par genre (`trim`, sur le gain d'entrée du bus), pour que les 6 genres paraissent aussi forts : ambient +2, jazz 0, house −2, rock −3, boom bap −1, soul 0 dB. À régler à l'oreille.

### 1.4 Une horloge par genre, pas le Transport

Le Transport de Tone n'a qu'un tempo et qu'un swing. Pendant les 2 s de fondu, deux genres jouent ensemble (ex. jazz 96 swing 0,60 et house 124 droit). Avec le Transport, l'un des deux serait joué au mauvais tempo ou au mauvais swing.

Chaque genre a donc **sa propre `Tone.Clock`** en double-croches : `frequency = bpm / 15` Hz (4 doubles par temps). Le rappel reçoit `(time, ticks)` ; `pas = ticks % 16`, `mesure = floor(ticks / 16)`. Le swing et l'humanisation sont ajoutés par notre code (1.5). On n'utilise ni `Transport`, ni `Loop`, `Part`, `Sequence` (qui dépendent du Transport).

**Écart avec la DA** (3.3, ligne f12–f108) : `Transport.bpm.rampTo(nouveau, 1.0)` est remplacé par « l'horloge du genre entrant démarre à son tempo, premier temps fort à t0 + 1,0 s ». Le résultat visuel est le même (la caméra se cale sur le tempo entrant à partir de f60).

### 1.5 Swing et humanisation

Convention : **ratio r** = part de la première note dans une paire (0,50 = droit, 0,667 = triolet). C'est la convention de la DA (jazz : 375 ms / 250 ms à 96 BPM, soit r = 0,60).

- Swing sur les croches (jazz) : les pas 2, 6, 10, 14 sont retardés de `(2r − 1) × durée_croche`.
- Swing sur les doubles (boom bap, soul, house) : les pas impairs sont retardés de `(2r − 1) × durée_double`.
- Conversion depuis le `swing` de Tone (s entre 0 et 1) : `r = 0,5 + s / 4`. Le « 0,15 » de la DA pour la soul donne r ≈ 0,54.
- Humanisation : décalage aléatoire (graine) et variation de vélocité par note, bornés par genre (tables de la section 2).

### 1.6 Fondu croisé à puissance constante (2 s)

Les gains suivent un quart de sinus : entrant `sin(θ)`, sortant `sin(π/2 − θ)`. À mi-chemin les deux valent 0,707 (−3 dB) : la puissance totale reste constante (DA f60 : « croisement à −3 dB »). `Tone.CrossFade` fait le même calcul mais n'a que 2 entrées ; on a 6 bus, d'où cette fonction.

```js
// état JS par bus : on ne relit pas param.value (peu fiable pendant une automation)
function fondre(bus, cible /* 0 ou 1 */, duree, t) {
  const v0 = bus.valeurA(t);                         // valeur courante calculée depuis l'état JS
  const th0 = Math.asin(Math.min(1, v0)), th1 = cible ? Math.PI / 2 : 0;
  const d = duree * Math.abs(th1 - th0) / (Math.PI / 2);   // un fondu repris à mi-course dure moins
  const n = 64, courbe = new Float32Array(n);
  for (let i = 0; i < n; i++) courbe[i] = Math.sin(th0 + (th1 - th0) * i / (n - 1));
  const p = bus.fondu.gain;
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t);
  p.setValueAtTime(v0, t);
  if (d > 0.01) p.setValueCurveAtTime(courbe, t, d); else p.setValueAtTime(cible, t);
  bus.memoriser({ th0, th1, t, d });
}
```

`cancelAndHoldAtTime` n'existe pas dans Firefox ; le repli `cancelScheduledValues` + `setValueAtTime` peut laisser un petit saut, masqué par le scratch.

### 1.7 Déroulé d'une transition (aligné sur DA 3.3)

`allerA(genre, { via: 'scroll' | 'platine' })`, à t0 = `ctx.currentTime + 0,03` :

1. **t0** : fondu du bus sortant vers 0 en 2,0 s (2,4 s par la platine, DA 3.1). Passe-bas DJ du sortant : 18 kHz → 400 Hz en 1,2 s (`exponentialRampToValueAtTime`). Scratch sur le bus transitions : `NoiseSynth` blanc → passe-bande Q 4, fréquence 2 kHz → 300 Hz → 1,2 kHz en 250 ms, −20 dB (450 ms et deux allers-retours par la platine ; 4 images, soit 70 ms, si une transition en interrompt une autre).
2. **t0** : fondu du bus entrant vers 1 en 2,0 s ; passe-haut DJ de l'entrant : 400 Hz → 20 Hz entre t0 et t0 + 1,5 s. Montée (« riser ») sur le bus entrant : bruit rose → passe-bande 300 → 5 000 Hz, de −40 à −24 dB entre t0 et t0 + 1,0 s, coupée net à t0 + 1,0 s.
3. **t0 + 1,0 s** : l'horloge du genre entrant démarre, **mesure 1, pas 0** : premier temps fort au point de croisement. Événement `drop` (bloom de la DA).
4. **t0 + 2,0 s** : sortant à 0. Son horloge s'arrête à la fin de la mesure en cours, ses voix sont relâchées (`releaseAll`, `stop()` smplr), ses filtres DJ sont remis au repos. Le sortant ne consomme plus de CPU.
5. Interruption : si une nouvelle cible arrive pendant un fondu, chaque bus repart de sa valeur courante (fonction 1.6). Au plus deux bus audibles : un troisième bus encore non nul part vers 0 en 0,4 s.
6. Pendant une pause : changer de genre n'enchaîne aucun fondu. On change seulement le genre actif ; la reprise le démarre.

Sortie de l'accueil (ambient, sans batterie) : même règle.

### 1.8 Préchargement et repli synthé

**Rôles.** Chaque partie instrumentale est un « rôle » avec deux réalisations : le sample smplr et un synthé Tone de repli. Interface commune : `role.jouer(note | notes, time, dureeS, vel01)`.

- Tant que `await inst.ready` n'est pas résolu (ou si le chargement échoue ou dépasse 8 s), le rôle joue son synthé.
- Le choix se fige **au début de chaque mesure**. On ne change pas de timbre au milieu d'une phrase.
- Échec réseau (GitHub Pages renvoie parfois 429) : on reste sur le synthé, un seul avertissement en console, pas de nouvel essai avant la section suivante.

| Rôle (sample) | Repli synthé (Tone) |
|---|---|
| Piano (SplendidGrandPiano) | `PolySynth(FMSynth)` harmonicité 2, index 1,2, enveloppe 2 ms / 1,8 s / 0 / 1 s, passe-bas 3 kHz |
| Contrebasse (Smolken Pizzicato) | `MonoSynth` triangle, passe-bas 500 Hz, attaque 3 ms, déclin 0,4 s, maintien 0,2 |
| Ride / cymbales (VCSL) | `MetalSynth` fréquence 300, harmonicité 5,1, index 32, déclin 1,2 s, −8 dB |
| Charleston (VCSL) | `MetalSynth` déclin 0,05 s (fermé) / 0,35 s (ouvert), passe-haut 7 kHz |
| Caisse claire (VCSL) | `NoiseSynth` blanc 0,16 s + `MembraneSynth` 180 Hz, 0,1 s |
| Clap, tambourin, shaker (VCSL) | `NoiseSynth` passe-bande 1,2 kHz / 6 kHz, enveloppes courtes |
| Vibraphone, sax (VCSL, options) | `FMSynth` (cloche) / rôle simplement muet |

**Ordre de chargement** (une file, un instrument à la fois, à cause du débit limité) :
1. Au clic : rien à charger pour jouer (l'ambient est jouable en synthés). On lance aussitôt le **piano PPP** de l'ambient (9 notes, environ 0,6 Mo), puis le jazz.
2. Ensuite, dans l'ordre de la page : jazz, house, rock, boom bap, soul.
3. Priorité dynamique : quand le genre N devient actif, N + 1 et N − 1 passent en tête de file. Survol ou focus d'un secteur de la platine : ce genre passe en tête (intention de saut).
4. `navigator.connection?.saveData` vrai : on ne charge que le genre actif.

Budgets par genre (piano mesuré, les autres estimés à partir des fichiers mesurés et **à vérifier** dans l'onglet Réseau) :

| Genre | Samples chargés | Estimation |
|---|---|---|
| ambient | piano PPP, 9 notes | ≈ 0,6 Mo |
| jazz | piano MP 16 notes ; contrebasse pizz, touches 28–50, couche 75–120 ; ride (cymbale susp. touche 70) ; charleston pied (44) | ≈ 3 à 4 Mo (la contrebasse a plusieurs fichiers par zone : à mesurer) |
| house | piano FF 14 notes ; claps (60) ; charleston 42 et 46 ; shaker (61) ; crescendo de cymbale (66) | ≈ 1,5 Mo |
| rock | caisse claire (61) ; charleston 43 et 46 ; cymbale susp. frappe (68) | ≈ 0,6 Mo |
| boom bap | contrebasse (déjà chargée par le jazz) ; caisse claire (60, 61) ; claps (61) ; charleston (42, 46) ; option vibraphone | ≈ 0,4 Mo de plus |
| soul | caisse claire (60, 61) ; charleston (42, 46) ; tambourin (60, 62) ; option sax ténor staccato | ≈ 0,5 Mo (+ sax à mesurer) |

Pour les percussions VCSL (4 couches : 0–54, 55–83, 84–106, 107–127 ; 2 à 6 variantes alternées par note), on charge seulement les couches des vélocités que le rôle joue :
- charlestons, ride, fantômes, tambourin, shaker, claps : `velocityRange: [55, 106]` ;
- caisses claires rock, boom bap et soul, crash rock (vélocités 108–120) : `velocityRange: [84, 127]`, et fantômes sur la même instance → vélocité minimale 84 pour eux, ou une seconde instance `[55, 83]` (mêmes buffers grâce au `SampleLoader` partagé).

### 1.9 Licences des banques

Règle : aucune banque NC, aucune banque sans licence vérifiée parmi les choix par défaut. Les fichiers viennent des copies `smpldsnds.github.io` utilisées par smplr ; la licence de l'original s'applique (la licence des dépôts miroirs n'a **pas** été vérifiée).

| Banque | Via | Licence | Source de la vérification | Statut |
|---|---|---|---|---|
| SplendidGrandPiano (Steinway, Akai) | `SplendidGrandPiano` | Domaine public | README du dépôt `sfzinstruments/SplendidGrandPiano` : « Public Domain samples by AKAI » (pas de fichier LICENSE ; lu le 2026-11-22) | **Retenue** |
| D. Smolken double bass | `Smolken` (`"Pizzicato"`) | CC0-1.0 | API GitHub `sfzinstruments/dsmolken.double-bass`, champ licence (2026-11-22) | **Retenue** |
| VCSL (Versilian Community Sample Library) | `Versilian`, `Mallet`, `ElectricPiano "TX81Z"` | CC0-1.0 | API GitHub `sgossner/VCSL`, champ licence (2026-11-22) | **Retenue** (percussions, options vibraphone, sax, clavier TX81Z) |
| Drum machines (TR-808…) | `DrumMachine` | « public domain » dans le README, pas de fichier LICENSE (API GitHub : aucune licence) | recherche 01 + API GitHub `smpldsnds/drum-machines` | **Non retenue** par défaut (origine non prouvée) |
| Greg Sullivan E-Pianos (CP80, PianetT, WurlitzerEP200) | `ElectricPiano` | CC-BY 3.0 (crédit obligatoire) | recherche 01 [13] | Non retenue (pas NC, mais inutile) |
| MusyngKite / FluidR3_GM | `Soundfont` | CC-BY-SA 3.0 / CC-BY 3.0 | recherche 01 [19] | Non retenues |
| Mellotron (archive.org) | `Mellotron` | non vérifié | — | Écartée |
| DrumAbuse (Synthabuse) | `DrumAbuse` | aucune licence trouvée | recherche 01 | Écartée |
| jRhodes3d | — | CC BY-NC | recherche 01 [14] | **Écartée (NC)** |
| Tone.js 15.1.22 / smplr 1.2.0 | code | MIT / MIT (`package.json`) | — | Retenus |

Crédits à afficher en pied de page (DA 5.2) : « Piano : Splendid Grand Piano (Akai, domaine public). Contrebasse : D. Smolken (CC0). Percussions et vibraphone : Versilian Community Sample Library (CC0). Musique générée en direct avec Tone.js et smplr. »

---

## 2. Les six genres

### 2.0 Conventions communes

- Grille : 16 pas par mesure (doubles-croches), mesure 4/4. Les positions sont des numéros de pas 0–15. « s » après un pas = pas swingué.
- Boucle de 8 mesures, puis on recommence avec une nouvelle graine de variation.
- Graine : `rng = mulberry32(hash(genre) ^ (boucle × 7919) ^ (mesure × 104729))`. Même graine, même musique : la démo est reproductible.
- Variations **contrôlées** : les points d'appui (temps 1, contretemps de la caisse claire, accords) ne bougent jamais ; seules les notes optionnelles (fantômes, anticipations, fills, voicings alternatifs, petites phrases) sont tirées, avec les probabilités indiquées.
- Volumes : `Tone.Channel` en dB (smplr reste à `volume: 100`). Les dB sont relatifs entre eux, le trim du bus (1.3) fait le reste.
- Vélocités smplr bornées à la plage chargée (piège 0).
- Notes en MIDI (do 4 = 60).

### 2.1 Accueil · ambient

| Réglage | Valeur |
|---|---|
| Tempo | 64 BPM (DA), aucune batterie. Mesure = 3,75 s, boucle de 8 mesures = 30 s |
| Tonalité | do lydien (gamme de sol majeur sur pédale de do) |
| Pédale | do 1 + sol 1 tenus en permanence (DA 4.2), doublés à l'octave (do 2, sol 2) à −18 dB pour les haut-parleurs de portable qui ne descendent pas à 33 Hz |
| Grille (2 mesures par accord) | Cmaj9 · D/C · Em9 · Am9 |
| Swing / humanisation | aucun / ±20 ms, vélocité ±15 % |

Voicings de la nappe (sur la pédale) :

| Accord | Notes | MIDI |
|---|---|---|
| Cmaj9 | mi 3, sol 3, si 3, ré 4 | 52 55 59 62 |
| D/C (couleur lydienne) | ré 3, fa♯ 3, la 3, mi 4 | 50 54 57 64 |
| Em9 | mi 3, sol 3, si 3, fa♯ 4 | 52 55 59 66 |
| Am9 | la 3, si 3, do 4, mi 4, sol 4 | 57 59 60 64 67 |

Instruments :
- **Nappe** : `PolySynth(Synth)`, oscillateur `fattriangle` (count 3, spread 24), attaque 3 s, déclin 1 s, maintien 0,8, relâche 5 s (les accords se chevauchent), `maxPolyphony` 12 → `Filter` passe-bas 1 100 Hz −24 → `AutoFilter` (fréquence 0,04 Hz, base 300 Hz, 2,5 octaves, `.start()`) → `Chorus` (0,3 Hz, 4 ms, profondeur 0,6, `.start()`).
- **Drone** : deux `Synth` sinus (do 1, sol 1) + deux à l'octave ; montée de silence à −12 dB en 2,5 s au clic (DA 4.2).
- **Cloche d'entrée** : `FMSynth` harmonicité 3,5, index 10, déclin 4 s ; **une seule note la 5 (81) à t = 0,38 s** (DA 4.2).
- **Piano lointain** (à partir de 2,6 s, « la mélodie ambient commence ») : SplendidGrandPiano, `notesToLoad: { notes: [74, 76, 79, 81, 83, 86, 88, 90, 91], velocityRange: [1, 40] }` (couche PPP, déjà filtrée à 1 kHz : son lointain naturel). Par mesure : 0 à 3 notes (probabilités 0,2 / 0,4 / 0,3 / 0,1) tirées dans cette gamme, sur des pas libres, vélocité 18–38, durée 1,5–3 s → `FeedbackDelay` (« 4n. », retour 0,42, wet 0,3). Repli : `FMSynth` cloche douce.
- **Souffle** : `Noise('pink')` → passe-bande 5 kHz Q 0,6 → `Gain` modulé par un `LFO` 0,07 Hz entre −42 et −32 dB.

Mixage : nappe −15 · drone −12 (−18 pour l'octave) · piano −12 · cloche −14 · souffle (voir LFO).
Effets : `Reverb` decay 9 s, preDelay 0,06, en envoi : nappe −6, piano −3, cloche −4, souffle −12 dB ; retour −4 dB. Attendre `reverb.ready` avant le premier son (générée au clic, quelques dizaines de ms).

Événements pour la nappe : `chord` à chaque changement, `note` à chaque note de piano (scintillement doux), `beat` à chaque noire. Pas de `kick`.

### 2.2 Présentation · jazz (or)

| Réglage | Valeur |
|---|---|
| Tempo | 96 BPM (DA). Noire = 625 ms, mesure = 2,5 s, boucle = 20 s |
| Tonalité | fa majeur |
| Swing | croches, r = 0,60 (375 / 250 ms, DA 5.2) |
| Humanisation | ±10 ms, vélocité ±10 % ; ride en avance de 5 ms (le batteur pousse) |
| Grille (8 mesures) | Fmaj9 · D7(♭9) · Gm9 · C13 · Am7 D7(♭9) · Gm9 C7(♭9) · Fmaj9 · Gm7 C7(♭9) |

Voicings du piano (main gauche sans fondamentale, conduite de voix serrée) :

| Accord | Notes | MIDI |
|---|---|---|
| Fmaj9 | mi 3, sol 3, la 3, do 4 | 52 55 57 60 |
| D7(♭9) | fa♯ 3, la 3, do 4, mi♭ 4 | 54 57 60 63 |
| Gm9 | fa 3, la 3, si♭ 3, ré 4 | 53 57 58 62 |
| C13 | mi 3, la 3, si♭ 3, ré 4 | 52 57 58 62 |
| Am7 (9) | sol 3, si 3, do 4, mi 4 | 55 59 60 64 |
| C7(♭9) | mi 3, sol 3, si♭ 3, ré♭ 4 | 52 55 58 61 |
| Gm7 | fa 3, si♭ 3, ré 4 | 53 58 62 |

Instruments :
- **Piano** : SplendidGrandPiano, couche MP (`velocityRange: [68, 84]`), notes 52–64 et 72–81 (fills) ; le piano n'a pas un sample par demi-ton, cela fait environ 16 fichiers. Comping, une cellule tirée par mesure (ou par demi-mesure pour les mesures à deux accords) :
  - A « Charleston » : pas 0 (3 pas) + pas 6s (2 pas) — poids 0,35
  - B « anticipation » : l'accord suivant joué au pas 14s de la mesure d'avant, tenu — poids 0,25
  - C « 2 et 4 » : pas 4 et 12, courts — poids 0,20
  - D « en l'air » : pas 6s et 10 — poids 0,20
  Vélocité 68–84. Mesures 4 et 8 : avec probabilité 0,4, petite phrase main droite de 3 à 6 croches swinguées, gamme bebop de fa majeur (fa sol la si♭ do ré mi♭ mi), do 5–la 5, qui finit sur une note de l'accord.
- **Contrebasse** : Smolken `"Pizzicato"`, `notesToLoad: { notes: [28…50], velocityRange: [75, 120] }`. Walking bass en noires (pas 0, 4, 8, 12), durée 0,85 temps, vélocité 78–100 :
  - temps 1 : fondamentale (octave la plus proche de la note précédente, entre mi 1 = 28 et do 3 = 48) ;
  - temps 2 et 3 : tierce, quinte ou note de passage de la gamme vers la cible ;
  - temps 4 : approche de la fondamentale suivante : demi-ton en dessous (0,45), demi-ton au-dessus (0,25), quinte de l'accord suivant (0,20), degré conjoint (0,10) ;
  - mesures à deux accords : temps 1 = fondamentale 1, temps 2 = approche, temps 3 = fondamentale 2, temps 4 = approche ;
  - avec probabilité 0,1 : note morte fantôme au pas 14s (vélocité 75, durée 60 ms).
  Vérifier l'octave à l'oreille : si la contrebasse sonne une octave trop haut ou trop bas, décaler toute la ligne de 12.
- **Ride** : VCSL `"Idiophones/Struck Idiophones/Suspended Cymbal 1"`, touche 70 (frappe baguette). Pas 0, 4, 6s, 8, 12, 14s ; vélocités 80, 95, 65, 80, 95, 65. Variation : 0,15 de chances d'omettre une note swinguée ; cloche (touche 69) au premier temps de la boucle.
- **Charleston au pied** : VCSL `"Idiophones/Struck Idiophones/Hi-Hat Cymbal"`, touche 44 (fermeture au pied), pas 4 et 12, vélocité 70.
- **Balais** (aucun balai libre trouvé dans VCSL : synthèse) :
  - frottement continu : `Noise('pink')` → passe-bande 2,8 kHz Q 0,8 → `Gain` dont on programme une bosse par temps (0,02 → 0,08 en 30 % du temps → 0,03) ;
  - frappe sur 2 et 4 : `NoiseSynth` blanc, attaque 3 ms, déclin 0,11 s → passe-bande 3,5 kHz ;
  - relances : 0,2 de chances par mesure d'une frappe au pas 6s ou 14s (vélocité 0,35) ; mesure 8 : petit fill (pas 8, 10s, 12, 14s).
- **Grosse caisse effleurée** : `MembraneSynth` (la 0, pitchDecay 0,02, 2 octaves, déclin 0,25 s), 4 noires, très bas.

Mixage (dB) : piano −8 (pan +0,15) · contrebasse −5 · ride −15 (pan +0,35) · charleston pied −21 (pan −0,25) · frottement −28 · frappe balai −18 · grosse caisse −26.
Effets : `EQ3` sur le piano (aigus −2 dB) ; `Reverb` de pièce decay 1,6 s, preDelay 12 ms, envois piano −14, ride −18, balais −16, contrebasse −24.

Événements : `bass` à chaque note de contrebasse (la DA lance un anneau par note), `chord` à chaque attaque d'accord (avec les notes), `hat` pour la ride, `snare` pour la frappe de balai, `bar`.

### 2.3 Projets · house (vert acide)

| Réglage | Valeur |
|---|---|
| Tempo | 124 BPM. Mesure = 1,935 s, boucle = 15,5 s |
| Tonalité | la mineur |
| Swing | doubles, r = 0,54 (léger) |
| Humanisation | ±4 ms ; grosse caisse exactement sur la grille |
| Grille (2 mesures par accord) | Am9 · Fmaj9 · Dm9 · E7sus4 (mesure 7) puis E7(♭9) (mesure 8) |

Voicings des stabs de piano (notes communes en haut : le son « deep house ») :

| Accord | Notes | MIDI |
|---|---|---|
| Am9 | do 4, mi 4, sol 4, si 4 | 60 64 67 71 |
| Fmaj9 | do 4, mi 4, sol 4, la 4 | 60 64 67 69 |
| Dm9 | do 4, mi 4, fa 4, la 4 | 60 64 65 69 |
| E7sus4 | si 3, ré 4, mi 4, la 4 | 59 62 64 69 |
| E7(♭9) | sol♯ 3, si 3, ré 4, fa 4 | 56 59 62 65 |

Instruments :
- **Grosse caisse** (synthèse) : `MembraneSynth` sinus, note la 1 (55 Hz), pitchDecay 0,045, 5 octaves, enveloppe 1 ms / 0,42 s / 0 / 0,05 → `Distortion` 0,1. Plus un clic : `NoiseSynth` 3 ms → passe-haut 4 kHz. Pas 0, 4, 8, 12, toujours.
- **Clap** : VCSL `"Idiophones/Struck Idiophones/Claps"`, touche 60 (6 variantes alternées), pas 4 et 12.
- **Charleston ouvert** : VCSL Hi-Hat, touche 46, pas 2, 6, 10, 14, vélocité 90. **Fermé** : touche 42, pas impairs, vélocité 50–70, chaque note jouée avec probabilité 0,8.
- **Shaker** : VCSL `"Idiophones/Struck Idiophones/Shaker, Small"`, touche 61, doubles-croches, accents 60 / 40.
- **Basse** : `MonoSynth` carré, filtre passe-bas −24 Q 3, enveloppe de filtre base 120 Hz, 3 octaves, déclin 0,12 s ; enveloppe d'amplitude 3 ms / 0,2 s / 0,6 / 0,08. Fondamentales la 1 (33), fa 1 (29), ré 2 (38), mi 1 (28). Notes sur les contretemps 2, 6, 10, 14 (durée 1,5 pas) ; octave supérieure au pas 7 (0,4) ; approche chromatique au pas 15 (0,3).
- **Piano stabs** : SplendidGrandPiano couche FF (`velocityRange: [101, 127]`), notes 56–71 (environ 14 fichiers), vélocité 104–122, durée 0,11 s. Une cellule tirée par accord (2 mesures), la 2e mesure reprend la même avec probabilité 0,6 :
  - S1 : 0, 3, 6, 10, 13 · S2 : 2, 5, 8, 11, 14 · S3 : 0, 6, 12 (3 pas chacune) · S4 : 3, 7, 10, 14
- **Nappe** : `PolySynth(Synth)` `fatsawtooth` (count 3, spread 18), attaque 0,4 s, relâche 1,5 s, accords une octave sous les stabs, tenus 2 mesures → `AutoFilter` (« 2m », base 400 Hz, 3 octaves, wet 0,6).
- **Pompe (sidechain)** : à chaque grosse caisse, programmé par le séquenceur sur un `GainNode` placé après la nappe et l'envoi de réverbe : 1 → 0,35 en 10 ms, retour à 1 à t + 200 ms. Plus précis qu'un compresseur et sans coût.
- **Montée de fin de boucle** (toutes les 2 boucles) : VCSL `"Idiophones/Struck Idiophones/Suspended Cymbal 1"` touche 66 (`cresc_4s`), lancée 4,0 s avant le premier temps de la boucle suivante (durée réelle du fichier à vérifier, corriger le décalage si besoin). Mesure 16 : grosse caisse coupée sur les deux derniers temps.

Mixage (dB) : grosse caisse −3 · clic −18 · clap −10 · charleston ouvert −15 · fermé −21 · shaker −24 · basse −7 · piano −9 · nappe −20 · montée −14.
Effets : piano → `PingPongDelay` (« 8n. », retour 0,28, wet 0,18) → passe-haut 180 Hz ; `Reverb` decay 2,4 s, envois clap −12, piano −14, nappe −10.

Événements : `kick` (la pompe visuelle de la DA), `snare` (clap), `hat` (charlestons ouverts), `chord` (au changement) et `stab` (chaque stab), `bass`, `riser` (début de montée, avec sa durée).

### 2.4 Expériences · rock (rouge)

| Réglage | Valeur |
|---|---|
| Tempo | 136 BPM, droit. Mesure = 1,765 s, boucle = 14,1 s |
| Tonalité | mi mineur, accords de puissance |
| Humanisation | ±6 ms ; guitare droite décalée de +12 ms (double prise) |
| Riff (8 mesures) | E5 · E5 G5 · A5 · C5 D5 · E5 · E5 G5 · A5 C5 · B5 |

Accords de puissance (hauteur réelle, mi grave de guitare = 40) :

| Accord | MIDI |
|---|---|
| E5 | 40 47 52 |
| G5 | 43 50 55 |
| A5 | 45 52 57 |
| C5 | 48 55 60 |
| D5 | 50 57 62 |
| B5 | 47 54 59 |

Rythme de la guitare (X = accord ouvert, durée en pas ; m = étouffé à la paume, fondamentale + quinte, 1 pas) :
- mesure à un accord : X(3) au pas 0 · m 4 · m 6 · X(3) 8 · m 12 · m 14 ;
- mesure à deux accords : X(6) au pas 0 sur le 1er · m 6 · X(8) au pas 8 sur le 2e ;
- mesure 8 (B5) : X(2) 0 · X(2) 3 · X(2) 6 · silence de 8 à 15 (fill de toms) ;
- variation (0,25 par mesure) : un m remplacé par une double m-m (pas 14 et 15).

**Guitare saturée crédible** (aucune banque libre vérifiée, recherche 01) :

Source, par côté (gauche et droite) :
1. Trois `PluckSynth` (une par corde de l'accord) : `attackNoise` 1,2, `dampening` 3 800 Hz (3 600 à droite), `resonance` 0,985 pour X, **0,88 pour m** (la résonance est lue à l'attaque, on la change juste avant `triggerAttack`), `release` 1,2 s.
2. Sous-couche de tenue (le Karplus-Strong s'éteint trop vite une fois saturé) : `PolySynth(Synth)` `fatsawtooth` (count 2, spread 14), enveloppe 4 ms / 0,3 s / 0,55 / 0,15 s, à −8 dB sous les cordes ; pour m, durée 70 ms.
3. Désaccord de la droite : `detune` +6 cents sur la sous-couche, +12 ms de retard.

Chaîne d'ampli, par côté :
`passe-haut 110 Hz` → `bosse de médiums` (Filter `peaking` 900 Hz, +6 dB, Q 0,9 : resserre la saturation) → `Distortion` (0,85, `oversample: '4x'`) → baffle simulé : `passe-haut 80 Hz` → `peaking 400 Hz −4 dB Q 1` (enlève la boue) → `peaking 2,2 kHz +3 dB Q 1,2` (présence) → `passe-bas 5,2 kHz rolloff −24` (coupure du haut-parleur 12") → `Panner` −0,65 / +0,65.

Aucune réponse impulsionnelle de baffle libre n'a été vérifiée : pas de `Convolver`, l'égaliseur suffit. Si l'AudioWorklet du `PluckSynth` n'est pas disponible, on ne garde que la sous-couche, avec une enveloppe de filtre (`MonoSynth`-like, 2 kHz → 600 Hz en 0,3 s).

Option, mesure 8 une boucle sur deux : note tenue mi 4 (64) en `Synth` dent de scie dans la chaîne gauche, `Vibrato` 5,5 Hz profondeur 0,15 qui entre après 400 ms, −14 dB (effet « larsen » tenu).

Autres instruments :
- **Basse** : `MonoSynth` dent de scie, passe-bas −24, enveloppe de filtre base 180 Hz, 2,2 octaves, déclin 0,15 s → `Distortion` 0,25 (`'2x'`) → passe-bas 2,5 kHz. Fondamentale une octave sous la guitare (mi 1 = 28), mêmes pas que les X et les m.
- **Grosse caisse** : `MembraneSynth`, si 1 (62 Hz), pitchDecay 0,03, 4 octaves, déclin 0,3 s + clic de batte (`NoiseSynth` → passe-haut 3 kHz). Pas 0, 8, 10 ; variation 0,15 : ajout au pas 6 ou 14.
- **Caisse claire** : VCSL `"Membranophones/Struck Membranophones/Snare Drum, Modern 1"` touche 61 (timbre en place), vélocité 108–120, pas 4 et 12 + couche `NoiseSynth` blanc (passe-bande 2 kHz, déclin 0,18 s).
- **Charleston** : VCSL Hi-Hat touche 43 (frappe lâche), croches, vélocités 95 / 70 ; mesure 8 : ouvert (46) au pas 14.
- **Crash** : VCSL Suspended Cymbal 1 touche 68, vélocité 110, mesures 1 et 5.
- **Toms** (fill de la mesure 8, pas 8–15) : trois `MembraneSynth` accordés la 2, fa 2, ré 2 (110, 87, 73 Hz), 2 octaves, déclin 0,35 s ; doubles 8-9 aigu, 10-11 médium, 12-13-14-15 grave, caisse claire avec le dernier.

Mixage (dB) : guitares −9 chacune · sous-couche −17 · basse −7 · grosse caisse −4 · clic −16 · caisse claire −6 · couche bruit −16 · charleston −17 · crash −15 · toms −10 · larsen −14.
Effets : `Reverb` de pièce 0,9 s, envois caisse claire −10, toms −14, guitares −20 dB.

Événements : `kick`, `snare` (anneau fort + secousse, DA), `crash` (bloom de la DA), `hat`, `chord` (chaque X, avec la fondamentale), `bass`, `fill`.

### 2.5 Compétences · hip-hop boom bap (violet)

| Réglage | Valeur |
|---|---|
| Tempo | 88 BPM. Temps = 682 ms, mesure = 2,727 s, boucle = 21,8 s |
| Tonalité | fa mineur |
| Swing | doubles, r = 0,58 (DA) |
| Humanisation | ±8 ms ; **caisse claire en retard de +12 ms** (le temps paresseux ; la DA retarde son saut visuel de 40 ms, à garder) |
| Grille (4 mesures × 2) | Fm9 · Fm9 · D♭maj9 · C7(♯9) ; à la 2e passe, mesure 8 en C7(♭9) |

Voicings du clavier :

| Accord | Notes | MIDI |
|---|---|---|
| Fm9 | la♭ 3, do 4, mi♭ 4, sol 4 | 56 60 63 67 |
| D♭maj9 | fa 3, la♭ 3, do 4, mi♭ 4 | 53 56 60 63 |
| C7(♯9) | mi 3, sol 3, si♭ 3, ré♯ 4 | 52 55 58 63 |
| C7(♭9) | mi 3, sol 3, si♭ 3, ré♭ 4 | 52 55 58 61 |

Instruments :
- **Rhodes simulé** (aucun vrai Rhodes libre hors NC) : `PolySynth(FMSynth)`, harmonicité 3, index 2,5, porteuse et modulante sinus, enveloppe 2 ms / 1,6 s / 0,25 / 0,9 s, enveloppe de modulation 2 ms / 0,35 s / 0,08 / 0,5 s (l'attaque « tine » s'éteint vite), `maxPolyphony` 8 → `Tremolo` (4,2 Hz, profondeur 0,35, spread 120, `.start()` : panoramique de Rhodes Suitcase) → `Chorus` léger.
  Option CC0 : `ElectricPiano(ctx, { instrument: "TX81Z" })` (piano FM du VCSL).
  Rythme, une cellule par mesure : K1 = pas 0 (6 pas) + 7 (court) + 10 (5 pas) ; K2 = pas 0 (14 pas) ; K3 = pas 2s (4 pas) + 10 (6 pas). Vélocité 0,55–0,7.
- **Chaîne « sample »** sur le clavier : `Vibrato` 0,55 Hz profondeur 0,06 (pleurage de bande) → passe-bas 3,4 kHz −12 → passe-haut 90 Hz → `Distortion` 0,08 (saturation de bande).
- **Vinyle** : souffle `Noise('pink')` → passe-haut 3 kHz à −48 dB ; craquements = `NoiseSynth` (attaque 0, déclin 4 ms) tirés au hasard, environ 12 par seconde, vélocité 0,05–0,3, à −34 dB.
- **Grosse caisse lourde** : `MembraneSynth` sinus **accordée sur fa 1** (43,7 Hz), pitchDecay 0,05, 4,5 octaves, déclin 0,55 s + clic → `Distortion` 0,35 → passe-bas 5 kHz. Mesure A : pas 0, 7 (vél. 0,6), 10. Mesure B : pas 0, 3 (vél. 0,5, probabilité 0,5), 10, 14 (probabilité 0,4).
- **Caisse claire** : VCSL Snare Modern 1 touche 61, vélocité 112–120, + VCSL Claps touche 61 (clap seul) à −8 dB + `NoiseSynth` (passe-bande 1,8 kHz, déclin 0,16 s). Pas 4 et 12. Fantômes : touche 60 (sans timbre), vélocité 60 (seconde instance `[55, 83]`, voir 1.8), pas 7s ou 15s, probabilité 0,35.
- **Charleston** : VCSL Hi-Hat touche 42, croches, vélocités 100 / 60 ; double au pas 15s (0,3) ; ouvert (46) au pas 14 de la mesure 4.
- **Contrebasse** : Smolken `"Pizzicato"` (buffers partagés avec le jazz) → passe-bas 700 Hz, + `Synth` sinus une octave dessous à −12 dB (le poids sub). Elle suit la grosse caisse : pas 0 fondamentale (6 pas), pas 7 septième (2 pas), pas 10 fondamentale (4 pas). Fondamentales fa 1 (29), ré♭ 2 (37), do 2 (36).
- **Option vibraphone** : `Mallet(ctx, { instrument: "Vibraphone - Soft Mallets" })` (VCSL, CC0), motif do 5, mi♭ 5, sol 5, la♭ 5 au pas 8 des mesures 2 et 4, probabilité 0,5.

Mixage (dB) : grosse caisse −3 · caisse claire −6 · clap −14 · bruit de caisse −14 · charleston −17 · clavier −11 · contrebasse −6 · sub −12 · vibraphone −18 · souffle −48 · craquements −34.
Effets : `Reverb` courte 0,7 s, envoi caisse claire −12, clavier −16 ; `Compressor` de bus batterie (seuil −18, ratio 4, attaque 10 ms : le « punch » MPC).

Événements : `kick` (hochement de tête de la DA), `snare` (à l'heure **entendue**, retard compris), `hat`, `chord`, `bass`, `crackle` (pour la « poussière de vinyle », sans précision exigée).

### 2.6 Contact · soul / funk (orange chaud)

| Réglage | Valeur |
|---|---|
| Tempo | 104 BPM. Mesure = 2,308 s, boucle = 18,5 s |
| Tonalité | mi dorien |
| Swing | doubles, r = 0,54 (le « 0,15 » de la DA en convention Tone) |
| Humanisation | ±4 ms (le funk est serré) |
| Grille (8 mesures) | Em9 · Em9 · A13 · A13 · Em9 · A13 · Cmaj9 · B7(♯9) |

Voicings :

| Accord | Clavier (MIDI) | Cuivres (3 voix, MIDI) |
|---|---|---|
| Em9 | ré 4, fa♯ 4, sol 4, si 4 (62 66 67 71) | sol 4, si 4, mi 5 (67 71 76) |
| A13 | do♯ 4, fa♯ 4, sol 4, si 4 (61 66 67 71) | mi 4, la 4, do♯ 5 (64 69 73) |
| Cmaj9 | si 3, ré 4, mi 4, sol 4 (59 62 64 67) | mi 4, sol 4, si 4 (64 67 71) |
| B7(♯9) | ré♯ 4, la 4, ré 5 (63 69 74) | ré♯ 4, fa♯ 4, la 4 (63 66 69) |

Instruments :
- **Guitare funk** (pan +0,45) :
  - grattés étouffés (« chicka ») : `NoiseSynth` blanc 1 ms / 30 ms → passe-bande 2,4 kHz Q 1,5, + trois `PluckSynth` sur l'accord avec `resonance` 0,7 (note à peine audible) ;
  - accords secs : trois `PluckSynth` (`resonance` 0,95, `dampening` 5 000, `attackNoise` 1,5) sur les trois notes du haut du voicing clavier ;
  - chaîne : `AutoWah` (base 350 Hz, 4 octaves, sensibilité −30 dB, Q 3) → `Chorus` léger → `Compressor` (ratio 3) ;
  - rythme par mesure : accords aux pas 2, 7s, 10, 15s ; grattés aux pas 0, 1s, 4, 5s, 8, 9s, 12, 13s ; silence ailleurs. Variation : 2 grattés tirés au hasard deviennent des silences (probabilité 0,3 chacun).
- **Basse slap** (synthèse) : `MonoSynth` carré, passe-bas −24 Q 4, enveloppe de filtre 1 ms / 90 ms / 0,15, base 160 Hz, 4,2 octaves ; amplitude 1 ms / 0,25 s / 0,45 / 0,05 → `Compressor` ratio 4. Couche « pop » pour les notes tirées : `Synth` triangle → passe-haut 800 Hz.
  Motif sur Em (transposé sur la, do, si) : pas 0 mi 1 pouce (2 pas) · 3s note morte (30 ms, vél. 0,35) · 4 mi 2 pop · 6 mi 1 · 7s sol 1 · 8 la 1 (2 pas) · 10 mi 2 pop · 11s morte · 12 ré 2 · 13s si 1 · 14 mi 2 pop · 15s morte. Accent sur le pas 0 de chaque mesure (« the one », DA).
- **Cuivres** : trois `MonoSynth` (trompette, alto, ténor), chacun `fatsawtooth` (count 3, spread 16), passe-bas −24, enveloppe de filtre 40 ms / 0,25 s / 0,6, base 500 Hz, 2,8 octaves ; amplitude 30 ms / 0,2 s / 0,75 / 0,15 s → `Vibrato` (5 Hz, profondeur 0,08). Trois synthés séparés plutôt qu'un `PolySynth`, parce que chacun a un signal `detune` pour les **chutes** : `detune` 0 → −300 cents en 180 ms en fin de note.
  Riff, mesures 2, 4 et 8 : stabs aux pas 10 et 12 (1 pas), puis note longue au pas 14s (4 pas) qui anticipe l'accord suivant, avec chute à la fin.
  Option CC0 : VCSL `"Aerophones/Reed Aerophones/Tenor Saxophone - Staccato"` (via `Versilian`) doublant la voix grave des cuivres, à −17 dB : le souffle réel rend la section crédible.
- **Clavier** : même `PolySynth(FMSynth)` que le boom bap, plus brillant (index 3,2), sans pleurage ; accords longs aux pas 4 et 12 (3 pas). Option CC0 : `Versilian` `"Electrophones/TX81Z - Clavisynth"` pour un clavinet en doubles.
- **Batterie** :
  - grosse caisse : `MembraneSynth`, ré 2 (73 Hz), 3,5 octaves, déclin 0,28 s ; pas 0, 7s, 10 (variante : 0, 3s, 10) ;
  - caisse claire : VCSL Snare Modern 1 touche 61, pas 4 et 12, vélocité 110 ; fantômes touche 60 (vélocité 55–60, seconde instance `[55, 83]`) aux pas 6, 9s, 15s (probabilités 0,6 / 0,4 / 0,5) ;
  - charleston : VCSL touche 42, doubles, croches à 85, doubles à 55 ; ouvert (46) au pas 14, probabilité 0,5 ;
  - tambourin : VCSL `"Idiophones/Struck Idiophones/Tambourine 1"` touche 60 aux pas 4 et 12 ; secoué (62) en doubles, probabilité 0,25, mesures 5 à 8.
  Les motifs sont écrits pour ce projet ; aucun break connu n'est recopié.

Mixage (dB) : grosse caisse −5 · caisse claire −7 · fantômes −20 · charleston −19 · tambourin −18 · basse −6 · pop −12 · accords de guitare −12 · grattés −20 · clavier −15 · cuivres −11 · sax −17.
Effets : `Reverb` (plaque) 1,8 s, preDelay 20 ms, envois cuivres −10, clavier −16, caisse claire −14 ; `Compressor` de bus (seuil −18, ratio 2).

Événements : `kick`, `snare`, `hat`, `bass` (le ressort de la DA), `chord`, `stab` (cuivres), `bar` (le « one »).

### 2.7 Version mobile allégée

- `latencyHint: 'playback'`, `Tone.Context` `lookAhead` 0,15 s.
- Une seule guitare rock (au centre, pas de double prise), `oversample: '2x'`.
- Pas de nappe en `fat*` : oscillateur simple. `maxPolyphony` 6 partout.
- Réverbes : decay 3 s maximum (ambient compris).
- Une seule couche de vélocité par banque VCSL (`velocityRange: [84, 106]`, toutes les vélocités jouées bornées à 84–106, fantômes supprimés), piano limité à 10 notes par genre, options (vibraphone, sax, clavinet, TX81Z) désactivées.
- Pas de montée (riser) ; le scratch reste.

---

## 3. Signaux pour la nappe

Deux sources complémentaires : **les événements exacts du séquenceur** (on sait quand et quoi, à la milliseconde) et **l'analyse du son réel** (critère 3 de la fiche : la nappe réagit au son mesuré, pas simulé).

### 3.1 Analyse

- Un `AnalyserNode` natif sur le master (point de branchement en 1.3), `fftSize` 2048 (1 024 cases ; une case = 23,4 Hz à 48 kHz, 21,5 Hz à 44,1 kHz), `smoothingTimeConstant` 0 : le lissage est fait par nos suiveurs d'enveloppe.
- Lecture une fois par image dans des `Float32Array` réutilisés : `getFloatFrequencyData` (dB) et `getFloatTimeDomainData` (pour le RMS).
- Bandes, suiveurs, normalisation et détection d'attaques : **exactement ceux de DA 2.3** (basses 30–160 Hz, bas-médiums 160–600, médiums 600–2 500, aigus 2 500–11 000 ; dB bornés −90 à −20, gain auto par bande ; attaques par flux spectral > 1,5 × médiane sur 43 images + 0,02, 90 ms minimum). Côté audio, on fournit les indices de cases calculés une fois depuis `ctx.sampleRate` : `case(f) = round(f × fftSize / sampleRate)`.
- Les basses 30–160 Hz ne couvrent que 5 à 6 cases : on somme les **puissances** (`10^(dB/10)`), pas les dB.
- Suiveur d'enveloppe : `y += (x − y) × (1 − exp(−dt / τ))`, τ = montée si x > y, descente sinon (valeurs de la DA). `dt` réel de l'image, pour rester juste à 60 ou 120 i/s.
- En pause : on ne lit plus l'analyseur (un contexte suspendu renvoie la dernière trame figée) ; `frame()` renvoie des bandes à 0.

### 3.2 Bus d'événements

Chaque fois qu'une partition programme une note qui compte pour l'image, elle pousse un événement dans une file :

```js
// audio/events.js
// { type, genre, time, vel, notes?, root?, pas, mesure, extra? }
// type : 'kick' | 'snare' | 'hat' | 'crash' | 'bass' | 'chord' | 'stab' | 'note'
//      | 'beat' | 'bar' | 'drop' | 'riser' | 'fill' | 'crackle' | 'genre'
// time : heure audio programmée (secondes, ctx.currentTime), swing et humanisation compris
// vel  : 0..1 ; notes : MIDI ; root : fondamentale MIDI (chord, bass)
export const audioEvents = { on(type, fn), off(type, fn) };   // '*' pour tout recevoir
```

- Les événements arrivent environ 100 ms en avance (le `lookAhead`). Ils attendent dans une file triée par `time`.
- À chaque image (`gsap.ticker`, une seule boucle pour tout le site), on calcule **l'heure entendue** :

```js
function heureEntendue() {
  if (ctx.getOutputTimestamp) {
    const ts = ctx.getOutputTimestamp();      // ce qui sort des haut-parleurs à performance.now() = ts.performanceTime
    return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
  }
  return ctx.currentTime - (ctx.outputLatency || 0) - ctx.baseLatency;
}
```

  puis on émet tous les événements dont `time ≤ heureEntendue() + 0,008` (une demi-image d'avance, l'œil tolère mieux l'avance que le retard). La DA demande un retard de `min(outputLatency, 0,06)` sur les impulsions de l'analyse : cette fonction donne la même correction, mesurée plutôt que plafonnée.
- Événements plus vieux que 250 ms (onglet caché, saccade) : jetés sans être émis.
- Plafond : au plus 8 événements du même type par image (les craquements, par exemple).
- Événement `genre` : `{ de, vers, t0, duree, via }`, émis à la décision (pas à l'heure entendue), pour que l'image démarre sa transition en même temps que le son (DA 3.3, f0). `drop` est émis à t0 + 1,0 s, à l'heure entendue.
- Les impulsions de l'image viennent des événements ; l'analyse donne l'énergie continue et un filet de sécurité (si un instrument est en repli synthé, il produit quand même ses événements).

### 3.3 État par image

`audio.frame(dt)` remplit et renvoie **toujours le même objet** (aucune allocation par image) :

```js
{
  bands: { basses, basMediums, mediums, aigus },  // 0..1, lissées et normalisées (DA 2.3)
  attaques: { basses, basMediums, mediums, aigus }, // force 0..1 cette image, sinon 0
  rms,                    // 0..1
  genre, genreSuivant,    // ids, genreSuivant null hors transition
  fondu,                  // 0..1, progression de la transition en cours
  bpm, phaseTemps, phaseMesure,   // 0..1 à l'heure entendue, horloge du genre actif
  enLecture, muet, volume
}
```

`phaseTemps` et `phaseMesure` viennent de l'horloge du genre (`(heureEntendue − t0Genre) / dureeTemps mod 1`) : la caméra peut se caler dessus (DA 2.4), sans dériver.

---

## 4. Contrôles

| Contrôle | Comportement audio |
|---|---|
| Volume | Curseur 0..1 → `gainUtilisateur` = v² (courbe perçue), `setTargetAtTime(v², t, 0,015)` (≈ rampe de 50 ms, DA 5.4). Valeur gardée en `localStorage` (lecture et écriture dans un `try/catch`), 0,8 par défaut. |
| Couper (`M`) | `gainUtilisateur` → 0 en ≈ 80 ms, le volume choisi est conservé pour le rétablissement. La musique et l'analyse continuent (la nappe bouge toujours). « Entrer sans le son » = démarrer avec ce mode actif. |
| Pause (`Espace`) | `gainPause` → 0 en 300 ms (DA) ; à t + 0,3 s : `clock.pause()` de chaque genre actif, `releaseAll()` des PolySynth, `stop()` des instruments smplr, `triggerRelease` des drones ; à t + 0,6 s (queues de réverbe muettes) : `ctx.suspend()` (plus aucun calcul audio). |
| Reprise | `ctx.resume()` (dans le geste), horloge du genre actif relancée à `now + 0,1` **au début d'une mesure** (le compteur de mesures continue, la boucle ne repart pas de zéro), drones relancés, `gainPause` → 1 en 300 ms. Si le genre a changé pendant la pause, c'est le nouveau qui démarre, sans fondu. |
| Platine | `allerA(genre, { via: 'platine' })` (1.7) : scratch long, fondu de 2,4 s. |

**Onglet caché** (`visibilitychange`, DA 5.4 : « rendu suspendu, son conservé ») :
- Le son continue. On porte le `lookAhead` du contexte Tone à 0,3 s pendant que l'onglet est caché (aucune image à synchroniser, plus de marge si la page est ralentie), et on le remet à 0,1 s au retour.
- Au retour : la file d'événements est vidée des événements périmés (règle des 250 ms), les suiveurs d'enveloppe repartent de 0.
- Si l'utilisateur veut que le site se taise en arrière-plan, c'est la pause. (Choix à confirmer : un site qui continue de jouer dans un onglet caché peut surprendre.)

**Contexte interrompu** : `ctx.onstatechange`. Si l'état devient `suspended` ou `interrupted` (appel entrant sur iOS, autre application audio) alors qu'on n'est pas en pause, le lecteur affiche l'état pause et la reprise demande un geste. `pagehide` : pause propre (retour du cache de navigation arrière : on reprend sur un geste).

**iOS, bouton silencieux** : Safari peut couper le Web Audio quand l'iPhone est en mode silencieux. `navigator.audioSession.type = 'playback'` (si la propriété existe) est censé l'éviter : **non vérifié** ici, à tester sur un appareil.

**`prefers-reduced-motion`** : aucun effet sur la musique (la DA garde la réaction au son). On retire seulement les deux sons qui accompagnent un mouvement : le scratch devient un simple fondu, la montée de transition est supprimée. Le fondu de 2 s reste.

---

## 5. Ordre de mise en œuvre conseillé

1. Contexte partagé, graphe master, analyseur, `frame()` ; ambient en synthés seuls (jouable sans réseau).
2. Bus d'événements et `heureEntendue()` ; brancher la nappe dessus.
3. Fondus, filtres DJ, scratch ; deuxième genre en synthés (house : il ne dépend que de la grosse caisse synthétique pour être reconnaissable).
4. File de chargement smplr, rôles avec repli ; jazz complet (le plus exigeant en samples).
5. Rock (guitare), boom bap, soul.
6. Contrôles, onglet caché, contexte interrompu, mobile allégé.
7. Écoute de contrôle : mêmes niveaux perçus d'un genre à l'autre, pas de clic aux transitions, pas de note collée après une pause.

## 6. Points ouverts

- Durée réelle du fichier `susCymb1_cresc_4s` (calage de la montée house).
- Octave réelle des samples Smolken dans smplr (vérifier à l'oreille).
- Poids réel de la contrebasse (variantes multiples) : rester sous 4 Mo pour le jazz, sinon réduire à une variante par note (`Sampler` en mode `buffers` avec des URL choisies).
- `navigator.audioSession` sur iOS : non vérifié.
- Son conservé quand l'onglet est caché : décision de la DA, à confirmer avec l'utilisateur.
