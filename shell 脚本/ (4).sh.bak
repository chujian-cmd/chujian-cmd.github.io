#!/system/bin/sh
# 花哨加载动画 - 兼容 MT 管理器终端 / Android sh
# 纯展示，不修改任何系统文件

ESC=$(printf '\033')
C_CYAN="${ESC}[36m"
C_MAG="${ESC}[35m"
C_YEL="${ESC}[33m"
C_GRN="${ESC}[32m"
C_RST="${ESC}[0m"

spin() {
    msg="${1:-正在加载}"
    duration="${2:-6}"
    chars="|/-\\"
    bar_w=20
    start=$(date +%s)
    end=$((start + duration))

    # 隐藏光标
    printf '%s' "${ESC}[?25l"

    while :; do
        now=$(date +%s)
        [ "$now" -ge "$end" ] && break
        elapsed=$((now - start))
        pct=$((elapsed * 100 / duration))
        [ "$pct" -gt 100 ] && pct=100

        # 进度条
        filled=$((pct * bar_w / 100))
        empty=$((bar_w - filled))
        bar=""
        j=0
        while [ $j -lt $filled ]; do bar="${bar}█"; j=$((j+1)); done
        j=0
        while [ $j -lt $empty ]; do bar="${bar}░"; j=$((j+1)); done

        # 旋转光标（每 0.1s 换一帧，共 4 帧）
        k=0
        while [ $k -lt 4 ]; do
            now=$(date +%s)
            [ "$now" -ge "$end" ] && break
            c=$(printf '%s' "$chars" | cut -c $((k+1)))
            printf '\r%s%s%s %s%s [%s%s%s] %s%3d%%%s' \
                "$C_CYAN" "$c" "$C_RST" \
                "$C_MAG" "$msg" "$C_RST" \
                "$C_YEL" "$bar" "$C_RST" \
                "$C_GRN" "$pct" "$C_RST"
            sleep 0.1
            k=$((k+1))
        done
    done

    # 完成状态
    printf '\r%s✓%s %s%s%s [%s%s%s] %s100%%%s\n' \
        "$C_GRN" "$C_RST" \
        "$C_MAG" "$msg" "$C_RST" \
        "$C_YEL" "████████████████████" "$C_RST" \
        "$C_GRN" "$C_RST"

    # 恢复光标
    printf '%s' "${ESC}[?25h"
}

spin "正在加载" 6