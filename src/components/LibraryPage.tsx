'use client'
import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import ItemCard from './ItemCard'
import styles from './LibraryPage.module.css'
import modalStyles from './Modal.module.css'
import type { Item, AppCtx, ItemCategory, OfferType, Condition } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_CATEGORIES: ItemCategory[] = ['Book', 'DVD', 'VHS', 'CD', 'Game', 'Tool', 'Home Good', 'Other']
const CAT_LABELS: Record<string, string> = {
  '': 'All Items',
  Book: '📚 Books', DVD: '🎬 DVDs', VHS: '📼 VHS', CD: '🎵 CDs',
  Game: '🎲 Games', Tool: '🔧 Tools', 'Home Good': '🏠 Home Goods', Other: '📦 Other',
}

// Haversine formula — miles between two lat/lng points
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LibraryPage({ ctx }: { ctx: AppCtx }) {
  const { user, profile, showToast, requireAuth } = ctx
  const supabase = createBrowserClient()

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [borrowItem, setBorrowItem] = useState<Item | null>(null)
  const [flagItem, setFlagItem] = useState<Item | null>(null)
  const [showAI, setShowAI] = useState(false)

  // Debounce search — wait 300ms after user stops typing before fetching
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Stable primitive deps — no object references that change on every render
  const userId = user?.id ?? null
  const userLat = profile?.lat ?? null
  const userLng = profile?.lng ?? null
  const radiusMiles = profile?.radius_miles ?? null

  useEffect(() => {
    let cancelled = false

    async function loadItems() {
      setLoading(true)
      setError(null)

      let q = supabase
        .from('items')
        .select('*, profiles(full_name, trust_score, avatar_color, lat, lng)')
        .eq('flagged', false)
        .order('created_at', { ascending: false })

      if (category) q = q.eq('category', category)
      if (debouncedSearch) q = q.ilike('title', `%${debouncedSearch}%`)

      const { data, error: fetchError } = await q

      if (cancelled) return

      if (fetchError) {
        setError('Could not load items. Please try refreshing.')
        setLoading(false)
        return
      }

      let results = (data as Item[]) || []

      // Client-side radius filter (only when user has saved coordinates)
      if (userId && userLat && userLng && radiusMiles) {
        results = results.filter(item => {
          if (item.user_id === userId) return true                            // always show own items
          if (!item.profiles?.lat || !item.profiles?.lng) return true        // no coords = include anyway
          return distanceMiles(userLat, userLng, item.profiles.lat, item.profiles.lng) <= radiusMiles
        })
      }

      setItems(results)
      setLoading(false)
    }

    loadItems()
    return () => { cancelled = true }
  }, [category, debouncedSearch, userId, userLat, userLng, radiusMiles])

  const radiusNote = userId && radiusMiles
    ? `Showing items within ${radiusMiles} miles of you`
    : null

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="container">
        <div className="section">
          <h1 className="section-title">Community Library</h1>
          <p className="section-subtitle">
            {radiusNote ?? 'Browse, borrow, and lend with your neighbors'}
          </p>

          <div className={styles.searchRow}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                className={`input ${styles.searchInput}`}
                placeholder="Search titles, authors…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => requireAuth(() => setShowAdd(true))}>
              + Add Item
            </button>
          </div>

          <div className="tabs">
            {Object.entries(CAT_LABELS).map(([val, label]) => (
              <button
                key={val}
                className={`tab ${category === val ? 'active' : ''}`}
                onClick={() => setCategory(val)}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className={styles.loadingGrid}>
              {[...Array(8)].map((_, i) => <div key={i} className={styles.skeleton} />)}
            </div>
          ) : error ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>⚠️</div>
              <h3>Something went wrong</h3>
              <p>{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📚</div>
              <h3>Nothing here yet</h3>
              <p>
                {userId && radiusMiles
                  ? `No items within ${radiusMiles} miles. Try increasing your radius by clicking the 📍 pill in the nav.`
                  : 'Be the first to add something to your community!'}
              </p>
              <button className="btn btn-primary" onClick={() => requireAuth(() => setShowAdd(true))}>
                Add the first item
              </button>
            </div>
          ) : (
            <div className="grid-4">
              {items.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onBorrow={(i: Item) => requireAuth(() => setBorrowItem(i))}
                  onFlag={(i: Item) => requireAuth(() => setFlagItem(i))}
                />
              ))}
            </div>
          )}

          <div className={styles.aiSection}>
            <h2 className="section-title">📸 AI Catalog Upload</h2>
            <p className="section-subtitle">Snap a photo of your shelf and Claude will extract everything automatically</p>
            <button className="btn btn-primary btn-lg" onClick={() => requireAuth(() => setShowAI(true))}>
              Try AI Catalog Upload →
            </button>
          </div>
        </div>
      </div>

      {showAdd && (
        <AddItemModal
          userId={user!.id}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); showToast('Item added! 🎉') }}
          showToast={showToast}
        />
      )}
      {borrowItem && (
        <BorrowModal
          item={borrowItem}
          userId={user!.id}
          onClose={() => setBorrowItem(null)}
          onSuccess={() => { setBorrowItem(null); showToast('Borrow request sent! 📬') }}
          showToast={showToast}
        />
      )}
      {flagItem && (
        <FlagModal
          item={flagItem}
          userId={user!.id}
          onClose={() => setFlagItem(null)}
          onSuccess={() => { setFlagItem(null); showToast("Thanks for the report. We'll review it.") }}
          showToast={showToast}
        />
      )}
      {showAI && (
        <AIUploadModal
          userId={user!.id}
          onClose={() => setShowAI(false)}
          onSuccess={count => { setShowAI(false); showToast(`${count} item${count !== 1 ? 's' : ''} added to your inventory! 🎉`) }}
          showToast={showToast}
        />
      )}
    </div>
  )
}

// ─── Add Item Modal ────────────────────────────────────────────────────────────

interface AddItemModalProps {
  userId: string
  onClose: () => void
  onSuccess: () => void
  showToast: AppCtx['showToast']
}

function AddItemModal({ userId, onClose, onSuccess, showToast }: AddItemModalProps) {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', author_creator: '', category: 'Book' as ItemCategory,
    offer_type: 'lend' as OfferType, condition: 'good' as Condition,
    notes: '', duration_days: 14,
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      let metadata = {}
      let cover_image_url: string | null = null
      if (form.category === 'Book' && form.title) {
        try {
          const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(form.title)}&limit=1`)
          const data = await res.json()
          if (data.docs?.[0]) {
            const doc = data.docs[0]
            metadata = { year: doc.first_publish_year, genre: doc.subject?.[0], publisher: doc.publisher?.[0] }
            if (doc.cover_i) cover_image_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          }
        } catch { /* Open Library is optional — don't block on failure */ }
      }
      const { error } = await supabase.from('items').insert({
        user_id: userId,
        title: form.title,
        author_creator: form.author_creator || null,
        category: form.category,
        offer_type: form.offer_type,
        condition: form.condition,
        notes: form.notes || null,
        metadata,
        cover_image_url,
        status: 'available',
      })
      if (error) throw error
      onSuccess()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not add item', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={modalStyles.modal}>
        <button className={modalStyles.close} onClick={onClose}>✕</button>
        <h2 className={modalStyles.title}>Add an Item</h2>
        <p className={modalStyles.subtitle}>Share something from your home with your community</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={set('title')} placeholder="e.g. The Godfather, Beloved by Toni Morrison…" required />
          </div>
          <div className="form-group">
            <label className="label">Author / Creator</label>
            <input className="input" value={form.author_creator} onChange={set('author_creator')} placeholder="e.g. Toni Morrison, Stanley Kubrick…" />
          </div>
          <div className={modalStyles.formRow}>
            <div className="form-group">
              <label className="label">Category *</label>
              <select className="input" value={form.category} onChange={set('category')}>
                {ITEM_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Offer Type *</label>
              <select className="input" value={form.offer_type} onChange={set('offer_type')}>
                <option value="lend">Lend / Borrow</option>
                <option value="swap">Permanent Swap</option>
                <option value="barter">Barter</option>
                <option value="free">Free / Give Away</option>
              </select>
            </div>
          </div>
          <div className={modalStyles.formRow}>
            <div className="form-group">
              <label className="label">Condition</label>
              <select className="input" value={form.condition} onChange={set('condition')}>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Max Loan (days)</label>
              <input className="input" type="number" value={form.duration_days} onChange={set('duration_days')} min={1} max={90} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} placeholder="Any details worth knowing…" />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Add to Community Shelf'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Borrow Modal ──────────────────────────────────────────────────────────────

interface BorrowModalProps {
  item: Item
  userId: string
  onClose: () => void
  onSuccess: () => void
  showToast: AppCtx['showToast']
}

function BorrowModal({ item, userId, onClose, onSuccess, showToast }: BorrowModalProps) {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [duration, setDuration] = useState(14)
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('loan_requests').insert({
        item_id: item.id, requester_id: userId, duration_days: duration, message, status: 'pending',
      })
      if (error) throw error

      // Notify owner in-app
      await supabase.from('notifications').insert({
        user_id: item.user_id,
        type: 'loan_request',
        title: 'New Borrow Request',
        body: `Someone wants to borrow your "${item.title}" for ${duration} days.`,
        data: { item_id: item.id, requester_id: userId },
      })

      // Email notification (fire-and-forget — don't block on it)
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'loan_request', item, duration, lenderId: item.user_id, requesterId: userId }),
      }).catch(() => { /* email failure shouldn't break the flow */ })

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
            <textarea className="input" rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Introduce yourself briefly — people appreciate it!" />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Send Request 📬'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Flag Modal ────────────────────────────────────────────────────────────────

interface FlagModalProps {
  item: Item
  userId: string
  onClose: () => void
  onSuccess: () => void
  showToast: AppCtx['showToast']
}

function FlagModal({ item, userId, onClose, onSuccess, showToast }: FlagModalProps) {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('unavailable')
  const [notes, setNotes] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('item_flags').insert({
        item_id: item.id, user_id: userId, reason, notes,
      })
      if (error) throw error
      onSuccess()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not submit flag', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={modalStyles.modal}>
        <button className={modalStyles.close} onClick={onClose}>✕</button>
        <h2 className={modalStyles.title}>Flag This Listing</h2>
        <p className={modalStyles.subtitle}>Help keep the community accurate. "{item.title}"</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">Reason</label>
            <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
              <option value="unavailable">No longer available</option>
              <option value="incorrect_info">Incorrect information</option>
              <option value="damaged">Item is damaged</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any details…" />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Submit Flag'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── AI Upload Modal ───────────────────────────────────────────────────────────

interface AIUploadModalProps {
  userId: string
  onClose: () => void
  onSuccess: (count: number) => void
  showToast: AppCtx['showToast']
}

interface ExtractedItem {
  title: string
  author_creator: string | null
  category: ItemCategory
  condition: Condition
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function AIUploadModal({ userId, onClose, onSuccess, showToast }: AIUploadModalProps) {
  const supabase = createBrowserClient()
  const [stage, setStage] = useState<'upload' | 'processing' | 'review'>('upload')
  const [extracted, setExtracted] = useState<ExtractedItem[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStage('processing')
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/ai-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: file.type }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      if (!data.items?.length) throw new Error('No items found in photo')
      setExtracted(data.items)
      setSelected(new Set(data.items.map((_: ExtractedItem, i: number) => i)))
      setStage('review')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'AI extraction failed', 'error')
      setStage('upload')
    }
  }

  function toggleItem(i: number) {
    setSelected(s => {
      const next = new Set(s)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  async function addSelected() {
    setLoading(true)
    try {
      const toAdd = extracted.filter((_, i) => selected.has(i))
      for (const item of toAdd) {
        let cover_image_url: string | null = null
        if (item.category === 'Book' && item.title) {
          try {
            const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(item.title)}&limit=1`)
            const data = await res.json()
            if (data.docs?.[0]?.cover_i) {
              cover_image_url = `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-M.jpg`
            }
          } catch { /* optional */ }
        }
        const { error } = await supabase.from('items').insert({
          user_id: userId,
          title: item.title,
          author_creator: item.author_creator || null,
          category: item.category,
          condition: item.condition,
          status: 'available',
          offer_type: 'lend',
          cover_image_url,
        })
        if (error) throw error
      }
      onSuccess(toAdd.length)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not save items', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={modalStyles.modal} style={{ maxWidth: 580 }}>
        <button className={modalStyles.close} onClick={onClose}>✕</button>
        <h2 className={modalStyles.title}>AI Catalog Upload</h2>
        <p className={modalStyles.subtitle}>Powered by Claude — upload a photo of your shelf</p>

        {stage === 'upload' && (
          <label style={{ display: 'block', border: '2.5px dashed var(--border)', borderRadius: 12, padding: '3rem 2rem', textAlign: 'center', cursor: 'pointer', background: 'var(--cream)', transition: 'all 0.2s' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📷</div>
            <h3 style={{ fontFamily: 'Fraunces, serif', marginBottom: '0.5rem' }}>Drop a photo here, or click to browse</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>Bookshelves, DVD racks, CD collections</p>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          </label>
        )}

        {stage === 'processing' && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🤖</div>
            <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.1rem' }}>Claude is scanning your shelf…</p>
            <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>This usually takes about 10 seconds</p>
          </div>
        )}

        {stage === 'review' && (
          <>
            <p style={{ marginBottom: '1rem', fontWeight: 500 }}>Found {extracted.length} items — select which to add:</p>
            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {extracted.map((item, i) => (
                <label key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', background: selected.has(i) ? '#F0FAF0' : 'var(--cream)', border: `1.5px solid ${selected.has(i) ? 'var(--sage)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggleItem(i)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{item.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{item.author_creator} · {item.category}</div>
                  </div>
                </label>
              ))}
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={addSelected} disabled={loading || selected.size === 0}>
              {loading ? <span className="spinner" /> : `Add ${selected.size} item${selected.size !== 1 ? 's' : ''} to My Shelf`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
