import pg, { type Client } from 'pg'
import { type Db, type DbCol } from '.'

export default class DbPostgresql implements Db {
  db: Client
  constructor(url: string) {
    const [host, database] = url.split('/')
    this.db = new pg.Client({ host, database })
    this.db.connect()
  }
  async databases() {
    const { rows } = await this.db.query('SELECT * FROM pg_catalog.pg_database')
    return rows.map(i => i.datname).sort((a: string, b: string) => a.localeCompare(b))
  }
  setDb(db: string): void {}
  async tables() {
    const { rows } = await this.db.query(
      `SELECT * FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'`
    )
    return rows
      .map((i: any) => i.tablename)
      .filter(i => !i.startsWith('_'))
      .sort((a: string, b: string) => a.localeCompare(b))
  }
  async cols(table: string) {
    const { rows } = await this.db.query('SELECT * FROM information_schema.columns WHERE table_name = $1', [table])
    return rows.map((i: any, index: number) => ({ name: i.column_name, type: i.udt_name, pk: index === 0 ? 1 : 0 }))
  }
  async rows(
    table: string,
    where: object = {},
    order: object = {},
    skip: number = 0,
    limit: number = 100
  ): Promise<[string, number, object[], undefined]> {
    const { rows: res } = await this.db.query(`SELECT COUNT(*) FROM "${table}"`)
    const count = parseInt(res?.[0]?.count ?? 0)

    let sql = `SELECT * FROM "${table}"${
      Object.keys(where).length > 0
        ? ` WHERE ${Object.entries(where)
            .map(([k, v]) => (v.$regex ? `"${k}" LIKE '%${v.$regex}%'` : `"${k}" = '${v}'`))
            .join(' AND ')}`
        : ''
    }${
      Object.keys(order).length > 0
        ? ` ORDER BY ${Object.entries(order)
            .map(([k, v]) => `"${k}" ${v === 1 ? 'ASC' : 'DESC'}`)
            .join(', ')}`
        : ' ORDER BY 1'
    }${count > limit ? ` LIMIT ${limit}` : ''}${skip > 0 ? ` OFFSET ${skip}` : ''}`

    let rows: any[] = []
    try {
      const res = await this.db.query(sql)
      rows = res.rows
    } catch {}

    sql = sql.replace(' ORDER BY 1', '')

    return [sql, count, rows, undefined]
  }
  id(cols: DbCol[]) {
    return cols.find(({ pk }) => pk === 1)?.name ?? 'id'
  }
  types() {
    return {
      _float: { icon: '', color: 'Magenta' },
      _int: { icon: '', color: 'Magenta' },
      _text: { icon: '', color: 'Yellow' },
      bool: { icon: '', color: 'Red' },
      bytea: { icon: '', color: 'Magenta' },
      date: { icon: '', color: 'Red' },
      float: { icon: '', color: 'Magenta' },
      int: { icon: '', color: 'Magenta' },
      text: { icon: '', color: 'Yellow' },
      timestamp: { icon: '', color: 'Red' },
      varchar: { icon: '', color: 'Yellow' }
    }
  }
  format(cols: DbCol[], rows: object[]) {
    const types = Object.fromEntries(cols.map(({ name, type }) => [name, type]))
    return rows.map(row =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => {
          if (value !== null) {
            if (['date', 'timestamp', 'timestamptz'].includes(types[key])) value = value.toISOString()
            else if (types[key] === 'bytea') value = JSON.stringify(value)
            else if (types[key] === 'bool') value = (value as any).toString().toLowerCase() === 'true'
          }
          return [key, value]
        })
      )
    )
  }
  async template(table: string, cols: DbCol[], jsons: object[] | undefined) {
    const name = this.id(cols)
    const { rows: res } = await this.db.query(`SELECT "${name}" FROM "${table}" ORDER BY "${name}" DESC LIMIT 1`)
    let id = parseInt(res?.[0]?.[name] || 0)

    return (jsons || [{}]).map(json =>
      Object.fromEntries(cols.map(i => [i.name, i.name === name ? ++id : json[i.name]]))
    )
  }
  async insert(table: string, cols: DbCol[], jsons: object[]) {
    const name = this.id(cols)
    // const res = await this.db.query(`SELECT nextval(pg_get_serial_sequence('${table}', '${name}')) AS new_id`)
    // console.log(res)
    const ids: string[] = []
    for (const jsonNew of jsons) {
      const { rows: res } = await this.db.query(
        `INSERT INTO "${table}" VALUES (${Object.keys(jsonNew)
          .map((_, index) => `$${index + 1}`)
          .join(', ')}) RETURNING "${name}"`,
        Object.values(jsonNew)
      )

      ids.push(res?.[0]?.[name]?.toString())
    }

    return ids
  }
  async update(table: string, cols: DbCol[], jsonsNew: any, jsonsOld: any) {
    const ids: string[] = []
    for (const index in jsonsNew) {
      const jsonNew = jsonsNew[index]
      const jsonOld = jsonsOld[index]

      const name = this.id(cols)
      const rowid = jsonOld[name]
      const changes = Object.keys(jsonOld)
        .map(i => jsonOld[i]?.toString() !== jsonNew[i]?.toString() && [i, jsonNew[i] || null])
        .filter(i => i)

      const res = Object.fromEntries(changes as any)
      if (changes.length > 0) {
        await this.db.query(
          `UPDATE "${table}" SET ${Object.keys(res).map(
            (i, index) => `"${i}" = $${index + 1}`
          )} WHERE "${name}" = ${rowid}`,
          Object.values(res)
        )
        ids.push(rowid.toString())
      }
    }
    return ids
  }
  async delete(table: string, cols: DbCol[], ids: number | number[]) {
    const name = this.id(cols)

    if (!Array.isArray(ids)) ids = [ids]

    await this.db.query(
      `DELETE FROM "${table}" WHERE "${name}" IN (${ids.map((_, index) => `$${index + 1}`).join(', ')})`,
      ids
    )
    return (ids as number[]).map((id: number) => id.toString())
  }
  async createTable(table: string) {
    try {
      await this.db.query(`CREATE TABLE "${table}" (id SERIAL PRIMARY KEY)`)
      return true
    } catch (err) {
      return false
    }
  }
  async renameTable(table: string, tableNew: string) {
    try {
      await this.db.query(`ALTER TABLE "${table}" RENAME TO ${tableNew}`)
      return true
    } catch (err) {
      return false
    }
  }
  async dropTable(table: string) {
    try {
      await this.db.query(`DROP TABLE "${table}"`)
      return true
    } catch {
      return false
    }
  }
}
