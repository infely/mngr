import DbJson from '../modules/db/json'
import DbMariadb from '../modules/db/mariadb'
import DbMongodb from '../modules/db/mongodb'
import DbPostgresql from '../modules/db/postgresql'
import DbSqlite from '../modules/db/sqlite'

export const TYPES = {
  json: { db: DbJson, aliases: 'js' },
  mariadb: { db: DbMariadb, aliases: 'mysql' },
  mongodb: { db: DbMongodb, aliases: 'mongo' },
  postgresql: { db: DbPostgresql, aliases: ['pg', 'postgres'] },
  sqlite: { db: DbSqlite, aliases: 'sqlite3' }
}

type DbType = keyof typeof TYPES
let db: DbJson | DbMariadb | DbMongodb | DbPostgresql | DbSqlite

export const initDb = (url: string) => {
  const [type, options] = url.split('://', 2)
  db = new TYPES[type as DbType].db(options)
}

export default () => db
