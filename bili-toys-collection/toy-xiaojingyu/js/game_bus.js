
(function () {
if (window.GameBus) return;
const subs = Object.create(null);
const GameBus = {
on(type, fn) {
(subs[type] || (subs[type] = [])).push(fn);
return () => this.off(type, fn);
},
off(type, fn) {
const list = subs[type];
if (!list) return;
const i = list.indexOf(fn);
if (i >= 0) list.splice(i, 1);
},
once(type, fn) {
const off = this.on(type, (p) => { off(); fn(p); });
return off;
},
emit(type, payload) {
const list = subs[type];
if (!list || !list.length) return;
for (const fn of list.slice()) {
try { fn(payload || {}); } catch (e) { console.warn("[GameBus] " + type + " 订阅方出错", e); }
}
},
};
function wrapUi() {
const ui = window.GameUI;
if (!ui || typeof ui.onClick !== "function" || ui.__busWrapped) return !!(ui && ui.__busWrapped);
const orig = ui.onClick;
ui.onClick = function (e) {
const r = orig.apply(this, arguments);
try {
const t = e && e.target && e.target.closest && e.target.closest("[data-action]");
if (t) GameBus.emit("ui:action", { action: t.dataset.action, id: t.dataset.id, el: t });
} catch (err) { }
return r;
};
ui.__busWrapped = true;
return true;
}
let last = { absWeek: null, ver: null, phase: null, state: null };
function poll(force) {
wrapUi();
if (!force && document.visibilityState === "hidden") return;
const ui = window.GameUI;
const s = ui && ui.core && ui.core.state;
if (!s) return;
if (last.state !== s) {
last = { absWeek: null, ver: null, phase: null, state: s };
}
const absWeek = (s.week || 0) + (s.weekOffset || 0);
const ver = s.ver || "V1";
if (last.phase !== s.phase) {
const prev = last.phase; last.phase = s.phase;
if (prev !== null) GameBus.emit("phase", { phase: s.phase, prev });
}
if (last.ver !== ver) {
const prev = last.ver; last.ver = ver;
if (prev !== null) GameBus.emit("stage:start", { ver, prev });
}
if (last.absWeek !== absWeek) {
const prev = last.absWeek; last.absWeek = absWeek;
if (prev !== null && absWeek > prev) GameBus.emit("week:start", { absWeek, ver });
}
}
GameBus._poll = () => poll(true);
GameBus._wrapUi = wrapUi;
window.GameBus = GameBus;
wrapUi();
if (typeof setInterval === "function" && !window.__GAMEBUS_NO_TIMER) {
const iv = setInterval(() => poll(false), 1000);
if (iv && typeof iv.unref === "function") iv.unref();
}
})();
