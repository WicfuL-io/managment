
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Package,
  Plus,
  Search,
  Filter,
  RefreshCw,
  CalendarDays,
  Clock,
  CircleCheck,
  AlertCircle,
  Archive,
  Eye,
  Pencil,
  X,
  History,
  Wallet,
  HandCoins,
  RotateCcw,
  ArchiveRestore,
  Trash2
} from 'lucide-react'
import { api } from '../lib/api'
import './Debt.css'

type Direction = 'payable' | 'receivable'
type Kind = 'money' | 'goods'
type Status = 'belum_lunas' | 'sebagian' | 'lunas' | 'jatuh_tempo'
type ViewMode = 'active' | 'archived'

type Debt = {
  id: string
  direction: Direction
  kind: Kind
  partyName: string
  partyContact?: string
  description: string
  itemName?: string
  unit?: string
  qty?: number
  settledQty?: number
  totalAmount?: number
  paidAmount?: number
  remainingAmount?: number
  remainingQty?: number
  date: string
  dueDate?: string
  status: Status
  note?: string
  paymentCount?: number
  isArchived?: boolean
  archivedAt?: string
}

type Payment = {
  id: string
  debtId: string
  date: string
  paymentType: Kind
  amount?: number
  qty?: number
  note?: string
  method?: string
}

type Summary = {
  payableMoney: number
  receivableMoney: number
  payableGoods: number
  receivableGoods: number
  activeCount: number
  overdueCount: number
  settledCount: number
}

type Props = {
  token: string
}

type ApiResponse<T = unknown> = {
  success?: boolean
  data?: T
  message?: string
}

const emptySummary: Summary = {
  payableMoney: 0,
  receivableMoney: 0,
  payableGoods: 0,
  receivableGoods: 0,
  activeCount: 0,
  overdueCount: 0,
  settledCount: 0
}

const money = (value: number | string | undefined) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value || 0))

const numberValue = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

const dateLabel = (value?: string) => {
  if (!value) return '-'

  const raw = String(value).slice(0, 10)
  const parts = raw.split('-')

  if (parts.length !== 3) return raw

  const [year, month, day] = parts.map(Number)

  if (!year || !month || !day) return raw

  const date = new Date(year, month - 1, day)

  if (Number.isNaN(date.getTime())) return raw

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

const statusLabel: Record<Status, string> = {
  belum_lunas: 'Belum lunas',
  sebagian: 'Dibayar sebagian',
  lunas: 'Lunas',
  jatuh_tempo: 'Jatuh tempo'
}

const getError = (error: unknown) =>
  error instanceof Error ? error.message : 'Terjadi kesalahan.'

function unwrapResponse<T>(response: unknown): T {
  if (response === null || response === undefined) {
    throw new Error('Server tidak mengembalikan data.')
  }

  if (typeof response === 'object' && !Array.isArray(response)) {
    const result = response as ApiResponse<T>

    if (result.success === false) {
      throw new Error(result.message || 'Permintaan ke server gagal.')
    }

    if (Object.prototype.hasOwnProperty.call(result, 'data')) {
      return result.data as T
    }
  }

  return response as T
}

function normalizeDebt(raw: Record<string, unknown>): Debt {
  const totalAmount = numberValue(raw.totalAmount)
  const paidAmount = numberValue(raw.paidAmount)
  const qty = numberValue(raw.qty)
  const settledQty = numberValue(raw.settledQty)

  const kind: Kind = raw.kind === 'goods' ? 'goods' : 'money'

  const direction: Direction =
    raw.direction === 'payable' ? 'payable' : 'receivable'

  const allowedStatuses: Status[] = [
    'belum_lunas',
    'sebagian',
    'lunas',
    'jatuh_tempo'
  ]

  const status = allowedStatuses.includes(raw.status as Status)
    ? raw.status as Status
    : 'belum_lunas'

  return {
    id: String(raw.id || ''),
    direction,
    kind,
    partyName: String(raw.partyName || ''),
    partyContact: String(raw.partyContact || ''),
    description: String(raw.description || ''),
    itemName: String(raw.itemName || ''),
    unit: String(raw.unit || ''),
    qty,
    settledQty,
    totalAmount,
    paidAmount,
    remainingAmount:
      raw.remainingAmount !== undefined
        ? numberValue(raw.remainingAmount)
        : Math.max(0, totalAmount - paidAmount),
    remainingQty:
      raw.remainingQty !== undefined
        ? numberValue(raw.remainingQty)
        : Math.max(0, qty - settledQty),
    date: String(raw.date || ''),
    dueDate: String(raw.dueDate || ''),
    status,
    note: String(raw.note || ''),
    paymentCount: numberValue(raw.paymentCount),
    isArchived:
      raw.isArchived === true ||
      String(raw.isArchived).toLowerCase() === 'true' ||
      String(raw.isArchived) === '1',
    archivedAt: String(raw.archivedAt || '')
  }
}

function normalizeSummary(raw: unknown): Summary {
  if (!raw || typeof raw !== 'object') return emptySummary

  const data = raw as Record<string, unknown>

  return {
    payableMoney: numberValue(data.payableMoney),
    receivableMoney: numberValue(data.receivableMoney),
    payableGoods: numberValue(data.payableGoods),
    receivableGoods: numberValue(data.receivableGoods),
    activeCount: numberValue(data.activeCount),
    overdueCount: numberValue(data.overdueCount),
    settledCount: numberValue(data.settledCount)
  }
}

function normalizePayment(raw: Record<string, unknown>): Payment {
  return {
    id: String(raw.id || ''),
    debtId: String(raw.debtId || ''),
    date: String(raw.date || ''),
    paymentType: raw.paymentType === 'goods' ? 'goods' : 'money',
    amount: numberValue(raw.amount),
    qty: numberValue(raw.qty),
    note: String(raw.note || ''),
    method: String(raw.method || '')
  }
}

export default function Debt({ token }: Props) {
  const [debts, setDebts] = useState<Debt[]>([])
  const [archivedDebts, setArchivedDebts] = useState<Debt[]>([])
  const [summary, setSummary] = useState<Summary>(emptySummary)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [viewMode, setViewMode] = useState<ViewMode>('active')

  const [search, setSearch] = useState('')
  const [directionFilter, setDirectionFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [modal, setModal] = useState<
    'add' | 'edit' | 'payment' | 'detail' | null
  >(null)

  const [selected, setSelected] = useState<Debt | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])

  const [form, setForm] = useState({
    direction: 'receivable' as Direction,
    kind: 'money' as Kind,
    partyName: '',
    partyContact: '',
    description: '',
    itemName: '',
    unit: 'pcs',
    qty: '',
    totalAmount: '',
    date: new Date().toISOString().slice(0, 10),
    dueDate: '',
    note: ''
  })

  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    qty: '',
    method: 'Tunai',
    note: ''
  })

  // =====================================================
  // LOAD DATA AKTIF DAN ARSIP
  // =====================================================

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [
        listResponse,
        summaryResponse,
        archivedResponse
      ] = await Promise.all([
        api<unknown>('debt.list', { token }),
        api<unknown>('debt.summary', { token }),
        api<unknown>('debt.archived.list', { token })
      ])

      const listData = unwrapResponse<unknown>(listResponse)
      const summaryData = unwrapResponse<unknown>(summaryResponse)
      const archivedData = unwrapResponse<unknown>(archivedResponse)

      if (!Array.isArray(listData)) {
        console.error('Respons debt.list:', listResponse)
        throw new Error('Format daftar data aktif tidak sesuai.')
      }

      if (!Array.isArray(archivedData)) {
        console.error('Respons debt.archived.list:', archivedResponse)
        throw new Error(
          'Format daftar arsip tidak sesuai. Periksa backend Apps Script.'
        )
      }

      const normalizedDebts = listData
        .filter(
          (item): item is Record<string, unknown> =>
            item !== null && typeof item === 'object'
        )
        .map(normalizeDebt)
        .filter(item => item.id !== '')

      const normalizedArchived = archivedData
        .filter(
          (item): item is Record<string, unknown> =>
            item !== null && typeof item === 'object'
        )
        .map(normalizeDebt)
        .filter(item => item.id !== '')

      setDebts(normalizedDebts)
      setArchivedDebts(normalizedArchived)
      setSummary(normalizeSummary(summaryData))

      console.log('Data aktif:', normalizedDebts)
      console.log('Data arsip:', normalizedArchived)

    } catch (err) {
      console.error('Gagal memuat utang/piutang:', err)
      setError(getError(err))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  // =====================================================
  // DATA SESUAI TAB
  // =====================================================

  const currentDebts = viewMode === 'active' ? debts : archivedDebts

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return currentDebts.filter(debt => {
      const matchesSearch = !keyword || [
        debt.partyName,
        debt.partyContact,
        debt.description,
        debt.itemName,
        debt.note
      ].some(value =>
        String(value || '').toLowerCase().includes(keyword)
      )

      const matchesDirection =
        directionFilter === 'all' || debt.direction === directionFilter

      const matchesKind =
        kindFilter === 'all' || debt.kind === kindFilter

      const matchesStatus =
        statusFilter === 'all' || debt.status === statusFilter

      return (
        matchesSearch &&
        matchesDirection &&
        matchesKind &&
        matchesStatus
      )
    })
  }, [
    currentDebts,
    search,
    directionFilter,
    kindFilter,
    statusFilter
  ])

  const changeView = (mode: ViewMode) => {
    setViewMode(mode)
    setSearch('')
    setDirectionFilter('all')
    setKindFilter('all')
    setStatusFilter('all')
    setError('')
    setMessage('')
  }

  // =====================================================
  // FORM
  // =====================================================

  const resetForm = () => {
    setForm({
      direction: 'receivable',
      kind: 'money',
      partyName: '',
      partyContact: '',
      description: '',
      itemName: '',
      unit: 'pcs',
      qty: '',
      totalAmount: '',
      date: new Date().toISOString().slice(0, 10),
      dueDate: '',
      note: ''
    })
  }

  const openAdd = () => {
    resetForm()
    setSelected(null)
    setModal('add')
  }

  const openEdit = (debt: Debt) => {
    setSelected(debt)

    setForm({
      direction: debt.direction,
      kind: debt.kind,
      partyName: debt.partyName,
      partyContact: debt.partyContact || '',
      description: debt.description,
      itemName: debt.itemName || '',
      unit: debt.unit || 'pcs',
      qty: String(debt.qty || ''),
      totalAmount: String(debt.totalAmount || ''),
      date: String(debt.date).slice(0, 10),
      dueDate: String(debt.dueDate || '').slice(0, 10),
      note: debt.note || ''
    })

    setModal('edit')
  }

  const saveDebt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const payload = {
        token,
        ...form,
        qty: Number(form.qty || 0),
        totalAmount: Number(form.totalAmount || 0)
      }

      if (modal === 'edit' && selected) {
        await api('debt.update', {
          ...payload,
          id: selected.id
        })

        setMessage('Pencatatan berhasil diperbarui.')
      } else {
        await api('debt.add', payload)
        setMessage('Utang/piutang berhasil ditambahkan.')
      }

      setModal(null)
      resetForm()
      await load()

    } catch (err) {
      setError(getError(err))
    } finally {
      setBusy(false)
    }
  }

  // =====================================================
  // PEMBAYARAN / PENGEMBALIAN BARANG
  // =====================================================

  const openPayment = (debt: Debt) => {
    setSelected(debt)

    setPaymentForm({
      date: new Date().toISOString().slice(0, 10),
      amount: '',
      qty: '',
      method: 'Tunai',
      note: ''
    })

    setModal('payment')
  }

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selected) return

    const amount = Number(paymentForm.amount || 0)
    const qty = Number(paymentForm.qty || 0)

    if (selected.kind === 'money') {
      if (amount <= 0) {
        setError('Nominal pembayaran harus lebih dari 0.')
        return
      }

      if (amount > numberValue(selected.remainingAmount)) {
        setError('Nominal pembayaran melebihi sisa utang/piutang.')
        return
      }
    } else {
      if (qty <= 0) {
        setError('Jumlah barang harus lebih dari 0.')
        return
      }

      if (qty > numberValue(selected.remainingQty)) {
        setError('Jumlah barang melebihi sisa kewajiban.')
        return
      }
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      await api('debt.payment', {
        token,
        debtId: selected.id,
        date: paymentForm.date,
        paymentType: selected.kind,
        amount,
        qty,
        method: paymentForm.method,
        note: paymentForm.note
      })

      setModal(null)
      setMessage('Pembayaran/pengembalian berhasil dicatat.')
      await load()

    } catch (err) {
      setError(getError(err))
    } finally {
      setBusy(false)
    }
  }

  // =====================================================
  // DETAIL DAN RIWAYAT
  // =====================================================

  const openDetail = async (debt: Debt) => {
    setSelected(debt)
    setPayments([])
    setModal('detail')
    setBusy(true)
    setError('')

    try {
      const response = await api<unknown>('debt.detail', {
        token,
        id: debt.id
      })

      const detail = unwrapResponse<unknown>(response)

      if (!detail || typeof detail !== 'object') {
        throw new Error('Detail pencatatan tidak valid.')
      }

      const data = detail as {
        debt?: Record<string, unknown>
        payments?: Record<string, unknown>[]
      }

      if (data.debt) {
        setSelected(normalizeDebt(data.debt))
      }

      setPayments(
        Array.isArray(data.payments)
          ? data.payments
              .filter(
                item => item !== null && typeof item === 'object'
              )
              .map(normalizePayment)
          : []
      )

    } catch (err) {
      console.error('Gagal memuat detail utang:', err)
      setError(getError(err))
    } finally {
      setBusy(false)
    }
  }

  // =====================================================
  // ARSIPKAN DATA
  // =====================================================

  const archiveDebt = async (debt: Debt) => {
    const confirmed = window.confirm(
      `Arsipkan pencatatan ${debt.partyName}?\n\nData tidak akan dihapus permanen dan bisa dipulihkan kembali.`
    )

    if (!confirmed) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const response = await api<unknown>('debt.archive', {
        token,
        id: debt.id
      })

      unwrapResponse<unknown>(response)

      setMessage(`Data ${debt.partyName} berhasil diarsipkan.`)
      await load()

    } catch (err) {
      setError(getError(err))
    } finally {
      setBusy(false)
    }
  }

  // =====================================================
  // PULIHKAN DATA ARSIP
  // =====================================================

  const restoreDebt = async (debt: Debt) => {
    const confirmed = window.confirm(
      `Pulihkan data ${debt.partyName}?\n\nData akan dikembalikan ke daftar aktif.`
    )

    if (!confirmed) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const response = await api<unknown>('debt.restore', {
        token,
        id: debt.id
      })

      unwrapResponse<unknown>(response)

      setMessage(`Data ${debt.partyName} berhasil dipulihkan.`)
      await load()

    } catch (err) {
      setError(getError(err))
    } finally {
      setBusy(false)
    }
  }

  // =====================================================
  // PERHITUNGAN
  // =====================================================

  const progress = (debt: Debt) => {
    if (debt.kind === 'money') {
      return debt.totalAmount
        ? Math.min(
            100,
            (numberValue(debt.paidAmount) /
              numberValue(debt.totalAmount)) * 100
          )
        : 0
    }

    return debt.qty
      ? Math.min(
          100,
          (numberValue(debt.settledQty) /
            numberValue(debt.qty)) * 100
          )
        : 0
  }

  const remainingText = (debt: Debt) =>
    debt.kind === 'money'
      ? money(numberValue(debt.remainingAmount))
      : `${numberValue(debt.remainingQty)} ${debt.unit || ''}`

  // =====================================================
  // TAMPILAN
  // =====================================================

  return (
    <div className="page-stack debt-page">

      {/* HEADER */}

      <div className="page-heading debt-heading">
        <div>
          <span className="debt-eyebrow">FINANCIAL MANAGEMENT</span>
          <h1>Utang & Piutang</h1>
          <p>
            Kelola kewajiban, tagihan, dan pengembalian barang dalam satu tempat.
          </p>
        </div>

        <div className="debt-heading-actions">
          <button
            className="outline-btn"
            onClick={() => void load()}
            disabled={loading || busy}
          >
            <RefreshCw
              size={16}
              className={loading ? 'debt-spin' : ''}
            />
            Refresh
          </button>

          {viewMode === 'active' && (
            <button
              className="primary-btn debt-add-btn"
              onClick={openAdd}
            >
              <Plus size={17} />
              Tambah pencatatan
            </button>
          )}
        </div>
      </div>

      {/* ALERT */}

      {error && (
        <div className="debt-alert debt-alert-error">
          <AlertCircle size={17} />
          {error}
          <button onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {message && (
        <div className="debt-alert debt-alert-success">
          <CircleCheck size={17} />
          {message}
          <button onClick={() => setMessage('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* RINGKASAN */}

      <div className="debt-summary-grid">

        <div className="debt-summary-card payable">
          <div className="debt-summary-top">
            <span>Total utang uang</span>
            <span className="debt-summary-icon">
              <ArrowUpRight size={19} />
            </span>
          </div>
          <strong>{money(summary.payableMoney)}</strong>
          <small>Uang yang harus dibayarkan</small>
        </div>

        <div className="debt-summary-card receivable">
          <div className="debt-summary-top">
            <span>Total piutang uang</span>
            <span className="debt-summary-icon">
              <ArrowDownLeft size={19} />
            </span>
          </div>
          <strong>{money(summary.receivableMoney)}</strong>
          <small>Uang yang harus diterima</small>
        </div>

        <div className="debt-summary-card goods">
          <div className="debt-summary-top">
            <span>Utang barang</span>
            <span className="debt-summary-icon">
              <Package size={19} />
            </span>
          </div>
          <strong>{summary.payableGoods}</strong>
          <small>Jumlah barang yang perlu dikembalikan</small>
        </div>

        <div className="debt-summary-card goods-receive">
          <div className="debt-summary-top">
            <span>Piutang barang</span>
            <span className="debt-summary-icon">
              <RotateCcw size={19} />
            </span>
          </div>
          <strong>{summary.receivableGoods}</strong>
          <small>Jumlah barang yang perlu diterima</small>
        </div>

      </div>

      <div className="debt-mini-stats">
        <div>
          <span>Aktif</span>
          <strong>{summary.activeCount}</strong>
        </div>

        <div>
          <span>Jatuh tempo</span>
          <strong className="text-danger">{summary.overdueCount}</strong>
        </div>

        <div>
          <span>Lunas</span>
          <strong className="text-success">{summary.settledCount}</strong>
        </div>

        <div>
          <span>Diarsipkan</span>
          <strong>{archivedDebts.length}</strong>
        </div>
      </div>

      {/* DAFTAR DATA */}

      <section className="panel debt-list-panel">

        <div className="debt-list-heading">
          <div>
            <h2>
              {viewMode === 'active'
                ? 'Daftar pencatatan'
                : 'Daftar arsip'}
            </h2>
            <p>
              {viewMode === 'active'
                ? 'Telusuri dan kelola seluruh utang serta piutang aktif.'
                : 'Data yang diarsipkan tersimpan di sini dan dapat dipulihkan.'}
            </p>
          </div>

          <span className="debt-count">
            {filtered.length} data
          </span>
        </div>

        {/* TAB AKTIF DAN ARSIP */}

        <div className="debt-view-tabs">
          <button
            type="button"
            className={`debt-view-tab ${viewMode === 'active' ? 'active' : ''}`}
            onClick={() => changeView('active')}
          >
            <HandCoins size={17} />
            Data Aktif
            <span>{debts.length}</span>
          </button>

          <button
            type="button"
            className={`debt-view-tab ${viewMode === 'archived' ? 'active' : ''}`}
            onClick={() => changeView('archived')}
          >
            <Archive size={17} />
            Daftar Arsip
            <span>{archivedDebts.length}</span>
          </button>
        </div>

        {/* FILTER */}

        <div className="debt-filters">

          <div className="debt-search">
            <Search size={18} />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama, barang, atau keterangan..."
            />

            {search && (
              <button onClick={() => setSearch('')}>
                <X size={15} />
              </button>
            )}
          </div>

          <label className="debt-filter">
            <Filter size={15} />

            <select
              value={directionFilter}
              onChange={e => setDirectionFilter(e.target.value)}
            >
              <option value="all">Semua jenis</option>
              <option value="payable">Utang</option>
              <option value="receivable">Piutang</option>
            </select>
          </label>

          <label className="debt-filter">
            <select
              value={kindFilter}
              onChange={e => setKindFilter(e.target.value)}
            >
              <option value="all">Uang & barang</option>
              <option value="money">Uang</option>
              <option value="goods">Barang</option>
            </select>
          </label>

          <label className="debt-filter">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">Semua status</option>
              <option value="belum_lunas">Belum lunas</option>
              <option value="sebagian">Sebagian</option>
              <option value="jatuh_tempo">Jatuh tempo</option>
              <option value="lunas">Lunas</option>
            </select>
          </label>

        </div>

        {/* LOADING */}

        {loading ? (
          <div className="debt-empty">
            <RefreshCw className="debt-spin" size={25} />
            <strong>Memuat data...</strong>
          </div>
        ) : filtered.length === 0 ? (

          /* KOSONG */

          <div className="debt-empty">
            <div className="debt-empty-icon">
              {viewMode === 'active'
                ? <HandCoins size={28} />
                : <Archive size={28} />}
            </div>

            <strong>
              {viewMode === 'archived'
                ? 'Belum ada data arsip'
                : debts.length === 0
                  ? 'Belum ada pencatatan'
                  : 'Tidak ada data yang sesuai'}
            </strong>

            <p>
              {viewMode === 'archived'
                ? 'Data yang kamu arsipkan akan muncul di halaman ini.'
                : 'Data utang dan piutang yang sesuai filter akan tampil di sini.'}
            </p>

            {viewMode === 'active' && (
              <button className="primary-btn" onClick={openAdd}>
                <Plus size={16} />
                Tambah pencatatan
              </button>
            )}

            {viewMode === 'archived' && (
              <button
                className="outline-btn"
                onClick={() => changeView('active')}
              >
                <ArrowDownLeft size={16} />
                Kembali ke data aktif
              </button>
            )}
          </div>

        ) : (

          /* KARTU DATA */

          <div className="debt-record-grid">

            {filtered.map(debt => (
              <article className="debt-record-card" key={debt.id}>

                <div className="debt-record-top">
                  <div className={`debt-type-icon ${debt.direction}`}>
                    {debt.kind === 'money'
                      ? <Banknote size={20} />
                      : <Package size={20} />}
                  </div>

                  <span className={`debt-status ${debt.status}`}>
                    {statusLabel[debt.status]}
                  </span>
                </div>

                <div className="debt-record-person">
                  <span>
                    {debt.direction === 'payable'
                      ? 'Kita berutang kepada'
                      : 'Berutang kepada kita'}
                  </span>

                  <h3>{debt.partyName}</h3>
                  <p>{debt.description}</p>
                </div>

                <div className="debt-record-value">
                  <small>
                    {debt.kind === 'money'
                      ? 'Sisa kewajiban'
                      : 'Sisa barang'}
                  </small>

                  <strong>
                    {debt.kind === 'money'
                      ? remainingText(debt)
                      : `${remainingText(debt)} ${
                          debt.itemName ? `· ${debt.itemName}` : ''
                        }`}
                  </strong>
                </div>

                <div className="debt-progress">
                  <div className="debt-progress-label">
                    <span>Progres penyelesaian</span>
                    <b>{Math.round(progress(debt))}%</b>
                  </div>

                  <div className="debt-progress-track">
                    <span style={{ width: `${progress(debt)}%` }} />
                  </div>
                </div>

                <div className="debt-record-meta">
                  <span>
                    <CalendarDays size={14} />
                    {dateLabel(debt.date)}
                  </span>

                  <span>
                    <Clock size={14} />
                    Tempo: {dateLabel(debt.dueDate)}
                  </span>
                </div>

                {viewMode === 'archived' && (
                  <div className="debt-archived-info">
                    <Archive size={14} />
                    <span>
                      Diarsipkan
                      {debt.archivedAt
                        ? ` · ${dateLabel(debt.archivedAt)}`
                        : ''}
                    </span>
                  </div>
                )}

                <div className="debt-record-actions">

                  <button
                    className="debt-icon-btn"
                    title="Detail"
                    onClick={() => void openDetail(debt)}
                  >
                    <Eye size={16} />
                  </button>

                  {viewMode === 'active' && (
                    <>
                      {debt.status === 'belum_lunas' && (
                        <button
                          className="debt-icon-btn"
                          title="Edit"
                          onClick={() => openEdit(debt)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}

                      {debt.status !== 'lunas' && (
                        <button
                          className="debt-pay-btn"
                          onClick={() => openPayment(debt)}
                        >
                          <Wallet size={15} />
                          Catat pembayaran
                        </button>
                      )}

                      <button
                        className="debt-icon-btn archive"
                        title="Arsipkan"
                        disabled={busy}
                        onClick={() => void archiveDebt(debt)}
                      >
                        <Archive size={16} />
                      </button>
                    </>
                  )}

                  {viewMode === 'archived' && (
                    <button
                      className="debt-restore-btn"
                      disabled={busy}
                      onClick={() => void restoreDebt(debt)}
                    >
                      <ArchiveRestore size={16} />
                      Pulihkan
                    </button>
                  )}

                </div>
              </article>
            ))}

          </div>
        )}

      </section>

      {/* MODAL */}

      {modal && (
        <div
          className="modal-backdrop debt-modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget && !busy) {
              setModal(null)
            }
          }}
        >

          <div
            className="modal debt-modal"
            role="dialog"
            aria-modal="true"
          >

            <div className="debt-modal-head">
              <div>
                <span className="debt-eyebrow">DEBT MANAGEMENT</span>

                <h2>
                  {modal === 'add'
                    ? 'Tambah pencatatan'
                    : modal === 'edit'
                      ? 'Edit pencatatan'
                      : modal === 'payment'
                        ? 'Catat pembayaran'
                        : 'Detail pencatatan'}
                </h2>
              </div>

              <button
                className="debt-close"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                <X size={19} />
              </button>
            </div>

            {/* TAMBAH / EDIT */}

            {(modal === 'add' || modal === 'edit') && (
              <form onSubmit={saveDebt} className="debt-form">

                <div className="debt-form-grid">

                  <label>
                    Jenis pencatatan

                    <select
                      value={form.direction}
                      onChange={e =>
                        setForm({
                          ...form,
                          direction: e.target.value as Direction
                        })
                      }
                      disabled={modal === 'edit'}
                    >
                      <option value="receivable">
                        Piutang — orang lain berutang kepada kita
                      </option>
                      <option value="payable">
                        Utang — kita berutang kepada orang lain
                      </option>
                    </select>
                  </label>

                  <label>
                    Bentuk pencatatan

                    <select
                      value={form.kind}
                      onChange={e =>
                        setForm({
                          ...form,
                          kind: e.target.value as Kind
                        })
                      }
                      disabled={modal === 'edit'}
                    >
                      <option value="money">Uang</option>
                      <option value="goods">Barang</option>
                    </select>
                  </label>

                  <label>
                    Nama orang / toko *

                    <input
                      required
                      value={form.partyName}
                      onChange={e =>
                        setForm({ ...form, partyName: e.target.value })
                      }
                      placeholder="Contoh: Budi Santoso"
                    />
                  </label>

                  <label>
                    Nomor telepon

                    <input
                      value={form.partyContact}
                      onChange={e =>
                        setForm({ ...form, partyContact: e.target.value })
                      }
                      placeholder="08xxxxxxxxxx"
                    />
                  </label>

                  <label className="full">
                    Keterangan *

                    <input
                      required
                      value={form.description}
                      onChange={e =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="Contoh: Pinjaman pembelian kebutuhan"
                    />
                  </label>

                  {form.kind === 'money' ? (
                    <label className="full">
                      Total nominal (Rp) *

                      <input
                        required
                        type="number"
                        min="1"
                        step="1"
                        value={form.totalAmount}
                        onChange={e =>
                          setForm({ ...form, totalAmount: e.target.value })
                        }
                        placeholder="500000"
                      />
                    </label>
                  ) : (
                    <>
                      <label>
                        Nama barang *

                        <input
                          required
                          value={form.itemName}
                          onChange={e =>
                            setForm({ ...form, itemName: e.target.value })
                          }
                          placeholder="Contoh: Beras"
                        />
                      </label>

                      <label>
                        Satuan *

                        <input
                          required
                          value={form.unit}
                          onChange={e =>
                            setForm({ ...form, unit: e.target.value })
                          }
                          placeholder="kg, pcs, liter"
                        />
                      </label>

                      <label className="full">
                        Jumlah barang *

                        <input
                          required
                          type="number"
                          min="0.001"
                          step="any"
                          value={form.qty}
                          onChange={e =>
                            setForm({ ...form, qty: e.target.value })
                          }
                          placeholder="10"
                        />
                      </label>
                    </>
                  )}

                  <label>
                    Tanggal pencatatan *

                    <input
                      required
                      type="date"
                      value={form.date}
                      onChange={e =>
                        setForm({ ...form, date: e.target.value })
                      }
                      disabled={modal === 'edit'}
                    />
                  </label>

                  <label>
                    Tanggal jatuh tempo

                    <input
                      type="date"
                      min={form.date}
                      value={form.dueDate}
                      onChange={e =>
                        setForm({ ...form, dueDate: e.target.value })
                      }
                    />
                  </label>

                  <label className="full">
                    Catatan tambahan

                    <textarea
                      rows={3}
                      value={form.note}
                      onChange={e =>
                        setForm({ ...form, note: e.target.value })
                      }
                      placeholder="Catatan opsional..."
                    />
                  </label>

                </div>

                <div className="debt-form-actions">
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() => setModal(null)}
                    disabled={busy}
                  >
                    Batal
                  </button>

                  <button className="primary-btn" disabled={busy}>
                    {busy ? 'Menyimpan...' : 'Simpan pencatatan'}
                  </button>
                </div>

              </form>
            )}

            {/* PEMBAYARAN */}

            {modal === 'payment' && selected && (
              <form onSubmit={submitPayment} className="debt-form">

                <div className="debt-payment-info">
                  <span>Sisa yang harus diselesaikan</span>

                  <strong>{remainingText(selected)}</strong>

                  <small>
                    {selected.partyName} · {selected.description}
                  </small>
                </div>

                <div className="debt-form-grid">

                  <label>
                    Tanggal pembayaran *

                    <input
                      type="date"
                      required
                      value={paymentForm.date}
                      onChange={e =>
                        setPaymentForm({
                          ...paymentForm,
                          date: e.target.value
                        })
                      }
                    />
                  </label>

                  {selected.kind === 'money' ? (
                    <>
                      <label>
                        Nominal pembayaran (Rp) *

                        <input
                          type="number"
                          min="1"
                          max={selected.remainingAmount}
                          step="1"
                          required
                          value={paymentForm.amount}
                          onChange={e =>
                            setPaymentForm({
                              ...paymentForm,
                              amount: e.target.value
                            })
                          }
                          placeholder="100000"
                        />
                      </label>

                      <label>
                        Metode pembayaran

                        <select
                          value={paymentForm.method}
                          onChange={e =>
                            setPaymentForm({
                              ...paymentForm,
                              method: e.target.value
                            })
                          }
                        >
                          <option>Tunai</option>
                          <option>Transfer</option>
                          <option>QRIS</option>
                        </select>
                      </label>
                    </>
                  ) : (
                    <label className="full">
                      Jumlah barang dikembalikan *

                      <input
                        type="number"
                        min="0.001"
                        max={selected.remainingQty}
                        step="any"
                        required
                        value={paymentForm.qty}
                        onChange={e =>
                          setPaymentForm({
                            ...paymentForm,
                            qty: e.target.value
                          })
                        }
                        placeholder={`Maksimal ${selected.remainingQty} ${selected.unit}`}
                      />
                    </label>
                  )}

                  <label className="full">
                    Keterangan

                    <textarea
                      rows={3}
                      value={paymentForm.note}
                      onChange={e =>
                        setPaymentForm({
                          ...paymentForm,
                          note: e.target.value
                        })
                      }
                      placeholder="Catatan pembayaran atau pengembalian..."
                    />
                  </label>

                </div>

                <div className="debt-form-actions">
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() => setModal(null)}
                    disabled={busy}
                  >
                    Batal
                  </button>

                  <button className="primary-btn" disabled={busy}>
                    {busy ? 'Memproses...' : 'Simpan pembayaran'}
                  </button>
                </div>

              </form>
            )}

            {/* DETAIL */}

            {modal === 'detail' && selected && (
              <div className="debt-detail">

                <div className="debt-payment-info">
                  <span>
                    {selected.direction === 'payable'
                      ? 'Utang kepada'
                      : 'Piutang dari'}
                  </span>

                  <strong>{selected.partyName}</strong>

                  <small>{selected.description}</small>
                </div>

                {selected.isArchived && (
                  <div className="debt-archived-info">
                    <Archive size={15} />
                    Data ini berada dalam daftar arsip.
                  </div>
                )}

                <div className="debt-detail-grid">

                  <div>
                    <span>Jenis</span>
                    <strong>
                      {selected.kind === 'money' ? 'Uang' : 'Barang'}
                    </strong>
                  </div>

                  <div>
                    <span>Status</span>
                    <strong>{statusLabel[selected.status]}</strong>
                  </div>

                  <div>
                    <span>Tanggal</span>
                    <strong>{dateLabel(selected.date)}</strong>
                  </div>

                  <div>
                    <span>Jatuh tempo</span>
                    <strong>{dateLabel(selected.dueDate)}</strong>
                  </div>

                  <div>
                    <span>Total</span>
                    <strong>
                      {selected.kind === 'money'
                        ? money(selected.totalAmount)
                        : `${selected.qty} ${selected.unit} ${selected.itemName}`}
                    </strong>
                  </div>

                  <div>
                    <span>Sisa</span>
                    <strong>{remainingText(selected)}</strong>
                  </div>

                </div>

                <h3>
                  <History size={17} />
                  Riwayat pembayaran / pengembalian
                </h3>

                {busy ? (
                  <div className="debt-history-empty">
                    Memuat riwayat pembayaran...
                  </div>
                ) : payments.length === 0 ? (
                  <div className="debt-history-empty">
                    Belum ada pembayaran atau pengembalian.
                  </div>
                ) : (
                  <div className="debt-history-list">

                    {payments.map(payment => (
                      <div className="debt-history-item" key={payment.id}>

                        <div className="debt-history-icon">
                          <CircleCheck size={17} />
                        </div>

                        <div>
                          <strong>
                            {payment.paymentType === 'money'
                              ? money(payment.amount)
                              : `${payment.qty} ${selected.unit}`}
                          </strong>

                          <span>{dateLabel(payment.date)}</span>

                          {payment.method && (
                            <small>Metode: {payment.method}</small>
                          )}

                          {payment.note && (
                            <small>{payment.note}</small>
                          )}
                        </div>

                      </div>
                    ))}

                  </div>
                )}

                <div className="debt-form-actions">

                  <button
                    className="outline-btn"
                    onClick={() => setModal(null)}
                  >
                    Tutup
                  </button>

                  {selected.isArchived ? (
                    <button
                      className="primary-btn"
                      disabled={busy}
                      onClick={() => {
                        setModal(null)
                        void restoreDebt(selected)
                      }}
                    >
                      <ArchiveRestore size={16} />
                      Pulihkan data
                    </button>
                  ) : selected.status !== 'lunas' && (
                    <button
                      className="primary-btn"
                      onClick={() => openPayment(selected)}
                    >
                      Catat pembayaran
                    </button>
                  )}

                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
