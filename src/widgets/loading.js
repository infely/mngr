'use strict'

module.exports = (screen, THEME) => {
  return () => {
    if (screen._.loader) {
      return
    }

    const chars = '/-\\|'

    let frame = 0
    const draw = () => {
      if (!screen._.loader) {
        return
      }

      frame++
      if (frame > chars.length) frame = 0

      screen._.loader.setContent(chars[frame])
      screen.render()
      setTimeout(draw, 30)
    }

    screen._.loader = blessed.box({
      parent: screen,
      width: 1,
      height: 1,
      style: {
        bg: THEME.bg2,
        fg: THEME.fg
      }
    })
    screen._.loader.focus()
    draw()
  }
}
