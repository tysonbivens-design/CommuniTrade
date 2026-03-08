import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, resend, emailTemplate, FROM, APP_URL } from '@/lib/email'
import { sendPushToUser } from '@/lib/webpush'

// ─── Vercel Cron — runs daily at 8am UTC ──────────────────────────────────────
// Registered in vercel.json: { "crons": [{ "path": "/api/cron/overdue", "schedule": "0 8 * * *" }] }
// Secured with CRON_SECRET env var — Vercel sets this automatically.

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel's cron system
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)

  let reminders = 0
  let markedOverdue = 0

  try {
    // ── 1. Send due-soon reminders (due within next 48hrs, not yet reminded) ──
    const { data: dueSoon } = await supabaseAdmin
      .from('loans')
      .select('*, items(title), borrower:profiles!loans_borrower_id_fkey(email, full_name)')
      .eq('status', 'active')
      .eq('reminder_sent', false)
      .lte('due_at', in2Days.toISOString())
      .gte('due_at', now.toISOString())

    for (const loan of dueSoon || []) {
      const borrower = loan.borrower as { email: string; full_name: string } | null
      const itemTitle = (loan.items as { title: string } | null)?.title || 'your borrowed item'
      const dueDate = new Date(loan.due_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

      await Promise.all([
        borrower?.email ? resend.emails.send({
          from: FROM,
          to: borrower.email,
          subject: `⏰ "${itemTitle}" is due back in 2 days`,
          html: emailTemplate({
            heading: '⏰ Return Reminder',
            body: `Hi ${borrower.full_name?.split(' ')[0] || 'neighbor'},<br><br>
Just a friendly heads-up — <strong>${itemTitle}</strong> is due back on <strong>${dueDate}</strong>.<br><br>
Please arrange the return with the owner so they can confirm it.`,
            ctaText: 'View My Loans',
            ctaUrl: `${APP_URL}?page=loans`,
          }),
        }) : Promise.resolve(),
        sendPushToUser(loan.borrower_id, {
          title: '⏰ Return Reminder',
          body: `"${itemTitle}" is due back on ${dueDate}. Please arrange the return.`,
          url: `${APP_URL}?page=loans`,
        }).catch(() => {}),
      ])

      // In-app notification
      await supabaseAdmin.from('notifications').insert({
        user_id: loan.borrower_id,
        type: 'loan_due',
        title: 'Item Due Soon ⏰',
        body: `"${itemTitle}" is due back on ${dueDate}. Please arrange the return.`,
      })

      // Mark reminder sent so we don't double-send
      await supabaseAdmin.from('loans').update({ reminder_sent: true }).eq('id', loan.id)
      reminders++
    }

    // ── 2. Mark overdue loans + notify lender ──────────────────────────────
    const { data: nowOverdue } = await supabaseAdmin
      .from('loans')
      .select('*, items(id, title), lender:profiles!loans_lender_id_fkey(email, full_name), borrower:profiles!loans_borrower_id_fkey(full_name)')
      .eq('status', 'active')
      .lt('due_at', now.toISOString())

    for (const loan of nowOverdue || []) {
      const lender = loan.lender as { email: string; full_name: string } | null
      const borrowerName = (loan.borrower as { full_name: string } | null)?.full_name || 'The borrower'
      const itemTitle = (loan.items as { title: string } | null)?.title || 'your item'
      const dueDate = new Date(loan.due_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

      // Update loan status
      await supabaseAdmin.from('loans').update({ status: 'overdue' }).eq('id', loan.id)

      // Notify borrower
      await supabaseAdmin.from('notifications').insert({
        user_id: loan.borrower_id,
        type: 'loan_overdue',
        title: 'Item Overdue 🚨',
        body: `"${itemTitle}" was due back on ${dueDate}. Please return it as soon as possible.`,
      })

      // Notify lender
      await supabaseAdmin.from('notifications').insert({
        user_id: loan.lender_id,
        type: 'loan_overdue',
        title: 'Item Overdue 🚨',
        body: `${borrowerName} hasn't returned "${itemTitle}" yet. It was due on ${dueDate}.`,
      })

      await Promise.all([
        lender?.email ? resend.emails.send({
          from: FROM,
          to: lender.email,
          subject: `🚨 "${itemTitle}" is overdue`,
          html: emailTemplate({
            heading: '🚨 Overdue Item',
            body: `Hi ${lender.full_name?.split(' ')[0] || 'neighbor'},<br><br>
<strong>${borrowerName}</strong> hasn't returned <strong>${itemTitle}</strong> yet. It was due back on <strong>${dueDate}</strong>.<br><br>
You can send them a reminder from the Loans page.`,
            ctaText: 'View My Loans',
            ctaUrl: `${APP_URL}?page=loans`,
          }),
        }) : Promise.resolve(),
        sendPushToUser(loan.lender_id, {
          title: 'Item Overdue 🚨',
          body: `${borrowerName} hasn't returned "${itemTitle}" yet. It was due on ${dueDate}.`,
          url: `${APP_URL}?page=loans`,
        }).catch(() => {}),
        sendPushToUser(loan.borrower_id, {
          title: 'Item Overdue 🚨',
          body: `"${itemTitle}" was due back on ${dueDate}. Please return it as soon as possible.`,
          url: `${APP_URL}?page=loans`,
        }).catch(() => {}),
      ])

      markedOverdue++
    }

    return NextResponse.json({ reminders, markedOverdue })
  } catch (err: unknown) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
