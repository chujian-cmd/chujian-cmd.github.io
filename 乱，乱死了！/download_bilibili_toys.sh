#!/bin/bash

cd /storage/emulated/0/html存放地

# 创建主目录
mkdir -p bilibili-toys
cd bilibili-toys

echo "📥 开始下载 B站互动玩具..."

# 所有玩具链接
urls=(
  "https://www.bilibili.com/toy/bili/index.html"
  "https://www.bilibili.com/toy/flipclock/index.html"
  "https://www.bilibili.com/toy/HDOWS-sheng/index.html"
  "https://www.bilibili.com/toy/doubao/index.html"
  "https://www.bilibili.com/toy/Lahai-Roi-cube/index.html"
  "https://www.bilibili.com/toy/pixel-painter/index.html"
  "https://www.bilibili.com/toy/ds4pro-3dracing/index.html"
  "https://www.bilibili.com/toy/clock/index.html"
  "https://www.bilibili.com/toy/particle-canvas/index.html"
  "https://www.bilibili.com/toy/zeGE4YjJBvFdZVVq/index.html"
  "https://www.bilibili.com/toy/CXbWR3p33wojY2CM/index.html"
  "https://www.bilibili.com/toy/vN8Fr5iduDeMLZR3/index.html"
  "https://www.bilibili.com/toy/hungry-runner/index.html"
  "https://www.bilibili.com/toy/rhythm-hold/index.html"
  "https://www.bilibili.com/toy/otto-hzys/index.html"
  "https://www.bilibili.com/toy/xyt_koutu/index.html"
  "https://www.bilibili.com/toy/meituanlaoshu/index.html"
  "https://www.bilibili.com/toy/SveLtIZ9qz77m3lL/index.html"
  "https://www.bilibili.com/toy/vibe-coding-kemu1/index.html"
  "https://www.bilibili.com/toy/Y2qvnJ7kdV8cDH44/index.html"
  "https://www.bilibili.com/toy/liangshen/index.html"
  "https://www.bilibili.com/toy/manualtracking/index.html"
  "https://www.bilibili.com/toy/qiling-gomoku/index.html"
  "https://www.bilibili.com/toy/gamedo/index.html"
  "https://www.bilibili.com/toy/shussia/index.html"
  "https://www.bilibili.com/toy/miaoqie-video-toolkit/index.html"
  "https://www.bilibili.com/toy/van-gogh-crows/index.html"
  "https://www.bilibili.com/toy/adofai/index.html"
  "https://www.bilibili.com/toy/camera-demo/index.html"
  "https://www.bilibili.com/toy/lSAvrlxcd2kgjYdj/index.html"
  "https://www.bilibili.com/toy/zhuzhiliao-battle/index.html"
  "https://www.bilibili.com/toy/gOXEuaTKfTgGbKjJ/index.html"
  "https://www.bilibili.com/toy/BtxdfAdqX4jUzGKS/index.html"
  "https://www.bilibili.com/toy/uqpdTDfoQDbhJNes/index.html"
  "https://www.bilibili.com/toy/mirror/index.html"
  "https://www.bilibili.com/toy/mizuki-chibi/index.html"
  "https://www.bilibili.com/toy/panorama-360/index.html"
  "https://www.bilibili.com/toy/mineguess/index.html"
  "https://www.bilibili.com/toy/webcraft-minecraft/index.html"
  "https://www.bilibili.com/toy/square/index.html"
  "https://www.bilibili.com/toy/vtb/index.html"
  "https://www.bilibili.com/toy/game/index.html"
  "https://www.bilibili.com/toy/cyber/index.html"
  "https://www.bilibili.com/toy/D1xVrueGpRjKsqxN/index.html"
  "https://www.bilibili.com/toy/chess/index.html"
  "https://www.bilibili.com/toy/MemeMash/index.html"
  "https://www.bilibili.com/toy/Ji-mi-dou/index.html"
  "https://www.bilibili.com/toy/YmMvNRJDNp6gRKsk/index.html"
  "https://www.bilibili.com/toy/shadow-sausage-bidao/index.html"
)

count=0
total=${#urls[@]}

for url in "${urls[@]}"; do
  # 提取路径中的玩具名称（如 bili, flipclock 等）
  name=$(echo "$url" | sed -E 's|https://www.bilibili.com/toy/([^/]+)/.*|\1|')
  echo "[$((++count))/$total] 下载: $name"
  
  mkdir -p "$name"
  cd "$name"
  wget -r -l 2 -np -k -p --page-requisites --adjust-extension --no-check-certificate --user-agent="Mozilla/5.0" "$url" 2>/dev/null
  cd ..
done

echo "🎉 所有玩具下载完成！"
