
import { useCallback, useEffect, useState } from 'react'
import type { ElementType } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Banknote,
  Boxes,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Package
} from 'lucide-react'

import { api } from '../lib/api'

import {
  StockChart,
  FinanceChart,
  type MonthlyPoint
} from '../components/Charts'

import '../css/Dashboard.css'

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (value === null || value === undefined || value === '') {
    return 0
  }

  let text = String(value)
    .trim()
    .replace(/rp/gi, '')
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '')

  if (!text || text === '-' || text === '.') return 0

  if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '')
  }

  const result = Number(text)

  return Number.isFinite(result) ? result : 0
}

const money = (value: unknown): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(toNumber(value))
}

const formatDate = (value: string): string => {
  const text = String(value || '').slice(0, 10)
  const [year, month, day] = text.split('-').map(Number)

  if (!year || !month || !day) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(year, month - 1, day))
}

type PaymentBucket = {
  income: number | string
  expense: number | string
  balance: number | string
  monthIncome: number | string
  monthExpense: number | string
}

type DebtAlert = {
  id: string
  direction: 'payable' | 'receivable'
  kind: 'money' | 'goods'
  partyName: string
  description: string
  itemName: string
  unit: string
  dueDate: string
  status: string
  remainingAmount: number | string
  remainingQty: number | string
  overdue: boolean
}

type Data = {
  totalQty: number | string
  itemCount: number | string
  batchCount: number | string
  stockValue: number | string

  incomeMonth: number | string
  expenseMonth: number | string
  incomeAll: number | string
  expenseAll: number | string

  transactionsToday: number | string
  lowStock: number | string
  nearExpiry: number | string

  monthly: MonthlyPoint[]

  recent: {
    action: string
    module: string
    description: string
    timestamp: string
    email: string
  }[]

  paymentBuckets?: {
    cash?: PaymentBucket
    debit?: PaymentBucket
  }

  debtAlerts?: DebtAlert[]
  debtOverdueCount?: number | string
  debtDueSoonCount?: number | string
}

function Metric({
  title,
  value,
  icon: Icon,
  tone,
  sub
}: {
  title: string
  value: string
  icon: ElementType
  tone: string
  sub: string
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{title}</span>

        <span className={`metric-icon ${tone}`}>
          <Icon size={19} />
        </span>
      </div>

      <strong>{value}</strong>

      <div className="metric-bottom">
        <span>{sub}</span>
      </div>
    </div>
  )
}

function PaymentCard({
  title,
  icon: Icon,
  bucket,
  tone
}: {
  title: string
  icon: ElementType
  bucket?: PaymentBucket
  tone: string
}) {
  const income = toNumber(bucket?.income)
  const expense = toNumber(bucket?.expense)
  const balance = toNumber(bucket?.balance)

  return (
    <article className={`dash-payment-card ${tone}`}>
      <div className="dash-payment-heading">
        <span className="dash-payment-icon">
          <Icon size={19} />
        </span>

        <span>{title}</span>
      </div>

      <strong className="dash-payment-balance">
        {money(balance)}
      </strong>

      <span className="dash-payment-caption">
        Arus bersih tercatat
      </span>

      <div className="dash-payment-detail">
        <span>
          <ArrowDownRight size={14} />
          Masuk
          <b>{money(income)}</b>
        </span>

        <span>
          <ArrowUpRight size={14} />
          Keluar
          <b>{money(expense)}</b>
        </span>
      </div>

      <div className="dash-payment-month">
        Bulan ini: {money(bucket?.monthIncome)} masuk
        {' · '}
        {money(bucket?.monthExpense)} keluar
      </div>
    </article>
  )
}

function DebtRow({ debt }: { debt: DebtAlert }) {
  const isPayable = debt.direction === 'payable'
  const isMoney = debt.kind === 'money'

  const amount = isMoney
    ? money(debt.remainingAmount)
    : `${toNumber(debt.remainingQty).toLocaleString('id-ID')} ${debt.unit || 'unit'}`

  return (
    <div className="dash-debt-row">
      <div className={`dash-debt-direction ${isPayable ? 'payable' : 'receivable'}`}>
        {isPayable
          ? <TrendingDown size={17} />
          : <TrendingUp size={17} />
        }
      </div>

      <div className="dash-debt-main">
        <div className="dash-debt-title-line">
          <strong>{debt.partyName}</strong>

          <span className={`dash-debt-status ${debt.overdue ? 'overdue' : 'soon'}`}>
            {debt.overdue ? 'Terlambat' : 'Segera'}
          </span>
        </div>

        <span className="dash-debt-description">
          {isPayable ? 'Utang' : 'Piutang'}
          {' · '}
          {debt.description || (isMoney ? 'Transaksi uang' : debt.itemName)}
        </span>

        <span className="dash-debt-date">
          <CalendarClock size={13} />
          Jatuh tempo {formatDate(debt.dueDate)}
        </span>
      </div>

      <div className="dash-debt-amount">
        <strong>{amount}</strong>

        <span>
          {isMoney ? 'Sisa nominal' : debt.itemName || 'Sisa barang'}
        </span>
      </div>
    </div>
  )
}

export default function Dashboard({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setError('')
      setLoading(true)

      const response = await api<Data>('dashboard.summary', { token })

      if (!response.data) {
        throw new Error('Data dashboard tidak ditemukan.')
      }

      setData(response.data)
    } catch (e) {
      console.error('[Dashboard] Gagal memuat data:', e)

      setError(
        e instanceof Error
          ? e.message
          : 'Gagal memuat dashboard.'
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const d = data

  const totalQty = toNumber(d?.totalQty)
  const itemCount = toNumber(d?.itemCount)
  const batchCount = toNumber(d?.batchCount)
  const stockValue = toNumber(d?.stockValue)

  const incomeMonth = toNumber(d?.incomeMonth)
  const expenseMonth = toNumber(d?.expenseMonth)

  const netBalance =
    toNumber(d?.incomeAll) - toNumber(d?.expenseAll)

  const transactionsToday = toNumber(d?.transactionsToday)
  const lowStock = toNumber(d?.lowStock)
  const nearExpiry = toNumber(d?.nearExpiry)

  const debtAlerts = d?.debtAlerts || []
  const overdueCount = toNumber(d?.debtOverdueCount)
  const dueSoonCount = toNumber(d?.debtDueSoonCount)

  return (
    <div className="page-stack dashboard-page">

      {/* HEADER */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            RINGKASAN BISNIS · DATA GOOGLE SHEETS
          </span>

          <h1>Dashboard</h1>

          <p>
            Pantau persediaan, keuangan, utang, dan piutang bisnis Anda.
          </p>
        </div>

        <button
          className="outline-btn"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw
            size={15}
            className={loading ? 'dash-spin' : ''}
          />

          {loading ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      {loading && !d ? (
        <div className="panel empty-state">
          Memuat data dari Google Sheets...
        </div>
      ) : d ? (
        <>

          {/* PEMBAYARAN */}
          <section className="dash-section">
            <div className="dash-section-heading">
              <div>
                <span className="dash-kicker">
                  IKHTISAR KEUANGAN
                </span>

                <h2>Arus berdasarkan metode pembayaran</h2>

                <p>
                  Tunai dipisahkan dari Debit yang mencakup Kartu Debit,
                  Transfer, dan QRIS.
                </p>
              </div>

              <span className="dash-live">
                <span />
                Data transaksi
              </span>
            </div>

            <div className="dash-payment-grid">
              <PaymentCard
                title="Tunai"
                icon={Banknote}
                bucket={d.paymentBuckets?.cash}
                tone="cash"
              />

              <PaymentCard
                title="Debit"
                icon={CreditCard}
                bucket={d.paymentBuckets?.debit}
                tone="debit"
              />
            </div>

            <div className="dash-account-note">
              <AlertCircle size={15} />

              Debit mencakup transaksi Kartu Debit, Transfer, dan QRIS.
              Ambil Sendiri tidak dihitung sebagai pemasukan.
            </div>
          </section>

          {/* METRIK UTAMA */}
          <div className="metric-grid">
            <Metric
              title="Total Stok Tersedia"
              value={`${totalQty.toLocaleString('id-ID')} unit`}
              icon={Boxes}
              tone="blue"
              sub={`${itemCount} jenis barang · ${batchCount} batch`}
            />

            <Metric
              title="Nilai Persediaan"
              value={money(stockValue)}
              icon={Package}
              tone="purple"
              sub="Berdasarkan harga beli batch"
            />

            <Metric
              title="Pemasukan Bulan Ini"
              value={money(incomeMonth)}
              icon={TrendingUp}
              tone="green"
              sub="Seluruh metode pembayaran"
            />

            <Metric
              title="Pengeluaran Bulan Ini"
              value={money(expenseMonth)}
              icon={TrendingDown}
              tone="orange"
              sub="Seluruh metode pembayaran"
            />
          </div>

          {/* METRIK SEKUNDER */}
          <div className="metric-grid metric-grid-secondary">

            <div className="mini-metric">
              <span className="mini-icon green">
                <Wallet />
              </span>

              <div>
                <small>Arus Bersih Keseluruhan</small>
                <b>{money(netBalance)}</b>
                <em>Pemasukan dikurangi pengeluaran tercatat</em>
              </div>
            </div>

            <div className="mini-metric">
              <span className="mini-icon orange">
                <AlertTriangle />
              </span>

              <div>
                <small>Batch Mendekati Expired</small>
                <b>{nearExpiry.toLocaleString('id-ID')} batch</b>
                <em>Dalam 30 hari</em>
              </div>
            </div>

            <div className="mini-metric">
              <span className="mini-icon blue">
                <Activity />
              </span>

              <div>
                <small>Transaksi Hari Ini</small>
                <b>{transactionsToday.toLocaleString('id-ID')} transaksi</b>
                <em>
                  {lowStock.toLocaleString('id-ID')} jenis stok mencapai batas minimum
                </em>
              </div>
            </div>

          </div>

          {/* UTANG DAN PIUTANG */}
          <section className="dash-section">
            <div className="dash-section-heading">
              <div>
                <span className="dash-kicker">
                  KEWAJIBAN & TAGIHAN
                </span>

                <h2>Utang dan piutang terdekat</h2>

                <p>
                  Daftar utang dan piutang yang terlambat atau jatuh tempo
                  dalam tujuh hari.
                </p>
              </div>

              <div className="dash-debt-counters">
                <span className={overdueCount > 0 ? 'has-overdue' : ''}>
                  <AlertTriangle size={14} />
                  {overdueCount} terlambat
                </span>

                <span>
                  <Clock3 size={14} />
                  {dueSoonCount} dalam 7 hari
                </span>
              </div>
            </div>

            <div className="dash-debt-panel">
              {debtAlerts.length > 0 ? (
                <div className="dash-debt-list">
                  {debtAlerts.map(debt => (
                    <DebtRow key={debt.id} debt={debt} />
                  ))}
                </div>
              ) : (
                <div className="dash-empty">
                  <CheckCircle2 size={25} />

                  <strong>
                    Tidak ada utang/piutang yang mendekati jatuh tempo
                  </strong>

                  <span>
                    Data aktif dengan tanggal jatuh tempo akan muncul di sini.
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* GRAFIK */}
          <div className="charts-grid">

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Pergerakan Stok</h3>
                  <p>Barang masuk dan keluar · 6 bulan terakhir</p>
                </div>

                <span className="period-pill">6 Bulan</span>
              </div>

              <StockChart data={d.monthly || []} />
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Pemasukan & Pengeluaran</h3>
                  <p>Arus keuangan · 6 bulan terakhir</p>
                </div>

                <span className="period-pill">6 Bulan</span>
              </div>

              <FinanceChart data={d.monthly || []} />
            </section>

          </div>

          {/* AKTIVITAS TERBARU */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Aktivitas Terbaru</h3>
                <p>Diambil dari log aktivitas Google Sheets.</p>
              </div>
            </div>

            {d.recent?.length > 0 ? (
              <div className="activity-list">
                {d.recent.map((item, index) => (
                  <div
                    className="activity-row"
                    key={`${item.timestamp}-${index}`}
                  >
                    <span className="activity-dot blue-dot" />

                    <div>
                      <b>{item.description || item.action}</b>

                      <small>
                        {item.module} · {item.email}
                      </small>
                    </div>

                    <time>
                      {String(item.timestamp || '')
                        .replace('T', ' ')
                        .slice(0, 16)}
                    </time>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                Belum ada aktivitas tercatat.
              </div>
            )}
          </section>

        </>
      ) : (
        <div className="panel empty-state">
          Data dashboard belum tersedia.
        </div>
      )}
    </div>
  )
}
