'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import Nav from '@/components/Nav'
import HomePage from '@/components/HomePage'
import LibraryPage from '@/components/LibraryPage'
import BarterPage from '@/components/BarterPage'
import LoansPage from '@/components/LoansPage'
import NotificationsPage from '@/components/NotificationsPage'
import ProfilePage from '@/components/ProfilePage'
import AdminPage from '@/components/AdminPage'
import AuthModal from '@/components/AuthModal'
import ConfirmBanner from '@/components/ConfirmBanner'
import Toast from '@/components/Toast'
import NotifToast from '@/components/NotifToast'
import LandingPage from '@/components/LandingPage'
import OnboardingTour, { shouldShowTour } from '@/components/OnboardingTour'
import InstallPrompt from '@/components/InstallPrompt'
import PushPrompt from '@/components/PushPrompt'
import type { Profile } from '@/types'

import type { Page } from '@/types'
export type { Page }

// Supabase client created ONCE at module level — never recreated
const supabase = createBrowserClient()

export default function App() {
  const [page, setPage]         = useState<Page>('home')
  const [pendingModal, setPendingModal] = useState<'add' | 'ai' | null>(null)
  const [user, setUser]         = useState<User | null>(null)
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup')
  const [toast, setToast]       = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [notifCount, setNotifCount] = useState(0)
  const [notifToast, setNotifToast] = useState<{ title: string; type: string } | null>(null)
  const [showTour, setShowTour]           = useState(false)
  const [showInstall, setShowInstall]     = useState(false)
  const [showPushNudge, setShowPushNudge] = useState(false)

  // Show a one-time nudge to enable push notifications if not yet subscribed
  async function maybeNudgePush(uid: string) {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('PushManager' in window)) return
    if (Notification.permission === 'granted') return  // already enabled
    if (Notification.permission === 'denied') return   // user said no
    if (localStorage.getItem('ct_push_nudged')) return // already nudged before
    localStorage.setItem('ct_push_nudged', '1')
    setShowPushNudge(true)
  }

  // ── Auth state ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        loadProfile(u.id)
        // Show tour only on initial page load for confirmed users who haven't seen it
        if (u.email_confirmed_at && shouldShowTour()) {
          setTimeout(() => setShowTour(true), 1200)
        } else if (u.email_confirmed_at) {
          // Already done the tour — nudge for push if not enabled
          setTimeout(() => maybeNudgePush(u.id), 2000)
        }
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
        if (event === 'USER_UPDATED' && session.user.email_confirmed_at && shouldShowTour()) {
          // Email just confirmed — show tour
          setTimeout(() => setShowTour(true), 1200)
        }
        // SIGNED_IN fires on every app open — don't re-show tour, just nudge push
        if (event === 'SIGNED_IN' && session.user.email_confirmed_at && !shouldShowTour()) {
          setTimeout(() => maybeNudgePush(session.user.id), 2000)
        }
      } else { setProfile(null); setNotifCount(0) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Realtime notifications ────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`notifs-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        setNotifCount(c => c + 1)
        if (page !== 'notifications') {
          const { title, type } = payload.new as { title: string; type: string }
          setNotifToast({ title, type })
        }
      })
      .subscribe()
    loadNotifCount(user.id)
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, page])

  async function loadProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data as Profile)
  }

  async function loadNotifCount(uid: string) {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('read', false)
    setNotifCount(count || 0)
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Email confirmation check ───────────────────────────────────────────────
  const isConfirmed = Boolean(user?.email_confirmed_at)

  function requireAuth(action: () => void) {
    if (!user) {
      setAuthMode('signup')
      setShowAuth(true)
      return
    }
    if (!isConfirmed) {
      showToast('Please confirm your email before doing that. Check your inbox!', 'error')
      return
    }
    if (profile?.suspended) {
      showToast('Your account has been suspended. Please contact support@communitrade.app if you believe this is an error.', 'error')
      return
    }
    action()
  }

  function navigate(p: Page, modal?: 'add' | 'ai') {
    setPage(p)
    if (modal) setPendingModal(modal)
  }

  // Lock body scroll when any modal is open (prevents background scroll on mobile)
  const anyModalOpen = showAuth
  useEffect(() => {
    document.body.style.overflow = anyModalOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [anyModalOpen])

  const ctx = { user, profile, showToast, requireAuth, navigate }

  return (
    <>
      <Nav
        page={page}
        setPage={setPage}
        user={user}
        profile={profile}
        notifCount={notifCount}
        onSignIn={() => { setAuthMode('login'); setShowAuth(true) }}
        onSignUp={() => { setAuthMode('signup'); setShowAuth(true) }}
        onSignOut={async () => { await supabase.auth.signOut(); showToast('Signed out') }}
      />

      {/* Sticky banner for signed-in but unconfirmed users */}
      {user && !isConfirmed && (
        <ConfirmBanner email={user.email ?? ''} />
      )}

      {page === 'home' && (
        user
          ? <HomePage ctx={ctx} />
          : <LandingPage
              ctx={ctx}
              onSignUp={() => { setAuthMode('signup'); setShowAuth(true) }}
              onSignIn={() => { setAuthMode('login'); setShowAuth(true) }}
            />
      )}
      {page === 'library'       && <LibraryPage ctx={ctx} initialModal={pendingModal} onModalOpened={() => setPendingModal(null)} />}
      {page === 'barter'        && <BarterPage ctx={ctx} />}
      {page === 'loans'         && <LoansPage ctx={ctx} />}
      {page === 'notifications' && <NotificationsPage ctx={ctx} onRead={() => loadNotifCount(user?.id ?? '')} />}
      {page === 'profile'       && <ProfilePage ctx={ctx} onProfileUpdate={loadProfile} />}
      {page === 'admin'         && profile?.is_admin && <AdminPage ctx={ctx} />}

      {showAuth && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuth(false)}
          onSuccess={(msg: string) => { setShowAuth(false); showToast(msg) }}
          showToast={showToast}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} />}

      {notifToast && (
        <NotifToast
          title={notifToast.title}
          type={notifToast.type}
          onView={(p) => setPage(p as Page)}
          onDismiss={() => setNotifToast(null)}
        />
      )}
      {showTour && (
        <OnboardingTour
          navigate={setPage}
          onDone={() => { setShowTour(false); setShowInstall(true) }}
        />
      )}

      {showInstall && (
        <InstallPrompt onDone={() => setShowInstall(false)} />
      )}

      {/* Push notification nudge — shows once after tour, bottom sheet style */}
      {showPushNudge && user && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: '0 0 env(safe-area-inset-bottom, 0)',
        }} onClick={() => setShowPushNudge(false)}>
          <div style={{
            background: '#fff', borderRadius: '20px 20px 0 0',
            padding: '1.5rem 1.5rem 2rem', width: '100%', maxWidth: 480,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 1.25rem' }} />
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.2rem', marginBottom: '0.4rem' }}>
              Stay in the loop 🔔
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Get notified instantly when someone wants to borrow your items, a barter match is found, or a return is due.
            </p>
            <PushPrompt userId={user.id} />
            <button
              onClick={() => setShowPushNudge(false)}
              style={{ width: '100%', marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.85rem', cursor: 'pointer', padding: '0.5rem' }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </>
  )
}
