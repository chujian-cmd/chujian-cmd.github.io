'use strict';

/* 开始界面演示: 敌方骑手 / 警车 / 大运 在马上互相碰撞, 营造热闹的开场
 * 纯表演 —— 用独立数组, 不参与游戏结算, 不影响玩家状态 */

/* global game, player, ctx, IMG, assets, ROAD, H, GROUND_SCROLL_MUL, clamp, spawnBoom, spawnSmokeAt, HUE_VARIANT_DEG, hueSprite */

const menuActors = [];
let menuT = 0;

function menuActorSize(img, h) {
  const ih = img.naturalHeight || 1;
  const iw = img.naturalWidth || 1;
  return { w: (iw * h) / ih, h };
}
function menuRandX(w) {
  const min = ROAD.left + w / 2 + 6;
  const max = ROAD.left + ROAD.width - w / 2 - 6;
  return min + Math.random() * Math.max(0, max - min);
}
/* 生成一个演示角色(从屏幕外入场) */
function spawnMenuActor(kind) {
  let img;
  let h;
  let y;
  let rate = 0;
  if (kind === 'enemy') {
    if (!assets.enemy) return;
    img = 'enemy';
    h = 86;
    rate = 0.75 + Math.random() * 1.1; // 相对速度(更快, 且更多是超车)
    y = Math.random() < 0.5 ? -120 - Math.random() * 180 : H + 120 + Math.random() * 180;
  } else if (kind === 'police') {
    if (!assets.police) return;
    img = 'police';
    h = 192; // 放大 2 倍
    y = H + 130;
  } else {
    if (!assets.truck) return;
    img = 'truck';
    h = 300; // 放大 1.5 倍
    y = -120; // 从上方滑入, 之后固定只露车头
  }
  const size = menuActorSize(IMG[img], h);
  menuActors.push({
    kind,
    img,
    hue: kind !== 'police' && Math.random() < 0.5, // 与游戏内一致: 敌骑手/大运一半色相偏移
    x: menuRandX(size.w),
    y,
    w: size.w,
    h: size.h,
    rate,
    vx: 0,
    vy: 0,
    rot: 0,
    spin: 0,
    ph: Math.random() * Math.PI * 2,
    cool: 0,
    smokeT: Math.random() * 0.2,
    launched: 0, // >0 表示被撞飞(旋转飞出直至消失)
  });
}

function updateMenuActors(dt) {
  /* 维持场上数量: 5 敌骑手 + 1 警车 + 1 大运 */
  menuT -= dt;
  if (menuT <= 0) {
    menuT = 0.7;
    let n = 0;
    let pol = 0;
    let trk = 0;
    for (const a of menuActors) {
      if (a.kind === 'enemy') n++;
      else if (a.kind === 'police') pol++;
      else trk++;
    }
    if (n < 5) spawnMenuActor('enemy');
    if (pol < 1) spawnMenuActor('police');
    if (trk < 1) spawnMenuActor('truck');
  }
  for (let i = menuActors.length - 1; i >= 0; i--) {
    const a = menuActors[i];
    /* 被撞飞: 翻滚飞出屏幕后消失(会自动补充新的) */
    if (a.launched > 0) {
      a.launched -= dt;
      a.y += a.vy * dt;
      a.x += a.vx * dt;
      a.rot += a.spin * dt;
      a.vy *= Math.max(0, 1 - dt * 1.2);
      if (a.launched <= 0 || a.y < -360 || a.y > H + 360) menuActors.splice(i, 1);
      continue;
    }
    if (a.kind === 'enemy') {
      /* 相对场景速度: rate<1 后滑, rate>1 超车 */
      a.y += (game.speed - game.speed * a.rate) * GROUND_SCROLL_MUL * dt + a.vy * dt;
      a.x += (Math.sin(game.time * 1.7 + a.ph) * 34 + a.vx) * dt;
      /* 主动避开大运与警车 */
      for (const o of menuActors) {
        if (o === a || o.kind === 'enemy' || o.launched > 0) continue;
        const dx = a.x - o.x;
        const dy = a.y - o.y;
        const d = Math.hypot(dx, dy);
        const range = (a.w + o.w) * 0.5 + 70;
        if (d < range) {
          const k = (1 - d / range) * 320;
          a.x += (dx >= 0 ? 1 : -1) * k * dt;
          a.y += (dy >= 0 ? 1 : -1) * k * 0.4 * dt;
        }
      }
    } else if (a.kind === 'police') {
      /* 只在下半部分活动: 横向追最靠下的敌骑手 */
      let t = null;
      for (const o of menuActors) {
        if (o.kind !== 'enemy' || o.launched > 0) continue;
        if (!t || o.y > t.y) t = o;
      }
      const ty = H * 0.74;
      a.y += clamp(ty - a.y, -200, 200) * dt + a.vy * dt;
      a.x +=
        (t ? clamp(t.x - a.x, -240, 240) : Math.sin(game.time * 2 + a.ph) * 60) * dt + a.vx * dt;
    } else {
      /* 大运: 固定在上方只露车头 + 平滑左右扫动(不设 x 夹取, 避免宽度超路面时抽搐) */
      a.y += (10 - a.y) * Math.min(1, dt * 3);
      a.x = ROAD.left + ROAD.width / 2 + Math.sin(game.time * 0.9 + a.ph) * (ROAD.width * 0.3);
    }
    /* 车尾扬尘(骑手 / 警车) */
    if (a.kind !== 'truck') {
      a.smokeT -= dt;
      if (a.smokeT <= 0) {
        a.smokeT = 0.16 + Math.random() * 0.12;
        spawnSmokeAt(
          a.x + (Math.random() - 0.5) * 14,
          a.y + a.h * 0.35,
          (Math.random() - 0.5) * 40,
          game.speed * 0.3 + 20,
        );
      }
    }
    /* 有意避开玩家: 靠近时向侧向/纵向让开 */
    const pdx = a.x - player.x;
    const pdy = a.y - player.y;
    const pd = Math.hypot(pdx, pdy);
    if (pd < 170) {
      const k = (1 - pd / 170) * 320;
      a.x += (pdx >= 0 ? 1 : -1) * k * dt;
      a.y += (pdy >= 0 ? 1 : -1) * k * 0.3 * dt;
    }
    a.vx *= Math.max(0, 1 - dt * 3);
    a.vy *= Math.max(0, 1 - dt * 3);
    a.rot += a.spin * dt;
    a.spin *= Math.max(0, 1 - dt * 1.8);
    a.cool = Math.max(0, a.cool - dt);
    /* 限制在路面内(大运由上面的公式直接控制 x, 不参与夹取) */
    if (a.kind !== 'truck') {
      const minX = ROAD.left + a.w / 2 + 4;
      const maxX = ROAD.left + ROAD.width - a.w / 2 - 4;
      a.x = clamp(a.x, minX, maxX);
    }
    if (a.kind === 'police') a.y = clamp(a.y, H * 0.5, H + 130); // 警车只在下半部分
    /* 出屏回收 */
    if (a.y < -340 || a.y > H + 340) menuActors.splice(i, 1);
  }
  /* 两两碰撞: 分离 + 火花 + 弹开(被警车/大运撞到的骑手翻滚飞出) */
  for (let i = 0; i < menuActors.length; i++) {
    const a = menuActors[i];
    for (let j = i + 1; j < menuActors.length; j++) {
      const b = menuActors[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rx = (a.w + b.w) * 0.34;
      const ry = (a.h + b.h) * 0.34;
      if (Math.abs(dx) >= rx || Math.abs(dy) >= ry) continue;
      const ox = rx - Math.abs(dx);
      const oy = ry - Math.abs(dy);
      const dirX = dx >= 0 ? 1 : -1;
      const dirY = dy >= 0 ? 1 : -1;
      if (ox < oy) {
        a.x -= (dirX * ox) / 2;
        b.x += (dirX * ox) / 2;
      } else {
        a.y -= (dirY * oy) / 2;
        b.y += (dirY * oy) / 2;
      }
      if (a.cool > 0 || b.cool > 0) continue;
      a.cool = 0.22;
      b.cool = 0.22;
      a.vx -= dirX * 150;
      b.vx += dirX * 150;
      a.vy -= dirY * 180;
      b.vy += dirY * 180;
      /* 被警车/大运撞到的敌骑手: 翻滚飞出 */
      if (a.kind === 'enemy' && b.kind !== 'enemy') {
        a.launched = 1.4;
        a.spin = (Math.random() < 0.5 ? -1 : 1) * 9;
        a.vy = -280 - Math.random() * 160;
        a.vx = (a.x >= b.x ? 1 : -1) * (120 + Math.random() * 120);
      }
      if (b.kind === 'enemy' && a.kind !== 'enemy') {
        b.launched = 1.4;
        b.spin = (Math.random() < 0.5 ? -1 : 1) * 9;
        b.vy = -280 - Math.random() * 160;
        b.vx = (b.x >= a.x ? 1 : -1) * (120 + Math.random() * 120);
      }
      spawnBoom((a.x + b.x) / 2, (a.y + b.y) / 2, undefined, true); // 静音火花
      game.shake = Math.max(game.shake, 0.12);
    }
  }
}

function drawMenuActors() {
  if (game.started) return;
  for (const a of menuActors) {
    const img = a.hue ? hueSprite(IMG[a.img], HUE_VARIANT_DEG) : IMG[a.img];
    /* 色相版是 canvas(没有 naturalWidth), 用 naturalWidth || width 判空 */
    if (!img || !(img.naturalWidth || img.width)) continue;
    ctx.save();
    ctx.translate(a.x, a.y);
    if (a.rot) ctx.rotate(a.rot);
    ctx.drawImage(img, -a.w / 2, -a.h / 2, a.w, a.h);
    ctx.restore();
  }
}
function clearMenuActors() {
  menuActors.length = 0;
}
