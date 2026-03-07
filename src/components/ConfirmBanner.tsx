'use client'
import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'

interface ConfirmBannerProps {
  email: string
}

export default function ConfirmBanner({ email }: ConfirmBannerProps) {
  const supabase = createBrowserClient()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function resend() {
    setStatus('sending')
    await supabase.auth.resend({ type: 'signup', email })
    setStatus('sent')
  }

  return (
    <div style={{
      background: '#7C4A00',
      color: '#fff',
      padding: '0.65rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      flexWrap: 'wrap',
      fontSize: '0.85rem',
      textAlign: 'center',
      position: 'sticky',
      top: 60,
      zIndex: 99,
    }}>
      <span>📧 Please confirm your email to start borrowing and sharing.</span>
      {status === 'sent' ? (
        <span style={{ color: '#FFD580', fontWeight: 500 }}>Sent! Check your inbox ✓</span>
      ) : (
        <button
          onClick={resend}
          disabled={status === 'sending'}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.35)',
            color: '#fff',
            borderRadius: 6,
            padding: '0.3rem 0.85rem',
            fontSize: '0.82rem',
            fontWeight: 500,
            cursor: status === 'sending' ? 'default' : 'pointer',
            fontFamily: 'DM Sans, sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'sending' ? 'Sending…' : 'Resend confirmation'}
        </button>
      )}
    </div>
  )
}
