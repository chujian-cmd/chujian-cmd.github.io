import re

print("✨ 正在执行终极完美破解...")
with open("play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 物理切除那个导致狂刷新的自毁检测代码！
# 我们直接把它替换成一个空的 Promise，让它永远不执行！
html = re.sub(r'\(async\s*\(\)\s*=>\s*\{\s*if\s*\(!proUnlocked\s*\|\|\s*NATIVE\)\s*return;.*?location\.reload\(\);\s*\}\s*\}\)\(\);', '// 自毁代码已被物理超度', html, flags=re.DOTALL)

# 2. 强行把初始化变量改成 true
html = html.replace(
    "let proUnlocked = !!(NATIVE && NATIVE.pro) || localStorage.getItem('pmt.pro') === '1';",
    "let proUnlocked = true;"
)
html = html.replace("let pro = false;", "let pro = true;")

# 3. 修改 HTML 的初始化状态，让页面一加载就处于解锁 UI
html = html.replace('class="prorow locked"', 'class="prorow"')
html = html.replace('class="paperrow locked"', 'class="paperrow"')
html = html.replace('class="bpmin locked"', 'class="bpmin"')
html = html.replace('class="btn word tapbtn locked"', 'class="btn word tapbtn"')

# 4. 让系统在加载时自动调用一次 setPro(true)，把画笔和颜色彻底激活
# 在脚本的最后插入一句强制执行
html = html.replace("</script>\n<script src=\"remux.js\"></script>", "setPro(true);\n</script>\n<script src=\"remux.js\"></script>")

with open("play_cracked.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ 完美破解生成完毕！")
