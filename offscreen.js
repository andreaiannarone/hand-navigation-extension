// Offscreen document: accesses the webcam, runs MediaPipe HandLandmarker,
// recognizes gestures, and sends the results to the service worker.

import { FilesetResolver, HandLandmarker } from './vendor/tasks-vision/vision_bundle.mjs';

const video = document.getElementById('cam');

let handLandmarker = null;
let stream = null;
let rafId = null;
let lastVideoTime = -1;

// State for click detection (edge-triggered + cooldown).
let prevPinch = false;
let lastClickAt = 0;
let prevRightPinch = false;
let lastRightClickAt = 0;

let settings = defaultSettings();

function defaultSettings() {
  return {
    pinchThreshold: 0.32,      // ratio dist(thumb,index)/hand length → left click
    rightPinchThreshold: 0.32, // ratio dist(thumb,middle)/hand length → right click
    clickCooldownMs: 450,
  };
}

function status(payload) {
  chrome.runtime.sendMessage({ from: 'offscreen', type: 'STATUS', payload }).catch(() => {});
}

// ---------------------------------------------------------------------------
// MediaPipe initialization
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
    // Fall back to CPU if the GPU is not available in the offscreen document.
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
    status({ state: 'error', message: chrome.i18n.getMessage('camUnavailable', [e.name]) });
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
// Landmark geometry
// ---------------------------------------------------------------------------
function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

// A finger (index..pinky) is extended if its tip is farther from the wrist
// than the middle knuckle (PIP). Robust with respect to orientation.
function fingerExtended(lm, tip, pip) {
  return dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.05;
}

function analyze(lm) {
  const handLen = dist(lm[0], lm[9]) || 0.0001; // wrist → middle-finger knuckle

  const index = fingerExtended(lm, 8, 6);
  const middle = fingerExtended(lm, 12, 10);
  const ring = fingerExtended(lm, 16, 14);
  const pinky = fingerExtended(lm, 20, 18);

  const pinchRatio = dist(lm[4], lm[8]) / handLen;
  const pinch = pinchRatio < settings.pinchThreshold;

  // Thumb+middle pinch → right click. The index stays extended, so the cursor
  // keeps pointing with the index tip while the middle finger touches the thumb.
  const rightPinchRatio = dist(lm[4], lm[12]) / handLen;
  const rightPinch = index && rightPinchRatio < settings.rightPinchThreshold;

  const openPalm = index && middle && ring && pinky;
  const pointing = index && !middle && !ring && !pinky;

  let mode = 'idle';
  if (openPalm) mode = 'scroll';
  else if (pinch || rightPinch) mode = 'cursor'; // pinch = click, but stays cursor for positioning
  else if (pointing) mode = 'cursor';

  // Tracking point:
  //  - scroll: center of the palm (middle-finger knuckle, lm[9]) is more stable
  //  - cursor: index-finger tip (lm[8])
  const track = mode === 'scroll' ? lm[9] : lm[8];

  // Mirror the X axis for the selfie view.
  const x = 1 - track.x;
  const y = track.y;

  return { mode, x, y, pinch, rightPinch };
}

// ---------------------------------------------------------------------------
// Detection loop
// ---------------------------------------------------------------------------
// NB: requestAnimationFrame does NOT fire in offscreen documents (they are never
// rendered), so the loop uses a ~30 fps timer.
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
  if (video.currentTime === lastVideoTime) return; // no new frame
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

  // Left-click detection: rising edge of the pinch + cooldown.
  let click = false;
  if (a.pinch && !prevPinch && (now - lastClickAt) > settings.clickCooldownMs) {
    click = true;
    lastClickAt = now;
  }
  prevPinch = a.pinch;

  // Right-click detection: rising edge of the thumb+middle pinch + cooldown.
  let rightClick = false;
  if (a.rightPinch && !prevRightPinch && (now - lastRightClickAt) > settings.clickCooldownMs) {
    rightClick = true;
    lastRightClickAt = now;
  }
  prevRightPinch = a.rightPinch;

  send({ present: true, mode: a.mode, x: a.x, y: a.y, pinch: a.pinch, rightPinch: a.rightPinch, click, rightClick });
}

// [HandNav] Temporary diagnostic log (throttled to ~1/sec). Remove once resolved.
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
// Control from the service worker
// ---------------------------------------------------------------------------
async function startAll(newSettings) {
  if (newSettings) settings = { ...defaultSettings(), ...newSettings };
  status({ state: 'loading', message: chrome.i18n.getMessage('statusLoading') });
  try {
    await initLandmarker();
  } catch (e) {
    status({ state: 'error', message: chrome.i18n.getMessage('modelError', [e.message]) });
    return;
  }
  const ok = await startCamera();
  if (!ok) return;
  status({ state: 'ready', message: chrome.i18n.getMessage('statusActive') });
  if (!rafId) loop();
}

function stopAll() {
  stopCamera();
  status({ state: 'stopped', message: chrome.i18n.getMessage('stoppedMsg') });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== 'offscreen') return;
  if (msg.type === 'START') startAll(msg.settings);
  else if (msg.type === 'STOP') stopAll();
  else if (msg.type === 'SETTINGS') {
    settings = { ...defaultSettings(), ...(msg.settings || {}) };
  }
});
