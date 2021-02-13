'use strict'

module.exports = (THEME) => {
  return (help, input) => {
    let str = ''
    for (let row of input) {
      if (str) str += '\n'
      if (row[0][0] !== ' ') {
        str += `{${!str ? THEME.bg2 : THEME.bg3}-bg}`
        for (let i in row) {
          i = parseInt(i)
          const pad = i === row.length - 1 ? help.width - (row.length - 1) * 16 : 16
          str += row[i].padEnd(pad)
        }
        str += `{/}`
      } else {
        for (let i in row) {
          i = parseInt(i)
          if (i === row.length - 1) {
            str += row[i]
          } else {
            str += row[i].padEnd(16)
          }
        }
      }
    }
    return str
  }
}
