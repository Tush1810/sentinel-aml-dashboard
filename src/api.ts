export type Alert = {
  alertRef: string
  ruleCode: string
  typology: string
  riskScore: number
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: string
  customerRef: string
  customerName: string
  accountRef?: string
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

export type CustomerRow = {
  customerRef: string
  name: string
  city: string | null
  segment: string | null
  kycStatus: string
  riskRating: string
  politicallyExposed: boolean
  accountRefs: string[]
  transactions: number
  alerts: number
  highestRiskScore: number
}

async function send<T>(path: string, credentials: Credentials, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + btoa(`${credentials.username}:${credentials.password}`),
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(
      response.status === 403 ? 'Sign in as admin to simulate' : `Request failed (${response.status})`,
    )
  }
  return response.json()
}

export const fetchCustomers = (c: Credentials) => get<CustomerRow[]>('/api/v1/dashboard/customers', c)
export type PostedTransaction = {
  txnRef: string
  status: string
}

export const postTransaction = (
  body: Record<string, unknown>, c: Credentials,
) => send<PostedTransaction>('/api/v1/transactions', c, body)


export type CasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type Disposition = 'FALSE_POSITIVE' | 'CLEARED' | 'ESCALATED_TO_SAR'

export type CaseView = {
  caseRef: string
  customerRef: string
  status: 'OPEN' | 'IN_REVIEW' | 'CLOSED' | 'ESCALATED_TO_SAR'
  priority: CasePriority
  assignedTo?: string
  alertRefs: string[]
  disposition?: Disposition
  dispositionReason?: string
  disposedBy?: string
  disposedAt?: string
  openedAt: string
}

export type AuditEntry = {
  entityType: string
  entityRef: string
  fromStatus?: string
  toStatus: string
  actor: string
  reason?: string
  occurredAt: string
}

export const fetchCases = (c: Credentials) => get<CaseView[]>('/api/v1/cases?size=100', c)
export const fetchCaseAudit = (caseRef: string, c: Credentials) =>
  get<AuditEntry[]>(`/api/v1/cases/${caseRef}/audit`, c)

export const openCase = (alertRefs: string[], priority: CasePriority, c: Credentials) =>
  send<CaseView>('/api/v1/cases', c, { alertRefs, priority })

/** The endpoint takes the assignee as a query parameter, so the body is unused. */
export const assignCase = (caseRef: string, assignee: string, c: Credentials) =>
  send<CaseView>(`/api/v1/cases/${caseRef}/assignment?assignee=${encodeURIComponent(assignee)}`, c, {})

export const disposeCase = (
  caseRef: string, disposition: Disposition, reason: string, c: Credentials,
) => send<CaseView>(`/api/v1/cases/${caseRef}/disposition`, c, { disposition, reason })
