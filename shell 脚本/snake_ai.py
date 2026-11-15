#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 盲文贪吃蛇 · AI 版
# 按键: wasd 手动 / i 切换AI / 空格暂停 / q退出

import sys, time, random, select, termios, tty

W, H = 60, 30
SPEED = 40
WRAP = True
GOD = True
SELF = True
AI = True   # 默认开启 AI

BRAILLE_BITS = [
    [0x01, 0x40],
    [0x02, 0x08],
    [0x04, 0x10],
    [0x20, 0x80],
]

snake = [(30, 15), (29, 15), (28, 15), (27, 15)]
dir_ = (1, 0)
score = 0
dead = False
paused = False
food = (0, 0)
ai_on = AI

def place_food():
    global food
    occupied = set(snake)
    for _ in range(2000):
        p = (random.randrange(W), random.randrange(H))
        if p not in occupied:
            food = p
            return
    for y in range(H):
        for x in range(W):
            if (x, y) not in occupied:
                food = (x, y)
                return
    food = (0, 0)

def render():
    snake_set = set(snake)
    fx, fy = food
    lines = []
    for by in range(0, H, 4):
        row_chars = []
        for bx in range(0, W, 2):
            mask = 0
            for dy in range(4):
                y = by + dy
                if y >= H:
                    continue
                for dx in range(2):
                    x = bx + dx
                    if x >= W:
                        continue
                    bit = BRAILLE_BITS[dy][dx]
                    if (x, y) in snake_set:
                        mask |= bit
                    elif (x, y) == (fx, fy):
                        mask |= bit
            row_chars.append(chr(0x2800 + mask))
        lines.append("".join(row_chars))
    out = "\033[H" + "\n".join(lines)
    out += "\n" + f"分数: {score}  长度: {len(snake)}  速度: {SPEED}/s  AI: {'开' if ai_on else '关'}"
    if paused:
        out += "  [暂停]"
    if dead:
        out += "  [死]"
    out += "  按键: wasd / i切换AI / 空格暂停 / q退出"
    out += "\033[J"
    sys.stdout.write(out)
    sys.stdout.flush()

def wrap_pos(x, y):
    if WRAP:
        return x % W, y % H
    return x, y

def in_bounds(x, y):
    return 0 <= x < W and 0 <= y < H

def body_set():
    return set(snake[1:-1]) if len(snake) > 2 else set()

def safe_dirs():
    hx, hy = snake[0]
    body = body_set()
    res = []
    for d in ((0,-1),(0,1),(-1,0),(1,0)):
        nx, ny = wrap_pos(hx + d[0], hy + d[1])
        if not in_bounds(nx, ny):
            continue
        if (nx, ny) in body:
            continue
        res.append(d)
    return res

def ai_choose_dir():
    global dir_
    hx, hy = snake[0]
    fx, fy = food
    safe = safe_dirs()
    if not safe:
        return
    no_rev = [d for d in safe if not (d[0] == -dir_[0] and d[1] == -dir_[1])]
    cands = no_rev if no_rev else safe

    def dist_to_food(p):
        dx = abs(p[0] - fx); dy = abs(p[1] - fy)
        if WRAP:
            dx = min(dx, W - dx); dy = min(dy, H - dy)
        return dx + dy

    best = None
    best_score = None
    for d in cands:
        nx, ny = wrap_pos(hx + d[0], hy + d[1])
        s = -dist_to_food((nx, ny)) * 10
        if d == dir_:
            s += 1
        blocked = set(snake[1:])
        sim_safe = 0
        for d2 in ((0,-1),(0,1),(-1,0),(1,0)):
            tx, ty = wrap_pos(nx + d2[0], ny + d2[1])
            if in_bounds(tx, ty) and (tx, ty) not in blocked:
                sim_safe += 1
        s += sim_safe * 2
        if not WRAP and (nx == 0 or nx == W-1 or ny == 0 or ny == H-1):
            s -= 5
        if best_score is None or s > best_score:
            best_score = s
            best = d
    if best:
        dir_ = best

def step():
    global snake, score, dead, dir_
    if ai_on:
        ai_choose_dir()
    hx, hy = snake[0]
    nx, ny = wrap_pos(hx + dir_[0], hy + dir_[1])
    if not in_bounds(nx, ny):
        if GOD:
            safe = safe_dirs()
            no_rev = [d for d in safe if not (d[0] == -dir_[0] and d[1] == -dir_[1])]
            cands = no_rev if no_rev else safe
            if cands:
                dir_ = random.choice(cands)
                nx, ny = wrap_pos(hx + dir_[0], hy + dir_[1])
            else:
                dead = True
                return
        else:
            dead = True
            return
    newhead = (nx, ny)
    tail = snake[-1]
    hit_self = newhead in snake
    if hit_self and newhead != tail:
        if not GOD and not SELF:
            dead = True
            return
    if newhead == food:
        score += 1
        snake.insert(0, newhead)
        place_food()
    else:
        snake.insert(0, newhead)
        snake.pop()

def read_key(timeout):
    r, _, _ = select.select([sys.stdin], [], [], timeout)
    if r:
        return sys.stdin.read(1)
    return None

def handle_key(ch):
    global dir_, dead, paused, ai_on
    if ch in ('q', 'Q'):
        dead = True
        return
    if ch == ' ':
        paused = not paused
        return
    if ch in ('i', 'I'):
        ai_on = not ai_on
        return
    if paused or ai_on:
        return
    if ch in ('w', 'W'):
        if dir_ != (0, 1): dir_ = (0, -1)
    elif ch in ('s', 'S'):
        if dir_ != (0, -1): dir_ = (0, 1)
    elif ch in ('a', 'A'):
        if dir_ != (1, 0): dir_ = (-1, 0)
    elif ch in ('d', 'D'):
        if dir_ != (-1, 0): dir_ = (1, 0)

def main():
    global dead
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setcbreak(fd)
        sys.stdout.write("\033[?25l\033[2J")
        sys.stdout.flush()
        place_food()
        interval = 1.0 / SPEED
        acc = 0.0
        last = time.monotonic()
        render()
        while not dead:
            now = time.monotonic()
            acc += now - last
            last = now
            ch = read_key(0.02)
            if ch:
                handle_key(ch)
            if paused:
                acc = 0.0
                render()
                time.sleep(0.05)
                continue
            while acc >= interval:
                step()
                acc -= interval
                if dead:
                    break
            render()
        sys.stdout.write("\033[H\033[2J")
        sys.stdout.write(f"游戏结束！分数: {score}  长度: {len(snake)}\n")
        sys.stdout.flush()
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)
        sys.stdout.write("\033[?25h\033[0m\n")
        sys.stdout.flush()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
