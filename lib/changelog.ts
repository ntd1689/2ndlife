// Human-readable release history shown on /changelog. Newest first.
//
// HOW TO UPDATE: when you ship a change, add a new entry to the TOP of this
// array with a bumped version and today's date, then bump the "version" field
// in package.json to match. CURRENT_VERSION (used as the production version
// badge) is always the first entry's version.

export type Release = {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  changes: string[];
};

export const CHANGELOG: Release[] = [
  {
    version: "1.5.0",
    date: "2026-07-20",
    title: "Ad review & approval workflow",
    changes: [
      "New Ads Reviewer role: reviewers (and admins) approve, reject, or request changes on ads from a dedicated /review dashboard.",
      "Every new or edited ad now enters Pending Review and stays hidden from the public until approved.",
      "Advertisers get automatic email notifications at each stage (submitted, approved, rejected, changes requested) and see the status in My Ads.",
      "Admin dashboard redesigned: fixed sidebar navigation, collapsible sections, and paginated tables (Showing 1–25 of N).",
      "Separated development and production databases so testing never touches live data.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-07-19",
    title: "User management & moderation",
    changes: [
      "Admins can search users by email/phone/name and block or unblock accounts.",
      "Blocking a user logs them out everywhere, hides their active ads, and preserves those ads' photos while blocked.",
      "Admins can turn new sign-ups on or off.",
      "Money fields now format with thousands separators as you type (1,250,000).",
      "Admins can sort the ads list by date created or last updated.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-07-18",
    title: "Payments & refunds",
    changes: [
      "Advertisers can see their full payment history at /payments.",
      "Refund requests within an admin-configurable window, with an admin approval queue that refunds via PayPal and reverses the purchased upgrade.",
      "Reliability fixes for the PayPal checkout and capture flow.",
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
      "Top and VIP ad placements with badges, admin-set pricing and duration.",
      "Unique view counts on ads.",
      "Sign in with Google (optional), alongside email one-time codes.",
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
      "Admin moderation: report, hide, unhide, and remove ads.",
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
