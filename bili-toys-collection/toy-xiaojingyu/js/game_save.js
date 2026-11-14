
"use strict";
window.GameSave = {
SAVE_VERSION: 6,
KEY_PREFIX: "whale_dev_v35_",
AUTO_KEY: "whale_dev_v35_auto",
STAGE_KEY: "whale_dev_v35_stage",
MAX_SLOTS: 8,
migrate(d) {
if (!d || typeof d !== "object") return d;
const v = Number(d.saveVersion) || 0;
let st = d.state;
if (!st || typeof st !== "object") return d;
if (v < 1) {
if (st.v35 && typeof st.v35 === "object") {
const e = st.v35;
if (e.stageStart == null) e.stageStart = window.V35.dimObj(0);
if (e.extraPre == null) e.extraPre = 0;
if (e.extraPost == null) e.extraPost = 0;
if (e.extraData == null) e.extraData = 0;
if (e.paper && e.paper.kind == null) e.paper.kind = "text_prob";
if (e.focusEverUsed == null) e.focusEverUsed = false;
if (e.lvShift == null) e.lvShift = 0;
if (e.corpus && !e.corpus.q) {
const I = e.corpus.items || 0, T = e.corpus.token || 0;
let n = Math.round(2 * (I - T)), g = Math.round(2 * T - I);
n = Math.max(0, Math.min(I, n)); g = Math.max(0, Math.min(I - n, g));
e.corpus.q = [n, g, 0];
}
}
if (!Array.isArray(st.triggered)) st.triggered = st.triggered || [];
if (!Array.isArray(st.pending)) st.pending = st.pending || [];
if (!Array.isArray(st.engineers)) st.engineers = st.engineers || [];
if (!Array.isArray(st.ownedGpus)) st.ownedGpus = st.gpuTier ? [st.gpuTier] : [];
if (st.officePaused === undefined) st.officePaused = false;
if (st.usersMigrated === undefined) st.usersMigrated = true;
}
if (v < 2) {
if (st.chatNode == null) st.chatNode = null;
if (!Array.isArray(st.notebook)) st.notebook = [];
if (st._lastReplyIdx == null) st._lastReplyIdx = {};
}
if (v < 3) {
for (const e of (st.engineers || [])) {
if (e && e.stats) { delete e.stats.coop; delete e.stats.energy; }
}
}
if (v < 4) {
const r = st.result;
const order = (window.GameCfg && window.GameCfg.VER_ORDER) || [];
const last = "V4.5";
const vd = r && r.verdict;
const passLike = vd === "pass" || vd === "excellent" || vd === "top";
if (r && last && st.ver === last && passLike && !r.nextVer && !r.retry) {
r.finalRepeat = true;
if (st.phase === "over" && st.bonus && typeof st.bonus === "object") {
st.phase = "bonus";
st.bonusAct = 4;
}
}
}
if (v < 5) {
for (const e of (st.engineers || [])) {
if (!e || !e.stats) continue;
for (const k of Object.keys(e.stats)) {
const x = e.stats[k];
if (typeof x === "number" && isFinite(x)) e.stats[k] = Math.max(0, Math.min(100, x));
}
}
}
if (v < 6) {
if (!st.embodiedEra) st.embodiedEra = {schema:1,status:"locked",entered:false,mentorGranted:false,bodyAwakened:false,podExitSeen:false,tutorialStep:0};
const r = st.result;
if (st.ver === "V4.5" && r && (r.settled || st.phase === "bonus" || st.phase === "over") && ["pass", "excellent", "top"].includes(r.verdict)
&& !r.retry && !r.missionFail && !(st.mission && st.mission.hit === false)) {
r.nextVer = "V5"; r.finalRepeat = false; st.embodiedEra.status = "intro";
if (st.phase === "over" && st.bonus) { st.phase = "bonus"; st.bonusAct = 4; }
}
}
const order = (window.GameCfg && window.GameCfg.VER_ORDER) || [];
const index = order.indexOf(st.ver), r = st.result;
if (r && (!r.nextVer || r.finalRepeat) && index >= 0 && index < order.length - 1
&& (r.settled || st.phase === "bonus" || st.phase === "over")
&& ["pass", "excellent", "top"].includes(r.verdict)
&& !r.retry && !r.missionFail && !r.qualificationFailed
&& (r.missionFail === false || !(st.mission && st.mission.hit === false))) {
r.nextVer = order[index + 1]; r.finalRepeat = false;
if (st.bonus) st.bonus.nextVer = r.nextVer;
if (st.phase === "over" && st.bonus) { st.phase = "bonus"; st.bonusAct = 4; }
}
d.saveVersion = this.SAVE_VERSION;
return d;
},
slotKey(i) { return this.KEY_PREFIX + "slot_" + i; },
save(slot, state) {
const snap = this.buildSnapshot(state);
try {
if (slot === "auto") localStorage.setItem(this.AUTO_KEY, JSON.stringify(snap));
else localStorage.setItem(this.slotKey(slot), JSON.stringify(snap));
this._notifyCloud(slot, snap, false);
return snap;
} catch (e) { return null; }
},
_notifyCloud(slot, snap, force) {
const tc = window.ToyCloud;
if (!tc || !snap) return;
try {
const p = force ? tc.flush(snap) : tc.onLocalSaved(slot, snap);
if (p && typeof p.catch === "function") p.catch(function () {});
} catch (e) { }
},
autoSave(state) { return this.save("auto", state); },
createNewSlot(slot, core) {
if (!Number.isInteger(slot) || slot < 0 || slot >= this.MAX_SLOTS || !core?.newState)
return { ok: false, reason: "unavailable" };
const key = this.slotKey(slot), written = [];
try {
if (localStorage.getItem(key) !== null) return { ok: false, reason: "occupied" };
const factory = Object.create(core);
factory.cfg = core.cfg || window.GameCfg;
const state = factory.newState(), snapshot = this.buildSnapshot(state), raw = JSON.stringify(snapshot);
for (const target of [key, this.STAGE_KEY, this.AUTO_KEY]) {
const before = localStorage.getItem(target);
localStorage.setItem(target, raw);
written.push({ target, before });
}
core.state = state;
return { ok: true, snapshot };
} catch (_) {
for (const { target, before } of written.reverse()) {
try { if (before === null) localStorage.removeItem(target); else localStorage.setItem(target, before); } catch (_) {}
}
return { ok: false, reason: "storage-error" };
}
},
parse(raw) {
if (!raw) return null;
try {
const d = (typeof raw === "string") ? JSON.parse(raw) : raw;
if (!d || !d.state) return null;
if (!d.state.v35) return null;
this.migrate(d);
return d;
} catch (e) { return null; }
},
restoreSnapshot(raw, core) {
if (this._snapshotRestoring) return { ok: false, reason: "busy" };
if (!core || typeof core.loadState !== "function") return { ok: false, reason: "unavailable" };
const record = value => !!value && typeof value === "object" && !Array.isArray(value);
let snap;
try { snap = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)); }
catch (e) { return { ok: false, reason: "invalid-snapshot" }; }
if (!record(snap) || !record(snap.state)) return { ok: false, reason: "invalid-snapshot" };
const version = Number(snap.saveVersion || 0);
if (!Number.isSafeInteger(version) || version < 0 || version > this.SAVE_VERSION)
return { ok: false, reason: "unsupported-version", version: snap.saveVersion };
const cfg = core.cfg || window.GameCfg;
if (!cfg || !Array.isArray(cfg.VER_ORDER)) return { ok: false, reason: "unavailable" };
const st = snap.state;
if (st.ver != null && cfg.VER_ORDER.indexOf(st.ver) < 0)
return { ok: false, reason: "unsupported-stage", stage: st.ver };
if (st.phase != null && !["naming", "office", "review", "bonus", "over", "loop", "minigame", "recruit", "buygpu", "direction", "evalshow"].includes(st.phase))
return { ok: false, reason: "invalid-state", field: "phase" };
if (!record(st.v35)) return { ok: false, reason: "invalid-state", field: "v35" };
for (const key of ["engineers", "candidates", "triggered", "pending"]) {
if (st[key] != null && !Array.isArray(st[key])) return { ok: false, reason: "invalid-state", field: key };
}
for (const key of ["engineers", "candidates"]) {
for (const e of st[key] || []) {
if (!record(e) || (e.stats != null && !record(e.stats)) || (e.traits != null && !Array.isArray(e.traits)))
return { ok: false, reason: "invalid-state", field: key };
}
}
if (st.v35.weekly != null && !Array.isArray(st.v35.weekly))
return { ok: false, reason: "invalid-state", field: "v35.weekly" };
for (const key of ["energy", "stats", "quota", "focus", "paper", "corpus"]) {
if (st.v35[key] != null && !record(st.v35[key])) return { ok: false, reason: "invalid-state", field: "v35." + key };
}
const parsed = this.parse(snap);
if (!parsed) return { ok: false, reason: "invalid-state" };
const previousState = core.state, previousCfg = core.cfg, pending = new Map();
const original = {}, save = this, tc = window.ToyCloud;
let guarded = false, committed = false;
const slotKey = slot => slot === "auto" ? save.AUTO_KEY : save.slotKey(slot);
const clone = value => JSON.parse(JSON.stringify(value));
const slotRead = this.load.bind(this);
const replace = (key, fn) => { original[key] = this[key]; this[key] = fn; };
this._snapshotRestoring = true;
try {
if (tc && typeof tc.beginRestore === "function" && typeof tc.endRestore === "function") {
tc.beginRestore(); guarded = true;
}
replace("_notifyCloud", () => {});
replace("save", function (slot, state) {
const value = save.buildSnapshot(state); pending.set(slotKey(slot), value); return value;
});
replace("writeSnapshot", function (slot, value) {
if (!value || !value.state) return false;
pending.set(slotKey(slot), clone(value)); return true;
});
replace("saveStage", function (state) {
const value = save.buildSnapshot(state); pending.set(save.STAGE_KEY, value); return value;
});
replace("load", function (slot) {
const key = slotKey(slot);
return pending.has(key) ? save.parse(clone(pending.get(key))) : slotRead(slot);
});
replace("loadStage", function () {
return pending.has(save.STAGE_KEY) ? save.parse(clone(pending.get(save.STAGE_KEY))) : null;
});
if (typeof this.patchStageBodyCalendar === "function") replace("patchStageBodyCalendar", function (state) {
if (!state || !state.bodyCalendar) return false;
const anchor = save.loadStage();
if (!anchor || !anchor.state || anchor.state.stageNo !== state.stageNo || anchor.state.ver !== state.ver) return false;
anchor.state.bodyCalendar = clone(state.bodyCalendar); pending.set(save.STAGE_KEY, anchor); return true;
});
core.cfg = cfg;
core.loadState(parsed.state);
const normalized = this.buildSnapshot(core.state);
const automaticRaw = JSON.stringify(normalized);
const stageRaw = pending.has(this.STAGE_KEY) ? JSON.stringify(pending.get(this.STAGE_KEY)) : null;
try { localStorage.setItem(this.AUTO_KEY, automaticRaw); }
catch (e) { return { ok: false, reason: "storage-error" }; }
committed = true;
let stageSaved = true, stageRemoved = false;
if (stageRaw != null) {
try { localStorage.setItem(this.STAGE_KEY, stageRaw); }
catch (e) {
stageSaved = false;
try { localStorage.removeItem(this.STAGE_KEY); stageRemoved = true; }
catch (removeError) {}
}
}
return { ok: true, reason: "restored", snapshot: normalized, stageSaved, stageRemoved };
} catch (e) {
return { ok: false, reason: "load-error", detail: String(e && e.message || e) };
} finally {
for (const key of Object.keys(original)) this[key] = original[key];
if (!committed) { core.state = previousState; core.cfg = previousCfg; }
this._snapshotRestoring = false;
if (guarded) { try { tc.endRestore(); } catch (e) {} }
}
},
writeSnapshot(slot, snap) {
if (!snap || !snap.state) return false;
try {
if (slot === "auto") localStorage.setItem(this.AUTO_KEY, JSON.stringify(snap));
else localStorage.setItem(this.slotKey(slot), JSON.stringify(snap));
return true;
} catch (e) { return false; }
},
load(slot) {
try {
const raw = slot === "auto" ? localStorage.getItem(this.AUTO_KEY)
: localStorage.getItem(this.slotKey(slot));
const d = this.parse(raw);
if (!d) return null;
d.state.hireCandidate = null;
return d;
} catch (e) { return null; }
},
remove(slot) {
try {
if (slot === "auto") localStorage.removeItem(this.AUTO_KEY);
else localStorage.removeItem(this.slotKey(slot));
} catch (e) {}
},
saveStage(state) {
const snap = this.buildSnapshot(state);
try {
localStorage.setItem(this.STAGE_KEY, JSON.stringify(snap));
this._notifyCloud("stage", snap, true);
return snap;
} catch (e) { return null; }
},
loadStage() {
try { return this.parse(localStorage.getItem(this.STAGE_KEY)); }
catch (e) { return null; }
},
patchStageBodyCalendar(state) {
if (!state || !state.bodyCalendar) return false;
try {
const raw = localStorage.getItem(this.STAGE_KEY);
if (!raw) return false;
const snap = JSON.parse(raw), anchor = snap && snap.state;
if (!anchor || anchor.stageNo !== state.stageNo || anchor.ver !== state.ver) return false;
if (JSON.stringify(anchor.bodyCalendar) === JSON.stringify(state.bodyCalendar)) return false;
anchor.bodyCalendar = JSON.parse(JSON.stringify(state.bodyCalendar));
localStorage.setItem(this.STAGE_KEY, JSON.stringify(snap));
return true;
} catch (e) { return false; }
},
clearStage() {
try { localStorage.removeItem(this.STAGE_KEY); } catch (e) {}
},
list() {
const out = [];
for (let i = 0; i < this.MAX_SLOTS; i++) {
const d = this.load(i);
if (d) out.push({ slot: i, ...d, isAuto: false });
}
const a = this.load("auto");
if (a) out.push({ slot: "auto", ...a, isAuto: true });
out.sort((x, y) => {
if (x.isAuto && !y.isAuto) return -1;
if (!x.isAuto && y.isAuto) return 1;
return (typeof x.slot === "number" ? x.slot : -1) - (typeof y.slot === "number" ? y.slot : -1);
});
return out;
},
buildSnapshot(state) {
const s = state;
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const timeStr = `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
const param = s.paramTarget ? s.paramTarget + "B" : "未定";
const ver = s.ver || "V1";
return {
saveVersion: this.SAVE_VERSION,
name: `${ver} · 第 ${s.week} 周 · ${param} · ${timeStr}`,
time: now.toISOString(),
state: this.clone(s),
meta: {
ver: ver,
week: s.week,
param: s.paramTarget || 0,
paramLabel: param,
funding: s.funding,
brand: s.brand,
reputation: s.reputation,
parallelCount: s.parallel ? 2 : 1,
...window.V35.dimsOf(s).reduce((o, k) => (o[k] = s[k], o), {}),
phase: s.phase,
},
};
},
clone(o) {
if (Array.isArray(o)) return o.map((x) => this.clone(x));
if (o && typeof o === "object") {
const r = {};
for (const k of Object.keys(o)) r[k] = this.clone(o[k]);
return r;
}
return o;
},
};
