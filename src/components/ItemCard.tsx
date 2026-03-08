'use client'
import { useState } from 'react'
import Avatar from './Avatar'
import ItemDetailModal from './ItemDetailModal'
import styles from './ItemCard.module.css'
import type { Item } from '@/types'

const EMOJIS: Record<string, string> = {
  Book: '📚', DVD: '🎬', VHS: '📼', CD: '🎵',
  Game: '🎲', Tool: '🔧', 'Home Good': '🏠', Other: '📦',
}

interface ItemCardProps {
  item: Item
  onBorrow: (item: Item) => void
  onFlag: (item: Item) => void
  onReportUser?: (userId: string, userName: string) => void
  isOwnItem?: boolean
}

export default function ItemCard({ item, onBorrow, onFlag, onReportUser, isOwnItem }: ItemCardProps) {
  const [showDetail, setShowDetail] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const emoji = EMOJIS[item.category] || '📦'
  const isAvailable = item.status === 'available'

  return (
    <>
      <div className={styles.card} onClick={() => setShowDetail(true)} style={{ cursor: 'pointer' }}>
        <div className={styles.imgArea} style={{ background: `linear-gradient(135deg, ${item.profiles?.avatar_color || '#C4622D'}22, ${item.profiles?.avatar_color || '#5A7A5C'}33)` }}>
          <span className={styles.emoji}>{emoji}</span>
          {item.cover_image_url && (
            <img src={item.cover_image_url} alt={item.title} className={styles.coverImg} />
          )}
          <span className={`badge ${isAvailable ? 'badge-available' : 'badge-loaned'} ${styles.badge}`}>
            {isAvailable ? 'Available' : 'On Loan'}
          </span>
        </div>
        <div className={styles.body}>
          <div className={styles.typePill}>{item.category}</div>
          <h3 className={styles.title}>{item.title}</h3>
          {item.author_creator && <p className={styles.sub}>{item.author_creator}</p>}
          {item.metadata?.year && <p className={styles.sub}>{item.metadata.year} · {item.metadata.genre || ''}</p>}
          <div className={styles.footer}>
            <div className={styles.user}>
              <Avatar
                name={item.profiles?.full_name}
                avatarUrl={item.profiles?.avatar_url}
                color={item.profiles?.avatar_color}
                size={22}
                fontSize="0.65rem"
              />
              <span>{item.profiles?.full_name?.split(' ')[0] || 'Neighbor'}</span>
              <span className="trust">⭐{item.profiles?.trust_score?.toFixed(1) || '5.0'}</span>
            </div>
            <div className={styles.actions}>
              {isAvailable ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={e => { e.stopPropagation(); onBorrow(item) }}
                >
                  Borrow
                </button>
              ) : (
                <button className="btn btn-outline btn-sm" disabled>On Loan</button>
              )}

              {/* ⋯ menu — flag item + report user */}
              {!isOwnItem && (
                <div style={{ position: 'relative' }}>
                  <button
                    className={styles.flagBtn}
                    onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
                    title="Options"
                  >
                    ⋯
                  </button>
                  {menuOpen && (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: 'absolute', bottom: 'calc(100% + 4px)', right: 0,
                        background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 10,
                        minWidth: 170, overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => { setMenuOpen(false); onFlag(item) }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '0.65rem 1rem', fontSize: '0.83rem', background: 'none',
                          border: 'none', cursor: 'pointer', color: 'var(--bark)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        🚩 Flag this listing
                      </button>
                      {onReportUser && item.profiles?.full_name && (
                        <button
                          onClick={() => {
                            setMenuOpen(false)
                            onReportUser(item.user_id, item.profiles?.full_name || 'this user')
                          }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '0.65rem 1rem', fontSize: '0.83rem', background: 'none',
                            border: 'none', cursor: 'pointer', color: '#C62828',
                            borderTop: '1px solid var(--border)',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#FEECEC')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          🚨 Report user
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDetail && (
        <ItemDetailModal
          item={item}
          onClose={() => setShowDetail(false)}
          onBorrow={onBorrow}
          onFlag={onFlag}
          isOwnItem={isOwnItem}
        />
      )}
    </>
  )
}
