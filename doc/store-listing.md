# Chrome Web Store listing — draft copy

Draft text ready to paste into the Chrome Web Store Developer Dashboard when
submitting **Hand Navigation**. Adjust names/links (the placeholder e-mail is
`hello@andreaiannarone.com`, taken from [`../PRIVACY.md`](../PRIVACY.md)) before
publishing.

## Single purpose (required field)

> Navigate and control web pages using hand gestures captured by the
> webcam (move the cursor, click, right-click, and scroll), as an
> accessibility- and convenience-oriented, hands-free input method.

## Short description (max 132 characters)

> Navigate the web with hand gestures: move the cursor, click, right‑click
> and scroll — hands‑free, 100% on‑device.

(131 characters)

## Detailed description

> **Hand Navigation** lets you control web pages with hand gestures captured
> by your webcam — no mouse, no trackpad, no keyboard.
>
> Powered by Google's MediaPipe HandLandmarker, running **entirely on your
> device**: no video, image, or hand-tracking data ever leaves your
> computer, and no cloud service is involved.
>
> **Gestures**
> ☝️ Index finger only — move the cursor
> 🤏 Pinch (thumb + index) — click
> 🖱 Pinch (thumb + middle) — open the context menu (back, forward, reload,
> copy, paste, select all, open/copy link, or Chrome's native right-click
> menu)
> ✋ Open hand — scroll up/down, with natural inertia
> ✊ Closed fist — pause
>
> **Built for real use**
> - Adjustable cursor speed, smoothing, scroll speed and pinch sensitivity,
>   so you can tune it to your hand and your webcam.
> - Works on virtually any website, and automatically follows the tab you
>   switch to.
> - Fully offline after installation: the hand-tracking model is bundled
>   with the extension, no internet connection required to run it.
> - Available in English, Italian, Spanish, French, German, Polish and
>   Portuguese, following your browser's language automatically.
>
> **Privacy first**
> Your webcam feed is processed locally, frame by frame, and never
> recorded, stored, or transmitted anywhere. See the full privacy policy
> for details.
>
> **Note on the right-click menu**: opening the browser's native context
> menu from a gesture requires briefly attaching Chrome's debugger to the
> active tab, which is why you may see Chrome's "this extension is
> debugging this browser" notice while the extension is running — it
> disappears as soon as you press Stop.

## Category

**Accessibility** (alternative: Productivity)

## Language of the listing

English (`en`) as primary; you can duplicate the listing in Italian (`it`)
using the Italian strings from `_locales/it/messages.json` as a base if you
want an Italian storefront page too.

## Privacy practices tab

- **Privacy policy URL**: publish [`../PRIVACY.md`](../PRIVACY.md) somewhere
  publicly reachable (see options below) and paste that URL here.
- **Single purpose**: reuse the text above.
- **Permission justifications** — paste one of these per permission
  requested in the dashboard:

  - **`debugger`**: "Used solely to dispatch a native right-click mouse
    event via the Chrome DevTools Protocol, so a hand gesture can open
    Chrome's own context menu. No inspection, logging, or transmission of
    page content, network traffic, or any other data occurs. The debugger
    is attached only while the extension is actively running and is
    detached immediately when the user presses Stop."
  - **Host permission (`<all_urls>`) / `activeTab` / `scripting`**: "The
    extension draws a virtual cursor and overlay, and dispatches
    clicks/scroll/context-menu actions, on whatever page the user is
    currently viewing. Since the user can navigate to any website while
    using hand gestures, the content script and overlay must be able to run
    on any site the user visits; `scripting` is used only to (re)inject the
    overlay into tabs that were already open before the extension started."
  - **`storage`**: "Stores the user's calibration settings (cursor speed,
    smoothing, scroll speed, pinch sensitivity, invert-scroll) and the
    on/off state locally on-device, so preferences persist across
    browser/service-worker restarts."
  - **`offscreen`**: "Hosts the webcam capture and on-device MediaPipe
    hand-tracking inference in a hidden offscreen document, since the
    extension's background service worker cannot access camera/media
    devices directly."
  - **Camera access**: "Captures live webcam video, analyzed frame-by-frame
    on-device to detect hand position and gestures. No frame is ever saved,
    recorded, or transmitted; nothing leaves the user's device."

- **Are you using remote code?** → **No** — all code (including the
  MediaPipe/WASM bundle in `vendor/`) ships inside the extension package;
  nothing is fetched from a remote server at runtime.
- **Data collection disclosures**: for "Camera" toggle, declare it as
  collected-but-*not*-stored/transmitted, used only for the extension's core
  functionality, not sold or used for advertising, and not transferred to
  third parties — matching what's described in `PRIVACY.md`.

## Where to host `PRIVACY.md` publicly

Pick one (all free):

1. **GitHub Pages**: enable Pages for this repo (Settings → Pages → branch
   `main`, folder `/`) and link
   `https://andreaiannarone.github.io/hand-navigation-extension/PRIVACY.html`
   — requires renaming/rendering the file as HTML or adding a minimal Jekyll
   config; simplest is `docs/privacy.html`.
2. **GitHub raw/blob URL** (fastest, zero setup): the rendered file at
   `https://github.com/andreaiannarone/hand-navigation-extension/blob/main/PRIVACY.md`
   is an acceptable "publicly accessible page" for most reviewers, though a
   dedicated web page is generally viewed more favorably.
3. Any free static host you already use (Notion public page, Google Sites,
   your own domain, etc.) — just copy the Markdown content over as plain
   text/HTML.

## Assets still needed before submitting

- **Screenshots**: at least 1, 1280×800 or 640×400 px, showing the popup
  and/or the on-page overlay in action.
- **Store icon**: already available at `icons/icon128.png` (128×128, matches
  the store's requirement).
- **Small promo tile** (440×280, optional but recommended) and **marquee**
  (1400×560, optional) — not required to publish, only if you want featured
  placement.

## Packaging

The zip ready for upload (manifest at its root, dev-only files like
`doc/`, `DESIGN.md`, `.gitignore` excluded) was generated in the scratchpad
during this session. Rebuild it any time with:

```sh
git ls-files \
  | grep -v -E '^(DESIGN\.md|README\.md|\.gitignore|doc/)' \
  | zip -X hand-navigation-extension.zip -@
```

(run from the repository root; `LICENSE` and `PRIVACY.md` are included on
purpose — the latter is optional to ship inside the package, since only the
publicly hosted URL matters to the Store).
