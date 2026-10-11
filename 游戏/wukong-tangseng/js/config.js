// 游戏数值配置（满级版：士兵满级 + 武将满级 + 武器满配 + 经济拉满）
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};

  var C = {};

  // 四大基础兵种：同字同级二合一升级，等级 1~5
  // 满级版：lvMul 固定返回 5 级倍率，一上场即满级
  C.SOLDIERS = {
    '刀': { name: '刀兵', dmg: 16, itv: 0.75, range: 1.35, hp: 120 },
    '枪': { name: '枪兵', dmg: 24, itv: 0.95, range: 1.8,  hp: 110 },
    '弓': { name: '弓兵', dmg: 13, itv: 0.55, range: 3.2,  hp: 80  },
    '骑': { name: '骑兵', dmg: 34, itv: 1.15, range: 1.5,  hp: 150 }
  };
  C.SOLDIER_CHARS = ['刀', '枪', '弓', '骑'];
  C.MAX_LV = 5;
  // 满级：始终按 5 级倍率计算
  C.lvMul = function (lv) { return Math.pow(2.1, C.MAX_LV - 1); };

  // 武将：征兵抽到金色单字碎片（不能作战，纯占格），拼齐姓名觉醒
  // 西游记版本：悟空、八戒、沙僧、唐三、白龙
  C.FRAG_MAP = {
    '悟': ['悟空', '空'], '空': ['悟空', '悟'],
    '八': ['八戒', '戒'], '戒': ['八戒', '八'],
    '沙': ['沙僧', '僧'], '僧': ['沙僧', '沙'],
    '唐': ['唐三', '三'], '三': ['唐三', '唐'],
    '白': ['白龙', '龙'], '龙': ['白龙', '白']
  };
  C.FRAG_CHARS = ['悟', '空', '八', '戒', '沙', '僧', '唐', '三', '白', '龙'];

  // 武将基础数值（满级版：已上调至满配强度）
  // 未装备武器时只有基础攻击；装备武器后伤害+武器加成，攻击特效变为武器造型
  C.GENERALS = {
    '悟空': { dmg: 180, itv: 0.45, range: 4.2, skill: 'pierce',  desc: '如意棒·贯穿直线' },
    '八戒': { dmg: 150, itv: 0.80, range: 2.2, skill: 'stun',    desc: '九齿钯·范围眩晕' },
    '沙僧': { dmg: 320, itv: 0.90, range: 2.6, skill: 'execute', desc: '降妖杖·斩杀残敌' },
    '唐三': { dmg: 110, itv: 0.22, range: 5.5, skill: 'snipe',   desc: '紧箍咒·速射' },
    '白龙': { dmg: 80,  itv: 0.70, range: 3.0, skill: 'aura',    desc: '龙息·友军攻击+20%' }
  };
  // 5位主角名（用于武器装备绑定）
  C.GENERAL_NAMES = ['悟空', '八戒', '沙僧', '唐三', '白龙'];

  // 征兵抽取权重（满级版：士兵与碎片权重拉满，铲子保留少量）
  C.RECRUIT_POOL = [
    { kind: 's', w: 60 },    // 士兵
    { kind: 'f', w: 35 },    // 武将碎片
    { kind: 'shovel', w: 5 } // 铲子道具
  ];

  // 敌人（满级版：数值不变，但 hpMul 固定为 1，不随波次增强）
  C.ENEMIES = {
    zei:  { ch: '贼', hp: 1,   spd: 0.1, mantou: 2, size: 0.62 },
    dao:  { ch: '盗', hp: 1,  spd: 0.1,  mantou: 3, size: 0.66 },
    kou:  { ch: '寇', hp: 1,  spd: 0.1, mantou: 5, size: 0.7  },
    fei:  { ch: '匪', hp: 1,  spd: 0.1,  mantou: 4, size: 0.6  },
    boss: { ch: '牛', hp: 1, spd: 0.1, mantou: 30, size: 0.95, boss: true }
  };
  // 满级：敌人血量不随波次成长
  C.hpMul = function (wave) { return 1; };

  C.ECON = {
    startMantou: 999,       // 满级：初始馒头拉满
    recruitBase: 0,         // 满级：征兵基础费用降到 1
    recruitInc: -1000000,          // 满级：递增负数
    hearts: 999,             // 满级：生命拉满
    benchSize: 5,
    waveBonus: function (w) { return 100 + w * 99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999; } // 满级：波次奖励拉高
  };

  C.LEVEL_NAME = '火焰山';
  C.MAX_WAVE = 10;

  // 玩家头像
  C.AVATARS = ['wukong', 'bajie', 'shaseng', 'tangsan', 'bailong'];
  C.AVATAR_LABELS = { wukong: '悟空', bajie: '八戒', shaseng: '沙僧', tangsan: '唐三', bailong: '白龙' };
  C.AVATAR_DEFAULT = 'wukong';

  // ============ 武器系统（满级版：掉落拉满 + 合成需求降为 0/1） ============
  C.WEAPON_QUALITY = {
    green:  { name: '凡品', color: '#5aa860', drop: 1.00, fragNeed: 0 },
    blue:   { name: '良品', color: '#4a8ad4', drop: 1.00, fragNeed: 0 },
    purple: { name: '珍品', color: '#a85ef0', drop: 1.00, fragNeed: 1 },
    orange: { name: '神器', color: '#e8a23a', drop: 1.00, fragNeed: 1 }
  };
  C.WEAPON_QUALITY_ORDER = ['green', 'blue', 'purple', 'orange'];

  // 武器列表（满级版：dmg 全部上调）
  C.WEAPONS = [
    // ===== 橙色神器 =====
    { id: 'dinghai',   name: '定海神针', quality: 'orange', owner: '悟空', dmg: 200, shape: 'staff',  desc: '如意金箍棒·一万三千五百斤' },
    { id: 'dingba',    name: '九齿钉耙', quality: 'orange', owner: '八戒', dmg: 180, shape: 'rake',   desc: '上宝沁金耙·天庭御赐' },
    { id: 'jiangyao',  name: '降妖宝杖', quality: 'orange', owner: '沙僧', dmg: 280, shape: 'monkspade', desc: '降妖真宝杖·月宫梭罗' },
    { id: 'xizhang',   name: '九环锡杖', quality: 'orange', owner: '唐三', dmg: 120, shape: 'crosier', desc: '唐王所赐·化缘专用' },
    { id: 'longzhu',   name: '渊海明珠', quality: 'orange', owner: '白龙', dmg: 100, shape: 'pearl',  desc: '西海龙宫·夜明珠' },

    // ===== 紫色珍品 =====
    { id: 'bajiaoshan', name: '芭蕉扇',   quality: 'purple', dmg: 140, shape: 'fan',    desc: '铁扇公主·一扇熄火' },
    { id: 'huluping',   name: '紫金葫芦', quality: 'purple', dmg: 130, shape: 'gourd',  desc: '金角大王·我叫你敢应吗' },
    { id: 'qixingjian', name: '七星剑',   quality: 'purple', dmg: 150, shape: 'sword',  desc: '天庭神器·斩妖除魔' },
    { id: 'jingping',   name: '羊脂玉净瓶', quality: 'purple', dmg: 120, shape: 'vase',  desc: '观音菩萨·净水甘霖' },
    { id: 'huangjinrope', name: '幌金绳', quality: 'purple', dmg: 110, shape: 'rope',   desc: '九尾狐狸·捆仙索' },

    // ===== 蓝色良品 =====
    { id: 'qingfeng',  name: '青锋剑',  quality: 'blue', dmg: 80, shape: 'sword', desc: '寒光凛凛·削铁如泥' },
    { id: 'xuantie',   name: '玄铁盾',  quality: 'blue', dmg: 60, shape: 'shield', desc: '坚不可摧·防御加成' },
    { id: 'hanbing',   name: '寒冰刃',  quality: 'blue', dmg: 75, shape: 'knife', desc: '北冰寒铁·附带冰冻' },
    { id: 'liehuo',    name: '烈火枪',  quality: 'blue', dmg: 85, shape: 'spear', desc: '南焰火精·灼烧敌军' },
    { id: 'fenglei',   name: '风雷弓',  quality: 'blue', dmg: 70, shape: 'bow',   desc: '风雷相激·万里穿杨' },

    // ===== 绿色凡品 =====
    { id: 'liumu',     name: '柳木剑',  quality: 'green', dmg: 40, shape: 'sword', desc: '乡野常见·聊胜于无' },
    { id: 'zhujie',    name: '竹节鞭',  quality: 'green', dmg: 45, shape: 'whip',  desc: '竹节所制·灵活轻便' },
    { id: 'tiegong',   name: '铁背弓',  quality: 'green', dmg: 35, shape: 'bow',   desc: '猎户标配·精度尚可' },
    { id: 'mutong',    name: '木铜盾',  quality: 'green', dmg: 30, shape: 'shield', desc: '包铜木盾·抵御流矢' },
    { id: 'shifu',     name: '石斧',    quality: 'green', dmg: 50, shape: 'axe',   desc: '粗石打磨·力大无穷' }
  ];
  C.WEAPON_MAP = {};
  C.WEAPONS.forEach(function (w) { C.WEAPON_MAP[w.id] = w; });

  // 玩家段位（满级版：默认从最高段位开始，可按需改回）
  C.RANKS = [
    '力士', '天兵', '天将', '星官', '星君',
    '真君', '元帅', '天王', '大帝', '天尊',
    '玉皇大天尊'
  ];
  C.SUB_LEVELS = ['一', '二', '三', '四', '五'];
  C.SUB_LEVELS_PER_RANK = 5;
  C.STARS_PER_RANK = 5;

  ZY.C = C;
})();