'use strict';

/* 全局游戏状态: game(流程)/player(玩家)/input(输入)/BOUNDS(活动范围) */

/* global RIDER_SCALE, START_FOOD, START_MONEY, W, H, BASE_SPEED, ROAD, makeFood, VEHICLES, IMG, SPRITE_BOX */

const game = {
  distance: 0, // 本圈内滚动距离(px)
  totalDist: 0, // 累计行驶距离(px, 逻辑: 难度/调度)
  scrollDist: 0, // 视觉滚动距离(px, 供场景物体定位, 含视觉加速)
  time: 0,
  started: false, // 是否已开始(开始界面点开始按钮后为 true)
  speed: VEHICLES.walk.baseSpeed, // 默认载具(步行)的基础速度
  over: false, // 游戏结束标记
  overReason: '', // 结束原因: hp(受伤) / bankrupt(破产)
  shake: 0, // 受击屏幕震动计时
  paused: false, // 是否暂停
  menuScreen: 'main', // 开始界面层级: main 主菜单 | vehicle 载具选择 | rank 排行榜
  testMode: false, // 测试模式: 默认关闭(本地调试: 控制台设为 true), 关闭时测试键全部无效
  tutorialPage: 0, // 教程当前页
  hideUI: false, // F1: 隐藏 UI(截图用)
};

const player = {
  x: W / 2,
  y: H * 0.66,
  vx: 0,
  vy: 0,
  tilt: 0, // 侧倾角度(转向动画)
  width: 44 * RIDER_SCALE,
  height: 90 * RIDER_SCALE, // 骑手贴图绘制尺寸(加载后按比例更新)
  MOVE_SPEED: 330, // 键盘移动速度 px/s
  hp: 100, // 生命值
  maxHp: 100,
  hitCd: 0, // 受击无敌计时
  eatPulse: 0, // 「焖子」吃到东西的果冻缩放计时
  flash: 0, // 受击红闪计时
  food: Array.from({ length: START_FOOD }, () => makeFood()), // 背负的外卖栈(最下方是最早捡的)
  foodLag: [], // 堆叠惯性偏移 { x, y, vx, vy }
  money: START_MONEY, // 金钱(开局带 100)
  weapons: {}, // 已持有的道具 { type: { ammo, cd } }, 不同种类可同时存在
  crime: 0, // 犯罪槽 0~100(攒满自动升一级并清零)
  crimeLvl: 1, // 犯罪等级 1~4
  crimeOver: 0, // 满级后持续违规的过载计时(提升警车/道钉频率, 无上限)
  kbx: 0, // 撞击弹开冲量(横向)
  kby: 0, // 撞击弹开冲量(纵向)
  slowT: 0, // 扎胎减速剩余时间
  healFlash: 0, // 回血绿闪计时
  cementT: 0, // 停留水泥区累计时间
  buff: { brave: 0, melon: 0, eat: 0, dash: 0 }, // 特殊效果剩余时间
  melonCd: 0, // 自动丢西瓜冷却
  vehicle: 'walk', // 当前载具键(见 VEHICLES), 默认步行
  animFrame: 0,     // 迈步动画当前帧
  animTimer: 0,     // 迈步帧计时
};

const input = {
  keys: Object.create(null),
  joy: null, // 手机虚拟摇杆 { id, ox, oy, dx, dy }
  rankDrag: null, // 排行榜拖动滚动 { id, y, scroll }
};

/* 载具解锁状态(由 B站 Toy 点赞/投币/收藏/关注解锁) */
const unlocks = { rider: true, cow: true, car: true, train: true }; // [破解] 初始即全解锁
/* 排行榜状态 */
const rankState = { loading: false, list: null, my: null, error: '', scroll: 0 };

/* 屏幕中央大字提示(特殊客户台词) */
const screenMsg = { text: '', life: 0, maxLife: 2.4 };
function showScreenText(text) {
  screenMsg.text = text;
  screenMsg.life = screenMsg.maxLife;
}

/* 玩家活动范围(贴图加载后由 updateBounds 更新) */
const BOUNDS = { x0: 0, x1: 0, y0: 96, y1: H - 120 };
let spritesReady = false; // 贴图内容包围盒是否已就绪(assets.js 加载后置 true)
function updateBounds() {
  /* 用可见内容宽度(剔除留白)作为边界余量; 贴图未就绪时退回整图宽度 */
  const m = (spritesReady ? contentSize(player.vehicle).w : player.width) / 2 + 6;
  BOUNDS.x0 = ROAD.left + m;
  BOUNDS.x1 = W - m;
}
updateBounds();

/* 当前载具配置 */
function vehicleDef() {
  return VEHICLES[player.vehicle];
}
/* 按贴图比例计算载具绘制尺寸(未加载时回退默认) */
function vehicleSize(type) {
  const def = VEHICLES[type];
  const img = IMG[def.img];
  const fallback = { w: def.maxDim * def.scale, h: def.baseH * def.scale };
  if (!img || !img.naturalWidth) return fallback;
  const frameW = img.naturalWidth / def.frames;
  const ih = img.naturalHeight;
  let h = def.baseH * def.scale;
  let w = (h * frameW) / ih;
  if (w > def.maxDim * def.scale) {
    w = def.maxDim * def.scale;
    h = (w * ih) / frameW;
  }
  return { w, h };
}
/* 应用载具: 切换尺寸/血量/移速并刷新活动范围 */
function applyVehicle(type) {
  const def = VEHICLES[type];
  player.vehicle = type;
  player.maxHp = def.maxHp;
  player.hp = def.maxHp;
  player.MOVE_SPEED = def.moveSpeed;
  player.animFrame = 0;
  player.animTimer = 0;
  const s = vehicleSize(type);
  player.width = s.w;
  player.height = s.h;
  updateBounds();
}

/* 贴图可见内容尺寸(剔除透明留白): drawW/drawH 为整图绘制尺寸
 * 返回 { w, h, footY } — footY 为内容底部相对贴图中心的 y(用于阴影落点) */
function spriteContent(key, drawW, drawH) {
  const img = IMG[key];
  const box = SPRITE_BOX[key];
  if (!box || !img || !img.naturalWidth) return { w: drawW, h: drawH, footY: drawH * 0.42 };
  const sy = drawH / img.naturalHeight;
  return {
    w: box.w * sy,
    h: box.h * sy,
    footY: (box.y + box.h - img.naturalHeight / 2) * sy,
  };
}
/* 当前玩家载具的可见内容尺寸 */
function contentSize(type) {
  const s = vehicleSize(type);
  return spriteContent(VEHICLES[type].img, s.w, s.h);
}
