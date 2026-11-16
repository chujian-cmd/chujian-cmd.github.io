'use strict';

/* 车尾烟雾粒子(图集 4×4, 取 0-0 一帧) */

/* global game, player, assets, IMG, ctx, BASE_SPEED */

const SMOKE = {
  frames: [[0, 0]], // 图集中的 0-0
};
const smokeParts = [];
let smokeTimer = 0;

/* 连续车尾烟雾发射(骑手类载具): 速度越快间隔越短 */
function updateSmoke(dt) {
  smokeTimer += dt;
  const interval = 45 / game.speed;
  while (smokeTimer >= interval) {
    smokeTimer -= interval;
    spawnSmoke();
  }
}
/* 连续扬尘发射(牛等): 速度越快间隔越短 */
let dustTimer = 0;
function updateDust(dt) {
  dustTimer += dt;
  const interval = 55 / game.speed;
  while (dustTimer >= interval) {
    dustTimer -= interval;
    spawnWalkDust();
  }
}
/* 粒子运动与消亡(所有载具通用, 每帧调用) */
function updateSmokeParticles(dt) {
  for (let i = smokeParts.length - 1; i >= 0; i--) {
    const p = smokeParts[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      smokeParts.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - dt * 2.5); // 侧向阻力
    p.rot += p.spin * dt;
  }
}

function spawnSmoke() {
  /* 车尾烟雾 */
  spawnSmokeAt(
    player.x + (Math.random() - 0.5) * 16,
    player.y + player.height * 0.42,
    (Math.random() - 0.5) * 50,
    game.speed * (0.35 + Math.random() * 0.25) + 20,
  );
}
function spawnSmokeAt(x, y, vx, vy, dust) {
  if (!assets.smoke || smokeParts.length >= 40) return;
  smokeParts.push({
    x,
    y,
    vx,
    vy, // 比场景慢 → 向后漂出车尾
    life: 0,
    maxLife: 0.7 + Math.random() * 0.6,
    size: 26 + Math.random() * 16, // 起始尺寸
    grow: 1.9, // 结束时放大倍数
    rot: (Math.random() - 0.5) * 1.2,
    spin: (Math.random() - 0.5) * 1.5,
    frame: Math.floor(Math.random() * SMOKE.frames.length),
    dust: !!dust, // 扬尘(画在载具贴图之上) vs 车尾烟雾(画在下方)
  });
}

/* 扬尘: 在玩家脚边产生一颗尘粒 */
function spawnWalkDust() {
  spawnSmokeAt(
    player.x + (Math.random() - 0.5) * 12,
    player.y + player.height * 0.4,
    (Math.random() - 0.5) * 40,
    -(15 + Math.random() * 25),
    true,
  );
}
/* ---- 粒子绘制(dustOnly: true 只画扬尘, false 只画车尾烟雾) ---- */
function drawSmokeParticles(dustOnly) {
  if (!assets.smoke) return;
  const fw = IMG.smoke.naturalWidth / 4; // 4×4 图集, 每格 512
  const fh = IMG.smoke.naturalHeight / 4;
  for (const p of smokeParts) {
    if (p.dust !== dustOnly) continue;
    const t = p.life / p.maxLife;
    const alpha = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * 0.55; // 快速淡入→线性淡出
    const size = p.size * (1 + (p.grow - 1) * t); // 随生命周期膨胀
    const f = SMOKE.frames[p.frame];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    /* 帧边缘内收 4px, 避免图集相邻帧串色 */
    ctx.drawImage(
      IMG.smoke,
      f[0] * fw + 4,
      f[1] * fh + 4,
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
function drawSmoke() {
  drawSmokeParticles(false);
}
function drawDust() {
  drawSmokeParticles(true);
}
