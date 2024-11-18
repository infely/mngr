import { type Db, type DbCol } from '.'
import { readFile, writeFile } from 'fs/promises'

export default class DbJson implements Db {
  #filename: string
  constructor(filename: string) {
    this.#filename = filename
  }
  #isCollection(value: any) {
    return Array.isArray(value) && (value.length === 0 || value.find(i => typeof i === 'object'))
  }
  async #read() {
    try {
      const data = await readFile(this.#filename, 'utf8')
      const json = JSON.parse(data)
      return json
    } catch (err) {
      if (err.code === 'ENOENT') {
        await this.#write({})
        return {}
      } else if (err instanceof SyntaxError) {
        process.exit()
      } else {
        throw err
      }
    }
  }
  #write(json: object) {
    return writeFile(this.#filename, JSON.stringify(json, null, 2))
  }
  async tables() {
    const json = await this.#read()
    const entries = Object.entries(json)
    const filtered = entries.filter(([, value]) => this.#isCollection(value))
    const tables = filtered.map(([key]) => key).sort((a: string, b: string) => a.localeCompare(b))
    if (entries.length > filtered.length) return ['.', ...tables]

    return tables
  }
  cols(_table: string, rows?: object[] | object[][]) {
    const cols = {}
    rows?.forEach(row =>
      Object.entries(row).forEach(([name, value]) => {
        let type = 'string'
        if (typeof value === 'number') type = 'number'
        else if (typeof value === 'boolean') type = 'boolean'
        else if (Array.isArray(value)) type = 'array'
        else if (typeof value === 'object') type = 'object'
        if (cols[name] === undefined) cols[name] = type
      })
    )
    return Object.entries(cols).map(([name, type]) => ({ name, type })) as DbCol[]
  }
  async rows(
    table: string,
    where: object = {},
    order: object = {},
    skip: number = 0,
    limit: number = 100
  ): Promise<[string, number, object[], DbCol[]]> {
    if (!table) return ['', 0, [], []]

    let sql = `db.${table}(${JSON.stringify(where)}).sort(${JSON.stringify(order)})`.replace('.sort({})', '')

    const json = await this.#read()

    let rows: object[]
    if (table === '.') {
      rows = [Object.fromEntries(Object.entries(json).filter(([, value]) => !this.#isCollection(value)))]
      sql = sql.substring(0, 2) + sql.substring(4)
    } else {
      rows = json[table]
    }

    const count = rows.length

    if (Object.keys(where).length > 0) {
      Object.entries(where).forEach(([key, value]) => {
        rows = rows.filter(
          value.$regex ? (i: object) => new RegExp(value.$regex, 'i').test(i[key]) : (i: object) => value === i[key]
        )
      })
    }
    if (Object.keys(order).length > 0) {
      Object.entries(order)
        .reverse()
        .forEach(([key, value]) => {
          rows = rows.sort((a: object, b: object) => {
            if (a[key] === b[key]) return 0
            return a[key] > b[key] ? value : value * -1
          })
        })
    }

    rows = rows.filter((_, index) => index >= skip && index < skip + limit)

    const cols = this.cols(table, rows)

    return [sql, count, rows, cols]
  }
  id() {
    return 'id'
  }
  types() {
    return {
      array: { icon: '', color: 'Red' },
      boolean: { icon: '', color: 'Red' },
      number: { icon: '', color: 'Magenta' },
      object: { icon: '', color: 'Red' },
      string: { icon: '', color: 'Yellow' }
    }
  }
  format(cols: DbCol[], rows: object[]) {
    const types = Object.fromEntries(cols.map(({ name, type }) => [name, type]))
    return rows.map(row =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => {
          if (['object', 'array'].includes(types[key])) value = JSON.stringify(value)
          return [key, value]
        })
      )
    )
  }
  #convert(cols: DbCol[], jsonNew: any) {
    const types = Object.fromEntries(cols.map(({ name, type }) => [name, type]))
    return Object.fromEntries(
      Object.entries(jsonNew).map(([key, value]) => {
        if (types[key] === 'number') value = parseInt(value as any) || 0
        else if (types[key] === 'boolean') value = (value as any).toString().toLowerCase() === 'true'
        return [key, value]
      })
    )
  }
  async template(_table: string, _cols: DbCol[], jsons: object[] | undefined) {
    if (!jsons) return [{}]

    return jsons.map(json => Object.fromEntries(Object.entries(json).filter(([k]) => k !== this.id())))
  }
  async insert(table: string, cols: DbCol[], jsons: object[]) {
    if (table === '.') return null

    const json = await this.#read()
    const ids = jsons.map(jsonNew => {
      if (!jsonNew[this.id()]) {
        const id = json[table].reduce((max: number, { id }) => Math.max(max, id), 0) + 1
        delete jsonNew[this.id()]
        jsonNew = { id, ...jsonNew }
      }

      if (json[table].find(({ id }) => id.toString() === jsonNew[this.id()].toString())) return null

      json[table].push(this.#convert(cols, jsonNew))
      return jsonNew[this.id()].toString()
    })

    await this.#write(json)
    return ids
  }
  async update(table: string, cols: DbCol[], jsonsNew: any, jsonsOld: any) {
    const json = await this.#read()

    if (table === '.') {
      const collections = Object.fromEntries(Object.entries(json).filter(([, value]) => this.#isCollection(value)))
      await this.#write({ ...this.#convert(cols, jsonsNew[0]), ...collections })
      return '.'
    } else {
      jsonsOld.forEach((jsonOld: object, index: number) => {
        const indexOld = json[table].findIndex(({ id }) => id === jsonOld[this.id()])
        if (indexOld === -1) return false

        json[table][indexOld] = this.#convert(cols, jsonsNew[index])
      })
      await this.#write(json)
      return jsonsOld.map((i: object) => i[this.id()].toString())
    }
  }
  async delete(table: string, _cols: DbCol[], ids: number | number[]) {
    if (table === '.') return null

    if (!Array.isArray(ids)) ids = [ids]
    const json = await this.#read()

    json[table] = json[table].filter((i: any) => !(ids as number[]).includes(i[this.id()]))
    await this.#write(json)
    return ids.map(id => id.toString())
  }
  async createTable(table: string) {
    if (table === '.') return false

    const json = await this.#read()
    if (json[table] !== undefined) return false

    json[table] = []
    await this.#write(json)

    return true
  }
  async renameTable(table: string, tableNew: string) {
    if (table === '.') return false
    if (table === tableNew) return false

    const json = await this.#read()
    if (json[table] === undefined) return false
    if (json[tableNew] !== undefined) return false

    json[tableNew] = json[table]
    delete json[table]
    await this.#write(json)

    return true
  }
  async dropTable(table: string) {
    if (table === '.') return false

    const json = await this.#read()
    if (json[table] === undefined) return false

    delete json[table]
    await this.#write(json)

    return true
  }
}
