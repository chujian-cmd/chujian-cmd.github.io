// Sand Toy - Falling Sand Simulation
// A cellular automaton where sand particles fall and pile up

const scale = 2;
const cellSize = 5; // Sand pixel size

function SandToy() {
  var canvas;
  var context;
  var bottle;
  var bottleNeck;
  var width;
  var height;
  var gridWidth;
  var gridHeight;
  var grid;
  var mask;
  var animationId;

  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;

  var currentColorIndex = 0;
  var colors = ["#e6c86e", "#d4a574", "#8fbc8f"]; // Sand, terracotta, sage

  // Potion bottle configs - each with distinct shape character
  const bottleConfigs = {
    small: {
      // Tall narrow flask shape
      w: 160,
      h: 260,
      neckW: 0.32,
      neckH: 22,
      topRadius: 0.18,
      bottomRadius: 0.28
    },
    medium: {
      // Classic rounded potion bottle
      w: 220,
      h: 310,
      neckW: 0.24,
      neckH: 24,
      topRadius: 0.10,
      bottomRadius: 0.42
    },
    large: {
      // Wide flask shape - narrower top, bulbous bottom
      w: 280,
      h: 360,
      neckW: 0.20,
      neckH: 28,
      topRadius: 0.15,
      bottomRadius: 0.45
    }
  };

  var currentConfig;

  this.initialize = function (size) {
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");
    bottle = document.querySelector(".bottle");
    bottleNeck = document.querySelector(".bottle-neck");

    currentConfig = bottleConfigs[size] || bottleConfigs.medium;

    // Set bottle size with potion shape
    bottle.style.width = currentConfig.w + "px";
    bottle.style.height = currentConfig.h + "px";
    const topR = Math.round(currentConfig.topRadius * 100);
    const bottomR = Math.round(currentConfig.bottomRadius * 100);
    bottle.style.borderRadius = `${topR}% ${topR}% ${bottomR}% ${bottomR}% / ${topR/2}% ${topR/2}% ${bottomR}% ${bottomR}%`;

    // Clear any clip-path from previous size
    bottle.style.clipPath = 'none';

    bottleNeck.style.width = Math.floor(currentConfig.w * currentConfig.neckW) + "px";
    bottleNeck.style.height = currentConfig.neckH + "px";

    // Set canvas size (scaled for retina)
    width = currentConfig.w * scale;
    height = currentConfig.h * scale;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = currentConfig.w + "px";
    canvas.style.height = currentConfig.h + "px";

    // Calculate grid dimensions
    gridWidth = Math.floor(width / cellSize);
    gridHeight = Math.floor(height / cellSize);

    // Initialize empty grid and mask
    grid = new Array(gridWidth);
    mask = new Array(gridWidth);
    for (let x = 0; x < gridWidth; x++) {
      grid[x] = new Array(gridHeight).fill(null);
      mask[x] = new Array(gridHeight).fill(true);
    }

    // Build potion bottle mask
    buildMask();

    // Remove old listeners and add new ones
    canvas.removeEventListener("mousedown", onDown);
    canvas.removeEventListener("mouseup", onUp);
    canvas.removeEventListener("mouseout", onUp);
    canvas.removeEventListener("mousemove", onMove);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchmove", onTouchMove);
    canvas.removeEventListener("touchend", onUp);
    canvas.removeEventListener("touchcancel", onUp);

    canvas.addEventListener("mousedown", onDown, false);
    canvas.addEventListener("mouseup", onUp, false);
    canvas.addEventListener("mouseout", onUp, false);
    canvas.addEventListener("mousemove", onMove, false);
    canvas.addEventListener("touchstart", onTouchStart, false);
    canvas.addEventListener("touchmove", onTouchMove, false);
    canvas.addEventListener("touchend", onUp, false);
    canvas.addEventListener("touchcancel", onUp, false);

    // Cancel previous animation and start new one
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    loop();
  };

  const buildMask = () => {
    const topR = currentConfig.topRadius;
    const bottomR = currentConfig.bottomRadius;

    // Corner radii in grid cells
    const topRadiusX = Math.floor(gridWidth * topR);
    const topRadiusY = Math.floor(gridHeight * topR * 0.5);
    const bottomRadiusX = Math.floor(gridWidth * bottomR);
    const bottomRadiusY = Math.floor(gridHeight * bottomR);

    // Offset to shift mask left (compensates for visual discrepancy)
    const leftOffset = 1;

    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        // Block bottom row to prevent sand falling out
        if (y >= gridHeight - 1) {
          mask[x][y] = false;
          continue;
        }

        mask[x][y] = true;

        // Adjusted x for left-side calculations (shift left)
        const xAdj = x + leftOffset;

        // Top-left corner
        if (xAdj < topRadiusX && y < topRadiusY) {
          const dx = (topRadiusX - xAdj) / topRadiusX;
          const dy = (topRadiusY - y) / topRadiusY;
          if (dx * dx + dy * dy > 1) {
            mask[x][y] = false;
          }
        }
        // Top-right corner
        if (x >= gridWidth - topRadiusX && y < topRadiusY) {
          const dx = (x - (gridWidth - topRadiusX - 1)) / topRadiusX;
          const dy = (topRadiusY - y) / topRadiusY;
          if (dx * dx + dy * dy > 1) {
            mask[x][y] = false;
          }
        }
        // Bottom-left corner
        if (xAdj < bottomRadiusX && y >= gridHeight - bottomRadiusY) {
          const dx = (bottomRadiusX - xAdj) / bottomRadiusX;
          const dy = (y - (gridHeight - bottomRadiusY - 1)) / bottomRadiusY;
          if (dx * dx + dy * dy > 1) {
            mask[x][y] = false;
          }
        }
        // Bottom-right corner
        if (x >= gridWidth - bottomRadiusX && y >= gridHeight - bottomRadiusY) {
          const dx = (x - (gridWidth - bottomRadiusX - 1)) / bottomRadiusX;
          const dy = (y - (gridHeight - bottomRadiusY - 1)) / bottomRadiusY;
          if (dx * dx + dy * dy > 1) {
            mask[x][y] = false;
          }
        }
      }
    }
  };

  const isValidCell = (x, y) => {
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return false;
    return mask[x][y];
  };

  this.setColor = function (index, newColor) {
    if (typeof newColor !== 'undefined') {
      colors[index] = newColor;
    }
    currentColorIndex = index;
  };

  this.getColors = function () {
    return colors;
  };

  this.getCurrentColorIndex = function () {
    return currentColorIndex;
  };

  this.clear = function () {
    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        grid[x][y] = null;
      }
    }
  };

  const onDown = (event) => {
    mouseDown = true;
    document.querySelector('.tip').style.display = 'none';
    updateMousePosition(event);
  };

  const onUp = () => {
    mouseDown = false;
  };

  const onMove = (event) => {
    updateMousePosition(event);
  };

  const onTouchStart = (event) => {
    event.preventDefault();
    mouseDown = true;
    document.querySelector('.tip').style.display = 'none';
    updateMousePosition(event);
  };

  const onTouchMove = (event) => {
    event.preventDefault();
    updateMousePosition(event);
  };

  const updateMousePosition = (event) => {
    const e = (event.touches && event.touches.item(0)) || event;
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * scale;
    mouseY = (e.clientY - rect.top) * scale;
  };

  const spawnSand = () => {
    if (!mouseDown) return;

    const count = 6;
    const spread = cellSize * 5;

    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * spread;
      const offsetY = (Math.random() - 0.5) * spread;

      const gridX = Math.floor((mouseX + offsetX) / cellSize);
      const gridY = Math.floor((mouseY + offsetY) / cellSize);

      if (isValidCell(gridX, gridY) && grid[gridX][gridY] === null) {
        grid[gridX][gridY] = varyColor(colors[currentColorIndex]);
      }
    }
  };

  const varyColor = (baseColor) => {
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    const variation = 20;
    const newR = Math.max(0, Math.min(255, r + (Math.random() - 0.5) * variation));
    const newG = Math.max(0, Math.min(255, g + (Math.random() - 0.5) * variation));
    const newB = Math.max(0, Math.min(255, b + (Math.random() - 0.5) * variation));

    return `rgb(${Math.floor(newR)}, ${Math.floor(newG)}, ${Math.floor(newB)})`;
  };

  const updatePhysics = () => {
    for (let y = gridHeight - 2; y >= 0; y--) {
      // Randomize x processing order for natural tumbling
      const startX = Math.random() < 0.5 ? 0 : gridWidth - 1;
      const endX = startX === 0 ? gridWidth : -1;
      const step = startX === 0 ? 1 : -1;

      for (let x = startX; x !== endX; x += step) {
        if (grid[x][y] === null) continue;
        if (!mask[x][y]) continue;

        const particleColor = grid[x][y];

        // Try to move down
        if (isValidCell(x, y + 1) && grid[x][y + 1] === null) {
          grid[x][y + 1] = particleColor;
          grid[x][y] = null;
        } else {
          // Try diagonal
          const goLeft = Math.random() < 0.5;
          const leftX = x - 1;
          const rightX = x + 1;

          if (goLeft) {
            if (isValidCell(leftX, y + 1) && grid[leftX][y + 1] === null) {
              grid[leftX][y + 1] = particleColor;
              grid[x][y] = null;
            } else if (isValidCell(rightX, y + 1) && grid[rightX][y + 1] === null) {
              grid[rightX][y + 1] = particleColor;
              grid[x][y] = null;
            }
          } else {
            if (isValidCell(rightX, y + 1) && grid[rightX][y + 1] === null) {
              grid[rightX][y + 1] = particleColor;
              grid[x][y] = null;
            } else if (isValidCell(leftX, y + 1) && grid[leftX][y + 1] === null) {
              grid[leftX][y + 1] = particleColor;
              grid[x][y] = null;
            }
          }
        }
      }
    }
  };

  const render = () => {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        if (grid[x][y] !== null) {
          context.fillStyle = grid[x][y];
          context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
  };

  const physicsIterations = 12;

  const loop = () => {
    spawnSand();
    for (let i = 0; i < physicsIterations; i++) {
      updatePhysics();
    }
    render();
    animationId = requestAnimationFrame(loop);
  };
}
