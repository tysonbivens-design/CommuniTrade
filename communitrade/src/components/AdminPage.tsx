'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'

export default function AdminPage({ ctx }: any) {
  const { showToast } = ctx
  const [flagged, setFlagged] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('items')
      .select('*, profiles(full_name, email), item_flags(*)')
      .eq('flagged', true)
      .order('created_at', { ascending: false })
    setFlagged(data || [])
    setLoading(false)
  }

  async function resolve(item: any, action: 'keep' | 'remove') {
    if (action === 'remove') {
      await supabase.from('items').delete().eq('id', item.id)
      showToast('Item removed')
    } else {
      await supabase.from('items').update({ flagged: false, flag_count: 0 }).eq('id', item.id)
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

          {loading ? <p style={{ color: 'var(--muted)' }}>Loading…</p> :
            flagged.length === 0 ? (
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
                          🚩 {item.item_flags?.length || 0} flags:
                          {' '}{item.item_flags?.map((f: any) => f.reason).join(', ')}
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
            )
          }
        </div>
      </div>
    </div>
  )
}
