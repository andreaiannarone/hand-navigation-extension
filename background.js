// Service worker: coordina offscreen (webcam + MediaPipe), popup e content script.

const OFFSCREEN_PATH = 'offscreen.html';

// [HandNav] Log diagnostico temporaneo (throttlato a ~1/sec). Rimuovere quando risolto.
let _dbgLast = 0;
function dbg(m) {
  const now = Date.now();
  if (now - _dbgLast < 1000) return;
  _dbgLast = now;
  console.log('[HandNav][bg]', m);
}

// Tab attualmente controllata dai gesti (impostata quando si preme Start nel popup).
let targetTabId = null;
let running = false;

// MV3: il service worker può essere terminato dopo pochi secondi di inattività e
// riavviato al messaggio successivo, perdendo le variabili qui sopra. Senza questo
// ripristino, dopo un riavvio i messaggi HAND verrebbero scartati (running=false /
// targetTabId=null) e il cursore resterebbe fermo. Rileggiamo lo stato da storage
// a ogni avvio del worker: questo codice top-level gira a ogni spin-up del SW.
chrome.storage.local.get(['running', 'targetTabId']).then((d) => {
  running = !!d.running;
  if (typeof d.targetTabId === 'number') targetTabId = d.targetTabId;
});

// ---------------------------------------------------------------------------
// Gestione dell'offscreen document
// ---------------------------------------------------------------------------
async function hasOffscreen() {
  // getContexts è il metodo raccomandato; fallback su hasDocument se assente.
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
    justification: 'Analisi della webcam per riconoscere i gesti della mano con MediaPipe.',
  });
}

async function closeOffscreen() {
  if (await hasOffscreen()) {
    await chrome.offscreen.closeDocument();
  }
}

// ---------------------------------------------------------------------------
// Click destro NATIVO tramite chrome.debugger (protocollo DevTools)
// ---------------------------------------------------------------------------
// Una pagina web non può aprire il menu contestuale nativo di Chrome. Lo
// otteniamo iniettando un vero evento di mouse a livello di browser via CDP
// (Input.dispatchMouseEvent con tasto destro). Questo fa comparire la barra
// gialla "…sta effettuando il debug di questo browser": è inevitabile.
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

// Se l'utente chiude il debug (o la scheda naviga), Chrome ci stacca: azzeriamo.
chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId === attachedTabId) attachedTabId = null;
});

// ---------------------------------------------------------------------------
// Utility: assicura che il content script sia presente nella tab
// ---------------------------------------------------------------------------
async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch (e) {
    // Non risponde: probabilmente la pagina era già aperta prima dell'install.
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
// Avvio / arresto
// ---------------------------------------------------------------------------
async function start() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  await ensureOffscreen();
  const settings = await getSettings();

  // Avvia il riconoscimento nell'offscreen (indipendente dalla scheda).
  await chrome.runtime.sendMessage({ target: 'offscreen', type: 'START', settings });

  running = true;

  // Aggancia la scheda attiva se controllabile; altrimenti resta in attesa:
  // il retarget aggancerà la prima scheda normale su cui l'utente andrà.
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
  await detachDebugger(); // stacca il debugger → via la barra gialla
  await closeOffscreen();
}

// ---------------------------------------------------------------------------
// Router dei messaggi
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Dati della mano provenienti dall'offscreen → inoltra alla tab controllata.
  if (msg && msg.from === 'offscreen') {
    if (msg.type === 'HAND' && running && targetTabId != null) {
      dbg('HAND → inoltro a tab ' + targetTabId + ' (present=' + (msg.payload && msg.payload.present) + ')');
      chrome.tabs.sendMessage(targetTabId, { type: 'HAND', payload: msg.payload }).catch((e) => {
        dbg('HAND → tabs.sendMessage FALLITO: ' + e.message);
      });
    } else if (msg.type === 'HAND') {
      dbg('HAND SCARTATO — running=' + running + ' targetTabId=' + targetTabId);
    } else if (msg.type === 'STATUS') {
      // Propaga stato (es. camera pronta / errore) al popup se aperto.
      chrome.runtime.sendMessage({ from: 'background', type: 'STATUS', payload: msg.payload }).catch(() => {});
    }
    return; // niente risposta asincrona necessaria
  }

  // Richiesta di click destro nativo dal content script.
  if (msg && msg.from === 'content' && msg.type === 'RIGHT_CLICK') {
    const tabId = sender.tab && sender.tab.id;
    if (running && tabId != null) nativeRightClick(tabId, msg.x, msg.y);
    return;
  }

  // Comandi dal popup.
  if (msg && msg.from === 'popup') {
    if (msg.type === 'START') {
      start().then(() => sendResponse({ ok: true }))
             .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true; // risposta asincrona
    }
    if (msg.type === 'STOP') {
      stop().then(() => sendResponse({ ok: true }))
            .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg.type === 'UPDATE_SETTINGS') {
      chrome.storage.local.set({ settings: msg.settings }).then(() => {
        // Propaga a chi è attivo.
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
// Segui la scheda attiva: mentre l'estensione è in esecuzione, il cursore deve
// controllare la scheda che l'utente sta effettivamente guardando, non quella
// dove è stato premuto Avvia.
// ---------------------------------------------------------------------------
const SYSTEM_PAGE = /^(chrome|edge|about|chrome-extension|devtools|view-source):/;

async function retarget(tabId) {
  if (!running || tabId == null || tabId === targetTabId) return;

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) {
    return; // scheda non più esistente
  }

  const prev = targetTabId;

  // Pagina di sistema (non controllabile): nascondi l'overlay e resta in attesa
  // che l'utente torni su una pagina normale.
  if (!tab || SYSTEM_PAGE.test(tab.url || '')) {
    if (prev != null) {
      chrome.tabs.sendMessage(prev, { type: 'HIDE_OVERLAY' }).catch(() => {});
    }
    targetTabId = null;
    await chrome.storage.local.set({ targetTabId: null });
    dbg('retarget → pagina di sistema, controllo in pausa');
    return;
  }

  // Nascondi l'overlay sulla scheda precedente.
  if (prev != null) {
    chrome.tabs.sendMessage(prev, { type: 'HIDE_OVERLAY' }).catch(() => {});
  }

  // Attiva l'overlay sulla nuova scheda.
  const settings = await getSettings();
  const ok = await ensureContentScript(tabId);
  if (!ok) { dbg('retarget → impossibile iniettare su ' + tabId); return; }
  await chrome.tabs.sendMessage(tabId, { type: 'SHOW_OVERLAY', settings }).catch(() => {});

  targetTabId = tabId;
  await chrome.storage.local.set({ targetTabId });
  dbg('retarget → ora controllo la scheda ' + tabId);
}

// Cambio di scheda attiva nella stessa finestra.
chrome.tabs.onActivated.addListener((info) => {
  retarget(info.tabId);
});

// Cambio di finestra in primo piano (es. due finestre affiancate).
chrome.windows.onFocusChanged.addListener(async (winId) => {
  if (winId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId: winId });
    if (tab) retarget(tab.id);
  } catch (e) {}
});

// La scheda controllata ha finito di navigare/ricaricare: il content script è
// stato reiniettato dal manifest ma l'overlay è spento → riattivalo.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (running && tabId === targetTabId && changeInfo.status === 'complete') {
    getSettings().then((settings) => {
      chrome.tabs.sendMessage(tabId, { type: 'SHOW_OVERLAY', settings }).catch(() => {});
    });
  }
});

// Se la scheda controllata viene chiusa, non fermiamo tutto: liberiamo solo il
// riferimento, così onActivated potrà agganciare la prossima scheda attiva.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === targetTabId) {
    targetTabId = null;
    chrome.storage.local.set({ targetTabId: null });
  }
});
