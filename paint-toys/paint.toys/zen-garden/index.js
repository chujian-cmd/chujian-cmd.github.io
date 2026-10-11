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

  // Colors
  const sandColor = '#e5d5c0'
  const rakeColor = '#c4b49a'

  // Rake settings
  const widths = [
    { name: 'narrow', width: 25, lineWidth: 1.5 },
    { name: 'medium', width: 40, lineWidth: 2 },
    { name: 'wide', width: 60, lineWidth: 2.5 }
  ]
  const prongs = [1, 2, 3, 5, 7]
  let currentWidth = 1 // Medium default
  let currentProngs = 3 // 5 prongs default (index 3)

  let isDrawing = false
  let lastPos = null
  let lastTinePositions = null // Track each tine's last position for smooth lines

  // Smoothing
  let targetPos = null
  let smoothPos = null
  let animationFrame = null
  const smoothing = 0.08 // Lower = more lag, higher = more responsive

  // Store rocks for redrawing
  let rocks = []

  // Generate random rocks
  function generateRocks() {
    rocks = []
    const numRocks = 5 + Math.floor(Math.random() * 4) // 5-8 rocks
    for (let i = 0; i < numRocks; i++) {
      const margin = 60
      const size = 20 + Math.random() * 30
      rocks.push({
        x: margin + Math.random() * (canvasWidth - margin * 2),
        y: margin + Math.random() * (canvasHeight - margin * 2),
        size: size,
        width: size * (0.9 + Math.random() * 0.2),
        height: size * (0.6 + Math.random() * 0.15),
        seed: Math.floor(Math.random() * 100000)
      })
    }
  }

  // Check if a point is inside any rock
  function isInsideRock(x, y, padding = 5) {
    for (const rock of rocks) {
      const dx = x - rock.x
      const dy = y - rock.y
      // Ellipse equation: (dx/a)^2 + (dy/b)^2 <= 1
      const a = rock.width + padding
      const b = rock.height + padding
      if ((dx * dx) / (a * a) + (dy * dy) / (b * b) <= 1) {
        return true
      }
    }
    return false
  }

  // Create sand texture
  function createSandTexture() {
    context.fillStyle = sandColor
    context.fillRect(0, 0, canvasWidth, canvasHeight)

    // Add grain texture
    for (let i = 0; i < canvasWidth * canvasHeight * 0.03; i++) {
      const x = Math.random() * canvasWidth
      const y = Math.random() * canvasHeight
      const shade = Math.random() * 30 - 15
      const r = 229 + shade
      const g = 213 + shade
      const b = 192 + shade
      context.fillStyle = `rgb(${r}, ${g}, ${b})`
      context.fillRect(x, y, 1, 1)
    }

    // Add subtle wavy texture lines (very light)
    context.strokeStyle = 'rgba(180, 165, 145, 0.08)'
    context.lineWidth = 1
    for (let y = 20; y < canvasHeight; y += 30 + Math.random() * 20) {
      context.beginPath()
      context.moveTo(0, y)
      for (let x = 0; x < canvasWidth; x += 20) {
        const wave = Math.sin(x * 0.02) * 3 + Math.sin(x * 0.05) * 2
        context.lineTo(x, y + wave)
      }
      context.stroke()
    }
  }

  function fillBackground() {
    createSandTexture()
    rocks.forEach(rock => drawRock(rock))
  }

  generateRocks()
  fillBackground()

  // Draw a natural-looking rock - smooth ellipse
  function drawRock(rock) {
    const { x, y, size, width, height, seed } = rock
    const random = seededRandom(seed)

    // Shadow underneath first
    context.fillStyle = 'rgba(0, 0, 0, 0.15)'
    context.beginPath()
    context.ellipse(x + size * 0.06, y + height * 0.7, width * 0.95, height * 0.3, 0, 0, Math.PI * 2)
    context.fill()

    // Main rock body with gradient - simple ellipse
    const gradient = context.createRadialGradient(
      x - width * 0.3, y - height * 0.3, 0,
      x, y, Math.max(width, height) * 1.1
    )
    gradient.addColorStop(0, '#9a9a8a')
    gradient.addColorStop(0.4, '#7a7a6a')
    gradient.addColorStop(0.8, '#5a5a4a')
    gradient.addColorStop(1, '#4a4a3a')

    context.fillStyle = gradient
    context.beginPath()
    context.ellipse(x, y, width, height, 0, 0, Math.PI * 2)
    context.fill()

    // Subtle inner texture - a few spots
    for (let i = 0; i < 3; i++) {
      const spotX = x + (random() - 0.5) * width * 1.4
      const spotY = y + (random() - 0.5) * height * 1.4
      const spotSize = random() * size * 0.1 + 1
      const darkness = random() * 30

      context.fillStyle = `rgba(${60 - darkness}, ${60 - darkness}, ${50 - darkness}, 0.15)`
      context.beginPath()
      context.arc(spotX, spotY, spotSize, 0, Math.PI * 2)
      context.fill()
    }

    // Soft highlight on top
    const highlightGradient = context.createRadialGradient(
      x - width * 0.35, y - height * 0.35, 0,
      x - width * 0.35, y - height * 0.35, size * 0.5
    )
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)')
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = highlightGradient
    context.beginPath()
    context.ellipse(x - width * 0.3, y - height * 0.3, width * 0.4, height * 0.35, 0, 0, Math.PI * 2)
    context.fill()
  }

  function seededRandom(seed) {
    return function() {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
  }

  // Draw rake lines as continuous strokes
  function drawRake(from, to) {
    const widthSetting = widths[currentWidth]
    const numProngs = prongs[currentProngs]
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    const perpAngle = angle + Math.PI / 2
    const lineSpacing = widthSetting.width / numProngs

    context.strokeStyle = rakeColor
    context.lineWidth = widthSetting.lineWidth
    context.lineCap = 'round'
    context.lineJoin = 'round'

    // Calculate current tine positions
    const currentTinePositions = []
    for (let i = 0; i < numProngs; i++) {
      const offset = (i - (numProngs - 1) / 2) * lineSpacing
      currentTinePositions.push({
        x: to.x + Math.cos(perpAngle) * offset,
        y: to.y + Math.sin(perpAngle) * offset
      })
    }

    // Draw lines from last positions to current positions
    if (lastTinePositions && lastTinePositions.length === numProngs) {
      for (let i = 0; i < numProngs; i++) {
        const fromPos = lastTinePositions[i]
        const toPos = currentTinePositions[i]

        // Check if line crosses any rock
        if (isInsideRock(fromPos.x, fromPos.y) || isInsideRock(toPos.x, toPos.y)) {
          continue
        }

        context.beginPath()
        context.moveTo(fromPos.x, fromPos.y)
        context.lineTo(toPos.x, toPos.y)
        context.stroke()
      }
    }

    lastTinePositions = currentTinePositions
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches ? e.touches[0] : e
    return {
      x: (touch.clientX - rect.left) * (canvasWidth / rect.width),
      y: (touch.clientY - rect.top) * (canvasHeight / rect.height)
    }
  }

  function animateRake() {
    if (!isDrawing || !targetPos || !smoothPos) return

    // Lerp toward target
    smoothPos.x += (targetPos.x - smoothPos.x) * smoothing
    smoothPos.y += (targetPos.y - smoothPos.y) * smoothing

    const dist = Math.hypot(smoothPos.x - lastPos.x, smoothPos.y - lastPos.y)

    if (dist > 2) {
      drawRake(lastPos, smoothPos)
      lastPos = { x: smoothPos.x, y: smoothPos.y }
    }

    animationFrame = requestAnimationFrame(animateRake)
  }

  function onDown(e) {
    e.preventDefault()
    isDrawing = true
    const pos = getPos(e)
    lastPos = pos
    targetPos = { x: pos.x, y: pos.y }
    smoothPos = { x: pos.x, y: pos.y }
    lastTinePositions = null // Reset tine tracking
    document.querySelector('.tip').style.display = 'none'
    animationFrame = requestAnimationFrame(animateRake)
  }

  function onMove(e) {
    if (!isDrawing) return
    e.preventDefault()
    targetPos = getPos(e)
  }

  function onUp() {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
    }
    isDrawing = false
    lastPos = null
    lastTinePositions = null
    targetPos = null
    smoothPos = null
  }

  canvas.addEventListener('mousedown', onDown)
  canvas.addEventListener('mousemove', onMove)
  canvas.addEventListener('mouseup', onUp)
  canvas.addEventListener('mouseleave', onUp)

  canvas.addEventListener('touchstart', onDown)
  canvas.addEventListener('touchmove', onMove)
  canvas.addEventListener('touchend', onUp)
  canvas.addEventListener('touchcancel', onUp)

  // Public functions
  window.setRakeWidth = (index) => {
    currentWidth = index
    lastTinePositions = null // Reset when changing rake
    document.querySelectorAll('.width-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === index)
    })
  }

  window.setRakeProngs = (index) => {
    currentProngs = index
    lastTinePositions = null // Reset when changing rake
    document.querySelectorAll('.prong-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === index)
    })
  }

  window.resetZenGarden = () => {
    generateRocks()
    fillBackground()
  }
})()
