var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
(function installPlayerSettings() {
  if (window.RoadKingSettings) return;
  var KEY = "drive-player-settings-v1";
  var FEATURES = ["invincible", "cruise", "speed", "drone", "autoReverse", "density", "motorcycles", "ramps", "rampInterval", "storm", "fog", "snow"];
  var WEATHER = ["storm", "fog", "snow"];
  var DEFAULTS = {
    "display.orientation": "portrait",
    "display.camera": "first",
    "display.controls": "wheel",
    "graphics.lighting": false,
    "vehicle": "sedan",
    "audio.bgmVolume": 50,
    "mods.target": 300,
    "mods.density": "normal",
    "mods.rampInterval": 1e3,
    "controlLayout.portrait": {},
    "controlLayout.landscape": {},
    "assistant.positions.portrait": null,
    "assistant.positions.landscape": null
  };
  FEATURES.forEach(function(k) {
    DEFAULTS["mods.on." + k] = false;
    DEFAULTS["unlocks." + k] = false;
  });
  var fields = {}, listeners = [], clock = 1;
  var writer = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  var storageState = { persistent: false, session: false, mode: "memory" };
  function own(o, k) {
    return Object.prototype.hasOwnProperty.call(o, k);
  }
  function object(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }
  function copy(v) {
    return JSON.parse(JSON.stringify(v));
  }
  function equal(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  function numeric(v, min, max) {
    if (typeof v !== "number" && !(typeof v === "string" && v.trim() !== "")) return void 0;
    var n = Number(v);
    return isFinite(n) ? Math.max(min, Math.min(max, n)) : void 0;
  }
  function normalize(k, v) {
    if (!own(DEFAULTS, k)) return void 0;
    var allowed = {
      "display.orientation": ["portrait", "landscape"],
      "display.camera": ["first", "third"],
      "display.controls": ["wheel", "buttons"],
      vehicle: ["sedan", "motorcycle", "truck", "jet"],
      "mods.density": ["empty", "sparse", "normal", "dense"]
    };
    if (allowed[k]) return allowed[k].indexOf(v) >= 0 ? v : void 0;
    if (k === "graphics.lighting") return typeof v === "boolean" ? v : void 0;
    if (k === "audio.bgmVolume") return numeric(v, 0, 100);
    if (k === "mods.target") return numeric(v, 0, 300);
    if (k === "mods.rampInterval") return numeric(v, 200, 2e3);
    if (k.indexOf("mods.on.") === 0 || k.indexOf("unlocks.") === 0) return typeof v === "boolean" ? v : void 0;
    if (k.indexOf("controlLayout.") === 0) {
      if (!object(v)) return void 0;
      var layout = {};
      Object.keys(v).forEach(function(id) {
        var p = v[id];
        if (!/^[a-z-]+$/.test(id) || !object(p) || typeof p.x !== "number" || typeof p.y !== "number" || typeof p.scale !== "number" || !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.scale)) return;
        layout[id] = { x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)), scale: Math.max(0.5, Math.min(1.8, p.scale)) };
      });
      return layout;
    }
    if (k.indexOf("assistant.positions.") === 0) {
      if (v === null) return null;
      if (!object(v) || typeof v.x !== "number" || typeof v.y !== "number" || !isFinite(v.x) || !isFinite(v.y)) return void 0;
      return { x: Math.max(0, Math.min(1, v.x)), y: Math.max(0, Math.min(1, v.y)) };
    }
  }
  function read(name, key) {
    try {
      return window[name].getItem(key);
    } catch (_) {
      return null;
    }
  }
  function parse(raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }
  function put(name, key, value2) {
    try {
      var s = window[name];
      s.setItem(key, value2);
      return s.getItem(key) === value2;
    } catch (_) {
      return false;
    }
  }
  function sectionOf(k) {
    return k.split(".")[0];
  }
  function merge(raw) {
    var doc = parse(raw), changed = [];
    if (!object(doc) || doc.version !== 1 || !object(doc.fields)) return changed;
    Object.keys(doc.fields).forEach(function(k) {
      var r = doc.fields[k];
      if (!object(r) || !own(DEFAULTS, k)) return;
      var v = normalize(k, r.v);
      if (v === void 0 || typeof r.t !== "number" || !isFinite(r.t) || r.t < 1 || r.t > Number.MAX_SAFE_INTEGER - 1e3 || Math.floor(r.t) !== r.t || typeof r.s !== "string" || r.s.length > 120) return;
      var old = fields[k];
      if (k.indexOf("unlocks.") === 0 && old && old.v === true && v !== true) return;
      if (!old || k.indexOf("unlocks.") === 0 && v === true && old.v !== true || r.t > old.t || r.t === old.t && r.s > old.s) {
        fields[k] = { v, t: r.t, s: r.s };
        clock = Math.max(clock, r.t);
        if (!old || !equal(old.v, v)) changed.push(sectionOf(k));
      }
    });
    return changed;
  }
  var deviceType = "unknown";
  function automaticLighting() {
    var nav = window.navigator || {}, ua = nav.userAgent || "";
    var root = document.documentElement, pc = root && root.getAttribute ? root.getAttribute("data-toy-pc") : null;
    var mobile = deviceType === "phone" || deviceType === "tablet" || pc === "false" || /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || /Macintosh/i.test(ua) && nav.maxTouchPoints > 1;
    if (!mobile && (deviceType === "desktop" || pc === "true" || /Windows NT|Macintosh|X11|CrOS|Linux/i.test(ua))) return true;
    return Number(nav.hardwareConcurrency) >= 8 && Number(nav.deviceMemory) >= 8;
  }
  function value(k) {
    return own(fields, k) ? copy(fields[k].v) : k === "graphics.lighting" ? automaticLighting() : copy(DEFAULTS[k]);
  }
  window.addEventListener("road-king-toy-container", function(e) {
    deviceType = e.detail && e.detail.deviceType || "unknown";
    if (!own(fields, "graphics.lighting")) emit(["graphics"], "device");
  });
  function snapshot() {
    var out = {
      graphics: { lighting: value("graphics.lighting") },
      display: { orientation: value("display.orientation"), camera: value("display.camera"), controls: value("display.controls") },
      controlLayout: { portrait: value("controlLayout.portrait"), landscape: value("controlLayout.landscape") },
      vehicle: value("vehicle"),
      audio: { bgmVolume: value("audio.bgmVolume") },
      mods: { on: {}, target: value("mods.target"), density: value("mods.density"), rampInterval: value("mods.rampInterval") },
      unlocks: {},
      assistant: { positions: {}, weather: [] }
    };
    FEATURES.forEach(function(k) {
      out.mods.on[k] = value("mods.on." + k);
      if (value("unlocks." + k) === true) out.unlocks[k] = true;
    });
    ["portrait", "landscape"].forEach(function(k) {
      var p = value("assistant.positions." + k);
      if (p) out.assistant.positions[k] = p;
    });
    out.assistant.weather = WEATHER.filter(function(k) {
      return out.mods.on[k] === true && out.unlocks[k] === true;
    });
    return out;
  }
  function emit(sections, reason) {
    if (!sections.length) return;
    var unique = sections.filter(function(k, i, a) {
      return a.indexOf(k) === i;
    });
    listeners.slice().forEach(function(fn) {
      try {
        fn({ sections: unique, reason });
      } catch (e) {
        if (window.console) window.console.error(e);
      }
    });
  }
  function mergeAvailable() {
    return merge(read("localStorage", KEY)).concat(merge(read("sessionStorage", KEY)));
  }
  function persist() {
    if (!Object.keys(fields).length) return;
    var json = JSON.stringify({ version: 1, fields });
    storageState.persistent = put("localStorage", KEY, json);
    storageState.session = put("sessionStorage", KEY, json);
    storageState.mode = storageState.persistent ? "persistent" : storageState.session ? "session" : "memory";
  }
  function mirror(sections) {
    var s = snapshot(), map = {
      display: ["drive-display-settings", JSON.stringify(s.display)],
      vehicle: ["drive-vehicle", s.vehicle],
      audio: ["drive-bgm-volume", String(s.audio.bgmVolume)],
      mods: ["drive-233-mod-runtime", JSON.stringify({ on: s.mods.on, target: s.mods.target, density: s.mods.density, rampInterval: s.mods.rampInterval })],
      unlocks: ["drive-233-ad-unlocked-v1", JSON.stringify(s.unlocks)],
      assistant: ["drive-233-assistant-position", JSON.stringify(s.assistant.positions)]
    };
    sections.filter(function(k, i, a) {
      return a.indexOf(k) === i;
    }).forEach(function(k) {
      if (!map[k]) return;
      ["localStorage", "sessionStorage"].forEach(function(n) {
        put(n, map[k][0], map[k][1]);
      });
    });
    if (sections.indexOf("mods") >= 0 || sections.indexOf("unlocks") >= 0) {
      ["localStorage", "sessionStorage"].forEach(function(n) {
        put(n, "drive-233-assistant-settings", JSON.stringify({ weather: s.assistant.weather }));
      });
    }
  }
  function flush() {
    var changed = mergeAvailable();
    persist();
    emit(changed, "external");
    return copy(storageState);
  }
  function commit(patch, reason) {
    var changed = mergeAvailable(), t = Math.max(Date.now(), clock + 1), touched = [];
    Object.keys(patch).forEach(function(k) {
      var v = normalize(k, patch[k]);
      if (v === void 0) return;
      if (fields[k] && equal(fields[k].v, v)) return;
      fields[k] = { v: copy(v), t, s: writer };
      clock = t;
      touched.push(sectionOf(k));
    });
    if (touched.length) {
      persist();
      mirror(touched);
    }
    emit(changed.concat(touched), reason || "selection");
    return snapshot();
  }
  function set(section, patch) {
    var p = {};
    if (section === "vehicle") p.vehicle = patch;
    else if (section === "display" && object(patch)) ["orientation", "camera", "controls"].forEach(function(k) {
      if (own(patch, k)) p["display." + k] = patch[k];
    });
    else if (section === "graphics" && object(patch) && own(patch, "lighting")) p["graphics.lighting"] = patch.lighting;
    else if (section === "audio" && object(patch) && own(patch, "bgmVolume")) p["audio.bgmVolume"] = patch.bgmVolume;
    else if (section === "controlLayout" && object(patch)) ["portrait", "landscape"].forEach(function(k) {
      if (own(patch, k)) p["controlLayout." + k] = patch[k];
    });
    else if (section === "mods" && object(patch)) {
      ["target", "density", "rampInterval"].forEach(function(k) {
        if (own(patch, k)) p["mods." + k] = patch[k];
      });
      if (object(patch.on)) FEATURES.forEach(function(k) {
        if (own(patch.on, k)) p["mods.on." + k] = patch.on[k];
      });
    } else if (section === "assistant" && object(patch) && object(patch.positions)) {
      ["portrait", "landscape"].forEach(function(k) {
        if (own(patch.positions, k)) p["assistant.positions." + k] = patch.positions[k];
      });
    }
    return commit(p, "selection");
  }
  function grantReward(feature, result) {
    if (FEATURES.indexOf(feature) < 0 || !result || result.success !== true || result.status !== 4 || result.mocked) return false;
    var p = {};
    p["unlocks." + feature] = true;
    p["mods.on." + feature] = true;
    commit(p, "reward");
    return true;
  }
  mergeAvailable();
  var legacy = {};
  function legacyField(k, v) {
    var n = normalize(k, v);
    if (n !== void 0) legacy[k] = n;
  }
  ["localStorage", "sessionStorage"].forEach(function(n) {
    var display = parse(read(n, "drive-display-settings"));
    if (object(display)) ["orientation", "camera", "controls"].forEach(function(k) {
      legacyField("display." + k, display[k]);
    });
    legacyField("vehicle", read(n, "drive-vehicle"));
    legacyField("audio.bgmVolume", read(n, "drive-bgm-volume"));
    var u = parse(read(n, "drive-233-ad-unlocked-v1"));
    if (object(u)) FEATURES.forEach(function(k) {
      if (u[k] === true) legacyField("unlocks." + k, true);
    });
    var m = parse(read(n, "drive-233-mod-runtime"));
    if (object(m)) {
      ["target", "density", "rampInterval"].forEach(function(k) {
        legacyField("mods." + k, m[k]);
      });
      if (object(m.on)) FEATURES.forEach(function(k) {
        legacyField("mods.on." + k, m.on[k]);
      });
    }
    var pos = parse(read(n, "drive-233-assistant-position"));
    if (object(pos)) ["portrait", "landscape"].forEach(function(k) {
      legacyField("assistant.positions." + k, pos[k]);
    });
  });
  ["localStorage", "sessionStorage"].forEach(function(n) {
    var w = parse(read(n, "drive-233-assistant-settings"));
    if (object(w) && Array.isArray(w.weather)) WEATHER.forEach(function(k) {
      if (!own(legacy, "mods.on." + k) && w.weather.indexOf(k) >= 0) legacyField("mods.on." + k, true);
    });
  });
  Object.keys(legacy).forEach(function(k) {
    if (!own(fields, k)) fields[k] = { v: legacy[k], t: 1, s: "legacy" };
  });
  if (Object.keys(fields).length) persist();
  window.RoadKingSettings = {
    version: 1,
    key: KEY,
    get: function(section) {
      var s = snapshot();
      return section ? copy(s[section]) : s;
    },
    set,
    grantReward,
    flush,
    status: function() {
      return copy(storageState);
    },
    subscribe: function(fn) {
      if (typeof fn !== "function") return function() {
      };
      listeners.push(fn);
      return function() {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    }
  };
  window.addEventListener("storage", function(e) {
    if (e.key === KEY) {
      var changed = merge(e.newValue).concat(mergeAvailable());
      persist();
      emit(changed, "external");
    }
  });
  window.addEventListener("pagehide", flush);
  window.addEventListener("pageshow", flush);
  window.addEventListener("game-home-restored", flush);
  document.addEventListener("visibilitychange", flush);
})();
(function install() {
  var root = document.documentElement;
  var gapProbe = document.createElement("div");
  gapProbe.style.cssText = "position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px;";
  gapProbe.appendChild(document.createElement("div"));
  gapProbe.appendChild(document.createElement("div"));
  document.body.appendChild(gapProbe);
  root.setAttribute("data-flex-gap", gapProbe.scrollHeight === 1 ? "true" : "false");
  gapProbe.remove();
  var settings = window.RoadKingSettings;
  function syncLighting() {
    var enabled = settings.get("graphics").lighting;
    root.setAttribute("data-lighting", enabled ? "on" : "off");
    document.querySelectorAll(".drive-preferences button").forEach(function(b) {
      if (b.hasAttribute("data-lighting")) b.setAttribute("aria-pressed", String(b.getAttribute("data-lighting") === (enabled ? "on" : "off")));
    });
  }
  syncLighting();
  var displayOptions = { orientation: ["portrait", "landscape"], camera: ["first", "third"], controls: ["wheel", "buttons"] };
  var displayValues = settings.get("display");
  var autoOrientation = window.RoadKingToyAutoOrientation && window.RoadKingToyAutoOrientation();
  if (autoOrientation) displayValues.orientation = autoOrientation;
  function syncDisplaySettings() {
    displayValues = settings.get("display");
    var autoOrientation2 = window.RoadKingToyAutoOrientation && window.RoadKingToyAutoOrientation();
    if (autoOrientation2) displayValues.orientation = autoOrientation2;
    Object.keys(displayValues).forEach(function(key) {
      root.setAttribute("data-" + key, displayValues[key]);
    });
    if (root.getAttribute("data-story-mode") === "story-3") root.setAttribute("data-camera", "third");
    var summary = document.getElementById("settings-summary");
    if (summary) summary.textContent = (displayValues.orientation === "landscape" ? "\u6A2A\u5C4F" : "\u7AD6\u5C4F") + " \xB7 " + (displayValues.camera === "third" ? "\u7B2C\u4E09\u4EBA\u79F0" : "\u7B2C\u4E00\u4EBA\u79F0") + " \xB7 " + (displayValues.controls === "buttons" ? "\u6309\u952E" : "\u65B9\u5411\u76D8");
    document.querySelectorAll(".drive-preferences button").forEach(function(button) {
      Object.keys(displayOptions).forEach(function(key) {
        if (button.hasAttribute("data-" + key)) button.setAttribute("aria-pressed", String(button.getAttribute("data-" + key) === displayValues[key]));
      });
    });
  }
  function saveDisplaySettings() {
    var value = Object.assign({}, displayValues);
    if (window.RoadKingToyAutoOrientation && window.RoadKingToyAutoOrientation()) value.orientation = settings.get("display").orientation;
    settings.set("display", value);
  }
  syncDisplaySettings();
  function setMusic(value) {
    root.setAttribute("data-bgm-volume", String(value));
    var slider = document.getElementById("bgm-volume"), output = document.getElementById("bgm-volume-value");
    if (slider) slider.value = String(value);
    if (output) output.textContent = String(value);
  }
  setMusic(settings.get("audio").bgmVolume);
  document.addEventListener("input", function(e) {
    if (e.target.id !== "bgm-volume") return;
    var value = Math.max(0, Math.min(100, Number(e.target.value)));
    settings.set("audio", { bgmVolume: value });
  });
  var settingsReturn, settingsKeyboard = false;
  function closeSettings() {
    var overlay = document.querySelector(".game-settings-overlay");
    if (!overlay) return;
    overlay.hidden = true;
    var menu = document.getElementById("mode-screen");
    if (menu) {
      menu.removeAttribute("aria-hidden");
      menu.inert = false;
    }
    if (settingsKeyboard && settingsReturn) settingsReturn.focus({ preventScroll: true });
  }
  document.addEventListener("click", function(e) {
    if (e.target.closest && e.target.closest(".game-settings-open")) {
      var overlay = document.querySelector(".game-settings-overlay");
      if (!overlay) return;
      settingsReturn = e.target.closest(".game-settings-open");
      settingsKeyboard = e.detail === 0;
      document.body.appendChild(overlay);
      overlay.hidden = false;
      var menu = document.getElementById("mode-screen");
      if (menu) {
        menu.setAttribute("aria-hidden", "true");
        menu.inert = true;
      }
      if (settingsKeyboard) overlay.querySelector("[data-settings-close]").focus({ preventScroll: true });
    } else if (e.target.closest && e.target.closest("[data-settings-close]") || e.target.classList.contains("game-settings-overlay")) closeSettings();
  });
  document.addEventListener("keydown", function(e) {
    var overlay = document.querySelector(".game-settings-overlay");
    if (!overlay || overlay.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeSettings();
    } else if (e.key === "Tab") {
      var items = overlay.querySelectorAll("button,input");
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
  });
  function fitHome(width, height, land) {
    var menu = document.getElementById("mode-screen"), content = menu && menu.querySelector(".mode-content");
    if (!content || getComputedStyle(menu).display === "none") return;
    var frame = menu.querySelector(".home-fit-frame");
    if (!frame) {
      frame = document.createElement("div");
      frame.className = "home-fit-frame";
      menu.insertBefore(frame, content);
      frame.appendChild(content);
    }
    var style = getComputedStyle(menu);
    var availableWidth = width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    var availableHeight = height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    var designWidth = land ? Math.max(640, Math.min(980, availableWidth)) : Math.max(320, Math.min(420, availableWidth));
    content.style.width = designWidth + "px";
    content.style.transform = "none";
    var scale = Math.max(0.1, Math.min(1, availableWidth / designWidth, availableHeight / content.offsetHeight));
    frame.style.width = designWidth * scale + "px";
    frame.style.height = content.offsetHeight * scale + "px";
    content.style.transform = "scale(" + scale + ")";
  }
  var timer;
  function apply() {
    var viewport = window.RoadKingToyViewport;
    var w = viewport ? viewport.width : root.clientWidth || window.innerWidth, h = viewport ? viewport.height : root.clientHeight || window.innerHeight;
    if (!(w > 0 && h > 0)) return;
    syncDisplaySettings();
    var land = root.getAttribute("data-orientation") === "landscape";
    var rotate = land ? w < h : w > h;
    var width = rotate ? h : w, height = rotate ? w : h;
    root.style.setProperty("--aux-portrait-top", Math.max(146, height * 0.25) + "px");
    root.setAttribute("data-rotated", rotate ? "true" : "false");
    root.setAttribute("data-menu-compact", height < 650 ? "true" : "false");
    root.setAttribute("data-menu-tight", height < (land ? 340 : 460) ? "true" : "false");
    root.style.setProperty("--screen-width", width + "px");
    root.style.setProperty("--screen-height", height + "px");
    document.body.style.width = width + "px";
    document.body.style.height = height + "px";
    document.body.style.setProperty("--app-height", height + "px");
    document.body.style.setProperty("--app-width", width + "px");
    document.body.style.transform = rotate ? "translateX(" + w + "px) rotate(90deg)" : "rotate(0deg)";
    fitHome(width, height, land);
    window.dispatchEvent(new Event("game-layout-change"));
  }
  document.addEventListener("click", function(e) {
    var b = e.target.closest && e.target.closest(".drive-preferences button");
    if (!b) return;
    var light = b.getAttribute("data-lighting");
    if (light === "on" || light === "off") {
      settings.set("graphics", { lighting: light === "on" });
      return;
    }
    var changed = false;
    Object.keys(displayOptions).forEach(function(key) {
      var value = b.getAttribute("data-" + key);
      if (displayOptions[key].indexOf(value) !== -1) {
        displayValues[key] = value;
        changed = true;
      }
    });
    if (!changed) return;
    saveDisplaySettings();
    syncDisplaySettings();
    var orientation = b.getAttribute("data-orientation");
    if (displayOptions.orientation.indexOf(orientation) !== -1) {
      apply();
      try {
        var o = window.screen.orientation;
        if (o && o.lock) {
          var p = o.lock(orientation);
          if (p && p.catch) p.catch(function() {
          });
        }
      } catch (_) {
      }
    }
  });
  window.addEventListener("resize", function() {
    clearTimeout(timer);
    timer = setTimeout(apply, 50);
  });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", function() {
    clearTimeout(timer);
    timer = setTimeout(apply, 50);
  });
  window.addEventListener("orientationchange", function() {
    apply();
    setTimeout(apply, 300);
  });
  function restoreHomeLayout() {
    closeSettings();
    syncLighting();
    syncDisplaySettings();
    setMusic(settings.get("audio").bgmVolume);
    settings.flush();
    apply();
  }
  settings.subscribe(function(change) {
    if (change.sections.indexOf("graphics") >= 0) {
      syncLighting();
      window.dispatchEvent(new Event("lighting-change"));
    }
    if (change.sections.indexOf("display") >= 0) {
      syncDisplaySettings();
      apply();
    }
    if (change.sections.indexOf("audio") >= 0) {
      setMusic(settings.get("audio").bgmVolume);
      window.dispatchEvent(new Event("bgm-volume-change"));
    }
  });
  window.addEventListener("game-home-restored", restoreHomeLayout);
  window.addEventListener("pageshow", function() {
    syncLighting();
    syncDisplaySettings();
    setMusic(settings.get("audio").bgmVolume);
    apply();
  });
  document.addEventListener("visibilitychange", function() {
    if (!document.hidden) apply();
  });
  if (window.ResizeObserver) {
    var sizeObserver = new ResizeObserver(function() {
      clearTimeout(timer);
      timer = setTimeout(apply, 50);
    });
    sizeObserver.observe(root);
  }
  apply();
})();
(function install2(jetEnabled = true) {
  var root = document.documentElement, names = { sedan: "\u8F7F\u8F66", motorcycle: "\u6469\u6258\u8F66", truck: "\u5927\u8FD0\u91CD\u5361", jet: "\u98DE\u5929\u4E00\u53F7" }, selected = "sedan", draft = "sedan", returnTo, keyboardOpen = false;
  var settings = window.RoadKingSettings;
  function vehicleChoice() {
    var id = settings.get("vehicle");
    return !jetEnabled && id === "jet" ? "sedan" : id;
  }
  selected = vehicleChoice();
  root.setAttribute("data-vehicle", selected);
  function updateHome() {
    selected = vehicleChoice();
    root.setAttribute("data-vehicle", root.getAttribute("data-story-mode") === "story-3" ? "motorcycle" : root.getAttribute("data-story-mode") === "story-1" ? "sedan" : selected);
    var name = document.querySelector(".home-vehicle strong");
    if (name) name.textContent = names[selected];
  }
  settings.subscribe(function(change) {
    if (change.sections.indexOf("vehicle") >= 0) updateHome();
  });
  window.addEventListener("game-home-restored", function() {
    close();
    updateHome();
    draft = selected;
    paint();
  });
  window.addEventListener("pageshow", updateHome);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateHome);
  else updateHome();
  function paint() {
    var host = document.getElementById("garage-render");
    if (host) host.setAttribute("data-vehicle", draft);
    window.dispatchEvent(new Event("garage-vehicle-changed"));
    document.querySelectorAll("[data-garage-car]").forEach(function(e) {
      e.hidden = e.getAttribute("data-garage-car") !== draft;
    });
    document.querySelectorAll("[data-choose-vehicle]").forEach(function(e) {
      e.setAttribute("aria-pressed", String(e.getAttribute("data-choose-vehicle") === draft));
    });
  }
  function close() {
    window.dispatchEvent(new Event("garage-closed"));
    var overlay = document.querySelector(".garage-overlay");
    if (overlay) overlay.hidden = true;
    var menu = document.getElementById("mode-screen");
    if (menu) {
      menu.inert = false;
      menu.removeAttribute("aria-hidden");
    }
    if (keyboardOpen && returnTo) returnTo.focus({ preventScroll: true });
  }
  document.addEventListener("click", function(e) {
    var t = e.target.closest && e.target.closest("button");
    if (t && t.classList.contains("garage-preview")) {
      var overlay = document.querySelector(".garage-overlay");
      document.body.appendChild(overlay);
      draft = selected;
      paint();
      returnTo = t;
      keyboardOpen = e.detail === 0;
      overlay.hidden = false;
      window.dispatchEvent(new Event("garage-opened"));
      var menu = document.getElementById("mode-screen");
      menu.inert = true;
      menu.setAttribute("aria-hidden", "true");
      if (keyboardOpen) overlay.querySelector("[data-garage-close]").focus({ preventScroll: true });
    } else if (t && t.hasAttribute("data-choose-vehicle")) {
      draft = t.getAttribute("data-choose-vehicle");
      paint();
    } else if (t && t.classList.contains("garage-confirm")) {
      settings.set("vehicle", draft);
      if (draft === "jet") settings.set("display", { camera: "third" });
      selected = vehicleChoice();
      root.setAttribute("data-vehicle", selected);
      updateHome();
      close();
    } else if (t && t.hasAttribute("data-garage-close") || e.target.classList.contains("garage-overlay")) close();
  });
  document.addEventListener("keydown", function(e) {
    var overlay = document.querySelector(".garage-overlay");
    if (!overlay || overlay.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (e.key === "Tab") {
      var items = overlay.querySelectorAll("button"), first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
  });
})(true);
(function install3(catalog) {
  if (window.RoadKingStory) return;
  var root = document.documentElement;
  var phase = "home", current = null, lastSelected = null;
  function node(id) {
    return document.getElementById(id);
  }
  function findStory(id) {
    for (var i = 0; i < catalog.length; i++) if (catalog[i].id === id) return catalog[i];
    return null;
  }
  function focus(element) {
    if (!element || !element.focus) return;
    try {
      element.focus({ preventScroll: true });
    } catch (_) {
      element.focus();
    }
  }
  function emit(name, detail) {
    var event;
    if (typeof window.CustomEvent === "function") event = new CustomEvent(name, { detail });
    else {
      event = document.createEvent("CustomEvent");
      event.initCustomEvent(name, false, false, detail);
    }
    window.dispatchEvent(event);
  }
  function lockHome(locked) {
    var home = node("mode-screen"), button = document.querySelector("[data-story-open]");
    if (home) {
      home.inert = locked;
      if (locked) home.setAttribute("aria-hidden", "true");
      else home.removeAttribute("aria-hidden");
    }
    if (button) button.setAttribute("aria-expanded", String(phase === "selection"));
  }
  function exitCurrent() {
    if (!current) return;
    var previous = current;
    current = null;
    emit("game-story-exited", { id: previous.id, title: previous.title });
  }
  function otherDialogOpen() {
    var settings = document.querySelector(".game-settings-overlay"), garage = document.querySelector(".garage-overlay");
    return settings && !settings.hidden || garage && !garage.hidden;
  }
  function openSelection() {
    if (!window.RoadKingToyStoryGate || !window.RoadKingToyStoryGate(function() {
      openSelection();
    })) return false;
    if (root.hasAttribute("data-game-mode") || otherDialogOpen()) return false;
    var overlay = node("story-selection"), scene = node("story-scene");
    if (!overlay || !scene) return false;
    exitCurrent();
    phase = "selection";
    root.removeAttribute("data-story-mode");
    scene.hidden = true;
    overlay.hidden = false;
    focus(lastSelected ? overlay.querySelector('[data-story-selection="' + lastSelected + '"]') : overlay.querySelector("[data-story-close]"));
    lockHome(true);
    return true;
  }
  function enter(id) {
    if (!window.RoadKingToyStoryGate || !window.RoadKingToyStoryGate(function() {
      enter(id);
    })) return false;
    var story = findStory(id), overlay = node("story-selection"), scene = node("story-scene");
    if (!story || phase !== "selection" || root.hasAttribute("data-game-mode") || !overlay || !scene) return false;
    current = story;
    lastSelected = story.id;
    phase = "story";
    node("story-scene-title").textContent = story.title;
    node("story-scene-number").textContent = story.number;
    root.setAttribute("data-story-mode", story.id);
    overlay.hidden = true;
    scene.hidden = false;
    focus(node("story-scene-title"));
    lockHome(true);
    emit("game-story-selected", { id: story.id, title: story.title, containerId: "story-scene-content" });
    return true;
  }
  function reset(restoreFocus) {
    if (phase === "home") return false;
    exitCurrent();
    phase = "home";
    var overlay = node("story-selection"), scene = node("story-scene");
    if (overlay) overlay.hidden = true;
    if (scene) scene.hidden = true;
    root.removeAttribute("data-story-mode");
    lockHome(false);
    if (restoreFocus) focus(document.querySelector("[data-story-open]"));
    return true;
  }
  function returnHome() {
    if (reset(true)) window.dispatchEvent(new Event("game-home-restored"));
  }
  document.addEventListener("click", function(e) {
    var target = e.target, button = target && target.closest && target.closest("button");
    if (button && button.hasAttribute("data-story-open")) openSelection();
    else if (button && button.hasAttribute("data-story-selection") && phase === "selection") enter(button.getAttribute("data-story-selection"));
    else if (button && button.hasAttribute("data-story-back") && phase === "story") openSelection();
    else if (button && (button.hasAttribute("data-story-close") || button.hasAttribute("data-story-home")) || target === node("story-selection") && phase === "selection") returnHome();
  });
  document.addEventListener("click", function(e) {
    if (phase === "home") return;
    var home = node("mode-screen");
    if (home && home.contains(e.target)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener("keydown", function(e) {
    if (phase === "home" || root.hasAttribute("data-game-mode")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (phase === "story") openSelection();
      else returnHome();
      return;
    }
    if (e.key !== "Tab") return;
    var host = phase === "story" ? node("story-scene") : node("story-selection");
    var buttons = host.querySelectorAll("button:not([disabled])");
    if (!buttons.length) return;
    var first = buttons[0], last = buttons[buttons.length - 1], active = document.activeElement;
    if (e.shiftKey && (active === first || !host.contains(active) || active.tagName !== "BUTTON")) {
      e.preventDefault();
      focus(last);
    } else if (!e.shiftKey && (active === last || !host.contains(active))) {
      e.preventDefault();
      focus(first);
    }
  });
  window.addEventListener("game-home-restored", function() {
    reset(false);
  });
  window.addEventListener("game-return-home", function() {
    reset(false);
  });
  window.addEventListener("game-mode-selected", function() {
    reset(false);
  });
  window.RoadKingStory = {
    openSelection,
    enter,
    returnHome,
    getState: function() {
      return { phase, storyId: current ? current.id : null };
    },
    list: function() {
      return catalog.map(function(story) {
        return { id: story.id, title: story.title };
      });
    }
  };
})([{ "id": "story-1", "title": "\u6211\u7D2F\u94DC\u6CE5\u4E38", "number": "01" }, { "id": "story-2", "title": "\u5361\u8F66\u7BC7", "number": "02" }, { "id": "story-3", "title": "\u6469\u6258\u8F66\u7BC7", "number": "03" }, { "id": "story-4", "title": "\u65E0\u4EBA\u673A\u7BC7", "number": "04" }]);
(function install4(configuredEndpoint, createNetwork2, createProfile2, createMatcher2) {
  const profile = createProfile2();
  const modal = document.getElementById("multiplayer-modal"), body = document.getElementById("multiplayer-body"), title = document.getElementById("multiplayer-title"), open = document.getElementById("multiplayer-open"), close = document.getElementById("multiplayer-close");
  if (!modal || !body || !open) return;
  const local = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  const endpoint = configuredEndpoint || (local ? "http://" + location.hostname + ":4196" : "");
  const status = modal.querySelector(".multiplayer-preview");
  const excludedRooms = [];
  let hostFailures = 0, kicking = false, matchPreparing = false, matchGeneration = 0, matchName = "", matchReady = null;
  let visibility = "private", paused = false, polling = false;
  let mode = "normal", vehicle = "free", speedLimit = 300, density = "normal", rampInterval = 1e3, previous = null, room = null, token = "", timer = null, busy = false, screenName = "choose", generation = 0, network = null, ack = 0, inGame = false, roomDetached = false;
  function connectionChanged() {
    if (network == null ? void 0 : network.hostEnded) {
      ended("\u623F\u4E3B\u5DF2\u79BB\u5F00\uFF0C\u623F\u95F4\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u521B\u5EFA\u6216\u52A0\u5165\u623F\u95F4\u3002");
      return;
    }
    updateWaiting();
  }
  function launch() {
    if (inGame || !network || !network.rules) return;
    inGame = true;
    window.roadKingMultiplayer = network;
    modal.hidden = true;
    document.documentElement.dataset.gameMode = room.mode;
    window.dispatchEvent(new Event("game-mode-selected"));
  }
  function ended(text) {
    if (inGame) {
      inGame = false;
      window.dispatchEvent(new Event("game-return-home"));
    }
    resetRoom();
    modal.hidden = false;
    screen("choose");
    message(text);
  }
  status.textContent = endpoint ? "\u5EFA\u8BAE\u6240\u6709\u4EBA\u90FD\u4F7F\u7528 Wi-Fi\uFF0C\u6216\u90FD\u4F7F\u7528\u624B\u673A\u6D41\u91CF\uFF1B\u8BF7\u52FF\u6DF7\u7528\u30022\u4EBA\u5373\u53EF\u5F00\u59CB\uFF0C\u6700\u591A3\u4EBA\u3002" : "\u8054\u673A\u670D\u52A1\u6B63\u5728\u51C6\u5907\uFF0C\u6682\u672A\u5F00\u653E";
  const intro = status.textContent;
  function fitPanel() {
    if (modal.hidden) return;
    const panel = modal.querySelector(".multiplayer-panel"), style = getComputedStyle(modal);
    const w = modal.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), h = modal.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const scale = Math.min(1, w / panel.offsetWidth, h / panel.offsetHeight);
    panel.style.transform = "scale(" + Math.max(0.1, scale) + ")";
  }
  window.addEventListener("game-layout-change", fitPanel);
  window.addEventListener("resize", fitPanel);
  function focus() {
    const el = body.querySelector("input,select,button:not(:disabled)");
    if (el) el.focus({ preventScroll: true });
  }
  function message(text) {
    let el = body.querySelector(".mp-error");
    if (!el) {
      el = document.createElement("p");
      el.className = "mp-error";
      el.setAttribute("role", "status");
      body.appendChild(el);
    }
    el.textContent = text;
    fitPanel();
  }
  function setBusy(value) {
    busy = value;
    close.disabled = value;
    body.querySelectorAll("button,input,select").forEach((el) => {
      if (!el.hasAttribute("data-permanent-disabled")) el.disabled = value;
    });
  }
  async function request(path, data, credential) {
    if (!endpoint) throw new Error("\u623F\u95F4\u670D\u52A1\u5C1A\u672A\u914D\u7F6E\uFF0C\u8BF7\u7B49\u5F85\u8054\u673A\u529F\u80FD\u5F00\u653E\u3002");
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8e3);
    try {
      const headers = {};
      if (data) headers["Content-Type"] = "application/json";
      if (credential) headers.Authorization = "Bearer " + credential;
      const response = await fetch(endpoint + path, { method: data ? "POST" : "GET", headers, body: data ? JSON.stringify(data) : void 0, signal: controller.signal, cache: "no-store", credentials: "omit" });
      const result = await response.json().catch(() => {
        if (response.ok) throw new Error("invalid response");
        return {};
      });
      if (!response.ok) {
        const error = new Error(result.error || (response.status === 429 ? "\u64CD\u4F5C\u592A\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002" : response.status >= 500 ? "\u623F\u95F4\u670D\u52A1\u7E41\u5FD9\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002" : "\u623F\u95F4\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002"));
        error.status = response.status;
        error.code = result.code;
        error.roomCode = result.roomCode;
        throw error;
      }
      return result;
    } catch (error) {
      if (error.status) throw error;
      throw new Error(error.message === "\u623F\u95F4\u670D\u52A1\u5C1A\u672A\u914D\u7F6E\uFF0C\u8BF7\u7B49\u5F85\u8054\u673A\u529F\u80FD\u5F00\u653E\u3002" ? error.message : "\u8FDE\u63A5\u5931\u8D25\uFF0C\u53EF\u80FD\u662F\u7F51\u7EDC\u5F02\u5E38\u6216\u670D\u52A1\u7E41\u5FD9\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
    } finally {
      clearTimeout(timeout);
    }
  }
  function avoid(code) {
    if (code && !excludedRooms.includes(code)) {
      excludedRooms.push(code);
      if (excludedRooms.length > 20) excludedRooms.shift();
    }
  }
  function joined(result, path, localName) {
    document.documentElement.dataset.multiplayerActive = "true";
    hostFailures = 0;
    token = result.token;
    room = result.room;
    room.localName = localName === profile.fallback ? void 0 : localName;
    if (path === "/rooms") room.localRules = { vehicle, speedLimit, density, rampInterval };
    generation++;
    const credential = token;
    network = createNetwork2(room, (path2, data) => request(path2, data, credential), connectionChanged);
    screen("waiting");
    schedule();
  }
  const matcher = createMatcher2({ search: async () => {
    const stamp = matchGeneration;
    await matchReady;
    if (stamp !== matchGeneration || !matcher.active) throw new Error("\u5339\u914D\u5DF2\u53D6\u6D88");
    return request("/match", { exclude: excludedRooms.slice() });
  }, release: (r) => request("/leave", {}, r.token).catch(() => {
  }), onTick: (seconds) => {
    const el = body.querySelector(".mp-match-seconds");
    if (el) el.textContent = String(seconds);
  }, onFound: (result) => joined(result, "/match", matchName), onEnd: (reason) => {
    screen("choose");
    if (reason !== "cancel") message(reason === "timeout" ? "\u5F53\u524D\u6682\u65E0\u53EF\u52A0\u5165\u7684\u623F\u95F4\uFF0C\u8BF7\u7A0D\u540E\u91CD\u65B0\u5339\u914D\u3002" : reason.message);
  } });
  function cancelMatching() {
    matchGeneration++;
    matchPreparing = false;
    matcher.cancel();
    if (screenName === "matching") screen("choose");
  }
  function startMatching() {
    if (matchPreparing || matcher.active || busy) return;
    const stamp = ++matchGeneration;
    matchPreparing = true;
    screen("matching");
    matchReady = (async () => {
      try {
        const name = await profile.resolve();
        if (typeof RTCPeerConnection === "undefined") throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u8054\u673A\u3002");
        const health = await request("/health");
        if (health.version < 4) throw new Error("\u5339\u914D\u670D\u52A1\u6B63\u5728\u5347\u7EA7\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002");
        if (stamp === matchGeneration) matchName = name;
      } finally {
        if (stamp === matchGeneration) matchPreparing = false;
      }
    })();
    matcher.start();
  }
  async function removeFailed() {
    var _a;
    if (kicking || !(network == null ? void 0 : network.isHost) || !room || room.started || paused) return;
    const failed = ((_a = network.failedPeers) == null ? void 0 : _a.call(network)) || [];
    if (!failed.length) return;
    kicking = true;
    const stamp = generation;
    try {
      for (const id of failed) {
        const result = await request("/kick", { target: id }, token);
        if (stamp !== generation) return;
        room = result.room;
        hostFailures = Math.min(3, hostFailures + 1);
        await network.update(room, []);
      }
      updateWaiting();
    } catch (error) {
    } finally {
      kicking = false;
    }
  }
  function screen(name, moveFocus = true) {
    screenName = name;
    status.textContent = name === "matching" ? "\u6D4B\u8BD5\uFF0C\u9700\u8981\u4F7F\u7528 Wi-Fi \u8FDE\u63A5\uFF0C\u623F\u4E3B\u9000\u51FA\u5219\u623F\u95F4\u89E3\u6563" : intro;
    title.textContent = name === "create" ? "\u521B\u5EFA\u623F\u95F4" : name === "join" ? "\u52A0\u5165\u623F\u95F4" : name === "waiting" ? "\u7B49\u5F85\u597D\u53CB" : name === "matching" ? "\u968F\u673A\u5339\u914D" : "\u8054\u673A\u6A21\u5F0F(\u6D4B\u8BD5)";
    modal.dataset.screen = name;
    if (name === "matching") body.innerHTML = '<div class="mp-matching"><p>\u6B63\u5728\u5BFB\u627E\u516C\u5F00\u623F\u95F4</p><div><strong class="mp-match-seconds">0</strong><span> \u79D2</span></div><p class="mp-sub">\u6700\u591A\u7B49\u5F85 60 \u79D2\uFF0C\u8BF7\u4FDD\u6301\u9875\u9762\u5728\u524D\u53F0</p></div><button class="mp-wide" data-mp="cancel-match">\u53D6\u6D88\u5339\u914D</button>';
    if (name === "choose") body.innerHTML = '<button class="mp-wide mp-primary" data-mp="create">\u521B\u5EFA\u623F\u95F4</button><button class="mp-wide" data-mp="join">\u52A0\u5165\u623F\u95F4</button><button class="mp-wide" data-mp="match">\u968F\u673A\u5339\u914D</button><p class="mp-sub mp-match-note">\u6D4B\u8BD5\uFF0C\u9700\u8981\u4F7F\u7528 Wi-Fi \u8FDE\u63A5\uFF0C\u623F\u4E3B\u9000\u51FA\u5219\u623F\u95F4\u89E3\u6563</p>';
    if (name === "create") body.innerHTML = '<div class="mp-settings"><label for="mp-mode">\u6E38\u620F\u6A21\u5F0F</label><select id="mp-mode"><option value="normal">\u6B63\u5E38\u6A21\u5F0F</option><option value="simulation">\u72C2\u66B4\u6A21\u5F0F</option></select><label for="mp-vehicle">\u4F7F\u7528\u8F66\u8F86</label><select id="mp-vehicle"><option value="sedan">\u8F7F\u8F66</option><option value="motorcycle">\u6469\u6258</option><option value="truck">\u5927\u8FD0</option><option value="free">\u81EA\u7531</option></select><label for="mp-density">\u8F66\u8F86\u5BC6\u96C6\u5EA6</label><select id="mp-density"><option value="empty">\u7A7A\u8DEF</option><option value="sparse">\u7A00\u758F</option><option value="normal">\u6B63\u5E38</option><option value="dense">\u5BC6\u96C6</option></select><label for="mp-speed">\u901F\u5EA6\u4E0A\u9650</label><div class="mp-speed-control"><output id="mp-speed-value">' + speedLimit + ' km/h</output><input id="mp-speed" type="range" min="0" max="500" step="1" value="' + speedLimit + '"><div class="mp-range-labels"><span>0</span><span>500 km/h</span></div></div><label for="mp-ramp-interval">\u659C\u5761\u8F66\u95F4\u9694</label><div class="mp-speed-control"><output id="mp-ramp-value">' + rampInterval + ' \u7C73</output><input id="mp-ramp-interval" type="range" min="200" max="2000" step="100" value="' + rampInterval + '"><div class="mp-range-labels"><span>200 \u7C73</span><span>2000 \u7C73</span></div></div></div><div class="mp-visibility"><span>\u623F\u95F4\u6743\u9650</span><div role="group" aria-label="\u623F\u95F4\u6743\u9650"><button type="button" data-mp="visibility-public">\u516C\u5F00<small>\u9700\u8981\u4F7F\u7528 Wi-Fi</small></button><button type="button" data-mp="visibility-private">\u79C1\u5BC6<small>\u4EC5\u901A\u8FC7\u623F\u95F4\u53F7\u52A0\u5165</small></button></div><p>\u516C\u5F00\u623F\u95F4\u4F1A\u6709\u5176\u4ED6\u73A9\u5BB6\u968F\u673A\u5339\u914D\u52A0\u5165</p></div><div class="mp-actions"><button data-mp="choose">\u8FD4\u56DE</button><button class="mp-primary" data-mp="confirm">\u786E\u8BA4\u521B\u5EFA</button></div>';
    if (name === "create") {
      body.querySelector("#mp-mode").value = mode;
      body.querySelector("#mp-vehicle").value = vehicle;
      body.querySelector("#mp-density").value = density;
      paintVisibility();
    }
    if (name === "join") body.innerHTML = '<form id="mp-join-form"><label for="mp-room-code">\u623F\u95F4\u53F7</label><input id="mp-room-code" name="room" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="\u8F93\u51656\u4F4D\u623F\u95F4\u53F7" aria-describedby="mp-error"><p id="mp-error" class="mp-error" role="status"></p><button type="submit" class="mp-wide mp-primary">\u52A0\u5165\u623F\u95F4</button></form><button class="mp-wide" data-mp="choose">\u8FD4\u56DE</button>';
    if (name === "waiting" && room) {
      body.innerHTML = '<div class="mp-room-heading"><span class="mp-sub">\u623F\u95F4\u53F7 \xB7 \u5206\u4EAB\u7ED9\u597D\u53CB</span><strong class="mp-code"></strong><p class="mp-count" aria-live="polite"></p><p class="mp-room-rules mp-sub"></p></div><div class="mp-slots"></div><p class="mp-wait-hint mp-sub">2\u4EBA\u8FDE\u63A5\u5C31\u7EEA\u5373\u53EF\u5F00\u59CB</p><div class="mp-actions"><button data-mp="leave">\u9000\u51FA\u623F\u95F4</button><button class="mp-primary" data-mp="start">\u7B49\u5F85\u8FDE\u63A5</button></div><p class="mp-error" role="status"></p>';
      body.querySelector(".mp-code").textContent = room.code;
      body.querySelector(".mp-room-heading .mp-sub").textContent = room.visibility === "public" ? "\u516C\u5F00\u623F\u95F4 \xB7 \u53EF\u968F\u673A\u52A0\u5165" : "\u79C1\u5BC6\u623F\u95F4 \xB7 \u5206\u4EAB\u7ED9\u597D\u53CB";
      updateWaiting();
    }
    fitPanel();
    if (moveFocus) focus();
  }
  function paintVisibility() {
    for (const value of ["public", "private"]) {
      const b = body.querySelector("[data-mp=visibility-" + value + "]");
      if (b) b.setAttribute("aria-pressed", String(visibility === value));
    }
  }
  function updateWaiting() {
    if (screenName !== "waiting" || !room) return;
    const start = body.querySelector("[data-mp=start]");
    if (start) {
      const owner = room.members.some((m) => m.id === room.selfId && m.host);
      start.disabled = busy || !owner || room.members.length < 2 || !room.members.every((m) => m.ready);
      start.textContent = !owner ? "\u7B49\u5F85\u623F\u4E3B\u5F00\u59CB" : room.members.length < 2 ? "\u7B49\u5F85\u4E00\u4F4D\u597D\u53CB\u52A0\u5165" : !room.members.every((m) => m.ready) ? "\u7B49\u5F85\u8FDE\u63A5\u5C31\u7EEA\u2026" : room.members.length + "\u4EBA\u5F00\u59CB\u6E38\u620F";
    }
    body.querySelector(".mp-count").textContent = (room.mode === "normal" ? "\u6B63\u5E38\u6A21\u5F0F" : "\u72C2\u66B4\u6A21\u5F0F") + " \xB7 " + room.members.length + " / 3\u4EBA" + (room.members.length === 3 ? " \xB7 \u5DF2\u6EE1\u623F" : room.members.length === 2 ? " \xB7 \u65E0\u9700\u7B49\u6EE13\u4EBA" : "");
    const rules = network == null ? void 0 : network.rules;
    body.querySelector(".mp-room-rules").textContent = rules ? { sedan: "\u8F7F\u8F66", motorcycle: "\u6469\u6258", truck: "\u5927\u8FD0", free: "\u81EA\u7531\u9009\u8F66" }[rules.vehicle] + " \xB7 \u9650\u901F " + rules.speedLimit + " km/h \xB7 \u8F66\u6D41" + ({ empty: "\u7A7A\u8DEF", sparse: "\u7A00\u758F", normal: "\u6B63\u5E38", dense: "\u5BC6\u96C6" }[rules.density] || "\u6B63\u5E38") + " \xB7 \u659C\u5761\u8F66 " + (rules.rampInterval || 1e3) + " \u7C73" : "\u6B63\u5728\u540C\u6B65\u623F\u95F4\u9009\u9879\u2026";
    const slots = body.querySelector(".mp-slots");
    slots.textContent = "";
    for (let i = 0; i < 3; i++) {
      const m = room.members[i], slot = document.createElement("div"), name = document.createElement("span"), role = document.createElement("small");
      slot.className = "mp-slot";
      name.textContent = m ? ((network == null ? void 0 : network.name(m.id)) || "\u73A9\u5BB6 " + (i + 1)) + (m.id === room.selfId ? "\uFF08\u4F60\uFF09" : "") : "\u7A7A\u4F4D";
      role.textContent = m ? (m.host ? "\u623F\u4E3B \xB7 " : "") + (m.id === room.selfId ? "\u4F60" : (network == null ? void 0 : network.status(m.id)) || "\u8FDE\u63A5\u4E2D\u2026") : "\u7B49\u5F85\u597D\u53CB\u52A0\u5165";
      slot.appendChild(name);
      slot.appendChild(role);
      slots.appendChild(slot);
    }
    let notice = body.querySelector(".mp-host-notice");
    if (!notice) {
      notice = document.createElement("p");
      notice.className = "mp-sub mp-host-notice";
      notice.setAttribute("role", "status");
      body.appendChild(notice);
    }
    notice.textContent = (network == null ? void 0 : network.isHost) && room.matchingPaused ? "\u8FDE\u7EED3\u4F4D\u73A9\u5BB6\u8FDE\u63A5\u5931\u8D25\uFF0C\u5DF2\u6682\u505C\u6B64\u623F\u95F4\u7684\u968F\u673A\u5339\u914D\u3002\u5EFA\u8BAE\u5207\u6362\u7F51\u7EDC\u540E\u91CD\u65B0\u521B\u5EFA\u623F\u95F4\u3002" : (network == null ? void 0 : network.isHost) && hostFailures ? hostFailures >= 3 ? "\u5DF2\u6709 3 \u4F4D\u73A9\u5BB6\u8FDE\u63A5\u5931\u8D25\uFF0C\u53EF\u80FD\u4E0E\u5F53\u524D\u7F51\u7EDC\u6709\u5173\uFF0C\u5EFA\u8BAE\u5207\u6362\u7F51\u7EDC\u540E\u91CD\u65B0\u521B\u5EFA\u623F\u95F4\u3002" : "\u4E0E\u8BE5\u73A9\u5BB6\u8FDE\u63A5\u5931\u8D25\uFF0C\u5DF2\u79FB\u51FA\uFF0C\u7B49\u5F85\u5176\u4ED6\u73A9\u5BB6\u52A0\u5165\u3002" : "";
    notice.hidden = !notice.textContent;
    fitPanel();
  }
  function resetRoom() {
    var _a;
    delete document.documentElement.dataset.multiplayerActive;
    hostFailures = 0;
    if (network == null ? void 0 : network.isHost) (_a = network.sendEffect) == null ? void 0 : _a.call(network, "host-left", 0);
    roomDetached = false;
    network == null ? void 0 : network.close();
    network = null;
    delete window.roadKingMultiplayer;
    ack = 0;
    generation++;
    clearTimeout(timer);
    timer = null;
    token = "";
    room = null;
  }
  function schedule() {
    clearTimeout(timer);
    if (paused) return;
    timer = setTimeout(poll, roomDetached ? 3e3 : inGame ? 15e3 : 800);
  }
  async function poll() {
    if (paused || polling) return;
    polling = true;
    try {
      await pollRoom();
    } finally {
      polling = false;
    }
  }
  async function pollRoom() {
    if (!token) return;
    if (roomDetached) {
      if (network == null ? void 0 : network.hasLivePeer()) schedule();
      else ended("\u597D\u53CB\u8FDE\u63A5\u5DF2\u65AD\u5F00\uFF0C\u8BF7\u91CD\u65B0\u521B\u5EFA\u6216\u52A0\u5165\u623F\u95F4\u3002");
      return;
    }
    const stamp = generation;
    try {
      const result = await request("/room?ack=" + ack, null, token);
      if (stamp !== generation) return;
      network == null ? void 0 : network.setRoomServiceStatus("\u623F\u95F4\u670D\u52A1\u6B63\u5E38");
      room = result.room;
      await (network == null ? void 0 : network.update(room, result.signals || []));
      if (stamp !== generation) return;
      for (const s of result.signals || []) ack = Math.max(ack, s.seq);
      await removeFailed();
      if (stamp !== generation) return;
      updateWaiting();
      message("");
      if (room.started) launch();
    } catch (error) {
      if (stamp !== generation) return;
      if (error.status === 410) {
        if (error.code === "P2P_FAILED") {
          avoid(error.roomCode || (room == null ? void 0 : room.code));
          ended("\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u5C1D\u8BD5\u5339\u914D\u3002\u5DF2\u907F\u5F00\u521A\u624D\u7684\u623F\u95F4\u3002");
          return;
        }
        if (inGame && (network == null ? void 0 : network.hasLivePeer())) {
          roomDetached = true;
          network.setRoomServiceStatus("\u623F\u95F4\u8BB0\u5F55\u5DF2\u5931\u6548\uFF0C\u7EE7\u7EED\u5DF2\u6709\u76F4\u8FDE\uFF1B\u7ED3\u675F\u540E\u8BF7\u91CD\u65B0\u521B\u623F");
        } else {
          ended(error.message);
          return;
        }
      } else {
        network == null ? void 0 : network.setRoomServiceStatus("\u623F\u95F4\u670D\u52A1\u6682\u65F6\u65AD\u5F00\uFF0C\u5DF2\u6709\u76F4\u8FDE\u7EE7\u7EED\uFF0C\u6B63\u5728\u91CD\u8BD5");
        message("\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u6B63\u5728\u91CD\u8BD5\u2026");
      }
    }
    if (stamp === generation) schedule();
  }
  async function enter(path, data) {
    if (busy) return;
    setBusy(true);
    message("\u6B63\u5728\u8FDE\u63A5\u2026");
    try {
      const localName = await profile.resolve();
      if (typeof RTCPeerConnection === "undefined") throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u8054\u673A\uFF0C\u8BF7\u6362\u7528\u652F\u6301 WebRTC \u7684\u6D4F\u89C8\u5668\u3002");
      const health = await request("/health");
      if ((path === "/match" || path === "/rooms" && visibility === "public") && health.version < 3) throw new Error("\u968F\u673A\u5339\u914D\u670D\u52A1\u6B63\u5728\u5347\u7EA7\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002");
      if (health.version < 2) throw new Error("\u670D\u52A1\u5668\u6B63\u5728\u5347\u7EA7\u8054\u673A\u529F\u80FD\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002");
      const result = await request(path, data);
      joined(result, path, localName);
    } catch (error) {
      message(error.message);
    } finally {
      setBusy(false);
      updateWaiting();
    }
  }
  async function leaveRoom() {
    if (busy) return false;
    if (!token) return true;
    setBusy(true);
    clearTimeout(timer);
    generation++;
    try {
      await request("/leave", {}, token);
      resetRoom();
      return true;
    } catch (error) {
      if (error.status === 410) {
        resetRoom();
        return true;
      }
      message("\u9000\u51FA\u672A\u6210\u529F\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u65AD\u5F00\u8FDE\u63A5\u540E\u623F\u95F4\u4F1A\u81EA\u52A8\u6E05\u7406\u3002");
      schedule();
      return false;
    } finally {
      setBusy(false);
      updateWaiting();
    }
  }
  async function hide() {
    cancelMatching();
    if (busy) return;
    if (!await leaveRoom()) return;
    modal.hidden = true;
    if (previous && previous.isConnected) previous.focus();
  }
  open.addEventListener("click", () => {
    previous = document.activeElement;
    modal.hidden = false;
    screen(room ? "waiting" : "choose");
  });
  close.addEventListener("click", hide);
  body.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-mp]");
    if (!b || busy) return;
    const action = b.dataset.mp;
    if (action === "cancel-match") {
      cancelMatching();
    } else if (action === "visibility-public" || action === "visibility-private") {
      visibility = action === "visibility-public" ? "public" : "private";
      paintVisibility();
    } else if (action === "match") {
      startMatching();
    } else if (action === "normal" || action === "simulation") {
      mode = action;
      body.querySelectorAll("[aria-pressed]").forEach((el) => el.setAttribute("aria-pressed", String(el.dataset.mp === mode)));
    } else if (action === "start") {
      setBusy(true);
      try {
        const r = await request("/start", {}, token);
        room = r.room;
        launch();
      } catch (error) {
        message(error.message);
      } finally {
        setBusy(false);
        updateWaiting();
      }
    } else if (action === "confirm") enter("/rooms", { mode, visibility });
    else if (action === "leave") {
      if (await leaveRoom()) screen("choose");
    } else screen(action);
  });
  body.addEventListener("change", (e) => {
    if (e.target.id === "mp-density") density = e.target.value;
    if (e.target.id === "mp-mode") mode = e.target.value;
    if (e.target.id === "mp-vehicle") vehicle = e.target.value;
  });
  body.addEventListener("input", (e) => {
    if (e.target.id === "mp-ramp-interval") {
      rampInterval = Number(e.target.value);
      body.querySelector("#mp-ramp-value").textContent = rampInterval + " \u7C73";
    }
    if (e.target.id === "mp-speed") {
      speedLimit = Number(e.target.value);
      body.querySelector("#mp-speed-value").textContent = speedLimit + " km/h";
    }
    if (e.target.id === "mp-room-code") e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
  });
  body.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;
    const code = body.querySelector("input").value;
    if (!/^[0-9]{6}$/.test(code)) {
      message("\u8BF7\u8F93\u51656\u4F4D\u6570\u5B57\u623F\u95F4\u53F7\u3002");
      return;
    }
    enter("/join", { code });
  });
  modal.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      hide();
    }
    if (e.key === "Tab") {
      const list = Array.from(modal.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled)"));
      const first = list[0], last = list[list.length - 1];
      if (!first) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  function pauseRoom() {
    cancelMatching();
    paused = true;
    clearTimeout(timer);
    if (token && endpoint) fetch(endpoint + "/presence", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: '{"hidden":true}', keepalive: true }).catch(() => {
    });
  }
  function resumeRoom() {
    paused = false;
    if (token) {
      clearTimeout(timer);
      poll();
    }
  }
  window.addEventListener("pagehide", pauseRoom);
  window.addEventListener("pageshow", resumeRoom);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseRoom();
    else resumeRoom();
  });
  window.addEventListener("game-mode-selected", () => {
    if (!inGame) hide();
  });
  window.addEventListener("game-return-home", () => {
    if (!inGame) return;
    inGame = false;
    const old = token;
    resetRoom();
    if (old) request("/leave", {}, old).catch(() => {
    });
  });
})("https://room.vvclh.com", function createNetwork(initialRoom, request, onChange) {
  let room = initialRoom, closed = false, lastLinks = "", sequence = 0;
  const attempts = /* @__PURE__ */ new Map();
  const peers = /* @__PURE__ */ new Map(), snapshots = /* @__PURE__ */ new Map(), names = /* @__PURE__ */ new Map(), effects = /* @__PURE__ */ new Map(), effectSeen = /* @__PURE__ */ new Map();
  const effectEvents = [];
  let effectSequence = 0, hostEnded = false;
  let world = null, worldSequence = 0, hitSequence = 0;
  const trafficHits = [], lastHit = /* @__PURE__ */ new Map();
  let tx = 0, rx = 0, sentMessages = 0, receivedMessages = 0, lastState = null, lastSend = 0, roomServiceStatus = "\u623F\u95F4\u670D\u52A1\u6B63\u5E38";
  function transmit(p, json) {
    var _a;
    if (((_a = p.channel) == null ? void 0 : _a.readyState) !== "open" || p.channel.bufferedAmount >= 16384) return;
    try {
      p.channel.send(json);
      tx += json.length;
      sentMessages++;
    } catch (e) {
    }
  }
  function publish(vehicle, values) {
    const item = [self, ++sequence, vehicle, ...values, performance.now()];
    for (const p of peers.values()) transmit(p, JSON.stringify([p.poseTime ? item : item.slice(0, 11)]));
    lastSend = performance.now();
  }
  const heartbeat = setInterval(() => {
    if (!closed && lastState && performance.now() - lastSend > 500) {
      const values = lastState.values.slice();
      values[6] = 0;
      values[7] = values[7] & 3 | (typeof document !== "undefined" && document.hidden ? 4 : 0);
      publish(lastState.vehicle, values);
    }
  }, 500);
  const self = room.selfId, host = room.members.find((m) => m.host).id, isHost = self === host;
  let rules = isHost ? __spreadValues({ vehicle: "free", speedLimit: 300, density: "normal", rampInterval: 1e3 }, initialRoom.localRules) : null;
  const rulesAck = /* @__PURE__ */ new Set();
  function sendRules(p) {
    if (isHost) transmit(p, JSON.stringify(__spreadValues({ type: "room-rules" }, rules)));
  }
  const guestName = (id) => "\u7528\u6237" + String((parseInt(id.slice(0, 6), 16) || 0) % 9e5 + 1e5);
  names.set(self, initialRoom.localName || guestName(self));
  function sendNames(p) {
    transmit(p, JSON.stringify({ type: "profiles", poseTime: true, items: [...names] }));
  }
  function notify() {
    if (!closed) onChange();
  }
  function channelFor(id, channel, peer) {
    peer.channel = channel;
    channel.onopen = () => {
      clearTimeout(peer.timer);
      peer.stage = "\u8FDE\u63A5\u5B8C\u6210";
      sendNames(peer);
      sendRules(peer);
      notify();
    };
    channel.onclose = () => {
      snapshots.delete(id);
      if (!closed && peers.get(id) === peer && !peer.failure && !room.started) {
        fail(peer, { name: "ChannelClosed" });
        return;
      }
      notify();
    };
    channel.onerror = notify;
    channel.onmessage = (event) => {
      var _a, _b;
      if (closed || typeof event.data !== "string" || event.data.length > 24576) return;
      rx += event.data.length;
      receivedMessages++;
      let packet;
      try {
        packet = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if ((packet == null ? void 0 : packet.type) === "room-rules") {
        if (isHost || id !== host || !["free", "sedan", "motorcycle", "truck"].includes(packet.vehicle) || !Number.isInteger(packet.speedLimit) || packet.speedLimit < 0 || packet.speedLimit > 500) return;
        if (!["empty", "sparse", "normal", "dense"].includes(packet.density) || !Number.isInteger(packet.rampInterval) || packet.rampInterval < 200 || packet.rampInterval > 2e3) return;
        rules = { vehicle: packet.vehicle, speedLimit: packet.speedLimit, density: packet.density, rampInterval: packet.rampInterval };
        transmit(peer, JSON.stringify(__spreadValues({ type: "room-rules-ack" }, rules)));
        notify();
        return;
      }
      if ((packet == null ? void 0 : packet.type) === "room-rules-ack") {
        if (isHost && packet.vehicle === rules.vehicle && packet.speedLimit === rules.speedLimit && packet.density === rules.density && packet.rampInterval === rules.rampInterval) {
          rulesAck.add(id);
          notify();
        }
        return;
      }
      if ((packet == null ? void 0 : packet.type) === "effect") {
        const { sender, seq, kind, value } = packet;
        if (sender === self || !room.members.some((m) => m.id === sender) || isHost && sender !== id || !isHost && id !== host || !Number.isSafeInteger(seq)) return;
        const valid = kind === "lights" ? Array.isArray(value) && [3, 4].includes(value.length) && (value.length === 3 || [0, 1].includes(value[3])) && value.every(Number.isFinite) && value[0] >= 0 && value[0] <= 1 && [-1, 0, 1].includes(value[1]) && [0, 1].includes(value[2]) : kind === "horn" ? value === 0 : kind === "emote" ? ["\u{1F602}", "\u{1F44D}", "\u6211\u7D2F\u94DC\u6CE5\u4E38\uFF01"].includes(value) : kind === "host-left" ? sender === host && value === 0 : false;
        const key = sender + ":" + kind;
        if (!valid || seq <= (effectSeen.get(key) || 0)) return;
        effectSeen.set(key, seq);
        if (kind === "host-left") {
          hostEnded = true;
          notify();
          return;
        }
        if (kind === "lights") effects.set(sender, { value, at: performance.now() });
        else if (effectEvents.length < 16) effectEvents.push({ sender, kind, value, at: performance.now() });
        if (isHost) {
          for (const [other, p] of peers) if (other !== id) transmit(p, JSON.stringify(packet));
        }
        return;
      }
      if ((packet == null ? void 0 : packet.type) === "world") {
        if (isHost || id !== host || !Number.isSafeInteger(packet.seq) || packet.seq <= ((world == null ? void 0 : world.seq) || 0)) return;
        if (!Array.isArray(packet.rows) || packet.rows.length > 64 || !packet.rows.every((row) => row === null || Array.isArray(row) && row.length === 18 && row.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e8) && [0, 1].includes(row[0]) && [0, 1].includes(row[17]) && Math.abs(row[1]) <= 2e4 && Math.abs(row[3]) <= 1e3 && Math.abs(row[4]) <= 500 && Math.abs(row[5]) <= 500 && Number.isSafeInteger(row[16]))) return;
        if (!Array.isArray(packet.junction) || packet.junction.length !== 3 || !packet.junction.every(Number.isFinite) || Math.abs(packet.junction[0]) > 1e8 || ![0, 1, 2].includes(packet.junction[1]) || packet.junction[2] < 0 || packet.junction[2] > 60) return;
        world = { seq: packet.seq, rows: packet.rows, junction: packet.junction, at: performance.now(), sourceAt: Number.isFinite(packet.sourceAt) && packet.sourceAt >= 0 ? packet.sourceAt : void 0 };
        return;
      }
      if ((packet == null ? void 0 : packet.type) === "traffic-hit") {
        if (!isHost || !room.members.some((m) => m.id === id) || !Number.isSafeInteger(packet.seq) || packet.seq <= (lastHit.get(id) || 0)) return;
        if (!Number.isInteger(packet.index) || packet.index < 0 || packet.index >= 64 || !Array.isArray(packet.values) || packet.values.length !== 8 || !packet.values.every((n) => Number.isFinite(n) && Math.abs(n) < 1e8)) return;
        lastHit.set(id, packet.seq);
        if (trafficHits.length < 32) trafficHits.push(__spreadProps(__spreadValues({}, packet), { sender: id }));
        return;
      }
      if ((packet == null ? void 0 : packet.type) === "profiles") {
        if (!Array.isArray(packet.items) || packet.items.length > 3) return;
        peer.poseTime = packet.poseTime === true;
        for (const row of packet.items) {
          if (!Array.isArray(row) || row.length !== 2) continue;
          const [sender, label] = row;
          if (sender === self || !room.members.some((m) => m.id === sender) || isHost && sender !== id || typeof label !== "string") continue;
          const name = Array.from(label.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").trim()).slice(0, 16).join("");
          if (name) names.set(sender, name);
        }
        if (isHost) for (const p of peers.values()) sendNames(p);
        notify();
        return;
      }
      if (!Array.isArray(packet) || packet.length > 3) return;
      for (const item of packet) {
        if (!Array.isArray(item) || ![11, 12].includes(item.length)) continue;
        const [sender, seq, vehicle] = item, values = item.slice(3, 11), sourceAt = item.length === 12 ? item[11] : void 0;
        if (sourceAt !== void 0 && (!Number.isFinite(sourceAt) || sourceAt < 0)) continue;
        if (sender === self || !room.members.some((m) => m.id === sender) || isHost && sender !== id) continue;
        if (!Number.isSafeInteger(seq) || !["sedan", "motorcycle", "truck"].includes(vehicle) || !values.every(Number.isFinite)) continue;
        if (Math.abs(values[0]) > 1e8 || Math.abs(values[1]) > 200 || Math.abs(values[2]) > 200 || values.slice(3, 6).some((n) => Math.abs(n) > 1e3) || Math.abs(values[6]) > 1e4 || !Number.isInteger(values[7]) || values[7] < 0 || values[7] > 7) continue;
        const old = snapshots.get(sender);
        if (old && seq <= old.seq) continue;
        const at = performance.now(), history = (old == null ? void 0 : old.vehicle) === vehicle ? old.history || [{ at: old.at, values: old.values }] : [];
        if (history.length && (at - history[history.length - 1].at > 1e3 || Math.abs(values[0] - history[history.length - 1].values[0]) > 80)) history.length = 0;
        if (sourceAt !== void 0 && history.length && sourceAt <= ((_a = history[history.length - 1].sourceAt) != null ? _a : -1)) continue;
        history.push({ at, values, sourceAt });
        while (history.length > 24) history.shift();
        snapshots.set(sender, { seq, vehicle, values, at, history });
        if (isHost) {
          for (const [other, p] of peers) if (other !== id && ((_b = p.channel) == null ? void 0 : _b.readyState) === "open" && p.channel.bufferedAmount < 16384) transmit(p, JSON.stringify([p.poseTime ? item : item.slice(0, 11)]));
        }
      }
    };
  }
  function counts(sdp) {
    var _a;
    const result = { host: 0, srflx: 0, relay: 0 };
    for (const line of (sdp || "").split(/\r?\n/)) {
      if (!line.startsWith("a=candidate:")) continue;
      const type = (_a = line.match(/ typ (host|srflx|relay)(?: |$)/)) == null ? void 0 : _a[1];
      if (type) result[type]++;
    }
    return result;
  }
  function tagged(sdp, round) {
    return sdp.startsWith("v=0") ? sdp.replace(/^(v=0[^\n]*\n)/, "$1a=x-roadking-round:" + round + "\r\n") : sdp;
  }
  function roundOf(sdp) {
    var _a;
    return ((_a = sdp.match(/^a=x-roadking-round:([0-9]+)\r?$/m)) == null ? void 0 : _a[1]) || "";
  }
  function cleanSdp(sdp) {
    return sdp.replace(/^a=x-roadking-round:[^\n]*\n/gm, "");
  }
  function current(p) {
    return !closed && peers.get(p.id) === p && !p.failure;
  }
  function retire(p) {
    var _a;
    clearTimeout(p.timer);
    clearTimeout(p.disconnectTimer);
    clearTimeout(p.extraTimer);
    (_a = p.cancelGather) == null ? void 0 : _a.call(p);
    p.pc.close();
  }
  async function candidates(p, sdp) {
    let index = -1, mid = null;
    const list = [];
    for (const line of cleanSdp(sdp).split(/\r?\n/)) {
      if (line.startsWith("m=")) {
        index++;
        mid = null;
      }
      if (line.startsWith("a=mid:")) mid = line.slice(6);
      if (line.startsWith("a=candidate:")) list.push({ candidate: line.slice(2), sdpMLineIndex: Math.max(0, index), sdpMid: mid });
    }
    for (const c of list) {
      if (!current(p)) return;
      const key = c.sdpMLineIndex + ":" + c.candidate;
      if (p.remoteCandidates.has(key)) continue;
      await p.pc.addIceCandidate(c);
      p.remoteCandidates.add(key);
    }
    p.remote = counts(sdp);
    notify();
  }
  function sendDescription(p) {
    p.sendQueue = p.sendQueue.catch(() => {
    }).then(async () => {
      var _a;
      if (!current(p)) return;
      const raw = (_a = p.pc.localDescription) == null ? void 0 : _a.sdp;
      if (!raw || raw === p.sentSdp) return;
      await request("/signal", { target: p.id, type: isHost ? "offer" : "answer", sdp: tagged(raw, p.round) });
      if (!current(p)) return;
      p.sentSdp = raw;
      p.local = counts(raw);
      p.signalSent = true;
      notify();
    });
    return p.sendQueue;
  }
  function supplement(p) {
    if (!current(p) || !p.signalSent || p.extraCount >= 8) return;
    clearTimeout(p.extraTimer);
    p.extraTimer = setTimeout(() => {
      if (!current(p)) return;
      p.extraCount++;
      sendDescription(p).catch((e) => {
        if (current(p)) {
          p.extraError = (e == null ? void 0 : e.name) || "Error";
          notify();
        }
      });
    }, 200);
  }
  function fail(p, error) {
    if (closed || p.failure) return;
    p.failure = p.stage;
    p.error = (error == null ? void 0 : error.name) || "Error";
    p.status = "failed";
    p.retryAt = performance.now() + 1500;
    retire(p);
    notify();
  }
  function make(id, round) {
    const pc = new RTCPeerConnection({ iceServers: room.iceServers || [] });
    const peer = { id, round, sendQueue: Promise.resolve(), remoteCandidates: /* @__PURE__ */ new Set(), extraCount: 0, signalSent: false, pc, channel: null, status: "\u8FDE\u63A5\u4E2D", stage: "\u521D\u59CB\u5316", local: { host: 0, srflx: 0, relay: 0 }, remote: { host: 0, srflx: 0, relay: 0 }, ice: "new", gather: "new", stunError: "" };
    peers.set(id, peer);
    pc.onconnectionstatechange = () => {
      if (closed || peers.get(id) !== peer || peer.failure) return;
      peer.status = pc.connectionState;
      if (!room.started && ["failed", "closed"].includes(peer.status)) {
        fail(peer, { name: "ConnectionFailed" });
        return;
      }
      if (peer.status === "disconnected" && !room.started && !peer.disconnectTimer) {
        peer.disconnectTimer = setTimeout(() => {
          peer.disconnectTimer = null;
          if (!closed && !room.started && peers.get(id) === peer && peer.status === "disconnected") fail(peer, { name: "DisconnectedTimeout" });
        }, 45e3);
      } else if (peer.status === "connected") {
        clearTimeout(peer.disconnectTimer);
        peer.disconnectTimer = null;
      }
      notify();
    };
    pc.oniceconnectionstatechange = () => {
      if (peers.get(id) !== peer || closed) return;
      peer.ice = pc.iceConnectionState;
      if (peer.ice === "failed" && !peer.failure) {
        fail(peer, { name: "ICEFailed" });
        return;
      }
      notify();
    };
    pc.onicecandidate = () => supplement(peer);
    pc.onicegatheringstatechange = () => {
      peer.gather = pc.iceGatheringState;
      supplement(peer);
      notify();
    };
    pc.onicecandidateerror = (e) => {
      peer.stunError = String(e.errorCode || "\u672A\u77E5");
      notify();
    };
    pc.ondatachannel = (e) => channelFor(id, e.channel, peer);
    peer.timer = setTimeout(() => {
      var _a;
      if (!closed && ((_a = peer.channel) == null ? void 0 : _a.readyState) !== "open") fail(peer, { name: "Timeout" });
    }, 45e3);
    return peer;
  }
  async function description(p) {
    const pc = p.pc;
    p.stage = "\u5BFB\u627E\u53EF\u7528\u5730\u5740";
    notify();
    if (!current(p)) throw new Error("\u8FDE\u63A5\u5DF2\u5173\u95ED");
    p.gather = pc.iceGatheringState;
    p.local = counts(pc.localDescription.sdp);
    return pc.localDescription.sdp;
  }
  async function offer(id) {
    let p;
    try {
      const round = (attempts.get(id) || 0) + 1;
      attempts.set(id, round);
      const old = peers.get(id);
      if (old) retire(old);
      p = make(id, String(round));
      p.stage = "\u521B\u5EFA\u8FDE\u63A5\u9080\u8BF7";
      channelFor(id, p.pc.createDataChannel("cars", { ordered: false, maxRetransmits: 0 }), p);
      await p.pc.setLocalDescription(await p.pc.createOffer());
      const sdp = await description(p);
      p.stage = "\u53D1\u9001\u8FDE\u63A5\u9080\u8BF7";
      notify();
      await sendDescription(p);
      if (current(p)) {
        p.stage = "\u7B49\u5F85\u597D\u53CB\u5E94\u7B54";
        supplement(p);
        notify();
      }
    } catch (error) {
      if (p) fail(p, error);
      else {
        peers.set(id, { pc: { close() {
        } }, stage: "\u521D\u59CB\u5316", failure: "\u521D\u59CB\u5316", error: (error == null ? void 0 : error.name) || "Error", status: "failed", retryAt: performance.now() + 1500 });
        notify();
      }
    }
  }
  return {
    self,
    host,
    isHost,
    snapshots,
    effects,
    get rules() {
      return rules;
    },
    get hostEnded() {
      return hostEnded;
    },
    takeEffects() {
      return effectEvents.splice(0);
    },
    sendEffect(kind, value) {
      if (closed) return;
      const json = JSON.stringify({ type: "effect", sender: self, seq: ++effectSequence, kind, value });
      for (const p of peers.values()) {
        transmit(p, json);
        if (kind !== "lights") for (const delay of [100, 250]) setTimeout(() => {
          if (!closed) transmit(p, json);
        }, delay);
      }
    },
    get world() {
      return world;
    },
    takeTrafficHits() {
      return trafficHits.splice(0);
    },
    sendWorld(rows, junction, junctions = [junction]) {
      var _a;
      if (closed || !isHost) return;
      const seq = ++worldSequence;
      for (const [id, p] of peers) {
        const d = (_a = snapshots.get(id)) == null ? void 0 : _a.values[0];
        const localJunction = Number.isFinite(d) ? junctions.slice().sort((a, b) => Math.abs(a[0] - d) - Math.abs(b[0] - d))[0] : junction;
        const nearby = Number.isFinite(d) ? rows.map((r) => Math.abs(r[2] - d) < 1e3 ? r : null) : rows;
        transmit(p, JSON.stringify({ type: "world", seq, rows: nearby, junction: localJunction, sourceAt: performance.now() }));
      }
    },
    sendTrafficHit(index, values) {
      if (closed || isHost) return;
      const p = peers.get(host);
      if (!p) return;
      const json = JSON.stringify({ type: "traffic-hit", seq: ++hitSequence, index, values });
      transmit(p, json);
      for (const delay of [100, 250]) setTimeout(() => {
        if (!closed) transmit(p, json);
      }, delay);
    },
    name(id) {
      return names.get(id) || guestName(id);
    },
    get room() {
      return room;
    },
    setRoomServiceStatus(value) {
      roomServiceStatus = value;
    },
    hasLivePeer() {
      const now = performance.now();
      return [...peers].some(([id, p]) => {
        var _a;
        return ((_a = p.channel) == null ? void 0 : _a.readyState) === "open" && (isHost || id === host) && snapshots.has(id) && now - snapshots.get(id).at < 15e3;
      });
    },
    failedPeers() {
      return room.started ? [] : [...peers].filter(([id, p]) => p.failure && (attempts.get(id) || 0) >= 1).map(([id]) => id);
    },
    connected() {
      return [...peers].filter(([, p]) => {
        var _a;
        return ((_a = p.channel) == null ? void 0 : _a.readyState) === "open" && !p.failure && !["disconnected", "failed", "closed"].includes(p.status);
      }).map(([id]) => id);
    },
    status(id) {
      var _a;
      const p = peers.get(id);
      return (p == null ? void 0 : p.failure) ? "\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u5207\u6362\u7F51\u7EDC\u5C1D\u8BD5" : (p == null ? void 0 : p.status) === "disconnected" ? "\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u7B49\u5F85\u6062\u590D\u2026" : ((_a = p == null ? void 0 : p.channel) == null ? void 0 : _a.readyState) === "open" ? "\u5DF2\u8FDE\u63A5" : p && ["failed", "closed", "disconnected"].includes(p.status) ? "\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u5207\u6362\u7F51\u7EDC\u5C1D\u8BD5" : "\u8FDE\u63A5\u4E2D\u2026";
    },
    connectionDetails() {
      return [...peers].map(([id, p]) => {
        var _a;
        const c = (v) => v ? "\u5C40\u57DF " + v.host + " / \u516C\u7F51 " + v.srflx + " / \u4E2D\u7EE7 " + v.relay : "\u672A\u53D6\u5F97";
        return (id === host ? "\u623F\u4E3B" : "\u597D\u53CB") + "\uFF08\u7B2C" + (attempts.get(id) || 1) + "/1\u6B21\uFF09\uFF1A" + (p.failure ? "\u5931\u8D25\u4E8E " + p.failure : p.stage) + "\n\u672C\u673A\u5730\u5740 " + c(p.local) + "\uFF1B\u5BF9\u7AEF\u5730\u5740 " + c(p.remote) + "\n\u6536\u96C6 " + (p.gather || "\u672A\u5F00\u59CB") + "\uFF1BICE " + (p.ice || "\u672A\u5F00\u59CB") + "\uFF1B\u901A\u9053 " + (((_a = p.channel) == null ? void 0 : _a.readyState) || "\u672A\u521B\u5EFA") + (p.stunError ? "\uFF1BSTUN\u9519\u8BEF " + p.stunError : "") + (p.error ? "\uFF1B\u9519\u8BEF " + p.error : "") + (p.extraError ? "\uFF1B\u5730\u5740\u8865\u53D1 " + p.extraError : "");
      }).join("\n\n") || "\u7B49\u5F85\u623F\u4E3B\u53D1\u9001\u8FDE\u63A5\u9080\u8BF7";
    },
    async update(next, signals = []) {
      room = next;
      for (const [id, p] of peers) if (!room.members.some((m) => m.id === id)) {
        retire(p);
        peers.delete(id);
        attempts.delete(id);
        snapshots.delete(id);
        rulesAck.delete(id);
      }
      const memberIds = new Set(room.members.map((m) => m.id));
      for (const cache of [names, effects, lastHit]) for (const id of cache.keys()) if (!memberIds.has(id)) cache.delete(id);
      for (const key2 of effectSeen.keys()) if (!memberIds.has(key2.split(":")[0])) effectSeen.delete(key2);
      for (const queue of [effectEvents, trafficHits]) for (let i = queue.length - 1; i >= 0; i--) if (!memberIds.has(queue[i].sender)) queue.splice(i, 1);
      if (isHost && !room.started) {
        for (const m of room.members) if (m.id !== self) {
          const p = peers.get(m.id);
          if (!p) offer(m.id);
        }
      }
      for (const signal of signals) {
        if (closed) break;
        try {
          if (!isHost && signal.from === host && signal.type === "offer") {
            const round = roundOf(signal.sdp);
            let p = peers.get(host);
            if (p && round && p.round === round) {
              if (current(p)) await candidates(p, signal.sdp);
              continue;
            }
            if (p && round && p.round && Number(round) < Number(p.round)) continue;
            if (p) retire(p);
            p = make(host, round);
            attempts.set(host, Number(round) || 1);
            p.stage = "\u63A5\u6536\u8FDE\u63A5\u9080\u8BF7";
            p.remote = counts(signal.sdp);
            await p.pc.setRemoteDescription({ type: "offer", sdp: cleanSdp(signal.sdp) });
            await p.pc.setLocalDescription(await p.pc.createAnswer());
            await description(p);
            p.stage = "\u53D1\u9001\u5E94\u7B54";
            notify();
            await sendDescription(p);
            if (current(p)) {
              p.stage = "\u5EFA\u7ACB\u6570\u636E\u901A\u9053";
              supplement(p);
              notify();
            }
          } else if (isHost && signal.type === "answer") {
            const p = peers.get(signal.from), round = roundOf(signal.sdp);
            if (!p || !current(p) || round && round !== p.round) continue;
            if (p.pc.signalingState === "have-local-offer") {
              p.stage = "\u63A5\u6536\u597D\u53CB\u5E94\u7B54";
              p.remote = counts(signal.sdp);
              await p.pc.setRemoteDescription({ type: "answer", sdp: cleanSdp(signal.sdp) });
              p.stage = "\u5EFA\u7ACB\u6570\u636E\u901A\u9053";
              notify();
            } else if (round) await candidates(p, signal.sdp);
          }
        } catch (error) {
          const p = peers.get(signal.from);
          if (p) fail(p, error);
        }
      }
      if (!room.started && isHost) {
        for (const [id, p] of peers) if (!rulesAck.has(id)) sendRules(p);
      }
      const links = this.connected().filter((id) => isHost ? !initialRoom.localRules || rulesAck.has(id) : !!rules), key = room.members.map((m) => m.id).sort().join(",") + "|" + links.sort().join(",");
      const required = room.members.filter((m) => m.id !== self && (isHost || m.host));
      const ready = required.every((m) => links.includes(m.id));
      const selfMember = room.members.find((m) => m.id === self);
      if (!closed && !room.started && (key !== lastLinks || (selfMember == null ? void 0 : selfMember.ready) !== ready)) {
        await request("/ready", { links });
        lastLinks = key;
      }
    },
    send(vehicle, values) {
      if (closed) return;
      values = values.slice();
      values[7] = values[7] & 3 | (typeof document !== "undefined" && document.hidden ? 4 : 0);
      lastState = { vehicle, values: values.slice() };
      publish(vehicle, values);
    },
    async diagnostics() {
      var _a, _b;
      const links = [];
      for (const [id, p] of peers) {
        const link = { id, state: ((_a = p.channel) == null ? void 0 : _a.readyState) || p.status, rtt: null, path: "\u5F85\u68C0\u6D4B", buffer: ((_b = p.channel) == null ? void 0 : _b.bufferedAmount) || 0 };
        try {
          const stats = await p.pc.getStats();
          let pair;
          stats.forEach((s) => {
            if (s.type === "transport" && s.selectedCandidatePairId) pair = stats.get(s.selectedCandidatePairId);
          });
          if (!pair) stats.forEach((s) => {
            if (s.type === "candidate-pair" && s.state === "succeeded" && s.nominated) pair = s;
          });
          if (pair) {
            const local = stats.get(pair.localCandidateId), remote = stats.get(pair.remoteCandidateId);
            link.path = (local == null ? void 0 : local.candidateType) === "relay" || (remote == null ? void 0 : remote.candidateType) === "relay" ? "TURN \u4E2D\u7EE7" : "P2P \u76F4\u8FDE";
            if (Number.isFinite(pair.currentRoundTripTime)) link.rtt = Math.round(pair.currentRoundTripTime * 1e3);
          }
        } catch (e) {
        }
        links.push(link);
      }
      return { trafficWorldAge: world ? Math.round(performance.now() - world.at) : null, trafficWorldCount: (world == null ? void 0 : world.rows.filter(Boolean).length) || 0, roomServiceStatus, tx, rx, sentMessages, receivedMessages, links, isHost, at: performance.now(), updates: [...snapshots].map(([id, s]) => {
        var _a2;
        return { id, age: Math.round(performance.now() - s.at), interval: ((_a2 = s.history) == null ? void 0 : _a2.length) > 1 ? Math.round(s.at - s.history[s.history.length - 2].at) : null };
      }) };
    },
    close() {
      closed = true;
      clearInterval(heartbeat);
      lastState = null;
      for (const p of peers.values()) retire(p);
      peers.clear();
      snapshots.clear();
      names.clear();
      effects.clear();
      effectSeen.clear();
      lastHit.clear();
      attempts.clear();
      rulesAck.clear();
      effectEvents.length = 0;
      trafficHits.length = 0;
      world = null;
    }
  };
}, function createProfile() {
  const clean = (value) => typeof value === "string" ? Array.from(value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").trim()).slice(0, 16).join("") : "";
  let fallback;
  try {
    fallback = localStorage.getItem("road-king-guest-name");
  } catch (e) {
  }
  if (!/^用户\d{6}$/.test(fallback || "")) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    fallback = "\u7528\u6237" + String(1e5 + a[0] % 9e5);
    try {
      localStorage.setItem("road-king-guest-name", fallback);
    } catch (e) {
    }
  }
  function nativeName() {
    return new Promise((resolve) => {
      var _a, _b, _c;
      const callback = "roadKingName_" + Date.now(), timer = setTimeout(() => finish(null), 4e3);
      function finish(raw) {
        clearTimeout(timer);
        delete window[callback];
        try {
          for (let i = 0; i < 5; i++) {
            if (typeof raw === "string") {
              raw = JSON.parse(raw);
              continue;
            }
            if ((raw == null ? void 0 : raw.response) !== void 0) {
              raw = raw.response;
              continue;
            }
            if ((raw == null ? void 0 : raw.data) !== void 0) {
              raw = raw.data;
              continue;
            }
            break;
          }
          resolve(clean((raw == null ? void 0 : raw.userName) || (raw == null ? void 0 : raw.nickname)));
        } catch (e) {
          resolve("");
        }
      }
      window[callback] = finish;
      const payload = JSON.stringify({ method: "getUserInfo", param: {}, libType: "babel", callback, asyncCallback: callback });
      try {
        if ((_a = window.MetaX) == null ? void 0 : _a.exec) {
          const raw = window.MetaX.exec(payload);
          if (raw !== void 0 && !String(raw).includes('"code":302')) finish(raw);
        } else if ((_c = (_b = window.webkit) == null ? void 0 : _b.messageHandlers) == null ? void 0 : _c.MetaX) window.webkit.messageHandlers.MetaX.postMessage(payload);
        else finish(null);
      } catch (e) {
        finish(null);
      }
    });
  }
  return { fallback, async resolve() {
    var _a;
    try {
      if (document.documentElement.dataset.platform === "233") return await nativeName() || fallback;
      if ((_a = window.toy) == null ? void 0 : _a.getUserProfile) {
        let timer;
        try {
          const profile = await Promise.race([window.toy.getUserProfile(), new Promise((resolve) => {
            timer = setTimeout(() => resolve(null), 8e3);
          })]);
          return clean(profile == null ? void 0 : profile.nickname) || fallback;
        } finally {
          clearTimeout(timer);
        }
      }
    } catch (e) {
    }
    return fallback;
  } };
}, function createMatcher({ search, release, onTick, onFound, onEnd, now = () => Date.now(), later = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id) }) {
  let active = null;
  function stop(reason) {
    const run = active;
    if (!run) return;
    active = null;
    cancel(run.tick);
    cancel(run.next);
    onEnd(reason);
  }
  function start() {
    stop("cancel");
    const run = { start: now(), tick: null, next: null };
    active = run;
    function tick() {
      if (active !== run) return;
      const elapsed = Math.floor((now() - run.start) / 1e3);
      onTick(Math.min(60, elapsed));
      if (elapsed >= 60) {
        stop("timeout");
        return;
      }
      run.tick = later(tick, 1e3);
    }
    async function attempt() {
      if (active !== run) return;
      if (now() - run.start >= 6e4) {
        onTick(60);
        stop("timeout");
        return;
      }
      const began = now();
      try {
        const result = await search();
        if (active !== run || now() - run.start >= 6e4) {
          if (active === run) stop("timeout");
          await release(result);
          return;
        }
        active = null;
        cancel(run.tick);
        onFound(result);
      } catch (error) {
        if (active !== run) return;
        if (error.status !== 404) {
          stop(error);
          return;
        }
        run.next = later(attempt, Math.max(0, 5e3 - (now() - began)));
      }
    }
    tick();
    attempt();
  }
  return { start, cancel: () => stop("cancel"), get active() {
    return !!active;
  } };
});
(function install5() {
  var overlay = document.getElementById("update-notice");
  var confirm = document.getElementById("update-notice-confirm");
  var menu = document.getElementById("mode-screen");
  var content = overlay && overlay.querySelector(".update-notice-content");
  var closed = false, failures = 0, timer;
  function unlock() {
    if (menu) {
      menu.inert = false;
      menu.removeAttribute("aria-hidden");
    }
  }
  function close() {
    if (closed) return;
    closed = true;
    if (overlay) overlay.hidden = true;
    unlock();
    clearInterval(timer);
    document.removeEventListener("focusin", focusInside, true);
    document.removeEventListener("click", blockBackground, true);
    document.removeEventListener("keydown", keyboard, true);
  }
  if (!overlay || !confirm || !content) {
    close();
    return;
  }
  function usable() {
    if (overlay.hidden || !overlay.isConnected) return false;
    var node = confirm;
    while (node && node !== document.documentElement) {
      var style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      node = node.parentElement;
    }
    var r = confirm.getBoundingClientRect(), w = document.documentElement.clientWidth || window.innerWidth, h = document.documentElement.clientHeight || window.innerHeight;
    if (r.width < 16 || r.height < 16 || r.left < 0 || r.top < 0 || r.right > w || r.bottom > h) return false;
    var target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!target && (target === confirm || confirm.contains(target));
  }
  function focusInside(e) {
    if (!usable()) {
      close();
      return;
    }
    if (!overlay.contains(e.target)) confirm.focus({ preventScroll: true });
  }
  function blockBackground(e) {
    if (!usable()) {
      close();
      return;
    }
    if (!overlay.contains(e.target)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
  function keyboard(e) {
    if (!usable()) {
      close();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      (document.activeElement === confirm ? content : confirm).focus({ preventScroll: true });
    }
    e.stopImmediatePropagation();
  }
  if (menu) {
    menu.inert = true;
    menu.setAttribute("aria-hidden", "true");
  }
  document.addEventListener("focusin", focusInside, true);
  document.addEventListener("click", blockBackground, true);
  document.addEventListener("keydown", keyboard, true);
  confirm.addEventListener("click", close);
  var tap = null;
  confirm.addEventListener("touchstart", function(e) {
    tap = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  confirm.addEventListener("touchmove", function(e) {
    if (!tap || e.touches.length !== 1) {
      tap = null;
      return;
    }
    if (Math.hypot(e.touches[0].clientX - tap.x, e.touches[0].clientY - tap.y) > 12) tap = null;
  }, { passive: true });
  confirm.addEventListener("touchcancel", function() {
    tap = null;
  }, { passive: true });
  confirm.addEventListener("touchend", function(e) {
    var start = tap;
    tap = null;
    if (!start || e.touches.length || e.changedTouches.length !== 1) return;
    var t = e.changedTouches[0], r = confirm.getBoundingClientRect();
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 12 || t.clientX < r.left || t.clientX > r.right || t.clientY < r.top || t.clientY > r.bottom) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }, { passive: false });
  timer = setInterval(function() {
    if (document.hidden || document.readyState !== "complete") return;
    try {
      failures = usable() ? 0 : failures + 1;
    } catch (_) {
      failures++;
    }
    if (failures >= 2) close();
  }, 500);
})();
window.addEventListener("error", function(e) {
  if (e.target && e.target.tagName !== "SCRIPT" && e.target !== window) return;
  var p = document.getElementById("boot-message"), b = document.getElementById("boot-screen");
  if (p) p.textContent = "\u52A0\u8F7D\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u6E38\u620F\u3002";
  if (b) b.setAttribute("data-failed", "true");
}, true);
document.addEventListener("click", function(e) {
  var t = e.target;
  while (t && t !== document) {
    if (t.getAttribute && t.getAttribute("data-mode-selection")) break;
    t = t.parentNode;
  }
  if (!t || t === document || document.documentElement.getAttribute("data-game-mode") || document.documentElement.hasAttribute("data-story-mode")) return;
  var m = t.getAttribute("data-mode-selection");
  if (m !== "normal" && m !== "simulation") return;
  document.documentElement.setAttribute("data-game-mode", m);
  var p = document.getElementById("boot-message");
  if (p) p.textContent = "\u6B63\u5728\u51C6\u5907" + (m === "simulation" ? "\u72C2\u66B4" : "\u6B63\u5E38") + "\u6A21\u5F0F\u2026";
  window.dispatchEvent(new Event("game-mode-selected"));
});
