// 端到端验收：用本机 Edge/Chrome 无头模式打开页面，真实操作并截图。
// 用法：
//   $env:WORDLE_PW_DIR = "<playwright-core 安装目录>"
//   $env:WORDLE_BROWSER = "<Edge 或 Chrome 可执行文件路径>"
//   $env:WORDLE_SHOT_DIR = "<截图输出目录>"
//   node tools/e2e-test.js
"use strict";

const { chromium } = require(process.env.WORDLE_PW_DIR + "/node_modules/playwright-core");
const path = require("path");
const os = require("os");

globalThis.WORDS = require("../words.js").WORDS;
const g = require("../game.js");
const PINYIN = require("../pinyin.js").PINYIN_MAP;

const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const EXE = process.env.WORDLE_BROWSER || EDGE;
const SHOT_DIR = process.env.WORDLE_SHOT_DIR || os.tmpdir();
const VW = parseInt(process.env.WORDLE_VW || "500", 10);
const VH = parseInt(process.env.WORDLE_VH || "920", 10);
const PAGE_URL = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");

const answer = g.pickDaily();
console.log("今日答案：", answer);

async function fillTyper(page, text) {
  await page.evaluate((word) => {
    const t = document.querySelector("#typer");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(t, word);
    t.dispatchEvent(new Event("input", { bubbles: true }));
  }, text);
}

async function typeWord(page, word) {
  for (const ch of word) {
    const pys = PINYIN[ch];
    if (!pys || !pys.length) throw new Error("缺少拼音：" + ch);
    for (const letter of pys[0]) {
      await page.click('.py-key[aria-label="' + letter + '"]');
    }
    await page.waitForSelector('.cand:text-is("' + ch + '")', { timeout: 3000 });
    await page.click('.cand:text-is("' + ch + '")');
  }
  await page.click("#btn-enter");
  await page.waitForTimeout(1400);
}

async function boardText(page) {
  const rows = await page.$$eval(".row", (rows) =>
    rows.map((r) => Array.from(r.querySelectorAll(".cell")).map((c) => c.textContent.trim()).join(""))
  );
  return rows.filter((r) => r).join(" | ");
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });

  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });

  await page.goto(PAGE_URL);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  const hOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (hOverflow > 1) errors.push("横向溢出 " + hOverflow + "px");
  await page.screenshot({ path: path.join(SHOT_DIR, "01-initial.png") });

  const wrong = require("../words.js").WORDS.find((w) => w !== answer);
  await typeWord(page, wrong);
  console.log("第一猜（错误）：", wrong);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(SHOT_DIR, "02-after-wrong-guess.png") });

  await typeWord(page, answer);
  console.log("第二猜（答案）：", answer);

  await page.waitForSelector("#modal-stats:not(.hidden)", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(SHOT_DIR, "03-win.png") });

  const msg = await page.textContent("#message");
  const stats = await page.textContent("#st-played");
  const grid = await boardText(page);
  console.log("消息：", msg.trim());
  console.log("总局数：", stats.trim());
  console.log("棋盘：", grid);
  console.log("错误：", errors.length ? errors : "无");

  // ---------- 阶段 B：直接输入路径 + 退格 + 缺字报错 ----------
  await page.click("#btn-stats-close");
  await page.waitForTimeout(200);
  await page.click("#btn-random");
  await page.waitForTimeout(300);
  await fillTyper(page, "好");
  await page.click("#btn-enter");
  await page.waitForTimeout(250);
  const errMsg = (await page.textContent("#message")).trim();
  if (!errMsg.includes("还差一个字")) {
    errors.push("缺字提示错误: " + errMsg);
  } else {
    console.log("缺字报错：", errMsg);
  }

  await fillTyper(page, "人");
  await page.click("#btn-backspace");
  await page.waitForTimeout(150);
  const secondCell = await page.$eval('.row[data-row="0"] .cell:nth-child(2)', (el) => el.textContent.trim());
  if (secondCell !== "") errors.push("退格未删除第二个字");
  else console.log("退格正常");

  await fillTyper(page, "事");
  await page.click("#btn-enter");
  await page.waitForTimeout(1500);
  const rowStates = await page.$$eval('.row[data-row="0"] .cell', (els) =>
    els.map((e) => (e.className.match(/state-\w+/) || [""])[0])
  );
  if (rowStates.some((s) => !s)) errors.push("直接输入后格子未着色: " + JSON.stringify(rowStates));
  else console.log("直接输入并着色：", rowStates.join(" "));

  // ---------- 阶段 C：连续猜错 6 次 → 失败流程 ----------
  await page.click("#btn-random");
  await page.waitForTimeout(300);
  for (let i = 0; i < 6; i++) {
    await fillTyper(page, "天地");
    await page.click("#btn-enter");
    await page.waitForTimeout(1350);
  }
  await page.waitForSelector("#modal-stats:not(.hidden)", { timeout: 6000 });
  const loseText = (await page.textContent("#stats-result")).trim();
  console.log("失败提示：", loseText);
  if (!loseText.includes("未猜中") || !loseText.includes("答案")) {
    errors.push("失败流程提示异常: " + loseText);
  }

  console.log("最终错误：", errors.length ? errors : "无");
  await browser.close();
  if (errors.length) process.exit(1);
})();
