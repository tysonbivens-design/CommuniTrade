import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

// Use service role key so we can look up any user's email server-side
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ⚠️ IMPORTANT: This must be a domain you've verified in Resend.
// If you haven't verified communitrade.app, change this to:
// 'CommuniTrade <onboarding@resend.dev>'
// That works immediately for testing but only sends to your own email.
// To send to ALL users you must verify your domain at resend.com/domains
const FROM = 'CommuniTrade <notifications@communitrade.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function getProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single()
  return data
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type } = body

    // ─── Borrower Marked Returned ────────────────────────────────────
    if (type === 'borrower_returned') {
      const { itemTitle, lenderId, borrowerId } = body

      const [lender, borrower] = await Promise.all([
        getProfile(lenderId),
        getProfile(borrowerId),
      ])
      if (!lender?.email) return NextResponse.json({ ok: true })

      await resend.emails.send({
        from: FROM,
        to: lender.email,
        subject: `"${itemTitle}" has been marked as returned`,
        html: emailTemplate({
          heading: 'Item Returned 📦',
          body: `Hi ${lender.full_name?.split(' ')[0] || 'neighbor'},<br><br>
<strong>${borrower?.full_name || 'The borrower'}</strong> has marked <strong>${itemTitle}</strong> as returned.<br><br>
Please log in and confirm the return when you have the item back in hand.`,
          ctaText: 'Confirm Return',
          ctaUrl: `${APP_URL}?page=loans`,
        })
      })
    }

    // ─── Loan Request ────────────────────────────────────────────────
    if (type === 'loan_request') {
      const { item, duration, lenderId, requesterId } = body

      const [lender, requester] = await Promise.all([
        getProfile(lenderId),
        getProfile(requesterId),
      ])
      if (!lender?.email) return NextResponse.json({ ok: true })

      await resend.emails.send({
        from: FROM,
        to: lender.email,
        subject: `Someone wants to borrow your "${item.title}"`,
        html: emailTemplate({
          heading: 'New Borrow Request 📬',
          body: `Hi ${lender.full_name?.split(' ')[0] || 'neighbor'},<br><br>
<strong>${requester?.full_name || 'A community member'}</strong> would like to borrow your <strong>${item.title}</strong> for ${duration} days.<br><br>
Log in to approve or decline their request.`,
          ctaText: 'View Request',
          ctaUrl: `${APP_URL}?page=loans`,
        })
      })
    }

    // ─── Loan Approved ───────────────────────────────────────────────
    if (type === 'loan_approved') {
      const { item, borrowerId, lenderId, dueDate } = body

      const [borrower, lender] = await Promise.all([
        getProfile(borrowerId),
        getProfile(lenderId),
      ])
      if (!borrower?.email) return NextResponse.json({ ok: true })

      await resend.emails.send({
        from: FROM,
        to: borrower.email,
        subject: `Your borrow request was approved! ✅`,
        html: emailTemplate({
          heading: 'Request Approved!',
          body: `Hi ${borrower.full_name?.split(' ')[0] || 'neighbor'},<br><br>
<strong>${lender?.full_name || 'Your neighbor'}</strong> has approved your request to borrow <strong>${item.title}</strong>.<br><br>
Please reach out to arrange pickup — you can reply to this email or contact them directly:<br>
<strong>${lender?.full_name}</strong> · <a href="mailto:${lender?.email}">${lender?.email}</a><br><br>
The item is due back by <strong>${dueDate}</strong>.`,
          ctaText: 'View My Loans',
          ctaUrl: `${APP_URL}?page=loans`,
        })
      })

      // Also notify the lender with the borrower's contact info
      if (lender?.email) {
        await resend.emails.send({
          from: FROM,
          to: lender.email,
          subject: `You approved a borrow request for "${item.title}"`,
          html: emailTemplate({
            heading: 'Borrow Request Approved ✅',
            body: `Hi ${lender.full_name?.split(' ')[0] || 'neighbor'},<br><br>
You approved <strong>${borrower.full_name || 'a neighbor'}</strong>'s request to borrow <strong>${item.title}</strong>.<br><br>
They're expecting to hear from you to arrange pickup:<br>
<strong>${borrower.full_name}</strong> · <a href="mailto:${borrower.email}">${borrower.email}</a><br><br>
Due back by <strong>${dueDate}</strong>.`,
            ctaText: 'View My Loans',
            ctaUrl: `${APP_URL}?page=loans`,
          })
        })
      }
    }

    // ─── Loan Due Soon ───────────────────────────────────────────────
    if (type === 'loan_due_soon') {
      const { item, borrowerId, dueDate } = body
      const borrower = await getProfile(borrowerId)
      if (!borrower?.email) return NextResponse.json({ ok: true })

      await resend.emails.send({
        from: FROM,
        to: borrower.email,
        subject: `Reminder: "${item.title}" is due back soon`,
        html: emailTemplate({
          heading: '⏰ Return Reminder',
          body: `Hi ${borrower.full_name?.split(' ')[0] || 'neighbor'},<br><br>
Just a friendly reminder that <strong>${item.title}</strong> is due back in <strong>2 days</strong> (by ${dueDate}).<br><br>
Please arrange the return with the owner.`,
          ctaText: 'View My Loans',
          ctaUrl: `${APP_URL}?page=loans`,
        })
      })
    }

    // ─── Barter Match ────────────────────────────────────────────────
    if (type === 'barter_match') {
      const { userAId, userBId, haveDescA, wantDescA } = body

      const [userA, userB] = await Promise.all([
        getProfile(userAId),
        getProfile(userBId),
      ])
      if (!userA?.email || !userB?.email) return NextResponse.json({ ok: true })

      // Email user A
      await resend.emails.send({
        from: FROM,
        to: userA.email,
        subject: `🤝 Barter match with ${userB.full_name}!`,
        html: emailTemplate({
          heading: 'You have a barter match!',
          body: `Hi ${userA.full_name?.split(' ')[0] || 'neighbor'},<br><br>
Great news! <strong>${userB.full_name}</strong> has what you're looking for, and wants what you're offering.<br><br>
Reach out to connect:<br>
<strong>${userB.full_name}</strong> · <a href="mailto:${userB.email}">${userB.email}</a>`,
          ctaText: 'View Match',
          ctaUrl: `${APP_URL}?page=barter`,
        })
      })

      // Email user B
      await resend.emails.send({
        from: FROM,
        to: userB.email,
        subject: `🤝 Barter match with ${userA.full_name}!`,
        html: emailTemplate({
          heading: 'You have a barter match!',
          body: `Hi ${userB.full_name?.split(' ')[0] || 'neighbor'},<br><br>
Great news! <strong>${userA.full_name}</strong> has what you're looking for, and wants what you're offering.<br><br>
Reach out to connect:<br>
<strong>${userA.full_name}</strong> · <a href="mailto:${userA.email}">${userA.email}</a>`,
          ctaText: 'View Match',
          ctaUrl: `${APP_URL}?page=barter`,
        })
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('Notify error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

function emailTemplate({ heading, body, ctaText, ctaUrl }: {
  heading: string
  body: string
  ctaText: string
  ctaUrl: string
}) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#F5F0E8;font-family:'Helvetica Neue',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:#3D2B1F;padding:28px 40px;">
    <span style="font-size:1.5rem;font-weight:800;color:#D4A843;">Communi</span><span style="font-size:1.5rem;font-weight:800;color:#E07848;">Trade</span>
  </td></tr>
  <tr><td style="padding:36px 40px;">
    <h1 style="font-size:1.5rem;color:#3D2B1F;margin:0 0 20px;">${heading}</h1>
    <p style="color:#5C4033;line-height:1.7;font-size:0.95rem;">${body}</p>
    <a href="${ctaUrl}" style="display:inline-block;margin-top:24px;background:#C4622D;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:500;">${ctaText} →</a>
  </td></tr>
  <tr><td style="padding:20px 40px;border-top:1px solid #DDD5C8;">
    <p style="color:#8A7B72;font-size:0.8rem;margin:0;">This is an automated message from CommuniTrade. Your neighborhood's shared shelf.</p>
  </td></tr>
</table></td></tr></table></body></html>`
}
