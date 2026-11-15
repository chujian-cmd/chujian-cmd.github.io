print("🔪 正在执行大清洗...")
with open("play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 强行把 719 行附近的变量改成 true
html = html.replace(
    "let proUnlocked = !!(NATIVE && NATIVE.pro) || localStorage.getItem('pmt.pro') === '1';",
    "let proUnlocked = true;"
)

# 2. 强行把 710 行的 pro 变量也改成 true（防止它二次检查）
html = html.replace("let pro = false;", "let pro = true;")

# 3. 最关键的：找到 1900 行的 location.reload(); 
# 我们不看上下文，直接把所有的 location.reload() 给物理超度了！
html = html.replace("location.reload();", "console.log('刷新被拦截');")

with open("play_cracked.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ 纯净版生成完毕，快去试试！")
