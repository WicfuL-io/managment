
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

import './css/App.css'

const STORAGE_KEY = 'apk_management_session'
const LAST_EMAIL_KEY = 'apk_management_last_email'
const SESSION_TIMEOUT = 8000

type StoredSession = {
  user: User
  token: string
}

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

function getLastEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) || ''
  } catch (error) {
    console.error('[APP] Gagal membaca akun terakhir:', error)
    return ''
  }
}

function saveLastEmail(email: string) {
  try {
    localStorage.setItem(
      LAST_EMAIL_KEY,
      email.trim().toLowerCase()
    )
  } catch (error) {
    console.error('[APP] Gagal menyimpan akun terakhir:', error)
  }
}

function removeLastEmail() {
  try {
    localStorage.removeItem(LAST_EMAIL_KEY)
  } catch (error) {
    console.error('[APP] Gagal menghapus akun terakhir:', error)
  }
}

// OneSignal berjalan di latar belakang.
// Kegagalannya tidak boleh mengganggu aplikasi utama.
function connectOneSignal(userId: string) {
  void oneSignalLogin(userId).catch(error => {
    console.error('[OneSignal] Gagal menghubungkan akun:', error)
  })
}

export default function App() {
  const [session, setSession] = useState<StoredSession | null>(null)
  const [page, setPage] = useState<Page>('dashboard')
  const [boot, setBoot] = useState(true)

  // Email akun terakhir yang pernah berhasil login.
  const [lastEmail, setLastEmail] = useState<string>(getLastEmail)

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

        // Sinkronkan email akun terakhir.
        if (next.user.email) {
          const email = String(next.user.email)
          setLastEmail(email)
          saveLastEmail(email)
        }

        console.log('[APP] Sesi berhasil dipulihkan.')

        connectOneSignal(String(next.user.id))

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

    // Simpan email setelah login berhasil.
    const normalizedEmail = email.trim().toLowerCase()

    setLastEmail(normalizedEmail)
    saveLastEmail(normalizedEmail)

    setSession(next)
    setPage('dashboard')

    connectOneSignal(String(next.user.id))

    return next.user
  }

  // =====================================
  // GANTI / HAPUS AKUN TERAKHIR
  // =====================================
  function forgetLastAccount() {
    removeLastEmail()
    setLastEmail('')
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
  // AKTIFKAN NOTIFIKASI
  // =====================================
  async function enableNotifications() {
    try {
      console.log('[APP] Tombol notifikasi diklik.')

      const result = await oneSignalRequestPermission()

      if (result.granted) {
        alert('Notifikasi berhasil diaktifkan!')
      } else if (result.browserPermission === 'denied') {
        alert(
          'Izin notifikasi ditolak. Silakan aktifkan izin notifikasi melalui pengaturan browser.'
        )
      } else {
        alert(
          'Izin notifikasi belum berhasil diaktifkan. Silakan coba kembali.'
        )
      }

    } catch (error) {
      console.error('[APP] Notification error:', error)

      alert(
        error instanceof Error
          ? error.message
          : 'Gagal mengaktifkan notifikasi.'
      )
    }
  }

  // =====================================
  // LOGOUT
  // =====================================
  function logout() {
    const currentToken = session?.token

    // Tutup sesi aplikasi langsung.
    sessionStorage.removeItem(STORAGE_KEY)

    setSession(null)
    setPage('dashboard')

    // Logout OneSignal berjalan di latar belakang.
    void oneSignalLogout().catch(error => {
      console.error('[OneSignal] Logout gagal:', error)
    })

    // Beri tahu server tanpa menahan tampilan login.
    if (currentToken) {
      void api('logout', {
        token: currentToken
      }).catch(error => {
        console.error('[APP] Logout server error:', error)
      })
    }

    // Jangan hapus LAST_EMAIL_KEY.
    // Akun terakhir tetap diingat pada perangkat.
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
        rememberedEmail={lastEmail}
        onForgetRememberedEmail={forgetLastAccount}
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
      token={token}
      page={page}
      setPage={setPage}
      onLogout={logout}
      onEnableNotifications={enableNotifications}
    >
      {pages[page]}
    </Shell>
  )
}
