'use strict';

/* 敌方骑手: 生成(前方被超越/后方超车两种)、更新、受击结算与绘制 */

/* global game, ENEMY_MAX, assets, H, ENEMY_DIE_TIME, clamp, ROAD, zone, zoneScreenY, ENEMY_HIT_CD, spawnBoom, dropFood, IMG, ctx, drawBar, player, addFloatText, difficulty, WEAPONS, damagePlayer, W, PX_PER_M, spawnSmokeAt, BASE_SPEED, spriteContent, contentSize, EAT_HEAL, ENEMY_SCALE, ORBIT, squashScale, SFX, pace, INITIAL_ENEMIES, GROUND_SCROLL_MUL, ENEMY_AHEAD_RATIO, vehicleDef, HUE_VARIANT_DEG, hueSprite, EAT_PULSE_TIME */

const enemies = [];
const enemyBullets = []; // 敌方子弹 { x, y, vx, vy, dmg, life }
let enemyTimer = 1.2;

/* 生成敌方骑手: 'ahead' 从前方出现被玩家超越, 'behind' 从后方超车 */
function spawnEnemy() {
  /* 从上方(前方)出现的比例, 载具可覆盖(如火车头更多) */
  const aheadRatio = vehicleDef().aheadRatio || ENEMY_AHEAD_RATIO;
  const type = Math.random() < aheadRatio ? 'ahead' : 'behind';
  const worldSpeed =
    type === 'ahead'
      ? BASE_SPEED * (0.35 + Math.random() * 0.15)
      : BASE_SPEED * (1.25 + Math.random() * 0.25);
  /* 随机装备武器: 前 200 米不出现; 之后难度越高概率越高(10%→60%), 敌人只能携带 1 个装备 */
  const d = difficulty();
  let weapons = [];
  if (game.totalDist >= 200 * PX_PER_M && Math.random() < Math.min(0.9, 0.1 + d * 0.5)) {
    const types = ['dagger', 'pistol', 'rifle', 'shield'];
    weapons.push(types[Math.floor(Math.random() * types.length)]);
  }
  /* 按敌方贴图比例计算尺寸(高度定 66), 以可见内容宽度限制横向范围 */
  const eih = IMG.enemy.naturalHeight || 1;
  const eiw = IMG.enemy.naturalWidth || 1;
  const eH = 66 * ENEMY_SCALE;
  const eW = (eH * eiw) / eih;
  const ecs = spriteContent('enemy', eW, eH);
  const half = ecs.w / 2 + 4;
  let x = ROAD.left + half + Math.random() * (ROAD.width - half * 2);
  /* 避免直接刷在玩家正前/正后方 */
  for (let i = 0; i < 5 && Math.abs(x - player.x) < 90; i++) {
    x = ROAD.left + half + Math.random() * (ROAD.width - half * 2);
  }
  enemies.push({
    x,
    y: type === 'ahead' ? -90 : H + 90, // 屏幕外入场
    hue: Math.random() < 0.5, // 一半用色相偏移版本(视觉区分)
    worldSpeed, // 世界前进速度 px/s
    width: eW,
    height: eH,
    cw: ecs.w, // 可见内容宽(用于碰撞/边界/阴影)
    ch: ecs.h,
    footY: ecs.footY,
    hp: 30,
    maxHp: 30,
    weapons, // 随机装备的武器(空数组 = 无装备)
    shieldLeft: weapons.filter((w) => w === 'shield').length, // 敌方盾牌格挡次数
    gunCd: Math.random() * 1, // 持枪敌人的开火冷却
    hitCd: 0,
    flash: 0,
    kbx: 0, // 撞击弹开冲量(横向)
    kby: 0, // 撞击弹开冲量(纵向)
    spin: 0, // 死亡翻滚角速度(被警车撞飞时设定)
    wobblePhase: Math.random() * Math.PI * 2,
    smokeTimer: Math.random() * 0.3,
    dead: false,
    pass: false,
    dying: false,
    dieT: 0,
  });
}

/* 开局生成一批敌人(散布在屏幕内, 营造热闹开局) */
function spawnInitialEnemies(n) {
  for (let i = 0; i < n; i++) {
    spawnEnemy();
    const e = enemies[enemies.length - 1];
    e.y = 150 + i * 130;
    if (e.y > H - 150) e.y = 150 + ((i * 130) % (H - 300));
  }
}

function updateEnemies(dt) {
  /* 定时生成; 同屏敌人数上限随难度提升: 3 → 15(上限), 生成间隔随难度缩短(下限 0.2 倍) */
  enemyTimer -= dt;
  const def = vehicleDef();
  const cap = ENEMY_MAX + Math.min(12, Math.floor(difficulty() * 7)) + (def.enemyCapBonus || 0);
  if (!game.over && enemyTimer <= 0 && enemies.length < cap && assets.enemy) {
    spawnEnemy();
    /* 节奏提速 + 载具刷新率倍率(如火车头) */
    enemyTimer =
      ((1.8 + Math.random() * 2.2) * Math.max(0.2, 1 - difficulty() * 0.6)) /
      pace() /
      (def.enemyRate || 1);
  }
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    /* 被吃掉的敌人: 旋转缩小飞向玩家, 抵达后回血 */
    if (e.eaten) {
      e.eatT += dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * 460 * dt;
      e.y += (dy / d) * 460 * dt;
      if (d < 36 || e.eatT > 1.6) {
        player.hp = Math.min(player.maxHp, player.hp + EAT_HEAL);
        player.healFlash = 0.4;
        player.eatPulse = EAT_PULSE_TIME; // 咬到东西: 果冻缩放反馈
        addFloatText(player.x, player.y - player.height / 2, '+' + EAT_HEAL, '#4ade80');
        SFX.voice('eat', 0.3); // 吃掉敌人: 0.3 倍音量「焖子」
        enemies.splice(i, 1);
      }
      continue;
    }
    /* 屏幕速度 = 场景速度 - 敌方世界速度(含视觉加速); 慢者向后滑, 快者向前超 */
    e.y += ((game.speed - e.worldSpeed) * GROUND_SCROLL_MUL + e.kby) * dt;
    if (!e.dying) {
      /* 轻微左右游走, 保持路内 */
      e.x += (Math.sin(game.time * 1.4 + e.wobblePhase) * 42 + e.kbx) * dt;
      /* 施工路段: 敌方骑手避开占用车道(装备了武器的敌人无视施工路段) */
      if (zone && e.weapons.length === 0) {
        const zy0 = zoneScreenY(zone.worldStart);
        const zy1 = zoneScreenY(zone.worldEnd);
        const mid = ROAD.left + ROAD.width / 2;
        if (e.y > zy1 - 10 && e.y < zy0 + 10) {
          if (zone.side === 0 && e.x < mid) {
            e.x += 150 * dt; // 渐渐靠向开放半区
          } else if (zone.side === 1 && e.x > mid) {
            e.x -= 150 * dt;
          }
        }
      }
      const halfW = e.cw / 2 + 4;
      e.x = clamp(e.x, ROAD.left + halfW, ROAD.left + ROAD.width - halfW);

      /* 敌方车尾烟雾 */
      e.smokeTimer -= dt;
      if (e.smokeTimer <= 0) {
        e.smokeTimer = 0.18 + Math.random() * 0.15;
        spawnSmokeAt(
          e.x + (Math.random() - 0.5) * 14,
          e.y + e.footY,
          (Math.random() - 0.5) * 40,
          game.speed * 0.3 + 20,
        );
      }

      /* 持枪敌人自动向玩家开火 */
      e.gunCd -= dt;
      const hasGun = e.weapons.includes('pistol') || e.weapons.includes('rifle');
      if (hasGun && e.gunCd <= 0) {
        const ex = player.x - e.x;
        const ey = player.y - e.y;
        const ed = Math.hypot(ex, ey);
        if (ed < 380 && ed > 40) {
          const rifle = e.weapons.includes('rifle');
          /* 瞄准误差(散布 ±0.22rad)降低命中率, 弹速 300 让玩家有反应时间 */
          const aimErr = (Math.random() - 0.5) * 0.44;
          const ang = Math.atan2(ex, ey) + aimErr;
          enemyBullets.push({
            x: e.x + (ex / ed) * 20,
            y: e.y + (ey / ed) * 20,
            vx: Math.sin(ang) * 300,
            vy: Math.cos(ang) * 300,
            dmg: rifle ? 10 : 8,
            life: 2.4,
          });
          e.gunCd = rifle ? 0.9 : 1.2;
          SFX.play('shoot');
        }
      }

      /* 敌方匕首: 环绕碰到玩家 → 造成伤害并消耗(与玩家一致) */
      if (e.weapons.includes('dagger')) {
        const phi = game.time * ORBIT.dagger.spin;
        const dx = e.x + Math.sin(phi) * ORBIT.dagger.r;
        const dy = e.y - Math.cos(phi) * ORBIT.dagger.r;
        const pcs = contentSize(player.vehicle);
        const r = ORBIT.dagger.hitR + pcs.w * 0.25;
        const ddx = player.x - dx;
        const ddy = player.y - dy;
        if (ddx * ddx + ddy * ddy < r * r) {
          damagePlayer(WEAPONS.dagger.extraDmg);
          spawnBoom(dx, dy);
          e.weapons.splice(e.weapons.indexOf('dagger'), 1);
        }
      }
    }
    /* 死亡动画期间(被撞飞)弹开冲量衰减更慢, 让敌方飞得更远 */
    const kbDecay = e.dying ? 2 : 4;
    e.kbx *= Math.max(0, 1 - dt * kbDecay);
    e.kby *= Math.max(0, 1 - dt * kbDecay);
    e.hitCd = Math.max(0, e.hitCd - dt);
    e.flash = Math.max(0, e.flash - dt);
    if (e.dying) {
      /* 倒下/被撞飞动画: 期间保留在场上, 弹开冲量继续作用 */
      e.x += e.kbx * dt;
      e.dieT += dt;
      if (e.dieT >= ENEMY_DIE_TIME) enemies.splice(i, 1);
      continue;
    }
    if (e.dead || e.y > H + 130 || e.y < -130) enemies.splice(i, 1);
  }
}

function damageEnemy(e, d, byRam) {
  if (e.hitCd > 0) return false;
  /* 敌方盾牌: 格挡若干次伤害 */
  if (e.shieldLeft > 0) {
    e.shieldLeft--;
    e.hitCd = ENEMY_HIT_CD;
    e.flash = 0.3;
    addFloatText(e.x, e.y - e.height / 2, '格挡!', '#4da3ff');
    return true;
  }
  e.hp = Math.max(0, e.hp - d);
  e.hitCd = ENEMY_HIT_CD;
  e.flash = 0.3;
  if (e.hp <= 0) {
    if (byRam && player.buff.eat > 0) {
      /* 「焖子」效果: 被玩家吃掉(旋转缩小飞向玩家) */
      e.dead = true;
      e.eaten = true;
      e.eatT = 0;
      spawnBoom(e.x, e.y);
    } else {
      e.dead = true;
      e.dying = true; // 统一撞击死亡动画
      e.dieT = 0;
      launchEnemy(e, player.x); // 向前上方翻滚飞出
      spawnBoom(e.x, e.y);
      dropFood(e.x, e.y); // 掉落若干外卖
    }
  }
  return true;
}

/* 撞飞效果: 死亡后向前上方翻滚飞出(被警车撞飞 / 被玩家撞死共用) */
function launchEnemy(e, fromX) {
  e.worldSpeed = 0; // 撞飞后不再按自身速度行驶, 轨迹完全由弹开冲量决定
  e.spin = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 5);
  e.kbx = (e.x >= fromX ? 1 : -1) * (260 + Math.random() * 160);
  e.kby = -(420 + Math.random() * 220); // 向前上方飞出
}

/* 一半敌骑手使用色相偏移版本(用于视觉区分) */
function enemySpriteFor(hue) {
  return hue ? hueSprite(IMG.enemy, HUE_VARIANT_DEG) : IMG.enemy;
}

/* ---- 敌方骑手绘制 ---- */
function drawEnemies() {
  if (!assets.enemy) return;
  for (const e of enemies) {
    const sprite = enemySpriteFor(e.hue);
    const wobble = Math.sin(game.time * 1.4 + e.wobblePhase);
    ctx.save();
    if (e.eaten) {
      /* 被吃掉: 旋转缩小飞入玩家 */
      const k = Math.max(0.12, 1 - e.eatT * 1.4);
      ctx.translate(e.x, e.y);
      ctx.rotate(e.eatT * 12);
      ctx.scale(k, k);
      ctx.globalAlpha = Math.max(0, 1 - e.eatT * 0.5);
      ctx.drawImage(sprite, -e.width / 2, -e.height / 2, e.width, e.height);
    } else if (e.dying) {
      /* 统一撞击死亡: 翻滚旋转 + 放大 + 淡出, 位移由弹开冲量驱动 */
      const t = Math.min(1, e.dieT / ENEMY_DIE_TIME);
      const k = t * t; // 加速曲线, 开头变化更明显
      ctx.translate(e.x, e.y);
      if (e.spin) ctx.rotate(e.spin * e.dieT); // 被警车撞飞时翻滚旋转
      ctx.scale(1 + 0.6 * k, 1 + 0.6 * k); // 放大到 1.6 倍
      ctx.globalAlpha = 1 - k; // 淡出
      ctx.drawImage(sprite, -e.width / 2, -e.height / 2, e.width, e.height);
    } else {
      ctx.translate(e.x, e.y + Math.sin(game.time * 20 + e.wobblePhase) * 1.5);
      ctx.rotate(wobble * 0.08);
      /* 阴影(按可见内容落在脚下) */
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(0, e.footY - e.ch * 0.04, e.cw * 0.45, e.cw * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(sprite, -e.width / 2, -e.height / 2, e.width, e.height);
      /* 受击白闪: 叠加提亮, 不再画红框 */
      if (e.flash > 0) {
        ctx.globalAlpha = Math.min(0.8, e.flash * 2);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(sprite, -e.width / 2, -e.height / 2, e.width, e.height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    /* 头顶血条(按可见内容顶部, 倒下时不显示) */
    if (!e.dying) drawBar(e.x, e.y + (e.footY - e.ch) - 8, e.hp / e.maxHp, 34, 4);
    /* 敌方装备: 匕首/盾牌与玩家一致的径向环绕(压缩); 枪械自动瞄准玩家 */
    if (!e.dying && e.weapons.length > 0 && assets.item) {
      const fw = IMG.item.naturalWidth / 2;
      const fh = IMG.item.naturalHeight / 2;
      const aim = Math.atan2(player.x - e.x, -(player.y - e.y)); // 指向玩家
      for (const w of e.weapons) {
        const def = WEAPONS[w];
        const f = def.frame;
        ctx.save();
        if (w === 'dagger' || w === 'shield') {
          const o = w === 'dagger' ? ORBIT.dagger : ORBIT.shield;
          const phi = game.time * o.spin;
          ctx.translate(e.x + Math.sin(phi) * o.r, e.y - Math.cos(phi) * o.r);
          if (w === 'dagger') ctx.rotate(phi);
          else {
            ctx.scale(squashScale(Math.cos(phi)), 1);
            ctx.rotate(def.baseRot);
          }
        } else {
          ctx.translate(e.x + Math.sin(aim) * 30, e.y - Math.cos(aim) * 30);
          ctx.rotate(aim + def.baseRot);
        }
        ctx.drawImage(IMG.item, f[0] * fw + 2, f[1] * fh + 2, fw - 4, fh - 4, -18, -18, 36, 36);
        ctx.restore();
      }
    }
  }
}

/* ---- 敌方子弹: 飞行与命中玩家 ---- */
function updateEnemyBullets(dt) {
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const dx = b.x - player.x;
    const dy = b.y - player.y;
    const r = contentSize(player.vehicle).w * 0.55;
    if (dx * dx + dy * dy < r * r) {
      damagePlayer(b.dmg);
      enemyBullets.splice(i, 1);
      continue;
    }
    if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -40 || b.y > H + 40) {
      enemyBullets.splice(i, 1);
    }
  }
}
function drawEnemyBullets() {
  for (const b of enemyBullets) {
    ctx.fillStyle = '#ff6b5e';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
