'use strict'

module.exports = (...colors) => {
  const theme = {}
  let prev = {}
  for (let i = 0; i < 5; i++) {
    const prefix = i % 2 === 0 ? 'bg' : 'fg'

    let color = colors[i] || prev[prefix] || 0
    if (parseInt(color).toString() === color) color = parseInt(color)
    prev[prefix] = color

    let index = ''
    if (i >= 2) index = Math.floor(i / 2) + 1

    theme[`${prefix}${index}`] = color
  }
  return theme
}
