'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import ItemCard from './ItemCard'
import styles from './ProfilePage.module.css'

const COLORS = ['#C4622D','#5A7A5C','#D4A843','#6B4C3B','#8B5CF6','#059669','#0EA5E9','#EC4899']

export default function ProfilePage({ ctx }: any) {
  const { user, profile, showToast, requireAuth } = ctx
  const [tab, setTab] = useState('inventory')
  const [items, setItems] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [stats, setStats] = useState({ shared: 0, loans: 0, trades: 0 })
  const [editColor, setEditColor] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => { if (user) loadAll() }, [user])

  async function loadAll() {
    const { data: myItems } = await supabase.from('items').select('*, profiles(full_name, trust_score, avatar_color)').eq('user_id', user.id).order('created_at', { ascending: false })
    setItems(myItems || [])
    const { data: myReviews } = await supabase.from('reviews').select('*, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_color)').eq('reviewee_id', user.id).order('created_at', { ascending: false })
    setReviews(myReviews || [])
    const { count: loansCount } = await supabase.from('loans').select('*', { count: 'exact', head: true }).eq('lender_id', user.id).eq('status', 'returned')
    setStats({ shared: myItems?.length || 0, loans: loansCount || 0, trades: 0 })
  }

  async function updateColor(color: string) {
    await supabase.from('profiles').update({ avatar_color: color }).eq('id', user.id)
    setEditColor(false)
    showToast('Profile updated!')
    window.location.reload()
  }

  if (!user) return <div className="container"><div className="section" style={{ textAlign: 'center', padding: '5rem' }}><h2>Sign in to view your profile</h2></div></div>

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className={styles.profileHeader}>
        <div className="container">
          <div className={styles.headerInner}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div className={styles.bigAvatar} style={{ background: profile?.avatar_color || '#C4622D' }}>
                {profile?.full_name?.[0] || 'U'}
              </div>
              <button className={styles.editAvatarBtn} onClick={() => setEditColor(!editColor)}>✏️</button>
              {editColor && (
                <div className={styles.colorPicker}>
                  {COLORS.map(c => (
                    <div key={c} className={styles.colorDot} style={{ background: c }} onClick={() => updateColor(c)} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <h1 className={styles.name}>{profile?.full_name || 'Community Member'}</h1>
              <p className={styles.meta}>📍 Zip {profile?.zip_code} · Member since {new Date(profile?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              <div className={styles.trustRing}>⭐ {profile?.trust_score?.toFixed(1) || '5.0'} Trust Score · {profile?.review_count || 0} reviews</div>
            </div>
            <div className={styles.profileStats}>
              <div className={styles.pStat}><div className={styles.pStatNum}>{stats.shared}</div><div className={styles.pStatLabel}>Items Shared</div></div>
              <div className={styles.pStat}><div className={styles.pStatNum}>{stats.loans}</div><div className={styles.pStatLabel}>Loans Completed</div></div>
              <div className={styles.pStat}><div className={styles.pStatNum}>{stats.trades}</div><div className={styles.pStatLabel}>Trades Made</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="section">
          <div className="tabs">
            <button className={`tab ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>My Inventory ({items.length})</button>
            <button className={`tab ${tab === 'reviews' ? 'active' : ''}`} onClick={() => setTab('reviews')}>Reviews ({reviews.length})</button>
          </div>

          {tab === 'inventory' && (
            items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📦</div>
                <p>You haven't added any items yet. Head to the Library to add your first!</p>
              </div>
            ) : (
              <div className="grid-4">
                {items.map(item => <ItemCard key={item.id} item={item} onBorrow={() => {}} onFlag={() => {}} />)}
              </div>
            )
          )}

          {tab === 'reviews' && (
            reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⭐</div>
                <p>No reviews yet — complete a loan to receive your first!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {reviews.map(r => (
                  <div key={r.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span className="avatar" style={{ background: r.reviewer?.avatar_color || '#C4622D', width: 28, height: 28, fontSize: '0.72rem' }}>{r.reviewer?.full_name?.[0]}</span>
                      <strong style={{ fontSize: '0.9rem' }}>{r.reviewer?.full_name}</strong>
                      <span>{'⭐'.repeat(r.rating)}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginLeft: 'auto' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    {r.comment && <p style={{ fontSize: '0.88rem', color: 'var(--muted)', fontStyle: 'italic' }}>"{r.comment}"</p>}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
