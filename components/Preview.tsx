import React from 'react'
import { Text } from 'react-curse'

export default (children: object) => {
  const res =
    'x1b[0m' +
    JSON.stringify(
      children,
      (key: string, value: any) => {
        if (key.startsWith('$')) return value
        if (typeof value === 'string') return { [`$${typeof value}`]: `x1b[Yellowm${value}x1b[0m` }
        if (typeof value === 'number') return { [`$${typeof value}`]: `x1b[Magentam${value}x1b[0m` }
        if (typeof value === 'boolean') return { [`$${typeof value}`]: `x1b[Magentam${value}x1b[0m` }
        return value
      },
      2
    )
      .replace(/\{\s*"\$(string)":\s*\"(.*?)\"\s*\}/g, '"$2"')
      .replace(/\{\s*"\$(number|boolean)":\s*\"(.*?)\"\s*\}/g, '$2')
      .replace(/\"([^"]+)\":/g, 'x1b[Redm$1x1b[0m:')
  return (
    <Text>
      {res.split('x1b[').map((i, key) => {
        const [color] = i.split('m', 2)
        return (
          <Text key={key} color={color !== '0' ? color : undefined}>
            {i.substring(color.length + 1)}
          </Text>
        )
      })}
    </Text>
  )
}
