'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'

const TYPE_ICONS: Record<string, string> = {
  loan_request: '📬', loan_approved: '✅', loan_due: '⏰', loan_overdue: '🚨',
  barter_match: '🤝', review: '⭐', flag: '🚩'
}

export default function NotificationsPage({ ctx, onRead }: any) {
  const { user, showToast } = ctx
  const [notifs, setNotifs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifs(data || [])
    setLoading(false)
    // Mark all as read
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    onRead()
  }

  function timeAgo(d: string) {
    const diff = (Date.now() - new Date(d).getTime()) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
    return `${Math.floor(diff/86400)}d ago`
  }

  if (!user) return <div className="container"><div className="section" style={{ textAlign: 'center', padding: '5rem' }}><h2>Sign in to view notifications</h2></div></div>

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="container">
        <div className="section">
          <h1 className="section-title">Notifications</h1>
          <p className="section-subtitle">Updates on your loans, trades, and matches</p>

          {loading ? <p style={{ color: 'var(--muted)' }}>Loading…</p> :
            notifs.length === 0 ? (
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
                    display: 'flex', gap: '1rem', alignItems: 'flex-start'
                  }}>
                    <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{TYPE_ICONS[n.type] || '🔔'}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.88rem', fontWeight: 500, marginBottom: '0.15rem' }}>{n.title}</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.5 }}>{n.body}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.35rem' }}>{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}
