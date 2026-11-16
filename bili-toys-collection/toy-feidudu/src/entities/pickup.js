'use strict';

/* 外卖: 掉落/拾取/回血/投掷(含毒外卖) */

/* global assets, clamp, ROAD, player, game, addFloatText, gameOver, HEAL_AMT, IMG, ctx, FOOD_SIZE, H, W, makeFood, makeSpecialFood, difficulty, POISON_DROP_CHANCE, POISON_ROAD_CHANCE, POISON_HP, THROW_DMG, THROW_POISON_DMG, THROW_SPEED, THROW_RANGE, THROW_LIFE, SPECIAL_DROP_CHANCE, MELON_DMG, MELON_MONEY, DASH_TIME, vehicleDef, enemies, damageEnemy, spawnBoom, SFX, GROUND_SCROLL_MUL, AUTO_HEAL_THRESHOLD, AUTO_HEAL_INTERVAL */

const pickups = [];
let roadFoodTimer = 3; // 路边外卖生成计时
const thrownFood = []; // 投掷中的外卖 { x, y, vx, vy, food, life, target }

/* 敌方死亡掉落 2~3 个外卖(小概率有毒) */
function dropFood(x, y) {
  if (!assets.food) return;
  const n = 2 + Math.floor(Math.random() * 2);
  /* 撒向路面空间更广阔的一侧, 且全部落在路面内可捡到 */
  const margin = 60;
  const leftSpace = x - (ROAD.left + margin);
  const rightSpace = ROAD.left + ROAD.width - margin - x;
  const dir = rightSpace > leftSpace ? 1 : -1;
  const spread = Math.max(50, Math.min(150, Math.max(leftSpace, rightSpace) + 40));
  for (let i = 0; i < n; i++) {
    /* 往前(屏幕上方向)斜着撒出, 横向偏向空间更广阔的一侧 */
    const dx = dir * spread * (0.3 + Math.random() * 0.7);
    const dy = -(25 + Math.random() * 55);
    /* 小概率掉落特殊外卖, 其次有毒 */
    const item =
      Math.random() < SPECIAL_DROP_CHANCE
        ? makeSpecialFood(Math.floor(Math.random() * 4))
        : makeFood(Math.random() < POISON_DROP_CHANCE);
    pickups.push({
      x: clamp(x + dx, ROAD.left + margin, ROAD.left + ROAD.width - margin),
      y: clamp(y + dy, 60, H - 60),
      vx: dir * (40 + Math.random() * 90),
      vy: -(240 + Math.random() * 180), // 向前滑行的初速度(带惯性)
      life: 0,
      maxLife: 7,
      food: item,
    });
  }
}

/* 路边零散外卖: 随机生成在路面上, 随场景滚动(中等概率有毒) */
function spawnRoadFood() {
  if (!assets.food) return;
  const margin = 50;
  pickups.push({
    x: ROAD.left + margin + Math.random() * (ROAD.width - margin * 2),
    y: -30,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 10,
    food: makeFood(Math.random() < POISON_ROAD_CHANCE),
    road: true,
  });
}

function updatePickups(dt) {
  /* 路边外卖定时生成: 难度越高越频繁 */
  roadFoodTimer -= dt;
  if (roadFoodTimer <= 0 && !game.over) {
    spawnRoadFood();
    roadFoodTimer = (4 + Math.random() * 5) * Math.max(0.3, 1 - difficulty() * 0.4);
  }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const f = pickups[i];
    f.life += dt;
    f.x += f.vx * dt;
    f.y += game.speed * GROUND_SCROLL_MUL * 0.9 * dt + f.vy * dt; // 惯性滑行 + 随场景后移
    f.vx *= Math.max(0, 1 - dt * 2); // 横向摩擦
    f.vy *= Math.max(0, 1 - dt * 1.5); // 纵向摩擦: 向前滑一段后逐渐落后
    /* 载具牵引: 范围内外卖被吸向玩家(越近越强) */
    const pullR = vehicleDef().pullR || 0;
    if (pullR > 0) {
      const pdx = player.x - f.x;
      const pdy = player.y - f.y;
      const pd2 = pdx * pdx + pdy * pdy;
      if (pd2 < pullR * pullR && pd2 > 1) {
        const pd = Math.sqrt(pd2);
        const force = (1 - pd / pullR) * 620;
        f.x += (pdx / pd) * force * dt;
        f.y += (pdy / pd) * force * dt;
      }
    }
    f.x = clamp(f.x, ROAD.left + 44, ROAD.left + ROAD.width - 44); // 始终留在路面内
    const dx = f.x - player.x;
    const dy = f.y - player.y;
    if (dx * dx + dy * dy < 55 * 55) {
      player.food.push(f.food); // 捡到的外卖叠到背上(新捡的在上方)
      addFloatText(f.x, f.y, '+1', f.food.poison ? '#4ade80' : '#ffd23f');
      SFX.play('pickup');
      pickups.splice(i, 1);
      continue;
    }
    if (f.life >= f.maxLife) pickups.splice(i, 1);
  }
}

/* 最下方(最早捡的)非特殊外卖的下标; 没有返回 -1(特殊外卖留给特殊客户) */
function oldestNonSpecialIndex() {
  for (let i = 0; i < player.food.length; i++) {
    if (player.food[i].special < 0) return i;
  }
  return -1;
}

/* 食用优先级: 最下面的**无毒**非特殊外卖 → 实在没有才吃有毒的
 * 返回下标, 没有可吃的返回 -1 */
function pickEatIndex() {
  let poisonIdx = -1;
  for (let i = 0; i < player.food.length; i++) {
    const f = player.food[i];
    if (f.special >= 0) continue; // 特殊外卖留给特殊客户
    if (!f.poison) return i; // 优先无毒
    if (poisonIdx < 0) poisonIdx = i; // 记下第一个有毒(最后才吃)
  }
  return poisonIdx;
}

/* 血量低且下一个外卖无毒时, 自动食用(每 0.5s 一次) */
let autoHealT = 0;
function updateAutoHeal(dt) {
  /* 跑车同样自动回血 —— 只是走「金钱回血」分支(useFood 内部按车判断) */
  if (game.over || player.hp >= player.maxHp * AUTO_HEAL_THRESHOLD) {
    autoHealT = 0;
    return;
  }
  /* 只能花钱回血的载具(跑车): 不看外卖, 直接走金钱回血; 其余载具要求有可吃的无毒外卖 */
  if (!vehicleDef().payHealCost) {
    const i = pickEatIndex();
    if (i < 0 || player.food[i].poison) {
      autoHealT = 0; // 没有可吃的无毒外卖 → 不自动吃(有毒的绝不自动吃)
      return;
    }
  }
  autoHealT -= dt;
  if (autoHealT <= 0) {
    useFood();
    autoHealT = AUTO_HEAL_INTERVAL;
  }
}

/* 主动食用(空格键): dashOnEat 载具(牛来)允许满血吃以触发冲刺 */
function activeEat() {
  if (!game.started || game.paused || game.over) return;
  useFood(!!vehicleDef().dashOnEat);
}

/* 食用最下方(最早捡的)非特殊外卖; 有毒则扣血
 * force = true 时满血也吃(用于牛来主动触发冲刺)
 * 配了 payHealCost 的载具(跑车)回血只能花钱 —— 不吃外卖, 走下面的金钱回血分支 */
function useFood(force) {
  if (game.over) return;
  const payOnly = !!vehicleDef().payHealCost;
  const i = payOnly ? -1 : pickEatIndex(); // 优先吃无毒, 有毒的留到最后
  if (i < 0) {
    const def = vehicleDef();
    const cost = def.payHealCost || 0;
    if (cost <= 0 || player.money < cost || player.hp >= player.maxHp) return;
    const amt = def.payHealAmt || 30;
    player.money -= cost;
    player.hp = Math.min(player.maxHp, player.hp + amt);
    player.healFlash = 0.4;
    addFloatText(player.x, player.y - player.height / 2, '+' + amt + ' HP -$' + cost, '#4ade80');
    SFX.play('heal');
    return;
  }
  const item = player.food[i];
  if (!item.poison && !force && player.hp >= player.maxHp) return; // 满血不吃普通外卖, 避免浪费
  player.food.splice(i, 1);
  if (item.poison) {
    player.hp = Math.max(0, player.hp - POISON_HP);
    player.flash = 0.4;
    addFloatText(player.x, player.y - player.height / 2, '-' + POISON_HP + ' 有毒!', '#ff6b6b');
    SFX.play('poison');
    if (player.hp <= 0) gameOver();
  } else {
    const heal = Math.round(HEAL_AMT * (vehicleDef().healMul || 1)); // 载具回血倍率
    player.hp = Math.min(player.maxHp, player.hp + heal);
    player.healFlash = 0.4;
    addFloatText(player.x, player.y - player.height / 2, '+' + heal, '#4ade80');
    SFX.play('heal');
    /* 载具「牛」: 食用外卖后向前冲刺一段距离 */
    if (vehicleDef().dashOnEat) {
      player.buff.dash = DASH_TIME;
      addFloatText(player.x, player.y - player.height / 2 - 16, '冲刺!', '#ffd23f');
    }
  }
}

/* 最近的敌人(投掷锁定范围) */
function nearestThrowTarget() {
  let best = null;
  let bd = THROW_RANGE * THROW_RANGE;
  for (const e of enemies) {
    if (e.dead || e.dying) continue;
    const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/* 点击投掷按钮: 丢出最下方外卖, 自动锁定敌人; 附近无敌人则随机方向 */
function throwFood() {
  if (player.food.length <= 0 || game.over) return;
  const i = oldestNonSpecialIndex();
  if (i < 0) return;
  const item = player.food.splice(i, 1)[0];
  const target = nearestThrowTarget();
  let ang;
  if (target) {
    ang = Math.atan2(target.x - player.x, -(target.y - player.y));
  } else {
    ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.2; // 大致朝前随机
  }
  thrownFood.push({
    x: player.x,
    y: player.y - player.height * 0.15,
    vx: Math.sin(ang) * THROW_SPEED,
    vy: -Math.cos(ang) * THROW_SPEED,
    food: item,
    life: 0,
    target,
    dmg: item.poison ? THROW_POISON_DMG : THROW_DMG,
    money: 0,
  });
  addFloatText(
    player.x,
    player.y - player.height / 2,
    item.poison ? '投掷 有毒!' : '投掷',
    item.poison ? '#4ade80' : '#ffd23f',
  );
  SFX.play('throw');
}

/* 0-1 特殊效果: 自动丢出西瓜(对应特殊外卖帧 2), 命中造成伤害并得钱 */
function throwMelon(target) {
  const ang = Math.atan2(target.x - player.x, -(target.y - player.y));
  thrownFood.push({
    x: player.x,
    y: player.y - player.height * 0.15,
    vx: Math.sin(ang) * THROW_SPEED,
    vy: -Math.cos(ang) * THROW_SPEED,
    food: { special: 2, poison: false, f: null },
    life: 0,
    target,
    dmg: MELON_DMG,
    money: MELON_MONEY,
    melon: true,
  });
  SFX.voice('seed'); // 丢西瓜喊「生瓜蛋子」
}

function updateThrownFood(dt) {
  for (let i = thrownFood.length - 1; i >= 0; i--) {
    const t = thrownFood[i];
    t.life += dt;
    /* 自动锁定: 轻微转向目标 */
    if (t.target && !t.target.dead && !t.target.dying) {
      const dx = t.target.x - t.x;
      const dy = t.target.y - t.y;
      const d = Math.hypot(dx, dy) || 1;
      const steer = Math.min(1, dt * 7);
      t.vx += ((dx / d) * THROW_SPEED - t.vx) * steer;
      t.vy += ((dy / d) * THROW_SPEED - t.vy) * steer;
    }
    t.x += t.vx * dt;
    t.y += t.vy * dt + game.speed * 0.5 * dt; // 随场景略后移
    /* 命中敌人 */
    let hit = false;
    for (const e of enemies) {
      if (e.dead || e.dying) continue;
      const r = e.cw * 0.7 + 6;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      if (dx * dx + dy * dy < r * r) {
        damageEnemy(e, t.dmg);
        spawnBoom(t.x, t.y);
        if (t.money) {
          player.money += t.money;
          addFloatText(e.x, e.y - e.ch, '+' + t.money, '#ffd23f');
        } else {
          addFloatText(
            e.x,
            e.y - e.ch,
            t.food.poison ? '毒!' : '-' + t.dmg,
            t.food.poison ? '#4ade80' : '#ffd23f',
          );
        }
        hit = true;
        break;
      }
    }
    if (hit) {
      thrownFood.splice(i, 1);
      continue;
    }
    /* 超时/出界: 玩家投掷的外卖落地可重新拾取; 西瓜直接消失 */
    if (t.life >= THROW_LIFE || t.y < -60 || t.y > H + 60 || t.x < ROAD.left - 60 || t.x > W + 60) {
      if (!t.melon) {
        pickups.push({
          x: clamp(t.x, ROAD.left + 44, ROAD.left + ROAD.width - 44),
          y: clamp(t.y, 60, H - 60),
          vx: t.vx * 0.15,
          vy: 0,
          life: 0,
          maxLife: 8,
          food: t.food,
        });
      }
      thrownFood.splice(i, 1);
    }
  }
}

/* 柔边高光: 特殊外卖金色, 有毒外卖绿色 */
function drawFoodGlow(item, size) {
  const rgb = item.special >= 0 ? '255,213,63' : '74,222,128';
  const g = ctx.createRadialGradient(0, 0, size * 0.05, 0, 0, size * 0.8);
  g.addColorStop(0, 'rgba(' + rgb + ',0.7)');
  g.addColorStop(0.5, 'rgba(' + rgb + ',0.32)');
  g.addColorStop(1, 'rgba(' + rgb + ',0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
  ctx.fill();
}

/* 在原点居中绘制一个外卖项(普通/有毒/特殊各用各自贴图) */
function drawFoodItem(item, size) {
  if (item.special >= 0) {
    if (!assets.specFood) return;
    const img = IMG.specFood;
    const fw = img.naturalWidth / 2; // 2列×2行
    const fh = img.naturalHeight / 2;
    const s = item.special;
    ctx.drawImage(
      img,
      (s % 2) * fw + 2,
      Math.floor(s / 2) * fh + 2,
      fw - 4,
      fh - 4,
      -size / 2,
      -size / 2,
      size,
      size,
    );
    return;
  }
  if (item.poison) {
    if (!assets.poison) return;
    const img = IMG.poison;
    const fw = img.naturalWidth / 2; // 2列×1行
    const fh = img.naturalHeight;
    const pf = item.pf || 0;
    ctx.drawImage(img, pf * fw + 2, 2, fw - 4, fh - 4, -size / 2, -size / 2, size, size);
    return;
  }
  if (!assets.food) return;
  const img = IMG.food;
  const fw = img.naturalWidth / 2;
  const fh = img.naturalHeight / 2;
  const f = item.f;
  ctx.drawImage(img, f[0] * fw + 2, f[1] * fh + 2, fw - 4, fh - 4, -size / 2, -size / 2, size, size);
}

/* ---- 外卖掉落绘制 ---- */
function drawPickups() {
  if (!assets.food && !assets.poison) return;
  for (const f of pickups) {
    const t = f.life / f.maxLife;
    /* 最后 20% 时间闪烁消失 */
    const alpha = t > 0.8 ? (1 - t) / 0.2 : 1;
    const bob = Math.sin(game.time * 6 + f.life * 10) * 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(f.x, f.y + bob);
    const s = FOOD_SIZE;
    if (f.food.poison || f.food.special >= 0) drawFoodGlow(f.food, s);
    drawFoodItem(f.food, s);
    ctx.restore();
  }
}

/* ---- 投掷中的外卖绘制 ---- */
function drawThrownFood() {
  if (!assets.food && !assets.poison) return;
  for (const t of thrownFood) {
    const s = FOOD_SIZE;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.life * 12);
    if (t.food.poison || t.food.special >= 0) drawFoodGlow(t.food, s);
    drawFoodItem(t.food, s);
    ctx.restore();
  }
}
