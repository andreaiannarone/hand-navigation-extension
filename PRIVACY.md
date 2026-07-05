# Privacy Policy — Hand Navigation

*Last updated: 2026-07-05*

**Hand Navigation** ("the extension") lets you navigate web pages using hand
gestures captured by your webcam. This page explains what data the extension
accesses and, more importantly, what it does **not** do with it.

## What the extension accesses

- **Webcam video**: used only to detect the position and shape of your hand
  (via the on-device MediaPipe HandLandmarker model) in order to move a
  virtual cursor, click, scroll, and open a context menu on the page you're
  viewing.
- **The active tab's content**, to the extent needed to move the cursor,
  dispatch clicks, scroll, and show the on-page overlay.

## What the extension does NOT do

- It does **not** record, store, or save any video or image from your
  webcam. Frames are analyzed in memory, frame by frame, and discarded
  immediately.
- It does **not** send any video, image, or derived data to any server. All
  hand-tracking inference runs **entirely on your device**, using a
  model bundled with the extension — there is no network request to any
  external service, CDN, or analytics/tracking provider.
- It does **not** collect, transmit, or sell any personal or browsing data.
- It does **not** use cookies or any remote tracking mechanism.

## Local settings storage

Your calibration preferences (cursor speed, smoothing, scroll speed, pinch
sensitivity, invert-scroll) and the extension's on/off state are saved
locally on your device using the browser's extension storage
(`chrome.storage.local`). This data never leaves your device and is not
accessible to us or to any third party.

## Permissions used and why

| Permission | Purpose |
|---|---|
| Camera (via the browser's media permission prompt) | Capture video frames to recognize hand gestures, processed locally. |
| `storage` | Save your calibration settings and on/off state locally on your device. |
| `offscreen` | Run the webcam capture and gesture recognition in a hidden document, since this isn't possible from the extension's background service worker. |
| `scripting` | Show the virtual cursor/overlay on pages that were already open before the extension started. |
| `activeTab` / host access on all sites | Let the virtual cursor, clicks, scroll, and context menu work on whatever page you're currently viewing. |
| `debugger` | Used exclusively to send a native right-click event to Chrome (via the DevTools Protocol) so the browser's own context menu can be opened by a hand gesture. It is never used to inspect, log, or transmit page content, network traffic, or any other data. It is detached automatically as soon as you press Stop. |

## Third-party components

The extension bundles the following local components, which run entirely
on-device and do not communicate with any server:

- **MediaPipe Tasks Vision** and the `hand_landmarker.task` model — © Google,
  [Apache-2.0 license](https://www.apache.org/licenses/LICENSE-2.0).
- **Play font** — © Jonas Hecksher,
  [SIL Open Font License 1.1](https://openfontlicense.org).

## Changes to this policy

If this policy is updated, the "Last updated" date at the top of this page
will change accordingly.

## Contact

Questions about this policy or the extension can be sent to:
**hello@andreaiannarone.com**
