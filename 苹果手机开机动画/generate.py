import os, re, json

base_dir = "/storage/emulated/0/html存放地/苹果手机开机动画/SF-Hello/SVG"
output_file = "/storage/emulated/0/html存放地/苹果手机开机动画/multi-hello.html"

# 语言代码对照表
lang_names = {
    "en": "英语", "zh-Hans": "简体中文", "zh-Hant": "繁體中文", "zh_HK": "粤语(香港)",
    "ja": "日语", "ko": "韩语", "ru": "俄语", "fr": "法语", "de": "德语", "es": "西班牙语",
    "it": "意大利语", "pt": "葡萄牙语", "pt_BR": "葡萄牙语(巴西)", "ar": "阿拉伯语",
    "hi": "印地语", "th": "泰语", "vi": "越南语", "id": "印尼语", "ms": "马来语",
    "tr": "土耳其语", "nl": "荷兰语", "pl": "波兰语", "sv": "瑞典语", "da": "丹麦语",
    "nb": "挪威语", "fi": "芬兰语", "cs": "捷克语", "sk": "斯洛伐克语", "hu": "匈牙利语",
    "ro": "罗马尼亚语", "bg": "保加利亚语", "el": "希腊语", "he": "希伯来语", "uk": "乌克兰语",
    "ca": "加泰罗尼亚语", "hr": "克罗地亚语", "kk": "哈萨克语"
}

svg_data = {}

# 读取所有 SVG 文件
for filename in os.listdir(base_dir):
    if not filename.endswith(".svg"): continue
    
    lang_code = filename.replace("hello-", "").replace(".svg", "")
    if lang_code == "hello": lang_code = "en"
    
    display_name = lang_names.get(lang_code, lang_code) # 获取中文名
    
    filepath = os.path.join(base_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    viewBox_match = re.search(r'viewBox="([^"]+)"', content)
    viewBox = viewBox_match.group(1) if viewBox_match else "0 0 2000 1000"
    
    transform_match = re.search(r'transform="([^"]+)"', content)
    transform = transform_match.group(1) if transform_match else ""
    
    paths = re.findall(r'<path[^>]+d="([^"]+)"', content)
    
    svg_data[lang_code] = {
        "name": display_name,
        "viewBox": viewBox,
        "transform": transform,
        "paths": paths
    }

# 生成 HTML
html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Apple Hello - 多语言版</title>
<style>
  body {{ margin: 0; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000; overflow: hidden; font-family: -apple-system, sans-serif; }}
  #svg-container {{ width: 80vw; max-width: 800px; height: 30vh; display: flex; align-items: center; justify-content: center; }}
  svg {{ width: 100%; height: 100%; overflow: visible; }}
  path {{ fill: none; stroke: #fff; stroke-width: 60; stroke-linecap: round; stroke-linejoin: round; }}
  /* 菜单区域，加上滚动条防止语言太多溢出 */
  #language-menu {{ margin-top: 30px; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; max-width: 90vw; max-height: 40vh; overflow-y: auto; opacity: 0; pointer-events: none; transition: opacity 0.8s ease; padding: 10px; }}
  #language-menu.show {{ opacity: 1; pointer-events: auto; }}
  button {{ background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 8px 12px; border-radius: 15px; font-size: 13px; cursor: pointer; }}
  button:hover {{ background: rgba(255,255,255,0.3); }}
</style>
</head>
<body>
<div id="svg-container"></div>
<div id="language-menu"></div>

<script>
  const svgData = {json.dumps(svg_data, ensure_ascii=False)};
  const container = document.getElementById('svg-container');
  const menu = document.getElementById('language-menu');

  // 按中文名排序
  const sortedKeys = Object.keys(svgData).sort((a, b) => svgData[a].name.localeCompare(svgData[b].name, 'zh'));

  // 自动生成按钮
  sortedKeys.forEach(lang => {{
    const btn = document.createElement('button');
    btn.textContent = svgData[lang].name;
    btn.onclick = () => playAnimation(lang);
    menu.appendChild(btn);
  }});

  function playAnimation(langCode) {{
    const data = svgData[langCode];
    if (!data) return;
    
    container.innerHTML = '';
    menu.classList.remove('show');

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", data.viewBox);
    
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    if (data.transform) g.setAttribute("transform", data.transform);
    svg.appendChild(g);

    let totalTime = 0;

    data.paths.forEach((d, index) => {{
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      g.appendChild(path);

      const length = path.getTotalLength();
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = length;

      const duration = 1.2; 
      const delay = index * 0.3; 
      totalTime = Math.max(totalTime, delay + duration);

      path.animate([
        {{ strokeDashoffset: length }},
        {{ strokeDashoffset: 0 }}
      ], {{
        duration: duration * 1000,
        delay: delay * 1000,
        easing: 'ease-in-out',
        fill: 'forwards'
      }});
    }});

    container.appendChild(svg);

    // 动画全部播完后显示菜单
    setTimeout(() => {{
      menu.classList.add('show');
    }}, (totalTime + 0.5) * 1000);
  }}

  // 默认播放英语
  playAnimation('en');
</script>
</body>
</html>
"""

with open(output_file, "w", encoding="utf-8") as f:
    f.write(html_template)

print(f"✅ 成功！已生成带中文名的多语言文件")
