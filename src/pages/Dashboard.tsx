
import { useEffect, useState } from 'react'
import type { ElementType } from 'react'
import {
  Boxes,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Activity,
  RefreshCw
} from 'lucide-react'
import { api } from '../lib/api'
import {
  StockChart,
  FinanceChart,
  type MonthlyPoint
} from '../components/Charts'

/**
 * Mengubah berbagai format data menjadi angka.
 *
 * Contoh:
 * 10000       -> 10000
 * "10000"     -> 10000
 * "10.000"    -> 10000
 * "Rp 10.000" -> 10000
 * "10,5"      -> 10.5
 */
const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (value === null || value === undefined || value === '') {
    return 0
  }

  let valueText = String(value)
    .trim()
    .replace(/rp/gi, '')
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '')

  if (!valueText || valueText === '-' || valueText === '.') {
    return 0
  }

  // Format Indonesia: 10.000,50
  if (valueText.includes(',')) {
    valueText = valueText
      .replace(/\./g, '')
      .replace(',', '.')
  }
  // Format ribuan Indonesia: 10.000
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(valueText)) {
    valueText = valueText.replace(/\./g, '')
  }

  const result = Number(valueText)

  return Number.isFinite(result) ? result : 0
}

/**
 * Format mata uang Rupiah dengan aman.
 */
const money = (value: unknown): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(toNumber(value))
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

export default function Dashboard({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  /**
   * Memuat ringkasan dashboard dari Google Sheets.
   */
  async function load() {
    try {
      setError('')

      const r = await api<Data>('dashboard.summary', { token })

      if (!r.data) {
        throw new Error('Data dashboard tidak ditemukan.')
      }

      setData(r.data)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Gagal memuat dashboard.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [token])

  const d = data

  /**
   * Mengamankan seluruh angka dari API.
   */
  const totalQty = toNumber(d?.totalQty)
  const itemCount = toNumber(d?.itemCount)
  const batchCount = toNumber(d?.batchCount)

  const stockValue = toNumber(d?.stockValue)

  const incomeMonth = toNumber(d?.incomeMonth)
  const expenseMonth = toNumber(d?.expenseMonth)

  const incomeAll = toNumber(d?.incomeAll)
  const expenseAll = toNumber(d?.expenseAll)

  const netBalance = incomeAll - expenseAll

  const transactionsToday = toNumber(d?.transactionsToday)
  const lowStock = toNumber(d?.lowStock)
  const nearExpiry = toNumber(d?.nearExpiry)

  return (
    <div className="page-stack">

      {/* HEADER */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            RINGKASAN BISNIS · DATA GOOGLE SHEETS
          </span>

          <h1>Dashboard</h1>

          <p>
            Seluruh angka diperbarui dari transaksi dan persediaan tersimpan.
          </p>
        </div>

        <button
          className="outline-btn"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      {/* LOADING */}
      {loading && !d ? (
        <div className="panel empty-state">
          Memuat data dari Google Sheets...
        </div>
      ) : d ? (
        <>

          {/* METRIC UTAMA */}
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
              icon={Wallet}
              tone="purple"
              sub="Berdasarkan harga beli batch"
            />

            <Metric
              title="Pemasukan Bulan Ini"
              value={money(incomeMonth)}
              icon={TrendingUp}
              tone="green"
              sub="Akumulasi transaksi bulan berjalan"
            />

            <Metric
              title="Pengeluaran Bulan Ini"
              value={money(expenseMonth)}
              icon={TrendingDown}
              tone="orange"
              sub="Akumulasi transaksi bulan berjalan"
            />

          </div>

          {/* METRIC SEKUNDER */}
          <div className="metric-grid metric-grid-secondary">

            <div className="mini-metric">
              <span className="mini-icon green">
                <Wallet />
              </span>

              <div>
                <small>Saldo Bersih Keseluruhan</small>
                <b>{money(netBalance)}</b>
              </div>
            </div>

            <div className="mini-metric">
              <span className="mini-icon orange">
                <AlertTriangle />
              </span>

              <div>
                <small>Batch Mendekati Expired</small>

                <b>
                  {nearExpiry.toLocaleString('id-ID')} batch
                </b>

                <em>Dalam 30 hari</em>
              </div>
            </div>

            <div className="mini-metric">
              <span className="mini-icon blue">
                <Activity />
              </span>

              <div>
                <small>Transaksi Hari Ini</small>

                <b>
                  {transactionsToday.toLocaleString('id-ID')} transaksi
                </b>

                <em>
                  {lowStock.toLocaleString('id-ID')} jenis stok mencapai batas minimum
                </em>
              </div>
            </div>

          </div>

          {/* CHARTS */}
          <div className="charts-grid">

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Pergerakan Stok</h3>

                  <p>
                    Barang masuk dan keluar · 6 bulan terakhir
                  </p>
                </div>

                <span className="period-pill">
                  Live
                </span>
              </div>

              <StockChart data={d.monthly || []} />
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Pemasukan & Pengeluaran</h3>

                  <p>
                    Arus keuangan · 6 bulan terakhir
                  </p>
                </div>

                <span className="period-pill">
                  Live
                </span>
              </div>

              <FinanceChart data={d.monthly || []} />
            </section>

          </div>

          {/* AKTIVITAS TERBARU */}
          <section className="panel">

            <div className="panel-head">
              <div>
                <h3>Aktivitas Terbaru</h3>

                <p>
                  Diambil dari log aktivitas Google Sheets.
                </p>
              </div>
            </div>

            {d.recent?.length ? (
              <div className="activity-list">

                {d.recent.map((x, i) => (
                  <div
                    className="activity-row"
                    key={i}
                  >
                    <span className="activity-dot blue-dot" />

                    <div>
                      <b>{x.description}</b>

                      <small>
                        {x.module} · {x.email}
                      </small>
                    </div>

                    <time>
                      {String(x.timestamp || '')
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
      ) : null}

      {/* EMPTY STATE */}
      {!loading && !d && !error && (
        <div className="panel empty-state">
          Belum ada data untuk ditampilkan.
        </div>
      )}

    </div>
  )
}
