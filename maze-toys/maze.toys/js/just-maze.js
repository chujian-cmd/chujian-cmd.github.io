const size = document.querySelector(".maze-page").getAttribute("data-size")
const mazeName = document.querySelector(".maze-page").getAttribute("data-name")

const victoryModal = document.querySelector('.victory')
const victoryTimeEl = document.querySelector('#victory-time-span')
const victoryMovesEl = document.querySelector('#victory-moves-span')

const mazeType = 'just-maze'
const saveKey = `${mazeName}-${mazeType}`

let width = parseInt(size)
let height = parseInt(size)

const [N, S, E, W] = [1, 2, 4, 8]
const scale =  width < 75 ? 1 : 2
const blockWidth = width < 75 ? 20 : 14
const blockHeight = height < 75 ? 20 : 14
let grid = []
const start = { x: 0, y: 0 }
const end = { x: width - 1, y: height - 1 }
let finsihed = false

let tomImg = new Image()
tomImg.onload = drawAll
tomImg.src = '/pixel-tomato.png'

let path = []
path.push(start)

for (let i = 0; i < height; i++) {
  grid[i] = new Array(width).fill(0)
}

let steps = []

let stack = 0
let moves = 0
let movesEl = document.querySelector('#moves-span')

function getCurrentDate() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const date = new Date();
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const formattedDate = `${month} ${day} ${year}`;
  return formattedDate;
}

function dec2hex(dec) {
  return dec.toString(16).padStart(2, "0")
}

function generateId(len) {
  var arr = new Uint8Array((len || 40) / 2)
  window.crypto.getRandomValues(arr)
  return Array.from(arr, dec2hex).join("")
}

const segments = new URL(window.location.href).pathname.split("/")
const nameId = segments.indexOf(mazeName)
let id = segments[nameId + 1] || generateId(6)

let isDaily = false
if(id === 'daily') {
  isDaily = true
  id = getCurrentDate()
  updateVisualStreakData()
}

Math.seedrandom(id)

function updateVisualStreakData() {
  if(isDaily) {
    let currentStreakData = window.dontcheat.getCurrentStreak(saveKey)

    console.log(currentStreakData)
      
    let todayStreakEl = document.querySelector('#streak-today-span')
    let currentStreakEl = document.querySelector('#streak-current-span')
    let longestStreakEl = document.querySelector('#streak-longest-span')

    // let victoryModalStreakSpan = document.querySelector('#victory-streak')

    todayStreakEl.innerHTML = currentStreakData.hasCompletedToday ? '✔' : '✘'
    todayStreakEl.style.color = currentStreakData.hasCompletedToday ? 'limegreen' : 'red'
    currentStreakEl.innerHTML = currentStreakData.streak
    longestStreakEl.innerHTML = currentStreakData.longestStreak
    
    // victoryModalStreakSpan.innerHTML = currentStreakData.streak
  }
}

let queue = []
function generateNewMaze() {

  finsihed = false
  id = generateId(6)
  Math.seedrandom(id)

  cells = newMaze(size, size)
  setup(grid)
  steps = []
  stack = 0
  moves = 0
  if (movesEl) movesEl.innerHTML = moves

  path = []
  path.push(start)

  resetTimer()
  drawAll()
}

function resetMaze() {
  stack = 0
  moves = 0
  finsihed = false
  if (movesEl) movesEl.innerHTML = moves
  path = []
  path.push(start)
  resetTimer()
  drawAll()
}

function newMaze(x, y) {
  // Establish variables and starting grid
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

  // Set a random position to start from
  var currentCell = [
    Math.floor(Math.random() * y),
    Math.floor(Math.random() * x),
  ]
  var path = [currentCell]
  unvis[currentCell[0]][currentCell[1]] = false
  var visited = 1

  // Loop through all available cell positions
  while (visited < totalCells) {
    // Determine neighboring cells
    var pot = [
      [currentCell[0] - 1, currentCell[1], 0, 2],
      [currentCell[0], currentCell[1] + 1, 1, 3],
      [currentCell[0] + 1, currentCell[1], 2, 0],
      [currentCell[0], currentCell[1] - 1, 3, 1],
    ]
    var neighbors = new Array()

    // Determine if each neighboring cell is in game grid, and whether it has already been checked
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

    // If at least one active neighboring cell has been found
    if (neighbors.length) {
      // Choose one of the neighbors at random
      next = neighbors[Math.floor(Math.random() * neighbors.length)]

      // Remove the wall between the current cell and the chosen neighboring cell
      cells[currentCell[0]][currentCell[1]][next[2]] = 1
      cells[next[0]][next[1]][next[3]] = 1

      // Mark the neighbor as visited, and set it as the current cell
      unvis[next[0]][next[1]] = false
      visited++
      currentCell = [next[0], next[1]]
      path.push(currentCell)
    }
    // Otherwise go back up a step and keep going
    else {
      currentCell = path.pop()
    }
  }
  return cells
}

function setup() {
  for (let y = 0; y < height; y++) {
    let row = []

    for (let x = 0; x < width; x++) {
      let cell = {
        top: true,
        left: true,
        right: true,
        bottom: true,
      }

      if (y === 0) {
        cell.top = false
      } else if (y === height - 1) {
        cell.bottom = false
      }

      if (x === 0) {
        cell.left = false
      } else if (x === width - 1) {
        cell.right = false
      }

      if ((grid[y][x] & S) === 0) {
        cell.bottom = false
      }

      if ((grid[y][x] & E) !== 0) {
        if (((grid[y][x] | grid[y][x + 1]) & S) === 0) {
          cell.bottom = false
        }
      } else {
        cell.right = false
      }

      row.push(cell)
    }

    cells.push(row)
  }
}

function preDraw() {
  canvas = document.querySelector("#canvas")
  context = canvas.getContext("2d")

  canvas.width = grid[0].length * blockWidth * scale
  canvas.height = grid.length * blockHeight * scale
  context.scale(scale, scale)

  context.lineWidth = scale * 2
}

function draw() {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let topModifier = 0
      let bottomModifier = 0
      let leftModifier = 0
      let rightModifier = 0
      context.lineWidth = scale + 1

      if (y === 0) {
        topModifier = (scale + 1) / 2
      }

      if (x === 0) {
        leftModifier = (scale + 1) / 2
      }

      if (y === height - 1) {
        bottomModifier = (-1 * (scale + 1)) / 2
      }

      if (x === width - 1) {
        rightModifier = (-1 * (scale + 1)) / 2
      }

      if (cells[y][x][0] === 0) {
        context.beginPath()
        context.moveTo(x * blockWidth, y * blockHeight + topModifier)
        context.lineTo((x + 1) * blockWidth, y * blockHeight + topModifier)
        context.closePath()
        context.stroke()
      }

      if (cells[y][x][2] === 0) {
        context.beginPath()
        context.moveTo(x * blockWidth, (y + 1) * blockHeight + bottomModifier)
        context.lineTo(
          (x + 1) * blockWidth,
          (y + 1) * blockHeight + bottomModifier
        )
        context.closePath()
        context.stroke()
      }

      if (cells[y][x][3] === 0) {
        context.beginPath()
        context.moveTo(x * blockWidth + leftModifier, y * blockHeight)
        context.lineTo(x * blockWidth + leftModifier, (y + 1) * blockHeight)
        context.closePath()
        context.stroke()
      }

      if (cells[y][x][1] === 0) {
        context.beginPath()
        context.moveTo((x + 1) * blockWidth + rightModifier, y * blockHeight)
        context.lineTo(
          (x + 1) * blockWidth + rightModifier,
          (y + 1) * blockHeight
        )
        context.closePath()
        context.stroke()
      }
    }
  }
}


function drawPath() {

  path.forEach((pathItem, index) => {
    context.fillStyle = "#ff0000"
    context.fillRect(
      pathItem.x * blockWidth,
      pathItem.y * blockHeight,
      blockWidth,
      blockHeight
    )
  })

  context.imageSmoothingEnabled = false;
  context.drawImage(tomImg, Math.floor((end.x) * blockWidth) + 2, Math.floor((end.y) * blockHeight) + 2, blockWidth - 4, blockHeight - 4)
}

function tryMove(direction) {
  if (finsihed) return
  let lastPos = path[path.length - 1]
  let secondToLastPos = path[path.length - 2]

  let currentCell = cells[lastPos.y][lastPos.x]

  let newPos

  if (direction === "down" && currentCell[2] !== 0) {
    newPos = { x: lastPos.x, y: lastPos.y + 1 }
  } else if (direction === "up" && currentCell[0] !== 0) {
    newPos = { x: lastPos.x, y: lastPos.y - 1 }
  } else if (direction === "right" && currentCell[1] !== 0) {
    newPos = { x: lastPos.x + 1, y: lastPos.y }
  } else if (direction === "left" && currentCell[3] !== 0) {
    newPos = { x: lastPos.x - 1, y: lastPos.y }
  }

  if (newPos) {
    if (
      secondToLastPos &&
      newPos.x === secondToLastPos.x &&
      newPos.y === secondToLastPos.y
    ) {
      path.pop()
    } else {
      path.push(newPos)
    }

    if (moves === 0 && !startTime) {
      startTimer()
    }

    moves++
    if (movesEl) movesEl.innerHTML = moves

    drawAll()

    if (newPos.x === end.x && newPos.y === end.y) {
      win()
    }
  }
}

let startTime, animationFrame
let timeElement = document.querySelector('#time-span')
function startTimer() {
  startTime = Date.now()
  animationFrame = window.requestAnimationFrame(tick)
}

function tick() {
  time = Date.now() - startTime
  if(timeElement) timeElement.innerHTML = msToTime(time)
  animationFrame = window.requestAnimationFrame(tick)
}

function msToTime(duration) {
  let seconds = Math.floor((duration / 1000) % 60)
  let minutes = Math.floor((duration / (1000 * 60)) % 60)
  let hours = Math.floor((duration / (1000 * 60 * 60)) % 24)

  if (hours) {
    return hours + "h " + minutes + "m " + seconds + "s"
  } else if (minutes) {
    return minutes + "m " + seconds + "s"
  } else {
    return seconds + "s"
  }
}

function resetTimer() {
  victoryModal.classList.add('hidden')
  cancelAnimationFrame(animationFrame)
  startTime = null
  if(timeElement) timeElement.innerHTML = "0s"
}

function win() {
  cancelAnimationFrame(animationFrame)
  finsihed = true

  if(victoryMovesEl) victoryMovesEl.innerHTML = moves
  if(victoryTimeEl) victoryTimeEl.innerHTML = msToTime(time)
  if(victoryModal) victoryModal.classList.remove('hidden')

  if (isDaily) {
    window.dontcheat.saveDaily(`${mazeName}-${mazeType}`, time, moves, id)
    updateVisualStreakData()
  }

  // Mark this maze size as completed (for progressive unlock)
  localStorage.setItem(`maze-completed-${mazeName}`, 'true')
}

function copyToClipboard(text) {
  if (window.clipboardData && window.clipboardData.setData) {
    // Internet Explorer-specific code path to prevent textarea being shown while dialog is visible.
    return window.clipboardData.setData("Text", text)
  } else if (
    document.queryCommandSupported &&
    document.queryCommandSupported("copy")
  ) {
    var textarea = document.createElement("textarea")
    textarea.textContent = text
    textarea.style.position = "fixed" // Prevent scrolling to bottom of page in Microsoft Edge.
    document.body.appendChild(textarea)
    textarea.select()
    try {
      return document.execCommand("copy") // Security exception may be thrown by some browsers.
    } catch (ex) {
      console.warn("Copy to clipboard failed.", ex)
      return prompt("Copy to clipboard: Ctrl+C, Enter", text)
    } finally {
      document.body.removeChild(textarea)
    }
  }
}

document.addEventListener("keydown", (e) => {
  const directionKeys = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "w", "a", "s", "d"]
  let key = e.key
  // At least dont scroll around on these
  if(directionKeys.includes(key)) {
    // console.log("stopping!")
    e.preventDefault()
    e.stopPropagation()
  }
})

document.addEventListener("keyup", (e) => {
  let key = e.key

  if (key === "ArrowDown" || key === "s") {
    tryMove("down")
  } else if (key === "ArrowUp" || key === "w") {
    tryMove("up")
  } else if (key === "ArrowRight" || key === "d") {
    tryMove("right")
  } else if (key === "ArrowLeft" || key === "a") {
    tryMove("left")
  }
})

function shareMaze(el) {

  let shareUrl = `https://maze.toys/mazes/${mazeName}/${id}`
  copyToClipboard(shareUrl)

  el.querySelector('.share-text').style.opacity = 0;
  el.querySelector('.shared-text').style.opacity = 1;

  setTimeout(() => {
    el.querySelector('.share-text').style.opacity = 1
    el.querySelector('.shared-text').style.opacity = 0
  }, 1500)
}

document.querySelector('.left')?.addEventListener('click', () => tryMove('left'))
document.querySelector('.right')?.addEventListener('click', () => tryMove('right'))
document.querySelector('.bottom')?.addEventListener('click', () => tryMove('down'))
document.querySelector('.top')?.addEventListener('click', () => tryMove('up'))

document.querySelector('#new-maze')?.addEventListener('click', generateNewMaze)
document.querySelector('#victory-new')?.addEventListener('click', generateNewMaze)

document.querySelector('#reset-maze').addEventListener('click', resetMaze)

const shareSluffleButton = document.querySelector('#share-maze')
shareSluffleButton?.addEventListener('click', (e) => {
  shareMaze(shareSluffleButton)
})

const victoryShareButton = document.querySelector('#victory-share')
victoryShareButton?.addEventListener('click', (e) => {
  shareMaze(victoryShareButton)
})

function printMaze() {
  const cellSize = 20
  const svgW = width * cellSize
  const svgH = height * cellSize
  const pad = 40
  const totalW = svgW + pad * 2
  const totalH = svgH + pad * 2 + 30
  const fontSize = Math.max(12, cellSize * 0.7)

  let lines = ''
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = pad + x * cellSize
      const py = pad + y * cellSize

      if (cells[y][x][0] === 0) {
        lines += `<line x1="${px}" y1="${py}" x2="${px + cellSize}" y2="${py}"/>`
      }
      if (cells[y][x][2] === 0) {
        lines += `<line x1="${px}" y1="${py + cellSize}" x2="${px + cellSize}" y2="${py + cellSize}"/>`
      }
      if (cells[y][x][3] === 0) {
        lines += `<line x1="${px}" y1="${py}" x2="${px}" y2="${py + cellSize}"/>`
      }
      if (cells[y][x][1] === 0) {
        lines += `<line x1="${px + cellSize}" y1="${py}" x2="${px + cellSize}" y2="${py + cellSize}"/>`
      }
    }
  }

  // A label at start
  const startX = pad + cellSize / 2
  const startY = pad + cellSize / 2
  lines += `<text x="${startX}" y="${startY + fontSize * 0.35}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="${fontSize}" fill="#333">A</text>`

  // B label at end
  const endX = pad + (width - 0.5) * cellSize
  const endY = pad + (height - 0.5) * cellSize
  lines += `<text x="${endX}" y="${endY + fontSize * 0.35}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="${fontSize}" fill="#333">B</text>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}">
    <rect width="${totalW}" height="${totalH}" fill="white"/>
    <g stroke="black" stroke-width="1.5" stroke-linecap="round">${lines}</g>
    <text x="${totalW / 2}" y="${totalH - 8}" text-anchor="middle" font-family="monospace" font-size="11" fill="#aaa">maze.toys</text>
  </svg>`

  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head><title>Print Maze - maze.toys</title>
    <style>
      html,body{margin:0;padding:0;width:100%;height:100%}
      body{display:flex;justify-content:center;align-items:center}
      svg{width:100%;height:auto;max-height:100vh;padding:10px;box-sizing:border-box}
      @media print{
        @page{margin:0.5in}
        svg{width:100%;height:auto;max-height:100%;padding:0}
      }
    </style>
    </head><body>${svg}</body></html>`)
  win.document.close()
  win.focus()
  win.print()
}

document.querySelector('#print-maze')?.addEventListener('click', printMaze)

let el = document.querySelector(".output")
let cells = newMaze(size, size)

function drawAll() {
  preDraw()
  drawPath()
  draw()
}

setup(grid)
drawAll()


