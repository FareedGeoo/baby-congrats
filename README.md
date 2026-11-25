# Baby Congratulations

A baby congratulations website where friends and family can leave messages and photos for new parents.

**Stack:** React (Vite) + Tailwind CSS + Supabase (database + storage), deployed on Vercel.

---

## Features

1. **Theme switch** – "Baby Boy" (soft blues, stars, clouds) and "Baby Girl" (soft pinks, hearts, flowers). Toggle in the header, remembered in `localStorage`. URL param `?theme=boy` or `?theme=girl` overrides.
2. **Hero section** – Baby name, birth date, welcome message. All editable in `src/config.js`.
3. **Guestbook form** – Name, message, optional photo (jpg/png/webp, max 5MB, client-side compressed). Thank-you confirmation after submit.
4. **Wall of congratulations** – Card grid of messages with photos, newest first, lightbox for full-size photos. Realtime updates via Supabase.
5. **Admin page** at `/admin` – Supabase email/password auth. Approve or delete messages. New messages are hidden until approved.
6. **Responsive, mobile-first, accessible** – Alt text, labels, contrast, gentle animations.

---

## Project Structure

```
supabase/schema.sql   # Database schema, RLS policies, storage bucket
.env.example          # Supabase env var template (copy to .env)
.gitignore            # Excludes .env, node_modules, dist, .vercel
vercel.json           # SPA rewrite for /admin on refresh
vite.config.js        # Vite config
tailwind.config.js    # Tailwind config with theme colors
postcss.config.js     # Tailwind + Autoprefixer
src/
  config.js           # Editable baby name, birth date, welcome message
  main.jsx            # React entry point
  App.jsx             # Routing (/, /admin)
  index.css           # Tailwind directives + theme CSS variables
  lib/supabase.js     # Supabase client singleton
  hooks/useTheme.js   # localStorage + URL param theme sync
  hooks/useMessages.js# Fetch + Supabase realtime subscription
  components/         # ThemeToggle, Header, Hero, GuestbookForm, MessageCard, MessageGrid, Lightbox, ProtectedRoute
  pages/              # Home, Admin
  utils/              # compressImage, formatDate
```

---

## Prerequisites

- Node.js (v18+)
- A [Supabase](https://supabase.com) account and project
- A [Vercel](https://vercel.com) account (for deployment)

---

## Step 1: Set up Supabase

1. Create a new project in [Supabase](https://app.supabase.com).
2. Go to **SQL Editor** and paste the entire contents of `supabase/schema.sql`, then run it.
   - This creates the `messages` table, enables RLS, creates the `baby-photos` public storage bucket, and sets all policies.
3. Go to **Authentication > Users** and create an admin user (email + password). You'll sign in with this at `/admin`.
4. Go to **Authentication > Settings** and make sure **Email Confirmation** is disabled (or confirm the admin email manually), otherwise sign-in won't work.
5. Go to **API** and copy your **Project URL** and **anon public key**.

---

## Step 2: Set up locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the env example and fill in your Supabase credentials:

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:5173. Visit `/admin` and sign in with the admin user you created.

---

## Step 3: Customize

Edit `src/config.js` to set the baby's name, birth date, and welcome message:

```js
export const BABY_NAME = 'Emma';
export const BIRTH_DATE = 'January 15, 2025';
export const WELCOME_MESSAGE = 'Welcome to the world, little one!';
```

---

## Step 4: Deploy to Vercel

1. Push your code to a GitHub repository (make sure `.env` is in `.gitignore` — it is by default).
2. Import the repo in [Vercel](https://vercel.com).
3. Add the following **Environment Variables** in Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Vercel will detect Vite and use `vite build` with output directory `dist`.
5. `vercel.json` includes an SPA rewrite so direct access to `/admin` works on refresh.

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL | `https://abcdef.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon public key | `eyJhbG...` |

Never commit `.env`. Never use a `service_role` key in the frontend.

---

## Admin Workflow

1. Visit `/admin` and sign in with the admin email/password created in Supabase.
2. All messages appear, newest first. Unapproved ones show "Pending".
3. Click **Approve** to publish a message to the public wall.
4. Click **Delete** to remove a message (and its photo from storage).

---

## Realtime

New approved messages appear on the wall without refreshing, thanks to a Supabase Realtime subscription on the `messages` table.

---

## License

MIT