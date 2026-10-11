;(() => {
  const scale = 2
  const canvas = document.querySelector("#canvas")
  const context = canvas.getContext("2d")

  const canvasWrapper = document.querySelector('.canvas-wrapper')
  const canvasRect = canvasWrapper.getBoundingClientRect()

  canvas.width = (canvasRect.width - 40) * scale
  canvas.height = (canvasRect.height - 40) * scale

  context.scale(scale, scale)

  const canvasWidth = canvas.width / scale
  const canvasHeight = canvas.height / scale

  // Color palette - impressionist inspired
  let colors = ['#1a5fb4', '#e07a5f', '#81b29a']
  let currentColorIndex = 0
  let isDrawing = false

  // Store all placed dots for collision detection
  let dots = []

  // Size presets - 5 sizes with brush radius
  const sizes = [
    { name: 'xs', radius: 2, spacing: 1, brush: 12 },
    { name: 'small', radius: 3, spacing: 1, brush: 18 },
    { name: 'medium', radius: 5, spacing: 1, brush: 25 },
    { name: 'large', radius: 8, spacing: 2, brush: 35 },
    { name: 'xl', radius: 12, spacing: 2, brush: 45 }
  ]
  let currentSize = 2 // Medium default

  // Fill with cream background and subtle canvas texture
  function fillBackground() {
    context.fillStyle = '#faf8f5'
    context.fillRect(0, 0, canvasWidth, canvasHeight)

    // Add subtle canvas/paper texture
    for (let i = 0; i < canvasWidth * canvasHeight * 0.015; i++) {
      const x = Math.random() * canvasWidth
      const y = Math.random() * canvasHeight
      const shade = Math.random() * 12 - 6
      context.fillStyle = `rgba(${240 + shade}, ${235 + shade}, ${230 + shade}, 0.5)`
      context.fillRect(x, y, 1, 1)
    }
  }

  fillBackground()

  function getPos(e) {
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches ? e.touches[0] : e
    return {
      x: (touch.clientX - rect.left) * (canvasWidth / rect.width),
      y: (touch.clientY - rect.top) * (canvasHeight / rect.height)
    }
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 }
  }

  // Check if a new dot would overlap any existing dot
  function wouldOverlap(x, y, radius) {
    const size = sizes[currentSize]
    const minDistance = radius + size.spacing

    for (const dot of dots) {
      const dx = x - dot.x
      const dy = y - dot.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const requiredDistance = minDistance + dot.radius

      if (distance < requiredDistance) {
        return true
      }
    }
    return false
  }

  function drawDot(pos, radius) {
    const rgb = hexToRgb(colors[currentColorIndex])

    // Slight color variation for natural look
    const variation = 15
    const r = Math.max(0, Math.min(255, rgb.r + (Math.random() - 0.5) * variation))
    const g = Math.max(0, Math.min(255, rgb.g + (Math.random() - 0.5) * variation))
    const b = Math.max(0, Math.min(255, rgb.b + (Math.random() - 0.5) * variation))

    // Use radial gradient for soft painterly edges
    const gradient = context.createRadialGradient(
      pos.x, pos.y, 0,
      pos.x, pos.y, radius
    )
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`)
    gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.85)`)
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.5)`)

    context.fillStyle = gradient
    context.beginPath()
    context.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
    context.fill()
  }

  function tryPlaceSingleDot(x, y, radius) {
    // Check bounds
    if (x < radius || x > canvasWidth - radius ||
        y < radius || y > canvasHeight - radius) {
      return false
    }

    // Check for overlap
    if (wouldOverlap(x, y, radius)) {
      return false
    }

    // Place the dot
    drawDot({ x, y }, radius)
    dots.push({ x, y, radius })
    return true
  }

  function paintInBrushArea(pos) {
    const size = sizes[currentSize]
    const radius = size.radius
    const brushRadius = size.brush

    // Try to place multiple dots within the brush area
    const attempts = 8 // Number of random attempts per frame

    for (let i = 0; i < attempts; i++) {
      // Random position within circular brush area
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * brushRadius
      const x = pos.x + Math.cos(angle) * dist
      const y = pos.y + Math.sin(angle) * dist

      tryPlaceSingleDot(x, y, radius)
    }
  }

  function onDown(e) {
    e.preventDefault()
    isDrawing = true
    document.querySelector('.tip').style.display = 'none'

    const pos = getPos(e)
    paintInBrushArea(pos)
  }

  function onMove(e) {
    if (!isDrawing) return
    e.preventDefault()

    const pos = getPos(e.touches ? e.touches[0] : e)
    paintInBrushArea(pos)
  }

  function onUp(e) {
    if (!isDrawing) return
    e.preventDefault()
    isDrawing = false
  }

  function onLeave() {
    isDrawing = false
  }

  canvas.addEventListener('mousedown', onDown)
  canvas.addEventListener('mousemove', onMove)
  canvas.addEventListener('mouseup', onUp)
  canvas.addEventListener('mouseleave', onLeave)

  canvas.addEventListener('touchstart', onDown)
  canvas.addEventListener('touchmove', onMove)
  canvas.addEventListener('touchend', onUp)
  canvas.addEventListener('touchcancel', onLeave)

  // Color setter - select color by index
  window.setPointillismColor = (index) => {
    currentColorIndex = index
  }

  // Update color at index
  window.updatePointillismColor = (index, color) => {
    colors[index] = color
  }

  // Size setter
  window.setPointillismSize = (index) => {
    currentSize = index
    document.querySelectorAll('.size-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === index)
    })
  }

  window.resetPointillism = () => {
    dots = []
    fillBackground()
  }
})()
