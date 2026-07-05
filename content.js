// Content script: receives hand data, moves a virtual cursor, and
// performs clicks and scrolling on the page.

(() => {
  if (window.__handNavLoaded) return; // avoid double initialization
  window.__handNavLoaded = true;

  // --- Settings (updated from the popup) -----------------------------------
  let settings = {
    cursorGain: 1.6,   // amplifies the hand movement on screen
    smoothing: 0.72,   // 0 = responsive/jittery, 1 = very smooth/slow
    scrollSpeed: 1.4,  // scroll multiplier
    scrollDeadzone: 0.008,
    invertScroll: false,
  };

  // --- State ----------------------------------------------------------------
  let cursorEl = null;
  let badgeEl = null;
  let menuEl = null;
  let active = false;

  let posX = window.innerWidth / 2;
  let posY = window.innerHeight / 2;
  let targetX = posX;
  let targetY = posY;
  let smoothedNX = 0.5, smoothedNY = 0.5; // smoothed normalized point
  let hasSmoothed = false;
  let cursorRAF = null;
  let lastCursorFrameAt = 0;

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
    if (!menuEl) {
      menuEl = document.createElement('div');
      menuEl.id = 'handnav-menu';
      document.documentElement.appendChild(menuEl);
    }
  }

  function showUI(show) {
    ensureUI();
    cursorEl.style.display = show ? 'block' : 'none';
    badgeEl.style.display = show ? 'flex' : 'none';
    if (!show) hideContextMenu();
  }

  function setBadge(text) {
    if (badgeEl) badgeEl.textContent = text;
  }

  function renderCursor() {
    if (!cursorEl) return;
    cursorEl.style.setProperty('--handnav-x', `${posX}px`);
    cursorEl.style.setProperty('--handnav-y', `${posY}px`);
    updateMenuHover();
  }

  function updateMenuHover() {
    if (!menuEl || menuEl.style.display === 'none') return;
    menuEl.querySelectorAll('.handnav-menu-hover').forEach((el) => {
      el.classList.remove('handnav-menu-hover');
    });
    const el = document.elementFromPoint(posX, posY);
    const item = el && el.closest && el.closest('.handnav-menu-item:not(:disabled)');
    if (item && menuEl.contains(item)) item.classList.add('handnav-menu-hover');
  }

  function isContextMenuOpen() {
    return !!menuEl && menuEl.style.display !== 'none';
  }

  function activateMenuItemAtCursor() {
    if (!isContextMenuOpen()) return false;
    updateMenuHover();
    let item = menuEl.querySelector('.handnav-menu-hover');
    if (!item) {
      const el = document.elementFromPoint(posX, posY);
      item = el && el.closest && el.closest('.handnav-menu-item:not(:disabled)');
    }
    if (!item) {
      const menuRect = menuEl.getBoundingClientRect();
      const insideMenuColumn = posX >= menuRect.left - 24 && posX <= menuRect.right + 24 &&
        posY >= menuRect.top - 24 && posY <= menuRect.bottom + 24;
      if (insideMenuColumn) {
        let best = null;
        let bestDistance = Infinity;
        menuEl.querySelectorAll('.handnav-menu-item:not(:disabled)').forEach((candidate) => {
          const rect = candidate.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          const distance = Math.abs(posY - centerY);
          if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
          }
        });
        if (bestDistance <= 28) item = best;
      }
    }
    if (!item || !menuEl.contains(item)) return false;
    item.click();
    return true;
  }

  function stopCursorLoop() {
    if (cursorRAF) { cancelAnimationFrame(cursorRAF); cursorRAF = null; }
    lastCursorFrameAt = 0;
  }

  function startCursorLoop() {
    if (cursorRAF) return;
    const step = (now) => {
      cursorRAF = requestAnimationFrame(step);
      if (!active) return;

      const dt = lastCursorFrameAt ? Math.min(50, now - lastCursorFrameAt) : 16.7;
      lastCursorFrameAt = now;

      // Smooth the visible cursor between MediaPipe frames. This keeps the
      // pointer fluid without adding much delay to the gesture recognition.
      const alpha = 1 - Math.pow(1 - 0.45, dt / 16.7);
      posX += (targetX - posX) * alpha;
      posY += (targetY - posY) * alpha;

      if (Math.abs(targetX - posX) < 0.1) posX = targetX;
      if (Math.abs(targetY - posY) < 0.1) posY = targetY;
      renderCursor();
    };
    cursorRAF = requestAnimationFrame(step);
  }

  function snapCursorToTarget() {
    posX = targetX;
    posY = targetY;
    renderCursor();
  }

  // --- Actions --------------------------------------------------------------
  function clickAt(px, py) {
    // Temporarily hides the cursor so it doesn't intercept the point.
    const el = document.elementFromPoint(px, py);
    if (!el) return;
    const opts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: px,
      clientY: py,
      button: 0,
      buttons: 1,
      detail: 1,
      view: window,
    };
    const pointerOpts = {
      ...opts,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    };
    try {
      el.dispatchEvent(new PointerEvent('pointerover', pointerOpts));
      el.dispatchEvent(new PointerEvent('pointerenter', pointerOpts));
      el.dispatchEvent(new MouseEvent('mouseover', opts));
      el.dispatchEvent(new MouseEvent('mouseenter', opts));
      el.dispatchEvent(new PointerEvent('pointermove', pointerOpts));
      el.dispatchEvent(new MouseEvent('mousemove', opts));
      el.dispatchEvent(new PointerEvent('pointerdown', pointerOpts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      if (typeof el.focus === 'function') el.focus({ preventScroll: true });
      el.dispatchEvent(new PointerEvent('pointerup', { ...pointerOpts, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }));
    } catch (e) {}

    // Visual feedback.
    if (cursorEl) {
      cursorEl.classList.remove('handnav-click-pulse');
      // force reflow to restart the animation
      void cursorEl.offsetWidth;
      cursorEl.classList.add('handnav-click-pulse');
    }
  }

  function findContextLink(el) {
    while (el && el !== document.documentElement) {
      if (el instanceof HTMLAnchorElement && el.href) return el;
      el = el.parentElement;
    }
    return null;
  }

  function contextAction(action, data = {}) {
    hideContextMenu();
    switch (action) {
      case 'closeMenu':
        break;
      case 'copy':
        document.execCommand('copy');
        break;
      case 'copyText':
        copyText(data.text || '');
        break;
      case 'paste':
        document.execCommand('paste');
        break;
      case 'selectAll':
        document.execCommand('selectAll');
        break;
      case 'nativeRightClick':
        chrome.runtime.sendMessage({
          from: 'content',
          type: 'RIGHT_CLICK',
          x: Math.round(data.x),
          y: Math.round(data.y),
        }).catch(() => {});
        break;
      default:
        chrome.runtime.sendMessage({ from: 'content', type: 'CONTEXT_ACTION', action, data }).catch(() => {});
    }
  }

  function copyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.documentElement.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  function addMenuItem(label, action, data, disabled = false) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'handnav-menu-item';
    item.textContent = label;
    item.disabled = disabled;
    item.addEventListener('click', () => {
      if (!disabled) contextAction(action, data);
    });
    menuEl.appendChild(item);
  }

  function addMenuSeparator() {
    const separator = document.createElement('div');
    separator.className = 'handnav-menu-separator';
    menuEl.appendChild(separator);
  }

  function hideContextMenu() {
    if (!menuEl) return;
    menuEl.style.display = 'none';
    menuEl.replaceChildren();
  }

  function showContextMenu(px, py) {
    ensureUI();
    const el = document.elementFromPoint(px, py);
    const link = findContextLink(el);
    const hasSelection = String(window.getSelection() || '').trim().length > 0;

    menuEl.replaceChildren();
    addMenuItem('Indietro', 'back');
    addMenuItem('Avanti', 'forward');
    addMenuItem('Ricarica', 'reload');
    addMenuSeparator();
    addMenuItem('Copia', 'copy', {}, !hasSelection);
    addMenuItem('Incolla', 'paste');
    addMenuItem('Seleziona tutto', 'selectAll');
    if (link) {
      addMenuSeparator();
      addMenuItem('Apri link', 'openUrl', { url: link.href });
      addMenuItem('Copia link', 'copyText', { text: link.href });
    }
    addMenuSeparator();
    addMenuItem('Menu Chrome', 'nativeRightClick', { x: px, y: py });
    addMenuItem('Chiudi', 'closeMenu');

    menuEl.style.display = 'block';
    const rect = menuEl.getBoundingClientRect();
    const left = Math.min(Math.max(8, px), window.innerWidth - rect.width - 8);
    const top = Math.min(Math.max(8, py), window.innerHeight - rect.height - 8);
    menuEl.style.left = `${left}px`;
    menuEl.style.top = `${top}px`;
    updateMenuHover();
  }

  function rightClickAt(px, py) {
    showContextMenu(px, py);

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
      cursorEl.classList.remove('handnav-pinch', 'handnav-scroll');
      endScroll(); // release with inertia if we were scrolling
      return;
    }

    if (p.mode === 'scroll') {
      hideContextMenu();
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

    targetX = nx * window.innerWidth;
    targetY = ny * window.innerHeight;

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

    if (p.click) {
      snapCursorToTarget();
      if (!activateMenuItemAtCursor()) clickAt(posX, posY);
    }
    if (p.rightClick) {
      snapCursorToTarget();
      rightClickAt(posX, posY);
    }
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
        posX = targetX = window.innerWidth / 2;
        posY = targetY = window.innerHeight / 2;
        scrollPrevY = null;
        scrollVel = 0;
        stopInertia();
        showUI(true);
        renderCursor();
        startCursorLoop();
        setBadge(chrome.i18n.getMessage('badgeReady'));
        break;
      case 'HIDE_OVERLAY':
        active = false;
        scrollVel = 0;
        stopInertia();
        stopCursorLoop();
        hideContextMenu();
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
  window.addEventListener('resize', () => {
    targetX = Math.min(targetX, window.innerWidth);
    targetY = Math.min(targetY, window.innerHeight);
    posX = Math.min(posX, window.innerWidth);
    posY = Math.min(posY, window.innerHeight);
    renderCursor();
  });
})();
