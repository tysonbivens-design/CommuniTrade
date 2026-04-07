'use client'
import { useState } from 'react'
import type { AppCtx } from '@/types'

interface FeedbackButtonProps {
  ctx: AppCtx
}

export default function FeedbackButton({ ctx }: FeedbackButtonProps) {
  const { user, showToast } = ctx
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Only show when logged in
  if (!user) return null

  async function handleSubmit() {
    if (!message.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user!.id, message: message.trim() }),
      })
      if (!res.ok) throw new Error('Failed to submit')
      showToast('Thanks for your feedback!')
      setMessage('')
      setOpen(false)
    } catch {
      showToast('Could not send feedback. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        title="Send feedback"
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)',
          left: '1rem',
          zIndex: 150,
          background: 'var(--sage)',
          color: '#fff',
          border: 'none',
          borderRadius: '2rem',
          padding: '0.45rem 0.8rem',
          fontSize: '0.78rem',
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          opacity: 0.8,
          transition: 'opacity 0.2s, transform 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '1'
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '0.8'
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
        }}
      >
        💬 Feedback
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '0 0 env(safe-area-inset-bottom, 0)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '20px 20px 0 0',
              padding: '1.5rem 1.5rem 2rem',
              width: '100%',
              maxWidth: 480,
            }}
          >
            {/* Handle bar */}
            <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 1.25rem' }} />

            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.2rem', marginBottom: '0.35rem' }}>
              Share feedback
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.1rem', lineHeight: 1.5 }}>
              Found a bug? Have a suggestion? We read every message.
            </p>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind..."
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 10,
                border: '1.5px solid var(--border)',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '0.92rem',
                resize: 'vertical',
                outline: 'none',
                color: 'var(--bark)',
                background: 'var(--cream)',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--rust)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              autoFocus
            />

            <button
              onClick={handleSubmit}
              disabled={submitting || !message.trim()}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.75rem' }}
            >
              {submitting ? 'Sending…' : 'Send Feedback'}
            </button>

            <button
              onClick={() => setOpen(false)}
              style={{
                width: '100%', marginTop: '0.5rem',
                background: 'none', border: 'none',
                color: 'var(--muted)', fontSize: '0.85rem',
                cursor: 'pointer', padding: '0.5rem',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
