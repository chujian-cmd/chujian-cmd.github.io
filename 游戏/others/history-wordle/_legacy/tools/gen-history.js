// 历史 Wordle 数据生成：把 history.js 题库与拼音/笔画数据注入 index.html。
// 环境变量：
//   WORDLE_PINYIN_DATA  -> pinyin-data.txt 路径
//   WORDLE_CNCHAR_DIR   -> 装有 cnchar 的目录
// 用法：node _legacy/tools/gen-history.js
"use strict";

const fs = require("fs");
const idx = "D:/Firefox/Network/history-wordle/index.html";
const { HISTORY_ENTRIES } = require("../history.js");

// ---------- 校验题库 ----------
const seen = new Set();
const bad = [];
for (const [t, c] of HISTORY_ENTRIES) {
  if (!/^[\u4e00-\u9fff]{2,4}$/.test(t)) bad.push(t + "（长度或字符异常）");
  if (seen.has(t)) bad.push(t + "（重复）");
  seen.add(t);
  if (!/^(中国史|世界史)·(人物|事件)$/.test(c)) bad.push(t + "（分类异常）");
}
if (bad.length) {
  console.error("题库问题：", bad.join("；"));
  process.exit(1);
}
console.log("题库：", HISTORY_ENTRIES.length, "条");

const chars = [...new Set(HISTORY_ENTRIES.map((e) => e[0]).join(""))];
console.log("涉及汉字：", chars.length, "个");

// ---------- 拼音（声调版 + 无声调版） ----------
const DATA_FILE = process.env.WORDLE_PINYIN_DATA;
if (!DATA_FILE || !fs.existsSync(DATA_FILE)) {
  console.error("请设置 WORDLE_PINYIN_DATA");
  process.exit(1);
}
const TONE = {
  ā: "a", á: "a", ǎ: "a", à: "a",
  ē: "e", é: "e", ě: "e", è: "e",
  ī: "i", í: "i", ǐ: "i", ì: "i",
  ō: "o", ó: "o", ǒ: "o", ò: "o",
  ū: "u", ú: "u", ǔ: "u", ù: "u",
  ǖ: "v", ǘ: "v", ǚ: "v", ǜ: "v", ü: "v",
  ń: "n", ǹ: "n", ḿ: "m",
};
const stripTone = (s) => [...s].map((c) => TONE[c] || c).join("").toLowerCase();

const raw = fs.readFileSync(DATA_FILE, "utf8");
const allTone = new Map();
const allPlain = new Map();
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^U\+([0-9A-Fa-f]+):\s*([^#]+)/);
  if (!m) continue;
  const ch = String.fromCodePoint(parseInt(m[1], 16));
  if (!chars.includes(ch)) continue;
  const pys = m[2].split(",").map((s) => s.trim()).filter(Boolean);
  if (!allTone.has(ch)) allTone.set(ch, []);
  if (!allPlain.has(ch)) allPlain.set(ch, []);
  for (const py of pys) {
    if (!allTone.get(ch).includes(py)) allTone.get(ch).push(py);
    const plain = stripTone(py);
    if (!allPlain.get(ch).includes(plain)) allPlain.get(ch).push(plain);
  }
}

// ---------- 笔画 ----------
const cnchar = require(process.env.WORDLE_CNCHAR_DIR + "/node_modules/cnchar");

const toneMap = {};
const plainMap = {};
const strokeMap = {};
const missingPy = [];
const missingSt = [];
for (const ch of chars) {
  if (allTone.has(ch)) {
    toneMap[ch] = allTone.get(ch);
    plainMap[ch] = allPlain.get(ch);
  } else {
    missingPy.push(ch);
  }
  const n = cnchar.stroke(ch);
  if (typeof n === "number" && n > 0) strokeMap[ch] = n;
  else missingSt.push(ch);
}
if (missingPy.length || missingSt.length) {
  console.error("缺拼音：", missingPy.join(""), "缺笔画：", missingSt.join(""));
  process.exit(1);
}

// ---------- 替换脚本块 ----------
function replaceBlock(html, marker, inner) {
  const start = html.indexOf(marker);
  if (start < 0) throw new Error("找不到标记：" + marker);
  const tagStart = html.lastIndexOf("<script>", start);
  if (tagStart < 0) throw new Error("找不到 script 开始：" + marker);
  const tagEnd = html.indexOf("</script>", start);
  if (tagEnd < 0) throw new Error("找不到 script 结束：" + marker);
  return html.slice(0, tagStart) + "<script>" + inner + "</script>" + html.slice(tagEnd + "</script>".length);
}

let html = fs.readFileSync(idx, "utf8");
html = replaceBlock(
  html,
  "const RAW_WORDS",
  'const HISTORY_ENTRIES = ' +
    JSON.stringify(HISTORY_ENTRIES) +
    ';\nif (typeof module !== "undefined") { module.exports = { HISTORY_ENTRIES }; }'
);
html = replaceBlock(html, "const PINYIN_MAP", "const PINYIN_MAP = " + JSON.stringify(plainMap) + ";");
html = replaceBlock(html, "const PINYIN_TONE", "const PINYIN_TONE = " + JSON.stringify(toneMap) + ";");
html = replaceBlock(html, "const CHAR_STROKES", "const CHAR_STROKES = " + JSON.stringify(strokeMap) + ";");
html = replaceBlock(html, "const WORD_CATEGORIES", "const WORD_CATEGORIES = {};");
fs.writeFileSync(idx, html, "utf8");

console.log("注入完成。样例：秦始皇 拼音 " + JSON.stringify(plainMap["秦始皇"[1]]) + " 声调 " + JSON.stringify(toneMap["秦始皇"[1]]) + " 笔画 " + strokeMap["秦始皇"[1]]);
console.log("index.html 大小：", Buffer.byteLength(html, "utf8"));
