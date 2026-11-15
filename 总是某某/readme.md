线 · 形 —— 手绘线变形为形状的 Canvas 交互系统

一、项目简介

一套纯前端（HTML + Canvas 2D，零依赖）的交互式绘图工具：用户拖拽画出一条任意曲线，松手后曲线会平滑变形成目标形状（默认星形，也可选内置 SVG 图标或自定义 SVG/手绘形状）。支持无限画布、矢量/图层双渲染模式、缩放平移、撤销重做、自定义形状库持久化。

核心亮点是"线 → 形"的变形算法：把笔迹与目标轮廓都按弧长等距重采样为固定点数，逐点做缓动插值，配合起点对齐与方向自适应，让变形看起来像"线自己长成了形状"。

技术栈：原生 HTML/CSS/JS，Canvas 2D API，SVG 路径解析，localStorage。无构建步骤，单文件即可运行。

---

二、文件总览

30 个文件构成一条清晰的演进主线。下表按阶段而非文件名排序，标注每份的核心变化：

文件 阶段 核心变化
(1) 起点 固定星形，深色 UI 卡片，单形状
(2) 精简 白底，去掉 UI，代码压缩
(3) 采样 SAMPLE_COUNT=120，起点对齐，方向自适应
(4) 闭合 resampleClosed，修复首尾不闭合
(5) 闭合精确 强制 out[n-1]=out[0]
(6) 闭合加固 enforceClosed，旋转后仍闭合
(7) 累积 base+live 双层画布，可连续绘制
(8) 精简 同 (7)，代码结构优化
(9) 动态目标 starTemplate 单位模板 + 笔迹包围盒定位
(10) 并发 base+morph+draw 三层，支持多个变形同时进行
(11) 分叉 SVG 图标库展示页，复制代码，非主项目
(12) 选择器 从 SVG 提取轮廓作为变形目标，引入 picker
(13) 全屏 全屏画布 + picker，用 getScreenCTM 提取轮廓
(14) 编辑 撤销/重做，立即/批量模式切换
(15) 多子路径 svgToSubPaths 返回子路径数组，splitPolylineByArc 切分
(16) 单/多分支 单子路径整体变形，多子路径分别处理
(17) 共用起点 N 个子路径共享同一份 startSamples
(18) 画笔 颜色/粗细控件，滚轮缩放，Shift+拖拽平移
(19) 触屏 双指捏合缩放，触摸优化
(20) 无限画布 纯矢量渲染，bbox 裁剪可见性
(21) 自定义形状 添加/删除/导出/导入 SVG 模板，localStorage
(22) transform 手动解析 SVG transform 矩阵，摆脱 getScreenCTM
(23) 缓存 staticCanvas 缓存历史形状，避免每帧重描
(24) 分块 Tile 512 世界单位，LRU 淘汰，无限画布
(25) 双模式 引入矢量/图层双渲染模式，三层离屏画布
(26) 模式切换 renderBtn 切换，图层模式限制视口
(27) 配置化 CONFIG 集中参数，自定义图形弹窗（上传/手绘）
(28) 调参 layer.worldFactor=1000
(29) 调参 图层最小缩放 0.0001
(30) 定型 Tile 1024 分块无限画布，最终形态

主线：(1) → (3) → (7) → (9) → (12) → (15) → (18) → (20) → (21) → (23) → (27) → (30)

最终形态：(30).html。本文档重点描述它，其他版本作为演进参照。

---

三、核心机制

3.1 线 → 形变形算法

这是整个项目的核心。分四步：

Step 1 · 弧长等距重采样

用户笔迹是任意间距的点序列。按总弧长均分为 N 段，取 N 个等距点（resample）。目标轮廓同样处理（闭合路径用 resampleClosed，保证首尾重合）。

```js
// 开放折线：步长 = total / (n - 1)，第 i 点距起点 i * step
function resample(pts, n) {
  const total = totalLength(pts);
  const step = total / (n - 1);
  // 沿折线逐段推进，插值取点
}
```

Step 2 · 起点对齐

用户从哪儿起笔是随机的，目标形状的起点是固定的。若不对齐，变形过程中线会"绕圈"。做法：在目标采样点里找离 startSamples[0] 最近的点，把目标数组旋转到以该点为起点。

```js
let bestIdx = 0, bestDist = Infinity;
for (let i = 0; i < endSamples.length; i++) {
  const d = Math.hypot(endSamples[i].x - first.x, endSamples[i].y - first.y);
  if (d < bestDist) { bestDist = d; bestIdx = i; }
}
endSamples = endSamples.slice(bestIdx).concat(endSamples.slice(0, bestIdx));
```

Step 3 · 方向自适应

对齐后还需判断方向：若目标数组反转后首点更接近用户起点，则反转。否则正反方向会对冲，出现"麻花"效果。

Step 4 · 缓动插值

变形进度 t 从 0 到 1，每帧用 easeInOutCubic 映射后做线性插值：

```js
const t = ease(progress); // 4t³ (t<0.5) / 1-(-2t+2)³/2
for (let i = 0; i < start.length; i++) {
  const x = start[i].x + (end[i].x - start[i].x) * t;
  const y = start[i].y + (end[i].y - start[i].y) * t;
}
```

关键参数（CONFIG.morph）：

参数 默认值 含义
sampleCount 60 每条子路径的采样点数
svgSamples 60 解析 SVG 时每条子路径的采样点数
speed 0.018 每帧进度增量，越大越快
shapeScale 0.55 目标形状相对笔迹包围盒的缩放
minSize 40 笔迹最小尺寸，避免退化

采样点数与笔迹复杂度相关。60 点对多数形状足够；点数过多会让变形"僵硬"，过少会丢失细节。

3.2 多子路径变形

一个 SVG 可能由多条路径组成（如"齿轮"有多条齿，"心形"是单条路径）。svgToSubPaths 返回 [{points, closed}, ...]。

变形策略（(17) 定型）：

· 用户笔迹只采样一次，得到一份 startSamples
· N 个子路径各自复制同一份起点，飞向各自的目标

视觉效果：一条线"分裂"成 N 条线，各自长成形状的一部分。

```js
const startSamples = resample(linePoints, SAMPLE_COUNT);
for (let s = 0; s < N; s++) {
  const endSamples = prepareSubPath(startSamples, target.points, target.closed);
  subPaths.push({ start: startSamples, end: endSamples, closed: target.closed });
}
```

(15) 曾尝试把笔迹按弧长切成 N 段，每段对应一个子路径，但笔迹长度与子路径数量不匹配时会断裂。(17) 改为"共享起点"后视觉更自然。

3.3 渲染架构

(30) 提供两种渲染模式，通过工具栏 renderBtn 切换：

模式 原理 缩放范围 适用
矢量 每帧重绘所有 history，bbox 裁剪可见性 0.0001 ~ 8 无限画布，形状少
图层 Tile 分块离屏缓存，LRU 淘汰 0.0001 ~ 5 形状多，性能优先

图层模式的 Tile 系统（(30) 定型）：

· 世界被划分为 1024×1024 世界单位的方块
· 每个 tile 是一张独立 canvas，只画与该 tile 相交的形状
· maxTiles=64，超出时按 LRU 淘汰最久未用的 tile
· 视图移动时只绘制可见 tile

```js
function paintStrokeInto(stroke, subPaths) {
  const bbox = stroke.bbox;
  const s = CONFIG.layer.tileSize;
  const tx0 = Math.floor((bbox.minX - pad) / s);
  // ... 遍历覆盖的 tile，每个 tile 用 translate 偏移后绘制
}
```

早期 (25)(26) 用"三层离屏画布 + 世界=2倍屏幕"，无法真正无限。(30) 改为分块后，画布范围理论无上限，只受内存（tile 缓存数）约束。

3.4 SVG 轮廓提取

从 SVG 字符串到可用的子路径数组，走 svgToSubPaths：

1. DOMParser 解析 SVG
2. 遍历 path/circle/rect/line/polyline/polygon/ellipse
3. 对每个元素，手动累积祖先 transform 矩阵（(22) 的关键修复）
4. 采样轮廓点（path 用 getPointAtLength，基本图形用参数方程）
5. 归一化：中心平移到原点，长边缩放到 1（坐标范围约 [-0.5, 0.5]）

transform 矩阵解析（(22) 替代了 (13) 的 getScreenCTM）：

```js
// 矩阵 [a,b,c,d,e,f]，与 SVG matrix() 一致
function mulMat(m1, m2) {
  return [
    m1[0]*m2[0] + m1[2]*m2[1],
    m1[1]*m2[0] + m1[3]*m2[1],
    // ... 完整 2D 仿射矩阵乘法
  ];
}
// 支持 matrix / translate / scale / rotate
```

⚠️ (13) 用 getScreenCTM() 提取轮廓，但该 API 要求 SVG 已挂载到 DOM 且可见。当 SVG 藏在字符串里时返回 null，导致大量形状"用不了"。(22) 改为纯手动解析，彻底解耦 DOM 依赖。

3.5 坐标系统

三个坐标系，靠 view 对象转换：

坐标 含义 公式
世界坐标 无限画布上的绝对位置 —
屏幕坐标 视口 CSS 像素 screen = world * scale + offset
世界→屏幕 绘制时 ctx.translate(offsetX, offsetY); ctx.scale(scale, scale)
屏幕→世界 输入时 world = (screen - offset) / scale

缩放以鼠标/手指为中心：先求光标世界坐标，改 scale 后反推新 offset，使该世界点仍映射到同一屏幕点。

```js
function zoomAt(sx, sy, factor) {
  const wx = (sx - view.offsetX) / view.scale;
  const wy = (sy - view.offsetY) / view.scale;
  view.scale *= factor;
  view.offsetX = sx - wx * view.scale;
  view.offsetY = sy - wy * view.scale;
}
```

3.6 自定义形状库

(21) 引入，(27) 完善。支持两种来源：

· 上传 SVG：读文件 → svgToSubPaths → 存原文（type='svg'）
· 手绘：小画板多笔绘制 → 首尾接近自动闭合 → 归一化 → 存坐标数组（type='path'）

持久化到 localStorage，键名 CONFIG.custom.storageKey。上限 50 个，名称上限 16 字符。

---

四、技术专题

4.1 交互手势

操作 鼠标 触摸
绘制 左键拖拽 单指拖拽
平移 中键 / Shift+左键 / 右键拖拽 双指拖拽
缩放 滚轮 双指捏合
重置视图 点击缩放标签 点击缩放标签

触摸事件用 touchMode 状态机（'draw' | 'pan' | null）区分单指与双指，避免手势冲突。

4.2 撤销重做

history 存已完成形状，redoStack 存被撤销的。新操作时清空 redoStack。Ctrl+Z 撤销，Ctrl+Shift+Z / Ctrl+Y 重做。

图层模式下撤销需重建受影响 tile（invalidateTilesInBBox），因为 tile 是缓存而非真相源。

4.3 批量模式

工具栏 modeBtn 切换：

· 立即模式：松手即变形
· 批量模式：松手只累积 pendingLines，点"变形"按钮才统一开始

批量模式下 pendingLines 是独立于 history 的临时队列，撤销优先清空它。

4.4 性能要点

优化 位置 做法
可见性裁剪 渲染循环 bbox 与可见矩形相交测试，margin=线宽+20
静态层缓存 (23) historyVersion + 视图签名，未变则复用 canvas
Tile 分块 (24)(30) 每 tile 独立 canvas，LRU 淘汰
采样点数自适应 (21) sampleCountFor 按子路径总长决定 40~220
DPR 上限 全局 Math.min(devicePixelRatio, 2) 省内存

---

五、技术要点汇总

· 变形动画帧率无关：(23) 起用 performance.now() 时间戳驱动，而非每帧固定增量。但在 (30) 中仍保留 progress += 0.018 的简单写法，若需严格帧率无关可改回时间戳。
· 闭合路径的两种处理：resampleClosed 采样时补起点成环，强制 out[n-1]=out[0]；enforceClosed 在数组旋转/反转后恢复闭合。两者配合。
· SVG 归一化：所有目标形状（内置图标、自定义 SVG、手绘）都归一化到长边为 1、中心在原点，变形时只需按笔迹包围盒缩放平移。
· 多子路径共享起点：N 个子路径用同一份 startSamples，视觉上是"分裂"；若各用各的起点会变成"多条线各自变形"，失去连贯性。
· Tile 缓存真相源：history 是唯一真相，tile 只是缓存。任何修改 history 的操作（撤销、重做、清空）都必须同步 tile。
· 画笔颜色/粗细随形状固化：每个形状记录自己创建时的 color 和 width，不随画笔控件变化，保证历史形状外观稳定。

---

六、目录结构建议

单文件项目，建议按语义拆分（若未来模块化）：

```
line-shape/
├── index.html              # 入口，装配 UI
├── css/
│   └── app.css             # 工具栏、picker、弹窗样式
├── js/
│   ├── config.js           # CONFIG 对象
│   ├── geometry.js         # resample / resampleClosed / bbox / totalLength
│   ├── svg.js              # svgToSubPaths / transform 解析 / 缩略图
│   ├── morph.js            # prepareSubPath / startMorph / 动画循环
│   ├── render.js           # 矢量渲染 / Tile 渲染 / 模式切换
│   ├── interaction.js      # 鼠标/触摸/手势/缩放
│   ├── shapes.js           # 自定义形状存取 / 内置图标库
│   └── app.js              # 初始化与事件绑定
└── README.md
```

当前 (30).html 全部内联，适合直接分发；上述结构适合二次开发。

---

七、使用说明

运行

直接用浏览器打开 (30).html 即可，无需服务器、无依赖。

首次上手

1. 在白色画布上按住拖拽画一条线
2. 松手，线自动变形为当前选中的形状（默认星形）
3. 右上角 picker 可切换目标形状（内置 SVG 图标 / 自定义）
4. 底部工具栏调画笔颜色与粗细
5. 滚轮缩放，中键或 Shift+拖拽平移

添加自定义形状

1. 点右上角 picker → "自定义" → "新建"
2. 选择"上传 SVG"（拖入或点击选择文件）或"手绘绘制"
3. 起名，保存并使用

快捷键

· Ctrl+Z 撤销
· Ctrl+Shift+Z / Ctrl+Y 重做
· Esc 关闭弹窗/picker

环境要求

· 支持 Canvas 2D 与 PointerEvent 的现代浏览器
· 触摸设备需支持多点触控（双指缩放）
· 自定义形状持久化依赖 localStorage

---

八、已知注意事项

1. 图层模式下缩放受限：layerMinScale=0.0001、layerMaxScale=5。缩到极小时 tile 会因 LRU 淘汰而短暂空白，稍等即重建。矢量模式无此问题。
2. SVG 内嵌位图不识别：svgToSubPaths 只处理矢量元素（path/circle/rect 等），<image> 内的位图会被忽略。上传前需确认 SVG 是纯矢量。
3. 多子路径共享起点的副作用：N 个子路径都用同一份起点，当 N 很大（如齿轮 20 齿）时，变形过程看起来像"一束线炸开"，不如单子路径优雅。这是设计取舍，非 bug。
4. localStorage 配额：自定义形状存 SVG 原文，大文件（接近 maxSvgBytes=512KB）存几个就可能触顶。触顶时保存失败但形状仍可用（仅本次会话），提示"已添加，但保存到本地失败"。
5. 画笔控件只影响新笔迹：已有形状的颜色/粗细在创建时固化，改画笔不会改变历史形状。要改需撤销重画。
6. 触摸端双指缩放与画线冲突：双指按下会中断当前绘制（drawing=false），这是有意为之，避免误画。

---

九、快速选择指南

你想… 用这个文件
直接体验最终版 (30).html
学习最简变形算法 (2).html → (3).html
理解多子路径变形 (17).html
看 SVG 图标库数据 (11).html
研究 SVG transform 解析 (22).html
研究性能优化演进 (23) → (24) → (30)
研究配置化重构 (27).html
只要一个轻量单文件 (20).html（纯矢量，无 tile 复杂度）
要图层缓存性能 (30).html
要看 UI 设计演进 (1) 深色卡片 → (12) picker → (27) 弹窗

---

十、结语

这 30 个文件记录了一次完整的"从能跑到好用"的迭代：核心变形算法从 (1) 就基本定型，之后 80% 的工作在解决边缘情况（闭合、多子路径、transform、坐标、性能）和交互完善（撤销、缩放、自定义形状）。

若只能读三份，建议 (3) 看算法、(17) 看多子路径、(30) 看最终架构。