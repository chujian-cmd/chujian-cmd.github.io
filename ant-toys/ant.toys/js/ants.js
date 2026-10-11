// Background ants - tiny crawling particles + secret game
(function() {
  const ANT_COUNT = 50;
  const ANT_SIZE = 3;
  const STORAGE_KEY = 'ant-clicks';
  const GAMES = ['tictactoe', 'snake', 'pong', 'checkers', 'breakout', 'minesweeper', 'flappy', 'whackamole', 'simon', 'memory', 'connect4', 'jumpingant', 'ants'];

  let canvas, ctx;
  let ants = [];
  let totalClicks = 0;
  let gameWon = false;
  let flashMode = false;  // SOS test mode - flashing
  let allComplete = false; // True win - stay glowing
  let flashTime = 0;
  let keyBuffer = '';

  function checkAllComplete() {
    // Check if all ants clicked
    if (totalClicks < ANT_COUNT) return false;
    // Check if all games won
    try {
      const wins = JSON.parse(localStorage.getItem('ant-wins') || '{}');
      return GAMES.every(game => wins[game]);
    } catch (e) {
      return false;
    }
  }

  // Simple seeded random for consistent per-page results
  function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'ants-bg';
    canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      z-index: -1;
      pointer-events: none;
    `;
    document.body.prepend(canvas);
    ctx = canvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize);
    // Resize when content changes document height
    new ResizeObserver(resize).observe(document.body);

    // Load saved click count
    try {
      totalClicks = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    } catch (e) {
      totalClicks = 0;
    }

    // Create ants
    for (let i = 0; i < ANT_COUNT; i++) {
      ants.push(createAnt(i));
    }

    // Pre-click ants based on stored count (different per page)
    const pageHash = hashString(window.location.pathname);
    const preClickCount = Math.min(totalClicks, ANT_COUNT);
    const indices = [];
    for (let i = 0; i < ANT_COUNT; i++) indices.push(i);
    // Shuffle using page hash as seed
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(pageHash + i) * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    // Mark first N as clicked
    for (let i = 0; i < preClickCount; i++) {
      ants[indices[i]].clicked = true;
    }

    if (totalClicks >= ANT_COUNT) {
      gameWon = true;
    }

    // Secret game - click to catch ants (listen on document since canvas is z-index: -1)
    document.addEventListener('click', onCanvasClick);
    document.addEventListener('touchstart', onCanvasTouch);

    // Secret "sos" key code to trigger flash effect
    document.addEventListener('keydown', (e) => {
      keyBuffer += e.key.toLowerCase();
      if (keyBuffer.length > 10) keyBuffer = keyBuffer.slice(-10);
      if (keyBuffer.includes('sos')) {
        keyBuffer = '';
        triggerFlash();
      }
    });

    // Listen for game wins - flash briefly to celebrate, permanent glow if all complete
    window.addEventListener('ant-win', (e) => {
      console.log('ant-win received:', e.detail);
      // Flash for 2 seconds to celebrate the win
      flashMode = true;
      flashTime = Date.now();
      console.log('flashMode set to true');
      setTimeout(() => {
        flashMode = false;
        // Check if everything is complete after flash
        if (checkAllComplete()) {
          allComplete = true;
        }
      }, 2000);
    });

    // Check on load if already complete
    if (checkAllComplete()) {
      allComplete = true;
    }

    requestAnimationFrame(update);
  }

  function triggerFlash() {
    flashMode = true;
    flashTime = Date.now();
    // Flash for 3 seconds
    setTimeout(() => { flashMode = false; }, 3000);
  }

  function resize() {
    const docHeight = Math.max(document.body.scrollHeight, window.innerHeight);
    canvas.width = window.innerWidth;
    canvas.height = docHeight;
    canvas.style.height = docHeight + 'px';
  }

  function createAnt(index) {
    const docHeight = Math.max(document.body.scrollHeight, window.innerHeight);
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * docHeight,
      angle: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.4,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.05 + Math.random() * 0.05,
      size: 2 + Math.random() * 1.5,
      clicked: false,
      index: index,
      flashOffset: Math.random() * 1000 // Random offset for de-synced flashing
    };
  }

  function onCanvasClick(e) {
    checkAntClick(e.clientX + window.scrollX, e.clientY + window.scrollY);
  }

  function onCanvasTouch(e) {
    const t = e.touches[0];
    checkAntClick(t.clientX + window.scrollX, t.clientY + window.scrollY);
  }

  function checkAntClick(x, y) {
    if (gameWon) return;

    ants.forEach(ant => {
      if (ant.clicked) return;
      const dist = Math.hypot(x - ant.x, y - ant.y);
      if (dist < ant.size * 1.5) {
        ant.clicked = true;
        totalClicks++;
        try {
          localStorage.setItem(STORAGE_KEY, String(totalClicks));
        } catch (e) {}

        // Dispatch event for scoreboard
        window.dispatchEvent(new CustomEvent('ant-click', { detail: { count: totalClicks } }));

        if (totalClicks >= ANT_COUNT) {
          gameWon = true;
          window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'ants' } }));
          // Permanent glow if all games also won
          if (checkAllComplete()) {
            allComplete = true;
          }
        }
      }
    });
  }

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ants.forEach(ant => {
      // Wobble movement like real ants
      ant.wobble += ant.wobbleSpeed;
      ant.angle += Math.sin(ant.wobble) * 0.1;

      // Occasional random turn
      if (Math.random() < 0.012) {
        ant.angle += (Math.random() - 0.5) * Math.PI * 0.5;
      }

      // Rare bigger direction change
      if (Math.random() < 0.003) {
        ant.angle += (Math.random() - 0.5) * Math.PI * 0.8;
      }

      // Vary speed slightly
      const speedVariation = 0.85 + Math.random() * 0.3;

      // Move
      ant.x += Math.cos(ant.angle) * ant.speed * speedVariation;
      ant.y += Math.sin(ant.angle) * ant.speed * speedVariation;

      // Wrap around edges
      if (ant.x < -10) ant.x = canvas.width + 10;
      if (ant.x > canvas.width + 10) ant.x = -10;
      if (ant.y < -10) ant.y = canvas.height + 10;
      if (ant.y > canvas.height + 10) ant.y = -10;

      // Draw ant - clicked ants glow blue
      // allComplete = permanent glow, flashMode = synced flashing celebration
      const isFlashing = flashMode && Math.floor((Date.now() - flashTime) / 150) % 2 === 0;
      if (allComplete || isFlashing) {
        // ALL ants glow during flash or when complete
        ctx.fillStyle = '#4ecdc4';
        ctx.shadowColor = '#4ecdc4';
        ctx.shadowBlur = isFlashing ? 20 : 6;
      } else if (ant.clicked) {
        // Individual clicked ant glow
        ctx.fillStyle = '#4ecdc4';
        ctx.shadowColor = '#4ecdc4';
        ctx.shadowBlur = 2;
      } else {
        // Subtle gray - slightly visible
        ctx.fillStyle = 'rgba(85, 85, 85, 0.7)';
        ctx.shadowBlur = 0;
      }

      // Body (two tiny segments)
      const headX = ant.x + Math.cos(ant.angle) * ant.size * 0.5;
      const headY = ant.y + Math.sin(ant.angle) * ant.size * 0.5;
      const tailX = ant.x - Math.cos(ant.angle) * ant.size * 0.5;
      const tailY = ant.y - Math.sin(ant.angle) * ant.size * 0.5;

      ctx.beginPath();
      ctx.arc(headX, headY, ant.size * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(tailX, tailY, ant.size * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Reset shadow for legs
      ctx.shadowBlur = 0;

      // Legs (tiny lines)
      ctx.strokeStyle = (allComplete || ant.clicked || isFlashing) ? '#4ecdc4' : 'rgba(85, 85, 85, 0.5)';
      ctx.lineWidth = 0.5;
      const perpAngle = ant.angle + Math.PI / 2;
      for (let i = -1; i <= 1; i++) {
        const legX = ant.x + Math.cos(ant.angle) * i * ant.size * 0.3;
        const legY = ant.y + Math.sin(ant.angle) * i * ant.size * 0.3;
        const legWobble = Math.sin(ant.wobble * 3 + i) * 0.3;

        ctx.beginPath();
        ctx.moveTo(legX, legY);
        ctx.lineTo(
          legX + Math.cos(perpAngle + legWobble) * ant.size,
          legY + Math.sin(perpAngle + legWobble) * ant.size
        );
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(legX, legY);
        ctx.lineTo(
          legX - Math.cos(perpAngle - legWobble) * ant.size,
          legY - Math.sin(perpAngle - legWobble) * ant.size
        );
        ctx.stroke();
      }
    });

    requestAnimationFrame(update);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
