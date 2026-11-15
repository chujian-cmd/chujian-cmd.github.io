#!/system/bin/sh
# 加载动画脚本 - 兼容 MT 管理器终端 / Android sh
# 纯展示，不修改任何系统文件

spin() {
    msg="${1:-加载中}"
    duration="${2:-5}"
    chars="|/-\\"
    end=$(( $(date +%s) + duration ))

    while [ "$(date +%s)" -lt "$end" ]; do
        i=0
        while [ $i -lt 4 ]; do
            c=$(printf '%s' "$chars" | cut -c $((i+1)))
            printf '\r%s %s' "$c" "$msg"
            sleep 0.1
            i=$((i+1))
        done
    done
    printf '\r✓ %s 完成!\n' "$msg"
}

spin "正在加载" 5