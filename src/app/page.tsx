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
import type { Profile } from '@/types'

import type { Page } from '@/types'
export type { Page }

// Supabase client created ONCE at module level — never recreated
const supabase = createBrowserClient()

export default function App() {
  const [page, setPage]         = useState<Page>('home')
  const [user, setUser]         = useState<User | null>(null)
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup')
  const [toast, setToast]       = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [notifCount, setNotifCount] = useState(0)
  const [notifToast, setNotifToast] = useState<{ title: string; type: string } | null>(null)

  // ── Auth state ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setNotifCount(0) }
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
    action()
  }

  const ctx = { user, profile, showToast, requireAuth, navigate: setPage }

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

      {page === 'home'          && <HomePage ctx={ctx} />}
      {page === 'library'       && <LibraryPage ctx={ctx} />}
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
    </>
  )
}
