'use client'
import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import ItemCard from './ItemCard'
import Avatar from './Avatar'
import styles from './ProfilePage.module.css'
import modalStyles from './Modal.module.css'
import type { Item, AppCtx, OfferType, Condition } from '@/types'

const COLORS = ['#C4622D', '#5A7A5C', '#D4A843', '#6B4C3B', '#8B5CF6', '#059669', '#0EA5E9', '#EC4899']

interface Review {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer: { full_name: string | null; avatar_color: string | null; avatar_url: string | null } | null
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
  const supabase = createBrowserClient()
  const [tab, setTab] = useState<'inventory' | 'reviews' | 'settings'>('inventory')
  const [items, setItems] = useState<Item[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ProfileStats>({ shared: 0, loans: 0, trades: 0 })
  const [editColor, setEditColor] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) return
    loadAll(userId)
  }, [userId])

  async function loadAll(uid: string) {
    const [itemsResult, reviewsResult, loansResult] = await Promise.all([
      supabase
        .from('items')
        .select('*, profiles(full_name, trust_score, avatar_color, avatar_url, lat, lng)')
        .eq('user_id', uid)
        .eq('archived', false)
        .order('created_at', { ascending: false }),

      supabase
        .from('reviews')
        .select('*, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_color, avatar_url)')
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

  async function archiveItem(item: Item) {
    if (!userId) return
    if (item.status === 'loaned') {
      showToast('Cannot remove an item that is currently on loan', 'error')
      return
    }
    if (!window.confirm(`Remove "${item.title}" from your inventory?`)) return
    const { error } = await supabase.from('items').update({ archived: true }).eq('id', item.id)
    if (error) { showToast(error.message, 'error'); return }
    setItems(prev => prev.filter(i => i.id !== item.id))
    setStats(s => ({ ...s, shared: s.shared - 1 }))
    showToast('Item removed')
  }

  function handleItemSaved(updated: Item) {
    setItems(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i))
    setEditItem(null)
    showToast('Item updated ✅')
  }

  async function updateColor(color: string) {
    if (!userId) return
    const { error } = await supabase.from('profiles').update({ avatar_color: color }).eq('id', userId)
    if (error) { showToast(error.message, 'error'); return }
    setEditColor(false)
    showToast('Avatar color updated!')
    onProfileUpdate(userId)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    // Validate: image only, max 5MB
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'error')
      return
    }

    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${userId}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      // Bust cache by appending timestamp
      const urlWithBust = `${publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithBust })
        .eq('id', userId)

      if (updateError) throw updateError

      showToast('Photo updated! ✅')
      onProfileUpdate(userId)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setUploadingAvatar(false)
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function removeAvatar() {
    if (!userId) return
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Photo removed')
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

            {/* ── Avatar with edit controls ── */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Avatar
                name={profile?.full_name}
                avatarUrl={profile?.avatar_url}
                color={profile?.avatar_color}
                size={80}
                style={{ border: '3px solid var(--gold)', fontSize: '2.2rem', fontFamily: 'Fraunces, serif', fontWeight: 600 }}
              />

              {/* Upload button overlay */}
              <button
                className={styles.editAvatarBtn}
                onClick={() => fileInputRef.current?.click()}
                title="Change photo"
                disabled={uploadingAvatar}
                style={{ cursor: uploadingAvatar ? 'wait' : 'pointer' }}
              >
                {uploadingAvatar ? '⏳' : '📷'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarUpload}
              />

              {/* Color picker toggle — shown below upload btn */}
              <button
                onClick={() => setEditColor(!editColor)}
                title="Change color"
                style={{
                  position: 'absolute', bottom: -24, left: '50%', transform: 'translateX(-50%)',
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)',
                  fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                🎨 color
              </button>

              {editColor && (
                <div className={styles.colorPicker}>
                  {COLORS.map(c => (
                    <div key={c} className={styles.colorDot} style={{ background: c }} onClick={() => updateColor(c)} />
                  ))}
                  {profile?.avatar_url && (
                    <button
                      onClick={removeAvatar}
                      style={{ width: '100%', fontSize: '0.72rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '0.25rem', textDecoration: 'underline' }}
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Name / meta ── */}
            <div>
              <h1 className={styles.name}>{profile?.full_name || 'Community Member'}</h1>
              <p className={styles.meta}>
                📍 Zip {profile?.zip_code} · Member since {new Date(profile?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
              <div className={styles.trustRing}>⭐ {profile?.trust_score?.toFixed(1) || '5.0'} Trust Score · {profile?.review_count || 0} reviews</div>
            </div>

            {/* ── Stats ── */}
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
            <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
              ⚙️ Settings
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
                    <ItemCard item={item} onBorrow={() => {}} onFlag={() => {}} isOwnItem />

                    <div style={{
                      position: 'absolute', top: '0.5rem', left: '0.5rem',
                      display: 'flex', gap: '0.35rem', zIndex: 2,
                    }}>
                      <button
                        onClick={() => item.status !== 'loaned' && setEditItem(item)}
                        title={item.status === 'loaned' ? 'Cannot edit while on loan' : 'Edit item'}
                        style={{
                          background: item.status === 'loaned' ? 'rgba(0,0,0,0.25)' : 'rgba(61,43,31,0.75)',
                          color: '#fff', border: 'none', borderRadius: 6,
                          padding: '0.2rem 0.5rem', fontSize: '0.72rem',
                          cursor: item.status === 'loaned' ? 'not-allowed' : 'pointer',
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => archiveItem(item)}
                        title={item.status === 'loaned' ? 'Cannot remove while on loan' : 'Remove item'}
                        style={{
                          background: item.status === 'loaned' ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.55)',
                          color: '#fff', border: 'none', borderRadius: 6,
                          padding: '0.2rem 0.5rem', fontSize: '0.72rem',
                          cursor: item.status === 'loaned' ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    {item.status === 'loaned' && (
                      <div style={{
                        position: 'absolute', bottom: '0.5rem', left: '0.5rem', right: '0.5rem',
                        background: 'rgba(61,43,31,0.7)', color: '#fff', borderRadius: 6,
                        padding: '0.25rem 0.5rem', fontSize: '0.7rem', textAlign: 'center',
                        pointerEvents: 'none',
                      }}>
                        Currently on loan — editing locked
                      </div>
                    )}
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
                      <Avatar
                        name={r.reviewer?.full_name}
                        avatarUrl={r.reviewer?.avatar_url}
                        color={r.reviewer?.avatar_color}
                        size={28}
                      />
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

          {tab === 'settings' && (
            <ProfileSettingsForm
              userId={userId}
              profile={profile}
              onSaved={() => { onProfileUpdate(userId); showToast('Profile updated ✅') }}
              showToast={showToast}
            />
          )}
        </div>
      </div>

      {editItem && (
        <EditItemModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={handleItemSaved}
          showToast={showToast}
        />
      )}
    </div>
  )
}

// ─── Profile Settings Form ────────────────────────────────────────────────────

interface ProfileSettingsFormProps {
  userId: string
  profile: import('@/types').Profile | null
  onSaved: () => void
  showToast: AppCtx['showToast']
}

function ProfileSettingsForm({ userId, profile, onSaved, showToast }: ProfileSettingsFormProps) {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    zip_code: profile?.zip_code || '',
  })

  // Keep form in sync if profile loads after mount
  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || '', zip_code: profile.zip_code || '' })
  }, [profile?.full_name, profile?.zip_code])

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const patch: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        zip_code: form.zip_code.trim(),
      }

      // Re-geocode if zip changed
      if (form.zip_code.trim() !== profile?.zip_code) {
        try {
          const res = await fetch(`https://api.zippopotam.us/us/${form.zip_code.trim()}`)
          if (res.ok) {
            const data = await res.json()
            const place = data.places?.[0]
            if (place) {
              patch.lat = parseFloat(place.latitude)
              patch.lng = parseFloat(place.longitude)
            }
          }
        } catch { /* optional geocode */ }
      }

      const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
      if (error) throw error
      onSaved()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not save changes', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.2rem', marginBottom: '1.5rem' }}>Edit Profile</h2>
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="label">Display Name</label>
          <input
            className="input"
            value={form.full_name}
            onChange={set('full_name')}
            placeholder="Your name"
            required
          />
        </div>
        <div className="form-group">
          <label className="label">Zip Code</label>
          <input
            className="input"
            value={form.zip_code}
            onChange={set('zip_code')}
            placeholder="12345"
            maxLength={5}
            pattern="\d{5}"
            title="5-digit US zip code"
            required
          />
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
            Changing your zip will update your location for radius filtering.
          </p>
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ minWidth: 140 }}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}

// ─── Edit Item Modal ───────────────────────────────────────────────────────────

interface EditItemModalProps {
  item: Item
  onClose: () => void
  onSave: (updated: Item) => void
  showToast: AppCtx['showToast']
}

const OFFER_OPTIONS: { value: OfferType; label: string }[] = [
  { value: 'lend',   label: '🤝 Lend / Borrow' },
  { value: 'swap',   label: '🔄 Permanent Swap' },
  { value: 'barter', label: '⚖️ Barter' },
  { value: 'free',   label: '🎁 Free / Give Away' },
]

const CONDITION_OPTIONS: { value: Condition; label: string }[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good',      label: 'Good' },
  { value: 'fair',      label: 'Fair' },
]

function EditItemModal({ item, onClose, onSave, showToast }: EditItemModalProps) {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: item.title,
    author_creator: item.author_creator ?? '',
    offer_type: item.offer_type,
    condition: item.condition,
    notes: item.notes ?? '',
  })

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const patch = {
        title: form.title,
        author_creator: form.author_creator || null,
        offer_type: form.offer_type,
        condition: form.condition,
        notes: form.notes || null,
      }
      const { error } = await supabase.from('items').update(patch).eq('id', item.id)
      if (error) throw error
      onSave({ ...item, ...patch })
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not save changes', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={modalStyles.modal}>
        <button className={modalStyles.close} onClick={onClose}>✕</button>
        <h2 className={modalStyles.title}>Edit Item</h2>
        <p className={modalStyles.subtitle} style={{ marginBottom: '1.25rem' }}>
          {item.category} · Currently <strong style={{ color: item.status === 'available' ? 'var(--sage)' : 'var(--muted)' }}>{item.status}</strong>
        </p>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={set('title')} required />
          </div>
          <div className="form-group">
            <label className="label">Author / Creator</label>
            <input className="input" value={form.author_creator} onChange={set('author_creator')} placeholder="e.g. Toni Morrison, Stanley Kubrick…" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="label">Offer Type</label>
              <select className="input" value={form.offer_type} onChange={set('offer_type')}>
                {OFFER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Condition</label>
              <select className="input" value={form.condition} onChange={set('condition')}>
                {CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} placeholder="Any details worth knowing…" />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
