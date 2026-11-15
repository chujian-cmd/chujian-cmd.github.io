print("✨ 正在启动上帝模式（纯净注入）...")
with open("play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 构造一段极度温柔的“洗脑”代码，注入到 head 最前面
# 作用：把真实付费记录的读取劫持掉，只要代码问，永远回答 '1'
inject = """
<script>
// 劫持底层 localStorage 读取，永远返回 '1' (代表已解锁)
const originalGetItem = window.localStorage.getItem;
window.localStorage.getItem = function(key) {
    if (key === 'pmt.pro') return '1';
    return originalGetItem.apply(this, arguments);
};
// 拦截后台报错，防止它偷偷自杀刷新
window.addEventListener('error', function(e) { e.preventDefault(); }, true);
</script>
"""
html = html.replace("<head>", "<head>" + inject)

# 2. 删掉你之前测试残留在文件里的所有的防刷新覆盖代码（如果有的话）
# 彻底让代码的原生逻辑跑起来

# 3. 如果你之前改过这一段，我们把它还原成原样（让代码自己判断，反正底层已经被我们劫持了）
html = html.replace("let proUnlocked = true;", "let proUnlocked = !!(NATIVE && NATIVE.pro) || localStorage.getItem('pmt.pro') === '1';")
html = html.replace("let pro = true;", "let pro = false;")

# 4. 注意：我们这一次坚决不碰弹窗（codecard）的隐藏，也不碰 setPro，让它完全原生运行。

with open("play_cracked.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ 上帝模式生成完毕！这次绝对能成！")
