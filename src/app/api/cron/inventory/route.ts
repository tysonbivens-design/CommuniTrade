import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, resend, emailTemplate, esc, FROM, APP_URL } from '@/lib/email'
import { sendPushToUser } from '@/lib/webpush'

// ─── Vercel Cron — runs 1st of every month at 10am UTC ───────────────────────
// Registered in vercel.json
// Sends each user a monthly inventory recap email + push nudge
// Only fires for users with at least 1 active (non-archived) item

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let sent = 0
  let skipped = 0

  try {
    // Fetch all users who have at least one active item
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .not('email', 'is', null)

    if (!profiles?.length) return NextResponse.json({ sent, skipped })

    for (const user of profiles) {
      if (!user.email) { skipped++; continue }

      // Fetch their active items
      const { data: items } = await supabaseAdmin
        .from('items')
        .select('id, title, category, offer_type, status')
        .eq('user_id', user.id)
        .eq('archived', false)
        .order('created_at', { ascending: false })

      if (!items?.length) { skipped++; continue }

      const firstName = esc(user.full_name?.split(' ')[0] || 'neighbor')
      const totalItems = items.length
      const availableCount = items.filter(i => i.status === 'available').length
      const onLoanCount = items.filter(i => i.status === 'loaned').length

      // Build item rows for email
      const CATEGORY_EMOJI: Record<string, string> = {
        Book: '📚', DVD: '🎬', VHS: '📼', CD: '🎵',
        Game: '🎲', Tool: '🔧', 'Home Good': '🏠', Other: '📦',
      }
      const OFFER_LABEL: Record<string, string> = {
        lend: 'Lend', swap: 'Swap', barter: 'Barter', free: 'Free',
      }

      const itemRows = items.map(item => {
        const emoji = CATEGORY_EMOJI[item.category] || '📦'
        const statusBadge = item.status === 'loaned'
          ? '<span style="color:#C4622D;font-weight:600;">On Loan</span>'
          : '<span style="color:#5A7A5C;font-weight:600;">Available</span>'
        const deepLink = `${APP_URL}?page=profile`
        return `
          <tr>
            <td style="padding:0.6rem 0;border-bottom:1px solid #f0ebe3;">
              ${emoji} <strong>${esc(item.title)}</strong>
              &nbsp;·&nbsp;${OFFER_LABEL[item.offer_type] || item.offer_type}
              &nbsp;·&nbsp;${statusBadge}
              &nbsp;<a href="${deepLink}" style="color:#C4622D;font-size:0.82rem;text-decoration:none;">Edit →</a>
            </td>
          </tr>`
      }).join('')

      const emailBody = `
        Hi ${firstName},<br><br>
        Here is your monthly CommuniTrade inventory recap. 
        Take a moment to make sure everything is still accurate — 
        your neighbors are counting on it!<br><br>
        <strong>Your inventory: ${totalItems} item${totalItems !== 1 ? 's' : ''}</strong>
        &nbsp;·&nbsp;${availableCount} available
        ${onLoanCount > 0 ? `&nbsp;·&nbsp;${onLoanCount} on loan` : ''}<br><br>
        <table style="width:100%;border-collapse:collapse;">
          ${itemRows}
        </table>
        <br>
        If any item is no longer available, sold, or lost — please archive it from your inventory 
        so your neighbors aren't misled. It only takes a second!
      `

      await Promise.all([
        resend.emails.send({
          from: FROM,
          to: user.email,
          subject: `📦 Your CommuniTrade inventory — ${totalItems} item${totalItems !== 1 ? 's' : ''} listed`,
          html: emailTemplate({
            heading: 'Your Monthly Inventory Recap',
            body: emailBody,
            ctaText: 'View My Inventory',
            ctaUrl: `${APP_URL}?page=profile`,
          }),
        }),
        sendPushToUser(user.id, {
          title: 'Monthly inventory check 📦',
          body: `You have ${totalItems} item${totalItems !== 1 ? 's' : ''} listed. Take a moment to make sure everything is still accurate!`,
          url: `${APP_URL}?page=profile`,
        }).catch(() => {}),
      ])

      sent++

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 150))
    }

    return NextResponse.json({ sent, skipped })
  } catch (err: unknown) {
    console.error('Inventory cron error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
