export interface DbCol {
  name: string
  type: string
  pk: number
}

export interface Db {
  tables(): Promise<string[]>
  cols(table: string, rows?: object[] | object[][]): DbCol[] | Promise<DbCol[]>
  rows(table: string, where?: object, order?: object, skip?: number, limit?: number): Promise<[string, number, object[], DbCol[] | undefined]>
  id(cols?: DbCol[]): string
  types(): object
  format(cols: DbCol[], rows: object[]): object[]
  template(table?: string, cols?: DbCol[], jsons?: object[] | undefined): object[] | Promise<object[]>
  insert(table: string, cols: DbCol[], jsons: object[]): Promise<string[] | null>
  update(table: string, cols: DbCol[], jsonsNew: object[], jsonsOld: object[]): Promise<string[] | null>
  delete(table: string, cols: DbCol[], ids: number[]): Promise<string | string[] | null>
  createTable(table: string): Promise<boolean>
  renameTable(table: string, tableNew: string): Promise<boolean>
  dropTable(table: string): Promise<boolean>
}
