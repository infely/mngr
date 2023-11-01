import React, { useMemo, useState } from 'react'
import ReactCurse, { Text, Separator, useInput, useExit, useSize } from 'react-curse'
import Sidebar from './screens/Sidebar'
import Main from './screens/Main'
import Help from './components/Help'
import { useStore } from './store'
import { initDb } from './hooks/useDb'
import url from './modules/parseArg'

initDb(url)

const App = () => {
  const { height } = useSize()
  const focus = useStore(s => s.focus)
  const sql = useStore(s => s.sql)
  const palette = useStore(s => s.palette)
  const [help, setHelp] = useState(false)

  const icon = useMemo(() => {
    const [protocol] = url.split('://', 2)
    return {
      json: ' ',
      mariadb: ' ',
      mongodb: ' ',
      postgresql: ' ',
      sqlite: ' '
    }[protocol]
  }, [url])

  useInput(
    (input: string) => {
      if (![null, 'sidebar', 'main'].includes(focus)) return

      if (input === '\x10\x0d') useExit()
      if (input === 'q') useExit()
      if (input === '?') setHelp(i => !i)
      if (input === '\x1b' && help) setHelp(false)
    },
    [focus, help]
  )

  return (
    <>
      <Text height={1} color={palette.light4} background={palette.dark1}>
        <Text x="100%-17" color={palette.dark3}>
          press <Text bold>?</Text> for help
        </Text>
        <Text y={0} x={0}></Text>
        {' ' + icon + url + ' '}
      </Text>
      <Text y="100%-2" x={0} height={1} color={palette.light4} background={palette.dark1}>
        {'  ' + sql}
      </Text>
      <Text y={1} x={0} height="100%-3">
        <Text width={16}>
          <Sidebar />
        </Text>
        <Separator height={height - 3} color={palette.dark1} />
        <Text>
          <Main />
        </Text>
      </Text>
      {help && <Help />}
    </>
  )
}

ReactCurse.render(<App />)
