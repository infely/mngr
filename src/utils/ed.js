'use strict'

module.exports = (screen, doc) => {
  const editor = process.env.EDITOR || 'vim'
  return new Promise((resolve, reject) => {
    const file = `/tmp/mngr-${moment().unix()}.json`
    let docNew

    fs.writeFileSync(file, EJSON.stringify(doc, null, 2))
    const mtime = (fs.statSync(file)).mtimeMs
    const childExit = () => {
      const mtimeNew = (fs.statSync(file)).mtimeMs
      if (mtime !== mtimeNew) {
        try {
          docNew = EJSON.parse(fs.readFileSync(file, 'utf8'))
        } catch (e) {
          const child = screen.spawn(editor, [file], {stdio: 'inherit'})
          child.on('exit', childExit)
        }
        if (docNew) {
          fs.unlinkSync(file);
          resolve(docNew)
        }
      } else {
        fs.unlinkSync(file);
        reject()
      }
    }
    const child = screen.spawn(editor, [file], {stdio: 'inherit'})
    child.on('exit', childExit)
  })
}
