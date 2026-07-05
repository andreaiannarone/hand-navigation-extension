# Calibration settings

All settings are saved in `chrome.storage.local.settings` and propagated live
to `offscreen.js` (pinch thresholds) and `content.js` (cursor/scroll) via the
`UPDATE_SETTINGS` → `SETTINGS` message, without needing to press Start again.

## Sliders exposed in the popup (`popup.html`)

| Setting | Key | Min | Max | Step | Default | Where it's applied |
|---|---|---|---|---|---|---|
| Cursor speed | `cursorGain` | `1` | `3` | `0.1` | `1.6` | `content.js` — amplifies the hand movement around the center |
| Smoothness (smoothing) | `smoothing` | `0` | `0.9` | `0.05` | `0.72` | `content.js` — moving average of the normalized point; higher = more stable but less responsive |
| Scroll speed | `scrollSpeed` | `0.5` | `3` | `0.1` | `1.4` | `content.js` — scroll multiplier |
| Pinch sensitivity (click) | `pinchThreshold` | `0.2` | `0.5` | `0.02` | `0.32` | `offscreen.js` — thumb–index ratio threshold below which the click fires |
| Pinch sensitivity (right-click) | `rightPinchThreshold` | `0.2` | `0.5` | `0.02` | `0.32` | `offscreen.js` — thumb–middle ratio threshold for the context menu |
| Invert scroll direction | `invertScroll` | — | — | — | `false` | `content.js` — flips the sign of the scroll velocity |

> Note: **lower** pinch thresholds require the fingers to be closer together
> (a tighter pinch) to trigger the click → less sensitive / fewer false
> positives. Higher thresholds make the click easier to trigger but more
> prone to accidental activation.

## Internal parameters not exposed in the popup

Present in the code but not adjustable by the user (would require a code
change to modify):

| Parameter | Value | File | Meaning |
|---|---|---|---|
| `scrollDeadzone` | `0.008` | `content.js` | Anti-jitter deadzone on the normalized scroll delta |
| `clickCooldownMs` | `450` | `offscreen.js` | Minimum time between two clicks of the same type |
| `pinchReleaseMargin` | `0.08` | `offscreen.js` | Hysteresis: release threshold = press threshold + margin |
| `minPinchFrames` | `2` | `offscreen.js` | Minimum consecutive frames to confirm a pinch |
| `dominance` | `0.035` | `offscreen.js` | Margin to decide which pinch (click/menu) wins if both are active |
| `SCROLL_RESPONSIVENESS` | `0.4` | `content.js` | Smoothing of the scroll velocity (0=still, 1=no smoothing) |
| Scroll inertia friction | `0.92`/frame, min threshold `0.4` | `content.js` | Decay of the scroll velocity after release ("flick") |
| Visual cursor smoothing factor | `0.45` (frame-time adjusted) | `content.js` | Interpolation of the DOM cursor toward the target on every `requestAnimationFrame` |
| `numHands` | `1` | `offscreen.js` | MediaPipe tracks a single hand |
| MediaPipe confidence thresholds | `0.65` | `offscreen.js` | `minHandDetectionConfidence`/`minHandPresenceConfidence`/`minTrackingConfidence` |
| Webcam resolution | `640×480` | `offscreen.js` | `getUserMedia` |

## Centralized default values

Defaults are duplicated in three places in the code and must stay consistent:

- `popup.js` → `DEFAULT_SETTINGS` (used to populate the sliders on first run
  and as a fallback if `chrome.storage.local` doesn't yet have a `settings`
  object);
- `content.js` → initial `settings` object (used until the first
  `SHOW_OVERLAY`/`SETTINGS` with the real values arrives);
- `offscreen.js` → `defaultSettings()` (used as a base on every `START`/
  `SETTINGS`, merged with whatever is received from the background).

If you add a new setting, add it in all three places (plus the corresponding
slider in `popup.html` and the related `data-i18n` entry if a new label is
needed).
