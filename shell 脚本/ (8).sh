#!/system/bin/sh
# 盲文贪吃蛇 · mksh 版（无临时文件 / 按行存图 / 可玩帧率）
# 按键: w上 s下 a左 d右 q退出

W=40
H=24
SNAKE_CH="⣿"
FOOD_CH="⡀"

old_stty=$(stty -g 2>/dev/null)
cleanup() {
  stty "$old_stty" 2>/dev/null
  printf '\033[?25h\033[0m\n'
  exit 0
}
trap cleanup INT TERM EXIT

stty -icanon -echo min 0 time 0 2>/dev/null
printf '\033[?25l\033[2J'

# ---------- 地图：每行一个字符串，0空 1蛇 3食物 ----------
rows=""
init_rows() {
  empty_row=""
  i=0
  while [ $i -lt $W ]; do empty_row="${empty_row}0"; i=$((i+1)); done
  rows=""
  y=0
  while [ $y -lt $H ]; do rows="${rows}${empty_row}\n"; y=$((y+1)); done
}

# 取某行
get_row() { printf '%s' "$rows" | sed -n "$(( $1 + 1 ))p"; }

# 设置单元格：$1=x $2=y $3=值
set_cell() {
  x=$1; y=$2; v=$3
  row=$(get_row $y)
  left=$(printf '%s' "$row" | cut -c1-$x)
  right=$(printf '%s' "$row" | cut -c$((x+2))-)
  newrow="${left}${v}${right}"
  # 替换第 y+1 行
  rows=$(printf '%s' "$rows" | awk -v n=$((y+1)) -v r="$newrow" 'NR==n{print r;next}{print}')
}

get_cell() {
  x=$1; y=$2
  row=$(get_row $y)
  printf '%s' "$row" | cut -c$((x+1))
}

# ---------- 蛇 ----------
snake="20,12 19,12 18,12 17,12"
dir="R"
score=0
dead=0
food_x=0
food_y=0

place_food() {
  tries=0
  while [ $tries -lt 500 ]; do
    fx=$((RANDOM % W))
    fy=$((RANDOM % H))
    if [ "$(get_cell $fx $fy)" = "0" ]; then
      food_x=$fx; food_y=$fy
      set_cell $fx $fy 3
      return
    fi
    tries=$((tries+1))
  done
}

init_game() {
  init_rows
  snake="20,12 19,12 18,12 17,12"
  dir="R"; score=0; dead=0
  for seg in $snake; do
    sx=${seg%,*}; sy=${seg#*,}
    set_cell $sx $sy 1
  done
  place_food
}

# ---------- 渲染：整屏拼一个字符串，一次输出 ----------
render() {
  out="\033[H"
  y=0
  while [ $y -lt $H ]; do
    row=$(get_row $y)
    x=0
    line=""
    while [ $x -lt $W ]; do
      c=$(printf '%s' "$row" | cut -c$((x+1)))
      if [ "$c" = "1" ]; then line="${line}${SNAKE_CH}"
      elif [ "$c" = "3" ]; then line="${line}${FOOD_CH}"
      else line="${line} "; fi
      x=$((x+1))
    done
    out="${out}${line}\033[K\n"
    y=$((y+1))
  done
  out="${out}分数: $score\033[K\n"
  printf '%b' "$out"
}

# ---------- 移动 ----------
move() {
  head=${snake%% *}
  hx=${head%,*}; hy=${head#*,}
  case "$dir" in
    U) hy=$((hy-1));;
    D) hy=$((hy+1));;
    L) hx=$((hx-1));;
    R) hx=$((hx+1));;
  esac
  [ $hx -lt 0 ] && hx=$((W-1))
  [ $hx -ge $W ] && hx=0
  [ $hy -lt 0 ] && hy=$((H-1))
  [ $hy -ge $H ] && hy=0

  tail=${snake##* }
  tx=${tail%,*}; ty=${tail#*,}
  cell=$(get_cell $hx $hy)
  if [ "$cell" = "1" ] && { [ "$hx" != "$tx" ] || [ "$hy" != "$ty" ]; }; then
    dead=1; return
  fi

  if [ "$cell" = "3" ]; then
    score=$((score+1))
  else
    set_cell $tx $ty 0
    snake=$(printf '%s' "$snake" | sed 's/ [0-9]*,[0-9]*$//')
  fi
  set_cell $hx $hy 1
  snake="$hx,$hy $snake"
  [ "$cell" = "3" ] && place_food
}

# ---------- 主循环：read -t 做节拍 ----------
init_game
render

while [ $dead -eq 0 ]; do
  if read -t 0.15 -n 1 k; then
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
done

printf '\033[H\033[K游戏结束！分数: %d\n' "$score"