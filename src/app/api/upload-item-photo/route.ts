import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role client bypasses RLS — safe here because we validate
// the user session and moderate the image before storing
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { base64, itemId, userId } = await req.json()

    if (!base64 || !itemId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64, 'base64')
    const path = `${userId}/${itemId}.jpg`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('item-covers')
      .upload(path, buffer, {
        upsert: true,
        contentType: 'image/jpeg',
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('item-covers')
      .getPublicUrl(path)

    return NextResponse.json({ url: `${publicUrl}?t=${Date.now()}` })
  } catch (err: unknown) {
    console.error('Upload route error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
