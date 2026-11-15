// 作品自动备份 · by first light
// 接编辑器的 window.vm：每 3 分钟把当前作品存一份到 IndexedDB（最多留 5 份），
// 工具条上有“备份 / 恢复”按钮。vm 没暴露时自动降级，只是不工作，不报错。
(function () {
  var DB = 'chujian-backup', STORE = 'backups', KEEP = 5, lastSize = -1;

  function openDB() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE, { keyPath: 'ts' }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idb(mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(STORE, mode);
        var out = fn(tx.objectStore(STORE));
        tx.oncomplete = function () { res(out && out._v); };
        tx.onerror = function () { rej(tx.error); };
        if (out && out.addEventListener) out.addEventListener('success', function () { out._v = out.result; });
      });
    });
  }
  function listBackups() {
    return idb('readonly', function (st) { return st.getAll(); }).then(function (all) {
      return (all || []).sort(function (a, b) { return b.ts - a.ts; });
    });
  }
  function prune() {
    return listBackups().then(function (all) {
      var extra = all.slice(KEEP);
      if (!extra.length) return;
      return idb('readwrite', function (st) { extra.forEach(function (b) { st.delete(b.ts); }); return null; });
    });
  }
  function getVM() { return (window.vm && (window.vm.saveProjectSb3 || window.vm.toJSON)) ? window.vm : null; }

  function backupNow(manual) {
    var vm = getVM();
    if (!vm) { if (manual) alert('还没找到编辑器的 vm，稍等几秒再试'); return Promise.resolve(false); }
    var gen = vm.saveProjectSb3 ? vm.saveProjectSb3() : Promise.resolve(new Blob([vm.toJSON()], { type: 'application/json' }));
    return Promise.resolve(gen).then(function (blob) {
      if (!blob || blob.size === lastSize) return false;
      lastSize = blob.size;
      return idb('readwrite', function (st) {
        st.put({ ts: Date.now(), size: blob.size, blob: blob });
        return null;
      }).then(prune).then(function () { return true; });
    }).catch(function () { return false; });
  }

  function restorePanel() {
    listBackups().then(function (all) {
      var old = document.getElementById('chujian-restore');
      if (old) old.remove();
      var box = document.createElement('div');
      box.id = 'chujian-restore';
      box.style.cssText = 'position:fixed;left:12px;bottom:52px;z-index:2147483646;background:#000;color:#fff;border:2px solid #fff;box-shadow:0 0 0 2px #000;border-radius:10px;padding:10px 12px;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;max-width:280px';
      var html = '<div style="font-weight:bold;margin-bottom:6px">^_^ 备份列表（点一条恢复）</div>';
      if (!all.length) html += '<div style="font-size:12px;opacity:.8">还没有备份，先点一次“备份”吧</div>';
      box.innerHTML = html;
      all.forEach(function (b) {
        var d = new Date(b.ts);
        var btn = document.createElement('button');
        btn.textContent = d.toLocaleString() + ' · ' + Math.max(1, Math.round(b.size / 1024)) + 'KB';
        btn.style.cssText = 'display:block;width:100%;text-align:left;margin-top:4px;background:#fff;color:#000;border:none;border-radius:6px;padding:5px 8px;font-size:12px;font-weight:bold;cursor:pointer';
        btn.onclick = function () {
          if (!confirm('恢复这份备份会覆盖当前作品，确定吗？')) return;
          var vm = getVM();
          if (!vm) { alert('vm 还没就绪'); return; }
          b.blob.arrayBuffer().then(function (buf) { return vm.loadProject(buf); }).then(function () {
            box.remove();
          }).catch(function (err) { alert('恢复失败：' + err.message); });
        };
        box.appendChild(btn);
      });
      var close = document.createElement('button');
      close.textContent = '关掉';
      close.style.cssText = 'margin-top:8px;background:transparent;color:#fff;border:1px solid #fff;border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer';
      close.onclick = function () { box.remove(); };
      box.appendChild(close);
      document.body.appendChild(box);
    });
  }

  window.__chujianBackup = { now: function () { return backupNow(true); }, restore: restorePanel };

  function attachButtons() {
    var bar = document.getElementById('chujian-tools');
    if (!bar || document.getElementById('chujian-backup-btns')) return;
    var wrap = document.createElement('span');
    wrap.id = 'chujian-backup-btns';
    wrap.style.cssText = 'display:flex;gap:6px';
    function mk(label, title, fn) {
      var b = document.createElement('button');
      b.textContent = label; b.title = title;
      b.style.cssText = 'background:#fff;color:#000;border:none;border-radius:6px;padding:4px 8px;font-size:12px;font-weight:bold;cursor:pointer;white-space:nowrap';
      b.onclick = fn;
      return b;
    }
    wrap.appendChild(mk('备份', '立刻把当前作品存一份', function () {
      backupNow(true).then(function (ok) { alert(ok ? '备份好啦 ✓' : '没有新变化，或备份失败'); });
    }));
    wrap.appendChild(mk('恢复', '从备份里恢复作品', restorePanel));
    bar.appendChild(wrap);
  }

  setInterval(attachButtons, 2000);
  setInterval(function () { backupNow(false); }, 180000);
  setTimeout(function () { backupNow(false); }, 30000);
})();
