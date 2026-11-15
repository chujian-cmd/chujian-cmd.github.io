print("🧼 正在执行极致纯净版破解...")
# 从原版文件读取
with open("play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 仅修改那唯一一行的初始化变量，不添加任何花里胡哨的防刷新脚本
html = html.replace(
    "let proUnlocked = !!(NATIVE && NATIVE.pro) || localStorage.getItem('pmt.pro') === '1';",
    "let proUnlocked = true;"
)

# 2. 把锁定状态也直接改为 true
html = html.replace("let pro = false;", "let pro = true;")

with open("play_cracked.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ 极致纯净版生成完毕！")
