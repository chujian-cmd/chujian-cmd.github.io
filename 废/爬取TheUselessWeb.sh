#!/bin/bash

# 配置
OUTPUT_DIR="/storage/emulated/0/html存放地"
BASE_URL="https://theuselessweb.com"
REQUEST_DELAY=3  # 请求间隔增加到3秒，更友好
USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 询问要爬取多少个网站
read -p "请输入要爬取的网站数量: " COUNT

# 验证输入是否为数字
if ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
    echo "错误：请输入有效的数字！"
    exit 1
fi

echo "开始爬取 $COUNT 个无用网站..."
echo "保存目录: $OUTPUT_DIR"
echo "------------------------"

# 循环爬取
for ((i=1; i<=COUNT; i++)); do
    echo "[$i/$COUNT] 正在从 $BASE_URL 获取随机网站..."
    
    # 1. 更稳健地获取最终跳转的URL
    # 使用 wget 的 --spider 和 -S 来跟踪重定向，并捕获最终的 Location 头
    # 或者简单地用 -O /dev/null 并跟踪重定向，但捕获最终URL更干净
    FINAL_URL=$(wget --spider -S "$BASE_URL" 2>&1 | grep -oP 'Location:\s*\K[^\s]+' | tail -1)
    
    # 如果上面的方法没抓到（可能没有重定向到外部），尝试下载页面并从内容中提取
    if [ -z "$FINAL_URL" ]; then
        # 备用方案：下载首页，从JavaScript跳转或链接中提取
        # 很多这种网站会返回一个简单的HTML做跳转
        HTML_CONTENT=$(wget -qO- --timeout=10 --user-agent="$USER_AGENT" "$BASE_URL")
        # 尝试匹配各种可能的跳转模式
        FINAL_URL=$(echo "$HTML_CONTENT" | grep -oP "(?:window\.location\s*=\s*['\"]|http-equiv=\"refresh\".*?url=)\K[^'\";\s]+" | head -1)
    fi

    if [ -z "$FINAL_URL" ]; then
        echo "  ⚠ 无法获取跳转URL，跳过..."
        sleep $REQUEST_DELAY
        continue
    fi

    # 2. 处理可能的相对路径
    if [[ "$FINAL_URL" == /* ]]; then
        # 是相对路径，需要补全域名（从原始请求中提取域名）
        DOMAIN=$(echo "$BASE_URL" | grep -oP 'https?://[^/]+')
        SITE_URL="${DOMAIN}${FINAL_URL}"
    else
        SITE_URL="$FINAL_URL"
    fi

    echo "  📍 目标网址: $SITE_URL"
    
    # 3. 生成安全的文件名和目录
    # 提取域名和路径作为文件名
    SAFE_NAME=$(echo "$SITE_URL" | sed -E 's|https?://||; s|[^a-zA-Z0-9._-]|_|g' | cut -c1-80)
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    SAVE_DIR="$OUTPUT_DIR/${TIMESTAMP}_${SAFE_NAME}"
    
    # 4. 优化下载命令，只下载单页及其依赖
    echo "  ⬇ 正在下载单页面及其资源（CSS/JS/图片）..."
    wget \
        --page-requisites \      # 下载页面需要的所有资源
        --html-extension \       # 将非HTML文件的后端处理文件保存为HTML
        --convert-links \        # 转换链接以支持本地浏览
        --restrict-file-names=windows \ # 避免特殊字符问题
        --no-directories \       # 不创建域名目录，所有文件扁平化保存（简化结构）
        --directory-prefix="$SAVE_DIR" \
        --timeout=15 \
        --tries=2 \
        --wait=1 \               # 请求资源间稍等
        --random-wait \          # 随机等待，更像人类行为
        --user-agent="$USER_AGENT" \
        --no-verbose \
        "$SITE_URL" 2>&1 | tail -5 # 显示最后几行日志，便于判断成功与否
    
    # 检查wget的退出状态码
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        # 创建一个简单的索引文件，方便直接点击浏览
        INDEX_FILE=$(ls "$SAVE_DIR"/*.html 2>/dev/null | head -1)
        if [ -n "$INDEX_FILE" ]; then
            echo "  ✅ 成功保存到: $SAVE_DIR"
            echo "  📄 入口文件: $INDEX_FILE"
        else
            echo "  ⚠ 下载完成但未找到HTML文件，请检查目录: $SAVE_DIR"
        fi
    else
        echo "  ❌ 下载失败，可能网站无法访问或资源下载出错"
        # 清理可能创建的空目录
        rmdir "$SAVE_DIR" 2>/dev/null
    fi
    
    echo "------------------------"
    
    # 请求间延迟
    if [ $i -lt $COUNT ]; then
        sleep $REQUEST_DELAY
    fi
done

echo "全部完成！共尝试爬取 $COUNT 个网站"
echo "文件保存在: $OUTPUT_DIR"