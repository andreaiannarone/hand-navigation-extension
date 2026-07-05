# Localization (i18n)

The extension uses Chrome's [native i18n system](https://developer.chrome.com/docs/extensions/reference/api/i18n),
not an external library.

## Supported languages

`en` (default), `it`, `es`, `fr`, `de`, `pl`, `pt` — each in
`_locales/<lang>/messages.json`. `en` is the `default_locale` declared in
`manifest.json` and is the fallback when the browser's language isn't among
the supported ones.

## Where translation is applied

1. **`manifest.json`**: `name`/`description` use the `__MSG_appName__` /
   `__MSG_appDesc__` placeholders, automatically resolved by Chrome to the
   right language.
2. **Static HTML** (`popup.html`, `permission.html`): translatable elements
   are marked with `data-*` attributes and filled in at runtime by
   `i18n.js`:
   - `data-i18n="key"` → sets `textContent`;
   - `data-i18n-html="key"` → sets `innerHTML` (for messages containing
     markup, e.g. `<strong>`/`<em>` in `permBody`/`permHint`);
   - `<html data-i18n-title="key">` → sets `document.title`.
   The static text left in the HTML (often in Italian, e.g. "Naviga con i
   gesti della mano" in `popup.html`) is **only a visual fallback** shown if
   `i18n.js` fails to run.
3. **Dynamic strings** (cursor badge, popup status messages, offscreen
   errors): call `chrome.i18n.getMessage('key', [substitutions])` directly at
   runtime, bypassing `i18n.js`.
4. **`i18n.js`** also syncs `<html lang>` with the language Chrome actually
   used for the messages (`chrome.i18n.getUILanguage()`), applying the same
   fallback to `en` if the browser's language isn't supported — the
   `SUPPORTED_LANGS` list in `i18n.js` **must stay in sync** with the folders
   present under `_locales/`.

## Main keys (`_locales/en/messages.json`)

| Group | Keys |
|---|---|
| Manifest | `appName`, `appDesc`, `actionTitle`, `offscreenJustification` |
| Popup — header/status | `popupSubtitle`, `statusReady`, `allowCamera`, `settingsTitle` |
| Popup — sliders | `cursorSpeed`, `smoothingLabel`, `scrollSpeedLabel`, `pinchClick`, `pinchRight`, `invertScrollLabel` |
| Popup — gesture legend | `legendCursor`, `legendClick`, `legendRight`, `legendScroll`, `legendPause` |
| Popup — start/stop/status | `startBtn`, `stopBtn`, `starting`, `stopping`, `runningMsg`, `stoppedMsg`, `opFailed`, `errorGeneric`, `permOpenedHint` |
| Camera permission page | `permDocTitle`, `permHeading`, `permBody`, `permAllowBtn`, `permHint`, `permRequesting`, `permGranted`, `permDenied`, `permNoCam`, `permInUse`, `permErrorPrefix` |
| On-page badge | `badgeNoHand`, `badgeScroll`, `badgePinchRight`, `badgePinch`, `badgeCursor`, `badgeReady` |
| Offscreen/model status | `statusLoading`, `camUnavailable`, `modelError`, `statusActive` |

> **Note**: the on-page context menu entries introduced in `content.js`
> (Back, Forward, Reload, Copy, Paste, Select all, Open link, Copy link,
> Chrome menu, Close) are currently **hardcoded Italian strings** in
> `content.js` (`showContextMenu`), not yet routed through
> `chrome.i18n.getMessage()` nor present in `_locales/*/messages.json`. Worth
> keeping in mind if full localization of this new feature is desired.

## How to add a language

1. Copy `_locales/en/messages.json` into a new
   `_locales/<lang>/messages.json` folder.
2. Translate every `message` value, keeping all keys **identical**.
3. Add `<lang>` to `SUPPORTED_LANGS` in `i18n.js`.
4. (Optional, to fully complete localization) also translate the context menu
   entries in `content.js`, moving them into `_locales/*/messages.json` and
   calling them via `chrome.i18n.getMessage()`.
