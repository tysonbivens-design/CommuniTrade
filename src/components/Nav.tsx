'use client'
import { useState } from 'react'
import styles from './Nav.module.css'

export default function Nav({ page, setPage, user, profile, notifCount, onSignIn, onSignUp, onSignOut }: any) {
  const [locationOpen, setLocationOpen] = useState(false)

  return (
    <nav className={styles.nav}>
      <div className={styles.logo} onClick={() => setPage('home')}>
        Communi<span>Trade</span>
      </div>

      <div className={styles.links}>
        {(['home','library','barter'] as const).map(p => (
          <button key={p} className={`${styles.link} ${page === p ? styles.active : ''}`} onClick={() => setPage(p)}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        {user && (
          <>
            <button className={`${styles.link} ${page === 'loans' ? styles.active : ''}`} onClick={() => setPage('loans')}>My Loans</button>
            <button className={`${styles.link} ${page === 'notifications' ? styles.active : ''}`} onClick={() => setPage('notifications')}>
              Notifications {notifCount > 0 && <span className={styles.badge}>{notifCount}</span>}
            </button>
            {profile?.is_admin && (
              <button className={`${styles.link} ${page === 'admin' ? styles.active : ''}`} onClick={() => setPage('admin')}>Admin</button>
            )}
          </>
        )}
      </div>

      <div className={styles.actions}>
        <div className={styles.locationPill} onClick={() => setLocationOpen(!locationOpen)}>
          📍 Denver, CO · 5mi
        </div>
        {user ? (
          <div className={styles.userMenu}>
            <button className={styles.userBtn} onClick={() => setPage('profile')}>
              <span className={styles.avatarSmall} style={{ background: profile?.avatar_color || '#C4622D' }}>
                {profile?.full_name?.[0] || 'U'}
              </span>
              {profile?.full_name?.split(' ')[0] || 'Account'}
            </button>
            <button className={`${styles.navBtn} ${styles.outline}`} onClick={onSignOut}>Sign out</button>
          </div>
        ) : (
          <>
            <button className={`${styles.navBtn} ${styles.outline}`} onClick={onSignIn}>Sign in</button>
            <button className={`${styles.navBtn} ${styles.primary}`} onClick={onSignUp}>Join Free</button>
          </>
        )}
      </div>
    </nav>
  )
}
