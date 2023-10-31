import { MongoClient, ObjectId, type Db as MongoDb, type Sort } from 'mongodb'
import { type Db, type DbCol } from '.'

export default class DbMongodb implements Db {
  db: MongoDb
  constructor(url: string) {
    const [hostport, table] = url.split('/', 2)
    const client = new MongoClient(`mongodb://${hostport}`)
    client.connect()
    this.db = client.db(table)
  }
  async tables() {
    const tables = await this.db.listCollections().toArray()
    return tables.map(({ name }) => name).sort((a: string, b: string) => a.localeCompare(b))
  }
  cols(_table: string, rows?: object[] | object[][]): DbCol[] {
    const cols = {}
    rows?.forEach(row =>
      Object.entries(row).forEach(([name, value]) => {
        let type = 'string'
        if (typeof value === 'object') {
          if (value instanceof ObjectId) type = 'id'
          else if (value instanceof Date) type = 'datetime'
          else type = 'object'
        } else if (typeof value === 'number') {
          type = 'number'
        } else if (typeof value === 'boolean') {
          type = 'boolean'
        }
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

    const count = await this.db.collection(table).countDocuments()

    const sql = `db.${table}.find(${JSON.stringify(where)})${
      Object.keys(order).length > 0 ? `.sort(${JSON.stringify(order)})` : ''
    }${skip > 0 ? `.skip(${skip})` : ''}${count > limit ? `.limit(${limit})` : ''}`

    where = Object.fromEntries(
      Object.entries(where).map(([key, value]) => {
        if (key) value = new ObjectId(value.$regex ? value.$regex : value)
        if (value.$regex) value = { $regex: new RegExp(value.$regex, 'i') }
        return [key, value]
      })
    )
    const rows: object[] = await this.db
      .collection(table)
      .find(where)
      .sort(order as Sort)
      .skip(skip)
      .limit(limit)
      .toArray()

    const cols = this.cols(table, rows)

    return [sql, count, rows, cols]
  }
  id() {
    return '_id'
  }
  types() {
    return {
      array: { icon: '', color: 'Red' },
      boolean: { icon: '', color: 'Red' },
      datetime: { icon: '', color: 'Red' },
      id: { icon: '', color: 'Magenta' },
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
          if (types[key] === 'datetime') value = value.toISOString()
          else if (types[key] === 'object') value = JSON.stringify(value)
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
        else if (types[key] === 'datetime') value = new Date(value as any)
        else if (types[key] === 'object') value = JSON.parse(value as any)
        else if (types[key] === 'boolean') value = (value as any).toString().toLowerCase() === 'true'
        else if ((value as any).toString().toLowerCase() === 'null') value = null
        return [key, value]
      })
    )
  }
  async template(_table: string, _cols: DbCol[], jsons: object[] | undefined) {
    if (!jsons) return [{}]

    return jsons.map(json => Object.fromEntries(Object.entries(json).filter(([k]) => k !== this.id())))
  }
  async insert(table: string, cols: DbCol[], jsons: object[]) {
    const { insertedIds } = await this.db
      .collection(table)
      .insertMany(jsons.map(jsonNew => this.#convert(cols, jsonNew)))
    return Object.values(insertedIds).map(i => i.toString())
  }
  async update(table: string, cols: DbCol[], jsonsNew: any, jsonsOld: any) {
    const ids: string[] = []
    for (const index in jsonsNew) {
      const jsonNew = jsonsNew[index]
      const jsonOld = jsonsOld[index]

      const { _id } = jsonOld
      const $set = this.#convert(
        cols,
        Object.fromEntries(
          Object.entries(jsonNew)
            .filter(([key]) => key !== this.id())
            .map(([key, value]) => jsonOld[key] !== value && [key, value])
            .filter(i => i) as any
        )
      )
      const $unset = this.#convert(
        cols,
        Object.fromEntries(
          Object.keys(jsonOld)
            .filter(key => key !== this.id())
            .map(key => jsonNew[key] === undefined && [key, 1])
            .filter(i => i) as any
        )
      )

      await this.db.collection(table).updateOne({ _id }, { $set, $unset })
      ids.push(_id.toString())
    }

    return ids
  }
  async delete(table: string, _cols: DbCol[], ids: number | number[]) {
    if (Array.isArray(ids)) {
      await this.db.collection(table).deleteMany({ _id: { $in: ids } })
      return ids.map(id => id.toString())
    } else {
      await this.db.collection(table).deleteOne({ _id: ids })
      return ids.toString()
    }
  }
  async createTable(table: string) {
    try {
      await this.db.createCollection(table)
      return true
    } catch (err) {
      return false
    }
  }
  async renameTable(table: string, tableNew: string) {
    try {
      await this.db.renameCollection(table, tableNew)
      return true
    } catch (err) {
      return false
    }
  }
  async dropTable(table: string) {
    try {
      await this.db.dropCollection(table)
      return true
    } catch (e) {
      return false
    }
  }
}
