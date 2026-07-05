// Content script: riceve i dati della mano, muove un cursore virtuale ed
// esegue click e scroll sulla pagina.

(() => {
  if (window.__handNavLoaded) return; // evita doppia inizializzazione
  window.__handNavLoaded = true;

  // --- Impostazioni (aggiornate dal popup) ---------------------------------
  let settings = {
    cursorGain: 1.6,   // amplifica il movimento della mano sullo schermo
    smoothing: 0.6,    // 0 = reattivo/tremolante, 1 = molto fluido/lento
    scrollSpeed: 1.4,  // moltiplicatore dello scroll
    scrollDeadzone: 0.008,
    invertScroll: false,
  };

  // --- Stato ----------------------------------------------------------------
  let cursorEl = null;
  let badgeEl = null;
  let active = false;

  let posX = window.innerWidth / 2;
  let posY = window.innerHeight / 2;
  let smoothedNX = 0.5, smoothedNY = 0.5; // punto normalizzato smussato
  let hasSmoothed = false;

  let scrollPrevY = null; // per calcolare il delta di scroll
  let scrollVel = 0;      // velocità di scroll smussata (px per frame ~30fps)
  let inertiaRAF = null;  // handle dell'animazione di inerzia

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

  // --- Azioni ---------------------------------------------------------------
  function clickAt(px, py) {
    // Nasconde temporaneamente il cursore per non intercettare il punto.
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

    // Feedback visivo.
    if (cursorEl) {
      cursorEl.classList.remove('handnav-click-pulse');
      // forza reflow per ripartire l'animazione
      void cursorEl.offsetWidth;
      cursorEl.classList.add('handnav-click-pulse');
    }
  }

  function rightClickAt(px, py) {
    // Il menu contestuale NATIVO di Chrome non è apribile dalla pagina via
    // codice. Chiediamo quindi al service worker di iniettare un vero click
    // destro tramite chrome.debugger (protocollo DevTools). Le coordinate sono
    // in pixel del viewport (come clientX/clientY), che è ciò che serve a CDP.
    chrome.runtime.sendMessage({
      from: 'content',
      type: 'RIGHT_CLICK',
      x: Math.round(px),
      y: Math.round(py),
    }).catch(() => {});

    // Feedback visivo (pulse dedicato al tasto destro).
    if (cursorEl) {
      cursorEl.classList.remove('handnav-rightclick-pulse');
      void cursorEl.offsetWidth;
      cursorEl.classList.add('handnav-rightclick-pulse');
    }
  }

  // Fattore di reattività della velocità di scroll (0 = fermo, 1 = nessun
  // smoothing). Basso = fluido ma un filo meno reattivo.
  const SCROLL_RESPONSIVENESS = 0.4;

  function applyScroll(ny) {
    stopInertia(); // mentre la mano guida attivamente, niente inerzia
    if (scrollPrevY === null) { scrollPrevY = ny; return; }
    let delta = ny - scrollPrevY;
    scrollPrevY = ny;
    // Dentro la zona morta il target è 0: la velocità si spegne dolcemente.
    if (Math.abs(delta) < settings.scrollDeadzone) delta = 0;
    const dir = settings.invertScroll ? -1 : 1;
    // delta normalizzato → pixel (proporzionale all'altezza della finestra)
    const targetVel = dir * delta * settings.scrollSpeed * window.innerHeight;
    // Smoothing esponenziale: toglie il jitter e ammorbidisce partenza/arresto.
    scrollVel += (targetVel - scrollVel) * SCROLL_RESPONSIVENESS;
    window.scrollBy(0, scrollVel);
  }

  function stopInertia() {
    if (inertiaRAF) { cancelAnimationFrame(inertiaRAF); inertiaRAF = null; }
  }

  // Rilascio dello scroll: se c'era abbastanza velocità, prosegui per inerzia
  // con attrito decrescente (effetto "flick" da trackpad).
  function endScroll() {
    if (scrollPrevY !== null && Math.abs(scrollVel) > 0.5) {
      // Da ~30fps (frame della mano) a ~60fps (rAF): dimezza la velocità/frame.
      let v = scrollVel * 0.5;
      const friction = 0.92; // decadimento per frame
      const minVel = 0.4;    // sotto questa soglia ci si ferma
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

  // --- Elaborazione di ogni frame ------------------------------------------
  // [HandNav] Log diagnostico temporaneo (throttlato a ~1/sec). Rimuovere quando risolto.
  let _dbgLast = 0;
  function onHand(p) {
    const now = Date.now();
    if (now - _dbgLast >= 1000) {
      _dbgLast = now;
      console.log('[HandNav][content] HAND ricevuto — active=' + active +
        ' present=' + p.present + ' mode=' + p.mode);
    }
    if (!active) return;

    if (!p.present) {
      setBadge('✋ nessuna mano');
      endScroll(); // rilascio con inerzia se stavamo scorrendo
      return;
    }

    if (p.mode === 'scroll') {
      cursorEl.classList.remove('handnav-pinch');
      cursorEl.classList.add('handnav-scroll');
      setBadge('↕︎ scroll');
      applyScroll(p.y);
      return;
    }

    // Modalità cursore (anche durante il pinch).
    endScroll(); // uscendo dallo scroll, lascia proseguire per inerzia
    cursorEl.classList.remove('handnav-scroll');

    // Smoothing esponenziale del punto normalizzato.
    const a = 1 - settings.smoothing; // fattore di reattività
    if (!hasSmoothed) { smoothedNX = p.x; smoothedNY = p.y; hasSmoothed = true; }
    smoothedNX += (p.x - smoothedNX) * a;
    smoothedNY += (p.y - smoothedNY) * a;

    // Mappa con guadagno attorno al centro, poi in pixel.
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
      setBadge('🖱 pinch destro');
    } else if (p.pinch) {
      cursorEl.classList.add('handnav-pinch');
      setBadge('🤏 pinch');
    } else {
      cursorEl.classList.remove('handnav-pinch');
      setBadge('☝︎ cursore');
    }

    if (p.click) clickAt(posX, posY);
    if (p.rightClick) rightClickAt(posX, posY);
  }

  // --- Messaggi -------------------------------------------------------------
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
        setBadge('☝︎ pronto');
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

  // Riadatta il cursore se la finestra cambia dimensione.
  window.addEventListener('resize', renderCursor);
})();
