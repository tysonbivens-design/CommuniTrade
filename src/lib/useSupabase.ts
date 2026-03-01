import { createBrowserClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

// Single import point for the Supabase singleton.
// Use this in every component instead of calling createBrowserClient() directly.
export function useSupabase(): SupabaseClient {
  return createBrowserClient()
}
