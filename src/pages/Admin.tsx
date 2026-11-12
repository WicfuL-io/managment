
import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  X,
  ShieldCheck,
  Users,
  Globe,
  Clock3,
  LockKeyhole,
  Save,
  RefreshCw,
  UserCheck,
  UserX,
  Search,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  Activity,
  CalendarDays,
  Filter,
  Mail,
  MapPin,
  CircleCheck,
  CircleAlert,
  Laptop,
  Eye,
  Settings,
  Layers,
} from 'lucide-react'

import { api } from '../lib/api'
import type { User } from '../types'

type Props = {
  page: 'users' | 'logs' | 'settings'
  token: string
}

type LoginLog = {
  email: string
  event: string
  timestamp: string
  ipAddress: string
  deviceType: string
  browser: string
  platform: string
  userAgent: string
  screen: string
  timezone: string
  detail: string
}

type ActivityLog = {
  email: string
  action: string
  module: string
  description: string
  timestamp: string
  ipAddress: string
}

type SlideShowProps<T> = {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  emptyTitle: string
  emptyDescription: string
  pageSize?: number
}

const permissions = [
  'Dashboard',
  'Stock Barang',
  'Tambah barang',
  'Point of Sale',
  'Keuangan',
  'Tambah transaksi',
  'Lihat laporan',
]

const dateFormat = (value: string) => {
  if (!value || value === 'undefined' || value === 'null') return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('')

const statusLabel = (status: string) => {
  if (status === 'active') return 'Aktif'
  if (status === 'pending') return 'Menunggu'
  if (status === 'blocked') return 'Diblokir'
  return status || 'Tidak diketahui'
}

function SlideShow<T>({
  items,
  renderItem,
  emptyTitle,
  emptyDescription,
}: SlideShowProps<T>) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
  }, [items.length])

  useEffect(() => {
    if (activeIndex >= items.length) {
      setActiveIndex(Math.max(0, items.length - 1))
    }
  }, [activeIndex, items.length])

  const previous = () => {
    setActiveIndex((current) =>
      current <= 0 ? items.length - 1 : current - 1,
    )
  }

  const next = () => {
    setActiveIndex((current) =>
      current >= items.length - 1 ? 0 : current + 1,
    )
  }

  if (!items.length) {
    return (
      <div className="admin-slide-empty">
        <div className="admin-empty-icon">
          <Layers size={28} />
        </div>
        <h3>{emptyTitle}</h3>
        <p>{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="admin-slideshow">
      <div className="admin-slide-window">
        <div
          className="admin-slide-track"
          style={{
            transform: `translateX(-${activeIndex * 100}%)`,
          }}
        >
          {items.map((item, index) => (
            <div className="admin-slide" key={index}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>

      <div className="admin-slide-navigation">
        <button
          type="button"
          className="admin-slide-arrow"
          onClick={previous}
          disabled={items.length <= 1}
          aria-label="Slide sebelumnya"
        >
          <ChevronLeft size={19} />
        </button>

        <div className="admin-slide-indicators">
          {items.map((_, index) => (
            <button
              type="button"
              key={index}
              aria-label={`Slide ${index + 1}`}
              className={`admin-slide-dot ${
                index === activeIndex ? 'active' : ''
              }`}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>

        <span className="admin-slide-counter">
          {String(activeIndex + 1).padStart(2, '0')}
          <span>/</span>
          {String(items.length).padStart(2, '0')}
        </span>

        <button
          type="button"
          className="admin-slide-arrow"
          onClick={next}
          disabled={items.length <= 1}
          aria-label="Slide berikutnya"
        >
          <ChevronRight size={19} />
        </button>
      </div>
    </div>
  )
}

function SearchFilter({
  search,
  setSearch,
  placeholder,
  filters,
}: {
  search: string
  setSearch: (value: string) => void
  placeholder: string
  filters?: React.ReactNode
}) {
  return (
    <div className="admin-search-toolbar">
      <div className="admin-search-input">
        <Search size={18} />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={placeholder}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Hapus pencarian"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {filters && (
        <div className="admin-filter-control">
          <Filter size={16} />
          {filters}
        </div>
      )}
    </div>
  )
}

export default function Admin({ page, token }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])

  const [selected, setSelected] = useState<User | null>(null)
  const [enabled, setEnabled] = useState<string[]>([])

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)

  // PENCARIAN DAN FILTER USER
  const [userSearch, setUserSearch] = useState('')
  const [userStatus, setUserStatus] = useState('all')
  const [userRole, setUserRole] = useState('all')

  // PENCARIAN DAN FILTER LOGIN
  const [loginSearch, setLoginSearch] = useState('')
  const [loginEvent, setLoginEvent] = useState('all')
  const [loginDevice, setLoginDevice] = useState('all')

  // PENCARIAN DAN FILTER AKTIVITAS
  const [activitySearch, setActivitySearch] = useState('')
  const [activityModule, setActivityModule] = useState('all')

  // PENCARIAN SETTINGS
  const [settingsSearch, setSettingsSearch] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    try {
      if (page === 'users' || page === 'settings') {
        const result = await api<User[]>('admin.listUsers', { token })
        setUsers(result.data || [])
      } else {
        const [loginResult, activityResult] = await Promise.all([
          api<LoginLog[]>('admin.loginLogs', { token }),
          api<ActivityLog[]>('admin.activityLogs', { token }),
        ])

        setLoginLogs(loginResult.data || [])
        setActivityLogs(activityResult.data || [])
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Gagal mengambil data admin.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [page, token])

  async function approve(u: User, role: 'staff' | 'admin' = 'staff') {
    setBusy(true)
    setError('')
    setMessage('')

    try {
      await api('admin.approveUser', {
        token,
        userId: u.id,
        role,
      })

      setMessage(`Akun ${u.email} berhasil disetujui.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal approve.')
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(u: User, status: 'active' | 'blocked') {
    setBusy(true)
    setError('')
    setMessage('')

    try {
      await api('admin.setUserStatus', {
        token,
        userId: u.id,
        status,
      })

      setMessage(
        status === 'active'
          ? `Akun ${u.email} berhasil diaktifkan.`
          : `Akun ${u.email} berhasil diblokir.`,
      )

      await load()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Gagal mengubah status akun.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function savePermissions() {
    if (!selected) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      await api('admin.setPermissions', {
        token,
        userId: selected.id,
        permissions: enabled,
      })

      setMessage('Hak akses berhasil disimpan ke Google Sheets.')
      setSelected(null)
      await load()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Gagal menyimpan hak akses.',
      )
    } finally {
      setBusy(false)
    }
  }

  // FILTER USER
  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase()

    return users.filter((user) => {
      const matchesSearch =
        !keyword ||
        user.name?.toLowerCase().includes(keyword) ||
        user.email?.toLowerCase().includes(keyword)

      const matchesStatus =
        userStatus === 'all' || user.status === userStatus

      const matchesRole =
        userRole === 'all' || user.role === userRole

      return matchesSearch && matchesStatus && matchesRole
    })
  }, [users, userSearch, userStatus, userRole])

  // FILTER LOGIN
  const filteredLoginLogs = useMemo(() => {
    const keyword = loginSearch.trim().toLowerCase()

    return loginLogs.filter((log) => {
      const matchesSearch =
        !keyword ||
        log.email?.toLowerCase().includes(keyword) ||
        log.ipAddress?.toLowerCase().includes(keyword) ||
        log.browser?.toLowerCase().includes(keyword) ||
        log.platform?.toLowerCase().includes(keyword) ||
        log.deviceType?.toLowerCase().includes(keyword) ||
        log.detail?.toLowerCase().includes(keyword)

      const matchesEvent =
        loginEvent === 'all' || log.event === loginEvent

      const matchesDevice =
        loginDevice === 'all' || log.deviceType === loginDevice

      return matchesSearch && matchesEvent && matchesDevice
    })
  }, [loginLogs, loginSearch, loginEvent, loginDevice])

  // FILTER AKTIVITAS
  const filteredActivityLogs = useMemo(() => {
    const keyword = activitySearch.trim().toLowerCase()

    return activityLogs.filter((log) => {
      const matchesSearch =
        !keyword ||
        log.email?.toLowerCase().includes(keyword) ||
        log.module?.toLowerCase().includes(keyword) ||
        log.action?.toLowerCase().includes(keyword) ||
        log.description?.toLowerCase().includes(keyword) ||
        log.ipAddress?.toLowerCase().includes(keyword)

      const matchesModule =
        activityModule === 'all' || log.module === activityModule

      return matchesSearch && matchesModule
    })
  }, [activityLogs, activitySearch, activityModule])

  // FILTER SETTINGS
  const activeStaff = useMemo(() => {
    const keyword = settingsSearch.trim().toLowerCase()

    return users.filter((user) => {
      const isStaff = user.role !== 'admin' && user.status === 'active'

      const matchesSearch =
        !keyword ||
        user.name?.toLowerCase().includes(keyword) ||
        user.email?.toLowerCase().includes(keyword)

      return isStaff && matchesSearch
    })
  }, [users, settingsSearch])

  const loginEvents = useMemo(
    () => [...new Set(loginLogs.map((log) => log.event).filter(Boolean))],
    [loginLogs],
  )

  const loginDevices = useMemo(
    () => [...new Set(loginLogs.map((log) => log.deviceType).filter(Boolean))],
    [loginLogs],
  )

  const activityModules = useMemo(
    () => [...new Set(activityLogs.map((log) => log.module).filter(Boolean))],
    [activityLogs],
  )

  const activeUsers = users.filter((user) => user.status === 'active').length
  const pendingUsers = users.filter((user) => user.status === 'pending').length
  const blockedUsers = users.filter((user) => user.status === 'blocked').length

  return (
    <div className="page-stack admin-page">

      {/* HEADER */}
      <div className="page-heading admin-heading">
        <div>
          <span className="eyebrow">SYSTEM ADMINISTRATION</span>

          <h1>
            {page === 'users'
              ? 'Manajemen User'
              : page === 'logs'
                ? 'Log Aktivitas & Login'
                : 'Pengaturan & Hak Akses'}
          </h1>

          <p>
            Kelola pengguna, pantau aktivitas, dan atur keamanan sistem
            melalui satu panel administrasi.
          </p>
        </div>

        <button
          type="button"
          className="outline-btn admin-refresh"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          <RefreshCw
            size={16}
            className={loading ? 'admin-spin' : ''}
          />
          {loading ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      {/* ALERT */}
      {error && (
        <div className="alert error admin-alert">
          <CircleAlert size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {message && (
        <div className="alert success admin-alert">
          <CircleCheck size={17} />
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ================= USER MANAGEMENT ================= */}
      {page === 'users' && (
        <>
          <div className="admin-overview-grid">
            <div className="admin-overview-card">
              <div className="admin-overview-icon blue">
                <Users size={21} />
              </div>
              <div>
                <span>Total pengguna</span>
                <strong>{users.length}</strong>
                <small>Seluruh akun terdaftar</small>
              </div>
            </div>

            <div className="admin-overview-card">
              <div className="admin-overview-icon orange">
                <Clock3 size={21} />
              </div>
              <div>
                <span>Menunggu persetujuan</span>
                <strong>{pendingUsers}</strong>
                <small>Akun perlu ditinjau</small>
              </div>
            </div>

            <div className="admin-overview-card">
              <div className="admin-overview-icon green">
                <ShieldCheck size={21} />
              </div>
              <div>
                <span>Akun aktif</span>
                <strong>{activeUsers}</strong>
                <small>Pengguna dapat mengakses</small>
              </div>
            </div>

            <div className="admin-overview-card">
              <div className="admin-overview-icon red">
                <UserX size={21} />
              </div>
              <div>
                <span>Akun diblokir</span>
                <strong>{blockedUsers}</strong>
                <small>Akses dinonaktifkan</small>
              </div>
            </div>
          </div>

          <section className="panel admin-content-panel">
            <div className="admin-section-heading">
              <div>
                <span className="admin-section-kicker">
                  USER DIRECTORY
                </span>
                <h3>Daftar Pengguna</h3>
                <p>
                  Telusuri akun dan kelola status serta hak aksesnya.
                </p>
              </div>

              <span className="admin-result-count">
                {filteredUsers.length} akun ditemukan
              </span>
            </div>

            <SearchFilter
              search={userSearch}
              setSearch={setUserSearch}
              placeholder="Cari nama atau email pengguna..."
              filters={
                <>
                  <select
                    value={userStatus}
                    onChange={(e) => setUserStatus(e.target.value)}
                  >
                    <option value="all">Semua status</option>
                    <option value="active">Aktif</option>
                    <option value="pending">Menunggu</option>
                    <option value="blocked">Diblokir</option>
                  </select>

                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                  >
                    <option value="all">Semua role</option>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </>
              }
            />

            {loading ? (
              <div className="admin-loading">
                <RefreshCw className="admin-spin" size={25} />
                <span>Memuat data pengguna...</span>
              </div>
            ) : (
              <SlideShow
                items={filteredUsers}
                emptyTitle="Pengguna tidak ditemukan"
                emptyDescription="Coba ubah kata pencarian atau filter yang digunakan."
                renderItem={(user) => (
                  <article className="admin-user-slide">
                    <div className="admin-slide-card-top">
                      <div className="admin-user-identity">
                        <div className="admin-avatar">
                          {initials(user.name || user.email || 'U')}
                        </div>

                        <div>
                          <span className="admin-card-label">
                            USER ACCOUNT
                          </span>
                          <h3>{user.name}</h3>
                          <p>
                            <Mail size={14} />
                            {user.email}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`admin-status ${
                          user.status === 'active'
                            ? 'is-active'
                            : user.status === 'pending'
                              ? 'is-pending'
                              : 'is-blocked'
                        }`}
                      >
                        <span />
                        {statusLabel(user.status)}
                      </span>
                    </div>

                    <div className="admin-user-information">
                      <div>
                        <span>ROLE PENGGUNA</span>
                        <strong>
                          {user.role === 'admin' ? 'Administrator' : 'Staff'}
                        </strong>
                      </div>

                      <div>
                        <span>STATUS AKUN</span>
                        <strong>{statusLabel(user.status)}</strong>
                      </div>

                      <div className="admin-user-permissions">
                        <span>HAK AKSES</span>
                        <div className="admin-permission-tags">
                          {user.role === 'admin' ? (
                            <span className="admin-permission-tag admin-tag-all">
                              <ShieldCheck size={13} />
                              Semua akses
                            </span>
                          ) : (user.permissions || []).length ? (
                            (user.permissions || []).map((permission) => (
                              <span
                                className="admin-permission-tag"
                                key={permission}
                              >
                                {permission}
                              </span>
                            ))
                          ) : (
                            <span className="admin-no-permission">
                              Belum ada hak akses
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="admin-card-actions">
                      {user.status === 'pending' ? (
                        <button
                          type="button"
                          className="admin-action-primary"
                          disabled={busy}
                          onClick={() => void approve(user)}
                        >
                          <Check size={17} />
                          Setujui Akun
                        </button>
                      ) : (
                        <>
                          {user.role !== 'admin' && (
                            <button
                              type="button"
                              className="admin-action-secondary"
                              disabled={busy}
                              onClick={() => {
                                setSelected(user)
                                setEnabled(user.permissions || [])
                              }}
                            >
                              <LockKeyhole size={16} />
                              Atur Hak Akses
                            </button>
                          )}

                          {user.status === 'active' ? (
                            <button
                              type="button"
                              className="admin-action-danger"
                              disabled={busy}
                              onClick={() => void changeStatus(user, 'blocked')}
                            >
                              <UserX size={16} />
                              Blokir Akun
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-action-primary"
                              disabled={busy}
                              onClick={() => void changeStatus(user, 'active')}
                            >
                              <UserCheck size={16} />
                              Aktifkan Akun
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                )}
              />
            )}
          </section>
        </>
      )}

      {/* ================= LOGIN AND ACTIVITY LOGS ================= */}
      {page === 'logs' && (
        <>
          <div className="admin-overview-grid admin-log-overview">
            <div className="admin-overview-card">
              <div className="admin-overview-icon blue">
                <Monitor size={21} />
              </div>
              <div>
                <span>Riwayat login</span>
                <strong>{loginLogs.length}</strong>
                <small>Total catatan login</small>
              </div>
            </div>

            <div className="admin-overview-card">
              <div className="admin-overview-icon purple">
                <Activity size={21} />
              </div>
              <div>
                <span>Aktivitas sistem</span>
                <strong>{activityLogs.length}</strong>
                <small>Total catatan aktivitas</small>
              </div>
            </div>
          </div>

          {/* LOGIN SLIDESHOW */}
          <section className="panel admin-content-panel">
            <div className="admin-section-heading">
              <div>
                <span className="admin-section-kicker">
                  AUTHENTICATION HISTORY
                </span>
                <h3>Riwayat Login</h3>
                <p>
                  Pantau perangkat, lokasi jaringan, browser, dan aktivitas
                  autentikasi pengguna.
                </p>
              </div>

              <span className="admin-result-count">
                {filteredLoginLogs.length} catatan
              </span>
            </div>

            <SearchFilter
              search={loginSearch}
              setSearch={setLoginSearch}
              placeholder="Cari email, IP, browser, perangkat..."
              filters={
                <>
                  <select
                    value={loginEvent}
                    onChange={(e) => setLoginEvent(e.target.value)}
                  >
                    <option value="all">Semua event</option>
                    {loginEvents.map((event) => (
                      <option key={event} value={event}>
                        {event}
                      </option>
                    ))}
                  </select>

                  <select
                    value={loginDevice}
                    onChange={(e) => setLoginDevice(e.target.value)}
                  >
                    <option value="all">Semua perangkat</option>
                    {loginDevices.map((device) => (
                      <option key={device} value={device}>
                        {device}
                      </option>
                    ))}
                  </select>
                </>
              }
            />

            {loading ? (
              <div className="admin-loading">
                <RefreshCw className="admin-spin" size={25} />
                <span>Memuat riwayat login...</span>
              </div>
            ) : (
              <SlideShow
                items={filteredLoginLogs}
                emptyTitle="Riwayat login tidak ditemukan"
                emptyDescription="Tidak ada catatan yang cocok dengan pencarian dan filter."
                renderItem={(log) => (
                  <article className="admin-log-slide">
                    <div className="admin-slide-card-top">
                      <div className="admin-user-identity">
                        <div className="admin-log-icon">
                          <ShieldCheck size={23} />
                        </div>

                        <div>
                          <span className="admin-card-label">
                            LOGIN ACTIVITY
                          </span>
                          <h3>{log.email}</h3>
                          <p>
                            <CalendarDays size={14} />
                            {dateFormat(log.timestamp)}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`admin-event-tag ${
                          log.event?.toLowerCase().includes('logout')
                            ? 'event-logout'
                            : 'event-login'
                        }`}
                      >
                        {log.event}
                      </span>
                    </div>

                    <div className="admin-log-grid">
                      <div className="admin-log-info">
                        <span><MapPin size={14} /> IP ADDRESS</span>
                        <strong>{log.ipAddress || '-'}</strong>
                      </div>

                      <div className="admin-log-info">
                        <span>
                          {log.deviceType?.toLowerCase().includes('mobile')
                            ? <Smartphone size={14} />
                            : <Laptop size={14} />}
                          PERANGKAT
                        </span>
                        <strong>{log.deviceType || '-'}</strong>
                      </div>

                      <div className="admin-log-info">
                        <span><Globe size={14} /> BROWSER</span>
                        <strong>{log.browser || '-'}</strong>
                      </div>

                      <div className="admin-log-info">
                        <span><Monitor size={14} /> PLATFORM</span>
                        <strong>{log.platform || '-'}</strong>
                      </div>

                      <div className="admin-log-info">
                        <span><Eye size={14} /> UKURAN LAYAR</span>
                        <strong>{log.screen || '-'}</strong>
                      </div>

                      <div className="admin-log-info">
                        <span><Clock3 size={14} /> TIMEZONE</span>
                        <strong>{log.timezone || '-'}</strong>
                      </div>
                    </div>

                    <div className="admin-log-description">
                      <span>DETAIL AKTIVITAS</span>
                      <p>{log.detail || 'Tidak ada detail tambahan.'}</p>
                    </div>
                  </article>
                )}
              />
            )}

            <p className="notice-text admin-privacy-note">
              <Globe size={15} />
              Browser tidak dapat membaca IMEI, MAC address, atau serial
              number perangkat. IP publik bergantung pada jaringan yang
              digunakan.
            </p>
          </section>

          {/* ACTIVITY SLIDESHOW */}
          <section className="panel admin-content-panel">
            <div className="admin-section-heading">
              <div>
                <span className="admin-section-kicker">
                  SYSTEM AUDIT TRAIL
                </span>
                <h3>Log Aktivitas</h3>
                <p>
                  Catatan perubahan data dan aktivitas pengguna di dalam
                  aplikasi.
                </p>
              </div>

              <span className="admin-result-count">
                {filteredActivityLogs.length} aktivitas
              </span>
            </div>

            <SearchFilter
              search={activitySearch}
              setSearch={setActivitySearch}
              placeholder="Cari pengguna, modul, aksi, deskripsi..."
              filters={
                <select
                  value={activityModule}
                  onChange={(e) => setActivityModule(e.target.value)}
                >
                  <option value="all">Semua modul</option>
                  {activityModules.map((module) => (
                    <option key={module} value={module}>
                      {module}
                    </option>
                  ))}
                </select>
              }
            />

            {loading ? (
              <div className="admin-loading">
                <RefreshCw className="admin-spin" size={25} />
                <span>Memuat log aktivitas...</span>
              </div>
            ) : (
              <SlideShow
                items={filteredActivityLogs}
                emptyTitle="Aktivitas tidak ditemukan"
                emptyDescription="Coba ubah kata pencarian atau pilih modul lainnya."
                renderItem={(log) => (
                  <article className="admin-log-slide">
                    <div className="admin-slide-card-top">
                      <div className="admin-user-identity">
                        <div className="admin-activity-icon">
                          <Activity size={23} />
                        </div>

                        <div>
                          <span className="admin-card-label">
                            SYSTEM ACTIVITY
                          </span>
                          <h3>{log.email}</h3>
                          <p>
                            <CalendarDays size={14} />
                            {dateFormat(log.timestamp)}
                          </p>
                        </div>
                      </div>

                      <span className="admin-event-tag event-activity">
                        {log.action || 'Aktivitas'}
                      </span>
                    </div>

                    <div className="admin-activity-information">
                      <div>
                        <span>MODUL</span>
                        <strong>{log.module || '-'}</strong>
                      </div>

                      <div>
                        <span>AKSI</span>
                        <strong>{log.action || '-'}</strong>
                      </div>

                      <div>
                        <span>IP ADDRESS</span>
                        <strong>{log.ipAddress || '-'}</strong>
                      </div>
                    </div>

                    <div className="admin-log-description">
                      <span>DESKRIPSI AKTIVITAS</span>
                      <p>
                        {log.description || 'Tidak ada deskripsi.'}
                      </p>
                    </div>
                  </article>
                )}
              />
            )}
          </section>
        </>
      )}

      {/* ================= SETTINGS ================= */}
      {page === 'settings' && (
        <>
          <section className="panel admin-content-panel">
            <div className="admin-section-heading">
              <div>
                <span className="admin-section-kicker">
                  ACCESS CONTROL
                </span>
                <h3>Hak Akses Staff</h3>
                <p>
                  Pilih akun staff untuk mengatur modul yang dapat diakses.
                  Admin tetap memiliki akses penuh.
                </p>
              </div>

              <span className="admin-result-count">
                {activeStaff.length} staff aktif
              </span>
            </div>

            <SearchFilter
              search={settingsSearch}
              setSearch={setSettingsSearch}
              placeholder="Cari nama atau email staff..."
            />

            {loading ? (
              <div className="admin-loading">
                <RefreshCw className="admin-spin" size={25} />
                <span>Memuat data staff...</span>
              </div>
            ) : (
              <SlideShow
                items={activeStaff}
                emptyTitle="Staff tidak ditemukan"
                emptyDescription="Belum ada staff aktif yang sesuai dengan pencarian."
                renderItem={(user) => (
                  <article className="admin-user-slide">
                    <div className="admin-slide-card-top">
                      <div className="admin-user-identity">
                        <div className="admin-avatar">
                          {initials(user.name || user.email || 'U')}
                        </div>

                        <div>
                          <span className="admin-card-label">
                            STAFF ACCESS CONTROL
                          </span>
                          <h3>{user.name}</h3>
                          <p>
                            <Mail size={14} />
                            {user.email}
                          </p>
                        </div>
                      </div>

                      <span className="admin-status is-active">
                        <span />
                        Aktif
                      </span>
                    </div>

                    <div className="admin-settings-permissions">
                      <span>MODUL YANG DAPAT DIAKSES</span>

                      <div className="admin-permission-tags">
                        {(user.permissions || []).length ? (
                          (user.permissions || []).map((permission) => (
                            <span
                              className="admin-permission-tag"
                              key={permission}
                            >
                              <Check size={12} />
                              {permission}
                            </span>
                          ))
                        ) : (
                          <span className="admin-no-permission">
                            Belum ada hak akses yang diberikan.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="admin-card-actions">
                      <button
                        type="button"
                        className="admin-action-primary"
                        onClick={() => {
                          setSelected(user)
                          setEnabled(user.permissions || [])
                        }}
                      >
                        <Settings size={16} />
                        Atur Hak Akses
                      </button>
                    </div>
                  </article>
                )}
              />
            )}
          </section>

          <section className="panel admin-content-panel">
            <div className="admin-section-heading">
              <div>
                <span className="admin-section-kicker">
                  SYSTEM SECURITY
                </span>
                <h3>Keamanan Sistem</h3>
                <p>Informasi mekanisme keamanan aplikasi.</p>
              </div>
              <div className="admin-security-badge">
                <ShieldCheck size={17} />
                Protected
              </div>
            </div>

            <div className="admin-security-grid">
              <div className="admin-security-card">
                <div className="admin-security-icon green">
                  <ShieldCheck size={21} />
                </div>
                <div>
                  <strong>Password di-hash</strong>
                  <p>Password tidak disimpan sebagai teks biasa.</p>
                </div>
              </div>

              <div className="admin-security-card">
                <div className="admin-security-icon blue">
                  <Clock3 size={21} />
                </div>
                <div>
                  <strong>Session 6 jam</strong>
                  <p>Token sesi diverifikasi kembali ke server.</p>
                </div>
              </div>

              <div className="admin-security-card">
                <div className="admin-security-icon purple">
                  <Users size={21} />
                </div>
                <div>
                  <strong>Persetujuan admin</strong>
                  <p>Akun baru tidak dapat login sebelum disetujui.</p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ================= PERMISSION MODAL ================= */}
      {selected && (
        <div
          className="admin-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setSelected(null)
            }
          }}
        >
          <section className="admin-permission-modal">
            <div className="admin-modal-header">
              <div>
                <span className="admin-section-kicker">
                  ACCESS CONFIGURATION
                </span>
                <h2>Pengaturan Hak Akses</h2>
                <p>
                  Atur modul yang dapat digunakan oleh {selected.name}.
                </p>
              </div>

              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setSelected(null)}
                disabled={busy}
              >
                <X size={19} />
              </button>
            </div>

            <div className="admin-selected-user">
              <div className="admin-avatar">
                {initials(selected.name || selected.email)}
              </div>

              <div>
                <strong>{selected.name}</strong>
                <span>{selected.email}</span>
              </div>

              <span className="admin-status is-active">
                <span />
                Staff
              </span>
            </div>

            <div className="admin-permission-summary">
              <span>MODUL TERPILIH</span>
              <strong>{enabled.length} / {permissions.length}</strong>
            </div>

            <div className="admin-permission-progress">
              <span
                style={{
                  width: `${(enabled.length / permissions.length) * 100}%`,
                }}
              />
            </div>

            <div className="admin-permission-grid">
              {permissions.map((permission) => {
                const checked = enabled.includes(permission)

                return (
                  <label
                    className={`admin-permission-option ${
                      checked ? 'selected' : ''
                    }`}
                    key={permission}
                  >
                    <span className="admin-permission-checkbox">
                      {checked && <Check size={14} />}
                    </span>

                    <span className="admin-permission-name">
                      {permission}
                    </span>

                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setEnabled(
                          event.target.checked
                            ? [...enabled, permission]
                            : enabled.filter((item) => item !== permission),
                        )
                      }
                    />
                  </label>
                )
              })}
            </div>

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-action-secondary"
                onClick={() => setSelected(null)}
                disabled={busy}
              >
                Batal
              </button>

              <button
                type="button"
                className="admin-action-primary"
                onClick={() => void savePermissions()}
                disabled={busy}
              >
                {busy ? (
                  <RefreshCw className="admin-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                {busy ? 'Menyimpan...' : 'Simpan Hak Akses'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
