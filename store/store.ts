export const initialState = {
  focus: null,
  sql: '',
  status: '',
  tables: [],
  table: 0,
  count: 0,
  cols: [],
  rows: [],
  palette: {
    dark0: '#282828',
    dark1: '#3c3836',
    dark2: '#504945',
    dark3: '#665c54',
    light1: '#ebdbb2',
    light4: '#a89984'
  }
}

export const actions = {
  setFocus(state: any, focus: any = null) {
    return { ...state, focus }
  },
  setSql(state: any, sql: any = '') {
    return { ...state, sql }
  },
  setStatus(state: any, status: any = '') {
    return { ...state, status }
  },
  setTable(state: any, table: any = 0) {
    return { ...state, table }
  },
  setTables(state: any, tables: any = []) {
    return { ...state, tables }
  },
  setCols(state: any, cols: any = []) {
    return { ...state, cols }
  },
  setRows(state: any, rows: any = []) {
    return { ...state, rows }
  },
  setCount(state: any, count: any = 0) {
    return { ...state, count }
  }
}
