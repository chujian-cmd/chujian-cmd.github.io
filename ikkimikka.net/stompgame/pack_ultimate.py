import os
import base64
import re
import sys
import urllib.request

MIME_TYPES = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
    '.json': 'application/json'
}

DOWNLOAD_CACHE = {}

def get_mime(path):
    ext = os.path.splitext(path)[1].lower()
    ext = ext.split('?')[0].split('#')[0]
    return MIME_TYPES.get(ext, 'application/octet-stream')

def fetch_to_base64(url):
    if url in DOWNLOAD_CACHE:
        return DOWNLOAD_CACHE[url]
    if url.startswith('//'):
        url = 'https:' + url
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = response.read()
            mime = response.headers.get_content_type()
            b64 = base64.b64encode(data).decode('utf-8')
            result = f"data:{mime};base64,{b64}"
            DOWNLOAD_CACHE[url] = result
            return result
    except Exception as e:
        print(f"⚠️ 下载失败: {url} ({e})")
        return None

def get_local_base64(filepath):
    if not os.path.isfile(filepath):
        return None
    mime = get_mime(filepath)
    try:
        with open(filepath, "rb") as f:
            data = f.read()
        b64 = base64.b64encode(data).decode('utf-8')
        return f"data:{mime};base64,{b64}"
    except Exception:
        return None

def main():
    print("=========================================")
    print("    通用单文件打包 (含 CDN 自动下载)")
    print("=========================================")
    
    target_dir = input("请输入网页所在目录 (直接回车代表当前目录): ").strip()
    if not target_dir:
        target_dir = "."
    target_dir = target_dir.strip("'\"")
    
    if not os.path.isdir(target_dir):
        print(f"❌ 错误：目录不存在 -> {target_dir}")
        sys.exit(1)
        
    html_file = None
    files = os.listdir(target_dir)
    for f in files:
        if f.lower() == "index.html":
            html_file = f
            break
    if not html_file:
        for f in files:
            if f.lower().endswith(".html"):
                html_file = f
                print(f"⚠️ 未找到 index.html，使用: {html_file}")
                break
                
    if not html_file:
        print("❌ 错误：没有找到任何 .html 文件！")
        sys.exit(1)
        
    html_path = os.path.join(target_dir, html_file)
    output_path = os.path.join(target_dir, "single_" + html_file)
    
    print(f"📖 正在读取 {html_file}...")
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    pattern = re.compile(r'(src|href)=["\']((?:https?:)?//[^"\']+|(?!http|//|#|data:)[^"\']+)["\']')
    def replace_attr(match):
        attr, path = match.groups()
        if path.startswith('//'):
            path = 'https:' + path
        if path.startswith('http'):
            print(f"🌐 正在下载 CDN: {path[:60]}...")
            b64 = fetch_to_base64(path)
        else:
            clean_path = path.split('?')[0].split('#')[0]
            if clean_path.startswith('./'): clean_path = clean_path[2:]
            full_path = os.path.join(target_dir, clean_path)
            b64 = get_local_base64(full_path)
            if b64:
                print(f"📦 已内联本地: {clean_path}")
        if b64:
            return f'{attr}="{b64}"'
        return match.group(0)

    html = pattern.sub(replace_attr, html)

    pattern_css = re.compile(r'url\(["\']?((?:https?:)?//[^"\')]+|(?!http|//|data:)[^"\')]+)["\']?\)')
    def replace_css(match):
        path = match.group(1)
        if path.startswith('//'):
            path = 'https:' + path
        if path.startswith('http'):
            print(f"🌐 正在下载 CDN (CSS): {path[:60]}...")
            b64 = fetch_to_base64(path)
        else:
            if path.startswith('./'): path = path[2:]
            full_path = os.path.join(target_dir, path)
            b64 = get_local_base64(full_path)
            if b64:
                print(f"📦 已内联本地 (CSS): {path}")
        if b64:
            return f'url({b64})'
        return match.group(0)

    html = pattern_css.sub(replace_css, html)

    pattern_js = re.compile(r'["\']((?:https?:)?//[^"\']+\.(?:js|css|png|jpg|gif|ogg|mp3|wav|ttf|otf|json)|(?:[a-zA-Z0-9_\-]+/)*[a-zA-Z0-9_\-]+\.(?:png|jpg|jpeg|gif|ogg|mp3|wav|ttf|otf|json))["\']')
    matches = pattern_js.findall(html)
    unique_paths = set(matches)

    for path in unique_paths:
        if path.startswith('//'):
            path = 'https:' + path
        if path.startswith('http'):
            print(f"🌐 正在下载 JS 资源: {path[:60]}...")
            b64 = fetch_to_base64(path)
        else:
            full_path = os.path.join(target_dir, path)
            b64 = get_local_base64(full_path)
            if b64:
                print(f"📦 已内联 JS 资源: {path}")
        if b64:
            html = html.replace(f'"{path}"', f'"{b64}"')
            html = html.replace(f"'{path}'", f"'{b64}'")

    print(f"💾 正在保存到 {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print("✅ 终极打包完成！")
    print("=========================================")

if __name__ == "__main__":
    main()
