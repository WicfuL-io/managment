
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

import { registerSW } from 'virtual:pwa-register'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

window.addEventListener(
  'load',
  () => {
    const updateSW = registerSW({
      immediate: false,

      onNeedRefresh() {
        console.log('[PWA] Pembaruan aplikasi tersedia.')

        const accepted = window.confirm(
          'Versi terbaru APK Management tersedia. Apakah kamu ingin memperbarui aplikasi sekarang?'
        )

        if (accepted) {
          console.log('[PWA] Memperbarui aplikasi...')
          void updateSW(true)
        } else {
          console.log('[PWA] Pembaruan ditunda.')
        }
      },

      onOfflineReady() {
        console.log('[PWA] Aplikasi siap digunakan secara offline.')
      },

      onRegisteredSW(_swUrl, registration) {
        console.log(
          '[PWA] Service Worker terdaftar:',
          registration?.scope
        )
      },

      onRegisterError(error) {
        console.error(
          '[PWA] Gagal mendaftarkan Service Worker:',
          error
        )
      }
    })
  },
  { once: true }
)
