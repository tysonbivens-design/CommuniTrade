import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend, emailTemplate, FROM, APP_URL } from '@/lib/email'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function isMatch(postA: any, postB: any): boolean {
  if (postA.user_id === postB.user_id) return false

  const catMatch =
    postA.want_category === postB.have_category ||
    postA.have_category === postB.want_category

  const aWantWords = postA.want_description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
  const bHaveWords = postB.have_description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
  const bWantWords = postB.want_description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
  const aHaveWords = postA.have_description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)

  const keywordMatch =
    aWantWords.some((w: string) => bHaveWords.includes(w)) &&
    bWantWords.some((w: string) => aHaveWords.includes(w))

  return catMatch || keywordMatch
}

export async function POST(req: NextRequest) {
  try {
    const { postId } = await req.json()
    console.log('[barter-match] postId:', postId)

    const { data: newPost, error: postError } = await supabase
      .from('barter_posts')
      .select('*, profiles(email, full_name)')
      .eq('id', postId)
      .single()

    console.log('[barter-match] newPost:', JSON.stringify(newPost), 'error:', postError)

    if (!newPost) return NextResponse.json({ matches: 0 })

    const { data: existing } = await supabase
      .from('barter_posts')
      .select('*, profiles(email, full_name)')
      .eq('status', 'active')
      .neq('id', postId)
      .neq('user_id', newPost.user_id)

    console.log('[barter-match] existing posts count:', existing?.length)

    const matches = (existing || []).filter(p => isMatch(newPost, p))
    console.log('[barter-match] matches found:', matches.length)

    let matchCount = 0

    for (const match of matches) {
      const { data: existingMatch } = await supabase
        .from('barter_matches')
        .select('id')
        .or(`and(post_a_id.eq.${postId},post_b_id.eq.${match.id}),and(post_a_id.eq.${match.id},post_b_id.eq.${postId})`)
        .single()

      if (existingMatch) {
        console.log('[barter-match] match already exists, skipping')
        continue
      }

      await supabase.from('barter_matches').insert({
        post_a_id: postId, post_b_id: match.id,
        user_a_id: newPost.user_id, user_b_id: match.user_id,
        status: 'pending',
      })

      await supabase.from('notifications').insert([
        {
          user_id: newPost.user_id,
          type: 'barter_match',
          title: 'Barter Match Found! 🤝',
          body: 'Someone has what you want and wants what you have! Check your matches.',
          data: { match_user_id: match.user_id, post_id: match.id },
        },
        {
          user_id: match.user_id,
          type: 'barter_match',
          title: 'Barter Match Found! 🤝',
          body: 'Someone has what you want and wants what you have! Check your matches.',
          data: { match_user_id: newPost.user_id, post_id: postId },
        },
      ])

      const userA = newPost.profiles as { email: string; full_name: string } | null
      const userB = match.profiles as { email: string; full_name: string } | null

      console.log('[barter-match] userA:', userA?.email, 'userB:', userB?.email)

      if (userA?.email && userB?.email) {
        console.log('[barter-match] sending emails...')
        const [resultA, resultB] = await Promise.all([
          resend.emails.send({
            from: FROM, to: userA.email,
            subject: `🤝 Barter match with ${userB.full_name}!`,
            html: emailTemplate({
              heading: 'You have a barter match!',
              body: `Hi ${userA.full_name?.split(' ')[0] || 'neighbor'},<br><br>
Great news! <strong>${userB.full_name}</strong> has what you are looking for, and wants what you are offering.<br><br>
You offer: <em>${newPost.have_description}</em><br>
They offer: <em>${match.have_description}</em><br><br>
Reach out to connect:<br>
<strong>${userB.full_name}</strong> · <a href="mailto:${userB.email}">${userB.email}</a>`,
              ctaText: 'View My Matches',
              ctaUrl: `${APP_URL}?page=barter`,
            }),
          }),
          resend.emails.send({
            from: FROM, to: userB.email,
            subject: `🤝 Barter match with ${userA.full_name}!`,
            html: emailTemplate({
              heading: 'You have a barter match!',
              body: `Hi ${userB.full_name?.split(' ')[0] || 'neighbor'},<br><br>
Great news! <strong>${userA.full_name}</strong> has what you are looking for, and wants what you are offering.<br><br>
You offer: <em>${match.have_description}</em><br>
They offer: <em>${newPost.have_description}</em><br><br>
Reach out to connect:<br>
<strong>${userA.full_name}</strong> · <a href="mailto:${userA.email}">${userA.email}</a>`,
              ctaText: 'View My Matches',
              ctaUrl: `${APP_URL}?page=barter`,
            }),
          }),
        ])
        console.log('[barter-match] email results:', JSON.stringify(resultA), JSON.stringify(resultB))
      } else {
        console.log('[barter-match] skipping email — missing profile data')
      }

      matchCount++
    }

    return NextResponse.json({ matches: matchCount })
  } catch (err: unknown) {
    console.error('[barter-match] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
