
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

import { registerSW } from 'virtual:pwa-register'

// Jalankan aplikasi terlebih dahulu.
// Registrasi PWA dilakukan setelah aplikasi selesai dimuat.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Registrasi Service Worker tanpa memaksa reload aplikasi.
window.addEventListener(
  'load',
  () => {
    registerSW({
      immediate: false,

      onNeedRefresh() {
        console.log('[PWA] Pembaruan aplikasi tersedia.')
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
