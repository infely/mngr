import { readFileSync } from 'fs'

class PrismaSchema {
  data: Record<string, string[]> = {}

  private async parse() {
    try {
      const res = readFileSync('prisma/schema.prisma')
      const data = String(res)
      const r = data.matchAll(/model\s+(\w+)\s*{([^}]*)}/g)
      for (const [, table, c] of r) {
        const fields = c
          .split('\n')
          .map(i => i.trim())
          .filter(Boolean)
          .map(i => i.replace(/^(\w+).*/, '$1'))
        this.data[table] = fields
      }
    } catch {
      //
    }
  }
  constructor() {
    this.parse()
  }

  getCols(table: string) {
    return this.data[table] ?? []
  }
}

export const prismaSchema = new PrismaSchema()
