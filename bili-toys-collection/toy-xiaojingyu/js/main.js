
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const PLAYER_WORLD_H = 180;
const Game = {
canvas: null,
ctx: null,
project: null,
scene: null,
bgImg: null,
playerImg: null,
objImgs: {},
px: 0, py: 0, facing: -1,
target: null,
speed: 260,
moving: false,
jumpPhase: 0,
jumpCycle: 0.34,
jumpHeight: 60,
playerBody: { w: 52, h: 28 },
camW: 900, camH: 600,
backdrop: null,
_last: 0,
_prevJump: 0,
camPush: 0,
camPushActive: false,
async init() {
this.canvas = $("#game");
this.ctx = this.canvas.getContext("2d");
this.resize();
window.addEventListener("resize", () => this.scheduleResize());
this.canvas.addEventListener("pointerdown", (e) => this.onTap(e));
this.canvas.addEventListener("touchstart", (e) => {
if (e.touches && e.touches[0]) this.onTap(e.touches[0]);
}, { passive: true });
window.Training && Training.init();
window.SFX && SFX.init();
const res = await fetch("./data/project.json", { cache: "no-store" });
if (!res.ok) {
console.warn("[Game] 未找到项目数据（data/project.json），使用出厂默认");
return;
}
this.project = await res.json();
await this.loadScene(this.project.scenes[this.project.active || 0]);
this.camPush = 0;
this.camPushActive = true;
},
resize() {
const dpr = Math.min(2, window.devicePixelRatio || 1);
const w = this.canvas.clientWidth || window.innerWidth;
const h = this.canvas.clientHeight || window.innerHeight;
this.canvas.width = w * dpr;
this.canvas.height = h * dpr;
this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
const big = !this.backdrop
|| Math.abs(w - this._cw) > 48
|| Math.abs(h - this._ch) > 48;
if (big) { this._cw = w; this._ch = h; this.bakeBackdrop(); }
},
scheduleResize() {
if (this._resizeT) return;
this._resizeT = setTimeout(() => { this._resizeT = null; this.resize(); }, 120);
},
bakeBackdrop() {
const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
if (!cw || !ch) return;
const MAXD = 1600;
const k = Math.min(1, MAXD / Math.max(cw, ch));
const bw = Math.max(1, Math.round(cw * k));
const bh = Math.max(1, Math.round(ch * k));
const off = document.createElement("canvas");
off.width = bw; off.height = bh;
const o = off.getContext("2d");
const g = o.createLinearGradient(0, 0, 0, bh);
g.addColorStop(0, "#bfe6ff");
g.addColorStop(0.5, "#d9f1ff");
g.addColorStop(1, "#effaff");
o.fillStyle = g;
o.fillRect(0, 0, bw, bh);
if (this.bgImg && this.bgImg.complete && this.bgImg.naturalWidth > 0) {
const ow = Math.max(1, Math.round(bw / 5));
const oh = Math.max(1, Math.round(bh / 5));
const small = document.createElement("canvas");
small.width = ow; small.height = oh;
const s = small.getContext("2d");
s.drawImage(this.bgImg, 0, 0, ow, oh);
o.globalAlpha = 0.6;
o.drawImage(small, 0, 0, bw, bh);
o.globalAlpha = 1;
}
this.backdrop = off;
},
loadScene(sc) {
if (!sc) { console.warn("[Game] 项目没有可用场景"); return Promise.resolve(); }
this.scene = sc;
this.px = sc.spawn.x;
this.py = sc.spawn.y;
this.target = null;
this.camW = Math.min(sc.camera.w, sc.bgW);
this.camH = Math.min(sc.camera.h, sc.bgH);
const generation = this._sceneLoadGeneration = (this._sceneLoadGeneration || 0) + 1;
this._sceneAbort?.abort();
this._sceneAbort = typeof AbortController === 'function' ? new AbortController() : null;
this._last = performance.now();
if (!this._sceneLoopStarted) { this._sceneLoopStarted = true; requestAnimationFrame(t => this.loop(t)); }
const load = (source, apply) => window.ImageResources.load(source, { signal: this._sceneAbort?.signal }).then(image => {
if (this._sceneLoadGeneration === generation) apply(image);
}).catch(() => {});
this.bgImg = null; this.playerImg = null;
const jobs = [load(sc.bg, image => { this.bgImg = image; this.bakeBackdrop(); }), load(sc.player.src, image => { this.playerImg = image; })];
for (const object of sc.objects || []) {
const cached = this.objImgs[object.src];
if (cached && cached.complete && cached.naturalWidth > 0) continue;
delete this.objImgs[object.src];
jobs.push(load(object.src, image => { this.objImgs[object.src] = image; }));
}
return Promise.all(jobs).then(() => { if (this._sceneLoadGeneration === generation) this.render(); });
},
cameraSize() {
const sc = this.scene;
const cw = this.canvas.clientWidth || window.innerWidth;
const ch = this.canvas.clientHeight || window.innerHeight;
if (!cw || !ch) return { w: this.camW, h: this.camH };
const ar = cw / ch;
let w = this.camW;
let h = w / ar;
if (h > sc.bgH) { h = sc.bgH; w = h * ar; }
if (w > sc.bgW) { w = sc.bgW; h = w / ar; }
return { w, h };
},
updateCam() {
const sc = this.scene;
const sz = this.cameraSize();
const hw = sz.w / 2, hh = sz.h / 2;
const cx = hw >= sc.bgW / 2 ? sc.bgW / 2 : Math.max(hw, Math.min(sc.bgW - hw, this.px));
const cyBase = this.py + (sc.camera.centerOffsetY || 0);
const cy = hh >= sc.bgH / 2 ? sc.bgH / 2 : Math.max(hh, Math.min(sc.bgH - hh, cyBase));
return { x: cx, y: cy, w: sz.w, h: sz.h };
},
view() {
const cam = this.updateCam();
const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
const e = 1 - Math.pow(1 - this.camPush, 3);
const zoom = 0.9 + 0.1 * e;
const s = Math.min(cw / cam.w, ch / cam.h) * zoom;
const ox = (cw - cam.w * s) / 2, oy = (ch - cam.h * s) / 2;
return { cam, s, ox, oy };
},
S(wx, wy) {
const v = this.view();
return {
x: v.ox + (wx - (v.cam.x - v.cam.w / 2)) * v.s,
y: v.oy + (v.cam.h - (wy - (v.cam.y - v.cam.h / 2))) * v.s,
};
},
onTap(e) {
const r = this.canvas.getBoundingClientRect();
const sx = e.clientX - r.left, sy = e.clientY - r.top;
const w = this.screenToWorld(sx, sy);
const sc = this.scene;
if (w.x >= 0 && w.x <= sc.bgW && w.y >= 0 && w.y <= sc.bgH) {
this.target = { x: w.x, y: w.y };
}
},
screenToWorld(sx, sy) {
const v = this.view();
return {
x: v.cam.x - v.cam.w / 2 + (sx - v.ox) / v.s,
y: v.cam.y + v.cam.h / 2 - (sy - v.oy) / v.s,
};
},
loop(now) {
requestAnimationFrame((t) => this.loop(t));
try {
const dt = Math.min(0.05, (now - this._last) / 1000);
this._last = now;
this.update(dt);
this.render();
} catch (e) { console.error("Game loop:", e); }
},
update(dt) {
if (this.camPushActive) {
this.camPush = Math.min(1, this.camPush + dt / 1.4);
if (this.camPush >= 1) this.camPushActive = false;
}
if (!this.target) { this.moving = false; return; }
this.moving = true;
const dx = this.target.x - this.px, dy = this.target.y - this.py;
const dist = Math.hypot(dx, dy);
const step = this.speed * dt;
if (dist <= step) {
this.px = this.target.x; this.py = this.target.y;
this.target = null;
this.moving = false;
this.jumpPhase = 0;
return;
}
const nx = dx / dist, ny = dy / dist;
if (nx > 0.01) this.facing = 1;
else if (nx < -0.01) this.facing = -1;
const nX = this.px + nx * step, nY = this.py + ny * step;
if (this.free(nX, this.py)) this.px = nX;
if (this.free(this.px, nY)) this.py = nY;
this.jumpPhase = (this.jumpPhase + dt / this.jumpCycle) % 1;
if (this.jumpPhase < this._prevJump && window.SFX) SFX.play("move");
this._prevJump = this.jumpPhase;
},
free(x, y) {
const b = this.playerBody;
const pr = { x: x - b.w / 2, y: y - b.h / 2, w: b.w, h: b.h };
for (const o of this.scene.objects || []) {
const c = o.collision;
if (!c) continue;
if (pr.x < c.x + c.w && pr.x + pr.w > c.x && pr.y < c.y + c.h && pr.y + pr.h > c.y) return false;
}
return true;
},
render() {
const ctx = this.ctx;
const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
const v = this.view();
if (this.backdrop) {
ctx.drawImage(this.backdrop, 0, 0, cw, ch);
} else {
ctx.fillStyle = "#cfe9ff";
ctx.fillRect(0, 0, cw, ch);
}
const sc = this.scene;
if (this.bgImg && this.bgImg.complete && this.bgImg.naturalWidth > 0) {
const sx0 = ((v.cam.x - v.cam.w / 2) / sc.bgW) * this.bgImg.width;
const sy0 = (1 - (v.cam.y + v.cam.h / 2) / sc.bgH) * this.bgImg.height;
const sw = (v.cam.w / sc.bgW) * this.bgImg.width;
const sh = (v.cam.h / sc.bgH) * this.bgImg.height;
ctx.drawImage(this.bgImg, sx0, sy0, sw, sh, v.ox, v.oy, v.cam.w * v.s, v.cam.h * v.s);
}
const actors = (sc.objects || []).map((o) => ({ kind: "obj", o }));
actors.push({ kind: "player" });
actors.sort((a, b) => this.depth(b) - this.depth(a));
for (const ac of actors) {
if (ac.kind === "obj") this.drawObject(ctx, ac.o, v);
else this.drawPlayer(ctx, v);
}
},
depth(ac) {
if (ac.kind === "player") return this.py;
return ac.o.y + ac.o.h * 0.3 + (ac.o.depthOffset || 0);
},
drawObject(ctx, o, v) {
const p = this.S(o.x, o.y);
const w = o.w * (o.scale || 1) * v.s;
const h = o.h * (o.scale || 1) * v.s;
const img = this.objImgs[o.src];
if (img && img.complete && img.naturalWidth > 0) {
ctx.drawImage(img, p.x - w / 2, p.y - h, w, h);
} else {
ctx.fillStyle = "#444b57";
ctx.fillRect(p.x - w / 2, p.y - h, w, h);
}
if (o.collision) {
const c = o.collision;
const a = this.S(c.x, c.y);
const b = this.S(c.x + c.w, c.y + c.h);
ctx.fillStyle = "rgba(255,80,80,0.13)";
ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
ctx.strokeStyle = "rgba(255,107,107,0.6)";
ctx.lineWidth = 1;
ctx.strokeRect(a.x, b.y, b.x - a.x, a.y - b.y);
}
},
drawPlayer(ctx, v) {
const p = this.S(this.px, this.py);
const ph = PLAYER_WORLD_H * (this.scene.player.scale || 1) * v.s;
const pw = this.playerImg && this.playerImg.complete && this.playerImg.naturalWidth > 0
? ph * (this.playerImg.width / this.playerImg.height) : ph * 0.75;
const jump = this.moving ? Math.abs(Math.sin(this.jumpPhase * Math.PI)) : 0;
const lift = -jump * this.jumpHeight * v.s;
const sh = 1 - 0.32 * jump;
ctx.beginPath();
ctx.ellipse(p.x, p.y, pw * 0.4 * sh, pw * 0.14 * sh, 0, 0, Math.PI * 2);
ctx.fillStyle = "rgba(0,0,0,0.3)";
ctx.fill();
ctx.save();
ctx.translate(p.x, p.y + lift);
ctx.scale(-this.facing, 1);
if (this.playerImg && this.playerImg.complete && this.playerImg.naturalWidth > 0) {
ctx.drawImage(this.playerImg, -pw / 2, -ph, pw, ph);
} else {
ctx.fillStyle = "#5b8cff";
ctx.fillRect(-pw / 2, -ph, pw, ph);
}
ctx.restore();
},
};
window.Game = Game;
