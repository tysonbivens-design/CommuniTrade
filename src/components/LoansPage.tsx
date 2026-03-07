'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import styles from './LoansPage.module.css'
import modalStyles from './Modal.module.css'
import type { Loan, LoanRequest, AppCtx } from '@/types'

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LoansPage({ ctx }: { ctx: AppCtx }) {
  const { user, showToast } = ctx
  const supabase = createBrowserClient()

  const [tab, setTab] = useState<'requests' | 'lent' | 'borrowed'>('requests')
  const [requests, setRequests] = useState<LoanRequest[]>([])
  const [lent, setLent] = useState<Loan[]>([])
  const [borrowed, setBorrowed] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewLoan, setReviewLoan] = useState<Loan | null>(null)

  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function loadAll() {
      setLoading(true)
      setError(null)

      const [reqResult, lentResult, borrowedResult] = await Promise.all([
        supabase
          .from('loan_requests')
          .select('*, items(id, title, category, user_id), profiles:requester_id(full_name, email, trust_score, avatar_color)')
          .eq('status', 'pending'),

        supabase
          .from('loans')
          .select('*, items(id, title, category), borrower:profiles!loans_borrower_id_fkey(full_name, avatar_color)')
          .eq('lender_id', userId)
          .in('status', ['active', 'overdue']),

        supabase
          .from('loans')
          .select('*, items(id, title, category), lender:profiles!loans_lender_id_fkey(full_name, avatar_color)')
          .eq('borrower_id', userId)
          .in('status', ['active', 'overdue']),
      ])

      if (cancelled) return

      if (reqResult.error || lentResult.error || borrowedResult.error) {
        setError('Could not load loans. Please try refreshing.')
        setLoading(false)
        return
      }

      // Filter requests to only those for items this user owns
      const myRequests = (reqResult.data as LoanRequest[]).filter(r => r.items?.user_id === userId)

      setRequests(myRequests)
      setLent(lentResult.data as Loan[])
      setBorrowed(borrowedResult.data as Loan[])
      setLoading(false)
    }

    loadAll()
    return () => { cancelled = true }
  }, [userId])

  async function approveRequest(req: LoanRequest) {
    if (!userId || !req.items) return
    const dueAt = new Date()
    dueAt.setDate(dueAt.getDate() + req.duration_days)

    const { error } = await supabase.from('loans').insert({
      item_id: req.item_id, lender_id: userId, borrower_id: req.requester_id,
      request_id: req.id, duration_days: req.duration_days,
      due_at: dueAt.toISOString(), status: 'active',
    })
    if (error) { showToast(error.message, 'error'); return }

    await Promise.all([
      supabase.from('loan_requests').update({ status: 'approved' }).eq('id', req.id),
      supabase.from('items').update({ status: 'loaned' }).eq('id', req.item_id),
      supabase.from('notifications').insert({
        user_id: req.requester_id, type: 'loan_approved',
        title: 'Borrow Request Approved! ✅',
        body: `Your request to borrow "${req.items.title}" was approved. Due back in ${req.duration_days} days.`,
      }),
    ])

    fetch('/api/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'loan_approved',
        item: req.items,
        borrowerId: req.requester_id,
        lenderId: userId,
        dueDate: dueAt.toLocaleDateString(),
      }),
    }).catch(() => {})

    showToast('Request approved! ✅')
    setRequests(r => r.filter(x => x.id !== req.id))

    // Reload lent list so new loan appears immediately
    const { data } = await supabase
      .from('loans')
      .select('*, items(id, title, category), borrower:profiles!loans_borrower_id_fkey(full_name, avatar_color)')
      .eq('lender_id', userId)
      .in('status', ['active', 'overdue'])
    if (data) setLent(data as Loan[])
  }

  async function declineRequest(req: LoanRequest) {
    const { error } = await supabase.from('loan_requests').update({ status: 'declined' }).eq('id', req.id)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Request declined')
    setRequests(r => r.filter(x => x.id !== req.id))
  }

  async function lenderConfirmReturn(loan: Loan) {
    if (!userId) return

    const { error: loanErr } = await supabase
      .from('loans')
      .update({ status: 'returned', returned_at: new Date().toISOString(), lender_confirmed_return: true })
      .eq('id', loan.id)
    if (loanErr) { showToast(loanErr.message, 'error'); return }

    const { error: itemErr } = await supabase
      .from('items')
      .update({ status: 'available' })
      .eq('id', loan.item_id)
    if (itemErr) { showToast(itemErr.message, 'error'); return }

    showToast('Return confirmed! Item is available again ✅')
    setReviewLoan(loan)
    setLent(l => l.filter(x => x.id !== loan.id))
  }

  async function borrowerMarkReturned(loan: Loan) {
    if (!userId) return

    const { error } = await supabase
      .from('loans')
      .update({ borrower_confirmed_return: true })
      .eq('id', loan.id)
    if (error) { showToast(error.message, 'error'); return }

    // In-app notification for lender
    await supabase.from('notifications').insert({
      user_id: loan.lender_id,
      type: 'loan_request',
      title: 'Item marked as returned 📦',
      body: `The borrower says they've returned "${loan.items?.title}". Please confirm when you have it back.`,
      data: { loan_id: loan.id },
    })

    // Email the lender (fire-and-forget)
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'borrower_returned',
        itemTitle: loan.items?.title,
        lenderId: loan.lender_id,
        borrowerId: userId,
      }),
    }).catch(() => {})

    showToast("Marked as returned — your lender will confirm when they have it back")
    setBorrowed(l => l.map(x => x.id === loan.id ? { ...x, borrower_confirmed_return: true } : x))
  }

  async function sendReminder(loan: Loan) {
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'loan_due_soon',
        itemTitle: loan.items?.title,
        borrowerId: loan.borrower_id,
        dueDate: new Date(loan.due_at).toLocaleDateString(),
      }),
    }).catch(() => {})
    showToast('📨 Reminder email sent!')
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const isOverdue = (dueAt: string) => new Date(dueAt) < new Date()

  if (!userId) {
    return (
      <div className="container">
        <div className="section" style={{ textAlign: 'center', padding: '5rem' }}>
          <h2>Sign in to view your loans</h2>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="container">
        <div className="section">
          <h1 className="section-title">My Loans</h1>
          <p className="section-subtitle">Track everything you've lent and borrowed</p>

          <div className="tabs">
            <button className={`tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
              Pending Requests
              {requests.length > 0 && (
                <span style={{ background: 'var(--rust)', color: '#fff', borderRadius: 10, padding: '0.05rem 0.4rem', fontSize: '0.72rem', marginLeft: '0.3rem' }}>
                  {requests.length}
                </span>
              )}
            </button>
            <button className={`tab ${tab === 'lent' ? 'active' : ''}`} onClick={() => setTab('lent')}>
              Items I've Lent ({lent.length})
            </button>
            <button className={`tab ${tab === 'borrowed' ? 'active' : ''}`} onClick={() => setTab('borrowed')}>
              Items I've Borrowed ({borrowed.length})
            </button>
          </div>

          {loading ? (
            <p style={{ color: 'var(--muted)' }}>Loading…</p>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>⚠️ {error}</div>
          ) : (
            <>
              {tab === 'requests' && (
                requests.length === 0 ? <EmptyState icon="📬" text="No pending borrow requests" /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {requests.map(req => (
                      <div key={req.id} className={styles.requestCard}>
                        <div className={styles.requestInfo}>
                          <span className="avatar" style={{ background: req.profiles?.avatar_color || '#C4622D', width: 36, height: 36 }}>
                            {req.profiles?.full_name?.[0]}
                          </span>
                          <div>
                            <p><strong>{req.profiles?.full_name}</strong> wants to borrow <strong>{req.items?.title}</strong></p>
                            <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                              For {req.duration_days} days · Trust ⭐{req.profiles?.trust_score?.toFixed(1)}
                            </p>
                            {req.message && (
                              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                                "{req.message}"
                              </p>
                            )}
                          </div>
                        </div>
                        <div className={styles.requestActions}>
                          <button className="btn btn-primary btn-sm" onClick={() => approveRequest(req)}>Approve ✅</button>
                          <button className="btn btn-outline btn-sm" onClick={() => declineRequest(req)}>Decline</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {(tab === 'lent' || tab === 'borrowed') && (() => {
                const list = tab === 'lent' ? lent : borrowed
                if (list.length === 0) return <EmptyState icon={tab === 'lent' ? '📤' : '📥'} text={`Nothing ${tab} yet`} />
                return (
                  <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 8px var(--shadow)' }}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>{tab === 'lent' ? 'Borrowed By' : 'Owner'}</th>
                          <th>Due Back</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map(loan => {
                          const overdue = isOverdue(loan.due_at)
                          const person = tab === 'lent' ? loan.borrower : loan.lender
                          return (
                            <tr key={loan.id}>
                              <td><strong>{loan.items?.title}</strong></td>
                              <td>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span className="avatar" style={{ background: person?.avatar_color || '#C4622D', width: 22, height: 22, fontSize: '0.6rem' }}>
                                    {person?.full_name?.[0]}
                                  </span>
                                  {person?.full_name}
                                </span>
                              </td>
                              <td>{formatDate(loan.due_at)}</td>
                              <td>
                                <span className={`badge ${overdue ? 'badge-overdue' : 'badge-loaned'}`}>
                                  {overdue ? '⚠ Overdue' : 'Active'}
                                </span>
                              </td>
                              <td>
                                {tab === 'lent' && overdue && (
                                  <button className="btn btn-primary btn-sm" onClick={() => sendReminder(loan)}>Send Reminder</button>
                                )}
                                {tab === 'lent' && !overdue && (
                                  <button className="btn btn-outline btn-sm" onClick={() => lenderConfirmReturn(loan)}>Confirm Return</button>
                                )}
                                {tab === 'borrowed' && !loan.borrower_confirmed_return && (
                                  <button className="btn btn-outline btn-sm" onClick={() => borrowerMarkReturned(loan)}>I've Returned It</button>
                                )}
                                {tab === 'borrowed' && loan.borrower_confirmed_return && (
                                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Waiting for lender ⏳</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>

      {reviewLoan && (
        <ReviewModal
          loan={reviewLoan}
          userId={userId}
          onClose={() => setReviewLoan(null)}
          onSuccess={() => { setReviewLoan(null); showToast('Review submitted! ⭐') }}
          showToast={showToast}
        />
      )}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <p>{text}</p>
    </div>
  )
}

interface ReviewModalProps {
  loan: Loan
  userId: string
  onClose: () => void
  onSuccess: () => void
  showToast: AppCtx['showToast']
}

function ReviewModal({ loan, userId, onClose, onSuccess, showToast }: ReviewModalProps) {
  const supabase = createBrowserClient()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const revieweeId = loan.lender_id === userId ? loan.borrower_id : loan.lender_id

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('reviews').insert({
        reviewer_id: userId, reviewee_id: revieweeId, loan_id: loan.id, rating, comment,
      })
      if (error) throw error
      onSuccess()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not submit review', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={modalStyles.modal}>
        <button className={modalStyles.close} onClick={onClose}>✕</button>
        <h2 className={modalStyles.title}>Leave a Review ⭐</h2>
        <p className={modalStyles.subtitle}>Help the community know who to trust</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">Rating</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setRating(n)}
                  style={{ background: 'none', border: 'none', fontSize: '1.8rem', cursor: 'pointer', opacity: n <= rating ? 1 : 0.3, transition: 'opacity 0.2s' }}>
                  ⭐
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="label">Comment (optional)</label>
            <textarea className="input" rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="How did the exchange go?" />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  )
}
