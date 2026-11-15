(function() {
    // ---------------- 悬浮日志窗逻辑 ----------------
    const hud = document.createElement('div');
    hud.id = 'debug-hud';
    // 默认隐藏，由按钮控制
    hud.style.display = 'none'; 
    hud.style.cssText += `
        position: fixed; top: 50px; left: 10px; width: 300px; height: 220px;
        background: rgba(0, 0, 0, 0.95); color: #00ff00; font-family: monospace;
        font-size: 12px; z-index: 2147483647;
        border: 3px solid transparent;
        background-image: linear-gradient(rgba(0,0,0,0.95), rgba(0,0,0,0.95)), linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet);
        background-origin: border-box;
        background-clip: content-box, border-box;
        animation: rainbow-border 3s linear infinite;
        resize: both; min-width: 200px; min-height: 150px;
        border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        flex-direction: column; overflow: hidden;
    `;
    
    // 强制覆盖掉 display:none 带来的 flex 冲突
    hud.style.setProperty('display', 'none', 'important');

    const styleSheet = document.createElement('style');
    styleSheet.innerHTML = `
        @keyframes rainbow-border { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
        #debug-hud::-webkit-resizer { background: #00ff00; border: 1px solid #fff; width: 12px; height: 12px; }
    `;
    document.head.appendChild(styleSheet);

    const header = document.createElement('div');
    header.style.cssText = `cursor: move; user-select: none; padding: 6px; background: #222; border-bottom: 1px solid #444; display: flex; justify-content: space-between; color: #fff; font-weight: bold;`;
    header.innerHTML = '<span>调试日志</span>';
    
    // 关闭按钮直接隐藏窗口
    const closeBtn = document.createElement('span');
    closeBtn.innerText = 'X';
    closeBtn.style.cssText = 'cursor: pointer; color: #ff6666; font-weight: bold; padding: 0 5px;';
    closeBtn.onclick = (e) => { e.stopPropagation(); hud.style.setProperty('display', 'none', 'important'); };
    header.appendChild(closeBtn);

    const content = document.createElement('div');
    content.style.cssText = 'flex: 1; overflow-y: auto; padding: 5px; word-break: break-all;';

    const inputArea = document.createElement('div');
    inputArea.style.cssText = 'padding: 5px; background: #111; border-top: 1px solid #444; display: flex;';
    const cmdInput = document.createElement('input');
    cmdInput.type = 'text'; cmdInput.placeholder = '输入 JS 指令并回车...';
    cmdInput.style.cssText = `flex: 1; background: #000; color: #00ff00; border: 1px solid #555; padding: 4px 8px; font-family: monospace; font-size: 12px; outline: none;`;
    cmdInput.onkeydown = function(e) {
        if (e.key === 'Enter') {
            const code = cmdInput.value; if (!code.trim()) return;
            printLog('CMD', [code]);
            try {
                const result = window.eval(code);
                if (result !== undefined) printLog('RET', [String(result)]);
            } catch (err) { printLog('ERROR', [err.message]); }
            cmdInput.value = '';
        }
    };
    inputArea.appendChild(cmdInput);
    hud.appendChild(header); hud.appendChild(content); hud.appendChild(inputArea);
    setTimeout(() => { document.body.appendChild(hud); }, 1000);

    // 拖动逻辑
    let isDragging = false; let startX, startY, startLeft, startTop;
    function startDrag(x, y) { isDragging = true; startX = x; startY = y; const rect = hud.getBoundingClientRect(); startLeft = rect.left; startTop = rect.top; hud.style.bottom = 'auto'; hud.style.right = 'auto'; }
    function onDrag(x, y) { if (!isDragging) return; hud.style.left = (startLeft + (x - startX)) + 'px'; hud.style.top = (startTop + (y - startY)) + 'px'; }
    header.onmousedown = (e) => startDrag(e.clientX, e.clientY);
    document.addEventListener('mousemove', (e) => onDrag(e.clientX, e.clientY));
    document.addEventListener('mouseup', () => isDragging = false);
    header.ontouchstart = (e) => { startDrag(e.touches[0].clientX, e.touches[0].clientY); };
    document.addEventListener('touchmove', (e) => { onDrag(e.touches[0].clientX, e.touches[0].clientY); if(isDragging) e.preventDefault(); }, { passive: false });
    document.addEventListener('touchend', () => isDragging = false);

    // 日志重写
    const originalLog = console.log; const originalWarn = console.warn; const originalError = console.error;
    function printLog(type, args) {
        if (!content) return;
        const msg = Array.from(args).map(a => { try { return typeof a === 'object' ? JSON.stringify(a) : a; } catch(e) { return String(a); } }).join(' ');
        const time = new Date().toLocaleTimeString();
        const line = document.createElement('div'); line.innerText = `[${time}] [${type}] ${msg}`;
        if (type === 'ERROR') line.style.color = '#ff6666'; else if (type === 'WARN') line.style.color = '#ffcc00'; else if (type === 'CMD') line.style.color = '#00ffff'; else if (type === 'RET') line.style.color = '#ff00ff';
        content.appendChild(line); content.scrollTop = content.scrollHeight;
    }
    console.log = function(...args) { originalLog.apply(console, args); printLog('LOG', args); };
    console.warn = function(...args) { originalWarn.apply(console, args); printLog('WARN', args); };
    console.error = function(...args) { originalError.apply(console, args); printLog('ERROR', args); };
    window.addEventListener('error', function(e) { printLog('ERROR', [e.message + ' at ' + e.filename + ':' + e.lineno]); });


    // ---------------- 顶部粉眼睛开关逻辑 ----------------
    setTimeout(() => {
        if (document.getElementById('bw-toggle-btn')) return;
        var m = document.querySelector('div[class*="menu-bar_menu-bar_"]');
        if (!m) return;

        var b = document.createElement('button');
        b.id = 'bw-toggle-btn';
        b.title = '显示/隐藏控制台';
        
        var eyeOpenSVG = `<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align: middle;"><circle cx="12" cy="12" r="11" fill="#FF6680"/><path d="M12 6c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6zm0-10c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z" fill="#fff"/></svg>`;
        var eyeClosedSVG = `<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align: middle;"><circle cx="12" cy="12" r="11" fill="#FF6680"/><path d="M12 6c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6 0-1.2.4-2.4 1-3.3l8.3 8.3c-.9.6-2.1 1-3.3 1zm5-2.7l-8.3-8.3c.9-.6 2.1-1 3.3-1 3.3 0 6 2.7 6 6 0 1.2-.4 2.4-1 3.3z" fill="#fff"/></svg>`;

        // 默认是闭眼（因为控制台默认关闭）
        b.innerHTML = eyeClosedSVG;
        b.style.cssText = 'background:transparent; border:none; cursor:pointer; padding:4px 10px; margin-left:10px; display:flex; align-items:center; transition:0.2s; opacity:0.8;';
        
        b.onmouseenter = () => { b.style.background = 'rgba(255,255,255,0.2)'; b.style.opacity = '1'; };
        b.onmouseleave = () => { b.style.background = 'transparent'; b.style.opacity = '0.8'; };

        var isVisible = false;
        b.onclick = function() {
            if (isVisible) {
                hud.style.setProperty('display', 'none', 'important');
                b.innerHTML = eyeClosedSVG;
                isVisible = false;
            } else {
                hud.style.setProperty('display', 'flex', 'important');
                b.innerHTML = eyeOpenSVG;
                isVisible = true;
            }
        };
        m.appendChild(b);
    }, 1500);
})();

// 快捷召唤插件指令
window.openAddons = function() {
    window.open('addons/index.html', '_blank'); 
    return "召唤插件面板！";
};

// 接收来自 iframe 的配置，并强行覆盖本地存储
window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'ADDON_SETTINGS_UPDATE') {
        try {
            const settings = JSON.parse(e.data.data);
            // 把插件页面的配置同步到编辑器
            for (let key in settings) {
                localStorage.setItem(key, settings[key]);
            }
            console.log("✅ 捕获到插件设置，已同步到编辑器，请点击右上角保存刷新！");
        } catch (err) {}
    }
});
