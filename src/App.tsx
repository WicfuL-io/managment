
import { useEffect, useState } from 'react'
import { Boxes, LoaderCircle } from 'lucide-react'

import Auth from './components/Auth'
import Shell from './components/Shell'

import Dashboard from './pages/Dashboard'
import Stock from './pages/Stock'
import Finance from './pages/Finance'
import Admin from './pages/Admin'
import POS from './pages/POS'
import Debt from './pages/Debt'

import { api, getClientInfo } from './lib/api'
import {
  oneSignalLogin,
  oneSignalLogout,
  oneSignalRequestPermission
} from './lib/onesignal'

import type { Page, User } from './types'

const STORAGE_KEY = 'apk_management_session'

type StoredSession = {
  user: User
  token: string
}

export default function App() {
  const [session, setSession] = useState<StoredSession | null>(null)
  const [page, setPage] = useState<Page>('dashboard')
  const [boot, setBoot] = useState(true)

  // Memulihkan sesi login.
  useEffect(() => {
    let alive = true

    ;(async () => {
      const raw = sessionStorage.getItem(STORAGE_KEY)

      if (raw) {
        try {
          const saved = JSON.parse(raw) as StoredSession

          const res = await api<User>('me', {
            token: saved.token
          })

          if (alive) {
            const next = {
              ...saved,
              user: res.data!
            }

            setSession(next)

            sessionStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(next)
            )

            // Pulihkan identitas OneSignal untuk akun tersebut.
            try {
              await oneSignalLogin(next.user.id)
            } catch (error) {
              console.error('OneSignal login error:', error)
            }
          }
        } catch {
          sessionStorage.removeItem(STORAGE_KEY)
        }
      }

      if (alive) setBoot(false)
    })()

    return () => {
      alive = false
    }
  }, [])

  // Login.
  async function login(
    _unused: User,
    email: string,
    password: string
  ) {
    const client = await getClientInfo()

    const r = await api<StoredSession>('login', {
      email,
      password,
      client
    })

    const next = r.data!

    setSession(next)

    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(next)
    )

    setPage('dashboard')

    // Hubungkan perangkat dengan akun yang berhasil login.
    try {
      await oneSignalLogin(next.user.id)
    } catch (error) {
      console.error('OneSignal login error:', error)
    }

    return next.user
  }

  // Register.
  async function register(
    name: string,
    email: string,
    password: string
  ) {
    await api('register', {
      name,
      email,
      password,
      client: await getClientInfo()
    })
  }

  // Mengaktifkan notifikasi melalui tombol lonceng.
  async function enableNotifications() {
    if (!session) return

    try {
      // Pastikan perangkat sudah terhubung ke akun yang benar.
      await oneSignalLogin(session.user.id)

      const granted = await oneSignalRequestPermission()

      if (granted) {
        alert('Notifikasi berhasil diaktifkan!')
      } else {
        alert(
          'Izin notifikasi belum diberikan. Silakan periksa pengaturan notifikasi browser.'
        )
      }
    } catch (error) {
      console.error('Notification error:', error)

      alert(
        'Gagal mengaktifkan notifikasi. Pastikan website menggunakan HTTPS dan konfigurasi OneSignal sudah benar.'
      )
    }
  }

  // Logout.
  async function logout() {
    // Lepaskan identitas OneSignal sebelum mengakhiri sesi.
    try {
      await oneSignalLogout()
    } catch (error) {
      console.error('OneSignal logout error:', error)
    }

    try {
      await api('logout', {
        token: session?.token
      })
    } catch {
      // Tetap logout secara lokal jika server tidak tersedia.
    }

    sessionStorage.removeItem(STORAGE_KEY)
    setSession(null)
    setPage('dashboard')
  }

  if (boot) {
    return (
      <div className="splash">
        <div className="splash-logo">
          <Boxes size={38} />
        </div>

        <h2>
          APK<span>Management</span>
        </h2>

        <p>Manage smarter. Grow faster.</p>

        <LoaderCircle className="loader" size={20} />
      </div>
    )
  }

  if (!session) {
    return (
      <Auth
        onLogin={login}
        onRegister={register}
      />
    )
  }

  const token = session.token

  const pages: Record<Page, React.ReactNode> = {
    dashboard: <Dashboard token={token} />,
    stock: <Stock token={token} />,
    pos: <POS token={token} />,
    finance: <Finance token={token} />,
    debt: <Debt token={token} />,
    users: <Admin token={token} page="users" />,
    logs: <Admin token={token} page="logs" />,
    settings: <Admin token={token} page="settings" />
  }

  return (
    <Shell
      user={session.user}
      page={page}
      setPage={setPage}
      onLogout={logout}
      onEnableNotifications={enableNotifications}
    >
      {pages[page]}
    </Shell>
  )
}
