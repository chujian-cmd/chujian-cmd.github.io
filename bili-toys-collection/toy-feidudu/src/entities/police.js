'use strict';

/* 犯罪等级 / 警车追击 / 拦车钉(路钉) */

/* global player, clamp, ROAD, game, boss, bossHit, addFloatText, H, damagePlayer, spawnBoom, enemies, dropFood, WEAPONS, zoneScreenY, ctx, fillRR, IMG, assets, crimeCool:writable, launchEnemy, CRIME_MAX_LVL, contentSize, CRIME_OVER_RATE, BOUNDS, detectSpriteBox */

/* 等级: 1 小罪无碍 / 2 略有影响 / 3 大型事故 / 4 重大影响(犯罪槽攒满逐级提升) */
function crimeLevel() {
  return player.crimeLvl;
}
/* 测试: +/- 直接调整犯罪等级(1~4 档) */
function adjustCrime(dir) {
  player.crimeLvl = clamp(player.crimeLvl + dir, 1, CRIME_MAX_LVL);
  player.crime = 0; // 换等级后槽清空
  crimeCool = 2; // 暂时阻止衰减, 便于观察当前等级表现
  addFloatText(player.x, player.y - player.height / 2, '犯罪等级 ' + player.crimeLvl, '#ff9d5c');
}
/* 测试: 直接获得指定装备 */
function grantWeapon(type, strong) {
  const def = WEAPONS[type];
  /* 枪械互斥: 手枪/步枪只能同时存在一种; 匕首/盾牌可与其共存 */
  if (type === 'pistol' || type === 'rifle') {
    delete player.weapons.pistol;
    delete player.weapons.rifle;
  }
  /* strong: 刘华强西瓜刀(伤害与贴图均为普通的 2 倍) */
  /* 不用 ??(旧 WebView 不支持会整文件语法报错); 逐个取第一个有值的 */
  let ammo = def.uses;
  if (ammo === undefined) ammo = def.ammo;
  if (ammo === undefined) ammo = def.charges;
  player.weapons[type] = { ammo: ammo, cd: 0, strong: !!strong };
  addFloatText(
    player.x,
    player.y - player.height / 2,
    '获得 ' + (strong ? '西瓜刀' : def.label),
    '#ffd23f',
  );
}

/* ---- 警车(矢量绘制, 占满一边车道) ---- */
const police = []; // { x, y, lane, cycleT, surging, weavePhase }
let policeTimer = 0;
let pinchCd = 0; // 被两辆警车夹住后"向前弹出"的冷却
const POLICE_DMG = Math.round(100 / 3); // 警车撞击扣 1/3 血量

/* 警车/路钉贴图的内容包围盒(贴图带透明余量, 精确裁切) */
let POLICE_BOX = null;
let SPIKE_BOX = null;

/* 满级过载: 违规越久, 警车/道钉频率越高(无上限) */
function crimeEscalation() {
  return 1 + player.crimeOver * CRIME_OVER_RATE;
}
function spawnPolice() {
  /* 第二辆走另一条车道 */
  const lane = police.length === 0 ? (Math.random() < 0.5 ? 0 : 1) : police[0].lane === 0 ? 1 : 0;
  police.push({
    x: lane === 0 ? ROAD.left + ROAD.width / 4 : ROAD.left + (ROAD.width * 3) / 4,
    y: H + 90, // 从屏幕下方入场
    lane,
    state: 'track', // track(下方跟随) / surge(前冲) / retreat(退回)
    /* 第二辆错开相位, 不与第一辆同时冲撞; 过载时冲撞更频繁 */
    cycleT: Math.max(
      0.15,
      ((police.length === 1 ? 2.5 : 0) + 1 + Math.random() * 1.5) / crimeEscalation(),
    ),
    weavePhase: Math.random() * Math.PI * 2,
  });
}
function updatePolice(dt) {
  const lvl = crimeLevel();
  const want = lvl >= 3 ? 2 : lvl >= 2 ? 1 : 0;
  if (want > 0 && !game.over) {
    /* 补齐数量: 等级2一辆 / 等级3+两辆(两边各一), 持续跟踪 */
    policeTimer -= dt;
    if (policeTimer <= 0 && police.length < want) {
      spawnPolice();
      policeTimer = Math.max(0.15, 1.2 / crimeEscalation());
    }
  } else {
    police.length = 0;
    policeTimer = 0;
  }
  while (police.length > want) police.pop(); // 等级降低时撤走多余的

  if (pinchCd > 0) pinchCd = Math.max(0, pinchCd - dt);
  /* 本帧各警车把玩家往外推的量(分 左/右/上/下 累计), 用于识别"被夹住" */
  let pushL = 0;
  let pushR = 0;
  let pushU = 0;
  let pushD = 0;
  for (const p of police) {
    /* 跟踪位置: 屏幕最下方 */
    const trackY = H - 90;
    const laneX0 = p.lane === 0 ? ROAD.left : ROAD.left + ROAD.width / 2;
    const laneX1 = laneX0 + ROAD.width / 2;
    /* 主动撞 Boss: 只有同车道的警车能撞到(前提是能撞到); 否则照常追玩家 */
    const bossTarget = boss && !game.over && p.lane === boss.lane;
    /* 冲撞目标: 追玩家→冲到玩家附近; 撞 Boss→冲到 Boss 车头; 横向也对准目标 */
    const aimY = bossTarget ? bossHit().y - 60 : player.y + 50;
    const aimX = bossTarget
      ? clamp(boss.x, laneX0 + 34, laneX1 - 34)
      : clamp(player.x, laneX0 + 34, laneX1 - 34);
    if (p.state === 'track') {
      p.cycleT -= dt;
      p.y += (trackY - p.y) * Math.min(1, dt * 4); // 平滑保持在下方
      if (p.cycleT <= 0) {
        p.state = 'surge';
        /* 两辆警车的冲撞错开: 另一辆至少再等 1.6 秒 */
        for (const q of police) {
          if (q !== p && q.state === 'track') q.cycleT = Math.max(q.cycleT, 1.6);
        }
      }
    } else if (p.state === 'surge') {
      p.y -= 520 * dt; // 间歇性往前撞
      if (p.y <= aimY) p.state = 'retreat'; // 冲到目标附近就退回(撞 Boss 由 updateBoss 结算伤害)
    } else {
      /* retreat: 回到下方跟踪位 */
      p.y += 300 * dt;
      if (p.y >= trackY) {
        p.state = 'track';
        p.cycleT = Math.max(0.15, (1.5 + Math.random() * 2.5) / crimeEscalation());
      }
    }
    /* 横向对准目标(较弱, 便于侧向躲开; 保持在本车道内) */
    p.x += (aimX - p.x) * Math.min(1, dt * 0.7);

    /* 与玩家重叠: 每帧推出(避免卡住), 受击无敌外再结算伤害/弹开 */
    {
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      const pcs = contentSize(player.vehicle);
      const rx = (pcs.w * 0.6 + 30) * 0.9;
      const ry = (pcs.h * 0.6 + 50) * 0.9;
      if (Math.abs(dx) < rx && Math.abs(dy) < ry) {
        /* 沿重叠较小的轴把玩家推出警车 */
        const overlapX = rx - Math.abs(dx);
        const overlapY = ry - Math.abs(dy);
        /* 只累计推出量, 统一在循环后结算(便于识别"两边同时挤") */
        if (overlapX < overlapY) {
          if (dx >= 0) pushL += overlapX;
          else pushR += overlapX;
        } else {
          if (dy >= 0) pushU += overlapY;
          else pushD += overlapY;
        }
        if (player.hitCd <= 0) {
          damagePlayer(POLICE_DMG);
          const d2 = Math.hypot(dx, dy) || 1;
          player.kbx = (dx / d2) * 320;
          player.kby = (dy / d2) * 320;
          game.shake = 0.5;
          spawnBoom((p.x + player.x) / 2, (p.y + player.y) / 2);
          if (p.state === 'surge') p.state = 'retreat'; // 撞完退回
        }
      }
    }
    /* 撞到敌方骑手: 直接撞飞秒杀(不受敌方受击无敌影响), 照常掉落外卖 */
    for (const e of enemies) {
      if (e.dead || e.dying) continue;
      if (Math.abs(e.x - p.x) < 50 && Math.abs(e.y - p.y) < 62) {
        e.hp = 0;
        e.dead = true;
        e.dying = true;
        e.dieT = 0;
        launchEnemy(e, p.x);
        spawnBoom(e.x, e.y);
        dropFood(e.x, e.y);
      }
    }
  }
  /* 被两辆警车同时往相反方向挤住 → 不再原地互推, 改为"向前弹出去" */
  const pinched = (pushL > 0 && pushR > 0) || (pushU > 0 && pushD > 0);
  if (pinched && pinchCd <= 0) {
    pinchCd = 0.7;
    player.y = Math.max(BOUNDS.y0, player.y - 80); // 先向前(画面上方)窜出一段
    player.kbx *= 0.2;
    player.kby = -640; // 向前弹飞
    player.hitCd = Math.max(player.hitCd, 0.6); // 弹开瞬间短暂无敌, 避免被连续夹击
    game.shake = 0.6;
    spawnBoom(player.x, player.y);
    addFloatText(player.x, player.y - 50, '被夹住！向前弹开', '#ffd23f');
  } else if (!pinched) {
    /* 常规: 沿重叠较小的轴把玩家推出警车, 避免被卡住 */
    player.x += pushR - pushL;
    player.y += pushD - pushU;
    player.x = clamp(player.x, BOUNDS.x0, BOUNDS.x1);
    player.y = clamp(player.y, BOUNDS.y0, BOUNDS.y1);
  }
}

/* ---- 拦车钉(等级4: 前方随机一边车道生成, 碾过减速) ---- */
let spikeStrip = null; // { world, lane, hit }
let spikeTimer = 0;
function updateSpike(dt) {
  const lvl = crimeLevel();
  if (lvl >= 4 && !game.over) {
    if (!spikeStrip) {
      spikeTimer -= dt;
      if (spikeTimer <= 0) {
        spikeStrip = {
          world: game.scrollDist + 1500, // 前方
          lane: Math.random() < 0.5 ? 0 : 1,
          hit: false,
        };
      }
    } else {
      const sy = zoneScreenY(spikeStrip.world);
      const laneX0 = spikeStrip.lane === 0 ? ROAD.left : ROAD.left + ROAD.width / 2;
      const laneX1 = laneX0 + ROAD.width / 2;
      if (
        !spikeStrip.hit &&
        Math.abs(player.y - sy) < 30 &&
        player.x > laneX0 &&
        player.x < laneX1
      ) {
        spikeStrip.hit = true;
        player.slowT = 4; // 整体速度下降 4 秒
        game.shake = 0.3;
      }
      if (sy > H + 100) {
        spikeStrip = null;
        spikeTimer = Math.max(0.3, (4 + Math.random() * 3) / crimeEscalation());
      }
    }
  } else {
    spikeStrip = null;
    spikeTimer = 0;
  }
}

/* ---- 警车绘制 ---- */
function drawPolice() {
  for (const p of police) {
    ctx.save();
    ctx.translate(p.x, p.y + Math.sin(game.time * 18 + p.weavePhase) * 1.5);
    /* 阴影 */
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 30, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    if (assets.police) {
      if (!POLICE_BOX) POLICE_BOX = detectSpriteBox(IMG.police); // 懒重试
      const box = POLICE_BOX || {
        x: 0,
        y: 0,
        w: IMG.police.naturalWidth,
        h: IMG.police.naturalHeight,
      };
      /* 警车贴图(按内容包围盒裁切) */
      const h = 115;
      const w = (h * box.w) / box.h;
      ctx.drawImage(IMG.police, box.x, box.y, box.w, box.h, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }
}

/* ---- 拦车钉绘制 ---- */
function drawSpike() {
  if (!spikeStrip) return;
  const sy = zoneScreenY(spikeStrip.world);
  if (sy < -40 || sy > H + 40) return;
  const x0 = spikeStrip.lane === 0 ? ROAD.left : ROAD.left + ROAD.width / 2;
  const w = ROAD.width / 2;
  ctx.save();
  if (assets.spike) {
    if (!SPIKE_BOX) SPIKE_BOX = detectSpriteBox(IMG.spike); // 懒重试
    const box = SPIKE_BOX || { x: 0, y: 0, w: IMG.spike.naturalWidth, h: IMG.spike.naturalHeight };
    /* 路钉贴图(按内容包围盒裁切, 保持宽高比) */
    const drawW = w - 4;
    const drawH = (drawW * box.h) / box.w;
    ctx.drawImage(IMG.spike, box.x, box.y, box.w, box.h, x0 + 2, sy - drawH / 2, drawW, drawH);
  }
  ctx.restore();
}
