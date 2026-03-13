test
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, resend, emailTemplate, esc, FROM, APP_URL } from '@/lib/email'
import { sendPushToUser } from '@/lib/webpush'

// ─── Vercel Cron — runs daily at 9am UTC ──────────────────────────────────────
// Registered in vercel.json alongside /api/cron/overdue
// Secured with CRON_SECRET env var — Vercel sets this automatically.
//
// Two independent nudge tracks per user:
//   library  — user has zero items listed
//   barter   — user has zero barter posts
//
// Each track fires at day 3 and day 7 after signup (if still no action).
// Max 2 nudges per track. Stops once the user takes action on that track.
// State tracked in activation_nudges table.

const NUDGE_DAYS = [3, 7]
const MAX_NUDGES = 2

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  let librarySent = 0
  let barterSent = 0

  try {
    // ── Find candidates: confirmed users signed up 3+ days ago ───────────────
    const cutoff = new Date(now.getTime() - NUDGE_DAYS[0] * 24 * 60 * 60 * 1000)

    const { data: candidates } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, created_at')
      .lte('created_at', cutoff.toISOString())
      .not('email', 'is', null)

    if (!candidates?.length) return NextResponse.json({ librarySent, barterSent })

    // ── Load existing nudge records for these users ───────────────────────────
    const userIds = candidates.map(u => u.id)

    const { data: existingNudges } = await supabaseAdmin
      .from('activation_nudges')
      .select('*')
      .in('user_id', userIds)

    // Index: user_id + type → nudge record
    const nudgeMap = new Map<string, { sent_count: number; last_sent_at: string }>()
    for (const n of existingNudges || []) {
      nudgeMap.set(`${n.user_id}:${n.type}`, { sent_count: n.sent_count, last_sent_at: n.last_sent_at })
    }

    // ── Check item counts for all candidates in one query ────────────────────
    const { data: itemCounts } = await supabaseAdmin
      .from('items')
      .select('user_id')
      .in('user_id', userIds)
      .eq('archived', false)

    const { data: barterCounts } = await supabaseAdmin
      .from('barter_posts')
      .select('user_id')
      .in('user_id', userIds)
      .eq('status', 'active')

    const usersWithItems = new Set((itemCounts || []).map(r => r.user_id))
    const usersWithBarter = new Set((barterCounts || []).map(r => r.user_id))

    // ── Process each candidate ───────────────────────────────────────────────
    for (const user of candidates) {
      const daysSinceSignup = Math.floor(
        (now.getTime() - new Date(user.created_at).getTime()) / (24 * 60 * 60 * 1000)
      )

      // ── Library nudge track ───────────────────────────────────────────────
      if (!usersWithItems.has(user.id)) {
        const nudgeKey = `${user.id}:library`
        const existing = nudgeMap.get(nudgeKey)
        const sentCount = existing?.sent_count ?? 0

        if (sentCount < MAX_NUDGES && shouldNudgeToday(daysSinceSignup, sentCount, existing?.last_sent_at)) {
          await sendLibraryNudge(user)
          await upsertNudge(user.id, 'library', sentCount)
          librarySent++
        }
      }

      // ── Barter nudge track ────────────────────────────────────────────────
      if (!usersWithBarter.has(user.id)) {
        const nudgeKey = `${user.id}:barter`
        const existing = nudgeMap.get(nudgeKey)
        const sentCount = existing?.sent_count ?? 0

        if (sentCount < MAX_NUDGES && shouldNudgeToday(daysSinceSignup, sentCount, existing?.last_sent_at)) {
          await sendBarterNudge(user)
          await upsertNudge(user.id, 'barter', sentCount)
          barterSent++
        }
      }
    }

    return NextResponse.json({ librarySent, barterSent })
  } catch (err: unknown) {
    console.error('Activation cron error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shouldNudgeToday(
  daysSinceSignup: number,
  sentCount: number,
  lastSentAt: string | undefined
): boolean {
  // Which nudge day are we targeting?
  const targetDay = NUDGE_DAYS[sentCount] // 0 → day 3, 1 → day 7
  if (targetDay === undefined) return false

  // Must be on or past the target day
  if (daysSinceSignup < targetDay) return false

  // Don't re-send if we already sent one recently (within 1 day)
  if (lastSentAt) {
    const hoursSinceLast = (Date.now() - new Date(lastSentAt).getTime()) / (60 * 60 * 1000)
    if (hoursSinceLast < 20) return false
  }

  return true
}

async function upsertNudge(userId: string, type: 'library' | 'barter', currentCount: number) {
  await supabaseAdmin
    .from('activation_nudges')
    .upsert(
      {
        user_id: userId,
        type,
        sent_count: currentCount + 1,
        last_sent_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,type' }
    )
}

async function sendLibraryNudge(user: { id: string; email: string; full_name: string | null }) {
  const firstName = esc(user.full_name?.split(' ')[0] || 'neighbor')

  await Promise.all([
    resend.emails.send({
      from: FROM,
      to: user.email,
      subject: '📚 Your neighbors are waiting — share your first item!',
      html: emailTemplate({
        heading: 'Share something with your community 📚',
        body: `Hi ${firstName},<br><br>
You joined CommuniTrade a few days ago — welcome! 🎉<br><br>
The community grows when neighbors share. Got a book you've finished, a tool you rarely use, or a DVD collecting dust? Listing it takes about 60 seconds, and you can even use our AI photo scanner to catalog a whole shelf at once.<br><br>
Your neighbors are ready to borrow — be the first to share something!`,
        ctaText: 'Add My First Item →',
        ctaUrl: `${APP_URL}?page=library`,
      }),
    }),
    sendPushToUser(user.id, {
      title: 'Share your first item 📚',
      body: 'Your neighbors are ready to borrow. List something — it only takes a minute!',
      url: `${APP_URL}?page=library`,
    }).catch(() => {}),
    supabaseAdmin.from('notifications').insert({
      user_id: user.id,
      type: 'activation_library',
      title: 'Share your first item 📚',
      body: 'Your neighbors are ready to borrow. Add something to the community library!',
      data: { cta_page: 'library' },
    }),
  ])
}

async function sendBarterNudge(user: { id: string; email: string; full_name: string | null }) {
  const firstName = esc(user.full_name?.split(' ')[0] || 'neighbor')

  await Promise.all([
    resend.emails.send({
      from: FROM,
      to: user.email,
      subject: '🤝 Got something to trade? Post your first barter offer!',
      html: emailTemplate({
        heading: 'Trade skills and goods with your neighbors 🤝',
        body: `Hi ${firstName},<br><br>
Did you know CommuniTrade has a barter board? You can trade skills, services, or goods with neighbors — no money involved.<br><br>
Got guitar lessons to offer? Looking for help with your garden? Post what you have and what you want, and we'll automatically match you with a neighbor who's a fit.<br><br>
It only takes a minute to post your first trade!`,
        ctaText: 'Post My First Trade →',
        ctaUrl: `${APP_URL}?page=barter`,
      }),
    }),
    sendPushToUser(user.id, {
      title: 'Post your first trade 🤝',
      body: 'Trade skills or goods with neighbors. Post what you have, get what you need!',
      url: `${APP_URL}?page=barter`,
    }).catch(() => {}),
    supabaseAdmin.from('notifications').insert({
      user_id: user.id,
      type: 'activation_barter',
      title: 'Post your first trade 🤝',
      body: 'Trade skills or goods with neighbors — no money needed. Post your first barter offer!',
      data: { cta_page: 'barter' },
    }),
  ])
}
