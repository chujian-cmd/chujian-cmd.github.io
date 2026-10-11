// Pixel Art Editor
// A full-featured pixel art tool for Paint Toys

const scale = 2;

const PALETTES = {
  "Pico-8": [
    "#000000","#1D2B53","#7E2553","#008751",
    "#AB5236","#5F574F","#C2C3C7","#FFF1E8",
    "#FF004D","#FFA300","#FFEC27","#00E436",
    "#29ADFF","#83769C","#FF77A8","#FFCCAA"
  ],
  "Game Boy": [
    "#0f380f","#306230","#8bac0f","#9bbc0f"
  ],
  "NES": [
    "#000000","#fcfcfc","#f8f8f8","#bcbcbc",
    "#7c7c7c","#a4e4fc","#3cbcfc","#0078f8",
    "#0000fc","#b8b8f8","#6888fc","#0058f8",
    "#0000bc","#d8b8f8","#9878f8","#6844fc",
    "#4428bc","#f8b8f8","#f878f8","#d800cc",
    "#940084","#f8a4c0","#f85898","#e40058",
    "#a80020","#f0d0b0","#f87858","#f83800",
    "#a81000","#fce0a8","#fca044","#e45c10",
    "#881400","#f8d878","#f8b800","#ac7c00",
    "#503000","#d8f878","#b8f818","#00b800",
    "#007800","#b8f8b8","#58d854","#00a800",
    "#006800","#b8f8d8","#58f898","#00a844",
    "#005800","#00fcfc","#00e8d8","#008888",
    "#004058","#f8d8f8","#787878","#080808"
  ],
  "Pastel": [
    "#f8f9fa","#ffc9c9","#fcc2d7","#eebefa",
    "#d0bfff","#bac8ff","#a5d8ff","#99e9f2",
    "#96f2d7","#b2f2bb","#d8f5a2","#ffec99",
    "#ffd8a8","#e9ecef","#dee2e6","#868e96"
  ],
  "Grayscale": [
    "#000000","#1a1a1a","#333333","#4d4d4d",
    "#666666","#808080","#999999","#b3b3b3",
    "#cccccc","#e6e6e6","#f2f2f2","#ffffff"
  ],
  "Endesga 32": [
    "#be4a2f","#d77643","#ead4aa","#e4a672",
    "#b86f50","#733e39","#3e2731","#a22633",
    "#e43b44","#f77622","#feae34","#fee761",
    "#63c74d","#3e8948","#265c42","#193c3e",
    "#124e89","#0099db","#2ce8f5","#ffffff",
    "#c0cbdc","#8b9bb4","#5a6988","#3a4466",
    "#262b44","#181425","#ff0044","#68386c",
    "#b55088","#f6757a","#e8b796","#c28569"
  ]
};

function PixelArtEditor() {
  // State
  let canvas, context, canvasWrapper, canvasRect;
  let gridWidth = 32;
  let gridHeight = 32;
  let pixels = [];
  let currentColor = "#000000";
  let bgColor = "#ffffff";
  let tool = "pen"; // pen, eraser, fill, eyedropper, line
  let showGrid = true;
  let mirrorX = false;
  let mouseDown = false;
  let lastPixel = null;
  let currentPaletteName = "Pico-8";
  let lineStart = null;

  // Undo/Redo
  let undoStack = [];
  let redoStack = [];
  let currentStroke = null;

  // Computed
  let cellSize;

  function createGrid() {
    pixels = [];
    for (let y = 0; y < gridHeight; y++) {
      pixels[y] = [];
      for (let x = 0; x < gridWidth; x++) {
        pixels[y][x] = null; // null = transparent (bg color)
      }
    }
  }

  function sizeCanvas() {
    canvasRect = canvasWrapper.getBoundingClientRect();
    const availW = canvasRect.width - 40;
    const availH = canvasRect.height - 40;

    // Uniform cell size: fit the grid as large as possible while keeping pixels square
    cellSize = Math.floor(Math.min(availW / gridWidth, availH / gridHeight));
    if (cellSize < 1) cellSize = 1;

    const drawW = cellSize * gridWidth;
    const drawH = cellSize * gridHeight;

    canvas.width = drawW * scale;
    canvas.height = drawH * scale;
    canvas.style.width = drawW + 'px';
    canvas.style.height = drawH + 'px';
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function draw() {
    const w = cellSize * gridWidth;
    const h = cellSize * gridHeight;

    // Background
    context.fillStyle = bgColor;
    context.fillRect(0, 0, w, h);

    // Pixels
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        if (pixels[y][x] !== null) {
          context.fillStyle = pixels[y][x];
          context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    // Grid
    if (showGrid) {
      context.strokeStyle = "rgba(0,0,0,0.1)";
      context.lineWidth = 0.5;
      context.beginPath();
      for (let x = 0; x <= gridWidth; x++) {
        context.moveTo(x * cellSize, 0);
        context.lineTo(x * cellSize, h);
      }
      for (let y = 0; y <= gridHeight; y++) {
        context.moveTo(0, y * cellSize);
        context.lineTo(w, y * cellSize);
      }
      context.stroke();
    }
  }

  function getPixelCoords(event) {
    const e = (event.touches && event.touches.item(0)) || event;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const gx = Math.floor(px / cellSize);
    const gy = Math.floor(py / cellSize);
    if (gx < 0 || gx >= gridWidth || gy < 0 || gy >= gridHeight) return null;
    return { x: gx, y: gy };
  }

  function setPixel(x, y, color) {
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return;
    const oldColor = pixels[y][x];
    if (oldColor === color) return;
    if (currentStroke) {
      currentStroke.push({ x, y, oldColor, newColor: color });
    }
    pixels[y][x] = color;
  }

  function applyTool(coords) {
    if (!coords) return;
    const { x, y } = coords;

    if (tool === "pen") {
      setPixel(x, y, currentColor);
      if (mirrorX) {
        setPixel(gridWidth - 1 - x, y, currentColor);
      }
    } else if (tool === "eraser") {
      setPixel(x, y, null);
      if (mirrorX) {
        setPixel(gridWidth - 1 - x, y, null);
      }
    }
    draw();
  }

  function drawLine(x0, y0, x1, y1, color) {
    // Bresenham
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      setPixel(x0, y0, color);
      if (mirrorX) {
        setPixel(gridWidth - 1 - x0, y0, color);
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  function floodFill(startX, startY, fillColor) {
    const targetColor = pixels[startY][startX];
    if (targetColor === fillColor) return;

    const stack = [{ x: startX, y: startY }];
    const visited = new Set();

    while (stack.length > 0) {
      const { x, y } = stack.pop();
      const key = y * gridWidth + x;
      if (visited.has(key)) continue;
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) continue;
      if (pixels[y][x] !== targetColor) continue;

      visited.add(key);
      setPixel(x, y, fillColor);

      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }
  }

  function pushUndo(changes) {
    if (changes.length === 0) return;
    undoStack.push(changes);
    if (undoStack.length > 200) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0) return;
    const changes = undoStack.pop();
    const redoChanges = [];
    for (let i = changes.length - 1; i >= 0; i--) {
      const c = changes[i];
      redoChanges.push({ x: c.x, y: c.y, oldColor: pixels[c.y][c.x], newColor: c.oldColor });
      pixels[c.y][c.x] = c.oldColor;
    }
    redoStack.push(redoChanges);
    draw();
  }

  function redo() {
    if (redoStack.length === 0) return;
    const changes = redoStack.pop();
    const undoChanges = [];
    for (let i = changes.length - 1; i >= 0; i--) {
      const c = changes[i];
      undoChanges.push({ x: c.x, y: c.y, oldColor: pixels[c.y][c.x], newColor: c.newColor });
      pixels[c.y][c.x] = c.newColor;
    }
    undoStack.push(undoChanges);
    draw();
  }

  // --- Line tool preview ---
  function drawLinePreview(x0, y0, x1, y1) {
    draw(); // redraw base
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0, cy = y0;

    context.globalAlpha = 0.6;
    while (true) {
      if (cx >= 0 && cx < gridWidth && cy >= 0 && cy < gridHeight) {
        context.fillStyle = currentColor;
        context.fillRect(cx * cellSize, cy * cellSize, cellSize, cellSize);
        if (mirrorX) {
          context.fillRect((gridWidth - 1 - cx) * cellSize, cy * cellSize, cellSize, cellSize);
        }
      }
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }
    context.globalAlpha = 1.0;
  }

  // --- Interpolate between two pixel positions (for fast mouse movement) ---
  function interpolatePixels(from, to, color) {
    if (!from) {
      applyTool(to);
      return;
    }
    drawLine(from.x, from.y, to.x, to.y, tool === "eraser" ? null : color);
    draw();
  }

  // --- Event handlers ---
  function onDown(event) {
    event.preventDefault();
    mouseDown = true;
    document.querySelector('.tip').style.display = 'none';

    const coords = getPixelCoords(event);
    if (!coords) return;

    if (tool === "eyedropper") {
      const c = pixels[coords.y][coords.x];
      if (c !== null) {
        currentColor = c;
        document.querySelector('.custom-color-input').value = currentColor;
        highlightPaletteColor(currentColor);
      }
      return;
    }

    if (tool === "fill") {
      currentStroke = [];
      floodFill(coords.x, coords.y, currentColor);
      if (mirrorX) {
        floodFill(gridWidth - 1 - coords.x, coords.y, currentColor);
      }
      pushUndo(currentStroke);
      currentStroke = null;
      draw();
      return;
    }

    if (tool === "line") {
      lineStart = coords;
      return;
    }

    // pen / eraser
    currentStroke = [];
    lastPixel = coords;
    applyTool(coords);
  }

  function onMove(event) {
    event.preventDefault();
    if (!mouseDown) return;

    const coords = getPixelCoords(event);
    if (!coords) return;

    if (tool === "line" && lineStart) {
      drawLinePreview(lineStart.x, lineStart.y, coords.x, coords.y);
      return;
    }

    if (tool === "pen" || tool === "eraser") {
      interpolatePixels(lastPixel, coords, currentColor);
      lastPixel = coords;
    }
  }

  function onUp(event) {
    if (!mouseDown) return;
    mouseDown = false;

    if (tool === "line" && lineStart) {
      const coords = getPixelCoords(event);
      if (coords) {
        currentStroke = [];
        drawLine(lineStart.x, lineStart.y, coords.x, coords.y, currentColor);
        pushUndo(currentStroke);
        currentStroke = null;
        draw();
      }
      lineStart = null;
      return;
    }

    if (currentStroke) {
      pushUndo(currentStroke);
      currentStroke = null;
    }
    lastPixel = null;
  }

  function highlightPaletteColor(color) {
    document.querySelectorAll('.palette-color').forEach(el => {
      el.classList.toggle('active', el.dataset.color.toLowerCase() === color.toLowerCase());
    });
  }

  // --- Export (clean, no grid) ---
  function exportPNG(scaleFactor) {
    scaleFactor = scaleFactor || 16;
    const pxW = gridWidth * scaleFactor;
    const pxH = gridHeight * scaleFactor;
    const offCanvas = document.createElement("canvas");
    offCanvas.width = pxW;
    offCanvas.height = pxH;
    const offCtx = offCanvas.getContext("2d");

    offCtx.fillStyle = bgColor;
    offCtx.fillRect(0, 0, pxW, pxH);

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        if (pixels[y][x] !== null) {
          offCtx.fillStyle = pixels[y][x];
          offCtx.fillRect(x * scaleFactor, y * scaleFactor, scaleFactor, scaleFactor);
        }
      }
    }

    return offCanvas;
  }

  // --- Public API ---
  this.initialize = function () {
    canvasWrapper = document.querySelector('.canvas-wrapper');
    canvas = document.getElementById('canvas');
    context = canvas.getContext('2d');

    createGrid();
    sizeCanvas();
    draw();

    canvas.addEventListener('mousedown', onDown, false);
    canvas.addEventListener('mousemove', onMove, false);
    canvas.addEventListener('mouseup', onUp, false);
    canvas.addEventListener('mouseout', onUp, false);

    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp, false);
    canvas.addEventListener('touchcancel', onUp, false);
  };

  this.setTool = function (t) {
    tool = t;
    canvas.style.cursor =
      t === "eyedropper" ? "crosshair" :
      t === "fill" ? "cell" :
      t === "eraser" ? "not-allowed" :
      "crosshair";
  };

  this.setColor = function (color) {
    currentColor = color;
    document.querySelector('.custom-color-input').value = color;
    highlightPaletteColor(color);
  };

  this.setGridSize = function (w, h) {
    gridWidth = w;
    gridHeight = h;
    createGrid();
    sizeCanvas();
    undoStack = [];
    redoStack = [];
    draw();
  };

  this.toggleGrid = function () {
    showGrid = !showGrid;
    draw();
    return showGrid;
  };

  this.toggleMirror = function () {
    mirrorX = !mirrorX;
    return mirrorX;
  };

  this.clear = function () {
    currentStroke = [];
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        if (pixels[y][x] !== null) {
          setPixel(x, y, null);
        }
      }
    }
    pushUndo(currentStroke);
    currentStroke = null;
    draw();
  };

  this.undo = undo;
  this.redo = redo;

  this.setBgColor = function (color) {
    bgColor = color;
    draw();
  };

  this.save = function () {
    const offCanvas = exportPNG(16);
    offCanvas.toBlob(function (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("download", "paint-toys-pixel-art.png");
      a.setAttribute("href", url);
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  this.getCurrentColor = function () { return currentColor; };
  this.getShowGrid = function () { return showGrid; };
  this.getMirror = function () { return mirrorX; };
  this.getPalettes = function () { return PALETTES; };
  this.getCurrentPaletteName = function () { return currentPaletteName; };
  this.setCurrentPaletteName = function (name) { currentPaletteName = name; };
  this.getGridSize = function () { return { w: gridWidth, h: gridHeight }; };
}
