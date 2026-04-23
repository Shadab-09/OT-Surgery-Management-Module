import { configureStore, createSlice } from '@reduxjs/toolkit'

const uiSlice = createSlice({
  name: 'ui',
  initialState: { sidebarOpen: true, toast: null },
  reducers: {
    toggleSidebar: (s) => { s.sidebarOpen = !s.sidebarOpen },
    showToast: (s, a) => { s.toast = a.payload },
    clearToast: (s) => { s.toast = null },
  },
})

export const { toggleSidebar, showToast, clearToast } = uiSlice.actions

export const store = configureStore({
  reducer: {
    ui: uiSlice.reducer,
  },
})
