'use client'
import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import modalStyles from './Modal.module.css'
import { useScrollLock } from '@/lib/useScrollLock'
import type { Item, AppCtx } from '@/types'

interface BorrowModalProps {
  item: Item
  userId: string
  onClose: () => void
  onSuccess: () => void
  showToast: AppCtx['showToast']
}

export default function BorrowModal({ item, userId, onClose, onSuccess, showToast }: BorrowModalProps) {
  useScrollLock()
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [duration, setDuration] = useState(14)
  const [message, setMessage] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [agreed, setAgreed] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const fullMessage = [message, contactInfo ? `📞 Additional contact: ${contactInfo}` : ''].filter(Boolean).join('\n\n')
      const { error } = await supabase.from('loan_requests').insert({
        item_id: item.id, requester_id: userId, duration_days: duration, message: fullMessage || null, status: 'pending',
      })
      if (error) throw error

      await supabase.from('notifications').insert({
        user_id: item.user_id,
        type: 'loan_request',
        title: 'New Borrow Request',
        body: `Someone wants to borrow your "${item.title}" for ${duration} days.`,
        data: { item_id: item.id, requester_id: userId },
      })

      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'loan_request', item, duration, lenderId: item.user_id, requesterId: userId }),
      }).catch(() => {})

      onSuccess()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not send request', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={modalStyles.modal}>
        <button className={modalStyles.close} onClick={onClose}>✕</button>
        <h2 className={modalStyles.title}>Request to Borrow</h2>
        <p className={modalStyles.subtitle}>"{item.title}" from {item.profiles?.full_name?.split(' ')[0]}</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">How long do you need it?</label>
            <select className="input" value={duration} onChange={e => setDuration(Number(e.target.value))}>
              {[7, 14, 21, 30].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Message (optional)</label>
            <textarea className="input" rows={2} value={message} onChange={e => setMessage(e.target.value)} placeholder="Introduce yourself briefly — people appreciate it!" />
          </div>
          <div className="form-group">
            <label className="label">Additional contact info (optional)</label>
            <input className="input" value={contactInfo} onChange={e => setContactInfo(e.target.value)} placeholder="Phone, WhatsApp, etc." />
          </div>
          <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
            📧 Your registered email will be shared with the lender so you can arrange pickup.
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.83rem', color: 'var(--bark)', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ marginTop: '0.15rem', accentColor: 'var(--rust)', flexShrink: 0 }}
            />
            I will return this item in the same condition and understand borrowing is at my own risk.
          </label>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading || !agreed}>
            {loading ? <span className="spinner" /> : 'Send Request 📬'}
          </button>
        </form>
      </div>
    </div>
  )
}
