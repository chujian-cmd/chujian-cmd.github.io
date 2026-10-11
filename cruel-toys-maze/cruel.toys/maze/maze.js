/**
 * Maze Generation using Recursive Backtracking
 * Thin-wall version: each cell has walls on 4 sides
 */

class MazeGenerator {
    constructor(width, height, rng) {
        this.width = width;
        this.height = height;
        this.rng = rng;
        this.cells = [];
    }

    generate() {
        // Initialize grid - each cell has 4 walls
        this.cells = [];
        for (let y = 0; y < this.height; y++) {
            this.cells[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.cells[y][x] = {
                    walls: { north: true, east: true, south: true, west: true },
                    visited: false
                };
            }
        }

        // Start carving from top-left
        this.carve(0, 0);

        return this.cells;
    }

    carve(x, y) {
        this.cells[y][x].visited = true;

        // Directions: [dx, dy, wall to remove from current, wall to remove from neighbor]
        const directions = [
            { dx: 0, dy: -1, wall: 'north', opposite: 'south' },
            { dx: 1, dy: 0, wall: 'east', opposite: 'west' },
            { dx: 0, dy: 1, wall: 'south', opposite: 'north' },
            { dx: -1, dy: 0, wall: 'west', opposite: 'east' }
        ];

        // Shuffle directions
        this.rng.shuffle(directions);

        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;

            // Check bounds and if not visited
            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && !this.cells[ny][nx].visited) {
                // Remove walls between current cell and neighbor
                this.cells[y][x].walls[dir.wall] = false;
                this.cells[ny][nx].walls[dir.opposite] = false;

                // Recursively carve from neighbor
                this.carve(nx, ny);
            }
        }
    }
}

/**
 * Generate today's maze
 */
function getTodaysMaze(dateString = null) {
    const seed = getDailySeed(dateString);
    const rng = new SeededRandom(seed + 12345);

    // Large maze with thin walls
    // Base 40x40, up to 60x60
    const sizeVariant = (seed % 21);
    const width = 40 + sizeVariant;
    const height = 40 + sizeVariant;

    const generator = new MazeGenerator(width, height, rng);
    const cells = generator.generate();

    return {
        cells: cells,
        width: width,
        height: height,
        start: { x: 0, y: 0 },
        end: { x: width - 1, y: height - 1 },
        mazeNumber: getMazeNumber(dateString)
    };
}
