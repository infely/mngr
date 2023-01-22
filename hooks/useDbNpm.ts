import DbJson from '../modules/db/json'
import DbMariadb from '../modules/db/mariadb'
import DbMongodb from '../modules/db/mongodb'
import DbPostgres from '../modules/db/postgres'
import DbSqlite from '../modules/db/sqlite'

export const TYPES = {
  json: DbJson,
  mariadb: DbMariadb,
  mongodb: DbMongodb,
  postgres: DbPostgres,
  sqlite: DbSqlite
}

type DbType = keyof typeof TYPES
let db: DbJson | DbMariadb | DbMongodb | DbPostgres | DbSqlite

export const initDb = (url: string) => {
  const [type, options] = url.split('://', 2)
  db = new TYPES[type as DbType](options)
}

export default () => db
