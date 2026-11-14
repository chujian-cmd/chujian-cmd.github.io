3D 物理沙盒 · 手机适配项目技术文档

30 秒导航：想直接跑就用 适配手机 (37).html；想玩联机用 (31).html；想理解为什么这么多版本，从 (0) 看 (1) → (13) → (33) 这条主线。

---

一、项目简介

这是一个单文件 HTML 的 3D 物理沙盒（Three.js 渲染 + cannon-es 物理），核心玩法是第一人称在封闭场地内放置、删除、吸引、推开各种几何体。项目共 37 个文件，本质上是同一份 PC 端代码的手机适配演进史：从「键盘鼠标 → 触控按钮 → 摇杆 → 触控板 → 右半屏滑动 → 任意拖屏」六代交互方案，中途穿插性能优化、代码重构、联机实验和图标动效。

技术栈：Three.js 0.160.0 + cannon-es 0.20.0，通过 importmap 从 unpkg 加载，无构建步骤。

---

二、文件总览

文件按功能分组，推进顺序即版本演进顺序。表格按「阶段」分组，每组代表一次方向性调整。

阶段 0 · 基线（PC 端）

文件 核心变化
适配手机.html 原始 PC 版：requestPointerLock + WASD + 鼠标左/右键放/删 + 滚轮切形状

阶段 1 · 触控按钮 → 摇杆 → 双指隔离

文件 核心变化
适配手机 (1).html game.isMobile 判定；4 方向按钮分发 KeyboardEvent 走原键盘逻辑
适配手机 (2).html 换成摇杆；加全屏按钮；单指滑动转视角；竖屏提示
适配手机 (3).html 加 orientationchange 监听和 #rotate-overlay
适配手机 (4).html 静默调用 screen.orientation.lock('landscape')；全屏按钮
适配手机 (5).html 改 pointer 事件；摇杆和视角用独立 pointerId 互不干扰

阶段 2 · 触控板探索（反复摇摆）

文件 核心变化
适配手机 (6).html 毛玻璃 HUD；按钮尺寸收紧；沿用 (5) 的双指隔离
适配手机 (7).html 整页纵向布局（顶栏/场景/底栏）；「触摸板」左右半 = 鼠标左/右键
适配手机 (8).html 回到全屏场景 + 悬浮控制
适配手机 (9).html CSS Grid 四象限（左上场景、右上触控板、左下摇杆、底栏按钮）
适配手机 (10).html 双触控板：板 1 = 左/右键，板 2 = 视角
适配手机 (11).html 按钮改两行：上行跳跃/放/删，下行四键
适配手机 (12).html 触控板 2 灵敏度从 0.015 → 0.030
适配手机 (13).html 方案收敛点：弃用触控板 2，改「右半屏整屏滑动 = 视角」，底部摇杆 + 跳跃
适配手机 (14).html (13) 的微调，仅换大号跳跃按钮

阶段 3 · UI/UX 打磨 + 性能

文件 核心变化
适配手机 (15).html 所有按钮改 SVG 图标
适配手机 (16).html 性能优化：SAPBroadphase + 固定步长累加器 + MAX_OBJECTS=30 + 阴影 512 + dpr=1.5
适配手机 (17).html 修移动卡死：velocity.y 每帧被覆盖导致跳跃无效
适配手机 (18).html 控制台可拖拽；playerMesh.visible = false（纯第一人称）
适配手机 (19).html 「迷你世界」风格：顶栏 / 场景 / 按钮行 / 控制行 三段
适配手机 (20).html 全屏场景 + 叠加控制栏（flex 布局）
适配手机 (21).html 工具栏完全透明，只留图标
适配手机 (22).html 标题改为「沙盒 by 初见.」
适配手机 (23).html 控制台加标题栏拖拽把手 + 关闭按钮
适配手机 (24).html 同一批修复的回归：主角球隐藏、控制台默认可见
适配手机 (25).html 再一轮性能：固定累加器、shadow.mapSize=512
适配手机 (26).html 启动框「呼吸」脉冲；摇杆/按钮毛玻璃统一

阶段 4 · 代码重构

文件 核心变化
适配手机 (27).html CONFIG 常量集中；几何体 Map 缓存；state 单例
适配手机 (28).html 极简版：去掉内联 SVG，回到 emoji 按钮
适配手机 (29).html 修物理卡死：accumulator + while 固定步长；玩家死亡后冻结

阶段 5 · 联机实验

文件 核心变化
适配手机 (30).html WebSocket 联机框架：spawn / remove / clear / player / world-sync / request-sync 六种消息；远端玩家球 + kinematic body
适配手机 (31).html 修移动卡死（同 29）+ 保留 velocity.y 给重力

阶段 6 · 触屏重做 + 动效

文件 核心变化
适配手机 (33).html 触屏重做：任意位置拖动 = 视角，轻点 = 放置；准星；MAX_OBJECTS=150
适配手机 (34).html 全 SVG path 图标（含控制台）；按钮内嵌 SVG
适配手机 (35).html anime.js 4：推动图标 morphTo 路径变形，龙卷风 createDrawable
适配手机 (36).html 3 个 CDN fallback + icon-pop / icon-spin CSS 回退
适配手机 (37).html 简化 SVG path，移除 anime.js（保 CSS 回退）

注意：适配手机 (32).html 不存在于本次提供中。

---

三、核心机制

3.1 游戏核心（各版本基本不变）

配置集中在一个对象里，后文全部围绕它展开：

```js
const game = {
  camera: new THREE.PerspectiveCamera(68, aspect, 0.1, 200),
  config: { moveSpeed: 6, jumpForce: 7, forceStrength: 1500 },
  shapes: {
    types:  ['cube','sphere','cylinder','cone','torus','pyramid','capsule','octahedron'],
    colors: ['#ff6b6b','#ff9f43','#feca57','#54a0ff','#5f27cd','#00d2d3','#55efc4','#fd79a8','#ffffff','#e056a0'],
    index: 0, colorIndex: 0
  },
  world: null, playerBody: null,
  placedItems: [],   // [{ mesh, body, shapeType, isStatic }]
};
```

物理世界：18×0.2×18 地面 Box + 四面 10 高墙 + 玩家球 r=0.4，重力 -12。

交互闭环（放置/删除/吸/推/爆/全吸）：

```js
function getPlacement() {
  game.raycaster.setFromCamera(new THREE.Vector2(0, 0), game.camera);   // 屏幕中心
  game.raycaster.far = game.cheat.range ? 100 : 30;
  const hits = game.raycaster.intersectObjects(game.allPlaceables, false);
  if (!hits.length) return { pos: null, valid: false };
  const n = hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld);
  const pos = hits[0].point.clone().addScaledVector(n, 0.48);         // 沿法线偏移半格
  pos.x = THREE.MathUtils.clamp(pos.x, -17, 17);                       // 场地边界
  return { pos, valid: true };
}
```

为什么偏移 0.48：boxSize = 0.95，半边长 0.475，取 0.48 避免两个 box 的碰撞面重叠。

3.2 触控适配（演进主线）

这是整个项目真正的主题。六代方案，最终收敛在(33) 的「拖屏转视角、轻点放置」。

方案 代表文件 移动 视角 放置/删除
按钮分发 KeyboardEvent 1 4 向按钮 单指滑动 按钮分发 mousedown
摇杆 + 全屏 2 摇杆 单指滑动 按钮
pointer 双指隔离 5 摇杆（setPointerCapture） 独立 pointerId 按钮
触摸板（左右分） 7 摇杆 触控板拖动 触控板左/右半点击
双触控板 10 摇杆 触控板 2 拖动 触控板 1 左/右半
右半屏滑动 13 摇杆 屏幕右半拖动 按钮
任意拖 + 轻点 33 摇杆 屏幕任意拖动 轻点 = 放置 + 按钮

(33) 的「轻点 vs 拖动」判定，是全项目最精炼的一段：

```js
const TAP_MOVE_MAX = 9;    // px
const TAP_TIME_MAX = 320;  // ms
let look = null;

container.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#bottom-controls') || e.target.closest('#cheat-panel')) return;
  look = { id: e.pointerId, startX: e.clientX, startY: e.clientY,
           lastX: e.clientX, lastY: e.clientY, time: performance.now(), moved: false };
});
container.addEventListener('pointermove', (e) => {
  if (!look || look.id !== e.pointerId) return;
  if (!look.moved) {
    const dx = e.clientX - look.startX, dy = e.clientY - look.startY;
    if (dx*dx + dy*dy > TAP_MOVE_MAX * TAP_MOVE_MAX) look.moved = true;
  }
  if (look.moved) { /* 更新 euler */ }
});
container.addEventListener('pointerup', (e) => {
  if (!look || look.id !== e.pointerId) return;
  if (!look.moved && performance.now() - look.time < TAP_TIME_MAX) placeAtCrosshair();
  look = null;
});
```

3.3 摇杆

所有版本都用同一套「摇杆 → WASD」映射，只是手感参数在调整：

```js
const MAX_DIST = 30;               // 摇杆最大偏移（px）
function updateJoystick(clientX, clientY) {
  const rect = joystickArea.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;
  let dx = clientX - cx, dy = clientY - cy;
  const d = Math.hypot(dx, dy);
  const cl = Math.min(d, MAX_DIST);
  if (d > 0) { dx = dx/d*cl; dy = dy/d*cl; }
  game.joystick.x = THREE.MathUtils.clamp(dx / MAX_DIST, -1, 1);
  game.joystick.y = THREE.MathUtils.clamp(-dy / MAX_DIST, -1, 1);
  joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;
}
```

主循环里映射：

```js
const dead = 0.15;
const ax = Math.abs(jx) > dead ? jx : 0;
const ay = Math.abs(jy) > dead ? jy : 0;
if (ay > 0.2 || keys.KeyW) f++;
if (ay < -0.2 || keys.KeyS) f--;
if (ax < -0.2 || keys.KeyA) r--;
if (ax > 0.2 || keys.KeyD) r++;
```

参数演进：

· 死区：无 → 0.15（(13) 起稳定）→ 0.12（(33) 微调）
· 摇杆半径：35px（(2)）→ 30px（(13)）→ 40px（(33) 的 112px 容器）

3.4 视角控制

三个阶段：

A. 单指滑动（(2)～(5)） —— touchmove / pointermove 直接累加 euler.y/x。

B. 触控板 2（(10)～(12)） —— 在一个独立区域内 pointerdown/move/up，使用 getBoundingClientRect() 归一化到 0~1。灵敏度从 0.015 调到 0.030，因为触控板面积小，需要更高增益。

C. 右半屏 / 任意拖（(13) 起）：

```js
let isViewDragging = false, viewPointerId = null;
document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button') || e.target.closest('#toolbar') ||
      e.target.closest('#control-row') || e.target.closest('#cheat-panel') ||
      e.target.closest('#touchpad-wrap')) return;   // 排除 UI

  const rect = container.getBoundingClientRect();
  if (e.clientX - rect.left > rect.width * 0.5) {   // 仅右半屏（(13)）
    isViewDragging = true;
    viewPointerId = e.pointerId;
  }
});
document.addEventListener('pointermove', (e) => {
  if (!isViewDragging || viewPointerId !== e.pointerId) return;
  game.input.euler.y -= e.movementX * 0.008;
  game.input.euler.x -= e.movementY * 0.008;
  game.input.euler.x = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, game.input.euler.x));
  game.camera.quaternion.setFromEuler(game.input.euler);
});
```

3.5 物理步进（从「直接 dt」到「累加器」）

旧版（(0)～(15)）：

```js
const dt = Math.min(clock.getDelta(), 0.033);
world.step(1/60, dt, 3);   // 固定 1/60 步长，最多 3 子步
```

问题：低帧率时（30fps → dt=0.033）一帧要跑 2 子步，实际耗时超过 33ms，下一帧又累加，越积越慢，表现为角色一顿一顿、甚至卡死。

新版（(16) 起，最终 (29)(31)(33) 定型）：

```js
let accumulator = 0;
const FIXED_STEP = 1/60;
const MAX_SUBSTEPS = 3;

function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);
  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < MAX_SUBSTEPS) {
    world.step(FIXED_STEP, FIXED_STEP, 3);
    accumulator -= FIXED_STEP;
    steps++;
  }
  if (steps === 0 && accumulator > 0) { world.step(accumulator, accumulator, 3); accumulator = 0; }
  // ... 渲染
}
```

关键洞察：steps < 3 的上限防止「积压 10 帧就一次性跑 10 步物理」造成的雪崩 —— 宁愿慢放，不要瞬移。

3.6 联机（仅 (30)(31)）

WebSocket 单信道，六种消息：

消息 方向 作用
spawn 广播 新增物体（形状、颜色、位置、是否静态）
remove 广播 删除物体（用位置近似匹配）
clear 广播 清空世界
player 10Hz 广播 玩家位置 + 颜色
request-sync 客户端→主机 请求世界快照
world-sync 主机→客户端 全量世界快照

```js
function netBroadcast(data) {
  if (net.ws && net.ws.readyState === WebSocket.OPEN) {
    net.ws.send(JSON.stringify(data));
  }
}
function broadcastPlayerState() {
  if (!net.isConnected) return;
  const p = game.playerBody.position;
  netBroadcast({ type: 'player', id: net.myId,
    pos: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) },
    color: net._playerColor, sender: net.myId });
}
```

⚠️ 反模式：startHost() 里连的是 ws://localhost:8080。手机上 localhost 指手机自身，没有服务器。局域网联机必须在某台设备上跑一个 ws 服务器（Node 10 行代码即可），或改用 WebRTC。

3.7 动效（(33) 之后新增）

anime.js 4 的用法集中在三处：

```js
// 推动箭头：静 → 爆发 → 静（路径 morphTo）
const PUSH_REST  = 'M12 3l2.5 5h-1.5v3h-2V8H9.5L12 3z...';
const PUSH_BURST = 'M12 1l3.5 6.5h-2.5v4h-2v-4H8.5L12 1z...';

animeAnimate(path, {
  d: animeSvg.morphTo(PUSH_BURST), duration: 160, ease: 'outQuad',
  onComplete: () => animeAnimate(path, {
    d: animeSvg.morphTo(PUSH_REST), duration: 340, ease: 'outElastic(1, .5)'
  })
});
```

(36) 的三 CDN 回退 + CSS 兜底：

```js
const CDNS = [
  'https://cdn.jsdelivr.net/npm/animejs@4.0.0/+esm',
  'https://esm.sh/animejs@4.0.0',
  'https://unpkg.com/animejs@4.0.0/+esm',
];
for (const url of CDNS) {
  try { const m = await import(url);
        if (m.animate && m.svg) { /* 加载成功 */ break; }
  } catch {}
}
```

CSS 兜底：

```css
@keyframes icon-pop {
  0%   { transform: scale(1)   rotate(0deg); }
  30%  { transform: scale(1.55) rotate(-8deg); }
  60%  { transform: scale(0.85) rotate(4deg); }
  100% { transform: scale(1)   rotate(0deg); }
}
.btn-icon.pop svg { animation: icon-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
```

---

四、渲染与性能

4.1 性能取舍对照表

手段 首次引入 代价 收益
setPixelRatio(min(dpr, 2)) (0) 高分屏清晰度 中
setPixelRatio(min(dpr, 1.5)) (16) 稍糊 高（手机 GPU 强相关）
shadow.mapSize = 512 (16) 阴影粗糙 高
SAPBroadphase (16) — 高（O(n log n) vs O(n²)）
MAX_OBJECTS = 30 (16) 玩家建筑会消失 中
MAX_OBJECTS = 150 (33) — 中（以更多渲染换体验）
几何体缓存 Map (27) — 中
固定步长累加器 (16)(29) 慢放 极高（防雪崩）

4.2 版本间回退（值得注意）

dpr 1.5 → 2（(33) 恢复），shadow.mapSize 512 → 1024（(33) 恢复），MAX_OBJECTS 30 → 150（(33) 恢复）。

这说明 (16) 的性能激进参数在 (33) 触屏重做时被放宽 —— 手感/画质优先级重新上调。

---

五、独立/实验文件说明

· (30)(31) 联机：需要外部 WebSocket 服务器；(31) 是唯一修好联机版移动卡死的。单机版不涉及这部分代码。
· (35) 动效：anime.js 从 CDN 加载 import，(36) 加了 CDN 轮询，(37) 又把它拿掉了 —— 说明上线时项目选择了「CSS 回退足够用」。
· (27) state 重构：把全局 game 拆成 state + CONFIG，但后续 (28)~(37) 都没沿用这个结构 —— 这是一次未推广的重构实验。

---

六、技术要点汇总

· 同一份文件 37 版：本质是交互适配探索史，业务逻辑（放置/删除/吸/推/爆）几乎未变。
· 触屏的核心矛盾：视角拖动 vs 点击放置。解法是「位移 + 时长」双阈值。
· 物理稳定性的关键：固定步长累加器 + 子步上限。
· UI 事件隔离：e.target.closest(...) 是手机 HUD 层不冲突的唯一可靠手段。
· 第一人称相机：playerMesh.visible = false + camera.position = playerBody.position + (0, 0.6, 0)。
· velocity.y 是重力通道：任何「每帧设 velocity 」的写法都必须保留 y。

---

七、目录结构建议

当前所有文件平铺，建议按「主线 / 联机 / 动效 / 归档」四层归档：

```
3d-sandbox/
├── dist/
│   └── index.html              ← 从 (37) 或 (33) 拷来作为发布版
├── src/
│   ├── main.html               ← 主逻辑（工作版，从 (33) 开始改）
│   └── multiplayer.html        ← 联机版（(31)）
├── experiments/
│   ├── touch-buttons.html      ← (1) ~ (5)
│   ├── touchpad.html           ← (6) ~ (14)
│   ├── ui-polish.html          ← (15) ~ (26)
│   └── anime-icons.html        ← (34) ~ (37)
└── archive/
    └── baseline.html           ← (0) 原始 PC 版，不删，作为参照
```

如果坚持单文件分发，至少把 (37) 改名 index.html，其他保留原名归档。

---

八、使用说明

1. 打开方式：直接用浏览器打开任意 .html 文件即可（file:// 协议下 importmap 也能工作，但 anime.js 的 CDN import 需要网络）。
2. 依赖：Three.js 0.160.0、cannon-es 0.20.0 从 unpkg 拉取，首次加载需要网络。想离线部署需把两个包下到本地改 importmap 路径。
3. 推荐入口：
   · 通用体验 → 适配手机 (37).html
   · 联机 → 适配手机 (31).html（需自建 ws 服务器）
   · 看动效 → 适配手机 (36).html
4. 联机自建服务器（约 10 行）：

```js
// server.js
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    wss.clients.forEach(c => c.readyState === 1 && c.send(raw.toString()));
  });
});
```

---

九、已知注意事项

1. 触屏 PointerLock 无效：requestPointerLock() 在 iOS/Android 上要么 reject，要么假锁定但 movementX/Y 恒为 0。所有手机版都靠 game.isMobile 分支直接 hidden 掉 start-overlay，并置 game.isLocked = true。
2. joyPointerId 未重置 → 摇杆不跟手：部分早期版本用 setPointerCapture 后，在 touchend 没把 joyPointerId 置 null，下一次 touchmove 会拿着旧 id 继续算，表现为「手指抬起后摇杆还在飘」。修复见 resetJoystickFull()。
3. 右半屏拖动的「误触」：判定式必须包含 e.target.closest('#cheat-panel')。控制台在右侧，拖动它时应触发面板拖动，而不是转视角。
4. getPlacement() 的 face 依赖：intersectObjects 命中 GridHelper 时没有 face.normal，会抛异常。所以 allPlaceables 里只放地面和放置物，网格线不放。
5. 横屏锁定需要用户手势：screen.orientation.lock('landscape') 必须在 click/touch 的同步调用栈里，不能放 setTimeout。部分浏览器还要求 requestFullscreen() 先成功。
6. MAX_OBJECTS 会悄悄删物体：(16)(33) 里超限会 removeEntry(placedItems[0])，旧建筑会在玩家不知不觉中消失。产品化时应改为「提示 + 手动清」或 LRU 保留最近 N 个。
7. 联机的 localhost 陷阱：见 3.6 节警告。
8. anime.js 的 CDN 不可靠：+esm 后缀并非所有包都提供，esm.sh 有时返回 302。上线前应把 anime.js 下到本地，(36) 的 CDN 轮询只适合开发时快速验证。

---

十、快速选择指南

你想…… 用哪个文件
直接玩最新版本 适配手机 (37).html
要准星 + 轻点放置（体验最好） 适配手机 (33).html
想联机 适配手机 (31).html（需自建 ws）
想看图标动画的完整实现 适配手机 (36).html
想对照 PC 原版看差异 适配手机.html
想理解「为什么这么多版本」 主线：(0) → (1) → (13) → (33)
想改业务逻辑（加物体/新交互） 从 适配手机 (37).html 起手
想研究性能优化 (16) vs (33) 对照
想研究代码重构思路 适配手机 (27).html

---

附：版本之间的核心参数对照

参数 (0) (13) (16) (29) (33) (37)
moveSpeed 8 8 6 6 6 6
jumpForce 8 8 7 7 7 7
摇杆死区 — 0.15 0.15 0.15 0.12 0.12
视角灵敏度 0.002（鼠标） 0.008 0.008 0.008 0.0075 0.008
dpr 上限 2 2 1.5 1.5 2 2
阴影 mapSize 1024 1024 512 512 1024 1024
MAX_OBJECTS 无上限 无上限 30 30 150 150
物理步进 step(1/60, dt, 3) 同 累加器 累加器 累加器 累加器
Broadphase Naive Naive SAP SAP SAP SAP

表格里能看到一个反直觉的现象：性能参数（16）激进降低、（33）又调回来。原因不是回归，而是 (16) 时候还在「保帧率」，到 (33) 交互重做、手感被验证可用后，果断把画质和物体数量加回去。这是典型的「先活下来，再美起来」。