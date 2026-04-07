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

interface CoverItem {
  id: string
  title: string
  category: string
  cover_image_url: string | null
}

interface AdminPageProps {
  ctx: AppCtx
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <h3 style={{ fontFamily: 'Fraunces, serif', marginBottom: '0.5rem' }}>{title}</h3>
      <p>{body}</p>
    </div>
  )
}

const CATEGORY_EMOJI: Record<string, string> = {
  Book: '📚', DVD: '🎬', VHS: '📼', Game: '🎮',
}

export default function AdminPage({ ctx }: AdminPageProps) {
  const { showToast } = ctx
  const supabase = createBrowserClient()
  const [tab, setTab] = useState<'items' | 'users' | 'covers'>('items')

  // ── Flagged items state ───────────────────────────────────────────────────
  const [flagged, setFlagged] = useState<FlaggedItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [loadingMoreItems, setLoadingMoreItems] = useState(false)
  const [hasMoreItems, setHasMoreItems] = useState(false)
  const [itemOffset, setItemOffset] = useState(0)

  // ── Flagged users state ───────────────────────────────────────────────────
  const [flaggedUsers, setFlaggedUsers] = useState<FlaggedUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false)
  const [hasMoreUsers, setHasMoreUsers] = useState(false)
  const [userOffset, setUserOffset] = useState(0)
  const [usersLoaded, setUsersLoaded] = useState(false)

  // ── Cover backfill state ──────────────────────────────────────────────────
  const [coverItems, setCoverItems] = useState<CoverItem[]>([])
  const [loadingCovers, setLoadingCovers] = useState(false)
  const [coversLoaded, setCoversLoaded] = useState(false)
  const [fetchingAll, setFetchingAll] = useState(false)
  const [fetchProgress, setFetchProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => { loadItemPage(0, true) }, [])

  useEffect(() => {
    if (tab === 'users' && !usersLoaded) {
      loadUserPage(0, true)
      setUsersLoaded(true)
    }
    if (tab === 'covers' && !coversLoaded) {
      loadCoverItems()
      setCoversLoaded(true)
    }
  }, [tab])

  // ── Flagged items ─────────────────────────────────────────────────────────

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

  // ── Flagged users ─────────────────────────────────────────────────────────

  async function loadUserPage(fromOffset: number, initial = false) {
    if (initial) setLoadingUsers(true)
    else setLoadingMoreUsers(true)

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_color, trust_score, suspended, user_flags(*)')
      .order('created_at', { ascending: false })
      .range(fromOffset, fromOffset + PAGE_SIZE - 1)

    if (!error && data) {
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

  // ── Cover backfill ────────────────────────────────────────────────────────

  async function loadCoverItems() {
    setLoadingCovers(true)
    const { data } = await supabase
      .from('items')
      .select('id, title, category, cover_image_url')
      .in('category', ['Book', 'DVD', 'VHS', 'Game'])
      .eq('archived', false)
      .order('category')
      .order('title')
    setCoverItems((data as CoverItem[]) || [])
    setLoadingCovers(false)
  }

  async function fetchCoverUrl(item: CoverItem): Promise<string | null> {
    try {
      if (item.category === 'Book') {
        const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(item.title)}&limit=1`)
        const data = await res.json()
        if (data.docs?.[0]?.cover_i) {
          return `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-M.jpg`
        }
      } else if (item.category === 'DVD' || item.category === 'VHS') {
        const res = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(item.title)}&apikey=${process.env.NEXT_PUBLIC_OMDB_API_KEY || 'd5714ece'}`)
        const data = await res.json()
        if (data.Poster && data.Poster !== 'N/A') return data.Poster
      } else if (item.category === 'Game') {
        const res = await fetch('/api/igdb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: item.title }),
        })
        const data = await res.json()
        if (data.cover_url) return data.cover_url
      }
    } catch { /* silent */ }
    return null
  }

  async function fetchSingleCover(item: CoverItem) {
    const url = await fetchCoverUrl(item)
    if (!url) { showToast(`No cover found for "${item.title}"`, 'error'); return }
    const { error } = await supabase.from('items').update({ cover_image_url: url }).eq('id', item.id)
    if (error) { showToast(error.message, 'error'); return }
    setCoverItems(prev => prev.map(c => c.id === item.id ? { ...c, cover_image_url: url } : c))
    showToast(`Cover updated for "${item.title}" ✅`)
  }

  async function fetchAllMissingCovers() {
    const missing = coverItems.filter(c => !c.cover_image_url)
    if (!missing.length) { showToast('All items already have cover art!'); return }
    if (!window.confirm(`Fetch covers for ${missing.length} item${missing.length !== 1 ? 's' : ''}? This may take a moment.`)) return

    setFetchingAll(true)
    setFetchProgress({ done: 0, total: missing.length })
    let updated = 0

    for (const item of missing) {
      const url = await fetchCoverUrl(item)
      if (url) {
        await supabase.from('items').update({ cover_image_url: url }).eq('id', item.id)
        setCoverItems(prev => prev.map(c => c.id === item.id ? { ...c, cover_image_url: url } : c))
        updated++
      }
      setFetchProgress(p => p ? { ...p, done: p.done + 1 } : null)
      await new Promise(r => setTimeout(r, 250))
    }

    setFetchingAll(false)
    setFetchProgress(null)
    showToast(`Done! Updated ${updated} of ${missing.length} items ✅`)
  }

  const missingCount = coverItems.filter(c => !c.cover_image_url).length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="container">
        <div className="section">
          <h1 className="section-title">Admin Dashboard</h1>
          <p className="section-subtitle">Review flagged listings, reported users, and manage cover art</p>

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
            <button className={`tab ${tab === 'covers' ? 'active' : ''}`} onClick={() => setTab('covers')}>
              🖼 Cover Art
              {coversLoaded && missingCount > 0 && (
                <span style={{ background: 'var(--gold)', color: 'var(--bark)', borderRadius: 10, padding: '0.05rem 0.4rem', fontSize: '0.72rem', marginLeft: '0.3rem' }}>
                  {missingCount}
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
                              🚨 {u.flag_count} report{u.flag_count !== 1 ? 's' : ''}: {u.user_flags?.map((f: any) => f.reason).join(', ')}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flexShrink: 0 }}>
                          {u.suspended ? (
                            <button className="btn btn-outline btn-sm" onClick={() => unsuspendUser(u.id, u.full_name || 'User')}>
                              ✅ Unsuspend
                            </button>
                          ) : (
                            <button className="btn btn-sm" style={{ background: '#C62828', color: '#fff' }}
                              onClick={() => suspendUser(u.id, u.full_name || 'User')}>
                              🚫 Suspend
                            </button>
                          )}
                          <button className="btn btn-outline btn-sm" style={{ color: 'var(--muted)' }}
                            onClick={() => dismissUserFlags(u.id)}>
                            Dismiss
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

          {/* ── COVER ART ── */}
          {tab === 'covers' && (
            loadingCovers ? <p style={{ color: 'var(--muted)' }}>Loading…</p>
            : coverItems.length === 0 ? (
              <EmptyState icon="🖼" title="No eligible items" body="Books, DVDs, VHS tapes, and Games will appear here once members add them." />
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
                    {coverItems.filter(c => c.cover_image_url).length} of {coverItems.length} items have cover art
                    {missingCount > 0 && ` · ${missingCount} missing`}
                  </p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={fetchAllMissingCovers}
                    disabled={fetchingAll || missingCount === 0}
                  >
                    {fetchingAll
                      ? fetchProgress
                        ? `Fetching… ${fetchProgress.done}/${fetchProgress.total}`
                        : 'Fetching…'
                      : `🖼 Fetch All Missing (${missingCount})`}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {coverItems.map(item => (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: '1rem',
                      background: '#fff', borderRadius: 10, padding: '0.75rem 1rem',
                      border: '1px solid var(--border)', boxShadow: '0 1px 4px var(--shadow)',
                    }}>
                      {/* Thumbnail */}
                      <div style={{
                        width: 36, height: 50, borderRadius: 3, overflow: 'hidden', flexShrink: 0,
                        background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid var(--border)',
                      }}>
                        {item.cover_image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={item.cover_image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: '1rem' }}>{CATEGORY_EMOJI[item.category] || '📦'}</span>
                        }
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {item.category} · {item.cover_image_url
                            ? <span style={{ color: 'var(--sage)' }}>✅ Has cover</span>
                            : <span>⬜ Missing</span>}
                        </div>
                      </div>

                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => fetchSingleCover(item)}
                        disabled={fetchingAll}
                        style={{ flexShrink: 0 }}
                      >
                        {item.cover_image_url ? '🔄 Re-fetch' : '🖼 Fetch'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )
          )}

        </div>
      </div>
    </div>
  )
}
