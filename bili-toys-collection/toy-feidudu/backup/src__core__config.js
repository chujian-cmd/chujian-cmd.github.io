'use strict';

/* 常量配置(纯常量, 无外部依赖) */

const W = 480,
  H = 800; // 逻辑分辨率
/* 道路贴图 路面.png(1536×2048): 左绿化带/人行道 + 沥青 + 右人行道/水泥区
 * 按画布宽度铺满(scale = W/1536 = 0.3125)标定的边界 */
const ROAD = { left: 64, width: 232 }; // 沥青路面(画布坐标)
const CEMENT_X = 340; // 水泥区起始(画布坐标)
const CEMENT_CRIME_DELAY = 2; // 水泥区停留多久后开始涨犯罪条(秒)
const CEMENT_CRIME_RATE = 12; // 水泥区犯罪条增速 /s
const SHOP_RAM_DMG = 20; // 没钱撞飞店铺时的伤害

const TILE_H = 640; // 道路贴图缩放后高度(1536×2048 贴图按画布宽度铺满: 2048×480/1536)
const GROUND_SCROLL_MUL = 1.7; // 地面贴图滚动视觉加速(纯视觉, 不影响逻辑/难度)
const LOOP = TILE_H * 20; // 场景无缝循环长度(20 块贴图)
const PX_PER_M = 20; // 20px 计 1m, 仅用于里程换算
const BASE_SPEED = 240; // 场景默认前进速度 px/s
const SPEED_MIN = 30,
  SPEED_MAX = 410; // 速度下限/上限: 向后刹得更慢, 向前冲得略低

/* 碰撞伤害: 侧面相撞双方相同; 前后相撞前方(世界前进方向=屏幕上方)受伤更多 */
const DMG_SIDE = 20; // 整体提高碰撞伤害
const DMG_FRONT = 22; // 前后碰撞倍率降低(原 1.6×→约 1.1×)
const DMG_REAR = 10; // 前后碰撞倍率降低(原 0.53×→0.5×)
const HIT_CD = 0.2; // 玩家受击无敌时间(秒), 防止一帧内多次结算
const ENEMY_HIT_CD = 0.2; // 敌方受击无敌时间(秒), 保证连续子弹/撞击可连续结算
const ENEMY_MAX = 4; // 同屏敌骑手上限
const ENEMY_AHEAD_RATIO = 0.5; // 默认从上方(前方)出现的敌人比例, 其余从后方超车
const INITIAL_ENEMIES = 4; // 开局生成的敌人数量

/* ===== 节奏(加快游戏) ===== */
const DIFFICULTY_FULL_M = 2000; // 满难度里程(米), 越小难度爬升越快
const PACE_PER_KM = 0.15; // 每公里场景提速比例(不设上限, 已解除 +40% 限制)
const ENEMY_SCALE = 1.3; // 敌方骑手贴图放大倍数
const HEAL_AMT = 25; // 点击外卖按钮回复的血量
const AUTO_HEAL_THRESHOLD = 0.4; // 血量低于该比例时自动吃外卖
const AUTO_HEAL_INTERVAL = 0.5; // 自动吃外卖间隔(秒)
const RIDER_SCALE = 1.5; // 玩家贴图缩放倍数
const FOOD_SIZE = 31; // 外卖掉落绘制尺寸
const FOOD_STACK_PX = 23; // 背上堆叠外卖尺寸(px, 各载具统一)
const ENEMY_DIE_TIME = 0.9; // 敌人倒下动画时长(秒)
const START_FOOD = 3; // 初始外卖数量
const START_MONEY = 100; // 开局金钱
/* 2×2 四宫格图集 */
const FOOD_FRAMES = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];
function randFoodFrame() {
  return FOOD_FRAMES[Math.floor(Math.random() * FOOD_FRAMES.length)];
}
/* 一个外卖项: { f: 普通图集帧, poison: 是否有毒, pf: 有毒图集帧, special: 特殊外卖帧(-1 无) }
 * 有毒外卖用 有毒食物.png(2列×1行); 特殊外卖用 特殊外卖.png(2列×2行) */
function makeFood(poison) {
  if (poison) return { f: null, poison: true, pf: Math.floor(Math.random() * 2), special: -1 };
  return { f: randFoodFrame(), poison: false, pf: 0, special: -1 };
}
function makeSpecialFood(idx) {
  return { f: null, poison: false, pf: 0, special: idx };
}
/* 特殊客户帧 → 对应特殊外卖帧(2×2, 行主序): 0-0↔0-0, 0-1↔1-0, 1-0↔0-1, 1-1↔1-1 */
const SPECIAL_MATCH = [0, 2, 1, 3];
const SPECIAL_DROP_CHANCE = 0.12; // 敌方掉落特殊外卖概率
const SPECIAL_CUSTOMER_CHANCE = 0.15; // 生成特殊客户概率

/* 特殊客户效果 */
const BRAVE_TIME = 6; // 0-0「我超勇的」持续(秒)
const BRAVE_SPEED_MUL = 2.8; // 冲刺速度倍率
const BRAVE_DMG_MUL = 0.25; // 受击伤害倍率(大幅减伤)
const MELON_TIME = 8; // 0-1「水果摊」自动丢西瓜持续(秒)
const MELON_CD = 0.7; // 丢西瓜间隔(秒)
const MELON_DMG = 15; // 西瓜伤害
const MELON_MONEY = 30; // 西瓜命中奖励
const EAT_TIME = 8; // 1-0「焖子」撞死敌人被吃持续(秒)
const EAT_HEAL = 50; // 吃掉敌人回血
const EAT_PULSE_TIME = 0.5; // 「焖子」吃到敌人的果冻缩放时长(秒)
const EAT_DMG_MUL = 2; // 「焖子」状态撞击伤害倍率(更痛)
const KNIFE_STRONG_MUL = 2; // 刘华强西瓜刀: 伤害与贴图大小均为普通匕首的 2 倍
const EAT_TAKEN_MUL = 0.5; // 「焖子」状态受到伤害倍率(更抗揍)
const POISON_DROP_CHANCE = 0.15; // 敌方掉落中有毒概率
const POISON_ROAD_CHANCE = 0.25; // 路边生成中有毒概率
const POISON_HP = 15; // 玩家误食有毒外卖扣血
const THROW_DMG = 8; // 投掷普通外卖命中伤害
const THROW_POISON_DMG = 25; // 投掷有毒外卖命中伤害
const THROW_SPEED = 560; // 投掷初速 px/s
const THROW_RANGE = 340; // 自动锁定范围 px
const THROW_LIFE = 2.2; // 投掷物最长存活(秒), 超时落地
const FOOD_PRICE = 20; // 送达每个外卖的报酬
const FOOD_FINE = 8; // 缺少每个外卖的罚款
const CUSTOMER_DELAY_FIRST_M = 50; // 开局行驶多远后可能出现第一个客户(米)
const CUSTOMER_INTERVAL_MIN_M = 40; // 客户间隔距离下限(米)
const CUSTOMER_INTERVAL_MAX_M = 100; // 客户间隔距离上限(米)
const CUSTOMER_SPAWN_CHANCE = 0.6; // 到达距离阈值时的生成概率

/* 装备(道具图集 2×2: 行-列 0-0 匕首 / 0-1 手枪 / 1-0 步枪 / 1-1 盾牌)
 * frame 存 [列, 行]; 贴图朝向: 匕首朝上, 手枪朝右, 步枪朝右上 */
const WEAPONS = {
  dagger: {
    frame: [0, 0],
    price: 40,
    label: '匕首',
    color: '#c0392b',
    baseRot: 0,
    uses: 5,
    extraDmg: 15,
  },
  pistol: {
    frame: [1, 0], // 0-1: 第一行第二个
    price: 70,
    label: '手枪',
    color: '#2980b9',
    baseRot: Math.PI / 2, // 枪口朝向校正(再转 180°)
    ammo: 6,
    dmg: 12,
    rate: 0.45,
  },
  rifle: {
    frame: [0, 1], // 1-0: 第二行第一个
    price: 120,
    label: '步枪',
    color: '#27ae60',
    baseRot: -Math.PI / 4, // 枪口朝右上 → 顺时针 45° 使指向朝上
    ammo: 15,
    dmg: 15,
    rate: 0.3,
  },
  shield: { frame: [1, 1], price: 60, label: '盾牌', color: '#8e44ad', baseRot: 0, charges: 3 },
};
/* 店铺图集 3列×2行 帧位([列,行]): 外卖店 / 刀店 / 手枪店 / 步枪店 / 护盾店 */
const SHOP_FRAMES = {
  restaurant: [0, 0],
  dagger: [1, 0],
  pistol: [2, 0],
  rifle: [0, 1],
  shield: [1, 1],
};
const SHOP_DELAY_FIRST_M = 50; // 开局行驶多远后出现第一个店铺(米)
const SHOP_INTERVAL_MIN_M = 100; // 店铺间隔下限(米)
const SHOP_INTERVAL_MAX_M = 200; // 店铺间隔上限(米)
const FOOD_BUY_PRICE = 10; // 饭店购买单个外卖的价格
const FOOD_BUNDLE = 5; // 饭店一次购买的外卖数量(一家只卖一次)
/* 店铺价格随里程缓慢提升(无上限): 每 1 点难度(2000m) 价格 +SHOP_PRICE_PER_DIFF */
const SHOP_PRICE_PER_DIFF = 0.35;
const REST_DELAY_FIRST_M = 120; // 开局行驶多远后出现第一家饭店(米)
const REST_INTERVAL_MIN_M = 130; // 饭店间隔下限(米)
const REST_INTERVAL_MAX_M = 260; // 饭店间隔上限(米)
const ZONE_DELAY_FIRST_M = 120; // 开局行驶多远后出现第一个施工路段(米)
const ZONE_INTERVAL_MIN_M = 200; // 施工路段间隔下限(米)
const ZONE_INTERVAL_MAX_M = 400; // 施工路段间隔上限(米)
const ZONE_LEN_MIN = 500; // 施工路段长度下限(px)
const ZONE_LEN_MAX = 900; // 施工路段长度上限(px)
const ZONE_ANCHOR_Y = H * 0.66; // 世界坐标 → 屏幕 y 锚点(玩家标称位置)
const CRIME_SPEED_LIMIT = BASE_SPEED + 60; // 超过此速度算超速, 涨犯罪条
const CRIME_MAX_LVL = 4; // 犯罪等级上限(犯罪槽攒满自动升一级, 太刀气刃槽式)
const BRAVE_CRIME_MUL = 0.02; // 「我超勇的」期间犯罪累积倍率(大幅降低)
const CRIME_OVER_RATE = 0.12; // 满级后每秒提升的警车/道钉频率(无上限)

/* =====================================================================
 * 载具/操控方式配置
 * 新增载具: 在 assets.js 里加载对应贴图, 然后在此添加一项即可
 * ---------------------------------------------------------------------
 *  label      开始界面显示名
 *  desc       开始界面说明
 *  img        IMG 里的贴图键名(assets.js 加载)
 *  frames     贴图横向帧数(1 = 单帧, 2 = 两帧动画)
 *  anim       动画方式: 'none' 无 | 'step' 迈步(切帧扬尘)
 *  scale      贴图缩放(相对 baseH)
 *  maxDim     宽度上限(缩放前)
 *  baseH      基准高度(缩放前)
 *  maxHp      最大血量
 *  baseSpeed  场景基础速度 px/s
 *  maxSpeed   速度上限 px/s
 *  moveSpeed  横向/前后移动速度 px/s
 *  brake      前后速度影响系数(越小刹车越弱)
 *  damageMul  撞击敌人伤害倍率
 *  foodY      背负外卖起点 y(×height); 尺寸统一用 FOOD_STACK_PX
 *  foodGap    外卖层间距(×尺寸)
 *  foodSlowMax/foodSlowPer  超过该数量后每个外卖的减速比例
 *  smoke      'continuous' 连续车尾烟 | 'step' 切帧扬尘
 *  cementCrime 是否在水泥区涨犯罪条
 * ===================================================================== */
const VEHICLES = {
  walk: {
    label: '步行',
    desc: '腿着跑',
    unlock: 'free',
    img: 'walk',
    frames: 5, // 横向 5 帧奔跑序列帧(单帧 99×160)
    anim: 'step', // 切帧奔跑动画
    stepInterval: 0.14, // 每帧间隔(秒)
    bobAmp: 5, // (切帧模式下不生效, 保留)
    scale: 1,
    maxDim: 44,
    baseH: 90,
    maxHp: 60,
    baseSpeed: 112, // 约 20km/h
    maxSpeed: 224, // 约 40km/h
    moveSpeed: 112,
    brake: 0.5,
    damageMul: 0.5,
    foodY: -0.126,
    foodGap: 0.2,
    foodSlowMax: 8,
    foodSlowPer: 0.06,
    smoke: 'step',
    cementCrime: false,
  },
  rider: {
    label: '小电驴',
    desc: '标准设备',
    unlock: 'like',
    img: 'rider',
    frames: 1,
    anim: 'none',
    scale: RIDER_SCALE,
    maxDim: 44,
    baseH: 90,
    maxHp: 100,
    baseSpeed: BASE_SPEED,
    maxSpeed: SPEED_MAX,
    moveSpeed: 330,
    brake: 1,
    damageMul: 1,
    foodY: -0.1, // 背上外卖起点 y(×height)
    foodGap: 0.2,
    smoke: 'continuous',
    cementCrime: true,
  },
  cow: {
    label: '牛来',
    desc: '牛来！！',
    unlock: 'coin',
    img: 'cow',
    frames: 1,
    anim: 'none',
    scale: 1.5,
    maxDim: 44,
    baseH: 90,
    maxHp: 150,
    baseSpeed: 150, // 介于步行(83)与骑行(240)之间
    maxSpeed: 260,
    moveSpeed: 200,
    brake: 1,
    damageMul: 1.8, // 撞击伤害高
    foodY: -0.1,
    foodGap: 0.2,
    smoke: 'dust', // 连续扬尘
    cementCrime: true,
    dashOnEat: true, // 食用外卖后向前冲刺
  },
  car: {
    label: '跑车',
    desc: '提新车了',
    unlock: 'fav',
    img: 'car',
    frames: 1,
    anim: 'none',
    scale: 2,
    maxDim: 44,
    baseH: 90,
    maxHp: 130,
    baseSpeed: 290,
    maxSpeed: 470,
    moveSpeed: 360,
    brake: 1,
    damageMul: 0.8, // 伤害降低
    /* 跑车回血只能花钱: 不吃外卖、买东西也不送血 */
    payHealCost: 20, // 金钱回血: 花费
    payHealAmt: 30, // 金钱回血: 回复量
    foodY: -0.1,
    foodGap: 0.2,
    smoke: 'continuous',
    cementCrime: true,
    speedLimit: 400, // 跑车: 犯罪限速更高
    crimeMul: 1.4, // 犯罪条累积略高
  },
  train: {
    label: '火车头',
    desc: '心脏还有点问题',
    unlock: 'follow',
    img: 'train',
    frames: 6, // 横向 6 帧奔跑序列帧(单帧 109×160)
    anim: 'step', // 切帧奔跑动画
    stepInterval: 0.08, // 每帧间隔(秒) —— 火车头跑得快
    scale: 1,
    maxDim: 44,
    baseH: 90,
    maxHp: 180,
    baseSpeed: 640, // 极快(S 级, 面板冲破圆框)
    maxSpeed: 850,
    moveSpeed: 440,
    brake: 1,
    damageMul: 3, // 撞击敌人伤害高
    damageTakenMul: 0.5, // 受到的撞击伤害低
    foodY: -0.1,
    foodGap: 0.2,
    smoke: 'continuous',
    cementCrime: true,
    hpDrain: true, // 血量持续下降
    crimeMul: 0.1, // 犯罪条累积降低到 0.1
    pullR: 160, // 牵引范围: 吸引附近敌人
    aheadRatio: 0.85, // 更多敌人从上方来
    enemyRate: 1.8, // 敌人刷新率倍率(间隔 ÷ 该值)
    enemyCapBonus: 3, // 同屏敌人数上限加成
    softSpeedCap: 1200, // 速度软上限(px/s): 超过后增长趋缓(渐近 2400), 避免 pace 无上限后失控
  },
};

/* 火车头: 血量持续下降, 随速度与游戏时间增加而加剧 */
const TRAIN_DRAIN_BASE = 0.7; // 基础扣血 HP/s
const TRAIN_DRAIN_SPEED_REF = 200; // 速度参考
const TRAIN_DRAIN_TIME_RATE = 0.012; // 每秒游戏时间增加的扣血系数

/* 载具「牛」食用外卖后的冲刺 */
const DASH_TIME = 1.2; // 冲刺持续(秒)
const DASH_SPEED_MUL = 2.2; // 冲刺时默认滚动速度倍率
const DASH_DEALT_MUL = 3; // 冲刺时撞击敌人伤害倍率
const DASH_TAKEN_MUL = 0.3; // 冲刺时受到伤害倍率

/* ===== 逆行大运 Boss ===== */
const BOSS_HP = 200; // 血量(基础值, 随里程按 BOSS_SCALE_PER_DIFF 提升)
const BOSS_RAM_CD = 0.4; // 玩家撞 Boss 冷却(秒); 伤害用玩家自身撞击伤害(前撞 × 载具倍率)
const BOSS_POLICE_DMG = 120; // 警车撞 Boss 扣血(大量)
const BOSS_SIZE = 200; // 绘制高度(px)
const BOSS_DEFAULT_Y = 10; // 默认悬停的固定屏幕 y(相对屏幕静止, 只露出车头)
const BOSS_LANE_INTERVAL_MIN = 1.5; // 变道间隔下限(秒)
const BOSS_LANE_INTERVAL_MAX = 3; // 变道间隔上限(秒)
const BOSS_LANE_SPEED = 140; // 变道横向速度 px/s
const BOSS_CHARGE_INTERVAL_MIN = 2.5; // 悬停后前冲间隔下限(秒)
const BOSS_CHARGE_INTERVAL_MAX = 4; // 悬停后前冲间隔上限(秒)
const BOSS_CHARGE_SPEED = 520; // 前冲/逃逸速度 px/s
const BOSS_TIME = 30; // 存活时限(秒), 超时向下方开走
const BOSS_DELAY_FIRST_M = 1000; // 开局行驶多远后可能出现第一个大运(米)
const BOSS_INTERVAL_MIN_M = 400; // 大运间隔下限(米)
const BOSS_INTERVAL_MAX_M = 700; // 大运间隔上限(米)
const BOSS_SPAWN_CHANCE = 0.6; // 到达阈值时的生成概率
const BOSS_MONEY = 300; // 击败掉落金钱
const BOSS_EAT_HEAL = 120; // 「焖子」状态下吃掉大运的回血量
/* 大运数值随里程提升(无上限): 每 1 点难度(2000m) 血量/伤害/奖励 +100% */
const BOSS_SCALE_PER_DIFF = 1;

/* 色相偏移变体(敌骑手 / 大运有概率使用): ≈3.25rad */
const HUE_VARIANT_DEG = 186;

/* ===== UP 主信息 / 开发视频(载具选择页右侧展示) ===== */
const AUTHOR_NAME = '火山哥哥'; // UP 主昵称(展示用)
const VIDEO_TITLE = '点击即玩胆子最肥的送外卖游戏！'; // 开发视频标题(取不到接口时的兜底)
const VIDEO_COVER = 'https://i2.hdslb.com/bfs/archive/36c31a4bcc46b6b678738560073c0b4a474cf562.jpg'; // 开发视频封面(取不到接口时的兜底)
const AUTHOR_FACE = 'https://i1.hdslb.com/bfs/face/4327bd8f5452e59b98ef92ac082cadcc5d2d05e6.jpg'; // UP 头像(取不到接口时的兜底)
