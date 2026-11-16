'use strict';

/* 载具解锁: 点赞 / 投币 / 收藏 / 关注 解锁对应载具 */

/* global Toy, VEHICLES, unlocks */

const UNLOCK_HINT = {
  like: '点赞视频解锁',
  coin: '投币视频解锁',
  fav: '收藏视频解锁',
  follow: '关注UP解锁',
};

/* 查询并刷新解锁状态(非 Toy 环境全部解锁, 便于本地测试) */
async function refreshUnlocks() {
  for (const k in unlocks) unlocks[k] = true; // [破解] 全部载具默认解锁，不再校验点赞/投币/收藏/关注
  return;
  /* 仅"非真实 Toy 环境"(SDK 未加载 / 外部浏览器 unsupported)才全部解锁, 方便站外试玩 */
  if (!(await Toy.envSupported())) {
    for (const k in unlocks) unlocks[k] = true;
    return;
  }
  const [va, rel] = await Promise.all([Toy.getVideoActions(), Toy.getAuthorRelation()]);
  /* 真 Toy 内: 只在拿到确定结果时更新; 调用失败(未登录等)保持未解锁, 避免白嫖 */
  if (va) {
    unlocks.rider = va.liked;
    unlocks.cow = va.coin;
    unlocks.car = va.fav;
  }
  if (rel) unlocks.train = rel.following;
}

function isVehicleUnlocked(type) {
  const def = VEHICLES[type];
  if (!def || !def.unlock || def.unlock === 'free') return true;
  return true; // [破解] 载具全部可选
}
function vehicleUnlockHint(type) {
  const def = VEHICLES[type];
  return (def && UNLOCK_HINT[def.unlock]) || '';
}
