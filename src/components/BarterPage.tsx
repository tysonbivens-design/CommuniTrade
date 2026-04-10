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

function recordFeedback(matchId: string, userId: string, feedback: 'good' | 'bad') {
  fetch('/api/match-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId, userId, feedback }),
  }).catch(() => {})
}

export default function BarterPage({ ctx }: { ctx: AppCtx }) {
  const { user, profile, showToast, requireAuth, navigate } = ctx
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

      setPosts((data || []) as BarterPost[])
      setLoading(false)
    }

    loadPosts()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function loadMatches() {
      const { data } = await supabase
        .from('barter_matches')
        .select('*, post_a:barter_posts!barter_matches_post_a_id_fkey(*, profiles(full_name, avatar_color, avatar_url)), post_b:barter_posts!barter_matches_post_b_id_fkey(*, profiles(full_name, avatar_color, avatar_url))')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (!cancelled && data) setMatches(data as BarterMatch[])
    }

    loadMatches()
    return () => { cancelled = true }
  }, [userId])

  const filteredPosts = posts.filter(post => {
    if (post.user_id === userId) return false
    if (!userLat || !userLng || !radiusMiles) return true
    const lat = post.profiles?.lat
    const lng = post.profiles?.lng
    if (!lat || !lng) return true
    return distanceMiles(userLat, userLng, lat, lng) <= radiusMiles
  })

  async function removePost(postId: string) {
    await supabase.from('barter_posts').update({ status: 'closed' }).eq('id', postId)
    setPosts(p => p.filter(x => x.id !== postId))
    showToast('Post closed')
  }

  function handleFeedback(matchId: string, feedback: 'good' | 'bad') {
    if (!userId) return
    recordFeedback(matchId, userId, feedback)
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="container">
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 className="section-title">Barter Board</h1>
              <p className="section-subtitle">Trade skills, goods, and services with your neighbors</p>
            </div>
            <button className="btn btn-primary" onClick={() => requireAuth(() => setShowAdd(true))} data-tour="barter">
              + Post a Trade
            </button>
          </div>

          <div className="tabs" style={{ marginBottom: '1.5rem' }}>
            <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
              All Posts
            </button>
            {userId && (
              <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>
                My Matches
                {matches.length > 0 && (
                  <span style={{ background: 'var(--rust)', color: '#fff', borderRadius: 10, padding: '0.05rem 0.4rem', fontSize: '0.72rem', marginLeft: '0.3rem' }}>
                    {matches.length}
                  </span>
                )}
              </button>
            )}
          </div>

          {loading ? (
            <p style={{ color: 'var(--muted)' }}>Loading...</p>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>⚠️ {error}</div>
          ) : tab === 'matches' ? (
            <MatchesGrid
              matches={matches}
              userId={userId}
              onConnect={(match) => setConnectTarget({ match })}
              onDismiss={(matchId) => setMatches(m => m.filter(x => x.id !== matchId))}
              onClearAll={() => setMatches([])}
              onFeedback={handleFeedback}
            />
          ) : (
            <div className="grid-3">
              {filteredPosts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', gridColumn: '1/-1' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
                  <p>
                    {userId && radiusMiles
                      ? `No trades within ${radiusMiles} miles. Try increasing your radius by clicking the location pill above.`
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
            showToast("Trade posted! We'll notify you of matches")
          }}
          showToast={showToast}
        />
      )}

      {connectTarget && (
        <ContactModal
          title="Connect with your match"
          subtitle="Start an in-app conversation to arrange your trade."
          ctaText="Start Conversation"
          onClose={() => setConnectTarget(null)}
          onSubmit={async () => {
            const { match } = connectTarget
            const theirId = match.user_a_id === userId ? match.user_b_id : match.user_a_id
            if (!userId || !theirId) return
            await fetch('/api/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                senderId: userId,
                recipientId: theirId,
                body: 'Hey! I think we have a barter match. Want to connect?',
                contextType: 'barter',
                contextId: match.id,
              }),
            })
            setConnectTarget(null)
            navigate('messages')
            showToast('Conversation started!')
          }}
        />
      )}

      {messageTarget && (
        <ContactModal
          title="Message this trader"
          subtitle={`Send ${messageTarget.post.profiles?.full_name?.split(' ')[0]} a message about their post.`}
          ctaText="Send Message"
          onClose={() => setMessageTarget(null)}
          onSubmit={async () => {
            const { post } = messageTarget
            if (!userId) return
            await fetch('/api/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                senderId: userId,
                recipientId: post.user_id,
                body: 'Hey! I saw your barter post and wanted to reach out.',
                contextType: 'barter',
                contextId: post.id,
              }),
            })
            setMessageTarget(null)
            navigate('messages')
            showToast('Conversation started!')
          }}
        />
      )}
    </div>
  )
}

// ─── Matches Grid ─────────────────────────────────────────────────────────────

interface MatchesGridProps {
  matches: BarterMatch[]
  userId: string | null
  onConnect: (match: BarterMatch) => void
  onDismiss: (matchId: string) => void
  onClearAll: () => void
  onFeedback: (matchId: string, feedback: 'good' | 'bad') => void
}

function MatchesGrid({ matches, userId, onConnect, onDismiss, onClearAll, onFeedback }: MatchesGridProps) {
  const [feedback, setFeedback] = useState<Record<string, 'good' | 'bad'>>({})

  function handleFeedback(matchId: string, value: 'good' | 'bad') {
    setFeedback(f => ({ ...f, [matchId]: value }))
    onFeedback(matchId, value)
  }

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
          Was this a good match? Your feedback helps us improve.
        </p>
        <button className="btn btn-outline btn-sm" onClick={onClearAll} style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
          Clear All
        </button>
      </div>
      <div className={styles.grid}>
        {matches.map(m => {
          const myPost = m.user_a_id === userId ? m.post_a : m.post_b
          const theirPost = m.user_a_id === userId ? m.post_b : m.post_a
          const myFeedback = feedback[m.id]
          return (
            <div key={m.id} className={styles.matchCard}>
              <div className={styles.matchHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Avatar
                    name={theirPost?.profiles?.full_name}
                    avatarUrl={theirPost?.profiles?.avatar_url}
                    color={theirPost?.profiles?.avatar_color}
                    size={28}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{theirPost?.profiles?.full_name}</span>
                </div>
                <button
                  onClick={() => onDismiss(m.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem' }}
                >
                  x
                </button>
              </div>

              <div className={styles.matchBody}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>You offer</div>
                  <div style={{ fontSize: '0.88rem' }}>{myPost?.have_description}</div>
                </div>
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>vs</div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>They offer</div>
                  <div style={{ fontSize: '0.88rem' }}>{theirPost?.have_description}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                <button
                  onClick={() => handleFeedback(m.id, 'good')}
                  title="Good match"
                  style={{
                    background: myFeedback === 'good' ? 'var(--sage)' : 'var(--cream)',
                    border: '1.5px solid var(--border)', borderRadius: 6,
                    padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.85rem',
                  }}
                >
                  👍
                </button>
                <button
                  onClick={() => handleFeedback(m.id, 'bad')}
                  title="Not a good match"
                  style={{
                    background: myFeedback === 'bad' ? '#FEECEC' : 'var(--cream)',
                    border: '1.5px solid var(--border)', borderRadius: 6,
                    padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.85rem',
                  }}
                >
                  👎
                </button>
                {myFeedback && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '0.25rem', alignSelf: 'center' }}>
                    Thanks for the feedback!
                  </span>
                )}
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
        <div className={styles.arrow}>vs</div>
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

// ─── Contact Modal ────────────────────────────────────────────────────────────

interface ContactModalProps {
  title: string
  subtitle: string
  ctaText: string
  onClose: () => void
  onSubmit: () => Promise<void>
}

function ContactModal({ title, subtitle, ctaText, onClose, onSubmit }: ContactModalProps) {
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try { await onSubmit() } finally { setLoading(false) }
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={modalStyles.modal}>
        <button className={modalStyles.close} onClick={onClose}>x</button>
        <h2 className={modalStyles.title}>{title}</h2>
        <p className={modalStyles.subtitle}>{subtitle}</p>
        <form onSubmit={handle}>
          <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
            A conversation will be started in your Messages tab. You can exchange contact details there.
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.83rem', color: 'var(--bark)', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ marginTop: '0.15rem', accentColor: 'var(--rust)', flexShrink: 0 }}
            />
            I understand that trades are at my own risk. Always meet in safe, public places.
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

      fetch('/api/barter-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: data.id, userId }),
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
        <button className={modalStyles.close} onClick={onClose}>x</button>
        <h2 className={modalStyles.title}>Post a Trade</h2>
        <p className={modalStyles.subtitle}>Tell the community what you have and what you want</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">I have / I offer</label>
            <input className="input" required value={form.have_description} onChange={set('have_description')} placeholder="e.g. Fresh sourdough bread, guitar lessons, a drill..." />
          </div>
          <div className="form-group">
            <label className="label">Category</label>
            <select className="input" value={form.have_category} onChange={set('have_category')}>
              {BARTER_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">I want / I seek</label>
            <input className="input" required value={form.want_description} onChange={set('want_description')} placeholder="e.g. Help moving furniture, homemade jam, a ladder..." />
          </div>
          <div className="form-group">
            <label className="label">Category</label>
            <select className="input" value={form.want_category} onChange={set('want_category')}>
              {BARTER_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Notes (optional)</label>
            <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} placeholder="Any extra details..." />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Post Trade'}
          </button>
        </form>
      </div>
    </div>
  )
}
