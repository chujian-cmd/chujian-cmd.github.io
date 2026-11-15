动态文字自由落体 项目文档

一、项目简介

一个基于 Matter.js 物理引擎的文字掉落视觉工具：输入一串文字，字符逐个从画布顶部出现，可水平拖动定位，点击画布或按 Enter 后开始受重力下落，与左右墙壁、底部地面碰撞、弹跳、翻滚，最终堆叠静止。

支持自定义字体（TTF/OTF/WOFF）、实时调节重力/摩擦/回弹/密度/阻尼、整体画布旋转（旋转时重力方向同步偏转，实现"画面歪了但东西还往下掉"的视觉效果）。

技术栈：原生 HTML/CSS/JS + Matter.js 0.19.0（CDN 引入）。无构建步骤。

最终形态：动态文字自由落体 (1).html（横屏适配 + 触控版）。另一份为基线桌面版，作为演进参照。

---

二、文件总览

文件 阶段 核心特征
动态文字自由落体.html 基线 固定 900×700 画布，仅鼠标交互，桌面布局，面板 320px
动态文字自由落体 (1).html 定型 响应式画布，鼠标+触摸统一，横屏布局，面板 280px，beforeUpdate 驱动重力

主线差异（v1 → v2）：

维度 v1 基线 v2 定型
画布尺寸 固定 CW=900, CH=700 跟随容器，resizeCanvas() 自适应
交互 仅 mouse 事件 mouse + touch 统一为 handleStart/Move/End
重力方向计算 render() 末尾每帧调 updateGravityDirection() Events.on(engine, 'beforeUpdate', ...)
重力滑块 监听器直接改 engine.gravity.y（被 render 覆盖，冗余） 只改 params.gravity，由 beforeUpdate 统一计算
面板布局 320px，字号 16–120 280px，字号 16–100，横屏优化
viewport 常规 加 user-scalable=no, orientation=landscape

---

三、核心机制

3.1 文字 → 物理体

Matter.js 无法直接把文字变成碰撞体。做法：用 Canvas 的 measureText 测出文字宽度，用一个矩形近似文字外形。

```js
const metrics = mCtx.measureText(text);
const w = metrics.width;
const h = fs * 0.75;              // 高度近似：字号的 75%
Bodies.rectangle(x, y, w, h, {...}) // 碰撞箱
// 渲染时仍用 fillText，视觉上是文字本身
```

取舍：矩形碰撞箱与文字真实字形有偏差（"一"很矮、"口"很方，但都用同一高度），碰撞时会出现悬空或嵌入。好处是实现简单、性能好；若要贴合字形需做轮廓多边形，成本高很多。

3.2 待放置 / 释放流程

项目把"文字出现"和"文字下落"分成两个状态：

状态 变量 物理属性 交互
待放置 currentPendingText isStatic=true，不受重力 可水平拖动；点击空白或 Enter 释放
下落中 在 textBodies 数组中 isStatic=false，受重力 不可控，自由物理

```js
function releaseCurrentText() {
  Body.setStatic(currentPendingText.body, false);
  currentPendingText = null;
}
```

同一时刻最多只有一个待放置文字。释放后再点"添加"或 Enter 才会出现下一个。

3.3 画布旋转与重力方向同步

这是该项目最巧妙的点。画布视觉旋转 θ 度后，如果重力仍是 (0, 1)，文字会"横着掉"——因为视觉上画布歪了，但重力在世界坐标里没歪。

解法：旋转重力向量，使其在屏幕视觉上仍然垂直向下：

```js
function updateGravityDirection() {
  const rad = (params.canvasRotation * Math.PI) / 180;
  engine.gravity.x = Math.sin(rad) * params.gravity;
  engine.gravity.y = Math.cos(rad) * params.gravity;
}
```

画布旋转 90° 时，重力变为 (1, 0)（水平），但渲染时整个画面也转了 90°，两者抵消，用户看到的效果是"文字仍然垂直下落"。

v1 在 render() 末尾调用此函数（每帧渲染后算重力，下一帧物理才生效，有一帧延迟）；v2 改为 Events.on(engine, 'beforeUpdate', ...)，在物理更新前算好，更准确。

3.4 自定义字体加载

用 FontFace API 异步加载，不依赖服务器：

```js
const fontFace = new FontFace(fontName, dataURL);
const loaded = await fontFace.load();
document.fonts.add(loaded);
customFontName = fontName;  // 后续测量和渲染都用这个名字
```

字体元信息面板统计"字符数 / 唯一字形数 / 可用数"，用 measureText 逐个测宽，宽度 > 0 视为可用。

⚠️ 字体切换后旧物理体不重测：如果先输入文字并创建了 body，再上传字体，body 的宽度是按旧字体算的，渲染却用新字体，导致视觉与碰撞箱错位。规避：上传字体后点"重置"重建所有 body。

3.5 墙壁与参数联动

墙壁在 createWalls() 中按当前画布尺寸与底部留白重建：

参数 作用 联动
bottomPaddingPercent 地面距画布底部的高度 改此值 → 重建墙壁
friction / restitution 墙体材质 改此值 → 重建墙壁 + 更新已有 body
画布尺寸变化 墙壁位置 v2 未监听 resize 重建（见注意事项）

---

四、技术专题

4.1 物理与视觉的两层坐标系

· 物理层：Matter.js 世界坐标，原点在画布左上角，y 向下
· 视觉层：render() 中用 ctx.translate/rotate 做画布整体旋转

文字体渲染时，先 translate(body.position)，再 rotate(body.angle)，最后 fillText 居中——这样物理角度与视觉角度一致。

4.2 鼠标与触摸统一

v2 用一个 handleStart 同时处理两种输入：

```js
const clientX = e.touches ? e.touches[0].clientX : e.clientX;
```

点击判定用 Matter.Vertices.contains(body.vertices, point)，命中则开始拖拽，未命中则释放当前文字。

4.3 响应式画布（v2）

```js
function resizeCanvas() {
  const container = document.querySelector('.canvas-container');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
```

问题在于：canvas 尺寸变了，但 createWalls() 没重调，墙壁仍在旧尺寸位置。

4.4 参数与物理属性的应用时机

参数 生效方式
gravity 每帧 beforeUpdate 计算
friction/restitution/density/damping 改已有 body 属性 + 新建 body 时带入
fontSize 只影响新建 body，旧 body 不变
spawnHeightPercent 只影响新出现的待放置文字
bottomPaddingPercent 立即 createWalls()

---

五、技术要点汇总

· 矩形近似碰撞：文字碰撞箱 = (textWidth, fontSize * 0.75) 的矩形，简单但与字形有偏差。
· 静态 → 动态释放：Body.setStatic(body, false) 一行完成状态切换，不用删了重建。
· 重力方向旋转：(sin θ, cos θ) * g，与画布旋转角一致，保证视觉上仍竖直下落。
· 循环序列：seqIndex 到数组尾后归零，文字序列无限循环。
· 单待放置物：currentPendingText 全局唯一，新出现前先移除旧的。
· 字体异步：FontFace 加载完成后才可用于 measureText 和 fillText，存在时序问题。

---

六、目录结构建议

单文件项目，若要模块化：

```
text-fall/
├── index.html            # 布局
├── css/
│   └── panel.css         # 面板 + 画布容器样式
├── js/
│   ├── config.js         # params 默认值
│   ├── physics.js        # Matter 初始化 / 墙壁 / body 工厂
│   ├── text.js           # 测量 / 待放置 / 释放流程
│   ├── font.js           # FontFace 加载与元信息
│   ├── input.js          # 鼠标/触摸/键盘统一
│   └── render.js         # 画布旋转渲染循环
└── README.md
```

---

七、使用说明

运行

浏览器直接打开 动态文字自由落体 (1).html，需联网（Matter.js 走 CDN）。

操作流程

1. 在左侧文本框输入文字序列（用空格分隔，如 创 意 编 码）
2. 可选上传自定义字体
3. 画布顶部出现第一个待放置文字（静态），可水平拖动
4. 点击空白 / 按 Enter / 点"添加/释放" → 文字下落
5. 再点一次 → 下一个文字出现
6. 左侧面板实时调重力、摩擦、回弹、旋转等

参数建议

想要的效果 调什么
掉落更快 重力 ↑（1.0 → 2.0+）
堆得更稳 摩擦 ↑、回弹 ↓
弹得更欢 回弹 ↑（0.2 → 0.6）
下落时晃得更厉害 旋转阻尼 ↓、密度 ↓
画面倾斜但文字仍竖着掉 画布旋转 45°/90°，重力自动跟随

---

八、已知注意事项

1. 旋转后拖拽坐标错位：mousedown 用 clientX - rect.left 得到未旋转的屏幕坐标，与物理世界坐标不一致。旋转非 0° 时拖动待放置文字，鼠标位置与文字会分离。规避：在 0° 下操作，或后续修复时对鼠标坐标做逆旋转变换。
2. resize 后墙壁不更新（v2）：resizeCanvas() 改了画布尺寸但没重调 createWalls()，窗口拉伸后底部地面与实际画布底边不一致，文字可能落出画布。规避：resize 后手动改一次底部留白滑块触发重建，或修复代码。
3. 字体晚于文字上传导致错位：已创建的 body 宽度按旧字体算，视觉用新字体，碰撞箱与字形不一致。规避：上传字体后点"重置"。
4. reset 后无待放置文字：resetBtn 只清空场景，不自动 prepareNextText()，需再点一次"添加"。这是有意设计（重置后由用户决定何时开始），非 bug。
5. 矩形碰撞箱与字形偏差：字母 i、l 与 W、M 用同一矩形高度，堆叠时会有穿插或空隙。无法彻底解决，除非做字形轮廓。
6. 文字序列循环：seqIndex 到尾部自动归零，重复使用同一批文字。若想每次重新开始，需手动重置。
7. v1 重力滑块冗余：v1 的 gravityInput 监听器直接 engine.gravity.y = params.gravity，但 render() 每帧用 updateGravityDirection() 重设，直接赋值被覆盖，实际只通过 params.gravity 生效。v2 已移除该冗余。

---

九、快速选择指南

你想… 用这个
直接体验最终版 动态文字自由落体 (1).html
手机/平板横屏使用 (1).html（有触摸支持、响应式画布）
桌面固定 900×700 精确布局 基线 动态文字自由落体.html
改配置参数 两份都看 params 对象（章节三·3.5）
研究画布旋转与重力 (1).html 的 updateGravityDirection + beforeUpdate
加自定义字体 两份逻辑相同，FontFace API

---

十、结语

这个项目的核心价值不在物理引擎本身（Matter.js 已封装好），而在两个集成点：

· 文字 → 矩形碰撞体：用 measureText 测量，牺牲精度换简单
· 画布旋转 vs 重力方向：让"视觉歪了但物理正常"成立，是这个工具从"能玩"到"好看"的关键

v2 相对 v1 的改进集中在移动端适配（触摸、响应式、横屏）和重力更新时机（beforeUpdate 替代 render 末尾）。若继续迭代，最值得修的是旋转后的拖拽坐标错位和 resize 后的墙壁重建。