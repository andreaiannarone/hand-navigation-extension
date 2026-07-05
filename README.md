# ✋ Hand Navigation — Naviga con la mano

Estensione Chrome (Manifest V3) che permette di navigare le pagine web con i
gesti della mano, usando la webcam e **MediaPipe HandLandmarker**.

## Gesti

| Gesto | Azione |
|-------|--------|
| ☝️ Solo indice esteso | Muovi il **cursore** virtuale |
| 🤏 Pinch (pollice + indice) | **Click** nel punto del cursore |
| 🖱 Pinch (pollice + medio) | **Tasto destro** (menu contestuale) |
| ✋ Mano aperta (palmo) | **Scroll** — muovi su/giù (con inerzia: una spinta prosegue e sfuma) |
| ✊ Pugno chiuso | **Pausa** |

> ℹ️ Il tasto destro apre il menu contestuale **nativo** di Chrome iniettando un
> vero click destro via `chrome.debugger` (protocollo DevTools). Per questo, a
> riconoscimento attivo, Chrome mostra la barra gialla *"…sta effettuando il
> debug di questo browser"*: è inevitabile con questo approccio e sparisce
> premendo **Ferma**. Il debug si aggancia solo al primo click destro.

## Installazione

1. Apri `chrome://extensions`
2. Attiva **Modalità sviluppatore** (in alto a destra)
3. Clicca **Carica estensione non pacchettizzata**
4. Seleziona questa cartella (`estensione-google`)
5. Clicca sull'icona ✋ nella barra degli strumenti per aprire il popup

## Uso

1. Nel popup premi **🎥 Consenti fotocamera** (una sola volta) e accetta il prompt
2. Apri un sito normale (non funziona su pagine `chrome://`)
3. Premi **▶︎ Avvia**
4. Metti la mano davanti alla webcam e usa i gesti

## Calibrazione (menù ⚙︎ Sensibilità)

- **Velocità cursore** — quanto il movimento della mano viene amplificato sullo schermo
- **Fluidità (smoothing)** — più alto = più stabile ma meno reattivo
- **Velocità scroll** — moltiplicatore dello scorrimento
- **Sensibilità pinch (click)** — quanto è facile far scattare il click sinistro
- **Sensibilità pinch (tasto destro)** — quanto è facile far scattare il click destro (pollice+medio)
- **Inverti scroll** — inverte la direzione su/giù

## Architettura

- `offscreen.html` / `offscreen.js` — webcam + MediaPipe + riconoscimento gesti
- `background.js` — service worker: coordina offscreen, popup e content script
- `content.js` / `content.css` — cursore virtuale, click e scroll sulla pagina
- `popup.*` — controllo ON/OFF, consenso fotocamera, impostazioni
- `vendor/` — bundle MediaPipe (`tasks-vision`) + modello `hand_landmarker.task`, **in locale**

## Note

- Il primo avvio carica il modello (~7,6 MB) dalla cartella locale: nessuna
  connessione a CDN, tutto offline.
- Il permesso fotocamera è chiesto **una volta** sull'origine dell'estensione,
  quindi funziona su tutti i siti (a differenza del permesso per singolo sito).
- Il controllo "a mano libera" richiede un po' di pratica: parti con una mano ben
  illuminata e a ~50 cm dalla webcam, poi regola gli slider.

## Licenza

Rilasciato sotto licenza **MIT** — vedi [`LICENSE`](LICENSE).

### Componenti di terze parti (in `vendor/`)

- **MediaPipe Tasks Vision** e il modello `hand_landmarker.task` — © Google,
  licenza [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0).
- **Font Play** — © Jonas Hecksher, licenza
  [SIL Open Font License 1.1](https://openfontlicense.org).
