#!/system/bin/sh
# 全屏渐变背景 + 只刷新进度条 - 兼容 MT 管理器终端 / Android sh
# 纯展示，不修改任何系统文件

ESC=$(printf '\033')

get_size() {
    size=$(stty size 2>/dev/null)
    ROWS=$(echo "$size" | awk '{print $1}')
    COLS=$(echo "$size" | awk '{print $2}')
    [ -z "$ROWS" ] && ROWS=20
    [ -z "$COLS" ] && COLS=40
    [ "$COLS" -lt 20 ] && COLS=20
    [ "$ROWS" -lt 10 ] && ROWS=10
}

rainbow_line() {
    local row=$1
    local line=""
    local x=0
    while [ $x -lt $COLS ]; do
        local hue=$(( (x * 360 / COLS + row * 12) % 360 ))
        local seg=$((hue / 60))
        local f=$((hue % 60))
        case $seg in
            0) r=255; g=$((f*255/60)); b=0 ;;
            1) r=$((255 - f*255/60)); g=255; b=0 ;;
            2) r=0; g=255; b=$((f*255/60)) ;;
            3) r=0; g=$((255 - f*255/60)); b=255 ;;
            4) r=$((f*255/60)); g=0; b=255 ;;
            5) r=255; g=0; b=$((255 - f*255/60)) ;;
        esac
        local c=$(( 16 + (r*5/255)*36 + (g*5/255)*6 + (b*5/255) ))
        line="${line}${ESC}[48;5;${c}m "
        x=$((x+1))
    done
    line="${line}${ESC}[0m"
    printf '%s' "$line"
}

# 画一次整屏背景
draw_bg() {
    clear
    printf '%s' "${ESC}[?25l"
    y=1
    while [ $y -le "$ROWS" ]; do
        rainbow_line "$y"
        printf '\n'
        y=$((y+1))
    done
}

# 只在中间行原地刷新进度条
draw_bar() {
    local text=$1
    local tlen=${#text}
    local left=$(( (COLS - tlen) / 2 ))
    [ $left -lt 0 ] && left=0
    # 定位到中间行、left 列
    printf '%s[%d;%dH' "$ESC" "$MID_ROW" "$((left+1))"
    printf '%s[K' "$ESC"   # 清掉该行剩余，防止残影
    printf '%s[38;5;226m%s%s[0m' "$ESC" "$text" "$ESC"
}

get_size
MID_ROW=$((ROWS/2 + 1))
bar_w=24

draw_bg

msg="正在加载"
chars="|/-\\"
start=$(date +%s)
duration=8
end=$((start + duration))

while :; do
    now=$(date +%s)
    [ "$now" -ge "$end" ] && break
    elapsed=$((now - start))
    pct=$((elapsed * 100 / duration))
    [ "$pct" -gt 100 ] && pct=100

    filled=$((pct * bar_w / 100))
    empty=$((bar_w - filled))
    bar=""
    j=0
    while [ $j -lt $filled ]; do bar="${bar}█"; j=$((j+1)); done
    j=0
    while [ $j -lt $empty ]; do bar="${bar}░"; j=$((j+1)); done

    case $pct in
        [0-9]) pstr="  $pct" ;;
        [0-9][0-9]) pstr=" $pct" ;;
        *) pstr="$pct" ;;
    esac

    c=$(printf '%s' "$chars" | cut -c $(( (elapsed / 1) % 4 + 1 )))
    text="${c} ${msg} [${bar}] ${pstr}%"
    draw_bar "$text"
    sleep 0.12
done

# 完成画面：只改中间行
text="✓ ${msg} 完成!"
tlen=${#text}
left=$(( (COLS - tlen) / 2 ))
[ $left -lt 0 ] && left=0
printf '%s[%d;%dH' "$ESC" "$MID_ROW" "$((left+1))"
printf '%s[K' "$ESC"
printf '%s[38;5;46m%s%s[0m' "$ESC" "$text" "$ESC"

printf '%s[?25h' "$ESC"
printf '\n'