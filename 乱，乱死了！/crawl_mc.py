import os
import urllib.request
import re
from urllib.parse import urljoin

base_url = "https://7.mcjslink.144449.xyz/1.8.8/"
save_dir = "/storage/emulated/0/html存放地/mc_web/"
os.makedirs(save_dir, exist_ok=True)

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

print("正在获取主页面...")
req = urllib.request.Request(base_url, headers=headers)
html = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')

# 保存主页面
with open(os.path.join(save_dir, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(html)
print("✅ 主页面已保存")

# 找所有依赖文件
pattern = r'(?:src|href)=["\']([^"\']+\.(?:js|wasm|css|png|zip))["\']'
files = re.findall(pattern, html)

print(f"发现 {len(files)} 个资源文件，开始下载...")
for file_url in set(files):
    full_url = urljoin(base_url, file_url)
    file_name = full_url.split('/')[-1].split('?')[0]
    if not file_name: continue
    
    save_path = os.path.join(save_dir, file_name)
    if os.path.exists(save_path):
        continue
        
    print(f"下载: {file_name} ...")
    try:
        req = urllib.request.Request(full_url, headers=headers)
        data = urllib.request.urlopen(req).read()
        with open(save_path, 'wb') as f:
            f.write(data)
    except Exception as e:
        print(f"❌ 失败: {file_name} - {e}")

print("\n🎉 爬取完成！去文件夹里打开 index.html 试试。")
