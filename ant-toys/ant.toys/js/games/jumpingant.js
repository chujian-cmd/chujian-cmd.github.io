// Jumping Ant - tiny doodle jump
(function() {
  const WIDTH = 28;
  const HEIGHT = 50;

  function init(container) {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: none;';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let ant = { x: WIDTH / 2, y: HEIGHT - 10, vy: 0 };
    let platforms = [];
    let score = 0;
    let highestY = 0;
    let gameOver = false;
    let targetX = WIDTH / 2;

    const GRAVITY = 0.15;
    const JUMP_FORCE = -3;
    const PLATFORM_COUNT = 8;

    function reset() {
      ant = { x: WIDTH / 2, y: HEIGHT - 10, vy: JUMP_FORCE };
      platforms = [];
      score = 0;
      highestY = 0;
      gameOver = false;
      targetX = WIDTH / 2;

      // Generate initial platforms
      for (let i = 0; i < PLATFORM_COUNT; i++) {
        platforms.push({
          x: Math.random() * (WIDTH - 8),
          y: HEIGHT - 8 - i * (HEIGHT / PLATFORM_COUNT),
          w: 6 + Math.random() * 4,
          moving: Math.random() < 0.05,
          dir: Math.random() < 0.5 ? 1 : -1,
          speed: 0.2 + Math.random() * 0.3
        });
      }
      // Ensure starting platform under ant
      platforms[0].x = WIDTH / 2 - 4;
      platforms[0].y = HEIGHT - 6;
    }

    function draw() {
      // Sky gradient (simple)
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Platforms
      platforms.forEach(p => {
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), Math.floor(p.w), 2);
      });

      // Ant (tiny dot with legs)
      ctx.fillStyle = gameOver ? '#ff6b6b' : '#4ecdc4';
      ctx.fillRect(Math.floor(ant.x) - 1, Math.floor(ant.y) - 2, 3, 3);
      // Legs
      ctx.fillRect(Math.floor(ant.x) - 2, Math.floor(ant.y), 1, 1);
      ctx.fillRect(Math.floor(ant.x) + 2, Math.floor(ant.y), 1, 1);

      // Score
      const scoreStr = String(score);
      ctx.fillStyle = '#666';
      for (let i = 0; i < scoreStr.length; i++) {
        drawDigit(ctx, scoreStr[i], 2 + i * 4, 2);
      }

      // Game over
      if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, HEIGHT / 2 - 6, WIDTH, 12);
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(WIDTH / 2 - 4, HEIGHT / 2 - 2, 8, 4);
      }
    }

    function drawDigit(ctx, char, x, y) {
      const digits = {
        '0': [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[2,2],[0,3],[2,3],[0,4],[1,4],[2,4]],
        '1': [[1,0],[1,1],[1,2],[1,3],[1,4]],
        '2': [[0,0],[1,0],[2,0],[2,1],[0,2],[1,2],[2,2],[0,3],[0,4],[1,4],[2,4]],
        '3': [[0,0],[1,0],[2,0],[2,1],[1,2],[2,2],[2,3],[0,4],[1,4],[2,4]],
        '4': [[0,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2],[2,3],[2,4]],
        '5': [[0,0],[1,0],[2,0],[0,1],[0,2],[1,2],[2,2],[2,3],[0,4],[1,4],[2,4]],
        '6': [[0,0],[1,0],[2,0],[0,1],[0,2],[1,2],[2,2],[0,3],[2,3],[0,4],[1,4],[2,4]],
        '7': [[0,0],[1,0],[2,0],[2,1],[2,2],[2,3],[2,4]],
        '8': [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2],[0,3],[2,3],[0,4],[1,4],[2,4]],
        '9': [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2],[2,3],[0,4],[1,4],[2,4]]
      };
      const pixels = digits[char] || [];
      pixels.forEach(([px, py]) => {
        ctx.fillRect(x + px, y + py, 1, 1);
      });
    }

    function update() {
      if (gameOver) return;

      // Move platforms
      platforms.forEach(p => {
        if (p.moving) {
          p.x += p.speed * p.dir;
          if (p.x <= 0 || p.x + p.w >= WIDTH) {
            p.dir *= -1;
          }
        }
      });

      // Move toward target
      const dx = targetX - ant.x;
      ant.x += dx * 0.15;

      // Wrap around edges
      if (ant.x < 0) ant.x = WIDTH;
      if (ant.x > WIDTH) ant.x = 0;

      // Gravity
      ant.vy += GRAVITY;
      ant.y += ant.vy;

      // Check platform collisions (only when falling)
      if (ant.vy > 0) {
        platforms.forEach(p => {
          if (ant.x >= p.x - 1 && ant.x <= p.x + p.w + 1 &&
              ant.y >= p.y - 2 && ant.y <= p.y + 2) {
            ant.vy = JUMP_FORCE;
            ant.y = p.y - 2;
          }
        });
      }

      // Scroll screen when ant goes above middle
      if (ant.y < HEIGHT / 2) {
        const scroll = HEIGHT / 2 - ant.y;
        ant.y = HEIGHT / 2;
        highestY += scroll;
        score = Math.floor(highestY / 10);

        // Move platforms down
        platforms.forEach(p => {
          p.y += scroll;
        });

        // Remove platforms that fell off and add new ones
        platforms = platforms.filter(p => p.y < HEIGHT + 5);
        while (platforms.length < PLATFORM_COUNT) {
          const highestPlatform = Math.min(...platforms.map(p => p.y));
          // More moving platforms as you go higher (5% to 25%)
          const moveChance = Math.min(0.05 + score * 0.002, 0.25);
          platforms.push({
            x: Math.random() * (WIDTH - 8),
            y: highestPlatform - (8 + Math.random() * 6),
            w: 5 + Math.random() * 4,
            moving: Math.random() < moveChance,
            dir: Math.random() < 0.5 ? 1 : -1,
            speed: 0.2 + Math.random() * 0.3
          });
        }

        // Check win
        if (score >= 100) {
          gameOver = true;
          window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'jumpingant' } }));
        }
      }

      // Fall off bottom = game over
      if (ant.y > HEIGHT + 5) {
        gameOver = true;
      }
    }

    function gameLoop() {
      update();
      draw();
      requestAnimationFrame(gameLoop);
    }

    // Mouse control
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      targetX = (e.clientX - rect.left) * (WIDTH / rect.width);
    });

    // Touch control
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      targetX = (touch.clientX - rect.left) * (WIDTH / rect.width);
    }, { passive: false });

    canvas.addEventListener('click', () => {
      if (gameOver) {
        reset();
      }
    });

    reset();
    gameLoop();
  }

  document.querySelectorAll('.ant-game[data-game="jumpingant"]').forEach(init);
})();
