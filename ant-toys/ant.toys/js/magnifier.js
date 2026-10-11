// Magnifying glass for ant-sized everything
(function() {
  const LENS_SIZE = 220;
  const ZOOM = 5;

  let lens = null;
  let lensCanvas = null;
  let lensCtx = null;
  let domClone = null;
  let isActive = true;
  let mouseX = 0;
  let mouseY = 0;

  // Load saved state
  try {
    const saved = localStorage.getItem('mag-active');
    if (saved !== null) isActive = saved === 'true';
  } catch (e) {}

  function init() {
    // Create lens container
    lens = document.createElement('div');
    lens.id = 'magnifier';
    lens.style.cssText = `
      position: fixed;
      width: ${LENS_SIZE}px;
      height: ${LENS_SIZE}px;
      border-radius: 50%;
      border: 3px solid #444;
      box-shadow: 0 0 20px rgba(0,0,0,0.5), inset 0 0 40px rgba(0,0,0,0.3);
      z-index: 9999;
      display: none;
      overflow: hidden;
      pointer-events: none;
      background: #0a0a0a;
    `;

    // DOM magnification layer
    domClone = document.createElement('div');
    domClone.style.cssText = `
      position: absolute;
      transform-origin: center center;
      pointer-events: none;
      will-change: transform;
    `;
    lens.appendChild(domClone);

    // Canvas layer for game canvases (on top)
    lensCanvas = document.createElement('canvas');
    lensCanvas.width = LENS_SIZE;
    lensCanvas.height = LENS_SIZE;
    lensCanvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      border-radius: 50%;
      image-rendering: pixelated;
    `;
    lens.appendChild(lensCanvas);
    lensCtx = lensCanvas.getContext('2d');

    document.body.appendChild(lens);

    // Create toggle button
    const toggle = document.createElement('button');
    toggle.id = 'mag-toggle';
    toggle.innerHTML = '&#128269;';
    toggle.title = 'Toggle magnifying glass';
    toggle.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: 2px solid #444;
      background: #1a1a1a;
      font-size: 24px;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    `;
    function toggleMag(e) {
      e.preventDefault();
      e.stopPropagation();
      isActive = !isActive;
      toggle.style.opacity = isActive ? 1 : 0.4;
      if (!isActive) lens.style.display = 'none';
      try { localStorage.setItem('mag-active', String(isActive)); } catch (e) {}
    }
    toggle.addEventListener('click', toggleMag);
    toggle.addEventListener('touchend', toggleMag);
    toggle.style.opacity = isActive ? 1 : 0.4;
    document.body.appendChild(toggle);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onTouch, { passive: false });

    // Continuous render loop
    function render() {
      if (isActive && lens.style.display !== 'none') {
        updateLens(mouseX, mouseY);
      }
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }

  function onMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!isActive) return;
    lens.style.display = 'block';
    lens.style.left = (mouseX - LENS_SIZE / 2) + 'px';
    lens.style.top = (mouseY - LENS_SIZE / 2) + 'px';
  }

  function onTouch(e) {
    const t = e.touches[0];
    mouseX = t.clientX;
    mouseY = t.clientY;
    if (!isActive) return;
    e.preventDefault();
    lens.style.display = 'block';
    lens.style.left = (mouseX - LENS_SIZE / 2) + 'px';
    lens.style.top = (mouseY - LENS_SIZE / 2) + 'px';
  }

  function updateLens(x, y) {
    // Update DOM clone position to show magnified area
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Clone body content for DOM magnification
    domClone.innerHTML = '';
    const clone = document.body.cloneNode(true);

    // Remove the magnifier from clone
    const magInClone = clone.querySelector('#magnifier');
    if (magInClone) magInClone.remove();
    const toggleInClone = clone.querySelector('#mag-toggle');
    if (toggleInClone) toggleInClone.remove();
    // Remove canvases from clone (we draw those separately)
    clone.querySelectorAll('canvas').forEach(c => {
      c.style.visibility = 'hidden';
    });

    clone.style.cssText = `
      position: absolute;
      left: ${-((x + scrollX) * ZOOM - LENS_SIZE / 2)}px;
      top: ${-((y + scrollY) * ZOOM - LENS_SIZE / 2)}px;
      width: ${document.body.scrollWidth}px;
      transform: scale(${ZOOM});
      transform-origin: 0 0;
      pointer-events: none;
    `;
    domClone.appendChild(clone);

    // Clear canvas layer
    lensCtx.clearRect(0, 0, LENS_SIZE, LENS_SIZE);

    // Create circular clip
    lensCtx.save();
    lensCtx.beginPath();
    lensCtx.arc(LENS_SIZE / 2, LENS_SIZE / 2, LENS_SIZE / 2 - 2, 0, Math.PI * 2);
    lensCtx.clip();

    // Draw magnified canvases
    const canvases = document.querySelectorAll('canvas:not(#magnifier canvas)');
    canvases.forEach(canvas => {
      const rect = canvas.getBoundingClientRect();

      // Calculate where this canvas should appear in the lens
      const canvasScreenX = rect.left;
      const canvasScreenY = rect.top;

      // Position in lens coordinates
      const lensX = (canvasScreenX - x) * ZOOM + LENS_SIZE / 2;
      const lensY = (canvasScreenY - y) * ZOOM + LENS_SIZE / 2;

      // Only draw if canvas is potentially visible in lens
      const scaledWidth = rect.width * ZOOM;
      const scaledHeight = rect.height * ZOOM;

      if (lensX + scaledWidth > 0 && lensX < LENS_SIZE &&
          lensY + scaledHeight > 0 && lensY < LENS_SIZE) {
        lensCtx.imageSmoothingEnabled = false;
        lensCtx.drawImage(
          canvas,
          0, 0, canvas.width, canvas.height,
          lensX, lensY, scaledWidth, scaledHeight
        );
      }
    });

    lensCtx.restore();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
