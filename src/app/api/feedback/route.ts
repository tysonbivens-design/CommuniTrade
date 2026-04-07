import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend, emailTemplate, esc, FROM, APP_URL } from '@/lib/email'
import { rateLimit, getIp } from '@/lib/ratelimit'
import { sendPushToUser } from '@/lib/webpush'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const FEEDBACK_LIMIT = 5
const FEEDBACK_WINDOW = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  if (!rateLimit(ip, FEEDBACK_LIMIT, FEEDBACK_WINDOW)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { userId, message } = await req.json()

    if (!userId || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const { error: insertError } = await supabaseAdmin
      .from('feedback')
      .insert({ user_id: userId, message: message.trim() })

    if (insertError) {
      console.error('Feedback insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save feedback.' }, { status: 500 })
    }

    const { data: submitter } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single()

    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .eq('is_admin', true)

    if (admins && admins.length > 0) {
      for (const admin of admins) {
        supabaseAdmin.from('notifications').insert({
          user_id: admin.id,
          type: 'flag' as const,
          title: 'New feedback submitted',
          body: `${esc(submitter?.full_name) || 'A user'}: "${esc(message.trim().slice(0, 80))}${message.trim().length > 80 ? '...' : ''}"`,
          data: { page: 'admin' },
        }).then(() => {}).catch(() => {})

        sendPushToUser(admin.id, {
          title: 'New feedback',
          body: `${submitter?.full_name || 'A user'} left feedback.`,
          url: `${APP_URL}?page=admin`,
        }).catch(() => {})

        if (admin.email) {
          resend.emails.send({
            from: FROM,
            to: admin.email,
            subject: `New feedback from ${esc(submitter?.full_name) || 'a user'}`,
            html: emailTemplate({
              heading: 'New Feedback',
              body: `Hi ${esc(admin.full_name?.split(' ')[0])},<br><br>
<strong>${esc(submitter?.full_name) || 'A community member'}</strong>${submitter?.email ? ` (${esc(submitter.email)})` : ''} submitted feedback:<br><br>
<blockquote style="border-left:3px solid #C4622D;margin:0;padding:0.5rem 1rem;color:#5C4033;font-style:italic;">${esc(message.trim())}</blockquote>`,
              ctaText: 'Review in Admin',
              ctaUrl: `${APP_URL}?page=admin`,
            }),
          }).catch(() => {})
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('Feedback route error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
