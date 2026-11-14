(function () {
  'use strict';
  var root = document.documentElement, sdk, off, state, active = false, generation = 0;
  var manualOrientation = false;
  // Browser layout follows the real viewport, not the CSS-rotated body.
  // Explicit selection pins the direction for this page visit only.
  window.RoadKingToyAutoOrientation = function () {
    if (manualOrientation) return null;
    if (root.getAttribute('data-toy-pc') === 'true') return 'landscape';
    if (active || state) return null;
    var w = root.clientWidth || window.innerWidth, h = root.clientHeight || window.innerHeight;
    return w > 0 && h > 0 ? (w > h ? 'landscape' : 'portrait') : null;
  };
  function safeArea() {
    if (!state) return;
    var safe = state.safeArea || {}, rotated = root.getAttribute('data-rotated') === 'true';
    var sides = ['top', 'right', 'bottom', 'left'];
    var mapped = rotated ? ['right', 'bottom', 'left', 'top'] : sides;
    sides.forEach(function (side, i) {
      var value = Number(safe[mapped[i]]);
      var pixels = (Number.isFinite(value) ? Math.max(0, value) : 0) + 'px';
      root.style.setProperty('--safe-' + side, pixels);
      root.style.setProperty('--safe-area-inset-' + side, pixels);
    });
  }
  function receive(next) {
    if (!next || !next.viewport || !(next.viewport.width > 0 && next.viewport.height > 0)) return;
    state = next;
    window.dispatchEvent(new CustomEvent('road-king-toy-container', {detail: next}));
    window.RoadKingToyViewport = { width: next.viewport.width, height: next.viewport.height };
    safeArea();
    // The game recalculates its logical viewport from confirmed container state.
    window.dispatchEvent(new Event('resize'));
  }
  function requestMode(chosen) {
    if (!sdk || !active) return;
    var orientation = chosen === 'landscape' || chosen === 'portrait' ? chosen : (root.getAttribute('data-orientation') === 'landscape' ? 'landscape' : 'portrait');
    Promise.resolve().then(function () { return sdk.isSupport('setContainerMode'); }).then(function (ok) {
      if (ok && active) return sdk.setContainerMode({ orientation: orientation, immersive: true });
    }).catch(function () { /* CSS rotation remains available when the host declines. */ });
  }
  function connect() {
    if (active || !window.toy) return;
    sdk = window.toy;
    if (typeof sdk.isSupport !== 'function') return;
    active = true;
    var token = ++generation;
    Promise.resolve().then(function () { return sdk.isSupport('onContainerChange'); }).then(function (ok) {
      if (!active || token !== generation) return;
      if (!ok) { active = false; window.dispatchEvent(new Event('resize')); return; }
      // Subscribe first. A resolved mode request is deliberately not treated as confirmation.
      off = sdk.onContainerChange(receive);
      requestMode();
    }).catch(function () { if (token === generation) { active = false; window.dispatchEvent(new Event('resize')); } });
  }
  window.addEventListener('game-layout-change', safeArea);
  window.addEventListener('road-king-toy-ready', connect);
  window.addEventListener('game-mode-selected', requestMode);
  window.addEventListener('game-story-selected', requestMode);
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('.drive-preferences button[data-orientation]');
    if (button) { manualOrientation = true; requestMode(button.getAttribute('data-orientation')); }
  });
  window.addEventListener('pagehide', function () {
    active = false; generation++;
    if (typeof off === 'function') off();
    off = null;
  });
  window.addEventListener('pageshow', connect);
  connect();
})();
