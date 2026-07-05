# Design System — "New Element / Iron Man"

Documento di riferimento completo sull'aspetto visivo del progetto. Raccoglie design token,
palette, tipografia, componenti UI, iconografia, effetti, motion e parametri della scena 3D,
così da poter replicare fedelmente lo stesso stile ("HUD blu su fondo nero, glassmorphism,
glow") in nuovi progetti.

**Estetica di riferimento**: un **HUD sci-fi** — interfaccia scura, accenti blu luminosi,
pannelli in vetro smerigliato (glassmorphism), testo mono in maiuscolo con letter-spacing,
bagliori diffusi (glow CSS + bloom 3D) e movimenti sempre interpolati (mai a scatti).

> **Come usare questo file**: le sezioni 1–4 bastano per replicare la sola UI 2D.
> Le sezioni 9–11 servono solo se vuoi anche l'ambiente 3D / il tracking.
> La sezione 12 contiene i token pronti da copiare (CSS + JSON).

---

## Indice

1. [Principi di design](#1-principi-di-design)
2. [Tipografia](#2-tipografia)
3. [Palette colori](#3-palette-colori)
4. [Componenti UI](#4-componenti-ui)
5. [Iconografia](#5-iconografia)
6. [Spaziature, raggi e ombre](#6-spaziature-raggi-e-ombre)
7. [Z-index e layering](#7-z-index-e-layering)
8. [Layout e responsive](#8-layout-e-responsive)
9. [Motion e interazione](#9-motion-e-interazione)
10. [Scena 3D (Three.js)](#10-scena-3d-threejs)
11. [Shader e glow](#11-shader-e-glow)
12. [Design token (CSS + JSON)](#12-design-token-css--json)
13. [Checklist per un nuovo progetto](#13-checklist-per-un-nuovo-progetto)

---

## 1. Principi di design

- **Buio come base.** Tutto parte da un fondo quasi nero; il colore è un evento, non lo sfondo.
- **Un solo accento.** Il blu (`blue-500`/`blue-400`/`#58a6ff`) è l'unica famiglia cromatica
  "attiva". Il rosso è riservato allo stato *live/rec*. Lo zinc a testo secondario e stati spenti.
- **Vetro, non pannelli pieni.** Ogni superficie UI è semitrasparente + `backdrop-blur`,
  con un bordo bianco sottilissimo (`border-white/10`) che ne suggerisce il profilo.
- **La luce comunica lo stato.** Un elemento "acceso" ha sempre un glow (`shadow-[0_0_8px_...]`);
  spento è opaco e desaturato.
- **Movimento morbido.** Nessuna transizione istantanea: le UI usano `duration-300`, la scena
  interpola ogni valore con lerp. Il feeling è "fluido/inerziale".
- **HUD, non documento.** L'interfaccia vive negli angoli come overlay non invasivo
  (`pointer-events-none`), lasciando il centro alla scena.

---

## 2. Tipografia

- **Font unico**: [`Play`](https://fonts.google.com/specimen/Play) (Google Fonts), pesi `400` e `700`.
  È usato sia come `sans` sia come `mono`: non esiste un vero monospace, l'effetto "tecnico"
  nasce da **maiuscolo + letter-spacing**, non dal font.
- **Fallback**: `sans-serif`.
- **Caricamento**: `<link>` a Google Fonts + override in `tailwind.config` + regola CSS globale
  che forza `Play` ovunque (incluso `.font-mono` e i widget `.lil-gui`).

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Play:wght@400;700&display=swap" rel="stylesheet">
```

```js
// tailwind.config
theme: {
  extend: {
    fontFamily: {
      sans: ['Play', 'sans-serif'],
      mono: ['Play', 'sans-serif'],
    },
  },
},
```

```css
html, body, #root { font-family: 'Play', sans-serif; }
*, *::before, *::after { font-family: inherit; }
.font-sans, .font-mono, .lil-gui, .lil-gui * { font-family: 'Play', sans-serif !important; }
```

### Scala tipografica dei testi UI

| Uso                      | Classi                                                        |
| ------------------------ | ------------------------------------------------------------ |
| Etichetta badge primaria | `text-[11px] font-bold uppercase tracking-wider font-mono`   |
| Istruzioni / hint        | `text-[10px] font-bold uppercase tracking-wider font-mono`   |
| Micro-label (overlay)    | `text-[9px] font-bold uppercase tracking-[0.22em] font-mono` |
| Titolo pannello          | `text-lg font-semibold`                                      |
| Testo pannello / label   | `text-xs` / `text-sm`, colore `text-zinc-400`/`text-zinc-500`|
| Valore numerico mono     | `text-xs font-mono text-zinc-300`                            |

**Regole ricorrenti**: le etichette HUD sono **sempre** `uppercase font-bold` con
`tracking-wider` (o `tracking-[0.22em]` per le micro-label) e `font-mono`.

---

## 3. Palette colori

### 3.1 Base / neutri

| Ruolo                       | HEX / THREE           | Tailwind         |
| --------------------------- | --------------------- | ---------------- |
| Sfondo pagina (`body`)      | `#09090b`             | zinc-950         |
| Testo base (`body`)         | `#e4e4e7`             | zinc-200         |
| Sfondo scena 3D             | `#050505`             | —                |
| Sfondo container canvas     | `#0a0f17`             | —                |
| Superficie pannello         | `#18181b` (`/90`)     | zinc-900         |
| Superficie widget/slider    | `#3f3f46`             | zinc-700         |
| Bordo widget                | `#27272a`             | zinc-800         |
| Hover / focus GUI           | `#52525b`             | zinc-600         |

### 3.2 Accento primario (blu)

| Ruolo                          | HEX / THREE            | Tailwind   | RGB               |
| ------------------------------ | ---------------------- | ---------- | ----------------- |
| Accento principale             | `#3b82f6` / `0x3b82f6` | blue-500   | `59, 130, 246`    |
| Accento chiaro / colore base   | `#60a5fa`              | blue-400   | `96, 165, 250`    |
| Accento HUD / luci 3D          | `#58a6ff`              | —          | `88, 166, 255`    |
| Blu profondo particelle        | `#0567ba` / `0x0567ba` | —          | `5, 103, 186`     |
| Wireframe sfera (shader)       | `rgb(0.77,0.90,1.0)`   | —          | quasi bianco-blu  |
| Ciano overlay mano             | `rgba(56,189,248,…)`   | sky-400    | `56, 189, 248`    |
| Bordo overlay mano             | `rgba(14,165,233,…)`   | sky-500    | `14, 165, 233`    |

### 3.3 Segnali di stato

| Ruolo                | HEX       | Tailwind   | RGB              |
| -------------------- | --------- | ---------- | ---------------- |
| REC / LIVE / errore  | `#ef4444` | red-500    | `239, 68, 68`    |
| Highlight gesto      | `#facc15` | yellow-400 | `250, 204, 21`   |
| Inattivo (puntino)   | `#52525b` | zinc-600   | —                |
| Inattivo (testo)     | `#71717a` | zinc-500   | —                |

### 3.4 Colori dell'overlay hand-tracking (canvas 2D)

Usati per disegnare scheletro e landmark della mano sulla webcam:

| Elemento                 | Colore                     | Tratto                    |
| ------------------------ | -------------------------- | ------------------------- |
| Connessioni (ossa)       | `rgba(96, 165, 250, 0.75)` | `lineWidth 3`             |
| Landmark generici (fill) | `rgba(59, 130, 246, 0.92)` | raggio `4.5`              |
| Landmark generici (bordo)| `rgba(14, 165, 233, 0.5)`  | `lineWidth 2`             |
| Polpastrelli gesto (fill)| `rgba(255, 255, 255, 0.95)`| raggio `7`                |
| Polpastrelli gesto (bordo)| `rgba(56, 189, 248, 0.95)`| `lineWidth 2`             |
| Linea pollice–indice     | `rgba(250, 204, 21, 0.9)`  | `lineWidth 2.5`, dash `[8,6]` |

> **Regola cromatica**: blu = attivo/positivo · rosso = live/rec · giallo = misura del gesto ·
> zinc = spento/secondario. Non introdurre altri hue.

---

## 4. Componenti UI

### 4.1 Badge "pillola" in vetro (mattone base)

```html
<div class="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full
            backdrop-blur-md border border-white/10 shadow-lg w-fit">
  <!-- puntino di stato + etichetta -->
</div>
```

Ingredienti fissi: `bg-black/40` + `backdrop-blur-md` (vetro) · `border border-white/10`
(bordo appena percettibile) · `rounded-full` · `shadow-lg` · padding `px-3 py-1.5` · `gap-2`.

### 4.2 Puntino di stato con glow

```html
<!-- Attivo (blu) -->
<div class="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
<!-- Live (rosso, pulsante) -->
<div class="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
<!-- Attivo piccolo (blu-400) -->
<div class="w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.8)]"></div>
<!-- Spento -->
<div class="w-2 h-2 bg-zinc-600 rounded-full"></div>
```

Il glow è **sempre** `shadow-[0_0_8px_rgba(<colore>,0.8)]` con lo stesso colore del puntino.
Taglie: `w-2 h-2` (standard), `w-1.5 h-1.5` (micro).

### 4.3 Badge di stato attivo/inattivo (con transizione)

Sfondo e bordo cambiano in base a un booleano, con transizione morbida:

```html
<div class="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border
            shadow-lg w-fit transition-all duration-300
            {attivo ? 'bg-blue-500/20 border-blue-500/40' : 'bg-black/40 border-white/10'}">
  <div class="w-2 h-2 rounded-full
       {attivo ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-zinc-600'}"></div>
  <span class="text-[11px] font-bold uppercase tracking-wider font-mono
        {attivo ? 'text-blue-100' : 'text-zinc-500'}">
    {attivo ? 'FACE DETECTED' : 'NO FACE'}
  </span>
</div>
```

### 4.4 Pannello impostazioni

```html
<div class="fixed bottom-6 right-6 w-80 md:w-96 bg-zinc-900/90 backdrop-blur-md
            border border-zinc-700/50 rounded-2xl shadow-2xl p-6 text-zinc-100
            flex flex-col gap-4 max-h-[80vh] overflow-y-auto transition-all duration-300">
```

- **Header**: titolo `text-lg font-semibold` + icona `text-blue-400`, separatore `border-b border-zinc-800 pb-2`.
- **Sotto-sezione**: `bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50`.
- **Bottone secondario**: `bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-xs font-medium`.
- **Bottone primario (CTA)**: `bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50`.
- **Input testo**: `bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 placeholder-zinc-600`.
- **Slider**: `accent-blue-500 hover:accent-blue-400`, traccia `h-1 bg-zinc-700 rounded-lg`.
- **Bottone flottante (pannello chiuso)**: `bg-zinc-800 hover:bg-zinc-700 rounded-full shadow-lg border border-zinc-700`.

### 4.5 Loader / stato di caricamento

```html
<div class="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-2
            bg-zinc-900/80 backdrop-blur-md px-4 py-2 rounded-full
            border border-blue-500/30 text-blue-400 z-[9999] pointer-events-none">
  <!-- <Loader2 class="w-4 h-4 animate-spin" /> -->
  <span class="text-xs font-medium tracking-wide uppercase">{status}</span>
</div>
```

Nota: montato via `createPortal` su `document.body` per stare sopra tutto.

### 4.6 Finestra webcam

```html
<div class="absolute bottom-6 left-4 right-4 rounded-3xl overflow-hidden bg-black/40
            backdrop-blur-md border border-white/10 z-40 sm:left-auto sm:right-6 sm:w-72">
  <div class="relative aspect-video bg-black/50">
    <video class="w-full h-full object-cover transform scale-x-[-1]" autoplay playsinline muted></video>
    <canvas class="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] pointer-events-none"></canvas>
    <!-- micro-label HAND OVERLAY in pillola bg-black/60 -->
  </div>
</div>
```

- Video **specchiato**: `transform scale-x-[-1]` (anche l'overlay canvas sopra, per allineare i landmark).
- `aspect-video`, angoli `rounded-3xl` (mobile) / `rounded-xl`.
- Micro-label interna in pillola `bg-black/60 px-2 py-1 rounded-full backdrop-blur-md border border-white/10`.

---

## 5. Iconografia

- **Libreria**: [`lucide-react`](https://lucide.dev) — icone lineari coerenti con lo stile HUD.
  Usate: `Loader2` (spinner), `Sliders`, `Sparkles`, `Wand2`, `Minimize2`, `Box`, `Circle`.
- **Taglie tipiche**: `w-4 h-4` (inline badge), `w-5 h-5` (header/bottoni), `w-6 h-6` (bottone flottante),
  `w-3.5 h-3.5` (bottone compatto).
- **Colore**: `currentColor` — l'icona eredita il colore del testo (`text-blue-400` da accesa,
  `text-zinc-500` da spenta).
- **Icona custom "pinch"**: SVG inline `viewBox="0 0 475.73 523.45"`, `fill="currentColor"`,
  usata come indicatore mano. Segue le stesse regole di colore delle icone lucide.
- **Spinner**: `animate-spin` su `Loader2`.

---

## 6. Spaziature, raggi e ombre

### Spaziatura (padding interni ricorrenti)

| Contesto            | Classi              |
| ------------------- | ------------------- |
| Pillola badge       | `px-3 py-1.5`       |
| Micro-pillola       | `px-2 py-1` / `py-0.5` |
| Pannello            | `p-6`               |
| Sotto-sezione       | `p-4`               |
| Gap badge           | `gap-2`             |
| Gap micro           | `gap-1.5`           |
| Offset dagli angoli | `top-6` / `bottom-6` / `left-6` / `right-6` (mobile: `left-4 right-4`) |

### Border radius

| Elemento             | Raggio         |
| -------------------- | -------------- |
| Pillole / puntini / bottoni tondi | `rounded-full` |
| Pannello             | `rounded-2xl`  |
| Sotto-sezione        | `rounded-xl`   |
| Webcam (mobile)      | `rounded-3xl`  |
| Webcam (desktop)     | `rounded-xl`   |
| Input / bottone sec. | `rounded-lg` / `rounded-md` |
| Scrollbar thumb      | `4px`          |

### Ombre & bordi

- Bordo standard vetro: `border border-white/10`.
- Bordo pannello: `border border-zinc-700/50`.
- Bordo attivo: `border-blue-500/40`.
- Ombra badge: `shadow-lg` · Ombra pannello: `shadow-2xl`.
- Glow puntuale: `shadow-[0_0_8px_rgba(r,g,b,0.8)]`.
- Ring interno webcam: `ring-1 ring-inset ring-white/10`.

---

## 7. Z-index e layering

| Livello              | Z-index      | Contenuto                          |
| -------------------- | ------------ | ---------------------------------- |
| Scena 3D / canvas    | `z-0`        | ambiente, fondo                    |
| Overlay UI angoli    | `z-10`       | badge titolo, istruzioni           |
| Finestra webcam      | `z-40`       | video + overlay mano               |
| Indicatori di stato  | `z-50`       | LIVE / FACE / HANDS                |
| Loader               | `z-[9999]`   | montato su `document.body` (portal)|

---

## 8. Layout e responsive

Interfaccia a **overlay** sopra la scena 3D full-screen:
`relative w-screen h-screen h-dvh min-h-screen min-h-dvh overflow-hidden bg-black`.
Nota: uso di `dvh` per gestire correttamente la barra del browser su mobile.

Gli angoli fanno da "HUD":

| Zona            | Contenuto                                                    |
| --------------- | ----------------------------------------------------------- |
| Alto sinistra   | Badge titolo (puntino blu + nome progetto)                  |
| Alto destra     | Indicatori di stato (LIVE / FACE / HANDS)                   |
| Basso sinistra  | Badge istruzioni (`MOVE HEAD… / PINCH…`)                    |
| Basso destra    | Finestra webcam                                             |

### Regole responsive

- **Breakpoint unico**: `sm:` (Tailwind, 640px). Sotto è "mobile".
- **Mobile**: gli overlay si allargano a tutta larghezza (`left-4 right-4`), gli indicatori si
  impilano in colonna (`flex-col items-end`), la webcam è full-width.
- **Desktop (`sm:`)**: gli overlay si compattano (`sm:w-fit`), gli indicatori vanno in riga
  (`sm:flex-row sm:items-center`), la webcam si ancora a destra (`sm:right-6 sm:w-72`).
- **Overlay non interattivi**: `pointer-events-none` così i click/gesti passano alla scena
  (riattivato puntualmente dove serve interagire).
- **Selezione testo**: `selection:bg-blue-500/30` (coerente con l'accento).

---

## 9. Motion e interazione

La sensazione "fluida" nasce dall'interpolazione (lerp) di **ogni** valore verso un target,
frame per frame, invece di applicare i valori grezzi.

### Transizioni UI

- Cambi di stato badge/pannello: `transition-all duration-300`.
- Hover bottoni: `transition-colors` / `transition-all`.
- Pulsazioni: `animate-pulse` (puntini live/hint). Spinner: `animate-spin`.

### Smoothing della scena (fattori lerp per frame)

| Grandezza                    | Fattore | Nota                          |
| ---------------------------- | ------- | ----------------------------- |
| Yaw / Pitch testa            | `0.14`  | rotazione stanza              |
| Offset X / Y testa           | `0.14`  | traslazione stanza            |
| Slide X                      | `0.12`  | scorrimento orizzontale extra |
| Scala sfera (zoom mano)      | `0.24`  | `scaleSmoothing`              |
| Smoothing landmark mano      | `0.58`  | `landmarkSmoothing`           |
| Smoothing spread pollice–indice | `0.4` | `spreadSmoothing`            |

### Mappatura input → scena (face tracking)

Dal naso (`landmark[6]`), con `nx, ny ∈ [-1, 1]`:

```
targetYaw    = nx * 0.95      roomGroup.rotation.y = smoothedYaw   * 0.85
targetPitch  = -ny * 0.75     roomGroup.rotation.x = smoothedPitch * 0.6
targetOffsetX= nx * 1.2       slideX = smoothedOffsetX * 2.4 + smoothedSlideX
targetOffsetY= -ny * 1.1      slideY = smoothedOffsetY * 1.8 + smoothedPitch * 1.2
targetSlideX = nx * 3.0
```

Auto-rotazione continua della sfera: `rotation.y += 0.005`, `rotation.x += 0.002` per frame.

### Gesto di zoom (pinch pollice–indice)

Scala target = lerp tra chiuso e aperto in base allo "spread" normalizzato sulla mano.

| Costante            | Valore | Significato                                              |
| ------------------- | ------ | ------------------------------------------------------- |
| `DEFAULT_HAND_SCALE`| `1.0`  | scala a riposo / mano assente                           |
| `CLOSED_HAND_SCALE` | `0.8`  | scala minima (dita unite)                               |
| `OPEN_HAND_SCALE`   | `2.8`  | scala massima (dita aperte)                             |
| `openGestureRatio`  | `1.55` | ratio a cui si raggiunge lo zoom massimo (↓ = più facile)|
| `closedGestureRatio`| `0.03` | ratio a cui si raggiunge lo zoom minimo                 |
| `maxTipDepthDelta`  | `0.14` | scarto di profondità oltre cui il gesto è ignorato      |
| `gestureDeadZoneRatio`| `0.035` | zona morta anti-jitter                                |
| `maxScaleStep`      | `0.06` | variazione massima di scala per frame (precisione)      |

### Qualità del tracking (MediaPipe)

| Parametro                | Face | Hands  |
| ------------------------ | ---- | ------ |
| `maxNumFaces` / `maxNumHands` | `1` | `1`  |
| `modelComplexity`        | —    | `1`    |
| `minDetectionConfidence` | `0.5`| `0.65` |
| `minTrackingConfidence`  | `0.5`| `0.6`  |
| `refineLandmarks`        | `false` (performance) | — |
| Input camera             | —    | `960 × 720` |

---

## 10. Scena 3D (Three.js)

Serve solo per riprodurre l'ambiente "stanza HUD".

- **Renderer**: `WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" })`,
  `setPixelRatio(min(devicePixelRatio, 2))`, `toneMappingExposure = 1.0`.
- **Camera**: `PerspectiveCamera(85, aspect, 0.05, 500)`, posizione iniziale `(0, 0, 25)`,
  `lookAt(0, 0, 0)`.
- **Controls**: `OrbitControls` con `enableDamping` on ma pan/zoom/rotate **disabilitati**
  (usati solo per il damping, non per l'input utente).
- **Luci**:
  - `AmbientLight(0xffffff, 0.35)`
  - `DirectionalLight(0x58a6ff, 1.4)` in `(2, 3, 2)` → tinta blu direzionale.
- **Sfondo scena**: `#050505`.
- **Stanza a griglia**: 6 piani (pavimento, soffitto, 3 pareti) come `LineSegments`,
  colore `0x3b82f6`, `opacity 0.4`, `linewidth 1`. Parametri: `roomSize 90`, `roomHeight 30`,
  `cellSize 1.5`.
- **Sfera tech** al centro: `IcosahedronGeometry(10, 6)` con **due** materiali sovrapposti
  (particelle procedurali + wireframe additivo), rotazione lenta continua e scala pilotata dal gesto.

---

## 11. Shader e glow

Il "glow" ha due livelli: **CSS** per la UI 2D, **bloom + additive blending** per il 3D.

### Glow CSS (UI)

`shadow-[0_0_8px_rgba(r,g,b,0.8)]` sugli elementi accesi, stesso colore del riempimento.

### Bloom (post-processing)

`UnrealBloomPass` sul composer, parametri di riferimento:

```js
bloomStrength  = 1.0    // intensità
bloomThreshold = 0.0    // tutto emette bloom
bloomRadius    = 0.5    // diffusione
```

### Shader particelle (procedurale, no texture)

`ShaderMaterial` additivo, colore `0x0567ba`, `size: 1.2`, `transparent`, `depthWrite: false`,
`blending: AdditiveBlending`. Punti circolari con gradiente di glow morbido.

```glsl
// vertex — size attenuation in base alla profondità
uniform float size;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (400.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}

// fragment — punto circolare con glow
uniform vec3 color;
void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;              // ritaglia il cerchio
  float alpha = 1.0 - (dist * 2.0);
  alpha = pow(alpha, 1.5);              // curva del glow
  gl_FragColor = vec4(color, alpha);
}
```

### Shader wireframe (bordi triangoli)

`ShaderMaterial` `DoubleSide`, additivo, `depthWrite: false`. Usa un attributo `center` per
disegnare solo i bordi delle facce, con colore quasi bianco-blu a bassa opacità:

```glsl
// fragment (estratto)
gl_FragColor = vec4(0.77, 0.90, 1.0, 0.2);
```

> **Nota**: `AdditiveBlending` + `depthWrite: false` fanno sì che i bagliori si **sommino**
> invece di coprirsi — è la chiave dell'effetto "energia".

---

## 12. Design token (CSS + JSON)

Pronti da copiare in un nuovo progetto.

### CSS custom properties

```css
:root {
  /* Base */
  --bg-page:        #09090b;
  --text-base:      #e4e4e7;
  --bg-scene:       #050505;
  --bg-canvas:      #0a0f17;
  --surface-900:    #18181b;
  --surface-800:    #27272a;
  --widget:         #3f3f46;
  --hover:          #52525b;

  /* Accento blu */
  --accent:         #3b82f6; /* blue-500 */
  --accent-light:   #60a5fa; /* blue-400 */
  --accent-hud:     #58a6ff;
  --accent-deep:    #0567ba;

  /* Stato */
  --live:           #ef4444; /* red-500 */
  --gesture:        #facc15; /* yellow-400 */
  --muted-dot:      #52525b; /* zinc-600 */
  --muted-text:     #71717a; /* zinc-500 */

  /* Effetti */
  --glass-bg:       rgba(0, 0, 0, 0.40);
  --glass-border:   rgba(255, 255, 255, 0.10);
  --glow:           0 0 8px;      /* + rgba(accento, 0.8) */
  --radius-pill:    9999px;
  --radius-panel:   1rem;         /* rounded-2xl */
  --blur:           12px;         /* backdrop-blur-md */
  --transition:     300ms;

  /* Font */
  --font: 'Play', sans-serif;
}
```

### JSON (design tokens)

```json
{
  "font": { "family": "Play, sans-serif", "weights": [400, 700] },
  "color": {
    "base":   { "page": "#09090b", "text": "#e4e4e7", "scene": "#050505", "canvas": "#0a0f17" },
    "surface":{ "900": "#18181b", "800": "#27272a", "widget": "#3f3f46", "hover": "#52525b" },
    "accent": { "primary": "#3b82f6", "light": "#60a5fa", "hud": "#58a6ff", "deep": "#0567ba" },
    "state":  { "live": "#ef4444", "gesture": "#facc15", "mutedDot": "#52525b", "mutedText": "#71717a" }
  },
  "glass":  { "bg": "rgba(0,0,0,0.40)", "border": "rgba(255,255,255,0.10)", "blur": "12px" },
  "glow":   { "spread": "0 0 8px", "opacity": 0.8 },
  "radius": { "pill": "9999px", "panel": "1rem", "section": "0.75rem", "input": "0.5rem" },
  "shadow": { "badge": "lg", "panel": "2xl" },
  "motion": {
    "uiTransitionMs": 300,
    "lerp": { "headYawPitch": 0.14, "headOffset": 0.14, "slideX": 0.12, "scale": 0.24, "landmark": 0.58, "spread": 0.4 }
  },
  "zIndex": { "scene": 0, "overlay": 10, "webcam": 40, "indicators": 50, "loader": 9999 },
  "three": {
    "sceneBg": "#050505",
    "camera": { "fov": 85, "near": 0.05, "far": 500, "z": 25 },
    "lights": { "ambient": ["#ffffff", 0.35], "directional": ["#58a6ff", 1.4, [2, 3, 2]] },
    "grid":   { "color": "#3b82f6", "opacity": 0.4, "roomSize": 90, "roomHeight": 30, "cellSize": 1.5 },
    "bloom":  { "strength": 1.0, "threshold": 0.0, "radius": 0.5 }
  }
}
```

---

## 13. Checklist per un nuovo progetto

Per portare questo look altrove, in ordine:

1. **Font** — importa `Play` (400/700) e impostalo come `sans` *e* `mono` di default.
2. **Fondo** — pagina `#09090b`, testo `#e4e4e7`; se c'è 3D, scena `#050505`.
3. **Accento unico** — usa **blue-500 / blue-400 / #58a6ff**; rosso solo per "live", giallo solo per misure/gesti.
4. **Vetro** — ogni elemento UI è una pillola `bg-black/40 backdrop-blur-md border border-white/10 rounded-full`.
5. **Testo etichette** — `font-mono uppercase font-bold tracking-wider`, taglie 9–11px.
6. **Stato acceso** — sempre **puntino + glow** `shadow-[0_0_8px_rgba(colore,0.8)]`; spento = opaco/zinc.
7. **Icone** — `lucide-react` lineari a `currentColor`, `w-4/5 h-4/5`.
8. **Layout HUD** — overlay negli angoli, `pointer-events-none`, z-index a scaglioni (10/40/50/9999).
9. **Motion** — transizioni `duration-300`; nella scena interpola *ogni* valore con lerp (0.12–0.24).
10. **3D (opzionale)** — griglia blu `0x3b82f6` opacità `0.4` + bloom (`1.0 / 0.0 / 0.5`) + `AdditiveBlending`.
11. **Responsive** — un solo breakpoint `sm:`; mobile impila e allarga, desktop compatta negli angoli.
12. **Rifiniture** — scrollbar custom zinc, `selection:bg-blue-500/30`, `dvh` per il full-height mobile.
