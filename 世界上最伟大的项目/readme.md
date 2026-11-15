MLSD 线段检测 & 伪 AR 实验 · 项目文档

一、项目简介

这批文件是两组独立的浏览器实验，共 21 个 HTML，记录了两次从"盲目试错"到"读懂原理"的完整过程：

1. MLSD 系列（8 个）：用 onnxruntime-web 在浏览器里跑 M-LSD 线段检测模型，从"加载成功"到"搞懂输出 shape"，再到"把线画出来"、最后"WebGPU 测速"。
2. 伪 AR 系列（13 个，test*.html）：先试图用 WebXR 做真 AR 命中测试，全链路失败（ARCore 依赖 / 权限 / iframe / HTTPS 层层卡住），最终放弃 WebXR，转向"摄像头背景 + 陀螺仪姿态 + 手写透视投影"的伪 AR 方案。

技术栈：onnxruntime-web、Three.js、Canvas 2D、DeviceOrientation、WebXR（尝试后放弃）。

文档价值最高的部分是失败排查记录：WebXR 为什么走不通、姿态解算的欧拉序坑、Canvas 2D 手写投影的数学。

---

二、文件总览

按两条主线排列，标注每份的进展：

主线 A · MLSD 线段检测

文件 阶段 核心变化
mlsd-test.html 基线 加载模型，打印输入输出元数据，尝试 [1,4,512,512]
mlsd-test-01.html 改布局 改成 NHWC [1,512,512,4]
mlsd-test-01b.html 纯诊断 检查 ort 是否加载、模型是否可创建，无推理
mlsd-test-02.html 开始解析 发现输出 Identity / Identity_1，代码里自己困惑 shape
mlsd-test-03.html 突破 推断 400 数字 = 100 条线 × 4 坐标，x*2 映射到 512，画出线
mlsd-test-04.html 可视化 加按钮逐条查看 + 全部叠加
mlsd-test-05.html 测速 WebGPU vs wasm，ort 1.17.0
mlsd-test-06.html 测速升级 ort 1.20.1，其余同 05

主线 B · WebXR → 伪 AR 的降级之路

文件 阶段 核心变化
test.html 完整方案 手写 AR 会话 + hit-test + anchors + dom-overlay，reticle + 平面
test (1).html 换 ARButton 官方 ARButton.createButton，只请求 hit-test
test (2).html 暴露报错 手写按钮强行请求，去掉 anchors/dom-overlay，alert 真实错误
test (3).html 最小验证 不请求任何特性，只放一个旋转方块，验证基础 AR 能否起
test (4).html 加日志 逐步打点：navigator.xr → isSessionSupported → requestSession
test (5).html 号称成功 ARButton + hit-test + anchors + dom-overlay
test (6).html 绕开 ARCore 只请求 hit-test，注释说"不依赖系统 ARCore 服务"
test (7).html 转伪 AR getUserMedia 后置摄像头做背景，deviceorientation 直接映射 camera.rotation（粗暴版）
test (8).html 姿态精修 四元数解算，ZXY 欧拉序，重力低通滤波修正，deviceToCam 四元数
test (9).html 修 yaw 漂移 锁定初始 alpha 偏移，correctDrift 只修 pitch/roll 不动 yaw，YXZ 序
test (10).html 换技术栈 弃 Three.js，纯 Canvas 2D 手写 project()，画地面线 + 脚点判定
test (11).html 工程化 环境自检、多级摄像头回退、屏幕旋转修正、重置朝向
test (12).html 定稿 同 11 完善版，加 PITCH_MIN（手机朝下才判定踩线）

主线：test.html → 反复试 AR 失败 → test (7) 转伪 AR → test (10) 弃 Three.js 手写投影 → test (12) 定稿。

---

三、核心机制

3.1 MLSD 输出 shape 的困惑与破解

这是 MLSD 系列里最有意思的认知过程。

mlsd-test-02.html 打印出输出后，代码注释里是这么写的：

```js
// lines 是 [1,200,2]，也就是每条线只有一个 (x,y)？不，是 [1,200,2]
// 实际上 200 条线 x 每条线 2 个数字，这解释不通。
// 看值：3,25, 0,255, 4,49 ... 像是一堆坐标对
// 先按「200 个点，两两成线」画
const x1 = lines[k*2], y1 = lines[k*2+1];
```

mlsd-test-03.html 破了这个局：

```js
// 解读：400 个数字 -> 100 条线，每条 4 个数字
const numLines = 100;
const x1 = lines[k*4],     y1 = lines[k*4 + 1];
const x2 = lines[k*4 + 2], y2 = lines[k*4 + 3];
// 坐标 0~255，映射到 0~512
const sx1 = x1 * 2, sy1 = y1 * 2;
```

推断链条：

· Identity 有 400 个数字，[1,200,2] 是 onnxruntime-web 报告的 shape，但 200×2 = 400
· 一条线需要 4 个数字（x1,y1,x2,y2），400 ÷ 4 = 100 条
· 坐标值域是 0~255（模型内部坐标空间），输入是 512，所以 ×2 映射
· Identity_1 是 [1,200]（实际按 100 条线用，前 100 个分数有效）

这是一个典型的"输出 shape 被扁平化/重排"的坑。onnxruntime-web 报的 shape 不一定和模型设计的 shape 一致，要结合值域和业务语义反推。M-LSD 原始模型输出是 lines [1,100,4] + scores [1,100]，这里被报成 [1,200,2]，需要自己拆。

mlsd-test-04.html 在此基础上加了交互：

```js
const idx = Array.from({length:N},(_,i)=>i)
  .sort((a,b)=>scoresData[b]-scoresData[a])
  .slice(0,10);
idx.forEach(k => {
  const b = document.createElement('button');
  b.textContent = '线' + k + ' (' + scoresData[k].toFixed(4) + ')';
  b.onclick = () => drawOne(k);   // 单条红色高亮
  btns.appendChild(b);
});
drawAll(idx);  // 全部绿色半透明叠加
```

单条看 + 全部看，是验证"解析对不对"的最快手段。

3.2 WebXR 为什么走不通

test.html 到 test (6) 是一个完整的失败排查记录，每份都在换一个角度试图让 AR 起来：

尝试 做法 结果
test.html 手写 requestSession('immersive-ar', { requiredFeatures: ['hit-test','anchors'], domOverlay }) 失败
test (1) 换官方 ARButton.createButton 失败
test (2) 手写按钮，去掉 anchors/dom-overlay，只留 hit-test，alert 暴露真实错误 拿到真实报错
test (3) 不请求任何特性，只放旋转方块 仍失败 → 说明不是 hit-test 的问题
test (4) 加日志逐步打点 定位到是 requestSession 本身失败
test (6) 注释"不依赖系统 ARCore 服务" 仍失败

结论：immersive-ar 会话启动失败的原因通常不在代码，而在运行环境：

1. ARCore / ARKit 缺失：Android 需安装 Google Play Services for AR，部分国产 ROM 不预装；iOS 需 A12+ 且 iOS 13+。
2. 非安全上下文：getUserMedia 和 WebXR 都要求 HTTPS 或 localhost。test (11) 的"环境自检"里专门打印 location.protocol 和 window.self !== window.top。
3. iframe 限制：在预览 iframe 里，Permissions Policy 默认禁摄像头/XR，必须 allow="xr-spatial-tracking; camera"。
4. 浏览器不支持：桌面 Chrome 支持 WebXR 模拟器，但手机 Chrome 对 immersive-ar 的支持依赖设备白名单。

test (11) 的多级回退和自检，就是被这些坑逼出来的：

```js
log('协议: ' + location.protocol);
log('是否在 iframe: ' + (window.self !== window.top));
log('mediaDevices: ' + (navigator.mediaDevices ? 'OK' : '不存在'));

const tries = [
  { video: { facingMode: { ideal: 'environment' } }, audio:false },
  { video: { facingMode: 'environment' }, audio:false },
  { video: true, audio:false },   // 兜底：任何摄像头
];
```

3.3 伪 AR 的姿态解算（test (8) / (9)）

放弃 WebXR 后，方案变成：后置摄像头做背景 + deviceorientation 驱动相机朝向 + Three.js 渲染虚拟物体。

test (7) 的粗暴版：

```js
camera.rotation.x = beta;   // 上下
camera.rotation.y = gamma;  // 左右
camera.rotation.z = -alpha; // 旋转
```

问题：欧拉角直接赋值会万向节死锁，且不同手机传感器方向不一致，转起来是歪的。

test (8) 的修正版：改用四元数，ZXY 欧拉序：

```js
const euler = new THREE.Euler(
  THREE.MathUtils.degToRad(beta),
  THREE.MathUtils.degToRad(alpha),
  THREE.MathUtils.degToRad(-gamma),
  'ZXY'
);
const q = new THREE.Quaternion().setFromEuler(euler);

// 屏幕旋转补偿
const screenQ = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 0, 1),
  THREE.MathUtils.degToRad(-state.screenAngle)
);
q.multiply(screenQ);
```

同时用 devicemotion 的加速度计做重力低通滤波，修正 pitch/roll 的漂移：

```js
state.gravity.lerp(state.accel.clone().normalize(), 0.15);
// correctDrift 里只取 5% 修正，避免抖动
return q.clone().slerp(q.clone().multiply(corr), 0.05);
```

test (9) 修 yaw 漂移：alpha（罗盘方位）在无磁力计时会缓慢漂移，导致相机"自己转"。解法是锁定初始 alpha 作为基准，之后只算相对值：

```js
if (state.alphaOffset === null) state.alphaOffset = alpha;
const a = alpha - state.alphaOffset;   // 相对初始方位
```

correctDrift 也改成只修 pitch/roll，绝不动 yaw：

```js
function correctDrift(q) {
  const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
  e.x *= 0.98;   // 修 pitch
  e.z *= 0.98;   // 修 roll
  // e.y 保持不变（yaw 不修）
  return new THREE.Quaternion().setFromEuler(e);
}
```

这三个坑（欧拉序、屏幕旋转补偿、yaw 漂移）是移动端姿态解算的必修课。test (9) 的注释"绝不动 yaw，避免持续自转"是整个系列最有价值的一行。

3.4 Canvas 2D 手写透视投影（test (10) ~ (12)）

test (10) 干脆弃用 Three.js，用纯 Canvas 2D 手写投影，画地面上的虚拟线，脚点踩线就"死"。

世界坐标 → 屏幕（相机在 (0, CAM_HEIGHT, 0)，看向 -z）：

```js
function project(wx, wz) {
  let px = wx, py = -CAM_HEIGHT, pz = wz;

  // 绕世界 X 轴：pitch（低头时把地面点转到视野里）
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  let y1 = py * cp - pz * sp;
  let z1 = py * sp + pz * cp;

  // 绕世界 Y 轴：yaw
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  let x2 =  px * cy + z1 * sy;
  let z2 = -px * sy + z1 * cy;

  const depth = -z2;
  if (depth <= 0.05) return null;   // 在身后，不投影

  const focal = (H/2) / Math.tan(FOV_Y/2);
  return {
    x: W/2 + (x2 / depth) * focal,
    y: H/2 - (y1 / depth) * focal,
  };
}
```

脚点判定：脚固定在屏幕 (W/2, H*0.85)，算点到线段的距离：

```js
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx*dx + dy*dy;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));   // 投影到线段内
  return Math.hypot(px - (ax + t*dx), py - (ay + t*dy));
}
// 距离 < LINE_THRESH (22px) 则判定踩线
```

test (11) 补屏幕旋转修正：横屏时 screen.orientation.angle = 90，画布坐标系和相机坐标系需要绕中心旋转：

```js
if (screenAngle === 90) {
  const cx0 = W/2, cy0 = H/2;
  const dx = sx - cx0, dy = sy2 - cy0;
  sx  = cx0 - dy;
  sy2 = cy0 + dx;
}
```

test (12) 补 PITCH_MIN：手机没朝下时（pitch < 25°），地面点投影到画面外，不该误判踩线：

```js
const PITCH_MIN = 25 * Math.PI/180;
const lookingDown = pitch > PITCH_MIN;   // 手机朝下才判定
const isHit = lookingDown && segDist(...) < LINE_THRESH;
```

---

四、技术要点汇总

· onnxruntime-web 的输出 shape 不可尽信：报 [1,200,2] 可能实际是 [1,100,4] 被重排。结合值域（0~255）和业务语义（每条线 4 坐标）反推，比盯着 shape 靠谱。
· 模型坐标空间 ≠ 输入空间：M-LSD 输入 512×512，输出坐标 0~255，需 ×2 映射。坐标缩放系数要从模型文档或值域观察得出。
· WebXR 失败先查环境再查代码：HTTPS、iframe 的 allow、ARCore 是否安装，这三项排除后，代码层面几乎不会错。
· 姿态解算三件套：四元数（避免死锁）、正确的欧拉序（ZXY 或 YXZ 看设备）、屏幕旋转补偿。缺一个转起来就歪。
· yaw 漂移必须锁基准：alpha 无磁力计时缓慢漂移，锁定初始值作为前方，只算相对角。
· Canvas 2D 手写投影比 Three.js 轻：test (10) 用 60 行数学替代了整个 Three.js，对"只画几条地面线"这种需求完全够用，且没有 WebGL 上下文问题。
· transform 优于 left/top：test (12) 的屏幕旋转修正如果改 CSS rotate 会抖动，直接改画布坐标更稳。
· 多级 fallback：摄像头 facingMode ideal → 精确 → 任意，三级回退，兼容性最好。

---

五、目录结构建议

两组独立实验，建议平铺但用前缀区分：

```
mlsd-ar-experiments/
├── mlsd/
│   ├── 00-baseline.html        # mlsd-test.html
│   ├── 01-nhwc.html            # mlsd-test-01.html
│   ├── 01b-diagnose.html       # mlsd-test-01b.html
│   ├── 02-parse-attempt.html   # mlsd-test-02.html
│   ├── 03-parse-ok.html        # mlsd-test-03.html（推荐起点）
│   ├── 04-visualize.html       # mlsd-test-04.html（推荐）
│   ├── 05-webgpu-1.17.html     # mlsd-test-05.html
│   └── 06-webgpu-1.20.html     # mlsd-test-06.html
├── webxr-attempts/             # 失败记录，留档用
│   ├── test.html ~ test (6).html
├── pseudo-ar/                  # 最终方案
│   ├── 07-basic.html           # test (7).html
│   ├── 08-quat.html            # test (8).html
│   ├── 09-yaw-lock.html        # test (9).html
│   ├── 10-canvas-project.html  # test (10).html
│   ├── 11-robust.html          # test (11).html
│   └── 12-final.html           # test (12).html（推荐）
└── models/
    └── model_512x512_large.onnx
```

---

六、使用说明

运行 MLSD 系列

需要把 model_512x512_large.onnx 放在同目录，用本地 HTTP 服务器打开（不能 file://，onnxruntime 的 wasm 加载会被 CORS 拦）：

```bash
python -m http.server 8000
# 或 npx serve
```

运行伪 AR 系列

· 必须 HTTPS 或 localhost（getUserMedia 硬要求）
· iOS 13+ 需要用户点击后请求 DeviceOrientationEvent.requestPermission()
· 手机需有后置摄像头

环境要求

需求 文件 说明
onnxruntime-web mlsd 系列 CDN 加载
WebXR + ARCore test.html ~ test (6) 大多跑不通，仅留档
摄像头 + 陀螺仪 test (7) ~ test (12) 需 HTTPS
Three.js test.html ~ test (9) unpkg
纯 Canvas test (10) ~ test (12) 无外部依赖（除摄像头）

---

七、已知注意事项

1. MLSD 的 shape 是最大坑：mlsd-test-02.html 里代码自己都困惑"200 条线 × 每条 2 个数字解释不通"。先读 mlsd-test-03.html，它破了局，其余都是它的变体。
2. x*2 映射不一定对：mlsd-test-03.html 假设坐标 0~255 映射到 512。如果模型输出是 0~1 归一化，就要改成 x*512。先打印 lines 的前 20 个值看范围。
3. WebXR 在预览 iframe 里必失败：Permissions Policy 默认禁 xr-spatial-tracking。test (11) 的自检就是为了让你一眼看出"是不是 iframe 的锅"。
4. 姿态解算的欧拉序：test (8) 用 ZXY，test (9) 改 YXZ。哪个对取决于设备坐标系定义。转起来歪就先换序，这是最快的试错法。
5. yaw 漂移是物理现象：没有磁力计时 alpha 会缓慢漂，不是代码 bug。test (9) 的"锁基准 + 不修 yaw"是正解，试图"修正" yaw 会越修越歪。
6. PITCH_MIN 防误判：test (12) 加的 25° 阈值，是因为手机平举时地面线投影到画面外，脚点判定会随机命中。不加的话，正常走路会被判"踩线死了"。
7. onnxruntime-web 版本差异：mlsd-test-05 用 1.17.0，06 用 1.20.1。WebGPU 后端在新版更稳，但 1.20.1 的 wasm 包更大。测速时注意区分"首次加载"和"推理"时间。
8. 摄像头多级回退：test (11) 的三级 tries 是最佳实践——ideal 是"尽量"，精确值 是"必须"，video: true 是"随便给个"。三级都失败才是真的没权限。

---

八、快速选择指南

你想… 用这个文件
搞懂 MLSD 输出怎么解析 mlsd-test-03.html（先看它，别看 02）
可视化 MLSD 检测结果 mlsd-test-04.html
测 onnxruntime 推理速度 mlsd-test-06.html（新版 ort）
看 WebXR AR 的完整正确写法（如果环境支持） test (5).html
排查 WebXR 为什么起不来 test (11).html（自检最全）
做一个一定跑得起来的伪 AR test (12).html
看姿态解算的坑 test (8) → test (9) 对比
看不用 Three.js 的最小投影实现 test (10).html
只想要摄像头背景 + 陀螺仪跟随 test (9).html

---

九、结语

这两组文件的价值不在"跑通了什么"，而在记录了怎么从跑不通到跑通。

· MLSD 系列演示了"输出 shape 看不懂"时的正确姿势：别猜，打印值域，结合业务语义反推。mlsd-test-02.html 里那段自我困惑的注释，比任何正确代码都更有教学价值。
· WebXR 系列演示了"技术选型失败"时的正确降级路径：AR 起不来 → 查环境（HTTPS/iframe/ARCore）→ 确认环境没问题还是起不来 → 果断弃用 WebXR，用摄像头 + 陀螺仪做伪 AR。test (10) 用 60 行 Canvas 数学替代 Three.js，是全系列最漂亮的一步。

如果只能读三份：mlsd-test-03.html（shape 破解）、test (9).html（姿态 yaw 锁定）、test (12).html（伪 AR 定稿）。这三份覆盖了这批文件里最硬的三个知识点。