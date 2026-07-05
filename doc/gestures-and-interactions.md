# Gestures and interactions

## Gesture table

| Gesture | Action |
|-------|--------|
| ☝️ Index finger only extended | Moves the virtual **cursor** |
| 🤏 Pinch (thumb + index) | **Left click** at the cursor point |
| 🖱 Pinch (thumb + middle) | Opens the extension's **on-page context menu** |
| ✋ Open hand (palm) | **Scroll** up/down, with inertia (a "flick" keeps gliding and fades out) |
| ✊ Closed fist | **Pause** (no finger is extended → `idle` mode, no action) |

> ℹ️ The thumb+middle pinch no longer opens Chrome's native context menu
> directly: it opens a **context menu drawn by the extension** on the page
> (see below). From that menu you can still request the native menu via the
> **"Chrome menu"** entry, which uses `chrome.debugger` to inject a real
> browser-level right-click (hence the yellow debugging bar described in
> [architecture.md](architecture.md)).

## Gesture recognition (`offscreen.js` → `analyze`)

Recognition works on the 21 hand landmarks returned by MediaPipe
HandLandmarker for each frame.

1. **Hand reference length**: distance wrist→middle-finger knuckle
   (`lm[0]` → `lm[9]`), used to normalize all other distances relative to the
   hand's size/distance from the camera.
2. **Extended fingers** (`fingerExtended`): a finger (index, middle, ring,
   pinky) is considered extended if its tip is farther from the wrist than
   its proximal knuckle (PIP) by a factor of `1.05` — robust with respect to
   hand orientation.
3. **Pinch ratios**:
   - `pinchRatio = dist(thumb, index) / handLen` → left click;
   - `rightPinchRatio = dist(thumb, middle) / handLen` → opens the context
     menu (still requires the index to be extended, so the cursor keeps
     pointing with the index tip while the middle finger touches the thumb).
4. **Exclusivity between the two pinches**: if both ratios are below
   threshold, the finger clearly closer to the thumb is chosen (dominance
   margin `0.035`); otherwise it waits for a clearer frame instead of firing
   the wrong click.
5. **Mode** (`mode`):
   - `scroll` if all four fingers (index…pinky) are extended (open palm);
   - `cursor` if a pinch is active or only the index is extended
     (`pointing`);
   - `idle` otherwise (e.g. closed fist).
6. **Tracked point**: middle-finger knuckle (`lm[9]`) in scroll mode (more
   stable for a wide vertical movement), index fingertip (`lm[8]`) in cursor
   mode. The X axis is mirrored (`1 - x`) for the selfie view.

## Click debounce and hysteresis (`updatePinchState`)

To avoid accidental clicks or jitter at the threshold edge, each pinch (left
and right) has a small independent state machine:

- **Release threshold wider than the press threshold**
  (`pinchReleaseMargin = 0.08`): once a pinch is detected, the ratio must rise
  above `threshold + margin` to be considered released — prevents small
  oscillations from generating multiple clicks from the same pinch.
- **Minimum confirmation frames** (`minPinchFrames = 2`): the pinch must be
  detected for at least 2 consecutive frames before triggering the click,
  filtering out false positives from a single noisy frame.
- **Cooldown** (`clickCooldownMs = 450`): minimum time between two clicks of
  the same type, independent of the pinch release.
- The two pinches (click and menu) are made **mutually exclusive** even at
  the state-machine level (`leftActive`/`rightActive` check that the other
  pinch isn't in progress).

## Virtual cursor (`content.js`)

- **Smoothing of the normalized point** received from MediaPipe: exponential
  moving average with factor `a = 1 - smoothing` (user parameter), applied
  before mapping to pixels.
- **Centered amplification (gain)**: `nx = (smoothed - 0.5) * cursorGain +
  0.5`, then clamped to `[0,1]` — a small hand movement near the center
  produces a wider on-screen displacement.
- **Visual interpolation**: the DOM cursor (`posX/posY`) chases the target
  (`targetX/targetY`) with a second, independent exponential smoothing,
  updated on every `requestAnimationFrame` (so smoother than MediaPipe's
  ~30fps).
- **Snap on click**: when a click/right-click event arrives, the cursor snaps
  instantly to the target (`snapCursorToTarget`) before performing the
  action, for maximum precision.

## Synthetic click (`clickAt`)

Dispatches, on the element under the cursor
(`document.elementFromPoint`), the entire sequence of events a real click
generates, for compatibility both with classic `mouse*` listeners and
`pointer*` listeners (modern frameworks):

```
pointerover → pointerenter → mouseover → mouseenter → pointermove → mousemove
→ pointerdown → mousedown → (focuses the element, if possible)
→ pointerup → mouseup → click
```

The click also triggers a visual feedback (`handnav-click-pulse` class, a
pulsing blue glow on the cursor).

## On-page context menu (`showContextMenu` / `contextAction`)

Triggered by the thumb+middle pinch gesture (right-click). It's a menu drawn
by the extension (`#handnav-menu` in `content.css`, styled consistently with
`DESIGN.md`), positioned next to the cursor and kept within the window
bounds.

Available entries (currently hardcoded in Italian in the code, not yet
translated via `chrome.i18n`):

| Entry (source string) | Action (`contextAction`) | Notes |
|------|---------------------------|------|
| Indietro (Back) | `back` | `chrome.tabs.goBack` (handled by the background) |
| Avanti (Forward) | `forward` | `chrome.tabs.goForward` |
| Ricarica (Reload) | `reload` | `chrome.tabs.reload` |
| Copia (Copy) | `copy` | `document.execCommand('copy')` on the current selection; disabled if there's no selection |
| Incolla (Paste) | `paste` | `document.execCommand('paste')` |
| Seleziona tutto (Select all) | `selectAll` | `document.execCommand('selectAll')` |
| Apri link (Open link) *(only if the cursor is over a link)* | `openUrl` | Opens the URL in a new active tab |
| Copia link (Copy link) *(only if the cursor is over a link)* | `copyText` | Copies the URL using a temporary `<textarea>` |
| Menu Chrome (Chrome menu) | `nativeRightClick` | Asks the background for the native right-click via `chrome.debugger` |
| Chiudi (Close) | `closeMenu` | Closes the menu without performing any action |

**Selecting an entry with the cursor** (`activateMenuItemAtCursor`, called
when a *click* gesture arrives while the menu is open):

1. Looks for the `.handnav-menu-item` element exactly under the cursor
   (`elementFromPoint`);
2. if none is found but the cursor is still within a 24px margin of the menu
   box, picks the entry whose vertical center is closest to the cursor
   (within 28px) — makes it easier to "hit" an entry without perfectly
   precise pointing;
3. if an entry is found, simulates a DOM click on it.

The menu closes automatically when the overlay is hidden, when switching to
scroll mode, or when any entry is executed.

## Scroll with inertia (`applyScroll` / `endScroll`)

- While the hand is in *open palm* mode, the target scroll velocity is
  proportional to the normalized vertical delta between frames
  (`scrollSpeed` and window height), with a **deadzone**
  (`scrollDeadzone = 0.008`) to ignore micro-jitter when the hand is still.
- The actual velocity (`scrollVel`) chases the target with exponential
  smoothing (`SCROLL_RESPONSIVENESS = 0.4`), softening start and stop.
- **Inertia on release**: if the velocity was above a minimum threshold at
  release time, the scroll keeps going on its own with friction
  (`friction = 0.92` per frame at ~60fps) until it drops below
  `minVel = 0.4` — a trackpad "flick" effect.
- `settings.invertScroll` simply flips the sign of the direction.

## Status badge

The badge (`#handnav-badge`) always shows the current mode via localized
messages (`chrome.i18n.getMessage`): `badgeNoHand`, `badgeScroll`,
`badgePinchRight`, `badgePinch`, `badgeCursor`, `badgeReady`.
