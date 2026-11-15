import re

print("☢️ 正在执行终极核平破解...")
with open("play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 在最前面注入无视一切报错和刷新的代码
inject = """
<script>
try { localStorage.setItem('pmt.pro', '1'); } catch(e) {}
window.addEventListener('error', function(e) { e.preventDefault(); }, true);
// 暴力拦截底层跳转
Object.defineProperty(window, 'location', {
    value: { reload: function(){}, replace: function(){}, assign: function(){}, href: 'javascript:void(0)' },
    writable: false, configurable: false
});
</script>
"""
html = html.replace("<head>", "<head>" + inject)

# 2. 彻底干掉验证逻辑：把读取缓存的代码直接改成 true
html = re.sub(r'let proUnlocked = .*?;', 'let proUnlocked = true;', html)
html = re.sub(r'let pro = .*?;', 'let pro = true;', html)

# 3. 找到渲染界面并弹窗的那个函数，直接让它变成一个空函数 (什么都不做)
# 原代码可能是 function setPro(state) { ... } 我们直接改写
html = re.sub(r'function setPro\([^)]*\)\s*\{', 'function setPro() { return; /* 已被物理超度 */ ', html)

# 4. 不用 CSS 隐藏了，直接把弹窗的 HTML 结构删掉，但这会导致颜色面板一起死。
# 所以，我们在原位置塞一个新的、纯正的颜色面板进去（直接把原来弹窗里的颜色按钮 HTML 提出来，扔掉购买框）
# 为了保险，这里不强行删弹窗，而是给弹窗设一个非常遥远的绝对定位，不让它遮挡颜色
html = html.replace("</style>", "\n#codecard { display: none !important; }\n</style>")

with open("play_cracked.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ 核平完成！")
