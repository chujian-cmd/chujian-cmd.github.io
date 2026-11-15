前端 CDN 资源预览站 · 项目文档

一、项目简介

一个"CDN 资源展示 + 就地预览"的单页应用：把 16 个好玩的前端库（Vanta、particles.js、three.js、animate.css 等）整理成卡片，每张卡片带一段 srcdoc iframe 演示，点击「预览」直接在弹窗里跑起来，点击「复制」拿到 CDN 链接。

技术栈：原生 HTML/CSS/JS，iframe.srcdoc，navigator.clipboard。无构建，双击即可运行。

3 个文件是同一条演进线：从"jsdelivr 直连"到"国内镜像 + 移动端适配"，再到"剔除不稳定库 + 扩充效果"。

---

二、文件总览

文件 阶段 核心变化
(1).html 基线 4 分区 11 个库；jsdelivr CDN；桌面优先布局
(2).html 镜像与移动端 CDN 全换 cdn.jsdmirror.com；加 env(safe-area-inset-*)；clamp() 字号；min-height:36px 点击区；手机端预览按钮只留图标
(3).html 扩充与剔除 移除 mojs（不稳定）；新增 anime.js / tsParticles / hoorayjs / js-confetti / particle-bubbles；扩到 5 分区 16 个库

主线：(1) → (2) → (3)。(3) 是最终形态，本文档重点写它，(1)(2) 作为演进参照。

---

三、核心机制

3.1 数据驱动渲染

整个页面没有一段手写 DOM，全部由 SECTIONS 数组 map 生成。数据结构：

```js
const SECTIONS = [
  {
    title: '背景与粒子特效',
    icon: 'sparkle',              // 对应 ICONS 里的 SVG
    accent: '#7c6cf7',            // 分区主色
    soft: 'rgba(124,108,247,.12)',// 分区浅色背景
    items: [
      { id: 'vanta', name: 'Vanta.js', tag: '3D 背景',
        desc: '...', url: 'https://cdn.jsdmirror.com/npm/vanta@...' },
      // ...
    ]
  },
  // ...
];
```

渲染时把 accent 和 soft 写成内联 CSS 变量 --accent / --soft，卡片内的 .tag、.preview-btn 都用 var(--accent) 取色——加一个分区只需要在数组里加一项，CSS 不用动。

3.2 srcdoc iframe 预览

每个演示是一个完整的 HTML 字符串，直接塞进 iframe.srcdoc：

```js
const DEMOS = {
  three: `<!DOCTYPE html><html><head>...<script src="...three.min.js"><\/script>...`,
  // ...
};

frame.srcdoc = DEMOS[item.id];
```

三个关键点：

1. 字符串里的 </script> 必须写成 <\/script>。否则浏览器 HTML 解析器会在主页面里提前结束 <script> 标签，导致语法错误。这是所有内嵌 HTML 字符串的必修坑。
2. 关闭时清空 srcdoc：frame.srcdoc = '' 才能真正停止 iframe 内的脚本（requestAnimationFrame、setInterval）。只 hidden 隐藏，动画还在跑，白耗 CPU。
3. sandbox="allow-scripts allow-popups"：iframe 需要脚本权限才能跑演示，但不给 allow-same-origin——这样 iframe 内的脚本无法访问父页面的 localStorage、cookie、DOM，隔离了风险。

3.3 复制的双保险

navigator.clipboard.writeText() 在非 HTTPS 或旧浏览器上会抛异常，必须 fallback 到 execCommand：

```js
try { await navigator.clipboard.writeText(url); }
catch {
  const ta = document.createElement('textarea');
  ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  document.execCommand('copy');
  ta.remove();
}
```

复制成功后按钮变绿勾 1.6 秒（.copied 类 + CSS 切换 .i-copy / .i-check 显示），给用户即时反馈。

3.4 CDN 镜像切换（(1) → (2) 的核心改动）

版本 CDN 域名 说明
(1) cdn.jsdelivr.net 全球 CDN，国内部分地区偶发超时
(2)(3) cdn.jsdmirror.com 国内镜像，加载更稳

所有 URL 从 cdn.jsdelivr.net/npm/xxx 换成 cdn.jsdmirror.com/npm/xxx，路径完全一致。两个文件里 SECTIONS 和 DEMOS 的 URL 都做了同步替换——漏一处就会有一个演示加载失败，所以改动时全局搜索替换。

镜像可用性会随时间变化。如果将来 jsdmirror 也不稳，同样的替换策略可以切到 fastly.jsdelivr.net、unpkg.com 或自建反代。

3.5 mojs 被移除的原因（(2) → (3) 的关键决策）

(1)(2) 里 mojs 排在"鼠标交互整活"分区第一位，(3) 里被删掉，换成了 anime.js。原因从代码能推出来：

(2) 的 mojs 演示：

```js
new mojs.Burst({ left:0, top:0, radius:{0:130}, count:14, ... })
  .tune({x:e.clientX, y:e.clientY}).replay();
```

问题在于 .tune() + .replay() 这个组合。mojs 的 tune() 是"改参数不重播"，replay() 才真正跑——两者顺序或调用时机不对，容易不触发。而且 mojs 的 API 在 1.6.0 版本有过变动，mojs.easing.bezier() 某些参数组合会静默失败。

(3) 换成 anime.js，同样的"点击炸开粒子"效果，用更稳的 API：

```js
anime({
  targets: dot,
  translateX: anime.random(-150,150),
  translateY: anime.random(-150,150),
  scale: [1, 0],
  opacity: [1, 0],
  duration: anime.random(600, 1200),
  easing: 'easeOutExpo',
  complete: () => dot.remove()
});
```

这是"库选择"的典型判断：功能看起来差不多的两个库，API 稳定性和调试成本才是决定因素。mojs 的视觉更精致，但失败时排查困难；anime.js 的 API 更朴素，但行为可预测。

3.6 移动端适配（(2) 起）

四个关键改动：

改动 作用
padding-bottom: calc(100px + env(safe-area-inset-bottom)) 避开 iPhone 底部 Home 条
font-size: clamp(26px, 5vw, 36px) 字号随屏幕宽度平滑缩放，不写死媒体查询断点
.preview-btn { min-height:36px; min-width:44px } 触屏最小点击区 44×44px（iOS HIG 建议）
@media (max-width:640px){ .preview-btn span{display:none} } 手机端预览按钮只留眼睛图标，节省卡片横向空间

弹窗也做了适配：@media (max-width:640px){ .preview-panel{ width:100%; height:100%; border-radius:0 } }——手机上预览是全屏，不是浮层。

---

四、技术要点汇总

· <\/script> 转义：内嵌 HTML 字符串里所有 </script> 必须写成 <\/script>，否则主页面的 <script> 标签会提前闭合。
· 清空 srcdoc 才能停脚本：hidden 只隐藏，srcdoc = '' 才真正销毁 iframe 内的运行环境。
· sandbox 不给 allow-same-origin：allow-scripts + allow-same-origin 同时开是危险的，iframe 内脚本可读父页面数据。这里只给 allow-scripts allow-popups。
· navigator.clipboard 必须 fallback：非 HTTPS 或旧浏览器不支持，execCommand 是唯一可靠兜底。
· CSS 变量做主题色：--accent / --soft 写在 section 上，卡片内的图标、标签、按钮都继承，加分区不用改 CSS。
· clamp() 优于媒体查询断点：clamp(26px, 5vw, 36px) 一行覆盖所有屏宽，比写 3 个 @media 更简洁。
· prefers-reduced-motion：(2) 起加了 @media (prefers-reduced-motion:reduce){ .card,.copy,.preview-btn{transition:none} }，尊重系统的"减少动效"偏好。

---

五、目录结构建议

若整理成项目：

```
cdn-gallery/
├── index.html              # (3).html 重命名
├── css/
│   └── app.css             # 从内联抽出
├── js/
│   ├── data.js             # SECTIONS 数据
│   ├── demos.js            # DEMOS 字符串（每个库一段）
│   ├── icons.js            # ICONS + ICON_EYE/COPY/CHECK
│   ├── render.js           # 数据 → DOM
│   ├── copy.js             # 复制 + fallback
│   └── preview.js          # 弹窗开关
└── legacy/                 # 演进留档
    ├── v1-jsdelivr.html    # (1).html
    └── v2-mirror.html      # (2).html
```

当前单文件形态适合直接分发，上述结构适合后续把 DEMOS 拆成独立文件（每个库一个 .js，按需加载）。

---

六、使用说明

运行

双击任意 HTML 即可。需要联网——所有演示都从 CDN 加载库，离线时预览会显示空白。

首次上手

1. 滚动浏览 5 个分区（背景/交互/彩带/3D/文字）
2. 点击卡片右上角「预览」→ 弹窗里直接跑演示
3. 点击代码行右侧的复制图标 → 拿到该库的 CDN 链接
4. Esc 或点遮罩关闭弹窗

环境要求

· 现代浏览器（需支持 iframe.srcdoc、navigator.clipboard、CSS clamp()）
· 联网（CDN 加载）
· 移动端可用，(2)(3) 已适配刘海屏和触屏点击区

---

七、已知注意事项

1. </script> 不转义会导致整页白屏：DEMOS 里每个字符串都含 <script>，如果写成 </script> 而不是 <\/script>，浏览器会把主页面的 <script> 提前闭合，后面的代码全部变成 HTML 文本。这是最容易踩的坑，改 DEMOS 时务必检查。
2. 关闭预览必须清 srcdoc：(1)(2)(3) 都做了 frame.srcdoc = ''。如果只 hidden，Vanta 的 WebGL 上下文、three.js 的 requestAnimationFrame、particles.js 的定时器都会继续跑，开几个预览后页面明显变卡。
3. CDN 镜像可能失效：(2)(3) 用 cdn.jsdmirror.com，这是第三方镜像，可用性不保证。如果某天大面积 404，全局替换回 cdn.jsdelivr.net 或 unpkg.com 即可。
4. sandbox 不给 allow-same-origin：这是有意为之。iframe 内的脚本跑在"不透明源"（opaque origin）里，无法读父页面的 localStorage、cookie、document。如果给 allow-same-origin，任何演示里的一行 parent.document.body.innerHTML = '' 就能清空主页——虽然这些库本身没恶意，但不给权限是零成本的防御。
5. mojs 在 (3) 里被移除：不是因为 mojs 不好，而是它的 tune() + replay() 组合在某些浏览器上静默失败，排查成本高。anime.js 的 API 更直白，出问题容易定位。选库时"能调试"比"效果炫"更重要。
6. execCommand 已废弃但仍需保留：document.execCommand('copy') 在现代浏览器里被标记 deprecated，但 navigator.clipboard 在非 HTTPS、iframe、部分旧 Safari 上不可用。双保险是唯一可靠方案，别因为"已废弃"就删掉。
7. 手机端预览是全屏：(2)(3) 的 @media (max-width:640px){ .preview-panel{width:100%;height:100%;border-radius:0} } 让弹窗在手机上占满屏幕。这是有意的——手机上 80vh 的浮层里再套 iframe，可视区太小，演示看不清。

---

八、快速选择指南

你想… 用这个文件
直接能用的最终版 (3).html
只要原始 11 个库（不要扩充的） (1).html
看 CDN 镜像怎么换 (1) 与 (2) 对比 SECTIONS
看移动端适配做了哪些 (1) 与 (2) 对比 CSS
看 mojs 为何被删 (2) 的 mojs demo 与 (3) 的 anime demo 对比
学 srcdoc iframe 预览 任意文件的 openPreview / closePreview
学数据驱动渲染 任意文件的 SECTIONS.map(...)
学复制 fallback 任意文件的 copy 事件监听

---

九、结语

这批文件的演进很清晰：(1) 是"能跑"，(2) 是"国内能跑 + 手机上能跑"，(3) 是"剔除坑货 + 扩充内容"。

三个版本里，技术增量最大的是 (2)——CDN 镜像和移动端适配是"从能用到好用"的关键一步；内容增量最大的是 (3)——移除 mojs 是"从炫到稳"的取舍，新增 5 个库是"覆盖面"的扩展。

如果只能读两份：(1).html（理解基线结构）+ (3).html（理解最终形态），对比能看出全部演进。(2) 是 (1) 和 (3) 之间的过渡，单独读价值不大，但对比 (1) 能学 CDN 镜像和移动端适配的具体做法。