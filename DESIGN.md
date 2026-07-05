# Design System — "New Element / Iron Man"

Documento di riferimento sull'aspetto visivo del progetto. Raccoglie palette, tipografia,
componenti UI, effetti e parametri della scena 3D così da poter replicare lo stesso stile
("HUD blu su fondo nero, glassmorphism, glow") in nuovi progetti.

L'estetica è quella di un **HUD sci-fi**: interfaccia scura, accenti blu luminosi,
pannelli in vetro smerigliato (glassmorphism), testo mono in maiuscolo, e bagliori (glow/bloom).

---

## 1. Tipografia

- **Font unico**: [`Play`](https://fonts.google.com/specimen/Play) (Google Fonts), pesi `400` e `700`.
  È usato sia come `sans` sia come `mono` — non esiste un vero monospace, l'effetto "tecnico"
  si ottiene con maiuscolo + letter-spacing.
- **Caricamento**: `<link>` a Google Fonts + override in `tailwind.config` (`fontFamily.sans` e
  `fontFamily.mono` entrambi impostati su `['Play', 'sans-serif']`).
- **Stile dei testi UI / etichette**:
  - `font-mono` + `uppercase`
  - `font-bold`
  - `tracking-wider` (etichette badge) o `tracking-[0.22em]` (micro-label)
  - dimensioni tipiche: `text-[11px]`, `text-[10px]`, `text-[9px]`

```html
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

---

## 2. Palette colori

### Base / neutri (fondo scuro)

| Ruolo                       | Valore      | Note                                    |
| --------------------------- | ----------- | --------------------------------------- |
| Sfondo pagina (`body`)      | `#09090b`   | zinc-950                                |
| Testo base (`body`)         | `#e4e4e7`   | zinc-200                                |
| Sfondo scena 3D             | `#050505`   | nero quasi puro (`THREE.Scene`)         |
| Sfondo container canvas     | `#0a0f17`   | blu-nero                                |
| Superfici pannelli          | `zinc-900`  | es. `bg-zinc-900/90`                    |
| Bordi pannelli/scrollbar    | `#18181b` → `#52525b` | scala zinc-800…zinc-600       |

### Accento primario (blu)

| Ruolo                        | Valore              | Nome              |
| ---------------------------- | ------------------- | ----------------- |
| Accento principale           | `#3b82f6`           | blue-500          |
| Accento chiaro / colore base | `#60a5fa`           | blue-400          |
| Accento HUD / luci 3D        | `#58a6ff`           | blu "Iron Man"    |
| Blu profondo particelle      | `#0567ba` / `0x0567ba` | shader particle |
| Griglia stanza 3D            | `0x3b82f6`          | blue-500          |

### Segnali di stato

| Ruolo                | Valore    | Uso                                   |
| -------------------- | --------- | ------------------------------------- |
| REC / LIVE / errore  | `red-500` (`#ef4444`) | puntino pulsante "in diretta" |
| Inattivo / spento    | `zinc-600` / `zinc-500` | indicatori "off"           |

> **Regola pratica**: il blu è *sempre* l'accento attivo/positivo; il rosso è riservato
> allo stato "live/rec"; lo zinc agli stati spenti o al testo secondario.

---

## 3. Componenti UI ricorrenti

### 3.1 Badge "pillola" in vetro (glassmorphism)

Il mattone base di tutta l'interfaccia. Pillola scura, sfocata, con bordo sottile luminoso.

```html
<div class="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full
            backdrop-blur-md border border-white/10 shadow-lg w-fit">
  <!-- puntino di stato + etichetta -->
</div>
```

Ingredienti fissi:
- `bg-black/40` + `backdrop-blur-md` → vetro smerigliato
- `border border-white/10` → bordo appena percettibile
- `rounded-full` + `shadow-lg`
- padding `px-3 py-1.5`, `gap-2`

### 3.2 Puntino di stato con glow

```html
<!-- Attivo (blu) -->
<div class="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>

<!-- Live (rosso, pulsante) -->
<div class="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>

<!-- Spento -->
<div class="w-2 h-2 bg-zinc-600 rounded-full"></div>
```

Il glow è sempre uno `shadow-[0_0_8px_rgba(<colore>,0.8)]` con lo stesso colore del puntino.

### 3.3 Badge di stato attivo/inattivo (transizione)

Cambia sfondo e bordo in base a un booleano, con transizione morbida:

```html
<div class="... transition-all duration-300
     {attivo ? 'bg-blue-500/20 border-blue-500/40' : 'bg-black/40 border-white/10'}">
```

### 3.4 Pannello impostazioni

```html
<div class="bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50
            rounded-2xl shadow-2xl p-6 text-zinc-100
            max-h-[80vh] overflow-y-auto transition-all duration-300">
```

- Bottoni secondari: `bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md`
- Bottone primario (CTA): `bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500`
- Slider: `accent-blue-500 hover:accent-blue-400`, traccia `bg-zinc-700`
- Input focus: `focus:ring-2 focus:ring-blue-500/50`

### 3.5 Finestra webcam

- Contenitore: `rounded-3xl` (mobile) / `rounded-xl`, `bg-black/40 backdrop-blur-md border border-white/10`
- Video **specchiato**: `transform scale-x-[-1]` (anche l'overlay canvas sopra)
- Micro-label interna (`HAND OVERLAY`, `REC`) in pillola nera `bg-black/60`

---

## 4. Effetti e "glow"

- **Glow puntuale (CSS)**: `shadow-[0_0_8px_rgba(r,g,b,0.8)]` sugli elementi accesi.
- **Bloom 3D** (`UnrealBloomPass`) — parametri di riferimento:
  ```js
  bloomStrength  = 1.0
  bloomThreshold = 0.0   // tutto emette bloom
  bloomRadius    = 0.5
  ```
- **Blending additivo** negli shader delle particelle/wireframe (`THREE.AdditiveBlending`,
  `depthWrite: false`, `transparent: true`) → i bagliori si sommano invece di coprirsi.
- **Animazioni**: `animate-pulse` sui puntini live/hint; transizioni UI `transition-all duration-300`.
- **Smoothing**: i movimenti (testa, zoom) sono interpolati con lerp per un feeling "fluido"
  invece che a scatti (fattori tipici `0.12`–`0.24`).

---

## 5. Scena 3D (Three.js)

Serve solo se si vuole riprodurre l'ambiente "stanza HUD".

- **Renderer**: `WebGLRenderer` antialias, `pixelRatio` limitato a `min(devicePixelRatio, 2)`,
  `powerPreference: "high-performance"`.
- **Camera**: `PerspectiveCamera(fov 85, near 0.05, far 500)`, posizione `z ≈ 25`.
- **Luci**:
  - `AmbientLight(0xffffff, 0.35)`
  - `DirectionalLight(0x58a6ff, 1.4)` posizionata in `(2, 3, 2)` → tinta blu.
- **Stanza a griglia**: 6 piani (pavimento, soffitto, 3 pareti) fatti di `LineSegments`
  colore `0x3b82f6`, `opacity 0.4`. Dimensioni: lato `90`, altezza `30`, cella `1.5`.
- **Sfera tech** al centro: `IcosahedronGeometry(10, 6)` con doppio materiale
  (particelle procedurali blu `0x0567ba` + wireframe additivo), rotazione lenta continua.

---

## 6. Layout

Interfaccia a **overlay** sopra la scena 3D full-screen (`w-screen h-screen overflow-hidden bg-black`).
Angoli usati come "HUD":

| Zona            | Contenuto                                          |
| --------------- | -------------------------------------------------- |
| Alto sinistra   | Badge titolo (puntino blu + nome progetto)         |
| Alto destra     | Indicatori di stato (LIVE / FACE / HANDS), in colonna su mobile, in riga su desktop |
| Basso sinistra  | Badge istruzioni (`MOVE HEAD… / PINCH…`)           |
| Basso destra    | Finestra webcam                                    |

- Overlay non interattivi: `pointer-events-none` (così i click passano alla scena).
- Z-index: scena `z-0`, overlay `z-10`/`z-40`, indicatori `z-50`, loader `z-[9999]`.
- Responsive: mobile impila e allarga (`left-4 right-4`), desktop compatta (`sm:w-fit`, `sm:right-6`).

---

## 7. Scrollbar personalizzata (webkit)

```css
::-webkit-scrollbar        { width: 8px; }
::-webkit-scrollbar-track  { background: #18181b; }
::-webkit-scrollbar-thumb  { background: #3f3f46; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #52525b; }
```

---

## 8. Checklist per un nuovo progetto

Per portare questo look altrove:

1. Importa il font **Play** e impostalo come `sans`/`mono` di default.
2. Fondo pagina `#09090b`, testo `#e4e4e7`.
3. Usa **blue-500/blue-400/#58a6ff** come unico accento; rosso solo per "live".
4. Ogni elemento UI è una **pillola di vetro** (`bg-black/40 backdrop-blur-md border border-white/10 rounded-full`).
5. Testo etichette: `font-mono uppercase font-bold tracking-wider`, taglie 9–11px.
6. Stati accesi = **puntino + glow** `shadow-[0_0_8px_rgba(colore,0.8)]`.
7. Se c'è 3D: griglia blu `0x3b82f6` + bloom (`strength 1.0`, `threshold 0.0`, `radius 0.5`) + blending additivo.
8. Overlay negli angoli, `pointer-events-none`, transizioni `duration-300`.
