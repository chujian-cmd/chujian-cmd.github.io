// 历史版核心逻辑测试：node _legacy/tools/test-history.js
"use strict";

const fs = require("fs");
const html = fs.readFileSync("D:/Firefox/Network/history-wordle/index.html", "utf8");

const entries = JSON.parse(
  html.match(/<script>const HISTORY_ENTRIES = (\[.*?\]);\n?if \(typeof module !== "undefined"\) \{ module\.exports = \{ HISTORY_ENTRIES \}; \}<\/script>/s)[1]
);
globalThis.HISTORY_ENTRIES = entries;

const script = html
  .match(/<script>\/\/ 汉字 Wordle —— 游戏逻辑[\s\S]*?<\/script>/)[0]
  .replace(/<\/?script>/g, "");
const mod = { exports: {} };
new Function("module", "exports", script)(mod, mod.exports);
const g = mod.exports;

const PINYIN_MAP = JSON.parse(html.match(/<script>const PINYIN_MAP = (.*?);<\/script>/s)[1]);
const PINYIN_TONE = JSON.parse(html.match(/<script>const PINYIN_TONE = (.*?);<\/script>/s)[1]);
const CHAR_STROKES = JSON.parse(html.match(/<script>const CHAR_STROKES = (.*?);<\/script>/s)[1]);

let pass = 0;
let fail = 0;
function eq(name, a, e) {
  const ja = JSON.stringify(a);
  const je = JSON.stringify(e);
  if (ja === je) {
    pass++;
  } else {
    fail++;
    console.log("FAIL", name, ja, "!=", je);
  }
}

const nine = "中华人民共和国成立";
eq("九字全对", g.evaluate(nine, nine), Array(9).fill("correct"));
eq("九字全灰", g.evaluate("非洲蚂蚁打架", nine), Array(9).fill("absent"));
eq("二字全对", g.evaluate("孔子", "孔子"), ["correct", "correct"]);
eq("混色", g.evaluate("中国成立", nine), ["correct", "present", "present", "present", "absent", "absent", "absent", "absent", "absent"]);
eq("重复字", g.evaluate("成立成立", "成立成立"), ["correct", "correct", "correct", "correct"]);
eq("完全错位", g.evaluate("成立国共", "国共成立"), ["present", "present", "present", "present"]);

const daily = g.pickDaily();
console.log("daily entry:", JSON.stringify(daily));
eq("每日题在题库", entries.some((e) => e[0] === daily[0] && e[1] === daily[1]), true);

const badClues = entries.filter((e) => !e[2] || e[2].length !== 5 || e[2].some((c) => !c || !c.trim()));
eq("全部条目有5条线索", badClues.length, 0);
const people = entries.filter((e) => e[1].includes("人物"));
const badC1 = people.filter((e) => !/^(古代|现代)·(男|女)·(真实|虚构)$/.test(e[2][0]));
eq("人物线索1格式", badC1.length, 0);
const events = entries.filter((e) => e[1].includes("事件"));
const badE1 = events.filter((e) => e[2][0].length < 2);
eq("事件线索1非空", badE1.length, 0);

const chars = [...new Set(entries.map((e) => e[0]).join(""))];
eq("无缺拼音", chars.filter((c) => !PINYIN_MAP[c]).length, 0);
eq("无缺声调", chars.filter((c) => !PINYIN_TONE[c]).length, 0);
eq("无缺笔画", chars.filter((c) => !CHAR_STROKES[c]).length, 0);

const maxLen = Math.max(...entries.map((e) => e[0].length));
console.log("条目数:", entries.length, "最长:", maxLen, "字；字符集:", chars.length);
console.log("人物:", people.length, "事件:", events.length);
eq("不限字数（含≥6字）", maxLen >= 6, true);
eq("分类格式", /^(中国史|世界史)·(人物|事件)$/.test(daily[1]), true);
eq("样例线索-孔子", JSON.stringify(entries.find((e) => e[0] === "孔子")[2]), JSON.stringify(["古代·男·真实", "思想家、教育家，儒家创始人", "《论语》，“己所不欲勿施于人”", "春秋鲁国人，尊称至圣先师", "春秋鲁国人，姓孔名丘，创立儒家学说，被尊为至圣先师。"]));
eq("事件最后线索为概括句", entries.filter((e) => e[1].includes("事件") && !e[2][4].endsWith("。")).length, 0);
eq("人物最后线索为概括句", entries.filter((e) => e[1].includes("人物") && !e[2][4].endsWith("。")).length, 0);

console.log("---", pass, "passed,", fail, "failed");
process.exit(fail ? 1 : 0);
