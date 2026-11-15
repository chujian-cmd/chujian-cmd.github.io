/* 基米斗作弊菜单（初见专属版）
 * 只负责改 window.__JIMI_CHEATS 上的开关标志和调用 window.__JIMI_API；
 * 实际判定都在 game.js 的关键函数里。开关状态存 localStorage，刷新不丢。
 */
(function () {
  "use strict";

  var STORAGE_KEY = "jimi-cheats-v1";
  var DEFAULTS = {
    invincible: false, // 无敌：自己受伤归零
    oneHit: false, // 一击必杀
    atkMul10: false, // 攻击×10（与一击必杀二选一）
    freezeEnemy: false, // 冻结对方：对方不能行动
    noCooldown: false, // 无冷却：自己的行动 CD 清零
    rageFull: false, // 怒气常满
  };

  function load() {
    var out = {};
    for (var k in DEFAULTS) out[k] = DEFAULTS[k];
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        for (var key in DEFAULTS) {
          if (typeof saved[key] === "boolean") out[key] = saved[key];
        }
      }
    } catch (e) {
      /* localStorage 不可用就用默认值 */
    }
    if (out.oneHit && out.atkMul10) out.atkMul10 = false;
    return out;
  }

  var cheats = load();
  window.__JIMI_CHEATS = cheats;

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cheats));
    } catch (e) {
      /* 忽略 */
    }
  }

  var TOGGLES = [
    { key: "invincible", label: "🛡️ 无敌", desc: "自己受伤伤害归零" },
    { key: "oneHit", label: "💥 一击必杀", desc: "抓挠一下直接带走对方" },
    { key: "atkMul10", label: "⚔️ 攻击 ×10", desc: "自己的伤害翻 10 倍" },
    { key: "freezeEnemy", label: "🧊 冻结对方", desc: "对方不能行动、不能回血攒怒" },
    { key: "noCooldown", label: "⚡ 无冷却", desc: "自己的行动 CD 清零，连点连放" },
    { key: "rageFull", label: "🔥 怒气常满", desc: "每次涨怒直接拉满（伤害加成拉满）" },
  ];

  var style = document.createElement("style");
  style.textContent = [
    "#jimi-cheat-btn{position:fixed;right:14px;bottom:96px;z-index:99990;width:56px;height:56px;border-radius:50%;border:2px solid #fff3;background:#222c;color:#ffd75e;font-size:26px;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px #0008;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}",
    "#jimi-cheat-btn.on{border-color:#ffd75e;background:#3a2f10e6}",
    "#jimi-cheat-panel{position:fixed;right:12px;bottom:162px;z-index:99991;width:min(300px,86vw);background:#1c1c22f2;color:#f2f2f2;border:1px solid #ffffff2a;border-radius:14px;padding:12px 14px 14px;font-family:system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;box-shadow:0 10px 30px #000a}",
    "#jimi-cheat-panel[hidden]{display:none}",
    "#jimi-cheat-panel h3{margin:0 0 4px;font-size:16px;color:#ffd75e;display:flex;justify-content:space-between;align-items:center}",
    "#jimi-cheat-panel h3 button{background:none;border:none;color:#aaa;font-size:20px;padding:4px 8px;cursor:pointer}",
    "#jimi-cheat-panel .tip{margin:0 0 8px;font-size:11px;color:#999}",
    ".jimi-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 2px;border-top:1px solid #ffffff14;min-height:44px;box-sizing:border-box}",
    ".jimi-row .txt b{display:block;font-size:14px;font-weight:600}",
    ".jimi-row .txt span{font-size:11px;color:#9a9aa5}",
    ".jimi-sw{flex:none;width:52px;height:30px;border-radius:15px;border:none;background:#44454f;position:relative;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    ".jimi-sw::after{content:'';position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#ddd;transition:left .15s}",
    ".jimi-sw.on{background:#e8a812}",
    ".jimi-sw.on::after{left:25px;background:#fff}",
    ".jimi-acts{display:flex;gap:8px;margin-top:10px}",
    ".jimi-acts button{flex:1;min-height:44px;border:none;border-radius:10px;background:#2f6f4f;color:#eafff3;font-size:14px;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    ".jimi-acts button:active{filter:brightness(1.25)}",
    "#jimi-cheat-toast{position:fixed;left:50%;bottom:170px;transform:translateX(-50%);z-index:99992;background:#000c;color:#ffd75e;font-size:13px;padding:8px 14px;border-radius:999px;pointer-events:none;opacity:0;transition:opacity .2s}",
    "#jimi-cheat-toast.show{opacity:1}",
  ].join("\n");
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = "jimi-cheat-btn";
  btn.type = "button";
  btn.textContent = "🐱";
  btn.setAttribute("aria-label", "作弊菜单");
  document.body.appendChild(btn);

  var panel = document.createElement("div");
  panel.id = "jimi-cheat-panel";
  panel.hidden = true;

  var head = document.createElement("h3");
  head.innerHTML = "<span>🐱 作弊菜单</span>";
  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "关闭菜单");
  head.appendChild(closeBtn);
  panel.appendChild(head);

  var tip = document.createElement("p");
  tip.className = "tip";
  tip.textContent = "开关会自动记住；全猫解锁是默认生效的，不用在这里开。";
  panel.appendChild(tip);

  var toast = document.createElement("div");
  toast.id = "jimi-cheat-toast";
  document.body.appendChild(toast);
  var toastTimer = 0;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("show");
    }, 1400);
  }

  var switchEls = {};
  TOGGLES.forEach(function (item) {
    var row = document.createElement("div");
    row.className = "jimi-row";
    var txt = document.createElement("div");
    txt.className = "txt";
    var b = document.createElement("b");
    b.textContent = item.label;
    var s = document.createElement("span");
    s.textContent = item.desc;
    txt.appendChild(b);
    txt.appendChild(s);
    var sw = document.createElement("button");
    sw.type = "button";
    sw.className = "jimi-sw" + (cheats[item.key] ? " on" : "");
    sw.setAttribute("aria-label", item.label);
    sw.addEventListener("click", function () {
      var next = !cheats[item.key];
      cheats[item.key] = next;
      // 一击必杀与攻击×10 二选一
      if (next && item.key === "oneHit" && cheats.atkMul10) {
        cheats.atkMul10 = false;
        switchEls.atkMul10.classList.remove("on");
      }
      if (next && item.key === "atkMul10" && cheats.oneHit) {
        cheats.oneHit = false;
        switchEls.oneHit.classList.remove("on");
      }
      sw.classList.toggle("on", next);
      save();
      refreshBtnState();
      if (next && item.key === "rageFull" && window.__JIMI_API) {
        window.__JIMI_API.fillRage();
      }
      showToast(item.label + (next ? " 已开启" : " 已关闭"));
    });
    switchEls[item.key] = sw;
    row.appendChild(txt);
    row.appendChild(sw);
    panel.appendChild(row);
  });

  var acts = document.createElement("div");
  acts.className = "jimi-acts";
  var healBtn = document.createElement("button");
  healBtn.type = "button";
  healBtn.textContent = "💚 回满血";
  healBtn.addEventListener("click", function () {
    if (window.__JIMI_API && window.__JIMI_API.healPlayer()) showToast("已回满血");
    else showToast("现在不在战斗中");
  });
  var rageBtn = document.createElement("button");
  rageBtn.type = "button";
  rageBtn.textContent = "🔥 怒气拉满";
  rageBtn.addEventListener("click", function () {
    if (window.__JIMI_API && window.__JIMI_API.fillRage()) showToast("怒气已拉满");
    else showToast("现在不在战斗中");
  });
  acts.appendChild(healBtn);
  acts.appendChild(rageBtn);
  panel.appendChild(acts);

  document.body.appendChild(panel);

  function refreshBtnState() {
    var anyOn = TOGGLES.some(function (t) {
      return cheats[t.key];
    });
    btn.classList.toggle("on", anyOn);
  }
  refreshBtnState();

  btn.addEventListener("click", function () {
    panel.hidden = !panel.hidden;
  });
  closeBtn.addEventListener("click", function () {
    panel.hidden = true;
  });
})();
