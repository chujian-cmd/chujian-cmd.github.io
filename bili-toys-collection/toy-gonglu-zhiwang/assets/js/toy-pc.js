(function () {
  'use strict';
  function detect(deviceType, ua, finePointer, hover, touchPoints) {
    if (deviceType === 'desktop') return true;
    if (deviceType === 'phone' || deviceType === 'tablet') return false;
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1)) return false;
    return /Windows NT|Macintosh|X11|CrOS|Linux/i.test(ua) && finePointer && hover;
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = detect; return; }
  var root = document.documentElement, deviceType = 'unknown';
  var fine = window.matchMedia('(any-pointer: fine)'), hover = window.matchMedia('(any-hover: hover)');
  function update() {
    var pc = detect(deviceType, navigator.userAgent || '', fine.matches, hover.matches, navigator.maxTouchPoints || 0);
    var changed = root.getAttribute('data-toy-pc') !== String(pc);
    root.setAttribute('data-toy-pc', String(pc));
    if (changed) window.dispatchEvent(new Event('resize'));
  }
  window.addEventListener('road-king-toy-container', function (event) { deviceType = event.detail.deviceType || 'unknown'; update(); });
  if (fine.addEventListener) { fine.addEventListener('change', update); hover.addEventListener('change', update); }
  else { fine.addListener(update); hover.addListener(update); }
  update();
  // Route through the existing buttons so gear/brake and stunt rules remain authoritative.
  function driving(event) {
    if (root.getAttribute('data-toy-pc') !== 'true') return null;
    var target = event.target;
    if (target && target.closest && target.closest('input,textarea,select,[contenteditable="true"]')) return null;
    if (Array.prototype.some.call(document.querySelectorAll('[role="dialog"],.toy-follow-overlay'), function (el) { return el.getClientRects().length > 0; })) return null;
    return document.querySelector('main[data-mode="running"]');
  }
  function press(main, selector) {
    var button = main.querySelector(selector);
    if (button && !button.disabled && button.getClientRects().length) button.click();
  }
  window.addEventListener('keydown', function (event) {
    var key = event.key.toLowerCase();
    if (['q','e','1','2','shift','r',' ','v'].indexOf(key) < 0 || event.ctrlKey || event.metaKey || event.altKey) return;
    var main = driving(event); if (!main) return;
    event.preventDefault();
    // Capture Space before the shared driving handler can treat it as a brake.
    if (key === ' ') event.stopImmediatePropagation();
    if (event.repeat) return;
    if (key === 'q' || key === 'e') {
      var stalk = main.querySelector('.turn-stalk'); if (!stalk) return;
      var side = key === 'q' ? 'left' : 'right';
      var index = stalk.getAttribute('data-signal') === side ? 2 : side === 'left' ? 3 : 1;
      press(main, '.turn-stalk button:nth-of-type(' + index + ')');
    } else press(main, {' ':'.aux-controls > button:nth-of-type(2)','v':'.aux-controls > button:first-of-type','1':'.beam-flash-button','2':'.hazard-button','shift':'.stunt-buttons button:first-child','r':'.stunt-buttons button:last-child'}[key]);
  }, true);
  var wheelTotal = 0, wheelAt = 0, shiftedAt = 0;
  window.addEventListener('wheel', function (event) {
    if (event.ctrlKey || event.metaKey || event.altKey || !event.deltaY) return;
    var main = driving(event); if (!main || !main.querySelector('.gear-controls')) return;
    event.preventDefault();
    var now = Date.now(), delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1);
    if (now - wheelAt > 180 || wheelTotal * delta < 0) wheelTotal = 0;
    wheelAt = now; wheelTotal += delta;
    if (Math.abs(wheelTotal) < 35 || now - shiftedAt < 220) return;
    var direction = wheelTotal > 0 ? 1 : -1; wheelTotal = 0; shiftedAt = now;
    var gear = main.querySelector('.real-shifter'); if (!gear) return;
    var index = ['P','R','N','D'].indexOf(gear.getAttribute('data-gear'));
    var next = index + direction;
    if (index >= 0 && next >= 0 && next < 4) press(main, '.gear-buttons button:nth-child(' + (next + 1) + ')');
  }, {passive:false});
  var hintsVisible = true;
  root.setAttribute('data-toy-hints', 'true');
  function decorate() {
    var ui = document.querySelector('main > .game-ui');
    if (!ui || ui.querySelector('.toy-pc-help')) return;
    var hint = document.createElement('div'); hint.className = 'toy-pc-help';
    hint.textContent = 'W / ↑ 油门　 S / ↓ 刹车　 A D / ← → 转向　 空格 喇叭　 V 远光灯　 P / Esc 暂停　 按住刹车 + 滚轮换挡';
    ui.appendChild(hint);
    var toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'toy-pc-hints-toggle';
    function syncHints() {
      root.setAttribute('data-toy-hints', String(hintsVisible));
      toggle.textContent = hintsVisible ? '隐藏按键提示' : '显示按键提示';
      toggle.setAttribute('aria-pressed', String(hintsVisible));
    }
    toggle.addEventListener('click', function () { hintsVisible = !hintsVisible; syncHints(); });
    syncHints(); ui.appendChild(toggle);
  }
  new MutationObserver(function (records) {
    if (records.some(function (r) { return Array.prototype.some.call(r.addedNodes, function (n) { return n.nodeType === 1; }); })) decorate();
  }).observe(document.body, { childList: true, subtree: true });
  decorate();
})();
