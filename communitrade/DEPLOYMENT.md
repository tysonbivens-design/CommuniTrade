# CommuniTrade — Deployment Guide
## Get live in ~45 minutes. No coding required.

---

## STEP 1: Set Up Your Database (Supabase)

1. Go to https://supabase.com and open your **communitrade** project
2. In the left sidebar, click **SQL Editor**
3. Click **New Query**
4. Open the file `supabase_schema.sql` from this project folder
5. Copy ALL of the contents and paste into the SQL editor
6. Click **Run** (the green button)
7. You should see "Success. No rows returned" — that means it worked!

---

## STEP 2: Get Your Anthropic API Key (for AI catalog upload)

1. Go to https://console.anthropic.com
2. Sign up or log in
3. Go to **API Keys** and create a new key
4. Copy it — you'll need it in Step 4

---

## STEP 3: Push Code to GitHub

1. Go to your GitHub repo (github.com/YOUR-USERNAME/communitrade)
2. Click **uploading an existing file** or drag the entire project folder
   - OR if you're comfortable with terminal: `git add . && git commit -m "Initial commit" && git push`
3. Make sure all the files are uploaded

**Easiest method (no terminal):**
- Download the project as a ZIP
- On GitHub, go to your repo → click **Add file** → **Upload files**
- Drag the entire unzipped folder contents in

---

## STEP 4: Deploy on Vercel

1. Go to https://vercel.com and sign in with your GitHub account
2. Click **Add New Project**
3. Find and select your **communitrade** repository
4. Under **Environment Variables**, add these one by one:

```
NEXT_PUBLIC_SUPABASE_URL = https://hzwiiuhpdakntntxxihs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
RESEND_API_KEY = re_a3XdWfxH_EsFoscJfQxKYG3PFu9d9tM32
ANTHROPIC_API_KEY = [your key from Step 2]
NEXT_PUBLIC_APP_URL = https://[your-project-name].vercel.app
```

5. Click **Deploy**
6. Wait ~2 minutes for the build
7. Vercel gives you a live URL like `communitrade.vercel.app` — that's your site!

---

## STEP 5: Set Up Email Domain (Resend)

For emails to send properly from `notifications@communitrade.app`:
1. Go to Resend → **Domains** → Add your domain
2. OR for testing, go to Resend → **Settings** and use their default `onboarding@resend.dev` sender
3. Update the `FROM` constant in `src/app/api/notify/route.ts` to match

For now, emails will still work in test mode to your own verified email address.

---

## STEP 6: Make Yourself Admin

1. Sign up on your live site as the first user
2. Go back to Supabase → **Table Editor** → **profiles**
3. Find your row and set `is_admin` to `true`
4. Now you'll see the **Admin** tab in the nav with flagged items dashboard

---

## STEP 7: Enable Realtime (for live notifications)

1. In Supabase → **Database** → **Replication**
2. Under **Supabase Realtime**, enable the **notifications** table
3. Now notification badges update live without refreshing!

---

## BACKUPS (Do this now!)

1. In Supabase → **Project Settings** → **Database**
2. Scroll to **Backups** — enable **Point in Time Recovery** (free tier: daily backups)
3. Optionally, set a weekly reminder to export: **Database** → **Backups** → **Download**
4. Store downloaded backups on your Google Drive or hard drive

---

## Your Live Site Checklist

- [ ] Database schema created in Supabase
- [ ] Code pushed to GitHub
- [ ] Deployed on Vercel with environment variables
- [ ] Signed up as first user
- [ ] Set yourself as admin in Supabase
- [ ] Realtime enabled for notifications table
- [ ] Backups configured

---

## What's Working in This Version

✅ User accounts (sign up, sign in, profiles)
✅ Browse & search the community library
✅ Add items manually with Open Library metadata auto-fetch
✅ AI photo catalog upload (Claude scans your shelf)
✅ Borrow request system with approve/decline
✅ Loan tracking with overdue detection
✅ Return confirmation (both parties confirm)
✅ Review & trust score system
✅ Barter board with automatic matching
✅ In-app notifications with real-time updates
✅ Email notifications (loan requests, approvals, barter matches)
✅ Community flagging system (3 flags = auto-flagged for admin review)
✅ Admin dashboard for flagged items

## Coming Next (Phase 3 — PWA)

- Add to home screen (installable app icon)
- Push notifications (no email needed)
- Offline mode
- Mobile-optimized layout
- Location/zip-code filtering
