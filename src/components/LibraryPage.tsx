'use client'
import { useState, useEffect, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import ItemCard from './ItemCard'
import BorrowModal from './BorrowModal'
import AIUploadModal from './AIUploadModal'
import styles from './LibraryPage.module.css'
import modalStyles from './Modal.module.css'
import type { Item, AppCtx, ItemCategory, OfferType, Condition } from '@/types'

const PAGE_SIZE = 20
const DB_FETCH_LIMIT = 500

const ITEM_CATEGORIES: ItemCategory[] = ['Book', 'DVD', 'VHS', 'CD', 'Game', 'Tool', 'Home Good', 'Other']
const CAT_LABELS: Record<string, string> = {
  '': 'All Items',
  Book: '📚 Books', DVD: '🎬 DVDs', VHS: '📼 VHS', CD: '🎵 CDs',
  Game: '🎲 Games', Tool: '🔧 Tools', 'Home Good': '🏠 Home Goods', Other: '📦 Other',
}
const OFFER_LABELS: Record<string, string> = {
  '': 'Any Type', lend: '🤝 Lend', swap: '🔄 Swap', barter: '⚖️ Barter', free: '🎁 Free',
}
// Categories where genre filtering makes sense
const GENRE_CATEGORIES = new Set(['Book', 'DVD', 'VHS', 'CD'])

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function LibraryPage({ ctx }: { ctx: AppCtx }) {
  const { user, profile, showToast, requireAuth } = ctx
  const supabase = createBrowserClient()

  const [allItems, setAllItems] = useState<Item[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [offerType, setOfferType] = useState('')
  const [genre, setGenre] = useState('')

  // Modals
  const [showAdd, setShowAdd] = useState(false)
  const [borrowItem, setBorrowItem] = useState<Item | null>(null)
  const [flagItem, setFlagItem] = useState<Item | null>(null)
  const [showAI, setShowAI] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset pagination and genre when top-level filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    setGenre('')
  }, [category, debouncedSearch, offerType])

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
        .select('*, profiles(full_name, trust_score, avatar_color, avatar_url, lat, lng)')
        .eq('flagged', false)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(DB_FETCH_LIMIT)

      if (category) q = q.eq('category', category)
      if (offerType) q = q.eq('offer_type', offerType)

      // Search both title and author_creator
      if (debouncedSearch) {
        q = q.or(`title.ilike.%${debouncedSearch}%,author_creator.ilike.%${debouncedSearch}%`)
      }

      const { data, error: fetchError } = await q
      if (cancelled) return

      if (fetchError) {
        setError('Could not load items. Please try refreshing.')
        setLoading(false)
        return
      }

      let results = (data as Item[]) || []

      // Client-side radius filter
      if (userId && userLat && userLng && radiusMiles) {
        results = results.filter(item => {
          if (item.user_id === userId) return true
          if (!item.profiles?.lat || !item.profiles?.lng) return true
          return distanceMiles(userLat, userLng, item.profiles.lat, item.profiles.lng) <= radiusMiles
        })
      }

      setAllItems(results)
      setLoading(false)
    }

    loadItems()
    return () => { cancelled = true }
  }, [category, offerType, debouncedSearch, userId, userLat, userLng, radiusMiles])

  // Derive available genres from current result set (only for genre-relevant categories)
  const availableGenres = useMemo(() => {
    if (!category || !GENRE_CATEGORIES.has(category)) return []
    const genres = new Set<string>()
    allItems.forEach(item => {
      const g = item.metadata?.genre
      if (g) genres.add(g)
    })
    return Array.from(genres).sort()
  }, [allItems, category])

  // Client-side genre filter (applied on top of DB results)
  const filteredItems = useMemo(() => {
    if (!genre) return allItems
    return allItems.filter(item => item.metadata?.genre === genre)
  }, [allItems, genre])

  const visibleItems = filteredItems.slice(0, visibleCount)
  const hasMore = visibleCount < filteredItems.length
  const radiusNote = userId && radiusMiles ? `Showing items within ${radiusMiles} miles of you` : null

  // Active filter count for the clear button
  const activeFilterCount = [offerType, genre].filter(Boolean).length

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="container">
        <div className="section">
          <h1 className="section-title">Community Library</h1>
          <p className="section-subtitle">{radiusNote ?? 'Browse, borrow, and lend with your neighbors'}</p>

          {/* Search + Add */}
          <div className={styles.searchRow}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                className={`input ${styles.searchInput}`}
                placeholder="Search titles, authors, directors…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => requireAuth(() => setShowAdd(true))}>
              + Add Item
            </button>
          </div>

          {/* Category tabs */}
          <div className="tabs">
            {Object.entries(CAT_LABELS).map(([val, label]) => (
              <button key={val} className={`tab ${category === val ? 'active' : ''}`} onClick={() => setCategory(val)}>
                {label}
              </button>
            ))}
          </div>

          {/* Secondary filters row */}
          <div className={styles.filtersRow}>
            {/* Offer type pills */}
            <div className={styles.filterGroup}>
              {Object.entries(OFFER_LABELS).map(([val, label]) => (
                <button
                  key={val}
                  className={`${styles.filterPill} ${offerType === val ? styles.filterPillActive : ''}`}
                  onClick={() => setOfferType(val)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Genre pills — only shown when a genre-relevant category is selected and genres exist */}
            {availableGenres.length > 0 && (
              <div className={styles.filterGroup}>
                <button
                  className={`${styles.filterPill} ${genre === '' ? styles.filterPillActive : ''}`}
                  onClick={() => setGenre('')}
                >
                  All Genres
                </button>
                {availableGenres.map(g => (
                  <button
                    key={g}
                    className={`${styles.filterPill} ${genre === g ? styles.filterPillActive : ''}`}
                    onClick={() => { setGenre(g); setVisibleCount(PAGE_SIZE) }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button
                className={styles.clearFilters}
                onClick={() => { setOfferType(''); setGenre('') }}
              >
                ✕ Clear filters
              </button>
            )}
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
          ) : filteredItems.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📚</div>
              <h3>Nothing matches</h3>
              <p>
                {activeFilterCount > 0
                  ? 'Try clearing some filters to see more results.'
                  : userId && radiusMiles
                    ? `No items within ${radiusMiles} miles. Try increasing your radius by clicking the 📍 pill in the nav.`
                    : 'Be the first to add something to your community!'}
              </p>
              {activeFilterCount > 0 ? (
                <button className="btn btn-outline" onClick={() => { setOfferType(''); setGenre('') }}>
                  Clear Filters
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => requireAuth(() => setShowAdd(true))}>
                  Add the first item
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid-4">
                {visibleItems.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onBorrow={(i: Item) => requireAuth(() => setBorrowItem(i))}
                    onFlag={(i: Item) => requireAuth(() => setFlagItem(i))}
                  />
                ))}
              </div>

              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
                  <button
                    className="btn btn-outline btn-lg"
                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                    style={{ minWidth: 200, padding: '0.9rem 2rem' }}
                  >
                    Load More · {filteredItems.length - visibleCount} remaining
                  </button>
                </div>
              )}
            </>
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
        } catch { /* optional */ }
      }
      if ((form.category === 'DVD' || form.category === 'VHS') && form.title) {
        try {
          const res = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(form.title)}&apikey=${process.env.NEXT_PUBLIC_OMDB_API_KEY || 'd5714ece'}`)
          const data = await res.json()
          if (data.Poster && data.Poster !== 'N/A') cover_image_url = data.Poster
          if (data.Year) metadata = { ...metadata, year: parseInt(data.Year), genre: data.Genre?.split(',')[0] }
        } catch { /* optional */ }
      }
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          items: [{
            title: form.title,
            author_creator: form.author_creator || null,
            category: form.category,
            offer_type: form.offer_type,
            condition: form.condition,
            notes: form.notes || null,
            metadata,
            cover_image_url,
          }],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not add item')
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
