霓虹光绘 · Neon Light Painting 项目文档

本文档整理项目目录下的 霓虹光绘系列（22 个版本）、VR 视差测试 与 摇一摇测试 共 25 个 HTML 文件。与前一份《竞技场枪战》文档无关，是独立的一套「传感器驱动 3D 光绘」实验项目。

---

一、项目简介

霓虹光绘是一款基于 Three.js 的 3D 交互式光绘 Demo。核心创意：

用手机传感器"画"出悬浮在 3D 空间中的霓虹光带。

两种输入方式：

· 甩动手机：三轴加速度计检测线性加速度 → 转化为"光笔"在空间中的速度
· 滑动屏幕：手指在屏幕上滑动 → 光笔跟随手指在相机前方 7 单位处的投影点

同时手机的方向传感器（陀螺仪）驱动相机朝向，让用户能"环视"自己画出的光绘。

全部实现为单文件 HTML，仅依赖 three.min.js（本地或 CDN）。

---

二、文件总览

2.1 核心系列（本地 three.min.js）

文件名 阶段 核心变化
3D 霓虹.html 基线 加速度 → 光笔速度、四元数相机跟随、Additive 混合光带
3D 霓虹 (1).html 触屏增强 加入指针/触摸绘制，与传感器并行
3D 霓虹 (2).html 权限重构 简化为触摸优先 + iOS 权限延迟请求
3D 霓虹 (3).html 摇一摇式 改为相邻帧差分（模仿摇一摇逻辑），并加入球形软边界
3D 霓虹 (4).html 权限串行 串行请求 DeviceOrientation / DeviceMotion，失败不重试
3D 霓虹 (5).html 调试版 加入实时 HUD（加速度、速度、点数、事件计数）
3D 霓虹 (6).html 物理成熟 重力低通滤波 + 线性加速度按 dt 积分，手感与事件频率解耦
3D 霓虹 (7).html 光带增厚 双正交平面光带（24 顶点/段），任意角度都有体积感
3D 霓虹 (8).html 轨迹持久化 不再按时间删点，只按总数上限挤出最老点
3D 霓虹 (9).html 综合版 持久化 + 双平面 + 去掉 per-point power（亮度更稳）
3D 霓虹 (10).html billboard 光带 侧向量按视线计算，宽度与视角无关，回归 12 顶点/段
3D 霓虹 (11).html 淡出曲线 加入 HOLD_RATIO + smoothstep，两端导数≈0，无突然熄灭
3D 霓虹 (12).html 落笔飞行 手指按下时用 ease-out cubic 从旧位置飞到落点
3D 霓虹 (13).html 注释完善 所有参数逐个中文注释，代码结构与 (12) 相同
3D 霓虹 (14).html 科幻增强 星空粒子、动态网格、尘埃粒子、双层光带（主辉光 + 细芯）

2.2 CDN 版系列

文件名 核心变化
3D 霓虹CDN 版 (13).html 与本地版 (13) 内容相同，仅 Three.js 从 CDN 加载
3D 霓虹CDN 版 (14).html 首次引入 VR 视差：手机前后移动 → 相机前后位移（初版）
3D 霓虹CDN 版 (15).html 视差改为标量偏移（vrOffset），更稳定
3D 霓虹CDN 版 (16).html 加入完整 HUD 调试面板（α/β/γ、运动计数、视差量）
3D 霓虹CDN 版 (17).html 加入全局错误捕获，任何 JS 错误直接显示在 HUD
3D 霓虹CDN 版 (18).html VR 灵敏度大幅提高（VR_GAIN 0.01 → 0.55），死区降低
3D 霓虹CDN 版 (19).html 视差改用设备原始 z 轴（lz）作为前后信号，减少坐标变换误差
3D 霓虹CDN 版 (20).html 视差简化为"直接平移相机世界 Z"，参数调优
3D 霓虹CDN 版 (21).html VR 灵敏度再次 ×5（VR_GAIN = 3.0），加入旋转开关按钮
3D 霓虹CDN 版 (22).html 三轴全方位视差：X/Y/Z 都跟随手机平移（X/Y/Z 各独立阻尼）

2.3 独立测试文件

文件名 用途
vr 测试.html 极简视差测试：倾斜手机让立方体跟着动，用于验证重力传感器是否工作
测试.html 摇一摇广告页：晃动手机触发跳转，验证 accelerationIncludingGravity 的差分逻辑

---

三、核心机制

3.1 光笔物理模型

光笔是相机前方一个悬浮点，位置 penPos 随时间积分：

传感器模式

```
线性加速度 a（去重力） → 死区过滤 → 积分成速度 penVel
penVel 每帧按 dt 阻尼衰减（VEL_DAMP）
penPos += penVel * dt
球形软边界：|penPos| 被限制在 [BOUND_MIN, BOUND_MAX]
```

关键参数（以 3D 霓虹 (13).html 为准）：

```js
VEL_DAMP   = 0.28    // 速度每秒保留 0.28 倍
MAX_SPEED  = 22      // 最大速度
BOUND_MIN  = 3.0     // 离原点最近距离
BOUND_MAX  = 11.0    // 离原点最远距离
MOTION_DEAD = 1.6    // 加速度死区（m/s²）
MOTION_GAIN = 5.5    // 加速度 → 速度增益
GRAV_TAU    = 0.35   // 重力低通时间常数（秒）
```

触摸模式

```
手指坐标 → 相机前方 TOUCH_DIST=7 处平面 → touchTarget
penPos 以指数方式逼近 touchTarget
```

落笔飞行（从 (12) 起）

```
按下时计算 penPos 与 touchTarget 的距离
距离 > WARP_MIN_DIST 时启动飞行
用 ease-out cubic 在 WARP_BASE + dist*WARP_PER_UNIT 秒内飞到落点
（时长上限 WARP_MAX）
```

3.2 相机朝向

使用 Three.js 官方 DeviceOrientationControls 的四元数算法：

```js
_euler.set(beta, alpha, -gamma, 'YXZ')
targetQuat.setFromEuler(_euler)
targetQuat.multiply(q1)   // 绕 X 轴 -90°，修正"竖屏朝前"
targetQuat.multiply(q0.setFromAxisAngle(Z_AXIS, -screenAngle))

// 每帧 slerp 到 targetQuat，半衰期 CAM_SMOOTH
```

3.3 光带渲染（演进核心）

霓虹感的关键是 AdditiveBlending + 大量重叠。光带几何随版本演进：

阶段 1：单层 + 面向相机四边形（(1) - (9)）

每段 12 顶点 = 外发光四边形（6）+ 高亮芯四边形（6）。

侧向量 = cross(线段方向, 线段中点方向)，其中"中点方向"即视线方向。

问题：当线段运动几乎沿径向时，中点方向与线段方向近乎平行，cross 退化 → 光带突然消失或翻转。

阶段 2：双正交平面（(7)、(9)）

每段 24 顶点，两组互相垂直的平面叠加，任何视角都不会侧看变线。
但代价是顶点数翻倍，且宽度随视角变化。

阶段 3：billboard 光带（(10) 起，正式方案）

```
_viewDir = normalize(线段中点 - 相机位置)
_side = normalize(cross(_dir, _viewDir))
```

· _side 始终垂直于视线 → 躺在屏幕平面内
· _side 始终垂直于线段方向 → 是屏幕空间中垂直于线段投影的方向
· 因此屏幕上宽度恒定 = 2 × GLOW_W，与视角完全无关

每段回归 12 顶点（主辉光 6 + 高亮芯 6），性能最优。

阶段 4：双层光带增强（(14) 科幻版）

额外叠加一层更细更白的"锐芯"，强化霓虹灯管的锐利感。

3.4 淡出曲线（(11) 起）

```js
function fadeAt(age) {
  const u = age / POINT_LIFE;
  if (u >= 1) return 0;
  if (u <= HOLD_RATIO) return 1;          // 前半段满亮
  const t = (u - HOLD_RATIO) / (1 - HOLD_RATIO);
  const s = 1 - t;
  return s * s * (3 - 2 * s);             // smoothstep 平滑淡出
}
```

· 前 50% 寿命（默认 4 秒）保持满亮度
· 后 50% 用 smoothstep 平滑渐隐
· 两端导数都≈0 → 不会"到点突然熄灭"

3.5 轨迹采样与老化

```js
MIN_SEG = 0.05  // 相邻点最小间距
```

· 每帧对 penPos 采样，间距不足 MIN_SEG 则跳过
· 每个点只存 age（从 (11) 起去掉 per-point power，亮度统一）
· 每帧对所有点 age += dt
· age >= POINT_LIFE 的点从头部批量删除（splice 一次代替多次 shift）

---

四、传感器权限处理（重点）

4.1 iOS 13+ 的坑

iOS 13+ 要求 DeviceOrientationEvent.requestPermission() 和 DeviceMotionEvent.requestPermission()：

· 必须在用户手势（click/touchstart）内同步调用
· 且必须先拿到权限，再绑定 addEventListener——否则即使授权成功，监听器也收不到数据

早期版本 (1)(2)(3) 在加载时直接绑定监听器，导致 iOS 上"怎么摇都没反应"。

4.2 正确做法（(6) 起定型）

```js
// 1. 判断是否需要权限
function needsPermission() {
  return typeof DeviceMotionEvent.requestPermission === 'function' ||
         typeof DeviceOrientationEvent.requestPermission === 'function';
}

// 2. 串行请求（避免并行弹窗失效）
function requestAndBind() {
  if (sensorsBound || requesting) return;
  if (!needsPermission()) { bindSensors(); return; }   // Android 直接绑
  if (permissionState === 'denied') return;             // 拒过就不再骚扰

  requesting = true;
  const steps = [];
  if (DeviceOrientationEvent.requestPermission) steps.push(() => DeviceOrientationEvent.requestPermission());
  if (DeviceMotionEvent.requestPermission)      steps.push(() => DeviceMotionEvent.requestPermission());

  let granted = false;
  let chain = Promise.resolve();
  steps.forEach(step => {
    chain = chain.then(() => step().then(r => { if (r === 'granted') granted = true; }));
  });
  chain.then(() => {
    requesting = false;
    if (granted) { permissionState = 'granted'; bindSensors(); }
    else permissionState = 'denied';
  });
}

// 3. 只在 pointerdown / touchstart 里调用
canvas.addEventListener('pointerdown', () => { requestAndBind(); ... });
```

4.3 切回前台时的重置

```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  resetMotion();       // gravityReady = false, lastMotionTime = 0
  clock.getDelta();    // 丢弃积压的 dt
});
```

避免后台切回来时第一帧 dt 巨大导致速度爆炸。

---

五、VR 视差（CDN 版 (14) - (22) 的核心）

5.1 设计目标

在原有光绘基础上，用手机前后/左右/上下移动带动相机位置变化，让静态画出的光带产生 3D 透视感——类似"走到画作侧面看"。

5.2 参数演进（核心调试过程）

版本 VR_GAIN VR_DEADZONE 方案
(14) 0.008 0.8 初版，用相机局部 Z 分量
(15) 0.0012 0.35 改为标量 vrOffset
(16) 0.010 0.25 加 HUD 调试
(17) 0.010 0.25 加全局错误捕获
(18) 0.55 0.05 灵敏度 ×55
(19) 2.5 0.03 用设备原始 z 轴
(20) 0.60 0.20 位置回中方案
(21) 3.0 0.08 + 旋转开关
(22) 3.0 0.08 三轴全方位

5.3 两种实现方案对比

方案 A：相机位置偏移（(14)(15)(16)(17)）

```js
// 加速度 → 速度 → 位置偏移
vrVel += frontBackAcc * VR_GAIN * dt;
vrVel *= Math.pow(VR_VEL_DAMP, dt);
vrOffset += vrVel * dt;
vrOffset *= Math.pow(VR_POS_DAMP, dt);   // 回中力，防漂移

// 应用到相机位置（沿相机局部 Z 轴）
camera.position.copy(
  new THREE.Vector3(0, 0, 1)
    .applyQuaternion(camera.quaternion)
    .multiplyScalar(vrOffset)
);
```

方案 B：直接平移相机世界 Z（(20)(21)）

```js
camera.position.set(0, 0, vrOffset);   // 简单粗暴，但效果稳定
```

5.4 三轴全方位（(22)）

```js
const vrOffset = new THREE.Vector3();
const vrVel    = new THREE.Vector3();

// 三轴独立处理
const axes = [lx, ly, -lz];
for (let i = 0; i < 3; i++) {
  let v = axes[i];
  if (Math.abs(v) <= VR_DEADZONE) continue;
  v = (v > 0 ? 1 : -1) * (Math.abs(v) - VR_DEADZONE);
  let nv = vrVel.getComponent(i) + v * VR_GAIN * dt;
  nv = clamp(nv, -8, 8);
  vrVel.setComponent(i, nv);
}

// 每帧积分 + 阻尼 + 回中 + 限幅
```

让用户平移手机（不是倾斜），光带就跟着产生 3D 视差。

5.5 旋转开关（(21) 起）

由于视差要求"手机朝向稳定"，而陀螺仪驱动的相机旋转会与视差冲突，因此加入开关：

```js
let rotationEnabled = true;
rotBtn.addEventListener('click', () => {
  rotationEnabled = !rotationEnabled;
  if (!rotationEnabled) {
    camera.quaternion.identity();
    orientReady = false;
  }
});
```

关闭旋转后，相机朝向固定为默认（看向 -Z），视差感更明显。

---

六、独立测试文件

6.1 vr 测试.html

作用：验证手机重力传感器是否正常，以及重力方向能否驱动视差。

原理：

```js
// 极慢低通（时间常数 1 秒）估计重力方向
const k = 1 - Math.exp(-dt / 1.0);
gx += (ag.x - gx) * k;
gy += (ag.y - gy) * k;
gz += (ag.z - gz) * k;

// 第一次拿到稳定重力 → 标定为零点
if (!calReady) { gx0 = gx; gy0 = gy; gz0 = gz; calReady = true; }

// 相对倾斜 → 相机偏移
const dgx = gx - gx0, dgy = gy - gy0, dgz = gz - gz0;
camX = -dgx * GAIN_X;
camY = -dgy * GAIN_Y;
camZ =  dgz * GAIN_Z;
```

用途：如果这个页面里立方体跟着手机倾斜动，说明传感器链路完全正常，可以放心调试 3D 霓虹 的视差。

6.2 测试.html（摇一摇广告）

作用：验证 accelerationIncludingGravity 的相邻帧差分逻辑是否可靠。

核心算法：

```js
// 三轴变化量之和作为"摇动强度"
const delta = Math.abs(cur.x - lastAcc.x)
            + Math.abs(cur.y - lastAcc.y)
            + Math.abs(cur.z - lastAcc.z);

if (delta < SHAKE_DELTA_THRESHOLD) return;   // 死区

shakeCount++;
if (shakeCount >= REQUIRED_SHAKES) jump();   // 达到次数就跳转
```

可配置项（文件顶部）：

```js
const TARGET_URL           = 'https://www.baidu.com';
const SHAKE_DELTA_THRESHOLD = 10;   // 越小越灵敏
const REQUIRED_SHAKES       = 50;   // 需要摇多少次
const SHAKE_COOLDOWN        = 0;    // 两次判定最小间隔（ms）
const JUMP_DELAY            = 300;  // 跳转前过渡动画（ms）
```

iOS 权限处理：与霓虹光绘相同思路——检测到 requestPermission 方法时显示"开启摇一摇"按钮，用户点击后请求权限，成功才绑定监听。

---

七、技术要点汇总

7.1 顶点数据布局

光带使用预分配的大 Float32Array 动态填充，每帧只更新 drawRange：

```js
const posArr = new Float32Array(MAX_SEGS * 12 * 3);  // 位置
const colArr = new Float32Array(MAX_SEGS * 12 * 3);  // 颜色

// 每帧重建
trailGeo.setDrawRange(0, vi);
posAttr.updateRange.offset = 0;
posAttr.updateRange.count = vi * 3;
posAttr.needsUpdate = true;
```

比 BufferGeometry.setFromPoints 快得多，也避免每帧创建新对象。

7.2 逐顶点颜色 + 加色混合

```js
new THREE.MeshBasicMaterial({
  vertexColors: true,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false,
  depthTest: false,
  fog: true
})
```

· 每条线段两端各自 setHSL(hue, 1.0, 0.5)，色相缓慢漂移
· depthTest: false 让所有光带都绘制，产生"叠加曝光"的霓虹感
· fog: true 让远处光带自然变暗，增强纵深

7.3 自适应画质

```js
function adaptQuality(dt) {
  if (qualityLocked || pixelRatio <= 1) return;
  frameAccum += dt;
  frameCount++;
  if (frameCount < 90) return;

  const avg = frameAccum / frameCount;
  frameAccum = 0; frameCount = 0;

  if (avg > 0.023) {   // 低于约 43fps
    pixelRatio = Math.max(1, pixelRatio * 0.75);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(innerWidth, innerHeight);
    if (pixelRatio <= 1.001) qualityLocked = true;
  }
}
```

7.4 错误可视化（(17) 起）

```js
window.addEventListener('error', (ev) => {
  window.__hudLog.push('❌ ' + ev.message + '\n  @ ' + ev.filename + ':' + ev.lineno);
  document.getElementById('hud').textContent = window.__hudLog.join('\n');
});
```

手机上没有控制台，HUD 直接显示错误是调试利器。

---

八、目录结构建议

```
neon-light-painting/
├── three.min.js                    # 本地 Three.js（r140）
├── core/
│   ├── 3D 霓虹.html                 # 传感器基线版
│   ├── 3D 霓虹 (6).html             # 物理成熟版
│   ├── 3D 霓虹 (10).html            # billboard 光带
│   ├── 3D 霓虹 (12).html            # 落笔飞行
│   ├── 3D 霓虹 (13).html            # 注释完善版（推荐入门）
│   └── 3D 霓虹 (14).html            # 科幻增强版
├── cdn/
│   ├── 3D 霓虹CDN 版 (13).html      # 无 VR 视差
│   ├── 3D 霓虹CDN 版 (17).html      # 带 HUD 调试
│   ├── 3D 霓虹CDN 版 (21).html      # 前后视差 + 旋转开关
│   └── 3D 霓虹CDN 版 (22).html      # 三轴视差（最终版）
├── tests/
│   ├── vr 测试.html                 # 重力传感器极简验证
│   └── 测试.html                    # 摇一摇广告逻辑验证
└── history/                         # (1)~(5)(7)(8)(9)(11)(15)~(20) 等中间版本
```

---

九、使用说明

9.1 运行

· 本地版：确保 three.min.js 与 HTML 同目录（文件名区分大小写）
· CDN 版：需要网络访问 cdn.jsdelivr.net
· 推荐用手机浏览器（Chrome / Safari / 微信内置）打开

9.2 权限

· Android：无需点击，加载即可用
· iOS 13+：首次触摸屏幕会弹出「运动与方向」权限请求，必须点允许
· 若误点拒绝：刷新页面重新授权，或在浏览器设置中重置权限

9.3 传感器不工作时

1. 打开 vr 测试.html，看立方体是否跟着倾斜动
2. 若不动 → 权限或硬件问题；若动 → 霓虹光绘的代码问题
3. 检查浏览器控制台或 HUD（(16)(17) 版本有 HUD）

---

十、已知注意事项

1. iOS Safari 的权限是"一次性"的：用户拒绝后，requestPermission 再次调用可能仍返回 denied，需要用户主动去设置里重置。
2. 摇一摇差分 vs 重力低通：
   · 摇一摇式（测试.html、3D 霓虹 (3)）用相邻帧差分，对快速短促的摇动敏感，但对缓慢倾斜不敏感
   · 重力低通式（3D 霓虹 (6)+）能区分"重力方向"和"线性加速度"，转动手机不会误触发光笔
3. VR 视差与陀螺仪旋转冲突：视差要求相机位置变化，旋转要求相机朝向变化，二者叠加会让画面很晕。(21) 起的"旋转开关"就是为了解决这个问题。
4. Three.js r140 UMD 构建：three.min.js 是 UMD 版本，与 type="module" 的 ESM 版本接口不同，混用会报错。
5. 落笔飞行（warp） 只在 (12) 及以后版本存在；早期版本按下去光笔会"瞬移"，容易在屏幕上拉出一条长直线。
6. 轨迹总长上限 MAX_POINTS：画得太多会从最老端挤掉，视觉上是"光带开始从尾部消失"，属于预期行为。
7. 指针事件（Pointer Events） 从 (6) 起统一处理触摸和鼠标，(1)~(5) 是分开监听 touchstart/mousemove，多指操作时可能有 bug。

---

十一、快速选择指南

你想…… 用哪个文件
学习核心原理 3D 霓虹 (13).html（注释最全）
获得最好的光绘手感 3D 霓虹 (12).html 或 (13).html
酷炫视觉效果 3D 霓虹 (14).html（星空 + 双层光带）
体验 VR 视差 3D 霓虹CDN 版 (21).html（前后）或 (22).html（三轴）
调试传感器 vr 测试.html
验证摇一摇逻辑 测试.html
手机没网络跑 用 core/ 下的本地版，需确保 three.min.js 存在

---

文档基于 25 个 HTML 文件的演进链条整理。核心结论：光带宽度用 billboard 方案（(10) 起）解决视角问题，传感器用「重力低通 + dt 积分」（(6) 起）解决频率耦合问题，iOS 权限必须「用户手势内串行请求 + 授权后绑定」（(6) 起）才可靠。