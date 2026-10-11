
let mazePage = document.querySelector(".maze-page")
const size = mazePage.getAttribute("data-size")
const mazeName = mazePage.getAttribute("data-name")
const timeData = mazePage.getAttribute("data-time")

const victoryModal = document.querySelector('.victory')
const victoryCompleteEl = document.querySelector('#victory-complete-span')

let width = parseInt(size)
let height = parseInt(size)
let totalTime = parseInt(timeData) * 60 * 1000 // Total Time as MS

const [N, S, E, W] = [1, 2, 4, 8]
const scale = 1
const blockWidth = 20
const blockHeight = 20
let grid = []
let start = { x: 0, y: 0 }
let end = { x: width - 1, y: height - 1 }

let tomImg = new Image()
tomImg.onload = drawAll
tomImg.src = '/pixel-tomato.png'

let path = []
path.push(start)

for (let i = 0; i < height; i++) {
  grid[i] = new Array(width).fill(0)
}

let moves = 0
let complete = 0
let movesEl = document.querySelector('#moves-span')
let completeEl = document.querySelector('#complete-span')

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

function generateNewMaze() {

  id = generateId(6)
  Math.seedrandom(id)

  cells = newMaze(size, size)
  setup(grid)
  moves = 0
  complete = 0
  completeEl.innerHTML = 0

  path = []
  path.push(start)

  resetTimer()
  drawAll()
}

function justGenerateNewMaze() {
  id = generateId(6)
  Math.seedrandom(id)
  cells = newMaze(size, size)
  setup(grid)
  drawAll()
}

function resetMaze() {
  moves = 0
  complete = 0
  completeEl.innerHTML = complete
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

  context.lineWidth = 2
}

function draw() {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let topModifier = 0
      let bottomModifier = 0
      let leftModifier = 0
      let rightModifier = 0
      context.lineWidth = 2

      if (y === 0) {
        topModifier = context.lineWidth / 2
      }

      if (x === 0) {
        leftModifier = context.lineWidth / 2
      }

      if (y === height - 1) {
        bottomModifier = (-1 * context.lineWidth) / 2
      }

      if (x === width - 1) {
        rightModifier = (-1 * context.lineWidth) / 2
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
  let moved = false

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

    if(moves === 0 && !startTime) {
      startTimer()
    }

    if (newPos.x === end.x && newPos.y === end.y) {
      win()
    }
  }
  
  moves++
  drawAll()
}

let startTime, animationFrame
let timeElement = document.querySelector('#time-span')
function startTimer() {
  startTime = Date.now()
  animationFrame = window.requestAnimationFrame(tick)
}

function tick() {
  time = Date.now() - startTime

  let ticTime = totalTime - time
  if(ticTime < 0) {
    endAndShowVictoryModal()
    return
  }

  timeElement.innerHTML = msToTime(ticTime)
  animationFrame = window.requestAnimationFrame(tick)
}

function msToTime(duration) {
  let seconds = Math.floor((duration / 1000) % 60)
  let minutes = Math.floor((duration / (1000 * 60)) % 60)

  if (minutes) {
    return minutes + "m " + seconds + "s"
  } else {
    return seconds + "s"
  }
}

function resetTimer() {
  victoryModal.classList.add('hidden')
  cancelAnimationFrame(animationFrame)
  startTime = null
  timeElement.innerHTML = timeData + "m"
}


function win() {

  // Reset Path to end, swap end and start
  path = [{ x: end.x, y: end.y }]
  let temp = end
  end = start
  start = temp

  // Add to Complete counter
  complete++
  completeEl.innerHTML = complete
  justGenerateNewMaze()
}

function endAndShowVictoryModal() {
  cancelAnimationFrame(animationFrame)

  victoryCompleteEl.innerHTML = complete
  victoryModal.classList.remove('hidden')
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

document.querySelector('.left').addEventListener('click', () => tryMove('left'))
document.querySelector('.right').addEventListener('click', () => tryMove('right'))
document.querySelector('.bottom').addEventListener('click', () => tryMove('down'))
document.querySelector('.top').addEventListener('click', () => tryMove('up'))

document.querySelector('#new-maze').addEventListener('click', generateNewMaze)
document.querySelector('#victory-new').addEventListener('click', generateNewMaze)

let el = document.querySelector(".output")
let cells = newMaze(size, size)

function drawAll() {
  preDraw()
  drawPath()
  draw()
}

setup(grid)
drawAll()