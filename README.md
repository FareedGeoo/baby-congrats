# Baby Memory Book

A bilingual family guestbook for welcoming a new baby and saving messages and
photos from friends and family. Built with React, Vite, Supabase, and Tailwind
CSS; designed for deployment on Vercel.

## Features

- Three scrapbook themes: boy, girl, and royal.
- English and Arabic interface with saved language choice and right-to-left
  Arabic layout.
- Public memory wall with pinned and approved messages, recipient filters,
  photo lightbox, and guestbook submission.
- Admin tools for moderation, site settings, photo gallery, and memory exports
  (print, CSV, and ZIP).
- Browser-side photo compression, accessible forms and dialogs, and responsive
  layouts.

## Requirements

- Node.js 20.19+ or 22.12+.
- A Supabase project.
- A Vercel account for deployment.

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in
   PowerShell), then set the Supabase project URL and anon/public key:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```

   These are placeholders only. Use your own project values locally and in
   Vercel. Never put a Supabase `service_role` key in this frontend.

3. Start the development server:

   ```sh
   npm run dev
   ```

   Open the URL printed by Vite (normally `http://localhost:5173`).

4. Verify a production build:

   ```sh
   npm run build
   npm run preview
   ```

## Supabase setup

1. Create a Supabase project and set the environment variables above.
2. In the Supabase SQL Editor, run the files in `supabase/migrations/` in
   numerical order: `001`, `002`, `003`, then `004`. Do not run
   `supabase/schema.sql` as a migration; it is a reference snapshot of the
   final schema.
   - `001_memory_book_data_and_admins.sql`: message fields, admins,
     authorization helper, and site settings.
   - `002_access_policies_storage_realtime.sql`: access policies, photo
     storage rules, and Realtime publication setup.
   - `003_admin_featured_photo_prefix.sql`: restricts the reserved `baby/`
     photo prefix to admins.
   - `004_storage_upload_policy_cleanup.sql`: limits public uploads to allowed
     image extensions and removes legacy storage policies.
3. Create the first admin user in **Authentication → Users**. Use a strong
   password and confirm the account if email confirmation is enabled.
4. Add that user's UUID to `public.admins` in the SQL Editor, replacing the
   example email:

   ```sql
   INSERT INTO public.admins (user_id)
   SELECT id
   FROM auth.users
   WHERE lower(email) = lower('admin@example.com')
   ON CONFLICT (user_id) DO NOTHING;
   ```

   If this inserts no row, verify that the Auth user exists and that the email
   is correct, then run it again. Admin pages are available at `/admin`.
5. In **Authentication → URL Configuration**, set the local Site URL to
   `http://localhost:5173` while developing, and add the local URL to the
   Redirect URLs allow-list. For deployment, update the Site URL and allow-list
   as described below.

## Vercel deployment

1. Push the project to a Git provider and import it into Vercel.
2. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel
   project's environment-variable settings for each environment you use.
3. Use `npm run build` as the build command and `dist` as the output directory.
   The existing `vercel.json` catch-all rewrite serves the SPA for direct
   visits and refreshes at `/admin` and `/admin/print`.
4. After assigning your production domain, open Supabase **Authentication →
   URL Configuration**:
   - Set **Site URL** to the canonical production origin, for example
     `https://your-domain.example`.
   - Add `http://localhost:5173/**`, your production origin with `/**`, and
     the Vercel preview origin(s) with `/**` to **Redirect URLs** as needed.
     Remove preview URLs that should no longer be allowed.
5. Confirm the production build loads, an admin can sign in, public
   submissions are moderated, and unauthorized accounts cannot access admin
   data.

## Privacy

The site sends `noindex` directives and `public/robots.txt` disallows crawling.
These are requests to crawlers, not access controls. Approved messages,
publicly readable photos, and their storage URLs remain public under the
configured Supabase policies. Do not upload or enter information that should
not be shared with visitors. Social metadata uses a generic title and
description and does not include a family name or featured-photo URL.
