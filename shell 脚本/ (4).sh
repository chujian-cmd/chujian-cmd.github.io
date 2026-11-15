#!/system/bin/sh
# 全屏彩虹渐变加载动画 - 兼容 MT 管理器终端 / Android sh
# 纯展示，不修改任何系统文件

ESC=$(printf '\033')

# 获取终端宽高（tput 不一定有，用 stty 兜底）
get_size() {
    COLS=$(stty size 2>/dev/null | awk '{print $2}')
    ROWS=$(stty size 2>/dev/null | awk '{print $1}')
    [ -z "$COLS" ] && COLS=40
    [ -z "$ROWS" ] && ROWS=20
    [ "$COLS" -lt 20 ] && COLS=20
    [ "$ROWS" -lt 10 ] && ROWS=10
}

# 生成一行彩虹渐变（256 色，横向循环）
rainbow_line() {
    local row=$1
    local line=""
    local x=0
    while [ $x -lt $COLS ]; do
        # 色相：横向 + 纵向偏移，形成斜向渐变
        local hue=$(( (x * 360 / COLS + row * 12) % 360 ))
        local r g b
        # HSV->RGB 简化：用 6 段线性插值
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
        # 转 256 色近似
        local c=$(( 16 + (r*5/255)*36 + (g*5/255)*6 + (b*5/255) ))
        line="${line}${ESC}[48;5;${c}m "
        x=$((x+1))
    done
    line="${line}${ESC}[0m"
    printf '%s' "$line"
}

# 清屏并隐藏光标
clear
printf '%s' "${ESC}[?25l"

get_size

spin() {
    msg="${1:-正在加载}"
    duration="${2:-8}"
    chars="|/-\\"
    bar_w=24
    start=$(date +%s)
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

        # 每帧重绘整屏
        printf '%s[H' "$ESC"   # 光标回左上角
        y=0
        while [ $y -lt "$ROWS" ]; do
            if [ $y -eq $((ROWS/2)) ]; then
                # 中间行：叠加居中的加载信息
                c=$(printf '%s' "$chars" | cut -c $(( (elapsed*10/1) % 4 + 1 )))
                # 用 \033[K 清行，再居中打印
                printf '%s[K' "$ESC"
                # 计算左右留白
                text="${c} ${msg} [${bar}] ${pstr}%"
                # 去掉 ANSI 后估算长度（这里 text 无 ANSI，直接算）
                tlen=${#text}
                left=$(( (COLS - tlen) / 2 ))
                [ $left -lt 0 ] && left=0
                k=0
                while [ $k -lt $left ]; do printf ' '; k=$((k+1)); done
                printf '%s[38;5;226m%s[0m' "$ESC" "$text" "$ESC"
            else
                rainbow_line "$y"
            fi
            printf '\n'
            y=$((y+1))
        done
        sleep 0.12
    done

    # 完成画面
    printf '%s[H' "$ESC"
    y=0
    while [ $y -lt "$ROWS" ]; do
        if [ $y -eq $((ROWS/2)) ]; then
            printf '%s[K' "$ESC"
            text="✓ ${msg} 完成!"
            tlen=${#text}
            left=$(( (COLS - tlen) / 2 ))
            [ $left -lt 0 ] && left=0
            k=0
            while [ $k -lt $left ]; do printf ' '; k=$((k+1)); done
            printf '%s[38;5;46m%s[0m' "$ESC" "$text" "$ESC"
        else
            rainbow_line "$y"
        fi
        printf '\n'
        y=$((y+1))
    done

    # 恢复光标
    printf '%s[?25h' "$ESC"
    printf '\n'
}

spin "正在加载" 8