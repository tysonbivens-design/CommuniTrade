'use client'
import { useState, useEffect } from 'react'
import { useSupabase } from '@/lib/useSupabase'
import type { Notification, AppCtx } from '@/types'

const TYPE_ICONS: Record<Notification['type'], string> = {
  loan_request: '📬',
  loan_approved: '✅',
  loan_due: '⏰',
  loan_overdue: '🚨',
  barter_match: '🤝',
  review: '⭐',
  flag: '🚩',
}

interface NotificationsPageProps {
  ctx: AppCtx
  onRead: () => void
}

function timeAgo(d: string): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationsPage({ ctx, onRead }: NotificationsPageProps) {
  const { user, showToast, navigate } = ctx
  const supabase = useSupabase()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) return

    async function load() {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error) setNotifs((data as Notification[]) || [])
      setLoading(false)

      // Mark all as read
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)

      onRead()
    }

    load()
  }, [userId])

  async function clearAll() {
    await supabase.from('notifications').delete().eq('user_id', userId!)
    setNotifs([])
    onRead()
    showToast('Notifications cleared')
  }

  if (!userId) {
    return (
      <div className="container">
        <div className="section" style={{ textAlign: 'center', padding: '5rem' }}>
          <h2>Sign in to view notifications</h2>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="container">
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 className="section-title" style={{ marginBottom: '0.35rem' }}>Notifications</h1>
              <p className="section-subtitle" style={{ marginBottom: 0 }}>Updates on your loans, trades, and matches</p>
            </div>
            {notifs.length > 0 && (
              <button className="btn btn-outline btn-sm" onClick={clearAll}>Clear All</button>
            )}
          </div>

          {loading ? (
            <p style={{ color: 'var(--muted)' }}>Loading…</p>
          ) : notifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔔</div>
              <h3 style={{ fontFamily: 'Fraunces, serif', marginBottom: '0.5rem' }}>All caught up!</h3>
              <p>Notifications will appear here as your community activity grows.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {notifs.map(n => (
                <div key={n.id} style={{
                  background: '#fff', borderRadius: 10, padding: '1rem 1.25rem',
                  border: `1px solid ${n.read ? 'var(--border)' : 'var(--rust)'}`,
                  borderLeft: n.read ? '1px solid var(--border)' : '4px solid var(--rust)',
                  display: 'flex', gap: '1rem', alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{TYPE_ICONS[n.type] || '🔔'}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.88rem', fontWeight: 500, marginBottom: '0.15rem' }}>{n.title}</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.5 }}>{n.body}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{timeAgo(n.created_at)}</p>
                      {(n.type === 'loan_request' || n.type === 'loan_approved' || n.type === 'loan_due' || n.type === 'loan_overdue') && (
                        <button className="btn btn-outline btn-sm" onClick={() => navigate('loans')} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
                          View Loans →
                        </button>
                      )}
                      {(n.type === 'barter_match') && (
                        <button className="btn btn-outline btn-sm" onClick={() => navigate('barter')} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
                          View Match →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
