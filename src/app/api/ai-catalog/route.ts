import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { image, mediaType } = await req.json()

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
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
  } catch (err: any) {
    console.error('AI catalog error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
