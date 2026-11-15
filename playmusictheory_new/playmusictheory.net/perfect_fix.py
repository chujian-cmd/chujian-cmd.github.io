print("🩹 正在执行最温柔的精准破解...")
# 从最干净的原版开始
with open("play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 替换底层存储检查，直接让系统认为你买了
html = html.replace(
    "let proUnlocked = !!(NATIVE && NATIVE.pro) || localStorage.getItem('pmt.pro') === '1';",
    "let proUnlocked = true; // 解锁"
)

# 2. 强制修改变量，让 UI 显示为已解锁
html = html.replace("let pro = false;", "let pro = true;")

# 3. 物理超度第 1900 行的强制刷新
html = html.replace("location.reload();", "console.log('拦截重载');")

# 4. 稍微放宽一点报错拦截，只吞掉未处理的错误，不阻止程序继续往下跑
inject = """
<script>
window.addEventListener('error', function(e) {
    // 只在控制台打印，不阻止默认行为，也不弹窗
    console.log('拦截到错误:', e.message);
});
</script>
"""
html = html.replace("<head>", "<head>" + inject)

with open("play_cracked.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ 最纯净破解版生成！")
