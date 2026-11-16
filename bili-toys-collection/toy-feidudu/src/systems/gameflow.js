'use strict';

/* 游戏流程: 结束与重新开始 */

/* global game, player, W, H, BASE_SPEED, VEHICLES, enemies, boomParts, smokeParts, pickups, floatTexts, START_FOOD, START_MONEY, CUSTOMER_DELAY_FIRST_M, PX_PER_M, SHOP_DELAY_FIRST_M, REST_DELAY_FIRST_M, ZONE_DELAY_FIRST_M, zoneSigns, police, bullets, slashFX, spawnBoom, spawnSmokeAt, makeFood, applyVehicle, thrownFood, roadFoodTimer:writable, screenMsg, SFX, Toy, customers, nextCustomerDist:writable, shops, nextShopDist:writable, restaurants, nextRestDist:writable, zone:writable, nextZoneDist:writable, crimeCool:writable, policeTimer:writable, spikeStrip:writable, spikeTimer:writable, enemyTimer:writable, boss:writable, nextBossDist:writable, BOSS_DELAY_FIRST_M */

function gameOver() {
  if (!game.overReason) game.overReason = 'hp';
  game.over = true;
  game.shake = 0.6;
  SFX.play('death');
  /* 上报里程到排行榜(榜位 1, 单位米) */
  Toy.submitScore(Math.floor(game.totalDist / PX_PER_M));
  /* 玩家爆炸: 三连爆 + 烟雾 */
  for (let i = 0; i < 3; i++) {
    spawnBoom(player.x + (Math.random() - 0.5) * 40, player.y + (Math.random() - 0.5) * 40);
    spawnSmokeAt(
      player.x + (Math.random() - 0.5) * 30,
      player.y + (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 140,
      game.speed * (0.4 + Math.random() * 0.3),
    );
  }
}

/* 重新开始: 玩家回到中心 */
function resetGame() {
  game.over = false;
  game.overReason = '';
  game.distance = 0;
  game.totalDist = 0;
  game.scrollDist = 0;
  game.speed = VEHICLES.walk.baseSpeed;
  game.shake = 0;
  game.paused = false;
  game.time = 0; // 本局时间清零: 火车头掉血按本局时间递增, 避免跨局/挂机菜单累积
  game.menuScreen = 'main';
  player.x = W / 2;
  player.y = H * 0.66;
  player.vx = 0;
  player.vy = 0;
  player.kbx = 0;
  player.kby = 0;
  player.tilt = 0;
  player.hp = player.maxHp;
  player.hitCd = 1.5; // 重生短暂无敌
  player.flash = 0;
  enemies.length = 0;
  boomParts.length = 0;
  smokeParts.length = 0;
  pickups.length = 0;
  thrownFood.length = 0;
  roadFoodTimer = 3;
  floatTexts.length = 0;
  player.food = Array.from({ length: START_FOOD }, () => makeFood());
  player.foodLag = [];
  player.money = START_MONEY;
  player.healFlash = 0;
  customers.length = 0;
  nextCustomerDist = CUSTOMER_DELAY_FIRST_M * PX_PER_M;
  shops.length = 0;
  nextShopDist = SHOP_DELAY_FIRST_M * PX_PER_M;
  restaurants.length = 0;
  nextRestDist = REST_DELAY_FIRST_M * PX_PER_M;
  zone = null;
  zoneSigns.length = 0;
  nextZoneDist = ZONE_DELAY_FIRST_M * PX_PER_M;
  player.crime = 0;
  player.crimeLvl = 1;
  player.crimeOver = 0;
  crimeCool = 0;
  player.slowT = 0;
  player.buff = { brave: 0, melon: 0, eat: 0, dash: 0 };
  player.melonCd = 0;
  screenMsg.text = '';
  screenMsg.life = 0;
  /* 恢复默认载具(步行), 统一由 applyVehicle 设置尺寸/血量/移速 */
  applyVehicle('walk');
  police.length = 0;
  policeTimer = 0;
  spikeStrip = null;
  spikeTimer = 0;
  boss = null;
  nextBossDist = BOSS_DELAY_FIRST_M * PX_PER_M;
  player.weapons = {};
  bullets.length = 0;
  slashFX.length = 0;
  enemyTimer = 1.2;
}
