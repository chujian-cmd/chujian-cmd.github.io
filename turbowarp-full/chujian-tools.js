// 初见专属工具条 · by first light
// 左下角小工具条：主题开关 / 舞台截图 / FPS / 全屏 / 欢迎牌
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    setTimeout(init, 1800);
  });

  function init() {
    if (document.getElementById('chujian-tools')) return;

    var bar = document.createElement('div');
    bar.id = 'chujian-tools';
    bar.style.cssText = [
      'position:fixed', 'left:12px', 'bottom:12px', 'z-index:2147483645',
      'display:flex', 'gap:6px', 'align-items:center',
      'background:#000', 'border:2px solid #fff',
      'box-shadow:0 0 0 2px #000, 0 6px 18px rgba(0,0,0,.4)',
      'border-radius:10px', 'padding:6px 8px',
      'font-family:"Helvetica Neue",Helvetica,Arial,sans-serif'
    ].join(';');

    function mkBtn(label, title) {
      var b = document.createElement('button');
      b.textContent = label;
      b.title = title;
      b.style.cssText = 'background:#fff;color:#000;border:none;border-radius:6px;' +
        'padding:4px 8px;font-size:12px;font-weight:bold;cursor:pointer;white-space:nowrap';
      return b;
    }

    var brand = document.createElement('span');
    brand.textContent = '^_^ 初见版';
    brand.style.cssText = 'color:#fff;font-size:12px;font-weight:bold;padding:0 2px;white-space:nowrap';
    bar.appendChild(brand);

    // 1) 主题两档：黑白 / 原版
    var themeOn = true;
    try { themeOn = localStorage.getItem('chujian-theme') !== 'original'; } catch (e) {}
    function applyTheme() {
      var link = document.getElementById('chujian-bw');
      if (link) link.disabled = !themeOn;
      themeBtn.textContent = themeOn ? '主题:黑白' : '主题:原版';
    }
    var themeBtn = mkBtn('主题:黑白', '一键开关黑白主题');
    themeBtn.onclick = function () {
      themeOn = !themeOn;
      try { localStorage.setItem('chujian-theme', themeOn ? 'bw' : 'original'); } catch (e) {}
      applyTheme();
    };
    bar.appendChild(themeBtn);

    // 2) 舞台截图：抓舞台区最大的 canvas 存成 PNG
    var shotBtn = mkBtn('截图', '把当前舞台画面保存为 PNG');
    shotBtn.onclick = function () {
      var cvs = document.querySelectorAll('canvas');
      var best = null, bestArea = 0;
      for (var i = 0; i < cvs.length; i++) {
        var a = cvs[i].width * cvs[i].height;
        if (a > bestArea) { bestArea = a; best = cvs[i]; }
      }
      if (!best) { alert('没找到舞台画布'); return; }
      try {
        var aEl = document.createElement('a');
        aEl.download = 'turbowarp-stage-' + Date.now() + '.png';
        aEl.href = best.toDataURL('image/png');
        aEl.click();
      } catch (err) {
        alert('截图失败：' + err.message);
      }
    };
    bar.appendChild(shotBtn);

    // 3) FPS 显示开关
    var fpsEl = document.createElement('span');
    fpsEl.style.cssText = 'color:#0f0;font-size:12px;font-family:monospace;display:none;min-width:56px';
    var fpsOn = false, raf = null, frames = 0, last = performance.now();
    function loop(t) {
      frames++;
      if (t - last >= 500) {
        fpsEl.textContent = Math.round(frames * 1000 / (t - last)) + ' FPS';
        frames = 0; last = t;
      }
      if (fpsOn) raf = requestAnimationFrame(loop);
    }
    var fpsBtn = mkBtn('FPS', '开关帧率显示');
    fpsBtn.onclick = function () {
      fpsOn = !fpsOn;
      fpsEl.style.display = fpsOn ? 'inline' : 'none';
      if (fpsOn) { frames = 0; last = performance.now(); raf = requestAnimationFrame(loop); }
      else if (raf) cancelAnimationFrame(raf);
    };
    bar.appendChild(fpsBtn);
    bar.appendChild(fpsEl);

    // 4) 全屏开关
    var fsBtn = mkBtn('全屏', '整页全屏');
    fsBtn.onclick = function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    };
    bar.appendChild(fsBtn);

    // 5) 欢迎牌再来一次
    var hiBtn = mkBtn('Ciallo', '再显示一次欢迎牌');
    hiBtn.onclick = function () {
      try { localStorage.removeItem('chujian-welcome-closed'); } catch (e) {}
      location.reload();
    };
    bar.appendChild(hiBtn);

    document.body.appendChild(bar);
    applyTheme();
  }
})();
