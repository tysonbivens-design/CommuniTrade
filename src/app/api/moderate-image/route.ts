import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { base64, mediaType } = await req.json()

    if (!base64 || !mediaType) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: 'Does this image contain inappropriate, offensive, sexual, violent, or adult content? Reply with only YES or NO.',
          },
        ],
      }],
    })

    const answer = response.content[0].type === 'text'
      ? response.content[0].text.trim().toUpperCase()
      : 'NO'

    const flagged = answer.startsWith('YES')
    return NextResponse.json({ flagged })
  } catch (err: unknown) {
    console.error('Moderation error:', err)
    // Fail open -- if moderation errors, let the upload through
    // Community flagging acts as the backstop
    return NextResponse.json({ flagged: false })
  }
}
