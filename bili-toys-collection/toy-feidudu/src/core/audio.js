'use strict';

/* 音效:
 * - 行驶嗡鸣(循环): 电驴/跑车 中频, 火车头 低频 (Web Audio 缓冲无缝循环)
 * - 脚步: 步行/牛来移动
 * - 背景音乐: 普通=背景音乐.mp3, 火车头=火车头.mp3 (0.2 音量, 循环)
 * - 台词/撞击音: assets/音效 下的 mp3
 * - 其余事件(拾取/回血/投掷等): Web Audio 合成
 */

const SFX = (() => {
  const BASE = 'assets/音效/';
  /* lazy = true: 不预加载, 等首次用户交互(unlock)后再拉取;
   * 大文件(火车头 BGM 1.3MB、台词)延迟加载, 避免开局和贴图抢带宽 */
  const mk = (file, vol, loop, lazy) => {
    const a = new Audio(BASE + file);
    a.preload = lazy ? 'none' : 'auto';
    if (vol != null) a.volume = vol;
    if (loop) a.loop = true;
    return a;
  };

  const hitSnd = mk('撞击音效.mp3', 0.55); // 撞击(小, 立即加载)
  const footSnd = mk('脚步.mp3', 0.45); // 脚步
  const bgmNormal = mk('背景音乐.mp3', 0.12, true); // 背景音乐
  const bgmTrain = mk('火车头.mp3', 0.12, true, true); // 火车头背景音乐(1.3MB, 延迟)
  /* 台词/特殊音 */
  const voiceEls = {
    brave: mk('我超勇的.mp3', 1, false, true), // 我超勇的
    melon: mk('我开水果摊的能卖给你生瓜蛋子.mp3', 1, false, true), // 水果摊
    eat: mk('焖子.mp3', 1, false, true), // 焖子
    soup: mk('鸡汤来咯.mp3', 1, false, true), // 鸡汤来咯
    weak: mk('弱欸.mp3', 1, false, true), // 勇猛撞敌
    seed: mk('生瓜蛋子.mp3', 1, false, true), // 丢西瓜
    salang: mk('撒日朗.mp3', 1, false, true), // 刘华强西瓜刀命中
    guashu: mk('这瓜保熟吗.mp3', 1, false, true), // 刘华强: 交付西瓜时
  };
  /* 行驶嗡鸣(回退 <audio>) */
  const driveUrl = { mid: BASE + '汽车行驶-中频嗡鸣.mp3', low: BASE + '汽车行驶-低频嗡鸣.mp3' };
  const driveEl = { mid: mk('汽车行驶-中频嗡鸣.mp3', 0.4, true), low: mk('汽车行驶-低频嗡鸣.mp3', 0.4, true) };

  const driveBuf = { mid: null, low: null };
  let driveSrc = null;
  let driveGain = null;
  let driveWhich = null;
  let useBuffer = true;
  let buffersRequested = false;
  let bgmCurrent = null;
  let unlockedOnce = false; // 首次交互只做一次解锁+预加载

  let lastHit = 0;
  let enabled = true;
  let actx = null;
  let master = null;
  let volLevel = 1; // 总音量 0~1

  /* ---- Web Audio 基础 ---- */
  function ensure() {
    if (actx) return actx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      enabled = false;
      return null;
    }
    actx = new AC();
    master = actx.createGain();
    master.gain.value = 0.32;
    master.connect(actx.destination);
    return actx;
  }
  function resume() {
    if (actx && actx.state === 'suspended') actx.resume();
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }
  const synth = {
    pickup: () => tone(880, 0.1, 'square', 0.22, 1320),
    heal: () => {
      tone(660, 0.1, 'sine', 0.28, 990);
      tone(990, 0.14, 'sine', 0.22, 1320, 0.09);
    },
    hurt: () => tone(200, 0.18, 'sawtooth', 0.3, 70),
    shoot: () => tone(1300, 0.05, 'square', 0.14, 700),
    throw: () => tone(500, 0.08, 'triangle', 0.2, 200),
    death: () => tone(420, 0.5, 'sawtooth', 0.32, 60),
    poison: () => tone(300, 0.2, 'square', 0.28, 150),
    start: () => {
      tone(440, 0.1, 'square', 0.28);
      tone(660, 0.16, 'square', 0.28, 0, 0.1);
    },
  };

  /* 播放一次音频元素(可指定音量/音调) */
  function playEl(a, vol, rate) {
    if (!a) return;
    resume();
    if (vol != null) a.volume = vol;
    a.playbackRate = rate || 1;
    try {
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch (_) {}
  }

  /* 脚步(每迈一步) */
  function step() {
    playEl(footSnd, null, 1);
  }
  /* 台词/特殊音: name ∈ brave/melon/eat/soup/weak/seed */
  function voice(name, vol, rate) {
    const a = voiceEls[name];
    if (!a) return;
    playEl(a, (vol != null ? vol : 1) * volLevel, rate);
  }

  /* 总音量 0~1 */
  function setVolume(v) {
    volLevel = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = 0.32 * volLevel;
    hitSnd.volume = 0.55 * volLevel;
    footSnd.volume = 0.45 * volLevel;
    bgmNormal.volume = 0.12 * volLevel;
    bgmTrain.volume = 0.12 * volLevel;
    for (const k in voiceEls) voiceEls[k].volume = volLevel;
    for (const k in driveEl) driveEl[k].volume = 0.4 * volLevel;
    if (driveGain) driveGain.gain.value = 0.4 * volLevel;
  }
  function getVolume() {
    return volLevel;
  }

  /* ---- 背景音乐 ---- */
  function bgm(vehicle, active) {
    const want = vehicle === 'train' ? bgmTrain : bgmNormal;
    if (bgmCurrent !== want) {
      if (bgmCurrent) bgmCurrent.pause();
      bgmCurrent = want;
    }
    if (!active) {
      if (bgmCurrent && !bgmCurrent.paused) bgmCurrent.pause();
      return;
    }
    bgmCurrent.muted = false; // 防止被解锁流程留在静音
    if (bgmCurrent.paused) bgmCurrent.play().catch(() => {});
  }

  /* ---- 行驶嗡鸣缓冲加载 ---- */
  function loadDriveBuffers() {
    if (buffersRequested) return;
    buffersRequested = true;
    /* file:// 下 fetch 会被 CORS 拦截 → 直接用 <audio> 回退(避免报错) */
    const http = location.protocol === 'http:' || location.protocol === 'https:';
    if (!http) {
      useBuffer = false;
      return;
    }
    const c = ensure();
    if (!c) return;
    for (const k in driveUrl) {
      fetch(driveUrl[k])
        .then((r) => r.arrayBuffer())
        .then((ab) => c.decodeAudioData(ab))
        .then((b) => {
          driveBuf[k] = b;
        })
        .catch(() => {
          useBuffer = false;
        });
    }
  }
  function stopDriveBuf() {
    if (driveSrc) {
      try {
        driveSrc.stop();
      } catch (_) {}
      driveSrc = null;
    }
    driveWhich = null;
  }
  function stopDriveEl() {
    for (const k in driveEl) if (!driveEl[k].paused) driveEl[k].pause();
  }

  /* ---- 载具行驶嗡鸣 ---- */
  function drive(vehicle, speed, active) {
    /* 步行/牛来: 用脚步声, 不放嗡鸣 */
    if (vehicle === 'walk' || vehicle === 'cow') {
      stopDriveBuf();
      stopDriveEl();
      return;
    }
    const which = vehicle === 'rider' || vehicle === 'car' ? 'mid' : 'low';
    const rate = Math.min(1.8, Math.max(0.7, speed / 300));
    if (useBuffer && driveBuf[which]) {
      if (!active) {
        stopDriveBuf();
        return;
      }
      if (driveWhich !== which) {
        stopDriveBuf();
        stopDriveEl();
        const c = ensure();
        driveSrc = c.createBufferSource();
        driveSrc.buffer = driveBuf[which];
        driveSrc.loop = true;
        driveGain = c.createGain();
        driveGain.gain.value = 0.4;
        driveSrc.connect(driveGain);
        driveGain.connect(master);
        driveSrc.start();
        driveWhich = which;
      }
      driveSrc.playbackRate.value = rate;
      return;
    }
    /* 回退: <audio> */
    const el = driveEl[which];
    const other = driveEl[which === 'mid' ? 'low' : 'mid'];
    if (!other.paused) other.pause();
    if (!active) {
      if (!el.paused) el.pause();
      return;
    }
    el.playbackRate = rate;
    if (el.paused) el.play().catch(() => {});
  }

  function play(name) {
    if (!enabled) return;
    if (name === 'boom') {
      const now = performance.now();
      if (now - lastHit < 80) return;
      lastHit = now;
      playEl(hitSnd, null, 1);
      return;
    }
    resume();
    const fn = synth[name];
    if (fn) fn();
  }

  /* 用户交互时调用, 解锁音频 */
  function unlock() {
    ensure();
    resume();
    if (unlockedOnce) return; // 只需解锁一次
    unlockedOnce = true;
    loadDriveBuffers();
    const all = [hitSnd, footSnd, bgmNormal, bgmTrain];
    for (const k in voiceEls) all.push(voiceEls[k]);
    for (const a of all) {
      /* 延迟加载的元素在此刻(贴图已就绪)才真正开始拉取 */
      if (a.preload === 'none') a.load();
      if (a.paused) {
        a.muted = true;
        a.play()
          .then(() => {
            a.pause();
            a.currentTime = 0;
            a.muted = false;
          })
          .catch(() => {
            a.muted = false;
          });
      }
    }
  }

  return { play, drive, bgm, step, voice, unlock, setVolume, getVolume };
})();
