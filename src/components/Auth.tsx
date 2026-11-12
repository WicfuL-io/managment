import { useState } from 'react'
import { Boxes, Eye, EyeOff, LockKeyhole, Mail, UserRound, ArrowRight } from 'lucide-react'
import type { User } from '../types'

type Props = { onLogin: (user: User, email: string, password: string) => Promise<User>; onRegister: (name: string, email: string, password: string) => Promise<void> }
export default function Auth({ onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setNotice('')
    if (mode === 'register' && password !== confirm) return setError('Konfirmasi password tidak sama.')
    setBusy(true)
    try {
      if (mode === 'login') {
        const user = await onLogin({} as User, email, password)
        if (user) return
      } else {
        await onRegister(name, email, password)
        setNotice('Pendaftaran berhasil dikirim. Akun menunggu persetujuan admin sebelum dapat login.')
        setMode('login'); setPassword(''); setConfirm('')
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Terjadi kesalahan.') }
    finally { setBusy(false) }
  }

  return <main className="auth-shell">
    <div className="auth-art">
      <div className="brand"><span className="brand-icon"><Boxes size={25}/></span><span>APK<span className="brand-accent">Management</span></span></div>
      <div className="art-copy"><span className="eyebrow">SMART BUSINESS WORKSPACE</span><h1>Kelola bisnis.<br/><em>Kendalikan semuanya.</em></h1><p>Satu tempat untuk memantau persediaan, transaksi, keuangan, dan aktivitas tim Anda.</p></div>
      <div className="art-bottom"><span className="pulse-dot"/> Sistem manajemen terintegrasi <span>•</span> Aman & terkontrol</div>
      <div className="orb orb-one"/><div className="orb orb-two"/>
    </div>
    <section className="auth-panel">
      <div className="auth-card">
        <div className="mobile-brand"><Boxes/> APK Management</div>
        <span className="eyebrow">{mode === 'login' ? 'SELAMAT DATANG KEMBALI' : 'BUAT AKUN BARU'}</span>
        <h2>{mode === 'login' ? 'Masuk ke akun' : 'Daftar akun'}</h2>
        <p className="muted">{mode === 'login' ? 'Masukkan email dan password untuk melanjutkan.' : 'Akun baru perlu disetujui admin sebelum digunakan.'}</p>
        <form onSubmit={submit}>
          {mode === 'register' && <label>Nama lengkap<div className="field"><UserRound size={17}/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama lengkap" required minLength={2}/></div></label>}
          <label>Email<div className="field"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com" required/></div></label>
          <label>Password<div className="field"><LockKeyhole size={17}/><input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 8 karakter" required minLength={8}/><button type="button" className="icon-btn" onClick={()=>setShow(!show)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
          {mode === 'register' && <label>Konfirmasi password<div className="field"><LockKeyhole size={17}/><input type={show?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Ulangi password" required minLength={8}/></div></label>}
          {error && <div className="alert error">{error}</div>}{notice && <div className="alert success">{notice}</div>}
          <button className="primary-btn full" disabled={busy}>{busy?'Memproses...':mode==='login'?'Login':'Kirim pendaftaran'} <ArrowRight size={17}/></button>
        </form>
        <div className="auth-switch">{mode==='login'?'Belum memiliki akun?':'Sudah memiliki akun?'} <button onClick={()=>{setMode(mode==='login'?'register':'login');setError('');setNotice('')}}>{mode==='login'?'Daftar sekarang':'Login'}</button></div>
        <div className="auth-foot">Dengan melanjutkan, Anda menyetujui kebijakan penggunaan aplikasi.</div>
      </div>
    </section>
  </main>
}
