'use client'
import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import styles from './Modal.module.css'

export default function AuthModal({ mode, onClose, onSuccess, showToast }: any) {
  const [isLogin, setIsLogin] = useState(mode === 'login')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', zip_code: '' })
  const supabase = createBrowserClient()

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: any) {
    e.preventDefault()
    setLoading(true)
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email, password: form.password
        })
        if (error) throw error
        onSuccess('Welcome back! 👋')
      } else {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { full_name: form.full_name, zip_code: form.zip_code }
          }
        })
        if (error) throw error
        onSuccess('Welcome to CommuniTrade! 🎉 Check your email to confirm your account.')
      }
    } catch (err: any) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
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
          <button type="submit" className={`btn btn-primary btn-lg ${styles.submitBtn}`} disabled={loading}>
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
