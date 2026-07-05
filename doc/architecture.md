# Architecture

The extension is built on **Manifest V3** and consists of five separate
execution contexts that communicate via `chrome.runtime.sendMessage` /
`chrome.tabs.sendMessage`.

```
┌─────────────┐      START/STOP/SETTINGS      ┌───────────────────┐
│   popup.js   │ ───────────────────────────▶ │   background.js    │
│ (control UI) │ ◀─────────────────────────── │ (service worker)   │
└─────────────┘        STATUS (state)          └─────────┬─────────┘
                                                          │ START/STOP/SETTINGS
                                                          ▼
                                                ┌───────────────────┐
                                                │   offscreen.js     │
                                                │ webcam + MediaPipe │
                                                └─────────┬─────────┘
                                                          │ HAND (gesture payload)
                                                          ▼
                                                ┌───────────────────┐
                                                │  background.js     │  forwards to the
                                                │  (message router)   │  controlled tab
                                                └─────────┬─────────┘
                                                          │ HAND / SHOW_OVERLAY / SETTINGS
                                                          ▼
                                                ┌───────────────────┐
                                                │   content.js/css   │
                                                │ cursor, clicks,     │
                                                │ scroll, context menu│
                                                └───────────────────┘
```

## Components

### `background.js` — service worker (central hub)

Has no UI: routes messages between popup, offscreen and content script, and
manages global state.

- **Offscreen document management** (`ensureOffscreen`/`closeOffscreen`):
  creates/closes `offscreen.html` with the `USER_MEDIA` justification,
  first checking whether an offscreen context already exists
  (`chrome.runtime.getContexts`, with a fallback to
  `chrome.offscreen.hasDocument()`).
- **Native right-click via `chrome.debugger`**: a web page cannot open
  Chrome's native context menu. To do this, the background "attaches" to the
  tab (`chrome.debugger.attach`) and sends a real browser-level mouse event
  via CDP (`Input.dispatchMouseEvent`, `right` button). The debugger stays
  attached to **one tab at a time** (`attachedTabId`); if the user closes the
  debugging bar or navigates, `chrome.debugger.onDetach` resets the state.
  Unavoidable side effect: the yellow *"…is debugging this browser"* bar,
  visible until **Stop** is pressed (`detachDebugger()`).
- **Content script injection**: if the tab was already open before the
  extension was installed/started, the content script declared in the
  manifest isn't present. `ensureContentScript` tries a `PING`; if it fails,
  it injects `content.css`/`content.js` with `chrome.scripting`.
- **Message router** (`chrome.runtime.onMessage`): dispatches messages based
  on the sender (`msg.from`):
  - `offscreen` → `HAND` (forwarded to the controlled tab if `running`) and
    `STATUS` (propagated to the popup, camera error handling).
  - `content` → `RIGHT_CLICK` (triggers the native right-click via CDP) and
    `CONTEXT_ACTION` (navigation actions: back/forward/reload/openUrl).
  - `popup` → `START`, `STOP`, `UPDATE_SETTINGS`, `GET_STATE`.
- **Camera error handling** (`handleOffscreenError`): if the offscreen
  reports `NotAllowedError`/`PermissionDeniedError`, stops everything and
  opens `permission.html` in a new tab (with a 3s debounce to avoid multiple
  tabs if the user presses Start repeatedly).
- **Following the active tab** (`retarget`): while the extension is running,
  the cursor must control the tab the user is actually looking at, not the
  one where Start was pressed. Listens to:
  - `chrome.tabs.onActivated` — active tab change within the same window;
  - `chrome.windows.onFocusChanged` — foreground window change;
  - `chrome.tabs.onUpdated` (status `complete`) — reactivates the overlay
    after a reload/navigation (the content script gets re-injected by the
    manifest but the overlay starts off);
  - `chrome.tabs.onRemoved` — if the controlled tab is closed, frees the
    reference without stopping recognition, waiting for the user to activate
    another tab.
  - System pages (`chrome|edge|about|chrome-extension|devtools|
    view-source:`) aren't controllable: the overlay is hidden and the
    extension waits for the user to return to a normal page.
- **State persistence**: the MV3 service worker can be terminated after a few
  seconds of inactivity, losing the in-memory variables (`running`,
  `targetTabId`). For this reason the state is always saved/re-read from
  `chrome.storage.local` (`running`, `targetTabId`, `settings`): on every
  worker "spin-up", the top-level code re-reads the saved state.

### `offscreen.js` — webcam + gesture recognition

Runs inside `offscreen.html`, an invisible document that can access
`getUserMedia` (not allowed in service workers).

- **MediaPipe initialization** (`initLandmarker`): loads
  `FilesetResolver`/`HandLandmarker` from the local bundle in
  `vendor/tasks-vision/`, with `GPU` delegate and automatic fallback to `CPU`
  if the GPU isn't available in the offscreen context. Parameters:
  `numHands: 1`, confidence thresholds `0.65`.
- **Webcam** (`startCamera`/`stopCamera`): `getUserMedia({video:{640×480,
  facingMode:'user'}})`; on error sends a `STATUS` of type `error` with the
  code (`NotAllowedError`, etc.) that the background intercepts to open
  `permission.html`.
- **Detection loop** (`loop`): uses a `setTimeout` timer at ~30 fps
  (`FRAME_MS = 33`) because `requestAnimationFrame` is **never** called in
  offscreen documents (they are never rendered). On each frame it calls
  `handLandmarker.detectForVideo` and avoids reprocessing the same video
  frame (`lastVideoTime`).
- **Landmark analysis** (`analyze`) and **pinch state with hysteresis**
  (`updatePinchState`): see
  [gestures-and-interactions.md](gestures-and-interactions.md) for the
  algorithm details.
- **Messages**: receives `START`/`STOP`/`SETTINGS` from the background
  (filtering on `msg.target === 'offscreen'`); sends `HAND` (gesture payload
  for each frame) and `STATUS` (loading/ready/error/stopped).

### `content.js` / `content.css` — on-page overlay

Injected on `<all_urls>` at `document_idle` (declared in the manifest, with a
manual backup injection from `background.js` for already-open tabs). Uses a
`window.__handNavLoaded` guard to avoid double initialization.

- **Virtual cursor** (`#handnav-cursor`): position animated with
  `requestAnimationFrame` and exponential smoothing (`startCursorLoop`), to
  stay fluid even between one MediaPipe frame (~30fps) and the next (~60fps).
- **Status badge** (`#handnav-badge`): pill at the bottom-left showing the
  current mode (cursor, pinch, scroll, no hand).
- **On-page context menu** (`#handnav-menu`): shown by the thumb+middle pinch
  gesture (right-click), with navigation and editing entries; see
  [gestures-and-interactions.md](gestures-and-interactions.md).
- **Synthetic clicks** (`clickAt`): dispatches a full sequence of
  Pointer/Mouse events (`pointerover→…→click`) on the element under the
  cursor via `document.elementFromPoint`, to be compatible both with native
  listeners and with frameworks that listen for Pointer events.
- **Scroll with inertia** (`applyScroll`/`endScroll`): converts the vertical
  hand movement (*open palm* mode) into `window.scrollBy`, with exponential
  smoothing while the hand is active and a "flick" effect (friction decay) on
  release.
- **Messages received**: `PING` (health-check), `SHOW_OVERLAY`/`HIDE_OVERLAY`
  (enables/disables the overlay and resets local state), `HAND` (gesture data
  for the current frame), `SETTINGS` (live update of calibration parameters).
- **Messages sent**: `RIGHT_CLICK` (request for a native right-click via CDP)
  and `CONTEXT_ACTION` (navigation actions handled by the background).

### `popup.html/.css/.js` — control panel

UI opened from the toolbar icon. Handles:

- the ON/OFF state (`toggleBtn` → `START`/`STOP` messages to the background,
  updating the label and the `running` class);
- opening the dedicated camera-permission page (the native prompt **doesn't
  work inside the popup**, because the popup closes when the prompt takes
  focus — hence `permission.html` opens in a tab);
- the sensitivity sliders (see [settings.md](settings.md)), saved with a
  150ms debounce and propagated both to the offscreen document and to the
  controlled tab via `UPDATE_SETTINGS`;
- receiving status updates (`STATUS`) from the background to show messages
  (model loading, errors, "running", etc.).

### `permission.html/.js` — camera permission grant

Minimal page opened in a normal tab (not a popup), where the `getUserMedia`
prompt can be confirmed without the context closing. After confirmation it
shows a video preview for 1.5s as visual confirmation, then releases the
webcam: it only serves to **register the permission** on the extension's
origin (permission granted once, valid on every site).

### `i18n.js`

Applies `chrome.i18n` translations to the static pages (`popup.html`,
`permission.html`) via `data-i18n` / `data-i18n-html` / `data-i18n-title`
attributes, and syncs `<html lang>` with the language Chrome actually used
(falling back to `en` if the browser's language isn't among the supported
ones). See [localization.md](localization.md).

## Persisted state (`chrome.storage.local`)

| Key | Type | Written by | Use |
|--------|------|-----------|-----|
| `running` | `boolean` | `background.js` | Recognition running/stopped, re-read on every service worker restart |
| `targetTabId` | `number \| null` | `background.js` | Tab currently controlled by gestures |
| `settings` | `object` | `popup.js` | Current calibration parameters (see [settings.md](settings.md)) |

## Content Security Policy

`manifest.json` sets `script-src 'self' 'wasm-unsafe-eval'; object-src
'self'` for the extension pages, needed because MediaPipe Tasks Vision runs
WebAssembly code.
