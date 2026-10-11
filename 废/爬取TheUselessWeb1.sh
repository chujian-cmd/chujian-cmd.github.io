#!/bin/bash
# ============================================================
# 优化版 TheUselessWeb 爬取脚本
# 从 theuselessweb.com 获取随机跳转网站，并下载完整页面
# ============================================================

# 配置
OUTPUT_DIR="/storage/emulated/0/html存放地/the-useless-sites"
BASE_URL="https://theuselessweb.com"
USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 询问要爬取多少个网站
read -p "请输入要爬取的无用网站数量: " COUNT

# 验证输入是否为数字
if ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
    echo "❌ 错误：请输入有效的数字！"
    exit 1
fi

echo "📥 开始爬取 $COUNT 个随机无用网站..."
echo "📂 保存目录: $OUTPUT_DIR"
echo "=============================="

# 计数器
SUCCESS=0
FAIL=0

for ((i=1; i<=COUNT; i++)); do
    echo ""
    echo "[$i/$COUNT] 正在获取随机跳转..."
    
    # 1. 获取 theuselessweb.com 的页面源码
    HTML_CONTENT=$(curl -sL --user-agent "$USER_AGENT" "$BASE_URL")
    
    # 2. 尝试提取跳转 URL
    # 方法1: 查找 window.location.href = "..."
    TARGET_URL=$(echo "$HTML_CONTENT" | grep -oP 'window\.location\.href\s*=\s*["'\'']?\K[^"'\''\s]+' | head -1)
    
    # 方法2: 查找 location.href = "..."
    if [ -z "$TARGET_URL" ]; then
        TARGET_URL=$(echo "$HTML_CONTENT" | grep -oP 'location\.href\s*=\s*["'\'']?\K[^"'\''\s]+' | head -1)
    fi
    
    # 方法3: 查找 meta refresh 跳转
    if [ -z "$TARGET_URL" ]; then
        TARGET_URL=$(echo "$HTML_CONTENT" | grep -oP 'http-equiv="refresh".*?url=\K[^"'\''\s]+' | head -1)
    fi
    
    # 方法4: 查找 a 标签中的链接（作为最后的备选）
    if [ -z "$TARGET_URL" ]; then
        TARGET_URL=$(echo "$HTML_CONTENT" | grep -oP '<a[^>]+href="\K[^"]+' | head -1)
    fi
    
    # 如果还是没找到，跳过
    if [ -z "$TARGET_URL" ]; then
        echo "  ⚠️ 无法提取跳转 URL，跳过..."
        FAIL=$((FAIL+1))
        sleep 1
        continue
    fi
    
    # 3. 处理相对路径
    if [[ "$TARGET_URL" == /* ]]; then
        DOMAIN=$(echo "$BASE_URL" | grep -oP 'https?://[^/]+')
        TARGET_URL="${DOMAIN}${TARGET_URL}"
    fi
    
    echo "  🎯 目标网站: $TARGET_URL"
    
    # 4. 提取域名作为文件名
    SAFE_NAME=$(echo "$TARGET_URL" | sed -E 's|https?://||' | sed 's|/.*||' | sed 's/[^a-zA-Z0-9._-]/_/g')
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    SAVE_DIR="$OUTPUT_DIR/${TIMESTAMP}_${SAFE_NAME}"
    
    # 5. 用 wget 下载目标网站（只下载单页及资源）
    echo "  ⬇️ 下载完整页面..."
    wget \
        --page-requisites \
        --html-extension \
        --convert-links \
        --restrict-file-names=windows \
        --directory-prefix="$SAVE_DIR" \
        --timeout=30 \
        --tries=3 \
        --wait=1 \
        --user-agent="$USER_AGENT" \
        --no-verbose \
        "$TARGET_URL" 2>&1 | tail -3
    
    # 6. 检查是否成功
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        echo "  ✅ 成功保存到: $SAVE_DIR"
        SUCCESS=$((SUCCESS+1))
    else
        echo "  ❌ 下载失败"
        FAIL=$((FAIL+1))
        rmdir "$SAVE_DIR" 2>/dev/null
    fi
    
    echo "=============================="
    
    # 请求间隔
    if [ $i -lt $COUNT ]; then
        sleep 2
    fi
done

echo ""
echo "📊 爬取完成！"
echo "   ✅ 成功: $SUCCESS 个"
echo "   ❌ 失败: $FAIL 个"
echo "📂 文件保存在: $OUTPUT_DIR"