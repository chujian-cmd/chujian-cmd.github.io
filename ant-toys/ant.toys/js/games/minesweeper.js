// Minesweeper for ants - tiny explosions
(function() {
  const SIZE = 30;
  const GRID = 6;
  const CELL = SIZE / GRID;
  const MINES = 6;

  function init(container) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: crosshair;';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let board = []; // { mine, revealed, flagged, count }
    let gameOver = false;
    let won = false;

    function reset() {
      board = [];
      for (let i = 0; i < GRID * GRID; i++) {
        board[i] = { mine: false, revealed: false, flagged: false, count: 0 };
      }

      // Place mines
      let placed = 0;
      while (placed < MINES) {
        const idx = Math.floor(Math.random() * GRID * GRID);
        if (!board[idx].mine) {
          board[idx].mine = true;
          placed++;
        }
      }

      // Calculate counts
      for (let i = 0; i < GRID * GRID; i++) {
        if (board[i].mine) continue;
        const neighbors = getNeighbors(i);
        board[i].count = neighbors.filter(n => board[n].mine).length;
      }

      gameOver = false;
      won = false;
    }

    function getNeighbors(idx) {
      const row = Math.floor(idx / GRID);
      const col = idx % GRID;
      const neighbors = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID) {
            neighbors.push(nr * GRID + nc);
          }
        }
      }
      return neighbors;
    }

    function reveal(idx) {
      if (board[idx].revealed || board[idx].flagged) return;
      board[idx].revealed = true;

      if (board[idx].mine) {
        gameOver = true;
        // Reveal all mines
        board.forEach(c => { if (c.mine) c.revealed = true; });
        return;
      }

      if (board[idx].count === 0) {
        getNeighbors(idx).forEach(reveal);
      }

      // Check win
      const unrevealed = board.filter(c => !c.revealed && !c.mine);
      if (unrevealed.length === 0) {
        won = true;
        gameOver = true;
        window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'minesweeper' } }));
      }
    }

    function draw() {
      const colors = ['#4ecdc4', '#6bcb77', '#ffd93d', '#ff9f43', '#ff6b6b', '#a55eea', '#333', '#fff'];

      for (let i = 0; i < GRID * GRID; i++) {
        const x = (i % GRID) * CELL;
        const y = Math.floor(i / GRID) * CELL;
        const cell = board[i];

        if (cell.revealed) {
          ctx.fillStyle = cell.mine ? '#ff6b6b' : '#1a1a1a';
          ctx.fillRect(x, y, CELL, CELL);

          if (cell.mine) {
            ctx.fillStyle = '#000';
            ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
          } else if (cell.count > 0) {
            ctx.fillStyle = colors[cell.count - 1];
            ctx.fillRect(x + CELL / 2 - 1, y + CELL / 2 - 1, 2, 2);
          }
        } else {
          ctx.fillStyle = '#333';
          ctx.fillRect(x, y, CELL, CELL);
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);

          if (cell.flagged) {
            ctx.fillStyle = '#ff6b6b';
            ctx.fillRect(x + 2, y + 2, 2, 3);
          }
        }

        // Grid lines
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x + CELL - 1, y, 1, CELL);
        ctx.fillRect(x, y + CELL - 1, CELL, 1);
      }

      // Win/lose indicator
      if (gameOver) {
        ctx.fillStyle = won ? '#4ecdc4' : '#ff6b6b';
        ctx.fillRect(0, 0, SIZE, 2);
      }
    }

    canvas.addEventListener('click', (e) => {
      if (gameOver) {
        reset();
        draw();
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) * (SIZE / rect.width) / CELL);
      const y = Math.floor((e.clientY - rect.top) * (SIZE / rect.height) / CELL);
      const idx = y * GRID + x;

      if (x >= 0 && x < GRID && y >= 0 && y < GRID) {
        reveal(idx);
        draw();
      }
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (gameOver) return;

      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) * (SIZE / rect.width) / CELL);
      const y = Math.floor((e.clientY - rect.top) * (SIZE / rect.height) / CELL);
      const idx = y * GRID + x;

      if (x >= 0 && x < GRID && y >= 0 && y < GRID && !board[idx].revealed) {
        board[idx].flagged = !board[idx].flagged;
        draw();
      }
    });

    reset();
    draw();
  }

  document.querySelectorAll('.ant-game[data-game="minesweeper"]').forEach(init);
})();
