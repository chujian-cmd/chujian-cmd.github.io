(function () {
  const CAT_CONFIGS = {
    orange: {
      id: "orange",
      name: "橘猫",
      folder: "./Image",
      prefix: "cat_a",
      nativeFacing: "right",
      attackSfx: "orangeScratch",
      defeatSfx: "defaultDefeat",
      maxHp: 60,
      baseAttack: 15,
      healAmount: 15,
      yowlRageGain: 5,
      rageMax: 100,
      actionCooldown: 2,
      defeatScoreBase: 500,
    },
    tabby: {
      id: "tabby",
      name: "狸花猫",
      folder: "./Image",
      prefix: "cat_b",
      nativeFacing: "left",
      attackSfx: "tabbyScratch",
      defeatSfx: "defaultDefeat",
      maxHp: 65,
      baseAttack: 16,
      healAmount: 12,
      yowlRageGain: 5,
      rageMax: 100,
      actionCooldown: 2,
      defeatScoreBase: 600,
    },
    "follow-cat": {
      id: "follow-cat",
      name: "耄耋",
      folder: "./Image",
      prefix: "cat_d",
      nativeFacing: "left",
      attackSfx: "orangeScratch",
      hissSfx: "maodieHiss",
      defeatSfx: "defaultDefeat",
      maxHp: 70,
      baseAttack: 10,
      healAmount: 15,
      yowlRageGain: 5,
      rageMax: 75,
      actionCooldown: 2,
      defeatScoreBase: 500,
      hissInterruptRageGain: 25,
      spriteScale: 1.25,
      unlock: "follow",
    },
    "coin-cat": {
      id: "coin-cat",
      name: "丑橘",
      folder: "./Image",
      prefix: "cat_c",
      frames: {
        1: "cat_c_1.png",
        2: "cat_c_2.png",
        3: "cat_c_3.png",
        4: "cat_c_4.png",
        5: "cat_c_5.png",
        6: "cat_c_6.png",
        7: "cat_c_7.png",
      },
      nativeFacing: "left",
      attackSfx: "orangeScratch",
      defeatSfx: "defaultDefeat",
      maxHp: 60,
      baseAttack: 10,
      healAmount: 12,
      yowlRageGain: 10,
      rageMax: 100,
      actionCooldown: 2,
      defeatScoreBase: 500,
      unlock: "coin",
    },
    "banana-cat": {
      id: "banana-cat",
      name: "香蕉猫",
      folder: "./Image",
      prefix: "cat_e",
      nativeFacing: "left",
      attackSfx: "bananaScratch",
      yowlSfx: "bananaYowl",
      hitSfx: "bananaHit",
      defeatSfx: "bananaDefeat",
      maxHp: 60,
      baseAttack: 15,
      healAmount: 15,
      yowlRageGain: 5,
      rageMax: 100,
      actionCooldown: 1.5,
      defeatScoreBase: 500,
      unlock: "coin",
    },
    // [v2 新增] 棍母：无贴图（全透明帧图 cat_g_*.png），全部数值拉满
    gunmu: {
      id: "gunmu",
      name: "棍母",
      folder: "./Image",
      prefix: "cat_g",
      nativeFacing: "right",
      attackSfx: "orangeScratch",
      defeatSfx: "defaultDefeat",
      maxHp: 999,
      baseAttack: 999,
      healAmount: 999,
      yowlRageGain: 999,
      rageMax: 999,
      actionCooldown: 0.2,
      defeatScoreBase: 9999,
      hissInterruptRageGain: 999,
      spriteScale: 1,
    },
  };

  const BATTLE_CONFIG = {
    designWidth: 720,
    designHeight: 1280,
    backgroundImage: "",
    actionDurationMs: 1000,
    hitDurationMs: 1000,
    stunDurationMs: 2000,
    hissInterruptChance: 0.8,
    enemyCounterHissChance: 0.4,
    counterHissRageReductionPerPoint: 0.03,
    enemyMimicChance: 0.3,
    enemyDecisionMinMs: 1600,
    enemyDecisionMaxMs: 3200,
    enemyInterruptedRetryMs: 1000,
    enemyAttackWarningChance: 0.3,
    enemyAttackWarningMs: 700,
    dangerSenseChancePerBuff: 0.02,
    evasionChanceCap: 0.8,
    minActionCooldown: 0.2,
    yowlTickMs: 500,
    healTickMs: 1000,
    rageDamageStep: 10,
    rageDamageBonus: 2,
    hpScoreMultiplier: 50,
    winStreakBonusPerWin: 0.25,
  };

  const BUFF_POOL = [
    {
      id: "evasion",
      text: "增加2%闪避概率",
      summary: (count) => `闪避+${count * 2}%`,
    },
    {
      id: "maxHp",
      text: "增加5点血量",
      summary: (count) => `生命+${count * 5}`,
    },
    {
      id: "heal",
      text: "增加1点回血量",
      summary: (count) => `回血+${count}`,
    },
    {
      id: "attack",
      text: "增加1点基础攻击力",
      summary: (count) => `攻击+${count}`,
    },
    {
      id: "cooldown",
      text: "减少0.1秒行动CD",
      summary: (count) => `CD-${(count * 0.1).toFixed(1)}秒`,
    },
    {
      id: "rageOnHit",
      text: "被攻击时增加5点怒气",
      summary: (count) => `受击怒气+${count * 5}`,
    },
    {
      id: "stunReduction",
      text: "被打断后僵直时间减少0.2s",
      summary: (count) => `僵直-${(count * 0.2).toFixed(1)}秒`,
    },
    {
      id: "yowl",
      text: "增加1点攒怒气量",
      summary: (count) => `攒怒+${count}`,
    },
    {
      id: "scoreBase",
      text: "每局获胜的底分加100",
      summary: (count) => `胜利底分+${count * 100}`,
    },
    {
      id: "dangerSense",
      text: "危险预知概率加2%",
      summary: (count) => `预知+${count * 2}%`,
    },
  ];
  const COMBAT_BUFF_POOL = BUFF_POOL.filter(
    (buff) => !["scoreBase", "dangerSense"].includes(buff.id),
  );

  const TOY_CONFIG = {
    scoreBoard: 1,
    authorMid: "4132220",
    authorName: "洪山桥小老板",
    // 正式上传包保持关闭；如需本地录屏临时全解锁，录完必须改回 false。
    localPreviewUnlockAll: false,
    // 关联投币视频预留位：上传视频后填写 BV 或 aid；留空时投币解锁入口保持待配置。
    targetVideoBv: "BV1fm8K6bE8d",
    targetVideoAid: 117130552936279,
    cloudKeys: {
      settings: "jimidou_settings_v1",
      followUnlocked: "jimidou_follow_cat_v1",
      coinUnlocked: "jimidou_coin_cat_v1",
      selectedPlayer: "jimidou_selected_player_v1",
      selectedEnemy: "jimidou_selected_enemy_v1",
      winStreak: "jimidou_win_streak_v1",
      bestScore: "jimidou_best_score_v1",
      bestWinStreak: "jimidou_best_win_streak_v1",
      runBuffs: "jimidou_run_buffs_v1",
    },
  };

  window.JIMIDOU_CONFIG = { CAT_CONFIGS, BATTLE_CONFIG, TOY_CONFIG };

  const ACTION_LABELS = {
    hiss: "哈气",
    scratch: "抓挠",
    yowl: "老吴叫",
    chew: "嚼口香糖回血",
  };

  const DECOR_IMAGE_FILES = [
    "./Image/猫爪装饰物.png",
  ];

  const AUDIO_FILES = {
    menu: "./audio/菜单背景音乐.mp3",
    battle: "./audio/战斗背景音乐.mp3",
    menuClick: "./audio/基米斗~.mp3",
    hiss: "./audio/哈气.mp3",
    yowl: "./audio/老吴叫.mp3",
    chew: "./audio/嚼口香糖回血.mp3",
    orangeScratch: "./audio/橘猫攻击音效.mp3",
    tabbyScratch: "./audio/狸花猫攻击音效.mp3",
    bananaScratch: "./audio/香蕉猫攻击音效.mp3",
    bananaYowl: "./audio/香蕉猫老吴叫音效.mp3",
    bananaHit: "./audio/香蕉猫被打音效.mp3",
    bananaDefeat: "./audio/香蕉猫战败音效.mp3",
    maodieHiss: "./audio/耄耋哈气音效.mp3",
    defaultDefeat: "./audio/其他猫默认战败音效.mp3",
  };

  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const now = () => performance.now();
  const adapter = () => window.JimidouToyAdapter;

  const dom = {
    app: $("app"),
    bootGuard: $("bootGuard"),
    loadingText: $("loadingText"),
    screens: {
      loading: $("loadingScreen"),
      menu: $("menuScreen"),
      battle: $("battleScreen"),
      cats: $("catsScreen"),
      settings: $("settingsScreen"),
      rank: $("rankScreen"),
      unlock: $("unlockScreen"),
      rules: $("rulesScreen"),
      buff: $("buffScreen"),
      result: $("resultScreen"),
    },
    stage: document.querySelector(".stage-shell"),
    fxCanvas: $("fxCanvas"),
    menuStatus: $("menuStatus"),
    menuPlayerCat: $("menuPlayerCat"),
    menuEnemyCat: $("menuEnemyCat"),
    battleField: $("battleField"),
    playerCat: $("playerCat"),
    enemyCat: $("enemyCat"),
    enemyAttackWarning: $("enemyAttackWarning"),
    playerHpBar: $("playerHpBar"),
    enemyHpBar: $("enemyHpBar"),
    playerNameText: $("playerNameText"),
    enemyNameText: $("enemyNameText"),
    playerHpText: $("playerHpText"),
    enemyHpText: $("enemyHpText"),
    playerRageText: $("playerRageText"),
    enemyRageText: $("enemyRageText"),
    battleLog: $("battleLog"),
    cooldownRing: $("cooldownRing"),
    actionButtons: Array.from(document.querySelectorAll(".action-button")),
    catTargetTabs: $("catTargetTabs"),
    catCards: Array.from(document.querySelectorAll("[data-select-cat]")),
    followCatCard: $("followCatCard"),
    coinCatCard: $("coinCatCard"),
    bananaCatCard: $("bananaCatCard"),
    followCatStatus: $("followCatStatus"),
    coinCatStatus: $("coinCatStatus"),
    bananaCatStatus: $("bananaCatStatus"),
    musicVolume: $("musicVolume"),
    sfxVolume: $("sfxVolume"),
    runStreakText: $("runStreakText"),
    runBuffList: $("runBuffList"),
    localRecordText: $("localRecordText"),
    myRankText: $("myRankText"),
    rankTabs: $("rankTabs"),
    rankList: $("rankList"),
    unlockSummary: $("unlockSummary"),
    followStatus: $("followStatus"),
    coinStatus: $("coinStatus"),
    buffSummary: $("buffSummary"),
    buffChoices: $("buffChoices"),
    resultTitle: $("resultTitle"),
    resultScore: $("resultScore"),
    resultRank: $("resultRank"),
  };

  const state = {
    screen: "loading",
    selectedPlayerCat: "orange",
    selectedEnemyCat: "tabby",
    catSelectTarget: "player",
    unlocks: {
      follow: true, // [破解]
      coin: true, // [破解]
    },
    settings: {
      musicVolume: 0.65,
      sfxVolume: 0.8,
    },
    winStreak: 0,
    bestScore: 0,
    bestWinStreak: 0,
    runBuffs: {},
    pendingVictoryScore: 0,
    rankPeriod: "all",
    battle: null,
    lastFrame: now(),
  };

  // [菜单] 作弊菜单接口：开关标志与操作接口，供 jimi-menu.js 使用
  window.__JIMI_CHEATS = window.__JIMI_CHEATS || {};
  window.__JIMI_API = {
    healPlayer() {
      const p = state.battle?.player;
      if (!p || p.defeated) return false;
      p.hp = p.config.maxHp;
      return true;
    },
    fillRage() {
      const p = state.battle?.player;
      if (!p || p.defeated) return false;
      p.rage = p.config.rageMax;
      return true;
    },
    inBattle() {
      return Boolean(state.battle?.active);
    },
  };

  const SAVE_QUEUE_WINDOW_MS = 150;
  const SAVE_RATE_LIMIT_BASE_MS = 1000;
  const SAVE_RATE_LIMIT_MAX_MS = 30000;
  const VOLUME_SAVE_DEBOUNCE_MS = 500;
  const pendingCloudSaves = new Map();
  let cloudSaveTimer = 0;
  let cloudSavePromise = null;
  let cloudSaveBackoffUntil = 0;
  let cloudSaveBackoffMs = 0;
  let settingsSaveTimer = 0;

  class AudioManager {
    constructor(files) {
      this.files = files;
      this.context = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.buffers = new Map();
      this.rawBuffers = new Map();
      this.currentMusic = null;
      this.currentMusicName = "";
      this.pendingMusic = "";
      this.ready = false;
      this.decoding = null;
    }

    async preload() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext || typeof window.fetch !== "function") return;
      await Promise.all(
        Object.entries(this.files).map(async ([name, src]) => {
          try {
            const response = await fetch(src);
            const data = await response.arrayBuffer();
            this.rawBuffers.set(name, data);
          } catch (error) {
            console.warn(`[Audio] ${name} load failed`, error);
          }
        }),
      );
    }

    async ensureContext() {
      if (this.ready) return;
      if (this.decoding) return this.decoding;
      this.decoding = (async () => {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext || !this.rawBuffers.size) return;
        try {
          if (!this.context) {
            this.context = new AudioContext();
            this.musicGain = this.context.createGain();
            this.sfxGain = this.context.createGain();
            this.musicGain.connect(this.context.destination);
            this.sfxGain.connect(this.context.destination);
            this.applyVolumes();
          }
          await Promise.all(
            Array.from(this.rawBuffers.entries()).map(async ([name, data]) => {
              if (this.buffers.has(name)) return;
              try {
                const copy = data.slice(0);
                const buffer = await this.context.decodeAudioData(copy);
                this.buffers.set(name, buffer);
              } catch (error) {
                console.warn(`[Audio] ${name} decode failed`, error);
              }
            }),
          );
          this.ready = true;
        } catch (error) {
          console.warn("[Audio] initialization disabled", error);
          this.context = null;
        }
      })();
      return this.decoding;
    }

    async unlock() {
      try {
        await this.ensureContext();
      } catch (error) {
        console.warn("[Audio] unlock failed", error);
        return;
      }
      if (!this.context) return;
      if (this.context.state !== "running") {
        try {
          await this.context.resume();
        } catch (error) {
          console.warn("[Audio] resume failed", error);
        }
      }
      if (this.pendingMusic) this.playMusic(this.pendingMusic);
    }

    setVolumes(music, sfx) {
      state.settings.musicVolume = music;
      state.settings.sfxVolume = sfx;
      this.applyVolumes();
    }

    applyVolumes() {
      if (this.musicGain) this.musicGain.gain.value = state.settings.musicVolume;
      if (this.sfxGain) this.sfxGain.gain.value = state.settings.sfxVolume;
    }

    stopMusic() {
      if (!this.currentMusic) return;
      try {
        this.currentMusic.stop();
      } catch (error) {
        // Already stopped.
      }
      this.currentMusic = null;
      this.currentMusicName = "";
    }

    playMusic(name) {
      this.pendingMusic = name;
      if (!this.context || !this.buffers.has(name)) return;
      if (this.currentMusicName === name) return;
      this.stopMusic();
      const source = this.context.createBufferSource();
      source.buffer = this.buffers.get(name);
      source.loop = true;
      source.connect(this.musicGain);
      source.start();
      this.currentMusic = source;
      this.currentMusicName = name;
    }

    playSfx(name, rate = 1) {
      if (!this.ready && this.rawBuffers.has(name)) {
        this.ensureContext().then(() => {
          if (this.context?.state === "running") this.playSfx(name, rate);
        });
        return;
      }
      if (!this.context || !this.buffers.has(name) || state.settings.sfxVolume <= 0.001) return;
      const source = this.context.createBufferSource();
      source.buffer = this.buffers.get(name);
      source.playbackRate.value = rate;
      source.connect(this.sfxGain);
      source.start();
    }
  }

  class Effects {
    constructor(canvas, stage) {
      this.canvas = canvas;
      this.stage = stage;
      this.ctx = canvas.getContext("2d");
      this.particles = [];
      this.damagePool = [];
      this.dpr = 1;
      for (let i = 0; i < 96; i += 1) {
        this.particles.push({
          active: false,
          sleeping: true,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          life: 0,
          maxLife: 0,
          size: 0,
          color: "#fff",
        });
      }
      for (let i = 0; i < 10; i += 1) {
        const node = document.createElement("span");
        node.className = "damage-pop";
        node.hidden = true;
        this.stage.appendChild(node);
        this.damagePool.push({ node, active: false, timer: 0 });
      }
      this.resize();
      window.addEventListener("resize", () => this.resize());
    }

    resize() {
      this.dpr = Math.min(1.5, window.devicePixelRatio || 1);
      this.canvas.width = BATTLE_CONFIG.designWidth * this.dpr;
      this.canvas.height = BATTLE_CONFIG.designHeight * this.dpr;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    burst(x, y, color, amount = 12) {
      for (let i = 0; i < amount; i += 1) {
        const p = this.particles.find((item) => !item.active);
        if (!p) return;
        p.active = true;
        p.sleeping = false;
        p.x = x;
        p.y = y;
        p.vx = rand(-110, 110);
        p.vy = rand(-210, -35);
        p.life = rand(0.32, 0.72);
        p.maxLife = p.life;
        p.size = rand(4, 9);
        p.color = color;
      }
    }

    popText(text, x, y, color = "#f05d5e") {
      const item = this.damagePool.find((entry) => !entry.active) || this.damagePool[0];
      item.active = true;
      item.timer = 0.72;
      item.node.hidden = false;
      item.node.textContent = text;
      item.node.classList.toggle("is-interrupt", text === "打断！");
      item.node.style.left = `${(x / BATTLE_CONFIG.designWidth) * 100}%`;
      item.node.style.top = `${(y / BATTLE_CONFIG.designHeight) * 100}%`;
      item.node.style.color = color;
      item.node.style.animation = "none";
      item.node.offsetHeight;
      item.node.style.animation = "";
    }

    update(dt) {
      this.ctx.clearRect(0, 0, BATTLE_CONFIG.designWidth, BATTLE_CONFIG.designHeight);
      for (const p of this.particles) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          p.sleeping = true;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 360 * dt;
        const alpha = clamp(p.life / p.maxLife, 0, 1);
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.globalAlpha = 1;
      for (const item of this.damagePool) {
        if (!item.active) continue;
        item.timer -= dt;
        if (item.timer <= 0) {
          item.active = false;
          item.node.hidden = true;
        }
      }
    }
  }

  let audio = null;
  let effects = null;

  function showCompatibilityError(error) {
    console.error("[Init] fatal error", error);
    if (typeof window.JimidouShowCompatibilityError === "function") {
      window.JimidouShowCompatibilityError();
      return;
    }
    if (dom.loadingText) {
      dom.loadingText.textContent = "你的设备版本过低，请更新B站或用浏览器打开";
    }
    if (dom.bootGuard) {
      dom.bootGuard.textContent = "加载失败，请刷新页面；仍无法打开时请更新B站或用浏览器打开";
      dom.bootGuard.classList.remove("is-hidden");
    }
  }

  function frameSrc(config, frame) {
    if (config.frames?.[frame]) {
      return `${config.folder}/${config.frames[frame]}`;
    }
    return `${config.folder}/${config.prefix}_${frame}.png`;
  }

  function shouldFlipForSide(config, side) {
    const desiredFacing = side === "player" ? "right" : "left";
    return config.nativeFacing !== desiredFacing;
  }

  function isLocalRecordingMode() {
    const host = window.location.hostname;
    return (
      Boolean(TOY_CONFIG.localPreviewUnlockAll) &&
      (window.location.protocol === "file:" ||
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1")
    );
  }

  function isCatUnlocked(catId) {
    return true; // [破解] 全部小猫默认解锁
  }

  function parseSettings(value) {
    try {
      const parsed = JSON.parse(value || "{}");
      return {
        musicVolume: clamp(Number(parsed.musicVolume ?? state.settings.musicVolume), 0, 1),
        sfxVolume: clamp(Number(parsed.sfxVolume ?? state.settings.sfxVolume), 0, 1),
      };
    } catch (error) {
      return state.settings;
    }
  }

  async function preloadImages() {
    const sources = new Set();
    DECOR_IMAGE_FILES.forEach((src) => sources.add(src));
    Object.values(CAT_CONFIGS).forEach((cat) => {
      for (let frame = 1; frame <= 7; frame += 1) {
        sources.add(frameSrc(cat, frame));
      }
    });
    const list = Array.from(sources);
    let loaded = 0;
    await Promise.all(
      list.map(
        (src) =>
          new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
              loaded += 1;
              dom.loadingText.textContent = `正在预加载小猫 ${loaded}/${list.length}`;
              resolve();
            };
            image.onerror = () => reject(new Error(`贴图加载失败：${src}`));
            image.src = src;
          }),
      ),
    );
  }

  function showScreen(name) {
    state.screen = name;
    Object.entries(dom.screens).forEach(([screenName, element]) => {
      element.classList.toggle("is-hidden", screenName !== name);
    });
    if (
      name === "menu" ||
      name === "cats" ||
      name === "settings" ||
      name === "rank" ||
      name === "unlock" ||
      name === "rules" ||
      name === "buff"
    ) {
      audio.playMusic("menu");
    }
    if (name === "menu") updateRunStatus();
    if (name === "battle") {
      audio.playMusic("battle");
    }
  }

  function showToast(text) {
    dom.menuStatus.textContent = text;
    if (state.screen === "battle") dom.battleLog.textContent = text;
  }

  function formatSecondsFromMs(value) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}秒`;
  }

  function safeParseJson(value, fallback) {
    try {
      if (!value) return fallback;
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function normalizeBuffs(value = {}) {
    const normalized = {};
    BUFF_POOL.forEach((buff) => {
      const count = Math.max(0, Number(value[buff.id] || 0) || 0);
      if (count) normalized[buff.id] = count;
    });
    return normalized;
  }

  function totalBuffCount(buffs = state.runBuffs) {
    return Object.values(buffs).reduce((sum, count) => sum + count, 0);
  }

  function addBuffToSet(buffs, buffId) {
    return normalizeBuffs({ ...buffs, [buffId]: (buffs[buffId] || 0) + 1 });
  }

  function randomBuffId(pool = BUFF_POOL) {
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  function randomBuffOptions(count = 3) {
    const pool = [...BUFF_POOL];
    const options = [];
    while (pool.length && options.length < count) {
      const index = Math.floor(Math.random() * pool.length);
      options.push(pool.splice(index, 1)[0]);
    }
    return options;
  }

  function randomBuffs(count, { combatOnly = false } = {}) {
    const pool = combatOnly ? COMBAT_BUFF_POOL : BUFF_POOL;
    let buffs = {};
    for (let i = 0; i < count; i += 1) {
      buffs = addBuffToSet(buffs, randomBuffId(pool));
    }
    return buffs;
  }

  function effectiveCooldownReduction(count, catId = state.selectedPlayerCat) {
    const baseConfig = CAT_CONFIGS[catId] || CAT_CONFIGS.orange;
    const rawReduction = (Number(count) || 0) * 0.1;
    const maxReduction = Math.max(0, baseConfig.actionCooldown - BATTLE_CONFIG.minActionCooldown);
    return Math.min(rawReduction, maxReduction);
  }

  function buffLabel(buffId, count) {
    const value = Number(count) || 0;
    if (buffId === "evasion") {
      const capped = Math.min(value * 2, BATTLE_CONFIG.evasionChanceCap * 100);
      return `闪避+${Math.round(capped)}%`;
    }
    if (buffId === "cooldown") {
      return `CD-${effectiveCooldownReduction(value).toFixed(1)}秒`;
    }
    const buff = BUFF_POOL.find((item) => item.id === buffId);
    return buff ? buff.summary(value) : "";
  }

  function updateRunStatus() {
    if (!dom.runStreakText || !dom.runBuffList) return;
    dom.runStreakText.textContent = `${state.winStreak} 连胜`;
    dom.runBuffList.replaceChildren();
    const entries = Object.entries(state.runBuffs).filter(([, count]) => count > 0);
    entries.forEach(([buffId, count]) => {
      const item = document.createElement("span");
      item.textContent = buffLabel(buffId, count);
      dom.runBuffList.appendChild(item);
    });
  }

  function updateLocalRecordText() {
    if (!dom.localRecordText) return;
    dom.localRecordText.textContent = `本地最高分 ${state.bestScore} · 最高连胜 ${state.bestWinStreak}`;
  }

  function resetRunProgress() {
    const hadWinStreak = state.winStreak !== 0;
    const hadBuffs = Object.values(state.runBuffs).some((count) => count > 0);
    state.winStreak = 0;
    state.runBuffs = {};
    state.pendingVictoryScore = 0;
    dom.menuStatus.textContent = "连胜和增益已清零";
    updateRunStatus();
    const keys = TOY_CONFIG.cloudKeys;
    const changed = {};
    if (hadWinStreak) changed[keys.winStreak] = "0";
    if (hadBuffs) changed[keys.runBuffs] = JSON.stringify({});
    saveRunState(changed);
  }

  function saveRunState(changed = {}) {
    Object.entries(changed).forEach(([key, value]) => queueSave(key, value));
  }

  function applyBuffsToConfig(baseConfig, buffs = {}) {
    const maxHpBonus = (buffs.maxHp || 0) * 5;
    const cooldownReduction = (buffs.cooldown || 0) * 0.1;
    return {
      ...baseConfig,
      maxHp: baseConfig.maxHp + maxHpBonus,
      baseAttack: baseConfig.baseAttack + (buffs.attack || 0),
      healAmount: baseConfig.healAmount + (buffs.heal || 0),
      yowlRageGain: baseConfig.yowlRageGain + (buffs.yowl || 0),
      actionCooldown: Math.max(BATTLE_CONFIG.minActionCooldown, Number((baseConfig.actionCooldown - cooldownReduction).toFixed(2))),
      evasionChance: clamp((buffs.evasion || 0) * 0.02, 0, BATTLE_CONFIG.evasionChanceCap),
      rageOnAttacked: (buffs.rageOnHit || 0) * 5,
      stunReductionMs: (buffs.stunReduction || 0) * 200,
      scoreBaseBonus: (buffs.scoreBase || 0) * 100,
      dangerSenseChance: (buffs.dangerSense || 0) * BATTLE_CONFIG.dangerSenseChancePerBuff,
    };
  }

  function catStatTexts(config) {
    return [
      `生命 ${config.maxHp}`,
      `基础攻击力 ${config.baseAttack}`,
      `攒怒速度 +${config.yowlRageGain}/${formatSecondsFromMs(BATTLE_CONFIG.yowlTickMs)}`,
      `回血速度 +${config.healAmount}/${formatSecondsFromMs(BATTLE_CONFIG.healTickMs)}`,
      `怒气上限 ${config.rageMax}`,
      `行动CD ${config.actionCooldown}秒`,
    ];
  }

  function renderCatStats(card, config) {
    let stats = card.querySelector(".cat-stats");
    if (!stats) {
      stats = document.createElement("div");
      stats.className = "cat-stats";
      card.appendChild(stats);
    }
    stats.replaceChildren();
    catStatTexts(config).forEach((text) => {
      const item = document.createElement("b");
      item.textContent = text;
      stats.appendChild(item);
    });
  }

  function isCloudSaveBackoffActive() {
    return cloudSaveBackoffUntil > Date.now();
  }

  function scheduleCloudSave(delay = SAVE_QUEUE_WINDOW_MS) {
    if (cloudSaveTimer) window.clearTimeout(cloudSaveTimer);
    cloudSaveTimer = window.setTimeout(() => {
      cloudSaveTimer = 0;
      void flushCloudSaveQueue();
    }, delay);
  }

  function startCloudSaveBackoff() {
    cloudSaveBackoffMs = cloudSaveBackoffMs
      ? Math.min(SAVE_RATE_LIMIT_MAX_MS, cloudSaveBackoffMs * 2)
      : SAVE_RATE_LIMIT_BASE_MS;
    cloudSaveBackoffUntil = Date.now() + cloudSaveBackoffMs;
  }

  function queueSave(key, value) {
    if (!key) return;
    pendingCloudSaves.set(key, value);
    scheduleCloudSave();
  }

  function saveLocalCloudBatch(items) {
    return adapter()
      .saveCloud(items, { localOnly: true })
      .catch((error) => console.warn("[Cloud] local save failed", error));
  }

  function takePendingCloudSaves() {
    const batch = Object.fromEntries(pendingCloudSaves);
    pendingCloudSaves.clear();
    return batch;
  }

  function isCloudSaveRateLimited(resultOrError) {
    const code =
      resultOrError?.code ??
      resultOrError?.errCode ??
      resultOrError?.errorCode ??
      resultOrError?.data?.code ??
      resultOrError?.data?.errCode;
    return Boolean(
      resultOrError?.rateLimited ||
        String(code) === "307044" ||
        /307044/.test(String(resultOrError?.message || "")),
    );
  }

  async function flushCloudSaveQueue({ force = false } = {}) {
    if (cloudSavePromise) {
      if (force && pendingCloudSaves.size) {
        await saveLocalCloudBatch(takePendingCloudSaves());
      }
      await cloudSavePromise;
      if (pendingCloudSaves.size) return flushCloudSaveQueue({ force });
      return;
    }
    if (!pendingCloudSaves.size) return;
    if (isCloudSaveBackoffActive()) {
      return saveLocalCloudBatch(takePendingCloudSaves());
    }

    if (cloudSaveTimer) {
      window.clearTimeout(cloudSaveTimer);
      cloudSaveTimer = 0;
    }
    const batch = takePendingCloudSaves();
    if (!adapter().canUseToy()) return saveLocalCloudBatch(batch);

    cloudSavePromise = (async () => {
      // Persist locally before the remote request so progress is safe without any retry loop.
      await saveLocalCloudBatch(batch);
      try {
        const result = await adapter().saveCloud(batch);
        if (result?.storage === "cloud") {
          cloudSaveBackoffMs = 0;
          cloudSaveBackoffUntil = 0;
        } else if (isCloudSaveRateLimited(result)) {
          startCloudSaveBackoff();
        }
        return result;
      } catch (error) {
        console.warn("[Cloud] save failed", error);
        await saveLocalCloudBatch(batch);
        if (isCloudSaveRateLimited(error)) startCloudSaveBackoff();
        return { storage: "local", error };
      } finally {
        cloudSavePromise = null;
      }
    })();
    return cloudSavePromise;
  }

  function saveSettings() {
    if (settingsSaveTimer) {
      window.clearTimeout(settingsSaveTimer);
      settingsSaveTimer = 0;
    }
    queueSave(TOY_CONFIG.cloudKeys.settings, JSON.stringify(state.settings));
  }

  function scheduleSettingsSave() {
    if (settingsSaveTimer) window.clearTimeout(settingsSaveTimer);
    settingsSaveTimer = window.setTimeout(() => {
      settingsSaveTimer = 0;
      saveSettings();
    }, VOLUME_SAVE_DEBOUNCE_MS);
  }

  function flushPendingSettingsSave() {
    if (settingsSaveTimer) saveSettings();
  }

  function saveSelections() {
    queueSave(TOY_CONFIG.cloudKeys.selectedPlayer, state.selectedPlayerCat);
    queueSave(TOY_CONFIG.cloudKeys.selectedEnemy, state.selectedEnemyCat);
  }

  function queueCloudItems(items) {
    Object.entries(items).forEach(([key, value]) => queueSave(key, value));
  }

  function hasTargetVideoConfigured() {
    return Boolean(String(TOY_CONFIG.targetVideoBv || "").trim() || Number(TOY_CONFIG.targetVideoAid || 0));
  }

  function updateMenuCats() {
    const playerConfig = CAT_CONFIGS[state.selectedPlayerCat];
    const enemyConfig = CAT_CONFIGS[state.selectedEnemyCat];
    dom.menuPlayerCat.src = frameSrc(playerConfig, 1);
    dom.menuEnemyCat.src = frameSrc(enemyConfig, 1);
    dom.menuPlayerCat.style.setProperty("--cat-scale", String(playerConfig.spriteScale || 1));
    dom.menuEnemyCat.style.setProperty("--cat-scale", String(enemyConfig.spriteScale || 1));
    dom.menuPlayerCat.classList.toggle("is-flipped", shouldFlipForSide(playerConfig, "player"));
    dom.menuEnemyCat.classList.toggle("is-flipped", shouldFlipForSide(enemyConfig, "enemy"));
  }

  function updateCatCards() {
    dom.catTargetTabs.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.catTarget === state.catSelectTarget);
      button.setAttribute("aria-selected", String(button.dataset.catTarget === state.catSelectTarget));
    });

    dom.catCards.forEach((card) => {
      const catId = card.dataset.selectCat;
      const config = CAT_CONFIGS[catId];
      const selected =
        state.catSelectTarget === "player"
          ? state.selectedPlayerCat === catId
          : state.selectedEnemyCat === catId;
      card.classList.toggle("is-selected", selected);
      card.classList.toggle("is-locked", !isCatUnlocked(catId));
      if (config) {
        const image = card.querySelector("img");
        if (image) {
          image.src = frameSrc(config, 1);
          image.style.setProperty("--cat-scale", String(config.spriteScale || 1));
          image.style.setProperty(
            "--cat-card-flip",
            shouldFlipForSide(config, state.catSelectTarget) ? "-1" : "1",
          );
        }
        renderCatStats(card, config);
      }
    });
    const localRecordingMode = isLocalRecordingMode();
    const coinUnlockText = localRecordingMode
      ? "录制已解锁"
      : !hasTargetVideoConfigured()
      ? "视频待配置"
      : state.unlocks.coin
        ? "已解锁"
        : "投币解锁";
    dom.followCatStatus.textContent = localRecordingMode
      ? "录制已解锁"
      : state.unlocks.follow
        ? "已解锁"
        : "关注解锁";
    dom.coinCatStatus.textContent = coinUnlockText;
    dom.bananaCatStatus.textContent = coinUnlockText;
    updateMenuCats();
  }

  function updateUnlockUI(live = null) {
    if (isLocalRecordingMode()) {
      dom.followStatus.textContent = "本地录制模式：耄耋已解锁";
      dom.coinStatus.textContent = "本地录制模式：香蕉猫和丑橘已解锁";
      dom.unlockSummary.textContent = "本地录制模式：所有小猫已解锁，不影响 Toy 正式环境的关注和投币规则。";
      updateCatCards();
      return;
    }
    const toyAvailable = adapter().canUseToy();
    const hasVideoConfig = hasTargetVideoConfigured();
    dom.followStatus.textContent = state.unlocks.follow
      ? "已解锁耄耋"
      : live?.relationStatus === "error"
        ? "关注状态读取失败"
        : toyAvailable
          ? `未确认关注UP主 ${TOY_CONFIG.authorName}`
          : "本地未模拟关注";
    dom.coinStatus.textContent = hasVideoConfig && state.unlocks.coin
      ? "已解锁香蕉猫和丑橘"
      : !hasVideoConfig
        ? "目标视频待配置"
      : live?.videoStatus === "error"
        ? "视频互动读取失败"
        : toyAvailable
          ? "未确认投币/互动"
          : "本地未模拟互动";
    dom.unlockSummary.textContent = hasVideoConfig
      ? toyAvailable
        ? `关注UP主 ${TOY_CONFIG.authorName} 解锁耄耋；为目标视频投币后解锁香蕉猫和丑橘，返回页面会自动确认状态。`
        : "本地调试：点击下方按钮会模拟解锁，方便试玩。"
      : `关注UP主 ${TOY_CONFIG.authorName} 解锁耄耋；投币视频暂未配置，补链接后再启用香蕉猫和丑橘解锁。`;
    updateCatCards();
  }

  async function refreshUnlocks() {
    let live = null;
    try {
      live = await adapter().refreshUnlocks({
        authorMid: TOY_CONFIG.authorMid,
        videoBv: TOY_CONFIG.targetVideoBv,
        videoAid: TOY_CONFIG.targetVideoAid,
      });
    } catch (error) {
      console.warn("[Unlock] refresh failed", error);
    }
    const updates = {};
    if (live?.isFollowing && !state.unlocks.follow) {
      state.unlocks.follow = true;
      updates[TOY_CONFIG.cloudKeys.followUnlocked] = "1";
      showToast("耄耋已解锁");
    }
    if (false) { // [破解] 不再回收投币猫解锁状态
      state.unlocks.coin = false;
      updates[TOY_CONFIG.cloudKeys.coinUnlocked] = "0";
    } else if (hasTargetVideoConfigured() && live?.hasVideoInteract && !state.unlocks.coin) {
      state.unlocks.coin = true;
      updates[TOY_CONFIG.cloudKeys.coinUnlocked] = "1";
      showToast("香蕉猫和丑橘已解锁");
    }
    if (Object.keys(updates).length) queueCloudItems(updates);
    updateUnlockUI(live);
  }

  let unlockRefreshGeneration = 0;

  function retryUnlockRefresh() {
    const generation = ++unlockRefreshGeneration;
    [0, 1200, 3500, 8000].forEach((delay) => {
      window.setTimeout(() => {
        if (
          generation !== unlockRefreshGeneration ||
          document.hidden ||
          (state.unlocks.coin && state.unlocks.follow)
        )
          return;
        refreshUnlocks();
      }, delay);
    });
  }

  function makeFighter(side, catId, buffs = {}) {
    const baseConfig = CAT_CONFIGS[catId];
    const activeBuffs = normalizeBuffs(buffs);
    const config = applyBuffsToConfig(baseConfig, activeBuffs);
    return {
      side,
      catId,
      buffs: activeBuffs,
      config,
      hp: config.maxHp,
      rage: 0,
      action: "idle",
      frame: 1,
      actionUntil: 0,
      stunUntil: 0,
      cooldownUntil: 0,
      lastYowlTick: 0,
      lastHealTick: 0,
      defeated: false,
    };
  }

  function fighterElement(fighter) {
    return fighter.side === "player" ? dom.playerCat : dom.enemyCat;
  }

  function setFrame(fighter, frame) {
    fighter.frame = frame;
    const element = fighterElement(fighter);
    element.src = frameSrc(fighter.config, frame);
    element.style.setProperty("--cat-scale", String(fighter.config.spriteScale || 1));
    element.classList.toggle("is-flipped", shouldFlipForSide(fighter.config, fighter.side));
  }

  function setActingClass(fighter, acting) {
    fighterElement(fighter).classList.toggle("is-acting", acting);
  }

  function setHitClass(fighter, hit) {
    fighterElement(fighter).classList.toggle("is-hit", hit);
  }

  function clearContinuous(fighter) {
    fighter.lastYowlTick = 0;
    fighter.lastHealTick = 0;
  }

  function hideEnemyAttackWarning() {
    if (!dom.enemyAttackWarning) return;
    dom.enemyAttackWarning.hidden = true;
    dom.enemyAttackWarning.classList.remove("is-active");
  }

  function showEnemyAttackWarning() {
    if (!dom.enemyAttackWarning) return;
    dom.enemyAttackWarning.hidden = false;
    dom.enemyAttackWarning.classList.remove("is-active");
    dom.enemyAttackWarning.offsetHeight;
    dom.enemyAttackWarning.classList.add("is-active");
  }

  function cancelEnemyPendingAction({ reschedule = true } = {}) {
    if (!state.battle?.pendingEnemyAction) return;
    state.battle.pendingEnemyAction = null;
    hideEnemyAttackWarning();
    if (reschedule && state.battle.active && !state.battle.enemy.defeated) {
      state.battle.enemyNextAt = now() + BATTLE_CONFIG.enemyInterruptedRetryMs;
    }
  }

  function setIdle(fighter) {
    if (fighter.defeated) return;
    if (fighter.side === "enemy") cancelEnemyPendingAction();
    fighter.action = "idle";
    fighter.actionUntil = 0;
    clearContinuous(fighter);
    setFrame(fighter, 1);
    setActingClass(fighter, false);
    setHitClass(fighter, false);
  }

  function canAct(fighter, time = now()) {
    // [菜单] 冻结对方
    if (fighter.side === "enemy" && window.__JIMI_CHEATS?.freezeEnemy) return false;
    return (
      state.battle?.active &&
      !fighter.defeated &&
      fighter.hp > 0 &&
      time >= fighter.stunUntil &&
      time >= fighter.cooldownUntil
    );
  }

  function canAutoCounterHiss(fighter, time = now()) {
    return state.battle?.active && !fighter.defeated && fighter.hp > 0 && time >= fighter.stunUntil;
  }

  function counterHissChance(attacker) {
    return clamp(
      BATTLE_CONFIG.enemyCounterHissChance -
        attacker.rage * BATTLE_CONFIG.counterHissRageReductionPerPoint,
      0,
      BATTLE_CONFIG.enemyCounterHissChance,
    );
  }

  function isEnemyPendingScratch(target, time = now()) {
    const pending = state.battle?.pendingEnemyAction;
    return target.side === "enemy" && pending?.action === "scratch" && time < pending.executeAt;
  }

  function enemyAttackWarningChance() {
    const playerBonus = state.battle?.player?.config.dangerSenseChance || 0;
    return clamp(BATTLE_CONFIG.enemyAttackWarningChance + playerBonus, 0, 1);
  }

  function startCooldown(fighter, time = now()) {
    // [菜单] 无冷却：自己的行动 CD 清零
    const cdMs =
      fighter.side === "player" && window.__JIMI_CHEATS?.noCooldown
        ? 0
        : fighter.config.actionCooldown * 1000;
    fighter.cooldownUntil = time + cdMs;
  }

  function opponentOf(fighter) {
    return fighter.side === "player" ? state.battle.enemy : state.battle.player;
  }

  function nameOf(fighter) {
    return fighter.side === "player" ? "你的猫" : "对面的猫";
  }

  function startActionText(actor, action) {
    if (actor.side === "enemy") {
      return `对面的猫开始${ACTION_LABELS[action]}了`;
    }
    return `你的猫开始${ACTION_LABELS[action]}`;
  }

  function logBattle(text) {
    dom.battleLog.textContent = text;
  }

  function damagePosition(fighter) {
    return fighter.side === "player" ? { x: 200, y: 550 } : { x: 520, y: 550 };
  }

  function popInterrupt(target) {
    const pos = damagePosition(target);
    effects.popText("打断！", pos.x, pos.y - 118, "#c00000");
  }

  function addRage(fighter, amount, yOffset = 70) {
    if (!amount || fighter.defeated) return 0;
    const before = fighter.rage;
    fighter.rage = clamp(fighter.rage + amount, 0, fighter.config.rageMax);
    // [菜单] 怒气常满：自己每次涨怒直接拉满
    if (fighter.side === "player" && window.__JIMI_CHEATS?.rageFull) {
      fighter.rage = fighter.config.rageMax;
    }
    const gained = fighter.rage - before;
    if (gained > 0) {
      const pos = damagePosition(fighter);
      effects.popText(`怒气+${Math.round(gained)}`, pos.x, pos.y - yOffset, "#7057d2");
    }
    return gained;
  }

  function applyHit(target, damage, attacker) {
    const pos = damagePosition(target);
    const isStunned = now() < target.stunUntil;
    if (!isStunned && target.config.evasionChance && Math.random() < target.config.evasionChance) {
      effects.popText("闪避！", pos.x, pos.y - 92, "#2eb7ad");
      effects.burst(pos.x, pos.y + 40, "#2eb7ad", 8);
      addRage(target, target.config.rageOnAttacked || 0, 118);
      return { dodged: true, damage: 0 };
    }

    // [菜单] 无敌（自己受伤归零）/ 一击必杀 / 攻击×10（自己打对方时）
    const jimiCheats = window.__JIMI_CHEATS || {};
    if (target.side === "player" && jimiCheats.invincible) {
      effects.popText("无敌！", pos.x, pos.y - 92, "#ffb400");
      return { dodged: true, damage: 0 };
    }
    if (attacker.side === "player" && target.side === "enemy") {
      if (jimiCheats.oneHit) damage = Math.max(damage, target.hp);
      else if (jimiCheats.atkMul10) damage = damage * 10;
    }

    if (target.side === "enemy") cancelEnemyPendingAction();
    target.hp = clamp(target.hp - damage, 0, target.config.maxHp);
    effects.popText(`-${damage}`, pos.x, pos.y);
    effects.burst(pos.x, pos.y + 40, attacker.side === "player" ? "#ff9f3f" : "#f05d5e", 14);
    if (target.hp <= 0) {
      defeat(target);
      return { dodged: false, damage, defeated: true };
    }
    addRage(target, target.config.rageOnAttacked || 0, 118);
    if (target.config.hitSfx) audio.playSfx(target.config.hitSfx, rand(0.96, 1.04));
    target.action = "hit";
    target.actionUntil = now() + BATTLE_CONFIG.hitDurationMs;
    clearContinuous(target);
    setFrame(target, 7);
    setHitClass(target, true);
    return { dodged: false, damage, defeated: false };
  }

  function defeat(fighter) {
    if (fighter.side === "enemy") cancelEnemyPendingAction();
    fighter.defeated = true;
    fighter.action = "defeated";
    fighter.actionUntil = 0;
    setFrame(fighter, 6);
    fighterElement(fighter).classList.add("is-defeated");
    audio.playSfx(fighter.config.defeatSfx || "defaultDefeat", rand(0.96, 1.04));
    if (!state.battle.resultHandled) {
      window.setTimeout(() => endBattle(fighter.side === "enemy"), 650);
    }
  }

  function interruptTarget(actor, target, withStun) {
    const time = now();
    setIdle(target);
    popInterrupt(target);
    target.rage = 0;
    actor.cooldownUntil = time;
    if (withStun) {
      const stunMs = Math.max(0, BATTLE_CONFIG.stunDurationMs - (target.config.stunReductionMs || 0));
      target.stunUntil = time + stunMs;
      logBattle(`${nameOf(actor)}哈气打断${nameOf(target)}，僵住了！`);
    } else {
      logBattle(`${nameOf(actor)}哈气打断了${nameOf(target)}！`);
    }
    if (target.side === "enemy" && state.battle?.active) {
      state.battle.enemyNextAt = time + BATTLE_CONFIG.enemyInterruptedRetryMs;
    }
    if (actor.side === "enemy" && target.side === "player" && state.battle?.active) {
      state.battle.enemyImmediateActionPending = true;
      state.battle.enemyNextAt = time;
    }
    if (actor.config.hissInterruptRageGain) {
      addRage(actor, actor.config.hissInterruptRageGain, 92);
    }
    const pos = damagePosition(target);
    effects.burst(pos.x, pos.y, "#2eb7ad", 16);
  }

  function executeAction(actor, action, options = {}) {
    const time = now();
    // [菜单] 冻结对方：对方的任何行动都不执行
    if (actor.side === "enemy" && window.__JIMI_CHEATS?.freezeEnemy) return false;
    if (!canAct(actor, time) && !options.force) return false;
    const target = opponentOf(actor);
    startCooldown(actor, time);
    actor.action = action;
    actor.actionUntil = action === "yowl" || action === "chew" ? Number.POSITIVE_INFINITY : time + BATTLE_CONFIG.actionDurationMs;
    setActingClass(actor, true);
    setHitClass(actor, false);

    if (action === "hiss") {
      setFrame(actor, 2);
      audio.playSfx(actor.config.hissSfx || "hiss");
      if (target.action === "scratch" || isEnemyPendingScratch(target, time)) {
        interruptTarget(actor, target, true);
      } else if (["yowl", "chew"].includes(target.action)) {
        if (Math.random() < BATTLE_CONFIG.hissInterruptChance) {
          interruptTarget(actor, target, true);
        } else {
          logBattle(`${nameOf(actor)}哈气了，但${nameOf(target)}稳住了`);
        }
      } else {
        logBattle(`${nameOf(actor)}哈气示威`);
      }
      return true;
    }

    if (action === "scratch") {
      setFrame(actor, 3);
      audio.playSfx(actor.config.attackSfx || "orangeScratch", rand(0.96, 1.06));
      const bonus = Math.floor(actor.rage / BATTLE_CONFIG.rageDamageStep) * BATTLE_CONFIG.rageDamageBonus;
      const damage = actor.config.baseAttack + bonus;
      const hit = applyHit(target, damage, actor);
      logBattle(hit?.dodged ? `${nameOf(target)}闪避了抓挠！` : `${nameOf(actor)}抓挠造成 ${damage} 点伤害`);
      return true;
    }

    if (action === "yowl") {
      setFrame(actor, 4);
      actor.lastYowlTick = time;
      actor.lastHealTick = 0;
      audio.playSfx(actor.config.yowlSfx || "yowl", rand(0.95, 1.05));
      logBattle(`${startActionText(actor, "yowl")}，怒气上来了`);
      return true;
    }

    if (action === "chew") {
      setFrame(actor, 5);
      actor.lastHealTick = time;
      actor.lastYowlTick = 0;
      audio.playSfx("chew", rand(0.96, 1.04));
      logBattle(startActionText(actor, "chew"));
      return true;
    }

    return false;
  }

  function tryPlayerAction(action) {
    const battle = state.battle;
    if (!battle?.active) return;
    const player = battle.player;
    const enemy = battle.enemy;
    const time = now();
    if (!canAct(player, time)) {
      if (time < player.stunUntil) logBattle("你的小猫僵直中，还不能行动");
      else logBattle("行动冷却中");
      return;
    }

    const enemyCannotCounter = ["yowl", "chew"].includes(enemy.action);
    if (
      action === "scratch" &&
      !enemyCannotCounter &&
      canAutoCounterHiss(enemy, time) &&
      Math.random() < counterHissChance(player)
    ) {
      startCooldown(player, time);
      player.action = "scratch";
      player.actionUntil = time + BATTLE_CONFIG.actionDurationMs;
      setFrame(player, 3);
      setActingClass(player, true);
      executeAction(enemy, "hiss", { force: true });
      scheduleEnemyAction(battle.enemyImmediateActionPending ? 0 : undefined);
      updateActionButtons();
      return;
    }

    executeAction(player, action);
    updateActionButtons();
  }

  function enemyCanUseAction(enemy, action) {
    if (action === "yowl") return enemy.rage < enemy.config.rageMax;
    if (action === "chew") return enemy.hp < enemy.config.maxHp;
    return true;
  }

  function chooseEnemyAction({ immediateFollowUp = false } = {}) {
    const { player, enemy } = state.battle;
    if (!immediateFollowUp && ["yowl", "chew"].includes(player.action)) {
      const mimicAction = player.action;
      if (
        enemyCanUseAction(enemy, mimicAction) &&
        Math.random() < BATTLE_CONFIG.enemyMimicChance
      ) {
        return mimicAction;
      }
      return "scratch";
    }

    const actions = immediateFollowUp ? ["scratch"] : ["hiss", "scratch"];
    if (enemyCanUseAction(enemy, "yowl")) actions.push("yowl");
    if (enemyCanUseAction(enemy, "chew")) actions.push("chew");
    return actions[Math.floor(Math.random() * actions.length)];
  }

  function queueEnemyAttackWarning(time = now()) {
    if (!state.battle) return false;
    state.battle.pendingEnemyAction = {
      action: "scratch",
      executeAt: time + BATTLE_CONFIG.enemyAttackWarningMs,
    };
    state.battle.enemyNextAt = Number.POSITIVE_INFINITY;
    showEnemyAttackWarning();
    logBattle("危险预知！对面的猫要抓挠了");
    return true;
  }

  function startEnemyAction(action, { skipAttackWarning = false } = {}) {
    const battle = state.battle;
    if (!battle?.active) return;
    if (action === "scratch" && !skipAttackWarning && Math.random() < enemyAttackWarningChance()) {
      queueEnemyAttackWarning();
      return;
    }
    if (executeAction(battle.enemy, action)) {
      scheduleEnemyAction(battle.enemyImmediateActionPending ? 0 : undefined);
    } else {
      scheduleEnemyAction(260);
    }
  }

  function updateEnemyPendingAction(time) {
    const battle = state.battle;
    const pending = battle?.pendingEnemyAction;
    if (!pending) return;
    if (!battle.active || battle.enemy.defeated) {
      cancelEnemyPendingAction();
      return;
    }
    if (time < pending.executeAt) return;

    const action = pending.action;
    battle.pendingEnemyAction = null;
    hideEnemyAttackWarning();
    if (canAct(battle.enemy, time)) {
      executeAction(battle.enemy, action);
      scheduleEnemyAction();
    } else {
      scheduleEnemyAction(260);
    }
  }

  function scheduleEnemyAction(delay = rand(BATTLE_CONFIG.enemyDecisionMinMs, BATTLE_CONFIG.enemyDecisionMaxMs)) {
    if (!state.battle) return;
    state.battle.enemyNextAt = now() + delay;
  }

  function updateContinuousAction(fighter, time) {
    // [菜单] 冻结对方：打断对方进行中的持续行动
    if (fighter.side === "enemy" && window.__JIMI_CHEATS?.freezeEnemy) {
      setIdle(fighter);
      return;
    }
    if (
      fighter.side === "enemy" &&
      fighter.action === "yowl" &&
      fighter.rage >= fighter.config.rageMax
    ) {
      setIdle(fighter);
      return;
    }
    if (fighter.action === "yowl" && time - fighter.lastYowlTick >= BATTLE_CONFIG.yowlTickMs) {
      fighter.lastYowlTick += BATTLE_CONFIG.yowlTickMs;
      const rageGain = fighter.config.yowlRageGain ?? 5;
      addRage(fighter, rageGain, 70);
      if (fighter.side === "enemy" && fighter.rage >= fighter.config.rageMax) {
        setIdle(fighter);
        return;
      }
    }
    if (fighter.action === "chew" && time - fighter.lastHealTick >= BATTLE_CONFIG.healTickMs) {
      fighter.lastHealTick += BATTLE_CONFIG.healTickMs;
      const before = fighter.hp;
      fighter.hp = clamp(fighter.hp + fighter.config.healAmount, 0, fighter.config.maxHp);
      if (fighter.hp !== before) {
        const pos = damagePosition(fighter);
        effects.popText(`+${fighter.hp - before}`, pos.x, pos.y - 70, "#2eb7ad");
        audio.playSfx("chew", rand(0.98, 1.04));
      }
      if (fighter.side === "enemy" && fighter.hp >= fighter.config.maxHp) {
        setIdle(fighter);
      }
    }
  }

  function finishTemporaryAction(fighter, time) {
    if (Number.isFinite(fighter.actionUntil) && fighter.actionUntil > 0 && time >= fighter.actionUntil) {
      if (fighter.action === "hit" || fighter.action === "hiss" || fighter.action === "scratch") {
        setIdle(fighter);
      }
    }
    if (time < fighter.stunUntil) {
      setFrame(fighter, 1);
      setActingClass(fighter, false);
    }
  }

  function updateHud() {
    const battle = state.battle;
    if (!battle) return;
    const playerHpRatio = clamp(battle.player.hp / battle.player.config.maxHp, 0, 1);
    const enemyHpRatio = clamp(battle.enemy.hp / battle.enemy.config.maxHp, 0, 1);
    dom.playerHpBar.style.transform = `scaleX(${playerHpRatio})`;
    dom.enemyHpBar.style.transform = `scaleX(${enemyHpRatio})`;
    dom.playerNameText.textContent = `你的${battle.player.config.name}`;
    dom.enemyNameText.textContent = `挑战${battle.enemy.config.name}`;
    dom.playerHpText.textContent = `${Math.ceil(battle.player.hp)}/${battle.player.config.maxHp}`;
    dom.enemyHpText.textContent = `${Math.ceil(battle.enemy.hp)}/${battle.enemy.config.maxHp}`;
    dom.playerRageText.textContent = rageLabel(battle.player);
    dom.enemyRageText.textContent = rageLabel(battle.enemy);
  }

  function rageLabel(fighter) {
    const time = now();
    if (time < fighter.stunUntil) return `僵直 ${(Math.ceil((fighter.stunUntil - time) / 100) / 10).toFixed(1)}s`;
    return `怒气 ${Math.round(fighter.rage)}`;
  }

  function updateActionButtons() {
    const battle = state.battle;
    if (!battle?.active) {
      dom.actionButtons.forEach((button) => {
        button.disabled = true;
      });
      dom.cooldownRing.classList.remove("is-active");
      return;
    }
    const time = now();
    const disabled = !canAct(battle.player, time);
    dom.actionButtons.forEach((button) => {
      button.disabled = disabled;
    });
    dom.cooldownRing.classList.toggle("is-active", disabled && time < battle.player.cooldownUntil);
  }

  function updateBattle(dt) {
    const battle = state.battle;
    if (!battle?.active) return;
    const time = now();
    for (const fighter of [battle.player, battle.enemy]) {
      if (fighter.defeated) continue;
      updateContinuousAction(fighter, time);
      finishTemporaryAction(fighter, time);
    }

    updateEnemyPendingAction(time);

    if (!battle.pendingEnemyAction && time >= battle.enemyNextAt) {
      if (canAct(battle.enemy, time)) {
        const immediateFollowUp = battle.enemyImmediateActionPending;
        battle.enemyImmediateActionPending = false;
        startEnemyAction(chooseEnemyAction({ immediateFollowUp }), {
          skipAttackWarning: immediateFollowUp,
        });
      } else {
        scheduleEnemyAction(260);
      }
    }

    updateHud();
    updateActionButtons();
  }

  function startBattle() {
    dom.playerCat.className = "cat-sprite is-player";
    dom.enemyCat.className = "cat-sprite is-enemy";
    const player = makeFighter("player", state.selectedPlayerCat, state.runBuffs);
    const enemy = makeFighter(
      "enemy",
      state.selectedEnemyCat,
      randomBuffs(totalBuffCount(state.runBuffs), { combatOnly: true }),
    );
    state.battle = {
      active: true,
      startedAt: now(),
      enemyNextAt: 0,
      pendingEnemyAction: null,
      enemyImmediateActionPending: false,
      resultHandled: false,
      player,
      enemy,
    };
    hideEnemyAttackWarning();
    setFrame(player, 1);
    setFrame(enemy, 1);
    if (BATTLE_CONFIG.backgroundImage) {
      dom.screens.battle.classList.add("has-custom-bg");
      dom.screens.battle.style.backgroundImage = `url("${BATTLE_CONFIG.backgroundImage}")`;
    } else {
      dom.screens.battle.classList.remove("has-custom-bg");
      dom.screens.battle.style.backgroundImage = "";
    }
    logBattle("战斗开始，选择动作！");
    updateHud();
    updateActionButtons();
    showScreen("battle");
    scheduleEnemyAction();
  }

  function streakMultiplier(streak) {
    const winsAfterFirst = Math.max(0, streak - 1);
    return 1 + winsAfterFirst * BATTLE_CONFIG.winStreakBonusPerWin;
  }

  function calculateScore(victory, streakAfterWin = state.winStreak) {
    if (!victory || !state.battle) return 0;
    const hp = Math.max(0, Math.ceil(state.battle.player.hp));
    const defeatedBase = state.battle.enemy.config.defeatScoreBase ?? 0;
    const playerBaseBonus = state.battle.player.config.scoreBaseBonus || 0;
    const rawScore = (defeatedBase + playerBaseBonus + hp * BATTLE_CONFIG.hpScoreMultiplier) * streakMultiplier(streakAfterWin);
    return Math.max(1, Math.round(rawScore));
  }

  function renderBuffChoices(score) {
    const options = randomBuffOptions(3);
    state.pendingVictoryScore = score;
    dom.buffSummary.textContent = `本次得分 ${score} · 当前 ${state.winStreak} 连胜。选择一个增益后返回主菜单。`;
    dom.buffChoices.replaceChildren();
    options.forEach((buff) => {
      const button = document.createElement("button");
      button.className = "buff-choice";
      button.type = "button";
      button.dataset.buffId = buff.id;
      const title = document.createElement("strong");
      const count = document.createElement("span");
      title.textContent = buff.text;
      count.textContent = state.runBuffs[buff.id]
        ? `当前效果 ${buffLabel(buff.id, state.runBuffs[buff.id])}`
        : "当前未获得";
      button.append(title, count);
      dom.buffChoices.appendChild(button);
    });
    showScreen("buff");
  }

  function chooseBuff(buffId) {
    if (!BUFF_POOL.some((buff) => buff.id === buffId)) return;
    state.runBuffs = addBuffToSet(state.runBuffs, buffId);
    state.pendingVictoryScore = 0;
    saveRunState({
      [TOY_CONFIG.cloudKeys.runBuffs]: JSON.stringify(state.runBuffs),
    });
    updateRunStatus();
    showToast(`已获得：${buffLabel(buffId, state.runBuffs[buffId])}`);
    showScreen("menu");
  }

  async function submitResultScore(score) {
    if (!score) {
      dom.resultRank.textContent = "失败不提交排行榜";
      return;
    }
    dom.resultRank.textContent = "正在提交排行榜...";
    try {
      await adapter().submitScore({ board: TOY_CONFIG.scoreBoard, score });
      const mine = await adapter().loadMyRank({ board: TOY_CONFIG.scoreBoard, period: "all" });
      if (mine?.ranked) {
        dom.resultRank.textContent = `我的总榜排名 ${mine.rank} · ${mine.score} 分`;
      } else {
        dom.resultRank.textContent = "成绩已提交，暂未上榜";
      }
    } catch (error) {
      console.warn("[Rank] submit failed", error);
      dom.resultRank.textContent = "排行榜暂不可用，本地成绩已保留";
    }
  }

  function endBattle(victory) {
    const battle = state.battle;
    if (!battle || battle.resultHandled) return;
    battle.resultHandled = true;
    battle.active = false;
    battle.pendingEnemyAction = null;
    hideEnemyAttackWarning();
    let score = 0;
    if (victory) {
      state.winStreak += 1;
      score = calculateScore(victory, state.winStreak);
      dom.resultTitle.textContent = "胜利！";
      dom.resultScore.textContent = `本次得分 ${score} · 当前 ${state.winStreak} 连胜`;
      const bestScoreChanged = score > state.bestScore;
      const bestWinStreakChanged = state.winStreak > state.bestWinStreak;
      if (bestScoreChanged) state.bestScore = score;
      if (bestWinStreakChanged) state.bestWinStreak = state.winStreak;
      const changed = {
        [TOY_CONFIG.cloudKeys.winStreak]: String(state.winStreak),
      };
      if (bestScoreChanged) changed[TOY_CONFIG.cloudKeys.bestScore] = String(state.bestScore);
      if (bestWinStreakChanged) {
        changed[TOY_CONFIG.cloudKeys.bestWinStreak] = String(state.bestWinStreak);
      }
      saveRunState(changed);
      updateLocalRecordText();
      updateActionButtons();
      submitResultScore(score);
      renderBuffChoices(score);
      return;
    } else {
      resetRunProgress();
      dom.resultTitle.textContent = "败北了";
      dom.resultScore.textContent = "本次得分 0 · 连胜和增益已清零";
    }
    updateActionButtons();
    showScreen("result");
    submitResultScore(score);
  }

  async function loadRank(period = state.rankPeriod) {
    state.rankPeriod = period;
    updateLocalRecordText();
    dom.rankTabs.querySelectorAll("button").forEach((button) => {
      const active = button.dataset.period === period;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    dom.myRankText.textContent = "我的排名加载中";
    dom.rankList.replaceChildren();
    try {
      const rank = await adapter().loadRank({ board: TOY_CONFIG.scoreBoard, period, limit: 50 });
      if (rank.mine?.ranked) {
        dom.myRankText.textContent = `我的排名 ${rank.mine.rank} · ${rank.mine.score} 分`;
      } else {
        dom.myRankText.textContent = `当前周期暂未上榜 · 最高 ${state.bestScore} 分`;
      }
      const entries = Array.isArray(rank.entries) ? rank.entries : [];
      if (!entries.length) {
        const empty = document.createElement("li");
        empty.className = "empty-rank";
        empty.textContent = rank.local ? "本地还没有成绩，先赢一局吧" : "还没有人上榜";
        dom.rankList.appendChild(empty);
        return;
      }
      entries.forEach((entry) => {
        const item = document.createElement("li");
        const place = document.createElement("strong");
        const name = document.createElement("span");
        const score = document.createElement("span");
        place.textContent = `#${entry.rank || "-"}`;
        name.className = "rank-name";
        name.textContent = entry.nickname || "B站用户";
        score.className = "rank-score";
        score.textContent = String(entry.score ?? 0);
        item.append(place, name, score);
        dom.rankList.appendChild(item);
      });
    } catch (error) {
      console.warn("[Rank] load failed", error);
      dom.myRankText.textContent = "排行榜读取失败，请稍后再试";
      const empty = document.createElement("li");
      empty.className = "empty-rank";
      empty.textContent = "排行榜暂不可用";
      dom.rankList.appendChild(empty);
    }
  }

  function bindEvents() {
    document.addEventListener(
      "click",
      () => {
        audio.unlock();
      },
      { once: true },
    );

    dom.screens.menu.addEventListener("click", (event) => {
      if (event.target.closest("button")) {
        audio.unlock().then(() => audio.playSfx("menuClick"));
      }
    });

    $("openCatsButton").addEventListener("click", () => {
      showScreen("cats");
      updateCatCards();
    });
    $("startBattleButton").addEventListener("click", startBattle);
    $("openSettingsButton").addEventListener("click", () => showScreen("settings"));
    $("openRankButton").addEventListener("click", () => {
      showScreen("rank");
      loadRank(state.rankPeriod);
    });
    $("openUnlockButton").addEventListener("click", () => {
      showScreen("unlock");
      refreshUnlocks();
    });
    $("openRulesButton").addEventListener("click", () => {
      showScreen("rules");
    });
    $("battleBackButton").addEventListener("click", () => {
      if (state.battle) state.battle.active = false;
      showScreen("menu");
      updateActionButtons();
    });
    $("retryButton").addEventListener("click", startBattle);
    $("resultMenuButton").addEventListener("click", () => showScreen("menu"));

    document.querySelectorAll(".js-back-menu").forEach((button) => {
      button.addEventListener("click", () => {
        showScreen("menu");
      });
    });

    dom.actionButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        tryPlayerAction(button.dataset.action);
      });
    });

    dom.catTargetTabs.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-cat-target]");
      if (!button) return;
      state.catSelectTarget = button.dataset.catTarget;
      updateCatCards();
    });

    dom.catCards.forEach((card) => {
      card.addEventListener("click", () => {
        const catId = card.dataset.selectCat;
        if (!isCatUnlocked(catId)) {
          showScreen("unlock");
          refreshUnlocks();
          return;
        }
        if (state.catSelectTarget === "player") state.selectedPlayerCat = catId;
        else state.selectedEnemyCat = catId;
        updateCatCards();
        saveSelections();
      });
    });

    const updateVolumePreview = () => {
      audio.setVolumes(Number(dom.musicVolume.value), Number(dom.sfxVolume.value));
      scheduleSettingsSave();
    };
    dom.musicVolume.addEventListener("input", updateVolumePreview);
    dom.sfxVolume.addEventListener("input", updateVolumePreview);

    dom.rankTabs.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-period]");
      if (button) loadRank(button.dataset.period);
    });

    dom.buffChoices.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-buff-id]");
      if (!button) return;
      chooseBuff(button.dataset.buffId);
    });

    $("followButton").addEventListener("click", async () => {
      if (!adapter().canUseToy()) {
        adapter().setDebugUnlock("follow", true);
        await refreshUnlocks();
        return;
      }
      await adapter().openAuthorSpace({ authorMid: TOY_CONFIG.authorMid });
    });

    $("coinButton").addEventListener("click", async () => {
      if (!hasTargetVideoConfigured()) {
        dom.coinStatus.textContent = "目标视频待配置，暂不能投币解锁";
        return;
      }
      if (!adapter().canUseToy()) {
        adapter().setDebugUnlock("coin", true);
        await refreshUnlocks();
        return;
      }
      try {
        await adapter().openTargetVideo({
          videoBv: TOY_CONFIG.targetVideoBv,
          videoAid: TOY_CONFIG.targetVideoAid,
        });
      } catch (error) {
        console.warn("[Unlock] target video unavailable", error);
        dom.coinStatus.textContent = "目标视频暂不可用，请稍后再试";
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        flushPendingSettingsSave();
        void flushCloudSaveQueue({ force: true });
      } else {
        retryUnlockRefresh();
      }
      if (document.hidden && state.screen === "battle" && state.battle?.active) {
        logBattle("页面离开，战斗已暂停在当前状态");
      }
    });
    window.addEventListener("beforeunload", () => {
      flushPendingSettingsSave();
      void flushCloudSaveQueue({ force: true });
    });
    window.addEventListener("focus", retryUnlockRefresh);
    window.addEventListener("pageshow", retryUnlockRefresh);
  }

  function tick(time) {
    const dt = Math.min(0.033, Math.max(0.001, (time - state.lastFrame) / 1000 || 0.016));
    state.lastFrame = time;
    updateBattle(dt);
    effects.update(dt);
    requestAnimationFrame(tick);
  }

  async function loadSavedState() {
    const keys = TOY_CONFIG.cloudKeys;
    const data = await adapter().loadCloud(Object.values(keys));
    state.settings = parseSettings(data[keys.settings]);
    state.unlocks.follow = true; // [破解]
    state.unlocks.coin = true; // [破解]
    if (!hasTargetVideoConfigured() && data[keys.coinUnlocked] === "1") {
      queueSave(keys.coinUnlocked, "0");
    }
    state.selectedPlayerCat = CAT_CONFIGS[data[keys.selectedPlayer]] ? data[keys.selectedPlayer] : "orange";
    state.selectedEnemyCat = CAT_CONFIGS[data[keys.selectedEnemy]] ? data[keys.selectedEnemy] : "tabby";
    if (!isCatUnlocked(state.selectedPlayerCat)) state.selectedPlayerCat = "orange";
    if (!isCatUnlocked(state.selectedEnemyCat)) state.selectedEnemyCat = "tabby";
    state.winStreak = Number(data[keys.winStreak] || "0") || 0;
    state.bestScore = Number(data[keys.bestScore] || "0") || 0;
    state.bestWinStreak = Math.max(
      Number(data[keys.bestWinStreak] || "0") || 0,
      state.winStreak,
    );
    state.runBuffs = normalizeBuffs(safeParseJson(data[keys.runBuffs], {}));
    dom.musicVolume.value = String(state.settings.musicVolume);
    dom.sfxVolume.value = String(state.settings.sfxVolume);
    audio.setVolumes(state.settings.musicVolume, state.settings.sfxVolume);
    updateCatCards();
    updateRunStatus();
    updateLocalRecordText();
  }

  async function init() {
    try {
      audio = new AudioManager(AUDIO_FILES);
      effects = new Effects(dom.fxCanvas, dom.stage);
      bindEvents();
      await preloadImages();
      dom.loadingText.textContent = "正在准备音频...";
      audio.preload().catch((error) => console.warn("[Audio] preload disabled", error));
      dom.loadingText.textContent = "正在读取存档...";
      await loadSavedState();
      await refreshUnlocks();
      dom.app.classList.remove("is-loading");
      showScreen("menu");
      dom.menuStatus.textContent = adapter().canUseToy() ? "Toy 环境已连接" : "本地试玩准备好了";
      if (dom.bootGuard) dom.bootGuard.classList.add("is-hidden");
      window.__JIMIDOU_READY__ = true;
      requestAnimationFrame(tick);
    } catch (error) {
      showCompatibilityError(error);
    }
  }

  try {
    init().catch(showCompatibilityError);
  } catch (error) {
    showCompatibilityError(error);
  }
})();
