// Service worker: coordinates offscreen (webcam + MediaPipe), popup and content script.

const OFFSCREEN_PATH = 'offscreen.html';
const PERMISSION_PATH = 'permission.html';

// Tab currently controlled by the gestures (set when Start is pressed in the popup).
let targetTabId = null;
let running = false;
let permissionTabOpenedAt = 0;

// MV3: the service worker can be terminated after a few seconds of inactivity and
// restarted on the next message, losing the variables above. Without this
// restore, after a restart the HAND messages would be discarded (running=false /
// targetTabId=null) and the cursor would stay still. We re-read the state from storage
// on every worker startup: this top-level code runs on every SW spin-up.
chrome.storage.local.get(['running', 'targetTabId']).then((d) => {
  running = !!d.running;
  if (typeof d.targetTabId === 'number') targetTabId = d.targetTabId;
});

// ---------------------------------------------------------------------------
// Offscreen document management
// ---------------------------------------------------------------------------
async function hasOffscreen() {
  // getContexts is the recommended method; fall back to hasDocument if unavailable.
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });
    return contexts.length > 0;
  }
  return await chrome.offscreen.hasDocument();
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['USER_MEDIA'],
    justification: chrome.i18n.getMessage('offscreenJustification'),
  });
}

async function closeOffscreen() {
  if (await hasOffscreen()) {
    await chrome.offscreen.closeDocument();
  }
}

// ---------------------------------------------------------------------------
// NATIVE right click via chrome.debugger (DevTools protocol)
// ---------------------------------------------------------------------------
// A web page cannot open Chrome's native context menu. We obtain it by
// injecting a real browser-level mouse event via CDP
// (Input.dispatchMouseEvent with the right button). This makes the yellow
// "…is debugging this browser" bar appear: it is unavoidable.
let attachedTabId = null;

function dbgAttach(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

function dbgDetach(tabId) {
  return new Promise((resolve) => {
    chrome.debugger.detach({ tabId }, () => { void chrome.runtime.lastError; resolve(); });
  });
}

function dbgSend(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (res) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(res);
    });
  });
}

async function ensureAttached(tabId) {
  if (attachedTabId === tabId) return;
  if (attachedTabId != null) { await dbgDetach(attachedTabId); attachedTabId = null; }
  await dbgAttach(tabId);
  attachedTabId = tabId;
}

async function detachDebugger() {
  if (attachedTabId != null) { await dbgDetach(attachedTabId); attachedTabId = null; }
}

async function nativeRightClick(tabId, x, y) {
  try {
    await ensureAttached(tabId);
  } catch (e) {
    console.warn('[HandNav] debugger.attach fallito (DevTools aperto o pagina protetta?):', e.message);
    return;
  }
  const btn = { x, y, button: 'right', buttons: 2, clickCount: 1 };
  try {
    await dbgSend(tabId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await dbgSend(tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', ...btn });
    await dbgSend(tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', ...btn });
  } catch (e) {
    console.warn('[HandNav] iniezione click destro fallita:', e.message);
  }
}

// If the user closes debugging (or the tab navigates), Chrome detaches us: reset.
chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId === attachedTabId) attachedTabId = null;
});

// ---------------------------------------------------------------------------
// Utility: ensure the content script is present in the tab
// ---------------------------------------------------------------------------
async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch (e) {
    // No response: the page was probably already open before the install.
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      return true;
    } catch (e2) {
      console.warn('[HandNav] Impossibile iniettare il content script:', e2.message);
      return false;
    }
  }
}

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return settings || {};
}

// ---------------------------------------------------------------------------
// Start / stop
// ---------------------------------------------------------------------------
async function start() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  await ensureOffscreen();
  const settings = await getSettings();

  // Start the recognition in the offscreen (independent of the tab).
  await chrome.runtime.sendMessage({ target: 'offscreen', type: 'START', settings });

  running = true;

  // Attach to the active tab if controllable; otherwise stay waiting:
  // the retarget will attach to the first normal tab the user goes to.
  const controllable = tab && tab.id &&
    !/^(chrome|edge|about|chrome-extension|devtools|view-source):/.test(tab.url || '');
  if (controllable && await ensureContentScript(tab.id)) {
    targetTabId = tab.id;
    await chrome.tabs.sendMessage(targetTabId, { type: 'SHOW_OVERLAY', settings }).catch(() => {});
  } else {
    targetTabId = null;
  }

  await chrome.storage.local.set({ running: true, targetTabId });
}

async function stop() {
  running = false;
  await chrome.storage.local.set({ running: false });
  try {
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP' });
  } catch (e) {}
  if (targetTabId != null) {
    try {
      await chrome.tabs.sendMessage(targetTabId, { type: 'HIDE_OVERLAY' });
    } catch (e) {}
  }
  await detachDebugger(); // detach the debugger → the yellow bar goes away
  await closeOffscreen();
}

async function handleOffscreenError(payload = {}) {
  if (!['NotAllowedError', 'PermissionDeniedError'].includes(payload.code)) return;

  running = false;
  await chrome.storage.local.set({ running: false });

  if (targetTabId != null) {
    chrome.tabs.sendMessage(targetTabId, { type: 'HIDE_OVERLAY' }).catch(() => {});
  }
  await detachDebugger();
  await closeOffscreen();

  // Avoid opening multiple permission tabs if the user presses Start repeatedly.
  const now = Date.now();
  if (now - permissionTabOpenedAt < 3000) return;
  permissionTabOpenedAt = now;
  chrome.tabs.create({ url: chrome.runtime.getURL(PERMISSION_PATH) }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Hand data coming from the offscreen → forward to the controlled tab.
  if (msg && msg.from === 'offscreen') {
    if (msg.type === 'HAND' && running && targetTabId != null) {
      chrome.tabs.sendMessage(targetTabId, { type: 'HAND', payload: msg.payload }).catch(() => {});
    } else if (msg.type === 'STATUS') {
      if (msg.payload && msg.payload.state === 'error') {
        handleOffscreenError(msg.payload).catch(() => {});
      }
      // Propagate status (e.g. camera ready / error) to the popup if open.
      chrome.runtime.sendMessage({ from: 'background', type: 'STATUS', payload: msg.payload }).catch(() => {});
    }
    return; // no asynchronous response needed
  }

  // Native right-click request from the content script.
  if (msg && msg.from === 'content' && msg.type === 'RIGHT_CLICK') {
    const tabId = sender.tab && sender.tab.id;
    if (running && tabId != null) nativeRightClick(tabId, msg.x, msg.y);
    return;
  }

  if (msg && msg.from === 'content' && msg.type === 'CONTEXT_ACTION') {
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null) return;

    if (msg.action === 'back') {
      chrome.tabs.goBack(tabId).catch(() => {});
    } else if (msg.action === 'forward') {
      chrome.tabs.goForward(tabId).catch(() => {});
    } else if (msg.action === 'reload') {
      chrome.tabs.reload(tabId).catch(() => {});
    } else if (msg.action === 'openUrl' && msg.data && msg.data.url) {
      chrome.tabs.create({ url: msg.data.url, active: true }).catch(() => {});
    }
    return;
  }

  // Commands from the popup.
  if (msg && msg.from === 'popup') {
    if (msg.type === 'START') {
      start().then(() => sendResponse({ ok: true }))
             .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true; // asynchronous response
    }
    if (msg.type === 'STOP') {
      stop().then(() => sendResponse({ ok: true }))
            .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg.type === 'UPDATE_SETTINGS') {
      chrome.storage.local.set({ settings: msg.settings }).then(() => {
        // Propagate to whoever is active.
        chrome.runtime.sendMessage({ target: 'offscreen', type: 'SETTINGS', settings: msg.settings }).catch(() => {});
        if (targetTabId != null) {
          chrome.tabs.sendMessage(targetTabId, { type: 'SETTINGS', settings: msg.settings }).catch(() => {});
        }
        sendResponse({ ok: true });
      });
      return true;
    }
    if (msg.type === 'GET_STATE') {
      sendResponse({ ok: true, running });
      return true;
    }
  }
});

// ---------------------------------------------------------------------------
// Follow the active tab: while the extension is running, the cursor must
// control the tab the user is actually looking at, not the one
// where Start was pressed.
// ---------------------------------------------------------------------------
const SYSTEM_PAGE = /^(chrome|edge|about|chrome-extension|devtools|view-source):/;

async function retarget(tabId) {
  if (!running || tabId == null || tabId === targetTabId) return;

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) {
    return; // tab no longer exists
  }

  const prev = targetTabId;

  // System page (not controllable): hide the overlay and stay waiting
  // for the user to return to a normal page.
  if (!tab || SYSTEM_PAGE.test(tab.url || '')) {
    if (prev != null) {
      chrome.tabs.sendMessage(prev, { type: 'HIDE_OVERLAY' }).catch(() => {});
    }
    targetTabId = null;
    await chrome.storage.local.set({ targetTabId: null });
    return;
  }

  // Hide the overlay on the previous tab.
  if (prev != null) {
    chrome.tabs.sendMessage(prev, { type: 'HIDE_OVERLAY' }).catch(() => {});
  }

  // Activate the overlay on the new tab.
  const settings = await getSettings();
  const ok = await ensureContentScript(tabId);
  if (!ok) return;
  await chrome.tabs.sendMessage(tabId, { type: 'SHOW_OVERLAY', settings }).catch(() => {});

  targetTabId = tabId;
  await chrome.storage.local.set({ targetTabId });
}

// Active tab change within the same window.
chrome.tabs.onActivated.addListener((info) => {
  retarget(info.tabId);
});

// Change of foreground window (e.g. two windows side by side).
chrome.windows.onFocusChanged.addListener(async (winId) => {
  if (winId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId: winId });
    if (tab) retarget(tab.id);
  } catch (e) {}
});

// The controlled tab has finished navigating/reloading: the content script was
// re-injected by the manifest but the overlay is off → reactivate it.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (running && tabId === targetTabId && changeInfo.status === 'complete') {
    getSettings().then((settings) => {
      chrome.tabs.sendMessage(tabId, { type: 'SHOW_OVERLAY', settings }).catch(() => {});
    });
  }
});

// If the controlled tab is closed, we don't stop everything: we just free the
// reference, so onActivated can attach to the next active tab.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === targetTabId) {
    targetTabId = null;
    chrome.storage.local.set({ targetTabId: null });
  }
});
