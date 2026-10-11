;(() => {
  const scale = 2
  const canvas = document.querySelector("#canvas")
  const context = canvas.getContext("2d")

  const screen = document.querySelector('.screen')
  const screenRect = screen.getBoundingClientRect()

  canvas.width = screenRect.width * scale
  canvas.height = screenRect.height * scale

  context.scale(scale, scale)

  const canvasWidth = canvas.width / scale
  const canvasHeight = canvas.height / scale

  // Drawing state
  let position = {
    x: canvasWidth / 2,
    y: canvasHeight / 2
  }

  // Knob elements
  const leftKnob = document.querySelector('.knob-left')
  const rightKnob = document.querySelector('.knob-right')

  // Knob state
  let leftKnobAngle = 0
  let rightKnobAngle = 0
  let activeKnob = null
  let lastAngle = 0
  let knobCenter = { x: 0, y: 0 }

  // Line style
  context.strokeStyle = '#2a2a2a'
  context.lineWidth = 2
  context.lineCap = 'round'
  context.lineJoin = 'round'

  // Fill background (grey like real etch-a-sketch)
  function fillBackground() {
    context.fillStyle = '#bec4b4'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  fillBackground()

  // Draw line segment
  function drawLine(fromX, fromY, toX, toY) {
    context.beginPath()
    context.moveTo(fromX, fromY)
    context.lineTo(toX, toY)
    context.strokeStyle = '#2a2a2a'
    context.stroke()
  }

  // Movement functions (shared by knobs and keyboard)
  function moveHorizontal(delta) {
    const oldPos = { x: position.x, y: position.y }
    position.x += delta
    position.x = Math.max(0, Math.min(canvasWidth, position.x))
    leftKnobAngle += delta * 3
    leftKnob.style.transform = `rotate(${leftKnobAngle}deg)`
    drawLine(oldPos.x, oldPos.y, position.x, position.y)
  }

  function moveVertical(delta) {
    const oldPos = { x: position.x, y: position.y }
    position.y += delta
    position.y = Math.max(0, Math.min(canvasHeight, position.y))
    rightKnobAngle += delta * 3
    rightKnob.style.transform = `rotate(${rightKnobAngle}deg)`
    drawLine(oldPos.x, oldPos.y, position.x, position.y)
  }

  // Normalize angle delta to handle wrap-around at +/- PI
  function normalizeAngleDelta(delta) {
    while (delta > Math.PI) delta -= 2 * Math.PI
    while (delta < -Math.PI) delta += 2 * Math.PI
    return delta
  }

  // Knob event handlers - circular dragging
  function onKnobDown(e, knob, isLeft) {
    e.preventDefault()
    const touch = e.touches ? e.touches[0] : e

    // Calculate knob center
    const knobRect = knob.getBoundingClientRect()
    knobCenter = {
      x: knobRect.left + knobRect.width / 2,
      y: knobRect.top + knobRect.height / 2
    }

    // Calculate initial angle from cursor to knob center
    lastAngle = Math.atan2(touch.clientY - knobCenter.y, touch.clientX - knobCenter.x)

    activeKnob = { element: knob, isLeft }
    document.querySelector('.tip').style.display = 'none'
  }

  function onKnobMove(e) {
    if (!activeKnob) return
    e.preventDefault()

    const touch = e.touches ? e.touches[0] : e

    // Calculate new angle
    const newAngle = Math.atan2(touch.clientY - knobCenter.y, touch.clientX - knobCenter.x)
    let angleDelta = normalizeAngleDelta(newAngle - lastAngle)

    // Convert angle to movement (radians to pixels)
    const movement = angleDelta * 20

    if (activeKnob.isLeft) {
      moveHorizontal(movement)
    } else {
      moveVertical(movement)
    }

    lastAngle = newAngle
  }

  function onKnobUp() {
    activeKnob = null
  }

  // Attach knob events
  leftKnob.addEventListener('mousedown', (e) => onKnobDown(e, leftKnob, true))
  leftKnob.addEventListener('touchstart', (e) => onKnobDown(e, leftKnob, true))

  rightKnob.addEventListener('mousedown', (e) => onKnobDown(e, rightKnob, false))
  rightKnob.addEventListener('touchstart', (e) => onKnobDown(e, rightKnob, false))

  document.addEventListener('mousemove', onKnobMove)
  document.addEventListener('touchmove', onKnobMove, { passive: false })

  document.addEventListener('mouseup', onKnobUp)
  document.addEventListener('touchend', onKnobUp)

  // Keyboard controls
  const keyStep = 5
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      moveHorizontal(-keyStep)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      moveHorizontal(keyStep)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveVertical(-keyStep)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveVertical(keyStep)
    }
    document.querySelector('.tip').style.display = 'none'
  })

  // Reset function - keeps position, just clears the screen
  window.resetEtchASketch = () => {
    fillBackground()
  }
})()
