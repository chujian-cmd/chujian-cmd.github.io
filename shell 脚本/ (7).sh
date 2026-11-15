#!/system/bin/sh
# 盲文贪吃蛇 · mksh 版
# 用法: sh snake.sh
# 按键: w上 s下 a左 d右 q退出

W=40
H=24
SNAKE_CH="⣿"
FOOD_CH="⡀"
EMPTY=" "

# ---------- 终端设置 ----------
# 保存原状态，退出时恢复
old_stty=$(stty -g 2>/dev/null)
cleanup() {
  stty "$old_stty" 2>/dev/null
  printf '\033[?25h'   # 显示光标
  printf '\033[0m\n'
  exit 0
}
trap cleanup INT TERM EXIT

stty -icanon -echo min 1 time 0 2>/dev/null
printf '\033[?25l'   # 隐藏光标
printf '\033[2J'     # 清屏

# ---------- 游戏状态 ----------
# 用一维字符串存地图：每个格 1 字符，0=空 1=蛇 3=食物
# mksh 没有数组，用字符串 + 位置计算
build_empty_grid() {
  grid=""
  i=0
  while [ $i -lt $((W*H)) ]; do
    grid="${grid}0"
    i=$((i+1))
  done
}

set_cell() {
  # $1=x $2=y $3=值
  idx=$(( $2 * W + $1 ))
  # 字符串替换：用 cut 拼接
  left=$(printf '%s' "$grid" | cut -c1-$idx)
  right=$(printf '%s' "$grid" | cut -c$((idx+2))-)
  grid="${left}$3${right}"
}

get_cell() {
  idx=$(( $2 * W + $1 ))
  printf '%s' "$grid" | cut -c$((idx+1))
}

# 蛇身用坐标串存: "x1,y1 x2,y2 ..."
snake="20,12 19,12 18,12 17,12"
dir="R"
score=0
dead=0
food_x=0
food_y=0
frame=""

place_food() {
  while :; do
    food_x=$((RANDOM % W))
    food_y=$((RANDOM % H))
    if [ "$(get_cell $food_x $food_y)" = "0" ]; then
      set_cell $food_x $food_y 3
      return
    fi
  done
}

init_game() {
  build_empty_grid
  snake="20,12 19,12 18,12 17,12"
  dir="R"
  score=0
  dead=0
  # 画蛇
  for seg in $snake; do
    sx=${seg%,*}
    sy=${seg#*,}
    set_cell $sx $sy 1
  done
  place_food
}

# ---------- 渲染 ----------
render() {
  out="\033[H"
  y=0
  while [ $y -lt $H ]; do
    x=0
    while [ $x -lt $W ]; do
      c=$(get_cell $x $y)
      if [ "$c" = "1" ]; then
        out="${out}${SNAKE_CH}"
      elif [ "$c" = "3" ]; then
        out="${out}${FOOD_CH}"
      else
        out="${out}${EMPTY}"
      fi
      x=$((x+1))
    done
    out="${out}\033[K\n"
    y=$((y+1))
  done
  out="${out}分数: $score\033[K\n"
  printf '%b' "$out"
}

# ---------- 移动 ----------
move() {
  head=${snake%% *}
  hx=${head%,*}
  hy=${head#*,}

  case "$dir" in
    U) hx=$((hx));   hy=$((hy-1));;
    D) hx=$((hx));   hy=$((hy+1));;
    L) hx=$((hx-1)); hy=$((hy));;
    R) hx=$((hx+1)); hy=$((hy));;
  esac

  # 穿墙
  [ $hx -lt 0 ] && hx=$((W-1))
  [ $hx -ge $W ] && hx=0
  [ $hy -lt 0 ] && hy=$((H-1))
  [ $hy -ge $H ] && hy=0

  # 撞自己（尾巴除外）
  tail=${snake##* }
  tx=${tail%,*}
  ty=${tail#*,}
  cell=$(get_cell $hx $hy)
  if [ "$cell" = "1" ]; then
    if [ "$hx" != "$tx" ] || [ "$hy" != "$ty" ]; then
      dead=1
      return
    fi
  fi

  ate=0
  if [ "$cell" = "3" ]; then
    ate=1
    score=$((score+1))
  else
    # 去尾
    set_cell $tx $ty 0
    snake=$(printf '%s' "$snake" | sed 's/ [0-9]*,[0-9]*$//')
  fi

  set_cell $hx $hy 1
  snake="$hx,$hy $snake"
  [ $ate -eq 1 ] && place_food
}

# ---------- 主循环 ----------
init_game

# 用后台读键 + 主循环检查文件的方式，避免 dd 阻塞
KEYFILE="/data/local/tmp/.snake_key"
: > "$KEYFILE"

# 读键进程
(
  while :; do
    k=$(dd bs=1 count=1 2>/dev/null)
    printf '%s' "$k" > "$KEYFILE"
  done
) &
READER_PID=$!

trap 'kill $READER_PID 2>/dev/null; cleanup' INT TERM EXIT

while [ $dead -eq 0 ]; do
  # 处理按键
  if [ -s "$KEYFILE" ]; then
    k=$(cat "$KEYFILE")
    : > "$KEYFILE"
    case "$k" in
      w|W) [ "$dir" != "D" ] && dir="U";;
      s|S) [ "$dir" != "U" ] && dir="D";;
      a|A) [ "$dir" != "R" ] && dir="L";;
      d|D) [ "$dir" != "L" ] && dir="R";;
      q|Q) dead=1;;
    esac
  fi

  move
  render
  sleep 0.15
done

printf '\033[H\033[K游戏结束！分数: %d\n' "$score"
kill $READER_PID 2>/dev/null