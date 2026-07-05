// Offscreen document: accede alla webcam, esegue MediaPipe HandLandmarker,
// riconosce i gesti e invia i risultati al service worker.

import { FilesetResolver, HandLandmarker } from './vendor/tasks-vision/vision_bundle.mjs';

const video = document.getElementById('cam');

let handLandmarker = null;
let stream = null;
let rafId = null;
let lastVideoTime = -1;

// Stato per il rilevamento del click (edge-triggered + cooldown).
let prevPinch = false;
let lastClickAt = 0;
let prevRightPinch = false;
let lastRightClickAt = 0;

let settings = defaultSettings();

function defaultSettings() {
  return {
    pinchThreshold: 0.32,      // rapporto dist(pollice,indice)/lunghezza mano → click sinistro
    rightPinchThreshold: 0.32, // rapporto dist(pollice,medio)/lunghezza mano → click destro
    clickCooldownMs: 450,
  };
}

function status(payload) {
  chrome.runtime.sendMessage({ from: 'offscreen', type: 'STATUS', payload }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Inizializzazione MediaPipe
// ---------------------------------------------------------------------------
async function initLandmarker() {
  if (handLandmarker) return;
  const vision = await FilesetResolver.forVisionTasks(
    chrome.runtime.getURL('vendor/tasks-vision/wasm')
  );
  const baseOptions = {
    modelAssetPath: chrome.runtime.getURL('vendor/hand_landmarker.task'),
  };
  try {
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { ...baseOptions, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
    });
  } catch (e) {
    // Fallback su CPU se la GPU non è disponibile nell'offscreen.
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { ...baseOptions, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: 1,
    });
  }
}

// ---------------------------------------------------------------------------
// Webcam
// ---------------------------------------------------------------------------
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    });
  } catch (e) {
    status({ state: 'error', message: 'Fotocamera non disponibile: ' + e.name + '. Concedi il permesso dal popup.' });
    return false;
  }
  video.srcObject = stream;
  await video.play().catch(() => {});
  return true;
}

function stopCamera() {
  if (rafId) { clearTimeout(rafId); rafId = null; }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
  lastVideoTime = -1;
}

// ---------------------------------------------------------------------------
// Geometria dei landmark
// ---------------------------------------------------------------------------
function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

// Un dito (indice..mignolo) è esteso se la punta è più lontana dal polso
// rispetto alla nocca intermedia (PIP). Robusto rispetto all'orientamento.
function fingerExtended(lm, tip, pip) {
  return dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.05;
}

function analyze(lm) {
  const handLen = dist(lm[0], lm[9]) || 0.0001; // polso → nocca del medio

  const index = fingerExtended(lm, 8, 6);
  const middle = fingerExtended(lm, 12, 10);
  const ring = fingerExtended(lm, 16, 14);
  const pinky = fingerExtended(lm, 20, 18);

  const pinchRatio = dist(lm[4], lm[8]) / handLen;
  const pinch = pinchRatio < settings.pinchThreshold;

  // Pinch pollice+medio → click destro. L'indice resta esteso, così il cursore
  // continua a puntare con la punta dell'indice mentre il medio tocca il pollice.
  const rightPinchRatio = dist(lm[4], lm[12]) / handLen;
  const rightPinch = index && rightPinchRatio < settings.rightPinchThreshold;

  const openPalm = index && middle && ring && pinky;
  const pointing = index && !middle && !ring && !pinky;

  let mode = 'idle';
  if (openPalm) mode = 'scroll';
  else if (pinch || rightPinch) mode = 'cursor'; // pinch = click, ma resta cursore per la posizione
  else if (pointing) mode = 'cursor';

  // Punto di tracciamento:
  //  - scroll: centro del palmo (nocca del medio, lm[9]) più stabile
  //  - cursore: punta dell'indice (lm[8])
  const track = mode === 'scroll' ? lm[9] : lm[8];

  // Specchio dell'asse X per la vista selfie.
  const x = 1 - track.x;
  const y = track.y;

  return { mode, x, y, pinch, rightPinch };
}

// ---------------------------------------------------------------------------
// Loop di rilevamento
// ---------------------------------------------------------------------------
// NB: requestAnimationFrame NON scatta nei documenti offscreen (non vengono mai
// renderizzati), quindi il loop usa un timer a ~30 fps.
const FRAME_MS = 33;

let _dbgLoopLast = 0;
function loop() {
  rafId = setTimeout(loop, FRAME_MS);
  if (!handLandmarker || video.readyState < 2) {
    const now = Date.now();
    if (now - _dbgLoopLast >= 1000) {
      _dbgLoopLast = now;
      console.log('[HandNav][offscreen] loop in attesa — handLandmarker=' +
        !!handLandmarker + ' video.readyState=' + video.readyState);
    }
    return;
  }

  const now = performance.now();
  if (video.currentTime === lastVideoTime) return; // nessun frame nuovo
  lastVideoTime = video.currentTime;

  let result;
  try {
    result = handLandmarker.detectForVideo(video, now);
  } catch (e) {
    return;
  }

  if (!result || !result.landmarks || result.landmarks.length === 0) {
    send({ present: false, mode: 'idle', x: 0, y: 0, pinch: false, rightPinch: false, click: false, rightClick: false });
    prevPinch = false;
    prevRightPinch = false;
    return;
  }

  const lm = result.landmarks[0];
  const a = analyze(lm);

  // Rilevamento click sinistro: fronte di salita del pinch + cooldown.
  let click = false;
  if (a.pinch && !prevPinch && (now - lastClickAt) > settings.clickCooldownMs) {
    click = true;
    lastClickAt = now;
  }
  prevPinch = a.pinch;

  // Rilevamento click destro: fronte di salita del pinch pollice+medio + cooldown.
  let rightClick = false;
  if (a.rightPinch && !prevRightPinch && (now - lastRightClickAt) > settings.clickCooldownMs) {
    rightClick = true;
    lastRightClickAt = now;
  }
  prevRightPinch = a.rightPinch;

  send({ present: true, mode: a.mode, x: a.x, y: a.y, pinch: a.pinch, rightPinch: a.rightPinch, click, rightClick });
}

// [HandNav] Log diagnostico temporaneo (throttlato a ~1/sec). Rimuovere quando risolto.
let _dbgLast = 0;
function send(payload) {
  const now = Date.now();
  if (now - _dbgLast >= 1000) {
    _dbgLast = now;
    console.log('[HandNav][offscreen] invio HAND — present=' + payload.present +
      ' mode=' + payload.mode + ' x=' + payload.x.toFixed(2) + ' y=' + payload.y.toFixed(2));
  }
  chrome.runtime.sendMessage({ from: 'offscreen', type: 'HAND', payload }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Controllo dal service worker
// ---------------------------------------------------------------------------
async function startAll(newSettings) {
  if (newSettings) settings = { ...defaultSettings(), ...newSettings };
  status({ state: 'loading', message: 'Caricamento modello…' });
  try {
    await initLandmarker();
  } catch (e) {
    status({ state: 'error', message: 'Errore modello MediaPipe: ' + e.message });
    return;
  }
  const ok = await startCamera();
  if (!ok) return;
  status({ state: 'ready', message: 'Riconoscimento attivo.' });
  if (!rafId) loop();
}

function stopAll() {
  stopCamera();
  status({ state: 'stopped', message: 'Fermato.' });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== 'offscreen') return;
  if (msg.type === 'START') startAll(msg.settings);
  else if (msg.type === 'STOP') stopAll();
  else if (msg.type === 'SETTINGS') {
    settings = { ...defaultSettings(), ...(msg.settings || {}) };
  }
});
