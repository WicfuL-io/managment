
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import './css/styles.css'

import { registerSW } from 'virtual:pwa-register'

// ======================================================
// APK MANAGEMENT - RENDER APLIKASI
// ======================================================

ReactDOM.createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// ======================================================
// APK MANAGEMENT - PWA SERVICE WORKER
// ======================================================

window.addEventListener(
  'load',
  () => {
    console.log('[PWA] Memulai registrasi Service Worker...')

    const updateSW = registerSW({
      immediate: false,

      // Pembaruan aplikasi tersedia
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

      // Aplikasi siap offline
      onOfflineReady() {
        console.log(
          '[PWA] Aplikasi siap digunakan secara offline.'
        )
      },

      // Service Worker berhasil terdaftar
      onRegisteredSW(_swUrl, registration) {
        console.log(
          '[PWA] Service Worker terdaftar:',
          registration?.scope
        )

        if (registration) {
          console.log(
            '[PWA] Status Service Worker:',
            registration.active?.state ||
            'Menunggu aktivasi'
          )

          console.log(
            '[PWA] Status update:',
            registration.waiting
              ? 'Pembaruan menunggu'
              : 'Tidak ada pembaruan tertunda'
          )
        }
      },

      // Registrasi gagal
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
