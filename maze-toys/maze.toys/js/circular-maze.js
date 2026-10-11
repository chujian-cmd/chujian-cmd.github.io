const numRings = parseInt(document.querySelector('.maze-page').getAttribute('data-size'))
const mazeName = document.querySelector('.maze-page').getAttribute('data-name')

const victoryModal = document.querySelector('.victory')
const victoryTimeEl = document.querySelector('#victory-time-span')
const victoryMovesEl = document.querySelector('#victory-moves-span')
const movesEl = document.querySelector('#moves-span')
const timeElement = document.querySelector('#time-span')

const mazeType = 'circular-maze'

let finished = false
let moves = 0
let path = []
let startTime, animationFrame, time

let tomImg = new Image()
tomImg.onload = drawAll
tomImg.src = '/pixel-tomato.png'

// ── Seeding ──────────────────────────────────

function dec2hex(dec) { return dec.toString(16).padStart(2, '0') }
function generateId(len) {
  var arr = new Uint8Array((len || 40) / 2)
  window.crypto.getRandomValues(arr)
  return Array.from(arr, dec2hex).join('')
}

const urlSegments = new URL(window.location.href).pathname.split('/')
const nameId = urlSegments.indexOf(mazeName)
let id = urlSegments[nameId + 1] || generateId(6)
Math.seedrandom(id)

// ── Grid: graph-based polar grid ─────────────
// Each cell is a node with neighbor references.
// Outward neighbors are an array (1 or more cells).

let grid = []    // grid[ring][seg] = cell object
let segCounts    // segments per ring
let exitCell, startCell

function buildGrid() {
  segCounts = [8]
  for (let r = 1; r < numRings; r++) {
    const prev = segCounts[r - 1]
    const outerCirc = 2 * Math.PI * (r + 2)
    const cellArc = outerCirc / prev
    // Split when cell arc > 1.5x the target width
    segCounts[r] = cellArc > 3.0 ? prev * 2 : prev
  }

  grid = []
  for (let r = 0; r < numRings; r++) {
    grid[r] = []
    for (let s = 0; s < segCounts[r]; s++) {
      grid[r][s] = {
        r, s,
        // Walls: true = wall present, false = passage open
        wallCW: true,       // wall between this cell and CW neighbor
        wallInward: true,   // wall between this cell and inward neighbor
        wallOutward: [],    // one bool per outward neighbor
        // Neighbor refs (set below)
        cw: null,
        ccw: null,
        inward: null,
        outward: [],
        visited: false
      }
    }
  }

  // Wire up neighbors
  for (let r = 0; r < numRings; r++) {
    const count = segCounts[r]
    for (let s = 0; s < count; s++) {
      const cell = grid[r][s]

      // CW / CCW
      cell.cw = grid[r][(s + 1) % count]
      cell.ccw = grid[r][(s - 1 + count) % count]

      // Inward
      if (r > 0) {
        const innerCount = segCounts[r - 1]
        if (count === innerCount) {
          cell.inward = grid[r - 1][s]
        } else {
          cell.inward = grid[r - 1][Math.floor(s / 2)]
        }
      }

      // Outward
      if (r < numRings - 1) {
        const outerCount = segCounts[r + 1]
        if (outerCount === count) {
          cell.outward = [grid[r + 1][s]]
        } else {
          cell.outward = [grid[r + 1][s * 2], grid[r + 1][s * 2 + 1]]
        }
        cell.wallOutward = cell.outward.map(() => true)
      }
    }
  }
}

// ── Maze generation (DFS backtracker) ────────

function generateMaze() {
  buildGrid()

  const totalCells = segCounts.reduce((a, b) => a + b, 0)
  const startR = Math.floor(Math.random() * numRings)
  const startS = Math.floor(Math.random() * segCounts[startR])
  let cur = grid[startR][startS]
  cur.visited = true
  let visitedCount = 1
  const stack = [cur]

  while (visitedCount < totalCells) {
    // Gather unvisited neighbors with direction info
    const unvis = []

    if (cur.cw && !cur.cw.visited) unvis.push({ cell: cur.cw, type: 'cw' })
    if (cur.ccw && !cur.ccw.visited) unvis.push({ cell: cur.ccw, type: 'ccw' })
    if (cur.inward && !cur.inward.visited) unvis.push({ cell: cur.inward, type: 'inward' })
    for (let i = 0; i < cur.outward.length; i++) {
      if (!cur.outward[i].visited) unvis.push({ cell: cur.outward[i], type: 'outward', idx: i })
    }

    if (unvis.length > 0) {
      // Bias toward inward/outward so paths cut through the center
      const weighted = []
      for (const n of unvis) {
        const w = (n.type === 'inward' || n.type === 'outward') ? 3 : 1
        for (let i = 0; i < w; i++) weighted.push(n)
      }
      const next = weighted[Math.floor(Math.random() * weighted.length)]

      // Carve passage — open BOTH sides
      if (next.type === 'cw') {
        cur.wallCW = false
      } else if (next.type === 'ccw') {
        cur.ccw.wallCW = false
      } else if (next.type === 'inward') {
        cur.wallInward = false
        const inCell = cur.inward
        const idx = inCell.outward.indexOf(cur)
        if (idx !== -1) inCell.wallOutward[idx] = false
      } else if (next.type === 'outward') {
        cur.wallOutward[next.idx] = false
        next.cell.wallInward = false
      }

      next.cell.visited = true
      visitedCount++
      cur = next.cell
      stack.push(cur)
    } else {
      stack.pop()
      cur = stack[stack.length - 1]
    }
  }

  // Start on outer ring, exit on opposite side
  const outerCount = segCounts[numRings - 1]
  const startSeg = Math.floor(Math.random() * outerCount)
  const exitSeg = (startSeg + Math.floor(outerCount / 2)) % outerCount
  startCell = grid[numRings - 1][startSeg]
  exitCell = grid[numRings - 1][exitSeg]
}

// ── Canvas ───────────────────────────────────

let canvas, ctx
const ringWidth = numRings <= 10 ? 20 : numRings <= 16 ? 14 : 10
const canvasSize = 2 * (numRings + 2) * ringWidth

function preDraw() {
  canvas = document.querySelector('#canvas')
  ctx = canvas.getContext('2d')
  canvas.width = canvasSize
  canvas.height = canvasSize
}

function cellCenter(cell) {
  const cx = canvasSize / 2
  const cy = canvasSize / 2
  const count = segCounts[cell.r]
  const angleStep = (2 * Math.PI) / count
  const midAngle = (cell.s + 0.5) * angleStep
  const innerR = (cell.r + 1) * ringWidth
  const outerR = (cell.r + 2) * ringWidth
  const midR = (innerR + outerR) / 2
  return { x: cx + midR * Math.cos(midAngle), y: cy + midR * Math.sin(midAngle) }
}

// ── Drawing ──────────────────────────────────

function drawPath() {
  const cx = canvasSize / 2
  const cy = canvasSize / 2

  path.forEach(cell => {
    const count = segCounts[cell.r]
    const angleStep = (2 * Math.PI) / count
    const startAngle = cell.s * angleStep
    const endAngle = (cell.s + 1) * angleStep
    const innerR = (cell.r + 1) * ringWidth
    const outerR = (cell.r + 2) * ringWidth

    ctx.fillStyle = '#ff0000'
    ctx.beginPath()
    ctx.arc(cx, cy, outerR, startAngle, endAngle)
    ctx.arc(cx, cy, innerR, endAngle, startAngle, true)
    ctx.closePath()
    ctx.fill()
  })

  // Start marker (green dot)
  const sc = cellCenter(startCell)
  const dotR = ringWidth * 0.25
  ctx.fillStyle = '#4CAF50'
  ctx.beginPath()
  ctx.arc(sc.x, sc.y, dotR, 0, 2 * Math.PI)
  ctx.fill()

  // Exit marker (tomato)
  const ec = cellCenter(exitCell)
  const size = ringWidth * 0.7
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tomImg, ec.x - size / 2, ec.y - size / 2, size, size)
}

function draw() {
  const cx = canvasSize / 2
  const cy = canvasSize / 2

  ctx.strokeStyle = '#000'
  ctx.lineWidth = 2

  for (let r = 0; r < numRings; r++) {
    const innerR = (r + 1) * ringWidth
    const outerR = (r + 2) * ringWidth
    const count = segCounts[r]
    const angleStep = (2 * Math.PI) / count

    for (let s = 0; s < count; s++) {
      const cell = grid[r][s]
      const startAngle = s * angleStep
      const endAngle = (s + 1) * angleStep

      // CW radial wall (shared with next cell's CCW side)
      if (cell.wallCW) {
        ctx.beginPath()
        ctx.moveTo(cx + innerR * Math.cos(endAngle), cy + innerR * Math.sin(endAngle))
        ctx.lineTo(cx + outerR * Math.cos(endAngle), cy + outerR * Math.sin(endAngle))
        ctx.stroke()
      }

      // Outward arc walls — one segment per outward neighbor
      if (cell.outward.length > 0) {
        const subStep = (endAngle - startAngle) / cell.outward.length
        for (let i = 0; i < cell.outward.length; i++) {
          if (cell.wallOutward[i]) {
            const a0 = startAngle + i * subStep
            const a1 = a0 + subStep
            ctx.beginPath()
            ctx.arc(cx, cy, outerR, a0, a1)
            ctx.stroke()
          }
        }
      }
    }
  }

  // Outer boundary with gaps at start and exit
  const outerR = (numRings + 1) * ringWidth
  const outerCount = segCounts[numRings - 1]
  const outerAngleStep = (2 * Math.PI) / outerCount

  // Collect the two gap ranges
  const gaps = [
    { a: startCell.s * outerAngleStep, b: (startCell.s + 1) * outerAngleStep },
    { a: exitCell.s * outerAngleStep, b: (exitCell.s + 1) * outerAngleStep }
  ].sort((x, y) => x.a - y.a)

  // Draw arcs between the gaps
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, gaps[0].b, gaps[1].a)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, gaps[1].b, gaps[0].a + 2 * Math.PI)
  ctx.stroke()

  // Center circle
  ctx.beginPath()
  ctx.arc(cx, cy, ringWidth, 0, 2 * Math.PI)
  ctx.stroke()
}

function drawAll() {
  preDraw()
  drawPath()
  draw()
}

// ── Movement ─────────────────────────────────

function tryMove(direction) {
  if (finished) return
  const cur = path[path.length - 1]
  const prev = path.length > 1 ? path[path.length - 2] : null
  const cell = grid[cur.r][cur.s]
  let next = null

  if (direction === 'cw') {
    if (!cell.wallCW) next = cell.cw
  } else if (direction === 'ccw') {
    if (!cell.ccw.wallCW) next = cell.ccw  // CCW wall is stored on the CCW neighbor's CW
  } else if (direction === 'inward') {
    if (!cell.wallInward) next = cell.inward
  } else if (direction === 'outward') {
    const openIdx = []
    for (let i = 0; i < cell.outward.length; i++) {
      if (!cell.wallOutward[i]) openIdx.push(i)
    }
    if (openIdx.length === 1) {
      next = cell.outward[openIdx[0]]
    } else if (openIdx.length > 1) {
      // The maze is a tree, so backtracking pops `path` and prev resets
      // to this cell's tree-parent. A pure prev-based heuristic would
      // pick the same child every visit, leaving the other child (and
      // its entire subtree) permanently unreachable — measured at 50–70%
      // of mazes. Toggle: prefer the open child we did NOT take last
      // time from this cell, so repeated up-presses alternate.
      let pickIdx
      if (cell._lastUp !== undefined) {
        const other = openIdx.find(i => i !== cell._lastUp)
        pickIdx = other !== undefined ? other : cell._lastUp
      } else if (prev) {
        // First visit: bias toward the player's angular direction of travel.
        const prevCell = grid[prev.r][prev.s]
        pickIdx = (prevCell === cell.ccw) ? 1 : 0
        if (!openIdx.includes(pickIdx)) pickIdx = openIdx[0]
      } else {
        pickIdx = openIdx[0]
      }
      next = cell.outward[pickIdx]
      cell._lastUp = pickIdx
    }
  }

  if (!next) {
    // Debug: log why movement failed
    console.log(`BLOCKED ${direction} at ring=${cell.r} seg=${cell.s}`)
    console.log(`  wallCW=${cell.wallCW} wallInward=${cell.wallInward}`)
    console.log(`  ccw.wallCW=${cell.ccw?.wallCW}`)
    console.log(`  outward count=${cell.outward.length} wallOutward=[${cell.wallOutward}]`)
    for (let i = 0; i < cell.outward.length; i++) {
      const o = cell.outward[i]
      console.log(`  outward[${i}]: ring=${o.r} seg=${o.s} wallInward=${o.wallInward}`)
    }
    if (cell.inward) {
      console.log(`  inward: ring=${cell.inward.r} seg=${cell.inward.s}`)
      const parentIdx = cell.inward.outward.indexOf(cell)
      console.log(`  parent wallOutward[${parentIdx}]=${cell.inward.wallOutward[parentIdx]}`)
    }
    if (prev) console.log(`  prev: ring=${prev.r} seg=${prev.s}`)
  }

  if (next) {
    const newPos = { r: next.r, s: next.s }

    if (prev && newPos.r === prev.r && newPos.s === prev.s) {
      path.pop()
    } else {
      path.push(newPos)
    }

    if (moves === 0 && !startTime) startTimer()
    moves++
    if (movesEl) movesEl.innerHTML = moves
    drawAll()

    const last = path[path.length - 1]
    if (last.r === exitCell.r && last.s === exitCell.s) {
      win()
    }
  }
}

// ── Timer ────────────────────────────────────

function startTimer() {
  startTime = Date.now()
  animationFrame = window.requestAnimationFrame(tick)
}

function tick() {
  time = Date.now() - startTime
  if (timeElement) timeElement.innerHTML = msToTime(time)
  animationFrame = window.requestAnimationFrame(tick)
}

function msToTime(duration) {
  let seconds = Math.floor((duration / 1000) % 60)
  let minutes = Math.floor((duration / (1000 * 60)) % 60)
  let hours = Math.floor((duration / (1000 * 60 * 60)) % 24)
  if (hours) return hours + 'h ' + minutes + 'm ' + seconds + 's'
  if (minutes) return minutes + 'm ' + seconds + 's'
  return seconds + 's'
}

function resetTimer() {
  victoryModal.classList.add('hidden')
  cancelAnimationFrame(animationFrame)
  startTime = null
  if (timeElement) timeElement.innerHTML = '0s'
}

function win() {
  cancelAnimationFrame(animationFrame)
  finished = true
  if (victoryMovesEl) victoryMovesEl.innerHTML = moves
  if (victoryTimeEl) victoryTimeEl.innerHTML = msToTime(time)
  if (victoryModal) victoryModal.classList.remove('hidden')
  localStorage.setItem(`maze-completed-${mazeName}`, 'true')
}

function generateNewMaze() {
  finished = false
  solutionPath = null
  id = generateId(6)
  Math.seedrandom(id)
  generateMaze()
  moves = 0
  if (movesEl) movesEl.innerHTML = moves
  path = [{ r: startCell.r, s: startCell.s }]
  resetTimer()
  drawAll()
}

function resetMaze() {
  finished = false
  moves = 0
  if (movesEl) movesEl.innerHTML = moves
  path = [{ r: startCell.r, s: startCell.s }]
  for (const ring of grid) for (const cell of ring) cell._lastUp = undefined
  resetTimer()
  drawAll()
}

// ── Input ────────────────────────────────────

document.addEventListener('keydown', (e) => {
  const keys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'w', 'a', 's', 'd']
  if (keys.includes(e.key)) { e.preventDefault(); e.stopPropagation() }
})

document.addEventListener('keyup', (e) => {
  const key = e.key
  if (key === 'ArrowUp' || key === 'w') tryMove('outward')
  else if (key === 'ArrowDown' || key === 's') tryMove('inward')
  else if (key === 'ArrowRight' || key === 'd') tryMove('cw')
  else if (key === 'ArrowLeft' || key === 'a') tryMove('ccw')
})

document.querySelector('.left')?.addEventListener('click', () => tryMove('ccw'))
document.querySelector('.right')?.addEventListener('click', () => tryMove('cw'))
document.querySelector('.top')?.addEventListener('click', () => tryMove('outward'))
document.querySelector('.bottom')?.addEventListener('click', () => tryMove('inward'))

document.querySelector('#new-maze')?.addEventListener('click', generateNewMaze)
document.querySelector('#victory-new')?.addEventListener('click', generateNewMaze)
document.querySelector('#reset-maze')?.addEventListener('click', resetMaze)

// ── Print ────────────────────────────────────

function printMaze() {
  const pad = 30
  const sz = canvasSize + pad * 2
  const cx = sz / 2
  const cy = sz / 2

  // SVG arc path helper
  function svgArc(cx, cy, r, a0, a1) {
    const x0 = cx + r * Math.cos(a0)
    const y0 = cy + r * Math.sin(a0)
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const large = (a1 - a0) > Math.PI ? 1 : 0
    return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`
  }

  let paths = ''

  for (let r = 0; r < numRings; r++) {
    const innerR = (r + 1) * ringWidth
    const outerR = (r + 2) * ringWidth
    const count = segCounts[r]
    const angleStep = (2 * Math.PI) / count

    for (let s = 0; s < count; s++) {
      const cell = grid[r][s]
      const startAngle = s * angleStep
      const endAngle = (s + 1) * angleStep

      // CW radial wall
      if (cell.wallCW) {
        const x0 = cx + innerR * Math.cos(endAngle)
        const y0 = cy + innerR * Math.sin(endAngle)
        const x1 = cx + outerR * Math.cos(endAngle)
        const y1 = cy + outerR * Math.sin(endAngle)
        paths += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`
      }

      // Outward arc walls
      if (cell.outward.length > 0) {
        const subStep = (endAngle - startAngle) / cell.outward.length
        for (let i = 0; i < cell.outward.length; i++) {
          if (cell.wallOutward[i]) {
            const a0 = startAngle + i * subStep
            const a1 = a0 + subStep
            paths += `<path d="${svgArc(cx, cy, outerR, a0, a1)}" fill="none"/>`
          }
        }
      }
    }
  }

  // Outer boundary with start + exit gaps
  const outerR = (numRings + 1) * ringWidth
  const outerCount = segCounts[numRings - 1]
  const outerStep = (2 * Math.PI) / outerCount
  const gaps = [
    { a: startCell.s * outerStep, b: (startCell.s + 1) * outerStep },
    { a: exitCell.s * outerStep, b: (exitCell.s + 1) * outerStep }
  ].sort((x, y) => x.a - y.a)
  paths += `<path d="${svgArc(cx, cy, outerR, gaps[0].b, gaps[1].a)}" fill="none"/>`
  paths += `<path d="${svgArc(cx, cy, outerR, gaps[1].b, gaps[0].a + 2 * Math.PI)}" fill="none"/>`

  // Center circle
  paths += `<circle cx="${cx}" cy="${cy}" r="${ringWidth}" fill="none"/>`

  // A / B labels
  const sc = cellCenter(startCell)
  const ec = cellCenter(exitCell)
  const fontSize = ringWidth * 0.7
  paths += `<text x="${sc.x + pad}" y="${sc.y + pad + fontSize * 0.35}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="${fontSize}" fill="#333">A</text>`
  paths += `<text x="${ec.x + pad}" y="${ec.y + pad + fontSize * 0.35}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="${fontSize}" fill="#333">B</text>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sz} ${sz + 25}">
    <rect width="${sz}" height="${sz + 25}" fill="white"/>
    <g stroke="black" stroke-width="1.5" stroke-linecap="round" fill="none">${paths}</g>
    <text x="${sz / 2}" y="${sz + 18}" text-anchor="middle" font-family="monospace" font-size="11" fill="#aaa">maze.toys</text>
  </svg>`

  const w = window.open('', '_blank')
  w.document.write(`<!DOCTYPE html><html><head><title>Print Circular Maze - maze.toys</title>
    <style>
      html,body{margin:0;padding:0;width:100%;height:100%}
      body{display:flex;justify-content:center;align-items:center}
      svg{width:100%;height:auto;max-height:100vh;padding:10px;box-sizing:border-box}
      @media print{@page{margin:0.5in}svg{width:100%;height:auto;max-height:100%;padding:0}}
    </style>
    </head><body>${svg}</body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

document.querySelector('#print-maze')?.addEventListener('click', printMaze)

// ── SOS: solve and show path ─────────────────

let solutionPath = null

function solve() {
  // BFS from start to exit
  const key = (r, s) => r + ',' + s
  const visited = new Set()
  const prev = new Map()
  const queue = [startCell]
  visited.add(key(startCell.r, startCell.s))

  while (queue.length > 0) {
    const cur = queue.shift()
    if (cur.r === exitCell.r && cur.s === exitCell.s) break

    const neighbors = []
    // CW
    if (!cur.wallCW) neighbors.push(cur.cw)
    // CCW
    if (!cur.ccw.wallCW) neighbors.push(cur.ccw)
    // Inward
    if (!cur.wallInward && cur.inward) neighbors.push(cur.inward)
    // Outward
    for (let i = 0; i < cur.outward.length; i++) {
      if (!cur.wallOutward[i]) neighbors.push(cur.outward[i])
    }

    for (const n of neighbors) {
      const k = key(n.r, n.s)
      if (!visited.has(k)) {
        visited.add(k)
        prev.set(k, cur)
        queue.push(n)
      }
    }
  }

  // Trace back
  const path = []
  let c = exitCell
  while (c) {
    path.unshift({ r: c.r, s: c.s })
    c = prev.get(key(c.r, c.s)) || null
  }
  return path
}

function drawSolution() {
  if (!solutionPath) return
  const cx = canvasSize / 2
  const cy = canvasSize / 2

  solutionPath.forEach(pos => {
    const count = segCounts[pos.r]
    const angleStep = (2 * Math.PI) / count
    const startAngle = pos.s * angleStep
    const endAngle = (pos.s + 1) * angleStep
    const innerR = (pos.r + 1) * ringWidth
    const outerR = (pos.r + 2) * ringWidth

    ctx.fillStyle = 'rgba(0, 150, 255, 0.3)'
    ctx.beginPath()
    ctx.arc(cx, cy, outerR, startAngle, endAngle)
    ctx.arc(cx, cy, innerR, endAngle, startAngle, true)
    ctx.closePath()
    ctx.fill()
  })
}

// Intercept "sos" keystrokes
;(() => {
  let buffer = ''
  document.addEventListener('keydown', (e) => {
    if (solutionPath) return
    buffer += e.key.toLowerCase()
    if (buffer.length > 3) buffer = buffer.slice(-3)
    if (buffer === 'sos') {
      solutionPath = solve()
      drawAll()
    }
  })
})()

// Patch drawAll to include solution overlay
const _origDrawAll = drawAll
drawAll = function () {
  _origDrawAll()
  drawSolution()
}

// ── Init ─────────────────────────────────────

generateMaze()
path = [{ r: startCell.r, s: startCell.s }]
drawAll()
