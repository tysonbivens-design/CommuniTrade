'use client'
import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import styles from './Modal.module.css'
import { useScrollLock } from '@/lib/useScrollLock'
import type { AppCtx } from '@/types'

interface AuthModalProps {
  mode: 'login' | 'signup'
  onClose: () => void
  onSuccess: (msg: string) => void
  showToast: AppCtx['showToast']
}

interface AuthForm {
  email: string
  password: string
  full_name: string
  zip_code: string
}

export default function AuthModal({ mode, onClose, onSuccess, showToast }: AuthModalProps) {
  useScrollLock()
  const supabase = createBrowserClient()
  const [isLogin, setIsLogin] = useState(mode === 'login')
  const [loading, setLoading] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [form, setForm] = useState<AuthForm>({ email: '', password: '', full_name: '', zip_code: '' })
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  const set = (k: keyof AuthForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isLogin && !termsAccepted) {
      showToast('Please accept the Terms & Community Guidelines to continue', 'error')
      return
    }
    setLoading(true)
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email, password: form.password,
        })
        if (error) throw error
        onSuccess('Welcome back! 👋')
      } else {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { full_name: form.full_name, zip_code: form.zip_code },
            emailRedirectTo: `${window.location.origin}?type=signup`,
          },
        })
        if (error) throw error
        setSignedUpEmail(form.email)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      const friendly = msg.includes('email not confirmed')
        ? 'Please confirm your email before signing in. Check your inbox.'
        : msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('wrong password')
        ? 'Incorrect email or password.'
        : msg.includes('already registered') || msg.includes('user already exists')
        ? 'An account with this email already exists. Try signing in instead.'
        : msg.includes('weak password')
        ? 'Password must be at least 6 characters.'
        : 'Something went wrong. Please try again.'
      showToast(friendly, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setForgotLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}?page=profile`,
      })
      if (error) throw error
      showToast('Password reset email sent! Check your inbox.')
      setShowForgot(false)
      onClose()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not send reset email', 'error')
    } finally {
      setForgotLoading(false)
    }
  }


  async function handleResend() {
    if (!signedUpEmail) return
    setResendLoading(true)
    try {
      await supabase.auth.resend({ type: 'signup', email: signedUpEmail })
      setResendSent(true)
      setTimeout(() => setResendSent(false), 5000)
    } catch {
      showToast('Could not resend. Please try again.', 'error')
    } finally {
      setResendLoading(false)
    }
  }

  if (signedUpEmail) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📬</div>
          <h2 className={styles.title} style={{ textAlign: 'center' }}>Check your email!</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            We sent a confirmation link to<br />
            <strong style={{ color: 'var(--bark)' }}>{signedUpEmail}</strong>
          </p>
          <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6, textAlign: 'left' }}>
            <p style={{ marginBottom: '0.4rem' }}>👆 Click the link in that email to activate your account.</p>
            <p style={{ marginBottom: '0.4rem' }}>📁 Don't see it? Check your spam or junk folder.</p>
            <p>⏱ The link expires after 24 hours.</p>
          </div>
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginBottom: '0.75rem' }}
            onClick={handleResend}
            disabled={resendLoading || resendSent}
          >
            {resendLoading ? <span className="spinner" /> : resendSent ? '✅ Sent! Check your inbox' : 'Resend confirmation email'}
          </button>
          <button
            className="btn btn-outline btn-lg"
            style={{ width: '100%' }}
            onClick={() => { setSignedUpEmail(null); setIsLogin(true) }}
          >
            Already confirmed? Sign in
          </button>
        </div>
      </div>
    )
  }

  if (showForgot) {
    return (
      <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div className={styles.modal}>
          <button className={styles.close} onClick={onClose}>✕</button>
          <h2 className={styles.title}>Reset Password</h2>
          <p className={styles.subtitle}>Enter your email and we'll send you a reset link.</p>
          <form onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label className="label">Email</label>
              <input
                className="input" type="email" placeholder="you@example.com"
                value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required
              />
            </div>
            <button type="submit" className={`btn btn-primary btn-lg ${styles.submitBtn}`} disabled={forgotLoading}>
              {forgotLoading ? <span className="spinner" /> : 'Send Reset Email'}
            </button>
          </form>
          <p className={styles.toggle}>
            <button onClick={() => setShowForgot(false)}>← Back to sign in</button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose}>✕</button>
        <h2 className={styles.title}>{isLogin ? 'Welcome back' : 'Join CommuniTrade'}</h2>
        <p className={styles.subtitle}>
          {isLogin ? 'Sign in to your account' : 'Free to join. Your community is waiting.'}
        </p>
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div className="form-group">
                <label className="label">Your Name</label>
                <input className="input" type="text" placeholder="Maria Garcia" value={form.full_name} onChange={set('full_name')} required />
              </div>
              <div className="form-group">
                <label className="label">Zip Code</label>
                <input className="input" type="text" placeholder="80203" value={form.zip_code} onChange={set('zip_code')} required maxLength={5} />
              </div>
            </>
          )}
          <div className="form-group">
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required minLength={6} />
          </div>

          {isLogin && (
            <div style={{ textAlign: 'right', marginTop: '-0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => { setShowForgot(true); setForgotEmail(form.email) }}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {!isLogin && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{
                background: 'var(--cream)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '0.9rem 1rem', fontSize: '0.8rem',
                color: 'var(--muted)', lineHeight: 1.6, marginBottom: '0.75rem',
                maxHeight: 160, overflowY: 'auto'
              }}>
                <strong style={{ color: 'var(--bark)', display: 'block', marginBottom: '0.4rem' }}>Community Guidelines & Terms</strong>
                By joining CommuniTrade you agree that:<br /><br />
                • You are responsible for the safe return of any borrowed items in the same condition received.<br />
                • CommuniTrade is a community platform — we do not guarantee the quality, safety, or accuracy of any listing.<br />
                • You participate in trades, loans, and barters at your own risk. Always meet in safe, public places.<br />
                • You will not use the platform to scam, defraud, or harm other members.<br />
                • Listings that are inaccurate, unavailable, or abusive may be removed.<br />
                • CommuniTrade is not liable for lost, stolen, or damaged items, or for disputes between members.<br />
                • The use of CommuniTrade for the trade of illicit substances, services, or products is strictly prohibited and will result in immediate removal.
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--bark)' }}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                  style={{ marginTop: '0.15rem', accentColor: 'var(--rust)', flexShrink: 0 }}
                />
                I have read and agree to the Community Guidelines & Terms
              </label>
            </div>
          )}

          <button
            type="submit"
            className={`btn btn-primary btn-lg ${styles.submitBtn}`}
            disabled={loading || (!isLogin && !termsAccepted)}
          >
            {loading ? <span className="spinner" /> : isLogin ? 'Sign In' : 'Create Free Account'}
          </button>
        </form>
        <p className={styles.toggle}>
          {isLogin ? "Don't have an account?" : 'Already a member?'}{' '}
          <button onClick={() => setIsLogin(!isLogin)}>{isLogin ? 'Join free' : 'Sign in'}</button>
        </p>
      </div>
    </div>
  )
}
