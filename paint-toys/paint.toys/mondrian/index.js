;(() => {

  const scale = 2
  const canvas = document.querySelector("#canvas")
  const context = canvas.getContext("2d")

  var canvasWrapper = document.querySelector('.canvas-wrapper')
  const canvasRect = canvasWrapper.getBoundingClientRect()

  canvas.width = (canvasRect.width - 40) * scale
  canvas.height = (canvasRect.height - 40) * scale

  context.scale(scale, scale);

  context.lineWidth = 10
  let rectangles = []
  let splitDirectionVertical = true

  canvas.addEventListener("click", onRectangleClick)

  function drawRectangles() {
    rectangles.forEach((rectangle) => {
      context.fillStyle = rectangle.color
      context.beginPath()
      context.rect(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
      context.closePath()
      context.fill()
      context.stroke()
    })
  }

  function onRectangleClick(event) {

    document.querySelector('.tip').style.display = 'none'

    const eventObject = (event.touches && event.touches.item(0)) || event
    let e = {}

    e.x = eventObject.clientX - (20 + canvasRect.left);
    e.y = eventObject.clientY  - (20 + canvasRect.top);

    const clickedIndex = rectangles.findIndex((rectangle) => {
      if (
        e.x > rectangle.x &&
        e.x < rectangle.x + rectangle.width &&
        e.y > rectangle.y &&
        e.y < rectangle.y + rectangle.height
      ) {
        return true
      }
    })

    if (clickedIndex === -1) {
      splitDirectionVertical = !splitDirectionVertical
      return
    }

    const clickedRectangle = rectangles[clickedIndex]

    rectangles.splice(clickedIndex, 1)

    splitRectangleAt(clickedRectangle, {
      x: e.x - clickedRectangle.x,
      y: e.y - clickedRectangle.y,
    })
  }

  function splitRectangleAt(rectangle, position) {
    if (splitDirectionVertical) {
      rectangles.push({
        x: rectangle.x,
        y: rectangle.y,
        width: position.x,
        height: rectangle.height,
        color: getColor(),
      })
      rectangles.push({
        x: rectangle.x + position.x,
        y: rectangle.y,
        width: rectangle.width - position.x,
        height: rectangle.height,
        color: getColor(),
      })
    } else {
      rectangles.push({
        x: rectangle.x,
        y: rectangle.y,
        width: rectangle.width,
        height: position.y,
        color: getColor(),
      })
      rectangles.push({
        x: rectangle.x,
        y: rectangle.y + position.y,
        width: rectangle.width,
        height: rectangle.height - position.y,
        color: getColor(),
      })
    }

    splitDirectionVertical = !splitDirectionVertical
    drawRectangles()
  }

  function getColor() {
    const colors = [
      "#EBEBED",
      "#EBEBED",
      "#EBEBED",
      "#EBEBED",
      "#EBEBED",
      "#EBEBED",
      "#EBEBED",
      "#EBEBED",
      "#EBEBED",
      "#EBEBED",
      "#C53632",
      "#3E4984",
      "#F8DD67",
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  rectangles.push({
    x: -5,
    y: -5,
    width: canvas.width / scale + 10,
    height:canvas.height/ scale + 10,
    color: "#EBEBED",
  })

  window.resetRectangles = () => {
    rectangles = []
    rectangles.push({
      x: -5,
      y: -5,
      width: canvas.width / scale + 10,
      height:canvas.height/ scale + 10,
      color: "#EBEBED",
    })
    drawRectangles()
  }
  
  drawRectangles()
})()
