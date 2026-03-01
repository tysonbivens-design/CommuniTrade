'use client'
import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import ItemCard from './ItemCard'
import styles from './LibraryPage.module.css'
import modalStyles from './Modal.module.css'

const CATEGORIES = ['', 'Book', 'DVD', 'VHS', 'CD', 'Game', 'Tool', 'Home Good', 'Other']
const CAT_LABELS: Record<string, string> = {
  '': 'All Items', Book: '📚 Books', DVD: '🎬 DVDs', VHS: '📼 VHS',
  CD: '🎵 CDs', Game: '🎲 Games', Tool: '🔧 Tools', 'Home Good': '🏠 Home Goods'
}

// Haversine formula — calculates miles between two lat/lng points
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function LibraryPage({ ctx }: any) {
  const { user, profile, showToast, requireAuth } = ctx
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [borrowItem, setBorrowItem] = useState<any>(null)
  const [flagItem, setFlagItem] = useState<any>(null)
  const [showAI, setShowAI] = useState(false)
  const supabase = createBrowserClient()

  const loadItems = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('items')
      .select('*, profiles(full_name, trust_score, avatar_color, lat, lng)')
      .eq('flagged', false)
      .order('created_at', { ascending: false })
    if (category) q = q.eq('category', category)
    if (search) q = q.ilike('title', `%${search}%`)
    const { data } = await q

    let results = data || []

    // Filter by radius if logged in and we have coordinates
    if (user && profile?.lat && profile?.lng && profile?.radius_miles) {
      results = results.filter(item => {
        // Always show the user's own items
        if (item.user_id === user.id) return true
        // If the item owner has no coordinates, show it anyway (don't exclude unfairly)
        if (!item.profiles?.lat || !item.profiles?.lng) return true
        const miles = distanceMiles(profile.lat, profile.lng, item.profiles.lat, item.profiles.lng)
        return miles <= profile.radius_miles
      })
    }

    setItems(results)
    setLoading(false)
  }, [category, search, profile?.lat, profile?.lng, profile?.radius_miles, user])

  useEffect(() => { loadItems() }, [loadItems])

  const radiusNote = user && profile?.radius_miles
    ? `Showing items within ${profile.radius_miles} miles of you`
    : null

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="container">
        <div className="section">
          <h1 className="section-title">Community Library</h1>
          <p className="section-subtitle">
            {radiusNote || 'Browse, borrow, and lend with your neighbors'}
          </p>

          {/* Search */}
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
            <button className="btn btn-primary" onClick={() => requireAuth(() => setShowAdd(true))}>+ Add Item</button>
          </div>

          {/* Category tabs */}
          <div className="tabs">
            {Object.entries(CAT_LABELS).map(([val, label]) => (
              <button key={val} className={`tab ${category === val ? 'active' : ''}`} onClick={() => setCategory(val)}>
                {label}
              </button>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div className={styles.loadingGrid}>
              {[...Array(8)].map((_, i) => <div key={i} className={styles.skeleton} />)}
            </div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📚</div>
              <h3>Nothing here yet</h3>
              <p>
                {user && profile?.radius_miles
                  ? `No items within ${profile.radius_miles} miles. Try increasing your radius by clicking the 📍 location pill in the top nav.`
                  : 'Be the first to add something to your community!'
                }
              </p>
              <button className="btn btn-primary" onClick={() => requireAuth(() => setShowAdd(true))}>Add the first item</button>
            </div>
          ) : (
            <div className="grid-4">
              {items.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onBorrow={(i: any) => requireAuth(() => setBorrowItem(i))}
                  onFlag={(i: any) => requireAuth(() => setFlagItem(i))}
                />
              ))}
            </div>
          )}

          {/* AI Upload Section */}
          <div className={styles.aiSection}>
            <h2 className="section-title">📸 AI Catalog Upload</h2>
            <p className="section-subtitle">Snap a photo of your shelf and Claude will extract everything automatically</p>
            <button className="btn btn-primary btn-lg" onClick={() => requireAuth(() => setShowAI(true))}>
              Try AI Catalog Upload →
            </button>
          </div>
        </div>
      </div>

      {showAdd && <AddItemModal user={user} onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); loadItems(); showToast('Item added! 🎉') }} showToast={showToast} />}
      {borrowItem && <BorrowModal item={borrowItem} user={user} onClose={() => setBorrowItem(null)} onSuccess={() => { setBorrowItem(null); loadItems(); showToast('Borrow request sent! 📬') }} showToast={showToast} />}
      {flagItem && <FlagModal item={flagItem} user={user} onClose={() => setFlagItem(null)} onSuccess={() => { setFlagItem(null); showToast('Thanks for the report. We\'ll review it.') }} showToast={showToast} />}
      {showAI && <AIUploadModal user={user} onClose={() => setShowAI(false)} onSuccess={(count: number) => { setShowAI(false); loadItems(); showToast(`${count} items added to your inventory! 🎉`) }} showToast={showToast} />}
    </div>
  )
}

// ─── ADD ITEM MODAL ───────────────────────────────────
function AddItemModal({ user, onClose, onSuccess, showToast }: any) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', author_creator: '', category: 'Book', offer_type: 'lend', condition: 'good', notes: '', duration_days: 14 })
  const supabase = createBrowserClient()
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: any) {
    e.preventDefault()
    setLoading(true)
    try {
      let metadata = {}
      let cover_image_url = null
      if (form.category === 'Book' && form.title) {
        try {
          const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(form.title)}&limit=1`)
          const data = await res.json()
          if (data.docs?.[0]) {
            const doc = data.docs[0]
            metadata = { year: doc.first_publish_year, genre: doc.subject?.[0], publisher: doc.publisher?.[0] }
            if (doc.cover_i) cover_image_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          }
        } catch {}
      }
      const { error } = await supabase.from('items').insert({
        user_id: user.id,
        title: form.title,
        author_creator: form.author_creator || null,
        category: form.category,
        offer_type: form.offer_type,
        condition: form.condition,
        notes: form.notes || null,
        metadata,
        cover_image_url,
        status: 'available'
      })
      if (error) throw error
      onSuccess()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally { setLoading(false) }
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
                {['Book', 'DVD', 'VHS', 'CD', 'Game', 'Tool', 'Home Good', 'Other'].map(c => <option key={c}>{c}</option>)}
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

// ─── BORROW MODAL ─────────────────────────────────────
function BorrowModal({ item, user, onClose, onSuccess, showToast }: any) {
  const [loading, setLoading] = useState(false)
  const [duration, setDuration] = useState(14)
  const [message, setMessage] = useState('')
  const supabase = createBrowserClient()

  async function submit(e: any) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('loan_requests').insert({
        item_id: item.id, requester_id: user.id, duration_days: duration, message, status: 'pending'
      })
      if (error) throw error
      await supabase.from('notifications').insert({
        user_id: item.user_id,
        type: 'loan_request',
        title: 'New Borrow Request',
        body: `Someone wants to borrow your "${item.title}" for ${duration} days.`,
        data: { item_id: item.id, requester_id: user.id }
      })
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'loan_request', item, duration, lenderId: item.user_id })
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

// ─── FLAG MODAL ───────────────────────────────────────
function FlagModal({ item, user, onClose, onSuccess, showToast }: any) {
  const [reason, setReason] = useState('unavailable')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  async function submit(e: any) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('item_flags').insert({ item_id: item.id, user_id: user.id, reason, notes })
      if (error) throw error
      onSuccess()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally { setLoading(false) }
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

// ─── AI UPLOAD MODAL ──────────────────────────────────
function AIUploadModal({ user, onClose, onSuccess, showToast }: any) {
  const [stage, setStage] = useState<'upload' | 'processing' | 'review'>('upload')
  const [extracted, setExtracted] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  async function handleFile(e: any) {
    const file = e.target.files?.[0]
    if (!file) return
    setStage('processing')
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/ai-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: file.type })
      })
      const data = await res.json()
      if (data.items) {
        setExtracted(data.items)
        setSelected(new Set(data.items.map((_: any, i: number) => i)))
        setStage('review')
      } else throw new Error('Could not extract items')
    } catch (err: any) {
      showToast(err.message || 'AI extraction failed', 'error')
      setStage('upload')
    }
  }

  async function addSelected() {
    setLoading(true)
    try {
      const toAdd = extracted.filter((_, i) => selected.has(i))
      for (const item of toAdd) {
        let cover_image_url = null
        if (item.category === 'Book' && item.title) {
          try {
            const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(item.title)}&limit=1`)
            const data = await res.json()
            if (data.docs?.[0]?.cover_i) cover_image_url = `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-M.jpg`
          } catch {}
        }
        await supabase.from('items').insert({ user_id: user.id, ...item, status: 'available', offer_type: 'lend', cover_image_url })
      }
      onSuccess(toAdd.length)
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally { setLoading(false) }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => res((reader.result as string).split(',')[1])
      reader.onerror = rej
      reader.readAsDataURL(file)
    })
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
                  <input type="checkbox" checked={selected.has(i)} onChange={() => setSelected(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })} />
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
