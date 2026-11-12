export type Role = 'admin' | 'staff'
export type User = {
  id: string; name: string; email: string; role: Role; status: 'pending' | 'active' | 'blocked'
  permissions?: string[]
}
export type Page = 'dashboard' | 'stock' | 'pos' | 'finance' | 'users' | 'logs' | 'settings'
export type ApiResult<T = unknown> = { success: boolean; message?: string; data?: T }
export type Item = { id: string; name: string; category: string; unit: string; minStock: number }
export type Batch = { id: string; itemId: string; itemName: string; qty: number; buyPrice: number; buyDate: string; expiryDate: string; supplier: string }
export type FinanceRecord = { id: string; type: 'income' | 'expense'; date: string; description: string; category: string; amount: number; method: string }
