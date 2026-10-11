;(() => {
  const container = document.querySelector('#unlockable-mazes')
  if (!container) return

  const chain = [
    { requires: 'mega', name: 'monolithic', label: 'Monolithic Maze' },
    { requires: 'monolithic', name: 'magnificent', label: 'Magnificent Maze' },
    { requires: 'magnificent', name: 'maligned', label: 'Maligned Maze' },
    { requires: 'maligned', name: 'monstrous', label: 'Monstrous Maze' },
  ]

  for (const maze of chain) {
    if (localStorage.getItem(`maze-completed-${maze.requires}`) !== 'true') {
      // Show locked teaser and stop
      const div = document.createElement('div')
      div.className = 'buttons'
      div.innerHTML = '<a class="locked">??? Maze</a>'
      container.appendChild(div)
      return
    }

    const div = document.createElement('div')
    div.className = 'buttons'

    const link = document.createElement('a')
    link.href = `/mazes/${maze.name}`
    link.textContent = maze.label

    const daily = document.createElement('a')
    daily.href = `/mazes/${maze.name}/daily`
    daily.className = 'button-daily'
    daily.id = 'streak'
    daily.setAttribute('data-streak', `${maze.name}-just-maze`)
    daily.textContent = 'Daily'

    div.appendChild(link)
    div.appendChild(daily)
    container.appendChild(div)
  }
  // Update streak display on dynamically added daily buttons
  if (window.dontcheat && window.dontcheat.applyFixedScores) {
    window.dontcheat.applyFixedScores()
  }

})()
