// Breakout for ants - tiny brick breaking
(function() {
  const W = 36;
  const H = 42;

  function init(container) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: pointer;';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const PADDLE_W = 10;
    const PADDLE_H = 2;
    const BALL_SIZE = 2;
    const BRICK_W = 5;
    const BRICK_H = 2;
    const BRICK_ROWS = 4;
    const BRICK_COLS = 6;

    let paddleX = W / 2 - PADDLE_W / 2;
    let ballX, ballY, ballVX, ballVY;
    let bricks = [];
    let lives = 3;
    let running = false;
    let won = false;

    const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4ecdc4'];

    function reset() {
      bricks = [];
      for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          bricks.push({
            x: c * (BRICK_W + 1) + 1,
            y: r * (BRICK_H + 1) + 3,
            color: colors[r],
            alive: true
          });
        }
      }
      lives = 3;
      won = false;
      launchBall();
    }

    function launchBall() {
      ballX = W / 2;
      ballY = H - 10;
      ballVX = (Math.random() - 0.5) * 1.5;
      ballVY = -1;
      running = true;
    }

    function draw() {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, W, H);

      // Bricks
      bricks.forEach(b => {
        if (b.alive) {
          ctx.fillStyle = b.color;
          ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
        }
      });

      // Paddle
      ctx.fillStyle = '#4ecdc4';
      ctx.fillRect(paddleX, H - 4, PADDLE_W, PADDLE_H);

      // Ball
      ctx.fillStyle = '#fff';
      ctx.fillRect(ballX - BALL_SIZE / 2, ballY - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE);

      // Lives (tiny dots)
      for (let i = 0; i < lives; i++) {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(2 + i * 3, H - 2, 2, 1);
      }

      // Win/lose
      if (bricks.every(b => !b.alive)) {
        ctx.fillStyle = '#4ecdc4';
        ctx.fillRect(W / 2 - 4, H / 2 - 1, 8, 2);
        running = false;
        if (!won) {
          won = true;
          window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'breakout' } }));
        }
      }
      if (lives <= 0) {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(W / 2 - 4, H / 2 - 1, 8, 2);
        running = false;
      }
    }

    function update() {
      if (!running) return;

      ballX += ballVX;
      ballY += ballVY;

      // Wall bounce
      if (ballX <= BALL_SIZE / 2 || ballX >= W - BALL_SIZE / 2) {
        ballVX = -ballVX;
        ballX = Math.max(BALL_SIZE / 2, Math.min(W - BALL_SIZE / 2, ballX));
      }
      if (ballY <= BALL_SIZE / 2) {
        ballVY = -ballVY;
        ballY = BALL_SIZE / 2;
      }

      // Paddle bounce
      if (ballY >= H - 4 - BALL_SIZE / 2 && ballY < H - 2 &&
          ballX >= paddleX && ballX <= paddleX + PADDLE_W) {
        ballVY = -Math.abs(ballVY);
        ballVX += (ballX - (paddleX + PADDLE_W / 2)) * 0.15;
        ballVX = Math.max(-2, Math.min(2, ballVX));
      }

      // Brick collision
      bricks.forEach(b => {
        if (!b.alive) return;
        if (ballX >= b.x && ballX <= b.x + BRICK_W &&
            ballY >= b.y && ballY <= b.y + BRICK_H) {
          b.alive = false;
          ballVY = -ballVY;
        }
      });

      // Ball lost
      if (ballY > H) {
        lives--;
        if (lives > 0) {
          launchBall();
        } else {
          running = false;
        }
      }

      draw();
    }

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.touches[0].clientX - rect.left) * (W / rect.width);
      paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
    }, { passive: false });

    canvas.addEventListener('click', () => {
      if (!running) reset();
    });

    reset();
    setInterval(update, 16);
  }

  document.querySelectorAll('.ant-game[data-game="breakout"]').forEach(init);
})();
