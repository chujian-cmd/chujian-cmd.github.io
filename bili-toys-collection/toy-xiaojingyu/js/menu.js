
"use strict";
const MENU_IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let MENU_BGM_URL = "";
let SCENE_BGM_URL = "";
let REVIEW_BGM_URL = "";
let BONUS_BGM_URL = "";
let WHALE_SPRITE = "resource/character/stand.webp";
let WHALE_SPRITES = [
"resource/character/stand.webp",
"resource/character/叉腰.webp",
"resource/character/大拇哥.webp",
"resource/character/比耶.webp",
"resource/character/躺1.webp",
];
let TITLE_IMG = "resource/ui/title_cut.webp";
let EXT_CFG = null;
let PRELOAD_IMG = new Set();
let PRELOAD_AUD = new Set();
function collectRes(obj, imgSet, audSet) {
if (obj == null) return;
if (typeof obj === "string") {
if (!obj.startsWith("resource/") && !obj.startsWith("/resource/")) return;
const q = obj.split("?")[0];
if (/\.(webp|png|jpe?g|gif)$/i.test(q)) imgSet.add(obj);
else if (/\.(mp3|wav|ogg|m4a|flac)$/i.test(q)) audSet.add(obj);
return;
}
if (Array.isArray(obj)) { for (const x of obj) collectRes(x, imgSet, audSet); return; }
if (obj && typeof obj === "object") {
for (const k in obj) collectRes(obj[k], imgSet, audSet);
}
}
function collectStartupRes(cfg, imgSet, audSet) {
const deferred = new Set(["EMBODIED", "FACTORY", "CITY_JOURNEY", "LIFE_STORY"]);
for (const key of Object.keys(cfg || {})) {
if (!deferred.has(key)) collectRes(cfg[key], imgSet, audSet);
}
}
function installImgRetry() {
window.ImageResources?.install();
}
function fetchT(url, ms) {
const opt = { cache: "no-store" };
if (typeof AbortController === "undefined") return fetch(url, opt);
const c = new AbortController();
const t = setTimeout(() => c.abort(), ms || 6000);
return fetch(url, Object.assign(opt, { signal: c.signal })).then(
(r) => { clearTimeout(t); return r; },
(e) => { clearTimeout(t); throw e; }
);
}
async function resolveAssets() {
try {
const [bgm, proj, cfg] = await Promise.all([
fetchT("./data/bgm_config.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
fetchT("./data/project.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
fetchT("./data/game_cfg.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
]);
MENU_BGM_URL = (bgm && bgm.menu) || "";
SCENE_BGM_URL = (bgm && bgm.scene) || "";
REVIEW_BGM_URL = (bgm && bgm.review) || "";
BONUS_BGM_URL = (bgm && bgm.bonus) || "";
EXT_CFG = (cfg && typeof cfg === "object") ? cfg : null;
window.BGM_URLS = {
menu: MENU_BGM_URL, scene: SCENE_BGM_URL,
review: REVIEW_BGM_URL, bonus: BONUS_BGM_URL,
};
(proj && proj.scenes || []).forEach((scn) => {
if (scn.bg && !scn.bg.startsWith("data:")) { PRELOAD_IMG.add(scn.bg); }
if (scn.player && scn.player.src && !scn.player.src.startsWith("data:")) {
PRELOAD_IMG.add(scn.player.src); WHALE_SPRITE = scn.player.src;
}
(scn.objects || []).forEach((o) => { if (o.src) PRELOAD_IMG.add(o.src); });
});
collectStartupRes(cfg, PRELOAD_IMG, PRELOAD_AUD);
if (window.GameCfg) collectStartupRes(window.GameCfg, PRELOAD_IMG, PRELOAD_AUD);
if (MENU_BGM_URL) PRELOAD_AUD.add(MENU_BGM_URL);
if (SCENE_BGM_URL) PRELOAD_AUD.add(SCENE_BGM_URL);
if (REVIEW_BGM_URL) PRELOAD_AUD.add(REVIEW_BGM_URL);
if (BONUS_BGM_URL) PRELOAD_AUD.add(BONUS_BGM_URL);
} catch (e) { }
}
const FALL_G = 3000;
const FALL_TERM = 1000;
const $menu = (s, r = document) => r.querySelector(s);
const AudioMgr = {
ctx: null,
master: null,
seq: 0,
cur: null,
want: null,
bytes: {},
bytesP: {},
decoded: {},
DECODE_KEEP: 2,
_lru: [],
musicVolKey: "whale_music_vol",
musicVol: 0.6,
_armed: false,
_restoreVol() {
try {
const v = parseFloat(localStorage.getItem(this.musicVolKey));
if (!isNaN(v) && v >= 0 && v <= 1) this.musicVol = v;
} catch (e) {}
},
_ensure() {
if (this.ctx) return true;
try {
const AC = window.AudioContext || window.webkitAudioContext;
if (!AC) return false;
this._restoreVol();
this.ctx = new AC();
this.master = this.ctx.createGain();
this.master.gain.value = this.musicVol;
this.master.connect(this.ctx.destination);
this.sfxGain = this.ctx.createGain();
this.sfxGain.gain.value = 1.0;
this.sfxGain.connect(this.ctx.destination);
this._armUnlock();
return true;
} catch (e) { return false; }
},
_armUnlock() {
if (this._armed) return;
this._armed = true;
const h = () => { this.unlock(); };
window.addEventListener("pointerdown", h, { passive: true });
window.addEventListener("touchstart", h, { passive: true });
window.addEventListener("keydown", h, { passive: true });
},
async unlock() {
if (!this._ensure()) return;
try { if (this.ctx.state === "suspended") await this.ctx.resume(); } catch (e) {}
if (this.want) { const w = this.want; this.want = null; this.playBgm(w.url); }
},
resume() {
if (!this._ensure()) return;
try {
if (this.ctx.state === "suspended") {
const p = this.ctx.resume();
if (p && p.catch) p.catch(() => {});
}
} catch (e) {}
},
_waitRunning(ms) {
const t0 = performance.now();
return new Promise((resolve) => {
const tick = () => {
if (!this.ctx || this.ctx.state === "running") return resolve(true);
if (performance.now() - t0 > ms) return resolve(false);
setTimeout(tick, 25);
};
tick();
});
},
async fetchBytes(url) {
if (this.bytes[url]) return this.bytes[url];
if (this.bytesP[url]) return this.bytesP[url];
this.bytesP[url] = (async () => {
let lastErr;
for (let i = 0; i < 2; i++) {
try {
const r = await fetch(url);
if (!r.ok) throw new Error("BGM " + r.status);
const b = await r.arrayBuffer();
this.bytes[url] = b;
return b;
} catch (e) { lastErr = e; }
}
throw lastErr;
})();
try { return await this.bytesP[url]; }
catch (e) { delete this.bytesP[url]; throw e; }
},
_rememberDecoded(url) {
if (!url || !this.decoded[url]) return;
this._lru = (this._lru || []).filter((u) => u !== url);
this._lru.push(url);
this._trimDecoded();
},
_trimDecoded() {
const keep = this.DECODE_KEEP != null ? this.DECODE_KEEP : 2;
const alive = (u) => (this.cur && this.cur.url === u) || (this.want && this.want.url === u);
let guard = 0;
while (this._lru.length > keep && guard++ < 50) {
const old = this._lru.shift();
if (alive(old)) { this._lru.push(old); continue; }
delete this.decoded[old];
}
},
async predecode(url) {
if (!this._ensure()) return null;
if (this.decoded[url]) { this._rememberDecoded(url); return this.decoded[url]; }
try {
const raw = await this.fetchBytes(url);
const ab = raw.slice(0);
const buf = await Promise.race([
this.ctx.decodeAudioData(ab),
new Promise((_, rej) => setTimeout(() => rej(new Error("decode timeout")), 15000)),
]);
this.decoded[url] = buf;
this._rememberDecoded(url);
delete this.bytes[url];
return buf;
} catch (e) { return null; }
},
async playBgm(url) {
if (!this._ensure()) return false;
this.resume();
const my = ++this.seq;
let buffer = this.decoded[url];
if (!buffer) buffer = await this.predecode(url);
if (!buffer || my !== this.seq) return false;
const ok = await this._waitRunning(600);
if (my !== this.seq) return false;
if (ok) { this._start(url, buffer, my); return true; }
this.want = { url };
return false;
},
_start(url, buffer, my) {
this.stopBgm();
const src = this.ctx.createBufferSource();
src.buffer = buffer;
src.loop = true;
src.connect(this.master);
src.start();
this.cur = { src, url };
this._rememberDecoded(url);
},
stopBgm() {
if (this.cur && this.cur.src) { try { this.cur.src.stop(); } catch (e) {} this.cur = null; }
},
setMusicVolume(v) {
this.musicVol = Math.max(0, Math.min(1, v));
this._applyGain();
try { localStorage.setItem(this.musicVolKey, String(this.musicVol)); } catch (e) {}
},
_applyGain() { if (this.master) this.master.gain.value = this.musicVol; },
};
window.AudioMgr = AudioMgr;
const Menu = {
whaleImg: null,
whaleImgs: [],
whaleLoaded: false,
titleImg: null,
geoShapes: [],
canvas: null,
ctx: null,
W: 300,
H: 150,
dpr: 1,
fallers: [],
phase: "grow",
spawnAcc: 0,
spawnRate: 0.9,
growth: 0,
maxFallers: 40,
_time: 0,
_last: 0,
menuBgmStarted: false,
started: false,
boot() {
const health = window.BootHealth;
if (health && !health.stylesReady()) {
if (!this._stylesBootWaiting) {
this._stylesBootWaiting = true;
health.whenStylesReady(() => this.boot());
}
return;
}
if (this._bootStarted) return;
this._bootStarted = true;
if (window.__B) window.__B.mark("menu:boot");
installImgRetry();
this._installBootErrorTrap();
this.armStuckEscape();
this.preloadAndStart();
},
_installBootErrorTrap() {
const show = (msg) => {
if (window.__B) window.__B.mark("trap:" + String(msg).slice(0, 40));
const ld = document.getElementById("loading");
if (!ld || !ld.isConnected) return;
const t = document.getElementById("load-text");
if (t) t.textContent = "加载出错: " + String(msg).slice(0, 60);
};
window.addEventListener("error", (e) => {
const sdk = document.querySelector("script[data-boot-sdk]");
if (sdk && ((e.filename && e.filename === sdk.src) || e.target === sdk)) return;
show((e.error && e.error.message) || e.message || e.type);
}, true);
window.addEventListener("unhandledrejection", (e) => show((e.reason && e.reason.message) || e.reason || "Promise 拒绝"));
},
armStuckEscape() {
setTimeout(() => {
if (this._entered) return;
const h = () => {
AudioMgr.unlock();
setTimeout(() => this.showMenu(), 0);
};
this._escapeH = h;
this._escapeTypes = ["pointerdown", "touchstart", "click"];
this._escapeTypes.forEach((t) => window.addEventListener(t, h, { capture: true }));
}, 8000);
},
async preloadAndStart() {
const start = performance.now();
const minMs = 900;
await resolveAssets();
if (window.__B) window.__B.mark("menu:assets");
WHALE_SPRITES.forEach((u) => PRELOAD_IMG.add(u));
PRELOAD_IMG.add(TITLE_IMG);
PRELOAD_IMG.add(WHALE_SPRITE);
const sfxPromise = window.SFX
? Promise.resolve(window.SFX.preload())
: Promise.resolve();
const critical = new Set([...WHALE_SPRITES, TITLE_IMG, WHALE_SPRITE]);
const imgUrls = [...PRELOAD_IMG].sort((a, b) => Number(critical.has(b)) - Number(critical.has(a)));
const audUrls = [...PRELOAD_AUD];
const total = imgUrls.length + audUrls.length + 1;
let done = 0, nextImage = 0;
const count = () => { done++; this.setProgress(done / total); };
const jobs = Array.from({ length: Math.min(4, imgUrls.length) }, async () => {
while (nextImage < imgUrls.length) {
const u = imgUrls[nextImage++];
try {
const img = await this.loadImage(u, 2, critical.has(u));
if (u === TITLE_IMG) this.titleImg = img;
if (u === WHALE_SPRITE) { this.whaleImg = img; this.whaleLoaded = true; }
if (WHALE_SPRITES.includes(u)) this.whaleImgs.push(img);
} catch (_) {} finally { count(); }
}
});
const AUDIO_GATE_MS = 12000;
const gate = (p) => Promise.race([p.catch(() => {}), new Promise((r) => setTimeout(r, AUDIO_GATE_MS))]);
const audioAll = Promise.all([
...audUrls.map((u) =>
(u === MENU_BGM_URL
? AudioMgr.predecode(u)
: AudioMgr.fetchBytes(u).catch(() => {})
).then(count).catch(() => count())
),
sfxPromise.then(count).catch(() => count()),
]);
jobs.push(gate(audioAll));
await Promise.all(jobs);
if (window.__B) window.__B.mark("menu:preloaded");
if (this.whaleImgs.length) {
const pose = this.whaleImgs[Math.floor(Math.random() * this.whaleImgs.length)];
if (pose) this.whaleImg = pose;
this.whaleLoaded = true;
}
const elapsed = performance.now() - start;
if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed));
this.armContinueTap();
},
armContinueTap() {
if (window.__B) window.__B.mark("menu:armTap");
this._tapArmed = true;
const txt = $menu("#load-text");
if (txt) txt.textContent = "加载完成 · 点击开始";
const go = () => {
AudioMgr.unlock();
setTimeout(() => this.showMenu(), 0);
};
["pointerdown", "touchstart", "click"].forEach((t) =>
window.addEventListener(t, go, { once: true, capture: true })
);
if (MENU_IS_IOS) {
if (window.__B) window.__B.mark("menu:auto-enter");
setTimeout(go, 800);
}
},
loadImage(src, retry = 2, decode = false) {
return window.ImageResources.load(src, { retries: retry, decode });
},
setProgress(t) {
const fill = $menu("#load-fill");
if (fill) fill.style.width = Math.min(100, Math.round(t * 100)) + "%";
if (this._tapArmed) return;
const txt = $menu("#load-text");
if (txt) txt.textContent = t >= 1 ? "加载完成" : "加载中 " + Math.round(t * 100) + "%";
},
showMenu() {
if (window.BootHealth && !window.BootHealth.stylesReady()) return;
if (this._entered) return;
this._entered = true;
if (window.__B) window.__B.mark("menu:showMenu");
if (this._escapeH) {
(this._escapeTypes || ["pointerdown"]).forEach((t) =>
window.removeEventListener(t, this._escapeH, true)
);
this._escapeH = null;
this._escapeTypes = null;
}
const ld = $menu("#loading");
if (ld) { ld.style.opacity = "0"; setTimeout(() => ld.remove(), 520); }
const m = $menu("#menu");
m.hidden = false;
this.canvas = $menu("#menu-canvas");
this.ctx = this.canvas.getContext("2d");
this.resize();
window.addEventListener("resize", () => this.resize());
this._time = 0;
this.phase = "grow";
this.growth = 0;
this.spawnAcc = 0;
this.spawnRate = 0.9;
for (let i = 0; i < 2; i++) this.spawnFall(true);
this.applyTitle();
this.animateTitle();
const startBtn = $menu("#menu-start");
if (startBtn) {
startBtn.addEventListener("pointerdown", () => this.onMenuDown());
startBtn.addEventListener("click", () => this.onMenuDown());
}
const creditsBtn = $menu("#menu-credits");
if (creditsBtn) {
if (this.creditsText()) {
creditsBtn.hidden = false;
creditsBtn.addEventListener("click", () => this.openCredits());
} else {
creditsBtn.hidden = true;
}
}
const achvBtn = $menu("#menu-achv");
if (achvBtn) {
achvBtn.hidden = false;
achvBtn.addEventListener("click", () => this.openAchv());
}
const rankBtn = $menu("#menu-rank");
if (rankBtn) {
rankBtn.hidden = false;
rankBtn.addEventListener("click", () => {
if (window.GameUI && window.GameUI.openRank) window.GameUI.openRank();
});
}
const loadBtn = $menu("#menu-load");
if (loadBtn) {
loadBtn.hidden = false;
loadBtn.addEventListener("click", () => this.openLoad());
}
for (const [boxSel, closeSel, openKey, closeFn] of [
["#credits-modal", "#credits-close", "creditsOpen", () => this.closeCredits()],
["#achv-modal", "#achv-close", "achvOpen", () => this.closeAchv()],
["#load-modal", "#load-close", "loadOpen", () => this.closeLoad()],
]) {
const box = $menu(boxSel);
if (!box) continue;
const closeBtn = $menu(closeSel);
if (closeBtn) closeBtn.addEventListener("click", closeFn);
box.addEventListener("click", (e) => { if (e.target === box) closeFn(); });
window.addEventListener("keydown", (e) => {
if (e.key !== "Escape" || !this[openKey]) return;
if (openKey === "achvOpen" && this._achvDetailOpen) { this.closeAchvDetail(); return; }
closeFn();
});
}
const achvDetail = $menu("#achv-wall-detail");
if (achvDetail) achvDetail.addEventListener("click", () => this.closeAchvDetail());
const loadBody = $menu("#load-body");
if (loadBody) {
loadBody.addEventListener("click", (e) => {
const page = e.target.closest("[data-load-page]");
if (page && !page.disabled) { this.loadGoto(Number(page.dataset.loadPage)); return; }
if (e.target.closest("[data-cloud-retry]")) { this.fetchLoadCloud(); return; }
if (e.target.closest("[data-load-cancel]")) { this.cancelLoadChoice(); return; }
const hit = e.target.closest("[data-load]");
if (hit) { this.pickLoad(hit.getAttribute("data-load")); return; }
const row = e.target.closest(".load-row");
if (row) this.pickLoad(row.getAttribute("data-key"));
});
}
document.addEventListener("visibilitychange", () => this.syncAnimation());
this.syncAnimation();
this.startMenuBgm();
},
applyTitle() {
const h1 = $menu(".menu-title");
if (!h1) return;
if (this.titleImg && this.titleImg.complete) {
h1.innerHTML = '<img class="menu-title-img" src="' + TITLE_IMG + '" alt="鲸鱼娘养成计划">';
}
},
animateTitle() {
const t = $menu(".menu-title");
if (!t) return;
t.classList.remove("menu-title-in");
void t.offsetWidth;
t.classList.add("menu-title-in");
},
GEO_TYPES: ["tri", "square", "x", "o"],
GEO_COLORS: { tri: "#f48fb1", square: "#a5d6a7", x: "#b39ddb", o: "#81c7f0" },
GEO_PERIOD: 7000,
initGeoShapes() {
this.geoShapes = [];
const step = Math.max(96, Math.min(this.W, this.H) / 6.5);
this.geoStep = step;
const P = Math.max(340, Math.round(step * 4 * Math.SQRT2));
this.geoTileW = P;
this.geoTileH = P;
for (let s = 0; s < 8; s++) {
for (let t = 0; t < 8; t++) {
if ((s + t) % 2 !== 0) continue;
const i = (s + t) / 2, j = (s - t) / 2;
const type = this.GEO_TYPES[((i % 4) + 4) % 4];
let seed = (i * 131 + j * 61 + 7) % 233280;
this.geoShapes.push({
type,
x: s * P / 8,
y: t * P / 8,
size: step * 0.30,
rot: -Math.PI / 4,
color: this.GEO_COLORS[type],
alpha: 0.30,
seed,
});
}
}
},
GEO_SWAY_MS: 700,
GEO_SWAY_ANGLE: 6 * Math.PI / 180,
bakeGeoLayer() {
this.geoFrames = [this.bakeGeoFrame(this.GEO_SWAY_ANGLE), this.bakeGeoFrame(-this.GEO_SWAY_ANGLE)];
this.geoLayer = this.geoFrames[0];
},
bakeGeoFrame(sway) {
const off = document.createElement("canvas");
off.width = Math.max(1, Math.round(this.geoTileW * this.dpr));
off.height = Math.max(1, Math.round(this.geoTileH * this.dpr));
const o = off.getContext("2d");
if (!o) return null;
o.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
for (const g of this.geoShapes) {
for (let dx = -1; dx <= 1; dx++) {
for (let dy = -1; dy <= 1; dy++) {
o.save();
o.translate(dx * this.geoTileW, dy * this.geoTileH);
this.drawGeoShape(o, g, sway);
o.restore();
}
}
}
return off;
},
drawGeoLayer(c, now) {
const frames = this.geoFrames;
if (!frames || !frames[0]) return;
const tile = frames[Math.floor(now / this.GEO_SWAY_MS) % frames.length] || frames[0];
const tw = this.geoTileW, th = this.geoTileH;
const s = ((now * this.geoStep) / this.GEO_PERIOD) % this.geoStep;
const ox = Math.round(Math.SQRT1_2 * s), oy = Math.round(-Math.SQRT1_2 * s);
for (let x = ox - tw; x < this.W; x += tw) {
for (let y = oy - th; y < this.H; y += th) {
c.drawImage(tile, x, y, tw, th);
}
}
},
GEO_STROKE_LAYERS: [
{ w: 13, a: 0.20 },
{ w: 10, a: 0.24 },
{ w: 7, a: 0.28 },
{ w: 4.5, a: 0.34 },
],
drawGeoShape(ctx, s, sway) {
let seed = s.seed;
const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
const strokeLayers = (drawPath) => {
for (const p of this.GEO_STROKE_LAYERS) {
ctx.strokeStyle = s.color;
ctx.lineWidth = p.w;
ctx.globalAlpha = s.alpha * p.a;
ctx.beginPath();
drawPath();
ctx.stroke();
}
};
const crayonStroke = (poly, close) => {
const last = close ? poly.length : poly.length - 1;
strokeLayers(() => {
for (let i = 0; i < last; i++) {
const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
const len = Math.hypot(dx, dy) || 1;
const nx = -dy / len, ny = dx / len;
const m1x = p1[0] + dx * 0.36 + nx * (rnd() - 0.5) * 3.2;
const m1y = p1[1] + dy * 0.36 + ny * (rnd() - 0.5) * 3.2;
const m2x = p1[0] + dx * 0.72 + nx * (rnd() - 0.5) * 3.2;
const m2y = p1[1] + dy * 0.72 + ny * (rnd() - 0.5) * 3.2;
ctx.moveTo(p1[0], p1[1]);
ctx.quadraticCurveTo(m1x, m1y, (m1x + m2x) / 2, (m1y + m2y) / 2);
ctx.quadraticCurveTo(m2x, m2y, p2[0], p2[1]);
}
});
};
ctx.save();
ctx.translate(s.x, s.y);
ctx.rotate((s.rot || 0) + (sway || 0));
ctx.lineCap = "round";
ctx.lineJoin = "round";
ctx.globalAlpha = s.alpha;
if (s.type === "x") {
crayonStroke([[-s.size, 0], [s.size, 0]], false);
crayonStroke([[0, -s.size], [0, s.size]], false);
} else if (s.type === "o") {
const n = 8;
const pts = [];
for (let i = 0; i < n; i++) {
const a = (Math.PI * 2 * i) / n - Math.PI / 2;
const rr = s.size * (1 + (rnd() - 0.5) * 0.10);
pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
}
const mids = pts.map((p, k) => {
const q = pts[(k + 1) % n];
return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
});
strokeLayers(() => {
ctx.moveTo(mids[n - 1][0], mids[n - 1][1]);
for (let k = 0; k < n; k++) ctx.quadraticCurveTo(pts[k][0], pts[k][1], mids[k][0], mids[k][1]);
});
} else {
const n = s.type === "tri" ? 3 : 4;
const pts = [];
for (let i = 0; i < n; i++) {
const a = (Math.PI * 2 * i) / n - Math.PI / 2;
pts.push([Math.cos(a) * s.size, Math.sin(a) * s.size]);
}
crayonStroke(pts, true);
}
ctx.restore();
},
updateGeoShapes() {},
clearMenuLayers(restore = true) {
const layers = this._menuLayers;
if (!layers) return;
this._menuLayers = null;
layers.figures.forEach((view) => { view.canvas.width = view.canvas.height = 1; });
layers.figures.clear();
layers.geos.forEach((node) => { node.style.backgroundImage = ""; });
layers.host.remove();
this.canvas.style.visibility = layers.originalVisibility;
if (restore) {
this.canvas.width = Math.round(this.W * this.dpr);
this.canvas.height = Math.round(this.H * this.dpr);
this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
}
},
prepareMenuLayers() {
this.clearMenuLayers();
if (!this.canvas.parentNode || !this.geoFrames || !this.geoFrames.length) return false;
try {
const urls = this.geoFrames.map((frame) => frame && frame.toDataURL());
if (urls.some((url) => typeof url !== "string" || !url.startsWith("data:image/"))) return false;
const host = document.createElement("div");
host.className = "menu-animation-layers";
host.setAttribute("aria-hidden", "true");
host.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1;";
const pad = Math.ceil((Math.ceil(this.geoStep * Math.SQRT1_2) + 1) * this.dpr) / this.dpr;
const geos = urls.map((url, i) => {
const node = document.createElement("div");
node.style.cssText = "position:absolute;left:-" + pad + "px;top:0;right:0;bottom:-" + pad
+ "px;pointer-events:none;will-change:transform;background-repeat:repeat;";
node.style.backgroundSize = this.geoTileW + "px " + this.geoTileH + "px";
node.style.backgroundPosition = pad + "px 0px";
node.style.backgroundImage = 'url("' + url + '")';
node.hidden = i !== 0;
host.appendChild(node); return node;
});
this.canvas.parentNode.insertBefore(host, this.canvas);
this._menuLayers = { host, geos, figures: new Map(), phase: -1, origin: "", frames: 0,
originalVisibility: this.canvas.style.visibility };
this.canvas.style.visibility = "hidden";
this.canvas.width = this.canvas.height = 1;
return true;
} catch (_) { this.clearMenuLayers(); return false; }
},
renderMenuLayers(now) {
const layers = this._menuLayers;
if (!layers) return false;
const phase = Math.floor(now / this.GEO_SWAY_MS) % layers.geos.length;
const s = ((now * this.geoStep) / this.GEO_PERIOD) % this.geoStep;
const ox = Math.round(Math.SQRT1_2 * s), oy = Math.round(-Math.SQRT1_2 * s);
if (layers.phase !== phase) { layers.geos.forEach((node, i) => { node.hidden = i !== phase; }); layers.phase = phase; }
const origin = ox + "," + oy;
if (layers.origin !== origin) { layers.geos.forEach((node) => { node.style.transform = "translate3d(" + ox + "px," + oy + "px,0)"; }); layers.origin = origin; }
const alive = new Set();
for (const f of this.fallers) {
alive.add(f);
let view = layers.figures.get(f);
if (!view) {
const radius = Math.hypot(this.spriteW(f) / 2, this.spriteH(f) * .54) + 3;
const edge = Math.ceil(radius) * 2, canvas = document.createElement("canvas");
canvas.width = canvas.height = Math.round(edge * this.dpr);
const cssEdge = canvas.width / this.dpr;
canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;will-change:transform;width:" + cssEdge + "px;height:" + cssEdge + "px;";
const ctx = canvas.getContext("2d");
if (!ctx) { this.clearMenuLayers(); return false; }
layers.host.appendChild(canvas); view = { canvas, ctx, edge }; layers.figures.set(f, view);
}
const px = Math.floor((f.x - view.edge / 2) * this.dpr), py = Math.floor((f.y - view.edge / 2) * this.dpr);
view.canvas.style.transform = "translate3d(" + px / this.dpr + "px," + py / this.dpr + "px,0)";
view.ctx.setTransform(1, 0, 0, 1, 0, 0);
view.ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);
view.ctx.setTransform(this.dpr, 0, 0, this.dpr, -px, -py);
this.drawWhale(view.ctx, f);
}
for (const [f, view] of layers.figures) if (!alive.has(f)) {
view.canvas.remove(); view.canvas.width = view.canvas.height = 1; layers.figures.delete(f);
}
layers.frames++;
return true;
},
releaseMenuArt() {
this.clearMenuLayers(false);
this.geoFrames = this.geoLayer = null;
this.fallers.length = this.whaleImgs.length = 0;
this.whaleImg = this.titleImg = null;
},
resize() {
if (this.started) return;
this.W = this.canvas.clientWidth || window.innerWidth;
this.H = this.canvas.clientHeight || window.innerHeight;
this.dpr = Math.min(2, window.devicePixelRatio || 1);
this.canvas.width = this.W * this.dpr;
this.canvas.height = this.H * this.dpr;
this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
this.computeMaxFallers();
this.initGeoShapes();
this.bakeGeoLayer();
this.prepareMenuLayers();
},
computeMaxFallers() {
const rowH = 66, colW = 71;
this.maxFallers = Math.min(120, Math.max(14, Math.floor((this.H / rowH) * (this.W / colW))));
},
creditsText() {
const pick = (o) => (o && o.UI_CFG && typeof o.UI_CFG.credits === "string") ? o.UI_CFG.credits : "";
return (pick(EXT_CFG) || pick(window.GameCfg) || "").trim();
},
escHtml(s) {
return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
},
mountCreditsPages(box, body) {
this.disposeCreditsPages();
const ui = window.GameUI, card = box.querySelector('.credits-card'), text = body.querySelector('.credits-text');
if (!ui || !ui.readNodePages || !card || !text) return;
const lines = text.textContent.split(/\r?\n/);
text.textContent = '';
const nodes = lines.map(line => {
const p = document.createElement('p'); p.className = 'credits-line'; p.textContent = line;
text.appendChild(p); return p;
});
const footer = document.createElement('div'); footer.className = 'credits-footer'; card.appendChild(footer);
card.classList.add('credits-paged');
const run = ui.readNodePages(body, footer, [{label:'制作组名单',parents:[text],units:nodes.map(n=>[n])}], 0);
const layout = run.layout;
run.layout = () => {
if (run.closed || !this.creditsOpen || !box.isConnected) return;
nodes.forEach(n=>n.hidden=false); text.hidden=false; card.style.height='';
const bs=window.getComputedStyle(box), cs=window.getComputedStyle(card), header=card.querySelector('.modal-header');
const outer=Math.max(120,(box.clientHeight || window.innerHeight)-parseFloat(bs.paddingTop || 0)-parseFloat(bs.paddingBottom || 0)-24);
const natural=(header ? header.offsetHeight : 0)+body.scrollHeight+footer.offsetHeight+parseFloat(cs.borderTopWidth || 0)+parseFloat(cs.borderBottomWidth || 0);
card.style.height=Math.min(outer,Math.max(120,natural))+'px';
layout();run.views.forEach(v=>v.label='制作组名单');run.show(run.page);
};
const dispose=run.dispose;run.dispose=()=>{dispose();footer.remove();card.classList.remove('credits-paged');card.style.height='';};
this._creditsPages=run;run.layout();
if(document.fonts && document.fonts.ready)document.fonts.ready.then(()=>{if(this._creditsPages===run&&!run.closed)run.layout();});
},
disposeCreditsPages() {
if(this._creditsPages)this._creditsPages.dispose();
this._creditsPages=null;
},
openCredits() {
const box = $menu("#credits-modal");
const body = $menu("#credits-body");
if (!box || !body) return;
const txt = this.creditsText();
if (!txt) return;
body.innerHTML = '<div class="credits-text">' + this.escHtml(txt) + "</div>";
box.hidden = false;
const card = box.querySelector(".credits-card");
if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
this.creditsOpen = true;
this.mountCreditsPages(box, body);
this.syncAnimation();
},
closeCredits() {
const box = $menu("#credits-modal");
if (!box) return;
this.disposeCreditsPages();
box.hidden = true;
this.creditsOpen = false;
this.syncAnimation();
},
achvCfgList() {
const pick = (o) => (o && Array.isArray(o.ACHIEVEMENTS)) ? o.ACHIEVEMENTS : null;
return pick(EXT_CFG) || pick(window.GameCfg) || [];
},
achvThumbMode() {
const w = window.innerWidth || 0, h = window.innerHeight || 0;
if (!w || !h) return false;
return Math.min(w, h) <= 560;
},
achvPageShape(hasEmpty, hasWarning) {
const w = window.innerWidth || 960, h = window.innerHeight || 768;
const portrait = h >= w, thumb = this.achvThumbMode();
const width = Math.min(w * (portrait ? .96 : .94), 960) - (portrait ? 24 : 36);
const columns = thumb ? Math.max(1, Math.min(8, Math.floor((width + 8) / 92))) : portrait ? 3 : 5;
const rowHeight = thumb ? 102 : (width - (columns - 1) * 10) / columns * 1.4;
const available = Math.min(h * (portrait ? .9 : .88), 672) - 52 - 32 - 28 - 44 - (hasEmpty ? 60 : 0) - (hasWarning ? 76 : 0);
const rows = Math.max(1, Math.floor((available + 8) / (rowHeight + 8)));
return { columns, size: columns * rows };
},
achvWallHtml() {
const UI = window.GameUI;
const store = window.AchieveStore;
const cfgList = this.achvCfgList();
if (!store || !UI || !UI.achvCardHtml) {
return '<div class="achv-wall-tip">成就系统未就绪（存储或渲染模块没加载？）。</div>';
}
if (!cfgList.length) return '<div class="achv-wall-tip">暂无成就配置。</div>';
const view = store.view(cfgList);
const st = store.stats(cfgList);
const got = view.filter((x) => !x.locked).sort((a, b) => (b.t || 0) - (a.t || 0));
const locked = view.filter((x) => x.locked);
const list = got.concat(locked);
this._achvView = list;
const empty = st.got === 0
? '<div class="achv-wall-tip">还没有解锁任何成就。回办公室，把模型做出来。</div>'
: "";
const warn = store.persistent() ? ""
: '<div class="achv-wall-tip warn">当前浏览器不允许本地存储（无痕模式？），本次会话的成就在关掉页面后会丢失。</div>';
const shape = this.achvPageShape(!!empty, !!warn);
const pages = Math.max(1, Math.ceil(list.length / shape.size));
this._achvPage = Math.max(0, Math.min(pages - 1, this._achvPage || 0));
this._achvPages = pages;
const cards = list.slice(this._achvPage * shape.size, (this._achvPage + 1) * shape.size)
.map((v) => UI.achvCardHtml(v, true, { locked: v.locked })).join("");
const thumb = this.achvThumbMode() ? " is-thumb" : "";
return '<div class="achv-wall-stats">已解锁 <b>' + st.got + '</b> / ' + st.total + '</div>'
+ empty + warn
+ '<div class="achv-wall' + thumb + '" style="--achv-page-cols:' + shape.columns + '">' + cards + '</div>'
+ '<nav class="achv-wall-pager" aria-label="成就分页"><button type="button" class="dg-btn dg-btn-sm" data-achv-page="-1"' + (this._achvPage === 0 ? ' disabled' : '') + '>上一页</button><span aria-live="polite">' + (this._achvPage + 1) + ' / ' + pages + '</span><button type="button" class="dg-btn dg-btn-sm" data-achv-page="1"' + (this._achvPage === pages - 1 ? ' disabled' : '') + '>下一页</button></nav>';
},
bindAchvTiles() {
const body = $menu("#achv-wall-body");
const wall = body && body.querySelector(".achv-wall.is-thumb");
if (body) body.querySelectorAll('[data-achv-page]').forEach(n => n.addEventListener('click', () => this.achvGoto(Number(n.dataset.achvPage))));
if (wall) wall.querySelectorAll(".achv-wrap").forEach((n) => {
n.addEventListener("click", () => this.openAchvDetail(n.getAttribute("data-key")));
});
},
achvGoto(delta) {
if (!this.achvOpen || !Number.isInteger(delta)) return;
this._achvPage = Math.max(0, Math.min((this._achvPages || 1) - 1, (this._achvPage || 0) + delta));
this.closeAchvDetail();
const body = $menu('#achv-wall-body');
if (!body) return;
body.innerHTML = this.achvWallHtml();
this.bindAchvTiles();
},
openAchvDetail(key) {
const v = (this._achvView || []).find((x) => x.key === key);
const box = $menu("#achv-wall-detail");
const UI = window.GameUI;
if (!v || !box || !UI || !UI.achvCardHtml) return;
box.innerHTML = UI.achvCardHtml(v, false, { locked: v.locked });
box.hidden = false;
this._achvDetailOpen = true;
},
closeAchvDetail() {
const box = $menu("#achv-wall-detail");
if (!box) return;
box.hidden = true;
box.innerHTML = "";
this._achvDetailOpen = false;
},
openAchv() {
const box = $menu("#achv-modal");
const body = $menu("#achv-wall-body");
if (!box || !body) return;
this._achvPage = 0;
body.innerHTML = this.achvWallHtml();
body.scrollTop = 0;
this.closeAchvDetail();
this.bindAchvTiles();
box.hidden = false;
const card = box.querySelector(".modal-card");
if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
this.achvOpen = true;
if (!this._achvResizeBound) {
this._achvResizeBound = true;
window.addEventListener('resize', () => { if (this.achvOpen) this.achvGoto(0); });
}
this.syncAnimation();
},
closeAchv() {
const box = $menu("#achv-modal");
if (!box) return;
this.closeAchvDetail();
box.hidden = true;
this.achvOpen = false;
this.syncAnimation();
},
loadCloudHtml() {
const st = this._loadCloud || { state: "loading" };
const retry = st.state !== "loading" && st.state !== "unsupported"
? ' <button class="load-btn is-ghost" type="button" data-cloud-retry="1">重新读取</button>' : "";
const head = '<div class="load-group">云端存档' + retry + '</div>';
if (st.state === "sdk-loading") return head + '<div class="load-tip">云服务正在加载，请稍后重试。</div>';
if (st.state === "sdk-failed") return head + '<div class="load-tip warn">云服务加载失败，可使用本地存档继续。</div>';
if (st.state === "loading") return head + '<div class="load-tip">正在读取云端存档…</div>';
if (st.state === "unsupported") {
return head + '<div class="load-tip">当前环境不支持云存档（不在 B站 Toy 平台内运行时没有云端）。</div>';
}
if (st.state === "none") return head + '<div class="load-tip">云端还没有存档。进游戏后进度会自动同步到云端。</div>';
if (st.state === "broken" || st.state === "error") {
const tc = window.ToyCloud;
const reason = st.reason || (st.state === "broken" ? "invalid-state" : "error");
const message = tc && tc.errorMessage ? tc.errorMessage(reason, st.code) : "云端读取失败，请稍后再试。";
return head + '<div class="load-tip warn">' + this.escHtml(message) + '</div>';
}
return head + this.loadRowHtml("cloud", "云端", st.snap, true);
},
loadRowHtml(key, badge, d, isCloud) {
this._loadRows.push({ key: key, snap: d });
const fresh = key.indexOf("empty_") === 0;
if (fresh) {
const text = window.GameCfg.UI_CFG.NEW_SAVE_SLOT, pending = this._loadPending === key;
const tail = pending ? '<span class="load-ask">' + this.escHtml(text.ASK) + '</span>'
+ '<button class="load-btn is-danger" type="button" data-load="' + key + '">' + this.escHtml(text.CONFIRM) + '</button>'
+ '<button class="load-btn is-ghost" type="button" data-load-cancel="1">' + this.escHtml(text.CANCEL) + '</button>'
: '<button class="load-btn" type="button" data-load="' + key + '">' + this.escHtml(text.NEW) + '</button>';
return '<div class="load-row is-empty' + (pending ? ' is-pending' : '') + '" data-key="' + key + '">'
+ '<span class="load-badge">' + this.escHtml(badge) + '</span><div class="load-main"><div class="load-name">' + this.escHtml(text.EMPTY_TITLE)
+ '</div><div class="load-sub">' + this.escHtml(text.EMPTY_DESC) + '</div></div><div class="load-tail">' + tail + '</div></div>';
}
const st = (d && d.state) || {};
const m = (d && d.meta) || {};
const ver = m.ver || st.ver || "V1";
const week = (m.week != null ? m.week : st.week) || 0;
const param = m.paramLabel || (st.paramTarget ? st.paramTarget + "B" : "未定");
const title = (d && d.name) || (ver + " · 第 " + week + " 周 · " + param);
const bits = [];
if (m.funding != null) bits.push("经费 " + Math.round(m.funding / 10000) + " 万");
if (m.brand != null) bits.push("品牌 " + m.brand);
const pending = this._loadPending === key;
const tail = pending
? '<span class="load-ask">覆盖本机自动存档并进入？</span>'
+ '<button class="load-btn is-danger" type="button" data-load="' + key + '">确认载入</button>'
+ '<button class="load-btn is-ghost" type="button" data-load-cancel="1">取消</button>'
: '<button class="load-btn" type="button" data-load="' + key + '">载入</button>';
return '<div class="load-row' + (isCloud ? " is-cloud" : "") + (pending ? " is-pending" : "")
+ '" data-key="' + key + '">'
+ '<span class="load-badge">' + this.escHtml(badge) + "</span>"
+ '<div class="load-main"><div class="load-name">' + this.escHtml(title) + "</div>"
+ '<div class="load-sub">' + this.escHtml(bits.join(" · ")) + "</div></div>"
+ '<div class="load-tail">' + tail + "</div>"
+ "</div>";
},
loadListHtml() {
this._loadRows = [];
const parts = [this.loadCloudHtml()];
const locals = [];
const save = window.GameSave;
if (save) {
const auto = save.load("auto");
if (auto) locals.push(this.loadRowHtml("auto", "自动", auto));
for (let i = 0; i < save.MAX_SLOTS; i++) {
const d = save.load(i);
if (d) locals.push(this.loadRowHtml("slot_" + i, "槽位 " + (i + 1), d));
else if (window.GameCfg?.UI_CFG?.NEW_SAVE_SLOT) locals.push(this.loadRowHtml("empty_" + i, "槽位 " + (i + 1), null));
}
const anchor = save.loadStage ? save.loadStage() : null;
if (anchor) locals.push(this.loadRowHtml("stage", "锚点", anchor));
}
if (locals.length) parts.push('<div class="load-group">本机存档</div>', locals.join(""));
else parts.push('<div class="load-tip">本机还没有存档。点「开始游戏」开一局，进度会自动保存。</div>');
if (this._loadError) parts.push('<div class="load-tip warn">' + this.escHtml(this._loadError) + "</div>");
parts.push('<div class="load-note">载入会用所选存档覆盖本机的自动存档进度，并立即进入该进度。'
+ "手动槽位与云端存档都不会被删除。</div>");
return parts.join("");
},
disposeLoadPages() {
if (this._loadPages) this._loadPages.dispose();
this._loadPages = null;
},
loadGoto(delta) {
const p = this._loadPages;
if (!p || !Number.isInteger(delta)) return;
p.show((this._loadPage || 0) + delta);
},
layoutLoadPages(body) {
const box = $menu('#load-modal'), card = box && box.querySelector('.load-card');
if (!body || body.nodeType !== 1 || !card || box.hidden) return;
const originals = Array.from(body.children), units = [];
const mask = document.createElement('div'), footer = document.createElement('footer');
mask.className = 'load-pages-mask'; footer.className = 'load-pages-footer';
const note = originals.find(n => n.classList.contains('load-note'));
if (note) footer.appendChild(note);
for (let i = 0; i < originals.length; i++) {
const n = originals[i]; if (n === note) continue;
const unit = document.createElement('div'); unit.className = 'load-page-unit';
unit.appendChild(n);
if (n.classList.contains('load-group') && originals[i + 1] && originals[i + 1] !== note) unit.appendChild(originals[++i]);
units.push(unit);
}
const nav = document.createElement('nav'); nav.className = 'load-pages-nav';
nav.setAttribute('aria-label', '存档分页');
nav.innerHTML = '<button type="button" class="load-btn is-ghost" data-load-page="-1">上一页</button><span aria-live="polite"></span><button type="button" class="load-btn is-ghost" data-load-page="1">下一页</button>';
footer.appendChild(nav); body.textContent = ''; body.classList.add('load-paged-body');
body.appendChild(mask); body.appendChild(footer);
const oldHeight = card.style.height, cs = getComputedStyle(card), bs = getComputedStyle(body);
const maxHeight = parseFloat(cs.maxHeight), vh = window.innerHeight || document.documentElement.clientHeight || 568;
card.style.height = Math.max(1, Math.min(vh - 16, Number.isFinite(maxHeight) ? maxHeight : vh - 16)) + 'px';
const padding = (parseFloat(bs.paddingTop) || 0) + (parseFloat(bs.paddingBottom) || 0);
const gap = parseFloat(bs.rowGap) || parseFloat(bs.gap) || 0;
const budget = Math.max(1, body.clientHeight - padding - footer.offsetHeight - gap);
const probe = document.createElement('div'); probe.className = 'load-pages-measure';
probe.setAttribute('aria-hidden', 'true'); probe.style.width = mask.clientWidth + 'px';
body.appendChild(probe);
const heights = [], rows = this._loadRows, pending = this._loadPending;
try {
units.forEach(unit => {
probe.appendChild(unit); let height = unit.offsetHeight;
unit.querySelectorAll('.load-row').forEach(row => {
const item = rows.find(r => r.key === row.dataset.key); if (!item) return;
this._loadRows = []; this._loadPending = item.key;
const test = document.createElement('div'); test.className = 'load-row-measure';
test.innerHTML = this.loadRowHtml(item.key, row.querySelector('.load-badge').textContent, item.snap, row.classList.contains('is-cloud'));
probe.appendChild(test); height += Math.max(0, test.firstElementChild.offsetHeight - row.offsetHeight); test.remove();
});
heights.push(height); unit.remove();
});
} finally { this._loadRows = rows; this._loadPending = pending; probe.remove(); }
const pages = []; let page, used = 0, maxPageHeight = 0, oversized = false;
units.forEach((unit, i) => {
const height = heights[i], next = used + (used ? gap : 0) + height;
if (!page || (used && next > budget + .5)) {
page = document.createElement('section'); page.className = 'load-page';
pages.push(page); mask.appendChild(page); used = 0;
}
used += (used ? gap : 0) + height; page.appendChild(unit);
maxPageHeight = Math.max(maxPageHeight, used); if (height > budget + .5) oversized = true;
});
if (!pages.length) { page = document.createElement('section'); page.className = 'load-page'; pages.push(page); mask.appendChild(page); }
mask.style.height = Math.min(budget, maxPageHeight) + 'px'; card.style.height = oldHeight;
nav.hidden = pages.length <= 1;
let frame = 0, disposed = false;
const show = value => {
if (disposed) return;
const index = Math.max(0, Math.min(pages.length - 1, Number.isInteger(value) ? value : 0));
this._loadPage = index; this._loadPageCount = pages.length;
pages.forEach((part, i) => { part.hidden = i !== index; });
nav.querySelector('[data-load-page="-1"]').disabled = index === 0;
nav.querySelector('[data-load-page="1"]').disabled = index === pages.length - 1;
nav.querySelector('span').textContent = (index + 1) + ' / ' + pages.length;
};
const resize = () => {
if (disposed || !this.loadOpen || box.hidden) return;
if (frame) cancelAnimationFrame(frame);
frame = requestAnimationFrame(() => { frame = 0; if (!disposed && this.loadOpen && !box.hidden) this.renderLoadBody(); });
};
const dispose = () => { if (disposed) return; disposed = true; window.removeEventListener('resize', resize); if (frame) cancelAnimationFrame(frame); frame = 0; };
this._loadPages = { pages, mask, footer, budget, oversized, show, dispose };
show(this._loadPage || 0); window.addEventListener('resize', resize);
},
renderLoadBody() {
const body = $menu("#load-body");
if (!body) return;
this.disposeLoadPages();
body.innerHTML = this.loadListHtml();
this.layoutLoadPages(body);
body.scrollTop = 0;
},
holdLoadCloud() {
if (this._loadRestoreCloud) return;
const tc = window.ToyCloud;
if (tc && tc.beginRestore) { tc.beginRestore(); this._loadRestoreCloud = tc; }
},
releaseLoadCloud() {
const tc = this._loadRestoreCloud;
this._loadRestoreCloud = null;
if (tc && tc.endRestore) tc.endRestore();
},
cancelLoadChoice() {
this._loadChoiceRevision = (this._loadChoiceRevision || 0) + 1;
this._loadPending = null;
if (!this._loadFetchBusy) this.releaseLoadCloud();
this.renderLoadBody();
},
fetchLoadCloud() {
if (this._loadFetchBusy || !this.loadOpen) return;
const tc = window.ToyCloud;
const tok = (this._loadToken || 0) + 1;
this._loadToken = tok;
this._loadPending = null;
this._loadCloud = { state: "loading" };
if (!tc || !tc.available()) {
this.releaseLoadCloud();
this._loadCloud = { state: "unsupported" };
const health = window.BootHealth;
let platform = false;
try { platform = !!window.parent && window.parent !== window; } catch (e) { platform = true; }
const toyId = Number((window.__TOY_META__ || {}).toy_id);
if (Number.isSafeInteger(toyId) && toyId > 0) platform = true;
if (platform && health && typeof health.sdkState === "function") {
const sdk = health.sdkState();
if (sdk === "loading" || sdk === "failed") this._loadCloud = { state: "sdk-" + sdk };
}
this.renderLoadBody();
return;
}
this._loadFetchBusy = true;
this.holdLoadCloud();
this.renderLoadBody();
return Promise.resolve().then(() => tc.fetchCloudSnapshot()).then((r) => {
if (tok !== this._loadToken || !this.loadOpen) return;
if (r && r.obj) {
this._loadCloud = { state: "ok", snap: r.obj };
} else {
const why = (r && r.reason) || "error";
this._loadCloud = { state: why === "no-meta" ? "none" : "error", reason: why, code: r && r.code };
this.releaseLoadCloud();
}
this.renderLoadBody();
}).catch(() => {
if (tok !== this._loadToken || !this.loadOpen) return;
this._loadCloud = { state: "error", reason: "error" };
this.releaseLoadCloud();
this.renderLoadBody();
}).finally(() => { if (tok === this._loadToken) this._loadFetchBusy = false; });
},
openLoad() {
if (this.loadOpen) return;
const box = $menu("#load-modal");
const body = $menu("#load-body");
if (!box || !body) return;
this._loadPending = null;
this._loadError = "";
this.renderLoadBody();
box.hidden = false;
const card = box.querySelector(".load-card");
if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
this.loadOpen = true;
this._loadPage = 0;
this.renderLoadBody();
this.syncAnimation();
this.fetchLoadCloud();
},
closeLoad() {
this.disposeLoadPages();
const box = $menu("#load-modal");
if (box) box.hidden = true;
this._loadToken = (this._loadToken || 0) + 1;
this._loadFetchBusy = false;
this._loadPending = null;
this.loadOpen = false;
this.releaseLoadCloud();
this.syncAnimation();
},
pickLoad(key) {
if (key === "cloud") this.holdLoadCloud();
else if (!this._loadFetchBusy) this.releaseLoadCloud();
if (this._loadPending === key) { this.confirmLoad(key); return; }
this._loadChoiceRevision = (this._loadChoiceRevision || 0) + 1;
this._loadError = "";
this._loadPending = key;
this.renderLoadBody();
},
async confirmLoad(key) {
if (this._newSlotBusy) return;
const row = (this._loadRows || []).filter((x) => x.key === key)[0];
this._loadPending = null;
const save = window.GameSave;
if (key.indexOf("empty_") === 0) {
if (this.started || !this.loadOpen || !row || this._newSlotBusy) return;
const text = window.GameCfg.UI_CFG.NEW_SAVE_SLOT;
const token = this._loadToken, choice = this._loadChoiceRevision;
this._loadPending = key;
this._newSlotBusy = true;
let result;
try {
await window.GameCfg.loadExternal();
if (token !== this._loadToken || choice !== this._loadChoiceRevision || !this.loadOpen || this.started) return;
result = save?.createNewSlot(Number(key.slice(6)), window.GameCore);
} catch (_) { result = { ok: false }; }
finally { this._newSlotBusy = false; }
if (!result?.ok) {
this._loadError = result?.reason === "occupied" ? text.OCCUPIED : text.FAILED;
this.renderLoadBody(); return;
}
if (window.GameUI?.core) window.GameUI.resetOmTestChat();
this.closeLoad(); this.startGame(); return;
}
if (!row || !row.snap) { this._loadError = "这个存档读不出来，已跳过。"; this.renderLoadBody(); return; }
if (!save || !save.writeSnapshot) { this._loadError = "存档模块未就绪。"; this.renderLoadBody(); return; }
if (key === "cloud") {
this.holdLoadCloud();
let result;
try { result = save.restoreSnapshot ? save.restoreSnapshot(row.snap, window.GameCore) : { ok: false, reason: "unavailable" }; }
catch (_) { result = { ok: false, reason: "load-error" }; }
if (!result.ok) {
const tc = window.ToyCloud;
this._loadError = tc && tc.errorMessage ? tc.errorMessage(result.reason) : "云端存档无法载入，本机进度已保留。";
this.releaseLoadCloud();
this.renderLoadBody();
return;
}
const tc=window.ToyCloud;if(tc&&tc.acceptCloudRestore)tc.acceptCloudRestore(row.snap);
} else if (!save.writeSnapshot("auto", row.snap)) {
this._loadError = "写入本地存档失败（浏览器可能禁用了本地存储）。";
this.renderLoadBody();
return;
}
this.closeLoad();
this.startGame();
},
async startMenuBgm() {
if (this.menuBgmStarted) return;
const ok = await AudioMgr.playBgm(MENU_BGM_URL);
if (ok) this.menuBgmStarted = true;
},
onMenuDown() {
AudioMgr.resume();
if (this.started) return;
this.startGame();
},
animationBlocked() {
return !this._entered || this.started || document.hidden || this.creditsOpen
|| this.achvOpen || this.loadOpen || !!(window.GameUI && window.GameUI._rankMask);
},
syncAnimation() {
if (this.animationBlocked()) {
if (this._frame) cancelAnimationFrame(this._frame);
this._frame = 0;
return;
}
if (this._frame) return;
this._last = performance.now();
this._frame = requestAnimationFrame((t) => this.loop(t));
},
loop(now) {
this._frame = 0;
if (this.animationBlocked()) return;
try {
const dt = Math.min(0.05, (now - this._last) / 1000);
this._last = now;
this.update(dt);
this.render(now);
} catch (e) { console.error("Menu loop:", e); }
if (!this.animationBlocked()) this._frame = requestAnimationFrame((t) => this.loop(t));
},
update(dt) {
this._time += dt;
this.updateSpawner(dt);
this.moveFallers(dt);
this.separateCollisions();
this.updateGeoShapes(dt);
},
updateSpawner(dt) {
if (this.phase === "drain") {
if (this.fallers.length === 0) {
this.phase = "grow";
this.growth = 0;
this.spawnRate = 0.9;
this.spawnAcc = 0;
}
return;
}
this.growth = Math.min(1, this.fallers.length / this.maxFallers);
this.spawnRate = 1.1 + this.growth * 16;
this.spawnAcc += this.spawnRate * dt;
while (this.spawnAcc >= 1) {
this.spawnAcc -= 1;
this.spawnFall(false);
}
if (this.fallers.length >= this.maxFallers || (this.growth >= 1 && this._time > 2.5)) {
this.phase = "drain";
}
},
spriteH(f) { return 120 * f.s; },
spriteW(f) {
const dh = this.spriteH(f);
const img = f.img || this.whaleImg;
return img ? dh * (img.width / img.height) : dh * 0.72;
},
spawnFall(initial) {
const s = 0.55 + Math.random() * 0.5;
const img = this.whaleImgs.length ? this.whaleImgs[Math.floor(Math.random() * this.whaleImgs.length)] : this.whaleImg;
const w = this.spriteW({ s, img });
const r = w * 0.46;
const x = r + Math.random() * (this.W - 2 * r);
const y = initial ? Math.random() * this.H * 0.4 : -(this.spriteH({ s }) / 2 + 40) - Math.random() * 60;
this.fallers.push({
x, y, r, s, img,
vy: 8 + Math.random() * 15,
vx: (Math.random() - 0.5) * 12,
rot: (Math.random() - 0.5) * 0.3,
vr: (Math.random() - 0.5) * 0.25,
wob: Math.random() * Math.PI * 2,
wobAmp: 6 + Math.random() * 10,
wobV: 0.5 + Math.random() * 1.2,
bounce: 0,
resting: false,
});
},
moveFallers(dt) {
const grow = this.phase === "grow";
const keep = [];
for (const f of this.fallers) {
f.wob += f.wobV * dt;
f.x += (f.vx + Math.sin(f.wob) * f.wobAmp) * dt;
if (grow && f.resting) {
f.vy = 0;
} else {
f.vy = Math.min(f.vy + FALL_G * dt, FALL_TERM);
f.y += f.vy * dt;
}
f.rot += f.vr * dt;
if (f.x < f.r) f.x = f.r;
if (f.x > this.W - f.r) f.x = this.W - f.r;
if (grow) {
const feet = f.y + this.spriteH(f) / 2;
if (feet >= this.H) {
f.y = this.H - this.spriteH(f) / 2;
if (f.bounce < 2) {
f.bounce++;
f.vy = -Math.min(320, Math.max(90, f.vy * 0.4));
f.resting = false;
} else {
f.vy = 0;
f.resting = true;
}
}
}
if (f.y - this.spriteH(f) / 2 < this.H + 70) keep.push(f);
}
this.fallers = keep;
},
separateCollisions() {
const fs = this.fallers;
const drain = this.phase === "drain";
for (let i = 0; i < fs.length; i++) {
const a = fs[i];
for (let j = i + 1; j < fs.length; j++) {
const b = fs[j];
const dx = b.x - a.x, dy = b.y - a.y;
const d = Math.hypot(dx, dy);
const minD = a.r + b.r;
if (d < 0.001 || d >= minD) continue;
if (drain) {
const push = (minD - d) / 2;
const nx = dx / d, ny = dy / d;
a.x -= nx * push; a.y -= ny * push;
b.x += nx * push; b.y += ny * push;
} else if (a.resting && !b.resting) {
b.y = a.y - (a.r + b.r) * 0.86;
if (b.vy > 0 && b.bounce < 2) {
b.bounce++;
b.vy = -Math.min(280, Math.max(70, b.vy * 0.4));
b.resting = false;
} else {
if (b.vy > 0) b.vy = 0;
b.resting = true;
}
const nx = dx / d;
b.x += nx * (minD - d) * 0.6;
} else if (b.resting && !a.resting) {
a.y = b.y - (a.r + b.r) * 0.86;
if (a.vy > 0 && a.bounce < 2) {
a.bounce++;
a.vy = -Math.min(280, Math.max(70, a.vy * 0.4));
a.resting = false;
} else {
if (a.vy > 0) a.vy = 0;
a.resting = true;
}
const nx = dx / d;
a.x -= nx * (minD - d) * 0.6;
} else if (a.resting && b.resting) {
const push = (minD - d) / 2;
const nx = dx / d;
a.x -= nx * push; b.x += nx * push;
} else {
const push = (minD - d) / 2;
const nx = dx / d, ny = dy / d;
a.x -= nx * push; a.y -= ny * push;
b.x += nx * push; b.y += ny * push;
}
if (a.x < a.r) a.x = a.r; if (a.x > this.W - a.r) a.x = this.W - a.r;
if (b.x < b.r) b.x = b.r; if (b.x > this.W - b.r) b.x = this.W - b.r;
}
}
},
render(now) {
if (this.renderMenuLayers(now || performance.now())) return;
const c = this.ctx;
c.clearRect(0, 0, this.W, this.H);
this.drawGeoLayer(c, now || performance.now());
for (const f of this.fallers) this.drawWhale(c, f);
},
drawWhale(c, f) {
if (!this.whaleLoaded) return;
const img = f.img || this.whaleImg;
if (!img) return;
const dh = this.spriteH(f);
const dw = this.spriteW(f);
c.save();
c.translate(f.x, f.y);
c.rotate(f.rot);
c.globalAlpha = 0.14;
c.fillStyle = "#0a3f6e";
c.beginPath();
c.ellipse(0, dh * 0.44, dw * 0.4, dh * 0.1, 0, 0, Math.PI * 2);
c.fill();
c.globalAlpha = 1;
c.drawImage(img, -dw / 2, -dh / 2, dw, dh);
c.restore();
},
startGame() {
if (this.started) return;
this.started = true;
this.syncAnimation();
setTimeout(() => { if (this.started) this.releaseMenuArt(); }, 600);
this.menuBgmStarted = true;
AudioMgr.want = null;
AudioMgr.seq++;
AudioMgr.stopBgm();
AudioMgr.resume();
AudioMgr.playBgm(SCENE_BGM_URL);
const m = $menu("#menu");
m.style.pointerEvents = "none";
const tr = $menu("#transition");
if (tr) {
tr.style.opacity = "1";
setTimeout(() => {
m.classList.add("hide"); m.hidden = true;
try {
if (window.Training) window.Training.open();
} finally {
tr.style.opacity = "0";
}
}, 330);
} else {
if (window.Training) window.Training.open();
m.style.opacity = "0";
setTimeout(() => { m.classList.add("hide"); m.hidden = true; }, 560);
}
},
};
window.Menu = Menu;
window.addEventListener("DOMContentLoaded", () => Menu.boot());
