/**
 * Cruel Maze - Canvas-based Game with Thin Walls
 */

class CruelMazeGame {
    constructor() {
        this.storage = new MazeStorage();
        this.maze = null;
        this.playerPos = null;
        this.playerVisualPos = null; // For smooth animation
        this.moves = 0;
        this.trail = []; // {x, y, timestamp}
        this.trailDuration = 8000; // Trail fades over 8 seconds
        this.visibilityRadius = 4; // In cells
        this.sessionStartTime = null;
        this.timerInterval = null;
        this.gameComplete = false;
        this.completionTime = null;
        this.currentDate = getDateFromURL();
        this.isHistoricalGame = this.currentDate !== null;
        this.keyBuffer = '';

        // Canvas settings
        this.canvas = null;
        this.ctx = null;
        this.cellSize = 12; // Pixels per cell
        this.wallWidth = 4; // Walls
        this.renderLoop = null;
        this.fogPulse = 0; // For pulsing fog effect

        // Colors
        this.colors = {
            background: '#0a0a0f',
            wall: '#3a3a4a',
            path: '#101018',
            player: '#66ccbb',
            exit: '#ddaa66',
            trail: '#55bbaa',
            fog: '#0a0a0f'
        };
        this.buffer = 1; // Buffer from walls for player/trail

        this.init();
    }

    init() {
        // Validate historical date
        if (this.isHistoricalGame) {
            const selectedDate = new Date(this.currentDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (selectedDate > today) {
                window.location.href = '/maze/';
                return;
            }
        }

        // Check if already played today
        if (this.storage.hasPlayedToday() && !this.isHistoricalGame) {
            this.showCompletionState();
            return;
        }

        // Generate maze
        this.maze = getTodaysMaze(this.currentDate);
        this.playerPos = { ...this.maze.start };
        this.playerVisualPos = { x: this.playerPos.x, y: this.playerPos.y };
        this.trail = [{ x: this.playerPos.x, y: this.playerPos.y, time: Date.now() }];

        // Set up canvas
        this.setupCanvas();
        this.updateMazeNumber();
        this.updateMoves();
        this.setupEventListeners();
        this.startTimer();
        this.startRenderLoop();
    }

    setupCanvas() {
        const boardElement = document.getElementById('gameBoard');
        boardElement.innerHTML = '';

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'mazeCanvas';

        // Calculate canvas size
        const canvasWidth = this.maze.width * this.cellSize + this.wallWidth;
        const canvasHeight = this.maze.height * this.cellSize + this.wallWidth;

        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        this.canvas.style.maxWidth = '100%';
        this.canvas.style.height = 'auto';
        this.canvas.style.display = 'block';
        this.canvas.style.margin = '0 auto';
        this.canvas.style.borderRadius = '4px';

        boardElement.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // Add click handler
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    }

    render() {
        const ctx = this.ctx;
        const cellSize = this.cellSize;
        const wallWidth = this.wallWidth;

        // Clear canvas
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw each cell (without trails)
        for (let y = 0; y < this.maze.height; y++) {
            for (let x = 0; x < this.maze.width; x++) {
                this.drawCell(x, y);
            }
        }

        // Draw smooth trail overlay
        this.drawTrail();

        // Draw player at visual position
        this.drawPlayer();

        // Apply fog overlay
        this.drawFog();
    }

    drawPlayer() {
        if (!this.playerVisualPos) return;

        const ctx = this.ctx;
        const cellSize = this.cellSize;
        const wallWidth = this.wallWidth;

        const px = this.playerVisualPos.x * cellSize + wallWidth + this.buffer;
        const py = this.playerVisualPos.y * cellSize + wallWidth + this.buffer;
        const size = cellSize - wallWidth - this.buffer * 2;

        ctx.fillStyle = this.colors.player;
        ctx.fillRect(px, py, size, size);
    }

    drawCell(x, y) {
        const ctx = this.ctx;
        const cellSize = this.cellSize;
        const wallWidth = this.wallWidth;
        const cell = this.maze.cells[y][x];

        const px = x * cellSize + wallWidth;
        const py = y * cellSize + wallWidth;

        // Calculate distance for visibility check
        const distance = this.getDistance(x, y, this.playerPos.x, this.playerPos.y);
        const isVisible = distance <= this.visibilityRadius + 4;

        if (!isVisible) {
            return;
        }

        // Draw path background first
        ctx.fillStyle = this.colors.path;
        ctx.fillRect(px, py, cellSize - wallWidth, cellSize - wallWidth);

        // Check if exit - draw with buffer
        if (x === this.maze.end.x && y === this.maze.end.y) {
            ctx.fillStyle = this.colors.exit;
            ctx.fillRect(
                px + this.buffer,
                py + this.buffer,
                cellSize - wallWidth - this.buffer * 2,
                cellSize - wallWidth - this.buffer * 2
            );
        }

        // Draw walls
        ctx.fillStyle = this.colors.wall;

        // North wall
        if (cell.walls.north) {
            ctx.fillRect(px - wallWidth, py - wallWidth, cellSize, wallWidth);
        }
        // East wall
        if (cell.walls.east) {
            ctx.fillRect(px + cellSize - wallWidth, py - wallWidth, wallWidth, cellSize);
        }
        // South wall
        if (cell.walls.south) {
            ctx.fillRect(px - wallWidth, py + cellSize - wallWidth, cellSize, wallWidth);
        }
        // West wall
        if (cell.walls.west) {
            ctx.fillRect(px - wallWidth, py - wallWidth, wallWidth, cellSize);
        }
    }

    drawTrail() {
        if (this.trail.length < 2) return;

        const ctx = this.ctx;
        const cellSize = this.cellSize;
        const wallWidth = this.wallWidth;
        const now = Date.now();

        // Sort trail by time (oldest first)
        const sortedTrail = [...this.trail].sort((a, b) => a.time - b.time);

        // Draw trail as connected line segments with fading alpha
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const trailWidth = cellSize - wallWidth - this.buffer * 2;

        for (let i = 1; i < sortedTrail.length; i++) {
            const prev = sortedTrail[i - 1];
            const curr = sortedTrail[i];

            // Calculate alpha based on the older point's age
            const age = now - prev.time;
            const alpha = Math.max(0.05, 0.6 * (1 - age / this.trailDuration));

            // Get center positions
            const prevPx = prev.x * cellSize + wallWidth + (cellSize - wallWidth) / 2;
            const prevPy = prev.y * cellSize + wallWidth + (cellSize - wallWidth) / 2;
            const currPx = curr.x * cellSize + wallWidth + (cellSize - wallWidth) / 2;
            const currPy = curr.y * cellSize + wallWidth + (cellSize - wallWidth) / 2;

            // Only draw if adjacent (manhattan distance = 1)
            const dist = Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y);
            if (dist === 1) {
                ctx.beginPath();
                ctx.strokeStyle = this.hexToRgba(this.colors.trail, alpha);
                ctx.lineWidth = trailWidth;
                ctx.moveTo(prevPx, prevPy);
                ctx.lineTo(currPx, currPy);
                ctx.stroke();
            }
        }
    }

    drawFog() {
        const ctx = this.ctx;
        const cellSize = this.cellSize;
        const wallWidth = this.wallWidth;

        // Player position in pixels (center of cell) - use visual pos for smooth fog
        const vp = this.playerVisualPos || this.playerPos;
        const playerPx = vp.x * cellSize + wallWidth + (cellSize - wallWidth) / 2;
        const playerPy = vp.y * cellSize + wallWidth + (cellSize - wallWidth) / 2;

        // Pulsing effect - very subtle organic radius variation
        const pulseFactor = 1 + this.fogPulse * 0.02;

        // Visibility radius in pixels - tighter fog
        const innerRadius = (this.visibilityRadius + 0.5) * cellSize * pulseFactor;
        const outerRadius = (this.visibilityRadius + 2.5) * cellSize * pulseFactor;

        // Create radial gradient for fog - lighter
        const gradient = ctx.createRadialGradient(
            playerPx, playerPy, innerRadius,
            playerPx, playerPy, outerRadius
        );
        gradient.addColorStop(0, 'rgba(10, 10, 15, 0)');
        gradient.addColorStop(0.5, 'rgba(10, 10, 15, 0.3)');
        gradient.addColorStop(0.8, 'rgba(10, 10, 15, 0.55)');
        gradient.addColorStop(1, 'rgba(10, 10, 15, 0.85)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Full darkness outside outer radius
        ctx.beginPath();
        ctx.rect(0, 0, this.canvas.width, this.canvas.height);
        ctx.arc(playerPx, playerPy, outerRadius, 0, Math.PI * 2, true);
        ctx.fillStyle = this.colors.fog;
        ctx.fill();
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    getDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    }

    handleCanvasClick(e) {
        if (this.gameComplete) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Convert to cell coordinates
        const cellX = Math.floor((clickX - this.wallWidth) / this.cellSize);
        const cellY = Math.floor((clickY - this.wallWidth) / this.cellSize);

        // Check if adjacent and no wall between
        if (this.canMoveTo(cellX, cellY)) {
            this.movePlayer(cellX - this.playerPos.x, cellY - this.playerPos.y);
        }
    }

    canMoveTo(x, y) {
        if (x < 0 || x >= this.maze.width || y < 0 || y >= this.maze.height) return false;

        const dx = x - this.playerPos.x;
        const dy = y - this.playerPos.y;

        // Must be adjacent (cardinal only)
        if (Math.abs(dx) + Math.abs(dy) !== 1) return false;

        // Check wall
        const currentCell = this.maze.cells[this.playerPos.y][this.playerPos.x];
        if (dx === 1 && currentCell.walls.east) return false;
        if (dx === -1 && currentCell.walls.west) return false;
        if (dy === 1 && currentCell.walls.south) return false;
        if (dy === -1 && currentCell.walls.north) return false;

        return true;
    }

    movePlayer(dx, dy) {
        if (this.gameComplete) return;

        const newX = this.playerPos.x + dx;
        const newY = this.playerPos.y + dy;

        if (!this.canMoveTo(newX, newY)) return;

        // Move player
        this.playerPos.x = newX;
        this.playerPos.y = newY;
        this.moves++;

        const now = Date.now();

        // Add to trail or refresh timestamp
        const existingTrail = this.trail.find(t => t.x === newX && t.y === newY);
        if (existingTrail) {
            existingTrail.time = now;
        } else {
            this.trail.push({ x: newX, y: newY, time: now });
        }

        // Remove expired trail entries
        this.trail = this.trail.filter(t => now - t.time < this.trailDuration);

        this.updateMoves();

        // Check victory
        if (newX === this.maze.end.x && newY === this.maze.end.y) {
            this.handleVictory();
        }
    }

    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));

        // Mobile d-pad controls
        document.querySelectorAll('.dpad-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dir = e.target.dataset.dir;
                if (dir === 'up') this.movePlayer(0, -1);
                else if (dir === 'down') this.movePlayer(0, 1);
                else if (dir === 'left') this.movePlayer(-1, 0);
                else if (dir === 'right') this.movePlayer(1, 0);
            });
        });

        // Stats modal
        document.getElementById('statsBtn').addEventListener('click', () => {
            this.showStatsModal();
            document.getElementById('statsModal').style.display = 'block';
        });

        // Help modal
        document.getElementById('helpBtn').addEventListener('click', () => {
            document.getElementById('helpModal').style.display = 'block';
        });

        // Calendar button
        const calendarBtn = document.getElementById('calendarBtn');
        const calendarModal = document.getElementById('calendarModal');

        calendarBtn.addEventListener('click', () => {
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('calendarDatePicker').min = '2026-01-01';
            document.getElementById('calendarDatePicker').max = today;
            document.getElementById('calendarDatePicker').value = today;
            calendarModal.style.display = 'block';
        });

        document.getElementById('playHistoricalBtn').addEventListener('click', () => {
            const selectedDate = document.getElementById('calendarDatePicker').value;
            if (selectedDate) {
                window.location.href = `?date=${selectedDate}`;
            }
        });

        // Share button
        document.getElementById('shareBtn').addEventListener('click', () => this.shareResults());

        // Victory modal buttons
        document.getElementById('victoryShareBtn').addEventListener('click', () => {
            this.shareResults();
            document.getElementById('victoryModal').style.display = 'none';
        });

        document.getElementById('victoryStatsBtn').addEventListener('click', () => {
            document.getElementById('victoryModal').style.display = 'none';
            this.showStatsModal();
            document.getElementById('statsModal').style.display = 'block';
        });

        // Close modals
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // SOS cheat code - reveal maze briefly
        document.addEventListener('keydown', (e) => {
            if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
                this.keyBuffer += e.key.toLowerCase();
                if (this.keyBuffer.length > 3) this.keyBuffer = this.keyBuffer.slice(-3);
                if (this.keyBuffer === 'sos') {
                    this.revealMaze();
                    this.keyBuffer = '';
                }
            }
        });
    }

    revealMaze() {
        const savedRadius = this.visibilityRadius;
        this.visibilityRadius = 1000;

        setTimeout(() => {
            this.visibilityRadius = savedRadius;
        }, 1500);
    }

    handleKeyPress(e) {
        if (this.gameComplete) return;

        let dx = 0, dy = 0;

        switch (e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                dy = -1;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                dy = 1;
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                dx = -1;
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                dx = 1;
                break;
            default:
                return;
        }

        e.preventDefault();
        this.movePlayer(dx, dy);
    }

    updateMazeNumber() {
        document.getElementById('mazeNumber').textContent = this.maze.mazeNumber;
    }

    updateMoves() {
        document.getElementById('moves').textContent = this.moves;
    }

    startRenderLoop() {
        let lastTime = Date.now();
        const loop = () => {
            const now = Date.now();
            const dt = (now - lastTime) / 1000;
            lastTime = now;

            const t = now / 1000;
            // Combine multiple sine waves for organic movement - very subtle
            this.fogPulse = Math.sin(t * 0.7) * 0.1 + Math.sin(t * 1.3) * 0.08 + Math.sin(t * 0.4) * 0.07;

            // Animate player visual position towards actual position
            if (this.playerVisualPos) {
                const speed = 12; // Cells per second
                const dx = this.playerPos.x - this.playerVisualPos.x;
                const dy = this.playerPos.y - this.playerVisualPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 0.01) {
                    const move = Math.min(dist, speed * dt);
                    this.playerVisualPos.x += (dx / dist) * move;
                    this.playerVisualPos.y += (dy / dist) * move;
                } else {
                    this.playerVisualPos.x = this.playerPos.x;
                    this.playerVisualPos.y = this.playerPos.y;
                }
            }

            this.render();
            this.renderLoop = requestAnimationFrame(loop);
        };
        loop();
    }

    stopRenderLoop() {
        if (this.renderLoop) {
            cancelAnimationFrame(this.renderLoop);
            this.renderLoop = null;
        }
    }

    startTimer() {
        this.sessionStartTime = Date.now();
        this.timerInterval = setInterval(() => this.updateTimerDisplay(), 1000);
        this.updateTimerDisplay();
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    getElapsedTime() {
        if (!this.sessionStartTime) return 0;
        return Math.floor((Date.now() - this.sessionStartTime) / 1000);
    }

    updateTimerDisplay() {
        const elapsed = this.getElapsedTime();
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('timer').textContent =
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    handleVictory() {
        this.gameComplete = true;
        this.stopTimer();

        const timeInSeconds = this.getElapsedTime();
        this.completionTime = timeInSeconds;

        // Record the win
        if (!this.isHistoricalGame) {
            this.storage.recordGameComplete(true, this.moves, timeInSeconds, this.maze.mazeNumber);
        }

        // Show share button
        document.getElementById('shareBtn').style.display = 'inline-block';

        // Show victory modal
        setTimeout(() => {
            this.showVictoryModal(timeInSeconds);
        }, 500);
    }

    showVictoryModal(timeInSeconds) {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = timeInSeconds % 60;
        const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

        document.getElementById('victoryTime').textContent = timeStr;
        document.getElementById('victoryMoves').textContent = this.moves;
        document.getElementById('victoryMazeNum').textContent = this.maze.mazeNumber;

        document.getElementById('victoryModal').style.display = 'block';
    }

    showStatsModal() {
        const stats = this.storage.getStats();
        document.getElementById('mazesPlayed').textContent = stats.mazesPlayed;
        document.getElementById('mazesWon').textContent = stats.mazesWon;
        document.getElementById('bestMoves').textContent = stats.bestMoves !== null ? stats.bestMoves : '-';

        if (stats.bestTime !== null) {
            const minutes = Math.floor(stats.bestTime / 60);
            const seconds = stats.bestTime % 60;
            document.getElementById('bestTime').textContent =
                `${minutes}:${String(seconds).padStart(2, '0')}`;
        } else {
            document.getElementById('bestTime').textContent = '-';
        }
    }

    shareResults() {
        const timeInSeconds = this.completionTime !== null ? this.completionTime : this.getElapsedTime();
        const shareText = this.storage.getShareText(this.maze.mazeNumber, this.moves, timeInSeconds);

        if (navigator.share) {
            navigator.share({ text: shareText }).catch(() => {
                this.copyToClipboard(shareText);
            });
        } else {
            this.copyToClipboard(shareText);
        }
    }

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showMessage('Results copied to clipboard!', 'success');
                setTimeout(() => this.clearMessage(), 2000);
            });
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showMessage('Results copied to clipboard!', 'success');
            setTimeout(() => this.clearMessage(), 2000);
        }
    }

    showMessage(text, type = '') {
        const messageEl = document.getElementById('message');
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
    }

    clearMessage() {
        document.getElementById('message').textContent = '';
        document.getElementById('message').className = 'message';
    }

    showCompletionState() {
        const todayData = this.storage.getTodayData();
        this.maze = getTodaysMaze();

        // Show completed maze fully
        this.playerPos = { ...this.maze.end };
        this.playerVisualPos = { ...this.maze.end };
        this.visibilityRadius = 1000;
        this.trail = [];

        this.setupCanvas();
        this.updateMazeNumber();
        this.startRenderLoop();

        if (todayData && todayData.won) {
            const minutes = Math.floor(todayData.time / 60);
            const seconds = todayData.time % 60;
            const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

            this.showMessage(`You escaped today's maze in ${todayData.moves} moves (${timeStr})!`, 'success');
            document.getElementById('timer').textContent = timeStr;
            document.getElementById('moves').textContent = todayData.moves;
            document.getElementById('shareBtn').style.display = 'inline-block';
            this.completionTime = todayData.time;
            this.moves = todayData.moves;
        }

        this.gameComplete = true;
        this.setupEventListeners();
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new CruelMazeGame();
});
