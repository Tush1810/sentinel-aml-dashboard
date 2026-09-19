export type Alert = {
  alertRef: string
  ruleCode: string
  typology: string
  riskScore: number
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: string
  customerRef: string
  customerName: string
  accountRef: string | null
  explanation: string
  evidence: string[]
  detectedAt: string
}

export type Summary = {
  totalCustomers: number
  totalAccounts: number
  totalTransactions: number
  totalAlerts: number
  openAlerts: number
  alertsBySeverity: Record<string, number>
  alertsByRule: Record<string, number>
  alertsByStatus: Record<string, number>
}

export type Transaction = {
  txnRef: string
  accountRef: string
  direction: 'CREDIT' | 'DEBIT'
  txnType: string
  amount: number
  currency: string
  amountBase: number
  counterpartyName: string | null
  counterpartyCountry: string | null
  channel: string | null
  txnTimestamp: string
}

export type Credentials = { username: string; password: string }

async function get<T>(path: string, credentials: Credentials): Promise<T> {
  const response = await fetch(path, {
    headers: { Authorization: 'Basic ' + btoa(`${credentials.username}:${credentials.password}`) },
  })
  if (!response.ok) {
    throw new Error(response.status === 401 ? 'Invalid credentials' : `Request failed (${response.status})`)
  }
  return response.json()
}

export const fetchSummary = (c: Credentials) => get<Summary>('/api/v1/dashboard/summary', c)
export const fetchAlerts = (c: Credentials) => get<Alert[]>('/api/v1/alerts?size=100', c)
export const fetchAlert = (ref: string, c: Credentials) => get<Alert>(`/api/v1/alerts/${ref}`, c)
export const fetchTimeline = (customerRef: string, c: Credentials) =>
  get<Transaction[]>(`/api/v1/dashboard/customers/${customerRef}/transactions`, c)
