粉丝数增长动画 · 项目文档

一、项目简介

一套纯前端（HTML + CSS + JS）的数字缓动动画组件：从最小值起，以二次缓入曲线（从慢到快）逐步逼近目标值，同时数字的渐变色随进度动态插值，视觉上像"数字正在加速冲向目标"。

技术栈：原生 HTML/CSS/JS，requestAnimationFrame，background-clip: text。无依赖，双击即可运行。

23 个文件记录了两条交织的演进：

1. 功能线：基础动画 → 全屏沉浸 → 小数/整数切换 → 可配置
2. 视觉线：纯 CSS 玻璃 → 尝试液态玻璃库（失败 6 次）→ 回归纯 CSS

---

二、文件总览

按两条线交织排列，标注每份的核心变化：

文件 阶段 核心变化
(0) 基线 深色卡片 + 数字 + 渐变条
(1) 纯数字 去掉渐变条，只留数字；加时长输入
(2) 全屏 设置页 + 全屏数字页分离
(3) 渐变修复 加 background-clip: text + -webkit-text-fill-color
(4) 渐变端点 用两对颜色插值生成渐变，而非单色
(5) 小数开关 加"显示小数"复选框
(6) 渐变稳定 统一 computeGradient 返回渐变串
(7) 液态玻璃尝试 1 引 glass.goose.cc.cd/liquid-glass.js
(8) 液态玻璃尝试 2 改本地 ./liquid-glass.js
(9) 液态玻璃尝试 3 用 scroll-container 模式
(10) 液态玻璃尝试 4 用 single-slider 模式
(11) 液态玻璃尝试 5 用 buttons 模式 + CSS 隐藏 UI
(12) 液态玻璃尝试 6 修 setScroll 调用
(13) 回退 放弃液态玻璃，纯 CSS 玻璃
(14) 液态玻璃卡片 用 liquid-glass 包裹设置面板
(15) 壁纸 引 wallpaper.js 做背景
(16) 玻璃开关 设置面板用 liquid-glass + 液态开关
(17) 混合 纯 CSS 玻璃 + liquid-glass 开关
(18) 自定义开关 纯 CSS 玻璃 + 自定义 toggle
(19) 简化 去掉外部依赖，纯 CSS
(20) 稳定 同上，微调
(21) 模拟壁纸 内联 SVG 壁纸，避免 404
(22) 容器模式 liquid-glass 的 container 模式
(23) 定稿 纯 CSS 玻璃 + 壁纸 + 小数开关

主线：(1) → (2) → (5) → (23)。

(7)–(12)、(14)–(22) 是液态玻璃的失败尝试——外部库不稳定，最终在 (23) 回归纯 CSS。这 6 次失败比成功更有教学价值。

---

三、核心机制

3.1 缓动：二次方模拟"从慢到快"

核心只有一行：

```js
const p = Math.min(elapsed / duration, 1);  // 0→1 线性进度
const eased = p * p;                         // 二次缓入
```

p * p 的含义：

· p=0.1 → eased=0.01（才走了 1%，慢）
· p=0.5 → eased=0.25（走了一半时间，才走了 25%）
· p=0.9 → eased=0.81（最后 10% 时间走了 19%）
· p=1.0 → eased=1.0

视觉上就是"起步慢，越走越快"。对"粉丝数增长"这种叙事，比线性更符合直觉——增长曲线天然是加速的。

当前值 = currentMin + (currentMax - currentMin) * eased。

3.2 渐变色插值：两对颜色 → 一个渐变

不是"从 A 到 B"，而是"从一对颜色到另一对颜色"：

```js
function lerpColor(hex1, hex2, t) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return `rgb(${lerp(c1.r,c2.r,t)}, ${lerp(c1.g,c2.g,t)}, ${lerp(c1.b,c2.b,t)})`;
}

function computeGradient(t) {
  const colorA = lerpColor(colorStartFrom, colorStartTo, t);  // 起点色对插值
  const colorB = lerpColor(colorEndFrom,   colorEndTo,   t);  // 终点色对插值
  return `linear-gradient(135deg, ${colorA}, ${colorB})`;      // 用两个插值结果组成新渐变
}
```

效果：进度 t=0 时是 #ff7b7b → #f9d976（暖色渐变），t=1 时是 #7bb7ff → #ff6f91（蓝粉渐变），中间平滑过渡。

比"单色从红变蓝"更有层次——渐变在动，不只是色值在变。

3.3 渐变文字：background-clip: text 的四个必要条件

让数字显示渐变色的完整写法（缺一不可）：

```css
color: transparent;                    /* 兜底：不支持 clip 时透明 */
background-image: linear-gradient(...); /* 必须是 image，不能是 background 简写 */
background-clip: text;                  /* 标准属性 */
-webkit-background-clip: text;          /* Safari 必须 */
-webkit-text-fill-color: transparent;   /* Safari 必须 */
```

四个坑：

1. background vs background-image：style.background = 'linear-gradient(...)' 有时被解析成 background-color（因为渐变是 image 不是 color），必须用 background-image。
2. -webkit-text-fill-color：Safari 不认 color: transparent，必须单独设 -webkit-text-fill-color: transparent。
3. background-clip 与 -webkit-background-clip 都要写，前者是现代标准，后者是 Safari 兼容。
4. background-size: 100% 100% + background-repeat: no-repeat：防止渐变在文字上重复平铺。

3.4 小数/整数切换

(5) 起加"显示小数"开关，核心是格式化函数：

```js
function formatDisplay(value, showDecimal) {
  if (showDecimal) {
    return value.toFixed(1);          // "52.3"
  } else {
    return Math.round(value).toString(); // "52"
  }
}
```

注意：切换只改变显示格式，不改变内部 currentValue。用户在中途切换，数字会从 52.3 跳到 52，但动画不中断。

3.5 液态玻璃：6 次失败的记录

(7)–(12) 试图用外部 liquid-glass.js 库做玻璃背景，全部失败：

文件 尝试 失败原因
(7) glass.goose.cc.cd 远程 CDN 域名不可用，LiquidGlass is not defined
(8) 本地 ./liquid-glass.js 文件不存在，404
(9) scroll-container 模式 组件 API 不匹配，setScroll is not a function
(10) single-slider 模式 组件只渲染滑块，不渲染背景
(11) buttons 模式 + CSS 隐藏 UI 隐藏了 UI 连背景也隐藏了
(12) setScroll 调用 组件内部有 active 状态判断，无法直接操控

(13) 起回归纯 CSS 玻璃：

```css
.glass-card {
  background: rgba(20, 20, 35, 0.4);     /* 半透明底 */
  backdrop-filter: blur(24px);            /* 模糊背后内容 */
  -webkit-backdrop-filter: blur(24px);    /* Safari */
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.7);
}
```

(23) 是这个方案的定稿——不依赖任何外部库，纯 CSS 实现玻璃效果。

教训：外部库的"视觉花哨"远不如"稳定可用"重要。6 次失败的调试成本，足以用 CSS 手写 3 遍玻璃效果。

3.6 玻璃开关：自定义 toggle（(18)）

(16) 用了 liquid-glass 的 single-toggle 组件，但同样不稳定。(18) 改为纯 CSS 手写：

```html
<div class="glass-toggle active" id="decimalToggle">
  <div class="thumb"></div>
</div>
```

```css
.glass-toggle {
  width: 52px; height: 30px;
  background: rgba(255,255,255,0.08);
  border-radius: 30px;
  transition: 0.3s;
}
.glass-toggle.active { background: rgba(90,90,255,0.35); }
.glass-toggle .thumb {
  position: absolute; top: 3px; left: 3px;
  width: 22px; height: 22px; border-radius: 50%;
  transition: 0.3s;
}
.glass-toggle.active .thumb { left: 25px; background: #7a7aff; }
```

JS 只做一件事：

```js
decimalToggle.addEventListener('click', () => {
  decimalToggle.classList.toggle('active');
});
```

读状态：decimalToggle.classList.contains('active')。

30 行 CSS + 3 行 JS，比引一个库更可控。

3.7 全屏切换：设置页 ↔ 动画页

(2) 起采用"设置页 + 全屏页"双界面：

```css
.fullscreen-number {
  position: fixed; inset: 0;
  opacity: 0; pointer-events: none;
  transition: opacity 0.5s ease;
}
.fullscreen-number.active {
  opacity: 1; pointer-events: auto;
}
```

点"开始" → 给全屏 div 加 .active → 淡入；点"返回" → 移除 .active → 淡出。

注意：pointer-events: none 必须同时设。否则隐藏的全屏层会拦截设置页的点击——这是全屏覆盖层最常见的坑。

3.8 壁纸加载的容错（(21) 起）

wallpaper.js 提供 window.LG_WALLPAPER（Base64 图片）。加载失败时页面不会有背景，(21) 加了内联 SVG 兜底：

```js
if (typeof window.LG_WALLPAPER !== 'undefined') {
  document.body.style.backgroundImage = `url(${window.LG_WALLPAPER})`;
} else {
  document.body.style.background = 'radial-gradient(circle at 20% 30%, #1a1a2e, #0b0b14)';
}
```

内联 SVG 作为占位（避免 404 干扰）：

```js
window.LG_WALLPAPER = 'data:image/svg+xml,%3Csvg ...%3E';
```

---

四、技术要点汇总

· p * p 是极简的缓入：一行实现"从慢到快"，无需引入 easing 库。
· 渐变文字四件套：background-image + background-clip: text + -webkit-background-clip: text + -webkit-text-fill-color: transparent，缺一不可。
· background 会被误解析：渐变赋值给 style.background 时，某些浏览器会当成 background-color，必须用 style.backgroundImage。
· pointer-events: none 是全屏层的安全锁：隐藏时拦截点击是常见 bug，opacity: 0 不够。
· requestAnimationFrame 的 timestamp 是参数：不用 performance.now()，直接用回调传入的时间戳，更准确。
· 缓动函数决定"性格"：p（线性）是匀速，p*p（二次）是慢到快，1-(1-p)*(1-p)（二次缓出）是快到慢。粉丝数增长用 p*p 最符合直觉。
· 外部库 ≠ 省事：liquid-glass 的 6 次失败教训是"依赖不可控的库，调试成本可能超过手写"。

---

五、目录结构建议

若整理成正式项目：

```
number-accel/
├── index.html              # (23).html 重命名
├── css/
│   ├── glass.css           # 玻璃效果（纯 CSS）
│   └── layout.css          # 设置页 + 全屏页布局
├── js/
│   ├── easing.js           # 缓动函数集合
│   ├── color.js            # hexToRgb / lerpColor / computeGradient
│   └── app.js              # 状态机 + 事件绑定
├── assets/
│   └── wallpaper.js        # 壁纸 Base64
└── legacy/
    ├── v1-basic.html       # (0) 基线
    ├── v5-fullscreen.html  # (2) 全屏
    └── v7-liquid-glass/    # (7)-(12) 液态玻璃失败记录
```

---

六、使用说明

运行

双击任意 HTML 即可。无需服务器——所有动画和颜色计算都在本地。

首次上手

1. 在设置页调"最小值/最大值"（决定数字从哪涨到哪）
2. 调"起始渐变色/结束渐变色"（两对颜色，各两个色值）
3. 调"时长"（默认 3000ms）
4. 切"显示小数"开关
5. 点"开始" → 进入全屏动画
6. 动画结束 → 全屏页显示"✅ 完成"
7. 点"返回"回设置，或"重新开始"重播

环境要求

· 现代浏览器（backdrop-filter 需 Chrome 76+ / Safari 9+）
· 无需联网
· 手机端可用（响应式适配到 380px）

---

七、已知注意事项

1. 渐变文字在 Safari 上可能不显示：如果只写 color: transparent 不写 -webkit-text-fill-color: transparent，Safari 会显示成黑色方块。两个都要写。
2. style.background = 'linear-gradient(...)' 可能失效：某些浏览器的 CSS 解析器会把渐变当成 background-color 的值，导致无效。必须用 style.backgroundImage。
3. 全屏层隐藏时仍拦截点击：如果只设 opacity: 0 不设 pointer-events: none，隐藏的全屏 div 会盖住设置页，用户点不到按钮。这是全屏模式最常见的坑。
4. liquid-glass 库的 6 次失败：(7)–(12)、(14)–(22) 里所有引入外部玻璃库的尝试都失败了——CDN 不可用、API 不匹配、组件无法操控。最终 (23) 回归纯 CSS，这是正确的选择。
5. 小数切换不改变内部值：(5) 起加的"显示小数"开关只改 textContent 格式，currentValue 内部精度不变。中途切换会看到 52.3 跳到 52，但动画不中断。
6. p * p 缓动的视觉速度：时长 3000ms 时，前 1000ms 只走 11%，后 1000ms 走 55%。如果觉得"太慢"，把 p*p 改成 p*Math.sqrt(p) 或 Math.pow(p, 1.5)。
7. wallpaper.js 的 404：(15) 起引 wallpaper.js，如果文件不存在会 404，但不影响功能（typeof window.LG_WALLPAPER === 'undefined' 分支会走纯色背景）。(21) 用内联 SVG 避免了这个问题。

---

八、快速选择指南

你想… 用这个文件
直接能用的最终版 (23).html
最简版（无全屏、无壁纸） (1).html
只要动画核心（不含视觉） (1).html 的 animate 函数
学渐变文字的正确写法 (23).html 的 updateFullscreenNumber
学全屏切换的实现 (2).html 的 .fullscreen-number.active
看液态玻璃为什么失败 (7) → (12) 的 6 次尝试
看纯 CSS 玻璃怎么写 (13).html / (23).html
学自定义 toggle 开关 (18).html 的 .glass-toggle
看缓动函数的取舍 (0) → (23) 里 eased = p * p 始终没变

---

九、结语

23 个文件的核心演进只有三个关键节点：

1. (1) 的动画核心：p * p 二次缓入 + 每帧 updateDisplay —— 这个模式从 (0) 到 (23) 从未改变。
2. (3) 的渐变文字修复：background-clip: text 四件套的完整写法 —— 这是视觉效果的转折点。
3. (13) 的液态玻璃失败回退：从"引库"回归"纯 CSS" —— 这是工程判断的转折点。

其余 20 个文件是这两个核心的反复打磨和外部库的试错。如果只能读三份：(1) 看动画核心，(3) 看渐变文字，(23) 看最终形态。

(7)–(12) 的液态玻璃失败记录，是整个批次里最有教学价值的部分——它证明了"视觉花哨的库不如稳定的纯 CSS"这条工程原则。