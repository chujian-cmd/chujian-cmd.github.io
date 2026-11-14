
"use strict";
window.V35Hire = {
retryNotice: function (core) {
var order = core.state.hireOrder;
if (!order || !(order.attempt > 1)) return "";
var template = String((core.cfg.UI_CFG || {}).HIRE_RETRY_NOTICE || "");
var values = { attempt: order.attempt, weeks: Math.max(1, Math.ceil(order.left / ((core.cfg.V35 || {}).TICKS_PER_WEEK || 6))) };
return template.replace(/\{(attempt|weeks)\}/g, function (_, key) { return values[key]; });
},
roles: function (core) {
var roles = Object.assign({}, (core.cfg.V35 && core.cfg.V35.HIRE_ROLES) || {});
if (!core.embodiedAvailable || !core.embodiedAvailable()) delete roles.embodied;
return roles;
},
pickFromPool: function (core, role) {
if (role === "embodied" && (!core.embodiedAvailable || !core.embodiedAvailable())) return null;
var s = core.state;
var ver = s.ver || "V1";
var roleMatches = function (e) { return e.type === role; };
var byRole = core.hireDrawPool(ver, {filter: function (e) {
return roleMatches(e) && core.hireWeightOf(e, ver) > 0;
}});
if (!byRole.length) byRole = core.hireDrawPool(ver, {filter: roleMatches});
if (!byRole.length) return null;
var weighted = [];
var totalW = 0;
for (var i = 0; i < byRole.length; i++) {
var e = byRole[i];
var w = core.hireWeightOf ? core.hireWeightOf(e, ver) : 1;
totalW += w;
if (w <= 0) continue;
var n = Math.max(1, Math.round(w * 10));
for (var k = 0; k < n; k++) weighted.push(e);
}
if (totalW <= 0) {
weighted = [];
for (var i2 = 0; i2 < byRole.length; i2++) {
for (var k2 = 0; k2 < 5; k2++) weighted.push(byRole[i2]);
}
}
return weighted[Math.floor(Math.random() * weighted.length)];
},
request: function (core, role) {
var s = core.state;
var R = this.roles(core);
var want = Array.isArray(role) ? role.slice() : (role ? [role] : []);
if (!want.length) return { ok: false, tip: "先选一个岗位" };
for (var i = 0; i < want.length; i++) {
if (!R[want[i]]) return { ok: false, tip: "没有这个岗位：" + want[i] };
}
if (s.hireOrder) return { ok: false, tip: "已经有人在帮你筛选简历了，先等这一轮结果" };
var capN = core.seatCap ? core.seatCap() : 4;
var aliveN = (s.engineers || []).filter(function (e) { return !e.resigned; }).length;
if (aliveN >= capN) return { ok: false, seatFull: true, tip: "🚪 座位已满（" + aliveN + "/" + capN + "）：先辞退一人，再发布需求" };
var payCost = 0;
if (core.payRecruitCost) {
var pay = core.payRecruitCost(want.length);
if (!pay.ok) return { ok: false, tip: pay.tip };
payCost = pay.cost || 0;
}
var lo = 1, hi = 3;
for (var j = 0; j < want.length; j++) {
var w = R[want[j]].waitMin || [1, 3];
lo = Math.max(lo, w[0]); hi = Math.max(hi, w[1]);
}
if (hi < lo) hi = lo;
var mins = Math.round(lo + Math.random() * (hi - lo));
s.hireOrder = { roles: want, role: want[0], left: mins * 6, total: mins * 6, attempt: 1 };
var label = want.map(function (r) { return (R[r] || {}).label || r; }).join("、");
return { ok: true, mins: mins, role: want[0], roles: want, label: label, cost: payCost };
},
rollFindN: function (core) {
var w = (core.cfg.V35 && core.cfg.V35.HIRE_FIND_N) || [0.7, 0.2, 0.1];
var r = Math.random(), acc = 0;
for (var i = 0; i < w.length; i++) { acc += (w[i] || 0); if (r < acc) return i + 1; }
return w.length;
},
rushOptions: function (core) {
var v = core.cfg.V35 || {};
var cost = v.HIRE_RUSH_COST == null ? 200000 : Number(v.HIRE_RUSH_COST);
var weeks = v.HIRE_RUSH_WEEKS == null ? 1 : Number(v.HIRE_RUSH_WEEKS);
var tpw = v.TICKS_PER_WEEK == null ? 6 : Number(v.TICKS_PER_WEEK);
cost = Number.isFinite(cost) && cost >= 0 ? Math.round(cost) : 200000;
weeks = Number.isFinite(weeks) && weeks >= 1 ? Math.floor(weeks) : 1;
tpw = Number.isFinite(tpw) && tpw >= 1 ? Math.floor(tpw) : 6;
return { cost: cost, weeks: weeks, ticks: weeks * tpw,
costText: cost % 10000 === 0 ? (cost / 10000 + " 万") : (cost + " 元") };
},
rush: function (core) {
var s = core.state, order = s.hireOrder;
if (!order || !Number.isFinite(order.left) || order.left <= 0) return { ok: false, tip: "当前没有可加急的招聘需求" };
var options = this.rushOptions(core);
if ((s.funding || 0) < options.cost) return { ok: false, tip: "加急招聘需要 " + options.costText + "经费，账上不够了" };
s.funding = (s.funding || 0) - options.cost;
var before = order.left;
order.left = Math.max(0, before - options.ticks);
var result = order.left === 0 ? this.settle(core) : null;
return { ok: true, cost: options.cost, weeks: options.weeks, ticksReduced: Math.min(before, options.ticks), result: result };
},
buildCand: function (core, role) {
if (role === "embodied" && (!core.embodiedAvailable || !core.embodiedAvailable())) return null;
var cfgR = this.roles(core)[role] || {};
var tpl = this.pickFromPool(core, role);
if (tpl) return core.cloneEng(tpl);
var names = ["林", "苏", "陈", "周", "吴", "郑"];
var suffix = ["工", "老师", "同学", "", ""];
var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
var traitOf = { pretrain: "pretrain", data: "data", post: "post", embodied: "embodied" }[role] || "pretrain";
var cand = {
id: "hire_x_" + Date.now() + "_" + Math.floor(Math.random() * 1000), type: role,
name: pick(names) + pick(suffix),
salary: cfgR.salary || 83333, stats: role === "embodied" ? { code: 60, algo: 60, engineering: 60 } : { code: 60, algo: 60, text: 60 },
traits: [{ type: traitOf, level: 2 }], resume: {},
};
if (core.salaryOf) cand.salary = core.salaryOf(cand);
var _ttl = (core.cfg && core.cfg.CANDIDATE_TTL_WEEKS) || 0;
if (_ttl > 0 && core.absWeek) cand.expireAbsWeek = core.absWeek() + _ttl;
return cand;
},
tick: function (core) {
var s = core.state;
var o = s.hireOrder;
if (!o) return null;
o.left -= 1;
if (o.left > 0) return null;
return this.settle(core);
},
settle: function (core) {
var s = core.state, o = s.hireOrder;
if (!o || o.left > 0) return null;
var cfgR = this.roles(core)[o.role] || {};
var prob = cfgR.findProb != null ? cfgR.findProb : 0.8;
if (o.attempt < 3 && Math.random() >= prob) {
o.attempt += 1;
o.left = Math.max(6, Math.round(o.total * 0.6));
o.total = o.left;
return { found: false, role: o.role, attempt: o.attempt, leftMin: (o.left / 6).toFixed(1) };
}
var roles = (o.roles && o.roles.length) ? o.roles : [o.role];
s.candidates = s.candidates || [];
var found = [];
for (var ri = 0; ri < roles.length; ri++) {
var role = roles[ri];
var n = this.rollFindN(core);
for (var i = 0; i < n; i++) {
var cand = this.buildCand(core, role);
if (!cand) continue;
cand.fromHire = true;
if (!s.candidates.some(function (c) { return core.engUid(c) === core.engUid(cand); })) s.candidates.push(cand);
found.push({
name: cand.name,
role: role,
label: ((this.roles(core)[role] || {}).label) || role,
tier: (core.tierLabel ? core.tierLabel(cand) : ((core.tierOf(cand) || {}).name || "一般")),
});
}
}
s.hireCandidate = null;
s.hireOrder = null;
return {
found: true, role: roles[0], roles: roles, count: found.length, cands: found,
label: found.map(function (f) { return f.label; }).join("、"),
};
},
pickOfferCand: function (core, tier) {
var s = core.state;
var ver = s.ver || "V1";
var free = core.hireDrawPool(ver);
if (!free.length) return null;
var ORDER = ["rainbow", "orange", "pink", "blue", "gray"];
var byKey = {};
free.forEach(function (e) {
var k = (core.tierOf(e) || {}).clsKey || "gray";
(byKey[k] = byKey[k] || []).push(e);
});
var topArr = null;
for (var i = 0; i < ORDER.length; i++) {
if (byKey[ORDER[i]] && byKey[ORDER[i]].length) { topArr = byKey[ORDER[i]]; break; }
}
if (!topArr) return null;
var rnd = function (a) { return a[Math.floor(Math.random() * a.length)]; };
if (tier === "high") return rnd(topArr);
var pink = byKey.pink || [], blue = byKey.blue || [];
if (!pink.length && !blue.length) return rnd(topArr);
if (!pink.length) return rnd(blue);
if (!blue.length) return rnd(pink);
return rnd(Math.random() < 0.5 ? pink : blue);
},
};
