'use client'
import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import modalStyles from './Modal.module.css'
import type { AppCtx } from '@/types'

interface ReportUserModalProps {
  reportedUserId: string
  reportedName: string
  reporterId: string
  onClose: () => void
  onSuccess: () => void
  showToast: AppCtx['showToast']
}

const REASONS = [
  { value: 'no_return',      label: "Didn't return a borrowed item" },
  { value: 'scam',           label: 'Scam or fraudulent listing' },
  { value: 'harassment',     label: 'Harassment or abusive behaviour' },
  { value: 'fake_listing',   label: 'Repeatedly posting fake/unavailable items' },
  { value: 'other',          label: 'Other' },
]

export default function ReportUserModal({
  reportedUserId, reportedName, reporterId, onClose, onSuccess, showToast
}: ReportUserModalProps) {
  const supabase = createBrowserClient()
  const [reason, setReason] = useState('no_return')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('user_flags').insert({
        reported_user_id: reportedUserId,
        reporter_id: reporterId,
        reason,
        notes: notes.trim() || null,
      })
      if (error) {
        // Unique constraint = already reported this person
        if (error.code === '23505') {
          showToast("You've already reported this user.", 'error')
          onClose()
          return
        }
        throw error
      }

      // If this triggered auto-suspend (3 flags), the DB trigger handles it.
      // Fire-and-forget admin email notification check.
      // We can't know here if it just hit 3 — the notify is handled by the DB trigger
      // which fires the in-app notification. The email goes via a separate webhook if needed.

      onSuccess()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not submit report', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={modalStyles.modal}>
        <button className={modalStyles.close} onClick={onClose}>✕</button>
        <h2 className={modalStyles.title}>Report User</h2>
        <p className={modalStyles.subtitle}>
          Reporting <strong>{reportedName}</strong>. Reports are reviewed by our admin team.
        </p>

        <div style={{
          background: '#FFF8E7', border: '1px solid #F5C842', borderRadius: 8,
          padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#7A5800',
        }}>
          ⚠️ Only report genuine violations. Repeated false reports may result in action against your account.
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">Reason</label>
            <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
              {REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Additional details (optional)</label>
            <textarea
              className="input" rows={3} value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any context that helps us investigate…"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  )
}
