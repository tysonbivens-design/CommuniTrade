'use client'
import { useState, useEffect } from 'react'
import styles from './Nav.module.css'

async function getLocationLabel(zipCode?: string): Promise<string> {
  // Logged-in user with a zip code — look it up
  if (zipCode) {
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zipCode}`)
      if (res.ok) {
        const data = await res.json()
        const place = data.places?.[0]
        if (place) return `${place['place name']}, ${place['state abbreviation']}`
      }
    } catch {}
    return zipCode // fallback: just show the zip
  }

  // Logged-out user — approximate from IP
  try {
    const res = await fetch('https://ipapi.co/json/')
    if (res.ok) {
      const data = await res.json()
      if (data.city && data.region_code) return `${data.city}, ${data.region_code}`
    }
  } catch {}

  return 'Your Area'
}

export default function Nav({ page, setPage, user, profile, notifCount, onSignIn, onSignUp, onSignOut }: any) {
  const [locationLabel, setLocationLabel] = useState('...')

  useEffect(() => {
    // Re-run whenever login state or profile zip changes
    getLocationLabel(profile?.zip_code).then(setLocationLabel)
  }, [profile?.zip_code, user])

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
        <div className={styles.locationPill}>
          📍 {locationLabel}
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
