
import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Wallet,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bell,
  Package,
  HandCoins,
  CheckCheck,
  Check,
  BellRing,
  LoaderCircle
} from 'lucide-react'

import type { Page, User } from '../types'
import { api } from '../lib/api'
import '../css/shell.css'

const nav: {
  id: Page
  label: string
  icon: typeof LayoutDashboard
  admin?: boolean
  permission?: string
}[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard
  },
  {
    id: 'stock',
    label: 'Stock Barang',
    icon: Boxes,
    permission: 'Stock Barang'
  },
  {
    id: 'pos',
    label: 'Point of Sale',
    icon: ShoppingCart,
    permission: 'Point of Sale'
  },
  {
    id: 'finance',
    label: 'Keuangan',
    icon: Wallet,
    permission: 'Keuangan'
  },
  {
    id: 'debt',
    label: 'Utang & Piutang',
    icon: HandCoins,
    permission: 'Utang & Piutang'
  },
  {
    id: 'users',
    label: 'Manajemen User',
    icon: Users,
    admin: true
  },
  {
    id: 'logs',
    label: 'Log Aktivitas',
    icon: ClipboardList,
    admin: true
  },
  {
    id: 'settings',
    label: 'Pengaturan',
    icon: Settings,
    admin: true
  }
]

type NotificationItem = {
  id: string | number
  userId?: string
  actorId?: string
  actorName?: string
  action?: string
  module?: string
  title?: string
  message?: string
  createdAt?: string
  isRead?: boolean | string
  readAt?: string
  referenceId?: string
}

type Props = {
  user: User
  token: string
  page: Page
  setPage: (p: Page) => void
  onLogout: () => void
  onEnableNotifications: () => void
  children: React.ReactNode
}

export default function Shell({
  user,
  token,
  page,
  setPage,
  onLogout,
  onEnableNotifications,
  children
}: Props) {
  const [open, setOpen] = useState(false)

  // Notification states
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [notificationError, setNotificationError] = useState('')

  const visible = nav.filter(item => {
    if (user.role === 'admin') return true

    if (item.admin) return false

    if (item.id === 'dashboard') return true

    return (user.permissions || []).includes(
      item.permission || ''
    )
  })

  // Mengambil jumlah notifikasi yang belum dibaca
  const loadUnreadCount = useCallback(async () => {
    if (!token) return

    try {
      const result = await api<{ count: number }>(
        'notifications.unreadCount',
        { token }
      )

      setUnreadCount(Number(result.data?.count || 0))
    } catch (error) {
      console.error('[NOTIFICATION] Gagal mengambil jumlah:', error)
    }
  }, [token])

  // Mengambil daftar notifikasi
  const loadNotifications = useCallback(async () => {
    if (!token) return

    setLoadingNotifications(true)
    setNotificationError('')

    try {
      const result = await api<NotificationItem[]>(
        'notifications.list',
        { token }
      )

      const rows = Array.isArray(result.data)
        ? result.data
        : []

      setNotifications(rows)
    } catch (error) {
      console.error('[NOTIFICATION] Gagal mengambil daftar:', error)

      setNotificationError(
        error instanceof Error
          ? error.message
          : 'Gagal mengambil notifikasi.'
      )
    } finally {
      setLoadingNotifications(false)
    }
  }, [token])

  // Pemeriksaan otomatis setiap 10 detik
  useEffect(() => {
    if (!token) return

    loadUnreadCount()

    const interval = window.setInterval(() => {
      loadUnreadCount()

      if (notificationOpen) {
        loadNotifications()
      }
    }, 10000)

    return () => window.clearInterval(interval)
  }, [
    token,
    notificationOpen,
    loadUnreadCount,
    loadNotifications
  ])

  // Membuka panel notifikasi
  const toggleNotifications = async () => {
    const next = !notificationOpen

    setNotificationOpen(next)

    if (next) {
      await Promise.all([
        loadNotifications(),
        loadUnreadCount()
      ])
    }
  }

  // Tandai satu notifikasi sudah dibaca
  const markAsRead = async (notification: NotificationItem) => {
    const alreadyRead =
      notification.isRead === true ||
      notification.isRead === 'true'

    if (alreadyRead) return

    try {
      await api('notifications.markRead', {
        token,
        id: notification.id
      })

      setNotifications(previous =>
        previous.map(item =>
          item.id === notification.id
            ? { ...item, isRead: true }
            : item
        )
      )

      setUnreadCount(previous =>
        Math.max(0, previous - 1)
      )
    } catch (error) {
      console.error('[NOTIFICATION] Gagal menandai dibaca:', error)
    }
  }

  // Tandai semua notifikasi sudah dibaca
  const markAllAsRead = async () => {
    if (markingAll || unreadCount === 0) return

    setMarkingAll(true)

    try {
      await api('notifications.markAllRead', {
        token
      })

      setNotifications(previous =>
        previous.map(item => ({
          ...item,
          isRead: true
        }))
      )

      setUnreadCount(0)
    } catch (error) {
      console.error('[NOTIFICATION] Gagal menandai semua:', error)
    } finally {
      setMarkingAll(false)
    }
  }

  const formatNotificationDate = (value?: string) => {
    if (!value) return ''

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return ''

    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const isRead = (item: NotificationItem) =>
    item.isRead === true || item.isRead === 'true'

  return (
    <div className="app-shell">
      {open && (
        <button
          className="mobile-scrim"
          onClick={() => setOpen(false)}
          aria-label="Tutup menu"
        />
      )}

      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="side-brand">
          <span className="brand-icon">
            <Package size={22} />
          </span>

          <span>
            APK<span className="brand-accent">Management</span>
          </span>

          <button
            className="mobile-close"
            onClick={() => setOpen(false)}
            aria-label="Tutup sidebar"
          >
            <X />
          </button>
        </div>

        <div className="side-label">MENU UTAMA</div>

        <nav>
          {visible.map(item => {
            const Icon = item.icon

            return (
              <button
                key={item.id}
                className={`nav-item ${
                  page === item.id ? 'active' : ''
                }`}
                onClick={() => {
                  setPage(item.id)
                  setOpen(false)
                }}
              >
                <Icon size={18} />

                <span>{item.label}</span>

                {page === item.id && (
                  <ChevronRight
                    size={15}
                    className="nav-arrow"
                  />
                )}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✦</div>
            <b>Butuh bantuan?</b>
            <p>Hubungi administrator sistem Anda.</p>
          </div>

          <div className="side-version">
            APK Management <span>v1.0.0</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="menu-toggle"
            onClick={() => setOpen(true)}
            aria-label="Buka menu"
          >
            <Menu />
          </button>

          <div className="topbar-title">
            <span className="topbar-kicker">WORKSPACE</span>
            <b>Management Console</b>
          </div>

          <div className="top-actions">
            {/* Notification Center */}
            <div className="notification-wrapper">
              <button
                className={`top-icon notification-trigger ${
                  notificationOpen ? 'notification-active' : ''
                }`}
                title="Notifikasi"
                aria-label={`Notifikasi, ${unreadCount} belum dibaca`}
                aria-expanded={notificationOpen}
                onClick={toggleNotifications}
              >
                <Bell size={18} />

                {unreadCount > 0 && (
                  <span className="notification-badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <>
                  <button
                    className="notification-dismiss"
                    aria-label="Tutup notifikasi"
                    onClick={() => setNotificationOpen(false)}
                  />

                  <div className="notification-panel">
                    <div className="notification-header">
                      <div>
                        <b>Notifikasi</b>
                        <small>
                          {unreadCount > 0
                            ? `${unreadCount} belum dibaca`
                            : 'Semua sudah dibaca'}
                        </small>
                      </div>

                      <button
                        className="notification-close"
                        onClick={() => setNotificationOpen(false)}
                        aria-label="Tutup"
                      >
                        <X size={17} />
                      </button>
                    </div>

                    <div className="notification-toolbar">
                      <span>Riwayat aktivitas</span>

                      <button
                        onClick={markAllAsRead}
                        disabled={markingAll || unreadCount === 0}
                      >
                        {markingAll ? (
                          <LoaderCircle size={14} className="spin" />
                        ) : (
                          <CheckCheck size={14} />
                        )}
                        Tandai semua dibaca
                      </button>
                    </div>

                    <div className="notification-list">
                      {loadingNotifications && notifications.length === 0 ? (
                        <div className="notification-state">
                          <LoaderCircle size={24} className="spin" />
                          <span>Memuat notifikasi...</span>
                        </div>
                      ) : notificationError ? (
                        <div className="notification-state notification-error">
                          <BellRing size={25} />
                          <span>{notificationError}</span>

                          <button onClick={loadNotifications}>
                            Coba lagi
                          </button>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="notification-state">
                          <Bell size={27} />
                          <b>Belum ada notifikasi</b>
                          <span>
                            Aktivitas aplikasi akan muncul di sini.
                          </span>
                        </div>
                      ) : (
                        notifications.map(item => (
                          <button
                            key={item.id}
                            className={`notification-item ${
                              isRead(item) ? 'is-read' : 'is-unread'
                            }`}
                            onClick={() => markAsRead(item)}
                          >
                            <span className="notification-item-icon">
                              <Bell size={16} />
                            </span>

                            <span className="notification-item-content">
                              <b>{item.title || 'Notifikasi'}</b>

                              <span className="notification-message">
                                {item.message || 'Ada aktivitas baru.'}
                              </span>

                              <small>
                                {item.actorName
                                  ? `${item.actorName} • `
                                  : ''}
                                {formatNotificationDate(item.createdAt)}
                              </small>
                            </span>

                            <span className="notification-item-status">
                              {isRead(item) ? (
                                <Check size={15} />
                              ) : (
                                <span className="unread-dot" />
                              )}
                            </span>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="notification-footer">
                      <button
                        onClick={() => {
                          loadNotifications()
                          loadUnreadCount()
                        }}
                      >
                        Muat ulang notifikasi
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="top-divider" />

            <div className="profile">
              <div className="avatar">
                {user.name.slice(0, 1).toUpperCase()}
              </div>

              <div>
                <b>{user.name}</b>
                <small>
                  {user.role === 'admin'
                    ? 'Administrator'
                    : 'Staff'}
                </small>
              </div>
            </div>

            <button
              className="top-icon logout"
              onClick={onLogout}
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  )
}
