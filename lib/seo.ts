// Canonical site origin used for metadata, canonical URLs, robots, and the
// sitemap. Defaults to production; override with NEXT_PUBLIC_SITE_URL in other
// environments. Kept in one place so every SEO surface agrees on the origin.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.2ndlifejm.net"
).replace(/\/$/, "");

// Turn a site-relative path (or an already-absolute URL) into an absolute URL.
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

// Build a clean, single-line meta description from free-text listing copy:
// strip markdown/whitespace and cap length so search snippets read well.
export function toMetaDescription(text: string, max = 155): string {
  const clean = text
    .replace(/[#*_`>~\[\]()]/g, " ") // drop common markdown punctuation
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).replace(/\s+\S*$/, "").trim() + "…";
}
