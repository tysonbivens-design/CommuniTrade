'use client'
import { useState } from 'react'
import type { AppCtx } from '@/types'

const PRESET_AMOUNTS = [5, 10, 25]
const SUB_MIN = 3
const SUB_MAX = 5

interface SupportPageProps {
  ctx: AppCtx
}

export default function SupportPage({ ctx }: SupportPageProps) {
  const { user, profile } = ctx
  const [subAmount, setSubAmount] = useState(3)
  const [donationAmount, setDonationAmount] = useState<number | ''>(5)
  const [customAmount, setCustomAmount] = useState('')
  const [loadingSub, setLoadingSub] = useState(false)
  const [loadingDonation, setLoadingDonation] = useState(false)

  const finalDonation = customAmount ? parseFloat(customAmount) : (donationAmount || 0)

  async function startCheckout(type: 'subscription' | 'donation') {
    if (type === 'subscription') setLoadingSub(true)
    else setLoadingDonation(true)

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          amount: type === 'subscription' ? subAmount : finalDonation,
          userId: user?.id || '',
          userEmail: user?.email || profile?.email || '',
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setLoadingSub(false)
      setLoadingDonation(false)
    }
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '80vh' }}>
      <div className="container">
        <div className="section" style={{ maxWidth: 560, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>☕</div>
            <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--bark)' }}>
              Support CommuniTrade
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '1rem', lineHeight: 1.7, maxWidth: 440, margin: '0 auto' }}>
              CommuniTrade is free, ad-free, and always will be. If it has brought value to your neighborhood,
              buying us a coffee helps keep the servers on and the community growing.
            </p>
          </div>

          {/* Subscription card */}
          <div style={{
            background: 'var(--cream)', border: '2px solid var(--gold)',
            borderRadius: 16, padding: '2rem', marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '1.75rem', flexShrink: 0 }}>🌱</div>
              <div>
                <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', marginBottom: '0.3rem', color: 'var(--bark)' }}>
                  Monthly Supporter
                </h2>
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Choose your amount. Cancel anytime. Every dollar goes directly toward keeping this community alive.
                </p>
              </div>
            </div>

            {/* Slider */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>per month</span>
                <span style={{
                  fontFamily: 'Fraunces, serif', fontSize: '2rem', fontWeight: 700,
                  color: 'var(--rust)',
                }}>
                  ${subAmount}
                </span>
              </div>
              <input
                type="range"
                min={SUB_MIN}
                max={SUB_MAX}
                step={1}
                value={subAmount}
                onChange={e => setSubAmount(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--rust)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                <span>${SUB_MIN}/mo</span>
                <span>${SUB_MAX}/mo</span>
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={() => startCheckout('subscription')}
              disabled={loadingSub}
            >
              {loadingSub
                ? <span className="spinner" />
                : `Support Us — $${subAmount}/month`}
            </button>
          </div>

          {/* One-time donation card */}
          <div style={{
            background: '#fff', border: '1.5px solid var(--border)',
            borderRadius: 16, padding: '2rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '1.75rem', flexShrink: 0 }}>☕</div>
              <div>
                <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', marginBottom: '0.3rem', color: 'var(--bark)' }}>
                  Buy Us a Coffee
                </h2>
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  One-time, any amount. If you want to be extra generous, we genuinely appreciate it.
                </p>
              </div>
            </div>

            {/* Preset amounts */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {PRESET_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  onClick={() => { setDonationAmount(amt); setCustomAmount('') }}
                  style={{
                    flex: 1, padding: '0.6rem', borderRadius: 8, fontSize: '0.95rem', fontWeight: 600,
                    border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                    background: donationAmount === amt && !customAmount ? 'var(--bark)' : '#fff',
                    color: donationAmount === amt && !customAmount ? '#fff' : 'var(--bark)',
                    transition: 'all 0.15s',
                  }}
                >
                  ${amt}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--muted)', fontSize: '0.95rem', pointerEvents: 'none',
                }}>$</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  placeholder="Or enter your own amount"
                  value={customAmount}
                  onChange={e => { setCustomAmount(e.target.value); setDonationAmount('') }}
                  style={{ paddingLeft: '1.75rem' }}
                />
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', background: 'var(--rust)', borderColor: 'var(--rust)' }}
              onClick={() => startCheckout('donation')}
              disabled={loadingDonation || finalDonation < 1}
            >
              {loadingDonation
                ? <span className="spinner" />
                : `Buy Us a Coffee${finalDonation >= 1 ? ` — $${finalDonation}` : ''}`}
            </button>
          </div>

          {/* Footer note */}
          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)', marginTop: '1.5rem', lineHeight: 1.6 }}>
            Payments processed securely by Stripe. CommuniTrade will never sell your data or show you ads.
            This is purely community-powered.
          </p>

        </div>
      </div>
    </div>
  )
}
