
"use strict";
const FX = {
canvas: null,
ctx: null,
W: 300,
H: 150,
dpr: 1,
particles: [],
ripples: [],
trail: [],
glow: null,
mouse: { x: -1, y: -1, px: -1, py: -1, active: false },
_last: 0,
_frame: 0,
_paintBounds: null,
MAX_PARTICLES: 140,
MAX_RIPPLES: 40,
MAX_TRAIL: 32,
init() {
if (this.canvas) return;
const c = document.createElement("canvas");
c.id = "fx-canvas";
document.body.appendChild(c);
this.canvas = c;
this.ctx = c.getContext("2d");
this._bakeGlow();
this.resize();
window.addEventListener("resize", () => this.scheduleResize());
window.addEventListener("pointerdown", (e) => this.onDown(e));
window.addEventListener("pointermove", (e) => this.onMove(e));
window.addEventListener("pointerup", (e) => this.onUp(e));
window.addEventListener("pointercancel", (e) => this.onUp(e));
document.addEventListener("visibilitychange", () => {
if (!document.hidden) return;
if (this._frame) cancelAnimationFrame(this._frame);
this._frame = 0;
this.particles.length = this.ripples.length = this.trail.length = 0;
this.mouse.active = false;
this.mouse.px = this.mouse.py = -1;
this.render();
});
},
resize() {
const w = window.innerWidth, h = window.innerHeight;
const dpr = Math.min(2, window.devicePixelRatio || 1);
if (w === this._cw && h === this._ch && dpr === this.dpr) return;
this._cw = this.W = w; this._ch = this.H = h; this.dpr = dpr;
this._boundedRect = null; this._paintBounds = null;
this.canvas.width = this.canvas.height = 1;
this.canvas.hidden = true;
this.ensureFrame();
},
scheduleResize() {
if (this._resizeT) return;
this._resizeT = setTimeout(() => { this._resizeT = null; this.resize(); }, 120);
},
_bakeGlow() {
const c = document.createElement("canvas");
c.width = 64; c.height = 64;
const g = c.getContext("2d");
const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
grd.addColorStop(0, "rgba(230,248,255,0.9)");
grd.addColorStop(0.35, "rgba(180,228,255,0.4)");
grd.addColorStop(1, "rgba(150,215,255,0)");
g.fillStyle = grd;
g.fillRect(0, 0, 64, 64);
this.glow = c;
},
onDown(e) {
if (document.hidden) return;
this.spawnStarlight(e.clientX, e.clientY);
this.spawnRipple(e.clientX, e.clientY);
this.mouse.px = e.clientX;
this.mouse.py = e.clientY;
this.mouse.x = e.clientX;
this.mouse.y = e.clientY;
this.mouse.active = true;
this.ensureFrame();
},
onMove(e) {
if (document.hidden) return;
this.mouse.x = e.clientX;
this.mouse.y = e.clientY;
this.mouse.active = true;
this.ensureFrame();
},
onUp() {
this.mouse.active = false;
this.mouse.px = -1; this.mouse.py = -1;
if (this.trail.length) this.trail.length = 0;
if (this._paintBounds) this.ensureFrame();
},
spawnStarlight(x, y) {
const n = 6 + Math.floor(Math.random() * 4);
for (let i = 0; i < n; i++) {
const a = Math.random() * Math.PI * 2;
const sp = 30 + Math.random() * 90;
this.particles.push({
type: "star", x, y,
vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
life: 0, maxLife: 0.4 + Math.random() * 0.3,
size: 1.2 + Math.random() * 1.8,
rot: Math.random() * Math.PI,
vr: (Math.random() - 0.5) * 7,
color: `hsl(${188 + Math.random() * 42}, 100%, ${70 + Math.random() * 25}%)`,
});
if (this.particles.length > this.MAX_PARTICLES) this.particles.shift();
}
},
spawnRipple(x, y) {
this.ripples.push({ x, y, r: 3, maxR: 37 + Math.random() * 16, life: 0, maxLife: 0.8, color: "rgba(150,214,255,0.85)" });
this.ripples.push({ x, y, r: 2, maxR: 59 + Math.random() * 13, life: -0.12, maxLife: 0.95, color: "rgba(190,230,255,0.5)" });
if (this.ripples.length > this.MAX_RIPPLES) this.ripples.splice(0, this.ripples.length - this.MAX_RIPPLES);
},
updateTrail(dt) {
const pts = this.trail;
for (let i = pts.length - 1; i >= 0; i--) {
pts[i].age += dt;
if (pts[i].age > 0.55) pts.splice(i, 1);
}
if (!this.mouse.active) return;
const dx = this.mouse.x - this.mouse.px;
const dy = this.mouse.y - this.mouse.py;
const moved = Math.hypot(dx, dy);
if (this.mouse.px >= 0 && moved > 0.4) {
const steps = Math.min(3, Math.ceil(moved / 6));
for (let s = 1; s <= steps; s++) {
pts.push({ x: this.mouse.px + dx * (s / steps), y: this.mouse.py + dy * (s / steps), age: 0 });
}
if (pts.length > this.MAX_TRAIL) pts.splice(0, pts.length - this.MAX_TRAIL);
}
this.mouse.px = this.mouse.x;
this.mouse.py = this.mouse.y;
},
updateParticles(dt) {
const keep = [];
for (const p of this.particles) {
p.life += dt;
if (p.life >= p.maxLife) continue;
if (p.type === "star") {
p.vx *= 0.96;
p.vy += 220 * dt;
p.x += p.vx * dt;
p.y += p.vy * dt;
p.rot += p.vr * dt;
}
keep.push(p);
}
this.particles = keep;
},
updateRipples(dt) {
const keep = [];
for (const r of this.ripples) {
r.life += dt;
if (r.life < r.maxLife) keep.push(r);
}
this.ripples = keep;
},
ensureFrame() {
if (!this.canvas || this._frame || document.hidden) return;
this._last = performance.now();
this._frame = requestAnimationFrame((t) => this.loop(t));
},
loop(now) {
this._frame = 0;
if (document.hidden) return;
try {
const dt = Math.min(0.05, (now - this._last) / 1000);
this._last = now;
this.updateTrail(dt);
this.updateParticles(dt);
this.updateRipples(dt);
this.render();
} catch (e) { console.error("FX loop:", e); }
if (this.particles.length || this.ripples.length || this.trail.length) {
this._frame = requestAnimationFrame((t) => this.loop(t));
}
},
paintBounds() {
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
const add = (x, y, r) => {
x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r);
x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r);
};
this.trail.forEach((p) => add(p.x, p.y, 5));
this.particles.forEach((p) => add(p.x, p.y, p.size * 7 + 3));
this.ripples.forEach((r) => { if (r.life >= 0) add(r.x, r.y, r.maxR * 1.2 + 5); });
if (!Number.isFinite(x0)) return null;
return { x: Math.max(0, Math.floor(x0)), y: Math.max(0, Math.floor(y0)),
right: Math.min(this.W, Math.ceil(x1)), bottom: Math.min(this.H, Math.ceil(y1)) };
},
render() {
const c = this.ctx, next = this.paintBounds();
if (!next || next.right <= next.x || next.bottom <= next.y) {
this._paintBounds = null; this._boundedRect = null;
this.canvas.hidden = true;
if (this.canvas.width !== 1 || this.canvas.height !== 1) this.canvas.width = this.canvas.height = 1;
return;
}
const d = this.dpr, pad = Math.ceil(12 * d), bucket = Math.ceil(64 * d);
const desired = { x: Math.floor(next.x * d) - pad, y: Math.floor(next.y * d) - pad,
right: Math.ceil(next.right * d) + pad, bottom: Math.ceil(next.bottom * d) + pad };
let rect = this._boundedRect;
if (!rect || desired.x < rect.x || desired.y < rect.y || desired.right > rect.x + rect.w || desired.bottom > rect.y + rect.h) {
const w = Math.max(rect?.w || 0, Math.ceil((desired.right - desired.x) / bucket) * bucket),
h = Math.max(rect?.h || 0, Math.ceil((desired.bottom - desired.y) / bucket) * bucket);
const x = Math.floor((desired.x - (w - (desired.right - desired.x)) / 2) / bucket) * bucket,
y = Math.floor((desired.y - (h - (desired.bottom - desired.y)) / 2) / bucket) * bucket;
rect = { x, y, w: Math.max(w, desired.right - x), h: Math.max(h, desired.bottom - y) };
rect.w = Math.ceil(rect.w / bucket) * bucket; rect.h = Math.ceil(rect.h / bucket) * bucket;
if (this.canvas.width !== rect.w) this.canvas.width = rect.w;
if (this.canvas.height !== rect.h) this.canvas.height = rect.h;
Object.assign(this.canvas.style, { inset: "auto", left: "0px", top: "0px", right: "auto", bottom: "auto",
width: (rect.w / d) + "px", height: (rect.h / d) + "px", willChange: "transform",
transform: "translate3d(" + (rect.x / d) + "px," + (rect.y / d) + "px,0)" });
this._boundedRect = rect;
}
this.canvas.hidden = false;
c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, rect.w, rect.h);
c.setTransform(d, 0, 0, d, -rect.x, -rect.y);
this._paintBounds = next;
this.drawTrail(c);
for (const p of this.particles) this.drawParticle(c, p);
for (const r of this.ripples) this.drawRipple(c, r);
},
drawTrail(c) {
const pts = this.trail;
if (pts.length < 2) return;
c.save();
c.lineCap = "round";
c.lineJoin = "round";
for (let i = 1; i < pts.length; i++) {
const p0 = pts[i - 1], p1 = pts[i];
const t = p1.age / 0.55;
const alpha = Math.max(0, 1 - t) * 0.9;
if (alpha <= 0.03) continue;
const hue = 195 + 26 * t;
c.globalAlpha = alpha * 0.35;
c.strokeStyle = `hsl(${hue}, 95%, 78%)`;
c.lineWidth = Math.max(0.8, 5.5 * (1 - t));
c.beginPath();
c.moveTo(p0.x, p0.y);
c.lineTo(p1.x, p1.y);
c.stroke();
c.globalAlpha = alpha;
c.strokeStyle = `hsl(${hue}, 100%, 90%)`;
c.lineWidth = Math.max(0.5, 2.6 * (1 - t));
c.beginPath();
c.moveTo(p0.x, p0.y);
c.lineTo(p1.x, p1.y);
c.stroke();
}
const h = pts[pts.length - 1];
c.globalAlpha = 1;
c.fillStyle = "#ffffff";
c.beginPath();
c.arc(h.x, h.y, 2.2, 0, Math.PI * 2);
c.fill();
c.restore();
},
drawParticle(c, p) {
const t = p.life / p.maxLife;
const alpha = Math.max(0, 1 - t);
if (p.type !== "star") return;
const s = p.size * 2 * (1 - t * 0.35);
if (this.glow) {
const gs = s * 7;
c.globalAlpha = alpha * 0.85;
c.drawImage(this.glow, p.x - gs / 2, p.y - gs / 2, gs, gs);
}
c.save();
c.globalAlpha = alpha;
c.translate(p.x, p.y);
c.rotate(p.rot);
c.scale(1 - t * 0.35, 1 - t * 0.35);
c.fillStyle = p.color;
c.beginPath();
c.moveTo(0, -s);
c.quadraticCurveTo(0.18 * s, -0.18 * s, s, 0);
c.quadraticCurveTo(0.18 * s, 0.18 * s, 0, s);
c.quadraticCurveTo(-0.18 * s, 0.18 * s, -s, 0);
c.quadraticCurveTo(-0.18 * s, -0.18 * s, 0, -s);
c.fill();
c.restore();
},
drawRipple(c, rp) {
const t = rp.life / rp.maxLife;
if (t < 0 || t > 1) return;
const e = 1 - Math.pow(1 - t, 3);
const rr = rp.r + (rp.maxR - rp.r) * e;
const alpha = 1 - t;
c.save();
c.globalAlpha = alpha * 0.85;
const g = c.createRadialGradient(rp.x, rp.y, rr * 0.5, rp.x, rp.y, rr * 1.18);
g.addColorStop(0, "rgba(150,215,255,0)");
g.addColorStop(0.82, "rgba(150,215,255,0.32)");
g.addColorStop(1, "rgba(150,215,255,0)");
c.fillStyle = g;
c.beginPath();
c.arc(rp.x, rp.y, rr * 1.18, 0, Math.PI * 2);
c.fill();
c.globalAlpha = alpha * 0.35;
c.strokeStyle = "rgba(160,220,255,0.9)";
c.lineWidth = Math.max(1, 5 * (1 - t));
c.beginPath();
c.arc(rp.x, rp.y, rr, 0, Math.PI * 2);
c.stroke();
c.globalAlpha = alpha * 0.9;
c.strokeStyle = "rgba(224,246,255,0.95)";
c.lineWidth = Math.max(0.5, 2 * (1 - t));
c.beginPath();
c.arc(rp.x, rp.y, rr, 0, Math.PI * 2);
c.stroke();
c.restore();
},
};
window.FX = FX;
window.addEventListener("DOMContentLoaded", () => FX.init());
