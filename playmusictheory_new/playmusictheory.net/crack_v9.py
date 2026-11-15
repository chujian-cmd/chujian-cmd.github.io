import re

print("💉 正在执行 v9 隐身补丁...")
with open("play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 注入最强防刷新护盾
inject = """
<script>
try { localStorage.setItem('pmt.pro', '1'); } catch(e) {}
window.addEventListener('error', function(e) { e.preventDefault(); }, true);
window.location.reload = function() {};
window.location.replace = function() {};
window.onerror = function() { return true; };
</script>
"""
html = html.replace("<head>", "<head>" + inject)

# 2. 强行修改状态
html = re.sub(r'let proUnlocked = .*?;', 'let proUnlocked = true;', html)
html = html.replace("let pro = false;", "let pro = true;")

# 3. 用 CSS 魔法隐身，但不破坏结构
css_hack = """
#codecard { opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
.prorow.locked, .bpmin.locked, .paperrow.locked, .tapbtn.locked { opacity: 1 !important; pointer-events: auto !important; }
"""
html = html.replace("</style>", css_hack + "\n</style>")

# 4. 拦截显示代码
html = html.replace("codecard.hidden = false;", "")
# 5. 干掉那个可能触发弹窗的 toggle 逻辑
html = html.replace("$('prorow').classList.toggle('locked', !on);", "")
html = html.replace("$('paperrow').classList.toggle('locked', !on);", "")

with open("play_cracked.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ v9 生成完毕！")
