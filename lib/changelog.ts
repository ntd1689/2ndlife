// Human-readable release history shown on /changelog. Newest first.
//
// HOW TO UPDATE: when you ship a change, add a new entry to the TOP of this
// array with a bumped version and today's date, then bump the "version" field
// in package.json to match. CURRENT_VERSION (used as the production version
// badge) is always the first entry's version.
//
// AUDIENCE: each change is visible only to viewers at or above its audience
// tier. A plain string is treated as "public" (everyone). Use an object with
// an `audience` to scope internal changes:
//   "public"   — public visitors and advertisers (the default)
//   "reviewer" — ads reviewers and administrators
//   "admin"    — administrators only
// A release with no changes visible to the viewer is hidden entirely.

export type Audience = "public" | "reviewer" | "admin";

// A change is either a public one-liner or a tagged object for internal notes.
export type Change = string | { text: string; audience: Audience };

export type Release = {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  changes: Change[];
};

// Higher rank = more restricted. A viewer sees a change when their own level
// is >= the change's rank.
export const AUDIENCE_RANK: Record<Audience, number> = {
  public: 0,
  reviewer: 1,
  admin: 2,
};

export function changeAudience(c: Change): Audience {
  return typeof c === "string" ? "public" : c.audience;
}

export function changeText(c: Change): string {
  return typeof c === "string" ? c : c.text;
}

// Returns the changes in a release the given viewer level is allowed to see.
export function visibleChanges(release: Release, viewerLevel: number): Change[] {
  return release.changes.filter((c) => AUDIENCE_RANK[changeAudience(c)] <= viewerLevel);
}

export const CHANGELOG: Release[] = [
  {
    version: "1.6.0",
    date: "2026-07-20",
    title: "Revenue & ads analytics for admins",
    changes: [
      { audience: "admin", text: "New Payments dashboard: collected revenue, refunds, and net — broken down by purchase type and provider, with the top-value advertisers and a filterable payment ledger, all scoped to a date range or custom period." },
      { audience: "admin", text: "New Ads Analytics dashboard with charts: ad views and revenue over time, top-visited ads, and revenue and views broken down by category and parish — filterable by period." },
    ],
  },
  {
    version: "1.5.0",
    date: "2026-07-20",
    title: "Ad review & approval workflow",
    changes: [
      "Every new or edited ad now enters Pending Review and stays hidden from the public until approved.",
      "Advertisers get automatic email notifications at each stage (submitted, approved, rejected, changes requested) and see the status in My Ads.",
      { audience: "reviewer", text: "New Ads Reviewer role: reviewers (and admins) approve, reject, or request changes on ads from a dedicated /review dashboard." },
      { audience: "admin", text: "Admin dashboard redesigned: fixed sidebar navigation, collapsible sections, and paginated tables (Showing 1–25 of N)." },
      { audience: "admin", text: "Separated development and production databases so testing never touches live data." },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-07-19",
    title: "User management & moderation",
    changes: [
      "Money fields now format with thousands separators as you type (1,250,000).",
      { audience: "admin", text: "Admins can search users by email/phone/name and block or unblock accounts." },
      { audience: "admin", text: "Blocking a user logs them out everywhere, hides their active ads, and preserves those ads' photos while blocked." },
      { audience: "admin", text: "Admins can turn new sign-ups on or off." },
      { audience: "admin", text: "Admins can sort the ads list by date created or last updated." },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-07-18",
    title: "Payments & refunds",
    changes: [
      "Advertisers can see their full payment history at /payments.",
      "Request a refund within the allowed window after purchase.",
      "Reliability fixes for the PayPal checkout and capture flow.",
      { audience: "admin", text: "Admin refund queue with a configurable request window — approve to refund via PayPal and reverse the purchased upgrade." },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-07-17",
    title: "Faster media & account settings",
    changes: [
      "Photos are downscaled on upload and served as optimized images through a CDN — much faster page loads on mobile.",
      "New account settings page (/profile) to update your display name and phone after signup.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-07-17",
    title: "Public launch 🎉",
    changes: [
      "2ndLife went live at www.2ndlifejm.net with real payments (PayPal), email verification, and photo/video hosting.",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-07-09",
    title: "Accounts, favorites & promotions",
    changes: [
      "Dedicated signup page and a smoother login flow.",
      "Save ads to your favorites and view them in one place.",
      "Sellers can promote their own ads to Top or VIP placement via PayPal.",
      "About Us page and assorted polish and speed-ups.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-07-05",
    title: "Premium tiers & sign-in options",
    changes: [
      "Top and VIP ad placements with badges.",
      "Unique view counts on ads.",
      "Sign in with Google (optional), alongside email one-time codes.",
      { audience: "admin", text: "Admins set placement pricing and duration for the Top and VIP tiers." },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-07-04",
    title: "Offers & richer listings",
    changes: [
      "Buyers make offers on ads; sellers review and accept the one they want.",
      "Markdown-formatted ad descriptions with a live preview.",
      "Redesigned marketplace navigation.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-07-03",
    title: "Browse & moderation",
    changes: [
      "Category and parish browsing.",
      "Report ads you think break the rules.",
      { audience: "admin", text: "Admin moderation: hide, unhide, and remove ads." },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-07-02",
    title: "First build",
    changes: ["Initial 2ndLife marketplace scaffold."],
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;
