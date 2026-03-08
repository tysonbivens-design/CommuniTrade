'use client'
import { useState, useEffect } from 'react'
import styles from './PushPrompt.module.css'

interface PushPromptProps {
  userId: string
}

export default function PushPrompt({ userId }: PushPromptProps) {
  const [status, setStatus] = useState<'loading' | 'unsupported' | 'denied' | 'granted' | 'default'>('loading')
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    setStatus(Notification.permission as 'denied' | 'granted' | 'default')
  }, [])

  async function subscribe() {
    setSubscribing(true)
    try {
      const permission = await Notification.requestPermission()
      setStatus(permission)
      if (permission !== 'granted') return

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
    } catch (err) {
      console.error('Push subscribe error:', err)
    } finally {
      setSubscribing(false)
    }
  }

  async function unsubscribe() {
    setSubscribing(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus('default')
    } catch (err) {
      console.error('Push unsubscribe error:', err)
    } finally {
      setSubscribing(false)
    }
  }

  if (status === 'loading' || status === 'unsupported') return null

  return (
    <div className={styles.wrap}>
      <div className={styles.info}>
        <span className={styles.icon}>🔔</span>
        <div>
          <p className={styles.label}>Push Notifications</p>
          <p className={styles.sub}>
            {status === 'granted'
              ? 'You\'ll be notified of loan requests, barter matches, and more.'
              : status === 'denied'
              ? 'Notifications blocked — enable them in your browser settings.'
              : 'Get instant alerts for loan requests, barter matches, and overdue reminders.'}
          </p>
        </div>
      </div>
      {status !== 'denied' && (
        <button
          className={`${styles.btn} ${status === 'granted' ? styles.btnOff : styles.btnOn}`}
          onClick={status === 'granted' ? unsubscribe : subscribe}
          disabled={subscribing}
        >
          {subscribing
            ? '…'
            : status === 'granted'
            ? 'Turn Off'
            : 'Enable'}
        </button>
      )}
    </div>
  )
}

// Utility: convert VAPID public key from base64url to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
}
