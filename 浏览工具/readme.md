文本浏览工具 · 项目文档

一、项目简介

一套纯前端（HTML + Canvas 无关，纯 DOM）的大文本文件分页浏览器。核心是：用户选一个本地文件，工具按 1MB 分块扫描换行符建立行偏移索引，之后按页码用 Blob.slice() 精确截取字节区间，避免把 550 万行一次性读进内存。

在这条主线上，10 个文件记录了从"能分页"到"能优雅阅读"的完整迭代：加字体（生僻字显示）、加缩放（三次修 bug）、加动画与竞态控制、最后扩展到图片/视频/PDF/HTML 内嵌/代码高亮/搜索。另有一份废弃分支（8 合 1 工具集），与主线无关。

技术栈：原生 HTML/CSS/JS，FileReader，Blob.slice，highlight.js。无构建，双击即可运行。

---

二、文件总览

主线是文本浏览器，按演进排序；末尾是废弃分支。

文件 阶段 核心变化
cc.html 基线 分页读取 + 行号，无字体定制，无缩放
china .html 加字体 花园明朝字体 + 缩放（px 计算字号/行高）
code_202604.30.html 缩放 bug lineHeight: 1.5 * scale（无单位，行距塌陷）
code_202604ff30.html 修行高 lineHeight: ${1.5*scale} 仍无 px，未彻底修
code_20260430.html 另一条路 改用 transform: scale()（模糊 + 溢出）
doubaoanddeepseek.html 回退 放弃缩放，仅保留花园明朝 + 分页
我去.html 强制字体 * { font-family: ... !important } 全局覆盖
yfrduffufuf.html 工程化 加载进度条、淡入动画、请求竞态控制、重置按钮
最终版本.html 终极版 多文件类型（图/视频/音频/PDF/HTML 内嵌）、搜索、统计、导出
垃圾勿看（已废弃）.html 废弃分支 8 合 1 工具集，与文本浏览无关

主线：cc.html → china .html → yfrduffufuf.html → 最终版本.html。中间四个"缩放实验"是试错记录，最终版本没带缩放，说明缩放不是核心需求。

---

三、核心机制

3.1 分页索引：1MB 分块扫换行

把大文件一次性读进来会爆内存，所以按块扫描，只记录每行起始字节偏移，不存内容。

```js
function buildLineIndex(file) {
  const chunkSize = 1024 * 1024;
  let offset = 0, remainder = '';
  lineOffsets = [0];
  function readChunk() {
    const end = Math.min(offset + chunkSize, file.size);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = remainder + ev.target.result;
      let pos;
      while ((pos = text.indexOf('\n', searchStart)) !== -1) {
        lineOffsets.push(offset + pos + 1);
      }
      // 关键：remainder 保留最后一段不完整的行，拼到下一块开头
      remainder = text.substring(searchStart);
      offset = end;
      offset < file.size ? readChunk() : onIndexDone();
    };
    reader.readAsText(file.slice(offset, end), 'UTF-8');
  }
  readChunk();
}
```

关键点：remainder 保存上一块末尾没换行的残段，拼到下一块开头再扫。否则跨块的行会被截断，\n 位置算错。

读某页时，只切 lineOffsets[startLine] 到 lineOffsets[endLine] 这段字节：

```js
const startOffset = lineOffsets[startLine];
const endOffset = endLine < lineOffsets.length
  ? lineOffsets[endLine] : currentFile.size;
const blob = currentFile.slice(startOffset, endOffset);
```

这套索引的代价是首次加载慢（要扫全文件），收益是翻页 O(1)。550 万行文件首次扫约 2–5 秒（取决于磁盘），之后任意页毫秒级。

3.2 花园明朝字体：为什么需要强制覆盖

花园明朝（HanaMin）是覆盖 CJK 扩展 B/C/D 区的开源字体，能显示其他字体缺字形的生僻字。但浏览器的字体继承规则是：pre 会继承 body 的 font-family，而用户系统的等宽字体（如 Consolas）优先级更高，导致生僻字显示成方块。

解法有三档，按强度递增：

文件 做法 效果
china .html body 和 pre 都写 font-family: '花园明朝', ... 部分生效，pre 内可能被覆盖
最终版本.html pre 和 pre code 都写 font-family: inherit 基本生效
我去.html * { font-family: ... !important } 全局强制 最强，但会污染按钮等控件

我去.html 的写法：

```css
body, div, p, span, pre, code, button, input,
pre *, #content * {
  font-family: '花园明朝', 'HanaMinB', 'HanaMinA',
               'Hanazono Mincho', monospace !important;
}
```

代价：按钮、页码输入框也被强制成衬线体，视觉上不统一。最终版本.html 选择了折中——只在 pre 里强制，控件保留系统字体。

3.3 缩放的三个坑（本项目的核心教学价值）

缩放看着简单，这批文件里有三种错误做法和一个正确做法。

坑 1：lineHeight 带单位/不带单位混用

```js
// code_202604.30.html
contentPre.style.lineHeight = `${1.5 * scale}`;  // ❌ 无单位
```

line-height 无单位时是倍数，1.5 * scale（如 scale=1.2）变成 1.8，是 1.8 倍行高，不是 1.8px。字号放大后行距塌陷，文字挤成一坨。

坑 2：只改字号不改行高

```js
// code_202604ff30.html
contentPre.style.fontSize = `${baseFontSize * scale}px`;  // ✅
contentPre.style.lineHeight = `${1.5 * scale}`;           // ❌ 还是无单位
```

字号对了，行高还是错的。

坑 3：transform: scale()

```js
// code_20260430.html
contentPre.style.transform = `scale(${scale})`;  // ❌
contentPre.style.transformOrigin = 'top left';
```

问题：① 文字被位图化，放大模糊；② 容器高度不变，缩放后文字溢出到容器外，滚动条失效；③ 排版不变（折行位置还是原字号），缩放后一行可能变成一个词。

正确做法（china .html / 最终版本.html）：

```js
const BASE_FONT_SIZE = 14;
const BASE_LINE_HEIGHT = 2.0;   // 倍数
contentPre.style.fontSize = `${BASE_FONT_SIZE * scale}px`;
contentPre.style.lineHeight = `${BASE_LINE_HEIGHT * scale}`;  // 保持倍数
```

字号用 px，行高用无单位倍数，两者同步缩放，排版比例不变。

3.4 请求竞态：快速翻页的覆盖问题

用户连点"下一页"5 次，会发出 5 个异步 FileReader 请求。先发的可能后返回，把新页面覆盖成旧页面。

yfrduffufuf.html 的解法是请求 ID 递增校验：

```js
let currentLoadId = 0;
function loadPage(page) {
  const requestId = ++currentLoadId;
  reader.onload = (ev) => {
    if (requestId !== currentLoadId) return;  // 过期请求直接丢弃
    contentPre.textContent = ...;
  };
}
```

currentLoadId 每发一个请求就 +1，回调时对比——只有最新一次的 ID 匹配才渲染，旧的静默丢弃。

这是异步 UI 的通用模式。凡是"用户操作触发异步 + 可能连点"的场景（搜索、翻页、Tab 切换），都应该加。

3.5 多文件类型分发（最终版本）

最终版本.html 不再假设输入是文本，用 detectFileType 按 MIME 和扩展名分流：

类型 判断依据 渲染方式
image mime.startsWith('image/') 或图片扩展名 objectURL + <img>
video mime.startsWith('video/') objectURL + <video controls>
audio mime.startsWith('audio/') objectURL + <audio controls>
pdf mime === 'application/pdf' readAsDataURL → <iframe src=base64>
html .html / .htm 弹窗确认后 iframe.srcdoc + sandbox
text 其余 分页 + 可选 highlight.js

PDF 纯离线：不引 pdf.js，直接把文件读成 base64 dataURL 塞进 <iframe>。浏览器内置 PDF 查看器接管渲染，零依赖。

HTML 内嵌：用 iframe.srcdoc 注入文件内容，加 sandbox：

```html
<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-modals">
```

⚠️ allow-scripts + allow-same-origin 同时开是危险的——iframe 内的脚本可以读父页面的 localStorage、调父页面函数。这里因为只在本机打开用户自己选的文件，风险可接受。若要做线上分享，必须去掉 allow-same-origin。

3.6 搜索高亮（最终版本）

用 TreeWalker 遍历文本节点，把匹配片段替换成 <span class="search-highlight">：

```js
const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
  acceptNode(node) {
    if (node.parentElement?.closest('.search-highlight')) return NodeFilter.FILTER_REJECT;
    return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
  }
});
```

维护 searchMatches 数组和 searchIndex 指针，↑/↓ 按钮移动 .current 类并 scrollIntoView。

清空搜索时要把 <span> 换回纯文本节点，否则多次搜索后 DOM 里堆满嵌套 span。

---

四、技术要点汇总

· remainder 是分块扫描的核心：不保留残段会导致跨块的行被截断，\n 位置全错。
· line-height 无单位 = 倍数：和 font-size 同步缩放时，行高必须保持无单位倍数，字号用 px。
· transform: scale() 不适合文本缩放：模糊 + 溢出 + 排版不变，三宗罪。
· 请求 ID 校验：异步 UI 的通用防覆盖手段，成本 2 行代码。
· FileReader 是异步的：buildLineIndex 的回调链天然串行，但要小心错误分支（reader.onerror）也要处理。
· Blob.slice() 不读内容：只标记区间，真正读是在 FileReader 里，所以索引阶段内存占用极低。
· 花园明朝是 CJK 扩展 B 的兜底字体：系统没装就 fallback 到 Noto Serif CJK，但生僻字可能仍显示方块。
· highlight.js 的 highlightElement 会改 DOM：重新渲染前必须先清空 codeBlock.innerHTML，否则重复高亮会嵌套。

---

五、目录结构建议

若整理成正式项目：

```
text-browser/
├── index.html              # 最终版本.html 重命名
├── css/
│   └── app.css             # 从内联抽出
├── js/
│   ├── indexer.js          # buildLineIndex + Blob.slice 分页
│   ├── font.js             # 花园明朝字体切换逻辑
│   ├── search.js           # TreeWalker 搜索高亮
│   ├── viewer/
│   │   ├── text.js         # 文本分页 + 高亮
│   │   ├── pdf.js          # base64 iframe
│   │   ├── media.js        # 图片/视频/音频
│   │   └── html-embed.js   # srcdoc iframe
│   └── app.js              # 初始化 + 事件绑定
└── legacy/                 # 试错记录，留档
    ├── scale-bug-1.html    # code_202604.30.html
    ├── scale-bug-2.html    # code_20260430.html
    └── force-font.html     # 我去.html
```

当前单文件形态适合分发，上述结构适合二次开发。

---

六、使用说明

运行

双击任意 HTML 即可。无需服务器——FileReader 和 Blob 都在本地完成，不涉及跨域。

唯一注意：最终版本.html 的 PDF 预览依赖浏览器内置 PDF 查看器，Chrome/Edge/Safari 都支持，Firefox 部分版本可能显示下载提示。

首次上手

1. 点"选择文件"，选一个 .txt / .log / .md 或任意文件
2. 等索引扫描完成（大文件 2–5 秒）
3. 用首页/上一页/下一页/尾页或输入页码跳转
4. 每页行数可选 100 / 500 / 1000 / 5000
5. 最终版本.html 额外支持：搜索框输入关键词 → ↑/↓ 跳转；⬇ 导出 导出当前页为 txt

环境要求

· 现代浏览器（Chrome / Edge / Safari / Firefox 较新版）
· 花园明朝字体需用户系统已安装，否则 fallback 到 Noto Serif CJK（生僻字可能显示方块）
· 手机端可用，但 5000 行/页在低端机上滚动会卡

---

七、已知注意事项

1. 首次加载慢：550 万行文件首次扫描约 2–5 秒，进度条只在 yfrduffufuf.html 里有（updateFileInfoProgress）。最终版本.html 反而没进度条，大文件时用户以为卡死了。
2. 缩放功能在最终版被移除：中间四个文件试了三种缩放方案都不理想，最终版回到"无缩放"。若需要缩放，直接抄 china .html 的 px 方案。
3. lineHeight: ${1.5 * scale} 的坑：code_202604.30.html 和 code_202604ff30.html 都犯了。看这两份时别抄，抄 china .html。
4. HTML 内嵌的 sandbox 风险：allow-scripts + allow-same-origin 同时开，iframe 内脚本可访问父页面。只在本机打开自己选的文件时安全，线上分享必须去掉 allow-same-origin。
5. 垃圾勿看（已废弃）.html 与主线无关：那是 8 合 1 工具集（骰子/计数器/回文/颜色/计时器/计算器/抽奖/单位换算），和文本浏览没有代码复用关系，纯属混在同一批文件里。别把它当文本浏览器的变体。
6. transform: scale() 缩放会溢出：code_20260430.html 的写法会让文字超出 pre 容器，滚动条失效。这是 CSS transform 的固有行为，不是 bug。
7. 搜索高亮重复嵌套：连续搜索不同关键词时，如果没清空旧的 <span>，会嵌套。最终版本.html 的 performSearch 开头有清理逻辑，抄的时候别漏。

---

八、快速选择指南

你想… 用这个文件
直接能用的最终版 最终版本.html
看分页索引的最简实现 cc.html
要花园明朝 + 缩放 china .html
看缩放三种错误做法 code_202604.30.html / code_20260430.html
要加载进度条 + 竞态控制 yfrduffufuf.html
要强制全局字体 我去.html
看异步请求覆盖的坑 yfrduffufuf.html（currentLoadId）
学 HTML 内嵌运行 最终版本.html（embedHtmlInPage）
看 8 合 1 小工具 垃圾勿看（已废弃）.html（与主线无关）

---

九、结语

这批文件的核心价值不在"最终版多强大"，而在中间那四个缩放实验——它们完整记录了"改字号不改行高 → 改行高但单位错 → 换 transform → 发现 transform 也不行"的试错全过程。这种失败记录比正确代码更有教学意义。

读法建议：

· 只想用 → 最终版本.html
· 想理解分页 → cc.html 看 60 行核心代码
· 想理解异步坑 → yfrduffufuf.html 的 currentLoadId
· 想理解 CSS 缩放坑 → 按 code_202604.30 → code_20260430 → china .html 顺序读

若只能读两份：cc.html（分页机制）+ 最终版本.html（多类型分发），覆盖了 90% 的知识点。