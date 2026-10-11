// Marbling — paper marbling / suminagashi
// Aubrey Jaffer's mathematical marbling:
//   Drop:  P' = C + (P - C) * sqrt(1 + r^2 / |P-C|^2)
//   Tine:  P' = P + dir * (z*c) / (|perpDist| + z)

;(function () {
  const scale = 2

  const canvas = document.querySelector('#canvas')
  const context = canvas.getContext('2d')
  const wrapper = document.querySelector('.canvas-wrapper')
  const rect = wrapper.getBoundingClientRect()

  const W = rect.width - 40
  const H = rect.height - 40
  canvas.width = W * scale
  canvas.height = H * scale
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'
  context.scale(scale, scale)

  // Water (background) color — warm cream like marbling tray
  const WATER = '#f4ecd8'

  // Three user-editable colors. Defaults are classic marbling tones.
  const colors = ['#1d3a8a', '#b8232a', '#d49327'] // indigo, vermillion, ochre
  let activeColorIndex = 0

  // State
  let dropRadius = 32        // base drop radius (CSS px)
  let combTines = 3
  let combSpacing = 24
  let tool = 'drop'          // 'drop' | 'comb' | 'stylus'
  let dropPolys = []         // {color, pts: [{x,y}, ...]}
  let isDragging = false
  let lastDragPos = null
  let needsRedraw = true

  // Comb easing: target = where the mouse is, smooth = where the comb tip
  // actually is. Lerping smooth → target each frame eases hard turns into
  // flowing curves, like the zen-garden rake.
  let combTarget = null
  let combSmooth = null
  const COMB_EASE = 0.25

  // Resampling: split any edge > MAX_EDGE by linear interp.
  // Lower = smoother under stress, but slower.
  const MAX_EDGE = 2.0
  const MAX_POINTS_PER_POLY = 6000

  // ---------- math ----------

  function sqr(v) { return v * v }

  function makeCircle(cx, cy, r) {
    // Initial point density: keep edges ~MAX_EDGE/2 long
    const segLen = MAX_EDGE * 0.6
    const n = Math.max(24, Math.ceil((2 * Math.PI * r) / segLen))
    const pts = new Array(n)
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2
      pts[i] = { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r }
    }
    return pts
  }

  function applyDrop(cx, cy, r) {
    const r2 = r * r
    for (let p = 0; p < dropPolys.length; p++) {
      const pts = dropPolys[p].pts
      for (let i = 0; i < pts.length; i++) {
        const dx = pts[i].x - cx
        const dy = pts[i].y - cy
        const d2 = dx * dx + dy * dy
        if (d2 < 0.0001) {
          // Point at exact center: push out radially in arbitrary direction
          const a = (i / pts.length) * Math.PI * 2
          pts[i].x = cx + Math.cos(a) * r
          pts[i].y = cy + Math.sin(a) * r
          continue
        }
        const f = Math.sqrt(1 + r2 / d2)
        pts[i].x = cx + dx * f
        pts[i].y = cy + dy * f
      }
    }
  }

  // Aubrey Jaffer's classic tine: every point gets pushed in motion direction
  // with magnitude falling off perpendicular to the line of motion. The wake
  // appears as a visible line because the strongest displacement is on the
  // axis through the cursor — points way off-axis barely move.
  function applyTine(x1, y1, x2, y2, tineOffsets, sharpness, intensity) {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 0.5) return
    const ux = dx / len
    const uy = dy / len
    const nx = -uy
    const ny = ux
    const z = sharpness
    const c = intensity * len

    for (let p = 0; p < dropPolys.length; p++) {
      const pts = dropPolys[p].pts
      for (let i = 0; i < pts.length; i++) {
        const px = pts[i].x
        const py = pts[i].y
        let totalU = 0
        for (let t = 0; t < tineOffsets.length; t++) {
          const off = tineOffsets[t]
          const perp = (px - x1) * nx + (py - y1) * ny - off
          totalU += (z * c) / (Math.abs(perp) + z)
        }
        pts[i].x += ux * totalU
        pts[i].y += uy * totalU
      }
    }
  }

  function resamplePoly(pts) {
    if (pts.length < 3) return pts
    // Pass 1: subdivide long edges so the curve stays smooth as it stretches.
    const expanded = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      expanded.push(a)
      const b = pts[(i + 1) % pts.length]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d2 = dx * dx + dy * dy
      if (d2 > MAX_EDGE * MAX_EDGE) {
        const d = Math.sqrt(d2)
        const n = Math.min(8, Math.ceil(d / MAX_EDGE))
        for (let k = 1; k < n; k++) {
          const t = k / n
          expanded.push({ x: a.x + dx * t, y: a.y + dy * t })
        }
      }
    }
    // Pass 2: if we blew the per-poly budget (e.g. user circling a tight comb),
    // uniformly decimate so the shape stays continuous instead of truncating
    // and leaving a straight wedge edge across the polygon.
    if (expanded.length <= MAX_POINTS_PER_POLY) return expanded
    const out = new Array(MAX_POINTS_PER_POLY)
    const stride = expanded.length / MAX_POINTS_PER_POLY
    for (let k = 0; k < MAX_POINTS_PER_POLY; k++) {
      out[k] = expanded[Math.floor(k * stride)]
    }
    return out
  }

  function resampleAll() {
    for (let i = 0; i < dropPolys.length; i++) {
      dropPolys[i].pts = resamplePoly(dropPolys[i].pts)
    }
  }

  function isOffCanvas(pts) {
    // True if EVERY point is way outside the visible area.
    const margin = 200
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      if (p.x > -margin && p.x < W + margin && p.y > -margin && p.y < H + margin) {
        return false
      }
    }
    return true
  }

  function pruneOffscreen() {
    dropPolys = dropPolys.filter(d => !isOffCanvas(d.pts))
  }

  // ---------- rendering ----------

  function render() {
    context.fillStyle = WATER
    context.fillRect(0, 0, W, H)
    for (let i = 0; i < dropPolys.length; i++) {
      const drop = dropPolys[i]
      const pts = drop.pts
      if (pts.length < 3) continue
      context.beginPath()
      context.moveTo(pts[0].x, pts[0].y)
      for (let j = 1; j < pts.length; j++) {
        context.lineTo(pts[j].x, pts[j].y)
      }
      context.closePath()
      context.fillStyle = drop.color
      context.fill()
    }
    needsRedraw = false
  }

  function loop() {
    // Ease the comb: lerp smooth toward target, comb between old & new smooth
    if (isDragging && tool === 'comb' && combTarget && combSmooth) {
      const prev = { x: combSmooth.x, y: combSmooth.y }
      combSmooth.x += (combTarget.x - combSmooth.x) * COMB_EASE
      combSmooth.y += (combTarget.y - combSmooth.y) * COMB_EASE
      const dx = combSmooth.x - prev.x
      const dy = combSmooth.y - prev.y
      if (dx * dx + dy * dy > 0.25) {
        combStep(prev.x, prev.y, combSmooth.x, combSmooth.y)
      }
    }
    if (needsRedraw) render()
    requestAnimationFrame(loop)
  }

  // ---------- actions ----------

  function dropAt(x, y, r, color) {
    applyDrop(x, y, r)
    const pts = makeCircle(x, y, r)
    dropPolys.push({ color, pts })
    resampleAll()
    pruneOffscreen()
    needsRedraw = true
  }

  // Maximum per-call segment length; longer segments are split.
  // Keeps displacement well-behaved for callers passing big jumps.
  const COMB_SUBSTEP = 6

  function combStep(x1, y1, x2, y2) {
    // Build tine offsets centered around 0
    const offsets = []
    if (combTines === 1) {
      offsets.push(0)
    } else {
      const total = (combTines - 1) * combSpacing
      for (let i = 0; i < combTines; i++) {
        offsets.push(-total / 2 + i * combSpacing)
      }
    }
    const dx = x2 - x1
    const dy = y2 - y1
    const L = Math.sqrt(dx * dx + dy * dy)
    const n = Math.max(1, Math.ceil(L / COMB_SUBSTEP))
    for (let i = 0; i < n; i++) {
      const t1 = i / n
      const t2 = (i + 1) / n
      // Smaller sharpness = sharper wake. Intensity is fraction of stroke pulled forward.
      applyTine(
        x1 + dx * t1, y1 + dy * t1,
        x1 + dx * t2, y1 + dy * t2,
        offsets, 8, 0.45,
      )
    }
    resampleAll()
    pruneOffscreen()
    needsRedraw = true
  }

  // ---------- input ----------

  function getPos(event) {
    const e = (event.touches && event.touches.item(0)) || event
    const r = wrapper.getBoundingClientRect()
    return { x: e.clientX - r.left - 20, y: e.clientY - r.top - 20 }
  }

  function onDown(event) {
    event.preventDefault()
    hideTip()
    const p = getPos(event)
    isDragging = true
    lastDragPos = p
    if (tool === 'drop') {
      dropAt(p.x, p.y, dropRadius, colors[activeColorIndex])
    } else if (tool === 'comb') {
      combTarget = { x: p.x, y: p.y }
      combSmooth = { x: p.x, y: p.y }
    }
  }

  function onMove(event) {
    if (!isDragging) return
    event.preventDefault()
    const p = getPos(event)
    if (tool === 'drop') {
      // Drop continuous drips while dragging — but only every few pixels
      const dx = p.x - lastDragPos.x
      const dy = p.y - lastDragPos.y
      if (dx * dx + dy * dy > dropRadius * dropRadius * 0.5) {
        dropAt(p.x, p.y, dropRadius * 0.6, colors[activeColorIndex])
        lastDragPos = p
      }
    } else if (tool === 'comb') {
      combTarget = { x: p.x, y: p.y }
    }
  }

  function onUp() {
    isDragging = false
    lastDragPos = null
    combTarget = null
    combSmooth = null
  }

  wrapper.addEventListener('mousedown', onDown)
  wrapper.addEventListener('mousemove', onMove)
  wrapper.addEventListener('mouseup', onUp)
  wrapper.addEventListener('mouseleave', onUp)
  wrapper.addEventListener('touchstart', onDown, { passive: false })
  wrapper.addEventListener('touchmove', onMove, { passive: false })
  wrapper.addEventListener('touchend', onUp)

  function hideTip() {
    const tip = document.querySelector('.tip')
    if (tip) tip.style.display = 'none'
  }

  // ---------- public API ----------

  window.marbling = {
    setTool: function (t) { tool = t },
    setActiveColor: function (i) { activeColorIndex = i },
    setColorAt: function (i, hex) { colors[i] = hex },
    getColors: function () { return colors.slice() },
    setCombTines: function (n) { combTines = n },
    setDropRadius: function (r) { dropRadius = r },
    clear: function () {
      dropPolys = []
      needsRedraw = true
    },
  }

  // Initial render + loop
  render()
  loop()
})()
