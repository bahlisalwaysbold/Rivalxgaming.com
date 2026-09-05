# Rival X

Compete. Improve. Conquer. — an eFootball tournament hub with player
registration, entry-fee payments (Naira, via Paystack), profiles, and a
leaderboard.

## What's in this build

- **Pages:** Home, Tournaments (list + detail with entry payment),
  Register, Log in, Player profile, Leaderboard.
- **Design:** dark theme with silver/red metallic accents matching the
  Rival X logo, angular clipped-corner panels instead of rounded cards.
- **Data:** currently mock data in `src/data/mockData.js`. This is what
  you're seeing on every page right now — swap it for real Supabase
  queries once your tables exist.
- **Auth:** stubbed through Supabase (email + Google) in `src/lib/supabase.js`.
- **Payments:** stubbed through Paystack in `src/lib/paystack.js`, since
  Stripe doesn't support payouts to Nigerian accounts — Paystack is the
  standard alternative and works the same way (hosted checkout, no card
  data touches your code).

## Getting it running

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Before this can go live

1. **Supabase** (accounts + database)
   - Create a free project at supabase.com.
   - Copy your Project URL and anon key into `.env.local` (see `.env.example`).
   - Enable Email and Google sign-in under Authentication → Providers.
   - Create tables for `players`, `tournaments`, `entries`, and `matches` —
     ask me and I'll write the schema and swap the mock data over for you.

2. **Paystack** (payments)
   - Create an account at paystack.com and complete business verification —
     this is required before you can receive real payouts.
   - Copy your Public Key into `.env.local`.
   - Add `<script src="https://js.paystack.co/v1/inline.js"></script>` to
     `index.html` before you deploy.
   - Set up a webhook (a Supabase Edge Function works well) so entries are
     only confirmed after Paystack verifies the payment server-side — never
     trust the browser alone for that.

3. **Domain + hosting**
   - Vercel or Netlify both deploy a Vite site like this for free with one
     click, and either can attach a custom domain once you pick one.

4. **Images**
   - See `public/images/README.md` — every placeholder box in the UI names
     exactly what to shoot or source.

## Design tokens

Colors and shared styles live in `src/index.css` as CSS variables
(`--bg`, `--panel`, `--red`, etc.) so the whole site stays consistent if
you want to adjust the palette later.
