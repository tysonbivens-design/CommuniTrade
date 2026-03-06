'use client'
import { useEffect, useState } from 'react'

const TYPE_ICONS: Record<string, string> = {
  loan_request:  '📬',
  loan_approved: '✅',
  loan_due:      '⏰',
  loan_overdue:  '🚨',
  barter_match:  '🔥',
  review:        '⭐',
  flag:          '🚩',
}

const TYPE_PAGE: Record<string, string> = {
  loan_request:  'loans',
  loan_approved: 'loans',
  loan_due:      'loans',
  loan_overdue:  'loans',
  barter_match:  'barter',
  review:        'profile',
  flag:          'admin',
}

interface Props {
  title: string
  type: string
  onView: (page: string) => void
  onDismiss: () => void
}

export default function NotifToast({ title, type, onView, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  // Auto-dismiss after 5s
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])

  function handleView() {
    const target = TYPE_PAGE[type] || 'notifications'
    setVisible(false)
    setTimeout(() => { onDismiss(); onView(target) }, 200)
  }

  function handleDismiss() {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '5.5rem',
      left: '50%',
      transform: `translateX(-50%) translateY(${visible ? '0' : '20px'})`,
      opacity: visible ? 1 : 0,
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      zIndex: 400,
      background: 'var(--bark)',
      color: '#fff',
      borderRadius: 12,
      padding: '0.75rem 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      maxWidth: '90vw',
      minWidth: 280,
      pointerEvents: visible ? 'all' : 'none',
    }}>
      <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{TYPE_ICONS[type] || '🔔'}</span>
      <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 500, lineHeight: 1.3 }}>{title}</span>
      <button
        onClick={handleView}
        style={{
          background: 'var(--rust)', color: '#fff', border: 'none',
          borderRadius: 6, padding: '0.3rem 0.65rem', fontSize: '0.78rem',
          fontWeight: 500, cursor: 'pointer', flexShrink: 0,
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        View
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer', fontSize: '1rem', padding: '0.1rem', flexShrink: 0,
          lineHeight: 1,
        }}
      >✕</button>
    </div>
  )
}
