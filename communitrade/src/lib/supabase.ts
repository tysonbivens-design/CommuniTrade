import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// For use in Client Components
export const createBrowserClient = () => createClientComponentClient()

// For use in Server Components
export const createServerClient = () =>
  createServerComponentClient({ cookies })

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          zip_code: string
          radius_miles: number
          trust_score: number
          review_count: number
          created_at: string
          is_admin: boolean
        }
      }
      items: {
        Row: {
          id: string
          user_id: string
          title: string
          author_creator: string | null
          category: string
          subcategory: string | null
          offer_type: string
          status: string
          condition: string
          notes: string | null
          cover_image_url: string | null
          metadata: any
          created_at: string
          flagged: boolean
          flag_reason: string | null
        }
      }
      loans: {
        Row: {
          id: string
          item_id: string
          lender_id: string
          borrower_id: string
          status: string
          duration_days: number
          loaned_at: string
          due_at: string
          returned_at: string | null
          borrower_confirmed: boolean
          lender_confirmed: boolean
        }
      }
      barter_posts: {
        Row: {
          id: string
          user_id: string
          have_description: string
          have_category: string
          want_description: string
          want_category: string
          notes: string | null
          status: string
          created_at: string
        }
      }
      barter_matches: {
        Row: {
          id: string
          post_a_id: string
          post_b_id: string
          status: string
          created_at: string
        }
      }
      reviews: {
        Row: {
          id: string
          reviewer_id: string
          reviewee_id: string
          loan_id: string | null
          rating: number
          comment: string | null
          created_at: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string
          read: boolean
          data: any
          created_at: string
        }
      }
    }
  }
}
