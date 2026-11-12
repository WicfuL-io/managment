
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Package,
  Search,
  CreditCard,
  Banknote,
  CalendarDays,
  AlertCircle,
  X,
  ShoppingBag,
  LoaderCircle,
  Wallet,
  ArrowLeftRight,
  Receipt,
  Hand,
  Store,
} from 'lucide-react'
import { api } from '../lib/api'

type Batch = {
  id: string
  itemName: string
  qty: number
  buyPrice: number
  expiryDate: string
}

type Cart = {
  batchId: string
  name: string
  qty: number
  price: number
  available: number
  buyPrice: number
  expiryDate: string
}

type TransactionType = 'Ambil Sendiri' | 'Pembelian'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0)

const numberValue = (value: unknown) => {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

const formatDate = (value: string) => {
  if (!value || value === 'undefined' || value === 'null') return '-'

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)

  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export default function POS({ token }: { token: string }) {
  const [batches, setBatches] = useState<Batch[]>([])
  const [cart, setCart] = useState<Cart[]>([])

  const [transactionType, setTransactionType] =
    useState<TransactionType>('Pembelian')

  const [method, setMethod] = useState('Tunai')
  const [paymentAmount, setPaymentAmount] = useState('')

  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const r = await api<{ batches: Batch[] }>('stock.list', { token })

      const availableBatches = (r.data?.batches || []).filter(
        (item) => numberValue(item.qty) > 0,
      )

      setBatches(availableBatches)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat stok.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const filteredBatches = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return batches

    return batches.filter((item) =>
      item.itemName.toLowerCase().includes(keyword),
    )
  }, [batches, search])

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty * item.price, 0),
    [cart],
  )

  const totalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart],
  )

  const totalProducts = batches.length

  // AMBIL SENDIRI SELALU GRATIS
  const isFreePickup = transactionType === 'Ambil Sendiri'
  const paymentTotal = isFreePickup ? 0 : total

  // NOMINAL UANG DITERIMA
  const paidAmount =
    method === 'Tunai' && !isFreePickup
      ? numberValue(paymentAmount)
      : paymentTotal

  // KEMBALIAN
  const changeAmount = Math.max(0, paidAmount - paymentTotal)

  // KEKURANGAN PEMBAYARAN
  const remainingPayment = Math.max(0, paymentTotal - paidAmount)

  // VALIDASI PEMBAYARAN
  const isPaymentEnough =
    isFreePickup || (paymentTotal > 0 && paidAmount >= paymentTotal)

  function addToCart(batch: Batch) {
    setError('')
    setMessage('')

    setCart((old) => {
      const existing = old.find((item) => item.batchId === batch.id)

      if (existing) {
        if (existing.qty >= numberValue(batch.qty)) {
          setError(`Stok ${batch.itemName} tidak mencukupi.`)
          return old
        }

        return old.map((item) =>
          item.batchId === batch.id
            ? {
                ...item,
                qty: item.qty + 1,
                available: numberValue(batch.qty),
              }
            : item,
        )
      }

      return [
        ...old,
        {
          batchId: batch.id,
          name: batch.itemName,
          qty: 1,
          price: numberValue(batch.buyPrice),
          buyPrice: numberValue(batch.buyPrice),
          available: numberValue(batch.qty),
          expiryDate: batch.expiryDate,
        },
      ]
    })
  }

  function changeQty(batchId: string, amount: number) {
    setError('')

    setCart((old) =>
      old.map((item) => {
        if (item.batchId !== batchId) return item

        const nextQty = item.qty + amount

        if (nextQty > item.available) {
          setError(`Stok ${item.name} hanya tersedia ${item.available}.`)
          return item
        }

        return {
          ...item,
          qty: Math.max(1, nextQty),
        }
      }),
    )
  }

  function changePrice(batchId: string, value: string) {
    const price = value === '' ? 0 : Math.max(0, Number(value) || 0)

    setCart((old) =>
      old.map((item) =>
        item.batchId === batchId ? { ...item, price } : item,
      ),
    )
  }

  function removeItem(batchId: string) {
    setCart((old) => old.filter((item) => item.batchId !== batchId))
    setError('')
  }

  function resetCheckout() {
    setCart([])
    setPaymentAmount('')
    setMethod('Tunai')
    setTransactionType('Pembelian')
    setSearch('')
  }

  function selectTransactionType(type: TransactionType) {
    setTransactionType(type)
    setPaymentAmount('')
    setError('')
    setMessage('')
  }

  async function checkout() {
    if (!cart.length) {
      setError('Pilih barang terlebih dahulu.')
      return
    }

    if (cart.some((item) => item.qty <= 0 || item.qty > item.available)) {
      setError('Periksa kembali jumlah barang dalam keranjang.')
      return
    }

    // Harga hanya diwajibkan untuk transaksi pembelian.
    if (
      !isFreePickup &&
      cart.some(
        (item) => !Number.isFinite(item.price) || item.price <= 0,
      )
    ) {
      setError('Harga barang harus lebih dari nol.')
      return
    }

    if (!isFreePickup && paymentTotal <= 0) {
      setError('Total pembayaran tidak valid.')
      return
    }

    if (!isFreePickup && method === 'Tunai' && paidAmount < paymentTotal) {
      setError(
        `Pembayaran kurang ${fmt(remainingPayment)}. Masukkan nominal yang cukup.`,
      )
      return
    }

    if (!isFreePickup && !['Tunai', 'Transfer', 'QRIS'].includes(method)) {
      setError('Metode pembayaran tidak valid.')
      return
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const checkoutItems = cart.map((item) => ({
        batchId: item.batchId,
        qty: item.qty,
        price: isFreePickup ? 0 : item.price,
      }))

      const transactionNote = isFreePickup
        ? 'Pengambilan sendiri - Gratis - Tanpa pembayaran'
        : method === 'Tunai'
          ? `Pembelian - Uang diterima: ${fmt(paidAmount)} - Kembalian: ${fmt(changeAmount)}`
          : `Pembelian - Pembayaran: ${method}`

      // PENTING:
      // Backend menerima "Ambil Sendiri", bukan "Gratis".
      const r = await api<{
        total: number
        transactionId?: string
        isFree?: boolean
      }>('pos.checkout', {
        token,
        items: checkoutItems,

        method: isFreePickup ? 'Ambil Sendiri' : method,
        pickupMethod: isFreePickup ? 'Ambil Sendiri' : 'Pembelian',
        selfPickup: isFreePickup,

        note: transactionNote,
        transactionType: isFreePickup ? 'free_pickup' : 'purchase',
      })

      const transactionTotal = isFreePickup
        ? 0
        : numberValue(r.data?.total ?? paymentTotal)

      setMessage(
        isFreePickup
          ? `Pengambilan berhasil! ${totalItems} barang telah dicatat. Tidak ada pembayaran.`
          : method === 'Tunai'
            ? `Pembelian berhasil! Total ${fmt(transactionTotal)}. Uang diterima ${fmt(paidAmount)}. Kembalian ${fmt(changeAmount)}.`
            : `Pembelian berhasil! Total ${fmt(transactionTotal)} melalui ${method}.`,
      )

      resetCheckout()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout gagal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pos-page">

      <div className="pos-heading">
        <div>
          <div className="pos-eyebrow">
            <span className="pos-live-dot" />
            SALES MANAGEMENT
            <span className="pos-eyebrow-divider">/</span>
            POINT OF SALE
          </div>

          <h1>Point of Sale</h1>

          <p>
            Pilih barang untuk pengambilan sendiri atau pembelian.
          </p>
        </div>

        <button
          type="button"
          className="pos-refresh-btn"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          <RefreshCw
            size={16}
            className={loading ? 'pos-spin' : ''}
          />
          <span>Refresh stok</span>
        </button>
      </div>

      <div className="pos-stats">

        <div className="pos-stat-card">
          <div className="pos-stat-icon blue">
            <Package size={20} />
          </div>

          <div>
            <span>Batch tersedia</span>
            <strong>{totalProducts}</strong>
            <small>Batch dengan stok aktif</small>
          </div>
        </div>

        <div className="pos-stat-card">
          <div className="pos-stat-icon green">
            <ShoppingBag size={20} />
          </div>

          <div>
            <span>Jenis barang dipilih</span>
            <strong>{cart.length}</strong>
            <small>Produk dalam keranjang</small>
          </div>
        </div>

        <div className="pos-stat-card">
          <div className="pos-stat-icon purple">
            <ShoppingCart size={20} />
          </div>

          <div>
            <span>Total item</span>
            <strong>{totalItems}</strong>
            <small>Jumlah seluruh barang</small>
          </div>
        </div>

      </div>

      {error && (
        <div className="pos-alert pos-alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {message && (
        <div className="pos-alert pos-alert-success">
          <CheckCircle2 size={18} />
          <span>{message}</span>

          <button
            type="button"
            onClick={() => setMessage('')}
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="pos-layout">

        <section className="pos-panel pos-products">

          <div className="pos-panel-header">
            <div>
              <div className="pos-section-title">
                <div className="pos-title-icon">
                  <Package size={19} />
                </div>

                <h2>Pilih Barang</h2>
              </div>

              <p>Daftar batch barang yang tersedia untuk diambil atau dibeli.</p>
            </div>

            <span className="pos-count-badge">
              {batches.length} batch
            </span>
          </div>

          <div className="pos-search">
            <Search size={18} />

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama barang..."
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

          {loading ? (

            <div className="pos-loading">
              <LoaderCircle size={28} className="pos-spin" />
              <span>Memuat daftar barang...</span>
            </div>

          ) : filteredBatches.length === 0 ? (

            <div className="pos-empty">
              <div className="pos-empty-icon">
                <Package size={30} />
              </div>

              <strong>
                {search
                  ? 'Barang tidak ditemukan'
                  : 'Belum ada stok tersedia'}
              </strong>

              <p>
                {search
                  ? 'Coba gunakan kata kunci pencarian lain.'
                  : 'Tambahkan stok barang terlebih dahulu melalui menu Stock Barang.'}
              </p>
            </div>

          ) : (

            <div className="pos-product-grid">

              {filteredBatches.map((batch) => {
                const selected = cart.find(
                  (item) => item.batchId === batch.id,
                )

                const stock = numberValue(batch.qty)
                const isSelected = Boolean(selected)

                return (
                  <article
                    className="pos-product-card"
                    key={batch.id}
                  >

                    <div className="pos-product-top">
                      <div className="pos-product-icon">
                        <Package size={22} />
                      </div>

                      <span
                        className={`pos-stock-badge ${
                          stock <= 5 ? 'low' : 'available'
                        }`}
                      >
                        {stock} tersedia
                      </span>
                    </div>

                    <div className="pos-product-info">
                      <h3>{batch.itemName}</h3>

                      <div className="pos-product-detail">
                        <CalendarDays size={14} />
                        <span>
                          Expired: {formatDate(batch.expiryDate)}
                        </span>
                      </div>

                      <div className="pos-product-price">
                        {fmt(numberValue(batch.buyPrice))}
                        <small>Harga modal / unit</small>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`pos-add-btn ${
                        isSelected ? 'selected' : ''
                      }`}
                      onClick={() => addToCart(batch)}
                      disabled={Boolean(
                        selected && selected.qty >= stock,
                      )}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 size={16} />
                          Ditambahkan ({selected?.qty})
                        </>
                      ) : (
                        <>
                          <Plus size={17} />
                          Tambahkan
                        </>
                      )}
                    </button>

                  </article>
                )
              })}

            </div>
          )}

        </section>

        <section className="pos-panel pos-cart">

          <div className="pos-panel-header">
            <div>
              <div className="pos-section-title">
                <div className="pos-title-icon cart-icon">
                  <ShoppingCart size={19} />
                </div>

                <h2>Keranjang</h2>
              </div>

              <p>Atur barang dan tentukan jenis transaksi.</p>
            </div>

            <span className="pos-count-badge">
              {cart.length} produk
            </span>
          </div>

          {cart.length > 0 ? (

            <div className="pos-cart-list">

              {cart.map((item) => (

                <div
                  className="pos-cart-item"
                  key={item.batchId}
                >

                  <div className="pos-cart-item-head">

                    <div className="pos-cart-item-icon">
                      <Package size={18} />
                    </div>

                    <div className="pos-cart-item-name">
                      <strong>{item.name}</strong>
                      <small>
                        Stok tersedia: {item.available}
                      </small>
                    </div>

                    <button
                      type="button"
                      className="pos-remove-btn"
                      onClick={() => removeItem(item.batchId)}
                      aria-label={`Hapus ${item.name}`}
                    >
                      <Trash2 size={16} />
                    </button>

                  </div>

                  {!isFreePickup && (
                    <div className="pos-price-input">
                      <label>Harga jual per unit</label>

                      <div>
                        <span>Rp</span>

                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.price}
                          onChange={(e) =>
                            changePrice(
                              item.batchId,
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    </div>
                  )}

                  <div className="pos-cart-item-bottom">

                    <div className="pos-quantity">

                      <button
                        type="button"
                        onClick={() =>
                          changeQty(item.batchId, -1)
                        }
                        disabled={item.qty <= 1}
                        aria-label="Kurangi jumlah"
                      >
                        <Minus size={14} />
                      </button>

                      <strong>{item.qty}</strong>

                      <button
                        type="button"
                        onClick={() =>
                          changeQty(item.batchId, 1)
                        }
                        disabled={item.qty >= item.available}
                        aria-label="Tambah jumlah"
                      >
                        <Plus size={14} />
                      </button>

                    </div>

                    <div className="pos-subtotal">
                      <small>
                        {isFreePickup ? 'Pengambilan gratis' : 'Subtotal'}
                      </small>

                      <strong>
                        {isFreePickup ? 'GRATIS' : fmt(item.qty * item.price)}
                      </strong>
                    </div>

                  </div>

                </div>

              ))}

            </div>

          ) : (

            <div className="pos-cart-empty">
              <div className="pos-cart-empty-icon">
                <ShoppingCart size={30} />
              </div>

              <strong>Keranjang masih kosong</strong>

              <p>
                Pilih barang dari katalog untuk memulai transaksi.
              </p>
            </div>

          )}

          <div className="pos-checkout">

            <div className="pos-checkout-heading">
              <Receipt size={17} />
              <strong>Jenis Transaksi</strong>
            </div>

            <div className="pos-pickup-options">

              <button
                type="button"
                className={`pos-pickup-option ${
                  isFreePickup ? 'active' : ''
                }`}
                onClick={() => selectTransactionType('Ambil Sendiri')}
              >
                <Hand size={20} />

                <span>
                  <strong>Ambil Sendiri</strong>
                  <small>Gratis, tanpa pembayaran</small>
                </span>

                {isFreePickup && <CheckCircle2 size={18} />}
              </button>

              <button
                type="button"
                className={`pos-pickup-option ${
                  !isFreePickup ? 'active' : ''
                }`}
                onClick={() => selectTransactionType('Pembelian')}
              >
                <Store size={20} />

                <span>
                  <strong>Pembelian</strong>
                  <small>Dengan pembayaran</small>
                </span>

                {!isFreePickup && <CheckCircle2 size={18} />}
              </button>

            </div>

            {isFreePickup ? (

              <div className="pos-noncash-box">
                <div className="pos-noncash-icon">
                  <Hand size={20} />
                </div>

                <div>
                  <strong>Pengambilan Gratis</strong>
                  <span>
                    Tidak ada pembayaran. Barang akan langsung dicatat sebagai pengambilan dan stok akan berkurang setelah checkout.
                  </span>
                </div>
              </div>

            ) : (

              <>
                <label className="pos-form-label">
                  Metode pembayaran

                  <div className="pos-payment-options">

                    {[
                      { value: 'Tunai', icon: Banknote },
                      { value: 'Transfer', icon: CreditCard },
                      { value: 'QRIS', icon: ShoppingCart },
                    ].map((option) => {

                      const Icon = option.icon

                      return (
                        <button
                          type="button"
                          key={option.value}
                          className={`pos-payment-option ${
                            method === option.value ? 'active' : ''
                          }`}
                          onClick={() => {
                            setMethod(option.value)
                            setPaymentAmount('')
                            setError('')
                          }}
                        >
                          <Icon size={17} />
                          {option.value}
                        </button>
                      )
                    })}

                  </div>
                </label>

                {method === 'Tunai' && (

                  <div className="pos-cash-box">

                    <div className="pos-cash-title">
                      <Wallet size={18} />
                      <strong>Nominal Pembayaran</strong>
                    </div>

                    <label className="pos-form-label">
                      Uang diterima

                      <div className="pos-cash-input">
                        <span>Rp</span>

                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={paymentAmount}
                          onChange={(e) => {
                            setPaymentAmount(e.target.value)
                            setError('')
                          }}
                          placeholder="Masukkan nominal uang"
                        />
                      </div>
                    </label>

                    <div className="pos-cash-shortcuts">

                      <button
                        type="button"
                        onClick={() =>
                          setPaymentAmount(String(total))
                        }
                        disabled={total <= 0}
                      >
                        Uang pas
                      </button>

                      {[50000, 100000, 200000].map((amount) => (

                        <button
                          type="button"
                          key={amount}
                          onClick={() =>
                            setPaymentAmount(String(amount))
                          }
                        >
                          {fmt(amount)}
                        </button>

                      ))}

                    </div>

                    <div className="pos-cash-result">

                      <div className="pos-cash-result-row">
                        <span>Total belanja</span>
                        <strong>{fmt(total)}</strong>
                      </div>

                      <div className="pos-cash-result-row">
                        <span>Uang diterima</span>
                        <strong>{fmt(paidAmount)}</strong>
                      </div>

                      <div className="pos-cash-result-divider" />

                      {isPaymentEnough ? (

                        <div className="pos-change-result">
                          <div>
                            <span>Kembalian</span>
                            <strong>{fmt(changeAmount)}</strong>
                          </div>

                          <CheckCircle2 size={23} />
                        </div>

                      ) : (

                        <div className="pos-underpayment">
                          <div>
                            <span>Uang masih kurang</span>
                            <strong>{fmt(remainingPayment)}</strong>
                          </div>

                          <AlertCircle size={22} />
                        </div>

                      )}

                    </div>

                  </div>

                )}

                {method !== 'Tunai' && (

                  <div className="pos-noncash-box">
                    <div className="pos-noncash-icon">
                      <ArrowLeftRight size={19} />
                    </div>

                    <div>
                      <strong>Pembayaran {method}</strong>
                      <span>
                        Pastikan pembayaran sebesar {fmt(total)} sudah diterima.
                      </span>
                    </div>
                  </div>

                )}
              </>
            )}

            <div className="pos-total-box">

              <div className="pos-total-row">
                <span>Total jenis barang</span>
                <strong>{cart.length} produk</strong>
              </div>

              <div className="pos-total-row">
                <span>Total kuantitas</span>
                <strong>{totalItems} item</strong>
              </div>

              <div className="pos-total-row">
                <span>Jenis transaksi</span>
                <strong>{transactionType}</strong>
              </div>

              {!isFreePickup && (
                <div className="pos-total-row">
                  <span>Metode pembayaran</span>
                  <strong>{method}</strong>
                </div>
              )}

              <div className="pos-total-divider" />

              <div className="pos-grand-total">
                <span>
                  {isFreePickup ? 'Total pengambilan' : 'Total pembayaran'}
                </span>

                <strong>
                  {isFreePickup ? 'GRATIS' : fmt(total)}
                </strong>
              </div>

              {!isFreePickup && method === 'Tunai' && (
                <>
                  <div className="pos-total-row">
                    <span>Uang diterima</span>
                    <strong>{fmt(paidAmount)}</strong>
                  </div>

                  <div className="pos-total-row pos-change-summary">
                    <span>Kembalian</span>
                    <strong>{fmt(changeAmount)}</strong>
                  </div>
                </>
              )}

            </div>

            <button
              type="button"
              className="pos-checkout-btn"
              disabled={
                !cart.length ||
                busy ||
                loading ||
                (!isFreePickup &&
                  (paymentTotal <= 0 ||
                    (method === 'Tunai' && !isPaymentEnough))) ||
                cart.some((item) => !isFreePickup && item.price <= 0)
              }
              onClick={() => void checkout()}
            >

              {busy ? (
                <>
                  <LoaderCircle
                    size={19}
                    className="pos-spin"
                  />
                  Memproses transaksi...
                </>
              ) : (
                <>
                  <CheckCircle2 size={19} />
                  {isFreePickup
                    ? 'Checkout Pengambilan Gratis'
                    : 'Checkout Pembelian'}
                </>
              )}

            </button>

            <div className="pos-secure-note">
              <CheckCircle2 size={14} />
              Stok diperbarui otomatis setelah checkout berhasil.
            </div>

          </div>

        </section>

      </div>

    </div>
  )
}
