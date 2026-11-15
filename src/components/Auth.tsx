
import { useState } from 'react'
import {
  Boxes,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
  ArrowRight,
  RefreshCw
} from 'lucide-react'

import type { User } from '../types'

type Props = {
  onLogin: (
    user: User,
    email: string,
    password: string
  ) => Promise<User>

  onRegister: (
    name: string,
    email: string,
    password: string
  ) => Promise<void>

  rememberedEmail: string
  onForgetRememberedEmail: () => void
}

export default function Auth({
  onLogin,
  onRegister,
  rememberedEmail,
  onForgetRememberedEmail
}: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')

  const [name, setName] = useState('')
  const [email, setEmail] = useState(rememberedEmail)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [useRemembered, setUseRemembered] = useState(
    Boolean(rememberedEmail)
  )

  function changeMode() {
    const nextMode = mode === 'login' ? 'register' : 'login'

    setMode(nextMode)
    setError('')
    setNotice('')
    setPassword('')
    setConfirm('')

    if (nextMode === 'login' && useRemembered) {
      setEmail(rememberedEmail)
    }
  }

  function changeAccount() {
    onForgetRememberedEmail()

    setUseRemembered(false)
    setEmail('')
    setPassword('')
    setError('')
    setNotice('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()

    setError('')
    setNotice('')

    if (mode === 'register' && password !== confirm) {
      setError('Konfirmasi password tidak sama.')
      return
    }

    setBusy(true)

    try {
      if (mode === 'login') {
        const user = await onLogin(
          {} as User,
          email.trim(),
          password
        )

        if (user) return
      } else {
        await onRegister(
          name,
          email.trim(),
          password
        )

        setNotice(
          'Pendaftaran berhasil dikirim. Akun menunggu persetujuan admin sebelum dapat login.'
        )

        setMode('login')
        setPassword('')
        setConfirm('')

        if (useRemembered) {
          setEmail(rememberedEmail)
        }
      }

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">

      <div className="auth-art">
        <div className="brand">
          <span className="brand-icon">
            <Boxes size={25} />
          </span>

          <span>
            APK<span className="brand-accent">Management</span>
          </span>
        </div>

        <div className="art-copy">
          <span className="eyebrow">
            SMART BUSINESS WORKSPACE
          </span>

          <h1>
            Kelola bisnis.
            <br />
            <em>Kendalikan semuanya.</em>
          </h1>

          <p>
            Satu tempat untuk memantau persediaan,
            transaksi, keuangan, dan aktivitas tim Anda.
          </p>
        </div>

        <div className="art-bottom">
          <span className="pulse-dot" />
          Sistem manajemen terintegrasi
          <span>•</span>
          Aman &amp; terkontrol
        </div>

        <div className="orb orb-one" />
        <div className="orb orb-two" />
      </div>

      <section className="auth-panel">
        <div className="auth-card">

          <div className="mobile-brand">
            <Boxes />
            APK Management
          </div>

          <span className="eyebrow">
            {mode === 'login'
              ? 'SELAMAT DATANG KEMBALI'
              : 'BUAT AKUN BARU'}
          </span>

          <h2>
            {mode === 'login'
              ? 'Masuk ke akun'
              : 'Daftar akun'}
          </h2>

          <p className="muted">
            {mode === 'login'
              ? useRemembered
                ? 'Akun terakhir Anda sudah diingat. Masukkan password untuk melanjutkan.'
                : 'Masukkan email dan password untuk melanjutkan.'
              : 'Akun baru perlu disetujui admin sebelum digunakan.'}
          </p>

          <form onSubmit={submit}>

            {mode === 'register' && (
              <label>
                Nama lengkap

                <div className="field">
                  <UserRound size={17} />

                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Nama lengkap"
                    required
                    minLength={2}
                    autoComplete="name"
                  />
                </div>
              </label>
            )}

            <label>
              Email

              <div className="field">
                <Mail size={17} />

                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  required
                  readOnly={
                    mode === 'login' && useRemembered
                  }
                  autoComplete="username"
                />
              </div>

              {mode === 'login' && useRemembered && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={changeAccount}
                  style={{
                    marginTop: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    width: 'auto'
                  }}
                >
                  <RefreshCw size={14} />
                  Ganti akun
                </button>
              )}
            </label>

            <label>
              Password

              <div className="field">
                <LockKeyhole size={17} />

                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  required
                  minLength={8}
                  autoComplete={
                    mode === 'login'
                      ? 'current-password'
                      : 'new-password'
                  }
                />

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShow(!show)}
                  aria-label={
                    show ? 'Sembunyikan password' : 'Lihat password'
                  }
                >
                  {show
                    ? <EyeOff size={17} />
                    : <Eye size={17} />}
                </button>
              </div>
            </label>

            {mode === 'register' && (
              <label>
                Konfirmasi password

                <div className="field">
                  <LockKeyhole size={17} />

                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Ulangi password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </label>
            )}

            {error && (
              <div className="alert error">
                {error}
              </div>
            )}

            {notice && (
              <div className="alert success">
                {notice}
              </div>
            )}

            <button
              className="primary-btn full"
              disabled={busy}
            >
              {busy
                ? 'Memproses...'
                : mode === 'login'
                  ? 'Login'
                  : 'Kirim pendaftaran'}

              <ArrowRight size={17} />
            </button>

          </form>

          <div className="auth-switch">
            {mode === 'login'
              ? 'Belum memiliki akun?'
              : 'Sudah memiliki akun?'}

            {' '}

            <button
              type="button"
              onClick={changeMode}
            >
              {mode === 'login'
                ? 'Daftar sekarang'
                : 'Login'}
            </button>
          </div>

          <div className="auth-foot">
            Dengan melanjutkan, Anda menyetujui
            kebijakan penggunaan aplikasi.
          </div>

        </div>
      </section>

    </main>
  )
}
