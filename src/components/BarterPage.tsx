'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import Avatar from './Avatar'
import styles from './BarterPage.module.css'
import modalStyles from './Modal.module.css'
import type { BarterPost, BarterMatch, AppCtx } from '@/types'

const BARTER_CATEGORIES = ['Skills & Services', 'Food & Garden', 'Home Goods', 'Electronics', 'Clothing', 'Media', 'Other']

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BarterPage({ ctx }: { ctx: AppCtx }) {
  const { user, profile, showToast, requireAuth } = ctx
  const supabase = createBrowserClient()

  const [posts, setPosts] = useState<BarterPost[]>([])
  const [matches, setMatches] = useState<BarterMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [connectTarget, setConnectTarget] = useState<{ match: BarterMatch } | null>(null)
  const [messageTarget, setMessageTarget] = useState<{ post: BarterPost } | null>(null)

  const userId = user?.id ?? null
  const userLat = profile?.lat ?? null
  const userLng = profile?.lng ?? null
  const radiusMiles = profile?.radius_miles ?? null

  useEffect(() => {
    let cancelled = false

    async function loadPosts() {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('barter_posts')
        .select('*, profiles(full_name, trust_score, avatar_color, avatar_url, lat, lng)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (fetchError) {
        setError('Could not load barter posts. Please try refreshing.')
        setLoading(false)
        return
      }

      let results = (data as BarterPost[]) || []

      if (userId && userLat && userLng && radiusMiles) {
        results = results.filter(post => {
          if (post.user_id === userId) return true
          if (!post.profiles?.lat || !post.profiles?.lng) return true
          return distanceMiles(userLat, userLng, post.profiles.lat, post.profiles.lng) <= radiusMiles
        })
      }

      setPosts(results)

      if (userId) {
        const { data: m, error: matchError } = await supabase
          .from('barter_matches')
          .select('*, post_a:barter_posts!post_a_id(*, profiles(full_name, avatar_color)), post_b:barter_posts!post_b_id(*, profiles(full_name, avatar_color))')
          .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
          .eq('status', 'pending')

        if (!cancelled && !matchError) setMatches(m as BarterMatch[])
      }

      setLoading(false)
    }

    loadPosts()
    return () => { cancelled = true }
  }, [tab, userId, userLat, userLng, radiusMiles])

  const filteredPosts = tab === 'all' || tab === 'matches'
    ? posts
    : posts.filter(p => p.have_category === tab || p.want_category === tab)

  async function removePost(postId: string) {
    if (!userId) return
    if (!window.confirm('Close this trade post? It will be removed from the board.')) return
    const { error } = await supabase.from('barter_posts').update({ status: 'closed' }).eq('id', postId).eq('user_id', userId)
    if (error) { showToast(error.message, 'error'); return }
    setPosts(p => p.filter(x => x.id !== postId))
    showToast('Trade post closed')
  }

  async function dismissMatch(matchId: string) {
    const { error } = await supabase.from('barter_matches').update({ status: 'declined' }).eq('id', matchId)
    if (error) { showToast(error.message, 'error'); return }
    setMatches(m => m.filter(x => x.id !== matchId))
    showToast('Match dismissed')
  }

  async function clearAllMatches() {
    if (!userId) return
    if (!window.confirm('Dismiss all matches? This cannot be undone.')) return
    const { error } = await supabase
      .from('barter_matches')
      .update({ status: 'declined' })
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .eq('status', 'pending')
    if (error) { showToast(error.message, 'error'); return }
    setMatches([])
    showToast('All matches cleared')
  }

  const radiusNote = userId && radiusMiles
    ? `Showing trades within ${radiusMiles} miles of you`
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
            {userId && (
              <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>
                🔥 My Matches
                {matches.length > 0 && (
                  <span style={{ background: 'var(--rust)', color: '#fff', borderRadius: 10, padding: '0.1rem 0.4rem', fontSize: '0.72rem', marginLeft: '0.3rem' }}>
                    {matches.length}
                  </span>
                )}
              </button>
            )}
            {BARTER_CATEGORIES.map(c => (
              <button key={c} className={`tab ${tab === c ? 'active' : ''}`} onClick={() => setTab(c)}>{c}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>⚠️ {error}</div>
          ) : tab === 'matches' ? (
            <MatchesGrid
              matches={matches}
              userId={userId}
              onConnect={(match) => setConnectTarget({ match })}
              onDismiss={dismissMatch}
              onClearAll={clearAllMatches}
            />
          ) : (
            <div className={styles.grid}>
              {filteredPosts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', gridColumn: '1/-1' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
                  <p>
                    {userId && radiusMiles
                      ? `No trades within ${radiusMiles} miles. Try increasing your radius by clicking the 📍 location pill above.`
                      : 'No trades posted yet. Be the first!'}
                  </p>
                </div>
              ) : filteredPosts.map(post => (
                <BarterCard
                  key={post.id}
                  post={post}
                  userId={userId}
                  onRemove={removePost}
                  onMessage={(post) => setMessageTarget({ post })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddBarterModal
          userId={user!.id}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            setTab('all')
            showToast("Trade posted! We'll notify you of matches 🤝")
          }}
          showToast={showToast}
        />
      )}

      {connectTarget && (
        <ContactModal
          title="Connect with your match"
          subtitle={`Your email will be shared. Add extra contact info if you'd like.`}
          ctaText="Connect 🤝"
          onClose={() => setConnectTarget(null)}
          onSubmit={async (contactInfo) => {
            const { match } = connectTarget
            const theirPost = match.user_a_id === userId ? match.post_b : match.post_a
            const theirId = match.user_a_id === userId ? match.user_b_id : match.user_a_id
            if (!userId || !theirId) return
            await fetch('/api/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'barter_message',
                postOwnerId: theirId,
                senderId: userId,
                haveDescription: theirPost?.have_description || '',
                wantDescription: theirPost?.want_description || '',
                contactInfo,
              }),
            })
            setConnectTarget(null)
            showToast('Connected! They will receive your contact info 📬')
          }}
        />
      )}

      {messageTarget && (
        <ContactModal
          title="Message this trader"
          subtitle={`Your email will be shared with ${messageTarget.post.profiles?.full_name?.split(' ')[0]}. Add extra contact info if you'd like.`}
          ctaText="Send Message 📬"
          onClose={() => setMessageTarget(null)}
          onSubmit={async (contactInfo) => {
            const { post } = messageTarget
            await fetch('/api/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'barter_message',
                postOwnerId: post.user_id,
                senderId: userId,
                haveDescription: post.have_description,
                wantDescription: post.want_description,
                contactInfo,
              }),
            })
            setMessageTarget(null)
            showToast('Message sent! Your contact info will be shared 📬')
          }}
        />
      )}
    </div>
  )
}

// ─── Matches Grid ──────────────────────────────────────────────────────────────

interface MatchesGridProps {
  matches: BarterMatch[]
  userId: string | null
  onConnect: (match: BarterMatch) => void
  onDismiss: (matchId: string) => void
  onClearAll: () => void
}

function MatchesGrid({ matches, userId, onConnect, onDismiss, onClearAll }: MatchesGridProps) {
  if (matches.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🤝</div>
        <p>No matches yet. Post a trade and we will alert you when someone is a fit!</p>
      </div>
    )
  }
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-outline btn-sm" onClick={onClearAll} style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
          Clear All Matches
        </button>
      </div>
      <div className={styles.grid}>
        {matches.map(m => {
          const myPost = m.user_a_id === userId ? m.post_a : m.post_b
          const theirPost = m.user_a_id === userId ? m.post_b : m.post_a
          return (
            <div key={m.id} className={styles.matchCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className={styles.matchBanner}>🎯 Barter Match!</div>
                <button
                  onClick={() => onDismiss(m.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1rem', lineHeight: 1, padding: '0.2rem' }}
                  title="Dismiss match"
                >✕</button>
              </div>
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
                <button className="btn btn-primary btn-sm" onClick={() => onConnect(m)}>Connect</button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ─── Barter Card ──────────────────────────────────────────────────────────────

function BarterCard({ post, userId, onRemove, onMessage }: {
  post: BarterPost
  userId: string | null
  onRemove: (id: string) => void
  onMessage: (post: BarterPost) => void
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Avatar
            name={post.profiles?.full_name}
            avatarUrl={post.profiles?.avatar_url}
            color={post.profiles?.avatar_color}
            size={32}
          />
          <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>{post.profiles?.full_name}</span>
          <span className="trust">⭐{post.profiles?.trust_score?.toFixed(1) || '5.0'}</span>
        </div>
        {post.user_id !== userId && (
          <button className="btn btn-outline btn-sm" onClick={() => onMessage(post)}>Message</button>
        )}
        {post.user_id === userId && (
          <button className="btn btn-outline btn-sm" style={{ color: 'var(--muted)', fontSize: '0.78rem' }} onClick={() => onRemove(post.id)}>
            Close Post
          </button>
        )}
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

// ─── Contact Modal (shared by Message + Connect) ──────────────────────────────

interface ContactModalProps {
  title: string
  subtitle: string
  ctaText: string
  onClose: () => void
  onSubmit: (contactInfo: string) => Promise<void>
}

function ContactModal({ title, subtitle, ctaText, onClose, onSubmit }: ContactModalProps) {
  const [contactInfo, setContactInfo] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(contactInfo)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={modalStyles.modal}>
        <button className={modalStyles.close} onClick={onClose}>✕</button>
        <h2 className={modalStyles.title}>{title}</h2>
        <p className={modalStyles.subtitle}>{subtitle}</p>
        <form onSubmit={handle}>
          <div className="form-group">
            <label className="label">Additional contact info (optional)</label>
            <input
              className="input"
              value={contactInfo}
              onChange={e => setContactInfo(e.target.value)}
              placeholder="Phone, WhatsApp, Signal, etc."
            />
          </div>
          <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
            📧 Your registered email will be shared so you can arrange the trade.
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.83rem', color: 'var(--bark)', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ marginTop: '0.15rem', accentColor: 'var(--rust)', flexShrink: 0 }}
            />
            I understand that trades and exchanges are at my own risk. Always meet in safe, public places.
          </label>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading || !agreed}>
            {loading ? <span className="spinner" /> : ctaText}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Add Barter Modal ─────────────────────────────────────────────────────────

interface AddBarterModalProps {
  userId: string
  onClose: () => void
  onSuccess: () => void
  showToast: AppCtx['showToast']
}

function AddBarterModal({ userId, onClose, onSuccess, showToast }: AddBarterModalProps) {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    have_description: '', have_category: 'Skills & Services',
    want_description: '', want_category: 'Skills & Services', notes: '',
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      // Duplicate check — prevent identical active posts from the same user
      const { data: existing } = await supabase
        .from('barter_posts')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .ilike('have_description', form.have_description.trim())
        .eq('have_category', form.have_category)

      if (existing && existing.length > 0) {
        showToast('You already have an active post offering this — close the existing one first.', 'error')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('barter_posts')
        .insert({ user_id: userId, ...form })
        .select()
        .single()
      if (error) throw error

      // Trigger matching (fire-and-forget)
      fetch('/api/barter-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: data.id }),
      }).catch(() => {})

      onSuccess()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not post trade', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={modalStyles.modal}>
        <button className={modalStyles.close} onClick={onClose}>✕</button>
        <h2 className={modalStyles.title}>Post a Trade</h2>
        <p className={modalStyles.subtitle}>We will match you automatically with neighbors who have/want what you do</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">I Have / Can Offer *</label>
            <input className="input" value={form.have_description} onChange={set('have_description')} placeholder="e.g. Guitar lessons, fresh eggs, sourdough starter…" required />
          </div>
          <div className="form-group">
            <label className="label">Category</label>
            <select className="input" value={form.have_category} onChange={set('have_category')}>
              {BARTER_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">I am Looking For *</label>
            <input className="input" value={form.want_description} onChange={set('want_description')} placeholder="e.g. Dog walking, homemade jam, vinyl records…" required />
          </div>
          <div className="form-group">
            <label className="label">Category</label>
            <select className="input" value={form.want_category} onChange={set('want_category')}>
              {BARTER_CATEGORIES.map(c => <option key={c}>{c}</option>)}
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
