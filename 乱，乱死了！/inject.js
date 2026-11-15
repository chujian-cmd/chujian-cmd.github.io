const fs = require('fs');
const path = require('path');

const ROOT = '/storage/emulated/0/html存放地';
const HTML = path.join(ROOT, '个人主页.min.html');
const MANIFEST = path.join(ROOT, 'manifest.js');

let html = fs.readFileSync(HTML, 'utf8');
const manifestJs = fs.readFileSync(MANIFEST, 'utf8');
const data = manifestJs.replace(/^window\.__MANIFEST__=/, '').replace(/;\s*$/, '');

// 只匹配“包含 type:"file" 或 type:"folder" 的那个 const a=[...]”
// 用懒惰匹配找到 ]; 结束；用 anchor 保证是 manifest 数据段
const re = /const a=\[(?=[^;]{0,200}"type":"(file|folder)")[\s\S]*?\];/;

const m = html.match(re);
if (!m) {
  console.error('没找到 manifest 数据段');
  process.exit(1);
}
console.log('匹配到长度：' + m[0].length + ' 字节');

html = html.replace(re, 'const a=' + data + ';');
fs.writeFileSync(HTML, html);
console.log('注入完成');
