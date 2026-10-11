// Tessellation Painter
// Draw in one tile and watch your pattern tessellate across the canvas

const scale = 2;

function TessellationPainter() {
  var canvas;
  var context;
  var canvasWidth;
  var canvasHeight;

  var tileCanvas = document.createElement("canvas");
  var tileCtx = tileCanvas.getContext("2d");

  var tileSizes = [70, 120, 200];
  var tileSizeIndex = 1;
  var tileSize = tileSizes[1];

  // Brush state (laggy brush matching symmetry painter)
  var mouseDown = false;
  var hasStarted = false;
  var targetPos = { x: 0, y: 0 };
  var brushPos = { x: 0, y: 0 };
  var prevBrushPos = { x: 0, y: 0 };
  var lagFactor = 0.06;

  var currentColorIndex = 0;
  var colors = ["#333333", "#e07a5f", "#81b29a"];
  var bgColor = "#ffffff";

  var minBrushSize = 3;
  var maxBrushSize = 5;

  var tileMode = "grid";
  var tileShape = "square";
  var showEdges = true;
  var seamlessWrap = true;
  var animationId;

  var canvasWrapper;
  var canvasRect;

  this.initialize = function () {
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");
    canvasWrapper = document.querySelector(".canvas-wrapper");
    canvasRect = canvasWrapper.getBoundingClientRect();

    canvasWidth = canvasRect.width - 40;
    canvasHeight = canvasRect.height - 40;

    canvas.width = canvasWidth * scale;
    canvas.height = canvasHeight * scale;
    context.scale(scale, scale);

    canvas.addEventListener("mousedown", onDown, false);
    canvas.addEventListener("mousemove", onMove, false);
    canvas.addEventListener("mouseup", onEnd, false);
    canvas.addEventListener("mouseleave", onEnd, false);
    canvas.addEventListener("touchstart", onTouchStart, false);
    canvas.addEventListener("touchmove", onMove, false);
    canvas.addEventListener("touchend", onEnd, false);
    canvas.addEventListener("touchcancel", onEnd, false);

    initTileCanvas();
    renderTiled();

    if (animationId) cancelAnimationFrame(animationId);
    loop();
  };

  // --- Public API ---

  this.setColor = function (index, newColor) {
    if (typeof newColor !== "undefined") colors[index] = newColor;
    currentColorIndex = index;
  };

  this.fillBackground = function (color) {
    bgColor = color;
    fillTile(color);
    renderTiled();
  };

  this.getBgColor = function () {
    return bgColor;
  };

  this.setShape = function (shape) {
    tileShape = shape;
    if (tileShape !== "square") tileMode = "grid";
    initTileCanvas();
    renderTiled();
    return tileMode;
  };

  this.cycleTileMode = function () {
    if (tileShape === "square") {
      var modes = ["grid", "brick", "mirror"];
      var idx = modes.indexOf(tileMode);
      tileMode = modes[(idx + 1) % modes.length];
    } else {
      tileMode = "grid";
    }
    renderTiled();
    return tileMode;
  };

  this.getTileMode = function () {
    return tileMode;
  };

  this.setTileMode = function (mode) {
    tileMode = mode;
    renderTiled();
  };

  this.setShowEdges = function (on) {
    showEdges = on;
    renderTiled();
  };

  this.getShowEdges = function () {
    return showEdges;
  };

  this.setSeamlessWrap = function (on) {
    seamlessWrap = on;
  };

  this.getSeamlessWrap = function () {
    return seamlessWrap;
  };

  this.setDensity = function (index) {
    // Save old tile content
    var oldCanvas = document.createElement("canvas");
    var oldCtx = oldCanvas.getContext("2d");
    oldCanvas.width = tileCanvas.width;
    oldCanvas.height = tileCanvas.height;
    oldCtx.drawImage(tileCanvas, 0, 0);

    var oldTw = getTileWidth();
    var oldTh = getTileHeight();

    tileSizeIndex = index;
    tileSize = tileSizes[index];
    initTileCanvas();

    // Scale old drawing into new tile size
    var newTw = getTileWidth();
    var newTh = getTileHeight();
    tileCtx.drawImage(oldCanvas, 0, 0, oldTw * scale, oldTh * scale, 0, 0, newTw, newTh);

    renderTiled();
  };

  this.getDensity = function () {
    return tileSizeIndex;
  };

  // --- Tile canvas ---

  function initTileCanvas() {
    if (tileShape === "hexagon" || tileShape === "triangle") {
      tileCanvas.width = tileSize * scale;
      tileCanvas.height = Math.round(tileSize * Math.sqrt(3) / 2) * scale;
    } else {
      tileCanvas.width = tileSize * scale;
      tileCanvas.height = tileSize * scale;
    }
    tileCtx.setTransform(1, 0, 0, 1, 0, 0);
    tileCtx.scale(scale, scale);
    fillTile(bgColor);
  }

  function getTileWidth() {
    return tileCanvas.width / scale;
  }

  function getTileHeight() {
    return tileCanvas.height / scale;
  }

  function fillTile(color) {
    tileCtx.fillStyle = color;
    tileCtx.fillRect(0, 0, getTileWidth(), getTileHeight());
  }

  // --- Coordinate mapping ---

  function toTileCoords(x, y) {
    var tw = getTileWidth();
    var th = getTileHeight();

    if (tileShape === "hexagon") {
      var hSpacing = tw * 3 / 4;
      var vSpacing = th;

      // Approximate column from horizontal position
      var col = Math.round(x / hSpacing);
      var baseRow;
      if (col % 2 !== 0) {
        baseRow = Math.round((y - vSpacing / 2) / vSpacing);
      } else {
        baseRow = Math.round(y / vSpacing);
      }

      // Find nearest hex center among candidates
      var bestDist = Infinity, bestTlx = 0, bestTly = 0;
      for (var dc = -1; dc <= 1; dc++) {
        for (var dr = -1; dr <= 1; dr++) {
          var c = col + dc, r = baseRow + dr;
          var tlx = c * hSpacing;
          var tly = r * vSpacing;
          if (c % 2 !== 0) tly += vSpacing / 2;
          var cx = tlx + tw / 2;
          var cy = tly + th / 2;
          var d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if (d < bestDist) {
            bestDist = d;
            bestTlx = tlx;
            bestTly = tly;
          }
        }
      }

      return { tx: x - bestTlx, ty: y - bestTly };
    }

    if (tileShape === "triangle") {
      var halfW = tw / 2;
      var tRow = Math.floor(y / th);
      var tCol = Math.floor(x / halfW);
      var lx = x - tCol * halfW;
      var ly = y - tRow * th;

      // Determine if the point is in an upward or downward triangle.
      // Each halfW x th cell is split diagonally between an up and down triangle.
      var isInDown;
      if ((tCol + tRow) % 2 === 0) {
        // Diagonal from (0, th) to (halfW, 0): below = up, above = down
        isInDown = ly < th * (1 - lx / halfW);
      } else {
        // Diagonal from (0, 0) to (halfW, th): above line = down, below = up
        isInDown = ly < th * lx / halfW;
      }

      // Find the render-column of the triangle we're in
      var renderCol;
      if (isInDown) {
        renderCol = ((tCol + tRow) % 2 === 0) ? tCol - 1 : tCol;
      } else {
        renderCol = ((tCol + tRow) % 2 === 0) ? tCol : tCol - 1;
      }

      var originX = renderCol * halfW;
      var originY = tRow * th;
      var ttx = x - originX;
      var tty;
      if (isInDown) {
        // Down triangles render with translate(0, th) + scale(1, -1), so invert y
        tty = th - (y - originY);
      } else {
        tty = y - originY;
      }

      return { tx: ttx, ty: tty };
    }

    // Square: brick mode — compensate for row offset
    if (tileMode === "brick") {
      var row = Math.floor(y / th);
      var effX = x;
      if (row % 2 === 1) effX += tw / 2;
      return {
        tx: ((effX % tw) + tw) % tw,
        ty: ((y % th) + th) % th
      };
    }

    // Square: mirror mode — flip coords in alternating tiles
    if (tileMode === "mirror") {
      var mCol = Math.floor(x / tw);
      var mRow = Math.floor(y / th);
      var mtx = ((x % tw) + tw) % tw;
      var mty = ((y % th) + th) % th;
      if (mCol % 2 === 1) mtx = tw - mtx;
      if (mRow % 2 === 1) mty = th - mty;
      return { tx: mtx, ty: mty };
    }

    // Square: grid mode
    return {
      tx: ((x % tw) + tw) % tw,
      ty: ((y % th) + th) % th
    };
  }

  function drawOnTile(x1, y1, x2, y2, brushSize) {
    var tw = getTileWidth();
    var th = getTileHeight();
    var t1 = toTileCoords(x1, y1);
    var t2 = toTileCoords(x2, y2);

    tileCtx.strokeStyle = colors[currentColorIndex];
    tileCtx.lineWidth = brushSize;
    tileCtx.lineCap = "round";
    tileCtx.lineJoin = "round";

    var dtx = t2.tx - t1.tx;
    var dty = t2.ty - t1.ty;
    var crossesBoundary = Math.abs(dtx) > tw / 2 || Math.abs(dty) > th / 2;

    if (!crossesBoundary) {
      // Normal case — no boundary crossing
      tileCtx.beginPath();
      tileCtx.moveTo(t1.tx, t1.ty);
      tileCtx.lineTo(t2.tx, t2.ty);
      tileCtx.stroke();
      return;
    }

    if (!seamlessWrap) {
      // Skip mode — draw a dot at the new position (the "break" effect)
      tileCtx.beginPath();
      tileCtx.arc(t2.tx, t2.ty, brushSize / 2, 0, Math.PI * 2);
      tileCtx.fillStyle = colors[currentColorIndex];
      tileCtx.fill();
      return;
    }

    // Seamless wrapping — unwrap the delta and draw at 9 offsets
    // so the line continues across tile edges
    if (dtx > tw / 2) dtx -= tw;
    else if (dtx < -tw / 2) dtx += tw;
    if (dty > th / 2) dty -= th;
    else if (dty < -th / 2) dty += th;

    var t2x = t1.tx + dtx;
    var t2y = t1.ty + dty;

    for (var ox = -1; ox <= 1; ox++) {
      for (var oy = -1; oy <= 1; oy++) {
        tileCtx.beginPath();
        tileCtx.moveTo(t1.tx + ox * tw, t1.ty + oy * th);
        tileCtx.lineTo(t2x + ox * tw, t2y + oy * th);
        tileCtx.stroke();
      }
    }
  }

  // --- Rendering ---

  function renderSquareTiled() {
    context.fillStyle = bgColor;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    var cols = Math.ceil(canvasWidth / tileSize) + 1;
    var rows = Math.ceil(canvasHeight / tileSize) + 1;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var x = col * tileSize;
        var y = row * tileSize;

        context.save();

        if (tileMode === "brick") {
          if (row % 2 === 1) x -= tileSize / 2;
          context.translate(x, y);
          context.drawImage(tileCanvas, 0, 0, tileSize * scale, tileSize * scale, 0, 0, tileSize, tileSize);
        } else if (tileMode === "mirror") {
          context.translate(x, y);
          if (col % 2 === 1) { context.translate(tileSize, 0); context.scale(-1, 1); }
          if (row % 2 === 1) { context.translate(0, tileSize); context.scale(1, -1); }
          context.drawImage(tileCanvas, 0, 0, tileSize * scale, tileSize * scale, 0, 0, tileSize, tileSize);
        } else {
          context.translate(x, y);
          context.drawImage(tileCanvas, 0, 0, tileSize * scale, tileSize * scale, 0, 0, tileSize, tileSize);
        }

        context.restore();
      }
    }

    if (showEdges) {
      context.strokeStyle = "rgba(0, 0, 0, 0.06)";
      context.lineWidth = 1;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var ex = c * tileSize;
          var ey = r * tileSize;
          if (tileMode === "brick" && r % 2 === 1) ex -= tileSize / 2;
          context.strokeRect(ex, ey, tileSize, tileSize);
        }
      }
    }
  }

  function renderTriangleTiled() {
    context.fillStyle = bgColor;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    var tw = getTileWidth();
    var th = getTileHeight();
    var halfW = tw / 2;

    var cols = Math.ceil(canvasWidth / halfW) + 4;
    var rows = Math.ceil(canvasHeight / th) + 2;

    for (var row = -1; row < rows; row++) {
      for (var col = -2; col < cols; col++) {
        var x = col * halfW;
        var y = row * th;
        var isDown = (col + row) % 2 === 1;

        context.save();
        context.translate(x, y);

        if (isDown) {
          context.translate(0, th);
          context.scale(1, -1);
        }

        context.beginPath();
        context.moveTo(0, th);
        context.lineTo(halfW, 0);
        context.lineTo(tw, th);
        context.closePath();
        context.clip();

        context.drawImage(tileCanvas, 0, 0, tw * scale, th * scale, 0, 0, tw, th);
        context.restore();
      }
    }

    if (showEdges) {
      context.strokeStyle = "rgba(0, 0, 0, 0.06)";
      context.lineWidth = 1;
      for (var r = -1; r < rows; r++) {
        for (var c = -2; c < cols; c++) {
          var ex = c * halfW;
          var ey = r * th;
          var down = (c + r) % 2 === 1;
          context.beginPath();
          if (down) {
            context.moveTo(ex, ey);
            context.lineTo(ex + halfW, ey + th);
            context.lineTo(ex + tw, ey);
          } else {
            context.moveTo(ex, ey + th);
            context.lineTo(ex + halfW, ey);
            context.lineTo(ex + tw, ey + th);
          }
          context.closePath();
          context.stroke();
        }
      }
    }
  }

  function renderHexagonTiled() {
    context.fillStyle = bgColor;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    var tw = getTileWidth();
    var th = getTileHeight();
    var hSpacing = tw * 3 / 4;
    var vSpacing = th;

    var cols = Math.ceil(canvasWidth / hSpacing) + 2;
    var rows = Math.ceil(canvasHeight / vSpacing) + 2;

    for (var row = -1; row < rows; row++) {
      for (var col = -1; col < cols; col++) {
        var x = col * hSpacing;
        var y = row * vSpacing;
        if (col % 2 !== 0) y += vSpacing / 2;

        var cx = x + tw / 2;
        var cy = y + th / 2;

        context.save();

        context.beginPath();
        for (var i = 0; i < 6; i++) {
          var angle = (Math.PI / 3) * i;
          var hx = cx + (tw / 2) * Math.cos(angle);
          var hy = cy + (tw / 2) * Math.sin(angle);
          if (i === 0) context.moveTo(hx, hy);
          else context.lineTo(hx, hy);
        }
        context.closePath();
        context.clip();

        context.drawImage(tileCanvas, 0, 0, tw * scale, th * scale, x, y, tw, th);
        context.restore();
      }
    }

    if (showEdges) {
      context.strokeStyle = "rgba(0, 0, 0, 0.06)";
      context.lineWidth = 1;
      for (var r = -1; r < rows; r++) {
        for (var c = -1; c < cols; c++) {
          var ex = c * hSpacing;
          var ey = r * vSpacing;
          if (c % 2 !== 0) ey += vSpacing / 2;

          var ecx = ex + tw / 2;
          var ecy = ey + th / 2;

          context.beginPath();
          for (var j = 0; j < 6; j++) {
            var a = (Math.PI / 3) * j;
            var ehx = ecx + (tw / 2) * Math.cos(a);
            var ehy = ecy + (tw / 2) * Math.sin(a);
            if (j === 0) context.moveTo(ehx, ehy);
            else context.lineTo(ehx, ehy);
          }
          context.closePath();
          context.stroke();
        }
      }
    }
  }

  function renderTiled() {
    if (tileShape === "triangle") renderTriangleTiled();
    else if (tileShape === "hexagon") renderHexagonTiled();
    else renderSquareTiled();
  }

  // --- Input ---

  function getPos(event) {
    var e = (event.touches && event.touches.item(0)) || event;
    return {
      x: e.clientX - (20 + canvasRect.left),
      y: e.clientY - (20 + canvasRect.top)
    };
  }

  var onDown = function (event) {
    mouseDown = true;
    hasStarted = true;
    var tip = document.querySelector(".tip");
    if (tip) tip.style.display = "none";

    var pos = getPos(event);
    targetPos.x = pos.x;
    targetPos.y = pos.y;
    brushPos.x = pos.x;
    brushPos.y = pos.y;
    prevBrushPos.x = pos.x;
    prevBrushPos.y = pos.y;

    // Draw initial dot
    var t = toTileCoords(pos.x, pos.y);
    tileCtx.beginPath();
    tileCtx.arc(t.tx, t.ty, maxBrushSize / 2, 0, Math.PI * 2);
    tileCtx.fillStyle = colors[currentColorIndex];
    tileCtx.fill();
    renderTiled();
  };

  var onTouchStart = function (event) {
    event.preventDefault();
    onDown(event);
  };

  var onMove = function (event) {
    if (!mouseDown) return;
    if (event.touches) event.preventDefault();
    var e = (event.touches && event.touches.item(0)) || event;
    targetPos.x = e.clientX - (20 + canvasRect.left);
    targetPos.y = e.clientY - (20 + canvasRect.top);
  };

  var onEnd = function () {
    mouseDown = false;
  };

  // --- Animation loop ---

  var loop = function () {
    if (mouseDown && hasStarted) {
      prevBrushPos.x = brushPos.x;
      prevBrushPos.y = brushPos.y;

      brushPos.x += (targetPos.x - brushPos.x) * lagFactor;
      brushPos.y += (targetPos.y - brushPos.y) * lagFactor;

      var dx = brushPos.x - prevBrushPos.x;
      var dy = brushPos.y - prevBrushPos.y;
      var speed = Math.sqrt(dx * dx + dy * dy);

      if (speed > 0.1) {
        var speedFactor = Math.min(speed / 12, 1);
        var brushSize = maxBrushSize - (speedFactor * (maxBrushSize - minBrushSize));
        drawOnTile(prevBrushPos.x, prevBrushPos.y, brushPos.x, brushPos.y, brushSize);
        renderTiled();
      }
    }

    animationId = requestAnimationFrame(loop);
  };
}
