import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin, resend, emailTemplate, esc, FROM, APP_URL } from '@/lib/email'
import { rateLimit } from '@/lib/ratelimit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Rate limit ───────────────────────────────────────────────────────────────
// 5 barter posts per user per hour (matches the UI duplicate-post check)
const BARTER_LIMIT = 5
const BARTER_WINDOW = 60 * 60 * 1000

// ─── Semantic match via Claude Haiku ─────────────────────────────────────────

async function semanticMatches(
  newPost: any,
  candidates: any[]
): Promise<string[]> {
  if (candidates.length === 0) return []

  const pairs = candidates.map((c, i) => ({
    index: i,
    id: c.id,
    theyHave: c.have_description,
    theyWant: c.want_description,
    theirHaveCat: c.have_category,
    theirWantCat: c.want_category,
  }))

  const prompt = `You are a barter matching engine for a neighborhood sharing app.

New post:
- OFFERS: "${newPost.have_description}" (category: ${newPost.have_category})
- WANTS: "${newPost.want_description}" (category: ${newPost.want_category})

Evaluate each candidate below. A match means BOTH conditions are true:
1. The new poster would likely want what the candidate offers (even if worded differently)
2. The candidate would likely want what the new poster offers (even if worded differently)

Be generous with semantic similarity. "Guitar lessons" matches "music teaching". "Homemade jam" matches "preserves". "Dog walking" matches "pet care". Category match alone is not enough — the descriptions must actually be compatible.

Candidates:
${pairs.map(p => `[${p.index}] They offer: "${p.theyHave}" (${p.theirHaveCat}) | They want: "${p.theyWant}" (${p.theirWantCat})`).join('\n')}

Reply with ONLY a JSON array of the index numbers that are genuine matches. Example: [0, 2]
If no matches, reply: []`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    const indices: number[] = JSON.parse(text.replace(/```json|```/g, '').trim())
    return indices.map(i => candidates[i]?.id).filter(Boolean)
  } catch {
    // Fall back to keyword matching if Claude call fails
    return candidates.filter(c => keywordMatch(newPost, c)).map(c => c.id)
  }
}

// ─── Keyword fallback ─────────────────────────────────────────────────────────

function keywordMatch(postA: any, postB: any): boolean {
  const catMatch =
    postA.want_category === postB.have_category ||
    postA.have_category === postB.want_category

  const aWantWords = postA.want_description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
  const bHaveWords = postB.have_description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
  const bWantWords = postB.want_description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
  const aHaveWords = postA.have_description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)

  return catMatch || (
    aWantWords.some((w: string) => bHaveWords.includes(w)) &&
    bWantWords.some((w: string) => aHaveWords.includes(w))
  )
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { postId, userId } = await req.json()

    // Per-user rate limit on post creation
    if (userId) {
      if (!rateLimit(`barter:${userId}`, BARTER_LIMIT, BARTER_WINDOW)) {
        return NextResponse.json(
          { error: 'You\'ve posted too many trades this hour. Please wait before posting again.' },
          { status: 429 }
        )
      }
    }

    const { data: newPost } = await supabaseAdmin
      .from('barter_posts')
      .select('*, profiles(email, full_name)')
      .eq('id', postId)
      .single()

    if (!newPost) return NextResponse.json({ matches: 0 })

    const { data: existing } = await supabaseAdmin
      .from('barter_posts')
      .select('*, profiles(email, full_name)')
      .eq('status', 'active')
      .neq('id', postId)
      .neq('user_id', newPost.user_id)

    if (!existing?.length) return NextResponse.json({ matches: 0 })

    const { data: alreadyMatched } = await supabaseAdmin
      .from('barter_matches')
      .select('post_a_id, post_b_id')
      .or(`post_a_id.eq.${postId},post_b_id.eq.${postId}`)

    const matchedIds = new Set(
      (alreadyMatched || []).flatMap(m => [m.post_a_id, m.post_b_id])
    )
    matchedIds.delete(postId)

    const candidates = existing.filter(p => !matchedIds.has(p.id))
    if (!candidates.length) return NextResponse.json({ matches: 0 })

    const matchedPostIds = await semanticMatches(newPost, candidates)
    const matchedPosts = candidates.filter(c => matchedPostIds.includes(c.id))

    let matchCount = 0

    for (const match of matchedPosts) {
      await supabaseAdmin.from('barter_matches').insert({
        post_a_id: postId,
        post_b_id: match.id,
        user_a_id: newPost.user_id,
        user_b_id: match.user_id,
        status: 'pending',
      })

      await supabaseAdmin.from('notifications').insert([
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

      if (userA?.email && userB?.email) {
        await Promise.all([
          resend.emails.send({
            from: FROM, to: userA.email,
            subject: `🤝 Barter match with ${esc(userB.full_name)}!`,
            html: emailTemplate({
              heading: 'You have a barter match!',
              body: `Hi ${esc(userA.full_name?.split(' ')[0])},<br><br>
Great news! <strong>${esc(userB.full_name)}</strong> has what you are looking for, and wants what you are offering.<br><br>
You offer: <em>${esc(newPost.have_description)}</em><br>
They offer: <em>${esc(match.have_description)}</em><br><br>
Reach out to connect:<br>
<strong>${esc(userB.full_name)}</strong> · <a href="mailto:${esc(userB.email)}">${esc(userB.email)}</a>`,
              ctaText: 'View My Matches',
              ctaUrl: `${APP_URL}?page=barter`,
            }),
          }),
          resend.emails.send({
            from: FROM, to: userB.email,
            subject: `🤝 Barter match with ${esc(userA.full_name)}!`,
            html: emailTemplate({
              heading: 'You have a barter match!',
              body: `Hi ${esc(userB.full_name?.split(' ')[0])},<br><br>
Great news! <strong>${esc(userA.full_name)}</strong> has what you are looking for, and wants what you are offering.<br><br>
You offer: <em>${esc(match.have_description)}</em><br>
They offer: <em>${esc(newPost.have_description)}</em><br><br>
Reach out to connect:<br>
<strong>${esc(userA.full_name)}</strong> · <a href="mailto:${esc(userA.email)}">${esc(userA.email)}</a>`,
              ctaText: 'View My Matches',
              ctaUrl: `${APP_URL}?page=barter`,
            }),
          }),
        ])
      }

      matchCount++
    }

    return NextResponse.json({ matches: matchCount })
  } catch (err: unknown) {
    console.error('Barter match error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
