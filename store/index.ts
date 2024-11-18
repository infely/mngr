import { initialState, actions } from './store'
import { useSyncExternalStore } from 'react'

const createStore = (initialState: any) => {
  let state = initialState
  const listeners = new Set()

  return {
    getState: () => state,
    dispatch: (action: string, payload?: any) => {
      state = actions[action](state, payload)
      listeners.forEach((listener: any) => listener(state))
    },
    subscribe: (listener: any) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

const store = createStore(initialState)

export const useStore = (selector = (state: any) => state) =>
  useSyncExternalStore(store.subscribe, () => selector(store.getState()))

export const dispatch = store.dispatch
