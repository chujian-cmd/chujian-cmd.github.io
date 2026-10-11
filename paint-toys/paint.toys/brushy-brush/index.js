// Brushy Brush - Draw your brush, then paint with it

const scale = 2;

function BrushyBrush() {
  // Internal brush resolution - high so it stays crisp when scaled up
  var brushRes = 256;
  var brushCanvas, brushCtx;
  var mainCanvas, mainCtx;
  var width, height;

  var mouseDown = false;
  var brushColor = "#333333";
  var bgColor = "#ffffff";

  var canvasWrapper = document.querySelector(".canvas-wrapper");
  var canvasRect = canvasWrapper.getBoundingClientRect();

  // Thumbnail preview in toolbar
  var thumbEl = document.getElementById("brush-thumb");

  // Stamp settings
  var stampSpacing = 0.119;
  var remainder = 0;
  var rotateWithStroke = true;
  var stampScale = 2.0;
  var velocitySwing = 0.5; // 0 = no velocity effect, 1 = max shrink on fast strokes

  // Spring-based brush position for elastic trailing feel
  var springStiffness = 0.08;
  var springDamping = 0.7;
  var smoothPos = { x: 0, y: 0 };
  var velocity = { x: 0, y: 0 };
  var targetPos = { x: 0, y: 0 };
  var prevSmooth = { x: 0, y: 0 };
  var smoothAngle = 0;
  var smoothSpeed = 0;
  var rawSpeed = 0;

  // --- Brush editor modal state ---
  var editorCanvas, editorCtx;
  var editorOpen = false;
  var editorTool = "draw"; // draw, line, fill, circle, rect, oval
  var editorLineWidth = 4;
  var editorMouseDown = false;
  var editorPrev = { x: 0, y: 0 };
  var editorPrev2 = { x: 0, y: 0 };
  var undoStack = [];
  var maxUndo = 30;
  var lineStart = null; // for line tool preview

  this.initialize = function () {
    mainCanvas = document.getElementById("canvas");
    mainCtx = mainCanvas.getContext("2d");

    width = (canvasRect.width - 40) * scale;
    height = (canvasRect.height - 40) * scale;

    mainCanvas.width = width;
    mainCanvas.height = height;
    mainCtx.scale(scale, scale);
    mainCtx.fillStyle = bgColor;
    mainCtx.fillRect(0, 0, width, height);

    // Internal brush canvas (offscreen, high-res)
    brushCanvas = document.createElement("canvas");
    brushCanvas.width = brushRes;
    brushCanvas.height = brushRes;
    brushCtx = brushCanvas.getContext("2d");

    // Thumb preview
    thumbEl.width = 128;
    thumbEl.height = 128;

    // Main canvas events
    mainCanvas.addEventListener("mousedown", onMainDown, false);
    mainCanvas.addEventListener("mousemove", onMainMove, false);
    mainCanvas.addEventListener("mouseup", onMainUp, false);
    mainCanvas.addEventListener("mouseout", onMainUp, false);
    mainCanvas.addEventListener("touchstart", onMainTouchDown, false);
    mainCanvas.addEventListener("touchmove", onMainMove, false);
    mainCanvas.addEventListener("touchend", onMainUp, false);
    mainCanvas.addEventListener("touchcancel", onMainUp, false);

    // Setup editor modal
    this._setupEditor();

    // Load default preset
    this.loadPreset("skull");

    // Render any saved brushes
    this.renderSavedBrushes();

    requestAnimationFrame(loop);
  };

  // --- Thumbnail sync ---
  function updateThumb() {
    var tCtx = thumbEl.getContext("2d");
    tCtx.clearRect(0, 0, 128, 128);
    tCtx.drawImage(brushCanvas, 0, 0, brushRes, brushRes, 0, 0, 128, 128);
  }

  // --- Animation loop (spring physics) ---
  function loop() {
    if (mouseDown) {
      // Spring force toward target
      var fx = (targetPos.x - smoothPos.x) * springStiffness;
      var fy = (targetPos.y - smoothPos.y) * springStiffness;
      velocity.x = (velocity.x + fx) * springDamping;
      velocity.y = (velocity.y + fy) * springDamping;
      smoothPos.x += velocity.x;
      smoothPos.y += velocity.y;

      var dx = smoothPos.x - prevSmooth.x;
      var dy = smoothPos.y - prevSmooth.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      // Track instantaneous speed and smooth it
      rawSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      smoothSpeed += (rawSpeed - smoothSpeed) * 0.15;

      if (dist > 0.3) {
        var rawAngle = Math.atan2(dy, dx);
        var angleDiff = rawAngle - smoothAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        smoothAngle += angleDiff * 0.25;

        var baseSize = 64 * stampScale;
        var spacing = Math.max(baseSize * stampSpacing, 1);

        var traveled = remainder;
        while (traveled < dist) {
          var t = traveled / dist;
          var sx = prevSmooth.x + dx * t;
          var sy = prevSmooth.y + dy * t;

          // Velocity scaling: slow = full size, fast = smaller based on swing amount
          var speedFactor = Math.min(smoothSpeed / 12, 1);
          var velScale = stampScale * (1.0 - Math.pow(speedFactor, 0.6) * 0.85 * velocitySwing);

          stampAt(sx, sy, rotateWithStroke ? smoothAngle : 0, velScale);
          traveled += spacing;
        }
        remainder = traveled - dist;

        prevSmooth.x = smoothPos.x;
        prevSmooth.y = smoothPos.y;
      }
    }
    requestAnimationFrame(loop);
  }

  this.clearBrush = function () {
    brushCtx.clearRect(0, 0, brushRes, brushRes);
    updateThumb();
    undoStack = [];
    if (editorCtx) {
      editorCtx.clearRect(0, 0, brushRes, brushRes);
    }
  };

  this.fillBackground = function (color) {
    bgColor = color;
    mainCtx.fillStyle = color;
    mainCtx.fillRect(0, 0, width, height);
  };

  this.setBrushColor = function (color) {
    brushColor = color;
  };

  this.setStampSpacing = function (s) {
    stampSpacing = s;
  };

  this.setStampScale = function (s) {
    stampScale = s;
  };

  this.setRotation = function (enabled) {
    rotateWithStroke = enabled;
  };

  this.setVelocitySwing = function (v) {
    velocitySwing = v;
  };

  // =============================================
  // SAVED BRUSHES (localStorage)
  // =============================================
  var STORAGE_KEY = "brushybrush_saved";
  var MAX_SAVED = 12;

  function getSavedBrushes() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveBrushesToStorage(brushes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(brushes));
    } catch (e) {}
  }

  this.saveBrush = function () {
    // Save current brush canvas as data URL
    var dataUrl = brushCanvas.toDataURL("image/png");
    var brushes = getSavedBrushes();
    brushes.unshift({ data: dataUrl, ts: Date.now() });
    if (brushes.length > MAX_SAVED) brushes.pop();
    saveBrushesToStorage(brushes);
    this.renderSavedBrushes();
  };

  this.loadSavedBrush = function (index) {
    var brushes = getSavedBrushes();
    if (!brushes[index]) return;
    var img = new Image();
    var self = this;
    img.onload = function () {
      brushCtx.clearRect(0, 0, brushRes, brushRes);
      brushCtx.drawImage(img, 0, 0, brushRes, brushRes);
      updateThumb();
      if (editorCtx) {
        editorCtx.clearRect(0, 0, brushRes, brushRes);
        editorCtx.drawImage(img, 0, 0, brushRes, brushRes);
      }
    };
    img.src = brushes[index].data;
  };

  this.deleteSavedBrush = function (index) {
    var brushes = getSavedBrushes();
    brushes.splice(index, 1);
    saveBrushesToStorage(brushes);
    this.renderSavedBrushes();
  };

  this.loadImageAsBrush = function(file) {
    var reader = new FileReader();
    var self = this;
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        self.clearBrush();
        brushCtx.imageSmoothingEnabled = true;
        brushCtx.imageSmoothingQuality = "high";
        var aspect = img.naturalWidth / img.naturalHeight;
        var dw, dh;
        if (aspect > 1) {
          dw = brushRes;
          dh = brushRes / aspect;
        } else {
          dh = brushRes;
          dw = brushRes * aspect;
        }
        var dx = (brushRes - dw) / 2;
        var dy = (brushRes - dh) / 2;
        brushCtx.drawImage(img, dx, dy, dw, dh);
        if (editorCtx) {
          editorCtx.clearRect(0, 0, brushRes, brushRes);
          editorCtx.drawImage(brushCanvas, 0, 0);
        }
        updateThumb();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  this.renderSavedBrushes = function () {
    var brushes = getSavedBrushes();

    // Modal saved brushes grid
    var container = document.getElementById("saved-brushes");
    if (container) {
      container.innerHTML = "";
      for (var i = 0; i < brushes.length; i++) {
        var wrap = document.createElement("div");
        wrap.className = "saved-brush-item";
        wrap.dataset.index = i;

        var img = document.createElement("img");
        img.src = brushes[i].data;
        img.width = 48;
        img.height = 48;

        var del = document.createElement("button");
        del.className = "saved-brush-delete";
        del.innerHTML = "&times;";
        del.dataset.index = i;

        wrap.appendChild(img);
        wrap.appendChild(del);
        container.appendChild(wrap);
      }
    }

    // Toolbar saved brushes
    var toolbar = document.getElementById("toolbar-saved");
    if (toolbar) {
      toolbar.innerHTML = "";
      for (var i = 0; i < brushes.length; i++) {
        var btn = document.createElement("button");
        btn.className = "preset-btn toolbar-saved-btn";
        btn.dataset.savedIndex = i;
        btn.title = "Saved brush " + (i + 1);
        var img = document.createElement("img");
        img.src = brushes[i].data;
        img.width = 24;
        img.height = 24;
        img.style.borderRadius = "4px";
        btn.appendChild(img);
        toolbar.appendChild(btn);
      }
    }
  };

  // =============================================
  // BRUSH EDITOR MODAL
  // =============================================
  this._setupEditor = function () {
    var modal = document.getElementById("brush-modal");
    editorCanvas = document.getElementById("editor-canvas");
    editorCanvas.width = brushRes;
    editorCanvas.height = brushRes;
    editorCtx = editorCanvas.getContext("2d");

    // Sync current brush into editor
    editorCtx.drawImage(brushCanvas, 0, 0);

    // Drawing events
    editorCanvas.addEventListener("mousedown", onEditorDown, false);
    editorCanvas.addEventListener("mousemove", onEditorMove, false);
    editorCanvas.addEventListener("mouseup", onEditorUp, false);
    editorCanvas.addEventListener("mouseout", onEditorUp, false);
    editorCanvas.addEventListener("touchstart", onEditorTouchDown, false);
    editorCanvas.addEventListener("touchmove", onEditorMove, false);
    editorCanvas.addEventListener("touchend", onEditorUp, false);
    editorCanvas.addEventListener("touchcancel", onEditorUp, false);
  };

  this.openEditor = function () {
    editorOpen = true;
    // Sync brush into editor
    editorCtx.clearRect(0, 0, brushRes, brushRes);
    editorCtx.drawImage(brushCanvas, 0, 0);
    undoStack = [];
    pushUndo();
    document.getElementById("brush-modal").classList.add("open");
  };

  this.closeEditor = function () {
    editorOpen = false;
    // Sync editor back to brush
    brushCtx.clearRect(0, 0, brushRes, brushRes);
    brushCtx.drawImage(editorCanvas, 0, 0);
    updateThumb();
    document.getElementById("brush-modal").classList.remove("open");
  };

  this.setEditorTool = function (tool) {
    editorTool = tool;
    lineStart = null;
    // Update button states
    document.querySelectorAll(".editor-tool-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tool === tool);
    });
    editorCanvas.style.cursor = (tool === "fill" || tool === "circle" || tool === "rect" || tool === "oval") ? "crosshair" : "default";
  };

  this.setEditorLineWidth = function (w) {
    editorLineWidth = w;
  };

  this.editorUndo = function () {
    if (undoStack.length > 1) {
      undoStack.pop();
      var imgData = undoStack[undoStack.length - 1];
      editorCtx.clearRect(0, 0, brushRes, brushRes);
      editorCtx.putImageData(imgData, 0, 0);
    }
  };

  function pushUndo() {
    if (undoStack.length >= maxUndo) undoStack.shift();
    undoStack.push(editorCtx.getImageData(0, 0, brushRes, brushRes));
  }

  function getEditorPos(e) {
    var rect = editorCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (brushRes / rect.width),
      y: (e.clientY - rect.top) * (brushRes / rect.height),
    };
  }

  var onEditorDown = function (event) {
    event.preventDefault();
    editorMouseDown = true;
    var pos = getEditorPos(event);

    if (editorTool === "fill") {
      floodFill(pos.x, pos.y, brushColor);
      pushUndo();
      return;
    }

    if (editorTool === "line" || editorTool === "circle" || editorTool === "rect" || editorTool === "oval") {
      lineStart = { x: pos.x, y: pos.y };
      // Save state for preview overlay
      pushUndo();
      return;
    }

    // draw tool
    editorPrev.x = pos.x;
    editorPrev.y = pos.y;
    editorPrev2.x = pos.x;
    editorPrev2.y = pos.y;
  };

  var onEditorTouchDown = function (event) {
    event.preventDefault();
    var e = (event.touches && event.touches.item(0)) || event;
    editorMouseDown = true;
    var pos = getEditorPos(e);

    if (editorTool === "fill") {
      floodFill(pos.x, pos.y, brushColor);
      pushUndo();
      return;
    }

    if (editorTool === "line" || editorTool === "circle" || editorTool === "rect" || editorTool === "oval") {
      lineStart = { x: pos.x, y: pos.y };
      pushUndo();
      return;
    }

    editorPrev.x = pos.x;
    editorPrev.y = pos.y;
    editorPrev2.x = pos.x;
    editorPrev2.y = pos.y;
  };

  var onEditorMove = function (event) {
    if (!editorMouseDown) return;
    event.preventDefault();
    var e = (event.touches && event.touches.item(0)) || event;
    var pos = getEditorPos(e);

    if (editorTool === "line" && lineStart) {
      // Preview: restore last undo, draw line on top
      var imgData = undoStack[undoStack.length - 1];
      editorCtx.putImageData(imgData, 0, 0);
      editorCtx.save();
      editorCtx.strokeStyle = brushColor;
      editorCtx.lineWidth = editorLineWidth;
      editorCtx.lineCap = "round";
      editorCtx.beginPath();
      editorCtx.moveTo(lineStart.x, lineStart.y);
      editorCtx.lineTo(pos.x, pos.y);
      editorCtx.stroke();
      editorCtx.restore();
      return;
    }

    if ((editorTool === "circle" || editorTool === "rect" || editorTool === "oval") && lineStart) {
      var imgData = undoStack[undoStack.length - 1];
      editorCtx.putImageData(imgData, 0, 0);
      editorCtx.save();
      editorCtx.strokeStyle = brushColor;
      editorCtx.lineWidth = editorLineWidth;
      editorCtx.lineCap = "round";
      editorCtx.lineJoin = "round";
      if (editorTool === "circle") {
        var dx = pos.x - lineStart.x;
        var dy = pos.y - lineStart.y;
        var radius = Math.sqrt(dx * dx + dy * dy);
        editorCtx.beginPath();
        editorCtx.arc(lineStart.x, lineStart.y, radius, 0, Math.PI * 2);
        editorCtx.stroke();
      } else if (editorTool === "rect") {
        editorCtx.beginPath();
        editorCtx.rect(lineStart.x, lineStart.y, pos.x - lineStart.x, pos.y - lineStart.y);
        editorCtx.stroke();
      } else if (editorTool === "oval") {
        var cx = (lineStart.x + pos.x) / 2;
        var cy = (lineStart.y + pos.y) / 2;
        var rx = Math.abs(pos.x - lineStart.x) / 2;
        var ry = Math.abs(pos.y - lineStart.y) / 2;
        editorCtx.beginPath();
        editorCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        editorCtx.stroke();
      }
      editorCtx.restore();
      return;
    }

    if (editorTool === "draw") {
      var midX = (editorPrev.x + pos.x) / 2;
      var midY = (editorPrev.y + pos.y) / 2;

      editorCtx.save();
      editorCtx.strokeStyle = brushColor;
      editorCtx.lineWidth = editorLineWidth;
      editorCtx.lineCap = "round";
      editorCtx.lineJoin = "round";
      editorCtx.beginPath();
      editorCtx.moveTo(editorPrev2.x, editorPrev2.y);
      editorCtx.quadraticCurveTo(editorPrev.x, editorPrev.y, midX, midY);
      editorCtx.stroke();
      editorCtx.restore();

      editorPrev2.x = midX;
      editorPrev2.y = midY;
      editorPrev.x = pos.x;
      editorPrev.y = pos.y;
    }
  };

  var onEditorUp = function (event) {
    if (!editorMouseDown) return;
    editorMouseDown = false;

    if ((editorTool === "line" || editorTool === "circle" || editorTool === "rect" || editorTool === "oval") && lineStart) {
      // Shape/line is already drawn from preview, just finalize
      lineStart = null;
    }

    pushUndo();
  };

  // --- Flood fill ---
  function floodFill(startX, startY, fillColor) {
    var x = Math.floor(startX);
    var y = Math.floor(startY);
    var imageData = editorCtx.getImageData(0, 0, brushRes, brushRes);
    var data = imageData.data;
    var w = brushRes;
    var h = brushRes;

    // Parse fill color
    var fc = hexToRgb(fillColor);
    var idx = (y * w + x) * 4;
    var targetR = data[idx], targetG = data[idx + 1], targetB = data[idx + 2], targetA = data[idx + 3];

    // Don't fill if same color
    if (targetR === fc.r && targetG === fc.g && targetB === fc.b && targetA === 255) return;

    var stack = [[x, y]];
    var visited = new Uint8Array(w * h);
    var tolerance = 32;

    function matches(i) {
      return Math.abs(data[i] - targetR) <= tolerance &&
             Math.abs(data[i + 1] - targetG) <= tolerance &&
             Math.abs(data[i + 2] - targetB) <= tolerance &&
             Math.abs(data[i + 3] - targetA) <= tolerance;
    }

    while (stack.length > 0) {
      var pt = stack.pop();
      var px = pt[0], py = pt[1];
      if (px < 0 || px >= w || py < 0 || py >= h) continue;
      var pi = py * w + px;
      if (visited[pi]) continue;
      var di = pi * 4;
      if (!matches(di)) continue;

      visited[pi] = 1;
      data[di] = fc.r;
      data[di + 1] = fc.g;
      data[di + 2] = fc.b;
      data[di + 3] = 255;

      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }

    editorCtx.putImageData(imageData, 0, 0);
  }

  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return { r: r, g: g, b: b };
  }

  // =============================================
  // PRESET BRUSH SHAPES (procedural)
  // =============================================

  var presets = {

    // --- Skull: built from circles and shapes, ornate ---
    skull: function (ctx, s) {
      var h = s / 2, c = brushColor;
      ctx.strokeStyle = c;

      // Cranium - large circle, white filled
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(h, h - s*0.06, s*0.28, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Jaw circle overlapping
      ctx.beginPath(); ctx.arc(h, h + s*0.14, s*0.2, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Cheek circles
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h - s*0.2, h + s*0.04, s*0.1, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.2, h + s*0.04, s*0.1, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Eye sockets - circles with inner circles
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h - s*0.11, h - s*0.1, s*0.09, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h - s*0.11, h - s*0.1, s*0.06, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.strokeStyle = c; ctx.stroke();
      ctx.beginPath(); ctx.arc(h - s*0.11, h - s*0.1, s*0.03, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      // tiny highlight
      ctx.beginPath(); ctx.arc(h - s*0.1, h - s*0.12, s*0.012, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill();

      ctx.beginPath(); ctx.arc(h + s*0.11, h - s*0.1, s*0.09, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h + s*0.11, h - s*0.1, s*0.06, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.11, h - s*0.1, s*0.03, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h + s*0.12, h - s*0.12, s*0.012, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill();

      // Nose - inverted triangle of circles
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(h - s*0.03, h + s*0.06, s*0.025, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(h + s*0.03, h + s*0.06, s*0.025, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(h, h + s*0.09, s*0.02, 0, Math.PI * 2); ctx.fill();

      // Teeth - row of white-filled rectangles
      ctx.lineWidth = 1.5;
      for (var i = -3; i <= 3; i++) {
        var tx = h + i * s * 0.04;
        ctx.beginPath();
        ctx.rect(tx - s*0.015, h + s*0.17, s*0.03, s*0.06);
        ctx.fillStyle = "white"; ctx.fill(); ctx.strokeStyle = c; ctx.stroke();
      }

      // Decorative circles around cranium
      ctx.lineWidth = 1;
      for (var i = 0; i < 12; i++) {
        var a = (Math.PI * 2 * i) / 12 - Math.PI * 0.1;
        var r = s * 0.32;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * r, h - s*0.06 + Math.sin(a) * r, s*0.02, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      }
      // Smaller dot ring
      for (var i = 0; i < 18; i++) {
        var a = (Math.PI * 2 * i) / 18;
        var r = s * 0.37;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * r, h - s*0.06 + Math.sin(a) * r, s*0.008, 0, Math.PI * 2);
        ctx.fillStyle = c; ctx.fill();
      }

      // Brow ridge - thick arc
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(h, h - s*0.06, s*0.22, Math.PI + 0.4, Math.PI * 2 - 0.4);
      ctx.stroke();

      // Forehead circles
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(h, h - s*0.28, s*0.04, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h, h - s*0.28, s*0.015, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h - s*0.08, h - s*0.26, s*0.025, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.08, h - s*0.26, s*0.025, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Temple crack lines with circles at junctions
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(h - s*0.28, h - s*0.08); ctx.lineTo(h - s*0.34, h);
      ctx.lineTo(h - s*0.32, h + s*0.06); ctx.stroke();
      ctx.beginPath(); ctx.arc(h - s*0.34, h, s*0.012, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(h + s*0.28, h - s*0.08); ctx.lineTo(h + s*0.34, h);
      ctx.lineTo(h + s*0.32, h + s*0.06); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.34, h, s*0.012, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
    },

    // --- Moth: circles for eyespots, layered wing shapes ---
    moth: function (ctx, s) {
      var h = s / 2, c = brushColor;
      ctx.strokeStyle = c;

      // Upper wings - large rounded shapes, white filled
      ctx.lineWidth = 2;
      // Left upper
      ctx.beginPath();
      ctx.arc(h - s*0.2, h - s*0.1, s*0.18, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      // Right upper
      ctx.beginPath();
      ctx.arc(h + s*0.2, h - s*0.1, s*0.18, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Lower wings - smaller circles
      ctx.beginPath();
      ctx.arc(h - s*0.16, h + s*0.16, s*0.12, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.arc(h + s*0.16, h + s*0.16, s*0.12, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Wing tips - tiny circles bubbling off wings
      ctx.lineWidth = 1.2;
      var bubbles = [
        [-0.36, -0.14, 0.04], [-0.34, -0.24, 0.035], [-0.28, -0.28, 0.03],
        [-0.18, -0.3, 0.025], [-0.38, -0.04, 0.03], [-0.32, 0.04, 0.025],
        [0.36, -0.14, 0.04], [0.34, -0.24, 0.035], [0.28, -0.28, 0.03],
        [0.18, -0.3, 0.025], [0.38, -0.04, 0.03], [0.32, 0.04, 0.025],
        [-0.26, 0.26, 0.03], [-0.2, 0.3, 0.025], [-0.12, 0.28, 0.02],
        [0.26, 0.26, 0.03], [0.2, 0.3, 0.025], [0.12, 0.28, 0.02]
      ];
      for (var i = 0; i < bubbles.length; i++) {
        ctx.beginPath();
        ctx.arc(h + bubbles[i][0] * s, h + bubbles[i][1] * s, bubbles[i][2] * s, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      }

      // Eyespots - concentric circles on upper wings
      // Left
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h - s*0.22, h - s*0.12, s*0.1, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h - s*0.22, h - s*0.12, s*0.075, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h - s*0.22, h - s*0.12, s*0.05, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h - s*0.22, h - s*0.12, s*0.03, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h - s*0.22, h - s*0.12, s*0.012, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      // Right
      ctx.beginPath(); ctx.arc(h + s*0.22, h - s*0.12, s*0.1, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h + s*0.22, h - s*0.12, s*0.075, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.22, h - s*0.12, s*0.05, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h + s*0.22, h - s*0.12, s*0.03, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.22, h - s*0.12, s*0.012, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();

      // Lower wing eyespots - smaller
      ctx.beginPath(); ctx.arc(h - s*0.16, h + s*0.16, s*0.06, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h - s*0.16, h + s*0.16, s*0.04, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h - s*0.16, h + s*0.16, s*0.018, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h + s*0.16, h + s*0.16, s*0.06, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h + s*0.16, h + s*0.16, s*0.04, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.16, h + s*0.16, s*0.018, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();

      // Body - stack of circles
      ctx.lineWidth = 1.5;
      var bodyR = [0.035, 0.03, 0.028, 0.025, 0.022, 0.02, 0.018];
      for (var i = 0; i < bodyR.length; i++) {
        var by = h - s*0.08 + i * s*0.05;
        ctx.beginPath(); ctx.arc(h, by, bodyR[i] * s, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      }

      // Head circle
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h, h - s*0.14, s*0.04, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      // Head eyes - tiny dots
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(h - s*0.02, h - s*0.14, s*0.01, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(h + s*0.02, h - s*0.14, s*0.01, 0, Math.PI * 2); ctx.fill();

      // Antennae with circles at tips
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(h - s*0.02, h - s*0.17);
      ctx.bezierCurveTo(h - s*0.08, h - s*0.28, h - s*0.14, h - s*0.34, h - s*0.18, h - s*0.38);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(h - s*0.18, h - s*0.38, s*0.02, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(h + s*0.02, h - s*0.17);
      ctx.bezierCurveTo(h + s*0.08, h - s*0.28, h + s*0.14, h - s*0.34, h + s*0.18, h - s*0.38);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.18, h - s*0.38, s*0.02, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Dot trails along wing edges
      ctx.fillStyle = c;
      for (var i = 0; i < 8; i++) {
        var a = Math.PI * 0.6 + (Math.PI * 0.9 * i) / 8;
        ctx.beginPath();
        ctx.arc(h - s*0.2 + Math.cos(a) * s*0.19, h - s*0.1 + Math.sin(a) * s*0.19, s*0.006, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(h + s*0.2 - Math.cos(a) * s*0.19, h - s*0.1 + Math.sin(a) * s*0.19, s*0.006, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    // --- Octopus: head of circles, tentacles of graduated circles ---
    octopus: function (ctx, s) {
      var h = s / 2, c = brushColor;
      ctx.strokeStyle = c;

      // Tentacles - chains of shrinking circles
      var tentData = [
        { sx: -0.2, sy: 0.06, curves: [[0.06, 0.15], [-0.08, 0.24], [0.04, 0.34], [-0.06, 0.42]] },
        { sx: -0.12, sy: 0.08, curves: [[-0.02, 0.18], [0.04, 0.28], [-0.02, 0.38], [0.02, 0.46]] },
        { sx: -0.04, sy: 0.08, curves: [[-0.08, 0.18], [-0.12, 0.28], [-0.06, 0.38], [-0.1, 0.44]] },
        { sx: 0.04, sy: 0.08, curves: [[0.08, 0.18], [0.12, 0.28], [0.06, 0.38], [0.1, 0.44]] },
        { sx: 0.12, sy: 0.08, curves: [[0.02, 0.18], [-0.04, 0.28], [0.02, 0.38], [-0.02, 0.46]] },
        { sx: 0.2, sy: 0.06, curves: [[-0.06, 0.15], [0.08, 0.24], [-0.04, 0.34], [0.06, 0.42]] }
      ];

      for (var t = 0; t < tentData.length; t++) {
        var td = tentData[t];
        var pts = [[td.sx, td.sy]].concat(td.curves);
        for (var p = 0; p < pts.length; p++) {
          var r = s * (0.04 - p * 0.007);
          if (r < s * 0.008) r = s * 0.008;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(h + pts[p][0] * s, h + pts[p][1] * s, r, 0, Math.PI * 2);
          ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
          // Suction cup dot
          if (p > 0) {
            ctx.beginPath();
            ctx.arc(h + pts[p][0] * s, h + pts[p][1] * s, r * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = c; ctx.fill();
          }
        }
        // Connect with lines
        ctx.lineWidth = 1;
        for (var p = 0; p < pts.length - 1; p++) {
          ctx.beginPath();
          ctx.moveTo(h + pts[p][0] * s, h + pts[p][1] * s);
          ctx.lineTo(h + pts[p+1][0] * s, h + pts[p+1][1] * s);
          ctx.stroke();
        }
      }

      // Head - large circle, white filled
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(h, h - s*0.12, s*0.22, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Head bumps - circles on top
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h - s*0.08, h - s*0.32, s*0.05, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.08, h - s*0.32, s*0.05, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h, h - s*0.34, s*0.04, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Eyes - concentric circles
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h - s*0.1, h - s*0.12, s*0.07, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h - s*0.1, h - s*0.12, s*0.045, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h - s*0.1, h - s*0.12, s*0.025, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill();
      ctx.beginPath(); ctx.arc(h - s*0.09, h - s*0.14, s*0.01, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill();

      ctx.beginPath(); ctx.arc(h + s*0.1, h - s*0.12, s*0.07, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.1, h - s*0.12, s*0.045, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h + s*0.1, h - s*0.12, s*0.025, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill();
      ctx.beginPath(); ctx.arc(h + s*0.11, h - s*0.14, s*0.01, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill();

      // Head spots - scattered circles
      ctx.lineWidth = 1;
      var spots = [[-0.02, -0.24, 0.018], [0.06, -0.26, 0.014], [-0.1, -0.22, 0.012],
                   [0.12, -0.2, 0.01], [0, -0.04, 0.015], [-0.06, -0.02, 0.01]];
      for (var i = 0; i < spots.length; i++) {
        ctx.beginPath();
        ctx.arc(h + spots[i][0] * s, h + spots[i][1] * s, spots[i][2] * s, 0, Math.PI * 2);
        ctx.fillStyle = c; ctx.fill();
      }
    },

    // --- Eye: concentric rings, radiating circles, triangle ---
    eye: function (ctx, s) {
      var h = s / 2, c = brushColor;
      ctx.strokeStyle = c;

      // Radiating dot ring - outermost
      ctx.fillStyle = c;
      for (var i = 0; i < 36; i++) {
        var a = (Math.PI * 2 * i) / 36;
        var r = (i % 3 === 0) ? s * 0.014 : s * 0.007;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.46, h + Math.sin(a) * s * 0.46, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ray circles - white filled circles radiating out
      ctx.lineWidth = 1;
      for (var i = 0; i < 16; i++) {
        var a = (Math.PI * 2 * i) / 16;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.38, h + Math.sin(a) * s * 0.38, s * 0.025, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      }

      // Triangle - white filled
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(h, h - s*0.34);
      ctx.lineTo(h - s*0.34, h + s*0.24);
      ctx.lineTo(h + s*0.34, h + s*0.24);
      ctx.closePath();
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Inner triangle
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(h, h - s*0.24);
      ctx.lineTo(h - s*0.24, h + s*0.16);
      ctx.lineTo(h + s*0.24, h + s*0.16);
      ctx.closePath();
      ctx.stroke();

      // Circles at triangle corners
      ctx.lineWidth = 1.5;
      var corners = [[h, h - s*0.34], [h - s*0.34, h + s*0.24], [h + s*0.34, h + s*0.24]];
      for (var i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(corners[i][0], corners[i][1], s*0.03, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(corners[i][0], corners[i][1], s*0.012, 0, Math.PI * 2);
        ctx.fillStyle = c; ctx.fill();
      }

      // Eye - outer circle
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h, h, s*0.14, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Iris ring
      ctx.beginPath(); ctx.arc(h, h, s*0.1, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h, h, s*0.075, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h, h, s*0.05, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h, h, s*0.03, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill();
      ctx.beginPath(); ctx.arc(h, h, s*0.015, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();

      // Iris spokes - lines between rings
      ctx.strokeStyle = c; ctx.lineWidth = 0.8;
      for (var i = 0; i < 16; i++) {
        var a = (Math.PI * 2 * i) / 16;
        ctx.beginPath();
        ctx.moveTo(h + Math.cos(a) * s*0.05, h + Math.sin(a) * s*0.05);
        ctx.lineTo(h + Math.cos(a) * s*0.075, h + Math.sin(a) * s*0.075);
        ctx.stroke();
      }

      // Eyelid arcs with dot details
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h, h, s*0.18, Math.PI + 0.3, -0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(h, h, s*0.18, 0.3, Math.PI - 0.3);
      ctx.stroke();

      // Small circles along eyelid arcs
      ctx.lineWidth = 1;
      for (var i = 0; i < 8; i++) {
        var a = Math.PI + 0.5 + (i / 7) * (Math.PI - 1);
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s*0.18, h + Math.sin(a) * s*0.18, s*0.012, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      }

      // Tear drop - circle
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h, h + s*0.24, s*0.025, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h, h + s*0.24, s*0.01, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
    },

    // --- Rose: circles for petals, spiraling outward ---
    rose: function (ctx, s) {
      var h = s / 2, c = brushColor;
      ctx.strokeStyle = c;

      // Stem
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(h, h + s*0.12);
      ctx.bezierCurveTo(h + s*0.02, h + s*0.24, h - s*0.02, h + s*0.34, h, h + s*0.46);
      ctx.stroke();

      // Leaves - circles and arcs
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h + s*0.08, h + s*0.26, s*0.05, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.14, h + s*0.24, s*0.035, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.18, h + s*0.23, s*0.02, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      // Leaf veins
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(h + s*0.04, h + s*0.26);
      ctx.lineTo(h + s*0.18, h + s*0.24);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h - s*0.06, h + s*0.34, s*0.04, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h - s*0.12, h + s*0.34, s*0.03, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h - s*0.16, h + s*0.35, s*0.018, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Outer petal ring - large circles arranged in a ring
      ctx.lineWidth = 1.8;
      for (var i = 0; i < 7; i++) {
        var a = (Math.PI * 2 * i) / 7 - Math.PI / 2;
        var px = h + Math.cos(a) * s * 0.2;
        var py = h - s*0.04 + Math.sin(a) * s * 0.2;
        ctx.beginPath(); ctx.arc(px, py, s * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      }

      // Mid petals - smaller circle ring
      for (var i = 0; i < 5; i++) {
        var a = (Math.PI * 2 * i) / 5 - Math.PI / 2 + 0.3;
        var px = h + Math.cos(a) * s * 0.1;
        var py = h - s*0.04 + Math.sin(a) * s * 0.1;
        ctx.beginPath(); ctx.arc(px, py, s * 0.065, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      }

      // Center circles
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h, h - s*0.04, s * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h, h - s*0.04, s * 0.035, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h, h - s*0.04, s * 0.018, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill();

      // Dot ring between petal rings
      ctx.fillStyle = c;
      for (var i = 0; i < 14; i++) {
        var a = (Math.PI * 2 * i) / 14;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.15, h - s*0.04 + Math.sin(a) * s * 0.15, s * 0.006, 0, Math.PI * 2);
        ctx.fill();
      }

      // Outer dot ring
      for (var i = 0; i < 20; i++) {
        var a = (Math.PI * 2 * i) / 20;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.3, h - s*0.04 + Math.sin(a) * s * 0.3, s * 0.005, 0, Math.PI * 2);
        ctx.fill();
      }

      // Thorns - small triangles
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(h + s*0.015, h + s*0.2); ctx.lineTo(h + s*0.04, h + s*0.17);
      ctx.lineTo(h + s*0.01, h + s*0.18); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(h - s*0.01, h + s*0.38); ctx.lineTo(h - s*0.04, h + s*0.35);
      ctx.lineTo(h - s*0.005, h + s*0.36); ctx.stroke();
    },

    // --- Mandala: pure circles and shapes, radiating layers ---
    mandala: function (ctx, s) {
      var h = s / 2, c = brushColor;
      ctx.strokeStyle = c;

      // Outermost - ring of circles
      ctx.lineWidth = 1;
      for (var i = 0; i < 24; i++) {
        var a = (Math.PI * 2 * i) / 24;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.44, h + Math.sin(a) * s * 0.44, s * 0.022, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      }

      // Outer ring
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h, h, s * 0.42, 0, Math.PI * 2); ctx.stroke();

      // Large petal circles - 8
      ctx.lineWidth = 1.5;
      for (var i = 0; i < 8; i++) {
        var a = (Math.PI * 2 * i) / 8;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.3, h + Math.sin(a) * s * 0.3, s * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
        // Inner circle in each petal
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.3, h + Math.sin(a) * s * 0.3, s * 0.05, 0, Math.PI * 2);
        ctx.fillStyle = c; ctx.fill();
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.3, h + Math.sin(a) * s * 0.3, s * 0.03, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill();
      }

      // Mid ring of smaller circles - 8, offset
      for (var i = 0; i < 8; i++) {
        var a = (Math.PI * 2 * i) / 8 + Math.PI / 8;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.22, h + Math.sin(a) * s * 0.22, s * 0.045, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.22, h + Math.sin(a) * s * 0.22, s * 0.02, 0, Math.PI * 2);
        ctx.fillStyle = c; ctx.fill();
      }

      // Inner ring
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h, h, s * 0.15, 0, Math.PI * 2); ctx.stroke();

      // Inner circles - 6
      ctx.lineWidth = 1.2;
      for (var i = 0; i < 6; i++) {
        var a = (Math.PI * 2 * i) / 6;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.12, h + Math.sin(a) * s * 0.12, s * 0.03, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      }

      // Dot rings
      ctx.fillStyle = c;
      for (var i = 0; i < 16; i++) {
        var a = (Math.PI * 2 * i) / 16;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.36, h + Math.sin(a) * s * 0.36, s * 0.006, 0, Math.PI * 2);
        ctx.fill();
      }

      // Connecting lines between rings
      ctx.lineWidth = 0.8;
      for (var i = 0; i < 8; i++) {
        var a = (Math.PI * 2 * i) / 8;
        ctx.beginPath();
        ctx.moveTo(h + Math.cos(a) * s * 0.15, h + Math.sin(a) * s * 0.15);
        ctx.lineTo(h + Math.cos(a) * s * 0.2, h + Math.sin(a) * s * 0.2);
        ctx.stroke();
      }

      // Center - concentric
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h, h, s * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h, h, s * 0.045, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h, h, s * 0.025, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill();
      ctx.beginPath(); ctx.arc(h, h, s * 0.012, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
    },

    // --- Dragon: serpentine body of overlapping circles ---
    dragon: function (ctx, s) {
      var h = s / 2, c = brushColor;
      ctx.strokeStyle = c;

      // Body path - chain of overlapping white circles
      var bodyPts = [
        [0.18, 0.34, 0.04], [0.12, 0.28, 0.045], [0.04, 0.24, 0.05],
        [-0.06, 0.22, 0.05], [-0.14, 0.16, 0.05], [-0.18, 0.08, 0.055],
        [-0.16, -0.02, 0.055], [-0.1, -0.1, 0.06], [-0.02, -0.14, 0.06],
        [0.08, -0.12, 0.06], [0.16, -0.06, 0.055], [0.2, 0.04, 0.05],
        [0.18, 0.14, 0.045], [0.1, 0.2, 0.04]
      ];
      // Draw body circles back to front
      ctx.lineWidth = 1.5;
      for (var i = bodyPts.length - 1; i >= 0; i--) {
        var bp = bodyPts[i];
        ctx.beginPath();
        ctx.arc(h + bp[0] * s, h + bp[1] * s, bp[2] * s, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
        // Scale pattern
        if (i > 0 && i < bodyPts.length - 1) {
          ctx.beginPath();
          ctx.arc(h + bp[0] * s, h + bp[1] * s, bp[2] * s * 0.5, Math.PI * 0.8, Math.PI * 2.2);
          ctx.lineWidth = 0.8; ctx.stroke(); ctx.lineWidth = 1.5;
        }
      }

      // Tail - shrinking circles
      var tailPts = [
        [0.22, 0.38, 0.03], [0.26, 0.4, 0.022], [0.3, 0.38, 0.016],
        [0.32, 0.34, 0.012], [0.34, 0.3, 0.008]
      ];
      for (var i = 0; i < tailPts.length; i++) {
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(h + tailPts[i][0] * s, h + tailPts[i][1] * s, tailPts[i][2] * s, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      }
      // Tail fin circles
      ctx.beginPath(); ctx.arc(h + s*0.36, h + s*0.28, s*0.02, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.38, h + s*0.26, s*0.015, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Head - larger circle cluster
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h - s*0.02, h - s*0.14, s*0.1, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      // Snout
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h - s*0.14, h - s*0.18, s*0.06, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h - s*0.2, h - s*0.2, s*0.035, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      // Nostrils
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(h - s*0.22, h - s*0.22, s*0.01, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(h - s*0.19, h - s*0.23, s*0.008, 0, Math.PI * 2); ctx.fill();

      // Horns - stacked circles
      ctx.lineWidth = 1.2;
      var hornL = [[-0.06, -0.24, 0.025], [-0.08, -0.3, 0.02], [-0.06, -0.35, 0.015], [-0.04, -0.39, 0.01]];
      var hornR = [[0.06, -0.22, 0.025], [0.1, -0.28, 0.02], [0.12, -0.33, 0.015], [0.14, -0.37, 0.01]];
      for (var i = 0; i < hornL.length; i++) {
        ctx.beginPath(); ctx.arc(h + hornL[i][0]*s, h + hornL[i][1]*s, hornL[i][2]*s, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(h + hornR[i][0]*s, h + hornR[i][1]*s, hornR[i][2]*s, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      }

      // Eye - concentric
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h + s*0.02, h - s*0.16, s*0.035, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.02, h - s*0.16, s*0.02, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h + s*0.025, h - s*0.17, s*0.008, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill();

      // Whiskers - lines with circle tips
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(h - s*0.2, h - s*0.16);
      ctx.bezierCurveTo(h - s*0.28, h - s*0.2, h - s*0.32, h - s*0.18, h - s*0.36, h - s*0.2);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(h - s*0.36, h - s*0.2, s*0.008, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(h - s*0.18, h - s*0.14);
      ctx.bezierCurveTo(h - s*0.26, h - s*0.1, h - s*0.32, h - s*0.12, h - s*0.36, h - s*0.1);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(h - s*0.36, h - s*0.1, s*0.008, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Spine dots along back
      ctx.fillStyle = c;
      for (var i = 0; i < 10; i++) {
        var bp = bodyPts[i + 1];
        if (!bp) break;
        var a = Math.atan2(bp[1] - bodyPts[i][1], bp[0] - bodyPts[i][0]) - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(h + bp[0]*s + Math.cos(a)*bp[2]*s*0.8, h + bp[1]*s + Math.sin(a)*bp[2]*s*0.8, s*0.006, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    // --- Compass: circles upon circles, star geometry ---
    compass: function (ctx, s) {
      var h = s / 2, c = brushColor;
      ctx.strokeStyle = c;

      // Outer ring - white filled
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h, h, s * 0.44, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Ring of circles on outer edge
      ctx.lineWidth = 1;
      for (var i = 0; i < 32; i++) {
        var a = (Math.PI * 2 * i) / 32;
        var r = (i % 4 === 0) ? s * 0.025 : (i % 2 === 0) ? s * 0.015 : s * 0.008;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.44, h + Math.sin(a) * s * 0.44, r, 0, Math.PI * 2);
        ctx.fillStyle = (i % 4 === 0) ? "white" : c;
        ctx.fill();
        if (i % 4 === 0) ctx.stroke();
      }

      // 8-point star with alternating fills
      for (var i = 0; i < 8; i++) {
        var a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
        var aNext = (Math.PI * 2 * (i + 0.5)) / 8 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(h, h);
        ctx.lineTo(h + Math.cos(a) * s * 0.38, h + Math.sin(a) * s * 0.38);
        ctx.lineTo(h + Math.cos(aNext) * s * 0.16, h + Math.sin(aNext) * s * 0.16);
        ctx.closePath();
        ctx.fillStyle = (i % 2 === 0) ? c : "white";
        ctx.fill();
        ctx.lineWidth = 1.5; ctx.stroke();
      }

      // Mid ring
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h, h, s * 0.28, 0, Math.PI * 2); ctx.stroke();

      // Circles on mid ring
      ctx.lineWidth = 1;
      for (var i = 0; i < 16; i++) {
        var a = (Math.PI * 2 * i) / 16;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.28, h + Math.sin(a) * s * 0.28, s * 0.015, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      }

      // Inner circle - white filled
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h, h, s * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Cardinal circles - larger, at N/S/E/W
      ctx.lineWidth = 1.5;
      var cardinals = [-Math.PI/2, 0, Math.PI/2, Math.PI];
      for (var i = 0; i < 4; i++) {
        var a = cardinals[i];
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.38, h + Math.sin(a) * s * 0.38, s * 0.035, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.38, h + Math.sin(a) * s * 0.38, s * 0.015, 0, Math.PI * 2);
        ctx.fillStyle = c; ctx.fill();
      }

      // Center - concentric circles
      ctx.beginPath(); ctx.arc(h, h, s * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(h, h, s * 0.035, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill();
      ctx.beginPath(); ctx.arc(h, h, s * 0.018, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
    },

    // --- Jellyfish: dome of circles, tentacle chains ---
    jellyfish: function (ctx, s) {
      var h = s / 2, c = brushColor;
      ctx.strokeStyle = c;

      // Tentacles - chains of shrinking circles, wavy
      ctx.lineWidth = 1;
      for (var t = 0; t < 7; t++) {
        var tx = h + (-0.18 + t * 0.06) * s;
        var dir = (t % 2 === 0) ? 1 : -1;
        for (var d = 0; d < 8; d++) {
          var frac = d / 8;
          var wobble = Math.sin(d * 1.8 + t) * s * 0.03 * dir;
          var cx = tx + wobble;
          var cy = h + s * 0.06 + d * s * 0.05;
          var r = s * (0.02 - frac * 0.012);
          if (r < s * 0.005) r = s * 0.005;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
        }
      }

      // Inner frills - small circles
      for (var i = 0; i < 9; i++) {
        var fx = h + (-0.16 + i * 0.04) * s;
        ctx.beginPath();
        ctx.arc(fx, h + s*0.04, s * 0.018, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      }

      // Bell dome - large circle, white filled
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(h, h - s*0.12, s * 0.24, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Bell top bump circles
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h, h - s*0.34, s * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h - s*0.06, h - s*0.32, s * 0.03, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(h + s*0.06, h - s*0.32, s * 0.03, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.stroke();

      // Bell pattern - concentric rings inside
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(h, h - s*0.12, s * 0.18, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(h, h - s*0.12, s * 0.12, 0, Math.PI * 2); ctx.stroke();

      // Spots inside bell - circles
      ctx.lineWidth = 1;
      var bellSpots = [
        [-0.08, -0.18, 0.03], [0.06, -0.2, 0.025], [0.0, -0.08, 0.035],
        [-0.12, -0.08, 0.02], [0.1, -0.1, 0.022], [0.02, -0.26, 0.02],
        [-0.06, -0.14, 0.015], [0.08, -0.04, 0.018]
      ];
      for (var i = 0; i < bellSpots.length; i++) {
        var sp = bellSpots[i];
        ctx.beginPath();
        ctx.arc(h + sp[0] * s, h + sp[1] * s, sp[2] * s, 0, Math.PI * 2);
        ctx.fillStyle = c; ctx.fill();
        // White center in larger spots
        if (sp[2] > 0.02) {
          ctx.beginPath();
          ctx.arc(h + sp[0] * s, h + sp[1] * s, sp[2] * s * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = "white"; ctx.fill();
        }
      }

      // Dot ring around bell
      ctx.fillStyle = c;
      for (var i = 0; i < 16; i++) {
        var a = (Math.PI * 2 * i) / 16;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * s * 0.26, h - s*0.12 + Math.sin(a) * s * 0.26, s * 0.006, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  this.loadPreset = function (name) {
    if (!presets[name]) return;
    this.clearBrush();
    var ctx = brushCtx;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    presets[name](ctx, brushRes);
    if (editorCtx) {
      editorCtx.clearRect(0, 0, brushRes, brushRes);
      editorCtx.drawImage(brushCanvas, 0, 0);
    }
    updateThumb();
  };


  // =============================================
  // MAIN CANVAS STAMPING
  // =============================================
  var onMainDown = function (event) {
    if (editorOpen) return;
    event.preventDefault();
    mouseDown = true;
    document.querySelector(".tip").style.display = "none";
    var pos = getMainPos(event);
    targetPos.x = pos.x;
    targetPos.y = pos.y;
    smoothPos.x = pos.x;
    smoothPos.y = pos.y;
    prevSmooth.x = pos.x;
    prevSmooth.y = pos.y;
    smoothSpeed = 0;
    rawSpeed = 0;
    velocity.x = 0;
    velocity.y = 0;
    remainder = 0;
    stampAt(pos.x, pos.y, 0, stampScale);
  };

  var onMainTouchDown = function (event) {
    if (editorOpen) return;
    event.preventDefault();
    var e = (event.touches && event.touches.item(0)) || event;
    mouseDown = true;
    document.querySelector(".tip").style.display = "none";
    var pos = getMainPos(e);
    targetPos.x = pos.x;
    targetPos.y = pos.y;
    smoothPos.x = pos.x;
    smoothPos.y = pos.y;
    prevSmooth.x = pos.x;
    prevSmooth.y = pos.y;
    smoothSpeed = 0;
    rawSpeed = 0;
    velocity.x = 0;
    velocity.y = 0;
    remainder = 0;
    stampAt(pos.x, pos.y, 0, stampScale);
  };

  var onMainMove = function (event) {
    if (!mouseDown || editorOpen) return;
    event.preventDefault();
    var e = (event.touches && event.touches.item(0)) || event;
    var pos = getMainPos(e);
    targetPos.x = pos.x;
    targetPos.y = pos.y;
  };

  var onMainUp = function () {
    mouseDown = false;
  };

  function stampAt(x, y, angle, sScale) {
    var size = 64 * sScale;
    mainCtx.save();
    mainCtx.imageSmoothingEnabled = true;
    mainCtx.imageSmoothingQuality = "high";
    mainCtx.translate(x, y);
    if (angle !== 0) mainCtx.rotate(angle);
    mainCtx.drawImage(
      brushCanvas,
      0, 0, brushRes, brushRes,
      -size / 2, -size / 2,
      size, size
    );
    mainCtx.restore();
  }

  function getMainPos(e) {
    return {
      x: e.clientX - (canvasRect.left + 20),
      y: e.clientY - (canvasRect.top + 20),
    };
  }
}
