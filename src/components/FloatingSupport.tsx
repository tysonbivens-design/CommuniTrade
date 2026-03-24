'use client'
import type { Page } from '@/types'

interface FloatingSupportProps {
  onNavigate: (page: Page) => void
}

export default function FloatingSupport({ onNavigate }: FloatingSupportProps) {
  return (
    <button
      onClick={() => onNavigate('support')}
      title="Support CommuniTrade"
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)',
        right: '1.25rem',
        zIndex: 150,
        background: 'var(--bark)',
        color: '#fff',
        border: 'none',
        borderRadius: '2rem',
        padding: '0.5rem 0.9rem',
        fontSize: '0.82rem',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        opacity: 0.9,
        transition: 'opacity 0.2s, transform 0.2s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '1'
        ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'
        ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
      }}
    >
      ☕ Support Us
    </button>
  )
}
