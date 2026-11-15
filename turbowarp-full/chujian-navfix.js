// 路径修复 v2 · by first light
// 病根：MT 管理器预览用的是拦截式假域名（*.invalid），整页跳走/刷新就再也回不来。
// 根治办法：不让浏览器离开编辑器页——
// 1) 原生“插件”入口本来整页跳 /addons，现在改成在编辑器里弹出浮层打开本地插件页；
// 2) 其它 /editor、/fullscreen 等绝对路径跳转，改写成本地相对文件。
(function () {
  var MAP = {
    '/editor': './editor.html',
    '/editor/': './editor.html',
    '/fullscreen': './fullscreen.html',
    '/embed': './embed.html'
  };
  function pathOf(url) {
    try { return new URL(url, location.href).pathname; } catch (e) { return null; }
  }
  function isAddons(url) {
    var p = pathOf(url);
    return p === '/addons' || p === '/addons/' || /\/(addons\/index\.html|addons)$/.test(p || '');
  }
  function fix(url) {
    try {
      var u = new URL(url, location.href);
      if (u.origin === location.origin && MAP[u.pathname]) {
        return MAP[u.pathname] + u.search + u.hash;
      }
    } catch (e) {}
    return null;
  }

  // ---- 插件页浮层（不离开编辑器页） ----
  function openAddonsOverlay() {
    if (document.getElementById('chujian-addons-overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'chujian-addons-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:2147483646;display:flex;justify-content:center;align-items:center';
    var iframe = document.createElement('iframe');
    iframe.src = './addons/index.html';
    iframe.style.cssText = 'width:92%;height:92%;border:none;background:#fff;border-radius:10px';
    var bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;top:14px;right:14px;display:flex;gap:8px;align-items:center';
    var tag = document.createElement('span');
    tag.textContent = '^_^ 插件设置';
    tag.style.cssText = 'color:#fff;font-size:13px;font-weight:bold;margin-right:4px';
    function mkBtn(txt, bg) {
      var b = document.createElement('button');
      b.textContent = txt;
      b.style.cssText = 'background:' + bg + ';color:#fff;border:none;padding:9px 16px;border-radius:6px;font-size:14px;font-weight:bold;cursor:pointer';
      return b;
    }
    var closeBtn = mkBtn('关闭', '#000');
    closeBtn.style.border = '2px solid #fff';
    closeBtn.onclick = function () { overlay.remove(); };
    bar.appendChild(tag); bar.appendChild(closeBtn);
    overlay.appendChild(iframe); overlay.appendChild(bar);
    document.body.appendChild(overlay);
  }

  window.__chujianOpenAddons = openAddonsOverlay;
  var origOpen = window.open;
  window.open = function (url, target, features) {
    if (url && isAddons(url)) { openAddonsOverlay(); return null; }
    var f = url && fix(url);
    return origOpen.call(window, f || url, target, features);
  };

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (isAddons(href)) {
      e.preventDefault(); e.stopPropagation();
      openAddonsOverlay();
      return;
    }
    var f = fix(href);
    if (f) {
      e.preventDefault();
      if (a.target === '_blank') origOpen.call(window, f, '_blank');
      else location.href = f;
    }
  }, true);
})();
