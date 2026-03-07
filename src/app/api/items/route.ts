import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getIp } from '@/lib/ratelimit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MAX_ITEMS     = 500          // lifetime cap per user (unarchived)
const HOURLY_LIMIT  = 10           // max new items per user per hour
const HOURLY_WINDOW = 60 * 60 * 1000
const IP_LIMIT      = 30           // IP-level backstop
const IP_WINDOW     = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  // ── IP backstop ────────────────────────────────────────────────────────────
  const ip = getIp(req)
  if (!rateLimit(ip, IP_LIMIT, IP_WINDOW)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const { userId, items } = body  // items is an array — single-item adds pass [item]

    if (!userId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // ── Per-user hourly flood check (in-memory) ────────────────────────────
    if (!rateLimit(`items:${userId}`, HOURLY_LIMIT, HOURLY_WINDOW)) {
      return NextResponse.json(
        { error: 'You\'re adding items too quickly. Please wait a bit before adding more.' },
        { status: 429 }
      )
    }

    // ── Lifetime item cap (DB-backed, survives cold starts) ────────────────
    const { count } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('archived', false)

    const currentCount = count ?? 0
    if (currentCount + items.length > MAX_ITEMS) {
      const remaining = Math.max(0, MAX_ITEMS - currentCount)
      return NextResponse.json(
        {
          error: remaining === 0
            ? `You've reached the ${MAX_ITEMS}-item limit. Archive some items to add more.`
            : `Adding ${items.length} items would exceed the ${MAX_ITEMS}-item limit. You have room for ${remaining} more.`
        },
        { status: 422 }
      )
    }

    // ── Insert all items ───────────────────────────────────────────────────
    const rows = items.map((item: Record<string, unknown>) => ({
      ...item,
      user_id: userId,   // always force userId from the validated field, not client body
      status: 'available',
    }))

    const { error } = await supabase.from('items').insert(rows)
    if (error) throw error

    return NextResponse.json({ ok: true, inserted: rows.length })
  } catch (err: unknown) {
    console.error('Items route error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not add item' },
      { status: 500 }
    )
  }
}
