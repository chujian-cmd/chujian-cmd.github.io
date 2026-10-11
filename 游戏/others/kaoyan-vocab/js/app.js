(function () {
  "use strict";

  /* ---------- 工具 ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function wordRegex(word) {
    return new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w*", "gi");
  }

  function highlight(sentence, word) {
    return esc(sentence).replace(wordRegex(word), (m) => "<mark>" + m + "</mark>");
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ---------- 状态 ---------- */
  const DEFAULTS = {
    status: {},            // wordId -> known / fuzzy / unknown
    favs: [],
    settings: { accent: "us", dark: false },
    quiz: { total: 0, correct: 0 }
  };

  let state = loadState();

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem("kyv_state") || "null") || {};
      return {
        status: raw.status || {},
        favs: Array.isArray(raw.favs) ? raw.favs : [],
        settings: Object.assign({}, DEFAULTS.settings, raw.settings || {}),
        quiz: Object.assign({}, DEFAULTS.quiz, raw.quiz || {})
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  function saveState() {
    localStorage.setItem("kyv_state", JSON.stringify(state));
  }

  const wordById = {};
  WORDS.forEach((w) => { wordById[w.id] = w; });
  const groupById = {};
  DISTINCTIONS.forEach((g) => { groupById[g.id] = g; });

  /* ---------- 视图切换 ---------- */
  let currentTab = "study";
  let applyingHash = false;

  function switchTab(tab) {
    currentTab = tab;
    if (!applyingHash && location.hash !== "#/" + tab) {
      history.replaceState(null, "", "#/" + tab);
    }
    $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + tab));
    if (tab === "study") renderStudy();
    if (tab === "distinct") renderDistinct();
    if (tab === "exams") renderExams();
    if (tab === "quiz") renderQuizSetup();
    if (tab === "fav") renderFav();
    if (tab === "stats") renderStats();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyHash() {
    applyingHash = true;
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    if (h.startsWith("word=")) {
      openWord(h.slice(5));
    } else if (["study", "distinct", "exams", "quiz", "fav", "stats"].includes(h)) {
      switchTab(h);
    } else {
      switchTab("study");
    }
    applyingHash = false;
  }

  window.addEventListener("hashchange", applyHash);

  /* ---------- 发音 ---------- */
  let voices = [];

  function loadVoices() {
    if (!("speechSynthesis" in window)) return;
    voices = speechSynthesis.getVoices();
  }

  if ("speechSynthesis" in window) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  function speak(text, accent) {
    if (!("speechSynthesis" in window)) {
      toast("当前浏览器不支持语音合成，建议使用 Chrome 或 Edge");
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = accent === "uk" ? "en-GB" : "en-US";
    u.rate = 0.88;
    const langPrefix = accent === "uk" ? "en-gb" : "en-us";
    const pool = voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(langPrefix));
    const preferred =
      pool.find((v) => /google/i.test(v.name)) ||
      pool.find((v) => /natural|neural/i.test(v.name)) ||
      pool[0];
    if (preferred) u.voice = preferred;
    speechSynthesis.speak(u);
  }

  /* ---------- 背单词 ---------- */
  let studyQueue = [];
  let studyIndex = 0;
  let coverMode = false;

  function buildStudyQueue() {
    const filter = $("#studyFilter").value;
    const q = ($("#globalSearch").value || "").trim().toLowerCase();
    return WORDS.filter((w) => {
      if (q) {
        const hay = [w.word, w.meanings.join(" "), w.examples.map((e) => e.en).join(" "), w.collocations.join(" ")].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (filter) {
        case "unknown": return state.status[w.id] === "unknown";
        case "fuzzy": return state.status[w.id] === "fuzzy";
        case "known": return state.status[w.id] === "known";
        case "fav": return state.favs.includes(w.id);
        default: return true;
      }
    });
  }

  function renderStudy() {
    studyQueue = buildStudyQueue();
    studyIndex = Math.min(studyIndex, Math.max(studyQueue.length - 1, 0));
    updateStudyProgress();
    renderCard();
  }

  function updateStudyProgress() {
    const total = studyQueue.length;
    const done = WORDS.filter((w) => state.status[w.id] === "known").length;
    $("#studyProgressText").textContent = `已掌握 ${done}/${WORDS.length} · 当前列表 ${total} 词`;
    $("#studyProgressBar").style.width = Math.round((done / WORDS.length) * 100) + "%";
  }

  function renderCard() {
    const area = $("#cardArea");
    if (!studyQueue.length) {
      area.innerHTML = '<div class="empty-tip">这个范围还没有单词<br>换个范围试试，或在顶部搜索框输入单词</div>';
      return;
    }
    const w = studyQueue[studyIndex];
    const g = groupById[w.group];
    const fav = state.favs.includes(w.id);
    const coverCls = coverMode ? "covered" : "";
    const yearTags = Array.from(new Set(w.examples.map((e) => e.tag.slice(0, 4))));

    const examHtml = w.examples.map((ex, i) => `
      <div class="exam-box">
        <div class="exam-meta">
          <span class="badge">${esc(ex.tag)}</span>
          <button class="speak-btn" data-speak-sentence="${i}">🔊 朗读例句</button>
          <button class="speak-btn" data-speak-sentence="${i}" data-accent="uk">🇬🇧</button>
          <button class="btn btn-ghost exam-zh-toggle" data-zh="${i}">译文</button>
        </div>
        <p class="exam-en">${highlight(ex.en, w.word)}</p>
        <p class="exam-zh" id="examZh${i}">${esc(ex.zh)}</p>
      </div>`).join("");

    area.innerHTML = `
      <div class="word-card card ${coverCls}">
        <div class="word-card-head">
          <div>
            <div class="word-title">
              <h2 data-word-sound>${esc(w.word)}</h2>
              <span class="phonetics"><span class="accent-mark">美</span>${esc(w.phonetic.us)}<br><span class="accent-mark">英</span>${esc(w.phonetic.uk)}</span>
            </div>
            <div class="speak-row">
              <button class="speak-btn" data-accent="us">🇺🇸 美音</button>
              <button class="speak-btn" data-accent="uk">🇬🇧 英音</button>
            </div>
          </div>
          <button class="fav-btn ${fav ? "on" : ""}" data-fav title="收藏">${fav ? "★" : "☆"}</button>
        </div>

        <div class="word-tags coverable">
          ${w.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
          ${yearTags.map((t) => `<span class="tag year">${t} 真题</span>`).join("")}
        </div>

        <div class="word-meanings coverable">
          <span class="pos">${esc(w.pos)}</span>
          <span class="sense">${w.meanings.map(esc).join("；")}</span>
        </div>

        <div class="word-section coverable">
          <h3><span class="dot"></span>词义辨析</h3>
          <div class="distinct-box">
            <div class="distinct-title">${esc(g.title)}（${esc(g.cn)}）</div>
            <div>${g.text}</div>
          </div>
        </div>

        <div class="word-section coverable">
          <h3><span class="dot"></span>常考搭配</h3>
          <div class="colloc-chips">${w.collocations.map((c) => `<button class="chip" data-colloc="${esc(c)}">${esc(c)}</button>`).join("")}</div>
        </div>

        <div class="word-section coverable">
          <h3><span class="dot"></span>真题例句</h3>
          ${examHtml}
        </div>

        <div class="card-actions">
          <div class="status-group">
            <button class="btn btn-unknown" data-status="unknown">✗ 不认识</button>
            <button class="btn btn-fuzzy" data-status="fuzzy">△ 模糊</button>
            <button class="btn btn-known" data-status="known">✓ 认识</button>
          </div>
          <div class="nav-btns">
            <button class="btn btn-ghost" data-nav="prev" title="← 上一个">←</button>
            <span>${studyIndex + 1} / ${studyQueue.length}</span>
            <button class="btn btn-ghost" data-nav="next" title="→ 下一个">→</button>
          </div>
        </div>
      </div>`;
  }

  function setStatus(w, status) {
    state.status[w.id] = status;
    saveState();
    updateStudyProgress();
    if (studyIndex < studyQueue.length - 1) {
      studyIndex += 1;
      renderCard();
    } else {
      renderCard();
      toast(status === "known" ? "已标记为认识 🎉" : status === "fuzzy" ? "已标记为模糊" : "已标记为不认识");
    }
  }

  function toggleFav(w) {
    const i = state.favs.indexOf(w.id);
    if (i >= 0) state.favs.splice(i, 1);
    else state.favs.push(w.id);
    saveState();
    renderCard();
    toast(i >= 0 ? "已取消收藏" : "已加入收藏 ★");
  }

  /* ---------- 词义辨析 ---------- */
  function renderDistinct() {
    const q = ($("#globalSearch").value || "").trim().toLowerCase();
    const list = DISTINCTIONS.filter((g) =>
      !q || g.title.toLowerCase().includes(q) || g.text.toLowerCase().includes(q) || g.cn.includes(q)
    );
    $("#distinctList").innerHTML = list.length
      ? list.map((g) => `
        <div class="distinct-item" data-group="${g.id}">
          <button class="distinct-head">
            <span class="cn">${esc(g.cn)}</span>
            <span>${esc(g.title)}</span>
            <span class="arrow">▶</span>
          </button>
          <div class="distinct-body">
            <p>${g.text}</p>
            <div class="distinct-links">
              ${g.words.map((w) => {
                const word = WORDS.find((x) => x.word === w);
                return word ? `<button class="word-link-btn" data-word="${w}">查看「${w}」卡片</button>` : "";
              }).join("")}
            </div>
          </div>
        </div>`).join("")
      : '<div class="empty-tip">没有匹配的辨析组</div>';
  }

  /* ---------- 真题例句 ---------- */
  let examYear = "all";

  function examYears() {
    const years = new Set();
    WORDS.forEach((w) => w.examples.forEach((e) => years.add(e.tag.slice(0, 4))));
    return Array.from(years).sort().reverse();
  }

  function renderExams() {
    const years = examYears();
    $("#yearChips").innerHTML =
      `<button class="year-chip ${examYear === "all" ? "active" : ""}" data-year="all">全部</button>` +
      years.map((y) => `<button class="year-chip ${examYear === y ? "active" : ""}" data-year="${y}">${y}</button>`).join("");

    const q = ($("#globalSearch").value || "").trim().toLowerCase();
    const items = [];
    WORDS.forEach((w) => {
      w.examples.forEach((e) => {
        if (examYear !== "all" && !e.tag.startsWith(examYear)) return;
        if (q && !(w.word.toLowerCase().includes(q) || e.en.toLowerCase().includes(q) || e.zh.includes(q))) return;
        items.push({ w, e });
      });
    });
    items.sort((a, b) => (b.e.tag < a.e.tag ? -1 : 1));

    $("#examList").innerHTML = items.length
      ? items.map(({ w, e }) => `
        <div class="exam-card card">
          <div class="exam-meta">
            <span class="badge">${esc(e.tag)}</span>
            <button class="word-link-btn" data-word="${esc(w.word)}">${esc(w.word)}</button>
            <button class="speak-btn" data-sentence="${esc(e.en)}" data-accent="us">🇺🇸 美音</button>
            <button class="speak-btn" data-sentence="${esc(e.en)}" data-accent="uk">🇬🇧 英音</button>
            <button class="btn btn-ghost exam-zh-toggle" data-zh-target>译文</button>
          </div>
          <p class="exam-en">${highlight(e.en, w.word)}</p>
          <p class="exam-zh">${esc(e.zh)}</p>
        </div>`).join("")
      : '<div class="empty-tip">没有匹配的例句</div>';
  }

  /* ---------- 自测 ---------- */
  const quiz = { questions: [], idx: 0, correct: 0, wrong: [] };

  function renderQuizSetup() {
    $("#quizSetup").style.display = "block";
    $("#quizArea").innerHTML = "";
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickDistractors(correctId, count) {
    const samePos = WORDS.filter((w) => w.id !== correctId && w.pos === wordById[correctId].pos);
    const pool = shuffle(samePos.length >= count ? samePos : WORDS.filter((w) => w.id !== correctId));
    return pool.slice(0, count);
  }

  function buildQuestions(mode, count) {
    const words = shuffle(WORDS).slice(0, count);
    return words.map((w) => {
      if (mode === "en2zh") {
        const distractors = pickDistractors(w.id, 3).map((d) => d.meanings[0]);
        const options = shuffle([w.meanings[0], ...distractors]);
        return {
          type: "en2zh",
          prompt: w.word,
          hint: "选择正确的释义",
          options,
          answer: w.meanings[0],
          word: w,
          explain: `<b>${esc(w.word)}</b> ${esc(w.pos)} ${w.meanings.map(esc).join("；")}`
        };
      }
      if (mode === "zh2en") {
        const distractors = pickDistractors(w.id, 3).map((d) => d.word);
        const options = shuffle([w.word, ...distractors]);
        return {
          type: "zh2en",
          prompt: w.meanings[0],
          hint: "选择对应的单词",
          options,
          answer: w.word,
          word: w,
          explain: `<b>${esc(w.word)}</b> ${esc(w.pos)} ${w.meanings.map(esc).join("；")}`
        };
      }
      // fill：真题选词
      const ex = w.examples[0];
      const distractors = pickDistractors(w.id, 3).map((d) => d.word);
      const options = shuffle([w.word, ...distractors]);
      return {
        type: "fill",
        prompt: ex.en.replace(wordRegex(w.word), "____"),
        hint: "选择最适合填入空白处的单词（真题例句）",
        options,
        answer: w.word,
        word: w,
        explain: `<b>${esc(w.word)}</b> ${w.meanings.map(esc).join("；")}<br><span style="color:var(--muted)">原句：${esc(ex.en)}</span><br><span style="color:var(--muted)">${esc(ex.zh)}</span>`
      };
    });
  }

  function renderQuizQuestion() {
    const area = $("#quizArea");
    const q = quiz.questions[quiz.idx];
    const progress = `第 ${quiz.idx + 1} / ${quiz.questions.length} 题 · 已答对 ${quiz.correct} 题`;
    area.innerHTML = `
      <div class="quiz-progress">${progress}</div>
      <div class="quiz-card card">
        <p class="quiz-question">${esc(q.prompt)}</p>
        <p class="quiz-hint">${esc(q.hint)}</p>
        <div class="quiz-options">
          ${q.options.map((o, i) => `<button class="quiz-option" data-opt="${i}">${esc(o)}</button>`).join("")}
        </div>
        <div class="quiz-explain"></div>
        <div class="quiz-next-wrap"></div>
      </div>`;
  }

  function answerQuiz(optIndex) {
    const q = quiz.questions[quiz.idx];
    const correct = q.options[optIndex] === q.answer;
    if (correct) quiz.correct += 1;
    else quiz.wrong.push(q.word);

    $$(".quiz-option").forEach((btn, i) => {
      btn.disabled = true;
      if (q.options[i] === q.answer) btn.classList.add("correct");
      else if (i === optIndex) btn.classList.add("wrong");
    });

    const explain = $(".quiz-explain");
    explain.innerHTML = (correct ? "✅ 回答正确。" : "❌ 回答错误。") + " " + q.explain;
    explain.classList.add("show");

    const last = quiz.idx === quiz.questions.length - 1;
    $(".quiz-next-wrap").innerHTML = `<button class="btn btn-primary btn-lg" data-quiz-next>${last ? "查看结果" : "下一题 →"}</button>`;
  }

  function renderQuizResult() {
    const total = quiz.questions.length;
    state.quiz.total += total;
    state.quiz.correct += quiz.correct;
    saveState();

    const pct = Math.round((quiz.correct / total) * 100);
    const wrongHtml = quiz.wrong.length
      ? `<div class="distinct-links" style="justify-content:center">${quiz.wrong.map((w) => `<button class="word-link-btn" data-word="${esc(w.word)}">复习 ${esc(w.word)}</button>`).join("")}</div>`
      : "";
    $("#quizArea").innerHTML = `
      <div class="quiz-card card quiz-result">
        <p class="score">${quiz.correct} / ${total}</p>
        <p class="sub">正确率 ${pct}%${quiz.wrong.length ? " · 错 " + quiz.wrong.length + " 题" : " · 全对，太棒了！🎉"}</p>
        ${wrongHtml}
        <button class="btn btn-primary btn-lg" data-quiz-again>再来一组</button>
      </div>`;
  }

  /* ---------- 收藏 ---------- */
  function renderFav() {
    const favs = WORDS.filter((w) => state.favs.includes(w.id));
    $("#favList").innerHTML = favs.length
      ? favs.map((w) => `
        <div class="fav-item card">
          <span class="fw">${esc(w.word)}</span>
          <span class="phonetics">${esc(w.phonetic.us)}</span>
          <span class="fm">${w.meanings[0]}</span>
          <button class="word-link-btn" data-word="${esc(w.word)}">打开卡片</button>
          <button class="speak-btn" data-sentence="${esc(w.word)}" data-accent="us">🇺🇸</button>
          <button class="speak-btn" data-sentence="${esc(w.word)}" data-accent="uk">🇬🇧</button>
        </div>`).join("")
      : '<div class="empty-tip">还没有收藏的单词<br>在单词卡片右上角点击 ☆ 即可收藏</div>';
  }

  /* ---------- 统计 ---------- */
  function renderStats() {
    const known = WORDS.filter((w) => state.status[w.id] === "known").length;
    const fuzzy = WORDS.filter((w) => state.status[w.id] === "fuzzy").length;
    const unknown = WORDS.filter((w) => state.status[w.id] === "unknown").length;
    const todo = WORDS.length - known - fuzzy - unknown;
    const acc = state.quiz.total ? Math.round((state.quiz.correct / state.quiz.total) * 100) : 0;
    const years = examYears();

    const yearHtml = years.map((y) => {
      const n = WORDS.filter((w) => w.examples.some((e) => e.tag.startsWith(y))).length;
      const pct = Math.round((n / WORDS.length) * 100);
      return `<div class="stat-bar-wrap">
        <div class="stat-bar-label"><span>${y} 年真题词汇</span><span>${n} 词</span></div>
        <div class="stat-bar"><div style="width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent-2))"></div></div>
      </div>`;
    }).join("");

    const bar = (label, n, color) => `
      <div class="stat-bar-wrap">
        <div class="stat-bar-label"><span>${label}</span><span>${n} 词</span></div>
        <div class="stat-bar"><div style="width:${(n / WORDS.length) * 100}%;background:${color}"></div></div>
      </div>`;

    $("#statsArea").innerHTML = `
      <div class="stats-grid">
        <div class="stat-card card"><div class="num">${known}</div><div class="label">已掌握</div></div>
        <div class="stat-card card"><div class="num">${fuzzy}</div><div class="label">模糊</div></div>
        <div class="stat-card card"><div class="num">${unknown}</div><div class="label">不认识</div></div>
        <div class="stat-card card"><div class="num">${state.favs.length}</div><div class="label">收藏</div></div>
        <div class="stat-card card"><div class="num">${acc}%</div><div class="label">自测正确率（${state.quiz.total} 题）</div></div>
      </div>
      <div class="card" style="padding:20px">
        <h3 style="margin-top:0">掌握分布</h3>
        ${bar("已掌握", known, "var(--success)")}
        ${bar("模糊", fuzzy, "var(--warn)")}
        ${bar("不认识", unknown, "var(--danger)")}
        ${bar("未标记", todo, "var(--muted)")}
      </div>
      <div class="card" style="padding:20px;margin-top:14px">
        <h3 style="margin-top:0">真题例句覆盖</h3>
        ${yearHtml}
      </div>`;
  }

  /* ---------- 全局搜索 ---------- */
  let searchTimer = null;
  function onSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (currentTab === "study" || currentTab === "exams" || currentTab === "distinct") {
        if (currentTab === "study") renderStudy();
        if (currentTab === "exams") renderExams();
        if (currentTab === "distinct") renderDistinct();
      } else {
        switchTab("study");
      }
    }, 220);
  }

  /* ---------- 事件绑定 ---------- */
  function openWord(word) {
    const w = WORDS.find((x) => x.word === word);
    if (!w) return;
    $("#globalSearch").value = "";
    $("#studyFilter").value = "all";
    studyQueue = buildStudyQueue();
    studyIndex = studyQueue.findIndex((x) => x.id === w.id);
    if (studyIndex < 0) studyIndex = 0;
    switchTab("study");
  }

  $$(".tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  $("#darkToggle").addEventListener("click", () => {
    state.settings.dark = !state.settings.dark;
    document.documentElement.setAttribute("data-theme", state.settings.dark ? "dark" : "light");
    saveState();
  });

  $("#accentSelect").addEventListener("change", (e) => {
    state.settings.accent = e.target.value;
    saveState();
  });

  $("#globalSearch").addEventListener("input", onSearch);
  $("#globalSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { clearTimeout(searchTimer); onSearch(); }
  });

  $("#studyFilter").addEventListener("change", () => {
    studyIndex = 0;
    renderStudy();
  });

  $("#coverToggle").addEventListener("click", () => {
    coverMode = !coverMode;
    $("#coverToggle").textContent = coverMode ? "👀 显示释义" : "🙈 隐藏释义";
    renderCard();
  });

  $("#shuffleBtn").addEventListener("click", () => {
    studyQueue = shuffle(studyQueue);
    studyIndex = 0;
    renderCard();
  });

  document.addEventListener("click", (e) => {
    const target = e.target;

    // 发音
    if (target.classList.contains("speak-btn")) {
      const accent = target.dataset.accent || state.settings.accent;
      if (target.dataset.sentence) {
        speak(target.dataset.sentence, accent);
      } else if (target.dataset.speakSentence !== undefined) {
        const w = studyQueue[studyIndex];
        const ex = w.examples[+target.dataset.speakSentence];
        speak(ex.en, accent);
      } else {
        const card = target.closest(".word-card");
        if (card) speak($("h2[data-word-sound]", card).textContent, accent);
      }
      return;
    }

    if (target.dataset.wordSound !== undefined) {
      speak(target.textContent, state.settings.accent);
      return;
    }

    if (target.dataset.colloc) {
      speak(target.dataset.colloc, state.settings.accent);
      return;
    }

    // 译文切换
    if (target.classList.contains("exam-zh-toggle")) {
      const box = target.closest(".exam-box") || target.closest(".exam-card");
      if (target.dataset.zh !== undefined) {
        const el = $("#examZh" + target.dataset.zh, box);
        el.classList.toggle("show");
        target.textContent = el.classList.contains("show") ? "隐藏译文" : "译文";
      } else {
        const el = $(".exam-zh", box);
        el.classList.toggle("show");
        target.textContent = el.classList.contains("show") ? "隐藏译文" : "译文";
      }
      return;
    }

    // 收藏
    if (target.dataset.fav !== undefined) {
      toggleFav(studyQueue[studyIndex]);
      return;
    }

    // 状态
    if (target.dataset.status) {
      setStatus(studyQueue[studyIndex], target.dataset.status);
      return;
    }

    // 上/下一个
    if (target.dataset.nav) {
      if (target.dataset.nav === "next") studyIndex = Math.min(studyIndex + 1, studyQueue.length - 1);
      else studyIndex = Math.max(studyIndex - 1, 0);
      renderCard();
      return;
    }

    // 辨析折叠
    if (target.classList.contains("distinct-head")) {
      target.closest(".distinct-item").classList.toggle("open");
      return;
    }

    // 单词链接
    if (target.dataset.word) {
      openWord(target.dataset.word);
      return;
    }

    // 年份筛选
    if (target.classList.contains("year-chip")) {
      examYear = target.dataset.year;
      renderExams();
      return;
    }

    // 测验选项
    if (target.classList.contains("quiz-option")) {
      answerQuiz(+target.dataset.opt);
      return;
    }

    if (target.dataset.quizNext !== undefined) {
      quiz.idx += 1;
      if (quiz.idx < quiz.questions.length) renderQuizQuestion();
      else renderQuizResult();
      return;
    }

    if (target.dataset.quizAgain !== undefined) {
      renderQuizSetup();
      return;
    }
  });

  $("#quizStart").addEventListener("click", () => {
    const mode = $("#quizMode").value;
    const countSel = $("#quizCount").value;
    const count = countSel === "all" ? WORDS.length : +countSel;
    quiz.questions = buildQuestions(mode, count);
    quiz.idx = 0;
    quiz.correct = 0;
    quiz.wrong = [];
    $("#quizSetup").style.display = "none";
    renderQuizQuestion();
  });

  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea") return;
    if (currentTab !== "study" || !studyQueue.length) return;
    if (["ArrowLeft", "ArrowRight", " ", "1", "2", "3", "f", "F"].includes(e.key)) {
      e.preventDefault();
    }
    const w = studyQueue[studyIndex];
    if (e.key === "ArrowRight") { studyIndex = Math.min(studyIndex + 1, studyQueue.length - 1); renderCard(); }
    else if (e.key === "ArrowLeft") { studyIndex = Math.max(studyIndex - 1, 0); renderCard(); }
    else if (e.key === "1") setStatus(w, "unknown");
    else if (e.key === "2") setStatus(w, "fuzzy");
    else if (e.key === "3") setStatus(w, "known");
    else if (e.key === "f" || e.key === "F") toggleFav(w);
    else if (e.key === " ") { coverMode = !coverMode; $("#coverToggle").textContent = coverMode ? "👀 显示释义" : "🙈 隐藏释义"; renderCard(); }
  });

  /* ---------- 初始化 ---------- */
  document.documentElement.setAttribute("data-theme", state.settings.dark ? "dark" : "light");
  $("#accentSelect").value = state.settings.accent;
  applyHash();
})();
