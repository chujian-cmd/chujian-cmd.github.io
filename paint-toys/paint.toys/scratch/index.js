// Scratch Art
// Smooth lagging strokes with physical variations

const scale = 2;

function ScratchArt() {
  let canvas, context;
  let scratchCanvas, scratchContext;
  let rainbowCanvas, rainbowContext;
  let width, height, displayWidth, displayHeight;

  // Lagging brush system (like symmetry painter)
  let mouseDown = false;
  let targetPos = { x: 0, y: 0 };
  let brushPos = { x: 0, y: 0 };
  let prevBrushPos = { x: 0, y: 0 };

  // Smooth lag for scratching (higher = more responsive)
  const baseLagFactor = 0.12;

  // Multiple bristles with varying lag for organic feel
  const bristles = [];
  const numBristles = 5;

  // Momentum/velocity tracking
  let velocity = { x: 0, y: 0 };
  let smoothVelocity = { x: 0, y: 0 };

  let currentPattern = 'rainbow';
  let currentTool = 'stylus';

  const tools = {
    needle: { size: 2, bristleSpread: 0, lagVariation: 0, opacity: 1.0 },
    stylus: { size: 5, bristleSpread: 2, lagVariation: 0.015, opacity: 0.95 },
    pen: { size: 12, bristleSpread: 5, lagVariation: 0.02, opacity: 0.9 }
  };

  // Particles
  let particles = [];
  const maxParticles = 400;

  // Scratch angles for holographic
  let scratchAngles = [];
  const angleGridSize = 12;

  const canvasWrapper = document.querySelector('.canvas-wrapper');
  const canvasRect = canvasWrapper.getBoundingClientRect();

  let animationId;
  let hasStarted = false;

  this.initialize = function() {
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");

    displayWidth = canvasRect.width - 40;
    displayHeight = canvasRect.height - 40;
    width = displayWidth * scale;
    height = displayHeight * scale;

    canvas.width = width;
    canvas.height = height;
    context.scale(scale, scale);

    // Rainbow layer
    rainbowCanvas = document.createElement('canvas');
    rainbowCanvas.width = width;
    rainbowCanvas.height = height;
    rainbowContext = rainbowCanvas.getContext('2d');
    rainbowContext.scale(scale, scale);

    // Scratch layer
    scratchCanvas = document.createElement('canvas');
    scratchCanvas.width = width;
    scratchCanvas.height = height;
    scratchContext = scratchCanvas.getContext('2d');
    scratchContext.scale(scale, scale);

    // Initialize bristles with varying lag factors
    for (let i = 0; i < numBristles; i++) {
      bristles.push({
        pos: { x: displayWidth / 2, y: displayHeight / 2 },
        prevPos: { x: displayWidth / 2, y: displayHeight / 2 },
        lagOffset: (Math.random() - 0.5) * 0.03,
        offsetX: 0,
        offsetY: 0
      });
    }

    // Initialize angle grid
    const gridW = Math.ceil(displayWidth / angleGridSize);
    const gridH = Math.ceil(displayHeight / angleGridSize);
    for (let y = 0; y < gridH; y++) {
      scratchAngles[y] = [];
      for (let x = 0; x < gridW; x++) {
        scratchAngles[y][x] = null;
      }
    }

    brushPos.x = displayWidth / 2;
    brushPos.y = displayHeight / 2;
    prevBrushPos.x = displayWidth / 2;
    prevBrushPos.y = displayHeight / 2;
    targetPos.x = displayWidth / 2;
    targetPos.y = displayHeight / 2;

    this.generatePattern();
    this.coverWithBlack();

    canvas.addEventListener("mousemove", onMouseMove, false);
    canvas.addEventListener("mousedown", onDown, false);
    canvas.addEventListener("mouseup", onUp, false);
    canvas.addEventListener("mouseleave", onUp, false);
    canvas.addEventListener("touchstart", onTouchStart, false);
    canvas.addEventListener("touchmove", onMouseMove, false);
    canvas.addEventListener("touchend", onUp, false);
    canvas.addEventListener("touchcancel", onUp, false);

    // Also detect when mouse leaves the window entirely
    document.addEventListener("mouseleave", onUp, false);
    window.addEventListener("blur", onUp, false);

    // Start animation loop
    loop();
  };

  const onDown = function(event) {
    mouseDown = true;
    hasStarted = true;
    document.querySelector('.tip').style.display = 'none';

    const e = (event.touches && event.touches.item(0)) || event;
    const x = e.clientX - (canvasRect.left + 20);
    const y = e.clientY - (canvasRect.top + 20);

    // Snap to position on mouse down
    targetPos.x = x;
    targetPos.y = y;
    brushPos.x = x;
    brushPos.y = y;
    prevBrushPos.x = x;
    prevBrushPos.y = y;
    velocity = { x: 0, y: 0 };
    smoothVelocity = { x: 0, y: 0 };

    // Reset bristles to current position
    bristles.forEach(b => {
      b.pos.x = x;
      b.pos.y = y;
      b.prevPos.x = x;
      b.prevPos.y = y;
    });
  };

  const onUp = function() {
    mouseDown = false;
    // Clear bristle history to prevent jumps on next stroke
    bristles.forEach(b => {
      b.history = [];
    });
  };

  const onTouchStart = function(event) {
    event.preventDefault();
    onDown(event);
  };

  const onMouseMove = function(event) {
    const e = (event.touches && event.touches.item(0)) || event;
    targetPos.x = e.clientX - (canvasRect.left + 20);
    targetPos.y = e.clientY - (canvasRect.top + 20);
  };

  const loop = function() {
    // Update particles
    updateParticles();

    if (mouseDown && hasStarted) {
      // Calculate velocity
      const dx = targetPos.x - brushPos.x;
      const dy = targetPos.y - brushPos.y;

      // Smooth velocity for physical feel
      smoothVelocity.x += (dx - smoothVelocity.x) * 0.1;
      smoothVelocity.y += (dy - smoothVelocity.y) * 0.1;

      // Update main brush with lag
      prevBrushPos.x = brushPos.x;
      prevBrushPos.y = brushPos.y;
      brushPos.x += dx * baseLagFactor;
      brushPos.y += dy * baseLagFactor;

      const speed = Math.sqrt(smoothVelocity.x ** 2 + smoothVelocity.y ** 2);
      const angle = Math.atan2(smoothVelocity.y, smoothVelocity.x);

      // Store angle for holographic effect
      const gx = Math.floor(brushPos.x / angleGridSize);
      const gy = Math.floor(brushPos.y / angleGridSize);
      if (gy >= 0 && gy < scratchAngles.length && gx >= 0 && gx < (scratchAngles[0]?.length || 0)) {
        scratchAngles[gy][gx] = angle;
      }

      const tool = tools[currentTool];

      // Update and draw each bristle with smooth curves
      bristles.forEach((bristle, i) => {
        // Store history for curve
        if (!bristle.history) bristle.history = [];

        bristle.prevPos.x = bristle.pos.x;
        bristle.prevPos.y = bristle.pos.y;

        // Each bristle has slightly different lag for organic feel
        const bristleLag = baseLagFactor + bristle.lagOffset + tool.lagVariation * (Math.random() - 0.5);
        bristle.pos.x += (targetPos.x - bristle.pos.x) * Math.max(0.02, bristleLag);
        bristle.pos.y += (targetPos.y - bristle.pos.y) * Math.max(0.02, bristleLag);

        // Offset based on speed and tool spread
        const spreadAmount = tool.bristleSpread * (0.5 + speed * 0.015);
        const perpAngle = angle + Math.PI / 2;
        const offsetFactor = (i - (numBristles - 1) / 2) / (numBristles / 2);
        bristle.offsetX = Math.cos(perpAngle) * offsetFactor * spreadAmount;
        bristle.offsetY = Math.sin(perpAngle) * offsetFactor * spreadAmount;

        const currentX = bristle.pos.x + bristle.offsetX;
        const currentY = bristle.pos.y + bristle.offsetY;

        // Add to history for smooth curves
        bristle.history.push({ x: currentX, y: currentY });
        if (bristle.history.length > 3) bristle.history.shift();

        // Only draw if moved enough
        const bristleSpeed = Math.sqrt(
          (bristle.pos.x - bristle.prevPos.x) ** 2 +
          (bristle.pos.y - bristle.prevPos.y) ** 2
        );

        if (bristleSpeed > 0.05 && bristle.history.length >= 2) {
          // Variable size based on speed (slower = thicker)
          const speedFactor = Math.min(bristleSpeed / 8, 1);
          const sizeVariation = 1 - speedFactor * 0.3;
          const bristleSize = (tool.size / numBristles) * (0.85 + Math.random() * 0.3) * sizeVariation;

          // Variable opacity
          const opacityVariation = tool.opacity * (0.75 + Math.random() * 0.25) * (1 - speedFactor * 0.2);

          // Draw smooth curve through history points
          drawScratchCurve(bristle.history, bristleSize, opacityVariation);

          // Spawn particles occasionally
          if (Math.random() < 0.12 * tool.size / 8) {
            spawnParticle(currentX, currentY, angle, speed);
          }
        }
      });
    }

    // Render
    render();
    animationId = requestAnimationFrame(loop);
  };

  const drawScratchCurve = function(points, size, opacity) {
    if (points.length < 2) return;

    scratchContext.globalCompositeOperation = 'destination-out';
    scratchContext.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    scratchContext.lineWidth = size;
    scratchContext.lineCap = 'round';
    scratchContext.lineJoin = 'round';
    scratchContext.beginPath();

    if (points.length === 2) {
      // Simple line for 2 points
      scratchContext.moveTo(points[0].x, points[0].y);
      scratchContext.lineTo(points[1].x, points[1].y);
    } else {
      // Quadratic curve through points for smoothness
      scratchContext.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        scratchContext.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }

      // Final point
      const last = points[points.length - 1];
      scratchContext.lineTo(last.x, last.y);
    }

    scratchContext.stroke();
    scratchContext.globalCompositeOperation = 'source-over';
  };

  const spawnParticle = function(x, y, angle, speed) {
    if (particles.length >= maxParticles) return;

    const ejectAngle = angle + Math.PI + (Math.random() - 0.5) * 0.8;
    const ejectSpeed = 0.5 + Math.random() * 1.5 + speed * 0.05;

    particles.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: Math.cos(ejectAngle) * ejectSpeed,
      vy: Math.sin(ejectAngle) * ejectSpeed - 0.5,
      size: 0.5 + Math.random() * 1.5,
      life: 1,
      dark: Math.random() > 0.3
    });
  };

  const updateParticles = function() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += 0.08;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.025;

      if (p.life <= 0 || p.y > displayHeight + 10) {
        particles.splice(i, 1);
      }
    }
  };

  const render = function() {
    context.clearRect(0, 0, displayWidth, displayHeight);

    // Draw rainbow
    context.drawImage(rainbowCanvas, 0, 0, displayWidth, displayHeight);

    // Draw scratch layer
    context.drawImage(scratchCanvas, 0, 0, displayWidth, displayHeight);

    // Draw particles
    particles.forEach(p => {
      const alpha = p.life * 0.8;
      context.fillStyle = p.dark ? `rgba(20, 20, 20, ${alpha})` : `rgba(140, 140, 145, ${alpha * 0.6})`;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    });
  };

  this.setPattern = function(pattern) {
    currentPattern = pattern;
    this.generatePattern();
    this.coverWithBlack();
  };

  this.setTool = function(toolName) {
    if (tools[toolName]) {
      currentTool = toolName;
    }
  };

  this.generatePattern = function() {
    const w = displayWidth;
    const h = displayHeight;
    rainbowContext.clearRect(0, 0, w, h);

    const addSwirls = (count, alpha) => {
      for (let i = 0; i < count; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = 40 + Math.random() * 140;
        const swirl = rainbowContext.createRadialGradient(x, y, 0, x, y, r);
        swirl.addColorStop(0, `hsla(${Math.random() * 360}, 80%, 60%, ${alpha})`);
        swirl.addColorStop(0.6, `hsla(${Math.random() * 360}, 75%, 55%, ${alpha * 0.5})`);
        swirl.addColorStop(1, 'transparent');
        rainbowContext.fillStyle = swirl;
        rainbowContext.beginPath();
        rainbowContext.arc(x, y, r, 0, Math.PI * 2);
        rainbowContext.fill();
      }
    };

    const generators = {
      rainbow: () => {
        // Classic rainbow diagonal
        const grad = rainbowContext.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#ff6b6b');
        grad.addColorStop(0.14, '#ffd93d');
        grad.addColorStop(0.28, '#6bcb77');
        grad.addColorStop(0.42, '#4d96ff');
        grad.addColorStop(0.57, '#9b59b6');
        grad.addColorStop(0.71, '#ff6b9d');
        grad.addColorStop(0.85, '#00d4aa');
        grad.addColorStop(1, '#ff6b6b');
        rainbowContext.fillStyle = grad;
        rainbowContext.fillRect(0, 0, w, h);
        addSwirls(20, 0.4);
      },
      sunset: () => {
        // Warm sunset gradient
        const grad = rainbowContext.createLinearGradient(0, 0, w * 0.3, h);
        grad.addColorStop(0, '#0f0c29');
        grad.addColorStop(0.2, '#302b63');
        grad.addColorStop(0.4, '#24243e');
        grad.addColorStop(0.5, '#c94b4b');
        grad.addColorStop(0.65, '#f09819');
        grad.addColorStop(0.8, '#ff512f');
        grad.addColorStop(1, '#ffd194');
        rainbowContext.fillStyle = grad;
        rainbowContext.fillRect(0, 0, w, h);

        // Add warm swirls
        for (let i = 0; i < 15; i++) {
          const x = Math.random() * w;
          const y = Math.random() * h;
          const r = 50 + Math.random() * 120;
          const hue = 15 + Math.random() * 45; // orange-red range
          const swirl = rainbowContext.createRadialGradient(x, y, 0, x, y, r);
          swirl.addColorStop(0, `hsla(${hue}, 90%, 60%, 0.5)`);
          swirl.addColorStop(1, 'transparent');
          rainbowContext.fillStyle = swirl;
          rainbowContext.beginPath();
          rainbowContext.arc(x, y, r, 0, Math.PI * 2);
          rainbowContext.fill();
        }
      },
      ocean: () => {
        // Deep ocean blues and teals
        const grad = rainbowContext.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#0f2027');
        grad.addColorStop(0.2, '#203a43');
        grad.addColorStop(0.4, '#2c5364');
        grad.addColorStop(0.55, '#0083B0');
        grad.addColorStop(0.7, '#00b4db');
        grad.addColorStop(0.85, '#48c6ef');
        grad.addColorStop(1, '#6f86d6');
        rainbowContext.fillStyle = grad;
        rainbowContext.fillRect(0, 0, w, h);

        // Cool swirls
        for (let i = 0; i < 18; i++) {
          const x = Math.random() * w;
          const y = Math.random() * h;
          const r = 40 + Math.random() * 130;
          const hue = 180 + Math.random() * 60; // cyan-blue range
          const swirl = rainbowContext.createRadialGradient(x, y, 0, x, y, r);
          swirl.addColorStop(0, `hsla(${hue}, 80%, 55%, 0.45)`);
          swirl.addColorStop(0.5, `hsla(${hue + 20}, 75%, 50%, 0.25)`);
          swirl.addColorStop(1, 'transparent');
          rainbowContext.fillStyle = swirl;
          rainbowContext.beginPath();
          rainbowContext.arc(x, y, r, 0, Math.PI * 2);
          rainbowContext.fill();
        }
      },
      aurora: () => {
        // Northern lights - greens, purples, pinks
        const grad = rainbowContext.createLinearGradient(0, h, w, 0);
        grad.addColorStop(0, '#0f0c29');
        grad.addColorStop(0.15, '#1a1a2e');
        grad.addColorStop(0.3, '#16213e');
        grad.addColorStop(0.45, '#1fab89');
        grad.addColorStop(0.55, '#62d2a2');
        grad.addColorStop(0.65, '#9b59b6');
        grad.addColorStop(0.8, '#e91e9c');
        grad.addColorStop(0.9, '#ff6b9d');
        grad.addColorStop(1, '#1a1a2e');
        rainbowContext.fillStyle = grad;
        rainbowContext.fillRect(0, 0, w, h);

        // Aurora swirls
        for (let i = 0; i < 22; i++) {
          const x = Math.random() * w;
          const y = Math.random() * h;
          const r = 50 + Math.random() * 150;
          const hue = Math.random() > 0.5 ? 140 + Math.random() * 40 : 280 + Math.random() * 40;
          const swirl = rainbowContext.createRadialGradient(x, y, 0, x, y, r);
          swirl.addColorStop(0, `hsla(${hue}, 75%, 55%, 0.4)`);
          swirl.addColorStop(0.6, `hsla(${hue + 30}, 70%, 50%, 0.2)`);
          swirl.addColorStop(1, 'transparent');
          rainbowContext.fillStyle = swirl;
          rainbowContext.beginPath();
          rainbowContext.arc(x, y, r, 0, Math.PI * 2);
          rainbowContext.fill();
        }
      },
      candy: () => {
        // Pastel candy colors
        const grad = rainbowContext.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#ee9ca7');
        grad.addColorStop(0.15, '#ffdde1');
        grad.addColorStop(0.3, '#a8edea');
        grad.addColorStop(0.45, '#fed6e3');
        grad.addColorStop(0.6, '#d299c2');
        grad.addColorStop(0.75, '#fef9d7');
        grad.addColorStop(0.9, '#a1ffce');
        grad.addColorStop(1, '#faffd1');
        rainbowContext.fillStyle = grad;
        rainbowContext.fillRect(0, 0, w, h);

        // Pastel swirls
        for (let i = 0; i < 20; i++) {
          const x = Math.random() * w;
          const y = Math.random() * h;
          const r = 40 + Math.random() * 120;
          const hue = Math.random() * 360;
          const swirl = rainbowContext.createRadialGradient(x, y, 0, x, y, r);
          swirl.addColorStop(0, `hsla(${hue}, 70%, 80%, 0.5)`);
          swirl.addColorStop(0.5, `hsla(${hue + 40}, 65%, 75%, 0.3)`);
          swirl.addColorStop(1, 'transparent');
          rainbowContext.fillStyle = swirl;
          rainbowContext.beginPath();
          rainbowContext.arc(x, y, r, 0, Math.PI * 2);
          rainbowContext.fill();
        }
      }
    };

    if (generators[currentPattern]) {
      generators[currentPattern]();
    }
  };

  this.coverWithBlack = function() {
    scratchContext.fillStyle = '#121212';
    scratchContext.fillRect(0, 0, displayWidth, displayHeight);

    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * displayWidth;
      const y = Math.random() * displayHeight;
      scratchContext.fillStyle = `rgb(${12 + Math.random() * 16}, ${12 + Math.random() * 16}, ${12 + Math.random() * 16})`;
      scratchContext.fillRect(x, y, 1, 1);
    }

    particles = [];

    for (let y = 0; y < scratchAngles.length; y++) {
      for (let x = 0; x < (scratchAngles[y]?.length || 0); x++) {
        scratchAngles[y][x] = null;
      }
    }
  };

  this.reset = function() {
    this.generatePattern();
    this.coverWithBlack();
  };
}
