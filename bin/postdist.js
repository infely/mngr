#!/usr/bin/env node

import { chmodSync, readFileSync, writeFileSync } from 'node:fs'

const makeJs = () => {
  const file = `.dist/index.cjs`
  writeFileSync(file, `#!/usr/bin/env node\n${readFileSync(file, 'utf8')}`)
  chmodSync(file, '755')
}

makeJs()
