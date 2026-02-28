'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import Nav from '@/components/Nav'
import HomePage from '@/components/HomePage'
import LibraryPage from '@/components/LibraryPage'
import BarterPage from '@/components/BarterPage'
import LoansPage from '@/components/LoansPage'
import NotificationsPage from '@/components/NotificationsPage'
import ProfilePage from '@/components/ProfilePage'
import AdminPage from '@/components/AdminPage'
import AuthModal from '@/components/AuthModal'
import Toast from '@/components/Toast'

export type Page = 'home' | 'library' | 'barter' | 'loans' | 'notifications' | 'profile' | 'admin'

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup')
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [notifCount, setNotifCount] = useState(0)
  const supabase = createBrowserClient()

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

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => setNotifCount(c => c + 1))
      .subscribe()
    loadNotifCount()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function loadProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data)
  }

  async function loadNotifCount() {
    if (!user) return
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
    setNotifCount(count || 0)
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function requireAuth(action: () => void) {
    if (!user) { setAuthMode('signup'); setShowAuth(true) }
    else action()
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

      {page === 'home' && <HomePage ctx={ctx} />}
      {page === 'library' && <LibraryPage ctx={ctx} />}
      {page === 'barter' && <BarterPage ctx={ctx} />}
      {page === 'loans' && <LoansPage ctx={ctx} />}
      {page === 'notifications' && <NotificationsPage ctx={ctx} onRead={loadNotifCount} />}
      {page === 'profile' && <ProfilePage ctx={ctx} />}
      {page === 'admin' && profile?.is_admin && <AdminPage ctx={ctx} />}

      {showAuth && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuth(false)}
          onSuccess={(msg: string) => { setShowAuth(false); showToast(msg) }}
          showToast={showToast}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </>
  )
}
