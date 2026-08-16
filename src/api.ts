export interface User { id: number; name: string; email: string; role: string }
export interface Client { id: number; name: string; document?: string; phone?: string; email?: string; contract_count: number }
export interface Contract {
  id: number
  client_id: number
  client_name: string
  principal_cents: number
  interest_rate: number
  term_days: number
  start_date: string
  due_date: string
  status: string
  balance_principal_cents: number
  current_interest_cents: number
  current_fee_cents: number
  current_cycle: number
}
export interface Dashboard {
  summary: { principalCents: number; interestCents: number; feeCents: number; totalCents: number; openContracts: number }
  contracts: Array<Contract & { principal_due: number; interest_due: number; fee_due: number }>
  activities: Array<{ id: number; action: string; entity_type: string; entity_id?: number; user_name?: string; created_at: string }>
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.')
  return payload as T
}

export const api = {
  status: () => request<{ setupRequired: boolean; authenticated: boolean }>('/status'),
  setup: (data: { name: string; email: string; password: string }) => request('/setup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) => request<{ user: User }>('/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/logout', { method: 'POST' }),
  me: () => request<{ user: User }>('/me'),
  dashboard: () => request<Dashboard>('/dashboard'),
  clients: () => request<{ clients: Client[] }>('/clients'),
  createClient: (data: Record<string, string>) => request<{ id: number }>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  contracts: () => request<{ contracts: Contract[] }>('/contracts'),
  createContract: (data: object) => request<{ id: number; dueDate: string; interestCents: number; totalCents: number }>('/contracts', { method: 'POST', body: JSON.stringify(data) }),
  pay: (id: number, data: object) => request<{ nextDueDate: string | null }>(`/contracts/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  backup: () => request<{ file: string }>('/backup', { method: 'POST' }),
}

