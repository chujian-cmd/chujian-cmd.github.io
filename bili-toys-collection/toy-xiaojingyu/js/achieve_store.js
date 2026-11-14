
(function () {
"use strict";
var KEY = "whale_dev_v35_achv";
var SCHEMA = 1;
var LS = (function () {
try {
var k = "__xj_probe__";
window.localStorage.setItem(k, "1");
window.localStorage.removeItem(k);
return window.localStorage;
} catch (e) {
return null;
}
})();
var MEM = null;
function emptyData() { return { v: SCHEMA, uid: null, updated: 0, runs: 0, unlocked: {} }; }
function sanitize(raw) {
var out = emptyData();
if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
var n = Number(raw.v);
out.v = isFinite(n) ? n : SCHEMA;
out.uid = (typeof raw.uid === "string" && raw.uid) ? raw.uid : null;
out.updated = isFinite(Number(raw.updated)) ? Number(raw.updated) : 0;
out.runs = isFinite(Number(raw.runs)) ? Math.max(0, Math.floor(Number(raw.runs))) : 0;
var u = raw.unlocked;
if (u && typeof u === "object" && !Array.isArray(u)) {
Object.keys(u).forEach(function (k) {
var r = u[k];
if (!r || typeof r !== "object") return;
var t = Number(r.t);
if (!isFinite(t) || t <= 0) return;
out.unlocked[k] = {
t: t,
ver: typeof r.ver === "string" ? r.ver : "",
week: isFinite(Number(r.week)) ? Number(r.week) : 0,
verdict: typeof r.verdict === "string" ? r.verdict : "",
slot: typeof r.slot === "string" ? r.slot : "",
};
});
}
return out;
}
var _cache = null;
var _readonly = false;
function load() {
if (_cache) return _cache;
var raw = null;
if (LS) {
try { raw = LS.getItem(KEY); } catch (e) { raw = null; }
} else if (MEM) {
raw = MEM;
}
var parsed = null;
if (typeof raw === "string" && raw) {
try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
}
_cache = sanitize(parsed);
_readonly = _cache.v > SCHEMA;
if (_readonly && typeof console !== "undefined" && console.warn) {
console.warn("[成就] 存储结构版本 v" + _cache.v + " 高于本程序支持的 v" + SCHEMA + " ⇒ 本次只读，不写回");
}
return _cache;
}
function flush() {
if (_readonly) return false;
if (!_cache) return false;
_cache.updated = Date.now();
var str;
try { str = JSON.stringify(_cache); } catch (e) { return false; }
if (LS) {
try { LS.setItem(KEY, str); return true; }
catch (e) { return false; }
}
MEM = str;
return true;
}
var AchieveStore = {
KEY: KEY,
SCHEMA: SCHEMA,
persistent: function () { return !!LS; },
observe: function (core) {
var save = window.GameSave;
if (!save || (typeof save.autoSave !== "function" && typeof save.save !== "function")) return false;
if (!save.__lifeAchievementObserver) {
var observer = {core:core, depth:0};
["autoSave", "save"].forEach(function (method) {
var original = save[method];
if (typeof original !== "function") return;
save[method] = function () {
var state = arguments[method === "save" ? 1 : 0], current = observer.core;
observer.depth++;
try {
if (observer.depth === 1 && current && state === current.state && typeof current.checkLifeAchievements === "function") {
try { current.checkLifeAchievements(); } catch (e) { console.warn("[ACHV] save backfill", e); }
}
return original.apply(this, arguments);
} finally { observer.depth--; }
};
});
save.__lifeAchievementObserver = observer;
}
save.__lifeAchievementObserver.core = core;
return true;
},
has: function (key) { return !!load().unlocked[key]; },
get: function (key) { return load().unlocked[key] || null; },
records: function () { return load().unlocked; },
unlock: function (key, meta) {
var d = load();
if (d.unlocked[key]) return false;
meta = meta || {};
var t = Number(meta.t);
d.unlocked[key] = {
t: (isFinite(t) && t > 0) ? t : Date.now(),
ver: typeof meta.ver === "string" ? meta.ver : "",
week: isFinite(Number(meta.week)) ? Number(meta.week) : 0,
verdict: typeof meta.verdict === "string" ? meta.verdict : "",
slot: typeof meta.slot === "string" ? meta.slot : "",
};
flush();
return true;
},
unlockMany: function (keys, meta) {
var newly = [];
(keys || []).forEach(function (k) {
if (AchieveStore.unlock(k, meta)) newly.push(k);
});
return newly;
},
view: function (cfgList) {
var d = load();
return (cfgList || []).map(function (a) {
if (!a || !a.key) return null;
var rec = d.unlocked[a.key] || null;
var on = !!rec;
var masked = !!a.hidden && !on;
return {
key: a.key,
no: a.no,
rarity: a.rarity || "普通",
cat: masked ? "" : (a.cat || ""),
hidden: !!a.hidden,
locked: !on,
name: masked ? "？？？" : (a.name || ""),
desc: masked ? "" : (a.desc || ""),
img: on ? (a.img || "") : "",
imgAlt: on ? (a.imgAlt || "") : "",
t: on ? rec.t : 0,
ver: on ? rec.ver : "",
week: on ? rec.week : 0,
verdict: on ? rec.verdict : "",
};
}).filter(Boolean);
},
stats: function (cfgList) {
var d = load();
var got = 0;
var byRarity = {};
(cfgList || []).forEach(function (a) {
if (!a || !a.key) return;
var r = a.rarity || "普通";
if (!byRarity[r]) byRarity[r] = { got: 0, total: 0 };
byRarity[r].total++;
if (d.unlocked[a.key]) { byRarity[r].got++; got++; }
});
return { got: got, total: (cfgList || []).length, byRarity: byRarity };
},
exportCloud: function () {
var d = load();
return { v: d.v, uid: d.uid, updated: d.updated, runs: d.runs, unlocked: JSON.parse(JSON.stringify(d.unlocked)) };
},
merge: function (cloud) {
if (!cloud || typeof cloud !== "object") return [];
var cs = sanitize(cloud);
var d = load();
var added = [];
Object.keys(cs.unlocked).forEach(function (k) {
var mine = d.unlocked[k];
var theirs = cs.unlocked[k];
if (!mine) { d.unlocked[k] = theirs; added.push(k); return; }
if (theirs.t && theirs.t < mine.t) d.unlocked[k] = theirs;
});
d.runs = Math.max(d.runs, cs.runs);
flush();
return added;
},
setUid: function (id) {
var d = load();
d.uid = (typeof id === "string" && id) ? id : null;
flush();
return d.uid;
},
reset: function () {
_cache = emptyData();
_readonly = false;
if (LS) { try { LS.removeItem(KEY); } catch (e) {} }
MEM = null;
flush();
return true;
},
_reload: function () { _cache = null; _readonly = false; return load(); },
};
window.AchieveStore = AchieveStore;
})();
