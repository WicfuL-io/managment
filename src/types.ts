
export type Role = 'admin' | 'staff'

export type User = {
  id: string
  name: string
  email: string
  role: Role
  status: 'pending' | 'active' | 'blocked'
  permissions?: string[]
}

export type Page =
  | 'dashboard'
  | 'stock'
  | 'pos'
  | 'finance'
  | 'debt'
  | 'users'
  | 'logs'
  | 'settings'

export type ApiResult<T = unknown> = {
  success: boolean
  message?: string
  data?: T
}

// ================================
// UTANG & PIUTANG
// ================================

export type DebtDirection = 'payable' | 'receivable'

export type DebtKind = 'money' | 'goods'

export type DebtStatus =
  | 'belum_lunas'
  | 'sebagian'
  | 'lunas'
  | 'jatuh_tempo'

export type DebtRecord = {
  id: string
  direction: DebtDirection
  kind: DebtKind

  partyName: string
  partyContact?: string

  description: string

  // Khusus utang/piutang barang
  itemName?: string
  unit?: string
  qty?: number
  settledQty?: number
  remainingQty?: number

  // Khusus utang/piutang uang
  totalAmount?: number
  paidAmount?: number
  remainingAmount?: number

  date: string
  dueDate?: string

  status: DebtStatus
  note?: string
  paymentCount?: number

  isArchived?: boolean
  archivedAt?: string
  archivedBy?: string
}

export type DebtPayment = {
  id: string
  debtId: string
  date: string
  amount?: number
  qty?: number
  method?: string
  note?: string
  userId?: string
  createdAt?: string
}

// ================================
// STOCK
// ================================

export type Item = {
  id: string
  name: string
  category: string
  unit: string
  minStock: number
}

export type Batch = {
  id: string
  itemId: string
  itemName: string
  qty: number
  buyPrice: number
  buyDate: string
  expiryDate: string
  supplier: string
}

// ================================
// FINANCE
// ================================

export type FinanceRecord = {
  id: string
  type: 'income' | 'expense'
  date: string
  description: string
  category: string
  amount: number
  method: string
}
