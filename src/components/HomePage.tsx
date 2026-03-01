'use client'
import { useState, useEffect } from 'react'
import { useSupabase } from '@/lib/useSupabase'
import ItemCard from './ItemCard'
import styles from './HomePage.module.css'
import type { Item, AppCtx } from '@/types'

interface HomeStats {
  items: number
  members: number
  trades: number
}

interface HomePageProps {
  ctx: AppCtx
}

export default function HomePage({ ctx }: HomePageProps) {
  const { user, requireAuth, navigate } = ctx
  const supabase = useSupabase()
  const [recent, setRecent] = useState<Item[]>([])
  const [stats, setStats] = useState<HomeStats>({ items: 0, members: 0, trades: 0 })

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      const [itemsResult, itemCount, memberCount, loanCount] = await Promise.all([
        supabase
          .from('items')
          .select('*, profiles(full_name, trust_score, avatar_color, lat, lng)')
          .eq('status', 'available')
          .order('created_at', { ascending: false })
          .limit(4),
        supabase.from('items').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('loans').select('*', { count: 'exact', head: true }),
      ])

      if (cancelled) return

      if (!itemsResult.error) setRecent((itemsResult.data as Item[]) || [])
      setStats({
        items: itemCount.count || 0,
        members: memberCount.count || 0,
        trades: loanCount.count || 0,
      })
    }

    loadData()
    return () => { cancelled = true }
  }, [])

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
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => requireAuth(() => navigate('library'))}>
                Add the first item
              </button>
            </div>
          ) : (
            <div className="grid-4">
              {recent.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onBorrow={() => requireAuth(() => navigate('library'))}
                  onFlag={() => {}}
                />
              ))}
            </div>
          )}
        </div>

        <div className={styles.ctaBanner}>
          <h2>Got a shelf full of DVDs or books?</h2>
          <p>Snap a photo and our AI will catalog everything in seconds — then you approve what to share.</p>
          <button className="btn btn-primary btn-lg" onClick={() => requireAuth(() => navigate('library'))}>
            Try AI Catalog Upload →
          </button>
        </div>
      </div>
    </div>
  )
}
