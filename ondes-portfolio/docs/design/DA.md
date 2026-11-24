# Direction artistique : Portfolio ondes

Version 1 · 2026-11-22 · Applique `docs/FICHE.md` (validée) et la section « Application au projet » de `docs/research/01-librairies-premium.md`.
Public visé : le développeur de la maquette (`maquette/index.html`), puis du portage Astro. Toutes les valeurs sont des valeurs de départ, réglables à l'œil, mais **on part de celles-ci**.

Conventions :
- Unités monde Three.js = « u ». Temps en secondes (s) ou millisecondes (ms). Images = frames à 60 i/s (f0 à f120 = 2 s).
- Couleurs données en hex sRGB et en OKLCH (calculés). Les interpolations se font en OKLCH (voir §3).
- « Genre » = une des 6 ambiances. Clés de code : `ambient`, `jazz`, `house`, `rock`, `boombap`, `soul`.
- Compétences = hip-hop boom bap reste une **hypothèse à confirmer** (fiche §4). Tout ce qui est propre au boom bap est isolé dans la clé `boombap` pour pouvoir être remplacé.

---

## 1. Concept et fil narratif

**Titre de travail : « La traversée ».** On arrive dans le noir complet. Un clic, une goutte tombe : une onde naît au centre, s'élargit, et en passant elle allume un océan de lignes. La caméra, d'abord au-dessus de la goutte, recule et descend jusqu'au ras de l'eau : on découvre un horizon. À partir de là, on ne quitte plus cet océan. Chaque section est une zone de l'océan où la musique change ; la nappe nous porte de l'une à l'autre, elle ne disparaît jamais.

Trois règles qui tiennent tout le site :
1. **Une seule surface, jamais coupée.** Pas de changement de scène, pas d'écran de chargement entre genres. La nappe change de couleur, de forme, de rythme et la caméra change de point de vue, mais c'est la même mer.
2. **Le son commande, l'image obéit.** Toute variation forte de la nappe vient de l'analyse du son réel (fiche, critère 3). Les animations « décoratives » (dérive de caméra, respiration lente) restent faibles, pour que l'œil attribue le mouvement à la musique.
3. **Le texte flotte au-dessus, la mer travaille en dessous.** La caméra cadre toujours l'horizon dans la moitié haute de l'écran ; le ciel noir reçoit le texte. Aucun panneau, aucune carte, aucun flou d'arrière-plan.

Lecture d'ensemble (scroll de haut en bas) : la nuit calme (ambient) → le club feutré (jazz, or) → la piste qui accélère (house, vert acide) → la tempête (rock, rouge) → le retour au groove lourd (boom bap, violet) → la chaleur de fin de soirée (soul/funk, orange). Courbe d'énergie : 2 → 4 → 7 → 9 → 6 → 5 sur 10. Le pic est au milieu (Expériences), la fin redescend pour laisser lire le contact.

---

## 2. La nappe : socle commun puis réglages par genre

### 2.1 Géométrie (fixe, ne change jamais pendant la visite)

| Réglage | Ordinateur | Mobile |
|---|---|---|
| Lignes allouées | 160 | 64 |
| Points par ligne | 512 | 256 |
| Étendue X | −14 à +14 u (28 u) | −10 à +10 u |
| Étendue Z (profondeur) | +4 à −44 u (48 u) | +4 à −34 u |
| Écart entre lignes | 0,30 u | 0,59 u |
| Objets dessinés | 1 seul maillage (toutes les lignes dans un `BufferGeometry` indexé) | idem |

- Chaque ligne suit l'axe X ; les lignes sont empilées en Z. C'est un **ruban** (ShaderMaterial maison, choix de la recherche) : chaque point est doublé en 2 sommets, écartés dans le vertex shader **en pixels écran** (épaisseur indépendante de la distance), avec bord adouci dans le fragment shader (`fwidth` sur la coordonnée transverse). Pas de MSAA.
- Mélange `AdditiveBlending`, `depthWrite: false`, `transparent: true`.
- La nappe ne se déplace pas : c'est le **motif** qui défile (uniforme `uTravel`, ajouté à z dans les fonctions d'onde). On a l'impression d'avancer sur une mer infinie.
- **Lignes actives** : on ne change pas le nombre de lignes dessinées, on en éteint. Chaque ligne i a un rang `r_i = radicalInverseBase2(i)` (suite de van der Corput) ; elle est visible avec un poids `smoothstep(f + 0.03, f − 0.03, r_i)` où `f = actives / 160`. Tout sous-ensemble reste réparti régulièrement, et le passage de 160 à 96 lignes se fait en douceur pendant une transition.

### 2.2 Fonction de hauteur (même formule pour tous les genres)

Pour un point p = (x, z) et z' = z + uTravel :

```
houle(p)   = Σ_k a_k · sin( 2π · dot(D_k, (x, z')) / λ_k − 2π · v_k · t )   (k = 1..3)
             λ_1 = λ, λ_2 = 0.53 λ, λ_3 = 0.29 λ ; a = (1, 0.45, 0.2)
             D_k = directions unitaires, angles par genre (table 2.4)
bruit(p)   = fbm3(simplex, (x, z', 0.08 t) · 0.35 / λ), 3 octaves, gain 0.5
spectre(p) = H(ligne de temps de la ligne, fréquence de |x|)   (voir 2.3)
y          = bord(x) · [ A_eff · (houle + T · bruit) ] + S · spectre + Σ ondes ponctuelles
bord(x)    = smoothstep(14, 9, |x|)  (les bords restent calmes, pas de coupure nette)
A_eff      = A · (1 + kB · basses)
```

Puis une **mise en forme** propre au genre (table 2.4) : aucune, crêtes pointues, paliers, ressort.

**Ondes ponctuelles** (anneaux) : tableau uniforme de 16 anneaux `vec4(x0, z0, t0, force)`, réutilisés en tourniquet.
`anneau = force · exp(−dec · âge) · sin(2π (d − c · âge) / λr) · fenêtre(d − c · âge, largeur 1,2 u)`, avec d = distance au centre de l'anneau. Valeurs c, λr, dec par genre (table 2.4).

**Luminosité et couleur** (fragment) :
```
crête = smoothstep(0, A_eff, y)
I     = base + 1.1 · crête + kM · médiums + scint · bruitHash(i, x, t·aigus)
couleur = I < 0.6 : mix(lueur, ligne, I / 0.6)
          I ≥ 0.6 : mix(ligne, accent, smoothstep(0.6, 1.4, I))
sortie  = couleur · I · 2.4 (HDR ; ce qui dépasse ~1 alimente le bloom)
        · poidsLigneActive · fonduProfondeur · fonduProche
fonduProfondeur = 1 − smoothstep(zDébut, zFin, distance caméra)   (vers la teinte lueur × 0.25)
fonduProche     = smoothstep(0.8, 2.5, distance caméra)
```
Le fondu en profondeur est **obligatoire** (la recherche le signale : sans lui, le mélange additif sature à l'horizon).

### 2.3 Brancher le son sur la nappe

Analyse : un seul `AnalyserNode` (ou `Tone.Analyser('fft', 2048)`), branché **avant** le volume général, pour que la nappe continue de réagir quand l'utilisateur baisse ou coupe le son (le son est toujours joué et mesuré, seul ce qu'on entend change). À 48 kHz, une case de FFT = 23,4 Hz.

| Bande | Fréquences | Suiveur d'enveloppe (montée / descente) | Rôle général |
|---|---|---|---|
| Basses | 30–160 Hz | 15 ms / 240 ms | amplitude globale, bascule de caméra |
| Bas-médiums | 160–600 Hz | 15 ms / 180 ms | longueur d'onde, épaisseur |
| Médiums | 600–2 500 Hz | 12 ms / 120 ms | brillance des crêtes |
| Aigus | 2 500–11 000 Hz | 10 ms / 70 ms | scintillement (points qui clignotent) |
| Attaques | flux spectral positif par bande | impulsion | anneaux, secousses, flash du bloom |

- Normalisation : dB bornés −90 à −20, puis gain auto par bande (maximum glissant qui décroît de 0,5 % par image, plancher 0,15). Chaque bande sort une valeur 0 à 1.
- Attaque détectée si flux > 1,5 × médiane des 43 dernières images + 0,02, avec 90 ms minimum entre deux attaques de la même bande. Force = flux normalisé, 0 à 1.
- **Décalage** : l'analyseur voit le signal avant la sortie physique. Retarder les impulsions visuelles de `min(audioContext.outputLatency, 0.06)` s (tampon circulaire de 4 images), sinon l'image arrive avant le son.
- **Spectre gravé dans la nappe** (`S`, effet « Unknown Pleasures en 3D ») : texture d'historique 256 × 64 (256 cases log de 40 Hz à 12 kHz, 64 lignes de temps à 30 Hz = 2,1 s). La « ligne de présent » est à z = −6 u : elle lit la ligne de temps la plus récente ; plus on va vers l'horizon, plus la ligne lit un instant ancien. Le spectre naît donc au milieu de l'écran et part vers l'horizon. En X, |x| = 0 → 40 Hz, |x| = 14 → 12 kHz (échelle log, symétrique) : les basses font une montagne au centre, les aigus frémissent sur les bords. Devant la ligne de présent (z > −6), on lit la ligne la plus récente atténuée par `smoothstep(4, −6, z)`.

Origine des anneaux selon la bande qui a déclenché l'attaque :
- basses : (0, −14), loin au centre, anneau large ;
- bas-médiums et médiums : x tiré dans [−6, 6], z dans [−12, −4] ;
- aigus : pas d'anneau, seulement le scintillement.

### 2.4 Les six genres

Tempos de référence (à aligner avec la partition ; la caméra s'y cale) : ambient 64 (sans batterie) · jazz 96, swing 0,6 · house 124 · rock 136 · boom bap 88, swing 0,58 (paresseux) · soul/funk 104, doubles-croches légèrement swinguées (0,15).

#### Palettes

| Genre | Fond | Ligne principale | Accent (crêtes, titres) | Lueur (creux, horizon) |
|---|---|---|---|---|
| Accueil · ambient « Abysse » | `#030507` oklch(11.2% 0.009 242) | `#7FA8C9` oklch(71.4% 0.066 243) | `#E6F2FA` oklch(95.5% 0.017 237) | `#1D4466` oklch(37.6% 0.073 248) |
| Présentation · jazz « Or de club » | `#080603` oklch(12.4% 0.011 84) | `#E0A93F` oklch(76.8% 0.135 80) | `#FFF0C9` oklch(95.7% 0.053 89) | `#7A4A0E` oklch(45.5% 0.095 65) |
| Projets · house « Acide » | `#020602` oklch(11.2% 0.020 144) | `#B4FF1F` oklch(91.6% 0.235 128) | `#F3FFD1` oklch(98.0% 0.061 119) | `#2A6B00` oklch(46.7% 0.143 138) |
| Expériences · rock « Lampe rouge » | `#090202` oklch(10.4% 0.021 21) | `#FF2D1A` oklch(64.3% 0.243 30) | `#FFD9C9` oklch(91.3% 0.048 44) | `#6E0904` oklch(34.4% 0.133 30) |
| Compétences · boom bap « Vinyle violet » | `#06030B` oklch(11.1% 0.025 304) | `#9F72FF` oklch(66.3% 0.201 295) | `#F2E6CF` oklch(92.8% 0.033 84) | `#3E2385` oklch(35.6% 0.153 289) |
| Contact · soul/funk « Ambre » | `#0A0502` oklch(12.2% 0.016 64) | `#FF8A26` oklch(74.8% 0.174 55) | `#FFE2B3` oklch(92.5% 0.069 80) | `#8E3208` oklch(44.6% 0.134 40) |

- Contraste de l'accent sur le fond : 15,7 à 19,5 pour 1. Texte courant (toutes sections) : `#EDE8DF` à 100 % pour les paragraphes, 64 % pour les légendes. Titres en couleur accent.
- Le violet du boom bap est un violet **saturé et plat**, accompagné d'un crème « pochette de disque » (`#F2E6CF`). Jamais de dégradé violet vers rose ou bleu.
- Le fond est une couleur unie (`renderer.setClearColor` et `body`), interpolée pendant les transitions. Pas de dégradé de ciel. La seule « brume » est le fondu en profondeur vers lueur × 0,25.

#### Paramètres de nappe (ordinateur)

| Paramètre | ambient | jazz | house | rock | boombap | soul |
|---|---|---|---|---|---|---|
| Lignes actives / 160 | 160 | 128 | 160 | 96 | 80 | 128 |
| Amplitude A (u) | 0,55 | 0,70 | 0,45 | 1,10 | 0,80 | 0,75 |
| Longueur d'onde λ (u) | 14 | 6,5 | 3,2 | 2,4 | 5,0 | 4,2 |
| Fréquence de houle v (Hz) | 0,05 | 0,12 | 0,26 (≈ 1 cycle / 2 mesures) | 0,35 | 0,18 | 0,21 |
| Angles des 3 houles (°) | 0 / 20 / −15 | 35 / −35 / 80 (houles croisées) | 0 / 90 / 0 (grille) | 10 / −40 / 70 | 0 / 0 / 45 | 15 / −25 / 60 |
| Défilement uTravel (u/s) | 0,35 | 0,60 | 2,20 | 3,00 | 0,90 | 1,20 |
| Turbulence T | 0,08 | 0,18 | 0,05 | 0,55 | 0,22 | 0,15 |
| Spectre gravé S (u) | 0,15 | 0,35 | 0,25 | 0,50 | 0,60 | 0,40 |
| Épaisseur au premier plan (px CSS) | 1,1 | 1,6 | 1,8 | 2,2 | 1,5 | 1,7 |
| Épaisseur à l'horizon | × 0,45 | × 0,45 | × 0,50 | × 0,55 | × 0,45 | × 0,45 |
| Luminosité de base | 0,35 | 0,40 | 0,30 | 0,32 | 0,38 | 0,42 |
| Fondu en profondeur (début → fin, u) | 6 → 40 | 8 → 38 | 10 → 44 | 4 → 30 | 6 → 34 | 7 → 38 |
| Mise en forme | aucune | aucune | aucune | crêtes : `sign(y)·|y|^0.7·1.15` | paliers : `floor(y·10)/10` (mélange 0,6) + échantillon-bloqueur tous les 6 points en X | ressort (voir réactions) |
| Bloom : intensité / rayon / seuil | 1,5 / 0,80 / 0,55 | 1,8 / 0,75 / 0,50 | 2,0 / 0,60 / 0,45 | 2,5 / 0,85 / 0,40 | 1,5 / 0,55 / 0,60 | 2,0 / 0,90 / 0,50 |
| Grain (opacité) | 0,06 | 0,08 | 0,05 | 0,10 | 0,16 | 0,09 |

#### Comment le son module chaque genre

Coefficients : kB (basses → amplitude), kL (bas-médiums → λ, en %), kM (médiums → brillance), scint (aigus → scintillement), anneaux (c vitesse u/s · λr u · dec 1/s).

| Genre | Basses | Bas-médiums | Médiums | Aigus | Attaques |
|---|---|---|---|---|---|
| ambient | kB 0,6 : la mer respire avec la nappe grave | λ −8 % | kM 0,3 | scint 0,10, lent (hash renouvelé toutes les 120 ms) | rares ; anneau très doux (c 3 · λr 4 · dec 0,4), force × 0,4 |
| jazz | kB 0,9 ; chaque note de contrebasse lance un anneau depuis (0, −14) qui roule vers la caméra | λ −12 % | kM 0,7 : les accords de piano allument les crêtes en or | scint 0,25 (balais, ride) | anneaux c 6 · λr 2,5 · dec 0,9 |
| house | kB 1,4 + « pompe » : à chaque grosse caisse, A × 2,2 puis retour en 220 ms (`expo.out`), comme un sidechain ; anneau concentrique depuis (0, −10) façon membrane de haut-parleur | λ −5 % | kM 0,5 | scint 0,45 calé sur les charlestons (hash renouvelé à chaque attaque d'aigus) | c 14 · λr 1,6 · dec 2,2 |
| rock | kB 1,2 | λ −18 % et épaisseur + 30 % | kM 1,0 (guitares saturées : crêtes blanches) | scint 0,35 | caisse claire = anneau fort (c 18 · λr 1,2 · dec 2,8) + secousse caméra ; cymbale crash = bloom + 0,8 pendant 150 ms |
| boombap | kB 1,1 ; grosse caisse = bosse lourde qui part vers l'horizon (c 4 · λr 6 · dec 0,7) | λ −10 % | kM 0,6 | scint 0,30 + « poussière de vinyle » : 0,3 % des points flashent à l'accent pendant 40 ms, au hasard | caisse claire : la moitié avant (z > −10) saute de + 0,25 u **avec 40 ms de retard** (le temps paresseux) |
| soul | kB 1,0, passée dans un ressort (raideur 180, amortissement 9, dépassement visible) : la basse rebondit | λ −8 % | kM 0,8 (cuivres) | scint 0,20 | une ligne sur deux prend l'accent × 0,7 sur le premier temps de chaque mesure (« the one »), retour en 300 ms ; anneaux c 8 · λr 2 · dec 1,2 |

#### Caméra (pose de repos et mouvement)

Repère : la nappe est centrée en x = 0, la ligne de présent en z = −6. Cadrage visé : bord lointain de la nappe entre 25 % et 46 % de la hauteur d'écran depuis le haut, sauf rock.

| Genre | Position | Regarde | FOV vertical | Mouvement |
|---|---|---|---|---|
| ambient | (0, 2,2, 7,5) | (0, 0,4, −14) | 38° | dérive en Lissajous : x ± 0,6 u (période 31 s), y ± 0,15 u (23 s), roulis ± 0,6° |
| jazz | (−3,2, 1,6, 6,2) | (1,5, 0,2, −10) | 34° | travelling latéral lent : x ± 1,2 u sur 8 mesures ; roulis fixe 2,5° (cadre légèrement penché, comme une photo de club) |
| house | (0, 3,6, 5,5) | (0, 0, −10) | 46° | vue plongeante sur la piste ; à chaque grosse caisse y − 0,08 u et FOV + 1,2°, retour en 180 ms |
| rock | (0, 0,9, 5,5) | (0, 0,8, −12) | 52° | au ras de l'eau, les crêtes passent au-dessus de l'horizon ; secousse par « trauma » : trauma += 0,35 par caisse claire, décroît de 1,6/s, décalage = trauma² × 0,06 u (bruit de Perlin, 18 Hz) |
| boombap | (2,6, 2,0, 6,0) | (−0,8, 0,3, −11) | 36° | hochement de tête : tangage −1,4° sur la grosse caisse, + 0,8° sur la caisse claire, retours en 200 ms (`sine.out`) |
| soul | (−1,5, 2,6, 6,8) | (0, 0,2, −9) | 40° | orbite lente autour du point regardé : azimut ± 9° sur 16 mesures ; légère montée de 0,1 u sur « the one » |

Le scroll ajoute de la vitesse : `uTravel += vitesseLenis × 0.04` (plafond + 4 u/s), et la luminosité de base + 0,1 pendant le défilement rapide. On sent qu'on « pagaye ».

#### Ambiance typographique

Polices : `'Fraunces Variable'` (titres ; fichiers `@fontsource-variable/fraunces/full.css` et `full-italic.css`, axes opsz 9–144, wght 100–900, SOFT 0–100, WONK 0–1) et `'Bricolage Grotesque Variable'` (texte ; `@fontsource-variable/bricolage-grotesque/standard.css`, axes opsz 12–96, wdth 75–100, wght 200–800). Les axes changent avec le genre, et **s'interpolent pendant la transition** (GSAP sur des variables CSS lues par `font-variation-settings`).

| Genre | Titres (Fraunces) | Texte (Bricolage) | Caractère |
|---|---|---|---|
| ambient | romain, wght 250, opsz 144, SOFT 50, WONK 0, interlettrage − 0,02 em | wght 350, wdth 100 | silence, lettres fines et larges |
| jazz | **italique**, wght 380, opsz 144, SOFT 100, WONK 1 | wght 380, wdth 92 | élégance, courbes souples |
| house | romain, wght 820, opsz 96, SOFT 0, interlettrage − 0,04 em | wght 500, wdth 80, capitales pour les étiquettes | machine, serré, net |
| rock | romain, wght 900, opsz 144, SOFT 0, WONK 1 | wght 600, wdth 75 | dense, anguleux, très grand |
| boombap | romain, wght 700, opsz 72, SOFT 30 ; numéros en Bricolage wdth 75 wght 800 | wght 450, wdth 85 | pochette de disque, étiquettes de bacs |
| soul | italique, wght 620, opsz 144, SOFT 100, WONK 1 | wght 420, wdth 100 | rondeur années 70 |

---

## 3. Transitions entre genres

### 3.1 Déclenchement

- Chaque section fait `160svh` de haut (Accueil : `130svh`). Le genre change quand le milieu de l'écran entre dans une section (ScrollTrigger `start: 'top 50%'`, `end: 'bottom 50%'`), avec une hystérésis de 8 % de la hauteur d'écran pour éviter les allers-retours.
- La transition est **en temps, pas au scroll** : elle dure 2,0 s quoi qu'il arrive, parce que le fondu audio est en temps. Le scroll n'accélère que le défilement de la mer.
- Saut par la platine vers un genre non voisin : on ne traverse pas les genres intermédiaires. Durée 2,4 s, « scratch » plus long (voir f0–f12). Lenis `scrollTo(section, { duration: 1.6 })` en parallèle.
- Nouveau déclenchement pendant une transition : on photographie l'état interpolé courant, il devient le nouveau point de départ, on relance à f0 avec un scratch raccourci à 4 images.

### 3.2 Couleurs en espace perceptif

On interpole en **OKLCH** (L et C linéaires, teinte par le plus court arc). Les deux palettes (ancienne A, nouvelle B) sont envoyées au shader sous forme (L, C, h) ; la conversion OKLCH → OKLab → sRGB linéaire se fait dans le shader (une matrice et un cube, coût négligeable). Ainsi le rouge vers le violet passe par un magenta vif, le vert acide vers le rouge passe par l'orange, jamais par un gris boueux.

La couleur ne change pas d'un bloc : **elle voyage avec l'onde de choc**. Mélange par sommet `m = 1 − smoothstep(R − 3, R, d)`, avec R le rayon de l'onde et d la distance au centre de l'onde. À la fin (R > 50 u), m = 1 partout.

### 3.3 Séquence image par image (2,0 s, sens « vers le bas »)

| Images | Temps | Son | Nappe et couleur | Caméra et post-traitement | Texte |
|---|---|---|---|---|---|
| f0 | 0 ms | début du fondu croisé à puissance constante sur 2,0 s ; sur le bus sortant, filtre passe-bas 18 kHz → 400 Hz en 1,2 s ; son de scratch (bruit filtré en passe-bande, balayage 2 kHz → 300 Hz → 1,2 kHz, 250 ms) | — | aberration chromatique : base → 0,0030 en 100 ms | le texte sortant commence à partir |
| f0–f6 | 0–100 ms | scratch | « on attrape le disque » : uTravel passe à − 3 u/s (la mer recule), luminosité + 40 % | — | lignes du texte sortant : y 0 → − 40 %, opacité → 0, stagger 20 ms, `power2.in`, 500 ms au total |
| f6–f18 | 100–300 ms | — | **onde de choc** : anneau né en (0, 0, −9), rayon 0 → 50 u à 18 u/s, hauteur 1,4 u qui décroît, largeur 1,2 u ; l'anneau est dessiné dans l'accent de B. ShockWaveEffect écran optionnel : amplitude 0,04, taille 0,25 | — | — |
| f12–f96 | 200–1 600 ms | — | couleurs A → B portées par l'onde (3.2) ; fond interpolé en `sine.inOut` | — | — |
| f12–f108 | 200–1 800 ms | `Transport.bpm.rampTo(nouveau, 1.0)` à f0 | tous les paramètres numériques de la table 2.4 en `power2.inOut` ; λ interpolé en log ; lignes actives par le masque de rangs ; mise en forme mélangée par un poids 0 → 1 | caméra : courbe Catmull-Rom de la pose A à la pose B par un point milieu relevé de + 2,5 u en y et reculé de + 3 u en z (« on prend de la hauteur pour voir le large ») ; FOV par le même chemin ; roulis qui dépasse de 3° puis revient ; `power3.inOut` de f9 à f117 | — |
| f60 | 1,0 s | croisement à − 3 dB des deux côtés ; **premier temps fort du genre entrant** programmé à t0 + 1,0 s | « drop » : bloom + 0,8 pendant 250 ms | les mouvements propres au nouveau genre (bob, secousse, hochement) montent de 0 à 1 entre f60 et f120 | — |
| f72–f120 | 1,2–2,0 s | sortant à 0 à f120, puis arrêté | — | aberration chromatique : 0,0030 → base | titre entrant : caractères SplitText, y 110 % → 0, opacité 0 → 1, stagger 18 ms, 700 ms, ease du genre (5.2) |
| f120 | 2,0 s | genre entrant seul | état B stable | — | paragraphes entrants (5.2) |

Sens « vers le haut » : même séquence, mais l'onde de choc naît à l'horizon (0, 0, −40) et vient vers la caméra, uTravel du scratch passe à + 3 u/s, et le point milieu de la caméra est abaissé (y + 1 u au lieu de + 2,5 u).

---

## 4. Écran d'entrée et moment « Entrer »

### 4.1 Avant le clic

- Fond `#000000` pur. Le canvas existe déjà mais reste invisible ; pendant ce temps : chargement des polices, compilation des shaders (`renderer.compile`), création du composeur. Les samples ne sont **pas** chargés avant le clic : l'ambient de l'accueil n'utilise que des synthés (ordre d'intégration de la recherche, étape b) ; les banques des autres genres se chargent en arrière-plan après l'entrée, dans l'ordre de la page.
- Au centre, empilés et alignés au centre :
  1. le nom (`content.js`, `presentation.nom`), Fraunces wght 250, opsz 144, 15 px, interlettrage + 0,32 em, capitales, `#EDE8DF` à 56 %.
  2. Un trait horizontal de 1 px, 160 px de large, `#E6F2FA` à 20 % ; il se remplit de gauche à droite (opacité 100 %) selon la progression du chargement. C'est la seule jauge.
  3. Le bouton `Entrer` : Fraunces italique wght 300, 44 px, `#E6F2FA`. Pas de cadre, pas de fond. Au survol : interlettrage 0 → + 0,06 em en 400 ms et le trait s'élargit à 200 px. Inactif (opacité 30 %) tant que le trait n'est pas plein.
  4. En dessous, Bricolage 13 px, `#EDE8DF` à 48 % : `Le son démarre au clic. Casque conseillé.`
  5. Lien secondaire, Bricolage 13 px souligné : `Entrer sans le son` (le site s'ouvre muet ; la musique tourne pour l'analyse, volume 0, réglable ensuite).
- Clavier : le bouton a le focus au chargement ; `Entrée` ou `Espace` valide. Anneau de focus : contour 1 px accent, décalé de 6 px.

### 4.2 La première onde (0 à 3,4 s après le clic)

| Temps | Son | Image |
|---|---|---|
| 0 ms | `await Tone.start()` ; drone grave de l'ambient (do 1 et sol 1) monte de silence à − 12 dB en 2,5 s | lettres de `Entrer` : y 0 → − 100 %, stagger 20 ms, 300 ms, `power3.in` ; nom et phrase : opacité → 0, 250 ms |
| 120 ms | — | le trait se contracte vers son centre (scaleX 1 → 0, 260 ms, `expo.in`) |
| 380 ms | une seule note claire (cloche de synthé, la 5, déclin 4 s) | le point restant devient un disque de 6 px `#E6F2FA` qui flashe (opacité 1 → 0 en 300 ms) ; au même instant le canvas apparaît |
| 380 ms – 2,6 s | — | **la goutte** : un anneau naît en (0, 0, −9), qui se projette exactement sur le point. Rayon 0 → 30 u en 2,2 s (`power2.out`). Les lignes ne s'allument que derrière l'anneau (masque `smoothstep(R, R − 4, d)`) : on voit l'océan apparaître en cercle |
| 300 ms – 3,1 s | — | caméra : départ à la verticale au-dessus de la goutte, position (0, 9, −8,99), regard (0, 0, −9), FOV 50° ; l'anneau se voit comme un cercle parfait. Puis recul et descente jusqu'à la pose ambient (0, 2,2, 7,5), FOV 38°, `power3.inOut`, 2,8 s. On passe de la goutte vue d'en haut à un horizon |
| 2,6 s | la mélodie ambient commence | platine et lecteur apparaissent (opacité 0 → 1, y + 12 px → 0, 600 ms) |
| 3,1 s | — | titre de l'accueil (5.2) |

Critère 1 de la fiche tenu : la nappe est allumée au centre dès 0,4 s et entièrement à 2,6 s.

---

## 5. Mise en page par-dessus la 3D

### 5.1 Grille et échelle

- Grille de 12 colonnes. Ordinateur (≥ 1024 px) : marges 64 px, gouttières 24 px, largeur de référence 1440 px. Tablette (768–1023 px) : 8 colonnes, marges 40 px. Mobile (< 768 px) : 4 colonnes, marges 20 px.
- Le texte est en HTML (lisible, sélectionnable, accessible). troika-three-text ne sert qu'à **un** élément : le nom du genre posé dans la scène, en capitales, à (0, 2,4, −22), taille 3,2 u, interlettrage 0,2, couleur ligne, opacité 0,18 ; il reçoit le bloom et s'éloigne avec le brouillard. Il change pendant la transition (caractères brouillés entre f30 et f90). Absent sur mobile.
- Lisibilité au-dessus des lignes : `text-shadow: 0 0 24px <fond du genre>, 0 0 4px <fond du genre>`. Pas de panneau derrière le texte.
- Échelle :
  - titre de section : `clamp(56px, 8.4vw, 136px)`, interligne 0,92 ;
  - nom d'accueil : `clamp(64px, 11vw, 176px)`, interligne 0,88 ;
  - sous-titre : `clamp(22px, 2vw, 30px)`, interligne 1,2 ;
  - texte : 18 px, interligne 1,55, mesure maximale 60 caractères ;
  - étiquettes : Bricolage wght 600, wdth 80, 12 px, capitales, interlettrage + 0,18 em.
- Chaque section porte une étiquette `0N · Genre · tempo`, par ex. `02 · Jazz · 96 BPM`.
- Contenu : uniquement les textes de `content.js` (à remplacer par les tiens). Pas de téléphone, pas de SIRET, pas de niveaux de compétences marqués « à confirmer » dans la source.

### 5.2 Les six sections

**01 · Accueil (ambient)**
- Nom (`content.js`, presentation.nom) en colonnes 1–9, haut à 20 vh ; phrase d'accroche (`content.js`, presentation.accroche) en colonnes 2–6, 32 px sous le nom.
- En bas à droite (colonnes 10–12) : `Défiler` en étiquette, avec un trait vertical de 40 px dont un segment de 8 px descend en boucle (1,8 s, `sine.inOut`).
- Apparition : caractères du nom y 110 % → 0, stagger 24 ms, 1 100 ms, `expo.out` ; accroche par lignes (SplitText `lines`), stagger 90 ms, opacité et y + 16 px, 900 ms.

**02 · Présentation (jazz)**
- Appel et réponse : titre en colonnes 2–8, haut de section ; bloc de texte en colonnes 8–12, décalé de 18 vh vers le bas. Une citation ou phrase courte tirée du contenu, si elle existe, en Fraunces italique 30 px, colonnes 3–7, sous le titre.
- Apparition : sur le swing. Les lignes du texte arrivent sur les croches swinguées à 96 BPM : intervalles alternés 375 ms et 250 ms, chacune y + 20 px → 0, 800 ms, `power3.out`.

**03 · Projets (house)**
- Une **tracklist**, pas de cartes : une rangée par projet (`content.js`, projets, dans l'ordre). Colonnes : numéro (1–1, Bricolage wdth 75 wght 800, 14 px), titre (2–7, Fraunces 40 px), types (8–10, étiquettes séparées par ` / `), flèche `→` (12). Filet de 1 px ligne à 24 % entre les rangées. Hauteur de rangée 72 px.
- Survol d'une rangée : le filet du dessous devient une petite onde (SVG, 3 périodes, amplitude 4 px) qui défile à la vitesse du tempo ; le titre passe en accent ; un anneau visuel (force 0,4) part dans la nappe à x = position horizontale du curseur ramenée à [−6, 6]. C'est un effet d'interface, pas une réaction au son.
- Apparition : quantifiée à la double-croche de 124 BPM, soit **121 ms** entre deux rangées ; chaque rangée glisse de x − 24 px à 0 en 350 ms, `power4.out`.

**04 · Expériences (rock)**
- Escalier asymétrique : pour chaque entrée (`content.js`, experiences : stage, SAÉ, projets d'école ; le stage en premier), méta (`meta`) en colonnes 1–3, titre en colonnes 3–10 en Fraunces wght 900 jusqu'à 96 px, texte en colonnes 7–12. Chaque entrée décale son titre d'une colonne vers la droite par rapport à la précédente, puis repart à gauche après trois.
- Apparition : **coupes franches, pas de fondu**. Le titre apparaît d'un coup (`steps(1)`) avec un soulignement rouge de 6 px qui flashe 2 images (33 ms) puis disparaît. Le texte : opacité 0 → 1 en 3 paliers (`steps(3)`, 180 ms).

**05 · Compétences (boom bap, hypothèse)**
- Deux colonnes : titre collant (`position: sticky`) en colonnes 1–5 ; à droite, colonnes 6–12, la liste des 6 compétences (`content.js`, competences : libellé court, libellé officiel, définition). Libellé court en Fraunces 56 px, numéro `C1`…`C6` en Bricolage wdth 75 wght 800 dans un rectangle à angles droits de 1 px (étiquette de bac à disques), définition en 16 px.
- Pas de barres de niveau (les niveaux sont « à confirmer » dans la source).
- Apparition : chaque compétence tombe sur un temps à 88 BPM (682 ms) avec un retard paresseux de + 40 ms ; y − 12 px → 0 avec un petit rebond (`back.out(2)`, 300 ms).

**06 · Contact (soul/funk)**
- E-mail en très grand (Fraunces italique, `clamp(40px, 6vw, 96px)`), colonnes 1–12, lien `mailto:`. Dessous, sur une ligne en colonnes 2–10 : GitHub, LinkedIn, ville (`content.js`, presentation.lieu), en Bricolage 20 px, séparés par 40 px.
- Survol de l'e-mail : les lettres rebondissent une à une (y − 10 px, `elastic.out(1, 0.4)`, stagger 15 ms), comme une basse slappée.
- Pied de page, Bricolage 12 px, 64 % : crédits des banques de sons et licences (piano domaine public, contrebasse et percussions CC0, nom de chaque banque) et des polices (OFL).
- Apparition : e-mail par caractères, stagger 22 ms, 900 ms, `elastic.out(1, 0.6)`.

Ease maison commun, déclaré avec CustomEase : `onde` = `M0,0 C0.16,0.84 0.3,1 1,1` (sortie douce et longue, utilisée par défaut).

### 5.3 Menu « platine »

- Position : coin bas droit, marge 32 px. Au repos, un disque de 88 px : 6 sillons concentriques (traits de 1 px, `#EDE8DF` à 18 %), un macaron central de 30 px rempli de la couleur **ligne** du genre en cours, un trou central de 4 px. Le disque tourne à 33⅓ tours/min (200°/s) quand la musique joue ; à la pause, il ralentit jusqu'à l'arrêt en 600 ms (`power2.out`), comme un vrai plateau.
- Un bras de lecture (trait de 1,5 px, 54 px, pivot en haut à droite du disque) indique le genre en cours.
- Survol ou focus : le disque passe à 280 px en 450 ms (`expo.out`). Autour, 6 secteurs de 60°, chacun avec le nom de section et le genre (Bricolage 12 px, capitales), dans la couleur ligne du genre. Le secteur survolé s'allume à 100 %, les autres à 40 %.
- Clic sur un secteur : le bras pivote vers ce secteur (450 ms, `back.out(1.4)`), puis la transition de saut part (3.1).
- Bonus si le temps le permet : glisser le disque à la souris fait un scratch (vitesse angulaire → uTravel et un son de scratch), sans changer de genre.
- Accessibilité : `nav` contenant 6 boutons (nom lisible : « Projets, house »), flèches gauche/droite pour changer de secteur, `Entrée` pour sauter, raccourcis `1` à `6`.

### 5.4 Lecteur

- Coin bas gauche, marge 32 px, sur une ligne, hauteur 40 px :
  1. Pause/lecture : icône dessinée en CSS (deux barres / triangle), 16 px. Touche `Espace` (hors champ de saisie).
  2. Couper le son : touche `M`. Icône d'enceinte barrée.
  3. Volume : **24 barres verticales** de 2 px, espacées de 2 px, dont la hauteur suit l'analyseur en direct ; la part de gauche jusqu'au volume est en accent, le reste à 25 %. Glisser horizontalement règle le volume (rampe 50 ms). `input type="range"` invisible par-dessus pour le clavier et les lecteurs d'écran.
  4. Genre en cours : `Jazz · Présentation · 96 BPM`, Bricolage 12 px capitales ; il change à f60 de la transition avec un défilement vertical de 100 % (300 ms).
- Pause : le Transport s'arrête, le volume général tombe en 300 ms ; la nappe ne gèle pas, elle passe en « respiration » (A × 0,35, uTravel × 0,3, sans réaction audio). Reprise : remontée en 300 ms.
- Onglet caché (`visibilitychange`) : rendu suspendu, son conservé.

### 5.5 Mobile allégé (< 768 px ou `pointer: coarse`)

- Nappe 64 × 256, DPR `min(devicePixelRatio, 1.5)`, lignes actives × 0,6, épaisseur × 1,2 (lisibilité), pas de mise en forme « paliers ».
- Post-traitement : bloom seul (`levels: 5`, intensité × 0,8) + AgX + vignette. Pas d'aberration ni de grain (recherche). Pas de ShockWaveEffect écran (l'anneau dans la nappe reste).
- Caméra : poses de la table 2.4 avec FOV + 8° (écran étroit) et sans secousse ; dérive limitée à 50 %. Pas de texte troika.
- Mise en page : une colonne, titres `clamp(44px, 12vw, 64px)`, texte 16 px. La tracklist garde numéro + titre, les types passent dessous.
- Platine : disque de 56 px centré en bas (marge 16 px + zone de sécurité) ; un toucher ouvre un demi-disque de 6 secteurs de 30° sur toute la largeur. Lecteur réduit à couper/rétablir + nom du genre, en bas à gauche.
- Lenis : défilement tactile natif (`syncTouch: false`). Si une image dépasse 25 ms pendant 2 s, plafond à 30 i/s.

### 5.6 `prefers-reduced-motion: reduce`

- Pas de Lenis (défilement natif), pas de dérive, secousse, hochement ni pompe de caméra : poses fixes par genre.
- Transitions : fondu des couleurs et des paramètres sur 2 s, **sans** onde de choc, scratch visuel, aberration ni recul de caméra (coupe en fondu de 600 ms entre les deux poses).
- Entrée : la goutte devient un fondu d'opacité de 800 ms, caméra déjà à la pose ambient.
- La nappe réagit toujours au son (c'est le propos), mais A × 0,5, uTravel × 0,4, scintillement coupé.
- Texte : opacité seule, 400 ms, pas de déplacement.

**Règle pour tout le monde** (photosensibilité, WCAG 2.3.1) : jamais plus de 3 flashs par seconde. Les flashs du bloom (crash rock, drop) et le soulignement rouge sont limités par un minuteur commun : un flash au plus toutes les 340 ms ; au-delà, on les ignore.

---

## 6. Post-traitement et budget de perf

### 6.1 Chaîne (pmndrs postprocessing 6.39.6)

```
renderer : WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
           toneMapping = NoToneMapping (c'est l'effet qui le fait), outputColorSpace = SRGBColorSpace
composer : new EffectComposer(renderer, { frameBufferType: HalfFloatType, multisampling: 0 })
1. RenderPass(scene, camera)
2. EffectPass(camera, bloom, toneMapping)
     bloom = new BloomEffect({ mipmapBlur: true, levels: 8, intensity, radius, luminanceThreshold, luminanceSmoothing: 0.12 })
             (valeurs par genre table 2.4 ; interpolées pendant les transitions)
     toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.AGX })
3. EffectPass(camera, chroma, vignette, grain)     (ordinateur seulement pour chroma et grain)
     chroma   = new ChromaticAberrationEffect({ offset: new Vector2(0.0006, 0.0003), radialModulation: true, modulationOffset: 0.25 })
                pointes : 0,0030 en transition, 0,0018 pendant 120 ms sur la caisse claire rock
     vignette = new VignetteEffect({ offset: 0.32, darkness: 0.62 })   (ambient : darkness 0.70)
     grain    = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true }), opacité = table 2.4
```

- L'aberration chromatique est un effet de convolution : elle doit rester dans une passe séparée du bloom (une seule convolution par `EffectPass`).
- Le ShockWaveEffect (transition, optionnel) va dans la passe 3, activé seulement de f6 à f30.
- La luminosité se règle par l'intensité des lignes (×2,4 HDR) et le seuil du bloom, pas par l'exposition.

### 6.2 Budget (Mac M5, 60 i/s = 16,6 ms)

| Poste | Budget |
|---|---|
| Analyse audio + envoi des 2 textures (256 et une ligne de 256) | ≤ 1 ms CPU |
| GSAP, Lenis, logique de transition | ≤ 1,5 ms CPU |
| Nappe (1 appel de dessin, ≈ 164 000 sommets) | ≤ 3 ms GPU à DPR 2 |
| Bloom mipmap 8 niveaux | ≤ 2 ms GPU |
| Passe 3 (chroma, vignette, grain) | ≤ 0,8 ms GPU |
| Marge | ≥ 8 ms |

- DPR adaptatif : départ à `min(devicePixelRatio, 2)`. Moyenne glissante sur 60 images : au-dessus de 18 ms → DPR − 0,25 (plancher 1,0) ; sous 12 ms pendant 3 s → DPR + 0,25 (plafond 2). Les performances réelles n'ont pas été mesurées (recherche) : à vérifier sur le M5.
- Pas d'allocation dans la boucle de rendu (vecteurs et tableaux réutilisés). Uniformes mises à jour une fois par image.
- Mobile : 64 × 256 (≈ 33 000 sommets), bloom 5 niveaux, cible 60 i/s, plancher 30.

---

## Récapitulatif pour le développeur

1. Une seule nappe de 160 × 512 rubans, motif qui défile, lignes éteintes par rang de van der Corput.
2. Une formule de hauteur commune, six jeux de paramètres (table 2.4), interpolés en 2 s.
3. Analyse avant le volume ; 4 bandes + attaques ; spectre gravé à partir de z = −6.
4. Transition : scratch → onde de choc qui porte la nouvelle couleur (OKLCH) → caméra qui prend de la hauteur → drop à 1,0 s.
5. Entrée : point → goutte vue d'en haut → recul jusqu'à l'horizon en 3 s.
6. HTML par-dessus, sans panneau : tracklist, escalier, liste de bac, e-mail géant ; platine en bas à droite, lecteur en bas à gauche.
7. Bloom mipmap + AgX, puis chroma, vignette, grain ; DPR adaptatif ; 3 flashs/s au plus.
