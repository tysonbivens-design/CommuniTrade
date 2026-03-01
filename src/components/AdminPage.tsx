'use client'
import { useState, useEffect } from 'react'
import { useSupabase } from '@/lib/useSupabase'
import type { Item, ItemFlag, AppCtx } from '@/types'

interface FlaggedItem extends Item {
  item_flags: ItemFlag[]
  profiles: { full_name: string | null; email: string | null }
}

interface AdminPageProps {
  ctx: AppCtx
}

export default function AdminPage({ ctx }: AdminPageProps) {
  const { showToast } = ctx
  const supabase = useSupabase()
  const [flagged, setFlagged] = useState<FlaggedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data, error } = await supabase
      .from('items')
      .select('*, profiles(full_name, email), item_flags(*)')
      .eq('flagged', true)
      .order('created_at', { ascending: false })

    if (!error) setFlagged((data as FlaggedItem[]) || [])
    setLoading(false)
  }

  async function resolve(item: FlaggedItem, action: 'keep' | 'remove') {
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
    load()
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="container">
        <div className="section">
          <h1 className="section-title">Admin Dashboard</h1>
          <p className="section-subtitle">Review flagged listings from the community</p>

          {loading ? (
            <p style={{ color: 'var(--muted)' }}>Loading…</p>
          ) : flagged.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h3 style={{ fontFamily: 'Fraunces, serif' }}>No flagged items</h3>
              <p>The community is keeping things tidy!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {flagged.map(item => (
                <div key={item.id} style={{ background: '#fff', border: '2px solid #FEECEC', borderRadius: 12, padding: '1.25rem', boxShadow: '0 2px 8px var(--shadow)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ fontFamily: 'Fraunces, serif', marginBottom: '0.25rem' }}>{item.title}</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>By {item.profiles?.full_name} · {item.category}</p>
                      <p style={{ fontSize: '0.82rem', color: '#C62828', marginTop: '0.5rem' }}>
                        🚩 {item.item_flags?.length || 0} flags: {item.item_flags?.map(f => f.reason).join(', ')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => resolve(item, 'keep')}>✅ Keep (clear flags)</button>
                      <button className="btn btn-sm" style={{ background: '#C62828', color: '#fff' }} onClick={() => resolve(item, 'remove')}>🗑 Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
