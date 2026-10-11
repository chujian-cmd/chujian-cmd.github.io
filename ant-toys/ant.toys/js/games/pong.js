// Pong for ants - microscopic
(function() {
  const W = 38;
  const H = 24;

  function init(container) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: pointer;';
    canvas.tabIndex = 0;
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const PADDLE_H = 8;
    const PADDLE_W = 2;
    const BALL_SIZE = 2;

    let playerY = H / 2 - PADDLE_H / 2;
    let aiY = H / 2 - PADDLE_H / 2;
    let ballX = W / 2;
    let ballY = H / 2;
    let ballVX = 0.5;
    let ballVY = 0.3;
    let playerScore = 0;
    let aiScore = 0;

    function draw() {
      // Background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, W, H);

      // Center line
      ctx.strokeStyle = '#333';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      // Paddles
      ctx.fillStyle = '#4ecdc4';
      ctx.fillRect(2, playerY, PADDLE_W, PADDLE_H);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(W - 4, aiY, PADDLE_W, PADDLE_H);

      // Ball
      ctx.fillStyle = '#fff';
      ctx.fillRect(ballX - BALL_SIZE / 2, ballY - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE);

      // Scores (tiny dots)
      for (let i = 0; i < playerScore && i < 5; i++) {
        ctx.fillStyle = '#4ecdc4';
        ctx.fillRect(W / 2 - 8 - i * 3, 2, 2, 2);
      }
      for (let i = 0; i < aiScore && i < 5; i++) {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(W / 2 + 6 + i * 3, 2, 2, 2);
      }
    }

    function update() {
      // Ball movement
      ballX += ballVX;
      ballY += ballVY;

      // Wall bounce
      if (ballY <= BALL_SIZE / 2 || ballY >= H - BALL_SIZE / 2) {
        ballVY = -ballVY;
        ballY = Math.max(BALL_SIZE / 2, Math.min(H - BALL_SIZE / 2, ballY));
      }

      // Player paddle collision
      if (ballX <= 4 + BALL_SIZE / 2 && ballY >= playerY && ballY <= playerY + PADDLE_H) {
        ballVX = Math.abs(ballVX) * 1.05;
        ballVY += (ballY - (playerY + PADDLE_H / 2)) * 0.1;
      }

      // AI paddle collision
      if (ballX >= W - 4 - BALL_SIZE / 2 && ballY >= aiY && ballY <= aiY + PADDLE_H) {
        ballVX = -Math.abs(ballVX) * 1.05;
        ballVY += (ballY - (aiY + PADDLE_H / 2)) * 0.1;
      }

      // Speed limit
      ballVX = Math.max(-2, Math.min(2, ballVX));
      ballVY = Math.max(-1.5, Math.min(1.5, ballVY));

      // Scoring
      if (ballX < 0) {
        aiScore++;
        resetBall(-1);
      }
      if (ballX > W) {
        playerScore++;
        if (playerScore >= 5) {
          window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'pong' } }));
        }
        resetBall(1);
      }

      // AI
      const aiCenter = aiY + PADDLE_H / 2;
      if (aiCenter < ballY - 1) aiY += 0.5;
      if (aiCenter > ballY + 1) aiY -= 0.5;
      aiY = Math.max(0, Math.min(H - PADDLE_H, aiY));

      draw();
    }

    function resetBall(direction) {
      ballX = W / 2;
      ballY = H / 2;
      ballVX = 0.5 * direction;
      ballVY = (Math.random() - 0.5) * 0.6;
    }

    // Mouse control
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleY = H / rect.height;
      const y = (e.clientY - rect.top) * scaleY;
      playerY = Math.max(0, Math.min(H - PADDLE_H, y - PADDLE_H / 2));
    });

    // Touch control
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleY = H / rect.height;
      const y = (e.touches[0].clientY - rect.top) * scaleY;
      playerY = Math.max(0, Math.min(H - PADDLE_H, y - PADDLE_H / 2));
    }, { passive: false });

    canvas.addEventListener('click', () => canvas.focus());

    draw();
    setInterval(update, 16);
  }

  document.querySelectorAll('.ant-game[data-game="pong"]').forEach(init);
})();
