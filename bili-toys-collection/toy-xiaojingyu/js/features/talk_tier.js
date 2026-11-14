
(function () {
"use strict";
const ui = window.GameUI, core = window.GameCore;
if (!ui || !core || ui.__talkTier) return;
ui.__talkTier = true;
const LOADING = {
"V1.5": ["这题有点超纲……我的专家还在加载，等他上线再答你。", "我会说话啦，就是知识还没装全，再给我几天？", "嗯……这个得先问问专家，他还没到岗。"],
"V2": ["你刚才说什么来着？长文记忆还在加载……", "我的记性暂时还跟金鱼差不多，等记忆模块装好再考我。"],
"V2.5": ["文件太长了，我才看完开头……长文本功能还在装。", "这么多字，我能先只看标题吗？"],
"V3": ["让我想想……想不出来，思维链还没加载完。", "这题得一步步推，可我现在只会跳步骤。"],
"V3.5": ["让我想想……想不出来，思维链还没加载完。", "这题得一步步推，可我现在只会跳步骤。"],
"V4": ["工具还没接上，我现在只能动动嘴。", "这个得用工具才能做，Agent 能力还在加载中。"],
"V4.5": ["工具还没接上，我现在只能动动嘴。", "这个得用工具才能做，Agent 能力还在加载中。"]
};
const FALLBACK = ["新能力还在加载，等我再练练就能答上来。"];
const GAME_LOADING = ["做游戏得用上一堆工具，Agent 能力还在加载……再给我几周！"];
const verOf = (c) => ((c && c.state && c.state.ver) || "V1");
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const gibberish = (c, text) => {
const pool = (c && c.cfg && c.cfg.GIBBERISH) || [];
return typeof text === "string" && (pool.indexOf(text) >= 0 || /^咕嘎/.test(text));
};
ui.talkLoadingLine = function (ver) { return pick(LOADING[ver] || FALLBACK); };
ui.whaleCanTalk = function () {
const c = this.core;
if (!c || !c.state) return false;
return verOf(c) !== "V1" || typeof this.omTestTier !== "function" || this.omTestTier() !== "dumb";
};
const pickReply = core.c2PickReply;
if (typeof pickReply === "function") core.c2PickReply = function (o, tier) {
const reply = pickReply.apply(this, arguments);
if (tier === "full" || verOf(this) === "V1" || !reply || reply.id != null || !gibberish(this, reply.text)) return reply;
return { id: null, type: "text", text: ui.talkLoadingLine(verOf(this)), cond: null };
};
const testGame = ui.omTestGame;
if (typeof testGame === "function") ui.omTestGame = function () {
const g = testGame.apply(this, arguments);
if (!g || verOf(this.core) === "V1" || (g.bad && !gibberish(this.core, g.bad))) return g;
return Object.assign({}, g, { bad: pick(GAME_LOADING) });
};
})();
