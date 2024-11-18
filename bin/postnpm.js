#!/usr/bin/env node
import { chmodSync, readFileSync, writeFileSync } from 'node:fs'

const makeJs = () => {
  const file = `.npm/index.js`
  writeFileSync(file, `#!/usr/bin/env node\n${readFileSync(file, 'utf8')}`)
  chmodSync(file, '755')
}

const makeJson = () => {
  const json = JSON.parse(readFileSync('package.json', 'utf8'))

  const keys = [
    'name',
    'version',
    'description',
    'keywords',
    'author',
    'repository',
    'homepage',
    'license',
    'type',
    'dependencies'
  ]
  const jsonNew = {
    ...Object.fromEntries(Object.entries(json).filter(([key]) => keys.includes(key))),
    ...{
      bin: 'index.js'
    }
  }
  writeFileSync('.npm/package.json', JSON.stringify(jsonNew, null, 2))
}

const makeReadme = () => {
  const data = readFileSync('README.md', 'utf8')

  const dataNew = data
    .split('\n')
    .map(i => i.replace('media/', 'https://raw.githubusercontent.com/infely/mngr/HEAD/media/'))
    .join('\n')
  writeFileSync('.npm/README.md', dataNew)
}

makeJs()
makeJson()
makeReadme()
