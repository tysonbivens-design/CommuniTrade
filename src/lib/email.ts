import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const FROM = 'CommuniTrade <notifications@communitrade.app>'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/** Escape user-supplied strings before interpolating into email HTML */
export function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function getProfile(userId: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single()
  return data
}

export function emailTemplate({ heading, body, ctaText, ctaUrl }: {
  heading: string
  body: string
  ctaText: string
  ctaUrl: string
}) {
  // heading, ctaText, ctaUrl are always our own strings — safe to interpolate directly.
  // body is assembled by callers who are responsible for escaping user values with esc().
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
