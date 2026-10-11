#!/bin/bash
# ============================================================
# 随机网站发现+下载脚本
# 从 randomwebsite.com 获取随机跳转网站并下载
# ============================================================

OUTPUT_DIR="/storage/emulated/0/html存放地/random-sites"
BASE_URL="https://www.randomwebsite.com"
USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

mkdir -p "$OUTPUT_DIR"

read -p "请输入要获取的网站数量: " COUNT

if ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
    echo "❌ 请输入有效数字"
    exit 1
fi

echo "📥 开始获取 $COUNT 个随机网站..."
echo "📂 保存目录: $OUTPUT_DIR"
echo "=============================="

SUCCESS=0
FAIL=0

for ((i=1; i<=COUNT; i++)); do
    echo ""
    echo "[$i/$COUNT] 正在获取随机网站..."
    
    # 获取页面源码，寻找跳转链接
    HTML=$(curl -sL --user-agent "$USER_AGENT" "$BASE_URL")
    
    # 尝试提取跳转 URL
    TARGET=$(echo "$HTML" | grep -oP '(?:href|window\.location\.href)\s*=\s*["'\'']?\K[^"'\''\s]+' | head -1)
    
    if [ -z "$TARGET" ]; then
        echo "  ⚠️ 无法提取跳转 URL，尝试备用方式..."
        # 有些网站会直接在页面里显示链接
        TARGET=$(echo "$HTML" | grep -oP 'https?://[^"\s]+' | head -1)
    fi
    
    if [ -z "$TARGET" ]; then
        echo "  ❌ 未找到任何链接，跳过..."
        FAIL=$((FAIL+1))
        sleep 1
        continue
    fi
    
    echo "  🎯 目标: $TARGET"
    
    # 提取域名
    DOMAIN=$(echo "$TARGET" | sed -E 's|https?://||' | sed 's|/.*||' | sed 's/[^a-zA-Z0-9._-]/_/g')
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    SAVE_DIR="$OUTPUT_DIR/${TIMESTAMP}_${DOMAIN}"
    
    echo "  ⬇️ 下载页面..."
    wget --page-requisites --html-extension --convert-links \
         --directory-prefix="$SAVE_DIR" --timeout=30 --tries=3 \
         --user-agent="$USER_AGENT" --no-verbose "$TARGET" 2>&1 | tail -3
    
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        echo "  ✅ 成功保存到: $SAVE_DIR"
        SUCCESS=$((SUCCESS+1))
    else
        echo "  ❌ 下载失败"
        FAIL=$((FAIL+1))
        rmdir "$SAVE_DIR" 2>/dev/null
    fi
    
    echo "=============================="
    sleep 2
done

echo ""
echo "📊 完成！成功: $SUCCESS, 失败: $FAIL"
echo "📂 保存在: $OUTPUT_DIR"