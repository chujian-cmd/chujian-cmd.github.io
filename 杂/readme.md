前端小工具合集 · 项目文档

一、项目简介

这不是一个单一项目，而是一组独立的前端实验与工具的合集——30+ 个 HTML 文件，覆盖 π 圆周率流式显示、MediaPipe 手势识别、3D 物理沙盒、LaTeX 拼图解析、时钟、微件、小游戏等多个主题。每份文件都是零依赖或少量 CDN 依赖的单页应用，直接打开即可运行。

技术栈：原生 HTML/CSS/JS，Canvas 2D，Three.js，MediaPipe，html2canvas，BigInt。无构建步骤。

本文档按主题而非文件名组织，因为文件之间是平行关系（少数是版本演进）。

---

二、文件总览

按主题分组，标注每组的核心文件与变体关系：

主题 文件 关系 核心要点
π 流式显示 code_20260711.html 方案 A 外部 API 分页拉取，逐位渐显
 圆周率.html 方案 B Machin 公式 + BigInt 本地计算
项目启动器 index.html 后端 A PHP start.php 提供 list/status/start
 start8.html 后端 B Termux am start 调用 shell 脚本
MediaPipe 手势 MediaPipe.html 基线 jsdelivr CDN
 MediaPipe (1).html 优化 bootcdn 镜像 + 加载错误处理
双指拉框 东京极度孤独（拉框工具）.html 独立 触摸双指间距画矩形
Vibe 分享站 vV对接（假.vibecoding 分享站，垃圾）.html 独立 纯 UI 演示，无真实交互
3D 物理沙盒 web1.html 独立 Three.js + 自研球体物理
按钮集 按钮.html 主题 A 渐变按钮 + 按压态导出
 按钮1.html 主题 B 表情按钮（圆形）
弹球打砖块 弹球.html 基线 鼠标控制挡板
 弹球 (1).html 优化 触摸精准跟随（transform）
LaTeX 转换 复读机.html 修复版 先去换行再解析 \rlap
 转换工具.html 示例版 内置 6 个拼图示例
时钟 时钟.html SVG 版 深色卡片 + SVG 指针
 时钟 (1).html Canvas 版 浅色极简
 时钟 (2).html Canvas 荧光版 指针加 shadowBlur 发光
微件仪表板 微件.html 列表式 拖拽排序（HTML5 drag）
 微件 (1).html 桌面式 绝对定位自由拖动
 微件 (2).html 移动适配 同上，尺寸/字号缩小
3D 星空 星空.html / 星空 (1).html 同一份 仅代码格式差异
治愈动画 治愈.html 独立 流体/火焰/星空/水族箱合集
三视图解谜 三视图小游戏.html 独立 投影匹配 + 关卡系统
像素挖矿 广告.html 独立 8×8 网格 + 8×8 像素小人
解压泡泡 解压.html 独立 捏泡泡 + 粒子 + 音效
视频播放 视频.html 独立 随机抖音 API 三路 fallback

说明：星空.html 与 星空 (1).html 内容几乎相同，只是代码格式差异；建议以 星空.html 为准。时钟 (1) 与 时钟 (2) 是同一 Canvas 方案的迭代，(2) 增加了荧光发光。

---

三、核心机制

3.1 π 流式显示：两种方案

方案 A · API 分页（code_20260711.html）

从 api.pi.delivery 每次取 600 位，缓存到 digitBuffer，渲染循环每帧取 4 位插入 DOM。关键设计：

参数 默认值 作用
BATCH_FETCH 600 API 单次请求位数
DIGITS_PER_FRAME 4 每帧插入数量（自适应降级）
MAX_DIGITS 800 DOM 中保留的最大数字数
SCROLL_THROTTLE_FRAMES 5 每 5 帧滚动一次

```js
// 帧率自适应：最近帧耗时 > 30ms 则减半
let count = CONFIG.DIGITS_PER_FRAME;
if (frameTimes.length > 10) {
  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  if (avg > 30) count = Math.max(1, Math.floor(count / 2));
}
```

取舍：DOM 数量到 800 就移除旧元素。视觉上滚动条持续下移，但 DOM 始终轻量。

方案 B · Machin 公式本地计算（圆周率.html）

不依赖网络，用 BigInt 实现 Machin 公式：π = 16·arctan(1/5) − 4·arctan(1/239)。每批计算 batchSize 位，追加新字符。上限 5000 位（防浏览器卡死）。

```js
function arctan5() {
  let sum = 0n, term = SCALE / 5n, div = 1n, sign = 1n;
  while (term > 0) {
    sum += sign * (term / div);
    term = term / 25n;   // 1/5² = 1/25
    div += 2n;
    sign = -sign;
  }
  return sum;
}
```

取舍：API 方案能到百万位但依赖网络；本地方案离线可用但 5000 位后 BigInt 运算明显变慢。

3.2 MediaPipe 手势拉框

用 MediaPipe Hands 检测手部 21 个关键点，取食指指尖（index 8）与拇指指尖（index 4），两点距离 > 0.04 视为"拉框"手势，用两点作为矩形对角。

```js
const INDEX_FINGER_TIP = 8;
const THUMB_TIP = 4;
const indexTip = landmarks[INDEX_FINGER_TIP];
const thumbTip = landmarks[THUMB_TIP];
const dx = indexTip.x - thumbTip.x;
const dy = indexTip.y - thumbTip.y;
if (Math.sqrt(dx*dx + dy*dy) > 0.04) {
  updateRect(indexTip, thumbTip); // 归一化坐标 0~1
}
```

⚠️ MediaPipe.html 用 jsdelivr CDN，国内可能慢；MediaPipe (1).html 改用 bootcdn 镜像，并加了 hands.initialize().catch() 错误处理和 15 秒加载超时提示。两者代码主体相同，选 (1) 更稳。

3.3 3D 物理沙盒（web1.html）

Three.js 渲染 + 自研球体物理。物理循环分 3 个子步（subDt = dt/3）提高稳定性。

物理体结构：

```js
{ position:{x,y,z}, velocity:{x,y,z}, mass, size,
  isStatic, isSleeping, sleepTimer }
```

核心碰撞：球-球碰撞用质量加权分离，球-地面用 groundY 反弹（恢复系数 0.3），世界边界 ±16.8 反弹。

取舍：所有物体都是球体近似（size 为半径），不区分形状——这是简化物理的经典做法，速度快但视觉上立方体滚动时像球。

3.4 LaTeX \rlap 拼图解析

把 LaTeX 里用 \rlap{\kern{...}\raisebox{...}\textcolor{...}{\rule{w}{h}}} 排列的方块，解析为 Canvas 矩形绘制。

关键修复（复读机.html）：原始文本可能跨行，导致正则 [^}]* 匹配失败。做法是先去掉所有换行和多余空格，再匹配：

```js
let content = text.replace(/\s+/g, ' ');   // 关键：合并跨行
const regex = /\\rlap\{([^}]*)\}/g;
// 从内层提取 kern / raisebox / textcolor / rule
```

坐标变换：y 从下往上（LaTeX 习惯），Canvas 从上往下，需翻转：

```js
const y = (maxY - (b.y + b.h)) * scale;
```

转换工具.html 是同一解析器 + 6 个内置示例（圣诞树、爱心、菱形、笑脸、旗帜、绿树），适合直接体验。

3.5 微件拖拽：两种交互模型

列表排序（微件.html）：HTML5 dragstart/dragover/drop，dataTransfer 传 id，drop 时交换数组顺序后整体重渲染。

自由拖动（微件 (1) / (2)）：绝对定位 + mousedown/touchstart 手动计算偏移，left/top 实时更新并写回 widget.x/y。

```js
function onPointerMove(e) {
  const dx = (touch.clientX - dRect.left) - startX;
  const dy = (touch.clientY - dRect.top) - startY;
  let newX = clamp(origX + dx, 0, desktopRect.width - w);
  let newY = clamp(origY + dy, 0, desktopRect.height - h);
  div.style.left = newX + 'px';
  widget.x = newX;  // 实时同步数据
}
```

(2) 是 (1) 的移动端适配版：更小的尺寸、更小的字号、更紧的 taskbar。选 (2) 兼顾桌面和手机。

3.6 3D 星空：手动透视投影

1800 颗星星在球壳内均匀分布，用极坐标转笛卡尔：

```js
const theta = Math.random() * Math.PI * 2;
const phi = Math.acos(2 * Math.random() - 1);
x = r * Math.sin(phi) * Math.cos(theta);
y = r * Math.sin(phi) * Math.sin(theta);
z = r * Math.cos(phi);
```

每帧对每颗星做两次旋转（Y 轴 azimuth、X 轴 pitch），再透视投影：

```js
const scale = focalLength / z2;  // z2 为旋转后深度
const sx = width/2 + x2 * scale;
const sy = height/2 - y2 * scale;
const size = star.size * Math.min(1.8, Math.max(0.3, 500/z2));
```

交互：鼠标/触摸拖拽控制视角；移动端支持陀螺仪（iOS 13+ 需 DeviceOrientationEvent.requestPermission()）。拖拽期间 window.ignoreGyro = true 屏蔽陀螺仪，避免冲突。

3.7 三视图投影匹配（三视图小游戏.html）

5×5 地面网格上放置方块（3 种灰度），要求两面墙上的投影匹配目标图案。

投影规则（简化版）：同一 (y,z) 位置有多个方块时，取灰度值最大的（浅色覆盖深色）。

```js
state.blocks.forEach(({x, z, gray}) => {
  const key = `0,${z}`;
  if (!projL[key] || gray > projL[key]) projL[key] = gray;
});
```

匹配检测逐格比较 target[y][z] 与 projL[key]，全等则通关。使用 Three.js OrthographicCamera 做等轴测视角。

---

四、技术要点汇总

· 帧率无关动画：多数项目用 requestAnimationFrame + 每帧固定增量（如 progress += 0.018），简单但不同刷新率速度不同。若需严格帧率无关，应改用 performance.now() 时间戳差值。
· Canvas 高 DPR：canvas.width = cssW * dpr; ctx.setTransform(dpr,0,0,dpr,0,0) 是标准做法，解压.html、拉框工具 都用了。
· HTML5 drag vs 手动拖拽：列表排序用 HTML5 drag 最省事；自由定位拖动必须手动算偏移，且要 setPointerCapture 防丢事件。
· CDN 双源：MediaPipe 用 jsdelivr 和 bootcdn 两份；抖音视频 API 备了 3 个域名轮询。国内访问稳定性是这类 CDN 依赖项目的通病。
· BigInt 计算 π：Machin 公式收敛快（每项约 1.4 位十进制），但 BigInt 除法随位数增长而变慢，5000 位是合理上限。
· localStorage 持久化：微件、自定义形状都用 localStorage，注意配额（约 5MB），大对象要压缩坐标精度（coordDecimals）。

---

五、使用说明

运行

所有文件均为单页 HTML，直接用浏览器打开即可。少数依赖：

文件 外部依赖 说明
code_20260711.html api.pi.delivery 需联网；离线会 fallback 到内置 100 位
MediaPipe*.html MediaPipe CDN + 摄像头 需 HTTPS 或 localhost 才能请求摄像头
web1.html / 三视图小游戏.html Three.js (unpkg) 需联网加载
按钮*.html html2canvas (cdnjs) 导出功能需要
index.html / start8.html 后端 start.php / Termux 无后端时只显示错误
视频.html 3 个抖音 API 可能全部跨域失败

环境要求

· 现代浏览器（Chrome / Edge / Safari 较新版）
· 手势识别需摄像头权限
· 移动端需支持触摸事件与 pointer 事件

---

六、已知注意事项

1. MediaPipe 加载慢：首次加载模型 10–30 秒，MediaPipe (1).html 加了 15 秒超时提示。jsdelivr 在国内可能被墙，优先用 bootcdn 版本。
2. getScreenCTM 在隐藏 SVG 上返回 null：从 SVG 字符串提取轮廓时不能用 getScreenCTM，需手动解析 transform 矩阵（本项目未涉及，但同类需求常见）。
3. LaTeX 跨行是最大坑：\rlap{...} 跨行时正则 [^}]* 会截断。复读机.html 的修复是先去换行再解析，这是唯一可靠做法。
4. 弹球触摸漂移：弹球.html 用 getBoundingClientRect() 算挡板位置，某些缩放下会偏。弹球 (1).html 改用 transform: translateX() 直接设置，无延迟。
5. 微件拖拽内存泄漏：微件 (1) 的拖拽监听挂在 document 上，删除微件时必须调 _cleanup() 移除，否则越拖越卡。
6. 星空陀螺仪权限：iOS 13+ 需在用户手势（如点击）后调 DeviceOrientationEvent.requestPermission()，页面加载时直接请求会被拒。
7. π API 限流：api.pi.delivery 无认证但有限流，RETRY_DELAY 指数退避（1.2s × 重试次数）。
8. 视频 API 跨域：三个抖音 API 都可能返回 CORS 错误，视频.html 的 fallback 只是"再试下一个"，不是真修复。需要后端代理才能真正解决。

---

七、快速选择指南

你想… 用这个文件
看 π 流式显示的极致流畅 code_20260711.html
离线算 π（不依赖网络） 圆周率.html
试手势识别拉框 MediaPipe (1).html
手机双指拉框（不依赖摄像头） 东京极度孤独（拉框工具）.html
玩 3D 物理沙盒 web1.html
导出渐变按钮 PNG 按钮.html
导出表情按钮 PNG 按钮1.html
手机打砖块（挡板精准跟随） 弹球 (1).html
解析 LaTeX \rlap 拼图 转换工具.html（带示例）
深色系时钟（SVG） 时钟.html
极简浅色时钟（Canvas） 时钟 (1).html
荧光指针时钟 时钟 (2).html
微件列表拖拽排序 微件.html
桌面自由拖拽微件（手机友好） 微件 (2).html
3D 星空（拖拽 + 陀螺仪） 星空.html
多动画治愈合集 治愈.html
三视图投影解谜游戏 三视图小游戏.html
像素挖矿小游戏 广告.html
解压捏泡泡 解压.html
学 UI 设计（玻璃质感/渐变） vV对接（假.vibecoding 分享站，垃圾）.html
本地起服务管理多项目 start8.html（Termux）或 index.html（PHP）

---

八、结语

这批文件是典型的"实验集"——每个文件解决一个具体的小问题，代码量大但彼此独立。阅读建议：先按主题找到你关心的那一组，只看该组的 1–2 个代表文件，不必通读全部。

若要把它们整合成一个真正的项目，建议按主题拆成模块：utils/（resample、bbox 等通用几何函数）、widgets/（微件系统）、games/（小游戏）、demos/（演示）。但就当前形态而言，保持单文件独立分发反而是优点——复制即用，无构建负担。