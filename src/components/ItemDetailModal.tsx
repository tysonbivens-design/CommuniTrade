'use client'
import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import styles from './ItemDetailModal.module.css'
import type { Item } from '@/types'

const CONDITION_LABEL: Record<string, string> = {
  excellent: '✨ Excellent',
  good: '👍 Good',
  fair: '🤷 Fair',
}

const OFFER_LABEL: Record<string, string> = {
  lend:   '🤝 Available to Borrow',
  swap:   '🔄 Permanent Swap',
  barter: '⚖️ Open to Barter',
  free:   '🎁 Free / Give Away',
}

function getActionLabel(offerType: string): string {
  switch (offerType) {
    case 'free':   return 'Claim This Item'
    case 'swap':   return 'Request a Swap'
    case 'barter': return 'Propose a Trade'
    case 'lend':
    default:       return 'Request to Borrow'
  }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://communitrade.app'

interface ItemDetailModalProps {
  item: Item
  onClose: () => void
  onBorrow: (item: Item) => void
  onFlag: (item: Item) => void
  isOwnItem?: boolean
}

export default function ItemDetailModal({ item, onClose, onBorrow, onFlag, isOwnItem }: ItemDetailModalProps) {
  const isAvailable = item.status === 'available'
  const [copied, setCopied] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleShare() {
    const url = `${APP_URL}?item=${item.id}`
    if (navigator.share) {
      navigator.share({
        title: item.title,
        text: `Check out "${item.title}" on CommuniTrade — free community lending and trading!`,
        url,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {})
    }
  }

  const emoji = { Book: '📚', DVD: '🎬', VHS: '📼', CD: '🎵', Game: '🎲', Tool: '🔧', 'Home Good': '🏠', Other: '📦' }[item.category] || '📦'
  const actionLabel = getActionLabel(item.offer_type)

  return (
    <>
      <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div className={styles.modal}>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>

          {/* Cover image / emoji hero */}
          <div
            className={styles.hero}
            style={{
              background: `linear-gradient(135deg, ${item.profiles?.avatar_color || '#C4622D'}33, ${item.profiles?.avatar_color || '#5A7A5C'}22)`,
              cursor: item.cover_image_url ? 'zoom-in' : 'default',
            }}
            onClick={() => item.cover_image_url && setLightbox(true)}
          >
            {item.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.cover_image_url} alt={item.title} className={styles.coverImg} />
            ) : (
              <span className={styles.heroEmoji}>{emoji}</span>
            )}
            <span className={`badge ${isAvailable ? 'badge-available' : 'badge-loaned'} ${styles.heroBadge}`}>
              {isAvailable ? 'Available' : 'On Loan'}
            </span>
            {item.cover_image_url && (
              <span style={{
                position: 'absolute', bottom: '0.5rem', right: '0.5rem',
                background: 'rgba(0,0,0,0.45)', color: '#fff', borderRadius: 6,
                padding: '0.2rem 0.5rem', fontSize: '0.7rem', backdropFilter: 'blur(4px)',
              }}>
                tap to expand
              </span>
            )}
          </div>

          <div className={styles.body}>
            <span className={styles.categoryPill}>{item.category}</span>
            <h2 className={styles.title}>{item.title}</h2>
            {item.author_creator && <p className={styles.author}>{item.author_creator}</p>}

            <div className={styles.metaRow}>
              {item.metadata?.year && <span>{item.metadata.year}</span>}
              {item.metadata?.genre && <span>{item.metadata.genre}</span>}
              {item.condition && <span>{CONDITION_LABEL[item.condition] || item.condition}</span>}
            </div>

            <div className={styles.pillRow}>
              <span className={styles.offerPill}>{OFFER_LABEL[item.offer_type] || item.offer_type}</span>
            </div>

            {item.notes && (
              <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: '1rem', fontStyle: 'italic', lineHeight: 1.6 }}>
                {item.notes}
              </p>
            )}

            {item.profiles && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--cream)', borderRadius: 8 }}>
                <Avatar name={item.profiles.full_name} avatarUrl={item.profiles.avatar_url} color={item.profiles.avatar_color} size={32} />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{item.profiles.full_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>⭐ {item.profiles.trust_score?.toFixed(1) || '5.0'} trust score</div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {!isOwnItem && (
                isAvailable ? (
                  <button
                    className="btn btn-primary btn-lg"
                    style={{ flex: 1 }}
                    onClick={() => { onClose(); onBorrow(item) }}
                  >
                    {actionLabel}
                  </button>
                ) : (
                  <button className="btn btn-outline btn-lg" style={{ flex: 1 }} disabled>
                    Currently On Loan
                  </button>
                )
              )}

              {/* Share button */}
              <button
                onClick={handleShare}
                title="Share this item"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.6rem 0.9rem', borderRadius: 8, fontSize: '0.85rem',
                  border: '1.5px solid var(--border)',
                  background: copied ? 'var(--sage)' : '#fff',
                  color: copied ? '#fff' : 'var(--bark)',
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
                  transition: 'all 0.2s', flexShrink: 0,
                }}
              >
                {copied ? '✓ Copied!' : '🔗 Share'}
              </button>

              {!isOwnItem && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { onClose(); onFlag(item) }}
                  title="Flag this listing"
                  style={{ color: 'var(--muted)', fontSize: '1rem', flexShrink: 0 }}
                >
                  🚩
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen lightbox */}
      {lightbox && item.cover_image_url && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
            cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.cover_image_url}
            alt={item.title}
            style={{
              maxWidth: '100%', maxHeight: '90vh',
              objectFit: 'contain', borderRadius: 8,
              boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
            }}
          />
          <button
            onClick={() => setLightbox(false)}
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', borderRadius: '50%', width: 36, height: 36,
              fontSize: '1.1rem', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
