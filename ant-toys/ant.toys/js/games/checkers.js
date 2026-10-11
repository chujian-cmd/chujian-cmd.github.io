// Checkers for ants - microscopic strategy
(function() {
  const SIZE = 36;
  const CELL = SIZE / 8;

  function init(container) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: pointer;';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Board: 0=empty, 1=red, 2=black, 3=red king, 4=black king
    let board = [];
    let selected = null;
    let turn = 1; // 1=red (player), 2=black (AI)
    let validMoves = [];

    function resetBoard() {
      board = [];
      for (let i = 0; i < 64; i++) {
        const row = Math.floor(i / 8);
        const col = i % 8;
        if ((row + col) % 2 === 1) {
          if (row < 3) board[i] = 2; // black
          else if (row > 4) board[i] = 1; // red
          else board[i] = 0;
        } else {
          board[i] = 0;
        }
      }
      selected = null;
      turn = 1;
      validMoves = [];
    }

    function draw() {
      // Board
      for (let i = 0; i < 64; i++) {
        const x = (i % 8) * CELL;
        const y = Math.floor(i / 8) * CELL;
        ctx.fillStyle = (Math.floor(i / 8) + i % 8) % 2 === 0 ? '#2a2a2a' : '#1a1a1a';
        ctx.fillRect(x, y, CELL, CELL);
      }

      // Valid move highlights
      validMoves.forEach(m => {
        const x = (m.to % 8) * CELL;
        const y = Math.floor(m.to / 8) * CELL;
        ctx.fillStyle = 'rgba(78, 205, 196, 0.3)';
        ctx.fillRect(x, y, CELL, CELL);
      });

      // Pieces
      for (let i = 0; i < 64; i++) {
        if (board[i] === 0) continue;
        const x = (i % 8) * CELL + CELL / 2;
        const y = Math.floor(i / 8) * CELL + CELL / 2;
        const isKing = board[i] >= 3;
        const isRed = board[i] === 1 || board[i] === 3;

        ctx.fillStyle = isRed ? '#ff6b6b' : '#333';
        ctx.beginPath();
        ctx.arc(x, y, CELL / 2 - 1, 0, Math.PI * 2);
        ctx.fill();

        if (i === selected) {
          ctx.strokeStyle = '#4ecdc4';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (isKing) {
          ctx.fillStyle = '#ffd700';
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }
    }

    function getMoves(idx, mustJump = false) {
      const piece = board[idx];
      if (piece === 0) return [];
      const isKing = piece >= 3;
      const isRed = piece === 1 || piece === 3;
      const row = Math.floor(idx / 8);
      const col = idx % 8;
      const moves = [];
      const dirs = isKing ? [-1, 1] : (isRed ? [-1] : [1]);

      dirs.forEach(dr => {
        [-1, 1].forEach(dc => {
          const nr = row + dr;
          const nc = col + dc;
          const ni = nr * 8 + nc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            if (board[ni] === 0 && !mustJump) {
              moves.push({ from: idx, to: ni, jump: false });
            } else if (board[ni] !== 0) {
              const targetRed = board[ni] === 1 || board[ni] === 3;
              if (targetRed !== isRed) {
                const jr = nr + dr;
                const jc = nc + dc;
                const ji = jr * 8 + jc;
                if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && board[ji] === 0) {
                  moves.push({ from: idx, to: ji, jump: true, captured: ni });
                }
              }
            }
          }
        });
      });

      return moves;
    }

    function getAllMoves(player) {
      let moves = [];
      let hasJump = false;
      for (let i = 0; i < 64; i++) {
        const p = board[i];
        const isRed = p === 1 || p === 3;
        if (p !== 0 && ((player === 1 && isRed) || (player === 2 && !isRed))) {
          const m = getMoves(i);
          m.forEach(move => {
            if (move.jump) hasJump = true;
          });
          moves = moves.concat(m);
        }
      }
      // Must jump if available
      if (hasJump) moves = moves.filter(m => m.jump);
      return moves;
    }

    function makeMove(move) {
      board[move.to] = board[move.from];
      board[move.from] = 0;
      if (move.jump) board[move.captured] = 0;

      // King promotion
      const row = Math.floor(move.to / 8);
      if (row === 0 && board[move.to] === 1) board[move.to] = 3;
      if (row === 7 && board[move.to] === 2) board[move.to] = 4;

      // Check for multi-jump
      if (move.jump) {
        const moreMoves = getMoves(move.to, true).filter(m => m.jump);
        if (moreMoves.length > 0) {
          selected = move.to;
          validMoves = moreMoves;
          draw();
          return false; // Turn not over
        }
      }
      return true; // Turn over
    }

    function aiMove() {
      const moves = getAllMoves(2);
      if (moves.length === 0) {
        window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'checkers' } }));
        return;
      }

      // 35% chance to make a random move instead of optimal (blunder)
      // This makes the AI very beatable
      let choice;
      if (Math.random() < 0.35 && moves.length > 1) {
        choice = moves[Math.floor(Math.random() * moves.length)];
      } else {
        // Prefer jumps when not blundering
        const jumps = moves.filter(m => m.jump);
        choice = jumps.length > 0
          ? jumps[Math.floor(Math.random() * jumps.length)]
          : moves[Math.floor(Math.random() * moves.length)];
      }

      const turnOver = makeMove(choice);
      draw();

      if (!turnOver) {
        setTimeout(aiMove, 200);
      } else {
        turn = 1;
        selected = null;
        validMoves = [];
        // Check if player has any moves - if not, player loses
        if (getAllMoves(1).length === 0) {
          // Player loses - game over, can reset by double-click
          turn = 0; // Disable further play
        }
      }
    }

    canvas.addEventListener('click', (e) => {
      if (turn !== 1) return;

      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) * (SIZE / rect.width) / CELL);
      const y = Math.floor((e.clientY - rect.top) * (SIZE / rect.height) / CELL);
      const idx = y * 8 + x;

      if (x < 0 || x >= 8 || y < 0 || y >= 8) return;

      // Check if clicking a valid move
      const clickedMove = validMoves.find(m => m.to === idx);
      if (clickedMove) {
        const turnOver = makeMove(clickedMove);
        draw();
        if (turnOver) {
          turn = 2;
          selected = null;
          validMoves = [];
          setTimeout(aiMove, 300);
        }
        return;
      }

      // Select a piece
      const piece = board[idx];
      if (piece === 1 || piece === 3) {
        const allMoves = getAllMoves(1);
        const pieceMoves = allMoves.filter(m => m.from === idx);
        if (pieceMoves.length > 0) {
          selected = idx;
          validMoves = pieceMoves;
          draw();
        }
      }
    });

    // Double-click to reset
    canvas.addEventListener('dblclick', () => {
      resetBoard();
      draw();
    });

    resetBoard();
    draw();
  }

  document.querySelectorAll('.ant-game[data-game="checkers"]').forEach(init);
})();
