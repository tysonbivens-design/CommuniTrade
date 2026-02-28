'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import ItemCard from './ItemCard'
import styles from './HomePage.module.css'

export default function HomePage({ ctx }: any) {
  const { user, showToast, requireAuth, navigate } = ctx
  const [recent, setRecent] = useState<any[]>([])
  const [stats, setStats] = useState({ items: 0, members: 0, trades: 0 })
  const supabase = createBrowserClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase.from('items').select('*, profiles(full_name, trust_score, avatar_color)').eq('status', 'available').order('created_at', { ascending: false }).limit(4)
    setRecent(data || [])
    const { count: itemCount } = await supabase.from('items').select('*', { count: 'exact', head: true })
    const { count: memberCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
    const { count: loanCount } = await supabase.from('loans').select('*', { count: 'exact', head: true })
    setStats({ items: itemCount || 0, members: memberCount || 0, trades: loanCount || 0 })
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>Your neighborhood's<br /><em>shared shelf.</em></h1>
          <p className={styles.heroSub}>Borrow books, swap DVDs, trade skills — with real people in your community. No cash, no corporations. Just neighbors helping neighbors.</p>
          <div className={styles.heroBtns}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('library')}>Browse the Library</button>
            <button className={styles.secondaryBtn} onClick={() => requireAuth(() => navigate('library'))}>+ Add Your Items</button>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.stat}><div className={styles.statNum}>{stats.items}</div><div className={styles.statLabel}>Items Available</div></div>
            <div className={styles.stat}><div className={styles.statNum}>{stats.members}</div><div className={styles.statLabel}>Active Members</div></div>
            <div className={styles.stat}><div className={styles.statNum}>{stats.trades}</div><div className={styles.statLabel}>Trades Completed</div></div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="section">
          <h2 className="section-title">Recently Added Near You</h2>
          <p className="section-subtitle">Fresh additions from your neighbors</p>
          {recent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
              <p>Nothing yet — be the first to add something!</p>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => requireAuth(() => navigate('library'))}>Add the first item</button>
            </div>
          ) : (
            <div className="grid-4">
              {recent.map(item => (
                <ItemCard key={item.id} item={item}
                  onBorrow={() => requireAuth(() => navigate('library'))}
                  onFlag={() => requireAuth(() => {})}
                />
              ))}
            </div>
          )}
        </div>

        <div className={styles.ctaBanner}>
          <h2>Got a shelf full of DVDs or books?</h2>
          <p>Snap a photo and our AI will catalog everything in seconds — then you approve what to share.</p>
          <button className="btn btn-primary btn-lg" onClick={() => requireAuth(() => navigate('library'))}>Try AI Catalog Upload →</button>
        </div>
      </div>
    </div>
  )
}
