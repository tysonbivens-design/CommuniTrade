import { NextRequest, NextResponse } from 'next/server'
import { resend, getProfile, emailTemplate, FROM, APP_URL } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type } = body

    // ─── Borrower Marked Returned ────────────────────────────────────
    if (type === 'borrower_returned') {
      const { itemTitle, lenderId, borrowerId } = body
      const [lender, borrower] = await Promise.all([getProfile(lenderId), getProfile(borrowerId)])
      if (!lender?.email) return NextResponse.json({ ok: true })

      await resend.emails.send({
        from: FROM, to: lender.email,
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
      const [lender, requester] = await Promise.all([getProfile(lenderId), getProfile(requesterId)])
      if (!lender?.email) return NextResponse.json({ ok: true })

      await resend.emails.send({
        from: FROM, to: lender.email,
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
      const [borrower, lender] = await Promise.all([getProfile(borrowerId), getProfile(lenderId)])
      if (!borrower?.email) return NextResponse.json({ ok: true })

      await resend.emails.send({
        from: FROM, to: borrower.email,
        subject: `Your borrow request was approved! ✅`,
        html: emailTemplate({
          heading: 'Request Approved!',
          body: `Hi ${borrower.full_name?.split(' ')[0] || 'neighbor'},<br><br>
<strong>${lender?.full_name || 'Your neighbor'}</strong> approved your request to borrow <strong>${item.title}</strong>.<br><br>
Reach out to arrange pickup:<br>
<strong>${lender?.full_name}</strong> · <a href="mailto:${lender?.email}">${lender?.email}</a><br><br>
The item is due back by <strong>${dueDate}</strong>.`,
          ctaText: 'View My Loans',
          ctaUrl: `${APP_URL}?page=loans`,
        })
      })

      if (lender?.email) {
        await resend.emails.send({
          from: FROM, to: lender.email,
          subject: `You approved a borrow request for "${item.title}"`,
          html: emailTemplate({
            heading: 'Borrow Request Approved ✅',
            body: `Hi ${lender.full_name?.split(' ')[0] || 'neighbor'},<br><br>
You approved <strong>${borrower.full_name || 'a neighbor'}</strong>'s request to borrow <strong>${item.title}</strong>.<br><br>
They will be in touch to arrange pickup:<br>
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
      const { itemTitle, borrowerId, dueDate } = body
      const borrower = await getProfile(borrowerId)
      if (!borrower?.email) return NextResponse.json({ ok: true })

      await resend.emails.send({
        from: FROM, to: borrower.email,
        subject: `Reminder: "${itemTitle}" is due back soon`,
        html: emailTemplate({
          heading: '⏰ Return Reminder',
          body: `Hi ${borrower.full_name?.split(' ')[0] || 'neighbor'},<br><br>
Just a friendly reminder that <strong>${itemTitle}</strong> is due back soon (by ${dueDate}).<br><br>
Please arrange the return with the owner.`,
          ctaText: 'View My Loans',
          ctaUrl: `${APP_URL}?page=loans`,
        })
      })
    }

    // ─── Barter Message ──────────────────────────────────────────────
    if (type === 'barter_message') {
      const { postOwnerId, senderId, haveDescription, wantDescription } = body
      const [postOwner, sender] = await Promise.all([getProfile(postOwnerId), getProfile(senderId)])
      if (!postOwner?.email || !sender) return NextResponse.json({ ok: true })

      await resend.emails.send({
        from: FROM, to: postOwner.email,
        subject: `${sender.full_name} is interested in your barter post`,
        html: emailTemplate({
          heading: 'Someone wants to trade! 🤝',
          body: `Hi ${postOwner.full_name?.split(' ')[0] || 'neighbor'},<br><br>
<strong>${sender.full_name}</strong> is interested in your post:<br>
<em>You offer: ${haveDescription}</em><br>
<em>You want: ${wantDescription}</em><br><br>
Reach out to connect:<br>
<strong>${sender.full_name}</strong> · <a href="mailto:${sender.email}">${sender.email}</a>`,
          ctaText: 'View Barter Board',
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
