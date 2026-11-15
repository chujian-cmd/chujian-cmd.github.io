import re

print("⚡ 正在执行脑前额叶切除手术...")
with open("play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 最顶层注入沙盒欺骗，拦截刷新
inject = """
<script>
try { localStorage.setItem('pmt.pro', '1'); } catch(e) {}
window.location.reload = function() {};
window.location.replace = function() {};
window.location.assign = function() {};
window.onerror = function() { return true; };
</script>
"""
html = html.replace("<head>", "<head>" + inject)

# 2. 干掉 Service Worker
html = re.sub(r'navigator\.serviceWorker\.register\([^)]*\)', 'void 0', html)

# 3. 重点来了：直接干掉 setPro 函数内部的逻辑！
# 通常它是：function setPro(state) { if (state) {...} else {...} }
# 我们让它永远只执行 true 的部分，不执行 false 的部分
# 先找到它：搜 function setPro，把它替换成强制开启
html = re.sub(r'function setPro\([^)]*\)\s*\{[^}]*?\}', 'function setPro() { /* 脑前额叶切除 */ }', html, count=1, flags=re.DOTALL)

# 4. 彻底把那个“升级弹窗”的显示代码变成空白
html = re.sub(r'codecard\.hidden\s*=\s*false;', '', html)

# 5. 强行把变量改成 true
html = html.replace("let pro = false;", "let pro = true;")
html = re.sub(r'let proUnlocked = .*?;', 'let proUnlocked = true;', html)

# 6. 最绝的一招：找到控制锁的那个 dom 节点，强行把它的 class 清空
# 它原本是 <div class="prorow locked">
html = html.replace('class="prorow locked"', 'class="prorow"')
html = html.replace('class="paperrow locked"', 'class="paperrow"')

with open("play_cracked.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ 手术完成，生成 play_cracked.html")
