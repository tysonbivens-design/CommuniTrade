'use client'
import { useState, useEffect } from 'react'
import { useSupabase } from '@/lib/useSupabase'
import ItemCard from './ItemCard'
import styles from './ProfilePage.module.css'
import type { Item, AppCtx } from '@/types'

const COLORS = ['#C4622D', '#5A7A5C', '#D4A843', '#6B4C3B', '#8B5CF6', '#059669', '#0EA5E9', '#EC4899']

interface Review {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer: { full_name: string | null; avatar_color: string | null } | null
}

interface ProfileStats {
  shared: number
  loans: number
  trades: number
}

interface ProfilePageProps {
  ctx: AppCtx
  onProfileUpdate: (uid: string) => void
}

export default function ProfilePage({ ctx, onProfileUpdate }: ProfilePageProps) {
  const { user, profile, showToast } = ctx
  const supabase = useSupabase()
  const [tab, setTab] = useState<'inventory' | 'reviews'>('inventory')
  const [items, setItems] = useState<Item[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ProfileStats>({ shared: 0, loans: 0, trades: 0 })
  const [editColor, setEditColor] = useState(false)

  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) return
    loadAll(userId)
  }, [userId])

  async function loadAll(uid: string) {
    const [itemsResult, reviewsResult, loansResult] = await Promise.all([
      supabase
        .from('items')
        .select('*, profiles(full_name, trust_score, avatar_color, lat, lng)')
        .eq('user_id', uid)
        .order('created_at', { ascending: false }),

      supabase
        .from('reviews')
        .select('*, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_color)')
        .eq('reviewee_id', uid)
        .order('created_at', { ascending: false }),

      supabase
        .from('loans')
        .select('*', { count: 'exact', head: true })
        .eq('lender_id', uid)
        .eq('status', 'returned'),
    ])

    if (!itemsResult.error) setItems((itemsResult.data as Item[]) || [])
    if (!reviewsResult.error) setReviews((reviewsResult.data as Review[]) || [])
    setStats({
      shared: itemsResult.data?.length || 0,
      loans: loansResult.count || 0,
      trades: 0,
    })
  }

  async function deleteItem(item: Item) {
    if (!userId) return
    if (item.status === 'loaned') {
      showToast('Cannot remove an item that is currently on loan', 'error')
      return
    }
    if (!window.confirm(`Remove "${item.title}" from your inventory?`)) return
    const { error } = await supabase.from('items').delete().eq('id', item.id)
    if (error) { showToast(error.message, 'error'); return }
    setItems(prev => prev.filter(i => i.id !== item.id))
    setStats(s => ({ ...s, shared: s.shared - 1 }))
    showToast('Item removed')
  }

  async function updateColor(color: string) {
    if (!userId) return
    const { error } = await supabase.from('profiles').update({ avatar_color: color }).eq('id', userId)
    if (error) { showToast(error.message, 'error'); return }
    setEditColor(false)
    showToast('Profile updated!')
    onProfileUpdate(userId)
  }

  if (!userId) {
    return (
      <div className="container">
        <div className="section" style={{ textAlign: 'center', padding: '5rem' }}>
          <h2>Sign in to view your profile</h2>
        </div>
      </div>
    )
  }

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
              <p className={styles.meta}>
                📍 Zip {profile?.zip_code} · Member since {new Date(profile?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
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
            <button className={`tab ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>
              My Inventory ({items.length})
            </button>
            <button className={`tab ${tab === 'reviews' ? 'active' : ''}`} onClick={() => setTab('reviews')}>
              Reviews ({reviews.length})
            </button>
          </div>

          {tab === 'inventory' && (
            items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📦</div>
                <p>You haven't added any items yet. Head to the Library to add your first!</p>
              </div>
            ) : (
              <div className="grid-4">
                {items.map(item => (
                  <div key={item.id} style={{ position: 'relative' }}>
                    <ItemCard item={item} onBorrow={() => {}} onFlag={() => {}} />
                    <button
                      onClick={() => deleteItem(item)}
                      style={{
                        position: 'absolute', top: '0.5rem', left: '0.5rem',
                        background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.72rem',
                        cursor: 'pointer', zIndex: 2,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
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
                      <span className="avatar" style={{ background: r.reviewer?.avatar_color || '#C4622D', width: 28, height: 28, fontSize: '0.72rem' }}>
                        {r.reviewer?.full_name?.[0]}
                      </span>
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
