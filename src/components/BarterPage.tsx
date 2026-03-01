'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import modalStyles from './Modal.module.css'
import styles from './BarterPage.module.css'

const CATEGORIES = ['Skills & Services', 'Food & Garden', 'Home Goods', 'Electronics', 'Clothing', 'Media', 'Other']

// Haversine formula — calculates miles between two lat/lng points
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function BarterPage({ ctx }: any) {
  const { user, profile, showToast, requireAuth } = ctx
  const [posts, setPosts] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => { loadPosts() }, [tab, profile?.radius_miles])

  async function loadPosts() {
    setLoading(true)
    const { data } = await supabase
      .from('barter_posts')
      .select('*, profiles(full_name, trust_score, avatar_color, lat, lng)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    let results = data || []

    // Filter by radius if logged in and we have coordinates
    if (user && profile?.lat && profile?.lng && profile?.radius_miles) {
      results = results.filter(post => {
        if (post.user_id === user.id) return true
        if (!post.profiles?.lat || !post.profiles?.lng) return true
        const miles = distanceMiles(profile.lat, profile.lng, post.profiles.lat, post.profiles.lng)
        return miles <= profile.radius_miles
      })
    }

    setPosts(results)

    if (user) {
      const { data: m } = await supabase
        .from('barter_matches')
        .select('*, post_a:barter_posts!post_a_id(*, profiles(full_name, avatar_color)), post_b:barter_posts!post_b_id(*, profiles(full_name, avatar_color))')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .eq('status', 'pending')
      setMatches(m || [])
    }
    setLoading(false)
  }

  const displayPosts = tab === 'matches' ? [] : posts
  const radiusNote = user && profile?.radius_miles
    ? `Showing trades within ${profile.radius_miles} miles of you`
    : 'Post what you have, find what you need. Matches happen automatically.'

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="container">
        <div className="section">
          <div className={styles.header}>
            <div>
              <h1 className="section-title">Barter Board</h1>
              <p className="section-subtitle">{radiusNote}</p>
            </div>
            <button className="btn btn-primary" onClick={() => requireAuth(() => setShowAdd(true))}>+ Post a Trade</button>
          </div>

          <div className="tabs">
            <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All Posts</button>
            {user && (
              <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>
                🔥 My Matches {matches.length > 0 && <span style={{ background: 'var(--rust)', color: '#fff', borderRadius: 10, padding: '0.1rem 0.4rem', fontSize: '0.72rem', marginLeft: '0.3rem' }}>{matches.length}</span>}
              </button>
            )}
            {CATEGORIES.map(c => (
              <button key={c} className={`tab ${tab === c ? 'active' : ''}`} onClick={() => setTab(c)}>{c}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
          ) : tab === 'matches' ? (
            <div className={styles.grid}>
              {matches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', gridColumn: '1/-1' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🤝</div>
                  <p>No matches yet. Post a trade and we'll alert you when someone's a fit!</p>
                </div>
              ) : matches.map(m => {
                const myPost = m.user_a_id === user?.id ? m.post_a : m.post_b
                const theirPost = m.user_a_id === user?.id ? m.post_b : m.post_a
                return (
                  <div key={m.id} className={styles.matchCard}>
                    <div className={styles.matchBanner}>🎯 Barter Match!</div>
                    <div className={styles.sides}>
                      <div className={styles.side}>
                        <div className={styles.sideLabel} style={{ color: 'var(--sage)' }}>You Offer</div>
                        <div className={styles.sideContent}>{myPost?.have_description}</div>
                      </div>
                      <div className={styles.arrow}>⇄</div>
                      <div className={styles.side}>
                        <div className={styles.sideLabel} style={{ color: 'var(--rust)' }}>They Offer</div>
                        <div className={styles.sideContent}>{theirPost?.have_description}</div>
                      </div>
                    </div>
                    <div className={styles.matchFooter}>
                      <span>with <strong>{theirPost?.profiles?.full_name}</strong></span>
                      <button className="btn btn-primary btn-sm" onClick={() => showToast('📬 Connection request sent!')}>Connect</button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={styles.grid}>
              {(tab === 'all' ? displayPosts : displayPosts.filter(p => p.have_category === tab || p.want_category === tab)).map(post => (
                <BarterCard key={post.id} post={post} user={user} showToast={showToast} />
              ))}
              {displayPosts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', gridColumn: '1/-1' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
                  <p>
                    {user && profile?.radius_miles
                      ? `No trades within ${profile.radius_miles} miles. Try increasing your radius by clicking the 📍 location pill above.`
                      : 'No trades posted yet. Be the first!'
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddBarterModal
          user={user}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); loadPosts(); showToast('Trade posted! We\'ll notify you of matches 🤝') }}
          showToast={showToast}
        />
      )}
    </div>
  )
}

function BarterCard({ post, user, showToast }: any) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="avatar" style={{ background: post.profiles?.avatar_color || '#C4622D' }}>
            {post.profiles?.full_name?.[0] || '?'}
          </span>
          <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>{post.profiles?.full_name}</span>
          <span className="trust">⭐{post.profiles?.trust_score?.toFixed(1) || '5.0'}</span>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => showToast('📬 Message sent!')}>Message</button>
      </div>
      <div className={styles.sides}>
        <div className={styles.side}>
          <div className={styles.sideLabel} style={{ color: 'var(--sage)' }}>Has / Offers</div>
          <div className={styles.sideContent}>{post.have_description}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{post.have_category}</div>
        </div>
        <div className={styles.arrow}>⇄</div>
        <div className={styles.side}>
          <div className={styles.sideLabel} style={{ color: 'var(--rust)' }}>Wants / Seeks</div>
          <div className={styles.sideContent}>{post.want_description}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{post.want_category}</div>
        </div>
      </div>
      {post.notes && <p style={{ fontSize: '0.83rem', color: 'var(--muted)', marginTop: '0.75rem', fontStyle: 'italic' }}>{post.notes}</p>}
    </div>
  )
}

function AddBarterModal({ user, onClose, onSuccess, showToast }: any) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ have_description: '', have_category: 'Skills & Services', want_description: '', want_category: 'Skills & Services', notes: '' })
  const supabase = createBrowserClient()
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: any) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.from('barter_posts').insert({ user_id: user.id, ...form }).select().single()
      if (error) throw error
      await fetch('/api/barter-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: data.id })
      })
      onSuccess()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={modalStyles.modal}>
        <button className={modalStyles.close} onClick={onClose}>✕</button>
        <h2 className={modalStyles.title}>Post a Trade</h2>
        <p className={modalStyles.subtitle}>We'll match you automatically with neighbors who have/want what you do</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">I Have / Can Offer *</label>
            <input className="input" value={form.have_description} onChange={set('have_description')} placeholder="e.g. Guitar lessons, fresh eggs, sourdough starter…" required />
          </div>
          <div className="form-group">
            <label className="label">Category</label>
            <select className="input" value={form.have_category} onChange={set('have_category')}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">I'm Looking For *</label>
            <input className="input" value={form.want_description} onChange={set('want_description')} placeholder="e.g. Dog walking, homemade jam, vinyl records…" required />
          </div>
          <div className="form-group">
            <label className="label">Category</label>
            <select className="input" value={form.want_category} onChange={set('want_category')}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Extra Details</label>
            <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} placeholder="Any specifics that help neighbors understand…" />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Post Trade & Find Matches'}
          </button>
        </form>
      </div>
    </div>
  )
}
