'use client'
import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'ct_push_banner_dismissed'
const DISMISS_DURATION_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

interface PushNudgeBannerProps {
  userId: string
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array(Array.from(rawData).map(c => c.charCodeAt(0)))
}

export default function PushNudgeBanner({ userId }: PushNudgeBannerProps) {
  const [visible, setVisible] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'granted') return
    if (Notification.permission === 'denied') return

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

  async function enable() {
    setSubscribing(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { dismiss(); return }

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as unknown as ArrayBuffer,
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription: sub.toJSON() }),
      })

      setSuccess(true)
      setTimeout(() => setVisible(false), 2000)
    } catch (err) {
      console.error('Push subscribe error:', err)
      dismiss()
    } finally {
      setSubscribing(false)
    }
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      left: 0, right: 0,
      zIndex: 199,
      background: 'var(--bark)',
      color: '#fff',
      padding: '0.7rem 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      boxShadow: '0 -2px 12px rgba(0,0,0,0.2)',
    }}>
      <div style={{ fontSize: '1.2rem', flexShrink: 0 }}>🔔</div>
      {success ? (
        <div style={{ flex: 1, fontWeight: 600, fontSize: '0.85rem' }}>
          Notifications enabled!
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.1rem' }}>
              Stay in the loop
            </div>
            <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
              Get notified when neighbors list items and matches are found
            </div>
          </div>
          <button
            onClick={enable}
            disabled={subscribing}
            style={{
              background: 'var(--rust)', color: '#fff',
              border: 'none', borderRadius: 8,
              padding: '0.4rem 0.85rem',
              fontSize: '0.78rem', fontWeight: 600,
              cursor: 'pointer', flexShrink: 0,
              fontFamily: 'DM Sans, sans-serif',
              opacity: subscribing ? 0.7 : 1,
            }}
          >
            {subscribing ? 'Enabling...' : 'Enable'}
          </button>
          <button
            onClick={dismiss}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '1.1rem', cursor: 'pointer',
              padding: '0.25rem', flexShrink: 0,
              lineHeight: 1,
            }}
            aria-label="Dismiss"
          >
            x
          </button>
        </>
      )}
    </div>
  )
}
