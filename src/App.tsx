
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

          if (!res.data) {
            throw new Error('Data pengguna tidak ditemukan.')
          }

          if (alive) {
            const next = {
              ...saved,
              user: res.data
            }

            setSession(next)

            sessionStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(next)
            )

            // Pulihkan identitas OneSignal.
            try {
              await oneSignalLogin(next.user.id)
            } catch (error) {
              console.error('OneSignal login error:', error)
            }
          }
        } catch (error) {
          console.error('Session restore error:', error)
          sessionStorage.removeItem(STORAGE_KEY)
        }
      }

      if (alive) {
        setBoot(false)
      }
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

    const next = r.data

    if (!next?.token || !next?.user?.id) {
      throw new Error('Data sesi login tidak valid.')
    }

    setSession(next)

    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(next)
    )

    setPage('dashboard')

    // Hubungkan akun aplikasi ke External ID OneSignal.
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
  console.log('[APP] Tombol notifikasi diklik')

  if (!session) {
    console.error('[APP] Tidak ada pengguna yang login')
    return
  }

  try {
    // 1. Minta izin terlebih dahulu saat konteks klik masih aktif.
    const result = await oneSignalRequestPermission()

    console.log('[APP] Status izin:', result)

    if (result.browserPermission === 'denied') {
      alert('Izin notifikasi diblokir oleh Chrome.')
      return
    }

    if (result.browserPermission !== 'granted') {
      alert('Izin notifikasi belum diberikan.')
      return
    }

    if (!result.oneSignalPermission) {
      alert(
        'Izin browser sudah aktif, tetapi izin OneSignal belum aktif.'
      )
      return
    }

    // 2. Setelah izin berhasil, hubungkan akun.
    await oneSignalLogin(session.user.id)

    alert('Izin notifikasi berhasil diaktifkan dan akun terhubung!')

  } catch (error) {
    console.error('[APP] Notification error:', error)

    alert(
      error instanceof Error
        ? error.message
        : 'Terjadi kesalahan saat mengaktifkan notifikasi.'
    )
  }
}


  // Logout.
  async function logout() {
    // Lepaskan identitas OneSignal.
    try {
      await oneSignalLogout()
    } catch (error) {
      console.error('OneSignal logout error:', error)
    }

    // Akhiri sesi backend.
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

  // Tampilan loading.
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

  // Halaman autentikasi.
  if (!session) {
    return (
      <Auth
        onLogin={login}
        onRegister={register}
      />
    )
  }

  const token = session.token

  // Daftar halaman aplikasi.
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
