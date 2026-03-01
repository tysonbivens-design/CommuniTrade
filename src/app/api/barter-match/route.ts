import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function isMatch(postA: any, postB: any): boolean {
  if (postA.user_id === postB.user_id) return false
  const aWant = postA.want_description.toLowerCase()
  const aHave = postA.have_description.toLowerCase()
  const bWant = postB.want_description.toLowerCase()
  const bHave = postB.have_description.toLowerCase()

  const catMatch = (
    postA.want_category === postB.have_category ||
    postA.have_category === postB.want_category
  )

  const aWantWords = aWant.split(/\s+/).filter((w: string) => w.length > 3)
  const bHaveWords = bHave.split(/\s+/).filter((w: string) => w.length > 3)
  const bWantWords = bWant.split(/\s+/).filter((w: string) => w.length > 3)
  const aHaveWords = aHave.split(/\s+/).filter((w: string) => w.length > 3)

  const aWantsMatch = aWantWords.some((w: string) => bHaveWords.includes(w))
  const bWantsMatch = bWantWords.some((w: string) => aHaveWords.includes(w))

  return catMatch || (aWantsMatch && bWantsMatch)
}

export async function POST(req: NextRequest) {
  try {
    const { postId } = await req.json()

    const { data: newPost } = await supabase
      .from('barter_posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (!newPost) return NextResponse.json({ matches: 0 })

    const { data: existing } = await supabase
      .from('barter_posts')
      .select('*')
      .eq('status', 'active')
      .neq('id', postId)
      .neq('user_id', newPost.user_id)

    const matches = (existing || []).filter(p => isMatch(newPost, p))
    let matchCount = 0

    for (const match of matches) {
      // Check if match already exists
      const { data: existingMatch } = await supabase
        .from('barter_matches')
        .select('id')
        .or(`and(post_a_id.eq.${postId},post_b_id.eq.${match.id}),and(post_a_id.eq.${match.id},post_b_id.eq.${postId})`)
        .single()

      if (existingMatch) continue

      await supabase.from('barter_matches').insert({
        post_a_id: postId, post_b_id: match.id,
        user_a_id: newPost.user_id, user_b_id: match.user_id,
        status: 'pending',
      })

      // In-app notifications for both users
      await supabase.from('notifications').insert([
        {
          user_id: newPost.user_id,
          type: 'barter_match',
          title: 'Barter Match Found! 🤝',
          body: `Someone has what you want and wants what you have! Check your matches.`,
          data: { match_user_id: match.user_id, post_id: match.id },
        },
        {
          user_id: match.user_id,
          type: 'barter_match',
          title: 'Barter Match Found! 🤝',
          body: `Someone has what you want and wants what you have! Check your matches.`,
          data: { match_user_id: newPost.user_id, post_id: postId },
        },
      ])

      // Email both users with each other's contact info (fire-and-forget)
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'barter_match',
          userAId: newPost.user_id,
          userBId: match.user_id,
          haveDescA: newPost.have_description,
          wantDescA: newPost.want_description,
        }),
      }).catch(() => {})

      matchCount++
    }

    return NextResponse.json({ matches: matchCount })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
