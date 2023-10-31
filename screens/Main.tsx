import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Text, Input, ListTable, type ListPos, View, useClipboard, useInput, useSize, useMouse } from 'react-curse'
import Preview from '../components/Preview'
import useDb from '../hooks/useDb'
import useEd from '../hooks/useEd'
import { dispatch, useStore } from '../store'
// import { EJSON } from 'bson'

class HeadItem {
  text: string
  props: object
  constructor(text: string, props = {}) {
    this.text = text
    this.props = props
  }
  toString() {
    return this.text
  }
}

const Head = ({ item, widths }) => {
  return (
    <>
      {item.map(({ text, props }, index: number) => (
        <Text key={index} {...props} width={widths[index]}>
          {text}
        </Text>
      ))}
    </>
  )
}

const Row = ({ focus, item, y, x, widths, index, pass }) => {
  const { selected, palette } = pass

  const truncate = (i: any, width: number) => {
    if (i === undefined) return ''
    if (i === null) return 'null'
    if (i.toString().length <= width) return i.toString()
    return (
      <Text>
        {i.toString().substring(0, width - 1)}
        <Text dim>~</Text>
      </Text>
    )
  }

  return (
    <Text color={selected.includes(index) ? 'Yellow' : undefined} width="100%">
      {item.map((i: any, key: number) => (
        <Text
          key={key}
          width={widths[key]}
          dim={i === null}
          color={y === index && x === key ? 'Yellow' : undefined}
          background={y === index && focus && x === key ? palette.dark1 : undefined}
        >
          {truncate(i, widths[key])}
        </Text>
      ))}
    </Text>
  )
}

export default () => {
  const { width, height } = useSize()
  const db = useDb()
  const [, setClipboard] = useClipboard()
  const nextOptions = useRef<{ where?: {} }>({})
  const focus = useStore(s => s.focus)
  const status = useStore(s => s.status)
  const tables = useStore(s => s.tables)
  const table = useStore(s => s.table)
  const count = useStore(s => s.count)
  const cols = useStore(s => s.cols)
  const rows = useStore(s => s.rows)
  const palette = useStore(s => s.palette)
  const [pos, setPos] = useState<ListPos>({ y: 0, x: 0, yo: 0, xo: 0, x1: 0, x2: 0 })
  const [o, setO] = useState<{ where: object; order: object; skip: number; limit: number }>({
    where: {},
    order: {},
    skip: 0,
    limit: 100
  })
  const [selected, setSelected] = useState<number[]>([])
  const [preview, setPreview] = useState<object | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [seq, setSeq] = useState<string>('')
  const [initialValue, setInitialValue] = useState<string>('')

  const findRelationTableIndex = (name: string) => {
    const q = name.replace(/Id$/, '').replace(/_id$/, '')
    return tables.findIndex((i: string) => [q, `${q}s`, `${q}es`].includes(i.toLowerCase()))
  }

  const head = useMemo(() => {
    return cols.map(({ type, name }) => {
      const [typeName, typeSize] = type.split(/[()]/)
      const key = typeName.toLowerCase().replaceAll(' ', '_').replace(/_^/, '')
      const dbType = Object.entries(db.types()).find(([k]) => key.startsWith(k))?.[1]
      const icon = dbType?.icon || type
      const size = typeSize ? typeSize : ''
      const color = dbType?.color
      const sort = o.order[name] !== undefined ? ` ${o.order[name] === 1 ? '' : ''}` : ''
      const jump = ![-1, table].includes(findRelationTableIndex(name)) ? ' ' : ''
      return new HeadItem(`${icon}${size} ${name}${sort}${jump}`, { color })
    })
  }, [cols, o.order])

  const rowsFormatted = useMemo(() => {
    return db.format?.(cols, rows) || rows
  }, [cols, rows])

  const data = useMemo(() => {
    return rowsFormatted.map((i: any) => cols.map(({ name }) => i[name]))
  }, [rowsFormatted])

  const info1 = useMemo(() => {
    const to = o.skip + data.length
    return ` ${count > 0 ? `${o.skip + 1}-` : ''}${to}${to !== count ? `/${count}` : ''} `
  }, [o.skip, data, count])

  const info2 = useMemo(() => {
    return ` ${pos.y + 1}:${pos.x + 1} `
  }, [pos.y, pos.x])

  const reload = async () => {
    const [sql, count, rows, cols] = await db.rows(tables[table], o.where, o.order, o.skip, o.limit)
    dispatch('setCount', count)
    dispatch('setSql', sql)
    dispatch('setCols', cols ?? (await db.cols(tables[table])))
    dispatch('setRows', rows)

    return rows
  }

  const onSubmit = useCallback(
    (pos: ListPos) => {
      if (rows[pos.y] === undefined) return

      setPos(pos)
      dispatch('setFocus', 'main/edit')
    },
    [rows]
  )

  const getEditProps = () => ({
    initialValue: rowsFormatted[pos.y][cols[pos.x].name]?.toString() || '',
    y: pos.y - pos.yo,
    x: pos.x1 - pos.xo,
    width: pos.x2 - pos.x1
  })

  const onEditSubmit = useCallback(
    (value: any) => {
      ;(async () => {
        dispatch('setFocus', 'main')
        const json = rows[pos.y]
        const jsonNew = { ...json, [cols[pos.x].name]: value }
        const res = await db.update(tables[table], cols, [jsonNew], [json])
        if (!res) return

        dispatch('setStatus', `"${res}" written`)
        reload()
      })()
    },
    [rows, pos, cols, tables, table]
  )

  const editHandler = async () => {
    if (rows.length === 0) return

    const jsons = selected.length > 0 ? selected.map(i => rows[i]) : [rows[pos.y]]

    const jsonsNew = await useEd(jsons)
    if (jsonsNew.length === 0) return

    const res = await db.update(tables[table], cols, jsonsNew, jsons)
    if (!res) return

    dispatch('setStatus', `"${res}" written`)
    reload()

    if (selected.length > 0) setSelected([])
  }

  const insertHandler = async (copy = false) => {
    if (copy && rows.length === 0) return

    const jsons = copy ? (selected.length > 0 ? selected.map(i => rows[i]) : [rows[pos.y]]) : undefined

    const template = await db.template(tables[table], cols, jsons)
    const jsonsNew = await useEd(template)
    if (jsonsNew.length === 0) return

    const res = await db.insert(tables[table], cols, jsonsNew)
    if (!res) return

    dispatch('setStatus', `"${res}" inserted`)
    reload()

    if (selected.length > 0) setSelected([])
  }

  const toggleSelected = () => {
    setSelected(selected.includes(pos.y) ? selected.filter(i => i !== pos.y) : [...selected, pos.y])
    setPos({ ...pos, y: pos.y + 1 })
  }

  const deleteConfirm = () => {
    if (rows.length === 0) return

    setConfirm('dD')

    const name = db.id(cols)
    const ids = selected.length > 0 ? selected.map(i => rows[i][name]) : [rows[pos.y][name]]
    dispatch('setStatus', `Confirm deletion of: ${ids.map(id => `"${id}"`).join(', ')} ? (y/N)`)
  }

  const deleteHandler = async () => {
    const name = db.id(cols)
    const id = rows[pos.y][name]

    const res = await db.delete(tables[table], cols, selected.length > 0 ? selected.map(i => rows[i][name]) : id)
    if (!res) return

    dispatch('setStatus', `"${res}" deleted`)
    const rowsNew = await reload()
    const y = rowsNew.findIndex((i: any) => i[name] === id)
    if (y > -1 && y !== pos.y) setPos({ ...pos, y })

    if (selected.length > 0) setSelected([])
  }

  const onSearch = () => {
    if (!cols[pos.x]) return

    const { type, name } = cols[pos.x]
    const op = ['text'].includes(type) ? ':' : '='

    setInitialValue(name ? `/${name}${op}` : '')
    dispatch('setFocus', 'main/search')
  }

  const onSearchSubmit = useCallback(
    (query: string) => {
      dispatch('setFocus', 'main')

      const match = query.match(/^\/([A-Za-z_]+)([:=])(.+)$/)
      if (match === null) return setO({ ...o, where: {} })

      const [, key, delimiter] = match
      let value: string | number = match[3]
      if (parseFloat(value).toString() === value) value = parseFloat(value)
      setO({
        ...o,
        where: { ...o.where, [key]: delimiter === ':' ? { $regex: value } : value }
      })
    },
    [o]
  )

  const increment = async (diff: number) => {
    if (rows.length === 0 || cols.length === 0 || rows[pos.y][cols[pos.x].name] === undefined) return

    const { name, type } = cols[pos.x]
    const json = rows[pos.y]
    const value = json[name]

    let valueNew: any
    switch (type) {
      case 'boolean':
        valueNew = !value
        break
      case 'number':
        valueNew = value + diff
        break
      case 'string':
        let match: RegExpMatchArray
        if ((match = value.match(/(-?\d+[,.]?\d*)$/))) {
          const [, number] = match
          const { index } = match
          if (index === 0 || !value[(index as number) - 1].match(/[-\d,.]/))
            valueNew = value.substring(0, index) + (parseFloat(number) + diff)
        }
        break
    }
    if (valueNew === undefined) return

    const res = await db.update(tables[table], cols, [{ ...json, [name]: valueNew }], [json])
    if (!res) return

    dispatch('setStatus', `"${res}" written`)
    reload()
  }

  const relationJump = () => {
    if (rows.length === 0 || cols.length === 0 || rows[pos.y][cols[pos.x].name] === undefined) return

    const { name } = cols[pos.x]
    const json = rows[pos.y]
    const value = json[name]

    const index = findRelationTableIndex(name)
    if (index === -1) return

    dispatch('setTable', index)
    nextOptions.current = { where: { id: value } }
  }

  const copy = () => {
    if (rows.length === 0 || cols.length === 0 || rows[pos.y][cols[pos.x].name] === undefined) return

    const value = setClipboard(rows[pos.y][cols[pos.x].name])
    if (!value) return

    dispatch('setStatus', `${value.length} chars yanked`)
  }

  useEffect(() => {
    setPos({ ...pos, y: 0, x: 0 })
    setO({ order: {}, where: nextOptions.current?.where || {}, skip: 0, limit: 100 })
    setSelected([])
    setPreview(null)
    if (nextOptions.current) nextOptions.current = {}
  }, [tables, table])

  useEffect(() => {
    if (tables.length === 0) return

    reload()
  }, [o])

  useInput(
    (input: string) => {
      if (focus !== 'main') return
      if (status) dispatch('setStatus')

      if (confirm) {
        setConfirm(null)
        if (['y', 'Y'].includes(input)) {
          if (confirm === 'dD') deleteHandler()
          return
        }
      }

      if (input.match(/\d/)) {
        setSeq(seq + input)
        return
      }

      if (input === '\x01') increment(parseInt(seq) || 1)
      if (input === '\x18') increment((parseInt(seq) || 1) * -1)

      if (seq === '' && ['u', 'd'].includes(input)) {
        setSeq(input)
      } else if (seq !== '') {
        if (seq === 'u' && input === 'v') setSelected([])
        if (seq === 'd' && input === 'D') deleteConfirm()

        if (seq.match(/^\d+$/)) {
          if (input === 'k') setPos({ ...pos, y: pos.y - parseInt(seq) })
          if (input === 'j') setPos({ ...pos, y: pos.y + parseInt(seq) })
          if (['g', 'G'].includes(input)) setPos({ ...pos, y: parseInt(seq) - 1 })
        }

        setSeq('')
        return
      }

      if (input === '-' && data.length > 0) setO({ ...o, order: { [cols[pos.x].name]: -1 } })
      if (input === '_' && data.length > 0) setO({ ...o, order: { ...o.order, [cols[pos.x].name]: -1 } })
      if (input === '=' && data.length > 0) setO({ ...o, order: { [cols[pos.x].name]: 1 } })
      if (input === '+' && data.length > 0) setO({ ...o, order: { ...o.order, [cols[pos.x].name]: 1 } })
      if (input === '\x7f' /* backspace */) setO({ order: {}, where: {}, skip: 0, limit: 100 })
      if (input === '\x09' /* tab */) dispatch('setFocus', 'sidebar')
      if (input === 'E') editHandler()
      if (input === 'r') reload()
      if (input === 'Y') insertHandler(true)
      if (input === 'i') setPreview(preview === null ? rows[pos.y] : null)
      if (input === '[' && o.skip > 0) setO({ ...o, skip: Math.max(0, o.skip - o.limit) })
      if (input === ']' && o.skip < count - o.limit)
        setO({ ...o, skip: Math.max(0, Math.min(count - rows.length, o.skip + o.limit)) })
      if (input === 'A') insertHandler()
      if (input === '/') onSearch()
      if (input === ' ') toggleSelected()
      if (input === '.') relationJump()
      if (input === 'y') copy()
    },
    [focus, status, confirm, seq, cols, pos, rows, o, preview, count]
  )

  useMouse(
    event => {
      if (!['sidebar', 'main'].includes(focus)) return
      if (!['mousedown', 'wheeldown', 'wheelup'].includes(event.type)) return
      if (event.y < 1 || event.y > height - 3 || event.x <= 16) return

      if (focus !== 'main') dispatch('setFocus', 'main')
      if (event.type === 'mousedown')
        setPos({ ...pos, y: pos.yo + Math.max(0, Math.min(height - 5, event.y - 2)), xm: event.x - 16 })
      if (event.type === 'wheelup' && pos.y > 0) setPos({ ...pos, y: pos.y - 1 })
      if (event.type === 'wheeldown' && pos.y < data.length) setPos({ ...pos, y: pos.y + 1 })
    },
    [focus, pos]
  )

  return (
    <>
      {!preview && data.length === 0 && focus === 'main' && <Text dim>empty</Text>}
      {!preview && data.length > 0 && (
        <>
          <ListTable
            focus={focus === 'main'}
            initialPos={pos}
            head={head}
            renderHead={Head}
            data={data}
            renderItem={Row}
            width={width - 16}
            height={height - 3}
            pass={{ selected, palette }}
            scrollbarBackground={palette.dark1}
            scrollbarColor={palette.light4}
            onChange={setPos}
            onSubmit={onSubmit}
          />
          {focus === 'main/edit' && (
            <Text y={1} x={0}>
              <Input
                {...getEditProps()}
                height={1}
                background={palette.dark2}
                color={palette.light1}
                onSubmit={onEditSubmit}
                onCancel={() => dispatch('setFocus', 'main')}
              />
            </Text>
          )}
        </>
      )}
      {preview && (
        <View focus={focus === 'main'} width={width - 16} height={height - 3}>
          {Preview(preview)}
        </View>
      )}
      <Text absolute y="100%-2" x={`100%-${info1.length + info2.length + 2}`} height={1} bold>
        <Text background={palette.dark1} color={palette.dark2}>
          
        </Text>
        <Text background={palette.dark2} color={palette.light1}>
          {info1}
        </Text>
        <Text background={palette.dark2} color={palette.light4}>
          
        </Text>
        <Text background={palette.light4} color={palette.dark0} bold>
          {info2}
        </Text>
      </Text>
      <Text absolute y="100%-1" x={0} height={1}>
        {focus !== 'main/search' && status}
        {focus === 'main/search' && (
          <Input initialValue={initialValue} onCancel={() => dispatch('setFocus', 'main')} onSubmit={onSearchSubmit} />
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
