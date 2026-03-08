'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { Item, ItemFlag, UserFlag, AppCtx } from '@/types'

const PAGE_SIZE = 15

interface FlaggedItem extends Omit<Item, 'profiles'> {
  item_flags: ItemFlag[]
  profiles: { full_name: string | null; email: string | null; trust_score: number; avatar_color: string | null; lat: number | null; lng: number | null }
}

interface FlaggedUser {
  id: string
  full_name: string | null
  email: string | null
  avatar_color: string | null
  trust_score: number
  suspended: boolean
  user_flags: UserFlag[]
  flag_count: number
}

interface AdminPageProps {
  ctx: AppCtx
}

export default function AdminPage({ ctx }: AdminPageProps) {
  const { showToast } = ctx
  const supabase = createBrowserClient()
  const [tab, setTab] = useState<'items' | 'users'>('items')

  const [flagged, setFlagged] = useState<FlaggedItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [loadingMoreItems, setLoadingMoreItems] = useState(false)
  const [hasMoreItems, setHasMoreItems] = useState(false)
  const [itemOffset, setItemOffset] = useState(0)

  const [flaggedUsers, setFlaggedUsers] = useState<FlaggedUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false)
  const [hasMoreUsers, setHasMoreUsers] = useState(false)
  const [userOffset, setUserOffset] = useState(0)
  const [usersLoaded, setUsersLoaded] = useState(false)

  useEffect(() => { loadItemPage(0, true) }, [])

  useEffect(() => {
    if (tab === 'users' && !usersLoaded) {
      loadUserPage(0, true)
      setUsersLoaded(true)
    }
  }, [tab])

  async function loadItemPage(fromOffset: number, initial = false) {
    if (initial) setLoadingItems(true)
    else setLoadingMoreItems(true)

    const { data, error } = await supabase
      .from('items')
      .select('*, profiles(full_name, email), item_flags(*)')
      .eq('flagged', true)
      .order('created_at', { ascending: false })
      .range(fromOffset, fromOffset + PAGE_SIZE - 1)

    if (!error && data) {
      const newItems = data as FlaggedItem[]
      setFlagged(prev => initial ? newItems : [...prev, ...newItems])
      setHasMoreItems(newItems.length === PAGE_SIZE)
      setItemOffset(fromOffset + newItems.length)
    }
    if (initial) setLoadingItems(false)
    else setLoadingMoreItems(false)
  }

  async function loadUserPage(fromOffset: number, initial = false) {
    if (initial) setLoadingUsers(true)
    else setLoadingMoreUsers(true)

    // Fetch profiles that have at least one user_flag
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_color, trust_score, suspended, user_flags(*)')
      .order('created_at', { ascending: false })
      .range(fromOffset, fromOffset + PAGE_SIZE - 1)

    if (!error && data) {
      // Filter to only those with flags, sort suspended first then by flag count
      const withFlags = data
        .filter((u: any) => Array.isArray(u.user_flags) && u.user_flags.length > 0)
        .map((u: any) => ({ ...u, flag_count: u.user_flags.length }))
        .sort((a: any, b: any) => {
          if (a.suspended !== b.suspended) return a.suspended ? -1 : 1
          return b.flag_count - a.flag_count
        }) as FlaggedUser[]

      setFlaggedUsers(prev => initial ? withFlags : [...prev, ...withFlags])
      setHasMoreUsers(data.length === PAGE_SIZE)
      setUserOffset(fromOffset + data.length)
    }
    if (initial) setLoadingUsers(false)
    else setLoadingMoreUsers(false)
  }

  async function resolveItem(item: FlaggedItem, action: 'keep' | 'remove') {
    if (action === 'remove') {
      const { error } = await supabase.from('items').delete().eq('id', item.id)
      if (error) { showToast(error.message, 'error'); return }
      showToast('Item removed')
    } else {
      const { error } = await supabase.from('items').update({ flagged: false, flag_count: 0 }).eq('id', item.id)
      if (error) { showToast(error.message, 'error'); return }
      await supabase.from('item_flags').update({ resolved: true }).eq('item_id', item.id)
      showToast('Item cleared — flags resolved')
    }
    setFlagged(prev => prev.filter(f => f.id !== item.id))
  }

  async function unsuspendUser(userId: string, userName: string) {
    const { error } = await supabase.from('profiles').update({ suspended: false }).eq('id', userId)
    if (error) { showToast(error.message, 'error'); return }
    await supabase.from('user_flags').update({ resolved: true }).eq('reported_user_id', userId)
    setFlaggedUsers(prev => prev.map(u => u.id === userId ? { ...u, suspended: false } : u))
    showToast(`${userName} has been unsuspended ✅`)
  }

  async function suspendUser(userId: string, userName: string) {
    if (!window.confirm(`Manually suspend ${userName}? They will be unable to transact on the platform.`)) return
    const { error } = await supabase.from('profiles').update({ suspended: true }).eq('id', userId)
    if (error) { showToast(error.message, 'error'); return }
    setFlaggedUsers(prev => prev.map(u => u.id === userId ? { ...u, suspended: true } : u))
    showToast(`${userName} has been suspended`)
  }

  async function dismissUserFlags(userId: string) {
    const { error } = await supabase.from('user_flags').update({ resolved: true }).eq('reported_user_id', userId)
    if (error) { showToast(error.message, 'error'); return }
    setFlaggedUsers(prev => prev.filter(u => u.id !== userId))
    showToast('Reports dismissed')
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="container">
        <div className="section">
          <h1 className="section-title">Admin Dashboard</h1>
          <p className="section-subtitle">Review flagged listings and reported users</p>

          <div className="tabs" style={{ marginBottom: '1.5rem' }}>
            <button className={`tab ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>
              🚩 Flagged Items
              {flagged.length > 0 && (
                <span style={{ background: 'var(--rust)', color: '#fff', borderRadius: 10, padding: '0.05rem 0.4rem', fontSize: '0.72rem', marginLeft: '0.3rem' }}>
                  {flagged.length}
                </span>
              )}
            </button>
            <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
              🚨 Reported Users
              {flaggedUsers.filter(u => u.suspended).length > 0 && (
                <span style={{ background: '#C62828', color: '#fff', borderRadius: 10, padding: '0.05rem 0.4rem', fontSize: '0.72rem', marginLeft: '0.3rem' }}>
                  {flaggedUsers.filter(u => u.suspended).length}
                </span>
              )}
            </button>
          </div>

          {/* ── FLAGGED ITEMS ── */}
          {tab === 'items' && (
            loadingItems ? <p style={{ color: 'var(--muted)' }}>Loading…</p>
            : flagged.length === 0 ? (
              <EmptyState icon="✅" title="No flagged items" body="The community is keeping things tidy!" />
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {flagged.map(item => (
                    <div key={item.id} style={{
                      background: '#fff', border: '2px solid #FEECEC', borderRadius: 12,
                      padding: '1.25rem', boxShadow: '0 2px 8px var(--shadow)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                          <h3 style={{ fontFamily: 'Fraunces, serif', marginBottom: '0.25rem' }}>{item.title}</h3>
                          <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                            By <strong>{item.profiles?.full_name}</strong>
                            {item.profiles?.email ? ` (${item.profiles.email})` : ''} · {item.category}
                          </p>
                          <p style={{ fontSize: '0.82rem', color: '#C62828', marginTop: '0.5rem' }}>
                            🚩 {item.item_flags?.length || 0} flags: {item.item_flags?.map(f => f.reason).join(', ')}
                          </p>
                          {item.item_flags?.some(f => f.notes) && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic', marginTop: '0.35rem' }}>
                              "{item.item_flags.filter(f => f.notes).map(f => f.notes).join(' · ')}"
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flexShrink: 0 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => resolveItem(item, 'keep')}>
                            ✅ Keep (clear flags)
                          </button>
                          <button className="btn btn-sm" style={{ background: '#C62828', color: '#fff' }}
                            onClick={() => resolveItem(item, 'remove')}>
                            🗑 Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {hasMoreItems && (
                  <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <button className="btn btn-outline btn-lg" onClick={() => loadItemPage(itemOffset)}
                      disabled={loadingMoreItems} style={{ minWidth: 200 }}>
                      {loadingMoreItems
                        ? <span className="spinner" style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: 'var(--bark)' }} />
                        : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )
          )}

          {/* ── REPORTED USERS ── */}
          {tab === 'users' && (
            loadingUsers ? <p style={{ color: 'var(--muted)' }}>Loading…</p>
            : flaggedUsers.length === 0 ? (
              <EmptyState icon="👤" title="No reported users" body="No community members have been reported yet." />
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {flaggedUsers.map(u => (
                    <div key={u.id} style={{
                      background: '#fff',
                      border: `2px solid ${u.suspended ? '#C62828' : '#FFF3E0'}`,
                      borderRadius: 12, padding: '1.25rem',
                      boxShadow: '0 2px 8px var(--shadow)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <span className="avatar"
                            style={{ background: u.avatar_color || '#C4622D', width: 40, height: 40, fontSize: '1rem', flexShrink: 0 }}>
                            {u.full_name?.[0] || '?'}
                          </span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.05rem' }}>{u.full_name}</h3>
                              {u.suspended && (
                                <span style={{ background: '#C62828', color: '#fff', borderRadius: 6, padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 600 }}>
                                  SUSPENDED
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
                              {u.email} · Trust ⭐{u.trust_score?.toFixed(1)}
                            </p>
                            <p style={{ fontSize: '0.82rem', color: '#C62828', marginTop: '0.4rem' }}>
                              🚨 {u.flag_count} report{u.flag_count !== 1 ? 's' : ''}:{' '}
                              {Array.isArray(u.user_flags) && u.user_flags.map((f: UserFlag) => f.reason).join(', ')}
                            </p>
                            {Array.isArray(u.user_flags) && u.user_flags.some((f: UserFlag) => f.notes) && (
                              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                                "{u.user_flags.filter((f: UserFlag) => f.notes).map((f: UserFlag) => f.notes).join(' · ')}"
                              </p>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flexShrink: 0 }}>
                          {u.suspended ? (
                            <button className="btn btn-sm" style={{ background: 'var(--sage)', color: '#fff' }}
                              onClick={() => unsuspendUser(u.id, u.full_name || 'User')}>
                              ✅ Unsuspend
                            </button>
                          ) : (
                            <button className="btn btn-sm" style={{ background: '#C62828', color: '#fff' }}
                              onClick={() => suspendUser(u.id, u.full_name || 'User')}>
                              🚫 Suspend
                            </button>
                          )}
                          <button className="btn btn-outline btn-sm"
                            onClick={() => dismissUserFlags(u.id)}>
                            Dismiss Reports
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {hasMoreUsers && (
                  <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <button className="btn btn-outline btn-lg" onClick={() => loadUserPage(userOffset)}
                      disabled={loadingMoreUsers} style={{ minWidth: 200 }}>
                      {loadingMoreUsers
                        ? <span className="spinner" style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: 'var(--bark)' }} />
                        : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{icon}</div>
      <h3 style={{ fontFamily: 'Fraunces, serif', marginBottom: '0.5rem' }}>{title}</h3>
      <p>{body}</p>
    </div>
  )
}
