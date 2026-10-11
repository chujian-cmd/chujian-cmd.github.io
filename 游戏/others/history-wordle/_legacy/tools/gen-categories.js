// 生成 WORD_CATEGORIES：按词库注释段落为每个词标注分类，注入 index.html。
// 用法：node _legacy/tools/gen-categories.js
"use strict";

const fs = require("fs");
const idx = "D:/Firefox/Network/history-wordle/index.html";
const src = fs.readFileSync("D:/Firefox/Network/history-wordle/_legacy/words.js", "utf8");

const SECTION_LABELS = {
  "生活": "生活用品",
  "食物": "食物",
  "动物": "动物",
  "自然": "自然",
  "人体": "身体部位",
  "情感品质": "情绪或品质",
  "学习工作": "学习或工作",
  "时间": "时间",
  "国家城市": "地名",
  "人物关系": "人物称呼",
  "常用动词": "日常动作",
  "常用形容词": "形容描述",
};

// 细分：水果、蔬菜
const FRUITS = new Set(["苹果", "香蕉", "橘子", "葡萄", "西瓜", "草莓", "芒果", "菠萝", "桃子", "梨子", "樱桃", "柠檬"]);
const VEGGIES = new Set(["白菜", "萝卜", "土豆", "番茄", "黄瓜", "茄子", "辣椒", "洋葱", "大蒜", "生姜", "竹笋", "木耳", "蘑菇"]);

const cats = {};
let current = null;

for (const line of src.split(/\r?\n/)) {
  const m = line.match(/^\s*\/\/\s*(.+?)\s*$/);
  if (m) {
    const name = m[1];
    current = SECTION_LABELS[name] || null;
    continue;
  }
  if (!current) continue;
  const words = line.match(/"([^"]+)"/g) || [];
  for (const w of words) {
    const word = w.slice(1, -1);
    if (!/^[\u4e00-\u9fff]{2}$/.test(word)) continue;
    if (current === "食物" && FRUITS.has(word)) cats[word] = "水果";
    else if (current === "食物" && VEGGIES.has(word)) cats[word] = "蔬菜";
    else cats[word] = current;
  }
}

const words = require("D:/Firefox/Network/history-wordle/_legacy/words.js").WORDS;
const missing = words.filter((w) => !cats[w]);
if (missing.length) {
  console.error("缺少分类：", missing.join(" "));
  process.exit(1);
}

let html = fs.readFileSync(idx, "utf8");
if (!html.includes("/*__WORD_CATEGORIES__*/")) throw new Error("marker missing");
html = html.replace("/*__WORD_CATEGORIES__*/", JSON.stringify(cats));
fs.writeFileSync(idx, html, "utf8");

console.log("注入完成，词数：", Object.keys(cats).length);
console.log("样例：苹果=" + cats["苹果"] + " 手机=" + cats["手机"] + " 记忆=" + cats["记忆"]);
