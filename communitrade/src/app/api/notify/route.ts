import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const FROM = 'CommuniTrade <notifications@communitrade.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type } = body

    if (type === 'loan_request') {
      const { item, duration, lenderId } = body
      const { data: lender } = await supabase.from('profiles').select('email, full_name').eq('id', lenderId).single()
      if (!lender?.email) return NextResponse.json({ ok: true })

      await resend.emails.send({
        from: FROM,
        to: lender.email,
        subject: `Someone wants to borrow your "${item.title}"`,
        html: emailTemplate({
          heading: `New Borrow Request 📬`,
          body: `Hi ${lender.full_name?.split(' ')[0] || 'neighbor'},<br><br>
A community member would like to borrow your <strong>${item.title}</strong> for ${duration} days.<br><br>
Log in to approve or decline their request.`,
          ctaText: 'View Request',
          ctaUrl: `${APP_URL}?page=loans`
        })
      })
    }

    if (type === 'loan_approved') {
      const { item, borrowerEmail, borrowerName, lenderName, dueDate } = body
      await resend.emails.send({
        from: FROM,
        to: borrowerEmail,
        subject: `Your borrow request was approved! ✅`,
        html: emailTemplate({
          heading: 'Request Approved!',
          body: `Hi ${borrowerName?.split(' ')[0] || 'neighbor'},<br><br>
<strong>${lenderName}</strong> has approved your request to borrow <strong>${item.title}</strong>.<br><br>
Please arrange a pickup with them directly. The item is due back by <strong>${dueDate}</strong>.`,
          ctaText: 'View My Loans',
          ctaUrl: `${APP_URL}?page=loans`
        })
      })
    }

    if (type === 'loan_due_soon') {
      const { item, borrowerEmail, borrowerName, dueDate } = body
      await resend.emails.send({
        from: FROM,
        to: borrowerEmail,
        subject: `Reminder: "${item.title}" is due back soon`,
        html: emailTemplate({
          heading: '⏰ Return Reminder',
          body: `Hi ${borrowerName?.split(' ')[0] || 'neighbor'},<br><br>
Just a friendly reminder that <strong>${item.title}</strong> is due back in <strong>2 days</strong> (by ${dueDate}).<br><br>
Please arrange return with the owner.`,
          ctaText: 'View My Loans',
          ctaUrl: `${APP_URL}?page=loans`
        })
      })
    }

    if (type === 'barter_match') {
      const { userEmail, userName, theirName, haveDesc, wantDesc } = body
      await resend.emails.send({
        from: FROM,
        to: userEmail,
        subject: `🤝 Barter match found!`,
        html: emailTemplate({
          heading: 'You have a barter match!',
          body: `Hi ${userName?.split(' ')[0] || 'neighbor'},<br><br>
Great news! <strong>${theirName}</strong> has what you're looking for, and wants what you're offering.<br><br>
You offer: <em>${haveDesc}</em><br>
They offer: <em>${wantDesc}</em><br><br>
Head to the Barter Board to connect!`,
          ctaText: 'View Match',
          ctaUrl: `${APP_URL}?page=barter`
        })
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Notify error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function emailTemplate({ heading, body, ctaText, ctaUrl }: any) {
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
