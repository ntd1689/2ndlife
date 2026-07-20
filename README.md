# 2ndLife

Give your items a second life in second hand. Buy. Sell. Bid. Repeat.

This is the production scaffold: Next.js + PostgreSQL (Prisma) + Resend (email OTP)
+ Cloudflare R2 (photo/video storage) + PayPal (payments, Lynk to follow) +
Google SSO (OAuth 2.0, optional).

Throughout the UI a posting is called an **"ad"** — the database models and code
still use the name `Listing`, but everything the user reads says "ad".

## What's built vs. what's left

**Done and working:**
- Database schema (users, ads, offers, media, payments, parishes/categories,
  admin settings, ad views)
- **Two ways to sign in:**
  - **Email-first signup with OTP verification via Resend** (no Twilio/SMS
    cost) — users verify by email, then optionally add a phone number
    afterward as plain contact info (not SMS-verified) so buyers can reach them
  - **"Sign in with Google" (OAuth 2.0)** — optional; the buttons only appear
    on the login and post-ad pages when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
    are set. First-time Google users get a profile created from their Google
    name, email, and picture; an existing email account is linked by email;
    returning users log straight in. See `app/api/auth/google/`.
- **Post-ad flow skips re-verification when you're already logged in** — it
  jumps straight to the ad details (or the phone step if you haven't saved a
  number yet) instead of asking for your email again.
- Ad create/search/filter by parish + category + subcategory
- **Markdown descriptions** — the description field has a small formatting
  toolbar (bold, italic, bullet/numbered lists) with a live preview; ad and
  My Ads pages render the formatting safely as React elements (no raw HTML).
  See `app/components/DescriptionEditor.tsx` and `MarkdownText.tsx`.
- **Offer system (no on-site item payments)** — every ad takes offers;
  each offer must top the current highest; sellers set an optional asking
  price and optional offer deadline, review offers in My Ads, and formally
  accept one, which marks the ad sold and emails that buyer the seller's
  contact info. The site never processes the item payment itself.
- **Unique view tracking** — one count per unique viewer per ad (logged-in
  users keyed by user id, anonymous visitors by a hash of IP + user agent; the
  owner's own visits don't count). Shown on the ad page, My Ads, and admin.
- **Premium tiers — Top Ads and VIP Ads** — each ad has a `sortOrder` position
  weight (lower = higher placement). Position weights 1–10 render as **★ VIP**
  (gold badge), 11–20 as **TOP** (teal badge), on both cards and the ad detail
  page. Admins set the price and duration for each tier, promote/demote ads
  manually (with an optional custom day count) or by editing an ad's position
  weight, and the tier auto-expires back to standard via the daily cron. See
  `lib/premium.ts`.
- **Admin-configurable marketplace settings** at `/admin` — free-ad duration
  (default 30 days), plus Top/VIP price and duration. Stored in a single
  `AdminSettings` row; read by ad creation, relisting, and display copy. See
  `lib/settings.ts`.
- 500MB video cap enforced server-side (not just in the browser)
- Daily cron job: expires lapsed premium tiers, expires free ads after their
  configured window, deletes media 30 days after that
- PayPal order creation + capture (sandbox-ready), with real PayPal Buttons
  rendered in the browser — `app/components/PayPalCheckoutButtons.tsx` loads
  the PayPal SDK, the post-ad flow creates the ad first, then shows the
  buttons to upgrade it to unlimited/featured, and capture applies the effect
  once PayPal confirms the payment
- Lynk adapter stubbed out, ready to fill in once you have merchant credentials
- Visual design ported from the approved prototype: header with your logo,
  pinned-card ads, mustard "featured" ribbons, teal/cream palette,
  Fraunces/Inter/IBM Plex Mono type — see `app/globals.css`
- **Admin moderation** at `/admin` — buyers can report an ad from the
  ad detail page; admins (anyone whose verified email is listed in
  `ADMIN_EMAILS`) see an open-reports queue and can hide, unhide, or
  permanently delete any ad. A hidden ("removed") ad is distinct
  from an owner's own "archived" one, so the owner can't self-restore
  something a moderator took down. Log in at `/admin` the same way as
  everywhere else — email + one-time code, no separate admin password.

- **Seller-facing paid checkout for Top/VIP tiers** — from My Ads, a seller can
  promote (or renew) any active ad to Top or VIP via PayPal at the
  admin-configured price; capture/webhook place the ad in the tier's position
  band and extend on renewal. See `app/api/listings/[id]/promote/` and
  `app/components/PromoteDialog.tsx`.
- **Signup page** at `/signup` (name → email OTP → optional phone) and a
  login page that accepts any existing account and points unknown emails to
  sign up.
- **Favorites** — heart button on cards and ad pages, saved list at
  `/favorites`.
- **Account settings** at `/profile` — edit display name and phone after
  signup.
- **About Us** page at `/about`, linked from the footer.

**Left to finish before this is fully production-ready — see "Next steps" at the bottom:**
- Lynk integration itself (blocked on you getting merchant API access)
- A full end-to-end PayPal test (order → approve → capture) — the flow is
  built but has only run against placeholder sandbox credentials
- No automated tests yet — everything has been verified manually in-browser

---

## 1. Local setup

```bash
cd 2ndlife
npm install
cp .env.example .env.local   # then fill in the values, see sections below
npm run db:push              # applies the schema to your DEV database
npm run db:seed              # loads parishes + categories into DEV
npm run dev
```

Visit `http://localhost:3000`.

This repo uses `prisma db push` (schema-driven) rather than a committed
migration history — run `npm run db:push` again after any change to
`prisma/schema.prisma`. Never point a Prisma **shadow database** at your real
database: the shadow DB gets reset, which wipes your data.

### Dev vs production database

Local development and the live site use **separate databases**, so testing
never touches real data:

| Where | Reads | Managed with |
|-------|-------|--------------|
| `npm run dev`, local scripts | `.env` / `.env.local` → **dev DB** | `npm run db:push`, `npm run db:seed` |
| Deployed **production** | Vercel Production env → **prod DB** | `npm run db:push:prod`, `npm run db:seed:prod` |
| Vercel Preview / Development | dev DB | — |

The `:prod` scripts read `.env.production.local` (create it from your production
connection strings; it's gitignored) and target the live database explicitly.
Committing and deploying to production never runs a schema push — after a
`prisma/schema.prisma` change, apply it to prod yourself with
`npm run db:push:prod`.

While `RESEND_API_KEY` is empty, OTP codes are printed to your terminal
instead of actually sent — useful for testing the flow with zero email cost.

---

## 2. Accounts you need to create

### Database — Supabase
1. Sign up at supabase.com and create a project (pick a region close to
   your users — `us-east-1` is a good fit for Jamaica).
2. In the dashboard hit **Connect** → **ORMs** → **Prisma**. It shows two
   connection strings:
   - the **transaction pooler** one (port 6543) goes in `DATABASE_URL` —
     append `?pgbouncer=true&connection_limit=1`
   - the **session pooler** one (port 5432) goes in `DIRECT_URL`
3. Run `npm run db:push:prod` against it once, then `npm run db:seed:prod` (these target the production DB via `.env.production.local`).

### File storage — Cloudflare R2
1. Sign up at cloudflare.com → R2.
2. Create a bucket (e.g. `2ndlife-media`), make it public or put a custom
   domain/CDN in front of it.
3. Create an API token with R2 read/write access → fills `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`.
4. Set `R2_PUBLIC_BASE_URL` to the public bucket URL or your custom domain.

### Account verification — Resend (email, no Twilio cost)
1. Sign up free at resend.com.
2. Grab an API key from the dashboard → fills `RESEND_API_KEY`.
3. While testing, `onboarding@resend.dev` works as the `from` address with no
   setup. Once you're ready for real users, verify your own domain in Resend
   (e.g. `noreply@2ndlifejm.net`) and update `RESEND_FROM_EMAIL` — this
   matters for deliverability (verified-domain emails are far less likely to
   land in spam than the shared sandbox address).
4. Free tier is generous (100 emails/day, 3,000/month as of writing) — likely
   enough for a while at this scale, since each signup only needs one OTP email.

### Payments — PayPal
1. Sign up for a PayPal Business account.
2. Go to developer.paypal.com → Apps & Credentials → create an app.
3. Copy the Sandbox Client ID/Secret first to test end-to-end before going live.
4. Fill in `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, leave `PAYPAL_ENV=sandbox`
   until you're ready to charge real money, then switch to `live` with your
   live credentials.
5. Note: PayPal settles in USD, not JMD — `lib/payments/paypal.ts` converts
   your JMD fee to USD using `JMD_TO_USD_RATE`. Update that rate periodically;
   it's not a live FX lookup.

### Sign-in with Google — OAuth 2.0 (optional)
Google SSO is optional; skip this and users just sign in by email OTP.
1. Go to console.cloud.google.com → **APIs & Services → Credentials** and
   create an **OAuth 2.0 Client ID** (application type: Web application).
2. Under **Authorized redirect URIs**, add `<your site origin>/api/auth/google/callback`
   — e.g. `http://localhost:3000/api/auth/google/callback` for local dev and
   `https://www.2ndlifejm.net/api/auth/google/callback` for production. Add both
   if you want SSO to work in both places.
3. Copy the generated client ID and secret into `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`. The "Sign in with Google" buttons appear
   automatically once both are set; they hide when either is missing.

### Payments — Lynk (for later)
Lynk doesn't have a public self-serve API. Apply for a LynkBiz merchant
account at lynk.us (or email sales@lynk.us). Once approved, they'll send you
credentials and integration docs — implement `lib/payments/lynk.ts` the same
way `lib/payments/paypal.ts` is built. Until then, only offer PayPal as a
payment option in the UI.

### Domain — 2ndlifejm.net
1. Register `2ndlifejm.net` through any mainstream registrar (Namecheap,
   Cloudflare, GoDaddy, …) — `.net` has no special requirements.
2. Once registered, point its DNS at Vercel (Vercel will show you the exact
   A/CNAME records to add after you connect the domain in your Vercel project).

---

## 3. Deploying to production

1. Push this code to a GitHub repository.
2. Go to vercel.com → New Project → import that repo.
3. In Vercel project settings → Environment Variables, paste in everything
   from your `.env.local` (using your **production** Supabase/R2/Resend/PayPal
   values, not sandbox/dev ones where applicable).
4. Deploy. Vercel will build and give you a `*.vercel.app` URL immediately.
5. In Vercel project settings → Cron Jobs, confirm the job from `vercel.json`
   is active (it runs `/api/cron/expire-listings` daily at 6am UTC — it expires
   lapsed premium tiers, expires free ads past their window, and purges old
   media). Enable "Protect your Cron Jobs" so `CRON_SECRET` is required — set
   the same value in your environment variables.
6. In Vercel project settings → Domains, add `www.2ndlifejm.net` (plus a
   redirect from the bare `2ndlifejm.net`) and follow the DNS instructions
   shown there.
7. Run `npm run db:push:prod` once against your **production** database and
   `npm run db:seed:prod` to load parishes and categories into it (both read
   `.env.production.local`).
8. Switch PayPal to live credentials once you've tested a few real sandbox
   transactions end-to-end.

At that point the site is live at your domain, talking to a real database,
sending real OTP codes, storing real photos/video, and able to take real
PayPal payments for listing upgrades.

---

## 4. Next steps I'd recommend, in order

1. **Set `ADMIN_EMAILS`** in your production environment variables to your
   own verified email (comma-separate more if you have a small mod team),
   so `/admin` is usable on day one.
2. **Run a real PayPal sandbox transaction end-to-end** (post an ad, buy a
   Top/VIP promotion, confirm the webhook applies it) before switching
   `PAYPAL_ENV` to `live`.
3. **Set up Google SSO credentials** (see the account section above) if you
   want one-click sign-in alongside email OTP.
4. **Apply for your Lynk merchant account** so it's ready to implement by the
   time everything else is live.
5. **Add automated tests** around the offer, payment, and premium-tier logic —
   the highest-value place to start a test suite.

Let me know which of these you'd like to tackle next and I'll build it out.
