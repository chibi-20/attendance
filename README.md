# Presensya — AP10 Attendance Tracker

SF2-style attendance tracker for a Grade 10 Araling Panlipunan teacher. React + Vite + Tailwind, backed by Supabase.

## Setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. In the Supabase SQL editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). This creates the schema, RLS policies, and a trigger that auto-creates a `profiles` row for new users.
3. In Supabase → Authentication → Users, add your teacher account (email + password). No public sign-up is exposed by the app.
4. Copy `.env.example` to `.env` and fill in your project's URL and anon key (Project Settings → API):
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
5. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```

## Deploying

Push to Vercel as a static Vite app; set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the Vercel project settings.

## Notes

- Attendance is mark-by-exception: `attendance_records` only stores `late`/`absent` rows. A school day with no row for a student means Present. This keeps daily roll call fast — only tap the students who are late or absent.
- Weekends are excluded from school-day counts by default. Override any date (mark a weekend as a class day, or a weekday as a holiday/suspension/event) in the Calendar screen.
