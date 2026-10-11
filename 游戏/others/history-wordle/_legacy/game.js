// 汉字 Wordle —— 游戏逻辑
(function () {
  "use strict";

  var WORD_LEN = 2;
  var MAX_ATTEMPTS = 6;

  function getWords() {
    return typeof WORDS !== "undefined" ? WORDS : null;
  }
  function getPinyin() {
    return typeof PINYIN_MAP !== "undefined" ? PINYIN_MAP : {};
  }

  // ---------- 纯逻辑（可单测） ----------
  function evaluate(guess, answer) {
    var res = new Array(WORD_LEN).fill("absent");
    var counts = {};
    var i;
    for (i = 0; i < answer.length; i++) counts[answer[i]] = (counts[answer[i]] || 0) + 1;
    for (i = 0; i < WORD_LEN; i++) {
      if (guess[i] === answer[i]) {
        res[i] = "correct";
        counts[guess[i]]--;
      }
    }
    for (i = 0; i < WORD_LEN; i++) {
      if (res[i] === "correct") continue;
      if ((counts[guess[i]] || 0) > 0) {
        res[i] = "present";
        counts[guess[i]]--;
      }
    }
    return res;
  }

  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function fmtDate(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function todayStr() {
    return fmtDate(new Date());
  }

  function yesterdayStr() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return fmtDate(d);
  }

  function pickDaily() {
    var words = getWords();
    return words[hashStr(todayStr()) % words.length];
  }

  function pickRandom() {
    var words = getWords();
    return words[Math.floor(Math.random() * words.length)];
  }

  function buildCharFreq(words) {
    var f = {};
    for (var w = 0; w < words.length; w++) {
      for (var i = 0; i < words[w].length; i++) {
        var ch = words[w][i];
        f[ch] = (f[ch] || 0) + 1;
      }
    }
    return f;
  }

  // ---------- 浏览器端 ----------
  if (typeof document !== "undefined") {
    var words = getWords();
    var charFreq = buildCharFreq(words);
    var PINYIN = getPinyin();

    var mode = "daily";
    var answer = "";
    var currentRow = 0;
    var currentGuess = "";
    var gameOver = false;
    var revealing = false;
    var isComposing = false;
    var pinyinBuf = "";
    var resultRows = [];
    var won = false;

    var STATS_KEY = "hanzi-wordle-stats-v1";
    var HINT = "猜一个两字词语：输入拼音或用中文输入法直接打字";
    var msgTimer = null;

    function $(sel) {
      return document.querySelector(sel);
    }

    function isHan(ch) {
      return /[\u4e00-\u9fff]/.test(ch);
    }

    function rowCells(r) {
      return Array.prototype.slice.call(document.querySelectorAll('.row[data-row="' + r + '"] .cell'));
    }

    function focusTyper() {
      var typer = $("#typer");
      try {
        typer.focus({ preventScroll: true });
      } catch (e) {
        typer.focus();
      }
    }

    // ---------- 统计 ----------
    function emptyStats() {
      return { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0], lastDate: "" };
    }
    function loadStats() {
      try {
        var s = JSON.parse(localStorage.getItem(STATS_KEY));
        if (!s || typeof s.played !== "number") return emptyStats();
        return s;
      } catch (e) {
        return emptyStats();
      }
    }
    function saveStats(s) {
      try {
        localStorage.setItem(STATS_KEY, JSON.stringify(s));
      } catch (e) {}
    }
    function updateStats(isWin, attempts) {
      var s = loadStats();
      var today = todayStr();
      var alreadyToday = mode === "daily" && s.lastDate === today;
      if (!alreadyToday) {
        s.played++;
        if (isWin) {
          s.wins++;
          s.dist[attempts - 1]++;
        }
        if (mode === "daily") {
          if (isWin) {
            s.streak = s.lastDate === yesterdayStr() ? s.streak + 1 : 1;
            s.maxStreak = Math.max(s.maxStreak, s.streak);
          } else {
            s.streak = 0;
          }
        }
      }
      s.lastDate = today;
      saveStats(s);
    }

    // ---------- 消息 ----------
    function showMessage(text, type) {
      clearTimeout(msgTimer);
      var el = $("#message");
      el.textContent = text;
      el.className = type || "";
      if (type === "error") {
        msgTimer = setTimeout(function () {
          $("#message").textContent = HINT;
          $("#message").className = "";
        }, 2200);
      }
    }

    // ---------- 棋盘 ----------
    function buildBoard() {
      var board = $("#board");
      board.innerHTML = "";
      for (var r = 0; r < MAX_ATTEMPTS; r++) {
        var row = document.createElement("div");
        row.className = "row" + (r === 0 ? " active" : "");
        row.setAttribute("data-row", r);
        for (var i = 0; i < WORD_LEN; i++) {
          var cell = document.createElement("div");
          cell.className = "cell";
          cell.setAttribute("data-row", r);
          cell.setAttribute("data-i", i);
          row.appendChild(cell);
        }
        board.appendChild(row);
      }
      renderCurrentRow();
    }

    function setActiveRow() {
      var rows = document.querySelectorAll(".row");
      for (var i = 0; i < rows.length; i++) rows[i].classList.toggle("active", i === currentRow);
      renderCurrentRow();
    }

    function renderCurrentRow() {
      var cells = rowCells(currentRow);
      for (var i = 0; i < WORD_LEN; i++) {
        var ch = currentGuess[i] || "";
        cells[i].textContent = ch;
        cells[i].classList.toggle("filled", !!ch);
        cells[i].classList.toggle("next", i === currentGuess.length && !gameOver);
      }
    }

    function shakeRow(r) {
      var row = document.querySelector('.row[data-row="' + r + '"]');
      if (!row) return;
      row.classList.add("shake");
      setTimeout(function () {
        row.classList.remove("shake");
      }, 500);
    }

    // ---------- 输入 ----------
    function addChar(ch) {
      if (gameOver || revealing) return;
      if (currentGuess.length >= WORD_LEN || !isHan(ch)) return;
      currentGuess += ch;
      renderCurrentRow();
      var cells = rowCells(currentRow);
      var cell = cells[currentGuess.length - 1];
      cell.classList.remove("pop");
      void cell.offsetWidth;
      cell.classList.add("pop");
    }

    function removeChar() {
      if (gameOver || revealing) return;
      if (pinyinBuf) {
        pinyinBuf = pinyinBuf.slice(0, -1);
        renderCandidates();
        return;
      }
      if (currentGuess.length) {
        currentGuess = currentGuess.slice(0, -1);
        renderCurrentRow();
      }
    }

    function addPinyin(ch) {
      if (gameOver || revealing) return;
      if (pinyinBuf.length >= 8) return;
      pinyinBuf += ch.toLowerCase();
      renderCandidates();
    }

    function clearPinyin() {
      pinyinBuf = "";
      renderCandidates();
    }

    function submitGuess() {
      if (gameOver || revealing) return;
      if (currentGuess.length < WORD_LEN) {
        showMessage("还差一个字", "error");
        shakeRow(currentRow);
        return;
      }
      var guess = currentGuess;
      var res = evaluate(guess, answer);
      resultRows.push({ guess: guess, result: res });
      revealing = true;
      var cells = rowCells(currentRow);
      var i;
      for (i = 0; i < WORD_LEN; i++) {
        (function (cell, state, delay) {
          setTimeout(function () {
            cell.classList.add("flip", "state-" + state);
          }, delay);
        })(cells[i], res[i], i * 300);
      }
      setTimeout(function () {
        revealing = false;
        var wonRow = res.every(function (x) {
          return x === "correct";
        });
        if (wonRow) {
          onWin();
        } else if (currentRow === MAX_ATTEMPTS - 1) {
          onLose();
        } else {
          currentRow++;
          currentGuess = "";
          setActiveRow();
        }
      }, WORD_LEN * 300 + 550);
    }

    // ---------- 拼音候选 ----------
    function renderCandidates() {
      var box = $("#candidates");
      box.innerHTML = "";
      if (gameOver) {
        box.innerHTML = '<div class="cand-hint">本局结束，点上方模式再来一局</div>';
        return;
      }
      var q = pinyinBuf.trim().toLowerCase();
      if (!q) {
        box.innerHTML = '<div class="cand-hint">点下面的拼音键（如 n-i）开始选字</div>';
        return;
      }
      var matched = [];
      for (var ch in PINYIN) {
        if (matched.length >= 120) break;
        var pys = PINYIN[ch];
        for (var k = 0; k < pys.length; k++) {
          if (pys[k].indexOf(q) === 0) {
            matched.push(ch);
            break;
          }
        }
      }
      if (!matched.length) {
        box.innerHTML = '<div class="cand-hint">没有找到以「' + q + '」开头的字，试试退格</div>';
        return;
      }
      matched.sort(function (a, b) {
        return (charFreq[b] || 0) - (charFreq[a] || 0);
      });
      if (matched.length > 20) {
        var count = document.createElement("div");
        count.className = "cand-count";
        count.textContent = matched.length + " 个字以「" + q + "」开头，可滚动选择";
        box.appendChild(count);
      }
      matched.forEach(function (ch) {
        var btn = document.createElement("button");
        btn.className = "cand";
        btn.textContent = ch;
        btn.title = PINYIN[ch].join(", ");
        btn.addEventListener("click", function () {
          addChar(ch);
          pinyinBuf = "";
          renderCandidates();
          focusTyper();
        });
        box.appendChild(btn);
      });
    }

    // ---------- 胜负 ----------
    function onWin() {
      gameOver = true;
      won = true;
      var n = currentRow + 1;
      document.querySelector('.row[data-row="' + currentRow + '"]').classList.add("win");
      showMessage("太棒了！第 " + n + " 次猜中", "success");
      confetti();
      updateStats(true, n);
      setTimeout(showStatsModal, 1500);
    }

    function onLose() {
      gameOver = true;
      var py = Array.prototype.map
        .call(answer, function (ch) {
          return (PINYIN[ch] || [ch]).join("/");
        })
        .join(" ");
      showMessage("答案是「" + answer + "」（" + py + "）", "error");
      updateStats(false, -1);
      setTimeout(showStatsModal, 1500);
    }

    // ---------- 弹窗 ----------
    function showModal(id) {
      $("#overlay").classList.remove("hidden");
      $("#" + id).classList.remove("hidden");
    }
    function hideModals() {
      $("#overlay").classList.add("hidden");
      $("#modal-help").classList.add("hidden");
      $("#modal-stats").classList.add("hidden");
    }

    function showHelp() {
      showModal("modal-help");
      focusTyper();
    }

    function renderStatsModal() {
      var s = loadStats();
      $("#st-played").textContent = s.played;
      $("#st-winrate").textContent = s.played ? Math.round((s.wins / s.played) * 100) + "%" : "0%";
      $("#st-streak").textContent = s.streak;
      $("#st-best").textContent = s.maxStreak;
      var resEl = $("#stats-result");
      if (gameOver) {
        var label = won ? "本次：" + resultRows.length + "/6" : "未猜中";
        if (!won && answer) label += " · 答案是「" + answer + "」";
        resEl.textContent = label;
        resEl.classList.remove("hidden");
        $("#btn-share").disabled = resultRows.length === 0;
      } else {
        resEl.classList.add("hidden");
        $("#btn-share").disabled = true;
      }
      var dist = $("#st-dist");
      dist.innerHTML = "";
      var max = 1;
      for (var i = 0; i < s.dist.length; i++) max = Math.max(max, s.dist[i]);
      for (var j = 0; j < MAX_ATTEMPTS; j++) {
        var row = document.createElement("div");
        row.className = "dist-row";
        var count = s.dist[j] || 0;
        var bar = document.createElement("div");
        bar.className = "dist-bar";
        bar.style.width = (count / max) * 100 + "%";
        if (count > 0) {
          bar.style.minWidth = "22px";
        } else {
          bar.classList.add("zero");
        }
        bar.textContent = count;
        row.innerHTML = '<span class="dist-label">' + (j + 1) + "</span>";
        row.appendChild(bar);
        dist.appendChild(row);
      }
    }

    function showStatsModal() {
      renderStatsModal();
      showModal("modal-stats");
      focusTyper();
    }

    // ---------- 分享 ----------
    function copyText(text, done) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
          .writeText(text)
          .then(done)
          .catch(function () {
            fallbackCopy(text, done);
          });
      } else {
        fallbackCopy(text, done);
      }
    }
    function fallbackCopy(text, done) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        done();
      } catch (e) {}
      ta.remove();
    }
    function shareResult() {
      var rows = resultRows
        .map(function (r) {
          return r.result
            .map(function (x) {
              return x === "correct" ? "🟩" : x === "present" ? "🟨" : "⬜";
            })
            .join("");
        })
        .join("\n");
      var head = mode === "daily" ? "汉字Wordle 每日" : "汉字Wordle 随机";
      var text = head + " " + (won ? resultRows.length + "/6" : "X/6") + "\n" + rows;
      var btn = $("#btn-share");
      copyText(text, function () {
        var old = btn.textContent;
        btn.textContent = "已复制 ✓";
        setTimeout(function () {
          btn.textContent = old;
        }, 1600);
      });
    }

    // ---------- 彩带 ----------
    function confetti() {
      var canvas = document.createElement("canvas");
      canvas.className = "confetti";
      document.body.appendChild(canvas);
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      var ctx = canvas.getContext("2d");
      var colors = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93", "#ffffff"];
      var pieces = [];
      for (var i = 0; i < 150; i++) {
        pieces.push({
          x: Math.random() * canvas.width,
          y: -20 - Math.random() * canvas.height * 0.45,
          w: 6 + Math.random() * 6,
          h: 10 + Math.random() * 8,
          vx: (Math.random() - 0.5) * 3,
          vy: 2.2 + Math.random() * 4,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.2,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
      var frames = 0;
      (function tick() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var i = 0; i < pieces.length; i++) {
          var p = pieces[i];
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vr;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
        if (++frames < 240) requestAnimationFrame(tick);
        else canvas.remove();
      })();
    }

    // ---------- 开局 ----------
    function newGame(m) {
      mode = m;
      answer = mode === "daily" ? pickDaily() : pickRandom();
      currentRow = 0;
      currentGuess = "";
      gameOver = false;
      revealing = false;
      won = false;
      resultRows = [];
      pinyinBuf = "";
      $("#btn-daily").classList.toggle("active", mode === "daily");
      $("#btn-random").classList.toggle("active", mode === "random");
      $("#btn-daily").setAttribute("aria-selected", mode === "daily");
      $("#btn-random").setAttribute("aria-selected", mode === "random");
      $("#btn-newgame").style.display = mode === "random" ? "" : "none";
      buildBoard();
      clearTimeout(msgTimer);
      $("#message").textContent = HINT;
      $("#message").className = "";
      hideModals();
      renderCandidates();
    }

    // ---------- 事件 ----------
    function wireEvents() {
      var i;
      var letters = "abcdefghijklmnopqrstuvwxyz";
      var keysBox = $("#pinyin-keys");
      for (i = 0; i < letters.length; i++) {
        (function (letter) {
          var btn = document.createElement("button");
          btn.className = "py-key";
          btn.textContent = letter;
          btn.setAttribute("aria-label", letter);
          btn.addEventListener("click", function () {
            addPinyin(letter);
            focusTyper();
          });
          keysBox.appendChild(btn);
        })(letters[i]);
      }

      $("#btn-daily").addEventListener("click", function () {
        newGame("daily");
        focusTyper();
      });
      $("#btn-random").addEventListener("click", function () {
        newGame("random");
        focusTyper();
      });
      $("#btn-backspace").addEventListener("click", function () {
        removeChar();
        focusTyper();
      });
      $("#btn-clear-py").addEventListener("click", function () {
        clearPinyin();
        focusTyper();
      });
      $("#btn-enter").addEventListener("click", function () {
        submitGuess();
        focusTyper();
      });
      $("#btn-help").addEventListener("click", showHelp);
      $("#btn-help-close").addEventListener("click", hideModals);
      $("#btn-stats").addEventListener("click", showStatsModal);
      $("#btn-stats-close").addEventListener("click", hideModals);
      $("#btn-share").addEventListener("click", shareResult);
      $("#btn-newgame").addEventListener("click", function () {
        hideModals();
        newGame("random");
        focusTyper();
      });
      $("#overlay").addEventListener("click", hideModals);

      var typer = $("#typer");
      typer.addEventListener("compositionstart", function () {
        isComposing = true;
      });
      typer.addEventListener("compositionend", function (e) {
        isComposing = false;
        var val = e.target.value;
        e.target.value = "";
        if (val) {
          for (var k = 0; k < val.length; k++) addChar(val[k]);
        }
      });
      typer.addEventListener("input", function (e) {
        if (isComposing) return;
        var val = e.target.value;
        e.target.value = "";
        if (!val) return;
        if (/^[a-zA-Z]+$/.test(val)) {
          for (var k = 0; k < val.length; k++) addPinyin(val[k]);
          return;
        }
        for (var j = 0; j < val.length; j++) addChar(val[j]);
      });

      document.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          submitGuess();
          return;
        }
        if (e.key === "Backspace") {
          if (e.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          removeChar();
          return;
        }
        if (e.key === "Escape") {
          if (!$("#modal-help").classList.contains("hidden") || !$("#modal-stats").classList.contains("hidden")) {
            hideModals();
            focusTyper();
          } else {
            clearPinyin();
          }
        }
      });

      document.addEventListener("click", function (e) {
        if (!e.target.closest("button")) focusTyper();
      });

      var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      if (!coarse) focusTyper();
    }

    wireEvents();
    newGame("daily");
  }

  if (typeof module !== "undefined") {
    module.exports = {
      evaluate: evaluate,
      pickDaily: pickDaily,
      pickRandom: pickRandom,
      hashStr: hashStr,
      todayStr: todayStr,
      WORD_LEN: WORD_LEN,
      MAX_ATTEMPTS: MAX_ATTEMPTS,
    };
  }
})();
