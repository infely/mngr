import useDb from '../hooks/useDb'
import { dispatch, useStore } from '../store'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Input, Text, List, type ListPos, useInput, useMouse, useSize } from 'react-curse'

export default function Sidebar() {
  const { height } = useSize()
  const db = useDb()
  const focus = useStore(s => s.focus)
  const status = useStore(s => s.status)
  const tables = useStore(s => s.tables)
  const table = useStore(s => s.table)
  const palette = useStore(s => s.palette)
  const [pos, setPos] = useState<ListPos>({ y: table, x: 0, yo: 0, xo: 0, x1: 0, x2: 0 })
  const [confirm, setConfirm] = useState<string | null>(null)
  const [seq, setSeq] = useState<string>('')
  const [search, setSearch] = useState<number[]>([])

  const y = useMemo(() => {
    return Math.min(height - 4, tables.length)
  }, [height, tables])

  const onSubmit = () => {
    if (tables.length === 0) return

    if (table !== pos.y) dispatch('setTable', pos.y)
    dispatch('setFocus', 'main')
  }

  const createTableHandler = async () => {
    dispatch('setFocus', 'sidebar/create')
  }

  const onCreateSubmit = useCallback((value: string) => {
    ;(async () => {
      dispatch('setFocus', 'sidebar')

      value = value.trim()
      if (value === '') return

      const res = await db.createTable(value)
      if (!res) return

      const tables = await db.tables()
      const y = tables.findIndex((name: string) => name === value)
      dispatch('setTables', tables)
      setPos({ ...pos, y })

      dispatch('setTable', y)
      dispatch('setFocus', 'main')
    })()
  }, [])

  const renameTableHandler = () => {
    if (tables.length === 0) return

    dispatch('setFocus', 'sidebar/edit')
  }

  const onEditSubmit = useCallback(
    (value: string) => {
      ;(async () => {
        dispatch('setFocus', 'sidebar')

        value = value.trim()
        if (value === '') return

        const res = await db.renameTable(tables[pos.y], value)
        if (!res) return

        const tablesNew = await db.tables()
        dispatch('setTables', tablesNew)
        dispatch('setTable', pos.y)
        dispatch('setFocus', 'main')
      })()
    },
    [tables, pos.y]
  )

  const dropTableConfirm = () => {
    if (tables.length === 0) return

    setConfirm('dD')
    dispatch('setStatus', `Confirm deletion of: "${tables[pos.y]}" ? (y/N)`)
  }

  const dropTableHandler = async () => {
    const res = await db.dropTable(tables[pos.y])
    if (!res) return

    const tablesNew = await db.tables()
    dispatch('setTables', tablesNew)

    if (pos.y === table) {
      dispatch('setCols', [])
      dispatch('setRows', [])
    }
  }

  const onChange = useCallback(
    (value: string) => {
      if (value === '') return

      const indexes = tables.reduce((acc: number[], i: string, index: number) => {
        if (i.toLowerCase().includes(value.toLowerCase())) acc.push(index)
        return acc
      }, [])
      if (indexes.length === 0) return

      setPos({ ...pos, y: indexes[0] })
      setSearch(indexes)
    },
    [tables, pos]
  )

  const searchNext = () => {
    if (search.length < 2) return

    const newSearch = [...search.slice(1), search[0]]
    setPos({ ...pos, y: newSearch[0] })
    setSearch(newSearch)
  }

  useEffect(() => {
    ;(async () => {
      const tables = await db.tables()
      dispatch('setTables', tables)

      if (focus === null) dispatch('setFocus', tables.length > 0 ? 'main' : 'sidebar')
    })()
  }, [])

  useEffect(() => {
    setPos({ ...pos, y: table })
  }, [table])

  useInput(
    (input: string) => {
      if (focus !== 'sidebar') return
      if (status) dispatch('setStatus')

      if (confirm) {
        setConfirm(null)
        if (['y', 'Y'].includes(input)) {
          if (confirm === 'dD') dropTableHandler()
          return
        }
      }

      if (input.match(/\d/)) {
        setSeq(seq + input)
        return
      }

      if (seq === '' && ['r', 'd'].includes(input)) {
        setSeq(input)
      } else if (seq !== '') {
        if (seq === 'r' && input === 'n') renameTableHandler()
        if (seq === 'd' && input === 'D') dropTableConfirm()

        if (seq.match(/^\d+$/)) {
          if (input === 'k') setPos({ ...pos, y: pos.y - parseInt(seq) })
          if (input === 'j') setPos({ ...pos, y: pos.y + parseInt(seq) })
          if (['g', 'G'].includes(input)) setPos({ ...pos, y: parseInt(seq) - 1 })
        }

        setSeq('')
        return
      }

      if (['\x09' /* tab */, '\x0d' /* enter */].includes(input)) onSubmit()
      if (input === 'A') createTableHandler()
      if (input === '/') dispatch('setFocus', 'sidebar/search')
      if (input === 'n') searchNext()
    },
    [focus, status, confirm, seq, onSubmit]
  )

  useMouse(
    event => {
      if (!['sidebar', 'main'].includes(focus)) return
      if (!['mousedown', 'wheeldown', 'wheelup'].includes(event.type)) return
      if (event.y < 1 || event.y > height - 3 || event.x >= 16) return

      if (focus !== 'sidebar') dispatch('setFocus', 'sidebar')
      if (event.type === 'mousedown') setPos({ ...pos, y: pos.yo + Math.max(0, Math.min(height - 5, event.y - 1)) })
      if (event.type === 'wheelup' && pos.y > 0) setPos({ ...pos, y: pos.y - 1 })
      if (event.type === 'wheeldown' && pos.y < tables.length) setPos({ ...pos, y: pos.y + 1 })
    },
    [focus, pos]
  )

  return (
    <>
      {tables.length === 0 && focus === 'sidebar' && <Text dim>empty</Text>}
      {tables.length > 0 && (
        <>
          <List
            focus={focus === 'sidebar'}
            initialPos={pos}
            data={tables}
            renderItem={({ item, focus, selected }) => (
              <Text
                color={selected ? 'Green' : undefined}
                background={selected && focus ? palette.dark1 : undefined}
                width="100%"
              >
                 {item}
              </Text>
            )}
            width={16}
            height={height - 3}
            scrollbar={false}
            scrollbarBackground={palette.dark1}
            scrollbarColor={palette.light4}
            onChange={setPos}
          />
          {focus === 'sidebar/edit' && (
            <Input
              y={pos.y}
              x={2}
              width={16 - 2}
              initialValue={tables[pos.y]}
              height={1}
              background={palette.dark2}
              color={palette.light1}
              onSubmit={onEditSubmit}
              onCancel={() => dispatch('setFocus', 'sidebar')}
            />
          )}
        </>
      )}
      {focus === 'sidebar/create' && (
        <Text y={y} x={0}>
          <Text>{'匿 '}</Text>
          <Input
            width={16 - 2}
            height={1}
            background={palette.dark2}
            color={palette.light1}
            onSubmit={onCreateSubmit}
            onCancel={() => dispatch('setFocus', 'sidebar')}
          />
        </Text>
      )}
      <Text absolute y="100%-1" x={0} height={1}>
        {focus === 'sidebar/search' && (
          <Input
            onChange={onChange}
            onSubmit={() => dispatch('setFocus', 'sidebar')}
            onCancel={() => dispatch('setFocus', 'sidebar')}
          />
        )}
      </Text>
      {seq && (
        <Text absolute y="100%-1" x="100%-11">
          {seq}
        </Text>
      )}
    </>
  )
}
