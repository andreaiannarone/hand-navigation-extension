// Content script: receives hand data, moves a virtual cursor, and
// performs clicks and scrolling on the page.

(() => {
  if (window.__handNavLoaded) return; // avoid double initialization
  window.__handNavLoaded = true;

  // --- Settings (updated from the popup) -----------------------------------
  let settings = {
    cursorGain: 1.6,   // amplifies the hand movement on screen
    smoothing: 0.6,    // 0 = responsive/jittery, 1 = very smooth/slow
    scrollSpeed: 1.4,  // scroll multiplier
    scrollDeadzone: 0.008,
    invertScroll: false,
  };

  // --- State ----------------------------------------------------------------
  let cursorEl = null;
  let badgeEl = null;
  let active = false;

  let posX = window.innerWidth / 2;
  let posY = window.innerHeight / 2;
  let smoothedNX = 0.5, smoothedNY = 0.5; // smoothed normalized point
  let hasSmoothed = false;

  let scrollPrevY = null; // used to compute the scroll delta
  let scrollVel = 0;      // smoothed scroll velocity (px per frame ~30fps)
  let inertiaRAF = null;  // handle for the inertia animation

  // --- UI -------------------------------------------------------------------
  function ensureUI() {
    if (!cursorEl) {
      cursorEl = document.createElement('div');
      cursorEl.id = 'handnav-cursor';
      document.documentElement.appendChild(cursorEl);
    }
    if (!badgeEl) {
      badgeEl = document.createElement('div');
      badgeEl.id = 'handnav-badge';
      document.documentElement.appendChild(badgeEl);
    }
  }

  function showUI(show) {
    ensureUI();
    cursorEl.style.display = show ? 'block' : 'none';
    badgeEl.style.display = show ? 'flex' : 'none';
  }

  function setBadge(text) {
    if (badgeEl) badgeEl.textContent = text;
  }

  function renderCursor() {
    if (cursorEl) cursorEl.style.transform = `translate(${posX}px, ${posY}px)`;
  }

  // --- Actions --------------------------------------------------------------
  function clickAt(px, py) {
    // Temporarily hides the cursor so it doesn't intercept the point.
    const el = document.elementFromPoint(px, py);
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, composed: true, clientX: px, clientY: py, view: window };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      if (typeof el.focus === 'function') el.focus({ preventScroll: true });
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
    } catch (e) {}

    // Visual feedback.
    if (cursorEl) {
      cursorEl.classList.remove('handnav-click-pulse');
      // force reflow to restart the animation
      void cursorEl.offsetWidth;
      cursorEl.classList.add('handnav-click-pulse');
    }
  }

  function rightClickAt(px, py) {
    // Chrome's NATIVE context menu can't be opened from the page via code.
    // So we ask the service worker to inject a real right click through
    // chrome.debugger (DevTools protocol). The coordinates are in viewport
    // pixels (like clientX/clientY), which is what CDP needs.
    chrome.runtime.sendMessage({
      from: 'content',
      type: 'RIGHT_CLICK',
      x: Math.round(px),
      y: Math.round(py),
    }).catch(() => {});

    // Visual feedback (pulse dedicated to the right click).
    if (cursorEl) {
      cursorEl.classList.remove('handnav-rightclick-pulse');
      void cursorEl.offsetWidth;
      cursorEl.classList.add('handnav-rightclick-pulse');
    }
  }

  // Responsiveness factor for the scroll velocity (0 = still, 1 = no
  // smoothing). Low = smooth but a touch less responsive.
  const SCROLL_RESPONSIVENESS = 0.4;

  function applyScroll(ny) {
    stopInertia(); // while the hand is actively driving, no inertia
    if (scrollPrevY === null) { scrollPrevY = ny; return; }
    let delta = ny - scrollPrevY;
    scrollPrevY = ny;
    // Inside the deadzone the target is 0: the velocity fades out gently.
    if (Math.abs(delta) < settings.scrollDeadzone) delta = 0;
    const dir = settings.invertScroll ? -1 : 1;
    // normalized delta → pixels (proportional to the window height)
    const targetVel = dir * delta * settings.scrollSpeed * window.innerHeight;
    // Exponential smoothing: removes jitter and softens start/stop.
    scrollVel += (targetVel - scrollVel) * SCROLL_RESPONSIVENESS;
    window.scrollBy(0, scrollVel);
  }

  function stopInertia() {
    if (inertiaRAF) { cancelAnimationFrame(inertiaRAF); inertiaRAF = null; }
  }

  // Scroll release: if there was enough velocity, keep going by inertia
  // with decreasing friction (trackpad "flick" effect).
  function endScroll() {
    if (scrollPrevY !== null && Math.abs(scrollVel) > 0.5) {
      // From ~30fps (hand frames) to ~60fps (rAF): halve the velocity/frame.
      let v = scrollVel * 0.5;
      const friction = 0.92; // decay per frame
      const minVel = 0.4;    // below this threshold it stops
      stopInertia();
      const step = () => {
        if (Math.abs(v) < minVel) { inertiaRAF = null; scrollVel = 0; return; }
        window.scrollBy(0, v);
        v *= friction;
        inertiaRAF = requestAnimationFrame(step);
      };
      inertiaRAF = requestAnimationFrame(step);
    }
    scrollPrevY = null;
  }

  // --- Per-frame processing -------------------------------------------------
  function onHand(p) {
    if (!active) return;

    if (!p.present) {
      setBadge(chrome.i18n.getMessage('badgeNoHand'));
      endScroll(); // release with inertia if we were scrolling
      return;
    }

    if (p.mode === 'scroll') {
      cursorEl.classList.remove('handnav-pinch');
      cursorEl.classList.add('handnav-scroll');
      setBadge(chrome.i18n.getMessage('badgeScroll'));
      applyScroll(p.y);
      return;
    }

    // Cursor mode (also during pinch).
    endScroll(); // when leaving scroll, let it keep going by inertia
    cursorEl.classList.remove('handnav-scroll');

    // Exponential smoothing of the normalized point.
    const a = 1 - settings.smoothing; // responsiveness factor
    if (!hasSmoothed) { smoothedNX = p.x; smoothedNY = p.y; hasSmoothed = true; }
    smoothedNX += (p.x - smoothedNX) * a;
    smoothedNY += (p.y - smoothedNY) * a;

    // Map with gain around the center, then into pixels.
    const g = settings.cursorGain;
    let nx = (smoothedNX - 0.5) * g + 0.5;
    let ny = (smoothedNY - 0.5) * g + 0.5;
    nx = Math.min(1, Math.max(0, nx));
    ny = Math.min(1, Math.max(0, ny));

    posX = nx * window.innerWidth;
    posY = ny * window.innerHeight;
    renderCursor();

    if (p.rightPinch) {
      cursorEl.classList.add('handnav-pinch');
      setBadge(chrome.i18n.getMessage('badgePinchRight'));
    } else if (p.pinch) {
      cursorEl.classList.add('handnav-pinch');
      setBadge(chrome.i18n.getMessage('badgePinch'));
    } else {
      cursorEl.classList.remove('handnav-pinch');
      setBadge(chrome.i18n.getMessage('badgeCursor'));
    }

    if (p.click) clickAt(posX, posY);
    if (p.rightClick) rightClickAt(posX, posY);
  }

  // --- Messages -------------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    switch (msg.type) {
      case 'PING':
        sendResponse({ ok: true });
        break;
      case 'SHOW_OVERLAY':
        if (msg.settings) settings = { ...settings, ...msg.settings };
        active = true;
        hasSmoothed = false;
        scrollPrevY = null;
        scrollVel = 0;
        stopInertia();
        showUI(true);
        setBadge(chrome.i18n.getMessage('badgeReady'));
        break;
      case 'HIDE_OVERLAY':
        active = false;
        scrollVel = 0;
        stopInertia();
        showUI(false);
        break;
      case 'HAND':
        onHand(msg.payload);
        break;
      case 'SETTINGS':
        if (msg.settings) settings = { ...settings, ...msg.settings };
        break;
    }
  });

  // Re-adjust the cursor if the window changes size.
  window.addEventListener('resize', renderCursor);
})();
