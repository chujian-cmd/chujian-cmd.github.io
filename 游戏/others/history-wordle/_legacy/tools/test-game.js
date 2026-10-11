// 核心逻辑测试：node tools/test-game.js
"use strict";

globalThis.WORDS = require("../words.js").WORDS;
const g = require("../game.js");
const { evaluate, hashStr, pickDaily, todayStr } = g;

let pass = 0;
let fail = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log("PASS", name);
  } else {
    fail++;
    console.log("FAIL", name, "=>", a, "expected", e);
  }
}

eq("全对", evaluate("苹果", "苹果"), ["correct", "correct"]);
eq("一字正确", evaluate("水果", "苹果"), ["absent", "correct"]);
eq("都不在", evaluate("天地", "苹果"), ["absent", "absent"]);
eq("重复字-正确位优先", evaluate("果果", "苹果"), ["absent", "correct"]);
eq("重复字-超量", evaluate("果果", "果瓜"), ["correct", "absent"]);
eq("完全错位", evaluate("果苹", "苹果"), ["present", "present"]);
eq("妈妈类", evaluate("马妈", "妈妈"), ["absent", "correct"]);
eq("同字同答", evaluate("妈妈", "妈妈"), ["correct", "correct"]);
eq("hash 稳定", hashStr("2026-08-07") === hashStr("2026-08-07"), true);
eq("hash 不同日期不同", hashStr("2026-08-07") !== hashStr("2026-08-08"), true);

const w = pickDaily();
eq("每日题在词库中", WORDS.includes(w), true);
console.log("今日日期", todayStr(), "今日答案", w);

console.log("---", pass, "passed,", fail, "failed");
process.exit(fail ? 1 : 0);
