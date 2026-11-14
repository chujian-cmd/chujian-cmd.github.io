
"use strict";
window.V35 = (function () {
const C = () => window.GameCfg.V35;
const DIM_ORDER = ["code", "text", "safety", "stability"];
function allDims() {
const A = C().AXES || {};
return DIM_ORDER.concat(A.ORDER || []);
}
function activeAxes(st) {
const A = C().AXES;
if (!A || A.ENABLED === false) return [];
const src = st || {};
const arch = src.arch != null ? src.arch : (src.v35 && src.v35.arch);
if (!arch) return [];
const param = src.paramTarget != null ? src.paramTarget
: (src.v35 && src.v35.paramTarget);
const P = Number(param) || 0;
return (A.ORDER || []).filter((id) => {
const d = (A.DEF || {})[id];
if (!d || !d.source) return false;
if (d.source.minVer) { const vs = (window.GameCfg || {}).VER_ORDER || []; if (vs.indexOf(src.ver || "V1") < vs.indexOf(d.source.minVer)) return false; }
if ((d.source.archs || []).indexOf(arch) < 0) return false;
return P >= (d.source.paramMin || 0);
});
}
function dimsOf(st) {
return DIM_ORDER.concat(activeAxes(st));
}
function dimObj(value, keys) {
const o = {};
for (const k of (keys || allDims())) o[k] = typeof value === "function" ? value(k) : value;
return o;
}
function mergedGroups(st) {
const order = (window.GameCfg || {}).VER_ORDER || [];
const first = order.indexOf("V5");
return first >= 0 && order.indexOf((st || {}).ver) >= first
? [{ key: "codeText", sources: DIM_ORDER.slice(0, 2) },
{ key: "safetyStability", sources: DIM_ORDER.slice(2, 4) }] : [];
}
function statLimit(st, key, caps, stats) {
const group = mergedGroups(st).find(g => g.sources.includes(key));
if (!group) return caps[key] != null ? caps[key] : Infinity;
const values = stats || (st || {}).stats || st || {};
const budget = group.sources.reduce((n, k) => n + (Number(caps[k]) || 0), 0);
const others = group.sources.filter(k => k !== key).reduce((n, k) => n + Math.max(0, Number(values[k]) || 0), 0);
return Math.max(0, budget - others);
}
function clampStats(st, values, caps) {
const out = {};
const groups = mergedGroups(st), paired = new Set(groups.flatMap(g => g.sources));
for (const key of allDims()) {
let value = Math.max(0, Number(values[key]) || 0);
if (value === Infinity && paired.has(key)) {
value = groups.find(g => g.sources.includes(key)).sources.reduce((n, k) => n + (Number(caps[k]) || 0), 0);
}
out[key] = paired.has(key) || caps[key] == null ? value : Math.min(caps[key], value);
}
for (const group of groups) {
const [a, b] = group.sources, budget = Math.max(0, (Number(caps[a]) || 0) + (Number(caps[b]) || 0));
const sum = out[a] + out[b];
if (sum > budget) {
out[a] = Math.floor(budget * out[a] / sum);
out[b] = budget - out[a];
}
}
return out;
}
function axisCap(ver, id, param) {
const d = ((C().AXES || {}).DEF || {})[id];
const t = (d && d.capByVer) || {};
const x = t[ver];
if (typeof x !== "number") return null;
const PM = (window.GameCfg || {}).PARAM_CAP_MUL || {};
const mul = PM[String(param)] != null ? PM[String(param)] : 1;
return Math.round(x * mul * 10) / 10;
}
function axisPass(ver, id) {
const d = ((C().AXES || {}).DEF || {})[id];
const t = (d && d.passByVer) || {};
const x = t[ver];
return typeof x === "number" ? x : null;
}
function lineScale(ver, param) {
const G = window.GameCfg || {};
const PM = G.PARAM_CAP_MUL || {};
const pin = ((G.MISSIONS || {}).BY_VER || {})[ver || "V1"];
const pinP = pin && pin.param != null ? pin.param : null;
if (pinP == null) return 1;
const cur = param != null ? param : pinP;
const cm = (PM[String(cur)] != null ? PM[String(cur)] : 1);
const bm = (PM[String(pinP)] != null ? PM[String(pinP)] : 1);
if (!bm || !isFinite(cm / bm)) return 1;
return cm / bm;
}
const eff = (e) => 0.5 + 0.5 * e / 100;
const focusMatches = (focus, dim) => focus === dim
|| (focus === "codeText" && (dim === "code" || dim === "text"))
|| (focus === "safetyStability" && (dim === "safety" || dim === "stability"));
const inOff = (t) => t >= C().OFF_START && t < C().OFF_START + C().OFF_LEN;
function rows(arr, fallback) {
if (!Array.isArray(arr) || !arr.length) return fallback || [];
return arr.map(function (r) {
if (Array.isArray(r)) return r;
if (r && typeof r === "object") {
const ks = Object.keys(r).filter((k) => /^\d+$/.test(k)).sort((a, b) => a - b);
if (ks.length) return ks.map((k) => r[k]);
}
return [r, r];
});
}
function mulberry32(seed) {
let a = seed >>> 0;
return function () {
a |= 0; a = (a + 0x6D2B79F5) | 0;
let t = Math.imul(a ^ (a >>> 15), 1 | a);
t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
}
const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const roundI = (rng, g) => Math.floor(g) + (rng() < g - Math.floor(g) ? 1 : 0);
function shuffled(rng, arr) {
const a = arr.slice();
for (let i = a.length - 1; i > 0; i--) {
const j = Math.floor(rng() * (i + 1));
[a[i], a[j]] = [a[j], a[i]];
}
return a;
}
function createState(mode, overtime, extraData, extraPre, extraPost) {
const v = C();
return {
mode: mode || "serious",
ver: "V1",
overtime: !!overtime,
extraData: extraData || 0,
extraPre: extraPre || 0,
extraPost: extraPost || 0,
tick: 0,
stats: dimObj(0),
stageStart: dimObj(0),
corpus: { token: v.CORPUS_CURVE.INIT_TOKEN, items: v.CORPUS_CURVE.INIT_ITEMS,
q: [v.CORPUS_CURVE.INIT_ITEMS, 0, 0] },
energy: { pre: 100, data: 100, post: 100, embodied: 100 },
extraEmbodied: 0, restEmbodied: 0, embodiedJoined: false,
restPre: 0, restData: 0, restPost: 0,
quota: { pre: [], post: [] },
preMul: 1,
lvShift: 0,
preTraitLv: 1, postTraitLv: 1,
paper: { left: 0, done: false, started: false, kind: "text_prob", axis: null, axisProb: 0, axisAdd: 1 },
focus: { dim: null, left: 0 },
focusEverUsed: false,
weekly: [],
gapState: "ok",
prodLog: [],
qualityMix: null,
qualityMul: 1,
};
}
function tick(st, rng) {
const v = C();
rng = rng || Math.random;
const t = st.tick;
const qm = st.qualityMul != null ? st.qualityMul : 1;
const tierRanges = rows(v.TIER_RANGES, [[1, 2]]);
const gapTiers = rows(v.CORPUS_CURVE.GAP_TIERS, [[0.05, 1], [0.15, 0.9], [0.3, 0.6], [9, 0]]);
const joined = {
pre: st.preJoined === undefined ? true : !!st.preJoined,
data: st.dataJoined === undefined ? (t >= v.JOIN_DATA) : !!st.dataJoined,
post: st.postJoined === undefined ? (t >= v.JOIN_POST) : !!st.postJoined,
embodied: !!st.embodiedJoined,
};
const onduty = !inOff(t) || st.overtime;
const offNow = inOff(t);
const otMul = st.overtime && offNow ? v.OVERTIME_MUL : 1;
const floats = [];
const fx = st.paperFx || {};
const fxRoll = fx.extraRoll || {};
const fxBonus = fx.dimBonus || {};
const fxEnergy = fx.roleEnergy || {};
const fxAmp = fx.axisAmp || {};
const fxRate = fx.axisRate || {};
const fxFocusAdd = fx.focusAdd || 0;
const rollProb = (role) => (fxRoll[role] || 0) + (fxRoll.all || 0);
const enListOf = (k) => (st.energyList && Array.isArray(st.energyList[k])) ? st.energyList[k] : null;
const enAt = (k, i, fallback) => {
const a = enListOf(k);
const x = a ? a[i] : undefined;
return typeof x === "number" ? x : fallback;
};
const productionMulAt = (k, i) => {
const x = st.productionMulList && st.productionMulList[k] && st.productionMulList[k][i];
return typeof x === "number" && Number.isFinite(x) && x > 0 ? x : 1;
};
const traitLvAt = (k, i, fallback) => {
const x = st.traitLevelList && st.traitLevelList[k] && st.traitLevelList[k][i];
return typeof x === "number" && x > 0 ? x : fallback;
};
const syncSlot = (k) => {
const a = enListOf(k);
if (!a || !a.length) return;
let sum = 0, n = 0;
for (const x of a) { if (typeof x === "number") { sum += x; n++; } }
if (n) st.energy[k] = Math.round(sum / n);
};
const settledEnergy = new Map();
for (const k of Object.keys(joined)) {
if (!joined[k]) continue;
const _costMul = fxEnergy[k] != null ? fxEnergy[k] : 1;
const a = enListOf(k);
if (!a) {
if (!onduty) { st.energy[k] = Math.min(100, st.energy[k] + v.ENERGY_REST); continue; }
if (st.energy[k] < v.ENERGY_MIN) {
st.energy[k] = Math.min(v.ENERGY_MIN, st.energy[k] - v.ENERGY_TICK * _costMul);
continue;
}
st.energy[k] = Math.max(0, st.energy[k] + v.ENERGY_TICK * _costMul);
continue;
}
for (let i = 0; i < a.length; i++) {
if (typeof a[i] !== "number") continue;
const owner = st.energyOwnerList && st.energyOwnerList[k] && st.energyOwnerList[k][i];
if (owner != null && settledEnergy.has(owner)) { a[i] = settledEnergy.get(owner); continue; }
const primaryRole = owner != null && st.energyRoleById ? st.energyRoleById[owner] : k;
const costMul = owner != null ? (fxEnergy[primaryRole] != null ? fxEnergy[primaryRole] : 1) : _costMul;
if (!onduty) a[i] = Math.min(100, a[i] + v.ENERGY_REST);
else if (a[i] < v.ENERGY_MIN) a[i] = Math.min(v.ENERGY_MIN, a[i] - v.ENERGY_TICK * costMul);
else a[i] = Math.max(0, a[i] + v.ENERGY_TICK * costMul);
if (owner != null) settledEnergy.set(owner, a[i]);
}
syncSlot(k);
}
if (st.mode !== "idle" && st.autoFocus !== false && t === v.JOIN_POST && st.focus.left === 0) {
st.focusEverUsed = true;
st.focus.dim = st.mode === "explore" ? "code" : "text";
st.focus.left = v.FOCUS_TICKS;
}
if (st.mode !== "idle" && st.paperManual !== true && t === v.JOIN_DATA
&& !st.paper.started && !st.paper.done) {
st.paper.started = true;
st.paper.left = v.PAPER_RESEARCH_TICKS;
}
if (st.mode !== "idle" && (!v.BREAKTHROUGH.REQUIRE_FOCUS || st.focusEverUsed) && t === v.BREAKTHROUGH.TICK) {
st.lvShift += v.BREAKTHROUGH.SHIFT;
}
const preProduce = (preIdx, en) => {
if (!st.quota.pre.length) st.quota.pre = shuffled(rng, v.PRE_QUOTA);
const dim = st.quota.pre.pop();
const preTiers = rows(v.PRE_TRAIT_TIERS || v.TIER_RANGES, [[1, 2]]);
const preLv = Math.max(1, Math.min(5, traitLvAt("pre", preIdx, st.preTraitLv || 1)));
const tierIdx = Math.min((preLv - 1) + (st.lvShift || 0), preTiers.length - 1);
const [lo, hi] = preTiers[tierIdx] || [1, 2];
let g = randInt(rng, lo, hi) * eff(en) * st.preMul * otMul * qm * productionMulAt("pre", preIdx);
const hitFocus = st.focus.left > 0 && focusMatches(st.focus.dim, dim);
if (hitFocus) g *= (v.FOCUS_MUL + fxFocusAdd);
g += (fxBonus[dim] || 0);
g = roundI(rng, g);
st.stats[dim] += g;
floats.push({ who: "pre", slot: preIdx, dim, amount: g, focus: hitFocus });
if (dim === "text" && st.paper.done && st.paper.kind === "text_prob" && rng() < v.PAPER_TEXT_PROB) {
st.stats.text += v.PAPER_TEXT_ADD;
floats.push({ who: "paper", dim: "text", amount: v.PAPER_TEXT_ADD, focus: false });
}
};
for (let _p = 0; _p < Math.max(0, 1 + (st.extraPre || 0) - (st.restPre || 0)); _p++) {
const _en = enAt("pre", _p, st.energy.pre);
if (joined.pre && onduty && _en >= v.ENERGY_MIN) {
preProduce(_p, _en);
if (rng() < rollProb("pre")) preProduce(_p, _en);
}
}
const dataProduce = (dataIdx, en) => {
const dataSpeed = v.PAPER_DATA_SPEED_MUL != null ? v.PAPER_DATA_SPEED_MUL : 1.10;
const k = eff(en) * otMul * qm * productionMulAt("data", dataIdx)
* (st.paper.done && st.paper.kind === "data_speed" ? dataSpeed : 1.0);
const lv = Array.isArray(st.dataTraitLvs) ? (st.dataTraitLvs[dataIdx] || 1) : 1;
const probTbl = (Array.isArray(v.QUALITY_PROB_BY_DATA_LV) && v.QUALITY_PROB_BY_DATA_LV[lv - 1])
? v.QUALITY_PROB_BY_DATA_LV[lv - 1] : v.QUALITY_PROB;
const P0 = probTbl[0] || 0, P1 = probTbl[1] || 0;
const r = rng();
const qi = r < P0 ? 0 : (r < P0 + P1 ? 1 : 2);
const n = v.DATA_ITEMS * k;
st.corpus.token += n * v.QUALITY_MULT[qi];
st.corpus.items += n;
st.corpus.q[qi] += n;
const dt = roundI(rng, v.DATA_TEXT * k) + (fxBonus.text || 0);
st.stats.text += dt;
floats.push({ who: "data", slot: dataIdx, dim: "text", amount: dt, focus: false });
if (st.paper.done && st.paper.kind === "text_prob" && rng() < v.PAPER_TEXT_PROB) {
st.stats.text += v.PAPER_TEXT_ADD;
floats.push({ who: "paper", dim: "text", amount: v.PAPER_TEXT_ADD, focus: false });
}
};
for (let i = 0; i < Math.max(0, 1 + st.extraData - (st.restData || 0)); i++) {
const _en = enAt("data", i, st.energy.data);
if (joined.data && onduty && _en >= v.ENERGY_MIN) {
dataProduce(i, _en);
if (rng() < rollProb("data")) dataProduce(i, _en);
}
}
const postProduce = (postIdx, en) => {
if (!st.quota.post.length) st.quota.post = shuffled(rng, v.POST_QUOTA);
const dim = st.quota.post.pop();
const postTiers = rows(v.POST_TRAIT_TIERS || v.TIER_RANGES, [[1, 2]]);
const postLv = Math.max(1, Math.min(5, traitLvAt("post", postIdx, st.postTraitLv || 1)));
const tierIdx = Math.min(postLv - 1, postTiers.length - 1);
const [lo, hi] = postTiers[tierIdx] || [1, 2];
let g = randInt(rng, lo, hi) * eff(en) * otMul * qm * productionMulAt("post", postIdx);
const hitFocus = st.focus.left > 0 && focusMatches(st.focus.dim, dim);
if (hitFocus) g *= (v.FOCUS_MUL + fxFocusAdd);
g += (fxBonus[dim] || 0);
g = roundI(rng, g);
st.stats[dim] += g;
floats.push({ who: "post", slot: postIdx, dim, amount: g, focus: hitFocus });
};
for (let _q = 0; _q < Math.max(0, 1 + (st.extraPost || 0) - (st.restPost || 0)); _q++) {
const _en = enAt("post", _q, st.energy.post);
if (joined.post && onduty && _en >= v.ENERGY_MIN) {
postProduce(_q, _en);
if (rng() < rollProb("post")) postProduce(_q, _en);
}
}
if (onduty) {
const axIds = activeAxes(st);
if (axIds.length) {
const CQ = (window.GameCfg || {}).CORPUS_QUALITY || {};
const shareGP = st.qualityMix
? ((st.qualityMix.g || 0) + (st.qualityMix.p || 0)) * (CQ.STEP != null ? CQ.STEP : 0.2)
: 0;
const haveOf = (role) => {
const K = {data:"Data",post:"Post",pre:"Pre",embodied:"Embodied"}[role];
return Math.max(0, 1 + (st["extra" + K] || 0) - (st["rest" + K] || 0));
};
for (const id of axIds) {
const def = ((v.AXES || {}).DEF || {})[id];
if (!def) continue;
const cr = def.corpusReq || {};
const reqGood = cr.good || 0;
const corpusMul = (reqGood > 0 && shareGP < reqGood - 1e-9)
? (cr.missMul != null ? cr.missMul : 0.7) : 1;
const am = (def.archMul || {})[st.arch || "dense"];
const aMul = am != null ? am : 1;
const tiers = rows((((window.GameCfg || {}).AXIS_TRAIT_TIERS) || {})[id], [[1, 2]]);
const prob = Math.min(1, (def.tickProb != null ? def.tickProb : 0.3) + (fxRate[id] || 0));
let gain = 0;
const contributions = [];
for (const dr of (def.drivers || [])) {
const role = dr.role;
if (role === "embodied" && def.alternateIndex != null && t % 2 !== def.alternateIndex) continue;
if (!joined[role]) continue;
const n = haveOf(role);
for (let i = 0; i < n; i++) {
const _en = enAt(role, i, st.energy[role] || 0);
if (_en < v.ENERGY_MIN) continue;
if (rng() >= prob) continue;
let lv = 1;
if (role === "data") lv = (Array.isArray(st.dataTraitLvs) ? st.dataTraitLvs[i] : 1) || 1;
else if (role === "post") lv = traitLvAt(role, i, st.postTraitLv || 1);
else lv = traitLvAt(role, i, role === "embodied" ? 1 : (st.preTraitLv || 1));
const ti = Math.min(Math.max(1, lv) - 1, tiers.length - 1);
const [lo, hi] = tiers[ti] || [1, 2];
const personalGain = randInt(rng, lo, hi) * eff(_en) * otMul * qm * aMul * corpusMul
* (fxAmp[id] != null ? fxAmp[id] : 1) * productionMulAt(role, i);
gain += personalGain;
contributions.push({ who: role, slot: i, raw: personalGain });
}
}
const hitFocus = st.focus.left > 0 && st.focus.dim === id;
if (gain > 0) {
if (hitFocus) gain *= (v.FOCUS_MUL + fxFocusAdd);
gain += (fxBonus[id] || 0);
const gi = roundI(rng, gain);
if (gi > 0) {
st.stats[id] += gi;
if (contributions.length) {
const totalRaw = contributions.reduce((n, x) => n + x.raw, 0);
let remaining = gi;
contributions.forEach((x, i) => {
const amount = i === contributions.length - 1 ? remaining : Math.floor(gi * x.raw / totalRaw);
remaining -= amount;
if (amount > 0) floats.push({ who: x.who, slot: x.slot, dim: id, amount, focus: hitFocus });
});
} else floats.push({ who: ((def.drivers || [])[0] || {}).role || "axis", dim: id, amount: gi, focus: hitFocus });
}
}
}
if (st.paper.done && st.paper.axis && axIds.indexOf(st.paper.axis) >= 0
&& (st.paper.axisProb || 0) > 0 && rng() < st.paper.axisProb) {
const ad = st.paper.axisAdd != null ? st.paper.axisAdd : 1;
st.stats[st.paper.axis] += ad;
floats.push({ who: "paper", dim: st.paper.axis, amount: ad, focus: false });
}
}
}
if (onduty) {
if (st.focus.left > 0) st.focus.left--;
if (st.paper.left > 0 && --st.paper.left === 0) st.paper.done = true;
}
if ((t + 1) % v.TICKS_PER_WEEK === 0) {
const wk = (t + 1) / v.TICKS_PER_WEEK;
const need = needAt(st, wk);
const gap = need > 0 ? Math.max(0, (need - st.corpus.token) / need) : 0;
let mul = 1, tag = "ok";
const tiers = gapTiers;
for (const [hi2, m] of tiers) {
if (gap <= hi2) { mul = m; break; }
}
if (st.weekMulOverride) { mul *= st.weekMulOverride; st.weekMulOverride = null; }
if (gap <= tiers[0][0]) { mul = tiers[0][1]; }
else if (gap <= tiers[1][0]) { mul = tiers[1][1]; }
else if (gap <= tiers[2][0]) { mul = tiers[2][1]; }
else { mul = tiers[3][1]; }
st.preMul = mul;
st.weekly.push({ week: wk, need, have: st.corpus.token, gap, mul, tag });
}
{
const wkNow = Math.ceil((t + 1) / v.TICKS_PER_WEEK);
const needNow = needAt(st, wkNow);
const pctNow = needNow > 0 ? (st.corpus.token / needNow) * 100 : 100;
const free = (v.GAP_SLOW && v.GAP_SLOW.FREE_ABOVE != null) ? v.GAP_SLOW.FREE_ABOVE : 90;
const prev = st.gapState;
let tag = pctNow >= free ? "ok" : pctNow >= 60 ? "tight" : "warn";
if (prev === "ok" && tag === "tight" && pctNow >= free - 8) tag = "ok";
else if (prev === "tight" && tag === "warn" && pctNow >= 52) tag = "tight";
st.gapState = tag;
}
st.tick = t + 1;
st.prodLog = floats;
return floats;
}
function comboReq(arch, param) {
const T = ((typeof window !== "undefined" && window.GameCfg) || {}).ARCH_PARAM_REQ || {};
return T[(arch || "dense") + "@" + (Number(param) || 0)] || null;
}
function weekAdd(st) {
const cc = C().CORPUS_CURVE || {};
const arch = st.arch || "dense";
const param = st.paramTarget || 7;
const combo = comboReq(arch, param);
if (combo && combo.weekAdd != null) return Math.max(0, Math.round(combo.weekAdd));
const base = cc.WEEK_ADD_BASE != null ? cc.WEEK_ADD_BASE : 30;
const am = (cc.WEEK_ADD_BY_ARCH || {})[arch];
const pm = (cc.WEEK_ADD_BY_PARAM || {})[String(param)];
return Math.round(base * (am != null ? am : 1) * (pm != null ? pm : 1));
}
function needAt(st, wk) {
const v = C();
const stageCurve = (v.STAGES || {})[st.ver] || { GATE: v.CORPUS_CURVE.GATE, WEEK_ADD: v.CORPUS_CURVE.WEEK_ADD };
return stageCurve.GATE + weekAdd(st) * (wk - 1);
}
function weeklyProductionFull(st) {
return weeklyProductionEstimate(st) * C().TICKS_PER_WEEK;
}
function qbar(st) {
return st.corpus.items > 0 ? st.corpus.token / st.corpus.items : C().QUALITY_MULT[0];
}
function qualityBonus(st) {
const q = qbar(st);
const order = window.GameCfg.VER_ORDER || ["V1"];
const col = Math.min((order.indexOf(st.ver || "V1") + 1), 4);
const qt = rows(C().Q_TIERS,
[[0.55, 0, -2, -4, -6], [0.75, 2, 0, -2, -4], [0.95, 4, 3, 2, 0], [9.99, 6, 5, 4, 2]]);
const pick = (row) => {
const v = row ? row[Math.min(col, row.length - 1)] : undefined;
return Number.isFinite(v) ? v : 0;
};
for (const row of qt) if (q < row[0]) return pick(row);
return pick(qt[qt.length - 1]);
}
function buyCorpus(st, items, rng) {
rng = rng || Math.random;
const buy = C().CORPUS_CURVE.BUY;
let good = 0;
for (let i = 0; i < items; i++) if (rng() < (buy.goodProb != null ? buy.goodProb : 0.2)) good++;
const token = (items - good) * C().QUALITY_MULT[0] + good * C().QUALITY_MULT[1];
st.corpus.token += token;
st.corpus.items += items;
st.corpus.q[0] += items - good;
st.corpus.q[1] += good;
return { good, token, costWan: items * (buy.price != null ? buy.price : 0.3) };
}
function weeklyProductionEstimate(st) {
const qm = st && st.qualityMul != null ? st.qualityMul : 1;
const crew = st ? Math.max(0, 1 + (st.extraData || 0) - (st.restData || 0)) : 1;
const muls = st && st.productionMulList && st.productionMulList.data;
let estimate = 0;
for (let i = 0; i < crew; i++) {
const m = Array.isArray(muls) ? muls[i] : 1;
const personalMul = typeof m === "number" && Number.isFinite(m) && m >= 0 ? m : 1;
const level = Array.isArray(st && st.dataTraitLvs) ? st.dataTraitLvs[i] : null;
const probs = level != null
? ((C().QUALITY_PROB_BY_DATA_LV || [])[Math.max(1, level) - 1] || C().QUALITY_PROB || [0.5, 0.4, 0.1])
: [0.5, 0.4, 0.1];
const expectedQuality = probs.reduce((n, p, q) => n + p * (C().QUALITY_MULT[q] || 0), 0);
estimate += C().DATA_ITEMS * expectedQuality * personalMul;
}
return estimate * qm;
}
function testTier(st) {
const v = C();
const language = mergedGroups(st).length ? (Number(st.stats.code) || 0) + (Number(st.stats.text) || 0) : st.stats.text;
const ratio = language / v.TEST.TARGET;
return { ratio, tier: ratio < v.TEST.DUMB ? "dumb" : "full" };
}
function review(st, baseline) {
const b = baseline || dimObj(0);
const d = (k) => Math.max(0, (st.stats[k] || 0) - (b[k] || 0));
const v = C();
const R = v.REVIEW || {};
const ver = st.ver || "V1";
const per = (R.BY_VER || {})[ver] || {};
const w = (R.WEIGHTS_BY_VER || {})[ver] || R.WEIGHTS || {};
const dims = dimsOf(st);
const wsum = Object.keys(w).reduce((a, k) => a + (w[k] || 0), 0);
const normal = (v.AXES || {}).NORMALIZE !== false;
const denom = normal ? (wsum > 0 ? wsum : 1) : 1;
const _axDef = (v.AXES || {}).DEF || {};
const _mul = (k) => (_axDef[k] && _axDef[k].scoreMul) || 1;
const groups = mergedGroups(st), paired = new Set(groups.flatMap(g => g.sources));
const original = dims.filter(k => !paired.has(k)).reduce((a, k) => a + (w[k] || 0) * _mul(k) * d(k), 0);
const merged = groups.reduce((a, g) => a + g.sources.reduce((n, k) => n + d(k), 0)
* 0.5 * g.sources.reduce((n, k) => n + (w[k] || 0), 0), 0);
const raw = (original + merged) / denom;
const bonus = qualityBonus(st);
const total = raw + bonus;
const _sc = lineScale(ver, st.paramTarget != null ? st.paramTarget : (st.v35 && st.v35.paramTarget));
const _scN = (x) => Math.round(x * _sc);
const _mdRaw = per.MIN_DIM || R.MIN_DIM || { code: 18, text: 22, safety: 7, stability: 7 };
const minDim = {};
Object.keys(_mdRaw).forEach((k) => { minDim[k] = _scN(_mdRaw[k]); });
const great = _scN(per.GREAT_SCORE != null ? per.GREAT_SCORE
: (R.GREAT_SCORE != null ? R.GREAT_SCORE : 29));
const axMin = {};
Object.keys(per.AXIS_MIN || {}).forEach((k) => { axMin[k] = _scN(per.AXIS_MIN[k]); });
const balanced = dims.filter(k => !paired.has(k)).every((k) => st.stats[k] >= (minDim[k] != null ? minDim[k] : 0))
&& groups.every(g => g.sources.reduce((n, k) => n + (st.stats[k] || 0), 0)
>= g.sources.reduce((n, k) => n + (minDim[k] || 0), 0));
const axisOk = dims.every((k) => axMin[k] == null || (st.stats[k] || 0) >= axMin[k]);
const excellent = total >= great && balanced && axisOk;
return {
raw, bonus, total, balanced, axisOk, excellent, greatScore: great, minDim, axMin,
axes: activeAxes(st), wsum: denom,
result: excellent ? "excellent" : "pass",
qbar: qbar(st),
};
}
function simulate(st, ticks, rng) {
for (let i = 0; i < ticks; i++) tick(st, rng);
return st;
}
function gapPct(st) {
const wk = Math.ceil((((st.tick || 0)) + 1) / C().TICKS_PER_WEEK) || 1;
const need = needAt(st, wk);
return need > 0 ? (st.corpus.token / need) * 100 : 100;
}
return { createState, tick, simulate, qbar, qualityBonus, buyCorpus,
weeklyProductionEstimate, weeklyProductionFull, weekAdd, needAt, gapPct,
testTier, review, mulberry32, comboReq, lineScale,
DIM_ORDER, allDims, activeAxes, dimsOf, dimObj, mergedGroups, statLimit, clampStats,
axisCap, axisPass };
})();
