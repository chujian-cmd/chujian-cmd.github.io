print("✨ 正在执行完美破解（只改一行，保留所有功能）...")
with open("play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 直接在第 719 行把 let proUnlocked = false; 改成 true;
# 原代码是 let proUnlocked = !!(NATIVE && NATIVE.pro) || localStorage.getItem('pmt.pro') === '1';
# 我们直接把它替换成 true
html = html.replace(
    "let proUnlocked = !!(NATIVE && NATIVE.pro) || localStorage.getItem('pmt.pro') === '1';",
    "let proUnlocked = true; // 已完美破解"
)

with open("play_cracked.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ 完美版生成完毕！")
