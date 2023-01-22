import mariadb, { type Pool } from 'mariadb'
import { type Db, type DbCol } from '.'

export default class DbMariadb implements Db {
  db: Pool
  constructor(url: string) {
    this.db = mariadb.createPool(`mariadb://root@${url}`)
  }
  async tables() {
    const res = await this.db.query('SHOW TABLES')
    return res.map((i: any) => Object.values(i)[0])
  }
  async cols(table: string) {
    const res = await this.db.query(`SHOW COLUMNS FROM ${table}`)
    return res.map(({ Field, Type, Key }) => ({ name: Field, type: Type, pk: Key === 'PRI' ? 1 : 0 }))
  }
  async rows(
    table: string,
    where: object = {},
    order: object = {},
    skip: number = 0,
    limit: number = 100
  ): Promise<[string, number, object[], undefined]> {
    const res = await this.db.query(`SELECT COUNT(*) FROM ${table}`)
    const count = parseInt(res?.[0]?.['COUNT(*)'] ?? 0)

    let sql = `SELECT * FROM ${table}${
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

    const rows = await this.db.query(sql)

    return [sql, count, rows, undefined]
  }
  id(cols: DbCol[]) {
    return cols.find(({ pk }) => pk === 1)?.name ?? 'id'
  }
  types() {
    return {
      char: { icon: 'ﮜ', color: 'Yellow' },
      date: { icon: '', color: 'Red' },
      decimal: { icon: '', color: 'Magenta' },
      int: { icon: '', color: 'Magenta' },
      tinyint: { icon: '', color: 'Magenta' },
      varchar: { icon: 'ﮜ', color: 'Yellow' }
    }
  }
  format(_cols: DbCol[], rows: object[]) {
    return rows
  }
  async template(table: string, cols: DbCol[], jsons: object[] | undefined) {
    const name = this.id(cols)
    const res = await this.db.query(`SELECT ${name} FROM ${table} ORDER BY ${name} DESC LIMIT 1`)
    let id = parseInt(res?.[0]?.[name] || 0)

    return (jsons || [{}]).map(json =>
      Object.fromEntries(cols.map(i => [i.name, i.name === name ? ++id : json[i.name]]))
    )
  }
  async insert(table: string, _cols: DbCol[], jsons: object[]) {
    const ids: string[] = []
    for (const jsonNew of jsons) {
      const res = await this.db.query(
        `INSERT INTO ${table} VALUES (${Object.keys(jsonNew)
          .map(_ => '?')
          .join(', ')})`,
        [...Object.values(jsonNew)]
      )

      ids.push(res.insertId.toString())
    }

    return ids
  }
  async update(table: string, cols: DbCol[], jsonsNew: any, jsonsOld: any) {
    const name = this.id(cols)

    const ids: string[] = []
    for (const index in jsonsNew) {
      const jsonNew = jsonsNew[index]
      const jsonOld = jsonsOld[index]
      const rowid = jsonOld[name]
      const changes = Object.keys(jsonOld)
        .map(i => jsonOld[i].toString() !== jsonNew[i].toString() && [i, jsonNew[i]])
        .filter(i => i)

      const res = Object.fromEntries(changes as any)
      await this.db.query(`UPDATE ${table} SET ${Object.keys(res).map(i => i + ' = ?')} WHERE ${name} = ?`, [
        ...Object.values(res),
        rowid
      ])

      ids.push(rowid.toString())
    }

    return ids
  }
  async delete(table: string, cols: DbCol[], ids: number | number[]) {
    const name = this.id(cols)

    if (!Array.isArray(ids)) ids = [ids]

    await this.db.query(`DELETE FROM ${table} WHERE (${name}) IN (?)`, [ids])
    return (ids as number[]).map((id: number) => id.toString())
  }
  async createTable(table: string) {
    try {
      await this.db.query(`CREATE TABLE ${table} (id INT AUTO_INCREMENT PRIMARY KEY)`)
      return true
    } catch (err) {
      return false
    }
  }
  async renameTable(table: string, tableNew: string) {
    try {
      await this.db.query(`ALTER TABLE ${table} RENAME TO ${tableNew}`)
      return true
    } catch (err) {
      return false
    }
  }
  async dropTable(table: string) {
    try {
      await this.db.query(`DROP TABLE ${table}`)
      return true
    } catch {
      return false
    }
  }
}
