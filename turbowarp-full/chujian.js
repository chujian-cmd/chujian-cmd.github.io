// 初见专属版 · 个性化小脚本 by first light
// 1) 改标题  2) 右下角欢迎牌（可关，关掉后不再弹）  3) 控制台签名
(function () {
  try {
    document.title = '初见的 TurboWarp ^_^';
  } catch (e) {}

  try {
    console.log('%cCiallo～(∠・ω< )⌒☆ 初见专属版 TurboWarp', 'font-size:16px;color:#000;background:#fff;border:1px solid #000;padding:2px 6px;');
  } catch (e) {}

  if (localStorage.getItem('chujian-welcome-closed') === '1') return;

  function show() {
    if (document.getElementById('chujian-welcome')) return;
    var card = document.createElement('div');
    card.id = 'chujian-welcome';
    card.style.cssText = [
      'position:fixed', 'right:14px', 'bottom:14px', 'z-index:2147483646',
      'background:#000', 'color:#fff', 'border:2px solid #fff',
      'box-shadow:0 0 0 2px #000, 0 8px 24px rgba(0,0,0,.45)',
      'border-radius:10px', 'padding:10px 14px', 'max-width:260px',
      'font-family:"Helvetica Neue",Helvetica,Arial,sans-serif', 'cursor:default'
    ].join(';');
    card.innerHTML =
      '<div style="font-size:20px;line-height:1">^_^</div>' +
      '<div style="font-size:14px;font-weight:bold;margin-top:4px">Ciallo～ 初见专属版</div>' +
      '<div style="font-size:12px;opacity:.85;margin-top:2px">黑白主题 + 彩虹调试台已装好，点右上角的小窗按钮能开关日志。</div>' +
      '<button id="chujian-welcome-close" style="margin-top:8px;background:#fff;color:#000;border:none;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:bold;cursor:pointer">知道啦</button>';
    document.body.appendChild(card);
    document.getElementById('chujian-welcome-close').onclick = function () {
      try { localStorage.setItem('chujian-welcome-closed', '1'); } catch (e) {}
      card.remove();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(show, 1200); });
  } else {
    setTimeout(show, 1200);
  }
})();
