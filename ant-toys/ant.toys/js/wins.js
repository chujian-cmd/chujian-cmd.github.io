// Win tracker - microscopic achievement checklist
(function() {
  // Games in display order - ants always last
  const GAMES = [
    'tictactoe', 'snake', 'pong', 'checkers',
    'breakout', 'minesweeper', 'flappy', 'whackamole',
    'simon', 'memory', 'connect4', 'jumpingant',
    'labyrinth', 'rockskip', 'ants'
  ];

  const ANT_COUNT = 50;
  const COLS = 2;
  const ROW_H = 9;
  const COL_W = 38;
  const WIDTH = COLS * COL_W + 4;
  const ROWS = Math.ceil(GAMES.length / COLS);
  const HEIGHT = ROWS * ROW_H + 30;

  let canvas, ctx;
  let wins = {};
  let antClicks = 0;
  let dpr = 1;

  function init() {
    try {
      wins = JSON.parse(localStorage.getItem('ant-wins') || '{}');
    } catch (e) {
      wins = {};
    }

    try {
      antClicks = parseInt(localStorage.getItem('ant-clicks') || '0', 10);
    } catch (e) {
      antClicks = 0;
    }

    window.addEventListener('ant-win', (e) => {
      const game = e.detail.game;
      if (GAMES.includes(game) && !wins[game]) {
        wins[game] = true;
        localStorage.setItem('ant-wins', JSON.stringify(wins));
        if (ctx) draw();
      }
    });

    window.addEventListener('ant-click', (e) => {
      antClicks = e.detail.count;
      if (ctx) draw();
    });

    const container = document.getElementById('win-tracker');
    if (!container) return;

    dpr = window.devicePixelRatio || 1;

    canvas = document.createElement('canvas');
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = WIDTH + 'px';
    canvas.style.height = HEIGHT + 'px';
    canvas.style.imageRendering = 'pixelated';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.scale(dpr, dpr);

    draw();
  }

  function draw() {
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Game checklist - 2 columns
    GAMES.forEach((game, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = 6 + col * COL_W;
      const y = 6 + row * ROW_H;
      const won = wins[game];

      // Checkbox (4x4)
      ctx.fillStyle = won ? '#4ecdc4' : '#252525';
      ctx.fillRect(x, y + 1, 4, 4);

      // Game abbreviation (3 chars)
      const abbrev = game.slice(0, 3).toUpperCase();
      for (let c = 0; c < 3; c++) {
        drawTinyChar(ctx, abbrev[c], x + 7 + c * 7, y, won ? '#4ecdc4' : '#444');
      }
    });

    // Ants clicked counter - dot grid (10x5 = 50)
    const antY = 6 + ROWS * ROW_H + 6;
    const dotCols = 10;
    const dotRows = 5;
    const dotSize = 2;
    const dotGap = 1;
    const gridWidth = dotCols * dotSize + (dotCols - 1) * dotGap;
    const gridStartX = Math.floor((WIDTH - gridWidth) / 2);

    for (let i = 0; i < ANT_COUNT; i++) {
      const col = i % dotCols;
      const row = Math.floor(i / dotCols);
      const x = gridStartX + col * (dotSize + dotGap);
      const y = antY + row * (dotSize + dotGap);

      const filled = i < antClicks;
      ctx.fillStyle = filled ? '#4ecdc4' : '#2a2a2a';
      ctx.fillRect(x, y, dotSize, dotSize);
    }
  }

  function drawTinyChar(ctx, char, x, y, color) {
    ctx.fillStyle = color;
    const chars = {
      'T': [[0,0],[1,0],[2,0],[1,1],[1,2]],
      'I': [[1,0],[1,1],[1,2]],
      'C': [[0,0],[1,0],[2,0],[0,1],[0,2],[1,2],[2,2]],
      'S': [[0,0],[1,0],[2,0],[0,1],[1,1],[2,2],[1,2],[0,2]],
      'N': [[0,0],[0,1],[0,2],[1,1],[2,0],[2,1],[2,2]],
      'A': [[1,0],[0,1],[2,1],[0,2],[2,2],[1,1]],
      'K': [[0,0],[0,1],[0,2],[1,1],[2,0],[2,2]],
      'E': [[0,0],[1,0],[2,0],[0,1],[1,1],[0,2],[1,2],[2,2]],
      'P': [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2]],
      'O': [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2]],
      'G': [[0,0],[1,0],[2,0],[0,1],[0,2],[1,2],[2,2],[2,1]],
      'H': [[0,0],[0,1],[0,2],[1,1],[2,0],[2,1],[2,2]],
      'B': [[0,0],[1,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]],
      'R': [[0,0],[1,0],[2,0],[0,1],[1,1],[0,2],[2,2]],
      'M': [[0,0],[0,1],[0,2],[1,0],[2,0],[2,1],[2,2]],
      'F': [[0,0],[1,0],[2,0],[0,1],[1,1],[0,2]],
      'L': [[0,0],[0,1],[0,2],[1,2],[2,2]],
      'W': [[0,0],[0,1],[0,2],[1,2],[2,0],[2,1],[2,2]],
      'D': [[0,0],[1,0],[0,1],[2,1],[0,2],[1,2]],
      'U': [[0,0],[0,1],[0,2],[1,2],[2,0],[2,1],[2,2]],
      'J': [[2,0],[2,1],[0,2],[1,2],[2,2]],
      'Y': [[0,0],[2,0],[1,1],[1,2]],
      '0': [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2]],
      '1': [[1,0],[1,1],[1,2]],
      '2': [[0,0],[1,0],[2,0],[2,1],[1,1],[0,1],[0,2],[1,2],[2,2]],
      '3': [[0,0],[1,0],[2,0],[1,1],[2,1],[0,2],[1,2],[2,2]],
      '4': [[0,0],[0,1],[1,1],[2,0],[2,1],[2,2]],
      '5': [[0,0],[1,0],[2,0],[0,1],[1,1],[2,2],[1,2],[0,2]],
      '6': [[0,0],[1,0],[2,0],[0,1],[1,1],[0,2],[1,2],[2,2]],
      '7': [[0,0],[1,0],[2,0],[2,1],[2,2]],
      '8': [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]],
      '9': [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[2,2]],
    };
    const pixels = chars[char] || [];
    pixels.forEach(([px, py]) => {
      ctx.fillRect(x + px * 2, y + py * 2, 2, 2);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.resetAntWins = function() {
    wins = {};
    localStorage.removeItem('ant-wins');
    draw();
  };
})();
