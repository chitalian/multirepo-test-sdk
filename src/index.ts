import type { ListOptions, Order, OrderItem, OrderStatus, Page, User } from './types.js'

export type * from './types.js'

export type AcmeOptions = {
  /** Secret API key. Defaults to the ACME_API_KEY environment variable. */
  apiKey?: string
  /** Defaults to https://api.acme.dev */
  baseUrl?: string
  /** Times to retry a request that failed with a 5xx or network error. Defaults to 3. */
  maxRetries?: number
}

export class AcmeError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'AcmeError'
  }
}

export class Acme {
  private apiKey: string
  private baseUrl: string
  private maxRetries: number

  constructor(options: AcmeOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ACME_API_KEY
    if (!apiKey) throw new Error('Pass apiKey or set ACME_API_KEY')
    this.apiKey = apiKey
    this.baseUrl = options.baseUrl ?? 'https://api.acme.dev'
    this.maxRetries = options.maxRetries ?? 3
  }

  users = {
    list: (options: ListOptions = {}) => this.request<Page<User>>('GET', '/v1/users', query(options)),
    get: (id: string) => this.request<User>('GET', `/v1/users/${encodeURIComponent(id)}`),
    /** Iterates over every user, fetching pages as needed. */
    all: (options: Omit<ListOptions, 'cursor'> = {}) => this.iterate((cursor) => this.users.list({ ...options, cursor })),
  }

  orders = {
    list: (options: ListOptions & { status?: OrderStatus } = {}) => this.request<Page<Order>>('GET', '/v1/orders', query(options)),
    create: (input: { userId: string; items: OrderItem[] }) => this.request<Order>('POST', '/v1/orders', undefined, input),
  }

  private async *iterate<T>(fetchPage: (cursor?: string) => Promise<Page<T>>): AsyncGenerator<T> {
    let cursor: string | undefined
    do {
      const page = await fetchPage(cursor)
      yield* page.data
      cursor = page.nextCursor ?? undefined
    } while (cursor)
  }

  private async request<T>(method: string, path: string, search?: URLSearchParams, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}${search?.size ? `?${search}` : ''}`
    for (let attempt = 0; ; attempt++) {
      let res: Response
      try {
        res = await fetch(url, {
          method,
          headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
      } catch (err) {
        if (attempt < this.maxRetries) continue
        throw err
      }
      if (res.status >= 500 && attempt < this.maxRetries) continue
      const json = (await res.json()) as T & { error?: string }
      if (!res.ok) throw new AcmeError(res.status, json.error ?? res.statusText)
      return json
    }
  }
}

function query(options: Record<string, string | number | undefined>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(options)) if (value !== undefined) params.set(key, String(value))
  return params
}
