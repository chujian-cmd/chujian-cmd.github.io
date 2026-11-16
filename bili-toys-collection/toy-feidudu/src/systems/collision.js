'use strict';

/* 玩家与敌骑手碰撞检测 */

/* global player, enemies, game, DMG_SIDE, DMG_FRONT, DMG_REAR, WEAPONS, slashFX, damagePlayer, damageEnemy, spawnBoom, consumeDagger, vehicleDef, contentSize, DASH_DEALT_MUL, EAT_DMG_MUL, daggerDmg, SFX */

function collide() {
  /* 用可见内容尺寸(剔除透明留白)作为碰撞盒 */
  const pcs = contentSize(player.vehicle);
  const pw = pcs.w * 0.9;
  const ph = pcs.h * 0.75;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const rx = (pw + e.cw * 0.9) / 2;
    const ry = (ph + e.ch * 0.75) / 2;
    if (Math.abs(dx) >= rx || Math.abs(dy) >= ry) {
      /* 完全脱离碰撞范围 → 解除穿行状态 */
      e.pass = false;
      continue;
    }
    /* 已经撞过一次、正在穿行 → 不再结算(防止慢速敌人被推开力卡在玩家身边反复扣血) */
    if (e.pass) continue;

    const overlapX = rx - Math.abs(dx);
    const overlapY = ry - Math.abs(dy);
    /* 垂直重叠更多 = 并排 → 侧面相撞; 否则前后相撞 */
    const isSide = overlapY > overlapX;
    /* 世界前方 = 屏幕上方(y 更小) */
    const playerFront = player.y < e.y;
    let dmgP, dmgE;
    if (isSide) {
      dmgP = DMG_SIDE;
      dmgE = DMG_SIDE;
    } else if (playerFront) {
      dmgP = DMG_FRONT;
      dmgE = DMG_REAR;
    } else {
      dmgP = DMG_REAR;
      dmgE = DMG_FRONT;
    }

    /* 沿重叠较小的轴推开双方: 位置分离 + 玩家撞击弹开冲量 */
    if (overlapX < overlapY) {
      const push = overlapX / 2 + 8;
      const dir = dx >= 0 ? 1 : -1;
      player.x -= dir * push;
      e.x += dir * push;
      player.kbx = -dir * 260; // 玩家被弹开(反方向滑出一小段)
      e.kbx = dir * 300; // 敌方横向被撞开
    } else {
      const push = overlapY / 2 + 8;
      const dir = dy >= 0 ? 1 : -1;
      player.y -= dir * push;
      e.y += dir * push;
      player.kby = -dir * 380; // 前后相撞弹开力度更大
      e.kby = dir * 340; // 被玩家撞上的敌方飞得更远
    }

    /* 匕首: 撞击时附加伤害并消耗一把 */
    let extra = 0;
    if (player.weapons.dagger) {
      extra = daggerDmg(); // 西瓜刀为普通匕首的 2 倍
      const aim = Math.atan2(e.x - player.x, -(e.y - player.y));
      slashFX.push({ x: player.x, y: player.y, aim, life: 0.18, maxLife: 0.18 });
      consumeDagger();
    }
    /* 载具撞击敌人伤害倍率(如步行减半); 冲刺/「焖子」期间提升 */
    let dmgMul = vehicleDef().damageMul;
    if (player.buff.dash > 0) dmgMul *= DASH_DEALT_MUL;
    if (player.buff.eat > 0) dmgMul *= EAT_DMG_MUL;
    if (dmgMul !== 1) dmgE = Math.round(dmgE * dmgMul);
    /* 敌方匕首: 撞击时对玩家附加伤害(与玩家一致) */
    const extraE = e.weapons.includes('dagger') ? WEAPONS.dagger.extraDmg : 0;
    damagePlayer(dmgP + extraE);
    damageEnemy(e, dmgE + extra, true); // true: 撞击伤害(触发「焖子」吃敌人效果)
    if (player.buff.brave > 0) SFX.voice('weak'); // 我超勇的: 撞敌喊「弱欸」
    spawnBoom((player.x + e.x) / 2, (player.y + e.y) / 2);
    game.shake = 0.35;
    e.pass = true; // 本次接触只结算一次, 之后穿行滑过
  }
}

/* 敌方骑手之间互相碰撞: 与玩家碰撞一致 —— 结算伤害 + 撞击特效 + 双方弹开
 * 数量上限约 15, 两两检测开销可忽略 */
function collideEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (a.dead || a.dying || a.eaten) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (b.dead || b.dying || b.eaten) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rx = (a.cw + b.cw) * 0.42; // 可见内容半径之和(略微内收)
      const ry = (a.ch + b.ch) * 0.4;
      if (Math.abs(dx) >= rx || Math.abs(dy) >= ry) continue;
      const ox = rx - Math.abs(dx);
      const oy = ry - Math.abs(dy);
      const dirX = dx >= 0 ? 1 : -1;
      const dirY = dy >= 0 ? 1 : -1;
      /* 位置分离(各推一半), 避免互相穿模 */
      if (ox < oy) {
        a.x -= (dirX * ox) / 2;
        b.x += (dirX * ox) / 2;
      } else {
        a.y -= (dirY * oy) / 2;
        b.y += (dirY * oy) / 2;
      }
      /* 伤害: 侧面互伤; 前后追尾时前方承受更多(与玩家碰撞一致) */
      const isSide = oy > ox;
      const aFront = a.y < b.y; // y 更小 = 更靠前
      let dmgA;
      let dmgB;
      if (isSide) {
        dmgA = DMG_SIDE;
        dmgB = DMG_SIDE;
      } else if (aFront) {
        dmgA = DMG_FRONT;
        dmgB = DMG_REAR;
      } else {
        dmgA = DMG_REAR;
        dmgB = DMG_FRONT;
      }
      const hitA = damageEnemy(a, dmgA, false); // 各自受击冷却内只结算一次
      const hitB = damageEnemy(b, dmgB, false);
      if (hitA || hitB) {
        /* 弹开 + 撞击特效 */
        a.kbx -= dirX * 200;
        b.kbx += dirX * 200;
        a.kby -= dirY * 240;
        b.kby += dirY * 240;
        spawnBoom((a.x + b.x) / 2, (a.y + b.y) / 2);
        game.shake = Math.max(game.shake, 0.18);
      }
    }
  }
}
