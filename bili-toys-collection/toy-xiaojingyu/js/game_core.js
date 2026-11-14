
"use strict";
window.GameCore = {
cfg: null,
state: null,
init(cfg) {
this.cfg = cfg;
const achievements = this.achvStore();
if (achievements && achievements.observe) achievements.observe(this);
if (window.ToyCloud && typeof window.ToyCloud.flushQueue === "function") window.ToyCloud.flushQueue().catch(() => {});
},
PUBLIC_FROM_VER: "V3.5",
isBeta(ver) {
const V = this.cfg.VER_ORDER || ["V1"];
const pub = V.indexOf(this.PUBLIC_FROM_VER);
const i = V.indexOf(ver != null ? ver : ((this.state || {}).ver || "V1"));
return pub < 0 || i < 0 ? false : i < pub;
},
newState() {
const c = this.cfg;
const s = {
version: c.version,
saveVersion: 0,
ver: c.CUR_VERSION || "V1",
phase: "naming",
whaleName: null,
modelName: c.MODEL_NAME_DEFAULT || "小鲸鱼",
week: 0,
weekOffset: 0,
bodyCalendar: null,
step: 0,
funding: c.INIT_FUNDING,
brand: c.INIT_BRAND,
reputation: 0,
...window.V35.dimObj(0),
gpuTier: null,
ownedGpus: [],
paramTarget: null,
engineers: [],
candidates: [],
triggered: [],
parallel: false,
direction: null,
pending: [],
lastReport: null,
lastGrowth: null,
freeActions: null,
verIdx: 0,
leader: null,
lastLeader: null,
leaderOverworked: false,
tuneDrawsLeft: 0,
miniModels: [],
users: 0,
rank: null,
tbRound: null,
tbTalked: null,
tbTrained: null,
minigame: null,
pendingMinigame: null,
arch: "dense",
recipe: "chat",
corpus: (window.V35 && c.V35) ? c.V35.CORPUS_CURVE.INIT_TOKEN : (c.CORPUS ? c.CORPUS.INIT : 20),
corpusShort: 0,
hireQuota: 3,
hiredThisRound: 0,
hireFlow: "init",
loopStep: "report",
fineTuneDraft: null,
focus: null,
lastFineTune: null,
ap: (window.V35 && c.V35) ? 0 : (c.AP_PER_ROUND != null ? c.AP_PER_ROUND : 2),
actionLog: [],
flags: {},
candBonus: 0,
tutSeen: [],
investor: false,
result: null,
dirStep: "plan",
dirPick: null,
pendingNews: null,
newsSeen: [],
visitors: [],
pendingVisitor: null,
evalShow: null,
evalShowDone: false,
bonus: null,
rounds: 0,
absRounds: 0,
officePaused: false,
planDone: false,
planDraft: null,
mission: null,
incBase: 0,
retryCount: 0,
codex: {},
codexLog: [],
stageMarks: {},
prodByEng: {},
prodFullByEng: {},
focusBoost: null,
paperResearch: null,
papersOwned: [],
approvedArchs: [],
paperCandidates: [],
payrollDue: (window.V35 && c.V35) ? c.V35.TICKS_PER_WEEK * 4 : ((c.PAYROLL && c.PAYROLL.PERIOD_ROUNDS) || 28),
fiscalDeficit: 0,
pendingBailout: null,
pardonUsed: false,
bankruptWarn: null,
officeModal: null,
seatOf: {},
v35: null,
breakthroughSeen: false,
chatNode: null,
notebook: [],
_lastReplyIdx: {},
stageNo: 0,
};
this.ensureV35(s);
return s;
},
newGame() { this.state = this.newState(); return this.state; },
v35On() {
const c = this.cfg, s = this.state;
return !!(c.V35 && window.V35 && s && s.v35);
},
ensureV35(s) {
const c = this.cfg;
if (!s || !c.V35 || !window.V35) return null;
if (!s.v35) {
s.v35 = window.V35.createState("serious", false, 0);
s.v35.autoFocus = false;
s.v35.paperManual = true;
}
return s.v35;
},
offworkNow() {
const s = this.state, v = this.cfg.V35;
if (!s || !s.v35 || !v) return false;
const t = s.v35.tick;
const offS = v.OFF_START != null ? v.OFF_START : 18;
const offL = v.OFF_LEN != null ? v.OFF_LEN : 3;
return t != null && t >= offS && t < offS + offL;
},
primaryTraitType(e) {
if (!e) return null;
if (e.type) return e.type;
const tpl = this.engOf(e) || (e.key ? this.engByKey(e.key) : null);
if (tpl && tpl.type) return tpl.type;
const ts = e.traits || [];
const t = ts.find((x) => x && x.type && x.type !== "academic") || ts.find((x) => x && x.type);
return t ? t.type : "pretrain";
},
mainTrait(e) {
const type = this.primaryTraitType(e);
const ts = (e && e.traits) || [];
return ts.find((t) => t && t.type === type)
|| (type === "infra" ? ts.find((t) => t && t.type === "engineer") : null)
|| { type, level: 1 };
},
v35RoleOf(e) {
const map = { pretrain: "pre", academic: "pre", engineer: "pre", infra: "pre", data: "data", post: "post", safety: "post", embodied: "embodied" };
return e ? (map[this.primaryTraitType(e)] || null) : null;
},
productionTraitLevel(e, role) {
const type = { pre: "pretrain", data: "data", post: "post", embodied: "embodied" }[role];
if (!type) return 0;
let level = 0;
for (const t of (e && e.traits) || []) {
if (t && t.type === type) level = Math.max(level, Number(t.level) || 1);
}
return level;
},
productionRoleEngs(st, role, includeRest) {
const s = this.state, wk = s.week || 0;
if (role === "embodied" && !this.embodiedAvailable(s)) return [];
return (s.engineers || []).filter((e) => !e.resigned
&& this.productionTraitLevel(e, role) > 0
&& (includeRest || e.restWeek !== wk)
&& (e.joinTick == null || !st || st.tick == null || st.tick >= e.joinTick));
},
v35EngIdOfRole(role) {
const s = this.state;
const e = this.teamRoleEngs(s.v35, role)[0];
return e ? e.id : null;
},
v35RoleName(role) {
return ({ pre: "预训练", data: "数据", post: "后训练", embodied: "具身智能" })[role] || role || "";
},
engNoOf(ref) {
if (ref == null) return null;
if (typeof ref === "object") return ref.no != null ? ref.no : this.engNoOf(ref.id);
if (typeof ref === "number") return ref;
const t = String(ref);
if (/^e\d+$/.test(t)) return +t.slice(1);
const leg = this.cfg.ENGINEERS_LEGACY_NO || {};
if (leg[t] != null) return leg[t];
if (/^\d+$/.test(t)) return +t;
return null;
},
engIdOf(no) { return no == null ? null : "e" + no; },
engUid(x) {
if (x == null) return null;
const no = this.engNoOf(x);
if (no != null) return this.engIdOf(no);
return x.id != null ? String(x.id) : null;
},
engOf(ref) {
const no = this.engNoOf(ref);
if (no == null) return null;
return (this.cfg.ENGINEERS || []).find((e) => e.no === no) || null;
},
engByKey(key) { return (this.cfg.ENGINEERS || []).find((e) => e.key === key) || null; },
engNoByKey(key) { const e = this.engByKey(key); return e ? e.no : null; },
hasEng(ref) { return !!this.engOf(ref); },
tutorialPending() {
const s = this.state;
const list = this.cfg.TUTORIAL || [];
s.tutSeen = Array.isArray(s.tutSeen) ? s.tutSeen : [];
for (const t of list) {
if (s.tutSeen.includes(t.id)) continue;
if (t.ver && t.ver !== (s.ver || "V1")) continue;
if (t.event) {
if (s.phase === "loop" && s.pending && s.pending.length) return t;
continue;
}
if (t.phase !== s.phase) continue;
if (t.step && s.loopStep !== t.step) continue;
if (t.axis && !(s.planDone && window.V35.activeAxes(s).length > 0)) continue;
if (t.modal && s.officeModal !== t.modal) continue;
if (!t.modal && s.officeModal) continue;
return t;
}
return null;
},
markTutorial(id) {
const s = this.state;
s.tutSeen = Array.isArray(s.tutSeen) ? s.tutSeen : [];
if (id && !s.tutSeen.includes(id)) s.tutSeen.push(id);
},
whaleName(state) {
const s=state||this.state||{};
const raw=s.whaleName==null?s.modelName:s.whaleName;
return String(raw||"小鲸鱼").trim().replace(/[\s·_-]*[vV]\d+(?:\.\d+)?$/," ").trim().slice(0,12)||"小鲸鱼";
},
setWhaleName(value) {
this.state.whaleName=String(value==null?"":value).trim().slice(0,12)||"小鲸鱼";
if(window.GameSave&&GameSave.saveAuto)GameSave.saveAuto(this.state);
return this.state.whaleName;
},
fillWhaleText(value) { return this.fillVars(String(value==null?"":value).replace(/小鲸鱼|鲸鱼娘/g,()=>"{whale}")); },
setModelName(name) {
const c = this.cfg;
const n = String(name == null ? "" : name).trim().slice(0, c.MODEL_NAME_MAXLEN || 10);
this.state.modelName = n || (c.MODEL_NAME_DEFAULT || "小鲸鱼");
return this.state.modelName;
},
startProject(name) {
this.setModelName(name);
if(this.state.whaleName==null)this.state.whaleName=this.whaleName();
this.state.phase = "office";
this.state.officePaused = false;
this.state.planDone = false;
this.state.week = this.cfg.START_WEEK != null ? this.cfg.START_WEEK : 0;
this.recordLifeMilestone("first_project");
this.state.hireQuota = Math.max(3, this.state.hireQuota || 0);
this.genCandidates(this.state.ver || "V1");
this.ensureInitialCandidates();
this.refreshPaperCandidates();
return this.state;
},
addFundingIncome(amount, opts) {
const s = this.state;
const n = Math.max(0, Math.round(amount || 0));
const kind = (opts && opts.kind) || "other";
if (n <= 0) return { amount: 0, dividend: 0, net: 0, kind };
if (kind === "budget" || kind === "invest" || kind === "bailout") {
s.funding = (s.funding || 0) + n;
return { amount: n, dividend: 0, net: n, kind };
}
const d = (s.v35 && s.v35.dividend) || null;
let cut = 0, left = 0;
if (d && d.pct > 0 && (d.left || 0) > 0) {
cut = Math.round(n * d.pct);
d.left -= 1;
d.paid = (d.paid || 0) + cut;
left = d.left;
if (d.left <= 0) s.v35.dividend = null;
}
s.funding = (s.funding || 0) + (n - cut);
return { amount: n, dividend: cut, net: n - cut, kind, left };
},
brandLimit(ver) {
const by = this.cfg.BRAND_CAP_BY_VER || {};
const n = Number(by[ver || (this.state && this.state.ver) || "V1"]);
return Number.isFinite(n) ? Math.max(0, Math.min(200, Math.floor(n))) : 200;
},
brandStarsCount(brand) {
const base = Number(this.cfg.BRAND_STAR_BASE ?? 80), step = Math.max(1, Number(this.cfg.BRAND_STAR_STEP ?? 30));
const value = Math.max(0, Math.min(this.brandLimit(), Number(brand) || 0));
return Math.max(0, Math.min(5, Math.floor((value - base) / step) + 1));
},
brandProgress() {
const value = Math.max(0, Math.min(this.brandLimit(), Math.floor(Number(this.state.brand) || 0)));
const stars = this.brandStarsCount(value);
return { value, stars, next: stars >= 5 ? null : Number(this.cfg.BRAND_STAR_BASE ?? 80) + stars * Number(this.cfg.BRAND_STAR_STEP ?? 30),
stageCap: this.brandLimit(), rate: Math.max(0, Math.min(1, Number(this.cfg.BRAND_INCOME_PER_STAR ?? 0.03))) * stars };
},
changeBrand(amount, state) {
const s = state || this.state, cap = this.brandLimit(s.ver);
const before = Math.max(0, Math.min(cap, Math.floor(Number(s.brand) || 0)));
s.brand = Math.max(0, Math.min(cap, before + Math.trunc(Number(amount) || 0)));
return s.brand - before;
},
payoutIncome(amount, opts) {
const r = this.addFundingIncome(amount, opts);
if (r.dividend > 0) {
this.state.lastDividend = { cut: r.dividend, left: r.left };
}
return r;
},
archGate(archId, param) {
const c = this.cfg;
const cr = (window.V35 && window.V35.comboReq) ? window.V35.comboReq(archId, param) : null;
if (cr && cr.gate != null) return Math.max(0, Math.round(cr.gate));
const a = (c.ARCHITECTURES || []).find((x) => x.id === archId);
return a ? a.gate : null;
},
archQualityReq(archId, param) {
const c = this.cfg;
const cr = (window.V35 && window.V35.comboReq) ? window.V35.comboReq(archId, param) : null;
if (cr && cr.quality != null) return Math.max(0, Math.min(1, +cr.quality || 0));
return (c.ARCH_QUALITY_REQ || {})[archId] || 0;
},
initialRecruitment() {
const s = this.state, c = this.cfg;
if (!s || s.ver !== (c.VER_ORDER || [])[0] || s.planDone || Number(s.stageNo || 0) > 0) return null;
const required = (c.V1_STARTERS || []).map(ref => this.engOf(ref))
.filter(e => e && (!this.hireStageEligible || this.hireStageEligible(e, s.ver)));
const signed = new Set((s.engineers || []).map(e => this.engUid(e)));
const missing = required.filter(e => !signed.has(this.engUid(e)));
const values = { total: required.length, count: required.length - missing.length, missing: missing.map(e => e.name).join('、') };
const tip = String((c.UI_CFG || {}).INITIAL_RECRUIT_TIP || '').replace(/\{(total|count|missing)\}/g, (_, key) => values[key]);
return { required, missing, tip };
},
ensureInitialCandidates() {
const progress = this.initialRecruitment();
if (!progress || !progress.missing.length) return;
const s = this.state;
s.hireQuota = Math.max(Number(s.hireQuota) || 0, progress.required.length);
if (!Array.isArray(s.candidates)) s.candidates = [];
const listed = new Set(s.candidates.map(e => this.engUid(e)));
for (const template of progress.missing) if (!listed.has(this.engUid(template))) {
s.candidates.push(this.cloneEng(template)); listed.add(this.engUid(template));
}
},
confirmPlan(draft) {
const c = this.cfg, s = this.state;
if (s.planDone) return { ok: false, tip: "已经立项了" };
const initial = this.initialRecruitment();
if (initial && initial.missing.length) return { ok: false, tip: initial.tip };
if (!(s.engineers || []).some((e) => !e.resigned)) {
return { ok: false, tip: "团队里还没有工程师，先去「招聘」招人" };
}
if (!s.gpuTier) {
return { ok: false, tip: "还没有算力——先去「算力」购买 GPU，没算力开不了工" };
}
const d = draft || {};
const arch = d.arch || "dense";
const recipe = d.recipe || "chat";
const param = d.param || 7;
const aDef = (c.ARCHITECTURES || []).find((a) => a.id === arch);
if (aDef && !this.archUnlock(aDef).ok) {
return { ok: false, tip: this.unlockReqTip(aDef) };
}
if (aDef && aDef.gate != null) {
const gate = this.archGate(arch, param);
const have = this.v35On() ? s.v35.corpus.token : (s.corpus || 0);
if (gate != null && have < gate) {
return { ok: false, tip: `语料不足：${aDef.name} 需有效 token ≥ ${gate}（当前 ${Math.floor(have)}）` };
}
}
if (aDef && aDef.gpu) {
const order = c.GPU_TIER_ORDER || Object.keys(c.GPU_TIERS || {});
const curI = order.indexOf(s.gpuTier || "basic");
const needI = order.indexOf(aDef.gpu);
if (curI >= 0 && needI >= 0 && curI < needI) {
const needName = ((c.GPU_TIERS || {})[aDef.gpu] || {}).name || aDef.gpu;
return { ok: false, tip: `算力要求：${aDef.name} 需要${needName}档算力起步，先去「算力」升级` };
}
}
const capNow = this.archMaxParam(arch);
if (aDef && aDef.minParam != null && param < aDef.minParam) {
return { ok: false, tip: `${aDef.name} 需要至少 ${aDef.minParam}B 的云端基座` };
}
if (param > capNow) {
return { ok: false, tip: `参数 ${param}B 超出上限 ${capNow}B，先升级算力或换架构` };
}
s.arch = arch;
s.recipe = recipe;
s.paramTarget = param;
s.planDone = true;
const mj = this.missionJudge(s, arch, param);
const mDef = this.missionOf(s.ver);
s.mission = { ver: s.ver, arch, param, hit: !!mj.hit, reason: mj.reason || "",
name: mDef.name || "", desc: mDef.desc || "" };
const CQ = c.CORPUS_QUALITY || {};
const step = CQ.STEP || 0.2;
let mix = d.mix || {};
const cell = (v) => Math.max(0, Math.min(5, Math.round(+v || 0)));
const mixCells = { n: cell(mix.n), g: cell(mix.g), p: cell(mix.p) };
if (mixCells.n + mixCells.g + mixCells.p > 5) mixCells.n = Math.max(0, 5 - mixCells.g - mixCells.p);
if (this.v35On()) {
const q = (s.v35 && s.v35.corpus && s.v35.corpus.q) || [];
const MULT = (c.V35 && c.V35.QUALITY_MULT) || [0.5, 1.0, 1.5];
const raw = (i) => (q[i] || 0) * (MULT[i] != null ? MULT[i] : 0.5);
const total = raw(0) + raw(1) + raw(2);
if (total > 0) {
const maxG = Math.round((raw(1) / total) * 5);
const maxP = Math.round((raw(2) / total) * 5);
if (mixCells.g > maxG) return { ok: false, tip: `良好语料不足（良好折算 ${Math.round(raw(1))} / 共 ${Math.round(total)} 亿 token，最多可配 ${maxG}/5 格）` };
if (mixCells.p > maxP) return { ok: false, tip: `优质语料不足（优质折算 ${Math.round(raw(2))} / 共 ${Math.round(total)} 亿 token，最多可配 ${maxP}/5 格）` };
}
}
const shareGP = (mixCells.g + mixCells.p) * step;
const req = this.archQualityReq(arch, param);
const bonus = CQ.BONUS != null ? CQ.BONUS : 0.10;
const penalty = CQ.PENALTY != null ? CQ.PENALTY : 0.15;
const qualityMul = req <= 0 ? 1 : (shareGP >= req - 1e-9 ? 1 + bonus : 1 - penalty);
if (s.v35) {
s.v35.arch = arch; s.v35.paramTarget = param;
s.v35.qualityMix = mixCells;
s.v35.qualityMul = qualityMul;
}
s.direction = null;
s.embodiedPlanTick = (s.v35 && s.v35.tick) || 0;
s.embodiedTrainingTicks = 0;
s.triggered.push({ id: "plan", choice: `${arch}/${recipe}/${param}B`, week: s.week || 0 });
return {
ok: true, arch, recipe, param,
mission: s.mission,
quality: { cells: mixCells, shareGP, req, mul: qualityMul,
tip: req > 0 ? (qualityMul > 1 ? `语料品质达标：产出速度 ×${qualityMul.toFixed(2)}` : `语料品质未达标：产出速度 ×${qualityMul.toFixed(2)}`) : null },
};
},
buyGpu(tier) {
const c = this.cfg, s = this.state;
const t = (c.GPU_TIERS || {})[tier];
if (!t) return { ok: false, tip: "没有这一档" };
if (!Array.isArray(s.ownedGpus)) s.ownedGpus = s.gpuTier ? [s.gpuTier] : [];
if (s.ownedGpus.includes(tier)) return { ok: false, reason: "owned", tip: "已拥有该档位，无需重复购买" };
if ((s.funding || 0) < t.price) return { ok: false, tip: "经费不够" };
s.funding -= t.price;
s.ownedGpus.push(tier);
const order = c.GPU_TIER_ORDER || Object.keys(c.GPU_TIERS || {});
const top = order.filter((k) => s.ownedGpus.includes(k))
.sort((a, b) => ((c.GPU_TIERS[b] || {}).maxParam || 0) - ((c.GPU_TIERS[a] || {}).maxParam || 0))[0];
if (top) s.gpuTier = top;
const maxNow = (c.GPU_TIERS[s.gpuTier] || {}).maxParam || 7;
if (s.paramTarget > maxNow) s.paramTarget = maxNow;
return { ok: true, tier, price: t.price, maxParam: t.maxParam };
},
ownsGpu(tierId) {
const s = this.state;
if (!Array.isArray(s.ownedGpus)) s.ownedGpus = s.gpuTier ? [s.gpuTier] : [];
return s.ownedGpus.includes(tierId);
},
loadState(s) {
const def = this.newState();
this.state = Object.assign(def, s || {});
if (this.state.saveVersion === undefined) this.state.saveVersion = 0;
if (!Array.isArray(this.state.triggered)) this.state.triggered = [];
if (!Array.isArray(this.state.pending)) this.state.pending = [];
if (!Array.isArray(this.state.engineers)) this.state.engineers = [];
if (!Array.isArray(this.state.approvedArchs)) this.state.approvedArchs = [];
if (!Array.isArray(this.state.ownedGpus)) {
this.state.ownedGpus = this.state.gpuTier ? [this.state.gpuTier] : [];
}
if (this.state.fineTuneDraft === undefined) this.state.fineTuneDraft = null;
if (this.state.lastFineTune === undefined) this.state.lastFineTune = null;
const order = this.cfg.VER_ORDER || ["V1"];
if (order.indexOf(this.state.ver) < 0) this.state.ver = this.cfg.CUR_VERSION || "V1";
this.state.incBase = this.reviewIncomeBase(this.state);
if(this.state.phase!=="naming"&&this.state.whaleName==null)this.state.whaleName=this.whaleName();
[...(this.state.engineers||[]),...(this.state.candidates||[])].forEach(e=>{
this.healEngineeringTalent(e);
if(e)this.ensureStatus(e);
});
if(this.embodiedAvailable(this.state)){this.state.rank=null;if(this.state.result){for(const key of ["rankPrev","rankUp","rankBoardLen"])this.state.result[key]=null;}}
this.changeBrand(0);
if (!this.state.brandMilestones || typeof this.state.brandMilestones !== "object" || Array.isArray(this.state.brandMilestones)) {
this.state.brandMilestones = {};
order.slice(0, order.indexOf(this.state.ver)).forEach(v => { this.state.brandMilestones[v] = true; });
}
if (!this.state.usersMigrated) {
this.state.usersMigrated = true;
const vorder = this.cfg.VER_ORDER || ["V1"];
if ((this.state.users || 0) > 10000 && vorder.indexOf(this.state.ver) < 4) this.state.users = 0;
}
this.state.officePaused = false;
this.state.pendingBailout = this.pendingBailoutEvent()?.no ?? null;
this.state.pendingEvent = null;
this.state._propYieldSince = null;
this.state._tickAt = 0;
if (this.state.hireCount == null && (this.state.engineers || []).length > 3) {
this.state.hireCount = 1;
}
if (this.state.c2 && typeof this.state.c2 === "object"
&& (!this.state.c2.seen || typeof this.state.c2.seen !== "object")) {
const _la = this.state.c2.lastAns;
this.state.c2.seen = {};
if (_la) this.state.c2.seen[String(_la)] = this.state.week || 0;
}
this.healC2();
this.achvCounters();
if (this.state.phase === "recruit" || this.state.phase === "office") {
if (!this.state.modelName) this.state.modelName = this.cfg.MODEL_NAME_DEFAULT || "小鲸鱼";
if (this.state.ver === "V1" && this.state.engineers.length === 0) {
this.state.hireQuota = Math.max(3, this.state.hireQuota || 0);
this.genCandidates(this.state.ver);
} else if (!Array.isArray(this.state.candidates)) {
this.state.candidates = [];
}
const hiredIds = new Set(this.state.engineers.map((e) => e.id));
if (Array.isArray(this.state.candidates)) {
this.state.candidates = this.state.candidates.filter((c) => !hiredIds.has(c.id));
}
const seen = new Set();
this.state.engineers = this.state.engineers.filter((e) => {
if (seen.has(e.id)) return false;
seen.add(e.id);
return true;
});
}
const legacyPhases = ["loop", "minigame", "recruit", "buygpu", "direction"];
const v35 = this.ensureV35(this.state);
if (v35) this.normalizeV35(v35);
this.clearLonePoachRisk(this.state);
if (v35 && v35.tick === 0) {
const _corpusSynced = v35.corpus
&& Math.abs((v35.corpus.token || 0) - (this.state.corpus || 0)) < 1;
const _statsSynced = v35.stats
&& Math.abs((v35.stats.code || 0) - (this.state.code || 0)) < 1
&& Math.abs((v35.stats.text || 0) - (this.state.text || 0)) < 1;
if (!_corpusSynced && !_statsSynced
&& ((this.state.code || 0) + (this.state.text || 0) + (this.state.corpus || 0) > 0)) {
v35.tick = this.state.rounds || 0;
v35.stats = { code: this.state.code || 0, text: this.state.text || 0,
safety: this.state.safety || 0, stability: this.state.stability || 0 };
const _mi = Math.round((this.state.corpus || 0) / 0.5);
v35.corpus = { token: this.state.corpus || 0, items: _mi, q: [_mi, 0, 0] };
}
}
if (this.state.paperResearch && v35 && v35.paper && !v35.paper.done && (v35.paper.left || 0) <= 0) {
const _spid = this.state.paperResearch.id;
if (_spid && (this.state.papersOwned || []).indexOf(_spid) < 0) {
(this.state.papersOwned = this.state.papersOwned || []).push(_spid);
}
this.state.paperResearch = null;
}
if (this.state.phase === "review"
&& (!this.state.evalShow || !(this.state.evalShow.qs || []).length)) {
this.buildEvalShow();
}
if (legacyPhases.includes(this.state.phase)) {
this.state.phase = 'office';
this.state.pending = [];
this.state.pendingMinigame = null;
this.state.loopStep = 'report';
this.state.fineTuneDraft = null;
this.state.workClicks = {};
this.state.workQuota = {};
this.state.workGain = null;
this.state.corpusShort = 0;
this.state.corpusDemand = null;
this.state.focus = null;
this.state.focusBoost = null;
this.state.officeModal = null;
this.state.officePaused = false;
this.state._tickAt = 0;
if (!this.state.engineers.length) {
this.state.hireQuota = Math.max(3, this.state.hireQuota || 0);
this.genCandidates('V1');
this.state.officeModal = 'recruit';
}
}
if ((this.state.papersOwned || []).length) {
v35.paper.started = true;
v35.paper.done = true;
}
if (this.state.hireOrder
&& (!Array.isArray(this.state.hireOrder.roles) || !this.state.hireOrder.roles.length
|| !(this.state.hireOrder.total > 0))) {
this.state.hireOrder = null;
}
this.healPaperCandidates();
this.healEventIds();
this.healEngineerIds();
this.healNotebook();
this.healCandExpire();
this.healTraitDups();
this.healEngineerRoles();
if (Array.isArray(this.state.candidates)) this.state.candidates = this.state.candidates.filter(e => this.hireStageEligible(e, this.state.ver));
for (const role of ["pre", "data", "post", "embodied"]) this.syncEnergySlot(role);
this.syncResting();
this.healEmbodiedEra();
const previousCalendar = this.state.bodyCalendar;
const bodyCalendar = this.ensureBodyCalendar();
const calendarChanged = bodyCalendar && bodyCalendar !== previousCalendar;
this.healStageEvents();
this.healDimOverCap();
if (this.state.phase === "review") this.refreshReviewResult();
if (typeof this.state.stageNo !== "number") this.state.stageNo = 0;
if (window.GameSave && window.GameSave.loadStage && window.GameSave.saveStage) {
const anchor = window.GameSave.loadStage();
if (!anchor || !anchor.state || anchor.state.stageNo !== this.state.stageNo) {
window.GameSave.saveStage(this.state);
}
}
if (bodyCalendar && window.GameSave) {
if (calendarChanged && typeof window.GameSave.autoSave === "function") window.GameSave.autoSave(this.state);
if (typeof window.GameSave.patchStageBodyCalendar === "function") window.GameSave.patchStageBodyCalendar(this.state);
}
this.checkLifeAchievements();
if (this.state.phase === "office") this.ensureInitialCandidates();
return this.state;
},
normalizeV35(st) {
if (!st || !window.V35) return st;
const tpl = window.V35.createState(st.mode || "serious", !!st.overtime,
st.extraData || 0, st.extraPre || 0, st.extraPost || 0);
const fill = (dst, src) => {
for (const k of Object.keys(src)) {
const v = src[k], d = dst[k];
if (d === undefined || d === null) { dst[k] = v; continue; }
if (v && typeof v === "object" && !Array.isArray(v)
&& d && typeof d === "object" && !Array.isArray(d)) fill(d, v);
}
return dst;
};
fill(st, tpl);
const num = (v, dft) => (typeof v === "number" && isFinite(v)) ? v : dft;
for (const k of ["pre", "data", "post", "embodied"]) {
st.energy[k] = Math.max(0, Math.min(100, num(st.energy[k], 100)));
}
for (const k of Object.keys(st.stats)) st.stats[k] = Math.max(0, num(st.stats[k], 0));
st.corpus.token = Math.max(0, num(st.corpus.token, 0));
st.corpus.items = Math.max(0, num(st.corpus.items, 0));
if (!Array.isArray(st.corpus.q) || st.corpus.q.length !== 3) st.corpus.q = [0, 0, 0];
st.corpus.q = st.corpus.q.map((x) => Math.max(0, num(x, 0)));
st.tick = Math.max(0, Math.floor(num(st.tick, 0)));
st.preMul = num(st.preMul, 1) || 1;
st.qualityMul = num(st.qualityMul, 1) || 1;
if (st.ver == null) st.ver = this.state.ver || "V1";
return st;
},
hireStageEligible(e, stage) {
if (!e) return false;
const template = this.engOf(e);
const traits = Array.isArray(e.traits) ? e.traits : ((template && template.traits) || []);
const requiresBody = this.primaryTraitType(e) === "embodied"
|| traits.some(t => t && t.type === "embodied");
return !requiresBody || this.embodiedAvailable({ ver: stage || (this.state && this.state.ver) || "V1" });
},
genCandidates(stage) {
const c = this.cfg;
const st = stage || this.state.ver || "V1";
const week = this.state.week || 0;
if (st === "V1" && c.V1_STARTERS && c.V1_STARTERS.length) {
const n = Math.max(1, Math.min(this.state.hireQuota || 1, c.V1_STARTERS.length));
const ids = c.V1_STARTERS.slice(0, n).map((x) => this.engNoOf(x));
const hired = new Set(this.state.engineers.map((e) => this.engUid(e)));
const starters = (c.ENGINEERS || []).filter((e) => ids.indexOf(e.no) >= 0 && !hired.has(this.engUid(e)) && this.hireStageEligible(e, st));
const keep = (this.state.candidates || []).filter((x) => (x.fromHire || x.fromEvent) && this.hireStageEligible(x, st));
this.state.candidates = starters.map((e) => this.cloneEng(e)).concat(keep);
return this.state.candidates;
}
this.expireCandidates(week);
const keepHire = (this.state.candidates || []).filter(x => (x.fromHire || x.fromEvent) && this.hireStageEligible(x, st));
const pool = this.hireDrawPool(st, {
candidates: keepHire,
filter: e => this.hireWeightOf(e, st) > 0,
});
if (!pool.length) { this.state.candidates = keepHire; return this.state.candidates; }
const float = c.HIRE_FLOAT || 0;
const weighted = [];
for (const e of pool) {
const w = this.hireWeightOf(e, st);
for (let k = 0; k < Math.max(1, Math.round(w * 100)); k++) weighted.push(e);
}
const bonus = this.state.candBonus || 0;
const want = 4 + bonus;
const picked = [];
const seen = new Set();
let guard = 0;
while (picked.length < want && weighted.length && guard++ < 500) {
const idx = Math.floor(Math.random() * weighted.length);
const e = weighted[idx];
if (seen.has(e.no)) continue;
seen.add(e.no);
picked.push(e);
}
for (const e of pool) {
if (picked.length >= want) break;
if (!seen.has(e.no)) { seen.add(e.no); picked.push(e); }
}
this.state.candidates = picked.map((e) => this.cloneEng(e, float, st)).concat(keepHire);
if (bonus) this.state.candBonus = 0;
return this.state.candidates;
},
tierOf(e) {
const C = this.cfg.TIER_COLORS || {};
if (e && e.rarity && C[e.rarity]) {
return { clsKey: e.rarity, ...C[e.rarity] };
}
const T = this.cfg.TIER_THRESHOLDS || [60, 70, 80, 90];
const t = this.coreTalentOf(e);
const key = t >= (T[3] != null ? T[3] : 90) ? "rainbow"
: t >= (T[2] != null ? T[2] : 80) ? "orange"
: t >= (T[1] != null ? T[1] : 70) ? "pink"
: t >= (T[0] != null ? T[0] : 60) ? "blue" : "gray";
return { clsKey: key, ...(C[key] || {}) };
},
engLevel(e) {
let lv = 0;
for (const t of (e && e.traits) || []) {
if (t.type === "academic") continue;
lv = Math.max(lv, t.level || 1);
}
return lv || 1;
},
talentLvCap(e) {
const C = this.cfg.TALENT_LV_CAP || {};
const k = (this.tierOf(e) || {}).clsKey || "gray";
return C[k] != null ? C[k] : 5;
},
tierLabel(e) {
const n = (this.tierOf(e) || {}).name || "";
return n + "-lv" + this.engLevel(e);
},
uiTypeOf(ev) {
if (!ev) return "random";
if (ev.uiType) return ev.uiType;
if (ev.type === "fixed" || ev.type === "recruit_wait") return "fixed";
if (ev.type === "critical") return "critical";
if (ev.type === "reward") return "reward";
if (ev.type === "team") {
const c = ev.cond || {};
if (c.energy_above != null) return "positive";
return "negative";
}
return "random";
},
hirePool(st, options) {
const c = this.cfg;
const opts = options || {};
const stt = opts.state || this.state || {};
const weekAbs = (stt.week || 0) + (stt.weekOffset || 0);
const locked = stt._candLocked || {};
const range = (c.HIRE_LV_RANGE_BY_VER || {})[st] || {};
const max = range.max != null ? range.max : 5;
return (c.ENGINEERS || []).filter((e) => {
if (!this.hireStageEligible(e, st || stt.ver)) return false;
if (e.pool === false || e.starter) return false;
if (!opts.ignoreCooldown && locked[this.engUid(e)] > weekAbs) return false;
return this.engLevel(e) <= max;
});
},
hireDrawPool(st, options) {
const opts = options || {}, s = opts.state || this.state || {};
const candidates = opts.candidates || s.candidates || [];
const busy = new Set([...(s.engineers || []), ...candidates].map(e => this.engUid(e)));
const eligible = e => !busy.has(this.engUid(e)) && (!opts.filter || opts.filter(e));
const available = this.hirePool(st, {state:s}).filter(eligible);
if (available.length) return available;
const recovered = this.hirePool(st, {state:s, ignoreCooldown:true}).filter(eligible);
if (opts.resetCooldown !== false && s._candLocked) {
for (const e of recovered) delete s._candLocked[this.engUid(e)];
}
return recovered;
},
hireLvWeights(st) {
const r = (this.cfg.HIRE_LV_RANGE_BY_VER || {})[st] || {};
return Array.isArray(r.lv) ? r.lv : [1, 1, 1, 1, 1];
},
hireWeightOf(e, st) {
const w = this.hireLvWeights(st);
const i = this.engLevel(e) - 1;
return (i >= 0 && i < w.length) ? (w[i] || 0) : 0;
},
mainTraitLevel(e) {
const t = this.mainTrait(e);
return (t && t.level) || 1;
},
dataTraitLevel(e) {
for (const t of (e && e.traits) || []) if (t.type === "data") return t.level || 1;
return 1;
},
teamRoleEngs(st, role) {
const s = this.state, wk = s.week || 0;
const out = [];
for (const e of s.engineers || []) {
if (e.resigned) continue;
if (this.v35RoleOf(e) !== role) continue;
if (e.restWeek === wk) continue;
if (e.joinTick != null && st && st.tick != null && st.tick < e.joinTick) continue;
out.push(e);
}
return out;
},
syncEnergySlot(role) {
const s = this.state;
if (!role || !s || !s.v35 || !s.v35.energy || s.v35.energy[role] == null) return;
const engs = this.teamRoleEngs(s.v35, role);
if (!engs.length) return;
let sum = 0;
for (const e of engs) { this.ensureStatus(e); sum += e.energy || 0; }
s.v35.energy[role] = Math.round(sum / engs.length);
},
teamDataTraitLevels(st) {
return this.productionRoleEngs(st, "data").map((e) => this.productionTraitLevel(e, "data"));
},
teamRoleTraitLevel(st, role) {
const s = this.state, wk = s.week || 0;
for (const e of s.engineers || []) {
if (e.resigned) continue;
if (this.v35RoleOf(e) !== role) continue;
if (e.restWeek === wk) continue;
if (e.joinTick != null && st && st.tick != null && st.tick < e.joinTick) continue;
return this.mainTraitLevel(e);
}
return 1;
},
teamPreTraitLevel(st) { return this.teamRoleTraitLevel(st, "pre"); },
teamPostTraitLevel(st) { return this.teamRoleTraitLevel(st, "post"); },
coreTalentOf(e) {
const type = this.primaryTraitType(e);
let keys = type ? this.traitUpgradeStats(type) : [];
if (!keys.length) {
keys = { pretrain: ["algo"], post: ["algo"], engineer: ["code"], data: ["code", "text"], academic: ["text"] }[type]
|| { pretrain: ["algo"], data: ["code"], post: ["algo"], infra: ["code"] }[e && e.type] || ["algo"];
}
this.healEngineeringTalent(e);
const s = (e && e.stats) || {};
let sum = 0;
for (const k of keys) sum += (s[k] || 0);
return sum / keys.length;
},
salaryOf(e) {
const c = this.cfg;
const lv = this.mainTraitLevel(e);
const base = (c.TRAIT_BASE_SALARY || {})[lv] || 90000;
const t = Math.max(0, Math.min(100, this.coreTalentOf(e)));
return Math.round(base * (0.6 + (t / 100) * (t / 100) * 0.8));
},
candExpireAbs(cd) {
const s = this.state;
if (cd.expireAbsWeek != null) return cd.expireAbsWeek;
if (cd.expireWeek != null) return cd.expireWeek + (s.weekOffset || 0);
return null;
},
expireCandidates(week) {
const c = this.cfg, s = this.state;
if (!Array.isArray(s.candidates) || !s.candidates.length) return [];
const ttl = c.CANDIDATE_TTL_WEEKS || 0;
const lock = c.CANDIDATE_LOCK_WEEKS || 0;
if (ttl <= 0) return [];
const now = this.absWeek();
const gone = [];
const keep = [];
for (const cd of s.candidates) {
const exp = this.candExpireAbs(cd);
if (exp != null && now >= exp) {
gone.push(cd);
if (lock > 0) {
s._candLocked = s._candLocked || {};
const _u = this.engUid(cd);
if (_u) s._candLocked[_u] = now + lock;
}
} else keep.push(cd);
}
if (gone.length) s.candidates = keep;
return gone;
},
payRecruitCost(times) {
const c = this.cfg, s = this.state;
const n = Math.max(1, Math.round(times || 1));
const cost = Math.max(0, Math.round(c.RECRUIT_COST || 0)) * n;
if (!cost) return { ok: true, cost: 0 };
if ((s.funding || 0) < cost) {
return { ok: false, cost, tip: `发布需求需要 ${Math.round(cost / 10000)} 万经费，账上不够了` };
}
s.funding -= cost;
return { ok: true, cost };
},
cloneEng(e, float, stage) {
const c = this.cfg;
const f = float || 0;
const template={...e,stats:{...(e.stats||{})}};this.healEngineeringTalent(template);
const stats = template.stats;
if (f > 0) {
for (const k of this.engStatKeys(template)) {
if (stats[k] != null) stats[k] = Math.max(0, Math.min(100, stats[k] + Math.round((Math.random() * 2 - 1) * f)));
}
}
const maxLv = (c.STAGE_TRAIT_MAX || {})[stage] || 5;
const traits = [];
const _dupAt = new Map();
for (const t of (e.traits || [])) {
const lv = Math.min(t.level, maxLv);
if (_dupAt.has(t.type)) {
const j = _dupAt.get(t.type);
if (lv > traits[j].level) traits[j] = { ...traits[j], level: lv };
} else {
_dupAt.set(t.type, traits.length);
traits.push({ ...t, level: lv });
}
}
const out = {
...e,
traits,
stats,
resume: { ...(e.resume || {}) },
stage: [...(e.stage || ["V1"])],
...this.initStatus(e),
};
const _eno = this.engNoOf(e);
if (_eno != null) { out.no = _eno; out.id = this.engIdOf(_eno); }
else if (out.id == null) { out.id = "e_tmp_" + Math.random().toString(36).slice(2, 8); }
out.type = this.primaryTraitType(out);
out.salary = this.salaryOf(out);
const ttl = c.CANDIDATE_TTL_WEEKS || 0;
if (ttl > 0 && !e.starter) out.expireAbsWeek = this.absWeek() + ttl;
return out;
},
initStatus(e) {
const st = this.cfg.ENG_STATUS || {};
return { energy: st.ENERGY_INIT != null ? st.ENERGY_INIT : 100 };
},
ensureStatus(e) {
if (e.energy == null) {
const d = this.initStatus(e);
if (e.energy == null) e.energy = d.energy;
}
return e;
},
hire(id) {
const c = this.cfg;
const s = this.state;
const idx = s.candidates.findIndex((x) => x.id === id);
const quotaOn = s.phase === "recruit";
if (idx < 0 || (quotaOn && (s.hiredThisRound || 0) >= (s.hireQuota || 1))) return false;
if (!this.hireStageEligible(s.candidates[idx], s.ver)) {
return { ok: false, reason: "stage_locked", tip: "具身智能工程师在 V5 起开放招聘" };
}
const capN = this.seatCap();
const aliveN = s.engineers.filter((x) => !x.resigned).length;
if (aliveN >= capN) {
this.toastSeatFull = true;
return { ok: false, reason: "seat_full", tip: `座位已满（${aliveN}/${capN}）：先辞退一人再录用` };
}
const eng = s.candidates[idx];
if (s.engineers.some((e) => this.engUid(e) === this.engUid(eng))) {
s.candidates.splice(idx, 1);
return { ok: false, reason: "dup", tip: "TA 已经在团队里了" };
}
this.ensureStatus(eng);
eng.weeksNoRaise = 0;
s.engineers.push(eng);
if (!eng.starter) s.hireCount = (s.hireCount || 0) + 1;
s.hiredThisRound = (s.hiredThisRound || 0) + 1;
s.candidates.splice(idx, 1);
this.assignSeat(eng.id);
if (this.v35On && this.v35On() && eng.joinTick == null) {
const v = this.cfg.V35 || {};
if (this.v35RoleOf(eng) === "data") eng.joinTick = v.JOIN_DATA != null ? v.JOIN_DATA : 6;
else if (this.v35RoleOf(eng) === "post") eng.joinTick = v.JOIN_POST != null ? v.JOIN_POST : 18;
}
if (this.v35On && this.v35On() && s.v35 && !eng.starter) {
const role = this.v35RoleOf(eng);
if (role === "pre") s.v35.extraPre = (s.v35.extraPre || 0) + 1;
else if (role === "data") s.v35.extraData = (s.v35.extraData || 0) + 1;
else if (role === "post") s.v35.extraPost = (s.v35.extraPost || 0) + 1;
}
this.syncEnergySlot(this.v35RoleOf(eng));
return true;
},
canProceedRecruit() {
const s = this.state;
const initial = this.initialRecruitment();
if (initial && initial.required.length) return initial.missing.length === 0;
return (s.hiredThisRound || 0) >= (s.hireQuota || 1);
},
openRecruit(opts) {
const s = this.state;
const selected = opts && opts.pick && (this.engOf(opts.pick) || this.engByKey(opts.pick));
if (selected && !this.hireStageEligible(selected, s.ver)) return false;
s.phase = "recruit";
s.hireQuota = (opts && opts.quota) || 1;
s.hireFlow = (opts && opts.flow) || "mid";
s.hiredThisRound = 0;
const pick = opts && opts.pick;
if (pick) {
const e = this.engOf(pick) || this.engByKey(pick);
s.candidates = e ? [this.cloneEng(e)] : [];
} else {
this.genCandidates(s.ver || "V1");
}
return true;
},
allowedGpuTiers() {
const c = this.cfg, s = this.state;
const list = (c.GPU_TIERS_BY_VER || {})[s.ver || "V1"];
return (Array.isArray(list) && list.length) ? list : (c.GPU_TIER_ORDER || []);
},
buyTier(tierId) {
const c = this.cfg;
const s = this.state;
const t = c.GPU_TIERS[tierId];
if (!t || s.funding < t.price) return false;
if (!this.allowedGpuTiers().includes(tierId)) return false;
if (!Array.isArray(s.ownedGpus)) s.ownedGpus = s.gpuTier ? [s.gpuTier] : [];
if (s.ownedGpus.includes(tierId)) return true;
s.funding -= t.price;
s.ownedGpus.push(tierId);
if (!s.gpuTier || t.maxParam > ((c.GPU_TIERS[s.gpuTier] || {}).maxParam || 0)) s.gpuTier = tierId;
return true;
},
chooseTarget(param) {
const c = this.cfg;
const s = this.state;
const maxP = c.GPU_TIERS[s.gpuTier].maxParam;
if (!c.TARGET_PARAMS.includes(param) || param > maxP) return false;
s.paramTarget = param;
return true;
},
archMaxParam(archId) {
const c = this.cfg, s = this.state;
const a = (c.ARCHITECTURES || []).find((x) => x.id === archId);
const gpuMax = (c.GPU_TIERS[s.gpuTier || "basic"] || {}).maxParam || 7;
let cap = a && a.maxParam > 0 ? Math.min(a.maxParam, gpuMax) : gpuMax;
const by = a && a.maxParamByVer, order = c.VER_ORDER || ["V1"];
if (by && typeof by === "object" && !Array.isArray(by)) {
const at = order.indexOf(s.ver || "V1");
let stageCap = null;
for (const ver of order.slice(0, at < 0 ? 0 : at + 1)) {
if (!Object.prototype.hasOwnProperty.call(by, ver)) continue;
const value = Number(by[ver]);
if (Number.isFinite(value) && value > 0) stageCap = value;
}
if (stageCap != null) cap = Math.min(cap, stageCap);
}
return cap;
},
setDirStep(step) {
const s = this.state;
if (!["plan", "leader", "corpus", "confirm"].includes(step)) return false;
s.dirStep = step;
return true;
},
confirmDirection() {
const s = this.state;
const idx = s.dirPick == null ? 0 : s.dirPick;
const opts = [
{ text: "A. 蒸馏 GPT 输出获得语料", effects: { code: 3, text: 3, brand: -20 }, flag: "distill" },
{ text: "B. 雇佣数据生产专员（-20万）", effects: { funding: -200000, text: 4, safety: 2 }, flag: "hire_data" },
{ text: "C. 大规模爬取公开语料（+2周，安全-4）", effects: { time_cost: 2, safety: -4 }, flag: "scrape" },
];
const o = opts[idx];
if (!o) return;
s.direction = o.flag;
if (!s.arch) s.arch = "dense";
if (!s.recipe) s.recipe = "chat";
if (!s.leader) {
const first = s.engineers.find((e) => !e.resigned);
s.leader = first ? first.id : null;
}
s.leaderOverworked = !!(s.leader && s.lastLeader && s.leader === s.lastLeader);
if (s.leaderOverworked) {
this.addEnergyAll(-10);
}
this.applyEffects(o.effects, s);
s.week = this.cfg.START_WEEK + (o.effects.time_cost || 0);
s.phase = "loop";
s.step = 0;
s.triggered.push({ id: "direction", choice: o.flag, week: 0 });
s.dirStep = "plan";
this.maybeRefer();
},
rollVisitor() {
const c = this.cfg, s = this.state;
const prob = (c.VISIT_PROB_BY_VER || {})[s.ver || "V1"] != null
? (c.VISIT_PROB_BY_VER || {})[s.ver || "V1"] : 0.25;
s.visitors = Array.isArray(s.visitors) ? s.visitors : [];
s.flags = s.flags || {};
if (s.pendingVisitor) return null;
if (Math.random() >= prob) return null;
const pool = (c.VISITORS || []).filter((v) => !s.visitors.includes(v.id));
if (!pool.length) return null;
const v = pool[Math.floor(Math.random() * pool.length)];
s.visitors.push(v.id);
s.flags["mentor_" + v.arch] = true;
s.pendingVisitor = { id: v.id, name: v.name, title: v.title, say: v.say || [], arch: v.arch };
return s.pendingVisitor;
},
maybeRefer() {
const c = this.cfg, s = this.state;
s.flags = s.flags || {};
s.visitors = Array.isArray(s.visitors) ? s.visitors : [];
const ev = this.evByKey("V_REFER");
if (!ev) return null;
const hiredIds = new Set(s.engineers.map((e) => e.id));
for (const v of c.VISITORS || []) {
if (!s.flags["mentor_" + v.arch]) continue;
if (hiredIds.has("vis_" + v.id)) continue;
if (v.arch !== s.arch) continue;
s.pendingVisitor = { id: v.id, name: v.name, title: v.title, say: [], arch: v.arch };
const who = s.engineers.find((e) => !e.resigned);
s.pending = [{ ...ev,
targetId: who ? who.id : null,
targetName: v.name,
visitorId: v.id,
}];
return v;
}
return null;
},
rollNews() {
const c = this.cfg, s = this.state;
const freq = (c.NEWS_FREQ_BY_VER || {})[s.ver || "V1"];
if (freq == null || freq <= 0) return null;
s.newsSeen = Array.isArray(s.newsSeen) ? s.newsSeen : [];
if (s.pendingNews) return null;
if (Math.random() > freq) return null;
const pool = (c.NEWS || []).filter((n) => !s.newsSeen.includes(n.id));
const src = pool.length ? pool : (c.NEWS || []);
if (!src.length) return null;
const n = src[Math.floor(Math.random() * src.length)];
s.newsSeen.push(n.id);
const who = s.engineers.filter((e) => !e.resigned);
const pick = who.length ? who[Math.floor(Math.random() * who.length)] : null;
s.pendingNews = { ...n, who: pick ? pick.name : "组里的同学" };
return s.pendingNews;
},
gameWeekOfDate(dateStr) {
const c = this.cfg;
const start = new Date((c.TRAIN_TIMELINE && c.TRAIN_TIMELINE.startDate) || "2023-06-26");
const d = new Date(dateStr);
const diff = Math.floor((d - start) / 86400000);
return diff < 0 ? 1 : Math.floor(diff / 7) + 1;
},
absWeek() {
const s = this.state || {};
return (s.week || 0) + (s.weekOffset || 0);
},
validBodyCalendar(marker, state) {
if (!marker || typeof marker !== "object" || Array.isArray(marker) || marker.schema !== 1
|| !Number.isSafeInteger(marker.offsetWeeks) || !Number.isSafeInteger(marker.anchorWeek) || marker.anchorWeek < 1
|| !/^\d{4}-\d{2}-\d{2}$/.test(marker.anchorDate || "")) return false;
const parsed = Date.parse(marker.anchorDate + "T00:00:00Z");
if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== marker.anchorDate) return false;
const s = state || this.state || {};
const operational = (Number(s.week) || 0) + (Number(s.weekOffset) || 0);
const week = Math.max(0, Math.floor(Number.isFinite(operational) ? operational : 0) + marker.offsetWeeks);
const projected = parsed + (week - marker.anchorWeek) * 7 * 86400000;
return Number.isSafeInteger(week) && Number.isFinite(new Date(projected).getTime());
},
ensureBodyCalendar(state) {
const s = state || this.state;
if (!s || !this.embodiedAvailable(s)) return null;
const saved = s.bodyCalendar;
if (this.validBodyCalendar(saved, s)) return saved;
const cfg = (this.cfg.EMBODIED || {}).CALENDAR || {};
const anchorWeek = Math.max(1, Math.floor(Number(cfg.ANCHOR_WEEK) || 141));
const bodyVersions = (this.cfg.VER_ORDER || []).filter(v => this.embodiedAvailable({ ver: v }));
const current = bodyVersions.indexOf(s.ver);
const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const abs = nonnegative(s.week) + nonnegative(s.weekOffset);
const origin = (s.lifeMilestones || {}).body_V5;
let elapsed = nonnegative(s.week), estimatedStages = [];
if (origin && Number.isFinite(origin.absWeek) && origin.absWeek >= 0 && origin.absWeek <= abs) {
elapsed = abs - origin.absWeek;
} else {
const attempts = (Array.isArray(s.codexLog) ? s.codexLog : []).filter(x => x && x.ver === s.ver
&& Number.isFinite(Number(x.week)) && Number(x.week) >= 0);
const lastAttempt = attempts[attempts.length - 1];
if (lastAttempt && s.result && (s.result.settled || s.phase === "bonus" || s.phase === "over")
&& nonnegative(lastAttempt.week) === nonnegative(s.week)) attempts.pop();
elapsed += attempts.reduce((sum, x) => sum + nonnegative(x.week), 0);
for (const ver of bodyVersions.slice(0, Math.max(0, current))) {
const log = (Array.isArray(s.codexLog) ? s.codexLog : []).filter(x => x && x.ver === ver
&& Number.isFinite(Number(x.week)) && Number(x.week) >= 0);
if (log.length) elapsed += log.reduce((sum, x) => sum + nonnegative(x.week), 0);
else {
const snapshots = [(s.stageMarks || {})[ver], ...(Array.isArray(s.modelHistory) ? s.modelHistory : []).filter(x => x && x.ver === ver)]
.filter(x => x && Number.isFinite(Number(x.week)) && Number(x.week) >= 0);
if (snapshots.length) elapsed += Math.max(...snapshots.map(x => nonnegative(x.week)));
else {
const idx = (this.cfg.VER_ORDER || []).indexOf(ver);
elapsed += nonnegative((this.cfg.MIN_WEEKS_BY_VER || [])[idx]);
estimatedStages.push(ver);
}
}
}
}
const anchorDate = this.calendarDateForWeek(anchorWeek);
s.bodyCalendar = { schema: 1, anchorWeek, anchorDate, offsetWeeks: anchorWeek + elapsed - abs,
normalizedAt: new Date().toISOString(), inferredElapsedWeeks: elapsed, estimatedStages };
return s.bodyCalendar;
},
calendarWeek(abs, state) {
const s = state || this.state || {}, marker = this.ensureBodyCalendar(s);
const operational = abs == null ? (Number(s.week) || 0) + (Number(s.weekOffset) || 0) : Number(abs);
return Math.max(0, Math.floor(Number.isFinite(operational) ? operational : 0) + (marker ? marker.offsetWeeks : 0));
},
calendarDateForWeek(week) {
const start = (this.cfg.TRAIN_TIMELINE || {}).startDate || "2023-06-26";
const parsed = Date.parse(start + "T00:00:00Z");
const epoch = Number.isFinite(parsed) ? parsed : Date.UTC(2023, 5, 26);
return new Date(epoch + (Math.max(1, Math.floor(Number(week) || 1)) - 1) * 7 * 86400000).toISOString().slice(0, 10);
},
calendarDate(abs, state) {
const s = state || this.state || {}, marker = this.ensureBodyCalendar(s), week = this.calendarWeek(abs, s);
if (!marker) return this.calendarDateForWeek(week);
return new Date(Date.parse(marker.anchorDate + "T00:00:00Z") + (week - marker.anchorWeek) * 7 * 86400000).toISOString().slice(0, 10);
},
calendarLabel(abs) {
const marker = this.ensureBodyCalendar();
const parts = (marker ? marker.anchorDate : this.calendarDate(abs)).split("-").map(Number);
const week = Math.min(3, Math.floor((parts[2] - 1) / 7)) + (marker ? this.calendarWeek(abs) - marker.anchorWeek : 0);
const month = parts[0] * 12 + parts[1] - 1 + Math.floor(week / 4);
return Math.floor(month / 12) + "年" + ((month % 12) + 1) + "月 第" + (((week % 4) + 4) % 4 + 1) + "周";
},
calendarNewsAtCurrentWeek() {
const s = this.state, marker = this.ensureBodyCalendar(s), done = s.newsTimelineDone || {};
const week = this.calendarWeek();
const dated = (this.cfg.NEWS_TIMELINE || []).filter(n => n.id && n.title && !done[n.id]
&& (marker ? marker.anchorWeek + Math.floor((Date.parse(n.date + "T00:00:00Z") - Date.parse(marker.anchorDate + "T00:00:00Z")) / (7 * 86400000))
: this.gameWeekOfDate(n.date)) === week);
if (!marker) return dated;
const elapsed = week - marker.anchorWeek;
const relative = (((this.cfg.EMBODIED || {}).CALENDAR || {}).NEWS_TIMELINE || []).filter(n => n.id && n.title
&& Number.isInteger(n.week) && n.week === elapsed && !done[n.id]).map(n => ({ ...n, date: this.calendarDate() }));
return dated.concat(relative).filter((n, i, list) => list.findIndex(x => x.id === n.id) === i);
},
publishCalendarNews() {
const s = this.state;
s.newsTimelineDone = s.newsTimelineDone || {};
const news = this.calendarNewsAtCurrentWeek();
for (const n of news) {
s.newsTimelineDone[n.id] = true;
this.pushNews({ ...n, text: this.fillWhaleText(this.noticeTpl(n.desc || n.text || "")) });
}
return news.length;
},
recordLifeMilestone(key, data) {
const s = this.state;
if (!s || !key) return null;
if (!s.lifeMilestones || typeof s.lifeMilestones !== "object" || Array.isArray(s.lifeMilestones)) s.lifeMilestones = {};
if (s.lifeMilestones[key]) return s.lifeMilestones[key];
return (s.lifeMilestones[key] = { ...(data || {}), at: new Date().toISOString(), ver: s.ver || "V1",
week: s.week || 0, absWeek: this.absWeek(), calendarDate: this.calendarDate(),
modelName: s.modelName || "", whaleName: this.whaleName() });
},
payrollTotal() {
return (this.state.engineers || []).filter((e) => !e.resigned).reduce((a, e) => a + (e.salary || 0), 0);
},
noticeTpl(str) {
if (!str || str.indexOf("{name}") < 0) return str;
const alive = (this.state.engineers || []).filter((e) => !e.resigned);
const who = alive.length ? alive[Math.floor(Math.random() * alive.length)].name : "组里的同学";
return str.replace(/\{name\}/g, who);
},
pushNews(o) {
const c = this.cfg, s = this.state;
const n = o || {};
if (!n.title) return null;
s.newsFeed = s.newsFeed || [];
const feedMax = (c.NEWS_PAGE && c.NEWS_PAGE.FEED_MAX) || 60;
const item = {
id: n.id || ("NW_" + s.rounds),
title: n.title,
text: n.text || "",
src: n.src || "鲸华社 BOT",
week: this.absWeek(),
date: n.date || (this.embodiedAvailable(s) ? this.calendarDate() : null),
img: n.img || null,
imgAlt: n.imgAlt || "",
comments: this.buildNewsComments({ id: n.id }),
};
s.newsFeed.unshift(item);
if (s.newsFeed.length > feedMax) s.newsFeed.length = feedMax;
s.newsUnread = (s.newsUnread || 0) + 1;
return item;
},
buildNewsComments(n) {
const c = this.cfg, s = this.state;
const NC = c.NEWS_COMMENTS || {};
let pool = (n && n.id && Array.isArray((NC.byId || {})[n.id])) ? NC.byId[n.id]
: (Array.isArray(NC.pool) ? NC.pool : []);
const alive = (s.engineers || []).filter((e) => !e.resigned);
const num = pool.length ? Math.min(pool.length, 1 + Math.floor(Math.random() * 2)) : 0;
const used = new Set();
const list = [];
for (let i = 0; i < num; i++) {
let t = pool[Math.floor(Math.random() * pool.length)];
let guard = 6;
while (used.has(t) && guard-- > 0) t = pool[Math.floor(Math.random() * pool.length)];
if (used.has(t) || !t) continue;
used.add(t);
const who = alive.length ? alive[Math.floor(Math.random() * alive.length)].name : "隔壁组的同学";
list.push({ who, t });
}
return list;
},
canEarlyReview() {
const c = this.cfg, s = this.state;
if (this.v35On()) return false;
const er = c.EARLY_REVIEW || {};
if (er.enabled === false) return false;
if (s.week >= c.TOTAL_WEEKS) return false;
if (s.week < (er.minWeek != null ? er.minWeek : 4)) return false;
const r = this.evaluate();
return this.isPassLike(r);
},
archUnlock(a) {
const c = this.cfg, s = this.state;
if (!a) return { ok: true, verOk: true, paperOk: true, approvalOk: true };
const order = c.VER_ORDER || ["V1"];
const vi = order.indexOf(s.ver || "V1");
const verOk = order.indexOf((a.unlock || "V1")) <= vi;
const byApproval = a.unlockBy === "approval" || a.unlockBy === "embodied";
const approved = Array.isArray(s.approvedArchs) ? s.approvedArchs : [];
const approvalOk = !byApproval || approved.includes(a.id);
const paperOk = byApproval || !a.unlockPaper || this.hasPaper(a.unlockPaper);
return { ok: verOk && paperOk && approvalOk, verOk, paperOk, approvalOk, byApproval };
},
unlockReqTip(a) {
const c = this.cfg;
if (a && (a.unlockBy === "approval" || a.unlockBy === "embodied")) {
return `${a.name} 还在等团队把方案定下来 —— 进入 ${a.unlock} 后由团队提案、你点头即可立项`;
}
const pt = a && a.unlockPaper ? this.paperOf(a.unlockPaper) : null;
if (a && a.unlockPaper && pt) return `${a.name} 需要先研读《${pt.title}》才能解锁`;
return a ? `${a.name} 将在 ${a.unlock} 解锁` : "";
},
chooseArch(id) {
const c = this.cfg, s = this.state;
if (s.phase !== "direction") return { ok: false, tip: "只能在立项时选择" };
if ((s.ver || "V1") === "V1") return { ok: false, tip: "V1 阶段使用固定方案" };
const a = (c.ARCHITECTURES || []).find((x) => x.id === id);
if (!a) return { ok: false, tip: "未知架构" };
const u = this.archUnlock(a);
if (!u.ok) return { ok: false, tip: this.unlockReqTip(a) };
s.arch = id;
return { ok: true };
},
FREE_CONFERENCE_COST: 100000,
doFreeAction(kind) {
const c = this.cfg, s = this.state;
if (kind === "corpus") return this.buyCorpus();
s.freeActions = s.freeActions || { paper: true, conference: true };
if (kind === "paper") {
if (!s.freeActions.paper) return { ok: false, tip: "这轮已经刷过论文了，下轮再来" };
s.freeActions.paper = false;
const roll = Math.random();
const cap = this.statCap();
if (roll < 0.45) {
const keys = this.baseDims();
const k = keys[Math.floor(Math.random() * keys.length)];
const before = s[k];
s[k] = Math.min(this.statLimit(k, cap), s[k] + 2);
return { ok: true, msg: `📄 挖到一篇好论文！${this.statLabel(k)} +${s[k] - before}` };
}
if (roll < 0.8) return { ok: true, msg: "📄 刷了一晚上 arXiv，全是水文。信息量 ≈ 0。" };
this.addEnergyAll(4);
return { ok: true, msg: "📄 论文本身一般，但组内讨论很热烈，全员体力 +4" };
}
if (kind === "conference") {
if (!s.freeActions.conference) return { ok: false, tip: "这轮已经参加过学术会议了" };
const cost = c.FREE_CONFERENCE_COST != null ? c.FREE_CONFERENCE_COST : this.FREE_CONFERENCE_COST;
if (s.funding < cost) return { ok: false, tip: `经费不足（需要 ${cost / 10000} 万）` };
s.freeActions.conference = false;
s.funding -= cost;
const brandGain = this.changeBrand(4);
this.addEnergyAll(4);
return { ok: true, msg: `🎓 学术会议收获不小：品牌 +${brandGain}、全员体力 +4（-${Math.round(cost / 10000)} 万经费）` };
}
return { ok: false, tip: "未知的自由行动" };
},
doTeamBuild(kind, targetId) {
const c = this.cfg, s = this.state;
const tb = c.TEAM_BUILD || {};
s.tbRound = s.tbRound || { team: false, meeting: false };
if (this.offworkNow() && (kind === "team" || kind === "meeting")) {
return { ok: false, tip: "🌙 都下班了还团什么建，明天上班再说吧" };
}
s.tbTalked = s.tbTalked || {};
s.tbTrained = s.tbTrained || {};
const DEF = { team: 100000, meeting: 0, talk: 0, bonus: 200000, train: 150000 };
const cost = (k) => {
const key = k.toUpperCase() + "_COST";
return tb[key] != null ? tb[key] : DEF[k];
};
const pay = (k) => {
const v = cost(k);
if (s.funding < v) return { ok: false, tip: `经费不足（需要 ${v / 10000} 万）` };
s.funding -= v;
return null;
};
const clamp = (v) => Math.max(0, Math.min(100, v));
if (kind === "team") {
if (s.tbRound.team) return { ok: false, tip: "本周已经团建过了，下周再来" };
const blocked = pay("team");
if (blocked) return blocked;
s.tbRound.team = true;
this.addEnergyAll(10);
return { ok: true, msg: "🎉 团建圆满结束：全员体力 +10" };
}
if (kind === "meeting") {
const mw = s.tbRound.meetingWeek;
const now = this.absWeek();
if (mw != null && now - mw < 2) {
return { ok: false, tip: "这两周已经聚餐过了，下下周再来吧" };
}
s.tbRound.meetingWeek = now;
this.addEnergyAll(8);
return { ok: true, msg: "🍜 聚餐热热闹闹：全员体力 +8" };
}
const e = s.engineers.find((x) => x.id === targetId && !x.resigned);
if (!e) return { ok: false, tip: "先选一位工程师" };
this.ensureStatus(e);
if (kind === "talk") {
if (s.tbTalked[e.id]) return { ok: false, tip: `这轮已经和 ${e.name} 谈过了` };
s.tbTalked[e.id] = true;
const talkGain = ((c.TEAM_BUILD || {}).TALK_ENERGY != null) ? c.TEAM_BUILD.TALK_ENERGY : 12;
const dEn = this.addEnergy(e, talkGain);
return { ok: true, msg: `🗣 和 ${e.name} 单独聊了聊：体力 +${dEn}` };
}
if (kind === "bonus") {
const blocked = pay("bonus");
if (blocked) return blocked;
const raiseEn = ((c.TEAM_BUILD || {}).RAISE_ENERGY != null) ? c.TEAM_BUILD.RAISE_ENERGY : 30;
const dEn = this.addEnergy(e, raiseEn);
return { ok: true, msg: `💰 ${e.name} 收到特别奖金：体力 +${dEn}（-${Math.round(cost("bonus") / 10000)} 万）` };
}
if (kind === "rest") {
if (s.freeActions == null) s.freeActions = {};
if ((s.tbRested || {})[e.id]) return { ok: false, tip: `${e.name} 这轮已经在休息了` };
const gain = tb.REST_ENERGY != null ? tb.REST_ENERGY : 35;
e.restWeek = s.week || 0;
e.energyPending = (e.energyPending || 0) + gain;
this.syncResting();
s.tbRested = s.tbRested || {};
s.tbRested[e.id] = true;
s.workClicks = s.workClicks || {};
if (s.workQuota) s.workQuota[e.id] = (s.workClicks[e.id]) || 0;
return { ok: true, msg: `😴 ${e.name} 下班休息了：本周不产出，下周上班恢复体力 +${gain}` };
}
if (kind === "train") {
if (s.tbTrained[e.id]) return { ok: false, tip: `${e.name} 这轮已经培训过了` };
const need = tb.TRAIN_ENERGY != null ? tb.TRAIN_ENERGY : 20;
if (e.energy < need) return { ok: false, tip: `${e.name} 太累了（体力 ≥${need} 才能培训，当前 ${e.energy}）` };
const blocked = pay("train");
if (blocked) return blocked;
s.tbTrained[e.id] = true;
this.addEnergy(e, -need);
const keys = this.baseDims();
const k = keys[Math.floor(Math.random() * keys.length)];
const cap = this.statCap();
const before = s[k];
s[k] = Math.min(this.statLimit(k, cap), s[k] + 3);
return { ok: true, msg: `🏋 ${e.name} 培训归来：${this.statLabel(k)} +${s[k] - before}（属性越高，阶段结算时词条升级概率越大）` };
}
return { ok: false, tip: "未知的团队建设操作" };
},
startMinigame(kindRaw) {
const c = this.cfg, s = this.state;
const kind = String(kindRaw || "").toLowerCase();
if (this.embodiedAvailable(s) && (kind === "sft" || kind === "rm")) {
this.retireLegacyMinigame(s);
return false;
}
const mg = (c.MINIGAMES || {})[kind.toUpperCase()];
const bank = kind === "sft" ? (c.SFT_DATA || []) : (c.RM_SETS || []);
if (!mg || !bank.length) return false;
const rounds = Math.min(mg.ROUNDS || 3, bank.length);
const idx = [...bank.keys()];
for (let i = idx.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[idx[i], idx[j]] = [idx[j], idx[i]];
}
if (window.OfficePause) {
if (!s.minigame) OfficePause.acquire(this, "inspection");
} else {
s._mgWasPaused = !!s.officePaused;
s.officePaused = true;
}
s.officeModal = "minigame";
const optOrder = idx.slice(0, rounds).map((bankIdx) => {
const it = bank[bankIdx];
const n = kind === "sft" ? 3 : ((it && it.items) ? it.items.length : 4);
const arr = [...Array(n).keys()];
for (let i = arr.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[arr[i], arr[j]] = [arr[j], arr[i]];
}
return arr;
});
s.minigame = {
kind, round: 0, total: rounds, hits: 0,
order: idx.slice(0, rounds),
optOrder,
picked: null,
rank: [],
log: [],
gains: {},
};
s.pendingMinigame = null;
return true;
},
minigamePick(optIdx) {
const c = this.cfg, s = this.state;
const m = s.minigame;
if (!m || m.picked || m.kind !== "sft") return null;
const bank = m.kind === "sft" ? (c.SFT_DATA || []) : (c.RM_SETS || []);
const item = bank[m.order[m.round]];
if (!item) return null;
let ok = false, why = "";
{
const choice = m.optOrder[m.round][optIdx];
ok = choice === 0;
const src = choice === 0 ? item.good : item.bads[choice - 1];
why = src.why;
m.picked = { idx: optIdx, ok, why, choice };
}
if (ok) m.hits += 1;
m.log.push({ q: item.q, ok, score: ok ? 1 : 0 });
return m.picked;
},
minigameRank(optIdx) {
const s = this.state;
const m = s.minigame;
if (!m || m.kind !== "rm" || m.picked) return null;
m.rank = Array.isArray(m.rank) ? m.rank : [];
const n = (m.optOrder[m.round] || []).length;
if (m.rank.includes(optIdx)) return null;
if (m.rank.length >= n) return null;
m.rank.push(optIdx);
return { rank: m.rank.slice(), full: m.rank.length >= n };
},
minigameResetRank() {
const m = this.state.minigame;
if (!m) return null;
m.rank = [];
return { rank: [] };
},
minigameSubmitRank() {
const c = this.cfg, s = this.state;
const m = s.minigame;
if (!m || m.kind !== "rm" || m.picked) return null;
const item = (c.RM_SETS || [])[m.order[m.round]];
if (!item) return null;
const order = m.optOrder[m.round] || [];
const n = order.length;
if ((m.rank || []).length < n) return null;
let maxOff = 0, perfect = true;
const detail = [];
m.rank.forEach((optIdx, i) => {
const it = item.items[order[optIdx]];
const std = it.rank || (i + 1);
const off = Math.abs(std - (i + 1));
maxOff = Math.max(maxOff, off);
if (off !== 0) perfect = false;
detail.push({ pos: i + 1, std, off, why: it.why, t: it.t });
});
const score = perfect ? 1 : (maxOff <= 1 ? 0.5 : 0);
m.hits += score;
m.log.push({ q: item.q, ok: score >= 1, score });
m.picked = { kind: "rank", score, perfect, maxOff, detail };
return m.picked;
},
minigameNext() {
const s = this.state;
const m = s.minigame;
if (!m) return null;
m.round += 1;
m.picked = null;
m.rank = [];
if (m.round >= m.total) return { summary: this.finishMinigame() };
return { next: true };
},
finishMinigame() {
const c = this.cfg, s = this.state;
const m = s.minigame;
if (!m) return null;
const mg = (c.MINIGAMES || {})[String(m.kind).toUpperCase()] || {};
const verMul = ((c.MINIGAMES || {}).VER_MUL || {})[s.ver || "V1"];
const mul0 = typeof verMul === "number" ? verMul : 1;
const cap = this.statCap();
const gains = {};
const addReward = (table, mult) => {
for (const k of Object.keys(table || {})) {
if (this.dimsOf(s).indexOf(k) < 0) continue;
const v = Math.round((table[k] || 0) * mult * mul0);
if (!v) continue;
const before = s[k];
s[k] = Math.min(this.statLimit(k, cap), Math.max(0, s[k] + v));
gains[k] = (gains[k] || 0) + (s[k] - before);
}
};
for (let i = 0; i < m.total; i++) {
const rec = m.log[i];
if (!rec) continue;
const mult = rec.score != null ? rec.score : (rec.ok ? 1 : 0);
if (mult > 0) addReward(mg.HIT, mult);
}
const perfectAll = m.hits >= m.total - 1e-6;
if (perfectAll) addReward(mg.CLEAR_BONUS, 1);
for (const k of Object.keys(gains)) gains[k] = Math.round(gains[k]);
const gainTxt = Object.keys(gains).map((k) => `${this.statLabel(k)} +${gains[k]}`).join("、");
if (gainTxt) {
const label = m.kind === "sft" ? "SFT 数据质检" : "RM 偏好标注";
s.lastReport = (s.lastReport || "") + `
🏷 ${label}（${m.hits}/${m.total} 对）：${gainTxt}`;
}
const summary = { kind: m.kind, hits: m.hits, total: m.total, gains, perfect: perfectAll };
s.minigame = null;
s.pendingMinigame = null;
if (window.OfficePause) OfficePause.releaseSource(this, "inspection");
else s.officePaused = !!s._mgWasPaused;
s._mgWasPaused = null;
return summary;
},
corpusDemand() {
const c = this.cfg, s = this.state;
if (this.v35On()) {
const wk = Math.max(1, Math.ceil(s.v35.tick / c.V35.TICKS_PER_WEEK));
return window.V35.needAt(s.v35, wk);
}
const cc = c.CORPUS || {};
const table = cc.DEMAND_BY_PARAM || {};
const base = table[String(s.paramTarget)] != null ? table[String(s.paramTarget)] : (table["7"] || 6);
const mul = (s.focus && (s.focus.key === "text" || s.focus.key === "code")) ? (cc.FOCUS_MUL || 1.2) : 1;
return Math.round(base * mul * 10) / 10;
},
corpusWeekAdd() {
const c = this.cfg, s = this.state;
if (this.v35On()) {
return window.V35.weekAdd(s.v35);
}
return this.corpusDemand();
},
corpusProduction() {
const c = this.cfg;
if (this.v35On()) {
const s = this.state;
const engs = this.productionRoleEngs(s.v35, "data");
if (!engs.length) return 0;
const estimate = { ...s.v35, extraData: engs.length - 1, restData: 0,
dataTraitLvs: engs.map((e) => this.productionTraitLevel(e, "data")),
productionMulList: { data: engs.map((e) => {
const en = this.ensureStatus(e).energy;
return (0.5 + 0.5 * Math.max(0, en) / 100) * this.raiseProductionMul(e);
}) } };
const bMul = this.burstActive("data") ? this.burstCfg().mul : 1;
return Math.round(window.V35.weeklyProductionEstimate(estimate)
* c.V35.TICKS_PER_WEEK * bMul * 10) / 10;
}
const per = (c.CORPUS && c.CORPUS.PROD_PER_LV) || 8;
let lv = 0;
for (const e of this.state.engineers) {
if (e.resigned) continue;
this.ensureStatus(e);
for (const t of e.traits || []) {
if (t.type === "data") lv += t.level * Math.max(0, e.energy || 0) / 100;
}
}
return Math.round(lv * per * 10) / 10;
},
buyCorpus(n) {
const c = this.cfg, s = this.state;
if (this.v35On()) {
const items = n || 100;
const buy = c.V35.CORPUS_CURVE.BUY;
const costWan = items * (buy.price != null ? buy.price : 0.3);
const cost = Math.round(costWan * 10000);
if ((s.funding || 0) < cost) {
return { ok: false, tip: `经费不足（需要 ${Math.round(costWan)} 万）` };
}
const r = window.V35.buyCorpus(s.v35, items);
s.funding -= cost;
s.corpus = Math.round(s.v35.corpus.token * 10) / 10;
return { ok: true, bought: items, cost, good: r.good, random: true };
}
const cc = c.CORPUS || {};
const pack = n || cc.BUY_PACK || 10;
const price = (cc.BUY_PRICE != null ? cc.BUY_PRICE : 1.5) * 10000 * pack;
const cap = cc.CAP != null ? cc.CAP : 60;
if (s.corpus >= cap) return { ok: false, tip: "语料库已经囤满了" };
if (s.funding < price) return { ok: false, tip: `经费不足（需要 ${price} 万）` };
const capLeft = Math.max(0, cap - s.corpus);
const real = Math.min(pack, capLeft);
s.funding -= price * (real / pack);
s.corpus = Math.round((s.corpus + real) * 10) / 10;
return { ok: true, bought: real, cost: Math.round(price * (real / pack)) };
},
workshopClicks(e) {
const c = this.cfg, s = this.state;
this.ensureStatus(e);
const per = (c.WORK_CLICK && c.WORK_CLICK.PER_ENERGY) || 10;
const byEnergy = Math.floor(Math.max(0, e.energy || 0) / per);
const quota = Math.max(((s.workQuota || {})[e.id]) || 0, byEnergy);
const used = ((s.workClicks || {})[e.id]) || 0;
return Math.max(0, quota - used);
},
workshopTotalLeft() {
const s = this.state;
return s.engineers.filter((e) => !e.resigned)
.reduce((a, e) => a + this.workshopClicks(e), 0);
},
scene() {
const c = this.cfg, s = this.state;
const era = c.EMBODIED || {};
const key = this.embodiedAvailable(s) ? (era.NEW_SCENE_ID || "embodied") : (era.OLD_SCENE_ID || "v1");
return (c.SCENES && c.SCENES[key]) || (c.SCENES && c.SCENES.v1) || { label: key, bg: "", cap: 4, seats: [] };
},
corpusCap() {
const c = this.cfg, s = this.state;
if (this.v35On()) return 999999;
return ((c.CORPUS_CAP_BY_VER || {})[s.ver || "V1"]) || (c.CORPUS && c.CORPUS.CAP) || 60;
},
modelCode() {
const c = this.cfg, s = this.state;
const arch = s.arch || "dense";
const param = s.paramTarget || 7;
const BY = (c.MISSIONS && c.MISSIONS.BY_VER) || {};
const order = c.VER_ORDER || ["V1", "V1.5", "V2", "V2.5", "V3", "V3.5", "V4", "V4.5"];
const at=order.indexOf(s.ver);
for (const ver of order.slice(0,at<0?order.length:at+1).reverse()) {
const m = BY[ver];
if (!m) continue;
if (m.arch && m.arch !== arch) continue;
if (m.param != null && param < m.param) continue;
return ver;
}
return s.ver || "V1";
},
canReview() {
const c = this.cfg, s = this.state;
if (!s.planDone) return false;
if (s.phase !== "office" || this.pendingBailoutEvent()) return false;
if (this.v35On()) return (s.week || 0) >= this.minWeeks(s.ver);
const r = this.evaluate();
return this.isPassLike(r);
},
minWeeks(ver) {
const c = this.cfg;
const arr = c.MIN_WEEKS_BY_VER;
if (Array.isArray(arr) && arr.length) {
const order = c.VER_ORDER || [];
const i = order.indexOf(ver || "");
if (i >= 0 && i < arr.length) return arr[i];
if (i < 0) return arr[arr.length - 1];
}
if (this.v35On()) return (c.V35 && c.V35.WEEKS) || 6;
return 6;
},
canTest() {
const s = this.state;
if (!s.planDone) return false;
const hasStat = this.dimsOf(s).some((k) => (s[k] || 0) > 0);
return hasStat || this.totalProd() > 0;
},
_optHidden(opt) {
const s = this.state, nb = s.notebook || [];
const rn = opt.requireNote;
if (rn) {
const neg = rn[0] === "!";
const id = neg ? rn.slice(1) : rn;
const has = nb.includes(id);
if (neg ? has : !has) return true;
}
if (opt.requireFlag === "auto") {
if (!(this.autoOn && typeof this.autoOn === "function" && this.autoOn())) return true;
}
if (opt.needParam) {
const need = parseFloat(opt.needParam);
if (!need || !(s.paramTarget >= need)) return true;
}
return false;
},
chatVars() {
const s = this.state, c = this.cfg;
const archCfg = (c.ARCHITECTURES || []).find((a) => a.id === s.arch) || {};
const archId = s.arch || "";
const archName = archCfg.name || archId || "—";
return {
whale: this.whaleName(),
model: s.modelName || c.MODEL_NAME_DEFAULT || "模型",
param: s.paramTarget != null ? String(s.paramTarget) : "",
arch: archName,
archName: archName,
archId: archId,
};
},
fillVars(str) {
const v = this.chatVars();
return String(str == null ? "" : str)
.replace(/\{whale\}/g, () => v.whale)
.replace(/\{model\}/g, v.model)
.replace(/\{param\}/g, v.param)
.replace(/\{archName\}/g, v.archName)
.replace(/\{archId\}/g, v.archId)
.replace(/\{arch\}/g, v.arch);
},
chatVar(str) { return this.fillVars(str); },
c2Tree() {
const byVer = ((this.cfg || {}).CHAT_TREE2 || {}).BY_VER || {};
return byVer[this.state.ver] || null;
},
c2On() { return !!this.c2Tree(); },
c2Notes() { return ((this.cfg || {}).CHAT_TREE2 || {}).NOTES || {}; },
c2State() {
const s = this.state;
if (!s.c2 || typeof s.c2 !== "object") s.c2 = { lastOpt: null, lastAns: null, ended: false };
if (s.c2.ended === undefined) s.c2.ended = false;
return s.c2;
},
c2Reset() {
const old = this.state.c2;
const seen = old && old.seen && typeof old.seen === "object" && !Array.isArray(old.seen) ? old.seen : {};
this.state.c2 = { lastOpt: null, lastAns: null, ended: false, ver: this.state.ver, seen };
},
healC2() {
const c2 = this.c2State(), tree = this.c2Tree();
if (!c2.seen || typeof c2.seen !== "object" || Array.isArray(c2.seen)) {
c2.seen = {};
if (c2.lastAns) c2.seen[String(c2.lastAns)] = this.state.week || 0;
}
if (!tree) return false;
const opt = c2.lastOpt == null ? null : (tree.opts || {})[String(c2.lastOpt)];
let invalid = c2.ver != null && c2.ver !== this.state.ver;
if (c2.lastOpt != null && !opt) invalid = true;
if (c2.lastAns != null) {
const replies = opt && opt.ans || {};
const known = Object.keys(replies).some(tier => Array.isArray(replies[tier])
&& replies[tier].some(answer => this.c2FlattenThen(answer).some(x => x.id != null && String(x.id) === String(c2.lastAns))));
if (!known) invalid = true;
}
if (invalid) this.c2Reset();
else c2.ver = this.state.ver;
return invalid;
},
c2HasNote(id) {
if (id == null) return false;
return (this.state.notebook || []).indexOf(String(id)) >= 0;
},
c2UnlockNote(id) {
if (id == null) return false;
const nid = String(id);
if (!this.c2Notes()[nid]) return false;
const n = this.state.notebook = Array.isArray(this.state.notebook) ? this.state.notebook : [];
if (!n.includes(nid)) { n.push(nid); return true; }
return false;
},
c2CondOk(c, oid) {
if (!c) return false;
const c2 = this.c2State();
switch (c.type) {
case "none": return true;
case "fallback": return true;
case "prevOpt": return (c.ids || []).indexOf(c2.lastOpt) >= 0;
case "prevAns": return (c.ids || []).indexOf(c2.lastAns) >= 0;
case "note": return this.c2HasNote(c.id);
case "noNote": return !this.c2HasNote(c.id);
case "flag": return !!(this.autoOn && typeof this.autoOn === "function" && this.autoOn());
default: return false;
}
},
c2VisibleOpts() {
const t = this.c2Tree();
if (!t) return [];
const c2 = this.c2State();
if (c2.ended) return [];
const atStart = !c2.lastOpt && !c2.lastAns;
const out = [];
for (const id of Object.keys(t.opts || {})) {
const o = t.opts[id];
if (o.next === "start" || o.next === "end") continue;
const byStart = !!o.start && atStart;
const byCond = o.cond && o.cond.type !== "none" && this.c2CondOk(o.cond);
if (byStart || byCond) out.push(Object.assign({}, o, { _id: id }));
}
return out;
},
c2Status(tier) {
const t = this.c2Tree();
if (!t) return "";
const k = tier === "full" ? "full" : "dumb";
const arr = ((t.status || {})[k]) || [];
return arr.length ? arr[Math.floor(Math.random() * arr.length)] : "";
},
c2PickReply(o, tier, oid) {
const s = this.state, c = this.cfg;
const tk = tier === "full" ? "full" : "dumb";
const list = (((o.ans || {})[tk]) || []).slice();
const hit = list.filter((a) => a.cond && a.cond.type !== "fallback" && this.c2CondOk(a.cond));
const pool = hit.length ? hit : list.filter((a) => !a.cond || a.cond.type === "fallback");
if (!pool.length) {
if (tk === "dumb") {
const g = (c.GIBBERISH && c.GIBBERISH.slice()) || ["咕嘎……%%￥#@&*"];
return { id: null, type: "text", text: g[Math.floor(Math.random() * g.length)], cond: null };
}
const fb = ((((o.ans || {}).full) || [])[0]) || null;
if (fb) return fb;
const g2 = (c.GIBBERISH && c.GIBBERISH.slice()) || ["咕嘎……%%￥#@&*"];
return { id: null, type: "text", text: g2[Math.floor(Math.random() * g2.length)], cond: null };
}
const idxMap = s._lastReplyIdx = (s._lastReplyIdx && typeof s._lastReplyIdx === "object") ? s._lastReplyIdx : {};
const key = "c2:" + (s.ver || "V1") + ":" + (oid || o._id || "");
const cand = (pool.length > 1 && idxMap[key] != null) ? pool.filter((_, i) => i !== idxMap[key]) : pool;
const pick = cand[Math.floor(Math.random() * cand.length)];
idxMap[key] = pool.indexOf(pick);
return pick;
},
c2Choose(optId, tier) {
const t = this.c2Tree();
if (!t) return null;
const o = (t.opts || {})[String(optId)];
if (!o) return null;
const c2 = this.c2State();
c2.lastOpt = String(optId);
c2.ended = false;
if (o.next === "start") { c2.lastAns = null; return { opt: o, optId: String(optId), reply: null, next: "start" }; }
if (o.next === "end") { c2.lastAns = null; c2.ended = true; return { opt: o, optId: String(optId), reply: null, next: "end" }; }
const a = this.c2PickReply(o, tier || "full", String(optId));
const chain = this.c2FlattenThen(a);
const tail = chain.length ? chain[chain.length - 1] : a;
c2.lastAns = (tail && tail.id) ? String(tail.id) : null;
chain.forEach((x) => {
if (!x || !x.id) return;
if (!c2.seen || typeof c2.seen !== "object") c2.seen = {};
if (!c2.seen[String(x.id)]) c2.seen[String(x.id)] = this.state.week || 0;
if (x.noteFor) this.c2UnlockNote(x.noteFor);
});
return { opt: o, optId: String(optId), reply: a, next: "continue" };
},
c2FlattenThen(node, out, depth) {
out = out || [];
depth = depth || 0;
if (!node || typeof node !== "object" || depth > 50) return out;
out.push(node);
const subs = Array.isArray(node.then) ? node.then : [];
for (const sub of subs) this.c2FlattenThen(sub, out, depth + 1);
return out;
},
callLogCfg() { return (this.cfg || {}).CALL_LOG || {}; },
callLogOn() { return this.callLogCfg().ENABLED !== false; },
callLogStepMs() { return Number(this.callLogCfg().STEP_MS) || 700; },
callLogSteps(tool) {
const C = this.callLogCfg();
const by = (C.BY_TOOL || {})[tool];
return (by && by.length ? by : (C.DEFAULT || ["正在思考…", "正在调用工具…"]));
},
startReview() {
const s = this.state;
if (!this.canReview()) return { ok: false, tip: "还没达标，再练练" };
s.pendingEvent = null;
s.result = this.evaluate();
return { ok: true, result: s.result };
},
seatCap() {
const sc = this.scene();
const cap = sc.cap != null ? sc.cap : (sc.seatCap != null ? sc.seatCap : 4);
return Math.max(1, Math.min(cap, (sc.seats || []).length || 4));
},
assignSeat(engId) {
const s = this.state;
const seats = this.scene().seats || [];
s.seatOf = s.seatOf || {};
if (!seats.length) return -1;
const used = new Set(
s.engineers.filter((x) => !x.resigned && s.seatOf[x.id] != null).map((x) => s.seatOf[x.id])
);
for (let i = 0; i < seats.length; i++) {
if (!used.has(i)) { s.seatOf[engId] = i; return i; }
}
return -1;
},
resolveSeats() {
const s = this.state;
const seats = this.scene().seats || [];
const alive = s.engineers.filter((e) => !e.resigned);
s.seatOf = s.seatOf || {};
const out = {};
const used = new Set();
for (const e of alive) {
const v = s.seatOf[e.id];
if (Number.isInteger(v) && v >= 0 && v < seats.length && !used.has(v)) {
out[e.id] = v; used.add(v);
}
}
for (const e of alive) {
if (out[e.id] != null) continue;
for (let i = 0; i < seats.length; i++) {
if (!used.has(i)) { out[e.id] = i; used.add(i); s.seatOf[e.id] = i; break; }
}
}
const aliveSet = new Set(alive.map((e) => e.id));
for (const k of Object.keys(s.seatOf)) {
const v = s.seatOf[k];
if (!aliveSet.has(k) || !Number.isInteger(v) || v < 0 || v >= seats.length) delete s.seatOf[k];
}
return out;
},
freeSeat(engId) {
if (this.state.seatOf) delete this.state.seatOf[engId];
},
seatIndex(engId) {
const s = this.state;
s.seatOf = s.seatOf || {};
if (s.seatOf[engId] == null) return this.assignSeat(engId);
return s.seatOf[engId];
},
prodRate(e, atRound) {
const c = this.cfg, s = this.state;
const O = c.OFFICE || {};
this.ensureStatus(e);
const mainType = this.mainTrait(e).type || "pretrain";
const mainLv = this.mainTraitLevel(e);
const traitMul = (O.PROD_TRAIT_MUL || {})[mainType] || 1;
const statKey = ({ pretrain: "algo", post: "algo", engineer: "code", data: "code", academic: "algo" })[mainType] || "algo";
const statVal = (e.stats || {})[statKey] || 0;
let rate = (O.PROD_BASE || 0.8)
* traitMul
* (1 + (e.energy || 0) * (O.PROD_ENERGY_MUL || 0.008))
* (1 + statVal * (O.PROD_STAT_MUL || 0.006))
* (1 + (mainLv - 1) * 0.15)
* this.raiseProductionMul(e, atRound);
if (s.focusBoost && s.focusBoost.roundsLeft > 0 && s.focusBoost.dim === this.mainDimOf(e)) {
rate *= s.focusBoost.mul;
}
for (const pid of s.papersOwned || []) {
const p = this.paperOf(pid);
if (!p) continue;
if (p.effect.kind === "prod" && (p.effect.dim === "all" || p.effect.dim === this.mainDimOf(e))) {
rate *= p.effect.mul;
}
}
return Math.round(rate * 100) / 100;
},
mainDimOf(e) {
const map = { pretrain: "code", post: "text", academic: "code", engineer: "stability", data: "safety", safety: "safety" };
return map[this.mainTrait(e).type] || "code";
},
bailoutInfo(event) {
const rescue = this.cfg.BAILOUT;
if (!rescue) return null;
const ev = event || this.evByKey((rescue.EVENT_BY_VER || {})[this.state.ver] || rescue.DEFAULT_EVENT);
const option = ev && (ev.options || []).find(o => o.effects && o.effects.bailout);
if (!option) return null;
return { event: ev, usedFlag: typeof option.effects.bailout === "string" ? option.effects.bailout : rescue.DEFAULT_USED_FLAG };
},
pendingBailoutEvent() {
const s = this.state;
if (!s || s.phase !== "office" || (s.pendingBailout == null && !s.pendingEvent)) return null;
const info = this.bailoutInfo();
if (!info || s[info.usedFlag] || s.bankrupt || !this.eventEligibleForStage(info.event, s)) {
s.pendingBailout = null;
return null;
}
const ids = [s.pendingBailout, s.pendingEvent && s.pendingEvent.id];
if (!ids.some(id => id != null && this.evNoOf(id) === info.event.no)) return null;
s.pendingBailout = info.event.no;
return info.event;
},
bankruptcyTick() {
const s = this.state;
if (!s || s.phase !== "office" || !this.v35On()) return null;
const pending = this.pendingBailoutEvent();
if (pending) return { event: pending, bailout: true, bailoutPending: true };
if (!(s.fiscalDeficit > 0 || s.funding < 0)) return null;
const info = this.bailoutInfo();
if (info && !s[info.usedFlag] && this.eventEligibleForStage(info.event, s)) {
s.pendingBailout = info.event.no;
s.pendingEvent = { id: info.event.no };
s.fiscalDeficit = 0;
s.funding = Math.max(0, s.funding || 0);
return { event: info.event, bailout: true };
}
s.pendingBailout = null;
s.flags = s.flags || {};
s.flags.bankrupt = true;
s.bankrupt = true;
s.phase = "over";
return { bankrupt: "over" };
},
officeTick(now) {
const c = this.cfg, s = this.state;
const O = c.OFFICE || {};
if (s.officePaused || s.phase !== "office") return null;
const bankruptcy = this.bankruptcyTick();
if (bankruptcy) { s._tickAt = now; return bankruptcy; }
if (this.guidePending()) {
s._tickAt = now;
return this.proposalTick();
}
let ms = this.v35On() ? c.V35.TICK_S * 1000 : (O.MS_PER_ROUND || 60000);
if (this.v35On()) {
const jitter = (c.V35 && c.V35.TICK_JITTER != null) ? c.V35.TICK_JITTER : 3;
ms += (Math.random() * 2 - 1) * (jitter * 1000);
const gs = (c.V35 && c.V35.GAP_SLOW) || {};
const free = gs.FREE_ABOVE != null ? gs.FREE_ABOVE : 90;
const step = gs.STEP != null ? gs.STEP : 10;
const delay = gs.DELAY_MS != null ? gs.DELAY_MS : 1000;
const pct = window.V35 && window.V35.gapPct ? window.V35.gapPct(s.v35) : 100;
if (pct < free) ms += Math.floor((free - pct) / step + 1e-9) * delay;
const premiumS = this.qualityPremiumS();
if (premiumS > 0) ms -= premiumS * 1000;
ms = Math.max(1000, ms);
}
if (!s._tickAt) s._tickAt = now;
if (now - s._tickAt < ms) return null;
s._tickAt = now;
return this.officeAdvance(1);
},
proposalTick() {
const s = this.state;
if (!s) return null;
const ev = this.pendingProposalEvent();
if (!ev) return null;
s.pendingEvent = { id: ev.no };
s._lastEvtTick = s.rounds;
return { rounds: 0, weekUp: false, payroll: null, paperDone: null,
breakthrough: false, floats: [], weekly: null, event: ev };
},
guidePending() {
const s = this.state;
if (!this.v35On() || s.phase !== "office") return null;
const initial = this.initialRecruitment();
if (initial && initial.missing.length) return { key: "recruit", tip: initial.tip };
if (!(s.engineers || []).some((e) => !e.resigned)) return { key: "recruit", tip: "先完成招聘——团队里还没有工程师" };
if (!s.gpuTier) return { key: "shop", tip: "先采购算力——没有 GPU，工程师开不了工" };
if (!s.planDone) {
const need = ((((this.cfg || {}).MISSIONS || {}).BY_VER || {})[s.ver || "V1"] || {}).arch;
const a = ((this.cfg || {}).ARCHITECTURES || []).find((x) => x.id === need) || null;
if (a && (a.unlockBy === "approval" || a.unlockBy === "embodied") && !this.archUnlock(a).approvalOk) {
return { key: "plan", tip: "等团队提方案：" + a.name + " 要「团队提案」批准后才能立项，"
+ "办公室会弹出「" + a.name + " 提了一个新架构设想」，看到后点「批准立项」", arch: a.id, archName: a.name };
}
return { key: "plan", tip: "先完成立项——立项之后训练才会开始" };
}
return null;
},
pendingProposalEvent() {
const c = this.cfg, s = this.state;
if (!this.v35On()) return null;
const ver = s.ver || "V1";
const need = (((c.MISSIONS || {}).BY_VER || {})[ver] || {}).arch;
if (!need) return null;
const a = (c.ARCHITECTURES || []).find((x) => x.id === need);
if (!a || !["approval", "embodied"].includes(a.unlockBy)) return null;
if (this.archUnlock(a).approvalOk) return null;
const ev = (c.EVENTS || []).find((e) => e.special === "proposal"
&& e.arch === a.id && e.enabled !== false);
if (!ev) return null;
if (s.pendingEvent && this.evNoOf(s.pendingEvent.id) !== ev.no) {
const busy = this.evNoOf(s.pendingEvent.id);
const busyEv = busy != null ? (c.EVENTS || []).find((e) => e.no === busy) : null;
const stale = !busyEv || !!busyEv.special;
const maxYield = (c.V35 && c.V35.TICKS_PER_WEEK ? c.V35.TICKS_PER_WEEK * 6 : 36);
const elapsed = s._propYieldSince == null ? 0 : (s.rounds || 0) - s._propYieldSince;
if (!stale && elapsed < maxYield) {
if (s._propYieldSince == null) s._propYieldSince = s.rounds || 0;
return null;
}
s._propYieldSince = null;
s.pendingEvent = null;
}
s._propYieldSince = null;
const sum = (e2) => (e2 && e2.stats
? (e2.stats.code || 0) + (e2.stats.algo || 0) + (e2.stats.text || 0) : 0);
const alive = s.engineers.filter((e) => !e.resigned
&& (e.joinTick == null || (s.v35 && s.v35.tick >= e.joinTick)));
const roleWant = a.id === "mla" ? "data" : "post";
const role = alive.filter((e) => this.v35RoleOf(e) === roleWant);
const who = (role.length ? role : alive).slice().sort((x, y) => sum(y) - sum(x))[0];
return who ? Object.assign({}, ev, { targetName: who.name }) : ev;
},
officeAdvance(n) {
const c = this.cfg, s = this.state;
if (this.v35On()) return this.officeAdvanceV35(n);
const O = c.OFFICE || {};
const P = c.PAYROLL || {};
const alive = s.engineers.filter((e) => !e.resigned);
const log = { rounds: n, weekUp: false, payroll: null, paperDone: null, focusEnd: null };
const beforeWeek = s.week;
for (let i = 0; i < n; i++) {
s.rounds = (s.rounds || 0) + 1;
s.absRounds = (s.absRounds || 0) + 1;
if ((O.ROUNDS_PER_WEEK || 7) > 0 && s.rounds % (O.ROUNDS_PER_WEEK || 7) === 0) {
s.week = Math.min(c.TOTAL_WEEKS || 99, (s.week || 0) + 1);
log.weekUp = true;
}
for (const e of alive) {
this.ensureStatus(e);
const cost = (O.WORK_ENERGY_COST || 1) * (this.energyCostMul());
if ((e.energy || 0) >= (O.WORK_ENERGY_MIN || 20)) {
const gain = this.prodRate(e, Math.max(0, (s.absRounds || 0) - 1));
const cur = (s.prodByEng[e.id]) || 0;
const cap = O.SLOT_CAP || 24;
const next = Math.min(cap, cur + gain);
s.prodByEng[e.id] = Math.round(next * 100) / 100;
if (next >= cap - 0.001) s.prodFullByEng[e.id] = true;
e.energy = Math.max(0, (e.energy || 0) - cost);
} else {
e.energy = Math.min(100, (e.energy || 0) + (O.REST_ENERGY || 8));
}
}
if (s.focusBoost && s.focusBoost.roundsLeft > 0) {
s.focusBoost.roundsLeft -= 1;
if (s.focusBoost.roundsLeft <= 0) {
log.focusEnd = s.focusBoost.dim;
s.focusBoost = null;
}
}
if (s.paperResearch && s.week >= s.paperResearch.startWeek + s.paperResearch.weeks) {
const pid = this.paperNoOf(s.paperResearch.id);
if (!s.papersOwned) s.papersOwned = [];
if (pid != null) s.papersOwned.push(pid);
log.paperDone = pid;
s.paperResearch = null;
this.refreshPaperCandidates();
}
s.payrollDue = (s.payrollDue != null ? s.payrollDue : P.PERIOD_ROUNDS || 28) - 1;
if (s.payrollDue <= 0) {
s.payrollDue = P.PERIOD_ROUNDS || 28;
log.payroll = this.doPayroll();
}
}
log.week = s.week;
return log;
},
burstCfg() {
const B = (this.cfg.V35 && this.cfg.V35.BURST) || {};
return {
enabled: B.ENABLED !== false,
minEnergy: B.MIN_ENERGY != null ? B.MIN_ENERGY : 62,
prob: B.PROB != null ? B.PROB : 0.1,
cost: B.COST != null ? B.COST : 20,
ticks: B.TICKS != null ? B.TICKS : 3,
mul: B.MUL != null ? B.MUL : 2,
cooldown: B.COOLDOWN != null ? B.COOLDOWN : 10,
minWeek: B.MIN_WEEK != null ? B.MIN_WEEK : 1,
};
},
burstActive(role, eng) {
const st = this.state && this.state.v35;
if (!(st && st.burst && st.burst[role] > 0)) return false;
const crew = this.teamRoleEngs(st, role);
return eng ? crew.some((e) => e === eng || e.id === eng.id) : crew.length > 0;
},
tickLeaveRisk() {
const c = this.cfg, s = this.state, st = s.v35;
this.clearLonePoachRisk(s);
if (!st || !st.energy) return;
if (this.embodiedAvailable(s)) {
st.leaveRisk = false; st.poachRisk = false;
st.leaveWho = null; st.poachWho = null; st.riskWho = null;
return;
}
const vc = c.V35 || {};
const L = vc.LEAVE || {}, P = vc.POACH || {};
st.lowE = st.lowE || { pre: 0, data: 0, post: 0, embodied: 0 };
if (st.leaveRisk || st.poachRisk) return;
for (const k of ["pre", "data", "post", "embodied"]) {
const eng = s.engineers.find((e) => !e.resigned && this.v35RoleOf(e) === k
&& (e.joinTick == null || st.tick >= e.joinTick));
if (!eng) { st.lowE[k] = 0; continue; }
if ((st.energy[k] || 0) < (L.ENERGY != null ? L.ENERGY : 25)) st.lowE[k] = (st.lowE[k] || 0) + 1;
else st.lowE[k] = 0;
if (st.lowE[k] >= (L.TICKS != null ? L.TICKS : 12)
&& Math.random() < (L.PROB != null ? L.PROB : 0.5)) {
st.leaveRisk = true;
st.leaveWho = eng.id;
break;
}
}
if (!st.leaveRisk && this.activeEngineerCount(s) > 1) {
const poachEv = this.evByKey("V35_POACH");
const poachVerOk = !(poachEv && poachEv.minVer
&& (c.VER_ORDER || []).indexOf(poachEv.minVer) > (c.VER_ORDER || []).indexOf(s.ver || "V1"));
if (poachVerOk) {
for (const e of s.engineers) {
if (e.resigned) continue;
if (e.joinTick != null && st.tick < e.joinTick) continue;
if ((e.weeksNoRaise || 0) < (P.WEEKS != null ? P.WEEKS : 4)) continue;
if (Math.random() >= (P.PROB != null ? P.PROB : 0.35)) continue;
st.poachRisk = true;
st.poachWho = e.id;
break;
}
}
}
},
tickBurst() {
const s = this.state, st = s.v35;
const B = this.burstCfg();
if (!B.enabled || !st || !st.energy) return [];
const tNow = st.tick || 0;
const offS = this.cfg.V35.OFF_START != null ? this.cfg.V35.OFF_START : 18;
const offL = this.cfg.V35.OFF_LEN != null ? this.cfg.V35.OFF_LEN : 3;
if (tNow >= offS && tNow < offS + offL) {
if (st.burst && (st.burst.pre > 0 || st.burst.data > 0 || st.burst.post > 0 || st.burst.embodied > 0)) {
st.burst = { pre: 0, data: 0, post: 0, embodied: 0 };
}
return [];
}
st.burst = st.burst || { pre: 0, data: 0, post: 0, embodied: 0 };
st.burstCd = st.burstCd || { pre: 0, data: 0, post: 0, embodied: 0 };
const fired = [];
for (const k of ["pre", "data", "post", "embodied"]) {
if (st.burstCd[k] > 0) st.burstCd[k] -= 1;
const eng = this.teamRoleEngs(st, k)[0];
if (!eng) { st.burst[k] = 0; continue; }
if (st.burst[k] > 0) { st.burst[k] -= 1; continue; }
if ((s.week || 0) < B.minWeek) continue;
this.syncEnergySlot(k);
if ((st.energy[k] || 0) < B.minEnergy) continue;
if (st.burstCd[k] > 0) continue;
if (Math.random() >= B.prob) continue;
st.burst[k] = B.ticks;
st.burstCd[k] = B.ticks + B.cooldown;
this.addEnergyRole(k, -B.cost);
fired.push({ role: k, name: eng.name });
}
return fired;
},
officeAdvanceV35(n) {
const c = this.cfg, s = this.state;
const v = c.V35, V = window.V35;
const log = { rounds: n, weekUp: false, payroll: null, paperDone: null,
breakthrough: false, floats: [], weekly: null };
const capAll = this.statCap();
for (let i = 0; i < n; i++) {
const pendingBankruptcy = this.bankruptcyTick();
if (pendingBankruptcy) { Object.assign(log, pendingBankruptcy); break; }
if (!log.event) {
const propEv = this.pendingProposalEvent();
if (propEv) {
s.pendingEvent = { id: propEv.no };
s._lastEvtTick = s.rounds;
log.event = propEv;
}
}
if (!s.planDone) continue;
s.rounds = (s.rounds || 0) + 1;
s.absRounds = (s.absRounds || 0) + 1;
const roomLeft = () => s.engineers.filter((e) => !e.resigned).length < this.seatCap();
const dataTpl = this.engByKey("eng_v1b");
const dataNo = dataTpl ? dataTpl.no : null;
if (dataTpl && (!Array.isArray(dataTpl.stage) || dataTpl.stage.indexOf(s.ver || "V1") >= 0)
&& this.hireStageEligible(dataTpl, s.ver) && s.v35.tick >= v.JOIN_DATA && !s.engineers.some((e) => e.no === dataNo)) {
if (roomLeft()) {
const eng = this.cloneEng(dataTpl);
s.engineers.push(eng);
this.assignSeat(eng.id);
this.syncEnergySlot("data");
log.arrive = log.arrive || [];
log.arrive.push("📅 数据工程师 " + eng.name + " 到岗，语料产线开工");
} else if (!s._seatFullWarned) {
s._seatFullWarned = true;
log.toast = "🚪 座位已满，到岗的新人还在门口等着——先辞退一人再让他们进来";
}
}
const postTpl = this.engByKey("eng_v1c");
const postNo = postTpl ? postTpl.no : null;
if (postTpl && (!Array.isArray(postTpl.stage) || postTpl.stage.indexOf(s.ver || "V1") >= 0)
&& this.hireStageEligible(postTpl, s.ver) && s.v35.tick >= v.JOIN_POST && !s.engineers.some((e) => e.no === postNo)) {
if (roomLeft()) {
const eng = this.cloneEng(postTpl);
s.engineers.push(eng);
this.assignSeat(eng.id);
this.syncEnergySlot("post");
log.arrive = log.arrive || [];
log.arrive.push("📅 后训练工程师 " + eng.name + " 到岗");
} else if (!s._seatFullWarned) {
s._seatFullWarned = true;
log.toast = "🚪 座位已满，到岗的新人还在门口等着——先辞退一人再让他们进来";
}
}
if (window.V35Hire) {
const hr = window.V35Hire.tick(this);
if (hr) log.hire = hr;
if (hr && hr.found) {
const cds = (hr.cands && hr.cands.length) ? hr.cands : (hr.cand ? [hr.cand] : []);
const cd = cds[0];
if (cd) for (const h of (c.OFFICE_HINTS || [])) {
if (h.type !== "hire_done") continue;
if (h.ver && h.ver !== (s.ver || "V1")) continue;
const txt = this.noticeTpl(String(h.text || "")
.replace(/\{name\}/g, cd.name || "")
.replace(/\{role\}/g, cd.label || cd.role || "")
.replace(/\{tier\}/g, cd.tier || ""));
(log.notices = log.notices || []).push({
kind: "hint", group: h.type, tag: h.tag || "寻访有结果",
text: txt, avatar: h.avatar || null,
});
break;
}
}
}
s.v35.preJoined = this.productionRoleEngs(s.v35, "pre", true).length > 0;
s.v35.dataJoined = this.productionRoleEngs(s.v35, "data", true).length > 0;
s.v35.postJoined = this.productionRoleEngs(s.v35, "post", true).length > 0;
const liveOf = (role) => this.productionRoleEngs(s.v35, role, true).length;
s.v35.paperFx = this.paperEffects();
s.v35.extraPre = Math.max(0, liveOf("pre") - 1);
s.v35.extraData = Math.max(0, liveOf("data") - 1);
s.v35.extraPost = Math.max(0, liveOf("post") - 1);
s.v35.embodiedJoined = this.embodiedAvailable() && liveOf("embodied") > 0;
s.v35.extraEmbodied = Math.max(0, liveOf("embodied") - 1);
s.v35.dataTraitLvs = this.teamDataTraitLevels(s.v35);
s.v35.preTraitLv = this.teamPreTraitLevel(s.v35);
s.v35.postTraitLv = this.teamPostTraitLevel(s.v35);
const burstFired = this.tickBurst();
if (burstFired.length) log.bursts = (log.bursts || []).concat(burstFired);
this.tickLeaveRisk();
this.syncResting();
const _enOrder = {};
s.v35.energyList = {};
s.v35.energyOwnerList = {};
s.v35.energyRoleById = {};
s.v35.productionMulList = {};
s.v35.traitLevelList = {};
for (const _k of ["pre", "data", "post", "embodied"]) {
if (s.v35.energy[_k] == null) continue;
const _engs = this.productionRoleEngs(s.v35, _k);
for (const _e of _engs) this.ensureStatus(_e);
_enOrder[_k] = _engs;
s.v35.energyList[_k] = _engs.map((e) => (e.energy || 0));
s.v35.productionMulList[_k] = _engs.map((e) => this.raiseProductionMul(e, Math.max(0, (s.absRounds || 0) - 1)));
s.v35.traitLevelList[_k] = _engs.map((e) => this.productionTraitLevel(e, _k));
s.v35.energyOwnerList[_k] = _engs.map((e) => e.id);
for (const e of _engs) s.v35.energyRoleById[e.id] = this.v35RoleOf(e);
}
const floats = V.tick(s.v35);
if (this.embodiedAvailable()) s.embodiedTrainingTicks = Math.max(0, (s.embodiedTrainingTicks || 0)) + 1;
if (s.v35.energyList) {
for (const _k of ["pre", "data", "post", "embodied"]) {
const _arr = s.v35.energyList[_k], _engs = _enOrder[_k];
if (!_arr || !_engs) continue;
for (let _i = 0; _i < _engs.length; _i++) {
if (typeof _arr[_i] === "number") _engs[_i].energy = Math.round(_arr[_i]);
}
this.syncEnergySlot(_k);
}
delete s.v35.energyList;
}
delete s.v35.productionMulList;
delete s.v35.traitLevelList;
delete s.v35.energyOwnerList;
delete s.v35.energyRoleById;
for (const f of floats) {
const producer = f.slot != null && _enOrder[f.who] ? _enOrder[f.who][f.slot] : null;
if (producer) f.engId = producer.id;
const bMul = this.burstActive(f.who) ? this.burstCfg().mul : 1;
const fv = (bMul === 1) ? f : { ...f, amount: f.amount * bMul };
log.floats.push(fv);
if (fv.dim && s[fv.dim] != null) {
const _cap = this.statLimit(fv.dim, capAll);
s[fv.dim] = Math.min(_cap, Math.round((s[fv.dim] || 0) + fv.amount));
}
if (fv.who && fv.who !== "paper" && fv.amount) {
const engId = fv.engId != null ? fv.engId : this.v35EngIdOfRole(fv.who);
if (engId) {
s.v35.prodAcc = s.v35.prodAcc || {};
s.v35.prodAcc[engId] = (s.v35.prodAcc[engId] || 0) + fv.amount;
}
}
}
if (s.focusBoost && s.focusBoost.roundsLeft > 0) {
s.focusBoost.roundsLeft -= 1;
if (s.focusBoost.roundsLeft <= 0) {
s.focusBoost = null;
s.v35.focus = { dim: null, left: 0 };
}
}
for (const _k of this.dimsOf(s)) {
if (s[_k] != null) {
const _ck = this.statLimit(_k, capAll);
s[_k] = Math.min(_ck, Math.round(s[_k]));
}
}
s._lastFloats = floats;
if (s.v35.lvShift > 0 && !s.breakthroughSeen) { log.breakthrough = true; s.breakthroughSeen = true; }
if (s.rounds % v.TICKS_PER_WEEK === 0) {
s.week = (s.week || 0) + 1;
log.weekUp = true;
s.tbRound = { team: false, meetingWeek: (s.tbRound || {}).meetingWeek };
for (const _e of s.engineers) {
if (_e.resigned) continue;
if (_e.joinTick != null && s.v35.tick < _e.joinTick) continue;
_e.weeksNoRaise = (_e.weeksNoRaise || 0) + 1;
}
const _restBack = this.restoreRested();
if (_restBack.length) log.restBack = (log.restBack || []).concat(_restBack);
const DBG = c.DEBUG || {};
if (DBG.FORCE_BANKRUPT && !s._dbgBankruptDone
&& s.week >= (DBG.FORCE_BANKRUPT_WEEK != null ? DBG.FORCE_BANKRUPT_WEEK : 2)) {
s._dbgBankruptDone = true;
s.funding = 0;
s.fiscalDeficit = Math.max(1, this.payrollTotal() || 0);
log.debugBankrupt = true;
}
const _gone = this.expireCandidates(s.week);
if (_gone.length) log.candidatesExpired = _gone.map((x) => x.name || x.id);
if (s.v35.eventOffer && this.absWeek() >= s.v35.eventOffer.dueWeek) {
const offer = s.v35.eventOffer;
s.v35.eventOffer = null;
const tpl = (window.V35Hire && window.V35Hire.pickOfferCand)
? window.V35Hire.pickOfferCand(this, offer.tier) : null;
if (tpl) {
const cand = this.cloneEng(tpl);
cand.fromEvent = true;
cand.expireAbsWeek = this.absWeek() + (c.CANDIDATE_TTL_WEEKS || 2);
s.candidates = s.candidates || [];
if (!s.candidates.some((x) => x.id === cand.id)) s.candidates.push(cand);
const stageHints = (c.OFFICE_HINTS || []).filter((h) => !h.ver || h.ver === (s.ver || "V1"));
const hd = stageHints.find((h) => h.id === "H_EVENT_OFFER")
|| stageHints.find((h) => h.type === "hire_done");
if (hd && !(log.notices || []).some(n => n.group === hd.type)) {
const txt = this.noticeTpl(String(hd.text || "")
.replace(/\{name\}/g, cand.name || "")
.replace(/\{tier\}/g, this.tierLabel(cand)));
(log.notices = log.notices || []).push({
kind: "hint", group: hd.type, tag: hd.tag || "慕名而来", text: txt, avatar: hd.avatar || null,
});
}
log.eventOffer = { name: cand.name, tier: this.tierLabel(cand) };
}
}
log.weekly = s.v35.weekly[s.v35.weekly.length - 1] || null;
if (s.week >= 5 && !s._milestonePaid && V.testTier({ver:s.ver,stats:s}).tier === "full") {
this.payoutIncome(300000, { kind: "milestone" });
s._milestonePaid = true; log.milestone = 300000;
}
const avgE = (s.v35.energy.pre + s.v35.energy.data + s.v35.energy.post) / 3;
const maxLv = (c.STAGE_TRAIT_MAX || {})[s.ver || "V1"] || 1;
const canUp = (s.engineers || []).some((e) => !e.resigned && (e.traits || []).some((t) => (t.level || 1) < maxLv));
if (avgE >= 80 && canUp && !s.traitProbBoost && !s._vigourUsed && Math.random() < 0.5) {
s.traitProbBoost = true; s._vigourUsed = true;
this.addEnergyAll(-15);
log.vigour = true;
}
s.hintsDone = s.hintsDone || {};
for (const h of (c.OFFICE_HINTS || [])) {
if (h.ver && h.ver !== (s.ver || "V1")) continue;
if (h.type === "payday") continue;
let hit = false;
if (h.type === "stage_enter" && s.week === (h.week != null ? h.week : 1)) hit = true;
else if (h.type === "week" && s.week === h.week) hit = true;
else if (h.type === "review_ready" && this.canReview()) hit = true;
else if (h.type === "corpus_shortage" && s.v35.gapState && s.v35.gapState !== "ok") hit = true;
else if (h.type === "fund_low" && (s.funding || 0) < this.payrollTotal()) hit = true;
else if (h.type === "axis_milestone") {
const axIds = window.V35.activeAxes(s);
if (h.axis && axIds.indexOf(h.axis) >= 0) {
const _msc = window.V35.lineScale ? window.V35.lineScale(s.ver || "V1", s.paramTarget) : 1;
const need = ((this.missionOf(s.ver) || {}).axisMin || {})[h.axis];
const line = Math.round((need != null ? need : (window.V35.axisPass(s.ver, h.axis) || 0)) * _msc);
const mark = (h.pct != null ? h.pct : 0.5) * line;
if (line > 0 && (s[h.axis] || 0) >= mark) hit = true;
}
}
const freq = h.freq || (h.once === false ? "always" : "game");
const doneKey = freq === "always" ? null
: (freq === "stage" ? (h.id + "@" + (s.ver || "V1")) : h.id);
if (hit && (!doneKey || !s.hintsDone[doneKey])) {
if (doneKey) s.hintsDone[doneKey] = true;
const hTxt = h.axis ? String(h.text || "").replace(/\{axis\}/g, this.statLabel(h.axis)) : h.text;
(log.notices = log.notices || []).push({ kind: "hint", tag: "节点提示", text: this.noticeTpl(hTxt), avatar: h.avatar || null });
}
}
s.newsFeed = s.newsFeed || [];
s.newsTimelineDone = s.newsTimelineDone || {};
const pushFeed = (id, title, text, src, date, img, imgAlt) =>
this.pushNews({ id, title, text, src, date, img, imgAlt });
const tl = this.calendarNewsAtCurrentWeek();
if (tl.length) {
for (const n of tl) {
s.newsTimelineDone[n.id] = true;
pushFeed(n.id, n.title, this.fillWhaleText(this.noticeTpl(n.desc)), n.src, n.date, n.img, n.imgAlt);
}
} else if (Math.random() < (c.NEWS_PAGE && c.NEWS_PAGE.NEW_EVERY_MIN
? Math.min(1, 1 / Math.max(1, c.NEWS_PAGE.NEW_EVERY_MIN)) : 0.5)) {
const rn = this.rollNews();
if (rn) pushFeed(rn.id, rn.title, this.noticeTpl(rn.desc), rn.src, null, rn.img, rn.imgAlt);
}
const _verGate = !v.EVENTS_FROM_VER
|| (c.VER_ORDER || []).indexOf(s.ver || "V1") >= (c.VER_ORDER || []).indexOf(v.EVENTS_FROM_VER);
if (_verGate && !log.event && window.StaffRaiseEvents) {
const salaryEv = window.StaffRaiseEvents.offer(this);
if (salaryEv) log.event = salaryEv;
}
if (_verGate
&& s.week >= 2 && !s.pendingEvent
&& s.rounds - (s._lastEvtTick || 0) >= (v.EVENT_EVERY || 9)
&& Math.random() < (v.EVENT_PROB != null ? v.EVENT_PROB : 0.7)) {
const all = (c.EVENTS || []).filter((e) => this.eventEligibleForStage(e, s)
&& !this.poachEventBlocked(e, s) && e.pool !== false
&& e.enabled !== false
&& !e.special
&& !(Array.isArray(e.stages) && e.stages.length && !e.stages.includes(s.ver || "V1"))
&& !(e.minVer && (c.VER_ORDER || []).indexOf(e.minVer) > (c.VER_ORDER || []).indexOf(s.ver || "V1"))
&& !(e.inject && this.injectPoolBlocked(s, e)));
s._evtLastAt = s._evtLastAt || {};
s._evtOnce = s._evtOnce || {};
const cdOk = (ev) => {
if (ev.once && s._evtOnce[ev.no]) return false;
if (ev.cooldownGroup && s._evtGroupLastAt
&& s._evtGroupLastAt[ev.cooldownGroup] != null
&& (s.absRounds || 0) - s._evtGroupLastAt[ev.cooldownGroup]
< (ev.cooldown || 4) * (v.TICKS_PER_WEEK || 6)) return false;
return !ev.cooldown || !s._evtLastAt[ev.no]
|| s.rounds - s._evtLastAt[ev.no] >= ev.cooldown * (v.TICKS_PER_WEEK || 6);
};
const condOk = (cond) => !cond || (
(cond.avg_energy_below == null || avgE < cond.avg_energy_below)
&& (cond.avg_energy_above == null || avgE > cond.avg_energy_above)
&& (cond.funding_below == null || (s.funding || 0) < cond.funding_below)
&& (cond.funding_above == null || (s.funding || 0) > cond.funding_above)
&& (cond.corpus_below == null || s.v35.corpus.token < cond.corpus_below)
&& (cond.quit_risk == null || !!s.v35.leaveRisk)
&& (cond.poach_risk == null || !!s.v35.poachRisk)
&& (cond.brand_above == null || (s.brand || 0) > cond.brand_above)
&& (cond.brand_below == null || (s.brand || 0) < cond.brand_below)
&& (cond.param_at_least == null || (s.paramTarget || 0) >= cond.param_at_least)
&& (cond.staff_at_least == null
|| s.engineers.filter((e) => !e.resigned).length >= cond.staff_at_least)
&& (cond.gpu_below == null || (c.GPU_TIER_ORDER || Object.keys(c.GPU_TIERS || {}))
.indexOf(s.gpuTier || "basic") < cond.gpu_below)
&& (cond.corpus_above_ratio == null || s.v35.corpus.token
> (((v.STAGES || {})[s.ver || "V1"] || {}).GATE
|| ((c.V35.CORPUS_CURVE || {}).GATE) || 0) * cond.corpus_above_ratio)
&& (cond.investor == null || !!s.investor === !!cond.investor));
const poorMul = (e) => {
const p = e && e.poor;
if (!p) return 1;
const pay = this.monthlyPayroll() || 0;
if (!(pay > 0)) return 1;
const f = Math.max(1, s.funding || 0);
const ref = pay * (p.months != null ? p.months : 3);
if (f >= ref) return 1;
const max = p.max != null ? p.max : 12;
return Math.max(1, Math.min(max, ref / f));
};
const wt = (e) => Math.max(0, e.weight != null ? e.weight : 1) * poorMul(e);
const pickW = (arr) => {
const ws = arr.map(wt);
const tot = ws.reduce((a, b) => a + b, 0);
if (!(tot > 0)) return arr[Math.floor(Math.random() * arr.length)];
let r = Math.random() * tot;
for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
return arr[arr.length - 1];
};
const conds = all.filter((e) => (e.type === "cond" || e.cond) && cdOk(e) && condOk(e.cond));
const rands = all.filter((e) => e.type !== "cond" && !e.cond && cdOk(e));
all.forEach((e) => {
if (e.poor && poorMul(e) > 1 && cdOk(e) && rands.indexOf(e) >= 0 && conds.indexOf(e) < 0) conds.push(e);
});
const hard = conds.filter((e) => e.cond
&& (e.cond.quit_risk != null || e.cond.poach_risk != null || e.cond.mini_done != null));
let pool;
if (hard.length) pool = hard;
else if (conds.length && rands.length) {
pool = Math.random() < (v.COND_PRIORITY != null ? v.COND_PRIORITY : 0.6) ? conds : rands;
} else pool = conds.length ? conds : rands;
if (pool.length) {
const ev = pickW(pool);
s.pendingEvent = { id: ev.no };
s._lastEvtTick = s.rounds;
s._evtLastAt[ev.no] = s.rounds;
if (ev.cooldownGroup) {
s._evtGroupLastAt = s._evtGroupLastAt || {};
s._evtGroupLastAt[ev.cooldownGroup] = s.absRounds || 0;
}
if (ev.once) s._evtOnce[ev.no] = true;
if (ev.cond && ev.cond.quit_risk) {
s.v35.leaveRisk = false;
s.v35.lowE = { pre: 0, data: 0, post: 0, embodied: 0 };
s.v35.riskWho = s.v35.leaveWho;
}
if (ev.cond && ev.cond.poach_risk) { s.v35.poachRisk = false; s.v35.riskWho = s.v35.poachWho; }
let evTarget = null;
if (s.v35.riskWho) {
evTarget = s.engineers.find((e) => !e.resigned && e.id === s.v35.riskWho) || null;
} else if (ev.pick) {
evTarget = this.pickEventTarget(ev, s.engineers.filter((e) => !e.resigned
&& (e.joinTick == null || s.v35.tick >= e.joinTick)));
}
s.v35.riskWho = null;
if (evTarget) s.pendingEvent.targetId = evTarget.id;
log.event = evTarget ? Object.assign({}, ev, { targetName: evTarget.name }) : ev;
}
}
}
s.corpus = Math.round(s.v35.corpus.token * 10) / 10;
if (s.paperResearch && s.v35.paper.done) {
const pid = this.paperNoOf(s.paperResearch.id);
if (!s.papersOwned) s.papersOwned = [];
log.paperUnlocked = (c.ARCHITECTURES || [])
.filter((a) => this.paperNoOf(a.unlockPaper) === pid && this.archUnlock(a).ok).map((a) => a.name);
s.papersOwned.push(pid);
log.paperDone = pid;
s.paperResearch = null;
this.refreshPaperCandidates();
}
const period = v.TICKS_PER_WEEK * 4;
s.payrollDue = (s.payrollDue != null ? s.payrollDue : period) - 1;
if (s.payrollDue <= 0) { s.payrollDue = period; log.payroll = this.doPayroll(); }
for (const h of (c.OFFICE_HINTS || [])) {
if (h.type !== "payday") continue;
if (h.ver && h.ver !== (s.ver || "V1")) continue;
const before = h.ticksBefore != null ? h.ticksBefore : 6;
if (s.payrollDue === before && !s._hintPayday) {
s._hintPayday = true;
(log.notices = log.notices || []).push({ kind: "hint", tag: "节点提示", text: h.text, avatar: h.avatar || null });
}
}
const bw = this.bankruptWarn();
if (bw) log.bankruptWarn = bw;
const bankruptcy = this.bankruptcyTick();
if (bankruptcy) { Object.assign(log, bankruptcy); break; }
}
log.week = s.week;
return log;
},
qualityPremiumS() {
const s = this.state, st = s && s.v35;
if (!st || !st.qualityMix) return 0;
const per = (this.cfg.V35 && this.cfg.V35.PREMIUM_TICK_BONUS != null)
? this.cfg.V35.PREMIUM_TICK_BONUS : 1;
if (!(per > 0)) return 0;
const cells = Math.max(0, Math.min(5, Math.round(st.qualityMix.p || 0)));
return cells * per;
},
energyCostMul() {
const c = this.cfg, s = this.state;
let mul = 1;
for (const pid of s.papersOwned || []) {
const p = this.paperOf(pid);
if (p && p.effect && p.effect.kind === "energy") mul *= p.effect.mul;
}
return mul;
},
collect(engId) {
const c = this.cfg, s = this.state;
if (this.v35On()) return { ok: false, tip: "全自动产出，无需收集" };
const O = c.OFFICE || {};
const e = s.engineers.find((x) => x.id === engId && !x.resigned);
if (!e) return { ok: false, tip: "找不到这位工程师" };
const raw = (s.prodByEng[engId]) || 0;
if (raw <= 0) return { ok: false, tip: "还没有可收的产出" };
s._comboCount = (s._comboCount || 0) + 1;
const combo = s._comboCount >= (O.COLLECT_COMBO_AT || 3);
const crit = Math.random() < (O.CRIT_CHANCE || 0.05);
let val = raw * (crit ? (O.CRIT_MUL || 2) : 1) * (combo ? (O.COLLECT_COMBO_MUL || 1.15) : 1);
val = Math.round(val);
const dim = this.mainDimOf(e);
const cap = this.statCap();
const inc = this.newDims(0, s);
inc[dim] = Math.max(1, Math.round(val * 0.7));
for (const k of this.baseDims()) {
if (k === dim) continue;
inc[k] = Math.max(0, Math.round(val * 0.1));
}
for (const k of Object.keys(inc)) {
const before = s[k];
s[k] = Math.min(this.statLimit(k, cap), Math.max(0, s[k] + inc[k]));
inc[k] = s[k] - before;
}
s.prodByEng[engId] = 0;
s.prodFullByEng[engId] = false;
return {
ok: true, name: e.name, dim, dimName: this.statLabel(dim),
raw: Math.round(raw * 10) / 10, value: val, inc, crit, combo,
left: this.totalProd(),
};
},
collectAll() {
const s = this.state;
const alive = s.engineers.filter((e) => !e.resigned)
.sort((a, b) => ((s.prodByEng[b.id]) || 0) - ((s.prodByEng[a.id]) || 0));
const results = [];
s._comboCount = 0;
for (const e of alive) {
const r = this.collect(e.id);
if (r.ok) results.push(r);
}
s._comboCount = 0;
return { ok: results.length > 0, results, total: results.reduce((a, r) => a + r.value, 0) };
},
totalProd() {
const s = this.state;
const sum = Object.values(s.prodByEng || {}).reduce((a, v) => a + (v || 0), 0);
return Math.floor(sum);
},
settleIdleProd() {
const c = this.cfg, s = this.state;
if (this.v35On()) return { ok: false, total: 0 };
const O = c.OFFICE || {};
const mul = O.IDLE_SETTLE_MUL != null ? O.IDLE_SETTLE_MUL : 0.7;
const cap = this.statCap();
let total = 0;
for (const e of s.engineers.filter((x) => !x.resigned)) {
const raw = (s.prodByEng[e.id]) || 0;
if (raw <= 0) continue;
const dim = this.mainDimOf(e);
const val = Math.max(1, Math.round(raw * mul));
const before = s[dim];
s[dim] = Math.min(this.statLimit(dim, cap), Math.max(0, s[dim] + val));
total += s[dim] - before;
s.prodByEng[e.id] = 0;
s.prodFullByEng[e.id] = false;
}
return { ok: total > 0, total, mul };
},
startFocus(dim) {
const c = this.cfg, s = this.state;
const F = c.FOCUS || {};
const combined = dim === "codeText" || dim === "safetyStability";
if (combined && !this.embodiedAvailable()) return { ok: false, tip: "合并能力攻关在具身智能时代开放" };
if (!combined && this.dimsOf(s).indexOf(dim) < 0) return { ok: false, tip: "本模型尚未激活这个能力方向" };
if (this.v35On()) {
const v = c.V35;
if (!s.planDone) return { ok: false, tip: "先立项，再谈攻关" };
if (s.v35.focus.left > 0) return { ok: false, tip: "已经在攻关中了" };
const comboGate = this.archGate(s.arch, s.paramTarget);
const gate = comboGate != null
? Math.round(comboGate * (v.FOCUS_GATE_MUL != null ? v.FOCUS_GATE_MUL : 1.3))
: (v.FOCUS_CORPUS_GATE != null ? v.FOCUS_CORPUS_GATE : ((v.FOCUS_GATES || {})[dim]));
if (gate != null && s.v35.corpus.token < gate) {
return { ok: false, tip: `语料不足：需有效 token ≥ ${gate}（当前 ${Math.floor(s.v35.corpus.token)}）` };
}
const cost = v.FOCUS_COST != null ? v.FOCUS_COST : (F.COST || 200000);
if ((s.funding || 0) < cost) return { ok: false, tip: `经费不够（需要 ${Math.round(cost / 10000)} 万）` };
s.funding -= cost;
s.v35.focus = { dim, left: v.FOCUS_TICKS };
s.v35.focusEverUsed = true;
s.focusBoost = { dim, mul: v.FOCUS_MUL, roundsLeft: v.FOCUS_TICKS };
return { ok: true, dim, cost, weeks: v.FOCUS_TICKS / v.TICKS_PER_WEEK };
}
if (!s.planDone) return { ok: false, tip: "先立项，再谈攻关" };
if (s.focusBoost) return { ok: false, tip: "已经在攻关中了" };
const cost = F.COST || 200000;
if ((s.funding || 0) < cost) return { ok: false, tip: `经费不够（需要 ${Math.round(cost / 10000)} 万）` };
s.funding -= cost;
s.focusBoost = { dim, mul: F.MUL || 1.5, roundsLeft: (F.WEEKS || 4) * ((c.OFFICE && c.OFFICE.ROUNDS_PER_WEEK) || 7) };
return { ok: true, dim, cost, weeks: F.WEEKS || 4 };
},
stagePapersNeeded() {
const c = this.cfg, s = this.state;
const out = [];
const want = (id) => {
const no = this.paperNoOf(id);
if (no == null) return;
if (this.hasPaper(no)) return;
if (s.paperResearch && this.paperNoOf(s.paperResearch.id) === no) return;
if (out.indexOf(no) < 0) out.push(no);
};
const byVer = ((c.PAPER && c.PAPER.CANDIDATES_BY_VER) || {})[s.ver || "V1"];
if (byVer) byVer.forEach(want);
const _order = c.VER_ORDER || ["V1"];
const _vi = _order.indexOf(s.ver || "V1");
for (const a of (c.ARCHITECTURES || [])) {
if (!a.unlockPaper) continue;
if (_order.indexOf(a.unlock || "V1") > _vi + 1) continue;
want(a.unlockPaper);
}
return out;
},
refreshPaperCandidates() {
const c = this.cfg, s = this.state;
const pool = (c.PAPER && c.PAPER.POOL) || [];
const byVer = (c.PAPER && c.PAPER.CANDIDATES_BY_VER || {})[s.ver || "V1"];
const doing = s.paperResearch ? this.paperNoOf(s.paperResearch.id) : null;
if (byVer) {
s.paperCandidates = byVer.map((x) => this.paperNoOf(x))
.filter((no) => no != null && !this.hasPaper(no) && doing !== no);
} else {
const cnt = (c.PAPER && c.PAPER.CANDIDATE_COUNT) || 3;
const avail = pool.filter((p) => !this.hasPaper(p.no) && doing !== p.no);
for (let i = avail.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[avail[i], avail[j]] = [avail[j], avail[i]];
}
s.paperCandidates = avail.slice(0, cnt).map((p) => p.no);
}
for (const id of this.stagePapersNeeded()) {
if (s.paperCandidates.indexOf(id) < 0) s.paperCandidates.push(id);
}
return s.paperCandidates;
},
healPaperCandidates() {
const s = this.state;
if (!Array.isArray(s.paperCandidates)) s.paperCandidates = [];
s.papersOwned = (Array.isArray(s.papersOwned) ? s.papersOwned : [])
.map((x) => this.paperNoOf(x)).filter((no, i, a) => no != null && a.indexOf(no) === i);
s.paperCandidates = s.paperCandidates.map((x) => this.paperNoOf(x))
.filter((no, i, a) => no != null && a.indexOf(no) === i);
if (s.paperResearch && s.paperResearch.id != null) {
const no = this.paperNoOf(s.paperResearch.id);
if (no != null) s.paperResearch.id = no; else s.paperResearch = null;
}
const pool = (this.cfg.PAPER && this.cfg.PAPER.POOL) || [];
if (pool.length) {
const ids = new Set(pool.map((p) => p.no));
s.paperCandidates = s.paperCandidates.filter((id) => ids.has(id));
}
let added = 0;
for (const id of this.stagePapersNeeded()) {
if (s.paperCandidates.indexOf(id) < 0) { s.paperCandidates.push(id); added++; }
}
return added;
},
healNotebook() {
const s = this.state;
if (!Array.isArray(s.notebook)) s.notebook = [];
const notes = this.c2Notes();
s.notebook = s.notebook.map(String).filter((id, i, a) => notes[id] && a.indexOf(id) === i);
},
healCandExpire() {
const s = this.state;
if (!Array.isArray(s.candidates)) return;
const ttl = this.cfg.CANDIDATE_TTL_WEEKS || 0;
if (ttl <= 0) return;
for (const cd of s.candidates) {
if (!cd || cd.starter) continue;
if (cd.expireAbsWeek != null || cd.expireWeek != null) continue;
cd.expireAbsWeek = this.absWeek() + ttl;
}
},
healEventIds() {
const s = this.state;
if (Array.isArray(s.triggered)) {
s.triggered.forEach((t) => {
if (!t || t.id == null) return;
const no = this.evNoOf(t.id);
if (no != null) t.id = no;
});
}
const rekey = (obj) => {
if (!obj || typeof obj !== "object") return {};
const out = {};
Object.keys(obj).forEach((k) => {
const no = this.evNoOf(k);
out[no != null ? no : k] = obj[k];
});
return out;
};
s._evtOnce = rekey(s._evtOnce);
s._evtLastAt = rekey(s._evtLastAt);
if (s.pendingEvent && s.pendingEvent.id != null) {
const no = this.evNoOf(s.pendingEvent.id);
if (no != null) s.pendingEvent.id = no; else s.pendingEvent = null;
}
if (Array.isArray(s.pending)) {
s.pending.forEach((p) => {
if (p && p.id != null) { const no = this.evNoOf(p.id); if (no != null) p.id = no; }
if (p && p.no == null && p.key != null) p.no = this.evNoOf(p.key);
});
}
},
healEngineerIds() {
const s = this.state;
if (!s) return;
const leg = this.cfg.ENGINEERS_LEGACY_NO || {};
const noOfOld = (x) => (typeof x === "string" && leg[x] != null ? leg[x] : null);
const fixEnt = (e) => {
if (!e || typeof e !== "object") return;
const no = this.engNoOf(e);
if (no == null) return;
if (e.no !== no) e.no = no;
const want = this.engIdOf(no);
if (e.id !== want) e.id = want;
};
(s.engineers || []).forEach(fixEnt);
(s.candidates || []).forEach(fixEnt);
const rekeyIn = (obj) => {
if (!obj || typeof obj !== "object") return;
Object.keys(obj).forEach((k) => {
const i = k.indexOf(":");
const base = i < 0 ? k : k.slice(0, i), suf = i < 0 ? "" : k.slice(i);
const no = noOfOld(base);
if (no == null) return;
const nk = this.engIdOf(no) + suf;
if (nk === k) return;
obj[nk] = obj[k];
delete obj[k];
});
};
["tbTalked", "tbRested", "tbTrained", "workClicks", "workQuota",
"prodByEng", "prodFullByEng", "seatOf", "_candLocked"].forEach((k) => rekeyIn(s[k]));
rekeyIn((s.v35 || {}).prodAcc);
const fixVal = (holder, k) => { if (!holder) return; const no = noOfOld(holder[k]); if (no != null) holder[k] = this.engIdOf(no); };
fixVal(s, "leader");
fixVal(s, "lastLeader");
fixVal(s, "_evTarget");
fixVal(s.v35, "leaveWho");
fixVal(s.v35, "poachWho");
fixVal(s.v35, "riskWho");
(s.actionLog || []).forEach((a) => fixVal(a, "targetId"));
if (Array.isArray(s.sparkUsed)) {
s.sparkUsed = s.sparkUsed.map((x) => { const no = noOfOld(x); return no != null ? this.engIdOf(no) : x; });
}
},
foldTraitDups(e) {
if (!e || !Array.isArray(e.traits)) return 0;
const before = e.traits.length;
const out = [], at = new Map();
for (const t of e.traits) {
if (!t || !t.type) continue;
if (at.has(t.type)) {
const j = at.get(t.type);
if ((t.level || 1) > (out[j].level || 1)) out[j] = { ...out[j], level: t.level };
} else { at.set(t.type, out.length); out.push({ ...t }); }
}
e.traits = out;
return before - out.length;
},
healEngineerRoles() {
const s = this.state;
if (!s) return 0;
let n = 0;
for (const k of ["engineers", "candidates", "miniModels"]) {
for (const e of s[k] || []) {
if (!e || e.type) continue;
e.type = this.primaryTraitType(e); n++;
}
}
return n;
},
healTraitDups() {
const s = this.state;
if (!s) return 0;
let n = 0;
for (const k of ["engineers", "candidates"]) {
for (const e of (s[k] || [])) n += this.foldTraitDups(e);
}
for (const e of (s.miniModels || [])) n += this.foldTraitDups(e);
return n;
},
healDimOverCap() {
const s = this.state;
if (!s) return 0;
let cap;
try { cap = this.statCap(); } catch (e) { return 0; }
if (!cap) return 0;
let n = 0;
if (window.V35.mergedGroups(s).length) {
const clean = window.V35.clampStats(s, s, cap);
const engine = s.v35 && s.v35.stats ? window.V35.clampStats(s, s.v35.stats, cap) : null;
for (const k of window.V35.allDims()) {
if (typeof s[k] === "number" && s[k] !== clean[k]) { s[k] = clean[k]; n++; }
if (engine && typeof s.v35.stats[k] === "number") s.v35.stats[k] = engine[k];
}
return n;
}
const clamp1 = (k) => {
const cv = cap[k];
if (cv == null || !isFinite(cv)) return;
const v = s[k];
if (typeof v !== "number" || !isFinite(v)) return;
const w = Math.max(0, Math.min(cv, v));
if (w !== v) { s[k] = w; n++; }
if (s.v35 && s.v35.stats && typeof s.v35.stats[k] === "number") {
const mv = Math.max(0, Math.min(cv, s.v35.stats[k]));
if (mv !== s.v35.stats[k]) s.v35.stats[k] = mv;
}
};
for (const k of this.dimsOf(s)) clamp1(k);
for (const k of (window.V35 && window.V35.allDims ? window.V35.allDims() : [])) clamp1(k);
return n;
},
startPaper(pid) {
const c = this.cfg, s = this.state;
const p = this.paperOf(pid);
if (!p) return { ok: false, tip: "找不到这篇论文" };
pid = p.no;
if (this.v35On()) {
if (s.paperResearch) return { ok: false, tip: "正在研究中，等这篇做完" };
if (this.hasPaper(pid)) return { ok: false, tip: "已经掌握" };
s.v35.paper.started = true;
s.v35.paper.done = false;
s.v35.paper.kind = p.effect.kind || 'text_prob';
s.v35.paper.axis = (p.effect && p.effect.axis) || null;
s.v35.paper.axisProb = (p.effect && p.effect.axisProb) != null ? p.effect.axisProb : 0;
s.v35.paper.axisAdd = (p.effect && p.effect.axisAdd) != null ? p.effect.axisAdd : 1;
s.v35.paper.left = c.V35.PAPER_RESEARCH_TICKS;
const pw = c.V35.TICKS_PER_WEEK || 6;
s.paperResearch = { id: pid, weeks: Math.max(1, Math.round((c.V35.PAPER_RESEARCH_TICKS / pw) * 10) / 10),
startWeek: s.week || 0 };
return { ok: true, paper: p, free: true };
}
if (s.paperResearch) return { ok: false, tip: "正在研究中，等这篇做完" };
if (this.hasPaper(pid)) return { ok: false, tip: "已经掌握" };
s.paperResearch = { id: pid, weeks: p.weeks, startWeek: s.week || 0 };
return { ok: true, paper: p };
},
paperWeeksLeft() {
const c = this.cfg, s = this.state;
const pr = s.paperResearch;
if (!pr) return 0;
const tpw = (c.V35 && c.V35.TICKS_PER_WEEK) || 6;
if (this.v35On() && s.v35 && s.v35.paper && (s.v35.paper.left || 0) > 0) {
return Math.max(1, Math.ceil((s.v35.paper.left || 0) / tpw));
}
return Math.max(1, (pr.startWeek || 0) + (pr.weeks || 1) - (s.week || 0));
},
doPayroll() {
const c = this.cfg, s = this.state;
const P = c.PAYROLL || {};
s._hintPayday = false;
const alive = s.engineers.filter((e) => !e.resigned);
const total = alive.reduce((a, e) => a + (e.salary || 0), 0) * 1;
const res = { total, paid: true, deficit: 0, left: [], pardoned: false };
if (total <= 0) return res;
if ((s.funding || 0) >= total) {
s.funding -= total;
return res;
}
const short = total - (s.funding || 0);
s.funding = 0;
s.fiscalDeficit = (s.fiscalDeficit || 0) + short;
res.paid = false;
res.deficit = short;
if (P.FIRST_PARDON && !s.pardonUsed) {
s.pardonUsed = true;
res.pardoned = true;
} else {
this.addEnergyAll(-(P.DEFICIT_ENERGY_HIT != null ? P.DEFICIT_ENERGY_HIT : 20));
}
return res;
},
payrollDue() { return this.state.payrollDue || 0; },
monthlyPayroll() {
return this.state.engineers.filter((e) => !e.resigned).reduce((a, e) => a + (e.salary || 0), 0);
},
injectPoolBlocked(st, e) {
if (st._bailoutCooldownUntil && this.absWeek() < st._bailoutCooldownUntil) return true;
if (st.v35 && st.v35.dividend && (st.v35.dividend.left || 0) > 0) return true;
const months = (e && e.poor && e.poor.months != null) ? e.poor.months : 3;
const pay = this.monthlyPayroll() || 0;
return pay > 0 && (st.funding || 0) >= pay * months;
},
bankruptWarn() {
const s = this.state;
if (!s || s.phase === "over" || s.bankrupt) return null;
if (s.fiscalDeficit > 0) return null;
const pay = this.monthlyPayroll();
if (!(pay > 0)) return null;
if (!s.bankruptWarn || s.bankruptWarn.ver !== s.ver) {
s.bankruptWarn = { ver: s.ver, two: false, one: false };
}
const w = s.bankruptWarn;
const fund = s.funding || 0;
const months = fund / pay;
if (fund < pay && !w.one) {
w.one = true; w.two = true;
return { level: 2, pay: pay, fund: fund, months: months,
text: "🚨 经费不足一个月工资（约 " + Math.round(pay / 10000) + " 万）！下次发薪就要欠薪了，再撑不住就只有破产兜底那一次机会。" };
}
if (fund < pay * 2 && !w.two) {
w.two = true;
return { level: 1, pay: pay, fund: fund, months: months,
text: "⚠️ 经费已不足两个月工资（月薪约 " + Math.round(pay / 10000) + " 万），注意留够发薪的钱。" };
}
return null;
},
clickEngineer(engId) {
const c = this.cfg, s = this.state;
const w = c.WORK_CLICK || {};
const e = s.engineers.find((x) => x.id === engId && !x.resigned);
if (!e) return { ok: false, tip: "找不到这位工程师" };
const left = this.workshopClicks(e);
if (left <= 0) return { ok: false, tip: `${e.name} 已经点不动了，先让他歇会儿` };
const keys = this.baseDims();
const k = keys[Math.floor(Math.random() * keys.length)];
const crit = Math.random() < (w.CRIT_PROB != null ? w.CRIT_PROB : 0.3);
let add = (w.ADD != null ? w.ADD : 1) * (crit ? (w.CRIT_MULT || 2) : 1);
s.workClicks = s.workClicks || {};
const used = (s.workClicks[e.id]) || 0;
const comboAt = w.COMBO_AT != null ? w.COMBO_AT : 5;
const combo = used > 0 && (used + 1) % comboAt === 0;
if (combo) add += (w.COMBO_ADD != null ? w.COMBO_ADD : 1);
const cap = this.statCap();
const before = s[k];
s[k] = Math.min(this.statLimit(k, cap), Math.max(0, s[k] + add));
const real = s[k] - before;
this.addEnergy(e, -(w.ENERGY_COST != null ? w.ENERGY_COST : 2));
s.workClicks[e.id] = used + 1;
s.workGain = s.workGain || this.newDims(0, s);
s.workGain[k] = (s.workGain[k] || 0) + real;
let corpusAdd = 0;
if ((e.traits || []).some((t) => t.type === "data")) {
const cc = this.cfg.CORPUS || {};
const capW = cc.CAP != null ? cc.CAP : 60;
const per = cc.PROD_PER_LV != null ? cc.PROD_PER_LV : 8;
corpusAdd = Math.round((per / 12) * 10) / 10;
const c0 = s.corpus || 0;
s.corpus = Math.min(capW, Math.round((c0 + corpusAdd) * 10) / 10);
corpusAdd = Math.round((s.corpus - c0) * 10) / 10;
}
return {
ok: true, stat: k, statName: this.statLabel(k), add: real, crit, combo,
corpusAdd, name: e.name, left: this.workshopClicks(e),
};
},
clickAllEngineers() {
const c = this.cfg, s = this.state;
const min = (c.WORK_CLICK && c.WORK_CLICK.ALL_MIN_TEAM) || 5;
const alive = s.engineers.filter((e) => !e.resigned);
if (alive.length < min) return { ok: false, tip: `团队满 ${min} 人才能一键全员` };
const results = [];
let guard = 0;
for (const e of alive) {
while (this.workshopClicks(e) > 0 && guard++ < 500) {
const r = this.clickEngineer(e.id);
if (!r.ok) break;
results.push(r);
}
}
if (!results.length) return { ok: false, tip: "大家这轮都点不动了" };
return { ok: true, results, count: results.length };
},
clampNum(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); },
_eng(engId, tip) {
const e = this.state.engineers.find((x) => x.id === engId && !x.resigned);
return e || null;
},
arrangeUsed(e) {
const s = this.state;
const wk = this.absWeek();
const per = ((this.cfg.PAYROLL || {}).PERIOD_ROUNDS) || 28;
const monthBucket = Math.floor((s.absRounds || 0) / per);
const lastTalk = s.tbTalked && s.tbTalked[e.id + ":aw"];
return {
talk: typeof lastTalk === "number" && wk - lastTalk < 2,
train: !!(s.tbTrained && s.tbTrained[e.id + ":w" + wk]),
raise: !!(s.raisedCount && s.raisedCount[e.id + ":" + monthBucket]),
rest: ((s.restCount && s.restCount[e.id + ":w" + wk]) || 0) >= 2
|| e.restWeek === (s.week || 0),
};
},
arrangeEngineer(engId) {
const s = this.state;
const c = this.cfg;
const e = this._eng(engId);
if (!e) return { ok: false, tip: "找不到这位工程师" };
if (this.offworkNow()) return { ok: false, tip: "🌙 已经下班了，明天上班再聊吧" };
this.ensureStatus(e);
s.tbTalked = s.tbTalked || {};
if (this.arrangeUsed(e).talk) return { ok: false, tip: e.name + "这两周已经聊过了" };
s.tbTalked[e.id + ":aw"] = this.absWeek();
const gain = ((c.TEAM_BUILD || {}).TALK_ENERGY != null) ? (c.TEAM_BUILD || {}).TALK_ENERGY : 12;
const got = this.addEnergy(e, gain);
return { ok: true, tip: e.name + " 聊完松快了些：体力 +" + Math.round(got) };
},
trainEngineer(engId) {
const s = this.state, c = this.cfg;
const e = this._eng(engId);
if (!e) return { ok: false, tip: "找不到这位工程师" };
if (this.offworkNow()) return { ok: false, tip: "🌙 已经下班了，明天上班再培训吧" };
const cost = ((c.TEAM_BUILD || {}).TRAIN_COST != null) ? c.TEAM_BUILD.TRAIN_COST : 30000;
if (s.funding < cost) return { ok: false, tip: "经费不足（需要 " + Math.round(cost / 10000) + " 万）" };
s.tbTrained = s.tbTrained || {};
if (this.arrangeUsed(e).train) return { ok: false, tip: e.name + " 本周已经培训过了" };
s.funding -= cost;
s.tbTrained[e.id + ":w" + this.absWeek()] = true;
this.ensureStatus(e);
e.stats = e.stats || {};
this.healEngineeringTalent(e);
const keys = this.engStatKeys(e);
const TB = c.TEAM_BUILD || {};
let k;
if ((TB.TRAIN_PICK || "random") === "low") {
const ref = TB.TRAIN_WEIGHT_REF != null ? TB.TRAIN_WEIGHT_REF : 100;
const w = keys.map((q) => Math.max(0, ref - (e.stats[q] || 0)));
const sum = w.reduce((a, b) => a + b, 0);
if (sum <= 0) {
k = keys[Math.floor(Math.random() * keys.length)];
} else {
let r = Math.random() * sum;
k = keys[keys.length - 1];
for (let i = 0; i < keys.length; i++) { r -= w[i]; if (r <= 0) { k = keys[i]; break; } }
}
} else {
k = keys[Math.floor(Math.random() * keys.length)];
}
const add = ((c.TEAM_BUILD || {}).TRAIN_STAT_ADD != null) ? (c.TEAM_BUILD || {}).TRAIN_STAT_ADD : 5;
const before = e.stats[k] || 0;
e.stats[k] = Math.min(100, before + add);
const gained = e.stats[k] - before;
const dEn = this.addEnergy(e, -((c.TEAM_BUILD || {}).TRAIN_ENERGY_COST != null
? (c.TEAM_BUILD || {}).TRAIN_ENERGY_COST : 10));
return { ok: true, tip: e.name + " 培训完成：" + this.statName(k) + " +" + Math.round(gained) + "、体力 " + Math.round(dEn) };
},
restEngineer(engId) {
const s = this.state;
const e = this._eng(engId);
if (!e) return { ok: false, tip: "找不到这位工程师" };
if (this.offworkNow()) return { ok: false, tip: "🌙 人都下班了，就谈不上休息安排了" };
if (e.restWeek === (s.week || 0)) return { ok: false, tip: e.name + " 这周已经在休息了" };
s.restCount = s.restCount || {};
const key = e.id + ":w" + this.absWeek();
s.restCount[key] = (s.restCount[key] || 0);
if (s.restCount[key] >= 2) return { ok: false, tip: e.name + " 本周已经休息两次了" };
s.restCount[key]++;
this.ensureStatus(e);
const gain = (this.cfg.TEAM_BUILD || {}).REST_ENERGY != null
? (this.cfg.TEAM_BUILD || {}).REST_ENERGY : 35;
e.restWeek = s.week || 0;
e.energyPending = (e.energyPending || 0) + gain;
this.syncResting();
return { ok: true, tip: `${e.name} 下班休息了：本周不产出，下周上班时体力 +${Math.round(gain)}` };
},
productionRoundsPerWeek() {
const c = this.cfg || {};
const n = this.v35On() ? (c.V35 || {}).TICKS_PER_WEEK : (c.OFFICE || {}).ROUNDS_PER_WEEK;
return Math.max(1, Number(n) || 6);
},
raiseProductionCfg() {
const t = (this.cfg || {}).TEAM_BUILD || {};
return {
mul: Math.max(1, Number(t.RAISE_PROD_MUL != null ? t.RAISE_PROD_MUL : 1.5) || 1),
weeks: Math.max(0, Number(t.RAISE_PROD_WEEKS != null ? t.RAISE_PROD_WEEKS : 4) || 0),
};
},
refreshRaiseProduction(e) {
const b = this.raiseProductionCfg();
e.raiseProdUntilRound = Math.max(0, Number((this.state || {}).absRounds) || 0)
+ Math.ceil(b.weeks * this.productionRoundsPerWeek());
return this.raiseProductionStatus(e);
},
raiseProductionStatus(e, atRound) {
const now = atRound != null ? Number(atRound) : Number((this.state || {}).absRounds) || 0;
const end = Number(e && e.raiseProdUntilRound);
const left = Number.isFinite(end) ? Math.max(0, end - now) : 0;
const mul = this.raiseProductionCfg().mul;
const active = !!e && !e.resigned && left > 0 && mul > 1;
return { active, mul: active ? mul : 1, roundsLeft: active ? left : 0,
weeksLeft: active ? Math.ceil(left / this.productionRoundsPerWeek()) : 0 };
},
raiseProductionMul(e, atRound) { return this.raiseProductionStatus(e, atRound).mul; },
increaseSalary(e, amount) {
const add = Math.max(0, Math.round(Number(amount) || 0));
if (!e || e.resigned || !add) return null;
e.salary = Math.max(0, Math.round(Number(e.salary) || 0)) + add;
e.weeksNoRaise = 0;
return this.refreshRaiseProduction(e);
},
eventSalaryQuote(eff, evId, state) {
const s = state || this.state, effect = eff || {};
const team = effect.team_salary_raise != null;
const raw = team ? effect.team_salary_raise : effect.target_salary_raise;
if (raw == null) return { active: false, ok: true, cost: 0, salaryCost: 0, raises: [] };
const rate = Number(raw);
if (!Number.isFinite(rate) || rate <= 0 || rate > 1)
return { active: true, ok: false, tip: "调薪比例需要在 0% 到 100% 之间", raises: [] };
const no = this.evNoOf(evId != null ? evId : (s.pendingEvent || {}).id);
const pend = (s.pending || []).find((p) => this.evNoOf(p.no != null ? p.no : p.id) === no)
|| (s.pendingEvent && this.evNoOf(s.pendingEvent.id) === no ? s.pendingEvent : null);
const targetId = s._evTarget || (pend && pend.targetId);
const crew = (s.engineers || []).filter((e) => !e.resigned
&& (e.joinTick == null || !s.v35 || s.v35.tick >= e.joinTick)
&& (team || e.id === targetId));
if (!crew.length) return { active: true, ok: false, tip: "目标工程师已不在岗，不能调薪", raises: [] };
const raises = crew.map((e) => ({ id: e.id,
add: Math.max(1, Math.round(Math.max(0, Number(e.salary) || 0) * rate)) }));
const salaryCost = raises.reduce((sum, r) => sum + r.add, 0);
const cost = salaryCost + Math.max(0, -(Number(effect.funding) || 0));
const boost = this.raiseProductionCfg(), pct = Math.round(rate * 100);
return { active: true, ok: (s.funding || 0) >= cost, team, raises, salaryCost, cost, pct,
weeks: Math.ceil(boost.weeks), prodPct: Math.round((boost.mul - 1) * 100),
tip: (s.funding || 0) >= cost ? "" : "经费不足（需要 " + cost.toLocaleString("zh-CN") + " 元）" };
},
eventFundingCost(eff, seen) {
if (!eff || typeof eff !== "object") return 0;
const visited = seen || new Set();
if (visited.has(eff)) return 0;
visited.add(eff);
const branch = values => Math.max(0, ...values.map(value => this.eventFundingCost(value, new Set(visited))));
let cost = Math.max(0, -(Number(eff.funding) || 0));
if (eff.chance) cost += branch([eff.chance.success, eff.chance.fail]);
if (Array.isArray(eff.rand)) cost += branch(eff.rand);
if (eff.if_stat) cost += branch([eff.if_stat.then, eff.if_stat.else]);
if (eff.if_stability_below != null) cost += branch([eff.flip, eff.normal]);
return cost;
},
eventEffectsQuote(eff, evId, state) {
const s = state || this.state, effect = eff || {};
const dividend = s.v35 && s.v35.dividend;
if (effect.dividend && !effect.bailout && dividend && dividend.left > 0)
return { active: false, dividendBlocked: true, ok: false, cost: 0, tip: this.cfg.UI_CFG.DIVIDEND_ACTIVE_NOTICE };
const salary = this.eventSalaryQuote(effect, evId, s);
if (salary.active && !salary.ok && !salary.raises.length) return salary;
const requestedFundingCost = this.eventFundingCost(effect), requestedCost = (salary.salaryCost || 0) + requestedFundingCost;
const pureLegacyBill = this.eventLegacyBillAllowed(effect, evId, s);
const fundingCost = pureLegacyBill ? Math.min(Math.max(0, s.funding || 0), requestedFundingCost) : requestedFundingCost;
const cost = (salary.salaryCost || 0) + fundingCost;
const ok = salary.ok && (s.funding || 0) >= cost;
return Object.assign({}, salary, { expenseActive: requestedCost > 0, fundingCost, cost, requestedCost,
partialPayment: pureLegacyBill && cost < requestedCost, ok,
tip: ok ? "" : "经费不足（需要 " + Math.ceil(cost).toLocaleString("zh-CN") + " 元）" });
},
eventLegacyBillAllowed(effect, evId, state) {
const s = state || this.state;
if (this.embodiedAvailable(s) || Number(effect.funding) >= 0
|| Object.keys(effect).some(key => key !== "funding")) return false;
const isBill = ev => ev && ev.era !== "embodied" && Array.isArray(ev.options)
&& ev.options.length === 1 && ev.options[0].effects === effect;
return evId != null ? isBill(this.evByNo(evId)) : this.evList().some(isBill);
},
eventOptionStatus(opt, evId, state) { return this.eventEffectsQuote((opt || {}).effects, evId, state); },
eventOptionText(opt, evId) {
const q = this.eventOptionStatus(opt, evId);
const vars = { raise_pct: q.pct == null ? "—" : q.pct,
raise_cost: q.salaryCost == null ? "—" : q.salaryCost.toLocaleString("zh-CN"),
raise_weeks: q.weeks == null ? Math.ceil(this.raiseProductionCfg().weeks) : q.weeks,
raise_output: q.prodPct == null ? Math.round((this.raiseProductionCfg().mul - 1) * 100) : q.prodPct };
const text = String((opt || {}).text || "").replace(/\{(raise_pct|raise_cost|raise_weeks|raise_output)\}/g, (_, k) => vars[k]);
return q.partialPayment ? text + "（余额不足，本次实际支出 " + Math.round(q.cost).toLocaleString("zh-CN") + " 元）" : text;
},
raiseSalary(engId) {
const s = this.state;
const c = this.cfg;
const e = this._eng(engId);
if (!e) return { ok: false, tip: "找不到这位工程师" };
if (this.offworkNow()) return { ok: false, tip: "🌙 已经下班了，涨薪的事明天上班再谈" };
s.raisedCount = s.raisedCount || {};
const bucket = Math.floor((s.absRounds || 0) / ((this.cfg.PAYROLL || {}).PERIOD_ROUNDS || 28));
const key = e.id + ":" + bucket;
if (this.arrangeUsed(e).raise) return { ok: false, tip: e.name + " 这个月已经加过薪了" };
const add = Math.max(1000, Math.round((e.salary || 0) * 0.1));
if (s.funding < add) return { ok: false, tip: "经费不足（需要 " + Math.round(add / 10000) + " 万）" };
s.funding -= add;
s.raisedCount[key] = true;
const boost = this.increaseSalary(e, add);
this.ensureStatus(e);
const gain = ((c.TEAM_BUILD || {}).RAISE_ENERGY != null) ? (c.TEAM_BUILD || {}).RAISE_ENERGY : 30;
const got = this.addEnergy(e, gain);
return { ok: true, boost, tip: e.name + " 加薪 +" + add.toLocaleString("zh-CN") + " 元/月：体力 +" + Math.round(got)
+ (boost.active ? "；接下来 " + boost.weeksLeft + " 周产出 +" + Math.round((boost.mul - 1) * 100) + "%" : "") };
},
statName(k) {
return ({ code: "代码潜力", algo: "算法潜力", text: "文字潜力", engineering: "工程潜力",
safety: "安全性", stability: "稳定性" })[k] || k;
},
activeEngineerCount(s) {
return ((s || this.state).engineers || []).filter((e) => e && !e.resigned).length;
},
fireMinKeep() {
const value = Number((this.cfg.FIRE || {}).MIN_KEEP);
return Number.isFinite(value) ? Math.max(1, value) : 1;
},
canFireEngineer(s) { return this.activeEngineerCount(s) > this.fireMinKeep(); },
clearLonePoachRisk(s) {
s = s || this.state;
if (this.activeEngineerCount(s) > 1 || !s.v35) return;
const st = s.v35;
if (!st.poachRisk && st.poachWho == null && st.riskWho == null) return;
st.riskWho = null;
st.poachRisk = false;
st.poachWho = null;
},
isPoachEvent(ev) {
if (!ev) return false;
const key = ev.key || this.evKeyOf(ev.no != null ? ev.no : ev.id);
if (key === "V35_POACH" || key === "V35_20_HEADHUNT_STORM") return true;
if (ev.cond && ev.cond.poach_risk != null) return true;
const hasRisk = (value) => value && typeof value === "object"
&& (Number(value.poach_risk) > 0 || Object.values(value).some(hasRisk));
return (ev.options || []).some((opt) => hasRisk(opt.effects));
},
poachEventBlocked(ev, s) {
return this.activeEngineerCount(s) <= 1 && this.isPoachEvent(ev);
},
fire(engId) {
const c = this.cfg, s = this.state;
const f = c.FIRE || {};
const e = s.engineers.find((x) => x.id === engId);
if (!e) return { ok: false, reason: "no_eng" };
if (e.resigned) return { ok: false, reason: "resigned" };
if (!this.canFireEngineer(s)) return { ok: false, reason: "min_keep" };
this.freeSeat(engId);
const mul = f.SEVERANCE_MUL != null ? f.SEVERANCE_MUL : 2;
const severance = Math.round((e.salary || 0) * mul);
s.funding -= severance;
e.resigned = true;
e.resignReason = "fired";
this.clearLonePoachRisk(s);
s.flags = s.flags || {};
s.flags.fired = true;
return { ok: true, name: e.name, severance };
},
actionById(id) {
return (this.cfg.ACTIONS || []).find((a) => a.id === id) || null;
},
actionState(a) {
const s = this.state;
if (!a) return { ok: false, reason: "no_action", tip: "卡片不存在" };
if (a.enabled === false) return { ok: false, reason: "disabled", tip: "暂未开放" };
if ((s.ap || 0) < (a.ap || 1)) return { ok: false, reason: "no_ap", tip: "行动点不足" };
if (a.cost > 0 && s.funding < a.cost) return { ok: false, reason: "no_fund", tip: "经费不足" };
if (a.minWeek && s.week < a.minWeek) return { ok: false, reason: "locked", tip: `第 ${a.minWeek} 周后解锁` };
if (a.needGpu && !this.gpuAtLeast(a.needGpu)) return { ok: false, reason: "locked", tip: "算力档位不足" };
if (a.cond === "avgEnergyBelow45" && this.avgEnergy() >= 45) return { ok: false, reason: "locked", tip: "平均体力 ≥ 45 时不可用" };
if (a.target === "one" && !s.engineers.some((e) => !e.resigned)) {
return { ok: false, reason: "no_eng", tip: "没有在职工程师" };
}
return { ok: true };
},
gpuAtLeast(tierId) {
const order = this.cfg.GPU_TIER_ORDER || [];
const cur = this.state.gpuTier;
const ci = order.indexOf(cur), ti = order.indexOf(tierId);
return ci >= 0 && ti >= 0 && ci >= ti;
},
avgEnergy() {
const act = this.state.engineers.filter((e) => !e.resigned);
if (!act.length) return 0;
act.forEach((e) => this.ensureStatus(e));
return act.reduce((a, e) => a + (e.energy || 0), 0) / act.length;
},
statLabel(k) {
const names = (this.cfg.EMBODIED || {}).AXIS_NAMES || {};
if (typeof names[k] === "string" && names[k].trim()) return names[k].trim();
const ax = ((this.cfg.V35 || {}).AXES || {}).DEF || {};
if (ax[k] && ax[k].name) return ax[k].name;
return { code: "代码", text: "文字", safety: "安全", stability: "稳定", codeText: "代码&文字", safetyStability: "安全&稳定" }[k] || k;
},
dimBarClass(k) { return { code: "code", text: "text", safety: "safe", stability: "stable" }[k] || ""; },
dimBarStyle(k) {
const ax = ((this.cfg.V35 || {}).AXES || {}).DEF || {};
return (ax[k] && ax[k].color) ? ("background:" + ax[k].color) : "";
},
effectsText(eff) {
const out = [];
for (const k of this.dimsOf()) {
if (eff[k]) out.push(`${this.statLabel(k)} ${eff[k] > 0 ? "+" : ""}${Math.round(eff[k])}`);
}
if (eff.brand) out.push(`品牌 ${eff.brand > 0 ? "+" : ""}${Math.round(eff.brand)}`);
return out.join("、");
},
statsText(st, all) {
const names = { energy: "体力" };
const out = [];
for (const k of ["energy"]) {
if (st[k]) out.push(`${names[k]} ${st[k] > 0 ? "+" : ""}${Math.round(st[k])}`);
}
if (!out.length) return "";
return (all ? "全员 " : "") + out.join("、");
},
useAction(actionId, targetId) {
const c = this.cfg, s = this.state;
const a = this.actionById(actionId);
if (!a) return { ok: false, reason: "no_action", tip: "卡片不存在" };
const stt = this.actionState(a);
if (!stt.ok) return stt;
let target = null;
if (a.target === "one") {
target = s.engineers.find((e) => e.id === targetId);
if (!target) return { ok: false, reason: "need_target", tip: "请先选择工程师" };
if (target.resigned) return { ok: false, reason: "resigned", tip: "该工程师已离职" };
this.ensureStatus(target);
if (a.oncePerRound && (s.actionLog || []).some((x) => x.id === a.id && x.targetId === targetId)) {
return { ok: false, reason: "once", tip: "本双周已对该人使用过" };
}
}
let cost = a.cost || 0;
if (a.costOf === "salary3" && target) cost = (target.salary || 0) * 3;
if (a.costOf === "halfSalary" && target) cost = (target.salary || 0) * 6;
if (cost > 0) {
if (s.funding < cost) return { ok: false, reason: "no_fund", tip: "经费不足" };
s.funding -= cost;
}
const parts = [];
if (a.via === "fire") {
const r = this.fire(targetId);
if (!r.ok) {
if (cost > 0) s.funding += cost;
return { ok: false, reason: r.reason,
tip: r.reason === "min_keep" ? "不能辞退最后一名工程师" : "无法辞退" };
}
parts.push(`已辞退${r.name}，赔付 ${Math.round(r.severance / 10000)}万`);
} else {
let eff = a.effects;
if (a.bonusIf) {
const w = a.bonusIf;
const key = w.stat || (w.when === "stabilityBelow" ? "stability" : w.when === "safetyBelow" ? "safety" : null);
if (key && s[key] < (w.val != null ? w.val : 50)) eff = w.effects;
}
if (eff) {
this.applyEffects(eff, s);
const t = this.effectsText(eff);
if (t) parts.push(t);
}
if (a.randomStat) {
const keys = this.baseDims();
const k = keys[Math.floor(Math.random() * keys.length)];
const cap = this.statCap();
s[k] = Math.min(this.statLimit(k, cap), Math.max(0, s[k] + a.randomStat));
parts.push(`${this.statLabel(k)} +${a.randomStat}`);
}
if (a.paramUp) {
const order = c.TARGET_PARAMS || [];
const ci = order.indexOf(s.paramTarget);
const ni = Math.min(order.length - 1, ci + (a.paramUp || 1));
const maxP = (c.GPU_TIERS[s.gpuTier] || {}).maxParam;
if (ci >= 0 && ni > ci && order[ni] <= (maxP || 0)) {
s.paramTarget = order[ni];
parts.push(`目标参数 → ${order[ni]}B`);
} else {
parts.push("参数已到算力上限");
}
}
if (a.stats && target) {
for (const k of ["energy"]) {
if (a.stats[k]) target[k] = this.clampNum(target[k] + a.stats[k], 0, 100);
}
const t = this.statsText(a.stats);
if (t) parts.push(t);
}
if (a.allStats) {
for (const e of s.engineers) {
if (e.resigned) continue;
this.ensureStatus(e);
for (const k of ["energy"]) {
if (a.allStats[k]) e[k] = this.clampNum(e[k] + a.allStats[k], 0, 100);
}
}
const t = this.statsText(a.allStats, true);
if (t) parts.push(t);
}
if (a.othersStats && target) {
for (const e of s.engineers) {
if (e.resigned || e.id === target.id) continue;
this.ensureStatus(e);
for (const k of ["energy"]) {
if (a.othersStats[k]) e[k] = this.clampNum(e[k] + a.othersStats[k], 0, 100);
}
}
parts.push("其余人体力 " + (a.othersStats.energy > 0 ? "+" : "") + a.othersStats.energy);
}
}
if (a.effBoost) {
s.eff_boost = (s.eff_boost || 0) + a.effBoost;
parts.push(a.effBoost > 0 ? `本轮成长 +${Math.round(a.effBoost * 100)}%` : `本轮成长 ${Math.round(a.effBoost * 100)}%`);
}
s.ap = (s.ap || 0) - (a.ap || 1);
s.actionLog = s.actionLog || [];
s.actionLog.push({ id: a.id, name: a.name, targetId: targetId || null, targetName: target ? target.name : null });
return { ok: true, name: a.name, icon: a.icon, cost,
text: parts.filter(Boolean).join("、") };
},
dimsOf(s) { return window.V35.dimsOf(s || this.state); },
v35AxisIds(s) { return window.V35.activeAxes(s || this.state); },
axisDef(id, ver) {
const source = (((this.cfg.V35 || {}).AXES || {}).DEF || {})[id] || {};
const d = source.name ? Object.assign({}, source, { name: this.statLabel(id) }) : source;
if (!d.source) return d;
if (!ver) return d;
const _ap = window.V35.axisPass(ver, id);
const _sc = window.V35.lineScale ? window.V35.lineScale(ver, (this.state || {}).paramTarget) : 1;
return Object.assign({}, d, {
capAt: window.V35.axisCap(ver, id, (this.state || {}).paramTarget),
passAt: typeof _ap === "number" ? Math.round(_ap * _sc) : _ap,
});
},
baseDims() { return window.V35.DIM_ORDER; },
newDims(v) { return window.V35.dimObj(v); },
newBaseDims(v) { return window.V35.dimObj(v, window.V35.DIM_ORDER); },
ENG_STAT_KEYS: ["code", "algo", "text"],
engStatKeys(e) {return e&&(e.type==="embodied"||this.primaryTraitType(e)==="embodied")?["code","algo","engineering"]:this.ENG_STAT_KEYS.slice();},
healEngineeringTalent(e) {
if(!e||!this.engStatKeys(e).includes("engineering"))return e;
e.stats=e.stats||{};
if(e.stats.engineering==null){const old=Number(e.stats.text);e.stats.engineering=Number.isFinite(old)?old:70;}
e.stats.engineering=Math.max(0,Math.min(100,Math.round(Number(e.stats.engineering)||0)));
delete e.stats.text;
return e;
},
statCap() {
const c = this.cfg, s = this.state;
const base = (c.CAP_BY_VER || {})[s.ver || "V1"] || 60;
const mul = (c.PARAM_CAP_MUL || {})[s.paramTarget] || 1;
const n = Math.round(base * mul);
const cap = this.newDims(n);
for (const id of (window.V35.activeAxes(s) || [])) {
const v = window.V35.axisCap(s.ver || "V1", id, s.paramTarget);
if (v != null) cap[id] = v;
}
return cap;
},
statLimit(key, caps, stats) {
return window.V35.statLimit(this.state, key, caps || this.statCap(), stats || this.state);
},
paperEffects() {
const c = this.cfg, s = this.state;
const out = { extraRoll: {}, dimBonus: {}, roleEnergy: {}, axisAmp: {}, axisRate: {}, focusAdd: 0 };
const pool = (c.PAPER || {}).POOL || [];
for (const raw of (s.papersOwned || [])) {
const no = this.paperNoOf(raw);
if (no == null) continue;
const p = pool.find((x) => x.no === no);
if (!p || !p.effect) continue;
const e = p.effect;
switch (e.kind) {
case "extra_roll": {
const k = e.scope || "all";
out.extraRoll[k] = (out.extraRoll[k] || 0) + (e.prob || 0);
break;
}
case "dim_bonus":
if (e.dim) out.dimBonus[e.dim] = (out.dimBonus[e.dim] || 0) + (e.add || 0);
break;
case "role_energy": {
const r = e.role || "pre";
out.roleEnergy[r] = (out.roleEnergy[r] || 1) * (e.mul != null ? e.mul : 1);
break;
}
case "axis_amp":
if (e.axis) out.axisAmp[e.axis] = (out.axisAmp[e.axis] || 1) * (e.mul != null ? e.mul : 1);
break;
case "axis_rate":
if (e.axis) out.axisRate[e.axis] = (out.axisRate[e.axis] || 0) + (e.add || 0);
break;
case "focus_mul":
out.focusAdd += (e.add || 0);
break;
default:
break;
}
if (e.axis && e.axisProb) out.axisRate[e.axis] = (out.axisRate[e.axis] || 0) + e.axisProb;
}
return out;
},
paperNoOf(v) {
if (typeof v === "number") return v;
if (typeof v === "string" && /^\s*\d+\s*$/.test(v)) return +v.trim();
const map = (this.cfg.PAPER || {}).LEGACY_NO || {};
if (v != null && map[v] != null) return map[v];
const p = ((this.cfg.PAPER || {}).POOL || []).find((x) => x.key === v);
return p ? p.no : null;
},
paperOf(v) {
const no = this.paperNoOf(v);
if (no == null) return null;
return ((this.cfg.PAPER || {}).POOL || []).find((x) => x.no === no) || null;
},
hasPaper(v) {
const no = this.paperNoOf(v);
if (no == null) return false;
return (this.state.papersOwned || []).some((x) => this.paperNoOf(x) === no);
},
evList() {
const c = this.cfg;
const out = (c.EVENTS || []).slice();
if (c.RECRUIT_WAIT_EVENT) out.push(c.RECRUIT_WAIT_EVENT);
return out;
},
evNoOf(v) {
if (typeof v === "number") return v;
const map = this.cfg.EVENTS_LEGACY_NO || {};
if (v != null && map[v] != null) return map[v];
const e = this.evList().find((x) => x.key === v);
return e ? e.no : null;
},
evKeyOf(v) {
if (typeof v !== "number") return v;
const e = this.evList().find((x) => x.no === v);
return e ? e.key : null;
},
evByNo(v) {
const no = this.evNoOf(v);
return no == null ? null : (this.evList().find((e) => e.no === no) || null);
},
evByKey(k) { return this.evList().find((e) => e.key === k) || null; },
eventEligibleForStage(ev, state) {
if (!ev || ev.enabled === false) return false;
const s = state || this.state, order = this.cfg.VER_ORDER || [], ver = s.ver || "V1";
if (Array.isArray(ev.stages) && ev.stages.length && !ev.stages.includes(ver)) return false;
if (ev.minVer && order.indexOf(ev.minVer) > order.indexOf(ver)) return false;
const late = this.embodiedAvailable(s);
if (!late) return ev.era !== "embodied";
if (ev.special || ev.type === "recruit_wait" || ev.key === "E101") return true;
if (ev.era !== "embodied") return false;
return !ev.requiresBody || !!(s.embodiedEra && s.embodiedEra.bodyAwakened && s.embodiedEra.podExitSeen);
},
retireLegacyMinigame(state) {
const s = state || this.state;
if (!this.embodiedAvailable(s)) return false;
const legacy = kind => ["sft", "rm"].includes(String(kind || "").toLowerCase());
let cleared = false;
if (legacy(s.pendingMinigame)) { s.pendingMinigame = null; cleared = true; }
if (s.minigame && legacy(s.minigame.kind)) {
const wasPaused = s._mgWasPaused;
s.minigame = null; s._mgWasPaused = null; cleared = true;
if (s.officeModal === "minigame") s.officeModal = null;
if (window.OfficePause) OfficePause.releaseSource(this, "inspection");
else s.officePaused = !!wasPaused;
}
return cleared;
},
healStageEvents() {
const s = this.state;
const allowed = p => p && this.eventEligibleForStage(this.evByNo(p.no != null ? p.no : p.id), s);
if (s.pendingEvent && !allowed(s.pendingEvent)) s.pendingEvent = null;
if (Array.isArray(s.pending)) s.pending = s.pending.filter(allowed);
this.retireLegacyMinigame(s);
},
paperEffectText(p) {
const c = this.cfg, e = p && p.effect;
if (!e) return "—";
const V = c.V35 || {};
const pct = (x) => Math.round((x || 0) * 100) + "%";
const ROLE = { pre: "预训练", data: "数据", post: "后训练" };
const DIM = { code: "代码", text: "文字", safety: "安全", stability: "稳定",
memory: "记忆", reasoning: "推理", tool: "工具" };
const roleOf = (r) => ROLE[r] || r || "";
const dimOf = (d) => DIM[d] || this.statLabel(d) || d || "";
switch (e.kind) {
case "extra_roll": {
const who = e.scope && e.scope !== "all" ? roleOf(e.scope) + "岗" : "三个岗位";
return who + "每次产出有 " + pct(e.prob) + " 概率再多产一次（永续）";
}
case "dim_bonus":
return "每次产出「" + dimOf(e.dim) + "」额外 +" + (e.add != null ? e.add : 1) + "（永续）";
case "role_energy": {
const m = e.mul != null ? e.mul : 1;
return roleOf(e.role) + "岗体力消耗 " + (m <= 1 ? "−" : "+") +
Math.abs(Math.round((m - 1) * 100)) + "%（永续）";
}
case "axis_amp":
return "「" + dimOf(e.axis) + "」轴单次产出 ×" + (e.mul != null ? e.mul : 1) + "（永续）";
case "axis_rate":
return "「" + dimOf(e.axis) + "」轴触发概率 +" + pct(e.add) + "（永续）";
case "axis_add":
return "「" + dimOf(e.axis) + "」轴每次触发额外 +" + (e.add != null ? e.add : 1) + "（永续）";
case "focus_mul": {
const base = V.FOCUS_MUL != null ? V.FOCUS_MUL : 1.5;
const add = e.add != null ? e.add : 0;
return "攻关加成 +" + add + "（" + base + " → " + Math.round((base + add) * 100) / 100 + "，永续）";
}
case "text_prob": {
const prob = V.PAPER_TEXT_PROB != null ? V.PAPER_TEXT_PROB : (e.prob != null ? e.prob : 0.1);
const add = V.PAPER_TEXT_ADD != null ? V.PAPER_TEXT_ADD : (e.add != null ? e.add : 1);
return "文字能力增长时 " + pct(prob) + " 概率 +" + add + "（永续）";
}
case "data_speed": {
const m = e.mul != null ? e.mul : (V.PAPER_DATA_SPEED_MUL != null ? V.PAPER_DATA_SPEED_MUL : 1.1);
return "数据工程师语料产量 +" + Math.round((m - 1) * 100) + "%（永续）";
}
case "energy":
return "研发体力消耗 −" + Math.abs(Math.round((1 - (e.mul != null ? e.mul : 1)) * 100)) + "%（永续）";
case "prod": {
const m = e.mul != null ? e.mul : 1;
return (e.dim === "all" || !e.dim ? "全能力" : dimOf(e.dim)) + "产出效率 +" +
Math.round((m - 1) * 100) + "%（永续）";
}
default:
return e.mul != null ? "基础训练效率 +" + Math.round((e.mul - 1) * 100) + "%" : "—";
}
},
passLine() {
const c = this.cfg, s = this.state;
if (!this.v35On()) return (c.PASS_BY_VER || {})[s.ver || "V1"] || c.PASS;
const R = c.V35.REVIEW || {};
const per = (R.BY_VER || {})[s.ver || "V1"] || {};
const sc = (window.V35 && window.V35.lineScale) ? window.V35.lineScale(s.ver || "V1", s.paramTarget) : 1;
const scMap = (o) => {
const out = {};
Object.keys(o || {}).forEach((k) => { out[k] = Math.round((o[k] || 0) * sc); });
return out;
};
const m0 = scMap(per.MIN_DIM || R.MIN_DIM || { code: 18, text: 22, safety: 7, stability: 7 });
const g0 = per.GREAT_SCORE != null ? per.GREAT_SCORE
: (R.GREAT_SCORE != null ? R.GREAT_SCORE : 29);
return { minParam: 7, code: m0.code, text: m0.text, safety: m0.safety,
stability: m0.stability, score: Math.round(g0 * sc), axMin: scMap(per.AXIS_MIN || {}) };
},
upgradeTraitsByTalent() {
const c = this.cfg, s = this.state;
const maxLv = (c.STAGE_TRAIT_MAX || {})[s.ver || "V1"] || 5;
const U = c.TRAIT_UPGRADE || {};
const minStat = U.MIN_STAT != null ? U.MIN_STAT : 70;
const ABOOST = U.ACADEMIC_BOOST || [];
const academicBoostOf = (eng) => {
let b = 0;
for (const t of eng.traits || []) {
if (t.type !== "academic") continue;
const v = ABOOST[Math.min(Math.max(0, (t.level || 1) - 1), ABOOST.length - 1)] || 0;
if (v > b) b = v;
}
return b;
};
this.healEngineerRoles();
const upgrades = [];
for (const e of s.engineers) {
if (e.resigned) continue;
const engMaxLv = Math.min(maxLv, this.talentLvCap(e));
const ab = academicBoostOf(e);
const main = this.mainTrait(e);
const ordered = main && (e.traits || []).includes(main)
? [main].concat((e.traits || []).filter((t) => t !== main)) : (e.traits || []);
for (const t of ordered) {
if (t.level >= engMaxLv) continue;
const rule = (U.traits || {})[t.type] || null;
if (!rule) continue;
const keys = rule.stats || [];
if (!keys.length) continue;
let sum = 0;
let ok = true;
for (const k of keys) {
const v = e.stats ? (e.stats[k] || 0) : 0;
if (v < minStat) { ok = false; break; }
sum += v;
}
if (!ok) continue;
const statVal = sum / keys.length;
const divs = (rule.div && rule.div.length) ? rule.div : [900, 1200, 1500, 1800];
const divisor = divs[Math.min(Math.max(0, t.level - 1), divs.length - 1)];
let prob = statVal / divisor;
prob += ab;
if (s.traitProbBoost) prob *= 1.5;
if (Math.random() < prob) {
const from = t.level;
t.level += 1;
upgrades.push({ id: e.id, name: e.name, type: t.type, trait: this.traitName(t.type), from, to: t.level });
}
}
}
s.traitProbBoost = false;
return upgrades;
},
traitUpgradeProb(type, level, statVal, academicBoost) {
const c = this.cfg;
const U = c.TRAIT_UPGRADE || {};
const rule = (U.traits || {})[type];
const divs = (rule && rule.div && rule.div.length) ? rule.div : [900, 1200, 1500, 1800];
const di = Math.min(Math.max(0, (level || 1) - 1), divs.length - 1);
return (statVal || 0) / divs[di] + (academicBoost || 0);
},
academicBoostOf(level) {
const c = this.cfg;
const B = ((c.TRAIT_UPGRADE || {}).ACADEMIC_BOOST) || [];
if (!B.length) return 0;
return B[Math.min(Math.max(0, (level || 1) - 1), B.length - 1)] || 0;
},
traitUpgradeStats(type) {
const c = this.cfg;
const U = c.TRAIT_UPGRADE || {};
const rule = (U.traits || {})[type];
return (rule && rule.stats && rule.stats.length) ? rule.stats.slice() : [];
},
traitUpgradeMinStat() {
const c = this.cfg;
const U = c.TRAIT_UPGRADE || {};
return U.MIN_STAT != null ? U.MIN_STAT : 70;
},
traitName(t) {
const m = (((this.cfg || {}).TRAIT_META || {})[t] || {}).name;
if (m) return m;
return { pretrain: "预训练", post: "后训练", academic: "学术", engineer: "工程", data: "数据", safety: "安全" }[t] || t;
},
pickSparks() {
const c = this.cfg, s = this.state;
const prob = c.SPARK_PROB != null ? c.SPARK_PROB : 0.4;
const max = c.SPARK_MAX != null ? c.SPARK_MAX : 2;
const active = s.engineers.filter((e) => !e.resigned);
const picks = [];
for (const e of active) {
if (picks.length >= max) break;
if (Math.random() < prob) picks.push(e.id);
}
return picks;
},
applySpark(engId) {
const c = this.cfg, s = this.state;
const e = s.engineers.find((x) => x.id === engId && !x.resigned);
if (!e || !s.lastGrowth) return null;
s.sparkUsed = Array.isArray(s.sparkUsed) ? s.sparkUsed : [];
if (s.sparkUsed.includes(engId)) return null;
const bonus = c.SPARK_BONUS != null ? c.SPARK_BONUS : 0.25;
const cap = this.statCap();
const names = { code: "代码", text: "文字", safety: "安全", stability: "稳定" };
const parts = [];
for (const k of this.baseDims()) {
const g = s.lastGrowth[k] || 0;
if (g <= 0) continue;
const add = Math.max(1, Math.round(g * bonus));
s[k] = Math.min(this.statLimit(k, cap), s[k] + add);
s.lastGrowth[k] += add;
parts.push(`${names[k]} +${add}`);
}
s.sparkUsed.push(engId);
if (!parts.length) return { name: e.name, parts: [] };
const line = `💡 ${e.name} 灵感爆发！${parts.join("、")}`;
s.lastReport = (s.lastReport || "") + (s.lastReport ? "\n" : "") + line;
return { name: e.name, parts };
},
matchWhen(when, ctx) {
const s = this.state;
const { week, active, avg } = ctx;
if (when.week && (week < when.week[0] || week > when.week[1])) return false;
const S = (k) => s[k] || 0;
if (when.brand_at_least != null && !(S("brand") >= when.brand_at_least)) return false;
if (when.funding_below != null && !(s.funding < when.funding_below)) return false;
if (when.funding_at_least != null && !(s.funding >= when.funding_at_least)) return false;
if (when.stat_any && !when.stat_any.some(([k, v]) => S(k) >= v)) return false;
if (when.stat_all && !when.stat_all.every(([k, v]) => S(k) >= v)) return false;
if (when.stat_below && !when.stat_below.some(([k, v]) => S(k) < v)) return false;
if (when.avg) {
for (const [k, v] of Object.entries(when.avg)) {
if (k.endsWith("_below")) { if (!(avg(k.slice(0, -6), 70) < v)) return false; }
else if (k.endsWith("_at_least")) { if (!(avg(k.slice(0, -9), 70) >= v)) return false; }
}
}
if (when.someone) {
for (const [k, v] of Object.entries(when.someone)) {
const ok = k.endsWith("_below")
? active.some((e) => e[k.slice(0, -6)] < v)
: active.some((e) => e[k.slice(0, -9)] >= v);
if (!ok) return false;
}
}
if (when.has_trait_any && !active.some((e) => e.traits.some((t) => when.has_trait_any.includes(t.type)))) return false;
if (when.param_over_cap) {
const maxP = (this.cfg.GPU_TIERS[s.gpuTier] || {}).maxParam || 7;
if (!(s.paramTarget > maxP)) return false;
}
if (when.trait_count_at_least) {
const need = when.trait_count_at_least;
const n = active.reduce((a, e) => a + e.traits.filter((t) => t.type === need.type).length, 0);
if (n < need.n) return false;
}
if (when.flag && !(s.flags && s.flags[when.flag])) return false;
if (when.investor && !s.investor) return false;
if (when.after) {
const rec = s.triggered.filter((t) => t.id === when.after.ev).pop();
if (!rec) return false;
if (when.after.choice != null && rec.choice !== when.after.choice) return false;
}
return true;
},
pickEventTarget(ev, active) {
if (!ev.pick || !active.length || this.poachEventBlocked(ev)) return null;
const by = (k, dir) => [...active].sort((a, b) => (a[k] - b[k]) * dir)[0];
if (ev.pick === "risk_who") {
const st = this.state.v35 || {};
const hit = active.find((e) => !e.resigned && e.id === st.riskWho);
if (hit) return hit;
return by("energy", 1);
}
if (ev.pick === "lowest_loyalty") return by("energy", 1);
if (ev.pick === "highest_loyalty") return by("energy", -1);
if (ev.pick === "lowest_morale") return by("energy", 1);
if (ev.pick === "random") return active[Math.floor(Math.random() * active.length)];
return null;
},
triggerEvents() {
const c = this.cfg, s = this.state;
const week = s.week;
const gpuIdx = c.GPU_TIER_ORDER.indexOf(s.gpuTier);
const candidates = [];
const active = s.engineers.filter((e) => !e.resigned);
active.forEach((e) => this.ensureStatus(e));
const avg = (k, def) => {
if (!active.length) return def;
const val = (e) => e[k];
return active.reduce((a, e) => a + (val(e) != null ? val(e) : def), 0) / active.length;
};
const ctx = { week, active, avg };
for (const ev of c.EVENTS) {
if (this.poachEventBlocked(ev, s)) continue;
if (!this.eventEligibleForStage(ev, s)) continue;
if (ev.type === "recruit_wait") continue;
if (ev.minVer && (c.VER_ORDER || []).indexOf(ev.minVer) > (c.VER_ORDER || []).indexOf(s.ver || "V1")) continue;
const rec = s.triggered.filter((t) => t.id === ev.no).pop();
if (rec && !ev.repeat) continue;
if (rec && ev.cooldown != null && week - rec.week < ev.cooldown) continue;
if (ev.when && !this.matchWhen(ev.when, ctx)) continue;
let hit = null;
if (ev.type === "team") {
const cond = ev.cond || {};
let ok = true;
if (cond.energy_below != null && !(avg("energy", 70) < cond.energy_below)) ok = false;
if (cond.energy_above != null && !(avg("energy", 70) > cond.energy_above)) ok = false;
if (ok && Math.random() < (ev.prob || 0.2)) hit = { ev, priority: 2.5 };
} else if (ev.type === "fixed" || ev.type === "critical") {
if (typeof ev.week === "number") {
const hitWeek = ev.weekAtLeast ? (week >= ev.week) : (week === ev.week);
if (hitWeek) hit = { ev, priority: ev.type === "critical" ? 0 : 1 };
}
} else if (ev.type === "news") {
const w = ev.week || [0, c.TOTAL_WEEKS];
if (week < w[0] || week > w[1]) continue;
if (Math.random() < (ev.prob || 0.25)) hit = { ev, priority: 3.5 };
} else if (ev.type === "random") {
const w = ev.week || [0, c.TOTAL_WEEKS];
if (week < w[0] || week > w[1]) continue;
if (ev.trigger) {
if (ev.trigger.gpu_at_least && gpuIdx < c.GPU_TIER_ORDER.indexOf(ev.trigger.gpu_at_least)) continue;
if (ev.trigger.target_param_at_most && s.paramTarget > ev.trigger.target_param_at_most) continue;
}
if (Math.random() < (ev.prob || 0.2)) hit = { ev, priority: 3 };
} else if (ev.type === "reward") {
const t = ev.trigger;
if (t && t.stat && !(s[t.stat] >= t.min)) continue;
hit = { ev, priority: 2 };
}
if (hit) candidates.push(hit);
}
if (!candidates.length) return null;
candidates.sort((a, b) => a.priority - b.priority);
const picked = candidates[0].ev;
const target = this.pickEventTarget(picked, active);
return target ? { ...picked, targetId: target.id, targetName: target.name } : picked;
},
applyEventOption(evId, optIdx) {
const c = this.cfg, s = this.state;
const ev = this.evByNo(evId);
if (!ev) return null;
if (!this.eventEligibleForStage(ev, s)) {
this.healStageEvents();
return { ok: false, retired: true, tip: "这个事件已随阶段退役，不会再触发" };
}
const rescue = this.bailoutInfo(ev);
if (rescue && (s[rescue.usedFlag] || s.bankrupt || s.phase === "over")) return { ok: false, retired: true };
const opt = ev.options[optIdx];
if (!opt) return null;
let eff = opt.effects || {};
this._staffGuardTip = null;
this.clearLonePoachRisk(s);
if (this.poachEventBlocked(ev, s)) {
s.pending = [];
s.pendingEvent = null;
s.officePaused = false;
s._evTarget = null;
s._evVisitor = null;
return { tip: "团队至少需要保留一名工程师，这次挖角已取消" };
}
const salaryCheck = this.eventOptionStatus(opt, evId);
if (!salaryCheck.ok) return { ok: false, tip: salaryCheck.tip };
const _no = this.evNoOf(evId);
const pend = (s.pending || []).find((p) => this.evNoOf(p.no != null ? p.no : p.id) === _no)
|| (s.pendingEvent && this.evNoOf(s.pendingEvent.id) === _no ? s.pendingEvent : null);
s._evTarget = pend && pend.targetId ? pend.targetId : null;
s._evVisitor = (pend && pend.visitorId) || (s.pendingVisitor && s.pendingVisitor.id) || null;
const applied = this.applyEffects(eff, s);
if (this._staffGuardTip) eff = Object.assign({}, eff, { tip: this._staffGuardTip });
this._staffGuardTip = null;
s._evTarget = null;
s._evVisitor = null;
if (applied && applied.ok === false) return applied;
const _isWait = this.evKeyOf(evId) === "E101";
if (!_isWait) s.triggered.push({ id: _no, choice: optIdx, week: s.week });
if (_isWait) {
s.pending = [];
s.pendingEvent = null;
this.genCandidates(s.ver || "V1");
return eff;
}
s.pending = [];
s.pendingEvent = null;
if (s.pendingMinigame && (s.phase === "loop" || s.phase === "office")) {
this.startMinigame(s.pendingMinigame);
return eff;
}
if (!this.v35On() && (s.week >= c.TOTAL_WEEKS)) this.enterReview();
return salaryCheck.active ? Object.assign({}, eff, { tip: "调薪已生效："
+ (salaryCheck.team ? "全员" : "该工程师") + "接下来 " + salaryCheck.weeks
+ " 周产出 +" + salaryCheck.prodPct + "%" }) : eff;
},
applyEffects(eff, s) {
const c = this.cfg;
this.clearLonePoachRisk(s);
const salaryQuote = this.eventEffectsQuote(eff, null, s);
if (!salaryQuote.ok) return { ok: false, tip: salaryQuote.tip };
if (salaryQuote.active) {
if (!salaryQuote.ok) return { ok: false, tip: salaryQuote.tip };
s.funding -= salaryQuote.salaryCost;
salaryQuote.raises.forEach((r) => this.increaseSalary(s.engineers.find((e) => e.id === r.id), r.add));
}
const cap = this.statCap();
for (const k of this.dimsOf(s)) {
if (eff[k]) s[k] = Math.min(this.statLimit(k, cap, s), Math.max(0, s[k] + eff[k]));
}
if (eff.funding) {
if (eff.funding > 0 && this.v35On()) {
this.payoutIncome(eff.funding, { kind: eff.investor ? "invest" : (eff.bailout ? "bailout" : "event") });
} else {
s.funding = Math.max(0, s.funding + eff.funding);
}
}
if (this.v35On() && (eff.corpus_token || eff.corpus_normal || eff.corpus_good || eff.corpus_best)) {
const QM = (c.V35 && c.V35.QUALITY_MULT) || [0.5, 1.0, 1.5];
const q = s.v35.corpus.q || (s.v35.corpus.q = [0, 0, 0]);
let addItems = 0, addTok = 0;
const give = (n, qi) => {
if (!n) return;
const qm = (QM[qi] != null ? QM[qi] : 0.5);
if (n > 0) {
q[qi] = (q[qi] || 0) + n;
addItems += n;
addTok += n * qm;
} else {
const take = Math.min(q[qi] || 0, -n);
if (take > 0) {
q[qi] -= take;
addItems -= take;
addTok -= take * qm;
}
}
};
give(eff.corpus_normal, 0);
give(eff.corpus_good, 1);
give(eff.corpus_best, 2);
if (!addItems && eff.corpus_token) {
const items = eff.corpus_token / (QM[0] || 0.5);
give(items, 0);
}
if (addItems) {
s.v35.corpus.token += addTok;
s.v35.corpus.items += addItems;
s.corpus = Math.round(s.v35.corpus.token * 10) / 10;
}
}
if (eff.brand) this.changeBrand(eff.brand, s);
if (eff.reputation) s.reputation = Math.min(5, Math.max(0, s.reputation + eff.reputation));
if (eff.time_cost) s.week += eff.time_cost;
if (eff.week_mul && this.v35On()) s.v35.weekMulOverride = eff.week_mul;
if (eff.parallel) s.parallel = true;
if (eff.trait_prob_boost) s.traitProbBoost = true;
if (eff.rand && eff.rand.length) this.applyEffects(eff.rand[Math.random() < 0.5 ? 0 : 1], s);
if (eff.if_stability_below != null) {
const sub = s.stability < eff.if_stability_below ? eff.flip : eff.normal;
if (sub) this.applyEffects(sub, s);
}
if (eff.if_stat) {
const okAny = eff.if_stat.any ? eff.if_stat.any.some(([k, v]) => (s[k] || 0) >= v) : true;
const okAll = eff.if_stat.all ? eff.if_stat.all.every(([k, v]) => (s[k] || 0) >= v) : true;
this.applyEffects((okAny && okAll) ? (eff.if_stat.then || {}) : (eff.if_stat.else || {}), s);
}
if (eff.chance) {
const p = (eff.chance.base || 0) + ((s.brand || 0) / 200) * (eff.chance.brandWeight || 0);
this.applyEffects(Math.random() < p ? (eff.chance.success || {}) : (eff.chance.fail || {}), s);
}
if (eff.team_stat) {
if (eff.team_stat.energy) this.addEnergyAll(eff.team_stat.energy);
const rest = Object.assign({}, eff.team_stat);
delete rest.energy;
if (Object.keys(rest).length) {
for (const e of s.engineers) {
if (e.resigned) continue;
this.ensureStatus(e);
this.applyStat(e, rest);
}
}
}
const tgt = () => s._evTarget
? s.engineers.find((e) => e.id === s._evTarget && !e.resigned) : null;
if (eff.target_stat) {
const t = tgt();
if (t) { this.ensureStatus(t); this.applyStat(t, eff.target_stat); }
}
if (eff.target_rest != null) {
const t = tgt();
if (t) {
this.ensureStatus(t);
const gain = typeof eff.target_rest === "number" ? eff.target_rest
: (((c.TEAM_BUILD || {}).REST_ENERGY != null) ? c.TEAM_BUILD.REST_ENERGY : 35);
t.restWeek = s.week || 0;
t.energyPending = (t.energyPending || 0) + gain;
this.syncResting();
}
}
if (eff.target_resign) {
const t = tgt();
if (t && this.activeEngineerCount(s) > 1) {
t.resigned = true;
this.freeSeat(t.id);
this.clearLonePoachRisk(s);
} else if (t) {
this._staffGuardTip = "团队至少需要保留一名工程师，最后一名工程师已留任";
}
}
if (eff.team_rest != null) {
const gain2 = typeof eff.team_rest === "number" ? eff.team_rest
: (((c.TEAM_BUILD || {}).REST_ENERGY != null) ? c.TEAM_BUILD.REST_ENERGY : 35);
(s.engineers || []).forEach((e) => {
if (e.resigned) return;
this.ensureStatus(e);
e.restWeek = s.week || 0;
e.energyPending = (e.energyPending || 0) + gain2;
});
this.syncResting();
}
if (eff.quit_risk != null && Math.random() < eff.quit_risk) {
const riskPool = s.engineers.filter((e) => !e.resigned
&& (e.joinTick == null || s.v35.tick >= e.joinTick));
const w = riskPool[Math.floor(Math.random() * riskPool.length)];
if (w) { s.v35.leaveRisk = true; s.v35.leaveWho = w.id; }
}
if (this.activeEngineerCount(s) > 1 && eff.poach_risk != null && Math.random() < eff.poach_risk) {
const riskPool2 = s.engineers.filter((e) => !e.resigned
&& (e.joinTick == null || s.v35.tick >= e.joinTick));
const w2 = riskPool2[Math.floor(Math.random() * riskPool2.length)];
if (w2) { s.v35.poachRisk = true; s.v35.poachWho = w2.id; }
}
if (eff.randomStat) {
const _dk = this.baseDims(); const k = _dk[Math.floor(Math.random() * _dk.length)];
const cap = this.statCap();
s[k] = Math.min(this.statLimit(k, cap), Math.max(0, (s[k] || 0) + eff.randomStat));
s.lastRandomStat = { dim: k, add: eff.randomStat };
}
if (eff.cand_bonus) s.candBonus = (s.candBonus || 0) + eff.cand_bonus;
if (eff.set_flag) { s.flags = s.flags || {}; s.flags[eff.set_flag] = true; }
if (eff.set_flag_prob && Math.random() < eff.set_flag_prob.prob) {
s.flags = s.flags || {};
s.flags[eff.set_flag_prob.flag] = true;
}
if (eff.investor) s.investor = true;
if (eff.approve_arch) {
const arch = (c.ARCHITECTURES || []).find((x) => x.id === eff.approve_arch);
if (arch && (arch.unlockBy === "approval" || (arch.unlockBy === "embodied" && this.embodiedAvailable()
&& (c.VER_ORDER || []).indexOf(s.ver) >= (c.VER_ORDER || []).indexOf(arch.unlock)))) {
s.approvedArchs = Array.isArray(s.approvedArchs) ? s.approvedArchs : [];
if (!s.approvedArchs.includes(arch.id)) s.approvedArchs.push(arch.id);
s.lastApprovedArch = { id: arch.id, name: arch.name, week: this.absWeek() };
}
}
if (eff.dividend && this.v35On()) {
s.v35.dividend = {
pct: eff.dividend.pct != null ? eff.dividend.pct : 0.1,
times: eff.dividend.times != null ? eff.dividend.times : 3,
left: eff.dividend.times != null ? eff.dividend.times : 3,
paid: 0,
};
}
if (eff.bailout) {
const rescue = this.cfg.BAILOUT;
const usedFlag = typeof eff.bailout === "string" ? eff.bailout : rescue.DEFAULT_USED_FLAG;
s[usedFlag] = true;
s.pendingBailout = null;
s.fiscalDeficit = 0;
s.funding = Math.max(s.funding || 0, Number(eff.bailoutFunding ?? rescue.DEFAULT_FUNDING));
s._bailoutCooldownUntil = this.absWeek() + rescue.COOLDOWN_WEEKS;
this.addFundingIncome(0, { kind: "bailout" });
}
if (eff.game_over) {
s.pendingBailout = null;
s.flags = s.flags || {};
s.flags.bankrupt = true;
s.bankrupt = true;
s.phase = "over";
s.gameOverReason = eff.game_over === true ? "bankrupt" : String(eff.game_over);
}
if (eff.recruit_offer && this.v35On()) {
s.v35.eventOffer = {
tier: eff.recruit_offer.tier || "mid",
dueWeek: this.absWeek() + (eff.recruit_offer.weeks || 3),
};
}
if (eff.recruit_open) this.openRecruit(eff.recruit_open);
if (eff.minigame) s.pendingMinigame = eff.minigame;
},
syncResting() {
const s = this.state, st = s && s.v35;
if (!st) return;
const wk = s.week || 0;
const cnt = { pre: 0, data: 0, post: 0, embodied: 0 };
for (const e of s.engineers || []) {
if (e.resigned) continue;
if (e.joinTick != null && st.tick != null && st.tick < e.joinTick) continue;
if (e.restWeek === wk) {
for (const k of Object.keys(cnt)) {
if (this.productionTraitLevel(e, k) > 0) cnt[k] += 1;
}
}
}
st.restPre = cnt.pre; st.restData = cnt.data; st.restPost = cnt.post; st.restEmbodied = cnt.embodied;
if (st.burst) for (const k of ["pre", "data", "post", "embodied"]) {
if (!this.teamRoleEngs(st, k).length) st.burst[k] = 0;
}
},
restoreRested() {
const s = this.state, st = s && s.v35;
if (!st) return [];
const back = [];
for (const e of s.engineers || []) {
if (e.resigned) continue;
if (e.restWeek == null || (s.week || 0) <= e.restWeek) continue;
const gain = e.energyPending != null ? e.energyPending
: (((this.cfg.TEAM_BUILD || {}).REST_ENERGY != null) ? this.cfg.TEAM_BUILD.REST_ENERGY : 35);
this.addEnergy(e, gain);
e.restWeek = null; e.energyPending = 0;
back.push(e.name);
}
return back;
},
addEnergy(e, delta) {
if (!e) return 0;
this.ensureStatus(e);
const s = this.state;
const clamp = (v) => Math.max(0, Math.min(100, v));
const b = e.energy || 0;
e.energy = clamp(b + delta);
if (this.v35On && this.v35On() && s.v35 && s.v35.energy) {
const key = this.v35RoleOf(e);
if (key && s.v35.energy[key] != null) this.syncEnergySlot(key);
}
return Math.round(e.energy - b);
},
addEnergyRole(role, delta) {
const s = this.state;
if (!role || !s) return 0;
let sum = 0;
for (const e of this.teamRoleEngs(s.v35, role)) sum += this.addEnergy(e, delta);
return sum;
},
addEnergyAll(delta) {
const s = this.state;
if (!s) return 0;
let sum = 0;
for (const e of s.engineers || []) {
if (e.resigned) continue;
sum += this.addEnergy(e, delta);
}
return sum;
},
applyStat(e, d) {
if (d.energy) this.addEnergy(e, d.energy);
},
requestRecruit() {
const c = this.cfg, s = this.state;
if (s.phase !== "recruit") return null;
const pay = this.payRecruitCost();
if (!pay.ok) return { denied: true, tip: pay.tip };
const ev = c.RECRUIT_WAIT_EVENT || this.evByKey("E101");
if (ev && Math.random() < (c.WAIT_RECRUIT_PROB != null ? c.WAIT_RECRUIT_PROB : 0.8)) {
s.pending = [{ ...ev, engineKey: "E" + ev.no }];
return ev;
}
this.genCandidates(s.ver || "V1");
return null;
},
chooseFineTune(idx) {
const c = this.cfg, s = this.state;
const o = c.FINE_TUNE_OPTIONS[idx];
if (!o) return;
s.fineTuneDraft = idx;
},
clearFineTune() { this.state.fineTuneDraft = null; },
enterReview() {
const s = this.state;
if (s.phase === "review" || s.phase === "over" || s.phase === "bonus") return;
s.pendingEvent = null;
const ups = this.upgradeTraitsByTalent();
s.traitUpgrades = ups;
s.phase = "review";
const byVer = this.cfg.TUNE_DRAWS_BY_VER || {};
const draws = byVer[s.ver || "V1"] != null ? byVer[s.ver || "V1"]
: (this.cfg.TUNE_DRAWS != null ? this.cfg.TUNE_DRAWS : 3);
s.tuneDrawsLeft = draws;
s.result = this.evaluate();
if (s.flags && s.flags.t08_option && !this.isPassLike(s.result)) {
this.addEnergyAll(-12);
}
},
pickEvalBank() {
const c = this.cfg, s = this.state;
const P = c.EVAL_BANK_PICK || {};
const ver = s.ver || "V1";
const arch = s.arch || "dense";
const diff = (P.difficultyByVer || {})[ver] || "low";
const byVer = (P.archToBankByVer || {})[ver] || {};
const raw = byVer[arch] != null ? byVer[arch] : (P.archToBank || {})[arch];
let mix = [];
if (typeof raw === "string") mix = [{ bank: raw, w: 1 }];
else if (Array.isArray(raw)) mix = raw.map((b) => ({ bank: b, w: 1 }));
else if (raw && typeof raw === "object") mix = Object.keys(raw).map((b) => ({ bank: b, w: +raw[b] || 0 }));
mix = mix.filter((m) => m.w > 0);
if (!mix.length) mix = [{ bank: P.fallback || "chat", w: 1 }];
const mainBank = mix.slice().sort((a, b) => b.w - a.w)[0].bank;
return {
diff, mix, mainBank,
skin: (c.EVAL_SKIN_BIND || {})[mainBank] || "bubble",
};
},
buildEvalShow() {
const c = this.cfg, s = this.state;
const ES = c.EVAL_SHOW || {};
const w = c.EVAL_WEIGHTS || { code: 0.2, text: 0.45, safety: 0.2, stability: 0.15 };
const cap = this.statCap();
const pass = this.passLine();
const pick = this.pickEvalBank();
const shuffle = (arr) => {
for (let i = arr.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[arr[i], arr[j]] = [arr[j], arr[i]];
}
return arr;
};
let pools = pick.mix.map((m) => ({
bank: m.bank, w: m.w,
items: ((((c.EVAL_BANK || {})[m.bank] || {})[pick.diff]) || []).slice(),
})).filter((p) => p.items.length);
let usedFlat = false;
if (!pools.length && (c.EVAL_QA || []).length) {
pools = [{ bank: "chat", w: 1, items: (c.EVAL_QA || []).slice() }];
usedFlat = true;
}
if (!pools.length) {
s.evalShow = { qs: [], total: 0, per: 0, score: 0, hits: 0, skin: pick.skin, bank: pick.mainBank, difficulty: pick.diff };
return s.evalShow;
}
pools.forEach((p) => shuffle(p.items));
const want = Math.max(1, ES.QA_COUNT || 10);
const totalW = pools.reduce((a, p) => a + p.w, 0);
const quota = pools.map((p) => Math.min(p.items.length, Math.max(1, Math.round(want * p.w / totalW))));
let sum = quota.reduce((a, b) => a + b, 0);
let guard = 0;
while (sum > want && guard++ < 100) {
let k = 0;
for (let i = 1; i < quota.length; i++) if (quota[i] > quota[k]) k = i;
if (quota[k] <= 1) break;
quota[k]--; sum--;
}
guard = 0;
while (sum < want && guard++ < 100) {
let k = -1;
for (let i = 0; i < pools.length; i++) if (quota[i] < pools[i].items.length) { k = i; break; }
if (k < 0) break;
quota[k]++; sum++;
}
let picked = [];
pools.forEach((p, i) => {
for (let k = 0; k < quota[i]; k++) picked.push({ ...p.items[k], bank: p.bank });
});
shuffle(picked);
const minP = ES.MIN_P != null ? ES.MIN_P : 0.05;
const maxP = ES.MAX_P != null ? ES.MAX_P : 0.98;
const qs = [];
for (const src of picked) {
const cur = s[src.dim] || 0;
const line = Math.max(1, pass[src.dim] || (pass.axMin || {})[src.dim] || 1);
const ratio = Math.min(1.35, cur / line);
const jitter = (Math.random() * 2 - 1) * (ES.JITTER != null ? ES.JITTER : 0.12);
const p = Math.max(minP, Math.min(maxP,
(ES.BASE != null ? ES.BASE : 0.28) + (ES.SPAN != null ? ES.SPAN : 0.55) * ratio + jitter));
qs.push({
q: src.q, dim: src.dim, good: src.good, bad: src.bad,
bank: src.bank, tag: src.tag || null,
material: src.material || null,
cases: src.cases || null,
bug: src.bug || null,
ok: Math.random() < p, p: Math.round(p * 100) / 100,
});
}
const full = cap.code * w.code + cap.text * w.text + cap.safety * w.safety + cap.stability * w.stability;
const per = qs.length ? full / qs.length : 0;
const score = qs.reduce((a, x) => a + (x.ok ? per : 0), 0);
s.evalShow = {
qs, total: Math.round(full * 10) / 10, per: Math.round(per * 10) / 10,
score: Math.round(score * 10) / 10, hits: qs.filter((x) => x.ok).length,
bank: pick.mainBank, difficulty: pick.diff, skin: usedFlat ? "bubble" : pick.skin,
mix: pick.mix.map((m) => m.bank),
};
return s.evalShow;
},
reviewScoreCeiling(ver) {
const c = this.cfg || window.GameCfg, V = window.V35;
if (!c || !V || !(c.VER_ORDER || []).includes(ver)) return null;
const order = c.VER_ORDER, vi = order.indexOf(ver);
const quality = ((c.V35 || {}).QUALITY_MULT || []).filter(Number.isFinite);
if (!quality.length) return null;
const lo = Math.min(...quality), hi = Math.max(...quality);
const candidates = [lo, hi].concat(((c.V35 || {}).Q_TIERS || [])
.map(row => Number(row[0])).filter(q => Number.isFinite(q) && q >= lo && q <= hi));
const q = candidates.reduce((best, x) => V.qualityBonus({ver, corpus:{token:x, items:1}})
> V.qualityBonus({ver, corpus:{token:best, items:1}}) ? x : best, lo);
const tiers = (c.GPU_TIERS_BY_VER || {})[ver] || c.GPU_TIER_ORDER || [];
const gpuMax = Math.max(0, ...tiers.map(id => Number((c.GPU_TIERS[id] || {}).maxParam) || 0));
let ceiling = null;
for (const a of c.ARCHITECTURES || []) {
if (order.indexOf(a.unlock || "V1") > vi) continue;
for (const param of c.TARGET_PARAMS || []) {
if (param > gpuMax || (a.maxParam > 0 && param > a.maxParam) || (a.minParam > 0 && param < a.minParam)) continue;
const state = {ver, arch:a.id, paramTarget:param, corpus:{token:q, items:1}};
const base = Math.round(((c.CAP_BY_VER || {})[ver] || 60) * ((c.PARAM_CAP_MUL || {})[param] || 1));
const cap = V.dimObj(base);
for (const id of V.activeAxes(state)) {
const value = V.axisCap(ver, id, param);
if (value != null) cap[id] = value;
}
state.stats = V.clampStats(state, cap, cap);
const score = Math.round(V.review(state).total * 10) / 10;
if (Number.isFinite(score)) ceiling = Math.max(ceiling == null ? 0 : ceiling, score);
}
}
return ceiling;
},
refreshReviewResult() {
const s = this.state, old = s && s.result;
if (!old || old.settled || !this.v35On()) return old;
Object.assign(old, this.evaluate());
delete old.missionFail;
delete old.retry;
return old;
},
reviewFailurePolicy() {const p=(this.cfg.EMBODIED||{}).REVIEW_FAILURE;return p&&p.STAGES.includes(this.state.ver)?p:null;},
qualifyReview(result,stats) {
const p=this.reviewFailurePolicy();if(!p)return result;
const s=this.state,groups=window.V35.mergedGroups(s),paired=new Set(groups.flatMap(g=>g.sources)),items=[];
const need=result.pass,format=(dim,value,min)=>String(p.UI.DIM).replace('{dim}',this.statLabel(dim)).replace('{value}',Math.round(value)).replace('{need}',Math.ceil(min));
for(const group of groups){const value=group.sources.reduce((n,k)=>n+(stats[k]||0),0),min=group.sources.reduce((n,k)=>n+(need[k]||0),0);if(value<min)items.push(format(group.key,value,min));}
for(const k of this.baseDims().filter(k=>!paired.has(k))){if((stats[k]||0)<(need[k]||0))items.push(format(k,stats[k]||0,need[k]));}
const required={...(need.axMin||{})};for(const[k,v]of Object.entries(this.missionOf(s.ver).axisMin||{}))required[k]=Math.max(required[k]||0,v);
for(const[k,min]of Object.entries(required))if((stats[k]||0)<min)items.push(format(k,stats[k]||0,min));
const direction=this.missionJudge(s,s.arch,s.paramTarget);result.directionMismatch=!direction.hit;
if(!direction.hit)items.unshift(p.UI.DIRECTION);
result.qualifyingScore=result.score;result.qualificationFailed=items.length>0;result.failureItems=items;
if(items.length){result.baseVerdict=result.verdict;result.verdict='fail';result.score=Math.round(Math.min(result.score,result.excellentLine*p.SCORE_RATIO)*10)/10;result.checks.score=false;result.reasons=[...items,p.UI.SCORE];}
return result;
},
evaluate() {
const c = this.cfg, s = this.state;
const w = c.EVAL_WEIGHTS;
const pass = this.passLine();
const cap = this.statCap();
if (this.v35On()) {
const V = window.V35;
const stats = V.clampStats(s, s, cap);
const r = V.review({ stats, corpus: s.v35.corpus, ver: s.ver,
arch: s.arch, paramTarget: s.paramTarget });
const checks = {
code: stats.code >= pass.code, text: stats.text >= pass.text,
safety: stats.safety >= pass.safety, stability: stats.stability >= pass.stability,
score: r.total >= pass.score,
};
V.mergedGroups(s).forEach(group => {
const ok = group.sources.reduce((n, k) => n + (stats[k] || 0), 0)
>= group.sources.reduce((n, k) => n + (pass[k] || 0), 0);
checks[group.key] = ok;
group.sources.forEach(k => { checks[k] = ok; });
});
(r.axes || []).forEach((k) => {
const nd = (pass.axMin || {})[k];
if (nd != null) checks[k] = (stats[k] || 0) >= nd;
});
const topRatio = c.TOP_RATIO != null ? c.TOP_RATIO : 1.12;
const topLine = Math.round(pass.score * topRatio * 10) / 10;
let verdict = r.excellent ? "excellent" : "pass";
if (r.excellent && r.balanced && r.total >= topLine) verdict = "top";
return this.qualifyReview({
score: Math.round(r.total * 10) / 10, rawScore: Math.round(r.raw * 10) / 10,
qBonus: r.bonus, qbar: r.qbar, balanced: r.balanced,
checks, reasons: [],
verdict,
param: s.paramTarget, pass, cap,
excellentLine: pass.score,
topLine,
},stats);
}
let score = s.code * w.code + s.text * w.text + s.safety * w.safety + s.stability * w.stability;
const reasons = [];
if (s.safety < pass.safety) {
score *= c.EVAL_SAFETY_PENALTY_MUL;
reasons.push(`安全性 ${s.safety} < 达标线 ${pass.safety}，总评 ×${c.EVAL_SAFETY_PENALTY_MUL}`);
}
if (s.stability < pass.stability) {
score *= c.EVAL_STABILITY_PENALTY_MUL;
reasons.push(`稳定性 ${s.stability} < 达标线 ${pass.stability}，总评 ×${c.EVAL_STABILITY_PENALTY_MUL}`);
}
score = Math.round(score * 10) / 10;
const checks = {
param: s.paramTarget >= pass.minParam,
code: s.code >= pass.code,
text: s.text >= pass.text,
safety: s.safety >= pass.safety,
stability: s.stability >= pass.stability,
score: score >= pass.score,
};
const full = cap.code * w.code + cap.text * w.text + cap.safety * w.safety + cap.stability * w.stability;
const r10 = (n) => Math.round(n * 10) / 10;
const excellentLine = r10(full * (c.EXCELLENT_RATIO != null ? c.EXCELLENT_RATIO : 0.8));
const vetoLine = Math.round(pass.safety * (c.EVAL_VETO_RATIO != null ? c.EVAL_VETO_RATIO : 0.6));
let verdict = "pass";
const vetoOn = (c.VETO_BY_VER || {})[s.ver || "V1"] !== false;
if (vetoOn && s.safety < vetoLine) {
verdict = "veto";
reasons.push(`安全性 ${s.safety} < ${vetoLine}，强制内部否决`);
} else if (Object.values(checks).every(Boolean)) {
verdict = score >= excellentLine ? "excellent" : "pass";
} else {
verdict = "fail";
}
return { score, checks, reasons, verdict, param: s.paramTarget, pass, cap, excellentLine, vetoLine };
},
finish() {
const c = this.cfg, s = this.state;
const r = s.result;
if (!r) return;
if (r.settled) return r;
this.refreshReviewResult();
this.changeBrand(0);
const brandBefore = s.brand, brandStars = this.brandStarsCount(brandBefore);
let brandBase = 0;
const vi = (c.VER_ORDER || ["V1"]).indexOf(s.ver || "V1");
const items = [];
let brandAdd = 0;
if(this.reviewFailurePolicy()&&s.mission?.ver===s.ver)s.mission.hit=this.missionJudge(s,s.arch,s.paramTarget).hit;
const mFail = r.qualificationFailed || this.isPassLike(r) && this.isMissionFail();
if (mFail) {
const mp = this.calcMissionPay(r);
r.mission = { hit: false, delta: mp.delta, q: mp.q, ratio: mp.ratio, main: mp.main, pay: mp.pay };
r.missionFail = true;
brandBase = mp.pay;
if (this.isExcLike(r)) {
brandAdd += this.changeBrand(c.EXCELLENT_BRAND);
if (r.verdict === "top") brandAdd += this.changeBrand(c.TOP_BRAND);
}
const MUI = ((c.MISSIONS || {}).UI) || {};
if (mp.pay > 0) {
this.payoutIncome(mp.pay, { kind: "mission" });
items.push({ icon: "\u{1F4C9}", label: r.qualificationFailed ? this.reviewFailurePolicy().UI.ITEM : String(MUI.ITEM_MISS || "较本版本已结算最高分 +{d} 分 · 增量经费").replace("{d}", mp.delta), value: mp.pay });
} else {
items.push({ icon: "\u{1F4C9}", label: r.qualificationFailed ? this.reviewFailurePolicy().UI.ZERO : MUI.ITEM_NONE || "未超过本版本已结算最高分 · 无增量经费", value: 0 });
}
} else if (this.isPassLike(r)) {
const base = (c.PASS_PRIZE_BY_VER || {})[s.ver || "V1"] != null
? c.PASS_PRIZE_BY_VER[s.ver || "V1"] : 300000 * (vi + 1);
brandBase = base;
s.brandMilestones = s.brandMilestones || {};
if (!s.brandMilestones[s.ver]) {
brandAdd += this.changeBrand((c.BRAND_PASS_BY_VER || {})[s.ver] || 0);
s.brandMilestones[s.ver] = true;
}
this.payoutIncome(base, { kind: "pass" });
items.push({ icon: "🏦", label: "通过内部评审 · 阶段经费追加", value: base });
if (this.isExcLike(r)) {
const ecb = c.EXCELLENT_BRAND != null ? c.EXCELLENT_BRAND : 0;
const actualExcellentBrand = this.changeBrand(ecb);
this.payoutIncome(c.EXCELLENT_FUNDING, { kind: "excellent" });
brandAdd += actualExcellentBrand;
items.push({ icon: "🌟", label: "优秀评级 · 额外奖励", value: c.EXCELLENT_FUNDING });
if (r.verdict === "top") {
const tcb = c.TOP_BRAND != null ? c.TOP_BRAND : 0;
const actualTopBrand = this.changeBrand(tcb);
this.payoutIncome(c.TOP_FUNDING, { kind: "top" });
brandAdd += actualTopBrand;
items.push({ icon: "👑", label: "顶尖评级 · 追加奖励", value: c.TOP_FUNDING });
}
}
} else if (r.verdict === "veto") {
brandAdd += this.changeBrand(c.VETO_BRAND);
}
let miniBonus = 0, miniCount = 0;
for (const m of r.qualificationFailed ? [] : s.miniModels || []) {
const mb = c.MINI_MODEL_BONUS != null ? c.MINI_MODEL_BONUS : 100000;
if (m.score >= 80) { miniBonus += mb; miniCount += 1; brandAdd += this.changeBrand(2); }
}
if (miniBonus) {
this.payoutIncome(miniBonus, { kind: "mini" });
items.push({ icon: "🎰", label: `小模型收益（${miniCount} 个优品）`, value: miniBonus });
}
const brandRate = brandStars * Math.max(0, Math.min(1, Number(c.BRAND_INCOME_PER_STAR ?? 0.03)));
const brandGross = !r.qualificationFailed && this.isPassLike(r) ? Math.floor(Math.max(0, brandBase) * brandRate + 1e-8) : 0;
const brandPay = brandGross > 0 ? this.payoutIncome(brandGross, { kind: "brand" }) : { dividend: 0, net: 0 };
const brandBenefit = { stars: brandStars, rate: brandRate, base: Math.round(brandBase), gross: brandGross,
dividend: brandPay.dividend, net: brandPay.net, brandBefore, brandAfter: s.brand };
if (brandGross > 0) items.push({ icon: "★", label: "品牌溢价 · " + brandStars + " 星加成", value: brandGross });
r.brandBenefit = brandBenefit;
const order = c.VER_ORDER || ["V1"];
r.nextVer = this.isPassLike(r) && !r.missionFail && vi < order.length - 1
? order[vi + 1] : null;
r.retry = !!(r.missionFail && (this.isPassLike(r) || r.qualificationFailed));
r.finalRepeat = !!(this.isPassLike(r) && !r.missionFail && vi >= order.length - 1);
r.miniBonus = miniBonus;
const mul = (c.USER_GAIN_MUL_BY_VER || {})[s.ver || "V1"];
if (this.isPassLike(r) && mul != null) {
const gained = Math.round(r.score * mul);
s.users = (s.users || 0) + gained;
r.usersGained = gained;
const rnd = (a, b2) => a + Math.random() * (b2 - a);
const isExc = this.isExcLike(r);
const beta = this.isBeta(s.ver);
r.userRating = Math.round((beta
? (isExc ? rnd(3.9, 4.1) : rnd(3.6, 3.9))
: (isExc ? rnd(4.6, 4.8) : rnd(4.5, 4.7))) * 10) / 10;
r.praiseRate = Math.round(beta
? (isExc ? rnd(82, 85) : rnd(78, 83))
: (isExc ? rnd(93, 96) : rnd(92, 94)));
}
const board = (c.RANK_BOARD_BY_VER || {})[s.ver || "V1"] || [];
const myScore = Math.round((r.score || 0) * 10) / 10;
const bodyRanking = this.embodiedAvailable(s);
const rank = bodyRanking ? null : (board.length ? 1 + board.filter((row) => (row.score || 0) > myScore).length : 11);
r.rankPrev = bodyRanking ? null : (s.rank != null ? s.rank : null);
r.rankUp = bodyRanking ? null : (r.rankPrev != null ? Math.max(0, r.rankPrev - rank) : null);
s.rank = rank;
if (this.isPassLike(r) && !r.missionFail && !r.retry && rank != null && rank >= 1 && rank <= 10) {
this.recordLifeMilestone("first_top10", { rank });
if (rank === 1) this.recordLifeMilestone("first_rank1", { rank });
}
r.rankScore = myScore;
r.rankBoardLen = bodyRanking ? null : board.length;
const total = items.reduce((a, x) => a + x.value, 0);
s.bonus = {
items, total, brandAdd, brandBenefit, verdict: r.verdict,
ver: s.ver, score: r.score, nextVer: r.nextVer,
};
r.brandAdd = brandAdd;
r.brandNow = Math.round(s.brand || 0);
s.bonusAct = null;
this.pushModelSnapshot(s, r);
s.incBase = Math.max(s.incBase || 0, Math.round((r.qualifyingScore ?? r.score ?? 0) * 10) / 10);
this.recordCodex(r);
this.recordStageMark(r);
this.recordLifeAchievementResult(r);
this.achvCounters();
if (rank === 1) s.rank1Params[s.paramTarget || 0] = true;
if (rank != null) s.rankLog.push({ ver: s.ver || "V1", rank: rank });
if (s.rankLog.length > 40) s.rankLog.splice(0, s.rankLog.length - 40);
if (r.retry) s.verRetry[s.ver || "V1"] = (s.verRetry[s.ver || "V1"] || 0) + 1;
if (Number(s.funding || 0) <= 0) s.fundingZeroTimes += 1;
this.checkAchievements(r);
s.phase = (items.length && total > 0) ? "bonus" : "over";
r.settled = true;
if (window.ToyCloud) {
try { window.ToyCloud.onReviewSettled(s, r); } catch (e) {}
}
return s.result;
},
isPassLike(r) { const v = r && r.verdict; return v === "pass" || v === "excellent" || v === "top"; },
isExcLike(r) { const v = r && r.verdict; return v === "excellent" || v === "top"; },
isTopV(r) { return !!(r && r.verdict === "top"); },
excFunding() { return (this.cfg.EXCELLENT_FUNDING != null ? this.cfg.EXCELLENT_FUNDING : 500000); },
topFunding() { return (this.cfg.TOP_FUNDING != null ? this.cfg.TOP_FUNDING : 800000); },
missionOf(ver) {
const M = this.cfg.MISSIONS || {};
return (M.BY_VER || {})[(ver != null ? ver : (this.state && this.state.ver)) || "V1"] || {};
},
missionJudge(s, arch, param) {
const st = s || this.state;
const M = this.cfg.MISSIONS || {};
if (M.ENABLED === false) return { hit: true, reason: "off" };
const m = this.missionOf(st.ver);
if (m.arch && arch !== m.arch) return { hit: false, reason: "arch", need: m };
if (m.param && (param || 0) < m.param) return { hit: false, reason: "param", need: m };
return { hit: true, need: m };
},
isMissionFail() {
const s = this.state, M = this.cfg.MISSIONS || {};
if (M.ENABLED === false) return false;
const m = s.mission;
if (!m || m.ver !== s.ver) return false;
if (m.hit === false && !(this.reviewFailurePolicy() && this.missionJudge(s,s.arch,s.paramTarget).hit)) return true;
const amin = (this.missionOf(s.ver) || {}).axisMin || {};
for (const id of Object.keys(amin)) {
if ((s[id] || 0) < amin[id]) return true;
}
return false;
},
missionAxisText(ver) {
const amin = (this.missionOf(ver != null ? ver : (this.state && this.state.ver)) || {}).axisMin || {};
const ids = Object.keys(amin);
if (!ids.length) return "";
return ids.map((id) => this.statLabel(id) + " ≥ " + amin[id]).join("、");
},
reviewIncomeBase(state) {
const s = state || this.state || {};
let base = Number(s.incBase);
if (!Number.isFinite(base) || base < 0) base = 0;
const archives = [s.modelHistory, s.codexLog];
if (s.codex && typeof s.codex === "object" && !Array.isArray(s.codex)) {
for (const entry of Object.values(s.codex)) {
if (entry && typeof entry === "object") archives.push([entry.first, entry.best, entry.last]);
}
}
for (const records of archives) {
if (!Array.isArray(records)) continue;
for (const record of records) {
if (!record || record.ver !== s.ver) continue;
const score = Number(record.qualifyingScore ?? record.score);
if (Number.isFinite(score) && score >= 0) base = Math.max(base, score);
}
}
return base;
},
calcMissionPay(r) {
const c = this.cfg, s = this.state, M = c.MISSIONS || {};
const INC = M.INC || { FLOOR: 0.30, CEIL: 0.70, SLOPE: 0.40 };
const order = c.VER_ORDER || ["V1"];
const vi = Math.max(0, order.indexOf(s.ver || "V1"));
const line = ((c.PASS_BY_VER || {})[s.ver || "V1"] || {}).score || 1;
const pv = vi > 0 ? order[vi - 1] : null;
const pLine = pv ? (((c.PASS_BY_VER || {})[pv] || {}).score || 0) : 0;
const dLine = Math.max(1, line - pLine);
const delta = Math.round(((r.qualifyingScore ?? r.score ?? 0) - (s.incBase || 0)) * 10) / 10;
const q = delta / dLine;
const prize = (c.PASS_PRIZE_BY_VER || {})[s.ver || "V1"] != null
? c.PASS_PRIZE_BY_VER[s.ver || "V1"] : 300000 * (vi + 1);
const main = prize + (this.isExcLike(r) ? (c.EXCELLENT_FUNDING || 0) + (this.isTopV(r) ? (c.TOP_FUNDING || 0) : 0) : 0);
let ratio = 0;
if (delta > 0) ratio = r.qualificationFailed ? INC.FLOOR : Math.min(INC.CEIL, Math.max(INC.FLOOR, (INC.FLOOR || 0) + (INC.SLOPE || 0) * q));
return { delta, q: Math.round(q * 100) / 100, ratio: Math.round(ratio * 100) / 100,
main, pay: Math.round(main * ratio) };
},
missionPreview(arch, param) {
const s = this.state, M = this.cfg.MISSIONS || {};
if (M.ENABLED === false) return { hit: true, name: "", desc: "", tip: "" };
const m = this.missionOf(s.ver);
const j = this.missionJudge(s, arch, param);
const UI = M.UI || {};
return { hit: !!j.hit, reason: j.reason || "", name: m.name || "本阶段任务", desc: m.desc || "",
axisMin: m.axisMin || {}, axisText: this.missionAxisText(s.ver),
tip: j.hit ? (UI.HIT || "") : (UI.MISS || "") };
},
codexKey(arch, param) { return (arch || "dense") + ":" + (param != null ? param : 7); },
codexSnap(r) {
const s = this.state;
return {
name: s.modelName || "", ver: s.ver || "V1", week: s.week || 0,
qualifyingScore: r.qualifyingScore ?? r.score, qualificationFailed: !!r.qualificationFailed,
score: Math.round((r.score || 0) * 10) / 10, verdict: r.verdict || "", missionFail: !!r.missionFail, retry: !!r.retry,
arch: s.arch || "dense", param: s.paramTarget || 0,
code: Math.round(s.code || 0), text: Math.round(s.text || 0),
safety: Math.round(s.safety || 0), stability: Math.round(s.stability || 0),
...(window.V35.activeAxes(s) || []).reduce((o, k) => (o[k] = Math.round(s[k] || 0), o), {}),
brand: Math.round(s.brand || 0), users: Math.round(s.users || 0),
rank: s.rank != null ? s.rank : null,
team: (s.engineers || []).filter((e) => !e.resigned).length,
funding: Math.round(s.funding || 0),
missionHit: s.mission ? s.mission.hit !== false : true,
at: new Date().toISOString(),
};
},
recordCodex(r) {
const s = this.state;
if (!s.codex || typeof s.codex !== "object") s.codex = {};
if (!Array.isArray(s.codexLog)) s.codexLog = [];
const snap = this.codexSnap(r);
const key = this.codexKey(snap.arch, snap.param);
const e = s.codex[key] || (s.codex[key] = { arch: snap.arch, param: snap.param, times: 0, best: null, first: null, last: null });
e.times += 1;
if (!e.first) e.first = snap;
e.last = snap;
if (!e.best || snap.score > e.best.score || snap.score === e.best.score && snap.qualifyingScore > (e.best.qualifyingScore ?? e.best.score)) e.best = snap;
const cap = ((this.cfg.CODEX || {}).LOG_MAX) || 100;
s.codexLog.push(snap);
if (s.codexLog.length > cap) s.codexLog.splice(0, s.codexLog.length - cap);
return e;
},
recordStageMark(r) {
const s = this.state;
if (!s.stageMarks || typeof s.stageMarks !== "object") s.stageMarks = {};
const ver = s.ver || "V1";
if (s.stageMarks[ver]) return s.stageMarks[ver];
if (!this.isPassLike(r)) return null;
s.stageMarks[ver] = this.codexSnap(r);
return s.stageMarks[ver];
},
ACHV_COND_TYPES: {
param_rank1: ["params"],
dim_above: ["dim", "mul"], dim_below: ["dim", "mul"],
dim_ratio_above: ["dim", "mul"], dim_max_ratio_above: ["mul"],
dim_at_cap_all: [], balanced_false: [], axis_only_miss: [],
mission_fail: [], bonus_zero: [], funding_below: ["n"],
funding_zero_times: ["n"], retry_times: ["n"],
verdict_is: ["v"], pass_like: [], game_clear: [], no_retry: [],
rank_le: ["n"], rank_hold: ["n", "stages"],
ver_reach: ["ver"], codex_full: [], codex_count: ["n"],
arch_all: [], arch_count: ["n"], papers_ge: ["n"], paper_all: [],
all_stage_excellent: [],
energy_all_below: ["n"], team_full: [], team_resigned: ["n"],
team_alive_eq: ["n"], burnout_count: ["n"], corpus_gap: ["pct"],
hire_zero: [],
chat_all_seen: [], note_all: [],
life_stage_pass: ["ver"], life_stage_top: ["ver"],
life_body_owned: ["ver"], life_awake: [], life_mentor: [],
life_city_stop: ["id"], life_city_all: [], life_feed_count: ["n"], life_managed: [],
all: ["of"], any: ["of"],
},
lifeAchievementStages() {
return ["V5", "V5.5", "V6", "V6.5"].filter(ver => (this.cfg.VER_ORDER || []).includes(ver));
},
lifeAchievementPassed(record, ver, top) {
return !!(record && record.ver === ver && record.missionFail === false && record.missionHit !== false
&& record.retry !== true && (top ? record.verdict === "top" : ["pass", "excellent", "top"].includes(record.verdict)));
},
recordLifeAchievementResult(r) {
const s = this.state, ver = s && s.ver;
const record = {...r, ver, missionFail:!!(r && r.missionFail)};
if (!r || !this.lifeAchievementStages().includes(ver) || !this.lifeAchievementPassed(record, ver)) return false;
return this.rememberLifeAchievementStage({...record, at:new Date().toISOString()});
},
rememberLifeAchievementStage(record) {
const s = this.state, ver = record && record.ver;
if (!this.lifeAchievementStages().includes(ver) || !this.lifeAchievementPassed(record, ver)) return false;
if (!s.lifeAchievements || typeof s.lifeAchievements !== "object" || Array.isArray(s.lifeAchievements)) s.lifeAchievements = {schema:1, stages:{}};
if (!s.lifeAchievements.stages || typeof s.lifeAchievements.stages !== "object" || Array.isArray(s.lifeAchievements.stages)) s.lifeAchievements.stages = {};
const old = s.lifeAchievements.stages[ver];
if (this.lifeAchievementPassed(old, ver) && (old.verdict === "top" || record.verdict !== "top")) return false;
const fact = {ver, verdict:record.verdict, missionFail:false, retry:false};
if (typeof record.at === "string" && Number.isFinite(Date.parse(record.at))) fact.at = record.at;
s.lifeAchievements.stages[ver] = fact;
return true;
},
lifeAchievementStage(ver, top) {
if (!this.lifeAchievementStages().includes(ver)) return false;
const s = this.state, records = [], mark = (s.stageMarks || {})[ver];
if (mark && typeof mark === "object") records.push({...mark, ver:mark.ver || ver});
records.push(...(Array.isArray(s.modelHistory) ? s.modelHistory : []), ...(Array.isArray(s.codexLog) ? s.codexLog : []));
Object.values(s.codex || {}).forEach(entry => { if (entry && typeof entry === "object") records.push(entry.first, entry.best, entry.last); });
const result = s.result;
if (s.ver === ver && result && result.settled === true) records.push({...result, ver});
records.filter(r => this.lifeAchievementPassed(r, ver)).forEach(r => this.rememberLifeAchievementStage(r));
return this.lifeAchievementPassed(s.lifeAchievements && s.lifeAchievements.stages && s.lifeAchievements.stages[ver], ver, top);
},
lifeAchievementCondition(cond) {
if (!cond || typeof cond !== "object") return false;
if (String(cond.type || "").startsWith("life_")) return true;
return ["all", "any"].includes(cond.type) && Array.isArray(cond.of) && cond.of.some(c => this.lifeAchievementCondition(c));
},
checkLifeAchievements() {
const s = this.state, store = this.achvStore(), newly = [];
if (!s || !store) return newly;
for (const a of this.cfg.ACHIEVEMENTS || []) {
if (!a || !a.key || !this.lifeAchievementCondition(a.cond) || store.has(a.key)) continue;
try {
if (this.achvCondOk(a.cond, null) && store.unlock(a.key, {ver:s.ver || "", week:s.week || 0, slot:"life-backfill"})) newly.push(a.key);
} catch (e) { console.warn("[ACHV] life backfill", a.key, e); }
}
return newly;
},
achvStore() {
return (typeof window !== "undefined" && window.AchieveStore) ? window.AchieveStore : null;
},
achvCounters() {
const s = this.state;
if (!s.verRetry || typeof s.verRetry !== "object") s.verRetry = {};
if (!s.rank1Params || typeof s.rank1Params !== "object") s.rank1Params = {};
if (!Array.isArray(s.rankLog)) s.rankLog = [];
if (!isFinite(Number(s.hireCount))) s.hireCount = 0;
if (!isFinite(Number(s.fundingZeroTimes))) s.fundingZeroTimes = 0;
return s;
},
achvRetryTotal() {
const vr = this.state.verRetry || {};
return Object.keys(vr).reduce((a, k) => a + (Number(vr[k]) || 0), 0);
},
achvAliveCount() {
return (this.state.engineers || []).filter((e) => e && !e.resigned).length;
},
achvArchGot() {
const got = {};
Object.keys(this.state.codex || {}).forEach((k) => {
const a = String(k).split(":")[0];
if (a) got[a] = (got[a] || 0) + 1;
});
return got;
},
achvArchAll() {
const all = (this.cfg.ARCHITECTURES || []).filter((a) => a && a.id).map((a) => a.id);
if (!all.length) return false;
const got = this.achvArchGot();
return all.every((id) => got[id] > 0);
},
achvCodexFull() {
const c = this.cfg, s = this.state;
const archs = (c.ARCHITECTURES || []).filter((a) => a && a.id);
const params = c.TARGET_PARAMS || [];
if (!archs.length || !params.length) return false;
const widest = Math.max.apply(null, params);
let cells = 0;
for (const a of archs) {
const mx = a.maxParam > 0 ? a.maxParam : widest;
for (const p of params) {
if (p > mx) continue;
cells++;
if (!s.codex || !s.codex[a.id + ":" + p]) return false;
}
}
return cells > 0;
},
achvPaperAll() {
const c = this.cfg, s = this.state;
const order = c.VER_ORDER || ["V1"];
const byVer = (c.PAPER && c.PAPER.CANDIDATES_BY_VER) || {};
const need = [];
order.forEach((v) => {
(byVer[v] || []).forEach((p) => {
const no = (p && typeof p === "object") ? p.no : p;
if (no != null && need.indexOf(no) < 0) need.push(no);
});
});
if (!need.length) return false;
const owned = (s.papersOwned || []).map((x) => this.paperNoOf(x));
return need.every((no) => owned.indexOf(no) >= 0);
},
achvNoteAll() {
const ids = Object.keys(((this.cfg.CHAT_TREE2 || {}).NOTES) || {});
if (!ids.length) return false;
const nb = (this.state.notebook || []).map(String);
return ids.every((id) => nb.indexOf(String(id)) >= 0);
},
achvChatAllSeen() {
const c = this.cfg, s = this.state;
const byVer = ((c.CHAT_TREE2 || {}).BY_VER) || {};
const order = c.VER_ORDER || ["V1"];
const seen = (s.c2 && s.c2.seen) || {};
const need = [];
order.forEach((v) => {
const opts = ((byVer[v] || {}).opts) || {};
Object.keys(opts).forEach((oid) => {
const ans = (opts[oid] && opts[oid].ans) || {};
["dumb", "full"].forEach((k) => {
(ans[k] || []).forEach((a) => {
if (a && a.id != null && need.indexOf(String(a.id)) < 0) need.push(String(a.id));
});
});
});
});
if (!need.length) return false;
return need.every((id) => Object.prototype.hasOwnProperty.call(seen, id));
},
achvCondOk(cond, r) {
const c = this.cfg, s = this.state;
if (!cond || typeof cond !== "object") return false;
const t = cond.type;
if (!this.ACHV_COND_TYPES[t]) {
if (typeof console !== "undefined" && console.error) {
console.error("[成就] 未知条件类型 " + t + " ⇒ 该成就永远不会解锁（引擎与配置不同源？）");
}
return false;
}
const pass = this.passLine();
const cap = this.statCap();
const dims = ["code", "text", "safety", "stability"];
const mul = cond.mul != null ? Number(cond.mul) : 1;
const groups = window.V35.mergedGroups(s);
const sources = d => (groups.find(g => g.key === d || g.sources.includes(d)) || { sources: [d] }).sources;
const line = d => sources(d).reduce((n, k) => n + Number(pass[k] || 0), 0);
const val = d => sources(d).reduce((n, k) => n + Number(s[k] || 0), 0);
const maxRatio = () => {
let best = 0;
dims.forEach((d) => { const l = line(d); if (l > 0) best = Math.max(best, val(d) / l); });
return best;
};
switch (t) {
case "param_rank1": {
const got = s.rank1Params || {};
return (cond.params || []).length > 0 && cond.params.every((p) => !!got[p]);
}
case "dim_above": return val(cond.dim) >= line(cond.dim) * mul;
case "dim_below": return val(cond.dim) < line(cond.dim) * mul;
case "dim_ratio_above": return !!r && r.balanced === false && val(cond.dim) >= line(cond.dim) * mul;
case "dim_max_ratio_above": return !!r && r.balanced === false && maxRatio() >= mul;
case "dim_at_cap_all":
return dims.every((d) => cap[d] != null && Math.round(val(d)) === Math.round(sources(d).reduce((n, k) => n + (cap[k] || 0), 0)));
case "balanced_false": return !!r && r.balanced === false;
case "axis_only_miss": {
if (!this.v35On()) return false;
const ck = (r && r.checks) || {};
return !!(ck.code && ck.text && ck.safety && ck.stability && ck.score
&& r.excellent === false && r.axisOk === false);
}
case "mission_fail": return !!(s.mission && s.mission.ver===s.ver && !this.missionJudge(s,s.arch,s.paramTarget).hit);
case "retry_times": return ((s.verRetry || {})[s.ver || "V1"] || 0) >= Number(cond.n || 0);
case "bonus_zero": return !!s.bonus && Number(s.bonus.total || 0) <= 0;
case "funding_below": return Number(s.funding || 0) <= Number(cond.n || 0);
case "funding_zero_times": return Number(s.fundingZeroTimes || 0) >= Number(cond.n || 0);
case "rank_le": return s.rank != null && Number(s.rank) <= Number(cond.n);
case "rank_hold": {
const need = Math.max(1, Number(cond.stages || 1));
const log = (s.rankLog || []).slice(-need);
return log.length >= need && log.every((x) => x && Number(x.rank) <= Number(cond.n));
}
case "verdict_is": return !!r && r.verdict === cond.v;
case "pass_like": return this.isPassLike(r);
case "ver_reach": {
const order = c.VER_ORDER || ["V1"];
const want = order.indexOf(cond.ver);
return want >= 0 && order.indexOf(s.ver || "V1") >= want;
}
case "codex_full": return this.achvCodexFull();
case "codex_count": return Object.keys(s.codex || {}).length >= Number(cond.n || 0);
case "arch_all": return this.achvArchAll();
case "arch_count": return Object.keys(this.achvArchGot()).length >= Number(cond.n || 0);
case "papers_ge": return (s.papersOwned || []).length >= Number(cond.n || 0);
case "paper_all": return this.achvPaperAll();
case "energy_all_below": {
if (!this.v35On()) return false;
const e = (s.v35 || {}).energy || {};
if (e.pre == null || e.data == null || e.post == null) return false;
const n = Number(cond.n || 0);
return Number(e.pre) <= n && Number(e.data) <= n && Number(e.post) <= n;
}
case "team_full": return this.isPassLike(r) && this.achvAliveCount() >= this.seatCap();
case "team_resigned":
return (s.engineers || []).filter((e) => e && e.resigned).length >= Number(cond.n || 1);
case "team_alive_eq": return this.isPassLike(r) && this.achvAliveCount() === Number(cond.n);
case "burnout_count":
return (s.engineers || []).filter((e) => e && !e.resigned && Number(e.energy || 0) <= 0).length >= Number(cond.n || 0);
case "corpus_gap": {
const wk = ((s.v35 || {}).weekly || []).slice(-1)[0];
const gap = wk && wk.gap != null ? Number(wk.gap) * 100 : 0;
return gap >= Number(cond.pct || 0);
}
case "game_clear": return !!(r && !r.nextVer && !r.retry && this.isPassLike(r));
case "no_retry":
return !!(r && !r.nextVer && !r.retry && this.isPassLike(r)) && this.achvRetryTotal() === 0;
case "all_stage_excellent": {
const order = c.VER_ORDER || ["V1"];
const marks = s.stageMarks || {};
if (order.some((v) => !marks[v])) return false;
return order.every((v) => {
const m = marks[v];
return !!m && (m.verdict === "excellent" || m.verdict === "top");
});
}
case "chat_all_seen": return this.achvChatAllSeen();
case "note_all": return this.achvNoteAll();
case "hire_zero": return Number(s.hireCount || 0) === 0;
case "life_stage_pass": return this.lifeAchievementStage(cond.ver, false);
case "life_stage_top": return this.lifeAchievementStage(cond.ver, true);
case "life_body_owned": {
if (!this.lifeAchievementStages().includes(cond.ver)) return false;
const row = ((c.FACTORY || {}).BY_VER || {})[cond.ver], rec = s.bodyFactory && s.bodyFactory.stages && s.bodyFactory.stages[cond.ver];
return !!(row && rec && (row.TIERS || []).some(t => t && t.id === rec.tier && Number(t.units) >= Math.max(1, Number(row.REQUIRED_UNITS) || 1)
&& Number.isFinite(Number(rec.invested)) && Number(rec.invested) >= Number(t.price)
&& (Number(rec.invested) > 0 || Number(t.price) === 0 && Number.isFinite(Number(rec.purchasedAt)) && Number.isFinite(Number(rec.purchasedWeek)))));
}
case "life_awake": return !!(s.embodiedEra && s.embodiedEra.bodyAwakened === true && s.embodiedEra.podExitSeen === true);
case "life_mentor": {
const mentor = this.engByKey((c.EMBODIED || {}).MENTOR_KEY || "eng_embodied_mentor");
return !!(mentor && (s.engineers || []).some(e => e && (e.no === mentor.no || e.key === mentor.key)
&& (e.traits || []).some(t => t && t.type === "embodied" && Number(t.level) >= 4)));
}
case "life_city_stop": {
const route = ((c.CITY_JOURNEY || {}).STOPS || []).filter(n => n && n.id && Array.isArray(n.steps) && n.steps.length);
return !!(typeof cond.id === "string" && route.some(n => n.id === cond.id) && s.cityJourney
&& Array.isArray(s.cityJourney.completedStops) && s.cityJourney.completedStops.includes(cond.id));
}
case "life_city_all": {
const route = ((c.CITY_JOURNEY || {}).STOPS || []).filter(n => n && n.id && Array.isArray(n.steps) && n.steps.length);
const done = s.cityJourney && s.cityJourney.completedStops;
return route.length > 0 && Array.isArray(done) && route.every(n => done.includes(n.id));
}
case "life_feed_count": {
const care = s.care, n = Number(cond.n);
return !!(care && care.events && care.events.feed === true && Number.isInteger(n) && n > 0
&& this.lifeAchievementStages().reduce((total, ver) => {
const value = (care.stageFeeds || {})[ver];
return total + (Number.isSafeInteger(value) && value > 0 ? value : 0);
}, 0) >= n);
}
case "life_managed": {
const last = s.care && s.care.automation && s.care.automation.last;
return !!(last && ["talk", "raise", "rest"].includes(last.kind) && typeof last.id === "string" && last.id
&& Number.isSafeInteger(last.whaleEnergyCost) && last.whaleEnergyCost > 0
&& ((last.kind === "rest" && last.pending === true) || Number(last.gain) > 0));
}
case "all": return (cond.of || []).length > 0 && cond.of.every((x) => this.achvCondOk(x, r));
case "any": return (cond.of || []).some((x) => this.achvCondOk(x, r));
default:
console.error("[成就] 条件类型已在白名单里但引擎没实现：" + t);
return false;
}
},
checkAchievements(r) {
const s = this.state;
const store = this.achvStore();
const list = this.cfg.ACHIEVEMENTS || [];
if (!store || !list.length) return [];
this.achvCounters();
const newly = [];
for (const a of list) {
if (!a || !a.key) continue;
if (store.has(a.key)) continue;
let ok = false;
try { ok = this.achvCondOk(a.cond, r); }
catch (e) {
console.error("[成就] 条件判定抛错：" + a.key, e);
ok = false;
}
if (!ok) continue;
store.unlock(a.key, {
ver: s.ver || "V1", week: s.week || 0,
verdict: (r && r.verdict) || "", slot: "auto",
});
newly.push(a.key);
}
if (s.bonus && typeof s.bonus === "object") s.bonus.newAchv = newly.slice();
if (newly.length) console.log("[成就] 本次新解锁", newly.length, "条：", newly.join(", "));
return newly;
},
codexGrid() {
const c = this.cfg, s = this.state;
const archs = (c.ARCHITECTURES || []).map((a) => ({ id: a.id, name: a.name || a.id }));
const params = (c.TARGET_PARAMS || [7, 13, 34, 70]).slice();
const codex = s.codex || {};
for (const k of Object.keys(codex)) {
const [a, p] = String(k).split(":");
if (!archs.some((x) => x.id === a)) archs.push({ id: a, name: a });
const np = Number(p);
if (np && params.indexOf(np) < 0) params.push(np);
}
params.sort((x, y) => x - y);
return { archs, params, codex };
},
pushModelSnapshot(s, r) {
if (!s) return null;
const v35 = this.v35On && this.v35On();
const corpus = v35 && s.v35 && s.v35.corpus ? s.v35.corpus.token : (s.corpus || 0);
const snap = {
ver: s.ver || "V1",
param: s.paramTarget || 0,
code: Math.round(s.code || 0),
text: Math.round(s.text || 0),
safety: Math.round(s.safety || 0),
stability: Math.round(s.stability || 0),
qualifyingScore: r ? r.qualifyingScore ?? r.score : 0, qualificationFailed: !!r?.qualificationFailed,
score: r ? Math.round((r.score || 0) * 10) / 10 : 0,
brand: Math.round(s.brand || 0),
users: Math.round(s.users || 0),
corpus: Math.round(corpus || 0),
papers: (s.papersOwned || []).length,
mini: (s.miniModels || []).length,
team: (s.engineers || []).filter((e) => !e.resigned).length,
week: s.week || 0,
verdict: r ? r.verdict : "",
arch: s.arch || "dense", missionFail: !!(r && r.missionFail), retry: !!(r && r.retry), missionHit: !(s.mission && s.mission.hit === false),
...(window.V35.activeAxes(s) || []).reduce((o,k)=>(o[k]=Math.round(s[k]||0),o), {}),
};
if (!Array.isArray(s.modelHistory)) s.modelHistory = [];
let prev = null;
for (let i = s.modelHistory.length - 1; i >= 0; i--) {
if (s.modelHistory[i] && s.modelHistory[i].ver !== snap.ver) { prev = s.modelHistory[i]; break; }
}
const idx = s.modelHistory.findIndex((x) => x && x.ver === snap.ver);
if (idx >= 0) s.modelHistory[idx] = snap; else s.modelHistory.push(snap);
s.prevSnap = prev;
return snap;
},
finishBonus() {
const s = this.state;
if (s.phase !== "bonus") return false;
s.phase = "over";
return true;
},
startNextStage() {
const s = this.state, r = s.result;
if (!r || !r.nextVer || (s.phase !== "over" && s.phase !== "bonus")) return false;
if (s.ver === "V4.5" && r.nextVer === "V5" && !this.embodiedEra().entered) return this.beginEmbodiedIntro();
return this._enterStage(r.nextVer);
},
retryStage() {
const s = this.state, r = s.result;
if (!r || (!r.retry && !r.finalRepeat) || (s.phase !== "over" && s.phase !== "bonus")) return false;
if (r.finalRepeat && this.embodiedEligible()) {
this.healEmbodiedEra();
return this.startNextStage();
}
if (r.retry) s.retryCount = (s.retryCount || 0) + 1;
return this._enterStage(null);
},
_enterStage(newVer) {
const c = this.cfg, s = this.state;
const order = c.VER_ORDER || ["V1"];
this.ensureBodyCalendar();
if (newVer) {
const SR = c.NEWS_SELF_RELEASE || {};
const tpl = SR.enabled !== false ? (SR.byArch || {})[s.arch] : null;
const archCfg = (c.ARCHITECTURES || []).find((x) => x.id === s.arch);
if (tpl && archCfg) {
s.newsSelfDone = s.newsSelfDone || {};
if (!s.newsSelfDone[archCfg.id]) {
s.newsSelfDone[archCfg.id] = true;
const fill = (str) => this.fillVars(str);
this.pushNews({
id: "SELF_" + archCfg.id, title: fill(tpl.title), text: fill(tpl.desc),
src: tpl.src, img: tpl.img, imgAlt: tpl.imgAlt,
});
}
}
}
s.lastLeader = s.leader;
s.leaderOverworked = false;
s.leader = null;
if (newVer) {
s.ver = newVer; s.verIdx = order.indexOf(newVer);
s.chatNode = null; s._lastReplyIdx = {};
this.c2Reset();
}
s.weekOffset = (s.weekOffset || 0) + (s.week || 0);
s.week = c.START_WEEK != null ? c.START_WEEK : 0;
for (const _dk of window.V35.allDims()) s[_dk] = 0;
s.code = 0; s.text = 0; s.safety = 0; s.stability = 0;
s.step = 0;
s.phase = "office";
s.planDone = false;
s.planDraft = null;
s.mission = null;
s.prodByEng = {};
s.prodFullByEng = {};
s.officeModal = null;
s.loopStep = "report";
s.pending = [];
s.pendingEvent = null;
s._propYieldSince = null;
s.triggered = [];
s.hintsDone = s.hintsDone || {};
s._hintPayday = false;
s.ap = c.AP_PER_ROUND != null ? c.AP_PER_ROUND : 2;
s.actionLog = [];
s.corpusShort = 0;
s.workClicks = {};
s.workGain = null;
this.addEnergyAll(30);
for (const e of s.engineers) {
if (e.resigned) continue;
e.restWeek = null; e.energyPending = 0;
e.joinTick = 0;
}
s.tuneDrawsLeft = c.TUNE_DRAWS != null ? c.TUNE_DRAWS : 3;
s.result = null;
const _paperKeep = (s.paperResearch && s.v35 && s.v35.paper && !s.v35.paper.done
&& (s.v35.paper.left || 0) > 0)
? { left: s.v35.paper.left, kind: s.v35.paper.kind,
axis: s.v35.paper.axis, axisProb: s.v35.paper.axisProb, axisAdd: s.v35.paper.axisAdd } : null;
if (this.v35On()) {
s.v35.tick = 0;
s.v35.ver = s.ver;
s.v35.stats = this.newDims(0, s);
s.v35.stageStart = this.newDims(0, s);
s.v35.paper = _paperKeep
? { left: _paperKeep.left, done: false, started: true, kind: _paperKeep.kind || 'text_prob',
axis: _paperKeep.axis || null, axisProb: _paperKeep.axisProb || 0, axisAdd: _paperKeep.axisAdd || 1 }
: { left: 0, done: false, started: false, kind: 'text_prob', axis: null, axisProb: 0, axisAdd: 1 };
s.v35.quota = { pre: [], post: [] };
s.v35.weekly = [];
s.v35.focus = { dim: null, left: 0 };
s.v35.gapState = "ok";
s.v35.preMul = 1;
s.v35.lvShift = 0;
s.breakthroughSeen = false;
s._lastEvtTick = 0;
s.rounds = 0;
s._evtLastAt = {};
s._milestonePaid = false;
s._vigourUsed = false;
this.refreshPaperCandidates();
}
s.incBase = newVer ? 0 : this.reviewIncomeBase(s);
s.embodiedTrainingTicks = 0;
if (this.embodiedAvailable()) { this.embodiedEra().entered = true; this.grantEmbodiedMentor(); }
if (this.embodiedAvailable()) {
this.ensureBodyCalendar();
if (newVer) { this.recordLifeMilestone("body_" + s.ver); this.publishCalendarNews(); }
}
s.stageNo = (s.stageNo || 0) + 1;
if (window.GameSave && window.GameSave.saveStage) window.GameSave.saveStage(s);
return true;
},
requestHire(role) { return window.V35Hire ? window.V35Hire.request(this, role) : { ok: false, tip: "招聘系统未加载" }; },
setLeader(engId) {
const s = this.state;
const e = s.engineers.find((x) => x.id === engId && !x.resigned);
if (!e) return false;
s.leader = e.id;
return true;
},
tuneDraw() {
const c = this.cfg, s = this.state;
if (s.tuneDrawsLeft == null) s.tuneDrawsLeft = 0;
if (s.tuneDrawsLeft <= 0) return { ok: false, tip: "本阶段的抽卡机会已用完" };
const cost = c.TUNE_DRAW_COST != null ? c.TUNE_DRAW_COST : 200000;
if (s.funding < cost) return { ok: false, tip: `经费不足（需要 ${cost / 10000} 万）` };
s.funding -= cost;
s.tuneDrawsLeft -= 1;
const statAvg = (s.code + s.text + s.safety + s.stability) / 4;
const synBoost = (c.ARCH_MINI_BONUS || {})[s.arch] || 0;
const score = Math.round(Math.min(99, 55 + statAvg * 0.3 + Math.random() * 22 + synBoost));
s.miniModels.push({ score, ver: s.ver });
return { ok: true, score };
},
snapshot() { return this.state; },
restore(s) { this.loadState(s); return this.state; },
};
function fmt(n) { return n > 0 ? "+" + n : String(n); }
Object.assign(window.GameCore, {
embodiedAvailable(s) { const st=s||this.state||{}; const a=this.cfg.VER_ORDER||[]; return a.indexOf(st.ver)>=a.indexOf("V5") && a.indexOf("V5")>=0; },
embodiedEra() {
const s=this.state;
if (!s.embodiedEra || typeof s.embodiedEra!=="object" || Array.isArray(s.embodiedEra)) s.embodiedEra={};
const e=s.embodiedEra, d={schema:1,status:"locked",introducerId:null,entered:false,mentorGranted:false,bodyAwakened:false,podExitSeen:false,tutorialStep:0};
Object.keys(d).forEach(k=>{if(e[k]==null)e[k]=d[k];});
return e;
},
embodiedBodyAvailable() { return this.embodiedAvailable() && !!this.embodiedEra().bodyAwakened; },
embodiedPersist() { if(window.GameSave&&window.GameSave.save) window.GameSave.save("auto",this.state); },
embodiedAwakening() {
const s=this.state, C=this.cfg.EMBODIED||{}, available=this.embodiedAvailable();
const configuredRatio=C.AWAKEN_RATIO==null?0.25:Number(C.AWAKEN_RATIO), configuredWeeks=C.AWAKEN_MIN_TRAINING_WEEKS==null?2:Number(C.AWAKEN_MIN_TRAINING_WEEKS);
const ratio=Math.max(0,Math.min(1,Number.isFinite(configuredRatio)?configuredRatio:0.25));
const ticks=Math.max(0, Number(s.embodiedTrainingTicks ?? (s.planDone&&s.v35?s.v35.tick:0))||0);
const minWeeks=Math.max(1,Math.min(52,Math.round(Number.isFinite(configuredWeeks)?configuredWeeks:2)));
const minTicks=Math.ceil(minWeeks*((this.cfg.V35||{}).TICKS_PER_WEEK||6));
const requirements=["embodiedCognition","dexterousControl"].map(key=>({key,label:this.statLabel(key),value:Math.floor(Number(s[key])||0),target:Math.max(1,Math.ceil((window.V35.axisPass(s.ver,key)||200)*window.V35.lineScale(s.ver,s.paramTarget)*ratio))}));
const progress=Math.min(1,ticks/minTicks,...requirements.map(x=>x.value/x.target));
return {ready:available&&!!s.planDone&&ticks>=minTicks&&requirements.every(x=>x.value>=x.target),requirements,progress:Math.max(0,progress),trainingTicks:ticks,minTicks};
},
checkEmbodiedAwakening() {
if(!this.embodiedAvailable())return false;
const e=this.embodiedEra();
if(e.bodyAwakened)return false;
if(!this.embodiedAwakening().ready)return false;
e.bodyAwakened=true; e.podExitSeen=false; this.embodiedPersist(); return true;
},
embodiedStatus() {
const e=this.embodiedEra(), people=this.state.engineers||[], inviter=people.find(x=>x.id===e.introducerId)||people.find(x=>!x.resigned);
return Object.assign({},e,{pendingIntro:e.status==="intro"||e.status==="accepted",inviter:inviter?inviter.name:"团队工程师",awakening:this.embodiedAwakening()});
},
embodiedIntroPending() { return this.embodiedStatus().pendingIntro; },
embodiedEligible() {
const s=this.state, r=s.result;
if(!["V4","V4.5"].includes(s.ver))return false;
const passed=x=>x&&["pass","excellent","top"].includes(x.verdict)&&!x.missionFail&&!x.qualificationFailed&&!x.retry&&x.missionHit!==false;
const historyPass=(x,ver)=>{
if(!passed(x))return false;
const archivedVer=x.ver||ver, sameStage=s.ver==="V4.5"&&archivedVer==="V4.5";
const legacyFlagship=!Object.prototype.hasOwnProperty.call(x,"missionFail")&&["V4","V4.5"].includes(archivedVer);
if(!sameStage&&!legacyFlagship)return false;
if(sameStage&&x.missionFail===false)return true;
const param=Number(x.param);
if(!Number.isFinite(param)||param<1600||(x.arch&&x.arch!=="csa")||(!sameStage&&x.arch!=="csa"))return false;
const limits=(this.missionOf("V4.5")||{}).axisMin||{};
return Object.keys(limits).every(k=>x[k]==null||Number(x[k])>=limits[k]);
};
const settled = r && (r.settled || r.finalRepeat===true || s.phase === "bonus" || s.phase === "over");
if(s.ver==="V4.5"&&settled&&passed(r)&&(r.missionFail===false||!(s.mission&&s.mission.hit===false)))return true;
if(["V4","V4.5"].some(ver=>historyPass((s.stageMarks||{})[ver],ver)))return true;
if((Array.isArray(s.modelHistory)?s.modelHistory:[]).some(x=>historyPass(x)))return true;
if((Array.isArray(s.codexLog)?s.codexLog:[]).some(x=>historyPass(x)))return true;
return Object.values(s.codex&&typeof s.codex==="object"?s.codex:{}).some(entry=>
entry&&[entry.first,entry.best,entry.last].some(x=>x&&historyPass(Object.assign({arch:entry.arch,param:entry.param},x))));
},
beginEmbodiedIntro() {
if(!this.embodiedEligible())return false;
const e=this.embodiedEra(); if(e.entered)return false;
if(!e.introducerId)e.introducerId=((this.state.engineers||[]).find(x=>!x.resigned)||{}).id||null;
e.status="intro";this.state.officeModal=null;this.embodiedPersist();return true;
},
grantEmbodiedMentor() {
const e=this.embodiedEra(), s=this.state, t=this.engByKey((this.cfg.EMBODIED||{}).MENTOR_KEY||"eng_embodied_mentor");
if(!t||!this.embodiedAvailable())return false;
const before=[e.mentorGranted,e.mentorPending,e.mentorArrivalVersion,e.mentorDismissed].join("/");
const remember=(changed=false)=>{if(changed||before!==[e.mentorGranted,e.mentorPending,e.mentorArrivalVersion,e.mentorDismissed].join("/"))this.embodiedPersist();};
const matches=x=>{
if(!x||x.visitorId||/^vis_/.test(String(x.id||"")))return false;
const no=this.engNoOf(x);
return no!=null?Number(no)===Number(this.engNoOf(t)):x.key===t.key||x.id===t.key;
};
const people=(s.engineers||[]).filter(matches);
const existing=people.find(x=>!x.resigned&&x.dismissed!==true)||people[0];
if(existing){
e.mentorGranted=true;e.mentorPending=false;e.mentorArrivalVersion=1;
let changed=false;
if(existing.resigned||existing.dismissed===true)e.mentorDismissed=true;
else{
const trait=(existing.traits||[]).find(x=>x.type==="embodied");
if(!trait||!Number.isFinite(Number(trait.level))||Number(trait.level)<4){
existing.traits=existing.traits||[];
if(trait)trait.level=4;else existing.traits.push({type:"embodied",level:4});
existing.salary=Math.max(Number(existing.salary)||0,this.salaryOf(existing));
changed=true;
}
}
remember(changed);return true;
}
if(e.mentorDismissed===true){e.mentorPending=false;remember();return true;}
if((s.engineers||[]).filter(x=>!x.resigned).length>=this.seatCap()){
e.mentorGranted=false;e.mentorPending=true;remember();return false;
}
const mentor=this.cloneEng(t);mentor.type="embodied";
mentor.traits=[{type:"embodied",level:4},...(mentor.traits||[]).filter(x=>x.type!=="embodied")];
mentor.salary=this.salaryOf(mentor);mentor.joinTick=0;mentor.energy=100;delete mentor.expireAbsWeek;
(s.engineers=s.engineers||[]).push(mentor);this.assignSeat(mentor.id);this.syncEnergySlot("embodied");
e.mentorGranted=true;e.mentorPending=false;e.mentorArrivalVersion=1;remember(true);return true;
},
acceptEmbodiedEra() {
const s=this.state,e=this.embodiedEra();
if(!e.entered&&!this.embodiedEligible())return false;
if(!e.entered){e.status="accepted";this.embodiedPersist();this._enterStage("V5");e.entered=true;}
s.approvedArchs=Array.isArray(s.approvedArchs)?s.approvedArchs:[];
if(!s.approvedArchs.includes("vla"))s.approvedArchs.push("vla");
this.grantEmbodiedMentor();e.status=e.status==="done"?"done":"tutorial";
this.embodiedPersist();if(window.GameSave&&GameSave.saveStage)GameSave.saveStage(s);return true;
},
embodiedAccept() {return this.acceptEmbodiedEra();},
markEmbodiedTutorial(step) {
const e=this.embodiedEra();if(!e.entered)return false;
if(step==="done"){e.status="done";e.tutorialStep=99;}
else {e.tutorialStep=Math.max(e.tutorialStep||0,Math.floor(Number(step)||0));e.status="tutorial";}
this.embodiedPersist();return true;
},
embodiedTutorialNext(step) {return this.markEmbodiedTutorial(step);},
completeBodyAwakening() { const e=this.embodiedEra();if(!e.bodyAwakened)return false;if(!e.podExitSeen)this.recordLifeMilestone("body_awake");e.podExitSeen=true;this.embodiedPersist();return true; },
healEmbodiedEra() {
const s=this.state,e=this.embodiedEra();
if(this.embodiedAvailable()){
e.entered=true;if(e.status==="locked"||e.status==="intro"||e.status==="accepted")e.status="tutorial";
s.approvedArchs=s.approvedArchs||[];if(!s.approvedArchs.includes("vla"))s.approvedArchs.push("vla");
this.grantEmbodiedMentor();this.checkEmbodiedAwakening();
} else if(this.embodiedEligible()){
e.entered=false;
if(s.result&&["pass","excellent","top"].includes(s.result.verdict)&&!s.result.missionFail){
if(s.result.finalRepeat===true)s.result.settled=true;
s.result.nextVer="V5";s.result.finalRepeat=false;
}
this.beginEmbodiedIntro();
}
return e;
},
statSources(k) {return k==="codeText"?["code","text"]:k==="safetyStability"?["safety","stability"]:[k];},
displayDims(s) {
const st=s||this.state, keys=this.dimsOf(st), late=this.embodiedAvailable(st);
const shown=late?["codeText","safetyStability"].concat(keys.filter(k=>!window.V35.DIM_ORDER.includes(k))):keys;
return shown.map(key=>{const d=this.axisDef(key)||{};return {key,label:({codeText:"代码&文字",safetyStability:"安全&稳定"})[key]||this.statLabel(key),sources:this.statSources(key),color:d.color||({codeText:"linear-gradient(90deg,#55c4ff,#789cff)",safetyStability:"linear-gradient(90deg,#72d9b9,#51aacc)"})[key]||"",icon:d.icon||""};});
},
displayValue(k,s) {const st=s||this.state;return this.statSources(k).reduce((n,x)=>n+(Number(st[x])||0),0);},
displayCap(k,s) {const prev=this.state;if(s)this.state=s;try{const cap=this.statCap();return this.statSources(k).reduce((n,x)=>n+(Number(cap[x])||0),0);}finally{this.state=prev;}},
displayPass(k,s) {const prev=this.state;if(s)this.state=s;try{const p=this.passLine();return this.statSources(k).reduce((n,x)=>n+(Number(p[x]??(p.axMin||{})[x])||0),0);}finally{this.state=prev;}},
statValue(k,s){return this.displayValue(k,s);},statCapValue(k,s){return this.displayCap(k,s);},statPassValue(k,s){return this.displayPass(k,s);}
});
{const gc=window.GameCore,run=gc.officeAdvanceV35;gc.officeAdvanceV35=function(n){const out=run.call(this,n);this.checkEmbodiedAwakening();return out;};}
