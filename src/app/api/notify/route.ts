import { NextRequest, NextResponse } from 'next/server'
import { resend, getProfile, emailTemplate, esc, FROM, APP_URL } from '@/lib/email'
import { rateLimit, getIp } from '@/lib/ratelimit'
import { sendPushToUser } from '@/lib/webpush'

// ─── Rate limits ──────────────────────────────────────────────────────────────
// 20 notify calls per IP per hour — generous for legit use, blocks spam triggers
const NOTIFY_LIMIT = 20
const NOTIFY_WINDOW = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = getIp(req)
  if (!rateLimit(ip, NOTIFY_LIMIT, NOTIFY_WINDOW)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { type } = body

    // ─── Borrower Marked Returned ────────────────────────────────────
    if (type === 'borrower_returned') {
      const { itemTitle, lenderId, borrowerId } = body
      const [lender, borrower] = await Promise.all([getProfile(lenderId), getProfile(borrowerId)])
      if (!lender?.email) return NextResponse.json({ ok: true })

      await Promise.all([
        resend.emails.send({
          from: FROM, to: lender.email,
          subject: `"${esc(itemTitle)}" has been marked as returned`,
          html: emailTemplate({
            heading: 'Item Returned 📦',
            body: `Hi ${esc(lender.full_name?.split(' ')[0])},<br><br>
<strong>${esc(borrower?.full_name)}</strong> has marked <strong>${esc(itemTitle)}</strong> as returned.<br><br>
Please log in and confirm the return when you have the item back in hand.`,
            ctaText: 'Confirm Return',
            ctaUrl: `${APP_URL}?page=loans`,
          })
        }),
        sendPushToUser(lenderId, {
          title: 'Item Returned 📦',
          body: `${borrower?.full_name || 'The borrower'} marked "${itemTitle}" as returned. Tap to confirm.`,
          url: `${APP_URL}?page=loans`,
        }).catch(() => {}),
      ])
    }

    // ─── Loan Request ────────────────────────────────────────────────
    if (type === 'loan_request') {
      const { item, duration, lenderId, requesterId } = body
      const [lender, requester] = await Promise.all([getProfile(lenderId), getProfile(requesterId)])
      if (!lender?.email) return NextResponse.json({ ok: true })

      await Promise.all([
        resend.emails.send({
          from: FROM, to: lender.email,
          subject: `Someone wants to borrow your "${esc(item.title)}"`,
          html: emailTemplate({
            heading: 'New Borrow Request 📬',
            body: `Hi ${esc(lender.full_name?.split(' ')[0])},<br><br>
<strong>${esc(requester?.full_name)}</strong> would like to borrow your <strong>${esc(item.title)}</strong> for ${Number(duration)} days.<br><br>
Log in to approve or decline their request.`,
            ctaText: 'View Request',
            ctaUrl: `${APP_URL}?page=loans`,
          })
        }),
        sendPushToUser(lenderId, {
          title: 'New Borrow Request 📬',
          body: `${requester?.full_name || 'Someone'} wants to borrow your "${item.title}" for ${Number(duration)} days.`,
          url: `${APP_URL}?page=loans`,
        }).catch(() => {}),
      ])
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
          body: `Hi ${esc(borrower.full_name?.split(' ')[0])},<br><br>
<strong>${esc(lender?.full_name)}</strong> approved your request to borrow <strong>${esc(item.title)}</strong>.<br><br>
Reach out to arrange pickup:<br>
<strong>${esc(lender?.full_name)}</strong> · <a href="mailto:${esc(lender?.email)}">${esc(lender?.email)}</a><br><br>
The item is due back by <strong>${esc(dueDate)}</strong>.`,
          ctaText: 'View My Loans',
          ctaUrl: `${APP_URL}?page=loans`,
        })
      })

      sendPushToUser(borrowerId, {
        title: 'Request Approved! ✅',
        body: `${lender?.full_name || 'Your neighbor'} approved your request to borrow "${item.title}".`,
        url: `${APP_URL}?page=loans`,
      }).catch(() => {})

      if (lender?.email) {
        await resend.emails.send({
          from: FROM, to: lender.email,
          subject: `You approved a borrow request for "${esc(item.title)}"`,
          html: emailTemplate({
            heading: 'Borrow Request Approved ✅',
            body: `Hi ${esc(lender.full_name?.split(' ')[0])},<br><br>
You approved <strong>${esc(borrower.full_name)}</strong>'s request to borrow <strong>${esc(item.title)}</strong>.<br><br>
They will be in touch to arrange pickup:<br>
<strong>${esc(borrower.full_name)}</strong> · <a href="mailto:${esc(borrower.email)}">${esc(borrower.email)}</a><br><br>
Due back by <strong>${esc(dueDate)}</strong>.`,
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

      await Promise.all([
        resend.emails.send({
          from: FROM, to: borrower.email,
          subject: `Reminder: "${esc(itemTitle)}" is due back soon`,
          html: emailTemplate({
            heading: '⏰ Return Reminder',
            body: `Hi ${esc(borrower.full_name?.split(' ')[0])},<br><br>
Just a friendly reminder that <strong>${esc(itemTitle)}</strong> is due back soon (by ${esc(dueDate)}).<br><br>
Please arrange the return with the owner.`,
            ctaText: 'View My Loans',
            ctaUrl: `${APP_URL}?page=loans`,
          })
        }),
        sendPushToUser(borrowerId, {
          title: '⏰ Return Reminder',
          body: `"${itemTitle}" is due back on ${dueDate}. Please arrange the return.`,
          url: `${APP_URL}?page=loans`,
        }).catch(() => {}),
      ])
    }

    // ─── Barter Message ──────────────────────────────────────────────
    if (type === 'barter_message') {
      const { postOwnerId, senderId, haveDescription, wantDescription, contactInfo } = body
      const [postOwner, sender] = await Promise.all([getProfile(postOwnerId), getProfile(senderId)])
      if (!postOwner?.email || !sender) return NextResponse.json({ ok: true })

      const extraContact = contactInfo
        ? `<br>Additional contact: <strong>${esc(contactInfo)}</strong>`
        : ''

      await Promise.all([
        resend.emails.send({
          from: FROM, to: postOwner.email,
          subject: `${esc(sender.full_name)} is interested in your barter post`,
          html: emailTemplate({
            heading: 'Someone wants to trade! 🤝',
            body: `Hi ${esc(postOwner.full_name?.split(' ')[0])},<br><br>
<strong>${esc(sender.full_name)}</strong> is interested in your post:<br>
<em>You offer: ${esc(haveDescription)}</em><br>
<em>You want: ${esc(wantDescription)}</em><br><br>
Reach out to connect:<br>
<strong>${esc(sender.full_name)}</strong> · <a href="mailto:${esc(sender.email)}">${esc(sender.email)}</a>${extraContact}`,
            ctaText: 'View Barter Board',
            ctaUrl: `${APP_URL}?page=barter`,
          })
        }),
        sendPushToUser(postOwnerId, {
          title: 'Someone wants to trade! 🤝',
          body: `${sender.full_name || 'A neighbor'} is interested in your barter post.`,
          url: `${APP_URL}?page=barter`,
        }).catch(() => {}),
      ])
    }


    // ─── Admin: Item Auto-Flagged ────────────────────────────────────
    if (type === 'admin_item_flagged') {
      const { itemTitle, itemId, adminIds } = body
      if (!Array.isArray(adminIds) || adminIds.length === 0) return NextResponse.json({ ok: true })

      for (const adminId of adminIds) {
        const admin = await getProfile(adminId)
        if (!admin?.email) continue
        await Promise.all([
          resend.emails.send({
            from: FROM, to: admin.email,
            subject: `🚩 Item flagged: "${esc(itemTitle)}"`,
            html: emailTemplate({
              heading: 'Item Needs Review 🚩',
              body: `Hi ${esc(admin.full_name?.split(' ')[0])},<br><br>
The listing <strong>${esc(itemTitle)}</strong> has been flagged by 3 community members and is now hidden from the library.<br><br>
Please review it in the Admin dashboard.`,
              ctaText: 'Review in Admin',
              ctaUrl: `${APP_URL}?page=admin`,
            })
          }),
          sendPushToUser(adminId, {
            title: 'Item Flagged 🚩',
            body: `"${itemTitle}" was flagged by 3 users and needs review.`,
            url: `${APP_URL}?page=admin`,
          }).catch(() => {}),
        ])
      }
    }

    // ─── Admin: User Auto-Suspended ──────────────────────────────────
    if (type === 'admin_user_suspended') {
      const { reportedName, reportedUserId, adminIds } = body
      if (!Array.isArray(adminIds) || adminIds.length === 0) return NextResponse.json({ ok: true })

      for (const adminId of adminIds) {
        const admin = await getProfile(adminId)
        if (!admin?.email) continue
        await Promise.all([
          resend.emails.send({
            from: FROM, to: admin.email,
            subject: `🚨 User suspended: ${esc(reportedName)}`,
            html: emailTemplate({
              heading: 'User Auto-Suspended 🚨',
              body: `Hi ${esc(admin.full_name?.split(' ')[0])},<br><br>
<strong>${esc(reportedName)}</strong> has been automatically suspended after receiving 3 reports from community members.<br><br>
Please review their account in the Admin dashboard. You can unsuspend them if the reports appear unfounded.`,
              ctaText: 'Review in Admin',
              ctaUrl: `${APP_URL}?page=admin`,
            })
          }),
          sendPushToUser(adminId, {
            title: 'User Suspended 🚨',
            body: `${reportedName} was auto-suspended after 3 reports. Tap to review.`,
            url: `${APP_URL}?page=admin`,
          }).catch(() => {}),
        ])
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('Notify error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
