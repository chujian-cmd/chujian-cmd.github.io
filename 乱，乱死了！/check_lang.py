import os

file_path = "/storage/emulated/0/html存放地/eaglercraft1-8.html"

if not os.path.exists(file_path):
    print("找不到文件，请检查路径。")
    exit()

print("正在扫描 30MB 的单文件，请稍候...")

with open(file_path, 'rb') as f:
    content = f.read()

keywords = [b"singleplayer", b"multiplayer", b"en_us", b"zh_cn", b"{\"block.minecraft"]
found = False

for kw in keywords:
    index = content.find(kw)
    if index != -1:
        print(f"✅ 找到了关键字: {kw.decode('utf-8')}，位置在: {index}")
        start = max(0, index - 50)
        end = min(len(content), index + 150)
        print(f"   上下文内容: {content[start:end]}")
        found = True

if not found:
    print("❌ 没有找到明文的语言文件。")
