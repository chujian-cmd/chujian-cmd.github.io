'use strict';

/* 漂浮文字(+1 / +25 / 撞飞! 等) */

/* global ctx */

const floatTexts = [];
function addFloatText(x, y, text, color) {
  floatTexts.push({ x, y, text, color, life: 0.9 });
}
function updateFloatTexts(dt) {
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const t = floatTexts[i];
    t.life -= dt;
    t.y -= 45 * dt;
    if (t.life <= 0) floatTexts.splice(i, 1);
  }
}

/* ---- 漂浮文字绘制 ---- */
function drawFloatTexts() {
  ctx.textAlign = 'center';
  ctx.font = "bold 14px 'PingFang SC','Microsoft YaHei',sans-serif";
  for (const t of floatTexts) {
    ctx.globalAlpha = Math.min(1, t.life / 0.6);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}
