// Connect 4 for ants - tiny disc dropping
(function() {
  const COLS = 7;
  const ROWS = 6;
  const CELL = 5;
  const WIDTH = COLS * CELL;
  const HEIGHT = ROWS * CELL;

  function init(container) {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: pointer;';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // 0 = empty, 1 = player (red), 2 = AI (yellow)
    let board = [];
    let gameOver = false;
    let playerTurn = true;

    function reset() {
      board = [];
      for (let c = 0; c < COLS; c++) {
        board[c] = [];
        for (let r = 0; r < ROWS; r++) {
          board[c][r] = 0;
        }
      }
      gameOver = false;
      playerTurn = true;
    }

    function draw() {
      // Board background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Grid and pieces
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          const x = c * CELL + CELL / 2;
          const y = r * CELL + CELL / 2;

          // Hole
          ctx.fillStyle = '#0a0a0a';
          ctx.beginPath();
          ctx.arc(x, y, CELL / 2 - 1, 0, Math.PI * 2);
          ctx.fill();

          // Piece
          if (board[c][r] === 1) {
            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath();
            ctx.arc(x, y, CELL / 2 - 1, 0, Math.PI * 2);
            ctx.fill();
          } else if (board[c][r] === 2) {
            ctx.fillStyle = '#ffd93d';
            ctx.beginPath();
            ctx.arc(x, y, CELL / 2 - 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Win highlight
      const win = checkWin();
      if (win) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const [c1, r1] = win[0];
        const [c2, r2] = win[3];
        ctx.moveTo(c1 * CELL + CELL / 2, r1 * CELL + CELL / 2);
        ctx.lineTo(c2 * CELL + CELL / 2, r2 * CELL + CELL / 2);
        ctx.stroke();
      }
    }

    function dropPiece(col, player) {
      // Find lowest empty row
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[col][r] === 0) {
          board[col][r] = player;
          return true;
        }
      }
      return false; // Column full
    }

    function checkWin() {
      // Check all directions for 4 in a row
      const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          const player = board[c][r];
          if (player === 0) continue;

          for (const [dc, dr] of directions) {
            const cells = [[c, r]];
            for (let i = 1; i < 4; i++) {
              const nc = c + dc * i;
              const nr = r + dr * i;
              if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && board[nc][nr] === player) {
                cells.push([nc, nr]);
              } else {
                break;
              }
            }
            if (cells.length === 4) {
              return cells;
            }
          }
        }
      }
      return null;
    }

    function isBoardFull() {
      for (let c = 0; c < COLS; c++) {
        if (board[c][0] === 0) return false;
      }
      return true;
    }

    function getValidCols() {
      const valid = [];
      for (let c = 0; c < COLS; c++) {
        if (board[c][0] === 0) valid.push(c);
      }
      return valid;
    }

    function aiMove() {
      const valid = getValidCols();
      if (valid.length === 0) return;

      // 12% chance to just play randomly
      if (Math.random() < 0.12) {
        const col = valid[Math.floor(Math.random() * valid.length)];
        dropPiece(col, 2);
        return;
      }

      // Try to win
      for (const col of valid) {
        // Simulate move
        for (let r = ROWS - 1; r >= 0; r--) {
          if (board[col][r] === 0) {
            board[col][r] = 2;
            if (checkWin()) {
              return; // Keep winning move
            }
            board[col][r] = 0;
            break;
          }
        }
      }

      // 10% chance to skip blocking
      if (Math.random() > 0.1) {
        // Try to block player
        for (const col of valid) {
          for (let r = ROWS - 1; r >= 0; r--) {
            if (board[col][r] === 0) {
              board[col][r] = 1;
              if (checkWin()) {
                board[col][r] = 2; // Block
                return;
              }
              board[col][r] = 0;
              break;
            }
          }
        }
      }

      // Prefer center columns
      const centerCols = valid.filter(c => c >= 2 && c <= 4);
      const preferredCols = centerCols.length > 0 ? centerCols : valid;
      const col = preferredCols[Math.floor(Math.random() * preferredCols.length)];
      dropPiece(col, 2);
    }

    canvas.addEventListener('click', (e) => {
      if (gameOver) {
        reset();
        draw();
        return;
      }

      if (!playerTurn) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (WIDTH / rect.width);
      const col = Math.floor(x / CELL);

      if (col < 0 || col >= COLS) return;
      if (board[col][0] !== 0) return; // Column full

      dropPiece(col, 1);
      draw();

      if (checkWin()) {
        gameOver = true;
        window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'connect4' } }));
        return;
      }

      if (isBoardFull()) {
        gameOver = true;
        return;
      }

      playerTurn = false;
      setTimeout(() => {
        aiMove();
        draw();
        if (checkWin() || isBoardFull()) {
          gameOver = true;
        }
        playerTurn = true;
      }, 150);
    });

    reset();
    draw();
  }

  document.querySelectorAll('.ant-game[data-game="connect4"]').forEach(init);
})();
