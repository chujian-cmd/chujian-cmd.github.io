// Simon for ants - memory pattern game
(function() {
  const SIZE = 30;
  const HALF = SIZE / 2;

  function init(container) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: pointer;';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const COLORS = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#6bcb77'];
    const DIM_COLORS = ['#662929', '#1f524f', '#665717', '#2b512f'];

    let sequence = [];
    let playerIndex = 0;
    let isShowingSequence = false;
    let gameOver = false;
    let highlightedQuadrant = -1;
    let canPlay = false;

    function draw() {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Draw 4 quadrants
      const quads = [
        { x: 1, y: 1, w: HALF - 2, h: HALF - 2 },           // top-left (0)
        { x: HALF + 1, y: 1, w: HALF - 2, h: HALF - 2 },    // top-right (1)
        { x: 1, y: HALF + 1, w: HALF - 2, h: HALF - 2 },    // bottom-left (2)
        { x: HALF + 1, y: HALF + 1, w: HALF - 2, h: HALF - 2 } // bottom-right (3)
      ];

      quads.forEach((q, i) => {
        const isLit = highlightedQuadrant === i;
        ctx.fillStyle = isLit ? COLORS[i] : DIM_COLORS[i];
        ctx.fillRect(q.x, q.y, q.w, q.h);
      });

      // Center dot shows level
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(HALF, HALF, 4, 0, Math.PI * 2);
      ctx.fill();

      // Level indicator (tiny dots)
      const level = sequence.length;
      ctx.fillStyle = '#666';
      for (let i = 0; i < Math.min(level, 6); i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const dx = Math.cos(angle) * 2;
        const dy = Math.sin(angle) * 2;
        ctx.fillRect(HALF + dx, HALF + dy, 1, 1);
      }

      // Game over indicator
      if (gameOver) {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(HALF - 1, HALF - 1, 2, 2);
      }
    }

    function addToSequence() {
      sequence.push(Math.floor(Math.random() * 4));
    }

    function showSequence() {
      isShowingSequence = true;
      canPlay = false;
      let i = 0;

      function showNext() {
        if (i >= sequence.length) {
          highlightedQuadrant = -1;
          isShowingSequence = false;
          canPlay = true;
          draw();
          return;
        }

        highlightedQuadrant = sequence[i];
        draw();

        setTimeout(() => {
          highlightedQuadrant = -1;
          draw();
          i++;
          setTimeout(showNext, 150);
        }, 300);
      }

      setTimeout(showNext, 500);
    }

    function startGame() {
      sequence = [];
      playerIndex = 0;
      gameOver = false;
      addToSequence();
      showSequence();
    }

    function handleInput(quadrant) {
      if (!canPlay || isShowingSequence || gameOver) return;

      highlightedQuadrant = quadrant;
      draw();

      setTimeout(() => {
        highlightedQuadrant = -1;
        draw();

        if (quadrant === sequence[playerIndex]) {
          playerIndex++;

          if (playerIndex >= sequence.length) {
            // Completed sequence
            if (sequence.length >= 10) {
              window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'simon' } }));
            }
            playerIndex = 0;
            addToSequence();
            setTimeout(showSequence, 500);
          }
        } else {
          // Wrong - game over
          gameOver = true;
          draw();
        }
      }, 150);
    }

    canvas.addEventListener('click', (e) => {
      if (gameOver || sequence.length === 0) {
        startGame();
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (SIZE / rect.width);
      const y = (e.clientY - rect.top) * (SIZE / rect.height);

      let quadrant = -1;
      if (x < HALF && y < HALF) quadrant = 0;
      else if (x >= HALF && y < HALF) quadrant = 1;
      else if (x < HALF && y >= HALF) quadrant = 2;
      else if (x >= HALF && y >= HALF) quadrant = 3;

      if (quadrant >= 0) {
        handleInput(quadrant);
      }
    });

    draw();
  }

  document.querySelectorAll('.ant-game[data-game="simon"]').forEach(init);
})();
