// ============================================================
// PROGRESS BAR pour les générations IA (~70s typique)
//
// Avance linéairement de 0 à 95% sur ~65s, puis bloque à 95%.
// Au passage à 95%, affiche "On y est presque, encore quelques secondes…".
// Quand la génération finit, snap à 100% puis fade out.
// ============================================================

(function () {
  const TYPICAL_DURATION_MS = 65000;
  const ALMOST_DONE_MSG = 'On y est presque, encore quelques secondes…';
  let _interval = null;
  let _startTs = null;
  let _state = null; // { barEl, msgEl, defaultMsg }

  function start({ barId, msgId, defaultMsg }) {
    stop(); // reset si une session précédente tourne encore
    const barEl = document.getElementById(barId);
    if (!barEl) return;
    const msgEl = msgId ? document.getElementById(msgId) : null;

    barEl.style.transition = 'width 0.4s ease-out';
    barEl.style.width = '2%';

    _startTs = Date.now();
    _state = { barEl, msgEl, defaultMsg: defaultMsg || (msgEl ? msgEl.textContent : null) };

    let almostShown = false;
    _interval = setInterval(() => {
      const elapsed = Date.now() - _startTs;
      const pct = Math.min(95, (elapsed / TYPICAL_DURATION_MS) * 95);
      barEl.style.width = pct.toFixed(1) + '%';
      if (!almostShown && pct >= 95 && msgEl) {
        msgEl.textContent = ALMOST_DONE_MSG;
        almostShown = true;
      }
    }, 200);
  }

  function stop() {
    if (_interval) { clearInterval(_interval); _interval = null; }
    if (_state && _state.barEl) {
      _state.barEl.style.transition = 'width 0.3s ease-out';
      _state.barEl.style.width = '100%';
      // Restaure le message après une courte pause
      const s = _state;
      setTimeout(() => {
        if (s.barEl) s.barEl.style.width = '0%';
        if (s.msgEl && s.defaultMsg) s.msgEl.textContent = s.defaultMsg;
      }, 400);
    }
    _state = null;
    _startTs = null;
  }

  window.genProgress = { start, stop };
})();
