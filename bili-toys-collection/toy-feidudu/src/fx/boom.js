'use strict';

/* 碰撞特效(图集 4×4, 用最后一帧 4-4) */

/* global assets, IMG, ctx, SFX */

const boomParts = [];
function spawnBoom(x, y, frame, silent) {
  if (!silent) SFX.play('boom'); // 撞击音(存在界面演示时静音)
  if (!assets.boom) return;
  boomParts.push({
    x,
    y,
    life: 0,
    maxLife: 0.45,
    rot: Math.random() * Math.PI * 2,
    frame: frame || [3, 3],
  });
}
function updateBoom(dt) {
  for (let i = boomParts.length - 1; i >= 0; i--) {
    boomParts[i].life += dt;
    if (boomParts[i].life >= boomParts[i].maxLife) boomParts.splice(i, 1);
  }
}

/* ---- 碰撞特效绘制(图集最后一帧 4-4) ---- */
function drawBoom() {
  if (!assets.boom) return;
  const fw = IMG.boom.naturalWidth / 4; // 4×4 图集, 每格 1/4
  const fh = IMG.boom.naturalHeight / 4;
  for (const p of boomParts) {
    const t = p.life / p.maxLife;
    const size = 45 + t * 60; // 快速膨胀
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.9;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    const fc = p.frame[0];
    const fr = p.frame[1];
    ctx.drawImage(
      IMG.boom,
      fc * fw + 4,
      fr * fh + 4,
      fw - 8,
      fh - 8,
      -size / 2,
      -size / 2,
      size,
      size,
    );
    ctx.restore();
  }
}
