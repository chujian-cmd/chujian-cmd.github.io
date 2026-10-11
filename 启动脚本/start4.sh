#!/bin/bash
# ============================================================
# 静默模式 - 隐藏常见错误
# ============================================================
exec 2>/dev/null  # 隐藏所有错误输出

# 或者更精确地控制
# exec 2>/dev/null  # 完全静默
# 或只隐藏特定命令的错误
# ============================================================
# 配置区 - 新增项目只需在这里添加
# ============================================================
declare -A PROJECTS=(
    ["1"]="Holistic（人体识别）:/storage/emulated/0/holistic_demo:8082"
    ["2"]="晃动工坊（图片晃动）:/storage/emulated/0/html存放地/晃动工坊:8084"
    ["3"]="Turbowarp（Scratch 编辑器）:/storage/emulated/0/html存放地/turbowarp.org:8085"
    ["4"]="2048（经典小游戏）:/storage/emulated/0/html存放地/2048:8086"
    ["5"]="MC Classic（网页版MC）:/storage/emulated/0/html存放地/mc-classic/classic.minecraft.net:8090"
    ["6"]="Eaglercraft（手机MC）:/storage/emulated/0/html存放地/eaglercraft:8091"
    ["7"]="3D Viewer（3D模型查看）:/storage/emulated/0/html存放地/3dviewer:8099"
    ["8"]="copy.sh（个人主页+生命游戏）:/storage/emulated/0/html存放地/copy.sh:8101"
    ["9"]="draw.io（绘图工具）:/storage/emulated/0/html存放地/drawio:8102"
    ["10"]="xtype（射击游戏）:/storage/emulated/0/html存放地/xtype:8140"
    ["11"]="Chihuahua Spin（魔性转狗）:/storage/emulated/0/html存放地/chihuahuaspin:8141"
    ["12"]="That's The Finger（手指追鼠标）:/storage/emulated/0/html存放地/thatsthefinger:8142"
    ["13"]="PetPetGenerator（摸摸头GIF）:/storage/emulated/0/html存放地/petpetgenerator:8143"
    ["14"]="WeaveSilk（对称画图）:/storage/emulated/0/html存放地/weavesilk:8144"
    ["15"]="Poetry Cloud（诗歌生成）:/storage/emulated/0/html存放地/poetrycloud:8145"
    ["16"]="Canvas Painter（画板）:/storage/emulated/0/html存放地/canvas-painter:8148"
    ["17"]="Markdown Previewer（Markdown预览）:/storage/emulated/0/html存放地/markdown-previewer:8149"
    ["18"]="Minesweeper（扫雷）:/storage/emulated/0/html存放地/minesweeper:8150"
    ["19"]="KoalasToTheMax（分形考拉）:/storage/emulated/0/html存放地/KoalasToTheMax:8133"
    ["20"]="Long Doge Challenge（无限滚动柴犬）:/storage/emulated/0/html存放地/longdoge:8134"
    ["21"]="Learn UI Name（UI视觉词典）:/storage/emulated/0/html存放地/learn-ui/learnui.qiaomu.ai:8173"
    ["22"]="htmlgames-master(html游戏源码):/storage/emulated/0/html存放地/htmlgames-master:8130"
)

# ============================================================
# 函数定义
# ============================================================

# 停止所有服务器
stop_servers() {
    pkill -f "python -m http.server" 2>/dev/null
    echo -e "\033[32m✅ 所有服务器已停止\033[0m"
}

# 显示菜单
show_menu() {
    clear
    echo -e "\033[36m================================\033[0m"
    echo -e "\033[1;33m  本地项目启动器 v3.0\033[0m"
    echo -e "\033[1;33m  离线收藏家专用\033[0m"
    echo -e "\033[36m================================\033[0m"
    
    # 动态显示菜单
    for key in $(echo "${!PROJECTS[@]}" | tr ' ' '\n' | sort -n); do
        IFS=':' read -r name path port <<< "${PROJECTS[$key]}"
        printf "  \033[32m%2s\033[0m. %-30s \033[90m%s\033[0m\n" "$key" "$name" "$port"
    done
    
    echo -e "\033[36m================================\033[0m"
    echo -e "  \033[31m0\033[0m. 退出"
    echo -e "\033[36m================================\033[0m"
    echo -e "\033[90m💡 提示：按 Ctrl+C 可停止当前运行的项目\033[0m"
    echo -e "\033[36m================================\033[0m"
}

# 启动项目
start_project() {
    local choice=$1
    local entry="${PROJECTS[$choice]}"
    
    if [[ -z "$entry" ]]; then
        echo -e "\033[31m❌ 无效输入，请输入 0-22 之间的数字\033[0m"
        return 1
    fi
    
    IFS=':' read -r name path port <<< "$entry"
    
    # 检查目录是否存在
    if [[ ! -d "$path" ]]; then
        echo -e "\033[31m❌ 错误：目录不存在 - $path\033[0m"
        return 1
    fi
    
    echo -e "\033[33m🚀 启动 $name...\033[0m"
    
    # 检查端口是否被占用
    if lsof -i ":$port" >/dev/null 2>&1; then
        echo -e "\033[33m⚠️  端口 $port 已被占用，尝试停止旧进程...\033[0m"
        pkill -f "python -m http.server $port" 2>/dev/null
        sleep 1
    fi
    
    # 启动服务器
    cd "$path" && python -m http.server "$port" &
    local pid=$!
    sleep 2
    
    # 检查进程是否还在运行
    if kill -0 $pid 2>/dev/null; then
        echo -e "\033[32m✅ $name 已启动 (PID: $pid)\033[0m"
        echo -e "\033[36m🌐 访问: http://127.0.0.1:$port\033[0m"
        
        # 尝试打开浏览器
        if command -v am &>/dev/null; then
            am start -a android.intent.action.VIEW -d "http://127.0.0.1:$port" 2>/dev/null
        fi
    else
        echo -e "\033[31m❌ 启动失败，请检查目录和Python环境\033[0m"
        return 1
    fi
}

# 清理退出
cleanup() {
    echo -e "\n\033[33m🔄 正在清理...\033[0m"
    stop_servers
    echo -e "\033[32m 再见！\033[0m"
    exit 0
}

# ============================================================
# 主程序
# ============================================================

# 设置信号处理
trap cleanup SIGINT SIGTERM

# 停止所有服务器
stop_servers

# 主循环
while true; do
    show_menu
    read -p "请输入数字 [0-20]: " choice
    
    # 处理退出
    if [[ "$choice" == "0" ]]; then
        cleanup
    fi
    
    # 启动项目
    start_project "$choice"
    
    # 等待用户操作后继续
    echo -e "\n\033[90m按 Enter 键返回菜单...\033[0m"
    read
done
