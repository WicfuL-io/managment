
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

import { registerSW } from 'virtual:pwa-register'

// Registrasi Service Worker untuk PWA
registerSW({
  immediate: true,
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
