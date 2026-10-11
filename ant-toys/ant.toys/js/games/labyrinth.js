// Labyrinth for ants - tilt the tiny maze
(function() {
  const SIZE = 40;

  function init(container) {
    // Wrapper for 3D tilt effect
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'perspective: 100px; display: inline-block;';
    container.appendChild(wrapper);

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: pointer; transition: transform 0.1s ease-out;';
    wrapper.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Ball state
    let ball = { x: 5, y: 5, vx: 0, vy: 0 };
    let tilt = { x: 0, y: 0 };
    let won = false;
    let fell = false;

    // Goal position
    const goal = { x: 35, y: 35 };

    // Holes - placed along the path for challenge
    const holes = [
      { x: 18, y: 6 },   // top corridor
      { x: 32, y: 17 },  // right side drop
      { x: 20, y: 28 },  // middle area
      { x: 8, y: 34 },   // bottom left
      { x: 6, y: 17 },   // left side middle
    ];

    // Solvable maze walls: [x, y, w, h]
    // Simple snake: right -> down -> left -> down -> right -> goal
    const walls = [
      // Outer border
      [0, 0, SIZE, 2],
      [0, SIZE - 2, SIZE, 2],
      [0, 0, 2, SIZE],
      [SIZE - 2, 0, 2, SIZE],

      // Row 1: wall with gap on RIGHT (ball goes right, then down through gap)
      [2, 11, 26, 2],

      // Row 2: wall with gap on LEFT (ball goes left, then down through gap)
      [12, 22, 26, 2],
    ];

    function reset() {
      ball = { x: 5, y: 5, vx: 0, vy: 0 };
      won = false;
      fell = false;
    }

    function checkWallCollision(nx, ny, r) {
      for (const [wx, wy, ww, wh] of walls) {
        const closestX = Math.max(wx, Math.min(nx, wx + ww));
        const closestY = Math.max(wy, Math.min(ny, wy + wh));
        const dx = nx - closestX;
        const dy = ny - closestY;
        if (dx * dx + dy * dy < r * r) {
          return true;
        }
      }
      return false;
    }

    function update() {
      if (won || fell) return;

      const friction = 0.96;
      const gravity = 0.08;
      const radius = 2;

      ball.vx += tilt.x * gravity;
      ball.vy += tilt.y * gravity;
      ball.vx *= friction;
      ball.vy *= friction;

      let nx = ball.x + ball.vx;
      let ny = ball.y + ball.vy;

      if (checkWallCollision(nx, ball.y, radius)) {
        ball.vx = -ball.vx * 0.3;
        nx = ball.x;
      }
      if (checkWallCollision(ball.x, ny, radius)) {
        ball.vy = -ball.vy * 0.3;
        ny = ball.y;
      }

      ball.x = nx;
      ball.y = ny;

      // Check holes
      for (const hole of holes) {
        const dx = ball.x - hole.x;
        const dy = ball.y - hole.y;
        if (dx * dx + dy * dy < 9) {
          fell = true;
          return;
        }
      }

      // Check goal
      const gx = ball.x - goal.x;
      const gy = ball.y - goal.y;
      if (gx * gx + gy * gy < 16) {
        won = true;
        window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'labyrinth' } }));
      }
    }

    function draw() {
      // Wood background
      ctx.fillStyle = '#3d2817';
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Holes (black with subtle rim)
      holes.forEach(h => {
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(h.x, h.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(h.x, h.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Goal (cyan)
      ctx.fillStyle = '#2a8a82';
      ctx.beginPath();
      ctx.arc(goal.x, goal.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4ecdc4';
      ctx.beginPath();
      ctx.arc(goal.x, goal.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Walls
      ctx.fillStyle = '#5a3d2b';
      walls.forEach(([x, y, w, h]) => {
        ctx.fillRect(x, y, w, h);
      });
      // Wall highlights
      ctx.fillStyle = '#6b4a35';
      walls.forEach(([x, y, w, h]) => {
        ctx.fillRect(x, y, w, 1);
      });

      // Ball
      if (!fell) {
        ctx.fillStyle = '#a0a0a0';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d0d0d0';
        ctx.beginPath();
        ctx.arc(ball.x - 0.5, ball.y - 0.5, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Overlays
      if (won) {
        ctx.fillStyle = 'rgba(78, 205, 196, 0.3)';
        ctx.fillRect(0, 0, SIZE, SIZE);
      } else if (fell) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(18, 19, 5, 1);
        ctx.fillRect(20, 17, 1, 5);
      }
    }

    function handleMove(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // Calculate tilt
      tilt.x = Math.max(-1, Math.min(1, (clientX - cx) / 50));
      tilt.y = Math.max(-1, Math.min(1, (clientY - cy) / 50));

      // Apply CSS 3D transform for visual tilt
      const rotateX = -tilt.y * 11; // degrees
      const rotateY = tilt.x * 11;
      canvas.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    }

    // Mouse tilt
    document.addEventListener('mousemove', (e) => {
      handleMove(e.clientX, e.clientY);
    });

    // Touch tilt
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    });

    // Click to reset
    canvas.addEventListener('click', () => {
      if (won || fell) reset();
    });

    function loop() {
      update();
      draw();
      requestAnimationFrame(loop);
    }

    draw();
    loop();
  }

  document.querySelectorAll('.ant-game[data-game="labyrinth"]').forEach(init);
})();
