SVG 图标合集 · 项目文档

30 秒导航：直接用 (2).html——它是 (1).html 的超集（多 2 个分类、多约 80 个图标）。想加图标只改 DATA 对象；L() / F() 两个包装函数决定线性/实心风格。

---

一、项目简介

这是一个点击即复制源码的 SVG 图标展示页：纯静态单文件，无构建、无依赖、无后端。卡片网格展示图标，点击卡片把完整 <svg> 字符串写进剪贴板，供后续粘贴到其他项目。包含线性（stroke）和实心（fill）两种风格，覆盖几何、箭头、天气、UI、符号、社交、文件等场景。

技术栈：原生 HTML + CSS Grid + navigator.clipboard。

---

二、文件总览

文件 阶段 分类数 图标总数（约） 核心变化
(1).html 基线 9 112 完整可用的首版
(2).html 扩充（定型） 11 ~194 新增 media / device 两分类；每个分类都追加图标

关系判断：(2) 是 (1) 的超集。(2) 的 linear 前 27 个图标与 (1) 完全一致（仅插入 users、doc 两个），其后追加 14 个；其余分类同理。CSS 完全没变。

---

三、核心机制

3.1 数据结构

所有图标是 DATA 对象里的字符串数组，按 data-cat 分类：

```js
const DATA = {
  linear:  [ '<svg...>', ... ],   // 线性风格
  solid:   [ '<svg...>', ... ],   // 实心风格
  geo:     [ ... ],
  arrows:  [ ... ],
  weather: [ ... ],
  ui:      [ ... ],
  symbols: [ ... ],
  social:  [ ... ],
  files:   [ ... ],
  media:   [ ... ],   // (2) 新增
  device:  [ ... ],   // (2) 新增
};
```

每个字符串是完整的 <svg> 标签（含 viewBox 和 fill/stroke 属性），而不是内部 path。原因见 3.2。

3.2 包装函数（关键设计）

```js
// 线性风格：stroke 描边，fill 无
const L = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
     ${inner}
   </svg>`;

// 实心风格：fill 填充，无描边
const F = (inner) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
     ${inner}
   </svg>`;
```

为什么这样设计：图标数据只写 inner（path/circle/rect 这些子元素），外层 viewBox、fill、stroke 全部由 L() / F() 统一注入。新增图标时不用记属性细节；同时两种风格靠函数名切换，不必维护两套属性。

取舍：无法混用（比如想在线性图标里塞一个实心点），但项目里 solid 里的"甜甜圈"图标（F('<circle.../><circle fill="#fff"/>')）证明了局部覆盖仍可用——子元素写自己的 fill 属性即覆盖外层。

3.3 渲染流程

页面里每个 <section> 内有一个空的 .grid 容器：

```html
<section id="linear">
  <h2>线性</h2>
  <div class="grid" data-cat="linear"></div>
</section>
```

初始化时遍历所有 .grid，读 data-cat 取出对应数组，逐个 innerHTML 并绑定点击：

```js
document.querySelectorAll('.grid').forEach(grid => {
  const list = DATA[grid.dataset.cat] || [];
  list.forEach(svg => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = svg;
    div.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(svg);
        showToast('已复制 SVG');
      } catch (e) {
        showToast('复制失败，请手动选择');
      }
    });
    grid.appendChild(div);
  });
});
```

关键点：复制的就是 svg 这个完整字符串，不是 DOM 节点。用户粘贴出来是可直接放进 HTML 的源文本。

3.4 CSS 布局要点

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 12px;
}
.item {
  aspect-ratio: 1 / 1;   /* 卡片保持正方形 */
}
.item svg { pointer-events: none; }   /* 点击穿透到 .item */
```

属性 作用 如果去掉会怎样
auto-fill + minmax(88px, 1fr) 自动列数，手机上折成 3~4 列 固定列数会在窄屏溢出
aspect-ratio: 1/1 卡片等比 卡片高度随内容塌陷
svg { pointer-events: none } 点击落在 .item 上 点到 path 时 e.target 不是 .item，但 addEventListener 在 .item 上会冒泡，其实也能触发——这里只是为了 :hover 状态稳定

---

四、技术专题

4.1 「两个文件只差图标数据」

两个文件 100% 相同的部分：<style>、<header>、showToast()、document.querySelectorAll('.grid') 主循环、L() / F() 定义。

差异全在：

1. <nav> 多两个 <a>（#media、#device）
2. <body> 多两个 <section>
3. DATA 对象扩充

这意味着：想把 (1) 升级到 (2)，只需在 (1) 上做这三件事——DATA 直接整体替换即可。

4.2 clipboard API 的隐性失败

```js
await navigator.clipboard.writeText(svg);
```

以下场景会静默抛错或 reject：

场景 现象 原因
file:// 协议 部分 Firefox 拒绝 非安全上下文
非 HTTPS 的 http Chrome 拒绝 同上
用户拒绝剪贴板权限 reject Safari 会弹权限请求
无用户手势的调用 reject 浏览器要求用户交互

代码里用 try/catch + Toast 兜底，但「复制失败，请手动选择」这句话其实没什么用——因为 .item 上没有用户可选择的文本（innerHTML 渲染成 DOM 后 path 不可选中）。

⚠️ 反模式：当前兜底提示只告知失败，没有给可执行的替代路径。真要修的话，应该改成点击卡片时同时把源码展示在一个 <textarea> 里，或者 console.log(svg) 供用户复制。

4.3 为什么不用图标字体或 sprite

单文件分享、零依赖、点击即复制——这三个需求决定了内联 SVG 字符串是最优解。图标字体需要外部字体文件；sprite 需要一次网络请求。内联则"打开即用"。

代价：几百个图标全写在一个 HTML 里（约 30KB），不适合嵌入到已压缩的性能敏感页面。本项目的定位是"素材库"而不是"生产页面"。

---

五、独立/测试文件

无。两个文件都是完整可运行的产品页。

---

六、技术要点汇总

· 包装函数隔离属性：L() / F() 让"图标内容"和"渲染属性"解耦，新增图标不用想 stroke/fill。
· data-cat 驱动渲染：HTML 结构（section）和图标数据（DATA）解耦，加分类只需 HTML 加一个 <section> + DATA 加一个键。
· repeat(auto-fill, minmax(...))：响应式网格的最短写法，不需要媒体查询。
· aspect-ratio: 1/1：卡片正方形，不依赖 JS 计算高度。
· clipboard.writeText：最直接的复制 API，但需要安全上下文 + 用户手势。
· 单文件 ≤ 40KB：素材库的理想体积——一屏内能加载完。

---

七、目录结构建议

当前两文件平铺，建议：

```
svg-gallery/
├── index.html            ← (2) 定稿版
├── v1.html               ← (1) 历史版，保留对照
└── README.md             ← 简述「点图标即复制」
```

如果要长期维护（持续加图标），可以改成：

```
svg-gallery/
├── index.html            ← 只放 HTML 骨架
├── icons.js              ← DATA 对象抽离
├── L-F.js                ← 两个包装函数
└── README.md
```

拆分的好处：DATA 单独维护，diff 干净；坏处：单文件即用优势丧失。按当前项目规模（~30KB），建议保持单文件。

---

八、使用说明

1. 打开方式：双击任意 .html，浏览器直接渲染，无需服务器。
2. 复制图标：点击任一卡片，右上角弹出「已复制 SVG」Toast，此时 Ctrl/Cmd+V 可粘贴到任意 HTML/CSS/JS 编辑器。
3. 复制的内容：是完整 <svg ...>...</svg> 字符串，含 viewBox 与颜色属性（currentColor 表示跟随父元素文字颜色）。
4. 新增图标：
   · 在 DATA 相应分类数组末尾追加一行
   · 用 L('<path .../>') 或 F('<path .../>') 包装
   · 保存即生效，无需构建
5. 新增分类：
   · <nav> 加一个 <a href="#新id">新名称</a>
   · <body> 加一个 <section id="新id"><h2>新名称</h2><div class="grid" data-cat="新id"></div></section>
   · DATA 加一个 新id: [...]

---

九、已知注意事项

1. file:// 下复制可能失效——现象：点卡片只看到「复制失败」；原因：clipboard 需要安全上下文；规避：用 python -m http.server 起本地服务，或部署到 https。
2. Safari 首次点击会弹权限——现象：第一次点击无响应；原因：Safari 需要用户授权剪贴板读写；规避：在页面顶部文案里提前告知「首次点击需允许剪贴板权限」。
3. 深色模式下图标色不变——现象：卡片一直白底深灰图标；原因：:root 里的变量只定义了浅色；规避：若需支持，在 @media (prefers-color-scheme: dark) 里覆盖 --bg / --card / --text。
4. solid 里"甜甜圈"图标依赖 fill="#fff"——现象：复制到深色背景会看到一个白洞；原因：实心图标内部用了固定白色打洞；规避：如果目标背景不是白，需要手动把 #fff 改成目标背景色，或改用 fill-rule="evenodd" 的复合路径。
5. pointer-events: none 会导致 title 属性不可用——现象：想在图标上加 tooltip 不生效；原因：<svg> 不接收鼠标事件；规避：把 title 放到 .item 上。
6. 悬停效果在触屏设备上不生效——现象：手机上无 :hover 视觉反馈；原因：触屏无 hover；规避：用 :active 提供按下反馈，或忽略（点击 Toast 已足够）。

---

十、快速选择指南

你想…… 用哪个文件 / 做什么
直接拿全套图标 (2).html（最新最全）
只想看精简版（112 个） (1).html
加图标 编辑 (2).html 的 DATA 对象
加一个分类 见第 8 章第 5 条
换图标风格（线变实心） 把 L(...) 改成 F(...)（注意 stroke 属性的 path 未必适合填充）
复制后图标颜色不对 检查父元素 color（图标用 currentColor）
想深色模式 加 @media (prefers-color-scheme: dark) 覆盖 CSS 变量

---

附：两版分类图标数量对照

分类 (1) (2) 增量
linear 25 41 +16
solid 18 30 +12
geo 16 22 +6
arrows 12 21 +9
weather 10 16 +6
ui 15 21 +6
symbols 10 16 +6
social 8 10 +2
files 8 10 +2
media — 10 +10（新分类）
device — 10 +10（新分类）

表格里能看到 (2) 的扩充策略：核心分类（linear/solid）加倍，其他分类各补 6~9 个，并新增 2 个设备向分类——典型的「素材库从能用 → 好用」的成熟化路径。