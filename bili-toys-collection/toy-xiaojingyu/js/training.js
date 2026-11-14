
"use strict";
const Training = {
el: null,
_shown: false,
init() {
this.el = document.getElementById("training");
const btn = document.getElementById("btn-train");
btn.addEventListener("click", () => { SFX.play("ui"); this.open(); });
document.addEventListener("click", (e) => {
if (e.target.closest("#train-close")) { SFX.play("click"); this.close(); }
else if (e.target.closest("#train-help")) {
SFX.play("click");
if (window.GameUI && window.GameUI.core && window.GameUI.core.state) GameUI.openHelp();
else this.openPop("train-help-pop");
}
else if (e.target.closest("#train-menu")) { SFX.play("click"); this.openPop("train-menu-pop"); }
});
document.getElementById("train-restart").addEventListener("click", () => { SFX.play("click"); this.restartGame(); });
document.querySelectorAll(".pop-btn[data-close]").forEach((b) => {
b.addEventListener("click", () => { SFX.play("click"); this.closePop(b.dataset.close); });
});
document.querySelectorAll(".train-pop").forEach((p) => {
p.addEventListener("click", (e) => { if (e.target === p) this.closePop(p.id); });
});
document.getElementById("vol-music").addEventListener("input", (e) => this.setMusic(+e.target.value));
document.getElementById("vol-sfx").addEventListener("input", (e) => this.setSfx(+e.target.value));
if (window.ToyCloud) {
try { window.ToyCloud.init(); } catch (e) {}
}
},
setMusic(v) { if (window.AudioMgr) AudioMgr.setMusicVolume(v); },
setSfx(v) { if (window.SFX) SFX.setVolume(v); },
ensureBgm() {
const m = window.AudioMgr;
if (!m) return;
m.resume();
if (m.cur) return;
fetch("./data/bgm_config.json", { cache: "no-store" })
.then((r) => (r.ok ? r.json() : {}))
.then((cfg) => {
const u = (cfg && cfg.scene) || "";
if (u && !m.cur) m.playBgm(u);
}).catch(() => {});
},
restartGame() {
if (!window.GameCore || !window.GameUI || !window.GameUI.el) return;
window.GameUI.askConfirm("重新开始训练？", "将清空当前训练进度（含自动存档），重新回到初始招募阶段。", () => {
if (window.GameSave) window.GameSave.remove("auto");
window.GameCore.newGame();
window.GameUI.render();
this.closePop("train-menu-pop");
}, { danger: true, okText: "重新开始" });
},
open() {
if (this._shown) return;
this._shown = true;
this.el = this.el || document.getElementById("training");
this.el.hidden = false;
this.closePop("train-help-pop");
this.closePop("train-menu-pop");
const vm = document.getElementById("vol-music");
const vs = document.getElementById("vol-sfx");
try {
if (vm) vm.value = String(parseFloat(localStorage.getItem("whale_music_vol") || "0.6"));
if (vs) vs.value = String(parseFloat(localStorage.getItem("whale_sfx_vol") || "0.9"));
} catch (e) {}
this.launchDevGame();
this.ensureBgm();
},
async launchDevGame() {
if (!window.GameUI || !window.GameCore) return;
const dev = document.getElementById("devgame");
const body = document.getElementById("train-body");
if (dev) dev.hidden = false;
if (body) body.hidden = true;
try {
await GameCfg.loadExternal();
GameUI.init(GameCore, GameSave);
GameCore.init(GameCfg);
GameUI.launch();
} catch (e) {
console.error("[Training] 玩法启动失败:", e);
}
},
close() {
if (!this._shown) return;
this._shown = false;
this.el.hidden = true;
const dev = document.getElementById("devgame");
if (dev) dev.hidden = true;
},
openPop(id) {
const p = document.getElementById(id);
if (p) p.hidden = false;
},
closePop(id) {
const p = document.getElementById(id);
if (p) p.hidden = true;
},
};
window.Training = Training;
