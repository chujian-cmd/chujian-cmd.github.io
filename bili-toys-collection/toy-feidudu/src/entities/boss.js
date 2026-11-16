'use strict';

/* 逆行大运 Boss: 迎面驶来 + 左右变道; 玩家撞击磨血, 引警车撞爆发伤害;
 * 存活时限内未击败则向下方开走; 击败掉落金钱与外卖(外卖量按玩家受伤推算) */

/* global game, assets, IMG, PX_PER_M, player, police, enemies, pickups, ctx, fillRR, H, W, ROAD, clamp, addFloatText, damagePlayer, spawnBoom, makeFood, launchEnemy, dropFood, HEAL_AMT, DMG_FRONT, BOSS_HP, BOSS_RAM_CD, BOSS_POLICE_DMG, BOSS_EAT_HEAL, vehicleDef, DASH_DEALT_MUL, EAT_DMG_MUL, HUE_VARIANT_DEG, hueSprite, SFX, BOSS_SIZE, BOSS_DEFAULT_Y, BOSS_LANE_INTERVAL_MIN, BOSS_LANE_INTERVAL_MAX, BOSS_LANE_SPEED, BOSS_CHARGE_INTERVAL_MIN, BOSS_CHARGE_INTERVAL_MAX, BOSS_CHARGE_SPEED, BOSS_TIME, BOSS_DELAY_FIRST_M, BOSS_INTERVAL_MIN_M, BOSS_INTERVAL_MAX_M, BOSS_SPAWN_CHANCE, BOSS_MONEY, BOSS_SCALE_PER_DIFF, difficulty, contentSize, detectSpriteBox */

let boss = null; // { x, y, hp, maxHp, scale, lane, laneTimer, state, time, flash, ramCd, dmgTaken }
let nextBossDist = BOSS_DELAY_FIRST_M * PX_PER_M;
let TRUCK_BOX = null; // 大运贴图内容包围盒

function rand(a, b) {
  return a + Math.random() * (b - a);
}
function laneCenter(lane) {
  return lane === 0 ? ROAD.left + ROAD.width / 4 : ROAD.left + (ROAD.width * 3) / 4;
}
/* Boss 绘制尺寸(按贴图内容比例, 高度定 BOSS_SIZE) */
function bossDim() {
  const img = IMG.truck;
  const box = TRUCK_BOX || { x: 0, y: 0, w: img.naturalWidth || 1, h: img.naturalHeight || 1 };
  const h = BOSS_SIZE;
  const w = (h * box.w) / box.h;
  return { w, h, box };
}

function scheduleBoss() {
  nextBossDist =
    game.totalDist + rand(BOSS_INTERVAL_MIN_M, BOSS_INTERVAL_MAX_M) * PX_PER_M;
}
/* Boss 强度系数: 随里程无上限提升(每 1 点难度 +BOSS_SCALE_PER_DIFF) */
function bossScale() {
  return 1 + difficulty() * BOSS_SCALE_PER_DIFF;
}
function spawnBoss() {
  const lane = Math.random() < 0.5 ? 0 : 1;
  const s = bossScale(); // 里程越远, 血量/伤害/奖励越高
  boss = {
    x: laneCenter(lane),
    y: BOSS_DEFAULT_Y - 260, // 从上方降下到默认位置
    hue: Math.random() < 0.5, // 一半概率用色相偏移版本
    scale: s,
    hp: Math.round(BOSS_HP * s),
    maxHp: Math.round(BOSS_HP * s),
    lane,
    laneTimer: rand(BOSS_LANE_INTERVAL_MIN, BOSS_LANE_INTERVAL_MAX),
    state: 'hover', // hover 悬停 / surge 前冲 / retreat 退回 / escape 逃逸
    chargeTimer: rand(BOSS_CHARGE_INTERVAL_MIN, BOSS_CHARGE_INTERVAL_MAX),
    time: 0,
    flash: 0,
    ramCd: 0,
    wcd: 0, // 武器受击冷却(匕首连续命中限频)
    dmgTaken: 0, // 玩家在本次 Boss 战中累计受到的伤害(用于计算外卖掉落)
  };
}
/* 击败大运的奖励结算: 金钱 + 外卖掉落 */
function bossReward(b) {
  const money = Math.round(BOSS_MONEY * b.scale); // 奖励随强度同步提升
  player.money += money;
  addFloatText(b.x, b.y, '+' + money, '#ffd23f');
  /* 外卖掉落: 覆盖玩家本次受伤所需回血量 */
  const n = clamp(Math.ceil(b.dmgTaken / HEAL_AMT) || 4, 4, 24);
  for (let i = 0; i < n; i++) {
    pickups.push({
      x: clamp(b.x + (Math.random() - 0.5) * 150, ROAD.left + 44, ROAD.left + ROAD.width - 44),
      y: clamp(b.y + (Math.random() - 0.5) * 110, 60, H - 60),
      vx: (Math.random() - 0.5) * 80,
      vy: -80,
      life: 0,
      maxLife: 10,
      food: makeFood(),
    });
  }
}

function killBoss() {
  const b = boss;
  for (let i = 0; i < 5; i++) {
    spawnBoom(b.x + (Math.random() - 0.5) * 90, b.y + (Math.random() - 0.5) * 90);
  }
  game.shake = 0.8;
  /* 「焖子」状态: 大运被吃掉(缩小飞向玩家, 到达后再结算奖励并大量回血) */
  if (player.buff.eat > 0) {
    b.eaten = true;
    b.eatT = 0;
    return;
  }
  bossReward(b);
  boss = null;
  scheduleBoss();
}

/* 武器/子弹对 Boss 造成伤害(通用入口) */
function damageBoss(dmg, x, y) {
  if (!boss) return false;
  boss.hp = Math.max(0, boss.hp - dmg);
  boss.flash = 0.15;
  spawnBoom(x != null ? x : boss.x, y != null ? y : boss.y);
  if (boss.hp <= 0) {
    killBoss();
    return true;
  }
  return false;
}

/* 车头判定框(比整张贴图小, 只取露出的车头部分) */
function bossHit() {
  const dim = bossDim();
  return { x: boss.x, y: boss.y + dim.h * 0.28, hw: dim.w * 0.38, hh: dim.h * 0.12 };
}
function overlapPlayer() {
  const hit = bossHit();
  const pcs = contentSize(player.vehicle);
  /* 玩家自身只取一半尺寸, 避免"没碰到也被判定" */
  return (
    Math.abs(player.x - hit.x) < hit.hw + pcs.w * 0.4 &&
    Math.abs(player.y - hit.y) < hit.hh + pcs.h * 0.4
  );
}

function updateBoss(dt) {
  if (!boss) {
    if (!game.over && assets.truck && game.totalDist >= nextBossDist) {
      if (Math.random() < BOSS_SPAWN_CHANCE) spawnBoss();
      scheduleBoss();
    }
    return;
  }
  const b = boss;
  /* 被吃掉: 缩小旋转飞向玩家, 抵达后结算奖励 + 大量回血 */
  if (b.eaten) {
    b.eatT += dt;
    const dx = player.x - b.x;
    const dy = player.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 700;
    b.x += (dx / d) * sp * dt;
    b.y += (dy / d) * sp * dt;
    if (d < 46 || b.eatT > 1.8) {
      player.hp = Math.min(player.maxHp, player.hp + BOSS_EAT_HEAL);
      player.healFlash = 0.5;
      addFloatText(
        player.x,
        player.y - player.height / 2,
        '+' + BOSS_EAT_HEAL + ' HP',
        '#4ade80',
      );
      SFX.voice('eat', 0.4);
      bossReward(b);
      boss = null;
      scheduleBoss();
    }
    return;
  }
  b.time += dt;
  if (b.flash > 0) b.flash -= dt;
  if (b.ramCd > 0) b.ramCd -= dt;
  if (b.wcd > 0) b.wcd -= dt;

  /* 变道(随机左右车道) */
  b.laneTimer -= dt;
  if (b.laneTimer <= 0) {
    b.lane = Math.random() < 0.5 ? 0 : 1; // 随机切到左/右车道
    b.laneTimer = rand(BOSS_LANE_INTERVAL_MIN, BOSS_LANE_INTERVAL_MAX);
  }
  const tx = laneCenter(b.lane);
  b.x += (tx - b.x) * Math.min(1, (dt * BOSS_LANE_SPEED) / 100);

  /* 超时逃逸 */
  if (b.state !== 'escape' && b.time >= BOSS_TIME) b.state = 'escape';

  /* 纵向状态机: 默认在固定屏幕位置(只露车头), 间隔前冲再退回 */
  const hoverY = BOSS_DEFAULT_Y;
  if (b.state === 'escape') {
    b.y += BOSS_CHARGE_SPEED * dt; // 向下方开走
    if (b.y > H + BOSS_SIZE) {
      boss = null;
      scheduleBoss();
      return;
    }
  } else if (b.state === 'surge') {
    b.y += BOSS_CHARGE_SPEED * dt; // 向前冲撞
    if (b.y >= player.y - 40) b.state = 'retreat';
  } else {
    /* hover / retreat: 回到固定默认位置 */
    b.y += (hoverY - b.y) * Math.min(1, dt * (b.state === 'retreat' ? 3 : 4));
    if (b.state === 'hover') {
      b.chargeTimer -= dt;
      if (b.chargeTimer <= 0) b.state = 'surge';
    } else if (b.state === 'retreat' && Math.abs(b.y - hoverY) < 10) {
      b.state = 'hover';
      b.chargeTimer = rand(BOSS_CHARGE_INTERVAL_MIN, BOSS_CHARGE_INTERVAL_MAX);
    }
  }

  /* 与玩家碰撞: 玩家受伤 + 反方向弹开 + Boss 少量扣血(冷却) */
  if (overlapPlayer()) {
    if (player.hitCd <= 0) {
      /* 把玩家向远离大运的方向弹开(主要向后/向下) */
      const dx = player.x - b.x;
      const dy = player.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      player.kbx = (dx / d) * 760;
      player.kby = (dy / d) * 900;
      const dmg = DMG_FRONT * b.scale; // 里程越远, 撞大运越疼
      damagePlayer(dmg);
      b.dmgTaken += dmg;
    }
    if (b.ramCd <= 0) {
      b.ramCd = BOSS_RAM_CD;
      /* 撞击伤害 = 玩家前撞伤害 × 载具撞击倍率(冲刺时 ×DASH_DEALT_MUL), 与撞敌骑手一致 */
      const ramDmg = Math.max(
        1,
        Math.round(
          DMG_FRONT *
            (vehicleDef().damageMul || 1) *
            (player.buff.dash > 0 ? DASH_DEALT_MUL : 1) *
            (player.buff.eat > 0 ? EAT_DMG_MUL : 1),
        ),
      );
      b.hp = Math.max(0, b.hp - ramDmg);
      b.flash = 0.15;
      spawnBoom((player.x + b.x) / 2, (player.y + b.y) / 2);
      if (b.hp <= 0) {
        killBoss();
        return;
      }
    }
  }

  /* 与警车碰撞: Boss 大量扣血, 警车被弹开(继续追) */
  const hitBox = bossHit();
  for (const p of police) {
    if (Math.abs(p.x - hitBox.x) < hitBox.hw + 26 && Math.abs(p.y - hitBox.y) < hitBox.hh + 40) {
      b.hp = Math.max(0, b.hp - BOSS_POLICE_DMG);
      b.flash = 0.2;
      spawnBoom(b.x, b.y);
      game.shake = 0.5;
      p.x += (p.x >= b.x ? 1 : -1) * 70; // 弹开
      p.state = 'retreat';
      p.cycleT = 1.2;
      if (b.hp <= 0) {
        killBoss();
        return;
      }
      break;
    }
  }

  /* 撞飞敌方骑手(秒杀, 同警车) */
  for (const e of enemies) {
    if (e.dead || e.dying) continue;
    if (
      Math.abs(e.x - hitBox.x) < hitBox.hw + e.cw * 0.4 &&
      Math.abs(e.y - hitBox.y) < hitBox.hh + e.ch * 0.4
    ) {
      e.hp = 0;
      e.dead = true;
      e.dying = true;
      e.dieT = 0;
      launchEnemy(e, b.x);
      spawnBoom(e.x, e.y);
      dropFood(e.x, e.y);
    }
  }
}

/* ---- 绘制 ---- */
function drawBoss() {
  if (!boss || !assets.truck) return;
  const b = boss;
  if (!TRUCK_BOX) TRUCK_BOX = detectSpriteBox(IMG.truck);
  const dim = bossDim();
  const img = b.hue ? hueSprite(IMG.truck, HUE_VARIANT_DEG) : IMG.truck;
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.eaten) {
    /* 被吃掉: 缩小 + 翻滚 + 淡出 */
    const k = Math.max(0.12, 1 - b.eatT * 1.1);
    ctx.scale(k, k);
    ctx.rotate(b.eatT * 9);
    ctx.globalAlpha = Math.max(0, 1 - b.eatT * 0.4);
  }
  ctx.drawImage(
    img,
    dim.box.x,
    dim.box.y,
    dim.box.w,
    dim.box.h,
    -dim.w / 2,
    -dim.h / 2,
    dim.w,
    dim.h,
  );
  if (b.flash > 0) {
    ctx.globalAlpha = Math.min(0.8, b.flash * 4);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(
      img,
      dim.box.x,
      dim.box.y,
      dim.box.w,
      dim.box.h,
      -dim.w / 2,
      -dim.h / 2,
      dim.w,
      dim.h,
    );
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
