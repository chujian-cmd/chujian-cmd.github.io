class StringArt {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.scale = 2;
    this.pins = [];
    this.strings = []; // Array of {from: pinIndex, to: pinIndex, color: string}
    this.currentThread = null; // Current pin index we're threading from
    this.selectedPinIndex = null;
    this.isDraggingPin = false;
    this.draggedPinIndex = null;

    this.bgColor = '#ffffff';
    this.threadColor = '#000000';
    this.pinRadius = 5;
    this.showPins = true;
    this.showImage = true;

    this.referenceImage = null;
    this.imageOpacity = 0.3;

    this.mode = 'autopin'; // 'pin', 'string', or 'autopin'
    this.autoConnectDistance = 80; // pixels
  }

  initialize() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');

    const wrapper = document.querySelector('.canvas-wrapper');
    const rect = wrapper.getBoundingClientRect();

    this.width = rect.width - 40;
    this.height = rect.height - 40;

    this.canvas.width = this.width * this.scale;
    this.canvas.height = this.height * this.scale;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';

    this.ctx.scale(this.scale, this.scale);

    this.setupEvents();
    this.setupDropZone();
    this.render();

    // Hide tip after first interaction
    this.canvas.addEventListener('pointerdown', () => {
      const tip = document.querySelector('.tip');
      if (tip) tip.style.opacity = '0';
    }, { once: true });
  }

  setupEvents() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
    this.canvas.addEventListener('pointerleave', this.onPointerUp.bind(this));
  }

  setupDropZone() {
    const wrapper = document.querySelector('.canvas-wrapper');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      wrapper.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      wrapper.addEventListener(eventName, () => {
        wrapper.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      wrapper.addEventListener(eventName, () => {
        wrapper.classList.remove('drag-over');
      });
    });

    wrapper.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('image/')) {
        this.loadImage(files[0]);
      }
    });
  }

  loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.referenceImage = img;
        this.showImage = true;
        document.querySelector('.image-toggle').classList.add('active');
        document.querySelector('.image-controls').classList.add('has-image');
        this.render();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  clearImage() {
    this.referenceImage = null;
    this.showImage = false;
    document.querySelector('.image-toggle').classList.remove('active');
    document.querySelector('.image-controls').classList.remove('has-image');
    this.render();
  }

  getCanvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  findPinAt(x, y, threshold = 15) {
    for (let i = 0; i < this.pins.length; i++) {
      const pin = this.pins[i];
      const dist = Math.hypot(pin.x - x, pin.y - y);
      if (dist < threshold) {
        return i;
      }
    }
    return -1;
  }

  findPinsWithinDistance(x, y, distance) {
    const nearby = [];
    for (let i = 0; i < this.pins.length; i++) {
      const pin = this.pins[i];
      const dist = Math.hypot(pin.x - x, pin.y - y);
      if (dist <= distance && dist > 0) {
        nearby.push({ index: i, distance: dist });
      }
    }
    // Sort by distance
    nearby.sort((a, b) => a.distance - b.distance);
    return nearby;
  }

  stringExists(from, to) {
    return this.strings.some(s =>
      (s.from === from && s.to === to) || (s.from === to && s.to === from)
    );
  }

  onPointerDown(e) {
    const point = this.getCanvasPoint(e);
    const pinIndex = this.findPinAt(point.x, point.y);

    if (this.mode === 'pin') {
      if (pinIndex >= 0) {
        // Start dragging existing pin
        this.isDraggingPin = true;
        this.draggedPinIndex = pinIndex;
        this.canvas.setPointerCapture(e.pointerId);
      } else {
        // Add new pin
        this.pins.push({ x: point.x, y: point.y });
        this.render();
      }
    } else if (this.mode === 'autopin') {
      if (pinIndex >= 0) {
        // Clicked existing pin - start dragging
        this.isDraggingPin = true;
        this.draggedPinIndex = pinIndex;
        this.canvas.setPointerCapture(e.pointerId);
      } else {
        // Add new pin and auto-connect to nearby pins
        const newPinIndex = this.pins.length;
        this.pins.push({ x: point.x, y: point.y });

        // Find and connect to nearby pins
        const nearby = this.findPinsWithinDistance(point.x, point.y, this.autoConnectDistance);
        for (const { index } of nearby) {
          if (!this.stringExists(newPinIndex, index)) {
            this.strings.push({
              from: newPinIndex,
              to: index,
              color: this.threadColor
            });
          }
        }
        this.render();
      }
    } else if (this.mode === 'string') {
      if (pinIndex >= 0) {
        if (this.currentThread === null) {
          // Start new thread
          this.currentThread = pinIndex;
          this.selectedPinIndex = pinIndex;
        } else if (pinIndex === this.currentThread) {
          // Clicked same pin - end thread
          this.currentThread = null;
          this.selectedPinIndex = null;
        } else {
          // Connect to this pin
          if (!this.stringExists(this.currentThread, pinIndex)) {
            this.strings.push({
              from: this.currentThread,
              to: pinIndex,
              color: this.threadColor
            });
          }
          this.currentThread = pinIndex;
          this.selectedPinIndex = pinIndex;
        }
        this.render();
      }
    }
  }

  onPointerMove(e) {
    if (this.isDraggingPin && this.draggedPinIndex !== null) {
      const point = this.getCanvasPoint(e);
      this.pins[this.draggedPinIndex].x = point.x;
      this.pins[this.draggedPinIndex].y = point.y;
      this.render();
    }
  }

  onPointerUp(e) {
    this.isDraggingPin = false;
    this.draggedPinIndex = null;
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'pin' || mode === 'autopin') {
      this.currentThread = null;
      this.selectedPinIndex = null;
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'pointer';
    }
    this.render();
  }

  setAutoConnectDistance(distance) {
    this.autoConnectDistance = distance;
  }

  setThreadColor(color) {
    this.threadColor = color;
  }

  setBgColor(color) {
    this.bgColor = color;
    this.render();
  }

  togglePins() {
    this.showPins = !this.showPins;
    this.render();
    return this.showPins;
  }

  toggleImage() {
    if (!this.referenceImage) return false;
    this.showImage = !this.showImage;
    this.render();
    return this.showImage;
  }

  endThread() {
    this.currentThread = null;
    this.selectedPinIndex = null;
    this.render();
  }

  undo() {
    if (this.strings.length > 0) {
      this.strings.pop();
      this.render();
    } else if (this.pins.length > 0) {
      this.pins.pop();
      this.render();
    }
  }

  clear() {
    this.pins = [];
    this.strings = [];
    this.currentThread = null;
    this.selectedPinIndex = null;
    this.render();
    const tip = document.querySelector('.tip');
    if (tip) tip.style.opacity = '1';
  }

  render() {
    // Clear with background color
    this.ctx.fillStyle = this.bgColor;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw reference image if present
    if (this.referenceImage && this.showImage) {
      this.ctx.save();
      this.ctx.globalAlpha = this.imageOpacity;

      // Fit image to canvas while maintaining aspect ratio
      const imgAspect = this.referenceImage.width / this.referenceImage.height;
      const canvasAspect = this.width / this.height;

      let drawWidth, drawHeight, drawX, drawY;

      if (imgAspect > canvasAspect) {
        drawWidth = this.width;
        drawHeight = this.width / imgAspect;
        drawX = 0;
        drawY = (this.height - drawHeight) / 2;
      } else {
        drawHeight = this.height;
        drawWidth = this.height * imgAspect;
        drawX = (this.width - drawWidth) / 2;
        drawY = 0;
      }

      this.ctx.drawImage(this.referenceImage, drawX, drawY, drawWidth, drawHeight);
      this.ctx.restore();
    }

    // Draw strings
    this.ctx.lineCap = 'round';
    for (const string of this.strings) {
      const fromPin = this.pins[string.from];
      const toPin = this.pins[string.to];
      if (fromPin && toPin) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = string.color;
        this.ctx.lineWidth = 0.5;
        this.ctx.globalAlpha = 0.7;
        this.ctx.moveTo(fromPin.x, fromPin.y);
        this.ctx.lineTo(toPin.x, toPin.y);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1;
      }
    }

    // Draw pins
    if (this.showPins) {
      for (let i = 0; i < this.pins.length; i++) {
        const pin = this.pins[i];
        const isSelected = i === this.selectedPinIndex;

        this.ctx.beginPath();
        this.ctx.arc(pin.x, pin.y, isSelected ? this.pinRadius + 2 : this.pinRadius, 0, Math.PI * 2);

        // Pin fill
        if (isSelected) {
          this.ctx.fillStyle = '#ff6b6b';
        } else {
          this.ctx.fillStyle = this.bgColor === '#ffffff' ? '#ccc' : '#444';
        }
        this.ctx.fill();

        // Pin border
        if (isSelected) {
          this.ctx.strokeStyle = '#ff6b6b';
        } else {
          this.ctx.strokeStyle = this.bgColor === '#ffffff' ? '#999' : '#666';
        }
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }
    }
  }

  // Get canvas data for saving (without pins)
  getSaveCanvas() {
    const saveCanvas = document.createElement('canvas');
    saveCanvas.width = this.width * this.scale;
    saveCanvas.height = this.height * this.scale;
    const saveCtx = saveCanvas.getContext('2d');
    saveCtx.scale(this.scale, this.scale);

    // Background
    saveCtx.fillStyle = this.bgColor;
    saveCtx.fillRect(0, 0, this.width, this.height);

    // Strings only (no pins, no reference image)
    saveCtx.lineCap = 'round';
    for (const string of this.strings) {
      const fromPin = this.pins[string.from];
      const toPin = this.pins[string.to];
      if (fromPin && toPin) {
        saveCtx.beginPath();
        saveCtx.strokeStyle = string.color;
        saveCtx.lineWidth = 0.5;
        saveCtx.globalAlpha = 0.7;
        saveCtx.moveTo(fromPin.x, fromPin.y);
        saveCtx.lineTo(toPin.x, toPin.y);
        saveCtx.stroke();
      }
    }

    return saveCanvas;
  }
}

window.StringArt = StringArt;
