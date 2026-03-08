import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getIp } from '@/lib/ratelimit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)


// Allow up to 10MB request body (phone photos can be large)
export const maxDuration = 30
export const dynamic = 'force-dynamic'

const DAILY_LIMIT = 5
// Secondary IP limit: 10 attempts/hour regardless of account
// Catches unauthenticated probing and multi-account abuse
const IP_LIMIT = 10
const IP_WINDOW = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  // IP rate limit first — cheap check before any DB work
  const ip = getIp(req)
  if (!rateLimit(ip, IP_LIMIT, IP_WINDOW)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const { image, mediaType, userId } = await req.json()

    // Per-user daily limit (DB-backed, survives cold starts)
    if (userId) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('ai_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature', 'catalog')
        .gte('created_at', since)

      if ((count ?? 0) >= DAILY_LIMIT) {
        return NextResponse.json(
          { error: `Daily limit of ${DAILY_LIMIT} AI catalog uploads reached. Try again tomorrow.` },
          { status: 429 }
        )
      }

      await supabase.from('ai_usage').insert({ user_id: userId, feature: 'catalog' })
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: image }
          },
          {
            type: 'text',
            text: `You are scanning a photo of someone's personal media collection (books, DVDs, VHS tapes, CDs, board games, etc.).

Extract every readable item from this image. For each item, provide:
- title (the item name/title)
- author_creator (author for books, director for films, artist for music - omit if unclear)
- category (one of: Book, DVD, VHS, CD, Game, Other)
- condition (excellent, good, or fair — estimate from what you can see)

Respond ONLY with a valid JSON array. No preamble, no markdown, no explanation. Example:
[{"title":"The Shining","author_creator":"Stephen King","category":"Book","condition":"good"},{"title":"Pulp Fiction","author_creator":"Quentin Tarantino","category":"DVD","condition":"good"}]

If you cannot identify any items clearly, return an empty array: []`
          }
        ]
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const clean = text.replace(/```json|```/g, '').trim()
    const items = JSON.parse(clean)

    return NextResponse.json({ items })
  } catch (err: unknown) {
    console.error('AI catalog error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
