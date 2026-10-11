// Symmetry Painter
// Draw with radial symmetry - every stroke mirrors across multiple axes

const scale = 2;

function SymmetryPainter() {
  var canvas;
  var context;
  var width;
  var height;

  let mouseDown = false;
  let segments = 8;

  // Target position (where the mouse/touch is)
  var targetPos = { x: 0, y: 0 };
  // Current brush position (lags behind target)
  var brushPos = { x: 0, y: 0 };
  // Previous brush position (for drawing lines)
  var prevBrushPos = { x: 0, y: 0 };

  // Lag factor - lower = more lag (0.05 to 0.3 is nice range)
  const lagFactor = 0.06;

  var currentColorIndex = 0;
  var colors = ["#5b7eb5", "#e07a5f", "#81b29a"];
  var bgColor = "#f4f1eb";

  // Brush settings
  const minBrushSize = 4;
  const maxBrushSize = 6;

  var canvasWrapper;
  var canvasRect;
  var centerX, centerY;
  var animationId;
  var hasStarted = false;

  this.initialize = function () {
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");
    canvasWrapper = document.querySelector('.canvas-wrapper');
    canvasRect = canvasWrapper.getBoundingClientRect();

    width = (canvasRect.width - 40) * scale;
    height = (canvasRect.height - 40) * scale;

    canvas.width = width;
    canvas.height = height;

    context.scale(scale, scale);

    // Center point for symmetry
    centerX = (canvasRect.width - 40) / 2;
    centerY = (canvasRect.height - 40) / 2;

    // Initialize brush position to center
    brushPos.x = centerX;
    brushPos.y = centerY;
    prevBrushPos.x = centerX;
    prevBrushPos.y = centerY;
    targetPos.x = centerX;
    targetPos.y = centerY;

    canvas.addEventListener("mousemove", onMouseMove, false);
    canvas.addEventListener("mousedown", onDown, false);
    canvas.addEventListener("mouseup", onUp, false);
    canvas.addEventListener("mouseout", onUp, false);

    canvas.addEventListener("touchstart", onTouchStart, false);
    canvas.addEventListener("touchmove", onMouseMove, false);
    canvas.addEventListener("touchend", onUp, false);
    canvas.addEventListener("touchcancel", onUp, false);

    this.fillBackground(bgColor);

    // Start animation loop
    if (animationId) cancelAnimationFrame(animationId);
    loop();
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

  this.setSegments = function (num) {
    segments = num;
  };

  this.getSegments = function () {
    return segments;
  };

  this.setBgColor = function (color) {
    bgColor = color;
  };

  this.getBgColor = function () {
    return bgColor;
  };

  this.fillBackground = function (color) {
    bgColor = color;
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
  };

  const onDown = function (event) {
    mouseDown = true;
    hasStarted = true;
    document.querySelector('.tip').style.display = 'none';

    const e = (event.touches && event.touches.item(0)) || event;
    const x = e.clientX - (canvasRect.left + 20);
    const y = e.clientY - (canvasRect.top + 20);

    // Snap brush to target on mouse down
    targetPos.x = x;
    targetPos.y = y;
    brushPos.x = x;
    brushPos.y = y;
    prevBrushPos.x = x;
    prevBrushPos.y = y;
  };

  const onUp = function () {
    mouseDown = false;
  };

  const onTouchStart = function (event) {
    event.preventDefault();
    onDown(event);
  };

  const onMouseMove = function (event) {
    if (!mouseDown) return;

    const e = (event.touches && event.touches.item(0)) || event;
    targetPos.x = e.clientX - (canvasRect.left + 20);
    targetPos.y = e.clientY - (canvasRect.top + 20);
  };

  const loop = function () {
    if (mouseDown && hasStarted) {
      // Update brush position with lag
      prevBrushPos.x = brushPos.x;
      prevBrushPos.y = brushPos.y;

      brushPos.x += (targetPos.x - brushPos.x) * lagFactor;
      brushPos.y += (targetPos.y - brushPos.y) * lagFactor;

      // Calculate speed for variable brush width
      const dx = brushPos.x - prevBrushPos.x;
      const dy = brushPos.y - prevBrushPos.y;
      const speed = Math.sqrt(dx * dx + dy * dy);

      // Only draw if brush has moved enough
      if (speed > 0.1) {
        // Map speed to brush size (inverse - faster = thinner)
        // Speed typically ranges 0-20, map to brush size range
        const speedFactor = Math.min(speed / 12, 1);
        const brushSize = maxBrushSize - (speedFactor * (maxBrushSize - minBrushSize));

        drawSymmetricLine(prevBrushPos.x, prevBrushPos.y, brushPos.x, brushPos.y, brushSize);
      }
    }

    animationId = requestAnimationFrame(loop);
  };

  const drawSymmetricLine = function (x1, y1, x2, y2, brushSize) {
    context.strokeStyle = colors[currentColorIndex];
    context.lineWidth = brushSize;
    context.lineCap = "round";
    context.lineJoin = "round";

    const angleStep = (Math.PI * 2) / segments;

    for (let i = 0; i < segments; i++) {
      const angle = angleStep * i;

      // Rotate points around center
      const rotated1 = rotatePoint(x1, y1, centerX, centerY, angle);
      const rotated2 = rotatePoint(x2, y2, centerX, centerY, angle);

      // Draw the line
      context.beginPath();
      context.moveTo(rotated1.x, rotated1.y);
      context.lineTo(rotated2.x, rotated2.y);
      context.stroke();

      // Also draw mirrored version for kaleidoscope effect
      const mirrored1 = { x: 2 * centerX - rotated1.x, y: rotated1.y };
      const mirrored2 = { x: 2 * centerX - rotated2.x, y: rotated2.y };

      context.beginPath();
      context.moveTo(mirrored1.x, mirrored1.y);
      context.lineTo(mirrored2.x, mirrored2.y);
      context.stroke();
    }
  };

  const rotatePoint = function (x, y, cx, cy, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nx = (cos * (x - cx)) - (sin * (y - cy)) + cx;
    const ny = (sin * (x - cx)) + (cos * (y - cy)) + cy;
    return { x: nx, y: ny };
  };
}
