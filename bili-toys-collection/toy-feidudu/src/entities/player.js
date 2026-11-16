'use strict';

/* 玩家: 受击结算与绘制 */

/* global player, game, HIT_CD, addFloatText, gameOver, ctx, BASE_SPEED, IMG, assets, clamp, spawnBoom, shieldBlockPos, vehicleDef, contentSize, FOOD_STACK_PX, drawFoodItem, drawFoodGlow, BRAVE_DMG_MUL, DASH_TAKEN_MUL, EAT_TAKEN_MUL, EAT_PULSE_TIME, SFX */

function damagePlayer(d) {
  if (player.hitCd > 0 || game.over) return;
  /* 盾牌: 免疫撞击伤害(消耗次数) */
  if (player.weapons.shield) {
    const pos = shieldBlockPos();
    player.weapons.shield.ammo--;
    player.hitCd = HIT_CD;
    player.flash = 0.15;
    spawnBoom(pos.x, pos.y, [1, 2]);
    addFloatText(player.x, player.y - player.height / 2, '格挡!', '#4da3ff');
    if (player.weapons.shield.ammo <= 0) delete player.weapons.shield;
    return;
  }
  /* 载具受击倍率(如火车头受撞击伤害低) */
  const takenMul = vehicleDef().damageTakenMul || 1;
  if (takenMul !== 1) d = Math.max(1, Math.round(d * takenMul));
  /* 减伤: 「我超勇的」/ 牛冲刺 / 「焖子」期间受到伤害减少 */
  if (player.buff.brave > 0) d = Math.max(1, Math.round(d * BRAVE_DMG_MUL));
  if (player.buff.dash > 0) d = Math.max(1, Math.round(d * DASH_TAKEN_MUL));
  if (player.buff.eat > 0) d = Math.max(1, Math.round(d * EAT_TAKEN_MUL));
  player.hp = Math.max(0, player.hp - d);
  player.hitCd = HIT_CD;
  player.flash = 0.35;
  SFX.play('hurt');
  if (player.hp <= 0) gameOver();
}

/* 堆叠过高: 上层外卖惯性延迟, 转向时晃得像要掉 */
function updateFoodLag(dt) {
  const n = player.food.length;
  const lag = player.foodLag;
  while (lag.length < n) lag.push({ x: 0, y: 0, vx: 0, vy: 0 });
  if (lag.length > n) lag.length = n;
  const overload = Math.max(0, n - 3);
  const driveX = -(player.vx + player.kbx);
  const driveY = -(player.vy + player.kby);
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : i / (n - 1);
    /* 堆得越高晃得越凶(摆幅与过载量成正比) */
    const amp = overload <= 0 ? 0 : t * t * 0.5 * Math.min(1, overload * 0.3);
    const targetX = driveX * amp;
    const targetY = driveY * amp * 0.62;
    const o = lag[i];
    /* 越靠上越软: 刚度低、阻尼小 → 摆得更久更明显 */
    const stiff = 15 - t * 7;
    const damp = 5.2 - t * 2.6;
    o.vx += (targetX - o.x) * stiff * dt;
    o.vy += (targetY - o.y) * stiff * dt;
    o.vx *= Math.max(0, 1 - damp * dt);
    o.vy *= Math.max(0, 1 - damp * dt);
    o.x = clamp(o.x + o.vx * dt, -42, 42);
    o.y = clamp(o.y + o.vy * dt, -20, 20);
  }
}

/* ---- 玩家绘制: 骑手/步行贴图 ---- */
function drawPlayer() {
  const p = player;
  const def = vehicleDef();
  ctx.save();
  let bob = Math.sin(game.time * 22) * 1.8 * (game.speed / BASE_SPEED);
  /* 单图步行: 上下抖动模拟迈步 */
  if (def.anim === 'bob') {
    const stepInterval = def.stepInterval || 0.4;
    const phase = (p.animTimer / stepInterval) * Math.PI;
    bob += -Math.abs(Math.sin(phase)) * (def.bobAmp || 5);
  }
  ctx.translate(p.x, p.y + bob);
  ctx.rotate(p.tilt);
  /* 「焖子」咬到东西: 先瞬间放大, 再像果冻一样回弹(竖向拉长/横向收窄) */
  if (p.eatPulse > 0) {
    const k = 1 - p.eatPulse / EAT_PULSE_TIME; // 0 → 1
    const s = 1 + 0.38 * (1 - k) * Math.cos(k * Math.PI * 3);
    ctx.scale(Math.pow(s, -0.5), s);
  }

  /* 阴影(按可见内容落在脚下) */
  const cs = contentSize(p.vehicle);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, cs.footY - cs.h * 0.04, cs.w * 0.45, cs.w * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  /* 载具贴图(支持多帧迈步动画) */
  const img = IMG[def.img];
  if (img && img.naturalWidth) {
    const frameW = img.naturalWidth / def.frames;
    const frameX = (p.animFrame % def.frames) * frameW;
    const draw = (alpha, blend) => {
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = blend;
      ctx.drawImage(
        img,
        frameX,
        0,
        frameW,
        img.naturalHeight,
        -p.width / 2,
        -p.height / 2,
        p.width,
        p.height,
      );
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    };
    draw(1, 'source-over');
    /* 受击白闪: 叠加提亮 */
    if (player.flash > 0) draw(Math.min(0.8, player.flash * 2), 'lighter');
  }
  /* 背负的外卖 */
  if ((assets.food || assets.poison) && p.food.length > 0) {
    const bs = FOOD_STACK_PX;
    const foodOy = p.height * def.foodY;
    for (let i = 0; i < p.food.length; i++) {
      const item = p.food[i];
      const o = p.foodLag[i] || { x: 0, y: 0 };
      ctx.save();
      ctx.translate(o.x, foodOy - i * bs * def.foodGap + bs / 2 + o.y);
      ctx.rotate(o.x * 0.022); // 晃动更明显时也跟着倾斜
      if (item.poison || item.special >= 0) drawFoodGlow(item, bs); // 柔边高光
      drawFoodItem(item, bs);
      ctx.restore();
    }
  }
  ctx.restore();
}
