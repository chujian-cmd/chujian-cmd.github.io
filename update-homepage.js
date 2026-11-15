// 个人主页清单自动生成器（双环境版）
// - 放到仓库/ html存放地 根目录，运行 `node update-homepage.js`
// - 扫描本目录所有 .html，按网页 <title> 生成显示名，替换进 index.html 的 DIR_MANIFEST
// - GitHub Actions 会在每次推送后自动运行它；本地手动跑也可以
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const HTML = path.join(ROOT, 'index.html');
const SKIP_DIRS = /^(node_modules|\.git|__pycache__|一些没有用的备份（bak）)$/;

function getTitle(abs) {
  try {
    const fd = fs.openSync(abs, 'r');
    const buf = Buffer.alloc(65536);
    const n = fs.readSync(fd, buf, 0, 65536, 0);
    fs.closeSync(fd);
    const m = buf.slice(0, n).toString('utf8').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!m) return '';
    let t = m[1].replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim();
    if (t.length > 80) t = t.slice(0, 80) + '…';
    return t;
  } catch (e) { return ''; }
}
function displayName(name, abs) {
  if (/^index\.html?$/i.test(name)) return getTitle(abs) || name;
  const b = name.match(/^(.*) \((\d+)\)(\.html?)$/i);
  if (b) { const t = getTitle(abs); if (t) return t + ' (' + b[2] + ')'; }
  return name;
}

function walk(dir, base = '') {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { return out; }
  entries.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.test(e.name)) continue;
      const children = walk(abs, rel);
      if (children.length) out.push({ type: 'folder', name: e.name, path: rel + '/', desc: '', children });
    } else if (/\.html?$/i.test(e.name) && !/\.bak$/i.test(e.name)) {
      out.push({ type: 'file', name: displayName(e.name, abs), path: rel, desc: '' });
    }
  }
  return out;
}

function collectDesc(nodes, map) {
  for (const n of nodes) {
    if (n.desc) map[n.path] = n.desc;
    if (n.type === 'folder' && n.children) collectDesc(n.children, map);
  }
}
function applyDesc(nodes, map) {
  for (const n of nodes) {
    if (map[n.path]) n.desc = map[n.path];
    if (n.type === 'folder') applyDesc(n.children, map);
  }
}

const html = fs.readFileSync(HTML, 'utf8');
const ki = html.indexOf('const DIR_MANIFEST');
if (ki < 0) { console.error('找不到 DIR_MANIFEST，没改动'); process.exit(1); }
const start = html.indexOf('[', ki);
let depth = 0, j = start, q = null, esc = false;
for (; j < html.length; j++) {
  const c = html[j];
  if (q) {
    if (esc) esc = false;
    else if (c === '\\') esc = true;
    else if (c === q) q = null;
  } else {
    if (c === '"' || c === "'") q = c;
    else if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) break; }
  }
}
const descMap = {};
collectDesc(eval(html.slice(start, j + 1)), descMap);
const tree = walk(ROOT);
applyDesc(tree, descMap);
fs.writeFileSync(HTML, html.slice(0, start) + JSON.stringify(tree) + html.slice(j + 1));
function cnt(ns){let f=0,d=0;for(const n of ns){if(n.type==='folder'){d++;const[a,b]=cnt(n.children);f+=a;d+=b}else f++}return[f,d]}
const [tf, td] = cnt(tree);
console.log('主页清单已更新：共 ' + td + ' 个文件夹 / ' + tf + ' 个文件');
