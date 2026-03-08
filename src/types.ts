// ─── CommuniTrade Shared Types ────────────────────────────────────────────────
// Define once, use everywhere. No more `any` for core data shapes.

export type Page = 'home' | 'library' | 'barter' | 'loans' | 'notifications' | 'profile' | 'admin'

export type ItemCategory = 'Book' | 'DVD' | 'VHS' | 'CD' | 'Game' | 'Tool' | 'Home Good' | 'Other'
export type ItemStatus = 'available' | 'loaned' | 'unavailable'
export type OfferType = 'lend' | 'swap' | 'barter' | 'free'
export type Condition = 'excellent' | 'good' | 'fair'

export type LoanStatus = 'active' | 'overdue' | 'returned'
export type RequestStatus = 'pending' | 'approved' | 'declined'
export type BarterStatus = 'active' | 'closed'
export type MatchStatus = 'pending' | 'accepted' | 'declined'

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  zip_code: string | null
  avatar_color: string | null
  avatar_url: string | null
  trust_score: number
  review_count: number
  is_admin: boolean
  suspended: boolean
  lat: number | null
  lng: number | null
  radius_miles: number | null
  created_at: string
}

export interface Item {
  id: string
  user_id: string
  title: string
  author_creator: string | null
  category: ItemCategory
  offer_type: OfferType
  condition: Condition
  status: ItemStatus
  notes: string | null
  cover_image_url: string | null
  metadata: { year?: number; genre?: string; publisher?: string } | null
  flagged: boolean
  flag_count: number
  archived: boolean
  created_at: string
  // joined
  profiles?: Pick<Profile, 'full_name' | 'trust_score' | 'avatar_color' | 'avatar_url' | 'lat' | 'lng'>
}

export interface LoanRequest {
  id: string
  item_id: string
  requester_id: string
  duration_days: number
  message: string | null
  status: RequestStatus
  created_at: string
  // joined
  items?: Pick<Item, 'id' | 'title' | 'category' | 'user_id'>
  profiles?: Pick<Profile, 'full_name' | 'email' | 'trust_score' | 'avatar_color' | 'avatar_url'>
}

export interface Loan {
  id: string
  item_id: string
  lender_id: string
  borrower_id: string
  request_id: string | null
  duration_days: number
  due_at: string
  status: LoanStatus
  returned_at: string | null
  lender_confirmed_return: boolean
  borrower_confirmed_return: boolean
  created_at: string
  // joined
  items?: Pick<Item, 'id' | 'title' | 'category'>
  lender?: Pick<Profile, 'full_name' | 'avatar_color' | 'avatar_url'>
  borrower?: Pick<Profile, 'full_name' | 'avatar_color' | 'avatar_url'>
}

export interface BarterPost {
  id: string
  user_id: string
  have_description: string
  have_category: string
  want_description: string
  want_category: string
  notes: string | null
  status: BarterStatus
  created_at: string
  // joined
  profiles?: Pick<Profile, 'full_name' | 'trust_score' | 'avatar_color' | 'avatar_url' | 'lat' | 'lng'>
}

export interface BarterMatch {
  id: string
  post_a_id: string
  post_b_id: string
  user_a_id: string
  user_b_id: string
  status: MatchStatus
  created_at: string
  // joined
  post_a?: BarterPost & { profiles?: Pick<Profile, 'full_name' | 'avatar_color' | 'avatar_url'> }
  post_b?: BarterPost & { profiles?: Pick<Profile, 'full_name' | 'avatar_color' | 'avatar_url'> }
}

export interface Notification {
  id: string
  user_id: string
  type: 'loan_request' | 'loan_approved' | 'loan_due' | 'loan_overdue' | 'barter_match' | 'review' | 'flag'
  title: string
  body: string
  read: boolean
  data: Record<string, unknown> | null
  created_at: string
}

export interface ItemFlag {
  id: string
  item_id: string
  user_id: string
  reason: 'unavailable' | 'incorrect_info' | 'damaged' | 'other'
  notes: string | null
  resolved: boolean
  created_at: string
}

export interface UserFlag {
  id: string
  reported_user_id: string
  reporter_id: string
  reason: 'scam' | 'harassment' | 'no_return' | 'fake_listing' | 'other'
  notes: string | null
  resolved: boolean
  created_at: string
  // joined
  reported_user?: Pick<Profile, 'full_name' | 'email' | 'avatar_color' | 'trust_score' | 'suspended'>
}

// ─── App Context ───────────────────────────────────────────────────────────────
// The ctx object passed from page.tsx to every page component

export interface AppCtx {
  user: { id: string; email?: string } | null
  profile: Profile | null
  showToast: (msg: string, type?: 'success' | 'error') => void
  requireAuth: (action: () => void) => void
  navigate: (page: Page, modal?: 'add' | 'ai') => void
}
