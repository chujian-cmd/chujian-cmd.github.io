'use strict';

/* 界面绘制: HUD(血量/外卖/速度/犯罪条)/虚拟摇杆/游戏结束界面 */

/* global ctx, fillRR, fillBtn, rr, W, H, player, game, PX_PER_M, BASE_SPEED, IMG, assets, WEAPONS, HEAL_AMT, POISON_HP, pickEatIndex, oldestNonSpecialIndex, nearestCustomer, nextCustomerDist, input, JOY_RADIUS, clamp, VEHICLES, drawFoodItem, drawFoodGlow, oldestNonSpecialIndex, screenMsg, loadProgress, SFX, BRAVE_TIME, MELON_TIME, EAT_TIME, DASH_TIME, vehicleDef, boss, Toy, rankState, isVehicleUnlocked, vehicleUnlockHint, detectSpriteBox, CUS_FRAMES, SPCUS_FRAMES, customers */

/* 投掷外卖按钮(右下角水泥路面, 方便手机拇指操作; drawHUD 绘制, input.js pointerdown 共用) */
const throwBtn = { x: 300, y: H - 68, w: 168, h: 62 };

/* 吃外卖/冲刺按钮(投掷按钮上方; 触屏点按, 电脑也可用空格键) */
const eatBtn = { x: 300, y: H - 152, w: 168, h: 76 };

/* 暂停 / 音量 按钮(游戏内顶部中央竖排, 放大到 50×50 便于触屏; input.js pointerdown 共用) */
const pauseBtn = { x: 224, y: 12, w: 50, h: 50 };
const soundBtn = { x: 224, y: 66, w: 50, h: 50 };

/* 暂停界面「返回开始界面」按钮(input.js pointerdown 共用) */
const pauseHomeBtn = { x: W / 2 - 90, y: H * 0.44 + 84, w: 180, h: 52 };

/* 特殊效果倒计时行 */
const BUFF_ROWS = [
  { key: 'brave', label: '我超勇的', color: '#ffd23f', max: BRAVE_TIME },
  { key: 'melon', label: '水果摊', color: '#4ade80', max: MELON_TIME },
  { key: 'eat', label: '焖子', color: '#ff9d5c', max: EAT_TIME },
  { key: 'dash', label: '冲刺', color: '#4da3ff', max: DASH_TIME },
];

/* 开始按钮点击区域(主菜单, input.js pointerdown 共用) */
const startBtn = { x: W / 2 - 110, y: H * 0.45, w: 220, h: 56 };

/* "选择出行方式"按钮(主菜单, input.js pointerdown 共用) */
const vehicleOpenBtn = { x: W / 2 - 110, y: H * 0.55, w: 220, h: 56 };

/* 主菜单底部: 排行榜 (input.js pointerdown 共用) */
const rankOpenBtn = { x: W / 2 - 110, y: H * 0.66, w: 220, h: 56 };
/* 排行榜界面: 刷新按钮(input.js pointerdown 共用) */
const rankRefreshBtn = { x: W - 110, y: 20, w: 90, h: 42 };

/* 按钮按下反馈: pointerdown 标记, 绘制时短暂下沉+压暗(input.js 调用 markPress) */
const uiPress = { btn: null, t: 0 };
function markPress(btn) {
  uiPress.btn = btn;
  uiPress.t = performance.now();
}
function pressFlash(btn) {
  return uiPress.btn === btn && performance.now() - uiPress.t < 150;
}
function pressShade(btn, r) {
  if (pressFlash(btn)) fillRR(btn.x, btn.y + 3, btn.w, btn.h, r, 'rgba(0,0,0,0.22)');
}
/* 仅压暗(不位移), 用于 HUD 内的小按钮 */
function pressDark(btn, r) {
  if (pressFlash(btn)) fillRR(btn.x, btn.y, btn.w, btn.h, r, 'rgba(0,0,0,0.3)');
}

/* 主菜单: 教程按钮(「排行榜」下面的方形按钮, 间隔与上面按钮一致; input.js 共用) */
const bookBtn = { x: W / 2 - 27, y: rankOpenBtn.y + rankOpenBtn.h + 24, w: 54, h: 54 };
/* 教程: 上一页 / 下一页(input.js pointerdown 共用) */
const tutPrevBtn = { x: 24, y: H - 92, w: 96, h: 46 };
const tutNextBtn = { x: W - 120, y: H - 92, w: 96, h: 46 };

/* 鼠标悬停反馈: input.js 的 pointermove(仅鼠标)更新逻辑坐标; 悬停时按钮提亮 */
const uiHover = { x: -1, y: -1, on: false };
function isHover(btn) {
  return (
    uiHover.on &&
    uiHover.x >= btn.x &&
    uiHover.x <= btn.x + btn.w &&
    uiHover.y >= btn.y &&
    uiHover.y <= btn.y + btn.h
  );
}
function hoverShade(btn, r) {
  if (isHover(btn)) fillRR(btn.x, btn.y, btn.w, btn.h, r, 'rgba(255,255,255,0.18)');
}

/* HUD 面板底: 斜向渐变(半透明深色) + 细边, 比纯色更柔和 */
function hudPanel(x, y, w, h, r) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, 'rgba(40,46,55,0.66)');
  g.addColorStop(1, 'rgba(8,10,14,0.6)');
  fillRR(x, y, w, h, r, g);
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 1;
  rr(x, y, w, h, r);
  ctx.stroke();
}

/* 载具选择页右侧: UP 主页 / 开发视频 入口(input.js pointerdown 共用) */
const vehicleHomeBtn = { x: 346, y: 226, w: 98, h: 28 };
const vehicleVideoBtn = { x: 280, y: 342, w: 180, h: 126 };

/* 模拟模式(?mock=1)下, 载具页底部切换互动状态(input.js pointerdown 共用) */
const mockBtns = [
  { key: 'liked', label: '点赞', x: 20, y: H - 54, w: 104, h: 40 },
  { key: 'coin', label: '投币', x: 132, y: H - 54, w: 104, h: 40 },
  { key: 'fav', label: '收藏', x: 244, y: H - 54, w: 104, h: 40 },
  { key: 'following', label: '关注', x: 356, y: H - 54, w: 104, h: 40 },
];

/* 返回按钮(出行方式选择界面, input.js pointerdown 共用) */
const vehicleBackBtn = { x: 20, y: 20, w: 88, h: 42 };

/* 出行方式卡片(左侧纵向排布; 右侧为 UP 入口; input.js pointerdown 共用) */
const vehicleKeys = Object.keys(VEHICLES);
const vehicleBtns = {};
(function layoutVehicleBtns() {
  const bw = 240;
  const bh = 92;
  const gap = 16;
  const total = vehicleKeys.length * bh + (vehicleKeys.length - 1) * gap;
  const y0 = H * 0.52 - total / 2;
  vehicleKeys.forEach((k, i) => {
    vehicleBtns[k] = { x: 20, y: y0 + i * (bh + gap), w: bw, h: bh };
  });
})();

/* ---- 加载页(贴图未加载完时显示, 并屏蔽输入) ---- */
function drawLoading() {
  ctx.fillStyle = '#171a1d';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = "bold 30px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('肥嘟嘟外卖模拟器', W / 2, H * 0.42);
  const p = loadProgress();
  const bw = 260;
  const bh = 14;
  const bx = (W - bw) / 2;
  const by = H * 0.52;
  fillRR(bx, by, bw, bh, 7, 'rgba(255,255,255,0.12)');
  fillRR(bx, by, Math.max(4, bw * p), bh, 7, '#ffd23f');
  ctx.fillStyle = '#c7cdd4';
  ctx.font = "13px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('加载中… ' + Math.round(p * 100) + '%', W / 2, by + 42);
}

/* ---- 开始界面(动态马路背景 + 半透明遮罩) ----
 * 背景是 render() 已绘制的「滚动马路 + 居中骑行的角色」, 这里只压暗以保证 UI 可读 */
function drawMenu() {
  if (game.started) return;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(8,10,13,0.6)');
  g.addColorStop(0.55, 'rgba(8,10,13,0.4)');
  g.addColorStop(1, 'rgba(8,10,13,0.72)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  if (game.menuScreen === 'vehicle') drawVehicleSelect();
  else if (game.menuScreen === 'rank') drawRankScreen();
  else if (game.menuScreen === 'tutorial') drawTutorial();
  else drawMenuMain();
}

/* 标题文字: 描边 + 斜向渐变填充(align: 'center' | 'left'; dark: 偏黑配色)
 * 返回文字宽度 */
function titleText(text, x, y, size, align, dark) {
  ctx.save();
  ctx.font = "bold " + size + "px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.textAlign = align || 'center';
  const tw = ctx.measureText(text).width;
  const left = (align || 'center') === 'left';
  /* 固定 45° 斜向渐变(与文字宽高比无关) */
  const tcx = (left ? x + tw / 2 : x);
  const tcy = y - size * 0.32;
  const L = tw / 2 + size * 0.7;
  const g = ctx.createLinearGradient(tcx - L, tcy - L, tcx + L, tcy + L);
  if (dark) {
    g.addColorStop(0, '#31353b'); // 上略亮, 下纯黑 → 一点点渐变
    g.addColorStop(1, '#000000');
  } else {
    g.addColorStop(0, '#ffe98f'); // 左上偏亮
    g.addColorStop(1, '#e6b21f'); // 右下偏金
  }
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  if (!dark) {
    ctx.strokeStyle = 'rgba(8,10,13,0.85)';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
  ctx.restore();
  return tw;
}
/* 居中标题(与按钮同风格, 深色背景下保证可读) */
function menuTitle(text, x, y, size) {
  titleText(text, x, y, size, 'center');
}
/* 主标题(三行居中): 「肥嘟嘟」(强调) / 肥嘟嘟头像 / 「外卖模拟器」
 * 头像按内容包围盒裁切, 忽略透明留白 */
let TITLE_BOX = null;
function drawMainTitle() {
  const cx = W / 2;
  const fd = IMG.fatty;
  let box = null;
  if (fd && fd.naturalWidth) {
    if (!TITLE_BOX) TITLE_BOX = detectSpriteBox(fd); // 懒计算一次(解码未完成则下帧重试)
    box = TITLE_BOX || { x: 0, y: 0, w: fd.naturalWidth, h: fd.naturalHeight };
  }
  const bigSize = 54; // 「肥嘟嘟」字号(放大)
  const smallSize = 42; // 「外卖模拟器」字号(放大, 但小于「肥嘟嘟」)
  const imgH = bigSize * 1.35; // 头像高度
  const imgW = box ? (box.w / box.h) * imgH : 0;
  const gap = 12;
  ctx.font = "bold " + bigSize + "px 'PingFang SC','Microsoft YaHei',sans-serif";
  const lw = ctx.measureText('肥嘟嘟').width;
  const line1W = lw + (box ? gap + imgW : 0);
  const line1H = Math.max(bigSize * 1.15, imgH);
  const total = line1H + gap + smallSize * 1.15;
  const top = H * 0.25 - total / 2;
  const cy1 = top + line1H / 2;
  /* 第一行: 「肥嘟嘟」+ 头像(在文字右边) */
  let x = cx - line1W / 2;
  titleText('肥嘟嘟', x, cy1 + bigSize * 0.34, bigSize, 'left');
  x += lw + gap;
  if (box) {
    ctx.drawImage(fd, box.x, box.y, box.w, box.h, x, cy1 - imgH / 2, imgW, imgH);
  }
  /* 第二行: 外卖模拟器(偏黑) */
  titleText('外卖模拟器', cx, top + line1H + gap + smallSize * 0.85, smallSize, 'center', true);
}

/* 主菜单: 标题 + 开始(第一位) + 选择出行方式 + 排行榜 */
function drawMenuMain() {
  drawMainTitle();
  /* 开始按钮(第一位) */
  const sy = pressFlash(startBtn) ? 3 : 0;
  fillBtn(startBtn.x, startBtn.y + sy, startBtn.w, startBtn.h, 14, '#3d434b', '#1f2227');
  ctx.fillStyle = '#ffd23f';
  ctx.font = "bold 24px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('开始', W / 2, startBtn.y + sy + 36);
  pressShade(startBtn, 14);
  hoverShade(startBtn, 14);
  /* 载具按钮 */
  const b = vehicleOpenBtn;
  const by = pressFlash(b) ? 3 : 0;
  fillBtn(b.x, b.y + by, b.w, b.h, 14, '#dcb63a', '#b08912');
  ctx.strokeStyle = '#8a6d10';
  ctx.lineWidth = 1.5;
  rr(b.x, b.y + by, b.w, b.h, 14);
  ctx.stroke();
  ctx.fillStyle = '#5a4a00';
  ctx.font = "bold 24px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('载具', W / 2, b.y + by + 23);
  ctx.font = "12px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('当前: ' + VEHICLES[player.vehicle].label, W / 2, b.y + by + 45);
  pressShade(b, 14);
  hoverShade(b, 14);
  /* 底部: 排行榜 */
  const it = { b: rankOpenBtn, label: '排行榜' };
  const dy = pressFlash(it.b) ? 3 : 0;
  fillBtn(it.b.x, it.b.y + dy, it.b.w, it.b.h, 10, '#dcb63a', '#b08912');
  ctx.strokeStyle = '#8a6d10';
  ctx.lineWidth = 1.5;
  rr(it.b.x, it.b.y + dy, it.b.w, it.b.h, 10);
  ctx.stroke();
  ctx.fillStyle = '#5a4a00';
  ctx.font = "bold 24px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText(it.label, it.b.x + it.b.w / 2, it.b.y + dy + 30);
  pressShade(it.b, 10);
  hoverShade(it.b, 10);
  /* 教程按钮(排行榜下面的方形 📖 按钮) */
  const bb = bookBtn;
  const bdy = pressFlash(bb) ? 3 : 0;
  fillBtn(bb.x, bb.y + bdy, bb.w, bb.h, 12, '#dcb63a', '#b08912');
  ctx.strokeStyle = '#8a6d10';
  ctx.lineWidth = 1.5;
  rr(bb.x, bb.y + bdy, bb.w, bb.h, 12);
  ctx.stroke();
  ctx.fillStyle = '#5a4a00';
  ctx.font = "26px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('📖', bb.x + bb.w / 2, bb.y + bdy + 36);
  pressShade(bb, 12);
  hoverShade(bb, 12);
  /* 操作提示 */
  ctx.fillStyle = '#c7cdd4';
  ctx.font = "12px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('电脑: WASD/方向键 · 空格吃外卖 · 手机: 下半屏滑动', W / 2, H * 0.91);
}

/* 出行方式选择界面: 左侧卡片列表 + 右侧 UP 入口 + 返回 */
function drawVehicleSelect() {
  menuTitle('选择出行方式', W / 2, H * 0.11, 26);
  for (const type of vehicleKeys) {
    const def = VEHICLES[type];
    const b = vehicleBtns[type];
    const sel = player.vehicle === type;
    const unlocked = isVehicleUnlocked(type);
    const dy = pressFlash(b) ? 3 : 0;
    /* 渐变底: 锁定灰黄 / 选中深色 / 未选亮黄 */
    const gTop = !unlocked ? (sel ? '#565040' : '#c9ba7d') : sel ? '#3d434b' : '#f8d75f';
    const gBot = !unlocked ? (sel ? '#3b3520' : '#a99a52') : sel ? '#1f2227' : '#d8b024';
    fillBtn(b.x, b.y + dy, b.w, b.h, 14, gTop, gBot);
    ctx.strokeStyle = !unlocked ? '#8a7f55' : sel ? '#ffd23f' : '#c9a51c';
    ctx.lineWidth = sel ? 3 : 1.5;
    rr(b.x, b.y + dy, b.w, b.h, 14);
    ctx.stroke();
    /* 贴图预览(多帧只画第一帧), 左侧 */
    const preview = IMG[def.img];
    if (preview && preview.naturalWidth) {
      const ph = 62;
      const frameW = preview.naturalWidth / def.frames;
      const pw = (ph * frameW) / preview.naturalHeight;
      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.4;
      ctx.drawImage(
        preview,
        0,
        0,
        frameW,
        preview.naturalHeight,
        b.x + 44 - pw / 2,
        b.y + dy + b.h / 2 - ph / 2,
        pw,
        ph,
      );
      ctx.restore();
    }
    /* 文案 */
    ctx.textAlign = 'left';
    ctx.fillStyle = !unlocked ? '#6a6250' : sel ? '#ffd23f' : '#5a4a00';
    ctx.font = "bold 20px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillText(def.label, b.x + 92, b.y + dy + 40);
    ctx.font = "12px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillText(unlocked ? def.desc : '🔒 ' + vehicleUnlockHint(type), b.x + 92, b.y + dy + 64);
    pressShade(b, 14);
    hoverShade(b, 14);
    ctx.textAlign = 'center';
  }
  /* 右侧: UP 主卡片 + 开发视频入口 */
  const upX = 280;
  const upW = 180;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd23f';
  ctx.font = "bold 17px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('作者', upX, 156);
  /* 作者卡片 */
  const acY = 168;
  fillRR(upX, acY, upW, 104, 14, '#f0c93f');
  ctx.strokeStyle = '#c9a51c';
  ctx.lineWidth = 1.5;
  rr(upX, acY, upW, 104, 14);
  ctx.stroke();
  const avX = upX + 32;
  const avY = acY + 52;
  const avR = 28;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#ffe0b0';
  ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
  /* UP 头像(与 UID 同步); 未就绪时只留底色, 不画占位图 */
  const avImg = Toy.avatar();
  if (avImg && avImg.naturalWidth) drawCoverImage(avImg, avX - avR, avY - avR, avR * 2, avR * 2);
  ctx.restore();
  ctx.strokeStyle = '#e6b878';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#5a4a00';
  ctx.font = "bold 16px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText(Toy.authorName(), upX + 68, acY + 30);
  /* 访问主页按钮 */
  const hb = vehicleHomeBtn;
  const hdy = pressFlash(hb) ? 2 : 0;
  fillBtn(hb.x, hb.y + hdy, hb.w, hb.h, 8, '#ff9d44', '#d8711a');
  ctx.fillStyle = '#ffffff';
  ctx.font = "bold 13px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('访问主页', hb.x + hb.w / 2, hb.y + hdy + 19);
  pressDark(hb, 8);
  hoverShade(hb, 8);
  /* 开发视频 */
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd23f';
  ctx.font = "bold 17px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('开发视频', upX, 330);
  const vb = vehicleVideoBtn;
  const vdy = pressFlash(vb) ? 2 : 0;
  fillRR(vb.x, vb.y + vdy, vb.w, vb.h, 12, '#2b2b2b');
  ctx.save();
  ctx.beginPath();
  rr(vb.x, vb.y + vdy, vb.w, vb.h, 12);
  ctx.clip();
  /* 视频封面(与 BV 号同步); 未就绪时只留深色底, 不画占位图 */
  const cvImg = Toy.cover();
  if (cvImg && cvImg.naturalWidth) drawCoverImage(cvImg, vb.x, vb.y + vdy, vb.w, vb.h);
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.arc(vb.x + vb.w / 2, vb.y + vdy + vb.h / 2, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(vb.x + vb.w / 2 - 7, vb.y + vdy + vb.h / 2 - 11);
  ctx.lineTo(vb.x + vb.w / 2 - 7, vb.y + vdy + vb.h / 2 + 11);
  ctx.lineTo(vb.x + vb.w / 2 + 11, vb.y + vdy + vb.h / 2);
  ctx.closePath();
  ctx.fill();
  pressDark(vb, 12);
  hoverShade(vb, 12);
  /* 视频标题(换行) */
  ctx.fillStyle = '#e6e9ed';
  const titleFont = "12px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.font = titleFont;
  wrapCJK(Toy.videoTitle(), upW, titleFont).forEach((line, i) =>
    ctx.fillText(line, upX, vb.y + vb.h + 26 + i * 18),
  );
  ctx.textAlign = 'center';
  /* 返回按钮 */
  const r = vehicleBackBtn;
  const rdy = pressFlash(r) ? 3 : 0;
  fillBtn(r.x, r.y + rdy, r.w, r.h, 10, '#3d434b', '#1f2227');
  ctx.fillStyle = '#ffd23f';
  ctx.font = "bold 16px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('← 返回', r.x + r.w / 2, r.y + rdy + 27);
  pressShade(r, 10);
  hoverShade(r, 10);
  /* 模拟模式: 解锁开关 */
  if (Toy.isMock()) {
    ctx.fillStyle = '#c7cdd4';
    ctx.font = "12px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('模拟模式: 点击切换互动状态', W / 2, H - 62);
    const st = window.__toyMock.state;
    for (const mb of mockBtns) {
      const on = st[mb.key];
      const mdy = pressFlash(mb) ? 3 : 0;
      fillRR(mb.x, mb.y + mdy, mb.w, mb.h, 8, on ? '#2b2b2b' : '#c9a51c');
      ctx.fillStyle = on ? '#ffd23f' : '#5a4a00';
      ctx.font = "bold 14px 'PingFang SC','Microsoft YaHei',sans-serif";
      ctx.fillText(mb.label + (on ? ' ✓' : ''), mb.x + mb.w / 2, mb.y + mdy + 26);
      pressShade(mb, 8);
      hoverShade(mb, 8);
    }
  }
}

/* ---- 通用绘制辅助(贴图适配 / 中文换行) ---- */
/* 把贴图按比例铺满 w×h(裁掉多余部分, 居中), 用于头像/封面 */
function drawCoverImage(img, x, y, w, h) {
  if (!img || !img.naturalWidth) return;
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

/* 带黑色描边的文字(半透明按钮底上更清晰) */
function strokeFill(text, x, y, stroke) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke || 'rgba(0,0,0,0.8)';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

/* 中文按宽度换行 */
function wrapCJK(text, maxW, font) {
  ctx.font = font;
  const lines = [];
  let cur = '';
  for (const ch of text) {
    if (cur && ctx.measureText(cur + ch).width > maxW) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ---- 排行榜(里程) ---- */
function loadRank() {
  rankState.loading = true;
  rankState.error = '';
  Promise.all([Toy.getRankList(50), Toy.getMyRank()])
    .then((res) => {
      const list = res[0];
      rankState.loading = false;
      rankState.list = list || [];
      rankState.my = res[1];
      if (!list || !list.length) rankState.error = '暂无数据（需在B站内打开）';
    })
    .catch(() => {
      rankState.loading = false;
      rankState.list = [];
      rankState.error = '加载失败';
    });
}

function drawRankScreen() {
  menuTitle('里程排行榜', W / 2, H * 0.13, 26);
  const x = 40;
  const y0 = 150;
  const rowH = 46;
  if (rankState.loading) {
    ctx.fillStyle = '#e6e9ed';
    ctx.font = "15px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillText('加载中…', W / 2, y0 + 40);
  } else if (rankState.error) {
    ctx.fillStyle = '#ffc9a0';
    ctx.font = "15px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillText(rankState.error, W / 2, y0 + 40);
  } else {
    /* 可滚动列表(拖动/滚轮), 显示全部名次 */
    const list = rankState.list;
    const listTop = y0;
    const listBottom = H - 108;
    const viewH = listBottom - listTop;
    const contentH = list.length * rowH;
    const maxScroll = Math.max(0, contentH - viewH);
    if (rankState.scroll > maxScroll) rankState.scroll = maxScroll;
    if (rankState.scroll < 0) rankState.scroll = 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listTop, W, viewH);
    ctx.clip();
    const first = Math.max(0, Math.floor(rankState.scroll / rowH) - 1);
    const last = Math.min(list.length - 1, Math.floor((rankState.scroll + viewH) / rowH) + 1);
    for (let i = first; i <= last; i++) {
      const it = list[i];
      const ry = listTop + i * rowH - rankState.scroll;
      fillRR(x, ry, W - 2 * x, rowH - 8, 8, '#f0c93f');
      ctx.textAlign = 'left';
      ctx.fillStyle = '#5a4a00';
      ctx.font = "bold 16px 'PingFang SC','Microsoft YaHei',sans-serif";
      ctx.fillText('#' + it.rank, x + 12, ry + 26);
      ctx.fillText(it.nickname || '玩家', x + 62, ry + 26);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#2b2b2b';
      ctx.fillText((it.score || 0) + ' 米', x + (W - 2 * x) - 12, ry + 26);
      ctx.textAlign = 'center';
    }
    ctx.restore();
    /* 滚动条 + 提示 */
    if (maxScroll > 0) {
      const barH = Math.max(30, viewH * (viewH / contentH));
      fillRR(W - 14, listTop, 4, viewH, 2, 'rgba(255,255,255,0.12)');
      fillRR(W - 14, listTop + (viewH - barH) * (rankState.scroll / maxScroll), 4, barH, 2, 'rgba(255,210,63,0.9)');
    }
  }
  if (rankState.my) {
    const m = rankState.my;
    ctx.fillStyle = '#e6e9ed';
    ctx.font = "bold 24px 'PingFang SC','Microsoft YaHei',sans-serif";
    /* 上下两行: 上行名次 / 下行里程 */
    if (m.ranked) {
      ctx.fillText('我的排名 #' + m.rank, W / 2, H - 72);
      ctx.fillText(m.score + ' 米', W / 2, H - 38);
    } else {
      ctx.fillText('我还没上榜', W / 2, H - 55);
    }
  }
  /* 刷新按钮 */
  const rb = rankRefreshBtn;
  const rbdy = pressFlash(rb) ? 3 : 0;
  fillBtn(rb.x, rb.y + rbdy, rb.w, rb.h, 10, '#3d434b', '#1f2227');
  ctx.fillStyle = '#ffd23f';
  ctx.font = "bold 15px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('刷新', rb.x + rb.w / 2, rb.y + rbdy + 27);
  pressShade(rb, 10);
  hoverShade(rb, 10);
  /* 返回按钮 */
  const r = vehicleBackBtn;
  const rdy = pressFlash(r) ? 3 : 0;
  fillBtn(r.x, r.y + rdy, r.w, r.h, 10, '#3d434b', '#1f2227');
  ctx.fillStyle = '#ffd23f';
  ctx.font = "bold 16px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('← 返回', r.x + r.w / 2, r.y + rdy + 27);
  pressShade(r, 10);
  hoverShade(r, 10);
}

/* ---- 教程(书本按钮打开; 5 页图文) ---- */
const TUT_TITLES = ['基本操作', '送外卖', '特殊外卖', '罪恶值', '其它'];
/* 教程只讲基础, 细节交给玩家摸索 */
const TUT_BOX = {}; // 图片内容包围盒缓存

/* 外卖图标 */
function tutFood(item, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  if (item.poison || item.special >= 0) drawFoodGlow(item, size);
  drawFoodItem(item, size);
  ctx.restore();
}
/* 整图(按内容包围盒裁切, 忽略透明留白) */
function tutImg(img, x, y, h) {
  if (!img || !img.naturalWidth) return;
  if (!(img in TUT_BOX)) TUT_BOX[img] = detectSpriteBox(img);
  const b = TUT_BOX[img] || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  const w = (b.w / b.h) * h;
  ctx.drawImage(img, b.x, b.y, b.w, b.h, x - w / 2, y - h / 2, w, h);
}
/* 逐帧包围盒图集里的一帧(客户) */
function tutFrame(img, frame, x, y, h) {
  if (!img || !img.naturalWidth) return;
  const sx = frame ? frame.x : 0;
  const sy = frame ? frame.y : 0;
  const sw = frame ? frame.w : img.naturalWidth;
  const sh = frame ? frame.h : img.naturalHeight;
  const w = (sw / sh) * h;
  ctx.drawImage(img, sx, sy, sw, sh, x - w / 2, y - h / 2, w, h);
}
/* 网格图集的一格(店铺 3×2) */
function tutGrid(img, col, row, x, y, h) {
  if (!img || !img.naturalWidth) return;
  const fw = img.naturalWidth / 3;
  const fh = img.naturalHeight / 2;
  const w = (fw / fh) * h;
  ctx.drawImage(img, col * fw + 2, row * fh + 2, fw - 4, fh - 4, x - w / 2, y - h / 2, w, h);
}
/* 教程字体(放大) */
const TUT_F_TITLE = "bold 23px 'PingFang SC','Microsoft YaHei',sans-serif";
const TUT_F_DESC = "16px 'PingFang SC','Microsoft YaHei',sans-serif";
const TUT_LINE_H = 23;

/* 一行的高度(图标/标题 + 换行说明 + 行距) */
function tutRowH(row) {
  ctx.font = TUT_F_DESC;
  return 76 + wrapCJK(row.desc, W - 134, TUT_F_DESC).length * TUT_LINE_H;
}
/* 从 y 开始绘制一页(y = 第一行图标中心); extraGap 用于把行距均匀撑开填满面板 */
function tutDrawRows(rows, y, extraGap) {
  const gap = extraGap || 0;
  for (const r of rows) {
    if (r.icon) r.icon(58, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = r.color || '#ffd23f';
    ctx.font = TUT_F_TITLE;
    ctx.fillText(r.title, 104, y - 2);
    ctx.fillStyle = '#c7cdd4';
    ctx.font = TUT_F_DESC;
    wrapCJK(r.desc, W - 134, TUT_F_DESC).forEach((ln, i) =>
      ctx.fillText(ln, 104, y + 22 + i * TUT_LINE_H),
    );
    y += tutRowH(r) + gap;
  }
}

/* 每页内容: 行 = { icon?(x,y), color?, title, desc } */
const TUT_PAGES = [
  // 基本操作
  [
    { title: '移动', desc: '电脑 WASD / 方向键；手机按住下半屏滑动。向上加速、向下刹车' },
    {
      icon: (x, y) => tutFood({ f: [0, 0], poison: false, pf: 0, special: -1 }, x, y, 48),
      title: '吃外卖',
      desc: '空格键或右下按钮回血；血量低于 40% 会自动吃',
    },
    {
      icon: (x, y) => tutFood({ f: [1, 1], poison: false, pf: 0, special: -1 }, x, y, 48),
      title: '投掷',
      desc: '右下「投掷」按钮丢出外卖，自动锁定最近的敌人',
    },
  ],
  // 送外卖
  [
    {
      icon: (x, y) => tutFood({ f: [0, 0], poison: false, pf: 0, special: -1 }, x, y, 48),
      title: '外卖有三条来路',
      desc: '路上捡、撞倒竞争对手抢、去饭店花钱买',
    },
    {
      icon: (x, y) => tutFrame(IMG.customer, CUS_FRAMES[0], x, y, 56),
      title: '送给路边客户',
      desc: '按时送到赚 $20/个；没送够要赔 $8/个',
    },
    {
      color: '#ff9aa0',
      title: '两条死线',
      desc: '血量清空即死亡；金钱为负即破产',
    },
  ],
  // 特殊外卖(送给对应的特殊客户才会触发)
  [
    {
      icon: (x, y) => tutFood({ f: null, poison: false, pf: 0, special: 0 }, x, y, 46),
      title: '西瓜 · 刘华强 / 瓜摊老板',
      desc: '两人都收西瓜：刘华强给双倍伤害的西瓜刀，瓜摊老板让你自动丢生瓜蛋子',
    },
    {
      icon: (x, y) => tutFood({ f: null, poison: false, pf: 0, special: 1 }, x, y, 46),
      title: '啤酒 · 杰哥',
      desc: '短暂「我超勇的」：更快、更抗撞',
    },
    {
      icon: (x, y) => tutFood({ f: null, poison: false, pf: 0, special: 2 }, x, y, 46),
      title: '焖子 · 良子',
      desc: '更肉更痛，撞死敌人还能把它吃掉回血',
    },
    {
      icon: (x, y) => tutFood({ f: null, poison: false, pf: 0, special: 3 }, x, y, 46),
      title: '鸡汤 · 炊事员',
      desc: '给你所有外卖下毒（小心误食）',
    },
  ],
  // 罪恶值
  [
    { color: '#ff9d5c', title: '怎么涨', desc: '超速、驶入施工路段、在水泥区久留' },
    {
      icon: (x, y) => tutImg(IMG.police, x, y, 58),
      color: '#ff9d5c',
      title: '警车会来追你',
      desc: '罪恶等级越高，追你的警车越多、撞得越勤',
    },
    {
      icon: (x, y) => tutImg(IMG.spike, x, y, 42),
      color: '#ff9d5c',
      title: '还撒道钉',
      desc: '最高等级会在前方车道撒钉，碾过会减速',
    },
  ],
  // 其它
  [
    {
      icon: (x, y) => tutGrid(IMG.shop, 0, 0, x, y, 54),
      title: '水泥区店铺',
      desc: '撞上去自动购买装备和外卖；钱不够会被撞飞并掉血',
    },
    {
      icon: (x, y) => tutImg(IMG.truck, x, y, 76),
      color: '#ff5252',
      title: '逆行大运',
      desc: '偶尔迎面出现；能打就打，打不过就绕开',
    },
  ],
];

function drawTutorial() {
  const n = TUT_TITLES.length;
  const page = clamp(game.tutorialPage | 0, 0, n - 1);
  game.tutorialPage = page;
  /* 面板 */
  fillRR(14, 92, W - 28, H - 196, 16, 'rgba(10,12,15,0.86)');
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.5;
  rr(14, 92, W - 28, H - 196, 16);
  ctx.stroke();
  menuTitle('教程', W / 2, 122, 20);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = "bold 15px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText(TUT_TITLES[page], W / 2, 148);
  /* 分隔线 */
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 164);
  ctx.lineTo(W - 40, 164);
  ctx.stroke();
  /* 内容: 在面板内垂直居中(上方留 52px 给图标光晕, 避免被裁掉) */
  const rows = TUT_PAGES[page] || [];
  const cTop = 176;
  const cBottom = H - 126; // 给底部页码点留位置
  let total = 0;
  for (const r of rows) total += tutRowH(r);
  /* 剩余空间平均加到行距上(最多 34), 避免底部一大片空白 */
  const avail = cBottom - cTop - 52;
  const extraGap = rows.length > 1 ? clamp((avail - total) / (rows.length - 1), 0, 56) : 0;
  const blockH = total + extraGap * Math.max(0, rows.length - 1);
  const y0 = cTop + 52 + Math.max(0, (avail - blockH) / 2);
  ctx.save();
  rr(16, cTop - 12, W - 32, cBottom - cTop + 24, 12);
  ctx.clip();
  tutDrawRows(rows, y0, extraGap);
  ctx.restore();
  /* 页码点 */
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(W / 2 - (n - 1) * 9 + i * 18, H - 116, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = i === page ? '#ffd23f' : 'rgba(255,255,255,0.28)';
    ctx.fill();
  }
  /* 翻页按钮 */
  const nav = (b, label, on) => {
    const dy = pressFlash(b) ? 3 : 0;
    fillBtn(b.x, b.y + dy, b.w, b.h, 12, on ? '#dcb63a' : '#383838', on ? '#b08912' : '#232323');
    ctx.fillStyle = on ? '#5a4a00' : '#787878';
    ctx.font = "bold 17px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(label, b.x + b.w / 2, b.y + dy + 29);
    pressShade(b, 12);
    hoverShade(b, 12);
  };
  nav(tutPrevBtn, '上一个', page > 0);
  nav(tutNextBtn, '下一个', page < n - 1);
  /* 返回 */
  const r = vehicleBackBtn;
  const rdy = pressFlash(r) ? 3 : 0;
  fillBtn(r.x, r.y + rdy, r.w, r.h, 10, '#3d434b', '#1f2227');
  ctx.fillStyle = '#ffd23f';
  ctx.font = "bold 16px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('← 返回', r.x + r.w / 2, r.y + rdy + 27);
  pressShade(r, 10);
  hoverShade(r, 10);
}

/* ---- 虚拟摇杆(仅手机滑动时显示) ---- */
function drawJoy() {
  const joy = input.joy;
  if (!joy) return;
  /* 底座 */
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(joy.ox, joy.oy, JOY_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(joy.ox, joy.oy, JOY_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  /* 摇杆头 */
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(joy.ox + joy.dx, joy.oy + joy.dy, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(joy.ox + joy.dx, joy.oy + joy.dy, 26, 0, Math.PI * 2);
  ctx.stroke();
}

/* ---- HUD: 左上血量(红)+外卖按钮, 右上速度+里程 ---- */
function drawHUD() {
  /* 测试模式提示(本地调试: 控制台 game.testMode = true) */
  if (game.testMode) {
    fillRR(12, 116, 96, 22, 6, 'rgba(255,210,63,0.85)');
    ctx.fillStyle = '#2b2b2b';
    ctx.font = "bold 12px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText('测试模式 ON', 20, 132);
    /* 诊断读数: specCus 是否加载 / 图集帧数 / 客户图是否加载 / 当前客户数 */
    ctx.fillStyle = '#7fe0a0';
    ctx.font = "11px monospace, 'Microsoft YaHei'";
    ctx.fillText(
      'specCus=' +
        (assets.specCus ? 1 : 0) +
        ' frames=' +
        SPCUS_FRAMES.length +
        ' cus=' +
        (assets.customer ? 1 : 0) +
        ' n=' +
        customers.length,
      12,
      H - 12,
    );
  }
  /* 左上: 玩家血量(红色) + 外卖数量 + 金钱 */
  hudPanel(12, 12, 204, 96, 12);
  fillRR(24, 26, 180, 14, 7, 'rgba(255,255,255,0.12)');
  const ratio = clamp(player.hp / player.maxHp, 0, 1);
  /* 血量低于 30% 时呼吸闪烁 */
  const pulse = ratio < 0.3 ? 0.6 + 0.4 * Math.sin(game.time * 8) : 1;
  const hpG = ctx.createLinearGradient(0, 27, 0, 39);
  hpG.addColorStop(0, 'rgba(255,118,118,' + pulse + ')');
  hpG.addColorStop(1, 'rgba(198,44,50,' + pulse + ')');
  fillRR(26, 28, Math.max(4, 176 * ratio), 10, 5, hpG);
  ctx.textAlign = 'left';
  /* 外卖数量 + 特殊外卖图标(去重显示持有的种类与数量) */
  let normalN = 0;
  const specCounts = [0, 0, 0, 0];
  for (const f of player.food) {
    if (f.special >= 0) specCounts[f.special]++;
    else normalN++;
  }
  ctx.font = "bold 13px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillStyle = '#e6e9ed';
  ctx.fillText('外卖 ×' + normalN, 28, 66);
  let sx = 100;
  for (let i = 0; i < specCounts.length; i++) {
    if (specCounts[i] <= 0) continue;
    ctx.save();
    ctx.translate(sx, 60);
    drawFoodItem({ special: i, poison: false, f: null }, 22);
    ctx.restore();
    ctx.fillStyle = '#ffd23f';
    ctx.font = "bold 10px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillText('×' + specCounts[i], sx + 12, 70);
    sx += 26;
  }
  /* 金钱(负数显示红色) */
  ctx.fillStyle = player.money < 0 ? '#ff6b6b' : '#ffd23f';
  ctx.font = "bold 16px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('💰 ' + player.money, 28, 86);

  /* 犯罪条(左上角面板下方) */
  hudPanel(12, 118, 204, 16, 8);
  const cr = clamp(player.crime / 100, 0, 1);
  if (cr > 0) {
    const cp = 0.7 + 0.3 * Math.sin(game.time * 6);
    const crimeG = ctx.createLinearGradient(0, 120, 0, 132);
    crimeG.addColorStop(0, 'rgba(255,176,84,' + cp + ')');
    crimeG.addColorStop(1, 'rgba(226,86,26,' + cp + ')');
    fillRR(14, 120, 200 * cr, 12, 6, crimeG);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = "bold 10px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('犯罪 Lv' + player.crimeLvl, 20, 131);

  /* Boss 血条(犯罪条下方, 不与其它 UI 重叠) */
  if (boss) {
    const bw = W - 40;
    const bx = 20;
    const by = 140;
    fillRR(bx - 2, by - 2, bw + 4, 20, 10, 'rgba(10,12,15,0.7)');
    const bossG = ctx.createLinearGradient(0, by, 0, by + 16);
    bossG.addColorStop(0, '#ff6a6f');
    bossG.addColorStop(1, '#c22f36');
    fillRR(bx, by, Math.max(4, bw * (boss.hp / boss.maxHp)), 16, 8, bossG);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = "bold 11px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillText('逆行大运  ' + Math.ceil(boss.hp) + ' / ' + boss.maxHp, W / 2, by + 13);
  }

  /* 特殊效果倒计时 */
  drawBuffs();

  /* 暂停 / 音量 按钮 */
  hudPanel(pauseBtn.x, pauseBtn.y, pauseBtn.w, pauseBtn.h, 10);
  ctx.fillStyle = '#e6e9ed';
  const pcx = pauseBtn.x + pauseBtn.w / 2;
  const pcy = pauseBtn.y + pauseBtn.h / 2;
  if (game.paused) {
    /* 播放三角 */
    ctx.beginPath();
    ctx.moveTo(pcx - 7, pcy - 12);
    ctx.lineTo(pcx - 7, pcy + 12);
    ctx.lineTo(pcx + 11, pcy);
    ctx.closePath();
    ctx.fill();
  } else {
    /* 暂停双竖线 */
    ctx.fillRect(pcx - 9, pcy - 12, 7, 24);
    ctx.fillRect(pcx + 2, pcy - 12, 7, 24);
  }
  pressDark(pauseBtn, 10);
  hoverShade(pauseBtn, 10);
  hudPanel(soundBtn.x, soundBtn.y, soundBtn.w, soundBtn.h, 10);
  const vol = SFX.getVolume();
  ctx.fillStyle = vol <= 0 ? '#8a929c' : '#e6e9ed';
  ctx.font = "18px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText(vol <= 0 ? '🔇' : '🔊', soundBtn.x + soundBtn.w / 2, soundBtn.y + 24);
  ctx.fillStyle = '#9aa3ad';
  ctx.font = "11px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText(Math.round(vol * 100) + '%', soundBtn.x + soundBtn.w / 2, soundBtn.y + 42);
  pressDark(soundBtn, 10);
  hoverShade(soundBtn, 10);
  ctx.textAlign = 'left';

  /* 右上: 当前速度 + 已行驶里程 */
  hudPanel(W - 176, 12, 164, 64, 12);
  ctx.textAlign = 'right';
  const kmh = Math.round((game.speed / PX_PER_M) * 3.6);
  /* 超过默认速度时文字变黄提示 */
  ctx.fillStyle = kmh > Math.round((BASE_SPEED / PX_PER_M) * 3.6) + 5 ? '#ffd23f' : '#e6e9ed';
  ctx.font = "bold 20px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText(kmh + ' km/h', W - 24, 40);
  ctx.fillStyle = '#9aa3ad';
  ctx.font = "12px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('已行驶 ' + (game.totalDist / PX_PER_M / 1000).toFixed(2) + ' km', W - 24, 62);


  /* 吃外卖按钮(牛来 = 主动冲刺; 电脑也可用空格)
   * 优先进食无毒外卖, 有毒的留到最后; 按钮按有毒/无毒换色并给文字提示 */
  const eatIdx = pickEatIndex();
  const eatItem = eatIdx >= 0 ? player.food[eatIdx] : null;
  const edef = vehicleDef();
  const isCow = !!edef.dashOnEat;
  const payCost = edef.payHealCost || 0;
  const payHeal = payCost > 0; // 跑车回血只花钱, 不吃外卖
  const payAmt = edef.payHealAmt || 30;
  const eatCan = eatItem
    ? isCow || player.hp < player.maxHp
    : payHeal && player.money >= payCost && player.hp < player.maxHp;
  const eatPoison = !!(eatItem && eatItem.poison);
  const eatRgb = isCow ? '255,210,63' : eatPoison ? '255,96,96' : '74,222,128';
  /* 有毒时用更浓的红底 + 更粗的边, 和无毒(绿)一眼区分 */
  const eatA0 = eatPoison ? 0.55 : 0.32;
  const eatA1 = eatPoison ? 0.24 : 0.1;
  const eatG = ctx.createLinearGradient(eatBtn.x, eatBtn.y, eatBtn.x + eatBtn.w, eatBtn.y + eatBtn.h);
  eatG.addColorStop(0, eatCan ? 'rgba(' + eatRgb + ',' + eatA0 + ')' : 'rgba(255,255,255,0.07)');
  eatG.addColorStop(1, eatCan ? 'rgba(' + eatRgb + ',' + eatA1 + ')' : 'rgba(255,255,255,0.03)');
  fillRR(eatBtn.x, eatBtn.y, eatBtn.w, eatBtn.h, 14, eatG);
  ctx.strokeStyle = eatCan
    ? 'rgba(' + eatRgb + ',' + (eatPoison ? 0.95 : 0.65) + ')'
    : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = eatPoison ? 2.5 : 1;
  rr(eatBtn.x, eatBtn.y, eatBtn.w, eatBtn.h, 14);
  ctx.stroke();
  if (eatItem) {
    ctx.save();
    ctx.translate(eatBtn.x + 42, eatBtn.y + eatBtn.h / 2);
    if (eatPoison || eatItem.special >= 0) drawFoodGlow(eatItem, 48);
    drawFoodItem(eatItem, 48);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = eatCan ? (isCow ? '#ffd23f' : eatPoison ? '#ff7b7b' : '#4ade80') : '#8a929c';
  ctx.font = "bold 22px 'PingFang SC','Microsoft YaHei',sans-serif";
  strokeFill(isCow ? '冲刺' : payHeal ? '花钱回血' : '吃外卖', eatBtn.x + 84, eatBtn.y + 34);
  ctx.fillStyle = eatCan ? (isCow ? '#ffe08a' : eatPoison ? '#ffb3b3' : '#9aa3ad') : '#6a727c';
  ctx.font = "12px 'PingFang SC','Microsoft YaHei',sans-serif";
  strokeFill(
    isCow
      ? '消耗外卖加速'
      : payHeal
        ? '-$' + payCost + ' → +' + payAmt + ' HP'
        : eatPoison
          ? '有毒! -' + POISON_HP + ' HP'
          : '+' + Math.round(HEAL_AMT * (edef.healMul || 1)) + ' HP',
    eatBtn.x + 84,
    eatBtn.y + 60,
  );
  pressDark(eatBtn, 14);
  hoverShade(eatBtn, 14);

  /* 投掷按钮(消耗最下方非特殊外卖, 自动锁定敌人; 有毒=绿色 / 无毒=黄色 区分) */
  const throwIdx = oldestNonSpecialIndex();
  const canThrow = throwIdx >= 0;
  const throwPoison = canThrow && player.food[throwIdx].poison;
  const throwRgb = throwPoison ? '74,222,128' : '255,210,63';
  const throwG = ctx.createLinearGradient(
    throwBtn.x,
    throwBtn.y,
    throwBtn.x + throwBtn.w,
    throwBtn.y + throwBtn.h,
  );
  throwG.addColorStop(0, canThrow ? 'rgba(' + throwRgb + ',0.32)' : 'rgba(255,255,255,0.07)');
  throwG.addColorStop(1, canThrow ? 'rgba(' + throwRgb + ',0.1)' : 'rgba(255,255,255,0.03)');
  fillRR(throwBtn.x, throwBtn.y, throwBtn.w, throwBtn.h, 14, throwG);
  ctx.strokeStyle = canThrow ? 'rgba(' + throwRgb + ',0.65)' : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  rr(throwBtn.x, throwBtn.y, throwBtn.w, throwBtn.h, 14);
  ctx.stroke();
  if (canThrow) {
    const bottom = player.food[throwIdx];
    ctx.save();
    ctx.translate(throwBtn.x + 38, throwBtn.y + throwBtn.h / 2);
    if (bottom.poison || bottom.special >= 0) drawFoodGlow(bottom, 42);
    drawFoodItem(bottom, 42);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = canThrow ? (throwPoison ? '#4ade80' : '#ffd23f') : '#8a929c';
  ctx.font = "bold 22px 'PingFang SC','Microsoft YaHei',sans-serif";
  strokeFill('投掷', throwBtn.x + 78, throwBtn.y + 30);
  ctx.fillStyle = canThrow ? (throwPoison ? '#7fe0a0' : '#ffe08a') : '#6a727c';
  ctx.font = "12px 'PingFang SC','Microsoft YaHei',sans-serif";
  strokeFill(throwPoison ? '有毒 · 伤害更高' : '锁定敌人', throwBtn.x + 78, throwBtn.y + 52);
  pressDark(throwBtn, 14);
  hoverShade(throwBtn, 14);

  /* 装备状态(吃外卖按钮上方, 可同时显示多种道具) */
  const heldTypes = ['dagger', 'pistol', 'rifle', 'shield'].filter((t) => player.weapons[t]);
  if (heldTypes.length > 0) {
    hudPanel(eatBtn.x, eatBtn.y - 60, eatBtn.w, 48, 12);
    if (assets.item) {
      const fw = IMG.item.naturalWidth / 2;
      const fh = IMG.item.naturalHeight / 2;
      heldTypes.forEach((type, idx) => {
        const def = WEAPONS[type];
        const ix = eatBtn.x + 6 + idx * 34;
        ctx.drawImage(
          IMG.item,
          def.frame[0] * fw + 2,
          def.frame[1] * fh + 2,
          fw - 4,
          fh - 4,
          ix,
          eatBtn.y - 52,
          26,
          26,
        );
        ctx.textAlign = 'left';
        ctx.fillStyle = '#e6e9ed';
        ctx.font = "bold 11px 'PingFang SC','Microsoft YaHei',sans-serif";
        ctx.fillText('×' + player.weapons[type].ammo, ix + 27, eatBtn.y - 30);
      });
    }
  }

  /* 右侧: 有客户时显示距离与需求, 无客户时显示预警 */
  const nextC = nearestCustomer();
  if (nextC) {
    hudPanel(W - 170, 92, 158, 72, 12);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e6e9ed';
    ctx.font = "bold 16px 'PingFang SC','Microsoft YaHei',sans-serif";
    const distM = Math.max(0, Math.round((nextC.y - player.y) / PX_PER_M));
    ctx.fillText('距离客户 ' + distM + ' 米', W - 24, 116);
    ctx.fillStyle = '#ffd23f';
    ctx.font = "bold 15px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillText(nextC.special >= 0 ? '特殊客户' : '需要 × ' + nextC.demand, W - 24, 144);
  } else if (assets.customer && !game.over) {
    /* 客户预警: 再行驶多少米从上方刷新一个客户 */
    const remainM = Math.max(0, Math.round((nextCustomerDist - game.totalDist) / PX_PER_M));
    hudPanel(W - 170, 92, 158, 72, 12);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffb84d';
    ctx.font = "bold 15px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillText('⚠ 客户预警', W - 24, 116);
    ctx.fillStyle = '#e6e9ed';
    ctx.font = "bold 16px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillText('前方 ' + remainM + ' m 出现', W - 24, 144);
  }
}

/* ---- 屏幕中央大字(特殊客户台词) ---- */
function drawScreenMsg() {
  if (screenMsg.life <= 0 || !screenMsg.text) return;
  const fadeIn = Math.min(1, (screenMsg.maxLife - screenMsg.life) / 0.2);
  const fadeOut = Math.min(1, screenMsg.life / 0.4);
  const size = Math.min(36, (W - 48) / screenMsg.text.length);
  ctx.save();
  ctx.globalAlpha = fadeIn * fadeOut;
  ctx.textAlign = 'center';
  ctx.font = "bold " + size + "px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(screenMsg.text, W / 2, H * 0.4);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(screenMsg.text, W / 2, H * 0.4);
  ctx.restore();
}

/* ---- 特殊效果倒计时条 ---- */
function drawBuffs() {
  let y = boss ? 172 : 150; // 有 Boss 血条时下移, 避免重叠
  for (const b of BUFF_ROWS) {
    const t = player.buff[b.key];
    if (t <= 0) continue;
    const ratio = Math.min(1, t / b.max);
    hudPanel(12, y, 132, 16, 8);
    fillRR(14, y + 2, Math.max(2, 128 * ratio), 12, 6, b.color);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 10px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText(b.label + ' ' + t.toFixed(1) + 's', 20, y + 12);
    ctx.restore();
    y += 20;
  }
}

/* ---- 暂停界面 ---- */
function drawPause() {
  if (!game.paused) return;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = "bold 34px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('已暂停', W / 2, H * 0.44);
  ctx.fillStyle = '#c7cdd4';
  ctx.font = "14px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('点击暂停按钮 / 按 Esc 继续', W / 2, H * 0.44 + 34);
  ctx.fillText('音量 ' + Math.round(SFX.getVolume() * 100) + '%（点右上角喇叭切换）', W / 2, H * 0.44 + 58);
  /* 返回开始界面按钮 */
  const ph = pauseHomeBtn;
  const phdy = pressFlash(ph) ? 3 : 0;
  fillBtn(ph.x, ph.y + phdy, ph.w, ph.h, 12, '#3d434b', '#1f2227');
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2;
  rr(ph.x, ph.y + phdy, ph.w, ph.h, 12);
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.font = "bold 18px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('返回开始界面', W / 2, ph.y + phdy + 33);
  pressShade(ph, 12);
  hoverShade(ph, 12);
}

/* ---- 游戏结束界面 ---- */
function drawGameOver() {
  if (!game.over) return;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5252';
  ctx.font = "bold 36px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('游戏结束', W / 2, H / 2 - 50);
  ctx.fillStyle = '#ffb3b3';
  ctx.font = "15px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText(game.overReason === 'bankrupt' ? '破产！' : '死亡！', W / 2, H / 2 - 16);
  ctx.fillStyle = '#c7cdd4';
  ctx.font = "15px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText(
    '本次行驶 ' + (game.totalDist / PX_PER_M / 1000).toFixed(2) + ' km',
    W / 2,
    H / 2 + 10,
  );
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(game.time * 4);
  ctx.fillStyle = '#ffd23f';
  ctx.font = "13px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText('— 点击返回开始界面 —', W / 2, H / 2 + 44);
  ctx.globalAlpha = 1;
}
