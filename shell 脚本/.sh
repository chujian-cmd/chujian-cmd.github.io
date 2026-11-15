#!/usr/bin/env bash
# 加载动画脚本（纯展示，无系统修改）

spin() {
  local chars='|/-\'
  local msg="${1:-加载中}"
  local duration="${2:-5}"
  local end=$((SECONDS + duration))

  while [ $SECONDS -lt $end ]; do
    for ((i=0; i<${#chars}; i++)); do
      printf '\r%s %s' "${chars:$i:1}" "$msg"
      sleep 0.1
    done
  done
  printf '\r✓ %s 完成!\n' "$msg"
}

spin "正在加载" 5