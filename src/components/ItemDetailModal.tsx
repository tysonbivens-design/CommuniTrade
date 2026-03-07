'use client'
import Avatar from './Avatar'
import modalStyles from './Modal.module.css'
import styles from './ItemDetailModal.module.css'
import type { Item, AppCtx } from '@/types'

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

interface ItemDetailModalProps {
  item: Item
  onClose: () => void
  onBorrow: (item: Item) => void
  onFlag: (item: Item) => void
  isOwnItem?: boolean
}

export default function ItemDetailModal({ item, onClose, onBorrow, onFlag, isOwnItem }: ItemDetailModalProps) {
  const isAvailable = item.status === 'available'

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${modalStyles.modal} ${styles.detailModal}`}>
        <button className={modalStyles.close} onClick={onClose}>✕</button>

        {/* Cover image / emoji hero */}
        <div className={styles.hero} style={{
          background: `linear-gradient(135deg, ${item.profiles?.avatar_color || '#C4622D'}33, ${item.profiles?.avatar_color || '#5A7A5C'}22)`
        }}>
          {item.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.cover_image_url} alt={item.title} className={styles.coverImg} />
          ) : (
            <span className={styles.heroEmoji}>
              {{ Book: '📚', DVD: '🎬', VHS: '📼', CD: '🎵', Game: '🎲', Tool: '🔧', 'Home Good': '🏠', Other: '📦' }[item.category] || '📦'}
            </span>
          )}
          <span className={`badge ${isAvailable ? 'badge-available' : 'badge-loaned'} ${styles.heroBadge}`}>
            {isAvailable ? 'Available' : 'On Loan'}
          </span>
        </div>

        {/* Content */}
        <div className={styles.body}>
          <div className={styles.categoryPill}>{item.category}</div>
          <h2 className={styles.title}>{item.title}</h2>
          {item.author_creator && (
            <p className={styles.author}>{item.author_creator}</p>
          )}

          {/* Metadata row */}
          {(item.metadata?.year || item.metadata?.genre || item.metadata?.publisher) && (
            <div className={styles.metaRow}>
              {item.metadata.year && <span>{item.metadata.year}</span>}
              {item.metadata.genre && <span>{item.metadata.genre}</span>}
              {item.metadata.publisher && <span>{item.metadata.publisher}</span>}
            </div>
          )}

          {/* Offer + condition pills */}
          <div className={styles.pillRow}>
            <span className={styles.offerPill}>{OFFER_LABEL[item.offer_type] || item.offer_type}</span>
            <span className={styles.conditionPill}>{CONDITION_LABEL[item.condition] || item.condition}</span>
          </div>

          {/* Notes */}
          {item.notes && (
            <div className={styles.notes}>
              <p className={styles.notesLabel}>Notes from owner</p>
              <p className={styles.notesText}>{item.notes}</p>
            </div>
          )}

          {/* Lender info */}
          <div className={styles.lenderRow}>
            <Avatar
              name={item.profiles?.full_name}
              avatarUrl={item.profiles?.avatar_url}
              color={item.profiles?.avatar_color}
              size={36}
            />
            <div>
              <p className={styles.lenderName}>{item.profiles?.full_name || 'A neighbor'}</p>
              <p className={styles.lenderTrust}>⭐ {item.profiles?.trust_score?.toFixed(1) || '5.0'} trust score</p>
            </div>
          </div>

          {/* Actions */}
          {!isOwnItem && (
            <div className={styles.actions}>
              {isAvailable ? (
                <button
                  className="btn btn-primary btn-lg"
                  style={{ flex: 1 }}
                  onClick={() => { onClose(); onBorrow(item) }}
                >
                  Request to Borrow 📬
                </button>
              ) : (
                <button className="btn btn-outline btn-lg" style={{ flex: 1 }} disabled>
                  Currently On Loan
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { onClose(); onFlag(item) }}
                title="Flag this listing"
                style={{ color: 'var(--muted)', fontSize: '1rem' }}
              >
                🚩
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
