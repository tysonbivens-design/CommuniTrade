import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { matchId, userId, feedback } = await req.json()

    if (!matchId || !userId || !['good', 'bad'].includes(feedback)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Upsert -- user can change their feedback
    const { error } = await supabase
      .from('match_feedback')
      .upsert(
        { match_id: matchId, user_id: userId, feedback },
        { onConflict: 'match_id,user_id' }
      )

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('Match feedback error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
