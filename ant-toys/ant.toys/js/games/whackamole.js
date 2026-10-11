// Whack-a-mole for ants - tap the dots
(function() {
  const SIZE = 33;
  const GRID = 3;
  const CELL = SIZE / GRID;

  function init(container) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: crosshair;';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let holes = []; // { mole, timer, hit }
    let score = 0;
    let misses = 0;
    let gameOver = false;
    let spawnRate = 800;
    let lastSpawn = 0;

    function reset() {
      holes = [];
      for (let i = 0; i < GRID * GRID; i++) {
        holes[i] = { mole: false, timer: 0, hit: false };
      }
      score = 0;
      misses = 0;
      gameOver = false;
      spawnRate = 800;
      lastSpawn = Date.now();
    }

    function draw() {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Holes and moles
      for (let i = 0; i < GRID * GRID; i++) {
        const x = (i % GRID) * CELL + CELL / 2;
        const y = Math.floor(i / GRID) * CELL + CELL / 2;
        const hole = holes[i];

        // Hole
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.arc(x, y, CELL / 2 - 2, 0, Math.PI * 2);
        ctx.fill();

        // Mole
        if (hole.mole) {
          ctx.fillStyle = hole.hit ? '#4ecdc4' : '#8b5a2b';
          ctx.beginPath();
          ctx.arc(x, y, CELL / 2 - 4, 0, Math.PI * 2);
          ctx.fill();

          // Eyes
          if (!hole.hit) {
            ctx.fillStyle = '#000';
            ctx.fillRect(x - 2, y - 1, 1, 1);
            ctx.fillRect(x + 1, y - 1, 1, 1);
          }
        }
      }

      // Score (green dots) - at bottom left
      for (let i = 0; i < Math.min(score, 10); i++) {
        ctx.fillStyle = '#4ecdc4';
        ctx.fillRect(2 + i * 3, SIZE - 3, 2, 2);
      }

      // Misses (red dots) - at bottom right
      for (let i = 0; i < misses; i++) {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(SIZE - 3 - i * 4, SIZE - 3, 2, 2);
      }

      // Game over
      if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(SIZE / 2 - 4, SIZE / 2 - 2, 8, 4);
      }
    }

    function update() {
      if (gameOver) return;

      const now = Date.now();

      // Update existing moles
      holes.forEach(hole => {
        if (hole.mole && !hole.hit) {
          if (now > hole.timer) {
            hole.mole = false;
            misses++;
            if (misses >= 3) {
              gameOver = true;
            }
          }
        } else if (hole.hit) {
          if (now > hole.timer) {
            hole.mole = false;
            hole.hit = false;
          }
        }
      });

      // Spawn new mole
      if (now - lastSpawn > spawnRate) {
        const emptyHoles = holes.map((h, i) => h.mole ? -1 : i).filter(i => i >= 0);
        if (emptyHoles.length > 0) {
          const idx = emptyHoles[Math.floor(Math.random() * emptyHoles.length)];
          holes[idx].mole = true;
          holes[idx].hit = false;
          holes[idx].timer = now + 1000 + Math.random() * 500;
          lastSpawn = now;
          // Speed up gradually
          spawnRate = Math.max(400, spawnRate - 10);
        }
      }

      draw();
    }

    canvas.addEventListener('click', (e) => {
      if (gameOver) {
        reset();
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (SIZE / rect.width);
      const y = (e.clientY - rect.top) * (SIZE / rect.height);

      // Check each hole
      for (let i = 0; i < GRID * GRID; i++) {
        const hx = (i % GRID) * CELL + CELL / 2;
        const hy = Math.floor(i / GRID) * CELL + CELL / 2;
        const dist = Math.hypot(x - hx, y - hy);

        if (dist < CELL / 2 && holes[i].mole && !holes[i].hit) {
          holes[i].hit = true;
          holes[i].timer = Date.now() + 150;
          score++;
          if (score >= 10) {
            window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'whackamole' } }));
          }
          break;
        }
      }
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const clickEvent = new MouseEvent('click', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      canvas.dispatchEvent(clickEvent);
    });

    reset();
    setInterval(update, 16);
  }

  document.querySelectorAll('.ant-game[data-game="whackamole"]').forEach(init);
})();
