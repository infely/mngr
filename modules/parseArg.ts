import process, { argv } from 'node:process'
import { TYPES } from '../hooks/useDb'

let url: string = ''
if (argv.length > 2) {
  url = argv[argv.length - 1]
  if (!url.includes('://')) {
    if (url.endsWith('.json')) url = `json://${url}`
    if (url.endsWith('.db') || url.endsWith('.sqlite') || url.endsWith('sqlite3')) url = `sqlite://${url}`
  }
}

if (!url) {
  console.log(`USAGE:
  mngr [URL]

EXAMPLES:
  mngr db.json
  mngr json://db.json

  mngr mongodb:///db
  mngr mongodb://localhost/db

  mngr postgres:///db
  mngr postgres://localhost/db

  mngr mariadb:///db
  mngr mariadb://localhost/db

  mngr db.sqlite3
  mngr sqlite://db.sqlite3
  mngr sqlite://db.sqlite
  mngr sqlite://db.db`)
  process.exit(0)
}

if (!url.includes('://') || !Object.keys(TYPES).includes(url.split('://')[0])) {
  console.log('protocol not supported')
  process.exit(0)
}

export default url
