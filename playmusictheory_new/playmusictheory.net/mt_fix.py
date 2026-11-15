import re

print("🛠️ 正在强制激活 MT 像素模式...")
with open("single_play.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 干掉桌面版的强制降级判定
# 源码 1364 行： if (window.innerWidth >= 760 && program === 3) setProgram(1);
html = html.replace("if (window.innerWidth >= 760 && program === 3) setProgram(1);", "// MT 桌面判定已移除")

# 2. 干掉进度条的计算依赖，有些内核不支持可能会导致线程卡死
# 源码 2800 行附近： recCanvas.captureStream(30)
html = html.replace("recCanvas.captureStream(30)", "new MediaStream()") 

with open("mt_fix.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ 修复完成，生成 mt_fix.html")
