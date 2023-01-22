import React, { useMemo } from 'react'
import { Separator, Text, useSize } from 'react-curse'
import { useStore } from '../store'

export default () => {
  const { width } = useSize()
  const focus = useStore(s => s.focus)
  const palette = useStore(s => s.palette)

  const helpContent = useMemo(() => {
    switch (focus) {
      case 'sidebar':
      case 'sidebar/create':
      case 'sidebar/edit':
      case 'sidebar/search':
        return [
          ['Enter, Tab', 'jump to rows'],
          ['A', 'create table'],
          ['rn', 'rename table'],
          ['dD', 'delete table'],
          ['/', 'search'],
          ['n', 'next occurrence']
        ]
      case 'main':
      case 'main/edit':
        return [
          ['i', 'preview'],
          ['Tab', 'jump to tables'],
          ['E, Enter', 'edit selected'],
          ['A, Y', 'insert, duplicate selected'],
          ['dD', 'delete selected'],
          ['[, ]', 'prev, next page'],
          ['-, +, S-, S+', 'sort, add sort'],
          ['r, Backspace', 'reload, reset'],
          ['Space, uv', 'mark row, unmark all'],
          ['C-a, C-x', 'inrement, decrement'],
          ['.', 'relation jump'],
          ['/', 'search']
        ]
      case 'main/search':
        return [
          [':', 'like'],
          ['=', 'equals']
        ]
    }
  }, [focus])

  if (!helpContent) return null

  return (
    <Text
      absolute
      y={`100%-${helpContent.length + 3}`}
      x={0}
      height={helpContent.length + 1}
      width="100%"
      clear
    >
      <Separator type="horizontal" width={width} color={palette.dark1} />
      <Text y={0} x={16} color={palette.dark1} block>
        ┴
      </Text>
      {helpContent.map(([keys, value]) => (
        <Text key={keys} block>
          <Text x={1}>
            {keys.split(', ').map((key, index) => (
              <Text key={key}>
                <Text dim bold>
                  {key}
                </Text>
                {index < keys.split(', ').length - 1 && ', '}
              </Text>
            ))}
          </Text>
          {' ' + ' '.repeat(Math.max(0, 14 - keys.length)) + value}
        </Text>
      ))}
    </Text>
  )
}
