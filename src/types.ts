export type User = {
  id: string
  email: string
  name: string
  createdAt: string
}

export type OrderStatus = 'pending' | 'paid' | 'shipped'

export type OrderItem = { sku: string; quantity: number }

export type Order = {
  id: string
  userId: string
  status: OrderStatus
  items: OrderItem[]
  totalCents: number
  createdAt: string
}

export type Page<T> = { data: T[]; nextCursor: string | null }

export type ListOptions = { limit?: number; cursor?: string }
