// 重建历史版单文件数据：
// 1. 合并 index.html 内嵌题库 与 _legacy/history.js 题库（格式统一为 [名称, "中国史·人物" 等]）
// 2. 依据合并后的字符集重新生成 PINYIN_MAP / PINYIN_TONE / CHAR_STROKES
// 3. 替换 index.html 中的数据块，移除已废弃的 WORD_CATEGORIES
// 用法：node _legacy/tools/rebuild-history.js
"use strict";

const fs = require("fs");
const path = require("path");
const IDX = "D:/Firefox/Network/history-wordle/index.html";
const PINYIN_DATA = path.join(process.env.TEMP || "C:/Users/HP/AppData/Local/Temp", "pinyin-data.txt");
const CNCHAR_DIR = process.env.WORDLE_CNCHAR_DIR;

if (!CNCHAR_DIR) {
  console.error("请设置 WORDLE_CNCHAR_DIR 指向已安装 cnchar 的目录");
  process.exit(1);
}
const cnchar = require(CNCHAR_DIR + "/node_modules/cnchar");
const { CLUES } = require("D:/Firefox/Network/history-wordle/_legacy/clues.js");
const { SUMMARIES } = require("D:/Firefox/Network/history-wordle/_legacy/summaries.js");

const html = fs.readFileSync(IDX, "utf8");

// ---------- 1. 合并题库 ----------
const oldMatch = html.match(/<script>const HISTORY_ENTRIES = (\[.*?\]);\n?if \(typeof module !== "undefined"\) \{ module\.exports = \{ HISTORY_ENTRIES \}; \}<\/script>/s);
if (!oldMatch) throw new Error("未找到内嵌 HISTORY_ENTRIES");
const oldEntries = JSON.parse(oldMatch[1]);
const mine = require("D:/Firefox/Network/history-wordle/_legacy/history.js").HISTORY;

const map = new Map();
for (const e of oldEntries) map.set(e[0], e[1]);
for (const e of mine) {
  const name = e[0];
  if (!map.has(name)) {
    const cat = (e[1] === "中国" ? "中国史" : "世界史") + "·" + e[2];
    map.set(name, cat);
  }
}
const merged = [...map.entries()].map(([name, cat]) => {
  const clues = CLUES[name];
  if (!clues || clues.length !== 5 || clues.some((c) => !c || !c.trim())) {
    console.error("缺少线索：", name);
    process.exit(1);
  }
  const summary = SUMMARIES[name];
  if (!summary || !summary.trim()) {
    console.error("缺少一句话概括：", name);
    process.exit(1);
  }
  clues[4] = summary; // 第 5 条线索改为一句话概括
  return [name, cat, clues];
});

const orphans = Object.keys(CLUES).filter((name) => !map.has(name));
if (orphans.length) {
  console.error("线索库中有题库之外的条目：", orphans.join(" "));
  process.exit(1);
}

const bad = merged.filter((e) => !/^[\u4e00-\u9fff]{2,10}$/.test(e[0]));
if (bad.length) {
  console.error("非法条目：", JSON.stringify(bad));
  process.exit(1);
}
const lens = {};
for (const e of merged) lens[e[0].length] = (lens[e[0].length] || 0) + 1;
console.log("题库：", merged.length, "条；字数分布：", JSON.stringify(lens));

// ---------- 2. 拼音 / 声调 / 笔画 ----------
const chars = [...new Set(merged.map((e) => e[0]).join(""))];
const raw = fs.readFileSync(PINYIN_DATA, "utf8");
const toneData = new Map();
const plainData = new Map();
const TONE = {
  ā: "a", á: "a", ǎ: "a", à: "a",
  ē: "e", é: "e", ě: "e", è: "e",
  ī: "i", í: "i", ǐ: "i", ì: "i",
  ō: "o", ó: "o", ǒ: "o", ò: "o",
  ū: "u", ú: "u", ǔ: "u", ù: "u",
  ǖ: "v", ǘ: "v", ǚ: "v", ǜ: "v", ü: "v",
  ń: "n", ǹ: "n", ḿ: "m",
};
const strip = (s) => [...s].map((c) => TONE[c] || c).join("").toLowerCase();
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^U\+([0-9A-Fa-f]+):\s*([^#]+)/);
  if (!m) continue;
  const ch = String.fromCodePoint(parseInt(m[1], 16));
  if (!chars.includes(ch)) continue;
  const pys = m[2].split(",").map((s) => s.trim()).filter(Boolean);
  if (!toneData.has(ch)) toneData.set(ch, []);
  if (!plainData.has(ch)) plainData.set(ch, []);
  for (const py of pys) {
    if (!toneData.get(ch).includes(py)) toneData.get(ch).push(py);
    const plain = strip(py);
    if (!plainData.get(ch).includes(plain)) plainData.get(ch).push(plain);
  }
}
const pinyinMap = {};
const toneMap = {};
const strokesMap = {};
for (const ch of chars) {
  if (!plainData.has(ch) || !plainData.get(ch).length) throw new Error("缺少拼音：" + ch + " U+" + ch.codePointAt(0).toString(16));
  pinyinMap[ch] = plainData.get(ch);
  toneMap[ch] = toneData.get(ch);
  const n = cnchar.stroke(ch);
  if (typeof n !== "number" || n <= 0) throw new Error("缺少笔画：" + ch);
  strokesMap[ch] = n;
}

// ---------- 3. 替换数据块（在累计结果上依次替换） ----------
function replaceBlock(src, re, replacement) {
  if (!re.test(src)) throw new Error("数据块未匹配: " + re);
  return src.replace(re, replacement);
}

let out = html;
out = replaceBlock(out,
  /<script>const HISTORY_ENTRIES = \[.*?module\.exports = \{ HISTORY_ENTRIES \}; \}<\/script>/s,
  "<script>const HISTORY_ENTRIES = " + JSON.stringify(merged) + ";\n" +
    "if (typeof module !== \"undefined\") { module.exports = { HISTORY_ENTRIES }; }</script>"
);
out = replaceBlock(out,
  /<script>const PINYIN_MAP = .*?<\/script>/s,
  "<script>const PINYIN_MAP = " + JSON.stringify(pinyinMap) + ";</script>"
);
out = replaceBlock(out,
  /<script>const PINYIN_TONE = .*?<\/script>/s,
  "<script>const PINYIN_TONE = " + JSON.stringify(toneMap) + ";</script>"
);
out = replaceBlock(out,
  /<script>const CHAR_STROKES = .*?<\/script>/s,
  "<script>const CHAR_STROKES = " + JSON.stringify(strokesMap) + ";</script>"
);
out = out.replace(/<script>const WORD_CATEGORIES = .*?<\/script>\n?/s, "");

fs.writeFileSync(IDX, out, "utf8");
console.log("重建完成：字符", chars.length, "个；index.html", Buffer.byteLength(out, "utf8"), "字节");
