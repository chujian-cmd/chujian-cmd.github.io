'use strict';

/* 贴图资源: 道路/骑手必需(加载完才 ready), 其余贴图可选 */

/* global detectCustomerFrames, detectSpecialCustomerFrames, detectSpriteBox, updateBounds, applyVehicle, VEHICLES, HUE_VARIANT_DEG, hueSprite, POLICE_BOX:writable, SPIKE_BOX:writable, TRUCK_BOX:writable, spritesReady:writable, player */

const IMG = {
  road: new Image(),
  rider: new Image(),
  walk: new Image(),
  cow: new Image(),
  car: new Image(),
  train: new Image(),
  smoke: new Image(),
  enemy: new Image(),
  boom: new Image(),
  food: new Image(),
  poison: new Image(),
  customer: new Image(),
  specCus: new Image(),
  specFood: new Image(),
  item: new Image(),
  sign: new Image(),
  police: new Image(),
  spike: new Image(),
  shop: new Image(),
  truck: new Image(),
};
const assets = {
  road: false,
  rider: false,
  walk: false,
  cow: false,
  car: false,
  train: false,
  smoke: false,
  enemy: false,
  boom: false,
  food: false,
  poison: false,
  customer: false,
  specCus: false,
  specFood: false,
  item: false,
  sign: false,
  police: false,
  spike: false,
  shop: false,
  truck: false,
};
/* 各贴图非透明内容包围盒(剔除留白), 供碰撞/边界/阴影使用 */
const SPRITE_BOX = {};
let ready = false;

/* 延后加载的贴图: 游戏中后期才出现, 等 ready 之后再拉, 不阻塞首屏 */
const LATE_KEYS = ['shop', 'customer', 'truck'];
function loadLateImages() {
  IMG.customer.onload = () => {
    assets.customer = true;
    detectCustomerFrames(); // 分析逐帧包围盒
  };
  IMG.customer.src = 'assets/贴图/客户.png';
  IMG.shop.onload = () => {
    assets.shop = true;
  };
  IMG.shop.src = 'assets/贴图/店铺.png';
  IMG.truck.onload = () => {
    assets.truck = true;
    hueSprite(IMG.truck, HUE_VARIANT_DEG); // 预热色相变体(避免首次出现时先闪原色)
    detectWhenReady(IMG.truck, (b) => {
      TRUCK_BOX = b;
    }); // 精确裁切
  };
  IMG.truck.src = 'assets/贴图/大运.png';
}

/* 核心贴图加载完成后才 ready(加载页据此显示进度并屏蔽输入); 随后再拉延后贴图 */
let checked = false;
function checkReady() {
  if (checked) return;
  for (const k in assets) {
    if (LATE_KEYS.indexOf(k) >= 0) continue; // 延后贴图不参与 ready 判定
    if (!assets[k]) return;
  }
  checked = true;
  ready = true;
  loadLateImages();
}
/* 图片解码完成后再检测内容包围盒(避免刚 onload 时采到空白导致检测失败)
 * frames > 1 时只按第一帧取包围盒 */
function detectWhenReady(img, set, frames) {
  const run = () => {
    const b = detectSpriteBox(img, frames);
    if (b) set(b);
  };
  if (img.decode) img.decode().then(run).catch(run);
  else run();
}
/* 加载进度 0~1(只统计核心贴图, 延后贴图不计入) */
function loadProgress() {
  let done = 0;
  let total = 0;
  for (const k in assets) {
    if (LATE_KEYS.indexOf(k) >= 0) continue;
    total++;
    if (assets[k]) done++;
  }
  return total ? done / total : 1;
}

IMG.road.onload = () => {
  assets.road = true;
  checkReady();
};
IMG.walk.onload = () => {
  assets.walk = true;
  detectWhenReady(
    IMG.walk,
    (b) => {
      SPRITE_BOX.walk = b;
    },
    VEHICLES.walk.frames,
  );
  if (player.vehicle === 'walk') applyVehicle('walk');
  checkReady();
};
IMG.walk.src = 'assets/贴图/步行.png';
IMG.rider.onload = () => {
  assets.rider = true;
  detectWhenReady(
    IMG.rider,
    (b) => {
      SPRITE_BOX.rider = b;
    },
    VEHICLES.rider.frames,
  );
  spritesReady = true;
  if (player.vehicle === 'rider') applyVehicle('rider');
  else updateBounds();
  checkReady();
};
IMG.road.src = 'assets/贴图/道路.png';
IMG.cow.onload = () => {
  assets.cow = true;
  detectWhenReady(
    IMG.cow,
    (b) => {
      SPRITE_BOX.cow = b;
    },
    VEHICLES.cow.frames,
  );
  if (player.vehicle === 'cow') applyVehicle('cow');
}; // 牛可选
IMG.cow.src = 'assets/贴图/牛来.png';
IMG.car.onload = () => {
  assets.car = true;
  detectWhenReady(
    IMG.car,
    (b) => {
      SPRITE_BOX.car = b;
    },
    VEHICLES.car.frames,
  );
  if (player.vehicle === 'car') applyVehicle('car');
}; // 跑车可选
IMG.car.src = 'assets/贴图/跑车.png';
IMG.train.onload = () => {
  assets.train = true;
  detectWhenReady(
    IMG.train,
    (b) => {
      SPRITE_BOX.train = b;
    },
    VEHICLES.train.frames,
  );
  if (player.vehicle === 'train') applyVehicle('train');
}; // 火车头可选
IMG.train.src = 'assets/贴图/火车头.png';
IMG.rider.src = 'assets/贴图/骑手.png';
IMG.smoke.onload = () => {
  assets.smoke = true;
}; // 烟雾可选, 不阻塞 ready
IMG.smoke.src = 'assets/贴图/烟雾特效.png';
IMG.enemy.onload = () => {
  assets.enemy = true;
  hueSprite(IMG.enemy, HUE_VARIANT_DEG); // 预热色相变体(避免首次出现时先闪原色)
  detectWhenReady(IMG.enemy, (b) => {
    SPRITE_BOX.enemy = b;
  }); // 敌方骑手为单帧
}; // 敌骑手可选
IMG.enemy.src = 'assets/贴图/敌方骑手.png';
IMG.boom.onload = () => {
  assets.boom = true;
}; // 碰撞特效可选
IMG.boom.src = 'assets/贴图/碰撞特效.png';
IMG.food.onload = () => {
  assets.food = true;
}; // 外卖可选
IMG.food.src = 'assets/贴图/外卖.png';
IMG.poison.onload = () => {
  assets.poison = true;
}; // 有毒外卖可选(2列×1行)
IMG.poison.src = 'assets/贴图/有毒食物.png';
IMG.specCus.onload = () => {
  assets.specCus = true;
  detectSpecialCustomerFrames();
}; // 特殊客户可选(2×2)
IMG.specCus.src = 'assets/贴图/特殊客户.png';
IMG.specFood.onload = () => {
  assets.specFood = true;
}; // 特殊外卖可选(2×2)
IMG.specFood.src = 'assets/贴图/特殊外卖.png';
IMG.item.onload = () => {
  assets.item = true;
}; // 道具可选
IMG.item.src = 'assets/贴图/道具.png';
IMG.sign.onload = () => {
  assets.sign = true;
}; // 路障(原警告牌)可选
IMG.sign.src = 'assets/贴图/路障.png';
IMG.police.onload = () => {
  assets.police = true;
  detectWhenReady(IMG.police, (b) => {
    POLICE_BOX = b;
  }); // 精确裁切
}; // 警车可选
IMG.police.src = 'assets/贴图/警车.png';
IMG.spike.onload = () => {
  assets.spike = true;
  detectWhenReady(IMG.spike, (b) => {
    SPIKE_BOX = b;
  }); // 精确裁切
}; // 路钉可选
IMG.spike.src = 'assets/贴图/路钉.png';
IMG.fatty.onload = () => {
  assets.fatty = true;
}; // 开始界面背景图
IMG.fatty.src = 'assets/贴图/肥嘟嘟.png';
/* 店铺/大运 由 loadLateImages() 延后加载 */

/* ---- 加载兜底 ----
 * 任意贴图 404/解码失败/网络超时都不允许卡住 ready:
 * 否则 ready 永远为 false → 加载页停住且键盘/点击全被屏蔽 */

/* 1) 单张失败: 直接记为已加载(该贴图绘制时会被跳过) */
for (const k in IMG) {
  IMG[k].onerror = () => {
    assets[k] = true;
  };
}
/* 2) 全局超时: 10 秒后无论如何都放行 */
setTimeout(() => {
  if (ready) return;
  for (const k in assets) assets[k] = true;
  checkReady();
}, 10000);
