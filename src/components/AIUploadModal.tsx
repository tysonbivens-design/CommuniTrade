'use client'
import { useState } from 'react'
import modalStyles from './Modal.module.css'
import type { ItemCategory, Condition, OfferType, AppCtx } from '@/types'

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
  offer_type: OfferType
}

const OFFER_OPTIONS: { value: OfferType; label: string }[] = [
  { value: 'lend', label: '🤝 Lend' },
  { value: 'swap', label: '🔄 Swap' },
  { value: 'barter', label: '⚖️ Barter' },
  { value: 'free', label: '🎁 Free' },
]

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function AIUploadModal({ userId, onClose, onSuccess, showToast }: AIUploadModalProps) {
  const [stage, setStage] = useState<'upload' | 'processing' | 'review'>('upload')
  const [extracted, setExtracted] = useState<ExtractedItem[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [globalOfferType, setGlobalOfferType] = useState<OfferType>('lend')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStage('processing')
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/ai-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: file.type, userId }),
      })
      if (res.status === 429) {
        const data = await res.json()
        throw new Error(data.error || 'Daily upload limit reached. Try again tomorrow.')
      }
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      if (!data.items?.length) throw new Error('No items found in photo')
      // Inject default offer_type into each extracted item
      setExtracted(data.items.map((item: Omit<ExtractedItem, 'offer_type'>) => ({ ...item, offer_type: 'lend' as OfferType })))
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

  // Update a single item's offer_type
  function setItemOfferType(i: number, value: OfferType) {
    setExtracted(prev => prev.map((item, idx) => idx === i ? { ...item, offer_type: value } : item))
  }

  // Apply global offer type to all items
  function applyGlobalOfferType(value: OfferType) {
    setGlobalOfferType(value)
    setExtracted(prev => prev.map(item => ({ ...item, offer_type: value })))
  }

  async function addSelected() {
    setLoading(true)
    try {
      const toAdd = extracted.filter((_, i) => selected.has(i))

      // Enrich with cover art in parallel
      const enriched = await Promise.all(toAdd.map(async item => {
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
        if ((item.category === 'DVD' || item.category === 'VHS') && item.title) {
          try {
            const res = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(item.title)}&apikey=${process.env.NEXT_PUBLIC_OMDB_API_KEY || 'd5714ece'}`)
            const data = await res.json()
            if (data.Poster && data.Poster !== 'N/A') cover_image_url = data.Poster
          } catch { /* optional */ }
        }
        return {
          title: item.title,
          author_creator: item.author_creator || null,
          category: item.category,
          condition: item.condition,
          offer_type: item.offer_type,
          cover_image_url,
        }
      }))

      // Single API call — spam + cap checks happen server-side
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, items: enriched }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not save items')

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
            <p style={{ marginBottom: '0.75rem', fontWeight: 500 }}>
              Found {extracted.length} items — select which to add:
            </p>

            {/* Global offer type selector */}
            <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--bark)', whiteSpace: 'nowrap' }}>
                Set all to:
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {OFFER_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => applyGlobalOfferType(o.value)}
                    style={{
                      padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 500,
                      border: `1.5px solid ${globalOfferType === o.value ? 'var(--bark)' : 'var(--border)'}`,
                      background: globalOfferType === o.value ? 'var(--bark)' : '#fff',
                      color: globalOfferType === o.value ? '#fff' : 'var(--muted)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Per-item list */}
            <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {extracted.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem',
                    background: selected.has(i) ? '#F0FAF0' : 'var(--cream)',
                    border: `1.5px solid ${selected.has(i) ? 'var(--sage)' : 'var(--border)'}`,
                    borderRadius: 8, opacity: selected.has(i) ? 1 : 0.5, transition: 'all 0.15s',
                  }}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggleItem(i)}
                    style={{ flexShrink: 0, accentColor: 'var(--sage)', width: 16, height: 16, cursor: 'pointer' }}
                  />

                  {/* Title + author */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {item.author_creator ? `${item.author_creator} · ` : ''}{item.category}
                    </div>
                  </div>

                  {/* Per-item offer type */}
                  <select
                    value={item.offer_type}
                    onChange={e => setItemOfferType(i, e.target.value as OfferType)}
                    disabled={!selected.has(i)}
                    style={{
                      fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: 6,
                      border: '1.5px solid var(--border)', background: '#fff',
                      color: 'var(--bark)', cursor: selected.has(i) ? 'pointer' : 'default',
                      fontFamily: 'DM Sans, sans-serif', flexShrink: 0,
                    }}
                  >
                    {OFFER_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={addSelected}
              disabled={loading || selected.size === 0}
            >
              {loading ? <span className="spinner" /> : `Add ${selected.size} item${selected.size !== 1 ? 's' : ''} to My Shelf`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
