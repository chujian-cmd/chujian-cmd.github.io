'use strict';

/* 客户(送餐任务): 路边生成/距离提示/送达结算; 特殊客户对应特殊外卖; 可同时存在多个 */

/* global game, assets, IMG, PX_PER_M, detectRectsFrames, CUSTOMER_DELAY_FIRST_M, CUSTOMER_SPAWN_CHANCE, CUSTOMER_INTERVAL_MIN_M, CUSTOMER_INTERVAL_MAX_M, player, FOOD_PRICE, FOOD_FINE, gameOver, addFloatText, ctx, fillRR, H, ROAD, difficulty, detectGridFrames, SPECIAL_MATCH, SPECIAL_CUSTOMER_CHANCE, drawFoodItem, showScreenText, grantWeapon, BRAVE_TIME, MELON_TIME, EAT_TIME, SFX, GROUND_SCROLL_MUL */

const customers = []; // 多个路边客户
let nextCustomerDist = CUSTOMER_DELAY_FIRST_M * PX_PER_M; // 下一个客户出现的距离阈值(px)
const CUS_LEAVE_TIME = 0.6; // 送餐后客户离开(走开+淡出)的时长(秒)

/* 普通客户图集 3列×3行; 特殊客户图集 3列×2行 */
const CUS_FRAMES = []; // [{x, y, w, h}] 行主序
const SPCUS_FRAMES = [];
function detectCustomerFrames() {
  CUS_FRAMES.length = 0;
  CUS_FRAMES.push(...detectGridFrames(IMG.customer, 3, 3));
}
/* 特殊客户图集: 上排 3 人均匀分格, 下排 2 人整体居中(相对上排偏移半格) */
function detectSpecialCustomerFrames() {
  SPCUS_FRAMES.length = 0;
  const img = IMG.specCus;
  if (!img || !img.naturalWidth) return;
  const cw = img.naturalWidth / 3;
  const ch = img.naturalHeight / 2;
  const rects = [];
  for (let i = 0; i < 3; i++) rects.push({ x: i * cw, y: 0, w: cw, h: ch }); // 上排
  for (let i = 0; i < 2; i++) rects.push({ x: cw / 2 + i * cw, y: ch, w: cw, h: ch }); // 下排(居中)
  SPCUS_FRAMES.push(...detectRectsFrames(img, rects));
}
/* 特殊客户图集帧位(3列×2行, 行主序): 瓜摊老板0 / 炊事员1 / 杰哥2 / 良子3 / 刘华强4 */
function specialFrameIndex(c) {
  if (c.special === 1) return c.variant === 1 ? 4 : 0; // 刘华强 / 瓜摊老板
  if (c.special === 0) return 2; // 杰哥
  if (c.special === 2) return 3; // 良子
  return 1; // 炊事员
}

/* 客户需求随行驶里程增长: 每 500m 升一档(上限 4 档), 越往后要求越多 */
function rollDemand() {
  /* 前 250 米只要求 1~2 个 */
  if (game.totalDist < 250 * PX_PER_M) return 1 + Math.floor(Math.random() * 2);
  const km = game.totalDist / PX_PER_M / 1000; // 已行驶公里数
  const lvl = Math.min(4, Math.floor(km / 0.5)); // 每 500 米一档
  const max = 4 + lvl; // 需求上限 4 → 8
  const min = Math.min(1 + Math.floor(lvl / 2), max - 1); // 需求下限 1 → 3
  /* 难度越高需求越大: 额外 +0~3 个(封顶, 避免难度无上限后需求爆炸) */
  const extra = Math.min(3, Math.floor(difficulty() * 4 * Math.random()));
  return min + Math.floor(Math.random() * (max - min + 1)) + extra;
}

/* 持有某特殊外卖时, 提高对应特殊客户的出现权重 */
function pickSpecialIndex() {
  const w = [1, 1, 1, 1];
  for (const f of player.food) {
    if (f.special < 0) continue;
    const ci = SPECIAL_MATCH.indexOf(f.special); // 该食物对应的客户索引
    if (ci >= 0) w[ci] = 4; // 持有对应食物 → 权重 ×4
  }
  let total = 0;
  for (const x of w) total += x;
  let r = Math.random() * total;
  for (let i = 0; i < 4; i++) {
    r -= w[i];
    if (r <= 0) return i;
  }
  return 3;
}
/* 持有任意特殊外卖时, 特殊客户出现概率提升 */
function specialChance() {
  for (const f of player.food) {
    if (f.special >= 0) return Math.min(0.6, SPECIAL_CUSTOMER_CHANCE + 0.25);
  }
  return SPECIAL_CUSTOMER_CHANCE;
}

/* 测试/指定生成特殊客户: 只依赖特殊客户图集, 不等普通客户贴图 */
function spawnSpecialCustomer(special, variant, atY) {
  if (!assets.specCus || !SPCUS_FRAMES.length) return false;
  const side = Math.random() < 0.5 ? 0 : 1;
  customers.push({
    x: side === 0 ? ROAD.left - 24 : ROAD.left + ROAD.width + 24,
    y: atY != null ? atY : -110,
    side,
    special,
    variant: variant || 0,
    demand: 0,
    frame: 0,
    resolved: false,
    leaving: false,
    leaveT: 0,
  });
  return true;
}

function spawnCustomer(atY) {
  if (!assets.customer) return;
  const side = Math.random() < 0.5 ? 0 : 1;
  /* 特殊客户: 持有对应外卖时概率更高、且更偏向对应类型 */
  const special = assets.specCus && Math.random() < specialChance() ? pickSpecialIndex() : -1;
  customers.push({
    x: side === 0 ? ROAD.left - 24 : ROAD.left + ROAD.width + 24, // 路边人行道
    y: atY != null ? atY : -90, // 屏幕上方入场, 随场景向后移动
    side,
    special,
    /* 西瓜(索引1)有两个 NPC: 0 = 瓜摊老板(生瓜蛋子) / 1 = 刘华强(西瓜刀) */
    variant: special === 1 && Math.random() < 0.5 ? 1 : 0,
    demand: special >= 0 ? 0 : rollDemand(), // 特殊客户不看数量
    frame: Math.floor(Math.random() * CUS_FRAMES.length),
    resolved: false,
    leaving: false, // 结算后走开
    leaveT: 0,
  });
}

/* 消耗最下方 n 个非特殊外卖(特殊外卖留给特殊客户); 数量不足返回 false */
function consumeNonSpecial(n) {
  const idx = [];
  for (let i = 0; i < player.food.length && idx.length < n; i++) {
    if (player.food[i].special < 0) idx.push(i);
  }
  if (idx.length < n) return false;
  for (let k = idx.length - 1; k >= 0; k--) player.food.splice(idx[k], 1);
  return true;
}

/* 特殊客户效果(参数为对应特殊外卖帧):
 * 0 罐(0-0客户): 我超勇的 — 移速大增, 大幅减伤
 * 2 西瓜(0-1客户): 给匕首, 短时间自动丢西瓜
 * 1 香肠(1-0客户): 焖子 — 撞死敌人被吃掉回血
 * 3 鸡汤(1-1客户): 现有食物全部变有毒 */
function applySpecialEffect(foodIdx, npc) {
  const b = player.buff;
  if (foodIdx === 0) {
    showScreenText('我超勇的');
    SFX.voice('brave');
    b.brave = BRAVE_TIME;
  } else if (foodIdx === 2) {
    /* 西瓜: 刘华强 → 西瓜刀; 瓜摊老板 → 生瓜蛋子 */
    if (npc && npc.variant === 1) {
      showScreenText('这瓜保熟吗');
      SFX.voice('guashu'); // 刘华强台词
      grantWeapon('dagger', true); // 西瓜刀: 伤害与贴图均为普通匕首的 2 倍
    } else {
      showScreenText('我开水果摊的能卖你生瓜蛋子啊');
      SFX.voice('melon'); // 瓜摊老板台词
      b.melon = MELON_TIME; // 瓜摊老板: 自动丢生瓜蛋子
    }
  } else if (foodIdx === 1) {
    showScreenText('焖子');
    SFX.voice('eat');
    b.eat = EAT_TIME;
  } else if (foodIdx === 3) {
    showScreenText('鸡汤来咯');
    SFX.voice('soup');
    for (const it of player.food) {
      it.poison = true;
      it.special = -1;
      it.f = null;
      it.pf = Math.floor(Math.random() * 2);
    }
  }
}

function updateCustomer(dt) {
  /* 到达距离阈值: 概率生成(可同时存在多个), 然后调度下一个 */
  if (!game.over && assets.customer && game.totalDist >= nextCustomerDist) {
    if (Math.random() < Math.min(1, CUSTOMER_SPAWN_CHANCE + difficulty() * 0.3)) spawnCustomer();
    scheduleCustomer();
  }
  for (let i = customers.length - 1; i >= 0; i--) {
    const c = customers[i];
    /* 已结算 → 离开: 走向自己那一侧的人行道并淡出 */
    if (c.leaving) {
      c.leaveT += dt;
      c.x += (c.side === 0 ? -1 : 1) * 130 * dt;
      c.y += game.speed * GROUND_SCROLL_MUL * 0.5 * dt;
      if (c.leaveT >= CUS_LEAVE_TIME) customers.splice(i, 1);
      continue;
    }
    c.y += game.speed * GROUND_SCROLL_MUL * dt; // 客户站在路边, 随世界一起后移(与地面同步)
    if (!c.resolved && c.y > player.y) {
      /* 经过客户: 结算 */
      c.resolved = true;
      if (c.special >= 0) {
        /* 特殊客户: 身上有对应特殊外卖则触发特殊效果, 否则无视 */
        const want = SPECIAL_MATCH[c.special];
        const fi = player.food.findIndex((f) => f.special === want);
        if (fi >= 0) {
          player.food.splice(fi, 1);
          applySpecialEffect(want, c);
        }
      } else if (consumeNonSpecial(c.demand)) {
        const gain = c.demand * FOOD_PRICE;
        player.money += gain;
        addFloatText(c.x, c.y, '+' + gain, '#ffd23f');
      } else {
        const fine = c.demand * FOOD_FINE;
        player.money -= fine;
        addFloatText(c.x, c.y, '-' + fine, '#ff6b6b');
        if (player.money < 0) {
          /* 金钱低于 0 → 破产死亡 */
          game.overReason = 'bankrupt';
          gameOver();
        }
      }
      /* 结算完毕 → 客户离开 */
      c.leaving = true;
      c.leaveT = 0;
    }
    if (c.y > H + 120) customers.splice(i, 1);
  }
}

/* 最近的一个未结算客户(用于 HUD 距离提示); y 越大越靠近玩家 */
function nearestCustomer() {
  let best = null;
  for (const c of customers) {
    if (c.resolved) continue;
    if (!best || c.y > best.y) best = c;
  }
  return best;
}

/* 调度下一个客户的出现距离 */
function scheduleCustomer() {
  /* 难度越高客户越频繁(间隔最多缩短 50%) */
  const m =
    (CUSTOMER_INTERVAL_MIN_M + Math.random() * (CUSTOMER_INTERVAL_MAX_M - CUSTOMER_INTERVAL_MIN_M)) *
    Math.max(0.3, 1 - difficulty() * 0.5);
  nextCustomerDist = game.totalDist + m * PX_PER_M;
}

/* ---- 客户绘制(路边) ---- */
function drawCustomer() {
  for (const c of customers) {
    const s = 64;
    /* 离开时淡出 */
    const alpha = c.leaving ? Math.max(0, 1 - c.leaveT / CUS_LEAVE_TIME) : 1;
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    if (c.special >= 0) {
      /* 特殊客户贴图放大 1.2 倍 */
      const spS = s * 1.2;
      if (assets.specCus && SPCUS_FRAMES.length) {
        const f = SPCUS_FRAMES[specialFrameIndex(c) % SPCUS_FRAMES.length];
        const w = spS * (f.w / f.h);
        /* 金色高光 */
        const g = ctx.createRadialGradient(
          c.x,
          c.y - spS / 2,
          spS * 0.1,
          c.x,
          c.y - spS / 2,
          spS * 0.85,
        );
        g.addColorStop(0, 'rgba(255,213,63,0.5)');
        g.addColorStop(0.6, 'rgba(255,213,63,0.22)');
        g.addColorStop(1, 'rgba(255,213,63,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c.x, c.y - spS / 2, spS * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(c.x, c.y);
        if (c.side === 1) ctx.scale(-1, 1);
        ctx.drawImage(IMG.specCus, f.x, f.y, f.w, f.h, -w / 2, -spS, w, spS);
        ctx.restore();
        /* 需求气泡: 显示对应特殊外卖图标(结算后不再显示) */
        if (!c.resolved) {
          fillRR(c.x - 26, c.y - spS - 34, 52, 32, 12, 'rgba(10,12,15,0.72)');
          ctx.strokeStyle = 'rgba(255,213,63,0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(c.x, c.y - spS - 18, 13, 0, Math.PI * 2);
          ctx.stroke();
          ctx.save();
          ctx.translate(c.x, c.y - spS - 18);
          drawFoodItem({ special: SPECIAL_MATCH[c.special], poison: false, f: null }, 24);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      continue;
    }
    if (!assets.customer || !CUS_FRAMES.length) {
      ctx.globalAlpha = 1;
      continue;
    }
    const f = CUS_FRAMES[c.frame % CUS_FRAMES.length]; // 逐帧包围盒(以内容为中心切割)
    const w = s * (f.w / f.h); // 按帧的实际宽高比绘制
    ctx.save();
    /* 阴影 */
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 3, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(c.x, c.y);
    /* 右侧的客户镜像翻转, 面向路面 */
    if (c.side === 1) ctx.scale(-1, 1);
    ctx.drawImage(IMG.customer, f.x, f.y, f.w, f.h, -w / 2, -s, w, s);
    ctx.restore();
    /* 头顶需求气泡(结算后不再显示) */
    if (!c.resolved) {
      fillRR(c.x - 23, c.y - s - 30, 46, 20, 10, 'rgba(10,12,15,0.7)');
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23f';
      ctx.font = "bold 13px 'PingFang SC','Microsoft YaHei',sans-serif";
      ctx.fillText('× ' + c.demand, c.x, c.y - s - 16);
    }
    ctx.globalAlpha = 1;
  }
}
