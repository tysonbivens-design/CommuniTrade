-- ============================================
-- CommuniTrade Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- PROFILES (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  zip_code text not null,
  radius_miles integer default 5,
  trust_score numeric(3,2) default 5.00,
  review_count integer default 0,
  is_admin boolean default false,
  avatar_color text default '#C4622D',
  created_at timestamptz default now()
);

-- ITEMS
create table public.items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  author_creator text,
  category text not null, -- Book, DVD, VHS, CD, Game, Tool, Home Good, Other
  subcategory text,
  offer_type text not null default 'lend', -- lend, swap, barter, free
  status text not null default 'available', -- available, loaned, unavailable
  condition text default 'good', -- excellent, good, fair
  notes text,
  cover_image_url text,
  metadata jsonb default '{}', -- year, genre, publisher, etc
  flagged boolean default false,
  flag_reason text,
  flag_count integer default 0,
  created_at timestamptz default now()
);

-- LOAN REQUESTS
create table public.loan_requests (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references public.items(id) on delete cascade not null,
  requester_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending', -- pending, approved, declined
  duration_days integer not null default 14,
  message text,
  created_at timestamptz default now()
);

-- ACTIVE LOANS
create table public.loans (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references public.items(id) on delete cascade not null,
  lender_id uuid references public.profiles(id) not null,
  borrower_id uuid references public.profiles(id) not null,
  request_id uuid references public.loan_requests(id),
  status text not null default 'active', -- active, overdue, returned, disputed
  duration_days integer not null,
  loaned_at timestamptz default now(),
  due_at timestamptz not null,
  returned_at timestamptz,
  borrower_confirmed_return boolean default false,
  lender_confirmed_return boolean default false,
  reminder_sent boolean default false
);

-- BARTER POSTS
create table public.barter_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  have_description text not null,
  have_category text not null,
  want_description text not null,
  want_category text not null,
  notes text,
  status text default 'active', -- active, matched, closed
  created_at timestamptz default now()
);

-- BARTER MATCHES
create table public.barter_matches (
  id uuid default gen_random_uuid() primary key,
  post_a_id uuid references public.barter_posts(id) on delete cascade not null,
  post_b_id uuid references public.barter_posts(id) on delete cascade not null,
  user_a_id uuid references public.profiles(id) not null,
  user_b_id uuid references public.profiles(id) not null,
  status text default 'pending', -- pending, connected, completed, declined
  created_at timestamptz default now(),
  unique(post_a_id, post_b_id)
);

-- REVIEWS
create table public.reviews (
  id uuid default gen_random_uuid() primary key,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  reviewee_id uuid references public.profiles(id) on delete cascade not null,
  loan_id uuid references public.loans(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique(reviewer_id, loan_id)
);

-- NOTIFICATIONS
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null, -- loan_request, loan_approved, loan_due, loan_overdue, barter_match, review, flag
  title text not null,
  body text not null,
  read boolean default false,
  data jsonb default '{}',
  created_at timestamptz default now()
);

-- ITEM FLAGS
create table public.item_flags (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references public.items(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  reason text not null, -- unavailable, incorrect_info, damaged, other
  notes text,
  resolved boolean default false,
  created_at timestamptz default now(),
  unique(item_id, user_id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.loan_requests enable row level security;
alter table public.loans enable row level security;
alter table public.barter_posts enable row level security;
alter table public.barter_matches enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.item_flags enable row level security;

-- Profiles: users can read all, edit own
create policy "profiles_read_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Items: anyone can read, owner can insert/update/delete
create policy "items_read_all" on public.items for select using (true);
create policy "items_insert_own" on public.items for insert with check (auth.uid() = user_id);
create policy "items_update_own" on public.items for update using (auth.uid() = user_id);
create policy "items_delete_own" on public.items for delete using (auth.uid() = user_id);

-- Loan requests
create policy "loan_requests_read" on public.loan_requests for select using (
  auth.uid() = requester_id or
  auth.uid() = (select user_id from public.items where id = item_id)
);
create policy "loan_requests_insert" on public.loan_requests for insert with check (auth.uid() = requester_id);
create policy "loan_requests_update" on public.loan_requests for update using (
  auth.uid() = requester_id or
  auth.uid() = (select user_id from public.items where id = item_id)
);

-- Loans: visible to lender and borrower
create policy "loans_read" on public.loans for select using (
  auth.uid() = lender_id or auth.uid() = borrower_id
);
create policy "loans_insert" on public.loans for insert with check (auth.uid() = lender_id);
create policy "loans_update" on public.loans for update using (
  auth.uid() = lender_id or auth.uid() = borrower_id
);

-- Barter posts: anyone can read, owner can write
create policy "barter_read_all" on public.barter_posts for select using (true);
create policy "barter_insert_own" on public.barter_posts for insert with check (auth.uid() = user_id);
create policy "barter_update_own" on public.barter_posts for update using (auth.uid() = user_id);

-- Barter matches
create policy "barter_matches_read" on public.barter_matches for select using (
  auth.uid() = user_a_id or auth.uid() = user_b_id
);
create policy "barter_matches_insert" on public.barter_matches for insert with check (true);

-- Reviews
create policy "reviews_read_all" on public.reviews for select using (true);
create policy "reviews_insert_own" on public.reviews for insert with check (auth.uid() = reviewer_id);

-- Notifications: own only
create policy "notifications_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id);
create policy "notifications_insert" on public.notifications for insert with check (true);

-- Flags
create policy "flags_read_all" on public.item_flags for select using (true);
create policy "flags_insert_auth" on public.item_flags for insert with check (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, zip_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Community Member'),
    coalesce(new.raw_user_meta_data->>'zip_code', '00000')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update trust score when review added
create or replace function public.update_trust_score()
returns trigger as $$
begin
  update public.profiles
  set
    trust_score = (
      select round(avg(rating)::numeric, 2)
      from public.reviews
      where reviewee_id = new.reviewee_id
    ),
    review_count = (
      select count(*) from public.reviews where reviewee_id = new.reviewee_id
    )
  where id = new.reviewee_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_review_created
  after insert on public.reviews
  for each row execute procedure public.update_trust_score();

-- Auto-flag item when flag count reaches 3
create or replace function public.check_flag_count()
returns trigger as $$
begin
  update public.items
  set
    flag_count = (select count(*) from public.item_flags where item_id = new.item_id),
    flagged = (select count(*) from public.item_flags where item_id = new.item_id) >= 3
  where id = new.item_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_item_flagged
  after insert on public.item_flags
  for each row execute procedure public.check_flag_count();

-- ============================================
-- STORAGE BUCKET for item images
-- ============================================
insert into storage.buckets (id, name, public) values ('item-images', 'item-images', true);

create policy "item_images_public_read" on storage.objects
  for select using (bucket_id = 'item-images');

create policy "item_images_auth_upload" on storage.objects
  for insert with check (bucket_id = 'item-images' and auth.role() = 'authenticated');

create policy "item_images_own_delete" on storage.objects
  for delete using (bucket_id = 'item-images' and auth.uid()::text = (storage.foldername(name))[1]);
