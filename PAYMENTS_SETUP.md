# Setting up the database + secure payments

This adds four database tables and a webhook function that makes
payments scam-proof on both sides — a player can't fake a "paid"
status, and every entry is tied to a real logged-in account.

## 1. Create the tables

1. Open your Supabase project → SQL Editor.
2. Open `supabase/schema.sql` from this folder, and **before running
   it**, replace both instances of `'YOUR-ADMIN-USER-ID-HERE'` with
   your own user ID. Find it at Authentication → Users → click your
   account → copy the UID.
3. Paste the whole file into the SQL Editor and click Run.

This creates `players`, `tournaments`, `entries`, and `matches`, each
with Row Level Security rules already applied — see the comments in
the file for exactly what each policy does.

## 2. Deploy the webhook function

The webhook is what actually confirms a payment happened — it runs on
Supabase's servers, not in the browser, so it can't be faked.

Install the Supabase CLI if you don't have it, then from the project
folder:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy paystack-webhook
```

Then set its two secrets (these never go in your frontend code):

```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxxxxxxx
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Your service role key is in Supabase → Settings → API Keys, under
"Secret keys" — the one you were told never to put in frontend code.
This is the one place it's meant to go, because this function only
ever runs on Supabase's own servers.

## 3. Point Paystack at the webhook

In your Paystack dashboard → Settings → API Keys & Webhooks, set the
Webhook URL to:

```
https://your-project-ref.supabase.co/functions/v1/paystack-webhook
```

## 4. What changed in the app code

- `src/pages/TournamentDetail.jsx` now creates a real `entries` row
  (status `pending`) tied to the logged-in player before opening
  Paystack checkout, instead of just showing a browser popup with no
  record of it.
- `src/lib/paystack.js` now generates a real reference and passes it
  through, so the webhook has something to match against.
- The "Payment received" message the player sees is just UX — the
  entry only actually becomes `paid` once the webhook confirms it
  server-side, usually within a few seconds.

## Once this is live

Tell me and I'll wire the Profile and Leaderboard pages to pull real
data from these tables instead of the mock data.
