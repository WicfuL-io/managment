
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      manifest: {
        name: 'APK Management',
        short_name: 'Management',
        description: 'Aplikasi manajemen stok dan keuangan',
        theme_color: '#07111f',
        background_color: '#07111f',
        display: 'standalone',
        orientation: 'any',

        icons: [
          {
            src: '/Management-Icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/Management-Icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],

  server: {
    host: '0.0.0.0'
  }
})
