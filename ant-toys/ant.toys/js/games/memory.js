// Memory for ants - tiny color matching
(function() {
  const SIZE = 28;
  const GRID = 4;
  const CELL = SIZE / GRID;

  function init(container) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: pointer;';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const COLORS = [
      '#ff6b6b', '#4ecdc4', '#ffd93d', '#6bcb77',
      '#a55eea', '#ff9f43', '#54a0ff', '#f368e0'
    ];

    let cards = [];
    let revealed = [];  // Currently flipped (max 2)
    let matched = [];   // Successfully matched pairs
    let seen = [];      // Cards that have been revealed before
    let misses = 0;
    let canClick = true;
    let won = false;
    let winDispatched = false;

    function reset() {
      // Create pairs
      const pairs = [];
      for (let i = 0; i < 8; i++) {
        pairs.push(i, i);
      }
      // Shuffle
      for (let i = pairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
      }
      cards = pairs;
      revealed = [];
      matched = [];
      seen = new Array(16).fill(false);
      misses = 0;
      canClick = true;
      won = false;
      winDispatched = false;
    }

    function draw() {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, SIZE, SIZE);

      for (let i = 0; i < 16; i++) {
        const x = (i % GRID) * CELL;
        const y = Math.floor(i / GRID) * CELL;

        if (matched.includes(i)) {
          // Matched - empty
          ctx.fillStyle = '#0d0d0d';
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        } else if (revealed.includes(i)) {
          // Revealed - show color
          ctx.fillStyle = COLORS[cards[i]];
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        } else {
          // Hidden - card back
          ctx.fillStyle = seen[i] ? '#2a2a2a' : '#333';
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          // Dot pattern
          ctx.fillStyle = seen[i] ? '#222' : '#2a2a2a';
          ctx.fillRect(x + CELL/2 - 1, y + CELL/2 - 1, 2, 2);
        }
      }

      // Miss indicator (red dots at top)
      for (let i = 0; i < Math.min(misses, 5); i++) {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(SIZE - 3 - i * 3, 1, 2, 2);
      }

      // Win indicator
      if (won) {
        ctx.fillStyle = misses === 0 ? '#4ecdc4' : '#ffd93d';
        ctx.fillRect(0, 0, SIZE, 2);
        if (misses === 0 && !winDispatched) {
          winDispatched = true;
          window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'memory' } }));
        }
      }
    }

    function checkMatch() {
      canClick = false;
      const [a, b] = revealed;

      setTimeout(() => {
        if (cards[a] === cards[b]) {
          // Match!
          matched.push(a, b);
          if (matched.length === 16) {
            won = true;
          }
        }
        revealed = [];
        canClick = true;
        draw();
      }, 400);
    }

    canvas.addEventListener('click', (e) => {
      if (won) {
        reset();
        draw();
        return;
      }

      if (!canClick) return;

      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) * (SIZE / rect.width) / CELL);
      const y = Math.floor((e.clientY - rect.top) * (SIZE / rect.height) / CELL);
      const idx = y * GRID + x;

      if (x < 0 || x >= GRID || y < 0 || y >= GRID) return;
      if (matched.includes(idx) || revealed.includes(idx)) return;

      // Check for miss - clicking a seen card that isn't the match for revealed[0]
      if (revealed.length === 1 && seen[idx]) {
        const firstCard = cards[revealed[0]];
        const clickedCard = cards[idx];
        if (firstCard !== clickedCard) {
          // You clicked a card you've seen before, but it's not the match
          misses++;
        }
      }

      // Mark as seen
      seen[idx] = true;

      revealed.push(idx);
      draw();

      if (revealed.length === 2) {
        checkMatch();
      }
    });

    reset();
    draw();
  }

  document.querySelectorAll('.ant-game[data-game="memory"]').forEach(init);
})();
