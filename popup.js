// Popup: ON/OFF control, camera permission, settings.

const DEFAULT_SETTINGS = {
  cursorGain: 1.6,
  smoothing: 0.72,
  scrollSpeed: 1.4,
  invertScroll: false,
  pinchThreshold: 0.32,
  rightPinchThreshold: 0.32,
  clickCooldownMs: 450,
};

const els = {
  status: document.getElementById('status'),
  statusText: document.getElementById('statusText'),
  cameraBtn: document.getElementById('cameraBtn'),
  toggleBtn: document.getElementById('toggleBtn'),
  cursorGain: document.getElementById('cursorGain'),
  smoothing: document.getElementById('smoothing'),
  scrollSpeed: document.getElementById('scrollSpeed'),
  pinchThreshold: document.getElementById('pinchThreshold'),
  rightPinchThreshold: document.getElementById('rightPinchThreshold'),
  invertScroll: document.getElementById('invertScroll'),
  cursorGainOut: document.getElementById('cursorGainOut'),
  smoothingOut: document.getElementById('smoothingOut'),
  scrollSpeedOut: document.getElementById('scrollSpeedOut'),
  pinchThresholdOut: document.getElementById('pinchThresholdOut'),
  rightPinchThresholdOut: document.getElementById('rightPinchThresholdOut'),
};

let settings = { ...DEFAULT_SETTINGS };
let running = false;

function setStatus(text, kind) {
  els.statusText.textContent = text;
  els.status.className = 'status' + (kind ? ' ' + kind : '');
}

function reflectSettings() {
  els.cursorGain.value = settings.cursorGain;
  els.smoothing.value = settings.smoothing;
  els.scrollSpeed.value = settings.scrollSpeed;
  els.pinchThreshold.value = settings.pinchThreshold;
  els.rightPinchThreshold.value = settings.rightPinchThreshold;
  els.invertScroll.checked = settings.invertScroll;
  els.cursorGainOut.textContent = Number(settings.cursorGain).toFixed(1);
  els.smoothingOut.textContent = Number(settings.smoothing).toFixed(2);
  els.scrollSpeedOut.textContent = Number(settings.scrollSpeed).toFixed(1);
  els.pinchThresholdOut.textContent = Number(settings.pinchThreshold).toFixed(2);
  els.rightPinchThresholdOut.textContent = Number(settings.rightPinchThreshold).toFixed(2);
}

function reflectToggle() {
  els.toggleBtn.textContent = chrome.i18n.getMessage(running ? 'stopBtn' : 'startBtn');
  els.toggleBtn.classList.toggle('running', running);
}

// --- Persistence ------------------------------------------------------------
async function loadState() {
  const data = await chrome.storage.local.get(['settings', 'running']);
  settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  reflectSettings();
  // Ask the background for the real state.
  chrome.runtime.sendMessage({ from: 'popup', type: 'GET_STATE' }, (res) => {
    if (chrome.runtime.lastError) return;
    running = !!(res && res.running);
    reflectToggle();
  });
}

let saveTimer = null;
function readSettingsFromUI() {
  settings.cursorGain = parseFloat(els.cursorGain.value);
  settings.smoothing = parseFloat(els.smoothing.value);
  settings.scrollSpeed = parseFloat(els.scrollSpeed.value);
  settings.pinchThreshold = parseFloat(els.pinchThreshold.value);
  settings.rightPinchThreshold = parseFloat(els.rightPinchThreshold.value);
  settings.invertScroll = els.invertScroll.checked;
}

function onSettingChange() {
  readSettingsFromUI();
  reflectSettings();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.runtime.sendMessage({ from: 'popup', type: 'UPDATE_SETTINGS', settings });
  }, 150);
}

['cursorGain', 'smoothing', 'scrollSpeed', 'pinchThreshold', 'rightPinchThreshold', 'invertScroll'].forEach((id) => {
  els[id].addEventListener('input', onSettingChange);
});

// --- Camera permission ------------------------------------------------------
// The camera prompt does NOT work inside the popup (the popup closes when the
// prompt takes focus). So we open a dedicated page in a tab, where the
// permission can be granted correctly.
els.cameraBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
  setStatus(chrome.i18n.getMessage('permOpenedHint'), 'load');
});

// --- Start / stop -----------------------------------------------------------
els.toggleBtn.addEventListener('click', () => {
  const type = running ? 'STOP' : 'START';
  setStatus(chrome.i18n.getMessage(running ? 'stopping' : 'starting'), 'load');
  chrome.runtime.sendMessage({ from: 'popup', type }, (res) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.i18n.getMessage('errorGeneric', [chrome.runtime.lastError.message]), 'err');
      return;
    }
    if (!res || !res.ok) {
      setStatus(res && res.error ? res.error : chrome.i18n.getMessage('opFailed'), 'err');
      return;
    }
    running = !running;
    reflectToggle();
    setStatus(chrome.i18n.getMessage(running ? 'runningMsg' : 'stoppedMsg'), running ? 'ok' : '');
  });
});

// --- Status messages from the background/offscreen --------------------------
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.from !== 'background' || msg.type !== 'STATUS') return;
  const p = msg.payload || {};
  const kindMap = { ready: 'ok', error: 'err', loading: 'load', stopped: '', started: 'ok' };
  if (p.state === 'error' || p.state === 'stopped') {
    running = false;
    reflectToggle();
  }
  setStatus(p.message || p.state || '', kindMap[p.state] ?? '');
});

loadState();
