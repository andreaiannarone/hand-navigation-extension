# Permissions and privacy

## Permissions declared in `manifest.json`

```json
"permissions": ["offscreen", "storage", "scripting", "activeTab", "debugger"],
"host_permissions": ["<all_urls>"]
```

| Permission | Why it's needed |
|---|---|
| `offscreen` | Create `offscreen.html`, the only context where the extension can access `getUserMedia` (webcam) outside of a visible tab, needed because the MV3 service worker has no access to the DOM/media devices. |
| `storage` | Persist `running`, `targetTabId` and `settings` in `chrome.storage.local`, essential because the service worker can be terminated and restarted at any time (see [architecture.md](architecture.md)). |
| `scripting` | Manually inject `content.js`/`content.css` into tabs that were already open before the extension was installed/started (where the manifest-declared content script isn't present yet). |
| `activeTab` | Base permission to interact with the active tab on the user's request (Start from the popup). |
| `debugger` | Attach to the controlled tab via the Chrome DevTools Protocol to inject a real right-click event (`Input.dispatchMouseEvent`) and open Chrome's **native** context menu when requested from the on-page menu ("Chrome menu"). This causes the yellow *"…is debugging this browser"* bar to appear until Stop is pressed — an unavoidable side effect of this approach, not a bug. |
| `host_permissions: <all_urls>` | The content script and overlay must work on any site visited while the extension is active. |

## Content Security Policy

```json
"content_security_policy": {
  "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
}
```

`'wasm-unsafe-eval'` is required because MediaPipe Tasks Vision runs the
inference engine as a WebAssembly module loaded locally from
`vendor/tasks-vision/`.

## Privacy and offline behavior

- **No calls to any CDN or external server**: the MediaPipe Tasks Vision
  bundle and the `hand_landmarker.task` model (~7.6 MB) are bundled locally
  under `vendor/` and loaded with `chrome.runtime.getURL(...)`. Video
  analysis happens entirely locally, in the browser.
- **Camera permission granted only once**, on the extension's origin
  (`chrome-extension://…`), not per site: this avoids having to
  re-authorize the webcam on every visited domain, but it also means that
  once granted, the permission stays valid for the whole browsing session
  until the user revokes it from `chrome://extensions`.
- **No biometric data or video is ever saved or sent**: webcam frames are
  processed frame-by-frame in the offscreen document and not persisted; only
  the synthetic gesture payload (`mode`, normalized coordinates, click flags)
  is forwarded to the controlled tab.
- **`chrome.debugger`** grants access to the Chrome DevTools Protocol on the
  attached tab: in the code it is used **exclusively** to send synthetic
  mouse events (`Input.dispatchMouseEvent`) and is detached immediately when
  Stop is pressed or when the tab changes/navigates
  (`chrome.debugger.onDetach`). No network, DOM or storage data from the site
  is read via CDP.

## Web accessible resources

```json
"web_accessible_resources": [
  { "resources": ["vendor/*", "offscreen.html"], "matches": ["<all_urls>"] }
]
```

Needed because `offscreen.js` (running in the offscreen document's context,
not in a web page) must be able to load the MediaPipe bundle files
(`vendor/tasks-vision/...`, `vendor/hand_landmarker.task`) via extension
URLs.

## Third-party component licenses (`vendor/`)

- **MediaPipe Tasks Vision** and the `hand_landmarker.task` model — © Google,
  licensed under [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0).
- **Play font** — © Jonas Hecksher, licensed under
  [SIL Open Font License 1.1](https://openfontlicense.org).

The extension itself is released under the **MIT** license (see
[`../LICENSE`](../LICENSE)).
