import re

print("💉 正在注入伪造通行证...")
with open("play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 强行在 HTML 最前面塞入本地缓存，并拦截所有刷新
inject = """
<script>
try { localStorage.setItem('pmt.pro', '1'); } catch(e) {}
window.location.reload = function() {};
window.location.replace = function() {};
window.onerror = function() { return true; };
</script>
"""
# 确保插在 <html> 或者 <head> 最前面
if "<head>" in html:
    html = html.replace("<head>", inject + "<head>", 1)
else:
    html = inject + html

# 2. 篡改变量
html = re.sub(r'let proUnlocked = .*?;', 'let proUnlocked = true;', html)
html = html.replace("let pro = false;", "let pro = true;")

# 3. 用 CSS 将那个弹窗“流放”到屏幕外，不碰它的 display，防止画笔被连坐
css_hack = """
#codecard { position: absolute !important; top: -9999px !important; left: -9999px !important; }
.prorow.locked, .bpmin.locked, .paperrow.locked, .tapbtn.locked { opacity: 1 !important; pointer-events: auto !important; }
"""
html = html.replace("</style>", css_hack + "\n</style>")

# 4. 拦截显示弹窗
html = html.replace("codecard.hidden = false;", "codecard.hidden = true;")

# 5. 删掉加锁的代码，让 UI 正常
html = html.replace("$('prorow').classList.toggle('locked', !on);", "")
html = html.replace("$('paperrow').classList.toggle('locked', !on);", "")

with open("play_cracked.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ v12 生成完毕！")
