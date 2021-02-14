'use strict'

const lazy = module.exports = {
  _parseStep: (i, level = 0) => {
    let matches

    while (matches = i.match(/^\{(.*?)\}$/)) i = matches[1]

    if (i.match(/^[0-9A-Fa-f]{24}$/)) {
      return ['_id', mongodb.ObjectID(i)]
    }

    const parts = lazy.splitByOuter(':', i)
    i = _.map([parts.shift(), parts.join(':')], (i) => i.trim())
    if (!i[1]) {
      if (level == 0) {
        if (i[0].startsWith('+')) {
          this.sort[i[0].replace(/^\+/, '') || '_id'] = 1
        } else if (i[0].startsWith('-')) {
          this.sort[i[0].replace(/^-/, '') || '_id'] = -1
        } else if(i[0]) {
          this.projection[i[0]] = 1
        }
      } else {
        return
      }
    } else {
      switch (true) {
        // ObjectID
        case /^[0-9A-Fa-f]{24}$/.test(i[1]):
          i[1] = mongodb.ObjectID(i[1])
          break
        case !!(matches = i[1].match(/^\{\$oid:['"]([0-9A-Fa-f]{24})['"]\}$/)):
          i[1] = mongodb.ObjectID(matches[1])
          break

        // number
        case parseFloat(i[1]).toString() === i[1]:
          i[1] = parseFloat(i[1])
          break

        // string
        case (/^['"].*['"]$/).test(i[1]):
          i[1] = i[1].replace(/^['"](.*)['"]$/, '$1')
          break

        // date
        case !!(matches = i[1].match(/^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}:\d{2}(\.\d{3})?(\+\d{2}:?\d{2})?$/)):
          i[1] = moment(matches[0]).toDate()
          break
        case !!(matches = i[1].match(/^\{\$date:['"](\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}:\d{2}(\.\d{3})?((\+\d{2}:?\d{2})|Z)?)['"]\}$/)):
          i[1] = moment(matches[1]).toDate()
          break

        // regex
        case !!(matches = i[1].match(/^\/(.*)\/([imxs]*)$/)):
          i[1] = {$regex: new RegExp(matches[1], matches[2])}
          break

        case i[1].startsWith('{') && i[1].endsWith('}'):
          i[1] = _.fromPairs(
            _.filter(
              _.map(
                lazy.splitByOuter(
                  ',',
                  i[1].replace(/^\{(.*?)\}$/, '$1')
                ), k => lazy._parseStep(k, level + 1)
              )
            )
          )
          break
      }
      return i
    }
  },

  parse: (input) => {
    this.projection = {}
    this.sort = {}
    this.criteria = _.fromPairs(
      _.filter(
        _.map(
          lazy.splitByOuter(',', input),
          i => lazy._parseStep(i)
        )
      )
    )
    return {
      criteria: this.criteria,
      projection: this.projection,
      sort: this.sort
    }
  },

  splitByOuter: (splitter, input) => {
    const array = ['']
    const levels = _.fromPairs(_.map('\'"([{', i => [i, 0]))
    for (let i in input) {
      const char = input[i]
      if (["'", '"'].includes(char)) {
        levels[char] = +!levels[char]
      } else if (['(', '[', '{'].includes(char)) {
        levels[char]++
      } else if ([')', ']', '}'].includes(char)) {
        levels[{')': '(', ']': '[', '}': '{'}[char]]--
      } else if (char === splitter && !_.sum(_.values(levels))) {
        array.push('')
        continue
      }
      array[array.length - 1] += char
    }
    return array
  },

  db: {
    init: function (collection) {
      this.collection = collection
      this.output = []

      return this
    },
    find: function (criteria = {}, projection = {}) {
      this.method = 'find'
      this.input = {criteria, projection}

      this.output.push(lazy.stringify(criteria).replace(/^\{(.*)\}$/, '$1'))
      if (!_.isEmpty(projection)) this.output.push(_.keys(projection))
      return this
    },
    update: function (criteria = {}, update = {}, options = {}) {
      this.method = 'update'
      this.input = {criteria, update, options}

      this.output.push(lazy.stringify(criteria).replace(/^\{(.*)\}$/, '$1'))
      return this
    },
    remove: function (criteria = {}, options = {}) {
      this.method = 'remove'
      this.input = {criteria, options}

      return this
    },
    sort: function (sort) {
      this.output.push(_.map(sort, (i, k) => {
        return (i >= 0 ? '+' : '-')+ k
      }))
      return this
    },
    _val: function() {
      return {
        collection: this.collection,
        method: this.method,
        input: this.input,
        lazy: this.output.join(',')
      }
    }
  },

  stringify: (json, space) => {
    return EJSON.stringify(json, (k, v) => {
      if (v) {
        if (v.$regularExpression) return {
          $regex:
            '/' + v.$regularExpression.pattern +
            '/' + v.$regularExpression.options
        }
      }
      return v
    }, space)
      .replace(/\"([^"]+)\":/g, '$1:')
      .replace(/\{\$regex:\"(.*?)\"\}/g, (...matches) => {
        return matches[1].replace(/\\\\/g, '\\')
      })
      .replace(/\{\$regex:(.*?)\}/g, '$1')
  },

  preview: (json, space) => {
    return EJSON.stringify(json, (k, v) => {
      if (v) {
        if (v.$oid) return {$oid: `{magenta-fg}${v.$oid}{/}`}
        if (typeof v === 'number') return {$number: `{magenta-fg}${v}{/}`}
        if (typeof v === 'string' && !k.startsWith('$')) return {$string: `{yellow-fg}${v}{/}`}
        if (v.$date) return {$date: `{magenta-fg}${moment(v.$date).format('YYYY-MM-DD[T]HH:mm:ss.SSSZZ')}{/}`}
      }
      return v
    }, space)
      .replace(/\{\s*"\$(oid|number|date)":\s*\"(.*?)\"\s*\}/g, '$2')
      .replace(/\{\s*"\$(string)":\s*\"(.*?)\"\s*\}/g, '"$2"')
      .replace(/\"([^"]+)\":/g, '{cyan-fg}$1{/}:')
  },

  colorize: (input, fields, colors) => {
    return _.map(input, (i) => {
      return _.map(fields, (j) => {
        const v = i[j]

        let str
        switch(true) {
          case v instanceof mongodb.ObjectID:
            return `{magenta-fg}${v.toString()}{/}`
            break
          case typeof v === 'number':
            return `{magenta-fg}${v}{/}`
            break
          case typeof v === 'string':
            str = v.replace(/[\n\r\t]/g, '')
            if (str.length > 24) {
              str = `${str.substr(0, 23)}{gray-fg}~`
            }
            return `{yellow-fg}${str}{/}`
            break
          case v instanceof Date:
            str = moment(v).format(
              'YYYY-MM-DD' +
              `[{${colors.fg2}-fg}]T[{/${colors.fg2}-fg}]` +
              'HH:mm:ss' +
              `[{${colors.fg2}-fg}].SSS`
            )
            return `{magenta-fg}${str}{/}`
            break
          case v instanceof Array:
            str = JSON.stringify(v)
            str = str.substr(1, str.length - 2)
            if (str.length > 22) {
              const len = v.length.toString()
              str = `${str.substr(0, 22 - len.length)}{gray-fg}~${len}`
            } else {
              str += '{cyan-fg}]'
            }
            return `{cyan-fg}[{${colors.fg2}-fg}${str}{/}`
            break
          case v instanceof Object:
            str = lazy.stringify(v)
            str = str.substr(1, str.length - 2)
            if (str.length > 22) {
              const len = _.keys(v).length.toString()
              str = `${str.substr(0, 22 - len.length)}{gray-fg}~${len}`
            } else {
              str += '{cyan-fg}{close}'
            }
            return `{cyan-fg}{open}{${colors.fg2}-fg}${str}{/}`
            break
          default:
            return v && v.toString() || ''
        }
      })
    })
  }
}
