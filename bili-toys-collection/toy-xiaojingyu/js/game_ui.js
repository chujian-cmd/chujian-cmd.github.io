
"use strict";
const PORTRAIT_BOX_W = 340;
window.GameUI = {
el: null,
core: null,
save: null,
_modal: null,
_candPage: 0,
_candPages: 1,
get TEAM_PER_PAGE() { return window.innerWidth > window.innerHeight && window.innerHeight <= 450 ? 3 : 6; },
CLICK_SFX_HEAVY: {
"event-opt": 1, "direction": 1, "buy-tier": 1, "target": 1, "finetune": 1,
"advance": 1, "name-confirm": 1, "finish": 1, "hire": 1, "act-target": 1,
"to-review": 1, "go-buygpu": 1, "go-direction": 1, "newgame": 1,
},
init(core, save) {
this.core = core;
this.save = save;
this.el = document.getElementById("devgame-render");
if (!this.el) return;
this.installOfficeProductionLifecycle();
this.el.addEventListener("click", (e) => this.onClick(e));
this.el.addEventListener("pointerdown", (e) => {
this._pressSeq = (this._pressSeq || 0) + 1;
this._pressTarget = e.target;
this._pressX = e.clientX; this._pressY = e.clientY;
}, true);
this.el.addEventListener("touchstart", (e) => {
const t0 = (e.changedTouches || e.touches || [])[0];
if (!t0) return;
this._pressSeq = (this._pressSeq || 0) + 1;
this._pressTarget = e.target;
this._pressX = t0.clientX; this._pressY = t0.clientY;
}, true);
this.el.addEventListener("pointerup", (e) => {
this._pressUpX = e.clientX; this._pressUpY = e.clientY;
this._pressUpCheck(e.clientX, e.clientY);
}, true);
this.el.addEventListener("touchend", (e) => {
const t0 = (e.changedTouches || [])[0];
if (!t0) return;
this._pressUpX = t0.clientX; this._pressUpY = t0.clientY;
this._pressUpCheck(t0.clientX, t0.clientY);
}, true);
const setInCard = (v) => {
if (this._pointerInCard === v) return;
this._pointerInCard = v;
if (!v) setTimeout(() => { try { this.fitModalBody(); } catch (e) { } }, 120);
};
this.el.addEventListener("pointerover", (e) => {
if (e.target && e.target.closest && e.target.closest(".modal-card")) setInCard(true);
});
this.el.addEventListener("pointerout", (e) => {
const to = e.relatedTarget;
if (!(to && to.closest && to.closest(".modal-card"))) setInCard(false);
});
if (!this._resizeBound) {
this._resizeBound = true;
window.addEventListener("resize", () => {
this.applyUiScale(); this.invalidateFit(); this.fitModalBody();
if(this.core&&this.core.state&&this.core.state.phase==="naming"&&this._namingPer!==this.namingPerPage())this.renderNaming();
if(this.core&&this.core.state.phase==="office"&&this.core.state.officeModal==="paper"&&this._paperPer!==this.paperPerPage())this.refreshOfficeBody();
if(this.el&&this.el.querySelector("#codexPop")&&this._cdxPer!==this.codexPerPage()){this._cdxPage=Math.floor((this._cdxPage||0)*(this._cdxPer||3)/this.codexPerPage());this.openCodexPop();}
if (this._scaleRAF) cancelAnimationFrame(this._scaleRAF);
this._scaleRAF = requestAnimationFrame(() => { this._scaleRAF = 0; this.applyUiScale(); });
});
}
document.addEventListener("keydown", (e) => {
if (e.key === "Escape") {
if (this._confirmOpen) { this.closeConfirm(); return; }
this.closeModal();
}
});
},
launch() {
const s = this.core.state;
const auto = this.save.load("auto");
if (auto && auto.state && auto.state.phase) {
const tc = window.ToyCloud;
if (tc && tc.beginRestore) tc.beginRestore();
try { this.core.restore(auto.state); }
finally { if (tc && tc.endRestore) tc.endRestore(); }
} else if (!s || !s.phase) {
this.core.newGame();
}
this._tickFails = 0; this._tickRecovered = false;
this._modal = null;
this.render();
},
render(opts) {
if (!this.el) return;
const s = this.core.state;
if(s.phase!=="bonus")this.disposeRewardPages();
if(this._officeReadPages&&(s.phase!=="office"||s.officeModal!==this._officeReadPages.key||this._officeReadPages.state!==s))this.disposeOfficeReadPages();
const soft = !!(opts && opts.soft);
if(this._modalPages&&(this._modalPages.kind!==this._modal||this._modalPages.state!==s))this.disposeModalPages();
this.el.querySelectorAll(".dg-modal-mask").forEach((el) => {
if (el.classList.contains("dg-fire-modal")) return;
if (el.classList.contains("dg-confirm-modal")) return;
if (el.id === "saveModal" && this._modal === "save" && s.phase === "office") return;
el.remove();
});
if (s.phase !== "office") this.stopBubbleTimer();
this.stopTestTypewriter();
this.stopEvalShowTimer();
if (s.phase === "review" && s.result && this.core.embodiedAvailable && this.core.embodiedAvailable(s)) this.settleEmbodiedReview();
const phase = s.phase;
if (phase !== "bonus") this.clearBonusTimers();
this.switchBgm(phase);
if (!s.v35) { this.renderNaming(); return; }
if (phase === "naming") this.renderNaming();
else if (phase === "office") {
this.renderOffice();
}
else if (phase === "minigame") { s.phase = "office"; this.renderOffice(); }
else if (phase === "review") {
this._evalWaitTut = false;
this.renderEvalShow();
const rtut = this.core.tutorialPending();
if (rtut) { this._evalWaitTut = true; this.renderTutorialModal(rtut); this.stopEvalShowTimer(); }
}
else if (phase === "bonus") this.renderBonus();
else if (phase === "over") this.renderOver();
else { s.phase = "office"; this.renderOffice(); }
if (this._modal === "save") {
if (!this.el.querySelector("#saveModal")) this.renderSaveModal();
}
else if (this._modal === "help") this.renderHelpModal();
else if (this._modal === "team") this.renderTeamModal();
else if (phase === "office") {
if (s.officeModal) {
this.renderOfficeModal(s.officeModal);
const modalTut = this.core.tutorialPending();
if (modalTut) this.renderTutorialModal(modalTut);
} else {
this.closeOfficeModal();
const tut2 = this.core.tutorialPending();
if (tut2) this.renderTutorialModal(tut2);
}
}
else if (phase !== "review") {
const tut = this.core.tutorialPending();
if (tut) this.renderTutorialModal(tut);
}
if (!this.el.querySelector(".dg-fire-modal")) this._fireOpen = false;
if (!this.el.querySelector(".dg-confirm-modal")) {
const cancel = this._confirmCancel;
this._confirmOpen = false; this._confirmCb = null; this._confirmCancel = null;
if (cancel) cancel();
}
if (!soft) this.playPageIn();
if (!soft) this.playTransition();
},
switchBgm(phase) {
const A = window.AudioMgr, U = window.BGM_URLS;
if (!A || !A.playBgm || !U) return;
const want = (phase === "review" && U.review)
|| (phase === "bonus" && U.bonus)
|| U.scene || U.menu;
if (!want || want === this._curBgm) return;
this._curBgm = want;
A.playBgm(want);
},
playPageIn() {
if (!this.el) return;
const board = this.el.querySelector(".dg-board");
if (!board) return;
board.classList.remove("dg-page-in");
void board.offsetWidth;
board.classList.add("dg-page-in");
},
candPerPage() {
try {
const pp = window.matchMedia("(max-width: 520px) and (orientation: portrait)");
if (pp.matches) return 1;
} catch (e) {}
return 2;
},
portraitSrc(uiType) {
const c = this.core ? this.core.cfg : null;
const ports = (c && c.UI_PORTS) || {};
return ports[uiType] || ports.fixed || ports.default || "resource/character/简历求过.webp";
},
uiTypeMeta(uiType) {
const c = this.core ? this.core.cfg : null;
const T = (c && c.UI_TYPES) || {};
return T[uiType] || T.fixed || { name: uiType || "固定", icon: "", cls: "u-fixed" };
},
uiTypeName(uiType) { return this.uiTypeMeta(uiType).name; },
trainAnim(cb) {
if (this._trainAnim) return;
this._trainAnim = true;
const s = this.core.state;
const cfg = this.core.cfg || {};
const ms = cfg.TRAIN_ANIM_MS || 3000;
const portMs = cfg.TRAIN_PORT_MS || 1500;
const week = s.week || 0;
const currentPct = this.weekPct(week);
const list = this.trainPortraits();
const sparkIds = (this.core.pickSparks && typeof this.core.pickSparks === "function")
? this.core.pickSparks() : [];
const activeEngs = s.engineers.filter((e) => !e.resigned);
const skipVers = cfg.TRAIN_SKIP_VERSIONS || ["V2", "V3", "V4"];
const canSkip = skipVers.includes(s.ver || "V1");
const sparkTimers = [];
const sparkHTML = (sparkIds.length && activeEngs.length) ? `
        <div class="dg-spark-hint">💡 点击发光的工程师，触发灵感爆发！</div>
        <div class="dg-spark-row">${activeEngs.map((e) => `
          <button class="dg-spark-card${sparkIds.includes(e.id) ? " lit" : ""}" type="button" data-spark="${e.id}">
            ${e.avatar ? `<img class="dg-spark-avatar" src="${e.avatar}" alt="">` : `<span class="dg-spark-emoji">${this.typeIcon(e.type)}</span>`}
            <span class="dg-spark-name">${e.name}</span>
          </button>`).join("")}</div>` : "";
const overlay = document.createElement("div");
overlay.className = "dg-train-anim";
overlay.innerHTML = `
      <div class="dg-train-inner">
        <div class="dg-tl">
          <div class="dg-tl-track">
            <div class="dg-tl-line"></div>
            <div class="dg-tl-fill" style="width:${(currentPct * 100).toFixed(1)}%"></div>
            <div class="dg-tl-dot" style="left:${(currentPct * 100).toFixed(1)}%"></div>
            <div class="dg-tl-marks">${this.trainMarks()}</div>
          </div>
          <div class="dg-tl-dates">
            <span id="dg-tl-now" class="dg-tl-now">${this.trainDateAt(0)}</span>
            <span class="dg-tl-week">第 <b>${week}</b> 周</span>
          </div>
        </div>
        <div class="dg-train-stage">${list.map((src, i) =>
`<img class="dg-train-stage-img${i === 0 ? " active" : ""}" src="${src}" alt="">`).join("")}</div>
        <div class="dg-train-label">
          ${this.icon("gear", 21)}
          <span class="dg-train-label-text">模型训练中</span>
          <span class="dg-train-dot"></span>
        </div>
        ${sparkHTML}
        ${canSkip ? `<button class="dg-train-skip" type="button">跳过 ▶</button>` : ""}
        <button class="dg-continue-btn" type="button" hidden>${this.icon("chevR", 16)} 已就绪，点击继续</button>
      </div>`;
document.body.appendChild(overlay);
let idx = 0;
const imgs = overlay.querySelectorAll(".dg-train-stage-img");
const timer = setInterval(() => {
idx = (idx + 1) % list.length;
imgs.forEach((im, i) => im.classList.toggle("active", i === idx));
}, Math.max(400, portMs));
if (window.SFX && SFX.gearLoop) SFX.gearLoop(ms, 0.5);
const dot = overlay.querySelector(".dg-tl-dot");
const fill = overlay.querySelector(".dg-tl-fill");
const nowLb = overlay.querySelector("#dg-tl-now");
const t0 = performance.now();
const step = () => {
const p = Math.min(1, (performance.now() - t0) / ms);
const nowPct = currentPct * p;
if (dot) dot.style.left = (nowPct * 100).toFixed(1) + "%";
if (fill) fill.style.width = (nowPct * 100).toFixed(1) + "%";
if (nowLb) nowLb.textContent = this.trainDateAt(nowPct);
if (p < 1) requestAnimationFrame(step);
};
requestAnimationFrame(step);
const cleanup = () => {
clearInterval(timer);
sparkTimers.forEach(clearTimeout);
this._trainAnim = false;
overlay.classList.add("dg-anim-out");
setTimeout(() => overlay.remove(), 280);
if (cb) cb();
};
const done = () => {
clearInterval(timer);
const lb = overlay.querySelector(".dg-train-label-text");
if (lb) lb.textContent = "训练完成";
const btn = overlay.querySelector(".dg-continue-btn");
if (btn) btn.hidden = false;
const skip = overlay.querySelector(".dg-train-skip");
if (skip) skip.remove();
};
overlay.addEventListener("click", (e) => {
if (e.target.closest(".dg-continue-btn")) { cleanup(); return; }
if (e.target.closest(".dg-train-skip")) { cleanup(); return; }
const card = e.target.closest(".dg-spark-card.lit");
if (card && !card.classList.contains("dg-spark-used")) {
const res = this.core.applySpark ? this.core.applySpark(card.dataset.spark) : null;
if (res) {
card.classList.add("dg-spark-used");
if (window.SFX) SFX.play("ui");
const fl = document.createElement("span");
fl.className = "dg-spark-float";
fl.textContent = res.parts && res.parts.length ? `💡 ${res.parts.join(" ")}` : "💡 灵感一闪";
card.appendChild(fl);
setTimeout(() => fl.remove(), 1300);
} else {
card.classList.add("dg-spark-used");
}
}
});
setTimeout(done, ms);
},
weekPct(week) {
const total = Math.max(1, (this.core.cfg && this.core.cfg.TOTAL_WEEKS) || 24);
return Math.min(1, Math.max(0, (week || 0) / total));
},
trainAnchor() {
const tl = (this.core.cfg && this.core.cfg.TRAIN_TIMELINE) || {};
const start = this.parseDate(tl.startDate || "2023-06-26");
const months = Math.max(1, (tl.windowMonths != null ? tl.windowMonths : 6));
const end = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
return { start, end };
},
parseDate(s) {
const p = String(s).split("-").map((x) => parseInt(x, 10));
const y = p[0] || 2023, m = (p[1] || 1) - 1, d = p[2] || 1;
return new Date(y, m, d);
},
trainDateAt(p) {
const a = this.trainAnchor();
const t = a.start.getTime() + Math.min(1, Math.max(0, p)) * (a.end.getTime() - a.start.getTime());
const d = new Date(t);
return d.getFullYear() + "." + this.pad2(d.getMonth() + 1) + "." + this.pad2(d.getDate());
},
pad2(n) { return String(n).padStart(2, "0"); },
trainMarks() {
const a = this.trainAnchor();
const span = a.end.getTime() - a.start.getTime();
const marks = [];
const m = new Date(a.start);
m.setDate(1);
const MIN_GAP = 9;
let lastPos = -Infinity;
while (m <= a.end) {
const pos = Math.max(0, Math.min(100, Math.round(((m.getTime() - a.start.getTime()) / span) * 100)));
if (pos - lastPos >= MIN_GAP) {
marks.push(`<i class="dg-tl-mark" style="left:${pos}%"><span>${m.getFullYear()}.${this.pad2(m.getMonth() + 1)}</span></i>`);
lastPos = pos;
}
m.setMonth(m.getMonth() + 1);
}
return marks.join("");
},
trainPortraits() {
return [
"resource/character/叉腰.webp",
"resource/character/比耶.webp",
"resource/character/大拇哥.webp",
"resource/character/看书.webp",
"resource/character/笨笨的.webp",
"resource/character/讨饭.webp",
"resource/character/躺1.webp",
"resource/character/简历求过.webp",
];
},
tpl(str) {
if (this.core && this.core.fillVars) return this.core.fillVars(str);
return String(str == null ? "" : str);
},
officeActions() {
const s = this.core.state;
const perWeek = (this.core.cfg.OFFICE || {}).ROUNDS_PER_WEEK || 7;
const v35on = this.core.v35On && this.core.v35On();
const focusLocked = false;
const testable = v35on && s.planDone && (s.week || 0) >= 3;
const guide = this.core.guidePending && this.core.guidePending();
const list = [
{ key: "team", icon: "users", label: "团队" },
{ key: "news", icon: "news", label: "吃瓜",
count: (s.newsUnread || 0) > 0 ? s.newsUnread : null },
{ key: "recruit", icon: "briefcase", label: "招聘",
count: Math.max(0, (s.candidates || []).length) },
{ key: "plan", icon: "file", label: "立项",
badge: guide && guide.key === "plan" ? "待立项" : (s.planDone ? null : "待立项") },
{ key: "focus", icon: "target", label: "攻关",
badge: focusLocked ? "未解锁" : null,
countdown: s.focusBoost ? Math.max(1, Math.ceil(s.focusBoost.roundsLeft / perWeek)) : null },
{ divider: true },
{ key: "corpus", icon: "database", label: "语料",
badge: (this.core.v35On && this.core.v35On() && s.v35 && s.v35.gapState !== "ok") ? "缺口" : null },
{ key: "paper", icon: "book", label: "论文",
badge: (!s.paperResearch && (s.paperCandidates || []).filter((id) => !this.core.hasPaper(id)).length > 0) ? "可研究" : null,
countdown: s.paperResearch ? this.core.paperWeeksLeft() : null },
{ key: "shop", icon: "cpu", label: "算力",
badge: guide && guide.key === "shop" ? "待采购" : null },
{ key: "test", icon: "chat", label: "测试",
badge: testable && s.testBadgeVer !== (s.ver || "V1") ? "可测试" : null },
{ key: "review", icon: "shield", label: "评审",
badge: this.core.canReview() ? "可评审" : null },
];
const uicfg = (this.core.cfg || {}).UI_CFG || {};
if (Array.isArray(uicfg.actions) && uicfg.actions.length) {
const byKey = {};
list.forEach((it) => { byKey[it.divider ? "divider" : it.key] = it; });
const out = [];
uicfg.actions.forEach((k) => {
if (byKey[k]) { out.push(byKey[k]); delete byKey[k]; }
});
Object.keys(byKey).forEach((k) => out.push(byKey[k]));
return out;
}
return list;
},
modelDims(state) {
const s = state || this.core.state;
return this.core.displayDims ? this.core.displayDims(s) : this.core.dimsOf(s).map(key => ({key, label:this.core.statLabel(key), sources:[key]}));
},
officeIslandEvent() {
const dividend = this.core.state.v35 && this.core.state.v35.dividend;
return !!(dividend && dividend.left > 0);
},
officeDateLabel(compact) {
if (compact == null) compact = !!this.el.querySelector('.island-topbar.island-compact');
const full = this.dateLabel(this.absWeek());
return compact ? full.replace(new RegExp(this.core.cfg.UI_CFG.ISLAND.YEAR_PREFIX_PATTERN), '') : full;
},
officeCorpusUnit(unit, compact) {
if (compact == null) compact = !!this.el.querySelector('.island-topbar.island-compact');
return compact ? unit.replace(new RegExp(this.core.cfg.UI_CFG.ISLAND.TOKEN_SUFFIX_PATTERN, 'i'), '') : unit;
},
fitOfficeIsland() {
const island = this.el.querySelector('.island-topbar');
if (!island || !island.clientWidth) return;
const s=this.core.state, date=this.dateLabel(this.absWeek()), corpus=this.core.v35On()?this.corpusDisplay(s.corpus):null;
const key=[island.clientWidth,window.innerWidth>window.innerHeight,date,s.funding,s.brand,s.corpus,s.fiscalDeficit,this.officeIslandEvent(),document.fonts&&document.fonts.status].join('|');
if(island._fitKey===key)return;
island._fitKey=key;
island.classList.remove('island-compact');
const dateEl=island.querySelector('#ob-date'),unitEl=island.querySelector('.corpus-chip i'),numEl=island.querySelector('#ob-corpus');
if(dateEl)dateEl.textContent=date;
if(corpus&&unitEl)unitEl.textContent=corpus.unit;
if(corpus&&numEl)numEl.textContent=corpus.num;
const nodes=[island,...island.querySelectorAll('.top-left,.island-status,.top-right,.week-chip,.brand-chip,.money-chip,.corpus-chip,.chip-warn,.chip-dividend,.week-chip>span,.money-chip>span,.corpus-chip>span')];
const compact=nodes.some(node=>node.clientWidth>0&&node.getClientRects().length>0&&node.scrollWidth>node.clientWidth+1);
island.classList.toggle('island-compact',compact);
if(dateEl)dateEl.textContent=this.officeDateLabel(compact);
if(corpus&&unitEl)unitEl.textContent=this.officeCorpusUnit(corpus.unit,compact);
},
corpusDisplay(n) {
const v = Number(n) || 0;
return v >= 10000 ? { num: Math.floor(v / 10000), unit: " 万亿 token" } : { num: Math.round(v), unit: " 亿 token" };
},
modelValue(key, state) { return this.core.displayValue ? this.core.displayValue(key, state) : Number((state || this.core.state)[key]) || 0; },
modelCap(key) { return this.core.displayCap ? this.core.displayCap(key) : this.core.statCap()[key] || 0; },
modelPass(key) { const p=this.core.passLine(); return this.core.displayPass ? this.core.displayPass(key) : Number(p[key] ?? (p.axMin || {})[key]) || 0; },
officePassMarker(key) {
const value=this.modelPass(key), cap=this.modelCap(key);
if (!(value>0) || !(cap>0)) return '';
const pct=Math.max(0,Math.min(100,value/cap*100));
const label=String((this.core.cfg.UI_CFG||{}).REVIEW_PASS_LABEL||'').replace('{value}',String(Math.ceil(value)));
return '<span class="stat-pass-marker" style="left:'+pct+'%" title="'+this.esc(label)+'" aria-label="'+this.esc(label)+'"><i></i><span style="transform:translateX(-'+pct+'%)">'+this.esc(label)+'</span></span>';
},
modelLabel(key) { const d=this.modelDims().find(d=>d.key===key); return d ? d.label : this.core.statLabel(key); },
renderOffice() {
const s = this.core.state;
const c = this.core.cfg;
const sc = this.core.scene();
const alive = s.engineers.filter((e) => !e.resigned);
const cap = this.core.statCap();
const brandStars = this.brandStars(s.brand);
const v35on = this.core.v35On && this.core.v35On();
const corpusDisp = v35on ? this.corpusDisplay(s.corpus) : null;
const topbar = `
      <div class="island-topbar${this.officeIslandEvent() ? " has-event" : ""}">
        <div class="top-left">
          <div class="week-chip">${this.icon("calendar", 14)}<span id="ob-date">${this.officeDateLabel()}</span></div>
          <div class="brand-chip" title="${this.brandTip()}"><span id="ob-brand">${brandStars}</span><span class="island-verbose">品牌</span></div>
          <div class="money-chip">${this.icon("coins", 14)}<span><span class="island-verbose">经费 </span><b id="ob-funding">${fmtMoney(s.funding)}</b></span></div>
        </div>
        <div class="island-status">
          <div class="corpus-chip">${this.icon("database", 14)}<span><span class="corpus-label">语料 </span><b id="ob-corpus">${corpusDisp ? corpusDisp.num : Math.round(s.corpus || 0)}</b>${v35on ? "<i>"+corpusDisp.unit+"</i>" : "/" + this.core.corpusCap()}</span>${v35on ? `<span class="corpus-gap ${this.v35GapInfo().cls}" id="ob-gap">${this.v35GapInfo().label}</span>` : ""}</div>
          <div class="chip-warn" id="ob-warn"${s.fiscalDeficit > 0 ? "" : ' style="display:none"'}>⚠️ 欠薪 <span id="ob-deficit">${fmtMoney(s.fiscalDeficit || 0)}</span></div>
          <!-- 2026-09-12：事件角标（原「分红中 N%（剩 N 笔）」太长会把灵动岛其它胶囊挤变形）——
               收敛成「事件 + 感叹号」，点击弹出详情面板（进行中的事件影响，见 officeModalBody 的 dividend 分支） -->
          <button class="chip-dividend" id="ob-dividend" data-action="office-modal" data-id="dividend"${this.officeIslandEvent() ? "" : ' style="display:none"'} title="有事件进行中 · 点击查看详情">事件<i class="dv-bang">!</i></button>
        </div>
        <div class="top-right">
          <button class="island-btn icon-only" title="存档" data-action="open-save">${this.icon("save", 16)}</button>
          <button class="island-btn icon-only" id="ob-pause" title="${s.officePaused ? "继续" : "暂停"}" data-action="office-pause">${this.icon(s.officePaused ? "play" : "pause", 16)}</button>
          <button class="island-btn icon-only" title="设置" data-action="open-settings">${this.icon("settings", 16)}</button>
          <button class="island-btn icon-only" title="玩法说明" data-action="office-modal" data-id="guide">${this.icon("help", 16)}</button>
        </div>
      </div>`;
const actions = this.officeActions().map((a) => {
if (a.divider) return `<div class="action-divider"></div>`;
const on = s.officeModal === a.key;
const badge = a.badge ? `<span class="btn-badge plan-badge">${a.badge}</span>` : "";
const cd = a.countdown ? `<span class="countdown-badge">${a.countdown}</span>` : "";
const cnt = a.count ? `<span class="count-badge">${a.count}</span>` : "";
return `<button class="action-btn${on ? " active" : ""}" data-action="office-modal" data-id="${a.key}" title="${a.label}">
        ${this.icon(a.icon, 20)}<span class="btn-label">${a.label}</span>${badge}${cd}${cnt}
      </button>`;
}).join("");
const seats = sc.seats || [];
const seatMap = this.core.resolveSeats();
const markers = alive.map((e, i) => {
const si = seatMap[e.id];
const seat = (si != null ? seats[si] : null) || { x: 6 + (i % 6) * 17.5, y: 86 + Math.floor(i / 6) * 12 };
const full = !!s.prodFullByEng[e.id];
const st = this.engStatus(e);
const cls = (full ? "full " : "") + (this.isBursting(e) ? "bursting " : "")
+ this.statusCls(st).replace("st-", "");
return `
        <div class="emp-marker ${cls}" style="top:${seat.y}%; left:${seat.x}%;" data-eng="${e.id}">
          <div class="emp-status ${this.statusCls(st)}">${st}</div>
          <button type="button" class="emp-avatar" data-action="om-arrange-menu" data-id="${e.id}" aria-label="安排工程师"><img src="${this.engAvatar(e)}" alt=""></button>
          <button type="button" class="emp-name" data-action="om-arrange-menu" data-id="${e.id}">${e.name}</button>
          <div class="emp-stamina">${this.icon("zap", 14)}<span>${this.engEnergy(e)}</span></div>
          ${this.flameSpans(e.id)}
        </div>`;
}).join("");
const statRow = (k) => {
const v = Math.round(this.modelValue(k, s));
const c = this.modelCap(k) || 1;
const cTxt = Math.round(c);
const pct = Math.max(0, Math.min(100, (v / c) * 100));
const ax = this.core.v35AxisIds && this.core.v35AxisIds(s).indexOf(k) >= 0;
const color=(this.modelDims(s).find(d=>d.key===k)||{}).color;
const style = color ? 'background:'+color : this.core.dimBarStyle(k);
return `
        <div class="stat-item${ax ? " stat-item-axis" : ""}" data-stat="${k}">
          <div class="stat-label"><span>${this.modelLabel(k)}</span><b id="ob-val-${k}">${v} / ${cTxt}</b></div>
          <div class="stat-bar"><span id="ob-pass-${k}">${this.officePassMarker(k)}</span><div class="stat-bar-fill ${this.core.dimBarClass(k)}" id="ob-bar-${k}"${style ? ` style="width:${pct.toFixed(1)}%;${style}"` : ` style="width:${pct.toFixed(1)}%"`}></div></div>
        </div>`;
};
const archName = ((c.ARCHITECTURES || []).find((a) => a.id === s.arch) || {}).name || "—";
const guide = this.core.guidePending && this.core.guidePending();
const guideBanner = guide ? `
      <div class="office-guide-banner" id="ob-guide">
        ${this.icon("help", 14)}<span>新手引导 · ${guide.tip}（完成前游戏暂停）</span>
      </div>` : `<div class="office-guide-banner" id="ob-guide" style="display:none"></div>`;
const main = `
      ${topbar}
      ${guideBanner}
      <div class="main-area">
        <div class="action-col">${actions}</div>
        <div class="office-scene">
          <img class="office-bg" src="${sc.bg || "resource/scene/office_v1.webp"}" alt="办公室" draggable="false"
               onload="if(window.GameUI){window.GameUI.updateOfficeMain();window.GameUI.applyUiScale();}">
          <div class="office-overlay"></div>
          <div class="office-night" id="ob-night"></div>
          <div class="notice-stack" id="ob-notices"></div>
          <div class="employee-markers" id="ob-markers">${markers}</div>
          <div class="office-paused-tag" id="ob-pausedtag"${s.officePaused ? "" : ' style="display:none"'} title="点击继续" data-action="office-pause">⏸ 已暂停 · 点击继续</div>
        </div>
      </div>
      <div class="bottom-panel">
        <div class="model-stats">
          <div class="model-title">
            <div class="model-name">${this.tpl("{model}")} ${(this.core.modelCode() || "V1").toLowerCase()}</div>
            <div class="model-ver" id="ob-ver">${s.paramTarget || 7}B · ${archName}</div>
            <div class="model-sub" id="ob-plan">${s.planDone ? "已立项" : "尚未立项"}</div>
          </div>
          <div class="stats-grid">
            ${this.modelDims(s).map((d) => statRow(d.key)).join("")}
          </div>
        </div>
        ${v35on ? "" : `
        <div class="collect-zone">
          <div class="collect-info">
            <span class="collect-label">待收产出</span>
            <span class="collect-val" id="totalProd"><span id="ob-prod">${this.core.totalProd()}</span><span> 点</span></span>
          </div>
          <button class="skew-btn" data-action="collect-all" style="width:100%;height:42px">
            ${this.icon("download", 14)}<span>全部收集</span></button>
        </div>`}
      </div>`;
const shell0 = this.el.querySelector(".office-shell");
if (shell0) {
const allMc = this.el.querySelectorAll("#modalContainer");
if (allMc.length > 1) {
const keep = allMc[allMc.length - 1];
for (const m of allMc) if (m !== keep) m.remove();
}
const mc = shell0.querySelector("#modalContainer");
if (mc && mc.parentElement !== shell0) shell0.appendChild(mc);
}
const axSig = [s.ver,sc.bg,this.modelDims(s).map(d=>d.key).join(",")].join("|");
if (this._axSig !== axSig) {
this._axSig = axSig;
const om = this.el.querySelector("#officeMain");
if (om) om.remove();
}
const oldMain = this.el.querySelector("#officeMain");
if (oldMain) {
this.updateOfficeMain();
} else {
this.el.innerHTML = `
        <div class="app-shell office-shell">
          <div class="office-scale">
            <div id="officeMain">${main}</div>
          </div>
          <div id="modalContainer"></div>
        </div>`;
}
if (corpusDisp) { const ce = this.el.querySelector("#ob-corpus"); if (ce) ce.textContent = corpusDisp.num; const cu = this.el.querySelector(".corpus-chip i"); if (cu) cu.textContent = this.officeCorpusUnit(corpusDisp.unit); }
this.startOfficeTimer();
this.startOfficeBubbleTimer();
this.applyUiScale();
this.fitOfficeIsland();
this.updateDayNight();
},
seatPosPct(seat) {
const scene = this.el.querySelector(".office-scene");
const img = this.el.querySelector(".office-bg");
if (!seat || !scene || !img || !img.naturalWidth || !img.naturalHeight) {
return seat ? { x: seat.x, y: seat.y } : { x: 30, y: 30 };
}
const Cw = scene.clientWidth, Ch = scene.clientHeight;
const Bw = img.naturalWidth, Bh = img.naturalHeight;
if (!Cw || !Ch) return { x: seat.x, y: seat.y };
const s = Math.min(Cw / Bw, Ch / Bh);
const offX = (Cw - Bw * s) / 2, offY = (Ch - Bh * s) / 2;
const bx = (seat.x / 100) * Bw, by = (seat.y / 100) * Bh;
const cx = bx * s + offX, cy = by * s + offY;
return { x: (cx / Cw) * 100, y: (cy / Ch) * 100 };
},
dateLabel(week) {
if (this.core.embodiedAvailable() && this.core.ensureBodyCalendar()) return this.core.calendarLabel(week);
const d = this.core.cfg.DATE || {};
const y0 = d.START_YEAR != null ? d.START_YEAR : 2023;
const m0 = d.START_MONTH != null ? d.START_MONTH : 6;
const w = Math.max(0, Math.floor(week || 0));
const monthsPassed = Math.floor(w / 4);
const total = (m0 - 1) + monthsPassed;
const year = y0 + Math.floor(total / 12);
const month = (total % 12) + 1;
const weekOfMonth = (w % 4) + 1;
return year + "年" + month + "月 第" + weekOfMonth + "周";
},
absWeek() {
const s = this.core.state || {};
return (s.week || 0) + (s.weekOffset || 0);
},
applyUiScale() {
const shell = this.el && this.el.querySelector(".office-shell");
if (!shell) return;
const elW = this.el.clientWidth || window.innerWidth || 1280;
const elH = this.el.clientHeight || window.innerHeight || 720;
const portrait = this.isPortrait();
const w = portrait ? (shell.clientWidth || elW) : elW;
const h = portrait ? (shell.clientHeight || elH) : elH;
let boxW = 1280, boxH = 720, minS = 0.35, maxS = 3;
if (portrait) {
boxW = PORTRAIT_BOX_W;
boxH = Math.round(Math.max(660, Math.min(1200, boxW * (h / Math.max(1, w)))));
minS = 0.8; maxS = 1.6;
}
const k = Math.max(minS, Math.min(maxS, Math.min(w / boxW, h / boxH)));
const scale = (portrait ? Math.floor(k * 100) : Math.round(k * 100)) / 100;
shell.style.setProperty("--ui-scale", String(scale));
shell.style.setProperty("--box-w", boxW + "px");
shell.style.setProperty("--box-h", boxH + "px");
this._portrait = portrait;
if (shell.dataset.orient !== (portrait ? "portrait" : "landscape")) {
shell.dataset.orient = portrait ? "portrait" : "landscape";
}
this.fitOfficeIsland();
this.applySceneLayout(shell, boxW, boxH, scale);
},
isPortrait() {
try {
if (window.matchMedia) return window.matchMedia("(orientation: portrait)").matches;
} catch (e) { }
return (window.innerWidth || 0) <= (window.innerHeight || 0);
},
applySceneLayout(shell, w, h, scale) {
if (!shell) return;
const img = shell.querySelector(".office-bg");
let r = 4 / 3;
if (img && img.naturalWidth && img.naturalHeight) r = img.naturalWidth / img.naturalHeight;
else if (this._bgRatio) r = this._bgRatio;
if (this.core && this.core.cfg && this.core.scene().layoutRatio) r = this.core.scene().layoutRatio;
this._bgRatio = r;
if (img && img.getAttribute("src")) {
shell.style.setProperty("--scene-bg", "url('" + img.getAttribute("src") + "')");
}
const W = w || 1280, H = h || 720;
const portrait = !!this._portrait;
const islandEl = shell.querySelector(".island-topbar");
const bottomEl = shell.querySelector(".bottom-panel");
const actionEl = shell.querySelector(".action-col");
const PAD = 10, PAD_X = 14, GAP = 10;
const islandH = islandEl && islandEl.offsetHeight ? islandEl.offsetHeight : 48;
const bottomH = bottomEl && bottomEl.offsetHeight ? bottomEl.offsetHeight : 96;
let chromeV = PAD * 2 + islandH + bottomH + GAP * 2;
let chromeH = PAD_X * 2 + 64 + 12;
let actionH = 0;
if (portrait) {
chromeH = PAD_X * 2;
actionH = actionEl && actionEl.offsetHeight ? actionEl.offsetHeight : 96;
chromeV += actionH + 12;
shell.style.setProperty("--modal-top", Math.round((PAD + islandH + GAP) * scale) + "px");
shell.style.setProperty("--modal-bottom", Math.round((PAD + bottomH + GAP) * scale) + "px");
}
const availW = W - chromeH;
const availH = H - chromeV;
if (availW < 40 || availH < 40) return;
let sceneW = Math.max(40, Math.round(Math.min(availW, availH * r)));
if (availW - sceneW > 0 && availW - sceneW <= 3) sceneW = availW;
const sceneH = Math.max(40, Math.round(sceneW / r));
if (portrait) {
const mainTop = PAD + islandH + GAP;
shell.style.setProperty("--guide-top", Math.round(mainTop + actionH + 12 - 4) + "px");
}
if (shell.dataset.sw === String(sceneW) && shell.dataset.sh === String(sceneH)) return;
shell.dataset.sw = String(sceneW); shell.dataset.sh = String(sceneH);
shell.style.setProperty("--scene-w", sceneW + "px");
shell.style.setProperty("--scene-h", sceneH + "px");
},
updateOfficeMain() {
const el = this.el, s = this.core.state, c = this.core.cfg;
const alive = s.engineers.filter((e) => !e.resigned);
const setTxt = (id, v) => { const n = el.querySelector("#" + id); if (n && n.textContent !== String(v)) n.textContent = v; };
const show = (id, on) => { const n = el.querySelector("#" + id); if (n) n.style.display = on ? "" : "none"; };
const dateEl = el.querySelector("#ob-date");
if (dateEl) {
const txt = this.officeDateLabel();
if (dateEl.textContent !== txt) dateEl.textContent = txt;
}
setTxt("ob-funding", fmtMoney(s.funding));
const island = el.querySelector(".island-topbar");
if (island) island.classList.toggle("has-event", this.officeIslandEvent());
const dvEl = el.querySelector("#ob-dividend");
if (dvEl) {
const dv = (s.v35 && s.v35.dividend) || null;
dvEl.style.display = (dv && (dv.left || 0) > 0) ? "" : "none";
}
if (s.lastDividend && s.lastDividend !== s._divToastSeen) {
s._divToastSeen = s.lastDividend;
this.toast("分红 −" + fmtMoney(s.lastDividend.cut));
}
const cd = this.core.v35On && this.core.v35On() ? this.corpusDisplay(s.corpus) : null;
setTxt("ob-corpus", cd ? cd.num : Math.round(s.corpus || 0));
const cUnit = el.querySelector(".corpus-chip i");
if (cd && cUnit) cUnit.textContent = this.officeCorpusUnit(cd.unit);
const gapEl = el.querySelector("#ob-gap");
if (gapEl) { const g = this.v35GapInfo(); gapEl.textContent = g.label; gapEl.className = "corpus-gap " + g.cls; }
const barEl = el.querySelector("#ob-corpus-bar .cm-cursor");
if (barEl && s.v35) {
const need = this.core.corpusDemand();
const pct = (Math.floor(s.v35.corpus.token) / Math.max(1, need)) * 100;
barEl.style.left = Math.min(100, Math.min(pct, 130) / 1.3).toFixed(1) + "%";
}
const brand = el.querySelector("#ob-brand");
if (brand) { brand.textContent = this.brandStars(s.brand); if (brand.parentElement) brand.parentElement.title = this.brandTip(); }
show("ob-warn", (s.fiscalDeficit || 0) > 0);
setTxt("ob-deficit", fmtMoney(s.fiscalDeficit || 0));
this.fitOfficeIsland();
const pause = el.querySelector("#ob-pause");
if (pause) {
pause.title = s.officePaused ? "继续" : "暂停";
pause.innerHTML = this.icon(s.officePaused ? "play" : "pause", 16);
}
const perWeek = (c.OFFICE || {}).ROUNDS_PER_WEEK || 7;
const guideEl = el.querySelector("#ob-guide");
if (guideEl) {
const g = this.core.guidePending && this.core.guidePending();
if (g) {
guideEl.style.display = "";
guideEl.innerHTML = this.icon("help", 14) + `<span>新手引导 · ${g.tip}（完成前游戏暂停）</span>`;
} else guideEl.style.display = "none";
}
this.officeActions().forEach((a) => {
const btn = el.querySelector('.action-btn[data-id="' + a.key + '"]');
if (!btn) return;
btn.classList.toggle("active", s.officeModal === a.key);
const ensureBadge = (sel, cls, text) => {
let n = btn.querySelector(sel);
if (!n) { n = document.createElement("span"); n.className = cls; btn.appendChild(n); }
const t = String(text);
if (n.textContent !== t) n.textContent = t;
return n;
};
const keep = [];
if (a.badge) keep.push(ensureBadge(".plan-badge", "btn-badge plan-badge", a.badge));
if (a.countdown) keep.push(ensureBadge(".countdown-badge", "countdown-badge", a.countdown));
if (a.count) keep.push(ensureBadge(".count-badge", "count-badge", a.count));
const curBadges = [...btn.querySelectorAll(".btn-badge, .countdown-badge, .count-badge")];
curBadges.forEach((n) => { if (keep.indexOf(n) < 0) n.remove(); });
const ordered = keep.length === curBadges.length && keep.every((n, i) => n === curBadges[i]);
if (!ordered) keep.forEach((n) => btn.appendChild(n));
});
const wrap = el.querySelector("#ob-markers");
if (wrap) {
const seats = this.core.scene().seats || [];
const seatMap = this.core.resolveSeats();
const want = {};
alive.forEach((e, i) => {
const si = seatMap[e.id];
const seatRaw = (si != null ? seats[si] : null) || { x: 6 + (i % 6) * 17.5, y: 86 + Math.floor(i / 6) * 12 };
const seat = this.seatPosPct(seatRaw);
want[e.id] = { e, seat, i };
});
wrap.querySelectorAll(".emp-marker").forEach((node) => {
if (!want[node.dataset.eng]) node.remove();
});
Object.keys(want).forEach((id) => {
const { e, seat } = want[id];
let node = wrap.querySelector('.emp-marker[data-eng="' + id + '"]');
const full = !!s.prodFullByEng[id];
const st = this.engStatus(e);
const cls = "emp-marker " + (full ? "full " : "") + (this.isBursting(e) ? "bursting " : "")
+ this.statusCls(st).replace("st-", "");
if (!node) {
node = document.createElement("div");
node.dataset.eng = id;
node.innerHTML = `
            <div class="emp-status ${this.statusCls(st)}"></div>
            <button type="button" class="emp-avatar" data-action="om-arrange-menu" data-id="${e.id}" aria-label="安排工程师"><img src="${this.engAvatar(e)}" alt=""></button>
            <button type="button" class="emp-name" data-action="om-arrange-menu" data-id="${e.id}">${e.name}</button>
            <div class="emp-stamina">${this.icon("zap", 14)}<span></span></div>
            ${this.flameSpans(e.id)}`;
wrap.appendChild(node);
}
node.className = cls;
node.style.top = seat.y + "%";
node.style.left = seat.x + "%";
const p = node.querySelector(".emp-status");
if (p) { p.textContent = st; p.className = "emp-status " + this.statusCls(st); }
const stEl = node.querySelector(".emp-stamina span");
if (stEl) stEl.textContent = this.engEnergy(e);
else {
const box = node.querySelector(".emp-stamina");
if (box) box.innerHTML = this.icon("zap", 14) + "<span>" + this.engEnergy(e) + "</span>";
}
});
}
show("ob-pausedtag", !!s.officePaused);
const cap = this.core.statCap();
this.modelDims(s).forEach(({key:k}) => {
const v = Math.round(this.modelValue(k, s)), top = this.modelCap(k);
const pct = Math.max(0, Math.min(100, (v / (top || 1)) * 100)).toFixed(1);
setTxt("ob-val-" + k, v + " / " + Math.round(top));
const bar = el.querySelector("#ob-bar-" + k);
if (bar) bar.style.width = pct + "%";
const marker = el.querySelector("#ob-pass-" + k);
if (marker) { const html=this.officePassMarker(k); if(marker.innerHTML!==html) marker.innerHTML=html; }
});
const archName = ((c.ARCHITECTURES || []).find((a) => a.id === s.arch) || {}).name || "—";
setTxt("ob-ver", (s.paramTarget || 7) + "B · " + archName);
setTxt("ob-plan", s.planDone ? "已立项" : "尚未立项");
setTxt("ob-prod", this.core.totalProd());
},
brandStars(brand) {
const c = this.core ? this.core.cfg : {};
const base = c.BRAND_STAR_BASE != null ? c.BRAND_STAR_BASE : 80;
const step = c.BRAND_STAR_STEP != null ? c.BRAND_STAR_STEP : 20;
const n = this.core && this.core.brandStarsCount ? this.core.brandStarsCount(brand)
: Math.max(0, Math.min(5, 1 + Math.floor(((brand || 0) - base) / Math.max(1, step))));
return "★".repeat(n) + "☆".repeat(5 - n);
},
brandTip() {
if (!this.core.brandProgress) return "品牌影响事件机遇与阶段结算收益";
const p = this.core.brandProgress();
return "品牌值 " + Math.round(p.value) + " · " + p.stars + " 星"
+ (p.next != null ? " · 下一星 " + Math.ceil(p.next) : " · 已达最高星级")
+ " · 阶段主奖金 +" + Math.round(p.rate * 100) + "%"
+ (p.value >= p.stageCap && p.stars < 5 ? " · 本阶段品牌已满，推进版本继续成长" : "");
},
statLabel(k) {
return this.core && this.core.statLabel ? this.core.statLabel(k) : ({ code: "代码", text: "文字", safety: "安全", stability: "稳定" })[k] || k || "—";
},
engAvatar(e) {
if (e.avatar) return e.avatar;
const i = (e.avatarIdx != null ? e.avatarIdx : 0);
return "resource/ui/avatar_" + (Math.abs(i) % 100) + ".webp";
},
flameSpans(id) {
let h = 0;
for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 9973;
let out = '<div class="flame-fx" aria-hidden="true">';
for (let i = 0; i < 8; i++) {
const xl = ((h + i * 37) % 45) - 22;
const sz = 8 + ((h + i * 29) % 7);
const dx = ((h + i * 13) % 13) - 6;
const dur = (0.55 + ((h + i * 17) % 40) / 100).toFixed(2);
const dl = (-((h + i * 23) % 70) / 100).toFixed(2);
out += `<span class="flame-p" style="--xl:${xl}px;--sz:${sz}px;--dx:${dx}px;--dur:${dur}s;--dl:${dl}s"></span>`;
}
return out + "</div>";
},
startOfficeTimer() {
if (this._officeTimer) return;
const tick = (this.core.cfg.OFFICE || {}).TICK_MS || 1000;
this._officeTimer = setInterval(() => {
const s = this.core.state;
if (!s || s.phase !== "office") return;
const rescue = this.core.pendingBailoutEvent();
if (rescue && !this.el.querySelector("#ob-evspawn") && this.el.querySelector(".office-shell")) {
if (window.OfficePause) OfficePause.releaseSource(this.core, "event");
this.showOfficeEvent(rescue);
}
if (s.officePaused) return;
this.whalebeeTick(s);
this.updateDayNight();
let r;
try {
r = this.core.officeTick(Date.now());
this._tickFails = 0;
} catch (err) {
console.error("[officeTick] 时间推进异常：", err);
this._tickFails = (this._tickFails || 0) + 1;
if (this._tickFails >= 3) {
if (!this._tickRecovered) {
this._tickRecovered = true;
this.recoverFromStageAnchor();
} else if (this._tickFails % 15 === 0) {
this.toast("⚠️ 时间推进异常持续存在，建议「重新开始游戏」或回滚到手动存档");
}
} else {
this.toast("⚠️ 时间推进异常：" + (err && err.message ? err.message : err));
}
return;
}
this.updateOfficeMain();
if (r) {
this.render({ soft: true });
this.renderOfficeFloats(r.floats);
if (r.notices && r.notices.length) r.notices.forEach((n) => this.pushNotice(n));
if (r.event) this.showOfficeEvent(r.event);
if (r.vigour) this.toast("🔥 全员灵感迸发！体力 -15，本阶段词条升级概率 ×1.5");
if (r.bursts && r.bursts.length) {
for (const b of r.bursts) this.toast(`🔥 ${b.name} 进入爆发状态！接下来产出翻倍`);
if (window.SFX) SFX.play("fanfare", { vol: 0.55 });
}
if (r.milestone) this.toast("🏆 里程碑达成：二测达标，母公司奖励 30 万");
if (r.bankrupt) this.toast("⚠️ 经费见底！再这样下去公司要完了");
if (r.bankruptWarn) {
this.toast(r.bankruptWarn.text);
this.save.autoSave(s);
}
if (r.arrive) r.arrive.forEach((m) => this.toast(m));
if (r.restBack && r.restBack.length) r.restBack.forEach((n) => this.toast("☀️ " + n + " 休息归来，体力已恢复"));
if (r.hire && r.hire.found === false && window.V35Hire && typeof V35Hire.retryNotice === "function") {
const text = V35Hire.retryNotice(this.core);
if (text) this.toast(text);
}
if (r.toast) this.toast(r.toast);
if (r.paperUnlocked && r.paperUnlocked.length) this.toast("🔓 论文解锁新架构：" + r.paperUnlocked.join("、") + "（已可用于下一阶段立项）");
if (r.openModal && !s.officeModal) {
s.officeModal = r.openModal;
this.render({ soft: true });
}
if (r.weekUp && !r.event) {
const kind = this.minigameTrigger();
if (kind) {
s.minigameDone[kind.toUpperCase()] = true;
this.showMinigameSpawn(kind);
return;
}
}
if (!r.bailoutPending) this.save.autoSave(s);
}
}, tick);
},
recoverFromStageAnchor() {
const snap = (this.save && this.save.loadStage) ? this.save.loadStage() : null;
if (!snap || !snap.state || !snap.state.phase) {
this.toast("⚠️ 连续检测到时间推进异常，且没有本阶段锚点存档——请到「存档」手动回滚或重新开始");
return;
}
try {
this.core.restore(snap.state);
} catch (e) {
console.error("[recoverFromStageAnchor] 锚点恢复失败：", e);
this.toast("⚠️ 锚点恢复失败，请到「存档」手动回滚或重新开始");
return;
}
this._tickFails = 0;
this._modal = null;
this.core.state.officeModal = null;
this.save.autoSave(this.core.state);
this.render();
this.toast("🛟 检测到存档异常，已自动回到本阶段开头（每个阶段开始都会自动存一份锚点）");
},
minigameTrigger() {
const s = this.core.state, c = this.core.cfg;
if (this.core.embodiedAvailable(s)) { this.core.retireLegacyMinigame(s); return null; }
const trg = (c.MINIGAMES || {}).TRIGGER || {};
s.minigameDone = s.minigameDone || {};
for (const kind of Object.keys(trg)) {
const t = trg[kind];
if (!t || s.minigameDone[kind]) continue;
if (s.ver !== t.ver || s.week < t.week) continue;
const needRole = t.needRole || "post";
if (!(s.engineers || []).some((e) => !e.resigned && this.core.v35RoleOf(e) === needRole
&& (e.joinTick == null || (s.v35 && s.v35.tick >= e.joinTick)))) continue;
return kind.toLowerCase();
}
return null;
},
showMinigameSpawn(kind) {
const s = this.core.state;
if (this.core.embodiedAvailable(s)) { this.core.retireLegacyMinigame(s); return null; }
if (this.el.querySelector("#ob-evspawn")) return;
const meta = this.minigameMeta(kind);
const wasPaused = !!s.officePaused;
const div = document.createElement("div");
div.id = "ob-evspawn";
div.className = "ev-spawn";
div.innerHTML = `
      <div class="ev-morph">
        <div class="ev-rings"><i></i><i></i><i></i></div>
        <img class="ev-ic" src="resource/ui/favicon.png" alt="" aria-hidden="true">
        <div class="ev-capsule-title">${meta.title}</div>
        <div class="ev-body">
          <div class="ev-title">${meta.kicker}</div>
          <div class="ev-text">${meta.sub}</div>
          <div class="ev-opts"><button class="ev-opt" data-mgstart="1">开始巡检 ➜</button></div>
        </div>
      </div>
      <div class="ev-hint">触发巡检（点开始后暂停时间）</div>`;
this.el.appendChild(div);
div.querySelector(".ev-morph").addEventListener("click", () => {
if (div.classList.contains("expand")) return;
div.classList.add("expand");
setTimeout(() => div.classList.add("open"), 480);
});
div.querySelector("[data-mgstart]").addEventListener("click", () => {
if (!window.OfficePause) s.officePaused = wasPaused;
div.classList.add("bye");
setTimeout(() => div.remove(), 380);
this.core.startMinigame(kind);
if (window.SFX) SFX.play("fanfare", { vol: 0.5 });
this.save.autoSave(s);
this.render({ soft: true });
this.updateOfficeMain();
});
return div;
},
dayNightAmount() {
const c = this.core.cfg, s = this.core.state;
const V = c.V35 || {}, D = V.DAYNIGHT || {};
if (D.ENABLED === false) return 0;
const st = s.v35;
if (!st) return 0;
const offS = V.OFF_START != null ? V.OFF_START : 18;
const offL = V.OFF_LEN != null ? V.OFF_LEN : 3;
const fade = D.FADE_TICKS != null ? D.FADE_TICKS : 1;
if (fade <= 0) return 0;
let t = st.tick || 0;
if (s._tickAt) {
const ms = Math.max(1000, (V.TICK_S || 10) * 1000);
t += Math.min(1, Math.max(0, (Date.now() - s._tickAt) / ms));
}
const a = offS - fade, b = offS, ce = offS + offL, d = ce + fade;
if (t <= a) return 0;
if (t < b) return (t - a) / fade;
if (t < ce) return 1;
if (t < d) return 1 - (t - ce) / fade;
return 0;
},
updateDayNight() {
const el = this.el && this.el.querySelector("#ob-night");
if (!el) return;
const D = (this.core.cfg.V35 || {}).DAYNIGHT || {};
const max = D.MAX_OPACITY != null ? D.MAX_OPACITY : 0.6;
el.style.opacity = (this.dayNightAmount() * max).toFixed(3);
},
whalebeeWait(c) {
const a = c.INTERVAL_MIN != null ? c.INTERVAL_MIN : 30;
const b = Math.max(a, c.INTERVAL_MAX != null ? c.INTERVAL_MAX : 90);
return Math.round(a + Math.random() * (b - a));
},
whalebeeTick(s) {
const c = (this.core.cfg || {}).WHALEBEE;
if (!c || c.ENABLED === false) return;
this._beeWait = this._beeWait == null ? this.whalebeeWait(c) : this._beeWait - 1;
if (this._beeWait > 0) return;
this._beeWait = this.whalebeeWait(c);
this.spawnWhalebee(c, s);
},
spawnWhalebee(c, s) {
const shell = this.el.querySelector(".office-shell");
if (!shell || shell.querySelector(".whalebee")) return;
const img = document.createElement("img");
img.className = "whalebee";
img.src = c.IMG || "resource/character/比耶.webp";
img.alt = "鲸bee";
img.draggable = false;
const size = c.SIZE || 56;
img.style.width = size + "px";
img.style.height = size + "px";
img.style.left = (5 + Math.random() * 80).toFixed(1) + "%";
img.style.setProperty("--bee-fall", (c.FALL_MS || 9000) + "ms");
img.addEventListener("click", () => {
const v = Math.round((c.REWARD_MIN != null ? c.REWARD_MIN : 10000)
+ Math.random() * ((c.REWARD_MAX != null ? c.REWARD_MAX : 30000) - (c.REWARD_MIN != null ? c.REWARD_MIN : 10000)));
s.funding += v;
if (window.SFX) SFX.play("float");
this.toast("🐝 捡到鲸bee！经费 +" + fmtMoney(v));
this.save.autoSave(s);
img.remove();
});
img.addEventListener("animationend", () => img.remove());
let layer = shell.querySelector(".whalebee-layer");
if (!layer) {
layer = document.createElement("div");
layer.className = "whalebee-layer";
shell.appendChild(layer);
}
layer.appendChild(img);
},
playTransition() {
const c = (this.core.cfg.TRANSITION || {});
if (c.ENABLED === false) return;
const bars = c.BARS || 7;
const colors = c.COLORS || ["#6fc3ff", "#ff9ad5", "#7ed4b0", "#ffcf8a", "#a78bfa"];
const ms = c.MS || 620;
const stagger = c.STAGGER != null ? c.STAGGER : 45;
const thick = (100 / bars) * 1.35;
const wrap = document.createElement("div");
wrap.className = "dg-transition";
wrap.innerHTML = Array.from({ length: bars }, (_, i) => {
const top = i * (100 / bars) - (thick - 100 / bars) / 2;
return `<i style="--bar-bg:${colors[i % colors.length]};--bar-h:${thick}vh;`
+ `--bar-top:${top}vh;--bar-ms:${ms}ms;--bar-delay:${i * stagger}ms"></i>`;
}).join("");
(document.body || this.el).appendChild(wrap);
setTimeout(() => wrap.remove(), ms + bars * stagger + 320);
},
openSettingsPop() {
if (this.el.querySelector("#settingsPop")) return;
let mv = 0.6, sv = 0.9;
try {
mv = parseFloat(localStorage.getItem("whale_music_vol") || "0.6");
sv = parseFloat(localStorage.getItem("whale_sfx_vol") || "0.9");
} catch (e) {}
const row = (kind, label, v) => `
      <div class="set-row">
        <div class="set-label"><span>${label}</span><b id="set-vol-${kind}-val">${Math.round(v * 100)}%</b></div>
        <input class="set-range" type="range" min="0" max="1" step="0.05" value="${v}" data-kind="${kind}">
      </div>`;
const div = document.createElement("div");
div.id = "settingsPop";
div.className = "set-pop-mask";
div.innerHTML = `
      <div class="sub-modal-card">
        <div class="sub-modal-header">
          <div class="sub-modal-title">${this.icon("settings", 14)}<span>设置</span></div>
          <button class="modal-close" data-action="settings-close" title="关闭">${this.icon("x", 13)}</button>
        </div>
        <div class="sub-modal-body set-body">
          ${row("music", "背景音乐", mv)}
          ${row("sfx", "音效", sv)}
          <div class="set-tip">音量会自动保存到本机。</div>
        </div>
        <div class="sub-modal-footer">
          <button class="skew-btn" data-action="open-codex">📖 模型库</button>
          <button class="skew-btn ghost" data-action="ask-newgame">🔁 重新开始</button>
          <button class="skew-btn ghost" data-action="settings-close">关闭</button>
        </div>
      </div>`;
this.el.appendChild(div);
const apply = (kind, v) => {
try { localStorage.setItem(kind === "music" ? "whale_music_vol" : "whale_sfx_vol", String(v)); } catch (e) {}
if (kind === "music") {
if (window.AudioMgr) AudioMgr.setMusicVolume(v);
}
if (kind === "sfx" && window.SFX && SFX.setVolume) SFX.setVolume(v);
const lab = div.querySelector("#set-vol-" + kind + "-val");
if (lab) lab.textContent = Math.round(v * 100) + "%";
};
div.querySelectorAll("input.set-range").forEach((r) => {
r.addEventListener("input", () => apply(r.dataset.kind, Math.max(0, Math.min(1, +r.value))));
});
},
cdxThumbMode() {
const w = window.innerWidth || 0, h = window.innerHeight || 0;
if (!w || !h) return false;
return h >= w && Math.min(w, h) <= 560;
},
openCodexPop() {
const old = this.el.querySelector("#codexPop");
if (old) old.remove();
const s = this.core.state, c = this.core.cfg;
const codex = (s.codex && typeof s.codex === "object") ? s.codex : {};
const V = { pass: "合格", excellent: "优秀", top: "顶尖" };
const VCLS = { pass: "", excellent: " exc", top: " top" };
const PASS_LIKE = ["pass", "excellent", "top"];
const H = (x) => String(x == null ? "" : x)
.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const archName = (id) => (((c.ARCHITECTURES || []).find((a) => a.id === id) || {}).name || id);
const vorder = c.VER_ORDER || [];
const vIdx = (v) => { const i = vorder.indexOf(v); return i < 0 ? vorder.length : i; };
const list = Object.keys(codex)
.map((k) => Object.assign({ key: k }, codex[k]))
.filter((e) => e && e.best && PASS_LIKE.indexOf(e.best.verdict) >= 0)
.sort((a, b) => (vIdx(a.best && a.best.ver) - vIdx(b.best && b.best.ver))
|| (a.param - b.param)
|| String(a.arch).localeCompare(String(b.arch)));
let times = 0, best = null;
for (const k of Object.keys(codex)) {
const e = codex[k];
times += (e && e.times) || 0;
if (e && e.best && (!best || e.best.score > best.score)) best = e.best;
}
const PER = this.codexPerPage(); this._cdxPer=PER;
if (this._cdxPage == null) this._cdxPage = 0;
const total = Math.max(1, Math.ceil(list.length / PER));
let page = Math.min(Math.max(0, this._cdxPage), total - 1);
this._cdxPage = page;
const pageList = list.slice(page * PER, page * PER + PER);
const thumb = this.cdxThumbMode();
const cardOf = (e, opts) => {
const b = e.best;
const act = thumb && !(opts && opts.detail) ? ` data-action="codex-open" data-id="${H(e.key)}"` : "";
const axIds = this.axesOf(e.arch, e.param, b.ver);
const cardState = Object.assign({}, b, {arch:e.arch,paramTarget:e.param});
const dims = this.modelDims(cardState).map(d=>d.key);
return `
        <div class="cdx-card${VCLS[b.verdict] || ""}"${act}>
          <div class="cdx-card-inner">
            <div class="cdx-card-top">
              <span class="cdx-card-name" title="${H(b.name) || "—"}">${H(b.name) || "—"}</span>
              <span class="cdx-vd">${V[b.verdict] || b.verdict || "—"}</span>
            </div>
            <div class="cdx-card-score">
              <b>${Math.round(b.score || 0)}</b><small>综合评分</small>
            </div>
            <div class="cdx-card-sub">
              <b>${archName(e.arch)}</b><i>·</i><b>${e.param}B</b><i>·</i><span>${H(b.ver || "")}</span>
            </div>
            <div class="cdx-card-bars">
              ${dims.map((k) => `<span class="cdx-dim${axIds.indexOf(k) >= 0 ? " ax" : ""}">
                <i>${this.modelLabel(k)}</i><b>${Math.round(this.modelValue(k,b))}</b></span>`).join("")}
            </div>
            <div class="cdx-card-times">${e.times > 1 ? "训练 " + e.times + " 次" : "初训"}</div>
          </div>
        </div>`;
};
const cards = pageList.length
? `<div class="cdx-cards${thumb ? " is-thumb" : ""}">${pageList.map((e) => cardOf(e)).join("")}</div>`
: `<div class="cdx-empty">还没有通过评审的模型——跑完一次评审（合格及以上）就会收录到这里。</div>`;
this._cdxList = list;
this._cdxCardOf = cardOf;
const logRows = (s.codexLog || []).slice(-3).reverse().map((x) => {
const ad = (c.ARCHITECTURES || []).find((a) => a.id === x.arch);
return `<div class="cdx-log-row">
        <span class="cdx-log-ver">${x.ver}</span>
        <span class="cdx-log-name">${H(x.name) || "—"}</span>
        <span class="cdx-log-arch">${ad ? ad.name : H(x.arch)} · ${x.param}B</span>
        <span class="cdx-log-score">${Math.round(x.score || 0)}</span>
        <span class="cdx-log-vd v-${x.verdict || ""} ${VCLS[x.verdict] ? VCLS[x.verdict].trim() : ""}">${V[x.verdict] || x.verdict || "—"}</span>
      </div>`;
}).join("");
const log = logRows || `<div class="cdx-empty">还没有训练记录——跑完一次评审就会收录。</div>`;
const stat = `<span class="cdx-stat-item">已通过 <b>${list.length}</b> 种组合</span>`
+ `<span class="cdx-stat-item">共训练 <b>${times}</b> 次</span>`
+ (best ? `<span class="cdx-stat-item gold">最高 <b>${Math.round(best.score || 0)}</b> 分 · ${H(best.name) || "—"}</span>` : "");
const div = document.createElement("div");
div.id = "codexPop";
div.className = "set-pop-mask";
div.innerHTML = `
      <div class="sub-modal-card codex-card">
        <div class="sub-modal-header">
          <div class="sub-modal-title">${this.icon("book", 14)}<span>模型库</span></div>
          <button class="modal-close" data-action="codex-close" title="关闭">${this.icon("x", 13)}</button>
        </div>
        <div class="sub-modal-body set-body">
          <div class="cdx-stat">${stat}</div>
          ${cards}
          <div class="gcf-subhead">训练流水（最近 3 条 · 位置留给卡片放数值）</div>
          <div class="cdx-log">${log}</div>
        </div>
        <div class="sub-modal-footer codex-footer">
          <div class="cdx-pager">
            <button class="skew-btn ghost sm" data-action="codex-page" data-id="-1" title="上一页"${page <= 0 ? " disabled" : ""}>${this.icon("chevL", 14)} 上一页</button>
            <span class="cdx-pageno">${page + 1} / ${total}</span>
            <button class="skew-btn ghost sm" data-action="codex-page" data-id="1" title="下一页"${page >= total - 1 ? " disabled" : ""}>下一页 ${this.icon("chevR", 14)}</button>
          </div>
          <button class="skew-btn ghost" data-action="codex-close">关闭</button>
        </div>
        <!-- 缩略模式下点卡打开的「详细卡」浮层：与成就墙 .achv-wall-detail 同款做法 ——
             它是 .sub-modal-card（position:relative + overflow:hidden）的直接子节点 ⇒ 裁在弹窗内；
             盖满整张弹窗 ⇒ 点任意处都能关（绑定见下方 openCodexDetail / codex-detail-close）。 -->
        <div class="cdx-detail" id="cdxDetail" data-action="codex-detail-close" hidden></div>
      </div>`;
this.el.appendChild(div);
},
codexGoto(delta) {
const list = this._cdxList || [];
const PER = this.codexPerPage(); this._cdxPer=PER;
const total = Math.max(1, Math.ceil(list.length / PER));
const page = Math.min(Math.max(0, (this._cdxPage || 0) + delta), total - 1);
if (page === this._cdxPage) return;
this._cdxPage = page;
const pop = this.el.querySelector("#codexPop");
if (!pop) return;
const wrap = pop.querySelector(".cdx-cards");
if (wrap && this._cdxCardOf) {
wrap.innerHTML = list.slice(page * PER, page * PER + PER).map((e) => this._cdxCardOf(e)).join("");
this.closeCodexDetail();
wrap.style.setProperty("--cdx-dir", (delta > 0 ? 18 : -18) + "px");
wrap.classList.remove("flip");
void wrap.offsetWidth;
wrap.classList.add("flip");
}
const pageno = pop.querySelector(".cdx-pageno");
if (pageno) pageno.textContent = (page + 1) + " / " + total;
const btns = pop.querySelectorAll('[data-action="codex-page"]');
if (btns[0]) btns[0].disabled = page <= 0;
if (btns[1]) btns[1].disabled = page >= total - 1;
},
openCodexDetail(key) {
const e = (this._cdxList || []).find((x) => x.key === key);
const box = this.el.querySelector("#codexPop .cdx-detail");
if (!e || !box || !this._cdxCardOf) return;
box.innerHTML = this._cdxCardOf(e, { detail: true });
box.hidden = false;
},
closeCodexDetail() {
const box = this.el.querySelector("#codexPop .cdx-detail");
if (!box) return;
box.hidden = true;
box.innerHTML = "";
},
namingPerPage() { const w=window.innerWidth,h=window.innerHeight; return w>h&&h<=450 ? (w<700?6:12) : w<=450?6:18; },
renderNaming() {
const c = this.core.cfg;
const s = this.core.state;
const def = c.MODEL_NAME_DEFAULT || "小鲸鱼";
const pool = (c.MODEL_NAME_SUGGEST || []).map((n) => String(n == null ? "" : n).trim()).filter(Boolean);
const cur = pool.indexOf(s.modelName) >= 0 ? s.modelName : (pool[0] || def);
if (pool.length) this.core.setModelName(cur);
const per=this.namingPerPage();
if(this._namingState!==s||this._namingPer!==per){this._namePage=Math.floor(Math.max(0,pool.indexOf(cur))/per);this._namingState=s;this._namingPer=per;}
const pages=Math.max(1,Math.ceil(pool.length/per));this._namePage=Math.max(0,Math.min(pages-1,this._namePage||0));
const cards = pool.slice(this._namePage*per,(this._namePage+1)*per).map((n) => {
const on = n === cur;
return `<button class="dg-name-card${on ? " is-on" : ""}" type="button" aria-pressed="${on}"
        data-action="name-pick" data-name="${this.escHtml(n)}">${this.escHtml(n)}</button>`;
}).join("");
const grid = pool.length ? cards
: `<div class="dg-name-empty">还没有配置预设名字，点「就叫这个」会直接用「${this.escHtml(def)}」。</div>`;
this.el.innerHTML = `
      <div class="dg-naming-wrap">
        <div class="dg-board dg-naming">
          <div class="dg-board-title-row">
            <div>
              <span class="dg-kicker">${this.icon("star", 15)} 一切的开始</span>
              <h1 class="dg-board-title">给你的模型起个名字</h1>
              <p class="dg-board-sub">这个名字会跟着它走过每一次评审、每一条新闻、每一个结局。<br>想好了再定哦——当然，中途改主意也没人拦你。</p>
            </div>
          </div>
          <div class="dg-content-layout">
            <aside class="dg-portrait-slot" aria-label="鲸鱼娘立绘">
              <img class="dg-portrait-img" src="${(c.UI_PORTS || {}).naming || this.portraitSrc("recruit")}" alt="鲸鱼娘">
              <span class="dg-portrait-tag u-recruit">${this.icon("users", 13)} 待命名</span>
            </aside>
            <div class="dg-naming-body">
              <div class="dg-name-actions">
                <span class="dg-name-label">模型名称 · 挑一个</span>
                <button class="dg-btn" type="button" data-action="name-random">${this.icon("refresh", 13)} 随机一个</button>
              </div>
              <div class="dg-name-grid">${grid}</div>
              ${pages>1?`<nav class="dg-name-pager" aria-label="预设名字分页"><button type="button" class="dg-btn" data-action="name-page" data-step="-1" ${this._namePage===0?"disabled":""}>${this.icon("chevL",12)}</button><span>${this._namePage+1} / ${pages}</span><button type="button" class="dg-btn" data-action="name-page" data-step="1" ${this._namePage===pages-1?"disabled":""}>${this.icon("chevR",12)}</button></nav>`:""}
              <p class="dg-name-tip">${this.icon("info", 12)} 点一张卡就选定它，名字会出现在之后所有的文案里。</p>
            </div>
          </div>
          <footer class="dg-recruit-footer">
            <div class="dg-register-status">
              <span class="dg-register-hint">V1 · 预训练阶段</span>
              <span class="dg-soft-tag">${this.icon("shield", 12)} 教学关，一定能过</span>
            </div>
            <div class="dg-footer-actions">
              <button class="dg-btn dg-btn-primary dg-next-btn" type="button" data-action="name-confirm">
                就叫这个！开始立项 ${this.icon("chevR", 14)}</button>
            </div>
          </footer>
        </div>
      </div>`;
},
avgTalent(list) {
const arr = list || (this.core.state.engineers || []).filter((e) => !e.resigned);
if (!arr.length) return 0;
const sum = arr.reduce((a, e) => {
const ks=this.core.engStatKeys(e);
const st = e.stats || {};
return a + ks.reduce((b, k) => b + (st[k] || 0), 0) / ks.length;
}, 0);
return Math.round(sum / arr.length);
},
isBursting(e) {
const core = this.core;
if (!core || !core.burstActive || !core.v35RoleOf) return false;
if (!e || e.resigned) return false;
const st = core.state && core.state.v35;
if (st && e.joinTick != null && (st.tick || 0) < e.joinTick) return false;
const role = core.v35RoleOf(e);
return !!role && core.burstActive(role, e);
},
statusBars(e) {
const st = this.core.cfg.ENG_STATUS || {};
this.core.ensureStatus(e);
const rows = [
{ k: "energy", icon: "💚", name: "体力", warn: st.WARN_ENERGY != null ? st.WARN_ENERGY : 50, danger: st.LOW_ENERGY != null ? st.LOW_ENERGY : 30 },
];
return `<div class="dg-statusbars">${rows.map((r) => {
const v = this.core.clampNum(this.statusVal(e, r.k), 0, 100);
const lvl = v <= r.danger ? "bad" : (v <= r.warn ? "warn" : "ok");
const risk = v < r.danger ? " dg-status-risk" : "";
return `
        <div class="dg-statusbar dg-status-${lvl}${risk}">
          <span class="dg-status-icon">${r.icon}</span>
          <span class="dg-status-name">${r.name}</span>
          <span class="dg-status-track"><span class="dg-status-fill" style="width:${v}%"></span></span>
          <span class="dg-status-val">${v}</span>
        </div>`;
}).join("")}</div>`;
},
engCard(e, small) {
const s = this.core.state;
const tag = e.resigned ? '<span class="dg-dim">（已离职）</span>' : "";
const lv = (e.traits || []).filter((t) => t.type !== "engineer").map((t) => `${this.traitName(t.type)}Lv${t.level}`).join(" ");
const tier = this.core.tierOf(e);
const mini = ["code", "text"].map((k) => {
const v = (e.stats && e.stats[k]) != null ? Math.min(100, e.stats[k]) : 0;
return `
        <div class="dg-statbar dg-statbar-mini">
          <span class="dg-statbar-label">${this.statName(k)}</span>
          <span class="dg-statbar-track ${this.typeColor(e.type)}"><span class="dg-statbar-fill ${this.typeColor(e.type)}" style="width:${v}%"></span></span>
          <span class="dg-statbar-val">${v}</span>
        </div>`;
}).join("");
const status = this.statusBars(e);
let ops = "";
if (!small && !e.resigned) {
const canFire = this.core.canFireEngineer(s);
const fireOk = canFire;
const fireTip = fireOk ? "辞退（不可撤销，赔付 2 倍月薪）" : "不能辞退最后一名工程师";
ops = `
        <div class="dg-eng-ops">
          <button class="dg-btn dg-btn-sm dg-btn-ghost dg-btn-danger" type="button" data-action="fire" data-id="${e.id}"
            ${fireOk ? "" : "disabled"} title="${fireTip}">🚪 辞退</button>
        </div>`;
}
return `
      <div class="dg-card dg-eng dg-type-${e.type} dg-tier-${tier.clsKey}${e.resigned ? " dg-dim-card" : ""}">
        <div class="dg-eng-head">
          <img class="dg-avatar dg-avatar-sm" src="${e.avatar || ""}" alt="">
          <div>
            <div class="dg-cand-name">${e.name}<span class="dg-dim"> ${e.gender || ""}·${e.age || "?"}岁</span>${tag}</div>
            <div class="dg-dim">${this.typeName(e.type)} · ${lv}</div>
          </div>
          <span class="dg-tier-badge dg-tier-badge-sm ${tier.cls}">${this.core.tierLabel(e)}</span>
        </div>
        ${mini ? `<div class="dg-statbars dg-statbars-mini">${mini}</div>` : ""}
        ${status}
        ${ops}
      </div>`;
},
minigameMeta(kind) {
return kind === "sft"
? { title: "SFT · 数据质检", kicker: "后训练 · 监督微调", icon: "database",
sub: "下面是候选的训练样本，点掉不合格的、留下值得教的——SFT 的质量全看这一步。",
pickTip: "选出值得进 SFT 数据集的回答", optLabel: ["样本一", "样本二", "样本三"] }
: { title: "RM · 偏好排序", kicker: "后训练 · 奖励模型", icon: "target",
sub: "同一问题有 4 个回答，按「好 → 差」依次点选排位——你的排序就是奖励模型的训练信号。",
pickTip: "按 好 → 差 依次点击排位", optLabel: ["回答 A", "回答 B", "回答 C", "回答 D"] };
},
minigameBodyHTML() {
const s = this.core.state;
if (s.minigame) return this.minigameQuizHTML(s.minigame);
const sm = this._mgSummary;
if (sm) return this.minigameSummaryHTML(sm);
return `<div class="om-empty-tip">本次巡检已完成，时间已恢复流动。</div>`;
},
minigameQuizHTML(m) {
const c = this.core.cfg;
const meta = this.minigameMeta(m.kind);
const bank = m.kind === "sft" ? (c.SFT_DATA || []) : (c.RM_SETS || []);
const item = bank[m.order[m.round]];
if (!item) return `<div class="om-empty-tip">巡检数据加载失败</div>`;
const done = !!m.picked;
const order = (m.optOrder && m.optOrder[m.round]) || [];
let opts = "";
if (m.kind === "sft") {
opts = order.map((choice, i) => {
const src = choice === 0 ? item.good : item.bads[choice - 1];
const mark = done ? (choice === 0 ? " good" : " bad") : "";
const sel = done && m.picked.idx === i ? " picked" : "";
const why = done && m.picked.idx === i
? `<span class="dg-mg-why">${m.picked.ok ? "✅ " : "❌ "}${m.picked.why}</span>`
: (done ? `<span class="dg-mg-why">${choice === 0 ? "✅ " + item.good.why : "❌ " + src.why}</span>` : "");
return `<button class="dg-mg-opt${mark}${sel}" type="button" data-action="mg-pick" data-id="${i}" ${done ? "disabled" : ""}>
          <span class="dg-mg-opt-head">
            <span class="dg-mg-opt-tag">${meta.optLabel[i]}</span>${why}
          </span>
          <span class="dg-mg-opt-text">${src.t}</span>
        </button>`;
}).join("");
} else {
const ranked = m.rank || [];
const n = order.length;
opts = order.map((choice, i) => {
const pos = ranked.indexOf(i);
const isRanked = pos >= 0;
const it = item.items[choice];
const verdict = done ? `<span class="dg-mg-why">${it.why}</span>` : "";
return `<button class="dg-mg-opt rank${isRanked ? " ranked" : ""}" type="button"
          data-action="${done ? "" : "mg-rank"}" data-id="${i}" ${done || isRanked ? "disabled" : ""}>
          <span class="dg-mg-opt-head">
            <span class="dg-mg-opt-tag">${isRanked ? "第 " + (pos + 1) + " 名" : meta.optLabel[i]}</span>${verdict}
          </span>
          <span class="dg-mg-opt-text">${it.t}</span>
        </button>`;
}).join("");
}
const dots = Array.from({ length: m.total }, (_, i) =>
`<span class="dg-mg-dot${i < m.round ? " on" : ""}${i === m.round ? " cur" : ""}"></span>`).join("");
let rankBar = "";
if (m.kind === "rm") {
const ranked = m.rank || [];
const slots = order.map((_, i) => `<span class="rk-slot${i < ranked.length ? " fill" : ""}">${i < ranked.length ? (i + 1) : "·"}</span>`).join("");
const full = ranked.length >= order.length;
rankBar = `<div class="dg-mg-rankbar">
        <span class="rk-label">排位：</span>${slots}
        ${(ranked.length && !done) ? `<button class="dg-btn dg-btn-sm dg-btn-ghost dg-mg-reset" type="button" data-action="mg-reset-rank">重排</button>` : ""}
        <button class="dg-btn dg-btn-primary dg-mg-submit" type="button" data-action="mg-submit" ${full && !done ? "" : "disabled"}>提交排序</button>
      </div>`;
}
return `
      <div class="dg-mg-card">
        <div class="dg-mg-kicker">${meta.kicker}</div>
        <div class="dg-mg-title">${meta.title}</div>
        <div class="dg-mg-head">
          <div class="dg-mg-q">${item.q}</div>
          <div class="dg-mg-dots">${dots}<b class="dg-mg-score">答对 ${m.hits}/${m.round + (done ? 1 : 0)}</b></div>
        </div>
        <div class="dg-mg-tip">${done && m.kind === "rm" && m.picked && m.picked.kind === "rank"
? (m.picked.perfect ? "🌟 排序全对！这就是奖励模型想要的标注。" : m.picked.score >= 0.5 ? "只差一步之遥——相邻位次有偏差。" : "排序偏差较大，看看正确名次。")
: meta.pickTip}</div>
        <div class="dg-mg-opts ${m.kind}">${opts}</div>
        ${rankBar}
      </div>`;
},
minigameSummaryHTML(sm) {
const meta = this.minigameMeta(sm.kind);
const names = { code: "代码", text: "文字", safety: "安全", stability: "稳定" };
const gains = Object.keys(sm.gains || {}).map((k) => `${names[k]} +${sm.gains[k]}`).join("　");
const perfect = sm.hits >= sm.total;
return `
      <div class="dg-mg-card">
        <div class="dg-mg-kicker">${meta.kicker}</div>
        <div class="dg-mg-title">${meta.title} · 完成</div>
        <div class="dg-mg-summary">
          <div class="dg-mg-score-big">${perfect ? "🌟 全对！" : `答对 ${sm.hits} / ${sm.total}`}</div>
          <div class="dg-mg-gains">${gains || "本次没有产生数值收益"}</div>
          <p class="dg-mg-note">${perfect
? "标注质量很高，这批数据可以直接进训练管线了。"
: "有分歧的样本会被送回复审——真实工作中也是如此。"}</p>
        </div>
        <div class="dg-actions"></div>
      </div>`;
},
startTestTypewriter(text, garbled) {
this.stopTestTypewriter();
const el = this.el && this.el.querySelector("#dg-chat-out");
if (!el) return;
const full = this.tpl(String(text || ""));
el.textContent = "";
el.classList.toggle("typing", true);
let i = 0;
this._typeTimer = setInterval(() => {
i += 1;
el.textContent = full.slice(0, i);
if (i >= full.length) {
clearInterval(this._typeTimer);
this._typeTimer = null;
el.classList.remove("typing");
}
}, garbled ? 110 : 55);
},
stopTestTypewriter() {
if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
},
eventOptAffordable(o, s, evId) {
const salary = this.core.eventOptionStatus && this.core.eventOptionStatus(o, evId, s);
if (salary && (salary.active || salary.expenseActive || salary.dividendBlocked)) return salary.ok;
const worst = (eff) => {
if (!eff) return 0;
let d = 0;
if (typeof eff.funding === "number") d += Math.min(0, eff.funding);
if (eff.chance) d += Math.min(worst(eff.chance.success), worst(eff.chance.fail));
return d;
};
return -worst(o && o.effects) <= (s.funding || 0);
},
eventOptDisabled(o, s, opts, evId) {
const salary = this.core.eventOptionStatus && this.core.eventOptionStatus(o, evId, s);
if (salary && (salary.active || salary.expenseActive || salary.dividendBlocked)) return !salary.ok;
const list = opts || [];
const anyOk = list.some((x) => this.eventOptAffordable(x, s, evId));
return anyOk && !this.eventOptAffordable(o, s, evId);
},
axisSolid(id) {
const c = ((this.core.axisDef(id) || {}).color) || "";
const m = String(c).match(/#[0-9a-fA-F]{3,8}/g);
return m && m.length ? m[m.length - 1] : "";
},
floatText(host, text, crit, color, production) {
if (!host) return;
if (production) { this.queueOfficeFloat(host, production.amount, production.dim, color); return; }
const fl = document.createElement("span");
fl.className = "dg-work-float" + (crit ? " crit" : "") + (color ? " ax" : "");
if (color) fl.style.color = color;
fl.textContent = text;
host.appendChild(fl);
setTimeout(() => fl.remove(), 950);
},
pushNotice(n, opts) {
const stack = this.el.querySelector("#ob-notices");
if (!stack) return;
const o = opts || {};
if (!o.isEvent && n.group && (
Array.from(stack.children).some(card => card.dataset.noticeGroup === n.group)
|| (this._noticeQueue || []).some(item => item.group === n.group))) return;
if (!o.isEvent && stack.children.length >= 2) {
this._noticeQueue = this._noticeQueue || [];
this._noticeQueue.push(n);
return;
}
const kindCls = o.isEvent ? ("ev-" + (n.uiType || "random")) : (n.kind === "news" ? "news" : "hint");
const icon = o.isEvent ? "💬" : (n.kind === "news" ? "📰" : "🔔");
const tag = o.isEvent ? "事件" : (n.tag || "");
const hasAv = !o.isEvent && n.avatar;
const div = document.createElement("div");
if (!o.isEvent && n.group) div.dataset.noticeGroup = n.group;
div.className = "notice-card " + kindCls + (o.isEvent ? " is-event" : "") + (hasAv ? " has-avatar" : "");
div.innerHTML = `
      ${o.isEvent ? "" : `<button class="nc-close" title="关闭">✕</button>`}
      <div class="nc-flex">
        ${hasAv ? `<img class="nc-avatar" src="${n.avatar}" alt="">` : ""}
        <div class="nc-main">
          <div class="nc-head"><span class="nc-icon">${icon}</span><span class="nc-tag">${tag}</span></div>
          ${n.title ? `<div class="nc-title">${this.core.chatVar(n.title)}</div>` : ""}
          <div class="nc-text">${this.core.chatVar(n.text || "")}</div>
        </div>
      </div>
      ${o.isEvent && (n.options || []).length ? `
        <div class="nc-opts">${n.options.map((op, i) =>
`<button class="nc-opt" data-evopt="${i}">${this.core.chatVar(this.core.eventOptionText ? this.core.eventOptionText(op, n.id) : op.text || "")}</button>`).join("")}</div>` : ""}`;
stack.appendChild(div);
(window.requestAnimationFrame || ((fn) => setTimeout(fn, 16)))(() => div.classList.add("in"));
let closed = false;
const close = () => {
if (closed) return;
closed = true;
div.classList.remove("in");
div.classList.add("out");
setTimeout(() => {
div.remove();
if (this._noticeQueue && this._noticeQueue.length) {
const next = this._noticeQueue.shift();
this.pushNotice(next);
}
}, 380);
};
div.querySelector(".nc-close") && div.querySelector(".nc-close").addEventListener("click", () => {
close();
});
if (!o.isEvent) setTimeout(close, n.ms || 6000);
if (o.isEvent) {
div.querySelectorAll("[data-evopt]").forEach((btn) => {
btn.addEventListener("click", () => {
const r = this.core.applyEventOption(n.id, +btn.dataset.evopt);
if (r && r.ok === false) { this.toast(r.tip || "暂时无法处理此选项"); return; }
if (window.OfficePause) OfficePause.releaseNotice(this.core, div);
else this.core.state.officePaused = o.wasPaused;
close();
this.toast(r && r.tip ? r.tip : "已处理");
this.save.autoSave(this.core.state);
this.render({ soft: true });
});
});
}
return div;
},
showOfficeEvent(ev) {
const s = this.core.state;
if (this.el.querySelector("#ob-evspawn")) return;
const full = this.core.evByNo(ev.no != null ? ev.no : ev.id);
if (!full) return;
if (typeof this.core.eventEligibleForStage === "function" && !this.core.eventEligibleForStage(full, s)) {
if (typeof this.core.healStageEvents === "function") this.core.healStageEvents();
return;
}
const whoName = ev.targetName || this.core.noticeTpl("{name}");
const rep = (str) => this.core.chatVar(String(str == null ? "" : str).replace(/\{name\}/g, whoName));
const wasPaused = !!s.officePaused;
const releasePause = window.OfficePause
? (full.pause !== false ? OfficePause.acquire(this.core, "event") : function () {}) : null;
if (!releasePause && full.pause !== false) s.officePaused = true;
this.updateOfficeMain();
const div = document.createElement("div");
div.id = "ob-evspawn";
div.className = "ev-spawn";
const opts = full.options || [];
div.innerHTML = `
      <div class="ev-morph">
        <div class="ev-rings"><i></i><i></i><i></i></div>
        <img class="ev-ic" src="resource/ui/favicon.png" alt="" aria-hidden="true">
        <div class="ev-capsule-title">${rep(full.title)}</div>
        <div class="ev-body">
          <div class="ev-title">${rep(full.title)}</div>
          <div class="ev-text">${rep(full.desc)}</div>
          <div class="ev-opts">${opts.map((o, i) => {
const bad = this.eventOptDisabled(o, s, opts, full.no);
const status = this.core.eventOptionStatus && this.core.eventOptionStatus(o, full.no);
return `<button class="ev-opt${bad ? " lack" : ""}" data-evopt="${i}"${bad ? ' title="' + this.escHtml(status && status.tip || "经费不足") + '"' : ""}>${rep(this.core.eventOptionText ? this.core.eventOptionText(o, full.no) : o.text)}</button>`;
}).join("")}</div>
        </div>
        <button class="ev-min" type="button" title="缩小，去点开其它面板看信息" aria-label="缩小事件">—</button>
      </div>
      <div class="ev-hint">触发事件</div>`;
this.el.appendChild(div);
const refreshOptions = () => {
div.querySelectorAll("[data-evopt]").forEach((button) => {
const option = opts[+button.dataset.evopt];
const status = this.core.eventOptionStatus && this.core.eventOptionStatus(option, full.no);
const bad = this.eventOptDisabled(option, s, opts, full.no);
button.textContent = rep(this.core.eventOptionText ? this.core.eventOptionText(option, full.no) : option.text);
button.classList.toggle("lack", bad);
button.title = bad ? (status && status.tip || "经费不足") : "";
});
};
div.querySelector(".ev-morph").addEventListener("click", () => {
if (div.classList.contains("expand")) return;
refreshOptions();
div.classList.remove("min");
div.classList.add("expand");
setTimeout(() => div.classList.add("open"), 480);
});
const minBtn = div.querySelector(".ev-min");
if (minBtn) minBtn.addEventListener("click", (e2) => {
e2.stopPropagation();
div.classList.add("min");
div.classList.remove("open");
div.classList.remove("expand");
});
div.querySelectorAll("[data-evopt]").forEach((btn) => {
btn.addEventListener("click", () => {
const opt = opts[+btn.dataset.evopt];
if (opt && this.core.eventOptionText && this.core.eventOptionStatus) {
const quote = this.core.eventOptionStatus(opt, full.no);
const currentText = rep(this.core.eventOptionText(opt, full.no));
if (quote.active && btn.textContent !== currentText) {
refreshOptions();
this.toast(quote.ok ? "工资已变化，留任费用已更新，请确认新的金额" : quote.tip);
return;
}
}
if (opt && this.eventOptDisabled(opt, s, opts, full.no)) {
const status = this.core.eventOptionStatus && this.core.eventOptionStatus(opt, full.no);
this.toast(status && status.tip ? status.tip : "经费不足，这个选项现在选不了"); return;
}
const r = this.core.applyEventOption(full.no, +btn.dataset.evopt);
if (r && r.ok === false && !r.retired) { this.toast(r.tip || "暂时无法处理此选项"); return; }
if (releasePause) releasePause();
else if (!s.minigame) s.officePaused = wasPaused;
div.classList.add("bye");
setTimeout(() => div.remove(), 380);
this.toast(r && r.tip ? r.tip : "已处理");
this.save.autoSave(s);
this.render({ soft: true });
this.updateOfficeMain();
});
});
return div;
},
v35GapInfo() {
const s = this.core.state;
const tag = (s.v35 && s.v35.gapState) || "ok";
return {
ok: { label: "充裕", cls: "" },
tight: { label: "吃紧", cls: "warn" },
warn: { label: "告急", cls: "bad" },
out: { label: "断粮", cls: "bad" },
}[tag] || { label: "充裕", cls: "" };
},
gapFreeLine() {
const gs = ((this.core.cfg || {}).V35 || {}).GAP_SLOW || {};
const free = gs.FREE_ABOVE != null ? +gs.FREE_ABOVE : 90;
return Math.max(61, Math.min(129, free));
},
corpusBarHTML(mini) {
const s = this.core.state;
const st = s.v35;
if (!st) return "";
const need = this.core.corpusDemand();
const pct = (Math.floor(st.corpus.token) / Math.max(1, need)) * 100;
const cur = Math.min(100, Math.min(pct, 130) / 1.3).toFixed(1);
const cls = mini ? "corpus-mini" : "corpus-range";
const p = this.gapFreeLine();
const wLack = (60 / 1.3).toFixed(1), wTight = ((p - 60) / 1.3).toFixed(1), wOk = ((130 - p) / 1.3).toFixed(1);
const tip = "语料区间：红=不足(<60%) / 黄=吃紧(60–" + p + "%) / 绿=充裕(≥" + p + "%)，竖线=本周需求";
return `<span class="${cls}"${mini ? ' id="ob-corpus-bar"' : ""} title="${tip}">`
+ `<i class="${mini ? "cm" : "cr"}-seg lack" style="width:${wLack}%"></i><i class="${mini ? "cm" : "cr"}-seg tight" style="width:${wTight}%"></i><i class="${mini ? "cm" : "cr"}-seg ok" style="width:${wOk}%"></i>`
+ `<u class="${mini ? "cm" : "cr"}-cursor" style="left:${cur}%"></u></span>`;
},
omNews() {
const s = this.core.state;
s.newsUnread = 0;
this._newsTick = (this._newsTick || 0) + 1;
this.startNewsHotTimer();
const feed = s.newsFeed || [];
const feedHtml = feed.length
? feed.map((n, i) => this.newsPostHTML(n, i)).join("")
: `<div class="nw-empty">暂时没有新瓜……先去训练室卷一卷吧 🐋</div>`;
return `<div class="news-weibo" id="newsWeibo">
      <div class="nw-feed">${feedHtml}</div>
      <div class="nw-side">${this.newsSideHTML()}</div>
    </div>`;
},
newsStats(n, tick) {
const str = (n.id || "") + "#" + (tick || 0);
let h = 2166136261;
for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
return {
reposts: 800 + h % 52000,
comments: 300 + (h >>> 3) % 26000,
likes: 1200 + (h >>> 6) % 88000,
};
},
fmtWan(v) { return v >= 10000 ? Math.round(v / 10000) + "万" : String(Math.round(v || 0)); },
newsPostHTML(n, i) {
const s = this.core.state, c = this.core.cfg;
const acc = c.NEWS_ACCOUNT || {};
const st = this.newsStats(n, this._newsTick || 0);
const liked = !!(s.newsLiked || {})[n.id];
const time = n.date ? n.date : "第 " + (n.week || s.week) + " 周";
if (!Array.isArray(n.comments)) { n.comments = this.core.buildNewsComments({ id: n.id }); }
const cmts = n.comments || [];
const cmtHtml = cmts.length ? cmts.map((cm) => `
          <div class="nw-cmt"><span class="nw-cmt-ava">${(cm.who || "?").charAt(0)}</span><span class="nw-cmt-body"><b class="nw-cmt-who">${cm.who}</b>${cm.t}</span></div>`).join("")
: `<div class="nw-cmt nw-cmt-empty">还没有同事评论，抢个沙发……</div>`;
const imgHtml = n.img
? `<div class="nw-img" data-action="nw-img" data-src="${this.escAttr(n.img)}" title="点击看原图"><img src="${this.escAttr(n.img)}" alt="${this.escAttr(n.imgAlt || n.title || "")}" loading="lazy" onerror="this.parentNode.style.display='none'"></div>`
: "";
return `<div class="nw-post" style="animation-delay:${Math.min(i * 0.07, 0.6).toFixed(2)}s">
      <div class="nw-head">
        <img class="nw-avatar" src="${acc.avatar || ""}" alt="" onerror="this.style.visibility='hidden'">
        <div class="nw-meta">
          <div class="nw-user">${acc.name || "鲸华社 BOT"}<i class="nw-v" title="官方账号">✓</i></div>
          <div class="nw-time">${time} · ${n.src || "鲸华社 BOT"} · 来自鲸搜</div>
        </div>
      </div>
      <div class="nw-text"><b>${this.core.chatVar(n.title || "")}</b><br>${this.core.chatVar(n.text || "")}</div>
      ${imgHtml}
      <div class="nw-actions">
        <span>${this.icon("menu3", 13)} 转发 ${this.fmtWan(st.reposts)}</span>
        <span class="nw-cmt-btn" data-action="nw-cmt" data-id="${n.id}">${this.icon("chat", 13)} 评论 ${this.fmtWan(st.comments)}</span>
        <span class="nw-like${liked ? " on" : ""}" data-action="nw-like" data-id="${n.id}">${liked ? "❤️" : "🤍"} 点赞 ${this.fmtWan(st.likes)}</span>
      </div>
      <div class="nw-cmts" hidden>${cmtHtml}</div>
    </div>`;
},
openNewsImg(src) {
if (!src) return;
let box = this.el.querySelector(".nw-lightbox");
if (!box) {
box = document.createElement("div");
box.className = "nw-lightbox";
box.innerHTML = `<img alt=""><div class="nw-lightbox-tip">点击任意处关闭</div>`;
box.addEventListener("click", () => box.classList.remove("show"));
this.el.appendChild(box);
}
const im = box.querySelector("img");
if (im) im.src = src;
box.classList.add("show");
},
newsSideHTML() {
const s = this.core.state, c = this.core.cfg;
const cnt = (c.NEWS_PAGE || {}).HOT_COUNT || 8;
const feed = s.newsFeed || [];
const tick = this._newsTick || 0;
const items = feed.slice(0, cnt).map((n) => {
const st = this.newsStats(n, tick);
return { id: n.id, word: this.core.chatVar(n.title || ""), heat: st.likes + st.reposts * 2 + st.comments * 3 };
}).sort((a, b) => b.heat - a.heat);
const rows = items.map((it, i) => {
const tag = i === 0 ? "爆" : i === 1 ? "热" : (i <= 3 ? "新" : ((it.heat + tick) % 9 === 0 ? "沸" : ""));
return `<li>
        <span class="nw-rank${i < 3 ? " top" : ""}">${i + 1}</span>
        <span class="nw-word">${it.word}</span>
        ${tag ? `<i class="nw-tag nw-tag-${tag}">${tag}</i>` : ""}
        <span class="nw-heat">${this.fmtWan(it.heat)} 热度</span>
      </li>`;
}).join("");
return `<div class="nw-side-card">
      <div class="nw-side-head">🔥 鲸搜热榜<span class="nw-side-tip">每 ${Math.round(((c.NEWS_PAGE || {}).HOT_REFRESH_MS || 60000) / 1000)} 秒刷新</span></div>
      <ol class="nw-hot">${rows || '<li class="nw-hot-empty">热搜空空如也，等等看</li>'}</ol>
    </div>
    <div class="nw-side-card nw-side-foot">📢 榜单与数据由鲸华社 BOT 实时整活，如有雷同纯属巧合</div>`;
},
startNewsHotTimer() {
if (this._newsHotTimer) return;
this._newsHotTimer = setInterval(() => {
const box = this.el.querySelector("#modalContainer");
const alive = box && box.dataset.modalKey === "news" && box.querySelector("#newsWeibo");
if (!alive) { clearInterval(this._newsHotTimer); this._newsHotTimer = null; return; }
this._newsTick = (this._newsTick || 0) + 1;
const s = this.core.state;
const feedEl = box.querySelector(".nw-feed");
const sideEl = box.querySelector(".nw-side");
if (feedEl) {
const st0 = feedEl.scrollTop;
const openIds = [...feedEl.querySelectorAll(".nw-cmts:not([hidden])")]
.map((el) => { const p = el.closest(".nw-post"); const b = p && p.querySelector(".nw-cmt-btn"); return b && b.dataset.id; })
.filter(Boolean);
feedEl.innerHTML = (s.newsFeed || []).length
? (s.newsFeed || []).map((n, i) => this.newsPostHTML(n, i)).join("")
: `<div class="nw-empty">暂时没有新瓜……先去训练室卷一卷吧 🐋</div>`;
feedEl.scrollTop = st0;
openIds.forEach((id) => {
const btn = feedEl.querySelector('.nw-cmt-btn[data-id="' + id + '"]');
const cbox = btn && btn.closest(".nw-post") && btn.closest(".nw-post").querySelector(".nw-cmts");
if (btn && cbox) { cbox.hidden = false; btn.classList.add("on"); }
});
}
if (sideEl) sideEl.innerHTML = this.newsSideHTML();
}, (this.core.cfg.NEWS_PAGE || {}).HOT_REFRESH_MS || 60000);
},
omCorpus() {
const s = this.core.state;
const c = this.core.cfg.V35;
const st = s.v35;
if (!st) return this.omEmpty("corpus");
const need = this.core.corpusDemand();
const prod = Math.round(this.core.corpusProduction());
const have = Math.floor(st.corpus.token);
const g = this.v35GapInfo();
const q = (st.corpus.q && st.corpus.q.length === 3) ? st.corpus.q : [st.corpus.items || 0, 0, 0];
const mult = c.QUALITY_MULT || [0.5, 1.0, 1.5];
const qbar = window.V35.qbar(st);
const bonus = window.V35.qualityBonus(st);
const qTier = qbar < 0.55 ? "粗劣" : qbar < 0.75 ? "普通为主" : qbar < 0.95 ? "良好为主" : "优质";
const pct = Math.max(0, Math.min(130, (have / Math.max(1, need)) * 100));
const price = Math.round(100 * c.CORPUS_CURVE.BUY.price);
const lack = prod < this.core.corpusWeekAdd();
const fp = this.gapFreeLine();
const bar = `
      <div class="corpus-range" title="游标 = 当前持有占本周需求的百分比">
        <i class="cr-seg lack" style="width:${(60 / 1.3).toFixed(1)}%"></i><i class="cr-seg tight" style="width:${((fp - 60) / 1.3).toFixed(1)}%"></i><i class="cr-seg ok" style="width:${((130 - fp) / 1.3).toFixed(1)}%"></i>
        <div class="cr-cursor" style="left:${(Math.min(pct, 130) / 1.3).toFixed(1)}%" title="当前持有 ${have} 亿 token"></div>
      </div>
      <div class="corpus-range-legend">
        <span class="lack" style="width:${(60 / 1.3).toFixed(1)}%">不足 &lt;60%</span><span class="tight" style="width:${((fp - 60) / 1.3).toFixed(1)}%">吃紧 60–${fp}%</span><span class="ok" style="width:${((130 - fp) / 1.3).toFixed(1)}%">充裕 ≥${fp}%</span>
      </div>`;
const qCard = (name, cls, count, m) => `
      <div class="cm-quality ${cls}">
        <div class="cmq-head"><i class="cmq-dot"></i>${name}</div>
        <div class="cmq-count">${count}<i>条</i></div>
        <div class="cmq-sub">×${m} 亿 token/条 · ${Math.round(count * m)} 亿 token</div>
      </div>`;
return `
      <div class="corpus-modal">
        <div class="cm-hero">
          <div class="cm-num">${have}<span> 亿 token</span></div>
          <span class="corpus-gap ${g.cls}">${g.label}</span>
        </div>
        ${bar}
        <div class="cm-quality-grid">
          ${qCard("普通", "normal", Math.round(q[0]), mult[0])}
          ${qCard("良好", "good", Math.round(q[1]), mult[1])}
          ${qCard("优质", "prime", Math.round(q[2]), mult[2])}
        </div>
        ${this.corpusSupplyCards(need, prod, qbar, qTier, bonus, lack)}
        <div class="cm-buy">
          ${this.corpusBuyBlock(c)}
        </div>
      </div>`;
},
corpusSupplyCards(need, prod, qbar, qTier, bonus, lack) {
const d = this.core.corpusWeekAdd();
const ok = d <= prod;
const pctDemand = Math.min(100, (prod / Math.max(1, d)) * 100);
const waiting = prod <= 0;
const supplyOk = !this.v35GapInfo().cls;
const alarm = lack && !supplyOk;
const barBlock = `
      <div class="cm-sup-chart">
        <div class="cms-row">
          <span class="cms-lab">本周新增需求</span>
          <div class="cms-track"><div class="cms-fill need" style="width:100%"></div><i class="cms-mark" style="left:100%"></i></div>
          <b class="cms-val">${d}<i> 亿</i></b>
        </div>
        <div class="cms-row">
          <span class="cms-lab">每周产量${"（理论）"}</span>
          ${waiting
? `<div class="cms-track"><div class="cms-fill wait" style="width:0%"></div></div><b class="cms-val wait">${this.icon("clock", 13)} 待数据工程师到岗</b>`
: `<div class="cms-track"><div class="cms-fill ${alarm ? "lack" : "ok"}" style="width:${pctDemand}%"></div></div>
               <b class="cms-val ${alarm ? "lack" : "ok"}">≈${prod}<i> 亿</i></b>`}
        </div>
      </div>`;
const verdict = waiting
? `<span class="cm-verdict wait">${this.icon("clock", 12)} 到岗开工后开始产语料</span>`
: ok
? `<span class="cm-verdict avant">${this.icon("check", 12)} 产量充足</span>`
: supplyOk
? `<span class="cm-verdict avant">${this.icon("check", 12)} 库存足以覆盖缺口</span>`
: `<span class="cm-verdict lack">${this.icon("x", 12)} 产量吃紧</span>`;
const qualityChip = `
      <div class="cm-quality-chip">
        <span class="cmqc-dot" style="background:${qbar >= 0.95 ? "#f2b84b" : qbar >= 0.75 ? "#6fc99a" : qbar >= 0.55 ? "#9aa8b5" : "#797f88"}"></span>
        <span>平均品质 <b>${qbar.toFixed(2)}</b></span>
        <span class="cmqc-tier">${qTier}</span>
        <span class="cmqc-bonus">${bonus > 0 ? `评审通过 +${bonus}%` : "评审无加成"}</span>
      </div>`;
const lackTip = alarm && !waiting
? `<div class="cm-lack-tip">${this.icon("alert", 13)} 周产量低于周新增需求，缺口会越拉越大——建议招募数据工程师或定期购买补足</div>`
: "";
const gs = (this.core.cfg.V35 || {}).GAP_SLOW || {};
const free = gs.FREE_ABOVE != null ? gs.FREE_ABOVE : 90;
const step = gs.STEP != null ? gs.STEP : 10;
const slowTip = `<div class="cm-info-tip">${this.icon("clock", 13)} 语料不足会拖慢团队产出节奏：满足率 ≥${free}% 无影响，每再低 ${step}%，产出周期 +1 秒（如 10 秒 → 12 秒）</div>`;
return `            
        <div class="cm-supply">
          ${barBlock}
          <div class="cms-foot">${verdict}${qualityChip}</div>
        </div>
        ${lackTip}
        ${slowTip}`;
},
corpusBuyBlock(c) {
const price = Math.round(100 * (c.CORPUS_CURVE.BUY.price));
return `
      <div class="cm-buy-title">外包采购</div>
      <div class="cm-buy-odds">
        <span class="cbo-item normal"><i class="cbdot"></i>普通 80%<em>1条=0.5 亿 token</em></span>
        <span class="cbo-item good"><i class="cbdot"></i>良好 20%<em>1条=1 亿 token</em></span>
      </div>
      <button class="skew-btn pink" data-action="buy-corpus" style="width:100%">
        ${this.icon("download", 14)}<span>一次采购 100 条 · ${price} 万</span></button>`;
},
renderOfficeFloats(floats) {
if (!floats || !floats.length || !this.core.v35On()) return;
const s = this.core.state;
const modern=this.core.embodiedAvailable&&this.core.embodiedAvailable();
if(modern){const grouped=new Map();for(const f of floats){
const dim=['code','text'].includes(f.dim)?'codeText':['safety','stability'].includes(f.dim)?'safetyStability':f.dim;
const key=f.who+':'+(f.engId != null ? f.engId : f.slot)+':'+dim,old=grouped.get(key);
if(old){old.amount+=f.amount;old.focus=old.focus||f.focus;}else grouped.set(key,{...f,dim});
}floats=[...grouped.values()];}
const roleEng = {};
for (const role of ["pre", "data", "post", "embodied"]) {
roleEng[role] = this.core.productionRoleEngs(s.v35, role);
}
let didSfx = false;
for (const f of floats) {
let host = null;
if (f.who === "paper") host = this.el.querySelector('.stat-item[data-stat="'+(modern?'codeText':'text')+'"]');
else {
const crew = roleEng[f.who] || [];
const producer = crew[f.slot != null ? f.slot : 0];
const engId = f.engId != null ? f.engId : (producer && producer.id);
host = engId ? this.el.querySelector(`.emp-marker[data-eng="${engId}"] .emp-avatar`) : null;
}
if (!host) continue;
const n = Math.max(1, Math.round(f.amount));
const axColor = this.axisSolid(f.dim);
this.floatText(host, `+${n} ${this.statLabel(f.dim)}`, true, axColor, { amount:n, dim:f.dim });
if (!didSfx && window.SFX) { SFX.play(f.focus ? "confirm" : "float"); didSfx = true; }
}
},
clearOfficeProductionFloats() {
if (this._officeFloatTimer) clearTimeout(this._officeFloatTimer);
this._officeFloatTimer = null; this._officeFloatQueue = [];
if (this.el) this.el.querySelectorAll(".office-production-float").forEach(n => n.remove());
},
officeProductionVisible(node) {
if (!node || !node.isConnected || node.hidden || node.closest("[hidden]")) return false;
for (let p=node; p; p=p.parentElement) {
const css=getComputedStyle(p);
if (css.display === "none" || css.visibility === "hidden" || css.visibility === "collapse") return false;
}
const r=node.getBoundingClientRect(); return r.width>0 && r.height>0;
},
officeProductionBlocked(checkDOM) {
const s=this.core && this.core.state;
if (!s || s.phase!=="office" || s.officeModal || s.officePaused || document.hidden || this._modal || this._confirmOpen || this._fireOpen || this._embodiedPodExitBusy) return true;
for (const api of [window.OfficeMore,window.WhaleRoom,window.LifeFinale]) if (api && typeof api.isOpen==="function" && api.isOpen()) return true;
if (window.ArcadeGlue && ArcadeGlue.active) return true;
this._officeProductionPanels=(this._officeProductionPanels || []).filter(n => n.isConnected);
if (this._officeProductionPanels.some(n => this.officeProductionVisible(n))) return true;
if (!checkDOM) return false;
return Array.from(document.querySelectorAll(".modal-mask,.dg-modal-mask,.set-pop-mask,.v2b-panel-host,.chat-zoom-mask,.nw-lightbox,.embodied-overlay,.life-finale,.dg-train-anim,.ev-spawn,.insp-overlay,.sub-modal-overlay")).some(n => this.officeProductionVisible(n));
},
installOfficeProductionLifecycle() {
const ui=this;
if (!this._officeProductionLifecycleInstalled) {
this._officeProductionLifecycleInstalled=true;
for (const name of ["renderOfficeModal","renderSaveModal","openSettingsPop","openCodexPop","openRank","openNewsImg","chatZoom","showOfficeEvent","showMinigameSpawn"]) {
const original=this[name]; if (typeof original!=="function") continue;
this[name]=function () {
if (name!=="renderOfficeModal" || ui.core && ui.core.state && ui.core.state.officeModal) ui.clearOfficeProductionFloats();
return original.apply(this,arguments);
};
}
const click=this.onClick;
this.onClick=function (event) {
const target=event && event.target && event.target.closest && event.target.closest("[data-action]");
if (target && ["office-view","office-pause","office-modal","open-save","open-help"].includes(target.dataset.action)) ui.clearOfficeProductionFloats();
return click.apply(this,arguments);
};
window.addEventListener("resize",() => ui.clearOfficeProductionFloats());
}
const panels=window.V2Panels;
if (panels && typeof panels.open==="function" && panels.open._officeProductionOwner!==ui) {
const open=panels.open;
panels.open=function () {
ui.clearOfficeProductionFloats(); const panel=open.apply(this,arguments);
ui._officeProductionPanels=(ui._officeProductionPanels || []).filter(n => n.isConnected);
if (panel && panel.host) ui._officeProductionPanels.push(panel.host);
return panel;
};
panels.open._officeProductionOwner=ui;
}
},
queueOfficeFloat(host, amount, dim, color) {
this.installOfficeProductionLifecycle();
const state=this.core.state;
if (this.officeProductionBlocked(false)) { this.clearOfficeProductionFloats(); return; }
this._officeFloatQueue=(this._officeFloatQueue || []).filter(f => f.state===state && f.host.isConnected);
const old=this._officeFloatQueue.find(f => f.host===host && f.dim===dim);
if (old) old.amount+=amount; else this._officeFloatQueue.push({host,amount,dim,color,state});
if (!this._officeFloatTimer) this.drainOfficeFloats();
},
drainOfficeFloats() {
this._officeFloatTimer=null;
const state=this.core.state, scene=this.el && this.el.querySelector(".office-scene");
const queue=this._officeFloatQueue=(this._officeFloatQueue || []).filter(f => f.state===state && f.host.isConnected);
if (!scene || this.officeProductionBlocked(queue.length || scene.querySelector(".office-production-float"))) { this.clearOfficeProductionFloats(); return; }
if (!queue.length) return;
const frame=scene.getBoundingClientRect(), sx=frame.width/(scene.offsetWidth || scene.clientWidth || frame.width), sy=frame.height/(scene.offsetHeight || scene.clientHeight || frame.height);
const left=frame.left+(scene.clientLeft || 0)*sx, top=frame.top+(scene.clientTop || 0)*sy;
const width=(scene.clientWidth || scene.offsetWidth || frame.width)*sx, height=(scene.clientHeight || scene.offsetHeight || frame.height)*sy;
if (!(sx>0 && sy>0 && width>12 && height>12)) { this.clearOfficeProductionFloats(); return; }
let layer=scene.querySelector(".office-production-layer");
if (!layer) { layer=document.createElement("div"); layer.className="office-production-layer"; layer.setAttribute("aria-hidden","true"); scene.appendChild(layer); }
const f=queue[0], r=f.host.getBoundingClientRect();
if (!r.width || !r.height) queue.shift();
else {
const fl=document.createElement("span");
fl.className="dg-work-float crit office-production-float"+(f.color ? " ax" : "");
if (f.color) fl.style.color=f.color;
fl.style.fontSize=(window.innerWidth<=600 ? 11 : 12)/sx+"px";
fl.style.setProperty("--office-float-rise-start",8/sy+"px");
fl.style.setProperty("--office-float-rise-mid",-2/sy+"px");
fl.style.setProperty("--office-float-rise-end",-28/sy+"px");
fl.textContent="+"+(Math.round(f.amount*10)/10)+" "+this.statLabel(f.dim);
fl.style.visibility="hidden"; layer.appendChild(fl);
const box=fl.getBoundingClientRect(), w=Math.max(1,(fl.offsetWidth ? fl.offsetWidth*sx : box.width)*1.12+12), h=Math.max(1,(fl.offsetHeight ? fl.offsetHeight*sy : box.height)*1.12+44);
const live=Array.from(layer.querySelectorAll(".office-production-float[data-footprint]")).map(n => JSON.parse(n.dataset.footprint));
const side=(this._officeFloatSide=(this._officeFloatSide || 0)+1)%2 ? -1 : 1;
const candidates=[side,-side,0].flatMap(sign => [-12,-h-8,18].map(dy => ({
x:Math.max(left+6,Math.min(left+width-w-6,r.left+r.width/2+sign*(w/2+8)-w/2)),
y:Math.max(top+6,Math.min(top+height-h-6,r.top+dy)),w,h
})));
const q=candidates.find(p => p.x+p.w<=left+width-6 && p.y+p.h<=top+height-6 && live.every(a => p.x>=a.x+a.w+6 || p.x+p.w+6<=a.x || p.y>=a.y+a.h+6 || p.y+p.h+6<=a.y));
if (q) {
fl.dataset.footprint=JSON.stringify(q); fl.style.left=(q.x+q.w/2-left)/sx+"px"; fl.style.top=(q.y+32-top)/sy+"px";
fl.style.visibility=""; queue.shift(); setTimeout(() => fl.remove(),950);
} else fl.remove();
}
this._officeFloatTimer=setTimeout(() => this.drainOfficeFloats(),260);
},
startOfficeBubbleTimer() {
if (this._bubbleTimer) return;
const schedule = () => {
const bc = this.core.cfg.OFFICE_BUBBLE || {};
const [a, b] = bc.EVERY_MS || [30000, 60000];
this._bubbleTimer = setTimeout(() => {
this._bubbleTimer = null;
const s = this.core.state;
if (s && s.phase === "office" && !s.officePaused && !s.officeModal
&& !(this.core.guidePending && this.core.guidePending())) {
this.spawnOfficeBubble();
}
schedule();
}, a + Math.random() * Math.max(0, b - a));
};
schedule();
},
spawnOfficeBubble() {
const s = this.core.state, c = this.core.cfg;
const alive = (s.engineers || []).filter((e) => !e.resigned
&& (e.joinTick == null || (s.v35 && s.v35.tick != null && s.v35.tick >= e.joinTick))
&& (e.restWeek == null || e.restWeek !== (s.week || 0))
&& this.el.querySelector(`.emp-marker[data-eng="${e.id}"]`));
if (!alive.length || !s.planDone) return;
const st = s.v35 || {};
const v35 = c.V35 || {};
const offwork = st.tick != null && st.tick >= (v35.OFF_START || 18)
&& st.tick < (v35.OFF_START || 18) + (v35.OFF_LEN || 3);
let pool, who;
const tired = alive.filter((e) => (e.energy || 0) < 30);
if (tired.length) {
pool = c.WORK_BUBBLES_TIRED || ["好累啊..."];
who = tired[Math.floor(Math.random() * tired.length)];
} else if (offwork) {
pool = c.WORK_BUBBLES_OFFWORK || ["终于下班了..."];
who = alive[Math.floor(Math.random() * alive.length)];
} else if (s.focusBoost) {
pool = c.WORK_BUBBLES_FOCUS || [];
who = alive[Math.floor(Math.random() * alive.length)];
} else {
pool = c.WORK_BUBBLES || [];
who = alive[Math.floor(Math.random() * alive.length)];
}
if (!pool.length) return;
const marker = this.el.querySelector(`.emp-marker[data-eng="${who.id}"]`);
if (!marker || marker.querySelector(".emp-bubble")) return;
const bub = document.createElement("div");
bub.className = "emp-bubble";
bub.textContent = pool[Math.floor(Math.random() * pool.length)];
marker.appendChild(bub);
const show = (c.OFFICE_BUBBLE || {}).SHOW_MS || 4000;
setTimeout(() => bub.classList.add("bye"), Math.max(100, show - 300));
setTimeout(() => bub.remove(), show);
},
stopBubbleTimer() {
if (this._bubbleTimer) { clearTimeout(this._bubbleTimer); this._bubbleTimer = null; }
},
engEnergy(e) {
return Math.round(e.energy || 0);
},
statusVal(e, k) {
if (k === "energy") return this.engEnergy(e);
const v = (e.status && e.status[k] != null) ? e.status[k] : e[k];
return v == null ? 70 : v;
},
effectsText(eff) {
if (!eff || !Object.keys(eff).length) return "";
const map = {
code: "代码", text: "文字", safety: "安全", stability: "稳定",
funding: "经费", brand: "品牌", time_cost: "时间",
};
const parts = [];
for (const [k, v] of Object.entries(eff)) {
if (map[k] && v) parts.push(`${map[k]} ${v > 0 ? "+" : ""}${k === "funding" ? fmtMoney2(v) : Math.round(v)}`);
else if (k === "funding") parts.push(`经费 ${fmtMoney2(v)}`);
else if (k === "brand") parts.push(`品牌 ${v > 0 ? "+" : ""}${Math.round(v)}`);
else if (k === "reputation") parts.push(`口碑 ${v > 0 ? "+" : ""}${v}★`);
else if (k === "time_cost") parts.push(`时间 +${v}周`);
else if (k === "parallel") parts.push("并行训练");
else if (k === "rand") parts.push("结果随机");
else if (k === "if_stability_below") parts.push(`稳定 <${v} 有风险`);
else if (k === "if_stat") parts.push("结果取决于能力");
else if (k === "chance") parts.push("成功率与品牌相关");
else if (k === "quit_risk") parts.push("下回合有人可能离职");
else if (k === "target_resign") parts.push("TA 离职");
else if (k === "target_trait_up") parts.push("TA 最高词条 +1");
else if (k === "cand_bonus") parts.push("下轮候选 +1");
else if (k === "investor") parts.push("此后需定期汇报");
else if (k === "growth_pct") parts.push(`下轮成长 ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`);
else if (k === "team_stat") parts.push(this.statText(v, "全员"));
else if (k === "target_stat") parts.push(this.statText(v, "TA"));
}
return parts.join(" · ");
},
statText(d, who) {
const m = { energy: "体力" };
return Object.entries(d).filter(([, v]) => v)
.map(([k, v]) => `${who}${m[k] || k}${v > 0 ? "+" : ""}${Math.round(v)}`).join(" ");
},
settlementFundsHTML() {
const current = Math.round(Number(this.core.state.funding) || 0);
return '<div class="bonus-fund settlement-funds" aria-label="结算经费明细"><span data-funding-current="' + current
+ '">本轮结算后经费 <b>' + fmtMoney(current) + '</b></span></div>';
},
verdictRewardsHTML(r) {
const s = this.core.state;
const total = (s.bonus && s.bonus.total) || 0;
const miniTxt = (r.miniBonus || 0) > 0 ? `（含小模型 ${r.miniBonus / 10000} 万）` : "";
if (r.usersGained != null && this.core.isPassLike(r)) {
const gained = r.usersGained;
return `
        <div class="dg-over-rewards">
          <span>本轮奖金 <b>+${fmtMoney(total)}</b>${miniTxt}</span>
          <span>新增用户 <b>${gained.toLocaleString()}</b>（累计 ${(s.users || 0).toLocaleString()}）</span>
          <span>全球模型能力榜 <b>第 ${s.rank || "—"} 名</b></span>
          ${r.brandAdd ? `<span>品牌值 <b>${r.brandAdd > 0 ? "+" : ""}${r.brandAdd}</b>（当前 ${r.brandNow != null ? r.brandNow : Math.round(s.brand || 0)}）</span>` : ""}
        </div>`;
}
return `
      <div class="dg-over-rewards">
        <span>本轮结算收益 <b>+${fmtMoney(total)}</b> ${miniTxt}</span>
        <span>${r.verdict === "veto" ? "评审未通过" : "反馈平平"}（评审通过后计入用户与全球模型能力榜）</span>
        ${r.brandAdd ? `<span>品牌值 <b>${r.brandAdd > 0 ? "+" : ""}${r.brandAdd}</b>（当前 ${r.brandNow != null ? r.brandNow : Math.round(s.brand || 0)}）</span>` : ""}
      </div>`;
},
renderOver() {
const s = this.core.state;
if (s.bankrupt) {
const stats = this.modelDims(s)
.map((d) => `<span class="dg-over-stat">${d.label} <b>${Math.round(this.modelValue(d.key,s))}</b></span>`).join("");
this.el.innerHTML = `
        <div class="dg-over">
          <div class="dg-over-emoji">💀</div>
          <div class="dg-over-title">Game Over · 公司破产</div>
          <div class="dg-over-desc">母公司的拨款已经填不上工资的窟窿，账上分文不剩。<br>「${this.tpl("{model}")}」的研发到此为止——但这些经验不会白费，下一局会走得更稳。</div>
          <div class="dg-over-stats">${stats}</div>
          <div class="dg-over-score">存活 ${s.week} 周 · 版本 ${s.ver}</div>
          <div class="dg-actions">
            <button class="dg-btn dg-btn-primary" data-action="newgame">🔁 重新开始</button>
            <button class="dg-btn" data-action="save">💾 查看存档</button>
          </div>
        </div>`;
return;
}
const r = s.result;
const verdictMap = {
pass: { t: "通过内部评审", d: "恭喜！「{model}」通过内部评审，追加研发经费。下一阶段将继续深化训练。" },
excellent: { t: "优秀评审！", d: "总评远超目标！额外奖励品牌值与经费加成，团队状态正好。" },
top: { t: "顶尖评审！！", d: "全场沸腾！「{model}」达到顶尖水准！最高规格奖励奉上，研发日志已可载入史册。" },
fail: { t: "内部否决", d: "未能达到内部评审标准，需重新训练（保留部分经费）。可读档回到关键节点重试。" },
veto: { t: "强制内部否决", d: "安全性不达标被内部否决，品牌值下降。安全是底线！" },
};
const MUI = ((this.core.cfg.MISSIONS || {}).UI) || {};
const v = r.qualificationFailed ? {t:this.core.reviewFailurePolicy().UI.TITLE,d:this.core.reviewFailurePolicy().UI.DESCRIPTION} : r.retry
? { t: MUI.OVER_T || "任务未达成",
d: MUI.OVER_D || "模型通过内部评审，但未达成本阶段任务：阶段不会推进，需要重训本阶段。主评审经费只按超过本版本已结算最高分的提升计算，同分或更低为 0；小模型等单列收入另算。" }
: (verdictMap[r.verdict] || verdictMap.fail);
const stats = this.modelDims(s)
.map((d) => `<span class="dg-over-stat">${d.label} <b>${Math.round(this.modelValue(d.key,s))}</b></span>`).join("");
const _amin = (this.core.missionOf(s.ver) || {}).axisMin || {};
const _shortAxes = Object.keys(_amin).filter((k) => (s[k] || 0) < _amin[k]);
const axisHint = (r.retry && _shortAxes.length)
? `<div class="dg-over-axis-tip">轴未达标：${_shortAxes.map((k) => this.core.statLabel(k) + " " + Math.round(s[k] || 0) + " / " + _amin[k]).join("、")}——重训时优先喂这根轴。</div>`
: "";
const c = this.core.cfg;
const rewardsHTML = this.verdictRewardsHTML(r);
const nextBtn = r.nextVer
? `<button class="dg-btn dg-btn-primary" data-action="next-stage">➜ 进入 ${r.nextVer} 阶段</button>`
: (r.retry
? `<button class="dg-btn dg-btn-primary" data-action="retry-stage">🔁 重训 ${s.ver} 阶段</button>`
: (r.finalRepeat
? `<button class="dg-btn dg-btn-primary" data-action="retry-stage">🔁 再战 ${s.ver} 阶段</button>`
: ""));
const finalText = "";
const overImg = (c.UI_PORTS || {}).over || "resource/character/stand.webp";
this.el.innerHTML = `
      <div class="dg-over">
        <img class="dg-over-role" src="${overImg}" alt="鲸鱼娘" draggable="false">
        <div class="dg-over-title">${v.t}</div>
        <div class="dg-over-desc">${this.tpl(v.d)}</div>
        <div class="dg-over-stats">${stats}</div>
        ${axisHint}
        <div class="dg-over-score">总评 ${Math.round(r.score || 0)} · 目标参数 ${s.paramTarget != null ? s.paramTarget + "B" : "—"} · 版本 ${s.ver}</div>
        ${rewardsHTML}
        ${finalText}
        <div class="dg-actions center">
          ${nextBtn}
          ${this.rankEntryBtn()}
          <button class="dg-btn" data-action="newgame">🔁 重开一局</button>
          <button class="dg-btn" data-action="save">💾 查看存档</button>
        </div>
      </div>`;
const fundsAnchor = this.el.querySelector('.dg-over-rewards');
if (fundsAnchor) fundsAnchor.insertAdjacentHTML('afterend', this.settlementFundsHTML(r));
},
reviewTutorialLine(text, tutorial) {
const raw = String(text == null ? '' : text);
const line = this.tpl(raw);
if (!tutorial || tutorial.phase !== 'review' || tutorial.ver || /\bV\d+(?:\.\d+)?\b/.test(raw)) return line;
return line.replace(/第\s*\d+\s*周(?=\s*训练周期结束)/g, '第 ' + this.core.minWeeks(this.core.state.ver) + ' 周');
},
renderTutorialModal(t) {
const port = t.port === "prologue" || !t.port
? ((this.core.cfg.UI_PORTS || {}).prologue || this.portraitSrc(t.port || "fixed"))
: this.portraitSrc(t.port);
const lines = (t.lines || []).map((l) => `<p>${this.reviewTutorialLine(l, t)}</p>`).join("");
this.el.insertAdjacentHTML("beforeend", `
      <div class="dg-modal-mask dg-tut-mask" data-action="tut-close" data-id="${t.id}">
        <div class="dg-modal dg-tut">
          <div class="dg-tut-head">
            <img class="dg-tut-port" src="${port}" alt="鲸鱼娘">
            <div class="dg-tut-who">${this.icon("star", 13)} 鲸鱼娘 · 项目助手</div>
          </div>
          <div class="dg-tut-bubble">
            <div class="dg-tut-title">${this.tpl(t.title)}</div>
            ${lines}
          </div>
          <div class="dg-actions">
            <button class="dg-btn dg-btn-primary" data-action="tut-close" data-id="${t.id}">
              知道了 ${this.icon("chevR", 13)}</button>
          </div>
        </div>
      </div>`);
},
disposeModalPages(reset=true) {
if (this._modalPages) this._modalPages.dispose();
if (reset) this._modalPages=null;
},
paginateModal(mask, kind) {
this.disposeModalPages();
mask.classList.add('dg-single-page-mask');
mask.querySelector('.dg-modal')?.classList.add('dg-single-page-modal');
},
openHelp() { if(this._modal!=="help")this.disposeModalPages(); this._modal = "help"; this.render({ soft: true }); },
renderHelpModal() {
const c = this.core.cfg, s = this.core.state;
const cap = this.core.statCap();
const pass = this.core.passLine();
const secs = (c.TUTORIAL || []).map((t) => `
      <div class="dg-help-sec">
        <div class="dg-help-sec-title">${this.tpl(t.title)}</div>
        <p>${(t.lines || []).map((l) => this.reviewTutorialLine(l, t)).join("<br>")}</p>
      </div>`).join("");
this.el.insertAdjacentHTML("beforeend", `
      <div class="dg-modal-mask" data-action="close-modal">
        <div class="dg-modal dg-help">
          <div class="dg-title">${this.icon("info", 15)} 玩法简要说明</div>
          <p class="dg-sub">随时点右上角「说明」回来看。当前：第 ${s.week} 周；本阶段最低评审周期 ${this.core.minWeeks(s.ver)} 周</p>
          <div class="dg-help-goal">
            <b>本阶段目标</b>：${this.modelDims(s).map(d=>d.label+" ≥ "+Math.ceil(this.modelPass(d.key))).join("、")}，总评 ≥ ${Math.ceil(pass.score)} 即通过内部评审。
          </div>
          <div class="dg-help-body">${secs}</div>
          <div class="dg-actions">
            <button class="dg-btn dg-btn-primary" data-action="close-modal">关闭</button>
          </div>
        </div>
      </div>`);
this.paginateModal(this.el.lastElementChild,"help");
},
openTeam() { this._modal = "team"; this.render({ soft: true }); },
renderTeamModal() {
const s = this.core.state;
const alive = s.engineers.filter((e) => !e.resigned);
const gone = s.engineers.filter((e) => e.resigned);
const avg = (k) => alive.length
? Math.round(alive.reduce((a, e) => a + this.statusVal(e, k), 0) / alive.length) : 0;
const salary = alive.reduce((a, e) => a + (e.salary || 0), 0);
const risks = alive.filter((e) => this.statusVal(e, "energy") < 30);
const cards = alive.map((e) => this.engCard(e)).join("");
this.el.insertAdjacentHTML("beforeend", `
      <div class="dg-modal-mask" data-action="close-modal">
        <div class="dg-modal dg-team-modal">
          <div class="dg-title">👥 团队状态 · 第 ${s.week} 周</div>
          <p class="dg-sub">体力决定产出效率；潜力三维（代码·算法·文字）决定词条升级概率——随时留意这两条。</p>
          <div class="dg-team-summary">
            <span>在岗 <b>${alive.length}</b> 人</span>
            <span>平均体力 <b>${avg("energy")}</b></span>
            <span>平均潜力 <b>${this.avgTalent(alive)}</b></span>
            <span>月薪合计 <b>${fmtMoney(salary * 2)}</b></span>
          </div>
          ${risks.length ? `<div class="dg-team-alert">⚠️ ${risks.map((e) => e.name).join("、")} 状态亮红灯，建议尽快用团队类行动卡处理。</div>` : ""}
          <div class="dg-team-list">${cards || '<div class="dg-empty">当前没有在职工程师</div>'}</div>
          ${gone.length ? `<p class="dg-dim dg-team-gone">已离职：${gone.map((e) => e.name).join("、")}</p>` : ""}
          <div class="dg-actions">
            <button class="dg-btn dg-btn-primary" data-action="close-modal">关闭</button>
          </div>
        </div>
      </div>`);
},
disposeOfficeReadPages() {
const run=this._officeReadPages;if(!run)return;run.dispose();
run.body.querySelectorAll('[data-read-node]').forEach(n=>{n.hidden=false;n.removeAttribute('data-read-node');});
run.card.classList.remove('office-readable');run.body.classList.remove('reward-one-group');delete run.body.dataset.readGroup;
this._officeReadPages=null;
},
codexPerPage(){const w=window.innerWidth||0,h=window.innerHeight||0;return w&&h&&w>h&&h<=450?1:3;},
fitOfficeReadPages(card,body) {
this.disposeOfficeReadPages();
return false;
},
readNodePages(body,footer,groups,initial,opts){
const all={label:'',units:groups.flatMap(g=>g.units)},nodes=[...new Set(groups.flatMap(g=>g.units.flat().concat(g.parents)))];
nodes.forEach(n=>n.dataset.readNode='');body.classList.add('read-single-page');
const run={page:0,views:[all],closed:false,body,groups};
run.show=()=>{if(run.closed)return;run.page=0;body.classList.remove('reward-one-group');delete body.dataset.readGroup;};
run.layout=()=>{if(!run.closed&&body.isConnected)run.show();};
run.dispose=()=>{run.closed=true;body.classList.remove('read-single-page');};
run.show();return run;
},mountRankPages(){const old=this._rankPages,R=this._rank,key=R&&R.period+"|"+R.ver,card=this._rankMask&&this._rankMask.firstChild;const initial=old&&old.owner===R&&old.key===key?old.page:0;if(old)old.dispose();if(!card)return;card.classList.add("lb-readable");const list=card.querySelector(".lb-list");if(!list)return;const body=document.createElement("div");body.className="lb-read-content";const info=document.createElement("div");info.className="lb-info";const copy=[card.querySelector(".dg-sub"),card.querySelector(".lb-mine")].filter(Boolean),head=card.querySelector(".lb-head");copy.forEach(n=>info.appendChild(n));card.insertBefore(body,head);body.appendChild(info);body.appendChild(head);body.appendChild(list);const run=this.readNodePages(body,card.querySelector(".dg-actions"),[{label:"\u73A9\u5BB6\u6392\u540D",parents:[head,list],units:[...list.children].map(n=>[head,n])},{label:"\u89C4\u5219\u548C\u6211\u7684\u540D\u6B21",parents:[info],units:copy.map(n=>[n])}],initial);run.owner=R;run.key=key;this._rankPages=run;run.layout()},disposeRewardPages(){const old=this._rewardPages;if(old)old.stages.forEach(p=>p.dispose())},mountRewardPages(){const old=this._rewardPages,s=this.core.state,same=old&&old.state===s&&old.result===s.result,memo={};if(same)old.stages.forEach((p,n)=>memo[n]=p.page);this.disposeRewardPages();const root=this.el.querySelector(".aqua-stage");if(!root)return;root.classList.add("reward-readable");const stages=new Map;const groups=n=>{const act=root.querySelector("#act-"+n),body=act.querySelector(".chart-card,.act2-grid,.act3-grid"),parent=sel=>body.querySelector(sel),each=sel=>[...body.querySelectorAll(sel)].map(x=>[x]);let rows=[];if(n===1)rows=[{label:"\u6A21\u578B\u8868\u73B0",parents:[parent(".chart-main")],units:[[parent(".chart-main")]]},{label:"\u8BC4\u5206\u4E0E\u80FD\u529B",parents:[parent(".chart-side")],units:each(".side-row")}];if(n===2){const panels=[...body.children];rows=[{label:"\u6A21\u578B\u80FD\u529B\u699C",parents:[panels[0],parent("#rankList")],units:each("#rankList>*")},{label:"\u7528\u6237\u53CD\u9988",parents:[panels[1],parent("#feedList")],units:each(".rank-tip,.user-stat,.feed-card")}]}if(n===3){const card=parent("#bonusCard"),chips=parent(".bonus-break"),units=[[parent(".bonus-label"),parent(".bonus-amount")],...each(".break-chip"),...each(".brand-benefit,.bonus-fund")];rows=[{label:"\u7ED3\u7B97\u5956\u91D1",parents:[card,chips],units}];const up=parent("#upgradePanel");if(up)rows.push({label:"\u5DE5\u7A0B\u5E08\u6210\u957F",parents:[up,parent("#upgradeList")],units:each(".upgrade-item")})}rows.forEach(g=>{g.parents=g.parents.filter(Boolean);g.units=g.units.map(u=>u.filter(Boolean)).filter(u=>u.length)});return{act,body,rows}};for(let n=1;n<=3;n++){const g=groups(n);stages.set(n,this.readNodePages(g.body,g.act.querySelector(".act-foot"),g.rows,memo[n],n===3?{singleWhenWide:true}:undefined))}this._rewardPages={state:s,result:s.result,stages}},
openRank() {
this.closeRank();
const state=this.curState(),boards=((window.GameCfg||{}).EMBODIED||{}).CLOUD_BOARDS||{};
const ver=state&&boards[state.ver] ? state.ver : "V4.5";
this._rank = { period: "all", ver, list: null, mine: null, loading: false, err: "" };
const mask = document.createElement("div");
mask.className = "dg-modal-mask lb-mask";
mask.id = "toy-rank-modal";
mask.innerHTML = '<div class="dg-modal lb-modal" role="dialog" aria-modal="true" aria-label="模型总榜"></div>';
document.body.appendChild(mask);
const card = mask.firstChild;
card.innerHTML = this.rankHtml();
this._rankMask = mask;
this.mountRankPages();
if (window.Menu && window.Menu.syncAnimation) window.Menu.syncAnimation();
card.addEventListener("click", (e) => this.onRankClick(e));
mask.addEventListener("click", (e) => { if (e.target === mask) this.closeRank(); });
this._rankEsc = (e) => { if (e.key === "Escape") this.closeRank(); };
window.addEventListener("keydown", this._rankEsc);
this.rankRefresh();
},
closeRank() {
this._rankRequest=(this._rankRequest||0)+1;
if(this._rankPages)this._rankPages.dispose();this._rankPages=null;
if (this._rankMask) { this._rankMask.remove(); this._rankMask = null; }
if (this._rankEsc) { window.removeEventListener("keydown", this._rankEsc); this._rankEsc = null; }
if (window.Menu && window.Menu.syncAnimation) window.Menu.syncAnimation();
},
onRankClick(e) {
const b = e.target.closest("[data-rank-act]");
if (!b) return;
const act = b.dataset.rankAct;
if (window.SFX) SFX.play("click");
if (act === "close") { this.closeRank(); return; }
if (act === "period") { this._rank.period = b.dataset.period || "all"; this._rank.loading=false; this.rankRefresh(); return; }
if (act === "stage") { this._rank.ver=b.dataset.ver||"V4.5";this._rank.list=null;this._rank.mine=null;this._rank.loading=false;this.rankRefresh();return; }
if (act === "retry") { this._rank.err = ""; this.rankRefresh(true); return; }
},
rankRefresh(force) {
const tc = window.ToyCloud, R = this._rank;
const card = this._rankMask && this._rankMask.firstChild;
if (!card) return;
const request=this._rankRequest=(this._rankRequest||0)+1,period=R.period,ver=R.ver||"V4.5";
const valid=()=>request===this._rankRequest&&this._rank===R&&R.period===period&&R.ver===ver&&this._rankMask&&this._rankMask.firstChild===card;
if (!tc || !tc.available()) { R.loading=false;R.list=null;R.mine=null;card.innerHTML=this.rankHtml();this.mountRankPages();return; }
R.loading = true; R.err = "";card.innerHTML = this.rankHtml();this.mountRankPages();
Promise.all([tc.fetchBoard(period,ver,force),tc.fetchMine(period,ver,force)])
.then(([b,m])=>{
if(!valid())return;R.loading=false;
if(b&&b.ok){R.list=b.list||[];}else{R.list=null;R.err=b&&b.reason||"error";}
R.mine=m&&m.ok?m:null;card.innerHTML=this.rankHtml();this.mountRankPages();
}).catch(()=>{if(!valid())return;R.loading=false;R.list=null;R.mine=null;R.err="error";card.innerHTML=this.rankHtml();this.mountRankPages();});
},
rankHtml() {
const tc = window.ToyCloud;
const R = this._rank || { period: "all", list: null, mine: null, loading: false, err: "" };
const st = this.curState();
const ver=R.ver||((st&&(((window.GameCfg||{}).EMBODIED||{}).CLOUD_BOARDS||{})[st.ver])?st.ver:"V4.5");
const boards=((window.GameCfg||{}).EMBODIED||{}).CLOUD_BOARDS||{},isBody=!!boards[ver];
const unlocked=isBody ? !!(st&&boards[st.ver]) : (tc ? tc.unlocked(st) : false);
const title=isBody?ver+" 真实玩家云榜":"V4.5 模型总榜";
const rule=isBody?"本阶段评审分数越高越靠前；同分时训练周数少者靠前，再同则先提交者靠前。":"最终评审分数越高越靠前；同分时 V4.5 周数少者靠前，再同则先上榜者靠前。";
if (!unlocked) {
return '<div class="dg-title">🏆 '+this.esc(title)+'</div>' +
'<p class="dg-sub">旧总榜需要在 V4.5 拿到评审第一名；具身智能四阶段分别使用独立真实玩家云榜。</p>' +
'<div class="lb-lock">' +
'<div class="lb-lock-row"><span class="lb-lock-k">阶段进度</span><span class="lb-lock-v">' +
(st ? (st.ver || "V1") : "尚未开局") + '</span></div>' +
'<div class="lb-lock-row"><span class="lb-lock-k">评审名次</span><span class="lb-lock-v">' +
(st && st.rank != null ? ("第 " + st.rank + " 名") : "—") + '</span></div>' +
'<p class="lb-lock-tip">排名规则：最终评审分数越高越靠前；同分时 V4.5 训练周数越少越靠前；再相同则先上榜者靠前。</p>' +
'</div>' +
'<div class="dg-actions"><button class="dg-btn dg-btn-ghost" data-rank-act="close">关闭</button></div>';
}
if (!tc || !tc.available()) {
const why = (tc && tc.hasSdk())
? "排行榜需要在 B站 Toy 页面内使用（请从 Toy 页面进入，并确认已登录 B站）。"
: "当前离线，无法读取真实玩家云榜；本地不提供模拟名次。";
return '<div class="dg-title">🏆 '+this.esc(title)+'</div>' +
'<p class="dg-sub">' + why + '</p>' +
'<div class="dg-actions"><button class="dg-btn dg-btn-ghost" data-rank-act="close">关闭</button></div>';
}
const stageTabs=st&&boards[st.ver]?'<div class="lb-tabs lb-stage-tabs">'+Object.keys(boards).map(stage=>'<button class="lb-tab'+(ver===stage?' on':'')+'" data-rank-act="stage" data-ver="'+this.esc(stage)+'">'+this.esc(stage)+'</button>').join('')+'</div>':'';
const tabs = [["all", "总榜"], ["month", "月榜"], ["week", "周榜"]]
.map(([k, label]) =>
'<button class="lb-tab' + (R.period === k ? " on" : "") + '" data-rank-act="period" data-period="' + k + '">' + label + '</button>')
.join("");
let body;
if (R.loading) body = '<div class="lb-tip">榜单加载中…</div>';
else if (R.err) body = '<div class="lb-tip">榜单暂时不可用，请稍后再试。</div>';
else if (!R.list || !R.list.length) body = '<div class="lb-tip">本阶段还没有玩家提交成绩。</div>';
else {
const mineRank = (R.mine && R.mine.ranked) ? R.mine.rank : -1;
const myMeta = R.mine && R.mine.ranked ? this.myModelMeta(R.mine.score, ver) : "";
const rows = R.list.map((it) => {
const u = tc.unpackScore(it.score,ver);
const top3 = it.rank <= 3 ? (" lb-top" + it.rank) : "";
const isMe = mineRank > 0 && it.rank === mineRank && Number(it.score) === Number(R.mine.score);
return '<div class="lb-row' + top3 + (isMe ? " lb-me" : "") + '">' +
'<span class="lb-no">' + it.rank + '</span>' +
'<span class="lb-name">' + this.esc(it.nickname || "匿名") +
(isMe && myMeta ? '<span class="lb-meta">' + this.esc(myMeta) + '</span>' : "") +
'</span>' +
'<span class="lb-score">' + Math.round(u.score) + '</span>' +
'<span class="lb-weeks">' + u.weeks + ' 周</span>' +
'</div>';
}).join("");
body = '<div class="lb-head"><span class="lb-no">名次</span><span class="lb-name">训练师</span>' +
'<span class="lb-score">评审分</span><span class="lb-weeks">周数</span></div>' +
'<div class="lb-list">' + rows + '</div>';
}
let mineLine = "";
if (R.mine && R.mine.ranked) {
const u = tc.unpackScore(R.mine.score,ver);
mineLine = '<div class="lb-mine">我的名次 <b>第 ' + R.mine.rank + ' 名</b>' +
'<span class="lb-mine-sub">' + Math.round(u.score) + ' 分 · ' + Math.round(u.weeks) + ' 周</span></div>';
} else if (R.mine && R.mine.ranked === false) {
mineLine = '<div class="lb-mine lb-mine-off">你还没有上榜成绩</div>';
}
return '<div class="dg-title">🏆 '+this.esc(title)+'</div>' +
'<p class="dg-sub">'+this.esc(rule)+'</p>' +
stageTabs+'<div class="lb-tabs">' + tabs + '</div>' +
mineLine + body +
'<div class="dg-actions">' +
'<button class="dg-btn dg-btn-ghost" data-rank-act="retry">刷新</button>' +
'<button class="dg-btn dg-btn-primary" data-rank-act="close">关闭</button>' +
'</div>';
},
esc(v) {
return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => (
{ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
},
rankEntryBtn() {
const tc = window.ToyCloud;
const st = this.curState();
const body=st&&((((window.GameCfg||{}).EMBODIED||{}).CLOUD_BOARDS||{})[st.ver]);
if (!body&&(!tc||!tc.unlocked(st))) return "";
return '<button class="dg-btn" type="button" data-action="open-rank">🏆 '+(body?'查看 '+this.esc(st.ver)+' 云榜':'查看总榜')+'</button>';
},
curState() {
if (this.core && this.core.state) return this.core.state;
try {
const gs = this.save || window.GameSave;
const d = gs && gs.load && gs.load("auto");
return (d && d.state) || null;
} catch (e) { return null; }
},
myModelMeta(packed, ver) {
const st = this.curState(), tc = window.ToyCloud;
const fallback = "历史成绩 · 模型信息未匹配";
if (!st || !tc || !Number.isSafeInteger(Number(packed))) return fallback;
const decoded = tc.unpackScore(packed, ver), factor = ["V5","V5.5","V6","V6.5"].includes(ver) ? 1 : 10;
const records = (st.codexLog || []).concat(st.modelHistory || [], Object.values(st.stageMarks || {}));
Object.values(st.codex || {}).forEach(e => { if (e) records.push(e.first, e.best, e.last); });
const matches = records.filter(x => x && x.name && x.arch && Number.isFinite(x.param) && x.param > 0
&& x.ver === ver && Number.isFinite(x.score)
&& Number.isFinite(x.week) && x.week === decoded.weeks
&& Math.round(x.score * factor) / factor === decoded.score
&& ["pass","excellent","top"].includes(x.verdict) && !x.missionFail && !x.retry);
const identities = new Map(matches.map(x => [JSON.stringify([x.name, x.arch, x.param]), x]));
if (identities.size !== 1) return fallback;
const snap = identities.values().next().value;
const parts = [snap.name, snap.param ? snap.param + "B" : "", snap.ver].filter(Boolean);
const limit = typeof tc.legalScoreCap === "function" ? tc.legalScoreCap(ver) : null;
if (limit != null && decoded.score > Math.round(limit * factor) / factor) parts.push("历史版本成绩");
return parts.join(" · ");
},
cloudStatusLine() {
const tc = window.ToyCloud;
if (!tc) return '<div class="cloud-line">云端存档：模块未加载</div>';
if (!tc.available()) {
const why = tc.hasSdk() ? "请从 B站 Toy 页面进入" : "当前环境不支持";
return '<div class="cloud-line cloud-line-off">云端存档：' + why + '</div>';
}
const st = tc.status();
if (st.cloudProtected) return '<div class="cloud-line cloud-line-off">' + this.escHtml(tc.errorMessage("cloud-exists")) + '</div>';
if (st.broken) return '<div class="cloud-line cloud-line-off">云端存档：暂时不可用，稍后可手动重试</div>';
if (!st.lastSyncAt) {
return st.failStreak > 0
? '<div class="cloud-line cloud-line-off">云端存档：连接异常，可点「上传云端」重试</div>'
: '<div class="cloud-line">云端存档：本次会话尚未同步</div>';
}
const d = new Date(st.lastSyncAt);
const pad = (n) => String(n).padStart(2, "0");
return '<div class="cloud-line">云端存档：已同步 ' + pad(d.getHours()) + ":" + pad(d.getMinutes()) +
(st.lastSyncSlim ? "（精简档）" : "") + '</div>';
},
refreshSaveModal() {
const sm = this.el && this.el.querySelector("#saveModal");
if (sm) { if(this._modalPages&&this._modalPages.mask===sm)this.disposeModalPages(false); sm.remove(); }
},
cloudOperationMessage(reason, code) {
const tc = window.ToyCloud;
return tc && tc.errorMessage ? tc.errorMessage(reason, code) : "云存档操作失败，请稍后重试。";
},
updateCloudButtons() {
if (!this.el) return;
const busy = !!(this._cloudUploadBusy || this._cloudRestoreBusy);
this.el.querySelectorAll('#saveModal [data-action^="cloud-"]').forEach((button) => { button.disabled = busy; });
},
cloudUploadNow(overwrite) {
if (this._cloudUploadBusy || this._cloudRestoreBusy) return;
const tc = window.ToyCloud;
if (!tc || !tc.available()) { this.toast(this.cloudOperationMessage("unavailable")); return; }
this._cloudUploadBusy = true;
this.updateCloudButtons();
this.toast("正在上传云端…");
return Promise.resolve().then(() => tc.flush(this.save.buildSnapshot(this.core.state), overwrite === true)).then((r) => {
if (this._modal !== "save") return;
if(r&&r.reason==="cloud-exists"){
const copy=((this.core.cfg.CLOUD_SAVE||{}).UI)||{};
this.askConfirm(copy.CONFIRM_TITLE,copy.CONFIRM_BODY,()=>this.cloudUploadNow(true),{okText:copy.CONFIRM_BUTTON,danger:true});
return;
}
this.toast(r && r.ok ? "已同步到云端" : this.cloudOperationMessage(r && r.reason, r && r.code));
this.refreshSaveModal();
this.render({ soft: true });
}).catch(() => {
if (this._modal === "save") this.toast(this.cloudOperationMessage("error"));
}).finally(() => { this._cloudUploadBusy = false; this.updateCloudButtons(); });
},
cancelCloudRestore() {
this._cloudRestoreToken = (this._cloudRestoreToken || 0) + 1;
this._cloudRestoreBusy = false;
this._pendingCloudRestore = null;
const tc = this._cloudRestoreCloud;
this._cloudRestoreCloud = null;
if (tc && tc.endRestore) tc.endRestore();
this.updateCloudButtons();
},
cloudRestore() {
if (this._cloudRestoreBusy || this._cloudUploadBusy || this._confirmOpen) return;
const tc = window.ToyCloud;
if (!tc || !tc.available()) { this.toast(this.cloudOperationMessage("unavailable")); return; }
const tok = (this._cloudRestoreToken || 0) + 1;
this._cloudRestoreToken = tok;
this._cloudRestoreBusy = true;
if (tc.beginRestore) { tc.beginRestore(); this._cloudRestoreCloud = tc; }
this.updateCloudButtons();
this.toast("正在读取云端存档…");
return Promise.resolve().then(() => tc.fetchCloudSnapshot()).then((r) => {
if (tok !== this._cloudRestoreToken) return;
if (!r || !r.obj) {
this.toast(this.cloudOperationMessage(r && r.reason, r && r.code));
this.cancelCloudRestore();
return;
}
if (this._modal !== "save" || this._confirmOpen) { this.cancelCloudRestore(); return; }
this._pendingCloudRestore = r.obj;
this.refreshSaveModal();
this._modal = null;
this.askConfirm(
"读取云端存档",
"将用云端存档覆盖本机的自动存档，并立即进入该进度。本机其他手动槽位不受影响，云端存档也不会被删除。",
() => this.applyCloudRestore(),
{ okText: "覆盖并进入", onCancel: () => this.cancelCloudRestore() });
}).catch(() => {
if (tok !== this._cloudRestoreToken) return;
this.toast(this.cloudOperationMessage("error"));
this.cancelCloudRestore();
});
},
applyCloudRestore() {
const rec = this._pendingCloudRestore;
try {
if (!rec) return;
const result = this.save.restoreSnapshot ? this.save.restoreSnapshot(rec, this.core) : { ok: false, reason: "unavailable" };
if (!result.ok) { this.toast(this.cloudOperationMessage(result.reason)); return; }
const tc=window.ToyCloud;if(tc&&tc.acceptCloudRestore)tc.acceptCloudRestore(rec);
this._tickFails = 0; this._tickRecovered = false;
this.render();
this.toast(result.stageSaved === false ? "已载入云端存档；阶段备份未保存，自动存档已保留。" : "已载入云端存档");
} catch (_) {
this.toast(this.cloudOperationMessage("load-error"));
} finally { this.cancelCloudRestore(); }
},
cloudForget() {
if (this._cloudRestoreBusy || this._cloudUploadBusy) return;
const tc = window.ToyCloud;
if (!tc || !tc.available()) { this.toast("当前环境不支持云存档"); return; }
tc.forgetCloud().then((ok) => {
this.toast(ok ? "已删除云端存档" : "删除失败，请稍后再试");
this.refreshSaveModal();
this.render({ soft: true });
}).catch(() => { this.toast("删除失败"); });
},
renderSaveModal() {
const slots = [];
for (let i = 0; i < this.save.MAX_SLOTS; i++) {
const d = this.save.load(i);
const slotNo = "槽位 " + (i + 1);
slots.push(this.saveSlotHTML(i, slotNo, d));
}
const auto = this.save.load("auto");
if (auto) {
slots.push(this.saveSlotHTML("auto", "📌 自动存档", auto, { auto: true }));
}
const anchor = (this.save.loadStage) ? this.save.loadStage() : null;
if (anchor) {
slots.push(this.saveSlotHTML("stage", "🛟 本阶段开头（自动锚点）", anchor, { stage: true }));
}
this.el.insertAdjacentHTML("beforeend", `
      <div class="dg-modal-mask" id="saveModal" data-action="close-modal">
        <div class="dg-modal dg-modal-save">
          <div class="dg-title">💾 存档管理</div>
          <p class="dg-sub">点击任一槽位可保存/覆盖；已有存档的槽位支持读档与删除。</p>
          <div class="dg-save-list">${slots.join("")}</div>
          <!-- Toy 云存档区（2026-09-17）：非 Toy 环境整块显示「当前环境不支持」，
               不会摆出点了没反应的按钮。云端只同步、不自动覆盖本地 —— 恢复必须玩家手动点。 -->
          <div class="cloud-box">
            ${this.cloudStatusLine()}
            <div class="cloud-actions">
              <button class="dg-btn dg-btn-ghost" data-action="cloud-upload" ${this._cloudUploadBusy || this._cloudRestoreBusy ? "disabled" : ""}>立即同步</button>
              <button class="dg-btn dg-btn-ghost" data-action="cloud-restore" ${this._cloudUploadBusy || this._cloudRestoreBusy ? "disabled" : ""}>从云端恢复</button>
              <button class="dg-btn dg-btn-ghost" data-action="cloud-forget" ${this._cloudUploadBusy || this._cloudRestoreBusy ? "disabled" : ""}>删除云端存档</button>
            </div>
          </div>
          <div class="dg-actions">
            <button class="dg-btn dg-btn-primary" data-action="save-here">保存到第一个空槽</button>
            <button class="dg-btn dg-btn-ghost" data-action="close-modal">关闭</button>
          </div>
        </div>
      </div>`);
},
saveSlotHTML(slot, name, d, opts) {
const o = opts || {};
const empty = !d;
const verTxt = d && ((d.meta && d.meta.ver) || (d.state && d.state.ver) || "V1");
const info = empty
? `<div class="dg-dim">（空槽位）</div>`
: `<div class="dg-dim">${verTxt} 阶段 · 经费 ${fmtMoney(d.meta.funding)} · 品牌 ${d.meta.brand}<br>代码 ${d.meta.code} 文字 ${d.meta.text} 安全 ${d.meta.safety} 稳定 ${d.meta.stability}</div>`;
const ops = [];
if (o.auto || o.stage) {
const key = o.stage ? "stage" : "auto";
ops.push(`<button class="dg-btn dg-btn-sm" data-action="load-slot" data-slot="${key}">读档</button>`);
} else {
ops.push(`<button class="dg-btn dg-btn-sm dg-btn-accent" data-action="save-slot" data-slot="${slot}">${empty ? "保存到此" : "覆盖保存"}</button>`);
if (!empty) {
ops.push(`<button class="dg-btn dg-btn-sm" data-action="load-slot" data-slot="${slot}">读档</button>`);
ops.push(`<button class="dg-btn dg-btn-sm dg-btn-ghost dg-btn-danger" data-action="del-slot" data-slot="${slot}">删除</button>`);
}
}
return `
      <div class="dg-save-row${empty ? " dg-save-row-empty" : ""}">
        <div class="dg-save-info">
          <div class="dg-save-name">${name}${d ? " · " + d.name : ""}</div>
          ${info}
        </div>
        <div class="dg-save-ops">${ops.join("")}</div>
      </div>`;
},
renderOfficeModal(key) {
let box = this.el.querySelector("#modalContainer");
if (!box) {
this.renderOffice();
box = this.el.querySelector("#modalContainer");
if (!box) return;
}
const meta = this.officeModalMeta(key);
const card = box.querySelector(".modal-card");
if (card && box.dataset.modalKey === key) {
if (key === "test") return;
const bodyEl = card.querySelector(".modal-body");
const footEl = card.querySelector(".modal-footer");
if (bodyEl) {
if (key !== "news") {
const nextHtml = this.officeModalBody(key);
if (bodyEl.dataset.sig === nextHtml) {
const pages=this._officeReadPages;
if (footEl && !(pages && pages.body===bodyEl && pages.footerHTML===(meta.footer||""))) footEl.innerHTML = meta.footer || "";
this.afterModalRender(false);
return;
}
bodyEl.dataset.sig = nextHtml;
}
const feedEl = key === "news" ? bodyEl.querySelector(".nw-feed") : null;
const st0 = feedEl ? feedEl.scrollTop : 0;
const openIds = feedEl ? [...feedEl.querySelectorAll(".nw-cmts:not([hidden])")]
.map((el) => { const p = el.closest(".nw-post"); const b = p && p.querySelector(".nw-cmt-btn"); return b && b.dataset.id; })
.filter(Boolean) : [];
const animSnap = this.snapAnim(bodyEl);
bodyEl.innerHTML = this.officeModalBody(key);
this.restoreAnim(bodyEl, animSnap);
this.invalidateFit();
if (feedEl) {
const newFeed = bodyEl.querySelector(".nw-feed");
if (newFeed) {
newFeed.scrollTop = st0;
openIds.forEach((id) => {
const btn = newFeed.querySelector('.nw-cmt-btn[data-id="' + id + '"]');
const cbox = btn && btn.closest(".nw-post") && btn.closest(".nw-post").querySelector(".nw-cmts");
if (btn && cbox) { cbox.hidden = false; btn.classList.add("on"); }
});
}
}
bodyEl.classList.add("no-pop");
}
if (footEl) footEl.innerHTML = meta.footer || "";
this.afterModalRender(false);
return;
}
if (card) {
const bodyEl = card.querySelector(".modal-body");
const footEl = card.querySelector(".modal-footer");
const titleEl = card.querySelector(".modal-title span");
const iconEl = card.querySelector(".title-icon");
if (bodyEl) bodyEl.style.opacity = "0";
if (footEl) footEl.style.opacity = "0";
const apply = () => {
if (titleEl) titleEl.textContent = meta.title;
if (iconEl) iconEl.innerHTML = this.icon(meta.icon, 15);
if (bodyEl) {
bodyEl.className = "modal-body " + (meta.bodyClass || "");
const nextHtml = this.officeModalBody(key);
bodyEl.innerHTML = nextHtml;
bodyEl.dataset.sig = nextHtml;
this.invalidateFit();
bodyEl.style.opacity = "1";
}
if (footEl) { footEl.innerHTML = meta.footer || ""; footEl.style.opacity = "1"; }
this.afterModalRender(true);
};
setTimeout(apply, 120);
box.dataset.modalKey = key;
return;
}
box.dataset.modalKey = key;
box.innerHTML = `
      <div class="modal-mask">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">
              <div class="title-icon">${this.icon(meta.icon, 15)}</div>
              <span>${meta.title}</span>
            </div>
            <button class="modal-close" data-action="office-modal-close" title="关闭">${this.icon("x", 13)}</button>
          </div>
          <div class="modal-body ${meta.bodyClass || ""}"></div>
          <div class="modal-footer">${meta.footer || ""}</div>
        </div>
      </div>`;
{
const nb = box.querySelector(".modal-body");
const nextHtml = this.officeModalBody(key);
if (nb) { nb.innerHTML = nextHtml; nb.dataset.sig = nextHtml; }
}
this.invalidateFit();
this.afterModalRender(true);
},
afterModalRender(replay) {
if (this._pointerInCard) replay = false;
this.animateCoverageBars(replay !== false);
this.animatePanelCards(replay !== false);
this.fitModalBody();
this.primeVoicesIn(this.el.querySelector("#modalContainer"));
},
fitModalBody() {
const card = this.el.querySelector(".modal-card");
if (!card) return;
const body = card.querySelector(".modal-body");
if (!body) return;
if(this.fitOfficeReadPages(card,body))return;
const inspection = this.core.state;
const inspectionKind = inspection.minigame && inspection.minigame.kind;
const scrollInspection = false;
body.classList.toggle("inspection-scroll-body", scrollInspection);
if (scrollInspection) {
body.style.zoom = "";
this._fitDone = true;
this._fitK = 1;
return;
}
if (body.classList && (body.classList.contains("news-weibo-body")
|| body.classList.contains("test-modal-body"))) {
if (body.style.zoom) body.style.zoom = "";
this._fitDone = true;
this._fitK = 1;
return;
}
if (this._pointerInCard) return;
if (this._fitDone) return;
if (this._fitting) return;
if (this._fitAt && Date.now() - this._fitAt < 100) {
if (!this._fitRetry) {
this._fitRetry = setTimeout(() => { this._fitRetry = 0; this._fitAt = 0; this.fitModalBody(); }, 120);
}
return;
}
this._fitting = true;
this._fitAt = Date.now();
try {
this._fitBodyNow(card, body);
} finally {
this._fitting = false;
}
},
_fitBodyNow(card, body) {
body.style.zoom = "";
const head = card.querySelector(".modal-header");
const foot = card.querySelector(".modal-footer");
const avail = Math.max(0, Math.min(body.clientHeight, card.clientHeight - (head ? head.offsetHeight : 0) - (foot ? foot.offsetHeight : 0)) - 6);
const offsetY = node => { let y=0; for(let p=node;p;p=p.offsetParent)y+=p.offsetTop || 0; return y; };
const style = window.getComputedStyle(body);
const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
let need = body.scrollHeight;
body.querySelectorAll('.team-list-col,.team-detail-col,.recruit-list-col,.recruit-detail-col').forEach(column => {
const y = Math.max(0, offsetY(column) - offsetY(body));
need = Math.max(need, y + column.scrollHeight, column.scrollHeight + padding);
});
if (!avail || !need) {
this._fitDone = false;
this._fitK = 1;
if (!this._fitRetry && (this._fitRetryN = (this._fitRetryN || 0) + 1) <= 8) {
this._fitRetry = setTimeout(() => { this._fitRetry = 0; this._fitAt = 0; this.fitModalBody(); }, 120);
}
return;
}
this._fitRetryN = 0;
this._fitDone = true;
if (need <= avail + 1) { this._fitK = 1; return; }
const k = Math.max(0.3, Math.min(1, avail / need));
if (k >= 0.999) { body.style.zoom = ""; this._fitK = 1; return; }
const cur = this._fitK != null ? this._fitK : (parseFloat(body.style.zoom) || 1);
if (cur <= k && Math.abs(k - cur) < 0.02) { body.style.zoom = cur.toFixed(4); return; }
this._fitK = k;
body.style.zoom = k.toFixed(4);
},
invalidateFit() {
this._fitDone = false;
},
animatePanelCards(replay) {
const cards = this.el.querySelectorAll(".modal-card .pop-in");
cards.forEach((c, i) => {
if (!replay) { c.style.animation = ""; return; }
c.style.animation = "none";
void c.offsetWidth;
c.style.animation = `cardPopIn 0.45s cubic-bezier(0.2, 1.2, 0.3, 1) ${i * 0.05}s forwards`;
});
},
domPathOf(root, el) {
const parts = [];
let cur = el;
while (cur && cur !== root) {
const p = cur.parentNode;
if (!p) return null;
parts.unshift(Array.prototype.indexOf.call(p.children, cur));
cur = p;
}
return cur === root ? parts : null;
},
elByPath(root, parts) {
let cur = root;
for (let i = 0; i < parts.length; i++) {
if (!cur || !cur.children || !cur.children[parts[i]]) return null;
cur = cur.children[parts[i]];
}
return cur;
},
snapAnim(root) {
const out = [];
if (!root || !root.querySelectorAll) return out;
root.querySelectorAll("*").forEach((el) => {
if (!el.getAnimations) return;
let list;
try { list = el.getAnimations(); } catch (e) { return; }
if (!list.length) return;
const path = this.domPathOf(root, el);
if (!path) return;
list.forEach((a) => {
const name = a.animationName;
if (!name) return;
let iter = 1;
try { iter = a.effect.getTiming().iterations; } catch (e) {}
out.push({ path: path, name: name, t: a.currentTime || 0, inf: iter === Infinity || iter === "Infinity" });
});
});
return out;
},
restoreAnim(root, snap) {
if (!root || !snap || !snap.length) return;
snap.forEach((s) => {
const el = this.elByPath(root, s.path);
if (!el || !el.getAnimations) return;
let list;
try { list = el.getAnimations(); } catch (e) { return; }
for (const a of list) {
if (a.animationName !== s.name) continue;
try {
if (s.inf) a.currentTime = s.t + (a.currentTime || 0);
else a.finish();
} catch (e) {}
break;
}
});
},
closeOfficeModal() {
this.disposeOfficeReadPages();
const box = this.el.querySelector("#modalContainer");
if (!box || !box.dataset.modalKey) return;
box.innerHTML = "";
delete box.dataset.modalKey;
},
refreshOfficeBody() {
const box = this.el.querySelector("#modalContainer");
if (!box) return;
const key = box.dataset.modalKey || this.core.state.officeModal;
if (!key) return;
const card = box.querySelector(".modal-card");
if (!card) { this.renderOfficeModal(key); return; }
const meta = this.officeModalMeta(key);
const bodyEl = card.querySelector(".modal-body");
const footEl = card.querySelector(".modal-footer");
if (bodyEl) {
bodyEl.className = "modal-body " + (meta.bodyClass || "");
bodyEl.innerHTML = this.officeModalBody(key);
}
if (footEl) footEl.innerHTML = meta.footer || "";
this.invalidateFit();
this.afterModalRender(true);
},
officeModalMeta(key) {
const s = this.core.state;
const pr = this.planReady ? this.planReady() : { ok: true };
const planFooter = s.planDone
? `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>`
: `<button class="skew-btn ghost" data-action="office-modal-close">取消</button>`
+ (pr.corpusShort ? `<button class="skew-btn gold" data-action="om-plan-buycorpus">外包补足（${pr.corpusShort}亿）</button>` : "")
+ `<button class="skew-btn${pr.ok ? "" : " disabled"}" data-action="om-plan-confirm"${pr.ok ? "" : " disabled"}>${pr.ok ? "确认立项" : pr.reason}</button>`;
const doing = s.focusBoost;
const focusFooter = doing
? `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button><button class="skew-btn disabled" disabled>攻关中…</button>`
: `<button class="skew-btn ghost" data-action="office-modal-close">取消</button><button class="skew-btn pink" data-action="om-focus-start">开始攻关</button>`;
const researching = s.paperResearch;
const paperSelected = this.core.paperOf(this._paperPick);
const paperReady = this._paperPick != null && paperSelected && !this.core.hasPaper(paperSelected.no)
&& (s.paperCandidates || []).some(id => this.core.paperNoOf(id) === paperSelected.no);
const paperFooter = researching
? `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button><button class="skew-btn disabled" disabled>研究中…</button>`
: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button><button class="skew-btn${paperReady ? "" : " disabled"}" data-action="om-paper-start"${paperReady ? "" : " disabled"}>开始研究</button>`;
const testable = this.core.canTest();
const reviewable = this.core.canReview();
const map = {
team: { title: "团队一览", icon: "users", bodyClass: "team-modal-body",
footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button><button class="skew-btn pink" data-action="office-modal" data-id="hire">去扩编招聘</button>` },
hire: { title: "扩编招聘", icon: "briefcase", bodyClass: "hire-modal-body",
footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>` },
recruit: { title: "招募工程师", icon: "briefcase", bodyClass: "recruit-modal-body",
footer: `<button class="skew-btn ghost" data-action="office-modal-close">取消</button><button class="skew-btn ghost" data-action="office-modal" data-id="hire">发布需求</button><button class="skew-btn pink" data-action="om-hire">录用</button>` },
news: { title: "鲸华社 · 热点", icon: "news", bodyClass: "news-weibo-body",
footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>` },
plan: { title: "新项目立项", icon: "file", bodyClass: "plan-modal-body", footer: planFooter },
focus: { title: "攻关训练", icon: "target", bodyClass: "", footer: focusFooter },
paper: { title: "论文研究", icon: "book", bodyClass: "", footer: paperFooter },
corpus: { title: "语料仓库", icon: "database", bodyClass: "",
footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>` },
shop: { title: "购买算力", icon: "cpu", bodyClass: "shop-modal-body",
footer: `<button class="skew-btn ghost" data-action="office-modal-close">取消</button><button class="skew-btn gold" data-action="om-buygpu"${this._shopPick && !(s.ownedGpus || []).includes(this._shopPick) ? "" : " disabled"}>${(s.ownedGpus || []).includes(this._shopPick) ? "已拥有该档位，请选择其他档位" : "确认购买"}</button>` },
test: { title: "模型测试", icon: "chat", bodyClass: "test-modal-body",
footer: `<button class="skew-btn ghost" data-action="om-test-restart">↺ 换个话题</button>${testable ? `<button class="skew-btn ghost" data-action="om-test-clear">清空对话</button>` : ""}` },
review: { title: "项目评审", icon: "shield", bodyClass: "review-modal-body",
footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button><button class="skew-btn${reviewable ? " pink" : " disabled"}" data-action="om-start-review"${reviewable ? "" : " disabled"}>开始评审</button>` },
guide: { title: "玩法说明", icon: "help", bodyClass: "",
footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>` },
dividend: { title: "进行中的事件", icon: "zap", bodyClass: "",
footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>` },
minigame: { title: "数据定期巡检", icon: "file", bodyClass: "mg-modal-body",
footer: s.minigame
? `${s.minigame.picked ? `<button class="skew-btn pink" data-action="mg-next">${s.minigame.round + 1 >= s.minigame.total ? "完成标注，看总结 ➜" : "下一题 ➜"}</button>` : ""}<button class="skew-btn ghost" data-action="mg-abandon">放弃巡检</button>`
: `<button class="skew-btn ghost" data-action="mg-done">完成巡检</button>` },
};
return map[key] || { title: key, bodyClass: "", footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>` };
},
officeModalBody(key) {
const s = this.core.state;
switch (key) {
case "team": return this.omTeam();
case "recruit": return this.omRecruit();
case "news": return this.omNews();
case "hire": return window.V35HireUI ? window.V35HireUI.panel(this) : this.omEmpty("hire");
case "corpus": return (this.core.v35On && this.core.v35On()) ? this.omCorpus() : this.omEmpty("corpus");
case "plan": return s.planDone ? this.omPlanDone() : this.omPlan();
case "focus": return s.planDone ? this.omFocus() : this.omEmpty("focus");
case "paper": return this.omPaper();
case "shop": return this.omShop();
case "test": return this.core.canTest() ? this.omTest() : this.omEmpty("test");
case "review": return s.planDone ? this.omReview() : this.omEmpty("review");
case "guide": return this.omGuide();
case "dividend": return this.omDividend();
case "minigame": return this.minigameBodyHTML();
default: return this.omEmpty(key);
}
},
omDividend() {
const s = this.core.state;
const dv = (s.v35 && s.v35.dividend) || null;
const rows = [];
if (dv && (dv.left || 0) > 0) {
const pct = Math.round((dv.pct || 0) * 100);
rows.push(`
        <div class="dve-card">
          <div class="dve-head"><span class="dve-tag">投资人分红</span><b class="dve-pct">${pct}%</b></div>
          <div class="dve-line">投资人要求后续 <b>${dv.left}</b> 笔收入需要分红 <b>${pct}%</b>（共 ${dv.times || dv.left} 笔）。</div>
          <div class="dve-line">每笔收益入账时先抽成再进账；抽满笔数后自动结束。</div>
          ${(dv.paid || 0) > 0 ? `<div class="dve-line dim">已累计抽成 ¥${Math.round(dv.paid / 10000)} 万</div>` : ""}
          <div class="dve-note">投资人注资、破产兜底款不算「收益」，不会被抽成。</div>
        </div>`);
}
if (s.investor) {
rows.push(`<div class="dve-card"><div class="dve-head"><span class="dve-tag">投资人已入局</span></div>
        <div class="dve-line">投资人在关注公司经营，后续可能提出新的要求。</div></div>`);
}
if (!rows.length) {
return `<div class="om-empty"><div class="om-empty-tip">当前没有进行中的事件</div></div>`;
}
return `<div class="dve-list">${rows.join("")}</div>`;
},
omEmpty(key) {
const e = (this.core.cfg.EMPTY_STATES || {})[key] || { img: "", text: "暂时没有内容" };
return `
      <div class="om-empty">
        <img src="${e.img}" alt="" onerror="this.style.display='none'">
        <div class="om-empty-tip">${e.text}</div>
      </div>`;
},
omSwap(sel, html, ms, after) {
const el = this.el.querySelector(sel);
if (!el) return false;
const d = ms == null ? 120 : ms;
this.invalidateFit();
if (!d) { el.innerHTML = html; if (after) after(); this.fitModalBody(); return true; }
el.style.opacity = "0";
el.style.transform = "translateY(8px)";
setTimeout(() => {
el.innerHTML = html;
el.style.opacity = "1";
el.style.transform = "none";
if (after) after();
this.fitModalBody();
}, d);
return true;
},
omTeam() {
const s = this.core.state;
const alive = s.engineers.filter((e) => !e.resigned);
const per = this.TEAM_PER_PAGE;
const pages = Math.max(1, Math.ceil(alive.length / per));
this._teamPage = Math.max(0, Math.min(pages - 1, this._teamPage || 0));
const pageList = alive.slice(this._teamPage * per, this._teamPage * per + per);
const rows = pageList.map((e) => {
const tier = this.core.tierOf(e);
return `
      <div class="team-row pop-in${this._teamMode === "member" && this._teamPick === e.id ? " selected" : ""}"
           data-action="team-pick" data-id="${e.id}">
        <div class="team-avatar"><img src="${this.engAvatar(e)}" alt=""></div>
        <div class="team-info">
          <div class="team-name">${e.name}<span class="dg-tier-badge dg-tier-badge-sm ${tier.cls}">${this.core.tierLabel(e)}</span></div>
          <div class="team-role">${this.typeName(e.type)}</div>
        </div>
        <div class="team-stats"><span class="team-chip">体力 ${this.engEnergy(e)}</span></div>
      </div>`;
}).join("") || `<div class="test-empty-tip">还没有人，先去「招聘」</div>`;
return `
      <div class="team-list-col">
        <div class="team-col-head">
          <span>团队成员</span>
          <span class="team-col-sub">${alive.length}/${this.core.seatCap()}</span>
        </div>
        <div class="team-list" id="teamList">${rows}</div>
        <div class="team-pagination">
          <button class="team-page-btn" data-action="team-page" data-id="-1" ${this._teamPage === 0 ? "disabled" : ""}>
            ${this.icon("chevL", 12)}</button>
          <div class="team-page-info">${this._teamPage + 1}/${pages}</div>
          <button class="team-page-btn" data-action="team-page" data-id="1" ${this._teamPage >= pages - 1 ? "disabled" : ""}>
            ${this.icon("chevR", 12)}</button>
        </div>
      </div>
      <div class="team-detail-col" id="teamDetail">
        ${this._teamMode === "member" && this._teamPick ? this.omTeamDetail() : this.omTeamOverview()}
      </div>`;
},
omTeamOverview() {
const s = this.core.state;
const alive = s.engineers.filter((e) => !e.resigned);
const avg = (k) => alive.length ? Math.round(alive.reduce((a, e) => a + (e[k] || 0), 0) / alive.length) : 0;
const BASE_ROLES = ["pretrain", "post", "data"].concat(this.core.embodiedAvailable&&this.core.embodiedAvailable()?["embodied"]:[]);
const roleN = {};
alive.forEach((e) => { roleN[e.type] = (roleN[e.type] || 0) + 1; });
const roleOrder = BASE_ROLES.concat(Object.keys(roleN).filter((t) => BASE_ROLES.indexOf(t) < 0));
const roleDist = roleOrder.map((t) => `
      <span class="rd ${t}">${this.typeName(t)} <b>${roleN[t] || 0}</b>人</span>`).join("");
const pay = Math.round(this.core.monthlyPayroll() / 1000) / 10;
const tb = s.tbRound || {};
const meetUsed = tb.meetingWeek != null && this.core.absWeek() - tb.meetingWeek < 2;
const allUsed = !!tb.team && meetUsed;
const item = (ico, label, val, unit, cls) => `
      <div class="stat-item">
        <span class="stat-item-label"><span class="ico">${ico}</span>${label}</span>
        <span class="stat-item-value${cls ? " " + cls : ""}">${val}${unit ? `<span class="unit">${unit}</span>` : ""}</span>
      </div>`;
const TYPES = (this.core.cfg.TRAIT_TYPES || ["pretrain", "post", "academic", "data"])
.filter((t) => t !== "engineer" && (t !== "embodied" || this.core.embodiedAvailable&&this.core.embodiedAvailable()));
const COLOR = { pretrain: "blue", post: "pink", data: "green", academic: "red" };
const maxLv = Math.max(1, ...Object.keys(this.core.cfg.TRAIT_BASE_SALARY || {}).map(Number)) || 5;
const rows = TYPES.map((t) => {
const lvs = alive.flatMap((e) => (e.traits || []).filter((x) => x.type === t).map((x) => x.level || 0));
const lv = lvs.length ? Math.max.apply(null, lvs) : 0;
const pct = lv > 0 ? Math.max(8, Math.min(100, Math.round((lv / maxLv) * 100))) : 0;
return `
        <div class="coverage-row">
          <span class="coverage-name">${this.traitName(t)}</span>
          <div class="coverage-bar"><div class="coverage-fill ${COLOR[t] || "blue"}" data-width="${pct}"></div></div>
          <span class="coverage-lv">Lv.<span class="lv-label">${lv}</span></span>
        </div>`;
}).join("");
return `
      <div class="team-overview">
        <div class="overview-header">
          <div class="overview-title">👥 团队总览</div>
          <div class="overview-subtitle">共 <b>${alive.length}</b> 名成员 · 平均体力 <b class="team-score">${avg("energy")}</b></div>
        </div>
        <div class="stats-card">
          <div class="stats-card-title">
            <span class="title-icon">📊</span>
            <span>团队数据</span>
            <span class="title-line"></span>
          </div>
          <div class="stat-items">
            ${item("👥", "总人数", alive.length, "/" + this.core.seatCap())}
            ${item("🔋", "平均体力", avg("energy"), "", "pink")}
            ${item("💰", "月薪总和", pay, "万/月", "gold")}
            <div class="stat-item">
              <span class="stat-item-label"><span class="ico">🧩</span>岗位分布</span>
              <span class="stat-item-value role-dist">${roleDist}</span>
            </div>
          </div>
          <div class="skill-coverage">
            <div class="coverage-title"><span>🎯</span><span>词条覆盖</span></div>
            <div class="coverage-bars">${rows}</div>
          </div>
          <button class="team-build-btn${allUsed ? " used" : ""}" data-action="om-team-activity"${allUsed ? " disabled" : ""}><span class="ico">🎉</span><span>团建活动</span></button>
        </div>
      </div>`;
},
animateCoverageBars(replay) {
const fills = this.el.querySelectorAll(".modal-card [data-width]");
fills.forEach((f, i) => {
const w = f.dataset.width || 0;
if (!replay) {
f.style.transition = "none";
f.style.width = w + "%";
void f.offsetWidth;
f.style.transition = "";
return;
}
f.style.transition = "none";
f.style.width = "0%";
void f.offsetWidth;
f.style.transition = "";
setTimeout(() => { f.style.width = w + "%"; }, 150 + i * 80);
});
},
planCardSwitch(sel, total, idx) {
const card = this.el.querySelector(sel);
if (!card) { this.refreshOfficeBody(); return; }
const outClass = "card-switching-out-left", inClass = "card-switching-in-right";
card.classList.add(outClass);
setTimeout(() => {
if (sel === "#archCard") {
const c2 = this.core.cfg;
const archs = c2.ARCHITECTURES || [];
const a = archs[idx] || {};
const locked = !this.core.archUnlock(a).ok;
card.innerHTML = this.archCardInner(a);
card.classList.toggle("locked", locked);
const badge = card.closest(".plan-section").querySelector(".section-badge");
if (badge) badge.textContent = (idx + 1) + " / " + total;
const maxP2 = ((c2.GPU_TIERS || {})[this.core.state.gpuTier || "basic"] || {}).maxParam || 7;
const params2 = (c2.TARGET_PARAMS || [7, 13, 34, 70]).filter((p) => p <= maxP2);
const pick2 = this._planParam && params2.indexOf(this._planParam) >= 0 ? this._planParam : (params2[0] || 7);
const reqEl = this.el.querySelector("#mixReq");
if (reqEl) reqEl.dataset.req = this.core.archQualityReq ? this.core.archQualityReq(a.id, pick2) : ((c2.ARCH_QUALITY_REQ || {})[a.id] || 0);
const reqSec = this.el.querySelector("#planReqSection");
if (reqSec) reqSec.innerHTML = this.planReqHTML(pick2);
this.updateMixUI();
this.updatePlanFooter();
}
card.classList.remove(outClass);
card.classList.add(inClass);
setTimeout(() => card.classList.remove(inClass), 380);
}, 190);
},
omTeamActivity() {
if (this.el.querySelector("#activityPop")) return;
if (this.core.offworkNow && this.core.offworkNow()) {
this.toast("🌙 都下班了，团建明天上班再安排");
return;
}
const s = this.core.state;
const tb = s.tbRound || {};
const tb2 = this.core.cfg.TEAM_BUILD || {};
const acts = [
{ kind: "team", icon: "🏔️", name: "团队旅游", cost: (tb2.TEAM_COST != null ? tb2.TEAM_COST : 100000),
desc: "全员体力 +10", note: "每周一次", used: !!tb.team },
{ kind: "meeting", icon: "🍜", name: "聚餐", cost: 0, desc: "全员体力 +8", note: "每 2 周一次",
used: tb.meetingWeek != null && this.core.absWeek() - tb.meetingWeek < 2 },
];
const div = document.createElement("div");
div.id = "activityPop";
div.className = "sub-modal-overlay";
div.innerHTML = `
      <div class="sub-modal-card">
        <div class="sub-modal-header">
          <div class="sub-modal-title">🎉 选择集体活动</div>
          <button class="modal-close" data-action="activity-close" title="关闭">${this.icon("x", 13)}</button>
        </div>
        <div class="sub-modal-body set-body">
          ${acts.map((a) => `
            <button class="shop-tier${a.used ? " used" : ""}" data-action="om-activity-do" data-id="${a.kind}"${a.used ? " disabled" : ""}>
              <div class="shop-tier-info">
                <div class="shop-tier-name">${a.icon} ${a.name}</div>
                <div class="shop-tier-spec">${a.desc}</div>
                ${a.note ? `<div class="shop-tier-note">${a.note}</div>` : ""}
              </div>
              <div class="shop-tier-price">${a.used ? "已安排" : (a.cost ? fmtMoney(a.cost) : "免费")}</div>
            </button>`).join("")}
        </div>
        <div class="sub-modal-footer">
          <button class="skew-btn ghost" data-action="activity-close">关闭</button>
        </div>
      </div>`;
this.el.appendChild(div);
},
omTeamDetail() {
const s = this.core.state;
const cur = s.engineers.find((e) => e.id === this._teamPick);
if (!cur) return `<div class="test-empty-tip">成员已离开</div>`;
const STATS = this.core.engStatKeys(cur).map(k=>[k,this.core.statName(k)]);
const COLORS = {
code: "linear-gradient(90deg,#6fc3ff,#2789c4)", algo: "linear-gradient(90deg,#7ed4f0,#3dbbd8)",
text: "linear-gradient(90deg,#ffcf8a,#f2b84b)", engineering: "linear-gradient(90deg,#8fb8ff,#5f91ed)",
};
const stat = (k, name) => {
const v = Math.round((cur.stats && cur.stats[k]) || 0);
return `
        <div class="detail-stat-row">
          <div class="detail-stat-label"><span>${name}</span><b>${v}</b></div>
          <div class="detail-stat-bar"><div class="detail-stat-fill" style="width:${Math.min(100, v)}%;background:${COLORS[k]}"></div></div>
        </div>`;
};
const en = this.engEnergy(cur);
const enColor = en >= 60 ? "linear-gradient(90deg,#7ed4b0,#53b98d)"
: en >= 25 ? "linear-gradient(90deg,#ffd27a,#f2b84b)"
: "linear-gradient(90deg,#ff9d8a,#f2705a)";
const energyRow = `
      <div class="detail-stat-row">
        <div class="detail-stat-label"><span>⚡ 体力</span><b>${en}</b></div>
        <div class="detail-stat-bar"><div class="detail-stat-fill" style="width:${Math.max(0, Math.min(100, en))}%;background:${enColor}"></div></div>
      </div>`;
const raiseBoost = this.core.raiseProductionStatus ? this.core.raiseProductionStatus(cur) : null;
return `
      <div class="detail-header">
        <div class="detail-avatar"><img src="${this.engAvatar(cur)}" alt=""></div>
        <div class="detail-name">${cur.name}</div>
        <div class="detail-role">${this.typeName(cur.type)}</div>
      </div>
      <div class="detail-stats">${STATS.map((x) => stat(x[0], x[1])).join("")}${energyRow}</div>
      <div class="detail-info-item">
        <div class="dii-title">当前状态</div>
        <div class="recruit-detail-tags">${(cur.traits || []).filter((t) => t.type !== "engineer").map((t) => `<span class="recruit-detail-tag" title="${this.traitDesc(t.type) || ""}" data-tip="${this.traitDesc(t.type) || ""}">${this.traitName(t.type)} Lv.${t.level || 1}</span>`).join("") || '<span class="recruit-detail-tag">无词条</span>'}</div>
      </div>
      <div class="detail-info-item">
        <div class="dii-title">薪资</div>
        ${fmtMoney(cur.salary)} / 月
        ${raiseBoost && raiseBoost.active ? `<div class="recruit-detail-tags" data-raise-production><span class="recruit-detail-tag">产出 +${Math.round((raiseBoost.mul - 1) * 100)}% · 剩余 ${raiseBoost.weeksLeft} 周</span></div>` : ""}
      </div>
      <div class="detail-actions">
        <button class="skew-btn sm" data-action="om-arrange-menu" data-id="${cur.id}"><span>安排</span></button>
        <button class="skew-btn sm danger" data-action="om-fire" data-id="${cur.id}" ${this.core.canFireEngineer(s) ? "" : 'disabled title="不能辞退最后一名工程师"'}><span>辞退</span></button>
        ${this.core.canFireEngineer(s) ? "" : '<span class="dg-dim">团队至少需要保留一名工程师</span>'}
      </div>`;
},
omArrangeMenu(engId) {
this.el.querySelectorAll("#arrangePop").forEach((n) => n.remove());
const s = this.core.state;
if (this.core.offworkNow && this.core.offworkNow()) {
this.toast("🌙 已经下班了，安排的事明天上班再说");
return;
}
const e = s.engineers.find((x) => x.id === engId);
if (!e) return;
const tb = this.core.cfg.TEAM_BUILD || {};
const trainCost = tb.TRAIN_COST != null ? tb.TRAIN_COST : 30000;
const restGain = tb.REST_ENERGY != null ? tb.REST_ENERGY : 35;
const trainAdd = tb.TRAIN_STAT_ADD != null ? tb.TRAIN_STAT_ADD : 5;
const trainEn = tb.TRAIN_ENERGY_COST != null ? tb.TRAIN_ENERGY_COST : 10;
const talkGain = tb.TALK_ENERGY != null ? tb.TALK_ENERGY : 12;
const raiseEn = tb.RAISE_ENERGY != null ? tb.RAISE_ENERGY : 30;
const raiseAdd = Math.max(1000, Math.round((e.salary || 0) * 0.1));
const raiseBoostCfg = this.core.raiseProductionCfg ? this.core.raiseProductionCfg() : { weeks: 4, mul: 1.5 };
const used = this.core.arrangeUsed(e);
const poor = (cost) => cost > 0 && (s.funding || 0) < cost;
const opts = [
{ kind: "talk", icon: "💬", name: "谈心", sub: `${e.name} 体力 +${talkGain}`, note: "每人每 2 周一次", cost: 0, disabled: used.talk, reason: "次数已用完" },
{ kind: "train", icon: "📚", name: "培训", sub: `随机一项潜力 +${trainAdd}（${this.core.engStatKeys(e).map(k=>this.statName(k)).join("/")}等概率）、${e.name} 体力 -${trainEn}`, note: "每人每周一次", cost: trainCost, disabled: used.train || poor(trainCost), reason: used.train ? "次数已用完" : "经费不足" },
{ kind: "raise", icon: "💰", name: "加薪", sub: `月薪 +${fmtMoney(raiseAdd)}（永久）、${e.name} 体力 +${raiseEn}、接下来 ${raiseBoostCfg.weeks} 周产出 +${Math.round((raiseBoostCfg.mul - 1) * 100)}%`, note: "每人每月一次", cost: raiseAdd, disabled: used.raise || poor(raiseAdd), reason: used.raise ? "次数已用完" : "经费不足" },
{ kind: "rest", icon: "😴", name: "安排休息", sub: `本周下班不产出 · 下周上班 ${e.name} 体力 +${restGain}`, note: "每人每周两次", cost: 0, disabled: used.rest, reason: "次数已用完" },
];
const div = document.createElement("div");
div.id = "arrangePop";
div.className = "sub-modal-overlay";
div.innerHTML = `
      <div class="sub-modal-card">
        <div class="sub-modal-header">
          <div class="sub-modal-title">🧑‍💼 安排 ${e.name}</div>
          <button class="modal-close" data-action="arrange-close" title="关闭">${this.icon("x", 13)}</button>
        </div>
        <div class="sub-modal-body set-body">
          ${opts.map((o) => `
            <button class="shop-tier${o.disabled ? ' used' : ''}" data-action="om-arrange-do" data-kind="${o.kind}" data-id="${engId}"${o.disabled ? ' disabled tabindex="-1"' : ''}>
              <div class="shop-tier-info">
                <div class="shop-tier-name">${o.icon} ${o.name}${o.disabled ? ' <span style="opacity:.6;">（' + o.reason + '）</span>' : ''}</div>
                <div class="shop-tier-spec">${o.sub}</div>
                ${o.note ? `<div class="shop-tier-note">${o.note}</div>` : ""}
              </div>
              <div class="shop-tier-price">${o.cost ? fmtMoney(o.cost) : "免费"}</div>
            </button>`).join("")}
        </div>
        <div class="sub-modal-footer">
          <button class="skew-btn ghost" data-action="arrange-close">关闭</button>
        </div>
      </div>`;
this.el.appendChild(div);
},
omTeamPick(id) {
this._teamMode = "member";
this._teamPick = id;
this.el.querySelectorAll(".team-row").forEach((r) => r.classList.toggle("selected", r.dataset.id === id));
this.omSwap("#teamDetail", this.omTeamDetail(), null, () => this.animateCoverageBars(true));
},
omTeamPage(delta) {
const s = this.core.state;
const alive = s.engineers.filter((e) => !e.resigned);
const per = this.TEAM_PER_PAGE;
const pages = Math.max(1, Math.ceil(alive.length / per));
this._teamPage = Math.max(0, Math.min(pages - 1, (this._teamPage || 0) + delta));
const pageList = alive.slice(this._teamPage * per, this._teamPage * per + per);
const rows = pageList.map((e) => {
const tier = this.core.tierOf(e);
return `
      <div class="team-row${this._teamPick === e.id ? " selected" : ""}" data-action="team-pick" data-id="${e.id}">
        <div class="team-avatar"><img src="${this.engAvatar(e)}" alt=""></div>
        <div class="team-info">
          <div class="team-name">${e.name}<span class="dg-tier-badge dg-tier-badge-sm ${tier.cls}">${this.core.tierLabel(e)}</span></div>
          <div class="team-role">${this.typeName(e.type)}</div>
        </div>
        <div class="team-stats"><span class="team-chip">体力 ${this.engEnergy(e)}</span></div>
      </div>`;
}).join("");
const list = this.el.querySelector("#teamList");
if (list) list.innerHTML = rows;
const col = this.el.querySelector(".team-list-col");
const info = col ? col.querySelector(".team-page-info") : null;
if (info) info.textContent = (this._teamPage + 1) + "/" + pages;
const btns = col ? col.querySelectorAll(".team-page-btn") : [];
if (btns[0]) btns[0].disabled = this._teamPage === 0;
if (btns[1]) btns[1].disabled = this._teamPage >= pages - 1;
},
omRecruit() {
const s = this.core.state;
const cands = s.candidates || [];
if (!cands.length) return this.omEmpty("recruit");
const alive = s.engineers.filter((e) => !e.resigned).length;
const PER = 8;
const pages = Math.max(1, Math.ceil(cands.length / PER));
const page = Math.max(0, Math.min(pages - 1, this._recruitPage || 0));
this._recruitPage=page;
const pageList = cands.slice(page * PER, page * PER + PER);
if(!pageList.some(e=>e.id===this._recruitPick))this._recruitPick=pageList[0]?.id||null;
const list = pageList.map((e) => {
const tier = this.core.tierOf(e);
return `
      <div class="recruit-row pop-in${this._recruitPick === e.id ? " selected" : ""}" data-action="recruit-pick" data-id="${e.id}">
        <div class="recruit-avatar"><img src="${this.engAvatar(e)}" alt=""></div>
        <div class="recruit-info">
          <div class="recruit-name">${e.name}<span class="dg-tier-badge dg-tier-badge-sm ${tier.cls}">${this.core.tierLabel(e)}</span></div>
          <div class="recruit-role">${this.typeName(e.type)}</div>
        </div>
        <div class="recruit-salary">${fmtMoney(e.salary)}<span class="recruit-salary-unit">/月</span></div>
      </div>`;
}).join("");
return `
      <div class="recruit-list-col">
        <div class="team-col-head">
          <span>可招募候选人（${cands.length}）</span>
          <span class="team-col-sub">座位 ${alive}/${this.core.seatCap()}</span>
        </div>
        <div class="recruit-list">${list}</div>
        ${pages > 1 ? `<div class="team-pagination">
          <button class="team-page-btn" data-action="recruit-page" data-id="-1" ${page === 0 ? "disabled" : ""}>${this.icon("chevL", 12)}</button>
          <div class="team-page-info">${page + 1}/${pages}</div>
          <button class="team-page-btn" data-action="recruit-page" data-id="1" ${page >= pages - 1 ? "disabled" : ""}>${this.icon("chevR", 12)}</button>
        </div>` : ""}
      </div>
      <div class="recruit-detail-col" id="recruitDetail">${this.omRecruitDetail()}</div>`;
},
omRecruitDetail() {
const s = this.core.state;
const cands = s.candidates || [];
const cur = cands.find((x) => x.id === this._recruitPick) || cands[0];
if (!cur) return "";
const COLORS = {
code: "linear-gradient(90deg,#6fc3ff,#2789c4)", algo: "linear-gradient(90deg,#7ed4f0,#3dbbd8)",
text: "linear-gradient(90deg,#ffcf8a,#f2b84b)", engineering: "linear-gradient(90deg,#8fb8ff,#5f91ed)",
};
const rows = this.core.engStatKeys(cur).map(k=>[k,this.core.statName(k)])
.map((x) => {
const k = x[0], name = x[1];
const v = (cur.stats || {})[k] || 0;
return `
          <div class="rds-row">
            <div class="rds-label"><span>${name}</span><b>${v}</b></div>
            <div class="rds-bar"><div class="rds-fill" style="width:0%;background:${COLORS[k]}" data-width="${Math.min(100, v)}"></div></div>
          </div>`;
}).join("");
const bio = cur.resume ? [cur.resume.exp, cur.resume.univ].filter(Boolean).join(" · ") : "";
const _visTraits = (cur.traits || []).filter((t) => t.type !== "engineer");
const tags = _visTraits.length
? `<div class="recruit-detail-tags">${_visTraits.map((t) => `<span class="recruit-detail-tag" title="${this.traitDesc(t.type) || ""}" data-tip="${this.traitDesc(t.type) || ""}">${this.traitName(t.type)} Lv.${t.level || 1}</span>`).join("")}</div>`
: "";
const tier = this.core.tierOf(cur);
const ttlW = this.core.cfg.CANDIDATE_TTL_WEEKS || 0;
const _expAbs = this.core.candExpireAbs ? this.core.candExpireAbs(cur) : null;
const leftW = (_expAbs != null && ttlW > 0) ? Math.max(0, _expAbs - this.core.absWeek()) : null;
const expireLine = leftW == null ? ""
: `<div class="recruit-detail-expire${leftW <= 1 ? " urgent" : ""}">⏳ ${leftW <= 0 ? "本周结束他将另谋高就" : "他的耐心只剩 " + leftW + " 周，逾期不再等你"}</div>`;
const axHint = (function () {
const act = (window.V35 && window.V35.activeAxes) ? (window.V35.activeAxes(s) || []) : [];
if (!act.length) return [];
const hit = [];
for (const t of (cur.traits || [])) {
for (const id of this.traitAxes(t.type)) if (act.indexOf(id) >= 0 && hit.indexOf(id) < 0) hit.push(id);
}
return hit;
}).call(this);
const axHintHTML = axHint.length
? `<div class="recruit-detail-axhint">他带的词条能产出：<b>${axHint.map((id) => this.core.statLabel(id)).join(" / ")}</b></div>`
: "";
return `
      <div class="recruit-detail-header">
        <div class="recruit-detail-avatar"><img src="${this.engAvatar(cur)}" alt=""></div>
        <div class="recruit-detail-name">${cur.name}<span class="dg-tier-badge dg-tier-badge-sm ${tier.cls}">${this.core.tierLabel(cur)}</span></div>
        <div class="recruit-detail-role">${this.typeName(cur.type)}</div>
        <div class="recruit-detail-salary">月薪 ${fmtMoney(cur.salary)}<span class="recruit-salary-unit"> / 月</span></div>
        <div class="recruit-detail-arrive">到岗：${this.joinWeek(cur.type)}</div>
      </div>
      ${expireLine}
      <div class="recruit-detail-stats">${rows}</div>
      ${axHintHTML}
      <div class="recruit-detail-bio"><b>个人简介</b><br>${bio || "（这位候选人没留下简介）"}${tags}</div>`;
},
omRecruitPick(id) {
this._recruitPick = id;
this.el.querySelectorAll(".recruit-row").forEach((r) => r.classList.toggle("selected", r.dataset.id === id));
this.omSwap("#recruitDetail", this.omRecruitDetail(), null, () => this.animateCoverageBars(true));
},
missionCardHTML(archId, param) {
const c = this.core.cfg;
const M = c.MISSIONS || {};
if (M.ENABLED === false || !this.core.missionPreview) return "";
const p = this.core.missionPreview(archId, param);
const m = this.core.missionOf(this.core.state.ver);
const UI = M.UI || {};
const req = [];
if (m.arch) {
const ad = (c.ARCHITECTURES || []).find((a) => a.id === m.arch);
req.push("架构 " + (ad ? ad.name : m.arch));
}
if (m.param) req.push("参数 " + m.param + "B");
const fixed = p.hit && this.planIsFixed();
const cls = !p.hit ? "miss" : (fixed ? "fixed" : "hit");
const state = !p.hit ? "不符合要求" : (fixed ? "配置已固定" : "符合要求");
const mark = !p.hit ? "!" : (fixed ? "=" : "✓");
const tip = !p.hit ? (UI.MISS || "") : (fixed ? (UI.FIXED || "") : (UI.HIT || ""));
return `<div class="mission-card ${cls}" id="missionCard">
      <div class="mc-head">
        <span class="mc-icon">${mark}</span>
        <span class="mc-title">本阶段任务 · ${p.name || "达成训练目标"}</span>
        <span class="mc-state" title="${this.escAttr(tip)}">${state}</span>
      </div>
      <div class="mc-req">要求：${req.join(" · ")}</div>
    </div>`;
},
archUnlockCond(a) {
const c = this.core.cfg;
const parts = [(a && a.unlock ? a.unlock : "V1") + " 阶段起"];
if (a && a.unlockBy === "embodied") {
const ok=(this.core.state.approvedArchs||[]).includes(a.id);
parts.push(ok ? "具身团队方案已获授权" : a.id === "vla" ? "具身智能时代剧情 · 接受邀请后授权" : "专属团队提案 · 批准后立项");
} else if (a && a.unlockBy === "approval") {
const ok = this.core.archUnlock(a).approvalOk;
parts.push(ok ? "团队方案已批准" : "团队提案 · 批准后立项");
} else {
const pt = (a && a.unlockPaper) ? this.core.paperOf(a.unlockPaper) : null;
if (pt) parts.push("研读《" + pt.title + "》");
}
return parts.join(" · ");
},
archInfoTip(a) {
const c = this.core.cfg;
const pt = (a && a.unlockPaper) ? this.core.paperOf(a.unlockPaper) : null;
const bits = [];
if (a && a.proto) bits.push(a.proto);
if (a && a.trait) bits.push(a.trait);
if (a && a.desc) bits.push(a.desc);
const ax = (a && a.axes) || [];
if (ax.length) {
const D = this.axisDefs();
bits.push("追加能力轴：" + ax.map((id) => {
const d = D[id] || {};
return (d.name || id) + "（≥" + (((d.source || {}).paramMin) || 0) + "B）";
}).join("、"));
bits.push("　产出岗位：" + this.axisDriverTip(ax));
} else {
bits.push("追加能力轴：无 —— 本架构只产出四维（代码/文字/安全/稳定）");
}
bits.push("解锁条件：" + this.archUnlockCond(a));
if (a && ["approval","embodied"].includes(a.unlockBy) && a.selfReport) {
bits.push("自家报告：《" + a.selfReport + "》"
+ (a.selfReportMeta ? "（" + a.selfReportMeta + "）" : "")
+ " —— 我们自己提出的路线，不需要研读");
}
if (pt) bits.push("来源论文：《" + pt.title + "》");
return bits.join("\n");
},
escAttr(s) {
return String(s == null ? "" : s)
.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
.replace(/</g, "&lt;").replace(/>/g, "&gt;");
},
axisDefs() {
const defs=(((this.core.cfg || {}).V35 || {}).AXES || {}).DEF || {};
return Object.fromEntries(Object.keys(defs).map(id=>[id,this.core.axisDef ? this.core.axisDef(id) : defs[id]]));
},
axisChip(id) {
const d = this.axisDefs()[id] || {};
return `<span class="axis-chip">${this.axisIcon(id, 12)}${d.name || id}</span>`;
},
axesOf(archId, param, ver) {
const stage=ver || (this.core.state||{}).ver || "V1";
if(window.V35&&window.V35.activeAxes)return window.V35.activeAxes({arch:archId,paramTarget:param,ver:stage});
const A = ((this.core.cfg || {}).V35 || {}).AXES || {};
if (A.ENABLED === false) return [];
const D = A.DEF || {}, P = Number(param) || 0;
return (A.ORDER || []).filter((id) => {
const d = D[id];
if (!d || !d.source) return false;
if(d.source.minVer){const order=this.core.cfg.VER_ORDER||[];if(order.indexOf(stage)<order.indexOf(d.source.minVer))return false;}
if ((d.source.archs || []).indexOf(archId) < 0) return false;
return P >= (d.source.paramMin || 0);
});
},
axisDriverTip(ids) {
const D = this.axisDefs();
const M = this.core.cfg.TRAIT_META || {};
const need = {};
for (const id of (ids || [])) {
for (const dr of (((D[id] || {}).drivers) || [])) {
const nm = (M[dr.role] || {}).name || dr.role;
(need[nm] = need[nm] || []).push((D[id] || {}).name || id);
}
}
return Object.keys(need).map((n) => n + "词条 → " + need[n].join("·")).join(" / ");
},
archCardInner(a) {
const locked = !this.core.archUnlock(a).ok;
const ax = (a && a.axes) || [];
const axLine = ax.length
? `<div class="ac-axes"><i>带出</i>${ax.map((id) => this.axisChip(id)).join("")}</div>`
: `<div class="ac-axes none">无追加能力轴</div>`;
return `
      <div class="ac-name">${(a && a.name) || "—"}<span class="ac-info" data-tip="${this.escAttr(this.archInfoTip(a))}" title="点这里看架构说明">!</span>${locked ? '<i class="ac-lock">🔒 未解锁</i>' : ""}</div>
      <div class="ac-unlock">${locked ? "🔒 " : "✓ "}${this.archUnlockCond(a)}</div>
      ${axLine}`;
},
planParamOptions(archId) {
const c=this.core.cfg,s=this.core.state,a=(c.ARCHITECTURES||[]).find(a=>a.id===archId)||{};
const gpuMax=((c.GPU_TIERS||{})[s.gpuTier||'basic']||{}).maxParam||7;
const max=this.core.archMaxParam?this.core.archMaxParam(archId):gpuMax;
return(c.TARGET_PARAMS||[7,13,34,70]).filter(p=>p>=(Number(a.minParam)||0)&&p<=gpuMax&&p<=max);
},
planPickParam() {
const c = this.core.cfg, s = this.core.state;
const maxP = ((c.GPU_TIERS || {})[s.gpuTier || "basic"] || {}).maxParam || 7;
const archs = c.ARCHITECTURES || [];
const ai = (((this._planArch || 0) % archs.length) + archs.length) % archs.length;
const archId = (archs[ai] || {}).id;
const archMaxP = this.core.archMaxParam ? this.core.archMaxParam(archId) : maxP;
const params = this.planParamOptions(archId);
return this._planParam && params.indexOf(this._planParam) >= 0 ? this._planParam : (params[0] || (archs[ai]||{}).minParam || 7);
},
planIsFixed() {
const c = this.core.cfg, s = this.core.state;
const archs = (c.ARCHITECTURES || []).filter((a) => this.core.archUnlock(a).ok);
const maxP = ((c.GPU_TIERS || {})[s.gpuTier || "basic"] || {}).maxParam || 7;
const params = (c.TARGET_PARAMS || [7, 13, 34, 70]).filter((p) => p <= maxP);
return archs.length <= 1 && params.length <= 1;
},
refreshMissionCard(archId, param) {
const el = this.el.querySelector("#missionCard");
if (!el || !this.core.missionPreview) return;
const box = document.createElement("div");
box.innerHTML = this.missionCardHTML(archId, param);
const next = box.firstElementChild;
if (next) el.replaceWith(next);
},
omPlan() {
const c = this.core.cfg;
const s = this.core.state;
const archs = c.ARCHITECTURES || [];
const ai = (((this._planArch || 0) % archs.length) + archs.length) % archs.length;
const arch = archs[ai] || {};
const unlock = this.core.archUnlock(arch);
const locked = !unlock.ok;
const maxP = ((c.GPU_TIERS || {})[s.gpuTier || "basic"] || {}).maxParam || 7;
const archMaxP = this.core.archMaxParam ? this.core.archMaxParam(arch.id) : maxP;
const params = this.planParamOptions(arch.id);
const pick = this.planPickParam();
const mx = Object.assign({ n: 5, g: 0, p: 0 }, this._planMix || {});
this._planMix = mx;
const sumCells = mx.n + mx.g + mx.p;
const CQ = c.CORPUS_QUALITY || {};
const step = CQ.STEP || 0.2;
const req = this.core.archQualityReq ? this.core.archQualityReq(arch.id, pick) : ((c.ARCH_QUALITY_REQ || {})[arch.id] || 0);
const bonus = CQ.BONUS != null ? CQ.BONUS : 0.10;
const penalty = CQ.PENALTY != null ? CQ.PENALTY : 0.15;
const shareGP = (mx.g + mx.p) * step;
const mixRow = (key, label, color) => {
const val = mx[key];
return `<div class="mix-row">
        <span class="mix-label" style="color:${color}">${label}</span>
        <input class="mix-range" type="range" min="0" max="5" step="1" value="${val}" data-mix="${key}" data-arch="${arch.id || ""}">
        <b class="mix-pct" id="mixPct-${key}">${Math.round(val * step * 100)}%</b>
      </div>`;
};
this.bindPlanMixInput();
return `
      ${this.missionCardHTML(arch.id, pick)}
      <div class="plan-section">
        <div class="plan-section-title">架构选择 <span class="section-badge">${ai + 1} / ${archs.length}</span></div>
        <div class="arch-selector">
          <button class="arrow-btn" data-action="plan-arch" data-id="-1">${this.icon("chevL", 14)}</button>
          <div class="arch-card${locked ? " locked" : ""}" id="archCard">${this.archCardInner(arch)}</div>
          <button class="arrow-btn" data-action="plan-arch" data-id="1">${this.icon("chevR", 14)}</button>
        </div>
      </div>

      <div class="plan-quality-bar">
        <span class="pq-label">语料品质要求</span>
        <div class="mix-req" id="mixReq" data-req="${req}" data-step="${step}" data-bonus="${bonus}" data-penalty="${penalty}">
          ${this.mixReqHTML(req, shareGP, bonus, penalty)}
        </div>
      </div>

      <div class="plan-section">
        <div class="plan-section-title">语料品质配比 <span class="section-badge">20% 一档 · 自由搭配</span></div>
        <div class="mix-board">
          ${mixRow("n", "普通", "#8aa0b2")}
          ${mixRow("g", "良好", "#53b98d")}
          ${mixRow("p", "优质", "#a78bfa")}
          <div class="mix-sum" id="mixSum">合计 <b>${Math.round(sumCells * step * 100)}%</b><span class="mix-unused">（未分配部分按普通语料计）</span></div>
          ${this.mixPremiumHTML(mx)}
        </div>
      </div>

      <div class="plan-section">
        <div class="plan-section-title">模型参数 <span class="section-badge">越大越强</span></div>
        <div class="param-selector">
          ${params.map((p) => {
const i = params.indexOf(p);
return `
              <div class="param-item${pick === p ? " selected" : ""}" data-action="plan-param" data-id="${p}">
                <div class="pi-size">${p}<span class="pi-unit">B</span></div>
                <div class="pi-label">${arch.unlockBy==='embodied'?'具身基座':i === 0 ? "入门" : i === 1 ? "标准" : i === 2 ? "进阶" : "旗舰"}</div>
              </div>`;
}).join("")}${!params.length?'<div class="plan-lack-tip">当前算力没有可用参数档，请先升级算力。</div>':''}
        </div>
      </div>

      <div class="plan-section" id="planReqSection">${this.planReqHTML(pick)}</div>`;
},
planReqHTML(pick) {
const c = this.core.cfg, s = this.core.state;
const archs = c.ARCHITECTURES || [];
const ai = (((this._planArch || 0) % archs.length) + archs.length) % archs.length;
const arch = archs[ai] || {};
const have = this.core.v35On && this.core.v35On() ? Math.floor(s.v35.corpus.token) : Math.floor(s.corpus || 0);
const gpuOk = (() => {
if (!arch.gpu) return true;
return (c.GPU_TIER_ORDER.indexOf(s.gpuTier || "basic")) >= (c.GPU_TIER_ORDER.indexOf(arch.gpu));
})();
const curGpuName = ((c.GPU_TIERS || {})[s.gpuTier || "basic"] || {}).name || "—";
const needGpuName = ((c.GPU_TIERS || {})[arch.gpu] || {}).name || "—";
const gate = (this.core.archGate && this.core.v35On && this.core.v35On())
? this.core.archGate(arch.id, pick) : (arch.gate != null ? arch.gate : null);
const gateTip = (gate != null && this.core.v35On && this.core.v35On())
? `<div class="mini-stat"><span class="ms-label">语料要求</span><div class="ms-bar"><div class="ms-fill" style="width:${Math.min(100, have / Math.max(1, gate) * 100)}%; background:linear-gradient(90deg,#9be0f5,var(--aqua-primary-deep))"></div></div><span class="ms-val ${have >= gate ? "ok" : "lack"}" title="需有效 token ≥ ${gate} 亿（当前 ${have} 亿）">${gate}亿 ${have >= gate ? "✓" : "✗"}</span></div>`
: "";
const corpusLackTip = (gate != null && this.core.v35On && this.core.v35On() && have < gate)
? `<div class="plan-lack-tip">${this.icon("alert", 13)}<span>语料还差 <b>${Math.ceil(gate - have)} 亿</b>：点底部「外包补足」用经费补齐；也可以先选一个门槛更低的组合立项，推进时间把语料攒够，再重训本阶段（未达成任务目标时结算仍会改发增量经费）。</span></div>`
: "";
const gpuReq = arch.gpu
? `<div class="mini-stat"><span class="ms-label">算力要求</span><div class="ms-bar"><div class="ms-fill" style="width:${Math.min(100, gpuOk ? 100 : 40)}%; background:${gpuOk ? "linear-gradient(90deg,#7ed4b0,#53b98d)" : "linear-gradient(90deg,#ffcf8a,#f2b84b)"}"></div></div><span class="ms-val ${gpuOk ? "ok" : "lack"}" title="${gpuOk ? "当前算力满足要求" : "当前" + curGpuName + "档，需" + needGpuName + "档"}">${needGpuName} ${gpuOk ? "✓" : "✗"}</span></div>`
: "";
const tiers = c.GPU_TIERS || {};
const key = (c.GPU_TIER_ORDER || Object.keys(tiers)).find((k) => (tiers[k] || {}).maxParam >= pick) || "basic";
const price = (tiers[key] || {}).price || 0;
const weeks = this.core.minWeeks(s.ver);
return `
      ${gpuReq}
      ${gateTip}
      ${corpusLackTip}
      <div class="mini-stat"><span class="ms-label">预计周期</span><div class="ms-bar"><div class="ms-fill" style="width:${Math.min(100, weeks / 20 * 100)}%"></div></div><span class="ms-val">${weeks}周</span></div>
      <div class="mini-stat"><span class="ms-label">预算需求</span><div class="ms-bar"><div class="ms-fill" style="width:${Math.min(100, price / 50000)}%; background: linear-gradient(90deg, #ffd27a, var(--aqua-gold))"></div></div><span class="ms-val">¥${Math.round(price / 10000)}万</span></div>`;
},
bindPlanMixInput() {
if (this._mixBound) return;
this._mixBound = true;
this.el.addEventListener("input", (e) => {
const t = e.target;
if (!t || !t.dataset || !t.dataset.mix) return;
const k = t.dataset.mix;
const mx = this._planMix || { n: 5, g: 0, p: 0 };
let v = Math.max(0, Math.min(5, Math.round(+t.value || 0)));
const others = mx.n + mx.g + mx.p - mx[k];
if (v + others > 5) v = Math.max(0, 5 - others);
t.value = v;
mx[k] = v;
this._planMix = mx;
this.updateMixUI();
});
},
mixPremiumHTML(mx) {
const per = ((this.core.cfg.V35 || {}).PREMIUM_TICK_BONUS != null) ? this.core.cfg.V35.PREMIUM_TICK_BONUS : 1;
const cells = Math.max(0, Math.min(5, Math.round((mx && mx.p) || 0)));
const sec = cells * per;
const base = (this.core.cfg.V35 || {}).TICK_S || 10;
if (!(sec > 0)) {
return `<div class="mix-premium" id="mixPremium">⚡ 优质加成：未启用 —— 配比里加入优质数据可缩短产出周期（每 +20% 优质 -${per} 秒）</div>`;
}
return `<div class="mix-premium on" id="mixPremium">⚡ 优质加成：产出周期 ${base} 秒 → <b>${Math.max(1, base - sec)} 秒</b>（每 +20% 优质 -${per} 秒）</div>`;
},
mixReqHTML(req, shareGP, bonus, penalty) {
if (!(req > 0)) return `<span class="mix-req-na">无要求</span>`;
const ok = shareGP >= req - 1e-9;
const need = `良好+优质 ≥ ${Math.round(req * 100)}%`;
const tip = ok
? `配比达标：团队产出速度 ×${(1 + bonus).toFixed(2)}`
: `未达标：团队产出速度 ×${(1 - penalty).toFixed(2)}，把「良好+优质」配比提到 ${Math.round(req * 100)}% 以上可消除`;
return `<span class="mix-req-need">${need}</span><span class="${ok ? "mix-req-ok" : "mix-req-lack"} mix-req-mark" title="${tip}">${ok ? "✓" : "✗"}</span>`;
},
updateMixUI() {
const c = this.core.cfg;
const mx = this._planMix || { n: 5, g: 0, p: 0 };
const CQ = c.CORPUS_QUALITY || {};
const step = CQ.STEP || 0.2;
const bonus = CQ.BONUS != null ? CQ.BONUS : 0.10;
const penalty = CQ.PENALTY != null ? CQ.PENALTY : 0.15;
const sumCells = mx.n + mx.g + mx.p;
for (const k of ["n", "g", "p"]) {
const el = this.el.querySelector("#mixPct-" + k);
if (el) el.textContent = Math.round(mx[k] * step * 100) + "%";
}
const sumEl = this.el.querySelector("#mixSum");
if (sumEl) sumEl.innerHTML = `合计 <b>${Math.round(sumCells * step * 100)}%</b><span class="mix-unused">（未分配部分按普通语料计）</span>`;
const pmEl = this.el.querySelector("#mixPremium");
if (pmEl) {
const next = document.createElement("div");
next.innerHTML = this.mixPremiumHTML(mx);
const fresh = next.firstElementChild;
if (fresh) pmEl.replaceWith(fresh);
}
const reqEl = this.el.querySelector("#mixReq");
if (reqEl) {
const req = parseFloat(reqEl.dataset.req || "0") || 0;
const shareGP = (mx.g + mx.p) * step;
reqEl.innerHTML = this.mixReqHTML(req, shareGP, bonus, penalty);
}
this.updatePlanFooter();
},
planReady() {
const c = this.core.cfg, s = this.core.state;
const initial = this.core.initialRecruitment();
if (initial && initial.missing.length) return { ok: false, reason: initial.tip };
if (this.core.v35On && this.core.v35On()) {
const q = (s.v35 && s.v35.corpus && s.v35.corpus.q) || [];
const mx = Object.assign({ n: 5, g: 0, p: 0 }, this._planMix || {});
const MULT = (c.V35 && c.V35.QUALITY_MULT) || [0.5, 1.0, 1.5];
const raw = (i) => (q[i] || 0) * (MULT[i] != null ? MULT[i] : 0.5);
const total = raw(0) + raw(1) + raw(2);
if (total > 0) {
const maxG = Math.round((raw(1) / total) * 5);
const maxP = Math.round((raw(2) / total) * 5);
if (mx.g > maxG) return { ok: false, reason: `良好语料不足（良好折算 ${Math.round(raw(1))} / 共 ${Math.round(total)} 亿 token，最多可配 ${maxG}/5 格）` };
if (mx.p > maxP) return { ok: false, reason: `优质语料不足（优质折算 ${Math.round(raw(2))} / 共 ${Math.round(total)} 亿 token，最多可配 ${maxP}/5 格）` };
}
}
const archs = c.ARCHITECTURES || [];
const ai = (((this._planArch || 0) % archs.length) + archs.length) % archs.length;
const arch = archs[ai] || {};
if (!this.core.archUnlock(arch).ok) {
return { ok: false, reason: "未解锁" };
}
if(!this.planParamOptions(arch.id).length)return {ok:false,reason:'算力不足（至少 '+(arch.minParam||7)+'B）'};
if (arch.gpu) {
const order = c.GPU_TIER_ORDER || Object.keys(c.GPU_TIERS || {});
const cur = order.indexOf(s.gpuTier || "basic");
const need = order.indexOf(arch.gpu);
if (cur >= 0 && need >= 0 && cur < need) return { ok: false, reason: "算力不足" };
}
if (this.core.v35On && this.core.v35On()) {
const gate = this.core.archGate ? this.core.archGate(arch.id, this.planPickParam()) : null;
const have = (s.v35 && s.v35.corpus && s.v35.corpus.token) || 0;
if (gate != null && have < gate) {
const short = Math.ceil(gate - have);
return { ok: false, reason: `语料不足（差 ${short} 亿）`, corpusShort: short, corpusGate: gate };
}
}
return { ok: true };
},
updatePlanFooter() {
const box = this.el.querySelector("#modalContainer");
if (!box) return;
const btn = box.querySelector('[data-action="om-plan-confirm"]');
if (!btn) return;
const pr = this.planReady();
btn.disabled = !pr.ok;
btn.classList.toggle("disabled", !pr.ok);
btn.textContent = pr.ok ? "确认立项" : pr.reason;
const foot = btn.parentElement;
let buy = foot ? foot.querySelector('[data-action="om-plan-buycorpus"]') : null;
if (pr.corpusShort) {
if (!buy && foot) {
buy = document.createElement("button");
buy.className = "skew-btn gold";
buy.dataset.action = "om-plan-buycorpus";
foot.insertBefore(buy, btn);
this.invalidateFit();
this.fitModalBody();
}
if (buy) buy.textContent = `外包补足（${pr.corpusShort}亿）`;
} else if (buy) {
buy.remove();
this.invalidateFit();
this.fitModalBody();
}
},
omPlanDone() {
const c = this.core.cfg, s = this.core.state;
const arch = (c.ARCHITECTURES || []).find((a) => a.id === s.arch) || {};
const line = (k, v) => `<div class="om-done-line"><span>${k}</span><b>${v}</b></div>`;
const mix = (s.v35 && s.v35.qualityMix) || { n: 5, g: 0, p: 0 };
const step = (c.CORPUS_QUALITY || {}).STEP || 0.2;
const pct = (v) => Math.round((v || 0) * step * 100);
const qm = (s.v35 && s.v35.qualityMul) || 1;
const qTip = qm !== 1 ? `（产出速度 ×${qm.toFixed(2)}）` : "";
const mm = s.mission || {};
const mDef = this.core.missionOf ? this.core.missionOf(s.ver) : {};
const mLine = (this.core.cfg.MISSIONS || {}).ENABLED === false || !mDef.name ? ""
: line("本阶段任务", `${mDef.name}${mm.hit === false ? "（<i class=\"mc-miss\">未按目标走 · 结算改发增量经费</i>）" : "（<i class=\"mc-hit\">符合目标</i>）"}`);
return `
      <div class="om-done">
        <div class="om-done-title">本项目已立项</div>
        ${line("架构", arch.name || "—")}
        ${line("语料配比", `普通 ${pct(mix.n)}% / 良好 ${pct(mix.g)}% / 优质 ${pct(mix.p)}%${qTip}`)}
        ${line("参数规模", (s.paramTarget || 7) + "B")}
        ${mLine}
        <div class="om-done-tip">下一阶段开始时可以重新立项。现在去「攻关」选一个方向冲产出吧。</div>
      </div>`;
},
focusCostSpans() {
const c = this.core.cfg;
if (!(this.core.v35On && this.core.v35On())) {
const F = c.FOCUS || {};
const opt = (F.DIMS || [])[this._focusPick || 0] || {};
return [
{ text: "⚡ " + (opt.stamina != null ? opt.stamina : 20) + " 体力" },
{ text: "📚 " + (opt.corpus != null ? opt.corpus : 500) + " 语料" },
{ text: "💰 " + fmtMoney(F.COST || 200000) },
];
}
const v = c.V35, s = this.core.state;
const comboGate = this.core.archGate(s.arch, s.paramTarget);
const gate = comboGate != null
? Math.round(comboGate * (v.FOCUS_GATE_MUL != null ? v.FOCUS_GATE_MUL : 1.3))
: (v.FOCUS_CORPUS_GATE != null ? v.FOCUS_CORPUS_GATE : 0);
const cur = Math.floor((s.v35 && s.v35.corpus ? s.v35.corpus.token : 0));
const cost = v.FOCUS_COST != null ? v.FOCUS_COST : ((c.FOCUS || {}).COST || 200000);
return [
{ text: gate > 0 ? "📚 语料门槛 " + gate + " 亿 token（当前 " + cur + "）" : "📚 无需语料门槛",
cls: gate > 0 && cur < gate ? "lack" : "" },
{ text: "💰 " + fmtMoney(cost), cls: (s.funding || 0) < cost ? "lack" : "" },
];
},
focusList() {
const c = this.core.cfg;
let list = (((c.FOCUS || {}).DIMS) || []).slice();
if(this.core.embodiedAvailable&&this.core.embodiedAvailable())list=[
{key:'codeText',name:'代码&文字',color:'#2789c4',tag:'语言与代码',icon:(list.find(d=>d.key==='code')||{}).icon||'',desc:'代码和文字两类产出同时获得攻关加成'},
{key:'safetyStability',name:'安全&稳定',color:'#359e96',tag:'安全与可靠',icon:(list.find(d=>d.key==='safety')||{}).icon||'',desc:'安全和稳定两类产出同时获得攻关加成'},
];
const axIds = this.core.v35AxisIds(this.core.state);
if (!axIds.length) return list;
const tick = (c.V35 || {}).TICKS_PER_WEEK || 6;
const weeks = Math.round((((c.V35 || {}).FOCUS_TICKS || 18) / tick) * 10) / 10;
for (const id of axIds) {
const d = this.core.axisDef(id) || {};
list.push({
key: id, name: (d.name || id) + "能力", color: "#6d5ce0", tag: "追加轴",
desc: d.tip || "", axis: true, bonus: "×" + ((c.V35 || {}).FOCUS_MUL || 1.5),
duration: weeks + "周",
});
}
return list;
},
omFocus() {
const c = this.core.cfg;
const all = this.focusList();
const dims = all.filter((d) => !d.axis);
const axDims = all.filter((d) => d.axis);
const idx = this._focusPick || 0;
const opt = all[idx] || all[0] || {};
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">${d.icon || ""}</svg>`;
const costSpans = this.focusCostSpans()
.map((t) => `<span class="${t.cls || ""}">${t.text}</span>`).join("");
const v35eff = this.core.v35On && this.core.v35On();
const effWeeks = Math.round((((c.V35 || {}).FOCUS_TICKS || 18) / ((c.V35 || {}).TICKS_PER_WEEK || 6)) * 10) / 10;
const effMul = Math.round((((c.V35 || {}).FOCUS_MUL || 1.5) - 1) * 100);
const effDesc = v35eff
? `接下来 ${effWeeks} 周内，产出「${opt.name}」相关收益额外 +${effMul}%`
: (opt.desc || "");
return `
      <div class="focus-intro">选择一个方向重点攻关，该方向的产出效率将大幅提升。</div>
      <div class="focus-choice-grid">
      ${dims.length===2?'<div class="focus-quadrant embodied-focus-pair">':'<div class="focus-quadrant">'}
        <div class="quadrant-axis quadrant-axis-h"></div>
        <div class="quadrant-axis quadrant-axis-v"></div>
        <div class="quadrant-center-label">能力方向</div>
        ${dims.map((d, i) => {
const v35on = this.core.v35On && this.core.v35On();
const bonus = v35on ? "×" + c.V35.FOCUS_MUL : (d.bonus || ("×" + (F.MUL || 1.5)));
const dur = v35on
? "持续 " + (Math.round((c.V35.FOCUS_TICKS / (c.V35.TICKS_PER_WEEK || 6)) * 10) / 10) + " 周"
: (d.duration || ((F.WEEKS || 4) + "周"));
return `
          <div class="quadrant-card q${i + 1}${i === idx ? " selected" : ""}" data-action="focus-pick" data-id="${i}">
            <div class="qc-icon" style="color:${d.color || "#9b87f5"}">${svg(d)}</div>
            <div class="qc-name">${d.name}</div>
            <div class="qc-bonus">${bonus}</div>
            <div class="qc-dur">${dur}</div>
          </div>`;
}).join("")}
      </div>
      ${axDims.length ? `
      <div class="focus-axis-title">追加能力轴（本阶段架构带出的）</div>
      <div class="focus-axis-row">
        ${axDims.map((d, j) => {
const i = dims.length + j;
const d0 = this.core.axisDef(d.key) || {};
return `
          <div class="focus-axis-card${i === idx ? " selected" : ""}" data-action="focus-pick" data-id="${i}">
            <div class="fa-icon">${this.axisIcon(d.key, 18)}</div>
            <div class="fa-name">${d.name}</div>
            <div class="fa-bonus">${d.bonus}</div>
            <div class="fa-dur">持续 ${d.duration.replace("周", "")} 周</div>
          </div>`;
}).join("")}
      </div>` : ""}
      </div>
      <div class="focus-detail" id="focusDetail">
        <div class="fd-left">
          <div class="fd-tag" style="background:${opt.color || "#9b87f5"}15;color:${opt.color || "#9b87f5"}">${opt.tag || opt.name || ""}</div>
          <div class="fd-desc">${effDesc}</div>
        </div>
        <div class="fd-right">
          <div class="fd-cost-label">消耗</div>
          <div class="fd-cost">${costSpans}</div>
        </div>
      </div>`;
},
omFocusPick(i) {
this._focusPick = i;
const opt = this.focusList()[i] || {};
this.el.querySelectorAll(".quadrant-card, .focus-axis-card").forEach((el, k) => el.classList.toggle("selected", k === i));
const box = this.el.querySelector("#focusDetail");
if (box) {
const tag = box.querySelector(".fd-tag"), desc = box.querySelector(".fd-desc");
const spans = box.querySelectorAll(".fd-cost span");
if (tag) {
tag.textContent = opt.tag || opt.name || "";
tag.style.background = (opt.color || "#9b87f5") + "15";
tag.style.color = opt.color || "#9b87f5";
}
if (desc) desc.textContent = opt.desc || "";
const costs = this.focusCostSpans();
costs.forEach((cc, i) => {
if (!spans[i]) return;
spans[i].textContent = costs[i].text;
spans[i].className = costs[i].cls || "";
});
}
},
paperPerPage() {
const w=window.innerWidth,h=window.innerHeight;
return w<=h&&w<=360 || w>h&&h<=450 ? 1 : 2;
},
omPaper() {
const c = this.core.cfg;
const s = this.core.state;
const pool = (c.PAPER || {}).POOL || [];
const ids = [...new Set([...(s.paperCandidates || []), ...(s.papersOwned || [])])];
const list = ids.map((id) => pool.find((p) => p.no === this.core.paperNoOf(id))).filter(Boolean);
if (!list.length) return this.omEmpty("paper");
const researching = s.paperResearch;
const v35on = this.core.v35On && this.core.v35On();
const pw = (c.V35 && c.V35.TICKS_PER_WEEK) || 6;
const rw = v35on ? Math.max(1, Math.round(((c.V35.PAPER_RESEARCH_TICKS || 6) / pw) * 10) / 10) : 0;
const PER = this.paperPerPage();
const pages = Math.max(1, Math.ceil(list.length / PER));
let page = Math.max(0, Math.min(pages - 1, this._paperPage || 0));
if(this._paperPer!=null && this._paperPer!==PER){
const selected=list.findIndex(p=>p.no===this.core.paperNoOf(this._paperPick));
const anchor=selected>=0?selected:Math.min(list.length-1,Math.max(0,this._paperPage||0)*this._paperPer);
page=Math.floor(anchor/PER);
}
this._paperPer=PER;this._paperPage=page;
const pageList = list.slice(page * PER, page * PER + PER);
const pager = pages > 1
? `<div class="paper-pager">
           <button class="paper-page-btn" data-action="paper-page" data-id="-1" ${page <= 0 ? "disabled" : ""}>${this.icon("chevL", 12)}</button>
           <span class="paper-page-info">${page + 1} / ${pages}</span>
           <button class="paper-page-btn" data-action="paper-page" data-id="1" ${page >= pages - 1 ? "disabled" : ""}>${this.icon("chevR", 12)}</button>
         </div>`
: "";
return `
      <div class="paper-list">
        ${pageList.map((p) => {
const owned = this.core.hasPaper(p.no);
const doing = researching && this.core.paperNoOf(researching.id) === p.no;
const sel = this._paperPick != null && this.core.paperNoOf(this._paperPick) === p.no;
return `
            <div class="paper-card${owned ? " owned" : ""}${sel ? " selected" : ""}${doing ? " researching" : ""}"
                 data-action="paper-pick" data-id="${p.no}">
              <div class="paper-meta-row">
                <div class="paper-venue">${p.venue} · 引用 ${p.cite}</div>
                <div class="paper-status${owned ? " owned" : ""}">${owned ? "已掌握" : (doing ? "研究中" : "可研究")}</div>
              </div>
              <div class="paper-title">${p.title}</div>
              <div class="paper-authors">${p.authors}</div>
              <div class="paper-tags">${(p.tags || []).map((t) => `<span class="paper-tag">${t}</span>`).join("")}</div>
              <div class="paper-desc">${p.desc || ""}</div>
              <div class="paper-footer">
                <span class="paper-effect">${this.paperEffectText(p)}</span>
                <span class="paper-cost">${v35on ? "📖 研究 " + rw + " 周 · 免费（永续生效）" : `📖 ${p.weeks} 周研究`}</span>
              </div>
              ${doing ? `<div class="paper-countdown"><span>剩 ${this.core.paperWeeksLeft()} 周</span></div>` : ""}
            </div>`;
}).join("")}
      </div>
      ${pager}`;
},
paperEffectText(p) { return this.core.paperEffectText(p); },
omPaperPick(id) {
const no = this.core.paperNoOf(id);
this._paperPick = no != null ? no : id;
this.el.querySelectorAll(".paper-card").forEach((el) =>
el.classList.toggle("selected", +el.dataset.id === this._paperPick));
const footer = this.el.querySelector('#modalContainer[data-modal-key="paper"] .modal-footer');
if (footer) footer.innerHTML = this.officeModalMeta("paper").footer;
},
omShop() {
const c = this.core.cfg;
const s = this.core.state;
const tiers = Object.keys(c.GPU_TIERS || {});
const cur = this._shopPick || s.gpuTier || tiers[0];
this._shopPick = cur;
const genOf = (k) => (c.GPU_TIERS[k] || {}).gen || "A100";
const genOrder = (c.GPU_GEN_ORDER || ["A100"]).slice();
tiers.forEach((k) => { if (genOrder.indexOf(genOf(k)) < 0) genOrder.push(genOf(k)); });
if (genOrder.indexOf(this._shopGen) < 0) this._shopGen = genOf(cur);
const genTiers = tiers.filter((k) => genOf(k) === this._shopGen);
const showCur = genTiers.indexOf(cur) >= 0 ? cur : genTiers[0];
const tabs = genOrder.length > 1
? `<div class="shop-gen-tabs">${genOrder.map((g) =>
`<button class="shop-gen-tab${g === this._shopGen ? " active" : ""}" data-action="shop-gen" data-id="${g}">${g}</button>`
).join("")}</div>`
: "";
const t = (c.GPU_TIERS || {})[showCur] || {};
return `
      <div class="shop-body">
        ${tabs}
        <div class="shop-columns">
          <div class="shop-tiers-col">
            ${genTiers.map((k) => {
const x = c.GPU_TIERS[k];
const owned = (s.ownedGpus || []).includes(k);
return `
                <div class="shop-tier${showCur === k ? " selected" : ""}${owned ? " owned" : ""}" data-action="shop-pick" data-id="${k}">
                  <div class="shop-tier-info">
                    <div class="shop-tier-name">${x.name}档 · ${x.gpu}</div>
                    <div class="shop-tier-spec">参数上限 ${x.maxParam}B</div>
                  </div>
                  <div class="shop-tier-price">${s.gpuTier === k ? "使用中" : owned ? "已拥有" : fmtMoney(x.price)}</div>
                </div>`;
}).join("")}
          </div>
          <div class="shop-preview-col">
            <div class="shop-preview-icon" id="shopPreviewIcon">
              <img class="shop-gpu-img" src="${t.icon || "resource/ui/a100_single.webp"}" alt="" draggable="false">
            </div>
            <div class="shop-preview-name" id="shopPreviewName">${t.name || ""}</div>
            <div class="shop-preview-spec">${t.gpu || ""}</div>
          </div>
        </div>
      </div>`;
},
omShopPick(k) {
this._shopPick = k;
const t = (this.core.cfg.GPU_TIERS || {})[k] || {};
if (t.gen) this._shopGen = t.gen;
this.el.querySelectorAll(".shop-tier").forEach((el) => el.classList.toggle("selected", el.dataset.id === k));
const icon = this.el.querySelector("#shopPreviewIcon");
const name = this.el.querySelector("#shopPreviewName");
if (icon) {
icon.classList.remove("switching");
void icon.offsetHeight;
icon.classList.add("switching");
setTimeout(() => {
icon.innerHTML = `<img class="shop-gpu-img" src="${t.icon || "resource/ui/a100_single.webp"}" alt="" draggable="false">`;
}, 150);
}
if (name) name.textContent = t.name || "";
const spec = this.el.querySelector(".shop-preview-spec");
if (spec) spec.textContent = (t.gpu || "");
const buy = this.el.querySelector('[data-action="om-buygpu"]');
if (buy) {
const owned = (this.core.state.ownedGpus || []).includes(k);
buy.disabled = owned;
buy.classList.toggle("disabled", owned);
buy.textContent = owned ? "已拥有该档位，请选择其他档位" : "确认购买";
}
},
omTest() {
return this.omTestTree();
},
omTestTree() {
const core = this.core, s = core.state, c = core.cfg;
const tier = this.omTestTier();
const sk = (s.ver || "V1") + "|" + tier;
if (this._chatStatusKey !== sk) {
this._chatStatusKey = sk;
this._chatStatusText = core.c2Status(tier) || "……";
}
const rootText = this._chatStatusText || "……";
const opts = core.c2VisibleOpts();
const msgs = (this._omTestLog || []).map((m, i) => this.chatLogHTML(m, i)).join("");
const statusHTML = this._chatPendingStatus
? `<div class="test-status-line">${this.escHtml(this._chatPendingStatus)}</div>` : "";
const artHTML = this._chatPendingArtifact
? `<pre class="test-artifact">${this.escHtml(this._chatPendingArtifact)}</pre>` : "";
return `
      <div class="test-chat-area">
        <div class="test-chat-header">
          <div class="test-chat-avatar"><img src="${(c.UI_PORTS || {}).chat || "resource/character/stand.webp"}" alt="鲸鱼娘"></div>
          <div class="tch-meta">
            <div class="test-chat-title">${this.tpl("{model}")} ${s.ver || "V1"}</div>
            <div class="test-chat-status">${this.tpl(rootText)}</div>
          </div>
        </div>
        <div class="test-messages" id="testMessages">
          ${msgs}
        </div>
        ${statusHTML}
        ${artHTML}
        <div class="test-engineer-note" id="testEngineerNote"${this._omTestNote ? "" : ' style="display:none"'}>
          ${this.icon("chat", 12)}<span id="engineerNoteText">${this._omTestNote || ""}</span>
        </div>
      </div>
      <div class="test-suggest-row">
        <div class="test-suggest-options" id="testOptions">
          ${this.chatOptsHTML(opts)}
        </div>
      </div>`;
},
omTestOpen() {
const ver = this.core.state.ver;
const healed = this.core.healC2 && this.core.healC2();
const endedWithoutLog = this.core.c2State && this.core.c2State().ended && !(this._omTestLog || []).length;
if (healed || endedWithoutLog || (this._omTestVer != null && this._omTestVer !== ver)) this.resetOmTestChat();
this._omTestVer = ver;
this._omTestLog = this._omTestLog || [];
if (this._omTestNote == null) this._omTestNote = "";
if (this._chatPendingStatus == null) this._chatPendingStatus = "";
if (this._chatPendingArtifact == null) this._chatPendingArtifact = "";
this._chatStatusKey = null;
},
chatOptsHTML(opts, anim) {
if (this.chatReplyBusy()) { this._chatOpts = []; return ""; }
const list = (opts || []).filter((o) => o.to !== null && o.to !== "root");
this._chatOpts = list;
const one = list.length === 1 ? String(list[0].text || "") : "";
const label = list.length ? "点击选择消息" : "这个话题聊完了";
void one;
const panel = this._chatPanel;
const toolsOK = this.chatToolsOpen();
let sheet = "";
if (panel === "opt" && list.length) sheet = this.chatSheetOpts(list);
else if (panel === "tool") sheet = this.chatSheetTool();
const SHOW_CHAT_TOOL_BTN = false;
if (sheet && anim) sheet = sheet.replace('class="chat-sheet"', 'class="chat-sheet cs-open"');
return `
      <div class="chat-bar">
        <button class="cb-main${list.length ? "" : " cb-off"}" data-action="chat-panel" data-panel="opt"${list.length ? "" : " disabled"}>
          ${this.escHtml(label)}</button>
        ${SHOW_CHAT_TOOL_BTN ? `<button class="cb-side cb-plus${toolsOK ? "" : " cb-off"}${panel === "tool" ? " on" : ""}" data-action="chat-panel" data-panel="tool"
          title="${toolsOK ? "玩家工具（记事本 / 图片 / 语音）" : "V3.5 起开放"}">${this.icon("plus", 18)}</button>` : ""}
      </div>
      ${sheet}`;
},
chatSheetOpts(list) {
return `<div class="chat-sheet">
      <div class="cs-head">选择要说的话</div>
      ${list.map((o) => {
const key = o._id != null ? o._id : o._i;
return `<button class="cs-item" data-action="om-test-opt" data-opt="${key}">
          <span>${this.escHtml(this.core.chatVar(String(o.text == null ? "" : o.text)))}</span>${this.icon("chevR", 13)}</button>`;
}).join("")}
    </div>`;
},
chatSheetTool() {
const T = (this.core.cfg.PLAYER_TOOLS) || {};
const sub = this._chatSub;
if (sub === "note") return this.chatSheetNotes();
if (sub === "img" || sub === "voice") {
const pool = (sub === "img" ? T.IMAGE_POOL : T.VOICE_POOL) || [];
return `<div class="chat-sheet">
        <div class="cs-head">${sub === "img" ? "发一张图片" : "发一条语音"}
          <button class="cs-back" data-action="chat-sub" data-sub="">返回</button></div>
        ${pool.length ? pool.map((it, i) => `<button class="cs-item" data-action="chat-send-media" data-kind="${sub}" data-i="${i}">
            <span>${this.escHtml(it.name || it.src || "")}</span></button>`).join("")
: `<div class="cs-note">还没配素材（缺少图片 / 语音）。</div>`}
      </div>`;
}
const tools = [
["note", "note", "记事本", this.notebookList().length],
["img", "image", "图片", (T.IMAGE_POOL || []).length],
["voice", "audio", "语音", (T.VOICE_POOL || []).length],
];
return `<div class="chat-sheet">
      <div class="cs-head">玩家工具</div>
      <div class="cs-tools">${tools.map(([k, ic, name, n]) =>
`<button class="cs-tool" data-action="chat-sub" data-sub="${k}">
          <i>${this.icon(ic, 16)}</i><span>${name}</span>${n ? `<em>${n} 项</em>` : ""}</button>`).join("")}</div>
    </div>`;
},
notebookList() {
const T2 = ((this.core.cfg.CHAT_TREE2 || {}).NOTES) || {};
const seen = [];
(this.core.state.notebook || []).forEach((x) => {
const id = String(x);
if (!T2[id] || seen.indexOf(id) >= 0) return;
seen.push(id);
});
return seen.map((id) => ({ id: id, name: T2[id].name || id, text: T2[id].text || "" }));
},
chatSheetNotes() {
const list = this.notebookList();
return `<div class="chat-sheet">
      <div class="cs-head">记事本（${list.length} 条）
        <button class="cs-back" data-action="chat-sub" data-sub="">返回</button></div>
      ${list.length ? list.map((n) => `<div class="cs-note-item"><b>${this.escHtml(this.core.chatVar(n.name))}</b>
          <span>${this.escHtml(this.core.chatVar(n.text))}</span></div>`).join("")
: `<div class="cs-note">还没记下什么。先去跟她聊点有的没的。</div>`}
    </div>`;
},
chatToolsOpen() {
const T = (this.core.cfg.PLAYER_TOOLS) || {};
const need = T.UNLOCK_VER || "V3.5";
const order = this.core.cfg.VER_ORDER || [];
return order.indexOf(this.core.state.ver || "V1") >= order.indexOf(need);
},
async chatSendMedia(kind, i) {
const T = (this.core.cfg.PLAYER_TOOLS) || {};
const it = ((kind === "img" ? T.IMAGE_POOL : T.VOICE_POOL) || [])[+i];
if (!it || !it.src) return;
const box = this.el.querySelector("#testMessages");
if (!box) return;
this._chatPanel = null; this._chatSub = null;
const me = document.createElement("div");
me.className = "msg-user msg-media";
me.innerHTML = this.chatMediaHTML({ type: kind === "img" ? "image" : "audio", src: it.src });
box.appendChild(me);
if (kind === "voice" || kind === "img") this.primeVoiceSec(me.querySelector(".chat-voice"));
this._omTestLog = this._omTestLog || [];
this._omTestLog.push({ me: true, media: { type: kind === "img" ? "image" : "audio", src: it.src, text: "" } });
box.scrollTop = box.scrollHeight;
this.refreshChatBar();
this.el.querySelectorAll(".cb-main, .cb-side").forEach((b) => { b.disabled = true; });
const typing = document.createElement("div");
typing.className = "msg-bot typing";
typing.innerHTML = "<span>·</span><span>·</span><span>·</span>";
box.appendChild(typing);
box.scrollTop = box.scrollHeight;
await new Promise((r) => setTimeout(r, 900));
typing.remove();
const tool = kind === "img" ? "vision" : "asr";
if (this.core.callLogSteps) await this.chatSysSteps(this.core.callLogSteps(tool), box);
const reply = it.reply || (kind === "img" ? "（她看了看这张图）……我看到了。" : "（她听了一下）……我听到了。");
this._omTestLog.push({ me: false, text: reply });
box.appendChild(this.msgEl("bot", reply));
box.scrollTop = box.scrollHeight;
this.refreshChatBar();
},
refreshChatBar() {
const opts = this.core.c2VisibleOpts();
this.renderChatBar(opts);
},
renderChatBar(opts) {
const wrap = this.el.querySelector("#testOptions");
if (!wrap) return;
const key = (this._chatPanel || "") + "/" + (this._chatSub || "");
const anim = key !== this._barKey;
this._barKey = key;
const oldSheet = wrap.querySelector(".chat-sheet");
wrap.innerHTML = this.chatOptsHTML(opts, anim);
const sheet = wrap.querySelector(".chat-sheet");
if (!sheet && oldSheet && anim && !this.chatReplyBusy()) {
const ghost = oldSheet;
ghost.classList.remove("cs-open");
ghost.classList.add("cs-leaving");
wrap.appendChild(ghost);
const ease = "cubic-bezier(.22,.61,.36,1)";
ghost.style.transition = "height .18s " + ease + ", padding .18s " + ease
+ ", margin .18s " + ease + ", border-width .18s " + ease + ", opacity .14s ease";
requestAnimationFrame(() => {
ghost.style.height = "0px";
ghost.style.paddingTop = "0px";
ghost.style.paddingBottom = "0px";
ghost.style.marginBottom = "0px";
ghost.style.borderWidth = "0px";
ghost.style.opacity = "0";
});
setTimeout(() => ghost.remove(), 260);
}
this.el.querySelectorAll(".test-suggest-btn, .cb-main, .cb-side").forEach((b) => { b.disabled = this.chatReplyBusy() || b.classList.contains("cb-off"); });
},
finishOmTestOpt() {
const box = this.el.querySelector("#testMessages");
if (!box) return;
const core = this.core;
const statusHTML = this._chatPendingStatus
? `<div class="test-status-line">${this.escHtml(this._chatPendingStatus)}</div>` : "";
const artHTML = this._chatPendingArtifact
? `<pre class="test-artifact">${this.escHtml(this._chatPendingArtifact)}</pre>` : "";
box.insertAdjacentHTML("beforeend", statusHTML + artHTML);
box.scrollTop = box.scrollHeight;
this.ensureTestChatVisible();
const note = this.el.querySelector("#testEngineerNote");
const noteText = this.el.querySelector("#engineerNoteText");
if (this._omTestNote && note && noteText) { noteText.textContent = this._omTestNote; note.style.display = ""; }
this.refreshChatBar();
this.el.querySelectorAll(".test-suggest-btn").forEach((b) => { b.disabled = false; });
},
chatReplyAlive(turn) {
const state = this.core && this.core.state;
return !!(turn && this._chatReplyTurn === turn && this.core === turn.core &&
state === turn.state && state.ver === turn.ver && state.phase === turn.phase &&
this._omTestLog === turn.log && (!turn.accepted || (state.c2 === turn.c2 && String(state.c2.lastOpt) === turn.optId)));
},
chatReplyBusy() { return this.chatReplyAlive(this._chatReplyTurn); },
releaseChatReply(turn) {
if (this._chatReplyTurn !== turn) return;
this._chatReplyTurn = null;
if (this.el && this.el.querySelector('#testOptions')) this.refreshChatBar();
},
failChatReply(turn) {
if (this._chatReplyTurn !== turn) return;
this.releaseChatReply(turn);
this.toast('回复显示暂时中断，可以继续聊天或换个话题');
},
omTestOptC2(optId) {
const core = this.core, s = core.state;
let box = this.el.querySelector("#testMessages");
if (!box || this.chatReplyBusy()) return false;
this._omTestLog = this._omTestLog || [];
const turn = { core, state:s, ver:s.ver, phase:s.phase, log:this._omTestLog, optId:String(optId), started:false };
this._chatReplyTurn = turn;
const alive = () => this.chatReplyAlive(turn);
try {
const visible = core.c2VisibleOpts();
if (!visible.some(o => String(o._id) === String(optId))) { this.releaseChatReply(turn); return false; }
const r = core.c2Choose(String(optId), this.omTestTier());
if (!r) { this.releaseChatReply(turn); return false; }
turn.accepted = true; turn.c2 = s.c2;
this._chatPanel = null; this._chatSub = null;
this.refreshChatBar();
s.testBadgeVer = s.ver || "V1";
const meText = core.chatVar(r.opt.text || "");
this._omTestLog = this._omTestLog || [];
this._lastOptId = String(optId);
this._omTestLog.push({ me: true, text: meText, optId: String(optId) });
box.appendChild(this.msgEl("user", meText));
box.scrollTop = box.scrollHeight;
const a = r.reply;
const noteA = a ? core.c2FlattenThen(a).filter((x) => x && x.noteFor).pop() : null;
if (noteA && core.c2Notes()[String(noteA.noteFor)]) {
const rec = core.c2Notes()[String(noteA.noteFor)] || {};
if (window.SFX && SFX.play) SFX.play("ui");
this._omTestNote = "记本子上了：" + core.chatVar(String(rec.name || noteA.noteFor));
}
this.ensureTestChatVisible();
this.el.querySelectorAll(".test-suggest-btn").forEach((b) => { b.disabled = true; });
const typing = document.createElement("div");
typing.className = "msg-bot typing";
typing.innerHTML = "<span>·</span><span>·</span><span>·</span>";
box.appendChild(typing);
box.scrollTop = box.scrollHeight;
setTimeout(async () => {
if (!alive() || turn.started) return;
turn.started = true;
try {
box = this.el.querySelector("#testMessages") || box;
typing.remove();
this._chatPendingStatus = "";
this._chatPendingArtifact = "";
if (!a) { this.releaseChatReply(turn); this.finishOmTestOpt(); return; }
const chain = core.c2FlattenThen(a);
const pushBot = (txt) => {
if (!txt || !alive()) return;
box = this.el.querySelector("#testMessages") || box;
this._omTestLog.push({ me: false, text: txt });
box.appendChild(this.msgEl("bot", txt));
box.scrollTop = box.scrollHeight;
};
for (const a of chain) {
if (!alive()) return;
box = this.el.querySelector("#testMessages") || box;
this._chatPendingStatus = "";
this._chatPendingArtifact = a.artifact || "";
const th = (a.type === "think") ? a : (a.think || null);
if (a.type !== "cot" && !th && String(a.status || "").trim()) {
await this.chatSysSteps(String(a.status).split("→"), box, turn);
if (!alive()) return;
}
if (a.type === "cot") {
pushBot(core.chatVar(a.pre || ""));
await this.chatCotPlay(a.steps, box, turn);
if (!alive()) return;
pushBot(core.chatVar(a.post || ""));
continue;
}
if (th) {
pushBot(core.chatVar(a.pre || ""));
await this.chatThinkPlay(th, box, turn);
if (!alive()) return;
if (a.type === "think") {
pushBot(core.chatVar(a.post || a.text || ""));
continue;
}
}
if (a.type === "image" || a.type === "video" || a.type === "audio") {
const el = document.createElement("div");
el.className = "msg-bot msg-media";
el.innerHTML = this.chatMediaHTML(a);
box.appendChild(el);
if (a.type === "audio") this.primeVoiceSec(el.querySelector(".chat-voice"));
this._omTestLog.push({ me: false, media: a });
box.scrollTop = box.scrollHeight;
continue;
}
if (a.type === "link") {
const html = this.chatLinkHTML(a);
this.renderGameMsg(html);
this._omTestLog.push({ me: false, html });
continue;
}
let text = this.core.chatVar(a.text || "");
if ((r.opt.act === "game" || a.act === "game") && text.indexOf("{link}") >= 0) {
const g = this.omTestGame();
if (g) {
text = this.renderGameReply(text, g);
this.renderGameMsg(text);
this._omTestLog.push({ me: false, html: text });
continue;
}
}
pushBot(core.chatVar(text));
}
if (!alive()) return;
this.releaseChatReply(turn);
this.finishOmTestOpt();
} catch (error) { if (alive()) this.failChatReply(turn); }
finally { this.releaseChatReply(turn); }
}, 900);
return true;
} catch (error) { this.failChatReply(turn); return false; }
},
chatResourceSrc(src) {
const paths = window.ResourcePaths;
return typeof src === "string" && paths && typeof paths.canonical === "function" ? paths.canonical(src) : src;
},
chatMediaHTML(a) {
const src = this.escHtml(this.chatResourceSrc(a.src || ""));
if (!a.src) return `<span class="chat-media-missing">（没配文件：${this.escHtml(a.type)}）</span>`;
if (a.type === "image") {
const cap = a.text ? `<i class="chat-media-cap">${this.escHtml(this.core.chatVar(a.text))}</i>` : "";
return `<span class="chat-media-fig">`
+ `<img class="chat-media-img" src="${src}" alt="她发的图" `
+ `data-action="chat-zoom" data-kind="image" data-src="${src}">`
+ cap + `</span>`;
}
if (a.type === "video") {
return `<span class="chat-media-video" data-action="chat-zoom" data-kind="video" data-src="${src}">`
+ `<video src="${src}" preload="metadata" muted playsinline></video>`
+ `<i class="chat-media-play">${this.icon("play", 18) || "▶"}</i></span>`;
}
if (a.type === "audio") {
const wave = `<svg class="cv-wave" width="16" height="16" viewBox="0 0 24 24" fill="none"`
+ ` stroke="currentColor" stroke-width="2.2" stroke-linecap="round">`
+ `<path d="M4 9v6"/><path d="M9 5.5v13"/><path d="M14 8v8"/><path d="M19 10.5v3"/></svg>`;
const cap = a.text ? this.escHtml(this.core.chatVar(a.text)) : "";
return `<span class="chat-voice" data-action="chat-voice" data-src="${src}" data-cap="${cap}">`
+ wave + `<b class="cv-sec">…</b><button type="button" class="chat-voice-replay" data-action="chat-voice-replay" aria-label="从头重播这条语音">↻ 重播</button></span>`
+ (this.chatSubOn() && cap ? `<i class="chat-voice-cap">${cap}</i>` : "");
}
return "";
},
chatSubOn() {
this._chatSubtitle = true;
return true;
},
chatSubtitle(on) {
this._chatSubtitle = this.chatSubOn();
try { localStorage.setItem("xj_chat_sub", "1"); } catch (e) { }
this.el.querySelectorAll(".chat-voice").forEach((v) => {
const p = v.parentNode;
if (!p) return;
const old = p.querySelector(".chat-voice-cap");
const txt = v.dataset.cap || "";
if (this._chatSubtitle && txt) {
if (old) { old.textContent = txt; return; }
const i = document.createElement("i");
i.className = "chat-voice-cap";
i.textContent = txt;
v.insertAdjacentElement("afterend", i);
} else if (old) old.remove();
});
this.refreshChatBar();
},
primeVoiceSec(el) {
if (!el || !el.dataset.src) return;
el.dataset.src = this.chatResourceSrc(el.dataset.src);
const sec = el.querySelector(".cv-sec");
if (typeof Audio !== "function") {
if (sec && sec.textContent === "…") sec.textContent = "语音";
return;
}
const a = new Audio();
a.preload = "metadata";
const fill = () => { if (sec && isFinite(a.duration)) sec.textContent = Math.round(a.duration) + "″"; };
a.onloadedmetadata = fill;
a.src = el.dataset.src;
if (a.readyState >= 1) fill();
setTimeout(() => {
if (sec && sec.textContent === "…") sec.textContent = "语音";
}, 1500);
},
pauseChatVoice() {
this._voiceRequest = (this._voiceRequest || 0) + 1;
if (this._voiceAudio) this._voiceAudio.pause();
if (this._voiceEl) this._voiceEl.classList.remove("playing");
},
chatVoice(el, replay = false) {
if (!el) return;
const src = this.chatResourceSrc(el.dataset.src);
if (src) el.dataset.src = src;
if (!src) return;
if (typeof Audio !== "function") return;
if (!this._voiceAudio) this._voiceAudio = new Audio();
const a = this._voiceAudio;
if (!replay && this._voiceEl === el && !a.paused) { this.pauseChatVoice(); return; }
if (window.CityJourney && CityJourney.pauseVoice) CityJourney.pauseVoice();
const request = this._voiceRequest = (this._voiceRequest || 0) + 1;
if (this._voiceEl && !a.paused) a.pause();
if (this._voiceEl) this._voiceEl.classList.remove("playing");
const sec = el.querySelector(".cv-sec");
const fill = () => { if (sec && isFinite(a.duration)) sec.textContent = Math.round(a.duration) + "″"; };
a.onloadedmetadata = fill;
a.onended = () => { if (request === this._voiceRequest) el.classList.remove("playing"); };
if (this._chatVoiceSrc !== src) { a.src = src; this._chatVoiceSrc = src; }
a.currentTime = 0;
if (a.readyState >= 1) fill();
this._voiceEl = el;
el.classList.add("playing");
const play = a.play();
if (play && play.catch) play.catch((e) => { if (request !== this._voiceRequest) return; el.classList.remove("playing"); this.toast("这条语音放不出来：" + e.message); });
},
chatZoom(kind, src) {
const old = this.el.querySelector("#chatZoomMask");
if (old) old.remove();
const mask = document.createElement("div");
mask.id = "chatZoomMask";
mask.className = "chat-zoom-mask";
mask.dataset.action = "chat-zoom-close";
mask.innerHTML = kind === "video"
? `<video src="${this.escHtml(src)}" controls autoplay playsinline></video>`
: `<img src="${this.escHtml(src)}" alt="放大查看">`;
this.el.appendChild(mask);
if (window.SFX && SFX.play) SFX.play("ui");
},
async chatSysSteps(steps, box, turn) {
if (this.core.callLogOn && !this.core.callLogOn()) return;
if (!box) box = this.el.querySelector("#testMessages");
const list = (steps || []).map((x) => String(x == null ? "" : x).trim()).filter(Boolean).slice(0, 3);
const ms = this.core.callLogStepMs ? this.core.callLogStepMs() : 700;
for (const txt of list) {
if (turn && !this.chatReplyAlive(turn)) return;
if (!box || !box.isConnected) box = this.el.querySelector("#testMessages") || box;
if (!box) return;
const txtShown = this.core.chatVar(txt);
const row = document.createElement("div");
row.className = "chat-sys";
row.textContent = "· " + txtShown;
box.appendChild(row);
box.scrollTop = box.scrollHeight;
this._omTestLog = this._omTestLog || [];
this._omTestLog.push({ me: false, sys: txtShown });
await new Promise((r) => setTimeout(r, ms));
}
},
async chatCotPlay(steps, box, turn) { await this.chatSysSteps(steps, box, turn); },
chatThinkHTML(a, open, idx) {
const src = a || {};
const steps = (src.steps || src.lines || []);
const body = steps.map((t) => {
const s = String(t == null ? "" : t);
const song = s.charAt(0) === "♪";
return `<div class="chat-think-line${song ? " song" : ""}">${this.escHtml(this.core.chatVar(s))}</div>`;
}).join("");
return `<div class="chat-think${open === false ? " collapsed" : ""}"`
+ ` data-action="chat-think-toggle" data-idx="${idx == null ? "" : idx}">`
+ `<div class="chat-think-head"><i>${this.icon("chevR", 12)}</i>`
+ `<span>${this.escHtml(this.core.chatVar(String(src.title == null ? "" : src.title) || "思考过程"))}</span></div>`
+ `<div class="chat-think-body">${body}</div></div>`;
},
async chatThinkPlay(a, box, turn) {
if (turn && !this.chatReplyAlive(turn)) return;
this._omTestLog = this._omTestLog || [];
const entry = { me: false, think: a, open: true };
this._omTestLog.push(entry);
const idx = this._omTestLog.length - 1;
const host = document.createElement("div");
host.className = "msg-bot msg-think";
host.innerHTML = this.chatThinkHTML(a, true, idx);
box.appendChild(host);
box.scrollTop = box.scrollHeight;
const budget = Number((this.core.callLogCfg && this.core.callLogCfg().THINK_TOTAL_MS) || 0) || 3000;
const lines = Array.prototype.slice.call(host.querySelectorAll(".chat-think-line"));
const ms = Math.max(80, Math.min(420, Math.round(budget / Math.max(1, lines.length))));
lines.forEach((el) => el.classList.add("hide"));
for (const el of lines) {
if (turn && !this.chatReplyAlive(turn)) return;
el.classList.remove("hide");
box.scrollTop = box.scrollHeight;
await new Promise((r) => setTimeout(r, ms));
if (turn && !this.chatReplyAlive(turn)) return;
if (!box.isConnected) box = this.el.querySelector("#testMessages") || box;
}
await new Promise((r) => setTimeout(r, 220));
if (turn && !this.chatReplyAlive(turn)) return;
entry.open = false;
const live = this.el.querySelector('.chat-think[data-idx="' + idx + '"]');
if (live) live.classList.add("collapsed");
},
msgEl(kind, text) {
const div = document.createElement("div");
div.className = kind === "user" ? "msg-user" : "msg-bot";
div.style.whiteSpace = "pre-wrap";
div.textContent = text == null ? "" : String(text);
return div;
},
chatLogHTML(m, i) {
if (m.sys != null) return `<div class="chat-sys">· ${this.escHtml(m.sys)}</div>`;
if (m.think) return `<div class="msg-bot msg-think">${this.chatThinkHTML(m.think, m.open !== false, i)}</div>`;
const cls = m.me ? "msg-user" : "msg-bot";
if (m.media) return `<div class="${cls} msg-media">${this.chatMediaHTML(m.media)}</div>`;
return `<div class="${cls}">${m.html != null ? m.html : this.escHtml(m.text)}</div>`;
},
primeVoicesIn(scope) {
if (!scope || !scope.querySelectorAll) return;
scope.querySelectorAll(".chat-voice").forEach((v) => {
const sec = v.querySelector(".cv-sec");
if (sec && sec.textContent === "…") this.primeVoiceSec(v);
});
},
chatLinkHTML(a) {
const src = a || {};
const url = String(src.url || "").trim();
if (!url) return `<span class="chat-media-missing">（这条回答还没配链接）</span>`;
const label = String(src.linkText || "").trim() || "点开看看";
let host = "";
try { host = new URL(url).hostname; } catch (e) { host = url.replace(/^https?:\/\//, "").split("/")[0]; }
const head = src.text ? this.escHtml(this.core.chatVar(String(src.text))) + "\n" : "";
return head
+ `<a class="chat-link-card" href="${this.escHtml(url)}" target="_blank" rel="noopener noreferrer"`
+ ` title="${this.escHtml(url)}（新标签页打开）">`
+ `<i class="chat-link-ic">${this.icon("external-link", 15)}</i>`
+ `<b class="chat-link-body"><span class="chat-link-title">${this.escHtml(label)}</span>`
+ `<span class="chat-link-host">${this.escHtml(host)}</span></b></a>`;
},
renderGameReply(tpl, g) {
const url = (g && g.url) || "", linkText = (g && g.linkText) || "点击打开我做的游戏";
const [before, after = ""] = String(tpl || "").split("{link}");
return this.escHtml(before)
+ (url
? `<a href="${this.escHtml(url)}" target="_blank" rel="noopener noreferrer" class="test-game-link">${this.escHtml(linkText)}</a>`
: this.escHtml(url))
+ this.escHtml(after);
},
renderGameMsg(html) {
const box = this.el && this.el.querySelector("#testMessages");
if (!box) return;
const div = document.createElement("div");
div.className = "msg-bot";
div.style.whiteSpace = "pre-wrap";
div.innerHTML = html;
box.appendChild(div);
},
resetOmTestChat() {
this._chatReplyTurn = null;
this._omTestLog = [];
this._omTestNote = "";
this._chatPendingStatus = "";
this._chatPendingArtifact = "";
this.core.state.chatNode = null;
if (this.core.c2Reset) this.core.c2Reset();
},
omTestRestart() {
this.resetOmTestChat();
this.core.state.officeModal = "test";
this.refreshOfficeBody();
},
omTestEnd() {
this.resetOmTestChat();
this.core.state.officeModal = null;
if (window.SFX) SFX.play("click");
this.render({ soft: true });
},
omTestStatus(s) {
const tier = this.omTestTier();
return { dumb: "胡言乱语中", full: "能说人话了" }[tier];
},
omTestTier() {
const s = this.core.state;
if (this.core.v35On && this.core.v35On()) {
const nodeW = ((this.core.cfg.V35 || {}).TEST || {}).NODE_WEEK;
if (nodeW != null && (s.week || 0) < nodeW) return "dumb";
return window.V35.testTier({ ver:s.ver, stats:s }).tier;
}
return (s.text || 0) >= 18 ? "full" : "dumb";
},
ensureTestChatVisible() {
const body = this.el && this.el.querySelector(".test-modal-body");
if (body) body.scrollTop = 0;
},
omTestGame() { return this.core.cfg.TEST_GAME || { enabled: false, ver: "V4.5", q: "帮我做个游戏", ok: "", bad: "", url: "", linkText: "" }; },
omTestGameEnabled() {
const g = this.omTestGame();
if (!g.enabled) return false;
const order = this.core.cfg.VER_ORDER || [];
const cur = order.indexOf(this.core.state.ver || "V1");
const at = order.indexOf(g.ver || "V4.5");
if (at < 0) return true;
return cur >= at;
},
omTestGameSend() {
const g = this.omTestGame();
const box = this.el.querySelector("#testMessages");
if (!box || !g) return;
this.core.state.testBadgeVer = this.core.state.ver || "V1";
this._omTestLog = this._omTestLog || [];
const tip = box.querySelector(".test-empty-tip");
if (tip) tip.remove();
const tier = this.omTestTier();
const meText = g.q || "帮我做个游戏";
this._omTestLog.push({ me: true, text: meText });
const userMsg = document.createElement("div");
userMsg.className = "msg-user";
userMsg.textContent = meText;
box.appendChild(userMsg);
box.scrollTop = box.scrollHeight;
this.ensureTestChatVisible();
this.el.querySelectorAll(".test-suggest-btn").forEach((b) => { b.disabled = true; });
const typing = document.createElement("div");
typing.className = "msg-bot typing";
typing.innerHTML = "<span>·</span><span>·</span><span>·</span>";
box.appendChild(typing);
box.scrollTop = box.scrollHeight;
setTimeout(() => {
typing.remove();
const botMsg = document.createElement("div");
botMsg.className = "msg-bot";
botMsg.style.whiteSpace = "pre-wrap";
if (tier === "full") {
const ok = g.ok || "";
const [before, after = ""] = ok.split("{link}");
const url = g.url || "", linkText = g.linkText || "点击打开我做的游戏";
const html = this.escHtml(before)
+ (url
? `<a href="${this.escHtml(url)}" target="_blank" rel="noopener noreferrer" class="test-game-link">${this.escHtml(linkText)}</a>`
: this.escHtml(url))
+ this.escHtml(after);
this._omTestLog.push({ me: false, html });
botMsg.innerHTML = html;
} else {
const bad = g.bad || "咕嘎……%%￥#@&*";
this._omTestLog.push({ me: false, text: bad });
botMsg.textContent = bad;
}
box.appendChild(botMsg);
box.scrollTop = box.scrollHeight;
this.ensureTestChatVisible();
const note = this.el.querySelector("#testEngineerNote");
const noteText = this.el.querySelector("#engineerNoteText");
this._omTestNote = tier === "full" ? "它真把游戏做出来了，还发了个链接。" : "它只是在胡言乱语——还不会做游戏。";
if (note && noteText) { noteText.textContent = this._omTestNote; note.style.display = ""; }
this.el.querySelectorAll(".test-suggest-btn").forEach((b) => { b.disabled = false; });
}, 900);
},
omReview() {
const s = this.core.state;
const c = this.core.cfg;
const cap = this.core.statCap();
const pass = this.core.passLine();
const r = this.core.evaluate();
const can = this.core.canReview();
const v35on = this.core.v35On && this.core.v35On();
const totalW = this.core.minWeeks(s.ver);
const COLORS = {
code: "linear-gradient(90deg,#6fc3ff,#2789c4)", text: "linear-gradient(90deg,#7ed4f0,#3dbbd8)",
safety: "linear-gradient(90deg,#ffcf8a,#f2b84b)", stability: "linear-gradient(90deg,#7ed4b0,#53b98d)",
};
const axIds = this.core.v35AxisIds(s);
const need = (k) => this.modelPass(k);
const row = (k) => {
const v = Math.round(this.modelValue(k, s));
const c = this.modelCap(k) || 1;
const pct = Math.max(0, Math.min(100, (v / c) * 100));
const nd = Math.ceil(need(k));
const ok = this.modelValue(k, s) >= need(k) && need(k) > 0;
const isAx = axIds.indexOf(k) >= 0;
const fill = isAx ? this.dimFill(k) : COLORS[k] || "linear-gradient(90deg,#6fc3ff,#2789c4)";
return `
        <div class="review-stat${isAx ? " review-stat-axis" : ""}">
          <span class="rs-label">${this.modelLabel(k)}${v35on && isAx ? "能力" : ""}</span>
          <div class="rs-bar"><div class="rs-fill" style="width:${pct.toFixed(0)}%;background:${fill}"></div></div>
          <span class="rs-val${ok ? " ok" : ""}">${v}/${nd}</span>
        </div>`;
};
const wTbl = ((c.V35 || {}).REVIEW || {}).WEIGHTS_BY_VER || {};
const wRow = wTbl[s.ver || "V1"] || ((c.V35 || {}).REVIEW || {}).WEIGHTS || {};
const wDims = this.modelDims(s).map(d=>({...d, weight:d.sources.reduce((n,k)=>n+(wRow[k]||0),0)})).filter(d=>d.weight>0);
const wSum = wDims.reduce((n,d)=>n+d.weight,0) || 1;
const wText = wDims.map(d=>d.label + " " + Math.round(d.weight/wSum*100) + "%").join(" · ");
return `
      <div class="review-certificate">
        <div class="review-header">
          <div class="review-header-icon">${this.icon("shield", 20)}</div>
          <div class="review-header-text">
            <div class="review-header-title">项目评审报告</div>
            <div class="review-header-sub">REVIEW REPORT · ${s.ver || "V1"}</div>
          </div>
        </div>
        <div class="review-desc">
          ${v35on
? (can ? "训练周期已完成，<strong>由你决定何时发起评审</strong>。点「开始评审」进入" + (this.core.embodiedAvailable && this.core.embodiedAvailable() ? "具身实地测评" : "答题测评") + "，之后出具结算。" : `训练周期进行中（第 ${Math.min(s.week || 0, totalW)} / ${totalW} 周）——第 ${totalW} 周结束后可发起评审。`)
: "指标达标后即可随时发起评审，评审通过进入下一阶段。"}
        </div>
        <div class="review-stats">
          ${this.modelDims(s).filter(d=>d.sources.every(k=>this.core.baseDims().includes(k))).map(d=>row(d.key)).join("")}
        </div>
        ${axIds.length ? `
        <div class="review-axis-sep">追加能力 · 只有特定「架构 × 参数」才有的轴</div>
        <div class="axis-pills" style="margin-top:8px">
          ${axIds.map((k) => {
const d = this.core.axisDef(k, s.ver) || {};
const v = Math.round(s[k] || 0);
const nd = Math.ceil(need(k));
const ok = need(k) > 0 && (s[k] || 0) >= need(k);
const pct = Math.max(0, Math.min(100, (v / (cap[k] || 1)) * 100));
return `<span class="axis-pill${ok ? " ok" : ""}" title="${d.tip || ""}">
              <span class="ap-ic">${this.axisIcon(k, 13)}</span>
              <span class="ap-name">${this.modelLabel(k)}</span>
              <span class="ap-num">${v}${nd ? `<i>/${nd}</i>` : ""}</span>
              <span class="ap-bar"><i style="width:${pct.toFixed(0)}%;background:${this.dimFill(k)}"></i></span>
            </span>`;
}).join("")}
        </div>` : ""}
        ${wText ? `<div class="review-weights">加权：${wText}<span class="rw-note">（漏练的维度按 0 计入总分）</span></div>` : ""}
        ${r.qualificationFailed ? '<div class="review-failure-reasons">'+this.escHtml(this.core.reviewFailurePolicy().UI.PREVIEW.replace('{reasons}',r.failureItems.join('、')))+'</div>' : ''}
        <div class="review-countdown">
          <div class="rc-label">预估总评</div>
          <div class="rc-value">${Math.round(r.score || 0)}</div>
        </div>
        ${r.qualificationFailed ? `<div class="review-breakdown">${this.escHtml(this.core.reviewFailurePolicy().UI.SCORE)}</div>` : r.rawScore != null ? `<div class="review-breakdown">维度加权 ${Math.round(r.rawScore)} + 品质加成 ${r.qBonus >= 0 ? "+" : "−"}${Math.round(Math.abs(r.qBonus))}（优秀线 ${Math.ceil(r.excellentLine)}${r.topLine != null ? " · 顶尖线 " + Math.ceil(r.topLine) : ""}）</div>` : ""}
      </div>`;
},
omGuide() {
const core = this.core, c = core.cfg, s = core.state, v = c.V35 || {};
const pass = core.passLine();
const money = value => { const n = Number(value); return Number.isFinite(n) ? (n % 10000 === 0 ? n / 10000 + " 万元" : n.toLocaleString("zh-CN") + " 元") : "未配置"; };
const esc = value => this.escHtml(String(value == null ? "" : value));
const order = c.VER_ORDER || ["V1"], vi = Math.max(0, order.indexOf(s.ver));
const main = (c.PASS_PRIZE_BY_VER || {})[s.ver] ?? 300000 * (vi + 1);
const tick = v.TICK_S || 10, tpw = v.TICKS_PER_WEEK || 6, TB = c.TEAM_BUILD || {};
const axes = v.AXES || {}, defs = axes.DEF || {};
const archName = id => { const a = (c.ARCHITECTURES || []).find(x => x.id === id); return esc(a ? a.name : id); };
const base = (c.TUTORIAL || []).map(t => {
if (t.id !== "t_axis" || axes.ENABLED === false) return t;
const rules = Object.entries(defs).filter(([, d]) => d && d.source).map(([key, d]) => {
const a = d.source;
return `<b>${esc(d.name || core.statLabel(key))}</b>：${(a.archs || []).map(archName).join(" / ") || "没有可用架构"}；参数 ≥ ${esc(a.paramMin || 0)}B${a.minVer ? "；阶段 ≥ " + esc(a.minVer) : "；架构须先解锁"}。`;
});
return { ...t, lines: (t.lines || []).concat(rules) };
});
const extra = [
{ id: "t_funds_live", title: "经费与重训", lines: [
"<b>进入新阶段不再额外发放启动拨款</b>。经费来自评审结算、事件与其他明确标注的收入；工资、算力、语料、招聘和素体都需要预算。",
`当前 <b>${esc(s.ver)}</b> 完成版本任务后的主评审奖为 <b>${money(main)}</b>；优秀追加 <b>${money(c.EXCELLENT_FUNDING || 0)}</b>，顶尖在优秀基础上再追加 <b>${money(c.TOP_FUNDING || 0)}</b>。实际收入与扣款看结算明细。`,
`本阶段第 <b>${core.minWeeks(s.ver)} 周结束</b>后可发起评审。优秀要达到总评线并满足防偏科，顶尖还需达到优秀线的 <b>${esc(c.TOP_RATIO ?? 1.12)} 倍</b>；高评级不等于版本任务完成。`,
"任务未达会留在本阶段；这类重训的主评审经费只按<b>超过本版本已结算最高分的增量</b>计算，同分或更低没有增量。不为已经结算过的同一结果重复入账。",
"已完成任务的正常通过，包括末阶段再战，会重新按通过奖金结算；小模型等单列收入另算。<b>任务未达的同分重训没有主奖增量</b>，不等于所有单列收入都为零。",
"重训和进入新阶段会重新立项、从零训练当前模型，团队和已购资源会保留；<b>发薪倒计时和候选冷却持续计时</b>，不会因为重训而重新给一个月工资缓冲。品牌星级会为本次主评审经费提供溢价，具体看结算明细。",
"接受带分红条件的投资后，后续<b>每笔经营收益</b>按约定比例扣款并消耗笔数；注资、破产兜底款不参与，结算看实际净额。",
] },
{ id: "t_clock_live", title: "时钟与团队", lines: [
`标准速度的<b>基础节拍约 ${tick} 秒 / tick</b>，<b>${tpw} tick = 1 周</b>。实际耗时还受节拍波动、语料不足延时与优质语料缩时影响，并非严格 ${tick * tpw} 秒一周。V3 起可切换 <b>1× / 2×</b>经营速度；小游戏与鲸bee保持原速。`,
"<b>手动暂停</b>会停住经营计时；普通经营菜单不保证停止经营，阅读和安排前可先按暂停。有暂停锁的剧情或特定面板关闭后恢复原状态；必须选择的教学完成后才会放行。旅行等待使用真实时间，见下一页。",
"工资每 <b>4 周</b>支付一次，金额按实际在职成员月薪合计；跨阶段与重训保留发薪倒计时。扩编时也要为后续工资留余量，座位满了须先腾出位置。",
`V1 先录用首位工程师即可继续教学。数据工程师在 <b>${v.JOIN_DATA ?? 6} tick</b>后、后训练工程师在 <b>${v.JOIN_POST ?? 18} tick</b>后自动加入；要有空座，未到岗不产出。体力不足和安排休息会影响生产，安排休息后到下一周上班才恢复。`,
`团队页可谈心、聚餐、休息、培训和涨薪，各项费用、次数与效果以操作卡为准。培训每人每个绝对周一次，每次 <b>${money(TB.TRAIN_COST ?? 30000)}</b>、体力消耗 <b>${esc(TB.TRAIN_ENERGY_COST ?? 10)}</b>；涨薪会改变后续月薪。`,
] },
{ id: "t_body_journey_live", title: "具身、旅行与回忆", lines: [
"<b>具身阶段</b>除已有能力外，还要训练物理认知与灵巧操控，并招聘具身智能工程师。当前能力、参数、架构和任务条件以立项/评审面板为准。",
"「素体」每阶段展示对应型号、必需台数与价格。先满足本阶段采购要求才能立项；<b>同阶段升级只补已投资后的差价</b>，已购或更低规格不能重复购买，新阶段采购按该阶段独立计算。",
`觉醒不是只看总分：需两根具身能力轴分别达到本阶段觉醒门槛，并至少完成 <b>${Math.max(1, Math.min(52, Math.round(Number.isFinite(Number((c.EMBODIED || {}).AWAKEN_MIN_TRAINING_WEEKS ?? 2)) ? Number((c.EMBODIED || {}).AWAKEN_MIN_TRAINING_WEEKS ?? 2) : 2)))} 周</b>训练；觉醒与出舱流程完成后开放身体互动与旅行。`,
"鲸鱼房可投喂与换装。投喂有<b>每周次数与阶段好感收益上限</b>，体力恢复、上限提升和费用看零食卡；换装按好感及解锁条件开放。托管的免费恢复和付费操作各有条件，不等于所有照料免费。",
`「旅行鲸鱼」按配置站点顺序推进，每站还需满足阶段门槛。默认等待 <b>${esc((c.CITY_JOURNEY || {}).WAIT_MINUTES ?? 2)} 分钟真实时间</b>，站点可覆盖；办公室暂停、加速不改变它。成功回复后选项暂时隐藏，回答完成才显示下一轮；旅行进度与纪念节点随存档保存。`,
`完成 <b>${esc((c.LIFE_STORY || {}).unlockStage || (c.EMBODIED || {}).FINAL_STAGE || order[order.length - 1])}</b> 的版本任务并结算后可观看一生演出；真正完整观看后的回忆可在鲸鱼房重播。演出的暂停、跳转与阅读不会推进办公室训练。`,
] },
];
const secs = base.concat([this.guideTraitPage(), this.guideRecruitPage()], extra);
const gi = this._guideIdx = Math.max(0, Number.isInteger(this._guideIdx) ? this._guideIdx : 0) % Math.max(1, secs.length);
const active = secs[gi] || {};
const lineCount = (window.innerHeight || 844) <= 600 ? 2 : 3;
const lines = active.lines || [];
const linePages = Math.max(1, Math.ceil(lines.length / lineCount));
const linePage = this._guideLinePage = Math.max(0, Math.min(linePages - 1, Number.isInteger(this._guideLinePage) ? this._guideLinePage : 0));
const lineBody = Array.from({length:linePages}, (_, page) => `<section class="omg-line-part" data-guide-line-part="${page}"${page === linePage ? "" : " hidden"}>${lines.slice(page * lineCount, (page + 1) * lineCount).map(l => `<p>${this.reviewTutorialLine(l, active)}</p>`).join("")}</section>`).join("");
const linePager = linePages > 1 ? `<nav class="omg-line-pager" aria-label="当前主题内容分页"><button class="omg-tab" type="button" data-action="guide-line-page" data-guide-line-page="${linePage - 1}"${linePage === 0 ? " disabled" : ""}>上段</button><span aria-live="polite">本节 ${linePage + 1} / ${linePages}</span><button class="omg-tab" type="button" data-action="guide-line-page" data-guide-line-page="${linePage + 1}"${linePage >= linePages - 1 ? " disabled" : ""}>下段</button></nav>` : "";
const tabs = secs.map((t, i) => `<button class="omg-tab${i === gi ? " active" : ""}" data-action="guide-page" data-guide-page="${i}" type="button" aria-selected="${i === gi}">${this.tpl(t.title || "")}</button>`).join("");
return `<div class="guide-body paginated" data-guide-layout="readable">
      <style>
        .modal-card:has(.guide-body[data-guide-layout="readable"]){height:auto;max-height:calc(100% - 16px)}
        .modal-body:has(>.guide-body[data-guide-layout="readable"]){min-height:0}
        .guide-body[data-guide-layout="readable"]{flex:1;height:auto;min-height:0;gap:8px;overflow:visible}
        [data-guide-layout="readable"] .omg-goal{flex:none;padding:6px 9px;font-size:10.5px;line-height:1.5}
        [data-guide-layout="readable"] .omg-tabs{flex:none;flex-wrap:wrap;overflow:visible;max-width:100%;padding-bottom:4px}
        [data-guide-layout="readable"] .omg-tab{flex:none;white-space:nowrap}
        [data-guide-layout="readable"] .omg-page{flex:none;min-height:0;overflow:visible;padding-right:0}
        [data-guide-layout="readable"] .omg-page-title{flex:none}
        .omg-line-part{display:flex;flex-direction:column;gap:6px}
        .omg-line-part[hidden]{display:none!important}
        .omg-line-pager{display:flex;justify-content:space-between;align-items:center;gap:8px;color:var(--aqua-ink-2);font-size:11px}
        [data-guide-layout="readable"] .omg-counters{flex:none;display:flex;align-items:center;justify-content:space-between;gap:6px}
        [data-guide-layout="readable"] .omg-counters .omg-tab{padding:5px 10px}
        @media (orientation:landscape) and (max-height:520px){
          .modal-card:has(.guide-body[data-guide-layout="readable"]) .modal-header{padding:6px 12px}
          .modal-card:has(.guide-body[data-guide-layout="readable"]) .modal-footer{padding:5px 12px}
          .modal-card:has(.guide-body[data-guide-layout="readable"]) .modal-footer .skew-btn{padding:5px 12px;min-height:30px}
          .modal-body:has(>.guide-body[data-guide-layout="readable"]){padding:8px 12px}
          .guide-body[data-guide-layout="readable"]{gap:6px}
          [data-guide-layout="readable"] .omg-goal{padding:4px 7px}
        }
      </style>
      <div class="omg-goal">本阶段能力目标：${this.modelDims().map(d => esc(d.label) + " ≥ " + Math.ceil(this.modelPass(d.key))).join("、")}。${core.v35On() ? `优秀总评线 ${Math.ceil(pass.score)}；第 ${core.minWeeks(s.ver)} 周结束后可发起评审。` : `总评 ≥ ${Math.ceil(pass.score)}，各项能力达标后即可评审。`}</div>
      <div class="omg-tabs" aria-label="玩法说明主题">${tabs}</div>
      <div class="omg-page" data-guide-id="${esc(active.id || "")}" tabindex="0"><div class="omg-page-title">${this.icon("info", 14)} ${this.tpl(active.title || "")}</div><div class="omg-page-lines">${lineBody}${linePager}</div></div>
      <div class="omg-counters"><button class="omg-tab" type="button" data-action="guide-page" data-guide-page="${Math.max(0, gi - 1)}" ${gi === 0 ? "disabled" : ""}>上一页</button><span aria-live="polite">页 ${gi + 1} / ${secs.length}</span><button class="omg-tab" type="button" data-action="guide-page" data-guide-page="${Math.min(secs.length - 1, gi + 1)}" ${gi === secs.length - 1 ? "disabled" : ""}>下一页</button></div>
    </div>`;
},
guideRecruitPage() {
const c = this.core.cfg;
const cost = c.RECRUIT_COST || 0, ttl = c.CANDIDATE_TTL_WEEKS || 0, lock = c.CANDIDATE_LOCK_WEEKS || 0;
const money = n => n % 10000 === 0 ? n / 10000 + " 万元" : n.toLocaleString("zh-CN") + " 元";
const roles = window.V35Hire ? V35Hire.roles(this.core) : (c.V35 || {}).HIRE_ROLES || {};
const tpw = (c.V35 || {}).TICKS_PER_WEEK || 6;
const waits = Object.values(roles).map(r => { const w = r.waitMin || [1, 3], lo = Math.max(1, w[0]), hi = Math.max(3, lo, w[1]); return `${this.escHtml(r.label || "岗位")} ${Math.round(lo * 6 / tpw * 100) / 100}～${Math.round(hi * 6 / tpw * 100) / 100}`; }).join("；");
const rush = window.V35Hire && V35Hire.rushOptions(this.core);
const lines = [
"在「扩编」选择岗位发布需求；可多选，等待取所选岗位最慢范围。找不到合适人选时会继续寻访，当前剩余等待看扩编页。",
waits ? `初次寻访等待范围（<b>游戏周</b>）：${waits}。经营暂停会停住订单，加速与语料节拍也影响实际耗时，不是固定真实分钟。` : "当前没有开放的寻访岗位。",
"找到的人会进入<b>「招聘」页的候选列表</b>，再由你录用。人数受办公室座位上限约束，候选人不等于已入职。",
cost > 0 ? `发布费为<b>每个岗位 ${money(cost)}</b>；选 N 个岗位收 N 次费用，不是整张订单只收一次。` : "当前配置下发布需求不收费。",
ttl > 0 ? `普通与寻访候选都按<b>绝对周计时，等待 ${ttl} 周</b>后过期；跨阶段与重训不会把等待期清零。` : "当前候选人不会因等待时间自行离开。",
lock > 0 ? `过期人选通常冷却 <b>${lock} 周</b>；只有符合阶段、岗位与去重条件的抽选池耗尽时，才恢复这个合法池的冷却人选。在职、已有候选、未开放人选仍不会重抽。` : "当前未设置候选冷却；在职与已有候选仍会去重。",
"可抽词条等级按阶段和招聘规则变化，候选刷新不意味着清空整张工程师池或重置已录用的人。",
rush ? `加急每次 <b>${money(rush.cost)}</b>，缩短订单 <b>${rush.weeks} 周</b>等待；<b>不推进办公室时间</b>，也不额外制造生产或工资周期。` : "",
].filter(Boolean);
return { id: "t_recruit_live", title: "招聘与候选池", lines };
},
guideTraitPage() {
const c = this.core.cfg, core = this.core, min = core.traitUpgradeMinStat(), U = c.TRAIT_UPGRADE || {}, TB = c.TEAM_BUILD || {};
const types = Object.keys(U.traits || {}), esc = v => this.escHtml(String(v));
const pct = x => Math.round(x * 1000) / 10 + "%";
const rows = types.map(t => {
const ks = core.traitUpgradeStats(t), names = ks.map(k => esc(core.statName(k))).join(" + ");
const tip = ks.length > 1 ? `（<b>${ks.length} 项都要</b>达标，再取平均）` : "";
return `<b>${esc(this.traitName(t))}</b>：看 <b>${names}</b>${tip}；门槛处基础概率 Lv1→2 ${pct(core.traitUpgradeProb(t, 1, min))}、Lv2→3 ${pct(core.traitUpgradeProb(t, 2, min))}。`;
});
const stageCaps = Object.entries(c.STAGE_TRAIT_MAX || {}).map(([ver, cap]) => `${esc(ver)} Lv${esc(cap || 5)}`).join(" ／ ");
const caps = c.TALENT_LV_CAP || {};
const talentCaps = Object.entries({ gray: "一般", blue: "良好", pink: "优秀", orange: "天才", rainbow: "大牛" }).map(([k, label]) => `${label} Lv${esc(caps[k] ?? 5)}`).join(" ／ ");
const lines = [
"词条代表工程师的经验，等级影响基础产出区间；实际产出还受体力、休息、语料、论文与各项加成影响。",
"同一工程师的<b>多个不同生产词条同时生效、各自产出</b>，分别使用各自等级；具身词条仍须进入具身时代且模型激活对应轴，学术只辅助升级，同类重复只取最高一条。个人体力只结算一次，休假、未到岗或离职时全部产线停止。",
`升级在<b>每次真正发起评审时判定一次</b>，任务未达的评审也会判定；不是每周自动升级。对应各项潜力均须 ≥ <b>${min}</b>，通过门槛后按实际平均潜力计算概率。以下只是门槛处基础概率，不含个人学术与临时增益。`,
...rows,
`词条等级同时受<b>阶段上限</b>（${stageCaps || "未配置"}）与<b>天赋上限</b>（${talentCaps}）限制，取两者较低值。`,
"未配置成长规则的学术词条本身不会升级；它会给<b>同一人的其他可成长词条</b>增加升级概率，多条学术取最高等级，不叠加。个人和临时增益以实际工程师状态为准。",
"<b>灵感迸发</b>：基础三岗位平均体力达到 80，且本阶段仍有词条升级空间时，周结算有机会触发；全员消耗 15 体力，本次评审的词条升级概率乘 1.5，判定后消费，每轮阶段训练至多触发一次，重训后重新计。<b>短时产出爆发</b>另按岗位条件触发，只增加短时产出，不能把两种效果混为一谈。",
`培训每人每个绝对周一次，从该岗位实际潜力属性中选一项：${TB.TRAIN_PICK === "low" ? "按低值加权，全部达到参考值时等概率" : "等概率随机"}。普通岗位是算法/代码/文字潜力，具身岗位把文字换成工程潜力；单次最多增加 <b>${esc(TB.TRAIN_STAT_ADD ?? 5)}</b>，潜力上限 100，<b>培训不会立即升词条</b>。费用和体力代价见团队操作卡。`,
];
return { id: "t_trait", title: "工程师成长", lines };
},
settleEmbodiedReview() {
const core = this.core, s = core && core.state;
if (!s || s.phase !== "review" || !s.result || !core.embodiedAvailable || !core.embodiedAvailable(s)) return false;
this.stopEvalShowTimer();
this._evalShown = 0; this._evalWaitTut = false; this._evalSkin = "";
const result = s.result.settled ? s.result : core.finish();
if (!result || !result.settled) return false;
if (s.phase === "review") s.phase = s.bonus && s.bonus.items && s.bonus.items.length && Number(s.bonus.total) > 0 ? "bonus" : "over";
if (this.save && this.save.autoSave) this.save.autoSave(s);
return true;
},
renderEvalShow() {
if (this.core.state.phase === "review" && this.core.state.result && this.core.embodiedAvailable && this.core.embodiedAvailable(this.core.state)) {
this.settleEmbodiedReview(); return this.render();
}
if (window.AgentReview && AgentReview.allowed(this)) { AgentReview.render(this); return; }
const c = this.core.cfg, s = this.core.state;
const es = s.evalShow || { qs: [], score: 0, total: 0 };
const qs = es.qs || [];
const n = qs.length;
const rp = (c.EVAL_SHOW && c.EVAL_SHOW.ROLE_PORTS) || null;
const skin = es.skin || "bubble";
this._evalSkin = skin;
const isTerm = skin === "terminal", isReader = skin === "reader";
const head = isTerm ? ["code", "内部评审 · 代码评测"]
: isReader ? ["book", "内部评审 · 长文本评测"]
: ["shield", "内部评审 · 答题测评"];
const termTheme = isTerm && ((c.EVAL_SKIN || {}).code || {}).theme === "light" ? " theme-light" : "";
const headRole = (rp && (isTerm || isReader))
? `<img class="evalshow-role-sm" id="evRole" src="${rp.idle}" data-role="idle" alt="">` : "";
const cardRole = (rp && !isTerm && !isReader)
? `<img class="evalshow-role" id="evRole" src="${rp.idle}" data-role="idle" alt="">` : "";
this._evalShown = 0;
this._evalRevealedVis = false;
this._evalPaused = false;
this.el.innerHTML = `
      <div class="dg-stage evalshow-stage${isReader ? " has-reader" : ""}">
        <div class="evalshow-head">
          ${headRole}
          <div class="evalshow-title">${this.icon(head[0], 15)} ${head[1]}</div>
          <div class="evalshow-meta"><span class="em-score">得分 <b>0</b> / ${n}</span> · 答对 0 / ${n}</div>
        </div>
        <div class="evalshow-card skin-${skin}${termTheme}" id="evCard">
        ${cardRole}
        <div class="${isTerm ? "term-cmd" : isReader ? "reader-src" : "evalshow-bub evalshow-bub-q"}" id="evQ"></div>
        <div class="evalshow-fb" id="evFB"></div>
        </div>
        <div class="evalshow-foot">
          <button class="dg-btn dg-btn-ghost" data-action="eval-pause" id="evPauseBtn">⏸ 暂停阅读</button>
          <button class="dg-btn dg-btn-primary" data-action="evalshow-done">${(c.EVAL_SHOW && c.EVAL_SHOW.SKIPPABLE) === false ? "" : "跳过 · 直出结果"}</button>
        </div>
      </div>`;
if (n) this.fillEvalQ(0);
this.startEvalShowTimer();
},
escHtml(v) {
return String(v == null ? "" : v)
.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
},
fillEvalQ(i) {
const s = this.core.state;
const qs = (s.evalShow && s.evalShow.qs) || [];
const q = qs[i];
const n = qs.length;
const c = this.core.cfg;
const rp = (c.EVAL_SHOW && c.EVAL_SHOW.ROLE_PORTS) || null;
const card = this.el.querySelector("#evCard");
if (card) { card.classList.remove("ok", "fail"); }
const skin = this._evalSkin || "bubble";
const qEl = this.el.querySelector("#evQ");
const fb = this.el.querySelector("#evFB");
if (qEl && q) {
qEl.innerHTML = skin === "terminal"
? `<div class="tc-prompt">${this.escHtml(this.tpl(q.q || ""))}</div>`
: skin === "reader"
? `<div class="rb-bar"><span class="rb-label">上下文</span>`
+ `<span class="rb-track"><i style="width:${this.readerTokenPct(q)}%"></i></span>`
+ `<b class="rb-num">${Math.round((q.material || "").length)} 字</b></div>`
+ `<div class="reader-material">${this.escHtml(q.material || "（材料缺失）")}</div>`
+ `<div class="reader-ask">${this.escHtml(q.q || "")}</div>`
: `<div class="evalshow-num">题目 ${i + 1} / ${n}</div><div>${this.tpl(q.q || "")}</div>`;
if (skin === "bubble") this.fitEvalQ(qEl);
}
if (fb) {
fb.innerHTML = skin === "terminal"
? `<div class="term-screen"><div class="term-code" id="evCode"></div>`
+ `<div class="term-panel" id="evPanel"><div class="tp-row tp-dim">等待输出…</div></div></div>`
: skin === "reader"
? `<div class="reader-out" id="evOut"><span class="ro-wait">阅读中…</span></div>`
+ `<div class="reader-metrics" id="evMetrics"></div>`
: `<div class="evalshow-bub evalshow-bub-a">…</div>`;
}
const role = this.el.querySelector("#evRole");
if (role && rp && rp.idle) { role.src = rp.idle; role.dataset.role = "idle"; }
},
readerTokenPct(q) {
const len = (q && q.material ? q.material.length : 0) || 0;
return Math.max(8, Math.min(100, Math.round(len / 2400 * 100)));
},
fitEvalQ(qEl) {
if (!qEl) return;
qEl.classList.remove("fit-1", "fit-2");
let guard = 0;
while (qEl.scrollHeight > qEl.clientHeight + 1 && guard < 2) {
qEl.classList.add(guard === 0 ? "fit-1" : "fit-2");
guard += 1;
}
},
startReaderType(i) {
this.stopReaderType();
const s = this.core.state;
const q = ((s.evalShow || {}).qs || [])[i];
const out = this.el && this.el.querySelector("#evOut");
if (!q || !out) return;
const skinCfg = (this.core.cfg.EVAL_SKIN || {}).long || {};
const chunk = skinCfg.chunkSize || 8;
const ms = skinCfg.outChunkMs || 30;
const text = String(q.ok ? q.good : q.bad).slice(0, 260);
out.textContent = "";
let pos = 0;
this._readerTimer = setInterval(() => {
pos += chunk;
out.textContent = text.slice(0, pos);
if (pos >= text.length) this.stopReaderType();
}, ms);
},
stopReaderType() {
if (this._readerTimer) { clearInterval(this._readerTimer); this._readerTimer = null; }
},
revealEvalQ(i) {
const s = this.core.state;
const qs = (s.evalShow && s.evalShow.qs) || [];
const q = qs[i];
if (!q) return;
const c = this.core.cfg;
const rp = (c.EVAL_SHOW && c.EVAL_SHOW.ROLE_PORTS) || null;
const card = this.el.querySelector("#evCard");
if (card) card.classList.add(q.ok ? "ok" : "fail");
const skin = this._evalSkin || "bubble";
const fb = this.el.querySelector("#evFB");
const hits = qs.slice(0, i + 1).filter((x) => x.ok).length;
const rate = Math.round(hits / (i + 1) * 100);
if (skin === "terminal") {
const skinCfg = (c.EVAL_SKIN || {}).code || {};
const lineMs = skinCfg.lineMs || 90;
const src = String(q.ok ? q.good : q.bad).split("\n");
const cases = q.cases || 10;
const passed = q.ok ? cases : Math.max(1, Math.round(cases * 0.75));
if (fb) {
fb.innerHTML = `
          <div class="term-screen">
            <div class="term-code">${src.map((ln, k) =>
`<div class="tc-line" style="animation-delay:${k * lineMs}ms">`
+ `<span class="tc-no">${k + 1}</span><span class="tc-txt">${this.escHtml(ln) || "&nbsp;"}</span></div>`).join("")}</div>
            <div class="term-panel">
              <div class="tp-row"><span class="tp-k">编译</span><span class="tp-ok">OK</span></div>
              <div class="tp-row"><span class="tp-k">测试用例</span>
                <span class="tp-bar"><i style="width:${Math.round(passed / cases * 100)}%"></i></span>
                <b class="tp-num">${passed} / ${cases}</b></div>
              ${q.ok ? "" : `<div class="tp-bug">⚠ ${this.escHtml(q.tag || "逻辑错误")}：${this.escHtml(q.bug || "输出与预期不符")}</div>`}
              <div class="tp-verdict ${q.ok ? "ok" : "fail"}">
                ${q.ok ? "✓ AC · 本次通过" : "✗ WA · 存在缺陷"}
                <span class="tp-rate">一次性通过率 ${rate}%</span></div>
            </div>
          </div>`;
}
} else if (skin === "reader") {
this.startReaderType(i);
const m = this.el.querySelector("#evMetrics");
if (m) {
const hitPct = q.ok ? 100 : (/遗忘/.test(q.tag || "") ? 33 : 40);
const cover = q.ok ? "3 / 3" : "1 / 3";
m.innerHTML = `
          <span class="rm-item"><span class="rm-k">记忆命中</span><b class="${q.ok ? "ok" : "fail"}">${hitPct}%</b></span>
          <span class="rm-item"><span class="rm-k">要点覆盖</span><b>${cover}</b></span>
          <span class="rm-item"><span class="rm-k">处理字数</span><b>${Math.round((q.material || "").length)}</b></span>`;
}
const out = this.el.querySelector("#evOut");
if (out) out.classList.toggle("fail", !q.ok);
} else if (fb) {
fb.innerHTML = `
      <div class="evalshow-fb-badge ${q.ok ? "ok" : "fail"}">${q.ok ? "✓" : "✗"}</div>
      <div class="evalshow-bub evalshow-bub-a">${this.tpl(q.ok ? q.good : q.bad)}</div>`;
}
const role = this.el.querySelector("#evRole");
if (role && rp) { const src = q.ok ? rp.ok : rp.fail; if (src) { role.src = src; role.dataset.role = q.ok ? "ok" : "fail"; } }
if (window.SFX) SFX.play(q.ok ? "confirm" : "click");
const meta = this.el.querySelector(".evalshow-meta");
if (meta) meta.innerHTML = `<span class="em-score">得分 <b>${hits}</b> / ${qs.length}</span> · 答对 ${hits} / ${qs.length}`;
},
startEvalShowTimer() {
this.stopEvalShowTimer();
if (this._evalSkin === "fitness" && window.EmbodiedFitnessReview) { EmbodiedFitnessReview.start(this); return; }
if (this._evalSkin === "embodied" && window.EmbodiedPresentation) { EmbodiedPresentation.start(this); return; }
if (this._evalSkin === "agents" && window.AgentReview) { AgentReview.start(this); return; }
if (this._evalWaitTut) return;
const s = this.core.state;
const qs = (s.evalShow && s.evalShow.qs) || [];
const n = qs.length;
if (!n || (this._evalShown || 0) >= n) return;
const per = (this.core.cfg.EVAL_SHOW || {}).MS_PER_Q || 3000;
const self = this;
this._evalTimer = setInterval(() => {
if (!self.el.querySelector("#evCard")) { self.stopEvalShowTimer(); return; }
if (self._evalPaused) return;
if (!self._evalRevealedVis) {
self._evalRevealedVis = true;
self.revealEvalQ(self._evalShown);
} else {
self._evalShown += 1;
if (self._evalShown >= n) {
self.stopEvalShowTimer();
const btn = self.el.querySelector('[data-action="evalshow-done"]');
if (btn) { btn.textContent = "查看评审结果 ➜"; btn.disabled = false; }
return;
}
self._evalRevealedVis = false;
self.fillEvalQ(self._evalShown);
}
}, per);
},
stopEvalShowTimer() {
if (window.EmbodiedFitnessReview) EmbodiedFitnessReview.stop(this);
if (window.EmbodiedPresentation) EmbodiedPresentation.stop(this);
if (window.AgentReview) AgentReview.stop(this);
if (this._evalTimer) { clearInterval(this._evalTimer); this._evalTimer = null; }
this.stopReaderType();
},
REWARD_ACTS: [
{ n: 1, label: "模型数值", icon: "barchart" },
{ n: 2, label: "排行与反馈", icon: "trophy" },
{ n: 3, label: "总奖金", icon: "coins" },
{ n: 4, label: "成就", icon: "medal" },
],
ACHV_RARITY: {
"普通": { cls: "rarity-common", rings: 2, dust: 10, icon: "achvCommon" },
"稀有": { cls: "rarity-rare", rings: 2, dust: 12, icon: "achvRare" },
"史诗": { cls: "rarity-epic", rings: 3, dust: 15, icon: "achvEpic" },
"传说": { cls: "rarity-legend", rings: 3, dust: 18, icon: "achvLegend" },
"__locked": { cls: "rarity-locked", rings: 0, dust: 6, icon: "achvLocked" },
},
ACHV_REVEAL: { IN: 480, HOLD: 1400, OUT: 240, HOLD_MANY: 900, MANY_AT: 3, DUST_MAX: 18 },
ACHV_PER_PAGE: 4,
ACHV_PER_PAGE_PORTRAIT: 1,
achvPerPage() {
const portrait = typeof window !== "undefined" && window.matchMedia
&& window.matchMedia("(orientation: portrait)").matches;
if(!portrait&&window.innerHeight<500)return 1;
return portrait ? this.ACHV_PER_PAGE_PORTRAIT : this.ACHV_PER_PAGE;
},
achvRarity(r) { return this.ACHV_RARITY[r] || this.ACHV_RARITY["普通"]; },
achvTimeText(t) {
const ms = Number(t);
if (!isFinite(ms) || ms <= 0) return "";
const d = new Date(ms);
const p = (n) => String(n).padStart(2, "0");
return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
+ " " + p(d.getHours()) + ":" + p(d.getMinutes());
},
ACHV_ICON_ART: {
achvCommon:
'<circle cx="24" cy="24" r="14.5" fill="none" stroke="currentColor" stroke-width="3.6"/>'
+ '<circle cx="24" cy="24" r="7.6" fill="currentColor"/>'
+ '<circle cx="24" cy="24" r="3.1" fill="#fff" opacity=".88"/>'
+ '<path d="M24 3.6v4.6M24 39.8v4.6M3.6 24h4.6M39.8 24h4.6" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
achvRare:
'<path d="M24 3.8 44.2 24 24 44.2 3.8 24Z" fill="currentColor"/>'
+ '<path d="M24 3.8 44.2 24 24 24Z" fill="#fff" opacity=".26"/>'
+ '<path d="M24 10.6 37.4 24 24 37.4 10.6 24Z" fill="#fff" opacity=".55"/>'
+ '<path d="M24 17.2 30.8 24 24 30.8 17.2 24Z" fill="currentColor"/>'
+ '<circle cx="24" cy="24" r="2.5" fill="#fff"/>',
achvEpic:
'<path d="M24 2.6 30.7 17.3 45.4 24 30.7 30.7 24 45.4 17.3 30.7 2.6 24 17.3 17.3Z" fill="currentColor"/>'
+ '<path d="M24 12.2 28.1 19.9 35.8 24 28.1 28.1 24 35.8 19.9 28.1 12.2 24 19.9 19.9Z" fill="#fff" opacity=".58"/>'
+ '<circle cx="24" cy="24" r="3.6" fill="#fff"/>'
+ '<circle cx="24" cy="24" r="1.7" fill="currentColor"/>'
+ '<path d="M24 0.8v3.4M24 43.8v3.4M0.8 24h3.4M43.8 24h3.4" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
achvLegend:
'<path d="M5.4 15.6 14.8 24.4 24 8.2l9.2 16.2 9.4-8.8-3.7 21.2H9.1Z" fill="currentColor"/>'
+ '<rect x="9.1" y="34.4" width="29.8" height="6" rx="2.4" fill="currentColor"/>'
+ '<circle cx="24" cy="21.6" r="4" fill="#fff" opacity=".92"/>'
+ '<circle cx="13.6" cy="28.4" r="2.1" fill="#fff" opacity=".72"/>'
+ '<circle cx="34.4" cy="28.4" r="2.1" fill="#fff" opacity=".72"/>'
+ '<path d="M24 1.8v5M7.2 5.4l3.6 4.2M40.8 5.4l-3.6 4.2" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
achvLocked:
'<rect x="9.4" y="19.6" width="29.2" height="23.2" rx="5.2" fill="currentColor"/>'
+ '<path d="M16.2 19.6v-5.4a7.8 7.8 0 0 1 15.6 0v5.4" fill="none" stroke="currentColor" stroke-width="3.8"/>'
+ '<circle cx="24" cy="29.2" r="3.4" fill="#fff" opacity=".92"/>'
+ '<path d="M24 32.4v4.8" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".92"/>'
+ '<circle cx="14.4" cy="23.6" r="1.5" fill="#fff" opacity=".55"/>'
+ '<circle cx="33.6" cy="23.6" r="1.5" fill="#fff" opacity=".55"/>',
},
achvIcon(name, size) {
const art = this.ACHV_ICON_ART[name];
if (!art) return this.icon(name, size);
const s = size || 44;
return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" aria-hidden="true">${art}</svg>`;
},
ACHV_ORDER: { "普通": 0, "稀有": 1, "史诗": 2, "传说": 3 },
ROLE_NAME: {
pretrain: "算法工程师", post: "后训练工程师", academic: "研究员",
engineer: "系统工程师", data: "数据工程师", safety: "安全工程师",
},
bonusCountUp(el, target, dur, opts) {
opts = opts || {};
if (!el) { if (opts.done) opts.done(); return; }
const dec = opts.decimals || 0;
const fmtV = (v) => (dec ? v.toFixed(dec) : Math.round(v).toLocaleString());
const t0 = performance.now();
const iv = setInterval(() => {
const k = Math.min(1, (performance.now() - t0) / dur);
const eased = 1 - Math.pow(1 - k, 3);
el.textContent = fmtV(target * eased);
if (k >= 1) {
clearInterval(iv);
el.textContent = fmtV(target);
if (opts.done) opts.done();
}
}, 40);
this._bonusTimers.push(iv);
},
bonusLater(fn, ms) { this._bonusTimeouts.push(setTimeout(fn, ms)); },
clearBonusTimers() {
(this._bonusTimers || []).forEach((t) => clearInterval(t));
(this._bonusTimeouts || []).forEach((t) => clearTimeout(t));
this._bonusTimers = [];
this._bonusTimeouts = [];
},
brandBenefitHTML(benefit) {
if (!benefit || !(benefit.base > 0)) return "";
const stars = Math.max(0, Math.min(5, Math.floor(benefit.stars || 0)));
const money = (n) => "¥" + Math.round(Number(n) || 0).toLocaleString();
return `<div class="brand-benefit" aria-label="品牌带来的额外收益">
      <div class="brand-benefit-head"><span>${this.icon("star", 14)} 品牌正在创造价值</span><span class="brand-benefit-stars">${"★".repeat(stars) + "☆".repeat(5 - stars)}</span></div>
      <div class="brand-benefit-value"><span>额外净入账</span><b>+${money(benefit.net)}</b></div>
      <div class="brand-benefit-note">结算前 ${stars} 星品牌 · 主奖金 ${money(benefit.base)} × ${Math.round((benefit.rate || 0) * 100)}%${benefit.dividend > 0 ? " · 已扣分红 " + money(benefit.dividend) : ""}</div>
    </div>`;
},
renderBonus() {
const s = this.core.state, c = this.core.cfg;
const b = s.bonus || { items: [], total: 0 };
const r = s.result || {};
const exc = this.core.isExcLike(r);
const failureUI=((c.EMBODIED||{}).REVIEW_FAILURE||{}).UI||{};
const failed=!!r.qualificationFailed;
const tierLbl = (() => {
if(failed)return failureUI.TITLE;
const v = r.verdict;
if (v === "top") return "S · 顶尖";
if (v === "excellent") return "A · 优秀";
if (v === "pass") return "B · 合格";
if (v === "veto" || v === "fail") return "D · 不及格";
return "—";
})();
const tierBadge = (() => {
if(failed)return failureUI.BADGE;
const v = r.verdict;
if (v === "top") return "评审顶尖！问鼎阶段之巅";
if (v === "excellent") return "评审优秀！远超阶段目标";
return "评审通过！本阶段交付合格";
})();
const first = r.rankPrev == null;
const verIdx = (c.VER_ORDER || ["V1"]).indexOf(s.ver || "V1");
const beta = this.core.isBeta(s.ver);
const thinking = verIdx >= 4;
this.clearBonusTimers();
this._bonusPlayed = {};
const hist = (s.modelHistory || []).filter((h) => h && h.ver !== s.ver).slice(-3);
const embodiedChart = !!(this.core.embodiedAvailable && this.core.embodiedAvailable(s));
const dims = embodiedChart ? this.modelDims(s).map(d => Object.assign({}, d, {
icon: d.key === "codeText" ? "code" : d.key === "safetyStability" ? "shield" : "",
iconHTML: d.key === "codeText" || d.key === "safetyStability" ? "" : this.axisIcon(d.key, 13),
})) : [
{ key: "code", label: "代码", icon: "code" },
{ key: "text", label: "文字", icon: "type" },
{ key: "safety", label: "安全", icon: "shield" },
{ key: "stability", label: "稳定", icon: "activity" },
];
const chartValue = (key, record) => Math.round(embodiedChart ? this.modelValue(key, record) : Number(record[key]) || 0);
const stats = dims.map((d) => {
const now = chartValue(d.key, s);
const prevLast = hist.length ? chartValue(d.key, hist[hist.length - 1]) : null;
return Object.assign({}, d, {
now,
history: hist.map((h) => chartValue(d.key, h)),
up: prevLast != null && now > prevLast,
});
});
const upCount = stats.filter((x) => x.up).length;
const board = (c.RANK_BOARD_BY_VER || {})[s.ver || "V1"] || [];
const meRank = s.rank || (board.length ? board.length + 1 : 11);
const rankUpTxt = first ? "新入榜" : `上升 ${r.rankUp || 0} 位`;
const meMeta = (first && meRank > 10)
? `当前排名第 ${meRank} 位 · 排名还很落后，继续加油`
: (thinking ? "推理模型" : "语言模型");
const meScore = Math.round((r.score != null ? r.score : (r.rankScore || 0)) * 10) / 10;
const meHeat = { rank: meRank, score: meScore };
const rowsHtml = [];
let inserted = false;
board.forEach((row, i) => {
if (meRank === i + 1) { inserted = true; rowsHtml.push(this.bonusMeRow(s, meRank, rankUpTxt, meMeta, meHeat, i)); }
rowsHtml.push(this.bonusRankRow(row, i + 1, i + (inserted ? 1 : 0)));
});
if (!inserted) {
rowsHtml.push(`<div class="rank-ellipsis" style="transition-delay:${(0.05 + board.length * 0.06).toFixed(2)}s">···</div>`);
rowsHtml.push(this.bonusMeRow(s, meRank, rankUpTxt, meMeta, meHeat, board.length + 1));
}
const feeds = this.bonusFeedCards(stats, beta, exc);
const usersAll = s.users || 0;
const usersShow = beta ? usersAll : Math.round(usersAll / 10000);
const userUnit = beta ? " 人" : " 万";
const gained = r.usersGained || 0;
const trendPct = (first || usersAll <= gained) ? null : Math.round((gained / (usersAll - gained)) * 100);
const trendTxt = trendPct == null ? "首批用户已入驻" : `+${Math.min(trendPct, 999)}% 较上阶段`;
const brandChip = b.brandAdd
? `<span class="break-chip">品牌值 <b>${b.brandAdd > 0 ? "+" : ""}${b.brandAdd} → ${r.brandNow != null ? r.brandNow : Math.round(s.brand || 0)}</b></span>` : "";
const chipName = (label) => failed ? failureUI.CHIP : /品牌/.test(label) ? "品牌额外奖励" : /优秀/.test(label) ? "数值提升" : /小模型/.test(label) ? label : "基础交付";
const chips = (b.items.map((it) =>
`<span class="break-chip">${chipName(it.label)} <b>${it.value % 10000 === 0 ? Math.round(it.value / 10000) + " 万" : Math.round(it.value).toLocaleString("zh-CN") + " 元"}</b></span>`).join("")
+ brandChip)
|| `<span class="break-chip">本轮无额外奖金</span>`;
const ups = (s.traitUpgrades || []).filter((u) => u && typeof u === "object" && u.name);
const barsHtml = stats.map((st0) => {
const history = st0.history.slice(-3);
const prevLast = history.length ? history[history.length - 1] : null;
const delta = prevLast != null ? st0.now - prevLast : 0;
let mini = `<i class="mini-bar cur" data-h="${st0.now}" data-order="3" title="本阶段：${st0.now}">` +
`<span class="bar-value">0</span>` +
(st0.up ? `<span class="delta-chip">${this.icon("arrow-up", 10)}+${delta}</span>` : "") + `</i>`;
history.slice().reverse().forEach((h, ri) => {
const cls = ri === 0 ? " p3" : ri === 1 ? " p2" : "";
mini += `<i class="mini-bar${cls}" data-h="${h}" data-order="${2 - ri}" title="历史阶段：${h}"></i>`;
});
return `<div class="bar-col${st0.up ? " up" : ""}">
          <div class="bar-track">${mini}</div>
          <!-- [feature:v5-chart-labels] -->
          <span class="bar-label">${st0.iconHTML || this.icon(st0.icon, 13)}${this.escHtml(st0.label)}</span>
          <!-- [/feature:v5-chart-labels] -->
        </div>`;
}).join("");
const axIds = this.core.v35AxisIds(s);
const axRows = axIds.map((id, i) => {
const d = this.core.axisDef(id, s.ver) || {};
const v = Math.round(s[id] || 0);
const line = d.passAt != null ? d.passAt : 0;
const ok = line > 0 ? v >= line : v > 0;
return `<div class="side-row ax"><span class="k">${this.axisIcon(id, 14)}${d.name || id}${line ? `<i class="ax-line">达标 ${line}</i>` : ""}</span><span class="v ${ok ? "up" : ""}">${v}${line ? " / " + line : ""}</span></div>`;
}).join("");
const meta = `${s.modelName || "小鲸鱼"} · ${s.ver} · ${s.paramTarget || 0}B`;
const newAchv = this.bonusAchievements();
const hasAchv = newAchv.length > 0;
const acts = this.REWARD_ACTS.filter((a) => a.n < 4 || hasAchv);
this._bonusAchvList = newAchv;
const steps = acts.map((a) =>
`<span class="step-pill" data-step="${a.n}">${this.icon(a.icon, 12)}${a.label}</span>`).join("");
const bonusAct = r.nextVer ? "next-stage"
: ((r.retry || r.finalRepeat) ? "retry-stage" : "bonus-final");
const bonusTxt = r.nextVer ? `进入 ${r.nextVer} 阶段 ➜`
: (r.retry ? `重训 ${s.ver} 阶段 ➜`
: (r.finalRepeat ? `再战 ${s.ver} 阶段 ➜` : "查看最终成果 ➜"));
const nextBtn = `<button class="dg-btn dg-btn-primary bonus-next" type="button" data-action="${bonusAct}" disabled>
        ${bonusTxt}
      </button>`;
const achvNextBtn = `<button class="dg-btn dg-btn-primary next-btn" type="button" data-action="bonus-next" data-step="4"><span>查看成就 ➜</span>${this.icon("medal", 15)}</button>`;
const achvActHtml = !hasAchv ? "" : `
              <section class="act" id="act-4" aria-label="第四幕 成就">
                <div class="act-head">
                  <span class="pass-badge gold">${this.icon("medal", 15)}成就解锁</span>
                  <h1 class="act-title">本次新解锁成就</h1>
                  <p class="act-sub">共 ${newAchv.length} 个，按稀有度依次揭晓。</p>
                </div>
                <div class="achv-reveal" id="achvReveal">
                  <div class="achv-slot" id="achvRevealSlot"></div>
                  <div class="achv-reveal-foot">
                    <span class="achv-count" id="achvCount"></span>
                    <button class="achv-skip" type="button" data-action="achv-skip">跳过全部 ➜</button>
                  </div>
                </div>
                <div class="achv-grid" id="achvGrid" hidden></div>
                <div class="achv-pager" id="achvPager" hidden></div>
                <div class="act-foot">
                  <button class="dg-btn" type="button" data-action="bonus-replay">${this.icon("replay", 14)} 再看一遍</button>
                  ${nextBtn}
                </div>
              </section>`;
const PER = 3;
if (this._upgPage == null) this._upgPage = 0;
const upgTotal = 1;
this._upgPage = Math.min(Math.max(0, this._upgPage), upgTotal - 1);
const upgPage = this._upgPage;
const upgSlice = ups;
const upgradeItem = (u, i) => {
const eng = (s.engineers || []).find((e) => e.id === u.id);
const av = eng ? this.engAvatar(eng) : "";
return `<div class="upgrade-item" style="transition-delay:${(0.15 + i * 0.15).toFixed(2)}s">
          <span class="up-avatar role-${u.type || "pretrain"}">${av ? `<img src="${av}" alt="">` : (u.name || "?").charAt(0)}</span>
          <span class="up-info">
            <span class="up-name">${u.name} · ${this.ROLE_NAME[u.type] || "工程师"}</span>
            <span class="up-trait">${this.icon("star", 11)}${u.trait}</span>
          </span>
          <span class="lv-flow">
            <span class="lv-badge old">Lv.${u.from}</span>
            <span class="lv-arrow">${this.icon("arrow-right", 14)}</span>
            <span class="lv-badge new">Lv.${u.to}</span>
          </span>
        </div>`;
};
const upgradePanel = !ups.length ? "" : `
              <div class="upgrade-panel glass-card" id="upgradePanel">
                <h2 class="panel-title">${this.icon("medal", 15)}工程师成长 · 词条升级</h2>
                <div class="upgrade-list vertical" id="upgradeList">
                  ${upgSlice.map((u, i) => upgradeItem(u, i)).join("")}
                </div>
                ${upgTotal > 1 ? `<div class="upgrade-pager">
                  <button class="upg-btn" type="button" data-action="upg-page" data-id="-1"${upgPage <= 0 ? " disabled" : ""}>${this.icon("chevL", 13)} 上一页</button>
                  <span class="upg-pageno">${upgPage + 1} / ${upgTotal}</span>
                  <button class="upg-btn" type="button" data-action="upg-page" data-id="1"${upgPage >= upgTotal - 1 ? " disabled" : ""}>下一页 ${this.icon("chevR", 13)}</button>
                </div>` : ""}
              </div>`;
this.el.innerHTML = `
      <div class="aqua-shell reward-page">
        <section class="aqua-stage" aria-label="奖励结算演出舞台">
          <div class="reward-shell">
            <header class="island-topbar" aria-label="顶部进度">
              <span class="island-title"><span class="dot"></span>${failed ? failureUI.BADGE : "评审通过 · 奖励结算"}</span>
              <div class="stage-steps" aria-label="结算进度">${steps}</div>
              <button class="stage-close" type="button" data-action="bonus-jump" aria-label="跳到结算">${this.icon("x", 16)}</button>
            </header>
            <div class="stage-body">

              <!-- 第一幕：本阶段模型数值（分组柱状图） -->
              <section class="act" id="act-1" aria-label="第一幕 模型数值">
                <div class="act-head">
                  <span class="pass-badge">${this.icon("badge-check", 15)}${tierBadge}</span>
                  <h1 class="act-title">本阶段模型表现</h1>
                  <p class="act-meta">${meta}</p>
                  <p class="act-sub">每项数值并列对比前 ${Math.max(1, hist.length)} 个阶段，较上一阶段提升的项目会点亮金色。</p>
                </div>
                <div class="chart-card glass-card">
                  <div class="chart-main">
                    <div class="chart-legend" aria-label="阶段图例（从新到旧）">
                      <span class="lg-item"><i class="lg-dot cur"></i>本阶段</span>
                      <span class="lg-item"><i class="lg-dot p3"></i>上一阶段</span>
                      <span class="lg-item"><i class="lg-dot p2"></i>前 2 阶段</span>
                      <span class="lg-item"><i class="lg-dot"></i>前 3 阶段</span>
                    </div>
                    <div class="bars" id="bars">${barsHtml}</div>
                  </div>
                  <aside class="chart-side">
                    <div class="side-row"><span class="k">${this.icon("git-compare", 14)}对比范围</span><span class="v">${hist.length ? "本阶段 vs 前 " + hist.length + " 阶段" : "首代模型 · 暂无历史对比"}</span></div>
                    <div class="side-row"><span class="k">${this.icon("trending-up", 14)}提升项目</span><span class="v up" id="upCount">0 项</span></div>
                    <div class="side-row"><span class="k">${this.icon("gauge", 14)}综合评分</span><span class="v" id="totalScore">0</span></div>
                    <div class="side-row"><span class="k">${this.icon("sparkles", 14)}评级</span><span class="v up">${tierLbl}</span></div>
                    ${axRows}
                  </aside>
                </div>
                <div class="act-foot">
                  <button class="dg-btn dg-btn-primary next-btn" type="button" data-action="bonus-next" data-step="2"><span>查看外网反响 ➜</span></button>
                  <span class="hint-tip">${this.icon("pointer", 12)}点击下一步，查看能力榜与用户反馈</span>
                </div>
              </section>

              <!-- 第二幕：全球模型能力榜 + 用户反馈 -->
              <section class="act" id="act-2" aria-label="第二幕 排行与反馈">
                <div class="act-head">
                  <h1 class="act-title">全球模型能力榜</h1>
                  <p class="act-sub">${beta
? (first ? `「深海内测」进行中 · 首次上榜，当前排名第 ${meRank} 位，继续加油` : "「深海内测」进行中 · 榜上排名稳步上升")
: "模型正式上线后收获大量用户，排名快速攀升。"}</p>
                </div>
                <div class="act2-grid">
                  <div class="panel glass-card">
                    <h2 class="panel-title">${this.icon("trophy", 16)}全球模型能力榜</h2>
                    <div class="rank-list" id="rankList">${rowsHtml.join("")}</div>
                  </div>
                  <div class="panel glass-card">
                    <h2 class="panel-title">${this.icon("msg", 16)}${beta ? "「深海内测」· 用户反馈" : "外网用户反馈"}</h2>
                    ${beta ? `<span class="rank-tip">${this.icon("lock", 12)}保密测试中 · 模型未公开发布</span>` : ""}
                    <div class="user-stat">
                      <div class="stat-box">
                        <div class="num"><span id="userCount">0</span><small>${userUnit}</small></div>
                        <div class="lbl">${beta ? "内测用户" : "累计用户"}</div>
                        <div class="trend">${this.icon("trending-up", 11)} ${trendTxt}</div>
                      </div>
                      <div class="stat-box">
                        <div class="num"><span id="ratingVal">0</span><small> 分</small></div>
                        <div class="lbl">用户平均评分</div>
                        <div class="trend">${this.icon("star", 11)} 好评率 ${r.praiseRate || 90}%</div>
                      </div>
                    </div>
                    <div class="feed-list" id="feedList">${feeds}</div>
                  </div>
                </div>
                <div class="act-foot">
                  <button class="dg-btn dg-btn-primary next-btn" type="button" data-action="bonus-next" data-step="3"><span>结算</span>${this.icon("coins", 15)}</button>
                </div>
              </section>

              <!-- 第三幕：总奖金揭晓 + 工程师成长 -->
              <section class="act" id="act-3" aria-label="第三幕 总奖金">
                <div class="act-head">
                  <span class="pass-badge gold">${this.icon("crown", 15)}${failed ? failureUI.BADGE : exc ? "阶段大成功" : "评审通过"}</span>
                  <h1 class="act-title">本次结算总奖金</h1>
                  <p class="act-meta">${meta}</p>
                  <p class="act-sub">${failed ? this.escHtml(failureUI.DESCRIPTION) : "综合模型表现、排名上升与用户增长，奖励已到账。"}</p>
                </div>
                <div class="act3-grid${ups.length ? "" : " bonus-only"}">
                  <div class="bonus-card glass-card" id="bonusCard">
                    <span class="bonus-label">${this.icon("wallet", 14)}${failed ? failureUI.BONUS_LABEL : "研发奖金已发放"}</span>
                    <div class="bonus-amount"><span class="cur">¥</span><span id="bonusNum">0</span><span class="cur"> 万</span></div>
                    <div class="bonus-break">${chips}</div>
                    ${failed ? "" : this.brandBenefitHTML(b.brandBenefit || r.brandBenefit)}
                    <div class="bonus-fund">账上经费 <b>${fmtMoney(s.funding || 0)}</b></div>
                  </div>
                  ${upgradePanel}
                </div>
                <div class="act-foot">
                  <button class="dg-btn" type="button" data-action="bonus-replay">${this.icon("replay", 14)} 再看一遍</button>
                  ${this.rankEntryBtn()}
                  ${hasAchv ? achvNextBtn : nextBtn}
                </div>
              </section>
              ${achvActHtml}

            </div>
          </div>
        </section>
      </div>`;
const funds = this.el.querySelector('.bonus-fund');
if (funds) funds.outerHTML = this.settlementFundsHTML(r);
this.mountRewardPages();
console.log("[奖励演出] 渲染完成，从第", s.bonusAct || 1, "幕开始（共", acts.length, "幕）");
this._bonusView = { state: s, bonus: s.bonus, result: s.result, root: this.el.querySelector(".aqua-stage"), last: acts.length };
this.rewardGoTo(Math.min(acts.length, Math.max(1, s.bonusAct || 1)));
},
bonusRankRow(row, no, i) {
return `<div class="rank-row" style="transition-delay:${(0.05 + i * 0.06).toFixed(2)}s">
        <span class="rank-no">${no}</span>
        <span><span class="rank-name">${row.name}</span><div class="rank-meta">${row.meta}</div></span>
        <span class="rank-score">${Math.round(row.score || 0)}</span>
      </div>`;
},
bonusMeRow(s, meRank, rankUpTxt, meMeta, heat, i) {
return `<div class="rank-row me" style="transition-delay:${(0.05 + i * 0.06).toFixed(2)}s">
        <span class="rank-no">${meRank}</span>
        <span><span class="rank-name">${s.modelName || "小鲸鱼"} · ${s.ver}<span class="rank-up">${this.icon("arrow-up-right", 10)}${rankUpTxt}</span></span><div class="rank-meta">${meMeta}</div></span>
        <span class="rank-score">${Math.round(heat.score || 0)}</span>
      </div>`;
},
bonusFeedCards(stats, beta, exc) {
const fb = this.core.cfg.USER_FEEDBACK || {};
const generic = fb.generic || [];
const pick = (arr) => {
if (arr && arr.length) return arr[Math.floor(Math.random() * arr.length)];
return generic.length ? generic[Math.floor(Math.random() * generic.length)] : { n: "匿名用户", t: "期待下一个版本。" };
};
const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
const byNow = stats.slice().sort((a, b2) => b2.now - a.now);
const cards = [];
[byNow[0], byNow[1]].filter(Boolean).forEach((d, i) => {
const star = beta ? (Math.random() < 0.3 ? 3 : 4) : (exc ? 5 : 4);
cards.push({ f: pick((fb.praise || {})[d.key]), star, delay: 0.15 + i * 0.15 });
});
const worst = byNow.length ? byNow[byNow.length - 1].key : "code";
cards.push({ f: pick((fb.improve || {})[worst]), star: beta ? (Math.random() < 0.5 ? 1 : 2) : (Math.random() < 0.5 ? 2 : 3), delay: 0.45 });
return cards.map((cd) =>
`<div class="feed-card" style="transition-delay:${cd.delay.toFixed(2)}s">
        <span class="feed-avatar">${(cd.f.n || "?").charAt(0)}</span>
        <span><span class="feed-name">${beta ? "【内测】" : ""}${cd.f.n}</span><span class="feed-stars">${stars(cd.star)}</span>
        <div class="feed-text">${cd.f.t}</div></span>
      </div>`).join("");
},
bonusAchievements() {
const c = this.core.cfg, b = this.core.state.bonus || {};
const achvCfg = c.ACHIEVEMENTS || [];
const achvStore = this.core.achvStore ? this.core.achvStore() : null;
return (Array.isArray(b.newAchv) ? b.newAchv : [])
.map((k) => {
const cfg = achvCfg.find((a) => a && a.key === k);
if (!cfg) return null;
const rec = achvStore && achvStore.get(k);
return rec ? Object.assign({}, cfg, { t: rec.t, ver: rec.ver, week: rec.week }) : cfg;
})
.filter(Boolean)
.sort((x, y) => (this.ACHV_ORDER[x.rarity] || 0) - (this.ACHV_ORDER[y.rarity] || 0));
},
bonusLastAct() {
const s = this.core.state, view = this._bonusView;
if (view && view.state === s && view.bonus === s.bonus && view.result === s.result && view.root.isConnected)
return view.last;
return this.bonusAchievements().length ? 4 : 3;
},
rewardGoTo(n) {
const s = this.core.state;
const last = this.bonusLastAct();
n = Math.min(Math.max(1, Number(n) || 1), last);
n = Math.floor(n);
s.bonusAct = n;
console.log("[奖励演出] 切换到第", n, "幕（共", last, "幕）");
for (let k = 1; k <= last; k++) {
const el = this.el.querySelector("#act-" + k);
if (!el) continue;
if (k === n) {
el.classList.remove("leaving");
el.classList.add("active");
} else if (el.classList.contains("active")) {
el.classList.remove("active");
el.classList.add("leaving");
this.bonusLater(() => el.classList.remove("leaving"), 600);
}
}
this.el.querySelectorAll(".step-pill").forEach((p) => {
const sn = Number(p.dataset.step);
p.classList.toggle("active", sn === n);
p.classList.toggle("done", sn < n);
});
if (n === 1) this.playAct1();
else if (n === 2) this.playAct2();
else if (n === 3) this.playAct3();
else if (n === 4) this.playAct4();
const pages=this._rewardPages&&this._rewardPages.stages.get(n);if(pages)pages.layout();
},
playAct1() {
if (this._bonusPlayed[1]) return;
this._bonusPlayed[1] = true;
console.log("[奖励演出] 第一幕开始：分组柱状图生长");
const r = this.core.state.result || {};
const cols = this.el.querySelectorAll("#bars .bar-col");
let upN = 0;
let scaleMax = 0;
cols.forEach((col) => col.querySelectorAll(".mini-bar").forEach((b) => {
scaleMax = Math.max(scaleMax, parseInt(b.dataset.h, 10) || 0);
}));
scaleMax = Math.max(1, scaleMax * 1.08);
cols.forEach((col, i) => {
const minis = col.querySelectorAll(".mini-bar");
const valEl = col.querySelector(".bar-value");
const curBar = col.querySelector(".mini-bar.cur");
if (!curBar) return;
const target = parseInt(curBar.dataset.h, 10) || 0;
const isUp = col.classList.contains("up");
if (isUp) upN++;
const groupStart = 250 + i * 200;
minis.forEach((bar) => {
const v = parseInt(bar.dataset.h, 10) || 0;
const h = Math.min(100, (v / scaleMax) * 100);
const order = parseInt(bar.dataset.order || "0", 10);
this.bonusLater(() => { bar.style.height = h + "%"; }, groupStart + order * 120);
});
this.bonusLater(() => {
valEl.style.opacity = "1";
valEl.style.transform = "translateX(-50%) translateY(0)";
this.bonusCountUp(valEl, target, 900);
if (window.SFX) SFX.play(isUp ? "float" : "click", { vol: 0.22 });
}, groupStart + 3 * 120 + 120);
});
this.bonusLater(() => {
const uc = this.el.querySelector("#upCount");
if (uc) uc.textContent = upN + " 项";
this.bonusCountUp(this.el.querySelector("#totalScore"), Math.round(r.score || 0), 1000);
console.log("[奖励演出] 提升项目", upN, "项，综合评分", r.score);
}, 250 + cols.length * 200 + 700);
},
playAct2() {
if (this._bonusPlayed[2]) return;
this._bonusPlayed[2] = true;
console.log("[奖励演出] 第二幕开始：排行与用户反馈");
const s = this.core.state;
const beta = this.core.isBeta(s.ver);
const usersAll = s.users || 0;
this.bonusCountUp(this.el.querySelector("#userCount"), beta ? usersAll : Math.round(usersAll / 10000), 1400);
this.bonusCountUp(this.el.querySelector("#ratingVal"), (s.result || {}).userRating || 0, 1400, { decimals: 1 });
this.bonusLater(() => {
const me = this.el.querySelector("#rankList .rank-row.me");
const list = me && me.parentElement;
if (!list) return;
const pages=this._rewardPages&&this._rewardPages.stages.get(2);if(pages){const i=pages.views.findIndex(v=>v.units.some(u=>u.includes(me)));if(i>=0&&s.bonusAct===2){pages.show(i);me.classList.add("locating");this.bonusLater(()=>me.classList.remove("locating"),1800);}return;}
const target = Math.max(0, me.offsetTop - (list.clientHeight - me.offsetHeight) / 2);
const from = list.scrollTop, dist = target - from;
if (dist <= 0) { me.classList.add("locating"); this.bonusLater(() => me.classList.remove("locating"), 1800); return; }
const token = (this._rankScrollToken = (this._rankScrollToken || 0) + 1);
const DUR = 1400, t0 = performance.now();
const step = (t) => {
if (token !== this._rankScrollToken) return;
const k = Math.min(1, (t - t0) / DUR);
const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
list.scrollTop = from + dist * ease;
if (k < 1) requestAnimationFrame(step);
else { me.classList.add("locating"); this.bonusLater(() => me.classList.remove("locating"), 1800); }
};
requestAnimationFrame(step);
}, 900);
},
playAct3() {
if (this._bonusPlayed[3]) return;
this._bonusPlayed[3] = true;
console.log("[奖励演出] 第三幕开始：总奖金揭晓");
const card = this.el.querySelector("#bonusCard");
const total = (((this.core.state.bonus || {}).total || 0) / 10000);
this.bonusLater(() => {
if (!card) return;
this.spawnBonusParticles(card);
this.bonusLater(() => { if (card.isConnected) this.spawnBonusParticles(card); }, 500);
}, 350);
this.bonusCountUp(this.el.querySelector("#bonusNum"), total, 1600, {
done: () => {
this.readyBonusBtn();
if (window.SFX) SFX.play("fanfare");
},
});
if (!total) this.readyBonusBtn();
},
spawnBonusParticles(card) {
const colors = ["#4fb7ee", "#f2b84b", "#53b98d", "#e66b7a", "#7fd0f6", "#ffd98a"];
const raf = window.requestAnimationFrame || ((fn) => setTimeout(fn, 16));
for (let i = 0; i < 28; i++) {
const isCoin = i % 3 === 0;
const p = document.createElement("span");
p.className = isCoin ? "coin" : "confetti";
if (!isCoin) p.style.background = colors[i % colors.length];
const left = Math.random() * 100;
const delay = Math.random() * 0.6;
const dur = 1.6 + Math.random() * 1.2;
const drift = (Math.random() * 120 - 60) + "px";
p.style.left = left + "%";
p.style.transition = "transform " + dur + "s cubic-bezier(.22,1,.36,1) " + delay + "s," +
"opacity " + dur + "s ease " + delay + "s";
card.appendChild(p);
raf(() => {
p.style.opacity = "1";
p.style.transform = "translate(" + drift + ", 320px) rotate(" + (Math.random() * 540 - 270) + "deg)";
});
setTimeout(() => p.remove(), (dur + delay) * 1000 + 300);
}
console.log("[奖励演出] 粒子喷发完成");
},
playAct4() {
if (this._bonusPlayed[4]) return;
this._bonusPlayed[4] = true;
const list = this._bonusAchvList || [];
if (!list.length) { this.achvShowGrid(); return; }
const R = this.ACHV_REVEAL;
const hold = list.length > R.MANY_AT ? R.HOLD_MANY : R.HOLD;
this._achvIdx = 0;
this._achvSkipped = false;
console.log("[奖励演出] 第四幕开始：逐个弹卡", list.length, "张，单张", R.IN + hold + R.OUT, "ms");
const slot = this.el.querySelector("#achvRevealSlot");
const cnt = this.el.querySelector("#achvCount");
const step = () => {
if (!slot || !slot.isConnected) return;
if (this._achvSkipped || this._achvIdx >= list.length) { this.achvShowGrid(); return; }
const item = list[this._achvIdx];
slot.innerHTML = this.achvCardHtml(item, false);
const card = slot.querySelector(".achv-card");
if (card) { void card.offsetWidth; card.classList.add("in"); }
if (cnt) cnt.textContent = "第 " + (this._achvIdx + 1) + " / " + list.length + " 个";
if (window.SFX) SFX.play("float", { vol: 0.25 });
this._achvIdx += 1;
this.bonusLater(step, R.IN + hold + R.OUT);
};
this.bonusLater(step, 260);
},
achvSkipAll() {
if (this._achvSkipped) return;
this._achvSkipped = true;
this.clearBonusTimers();
this.achvShowGrid();
},
achvShowGrid() {
const rev = this.el.querySelector("#achvReveal");
const grid = this.el.querySelector("#achvGrid");
if (rev) rev.hidden = true;
if (!grid) return;
this._achvPage = 0;
this.achvRenderPage();
grid.hidden = false;
this.readyBonusBtn();
},
achvRenderPage() {
const grid = this.el.querySelector("#achvGrid");
const pager = this.el.querySelector("#achvPager");
if (!grid) return;
const list = this._bonusAchvList || [];
const PER = this.achvPerPage();
const total = Math.max(1, Math.ceil(list.length / PER));
this._achvPage = Math.min(Math.max(0, this._achvPage || 0), total - 1);
const page = this._achvPage;
grid.innerHTML = list.slice(page * PER, page * PER + PER)
.map((a) => this.achvCardHtml(a, true)).join("");
grid.querySelectorAll(".achv-card").forEach((n, i) => {
n.style.transitionDelay = (0.04 + i * 0.05).toFixed(2) + "s";
n.classList.add("in");
});
if (pager) {
pager.hidden = total <= 1;
pager.innerHTML = total <= 1 ? "" :
`<button class="upg-btn" type="button" data-action="achv-page" data-id="-1"${page <= 0 ? " disabled" : ""}>${this.icon("chevL", 13)} 上一页</button>
         <span class="upg-pageno">${page + 1} / ${total}</span>
         <button class="upg-btn" type="button" data-action="achv-page" data-id="1"${page >= total - 1 ? " disabled" : ""}>下一页 ${this.icon("chevR", 13)}</button>`;
}
if (window.SFX) SFX.play("confirm", { vol: 0.3 });
},
achvCardHtml(a, compact, opts) {
if (!a) return "";
const locked = !!(opts && opts.locked);
const rar = locked ? this.ACHV_RARITY["__locked"] : this.achvRarity(a.rarity);
const iconName = locked ? rar.icon : (a.icon || rar.icon || "medal");
const art = (!locked && a.img)
? `<img src="${this.escAttr(a.img)}" alt="${this.escAttr(a.imgAlt || a.name || "")}" loading="lazy" onerror="this.parentNode.classList.add('art-missing')">`
: `<span class="achv-glyph" aria-hidden="true">${this.achvIcon(iconName, compact ? 66 : 92)}</span>`;
const meta = [];
if (!locked) {
const when = this.achvTimeText(a.t);
if (a.ver) meta.push(this.escHtml(a.ver));
if (when) meta.push(this.escHtml(when));
else if (a.cat) meta.push(this.escHtml(a.cat) + " 类");
}
const vd = locked ? "未解锁" : (a.rarity || "");
let deco = "";
if (!compact) {
deco += `<i class="achv-glow" aria-hidden="true"></i>`;
for (let i = 0; i < (rar.rings || 0); i++) {
deco += `<i class="achv-halo hl-${i === 0 ? "a" : "b"}" aria-hidden="true"></i>`;
}
if (rar.dust) {
const n = Math.min(rar.dust, this.ACHV_REVEAL.DUST_MAX);
let dust = "";
for (let i = 1; i <= n; i++) dust += "<i></i>";
deco += `<i class="achv-dust" aria-hidden="true" data-particles="${n}">${dust}</i>`;
}
}
return `<div class="achv-wrap ${rar.cls}${compact ? " compact" : ""}${locked ? " is-locked" : ""}" data-key="${this.escAttr(a.key || "")}" data-rarity="${this.escAttr(locked ? "" : (a.rarity || ""))}">
        ${deco}
        <div class="achv-card">
          <div class="achv-inner">
            <div class="achv-art">${art}</div>
            <div class="achv-name">${this.escHtml(a.name || "")}</div>
            <div class="achv-vd">${this.escHtml(vd)}</div>
            <div class="achv-desc">${this.escHtml(this.tpl(a.desc || ""))}</div>
            <div class="achv-meta">${meta.join(" · ")}</div>
          </div>
        </div>
      </div>`;
},
rewardReplay() {
console.log("[奖励演出] 重播第一幕");
this._bonusPlayed = {};
this._achvIdx = 0;
this._achvSkipped = false;
const rev = this.el.querySelector("#achvReveal");
const grid = this.el.querySelector("#achvGrid");
if (rev) rev.hidden = false;
if (grid) { grid.hidden = true; grid.innerHTML = ""; }
this.el.querySelectorAll("#bars .mini-bar").forEach((b) => { b.style.height = "0%"; });
this.el.querySelectorAll("#bars .bar-value").forEach((v) => {
v.textContent = "0";
v.style.opacity = "0";
v.style.transform = "translateX(-50%) translateY(8px)";
});
const uc = this.el.querySelector("#upCount");
if (uc) uc.textContent = "0 项";
const ts = this.el.querySelector("#totalScore");
if (ts) ts.textContent = "0";
const bn = this.el.querySelector("#bonusNum");
if (bn) bn.textContent = "0";
const btn = this.el.querySelector(".bonus-next");
if (btn) btn.disabled = true;
this.rewardGoTo(1);
},
readyBonusBtn() {
const btn = this.el && this.el.querySelector(".bonus-next");
if (!btn || !btn.disabled) return;
btn.disabled = false;
btn.classList.add("ready");
if (window.SFX) SFX.play("click");
},
_pressUpCheck(x, y) {
const t = this._pressTarget;
if (!t) return;
if (Math.abs(x - (this._pressX || x)) > 8
|| Math.abs(y - (this._pressY || y)) > 8) { this._pressTarget = null; return; }
if (!(t.closest && t.closest("[data-action]"))) { this._pressTarget = null; return; }
const seq = this._pressSeq || 0;
const tg0 = t;
this._clickHandled = false;
setTimeout(() => {
if (this._clickHandled) return;
if ((this._pressSeq || 0) !== seq) return;
this._pressTarget = null;
if (tg0) this.onClick({ target: tg0, clientX: this._pressUpX, clientY: this._pressUpY });
}, 80);
},
onClick(e) {
this._clickHandled = true;
const tipEl = e.target.closest("[data-tip]");
if (tipEl && !tipEl.closest("[data-action]")) {
const tipText = tipEl.dataset.tip || tipEl.title || "";
if (tipText) this.toggleTip(e.clientX, e.clientY, tipText);
return;
}
let t = e.target.closest("[data-action]");
if (!t) {
const cx = (e.clientX != null && !isNaN(e.clientX)) ? e.clientX : this._pressUpX;
const cy = (e.clientY != null && !isNaN(e.clientY)) ? e.clientY : this._pressUpY;
if (cx != null && !isNaN(cx)) {
const el = document.elementFromPoint ? document.elementFromPoint(cx, cy) : null;
const cand = el && el.closest ? el.closest("[data-action]") : null;
const pt = this._pressTarget;
const ptAct = pt && pt.closest ? pt.closest("[data-action]") : null;
if (ptAct) {
if (cand && cand !== ptAct
&& cand.dataset.action === ptAct.dataset.action
&& (cand.dataset.id || "") === (ptAct.dataset.id || "")) t = cand;
} else if (cand) {
t = cand;
}
}
if (!t && this._pressTarget) {
t = this._pressTarget.closest ? this._pressTarget.closest("[data-action]") : null;
}
}
this._pressTarget = null;
if (!t) return;
this.hideTip();
const act = t.dataset.action;
const s = this.core.state;
if (window.SFX) SFX.play(this.CLICK_SFX_HEAVY[act] ? "confirm" : "click");
switch (act) {
case "open-rank":
this.openRank();
break;
case "cloud-upload":
this.cloudUploadNow();
break;
case "cloud-restore":
this.cloudRestore();
break;
case "cloud-forget":
this.askConfirm("删除云端存档",
"将删除本账号在当前 Toy 下的云端存档。本机存档不受影响，但之后换设备无法再恢复。",
() => this.cloudForget(), { okText: "删除", danger: true });
break;
case "name-page":
this._namePage=(this._namePage||0)+(Number(t.dataset.step)||0);
this.render({soft:true});
break;
case "name-pick":
this.core.setModelName(t.dataset.name || "");
this.render({ soft: true });
break;
case "name-random": {
const all = this.core.cfg.MODEL_NAME_SUGGEST || [];
const others = all.filter((n) => n !== this.core.state.modelName);
const src = others.length ? others : all;
if (src.length) this.core.setModelName(src[Math.floor(Math.random() * src.length)]);
this._namePage=Math.floor(Math.max(0,all.indexOf(this.core.state.modelName))/this.namingPerPage());
this.render({ soft: true });
break;
}
case "name-confirm":
this.core.startProject(this.core.state.modelName);
this.save.autoSave(s);
this.render({ soft: true });
break;
case "cand-prev":
if (this._candPage > 0) { this._candPage--; this.render({ soft: true }); }
else this.candPeek(e.target, -1);
break;
case "cand-next":
if (this._candPage < this._candPages - 1) { this._candPage++; this.render({ soft: true }); }
else this.candPeek(e.target, 1);
break;
case "hire":
{
const hr = this.core.hire(t.dataset.id);
const okHire = hr === true || (hr && hr.ok === true);
if (okHire) { this.core.snapshot(); this.save.autoSave(s); this.render({ soft: true }); }
else this.toast((hr && hr.tip) || "无法录用");
}
break;
case "office-modal": {
const key = t.dataset.id;
const s2 = this.core.state;
s2.officeModal = s2.officeModal === key ? null : key;
if (s2.officeModal === "recruit") this._recruitPick = (s2.candidates[0] || {}).id;
if (s2.officeModal === "test") this.omTestOpen();
if (s2.officeModal === "team") { this._teamMode = "overview"; this._teamPick = null; this._teamPage = 0; }
if (window.SFX) SFX.play("click");
this.render({ soft: true });
break;
}
case "office-modal-close":
this.core.state.officeModal = null;
if (window.SFX) SFX.play("click");
this.render({ soft: true });
break;
case "nw-like": {
const nid = t.dataset.id;
const s3 = this.core.state;
s3.newsLiked = s3.newsLiked || {};
const on = !s3.newsLiked[nid];
s3.newsLiked[nid] = on;
if (window.SFX) SFX.play("click");
const nObj = (s3.newsFeed || []).find((n) => n.id === nid);
const st3 = this.newsStats(nObj || { id: nid }, this._newsTick || 0);
t.classList.toggle("on", on);
t.textContent = (on ? "❤️" : "🤍") + " 点赞 " + this.fmtWan(st3.likes);
break;
}
case "nw-img": {
this.openNewsImg(t.dataset.src);
break;
}
case "nw-cmt": {
const post = t.closest(".nw-post");
if (!post) break;
const box = post.querySelector(".nw-cmts");
if (box) box.hidden = !box.hidden;
t.classList.toggle("on", !box.hidden);
break;
}
case "office-pause": {
if (window.OfficePause) OfficePause.toggleManual(this.core);
else this.core.state.officePaused = !this.core.state.officePaused;
if (window.SFX) SFX.play("click");
this.render({ soft: true });
break;
}
case "guide-page": {
this._guideLinePage = 0; this._guideIdx = parseInt(t.dataset.guidePage, 10) || 0;
if (window.SFX) SFX.play("click");
this.render({ soft: true });
const hovered=this._pointerInCard;
this._pointerInCard=false;this._fitAt=0;
try { this.fitModalBody(); } finally { this._pointerInCard=hovered; }
break;
}
case "guide-line-page": {
const page = Number(t.dataset.guideLinePage);
if (!Number.isInteger(page) || page < 0) break;
this._guideLinePage = page;
this.render({soft:true});
const hovered=this._pointerInCard;
this._pointerInCard=false;this._fitAt=0;
try { this.fitModalBody(); } finally { this._pointerInCard=hovered; }
break;
}
case "collect-all": {
const r = this.core.collectAll();
if (!r.ok) { this.toast(r.tip || "还没有可收的产出"); break; }
const gainTxt = this.modelDims(s)
.filter((d) => r.results.some((x) => this.modelValue(d.key,x.inc) > 0))
.map((d) => d.label + " +" + Math.round(r.results.reduce((a, x) => a + this.modelValue(d.key,x.inc), 0)))
.join("、");
this.toast("📦 收了 " + r.total + " 点产出：" + gainTxt);
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "open-settings":
this.openSettingsPop();
break;
case "settings-close": {
const pop = this.el.querySelector("#settingsPop");
if (pop) pop.remove();
break;
}
case "open-codex":
this.openCodexPop();
break;
case "codex-close": {
const pop = this.el.querySelector("#codexPop");
if (pop) pop.remove();
break;
}
case "codex-page": {
this.codexGoto(Number(t.dataset.id) || 0);
break;
}
case "codex-open":
this.openCodexDetail(t.dataset.id);
break;
case "codex-detail-close":
this.closeCodexDetail();
break;
case "team-pick":
this.omTeamPick(t.dataset.id);
break;
case "team-page":
this.omTeamPage(+t.dataset.id);
break;
case "recruit-page": {
this._recruitPage = Math.max(0, (this._recruitPage || 0) + (+t.dataset.id || 0));
this._recruitPick = null;
this.refreshOfficeBody();
break;
}
case "recruit-pick":
this.omRecruitPick(t.dataset.id);
break;
case "focus-pick":
this.omFocusPick(+t.dataset.id);
break;
case "paper-pick":
this.omPaperPick(t.dataset.id);
break;
case "paper-page": {
this._paperPage = Math.max(0, (this._paperPage || 0) + (+t.dataset.id || 0));
this.refreshOfficeBody();
break;
}
case "shop-pick":
this.omShopPick(t.dataset.id);
break;
case "shop-gen": {
this._shopGen = t.dataset.id;
const c = this.core.cfg;
const tiers = Object.keys(c.GPU_TIERS || {});
const first = tiers.find((k) => (c.GPU_TIERS[k] || {}).gen === t.dataset.id) || tiers[0];
this._shopPick = first;
this.refreshOfficeBody();
if (this.afterModalRender) this.afterModalRender(false);
break;
}
case "om-test-game":
this.omTestGameSend();
break;
case "om-test-opt": {
const raw = t.dataset.opt;
this.omTestOptC2(raw);
break;
}
case "chat-zoom":
this.chatZoom(t.dataset.kind, t.dataset.src);
break;
case "chat-zoom-close": {
const mask = this.el.querySelector("#chatZoomMask");
if (mask) { const v = mask.querySelector("video"); if (v) v.pause(); mask.remove(); }
break;
}
case "chat-voice":
this.chatVoice(t);
break;
case "chat-voice-replay":
this.chatVoice(t.closest(".chat-voice"), true);
break;
case "chat-think-toggle": {
const el = t.closest(".chat-think");
if (!el) break;
const entry = (this._omTestLog || [])[+el.dataset.idx];
const nowOpen = !el.classList.contains("collapsed");
if (entry && entry.think) entry.open = !nowOpen;
el.classList.toggle("collapsed", nowOpen);
break;
}
case "chat-panel": {
const p = t.dataset.panel;
this._chatPanel = (this._chatPanel === p) ? null : p;
this._chatSub = null;
this.refreshChatBar();
break;
}
case "chat-sub":
this._chatSub = t.dataset.sub || null;
this.refreshChatBar();
break;
case "chat-send-media":
this.chatSendMedia(t.dataset.kind, t.dataset.i);
break;
case "om-test-restart":
this.omTestRestart();
break;
case "om-test-end":
this.omTestEnd();
break;
case "plan-arch": {
const archs = this.core.cfg.ARCHITECTURES || [];
const n = archs.length || 1;
this._planArch = (((this._planArch || 0) + (+t.dataset.id)) % n + n) % n;
this.planCardSwitch("#archCard", n, this._planArch);
this.refreshMissionCard((archs[this._planArch] || {}).id, this.planPickParam());
break;
}
case "plan-param":
this._planParam = +t.dataset.id;
this.refreshOfficeBody();
break;
case "plan-corpus": {
const n = (this.core.cfg.CORPUS_SOURCES || []).length || 1;
this._planCorpus = (((this._planCorpus || 0) + (+t.dataset.id)) % n + n) % n;
this.refreshOfficeBody();
break;
}
case "om-plan-buycorpus": {
const need = this.planReady().corpusGate != null ? this.planReady().corpusGate : 0;
let tries = 0, bought = 0, cost = 0, fail = "";
while (tries++ < 30 && Math.floor(s.v35.corpus.token) < need) {
const r = this.core.buyCorpus();
if (!r.ok) { fail = r.tip || "经费不足"; break; }
bought += r.bought || 0;
cost += r.cost || 0;
}
const have = Math.floor(s.v35.corpus.token);
if (bought) {
this.toast(`🛒 外包采购 ${bought} 条（-${fmtMoney(cost)}）→ 当前 ${have} 亿`
+ (have < need ? `，仍差 ${Math.ceil(need - have)} 亿：${fail}` : "，已够本组合立项"));
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
} else if (fail) {
this.toast(fail);
}
this.refreshOfficeBody();
break;
}
case "om-plan-confirm": {
const c = this.core.cfg;
const archs = c.ARCHITECTURES || [];
const arch = archs[((this._planArch || 0) % archs.length + archs.length) % archs.length] || {};
if (!this.planReady().ok) { this.toast(this.planReady().reason + "，无法立项"); break; }
const param = this.planPickParam();
const mpv = this.core.missionPreview ? this.core.missionPreview(arch.id, param) : { hit: true };
if (mpv.hit === false) {
this.askConfirm("未达成任务目标", ((c.MISSIONS || {}).UI || {}).DEFER_TIP
|| "本次立项未满足本阶段任务的架构或参数要求。任务未达时将留在本阶段重训，主评审经费只对超过本版本已结算最高分的提升发放；同分或更低为 0，小模型等单列收入另算。确定仍然立项吗？", () => {
const r = this.core.confirmPlan({ arch: arch.id, param, mix: this._planMix });
if (!r.ok) { this.toast(r.tip || "立项失败"); return; }
this.toast("📄 立项完成：" + arch.name + " · " + param + "B"
+ (r.quality && r.quality.tip ? "（" + r.quality.tip + "）" : ""));
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
this.render({ soft: true });
});
break;
}
const r = this.core.confirmPlan({ arch: arch.id, param, mix: this._planMix });
if (!r.ok) { this.toast(r.tip || "立项失败"); break; }
this.toast("📄 立项完成：" + arch.name + " · " + param + "B"
+ (r.quality && r.quality.tip ? "（" + r.quality.tip + "）" : ""));
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "om-focus-start": {
const dims = this.focusList();
const d = dims[this._focusPick || 0] || dims[0] || {};
const r = this.core.startFocus(d.key);
if (!r.ok) { this.toast(r.tip || "现在还不能攻关"); break; }
const mul = (this.core.v35On && this.core.v35On())
? (this.core.cfg.V35.FOCUS_MUL || 2.5) : (this.core.cfg.FOCUS.MUL || 1.5);
this.toast("🎯 攻关开始：" + (r.weeks || 1) + " 周内「" + d.name + "」产出 ×" + mul
+ (r.cost ? "（-" + fmtMoney(r.cost) + "）" : ""));
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "om-paper-start": {
const id = this._paperPick;
if (id == null || !this.core.paperOf(id) || this.core.hasPaper(id)
|| !(s.paperCandidates || []).some(value => this.core.paperNoOf(value) === this.core.paperNoOf(id))) break;
const r = this.core.startPaper(id);
if (!r.ok) { this.toast(r.tip || "现在还不能研究"); break; }
const p = this.core.paperOf(id) || {};
const v35 = this.core.v35On && this.core.v35On();
const pwk = v35
? (s.paperResearch ? s.paperResearch.weeks : (p.weeks || 1))
: (p.weeks || 3);
this.toast("📖 开始研究《" + (p.title || id) + "》，" + pwk + " 周后出成果");
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "om-buygpu": {
const r = this.core.buyGpu(this._shopPick || t.dataset.id || s.gpuTier || "basic");
if (!r.ok) { this.toast(r.tip || "买不起"); break; }
const g = this.core.cfg.GPU_TIERS[r.tier || this._shopPick || s.gpuTier] || {};
this.toast("🖥 算力升级到「" + (g.name || "") + "」，参数上限 " + g.maxParam + "B");
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "hire-pick": {
const key = t.dataset.role;
const roles = window.V35Hire ? V35Hire.roles(this.core) : {};
if (!roles[key]) break;
if (!Array.isArray(this._hireRoles)) this._hireRoles = [];
const i = this._hireRoles.indexOf(key);
if (i >= 0) this._hireRoles.splice(i, 1); else this._hireRoles.push(key);
this.refreshOfficeBody();
break;
}
case "hire-all": {
this._hireRoles = window.V35Hire ? Object.keys(V35Hire.roles(this.core)) : [];
this.refreshOfficeBody();
break;
}
case "hire-order": {
const sel = (this._hireRoles && this._hireRoles.length) ? this._hireRoles.slice()
: (t.dataset.role ? [t.dataset.role] : []);
if (!sel.length) { this.toast("先勾选要招的岗位"); break; }
const rr = this.core.requestHire(sel);
if (!rr.ok) { this.toast(rr.tip || "发布失败"); break; }
this.toast("📢 已发布需求：寻访 " + rr.label + "，预计 " + rr.mins + " 周内有消息"
+ (rr.cost ? "（-" + Math.round(rr.cost / 10000) + " 万）" : ""));
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "hire-rush": {
const options = window.V35Hire ? V35Hire.rushOptions(this.core) : null;
const rr = options ? V35Hire.rush(this.core) : { ok: false, tip: "招聘系统未加载" };
if (!rr.ok) { this.toast(rr.tip || "加急失败"); break; }
const found = rr.result;
this.toast(found && found.found
? "📋 寻访完成，找到 " + found.count + " 位人选，请到「招聘」查看"
: found ? V35Hire.retryNotice(this.core)
: "⚡ 招聘已加急，等待缩短 " + rr.weeks + " 周（-" + options.costText + "）");
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "om-hire": {
const id = this._recruitPick || ((s.candidates || [])[0] || {}).id;
const cand = (s.candidates || []).find((x) => x.id === id);
const r = this.core.hire(id);
const ok = (r === true) || (r && r.ok === true);
if (!ok) { this.toast((r && r.tip) || "招不了（经费不够或本轮招满了）"); break; }
const eng = s.engineers.find((x) => x.id === (cand || {}).id) || s.engineers[s.engineers.length - 1];
const jt = this.joinTickOf(eng);
const tick = (s.v35 && s.v35.tick) || 0;
const salaryTxt = "月薪 " + Math.round(((cand || {}).salary || 0) / 10000) + " 万，随每 4 周工资发放";
if (jt > tick) {
const wk = Math.floor(jt / ((this.core.cfg.V35 || {}).TICKS_PER_WEEK || 6)) + 1;
this.toast("📝 " + ((cand || {}).name || "新人") + " 已签约，第 " + wk + " 周到岗（到岗前状态为「待入职」，不参与产出）；" + salaryTxt);
} else {
this.toast("🎉 " + ((cand || {}).name || "新人") + " 入职了！" + salaryTxt);
}
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
if (!(s.candidates || []).length) {
s.officeModal = null;
this.render({ soft: true });
} else {
this._recruitPick = s.candidates[0].id;
this.render({ soft: true });
this.refreshOfficeBody();
}
break;
}
case "om-team-activity":
this.omTeamActivity();
break;
case "activity-close": {
const pop = this.el.querySelector("#activityPop");
if (pop) pop.remove();
break;
}
case "om-activity-do": {
const pop = this.el.querySelector("#activityPop");
if (pop) pop.remove();
const r = this.core.doTeamBuild(t.dataset.id);
this.toast(r.ok ? (r.msg || "活动完成") : ("✗ " + (r.tip || "现在办不了")));
if (r.ok) { if (window.SFX) SFX.play("confirm"); this.save.autoSave(s); }
this.render({ soft: true });
this.refreshOfficeBody();
break;
}
case "om-test-clear":
this.resetOmTestChat();
this.refreshOfficeBody();
break;
case "om-arrange-menu":
this.omArrangeMenu(t.dataset.id);
break;
case "arrange-close": {
this.el.querySelectorAll("#arrangePop").forEach((n) => n.remove());
break;
}
case "om-arrange-do": {
this.el.querySelectorAll("#arrangePop").forEach((n) => n.remove());
const id = t.dataset.id, kind = t.dataset.kind;
const run = {
talk: () => this.core.arrangeEngineer(id),
train: () => this.core.trainEngineer(id),
raise: () => this.core.raiseSalary(id),
rest: () => this.core.restEngineer(id),
}[kind];
const r = run ? run() : { ok: false, tip: "没有这个操作" };
this.toast(r.ok ? (r.tip || r.msg || "安排好了") : ("✗ " + (r.tip || "现在不方便")));
if (r.ok) { if (window.SFX) SFX.play("confirm"); this.save.autoSave(s); }
this.render({ soft: true });
this.refreshOfficeBody();
break;
}
case "om-train": {
const r = this.core.trainEngineer(t.dataset.id);
this.toast(r.ok ? ("📚 " + (r.tip || "培训完成")) : ("✗ " + (r.tip || "现在不能培训")));
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "om-rest": {
const r = this.core.restEngineer(t.dataset.id);
this.toast(r.ok ? ("⚡ " + (r.tip || "让他歇会儿")) : ("✗ " + (r.tip || "不能休息")));
this.render({ soft: true });
break;
}
case "om-raise": {
const r = this.core.raiseSalary(t.dataset.id);
this.toast(r.ok ? ("📈 " + (r.tip || "加薪完成")) : ("✗ " + (r.tip || "不能加薪")));
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "om-fire": {
this.fireConfirm(t.dataset.id);
break;
}
case "om-start-review": {
if (!this.core.canReview()) {
this.toast(this.core.v35On() ? `训练周期还没结束——第 ${this.core.minWeeks(s.ver)} 周结束后才能发起评审` : "还没达标，再练练");
break;
}
s.officeModal = null;
this.core.enterReview();
if (!this.core.embodiedAvailable || !this.core.embodiedAvailable(s)) this.core.buildEvalShow();
this._evalShown = 0;
this.save.autoSave(s);
this.render();
break;
}
case "fitness-start":
case "fitness-pause":
case "fitness-settle":
if (window.EmbodiedFitnessReview) EmbodiedFitnessReview.action(this, act.slice(8));
break;
case "evalshow-done": {
if (this.core.state.phase === "review" && this.core.embodiedAvailable && this.core.embodiedAvailable(this.core.state)) { this.settleEmbodiedReview(); this.render(); break; }
this.stopEvalShowTimer();
this._evalShown = 0;
this.core.finish();
this.save.autoSave(s);
this.render();
break;
}
case "bonus-done":
case "bonus-final": {
this.clearBonusTimers();
if (!this.core.finishBonus()) break;
this.save.autoSave(s);
this.render();
break;
}
case "bonus-next": {
this.rewardGoTo(Math.min(this.bonusLastAct(), Math.max(1, parseInt(t.dataset.step, 10) || 1)));
break;
}
case "bonus-jump": {
this.rewardGoTo(this.bonusLastAct());
break;
}
case "achv-skip": {
this.achvSkipAll();
break;
}
case "achv-page": {
const per = this.achvPerPage();
const tot = Math.max(1, Math.ceil((this._bonusAchvList || []).length / per));
this._achvPage = Math.min(Math.max(0, (this._achvPage || 0) + (+t.dataset.id || 0)), tot - 1);
this.achvRenderPage();
break;
}
case "eval-pause": {
this._evalPaused = !this._evalPaused;
const pb = this.el.querySelector("#evPauseBtn");
if (pb) pb.textContent = this._evalPaused ? "▶ 继续评审" : "⏸ 暂停阅读";
if (window.SFX) SFX.play("click");
break;
}
case "bonus-replay": {
this.rewardReplay();
break;
}
case "upg-page": {
const upsAll = (s.traitUps || s.traitUpgrades || []).filter((u) => u && typeof u === "object" && u.name);
const per = 3;
const tot = Math.max(1, Math.ceil(upsAll.length / per));
this._upgPage = Math.min(Math.max(0, this._upgPage + (+t.dataset.id || 0)), tot - 1);
const pg = this._upgPage;
const listEl = this.el.querySelector("#upgradeList");
if (listEl) {
listEl.innerHTML = upsAll.slice(pg * per, pg * per + per).map((u, i) => {
const eng = s.engineers.find((e) => e.id === u.id);
const av = eng ? this.engAvatar(eng) : "";
return `<div class="upgrade-item" style="transition-delay:${(i * 0.1).toFixed(2)}s">
              <span class="up-avatar role-${u.type || "pretrain"}">${av ? `<img src="${av}" alt="">` : (u.name || "?").charAt(0)}</span>
              <span class="up-info">
                <span class="up-name">${u.name} · ${this.ROLE_NAME[u.type] || "工程师"}</span>
                <span class="up-trait">${this.icon("star", 11)}${u.trait}</span>
              </span>
              <span class="lv-flow">
                <span class="lv-badge old">Lv.${u.from}</span>
                <span class="lv-arrow">${this.icon("arrow-right", 14)}</span>
                <span class="lv-badge new">Lv.${u.to}</span>
              </span>
            </div>`;
}).join("");
const act = listEl.closest(".act");
if (act) { listEl.querySelectorAll(".upgrade-item").forEach((n) => n.classList.add("in")); }
}
const pgno = this.el.querySelector(".upg-pageno");
if (pgno) pgno.textContent = (pg + 1) + " / " + tot;
const btns = this.el.querySelectorAll(".upgrade-pager .upg-btn");
if (btns[0]) btns[0].disabled = pg <= 0;
if (btns[1]) btns[1].disabled = pg >= tot - 1;
break;
}
case "reroll":
this.core.requestRecruit();
this.save.autoSave(s);
this.render({ soft: true });
break;
case "go-buygpu":
if (this.core.initialRecruitment()?.missing.length) { this.toast(this.core.initialRecruitment().tip); break; }
s.phase = "buygpu"; this.render();
break;
case "recruit-back":
s.phase = "loop";
if (s.pendingMinigame) {
this.core.startMinigame(s.pendingMinigame);
} else {
s.loopStep = s.loopStep === "workshop" ? "workshop" : "report";
}
this.save.autoSave(s);
this.render();
break;
case "tb-act": {
if (t.dataset.target === "1") {
this._tbKind = t.dataset.kind;
this.render({ soft: true });
break;
}
const r = this.core.doTeamBuild(t.dataset.kind);
if (!r.ok) { this.toast(r.tip || "无法执行"); break; }
this.toast(r.msg || "完成");
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "tb-pick": {
const r = this.core.doTeamBuild(this._tbKind, t.dataset.id);
this._tbKind = null;
if (!r.ok) { this.toast(r.tip || "无法执行"); this.render({ soft: true }); break; }
this.toast(r.msg || "完成");
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "tb-cancel":
this._tbKind = null;
this.render({ soft: true });
break;
case "free-act": {
const r = this.core.doFreeAction(t.dataset.kind);
if (!r.ok) { this.toast(r.tip || "无法执行"); break; }
this.toast(r.msg || "完成");
if (window.SFX) SFX.play(t.dataset.kind === "paper" ? "click" : "confirm");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "mg-pick": {
if (this.core.minigamePick(+t.dataset.id) == null) break;
if (window.SFX) SFX.play("click");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "mg-next": {
const r = this.core.minigameNext();
if (r && r.summary) this._mgSummary = r.summary;
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "mg-done":
this._mgSummary = null;
s.officeModal = null;
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
this.render({ soft: true });
break;
case "mg-abandon": {
s.minigame = null;
s.pendingMinigame = null;
if (window.OfficePause) OfficePause.releaseSource(this.core, "inspection");
else s.officePaused = !!s._mgWasPaused;
s._mgWasPaused = null;
s.officeModal = null;
this.toast("已放弃本次巡检");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "mg-rank": {
const r0 = this.core.minigameRank(+t.dataset.id);
if (r0) { if (window.SFX) SFX.play("click"); this.render({ soft: true }); }
break;
}
case "mg-submit": {
const rv = this.core.minigameSubmitRank();
if (rv) { if (window.SFX) SFX.play(rv.perfect ? "confirm" : "click"); this.render({ soft: true }); }
break;
}
case "mg-reset-rank": {
const rr = this.core.minigameResetRank();
if (rr) { if (window.SFX) SFX.play("click"); this.render({ soft: true }); }
break;
}
case "buy-tier":
if (this.core.buyTier(t.dataset.id)) { this.core.snapshot(); this.save.autoSave(s); this.render({ soft: true }); }
break;
case "target":
this.core.chooseTarget(+t.dataset.id); this.save.autoSave(s); this.render({ soft: true });
break;
case "go-direction":
s.phase = "direction"; this.save.autoSave(s); this.render();
break;
case "pick-arch": {
const r = this.core.chooseArch(t.dataset.id);
if (!r.ok) { this.toast(r.tip); break; }
if (window.SFX) SFX.play("click");
this.render({ soft: true });
break;
}
case "pick-leader": {
this.core.setLeader(t.dataset.id);
if (window.SFX) SFX.play("click");
this.render({ soft: true });
break;
}
case "next-stage": {
this.clearBonusTimers();
if (!this.core.startNextStage()) { this.toast("无法进入下一阶段"); break; }
this.save.autoSave(s);
this.render();
break;
}
case "retry-stage": {
this.clearBonusTimers();
const _fin = !!(s.result && s.result.finalRepeat && !s.result.retry);
if (!this.core.retryStage()) { this.toast("当前不能重训"); break; }
this.toast(_fin ? ("🔁 再战 " + s.ver + " 阶段：目标不变，冲更高总评")
: ("🔁 重训 " + s.ver + " 阶段：目标不变，继续训练争取达标"));
this.save.autoSave(s);
this.render();
break;
}
case "tune-draw": {
const r = this.core.tuneDraw();
if (!r.ok) { this.toast(r.tip); break; }
this.toast(`🎰 抽出小模型：评分 ${r.score}${r.score >= 80 ? " 🌟 优品！结算 +10 万" : ""}`);
if (window.SFX) SFX.play(r.score >= 80 ? "confirm" : "click");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "buy-corpus": {
const r = this.core.buyCorpus();
if (!r.ok) { this.toast(r.tip); break; }
this.toast(`🛒 采购 ${r.bought} 条语料（-${fmtMoney(r.cost)}），其中良好 ${r.good != null ? r.good : "?"} 条`);
if (window.SFX) SFX.play("confirm");
this.save.autoSave(s);
this.render({ soft: true });
break;
}
case "to-review":
this.core.enterReview(); this.save.autoSave(s); this.render();
break;
case "event-opt": {
const result = this.core.applyEventOption(t.dataset.event, +t.dataset.id);
if (result && result.ok === false) { this.toast(result.tip || "暂时无法处理此选项"); break; }
this.save.autoSave(s);
this.trainAnim(() => this.render());
break;
}
case "finetune":
this.core.chooseFineTune(+t.dataset.id);
this.save.autoSave(s);
this.render({ soft: true });
break;
case "act": {
const a = this.core.actionById(t.dataset.id);
if (a && a.target === "one") {
this._actPick = this._actPick === a.id ? null : a.id;
this.render({ soft: true });
} else {
this.doAction(t.dataset.id, null);
}
break;
}
case "act-target":
this.doAction(t.dataset.id, t.dataset.eng);
break;
case "act-cancel":
this._actPick = null;
this.render({ soft: true });
break;
case "fire":
this.fireConfirm(t.dataset.id);
break;
case "fire-confirm": {
const r = this.core.fire(t.dataset.id);
if (!r.ok) {
this.closeFireModal();
this.toast(r.reason === "min_keep" ? "不能辞退最后一名工程师" : "无法辞退");
break;
}
this._modal = null;
this.closeFireModal();
this.save.autoSave(s);
this.toast(`🚪 已辞退${r.name}，赔付 ${Math.round(r.severance / 10000)}万`);
this.render({ soft: true });
break;
}
case "finish":
this.core.finish();
this.save.autoSave(s);
this.render({ soft: true });
break;
case "ask-newgame": {
const btn = this.el.querySelector('[data-action="ask-newgame"]');
if (btn && btn.dataset.armed !== "1") {
btn.dataset.armed = "1";
btn.textContent = "⚠️ 确认重新开始？";
btn.classList.add("pink");
setTimeout(() => {
if (!btn.isConnected) return;
delete btn.dataset.armed;
btn.textContent = "🔁 重新开始";
btn.classList.remove("pink");
}, 3000);
break;
}
this.core.newGame(); this.resetOmTestChat(); this.save.remove("auto"); this.render();
break;
}
case "newgame":
this.core.newGame(); this.resetOmTestChat(); this.save.remove("auto"); this.render();
break;
case "open-save":
case "save":
if (s.officeModal) s.officeModal = null;
if(this._modal!=="save")this.disposeModalPages();
this._modal = "save"; this.render({ soft: true });
break;
case "save-slot":
this.saveToSlot(t.dataset.slot);
break;
case "save-here":
this.saveToFirstEmpty();
break;
case "load-slot":
this.loadSlot(t.dataset.slot);
break;
case "del-slot":
this.removeSlot(t.dataset.slot);
break;
case "act-tab":
this._actTab = ["team", "free"].includes(t.dataset.tab) ? t.dataset.tab : "train";
this.render({ soft: true });
break;
case "loop-next":
s.loopStep = t.dataset.step || "report";
this.save.autoSave(s);
this.render();
break;
case "open-team":
this.openTeam();
break;
case "tut-close":
this.core.markTutorial(t.dataset.id);
t.closest(".dg-modal-mask").remove();
this.render({ soft: true });
if (this.core.state.phase === "review") { this._evalWaitTut = false; this.startEvalShowTimer(); }
break;
case "modal-page":
if(this._modalPages&&!this._modalPages.closed&&this._modalPages.mask.contains(t))this._modalPages.show(this._modalPages.page+Number(t.dataset.step));
break;
case "open-help":
this.openHelp();
break;
case "close-modal":
this.closeModal();
break;
case "close-fire":
this.closeFireModal();
break;
case "confirm-ok": {
const cb = this._confirmCb;
this.closeConfirm(true);
if (cb) cb();
break;
}
case "close-confirm":
this.closeConfirm();
break;
}
},
saveToSlot(slot) {
if (slot === "auto") return;
const existing = this.save.load(slot);
if (existing) {
this.askConfirm("覆盖存档？", `槽位 ${+slot + 1} 已有存档（${existing.name}），覆盖后原存档将丢失。`, () => {
this.save.save(slot, this.core.state);
this._modal = null;
this.render();
});
return;
}
this.save.save(slot, this.core.state);
this._modal = null;
this.render();
},
saveToFirstEmpty() {
for (let i = 0; i < this.save.MAX_SLOTS; i++) {
if (!this.save.load(i)) { this.save.save(i, this.core.state); this._modal = null; this.render({ soft: true }); return; }
}
this.toast(`存档槽已满（${this.save.MAX_SLOTS} 个），请先删除一个或覆盖已有槽位。`);
},
removeSlot(slot) {
if (slot === "auto") return;
const existing = this.save.load(slot);
if (!existing) return;
this.askConfirm("删除存档？", `确定删除槽位 ${+slot + 1} 的存档？删除后不可恢复。`, () => {
this.save.remove(slot);
this.refreshSaveModal();
this.render({ soft: true });
}, { danger: true, okText: "删除" });
},
loadSlot(slot) {
this.askConfirm("读取存档？", "读档将覆盖当前进度，当前未保存的进度会丢失。", () => {
let d = null;
if (slot === "stage") d = this.save.loadStage ? this.save.loadStage() : null;
else d = this.save.load(slot);
if (!d) { this.toast("该槽位为空"); return; }
this.core.restore(d.state);
this._tickFails = 0; this._tickRecovered = false;
this._modal = null;
this.render({ soft: true });
});
},
closeModal() {
this.cancelCloudRestore();
this.disposeModalPages();
if (this._closing) return;
const mask = this.el && this.el.querySelector(".dg-modal-mask");
if (!mask) {
if (this.core.state.phase === "bonus") return;
this._modal = null; this.render({ soft: true }); return;
}
this._closing = true;
mask.classList.add("dg-modal-out");
setTimeout(() => { this._closing = false; this._modal = null; this.render({ soft: true }); }, 180);
},
candPeek(btn, dir) {
const area = btn && btn.closest ? btn.closest(".dg-cand-area") : null;
if (!area) return;
area.classList.remove("dg-peek-next", "dg-peek-prev");
void (area).offsetWidth;
area.classList.add(dir < 0 ? "dg-peek-prev" : "dg-peek-next");
setTimeout(() => area.classList.remove("dg-peek-next", "dg-peek-prev"), 540);
},
toast(msg) {
let el = document.getElementById("dg-toast");
if (!el) {
el = document.createElement("div");
el.id = "dg-toast";
el.className = "dg-toast";
document.body.appendChild(el);
}
el.textContent = msg;
el.classList.add("show");
clearTimeout(this._toastTimer);
this._toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
},
toggleTip(x, y, text) {
let tip = document.getElementById("ui-trait-tip");
if (!tip) {
tip = document.createElement("div");
tip.id = "ui-trait-tip";
tip.className = "ui-trait-tip";
tip.style.position = "fixed";
tip.style.zIndex = "99999";
tip.style.maxWidth = "min(260px, 84vw)";
tip.style.pointerEvents = "none";
document.body.appendChild(tip);
}
const shown = tip.__shown;
if (shown && tip.textContent === text) { this.hideTip(); return; }
tip.textContent = text;
const vw = window.innerWidth, vh = window.innerHeight;
let left = Math.max(8, Math.min(x - 130, vw - 268));
let top = y + 14;
if (top + 120 > vh) top = y - 120 - 8;
tip.style.left = left + "px";
tip.style.top = top + "px";
tip.style.opacity = "1";
tip.style.transition = "none";
tip.__shown = 1;
clearTimeout(this._tipTimer);
return;
},
hideTip() {
const tip = document.getElementById("ui-trait-tip");
if (!tip) return;
tip.style.opacity = "0";
tip.__shown = 0;
clearTimeout(this._tipTimer);
this._tipTimer = setTimeout(() => { if (tip && !tip.__shown) tip.remove(); }, 240);
},
doAction(actionId, engId) {
const a = this.core.actionById(actionId);
if (!a) return;
if (a.confirm) { this._actPick = null; this.fireConfirm(engId, actionId); return; }
const r = this.core.useAction(actionId, engId);
if (!r.ok) { this.toast(r.tip || "无法执行"); return; }
this._actPick = null;
this.save.autoSave(this.core.state);
const cost = r.cost > 0 ? `（-${fmtMoney(r.cost)}）` : "";
this.toast(`${a.icon} ${a.name}${cost}：${r.text || "已生效"}`);
this.render({ soft: true });
},
fireConfirm(engId, actionId) {
if (this._fireOpen) return;
const s = this.core.state;
const f = this.core.cfg.FIRE || {};
const e = s.engineers.find((x) => x.id === engId);
if (!e || e.resigned) return;
if (!this.core.canFireEngineer(s)) { this.toast("不能辞退最后一名工程师"); return; }
this._fireOpen = true;
const mul = f.SEVERANCE_MUL != null ? f.SEVERANCE_MUL : 2;
const pay = Math.round((e.salary || 0) * mul);
this.el.insertAdjacentHTML("beforeend", `
      <div class="dg-modal-mask dg-fire-modal" data-action="close-fire">
        <div class="dg-modal dg-modal-fire">
          <div class="dg-title">⚠️ 确认辞退${e.name}？</div>
          <p class="dg-sub">辞退后不可恢复，需要支付经济补偿：</p>
          <ul class="dg-fire-list">
            <li>赔付 <b style="color:var(--aqua-error)">−${fmtMoney(pay)}</b>（月薪 × ${mul}，含代通知金）</li>
          </ul>
          <p class="dg-fire-warn">此操作不可撤销。</p>
          <div class="dg-actions">
            <button class="dg-btn" type="button" data-action="close-fire">再想想</button>
            <button class="dg-btn dg-btn-danger-solid" type="button" data-action="fire-confirm" data-id="${e.id}">🚪 辞退</button>
          </div>
        </div>
      </div>`);
},
closeFireModal() {
const m = this.el.querySelector(".dg-fire-modal");
if (m) m.remove();
this._fireOpen = false;
},
askConfirm(title, body, onOk, opts) {
if (this._confirmOpen) return;
this._confirmOpen = true;
this._confirmCb = onOk || null;
this._confirmCancel = opts && opts.onCancel || null;
const root = this.el || document.body;
root.insertAdjacentHTML("beforeend", `
      <div class="dg-modal-mask dg-confirm-modal" data-action="close-confirm">
        <div class="dg-modal">
          <div class="dg-title">⚠️ ${title}</div>
          <p class="dg-sub">${body}</p>
          ${opts && opts.warn ? `<p class="dg-fire-warn">${opts.warn}</p>` : ""}
          <div class="dg-actions">
            <button class="dg-btn" type="button" data-action="close-confirm">取消</button>
            <button class="dg-btn ${opts && opts.danger ? "dg-btn-danger-solid" : "dg-btn-primary"}" type="button" data-action="confirm-ok">${(opts && opts.okText) || "确定"}</button>
          </div>
        </div>
      </div>`);
},
closeConfirm(confirmed) {
const root = this.el || document.body;
const m = root.querySelector(".dg-confirm-modal");
if (m) m.remove();
const cancel = this._confirmCancel;
this._confirmOpen = false;
this._confirmCb = null;
this._confirmCancel = null;
if (!confirmed && cancel) cancel();
},
typeName(t) { return this.core.cfg.ENGINEER_TYPES[t] ? this.core.cfg.ENGINEER_TYPES[t].name : t; },
typeIcon(t) { return this.core.cfg.ENGINEER_TYPES[t] ? this.core.cfg.ENGINEER_TYPES[t].icon : "👤"; },
joinWeek(type) {
return { pretrain: "即刻（第 1 周）", data: "第 2 周", post: "第 4 周" }[type] || "即刻";
},
joinTickOf(e) {
if (!(this.core.v35On && this.core.v35On())) return 0;
if (e && e.joinTick != null) return e.joinTick;
return 0;
},
engStatus(e) {
const s = this.core.state;
const t = (s.v35 && s.v35.tick) || 0;
if (!(s.planDone)) return "等立项";
if (t < this.joinTickOf(e)) return "待入职";
if (!(this.core.v35On && this.core.v35On())) return "工作中";
const v = this.core.cfg.V35 || {};
const offS = v.OFF_START != null ? v.OFF_START : 0, offL = v.OFF_LEN != null ? v.OFF_LEN : 0;
if (offL > 0 && t >= offS && t < offS + offL) return "已下班";
if (e.restWeek != null && e.restWeek === (s.week || 0)) return "休假";
const en = Math.round(e.energy || 0);
if (en < (v.ENERGY_MIN != null ? v.ENERGY_MIN : 20)) return "休假";
return "工作中";
},
statusCls(st) {
return st === "待入职" ? "st-pending"
: st === "等立项" ? "st-wait"
: st === "已下班" ? "st-off"
: st === "休假" ? "st-rest"
: "";
},
traitName(t) {
const m = (this.core.cfg.TRAIT_META || {})[t];
if (m && m.name) return m.name;
return { pretrain: "预训练", post: "后训练", academic: "学术", engineer: "工程", data: "数据", safety: "安全" }[t] || t;
},
traitAxes(t) { return ((this.core.cfg.TRAIT_META || {})[t] || {}).axes || []; },
axisIcon(id, size) {
const d = this.core.axisDef(id) || {};
const s = size || 15;
if (!d.icon) return "";
return `<svg class="dg-ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"`
+ ` stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"`
+ ` aria-hidden="true">${d.icon}</svg>`;
},
dimFill(k) {
const st = this.core.dimBarStyle(k);
if (st) return st.replace(/^background:/, "");
return ({ code: "linear-gradient(90deg,#6fc3ff,#2789c4)", text: "linear-gradient(90deg,#7ed4f0,#3dbbd8)",
safety: "linear-gradient(90deg,#ffcf8a,#f2b84b)", stability: "linear-gradient(90deg,#7ed4b0,#53b98d)" })[k]
|| "var(--aqua-primary-deep)";
},
traitDesc(t) {
const base = {
pretrain: "预训练经验：拥有此词条即可产出代码 / 文字能力，与其他生产词条同时生效，按自身等级取产出档位",
post: "后训练经验：拥有此词条即可产出安全 / 稳定能力，与其他生产词条同时生效，按自身等级取产出档位",
academic: "学术研究：自身不升级，让同一位工程师的「其它词条」升级概率加算提升",
data: "数据经验：拥有此词条即可产出文字与语料（有效 token），与其他生产词条同时生效，语料品质按自身数据等级查表",
embodied: "具身经验：进入具身时代后，与其他生产词条同时生效，按自身等级驱动模型已激活的物理认知 / 灵巧操控轴，两轴按原规则交替产出",
}[t] || "";
if (base) {
const axs = this.traitAxes(t);
if (axs.length) {
const nm = axs.map((id) => this.core.statLabel(id)).join(" / ");
return base + "；也能驱动追加能力轴：<b>" + nm + "</b>（前提是本阶段架构真的带出了这根轴）";
}
}
if (!base) return "";
if (t === "academic") {
const B = ((this.core.cfg.TRAIT_UPGRADE || {}).ACADEMIC_BOOST) || [];
const pct = (x) => (Math.round(x * 1000) / 10) + "%";
return B.length
? `${base}：其它词条升级概率 +${B.map(pct).join(" / ")}（依次对应 Lv1~5，加算）`
: base;
}
try {
const keys = this.core.traitUpgradeStats(t);
if (!keys || !keys.length) return base;
const min = this.core.traitUpgradeMinStat();
const names = keys.map((k) => this.statName(k)).join(" + ");
const p1 = this.core.traitUpgradeProb(t, 1, min);
const p2 = this.core.traitUpgradeProb(t, 2, min);
const pct = (x) => (Math.round(x * 1000) / 10) + "%";
const how = keys.length > 1
? `${names} **均** ≥ ${min}（取平均值判定）`
: `${names} ≥ ${min}`;
return `${base}。\n升级条件：${how} 后，每次阶段结算有概率升级（Lv1→2 约 ${pct(p1)}、Lv2→3 约 ${pct(p2)}，数值越高概率越大）。`;
} catch (e) {
return base;
}
},
abilityName(k) { return this.core.statLabel(k); },
eventTypeName(t) { return { fixed: "固定", random: "随机", reward: "奖励", critical: "关键", chain: "连锁" }[t] || t; },
checkName(k) { return { param: "参数规模", code: "代码", text: "文字", safety: "安全", stability: "稳定", score: "总评" }[k] || k; },
statName(k) {
return { code: "代码", algo: "算法", text: "文字", engineering: "工程" }[k] || k;
},
typeColor(t) {
return { pretrain: "c-blue", post: "c-pink", data: "c-green" }[t] || "c-blue";
},
icon(name, size) {
const s = size || 15;
const p = {
calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/>',
coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
play: '<polygon points="5 3 19 12 5 21 5 3"/>',
pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
menu3: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
check: '<polyline points="20 6 9 17 4 12"/>',
alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
chevL: '<polyline points="15 18 9 12 15 6"/>',
chevR: '<polyline points="9 18 15 12 9 6"/>',
users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
news: '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M16 3v16"/><path d="M8 7h5M8 11h5M8 15h5"/>',
refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>',
wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M21 12h-5a2 2 0 0 0 0 4h5"/>',
gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
barchart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
"badge-check": '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
"git-compare": '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/>',
"trending-up": '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M19 3v4"/><path d="M21 5h-4"/>',
pointer: '<path d="m9 9 5 12 1.8-5.2L21 14Z"/><path d="M7.2 2.2 8 5.1"/><path d="m5.1 8-2.9-.8"/><path d="M14 4.1 12 6"/><path d="m6 12-1.9 2"/>',
"arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
"external-link": '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
"arrow-up": '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
"arrow-up-right": '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
msg: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
plus: '<path d="M12 5v14M5 12h14"/>',
note: '<path d="M2 6h4M2 10h4M2 14h4M2 18h4"/><rect x="6" y="3" width="16" height="18" rx="2"/><path d="M11 8h6M11 12h6"/>',
image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
audio: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>',
crown: '<path d="M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.67a1 1 0 0 0 1.52-.3z"/><path d="M5 21h14"/>',
medal: '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/>',
replay: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
achvCommon: '<circle cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="4.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="#fff" stroke="none"/>',
achvRare: '<path d="M12 2.2 21.8 12 12 21.8 2.2 12Z"/><path d="M12 7.6 16.4 12 12 16.4 7.6 12Z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="#fff" stroke="none"/>',
achvEpic: '<path d="M12 1.8 15.3 8.7 22.2 12l-6.9 3.3L12 22.2l-3.3-6.9L1.8 12l6.9-3.3Z"/><path d="M12 6.8 14.8 12 12 17.2 9.2 12Z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="#fff" stroke="none"/><path d="M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4"/>',
achvLegend: '<path d="M3.8 9.4 8.5 13.2 12 5.2l3.5 8 4.7-3.8-1.9 9.8H5.7Z"/><path d="M5.7 20.6h12.6"/><path d="M12 12.4 14 15l-2 2.6L10 15Z" fill="currentColor" stroke="none"/><path d="M12 1.6v2.2M5.4 3.2l1.2 2.1M18.6 3.2l-1.2 2.1"/>',
achvLocked: '<rect x="3.4" y="10.2" width="17.2" height="11.4" rx="2.6"/><path d="M7.6 10.2V7.4a4.4 4.4 0 0 1 8.8 0v2.8"/><circle cx="12" cy="15.4" r="1.6" fill="currentColor" stroke="none"/><path d="M12 17v2.2"/>',
};
const d = p[name];
if (!d) return "";
return `<svg class="dg-ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
},
};
function fmtMoney(n) {
if (n === null || n === undefined) return "—";
const value = Number(n);
n = Number.isFinite(value) ? Math.round(value) : 0;
const neg = n < 0, a = Math.abs(n);
if (a >= 100000000) {
const yi = Math.floor(a / 100000000), wan = Math.floor((a % 100000000) / 10000);
return "¥" + (neg ? "-" : "") + yi + "亿" + (wan > 0 ? wan + "万" : "");
}
if (a >= 10000 && a % 10000 === 0) return "¥" + (neg ? "-" : "") + (a / 10000) + "万";
return "¥" + n.toLocaleString("zh-CN") + "元";
}
window.GameUI.formatMoney = fmtMoney;
function fmtMoney2(n) { return n > 0 ? "+" + fmtMoney(n) : fmtMoney(n); }
function fmt(n) { n = Math.round(Number(n) || 0); return n > 0 ? "+" + n : String(n); }
(function(ui){
if(!ui||ui._staffRaiseStatusUI)return;ui._staffRaiseStatusUI=true;
const detail=ui.omTeamDetail;
ui.omTeamDetail=function(){
const html=detail.apply(this,arguments),api=window.StaffRaiseEvents;
if(!api||!this.core||!this.core.state)return html;
const employee=(this.core.state.engineers||[]).find(e=>e.id===this._teamPick),status=api.status(this.core,employee);
if(!status.active)return html;
const label='<div class="recruit-detail-tags" data-staff-raise-penalty><span class="recruit-detail-tag">薪酬失落 · 产出 -'+Math.round((1-status.mul)*100)+'% · 剩余 '+status.weeksLeft+' 周（涨薪可解除）</span></div>';
return html.replace('<div class="dii-title">当前状态</div>','<div class="dii-title">当前状态</div>'+label);
};
})(window.GameUI);
