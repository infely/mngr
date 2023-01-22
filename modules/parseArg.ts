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
  console.log('usage: mngr db.json')
  process.exit(0)
}

if (!url.includes('://') || !Object.keys(TYPES).includes(url.split('://')[0])) {
  console.log('protocol not supported')
  process.exit(0)
}

export default url
