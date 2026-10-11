/**
 * Seeded Random Number Generator for Maze
 * Uses Mulberry32 algorithm for consistent pseudo-random sequences
 */

class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }

    // Mulberry32 PRNG
    next() {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    // Random integer between min (inclusive) and max (exclusive)
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min)) + min;
    }

    // Shuffle array in place
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i + 1);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

/**
 * Get the daily seed based on date
 * Uses days since January 1, 2026 as the seed
 */
function getDailySeed(dateString = null) {
    const baseDate = new Date('2026-01-01');
    const targetDate = dateString ? new Date(dateString) : new Date();

    // Reset time to midnight for consistent daily seeds
    targetDate.setHours(0, 0, 0, 0);
    baseDate.setHours(0, 0, 0, 0);

    const daysSinceBase = Math.floor((targetDate - baseDate) / (1000 * 60 * 60 * 24));
    return daysSinceBase;
}

/**
 * Get maze number (1-indexed day count)
 */
function getMazeNumber(dateString = null) {
    return getDailySeed(dateString) + 1;
}

/**
 * Get date key in YYYY-MM-DD format
 */
function getDateKey(dateString = null) {
    const date = dateString ? new Date(dateString) : new Date();
    return date.toISOString().split('T')[0];
}

/**
 * Get date from URL parameter
 */
function getDateFromURL() {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return dateParam;
    }
    return null;
}
