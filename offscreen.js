// Offscreen document: accesses the webcam, runs MediaPipe HandLandmarker,
// recognizes gestures, and sends the results to the service worker.

import { FilesetResolver, HandLandmarker } from './vendor/tasks-vision/vision_bundle.mjs';

const video = document.getElementById('cam');

let handLandmarker = null;
let stream = null;
let rafId = null;
let lastVideoTime = -1;

// State for click detection (edge-triggered + cooldown + hysteresis).
let leftPinchDown = false;
let lastClickAt = 0;
let leftPinchFrames = 0;
let rightPinchDown = false;
let lastRightClickAt = 0;
let rightPinchFrames = 0;

let settings = defaultSettings();

const FALLBACK_MESSAGES = {
  camUnavailable: 'Fotocamera non disponibile ({0}). Concedi il permesso nella scheda aperta.',
  modelError: 'Hand tracking model failed to load: {0}',
  statusLoading: 'Loading hand tracking...',
  statusActive: 'Hand tracking active.',
  stoppedMsg: 'Stopped.',
};

function msg(key, substitutions = []) {
  const text = chrome.i18n && chrome.i18n.getMessage
    ? chrome.i18n.getMessage(key, substitutions)
    : '';
  if (text) return text;

  const fallback = FALLBACK_MESSAGES[key] || key;
  return substitutions.reduce(
    (value, substitution, index) => value.replace(`{${index}}`, substitution),
    fallback
  );
}

function defaultSettings() {
  return {
    pinchThreshold: 0.32,      // ratio dist(thumb,index)/hand length → left click
    rightPinchThreshold: 0.32, // ratio dist(thumb,middle)/hand length → right click
    clickCooldownMs: 450,
    pinchReleaseMargin: 0.08,
    minPinchFrames: 2,
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
      minHandDetectionConfidence: 0.65,
      minHandPresenceConfidence: 0.65,
      minTrackingConfidence: 0.65,
    });
  } catch (e) {
    // Fall back to CPU if the GPU is not available in the offscreen document.
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { ...baseOptions, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.65,
      minHandPresenceConfidence: 0.65,
      minTrackingConfidence: 0.65,
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
    status({ state: 'error', code: e.name, message: msg('camUnavailable', [e.name]) });
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

  // Thumb+middle pinch → right click. The index stays extended, so the cursor
  // keeps pointing with the index tip while the middle finger touches the thumb.
  const rightPinchRatio = dist(lm[4], lm[12]) / handLen;

  const leftCandidate = pinchRatio < settings.pinchThreshold;
  const rightCandidate = index && rightPinchRatio < settings.rightPinchThreshold;

  // Keep the gestures exclusive. If both distances are small, choose the
  // finger that is clearly closer to the thumb; otherwise wait for a clearer
  // frame instead of firing the wrong click.
  const dominance = 0.035;
  let pinch = false;
  let rightPinch = false;
  if (leftCandidate && (!rightCandidate || pinchRatio < rightPinchRatio - dominance)) {
    pinch = true;
  } else if (rightCandidate && rightPinchRatio < pinchRatio - dominance) {
    rightPinch = true;
  }

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

  return { mode, x, y, pinch, rightPinch, pinchRatio, rightPinchRatio };
}

function resetPinches() {
  leftPinchDown = false;
  leftPinchFrames = 0;
  rightPinchDown = false;
  rightPinchFrames = 0;
}

function updatePinchState(active, ratio, pressThreshold, down, frames) {
  const releaseThreshold = pressThreshold + settings.pinchReleaseMargin;
  if (down) {
    return {
      down: active && ratio < releaseThreshold,
      frames: active ? Math.max(frames, 1) : 0,
      pressed: false,
    };
  }

  const nextFrames = active ? frames + 1 : 0;
  const pressed = nextFrames >= settings.minPinchFrames;
  return {
    down: pressed,
    frames: pressed ? settings.minPinchFrames : nextFrames,
    pressed,
  };
}

// ---------------------------------------------------------------------------
// Detection loop
// ---------------------------------------------------------------------------
// NB: requestAnimationFrame does NOT fire in offscreen documents (they are never
// rendered), so the loop uses a ~30 fps timer.
const FRAME_MS = 33;

function loop() {
  rafId = setTimeout(loop, FRAME_MS);
  if (!handLandmarker || video.readyState < 2) return;

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
    resetPinches();
    return;
  }

  const lm = result.landmarks[0];
  const a = analyze(lm);

  let click = false;
  const leftActive = a.pinch ||
    (leftPinchDown && !a.rightPinch && a.pinchRatio < settings.pinchThreshold + settings.pinchReleaseMargin);
  const leftState = updatePinchState(
    leftActive,
    a.pinchRatio,
    settings.pinchThreshold,
    leftPinchDown,
    leftPinchFrames
  );
  leftPinchDown = leftState.down;
  leftPinchFrames = leftState.frames;
  if (leftState.pressed && (now - lastClickAt) > settings.clickCooldownMs) {
    click = true;
    lastClickAt = now;
  }

  let rightClick = false;
  const rightActive = a.rightPinch ||
    (rightPinchDown && !a.pinch && a.rightPinchRatio < settings.rightPinchThreshold + settings.pinchReleaseMargin);
  const rightState = updatePinchState(
    rightActive,
    a.rightPinchRatio,
    settings.rightPinchThreshold,
    rightPinchDown,
    rightPinchFrames
  );
  rightPinchDown = rightState.down;
  rightPinchFrames = rightState.frames;
  if (rightState.pressed && (now - lastRightClickAt) > settings.clickCooldownMs) {
    rightClick = true;
    lastRightClickAt = now;
  }

  send({ present: true, mode: a.mode, x: a.x, y: a.y, pinch: a.pinch, rightPinch: a.rightPinch, click, rightClick });
}

function send(payload) {
  chrome.runtime.sendMessage({ from: 'offscreen', type: 'HAND', payload }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Control from the service worker
// ---------------------------------------------------------------------------
async function startAll(newSettings) {
  if (newSettings) settings = { ...defaultSettings(), ...newSettings };
  status({ state: 'loading', message: msg('statusLoading') });
  try {
    await initLandmarker();
  } catch (e) {
    status({ state: 'error', message: msg('modelError', [e.message]) });
    return;
  }
  const ok = await startCamera();
  if (!ok) return;
  status({ state: 'ready', message: msg('statusActive') });
  if (!rafId) loop();
}

function stopAll() {
  stopCamera();
  status({ state: 'stopped', message: msg('stoppedMsg') });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== 'offscreen') return;
  if (msg.type === 'START') startAll(msg.settings);
  else if (msg.type === 'STOP') stopAll();
  else if (msg.type === 'SETTINGS') {
    settings = { ...defaultSettings(), ...(msg.settings || {}) };
  }
});
