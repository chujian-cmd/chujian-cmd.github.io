// 灵动岛 · by first light（给 初见 的 TurboWarp 专属版）
// 顶部中央黑色药丸：收起时显示 ^_^ + 时间，点击展开成控制小面板
// 面板里：主题开关 / 舞台截图 / 调试台 / 全屏 / 一句轮换小字
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  ready(function () { setTimeout(init, 1600); });

  function init() {
    if (document.getElementById('chujian-island')) return;

    var style = document.createElement('style');
    style.textContent =
      '#chujian-island{position:fixed;top:8px;left:50%;transform:translateX(-50%);' +
      'z-index:2147483644;background:#000;color:#fff;border-radius:999px;' +
      'box-shadow:0 4px 18px rgba(0,0,0,.45);cursor:pointer;overflow:hidden;' +
      'width:148px;height:30px;transition:width .35s cubic-bezier(.6,0,.2,1.4),height .35s cubic-bezier(.6,0,.2,1.4),border-radius .35s;' +
      'font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;user-select:none}' +
      '#chujian-island.open{width:320px;height:172px;border-radius:22px;cursor:default}' +
      '#chujian-island .is-collapsed{display:flex;align-items:center;justify-content:space-between;' +
      'height:30px;padding:0 14px;font-size:13px;font-weight:bold;white-space:nowrap}' +
      '#chujian-island .is-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;' +
      'box-shadow:0 0 6px #4ade80;animation:is-pulse 2s infinite}' +
      '@keyframes is-pulse{0%,100%{opacity:1}50%{opacity:.35}}' +
      '#chujian-island .is-panel{display:none;padding:10px 14px}' +
      '#chujian-island.open .is-panel{display:block}' +
      '#chujian-island.open .is-collapsed{border-bottom:1px solid #333}' +
      '#chujian-island .is-msg{font-size:12px;opacity:.85;margin:2px 0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#chujian-island .is-row{display:flex;gap:6px;flex-wrap:wrap}' +
      '#chujian-island .is-btn{background:#fff;color:#000;border:none;border-radius:8px;' +
      'padding:5px 10px;font-size:12px;font-weight:bold;cursor:pointer}' +
      '#chujian-island .is-btn:active{transform:scale(.94)}';
    document.head.appendChild(style);

    var island = document.createElement('div');
    island.id = 'chujian-island';
    island.title = '初见的灵动岛，点我展开';
    island.innerHTML =
      '<div class="is-collapsed"><span>^_^</span><span class="is-clock">--:--</span><span class="is-dot"></span></div>' +
      '<div class="is-panel">' +
        '<div class="is-msg">Ciallo～(∠・ω< )⌒☆ 离线版运行中</div>' +
        '<div class="is-row">' +
          '<button class="is-btn" data-act="theme">黑白/原版</button>' +
          '<button class="is-btn" data-act="shot">舞台截图</button>' +
          '<button class="is-btn" data-act="hud">调试台</button>' +
          '<button class="is-btn" data-act="fs">全屏</button>' +
        '</div>' +
        '<div class="is-row" style="margin-top:6px">' +
          '<button class="is-btn" data-act="addons">插件设置</button>' +
          '<button class="is-btn" data-act="run">▶ 运行</button>' +
          '<button class="is-btn" data-act="stop">■ 停止</button>' +
          '<button class="is-btn" data-act="clean">纯净模式</button>' +
        '</div>' +
        '<div class="is-status" style="font-size:11px;opacity:.75;margin-top:8px;font-family:monospace"><span class="is-date"></span> · <span class="is-fps">FPS --</span></div>' +
      '</div>';
    document.body.appendChild(island);

    // 时钟
    var clock = island.querySelector('.is-clock');
    function tick() {
      var d = new Date();
      clock.textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
    tick(); setInterval(tick, 15000);
    var dateEl = island.querySelector('.is-date');
    var fpsEl2 = island.querySelector('.is-fps');
    function tickDate() {
      var d = new Date();
      var wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
      if (dateEl) dateEl.textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + wk;
    }
    tickDate(); setInterval(tickDate, 60000);
    var fr = 0, lt = performance.now();
    (function fpsLoop(t) {
      fr++;
      if (t - lt >= 500) { if (fpsEl2) fpsEl2.textContent = 'FPS ' + Math.round(fr * 1000 / (t - lt)); fr = 0; lt = t; }
      requestAnimationFrame(fpsLoop);
    })(performance.now());

    // 展开/收起
    var open = false;
    island.addEventListener('click', function (e) {
      if (e.target.classList.contains('is-btn')) return;
      open = !open;
      island.classList.toggle('open', open);
    });

    // 小字轮换
    var msgs = ['Ciallo～(∠・ω< )⌒☆ 离线版运行中', '断网也能玩，放心造', '今天也要元气满满哦', '点左下角工具条还有更多'];
    var mi = 0, msgEl = island.querySelector('.is-msg');
    setInterval(function () { mi = (mi + 1) % msgs.length; msgEl.textContent = msgs[mi]; }, 6000);

    // 面板按钮
    island.querySelector('.is-row').addEventListener('click', function (e) {
      var act = e.target.getAttribute('data-act');
      if (!act) return;
      if (act === 'theme') {
        var link = document.getElementById('chujian-bw');
        if (link) {
          link.disabled = !link.disabled;
          try { localStorage.setItem('chujian-theme', link.disabled ? 'original' : 'bw'); } catch (err) {}
          msgEl.textContent = link.disabled ? '已切回原版彩色主题' : '黑白主题已打开';
        }
      } else if (act === 'shot') {
        var cvs = document.querySelectorAll('canvas'), best = null, area = 0;
        for (var i = 0; i < cvs.length; i++) {
          var a = cvs[i].width * cvs[i].height;
          if (a > area) { area = a; best = cvs[i]; }
        }
        if (best) {
          try {
            var aEl = document.createElement('a');
            aEl.download = 'turbowarp-stage-' + Date.now() + '.png';
            aEl.href = best.toDataURL('image/png');
            aEl.click();
            msgEl.textContent = '截图已保存';
          } catch (err) { msgEl.textContent = '截图失败了'; }
        }
      } else if (act === 'hud') {
        var t = document.getElementById('bw-toggle-btn');
        if (t) t.click();
        else {
          var hud = document.getElementById('debug-hud');
          if (hud) {
            var shown = hud.style.getPropertyValue('display') !== 'none';
            hud.style.setProperty('display', shown ? 'none' : 'flex', 'important');
          }
        }
      } else if (act === 'addons') {
        if (window.__chujianOpenAddons) window.__chujianOpenAddons();
        else window.open('./addons/index.html', '_blank');
      } else if (act === 'run') {
        var gf = document.querySelector('[class*="controls_green-flag-button_"], [class*="green-flag_green-flag_"]');
        if (gf) gf.click(); else msgEl.textContent = '没找到绿旗按钮';
      } else if (act === 'stop') {
        var st = document.querySelector('[class*="controls_stop-all-button_"], [class*="stop-all_stop-all_"]');
        if (st) st.click(); else msgEl.textContent = '没找到停止按钮';
      } else if (act === 'clean') {
        var ids = ['chujian-island', 'chujian-tools', 'chujian-welcome'];
        var els = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
        els.forEach(function (el) { el.style.visibility = 'hidden'; });
        setTimeout(function () { els.forEach(function (el) { el.style.visibility = ''; }); }, 5000);
      } else if (act === 'fs') {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
      }
    });
  }
})();
