#!/data/data/com.termux/files/usr/bin/bash

FONT_DIR="$PREFIX/share/figlet"

fonts=()
while IFS= read -r f; do
  fonts+=("$(basename "$f" .flf | sed 's/\.tlf$//')")
done < <(find "$FONT_DIR" -maxdepth 1 \( -name "*.flf" -o -name "*.tlf" \) | sort)

if [ ${#fonts[@]} -eq 0 ]; then
  echo "没有找到字体文件，请先安装 figlet 或下载字体到 $FONT_DIR"
  exit 1
fi

echo "===== 可用字体 ====="
for i in "${!fonts[@]}"; do
  printf "%3d) %s\n" "$((i+1))" "${fonts[$i]}"
done

echo
read -rp "请输入字体编号（回车默认 ANSI Shadow）: " choice
if [ -z "$choice" ]; then
  font="ANSI Shadow"
else
  if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#fonts[@]} ]; then
    echo "编号无效"
    exit 1
  fi
  font="${fonts[$((choice-1))]}"
fi

read -rp "请输入要显示的文字: " text
if [ -z "$text" ]; then
  echo "文字不能为空"
  exit 1
fi

read -rp "是否加彩虹色？(y/N): " color
echo
if [[ "$color" =~ ^[Yy]$ ]]; then
  toilet -f "$font" "$text" | lolcat
else
  toilet -f "$font" "$text"
fi
