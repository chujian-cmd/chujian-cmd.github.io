流体烟雾壁纸 项目文档

一、项目简介

一个基于 WebGL 流体模拟 的交互式烟雾壁纸：手指或鼠标在画面上滑过，会推出带流体力学行为的彩色烟雾——有涡旋、有推挤、有体积光影、有径向光晕。基于 Pavel Dobryakov 的 WebGL-Fluid-Simulation（MIT）移植与改造。

21 个文件记录了从"直接引用 CDN 库"到"完全内联自实现"，再到"性能优化"与"还原原版效果"的完整演进。核心矛盾是：原版效果漂亮但开销大，改造中反复在"视觉还原度"与"移动端帧率"之间取舍。

技术栈：原生 HTML + WebGL（glsl 着色器）+ Canvas 2D（部分变体）。无构建步骤。

最终形态：(21).html。本文档以它为主，其余版本作为演进参照与备选方案。

---

二、文件总览

按技术路线而非文件名排序：

路线 A：CDN 依赖（webgl-fluid@0.3）

文件 风格 关键参数
(1) 紫色梦幻 全特效开，DYE 1024，CURL 30
(2) 暗夜极简 关 COLORFUL/BLOOM/SUNRAYS，CURL 40
(5) 静态暗夜 同上，DENSITY 1.5，尝试伪注入初始点
(8) 彩色轮换 每 6 秒 setConfig 换色

路线 B：Canvas 2D 纯手写（无 WebGL）

文件 实现 关键手法
(3) 圆形烟雾粒子 径向渐变 sprite，250 上限，lighter 混合
(4) 云团拉伸 12 控制点弹簧模型 + CSS blur(20px)
(6) 纯净圆团 80 上限，decay 0.008
(7) 柔光晕 60 上限，插值生成，size 缓慢增长

路线 C：内联自实现（脱离 CDN）

文件 阶段 核心变化
(9) 移植 完整内联 Pavel 原版 script.js
(10) 配置化 CONFIG 集中，背景色 + tone mapping
(11) 稳定 displayProgram texelSize 修复、链接错误日志
(12) 防黑屏 resize 后补 multipleSplats
(13) 触摸修复 Touch 用 clientX - rect.left（原用 offsetX）
(14) 色相旋转 逐像素 HSV，暗部裁剪
(15) 空间色相 位置 + 时间双重偏移，斜向流动
(16) 软裁剪 smoothstep 消除暗部硬边
(17) 重复 (16) 的副本
(18) 性能优化 DYE 512、色相移到 splat 层、移动端降档、按需编译
(19) 重复 (18) 的副本
(20) 恢复光晕 径向 sunrays 回归，bloom 乘光晕遮罩
(21) 定型 完整还原原版：径向 16 次迭代、4 邻域 bloom、dithering 噪声、随机色相、空格爆炸

主线：(1) → (9) → (13) → (18) → (21)

关键取舍链：

```
CDN 库（快但不可控）
  ↓ 要改参数、修触摸
内联（9）
  ↓ 发现触摸失效、黑屏、坐标错
修复（13）
  ↓ 移动端卡顿
性能优化（18）—— 牺牲部分视觉效果
  ↓ 视觉变差，要恢复
还原原版（21）—— 用程序化噪声替代图片、按需编译
```

---

三、核心机制

3.1 WebGL 流体模拟流程

每帧 step(dt) 依次执行 GPU 上的 6 个 pass：

顺序 Pass 作用 着色器
1 curl 计算涡度（速度场旋度） curlProgram
2 vorticity 涡度约束力，产生卷曲 vorticityProgram
3 divergence 速度场散度 divergenceProgram
4 pressure Jacobi 迭代解泊松方程 pressureProgram（迭代 N 次）
5 gradientSubtract 减压力梯度，投影到无散度 gradientSubtractProgram
6 advection 沿速度场搬运染料与速度 advectionProgram（两次）

核心数据结构是 dye（染料/颜色）和 velocity（速度场），都是 DoubleFBO（读写双缓冲，每 pass 后 swap）。

```js
// 典型 pass 写法：绑定输入 → 设 uniform → blit 到输出 → swap
curlProgram.bind();
gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
blit(curl);
```

3.2 关键参数表（(21) 定型值）

参数 桌面 移动 含义
SIM_RESOLUTION 96 64 速度/压力场分辨率，直接影响物理精度
DYE_RESOLUTION 512 384 染料分辨率，影响烟雾清晰度
DENSITY_DISSIPATION 1.0 1.0 染料衰减，越大散得越快
VELOCITY_DISSIPATION 0.2 0.2 速度阻力，越小滑得越远
PRESSURE_ITERATIONS 12 8 Jacobi 迭代次数，越多压力场越准
CURL 30 30 涡度强度，越大卷曲越明显
SPLAT_RADIUS 0.25 0.25 手指笔刷半径
SPLAT_FORCE 6000 6000 拖动力度
BLOOM_ITERATIONS 5 3 泛光金字塔层数
SUNRAYS_RESOLUTION 196 128 光晕分辨率

注意 DENSITY_DISSIPATION 是每秒衰减率（decay = 1 + dissipation * dt），不是每帧。0.96 表示每秒保留 96%（约 43 秒后剩 1%），1.0 表示完全不衰减。

3.3 色相旋转的三种实现

这是 (14)~(18) 反复改的核心。代价差异极大：

方案 位置 开销 效果
逐像素 HSV（(14)(15)） display shader 每个像素 rgb↔hsv 两次，全屏最高开销 可做空间偏移（斜向彩虹）
空间偏移（(15)） 同上 + 位置混合 同上 左侧红→右侧蓝的流动感
splat 层色相（(18) 起） generateColor() 零逐像素开销 只在"新烟雾生成时"变色

(18) 的关键发现：色相旋转不必每像素算，只在生成 splat 时算一次即可——已经在场上的染料颜色不需要变，只要新推入的染料颜色不同，整体就有流动感。

```js
// (18) 起的做法：splat 层旋转色相，display 完全不管
function generateColor() {
    const hsv = PALETTE_HSV[...];
    const h = (hsv.h + hueShift) % 1.0;
    return hsv2rgb(h, hsv.s, hsv.v);
}
```

代价：失去"空间渐变"效果（左右不同色）。(21) 最终采用原版的完全随机色相（HSVtoRGB(Math.random(),1,1)），因为没有固定调色板反而更自然。

3.4 背景纯黑与暗部裁剪

黑底壁纸最容易出问题的是"烟雾散尽后残留暗色雾霭"。多次迭代后定型为软裁剪：

```glsl
// 先 tone mapping 压缩到 [0,1)，再 smoothstep 平滑归零
c = c / (1.0 + c);
float lum = max(c.r, max(c.g, c.b));
float bgMask = smoothstep(THRESHOLD - SOFTNESS, THRESHOLD + SOFTNESS, lum);
c *= bgMask;
c += uBackColor;
```

相比 (14) 的硬判断（if (lum < T) c = 0），smoothstep 版本在阈值附近平滑过渡，无硬边。

3.5 Sunrays（径向光晕）

(21) 完整还原原版：先提取亮度遮罩，再从屏幕中心向外做 16 次迭代的径向光线积累。

```glsl
// sunrays 片元着色器核心：沿 vUv-0.5 方向反复采样，每次衰减
vec2 dir = vUv - 0.5;
dir *= (1.0 / float(ITERATIONS)) * Density;  // 0.3
float illuminationDecay = 1.0;
for (int i = 0; i < ITERATIONS; i++) {
    coord -= dir;
    color += texture2D(uTexture, coord).a * illuminationDecay * weight;
    illuminationDecay *= Decay;  // 0.95
}
```

成本：16 次纹理采样 × 光晕分辨率像素量。移动端把它降到 128 分辨率。

(18) 曾为省性能关闭 sunrays，导致视觉变平淡；(20)(21) 恢复并保留性能优化，靠"降分辨率 + 只 blur 1 次"来平衡。

3.6 触摸坐标修复（(13) 的关键）

原版脚本用 e.offsetX 取鼠标坐标，但 Touch 对象没有 offsetX，移动端全失效。

```js
// ❌ 错：touch.offsetX 是 undefined
const posX = scaleByPixelRatio(touch.offsetX);

// ✅ 对：用 clientX 减去 canvas 边界
const rect = canvas.getBoundingClientRect();
const posX = scaleByPixelRatio(touch.clientX - rect.left);
const posY = scaleByPixelRatio(touch.clientY - rect.top);
```

这是 (9)~(12) 在移动端"完全没反应"的根因。

---

四、性能专题（(18) 的优化清单）

优化项 改动 收益
染料分辨率 1024 → 512 advection 像素量 ↓4x
模拟分辨率 128 → 96 压力迭代总像素 ↓约 2x
色相旋转 display → splat 零逐像素开销
Sunrays 关（后恢复） 省 16 次采样/pixel
Bloom 迭代 8 → 5 少 3 层金字塔
压力迭代 20 → 12 少 8 次全屏 pass
移动端降档 SIM 64 / DYE 384 / 关 SHADING / BLOOM 3 帧率翻倍
按需编译 关闭的功能不编译 shader 启动更快、显存更少
像素预算 MAX_PIXELS 上限 4K 屏不卡死
页面隐藏暂停 visibilitychange 后台不耗电
计时器 Date.now → performance.now 不受系统时间跳变影响

像素预算的实现：

```js
const pixels = w * h;
if (pixels > config.MAX_PIXELS) {
    const scale = Math.sqrt(config.MAX_PIXELS / pixels);
    w = Math.floor(w * scale); h = Math.floor(h * scale);
}
```

4K 屏（3840×2160×DPR²）如果全分辨率渲染，光染料 FBO 就要数百 MB。限制到 250 万像素（桌面）/120 万（移动），画质损失肉眼几乎不可见，但内存与带宽骤降。

---

五、技术要点汇总

· DoubleFBO 双缓冲：每个 pass 读 A 写 B，然后 swap，避免读写同一纹理。
· FBO 格式降级：优先 WebGL2 的 RGBA16F/RG16F/R16F，失败则回退 WebGL1 的 RGBA，再失败用 NEAREST 过滤（需手动 bilerp）。
· blit 全屏四边形：一次建 VBO，所有 pass 复用；切换目标时只改 viewport 与 framebuffer。
· dithering 纹理：(21) 用 64×64 程序化随机噪声替代原版的 LDR_LLL1_0.png 图片，避免额外资源请求。
· Bloom 4 邻域：(21) 从 (20) 的"左右 2 邻域"改回原版的"上下左右 4 邻域"，光晕更均匀。
· dt 截断：Math.min(dt, 0.016666) 防止切标签页回来时时间跳变导致物理爆炸。
· 空格随机爆炸：(21) 恢复原版行为——按空格触发 splatStack.push(random(5~24))，而非点击触发。

---

六、目录结构建议

单文件项目，若模块化：

```
fluid-wallpaper/
├── index.html
├── css/
│   └── style.css           # 全屏 canvas + hint
├── js/
│   ├── config.js           # CONFIG + 设备探测
│   ├── gl-context.js       # WebGL 上下文与格式协商
│   ├── shaders/            # 各 pass 的 glsl 源码
│   ├── program.js          # Program 类 + 编译工具
│   ├── fbo.js              # createFBO / DoubleFBO / 重分配
│   ├── sim.js              # step() 主循环
│   ├── render.js           # bloom / sunrays / display
│   ├── input.js            # 鼠标/触摸/键盘
│   └── main.js             # 启动与 resize
└── README.md
```

---

七、使用说明

运行

浏览器直接打开 (21).html，需支持 WebGL（现代浏览器均支持）。无网络请求（dithering 纹理程序化生成）。

操作

操作 效果
鼠标/单指拖拽 推出烟雾
多指同时拖拽 多个烟雾源
空格键 随机位置爆发大量烟雾
双指缩放 浏览器页面缩放（未拦截）

想改风格（改 (21) 的 CONFIG）

目标 改什么
烟雾更细腻 DYE_RESOLUTION ↑ 到 768/1024
烟雾散得更快 DENSITY_DISSIPATION ↑ 到 1.2~1.5
卷曲更夸张 CURL ↑ 到 40~50
笔刷更大 SPLAT_RADIUS ↑ 到 0.4
纯黑白 COLORFUL: false（需改 generateColor 返回白色）
去掉光晕 SUNRAYS: false
去掉泛光 BLOOM: false
提高移动端帧率 调低 SIM_RESOLUTION/DYE_RESOLUTION/MAX_PIXELS

环境要求

· WebGL 1 或 2
· 支持 Float/HalfFloat 纹理渲染的 GPU（极老设备会降级到 256 染料分辨率）
· 触摸设备需浏览器支持多指 TouchEvent

---

八、已知注意事项

1. 移动端触摸"没反应"：多半是用了 (9)~(12) 版本（touch.offsetX 为 undefined）。换 (13) 及之后版本，或按 3.6 节修改。现象：手机上滑动无烟雾。
2. 切标签页回来画面"炸开"：dt 未截断导致单帧推进过大，速度场数值爆掉。(21) 已用 Math.min(dt, 0.016666) + visibilitychange 暂停规避。
3. (18) 视觉比 (1) 平淡：因为关了 SUNRAYS 又把色相移到 splat 层。若只要效果不要性能，直接用 (21)。
4. 窗口 resize 后画面变黑：FBO 尺寸变了但内容丢失。(12) 起在 resize 后补 multipleSplats 重新撒点；(21) 同时用 120ms debounce 避免频繁重建。
5. Safari 上 blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA) 残留：早期版本 display 前未 gl.disable(gl.BLEND)，导致 FBO 内容被跨帧累积成白斑。(13) 起显式禁用。
6. (3)(4)(6)(7) 与 WebGL 版是两条技术路线：Canvas 2D 版没有真实流体力学，靠"圆团 + lighter 混合 + 拖影"模拟烟雾。优点是零依赖、低功耗；缺点是推挤感弱、无法做涡旋。不要混用参数。
7. CDN 版 (1)(2)(5)(8) 的网络依赖：离线环境会白屏。若需单文件分发，用 (21)。

---

九、快速选择指南

你想… 用这个
最终效果、性能均衡 (21).html
移动端流畅优先 (18).html（牺牲光晕与色彩层次）
桌面高画质 (21) 并把 DYE_RESOLUTION 提到 1024
极简暗夜紫调 (2).html 或 (5).html
彩色轮换背景 (8).html
不要 WebGL、省电 (3).html（圆形粒子）或 (7).html（柔光晕）
学习流体算法逐 pass 实现 (9).html（最接近原版注释风格）
学习性能优化思路 (18).html
学习触摸坐标坑 (13).html

---

十、结语

这 21 个文件是一条"从用库到写库，再到在性能与视觉之间找平衡"的完整曲线。技术上有两个真正的分水岭：

· (13)：修复触摸坐标——从"桌面能玩"到"移动端能玩"
· (18)→(21)：从"为了帧率砍效果"到"用更聪明的方式保效果"（色相前移、dithering 程序化、按需编译）

若只读三份，建议 (9) 看完整实现、(13) 看移动端修复、(21) 看最终定型。若只求一份能用的，直接 (21).html。