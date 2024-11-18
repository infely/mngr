import { stat, writeFile, readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Renderer from 'react-curse'

// import { EJSON } from 'bson'

export default (jsons: any) => {
  const EDITOR = process.env.EDITOR || 'vim'
  const filename = join(tmpdir(), `mngr-${+new Date()}.json`)
  const json = JSON.stringify(jsons, undefined, 2)
    .split('\n')
    .map(i => i.startsWith('  ') && i.substring(1))
    .filter(i => i)
    .join('\n')

  return new Promise<object[]>(resolve => async () => {
    await writeFile(filename, json)
    const mtime = (await stat(filename)).mtimeMs

    const onExit = async () => {
      const mtimeNew = (await stat(filename)).mtimeMs
      if (mtime === mtimeNew) {
        unlink(filename)
        return resolve([])
      }

      const res = await readFile(filename, { encoding: 'utf8' })
      if (res.length === 0) {
        unlink(filename)
        return resolve([])
      }

      try {
        const jsonNew = JSON.parse(`[${res.trim().replace(/},$/, '}')}]`)
        unlink(filename)
        resolve(jsonNew)
      } catch {
        Renderer.spawnSync(EDITOR, [filename], { stdio: 'inherit' })
        onExit()
      }
    }

    Renderer.spawnSync(EDITOR, [filename], { stdio: 'inherit' })
    onExit()
  })
}
