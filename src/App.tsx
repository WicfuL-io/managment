
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

import type { Page, User } from './types'

const STORAGE_KEY = 'apk_management_session'
const SESSION_TIMEOUT = 8000

type StoredSession = {
  user: User
  token: string
}

// Membatasi waktu tunggu API.
function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Server terlalu lama merespons.'))
    }, milliseconds)

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout))
  })
}

export default function App() {
  const [session, setSession] = useState<StoredSession | null>(null)
  const [page, setPage] = useState<Page>('dashboard')
  const [boot, setBoot] = useState(true)

  // =====================================
  // PEMULIHAN SESI
  // =====================================
  useEffect(() => {
    let alive = true

    async function restoreSession() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY)

        if (!raw) {
          console.log('[APP] Tidak ada sesi tersimpan.')
          return
        }

        const saved = JSON.parse(raw) as StoredSession

        if (!saved.token || !saved.user?.id) {
          throw new Error('Data sesi tidak valid.')
        }

        console.log('[APP] Memeriksa sesi login...')

        const response = await withTimeout(
          api<User>('me', {
            token: saved.token
          }),
          SESSION_TIMEOUT
        )

        if (!response.data) {
          throw new Error('Data pengguna tidak ditemukan.')
        }

        if (!alive) return

        const next: StoredSession = {
          ...saved,
          user: response.data
        }

        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(next)
        )

        setSession(next)

        console.log('[APP] Sesi berhasil dipulihkan.')
      } catch (error) {
        console.error('[APP] Pemulihan sesi gagal:', error)

        sessionStorage.removeItem(STORAGE_KEY)

        if (alive) {
          setSession(null)
        }
      } finally {
        if (alive) {
          setBoot(false)
          console.log('[APP] Pembukaan aplikasi selesai.')
        }
      }
    }

    restoreSession()

    return () => {
      alive = false
    }
  }, [])

  // =====================================
  // LOGIN
  // =====================================
  async function login(
    _unused: User,
    email: string,
    password: string
  ) {
    const client = await getClientInfo()

    const response = await api<StoredSession>('login', {
      email,
      password,
      client
    })

    const next = response.data

    if (!next?.token || !next?.user?.id) {
      throw new Error('Data sesi login tidak valid.')
    }

    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(next)
    )

    setSession(next)
    setPage('dashboard')

    // OneSignal tidak dijalankan saat login.
    return next.user
  }

  // =====================================
  // REGISTER
  // =====================================
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

  // =====================================
  // NOTIFIKASI SEMENTARA DINONAKTIFKAN
  // =====================================
  function enableNotifications() {
    alert(
      'Fitur notifikasi sedang dalam perbaikan. Silakan coba kembali nanti.'
    )
  }

  // =====================================
  // LOGOUT
  // =====================================
  async function logout() {
    try {
      await api('logout', {
        token: session?.token
      })
    } catch (error) {
      console.error('[APP] Logout server error:', error)
    }

    sessionStorage.removeItem(STORAGE_KEY)

    setSession(null)
    setPage('dashboard')
  }

  // =====================================
  // LOADING
  // =====================================
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

  // =====================================
  // AUTHENTICATION
  // =====================================
  if (!session) {
    return (
      <Auth
        onLogin={login}
        onRegister={register}
      />
    )
  }

  // =====================================
  // HALAMAN APLIKASI
  // =====================================
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
