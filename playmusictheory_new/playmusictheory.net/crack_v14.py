print("🔬 正在执行底层变量全覆盖...")
with open("play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 只改核心变量（保留原结构）
html = html.replace(
    "let proUnlocked = !!(NATIVE && NATIVE.pro) || localStorage.getItem('pmt.pro') === '1';",
    "let proUnlocked = true;"
)
html = html.replace("let pro = false;", "let pro = true;")

# 2. 找到 setPro 函数，看它内部是怎么写的。我们直接让它永远执行成功的那一步。
# 根据行号 1811，这个函数在初始化时执行。如果里面包含了 `if` 判断，我们把 `if (!on)` 屏蔽掉
html = html.replace("if (!proUnlocked || NATIVE) return;", "// 屏蔽校验")

# 3. 拦截所有可能触发弹窗的事件
html = html.replace("codecard.hidden = false; codein.focus();", "")
html = html.replace("codecard.hidden = false;", "")

with open("play_cracked.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ v14 生成完毕，直接用无痕模式测试！")
