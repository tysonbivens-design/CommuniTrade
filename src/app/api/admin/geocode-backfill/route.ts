import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// One-time backfill endpoint — geocodes all profiles that have a zip but no lat/lng
// Protected by CRON_SECRET. Hit once, then safe to leave in place (it's idempotent).

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, zip_code')
    .not('zip_code', 'is', null)
    .is('lat', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!profiles?.length) return NextResponse.json({ updated: 0, message: 'Nothing to backfill' })

  let updated = 0
  let failed = 0

  for (const profile of profiles) {
    if (!profile.zip_code) continue
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${profile.zip_code.trim()}`)
      if (!res.ok) { failed++; continue }
      const data = await res.json()
      const place = data.places?.[0]
      if (!place) { failed++; continue }

      const lat = parseFloat(place.latitude)
      const lng = parseFloat(place.longitude)

      await supabaseAdmin
        .from('profiles')
        .update({ lat, lng })
        .eq('id', profile.id)

      updated++
    } catch {
      failed++
    }

    // Small delay to be polite to the zippopotam API
    await new Promise(r => setTimeout(r, 100))
  }

  return NextResponse.json({ updated, failed, total: profiles.length })
}
