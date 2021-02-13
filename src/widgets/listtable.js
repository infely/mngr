'use strict'

module.exports = (options) => {
  const listtable = blessed.listtable(options)

  listtable.on('keypress', (ch, key) => {
    if (key.name === 'k') {
      listtable.up()
      listtable.screen.render()
    }
    if (key.name === 'j') {
      listtable.down()
      listtable.screen.render()
    }
    if (key.name === 'u' && key.ctrl) {
      listtable.move(-((listtable.height - listtable.iheight) / 2) | 0)
      listtable.select(listtable.selected) // fix listtable bug
      listtable.screen.render()
    }
    if (key.name === 'd' && key.ctrl) {
      listtable.move((listtable.height - listtable.iheight) / 2 | 0)
      listtable.screen.render()
    }
    if (key.name === 'b' && key.ctrl) {
      listtable.move(-(listtable.height - listtable.iheight))
      listtable.select(listtable.selected) // fix listtable bug
      listtable.screen.render()
    }
    if (key.name === 'f' && key.ctrl) {
      listtable.move(listtable.height - listtable.iheight)
      listtable.screen.render()
    }
    if (key.name === 'h' && key.shift) {
      listtable.move(listtable.childBase - listtable.selected + 1) // + 1: fix listtable bug
      listtable.screen.render()
    }
    if (key.name === 'm' && key.shift) {
      var visible = Math.min(
        listtable.height - listtable.iheight,
        listtable.items.length) / 2 | 0
      listtable.move(listtable.childBase + visible - listtable.selected)
      listtable.screen.render()
    }
    if (key.name === 'l' && key.shift) {
      listtable.down(listtable.childBase
        + Math.min(listtable.height - listtable.iheight, listtable.items.length)
        - listtable.selected - 1) // - 1: fix listtable bug
      listtable.screen.render()
    }
    if (key.name === 'g' && !key.shift) {
      listtable.select(0)
      listtable.select(0) // fix listtable bug
      listtable.screen.render()
    }
    if (key.name === 'g' && key.shift) {
      listtable.select(listtable.items.length - 1)
      listtable.screen.render()
    }
  })

  return listtable
}
