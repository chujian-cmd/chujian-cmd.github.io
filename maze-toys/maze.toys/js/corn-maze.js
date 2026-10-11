// ── Config ──────────────────────────────────────────────────
const mazeName = document.querySelector('.maze-page').getAttribute('data-name')
const size = document.querySelector('.maze-page').getAttribute('data-size')
const width = parseInt(size)
const height = parseInt(size)

const CELL_SIZE = 4
const WALL_HEIGHT = 3
const WALL_THICKNESS = 0.15
const EYE_HEIGHT = WALL_HEIGHT * 0.45
const ANIM_DURATION = 180

const [N, S, E, W] = [1, 2, 4, 8]

// Direction: 0=N, 1=E, 2=S, 3=W
const DIR_VECTORS = [
  { dc: 0, dr: -1 },  // N
  { dc: 1, dr: 0 },   // E
  { dc: 0, dr: 1 },   // S
  { dc: -1, dr: 0 }   // W
]

// Camera Y-rotation for each facing direction
const FACING_ANGLES = [
  0,             // N: look toward -Z
  -Math.PI / 2,  // E: look toward +X
  Math.PI,       // S: look toward +Z
  Math.PI / 2    // W: look toward -X
]

// Wall index mapping: cells[row][col][i] where i: 0=N, 1=E, 2=S, 3=W

// ── ID / Seed ──────────────────────────────────────────────
function generateId(len) {
  const dec2hex = (dec) => dec.toString(16).padStart(2, '0')
  const arr = new Uint8Array((len || 40) / 2)
  window.crypto.getRandomValues(arr)
  return Array.from(arr, dec2hex).join('')
}

const segments = new URL(window.location.href).pathname.split('/')
const nameId = segments.indexOf(mazeName)
let id = segments[nameId + 1] || generateId(6)
Math.seedrandom(id)

// ── Maze Generation ────────────────────────────────────────
function newMaze(x, y) {
  var totalCells = x * y
  var cells = new Array()
  var unvis = new Array()
  for (var i = 0; i < y; i++) {
    cells[i] = new Array()
    unvis[i] = new Array()
    for (var j = 0; j < x; j++) {
      cells[i][j] = [0, 0, 0, 0]
      unvis[i][j] = true
    }
  }

  var currentCell = [
    Math.floor(Math.random() * y),
    Math.floor(Math.random() * x),
  ]
  var path = [currentCell]
  unvis[currentCell[0]][currentCell[1]] = false
  var visited = 1

  while (visited < totalCells) {
    var pot = [
      [currentCell[0] - 1, currentCell[1], 0, 2],
      [currentCell[0], currentCell[1] + 1, 1, 3],
      [currentCell[0] + 1, currentCell[1], 2, 0],
      [currentCell[0], currentCell[1] - 1, 3, 1],
    ]
    var neighbors = new Array()

    for (var l = 0; l < 4; l++) {
      if (
        pot[l][0] > -1 &&
        pot[l][0] < y &&
        pot[l][1] > -1 &&
        pot[l][1] < x &&
        unvis[pot[l][0]][pot[l][1]]
      ) {
        neighbors.push(pot[l])
      }
    }

    if (neighbors.length) {
      var next = neighbors[Math.floor(Math.random() * neighbors.length)]
      cells[currentCell[0]][currentCell[1]][next[2]] = 1
      cells[next[0]][next[1]][next[3]] = 1
      unvis[next[0]][next[1]] = false
      visited++
      currentCell = [next[0], next[1]]
      path.push(currentCell)
    } else {
      currentCell = path.pop()
    }
  }
  return cells
}

let cells = newMaze(width, height)

// ── Three.js Scene ─────────────────────────────────────────
const container = document.getElementById('three-container')
const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0x87CEEB, CELL_SIZE * 2, CELL_SIZE * (Math.max(width, height) + 2))

// ── Pixel Skybox ───────────────────────────────────────────
function generateSkyTexture() {
  const s = 64
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')

  // Gradient sky - top to bottom
  for (let y = 0; y < s; y++) {
    const t = y / s
    const r = Math.floor(100 + t * 35)
    const g = Math.floor(160 + t * 46)
    const b = Math.floor(220 + t * 15)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, y, s, 1)
  }

  // Pixel clouds
  function drawCloud(cx, cy, w) {
    const cloudColor = 'rgba(255, 255, 255, 0.8)'
    const shadowColor = 'rgba(220, 230, 240, 0.6)'
    for (let px = 0; px < w; px++) {
      const h = Math.floor(Math.sin(px / w * Math.PI) * 3) + 1
      for (let py = 0; py < h; py++) {
        ctx.fillStyle = py === 0 ? cloudColor : shadowColor
        ctx.fillRect(cx + px, cy - py, 1, 1)
      }
    }
  }

  drawCloud(5, 12, 12)
  drawCloud(30, 8, 16)
  drawCloud(50, 15, 10)
  drawCloud(15, 22, 8)
  drawCloud(42, 20, 14)

  const tex = new THREE.CanvasTexture(c)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  return tex
}

// Build a simple skybox from 6 faces
function createSkybox() {
  const skySize = CELL_SIZE * Math.max(width, height) * 5
  const skyTex = generateSkyTexture()

  // Top face - plain blue
  const topCanvas = document.createElement('canvas')
  topCanvas.width = 16
  topCanvas.height = 16
  const topCtx = topCanvas.getContext('2d')
  topCtx.fillStyle = '#6498dc'
  topCtx.fillRect(0, 0, 16, 16)
  const topTex = new THREE.CanvasTexture(topCanvas)
  topTex.magFilter = THREE.NearestFilter

  // Bottom face - match floor
  const botCanvas = document.createElement('canvas')
  botCanvas.width = 16
  botCanvas.height = 16
  const botCtx = botCanvas.getContext('2d')
  botCtx.fillStyle = '#8B6914'
  botCtx.fillRect(0, 0, 16, 16)
  const botTex = new THREE.CanvasTexture(botCanvas)
  botTex.magFilter = THREE.NearestFilter

  const materials = [
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),  // +X
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),  // -X
    new THREE.MeshBasicMaterial({ map: topTex, side: THREE.BackSide, fog: false }),  // +Y
    new THREE.MeshBasicMaterial({ map: botTex, side: THREE.BackSide, fog: false }),  // -Y
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),  // +Z
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),  // -Z
  ]

  const geo = new THREE.BoxGeometry(skySize, skySize, skySize)
  const skybox = new THREE.Mesh(geo, materials)
  skybox.position.set(width * CELL_SIZE / 2, 0, height * CELL_SIZE / 2)
  skybox.userData.isSkybox = true
  scene.add(skybox)
  return skybox
}

const skybox = createSkybox()

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
container.appendChild(renderer.domElement)

// Size renderer to container (use parent if container has no size yet)
function getContainerSize() {
  let w = container.clientWidth || container.parentElement.clientWidth
  let h = container.clientHeight || container.parentElement.clientHeight || window.innerHeight
  return { w, h }
}

const initSize = getContainerSize()
renderer.setSize(initSize.w, initSize.h)
const camera = new THREE.PerspectiveCamera(85, initSize.w / initSize.h, 0.1, 1000)

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambient)

const directional = new THREE.DirectionalLight(0xffeedd, 0.9)
directional.position.set(width * CELL_SIZE * 0.8, WALL_HEIGHT * 6, -height * CELL_SIZE * 0.3)
scene.add(directional)

const hemi = new THREE.HemisphereLight(0x87CEEB, 0x556633, 0.3)
scene.add(hemi)

// Floor texture — dirt with light patches and leaf litter
function generateDirtTexture() {
  const s = 128
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')

  // Base dirt
  ctx.fillStyle = '#7a5c10'
  ctx.fillRect(0, 0, s, s)

  // Warm/cool patches for dappled sunlight
  for (let i = 0; i < 12; i++) {
    const px = Math.random() * s
    const py = Math.random() * s
    const r = 8 + Math.random() * 16
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r)
    if (Math.random() > 0.5) {
      // Sunlit patch
      grad.addColorStop(0, 'rgba(180, 150, 60, 0.25)')
      grad.addColorStop(1, 'rgba(180, 150, 60, 0)')
    } else {
      // Shadow patch
      grad.addColorStop(0, 'rgba(40, 30, 5, 0.2)')
      grad.addColorStop(1, 'rgba(40, 30, 5, 0)')
    }
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, s, s)
  }

  // Scattered leaf bits
  for (let i = 0; i < 15; i++) {
    const lx = Math.random() * s
    const ly = Math.random() * s
    ctx.fillStyle = Math.random() > 0.6 ? '#5a7a20' : '#8a7828'
    ctx.fillRect(lx, ly, 2 + Math.random() * 3, 1)
  }

  // Fine noise
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * s
    const y = Math.random() * s
    const shade = Math.random() > 0.5 ? '#6a5010' : '#9c7a1e'
    ctx.fillStyle = shade
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(width, height)
  return tex
}

// Floor — extends past maze edges to cover landmarks
const FLOOR_PAD = CELL_SIZE * 8
const floorGeo = new THREE.PlaneGeometry(width * CELL_SIZE + FLOOR_PAD * 2, height * CELL_SIZE + FLOOR_PAD * 2)
const floorMat = new THREE.MeshLambertMaterial({ map: generateDirtTexture() })
const floor = new THREE.Mesh(floorGeo, floorMat)
floor.rotation.x = -Math.PI / 2
floor.position.set(width * CELL_SIZE / 2, -0.01, height * CELL_SIZE / 2)
scene.add(floor)

// ── Landmarks ──────────────────────────────────────────────
// Tall props placed outside the maze, visible above the corn.
// All use fog:false so they remain visible at any distance —
// gives the player something to navigate by.

function pixelTexture(drawFn, w = 64, h = 64, repeat) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  drawFn(c.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeat[0], repeat[1])
  }
  return tex
}

// Strut from p1→p2 along its own length, oriented in 3D.
function strut(thickness, p1, p2, mat) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const m = new THREE.Mesh(new THREE.BoxGeometry(thickness, len, thickness), mat)
  m.position.set((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2)
  m.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(dx, dy, dz).normalize()
  )
  return m
}

function buildSilo(x, z) {
  const g = new THREE.Group()
  const bodyH = 19, bodyR = 3

  // Corrugated metal body — vertical ribs + horizontal section seams
  const bodyTex = pixelTexture((ctx, w, h) => {
    ctx.fillStyle = '#c8c4b8'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < w; i += 4) {
      ctx.fillStyle = i % 8 === 0 ? '#9a9488' : '#e0dccc'
      ctx.fillRect(i, 0, 1, h)
    }
    ctx.fillStyle = '#7a7468'
    for (let y = 12; y < h; y += 16) ctx.fillRect(0, y, w, 1)
    // Rust streaks running vertically
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(120, ${50 + Math.random() * 30}, 25, 0.5)`
      const px = Math.random() * w, py = Math.random() * h
      ctx.fillRect(px, py, 1 + Math.random() * 2, 4 + Math.random() * 6)
    }
  }, 64, 64, [3, 1])
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyR, bodyR, bodyH, 24),
    new THREE.MeshLambertMaterial({ map: bodyTex, fog: false })
  )
  body.position.y = bodyH / 2
  g.add(body)

  // Hemispheric dome top
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(bodyR, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x8a847a, fog: false })
  )
  dome.position.y = bodyH
  g.add(dome)

  // Vent stack on the dome
  const vent = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 1.4, 10),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a, fog: false })
  )
  vent.position.y = bodyH + bodyR + 0.2
  g.add(vent)
  const ventCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.18, 10),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a, fog: false })
  )
  ventCap.position.y = bodyH + bodyR + 1.0
  g.add(ventCap)

  // Side ladder running from base to dome
  const ladderMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a, fog: false })
  const ladderZ = bodyR + 0.04
  const railGeo = new THREE.BoxGeometry(0.07, bodyH - 0.6, 0.07)
  const railL = new THREE.Mesh(railGeo, ladderMat)
  railL.position.set(-0.18, (bodyH - 0.6) / 2 + 0.3, ladderZ)
  g.add(railL)
  const railR = railL.clone()
  railR.position.x = 0.18
  g.add(railR)
  const rungGeo = new THREE.BoxGeometry(0.36, 0.05, 0.05)
  for (let y = 0.6; y < bodyH - 0.4; y += 0.55) {
    const rung = new THREE.Mesh(rungGeo, ladderMat)
    rung.position.set(0, y, ladderZ)
    g.add(rung)
  }

  g.position.set(x, 0, z)
  scene.add(g)
}

function buildBarn(x, z, rotY) {
  const g = new THREE.Group()
  const W = 10, H = 7, D = 6      // body dims
  const ridgeH = 2.8, eaveOver = 0.4

  // ── Long-side wall texture (red planks + trim) ──
  function plankBase(ctx, w, h) {
    ctx.fillStyle = '#a8281c'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < w; i += 6) {
      ctx.fillStyle = '#7a1c14'
      ctx.fillRect(i, 0, 1, h)
    }
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = 'rgba(40, 10, 5, 0.25)'
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 3)
    }
    ctx.fillStyle = '#f0e8c8'
    ctx.fillRect(0, h - 3, w, 2)
    ctx.fillRect(0, 1, w, 2)
    ctx.fillRect(0, 0, 2, h)
    ctx.fillRect(w - 2, 0, 2, h)
  }
  const longTex = pixelTexture((ctx, w, h) => {
    plankBase(ctx, w, h)
    // Big sliding doors at center
    const dx = w * 0.32, dy = h * 0.45, dw = w * 0.36, dh = h * 0.5
    ctx.fillStyle = '#f0e8c8'
    ctx.fillRect(dx, dy, dw, dh)
    ctx.fillStyle = '#3a2018'
    ctx.fillRect(dx + dw / 2 - 1, dy, 2, dh)         // center divider
    ctx.fillRect(dx, dy, 1, dh)                       // left edge
    ctx.fillRect(dx + dw - 1, dy, 1, dh)              // right edge
    ctx.fillRect(dx, dy, dw, 1)                       // top
    ctx.fillRect(dx, dy + dh - 1, dw, 1)              // bottom
    ctx.strokeStyle = '#3a2018'
    ctx.lineWidth = 1
    // X-bracing on each door half
    ctx.beginPath()
    ctx.moveTo(dx + 1, dy + 1); ctx.lineTo(dx + dw / 2 - 2, dy + dh - 1)
    ctx.moveTo(dx + dw / 2 - 2, dy + 1); ctx.lineTo(dx + 1, dy + dh - 1)
    ctx.moveTo(dx + dw / 2 + 2, dy + 1); ctx.lineTo(dx + dw - 1, dy + dh - 1)
    ctx.moveTo(dx + dw - 1, dy + 1); ctx.lineTo(dx + dw / 2 + 2, dy + dh - 1)
    ctx.stroke()
  }, 128, 96)
  const shortTex = pixelTexture((ctx, w, h) => {
    plankBase(ctx, w, h)
  }, 96, 96)

  // Body — 6 face materials (front/back use door tex, sides plain)
  const longMat = new THREE.MeshLambertMaterial({ map: longTex, fog: false })
  const shortMat = new THREE.MeshLambertMaterial({ map: shortTex, fog: false })
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    [shortMat, shortMat, longMat, longMat, longMat, longMat]
  )
  body.position.y = H / 2
  g.add(body)

  // ── Gable roof: triangular prism ──
  // Triangle in the gable plane: bottom from (-D/2-eave, 0) to (D/2+eave, 0), apex at (0, ridgeH)
  // Extruded along the barn's long axis (X).
  const roofShape = new THREE.Shape()
  roofShape.moveTo(-(D / 2 + eaveOver), 0)
  roofShape.lineTo(D / 2 + eaveOver, 0)
  roofShape.lineTo(0, ridgeH)
  roofShape.closePath()
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: W + eaveOver * 2, bevelEnabled: false,
  })
  roofGeo.translate(0, 0, -(W + eaveOver * 2) / 2)
  roofGeo.rotateY(Math.PI / 2)

  const roofTex = pixelTexture((ctx, w, h) => {
    ctx.fillStyle = '#3a2818'
    ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 5) {
      ctx.fillStyle = y % 10 === 0 ? '#1c1408' : '#2a1c10'
      ctx.fillRect(0, y, w, 1)
    }
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = 'rgba(180, 130, 80, 0.12)'
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1)
    }
  }, 64, 64, [4, 1])
  const roof = new THREE.Mesh(
    roofGeo,
    new THREE.MeshLambertMaterial({ map: roofTex, fog: false })
  )
  roof.position.y = H
  g.add(roof)

  // ── Gable end triangle walls (close off the prism's open ends) ──
  const gableShape = new THREE.Shape()
  gableShape.moveTo(-D / 2, 0)
  gableShape.lineTo(D / 2, 0)
  gableShape.lineTo(0, ridgeH)
  gableShape.closePath()
  const gableGeo = new THREE.ShapeGeometry(gableShape)

  const gableTex = pixelTexture((ctx, w, h) => {
    ctx.fillStyle = '#a8281c'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < w; i += 6) {
      ctx.fillStyle = '#7a1c14'
      ctx.fillRect(i, 0, 1, h)
    }
    // Hayloft window in upper portion
    const wx = w * 0.42, wy = h * 0.28, ww = w * 0.16, wh = h * 0.32
    ctx.fillStyle = '#1a1008'
    ctx.fillRect(wx, wy, ww, wh)
    ctx.fillStyle = '#f0e8c8'
    ctx.fillRect(wx, wy + wh / 2 - 1, ww, 1)
    ctx.fillRect(wx + ww / 2 - 1, wy, 1, wh)
  }, 96, 96)
  const gableMat = new THREE.MeshBasicMaterial({
    map: gableTex, side: THREE.DoubleSide, fog: false,
  })
  const gableF = new THREE.Mesh(gableGeo, gableMat)
  gableF.rotation.y = Math.PI / 2
  gableF.position.set(W / 2 + 0.001, H, 0)
  g.add(gableF)
  const gableB = new THREE.Mesh(gableGeo, gableMat)
  gableB.rotation.y = -Math.PI / 2
  gableB.position.set(-W / 2 - 0.001, H, 0)
  g.add(gableB)

  // Weather vane on the ridge
  const vanePost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6),
    new THREE.MeshLambertMaterial({ color: 0x222222, fog: false })
  )
  vanePost.position.set(W / 2 - 1, H + ridgeH + 0.45, 0)
  g.add(vanePost)
  const vaneArrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.5, 4),
    new THREE.MeshLambertMaterial({ color: 0x222222, fog: false })
  )
  vaneArrow.rotation.z = -Math.PI / 2
  vaneArrow.position.set(W / 2 - 0.6, H + ridgeH + 0.85, 0)
  g.add(vaneArrow)

  g.position.set(x, 0, z)
  g.rotation.y = rotY || 0
  scene.add(g)
}

function buildWaterTower(x, z) {
  const g = new THREE.Group()
  const tankH = 4.5, tankR = 2.6
  const platformY = 9
  const baseR = tankR + 1.4         // legs splay outward at the base
  const topR  = tankR - 0.05        // legs taper inward at the top
  const legMat = new THREE.MeshLambertMaterial({ color: 0x382818, fog: false })

  // ── Splayed legs ──
  const legBases = [], legTops = []
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4
    const base = { x: Math.cos(a) * baseR, y: 0, z: Math.sin(a) * baseR }
    const top  = { x: Math.cos(a) * topR,  y: platformY, z: Math.sin(a) * topR }
    g.add(strut(0.32, base, top, legMat))
    legBases.push(base); legTops.push(top)
  }

  // ── Cross-bracing: X between every pair of adjacent legs, at two heights ──
  function lerp(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
  }
  for (let i = 0; i < 4; i++) {
    const a0 = legBases[i], aT = legTops[i]
    const b0 = legBases[(i + 1) % 4], bT = legTops[(i + 1) % 4]
    // Lower X (between heights 0.15 and 0.55 of the leg)
    g.add(strut(0.12, lerp(a0, aT, 0.15), lerp(b0, bT, 0.55), legMat))
    g.add(strut(0.12, lerp(a0, aT, 0.55), lerp(b0, bT, 0.15), legMat))
    // Upper X (heights 0.55 to 0.95)
    g.add(strut(0.12, lerp(a0, aT, 0.55), lerp(b0, bT, 0.95), legMat))
    g.add(strut(0.12, lerp(a0, aT, 0.95), lerp(b0, bT, 0.55), legMat))
  }

  // ── Tank ──
  const tankMat = new THREE.MeshLambertMaterial({ color: 0x6a5a44, fog: false })
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(tankR, tankR, tankH, 18),
    tankMat
  )
  tank.position.y = platformY + tankH / 2
  g.add(tank)

  // Slight bottom dome — gives the tank a curved underside
  const bottomDome = new THREE.Mesh(
    new THREE.SphereGeometry(tankR, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    tankMat
  )
  bottomDome.position.y = platformY
  g.add(bottomDome)

  // Conical top
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(tankR + 0.12, 1.6, 18),
    new THREE.MeshLambertMaterial({ color: 0x4a3a28, fog: false })
  )
  top.position.y = platformY + tankH + 0.8
  g.add(top)

  // Finial on the cone tip
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a, fog: false })
  )
  finial.position.y = platformY + tankH + 1.65
  g.add(finial)

  g.position.set(x, 0, z)
  scene.add(g)
}

function placeLandmarks() {
  // Position landmarks just past the maze edge so they peek above the corn
  // from anywhere in the maze.  Three of them gives players 3 reference
  // bearings to triangulate by.
  const w = width * CELL_SIZE
  const h = height * CELL_SIZE
  const off = CELL_SIZE * 4
  // West silo, slightly toward the start (north)
  buildSilo(-off, h * 0.32)
  // Northeast water tower
  buildWaterTower(w * 0.65, -off)
  // East barn near the exit, angled inward
  buildBarn(w + off + 1, h * 0.7, -Math.PI * 0.2)
}
placeLandmarks()

// ── Pixel Corn Renderer ────────────────────────────────────
// Real corn anatomy: stalk with nodes, alternating leaves,
// ear with husk near the top, tassel crown at apex.
// All pixel-grid based for blocky look.

// Corn varieties
const CORN_VARIETIES = [
  { k1: '#c8a030', k2: '#d4b840' },
  { k1: '#d8c860', k2: '#e4d870' },
  { k1: '#8a2a1a', k2: '#a43420' },
  { k1: '#3a3a6a', k2: '#4a4a80' },
  { k1: '#d8d0b8', k2: '#e8e0c8' },
  { k1: '#c87030', k2: '#d88040' },
  { k1: '#6a1818', k2: '#842020' },
  { k1: '#5a2868', k2: '#6a3878' },
]

function drawCornStalk(ctx, px, gridW, gridH, sx, cfg) {
  function setPixel(gx, gy, color) {
    if (gx < 0 || gx >= gridW || gy < 0 || gy >= gridH) return
    ctx.fillStyle = color
    ctx.fillRect(gx * px, gy * px, px, px)
  }

  // Per-stalk randomization
  const topG = cfg.topRow + Math.floor(Math.random() * 5)
  const bottomG = gridH - 1
  const stalkHeight = bottomG - topG
  const stalkLean = Math.floor((Math.random() - 0.5) * 2)
  const nodeSpacing = 4 + Math.floor(Math.random() * 2)

  function getLean(gy) {
    const t = (bottomG - gy) / (stalkHeight + 1)
    return Math.floor(t * stalkLean)
  }

  // ── Stalk: thick segmented stem ──
  // Real corn stalks are chunky — 2-3px wide with visible segments
  for (let gy = bottomG; gy >= topG; gy--) {
    const lean = getLean(gy)
    setPixel(sx + lean, gy, cfg.stalk)
    setPixel(sx + lean + 1, gy, cfg.stalkLight)
    // Thicker at bottom, thinner at top
    if (gy > bottomG - stalkHeight * 0.7) {
      setPixel(sx + lean - 1, gy, cfg.stalk)
    }
  }

  // Node rings — visible joint bumps where leaves attach
  for (let ny = bottomG - 2; ny > topG + 3; ny -= nodeSpacing) {
    const lean = getLean(ny)
    setPixel(sx + lean - 1, ny, cfg.stalkLight)
    setPixel(sx + lean + 2, ny, cfg.stalkLight)
    // Slight color band at joint
    setPixel(sx + lean, ny, cfg.stalkLight)
    setPixel(sx + lean + 1, ny, cfg.stalk)
  }

  // ── Leaves: long, wide at base, tapering, arching up then gracefully curving over ──
  // Corn leaves are the most distinctive part — they're LONG relative to spacing
  let side = Math.random() > 0.5 ? 1 : -1
  for (let ny = bottomG - 3; ny > topG + 4; ny -= nodeSpacing) {
    const lean = getLean(ny)
    const baseLen = cfg.leafLen + Math.floor(Math.random() * 3)
    // Leaves get longer in the middle of the stalk
    const heightRatio = (ny - topG) / stalkHeight
    const lenBonus = heightRatio > 0.3 && heightRatio < 0.8 ? 2 : 0
    const len = baseLen + lenBonus

    // Both sides at each node (corn has opposite leaves)
    const sides = [side, -side]
    for (const s of sides) {
      if (Math.random() < 0.15) continue // occasional missing leaf

      for (let lp = 0; lp <= len; lp++) {
        const t = lp / len

        // Leaf path: rises up steeply, then arcs over
        // Phase 1 (0-60%): rises upward
        // Phase 2 (60-100%): curves back down gently
        let rise
        if (t < 0.6) {
          rise = Math.floor(t / 0.6 * len * 0.4)
        } else {
          const peak = Math.floor(len * 0.4)
          const fallT = (t - 0.6) / 0.4
          rise = Math.floor(peak - fallT * fallT * peak * 0.3)
        }

        const gx = sx + lean + s * lp
        const gy = ny - rise

        // Leaf width: wide at base (3px), tapers to point (1px)
        if (t < 0.3) {
          // Wide base
          setPixel(gx, gy - 1, cfg.leaf)
          setPixel(gx, gy, cfg.leaf)
          setPixel(gx, gy + 1, cfg.leafDark)
          // Midrib
          setPixel(gx, gy, cfg.stalkLight)
        } else if (t < 0.7) {
          // Middle
          setPixel(gx, gy, cfg.leaf)
          setPixel(gx, gy + 1, cfg.leafDark)
          // Midrib
          setPixel(gx, gy, cfg.stalkLight)
        } else {
          // Tapered tip
          setPixel(gx, gy, cfg.leaf)
        }
      }
    }
    side *= -1
  }

  // ── Ear of corn: grows at a leaf node, angled up, wrapped in husk ──
  if (cfg.hasEar && Math.random() < 0.55) {
    const earSide = side
    // Ears grow in upper-middle of stalk (around 25-40% from top)
    const earPos = 0.25 + Math.random() * 0.15
    const earNodeY = topG + Math.max(5, Math.floor(stalkHeight * earPos))
    const earLean = getLean(earNodeY)
    const earLen = 5 + Math.floor(Math.random() * 3)
    const variety = CORN_VARIETIES[Math.floor(Math.random() * CORN_VARIETIES.length)]

    // Ear angles upward from stalk at ~30 degrees
    for (let ep = 0; ep < earLen; ep++) {
      const ex = sx + earLean + earSide * (1 + Math.floor(ep * 0.35))
      const ey = earNodeY - ep

      // 3px wide ear with kernel pattern
      setPixel(ex, ey, ep % 2 === 0 ? variety.k1 : variety.k2)
      setPixel(ex + earSide, ey, ep % 2 === 0 ? variety.k2 : variety.k1)
      if (ep > 0 && ep < earLen - 1) {
        setPixel(ex - earSide, ey, ep % 2 === 0 ? variety.k1 : variety.k2)
      }
    }

    // Husk: wraps around base and peels back
    const hx = sx + earLean + earSide
    setPixel(hx, earNodeY + 1, cfg.husk)
    setPixel(hx + earSide, earNodeY + 1, cfg.husk)
    setPixel(hx, earNodeY + 2, cfg.husk)
    // Husk peeling away
    setPixel(hx + earSide * 2, earNodeY, cfg.husk)
    setPixel(hx + earSide * 2, earNodeY + 1, cfg.husk)
    setPixel(hx + earSide * 3, earNodeY + 1, cfg.husk)

    // Silk: wispy threads from the top of the ear
    const tipX = sx + earLean + earSide * (1 + Math.floor((earLen - 1) * 0.35))
    const tipY = earNodeY - earLen
    for (let s = 0; s < 3 + Math.floor(Math.random() * 3); s++) {
      const silkX = tipX + Math.floor((Math.random() - 0.5) * 4)
      const silkY = tipY - 1 - Math.floor(Math.random() * 3)
      setPixel(silkX, silkY, cfg.silk)
    }
  }

  // ── Tassel: feathery, drooping branches at the very top ──
  // Real tassels are loose and hang slightly — the one part that droops
  const tLean = getLean(topG)
  const tx = sx + tLean

  // Central spike
  setPixel(tx, topG, cfg.tassel)
  setPixel(tx + 1, topG, cfg.tassel)
  setPixel(tx, topG - 1, cfg.tassel)
  setPixel(tx + 1, topG - 1, cfg.tassel)
  if (topG > 1) setPixel(tx, topG - 2, cfg.tasselLight)

  // Drooping branches — spread out and hang down slightly
  const branchCount = 3 + Math.floor(Math.random() * 3)
  for (let b = 0; b < branchCount; b++) {
    const bSide = (b % 2 === 0) ? -1 : 1
    const bLen = 2 + Math.floor(Math.random() * 3)
    for (let bp = 1; bp <= bLen; bp++) {
      const bx = tx + bSide * bp
      // Branches go out and droop down slightly
      const by = topG - 1 + Math.floor(bp * 0.4)
      setPixel(bx, by, bp < bLen ? cfg.tassel : cfg.tasselLight)
    }
  }
}

// ── Three layers of corn ──────────────────────────────────
// Back:  full height, dark, dense — the solid "wall"
// Mid:   slightly shorter, medium shade, fewer stalks
// Front: shortest, brightest, sparsest — closest to player

const PX = 2 // base pixel size

const LAYERS = [
  {
    // Deepest — darkest, densest, tallest
    px: PX,
    stalks: 10,
    opaque: false,
    bgFill: null,
    heightRatio: 0.98,
    offset: 0,
    stalkCfg: {
      topRow: 1, leafLen: 2, hasEar: true,
      stalk: '#1c3608', stalkLight: '#243f0e',
      leaf: '#203a0c', leafDark: '#182e08',
      ear: '#6a5818', earLight: '#7a6820', husk: '#1e3208', silk: '#6a6030',
      tassel: '#584818', tasselLight: '#685820',
    }
  },
  {
    // Back — dense, dark
    px: PX,
    stalks: 8,
    opaque: false,
    bgFill: null,
    heightRatio: 0.95,
    offset: 0.08,
    stalkCfg: {
      topRow: 1, leafLen: 3, hasEar: true,
      stalk: '#24400e', stalkLight: '#2c4c14',
      leaf: '#2a4a12', leafDark: '#1e3a0c',
      ear: '#8a7020', earLight: '#9a8028', husk: '#2a4210', silk: '#8a7840',
      tassel: '#6a5820', tasselLight: '#7a6828',
    }
  },
  {
    // Mid-back
    px: PX,
    stalks: 6,
    opaque: false,
    bgFill: null,
    heightRatio: 0.90,
    offset: 0.16,
    stalkCfg: {
      topRow: 2, leafLen: 3, hasEar: true,
      stalk: '#306010', stalkLight: '#3a7018',
      leaf: '#386816', leafDark: '#2c5410',
      ear: '#9a8028', earLight: '#aa9030', husk: '#346014', silk: '#9a8848',
      tassel: '#807030', tasselLight: '#908038',
    }
  },
  {
    // Mid-front — brighter
    px: PX,
    stalks: 4,
    opaque: false,
    bgFill: null,
    heightRatio: 0.84,
    offset: 0.26,
    stalkCfg: {
      topRow: 3, leafLen: 4, hasEar: true,
      stalk: '#3a6a1c', stalkLight: '#448020',
      leaf: '#4a7a24', leafDark: '#3a6418',
      ear: '#b89830', earLight: '#c8a838', husk: '#3e6a1a', silk: '#b8a860',
      tassel: '#98803a', tasselLight: '#a89040',
    }
  },
  {
    // Front — sparse, brightest, shortest
    px: PX,
    stalks: 3,
    opaque: false,
    bgFill: null,
    heightRatio: 0.76,
    offset: 0.38,
    stalkCfg: {
      topRow: 5, leafLen: 4, hasEar: false,
      stalk: '#4a8a24', stalkLight: '#58a02c',
      leaf: '#5ca830', leafDark: '#4a8a24',
      ear: '#c8a840', earLight: '#d4b848', husk: '#509a28', silk: '#c8b868',
      tassel: '#c0a048', tasselLight: '#d0b058',
    }
  },
]

// Generate a single corn texture variation
function generateCornLayer(layerCfg, heightJitter) {
  // Wide texture so it doesn't repeat obviously
  const texW = 256
  const texH = 128
  const c = document.createElement('canvas')
  c.width = texW
  c.height = texH
  const ctx = c.getContext('2d')

  const gridW = Math.floor(texW / layerCfg.px)
  const gridH = Math.floor(texH / layerCfg.px)
  const ratio = layerCfg.heightRatio + (heightJitter || 0)
  const usableH = Math.floor(gridH * Math.min(ratio, 1))
  const startRow = gridH - usableH

  // All layers are transparent — corn stalks on clear background

  // Randomize stalk count per variation (±30%)
  const baseCount = layerCfg.stalks * 2
  const stalkCount = baseCount + Math.floor((Math.random() - 0.5) * baseCount * 0.6)
  const spacing = gridW / stalkCount
  for (let i = 0; i < stalkCount; i++) {
    // More jitter in placement
    const sx = Math.floor(spacing * i + spacing / 2) + Math.floor((Math.random() - 0.5) * spacing * 0.7)
    const cfg = Object.assign({}, layerCfg.stalkCfg)
    // Each stalk gets its own height variation
    const stalkJitter = Math.floor(Math.random() * 6)
    cfg.topRow = startRow + layerCfg.stalkCfg.topRow + stalkJitter
    drawCornStalk(ctx, layerCfg.px, gridW, gridH, sx, cfg)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  return tex
}

// Corn sway shader — bends like a stalk rooted in the ground
const cornVertexShader = `
  uniform float time;
  uniform float swayAmount;
  uniform float swaySpeed;
  uniform float phase;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Height from ground: 0 at base, 1 at top
    float h = uv.y;

    // Bend angle varies per horizontal position (different stalks, different timing)
    float stalkPhase = uv.x * 8.0 + phase;
    float bendAngle = sin(time * swaySpeed + stalkPhase) * swayAmount * 0.4;
    float bendAngle2 = cos(time * swaySpeed * 0.6 + stalkPhase * 1.3 + 2.0) * swayAmount * 0.15;

    // Arc bend: each vertex rotates around the base by (bendAngle * h)
    // This curves the stalk rather than shearing it
    float angle = bendAngle * h;
    float angle2 = bendAngle2 * h;

    // Apply as arc: x offset = sin(angle) * originalHeight, y shrink = cos(angle) * originalHeight
    // But we approximate for small angles to keep it simple and cheap
    pos.x += sin(angle) * h * 0.5;
    pos.y += (cos(angle) - 1.0) * h * 0.25;
    pos.z += sin(angle2) * h * 0.3;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const cornFragmentShader = `
  uniform sampler2D map;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;

  void main() {
    vec4 texColor = texture2D(map, vUv);
    if (texColor.a < 0.05) discard;

    // Manual fog
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = smoothstep(fogNear, fogFar, depth);
    texColor.rgb = mix(texColor.rgb, fogColor, fogFactor);

    gl_FragColor = texColor;
  }
`

// Generate a pool of texture variations per layer
const VARIATIONS_PER_LAYER = 12

const wallLayerPool = LAYERS.map((layerCfg) => {
  const variations = []
  for (let v = 0; v < VARIATIONS_PER_LAYER; v++) {
    const jitter = (Math.random() - 0.5) * 0.08
    const tex = generateCornLayer(layerCfg, jitter)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: tex },
        time: { value: 0 },
        swayAmount: { value: 0.05 + layerCfg.offset * 0.25 },
        swaySpeed: { value: 0.35 + Math.random() * 0.2 },
        phase: { value: Math.random() * Math.PI * 2 },
        fogColor: { value: new THREE.Color(0x87CEEB) },
        fogNear: { value: CELL_SIZE * 2 },
        fogFar: { value: CELL_SIZE * (Math.max(width, height) + 2) },
      },
      vertexShader: cornVertexShader,
      fragmentShader: cornFragmentShader,
      side: THREE.DoubleSide,
      transparent: true,
    })

    variations.push({
      mat,
      offset: layerCfg.offset,
      heightRatio: layerCfg.heightRatio + jitter,
    })
  }
  return variations
})

// ── Build Walls ────────────────────────────────────────────
function buildWalls() {
  const toRemove = []
  scene.traverse((obj) => {
    if (obj.userData.isWall) toRemove.push(obj)
  })
  toRemove.forEach((obj) => scene.remove(obj))

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const cx = col * CELL_SIZE + CELL_SIZE / 2
      const cz = row * CELL_SIZE + CELL_SIZE / 2

      if (row === 0 && cells[row][col][0] === 0)
        addWallLayers(cx, row * CELL_SIZE, 'h')
      if (cells[row][col][2] === 0)
        addWallLayers(cx, (row + 1) * CELL_SIZE, 'h')
      if (col === 0 && cells[row][col][3] === 0)
        addWallLayers(col * CELL_SIZE, cz, 'v')
      if (cells[row][col][1] === 0)
        addWallLayers((col + 1) * CELL_SIZE, cz, 'v')
    }
  }
}

const WALL_BOX_DEPTH = 0.12
const coreMat = new THREE.MeshLambertMaterial({ color: 0x0e2004 })


function addWallLayers(x, z, orientation) {
  // Corn layers
  wallLayerPool.forEach((variations, layerIdx) => {
    const layer = variations[Math.floor(Math.random() * variations.length)]
    const h = WALL_HEIGHT * layer.heightRatio
    const yCenter = h / 2

    const geo = new THREE.PlaneGeometry(CELL_SIZE, h, 8, 12)
    const offsets = layer.offset === 0
      ? [-0.08, 0.08]
      : [-layer.offset, layer.offset]

    offsets.forEach((off) => {
      const plane = new THREE.Mesh(geo, layer.mat)
      plane.userData.isWall = true

      if (orientation === 'h') {
        plane.position.set(x, h / 2, z + off)
      } else {
        plane.rotation.y = Math.PI / 2
        plane.position.set(x + off, h / 2, z)
      }
      scene.add(plane)
    })
  })
}

function animateCornSway(time) {
  const t = time * 0.001
  // Update time uniform on all shader materials
  wallLayerPool.forEach((variations) => {
    variations.forEach((v) => {
      if (v.mat.uniforms && v.mat.uniforms.time) {
        v.mat.uniforms.time.value = t
      }
    })
  })
}

// ── Exit Marker: Jack-o'-Lantern + Finish Flag ─────────────
const exitMarker = new THREE.Group()
const exitFaceMat = new THREE.MeshBasicMaterial({
  color: 0xffe048, fog: false, side: THREE.DoubleSide,
})
{
  // Pumpkin body — squashed sphere
  const pumpkin = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0xe07020, emissive: 0x4a1a04 })
  )
  pumpkin.scale.y = 0.78
  pumpkin.position.y = 0.7
  exitMarker.add(pumpkin)
  // Stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.2, 0.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x4a6818 })
  )
  stem.position.y = 0.7 + 0.85 * 0.78 + 0.18
  exitMarker.add(stem)
  // Glowing eyes
  const eye = (xOff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.2), exitFaceMat)
    m.position.set(xOff, 0.92, 0.78)
    return m
  }
  exitMarker.add(eye(-0.27))
  exitMarker.add(eye(0.27))
  // Grin
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.14), exitFaceMat)
  mouth.position.set(0, 0.55, 0.78)
  exitMarker.add(mouth)
  // Warm point light
  const glow = new THREE.PointLight(0xff8030, 1.4, CELL_SIZE * 2)
  glow.position.y = 0.9
  exitMarker.add(glow)
  // Finish flag pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x4a3818 })
  )
  pole.position.set(0.7, 1.2, -0.55)
  exitMarker.add(pole)
  // Checkered flag
  const flagTex = pixelTexture((ctx, w, h) => {
    const sq = 6
    for (let y = 0; y < h; y += sq) for (let x = 0; x < w; x += sq) {
      ctx.fillStyle = (((x / sq) + (y / sq)) % 2 < 1) ? '#fafafa' : '#1a1a1a'
      ctx.fillRect(x, y, sq, sq)
    }
  }, 36, 24)
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.55),
    new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide, fog: false })
  )
  flag.position.set(1.15, 2.1, -0.55)
  exitMarker.add(flag)
}
exitMarker.position.set(
  (width - 1) * CELL_SIZE + CELL_SIZE / 2,
  0,
  (height - 1) * CELL_SIZE + CELL_SIZE / 2
)
scene.add(exitMarker)

function animateExitMarker(time) {
  const t = time * 0.001
  exitMarker.rotation.y = t * 0.6
  exitMarker.position.y = Math.sin(t * 1.6) * 0.18
  // Eyes/mouth pulse
  exitFaceMat.opacity = 0.78 + Math.sin(t * 4.5) * 0.22
  exitFaceMat.transparent = true
}

// ── Player State ───────────────────────────────────────────
const player = {
  col: 0,
  row: 0,
  facing: 2, // Start facing South
  animating: false
}

let moves = 0
let finished = false
const movesEl = document.querySelector('#moves-span')
const victoryModal = document.querySelector('.victory')
const victoryMovesEl = document.querySelector('#victory-moves-span')
const victoryTimeEl = document.querySelector('#victory-time-span')

function cellToWorld(col, row) {
  return {
    x: col * CELL_SIZE + CELL_SIZE / 2,
    z: row * CELL_SIZE + CELL_SIZE / 2
  }
}

function findOpenFacing(row, col) {
  // Prefer S, E, N, W — biased toward the exit direction
  const preferred = [2, 1, 0, 3]
  for (const dir of preferred) {
    if (cells[row][col][dir] !== 0) return dir
  }
  return 2 // fallback
}

function updateCamera() {
  const pos = cellToWorld(player.col, player.row)
  camera.position.set(pos.x, EYE_HEIGHT, pos.z)
  camera.rotation.order = 'YXZ'
  camera.rotation.y = FACING_ANGLES[player.facing]
  camera.rotation.x = 0
  camera.rotation.z = 0
}

player.facing = findOpenFacing(0, 0)
updateCamera()

// ── Movement ───────────────────────────────────────────────
function canMove(row, col, direction) {
  if (row < 0 || row >= height || col < 0 || col >= width) return false
  return cells[row][col][direction] !== 0
}

function moveInDirection(dirIndex) {
  if (finished || player.animating) return
  if (!canMove(player.row, player.col, dirIndex)) return

  const vec = DIR_VECTORS[dirIndex]
  const toCol = player.col + vec.dc
  const toRow = player.row + vec.dr

  if (!timerStarted) startTimer()

  animateMove(player.col, player.row, toCol, toRow)
  moves++
  if (movesEl) movesEl.innerHTML = moves
}

function moveForward() { moveInDirection(player.facing) }
function moveBackward() { moveInDirection((player.facing + 2) % 4) }
function strafeLeft() { moveInDirection((player.facing + 3) % 4) }
function strafeRight() { moveInDirection((player.facing + 1) % 4) }

let rotating = false

function rotateLeft() {
  if (finished || rotating) return
  const oldFacing = player.facing
  player.facing = (player.facing + 3) % 4
  animateRotation(FACING_ANGLES[oldFacing], FACING_ANGLES[player.facing])
}

function rotateRight() {
  if (finished || rotating) return
  const oldFacing = player.facing
  player.facing = (player.facing + 1) % 4
  animateRotation(FACING_ANGLES[oldFacing], FACING_ANGLES[player.facing])
}

// ── Animation ──────────────────────────────────────────────
function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

function animateMove(fromCol, fromRow, toCol, toRow) {
  player.animating = true
  const startPos = cellToWorld(fromCol, fromRow)
  const endPos = cellToWorld(toCol, toRow)
  const startTime = performance.now()

  function step(now) {
    const t = Math.min((now - startTime) / ANIM_DURATION, 1)
    const eased = smoothstep(t)

    camera.position.x = startPos.x + (endPos.x - startPos.x) * eased
    camera.position.z = startPos.z + (endPos.z - startPos.z) * eased
    // Head bob
    camera.position.y = EYE_HEIGHT + Math.sin(t * Math.PI) * 0.08

    if (t < 1) {
      requestAnimationFrame(step)
    } else {
      camera.position.y = EYE_HEIGHT
      player.col = toCol
      player.row = toRow
      player.animating = false
      checkVictory()
      processInput()
    }
  }
  requestAnimationFrame(step)
}

function animateRotation(fromAngle, toAngle) {
  rotating = true
  let diff = toAngle - fromAngle
  if (diff > Math.PI) diff -= 2 * Math.PI
  if (diff < -Math.PI) diff += 2 * Math.PI
  const startTime = performance.now()

  function step(now) {
    const t = Math.min((now - startTime) / ANIM_DURATION, 1)
    const eased = smoothstep(t)
    camera.rotation.y = fromAngle + diff * eased

    if (t < 1) {
      requestAnimationFrame(step)
    } else {
      camera.rotation.y = toAngle
      rotating = false
      processInput()
    }
  }
  requestAnimationFrame(step)
}

// ── Victory ────────────────────────────────────────────────
function checkVictory() {
  if (player.col === width - 1 && player.row === height - 1) {
    win()
  }
}

function win() {
  finished = true
  cancelAnimationFrame(timerFrame)

  if (victoryMovesEl) victoryMovesEl.innerHTML = moves
  if (victoryTimeEl) victoryTimeEl.innerHTML = msToTime(time)
  if (victoryModal) victoryModal.classList.remove('hidden')

  localStorage.setItem(`maze-completed-${mazeName}`, 'true')
}

// ── Timer ──────────────────────────────────────────────────
let startTime, timerFrame
let time = 0
let timerStarted = false
const timeElement = document.querySelector('#time-span')

function msToTime(duration) {
  let seconds = Math.floor((duration / 1000) % 60)
  let minutes = Math.floor((duration / (1000 * 60)) % 60)
  let hours = Math.floor((duration / (1000 * 60 * 60)) % 24)
  if (hours) return hours + 'h ' + minutes + 'm ' + seconds + 's'
  if (minutes) return minutes + 'm ' + seconds + 's'
  return seconds + 's'
}

function startTimer() {
  timerStarted = true
  startTime = Date.now()
  tickTimer()
}

function tickTimer() {
  time = Date.now() - startTime
  if (timeElement) timeElement.innerHTML = msToTime(time)
  timerFrame = requestAnimationFrame(tickTimer)
}

function resetTimer() {
  timerStarted = false
  time = 0
  cancelAnimationFrame(timerFrame)
  if (timeElement) timeElement.innerHTML = '0s'
}

// ── Minimap ────────────────────────────────────────────────
const minimap = document.getElementById('minimap')
const mmCtx = minimap.getContext('2d')
const MM_SIZE = 180
minimap.width = MM_SIZE
minimap.height = MM_SIZE

// Hidden by default, type "sos" to reveal (resets each session)
let minimapVisible = false
minimap.style.display = 'none'

;(() => {
  let buffer = ''
  document.addEventListener('keydown', (e) => {
    if (minimapVisible) return
    buffer += e.key.toLowerCase()
    if (buffer.length > 3) buffer = buffer.slice(-3)
    if (buffer === 'sos') {
      minimapVisible = true
      minimap.style.display = ''
    }
  })
})()

function drawMinimap() {
  if (!minimapVisible) return
  const cellPx = MM_SIZE / Math.max(width, height)
  mmCtx.clearRect(0, 0, MM_SIZE, MM_SIZE)

  // Background
  mmCtx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  mmCtx.fillRect(0, 0, MM_SIZE, MM_SIZE)

  // Walls
  mmCtx.strokeStyle = '#333'
  mmCtx.lineWidth = 1.5

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const x = col * cellPx
      const y = row * cellPx

      // North
      if (cells[row][col][0] === 0) {
        mmCtx.beginPath()
        mmCtx.moveTo(x, y)
        mmCtx.lineTo(x + cellPx, y)
        mmCtx.stroke()
      }
      // East
      if (cells[row][col][1] === 0) {
        mmCtx.beginPath()
        mmCtx.moveTo(x + cellPx, y)
        mmCtx.lineTo(x + cellPx, y + cellPx)
        mmCtx.stroke()
      }
      // South
      if (cells[row][col][2] === 0) {
        mmCtx.beginPath()
        mmCtx.moveTo(x, y + cellPx)
        mmCtx.lineTo(x + cellPx, y + cellPx)
        mmCtx.stroke()
      }
      // West
      if (cells[row][col][3] === 0) {
        mmCtx.beginPath()
        mmCtx.moveTo(x, y)
        mmCtx.lineTo(x, y + cellPx)
        mmCtx.stroke()
      }
    }
  }

  // Exit marker
  mmCtx.fillStyle = '#ff3300'
  const ex = (width - 1) * cellPx + cellPx / 2
  const ey = (height - 1) * cellPx + cellPx / 2
  mmCtx.fillRect(ex - cellPx * 0.3, ey - cellPx * 0.3, cellPx * 0.6, cellPx * 0.6)

  // Player
  const px = player.col * cellPx + cellPx / 2
  const py = player.row * cellPx + cellPx / 2

  mmCtx.fillStyle = '#0066ff'
  mmCtx.beginPath()
  mmCtx.arc(px, py, cellPx * 0.3, 0, Math.PI * 2)
  mmCtx.fill()

  // Facing direction indicator
  const dirVec = DIR_VECTORS[player.facing]
  mmCtx.strokeStyle = '#0066ff'
  mmCtx.lineWidth = 2
  mmCtx.beginPath()
  mmCtx.moveTo(px, py)
  mmCtx.lineTo(px + dirVec.dc * cellPx * 0.5, py + dirVec.dr * cellPx * 0.5)
  mmCtx.stroke()
}

// ── Input ──────────────────────────────────────────────────
const inputKeys = ['w', 'a', 's', 'd', 'q', 'e', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
const keysDown = new Set()

document.addEventListener('keydown', (e) => {
  if (inputKeys.includes(e.key)) {
    e.preventDefault()
    e.stopPropagation()
  }

  // Turns: fire once per press, no repeat
  if (!e.repeat) {
    if (e.key === 'q' || e.key === 'ArrowLeft') rotateLeft()
    else if (e.key === 'e' || e.key === 'ArrowRight') rotateRight()
  }

  keysDown.add(e.key)
  processInput()
})

document.addEventListener('keyup', (e) => {
  keysDown.delete(e.key)
})

function processInput() {
  if (finished || player.animating) return

  if (keysDown.has('w') || keysDown.has('ArrowUp')) moveForward()
  else if (keysDown.has('s') || keysDown.has('ArrowDown')) moveBackward()
  else if (keysDown.has('a')) strafeLeft()
  else if (keysDown.has('d')) strafeRight()
}

// ── New / Reset ────────────────────────────────────────────
function generateNewMaze() {
  finished = false
  id = generateId(6)
  Math.seedrandom(id)
  cells = newMaze(width, height)
  buildWalls()

  player.col = 0
  player.row = 0
  player.facing = findOpenFacing(0, 0)
  player.animating = false
  moves = 0
  if (movesEl) movesEl.innerHTML = moves
  if (victoryModal) victoryModal.classList.add('hidden')

  // Reset exit marker
  exitMarker.position.set(
    (width - 1) * CELL_SIZE + CELL_SIZE / 2,
    0,
    (height - 1) * CELL_SIZE + CELL_SIZE / 2
  )

  updateCamera()
  resetTimer()
}

function resetMaze() {
  finished = false
  player.col = 0
  player.row = 0
  player.facing = findOpenFacing(0, 0)
  player.animating = false
  moves = 0
  if (movesEl) movesEl.innerHTML = moves
  if (victoryModal) victoryModal.classList.add('hidden')
  updateCamera()
  resetTimer()
}

document.querySelector('#new-maze')?.addEventListener('click', generateNewMaze)
document.querySelector('#reset-maze')?.addEventListener('click', resetMaze)
document.querySelector('#victory-new')?.addEventListener('click', generateNewMaze)

// D-pad controls
document.querySelector('.top')?.addEventListener('click', moveForward)
document.querySelector('.bottom')?.addEventListener('click', moveBackward)
document.querySelector('.left')?.addEventListener('click', rotateLeft)
document.querySelector('.right')?.addEventListener('click', rotateRight)

// ── Ambient Audio ──────────────────────────────────────────
// Synthesized wind via filtered brown noise — no asset hosting.
// Started on first user gesture (autoplay policy). Mute persists.

const audio = (() => {
  const TARGET = 0.045
  let ctx, gain, started = false
  let muted = localStorage.getItem('corn-audio-muted') === 'true'

  function start() {
    if (started) return
    started = true
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()

    // Brown noise (integrated white) for low rumble
    const bufLen = 2 * ctx.sampleRate
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < bufLen; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    noise.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 600
    filter.Q.value = 0.6

    gain = ctx.createGain()
    gain.gain.value = muted ? 0 : TARGET

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    noise.start()

    // Slow LFO on filter cutoff → gusts
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.11
    const lfoG = ctx.createGain()
    lfoG.gain.value = 320
    lfo.connect(lfoG)
    lfoG.connect(filter.frequency)
    lfo.start()

    // Slower LFO on gain → breathing
    const lfo2 = ctx.createOscillator()
    lfo2.type = 'sine'
    lfo2.frequency.value = 0.06
    const lfo2G = ctx.createGain()
    lfo2G.gain.value = TARGET * 0.35
    lfo2.connect(lfo2G)
    lfo2G.connect(gain.gain)
    lfo2.start()
  }

  function toggle() {
    if (!started) start()
    muted = !muted
    localStorage.setItem('corn-audio-muted', muted ? 'true' : 'false')
    if (gain) {
      gain.gain.cancelScheduledValues(ctx.currentTime)
      gain.gain.linearRampToValueAtTime(muted ? 0 : TARGET, ctx.currentTime + 0.25)
    }
    return muted
  }

  return { start, toggle, isMuted: () => muted }
})()

const muteBtn = document.createElement('button')
muteBtn.className = 'corn-audio-toggle'
muteBtn.textContent = audio.isMuted() ? 'audio: off' : 'audio: on'
muteBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  muteBtn.textContent = audio.toggle() ? 'audio: off' : 'audio: on'
  muteBtn.blur()
})
document.querySelector('.corn-maze-wrapper')?.appendChild(muteBtn)

document.addEventListener('keyup', (e) => {
  if (e.key === 'm' || e.key === 'M') {
    muteBtn.textContent = audio.toggle() ? 'audio: off' : 'audio: on'
  }
})

// Resume audio on first interaction
function _firstInput() {
  audio.start()
  document.removeEventListener('keydown', _firstInput)
  document.removeEventListener('pointerdown', _firstInput)
}
document.addEventListener('keydown', _firstInput)
document.addEventListener('pointerdown', _firstInput)

// ── Resize ─────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const s = getContainerSize()
  camera.aspect = s.w / s.h
  camera.updateProjectionMatrix()
  renderer.setSize(s.w, s.h)
})

// ── Render Loop ────────────────────────────────────────────
function render(time) {
  requestAnimationFrame(render)
  animateExitMarker(time)
  animateCornSway(time)
  // Skybox follows camera
  if (skybox) {
    skybox.position.x = camera.position.x
    skybox.position.z = camera.position.z
  }
  renderer.render(scene, camera)
  drawMinimap()
}

// ── Init ───────────────────────────────────────────────────
buildWalls()
updateCamera()
requestAnimationFrame(render)
