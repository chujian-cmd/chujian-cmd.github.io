import base64, pathlib

base = pathlib.Path("/storage/emulated/0/html存放地")
html_path = base / "个人主页.s.min.html"

fonts = [
    "宋体pua.subset.woff2",
    "zcool_qingke_huangyou.subset.woff2",
    "FZCuYuan-M03S.subset.woff2",
    "cubic_11.subset.woff2",
    "cormorant_garamond_italic_vf.woff2",
    "mw_bold.woff2",
    "FZLanTYJW_Zhun.subset.woff2",
    "FZLanTYJW_Cu.subset.woff2",
    "DINNextRoundedLTPro-Bold.woff2",
    "DINNextRoundedLTPro-Medium.woff2",
]

html = html_path.read_text(encoding="utf-8")

for name in fonts:
    fp = base / name
    if not fp.exists():
        print(f"缺失，跳过：{name}")
        continue
    b64 = base64.b64encode(fp.read_bytes()).decode()
    uri = f"data:font/woff2;base64,{b64}"
    old = f'url("{name}")'
    if old not in html:
        print(f"HTML 里没找到引用，跳过：{name}")
        continue
    html = html.replace(old, f'url("{uri}")')
    print(f"已内嵌：{name}  ({fp.stat().st_size//1024}K)")

html_path.write_text(html, encoding="utf-8")
print("完成 →", html_path)
