// 生成 pinyin.js：把词库中出现的所有汉字映射到其全部拼音（去声调）。
// 用法：设置环境变量 WORDLE_PINYIN_DATA 指向 mozillazg/pinyin-data 的 pinyin.txt，然后
//   node tools/gen-pinyin.js
const fs = require("fs");
const path = require("path");
const { WORDS } = require("../words.js");

const DATA_FILE = process.env.WORDLE_PINYIN_DATA;
if (!DATA_FILE || !fs.existsSync(DATA_FILE)) {
  console.error("请先设置 WORDLE_PINYIN_DATA 指向 pinyin.txt");
  process.exit(1);
}

// 去掉声调符号，ü 统一转成 v
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

// 解析 pinyin.txt：U+XXXX: py1,py2  # 字
const raw = fs.readFileSync(DATA_FILE, "utf8");
const allReadings = new Map(); // char -> Set(pinyin)
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^U\+([0-9A-Fa-f]+):\s*([^#]+)/);
  if (!m) continue;
  const ch = String.fromCodePoint(parseInt(m[1], 16));
  const pys = m[2]
    .split(",")
    .map((s) => stripTone(s.trim()))
    .filter(Boolean);
  if (!allReadings.has(ch)) allReadings.set(ch, new Set());
  for (const py of pys) allReadings.get(ch).add(py);
}

const chars = [...new Set(WORDS.join(""))];
const map = {};

for (const ch of chars) {
  map[ch] = allReadings.has(ch) ? [...allReadings.get(ch)] : [];
}

const missing = chars.filter((c) => !map[c] || map[c].length === 0);
if (missing.length) {
  console.error("缺少拼音的汉字：", missing.map((c) => c + " U+" + c.codePointAt(0).toString(16)));
  process.exit(1);
}

const header =
  "// 自动生成：字符 -> 拼音列表（拼音选字用）。\n" +
  "// 生成方式见 tools/gen-pinyin.js（数据来源：mozillazg/pinyin-data）\n";
const body =
  "const PINYIN_MAP = " +
  JSON.stringify(map) +
  ";\n\nif (typeof module !== \"undefined\") { module.exports = { PINYIN_MAP }; }\n";

fs.writeFileSync(path.join(__dirname, "..", "pinyin.js"), header + body, "utf8");
console.log("生成完成：汉字", chars.length, "个，已写入 pinyin.js");
