import { useEffect, useState } from 'react'
import {
  fetchAlert, fetchAlerts, fetchCustomers, fetchSummary, fetchTimeline,
  openCase, postTransaction,
  type Alert, type CasePriority, type Credentials, type CustomerRow, type PostedTransaction,
  type Summary, type Transaction,
} from './api'
import Cases from './Cases'
import './App.css'

const TABS = ['Overview', 'Alerts', 'Cases', 'Customers'] as const
const PRIORITIES: CasePriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
type Tab = typeof TABS[number]

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const

const inr = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

const time = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export default function App() {
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [form, setForm] = useState<Credentials>({ username: 'analyst', password: 'analyst' })
  const [error, setError] = useState('')

  const [summary, setSummary] = useState<Summary | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [selected, setSelected] = useState<Alert | null>(null)
  const [timeline, setTimeline] = useState<Transaction[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [tab, setTab] = useState<Tab>('Overview')
  const [customerFilter, setCustomerFilter] = useState<string | null>(null)
  const [openCustomer, setOpenCustomer] = useState<CustomerRow | null>(null)
  const [customerTxns, setCustomerTxns] = useState<Transaction[]>([])
  const [posted, setPosted] = useState<PostedTransaction | null>(null)
  const [caseSelection, setCaseSelection] = useState<string[]>([])
  const [casePriority, setCasePriority] = useState<CasePriority>('HIGH')
  const [caseMessage, setCaseMessage] = useState('')

  const toggleForCase = (alertRef: string) =>
    setCaseSelection(refs =>
      refs.includes(alertRef) ? refs.filter(r => r !== alertRef) : [...refs, alertRef])

  /** Opening a case takes its alerts into review, so the queue is reloaded afterwards. */
  const createCase = async () => {
    if (!credentials) return
    try {
      const opened = await openCase(caseSelection, casePriority, credentials)
      setCaseMessage(`${opened.caseRef} opened over ${opened.alertRefs.length} alert(s)`)
      setCaseSelection([])
      setAlerts(await fetchAlerts(credentials))
    } catch (e) {
      setCaseMessage((e as Error).message)
    }
  }

  const load = (c: Credentials) =>
    Promise.all([fetchSummary(c), fetchAlerts(c), fetchCustomers(c)])
      .then(([s, a, cu]) => {
        setSummary(s); setAlerts(a); setCustomers(cu); setCredentials(c); setError('')
      })
      .catch((e: Error) => setError(e.message))

  useEffect(() => { if (credentials) { const id = setInterval(() => load(credentials), 15000); return () => clearInterval(id) } }, [credentials])

  const openCustomerTimeline = async (customer: CustomerRow) => {
    if (!credentials) return
    setOpenCustomer(customer)
    setCustomerTxns(await fetchTimeline(customer.customerRef, credentials))
  }

  const openAlert = async (alert: Alert) => {
    if (!credentials) return
    // Re-fetch the detail view: the queue masks the customer name, the detail view may not.
    const [detail, history] = await Promise.all([
      fetchAlert(alert.alertRef, credentials),
      fetchTimeline(alert.customerRef, credentials),
    ])
    setSelected(detail)
    setTimeline(history)
  }

  if (!credentials) {
    return (
      <div className="login">
        <h1>Sentinel <span>AML</span></h1>
        <p>Transaction monitoring</p>
        <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="username" />
        <input value={form.password} type="password" onChange={e => setForm({ ...form, password: e.target.value })} placeholder="password" />
        <button onClick={() => load(form)}>Sign in</button>
        {error && <p className="error">{error}</p>}
        <p className="hint">analyst / analyst &nbsp;·&nbsp; admin / admin</p>
      </div>
    )
  }

  const visible = customerFilter
    ? alerts.filter(a => a.customerRef === customerFilter)
    : alerts

  return (
    <div className="app">
      <header>
        <h1>Sentinel <span>AML</span></h1>
        <div className="who">{credentials.username}<button onClick={() => { setCredentials(null); setSelected(null) }}>sign out</button></div>
      </header>

      <nav className="tabs">
        {TABS.map(t => (
          <button key={t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      {tab === 'Overview' && summary && (
        <section className="tiles">
          <Tile label="Open alerts" value={summary.openAlerts} accent />
          <Tile label="Total alerts" value={summary.totalAlerts} />
          <Tile label="Transactions" value={summary.totalTransactions} />
          <Tile label="Accounts" value={summary.totalAccounts} />
          <Tile label="Customers" value={summary.totalCustomers} />
        </section>
      )}

      {tab === 'Overview' && summary && (
        <section className="panels">
          <div className="panel">
            <h2>Risk heatmap</h2>
            <div className="heatmap">
              {SEVERITIES.map(severity => (
                <div key={severity} className={`cell ${severity.toLowerCase()}`}>
                  <strong>{summary.alertsBySeverity[severity] ?? 0}</strong>
                  <span>{severity}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h2>By typology</h2>
            {Object.entries(summary.alertsByRule).sort((a, b) => b[1] - a[1]).map(([rule, count]) => (
              <div className="bar-row" key={rule}>
                <span className="bar-label">{rule.replaceAll('_', ' ').toLowerCase()}</span>
                <div className="bar"><div style={{ width: `${(count / summary.totalAlerts) * 100}%` }} /></div>
                <span className="bar-count">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'Alerts' && (
      <section className="panel">
        <h2>Alert queue <small>highest risk first</small>
          {customerFilter && (
            <button className="chip" onClick={() => setCustomerFilter(null)}>
              {customerFilter} &times;
            </button>
          )}
        </h2>
        <div className="sim-form">
          <span>{caseSelection.length} selected</span>
          <select value={casePriority} onChange={e => setCasePriority(e.target.value as CasePriority)}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button disabled={caseSelection.length === 0} onClick={() => void createCase()}>
            Open case
          </button>
          {caseMessage && <span className="hint">{caseMessage}</span>}
        </div>
        <table>
          <thead>
            <tr><th></th><th>Score</th><th>Severity</th><th>Rule</th><th>Customer</th><th>Account</th><th>Evidence</th><th>Detected</th></tr>
          </thead>
          <tbody>
            {visible.map(alert => (
              <tr key={alert.alertRef} onClick={() => openAlert(alert)} className={selected?.alertRef === alert.alertRef ? 'active' : ''}>
                <td onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={caseSelection.includes(alert.alertRef)}
                         onChange={() => toggleForCase(alert.alertRef)} />
                </td>
                <td><span className={`score ${alert.severity.toLowerCase()}`}>{alert.riskScore}</span></td>
                <td>{alert.severity}</td>
                <td>{alert.typology}</td>
                <td>{alert.customerName} <small>{alert.customerRef}</small></td>
                <td>{alert.accountRef ?? '—'}</td>
                <td>{alert.evidence.length}</td>
                <td>{time(alert.detectedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="empty">{customerFilter ? 'No alerts for this customer.' : 'No alerts yet. Ingest transactions and the engine will evaluate them.'}</p>}
      </section>
      )}

      {tab === 'Cases' && credentials && <Cases credentials={credentials} />}

      {tab === 'Alerts' && selected && (
        <section className="panel detail">
          <h2>{selected.alertRef} <small>{selected.typology}</small>
            <button className="close" onClick={() => setSelected(null)}>close</button>
          </h2>
          <p className="explanation">{selected.explanation}</p>
          <div className="meta">
            <span><b>Customer</b> {selected.customerName} ({selected.customerRef})</span>
            <span><b>Risk</b> {selected.riskScore} / 100</span>
            <span><b>Status</b> {selected.status}</span>
            <span><b>Evidence</b> {selected.evidence.join(', ')}</span>
          </div>
          <h3>Customer transaction timeline</h3>
          <table>
            <thead><tr><th>When</th><th>Txn</th><th>Account</th><th>Type</th><th>Direction</th><th>Amount</th><th>Country</th></tr></thead>
            <tbody>
              {timeline.map(t => (
                <tr key={t.txnRef} className={selected.evidence.includes(t.txnRef) ? 'evidence' : ''}>
                  <td>{time(t.txnTimestamp)}</td>
                  <td>{t.txnRef}</td>
                  <td>{t.accountRef}</td>
                  <td>{t.txnType}</td>
                  <td className={t.direction.toLowerCase()}>{t.direction}</td>
                  <td>{inr(t.amountBase)}</td>
                  <td>{t.counterpartyCountry ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {tab === 'Customers' && (
        <section className="panel">
          <h2>Customers <small>highest risk first</small></h2>
          <table>
            <thead>
              <tr><th>Customer</th><th>Ref</th><th>City</th><th>Segment</th><th>KYC</th>
                  <th>Risk</th><th>Accounts</th><th>Txns</th><th>Alerts</th><th>Top score</th></tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.customerRef} className={openCustomer?.customerRef === c.customerRef ? 'active' : ''}
                    onClick={() => openCustomerTimeline(c)}>
                  <td>{c.name} {c.politicallyExposed && <span className="pep">PEP</span>}</td>
                  <td><small>{c.customerRef}</small></td>
                  <td>{c.city ?? '—'}</td>
                  <td>{c.segment ?? '—'}</td>
                  <td>{c.kycStatus}</td>
                  <td>{c.riskRating}</td>
                  <td>{c.accountRefs.length}</td>
                  <td>{c.transactions}</td>
                  <td>{c.alerts}</td>
                  <td>{c.highestRiskScore > 0
                        ? <span className={`score ${band(c.highestRiskScore)}`}>{c.highestRiskScore}</span>
                        : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'Customers' && openCustomer && (
        <section className="panel detail">
          <h2>{openCustomer.name} <small>{openCustomer.customerRef} · {customerTxns.length} transactions</small>
            <button className="close" onClick={() => setOpenCustomer(null)}>close</button>
          </h2>
          <div className="meta">
            <span><b>Risk</b> {openCustomer.riskRating}</span>
            <span><b>KYC</b> {openCustomer.kycStatus}</span>
            <span><b>Accounts</b> {openCustomer.accountRefs.join(', ')}</span>
            <span><b>Alerts</b> {openCustomer.alerts}</span>
            {openCustomer.politicallyExposed && <span className="pep">PEP</span>}
          </div>
          <NewTransaction customer={openCustomer} credentials={credentials}
                          onPosted={r => { setPosted(r); openCustomerTimeline(openCustomer); load(credentials) }} />
          {posted && (
            <p className="posted">{posted.txnRef} accepted</p>
          )}
          <table>
            <thead><tr><th>When</th><th>Txn</th><th>Account</th><th>Type</th>
                       <th>Direction</th><th>Amount</th><th>Country</th></tr></thead>
            <tbody>
              {customerTxns.map(t => (
                <tr key={t.txnRef}>
                  <td>{time(t.txnTimestamp)}</td>
                  <td>{t.txnRef}</td>
                  <td>{t.accountRef}</td>
                  <td>{t.txnType}</td>
                  <td className={t.direction.toLowerCase()}>{t.direction}</td>
                  <td>{inr(t.amountBase)}</td>
                  <td>{t.counterpartyCountry ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {customerTxns.length === 0 && <p className="empty">No transactions yet.</p>}
          {openCustomer.alerts > 0 && (
            <button className="link" onClick={() => {
              setCustomerFilter(openCustomer.customerRef); setSelected(null); setTab('Alerts')
            }}>View {openCustomer.alerts} alerts for this customer &rarr;</button>
          )}
        </section>
      )}
    </div>
  )
}

function NewTransaction({ customer, credentials, onPosted }:
  { customer: CustomerRow; credentials: Credentials;
    onPosted: (r: PostedTransaction) => void }) {

  const [accountRef, setAccountRef] = useState(customer.accountRefs[0] ?? '')
  const [amount, setAmount] = useState('9500')
  const [direction, setDirection] = useState('CREDIT')
  const [txnType, setTxnType] = useState('CASH_DEPOSIT')
  const [country, setCountry] = useState('IN')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setAccountRef(customer.accountRefs[0] ?? ''); setError('') }, [customer.customerRef])

  const post = async () => {
    setBusy(true); setError('')
    try {
      onPosted(await postTransaction({
        txnRef: 'UI_' + Date.now(),
        accountRef,
        direction,
        txnType,
        amount: Number(amount),
        currency: 'INR',
        counterpartyCountry: country,
        channel: 'ONLINE',
        txnTimestamp: new Date().toISOString(),
      }, credentials))
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  if (customer.accountRefs.length === 0) {
    return <p className="hint">This customer has no account yet, so nothing can be posted against them.</p>
  }

  return (
    <>
      <h3>Post a transaction</h3>
      <div className="sim-form">
        <select value={accountRef} onChange={e => setAccountRef(e.target.value)}>
          {customer.accountRefs.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={direction} onChange={e => setDirection(e.target.value)}>
          <option value="CREDIT">CREDIT (in)</option>
          <option value="DEBIT">DEBIT (out)</option>
        </select>
        <select value={txnType} onChange={e => setTxnType(e.target.value)}>
          {['CASH_DEPOSIT','DEPOSIT','WITHDRAWAL','TRANSFER','PAYMENT','WIRE','CASH_WITHDRAWAL']
            .map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (INR)" />
        <select value={country} onChange={e => setCountry(e.target.value)}>
          {['IN','AE','IR','KP','SY','MM','AF','YE','US','GB'].map(c =>
            <option key={c} value={c}>{c}{['AE','IR','KP','SY','MM','AF','YE'].includes(c) ? ' — high risk' : ''}</option>)}
        </select>
        <button onClick={post} disabled={busy || !amount}>{busy ? 'Posting…' : 'Post'}</button>
      </div>
      {error && <p className="error">{error}</p>}
    </>
  )
}

function band(score: number) {
  if (score >= 85) return 'critical'
  if (score >= 70) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`tile ${accent ? 'accent' : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
