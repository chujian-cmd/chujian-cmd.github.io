'use strict';

/* 水泥区店铺(卖装备)与饭店(卖外卖); 均可同时存在多个 */

/* global game, assets, PX_PER_M, SHOP_DELAY_FIRST_M, SHOP_INTERVAL_MIN_M, SHOP_INTERVAL_MAX_M, WEAPONS, SHOP_FRAMES, player, addFloatText, REST_DELAY_FIRST_M, REST_INTERVAL_MIN_M, REST_INTERVAL_MAX_M, FOOD_BUY_PRICE, FOOD_BUNDLE, SHOP_PRICE_PER_DIFF, ctx, fillRR, H, IMG, CEMENT_X, W, difficulty, makeFood, damagePlayer, spawnBoom, SHOP_RAM_DMG, vehicleDef, GROUND_SCROLL_MUL */

const shops = []; // 多个店铺 { type, x, y, fly, vx, vy, rot, spin, life }
let nextShopDist = SHOP_DELAY_FIRST_M * PX_PER_M; // 下一个店铺出现的距离阈值(px)
const SHOP_HIT_R = 70;
const SHOP_SIZE = 160;

/* 价格倍率: 随里程缓慢提升(无上限) */
function shopScale() {
  return 1 + difficulty() * SHOP_PRICE_PER_DIFF;
}
/* 饭店一次给的外卖数量(随里程增加) */
function restBundle() {
  return Math.max(1, Math.round(FOOD_BUNDLE * shopScale()));
}
/* 饭店一次的总价(数量变多 → 总价也涨) */
function restCost() {
  return FOOD_BUY_PRICE * restBundle();
}

function hitBuilding(b) {
  if (!b || b.fly) return false;
  const dx = b.x - player.x;
  const dy = b.y - player.y;
  return dx * dx + dy * dy < SHOP_HIT_R * SHOP_HIT_R;
}
function flyBuilding(b) {
  const dx = b.x - player.x;
  const dy = b.y - player.y;
  const d = Math.hypot(dx, dy) || 1;
  b.fly = true;
  b.vx = (dx / d) * 320 + (Math.random() - 0.5) * 90;
  b.vy = -240 - game.speed * 0.35;
  b.spin = (Math.random() < 0.5 ? 1 : -1) * (6 + Math.random() * 6);
  b.rot = 0;
  b.life = 0;
  player.kbx -= (dx / d) * 240;
  player.kby -= (dy / d) * 160;
  game.shake = 0.28;
  spawnBoom((player.x + b.x) / 2, (player.y + b.y) / 2);
}
function updateFly(b, dt) {
  b.life += dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.vy += 540 * dt;
  b.rot += b.spin * dt;
  return b.life > 0.95;
}
const BUILD_GAP = 200; // 建筑纵向最小间距(> 绘制尺寸 160, 避免贴图重叠)

/* 错开生成位置: 店铺与饭店统一计算, 顶部已有建筑时往上排,
 * 避免「店铺与店铺」「店铺与饭店」之间互相重叠 */
function staggerY(base) {
  let n = 0;
  for (const b of shops.concat(restaurants)) if (b.y < base + 300) n++;
  return base - n * BUILD_GAP;
}

function spawnShop() {
  const types = ['dagger', 'pistol', 'rifle', 'shield'];
  shops.push({
    type: types[Math.floor(Math.random() * types.length)],
    x: CEMENT_X + (W - CEMENT_X) / 2,
    y: staggerY(-60),
    fly: false,
    vx: 0,
    vy: 0,
    rot: 0,
    spin: 0,
    life: 0,
  });
}
function scheduleShop() {
  /* 难度越高店铺出现越频繁(间隔最多缩短 65%) */
  const d = difficulty();
  const m =
    (SHOP_INTERVAL_MIN_M + Math.random() * (SHOP_INTERVAL_MAX_M - SHOP_INTERVAL_MIN_M)) *
    Math.max(0.25, 1 - d * 0.65);
  nextShopDist = game.totalDist + m * PX_PER_M;
}
function updateShop(dt) {
  if (!game.over && assets.shop && game.totalDist >= nextShopDist) {
    spawnShop();
    scheduleShop();
  }
  for (let i = shops.length - 1; i >= 0; i--) {
    const s = shops[i];
    if (s.fly) {
      if (updateFly(s, dt)) shops.splice(i, 1);
      continue;
    }
    s.y += game.speed * GROUND_SCROLL_MUL * dt;
    if (hitBuilding(s)) ramShop(s);
    if (s && !s.fly && s.y > H + 100) shops.splice(i, 1);
  }
}
/* 载具购买时回血(如跑车) */
function healOnBuy() {
  const heal = vehicleDef().buyHeal || 0;
  if (heal <= 0) return;
  player.hp = Math.min(player.maxHp, player.hp + heal);
  player.healFlash = 0.4;
  addFloatText(player.x, player.y - player.height / 2 - 16, '+' + heal + ' HP', '#4ade80');
}

function ramShop(s) {
  const def = WEAPONS[s.type];
  const price = Math.round(def.price * shopScale()); // 随里程缓慢涨价
  if (player.money >= price) {
    player.money -= price;
    if (s.type === 'pistol' || s.type === 'rifle') {
      delete player.weapons.pistol;
      delete player.weapons.rifle;
    }
    /* 不用 ??(旧 WebView 不支持会整文件语法报错); 逐个取第一个有值的 */
    let ammo = def.uses;
    if (ammo === undefined) ammo = def.ammo;
    if (ammo === undefined) ammo = def.charges;
    player.weapons[s.type] = { ammo: ammo, cd: 0 };
    addFloatText(player.x, player.y - player.height / 2, def.label + ' -$' + price, '#ffd23f');
    healOnBuy();
  } else {
    damagePlayer(SHOP_RAM_DMG);
  }
  flyBuilding(s);
}

/* ---- 店铺绘制 ---- */
function drawShop() {
  for (const s of shops) {
    const def = WEAPONS[s.type];
    const size = SHOP_SIZE;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.fly) {
      ctx.rotate(s.rot);
      ctx.globalAlpha = Math.max(0, 1 - s.life / 0.95);
    }
    if (assets.shop) {
      /* 店铺图集 3列×2行 */
      const fw = IMG.shop.naturalWidth / 3;
      const fh = IMG.shop.naturalHeight / 2;
      const f = SHOP_FRAMES[s.type];
      ctx.drawImage(
        IMG.shop,
        f[0] * fw + 2,
        f[1] * fh + 2,
        fw - 4,
        fh - 4,
        -size / 2,
        -size / 2,
        size,
        size,
      );
    }
    if (!s.fly) {
      fillRR(-26, size / 2 - 4, 52, 18, 9, 'rgba(10,12,15,0.75)');
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      ctx.font = "bold 12px 'PingFang SC','Microsoft YaHei',sans-serif";
      ctx.fillText('$' + Math.round(def.price * shopScale()), 0, size / 2 + 9);
    }
    ctx.restore();
  }
}

const restaurants = []; // 多个饭店
let nextRestDist = REST_DELAY_FIRST_M * PX_PER_M; // 下一个饭店出现的距离阈值(px)

function spawnRestaurant() {
  restaurants.push({
    x: CEMENT_X + (W - CEMENT_X) / 2,
    y: staggerY(-60),
    fly: false,
    vx: 0,
    vy: 0,
    rot: 0,
    spin: 0,
    life: 0,
  });
}
function scheduleRestaurant() {
  /* 难度越高饭店出现越频繁(间隔最多缩短 60%) */
  const d = difficulty();
  const m =
    (REST_INTERVAL_MIN_M + Math.random() * (REST_INTERVAL_MAX_M - REST_INTERVAL_MIN_M)) *
    Math.max(0.25, 1 - d * 0.6);
  nextRestDist = game.totalDist + m * PX_PER_M;
}
function updateRestaurant(dt) {
  if (!game.over && assets.shop && game.totalDist >= nextRestDist) {
    spawnRestaurant();
    scheduleRestaurant();
  }
  for (let i = restaurants.length - 1; i >= 0; i--) {
    const r = restaurants[i];
    if (r.fly) {
      if (updateFly(r, dt)) restaurants.splice(i, 1);
      continue;
    }
    r.y += game.speed * GROUND_SCROLL_MUL * dt;
    if (hitBuilding(r)) ramRestaurant(r);
    if (r && !r.fly && r.y > H + 100) restaurants.splice(i, 1);
  }
}
function ramRestaurant(r) {
  const bundle = restBundle(); // 数量随里程增加
  const cost = restCost(); // 总价随之上涨
  if (player.money >= cost) {
    player.money -= cost;
    for (let i = 0; i < bundle && player.food.length < 99; i++) player.food.push(makeFood());
    addFloatText(
      player.x,
      player.y - player.height / 2,
      '+' + bundle + ' 外卖 -$' + cost,
      '#ffd23f',
    );
    healOnBuy();
  } else {
    damagePlayer(SHOP_RAM_DMG);
  }
  flyBuilding(r);
}
function drawRestaurant() {
  for (const r of restaurants) {
    const size = SHOP_SIZE;
    ctx.save();
    ctx.translate(r.x, r.y);
    if (r.fly) {
      ctx.rotate(r.rot);
      ctx.globalAlpha = Math.max(0, 1 - r.life / 0.95);
    }
    if (assets.shop) {
      /* 店铺图集 3列×2行, 饭店在 0-0 */
      const fw = IMG.shop.naturalWidth / 3;
      const fh = IMG.shop.naturalHeight / 2;
      ctx.drawImage(IMG.shop, 2, 2, fw - 4, fh - 4, -size / 2, -size / 2, size, size);
    }
    if (!r.fly) {
      fillRR(-30, size / 2 - 4, 60, 18, 9, 'rgba(10,12,15,0.75)');
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      ctx.font = "bold 12px 'PingFang SC','Microsoft YaHei',sans-serif";
      ctx.fillText(restBundle() + '个 $' + restCost(), 0, size / 2 + 9);
    }
    ctx.restore();
  }
}
