/**
 * Storage management for Cruel Maze
 */

class MazeStorage {
    constructor() {
        this.STATS_KEY = 'cruelMaze_stats';
        this.TODAY_KEY = 'cruelMaze_today';
    }

    getStats() {
        const stored = localStorage.getItem(this.STATS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        return {
            mazesPlayed: 0,
            mazesWon: 0,
            bestMoves: null,
            bestTime: null,
            lastPlayedDate: null,
            history: []
        };
    }

    saveStats(stats) {
        localStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
    }

    getTodayData() {
        const stored = localStorage.getItem(this.TODAY_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        return null;
    }

    hasPlayedToday() {
        const todayData = this.getTodayData();
        if (!todayData) return false;

        const today = getDateKey();
        return todayData.date === today;
    }

    recordGameComplete(won, moves, time, mazeNumber) {
        const today = getDateKey();
        const stats = this.getStats();

        // Update stats
        stats.mazesPlayed++;
        if (won) {
            stats.mazesWon++;

            // Update best moves
            if (stats.bestMoves === null || moves < stats.bestMoves) {
                stats.bestMoves = moves;
            }

            // Update best time
            if (stats.bestTime === null || time < stats.bestTime) {
                stats.bestTime = time;
            }
        }

        stats.lastPlayedDate = today;

        // Add to history
        stats.history.push({
            date: today,
            won: won,
            moves: moves,
            time: time,
            mazeNumber: mazeNumber
        });

        // Keep only last 365 entries
        if (stats.history.length > 365) {
            stats.history = stats.history.slice(-365);
        }

        this.saveStats(stats);

        // Save today's data
        localStorage.setItem(this.TODAY_KEY, JSON.stringify({
            date: today,
            won: won,
            moves: moves,
            time: time,
            mazeNumber: mazeNumber
        }));
    }

    getShareText(mazeNumber, moves, time) {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

        return `Cruel Maze #${mazeNumber}
Escaped in ${moves} moves (${timeStr})

https://cruel.toys/maze/`;
    }
}
