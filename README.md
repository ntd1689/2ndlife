# 2ndLife

Give your items a second life in second hand. Buy. Sell. Bid. Repeat.

This is the production scaffold: Next.js + PostgreSQL (Prisma) + Resend (email OTP)
+ Cloudflare R2 (photo/video storage) + PayPal (payments, Lynk to follow).

## What's built vs. what's left

**Done and working:**
- Database schema (users, listings, bids, media, payments, parishes/categories)
- **Email-first signup with OTP verification via Resend** (no Twilio/SMS cost) —
  users verify by email, then optionally add a phone number afterward as plain
  contact info (not SMS-verified) so buyers can reach them
- Listing create/search/filter by parish + category + subcategory
- Bidding logic with the J$100 increment rule, buy-now, bid-end-date enforcement
- 500MB video cap enforced server-side (not just in the browser)
- Daily cron job: expires free listings after 7 days, deletes media 30 days after that
- PayPal order creation + capture (sandbox-ready), with real PayPal Buttons
  rendered in the browser — `app/components/PayPalCheckoutButtons.tsx` loads
  the PayPal SDK, the post-ad flow creates the listing first, then shows the
  buttons to upgrade it to unlimited/featured, and capture applies the effect
  once PayPal confirms the payment
- Lynk adapter stubbed out, ready to fill in once you have merchant credentials
- Visual design ported from the approved prototype: header with your logo,
  pinned-card listings, mustard "featured" ribbons, teal/cream palette,
  Fraunces/Inter/IBM Plex Mono type — see `app/globals.css`

**Left to finish before this is fully production-ready — see "Next steps" at the bottom:**
- Lynk integration itself (blocked on you getting merchant API access)
- Admin moderation tools (a way to hide/remove a reported listing)
- A few smaller pages still use plain inline styles (listing detail actions) —
  functional, just not as polished as the homepage/cards yet
- A way for a user to add/change their phone number later from a profile page
  (right now it's only collected once, right after signup)

---

## 1. Local setup

```bash
cd 2ndlife
npm install
cp .env.example .env.local   # then fill in the values, see sections below
npx prisma migrate dev --name init
npm run seed                  # loads parishes + categories
npm run dev
```

Visit `http://localhost:3000`.

While `RESEND_API_KEY` is empty, OTP codes are printed to your terminal
instead of actually sent — useful for testing the flow with zero email cost.

---

## 2. Accounts you need to create

### Database — Neon (recommended) or Supabase
1. Sign up at neon.tech (or supabase.com).
2. Create a project, copy the connection string into `DATABASE_URL`.
3. Run `npx prisma migrate deploy` against it once, then `npm run seed`.

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
   (e.g. `noreply@2ndlife.com.jm`) and update `RESEND_FROM_EMAIL` — this
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

### Payments — Lynk (for later)
Lynk doesn't have a public self-serve API. Apply for a LynkBiz merchant
account at lynk.us (or email sales@lynk.us). Once approved, they'll send you
credentials and integration docs — implement `lib/payments/lynk.ts` the same
way `lib/payments/paypal.ts` is built. Until then, only offer PayPal as a
payment option in the UI.

### Domain — .com.jm
1. Register through a mainstream registrar that supports `.com.jm`
   (e.g. Gandi, or a Jamaica-based registrar). It's open to anyone, no
   residency requirement.
2. Once registered, point its DNS at Vercel (Vercel will show you the exact
   A/CNAME records to add after you connect the domain in your Vercel project).

---

## 3. Deploying to production

1. Push this code to a GitHub repository.
2. Go to vercel.com → New Project → import that repo.
3. In Vercel project settings → Environment Variables, paste in everything
   from your `.env.local` (using your **production** Neon/R2/Resend/PayPal
   values, not sandbox/dev ones where applicable).
4. Deploy. Vercel will build and give you a `*.vercel.app` URL immediately.
5. In Vercel project settings → Cron Jobs, confirm the job from `vercel.json`
   is active (it runs `/api/cron/expire-listings` daily at 6am UTC). Enable
   "Protect your Cron Jobs" so `CRON_SECRET` is required — set the same value
   in your environment variables.
6. In Vercel project settings → Domains, add your `.com.jm` domain and follow
   the DNS instructions shown there.
7. Run `npx prisma migrate deploy` once against your **production** database
   (from your local machine with `DATABASE_URL` pointed at production, or via
   a one-off Vercel deployment build step) and `npm run seed` to load parishes
   and categories into the live database.
8. Switch PayPal to live credentials once you've tested a few real sandbox
   transactions end-to-end.

At that point the site is live at your domain, talking to a real database,
sending real OTP codes, storing real photos/video, and able to take real
PayPal payments for listing upgrades.

---

## 4. Next steps I'd recommend, in order

1. **Apply for your Lynk merchant account** so it's ready to implement by the
   time everything else is live.
2. **Add basic admin tooling** — a way to hide/remove a listing if it's
   reported, since you'll need this from day one.
3. **Polish remaining pages** — the listing detail page's action buttons are
   functional but still plain; the homepage and listing cards already match
   the approved design.

Let me know which of these you'd like to tackle next and I'll build it out.
