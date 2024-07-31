import sqlite3, { type RunResult } from 'sqlite3'
import { type Db, type DbCol } from '.'

const { Database } = sqlite3.verbose()

export default class DbSqlite implements Db {
  db: sqlite3.Database
  constructor(filename: string) {
    this.db = new Database(filename)
  }
  tables() {
    return new Promise<string[]>((resolve: any, reject: any) => {
      this.db.all('SELECT name FROM sqlite_master WHERE type = "table"', (err: Error | null, res: any) => {
        if (err) return reject(err)

        resolve(res.map((i: any) => i.name).sort((a: string, b: string) => a.localeCompare(b)))
      })
    })
  }
  async databases(): Promise<string[]> {
    return []
  }
  setDb(db: string): void {}
  cols(table: string) {
    return new Promise<DbCol[]>((resolve: any, reject: any) => {
      this.db.all(`PRAGMA table_info(${table})`, (err: Error | null, res: any) => {
        if (err) return reject(err)
        const cols = res.find((i: any) => i.pk === 1) ? [] : [{ name: 'rowid', type: 'INTEGER', pk: 1 }]

        resolve([...cols, ...res])
      })
    })
  }
  async rows(
    table: string,
    where: object = {},
    order: object = {},
    skip: number = 0,
    limit: number = 100
  ): Promise<[string, number, object[], undefined]> {
    const count = await new Promise<number>((resolve, reject) => {
      this.db.get(`SELECT COUNT(*) FROM ${table}`, (err: Error | null, res: RunResult) => {
        if (err) return reject(err)

        resolve(res['COUNT(*)'])
      })
    })

    let sql = `SELECT rowid, * FROM ${table}${
      Object.keys(where).length > 0
        ? ` WHERE ${Object.entries(where)
            .map(([k, v]) => (v.$regex ? `${k} LIKE '%${v.$regex}%'` : `${k} = '${v}'`))
            .join(' AND ')}`
        : ''
    }${
      Object.keys(order).length > 0
        ? ` ORDER BY ${Object.entries(order)
            .map(([k, v]) => `${k} ${v === 1 ? 'ASC' : 'DESC'}`)
            .join(', ')}`
        : ''
    }${count > limit ? ` LIMIT ${limit}` : ''}${skip > 0 ? ` OFFSET ${skip}` : ''}`

    const rows = await new Promise<object[]>(resolve => {
      try {
        this.db.all(sql, (err: Error | null, res: any) => {
          if (err) resolve([])

          resolve(res)
        })
      } catch (e) {
        resolve([])
      }
    })

    sql = sql.replace('SELECT rowid, ', 'SELECT ').replace(' ORDER BY id ASC', '')

    return [sql, count, rows, undefined]
  }
  id(cols: DbCol[]) {
    return cols.find(({ pk }) => pk === 1)?.name ?? 'rowid'
  }
  types() {
    return {
      boolean: { icon: '', color: 'Red' },
      datetime: { icon: '', color: 'Red' },
      integer: { icon: '', color: 'Magenta' },
      integer_unsigned: { icon: '', color: 'Magenta' },
      numeric: { icon: '', color: 'Magenta' },
      nvarchar: { icon: '', color: 'Yellow' },
      text: { icon: '', color: 'Yellow' }
    }
  }
  format(_cols: DbCol[], rows: object[]) {
    return rows
  }
  async template(_table: string, cols: DbCol[], jsons: object[] | undefined) {
    return (jsons || [{}]).map((json: object) =>
      Object.fromEntries(
        cols
          .filter(i => i.name !== this.id(cols as DbCol[]))
          .map(({ name, type }) => [name, json[name] || (type === 'INTEGER' ? 0 : '')])
      )
    )
  }
  async insert(table: string, _cols: DbCol[], jsons: object[]) {
    const ids: string[] = []
    for (const jsonNew of jsons) {
      try {
        const id = await new Promise<string>(resolve => {
          this.db.run(
            `INSERT INTO ${table} VALUES (${Object.keys(jsonNew)
              .map(_ => '?')
              .join(', ')})`,
            [...Object.values(jsonNew)],
            function (err: Error | null) {
              if (err) throw err

              resolve(this.lastID.toString())
            }
          )
        })
        ids.push(id)
      } catch (e) {
        return null
      }
    }
    return ids
  }
  async update(table: string, _cols: DbCol[], jsonsNew: any, jsonsOld: any) {
    const ids: string[] = []
    for (const index in jsonsNew) {
      const jsonNew = jsonsNew[index]
      const jsonOld = jsonsOld[index]

      const rowid = jsonOld[Object.keys(jsonOld)[0]]
      const changes = Object.keys(jsonOld)
        .map(i => jsonOld[i].toString() !== jsonNew[i].toString() && [i, jsonNew[i]])
        .filter(i => i)

      try {
        const id = await new Promise<string | null>(resolve => {
          if (changes.length < 1) return resolve(null)

          const res = Object.fromEntries(changes as any)
          this.db.run(
            `UPDATE ${table} SET ${Object.keys(res).map(i => i + ' = ?')} WHERE rowid = ?`,
            [...Object.values(res), rowid],
            (err: Error | null) => {
              if (err) throw err

              resolve(rowid)
            }
          )
        })
        if (id) ids.push(id)
      } catch (e) {
        return null
      }
    }

    return ids
  }
  delete(table: string, _cols: DbCol[], ids: number | number[]) {
    if (!Array.isArray(ids)) ids = [ids]

    return new Promise<string[] | null>(resolve => {
      const statement = this.db.prepare(`DELETE FROM ${table} WHERE rowid = ?`)
      for (const i of ids as number[]) statement.run(i)
      statement.finalize((err: Error | null) => {
        if (err) return resolve(null)

        resolve((ids as number[]).map((id: number) => id.toString()))
      })
    })
  }
  createTable(table: string) {
    return new Promise<boolean>(resolve => {
      this.db.run(`CREATE TABLE ${table} (id INTEGER)`, (err: Error | null) => {
        if (err) return resolve(false)

        resolve(true)
      })
    })
  }
  renameTable(table: string, tableNew: string) {
    return new Promise<boolean>(resolve => {
      this.db.run(`ALTER TABLE ${table} RENAME TO ${tableNew}`, (err: Error | null) => {
        if (err) return resolve(false)

        resolve(true)
      })
    })
  }
  dropTable(table: string) {
    return new Promise<boolean>(resolve => {
      this.db.run(`DROP TABLE ${table}`, (err: Error | null) => {
        if (err) return resolve(false)

        resolve(true)
      })
    })
  }
}
