# Installation and usage

## Installation (developer mode)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the project folder (`hand-navigation-extension`).
5. Click the ✋ icon in the toolbar to open the popup.

## First run — camera permission

The native `getUserMedia` prompt **doesn't work inside the popup**: the popup
closes as soon as the prompt takes focus, interrupting the request. Because
of this:

1. In the popup, press **🎥 Allow camera** (`allowCamera`).
2. A dedicated tab opens (`permission.html`) where the prompt can be
   confirmed correctly.
3. Press **Allow camera** on the page, then confirm the browser's prompt: a
   brief video preview is shown as confirmation, after which the webcam is
   released (it was only needed to register the permission).
4. The permission is granted on the **extension's origin**, so it applies to
   any site visited afterwards (unlike a per-site permission).

## Everyday use

1. Open a normal site (it doesn't work on `chrome://`, `edge://`, `about:`,
   `devtools://`, `view-source:` pages, or on other extension pages).
2. In the popup, press **▶︎ Start**.
3. Put your hand in front of the webcam and use the gestures (see
   [gestures-and-interactions.md](gestures-and-interactions.md)).
4. Press **⏹ Stop** to stop: closes the offscreen document, hides the
   overlay on the controlled tab and detaches the debugger (makes the yellow
   debugging bar disappear, if it had appeared for a right-click).

While the extension is active, control **follows the tab you're looking
at**: switching tabs or windows automatically moves the overlay to the new
active tab (if it's a controllable page).

## Calibration (⚙︎ Sensitivity menu in the popup)

See the full detail of every parameter (range, default, where it's applied)
in [settings.md](settings.md). In short:

- **Cursor speed** — how much the hand movement is amplified.
- **Smoothness (smoothing)** — higher = more stable cursor but less
  responsive.
- **Scroll speed** — scroll multiplier.
- **Pinch sensitivity (click)** — how easily the left click triggers.
- **Pinch sensitivity (right-click)** — how easily the context menu
  (thumb+middle) opens.
- **Invert scroll** — flips the up/down direction.

Changes are saved automatically (150ms debounce) and applied live, without
needing to press Start again.

## Practical tips

- The first launch loads the model (~7.6 MB) from the extension's local
  folder: no CDN connection, works offline too.
- Hands-free control takes some practice: start with a well-lit hand about
  50 cm from the webcam, then adjust the sliders.
- If the native right-click doesn't respond, check that DevTools isn't
  already open on the same tab and that the page isn't protected
  (`chrome://`, Chrome Web Store, etc.) — `chrome.debugger` can't attach in
  those cases.
