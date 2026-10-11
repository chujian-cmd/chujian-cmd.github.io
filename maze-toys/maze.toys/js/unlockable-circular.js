;(() => {
  const container = document.querySelector('#unlockable-circular-mazes')
  if (!container) return

  const chain = [
    { requires: 'mighty', name: 'monstrous', label: 'Monstrous Circular' },
  ]

  for (const maze of chain) {
    if (localStorage.getItem(`maze-completed-${maze.requires}`) !== 'true') {
      const div = document.createElement('div')
      div.className = 'buttons'
      div.innerHTML = '<a class="locked">??? Circular</a>'
      container.appendChild(div)
      return
    }

    const div = document.createElement('div')
    div.className = 'buttons'

    const link = document.createElement('a')
    link.href = `/circular-mazes/${maze.name}`
    link.textContent = maze.label

    div.appendChild(link)
    container.appendChild(div)
  }
})()
