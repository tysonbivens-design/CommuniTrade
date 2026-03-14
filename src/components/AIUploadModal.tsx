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

function compressImage(file: File, maxSizePx = 1600, quality = 0.82): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSizePx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('Compression failed')); return }
          const reader = new FileReader()
          reader.onload = () => resolve({
            base64: (reader.result as string).split(',')[1],
            mediaType: 'image/jpeg',
          })
          reader.onerror = reject
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = reject
    img.src = url
  })
}

async function fetchIGDBCover(title: string): Promise<{ cover_url: string | null; year: number | null; genres: string[] }> {
  const res = await fetch('/api/igdb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) return { cover_url: null, year: null, genres: [] }
  return res.json()
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
      const { base64, mediaType } = await compressImage(file)
      const res = await fetch('/api/ai-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType, userId }),
      })
      if (res.status === 429) {
        const data = await res.json()
        throw new Error(data.error || 'Daily upload limit reached. Try again tomorrow.')
      }
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      if (!data.items?.length) throw new Error('No items found in photo')
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

  function setItemOfferType(i: number, value: OfferType) {
    setExtracted(prev => prev.map((item, idx) => idx === i ? { ...item, offer_type: value } : item))
  }

  function applyGlobalOfferType(value: OfferType) {
    setGlobalOfferType(value)
    setExtracted(prev => prev.map(item => ({ ...item, offer_type: value })))
  }

  async function addSelected() {
    setLoading(true)
    try {
      const toAdd = extracted.filter((_, i) => selected.has(i))

      // Enrich with cover art in parallel — Books, DVDs/VHS, and now Games
      const enriched = await Promise.all(toAdd.map(async item => {
        let cover_image_url: string | null = null
        let metadata: Record<string, unknown> = {}

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
            if (data.Year) metadata = { year: parseInt(data.Year), genre: data.Genre?.split(',')[0] }
          } catch { /* optional */ }
        }

        if (item.category === 'Game' && item.title) {
          try {
            const igdb = await fetchIGDBCover(item.title)
            if (igdb.cover_url) cover_image_url = igdb.cover_url
            if (igdb.year || igdb.genres.length) {
              metadata = { year: igdb.year ?? undefined, genre: igdb.genres[0] ?? undefined }
            }
          } catch { /* optional */ }
        }

        return {
          title: item.title,
          author_creator: item.author_creator || null,
          category: item.category,
          condition: item.condition,
          offer_type: item.offer_type,
          cover_image_url,
          metadata: Object.keys(metadata).length ? metadata : undefined,
        }
      }))

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
      <div className={modalStyles.modal}>
        <button className={modalStyles.close} onClick={onClose}>✕</button>
        <h2 className={modalStyles.title}>AI Catalog Upload</h2>
        <p className={modalStyles.subtitle}>
          {stage === 'upload' && 'Snap a photo of your shelf — AI will identify everything'}
          {stage === 'processing' && 'Scanning your photo…'}
          {stage === 'review' && `Found ${extracted.length} item${extracted.length !== 1 ? 's' : ''} — review and add`}
        </p>

        {stage === 'upload' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
            <label style={{
              display: 'inline-block', padding: '0.9rem 2rem',
              background: 'var(--bark)', color: '#fff', borderRadius: 10,
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
            }}>
              Choose Photo
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
            </label>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '1rem' }}>
              Works best with books, DVDs, games, and CDs. Limit 5 uploads/day.
            </p>
          </div>
        )}

        {stage === 'processing' && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <span className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
            <p style={{ color: 'var(--muted)', marginTop: '1.5rem' }}>Analyzing your photo…</p>
          </div>
        )}

        {stage === 'review' && (
          <div>
            {/* Global offer type */}
            <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--cream)', borderRadius: 8 }}>
              <label className="label" style={{ marginBottom: '0.4rem', display: 'block' }}>Apply offer type to all</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {OFFER_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => applyGlobalOfferType(o.value)}
                    style={{
                      padding: '0.3rem 0.75rem', borderRadius: 6, fontSize: '0.82rem',
                      border: '1.5px solid var(--border)', cursor: 'pointer',
                      background: globalOfferType === o.value ? 'var(--bark)' : '#fff',
                      color: globalOfferType === o.value ? '#fff' : 'var(--bark)',
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Item list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {extracted.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem', borderRadius: 8,
                  border: `1.5px solid ${selected.has(i) ? 'var(--sage)' : 'var(--border)'}`,
                  background: selected.has(i) ? 'rgba(90,122,92,0.06)' : '#fff',
                  cursor: 'pointer',
                }} onClick={() => toggleItem(i)}>
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggleItem(i)}
                    style={{ width: 18, height: 18, flexShrink: 0 }} onClick={e => e.stopPropagation()} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {item.category}{item.author_creator ? ` · ${item.author_creator}` : ''} · {item.condition}
                    </div>
                  </div>
                  <select
                    value={item.offer_type}
                    onChange={e => { e.stopPropagation(); setItemOfferType(i, e.target.value as OfferType) }}
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: '0.78rem', padding: '0.25rem 0.4rem', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}
                  >
                    {OFFER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
              {loading ? <span className="spinner" /> : `Add ${selected.size} Item${selected.size !== 1 ? 's' : ''} to Shelf`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
