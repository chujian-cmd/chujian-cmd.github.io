import os

file_path = "/storage/emulated/0/html存放地/eaglercraft1-8.html"

# 用普通字符串，直接写中文
replacements = {
    '"Singleplayer"': '"单人游戏"',
    '"Multiplayer"': '"多人游戏"',
    '"Options..."': '"选项..."',
    '"Options"': '"选项"',
    '"Language"': '"语言"',
    '"Quit Game"': '"退出游戏"'
}

if not os.path.exists(file_path):
    print("找不到文件")
    exit()

print("正在读取文件...")
# 用 utf-8 读取
with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

count = 0
for old, new in replacements.items():
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"替换成功: {old}")

if count > 0:
    # 用 utf-8 写回
    with open(file_path, 'w', encoding='utf-8', errors='ignore') as f:
        f.write(content)
    print(f"\n✅ 完成！共替换了 {count} 处。去浏览器刷新看看！")
else:
    print("❌ 没找到这些带引号的词，可能游戏用的是别的格式。")
