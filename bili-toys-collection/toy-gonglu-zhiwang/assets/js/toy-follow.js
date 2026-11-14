window.RoadKingToyAuthorUid="3546768352479488";
(function () {
  'use strict';
  var dialog, message, retry, follow, home, previous, pending, busy = false, permit = false, sequence = 0, timeout, purpose = '剧情模式';
  function close() {
    sequence++; clearTimeout(timeout); busy = false; pending = null;
    if (dialog) dialog.hidden = true;
    if (home) { home.element.inert = home.inert; if (home.hidden === null) home.element.removeAttribute('aria-hidden'); else home.element.setAttribute('aria-hidden', home.hidden); home = null; }
    if (previous && previous.isConnected) previous.focus();
  }
  function ui() {
    if (dialog) return;
    dialog = document.createElement('div'); dialog.className = 'toy-follow-overlay'; dialog.hidden = true;
    dialog.innerHTML = '<section class="toy-follow-panel" role="dialog" aria-modal="true" aria-labelledby="toy-follow-title"><h2 id="toy-follow-title">关注作者，解锁剧情模式</h2><p class="toy-follow-description" hidden>粉丝助手支持开启无敌模式，定速巡航，调整速度上限，还可开启无人机常驻、掉头自动倒车。</p><p class="toy-follow-message" role="status" aria-live="polite"></p><button type="button" data-follow-go>去关注作者</button><button type="button" data-follow-retry>我已关注，重新检查</button><button type="button" data-follow-close>暂不进入</button></section>';
    document.body.appendChild(dialog);
    message = dialog.querySelector('.toy-follow-message'); retry = dialog.querySelector('[data-follow-retry]'); follow = dialog.querySelector('[data-follow-go]');
    dialog.querySelector('[data-follow-close]').addEventListener('click', close);
    retry.addEventListener('click', check);
    follow.addEventListener('click', function () {
      var uid = window.RoadKingToyAuthorUid;
      if (!/^\d+$/.test(uid || '')) { message.textContent = '请在作品页面打开作者主页，关注后返回重新检查。'; return; }
      // Call directly in the user gesture; no asynchronous capability check here.
      try {
        if (window.toy && typeof window.toy.navigate === 'function') {
          Promise.resolve(window.toy.navigate({type:'space',id:uid})).catch(function () {
            message.textContent = '主页未能打开，请在作品页面点击作者头像关注，再返回重新检查。';
          });
        } else window.open('https://space.bilibili.com/' + uid, '_blank', 'noopener,noreferrer');
      } catch (_) { message.textContent = '主页未能打开，请稍后重试。'; }
    });
    document.addEventListener('keydown', function (event) {
      if (dialog.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      if (event.key === 'Tab') {
        var buttons = Array.from(dialog.querySelectorAll('button:not([disabled])')), index = buttons.indexOf(document.activeElement);
        if (index < 0 || (!event.shiftKey && index === buttons.length-1) || (event.shiftKey && index === 0)) {
          event.preventDefault(); event.stopImmediatePropagation(); buttons[event.shiftKey ? buttons.length-1 : 0].focus();
        }
      }
    }, true);
  }
  function show() {
    if (!dialog.hidden) return;
    var background = document.getElementById('story-selection');
    if (!background || background.hidden) background = document.getElementById('mode-screen');
    if (background) { home = {element:background,inert:background.inert,hidden:background.getAttribute('aria-hidden')}; background.inert = true; background.setAttribute('aria-hidden','true'); }
    dialog.hidden = false; dialog.querySelector('[data-follow-close]').focus();
  }
  function fail(text) { busy = false; clearTimeout(timeout); retry.disabled = false; follow.disabled = false; message.textContent = text; show(); }
  function unavailable() { return '当前环境无法查询关注状态，请在 B站 App 内打开本作品后重试。普通和狂暴模式仍可直接游玩。'; }
  function check() {
    if (busy || !pending) return;
    busy = true; retry.disabled = true; follow.disabled = true; message.textContent = '检查中，正在确认关注状态…';
    show();
    var token = ++sequence, sdk = window.toy;
    timeout = setTimeout(function () { if (token === sequence) { sequence++; fail('检查超时，请检查网络后重试。'); } }, 10000);
    Promise.resolve().then(function () {
      if (!sdk || typeof sdk.isSupport !== 'function' || typeof sdk.getAuthorRelation !== 'function') return false;
      return sdk.isSupport('getAuthorRelation');
    }).then(function (supported) {
      if (token !== sequence) return null;
      return supported ? sdk.getAuthorRelation() : {status:'unsupported'};
    }).then(function (result) {
      if (token !== sequence || !pending) return;
      if (result && result.status === 'ok' && result.data && result.data.isFollowing === true) {
        var action = pending; close(); permit = true;
        try { action(); } finally { permit = false; }
      } else if (result && result.status === 'ok' && result.data && result.data.isFollowing === false) {
        fail(''+purpose+'需关注本作品作者。关注后返回，点击“我已关注，重新检查”即可解锁。');
      } else if (result && result.status === 'unsupported') fail(unavailable());
      else fail('暂时无法确认关注状态。请确认已登录 B站后重试；手机浏览器请改用 B站 App。');
    }).catch(function () {
      if (token === sequence && pending) fail('关注状态查询失败，请确认已登录 B站并检查网络，然后重试。');
    });
  }
  window.RoadKingToyStoryGate = function (action) {
    if (permit) return true;
    ui(); if (pending) return false;
    purpose='剧情模式';dialog.removeAttribute('data-fan');dialog.querySelector('.toy-follow-description').hidden=true;dialog.querySelector('h2').textContent='关注作者，解锁'+purpose;dialog.querySelector('[data-follow-close]').textContent='暂不进入';
    previous = document.activeElement; pending = action;
    check(); return false;
  };
  window.RoadKingToyFanGate = function (action) {
    if (permit) return true;
    ui(); if (pending) return false;
    purpose='粉丝助手';dialog.setAttribute('data-fan','true');dialog.querySelector('.toy-follow-description').hidden=false;dialog.querySelector('h2').textContent='关注作者，使用粉丝助手';dialog.querySelector('[data-follow-close]').textContent='暂不使用';
    previous=document.activeElement;pending=action;check();return false;
  };
  window.addEventListener('game-return-home', close);
  window.addEventListener('game-mode-selected', close);
  window.addEventListener('game-home-restored', close);
})();
