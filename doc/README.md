# Documentation — Hand Navigation

Index of the technical documentation for the **Hand Navigation** Chrome
extension, which lets you navigate web pages with hand gestures using the
webcam and **MediaPipe HandLandmarker**.

This folder gathers in one place information that is otherwise scattered
across the code, `README.md` and `DESIGN.md`, so there's a complete and
up-to-date map of the extension.

## Document index

| Document | Content |
|-----------|-----------|
| [architecture.md](architecture.md) | MV3 components, message flow, state and controlled-tab management |
| [gestures-and-interactions.md](gestures-and-interactions.md) | Gesture recognition algorithm, cursor, clicks, scroll, context menu |
| [settings.md](settings.md) | All calibration parameters, default values and ranges |
| [localization.md](localization.md) | i18n system, supported languages, how to add a new one |
| [design-system.md](design-system.md) | Summary of the HUD design system and where it's applied in the code |
| [installation-and-usage.md](installation-and-usage.md) | Installation, first run, camera permission, calibration |
| [permissions-and-privacy.md](permissions-and-privacy.md) | Manifest permissions, why they're needed, privacy/offline notes |

## Quick overview

- **Type**: Chrome extension, Manifest V3.
- **Purpose**: control the mouse/scroll/context menu of the active page by
  moving your hand in front of the webcam, without touching mouse or
  keyboard.
- **Tracking engine**: [MediaPipe Tasks Vision — HandLandmarker](https://developers.google.com/mediapipe),
  running entirely locally (bundle in `vendor/`, no CDN calls).
- **Main components**: `background.js` (service worker), `offscreen.js`
  (webcam + inference), `content.js`/`content.css` (on-page overlay),
  `popup.*` (control panel), `permission.html/js` (camera permission grant in
  a dedicated tab), `i18n.js` (translations).
- **Supported languages**: English, Italian, Spanish, French, German, Polish,
  Portuguese (see [localization.md](localization.md)).
- **License**: MIT (see [`LICENSE`](../LICENSE)). Third-party components in
  `vendor/`: MediaPipe Tasks Vision and the `hand_landmarker.task` model
  (© Google, Apache-2.0); **Play** font (© Jonas Hecksher, SIL OFL 1.1).

## Relevant source files

```
manifest.json         MV3 manifest: permissions, background, content script, CSP
background.js         Service worker: coordinates offscreen/popup/content, debugger CDP
offscreen.js          Webcam + MediaPipe HandLandmarker + gesture recognition
content.js / .css     Virtual cursor, clicks, scroll, context menu on the page
popup.html/.css/.js   ON/OFF panel, camera permission, sensitivity sliders
permission.html/.js   Dedicated page to grant the camera permission
i18n.js                Applies chrome.i18n translations to static pages
_locales/<lang>/       Translation files for each language
vendor/                MediaPipe bundle (tasks-vision) + .task model, local
DESIGN.md              Full HUD design system (tokens, components, motion, 3D)
```
