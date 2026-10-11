// Tic-tac-toe for ants - absurdly tiny
(function() {
  const SIZE = 27; // Pixels - barely visible
  const CELL = SIZE / 3;

  function init(container) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: crosshair;';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let board = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 0=empty, 1=X, 2=O
    let turn = 1;
    let gameOver = false;

    function draw() {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Grid lines
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(CELL, 0); ctx.lineTo(CELL, SIZE);
      ctx.moveTo(CELL * 2, 0); ctx.lineTo(CELL * 2, SIZE);
      ctx.moveTo(0, CELL); ctx.lineTo(SIZE, CELL);
      ctx.moveTo(0, CELL * 2); ctx.lineTo(SIZE, CELL * 2);
      ctx.stroke();

      // Pieces
      for (let i = 0; i < 9; i++) {
        const x = (i % 3) * CELL + CELL / 2;
        const y = Math.floor(i / 3) * CELL + CELL / 2;
        const r = CELL / 2 - 2;

        if (board[i] === 1) {
          // X - tiny cross
          ctx.strokeStyle = '#ff6b6b';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
          ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
          ctx.stroke();
        } else if (board[i] === 2) {
          // O - tiny circle
          ctx.strokeStyle = '#4ecdc4';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Win line
      const win = checkWin();
      if (win) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const [a, b, c] = win;
        const x1 = (a % 3) * CELL + CELL / 2;
        const y1 = Math.floor(a / 3) * CELL + CELL / 2;
        const x2 = (c % 3) * CELL + CELL / 2;
        const y2 = Math.floor(c / 3) * CELL + CELL / 2;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    function checkWin() {
      const lines = [
        [0,1,2], [3,4,5], [6,7,8], // rows
        [0,3,6], [1,4,7], [2,5,8], // cols
        [0,4,8], [2,4,6] // diags
      ];
      for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[b] === board[c]) {
          return [a, b, c];
        }
      }
      return null;
    }

    function aiMove() {
      if (gameOver) return;

      const empty = board.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0);
      if (empty.length === 0) return;

      // 8% chance to just play randomly
      if (Math.random() < 0.08) {
        board[empty[Math.floor(Math.random() * empty.length)]] = 2;
        return;
      }

      const lines = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]];

      // Try to win (always do this)
      for (const [a, b, c] of lines) {
        if (board[a] === 2 && board[b] === 2 && board[c] === 0) { board[c] = 2; return; }
        if (board[a] === 2 && board[c] === 2 && board[b] === 0) { board[b] = 2; return; }
        if (board[b] === 2 && board[c] === 2 && board[a] === 0) { board[a] = 2; return; }
      }

      // 10% chance to skip blocking (blunder)
      if (Math.random() > 0.1) {
        for (const [a, b, c] of lines) {
          if (board[a] === 1 && board[b] === 1 && board[c] === 0) { board[c] = 2; return; }
          if (board[a] === 1 && board[c] === 1 && board[b] === 0) { board[b] = 2; return; }
          if (board[b] === 1 && board[c] === 1 && board[a] === 0) { board[a] = 2; return; }
        }
      }

      // Random from remaining
      board[empty[Math.floor(Math.random() * empty.length)]] = 2;
    }

    canvas.addEventListener('click', (e) => {
      if (gameOver) {
        // Reset
        board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        turn = 1;
        gameOver = false;
        draw();
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const scaleX = SIZE / rect.width;
      const scaleY = SIZE / rect.height;
      const x = Math.floor((e.clientX - rect.left) * scaleX / CELL);
      const y = Math.floor((e.clientY - rect.top) * scaleY / CELL);
      const idx = y * 3 + x;

      if (x >= 0 && x < 3 && y >= 0 && y < 3 && board[idx] === 0) {
        board[idx] = 1;
        draw();

        const win = checkWin();
        if (win || board.every(c => c !== 0)) {
          gameOver = true;
          if (win && board[win[0]] === 1) {
            window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'tictactoe' } }));
          }
          return;
        }

        setTimeout(() => {
          aiMove();
          draw();
          if (checkWin() || board.every(c => c !== 0)) {
            gameOver = true;
          }
        }, 100);
      }
    });

    draw();
  }

  // Initialize all tic-tac-toe containers
  document.querySelectorAll('.ant-game[data-game="tictactoe"]').forEach(init);
})();
