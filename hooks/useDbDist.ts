import DbJson from '../modules/db/json'

export const TYPES = {
  json: DbJson
}

type DbType = keyof typeof TYPES
let db: DbJson

export const initDb = (url: string) => {
  const [type, options] = url.split('://', 2)
  db = new TYPES[type as DbType](options)
}

export default () => db
