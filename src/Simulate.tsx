import { useEffect, useState } from 'react'
import { createCustomer, fetchSimAccounts, runScenario,
         type Credentials, type ScenarioResult, type SimAccount } from './api'

const SCENARIOS = [
  { key: 'STRUCTURING',            label: 'Structuring',        hint: '3 deposits just under the threshold, 24h' },
  { key: 'RAPID_MOVEMENT',         label: 'Rapid movement',     hint: '₹200k in, ₹180k out within 48h' },
  { key: 'HIGH_RISK_JURISDICTION', label: 'High-risk wire',     hint: '₹25k to a sanctioned jurisdiction' },
  { key: 'LARGE_TRANSACTION',      label: 'Large transaction',  hint: '₹75k, above the reporting threshold' },
  { key: 'ROUND_NUMBER',           label: 'Round numbers',      hint: '3 exact multiples of ₹10,000' },
]

const inr = (v: number) => new Intl.NumberFormat('en-IN',
  { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)

export default function Simulate({ credentials, onChanged }:
  { credentials: Credentials; onChanged: () => void }) {

  const [accounts, setAccounts] = useState<SimAccount[]>([])
  const [selected, setSelected] = useState('')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [pep, setPep] = useState(false)
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const loadAccounts = () =>
    fetchSimAccounts(credentials).then(a => {
      setAccounts(a)
      if (!selected && a.length) setSelected(a[a.length - 1].accountRef)
    }).catch((e: Error) => setError(e.message))

  useEffect(() => { loadAccounts() }, [])

  const create = async () => {
    if (!first.trim()) return setError('Enter a first name')
    setBusy('create'); setError('')
    try {
      const made = await createCustomer(first.trim(), last.trim() || 'Kumar', pep, credentials)
      setAccounts(a => [...a, made])
      setSelected(made.accountRef)
      setFirst(''); setLast(''); setPep(false)
      onChanged()
    } catch (e) { setError((e as Error).message) } finally { setBusy('') }
  }

  const fire = async (scenario: string) => {
    setBusy(scenario); setError(''); setResult(null)
    try {
      setResult(await runScenario(selected, scenario, credentials))
      onChanged()
    } catch (e) { setError((e as Error).message) } finally { setBusy('') }
  }

  return (
    <>
      <section className="panel">
        <h2>Create a customer <small>everything else is filled in for you</small></h2>
        <div className="sim-form">
          <input value={first} onChange={e => setFirst(e.target.value)} placeholder="First name" />
          <input value={last} onChange={e => setLast(e.target.value)} placeholder="Last name" />
          <label className="check">
            <input type="checkbox" checked={pep} onChange={e => setPep(e.target.checked)} />
            Politically exposed
          </label>
          <button onClick={create} disabled={busy === 'create'}>
            {busy === 'create' ? 'Creating…' : 'Create customer + account'}
          </button>
        </div>
        <p className="hint">A politically exposed customer is rated HIGH risk, which lifts every alert score.</p>
      </section>

      <section className="panel">
        <div className="sim-form">
          <select value={selected} onChange={e => setSelected(e.target.value)}>
            {accounts.map(a => (
              <option key={a.accountRef} value={a.accountRef}>
                {a.name} — {a.accountRef}{a.politicallyExposed ? ' (PEP)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="scenarios">
          {SCENARIOS.map(s => (
            <button key={s.key} className="scenario" onClick={() => fire(s.key)}
                    disabled={!selected || busy === s.key}>
              <strong>{busy === s.key ? 'Running…' : s.label}</strong>
              <span>{s.hint}</span>
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <section className="panel">
          <h2>{result.scenario.replaceAll('_', ' ').toLowerCase()} <small>transactions posted, in order</small></h2>
          <table>
            <thead><tr><th>Txn</th><th>Direction</th><th>Amount</th><th>Country</th></tr></thead>
            <tbody>
              {result.steps.map(s => (
                <tr key={s.txnRef}>
                  <td>{s.txnRef}</td>
                  <td className={s.direction.toLowerCase()}>{s.direction}</td>
                  <td>{inr(s.amount)}</td>
                  <td>{s.country}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            Watch the order: the pattern only becomes visible once enough of it has happened.
          </p>
        </section>
      )}
    </>
  )
}
