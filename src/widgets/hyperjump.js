'use strict'

module.exports = (screen, THEME) => {
  return () => {
    const createMap = () => {
      return _.chunk(_.range(0, screen.width * screen.height, 0), screen.height)
    }
    const spawnStar = () => {
      const a = Math.random() * 360
      const s = 1 - Math.abs((a % 90) - 45) / 45
      let dx = Math.cos(a * Math.PI / 180)
      let dy = Math.sin(a * Math.PI / 180)
      dx *= 2 + (s * 2) * (Math.random() + 1)
      dy *= 1 + (s) * (Math.random() + 1)
      const x = screen.width / 2
      const y = screen.height / 2
      return {x, y, dx, dy}
    }
    const update = () => {
      for (let y = 0; y < screen.height; y++) {
        for (let x = 0; x < screen.width; x++) {
          if (map[y]) map[y][x] = ' '
        }
      }
      for (let i in stars) {
        stars[i].x += stars[i].dx
        stars[i].y += stars[i].dy
        if (
          stars[i].x < 0 ||
          stars[i].x > screen.width ||
          stars[i].y < 0 ||
          stars[i].y > screen.height
        ) {
          stars[i] = spawnStar()
        }
        map[Math.floor(stars[i].y)][Math.floor(stars[i].x)] = '.'
      }
    }
    const draw = () => {
      if (!screen._.hyperjump) {
        return
      }

      update()
      const content = _.map(map, i => i.join('')).join('\n')
      screen._.hyperjump.setContent(content)
      screen.render()
      setTimeout(draw, 30)
    }

    screen._.hyperjump = blessed.box({
      parent: screen,
      style: {
        bg: THEME.bg,
        fg: THEME.fg
      }
    })
    screen._.hyperjump.on('resize', () => {
      map = createMap()
    })

    const stars = _.times(64, () => spawnStar())
    let map = createMap()
    _.times(32, update)
    draw()
  }
}
