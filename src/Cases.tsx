import { useCallback, useEffect, useState } from 'react'
import {
  assignCase, disposeCase, fetchCaseAudit, fetchCases,
  type AuditEntry, type CaseView, type Credentials, type Disposition,
} from './api'

const DISPOSITIONS: Disposition[] = ['FALSE_POSITIVE', 'CLEARED', 'ESCALATED_TO_SAR']

const time = (iso: string) => new Date(iso).toLocaleString()
const pretty = (s: string) => s.replaceAll('_', ' ').toLowerCase()

/**
 * The investigation half of the workflow. Detection produces alerts; a case is the analyst
 * bundling them into one decision, and the audit trail is what makes that decision defensible.
 */
export default function Cases({ credentials }: { credentials: Credentials }) {
  const [cases, setCases] = useState<CaseView[]>([])
  const [open, setOpen] = useState<CaseView | null>(null)
  const [trail, setTrail] = useState<AuditEntry[]>([])
  const [assignee, setAssignee] = useState('admin')
  const [disposition, setDisposition] = useState<Disposition>('CLEARED')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      setCases(await fetchCases(credentials))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [credentials])

  useEffect(() => { void reload() }, [reload])

  const select = async (c: CaseView) => {
    setOpen(c)
    setError('')
    setReason('')
    setTrail(await fetchCaseAudit(c.caseRef, credentials))
  }

  const run = async (action: () => Promise<CaseView>) => {
    setError('')
    try {
      const updated = await action()
      setOpen(updated)
      setTrail(await fetchCaseAudit(updated.caseRef, credentials))
      await reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const decided = open?.disposition != null

  return (
    <>
      <section className="panel">
        <h2>Cases <small>investigations opened from the alert queue</small></h2>
        {error && <p className="error">{error}</p>}
        <table>
          <thead>
            <tr><th>Case</th><th>Customer</th><th>Status</th><th>Priority</th><th>Assigned</th><th>Alerts</th><th>Opened</th></tr>
          </thead>
          <tbody>
            {cases.map(c => (
              <tr key={c.caseRef} onClick={() => void select(c)} className={open?.caseRef === c.caseRef ? 'active' : ''}>
                <td>{c.caseRef}</td>
                <td>{c.customerRef}</td>
                <td><span className={`score ${c.status === 'ESCALATED_TO_SAR' ? 'critical' : c.status === 'CLOSED' ? 'low' : 'medium'}`}>{pretty(c.status)}</span></td>
                <td>{c.priority}</td>
                <td>{c.assignedTo ?? '—'}</td>
                <td>{c.alertRefs.length}</td>
                <td>{time(c.openedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {cases.length === 0 && (
          <p className="empty">No cases yet. Select alerts in the Alerts tab and open one.</p>
        )}
      </section>

      {open && (
        <section className="panel detail">
          <h2>{open.caseRef} <small>{pretty(open.status)}</small>
            <button className="close" onClick={() => setOpen(null)}>close</button>
          </h2>
          <div className="meta">
            <span><b>Customer</b> {open.customerRef}</span>
            <span><b>Priority</b> {open.priority}</span>
            <span><b>Assigned</b> {open.assignedTo ?? 'nobody'}</span>
            <span><b>Alerts</b> {open.alertRefs.join(', ')}</span>
          </div>

          {decided ? (
            <p className="explanation">
              Disposed as <b>{pretty(open.disposition!)}</b> by {open.disposedBy} on {time(open.disposedAt!)}.
              <br />{open.dispositionReason}
            </p>
          ) : (
            <>
              <h3>Assign</h3>
              <div className="sim-form">
                <input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="who should work this case" />
                <button onClick={() => void run(() => assignCase(open.caseRef, assignee, credentials))}>
                  Assign
                </button>
              </div>

              <h3>Decide</h3>
              <div className="sim-form">
                <select value={disposition} onChange={e => setDisposition(e.target.value as Disposition)}>
                  {DISPOSITIONS.map(d => <option key={d} value={d}>{pretty(d)}</option>)}
                </select>
                <input value={reason} onChange={e => setReason(e.target.value)}
                       placeholder="why (required, goes on the record)" />
                <button disabled={!reason.trim()}
                        onClick={() => void run(() => disposeCase(open.caseRef, disposition, reason, credentials))}>
                  Dispose
                </button>
              </div>
              <p className="hint">
                A decision is final. The reason is mandatory because a disposition without one is
                not auditable, and it is copied onto every alert the case bundles.
              </p>
            </>
          )}

          <h3>Audit trail</h3>
          <table>
            <thead><tr><th>When</th><th>What</th><th>From</th><th>To</th><th>Who</th><th>Why</th></tr></thead>
            <tbody>
              {trail.map((e, i) => (
                <tr key={i}>
                  <td>{time(e.occurredAt)}</td>
                  <td>{e.entityType} {e.entityRef}</td>
                  <td>{e.fromStatus ?? '—'}</td>
                  <td>{e.toStatus}</td>
                  <td>{e.actor}</td>
                  <td>{e.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            The trail is append-only. A database trigger rejects any update or delete on it.
          </p>
        </section>
      )}
    </>
  )
}
