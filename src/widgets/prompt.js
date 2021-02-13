'use strict'

module.exports = (screen, THEME) => {
  return (content = '') => {
    return new Promise((resolve, reject) => {
      const box = blessed.box({
        parent: screen,
        top: 'center',
        left: 'center',
        height: 6,
        width: 'half',
        border: 'line',
        tags: true,
        content: ` ${content} `,
        style: {
          bg: THEME.bg,
          fg: THEME.fg,
          border: {
            bg: THEME.bg,
            fg: THEME.fg
          }
        }
      })
      box._.input = new blessed.textbox({
        parent: box,
        top: 1,
        left: 1,
        height: 1,
        width: '100%-4',
        censor: true,
        bg: THEME.bg2,
        fg: THEME.fg
      })
      box._.okay = new blessed.button({
        parent: box,
        top: 3,
        width: 12,
        align: 'center',
        tags: true,
        content: 'OK ({bold}Enter{/})',
        bg: THEME.bg2,
        fg: THEME.fg
      })
      box._.cancel = new blessed.button({
        parent: box,
        top: 3,
        width: 14,
        align: 'center',
        tags: true,
        content: ' Cancel ({bold}Esc{/}) ',
        bg: THEME.bg3,
        fg: THEME.fg
      })
      box.width = Math.max(32, content.length + 4)
      box._.okay.left = Math.round(box.width / 2) - box._.okay.width - 3
      box._.cancel.left = Math.round(box.width / 2) - 1
      box._.input.once('submit', (value) => {
        box.destroy()
        resolve(value)
      })
      box._.input.key('escape', () => {
        box.destroy()
        resolve(false)
      })
      box._.input.focus()
      box._.input.readInput()
      box.screen.render()
    })
  }
}
