# ✋ Hand Navigation — Navigate with your hand

Chrome extension (Manifest V3) that lets you navigate web pages with hand
gestures, using the webcam and **MediaPipe HandLandmarker**.

The UI is localized in **English, Italian, Spanish and French** and follows
Chrome's own language automatically (via `chrome.i18n`), falling back to
English if the browser's language isn't one of the four.

## Gestures

| Gesture | Action |
|---------|--------|
| ☝️ Index finger only | Move the virtual **cursor** |
| 🤏 Pinch (thumb + index) | **Click** at the cursor point |
| 🖱 Pinch (thumb + middle) | **Right-click** (context menu) |
| ✋ Open hand (palm) | **Scroll** — move up/down (with inertia: a flick keeps gliding and fades out) |
| ✊ Closed fist | **Pause** |

> ℹ️ Right-click opens Chrome's **native** context menu by injecting a real
> right-click via `chrome.debugger` (the DevTools protocol). Because of this,
> while recognition is active Chrome shows the yellow bar *"…is debugging this
> browser"*: it's unavoidable with this approach and disappears when you press
> **Stop**. The debugger only attaches on the first right-click.

## Installation

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder (`hand-navigation-extension`)
5. Click the ✋ icon in the toolbar to open the popup

## Usage

1. In the popup press **🎥 Allow camera** once and accept the prompt
2. Open a normal site (it doesn't work on `chrome://` pages)
3. Press **▶︎ Start**
4. Put your hand in front of the webcam and use the gestures

## Calibration (⚙︎ Sensitivity menu)

- **Cursor speed** — how much hand movement is amplified on screen
- **Smoothness (smoothing)** — higher = more stable but less responsive
- **Scroll speed** — scroll multiplier
- **Pinch sensitivity (click)** — how easily the left-click triggers
- **Pinch sensitivity (right-click)** — how easily the right-click (thumb+middle) triggers
- **Invert scroll** — flips the up/down direction

## Architecture

- `offscreen.html` / `offscreen.js` — webcam + MediaPipe + gesture recognition
- `background.js` — service worker: coordinates offscreen, popup and content script
- `content.js` / `content.css` — virtual cursor, clicks and scrolling on the page
- `popup.*` — ON/OFF control, camera consent, settings
- `vendor/` — MediaPipe bundle (`tasks-vision`) + `hand_landmarker.task` model, **local**
- `_locales/*/messages.json` — translated strings (see **Localization** below)
- `i18n.js` — applies translations to the static HTML pages (popup, permission)

## Localization

The extension uses Chrome's built-in [i18n system](https://developer.chrome.com/docs/extensions/reference/api/i18n):

- Each language lives in `_locales/<lang>/messages.json` (currently `en`, `it`, `es`, `fr`).
  `en` is the `default_locale` — the fallback when the browser's language isn't
  one of the supported ones.
- `manifest.json` uses `__MSG_key__` placeholders for the extension name/description.
- Static HTML (`popup.html`, `permission.html`) marks translatable elements with
  `data-i18n` / `data-i18n-html` / `data-i18n-title`; `i18n.js` fills them in from
  `chrome.i18n.getMessage()` at load time. The static text left in the HTML is
  only a fallback shown if that script fails to run.
- Dynamic strings (status messages, on-page gesture badges) call
  `chrome.i18n.getMessage()` directly at runtime.

To add a language: copy `_locales/en/messages.json` into a new `_locales/<lang>/`
folder, translate every `message` value, and keep all keys identical.

## Notes

- The first launch loads the model (~7.6 MB) from the local folder: no CDN
  connection, everything works offline.
- The camera permission is requested **once** on the extension's origin, so it
  works on every site (unlike per-site permission).
- Hands-free control takes some practice: start with a well-lit hand about
  50 cm from the webcam, then adjust the sliders.

## License

Released under the **MIT** license — see [`LICENSE`](LICENSE).

### Third-party components (in `vendor/`)

- **MediaPipe Tasks Vision** and the `hand_landmarker.task` model — © Google,
  licensed under [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0).
- **Play font** — © Jonas Hecksher, licensed under
  [SIL Open Font License 1.1](https://openfontlicense.org).
