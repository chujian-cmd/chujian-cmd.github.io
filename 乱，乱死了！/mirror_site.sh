#!/bin/bash
BASE_DIR="/storage/emulated/0/html存放地"
cd "$BASE_DIR" || exit 1
WORK_DIR="$BASE_DIR/_mirror_work"
URL_FILE="$WORK_DIR/urls.txt"
REF_FILE="$WORK_DIR/refs_found.txt"
mkdir -p "$WORK_DIR" || exit 1

echo "保存位置: $BASE_DIR"
echo "=========================================="
read -r -p "请输入入口网址 (例如 https://example.com): " ENTRY_URL
[ -z "$ENTRY_URL" ] && exit 1

case "$ENTRY_URL" in http://*|https://*) ;; *) ENTRY_URL="https://$ENTRY_URL" ;; esac

DOMAIN=$(echo "$ENTRY_URL" | sed -E 's#https?://##; s#/.*##')
SITE_DIR="$BASE_DIR/$DOMAIN"
mkdir -p "$SITE_DIR"

# 提取域名前缀（例如 https://books.toscrape.com）
HOST_PREFIX="$(echo "$ENTRY_URL" | sed -E 's#(https?://[^/]+).*#\1#')"

echo "[1/5] 下载入口页: $ENTRY_URL"
ENTRY_HTML="$WORK_DIR/entry.html"
curl -L -s -A "Mozilla/5.0 (Linux; Android 10)" --connect-timeout 10 --max-time 60 -o "$ENTRY_HTML" "$ENTRY_URL"
[ -s "$ENTRY_HTML" ] || { echo "入口页下载失败，退出。"; exit 1; }

echo "[2/5] 分析入口页引用..."
: > "$URL_FILE"; : > "$REF_FILE"
grep -oE '(src|href|action)=["'"'"'][^"'"'"']+["'"'"']' "$ENTRY_HTML" | sed -E 's/^[^=]+=["'"'"']//; s/["'"'"']$//' >> "$REF_FILE"
grep -oE 'url\([^)]+\)' "$ENTRY_HTML" | sed -E 's/^url\(//; s/\)$//; s/["'"'"']//g' >> "$REF_FILE"
echo "$ENTRY_URL" >> "$REF_FILE"

sort -u "$REF_FILE" | grep -v '^$' | grep -v '^#' | grep -v '^javascript:' | grep -v '^mailto:' > "$REF_FILE.tmp"; mv "$REF_FILE.tmp" "$REF_FILE"

echo "[3/5] 并行检查 CSS/JS 中的引用（16并发）..."
TMP_DL="$WORK_DIR/tmp_dl"; mkdir -p "$TMP_DL"
ENTRY_HOST=$(echo "$ENTRY_URL" | sed -E 's#https?://([^/]+).*#\1#')

: > "$WORK_DIR/check_list.txt"
while IFS= read -r ref; do
    [ -z "$ref" ] && continue
    case "$ref" in
        http://*|https://*) ABS="$ref" ;;
        //*) ABS="https:${ref}" ;;
        /*) ABS="$HOST_PREFIX$ref" ;;
        *) ABS="$(echo "$ENTRY_URL" | sed -E 's#/[^/]*$#/#' )$ref" ;;
    esac
    case "$ABS" in *.css|*.js|*.html|*.htm|*.php|*.json) ;; *) continue ;; esac
    ABS_HOST=$(echo "$ABS" | sed -E 's#https?://([^/]+).*#\1#')
    [ "$ABS_HOST" != "$ENTRY_HOST" ] && continue
    echo "$ABS" >> "$WORK_DIR/check_list.txt"
done < "$REF_FILE"
sort -u "$WORK_DIR/check_list.txt" -o "$WORK_DIR/check_list.txt"

check_one() {
    ABS="$1"
    FNAME=$(echo "$ABS" | md5sum | awk '{print $1}')
    curl -L -s -A "Mozilla/5.0" --connect-timeout 5 --max-time 15 -o "$TMP_DL/$FNAME" "$ABS" 2>/dev/null
    if [ -s "$TMP_DL/$FNAME" ]; then
        grep -oE '(src|href)=["'"'"'][^"'"'"']+["'"'"']' "$TMP_DL/$FNAME" | sed -E 's/^[^=]+=["'"'"']//; s/["'"'"']$//'
    fi
}
export -f check_one
export TMP_DL
xargs -P 16 -I {} bash -c 'check_one "$@"' _ {} < "$WORK_DIR/check_list.txt" >> "$REF_FILE" 2>/dev/null

sort -u "$REF_FILE" | grep -v '^$' | grep -v '^javascript:' | grep -v '^mailto:' > "$REF_FILE.tmp"; mv "$REF_FILE.tmp" "$REF_FILE"

echo "[4/5] 汇总到 TXT: $URL_FILE"
echo "$ENTRY_URL" > "$URL_FILE"
while IFS= read -r ref; do
    [ -z "$ref" ] && continue
    echo "$ref" | grep -qE '^[a-zA-Z0-9_\-\./:?=&%#+@]+$' || continue
    
    # 第一步：先转成绝对路径
    case "$ref" in
        http://*|https://*) ABS="$ref" ;;
        //*) ABS="https:${ref}" ;;
        /*) ABS="$HOST_PREFIX$ref" ;;
        *) ABS="$(echo "$ENTRY_URL" | sed -E 's#/[^/]*$#/#' )$ref" ;;
    esac
    
    # 第二步：清理路径中的 ../ 和 ./
    CLEAN_PATH=$(echo "$ABS" | awk '{
        n=split($0, a, "/");
        res="";
        for(i=1; i<=n; i++) {
            if(a[i]=="..") { sub(/\/[^\/]*$/, "", res); }
            else if(a[i]!="." && a[i]!="") { res=res "/" a[i]; }
        }
        print res;
    }' | sed "s#^//#https://#; s#^/https:/#https:/#")
    
    # 核心修复：如果清理后的路径是以 / 开头（说明域名被吃掉了），补回域名
    case "$CLEAN_PATH" in
        /*) CLEAN_PATH="$HOST_PREFIX$CLEAN_PATH" ;;
    esac
    
    [ -z "$CLEAN_PATH" ] && CLEAN_PATH="$ABS"
    echo "$CLEAN_PATH"
done < "$REF_FILE" | sort -u > "$URL_FILE"

echo "  共收集 $(wc -l < "$URL_FILE") 个有效 URL"

echo "[5/5] 并行下载到: $SITE_DIR （16并发）"
export SITE_DIR
download_one() {
    u="$1"
    REL_PATH=$(echo "$u" | sed -E 's#https?://[^/]+/?##')
    REL_PATH=$(echo "$REL_PATH" | sed 's#?.*##')
    
    [ -z "$REL_PATH" ] && REL_PATH="index.html"
    case "$REL_PATH" in */) REL_PATH="${REL_PATH}index.html" ;; esac

    OUT_FILE="$SITE_DIR/$REL_PATH"
    OUT_DIR=$(dirname "$OUT_FILE")
    mkdir -p "$OUT_DIR" 2>/dev/null

    curl -L -f -s -A "Mozilla/5.0 (Linux; Android 10)" \
         --connect-timeout 5 --max-time 30 \
         -o "$OUT_FILE" "$u" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "  [成功] $REL_PATH"
    else
        echo "  [失败] $u"
    fi
}
export -f download_one

xargs -P 16 -I {} bash -c 'download_one "$@"' _ {} < "$URL_FILE"

OK=$(find "$SITE_DIR" -type f | wc -l)
echo ""
echo "=========================================="
echo "  完成！已保存文件数: $OK"
echo "  保存位置: $SITE_DIR"
echo "=========================================="
