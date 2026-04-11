import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, APP_URL } from '@/lib/email'
import { sendPushToUser } from '@/lib/webpush'

// ─── Vercel Cron — runs daily at 11am UTC ─────────────────────────────────────
// Finds items added in the last 24 hours and notifies nearby users
// Max 1 proximity push per user per day to avoid spam

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  let sent = 0
  let skipped = 0

  try {
    // Fetch items added in the last 24 hours
    const { data: newItems } = await supabaseAdmin
      .from('items')
      .select('id, title, category, offer_type, user_id, profiles!inner(id, lat, lng, full_name)')
      .eq('archived', false)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })

    if (!newItems?.length) {
      return NextResponse.json({ sent, skipped, message: 'No new items in last 24hrs' })
    }

    // Fetch all users with push subscriptions who have a location set
    const { data: subscribers } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id, profiles!inner(id, lat, lng, radius_miles, full_name)')

    if (!subscribers?.length) {
      return NextResponse.json({ sent, skipped, message: 'No subscribers' })
    }

    // Track who we have already notified today (one push per user max)
    const notifiedToday = new Set<string>()

    for (const sub of subscribers) {
      const profile = sub.profiles as any
      if (!profile?.lat || !profile?.lng) { skipped++; continue }

      const userLat = profile.lat as number
      const userLng = profile.lng as number
      const radiusMiles = (profile.radius_miles as number) || 25

      // Find new items within radius that are not from this user
      const nearbyItems = newItems.filter(item => {
        if (item.user_id === sub.user_id) return false
        const ownerProfile = item.profiles as any
        if (!ownerProfile?.lat || !ownerProfile?.lng) return false
        const dist = distanceMiles(userLat, userLng, ownerProfile.lat, ownerProfile.lng)
        return dist <= radiusMiles
      })

      if (!nearbyItems.length) { skipped++; continue }
      if (notifiedToday.has(sub.user_id)) { skipped++; continue }

      // Pick the most relevant item — prefer free/lend over swap/barter
      const priority = ['free', 'lend', 'swap', 'barter']
      const sorted = [...nearbyItems].sort((a, b) =>
        priority.indexOf(a.offer_type) - priority.indexOf(b.offer_type)
      )
      const item = sorted[0]
      const ownerProfile = item.profiles as any

      const OFFER_LABEL: Record<string, string> = {
        lend: 'available to borrow',
        free: 'free to claim',
        swap: 'up for swap',
        barter: 'open to barter',
      }
      const label = OFFER_LABEL[item.offer_type] || 'just listed'
      const extraCount = nearbyItems.length - 1

      const title = 'New item near you'
      const body = extraCount > 0
        ? `"${item.title}" is ${label} from ${ownerProfile?.full_name || 'a neighbor'} +${extraCount} more`
        : `"${item.title}" is ${label} from ${ownerProfile?.full_name || 'a neighbor'}`

      // Send push notification
      await sendPushToUser(sub.user_id, {
        title,
        body,
        url: `${APP_URL}?page=library`,
      }).catch(() => {})

      // Save in-app notification — properly awaited
      const { error: notifError } = await supabaseAdmin.from('notifications').insert({
        user_id: sub.user_id,
        type: 'loan_request',
        title,
        body,
        data: { page: 'library', item_id: item.id },
      })

      if (notifError) {
        console.error(`Failed to save proximity notification for user ${sub.user_id}:`, notifError.message)
      }

      notifiedToday.add(sub.user_id)
      sent++
    }

    return NextResponse.json({ sent, skipped })
  } catch (err: unknown) {
    console.error('Proximity cron error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
