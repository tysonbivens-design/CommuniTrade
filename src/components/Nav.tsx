'use client'
import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import styles from './Nav.module.css'

// Convert zip code to city/state label and lat/lng coords
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

// Approximate location from IP for logged-out users
async function ipLocation(): Promise<{ label: string; lat: number; lng: number } | null> {
  try {
    const res = await fetch('https://ipapi.co/json/')
    if (!res.ok) return null
    const data = await res.json()
    if (data.city && data.region_code) {
      return { label: `${data.city}, ${data.region_code}`, lat: data.latitude, lng: data.longitude }
    }
  } catch {}
  return null
}

export default function Nav({ page, setPage, user, profile, notifCount, onSignIn, onSignUp, onSignOut }: any) {
  const [locationLabel, setLocationLabel] = useState('...')
  const [radius, setRadius] = useState(100)
  const [pillOpen, setPillOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createBrowserClient()

  // Load location label + save lat/lng to profile if logged in
  useEffect(() => {
    async function init() {
      if (user && profile?.zip_code) {
        // Set radius from saved profile preference
        if (profile.radius_miles) setRadius(profile.radius_miles)

        const loc = await zipToLocation(profile.zip_code)
        if (loc) {
          setLocationLabel(loc.label)
          // Save lat/lng to profile if not already set
          if (!profile.lat || !profile.lng) {
            await supabase.from('profiles').update({ lat: loc.lat, lng: loc.lng }).eq('id', user.id)
          }
        } else {
          setLocationLabel(profile.zip_code)
        }
      } else if (!user) {
        // Approximate from IP for logged-out users
        const loc = await ipLocation()
        setLocationLabel(loc?.label || 'Your Area')
      }
    }
    init()
  }, [profile?.zip_code, profile?.radius_miles, user])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPillOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function saveRadius() {
    if (!user) return
    setSaving(true)
    await supabase.from('profiles').update({ radius_miles: radius }).eq('id', user.id)
    setSaving(false)
    setPillOpen(false)
  }

  return (
    <nav className={styles.nav}>
      <div className={styles.logo} onClick={() => setPage('home')}>
        Communi<span>Trade</span>
      </div>

      <div className={styles.links}>
        {(['home', 'library', 'barter'] as const).map(p => (
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
        {/* Location pill with dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <div
            className={styles.locationPill}
            onClick={() => user && setPillOpen(o => !o)}
            style={{ cursor: user ? 'pointer' : 'default' }}
            title={user ? 'Click to adjust radius' : ''}
          >
            📍 {locationLabel} {user && <span style={{ opacity: 0.6, fontSize: '0.72rem' }}>· {radius}mi</span>}
          </div>

          {pillOpen && user && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: '#fff', borderRadius: 12, padding: '1.25rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)', width: 260, zIndex: 200,
              border: '1px solid var(--border)'
            }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                Search Radius
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--bark)' }}>📍 {locationLabel}</span>
                <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '1.1rem', color: 'var(--rust)' }}>{radius} mi</span>
              </div>
              <input
                type="range"
                min={5} max={200} step={5}
                value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--rust)', marginBottom: '0.35rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                <span>5 mi</span>
                <span>200 mi</span>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={saveRadius}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Radius'}
              </button>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.6rem', textAlign: 'center' }}>
                Library & Barter results will filter to this range
              </p>
            </div>
          )}
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
