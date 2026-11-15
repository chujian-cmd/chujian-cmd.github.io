import re

print("🛡️ 正在构建绝对防御护盾...")
with open("play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 注入最强防刷新护盾，连 setInterval 都给它冻结
inject = """
<script>
try { localStorage.setItem('pmt.pro', '1'); } catch(e) {}
// 暴力拦截
window.location.reload = function() {};
window.location.replace = function() {};
window.location.assign = function() {};
Object.defineProperty(window, 'location', {
    value: { reload: function(){}, replace: function(){}, assign: function(){}, href: 'javascript:void(0)' },
    writable: false, configurable: false
});
// 吞掉所有报错
window.onerror = function() { return true; };
window.onunhandledrejection = function(e) { e.preventDefault(); };
</script>
"""
html = html.replace("<head>", "<head>" + inject)

# 强制修改变量
html = re.sub(r'let proUnlocked = .*?;', 'let proUnlocked = true;', html)
html = html.replace("let pro = false;", "let pro = true;")

# 用 CSS 强行把画笔和颜色面板亮出来（防它暗中隐藏）
css_hack = """
/* 彻底隐藏那个罪魁祸首弹窗 */
#codecard { display: none !important; }
/* 强行点亮所有带 locked 的 UI 元素，并允许点击 */
.prorow, .bpmin, .paperrow, .tapbtn { opacity: 1 !important; pointer-events: auto !important; }
"""
html = html.replace("</style>", css_hack + "\n</style>")

# 删掉那个加锁的 JS 逻辑
html = html.replace("$('prorow').classList.toggle('locked', !on);", "")
html = html.replace("$('paperrow').classList.toggle('locked', !on);", "")

with open("play_cracked.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ v13 生成完毕！")
