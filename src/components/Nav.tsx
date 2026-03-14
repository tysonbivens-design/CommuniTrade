‘use client’
import { useState, useEffect, useRef } from ‘react’
import { createBrowserClient } from ‘@/lib/supabase’
import type { User } from ‘@supabase/supabase-js’
import type { Profile, Page } from ‘@/types’
import Avatar from ‘./Avatar’
import styles from ‘./Nav.module.css’

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
lng: parseFloat(place.longitude),
}
} catch { return null }
}

async function ipLocation(): Promise<{ label: string; lat: number; lng: number } | null> {
if (ipLocationCache) return ipLocationCache
try {
const res = await fetch(‘https://ipapi.co/json/’)
if (!res.ok) return null
const data = await res.json()
if (data.city && data.region_code) {
ipLocationCache = { label: `${data.city}, ${data.region_code}`, lat: data.latitude, lng: data.longitude }
return ipLocationCache
}
} catch {}
return null
}

function getDeviceLocation(): Promise<{ lat: number; lng: number } | null> {
return new Promise(resolve => {
if (!navigator.geolocation) { resolve(null); return }
navigator.geolocation.getCurrentPosition(
pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
() => resolve(null),
{ timeout: 8000 }
)
})
}

export type LocationMode = ‘home’ | ‘current’

export interface ActiveLocation {
lat: number | null
lng: number | null
mode: LocationMode
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
onLocationChange?: (loc: ActiveLocation) => void
}

export default function Nav({ page, setPage, user, profile, notifCount, onSignIn, onSignUp, onSignOut, onLocationChange }: NavProps) {
const [locationLabel, setLocationLabel] = useState(’…’)
const [radius, setRadius]               = useState(100)
const [pillOpen, setPillOpen]           = useState(false)
const [drawerOpen, setDrawerOpen]       = useState(false)
const [saving, setSaving]               = useState(false)
const [locationMode, setLocationMode]   = useState<LocationMode>(() => {
if (typeof window !== ‘undefined’) {
return (localStorage.getItem(‘ct_location_mode’) as LocationMode) || ‘home’
}
return ‘home’
})
const [currentLocLabel, setCurrentLocLabel] = useState<string | null>(null)
const [fetchingGPS, setFetchingGPS]         = useState(false)
const pillRef  = useRef<HTMLDivElement>(null)
const supabase = createBrowserClient()

// Resolve home location from profile zip
useEffect(() => {
let cancelled = false
async function init() {
if (user && profile?.zip_code) {
if (profile.radius_miles) setRadius(profile.radius_miles)
const loc = await zipToLocation(profile.zip_code)
if (cancelled) return
if (loc) {
if (locationMode === ‘home’) {
setLocationLabel(loc.label)
onLocationChange?.({ lat: loc.lat, lng: loc.lng, mode: ‘home’ })
}
// Backfill lat/lng if missing
if (!profile.lat || !profile.lng) {
supabase.from(‘profiles’).update({ lat: loc.lat, lng: loc.lng }).eq(‘id’, user.id)
}
} else {
if (locationMode === ‘home’) setLocationLabel(profile.zip_code)
}
} else if (!user) {
const loc = await ipLocation()
if (!cancelled) {
setLocationLabel(loc?.label || ‘Your Area’)
if (loc) onLocationChange?.({ lat: loc.lat, lng: loc.lng, mode: ‘home’ })
}
}
}
init()
return () => { cancelled = true }
}, [profile?.zip_code, profile?.radius_miles, user?.id])

// When mode switches to current, get GPS
useEffect(() => {
if (locationMode !== ‘current’) return
let cancelled = false
async function getGPS() {
setFetchingGPS(true)
const coords = await getDeviceLocation()
if (cancelled) return
if (coords) {
// Reverse-geocode for a label using ipapi (close enough for display)
try {
const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lng}&localityLanguage=en`)
const data = await res.json()
const label = data.city && data.principalSubdivisionCode
? `${data.city}, ${data.principalSubdivisionCode.replace('US-', '')}`
: ‘Current Location’
setCurrentLocLabel(label)
setLocationLabel(label)
} catch {
setCurrentLocLabel(‘Current Location’)
setLocationLabel(‘Current Location’)
}
onLocationChange?.({ lat: coords.lat, lng: coords.lng, mode: ‘current’ })
} else {
// GPS denied/failed — fall back to home silently
setLocationMode(‘home’)
localStorage.setItem(‘ct_location_mode’, ‘home’)
setLocationLabel(profile?.zip_code || ‘Your Area’)
onLocationChange?.({ lat: profile?.lat ?? null, lng: profile?.lng ?? null, mode: ‘home’ })
}
setFetchingGPS(false)
}
getGPS()
return () => { cancelled = true }
}, [locationMode])

function switchMode(mode: LocationMode) {
setLocationMode(mode)
localStorage.setItem(‘ct_location_mode’, mode)
if (mode === ‘home’) {
setLocationLabel(profile?.zip_code || ‘Your Area’)
onLocationChange?.({ lat: profile?.lat ?? null, lng: profile?.lng ?? null, mode: ‘home’ })
}
// ‘current’ handled by the useEffect above
}

// Close desktop dropdown on outside click
useEffect(() => {
function handler(e: MouseEvent) {
if (pillRef.current && !pillRef.current.contains(e.target as Node)) setPillOpen(false)
}
document.addEventListener(‘mousedown’, handler)
return () => document.removeEventListener(‘mousedown’, handler)
}, [])

useEffect(() => { setDrawerOpen(false) }, [page])

useEffect(() => {
document.body.style.overflow = drawerOpen ? ‘hidden’ : ‘’
return () => { document.body.style.overflow = ‘’ }
}, [drawerOpen])

async function saveRadius() {
if (!user) return
setSaving(true)
await supabase.from(‘profiles’).update({ radius_miles: radius }).eq(‘id’, user.id)
setSaving(false)
setPillOpen(false)
setDrawerOpen(false)
}

function navigate(p: Page) { setPage(p); setDrawerOpen(false) }

const displayLabel = fetchingGPS ? ‘Locating…’ : locationLabel

// ── Location mode toggle (shared between pill dropdown and drawer) ────────
const LocationToggle = () => user ? (
<div style={{ display: ‘flex’, gap: ‘0.4rem’, marginBottom: ‘0.75rem’ }}>
<button
onClick={() => switchMode(‘home’)}
style={{
flex: 1, padding: ‘0.35rem 0’, borderRadius: 6, fontSize: ‘0.78rem’,
border: ‘1.5px solid var(–border)’, cursor: ‘pointer’,
background: locationMode === ‘home’ ? ‘var(–bark)’ : ‘#fff’,
color: locationMode === ‘home’ ? ‘#fff’ : ‘var(–bark)’,
fontFamily: ‘DM Sans, sans-serif’, fontWeight: 600,
}}
>
🏠 Home
</button>
<button
onClick={() => switchMode(‘current’)}
style={{
flex: 1, padding: ‘0.35rem 0’, borderRadius: 6, fontSize: ‘0.78rem’,
border: ‘1.5px solid var(–border)’, cursor: ‘pointer’,
background: locationMode === ‘current’ ? ‘var(–bark)’ : ‘#fff’,
color: locationMode === ‘current’ ? ‘#fff’ : ‘var(–bark)’,
fontFamily: ‘DM Sans, sans-serif’, fontWeight: 600,
}}
>
{fetchingGPS ? ‘⏳’ : ‘📡’} Current
</button>
</div>
) : null

const bottomTabs: { page: Page; icon: string; label: string }[] = user
? [
{ page: ‘home’,          icon: ‘🏠’, label: ‘Home’ },
{ page: ‘library’,       icon: ‘📚’, label: ‘Library’ },
{ page: ‘barter’,        icon: ‘🤝’, label: ‘Barter’ },
{ page: ‘loans’,         icon: ‘📦’, label: ‘Loans’ },
{ page: ‘notifications’, icon: ‘🔔’, label: ‘Alerts’ },
]
: [
{ page: ‘home’,    icon: ‘🏠’, label: ‘Home’ },
{ page: ‘library’, icon: ‘📚’, label: ‘Library’ },
{ page: ‘barter’,  icon: ‘🤝’, label: ‘Barter’ },
]

return (
<>
{/* ─── TOP NAV ────────────────────────────────────────────────── */}
<nav className={styles.nav}>
<div className={styles.logo} onClick={() => navigate(‘home’)}>
Communi<span>Trade</span>
</div>

```
    {/* Desktop center links */}
    <div className={styles.links}>
      {(['home', 'library', 'barter'] as const).map(p => (
        <button key={p} className={`${styles.link} ${page === p ? styles.active : ''}`} onClick={() => navigate(p)}>
          {p.charAt(0).toUpperCase() + p.slice(1)}
        </button>
      ))}
      {user && (
        <>
          <button className={`${styles.link} ${page === 'loans' ? styles.active : ''}`} onClick={() => navigate('loans')} data-tour="loans">My Loans</button>
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
          {locationMode === 'current' ? '📡' : '📍'} {displayLabel}
          {user && <span style={{ opacity: 0.6, fontSize: '0.72rem' }}>· {radius}mi</span>}
        </div>
        {pillOpen && user && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: '#fff', borderRadius: 12, padding: '1.25rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)', width: 260, zIndex: 200,
            border: '1px solid var(--border)',
          }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '0.75rem' }}>Location</p>
            <LocationToggle />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--bark)' }}>
                {locationMode === 'current' ? '📡' : '📍'} {displayLabel}
              </span>
              <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, color: 'var(--rust)' }}>{radius} mi</span>
            </div>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', margin: '0.75rem 0 0.4rem' }}>Search Radius</p>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className={`${styles.link} ${page === 'profile' ? styles.active : ''}`} onClick={() => navigate('profile')}>
              <Avatar name={profile?.full_name} avatarUrl={profile?.avatar_url} color={profile?.avatar_color} size={28} />
            </button>
            <button className="btn btn-outline btn-sm" onClick={onSignOut}>Sign Out</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-outline btn-sm" onClick={onSignIn}>Sign In</button>
            <button className="btn btn-primary btn-sm" onClick={onSignUp}>Join</button>
          </div>
        )}
      </div>

      {/* Hamburger */}
      <button className={styles.hamburger} onClick={() => setDrawerOpen(true)} aria-label="Open menu">
        <span /><span /><span />
      </button>
    </div>
  </nav>

  {/* ─── MOBILE DRAWER ──────────────────────────────────────────── */}
  {drawerOpen && <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)} />}
  <div className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}>
    <div className={styles.drawerHeader}>
      <span className={styles.drawerLogo}>Communi<span>Trade</span></span>
      <button className={styles.drawerClose} onClick={() => setDrawerOpen(false)}>✕</button>
    </div>

    {(([
      { p: 'home', icon: '🏠', label: 'Home' },
      { p: 'library', icon: '📚', label: 'Library' },
      { p: 'barter', icon: '🤝', label: 'Barter' },
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
        <span className={styles.drawerLocationCity}>{displayLabel}</span>
        {user && <span className={styles.drawerRadiusVal}>{radius} mi</span>}
      </div>
      {user ? (
        <>
          <LocationToggle />
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
        <button className={styles.drawerSignOut} onClick={() => { onSignOut(); setDrawerOpen(false) }}>
          Sign Out
        </button>
      ) : (
        <>
          <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => { onSignIn(); setDrawerOpen(false) }}>Sign In</button>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => { onSignUp(); setDrawerOpen(false) }}>Join Free</button>
        </>
      )}
    </div>
  </div>

  {/* ─── BOTTOM TAB BAR (mobile) ─────────────────────────────────── */}
  <nav className={styles.bottomNav} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
    {bottomTabs.map(({ page: p, icon, label }) => (
      <button
        key={p}
        className={`${styles.bottomTab} ${page === p ? styles.bottomTabActive : ''}`}
        onClick={() => navigate(p)}
      >
        <span className={styles.bottomTabIcon}>
          {p === 'notifications' && notifCount > 0
            ? <span style={{ position: 'relative' }}>{icon}<span className={styles.bottomBadge}>{notifCount}</span></span>
            : icon}
        </span>
        <span className={styles.bottomTabLabel}>{label}</span>
      </button>
    ))}
    <button
      className={`${styles.bottomTab} ${page === 'profile' ? styles.bottomTabActive : ''}`}
      onClick={() => user ? navigate('profile') : onSignUp()}
    >
      <span className={styles.bottomTabIcon}>👤</span>
      <span className={styles.bottomTabLabel}>{user ? 'Profile' : 'Join'}</span>
    </button>
  </nav>
</>
```

)
}