import os

file_path = "/storage/emulated/0/html存放地/eaglercraft1-8.html"

# 我们要注入到 HTML 末尾的 JS 代码
# 作用：每 1 秒扫描一次网页，发现英文按钮就替换成中文
js_code = """
<script>
setInterval(function() {
    var elements = document.querySelectorAll('div, span, button, a');
    elements.forEach(function(el) {
        if(el.innerText === 'Singleplayer') el.innerText = '单人游戏';
        if(el.innerText === 'Multiplayer') el.innerText = '多人游戏';
        if(el.innerText === 'Options...') el.innerText = '选项...';
        if(el.innerText === 'Quit Game') el.innerText = '退出游戏';
        if(el.innerText === 'Options') el.innerText = '选项';
        if(el.innerText === 'Language') el.innerText = '语言';
        if(el.innerText === 'Play') el.innerText = '开始';
    });
}, 1000);
</script>
</body>
"""

def inject_script():
    if not os.path.exists(file_path):
        print("找不到文件，请检查路径。")
        return

    print("正在读取 30MB 的大文件，请稍候...")
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # 检查是不是已经注入过了，防止重复注入
    if 'Singleplayer\') el.innerText' in content:
        print("已经汉化过了，不需要重复注入。")
        return

    # 找到最后一个 </body> 标签并替换
    if '</body>' in content:
        # 先做个备份
        print("正在备份原文件...")
        with open(file_path + '.bak', 'w', encoding='utf-8', errors='ignore') as f_bak:
            f_bak.write(content)
            
        print("正在注入汉化代码...")
        content = content.replace('</body>', js_code)
        
        with open(file_path, 'w', encoding='utf-8', errors='ignore') as f:
            f.write(content)
        print("✅ 汉化注入成功！现在去浏览器刷新页面看看。")
    else:
        print("❌ 没找到 </body> 标签，这个 HTML 结构比较特殊，可能没法自动注入。")

inject_script()
