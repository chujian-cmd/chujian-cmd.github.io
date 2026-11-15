(function () {
  const LOCAL_PREFIX = "jimidou-toy:";
  const DEFAULT_AUTHOR_MID = "4132220";
  const DEFAULT_VIDEO_ID = "";
  const DEFAULT_AID = 0;
  const SDK_TIMEOUT_MS = 3200;
  const memoryStorage = {};

  function storageGet(key) {
    try {
      return window.localStorage ? window.localStorage.getItem(key) : memoryStorage[key] || null;
    } catch (error) {
      return memoryStorage[key] || null;
    }
  }

  function storageSet(key, value) {
    memoryStorage[key] = String(value);
    try {
      if (window.localStorage) window.localStorage.setItem(key, String(value));
    } catch (error) {
      console.warn("[ToyAdapter] local storage unavailable", error);
    }
  }

  function withTimeout(promise, label, timeout = SDK_TIMEOUT_MS) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error(`${label} timeout`)), timeout);
      }),
    ]);
  }

  function errorCode(value) {
    if (!value || typeof value !== "object") return "";
    const candidates = [
      value.code,
      value.errCode,
      value.errorCode,
      value.statusCode,
      value.data?.code,
      value.data?.errCode,
      value.data?.errorCode,
      value.error?.code,
      value.error?.errCode,
      value.response?.code,
      value.response?.data?.code,
    ];
    const match = candidates.find((candidate) => candidate !== undefined && candidate !== null);
    return match === undefined ? "" : String(match);
  }

  function isRateLimitedError(value) {
    return errorCode(value) === "307044" || /307044/.test(String(value?.message || value || ""));
  }

  function getToy() {
    return window.toy || null;
  }

  function isLikelyToyRuntime() {
    const host = window.location.hostname;
    const inFrame = (() => {
      try {
        return window.self !== window.top;
      } catch (error) {
        return true;
      }
    })();
    return inFrame || /(^|\.)bilibili(toy)?\.com$/i.test(host);
  }

  function canUseToy(method) {
    const toy = getToy();
    if (!toy || !isLikelyToyRuntime()) return false;
    return method ? typeof toy[method] === "function" : true;
  }

  function readLocal(keys) {
    const result = {};
    keys.forEach((key) => {
      const value = storageGet(LOCAL_PREFIX + key);
      if (value !== null) result[key] = value;
    });
    return result;
  }

  function writeLocal(items) {
    Object.entries(items).forEach(([key, value]) => {
      storageSet(LOCAL_PREFIX + key, value);
    });
  }

  async function loadCloud(keys) {
    if (canUseToy("getCloudStorage")) {
      try {
        return await withTimeout(getToy().getCloudStorage(keys), "getCloudStorage");
      } catch (error) {
        console.warn("[ToyAdapter] cloud read fallback", error);
      }
    }
    return readLocal(keys);
  }

  async function saveCloud(items, { localOnly = false } = {}) {
    const stringItems = {};
    Object.keys(items).forEach((key) => {
      stringItems[key] = String(items[key]);
    });
    if (localOnly || !canUseToy("setCloudStorage")) {
      writeLocal(stringItems);
      return { storage: "local", localOnly };
    }
    if (canUseToy("setCloudStorage")) {
      try {
        const response = await withTimeout(getToy().setCloudStorage(stringItems), "setCloudStorage");
        if (isRateLimitedError(response)) {
          writeLocal(stringItems);
          console.warn("[ToyAdapter] cloud write rate limited", 307044);
          return { storage: "local", rateLimited: true, code: 307044 };
        }
        writeLocal(stringItems);
        return { storage: "cloud" };
      } catch (error) {
        writeLocal(stringItems);
        if (isRateLimitedError(error)) {
          console.warn("[ToyAdapter] cloud write rate limited", 307044);
          return { storage: "local", rateLimited: true, code: 307044 };
        }
        console.warn("[ToyAdapter] cloud write fallback", error);
      }
    }
    writeLocal(stringItems);
    return { storage: "local" };
  }

  async function submitScore({ board = 1, score }) {
    if (!Number.isInteger(score) || score <= 0) return { ok: false, reason: "invalid_score" };
    if (!canUseToy("submitScore")) {
      const key = `local_rank_board_${board}`;
      const best = Number(storageGet(LOCAL_PREFIX + key) || "0");
      if (score > best) storageSet(LOCAL_PREFIX + key, score);
      return { ok: false, reason: "local_only" };
    }
    await withTimeout(getToy().submitScore({ board, score }), "submitScore");
    return { ok: true };
  }

  async function loadMyRank({ board = 1, period = "all" } = {}) {
    if (!canUseToy("getMyRank")) {
      const localScore = Number(storageGet(LOCAL_PREFIX + `local_rank_board_${board}`) || "0");
      return localScore ? { ranked: true, rank: 1, score: localScore, local: true } : { ranked: false, local: true };
    }
    const mine = await withTimeout(getToy().getMyRank({ board, period }), "getMyRank");
    return { ...(mine || { ranked: false }), local: false };
  }

  async function loadRank({ board = 1, period = "all", limit = 50 } = {}) {
    if (!canUseToy("getRankList") || !canUseToy("getMyRank")) {
      const localScore = Number(storageGet(LOCAL_PREFIX + `local_rank_board_${board}`) || "0");
      return {
        entries: localScore
          ? [{ rank: 1, nickname: "本地试玩", avatar: "", score: localScore }]
          : [],
        mine: localScore ? { ranked: true, rank: 1, score: localScore } : { ranked: false },
        local: true,
      };
    }
    const [entries, mine] = await Promise.all([
      withTimeout(getToy().getRankList({ board, period, limit }), "getRankList"),
      withTimeout(getToy().getMyRank({ board, period }), "getMyRank"),
    ]);
    return { entries: Array.isArray(entries) ? entries : [], mine: mine || { ranked: false }, local: false };
  }

  function unwrapResult(value) {
    return value && typeof value === "object" && "value" in value ? value.value : value;
  }

  function toArrayPayload(value) {
    const raw = unwrapResult(value);
    const payload =
      raw?.items ||
      raw?.data?.items ||
      raw?.result?.items ||
      raw?.list ||
      raw?.data?.list ||
      raw?.data ||
      raw;
    return Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object"
        ? Object.values(payload)
        : [];
  }

  function findVideoAction(actions, aid, bvid) {
    const items = toArrayPayload(actions);
    return (
      items.find((item) => {
        const data = item?.data || item?.video || {};
        const itemAid = item?.aid ?? item?.id ?? data.aid ?? data.id;
        const itemBvid = item?.bvid ?? item?.bvId ?? data.bvid ?? data.bvId;
        return String(itemAid) === String(aid) || (itemBvid && String(itemBvid) === String(bvid));
      }) ||
      items.find((item) => String(item?.status || item?.data?.status || "").toLowerCase() === "ok") ||
      (items.length === 1 ? items[0] : null)
    );
  }

  function isPositiveAction(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") return !["", "0", "false", "none"].includes(value.toLowerCase());
    if (value && typeof value === "object") {
      return isPositiveAction(value.count ?? value.num ?? value.value ?? value.status ?? value.active);
    }
    return false;
  }

  function hasCoinAction(action) {
    if (!action) return false;
    const data = action.data || action.result || action.value || {};
    const nested =
      action.actions ||
      action.action ||
      action.userAction ||
      action.user_action ||
      data.actions ||
      data.action ||
      data.userAction ||
      data.user_action ||
      {};
    const sources = [action, data, nested];
    const keys = [
      "coin",
      "coins",
      "coined",
      "isCoined",
      "is_coined",
      "multiply",
      "coinCount",
      "coin_count",
      "coinNum",
      "coin_num",
      "hasCoin",
      "has_coin",
      "isCoin",
      "is_coin",
      "liked",
      "like",
      "isLiked",
      "is_liked",
      "favorited",
      "favourite",
      "favorite",
      "collect",
      "collected",
      "interacted",
      "hasInteracted",
      "has_interacted",
    ];
    return sources.some((source) => keys.some((key) => isPositiveAction(source?.[key])));
  }

  function hasFollowRelation(relation) {
    const raw = unwrapResult(relation);
    const payload = raw?.data || raw || {};
    const nested = payload.relation || payload.authorRelation || payload.author_relation || {};
    const direct =
      payload.isFollowing ??
      payload.is_following ??
      payload.isFollowed ??
      payload.is_followed ??
      payload.following ??
      payload.followed ??
      nested.isFollowing ??
      nested.is_following ??
      nested.isFollowed ??
      nested.is_followed ??
      nested.following ??
      nested.followed;
    if (direct !== undefined && direct !== null) return isPositiveAction(direct);
    const status = String(payload.status ?? nested.status ?? "").toLowerCase();
    if (["following", "followed", "follow", "1", "true"].includes(status)) return true;
    return Number(payload.attribute ?? nested.attribute ?? 0) > 0;
  }

  function bvToAid(bv) {
    const value = String(bv || "").trim();
    if (!/^BV[0-9A-Za-z]{10}$/.test(value)) return 0;
    // Keep this ES2017-compatible: the encoded value remains below
    // Number.MAX_SAFE_INTEGER, and arithmetic XOR avoids 32-bit operators.
    const alphabet = "FcwAPNKT M u g 3 G V 5 L j 7 E J n H p W s x 4 t b 8 h a Y e v i q B z 6 r k C y 1 2 m U S D Q X 9 R d o Z f".replace(/\s/g, "");
    const chars = value.split("");
    [chars[3], chars[9]] = [chars[9], chars[3]];
    [chars[4], chars[7]] = [chars[7], chars[4]];
    let encoded = 0;
    for (const char of chars.slice(3)) {
      const index = alphabet.indexOf(char);
      if (index < 0) return 0;
      encoded = encoded * 58 + index;
    }
    const masked = encoded % 2251799813685248;
    let left = masked;
    let right = 23442827791579;
    let bit = 1;
    let aid = 0;
    while (left > 0 || right > 0) {
      if (left % 2 !== right % 2) aid += bit;
      left = Math.floor(left / 2);
      right = Math.floor(right / 2);
      bit *= 2;
    }
    return aid;
  }

  function normalizeVideoConfig(config = {}) {
    const rawVideo = String(config.videoBv ?? config.videoId ?? DEFAULT_VIDEO_ID ?? "").trim();
    const videoBv = rawVideo.match(/BV[0-9A-Za-z]{10}/i)?.[0] || "";
    const rawAid = config.videoAid ?? config.aid ?? DEFAULT_AID;
    const explicitAid = rawAid === "" || rawAid === null || rawAid === undefined ? 0 : Number(rawAid) || 0;
    const videoAid = explicitAid || bvToAid(videoBv);
    return {
      videoBv,
      videoAid,
      hasVideoConfig: Boolean(videoBv || videoAid),
    };
  }

  async function refreshUnlocks(config = {}) {
    const authorMid = String(config.authorMid ?? DEFAULT_AUTHOR_MID).trim() || DEFAULT_AUTHOR_MID;
    const { videoBv, videoAid, hasVideoConfig } = normalizeVideoConfig(config);
    const state = {
      canReadLive: false,
      isFollowing: false,
      hasVideoInteract: false,
      relationStatus: "local",
      videoStatus: hasVideoConfig ? "local" : "missing_config",
      hasVideoConfig,
    };

    if (canUseToy("getAuthorRelation")) {
      try {
        let relation = null;
        let usedNoArgFallback = false;
        try {
          relation = await withTimeout(
            getToy().getAuthorRelation({ mid: authorMid, authorMid }),
            "getAuthorRelation",
          );
        } catch (withMidError) {
          usedNoArgFallback = true;
          relation = await withTimeout(getToy().getAuthorRelation(), "getAuthorRelation");
        }
        let isFollowing = hasFollowRelation(relation);
        if (!isFollowing && !usedNoArgFallback) {
          try {
            relation = await withTimeout(getToy().getAuthorRelation(), "getAuthorRelation");
            isFollowing = hasFollowRelation(relation);
          } catch (fallbackError) {
            // Some SDK versions only accept the MID form; keep the first response.
          }
        }
        state.canReadLive = true;
        state.relationStatus = "ok";
        state.isFollowing = isFollowing;
      } catch (error) {
        state.relationStatus = "error";
      }
    } else {
      state.isFollowing = storageGet(LOCAL_PREFIX + "debug_follow") === "1";
    }

    if (!hasVideoConfig) {
      state.videoStatus = "missing_config";
      state.hasVideoInteract = false;
    } else if (canUseToy("getVideoUserActions")) {
      try {
        const actions = await withTimeout(getToy().getVideoUserActions({ aids: [videoAid] }), "getVideoUserActions");
        state.canReadLive = true;
        state.videoStatus = "ok";
        const action = findVideoAction(actions, videoAid, videoBv);
        state.hasVideoInteract = hasCoinAction(action);
      } catch (error) {
        state.videoStatus = "error";
      }
    } else {
      state.hasVideoInteract = storageGet(LOCAL_PREFIX + "debug_coin") === "1";
    }

    return state;
  }

  async function navigateOrOpen(request, fallbackUrl) {
    if (canUseToy("navigate")) {
      try {
        await withTimeout(getToy().navigate(request), "navigate", 1600);
        return;
      } catch (error) {
        console.warn("[ToyAdapter] navigate fallback", error);
      }
    }
    const opened = window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(fallbackUrl);
  }

  function openAuthorSpace(config = {}) {
    const authorMid = config.authorMid || DEFAULT_AUTHOR_MID;
    return navigateOrOpen(
      { type: "space", id: String(authorMid) },
      `https://space.bilibili.com/${encodeURIComponent(authorMid)}`,
    );
  }

  function openTargetVideo(config = {}) {
    const { videoBv, videoAid, hasVideoConfig } = normalizeVideoConfig(config);
    if (!hasVideoConfig) return Promise.reject(new Error("target video is not configured"));
    const videoId = videoBv || String(videoAid);
    const fallbackUrl = videoBv
      ? `https://www.bilibili.com/video/${encodeURIComponent(videoBv)}`
      : `https://www.bilibili.com/video/av${encodeURIComponent(videoAid)}`;
    return navigateOrOpen(
      { type: "video", id: String(videoId) },
      fallbackUrl,
    );
  }

  function setDebugUnlock(type, value) {
    if (type === "follow") storageSet(LOCAL_PREFIX + "debug_follow", value ? "1" : "0");
    if (type === "coin") storageSet(LOCAL_PREFIX + "debug_coin", value ? "1" : "0");
  }

  window.JimidouToyAdapter = {
    canUseToy,
    isToyRuntime: isLikelyToyRuntime,
    loadCloud,
    saveCloud,
    submitScore,
    loadMyRank,
    loadRank,
    refreshUnlocks,
    openAuthorSpace,
    openTargetVideo,
    setDebugUnlock,
    bvToAid,
  };
})();
