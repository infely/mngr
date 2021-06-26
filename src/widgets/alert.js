'use strict'

module.exports = (screen, THEME) => {
  return (content = '') => {
    return new Promise((resolve) => {
      const message = blessed.message({
        parent: screen,
        top: 'center',
        left: 'center',
        height: 'shrink',
        border: 'line',
        style: {
          bg: THEME.bg,
          fg: THEME.fg,
          border: {
            bg: THEME.bg,
            fg: THEME.fg,
          }
        }
      })
      message.width = content.length + 4
      message.display(` ${content} `, 0, () => {
        resolve(true)
      })
    })
  }
}
