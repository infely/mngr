#!/usr/bin/env node

'use strict'

const program = require('commander')
program
  .option('-h, --host <ip|domain>', 'host')
  .option('-p, --port <port>', 'port')
  .option('-s, --ssh <user@host:port>', 'ssh tunnel')
  .option('-u, --url <url>', 'connection url')
  .option('-c, --colors <bg,fg,bg2,fg2,bg3>', 'colors')
  .option('-v, --version', 'print version information and exit')
program.parse(process.argv)

const OPTIONS = program.opts()
if (OPTIONS.version) {
  console.log(require('./package.json').version)
  process.exit(0)
}

if (
  process.env.TERM &&
  !['linux', 'windows-ansi', 'xterm', 'xterm-256color']
    .includes(process.env.TERM)
) {
  process.env.TERM = process.env.TERM.endsWith('256color') ||
    process.env.COLORTERM ?  'xterm-256color' : 'xterm'
}

global.fs           = require('fs')
global.path         = require('path')
global.os           = require('os')
global._            = require('lodash')
global.moment       = require('moment')
global.mongodb      = require('mongodb')
global.EJSON        = require('bson').EJSON
global.blessed      = require('blessed')
const tunnel        = require('tunnel-ssh')
const ed            = require('./src/utils/ed')
const lazy          = require('./src/utils/lazy')
const theme         = require('./src/utils/theme')
const LIMIT         = 100
const ARGS          = program.parse(process.argv).args
const HOST          = OPTIONS.host || 'localhost'
const PORT          = OPTIONS.port || 27017
const SSH           = OPTIONS.ssh
const URL           = OPTIONS.url
const COLORS        = OPTIONS.colors
const THEME         = COLORS ?
  theme(...COLORS.split(',')) :
    process.env.TERM == 'xterm-256color' ?
      theme(235, '#ebdbb2', 237, 246, 236) :
      theme(0, 7)
const HISTORY       = path.join(os.homedir(), '.mngr_history')
const screen        = blessed.screen({smartCSR: true})
const confirm       = require('./src/widgets/confirm')(screen, THEME)
const helptext      = require('./src/widgets/helptext')(THEME)
const hyperjump     = require('./src/widgets/hyperjump')(screen, THEME)
const listtable     = require('./src/widgets/listtable')
const loading       = require('./src/widgets/loading')(screen, THEME)
const prompt        = require('./src/widgets/prompt')(screen, THEME)

const STATE = {
  client: null,
  dbs: null,
  db: null,
  collection: null,
  docsCount: null,
  docs: [],
  headerLast: [],
  criteria: {},
  projection: {},
  sort: {},
  offset: 0,
  skip: 0,
  history: {
    commands: [],
    last: '',
    cursor: 0
  }
}

global.log = (...value) => {
  fs.appendFileSync(
    'log.txt',
    require('util')
      .inspect(value, false, 2, true)
      .replace(/^\[ (.*) \]$/, '$1') + '\n'
  )
}

screen.key('tab', () => {
  if (left.focused) {
    left.emit('action')
  } else if(right.focused) {
    focus(0)
  }
})
screen.key(['escape', 'q', 'C-c'], () => {
  if (
    (screen._.loader && screen._.loader.focused) ||
    left.focused ||
    right.focused
  ) {
    return process.exit(0)
  }
})
screen.key('?', () => {
  if (right.focused) {
    if (help.hidden) {
      help._right()
    } else {
      help._hide()
    }
    screen.render()
  }
})
screen._.line = blessed.line({
  parent: screen,
  top: 1,
  left: 16,
  height: '100%-3',
  style: {
    bg: THEME.bg,
    fg: THEME.bg2
  }
})

const top = blessed.box({
  parent: screen,
  height: 1,
  tags: true,
  style: {
    bg: THEME.bg2,
    fg: THEME.fg
  }
})

const left = blessed.list({
  parent: screen,
  top: 1,
  width: 16,
  height: '100%-3',
  keys: true,
  vi: true,
  search: (cb) => {
    textbox._prev = 'left'
    textbox.focus()
    textbox.setValue('/')
    textbox.readInput()
    textbox.once('submit', (value) => {
      left.focus()
      textbox.clearInput()
      if (value) {
        cb(value.replace(/^\//, ''))
      } else {
        screen.render()
      }
    })
    screen.render()
  },
  style: {
    bg: THEME.bg,
    fg: THEME.fg,
    selected: {
      bg: THEME.fg2,
      fg: THEME.bg
    }
  }
})
left.on('keypress', () => {
  STATE.docsCount = null
  drawBottom()
  right.width = '100%-17'
  right.setData([[]])
  screen.render()
})
left.key('r', async () => {
  if (!STATE.db) {
    await drawDBs()
  } else {
    await drawCollections(STATE.db.s.namespace.db)
  }
  screen.render()
})
left.key(['h', 'left'], async () => {
  if (STATE.db) {
    left.selected = 0
    left.emit('action')
  }
})
left.key('right', () => {
  left.emit('action')
})
left.on('action', async () => {
  if (!STATE.db) {
    await drawCollections(STATE.dbs[left.selected])
    screen.render()
  } else {
    if (left.selected === 0) {
      await drawDBs()
      left.selected = STATE.dbs.indexOf(STATE.db.s.namespace.db)
      STATE.db = undefined
      drawTop()
      screen.render()
    } else {
      await drawDocuments(STATE.collections[left.selected - 1])
      focus(1)
    }
  }
})

const right = listtable({
  parent: screen,
  top: 1,
  left: 17,
  width: '100%-17',
  height: '100%-3',
  pad: 0,
  align: 'left',
  keys: true,
  tags: true,
  style: {
    bg: THEME.bg,
    // fg: THEME.fg,
    header: {
      bg: THEME.bg,
      fg: THEME.fg,
      bold: true
    },
    cell: {
      selected: {
        bg: THEME.bg2,
        fg: THEME.fg
      }
    }
  }
})
right.key(['-', '='], async (ch) => {
  const sort = ch === '-' ? {_id: -1} : {}
  STATE.offset = 0
  STATE.skip = 0
  await drawDocuments(
    STATE.collection.s.namespace.collection,
    STATE.criteria,
    STATE.projection,
    sort
  )
  screen.render()
})
right.key('backspace', async () => {
  STATE.offset = 0
  STATE.skip = 0
  await drawDocuments(STATE.collection.s.namespace.collection)
  screen.render()
})
right.key('S-e', () => {
  right.emit('action')
})
right.key('r', async () => {
  await drawDocuments(
    STATE.collection.s.namespace.collection,
    STATE.criteria,
    STATE.projection,
    STATE.sort
  )
  screen.render()
})
right.key('i', async () => {
  if (!STATE.docs[right.selected - 1]) {
    return
  }
  if (!help.hidden) {
    help._hide()
  }
  const panel = blessed.box({
    parent: screen,
    top: 1,
    left: 17,
    width: '100%-17',
    height: '100%-3',
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    tags: true,
    style: {
      bg: THEME.bg,
      fg: THEME.fg
    }
  })
  panel.key(['escape', 'q', 'C-c', 'tab', 'i'], () => {
    panel.destroy()
    screen.render()
  })
  panel.key('r', async () => {
    await drawDoc()
  })
  panel.focus()
  const drawDoc = async () => {
    const doc = await STATE.collection.findOne({
      _id: STATE.docs[right.selected - 1]._id
    })
    panel.setContent(lazy.preview(doc, 2))
    screen.render()
  }
  await drawDoc()
})
right.key('[', async () => {
  STATE.skip = Math.max(0, STATE.skip - 100)
  await drawDocuments(
    STATE.collection.s.namespace.collection,
    STATE.criteria,
    STATE.projection,
    STATE.sort
  )
})
right.key(']', async () => {
  if (STATE.skip + 100 > STATE.docsCount) {
    return
  }
  STATE.skip += 100
  await drawDocuments(
    STATE.collection.s.namespace.collection,
    STATE.criteria,
    STATE.projection,
    STATE.sort
  )
})
right.key('d', () => {
  if (!help.hidden) {
    help._hide()
  }
  const panel = blessed.box({
    parent: screen,
    bottom: 2,
    height: 2,
    tags: true
  })
  panel.setContent(
    `{underline}${'key'.padEnd(16)}${'command'.padEnd(panel.width - 16)}{/}\n` +
    `${'D'.padStart(2).padEnd(16)}delete`
  )
  panel.on('keypress', async (__, key) => {
    if (key.name === 'd' && key.shift) {
      const _id = mongodb.ObjectID(STATE.docs[right.selected - 1]._id)
      if (await confirm(`Remove ${_id}?`)) {
        await STATE.collection.deleteOne({_id})
        await drawDocuments(
          STATE.collection.s.namespace.collection,
          STATE.criteria,
          STATE.projection,
          STATE.sort
        )
        textbox.setValue(`${_id} deleted`)
      }
    }
    panel.destroy()
    screen.render()
  })
  panel.focus()
  screen.render()
})
right.key(['y', 'a'], async (__, key) => {
  let doc = {}, docNew, str = ''

  if (key.name === 'y') {
    doc = await STATE.collection.findOne(STATE.docs[right.selected - 1]._id)
    delete doc._id
  }
  try {
    docNew = await ed(screen, doc)
  } catch (e) {
    docNew = undefined
  }
  if (docNew) {
    const result = await STATE.collection.insertOne(docNew)
    await drawDocuments(
      STATE.collection.s.namespace.collection,
      STATE.criteria,
      STATE.projection,
      STATE.sort
    )

    str = `${result.insertedId} written`
  }
  textbox.setValue(str)
  screen.render()
})
right.key(['h', 'left'], async () => {
  if (STATE.offset > 0) {
    STATE.offset--
    const selected = right.selected
    await drawDocuments()
    right.selected = selected
    screen.render()
  } else {
    focus(0)
  }
})
right.key(['l', 'right'], async () => {
  STATE.offset = Math.min(STATE.headerLast.length - 1, STATE.offset + 1)
  const selected = right.selected
  await drawDocuments()
  right.selected = selected
  screen.render()
})
right.key('/', () => {
  if (!help.hidden) {
    help._textbox()
  }
  textbox._prev = 'right'
  textbox.focus()
  textbox.setValue('/')
  textbox.readInput()
  textbox.once('submit', async (value) => {
    if (!help.hidden) {
      help._right()
    }
    textbox.clearInput()
    if (value) {
      value = value.replace(/^\//, '')
      if (value) {
        fs.appendFileSync(HISTORY, `${value}\n`)
        STATE.history.commands.push(value)
        STATE.history.last = ''
        STATE.history.cursor = 0
      }
      const {collection, criteria, projection, sort} =
        await makeQuery(value.replace(/^\//, ''))
      if (collection !== STATE.collection.s.namespace.collection) {
        left.select(left.fuzzyFind(collection, false))
      }
      STATE.offset = 0
      STATE.skip = 0
      await drawDocuments(collection, criteria, projection, sort)
    }
    focus(1)
  })
  screen.render()
})
right.on('action', async () => {
  if (!help.hidden) {
    help._hide()
  }

  const _id = STATE.docs[right.selected - 1] &&
    STATE.docs[right.selected - 1]._id
  if (!/^[0-9A-Fa-f]{24}$/.test(_id)) {
    return
  }

  let docNew, str = ''
  const doc = await STATE.collection.findOne(_id)
  try {
    docNew = await ed(screen, doc)
  } catch (e) {
    docNew = undefined
  }
  if (docNew) {
    const _id = mongodb.ObjectID(docNew._id)

    const set = {}
    for (let i in docNew) {
      if (EJSON.stringify(doc[i]) !== EJSON.stringify(docNew[i])) {
        set[i] = docNew[i]
      }
    }
    const unset = {}
    for (let i in doc) {
      if (docNew[i] === undefined) {
        unset[i] = ''
      }
    }
    const options = {}
    if (!_.isEmpty(set)) options.$set = set
    if (!_.isEmpty(unset)) options.$unset = unset

    if (!_.isEmpty(options)) {
      await STATE.collection.updateOne({_id}, options)
      await drawDocuments(
        STATE.collection.s.namespace.collection,
        STATE.criteria,
        STATE.projection,
        STATE.sort
      )

      str = `${_id.toString()} written`
    }
  }
  textbox.setValue(str)
  screen.render()
})

const help = blessed.box({
  parent: screen,
  left: 0,
  bottom: 2,
  tags: true,
  hidden: true,
  style: {
    bg: THEME.bg,
    fg: THEME.fg
  }
})
help._show = (content) => {
  help.height = content.length
  help.setContent(helptext(help, content))
  help.show()
  right.height = `100%-${help.height + 3}`
}
help._right = () => {
  help._show([
    ['key', 'command'],
    [' ↓, j, →, k', 'down, up'],
    [' ←, h, →, l', 'left, right'],
    [' i', 'preview'],
    [' E, enter', 'edit'],
    [' a, y', 'insert, duplicate'],
    [' d', 'remove'],
    [' [, ]', 'prev, next page'],
    [' -, +', 'sort({_id:-1}), sort({_id:1})'],
    [' r, backspace', 'reload, reset'],
    [' /', 'search']
  ])
}
help._textbox = () => {
  help._show([
    ['key', 'command'],
    [' tab', 'autocomplete'],
    [' C-/', 'hide this panel'],
    ['string', 'command', 'expand'],
    [' id', 'filter', 'find({$oid: id})'],
    [' foo:bar,num:42', 'filter', 'find({foo: "bar", num: 42})'],
    [' foo,bar', 'projection', 'find({}, {foo: 1, bar: 1})'],
    [' -foo,+bar,-', 'sort', 'sort({foo: 1, bar: -1, _id: -1})'],
    ['examples'],
    [' db.users.find({login:"admin"},{login:1,age:1},{age:-1}})'],
    [' login:admin,login,age,-age']
  ])
}
help._hide = () => {
  right.height = '100%-3'
  help.hide()
}

const bottom = blessed.box({
  parent: screen,
  bottom: 1,
  right: 0,
  height: 1,
  align: 'right',
  tags: true,
  style: {
    bg: THEME.bg2,
    fg: THEME.fg
  }
})
bottom._.left = blessed.box({
  parent: bottom,
  style: {
    bg: THEME.bg2,
    fg: THEME.fg
  }
})

const textbox = blessed.textbox({
  parent: screen,
  bottom: 0,
  height: 1,
  style: {
    bg: THEME.bg,
    fg: THEME.fg
  }
})
textbox.on('keypress', (ch, key) => {
  if (ch === '\x1F') {
    if (help.hidden && textbox._prev === 'right') {
      help._textbox()
    } else {
      help._hide()
    }
    screen.render()
  }
  if (key.name === 'up' || key.name === 'down') {
    if (textbox._prev !== 'right' || !STATE.history.commands.length) {
      return
    }
    if (key.name === 'up') {
      if (STATE.history.cursor === 0) {
        STATE.history.last = textbox.value.replace(/^\//, '')
      }
      STATE.history.cursor++
      STATE.history.cursor = Math.min(
        STATE.history.commands.length,
        STATE.history.cursor
      )
    } else if (key.name === 'down') {
      STATE.history.cursor--
      STATE.history.cursor = Math.max(0, STATE.history.cursor)
    }
    if (STATE.history.cursor === 0) {
      textbox.value = `/${STATE.history.last}`
    } else {
      const index = STATE.history.commands.length - STATE.history.cursor
      textbox.value = `/${STATE.history.commands[index]}`
    }
    screen.render()
  }
})
textbox.key('escape', () => {
  textbox.emit('submit', '')
})
textbox.key('backspace', () => {
  if (!textbox.value) {
    textbox.emit('submit', textbox.value)
  }
})
textbox.key('tab', () => {
  const value = textbox.value.replace(/\t$/, '')
  let pattern
  let found = ''
  switch (true) {
    case !!value.match(/^\/db\.[^.]*$/):
      pattern = value.replace(/^\/db\./, '')
      found = _.find(
        STATE.collections,
        (i) => i.startsWith(pattern)
      ) || ''
      if (found) found = found.substr(pattern.length)
      textbox.value = textbox.value.replace(/\t$/, found)
      break
    case !!value.match(/^\/db\.[^.]+\.[^{]*$/):
      pattern = value.replace(/^\/db\.[^.]+\./, '')
      found = _.find(
        ['find', 'update', 'remove'],
        (i) => i.startsWith(pattern)
      ) || ''
      if (found) found = found.substr(pattern.length)
      textbox.value = textbox.value.replace(/\t$/, found)
      break
    default:
      const matches = value.match(/([A-Za-z]+)$/)
      if (matches) {
        pattern = matches[1]
        found = _.find(
          STATE.headerLast,
          (i) => i.startsWith(pattern)
        ) || ''
        if (found) found = found.substr(pattern.length)
        textbox.value = textbox.value.replace(/\t$/, found)
        break
      } else {
        textbox.value = value
      }
  }
  screen.render()
})
textbox.key('left', () => {
  textbox.readEditor()
})


const focus = (index) => {
  const elements = [left, right]
  const el = elements[index]
  const re = elements[+!index]
  if (!elements[index]) return

  if (index === 0) {
    if (!help.hidden) {
      help._hide()
    }
    STATE.offset = 0
    STATE.skip = 0
  }
  el.style.selected.bg = THEME.fg
  el.style.selected.fg = THEME.bg
  re.style.selected.bg = THEME.bg3
  re.style.selected.fg = THEME.fg
  el.focus()
  screen.render()
}

const drawTop = () => {
  let str = ' '
  if (SSH) str += ` ${SSH} `
  str += ` ${HOST}:${PORT} `
  if (STATE.db) str += ` ${STATE.db.s.namespace.db} `
  str += `{|}press {bold}?{/} for help `
  top.setContent(str)
}

const drawBottom = () => {
  let content = ''
  if (STATE.docsCount > 1) {
    content += `${STATE.skip + 1}-${Math.min(STATE.docsCount, STATE.skip + 100)}/`
  }
  if (STATE.docsCount !== null) {
    content += `${STATE.docsCount} `
  }
  let length = bottom.width - content.length

  let contentLeft = ''
  if (STATE.docsCount !== null) {
    contentLeft += ` db.${STATE.collection.s.namespace.collection}.find(`
    contentLeft += `${lazy.stringify(STATE.criteria)}`
    if (!_.isEmpty(STATE.projection)) {
      contentLeft += `,${lazy.stringify(STATE.projection)}`
    }
    if (!_.isEmpty(STATE.sort)) {
      contentLeft += `).sort(${lazy.stringify(STATE.sort)}`
    }
    contentLeft += ')'
    if (contentLeft.length >= length) {
      content = `{gray-fg}~{/} ${content}`
      length -= 1
      contentLeft = `${contentLeft.substr(0, length - 1)}`
    }
  }

  bottom.setContent(content)
  bottom._.left.width = length - 1
  bottom._.left.setText(contentLeft)
}

const drawDBs = async () => {
  STATE.dbs = _.map(
    (await STATE.client
      .db('admin')
      .admin()
      .listDatabases()
    ).databases
    , 'name'
  )
  left.setItems(STATE.dbs)

  drawTop()
}

const drawCollections = async (name) => {
  STATE.db = STATE.client.db(name)
  STATE.collections = _.orderBy(
    _.map(
      await STATE.db
        .listCollections()
        .toArray()
      , 'name'
    )
  )
  left.setItems(['..', ...STATE.collections])
  left.selected = 1
  drawTop()
}

const makeQuery = async (input) => {
  let collection = STATE.collection.s.namespace.collection

  if (input.startsWith('db.')) {
    let value, result, fn, docsCount, str

    const matches = input.match(/db\.([^.]+)\.(.+)$/)
    try {
      value = eval(`lazy.db.init('${matches[1]}').${matches[2]}._val()`)
    } catch (e) {
      input = ''
      textbox.setValue(e.toString())
    }
    if (value) {
      collection = value.collection
      switch (value.method) {
        case 'update':
          if (!value.input.options.multi) {
            fn = 'updateOne'
            docsCount = +!!await STATE.collection
              .findOne(value.input.criteria, {projection: {_id: 1}})
          } else {
            fn = 'updateMany'
            docsCount = await STATE.collection
              .find(value.input.criteria)
              .count()
          }
          if (
            await confirm(`Are you sure you want to update ${docsCount} documents?`)
          ) {
            try {
              result = await STATE.collection[fn](
                value.input.criteria,
                value.input.update,
                value.input.options
              )
              str = `${result.result.nModified} updated`
            } catch (e) {
              str = e.toString()
            }
            textbox.setValue(str)
          }
          break
        case 'remove':
          if (!value.input.options.multi) {
            fn = 'deleteOne'
            docsCount = +!!await STATE.collection.findOne(
              value.input.criteria
              , {projection: {_id: 1}}
            )
          } else {
            fn = 'deleteMany'
            docsCount = await STATE.collection
              .find(value.input.criteria)
              .count()
          }
          if (
            await confirm(`Are you sure you want to remove ${docsCount} documents?`)
          ) {
            result = await STATE.collection[fn](
              value.input.criteria,
              value.input.options
            )
            textbox.setValue(`${result.result.n} documents deleted`)
          }
          break
      }
      input = value.lazy
    }
  }

  const {criteria, projection, sort} = lazy.parse(input)
  return {collection, criteria, projection, sort}
}

const drawDocuments = async (name, criteria = {}, projection = {}, sort = {}) => {
  if (name) {
    STATE.criteria = criteria
    STATE.projection = projection
    STATE.sort = sort

    const options = {limit: LIMIT}

    STATE.collection = STATE.db.collection(name)
    STATE.docsCount = await STATE.collection
      .find(STATE.criteria)
      .skip(STATE.skip)
      .count()
    drawBottom()

    if (projection) {
      options.projection = STATE.projection
    }
    STATE.docs = await STATE.collection
      .find(STATE.criteria, options)
      .sort(STATE.sort)
      .skip(STATE.skip)
      .toArray()
  }

  const header = ['_id', ..._.keys(STATE.projection)]
  for (let doc of STATE.docs)
    for (let k in doc)
      if (!header.includes(k)) header.push(k)
  STATE.headerLast = _.clone(header)
  if (STATE.offset > 0) {
    header.splice(0, STATE.offset)
  }

  right.width = '100%-17'
  right.setData([
    header,
    ...lazy.colorize(STATE.docs, header, {fg2: THEME.fg2})
  ])
}

const init = async () => {
  if (SSH) {
    const matches = SSH.match(/^(([0-9A-Za-z]+)@)?([0-9A-Za-z\.]+)(:([\d]+))?/)
    if (matches) {
      let password = ''

      const privatekeyPath = `${process.env.HOME}/.ssh/id_rsa`
      const privatekey = fs.existsSync(privatekeyPath) ?
        fs.readFileSync(privatekeyPath) : undefined
      if (!privatekey) {
        const answer = await prompt('Password:')
        if (answer !== null) {
          password = answer
        }
      }
      hyperjump()
      tunnel({
        username: matches[2] || process.env.USER,
        password: password,
        privateKey: privatekey,
        host: matches[3],
        port: matches[5] || 22,
        dstHost: HOST,
        dstPort: PORT,
        localHost: '127.0.0.1',
        localPort: 37017
      }, (error, server) => {
        if (error) {
          if (screen._.loader) {
            screen._.loader.destroy()
          }
          textbox.setValue(error.toString())
          return
        }
        server.on('error', (error) => {
          if (screen._.loader) {
            screen._.loader.destroy()
          }
          textbox.setValue(error.toString())
        })
      })
    }
  } else {
    setTimeout(() => {
      if (!STATE.dbs && !STATE.db) {
        loading()
      }
    }, 100)
  }

  try {
    STATE.client = await mongodb.MongoClient
      .connect(URL || `mongodb://${!SSH ? HOST : '127.0.0.1'}:${!SSH ? PORT : 37017}`, {
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 3000,
      })
  } catch (e) {
    if (screen._.loader) {
      screen._.loader.destroy()
    }
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
    let content = `Error: couldn\'t connect to server ${HOST}:${PORT}`
    if (SSH) {
      content += ` via ${SSH}`
    }
    message.width = content.length + 4
    message.display(` ${content} `, 0, () => {
      process.exit(0)
    })
    return
  } finally {
    if (screen._.hyperjump) {
      screen._.hyperjump.destroy()
      loading()
    }
  }

  if (!ARGS[0]) {
    await drawDBs()
    focus(0)
  } else {
    await drawCollections(ARGS[0])
    if (!ARGS[1]) {
      focus(0)
    } else {
      left.select(left.fuzzyFind(ARGS[1], false))
      await drawDocuments(ARGS[1])
      focus(1)
    }
  }
  if (screen._.loader) {
    screen._.loader.destroy()
  }

  if (fs.existsSync(HISTORY)) {
    STATE.history.commands = fs
      .readFileSync(HISTORY, 'utf-8')
      .trim()
      .split('\n')
  }
}
init()
