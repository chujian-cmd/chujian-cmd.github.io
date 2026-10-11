/*
    lets a user draw on an svg element.
    https://github.com/naknomum/scribby
       h/t  https://stackoverflow.com/a/40700068  for the smoothness
*/

function removeAllChildNodes(parent) {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}

class Scribby {
  constructor(svgEl) {
    this.version = "1.1";
    this.svgEl = svgEl;
    this.path = null;
    this.buffer = [];
    this.strPath = null;
    this._undid = [];

    this.lastPath = null;

    this.bufferSize = 10;
    this.attrFill = "none";
    this.attrStroke = "#000";
    this.attrStrokeWidth = 3;
    this.canvasWrapper = document.querySelector('.canvas-wrapper')
    this.init();
  }

  init() {
    var me = this;
    this.overlay = document.querySelector(".overlay");
    this.svgEl.addEventListener("mousedown", this.eventDown.bind(this), false);
    this.svgEl.addEventListener("touchstart", this.eventDown.bind(this), false);
    this.svgEl.addEventListener("mousemove", this.eventMove.bind(this), false);
    this.svgEl.addEventListener("touchmove", this.eventMove.bind(this), false);
    this.svgEl.addEventListener("mouseup", this.eventUp.bind(this), false);
    this.svgEl.addEventListener("touchend", this.eventUp.bind(this), false);
  }

  eventMove(ev) {
    if (this.path) {
      ev.stopPropagation();
      ev.preventDefault();
      this.appendToBuffer(this.getMousePosition(ev));
      this.updateSvgPath();
    }
  }

  eventDown(ev) {
    ev.stopPropagation();
    ev.preventDefault();

    if (this.lastPath) {
      this.lastPath.style.opacity = 0.2;
    }

    this.path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    this.path.setAttribute("fill", this.attrFill);
    this.path.setAttribute("stroke", this.attrStroke);
    this.path.setAttribute("stroke-width", this.attrStrokeWidth);
    this.path.setAttribute("stroke-linecap", "round");

    var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if(!isSafari) {
      this.path.setAttribute("filter", "url(#noise)");
    }

    
    this.buffer = [];
    var pt = this.getMousePosition(ev);
    this.appendToBuffer(pt);
    this.strPath =
      "M" + this.nicerDecimal(pt.x) + " " + this.nicerDecimal(pt.y);
    this.path.setAttribute("d", this.strPath);

    this.svgEl.appendChild(this.path);
  }

  eventUp(ev) {
    if (!this.path) return false;

    if (this.lastPath) {
      this.svgEl.removeChild(this.lastPath);
    }
    if (this.overlay) {
      this.canvasWrapper.removeChild(this.overlay);
      this.overlay = null;
    }
    this.lastPath = this.path;

    if (!this.path.getTotalLength()) {
      //empty path cuz was just click
      this.svgEl.lastElementChild.remove();
      this.path = null;
      return false;
    }
    this.path = null;
    return true;
  }

  //these are some utility functions
  getMousePosition(ev) {
    var rect = this.svgEl.getBoundingClientRect();

    let width = this.svgEl.width.baseVal.value;
    let height = this.svgEl.height.baseVal.value;

    if (ev.pageX && ev.pageY)
      return {
        x: ((ev.pageX - rect.left) / rect.width) * width,
        y: ((ev.pageY - rect.top) / rect.height) * height,
      };
    if (ev.targetTouches.length)
      return {
        x: ((ev.targetTouches[0].pageX - rect.left) / rect.width) * width,
        y: ((ev.targetTouches[0].pageY - rect.top) / rect.height) * height,
      };
    return { x: 0, y: 0 }; //oops?
  }

  appendToBuffer(pt) {
    this.buffer.push(pt);
    while (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
  }

  // Calculate the average point, starting at offset in the buffer
  getAveragePoint(offset) {
    var len = this.buffer.length;
    if (len % 2 === 1 || len >= this.bufferSize) {
      var totalX = 0;
      var totalY = 0;
      var pt, i;
      var count = 0;
      for (i = offset; i < len; i++) {
        count++;
        pt = this.buffer[i];
        totalX += pt.x;
        totalY += pt.y;
      }
      return {
        x: totalX / count,
        y: totalY / count,
      };
    }
    return null;
  }

  nicerDecimal(d) {
    return Math.floor(d * 100) / 100;
  }

  updateSvgPath() {
    var pt = this.getAveragePoint(0);
    if (pt) {
      // Get the smoothed part of the path that will not change
      this.strPath +=
        " L" + this.nicerDecimal(pt.x) + " " + this.nicerDecimal(pt.y);
      // Get the last part of the path (close to the current mouse position)
      // This part will change if the mouse moves again
      var tmpPath = "";
      for (var offset = 2; offset < this.buffer.length; offset += 2) {
        pt = this.getAveragePoint(offset);
        tmpPath +=
          " L" + this.nicerDecimal(pt.x) + " " + this.nicerDecimal(pt.y);
      }
      // Set the complete current path coordinates
      this.path.setAttribute("d", this.strPath + tmpPath);
    }
  }
}
