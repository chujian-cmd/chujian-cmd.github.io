// Rock skip for ants - tiny stone skipping
(function() {
  const WIDTH = 65;
  const HEIGHT = 30;
  const WATER_Y = 22;

  function init(container) {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.style.cssText = 'image-rendering: pixelated; cursor: pointer;';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Stone state
    let stone = null;
    let skips = 0;
    let bestSkips = 0;
    let lastSkips = 0;
    let throwing = false;
    let dragStart = null;
    let dragEnd = null;
    let won = false;
    let splashes = [];

    const startX = 6;
    const startY = WATER_Y - 4;

    function reset() {
      stone = null;
      skips = 0;
      throwing = false;
      dragStart = null;
      dragEnd = null;
      splashes = [];
    }

    function throwStone(power, angle) {
      stone = {
        x: startX,
        y: startY,
        vx: Math.cos(angle) * power * 0.11,
        vy: Math.sin(angle) * power * 0.11,
      };
      skips = 0;
    }

    function update() {
      if (!stone) return;

      // Gravity
      stone.vy += 0.055;

      // Move
      stone.x += stone.vx;
      stone.y += stone.vy;

      // Water collision - skip!
      if (stone.y >= WATER_Y && stone.vy > 0) {
        // Only skip if moving fast enough horizontally
        if (stone.vx > 0.25 && Math.abs(stone.vy) < 2) {
          stone.y = WATER_Y - 1;
          stone.vy = -Math.abs(stone.vy) * 0.7;
          stone.vx *= 0.88;
          skips++;
          // Splash effect
          splashes.push({ x: stone.x, y: WATER_Y, t: 8 });

          if (skips > bestSkips) bestSkips = skips;
        } else {
          // Sinks
          splashes.push({ x: stone.x, y: WATER_Y, t: 12 });
          console.log('Skips:', skips, skips === 7 ? '- WIN!' : '');
          lastSkips = skips;
          // Exactly 7 wins
          if (skips === 7 && !won) {
            won = true;
            window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'rockskip' } }));
          }
          stone = null;
        }
      }

      // Off screen
      if (stone && (stone.x > WIDTH + 5 || stone.y > HEIGHT + 5)) {
        console.log('Skips:', skips, skips === 7 ? '- WIN!' : '');
        lastSkips = skips;
        // Exactly 7 wins
        if (skips === 7 && !won) {
          won = true;
          window.dispatchEvent(new CustomEvent('ant-win', { detail: { game: 'rockskip' } }));
        }
        stone = null;
      }

      // Update splashes
      splashes = splashes.filter(s => {
        s.t--;
        return s.t > 0;
      });
    }

    function draw() {
      // Sky
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, WIDTH, WATER_Y);

      // Water
      ctx.fillStyle = '#16213e';
      ctx.fillRect(0, WATER_Y, WIDTH, HEIGHT - WATER_Y);

      // Water surface line
      ctx.fillStyle = '#1f4068';
      ctx.fillRect(0, WATER_Y, WIDTH, 1);

      // Shore
      ctx.fillStyle = '#3d2817';
      ctx.fillRect(0, WATER_Y - 3, 8, HEIGHT);
      ctx.fillStyle = '#4a3728';
      ctx.fillRect(0, WATER_Y - 3, 8, 2);

      // Splashes
      splashes.forEach(s => {
        ctx.fillStyle = `rgba(100, 149, 237, ${s.t / 12})`;
        const r = Math.ceil((12 - s.t) / 3);
        ctx.fillRect(s.x - r, s.y - 1, r * 2, 1);
        if (s.t > 4) {
          ctx.fillRect(s.x - 1, s.y - 2, 2, 1);
        }
      });

      // Stone
      if (stone) {
        ctx.fillStyle = '#888';
        ctx.fillRect(Math.floor(stone.x), Math.floor(stone.y), 2, 2);
        ctx.fillStyle = '#aaa';
        ctx.fillRect(Math.floor(stone.x), Math.floor(stone.y), 1, 1);
      }

      // Ready stone on shore
      if (!stone && !throwing) {
        ctx.fillStyle = '#888';
        ctx.fillRect(startX - 1, startY, 3, 2);
        ctx.fillStyle = '#aaa';
        ctx.fillRect(startX - 1, startY, 1, 1);
      }

      // Drag indicator
      if (throwing && dragStart && dragEnd) {
        ctx.strokeStyle = '#4ecdc4';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        const dx = dragStart.x - dragEnd.x;
        const dy = dragStart.y - dragEnd.y;
        const len = Math.min(Math.sqrt(dx * dx + dy * dy), 20);
        const ang = Math.atan2(dy, dx);
        ctx.lineTo(startX + Math.cos(ang) * len * 0.5, startY + Math.sin(ang) * len * 0.5);
        ctx.stroke();
      }

      // Best score (always show if > 0)
      if (bestSkips > 0) {
        ctx.fillStyle = '#333';
        ctx.fillRect(WIDTH - 10, 2, 8, 4);
        ctx.fillStyle = won ? '#4ecdc4' : '#555';
        const barWidth = Math.min(bestSkips, 7);
        ctx.fillRect(WIDTH - 10, 2, barWidth, 4);
        // Goal marker at 7
        ctx.fillStyle = '#4ecdc4';
        ctx.fillRect(WIDTH - 3, 2, 1, 4);
      }

      // Current skips (during throw)
      if (stone && skips > 0) {
        ctx.fillStyle = '#4ecdc4';
        ctx.fillRect(WIDTH - 10, 8, Math.min(skips, 7), 2);
      }

      // Result display (when stone is gone)
      if (!stone && !throwing && lastSkips > 0) {
        // Draw dots for skip count
        const dotSize = 2;
        const gap = 3;
        const totalWidth = lastSkips * dotSize + (lastSkips - 1) * gap;
        const startX = Math.floor((WIDTH - totalWidth) / 2);
        const dotY = 10;

        for (let i = 0; i < lastSkips; i++) {
          const isTarget = i === 6; // 7th dot (index 6)
          ctx.fillStyle = lastSkips === 7 ? '#4ecdc4' : (isTarget ? '#4ecdc4' : '#888');
          ctx.fillRect(startX + i * (dotSize + gap), dotY, dotSize, dotSize);
        }

        // Show target marker at position 7 if they got less
        if (lastSkips < 7) {
          ctx.fillStyle = '#4ecdc433';
          ctx.fillRect(startX + 6 * (dotSize + gap), dotY, dotSize, dotSize);
        }
      }

      // Win indicator
      if (won && !stone) {
        ctx.fillStyle = 'rgba(78, 205, 196, 0.3)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
    }

    function getCanvasPos(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = WIDTH / rect.width;
      const scaleY = HEIGHT / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }

    function startDrag(clientX, clientY) {
      if (stone) return;
      const pos = getCanvasPos(clientX, clientY);
      throwing = true;
      dragStart = pos;
      dragEnd = pos;
    }

    function moveDrag(clientX, clientY) {
      if (!throwing) return;
      const pos = getCanvasPos(clientX, clientY);
      dragEnd = pos;
    }

    function endDrag() {
      if (!throwing || !dragStart || !dragEnd) {
        throwing = false;
        return;
      }

      const dx = dragStart.x - dragEnd.x;
      const dy = dragStart.y - dragEnd.y;
      const power = Math.min(Math.sqrt(dx * dx + dy * dy), 30);
      const angle = Math.atan2(dy, dx);

      // Only throw if dragging right-ish and with some power
      if (power > 3 && angle > -0.8 && angle < 0.3) {
        throwStone(power, angle);
      }

      throwing = false;
      dragStart = null;
      dragEnd = null;
    }

    // Mouse events - start on canvas, continue on document
    canvas.addEventListener('mousedown', (e) => {
      startDrag(e.clientX, e.clientY);
    });

    document.addEventListener('mousemove', (e) => {
      moveDrag(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', endDrag);

    // Touch events - start on canvas, continue on document
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    });

    document.addEventListener('touchmove', (e) => {
      if (throwing) {
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    });

    document.addEventListener('touchend', (e) => {
      if (throwing) {
        endDrag();
      }
    });

    function loop() {
      update();
      draw();
      requestAnimationFrame(loop);
    }

    draw();
    loop();
  }

  document.querySelectorAll('.ant-game[data-game="rockskip"]').forEach(init);
})();
