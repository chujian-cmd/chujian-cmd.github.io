#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, sys, time, random, select, termios, tty

W, H = 60, 30
SNAKE_CH = "⣿"
FOOD_CH  = "⡀"
SPEED    = 10
WRAP     = True
GOD      = True
SELF     = True
AI       = False

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
    out += "\n" + f"分数: {score}  长度: {len(snake)}  速度: {SPEED}/s"
    if paused:
        out += "  [暂停]"
    if dead:
        out += "  [死]"
    out += "  按键: wasd / 空格暂停 / q退出"
    out += "\033[J"
    sys.stdout.write(out)
    sys.stdout.flush()

def ai_choose_dir():
    global dir_
    hx, hy = snake[0]
    fx, fy = food
    cands = []
    for d in ((0,-1),(0,1),(-1,0),(1,0)):
        if (d[0] == -dir_[0] and d[1] == -dir_[1]):
            continue
        cands.append(d)
    if not cands:
        return
    body = set(snake[:-1])
    best = None
    best_score = -10**9
    for d in cands:
        nx, ny = hx + d[0], hy + d[1]
        if WRAP:
            nx %= W; ny %= H
        if nx < 0 or nx >= W or ny < 0 or ny >= H:
            continue
        hit = (nx, ny) in body
        if hit and not GOD:
            continue
        dx = abs(nx - fx); dy = abs(ny - fy)
        if WRAP:
            dx = min(dx, W - dx); dy = min(dy, H - dy)
        dist = dx + dy
        s = -dist * 10
        if hit:
            s -= 1000
        if d == dir_:
            s += 1
        if s > best_score:
            best_score = s
            best = d
    if best:
        dir_ = best

def step():
    global snake, score, dead, dir_
    if AI:
        ai_choose_dir()
    hx, hy = snake[0]
    nx, ny = hx + dir_[0], hy + dir_[1]
    if WRAP:
        nx %= W; ny %= H
    if nx < 0 or nx >= W or ny < 0 or ny >= H:
        if GOD:
            for d in ((0,-1),(0,1),(-1,0),(1,0)):
                tx, ty = hx + d[0], hy + d[1]
                if WRAP:
                    tx %= W; ty %= H
                if 0 <= tx < W and 0 <= ty < H and (tx, ty) not in snake[:-1]:
                    dir_ = d
                    nx, ny = tx, ty
                    break
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
        ch = sys.stdin.read(1)
        return ch
    return None

def handle_key(ch):
    global dir_, dead, paused
    if ch in ('q', 'Q'):
        dead = True
        return
    if ch == ' ':
        paused = not paused
        return
    if paused:
        return
    if AI:
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
            dt = now - last
            last = now
            acc += dt
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
