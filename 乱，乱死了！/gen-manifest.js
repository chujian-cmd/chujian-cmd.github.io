const fs = require('fs');
const path = require('path');

const ROOT = '/storage/emulated/0/html存放地';
const OUT  = path.join(ROOT, 'manifest.js');

const SKIP_DIRS = /^(node_modules|\.git|__pycache__|一些没有用的备份（bak）)$/;

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
      if (children.length) {
        out.push({ type: 'folder', name: e.name, path: rel + '/', desc: '', children });
      }
    } else {
      if (/\.(html?|htm)$/i.test(e.name) && !/\.bak$/i.test(e.name)) {
        out.push({ type: 'file', name: e.name, path: rel, desc: '' });
      }
    }
  }
  return out;
}

const tree = walk(ROOT);
fs.writeFileSync(OUT, 'window.__MANIFEST__=' + JSON.stringify(tree) + ';\n');

function countFiles(n){let c=0;for(const x of n){if(x.type==='folder')c+=countFiles(x.children);else c++;}return c;}
function countFolders(n){let c=0;for(const x of n){if(x.type==='folder'){c++;c+=countFolders(x.children);}}return c;}

console.log('生成完成：' + OUT);
console.log('文件数：' + countFiles(tree) + '，文件夹数：' + countFolders(tree));
