'use client'
import styles from './ItemCard.module.css'

const EMOJIS: Record<string, string> = {
  Book: '📚', DVD: '🎬', VHS: '📼', CD: '🎵',
  Game: '🎲', Tool: '🔧', 'Home Good': '🏠', Other: '📦'
}

export default function ItemCard({ item, onBorrow, onFlag }: any) {
  const emoji = EMOJIS[item.category] || '📦'
  const isAvailable = item.status === 'available'

  return (
    <div className={styles.card}>
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
            <span className="avatar" style={{ background: item.profiles?.avatar_color || '#C4622D', width:22, height:22, fontSize:'0.65rem' }}>
              {item.profiles?.full_name?.[0] || '?'}
            </span>
            <span>{item.profiles?.full_name?.split(' ')[0] || 'Neighbor'}</span>
            <span className="trust">⭐{item.profiles?.trust_score?.toFixed(1) || '5.0'}</span>
          </div>
          <div className={styles.actions}>
            {isAvailable ? (
              <button className="btn btn-primary btn-sm" onClick={() => onBorrow(item)}>Borrow</button>
            ) : (
              <button className="btn btn-outline btn-sm" disabled>On Loan</button>
            )}
            <button className={styles.flagBtn} onClick={() => onFlag(item)} title="Flag this listing">🚩</button>
          </div>
        </div>
      </div>
    </div>
  )
}
