import { useEffect, useState } from 'react'
import {
  fetchAlert, fetchAlerts, fetchSummary, fetchTimeline,
  type Alert, type Credentials, type Summary, type Transaction,
} from './api'
import './App.css'

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

  const load = (c: Credentials) =>
    Promise.all([fetchSummary(c), fetchAlerts(c)])
      .then(([s, a]) => { setSummary(s); setAlerts(a); setCredentials(c); setError('') })
      .catch((e: Error) => setError(e.message))

  useEffect(() => { if (credentials) { const id = setInterval(() => load(credentials), 15000); return () => clearInterval(id) } }, [credentials])

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

  return (
    <div className="app">
      <header>
        <h1>Sentinel <span>AML</span></h1>
        <div className="who">{credentials.username}<button onClick={() => { setCredentials(null); setSelected(null) }}>sign out</button></div>
      </header>

      {summary && (
        <section className="tiles">
          <Tile label="Open alerts" value={summary.openAlerts} accent />
          <Tile label="Total alerts" value={summary.totalAlerts} />
          <Tile label="Transactions" value={summary.totalTransactions} />
          <Tile label="Accounts" value={summary.totalAccounts} />
          <Tile label="Customers" value={summary.totalCustomers} />
        </section>
      )}

      {summary && (
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

      <section className="panel">
        <h2>Alert queue <small>highest risk first</small></h2>
        <table>
          <thead>
            <tr><th>Score</th><th>Severity</th><th>Rule</th><th>Customer</th><th>Account</th><th>Evidence</th><th>Detected</th></tr>
          </thead>
          <tbody>
            {alerts.map(alert => (
              <tr key={alert.alertRef} onClick={() => openAlert(alert)} className={selected?.alertRef === alert.alertRef ? 'active' : ''}>
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
        {alerts.length === 0 && <p className="empty">No alerts yet. Ingest transactions to trigger detection.</p>}
      </section>

      {selected && (
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
    </div>
  )
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`tile ${accent ? 'accent' : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
