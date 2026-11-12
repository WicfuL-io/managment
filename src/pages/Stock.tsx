
import { useEffect, useState } from 'react'
import {
  Plus,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  AlertTriangle,
  X,
  RefreshCw
} from 'lucide-react'
import { api } from '../lib/api'

type Item = {
  id: string
  name: string
  category: string
  unit: string
  minStock: number
}

type Batch = {
  id: string
  itemId: string
  itemName: string
  qty: number | string
  buyPrice: number | string
  buyDate: string
  expiryDate: string
  supplier: string
}

type Movement = {
  id: string
  itemName: string
  type: string
  qty: number | string
  date: string
  note: string
}

/**
 * Mengubah berbagai format angka menjadi number.
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
 * Format angka menjadi mata uang Rupiah.
 */
const rupiah = (value: unknown): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(toNumber(value))
}

export default function Stock({ token }: { token: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [moves, setMoves] = useState<Movement[]>([])

  const [tab, setTab] = useState<'stock' | 'in' | 'out'>('stock')
  const [search, setSearch] = useState('')

  const [show, setShow] = useState(false)
  const [outBatch, setOutBatch] = useState<Batch | null>(null)

  const [qtyOut, setQtyOut] = useState('')
  const [note, setNote] = useState('')

  const [form, setForm] = useState({
    name: '',
    category: 'Umum',
    qty: '',
    unit: 'pcs',
    buyPrice: '',
    buyDate: '',
    expiryDate: '',
    supplier: '',
    minStock: '0'
  })

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /**
   * Memuat data stok dari Google Sheets.
   */
  async function load() {
    try {
      setError('')

      const r = await api<{
        items: Item[]
        batches: Batch[]
        movements: Movement[]
      }>('stock.list', { token })

      if (!r.data) {
        throw new Error('Data stok tidak ditemukan.')
      }

      setItems(Array.isArray(r.data.items) ? r.data.items : [])
      setBatches(Array.isArray(r.data.batches) ? r.data.batches : [])
      setMoves(Array.isArray(r.data.movements) ? r.data.movements : [])
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Gagal memuat stok.'
      )
    }
  }

  useEffect(() => {
    load()
  }, [token])

  /**
   * Daftar nama barang yang tersedia.
   */
  const names = [...new Set(items.map(x => x.name))]

  /**
   * Pencarian barang.
   */
  const filtered = batches.filter(x =>
    `${x.itemName || ''} ${x.supplier || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  /**
   * Total stok tersedia.
   * Menggunakan toNumber agar tidak menghasilkan NaN.
   */
  const total = batches.reduce(
    (a, x) => a + toNumber(x.qty),
    0
  )

  /**
   * Menghitung batch kosong.
   */
  const emptyBatches = batches.filter(
    x => toNumber(x.qty) <= 0
  ).length

  /**
   * Menyimpan barang masuk.
   */
  async function save(e: React.FormEvent) {
    e.preventDefault()

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const qty = toNumber(form.qty)
      const buyPrice = toNumber(form.buyPrice)
      const minStock = toNumber(form.minStock)

      if (qty <= 0) {
        throw new Error('Jumlah barang harus lebih dari 0.')
      }

      if (buyPrice < 0 || minStock < 0) {
        throw new Error('Harga dan stok minimum tidak boleh negatif.')
      }

      await api('stock.add', {
        token,
        ...form,
        qty,
        buyPrice,
        minStock
      })

      setShow(false)

      setMessage(
        'Barang masuk berhasil disimpan ke Google Sheets.'
      )

      setForm({
        name: '',
        category: 'Umum',
        qty: '',
        unit: 'pcs',
        buyPrice: '',
        buyDate: '',
        expiryDate: '',
        supplier: '',
        minStock: '0'
      })

      await load()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Gagal menyimpan.'
      )
    } finally {
      setBusy(false)
    }
  }

  /**
   * Mencatat barang keluar.
   */
  async function remove(e: React.FormEvent) {
    e.preventDefault()

    if (!outBatch) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const qty = toNumber(qtyOut)
      const available = toNumber(outBatch.qty)

      if (qty <= 0) {
        throw new Error('Jumlah barang keluar harus lebih dari 0.')
      }

      if (qty > available) {
        throw new Error('Jumlah barang keluar melebihi stok tersedia.')
      }

      await api('stock.remove', {
        token,
        batchId: outBatch.id,
        qty,
        note
      })

      setOutBatch(null)
      setQtyOut('')
      setNote('')

      setMessage('Barang keluar berhasil dicatat.')

      await load()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Gagal mengurangi stok.'
      )
    } finally {
      setBusy(false)
    }
  }

  /**
   * Memilih barang lama atau memasukkan barang baru.
   */
  function handleItemName(value: string) {
    const old = items.find(
      i => i.name.toLowerCase() === value.toLowerCase()
    )

    const batch = batches.find(
      x => x.itemId === old?.id
    )

    setForm(f => ({
      ...f,
      name: value,
      ...(old
        ? {
            category: old.category,
            unit: old.unit,
            minStock: String(toNumber(old.minStock)),
            ...(batch
              ? {
                  buyPrice: String(toNumber(batch.buyPrice)),
                  supplier: batch.supplier || ''
                }
              : {})
          }
        : {})
    }))
  }

  return (
    <div className="page-stack">

      {/* HEADER */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            INVENTORY MANAGEMENT · GOOGLE SHEETS
          </span>

          <h1>Stock Barang</h1>

          <p>
            Setiap perubahan persediaan tersimpan langsung ke database.
          </p>
        </div>

        <button
          className="primary-btn"
          onClick={() => setShow(true)}
        >
          <Plus size={17} />
          Barang Masuk
        </button>
      </div>

      {/* METRIC */}
      <div className="metric-grid metric-grid-secondary">

        <div className="mini-metric">
          <span className="mini-icon blue">
            <Package />
          </span>

          <div>
            <small>Jenis Barang</small>
            <b>{items.length} item</b>
          </div>
        </div>

        <div className="mini-metric">
          <span className="mini-icon green">
            <ArrowDownToLine />
          </span>

          <div>
            <small>Total Stok Tersedia</small>
            <b>{total.toLocaleString('id-ID')} unit</b>
          </div>
        </div>

        <div className="mini-metric">
          <span className="mini-icon orange">
            <AlertTriangle />
          </span>

          <div>
            <small>Batch Hampir Habis</small>
            <b>{emptyBatches} batch kosong</b>
          </div>
        </div>

      </div>

      {/* STOCK TABLE */}
      <section className="panel">

        <div className="stock-toolbar">

          <div className="tabs">
            <button
              className={tab === 'stock' ? 'selected' : ''}
              onClick={() => setTab('stock')}
            >
              Stok Saat Ini
            </button>

            <button
              className={tab === 'in' ? 'selected' : ''}
              onClick={() => setTab('in')}
            >
              Barang Masuk
            </button>

            <button
              className={tab === 'out' ? 'selected' : ''}
              onClick={() => setTab('out')}
            >
              Barang Keluar
            </button>
          </div>

          <div className="toolbar-actions">

            <div className="search-field">
              <Search size={16} />

              <input
                placeholder="Cari barang..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <button
              className="outline-btn"
              onClick={load}
              title="Refresh data"
            >
              <RefreshCw size={15} />
            </button>

          </div>
        </div>

        {/* TAB STOK */}
        {tab === 'stock' ? (
          <div className="table-scroll">

            <table>
              <thead>
                <tr>
                  <th>Nama Barang</th>
                  <th>Kategori</th>
                  <th>Jumlah</th>
                  <th>Harga Beli</th>
                  <th>Tanggal Beli</th>
                  <th>Expired</th>
                  <th>Supplier</th>
                  <th>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(x => {
                  const item = items.find(
                    i => i.id === x.itemId
                  )

                  return (
                    <tr key={x.id}>
                      <td>
                        <b>{x.itemName}</b>
                      </td>

                      <td>
                        {item?.category || '-'}
                      </td>

                      <td>
                        {toNumber(x.qty).toLocaleString('id-ID')}{' '}
                        {item?.unit || ''}
                      </td>

                      <td>
                        {rupiah(x.buyPrice)}
                      </td>

                      <td>
                        {String(x.buyDate || '').slice(0, 10) || '-'}
                      </td>

                      <td>
                        {String(x.expiryDate || '').slice(0, 10) || '-'}
                      </td>

                      <td>
                        {x.supplier || '-'}
                      </td>

                      <td>
                        <button
                          className="table-icon"
                          title="Barang keluar"
                          onClick={() => {
                            setOutBatch(x)
                            setQtyOut('')
                            setError('')
                          }}
                        >
                          <ArrowUpFromLine size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {!filtered.length && (
              <div className="empty-state">
                Belum ada batch barang di database.
              </div>
            )}

          </div>
        ) : (

          /* TAB BARANG MASUK DAN KELUAR */
          <div className="table-scroll">

            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nama Barang</th>
                  <th>Jenis</th>
                  <th>Jumlah</th>
                  <th>Catatan</th>
                </tr>
              </thead>

              <tbody>
                {moves
                  .filter(x =>
                    (tab === 'in'
                      ? x.type === 'IN'
                      : x.type === 'OUT') &&
                    `${x.itemName || ''} ${x.note || ''}`
                      .toLowerCase()
                      .includes(search.toLowerCase())
                  )
                  .slice()
                  .reverse()
                  .map(x => (
                    <tr key={x.id}>
                      <td>
                        {String(x.date || '').slice(0, 10)}
                      </td>

                      <td>
                        <b>{x.itemName}</b>
                      </td>

                      <td>
                        <span className="soft-tag">
                          {x.type === 'IN' ? 'Masuk' : 'Keluar'}
                        </span>
                      </td>

                      <td>
                        {toNumber(x.qty).toLocaleString('id-ID')}
                      </td>

                      <td>
                        {x.note || '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {!moves.length && (
              <div className="empty-state">
                Belum ada riwayat pergerakan stok.
              </div>
            )}

          </div>
        )}

        <div className="table-foot">
          Data dimuat dari Google Sheets · {batches.length} batch ·{' '}
          {moves.length} pergerakan
        </div>

      </section>

      {/* ALERT */}
      {(message || error) && (
        <div className={`alert ${error ? 'error' : 'success'}`}>
          {error || message}

          <button
            onClick={() => {
              setError('')
              setMessage('')
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* MODAL BARANG MASUK */}
      {show && (
        <div className="modal-backdrop">

          <section className="modal">

            <div className="modal-head">
              <div>
                <h2>Tambah Barang Masuk</h2>
                <p>
                  Pilih barang lama atau ketik nama barang baru.
                </p>
              </div>

              <button
                className="icon-btn"
                onClick={() => setShow(false)}
              >
                <X />
              </button>
            </div>

            <form onSubmit={save} className="form-grid">

              <label className="span-2">
                Nama barang

                <input
                  list="existing-items"
                  value={form.name}
                  onChange={e => handleItemName(e.target.value)}
                  placeholder="Pilih atau ketik nama barang"
                  required
                />

                <datalist id="existing-items">
                  {names.map(n => (
                    <option key={n} value={n} />
                  ))}
                </datalist>

                <small>
                  Jika memilih barang lama, kategori dan satuan akan
                  terisi otomatis. Tanggal beli dan expired tetap diisi
                  untuk batch baru.
                </small>
              </label>

              <label>
                Kategori

                <input
                  value={form.category}
                  onChange={e =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
              </label>

              <label>
                Supplier

                <input
                  value={form.supplier}
                  onChange={e =>
                    setForm({ ...form, supplier: e.target.value })
                  }
                />
              </label>

              <label>
                Jumlah masuk

                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={form.qty}
                  onChange={e =>
                    setForm({ ...form, qty: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Satuan

                <select
                  value={form.unit}
                  onChange={e =>
                    setForm({ ...form, unit: e.target.value })
                  }
                >
                  <option>pcs</option>
                  <option>kg</option>
                  <option>liter</option>
                  <option>dus</option>
                  <option>pack</option>
                </select>
              </label>

              <label>
                Harga beli per unit

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.buyPrice}
                  onChange={e =>
                    setForm({ ...form, buyPrice: e.target.value })
                  }
                />
              </label>

              <label>
                Stok minimum

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.minStock}
                  onChange={e =>
                    setForm({ ...form, minStock: e.target.value })
                  }
                />
              </label>

              <label>
                Tanggal beli

                <input
                  type="date"
                  value={form.buyDate}
                  onChange={e =>
                    setForm({ ...form, buyDate: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Tanggal expired

                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={e =>
                    setForm({ ...form, expiryDate: e.target.value })
                  }
                  required
                />
              </label>

              <div className="span-2 modal-actions">

                <button
                  type="button"
                  className="outline-btn"
                  onClick={() => setShow(false)}
                >
                  Batal
                </button>

                <button
                  className="primary-btn"
                  disabled={busy}
                >
                  {busy
                    ? 'Menyimpan...'
                    : 'Simpan ke database'}
                </button>

              </div>

            </form>

          </section>
        </div>
      )}

      {/* MODAL BARANG KELUAR */}
      {outBatch && (
        <div className="modal-backdrop">

          <section className="modal">

            <div className="modal-head">
              <div>
                <h2>Catat Barang Keluar</h2>

                <p>
                  {outBatch.itemName} · Stok tersedia{' '}
                  {toNumber(outBatch.qty).toLocaleString('id-ID')}
                </p>
              </div>

              <button
                className="icon-btn"
                onClick={() => setOutBatch(null)}
              >
                <X />
              </button>
            </div>

            <form
              className="form-grid"
              onSubmit={remove}
            >

              <label className="span-2">
                Jumlah keluar

                <input
                  type="number"
                  min="0.01"
                  max={toNumber(outBatch.qty)}
                  step="any"
                  value={qtyOut}
                  onChange={e => setQtyOut(e.target.value)}
                  required
                />
              </label>

              <label className="span-2">
                Catatan

                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Contoh: pemakaian / rusak / penjualan"
                />
              </label>

              <div className="span-2 modal-actions">

                <button
                  type="button"
                  className="outline-btn"
                  onClick={() => setOutBatch(null)}
                >
                  Batal
                </button>

                <button
                  className="primary-btn"
                  disabled={busy}
                >
                  {busy
                    ? 'Menyimpan...'
                    : 'Simpan barang keluar'}
                </button>

              </div>

            </form>

          </section>
        </div>
      )}

    </div>
  )
}
