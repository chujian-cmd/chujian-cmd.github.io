const fallbackGames = [
  {
    id: "hot-meme-runner",
    title: "热梗大逃亡",
    category: "跑酷",
    cover: "./assets/huoshan-avatar.jpg",
    cover43: "",
    description: "把弹幕热梗做成横版跑酷，躲开名场面障碍，收集整活能量冲到终点。",
    tags: ["热梗", "跑酷", "整活"],
    recommendation: 0,
    supportsCloudSave: false,
    isTestGame: false,
    testPassword: "",
    toyId: "",
    videoId: ""
  },
  {
    id: "famous-scene-kitchen",
    title: "名场面厨房",
    category: "模拟",
    cover: "./assets/luckywheel-cover.jpg",
    cover43: "",
    description: "在限时厨房里还原离谱名场面，配料越抽象，节目效果越爆炸。",
    tags: ["模拟", "名场面", "反应力"],
    recommendation: 0,
    supportsCloudSave: false,
    isTestGame: false,
    testPassword: "",
    toyId: "",
    videoId: ""
  },
  {
    id: "comment-war",
    title: "弹幕保卫战",
    category: "塔防",
    cover: "./assets/king-cover.jpg",
    cover43: "",
    description: "用脑洞炮台守住屏幕，挡住一波又一波弹幕梗，守到最后就是胜利。",
    tags: ["塔防", "弹幕", "策略"],
    recommendation: 0,
    supportsCloudSave: false,
    isTestGame: false,
    testPassword: "",
    toyId: "",
    videoId: ""
  }
];

const DEFAULT_HERO_DESCRIPTION =
  "收录火山哥哥的各种自制整活小游戏：热梗、名场面、奇怪脑洞，统统做成游戏，搞里头！";
const DEFAULT_GAMEHUB_VERSION = "";

const state = {
  games: [],
  activeCategory: "全部",
  cardView: "large",
  sortMode: "published",
  progress: null,
  searchQuery: "",
  historyMode: false,
  sortPickerOpen: false,
  categoryPickerOpen: false
};

const sortOptions = [
  { value: "published", label: "最新" },
  { value: "hot", label: "最热" },
  { value: "recommended", label: "推荐" }
];

const progressStorageKey = "hsgg-gamehub-progress-v1";
const videoMetaStorageKey = "hsgg-gamehub-video-meta-v1";
const videoMetaCacheMaxAge = 30 * 60 * 1000;
const videoMetaConcurrency = 4;
const todayKey = getLocalDateKey();
const dailyQuestDefinitions = [
  {
    id: "open-blind-box",
    label: "抽一次游戏盲盒",
    reward: 12,
    isComplete: (progress) => progress.daily.blindBoxes > 0
  },
  {
    id: "play-game",
    label: "进入一款小游戏",
    reward: 20,
    isComplete: (progress) => progress.daily.playedGameIds.length > 0
  },
  {
    id: "watch-video",
    label: "观摩一个名场面",
    reward: 10,
    isComplete: (progress) => progress.daily.watchedVideoIds.length > 0
  }
];

const achievementDefinitions = [
  {
    id: "first-spark",
    title: "首次点火",
    isUnlocked: (progress) => progress.totalEnergy >= 1
  },
  {
    id: "first-explore",
    title: "探索开始",
    isUnlocked: (progress) => progress.exploredGameIds.length >= 1
  },
  {
    id: "three-games",
    title: "小有收藏",
    isUnlocked: (progress) => progress.exploredGameIds.length >= 3
  },
  {
    id: "video-scout",
    title: "名场面侦察员",
    isUnlocked: (progress) => progress.watchedVideoIds.length >= 1
  },
  {
    id: "blind-box-fan",
    title: "命运骰子上头",
    isUnlocked: (progress) => progress.totalBlindBoxes >= 3
  }
];

const gameGrid = document.querySelector("#game-grid");
const heroDescription = document.querySelector("#hero-description");
const gamehubVersion = document.querySelector("#gamehub-version");
const emptyState = document.querySelector("#empty-state");
const libraryFooter = document.querySelector("#library-footer");
const filters = document.querySelector("#category-filters");
const gameSectionTitle = document.querySelector("#game-section-title");
const energyCard = document.querySelector(".energy-card");
const energyValue = document.querySelector("#energy-value");
const energyMeterFill = document.querySelector("#energy-meter-fill");
const energyCaption = document.querySelector("#energy-caption");
const questList = document.querySelector("#quest-list");
const achievementToast = document.querySelector("#achievement-toast");
const gameSearchInput = document.querySelector("#game-search-input");
const historyToggleButton = document.querySelector("#history-toggle-button");
const sortControl = document.querySelector("#sort-control");
const sortStatus = document.querySelector("#sort-status");
const cardViewButtons = document.querySelectorAll("[data-card-view]");
const aboutSection = document.querySelector("#about");
const randomButton = document.querySelector("#random-game-button");
const modal = document.querySelector("#blind-box-modal");
const modalClose = document.querySelector("#modal-close");
const modalReroll = document.querySelector("#modal-reroll");
const modalCover = document.querySelector("#modal-cover");
const modalTitle = document.querySelector("#modal-title");
const modalDescription = document.querySelector("#modal-description");
const modalMeta = document.querySelector("#modal-meta");
const modalPlayLink = document.querySelector("#modal-play-link");
const modalStatus = document.querySelector("#modal-status");
const modalPanel = modal.querySelector(".modal");
const scrollButtons = document.querySelectorAll("[data-scroll-target]");
const biliHomeButton = document.querySelector("#bili-home-button");
const biliConfirmModal = document.querySelector("#bili-confirm-modal");
const biliCancelClose = document.querySelector("#bili-cancel-close");
const biliCancelButton = document.querySelector("#bili-cancel-button");
const biliConfirmLink = document.querySelector("#bili-confirm-link");
const unavailableModal = document.querySelector("#unavailable-modal");
const unavailableConfirm = document.querySelector("#unavailable-confirm");
const testPasswordModal = document.querySelector("#test-password-modal");
const testPasswordClose = document.querySelector("#test-password-close");
const testPasswordForm = document.querySelector("#test-password-form");
const testPasswordInput = document.querySelector("#test-password-input");
const testPasswordError = document.querySelector("#test-password-error");
const testPasswordCancel = document.querySelector("#test-password-cancel");
const testPasswordDescription = document.querySelector("#test-password-description");
const orientationGuard = document.querySelector("#orientation-guard");
let unavailableTrigger = null;
let testPasswordTrigger = null;
let pendingTestGame = null;
let blindBoxRollId = 0;
let blindBoxCelebrationTimer = 0;
let audioContext = null;
let orientationLockPending = false;
const defaultCoverPath = "./assets/coming-soon-cover.png";
let achievementToastTimer = 0;
let pendingFullEnergyCelebration = false;
let lastButtonSoundAt = 0;
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const revealedStaticElements = new WeakSet();
let scrollRevealObserver = null;
const videoMetaCache = new Map();
const pendingVideoMetaRequests = new Map();
let sortMetadataQueue = Promise.resolve();

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uniqueStrings(value) {
  return [...new Set(Array.isArray(value) ? value.filter((item) => typeof item === "string" && item) : [])];
}

function clampRecommendation(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(10, number));
}

function normalizeGames(games) {
  if (!Array.isArray(games)) {
    return [];
  }

  return games.map((game, index) => ({
    id: String(game.id || `game-${index + 1}`).trim(),
    title: String(game.title || "未命名游戏").trim(),
    category: String(game.category || "未分类").trim(),
    cover: String(game.cover || "").trim(),
    cover43: String(game.cover43 || game.cover4x3 || game.smallCover || "").trim(),
    comingSoon: Boolean(game.comingSoon),
    customCover: String(game.customCover || "").trim(),
    customCover43: String(game.customCover43 || "").trim(),
    description: String(game.description || "").trim(),
    tags: Array.isArray(game.tags) ? game.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    recommendation: clampRecommendation(game.recommendation),
    supportsCloudSave: Boolean(game.supportsCloudSave),
    isTestGame: Boolean(game.isTestGame),
    testPassword: String(game.testPassword || ""),
    toyId: extractNavigationId(game.toyId || game.playUrl, "toy"),
    videoId: extractNavigationId(game.videoId || game.videoUrl, "video"),
    sourceIndex: index
  }));
}

function normalizeSiteSettings(settings) {
  const normalized = settings && typeof settings === "object" ? settings : {};
  const heroText = String(normalized.heroDescription || "").trim();
  const versionText = String(normalized.gamehubVersion || "").trim();
  return {
    heroDescription: heroText || DEFAULT_HERO_DESCRIPTION,
    gamehubVersion: versionText || DEFAULT_GAMEHUB_VERSION
  };
}

function applySiteSettings(settings) {
  const normalized = normalizeSiteSettings(settings);
  if (heroDescription) {
    heroDescription.textContent = normalized.heroDescription;
  }
  if (gamehubVersion) {
    gamehubVersion.textContent = normalized.gamehubVersion ? `GameHub ${normalized.gamehubVersion}` : "";
    gamehubVersion.hidden = !normalized.gamehubVersion;
  }
}

function createEmptyDailyProgress() {
  return {
    date: todayKey,
    energy: 0,
    blindBoxes: 0,
    playedGameIds: [],
    watchedVideoIds: [],
    completedQuestIds: [],
    fullEnergyCelebrated: false
  };
}

function normalizeProgress(progress) {
  const normalized = progress && typeof progress === "object" ? progress : {};
  const daily =
    normalized.daily && normalized.daily.date === todayKey
      ? {
          date: todayKey,
          energy: Math.max(0, Math.min(100, Number(normalized.daily.energy) || 0)),
          blindBoxes: Math.max(0, Number(normalized.daily.blindBoxes) || 0),
          playedGameIds: uniqueStrings(normalized.daily.playedGameIds),
          watchedVideoIds: uniqueStrings(normalized.daily.watchedVideoIds),
          completedQuestIds: uniqueStrings(normalized.daily.completedQuestIds),
          fullEnergyCelebrated: Boolean(normalized.daily.fullEnergyCelebrated)
        }
      : createEmptyDailyProgress();

  return {
    version: 1,
    daily,
    totalEnergy: Math.max(0, Number(normalized.totalEnergy) || 0),
    totalBlindBoxes: Math.max(0, Number(normalized.totalBlindBoxes) || 0),
    exploredGameIds: uniqueStrings(normalized.exploredGameIds),
    playHistoryGameIds: uniqueStrings(normalized.playHistoryGameIds || normalized.exploredGameIds),
    watchedVideoIds: uniqueStrings(normalized.watchedVideoIds),
    achievements: uniqueStrings(normalized.achievements)
  };
}

function loadProgress() {
  try {
    state.progress = normalizeProgress(JSON.parse(localStorage.getItem(progressStorageKey) || "{}"));
  } catch {
    state.progress = normalizeProgress({});
  }
}

function saveProgress() {
  try {
    localStorage.setItem(progressStorageKey, JSON.stringify(state.progress));
  } catch {
    // Local progress is decorative. If storage is unavailable, the page still works.
  }
}

function addUnique(list, value) {
  if (!value || list.includes(value)) {
    return false;
  }
  list.push(value);
  return true;
}

function recordGamePlayHistory(gameId) {
  if (!gameId) {
    return;
  }
  if (!Array.isArray(state.progress.playHistoryGameIds)) {
    state.progress.playHistoryGameIds = [];
  }
  state.progress.playHistoryGameIds = [gameId, ...state.progress.playHistoryGameIds.filter((id) => id !== gameId)];
}

function showToast(message) {
  window.clearTimeout(achievementToastTimer);
  achievementToast.textContent = message;
  achievementToast.hidden = false;
  achievementToast.classList.remove("is-visible");
  void achievementToast.offsetWidth;
  achievementToast.classList.add("is-visible");
  achievementToastTimer = window.setTimeout(() => {
    achievementToast.hidden = true;
    achievementToast.classList.remove("is-visible");
  }, 2600);
}

function showAchievementToast(title) {
  showToast(`成就解锁：${title}`);
}

function celebrateFullEnergy() {
  state.progress.daily.fullEnergyCelebrated = true;
  showToast("火山能量已满：今日脑洞过载！");
  energyCard.classList.remove("is-celebrating");
  void energyCard.offsetWidth;
  energyCard.classList.add("is-celebrating");
  window.setTimeout(() => {
    energyCard.classList.remove("is-celebrating");
  }, 980);
}

function checkAchievements() {
  achievementDefinitions.forEach((achievement) => {
    if (state.progress.achievements.includes(achievement.id) || !achievement.isUnlocked(state.progress)) {
      return;
    }
    state.progress.achievements.push(achievement.id);
    showAchievementToast(achievement.title);
  });
}

function addEnergy(amount) {
  const gain = Math.max(0, Number(amount) || 0);
  if (!gain) {
    return;
  }
  const previousDailyEnergy = state.progress.daily.energy;
  state.progress.daily.energy = Math.min(100, previousDailyEnergy + gain);
  state.progress.totalEnergy += gain;
  if (
    previousDailyEnergy < 100 &&
    state.progress.daily.energy >= 100 &&
    !state.progress.daily.fullEnergyCelebrated
  ) {
    state.progress.daily.fullEnergyCelebrated = true;
    pendingFullEnergyCelebration = true;
  }
}

function syncDailyQuests() {
  dailyQuestDefinitions.forEach((quest) => {
    if (state.progress.daily.completedQuestIds.includes(quest.id) || !quest.isComplete(state.progress)) {
      return;
    }
    state.progress.daily.completedQuestIds.push(quest.id);
    addEnergy(quest.reward);
  });
}

function commitProgressChange() {
  syncDailyQuests();
  checkAchievements();
  if (pendingFullEnergyCelebration) {
    pendingFullEnergyCelebration = false;
    celebrateFullEnergy();
  }
  saveProgress();
  renderProgress();
}

function trackBlindBoxOpen() {
  state.progress.daily.blindBoxes += 1;
  state.progress.totalBlindBoxes += 1;
  addEnergy(3);
  commitProgressChange();
}

function trackGamePlay(game) {
  if (!game) {
    return;
  }
  const explored = addUnique(state.progress.exploredGameIds, game.id);
  recordGamePlayHistory(game.id);
  addUnique(state.progress.daily.playedGameIds, game.id);
  addEnergy(explored ? 10 : 4);
  commitProgressChange();
  render();
}

function trackVideoWatch(game) {
  if (!game) {
    return;
  }
  const firstWatch = addUnique(state.progress.watchedVideoIds, game.id);
  addUnique(state.progress.daily.watchedVideoIds, game.id);
  addEnergy(firstWatch ? 6 : 2);
  commitProgressChange();
}

function getEnergyCaption(energy) {
  if (energy >= 100) {
    return "今日脑洞过载，火山能量已拉满。";
  }
  if (energy >= 70) {
    return "状态正热，适合再开一局。";
  }
  if (energy >= 35) {
    return "脑洞开始升温，继续探索。";
  }
  return "点火开始，今天也来一点脑洞。";
}

function renderProgress() {
  if (!state.progress) {
    return;
  }

  const energy = state.progress.daily.energy;
  energyValue.textContent = `${energy}/100`;
  energyMeterFill.style.width = `${energy}%`;
  energyCaption.textContent = getEnergyCaption(energy);
  energyCard.classList.toggle("is-full", energy >= 100);

  questList.innerHTML = "";
  dailyQuestDefinitions.forEach((quest) => {
    const complete = state.progress.daily.completedQuestIds.includes(quest.id);
    const item = document.createElement("div");
    item.className = "quest-item";
    item.classList.toggle("is-complete", complete);
    item.innerHTML = `
      <span class="quest-check" aria-hidden="true">${complete ? "✓" : ""}</span>
      <span class="quest-label">${quest.label}</span>
      <strong>+${quest.reward}</strong>
    `;
    questList.append(item);
  });
}

function isTouchLandscape() {
  const touchFirst = window.matchMedia("(pointer: coarse) and (hover: none)").matches;
  return touchFirst && window.innerWidth > window.innerHeight;
}

function syncOrientationGuard() {
  const shouldBlock = isTouchLandscape();
  orientationGuard.hidden = !shouldBlock;
  document.body.classList.toggle("orientation-blocked", shouldBlock);
  return shouldBlock;
}

async function requestPortraitOrientation() {
  if (orientationLockPending) {
    return;
  }

  if (!isTouchLandscape()) {
    syncOrientationGuard();
    return;
  }

  const lock = window.screen?.orientation?.lock;
  if (typeof lock !== "function") {
    syncOrientationGuard();
    return;
  }

  orientationLockPending = true;
  try {
    await lock.call(window.screen.orientation, "portrait");
  } catch {
    // Most standalone browsers only allow locking in fullscreen. The guard
    // below keeps the index portrait-only when the host WebView cannot rotate.
  } finally {
    orientationLockPending = false;
    syncOrientationGuard();
  }
}

syncOrientationGuard();
window.addEventListener("resize", syncOrientationGuard, { passive: true });
window.addEventListener("orientationchange", syncOrientationGuard, { passive: true });
document.addEventListener(
  "pointerdown",
  () => {
    if (syncOrientationGuard()) {
      void requestPortraitOrientation();
    }
  },
  { passive: true }
);

function isUnavailableLink(value) {
  const link = typeof value === "string" ? value.trim() : "";
  return !link || link === "#";
}

function extractNavigationId(value, type) {
  const text = typeof value === "string" ? value.trim() : "";
  if (isUnavailableLink(text)) {
    return "";
  }

  const navigateId = text.match(/\bid\s*:\s*['"]([^'"]+)['"]/i)?.[1];
  if (navigateId) {
    return navigateId;
  }

  if (type === "video") {
    return text.match(/(?:\/video\/|\b)(BV[0-9A-Za-z]+)/i)?.[1] || text;
  }

  if (type === "toy") {
    const toyPathId = text.match(/\/toy\/([^/?#]+)/i)?.[1];
    return toyPathId ? decodeURIComponent(toyPathId) : text;
  }

  return text;
}

function getGameNavigation(game, type) {
  if (type === "toy") {
    return extractNavigationId(game.toyId || game.playUrl, type);
  }
  return extractNavigationId(game.videoId || game.videoUrl, type);
}

function getEntryLabel(game, type) {
  const id = getGameNavigation(game, type);
  if (id) {
    return type === "toy" ? "进入游戏" : "观摩视频";
  }

  if (type === "toy") {
    return game.comingSoon || (game.tags || []).includes("即将上线") ? "即将上线" : "暂无入口";
  }

  return "暂无视频";
}

function syncUnavailableAction(button, game, type) {
  const id = getGameNavigation(game, type);
  const isUnavailable = !id;
  button.textContent = getEntryLabel(game, type);
  button.classList.toggle("is-unavailable", isUnavailable);
  button.setAttribute(
    "aria-label",
    isUnavailable
      ? `${type === "toy" ? "游戏入口" : "视频入口"}暂时不可用，点击查看提示`
      : button.textContent
  );
  button.title = isUnavailable ? "暂时无法打开，点击查看提示" : "";
  return id;
}

function buildBrowserFallbackUrl(type, id) {
  if (type === "video") {
    return `https://www.bilibili.com/video/${encodeURIComponent(id)}`;
  }
  if (type === "space") {
    return `https://space.bilibili.com/${encodeURIComponent(id)}`;
  }
  if (type === "toy") {
    return `https://www.bilibili.com/toy/${encodeURIComponent(id)}/index.html`;
  }
  return "";
}

function isBilibiliHost() {
  return /(^|\.)bilibili\.com$/i.test(window.location.hostname);
}

async function navigateWithToyApi(type, id, trigger) {
  const resourceId = typeof id === "string" ? id.trim() : "";
  if (!resourceId) {
    showUnavailable(trigger);
    return;
  }

  if (typeof globalThis.toy?.navigate === "function") {
    try {
      await globalThis.toy.navigate({
        type,
        id: resourceId,
        extra: { from: "hsgg-gamehub" }
      });
      return;
    } catch (error) {
      console.error("Bilibili Toy navigation failed", error);
      showUnavailable(trigger);
      return;
    }
  }

  if (isBilibiliHost()) {
    showUnavailable(trigger);
    return;
  }

  const fallbackUrl = buildBrowserFallbackUrl(type, resourceId);
  if (fallbackUrl) {
    window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    return;
  }

  showUnavailable(trigger);
}

function showUnavailable(trigger) {
  unavailableTrigger = trigger || null;
  unavailableModal.hidden = false;
  unavailableConfirm.focus();
}

function closeUnavailable() {
  unavailableModal.hidden = true;
  unavailableTrigger?.focus();
  unavailableTrigger = null;
}

function launchGame(game, trigger) {
  const toyId = getGameNavigation(game, "toy");
  if (!toyId) {
    void navigateWithToyApi("toy", toyId, trigger);
    return;
  }

  trackGamePlay(game);
  void navigateWithToyApi("toy", toyId, trigger);
}

function showTestPasswordModal(game, trigger) {
  pendingTestGame = game;
  testPasswordTrigger = trigger || null;
  testPasswordDescription.textContent = `「${game.title}」正在测试中，输入密码后即可进入。`;
  testPasswordInput.value = "";
  testPasswordInput.removeAttribute("aria-invalid");
  testPasswordError.hidden = true;
  testPasswordModal.hidden = false;
  window.requestAnimationFrame(() => testPasswordInput.focus());
}

function closeTestPasswordModal(restoreFocus = true) {
  testPasswordModal.hidden = true;
  pendingTestGame = null;
  testPasswordInput.value = "";
  testPasswordInput.removeAttribute("aria-invalid");
  testPasswordError.hidden = true;
  if (restoreFocus) {
    testPasswordTrigger?.focus();
  }
  testPasswordTrigger = null;
}

function requestGameLaunch(game, trigger) {
  if (!game) {
    showUnavailable(trigger);
    return;
  }

  if (!getGameNavigation(game, "toy")) {
    launchGame(game, trigger);
    return;
  }

  if (game.isTestGame) {
    showTestPasswordModal(game, trigger);
    return;
  }

  launchGame(game, trigger);
}

function readVideoMetaCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(videoMetaStorageKey) || "{}");
    Object.entries(cached).forEach(([bvid, item]) => {
      if (!item || typeof item !== "object") {
        return;
      }
      videoMetaCache.set(bvid, {
        pubdate: Number(item.pubdate) || 0,
        view: Number(item.view) || 0,
        fetchedAt: Number(item.fetchedAt) || 0
      });
    });
  } catch {
    videoMetaCache.clear();
  }
}

function writeVideoMetaCache() {
  try {
    const cache = {};
    videoMetaCache.forEach((item, bvid) => {
      cache[bvid] = item;
    });
    sessionStorage.setItem(videoMetaStorageKey, JSON.stringify(cache));
  } catch {
    // Sorting still works with in-memory cache when sessionStorage is unavailable.
  }
}

function isFreshVideoMeta(meta) {
  return Boolean(meta?.fetchedAt) && Date.now() - meta.fetchedAt < videoMetaCacheMaxAge;
}

function extractVideoMeta(payload) {
  const data = payload?.data && typeof payload.data === "object" ? payload.data : null;
  if (!data) {
    return null;
  }
  return {
    pubdate: Number(data.pubdate || data.ctime) || 0,
    view: Number(data.stat?.view || data.stat?.vv) || 0,
    fetchedAt: Date.now()
  };
}

function rememberMissingVideoMeta(bvid) {
  videoMetaCache.set(bvid, {
    pubdate: 0,
    view: 0,
    fetchedAt: Date.now()
  });
  writeVideoMetaCache();
}

function fetchVideoMetaByJsonp(bvid) {
  if (!bvid) {
    return Promise.resolve(null);
  }

  if (pendingVideoMetaRequests.has(bvid)) {
    return pendingVideoMetaRequests.get(bvid);
  }

  const promise = new Promise((resolve) => {
    const callbackName = `__hsggVideoMeta${Date.now()}${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      rememberMissingVideoMeta(bvid);
      cleanup();
      resolve(null);
    }, 9000);

    function cleanup() {
      window.clearTimeout(timeout);
      script.remove();
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
    }

    window[callbackName] = (payload) => {
      const meta = extractVideoMeta(payload);
      if (meta) {
        videoMetaCache.set(bvid, meta);
        writeVideoMetaCache();
      } else {
        rememberMissingVideoMeta(bvid);
      }
      cleanup();
      resolve(meta);
    };

    script.addEventListener(
      "error",
      () => {
        rememberMissingVideoMeta(bvid);
        cleanup();
        resolve(null);
      },
      { once: true }
    );
    script.src = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(
      bvid
    )}&jsonp=jsonp&callback=${callbackName}`;
    document.head.append(script);
  }).finally(() => {
    pendingVideoMetaRequests.delete(bvid);
  });

  pendingVideoMetaRequests.set(bvid, promise);
  return promise;
}

async function fetchMissingVideoMeta(bvids) {
  const queue = bvids.filter((bvid) => bvid && !isFreshVideoMeta(videoMetaCache.get(bvid)));
  if (!queue.length) {
    return;
  }

  let cursor = 0;
  const workers = Array.from({ length: Math.min(videoMetaConcurrency, queue.length) }, async () => {
    while (cursor < queue.length) {
      const bvid = queue[cursor];
      cursor += 1;
      await fetchVideoMetaByJsonp(bvid);
    }
  });
  await Promise.all(workers);
}

async function loadGames() {
  try {
    const response = await fetch("./data/games.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const games = await response.json();
    const normalizedGames = normalizeGames(games);
    state.games = normalizedGames.length ? normalizedGames : normalizeGames(fallbackGames);
  } catch (error) {
    state.games = normalizeGames(fallbackGames);
  }
}

async function loadSiteSettings() {
  try {
    const response = await fetch("./data/site.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    applySiteSettings(await response.json());
  } catch (error) {
    applySiteSettings(null);
  }
}

function getCategories() {
  return ["全部", ...new Set(state.games.map((game) => game.category).filter(Boolean))];
}

function getSortValue(game) {
  if (state.sortMode === "recommended") {
    return clampRecommendation(game.recommendation);
  }

  const meta = videoMetaCache.get(game.videoId);
  if (state.sortMode === "hot") {
    return Number(meta?.view) || 0;
  }
  return Number(meta?.pubdate) || 0;
}

function sortGames(games) {
  return [...games].sort((gameA, gameB) => {
    const valueA = getSortValue(gameA);
    const valueB = getSortValue(gameB);
    const hasValueA = valueA > 0;
    const hasValueB = valueB > 0;
    if (hasValueA && hasValueB && valueA !== valueB) {
      return valueB - valueA;
    }
    if (hasValueA !== hasValueB) {
      return hasValueA ? -1 : 1;
    }
    return (gameA.sourceIndex ?? 0) - (gameB.sourceIndex ?? 0);
  });
}

function getHistoryGames() {
  const historyIds = state.progress?.playHistoryGameIds?.length
    ? state.progress.playHistoryGameIds
    : state.progress?.exploredGameIds || [];
  const gamesById = new Map(state.games.map((game) => [game.id, game]));
  return historyIds.map((id) => gamesById.get(id)).filter(Boolean);
}

function getVisibleGames() {
  const baseGames = state.historyMode ? getHistoryGames() : state.games;
  const categoryGames =
    state.activeCategory === "全部"
      ? baseGames
      : baseGames.filter((game) => game.category === state.activeCategory);
  const query = state.searchQuery.trim().toLocaleLowerCase();
  const visibleGames = query
    ? categoryGames.filter((game) => game.title.toLocaleLowerCase().includes(query))
    : categoryGames;
  if (state.historyMode) {
    return visibleGames;
  }
  if (!query) {
    return sortGames(categoryGames);
  }

  return sortGames(visibleGames);
}

function getSortLabel() {
  return sortOptions.find((option) => option.value === state.sortMode)?.label || sortOptions[0].label;
}

function updateSortStatus(isLoading = false) {
  if (!sortStatus) {
    return;
  }
  if (state.historyMode) {
    sortStatus.textContent = "已按历史游玩排序";
    return;
  }
  sortStatus.textContent = isLoading ? `正在获取视频数据，准备按${getSortLabel()}排序` : `已按${getSortLabel()}排序`;
}

function requestSortMetadataForMode() {
  if (state.historyMode) {
    updateSortStatus();
    return;
  }
  if (state.sortMode === "recommended") {
    updateSortStatus();
    return;
  }

  const bvids = [...new Set(state.games.map((game) => game.videoId).filter(Boolean))];
  const missingBvids = bvids.filter((bvid) => !isFreshVideoMeta(videoMetaCache.get(bvid)));
  if (!missingBvids.length) {
    updateSortStatus();
    return;
  }

  updateSortStatus(true);
  sortMetadataQueue = sortMetadataQueue
    .then(() => fetchMissingVideoMeta(missingBvids))
    .catch(() => {})
    .then(() => {
      updateSortStatus();
      render();
    });
}

function renderSortPicker() {
  const activeOption = sortOptions.find((option) => option.value === state.sortMode) || sortOptions[0];
  state.sortMode = activeOption.value;
  sortControl.innerHTML = "";

  const picker = document.createElement("div");
  picker.className = "category-picker sort-picker";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "filter-button category-trigger sort-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", String(state.sortPickerOpen));
  trigger.setAttribute("aria-controls", "sort-menu");
  trigger.setAttribute("aria-describedby", "sort-status");
  const triggerLabel = document.createElement("span");
  triggerLabel.textContent = activeOption.label;
  const triggerIcon = document.createElement("span");
  triggerIcon.className = "category-trigger-icon";
  triggerIcon.setAttribute("aria-hidden", "true");
  trigger.append(triggerLabel, triggerIcon);
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    state.sortPickerOpen = !state.sortPickerOpen;
    state.categoryPickerOpen = false;
    renderSortPicker();
    renderFilters();
  });

  const menu = document.createElement("div");
  menu.className = "category-menu sort-menu";
  menu.id = "sort-menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", "游戏排序");
  menu.hidden = !state.sortPickerOpen;

  sortOptions.forEach((sortOption) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "filter-button category-option sort-option";
    option.textContent = sortOption.label;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(sortOption.value === state.sortMode));
    if (sortOption.value === state.sortMode) {
      option.classList.add("is-active");
    }
    option.addEventListener("click", () => {
      state.sortMode = sortOption.value;
      state.sortPickerOpen = false;
      render();
    });
    menu.append(option);
  });

  picker.append(trigger, menu);
  sortControl.append(picker);
}

function closeSortPicker(restoreFocus = false) {
  if (!state.sortPickerOpen) {
    return;
  }

  state.sortPickerOpen = false;
  renderSortPicker();
  if (restoreFocus) {
    sortControl.querySelector(".sort-trigger")?.focus();
  }
}

function renderFilters() {
  const categories = getCategories();
  const activeCategory = categories.includes(state.activeCategory) ? state.activeCategory : "全部";
  state.activeCategory = activeCategory;
  filters.innerHTML = "";

  const picker = document.createElement("div");
  picker.className = "category-picker";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "filter-button category-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", String(state.categoryPickerOpen));
  trigger.setAttribute("aria-controls", "category-menu");
  const triggerLabel = document.createElement("span");
  triggerLabel.textContent = activeCategory;
  const triggerIcon = document.createElement("span");
  triggerIcon.className = "category-trigger-icon";
  triggerIcon.setAttribute("aria-hidden", "true");
  trigger.append(triggerLabel, triggerIcon);
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    state.categoryPickerOpen = !state.categoryPickerOpen;
    state.sortPickerOpen = false;
    renderSortPicker();
    renderFilters();
  });

  const menu = document.createElement("div");
  menu.className = "category-menu";
  menu.id = "category-menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", "游戏分类");
  menu.hidden = !state.categoryPickerOpen;

  categories.forEach((category) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "filter-button category-option";
    option.textContent = category;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(category === activeCategory));
    if (category === state.activeCategory) {
      option.classList.add("is-active");
    }
    option.addEventListener("click", () => {
      state.activeCategory = category;
      state.categoryPickerOpen = false;
      render();
    });
    menu.append(option);
  });

  picker.append(trigger, menu);
  filters.append(picker);
}

function closeCategoryPicker(restoreFocus = false) {
  if (!state.categoryPickerOpen) {
    return;
  }

  state.categoryPickerOpen = false;
  renderFilters();
  if (restoreFocus) {
    filters.querySelector(".category-trigger")?.focus();
  }
}

function renderLibraryHeading(visibleGames = getVisibleGames()) {
  if (state.historyMode) {
    gameSectionTitle.textContent = state.searchQuery.trim()
      ? `历史中${visibleGames.length}个搜索结果`
      : `历史游玩${visibleGames.length}个小游戏`;
    return;
  }
  if (state.searchQuery.trim()) {
    gameSectionTitle.textContent = `${visibleGames.length}个搜索结果`;
    return;
  }

  gameSectionTitle.textContent =
    state.activeCategory === "全部"
      ? `全部${visibleGames.length}个小游戏`
      : `${visibleGames.length}个${state.activeCategory}游戏`;
}

function createTagRow(tags = []) {
  const row = document.createElement("div");
  row.className = "tag-row";
  tags.slice(0, 4).forEach((tag) => {
    const item = document.createElement("span");
    item.textContent = tag;
    row.append(item);
  });
  return row;
}

function resolveCoverPath(coverPath = "") {
  const path = typeof coverPath === "string" ? coverPath.trim() : "";
  if (!path) {
    return defaultCoverPath;
  }
  if (/^(?:data:|https?:\/\/)/i.test(path)) {
    return path;
  }
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  return normalized.startsWith("assets/") ? `./${normalized}` : path;
}

function setImageWithFallback(image, coverPath, altText) {
  image.alt = altText;
  image.onerror = () => {
    image.onerror = null;
    image.src = defaultCoverPath;
  };
  image.src = resolveCoverPath(coverPath);
}

function getCardCover(game) {
  return state.cardView === "compact" || state.cardView === "list" ? game.cover43 || game.cover : game.cover;
}

function revealScrollElement(element, delay = 0) {
  element.style.setProperty("--reveal-enter-delay", `${delay}ms`);
  element.classList.add("is-enter-visible");

  const clearRevealState = (event) => {
    if (event.propertyName !== "transform") {
      return;
    }
    element.classList.remove("is-enter-ready", "is-enter-visible");
    element.style.removeProperty("--reveal-enter-delay");
    element.style.removeProperty("--reveal-enter-x");
    if (element.dataset.revealPersist === "true") {
      revealedStaticElements.add(element);
    }
    element.removeEventListener("transitionend", clearRevealState);
  };

  element.addEventListener("transitionend", clearRevealState);
}

function createScrollRevealObserver() {
  if (reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
    return null;
  }

  return new IntersectionObserver(
    (entries, observer) => {
      let revealIndex = 0;
      entries
        .filter((entry) => entry.isIntersecting)
        .sort((entryA, entryB) => Number(entryA.target.dataset.revealIndex) - Number(entryB.target.dataset.revealIndex))
        .forEach((entry) => {
          observer.unobserve(entry.target);
          revealScrollElement(entry.target, Math.min(revealIndex, 8) * 70);
          revealIndex += 1;
        });
    },
    {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.16
    }
  );
}

function prepareScrollReveal(element, index, options = {}) {
  const persistAfterReveal = options.persistAfterReveal === true;
  if (persistAfterReveal && revealedStaticElements.has(element)) {
    return;
  }

  if (!scrollRevealObserver) {
    return;
  }

  element.dataset.revealIndex = String(index);
  element.dataset.revealPersist = String(persistAfterReveal);
  element.style.setProperty("--reveal-enter-x", options.enterX ?? (index % 2 === 0 ? "-1.1rem" : "1.1rem"));
  element.classList.add("scroll-reveal", "is-enter-ready");
  scrollRevealObserver.observe(element);
}

function prepareStaticReveals(startIndex = 0) {
  [
    { element: libraryFooter, enterX: "0" },
    { element: aboutSection, enterX: "0" }
  ].forEach((item, offset) => {
    if (!item.element || item.element.hidden) {
      return;
    }
    prepareScrollReveal(item.element, startIndex + offset, {
      enterX: item.enterX,
      persistAfterReveal: true
    });
  });
}

function resetScrollRevealObserver() {
  scrollRevealObserver?.disconnect();
  scrollRevealObserver = createScrollRevealObserver();
}

function createGameCard(game, index = 0) {
  const isCompactView = state.cardView === "compact";
  const isExplored = state.progress.exploredGameIds.includes(game.id);
  const isLocked = !getGameNavigation(game, "toy");
  const article = document.createElement("article");
  article.className = "game-card";
  article.classList.toggle("is-explored", isExplored);
  article.classList.toggle("is-locked", isLocked);

  const coverWrap = document.createElement("div");
  coverWrap.className = "game-cover";

  const cover = document.createElement("img");
  setImageWithFallback(cover, getCardCover(game), `${game.title}封面`);
  cover.loading = "lazy";
  coverWrap.append(cover);

  if (game.supportsCloudSave) {
    const cloudSaveBadge = document.createElement("span");
    cloudSaveBadge.className = "cloud-save-badge";
    cloudSaveBadge.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7.2 18.2h9.5a4.1 4.1 0 0 0 .7-8.15A5.65 5.65 0 0 0 6.75 8.7a4.78 4.78 0 0 0 .45 9.5Z" />
      </svg>
      <span>云存档</span>
    `;
    coverWrap.append(cloudSaveBadge);
  }

  const status = document.createElement("span");
  status.className = "game-status";
  status.textContent = isLocked ? "锁定" : isExplored ? "已探索" : "未探索";

  const body = document.createElement("div");
  body.className = "game-card-body";

  const title = document.createElement("h3");
  title.textContent = game.title;

  const playLink = document.createElement("button");
  playLink.type = "button";
  playLink.className = "primary-action card-play";
  syncUnavailableAction(playLink, game, "toy");
  playLink.addEventListener("click", () => {
    requestGameLaunch(game, playLink);
  });

  const videoLink = document.createElement("button");
  videoLink.type = "button";
  videoLink.className = "secondary-action card-video";
  const videoId = syncUnavailableAction(videoLink, game, "video");
  videoLink.addEventListener("click", () => {
    if (videoId) {
      trackVideoWatch(game);
    }
    void navigateWithToyApi("video", videoId, videoLink);
  });

  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.append(playLink, videoLink);

  body.append(title);
  if (!isCompactView) {
    const description = document.createElement("p");
    description.textContent = game.description;
    body.append(description, createTagRow(game.tags));
  }
  body.append(actions);
  article.append(status, coverWrap, body);
  prepareScrollReveal(article, index);
  return article;
}

function renderGames(games = getVisibleGames()) {
  gameGrid.innerHTML = "";
  resetScrollRevealObserver();
  gameGrid.classList.toggle("is-compact", state.cardView === "compact");
  gameGrid.classList.toggle("is-list", state.cardView === "list");
  emptyState.hidden = games.length > 0;
  libraryFooter.hidden = games.length === 0;
  games.forEach((game, index) => gameGrid.append(createGameCard(game, index)));
  prepareStaticReveals(games.length);
}

function renderCardViewToggle() {
  cardViewButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.cardView === state.cardView));
  });
}

function renderHistoryToggle() {
  historyToggleButton.setAttribute("aria-pressed", String(state.historyMode));
  historyToggleButton.classList.toggle("is-active", state.historyMode);
}

function render() {
  const visibleGames = getVisibleGames();
  renderLibraryHeading(visibleGames);
  renderCardViewToggle();
  renderHistoryToggle();
  renderSortPicker();
  renderFilters();
  renderGames(visibleGames);
  requestSortMetadataForMode();
}

function pickRandomGame() {
  const blindBoxGames = state.games.filter((game) => !game.isTestGame);
  if (!blindBoxGames.length) {
    return null;
  }
  const index = Math.floor(Math.random() * blindBoxGames.length);
  return blindBoxGames[index];
}

function renderBlindBoxGame(game) {
  setImageWithFallback(modalCover, game.cover, `${game.title}封面`);
  modalTitle.textContent = game.title;
  modalDescription.textContent = game.description;
  modalPlayLink.dataset.toyId = syncUnavailableAction(modalPlayLink, game, "toy");
  modalPlayLink.dataset.gameId = game.id;
  modalMeta.innerHTML = "";

  [game.category, ...(game.tags || [])].filter(Boolean).slice(0, 5).forEach((label) => {
    const item = document.createElement("span");
    item.textContent = label;
    modalMeta.append(item);
  });
}

function getAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    return null;
  }
  audioContext ||= new AudioContextConstructor();
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }
  return audioContext;
}

function playBlindBoxTick(progress = 0) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const startedAt = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const frequency = 1120 - 360 * progress;

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, startedAt);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(220, frequency * 0.72), startedAt + 0.04);

  gain.gain.setValueAtTime(0.0001, startedAt);
  gain.gain.exponentialRampToValueAtTime(0.1, startedAt + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.045);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startedAt);
  oscillator.stop(startedAt + 0.05);
}

function playButtonPressSound() {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const startedAt = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(420, startedAt);
  oscillator.frequency.exponentialRampToValueAtTime(260, startedAt + 0.055);

  gain.gain.setValueAtTime(0.0001, startedAt);
  gain.gain.exponentialRampToValueAtTime(0.08, startedAt + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.065);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startedAt);
  oscillator.stop(startedAt + 0.075);
}

function getSoundTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  const soundTarget = target.closest("button, a[href], [role='button']");
  if (!soundTarget || !document.body.contains(soundTarget)) {
    return null;
  }
  if (soundTarget.matches(":disabled") || soundTarget.getAttribute("aria-disabled") === "true") {
    return null;
  }
  return soundTarget;
}

function playButtonPressSoundOnce() {
  const now = performance.now();
  if (now - lastButtonSoundAt < 90) {
    return;
  }
  lastButtonSoundAt = now;
  playButtonPressSound();
}

function playBlindBoxSuccess() {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const startedAt = context.currentTime;
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = startedAt + index * 0.075;
    const noteEnd = noteStart + 0.22;

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.08, noteEnd);

    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.02);
  });
}

function setBlindBoxRolling(isRolling) {
  modalPanel.setAttribute("aria-busy", String(isRolling));
  modalStatus.textContent = isRolling ? "正在抽选..." : "游戏盲盒抽中了";
  modalReroll.disabled = isRolling;
  modalPlayLink.disabled = isRolling;
  modalPlayLink.classList.toggle("is-disabled", isRolling);
  modalPlayLink.setAttribute("aria-disabled", String(isRolling));

  if (isRolling) {
    modalPlayLink.setAttribute("tabindex", "-1");
  } else {
    modalPlayLink.removeAttribute("tabindex");
    modalPlayLink.removeAttribute("aria-disabled");
  }
}

function clearBlindBoxCelebration() {
  window.clearTimeout(blindBoxCelebrationTimer);
  modalPanel.classList.remove("is-revealed");
  modal.querySelector(".blind-box-celebration")?.remove();
}

function celebrateBlindBox() {
  clearBlindBoxCelebration();
  void modalPanel.offsetWidth;
  modalPanel.classList.add("is-revealed");

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const celebration = document.createElement("div");
    const colors = ["#e83a22", "#ffc928", "#2e72b9", "#fffaf0"];
    celebration.className = "blind-box-celebration";
    celebration.setAttribute("aria-hidden", "true");

    for (let index = 0; index < 44; index += 1) {
      const piece = document.createElement("i");
      const angle = (Math.PI * 2 * index) / 44 + (Math.random() - 0.5) * 0.32;
      const distance = 150 + Math.random() * 280;
      piece.className = "confetti-piece";
      piece.style.setProperty("--burst-x", `${Math.cos(angle) * distance}px`);
      piece.style.setProperty("--burst-y", `${Math.sin(angle) * distance}px`);
      piece.style.setProperty("--spin", `${360 + Math.random() * 720}deg`);
      piece.style.setProperty("--delay", `${Math.random() * 100}ms`);
      piece.style.setProperty("--confetti-color", colors[index % colors.length]);
      celebration.append(piece);
    }

    modal.append(celebration);
  }

  blindBoxCelebrationTimer = window.setTimeout(clearBlindBoxCelebration, 1700);
}

function showBlindBox(game = pickRandomGame()) {
  const blindBoxGames = state.games.filter((item) => !item.isTestGame);
  if (!game || !blindBoxGames.length) {
    showUnavailable(randomButton);
    return;
  }

  const rollId = ++blindBoxRollId;
  const duration = 2100;
  let rollingIndex = Math.floor(Math.random() * blindBoxGames.length);
  let nextSwitchAt = 0;
  clearBlindBoxCelebration();
  getAudioContext();
  modal.hidden = false;
  setBlindBoxRolling(true);
  renderBlindBoxGame(blindBoxGames[rollingIndex]);
  playBlindBoxTick(0);
  modalClose.focus();

  const startedAt = performance.now();
  const roll = (now) => {
    if (rollId !== blindBoxRollId) {
      return;
    }

    const progress = Math.min((now - startedAt) / duration, 1);
    if (progress >= 1) {
      renderBlindBoxGame(game);
      setBlindBoxRolling(false);
      playBlindBoxSuccess();
      celebrateBlindBox();
      return;
    }

    if (now >= nextSwitchAt) {
      rollingIndex = (rollingIndex + 1) % blindBoxGames.length;
      renderBlindBoxGame(blindBoxGames[rollingIndex]);
      playBlindBoxTick(progress);
      const slowDown = progress * progress * progress;
      nextSwitchAt = now + 60 + 280 * slowDown;
    }

    requestAnimationFrame(roll);
  };

  requestAnimationFrame(roll);
}

function closeModal() {
  blindBoxRollId += 1;
  clearBlindBoxCelebration();
  setBlindBoxRolling(false);
  modal.hidden = true;
  randomButton.focus();
}

function showBiliConfirm() {
  biliConfirmModal.hidden = false;
  biliCancelButton.focus();
}

function closeBiliConfirm() {
  biliConfirmModal.hidden = true;
  biliHomeButton.focus();
}

document.addEventListener(
  "pointerdown",
  (event) => {
    if (getSoundTarget(event.target)) {
      playButtonPressSoundOnce();
    }
  },
  { capture: true }
);

document.addEventListener(
  "keydown",
  (event) => {
    if ((event.key === "Enter" || event.key === " ") && getSoundTarget(event.target)) {
      playButtonPressSoundOnce();
    }
  },
  { capture: true }
);

randomButton.addEventListener("click", () => {
  const game = pickRandomGame();
  if (!game) {
    showUnavailable(randomButton);
    return;
  }
  trackBlindBoxOpen();
  showBlindBox(game);
});
cardViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.cardView = button.dataset.cardView || "large";
    render();
  });
});

gameSearchInput.addEventListener("input", () => {
  state.searchQuery = gameSearchInput.value;
  render();
});
historyToggleButton.addEventListener("click", () => {
  state.historyMode = !state.historyMode;
  state.sortPickerOpen = false;
  state.categoryPickerOpen = false;
  render();
});
modalReroll.addEventListener("click", () => {
  const game = pickRandomGame();
  if (!game) {
    closeModal();
    showUnavailable(randomButton);
    return;
  }
  trackBlindBoxOpen();
  showBlindBox(game);
});
modalClose.addEventListener("click", closeModal);
biliHomeButton.addEventListener("click", showBiliConfirm);
biliCancelClose.addEventListener("click", closeBiliConfirm);
biliCancelButton.addEventListener("click", closeBiliConfirm);
biliConfirmLink.addEventListener("click", () => {
  biliConfirmModal.hidden = true;
  void navigateWithToyApi("space", "137429365", biliConfirmLink);
});
modalPlayLink.addEventListener("click", () => {
  const game = state.games.find((item) => item.id === modalPlayLink.dataset.gameId);
  requestGameLaunch(game, modalPlayLink);
});
testPasswordClose.addEventListener("click", () => closeTestPasswordModal());
testPasswordCancel.addEventListener("click", () => closeTestPasswordModal());
testPasswordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const game = pendingTestGame;
  if (!game) {
    closeTestPasswordModal(false);
    return;
  }

  if (testPasswordInput.value !== game.testPassword) {
    testPasswordError.hidden = false;
    testPasswordInput.setAttribute("aria-invalid", "true");
    testPasswordInput.focus();
    testPasswordInput.select();
    return;
  }

  const trigger = testPasswordTrigger;
  closeTestPasswordModal(false);
  launchGame(game, trigger);
});
unavailableConfirm.addEventListener("click", closeUnavailable);

scrollButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.scrollTarget;
    const target = targetId ? document.getElementById(targetId) : null;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

biliConfirmModal.addEventListener("click", (event) => {
  if (event.target === biliConfirmModal) {
    closeBiliConfirm();
  }
});

testPasswordModal.addEventListener("click", (event) => {
  if (event.target === testPasswordModal) {
    closeTestPasswordModal();
  }
});

document.addEventListener("click", (event) => {
  const clickedSortControl = sortControl.contains(event.target);
  const clickedCategoryControl = filters.contains(event.target);
  if (state.sortPickerOpen && !clickedSortControl) {
    closeSortPicker();
  }
  if (state.categoryPickerOpen && !clickedCategoryControl) {
    closeCategoryPicker();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !testPasswordModal.hidden) {
    closeTestPasswordModal();
    return;
  }
  if (event.key === "Escape" && !unavailableModal.hidden) {
    closeUnavailable();
    return;
  }
  if (event.key === "Escape" && !modal.hidden) {
    closeModal();
  }
  if (event.key === "Escape" && !biliConfirmModal.hidden) {
    closeBiliConfirm();
    return;
  }
  if (event.key === "Escape" && state.categoryPickerOpen) {
    closeCategoryPicker(true);
    return;
  }
  if (event.key === "Escape" && state.sortPickerOpen) {
    closeSortPicker(true);
  }
});

readVideoMetaCache();
loadProgress();
await loadSiteSettings();
await loadGames();
render();
renderProgress();
