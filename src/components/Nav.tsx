'use client'
import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Profile, Page } from '@/types'
import styles from './Nav.module.css'

// ─── Location helpers ──────────────────────────────────────────────────────
let ipLocationCache: { label: string; lat: number; lng: number } | null = null

async function zipToLocation(zip: string): Promise<{ label: string; lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) return null
    const data = await res.json()
    const place = data.places?.[0]
    if (!place) return null
    return {
      label: `${place['place name']}, ${place['state abbreviation']}`,
      lat: parseFloat(place.latitude),
      lng: parseFloat(place.longitude)
    }
  } catch { return null }
}

async function ipLocation(): Promise<{ label: string; lat: number; lng: number } | null> {
  if (ipLocationCache) return ipLocationCache
  try {
    const res = await fetch('https://ipapi.co/json/')
    if (!res.ok) return null
    const data = await res.json()
    if (data.city && data.region_code) {
      ipLocationCache = { label: `${data.city}, ${data.region_code}`, lat: data.latitude, lng: data.longitude }
      return ipLocationCache
    }
  } catch {}
  return null
}

interface NavProps {
  page: Page
  setPage: (page: Page) => void
  user: User | null
  profile: Profile | null
  notifCount: number
  onSignIn: () => void
  onSignUp: () => void
  onSignOut: () => void
}

export default function Nav({ page, setPage, user, profile, notifCount, onSignIn, onSignUp, onSignOut }: NavProps) {
  const [locationLabel, setLocationLabel] = useState('...')
  const [radius, setRadius]               = useState(100)
  const [pillOpen, setPillOpen]           = useState(false)
  const [drawerOpen, setDrawerOpen]       = useState(false)
  const [saving, setSaving]               = useState(false)
  const pillRef  = useRef<HTMLDivElement>(null)
  const supabase = createBrowserClient()

  // Resolve location — only re-runs when zip or login state changes
  useEffect(() => {
    let cancelled = false
    async function init() {
      if (user && profile?.zip_code) {
        if (profile.radius_miles) setRadius(profile.radius_miles)
        const loc = await zipToLocation(profile.zip_code)
        if (cancelled) return
        if (loc) {
          setLocationLabel(loc.label)
          if (!profile.lat || !profile.lng) {
            supabase.from('profiles').update({ lat: loc.lat, lng: loc.lng }).eq('id', user.id)
          }
        } else {
          setLocationLabel(profile.zip_code)
        }
      } else if (!user) {
        const loc = await ipLocation()
        if (!cancelled) setLocationLabel(loc?.label || 'Your Area')
      }
    }
    init()
    return () => { cancelled = true }
  }, [profile?.zip_code, profile?.radius_miles, user?.id])

  // Close desktop dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) setPillOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close drawer when page changes
  useEffect(() => { setDrawerOpen(false) }, [page])

  // Lock scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  async function saveRadius() {
    if (!user) return
    setSaving(true)
    await supabase.from('profiles').update({ radius_miles: radius }).eq('id', user.id)
    setSaving(false)
    setPillOpen(false)
    setDrawerOpen(false)
  }

  function navigate(p: Page) { setPage(p); setDrawerOpen(false) }

  const bottomTabs: { page: Page; icon: string; label: string }[] = user
    ? [
        { page: 'home',          icon: '🏠', label: 'Home' },
        { page: 'library',       icon: '📚', label: 'Library' },
        { page: 'barter',        icon: '🤝', label: 'Barter' },
        { page: 'loans',         icon: '📦', label: 'Loans' },
        { page: 'notifications', icon: '🔔', label: 'Alerts' },
      ]
    : [
        { page: 'home',    icon: '🏠', label: 'Home' },
        { page: 'library', icon: '📚', label: 'Library' },
        { page: 'barter',  icon: '🤝', label: 'Barter' },
      ]

  return (
    <>
      {/* ─── TOP NAV ────────────────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.logo} onClick={() => navigate('home')}>
          Communi<span>Trade</span>
        </div>

        {/* Desktop center links */}
        <div className={styles.links}>
          {(['home', 'library', 'barter'] as const).map(p => (
            <button key={p} className={`${styles.link} ${page === p ? styles.active : ''}`} onClick={() => navigate(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          {user && (
            <>
              <button className={`${styles.link} ${page === 'loans' ? styles.active : ''}`} onClick={() => navigate('loans')}>My Loans</button>
              <button className={`${styles.link} ${page === 'notifications' ? styles.active : ''}`} onClick={() => navigate('notifications')}>
                Notifications {notifCount > 0 && <span className={styles.badge}>{notifCount}</span>}
              </button>
              {profile?.is_admin && (
                <button className={`${styles.link} ${page === 'admin' ? styles.active : ''}`} onClick={() => navigate('admin')}>Admin</button>
              )}
            </>
          )}
        </div>

        {/* Desktop right actions */}
        <div className={styles.actions}>
          {/* Location pill — desktop only */}
          <div style={{ position: 'relative' }} ref={pillRef}>
            <div
              className={styles.locationPill}
              onClick={() => user && setPillOpen(o => !o)}
              style={{ cursor: user ? 'pointer' : 'default' }}
            >
              📍 {locationLabel}
              {user && <span style={{ opacity: 0.6, fontSize: '0.72rem' }}>· {radius}mi</span>}
            </div>
            {pillOpen && user && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: '#fff', borderRadius: 12, padding: '1.25rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)', width: 260, zIndex: 200,
                border: '1px solid var(--border)'
              }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '0.75rem' }}>Search Radius</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--bark)' }}>📍 {locationLabel}</span>
                  <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, color: 'var(--rust)' }}>{radius} mi</span>
                </div>
                <input type="range" min={5} max={200} step={5} value={radius}
                  onChange={e => setRadius(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--rust)', marginBottom: '0.35rem' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                  <span>5 mi</span><span>200 mi</span>
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveRadius} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Radius'}
                </button>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.6rem', textAlign: 'center' }}>
                  Library & Barter filter to this range
                </p>
              </div>
            )}
          </div>

          {/* Desktop auth buttons */}
          <div className={styles.desktopAuthOnly}>
            {user ? (
              <div className={styles.userMenu}>
                <button className={styles.userBtn} onClick={() => navigate('profile')}>
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

          {/* Hamburger — mobile only */}
          <button
            className={`${styles.hamburger} ${drawerOpen ? styles.open : ''}`}
            onClick={() => setDrawerOpen(o => !o)}
            aria-label="Menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* ─── SLIDE-OUT DRAWER ───────────────────────────────────────── */}
      <div
        className={`${styles.drawerOverlay} ${drawerOpen ? styles.open : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <div className={`${styles.drawer} ${drawerOpen ? styles.open : ''}`}>

        {/* User row */}
        {user && (
          <div className={styles.drawerUserRow}>
            <span className={styles.drawerAvatarLg} style={{ background: profile?.avatar_color || '#C4622D' }}>
              {profile?.full_name?.[0] || 'U'}
            </span>
            <div>
              <div className={styles.drawerUserName}>{profile?.full_name || 'Account'}</div>
              <div className={styles.drawerUserSub}>Trust ⭐{profile?.trust_score?.toFixed(1) || '5.0'}</div>
            </div>
          </div>
        )}

        {/* All nav links */}
        {(([
          { p: 'home',    icon: '🏠', label: 'Home' },
          { p: 'library', icon: '📚', label: 'Library' },
          { p: 'barter',  icon: '🤝', label: 'Barter' },
          ...(user ? [
            { p: 'loans',         icon: '📦', label: 'My Loans' },
            { p: 'notifications', icon: '🔔', label: 'Notifications' },
            { p: 'profile',       icon: '👤', label: 'Profile' },
            ...(profile?.is_admin ? [{ p: 'admin', icon: '🛡', label: 'Admin' }] : [])
          ] : [])
        ]) as { p: Page; icon: string; label: string }[]).map(({ p, icon, label }) => (
          <button key={p} className={`${styles.drawerLink} ${page === p ? styles.active : ''}`} onClick={() => navigate(p)}>
            <span className={styles.drawerIcon}>{icon}</span>
            {label}
            {p === 'notifications' && notifCount > 0 && (
              <span className={styles.badge} style={{ marginLeft: 'auto' }}>{notifCount}</span>
            )}
          </button>
        ))}

        <div className={styles.drawerDivider} />

        {/* Location + radius */}
        <div className={styles.drawerLocation}>
          <div className={styles.drawerLocationLabel}>📍 Your Location</div>
          <div className={styles.drawerLocationRow}>
            <span className={styles.drawerLocationCity}>{locationLabel}</span>
            {user && <span className={styles.drawerRadiusVal}>{radius} mi</span>}
          </div>
          {user ? (
            <>
              <input type="range" min={5} max={200} step={5} value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                className={styles.drawerSlider} />
              <div className={styles.drawerSliderLabels}><span>5 mi</span><span>200 mi</span></div>
              <button className={styles.drawerSaveBtn} onClick={saveRadius} disabled={saving}>
                {saving ? 'Saving…' : 'Save Radius'}
              </button>
            </>
          ) : (
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>
              Sign in to set your search radius
            </p>
          )}
        </div>

        <div className={styles.drawerDivider} />

        {/* Auth */}
        <div className={styles.drawerAuthBtns}>
          {user ? (
            <button className={`${styles.drawerAuthBtn} ${styles.drawerAuthBtnOutline}`}
              onClick={() => { onSignOut(); setDrawerOpen(false) }}>
              Sign Out
            </button>
          ) : (
            <>
              <button className={`${styles.drawerAuthBtn} ${styles.drawerAuthBtnPrimary}`}
                onClick={() => { onSignUp(); setDrawerOpen(false) }}>Join Free</button>
              <button className={`${styles.drawerAuthBtn} ${styles.drawerAuthBtnOutline}`}
                onClick={() => { onSignIn(); setDrawerOpen(false) }}>Sign In</button>
            </>
          )}
        </div>
      </div>

      {/* ─── BOTTOM TAB BAR ─────────────────────────────────────────── */}
      <nav className={styles.bottomBar}>
        <div className={styles.bottomBarInner}>
          {bottomTabs.map(t => (
            <button
              key={t.page}
              className={`${styles.tabBtn} ${page === t.page ? styles.active : ''}`}
              onClick={() => setPage(t.page)}
            >
              <span className={styles.tabIcon}>{t.icon}</span>
              <span className={styles.tabLabel}>{t.label}</span>
              {t.page === 'notifications' && notifCount > 0 && (
                <span className={styles.tabBadge}>{notifCount}</span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
