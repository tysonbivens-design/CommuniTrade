'use client'
import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'ct_ios_banner_dismissed'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export default function IOSInstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Only show on iOS Safari, not already installed as PWA
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = (window.navigator as any).standalone === true
    if (!isIOS || isStandalone) return

    // Check if dismissed recently
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < DISMISS_DURATION_MS) return
    }

    setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      left: 0, right: 0,
      zIndex: 200,
      background: 'var(--bark)',
      color: '#fff',
      padding: '0.7rem 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      boxShadow: '0 -2px 12px rgba(0,0,0,0.2)',
    }}>
      <div style={{ fontSize: '1.3rem', flexShrink: 0 }}>🏘️</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.1rem' }}>
          Install for push notifications
        </div>
        <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
          Tap Share then "Add to Home Screen"
        </div>
      </div>
      <button
        onClick={dismiss}
        style={{
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.55)',
          fontSize: '1.1rem', cursor: 'pointer',
          padding: '0.25rem', flexShrink: 0,
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        x
      </button>
    </div>
  )
}
