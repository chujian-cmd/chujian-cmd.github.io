// Flappy Bird for ants - tap to flap
(function() {
  const W = 30;
  const H = 42;

  function init(container) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: pointer;';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const BIRD_SIZE = 3;
    const PIPE_W = 6;
    const GAP = 20;
    const GRAVITY = 0.10;
    const FLAP = -1.5;

    let birdY, birdVY;
    let pipes = [];
    let score = 0;
    let running = false;
    let dead = false;

    function reset() {
      birdY = H / 2;
      birdVY = 0;
      pipes = [];
      score = 0;
      running = false;
      dead = false;
      // Start with a pipe
      addPipe();
    }

    function addPipe() {
      const gapY = 10 + Math.random() * (H - GAP - 20);
      pipes.push({ x: W + 5, gapY: gapY, passed: false });
    }

    function draw() {
      // Sky
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, W, H);

      // Pipes
      ctx.fillStyle = '#6bcb77';
      pipes.forEach(p => {
        // Top pipe
        ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
        // Bottom pipe
        ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, H - p.gapY - GAP);
      });

      // Bird
      ctx.fillStyle = dead ? '#ff6b6b' : '#ffd93d';
      ctx.fillRect(8 - BIRD_SIZE / 2, birdY - BIRD_SIZE / 2, BIRD_SIZE, BIRD_SIZE);

      // Score (tiny dots at top)
      for (let i = 0; i < Math.min(score, 10); i++) {
        ctx.fillStyle = '#4ecdc4';
        ctx.fillRect(2 + i * 3, 2, 2, 2);
      }

      // Start prompt
      if (!running && !dead) {
        ctx.fillStyle = '#666';
        ctx.fillRect(W / 2 - 3, H / 2 + 8, 6, 2);
      }
    }

    function update() {
      if (!running) {
        draw();
        return;
      }

      // Bird physics
      birdVY += GRAVITY;
      birdY += birdVY;

      // Pipe movement
      pipes.forEach(p => {
        p.x -= 0.8;

        // Score
        if (!p.passed && p.x + PIPE_W < 8) {
          p.passed = true;
          score++;
          if (score >= 10) {
            window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'flappy' } }));
          }
        }

        // Collision
        if (p.x < 8 + BIRD_SIZE / 2 && p.x + PIPE_W > 8 - BIRD_SIZE / 2) {
          if (birdY - BIRD_SIZE / 2 < p.gapY || birdY + BIRD_SIZE / 2 > p.gapY + GAP) {
            dead = true;
            running = false;
          }
        }
      });

      // Remove off-screen pipes and add new ones
      if (pipes.length > 0 && pipes[0].x < -PIPE_W) {
        pipes.shift();
      }
      if (pipes.length === 0 || pipes[pipes.length - 1].x < W - 20) {
        addPipe();
      }

      // Floor/ceiling collision
      if (birdY < BIRD_SIZE / 2 || birdY > H - BIRD_SIZE / 2) {
        dead = true;
        running = false;
      }

      draw();
    }

    function flap() {
      if (dead) {
        reset();
        draw();
        return;
      }
      if (!running) {
        running = true;
      }
      birdVY = FLAP;
    }

    canvas.addEventListener('click', flap);
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      flap();
    });

    reset();
    setInterval(update, 16);
  }

  document.querySelectorAll('.ant-game[data-game="flappy"]').forEach(init);
})();
