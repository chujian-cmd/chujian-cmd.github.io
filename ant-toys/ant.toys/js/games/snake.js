// Snake for ants - impossibly tiny
(function() {
  const SIZE = 30;
  const GRID = 10;
  const CELL = SIZE / GRID;

  function init(container) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: pointer;';
    canvas.tabIndex = 0;
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let snake = [{x: 5, y: 5}, {x: 4, y: 5}, {x: 3, y: 5}];
    let dir = {x: 1, y: 0};
    let nextDir = {x: 1, y: 0};
    let food = {x: 7, y: 5};
    let alive = true;
    let score = 0;

    function spawnFood() {
      const empty = [];
      for (let x = 0; x < GRID; x++) {
        for (let y = 0; y < GRID; y++) {
          if (!snake.some(s => s.x === x && s.y === y)) {
            empty.push({x, y});
          }
        }
      }
      if (empty.length) {
        food = empty[Math.floor(Math.random() * empty.length)];
      }
    }

    function draw() {
      // Background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Food
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(food.x * CELL, food.y * CELL, CELL, CELL);

      // Snake
      snake.forEach((seg, i) => {
        ctx.fillStyle = i === 0 ? '#4ecdc4' : '#45b7aa';
        ctx.fillRect(seg.x * CELL, seg.y * CELL, CELL, CELL);
      });

      // Dead overlay
      if (!alive) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = '#fff';
        ctx.fillRect(SIZE/2 - 2, SIZE/2 - 2, 4, 4);
      }
    }

    function update() {
      if (!alive) return;

      dir = nextDir;
      const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};

      // Wall collision
      if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
        alive = false;
        draw();
        return;
      }

      // Self collision
      if (snake.some(s => s.x === head.x && s.y === head.y)) {
        alive = false;
        draw();
        return;
      }

      snake.unshift(head);

      // Food
      if (head.x === food.x && head.y === food.y) {
        score++;
        if (score >= 10) {
          window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'snake' } }));
        }
        spawnFood();
      } else {
        snake.pop();
      }

      draw();
    }

    function handleKey(key) {
      if (!alive) {
        // Reset
        snake = [{x: 5, y: 5}, {x: 4, y: 5}, {x: 3, y: 5}];
        dir = {x: 1, y: 0};
        nextDir = {x: 1, y: 0};
        alive = true;
        score = 0;
        spawnFood();
        return;
      }

      switch(key) {
        case 'ArrowUp': case 'w': case 'W':
          if (dir.y !== 1) nextDir = {x: 0, y: -1};
          break;
        case 'ArrowDown': case 's': case 'S':
          if (dir.y !== -1) nextDir = {x: 0, y: 1};
          break;
        case 'ArrowLeft': case 'a': case 'A':
          if (dir.x !== 1) nextDir = {x: -1, y: 0};
          break;
        case 'ArrowRight': case 'd': case 'D':
          if (dir.x !== -1) nextDir = {x: 1, y: 0};
          break;
      }
    }

    canvas.addEventListener('keydown', (e) => {
      e.preventDefault();
      handleKey(e.key);
    });

    canvas.addEventListener('click', () => {
      canvas.focus();
      if (!alive) handleKey('reset');
    });

    // Swipe controls for touch
    let touchStart = null;
    canvas.addEventListener('touchstart', (e) => {
      touchStart = {x: e.touches[0].clientX, y: e.touches[0].clientY};
      canvas.focus();
    });

    canvas.addEventListener('touchend', (e) => {
      if (!touchStart) return;
      const dx = e.changedTouches[0].clientX - touchStart.x;
      const dy = e.changedTouches[0].clientY - touchStart.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        handleKey(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      } else {
        handleKey(dy > 0 ? 'ArrowDown' : 'ArrowUp');
      }
      touchStart = null;
    });

    draw();
    setInterval(update, 200);
  }

  document.querySelectorAll('.ant-game[data-game="snake"]').forEach(init);
})();
