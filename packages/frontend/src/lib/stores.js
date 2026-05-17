import { writable } from 'svelte/store'

export const currentRoute = writable({ path: '/', params: {} })
export const user = writable(null)
