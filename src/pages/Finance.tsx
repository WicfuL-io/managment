
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Wallet,
  RefreshCw,
  Plus,
  Search,
  X,
  Trash2,
  Tags,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  CalendarDays,
  CreditCard,
  Banknote,
  History,
  ArrowDownUp
} from 'lucide-react'

import { api } from '../lib/api'
import '../css/Finance.css'

type FinanceTab = 'all' | 'income' | 'expense'
type ModalType = 'income' | 'expense' | 'transfer' | 'categories' | null

type Tx = {
  id: string
  type: 'income' | 'expense'
  date: string
  description: string
  categoryId?: string
  categoryName: string
  amount: number
  method: string
  userId?: string
}

type Cat = {
  id: string
  name: string
}

type Transfer = {
  id: string
  date: string
  amount: number
  fromMethod: string
  toMethod: string
  note: string
}

type FinanceData = {
  transactions: Tx[]
  incomeCategories: Cat[]
  expenseCategories: Cat[]
  transfers: Transfer[]
  balances: {
    cash: number
    debit: number
  }
}

type Props = {
  token: string
}

type TransactionForm = {
  date: string
  description: string
  categoryId: string
  categoryName: string
  amount: string
  method: string
}

type TransferForm = {
  date: string
  amount: string
  fromMethod: 'Tunai' | 'Debit'
  toMethod: 'Tunai' | 'Debit'
  note: string
}

const today = () => new Date().toISOString().slice(0, 10)

const emptyTransactionForm = (type: 'income' | 'expense'): TransactionForm => ({
  date: today(),
  description: '',
  categoryId: '',
  categoryName: '',
  amount: '',
  method: 'Tunai'
})

const emptyTransferForm = (): TransferForm => ({
  date: today(),
  amount: '',
  fromMethod: 'Debit',
  toMethod: 'Tunai',
  note: ''
})

const formatRupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0)

const numberValue = (value: unknown) => {
  const result = Number(value || 0)
  return Number.isFinite(result) ? result : 0
}

const formatDate = (value: string) => {
  if (!value) return '-'

  const date = new Date(`${value.slice(0, 10)}T00:00:00`)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

const getError = (error: unknown) =>
  error instanceof Error ? error.message : 'Terjadi kesalahan. Silakan coba kembali.'

const normalizeMethod = (method: string) => {
  const value = String(method || '').trim().toLowerCase()

  if (value === 'tunai' || value === 'cash') return 'Tunai'

  if (
    value === 'debit' ||
    value === 'kartu debit' ||
    value === 'transfer' ||
    value === 'qris'
  ) {
    return 'Debit'
  }

  if (value === 'pencatatan') return 'Pencatatan'
  if (value === 'ambil sendiri') return 'Ambil Sendiri'

  return method || 'Debit'
}

export default function Finance({ token }: Props) {
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [incomeCategories, setIncomeCategories] = useState<Cat[]>([])
  const [expenseCategories, setExpenseCategories] = useState<Cat[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])

  const [balances, setBalances] = useState({
    cash: 0,
    debit: 0
  })

  const [tab, setTab] = useState<FinanceTab>('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalType>(null)

  const [transactionForm, setTransactionForm] = useState<TransactionForm>(
    emptyTransactionForm('income')
  )

  const [transferForm, setTransferForm] = useState<TransferForm>(
    emptyTransferForm()
  )

  const [categoryType, setCategoryType] = useState<'income' | 'expense'>('income')
  const [categoryName, setCategoryName] = useState('')

  const [showTransferHistory, setShowTransferHistory] = useState(false)
  const [showTransactionMenu, setShowTransactionMenu] = useState(false)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api<FinanceData>('finance.list', { token })
      const data = response.data

      if (!data) {
        throw new Error('Data keuangan tidak ditemukan.')
      }

      setTransactions(Array.isArray(data.transactions) ? data.transactions : [])
      setIncomeCategories(
        Array.isArray(data.incomeCategories) ? data.incomeCategories : []
      )
      setExpenseCategories(
        Array.isArray(data.expenseCategories) ? data.expenseCategories : []
      )
      setTransfers(Array.isArray(data.transfers) ? data.transfers : [])

      setBalances({
        cash: numberValue(data.balances?.cash),
        debit: numberValue(data.balances?.debit)
      })
    } catch (err) {
      setError(getError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // Memuat ulang saat token akun berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const totalIncome = useMemo(
    () =>
      transactions
        .filter(item => item.type === 'income')
        .reduce((sum, item) => sum + numberValue(item.amount), 0),
    [transactions]
  )

  const totalExpense = useMemo(
    () =>
      transactions
        .filter(item => item.type === 'expense')
        .reduce((sum, item) => sum + numberValue(item.amount), 0),
    [transactions]
  )

  const filteredTransactions = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return [...transactions]
      .filter(item => {
        if (tab !== 'all' && item.type !== tab) return false

        if (!keyword) return true

        return [
          item.description,
          item.categoryName,
          item.method,
          item.date
        ].some(value => String(value || '').toLowerCase().includes(keyword))
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [transactions, tab, search])

  const openTransaction = (type: 'income' | 'expense') => {
    setTransactionForm(emptyTransactionForm(type))
    setError('')
    setMessage('')
    setShowTransactionMenu(false)
    setModal(type)
  }

  const saveTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const amount = Number(transactionForm.amount)

    if (!transactionForm.description.trim()) {
      setError('Keterangan transaksi wajib diisi.')
      return
    }

    if (!transactionForm.categoryName.trim()) {
      setError('Silakan pilih kategori transaksi.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Nominal transaksi harus lebih dari nol.')
      return
    }

    setBusy(true)
    setError('')

    try {
      await api('finance.add', {
        token,
        type: modal === 'expense' ? 'expense' : 'income',
        date: transactionForm.date,
        description: transactionForm.description.trim(),
        categoryId: transactionForm.categoryId,
        categoryName: transactionForm.categoryName,
        amount,
        method: transactionForm.method
      })

      setModal(null)
      setMessage('Transaksi berhasil ditambahkan.')
      await load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setBusy(false)
    }
  }

  const saveTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const amount = Number(transferForm.amount)

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Nominal pemindahan harus lebih dari nol.')
      return
    }

    if (transferForm.fromMethod === transferForm.toMethod) {
      setError('Sumber dan tujuan saldo tidak boleh sama.')
      return
    }

    const available =
      transferForm.fromMethod === 'Tunai' ? balances.cash : balances.debit

    if (amount > available) {
      setError(
        `Saldo ${transferForm.fromMethod} tidak mencukupi. Saldo tersedia ${formatRupiah(available)}.`
      )
      return
    }

    setBusy(true)
    setError('')

    try {
      await api('finance.transfer', {
        token,
        date: transferForm.date,
        amount,
        fromMethod: transferForm.fromMethod,
        toMethod: transferForm.toMethod,
        note: transferForm.note.trim()
      })

      setModal(null)
      setTransferForm(emptyTransferForm())
      setMessage(
        `Saldo ${transferForm.fromMethod} berhasil dipindahkan ke ${transferForm.toMethod}.`
      )

      await load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setBusy(false)
    }
  }

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = categoryName.trim()

    if (!name) {
      setError('Nama kategori wajib diisi.')
      return
    }

    const currentCategories =
      categoryType === 'income' ? incomeCategories : expenseCategories

    if (
      currentCategories.some(
        item => item.name.trim().toLowerCase() === name.toLowerCase()
      )
    ) {
      setError('Kategori tersebut sudah tersedia.')
      return
    }

    setBusy(true)
    setError('')

    try {
      await api('finance.addCategory', {
        token,
        type: categoryType,
        name
      })

      setCategoryName('')
      setMessage('Kategori berhasil ditambahkan.')
      await load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setBusy(false)
    }
  }

  const deleteTransaction = async (item: Tx) => {
    const confirmed = window.confirm(
      `Hapus transaksi "${item.description}" sebesar ${formatRupiah(numberValue(item.amount))}?`
    )

    if (!confirmed) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      await api('finance.delete', {
        token,
        id: item.id
      })

      setMessage('Transaksi berhasil dihapus.')
      await load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setBusy(false)
    }
  }

  const currentCategories =
    modal === 'expense' ? expenseCategories : incomeCategories

  const selectedCategoryList =
    categoryType === 'income' ? incomeCategories : expenseCategories

  return (
    <div className="finance-page">
      <div className="finance-heading">
        <div>
          <div className="finance-eyebrow">MANAJEMEN KEUANGAN</div>
          <h1>Keuangan</h1>
          <p>Kelola pemasukan, pengeluaran, dan saldo keuangan Anda.</p>
        </div>

        <button
          type="button"
          className="finance-refresh"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          <RefreshCw size={16} className={loading ? 'finance-spin' : ''} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {error && (
        <div className="finance-alert finance-alert-error">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Tutup">
            <X size={16} />
          </button>
        </div>
      )}

      {message && (
        <div className="finance-alert finance-alert-success">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} aria-label="Tutup">
            <X size={16} />
          </button>
        </div>
      )}

      <section className="finance-summary-grid">
        <article className="finance-summary-card income">
          <div className="finance-summary-top">
            <span>Total Pemasukan</span>
            <span className="finance-summary-icon"><TrendingUp size={19} /></span>
          </div>
          <strong>{formatRupiah(totalIncome)}</strong>
          <small>Akumulasi seluruh pemasukan</small>
        </article>

        <article className="finance-summary-card expense">
          <div className="finance-summary-top">
            <span>Total Pengeluaran</span>
            <span className="finance-summary-icon"><TrendingDown size={19} /></span>
          </div>
          <strong>{formatRupiah(totalExpense)}</strong>
          <small>Akumulasi seluruh pengeluaran</small>
        </article>

        <article className="finance-summary-card balance">
          <div className="finance-summary-top">
            <span>Saldo Bersih</span>
            <span className="finance-summary-icon"><Wallet size={19} /></span>
          </div>
          <strong>{formatRupiah(totalIncome - totalExpense)}</strong>
          <small>Pemasukan dikurangi pengeluaran</small>
        </article>
      </section>

      <section className="finance-balance-section">
        <div className="finance-section-heading">
          <div>
            <h2>Posisi Saldo</h2>
            <p>Saldo uang berdasarkan metode pembayaran.</p>
          </div>

          <button
            type="button"
            className="finance-transfer-button"
            onClick={() => {
              setTransferForm(emptyTransferForm())
              setError('')
              setModal('transfer')
            }}
          >
            <ArrowLeftRight size={16} />
            Pindahkan Saldo
          </button>
        </div>

        <div className="finance-balance-grid">
          <article className="finance-balance-card">
            <div className="finance-balance-icon cash">
              <Banknote size={21} />
            </div>
            <div className="finance-balance-info">
              <span>Saldo Tunai</span>
              <strong>{formatRupiah(balances.cash)}</strong>
              <small>Uang tunai / cash</small>
            </div>
          </article>

          <article className="finance-balance-card">
            <div className="finance-balance-icon debit">
              <CreditCard size={21} />
            </div>
            <div className="finance-balance-info">
              <span>Saldo Debit</span>
              <strong>{formatRupiah(balances.debit)}</strong>
              <small>Debit, transfer, dan QRIS</small>
            </div>
          </article>
        </div>

        <div className="finance-transfer-history">
          <button
            type="button"
            className="finance-history-toggle"
            onClick={() => setShowTransferHistory(value => !value)}
          >
            <History size={16} />
            Riwayat Pemindahan Saldo
            <span>{transfers.length}</span>
            <ChevronDown
              size={16}
              className={showTransferHistory ? 'is-open' : ''}
            />
          </button>

          {showTransferHistory && (
            <div className="finance-table-wrap finance-transfer-table">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Pemindahan</th>
                    <th>Keterangan</th>
                    <th className="align-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="finance-empty">
                        Belum ada riwayat pemindahan saldo.
                      </td>
                    </tr>
                  ) : (
                    [...transfers]
                      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                      .map(item => (
                        <tr key={item.id}>
                          <td>{formatDate(item.date)}</td>
                          <td>
                            <span className="finance-transfer-route">
                              {item.fromMethod}
                              <ArrowRight size={14} />
                              {item.toMethod}
                            </span>
                          </td>
                          <td>{item.note || '-'}</td>
                          <td className="align-right finance-amount">
                            {formatRupiah(numberValue(item.amount))}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="finance-transactions-section">
        <div className="finance-section-heading finance-transactions-heading">
          <div>
            <h2>Daftar Transaksi</h2>
            <p>Semua pemasukan dan pengeluaran tercatat di sini.</p>
          </div>

          <div className="finance-action-group">
            <div className="finance-menu-wrap">
              <button
                type="button"
                className="finance-primary-button"
                onClick={() => setShowTransactionMenu(value => !value)}
              >
                <Plus size={16} />
                Transaksi
                <ChevronDown size={15} />
              </button>

              {showTransactionMenu && (
                <>
                  <button
                    type="button"
                    className="finance-menu-backdrop"
                    aria-label="Tutup menu"
                    onClick={() => setShowTransactionMenu(false)}
                  />
                  <div className="finance-dropdown">
                    <button
                      type="button"
                      onClick={() => openTransaction('income')}
                    >
                      <span className="finance-dropdown-icon income">
                        <ArrowDownLeft size={17} />
                      </span>
                      <span>
                        <strong>Tambah Pemasukan</strong>
                        <small>Catat uang masuk</small>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openTransaction('expense')}
                    >
                      <span className="finance-dropdown-icon expense">
                        <ArrowUpRight size={17} />
                      </span>
                      <span>
                        <strong>Tambah Pengeluaran</strong>
                        <small>Catat uang keluar</small>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              className="finance-category-button"
              onClick={() => {
                setError('')
                setModal('categories')
              }}
            >
              <Tags size={16} />
              Kategori
            </button>
          </div>
        </div>

        <div className="finance-table-card">
          <div className="finance-table-toolbar">
            <div className="finance-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'all'}
                className={tab === 'all' ? 'active' : ''}
                onClick={() => setTab('all')}
              >
                Semua Transaksi
                <span>{transactions.length}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={tab === 'income'}
                className={tab === 'income' ? 'active' : ''}
                onClick={() => setTab('income')}
              >
                Pemasukan
                <span>{transactions.filter(item => item.type === 'income').length}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={tab === 'expense'}
                className={tab === 'expense' ? 'active' : ''}
                onClick={() => setTab('expense')}
              >
                Pengeluaran
                <span>{transactions.filter(item => item.type === 'expense').length}</span>
              </button>
            </div>

            <label className="finance-search">
              <Search size={16} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Cari transaksi..."
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Hapus pencarian"
                >
                  <X size={14} />
                </button>
              )}
            </label>
          </div>

          <div className="finance-table-wrap finance-main-table">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Keterangan</th>
                  <th>Kategori</th>
                  <th>Metode</th>
                  <th>Jenis</th>
                  <th className="align-right">Nominal</th>
                  <th className="align-center">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="finance-empty">
                      Memuat data transaksi...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="finance-empty">
                      <CircleDollarSign size={25} />
                      <strong>Belum ada transaksi</strong>
                      <span>Transaksi yang sesuai akan muncul di sini.</span>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(item => (
                    <tr key={item.id}>
                      <td className="finance-date-cell">
                        <CalendarDays size={14} />
                        {formatDate(item.date)}
                      </td>

                      <td className="finance-description-cell">
                        {item.description}
                      </td>

                      <td>
                        <span className="finance-category-chip">
                          {item.categoryName || 'Tanpa kategori'}
                        </span>
                      </td>

                      <td>
                        <span className="finance-method-chip">
                          {normalizeMethod(item.method)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`finance-type-chip ${item.type}`}
                        >
                          {item.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                        </span>
                      </td>

                      <td
                        className={`align-right finance-amount ${item.type}`}
                      >
                        {item.type === 'income' ? '+' : '-'}
                        {formatRupiah(numberValue(item.amount))}
                      </td>

                      <td className="align-center">
                        <button
                          type="button"
                          className="finance-delete-button"
                          title="Hapus transaksi"
                          disabled={busy}
                          onClick={() => void deleteTransaction(item)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="finance-table-footer">
            <span>
              Menampilkan {filteredTransactions.length} dari {transactions.length} transaksi
            </span>
            <span>
              {tab === 'all'
                ? 'Semua transaksi'
                : tab === 'income'
                  ? 'Filter pemasukan'
                  : 'Filter pengeluaran'}
            </span>
          </div>
        </div>
      </section>

      {modal && (
        <div
          className="finance-modal-overlay"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !busy) {
              setModal(null)
              setError('')
            }
          }}
        >
          <div className="finance-modal">
            <div className="finance-modal-header">
              <div>
                <span className="finance-modal-eyebrow">
                  {modal === 'income'
                    ? 'TRANSAKSI MASUK'
                    : modal === 'expense'
                      ? 'TRANSAKSI KELUAR'
                      : modal === 'transfer'
                        ? 'PEMINDAHAN SALDO'
                        : 'PENGELOLAAN KEUANGAN'}
                </span>

                <h2>
                  {modal === 'income'
                    ? 'Tambah Pemasukan'
                    : modal === 'expense'
                      ? 'Tambah Pengeluaran'
                      : modal === 'transfer'
                        ? 'Pindahkan Saldo'
                        : 'Kategori Keuangan'}
                </h2>
              </div>

              <button
                type="button"
                className="finance-modal-close"
                onClick={() => {
                  if (!busy) {
                    setModal(null)
                    setError('')
                  }
                }}
                aria-label="Tutup popup"
              >
                <X size={19} />
              </button>
            </div>

            {(modal === 'income' || modal === 'expense') && (
              <form className="finance-form" onSubmit={saveTransaction}>
                <div className="finance-form-grid">
                  <label className="finance-field finance-field-full">
                    <span>Tanggal transaksi</span>
                    <input
                      type="date"
                      required
                      value={transactionForm.date}
                      onChange={event =>
                        setTransactionForm({
                          ...transactionForm,
                          date: event.target.value
                        })
                      }
                    />
                  </label>

                  <label className="finance-field finance-field-full">
                    <span>Keterangan</span>
                    <input
                      required
                      value={transactionForm.description}
                      onChange={event =>
                        setTransactionForm({
                          ...transactionForm,
                          description: event.target.value
                        })
                      }
                      placeholder="Contoh: Penjualan barang"
                    />
                  </label>

                  <label className="finance-field">
                    <span>Kategori</span>
                    <select
                      required
                      value={transactionForm.categoryId}
                      onChange={event => {
                        const selected = currentCategories.find(
                          item => item.id === event.target.value
                        )

                        setTransactionForm({
                          ...transactionForm,
                          categoryId: selected?.id || '',
                          categoryName: selected?.name || ''
                        })
                      }}
                    >
                      <option value="">Pilih kategori</option>
                      {currentCategories.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="finance-field">
                    <span>Metode pembayaran</span>
                    <select
                      value={transactionForm.method}
                      onChange={event =>
                        setTransactionForm({
                          ...transactionForm,
                          method: event.target.value
                        })
                      }
                    >
                      <option value="Tunai">Tunai</option>
                      <option value="Debit">Debit</option>
                    </select>
                  </label>

                  <label className="finance-field finance-field-full">
                    <span>Nominal (Rp)</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={transactionForm.amount}
                      onChange={event =>
                        setTransactionForm({
                          ...transactionForm,
                          amount: event.target.value
                        })
                      }
                      placeholder="Masukkan nominal"
                    />
                  </label>
                </div>

                {error && <div className="finance-form-error">{error}</div>}

                <div className="finance-modal-actions">
                  <button
                    type="button"
                    className="finance-cancel-button"
                    disabled={busy}
                    onClick={() => setModal(null)}
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    className="finance-submit-button"
                    disabled={busy}
                  >
                    {busy ? 'Menyimpan...' : 'Simpan Transaksi'}
                  </button>
                </div>
              </form>
            )}

            {modal === 'transfer' && (
              <form className="finance-form" onSubmit={saveTransfer}>
                <div className="finance-transfer-balance-preview">
                  <div>
                    <span>Saldo Tunai</span>
                    <strong>{formatRupiah(balances.cash)}</strong>
                  </div>
                  <div>
                    <span>Saldo Debit</span>
                    <strong>{formatRupiah(balances.debit)}</strong>
                  </div>
                </div>

                <div className="finance-form-grid">
                  <label className="finance-field finance-field-full">
                    <span>Tanggal pemindahan</span>
                    <input
                      type="date"
                      required
                      value={transferForm.date}
                      onChange={event =>
                        setTransferForm({
                          ...transferForm,
                          date: event.target.value
                        })
                      }
                    />
                  </label>

                  <label className="finance-field">
                    <span>Dari saldo</span>
                    <select
                      value={transferForm.fromMethod}
                      onChange={event => {
                        const fromMethod = event.target.value as 'Tunai' | 'Debit'
                        setTransferForm({
                          ...transferForm,
                          fromMethod,
                          toMethod: fromMethod === 'Tunai' ? 'Debit' : 'Tunai'
                        })
                      }}
                    >
                      <option value="Tunai">Tunai</option>
                      <option value="Debit">Debit</option>
                    </select>
                  </label>

                  <label className="finance-field">
                    <span>Ke saldo</span>
                    <select
                      value={transferForm.toMethod}
                      onChange={event =>
                        setTransferForm({
                          ...transferForm,
                          toMethod: event.target.value as 'Tunai' | 'Debit'
                        })
                      }
                    >
                      <option value="Tunai">Tunai</option>
                      <option value="Debit">Debit</option>
                    </select>
                  </label>

                  <label className="finance-field finance-field-full">
                    <span>Nominal pemindahan (Rp)</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={transferForm.amount}
                      onChange={event =>
                        setTransferForm({
                          ...transferForm,
                          amount: event.target.value
                        })
                      }
                      placeholder="Masukkan nominal"
                    />
                  </label>

                  <label className="finance-field finance-field-full">
                    <span>Catatan (opsional)</span>
                    <input
                      value={transferForm.note}
                      onChange={event =>
                        setTransferForm({
                          ...transferForm,
                          note: event.target.value
                        })
                      }
                      placeholder="Contoh: Setor uang ke rekening"
                    />
                  </label>
                </div>

                <div className="finance-transfer-info">
                  <ArrowDownUp size={16} />
                  Pemindahan saldo tidak dihitung sebagai pemasukan atau pengeluaran.
                </div>

                {error && <div className="finance-form-error">{error}</div>}

                <div className="finance-modal-actions">
                  <button
                    type="button"
                    className="finance-cancel-button"
                    disabled={busy}
                    onClick={() => setModal(null)}
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    className="finance-submit-button"
                    disabled={busy}
                  >
                    {busy ? 'Memproses...' : 'Pindahkan Saldo'}
                  </button>
                </div>
              </form>
            )}

            {modal === 'categories' && (
              <div className="finance-category-manager">
                <div className="finance-category-tabs">
                  <button
                    type="button"
                    className={categoryType === 'income' ? 'active income' : ''}
                    onClick={() => {
                      setCategoryType('income')
                      setError('')
                    }}
                  >
                    <TrendingUp size={15} />
                    Pemasukan
                  </button>

                  <button
                    type="button"
                    className={categoryType === 'expense' ? 'active expense' : ''}
                    onClick={() => {
                      setCategoryType('expense')
                      setError('')
                    }}
                  >
                    <TrendingDown size={15} />
                    Pengeluaran
                  </button>
                </div>

                <form className="finance-category-add" onSubmit={saveCategory}>
                  <label className="finance-field">
                    <span>Nama kategori baru</span>
                    <input
                      value={categoryName}
                      onChange={event => setCategoryName(event.target.value)}
                      placeholder="Contoh: Penjualan"
                    />
                  </label>

                  <button type="submit" disabled={busy}>
                    <Plus size={16} />
                    Tambah
                  </button>
                </form>

                {error && <div className="finance-form-error">{error}</div>}

                <div className="finance-category-list-heading">
                  <strong>Daftar Kategori</strong>
                  <span>{selectedCategoryList.length} kategori</span>
                </div>

                <div className="finance-category-list">
                  {selectedCategoryList.length === 0 ? (
                    <div className="finance-category-empty">
                      Belum ada kategori.
                    </div>
                  ) : (
                    selectedCategoryList.map((item, index) => (
                      <div className="finance-category-item" key={item.id || index}>
                        <span className="finance-category-number">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span>{item.name}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="finance-modal-actions">
                  <button
                    type="button"
                    className="finance-cancel-button"
                    onClick={() => setModal(null)}
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
