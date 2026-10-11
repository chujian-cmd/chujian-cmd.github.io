;(() => {
  const STORAGE_KEY = 'cheating-yourself'

  function msToTime(duration) {
    let seconds = Math.floor((duration / 1000) % 60)
    let minutes = Math.floor((duration / (1000 * 60)) % 60)
    let hours = Math.floor((duration / (1000 * 60 * 60)) % 24)

    if (hours) {
      return hours + 'h ' + minutes + 'm ' + seconds + 's'
    } else if (minutes) {
      return minutes + 'm ' + seconds + 's'
    } else {
      return seconds + 's'
    }
  }

  function save(key, subkey, value) {
    let data = load() || {}

    if (!data[key]) {
      data[key] = {}
    }

    data[key][subkey] = value

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return data
  }

  function load() {
    let data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      return JSON.parse(data) || {}
    }
  }

  function getCurrentDate() {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]
    const date = new Date()
    const month = months[date.getMonth()]
    const day = date.getDate()
    const year = date.getFullYear()
    const formattedDate = `${month} ${day} ${year}`
    return formattedDate
  }

  const topScoreCount = 10
  const topScoreKey = 'wow-u-cheating-'

  function checkIfTopScoreAndSave(gameType, time, moves, hash) {
    let key = topScoreKey + gameType

    let data = localStorage.getItem(key)
    if (data) {
      data = JSON.parse(data)
    } else {
      data = {}
    }

    let topScores = data.topScores || []
    let topMoves = data.topMoves || []

    let date = new Date()

    // Add the score if there are none recorded or fewer than 10
    if (topScores.length < topScoreCount) {
      topScores.push({ time, hash, date: new Date() })
      topScores.sort((a, b) => a.time - b.time) // Sort by lowest first
    } else {
      for (let i = 0; i < topScores.length; i++) {
        if (time < topScores[i].time) {
          topScores.splice(i, 0, { time, hash, date })
          break
        }
      }
    }

    // Add the moves if there are none recorded or fewer than 10
    if (topMoves.length < topScoreCount) {
      topMoves.push({ moves, hash, date: new Date() })
      topMoves.sort((a, b) => a.moves - b.moves) // Sort by lowest first
    } else {
      for (let i = 0; i < topMoves.length; i++) {
        if (moves < topMoves[i].moves) {
          topMoves.splice(i, 0, { moves, hash, date })
          break
        }
      }
    }

    // Keep only the top 10 scores
    if (topScores.length > topScoreCount) {
      topScores = topScores.slice(0, topScoreCount)
    }

    // Keep only the top 10 moves
    if (topMoves.length > topScoreCount) {
      topMoves = topMoves.slice(0, topScoreCount)
    }

    data.topScores = topScores
    data.topMoves = topMoves

    localStorage.setItem(key, JSON.stringify(data))
  }

  const dailyKey = 'cheating-yourself-daily-'
  function saveDaily(gameType, time, moves, hash) {
    // Load the daily data
    let key = dailyKey + gameType
    let data = localStorage.getItem(key)
    if (data) {
      data = JSON.parse(data)
    } else {
      data = {}
    }

    let games = data.games || []
    let date = new Date()

    // Add scores
    let score = { time, moves, hash, date }

    // Check to see if the current hash is saved in the daily data
    const found = games.some((game) => game.hash === hash)

    if (found) {
      // If the hash is found, update the time and moves
      for (let i = 0; i < games.length; i++) {
        if (games[i].hash === hash) {
          // Update the time and moves if they are improved
          if (time < games[i].time) games[i].time = time
          if (moves < games[i].moves) games[i].moves = moves
          break
        }
      }
    } else {
      games.unshift(score)
    }

    data.games = games

    // Save to Localstorage
    localStorage.setItem(key, JSON.stringify(data))
  }

  function getCurrentStreak(gameType) {
    // Load the daily data
    let key = dailyKey + gameType
    let data = localStorage.getItem(key)
    if (data) {
      data = JSON.parse(data)
    } else {
      data = {}
    }

    let games = data.games || []
    let dates = games.map((game) => game.hash)

    let todayHash = getCurrentDate()
    let hasCompletedToday = games.some((game) => game.hash === todayHash)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let streak = 0
    let currentDate = today

    if (dates.length > 0 && new Date(dates[0]).valueOf() === today.valueOf()) {
      streak = 1
      dates.shift() // Remove today's date from the dates array
    }

    currentDate.setDate(currentDate.getDate() - 1) // Start counting from yesterday

    while (dates.length > 0) {
      const dateStr = dates.shift()
      const date = new Date(dateStr)

      if (
        date.getFullYear() === currentDate.getFullYear() &&
        date.getMonth() === currentDate.getMonth() &&
        date.getDate() === currentDate.getDate()
      ) {
        streak++
        currentDate.setDate(currentDate.getDate() - 1)
      } else {
        break
      }
    }

    return { streak, hasCompletedToday, longestStreak: getLongestStreak(games) }
  }

  function getLongestStreak(games) {
    if (games.length === 0) {
      return 0
    }

    // Helper function to subtract one day from a date
    function subtractOneDay(date) {
      const result = new Date(date)
      result.setDate(result.getDate() - 1)
      return result
    }

    let longestStreak = 1 // Start with 1 to account for the first game
    let currentStreak = 1
    let currentDate = new Date(games[0].hash)
    currentDate.setHours(0, 0, 0, 0) // Normalize the time part to avoid hour differences

    for (let i = 1; i < games.length; i++) {
      let previousDate = new Date(games[i].hash)
      previousDate.setHours(0, 0, 0, 0) // Normalize time part

      if (
        subtractOneDay(currentDate).toDateString() ===
        previousDate.toDateString()
      ) {
        currentStreak++
      } else {
        longestStreak = Math.max(longestStreak, currentStreak)
        currentStreak = 1 // Reset streak if not consecutive
      }

      currentDate = previousDate // Move to the previous date in the list for the next iteration
    }

    // Check at the end in case the longest streak is the last one
    longestStreak = Math.max(longestStreak, currentStreak)

    return longestStreak
  }

  window.dontcheat = {}
  window.dontcheat.save = save
  window.dontcheat.load = load
  window.dontcheat.saveTop = checkIfTopScoreAndSave
  window.dontcheat.saveDaily = saveDaily
  window.dontcheat.getCurrentStreak = getCurrentStreak
  window.dontcheat.applyFixedScores = applyFixedScores

  function applyFixedScores() {
    let streakIDs = document.querySelectorAll('#streak')

    streakIDs.forEach((streakID) => {
      let gameType = streakID.getAttribute('data-streak')

      let streakData = getCurrentStreak(gameType)

      if (streakData) {
        let currentStreak = streakData.streak
        let hasCompletedToday = streakData.hasCompletedToday

        if (currentStreak > 0) {
          streakID.innerHTML = streakID.innerHTML + ' (' + currentStreak + ')'
        }

        if (hasCompletedToday) {
          streakID.classList.add('complete')
          streakID.innerHTML = '<span class="yes">✔</span>' + currentStreak
        }
      }
    })
  }

  applyFixedScores()
})()
