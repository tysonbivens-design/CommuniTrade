import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── Singleton pattern ─────────────────────────────────────────────────────────
// Only one client instance is ever created. Every call to createBrowserClient()
// returns the same object. This prevents infinite re-render loops caused by
// components treating a "new" client as a changed dependency.
let client: SupabaseClient | null = null

export function createBrowserClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON)
  }
  return client
}
