// 版本加载器 · by first light
// 一个包，五个版本：按 localStorage 里的 chujian-version 决定加载哪些功能脚本。
// v1 原版 / v2 经典（主题+欢迎牌+调试台）/ v3 进阶（+工具条+灵动岛+路径修复）
// v4 猫猫（+猫积木默认开）/ v5 完全体（+自动备份）
(function () {
  var PRESETS = {
    v1: [],
    v2: ['logger.js', 'chujian.js'],
    v3: ['chujian-navfix.js', 'logger.js', 'chujian.js', 'chujian-tools.js', 'dynamic-island.js'],
    v4: ['chujian-navfix.js', 'logger.js', 'chujian.js', 'chujian-tools.js', 'dynamic-island.js'],
    v5: ['chujian-navfix.js', 'logger.js', 'chujian.js', 'chujian-tools.js', 'dynamic-island.js', 'chujian-backup.js']
  };
  var NAMES = { v1: 'v1 原版镜像', v2: 'v2 初见经典', v3: 'v3 进阶', v4: 'v4 猫猫', v5: 'v5 完全体' };
  var DESCS = {
    v1: '纯官方，啥都不加',
    v2: '黑白主题 + 欢迎牌 + 彩虹调试台',
    v3: 'v2 + 工具条 + 灵动岛 + 路径修复',
    v4: 'v3 + 猫积木默认开启',
    v5: 'v4 + 作品自动备份'
  };
  var ver = 'v5';
  try { ver = localStorage.getItem('chujian-version') || 'v5'; } catch (e) {}
  if (!PRESETS[ver]) ver = 'v5';
  window.__chujianVersion = ver;

  (PRESETS[ver] || []).forEach(function (src) {
    var sc = document.createElement('script');
    sc.src = './' + src;
    sc.async = false;
    document.body.appendChild(sc);
  });

  // ---- 版本切换面板 ----
  function openPanel() {
    if (document.getElementById('chujian-ver-panel')) return;
    var box = document.createElement('div');
    box.id = 'chujian-ver-panel';
    box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:2147483647;display:flex;justify-content:center;align-items:center';
    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;color:#000;border-radius:14px;padding:18px;width:300px;max-width:92vw;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif';
    var html = '<div style="font-size:17px;font-weight:bold">^_^ 切换版本</div>' +
      '<div style="font-size:12px;opacity:.7;margin:4px 0 10px">所有版本共用同一份编辑器和素材，只换功能层，不占多份空间。</div>';
    card.innerHTML = html;
    Object.keys(PRESETS).forEach(function (v) {
      var b = document.createElement('button');
      b.innerHTML = '<b>' + NAMES[v] + '</b>' + (v === ver ? ' ✓ 当前' : '') +
        '<div style="font-size:11px;opacity:.7;font-weight:normal">' + DESCS[v] + '</div>';
      b.style.cssText = 'display:block;width:100%;text-align:left;margin-top:6px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:13px;' +
        (v === ver ? 'background:#000;color:#fff;border:2px solid #000' : 'background:#f2f2f2;color:#000;border:1px solid #ccc');
      b.onclick = function () {
        try { localStorage.setItem('chujian-version', v); } catch (e) {}
        location.reload();
      };
      card.appendChild(b);
    });
    var close = document.createElement('button');
    close.textContent = '不换了';
    close.style.cssText = 'margin-top:12px;background:transparent;border:1px solid #999;border-radius:8px;padding:6px 14px;cursor:pointer';
    close.onclick = function () { box.remove(); };
    card.appendChild(close);
    box.appendChild(card);
    document.body.appendChild(box);
  }
  window.__chujianVersionUI = openPanel;

  // 入口按钮：有工具条就挂工具条，没有就右下角放个小 pill
  function attach() {
    if (document.getElementById('chujian-ver-btn')) return true;
    var bar = document.getElementById('chujian-tools');
    var b = document.createElement('button');
    b.id = 'chujian-ver-btn';
    b.textContent = '版本 ' + ver;
    b.title = '切换版本（v1-v5）';
    b.onclick = openPanel;
    if (bar) {
      b.style.cssText = 'background:#fff;color:#000;border:none;border-radius:6px;padding:4px 8px;font-size:12px;font-weight:bold;cursor:pointer;white-space:nowrap';
      bar.appendChild(b);
    } else {
      b.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483645;background:#000;color:#fff;border:2px solid #fff;box-shadow:0 0 0 2px #000;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:bold;cursor:pointer';
      document.body.appendChild(b);
    }
    return true;
  }
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (attach() || tries > 20) clearInterval(iv);
  }, 700);
})();
