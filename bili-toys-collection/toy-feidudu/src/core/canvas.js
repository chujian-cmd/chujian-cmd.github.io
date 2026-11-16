'use strict';

/* 画布元素与 DPR 适配 */

/* global W, H */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  /* 缩放贴图时使用高质量采样, 避免边缘发糊(改 canvas 尺寸会重置上下文状态) */
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
}
resize();
window.addEventListener('resize', resize);
