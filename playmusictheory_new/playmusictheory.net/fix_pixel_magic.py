import re

print("🪄 正在释放狸猫换太子魔法...")
with open("play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 注入最高级防刷新和变量欺骗（放在最前面）
inject = """
<script>
try { localStorage.setItem('pmt.pro', '1'); } catch(e) {}
window.location.reload = function() {};
window.location.replace = function() {};
window.addEventListener('error', function(e) { e.preventDefault(); }, true);
</script>
"""
html = html.replace("<head>", "<head>" + inject)

# 2. 强行改状态
html = re.sub(r'let proUnlocked = .*?;', 'let proUnlocked = true;', html)
html = html.replace("let pro = false;", "let pro = true;")

# 3. 物理替换：找到 HTML 里真实的 codecard，把它换成一个具有相同宽高的“假盒子”
# 这样渲染引擎去测量它的时候，依然能拿到宽高，不会卡死，但界面上啥也不显示。
fake_box = '<div id="codecard" style="display:none; width:400px; height:300px;"></div>'
html = re.sub(r'<div[^>]*id="codecard"[^>]*>.*?</div>\s*</div>\s*</div>', fake_box, html, flags=re.DOTALL)

# 4. 把给锁加透明度的代码删了，让锁彻底消失
html = html.replace("$('prorow').classList.toggle('locked', !on);", "")
html = html.replace("$('paperrow').classList.toggle('locked', !on);", "")

with open("play_cracked.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ 魔法生效！")
