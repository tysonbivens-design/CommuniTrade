// src/app/api/igdb/route.ts
// Called by client components (AddItemModal, EditItemModal) to fetch game cover + metadata.
// Keeps IGDB credentials server-side only.

import { NextRequest, NextResponse } from 'next/server'
import { fetchGameCover } from '@/lib/igdb'

export async function POST(req: NextRequest) {
  try {
    const { title } = await req.json()
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title required' }, { status: 400 })
    }

    const result = await fetchGameCover(title.trim())
    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('IGDB error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'IGDB lookup failed' },
      { status: 500 }
    )
  }
}
