'use strict';

/* 通用工具与绘制辅助(本文件禁止顶层执行语句: 绘制函数依赖 canvas.js 声明的 ctx) */

/* global ctx, game, PX_PER_M, DIFFICULTY_FULL_M, PACE_PER_KM */

/* 数值钳制 */
function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
/* 难度系数: 按已行驶里程线性增长, DIFFICULTY_FULL_M 米时为 1; 不设上限(越走越难) */
function difficulty() {
  return game.totalDist / PX_PER_M / DIFFICULTY_FULL_M;
}
/* 节奏系数: 随里程提升场景基础速度; 不设上限 */
function pace() {
  const km = game.totalDist / PX_PER_M / 1000;
  return 1 + km * PACE_PER_KM;
}
/* 软上限: v ≤ cap 时原样返回; 超过后增长逐渐趋缓(渐近 2×cap), 不硬性截断 */
function softCap(v, cap) {
  if (v <= cap) return v;
  return cap + cap * (1 - Math.exp(-(v - cap) / cap));
}
/* 圆角矩形路径 */
function rr(x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}
function fillRR(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  rr(x, y, w, h, r);
  ctx.fill();
}
/* 色相偏移版贴图(离屏 canvas, 按图片缓存)
 * 同步生成: 图片已加载(naturalWidth>0)时 drawImage 会立即解码, 不会出现"先红一瞬" */
const HUE_CACHE = new Map();
function hueSprite(img, deg) {
  if (!img || !img.naturalWidth) return img;
  let e = HUE_CACHE.get(img);
  if (!e) {
    e = { deg: null, c: null };
    HUE_CACHE.set(img, e);
  }
  if (e.deg === deg) return e.c || img; // 已生成过
  e.deg = deg;
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.filter = 'hue-rotate(' + deg + 'deg)';
    g.drawImage(img, 0, 0);
    e.c = c;
  } catch (_) {
    e.c = null;
  }
  return e.c || img;
}

/* 两个 #rrggbb 之间按比例混合 */
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255;
  const ag = (pa >> 8) & 255;
  const ab = pa & 255;
  const br = (pb >> 16) & 255;
  const bg = (pb >> 8) & 255;
  const bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
/* 渐变按钮底(Steam 风: 斜向渐变 + 顶部柔光)
 * 两端各向中间靠拢, 降低对比度, 让画面更柔和 */
function fillBtn(x, y, w, h, r, top, bottom) {
  const c1 = mixHex(top, bottom, 0.35);
  const c2 = mixHex(bottom, top, 0.35);
  const g = ctx.createLinearGradient(x, y, x + w, y + h); // 左上 → 右下
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  fillRR(x, y, w, h, r, g);
  ctx.save();
  rr(x, y, w, h, r);
  ctx.clip();
  const hi = ctx.createLinearGradient(x, y, x + w * 0.6, y + h * 0.75);
  hi.addColorStop(0, 'rgba(255,255,255,0.13)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hi;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/* 检测贴图非透明内容包围盒(剔除透明留白)
 * frames > 1 时只看第一帧区域, 避免多帧横条把包围盒拉宽 */
function detectSpriteBox(img, frames) {
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const c2d = c.getContext('2d', { willReadFrequently: true });
    c2d.drawImage(img, 0, 0);
    const d = c2d.getImageData(0, 0, c.width, c.height).data;
    const iw = c.width,
      ih = c.height;
    const frameW = Math.floor(iw / Math.max(1, frames || 1));
    const s = 4; // 4px 采样
    let minX = frameW,
      minY = ih,
      maxX = 0,
      maxY = 0;
    for (let y = 0; y < ih; y += s) {
      for (let x = 0; x < frameW; x += s) {
        if (d[(y * iw + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX <= minX || maxY <= minY) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  } catch (_) {
    return null;
  }
}

/* 按 cols×rows 网格切图, 逐格分析非透明内容包围盒(剔除留白); 空帧回退整格 */
function detectGridFrames(img, cols, rows) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const cw = iw / cols;
  const ch = ih / rows;
  const out = [];
  let data;
  try {
    const c = document.createElement('canvas');
    c.width = iw;
    c.height = ih;
    const c2d = c.getContext('2d', { willReadFrequently: true });
    c2d.drawImage(img, 0, 0);
    data = c2d.getImageData(0, 0, iw, ih).data;
  } catch (_) {
    data = null;
  }
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x0 = Math.round(col * cw);
      const y0 = Math.round(r * ch);
      const x1 = Math.round((col + 1) * cw);
      const y1 = Math.round((r + 1) * ch);
      if (!data) {
        out.push({ x: x0, y: y0, w: cw, h: ch });
        continue;
      }
      let minX = x1,
        minY = y1,
        maxX = x0,
        maxY = y0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          if (data[(y * iw + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX > minX && maxY > minY) {
        out.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
      } else {
        out.push({ x: x0, y: y0, w: cw, h: ch });
      }
    }
  }
  return out;
}

/* 按给定矩形列表检测非透明内容包围盒(只取一次像素)
 * rects: [{x, y, w, h}] → 返回同样数量、已剔除透明留白的 {x, y, w, h} */
function detectRectsFrames(img, rects) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  let data = null;
  try {
    const c = document.createElement('canvas');
    c.width = iw;
    c.height = ih;
    const c2d = c.getContext('2d', { willReadFrequently: true });
    c2d.drawImage(img, 0, 0);
    data = c2d.getImageData(0, 0, iw, ih).data;
  } catch (_) {
    data = null;
  }
  return rects.map((r) => {
    const rx0 = Math.max(0, Math.round(r.x));
    const ry0 = Math.max(0, Math.round(r.y));
    const rx1 = Math.min(iw, Math.round(r.x + r.w));
    const ry1 = Math.min(ih, Math.round(r.y + r.h));
    if (!data) return { x: rx0, y: ry0, w: rx1 - rx0, h: ry1 - ry0 };
    let minX = rx1;
    let minY = ry1;
    let maxX = rx0;
    let maxY = ry0;
    for (let y = ry0; y < ry1; y += 2) {
      for (let x = rx0; x < rx1; x += 2) {
        if (data[(y * iw + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX > minX && maxY > minY) {
      return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
    return { x: rx0, y: ry0, w: rx1 - rx0, h: ry1 - ry0 };
  });
}

/* 通用血条 */
function drawBar(x, y, ratio, w, h) {
  const r = clamp(ratio, 0, 1);
  fillRR(x - w / 2 - 1, y - 1, w + 2, h + 2, 2, 'rgba(0,0,0,0.55)');
  /* 血量越高越绿, 越低越红 */
  fillRR(x - w / 2, y, Math.max(2, w * r), h, 1.5, 'hsl(' + Math.round(r * 120) + ', 75%, 52%)');
}
