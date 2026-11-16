'use strict';

/* 输入: 键盘(WASD/方向键)+ 手机虚拟摇杆 + 外卖按钮点击 */

/* global canvas, input, W, H, game, startBtn, vehicleBtns, vehicleOpenBtn, vehicleBackBtn, resetGame, adjustCrime, grantWeapon, player, addFloatText, PX_PER_M, makeFood, makeSpecialFood, applySpecialEffect, VEHICLES, applyVehicle, eatBtn, throwBtn, throwFood, activeEat, ready, SFX, pauseBtn, soundBtn, pauseHomeBtn, spawnInitialEnemies, INITIAL_ENEMIES, spawnBoss, spawnSpecialCustomer, rankOpenBtn, rankRefreshBtn, mockBtns, markPress, uiHover, clearMenuActors, bookBtn, tutPrevBtn, tutNextBtn, TUT_TITLES, Toy, refreshUnlocks, isVehicleUnlocked, loadRank, vehicleHomeBtn, vehicleVideoBtn, rankState */

const KEYMAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
};

/* 特殊客户生成键(测试用; 索引见 customer.js: 0杰哥 / 1西瓜 / 2良子 / 3炊事员) */
const SPECIAL_SPAWN = {
  KeyY: { special: 1, variant: 1, name: '刘华强' },
  KeyH: { special: 1, variant: 0, name: '瓜摊老板' },
  KeyJ: { special: 0, variant: 0, name: '杰哥' },
  KeyK: { special: 2, variant: 0, name: '良子' },
  KeyL: { special: 3, variant: 0, name: '炊事员' },
};

window.addEventListener('keydown', (e) => {
  if (!ready) return; // 加载中屏蔽输入
  SFX.unlock(); // 用户交互, 解锁音频
  /* Esc: 暂停/继续 */
  if (e.code === 'Escape' && game.started && !game.over) {
    e.preventDefault();
    game.paused = !game.paused;
    return;
  }
  /* 空格: 主动食用外卖(牛来会触发冲刺) */
  if (e.code === 'Space') {
    e.preventDefault();
    activeEat();
    return;
  }
  /* F1: 隐藏 / 显示 UI(方便截图) */
  if (e.code === 'F1') {
    e.preventDefault();
    game.hideUI = !game.hideUI;
    return;
  }
  const k = KEYMAP[e.code];
  if (!k) {
    if (!game.testMode) return; // 测试模式默认关闭(本地调试: 控制台 game.testMode = true)
    /* ---- 测试快捷键 ---- */
    /* +/- 调整犯罪等级 */
    if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      e.preventDefault();
      adjustCrime(1);
      return;
    }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      adjustCrime(-1);
      return;
    }
    /* 数字键 1~4 直接获得装备 */
    const testItems = { Digit1: 'dagger', Digit2: 'pistol', Digit3: 'rifle', Digit4: 'shield' };
    if (testItems[e.code]) {
      e.preventDefault();
      grantWeapon(testItems[e.code]);
      return;
    }
    /* 数字键 5 获得外卖 */
    if (e.code === 'Digit5') {
      e.preventDefault();
      for (let i = 0; i < 5 && player.food.length < 99; i++) player.food.push(makeFood());
      addFloatText(player.x, player.y - player.height / 2, '+5 外卖', '#ffd23f');
      return;
    }
    /* 数字键 6: +1 有毒外卖 */
    if (e.code === 'Digit6') {
      e.preventDefault();
      player.food.push(makeFood(true));
      addFloatText(player.x, player.y - player.height / 2, '+1 有毒外卖', '#4ade80');
      return;
    }
    /* 数字键 7: +1 特殊外卖(随机) */
    if (e.code === 'Digit7') {
      e.preventDefault();
      player.food.push(makeSpecialFood(Math.floor(Math.random() * 4)));
      addFloatText(player.x, player.y - player.height / 2, '+1 特殊外卖', '#ffd23f');
      return;
    }
    /* 数字键 8/9/0: 直接触发特殊效果(勇猛 / 水果摊 / 焖子) */
    if (e.code === 'Digit8') {
      e.preventDefault();
      applySpecialEffect(0);
      return;
    }
    if (e.code === 'Digit9') {
      e.preventDefault();
      applySpecialEffect(2);
      return;
    }
    if (e.code === 'Digit0') {
      e.preventDefault();
      applySpecialEffect(1);
      return;
    }
    /* P: 现有食物全部变毒(鸡汤来咯) */
    if (e.code === 'KeyP') {
      e.preventDefault();
      applySpecialEffect(3);
      return;
    }
    /* G: 直接获得「西瓜刀」(刘华强同款, 匕首 2 倍伤害/大小) */
    if (e.code === 'KeyG') {
      e.preventDefault();
      grantWeapon('dagger', true);
      return;
    }
    /* 特殊客户生成键(都在视野外生成, 让他开进画面) */
    const sp = SPECIAL_SPAWN[e.code];
    if (sp) {
      e.preventDefault();
      const ok = spawnSpecialCustomer(sp.special, sp.variant, -110);
      addFloatText(
        player.x,
        player.y - player.height / 2,
        ok ? sp.name + '来了' : '特殊客户图未就绪',
        ok ? '#ffd23f' : '#ff6b6b',
      );
      return;
    }
    /* B: 测试用, 立即生成大运 Boss */
    if (e.code === 'KeyB') {
      e.preventDefault();
      spawnBoss();
      addFloatText(player.x, player.y - player.height / 2, '大运来了!', '#ff9d5c');
      return;
    }
    /* T: 测试用, 增加 500m 路程快速进入高难度 */
    if (e.code === 'KeyT') {
      e.preventDefault();
      game.totalDist += 500 * PX_PER_M;
      addFloatText(player.x, player.y - player.height / 2, '路程 +500m', '#c7cdd4');
      return;
    }
    return;
  }
  e.preventDefault();
  input.keys[k] = true;
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) input.keys[k] = false;
});
window.addEventListener('blur', () => {
  // 失焦时清空按键/摇杆, 防止卡方向
  input.keys = Object.create(null);
  input.joy = null;
});

/* 屏幕坐标 → 逻辑坐标(缓存画布矩形, 避免每次指针事件触发重排) */
let canvasRect = { left: 0, top: 0, width: 1, height: 1 };
function refreshCanvasRect() {
  const r = canvas.getBoundingClientRect();
  canvasRect = { left: r.left, top: r.top, width: r.width, height: r.height };
}
function toLogical(e) {
  return {
    x: ((e.clientX - canvasRect.left) * W) / canvasRect.width,
    y: ((e.clientY - canvasRect.top) * H) / canvasRect.height,
  };
}
window.addEventListener('resize', refreshCanvasRect);
refreshCanvasRect();
/* 手机: 屏幕下半区按下出现虚拟摇杆, 滑动控制方向(桌面端点击不移动, 仅用键盘) */
const JOY_RADIUS = 70;
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (!ready) return; // 加载中屏蔽输入
  SFX.unlock(); // 用户交互, 解锁音频
  canvas.focus(); // 让画布拿到焦点(内嵌 iframe / B站容器里键盘才收得到)
  if (!game.started) {
    const p = toLogical(e);
    const hit = (b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
    if (game.menuScreen === 'tutorial') {
      /* 教程界面 */
      if (hit(vehicleBackBtn)) {
        markPress(vehicleBackBtn);
        game.menuScreen = 'main';
      } else if (hit(tutPrevBtn)) {
        markPress(tutPrevBtn);
        game.tutorialPage = Math.max(0, game.tutorialPage - 1);
      } else if (hit(tutNextBtn)) {
        markPress(tutNextBtn);
        game.tutorialPage = Math.min(TUT_TITLES.length - 1, game.tutorialPage + 1);
      }
      return;
    }
    if (game.menuScreen === 'rank') {
      /* 排行榜界面 */
      if (hit(vehicleBackBtn)) {
        markPress(vehicleBackBtn);
        game.menuScreen = 'main';
      } else if (hit(rankRefreshBtn)) {
        markPress(rankRefreshBtn);
        loadRank();
      } else {
        /* 空白处按下 → 开始拖动滚动(查看全部名次) */
        input.rankDrag = { id: e.pointerId, y: p.y, scroll: rankState.scroll };
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
      return;
    }
    if (game.menuScreen === 'vehicle') {
      /* 出行方式选择界面 */
      if (hit(vehicleBackBtn)) {
        markPress(vehicleBackBtn);
        game.menuScreen = 'main';
        return;
      }
      /* UP 主页 / 开发视频 入口 */
      if (hit(vehicleHomeBtn)) {
        markPress(vehicleHomeBtn);
        Toy.openAuthor();
        return;
      }
      if (hit(vehicleVideoBtn)) {
        markPress(vehicleVideoBtn);
        Toy.openVideo();
        return;
      }
      if (Toy.isMock()) {
        for (const mb of mockBtns) {
          if (hit(mb)) {
            markPress(mb);
            window.__toyMock.toggle(mb.key);
            refreshUnlocks();
            return;
          }
        }
      }
      for (const type of Object.keys(VEHICLES)) {
        if (hit(vehicleBtns[type])) {
          markPress(vehicleBtns[type]);
          if (!isVehicleUnlocked(type)) {
            /* 未解锁 → 跳到视频/UP 去点赞投币收藏关注 */
            if (VEHICLES[type].unlock === 'follow') Toy.openAuthor();
            else Toy.openVideo();
            return;
          }
          applyVehicle(type);
          return;
        }
      }
    } else {
      /* 主菜单 */
      /* 教程(书本图标) */
      if (hit(bookBtn)) {
        markPress(bookBtn);
        game.menuScreen = 'tutorial';
        game.tutorialPage = 0;
        return;
      }
      /* 开始按钮(第一位): 应用当前载具(贴图可能刚加载完, 重新算尺寸) */
      if (hit(startBtn)) {
        markPress(startBtn);
        game.started = true;
        clearMenuActors(); // 清掉开场演示角色
        applyVehicle(player.vehicle);
        player.y = H * 0.66; // 从开始界面的展示位回到正常出发位置
        spawnInitialEnemies(INITIAL_ENEMIES); // 开局一批敌人
        SFX.play('start');
        return;
      }
      if (hit(vehicleOpenBtn)) {
        markPress(vehicleOpenBtn);
        game.menuScreen = 'vehicle';
        refreshUnlocks(); // 刷新解锁状态
        Toy.loadMedia(); // 拉取 UP 头像 / 视频封面(与 BV/UID 同步)
        return;
      }
      if (hit(rankOpenBtn)) {
        markPress(rankOpenBtn);
        game.menuScreen = 'rank';
        rankState.scroll = 0; // 每次打开从榜首开始
        loadRank();
        return;
      }
    }
    return;
  }
  if (game.over) {
    resetGame();
    game.started = false; // 死亡后退回开始界面
    return;
  }
  const p = toLogical(e);
  const hitBtn = (b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  /* 暂停 / 音量 按钮 */
  if (hitBtn(pauseBtn)) {
    markPress(pauseBtn);
    game.paused = !game.paused;
    return;
  }
  if (hitBtn(soundBtn)) {
    markPress(soundBtn);
    const v = SFX.getVolume();
    SFX.setVolume(v > 0.75 ? 0.5 : v > 0.25 ? 0 : 1); // 100% → 50% → 0 → 100%
    return;
  }
  if (game.paused) {
    /* 暂停界面: 仅「返回开始界面」可点 */
    if (hitBtn(pauseHomeBtn)) {
      markPress(pauseHomeBtn);
      resetGame();
      game.started = false; // 退回开始界面
    }
    return;
  }
  /* 点击吃外卖按钮 → 食用(牛来触发冲刺) */
  if (hitBtn(eatBtn)) {
    markPress(eatBtn);
    activeEat();
    return;
  }
  /* 点击投掷按钮 → 丢出外卖锁定敌人 */
  if (hitBtn(throwBtn)) {
    markPress(throwBtn);
    throwFood();
    return;
  }
  if (e.pointerType === 'touch' && !input.joy) {
    if (p.y > H * 0.5) {
      input.joy = { id: e.pointerId, ox: p.x, oy: p.y, dx: 0, dy: 0 };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
  }
});
/* 当前界面下, 指针是否落在可点按钮上(仅用于鼠标光标样式) */
function hitAnyButton(p) {
  const hit = (b) => !!b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  if (!game.started) {
    if (game.menuScreen === 'tutorial')
      return hit(vehicleBackBtn) || hit(tutPrevBtn) || hit(tutNextBtn);
    if (game.menuScreen === 'rank') return hit(vehicleBackBtn) || hit(rankRefreshBtn);
    if (game.menuScreen === 'vehicle') {
      if (hit(vehicleBackBtn) || hit(vehicleHomeBtn) || hit(vehicleVideoBtn)) return true;
      if (Toy.isMock() && mockBtns.some(hit)) return true;
      return Object.keys(VEHICLES).some((t) => hit(vehicleBtns[t]));
    }
    return hit(startBtn) || hit(vehicleOpenBtn) || hit(rankOpenBtn) || hit(bookBtn);
  }
  if (game.over) return false;
  if (game.paused) return hit(pauseHomeBtn);
  return hit(pauseBtn) || hit(soundBtn) || hit(eatBtn) || hit(throwBtn);
}
canvas.addEventListener('pointermove', (e) => {
  /* 鼠标: 更新悬停坐标 + 光标样式(触屏无悬停) */
  if (e.pointerType === 'mouse') {
    const lp = toLogical(e);
    uiHover.x = lp.x;
    uiHover.y = lp.y;
    uiHover.on = true;
    canvas.style.cursor = hitAnyButton(lp) ? 'pointer' : 'default';
  }
  const rd = input.rankDrag;
  if (rd && e.pointerId === rd.id) {
    const p = toLogical(e);
    rankState.scroll = rd.scroll - (p.y - rd.y);
  }
  const joy = input.joy;
  if (joy && e.pointerId === joy.id) {
    const p = toLogical(e);
    let dx = p.x - joy.ox;
    let dy = p.y - joy.oy;
    const d = Math.hypot(dx, dy);
    if (d > JOY_RADIUS) {
      dx = (dx / d) * JOY_RADIUS;
      dy = (dy / d) * JOY_RADIUS;
    }
    joy.dx = dx;
    joy.dy = dy;
  }
});
['pointerup', 'pointercancel'].forEach((t) =>
  canvas.addEventListener(t, (e) => {
    if (input.joy && e.pointerId === input.joy.id) input.joy = null;
    if (input.rankDrag && e.pointerId === input.rankDrag.id) input.rankDrag = null;
  }),
);
/* 排行榜: 鼠标滚轮滚动 */
canvas.addEventListener(
  'wheel',
  (e) => {
    if (!ready || game.started || game.menuScreen !== 'rank') return;
    e.preventDefault();
    rankState.scroll += e.deltaY * 0.6;
  },
  { passive: false },
);
canvas.addEventListener('pointerleave', () => {
  uiHover.on = false;
  canvas.style.cursor = 'default';
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
