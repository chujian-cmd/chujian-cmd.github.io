#!/system/bin/sh
# 流畅版全屏渐变 + 原地进度条 - 兼容 MT 管理器终端 / Android sh
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

# 预生成 4 帧旋转光标，避免每帧 cut
FRAMES="|"
FRAMES="$FRAMES"$'\n'"/"
FRAMES="$FRAMES"$'\n'"-"
FRAMES="$FRAMES"$'\n'"\\"

get_size
MID_ROW=$((ROWS/2 + 1))
bar_w=24
TOTAL_FRAMES=400          # 400 帧 × 0.05s ≈ 20s 可调
sleep_t=0.05

clear
printf '%s' "${ESC}[?25l"

# 背景只画一次
y=1
while [ $y -le "$ROWS" ]; do
    rainbow_line "$y"
    printf '\n'
    y=$((y+1))
done

# 预生成进度条模板，减少循环
EMPTY_BAR=""
j=0
while [ $j -lt $bar_w ]; do EMPTY_BAR="${EMPTY_BAR}░"; j=$((j+1)); done

msg="正在加载"
frame=0

while [ $frame -lt $TOTAL_FRAMES ]; do
    pct=$((frame * 100 / TOTAL_FRAMES))
    filled=$((pct * bar_w / 100))
    empty=$((bar_w - filled))

    # 用预生成串切片拼进度条（纯 sh 无 ${var:i:l}，用 cut 但只在变化时算）
    if [ "$filled" -ne "${last_filled:-1}" ]; then
        bar=""
        j=0
        while [ $j -lt $filled ]; do bar="${bar}█"; j=$((j+1)); done
        j=0
        while [ $j -lt $empty ]; do bar="${bar}░"; j=$((j+1)); done
        last_filled=$filled
    fi

    case $pct in
        [0-9]) pstr="  $pct" ;;
        [0-9][0-9]) pstr=" $pct" ;;
        *) pstr="$pct" ;;
    esac

    # 旋转光标用帧号取模，不调 cut
    idx=$((frame % 4))
    case $idx in
        0) c="|" ;;
        1) c="/" ;;
        2) c="-" ;;
        3) c="\\" ;;
    esac

    text="${c} ${msg} [${bar}] ${pstr}%"
    tlen=${#text}
    left=$(( (COLS - tlen) / 2 ))
    [ $left -lt 0 ] && left=0

    # 原地刷新：定位 → 清行 → 打印
    printf '%s[%d;%dH%s[K%s[38;5;226m%s%s[0m' \
        "$ESC" "$MID_ROW" "$((left+1))" "$ESC" "$ESC" "$text" "$ESC"

    frame=$((frame+1))
    sleep "$sleep_t"
done

# 完成
text="✓ ${msg} 完成!"
tlen=${#text}
left=$(( (COLS - tlen) / 2 ))
[ $left -lt 0 ] && left=0
printf '%s[%d;%dH%s[K%s[38;5;46m%s%s[0m' \
    "$ESC" "$MID_ROW" "$((left+1))" "$ESC" "$ESC" "$text" "$ESC"

printf '%s[?25h' "$ESC"
printf '\n'